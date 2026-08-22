// headless.js — cascade-core without a browser.
//
// Boots the SAME CAD engine the Web Worker runs (OpenCascade 8.0.1 wasm +
// the standard library + build123d over one of the Python runtimes) in any
// JS host that can instantiate WebAssembly: Node, Deno, Bun, and — the
// design target — a Cloudflare Worker (workerd), where the whole point is to
// turn build123d source into BREP/STEP/STL over HTTP inside a 128 MB
// isolate.
//
// What makes that possible (see the neighbouring modules):
//   * src/worker/Emit.js       — every outbound `postMessage` became `csEmit`,
//                                so logs/errors/GUI widgets can be COLLECTED
//                                instead of posted.
//   * src/worker/WasmAssets.js — wasm arrives as a URL, bytes, or an
//                                already-compiled `WebAssembly.Module`
//                                (workerd's only option).
//   * src/worker/GlobalSelf.js — `self` aliased to `globalThis`.
//   * CascadeWorker `installRouter: false` — no onmessage loop; `run()`
//                                awaits the async Python evaluation itself.
//
// Nothing here is browser-specific and nothing runs at import time.
//
// Usage:
//   import { createHeadlessCascade } from 'cascade-core/headless';
//   const engine = await createHeadlessCascade({ occtWasm, micropythonJs,
//                                                micropythonWasm, fonts });
//   const r = await engine.run(pythonSource);        // {ok, errors, logs, …}
//   const step = engine.exportSTEP();                // ISO-10303-21 text
//   const brep = engine.exportBREP();
//   const stl  = engine.exportSTL();
//
// See test/headless-node.mjs (Node) and examples/cloudflare-worker/ (workerd).

// MUST be first: aliases `self` before any worker module is evaluated.
import './worker/GlobalSelf.js';
import { CascadeStudioWorker } from './worker/CascadeWorker.js';
import { toArrayBuffer } from './worker/WasmAssets.js';

/** Message types that carry a GUI widget registration. The widget functions
 *  in StandardLibrary already seed `self.GUIState[name]` with the default
 *  before emitting, so a headless script that calls Slider()/Checkbox()/…
 *  simply gets the default value back — we only record the declaration so
 *  the host can see what the script exposes. */
const GUI_WIDGET_TYPES = {
  addSlider: 'slider', addButton: 'button', addCheckbox: 'checkbox',
  addTextbox: 'textbox', addDropdown: 'dropdown',
};

const DEFAULT_STEP_NAME = 'cascade-headless.step';
const DEFAULT_BREP_NAME = 'cascade-headless.brep';
const DEFAULT_STL_NAME = 'cascade-headless.stl';

/** Boot a headless CAD engine.
 *
 *  Assets (all optional in a host that can `fetch()` them next to the
 *  bundle; all REQUIRED in Node and workerd). Every one accepts a
 *  `WebAssembly.Module`, an `ArrayBuffer`/TypedArray, a URL string, or a
 *  thunk returning any of those:
 *    - `occtWasm`        — cascadestudio.wasm (the OCCT kernel, ~27 MB raw)
 *    - `micropythonJs`   — the ALREADY-IMPORTED micropython.mjs namespace
 *                          (workerd cannot `import()` a URL at runtime)
 *    - `micropythonWasm` — micropython.wasm
 *    - `fonts`           — `{ FreeSans: <bytes>, … }`, or use `loadAsset`
 *    - `loadAsset(path)` — generic fallback, e.g. `'fonts/FreeSans.ttf'`
 *    - `upstreamPy(rel)` — only for `pySrc: 'upstream'`; returns the text of
 *                          one file of the vendored upstream build123d tree
 *
 *  Options:
 *    - `runtime`  'micropython' (default) | 'brython' | 'pyodide'
 *    - `pySrc`    'lite' (default) | 'upstream' — see CLAUDE.md. Headless
 *                 defaults to LITE: it is embedded in the bundle (no 3.5 MB
 *                 of extra Python assets to ship into a Worker) and boots in
 *                 a fraction of the time.
 *    - `pyTopo`   passed through to the upstream-topology layer
 *    - `cache`    seed for GUIState['Cache?'] (default true)
 *    - `gui`      initial GUIState values (what a Slider() would return)
 */
