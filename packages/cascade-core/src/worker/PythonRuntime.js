// PythonRuntime.js - lazy Brython bootstrap for Python (build123d) mode
//
// Architecture (deliberate, per project owner): Python support runs on
// Brython (~1.38 MB JS, ~300 KB gzipped, lazy-loaded on the FIRST Python
// evaluation), NOT Pyodide. Brython compiles Python to JS in-process, so
// Python code calls the very same standard-library functions (and their
// sceneShapes bookkeeping) that JS mode uses — no separate CAD kernel, no
// extra WASM.
//
// Bootstrap steps (module workers lack importScripts):
//  1. fetch brython.js as text and indirect-eval it in the worker's global
//     scope, then pin `self.$B = self.__BRYTHON__` (generated code refers to
//     the global `$B`).
//  2. defensively stub document.dispatchEvent/addEventListener (Brython
//     dispatches a "brython_done" event in non-worker environments).
//  3. execute the embedded build123d-lite source under the module name
//     'build123d' — Brython caches it in $B.imported, which makes
//     `from build123d import *` resolve for user code.
//  4. run user code with __BRYTHON__.runPythonSource(src, 'main'); errors
//     are re-thrown as JS Errors carrying the Python traceback, whose line
//     numbers refer 1:1 to the user's editor lines (the library is a
//     separate module, nothing is prepended to user code).

import { BUILD123D_LITE_PY, PY_SHIM_MODULES } from './Build123dLite.js';
import { ensurePyodideRuntime } from './PyodideRuntime.js';

/** The Brython module name user scripts execute under. */
const PY_USER_MODULE = 'main';

let _runtimePromise = null;

/** Lazily bootstrap the Python runtime + build123d-lite. Returns a Promise
 *  for a runtime object with a synchronous `run(code)` method. Safe to call
 *  on every evaluation — the bootstrap happens once (retried if it failed).
 *
 *  `kind` selects the interpreter: 'brython' (default) or the experimental
 *  'pyodide' (CPython on wasm, `?pyruntime=pyodide`; needs the vendored core
 *  distribution — see PyodideRuntime.js). Both run the same
 *  Build123dLite.js source. */
export function ensurePythonRuntime(kind) {
  if (kind === 'pyodide') { return ensurePyodideRuntime(); }
  if (!_runtimePromise) {
    _runtimePromise = _bootstrap().catch((e) => {
      _runtimePromise = null; // allow a retry on the next evaluation
      throw e;
    });
  }
  return _runtimePromise;
}

async function _bootstrap() {
  const t0 = performance.now();
  // Dual-path like the WASM locateFile: the build copies brython.js next to
  // the worker bundle; unbuilt workers load it from node_modules.
  const brythonURL = typeof ESBUILD !== 'undefined'
    ? './brython.js'
    : '../../node_modules/brython/brython.js';
  const response = await fetch(brythonURL);
  if (!response.ok) {
    throw new Error('Failed to fetch Brython (' + response.status + ') from ' + brythonURL);
  }
  const source = await response.text();
  const tFetched = performance.now();

  // Indirect eval as an importScripts substitute. brython.js begins with
  // "use strict", so its top-level `var __BRYTHON__` stays local to the
  // eval'd script — export it onto the worker global from INSIDE the same
  // script text (this is also where the generated code's `$B` comes from).
  (0, eval)(source +
    '\n;globalThis.__BRYTHON__ = __BRYTHON__; globalThis.$B = __BRYTHON__;');
  if (!self.__BRYTHON__) {
    throw new Error('Brython did not initialize (__BRYTHON__ is undefined after eval)');
  }

  // Brython installs its own non-DOM `document` stub, but it lacks event
  // methods; stub them so any completion-event dispatch is a no-op.
  if (typeof self.document === 'undefined') { self.document = {}; }
  if (!self.document.dispatchEvent) { self.document.dispatchEvent = function () {}; }
  if (!self.document.addEventListener) { self.document.addEventListener = function () {}; }

  const B = self.__BRYTHON__;
  const tInitialized = performance.now();

  // Expose a resolver so CacheOp (StandardUtils.js) can tag shapes with the
  // *Python* source line that produced them: walk Brython's frame chain to
  // the innermost frame belonging to the user module. (The JS-mode
  // getCallingLocation() parses eval stack frames, which is meaningless for
  // Brython-generated code.) This keeps modelHistory line numbers and the
  // viewport's pick → editor-line mapping working in Python mode.
  // Frame of the code that CALLED the currently-executing Python function
  // (build123d-lite's Builder.__enter__ uses it to replicate build123d's
  // same-stack-frame rule for transferring a builder's result to its parent).
  self._pythonCallerFrame = function () {
    try {
      const frameObj = B.frame_obj;
      return frameObj && frameObj.prev ? frameObj.prev.frame : null;
    } catch (e) { return null; }
  };

  const getBrythonUserLine = function () {
    try {
      let frameObj = B.frame_obj;
      while (frameObj) {
        const frame = frameObj.frame;
        if (frame && frame[2] === PY_USER_MODULE) {
          return frame.$lineno || 0;
        }
        frameObj = frameObj.prev;
      }
    } catch (e) { /* line mapping is best-effort */ }
    return 0;
  };
  self.getPythonUserLine = getBrythonUserLine;

  // Register stdlib shims first (brython.js cannot import even its own
  // built-in `math` inside a module worker, and brython_stdlib.js is not
  // shipped), then build123d-lite — executing a source under a module name
  // caches it in $B.imported for subsequent imports.
  for (const name of Object.keys(PY_SHIM_MODULES)) {
    _runGuarded(B, PY_SHIM_MODULES[name], name);
    if (name.indexOf('.') !== -1 && !B.imported[name]) {
      // run_script sanitizes dots out of script ids ('scipy.optimize' is
      // cached as 'scipy_optimize') — alias the module back under its
      // dotted submodule name so `from scipy.optimize import minimize`
      // resolves from the imported-module cache (the 'scipy' shim sets
      // __path__ = [] to satisfy the package check).
      const sanitized = name.replace(/\./g, '_');
      if (B.imported[sanitized]) { B.imported[name] = B.imported[sanitized]; }
    }
  }
  _runGuarded(B, BUILD123D_LITE_PY, 'build123d');

  // Boot budget, split the same way PyodideRuntime reports it (fetching the
  // interpreter / bringing it up / compiling build123d-lite) so the two are
  // directly comparable — see test/b123d-validation/runtime-comparison.md.
  const tDone = performance.now();
  self._pythonBootTiming = {
    runtime: 'brython',
    fetchMs: +(tFetched - t0).toFixed(1),
    initMs: +(tInitialized - tFetched).toFixed(1),
    libMs: +(tDone - tInitialized).toFixed(1),
    totalMs: +(tDone - t0).toFixed(1),
    bytes: source.length,
  };
  console.log('[pyruntime] brython boot ' + JSON.stringify(self._pythonBootTiming));

  return {
    /** Execute user Python source synchronously. Throws a JS Error whose
     *  message starts with the one-line Python summary followed by the full
     *  traceback (line numbers = the user's editor lines). */
    run(code) {
      // The build123d module persists across evaluations — clear its
      // builder-context stacks in case a previous run aborted inside a
      // `with BuildPart():` block without unwinding. The op cache is also
      // cleared: rare hash collisions between shapes from DIFFERENT
      // evaluations have produced observably wrong booleans, and a stale
      // cache buys little in Python mode (scripts are re-run whole).
      for (const k in self.argCache) { delete self.argCache[k]; }
      // Own the shared hooks (a worker that also booted Pyodide this session
      // would otherwise leave ITS frame walker installed).
      self.getPythonUserLine = getBrythonUserLine;
      self._pythonRuntimeKind = 'brython';
      _runGuarded(B, 'import build123d\nbuild123d._reset_state()', '_b123d_reset');
      _runGuarded(B, code, PY_USER_MODULE);
    }
  };
}

