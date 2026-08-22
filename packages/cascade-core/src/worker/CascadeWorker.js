// CascadeWorker - Main CAD engine class (cascade-core)
//
// This module defines the engine and has NO side effects at import time.
// Two entry points drive it:
//   * src/worker/worker-entry.js — the browser Web Worker bundle
//     (dist/cascade-worker.js): constructs one, installs the onmessage
//     router, and signals `startupCallback`.
//   * src/headless.js — the environment-agnostic embedding used by Node and
//     Cloudflare Workers: constructs one with `installRouter: false`, an
//     asset provider and an error collector, and calls the methods directly.

import { CascadeStudioStandardLibrary } from './StandardLibrary.js';
import { CascadeStudioMesher } from './ShapeToMesh.js';
import { CascadeStudioFileIO } from './FileUtils.js';
import { USED_OCCT_SYMBOLS } from './UsedOCCTSymbols.generated.js';
import { ensurePythonRuntime } from './PythonRuntime.js';
import { csEmit, csEmitAsync, csDeferError } from './Emit.js';
import { instantiateWasmSpec, assetToArrayBuffer } from './WasmAssets.js';

/** Main CAD worker class. Initializes OpenCascade WASM, loads dependencies,
 *  and orchestrates evaluation/rendering of user CAD code.
 *
 *  `options`:
 *    - `assets`      — see WasmAssets.js / headless.js: `{ occtWasm, fonts,
 *                      loadAsset }`. Omitted in the browser worker, which
 *                      keeps fetching the files next to the bundle.
 *    - `installRouter` (default true) — install the `onmessage` router and
 *                      emit `startupCallback` once OCCT is up. */
class CascadeStudioWorker {
  constructor(options = {}) {
    this.options = options;
    // Define persistent global variables on self for eval() access
    self.oc = null;
    self.externalShapes = {};
    self.sceneShapes = [];
    self.GUIState = {};
    self.fullShapeEdgeHashes = {};
    self.fullShapeFaceHashes = {};
    self.currentShape = null;
    self.messageHandlers = self.messageHandlers || {};

    // Store original console methods
    this.realConsoleLog = console.log;
    this.realConsoleError = console.error;

    // Forward logs and errors to the main thread
    this._setupConsoleOverrides();

    // Shim importScripts for module workers, which don't have it. No longer
    // needed by OpenCascade's glue — that is built with `-sENVIRONMENT=web`,
    // so it never sniffs the environment at all — but Brython still decides
    // `isWebWorker` with `typeof importScripts === "function"`, and answering
    // "yes" is the truthful answer for this worker. (Anything that actually
    // CALLS it is asking for a classic-worker feature we cannot provide.)
    if (typeof importScripts === 'undefined') {
      self.importScripts = function() { throw new Error('importScripts is not supported in module workers'); };
    }

    // Register message handlers
    self.messageHandlers["Evaluate"] = this.evaluate.bind(this);
    self.messageHandlers["combineAndRenderShapes"] = this.combineAndRenderShapes.bind(this);
    self.messageHandlers["meshHistoryStep"] = this.meshHistoryStep.bind(this);
    self.messageHandlers["memoryStats"] = this.memoryStats.bind(this);
    // Shared labeled-memory-mark helper (mesh-phase attribution probes use
    // it from ShapeToMesh; includes the optional free-space census).
    self._csMemMark = CascadeStudioWorker._memMark;
  }

