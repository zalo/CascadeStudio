// MicroPythonRuntime.js - MicroPython (wasm) backend for Python mode
//
// Selected with `?pyruntime=micropython` (see EditorManager.resolvePyRuntime).
// Same Build123dLite.js source and stdlib shims as the Brython default, on a
// much smaller interpreter: micropython.mjs + micropython-settrace.wasm are
// ~228 KB gz combined (vs Brython's ~268 KB) and boot in ~10 ms (vs ~540 ms),
// with a fixed, small GC heap — the memory-minimizing option (the target
// use case is headless/constrained execution, e.g. 128 MB-budget workers).
//
// Portability notes (each verified empirically — see the PR/commit message):
//  * The settrace wasm VARIANT is used so the two runtime hooks work:
//    `getPythonUserLine` (CacheOp's line tagging) and `_pythonCallerFrame`
//    (Builder.__enter__'s same-stack-frame rule). MicroPython has no
//    sys._getframe; a sys.settrace handler tracks the CURRENT frame on
//    'call'/'line' events and the hooks walk the live `f_back` chain from
//    there. (A maintained frame STACK would leak: MicroPython fires no
//    'return' event when an exception unwinds a frame.) Frame objects are
//    identity-stable, so lite's `is` comparison works. Tracing costs ~3.5x
//    on pure-Python loops; model time inside OCCT is unaffected.
//  * JS exceptions MUST NOT cross the FFI into the VM: a `throw` unwinds the
//    wasm frames without running MicroPython's nlr cleanup and the error
//    escapes every Python `except`. So every worker-library call goes
//    through `_csMpCall`, which catches on the JS side (decoding raw OCCT
//    wasm exception numbers like the Brython path) and returns {ok, ...};
//    the Python `browser` shim re-raises a real Python exception.
//  * Python lists/dicts cross the FFI as opaque proxies (no .length, not
//    Array.isArray), so the `browser` shim converts call arguments with
//    jsffi.to_js (deep; unwraps JsProxy elements back to the original JS
//    objects, so shape identity is preserved — MicroPython's proxying keeps
//    `is`/=== identity in BOTH directions, unlike Brython).
//  * MicroPython builtin modules shadow sys.path, so shims for names that
//    exist as builtins (math, json, os, random) are imported under an alias
//    and remapped via sys.modules; the rest import normally from /lib.

import { BUILD123D_LITE_PY, PY_SHIM_MODULES } from './Build123dLite.js';
import { bootstrapUpstreamB123d } from './UpstreamB123d.js';

/** MicroPython GC heap. Fixed at boot (it does not grow); build123d-lite +
 *  a typical model's Python-side bookkeeping fit comfortably — shapes
 *  themselves live in the OCCT wasm heap. */
const MP_HEAP_BYTES = 16 * 1024 * 1024;

/** The Python side of the bridge, installed as the importable module
 *  `browser` (so `from browser import self as w` works unchanged). Kept in
 *  String.raw so backslashes survive; must contain no backticks or ${. */
