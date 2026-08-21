// PyodideRuntime.js - EXPERIMENTAL alternative Python runtime (CPython on
// wasm) for build123d-lite, selected with `?pyruntime=pyodide`.
//
// Brython stays the default (see PythonRuntime.js and
// test/b123d-validation/runtime-comparison.md for the measurements behind
// that call). This module exists so the choice is a measurement rather than
// an assumption: it runs the SAME Build123dLite.js source, unmodified, on
// real CPython 3.14 and must reproduce the harness classification exactly.
//
// It is only reachable when the Pyodide core distribution has been vendored
// (`node packages/cascade-core/scripts/fetch-pyodide.cjs`) and copied to
// dist/pyodide/ by the build; otherwise the bootstrap fails loudly and the
// user can fall back to Brython.
//
// The interesting part is the interop layer, which has to reproduce the
// boundary semantics Brython gives build123d-lite for free:
//
//  * `from browser import self as w` — a `browser` module is registered whose
//    `self` proxies the worker's JS globals. Brython auto-converts Python
//    containers to JS ones on the way out and JS arrays to list-likes on the
//    way in; Pyodide does neither, so the facade does it explicitly.
//  * Object identity. Lite compares shapes with `is` (JS-side indexOf cannot
//    see through the wrappers), which requires the same JS object to always
//    surface as the same Python object. Pyodide mints a fresh JsProxy per
//    conversion, so the bridge memoizes them by `js_id` for the duration of
//    an evaluation.
//  * `w.sceneShapes` is a LIVE array (show() clears it with .pop() and adds
//    with .push()), so the list-like it converts to writes those two
//    mutators through to the JS array.
//  * `getPythonUserLine` (CacheOp's line tagging) and `_pythonCallerFrame`
//    (the Builder same-stack-frame rule) are plain CPython frame walks —
//    `sys._getframe()` sees the user's frames even when the call arrives
//    from JS, because the JS call is synchronous from Python.
//  * Stdlib: CPython brings math/copy/typing/functools/itertools/operator/
//    timeit/random/os for real, so only the POLICY shims are registered
//    (scipy's Nelder-Mead/quickhull stand-ins, the pytest.approx subset, and
//    the logging swallower).

import { BUILD123D_LITE_PY, PY_SHIM_MODULES } from './Build123dLite.js';
import { bootstrapPyodideRealB123d } from './PyodideRealB123d.js';

/** The module name user scripts execute under (frame walks look for it). */
const PY_USER_MODULE = 'main';

/** Shims that stay shimmed on CPython: these encode a POLICY (what lite
 *  refuses to fake / where it substitutes an algorithm), not a missing
 *  stdlib. Everything else in PY_SHIM_MODULES is a Brython gap filler and is
 *  replaced by the real CPython module. */
const PYODIDE_SHIMS = ['logging', '_scipy_shim', 'scipy', 'scipy.optimize',
  'scipy.spatial', 'pytest'];

/** pysrc=real (REAL build123d 0.11.1 over the OCP shim) drops the logging
 *  swallower: real CPython logging runs for real — build123d's module
 *  loggers write nothing without handlers, and stderr streams to the console
 *  as '[py-stderr]' lines instead of being replayed through console.error
 *  (which rethrows). The scipy/pytest shims stay: they are POLICY (the
 *  validated Nelder-Mead/quickhull/approx substitutes; the real scipy wheel
 *  is a measured 20x-payload non-default, see runtime-comparison.md). */
const PYODIDE_REAL_SHIMS = ['_scipy_shim', 'scipy', 'scipy.optimize',
  'scipy.spatial', 'pytest'];

let _runtimePromise = null;
let _bootedPySrc = null;

/** Lazily bootstrap Pyodide + build123d-lite (or, with pySrc === 'real',
 *  REAL build123d 0.11.1 over the OCP shim — see PyodideRealB123d.js).
 *  Same contract as ensurePythonRuntime(): resolves to an object with
 *  `run(code)`. One worker session boots ONE source mode. */