export async function createHeadlessCascade(options = {}) {
  const opts = Object.assign({
    runtime: 'micropython',
    pySrc: 'lite',
    cache: true,
  }, options);

  const state = {
    logs: [],
    errors: [],
    progress: null,
    historySteps: [],
    guiWidgets: {},
    guiState: Object.assign({ 'Cache?': !!opts.cache }, opts.gui || {}),
    booted: false,
  };

  // ---------------------------------------------------------------- //
  // The emitter seam: collect instead of postMessage.                 //
  // ---------------------------------------------------------------- //
  globalThis._csEmit = (msg) => {
    if (!msg || !msg.type) { return; }
    switch (msg.type) {
      case 'log':
        state.logs.push(String(msg.payload));
        return;
      case 'error':
        state.errors.push(String(msg.payload));
        return;
      case 'Progress':
        state.progress = msg.payload;
        return;
      case 'modelHistory':
        state.historySteps = msg.payload || [];
        return;
      case 'resetWorking':
      case 'startupCallback':
      case 'saveFile':
      case 'createTransformHandle':
      case 'combineAndRenderShapes':
      case 'loadFiles':
        return;
      default: {
        const kind = GUI_WIDGET_TYPES[msg.type];
        if (kind) {
          const p = msg.payload || {};
          state.guiWidgets[p.name] = Object.assign({ kind }, p);
          // The default is already in self.GUIState (the widget function
          // seeds it before emitting) — mirror it so it survives the next
          // run's GUIState rebuild.
          if (p.default !== undefined && !(p.name in state.guiState)) {
            state.guiState[p.name] = p.default;
          }
        }
      }
    }
  };

  // Errors: the browser rethrows out of band so window.onerror sees them.
  // Headless RETURNS them from run() instead.
  globalThis._csDeferError = (thunk) => {
    try {
      thunk();
    } catch (e) {
      state.errors.push((e && e.message) ? String(e.message) : String(e));
    }
  };

  // ---------------------------------------------------------------- //
  // Python-runtime asset wiring (read by MicroPythonRuntime.js).      //
  // ---------------------------------------------------------------- //
  if (opts.micropythonJs || opts.micropythonWasm) {
    globalThis.self._csMicroPythonLocate = opts.micropythonJs
      ? { mod: opts.micropythonJs, wasm: opts.micropythonWasm, kind: 'headless' }
      : { mjsURL: String(opts.micropythonJsURL), wasmURL: opts.micropythonWasm,
          kind: 'headless-url' };
  }
  if (typeof opts.upstreamPy === 'function') {
    globalThis.self._csUpstreamFetchText = opts.upstreamPy;
  }

  // ---------------------------------------------------------------- //
  // Boot the engine.                                                  //
  // ---------------------------------------------------------------- //
  const tBoot = now();
  const worker = new CascadeStudioWorker({
    installRouter: false,
    assets: {
      occtWasm: opts.occtWasm,
      fonts: opts.fonts,
      loadAsset: opts.loadAsset,
    },
  });
  await worker.init();
  const bootMs = now() - tBoot;
  state.booted = true;

  const oc = () => globalThis.self.oc;

  /** Read a MEMFS file and delete it, returning its text (or null). */
  const takeFile = (name) => {
    let text = null;
    try { text = oc().FS.readFile('/' + name, { encoding: 'utf8' }); }
    catch (e) { text = null; }
    try { oc().FS.unlink('/' + name); } catch (e) { /* already gone */ }
    return text;
  };

  const requireShape = (what) => {
    const shape = globalThis.self.currentShape;
    if (!shape || (shape.IsNull && shape.IsNull())) {
      throw new Error(what + ': nothing to export — run() first, and make '
        + 'sure the script calls show() (or leaves a shape in a module '
        + 'variable) so the scene is not empty');
    }
    return shape;
  };

  const engine = {
    /** The underlying CascadeStudioWorker (escape hatch: `.worker.oc`, the
     *  standard library on `globalThis.self`, etc.). */
    worker,
    bootMs,

    /** Evaluate one script.
     *
     *  `opts.language`: 'python' (default), 'cascadestudio' (the JS standard
     *  library) — OpenSCAD must be transpiled first (OpenSCADTranspiler).
     *  `opts.mesh`: false (default) builds only the exact BREP compound —
     *  meshing is the memory-expensive stage and STEP/BREP do not need it.
     *  true also triangulates and returns the viewport mesh payload. */
    async run(code, runOpts = {}) {
      const language = runOpts.language || 'python';
      state.logs = [];
      state.errors = [];
      state.historySteps = [];
      const t0 = now();

      worker.evaluate({
        code,
        language,
        GUIState: Object.assign({}, state.guiState, runOpts.gui || {}),
        pyRuntime: opts.runtime,
        pySrc: opts.pySrc,
        pyTopo: opts.pyTopo,
        lowMemory: runOpts.lowMemory,
      });

      // Python evaluation is async (the interpreter boots on first use);
      // JS mode already finished inside evaluate().
      const pending = worker._pendingEvaluation;
      worker._pendingEvaluation = null;
      if (pending) {
        try { await pending; }
        catch (e) { state.errors.push((e && e.message) ? e.message : String(e)); }
      }
      const evalMs = now() - t0;

      const sceneShapeCount = (globalThis.self.sceneShapes || []).length;
      let mesh = null;
      let shapeCount = 0;
      const tMesh = now();
      if (runOpts.mesh) {
        const result = worker.combineAndRenderShapes({
          maxDeviation: runOpts.maxDeviation || 0.1,
        });
        mesh = result ? result[0] : null;
        shapeCount = sceneShapeCount;
      } else {
        shapeCount = worker.combineShapes();
      }

      return {
        ok: state.errors.length === 0,
        errors: state.errors.slice(),
        logs: state.logs.slice(),
        shapeCount,
        historySteps: state.historySteps.slice(),
        guiWidgets: Object.assign({}, state.guiWidgets),
        mesh,
        timings: { evalMs: round1(evalMs), combineMs: round1(now() - tMesh) },
      };
    },

    /** STEP (ISO-10303-21) text for the shape built by the last run(). */
    exportSTEP(o = {}) {
      const name = o.name || DEFAULT_STEP_NAME;
      const text = globalThis.self.ExportSTEP(requireShape('exportSTEP'), name, o.unit);
      try { oc().FS.unlink('/' + name); } catch (e) { /* already read back */ }
      if (text == null) { throw new Error('exportSTEP: the STEP writer failed'); }
      return text;
    },

    /** BREP text (OCCT's native boundary-representation format). */
    exportBREP(o = {}) {
      const name = o.name || DEFAULT_BREP_NAME;
      const text = globalThis.self.ExportBREP(requireShape('exportBREP'), name);
      try { oc().FS.unlink('/' + name); } catch (e) { /* already read back */ }
      if (text == null) { throw new Error('exportBREP: the BREP writer failed'); }
      return text;
    },

    /** STL text. COMPROMISE(stl-ascii): StlAPI_Writer's ASCIIMode is bound
     *  as a getter only in this build, so only ASCII STL can be produced —
     *  `{binary: true}` is rejected rather than silently ignored.
     *  NOTE this triangulates `currentShape` in place (that is what an STL
     *  is), so it costs mesh memory; call it last. */
    exportSTL(o = {}) {
      if (o.binary) {
        throw new Error('exportSTL: binary STL is not available — this OCCT '
          + 'build binds StlAPI_Writer::ASCIIMode as a getter only '
          + '(COMPROMISE(stl-ascii))');
      }
      const name = o.name || DEFAULT_STL_NAME;
      const text = globalThis.self.ExportSTL(requireShape('exportSTL'), name,
        o.tolerance || 1e-3, o.angularTolerance || 0.1, true);
      try { oc().FS.unlink('/' + name); } catch (e) { /* already read back */ }
      if (text == null) { throw new Error('exportSTL: the STL writer failed'); }
      return text;
    },

    /** Read anything the SCRIPT wrote — export_step()/export_brep()/
     *  Mesher().write() all land in the worker's Emscripten MEMFS. Names are
     *  flattened by build123d-lite (`/` becomes `_`). Returns null when the
     *  file does not exist. */
    readFile(path, o = {}) {
      const name = String(path).replace(/^\//, '');
      try {
        return oc().FS.readFile('/' + name,
          o.encoding === null ? undefined : { encoding: o.encoding || 'utf8' });
      } catch (e) { return null; }
    },

    /** Hand a file to the script (import_brep reads MEMFS directly). */
    writeFile(path, content) {
      const name = String(path).replace(/^\//, '');
      try { oc().FS.unlink('/' + name); } catch (e) { /* absent */ }
      oc().FS.createDataFile('/', name, content, true, true);
    },

    /** List the MEMFS root — a script's exported files show up here. */
    listFiles(dir = '/') {
      try {
        return oc().FS.readdir(dir).filter((f) => f !== '.' && f !== '..');
      } catch (e) { return []; }
    },

    /** STEP/IGES assets a script can pick up with `import_step()`, keyed by
     *  file name (matched on the base name). Same contract as
     *  CascadeAPI.loadExternalFiles in the browser. */
    loadExternalFiles(files) {
      const dict = {};
      for (const [name, content] of Object.entries(files || {})) {
        dict[name] = { content };
      }
      return worker.fileIO.loadPrexistingExternalFiles(dict);
    },

    /** Wasm/heap footprint, split by owner — the number that has to stay
     *  under a Cloudflare Worker's 128 MB. */
    memoryStats() {
      const m = worker.memoryStats();
      m.totalWasm = (m.occtWasm || 0) + (m.pythonWasm || 0);
      return m;
    },

    /** Logs/errors accumulated since the last run(). */
    get logs() { return state.logs.slice(); },
    get errors() { return state.errors.slice(); },
    get guiWidgets() { return Object.assign({}, state.guiWidgets); },

    /** Drop the retained compound (a long-lived isolate serving many
     *  requests should call this between them). */
    reset() {
      const shape = globalThis.self.currentShape;
      if (shape) {
        try { if (shape.$$ && shape.$$.ptr) { shape.delete(); } } catch (e) { /* best effort */ }
        globalThis.self.currentShape = null;
      }
      globalThis.self.sceneShapes = [];
      for (const k in globalThis.self.argCache) { delete globalThis.self.argCache[k]; }
      state.logs = [];
      state.errors = [];
    },
  };

  return engine;
}

function now() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
}

function round1(v) { return Math.round(v * 10) / 10; }

export { toArrayBuffer };
