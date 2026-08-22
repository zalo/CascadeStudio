/**
 * Bundle src/headless.js -> dist/cascade-headless.mjs.
 *
 * Separate from the plain `npx esbuild` call the worker bundle uses because
 * it needs ONE source transform:
 *
 *   COMPROMISE(embind-no-eval) — Emscripten's embind generates every method
 *   invoker with `new Function(argNames, body)`. Cloudflare Workers refuse
 *   ALL runtime code generation ("EvalError: Code generation from strings
 *   disallowed for this context"), so the OCCT module cannot even finish
 *   registering its classes there. Emscripten's own answer is to compile the
 *   glue with `-sDYNAMIC_EXECUTION=0`, which swaps `createJsInvoker` for a
 *   closure-based factory; rebuilding the OCCT fork for that is a separate
 *   (multi-hour) exercise, so this does the same substitution on the shipped
 *   glue: `createJsInvoker` is replaced with a hand-written closure factory
 *   that produces an OBSERVABLY IDENTICAL invoker (same wiring order, same
 *   destructor handling, same `this` semantics, `length` restored so
 *   introspection still matches).
 *
 *   Scope: the HEADLESS bundle only. The browser worker keeps the stock glue
 *   byte-for-byte — browsers allow `new Function`, and the eval-free path,
 *   while semantically equal, is measurably slower for the hottest call
 *   shape (V8 cannot specialize one shared closure the way it specializes a
 *   generated monomorphic function).
 *
 *   The anchors are asserted: if a future opencascade.js changes them, the
 *   build FAILS loudly rather than silently shipping a Worker that dies on
 *   its first request.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const pkgRoot = path.join(__dirname, '..');
const monoRoot = path.join(pkgRoot, '..', '..');
const distDir = path.join(pkgRoot, 'dist');

// --- the eval-free replacement for embind's createJsInvoker -------------- //
const ANCHOR_START = 'function createJsInvoker(argTypes,isClassMethodFunc,returns,isAsync){';
const ANCHOR_END = 'return new Function(args1,invokerFnBody)}';

const CLOSURE_INVOKER = ANCHOR_START + `
  // PATCHED by packages/cascade-core/scripts/build-headless.cjs —
  // COMPROMISE(embind-no-eval). Semantically identical to the generated
  // invoker; builds it out of closures so no code is generated from strings.
  var needsDestructorStack = usesDestructorStack(argTypes);
  var argCount = argTypes.length - 2;
  // Which wired values get an explicit destructor call, in the exact order
  // craftInvokerFunction pushes those destructors into the closure args.
  var dtorSlots = [];
  if (!needsDestructorStack) {
    for (var di = isClassMethodFunc ? 1 : 2; di < argTypes.length; ++di) {
      if (argTypes[di].destructorFunction !== null) { dtorSlots.push(di); }
    }
  }
  return function (humanName, throwBindingError, invoker, fn, runDestructors,
                   fromRetWire, toClassParamWire) {
    var extra = Array.prototype.slice.call(arguments, 7);
    var toArgWire = extra.slice(0, argCount);
    var dtors = extra.slice(argCount);
    var invokerFn = function () {
      var destructors = needsDestructorStack ? [] : null;
      var wired = [fn];
      var thisWired;
      if (isClassMethodFunc) {
        thisWired = toClassParamWire(destructors, this);
        wired.push(thisWired);
      }
      var argWired = [];
      for (var i = 0; i < argCount; ++i) {
        var w = toArgWire[i](destructors, arguments[i]);
        argWired.push(w);
        wired.push(w);
      }
      var rv = invoker.apply(null, wired);
      if (needsDestructorStack) {
        runDestructors(destructors);
      } else {
        for (var k = 0; k < dtorSlots.length; ++k) {
          var slot = dtorSlots[k];
          dtors[k](slot === 1 ? thisWired : argWired[slot - 2]);
        }
      }
      if (returns) { return fromRetWire(rv); }
    };
    try {
      Object.defineProperty(invokerFn, 'length', { value: argCount, configurable: true });
    } catch (e) { /* engines that refuse are still functionally correct */ }
    return invokerFn;
  };
}`;

// emval's invoker factory (__emval_create_invoker): reached when C++ calls
// through an emscripten::val. Same treatment, same reason. Everything from
// the `functionBody` string assembly to the `new Function(...)` call is
// replaced by the closure that string was describing.
const EMVAL_START = 'var functionBody;switch(kind){case 0:functionBody="toValue(handle)";break;';
const EMVAL_END = 'var invokerFunction=new Function(Object.keys(captures),functionBody)(...Object.values(captures));';

const EMVAL_REPLACEMENT = `var invokerFunction=(function(){
  // PATCHED by build-headless.cjs — COMPROMISE(embind-no-eval).
  // kind: 0 = call the value, 1 = call a method on it, 2 = construct it,
  // 3 = no call (the generated body is just the parenthesised arg list).
  var toValue = captures.toValue;
  var n = argFromPtr.length;
  var call = function (handle, methodName, argv) {
    var target = toValue(handle);
    if (kind === 0) { return target.apply(undefined, argv); }
    if (kind === 1) { var key = getStringOrSymbol(methodName); return target[key].apply(target, argv); }
    if (kind === 2) { return new (Function.prototype.bind.apply(target, [null].concat(argv)))(); }
    return argv.length ? argv[argv.length - 1] : undefined;
  };
  var readArgs = function (args) {
    var argv = [];
    for (var i = 0; i < n; ++i) { argv.push(argFromPtr[i](args + i * GenericWireTypeSize)); }
    return argv;
  };
  if (retType.isVoid) {
    return function (handle, methodName, destructorsRef, args) {
      call(handle, methodName, readArgs(args));
    };
  }
  return function (handle, methodName, destructorsRef, args) {
    return emval_returnValue(toReturnWire, destructorsRef,
      call(handle, methodName, readArgs(args)));
  };
})();`;

function replaceSpan(source, file, startAnchor, endAnchor, replacement, what) {
  const start = source.indexOf(startAnchor);
  if (start < 0) {
    throw new Error('build-headless: could not find ' + what + ' in ' + file
      + ' — opencascade.js changed; re-derive the COMPROMISE(embind-no-eval) patch.');
  }
  const end = source.indexOf(endAnchor, start);
  if (end < 0) {
    throw new Error('build-headless: ' + what + ' in ' + file + ' no longer ends with `'
      + endAnchor.slice(0, 48) + '…` — re-derive the COMPROMISE(embind-no-eval) patch.');
  }
  return source.slice(0, start) + replacement + source.slice(end + endAnchor.length);
}