export function ensurePyodideRuntime(pySrc) {
  const srcKind = pySrc === 'real' ? 'real' : 'lite';
  if (_runtimePromise && _bootedPySrc && _bootedPySrc !== srcKind) {
    return Promise.reject(new Error(
      'the Pyodide runtime is already booted with pysrc=' + _bootedPySrc +
      '; reload the page to switch to pysrc=' + srcKind));
  }
  if (!_runtimePromise) {
    _bootedPySrc = srcKind;
    _runtimePromise = _bootstrap(srcKind).catch((e) => {
      _runtimePromise = null; // allow a retry on the next evaluation
      _bootedPySrc = null;
      throw e;
    });
  }
  return _runtimePromise;
}

/** Python source of the interop bridge (executed as the module `_cs_bridge`,
 *  which also registers `browser`). Kept free of backticks and ${ } for the
 *  same reason Build123dLite.js is. */
const BRIDGE_PY = `
import sys, types, builtins, traceback
import js
from pyodide.ffi import to_js, JsProxy, JsArray

_USER_MODULE = 'main'
_object_from_entries = js.Object.fromEntries

# js_id -> the FIRST JsProxy handed to Python for that JS object. Brython
# hands out one stable wrapper per JS object, and build123d-lite relies on it
# ('existing is topo' over w.sceneShapes). Cleared between evaluations.
_proxy_cache = {}
_fn_cache = {}


class JsList(list):
    """A JS array as a Python list. Reads are a snapshot of wrapped elements
    (so 'is' comparisons and isinstance(..., list) both behave); push/pop
    write through, which is what show() needs from w.sceneShapes."""

    __slots__ = ('_js',)

    def __init__(self, jsarr):
        list.__init__(self, [_wrap(x) for x in jsarr])
        self._js = jsarr

    def push(self, value):
        self._js.push(_unwrap(value))
        list.append(self, value)

    def pop(self, index=-1):
        if index == -1 or index == len(self) - 1:
            self._js.pop()
        else:
            self._js.splice(index, 1)
        return list.pop(self, index)


def _wrap(value):
    """JS -> Python at the worker boundary (mirrors Brython's jsobj2pyobj)."""
    if isinstance(value, JsProxy):
        if isinstance(value, JsArray):
            return JsList(value)
        key = value.js_id
        got = _proxy_cache.get(key)
        if got is None:
            _proxy_cache[key] = value
            return value
        return got
    return value


def _unwrap(value):
    """Python -> JS (mirrors Brython's pyobj2jsobj): lists/tuples become real
    JS arrays, dicts become plain objects, JsProxies unwrap to their JS
    object, primitives pass through."""
    if value is None or isinstance(value, (bool, int, float, str, JsProxy)):
        return value
    if isinstance(value, JsList):
        return value._js
    return to_js(value, dict_converter=_object_from_entries)


class _JsFn:
    """A JS worker function with Brython's conversion behaviour."""

    __slots__ = ('_fn', '_name')

    def __init__(self, fn, name):
        self._fn = fn
        self._name = name

    def __call__(self, *args, **kwargs):
        if kwargs:
            return _wrap(self._fn(*[_unwrap(a) for a in args],
                                 **dict((k, _unwrap(v)) for k, v in kwargs.items())))
        return _wrap(self._fn(*[_unwrap(a) for a in args]))

    def __repr__(self):
        return '<worker function ' + self._name + '>'


def _python_caller_frame():
    """The frame of the code that called the function asking for it — the
    Builder same-stack-frame rule. (Brython walks $B.frame_obj.prev.)"""
    frame = sys._getframe(1)
    return frame.f_back if frame is not None else None


def get_python_user_line():
    """Innermost line number inside the user's module (CacheOp line tagging).
    Called FROM JS while the user's Python frames are still on the stack."""
    frame = sys._getframe(1)
    while frame is not None:
        if frame.f_globals.get('__name__') == _USER_MODULE:
            return frame.f_lineno
        frame = frame.f_back
    return 0


_natives = {
    '_pythonCallerFrame': _python_caller_frame,
    'getPythonUserLine': get_python_user_line,
}


class WorkerGlobals:
    """'from browser import self as w' — the CAD worker's JS global scope."""

    def __getattr__(self, name):
        native = _natives.get(name)
        if native is not None:
            return native
        fn = _fn_cache.get(name)
        if fn is not None:
            return fn
        value = getattr(js, name)     # AttributeError if the global is unset
        if callable(value):
            # The standard library is installed once at worker startup, so
            # its function objects are stable and worth caching (the bridge
            # is on the hot path of every CAD call).
            fn = _JsFn(value, name)
            _fn_cache[name] = fn
            return fn
        return _wrap(value)

    def __setattr__(self, name, value):
        setattr(js, name, _unwrap(value))


_browser = types.ModuleType('browser')
_browser.self = WorkerGlobals()
_browser.window = _browser.self
_browser.console = js.console
sys.modules['browser'] = _browser


def register_module(name, source):
    module = types.ModuleType(name)
    module.__name__ = name
    module.__builtins__ = builtins
    sys.modules[name] = module
    try:
        exec(compile(source, '<' + name + '>', 'exec'), module.__dict__)
    except BaseException:
        del sys.modules[name]
        raise
    if '.' in name:
        parent, _, leaf = name.rpartition('.')
        setattr(sys.modules[parent], leaf, module)
    return module


def run_user(source):
    """Execute user code as a fresh module 'main'. Returns None on success or
    the formatted traceback (line numbers = the user's editor lines) — the
    error crosses back as a VALUE so nothing is lost in exception
    translation."""
    _proxy_cache.clear()
    module = types.ModuleType(_USER_MODULE)
    module.__name__ = _USER_MODULE
    module.__builtins__ = builtins
    # Brython gives the user module a __file__ and a dozen upstream doc
    # scripts derive an asset directory from it
    # (os.path.dirname(os.path.abspath(__file__))). Same string on both
    # runtimes so the scripts take the same branch.
    module.__file__ = 'cascade-worker.js#main'
    sys.modules[_USER_MODULE] = module
    # The PREVIOUS run's module just became unreachable — collect its cycles
    # NOW (build123d builders are cyclic, so plain refcounting won't free
    # them) so the OCP proxies' __del__ fires and the kernel objects are
    # reclaimed BEFORE this run allocates on top of them. reset_state's
    # collect is too early for this: the old module is still in sys.modules.
    import gc
    gc.collect()
    try:
        code = compile(source, '<main>', 'exec')
    except BaseException as exc:
        return ''.join(traceback.format_exception_only(type(exc), exc))
    try:
        exec(code, module.__dict__)
        # pysrc=real: populate the implicit scene from module globals when
        # the script never called show() (real build123d builds through the
        # OCP shim, so the glue assembles the scene after the run). The
        # attribute does not exist on build123d-lite — a no-op there.
        _hook = getattr(sys.modules.get('build123d'), '_cs_after_run', None)
        if _hook is not None:
            _hook(module.__dict__)
    except BaseException as exc:
        # Drop this function's own frame from the traceback.
        tb = exc.__traceback__.tb_next if exc.__traceback__ else None
        return ''.join(traceback.format_exception(type(exc), exc, tb))
    return None


def reset_state():
    _proxy_cache.clear()
    try:
        import build123d
        build123d._reset_state()
    except Exception:
        pass
    # Break reference cycles from the previous run so their OCP proxies'
    # __del__ fires (the shim frees the kernel objects at op boundaries).
    import gc
    gc.collect()
`;

