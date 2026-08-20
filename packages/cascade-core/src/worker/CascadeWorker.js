// CascadeWorker - Main CAD worker entry point (cascade-core)

import { CascadeStudioStandardLibrary } from './StandardLibrary.js';
import { CascadeStudioMesher } from './ShapeToMesh.js';
import { CascadeStudioFileIO } from './FileUtils.js';
import { USED_OCCT_SYMBOLS } from './UsedOCCTSymbols.generated.js';
import { ensurePythonRuntime } from './PythonRuntime.js';

/** Main CAD worker class. Initializes OpenCascade WASM, loads dependencies,
 *  and orchestrates evaluation/rendering of user CAD code. */
class CascadeStudioWorker {
  constructor() {
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

    // Shim importScripts for module workers so Emscripten detects ENVIRONMENT_IS_WORKER
    // (Module workers don't have importScripts, causing Emscripten to fall into ENVIRONMENT_IS_SHELL)
    if (typeof importScripts === 'undefined') {
      self.importScripts = function() { throw new Error('importScripts is not supported in module workers'); };
    }

    // Register message handlers
    self.messageHandlers["Evaluate"] = this.evaluate.bind(this);
    self.messageHandlers["combineAndRenderShapes"] = this.combineAndRenderShapes.bind(this);
    self.messageHandlers["meshHistoryStep"] = this.meshHistoryStep.bind(this);
    self.messageHandlers["memoryStats"] = this.memoryStats.bind(this);
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
    return {
      pyRuntime: self._pythonRuntimeKind || null,
      jsHeapUsed: mem.usedJSHeapSize || 0,
      jsHeapTotal: mem.totalJSHeapSize || 0,
      occtWasm: self.ocMemory ? self.ocMemory.buffer.byteLength : 0,
      pythonWasm,
      bootTiming: self._pythonBootTiming || null,
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
      setTimeout(() => { postMessage({ type: "log", payload: message }); }, 0);
      realLog.apply(console, args);
    };

    console.error = function (err, url, line, colno, errorObj) {
      postMessage({ type: "resetWorking" });
      setTimeout(() => {
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
      }, 0);
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
      postMessage({ type: "log", payload: "ERROR loading opencascade: " + e.message });
      throw e;
    }

    try {
      const otMod = await import('opentype.js/dist/opentype.module.js');
      opentype = otMod.default;
    } catch(e) {
      postMessage({ type: "log", payload: "ERROR loading opentype: " + e.message });
      throw e;
    }

    try {
      const ppMod = await import('potpack');
      potpack = ppMod.default || ppMod.potpack || ppMod;
    } catch(e) {
      postMessage({ type: "log", payload: "ERROR loading potpack: " + e.message });
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
          const url = wasmPath('cascadestudio.wasm');
          (async () => {
            let result;
            try {
              result = await WebAssembly.instantiateStreaming(fetch(url), imports);
            } catch (streamError) {
              // wrong MIME type / no streaming support: fall back exactly like
              // Emscripten's own instantiateAsync does
              const bytes = await (await fetch(url)).arrayBuffer();
              result = await WebAssembly.instantiate(bytes, imports);
            }
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
        postMessage({ type: "error", payload: message });
        console.error(message);
      }

      // Route incoming messages to registered handlers. Handlers may return
      // a Promise (e.g. meshing that waits on an async Python evaluation);
      // the response is posted once it resolves.
      onmessage = function (e) {
        const respond = (response) => {
          if (response !== undefined || e.data.requestId) {
            const msg = { "type": e.data.type, payload: response };
            if (e.data.requestId) { msg.requestId = e.data.requestId; }
            postMessage(msg);
          }
        };
        let response = self.messageHandlers[e.data.type](e.data.payload);
        if (response instanceof Promise) {
          response.then(respond, (err) => {
            postMessage({ type: "resetWorking" });
            setTimeout(() => { throw err; }, 0);
          });
        } else {
          respond(response);
        }
      };

      // Signal that the worker is ready
      postMessage({ type: "startupCallback" });
    } catch(e) {
      postMessage({ type: "log", payload: "ERROR loading OpenCascade WASM: " + e.message });
      throw e;
    }
  }

  /** Preload the various fonts available via Text3D. */
  _loadFonts(opentype) {
    const fontBase = typeof ESBUILD !== 'undefined' ? './fonts/' : '../../fonts/';
    const preloadedFonts = [
      fontBase + 'Roboto.ttf',
      fontBase + 'Papyrus.ttf',
      fontBase + 'Consolas.ttf',
      fontBase + 'LiberationSans-Regular.ttf',
      fontBase + 'FreeSans.ttf',
      fontBase + 'FreeSansBold.ttf',
      fontBase + 'FreeSansOblique.ttf',
      fontBase + 'FreeSansBoldOblique.ttf'
    ];
    self.loadedFonts = {};
    self.fontKernPairs = {};
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
      setTimeout(() => {
        e.message = "Line " + self.currentLineNumber + ": " + self.currentOp + "() encountered  " + e.message;
        throw e;
      }, 0);
    } finally {
      this._finishEvaluation();
    }
  }

  /** Run user Python through Brython (bootstrapped on first use). Never
   *  rejects: Python errors are re-thrown asynchronously so they surface on
   *  the main thread exactly like JS-mode evaluation errors. */
  async _evaluatePython(payload) {
    try {
      const runtime = await ensurePythonRuntime(payload.pyRuntime);
      runtime.run(payload.code);
    } catch (e) {
      setTimeout(() => { throw e; }, 0);
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
    postMessage({
      type: "modelHistory",
      payload: self.modelHistory.map((step, i) => ({
        index: i,
        fnName: step.fnName,
        lineNumber: step.lineNumber,
        shapeCount: step.shapeCount,
      }))
    });

    postMessage({ type: "log", payload: "Cache: " + self.cacheHits + " hits, " + self.cacheMisses + " misses" });
    postMessage({ type: "resetWorking" });
    // Clean cache; remove unused objects
    let usedHashes = this.standardLibrary.utils.usedHashes;
    for (let hash in self.argCache) {
      if (!usedHashes.hasOwnProperty(hash)) { delete self.argCache[hash]; }
    }
    for (let key in usedHashes) { delete usedHashes[key]; }
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

  /** Synchronous meshing of the accumulated sceneShapes. */
  _combineAndRenderShapes(payload) {
    let oc = self.oc;
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
    postMessage({ "type": "Progress", "payload": { "opNumber": self.opNumber++, "opType": "Combining Shapes" } });

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
      postMessage({ "type": "Progress", "payload": { "opNumber": self.opNumber++, "opType": "Triangulating Faces" } });
      let facesAndEdges = self.ShapeToMesh(self.currentShape,
        payload.maxDeviation || 0.1, fullShapeEdgeHashes, fullShapeFaceHashes,
        faceHashToShapeIndex, edgeHashToShapeIndex);
      self.sceneShapes = [];
      postMessage({ "type": "Progress", "payload": { "opNumber": self.opNumber, "opType": "" } });
      return [facesAndEdges, payload.sceneOptions, shapeLines];
    } else {
      console.error("There were no scene shapes returned!");
    }
    postMessage({ "type": "Progress", "payload": { "opNumber": self.opNumber, "opType": "" } });
  }

  /** Triangulate and return the shapes from a specific modeling history step.
   *  Called on-demand when the user scrubs the timeline. */
  meshHistoryStep(payload) {
    let step = self.modelHistory[payload.stepIndex];
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
    return facesAndEdges;
  }
}

// Bootstrap the worker
const worker = new CascadeStudioWorker();
worker.init();

export { CascadeStudioWorker };