  /** Worker-side memory footprint, split by owner. Used by the Python
   *  runtime comparison (test/b123d-validation/runtime-comparison.md) — the
   *  page cannot see any of this, since it all lives in the worker.
   *
   *  `occtWasm`/`pythonWasm` are exact wasm linear-memory sizes (they only
   *  ever grow). `jsHeap*` comes from `performance.memory`, which Chromium
   *  does NOT expose in workers — expect zeros there, and read renderer RSS
   *  instead (bench-runtime.mjs does). A GC is forced first when the browser
   *  was started with --js-flags=--expose-gc. */
  memoryStats() {
    if (typeof globalThis.gc === 'function') {
      try { globalThis.gc(); globalThis.gc(); } catch (e) { /* best effort */ }
    }
    const mem = (typeof performance !== 'undefined' && performance.memory) || {};
    let pythonWasm = 0;
    try {
      const py = self._pyodideRuntime;
      if (py && py._module && py._module.HEAPU8) { pythonWasm = py._module.HEAPU8.length; }
    } catch (e) { /* no Pyodide in this session */ }
    try {
      const mp = self._csMpInterpreter;
      if (mp && mp._module && mp._module.HEAPU8) { pythonWasm = mp._module.HEAPU8.length; }
    } catch (e) { /* no MicroPython in this session */ }
    // Retention attribution (heavy-model memory work): what the worker's own
    // bookkeeping currently pins, plus the OCP shim's embind-object ledger.
    const history = self.modelHistory || [];
    let historyShapePins = 0;
    for (const step of history) {
      historyShapePins += (step.shapes && step.shapes.length) || 0;
    }
    let ocpStats = null;
    if (self._csOcpStats) {
      const s = self._csOcpStats;
      const top = Object.entries(s.byClass)
        .sort((a, b) => b[1] - a[1]).slice(0, 25);
      const aliveBy = {};
      for (const k in s.byClass) {
        const a = s.byClass[k] - (s.freedByClass ? (s.freedByClass[k] || 0) : 0);
        if (a > 0) { aliveBy[k] = a; }
      }
      const topAlive = Object.entries(aliveBy)
        .sort((a, b) => b[1] - a[1]).slice(0, 25);
      const topErr = s.errBy ? Object.entries(s.errBy)
        .sort((a, b) => b[1] - a[1]).slice(0, 12) : null;
      ocpStats = { created: s.created, freed: s.freed,
        alive: s.created - s.freed, errs: s.errs || 0, topErr,
        topClasses: top, topAlive };
    }
    // Triangulation census of the retained compound (attribution: is mesh
    // data still attached to live shapes?)
    let meshRetention = null;
    try {
      if (self.currentShape && self.oc && self.currentShape.$$ && self.currentShape.$$.ptr) {
        const oc = self.oc;
        let faces = 0, withTri = 0, triNodes = 0;
        const ex = new oc.TopExp_Explorer_2(self.currentShape,
          oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
        for (; ex.More(); ex.Next()) {
          faces++;
          const loc = new oc.TopLoc_Location_1();
          const f = oc.TopoDS_Cast.Face_1(ex.Current());
          const t = oc.BRep_Tool.Triangulation(f, loc, 0);
          if (!t.IsNull()) { withTri++; triNodes += t.get().NbNodes(); }
          try { t.delete(); f.delete(); loc.delete(); } catch (e) { /* skip */ }
        }
        ex.delete();
        meshRetention = { faces, withTri, triNodes };
      }
    } catch (e) { /* attribution only */ }
    return {
      meshRetention,
      pyRuntime: self._pythonRuntimeKind || null,
      jsHeapUsed: mem.usedJSHeapSize || 0,
      jsHeapTotal: mem.totalJSHeapSize || 0,
      occtWasm: self.ocMemory ? self.ocMemory.buffer.byteLength : 0,
      pythonWasm,
      bootTiming: self._pythonBootTiming || null,
      argCacheCount: Object.keys(self.argCache || {}).length,
      sceneShapesCount: (self.sceneShapes || []).length,
      historySteps: history.length,
      historyShapePins,
      ocpStats,
    };
  }

  /** Override console.log/error to forward messages to the main thread. */
  _setupConsoleOverrides() {
    const realLog = this.realConsoleLog;
    const realError = this.realConsoleError;

    console.log = function (...args) {
      const message = args.map(a => {
        if (typeof a === 'string') { return a; }
        // Circular objects (e.g. Brython internals) must not break logging
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(' ');
      csEmitAsync({ type: "log", payload: message });
      realLog.apply(console, args);
    };

    console.error = function (err, url, line, colno, errorObj) {
      csEmit({ type: "resetWorking" });
      csDeferError(() => {
        if (err && err.message) {
          err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
          throw err;
        } else {
          // Raw wasm exceptions arrive as pointer numbers — decode them into
          // OCCT's own diagnostic where possible (self.describeOCCTException
          // is installed by CascadeStudioUtils).
          throw new Error("INTERNAL OPENCASCADE ERROR: " + (self.describeOCCTException
            ? self.describeOCCTException(err) : err));
        }
      });
      realError.apply(console, arguments);
    };
  }

  /** Asynchronously load all dependencies and initialize OpenCascade WASM. */
  async init() {
    let initOpenCascade, opentype, potpack;

    try {
      const ocMod = await import('opencascade.js/dist/cascadestudio.js');
      initOpenCascade = ocMod.default;
    } catch(e) {
      csEmit({ type: "log", payload: "ERROR loading opencascade: " + e.message });
      throw e;
    }

    try {
      const otMod = await import('opentype.js/dist/opentype.module.js');
      opentype = otMod.default;
    } catch(e) {
      csEmit({ type: "log", payload: "ERROR loading opentype: " + e.message });
      throw e;
    }

    try {
      const ppMod = await import('potpack');
      potpack = ppMod.default || ppMod.potpack || ppMod;
    } catch(e) {
      csEmit({ type: "log", payload: "ERROR loading potpack: " + e.message });
      throw e;
    }

    self.potpack = potpack;

    // Instantiate class-based modules (populates self.* for eval() access)
    this.standardLibrary = new CascadeStudioStandardLibrary();
    this.mesher = new CascadeStudioMesher();
    this.fileIO = new CascadeStudioFileIO();

    // Preload fonts available via Text3D/Text2D. Awaited so the first
    // evaluation can never race the font fetch (they are small local TTFs).
    await this._loadFonts(opentype);

    // Load the OpenCascade WebAssembly Module (v2 Embind)
    const wasmPath = (path) => {
      if (path.endsWith('.wasm')) {
        // In build mode, WASM is copied to the build output directory
        return typeof ESBUILD !== 'undefined' ? './cascadestudio.wasm' : '../../node_modules/opencascade.js/dist/cascadestudio.wasm';
      }
      return path;
    };
    // Headless hosts hand the wasm over as bytes (Node) or as an already
    // compiled Module (Cloudflare Workers) — see WasmAssets.js.
    const occtSpec = (this.options.assets && this.options.assets.occtWasm) || null;
    try {
      const openCascade = await initOpenCascade({
        locateFile: wasmPath,
        // Emscripten's documented instantiation hook, used ONLY to keep a
        // reference to the wasm linear memory.
        //
        // Why: OCCT throws C++ exceptions, which arrive in JS as raw pointer
        // NUMBERS. The fork binds `OCJS::getStandard_FailureData(ptr)` to turn
        // one back into a `Standard_Failure`, but that binding is UNCALLABLE in
        // this build — embind refuses with "unbound types: St9exception",
        // because Standard_Failure derives from std::exception, which is not a
        // registered type. This build also exports no runtime helpers (no
        // HEAPU8/getValue/UTF8ToString), so there is no other way in.
        // Capturing the Memory here lets StandardUtils.decodeOCCTException read
        // Standard_Failure's message directly (see its layout notes), turning
        // "the kernel threw '6454200'" into OCCT's own diagnostic.
        instantiateWasm(imports, receiveInstance) {
          (async () => {
            const result = await instantiateWasmSpec(
              occtSpec || wasmPath('cascadestudio.wasm'), imports);
            for (const value of Object.values(result.instance.exports)) {
              if (value instanceof WebAssembly.Memory) { self.ocMemory = value; break; }
            }
            receiveInstance(result.instance, result.module);
          })();
        }
      });

      // Register the "OpenCascade" WebAssembly Module under the shorthand "oc"
      self.oc = openCascade;

      // Numbered Embind overload suffixes (e.g. BRepBuilderAPI_MakeEdge_24)
      // are derived from each class's overload set and can be renumbered by
      // an OCCT upgrade. Verify every symbol the worker references so a
      // mismatched WASM build fails loudly at startup instead of surfacing
      // as cryptic errors mid-evaluation.
      const missingSymbols = USED_OCCT_SYMBOLS.filter((s) => !(s in openCascade));
      if (missingSymbols.length > 0) {
        const message = "OCCT build is missing " + missingSymbols.length +
          " symbol(s) used by the standard library (overload suffixes may " +
          "have been renumbered by an OCCT upgrade): " + missingSymbols.join(", ");
        csEmit({ type: "error", payload: message });
        console.error(message);
      }

      // Snapshot the kernel's pristine linear memory so a poisoned heap can
      // be rewound (see captureKernelImage). Opt-in: only hosts that can
      // afford to lose every live shape (headless, one job per request) may
      // restore it, so only they pay for the snapshot.
      if (this.options.kernelImage === true) { this.captureKernelImage(); }

      // Route incoming messages to registered handlers. Handlers may return
      // a Promise (e.g. meshing that waits on an async Python evaluation);
      // the response is posted once it resolves.
      //
      // Headless embedders (installRouter: false) have no message loop at
      // all — src/headless.js awaits the handlers directly.
      if (this.options.installRouter !== false) {
        onmessage = function (e) {
          const respond = (response) => {
            if (response !== undefined || e.data.requestId) {
              const msg = { "type": e.data.type, payload: response };
              if (e.data.requestId) { msg.requestId = e.data.requestId; }
              csEmit(msg);
            }
          };
          let response = self.messageHandlers[e.data.type](e.data.payload);
          if (response instanceof Promise) {
            response.then(respond, (err) => {
              csEmit({ type: "resetWorking" });
              csDeferError(() => { throw err; });
            });
          } else {
            respond(response);
          }
        };
      }

      // Signal that the worker is ready
      csEmit({ type: "startupCallback" });
    } catch(e) {
      csEmit({ type: "log", payload: "ERROR loading OpenCascade WASM: " + e.message });
      throw e;
    }
  }

  /** Preload the various fonts available via Text3D. */
  async _loadFonts(opentype) {
    const fontBase = typeof ESBUILD !== 'undefined' ? './fonts/' : '../../fonts/';
    const preloadedFonts = CascadeStudioWorker.FONT_NAMES.map((n) => fontBase + n + '.ttf');
    self.loadedFonts = {};
    self.fontKernPairs = {};

    // Headless path: the embedder supplies the TTF bytes (there is no URL to
    // fetch in Node or workerd). Fonts are OPTIONAL — a headless run that
    // never calls Text()/Text3D() does not need any, and missing ones are
    // simply absent from self.loadedFonts.
    const assets = this.options.assets;
    if (assets && (assets.fonts || assets.loadAsset)) {
      for (const name of CascadeStudioWorker.FONT_NAMES) {
        let buf = null;
        try {
          buf = await assetToArrayBuffer(assets, 'fonts', name, 'fonts/' + name + '.ttf');
        } catch (e) { buf = null; }
        if (!buf) { continue; }
        try {
          self.loadedFonts[name] = opentype.parse(buf);
          self.fontKernPairs[name] = CascadeStudioWorker._parseKernTable(buf);
        } catch (e) {
          console.log('Failed to parse font ' + name + ': ' + (e && e.message));
        }
      }
      return;
    }

    return Promise.all(preloadedFonts.map((fontURL) => new Promise((resolve) => {
      // { isUrl: true } forces XHR instead of require('fs') since workers lack `window`
      opentype.load(fontURL, function (err, font) {
        if (err) { console.log(err); }
        let fontName = fontURL.split("./fonts/")[1] || fontURL.split("/fonts/")[1];
        fontName = fontName.split(".ttf")[0];
        self.loadedFonts[fontName] = font;
        // opentype.js only reads the FIRST kern subtable — parse all of the
        // format-0 subtables ourselves so Text2D can match FreeType's
        // kerning (build123d text parity)
        fetch(fontURL).then((r) => r.arrayBuffer()).then((buf) => {
          self.fontKernPairs[fontName] = CascadeStudioWorker._parseKernTable(buf);
          resolve();
        }).catch(() => resolve());
      }, { isUrl: true });
    })));
  }

  /** Parse every format-0 'kern' subtable of a TTF into a Map keyed by
   *  "leftGid,rightGid" -> kern value in font units. */
  static _parseKernTable(buf) {
    const pairs = new Map();
    try {
      const dv = new DataView(buf);
      const numTables = dv.getUint16(4);
      let kernOffset = 0, kernLength = 0;
      for (let i = 0; i < numTables; i++) {
        const rec = 12 + i * 16;
        const tag = String.fromCharCode(dv.getUint8(rec), dv.getUint8(rec + 1),
          dv.getUint8(rec + 2), dv.getUint8(rec + 3));
        if (tag === 'kern') { kernOffset = dv.getUint32(rec + 8); kernLength = dv.getUint32(rec + 12); }
      }
      if (!kernOffset) { return pairs; }
      const nSub = dv.getUint16(kernOffset + 2);
      let off = kernOffset + 4;
      for (let t = 0; t < nSub; t++) {
        const len = dv.getUint16(off + 2);
        const coverage = dv.getUint16(off + 4);
        const format = coverage >> 8;
        // horizontal kerning only: skip 'minimum' and cross-stream subtables
        const horizontal = (coverage & 0x1) === 1;
        const minimum = (coverage & 0x2) !== 0;
        const crossStream = (coverage & 0x4) !== 0;
        if (format === 0 && horizontal && !minimum && !crossStream) {
          const nPairs = dv.getUint16(off + 6);
          let p = off + 14;
          for (let i = 0; i < nPairs; i++, p += 6) {
            pairs.set(dv.getUint16(p) + ',' + dv.getUint16(p + 2), dv.getInt16(p + 4));
          }
        }
        off += (len || 6);
        if (off >= kernOffset + kernLength) { break; }
      }
    } catch (e) { /* kerning is best-effort */ }
    return pairs;
  }

  /** Evaluate user CAD code (the contents of the Editor Window) and set the GUI State.
   *  payload.language selects the runtime: undefined/'cascadestudio' (and
   *  transpiled OpenSCAD) eval JS synchronously; 'python' runs build123d-lite
   *  code through the lazily-bootstrapped Brython runtime (async). */
  evaluate(payload) {
    self.opNumber = 0;
    self.GUIState = payload.GUIState;
    self.evalLanguage = payload.language || 'cascadestudio';
    // Heavy-model memory flags (EditorManager resolves them from the URL /
    // localStorage): lowMemory drops history shape refs + deletes pruned
    // cache entries; ocpLifetime='leak' opts OUT of the deterministic
    // embind frees (A/B measurement).
    self._csLowMemory = !!payload.lowMemory;
    if (payload.ocpLifetime) { self._csOcpLifetime = payload.ocpLifetime; }
    // Reset the shim's free machinery for this evaluation: clears stale
    // fuse-operand pins and reclaims everything the PREVIOUS run left
    // freeable (its history was just replaced).
    self.modelHistory = [];
    // The previous run's meshed compound is dead weight now (a new one is
    // built after this evaluation) — delete it so its BRep data can be
    // reclaimed instead of stacking under this run's peak.
    if (self.currentShape) {
      try {
        if (self.currentShape.$$ && self.currentShape.$$.ptr) {
          self.currentShape.delete();
          if (self._csOcpStats) { self._csOcpStats.freed++; }
        }
      } catch (e) { /* best effort */ }
      self.currentShape = null;
    }
    if (self._csOcpEvalReset) { self._csOcpEvalReset(); }

    // Reset cache counters and modeling history for this evaluation
    this.standardLibrary.utils.cacheHits = 0;
    this.standardLibrary.utils.cacheMisses = 0;
    self.cacheHits = 0;
    self.cacheMisses = 0;
    self.modelHistory = [];
    this.standardLibrary.utils.modelHistory = self.modelHistory;
    this.standardLibrary.utils._pendingHistoryOp = null;

    if (self.evalLanguage === 'python') {
      // Async path: the pending promise is stored so combineAndRenderShapes
      // (the engine queues it right behind this message) waits for the
      // evaluation to finish before meshing the scene.
      this._pendingEvaluation = this._evaluatePython(payload);
      return;
    }

    try {
      eval(payload.code);
    } catch (e) {
      csDeferError(() => {
        e.message = "Line " + self.currentLineNumber + ": " + self.currentOp + "() encountered  " + e.message;
        throw e;
      });
    } finally {
      this._finishEvaluation();
    }
  }

  /** Run user Python through Brython (bootstrapped on first use). Never
   *  rejects: Python errors are re-thrown asynchronously so they surface on
   *  the main thread exactly like JS-mode evaluation errors. */
  async _evaluatePython(payload) {
    try {
      // topology-layer opt-in for the upstream-topology spike (default 'lite')
      if (payload.pyTopo && !self._csPyTopo) { self._csPyTopo = payload.pyTopo; }
      const runtime = await ensurePythonRuntime(payload.pyRuntime, payload.pySrc);
      runtime.run(payload.code);
    } catch (e) {
      csDeferError(() => { throw e; });
    } finally {
      this._finishEvaluation();
    }
  }

  /** Post-evaluation bookkeeping shared by the JS and Python paths:
   *  flush history, report it, signal resetWorking, and clean the cache. */
  _finishEvaluation() {
    // Flush the final operation's history step
    self.flushHistoryStep();

    // Send lightweight history metadata to main thread (no shape data)
    csEmit({
      type: "modelHistory",
      payload: self.modelHistory.map((step, i) => ({
        index: i,
        fnName: step.fnName,
        lineNumber: step.lineNumber,
        shapeCount: step.shapeCount,
      }))
    });

    csEmit({ type: "log", payload: "Cache: " + self.cacheHits + " hits, " + self.cacheMisses + " misses" });
    csEmit({ type: "resetWorking" });
    // Clean cache; remove unused objects. In low-memory mode the pruned
    // entries' kernel objects are DELETED (they are provably from previous
    // evaluations: unused this run, and the previous run's scene/history are
    // gone) — freed wasm is reused within the arena, so iterative editing
    // stops ratcheting. Skipped for shim-retained objects (`_csPy` > 0:
    // a live Python proxy still owns them; the __del__ path frees those).
    let usedHashes = this.standardLibrary.utils.usedHashes;
    for (let hash in self.argCache) {
      if (!usedHashes.hasOwnProperty(hash)) {
        if (self._csLowMemory) {
          CascadeStudioWorker._deleteEmbindTree(self.argCache[hash]);
        }
        delete self.argCache[hash];
      }
    }
    for (let key in usedHashes) { delete usedHashes[key]; }
    // End-of-evaluation safe point for the shim's queued frees.
    if (self._csOcpFlushFrees) { self._csOcpFlushFrees(); }
    CascadeStudioWorker._memMark('eval-end');
  }

  /** Best-effort .delete() of an embind object (or array of them) that the
   *  worker provably no longer references. Objects still retained by a live
   *  Python proxy (`_csPy` > 0) are left to the shim's __del__ path. */
  static _deleteEmbindTree(v) {
    try {
      if (!v || typeof v !== 'object') { return; }
      if (Array.isArray(v)) { for (const x of v) { CascadeStudioWorker._deleteEmbindTree(x); } return; }
      if (v.$$ === undefined || !v.$$.ptr) { return; }
      if (v._csPy > 0) { return; }
      v.delete();
      if (self._csOcpStats) { self._csOcpStats.freed++; }
    } catch (e) { /* best effort */ }
  }

  // ------------------------------------------------------------------ //
  // Kernel image: rewinding a heap that OCCT itself corrupted.
  //
  // COMPROMISE(kernel-heap-reset). Several OCCT 8.0.1 algorithms scribble
  // over their own heap in this wasm build. The geometry they return is
  // correct (volume/bbox/copy/mesh all agree with upstream), but a live
  // allocation somewhere else has been handed out twice, and the casualty is
  // usually a lazily-built singleton. Two are reproducible from the
  // validation corpus, both detectable in plain Node with the wasm memory
  // free to grow — so this is NOT the 128 MB Cloudflare ceiling, and it does
  // not need a single extra byte to trigger:
  //
  //   examples/maker_coin   BRepFilletAPI_MakeFillet::Build (ChFi3d_Rational,
  //                         9 Select.NEW edges) -> every later
  //                         `new STEPControl_Writer`/`_Reader` traps with
  //                         "memory access out of bounds"; an ALREADY-BUILT
  //                         writer still transfers and writes correctly.
  //   examples/bicycle_tire BRepOffsetAPI_ThruSections::Build (the ruled wall
  //                         ThickenSolid lofts between a boundary wire and
  //                         its offset image) -> BRepTools::Write AND the
  //                         STEP transfer trap, even for a fresh 1 mm box.
  //
  // The damage is permanent for the isolate: it is what made a Cloudflare
  // Worker that had once run maker_coin fail every later STEP export.
  //
  // The rewind is the cheap, total repair: OCCT's linear memory right after
  // module init is ~3.7 MB of the 32 MB initial heap (data + bss + stack +
  // the little embind allocates), so it snapshots in ~20 ms and restores in
  // ~2 ms, and every OCCT singleton re-initialises lazily from its .bss
  // guard afterwards. It is a nuclear reset: EVERY embind wrapper the host
  // still holds dangles afterwards, so a caller must drop sceneShapes,
  // currentShape, the op cache and any imported assets in the same breath
  // (headless.js `reset()`/`_healKernel()` do).
  // ------------------------------------------------------------------ //

  /** Snapshot OCCT's linear memory as it is immediately after module init.
   *  Trailing all-zero 64 KB pages are dropped (restore zero-fills them), so
   *  the retained buffer is a few MB rather than the 32 MB initial heap.
   *  @returns {number} the retained image size in bytes (0 when unavailable) */
  captureKernelImage() {
    const mem = self.ocMemory;
    if (!mem || !mem.buffer) { return 0; }
    const heap = new Uint8Array(mem.buffer);
    const PAGE = 65536;
    let end = heap.length;
    while (end >= PAGE) {
      let zero = true;
      for (let i = end - PAGE; i < end; i++) { if (heap[i] !== 0) { zero = false; break; } }
      if (!zero) { break; }
      end -= PAGE;
    }
    this._kernelImage = heap.slice(0, end);
    self._csKernelImageBytes = this._kernelImage.length;
    return this._kernelImage.length;
  }

  /** True when a kernel image is available to restore. */
  hasKernelImage() { return !!this._kernelImage; }

  /** Rewind OCCT's linear memory to the captured image. Every embind object
   *  created since the capture is dangling afterwards — the caller owns
   *  dropping them. Returns false when no image was captured. */
  restoreKernelImage() {
    const img = this._kernelImage;
    const mem = self.ocMemory;
    if (!img || !mem || !mem.buffer) { return false; }
    const heap = new Uint8Array(mem.buffer);
    heap.set(img, 0);
    // Everything above the image was zero at capture time; the wasm memory
    // only ever grew, so zero the rest back out. Emscripten's sbrk break is
    // part of the image, so the allocator simply re-uses this space.
    if (heap.length > img.length) { heap.fill(0, img.length); }
    return true;
  }

  /** Is the STEP/BREP writer machinery still usable?
   *
   *  Costs one 1 mm box + one STEP transfer (a few ms) and leaks the probe
   *  objects, so call it on failure paths and between jobs, not per op. */
  kernelHealthy() {
    const oc = self.oc;
    if (!oc) { return false; }
    try {
      const probe = new oc.BRepPrimAPI_MakeBox_2(1, 1, 1).Shape();
      const writer = new oc.STEPControl_Writer_1();
      const status = writer.Transfer_1(probe,
        oc.STEPControl_StepModelType.STEPControl_AsIs, true,
        new oc.Message_ProgressRange_1());
      return status === oc.IFSelect_ReturnStatus.IFSelect_RetDone;
    } catch (e) { return false; }
  }

  /** Accumulate all shapes in `sceneShapes` into a compound, triangulate
   *  with ShapeToMesh, and return for rendering. If an async (Python)
   *  evaluation is still in flight, meshing waits for it and a Promise is
   *  returned instead (the onmessage router posts it once resolved). */
  combineAndRenderShapes(payload) {
    if (this._pendingEvaluation) {
      const pending = this._pendingEvaluation;
      this._pendingEvaluation = null;
      return pending.then(() => this._combineAndRenderShapes(payload));
    }
    return this._combineAndRenderShapes(payload);
  }

  /** Accumulate `sceneShapes` into `self.currentShape` WITHOUT triangulating
   *  anything. This is the headless BREP/STEP path: meshing is by far the
   *  most memory-hungry stage (BRepMesh_IncrementalMesh attaches a
   *  Poly_Triangulation to every face), and an exporter that writes exact
   *  boundary representation has no use for it. Returns the number of
   *  top-level shapes that went in. */
  combineShapes() {
    const oc = self.oc;
    if (self.currentShape) {
      try {
        if (self.currentShape.$$ && self.currentShape.$$.ptr) { self.currentShape.delete(); }
      } catch (e) { /* best effort */ }
      self.currentShape = null;
    }
    self.currentShape = new oc.TopoDS_Compound();
    const builder = new oc.BRep_Builder();
    builder.MakeCompound(self.currentShape);
    let count = 0;
    for (const shape of self.sceneShapes) {
      if (!shape || !shape.IsNull || shape.IsNull() || !shape.ShapeType) { continue; }
      builder.Add(self.currentShape, shape);
      count++;
    }
    try { builder.delete(); } catch (e) { /* best effort */ }
    self.sceneShapes = [];
    return count;
  }

  /** Synchronous meshing of the accumulated sceneShapes. */
  /** Labeled wasm-heap sample into the attribution buffer (see OcpShim).
   *  With self._csMemFreeProbe set, also counts FREE arena space by
   *  allocating 1-MB blocks until the memory grows (diagnostic only). */
  static _memMark(label) {
    try {
      if (!self._csMemSamples) { self._csMemSamples = []; }
      let freeMB = -1;
      if (self._csMemFreeProbe && self.oc && self.ocMemory) {
        const oc = self.oc;
        const base = self.ocMemory.buffer.byteLength;
        const held = [];
        freeMB = 0;
        for (let i = 0; i < 4000; i++) {
          const a = new oc.TColStd_Array1OfReal_2(1, 131072);
          if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
          held.push(a); freeMB++;
        }
        for (const a of held) { try { a.delete(); } catch (e) { /* skip */ } }
      }
      self._csMemSamples.push([label,
        self.ocMemory ? self.ocMemory.buffer.byteLength : 0, freeMB]);
    } catch (e) { /* diagnostics only */ }
  }

  _combineAndRenderShapes(payload) {
    let oc = self.oc;
    CascadeStudioWorker._memMark('mesh-start');
    // Initialize currentShape as an empty Compound Solid
    self.currentShape = new oc.TopoDS_Compound();
    let sceneBuilder = new oc.BRep_Builder();
    // Note: BRep_Builder and TopoDS_Compound have no overloaded constructors in v2
    sceneBuilder.MakeCompound(self.currentShape);
    let fullShapeEdgeHashes = {}; let fullShapeFaceHashes = {};
    // Map each face/edge hash to the index of its owning top-level sceneShape,
    // and record each sceneShape's producing editor line (tagged by CacheOp).
    // These flow into the mesh payload so the viewport can map picks → code lines.
    let faceHashToShapeIndex = {}; let edgeHashToShapeIndex = {};
    let shapeLines = [];
    csEmit({ "type": "Progress", "payload": { "opNumber": self.opNumber++, "opType": "Combining Shapes" } });

    // If there are sceneShapes, iterate through them and add them to currentShape
    if (self.sceneShapes.length > 0) {
      for (let shapeInd = 0; shapeInd < self.sceneShapes.length; shapeInd++) {
        if (!self.sceneShapes[shapeInd] || !self.sceneShapes[shapeInd].IsNull || self.sceneShapes[shapeInd].IsNull()) {
          console.error("Null Shape detected in sceneShapes; skipping: " + JSON.stringify(self.sceneShapes[shapeInd]));
          shapeLines[shapeInd] = -1;
          continue;
        }
        if (!self.sceneShapes[shapeInd].ShapeType) {
          console.error("Non-Shape detected in sceneShapes; " +
            "are you sure it is a TopoDS_Shape and not something else that needs to be converted to one?");
          console.error(JSON.stringify(self.sceneShapes[shapeInd]));
          shapeLines[shapeInd] = -1;
          continue;
        }

        // Scan the edges and faces and add to the edge list
        let shapeEdgeHashes = self.ForEachEdge(self.sceneShapes[shapeInd], (index, edge) => { });
        Object.assign(fullShapeEdgeHashes, shapeEdgeHashes);
        for (let edgeHash in shapeEdgeHashes) { edgeHashToShapeIndex[edgeHash] = shapeInd; }
        self.ForEachFace(self.sceneShapes[shapeInd], (index, face) => {
          let faceHash = self.oc.OCJS.HashCode(face, 100000000);
          fullShapeFaceHashes[faceHash] = index;
          faceHashToShapeIndex[faceHash] = shapeInd;
        });

        shapeLines[shapeInd] = self.sceneShapes[shapeInd].producingLine || -1;
        sceneBuilder.Add(self.currentShape, self.sceneShapes[shapeInd]);
      }

      // Use ShapeToMesh to output triangulated faces and discretized edges to the 3D Viewport
      csEmit({ "type": "Progress", "payload": { "opNumber": self.opNumber++, "opType": "Triangulating Faces" } });
      let facesAndEdges = self.ShapeToMesh(self.currentShape,
        payload.maxDeviation || 0.1, fullShapeEdgeHashes, fullShapeFaceHashes,
        faceHashToShapeIndex, edgeHashToShapeIndex);
      CascadeStudioWorker._memMark('mesh-end');
      try { sceneBuilder.delete(); } catch (e) { /* best effort */ }
      self.sceneShapes = [];
      csEmit({ "type": "Progress", "payload": { "opNumber": self.opNumber, "opType": "" } });
      return [facesAndEdges, payload.sceneOptions, shapeLines];
    } else {
      console.error("There were no scene shapes returned!");
    }
    csEmit({ "type": "Progress", "payload": { "opNumber": self.opNumber, "opType": "" } });
  }

  /** Triangulate and return the shapes from a specific modeling history step.
   *  Called on-demand when the user scrubs the timeline. */
  meshHistoryStep(payload) {
    let step = self.modelHistory[payload.stepIndex];
    if (step && step.shapeCount > 0 && step.shapes.length === 0) {
      console.log("History step " + payload.stepIndex + " has no retained " +
        "shapes: low-memory mode keeps step metadata only. Re-run without " +
        "?lowmem=1 to scrub the timeline.");
      return null;
    }
    if (!step || step.shapes.length === 0) return null;

    let oc = self.oc;
    let compound = new oc.TopoDS_Compound();
    let builder = new oc.BRep_Builder();
    builder.MakeCompound(compound);

    let edgeHashes = {};
    let faceHashes = {};

    for (let shape of step.shapes) {
      if (!shape || shape.IsNull()) continue;
      Object.assign(edgeHashes, self.ForEachEdge(shape, () => {}));
      self.ForEachFace(shape, (index, face) => {
        faceHashes[oc.OCJS.HashCode(face, 100000000)] = index;
      });
      builder.Add(compound, shape);
    }

    let facesAndEdges = self.ShapeToMesh(compound, payload.maxDeviation || 0.1, edgeHashes, faceHashes);
    try { compound.delete(); builder.delete(); } catch (e) { /* best effort */ }
    return facesAndEdges;
  }
}

/** The TTF families preloaded for Text3D/Text2D (build123d's Text uses the
 *  FreeSans family). Headless embedders resolve these names through the
 *  asset provider; the browser worker fetches `./fonts/<name>.ttf`. */
CascadeStudioWorker.FONT_NAMES = [
  'Roboto', 'Papyrus', 'Consolas', 'LiberationSans-Regular',
  'FreeSans', 'FreeSansBold', 'FreeSansOblique', 'FreeSansBoldOblique',
];

export { CascadeStudioWorker };