async function _bootstrap(srcKind) {
  const isReal = srcKind === 'real';
  const t0 = performance.now();
  // Dual-path like brython.js: the build copies the vendored core
  // distribution next to the worker bundle.
  const indexURL = typeof ESBUILD !== 'undefined'
    ? new URL('./pyodide/', self.location.href).href
    : new URL('../../../../vendor/pyodide/', self.location.href).href;

  // A non-analyzable specifier keeps esbuild from trying to bundle Pyodide
  // (it must stay an external, lazily fetched asset).
  const moduleURL = indexURL + 'pyodide.mjs';
  let pyodideModule;
  try {
    pyodideModule = await import(/* @vite-ignore */ moduleURL);
  } catch (e) {
    // A plain checkout has no vendor/pyodide, so this is the expected way to
    // arrive here: say so instead of leaking "failed to fetch module".
    throw new Error('Pyodide is not available at ' + moduleURL +
      ' — the experimental ?pyruntime=pyodide runtime needs the vendored core ' +
      'distribution: run `node packages/cascade-core/scripts/fetch-pyodide.cjs` ' +
      'and rebuild, or drop the flag to use Brython. (' + e.message + ')');
  }
  const tImported = performance.now();

  const stderrBuffer = [];
  const pyodide = await pyodideModule.loadPyodide({
    indexURL,
    // Python print() lands in the worker console exactly like Brython's.
    stdout: (line) => { console.log(line); },
    // The worker's console.error override RETHROWS, so lite buffers stderr
    // and replays it only when the evaluation survived. pysrc=real streams
    // it as prefixed console.log lines instead: REAL build123d emits benign
    // stderr (warnings.warn, logging lastResort) that must never masquerade
    // as an evaluation error.
    stderr: isReal
      ? (line) => { console.log('[py-stderr] ' + line); }
      : (line) => { stderrBuffer.push(line); },
  });

  const tInitialized = performance.now();
  self._pyodideRuntime = pyodide; // memoryStats() reads its wasm heap

  const bridge = pyodide.runPython(BRIDGE_PY + '\nglobals()');
  const registerModule = bridge.get('register_module');
  const runUser = bridge.get('run_user');
  const resetState = bridge.get('reset_state');
  const userLine = bridge.get('get_python_user_line');

  for (const name of (isReal ? PYODIDE_REAL_SHIMS : PYODIDE_SHIMS)) {
    if (PY_SHIM_MODULES[name]) { registerModule(name, PY_SHIM_MODULES[name]); }
  }
  if (isReal) {
    // REAL build123d 0.11.1 over the OCP shim (wheels + OCP proxies +
    // third-party stubs + worker glue) — see PyodideRealB123d.js.
    await bootstrapPyodideRealB123d(pyodide, registerModule, indexURL);
  } else {
    registerModule('build123d', BUILD123D_LITE_PY);
  }

  // Same split as the Brython path: fetching the interpreter, bringing it
  // up, compiling build123d-lite. `initMs` covers loadPyodide, which does
  // its own fetching of pyodide.asm.wasm + python_stdlib.zip — so on a cold
  // cache it carries the download too.
  const tDone = performance.now();
  self._pythonBootTiming = {
    runtime: 'pyodide',
    pySrc: srcKind,
    version: pyodide.version,
    fetchMs: +(tImported - t0).toFixed(1),
    initMs: +(tInitialized - tImported).toFixed(1),
    libMs: +(tDone - tInitialized).toFixed(1),
    totalMs: +(tDone - t0).toFixed(1),
  };
  console.log('[pyruntime] pyodide boot ' + JSON.stringify(self._pythonBootTiming));

  return {
    /** Execute user Python source. Throws a JS Error whose message starts
     *  with the one-line Python summary followed by the full traceback. */
    run(code) {
      for (const k in self.argCache) { delete self.argCache[k]; }
      // Own the shared hooks: a worker that has ALSO booted Brython (mode
      // switched mid-session) must not keep Brython's frame walker.
      self.getPythonUserLine = () => userLine();
      self._pythonRuntimeKind = 'pyodide';
      self._pythonSrcKind = srcKind;
      self._b123dSceneDefined = false;
      stderrBuffer.length = 0;

      resetState();
      const trace = runUser(code);
      if (trace) { throw new Error(_formatPythonError(trace)); }
      for (const line of stderrBuffer) { console.error(line); }
    },
    /** Test/benchmark hook: the wasm heap the Python interpreter occupies. */
    heapBytes() {
      try { return pyodide._module.HEAPU8.length; } catch (e) { return 0; }
    },
    pyodide,
  };
}

/** Same shape as the Brython formatter: summary first (so a truncated error
 *  surface still shows the interesting line), then the whole traceback. */
function _formatPythonError(trace) {
  const text = String(trace).trim();
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  let summary = lines.length > 0 ? lines[lines.length - 1] : 'unknown error';
  // A raw OCCT Standard_Failure escapes as a JS number; decode it the way
  // the Brython path does instead of showing a bare pointer.
  const raw = summary.match(/JsException:\s*(\d+)\s*$/);
  if (raw && self.describeOCCTException) {
    summary = 'INTERNAL OPENCASCADE ERROR: ' +
      self.describeOCCTException(parseInt(raw[1], 10));
  }
  return 'Python ' + summary + (lines.length > 1 ? '\n' + text : '');
}
