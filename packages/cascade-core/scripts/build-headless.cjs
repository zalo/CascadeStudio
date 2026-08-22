/**
 * Bundle src/headless.js -> dist/cascade-headless.mjs.
 *
 * Separate from the plain `npx esbuild` call the worker bundle uses because it
 * enforces ONE extra invariant: the bundle must contain no runtime code
 * generation, because Cloudflare Workers refuse it outright ("EvalError: Code
 * generation from strings disallowed for this context").
 *
 * Emscripten's embind used to violate that by construction: it built every
 * method invoker with `new Function(argNames, body)` (and emval built its call
 * thunks the same way), so the OCCT module could not even finish registering
 * its classes on Workers. This script used to swap those two factories for
 * hand-written closure equivalents at bundle time — COMPROMISE(embind-no-eval).
 * That workaround is RETIRED: the opencascade.js fork is now compiled with
 * `-sDYNAMIC_EXECUTION=0` (builds/cascadestudio.yml), so the shipped glue is
 * eval-free at the compiler level and both bundles — browser worker and
 * headless — get the same closure-based invokers from emscripten itself.
 *
 * What is left here is the guard. If a future opencascade.js bump loses the
 * flag, the eval'd invokers come back silently and the Worker dies on its
 * first request; instead, this build FAILS. Two checks:
 *
 *   1. the OCCT glue module, as loaded: no `new Function(`, no `eval(`;
 *   2. the emitted bundle: no `new Function(` at all, and the only `eval(`
 *      left is CascadeWorker's `language: 'cascadestudio'` path (evaluating
 *      user JS IS eval — that language is simply unavailable on Workers).
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const pkgRoot = path.join(__dirname, '..');
const monoRoot = path.join(pkgRoot, '..', '..');
const distDir = path.join(pkgRoot, 'dist');

const NEW_FUNCTION = /new Function\s*\(/;
const EVAL_CALL = /(^|[^.\w$])eval\s*\(/;
const FIX = 'opencascade.js must be built with `-sDYNAMIC_EXECUTION=0`'
  + ' (see builds/cascadestudio.yml in the fork) — Cloudflare Workers reject'
  + ' code generation from strings.';

/** Guard 1: the OCCT glue emscripten produced. */
const assertEvalFreeOcct = {
  name: 'cs-assert-eval-free-occt',
  setup(build) {
    build.onLoad({ filter: /[\\/]cascadestudio\.js$/ }, async (args) => {
      const contents = fs.readFileSync(args.path, 'utf8');
      for (const [re, what] of [[NEW_FUNCTION, 'new Function('], [EVAL_CALL, 'eval(']]) {
        const m = re.exec(contents);
        if (m) {
          const at = contents.slice(Math.max(0, m.index - 60), m.index + 120);
          throw new Error('build-headless: the OpenCascade glue (' + args.path
            + ') generates code from strings — found `' + what + '` at offset '
            + m.index + ':\n    …' + at.replace(/\n/g, ' ') + '…\n  ' + FIX);
        }
      }
      return { contents, loader: 'js' };
    });
  },
};

const outfile = path.join(distDir, 'cascade-headless.mjs');

esbuild.build({
  entryPoints: [path.join(pkgRoot, 'src', 'headless.js')],
  bundle: true,
  minify: true,
  keepNames: true,
  sourcemap: true,
  format: 'esm',
  target: 'es2022',
  outfile,
  external: ['fs', 'path', 'os', 'module', 'worker_threads'],
  loader: { '.wasm': 'file' },
  define: { ESBUILD: 'true' },
  absWorkingDir: monoRoot,
  plugins: [assertEvalFreeOcct],
  logLevel: 'info',
}).then(() => {
  // Guard 2: the emitted bundle. `new Function(` must be gone entirely; the
  // JS-mode `eval(userCode)` in CascadeWorker is the one allowed site.
  const bundle = fs.readFileSync(outfile, 'utf8');
  const nf = NEW_FUNCTION.exec(bundle);
  if (nf) {
    throw new Error('build-headless: `new Function(` survives in '
      + path.relative(monoRoot, outfile) + ' at offset ' + nf.index + ':\n    …'
      + bundle.slice(Math.max(0, nf.index - 80), nf.index + 120).replace(/\n/g, ' ')
      + '…\n  ' + FIX);
  }
  const evals = [];
  const scan = new RegExp(EVAL_CALL.source, 'g');
  let m;
  while ((m = scan.exec(bundle)) !== null) {
    const before = bundle.slice(Math.max(0, m.index - 120), m.index + m[0].length - 5);
    evals.push({
      context: before.slice(-90).replace(/\n/g, ' ') + 'eval(',
      // The one allowed JS site: `…_evaluatePython(payload);return}try{eval(
      // userCode)` — CascadeWorker's `language: 'cascadestudio'` branch.
      allowed: /_evaluatePython/.test(before) && /try\s*\{\s*$/.test(before)
        // …and PYTHON text embedded in the bundle, which has its own `eval()`
        // (build123d-lite's exception shim). Minified JS is one long line, so
        // a newline within the preceding 120 chars means this match is inside
        // an embedded multi-line source string, not JS the engine will run.
        || /\n/.test(before),
    });
  }
  const unexpected = evals.filter((e) => !e.allowed).map((e) => e.context);
  if (unexpected.length > 0) {
    throw new Error('build-headless: unexpected `eval(` in '
      + path.relative(monoRoot, outfile) + ' (only CascadeWorker\'s user-JS path'
      + ' may eval):\n    …' + unexpected.join('…\n    …') + '…\n  ' + FIX);
  }
  console.log('[cascade-core] headless bundle is eval-free (0 `new Function`, '
    + evals.length + ' `eval(` — all in the user-JS branch or embedded Python)');
}).catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