/** Stringify a console argument without exploding on Brython's circular
 *  internal objects (the worker's console.log override JSON.stringifys). */
function _safeString(arg) {
  if (typeof arg === 'string') { return arg; }
  try { return JSON.stringify(arg); } catch (e) { return String(arg); }
}

/** Run a Python source under `moduleName` with the worker console guarded.
 *
 *  Brython prints internal diagnostics — including raw (circular) exception
 *  objects — through console.log/console.error while an exception unwinds,
 *  and the worker overrides console.error to *rethrow*. So for the duration
 *  of the run:
 *   - console.log passes through with stringify-safe args (print() output
 *     still reaches the main-thread console),
 *   - console.error is buffered; on success the buffer is replayed through
 *     the real console.error (CAD validation errors like "Union produced
 *     near-zero volume" surface normally), on failure it is discarded in
 *     favor of the single formatted Python traceback that is thrown. */
function _runGuarded(B, source, moduleName) {
  const prevLog = console.log;
  const prevError = console.error;
  const stderrBuffer = [];
  console.log = (...args) => {
    const parts = args.map(_safeString);
    // Python's print() flushes with a trailing newline; the console panel
    // adds its own line breaks, so strip it for parity with JS-mode logs.
    if (parts.length > 0) { parts[parts.length - 1] = parts[parts.length - 1].replace(/\n$/, ''); }
    prevLog(...parts);
  };
  console.error = (...args) => { stderrBuffer.push(args.map(_safeString).join(' ')); };

  let caught = null;
  try {
    // Each evaluation starts with an undefined scene: the first show() call
    // replaces the auto-added shapes (see Build123dLite show()).
    self._b123dSceneDefined = false;
    B.runPythonSource(source, moduleName);
  } catch (exc) {
    caught = exc;
  } finally {
    console.log = prevLog;
    console.error = prevError;
  }

  if (caught) {
    // A raw wasm exception (a NUMBER — an OCCT Standard_Failure pointer) that
    // escaped a direct oc.* call outside CacheOp cannot carry a Python
    // traceback; decode it into OCCT's own message rather than printing the
    // bare pointer value.
    if (typeof caught === 'number' && self.describeOCCTException) {
      throw new Error('INTERNAL OPENCASCADE ERROR: ' + self.describeOCCTException(caught));
    }
    throw new Error(_formatPythonError(B, caught, moduleName));
  }
  for (const line of stderrBuffer) { console.error(line); }
}

/** Extract a useful message from a Brython exception: the one-line summary
 *  ("NameError: name 'x' is not defined") first — so truncated error
 *  surfaces still show the interesting part — then the full traceback. */
function _formatPythonError(B, exc, moduleName) {
  let trace = '';
  try {
    if (B.error_trace) { trace = B.error_trace(exc) || ''; }
  } catch (e) { /* fall through to args */ }
  trace = String(trace).trim();
  if (!trace) {
    try {
      trace = String(exc && exc.args && exc.args.length ? exc.args[0] : exc);
    } catch (e) {
      trace = String(exc);
    }
  }
  const lines = trace.split('\n').filter((l) => l.trim() !== '');
  const summary = lines.length > 0 ? lines[lines.length - 1] : 'unknown error';
  const inLibrary = moduleName !== PY_USER_MODULE
    ? ' (while loading the ' + moduleName + ' module)' : '';
  return 'Python ' + summary + inLibrary + (lines.length > 1 ? '\n' + trace : '');
}