const BROWSER_PY = String.raw`import sys
import io
import jsffi
from jsworker import self as _js

# ---------------------------------------------------------------------- #
# Current-frame tracking (settrace wasm variant).                         #
# ---------------------------------------------------------------------- #
_cur = [None]

def _cs_trace(frame, event, arg):
    if event == 'call' or event == 'line':
        _cur[0] = frame
    return _cs_trace

def _cs_install_trace():
    sys.settrace(_cs_trace)

def _cs_user_line():
    """Innermost 'main' (user-module) frame's current line, or 0."""
    f = _cur[0]
    while f is not None:
        if f.f_code.co_filename == 'main':
            return f.f_lineno
        f = f.f_back
    return 0

def _cs_caller_frame():
    """Frame of the code that called the Python function that called us
    (Brython: B.frame_obj.prev — used by Builder.__enter__)."""
    f = _cur[0]              # our own frame (set by our 'call'/'line' event)
    if f is not None and f.f_back is not None:
        return f.f_back.f_back
    return None

# ---------------------------------------------------------------------- #
# The worker-global wrapper lite sees as 'w'.                             #
# ---------------------------------------------------------------------- #
class _CsWorkerError(RuntimeError):
    pass

class _Fn:
    def __init__(self, name):
        self._name = name
    def __call__(self, *args):
        r = _js._csMpCall(self._name, jsffi.to_js(list(args)))
        if r.ok:
            return r.value
        raise _CsWorkerError(str(r.error))
    def __getattr__(self, name):
        # JS functions can carry properties (Date.now, Object.keys, ...);
        # forward attribute access to the underlying JS function object.
        # (Instance members win before __getattr__, so _name stays direct.)
        return getattr(getattr(_js, self._name), name)

_fn_cache = {}

class _WorkerGlobal:
    def __getattr__(self, name):
        if name == '_pythonCallerFrame':
            return _cs_caller_frame
        if name == 'getPythonUserLine':
            return _cs_user_line
        f = _fn_cache.get(name)
        if f is not None:
            return f
        kind = _js._csMpKind(name)
        if kind == 'func':
            f = _Fn(name)
            _fn_cache[name] = f
            return f
        if kind == 'missing':
            raise AttributeError(name)
        return getattr(_js, name)
    def __setattr__(self, name, value):
        setattr(_js, name, value)

self = _WorkerGlobal()

# ---------------------------------------------------------------------- #
# Module registration (called from JS with each shim's source).           #
# ---------------------------------------------------------------------- #
_BUILTIN_CONFLICTS = ('math', 'json', 'os', 'random', 'io', 'time', 're',
                      'collections', 'struct', 'errno')
import os as _os

def _cs_register_module(name, src, is_package):
    parts = name.split('.')
    if len(parts) == 1 and name in _BUILTIN_CONFLICTS:
        alias = '_cs_alias_' + name
        with open('/lib/' + alias + '.py', 'w') as fh:
            fh.write(src)
        mod = __import__(alias)
        sys.modules[name] = mod
        del sys.modules[alias]
        return
    d = '/lib'
    for p in parts[:-1]:
        d = d + '/' + p
        try:
            _os.mkdir(d)
        except OSError:
            pass
    if is_package:
        try:
            _os.mkdir(d + '/' + parts[-1])
        except OSError:
            pass
        path = d + '/' + parts[-1] + '/__init__.py'
    else:
        path = d + '/' + parts[-1] + '.py'
    with open(path, 'w') as fh:
        fh.write(src)
    mod = __import__(name)
    # __import__('a.b') returns a; make sure the submodule itself is bound
    if len(parts) > 1:
        sub = sys.modules.get(name)
        parent = sys.modules.get(parts[0])
        if sub is not None and parent is not None:
            setattr(parent, parts[-1], sub)

# ---------------------------------------------------------------------- #
# User-code execution ('main' module; nothing prepended, so traceback     #
# line numbers are the user's editor lines).                              #
# ---------------------------------------------------------------------- #
def _cs_run_user(src):
    import build123d
    build123d._reset_state()
    g = {'__name__': 'main', '__file__': 'main'}
    # OSError-subclass builtins CPython has and MicroPython lacks; an alias
    # to OSError keeps 'except FileNotFoundError:' scripts running
    for _n in ('FileNotFoundError', 'PermissionError', 'NotADirectoryError',
               'IsADirectoryError', 'InterruptedError'):
        try:
            eval(_n)
        except NameError:
            g[_n] = OSError
    try:
        exec(compile(src, 'main', 'exec'), g)
        return None
    except Exception as e:
        buf = io.StringIO()
        sys.print_exception(e, buf)
        tb = buf.getvalue().strip()
        lines = [l for l in tb.split('\n') if l.strip()]
        summary = lines[-1] if lines else 'unknown error'
        out = 'Python ' + summary
        if len(lines) > 1:
            out = out + '\n' + tb
        return out
`;

let _runtimePromise = null;
let _bootedPySrc = null;

/** Lazily bootstrap MicroPython + build123d. Same contract as the
 *  Brython/Pyodide runtimes: resolves to an object with `run(code)`.
 *
 *  Source-layer resolution (the MicroPython DEFAULT is upstream):
 *  - 'lite' (`?pysrc=lite` / localStorage cascade-py-src=lite): lite is the
 *    `build123d` package, like Brython/Pyodide.
 *  - 'upstream' (explicit `?pysrc=upstream`): lite registers as
 *    `build123d_lite` and UPSTREAM build123d 0.11.1 Level-A source layers on
 *    top as `build123d` (see UpstreamB123d.js); a missing vendored payload
 *    is a hard error.
 *  - anything else ('auto', the no-flag default): upstream when the payload
 *    is available, otherwise a console-warned fallback to lite — never a
 *    hard failure.
 *  One worker session boots ONE source mode; switching requires a reload. */
