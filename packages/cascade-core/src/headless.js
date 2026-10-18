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
import { IncrementalMesher } from './worker/IncrementalMesher.js';
import { renderMeshImage, viewBasis, VIEWS } from './headless/MeshRaster.js';
import { encodePNG } from './headless/PngEncode.js';
import { encodeGLB } from './headless/GlbEncode.js';
import * as SA from './headless/ShapeAnalysis.js';
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
const SNAPSHOT_NAME = '__cs-cache-snapshot.bin';
/** Bumped whenever the snapshot layout or the key derivation changes. */
export const CACHE_SNAPSHOT_FORMAT = 2;

/** Boot a headless CAD engine.
 *
 *  Assets (all optional in a host that can `fetch()` them next to the
 *  bundle; all REQUIRED in Node and workerd). Every one accepts a
 *  `WebAssembly.Module`, an `ArrayBuffer`/TypedArray, a URL string, or a
 *  thunk returning any of those:
 *    - `occtWasm`        — cascadestudio.wasm (the OCCT kernel, ~20 MB raw)
 *    - `occtJs`          — OPTIONAL: the Emscripten glue to pair with
 *                          occtWasm, as an imported module namespace (or its
 *                          default export). Omit it for the default build,
 *                          whose glue is bundled. Pass it to run the
 *                          JS-emulated-exceptions DEBUG artifact:
 *                            occtJs:   await import('…/dist/cascadestudio-jseh.js'),
 *                            occtWasm: <bytes of …/dist/cascadestudio-jseh.wasm>
 *                          (a glue only works with its own wasm).
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
 *    - `pyodide`  for runtime 'pyodide': {boot({stdout, stderr}) -> pyodide,
 *                 installWheels(pyodide, names)} — the host brings Pyodide up
 *                 from its own assets (examples/cloudflare-worker-real)
 *    - `pySrc`    'lite' (default) | 'upstream' — see CLAUDE.md. Headless
 *                 defaults to LITE: it is embedded in the bundle (no 3.5 MB
 *                 of extra Python assets to ship into a Worker) and boots in
 *                 a fraction of the time.
 *    - `pyTopo`   passed through to the upstream-topology layer
 *    - `cache`    seed for GUIState['Cache?'] (default true)
 *    - `stableCache` keep the op cache ACROSS runs with content-derived keys
 *                 (StandardUtils _stableHash) instead of emptying it before
 *                 every Python run. For long-lived hosts that re-run edited
 *                 scripts (a Durable Object editing session); such a host
 *                 must NOT reset() between jobs, and can persist the cached
 *                 working set with snapshotCache()/restoreCache().
 *    - `gui`      initial GUIState values (what a Slider() would return)
 *    - `meshCacheBytes` cap on meshScene()'s geometry-keyed face-mesh cache
 *                 (default 12 MB of typed arrays)
 *    - `meshPerFace` (default true) triangulate one face per BRepMesh call
 *                 (run({mesh: true})): the mesher's transient scales with the
 *                 faces in one call — 77-94 MB on 500-1200-face solids — and
 *                 a Worker has 128 MB in all. See ShapeToMesh.js.
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
    stableCache: false,
  }, options);
  globalThis.self._csStableCache = !!opts.stableCache;
  globalThis.self._csMeshPerFace = opts.meshPerFace !== false;

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
    // the last run's scene, kept for meshScene() (run({keepScene: true}))
    scene: null,
  };
  /** Geometry-keyed face meshes, kept across runs AND kernel resets. */
  const mesher = new IncrementalMesher({ maxBytes: opts.meshCacheBytes });

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
  // runtime: 'pyodide' — the host boots Pyodide (and installs wheels) from
  // its own assets: {boot({stdout, stderr}) -> pyodide, installWheels(py,
  // names)}. pySrc: 'real' additionally needs upstreamPy(rel) for the OCP
  // shim + real-deps payload.
  if (opts.pyodide) {
    globalThis.self._csPyodideHost = opts.pyodide;
  }

  // ---------------------------------------------------------------- //
  // Boot the engine.                                                  //
  // ---------------------------------------------------------------- //
  const tBoot = now();
  const worker = new CascadeStudioWorker({
    installRouter: false,
    // Snapshot OCCT's pristine linear memory so every job starts from it
    // and a damaged kernel can be rewound around a failed export — see
    // COMPROMISE(kernel-heap-reset) in CascadeWorker.js. `kernelImage:
    // false` opts out (saves a few MB, gives up the clean allocator and the
    // repair).
    kernelImage: opts.kernelImage !== false,
    assets: {
      occtWasm: opts.occtWasm,
      occtJs: opts.occtJs,
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
    // the last run's history steps and scene hold shapes in the heap being
    // discarded (the mesh cache does not: it is geometry, in JS)
    globalThis.self.modelHistory = [];
    state.scene = null;
    for (const k in globalThis.self.argCache) { delete globalThis.self.argCache[k]; }
    worker.standardLibrary.utils.pruneStableIndex(true);
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

  /** Run `write(shape)`; if the kernel's writer machinery is damaged (the
   *  historical cause: the 64 KB shadow stack overflowing into OCCT's
   *  statics — see COMPROMISE(kernel-heap-reset)),
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
        throw new Error(what + ': the kernel\'s writer machinery was damaged '
          + 'during this evaluation and BRepTools::Write is down too, so the '
          + 'shape cannot be carried out. (On OCCT builds with the 64 KB '
          + 'default stack this is the shadow stack overflowing into OCCT\'s '
          + 'statics; the fork links -sSTACK_SIZE=512KB.) '
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

  /** The kept scene (run({keepScene: true})), else the combined shape. */
  const sceneShapes = () => (state.scene && state.scene.length ? state.scene
    : (globalThis.self.currentShape ? [globalThis.self.currentShape] : []));

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
     *  true also triangulates and returns the viewport mesh payload
     *  (`mesh` = [faces, edges], `shapeLines` = each scene shape's producing
     *  source line), at `opts.maxDeviation` (default 0.1).
     *  `opts.keepScene` keeps the scene shapes for meshScene() (the
     *  incremental, streamable mesher) instead of meshing here.
     *  `opts.gui` merges into the engine's GUI state; `opts.guiState`
     *  REPLACES it for this run (a host serving several clients from one
     *  engine must not let one client's widget values reach another). */
    async run(code, runOpts = {}) {
      const language = runOpts.language || 'python';
      state.logs = [];
      state.errors = [];
      state.historySteps = [];
      state.progressOps = [];
      state.guiWidgets = {};
      const t0 = now();

      worker.evaluate({
        code,
        language,
        GUIState: runOpts.guiState
          ? Object.assign({ 'Cache?': !!opts.cache }, runOpts.guiState)
          : Object.assign({}, state.guiState, runOpts.gui || {}),
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
      state.scene = runOpts.keepScene ? (globalThis.self.sceneShapes || []).slice() : null;
      // show(shape, "name") names, by scene position (null: unnamed)
      const names = globalThis.self.sceneShapeNames;
      state.sceneNames = state.scene
        ? state.scene.map((sh) => (names && names.get(sh)) || null) : null;
      let mesh = null;
      let shapeLines = null;
      let shapeCount = 0;
      const tMesh = now();
      if (runOpts.mesh && sceneShapeCount === 0) {
        // nothing to mesh — and the mesher would report the empty scene as
        // a console.error, which the worker turns into a fake kernel error
        shapeCount = worker.combineShapes();
      } else if (runOpts.mesh) {
        const result = worker.combineAndRenderShapes({
          maxDeviation: runOpts.maxDeviation || 0.1,
        });
        mesh = result ? result[0] : null;
        shapeLines = result ? (result[2] || []) : null;
        shapeCount = sceneShapeCount;
      } else {
        shapeCount = worker.combineShapes();
      }

      const utils = worker.standardLibrary.utils;
      return {
        ok: state.errors.length === 0,
        errors: state.errors.slice(),
        logs: state.logs.slice(),
        shapeCount,
        // op-cache outcome of THIS run (volatile ops: stable mode only —
        // computed and never cached; see StandardUtils _stableHash)
        cache: {
          hits: utils.cacheHits || 0,
          misses: utils.cacheMisses || 0,
          volatile: utils.volatileOps || 0,
          volatileReasons: Object.entries(utils.volatileReasons || {})
            .sort((a, b) => b[1] - a[1]).slice(0, 8),
          entries: Object.keys(globalThis.self.argCache || {}).length,
        },
        historySteps: state.historySteps.slice(),
        // Per-op timeline collected from the worker's Progress messages
        // ({n, op}). It is a RECORD, not live progress: the evaluation is
        // one synchronous wasm call, so all of these are emitted before the
        // host gets control back.
        progressOps: state.progressOps.slice(),
        guiWidgets: Object.assign({}, state.guiWidgets),
        mesh,
        shapeLines,
        timings: { evalMs: round1(evalMs), combineMs: round1(now() - tMesh) },
      };
    },

    /** Triangulate one step of the last run's modeling history (the
     *  editor's timeline) -> [faces, edges], or null when the step has no
     *  shapes. Valid until the next run() or kernel reset. */
    meshHistoryStep(stepIndex, maxDeviation = 0.1) {
      return worker.meshHistoryStep({ stepIndex, maxDeviation }) || null;
    },

    /** Mesh the scene the last run({keepScene: true}) built, incrementally:
     *  a generator of batches {faces, edges} (IncrementalMesher.js) — faces
     *  whose geometry was meshed before come back from the mesh cache, the
     *  rest are triangulated a batch at a time, so a host can stream them.
     *  Returns {shapeLines, batches} or null when there is no kept scene. */
    meshScene(o = {}) {
      if (!state.scene) { return null; }
      const shapes = state.scene;
      return {
        shapeLines: shapes.map((s) => (s && s.producingLine) || -1),
        batches: mesher.mesh(shapes, o.maxDeviation || 0.1, { batchNodes: o.batchNodes }),
      };
    },

    /** The same, for one step of the last run's modeling history. */
    meshHistoryStepIncremental(stepIndex, o = {}) {
      const step = (globalThis.self.modelHistory || [])[stepIndex];
      if (!step || !step.shapes || step.shapes.length === 0) { return null; }
      return { shapeLines: [], batches: mesher.mesh(step.shapes, o.maxDeviation || 0.1,
        { batchNodes: o.batchNodes }) };
    },

    /** The incremental mesher's cache: {clear(), stats(), liveIds()}. */
    meshCache: mesher,

    /** The whole kept scene, meshed (meshScene() drained):
     *  {faces, edges, shapeLines, stats} or null. */
    meshSceneAll(o = {}) {
      const m = engine.meshScene(o);
      if (!m) { return null; }
      const faces = []; const edges = [];
      let stats = null;
      for (;;) {
        const { value, done } = m.batches.next();
        if (done) { stats = value; break; }
        faces.push(...value.faces);
        edges.push(...value.edges);
      }
      faces.sort((a, b) => a.slot - b.slot);
      edges.sort((a, b) => a.slot - b.slot);
      return { faces, edges, shapeLines: m.shapeLines, stats };
    },

    /** A PNG of the kept scene (software-rendered: MeshRaster.js).
     *  Options: view ('iso', 'front', 'top', ...) or azimuth/elevation,
     *  width/height, shapes/highlight (scene-shape indices), edges,
     *  labels, maxDeviation. Resolves {png, width, height, view, scale}. */
    async renderPNG(o = {}) {
      const mesh = o.mesh || engine.meshSceneAll({ maxDeviation: o.maxDeviation });
      if (!mesh || !mesh.faces.length) {
        throw new Error('renderPNG: the scene is empty — nothing to draw');
      }
      const img = renderMeshImage(mesh, o);
      return { png: await encodePNG(img.width, img.height, img.rgb), width: img.width,
        height: img.height, view: img.view, scale: img.scale };
    },

    /** Binary glTF of the kept scene (one node per scene shape, metres,
     *  Y up). */
    exportGLB(o = {}) {
      const mesh = o.mesh || engine.meshSceneAll({ maxDeviation: o.maxDeviation });
      if (!mesh || !mesh.faces.length) { throw new Error('exportGLB: the scene is empty'); }
      return encodeGLB(mesh, o);
    },

    /** A hidden-line drawing of the current shape as SVG (HLRBRep, exact).
     *  Options: view or azimuth/elevation, width/height (px), hidden (draw
     *  hidden lines dashed, default true), deflection. Lines are in the
     *  view plane, X to the right, Y up, fitted to the canvas. */
    drawingSVG(o = {}) {
      const shape = requireShape('drawingSVG');
      const o2 = oc();
      const preset = VIEWS[o.view] || VIEWS.iso;
      const az = Number.isFinite(o.azimuth) ? o.azimuth : preset[0];
      const el = Number.isFinite(o.elevation) ? o.elevation : preset[1];
      const { toEye, right } = viewBasis(az, el);
      const dev = o.deflection || 0.05;
      const keep = [];
      const hlr = new o2.HLRBRep_Algo_1();
      hlr.Add_2(shape, 0);
      const ax2 = new o2.gp_Ax2_2(new o2.gp_Pnt_3(0, 0, 0), new o2.gp_Dir_5(toEye[0], toEye[1], toEye[2]),
        new o2.gp_Dir_5(right[0], right[1], right[2]));
      hlr.Projector_1(new o2.HLRAlgo_Projector_2(ax2));
      hlr.Update();
      hlr.Hide_1();
      const toShape = new o2.HLRBRep_HLRToShape(new o2.Handle_HLRBRep_Algo_2(hlr));
      const collect = (getters) => {
        const lines = [];
        for (const get of getters) {
          let c = null;
          try { c = toShape[get](); } catch (e) { c = null; }
          if (!c || c.IsNull()) { continue; }
          keep.push(c);
          try { o2.BRepLib.BuildCurves3d_2(c); } catch (e) { /* already 3-D */ }
          const ex = new o2.TopExp_Explorer_2(c, o2.TopAbs_ShapeEnum.TopAbs_EDGE, o2.TopAbs_ShapeEnum.TopAbs_SHAPE);
          for (; ex.More(); ex.Next()) {
            const edge = o2.TopoDS_Cast.Edge_1(ex.Current());
            let curve = null; let defl = null;
            try {
              curve = new o2.BRepAdaptor_Curve_2(edge);
              defl = new o2.GCPnts_TangentialDeflection_2(curve, dev, 0.1, 2, 1.0e-9, 1.0e-7);
              const pts = [];
              for (let j = 1; j <= defl.NbPoints(); j++) {
                const p = defl.Value(j);
                pts.push([p.X(), p.Y()]);
                p.delete();
              }
              if (pts.length > 1) { lines.push(pts); }
            } catch (e) { /* an edge HLR left without geometry */ }
            try { if (defl) { defl.delete(); } if (curve) { curve.delete(); } } catch (e) { /* best effort */ }
          }
          ex.delete();
        }
        return lines;
      };
      const visible = collect(['VCompound_1', 'Rg1LineVCompound_1', 'OutLineVCompound_1']);
      const hidden = o.hidden === false ? [] : collect(['HCompound_1', 'OutLineHCompound_1']);
      for (const k of keep) { try { k.delete(); } catch (e) { /* best effort */ } }
      try { toShape.delete(); hlr.delete(); } catch (e) { /* owned by the handle */ }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const l of visible.concat(hidden)) {
        for (const [x, y] of l) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const W = o.width || 800; const H = o.height || 600; const m = 30;
      const sc = Math.min((W - 2 * m) / Math.max(x1 - x0, 1e-9), (H - 2 * m) / Math.max(y1 - y0, 1e-9));
      const tx = (x) => (m + (x - x0) * sc + (W - 2 * m - (x1 - x0) * sc) / 2).toFixed(2);
      const ty = (y) => (H - m - (y - y0) * sc - (H - 2 * m - (y1 - y0) * sc) / 2).toFixed(2);
      const path = (l) => 'M' + l.map(([x, y]) => tx(x) + ' ' + ty(y)).join('L');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H
        + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="100%" height="100%" fill="white"/>'
        + (hidden.length ? '<path fill="none" stroke="#9aa0a6" stroke-width="0.8" stroke-dasharray="4 3" d="'
          + hidden.map(path).join('') + '"/>' : '')
        + '<path fill="none" stroke="#1d2125" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="'
        + visible.map(path).join('') + '"/></svg>';
      return { svg, visible: visible.length, hidden: hidden.length, scale: sc,
        size: [x1 - x0, y1 - y0], view: { azimuth: az, elevation: el } };
    },

    /** Per scene shape (run({keepScene: true}); otherwise the combined
     *  shape): type, topology counts, volume, area, bounding box, centre of
     *  mass, and validity (BRepCheck_Analyzer). `{quick: true}`: type,
     *  solids/faces, volume and a FAST bounding box (BRepBndLib::Add, gap
     *  removed: tight for analytic surfaces, may overshoot a B-spline's
     *  control hull) — the exact one (AddOptimal) took 3.5 s of 3.5 s on
     *  heat_exchanger. `{exactBox: false}` gives the full inspection with
     *  the fast box. */
    inspectShapes(o = {}) {
      const exactBox = o.quick ? false : o.exactBox !== false;
      const o2 = oc();
      const S = globalThis.self;
      const shapes = state.scene && state.scene.length ? state.scene
        : (S.currentShape ? [S.currentShape] : []);
      const TYPES = ['Compound', 'CompSolid', 'Solid', 'Shell', 'Face', 'Wire', 'Edge', 'Vertex', 'Shape'];
      // unique sub-shapes: the explorer visits a shared edge once per face
      const count = (shape, kind) => {
        const buckets = new Map();
        const held = [];
        let n = 0;
        const ex = new o2.TopExp_Explorer_2(shape, o2.TopAbs_ShapeEnum[kind], o2.TopAbs_ShapeEnum.TopAbs_SHAPE);
        for (; ex.More(); ex.Next()) {
          const cur = ex.Current();
          const h = o2.OCJS.HashCode(cur, 100000000);
          const bucket = buckets.get(h);
          if (bucket && bucket.some((b) => b.IsSame(cur))) { cur.delete(); continue; }
          if (bucket) { bucket.push(cur); } else { buckets.set(h, [cur]); }
          held.push(cur);
          n++;
        }
        ex.delete();
        for (const c of held) { c.delete(); }
        return n;
      };
      const r6 = (v) => Math.round(v * 1e6) / 1e6;
      const names = (state.scene && state.sceneNames) || [];
      return shapes.map((shape, index) => {
        const out = { index, name: names[index] || null, line: (shape && shape.producingLine) || null };
        try {
          if (!shape || shape.IsNull()) { return Object.assign(out, { error: 'null shape' }); }
          out.type = TYPES[shape.ShapeType().value] || 'Shape';
          out.solids = count(shape, 'TopAbs_SOLID');
          const fastBox = () => {
            const box = new o2.Bnd_Box_1();
            o2.BRepBndLib.Add(shape, box, false);
            if (!box.IsVoid()) {
              box.SetGap(0);
              out.bbox = [box.GetXMin(), box.GetYMin(), box.GetZMin(), box.GetXMax(), box.GetYMax(), box.GetZMax()].map(r6);
            }
            box.delete();
          };
          if (o.quick) {
            out.faces = count(shape, 'TopAbs_FACE');
            out.volume = out.solids > 0 ? r6(S.SolidsVolume(shape)) : 0;
            fastBox();
            return out;
          }
          out.shells = count(shape, 'TopAbs_SHELL');
          out.faces = count(shape, 'TopAbs_FACE');
          out.edges = count(shape, 'TopAbs_EDGE');
          out.vertices = count(shape, 'TopAbs_VERTEX');
          const props = new o2.GProp_GProps_1();
          if (out.solids > 0) {
            out.volume = r6(S.SolidsVolume(shape));
            o2.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
          } else {
            out.volume = 0;
            if (out.faces > 0) { o2.BRepGProp.SurfaceProperties_1(shape, props, false, false); }
            else { o2.BRepGProp.LinearProperties(shape, props, false, false); }
          }
          out.area = r6(S.SurfaceArea(shape));
          const c = props.CentreOfMass();
          out.centerOfMass = [r6(c.X()), r6(c.Y()), r6(c.Z())];
          c.delete(); props.delete();
          if (exactBox) {
            const bb = S.BoundingBox(shape, 0.1);
            if (bb) { out.bbox = bb.map(r6); }
          } else { fastBox(); }
          out.bboxMethod = exactBox ? 'exact' : 'fast';
          const check = new o2.BRepCheck_Analyzer(shape, true, false, false);
          out.valid = !!check.IsValid_2();
          check.delete();
        } catch (e) { out.error = (e && e.message) || String(e); }
        return out;
      });
    },

    /** The kept scene's show() names, by index (null: unnamed). */
    sceneNames() { return state.scene ? (state.sceneNames || state.scene.map(() => null)).slice() : []; },

    /** The validity gate for each kept scene shape (build123d-mcp's
     *  validate / locate_gate_defects, on the exact B-rep): solids,
     *  volume, BRepCheck, the edge->face map (open and non-manifold edges,
     *  with their midpoints), and overlapping solids inside the shape.
     *  `o.indices` limits it to some shapes; `o.interference` (default
     *  true) also checks solids of DIFFERENT shapes against each other. */
    gate(o = {}) {
      const o2 = oc();
      const S = globalThis.self;
      const scene = sceneShapes();
      const names = engine.sceneNames();
      const idx = Array.isArray(o.indices) ? o.indices : scene.map((x, i) => i);
      const budgetMs = o.budgetMs || 8000;
      const shapes = idx.map((index) => {
        const shape = scene[index];
        const out = { index, name: names[index] || null };
        try {
          const solids = SA.subShapes(o2, shape, 'TopAbs_SOLID');
          out.solids = solids.length;
          out.volume = solids.length ? Math.round(S.SolidsVolume(shape) * 1e4) / 1e4 : 0;
          const check = new o2.BRepCheck_Analyzer(shape, true, false, false);
          out.brepValid = !!check.IsValid_2();
          check.delete();
          Object.assign(out, SA.edgeDefects(o2, shape, o.maxDefects || 20));
          const ov = SA.solidOverlaps(o2, S, solids, { budgetMs });
          out.overlaps = ov.overlaps;
          out.overlapChecked = ov.checked;
          if (!ov.checked) { out.overlapNote = ov.why; }
          SA.free(solids);
        } catch (e) { out.error = (e && e.message) || String(e); }
        return out;
      });
      let interference = null;
      if (o.interference !== false && idx.length > 1) {
        // one representative per shape: the solids of different shapes
        const owners = []; const solids = [];
        for (const index of idx) {
          for (const sol of SA.subShapes(o2, scene[index], 'TopAbs_SOLID')) {
            owners.push(index); solids.push(sol);
          }
        }
        const labels = owners.map((index, k) => {
          const nm = names[index] !== null && names[index] !== undefined ? names[index] : String(index);
          const nth = owners.slice(0, k).filter((x) => x === index).length;
          return owners.filter((x) => x === index).length > 1 ? nm + ' solid ' + nth : nm;
        });
        const ov = SA.solidOverlaps(o2, S, solids, { budgetMs, labels, maxSolids: o.maxSolids || 24 });
        interference = { checked: ov.checked, pairs: ov.overlaps.filter((p) => {
          const a = labels.indexOf(p.a); const b = labels.indexOf(p.b);
          return owners[a] !== owners[b];
        }) };
        if (!ov.checked) { interference.note = ov.why; }
        SA.free(solids);
      }
      return { shapes, interference };
    },

    /** One shape for analysis: a scene shape, or a new compound of several
     *  (release it with the returned free()). */
    pickShape(indices) {
      const scene = sceneShapes();
      const list = (Array.isArray(indices) ? indices : [indices]).map((i) => scene[i]);
      if (list.some((x) => !x)) { throw new Error('no such scene shape: ' + JSON.stringify(indices)); }
      if (list.length === 1) { return { shape: list[0], free() {} }; }
      const o2 = oc();
      const comp = new o2.TopoDS_Compound();
      const b = new o2.BRep_Builder();
      b.MakeCompound(comp);
      for (const x of list) { b.Add(comp, x); }
      b.delete();
      return { shape: comp, free() { try { comp.delete(); } catch (e) { /* best effort */ } } };
    },

    /** The face inventory and the inertia tensor of a scene shape (or of
     *  several, as one): build123d-mcp's measure() extras. */
    shapeDetails(indices) {
      const o2 = oc();
      const S = globalThis.self;
      const p = engine.pickShape(indices);
      try {
        const solids = SA.subShapes(o2, p.shape, 'TopAbs_SOLID');
        const out = { faceInventory: SA.faceInventory(o2, S, p.shape) };
        if (solids.length) { out.inertia = SA.inertia(o2, p.shape); }
        SA.free(solids);
        return out;
      } finally { p.free(); }
    },

    /** compare kind='fit': clearance and containment of two scene shapes
     *  (or groups of them). */
    clearance(a, b) {
      const pa = engine.pickShape(a); const pb = engine.pickShape(b);
      try { return SA.clearance(oc(), globalThis.self, pa.shape, pb.shape); }
      finally { pa.free(); pb.free(); }
    },

    /** The exact volumes of a minus b and b minus a: what an edit added
     *  and removed (compare kind='shape'). */
    changedVolumes(a, b) {
      const pa = engine.pickShape(a); const pb = engine.pickShape(b);
      const S = globalThis.self;
      try {
        return { removed: SA.booleanVolume(oc(), S, 'cut', pa.shape, pb.shape),
          added: SA.booleanVolume(oc(), S, 'cut', pb.shape, pa.shape) };
      } finally { pa.free(); pb.free(); }
    },

    /** How many times the kernel has been rewound to its boot image (by
     *  reset()/resetKernel(), or by an export healing a damaged heap). */
    get kernelResets() { return state.kernelResets; },

    /** Steps in the last run's modeling history (0 after a kernel reset). */
    get historyLength() { return (globalThis.self.modelHistory || []).length; },

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

    /** Measure the combined scene: `{volume, area, length, nSolids, nFaces,
     *  nEdges, bbox}` (the standard library's MeasureShape). Cheap — no
     *  meshing — and it is what makes a headless run CHECKABLE without
     *  parsing the STEP: the b123d-validation harness compares exactly these
     *  numbers against native build123d. Returns null when the scene is
     *  empty. */
    measure(deflection = 0.1) {
      const shape = globalThis.self.currentShape;
      if (!shape || (shape.IsNull && shape.IsNull())) { return null; }
      try { return globalThis.self.MeasureShape(shape, deflection); }
      catch (e) { return null; }
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
     *  COMPROMISE(kernel-heap-reset) — on 64 KB-stack builds a deep fillet
     *  overflowed the shadow stack into OCCT's statics, and the writers were
     *  the casualty.) Costs a few ms. */
    kernelHealthy() { return worker.kernelHealthy(); },

    /** Rewind OCCT to its boot image, dropping every shape. Returns false
     *  when the engine was created with `kernelImage: false`. */
    resetKernel() { return resetKernel(); },

    /** Serialize the op cache's working set (stable mode): every cached
     *  result with a content-derived key, as ONE compound in OCCT's BINARY
     *  BREP format (BinTools) plus an index. Returns null when there is
     *  nothing to save.
     *
     *  One compound rather than a file per entry because BREP keeps shared
     *  sub-shapes shared WITHIN a file — results that share topology (an
     *  op's input and output) still share it after restoreCache(), which is
     *  what IsSame-based bookkeeping depends on.
     *
     *  Binary, not the text format, because the round trip has to be
     *  BIT-EXACT: a restored result feeds the arguments of later ops (an
     *  edge's tangent becomes a JernArc's start direction), and the keys of
     *  those ops are hashes of the exact doubles. Measured on maker_coin's
     *  52 cached results (55,408 sampled vertex/edge values): BinTools 0
     *  differ; BRepTools text 21,331 differ (max relative 5e-8), which
     *  turned 7 hits of the next edit into misses. Binary is also ~5x
     *  faster to write and half the size. */
    snapshotCache() {
      if (!globalThis.self._csStableCache) {
        throw new Error('snapshotCache: needs createHeadlessCascade({stableCache: true})');
      }
      const SKIP = {};
      const o = oc();
      const shapes = [];
      // dedupe on IsEqual (same TShape, location, orientation): history
      // records name the SAME sub-shapes many times over
      const byHash = new Map();
      const shapeRef = (v) => {
        if (!v || v.$$ === undefined || typeof v.ShapeType !== 'function' || v.IsNull()) {
          throw SKIP;
        }
        const hc = o.OCJS.HashCode(v, 2147483647);
        let bucket = byHash.get(hc);
        if (!bucket) { bucket = []; byHash.set(hc, bucket); }
        for (const i of bucket) { if (shapes[i] === v || shapes[i].IsEqual(v)) { return i; } }
        bucket.push(shapes.length);
        shapes.push(v);
        return shapes.length - 1;
      };
      const drain = (list) => {
        const out = [];
        while (!list.IsEmpty()) { out.push(shapeRef(list.First())); list.RemoveFirst(); }
        list.delete();
        return out;
      };
      const T = o.TopAbs_ShapeEnum;
      const TRACKED = [T.TopAbs_VERTEX, T.TopAbs_EDGE, T.TopAbs_FACE, T.TopAbs_SOLID];
      // The operation-history record lite's primitives leave on a result
      // (StandardLibrary `._csHist = {hist, args, tools}`, read back by
      // Select.LAST/NEW). BRepTools_History cannot be enumerated, so it is
      // queried for every tracked sub-shape of the op's inputs — the only
      // keys HistClassify and HistMerge ever look up — and only non-empty
      // answers are kept.
      const encodeHist = (rec) => {
        const args = (rec.args || []).map(shapeRef);
        const tools = (rec.tools || []).map(shapeRef);
        let rel = null;
        if (rec.hist) {
          rel = [];
          const map = new o.TopTools_IndexedMapOfShape_1();
          for (const sh of (rec.args || []).concat(rec.tools || [])) {
            for (const t of TRACKED) { o.TopExp.MapShapes_1(sh, t, map); }
          }
          for (let i = 1; i <= map.Extent(); i++) {
            const sub = map.FindKey_1(i);
            const mod = drain(rec.hist.Modified(sub));
            const gen = drain(rec.hist.Generated(sub));
            const removed = rec.hist.IsRemoved(sub) ? 1 : 0;
            if (mod.length || gen.length || removed) {
              rel.push([shapeRef(sub), mod, gen, removed]);
            }
          }
          map.delete();
        }
        return { args, tools, rel };
      };
      const encode = (v) => {
        if (v === null || typeof v !== 'object') {
          if (typeof v === 'number' && !Number.isFinite(v)) { throw SKIP; }
          if (typeof v === 'function' || typeof v === 'symbol') { throw SKIP; }
          return v;
        }
        if (v.$$ !== undefined) {
          const ref = { $s: shapeRef(v) };
          if (v._csHist) { ref.hist = encodeHist(v._csHist); }
          return ref;
        }
        if (Array.isArray(v)) { return v.map(encode); }
        if (Object.getPrototypeOf(v) !== Object.prototype) { throw SKIP; }
        const o = {};
        for (const k of Object.keys(v)) {
          if (k === 'hash' || k === 'producingLine') { continue; }
          o[k] = encode(v[k]);
        }
        return o;
      };
      const entries = [];
      let skipped = 0;
      for (const key of Object.keys(globalThis.self.argCache)) {
        if (key[0] !== 'k') { continue; }
        try { entries.push([key, encode(globalThis.self.argCache[key])]); }
        catch (e) {
          if (e !== SKIP) { throw e; }
          // (shapes it already registered stay as unreferenced children)
          skipped++;
        }
      }
      if (!entries.length) { return null; }
      let bin = null;
      if (shapes.length) {
        const builder = new (oc().BRep_Builder)();
        const compound = new (oc().TopoDS_Compound)();
        builder.MakeCompound(compound);
        for (const s of shapes) { builder.Add(compound, s); }
        let ok = false;
        try {
          ok = oc().BinTools.Write_3(compound, '/' + SNAPSHOT_NAME,
            new (oc().Message_ProgressRange_1)());
          if (ok) { bin = oc().FS.readFile('/' + SNAPSHOT_NAME); }
        } finally {
          try { oc().FS.unlink('/' + SNAPSHOT_NAME); } catch (e) { /* not written */ }
          try { compound.delete(); builder.delete(); } catch (e) { /* best effort */ }
        }
        if (!ok || !bin) { throw new Error('snapshotCache: the binary BREP writer failed'); }
      }
      return { format: CACHE_SNAPSHOT_FORMAT, pySrc: opts.pySrc, shapes: shapes.length,
        entries, skipped, bin };
    },

    /** Detach triangulations from every cached result and the current
     *  scene (BRepTools::Clean). Meshing — exportSTL(), measure()'s bounding
     *  box, the viewport mesh — writes them INTO the shared TShapes, so in a
     *  host that keeps the cache across runs they would leak into later
     *  runs (BRepBndLib prefers a triangulation when one is present) and
     *  into snapshots (BinTools writes them). Returns the number of shapes
     *  cleaned. */
    clearMeshes() {
      const o = oc();
      const clean = (s) => {
        try { (o.BRepTools.Clean_1 || o.BRepTools.Clean).call(o.BRepTools, s, false); }
        catch (e) {
          try { (o.BRepTools.Clean_1 || o.BRepTools.Clean).call(o.BRepTools, s); }
          catch (e2) { return 0; }
        }
        return 1;
      };
      let n = 0;
      const cur = globalThis.self.currentShape;
      if (cur && cur.$$ && !cur.IsNull()) { n += clean(cur); }
      for (const v of Object.values(globalThis.self.argCache || {})) {
        if (v && v.$$ !== undefined && typeof v.ShapeType === 'function' && !v.IsNull()) {
          n += clean(v);
        }
      }
      return n;
    },

    /** Repopulate the op cache from snapshotCache() output — typically in a
     *  fresh isolate, before the first run(). Returns {restored, shapes}. */
    restoreCache(snap) {
      if (!globalThis.self._csStableCache) {
        throw new Error('restoreCache: needs createHeadlessCascade({stableCache: true})');
      }
      if (!snap || snap.format !== CACHE_SNAPSHOT_FORMAT || snap.pySrc !== opts.pySrc) {
        return { restored: 0, shapes: 0, rejected: 'format' };
      }
      const children = [];
      if (snap.shapes) {
        const compound = new (oc().TopoDS_Shape)();
        let ok = false;
        try {
          oc().FS.writeFile('/' + SNAPSHOT_NAME, snap.bin);
          ok = oc().BinTools.Read_2(compound, '/' + SNAPSHOT_NAME,
            new (oc().Message_ProgressRange_1)());
        } catch (e) { ok = false; }
        try { oc().FS.unlink('/' + SNAPSHOT_NAME); } catch (e) { /* consumed */ }
        if (!ok || compound.IsNull()) { return { restored: 0, shapes: 0, rejected: 'unreadable' }; }
        const it = new (oc().TopoDS_Iterator_2)(compound, true, true);
        for (; it.More(); it.Next()) { children.push(it.Value()); }
        it.delete();
        if (children.length !== snap.shapes) {
          return { restored: 0, shapes: children.length, rejected: 'shape count' };
        }
      }
      const o = oc();
      const decodeHist = (h) => {
        let hist = null;
        if (h.rel) {
          hist = new o.BRepTools_History();
          for (const [sub, mod, gen, removed] of h.rel) {
            for (const m of mod) { hist.AddModified(children[sub], children[m]); }
            for (const g of gen) { hist.AddGenerated(children[sub], children[g]); }
            if (removed && !mod.length) { hist.Remove(children[sub]); }
          }
        }
        return { hist, args: h.args.map((i) => children[i]),
          tools: h.tools.map((i) => children[i]) };
      };
      // The snapshot stores IsEqual shapes ONCE, but in memory they were
      // distinct objects, each carrying its own key (and history record).
      // Hand every reference after the first a fresh wrapper (embind
      // clone(): a new JS handle on the same TopoDS_Shape) — sharing one
      // object made the LAST entry's key overwrite the others', so every op
      // downstream of the others missed.
      const handedOut = new Set();
      const decode = (v) => {
        if (v === null || typeof v !== 'object') { return v; }
        if (Array.isArray(v)) { return v.map(decode); }
        if (typeof v.$s === 'number') {
          let shape = children[v.$s];
          if (handedOut.has(v.$s) || v.hist) { shape = shape.clone(); }
          handedOut.add(v.$s);
          if (v.hist) { shape._csHist = decodeHist(v.hist); }
          return shape;
        }
        const o = {};
        for (const k of Object.keys(v)) { o[k] = decode(v[k]); }
        return o;
      };
      const utils = worker.standardLibrary.utils;
      let restored = 0;
      for (const [key, enc] of snap.entries) {
        const v = decode(enc);
        if (v === null || typeof v !== 'object') { continue; }
        utils.AddToCache(key, v);
        restored++;
      }
      return { restored, shapes: children.length };
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
      // Rewinding the kernel image is both cheaper and more thorough than
      // deleting the compound: it hands the next job a pristine allocator
      // (so a heavy run no longer ratchets the heap) AND undoes any damage
      // the last job left in OCCT's memory — on 64 KB-stack builds, the
      // shadow-stack overflow that made a Cloudflare isolate that had once
      // run maker_coin fail every later STEP export. See
      // COMPROMISE(kernel-heap-reset).
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
