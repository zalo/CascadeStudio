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
let _engine = null;

export async function createHeadlessCascade(options = {}) {
  // ONE engine per JS realm. The CAD engine keeps all of its state on the
  // worker global (`self.oc`, `self.sceneShapes`, the op cache, the Python
  // runtime singleton) exactly as it does in a Web Worker, so a second
  // instance would silently share and corrupt the first's scene. On
  // Cloudflare that is the natural shape anyway: one isolate, one engine,
  // reused across requests.
  if (_engine) {
    throw new Error('createHeadlessCascade: an engine already exists in this '
      + 'realm — cascade-core keeps its state on the worker global, so reuse '
      + 'the existing instance (and call reset() between jobs) or run a '
      + 'second engine in a separate isolate/worker_thread');
  }

  const opts = Object.assign({
    runtime: 'micropython',
    pySrc: 'lite',
    cache: true,
  }, options);

  const state = {
    logs: [],
    errors: [],
    progress: null,
    progressOps: [],
    historySteps: [],
    guiWidgets: {},
    guiState: Object.assign({ 'Cache?': !!opts.cache }, opts.gui || {}),
    booted: false,
    externalFiles: null,
    kernelResets: 0,
  };

  /** Cap on the retained per-op Progress timeline. heat_exchanger emits over
   *  a thousand ops; the timeline is a diagnostic, not a transcript. */
  const PROGRESS_LIMIT = 4000;

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
        // The worker brackets every op with a start (opType set) and an end
        // (opType null); keep the starts as the op timeline.
        if (msg.payload && msg.payload.opType
            && state.progressOps.length < PROGRESS_LIMIT) {
          state.progressOps.push({ n: msg.payload.opNumber, op: msg.payload.opType });
        }
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
    // Snapshot OCCT's pristine linear memory so a heap that a kernel
    // algorithm corrupted can be rewound between jobs and around a failed
    // export — see COMPROMISE(kernel-heap-reset) in CascadeWorker.js.
    // `kernelImage: false` opts out (saves a few MB, gives up the repair).
    kernelImage: opts.kernelImage !== false,
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

  /** Rewind OCCT to its boot image and drop every wrapper that pointed into
   *  the old heap. See COMPROMISE(kernel-heap-reset). */
  const resetKernel = () => {
    if (!worker.hasKernelImage()) { return false; }
    globalThis.self.currentShape = null;
    globalThis.self.sceneShapes = [];
    for (const k in globalThis.self.argCache) { delete globalThis.self.argCache[k]; }
    globalThis.self.externalShapes = {};
    const ok = worker.restoreKernelImage();
    if (ok) { state.kernelResets++; }
    // Assets the host handed over live in OCCT memory too — re-import them
    // into the fresh heap so `import_step()` keeps working.
    if (ok && state.externalFiles) {
      try { worker.fileIO.loadPrexistingExternalFiles(state.externalFiles); }
      catch (e) { /* the host can re-supply them */ }
    }
    return ok;
  };

  /** Run `write(shape)`; if the kernel's writer machinery has been poisoned,
   *  carry the shape out as BREP, rewind the kernel and write from the
   *  re-imported copy. Returns {text, healed}. */
  const exportOrHeal = (what, shape, write) => {
    try { return { text: write(shape), healed: false }; }
    catch (firstError) {
      if (!worker.hasKernelImage()) { throw firstError; }
      let brep = null;
      try { brep = globalThis.self.ExportBREP(shape, '__heal.brep'); }
      catch (e) { brep = null; }
      try { oc().FS.unlink('/__heal.brep'); } catch (e) { /* absent */ }
      if (!brep) {
        throw new Error(what + ': the kernel heap was corrupted during this '
          + 'evaluation and BRepTools::Write is down too, so the shape cannot '
          + 'be carried out of the damaged heap. '
          + 'COMPROMISE(kernel-heap-reset). ' + firstError.message);
      }
      resetKernel();
      const recovered = globalThis.self.ImportBREP('__heal.brep', brep);
      try { oc().FS.unlink('/__heal.brep'); } catch (e) { /* absent */ }
      if (!recovered || recovered.IsNull()) {
        throw new Error(what + ': recovering the shape through BREP after a '
          + 'kernel-heap reset produced nothing. ' + firstError.message);
      }
      globalThis.self.currentShape = recovered;
      return { text: write(recovered), healed: true };
    }
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
      state.progressOps = [];
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
        // Per-op timeline collected from the worker's Progress messages
        // ({n, op}). It is a RECORD, not live progress: the evaluation is
        // one synchronous wasm call, so all of these are emitted before the
        // host gets control back.
        progressOps: state.progressOps.slice(),
        guiWidgets: Object.assign({}, state.guiWidgets),
        mesh,
        timings: { evalMs: round1(evalMs), combineMs: round1(now() - tMesh) },
      };
    },

    /** STEP (ISO-10303-21) text for the shape built by the last run().
     *
     *  `parametricCurves: false` sets OCCT's `write.surfacecurve.mode` to 0,
     *  which omits the p-curves (each edge's 2-D parametrisation on its
     *  faces) and leaves only the 3-D geometry. Measured on the validation
     *  corpus that is ~62% off the file with no loss that a reader can see:
     *  Buffer_Stand 144 -> 53 KB, ttt-ppp0101 121 -> 45 KB,
     *  intersecting_pipes 194 -> 75 KB, all round-tripping through
     *  STEPControl_Reader to 1e-5 relative volume or better. It costs
     *  nothing in memory (STEP export costs ~0 MB either way), so this is a
     *  payload-size knob, not a headroom one — hence opt-in. */
    exportSTEP(o = {}) {
      const name = o.name || DEFAULT_STEP_NAME;
      const lean = o.parametricCurves === false;
      const setCurveMode = (v) => {
        try { oc().Interface_Static.SetIVal('write.surfacecurve.mode', v); }
        catch (e) { /* the static is absent in some builds */ }
      };
      if (lean) { setCurveMode(0); }
      const { text } = exportOrHeal('exportSTEP', requireShape('exportSTEP'),
        (shape) => {
          // A heal rewinds OCCT, which resets Interface_Static to its
          // defaults — re-apply inside the writer callback, not around it.
          if (lean) { setCurveMode(0); }
          try { return globalThis.self.ExportSTEP(shape, name, o.unit); }
          finally { if (lean) { setCurveMode(1); } }
        });
      try { oc().FS.unlink('/' + name); } catch (e) { /* already read back */ }
      if (text == null) { throw new Error('exportSTEP: the STEP writer failed'); }
      return text;
    },

    /** BREP text (OCCT's native boundary-representation format). */
    exportBREP(o = {}) {
      const name = o.name || DEFAULT_BREP_NAME;
      // No heal path: BREP *is* the carrier, so if BRepTools::Write is the
      // casualty there is nothing to carry the shape out with.
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
      const { text } = exportOrHeal('exportSTL', requireShape('exportSTL'),
        (shape) => globalThis.self.ExportSTL(shape, name,
          o.tolerance || 1e-3, o.angularTolerance || 0.1, true));
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
      // Retained so a kernel reset can re-import them (their OCCT shapes
      // live in the heap that the reset wipes).
      state.externalFiles = Object.assign({}, state.externalFiles || {}, dict);
      return worker.fileIO.loadPrexistingExternalFiles(dict);
    },

    /** Is OCCT's file-writer machinery still usable? (See
     *  COMPROMISE(kernel-heap-reset) — a few kernel algorithms corrupt the
     *  heap, and the writers are the usual casualty.) Costs a few ms. */
    kernelHealthy() { return worker.kernelHealthy(); },

    /** Rewind OCCT to its boot image, dropping every shape. Returns false
     *  when the engine was created with `kernelImage: false`. */
    resetKernel() { return resetKernel(); },

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
      // Rewinding the kernel image is both cheaper and more thorough than
      // deleting the compound: it hands the next job a pristine allocator
      // (so a heavy run no longer ratchets the heap) AND undoes any heap
      // corruption the last job's geometry left behind, which is what made a
      // Cloudflare isolate that had once run maker_coin fail every later
      // STEP export. See COMPROMISE(kernel-heap-reset).
      if (worker.hasKernelImage()) {
        resetKernel();
      } else {
        const shape = globalThis.self.currentShape;
        if (shape) {
          try { if (shape.$$ && shape.$$.ptr) { shape.delete(); } } catch (e) { /* best effort */ }
          globalThis.self.currentShape = null;
        }
        globalThis.self.sceneShapes = [];
        for (const k in globalThis.self.argCache) { delete globalThis.self.argCache[k]; }
      }
      state.logs = [];
      state.errors = [];
    },
  };

  _engine = engine;
  return engine;
}

function now() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
}

function round1(v) { return Math.round(v * 10) / 10; }

export { toArrayBuffer };