export function ensureMicroPythonRuntime(pySrc) {
  const srcKind = pySrc === 'lite' ? 'lite'
    : (pySrc === 'upstream' ? 'upstream' : 'auto');
  // 'auto' is compatible with whatever actually booted; an EXPLICIT choice
  // that contradicts the booted layer needs a reload.
  if (_runtimePromise && srcKind !== 'auto' && _bootedPySrc !== 'auto' &&
      _bootedPySrc !== srcKind) {
    return Promise.reject(new Error(
      'the MicroPython runtime is already booted with pysrc=' + _bootedPySrc +
      '; reload the page to switch to pysrc=' + srcKind));
  }
  if (!_runtimePromise) {
    _bootedPySrc = srcKind;
    _runtimePromise = _bootstrap(srcKind).then((runtime) => {
      _bootedPySrc = runtime.pySrc; // the EFFECTIVE layer ('upstream'|'lite')
      return runtime;
    }).catch((e) => {
      _runtimePromise = null; // allow a retry on the next evaluation
      _bootedPySrc = null;
      throw e;
    });
  }
  return _runtimePromise;
}

async function _bootstrap(srcKind) {
  const t0 = performance.now();
  const isBuilt = typeof ESBUILD !== 'undefined';
  // Node harnesses (experiments/upstream-on-micropython) run this module
  // outside a worker: they pre-set the interpreter locations explicitly.
  const locate = self._csMicroPythonLocate || null;
  const base = isBuilt
    ? './'
    : '../../node_modules/@micropython/micropython-webassembly-pyscript/';
  const mjsURL = locate ? locate.mjsURL
    : new URL(base + 'micropython.mjs', import.meta.url).href;
  const wasmURL = locate ? locate.wasmURL
    : new URL(base + 'micropython-settrace.wasm', import.meta.url).href;
  const mod = await import(/* webpackIgnore: true */ mjsURL);
  const load = (mod && mod.loadMicroPython) || self.loadMicroPython;
  if (!load) {
    throw new Error('micropython.mjs did not provide loadMicroPython');
  }
  const tFetched = performance.now();

  const mp = await load({
    url: wasmURL,
    heapsize: MP_HEAP_BYTES,
    stdout: (line) => console.log(line),
    stderr: (line) => console.log('[py-stderr] ' + line),
  });
  const tInitialized = performance.now();

  // JS side of the guarded call bridge. Everything lite invokes on `w` runs
  // inside this try/catch so no JS exception ever unwinds the wasm VM.
  self._csMpCall = function (name, args) {
    try {
      const fn = self[name];
      if (typeof fn !== 'function') {
        return { ok: false, error: 'worker global ' + name + ' is not callable' };
      }
      return { ok: true, value: fn.apply(self, args) };
    } catch (e) {
      let msg;
      if (typeof e === 'number' && self.describeOCCTException) {
        msg = 'INTERNAL OPENCASCADE ERROR: ' + self.describeOCCTException(e);
      } else {
        msg = (e && e.message) ? String(e.message) : String(e);
      }
      return { ok: false, error: msg };
    }
  };
  self._csMpKind = function (name) {
    const v = self[name];
    if (typeof v === 'function') { return 'func'; }
    return (v !== undefined || name in self) ? 'value' : 'missing';
  };

  mp.registerJsModule('jsworker', { self: self });
  mp.globals.set('_CS_BROWSER_SRC', BROWSER_PY);
  mp.runPython([
    "import sys, os",
    "try:",
    "    os.mkdir('/lib')",
    "except OSError:",
    "    pass",
    "with open('/lib/browser.py', 'w') as f:",
    "    f.write(_CS_BROWSER_SRC)",
    "sys.path.insert(0, '/lib')",
    "import browser",
    "browser._cs_install_trace()",
  ].join('\n'));
  const br = mp.pyimport('browser');

  // Same pure-Python stdlib shims as the Brython path (they all resolve
  // `from browser import self` against the shim module registered above),
  // then build123d-lite itself.
  const shimNames = Object.keys(PY_SHIM_MODULES);
  for (const name of shimNames) {
    const isPackage = shimNames.some((k) => k.indexOf(name + '.') === 0);
    try {
      br._cs_register_module(name, PY_SHIM_MODULES[name], isPackage);
    } catch (e) {
      console.warn('[pyruntime] micropython: shim module ' + name + ' failed to load: '
        + ((e && e.message) || e));
    }
  }
  let effectiveSrc = srcKind === 'lite' ? 'lite' : 'upstream';
  if (effectiveSrc === 'upstream') {
    // UPSTREAM-source mode (the MicroPython default): lite becomes the seam
    // library `build123d_lite`; the `build123d` package is upstream 0.11.1
    // Level-A source layered on top by UpstreamB123d.js (fetched from
    // dist/upstream-b123d/).
    // Transient fetch failures (several parallel tabs booting at once can
    // ECONNRESET a dev http-server) must NOT flip the source layer, so every
    // payload read retries with backoff; only a REAL 404/missing payload
    // reaches the probe's fallback below.
    const fetchOnce = async (rel) => {
      let url;
      if (isBuilt) {
        url = new URL('./upstream-b123d/' + rel, import.meta.url).href;
      } else if (rel.indexOf('upstream/') === 0) {
        url = new URL('../../vendor/build123d-0.11.1/' + rel.slice(9),
          import.meta.url).href;
      } else {
        url = new URL('../../upstream-py/' + rel, import.meta.url).href;
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        const permanent = resp.status === 404;
        const err = new Error('pysrc=upstream: could not load ' + rel + ' (' +
          resp.status + '). Vendored upstream sources missing? Run ' +
          'node packages/cascade-core/scripts/fetch-upstream-b123d.cjs ' +
          'and rebuild.');
        err._csPermanent = permanent;
        throw err;
      }
      return resp.text();
    };
    const fetchText = self._csUpstreamFetchText || (async (rel) => {
      let lastErr;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          return await fetchOnce(rel);
        } catch (e) {
          lastErr = e;
          if (e && e._csPermanent) { break; }
          await new Promise((res) => setTimeout(res, 150 * (attempt + 1)));
        }
      }
      throw lastErr;
    });
    // Probe the payload BEFORE registering anything: the no-flag default
    // ('auto') falls back to lite with a warning when the vendored upstream
    // sources are missing at runtime; explicit pysrc=upstream stays a hard,
    // actionable error.
    let available = true;
    try {
      await fetchText('manifest.json');
    } catch (probeErr) {
      if (srcKind === 'upstream') { throw probeErr; }
      available = false;
      console.warn('[pyruntime] micropython: upstream build123d payload '
        + 'unavailable — falling back to build123d-lite ('
        + String((probeErr && probeErr.message) || probeErr).split('\n')[0]
        + ')');
    }
    if (available) {
      br._cs_register_module('build123d_lite', BUILD123D_LITE_PY, false);
      await bootstrapUpstreamB123d(mp, br, fetchText);
    } else {
      effectiveSrc = 'lite';
    }
  }
  if (effectiveSrc === 'lite') {
    br._cs_register_module('build123d', BUILD123D_LITE_PY, false);
  }

  const getMpUserLine = () => {
    try { return Number(br._cs_user_line()) || 0; } catch (e) { return 0; }
  };

  const tDone = performance.now();
  self._pythonBootTiming = {
    runtime: 'micropython',
    pySrc: effectiveSrc,
    fetchMs: +(tFetched - t0).toFixed(1),
    initMs: +(tInitialized - tFetched).toFixed(1),
    libMs: +(tDone - tInitialized).toFixed(1),
    totalMs: +(tDone - t0).toFixed(1),
    heapBytes: MP_HEAP_BYTES,
  };
  console.log('[pyruntime] micropython boot ' + JSON.stringify(self._pythonBootTiming));
  self._csMpInterpreter = mp; // benchmark/debug access

  return {
    pySrc: effectiveSrc,
    /** Execute user Python source synchronously (same contract as the
     *  Brython runtime: throws a JS Error whose message is the Python
     *  summary + traceback with user editor line numbers). */
    run(code) {
      for (const k in self.argCache) { delete self.argCache[k]; }
      self.getPythonUserLine = getMpUserLine;
      self._pythonRuntimeKind = 'micropython';
      self._pythonSrcKind = effectiveSrc;
      self._b123dSceneDefined = false;
      const err = br._cs_run_user(code);
      if (err) { throw new Error(String(err)); }
    }
  };
}