function patchOcctGlue(source, file) {
  let out = replaceSpan(source, file, ANCHOR_START, ANCHOR_END, CLOSURE_INVOKER,
    "embind's createJsInvoker");
  out = replaceSpan(out, file, EMVAL_START, EMVAL_END, EMVAL_REPLACEMENT,
    "emval's __emval_create_invoker");
  if (/new Function\(/.test(out)) {
    throw new Error('build-headless: `new Function(` still present in ' + file
      + ' after patching — Cloudflare Workers would reject it.');
  }
  return out;
}

const evalFreeOcct = {
  name: 'cs-eval-free-occt',
  setup(build) {
    build.onLoad({ filter: /[\\/]cascadestudio\.js$/ }, async (args) => ({
      contents: patchOcctGlue(fs.readFileSync(args.path, 'utf8'), args.path),
      loader: 'js',
    }));
  },
};

esbuild.build({
  entryPoints: [path.join(pkgRoot, 'src', 'headless.js')],
  bundle: true,
  minify: true,
  keepNames: true,
  sourcemap: true,
  format: 'esm',
  target: 'es2022',
  outfile: path.join(distDir, 'cascade-headless.mjs'),
  external: ['fs', 'path', 'os', 'module', 'worker_threads'],
  loader: { '.wasm': 'file' },
  define: { ESBUILD: 'true' },
  absWorkingDir: monoRoot,
  plugins: [evalFreeOcct],
  logLevel: 'info',
}).catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
