// Miscellaneous Helper Functions used in the Standard Library

/** Utility class for caching, hashing, and misc helper functions used by the CAD worker. */
class CascadeStudioUtils {
  constructor() {
    this.argCache = {};
    this.usedHashes = {};
    this.opNumber = 0;
    this.currentOp = '';
    this.currentLineNumber = 0;

    // Modeling history timeline: records sceneShapes state after each operation.
    // Uses a "capture-on-next-call" pattern: when CacheOp fires for op N,
    // it snapshots sceneShapes (which reflects the state after op N-1 completed).
    // The final state is captured after eval() completes.
    this.modelHistory = [];
    this._pendingHistoryOp = null; // {fnName, lineNumber} of the op that just ran

    // Expose instance and methods on self for eval() access
    self.argCache = this.argCache;
    self.usedHashes = this.usedHashes;
    self.opNumber = this.opNumber;
    self.modelHistory = this.modelHistory;
    self.CacheOp = this.CacheOp.bind(this);
    self.CheckCache = this.CheckCache.bind(this);
    self.AddToCache = this.AddToCache.bind(this);
    self.ComputeHash = this.ComputeHash.bind(this);
    self.flushHistoryStep = this.flushHistoryStep.bind(this);
    self.recursiveTraverse = CascadeStudioUtils.recursiveTraverse;
    self.Remove = CascadeStudioUtils.Remove;
    self.isArrayLike = CascadeStudioUtils.isArrayLike;
    self.getCallingLocation = CascadeStudioUtils.getCallingLocation;
    self.convertToPnt = CascadeStudioUtils.convertToPnt;
    self.stringToHash = CascadeStudioUtils.stringToHash;
    self.CantorPairing = CascadeStudioUtils.CantorPairing;
    self.decodeOCCTException = CascadeStudioUtils.decodeOCCTException;
    self.describeOCCTException = CascadeStudioUtils.describeOCCTException;
  }

  /** Hashes input arguments and checks the cache for that hash.
   * It returns a copy of the cached object if it exists, but will
   * call the `cacheMiss()` callback otherwise. The result will be
   * added to the cache if `GUIState["Cache?"]` is true.
   * @param {IArguments} args - The function's arguments object
   * @param {string} fnName - The calling function's name (required since
   *   arguments.callee is not available in strict mode / ES modules)
   * @param {Function} cacheMiss - Callback if cache miss */
  CacheOp(args, fnName, cacheMiss) {
    // Capture the sceneShapes state left by the PREVIOUS operation.
    // At this point, the previous op has finished mutating sceneShapes,
    // so [...self.sceneShapes] is the correct post-op snapshot.
    this.flushHistoryStep();

    this.currentOp = fnName;
    self.currentOp = this.currentOp;
    // getCallingLocation() parses JS eval stack frames, which is meaningless
    // for Brython-generated code — Python mode resolves the user's source
    // line from Brython's frame chain instead (see PythonRuntime.js).
    this.currentLineNumber = (self.evalLanguage === 'python')
      ? (self.getPythonUserLine ? self.getPythonUserLine() : 0)
      : CascadeStudioUtils.getCallingLocation()[0];
    self.currentLineNumber = this.currentLineNumber;
    postMessage({ "type": "Progress", "payload": { "opNumber": this.opNumber++, "opType": fnName } });
    self.opNumber = this.opNumber;

    let toReturn = null;
    let curHash = this.ComputeHash(args, false, fnName);
    this.usedHashes[curHash] = curHash;

    let check = this.CheckCache(curHash);
    if (check && self.GUIState["Cache?"]) {
      toReturn = check;
      toReturn.hash = check.hash;
      this.cacheHits = (this.cacheHits || 0) + 1;
    } else {
      try {
        toReturn = cacheMiss();
      } catch (e) {
        // Emscripten-compiled OCCT throws raw NUMBERS (C++ exception
        // pointers) on kernel aborts. Brython cannot attach a traceback to
        // a primitive ("Cannot create property '__traceback__' on number"),
        // which masks the real failure — normalize to a proper Error here,
        // DECODING the pointer back into OCCT's own message first.
        if (typeof e === 'number' || typeof e === 'string') {
          throw new Error("INTERNAL OPENCASCADE ERROR in " + fnName + ": " +
            CascadeStudioUtils.describeOCCTException(e));
        }
        throw e;
      }
      toReturn.hash = curHash;
      if (self.GUIState["Cache?"]) { this.AddToCache(curHash, toReturn); }
      this.cacheMisses = (this.cacheMisses || 0) + 1;
    }
    // Tag the shape with the 1-based editor line that produced it so the
    // main thread can map picked shapes back to their source line.
    // (Refreshed on every call, including cache hits, since the same cached
    //  shape may be produced from a different line after edits.)
    if (toReturn && typeof toReturn === 'object') {
      toReturn.producingLine = this.currentLineNumber;
    }
    self.cacheHits = this.cacheHits;
    self.cacheMisses = this.cacheMisses;

    // Record this op so the NEXT CacheOp call (or flushHistoryStep) can snapshot its result
    this._pendingHistoryOp = { fnName, lineNumber: this.currentLineNumber };

    postMessage({ "type": "Progress", "payload": { "opNumber": this.opNumber, "opType": null } });
    return toReturn;
  }

  /** Flush the pending history step by snapshotting the current sceneShapes.
   *  Called at the start of each CacheOp (to capture the previous op's result)
   *  and after eval() completes (to capture the final op's result).
   *  Metadata (volume, surfaceArea) is deferred to avoid O(n²) cost during eval. */
  flushHistoryStep() {
    if (this._pendingHistoryOp) {
      this.modelHistory.push({
        fnName: this._pendingHistoryOp.fnName,
        lineNumber: this._pendingHistoryOp.lineNumber,
        shapes: [...self.sceneShapes],
        shapeCount: self.sceneShapes.length,
      });
      self.modelHistory = this.modelHistory;
      this._pendingHistoryOp = null;
    }
  }

  /** Returns the cached object if it exists, or null otherwise. */
  CheckCache(hash) { return this.argCache[hash] || null; }

  /** Adds this `shape` to the cache, indexable by `hash`. */
  AddToCache(hash, shape) {
    shape.hash = hash;
    this.argCache[hash] = shape;
    return hash;
  }

  /** This function computes a 32-bit integer hash given a set of `arguments`.
   * If `raw` is true, the raw set of sanitized arguments will be returned instead.
   * @param {string} fnName - The calling function's name */
  ComputeHash(args, raw, fnName) {
    let argsString = JSON.stringify(args);
    argsString = argsString.replace(/(\"ptr\"\:(-?[0-9]*?)\,)/g, '');
    argsString = argsString.replace(/(\"ptr\"\:(-?[0-9]*))/g, '');
    if (argsString.includes("ptr")) { console.error("YOU DONE MESSED UP YOUR REGEX."); }
    let hashString = (fnName || '') + argsString;
    if (raw) { return hashString; }
    return CascadeStudioUtils.stringToHash(hashString);
  }

  // --- Static utility methods (no instance state needed) ---

  /** Decode a RAW wasm exception into the message OpenCascade actually raised.
   *
   *  Emscripten-compiled OCCT throws C++ exceptions as raw NUMBERS: the value
   *  is a pointer to the thrown object in wasm linear memory. Everything OCCT
   *  raises derives from `Standard_Failure`, whose layout is stable and small
   *  (Standard_Failure.hxx, OCCT 8.0.1):
   *
   *      class Standard_Failure : public std::exception {   // vtable only
   *        StringRef* myMessage;      // +4
   *        StringRef* myStackTrace;   // +8
   *      };
   *      struct StringRef { int Counter; char Message[1]; };  // text at +4
   *
   *  so the message is the NUL-terminated string at `*(ptr + 4) + 4`.
   *
   *  Reading it by hand is a substitution, not a preference:
   *  COMPROMISE(failure-decode) — the fork binds
   *  `OCJS::getStandard_FailureData(intptr_t) -> Standard_Failure*`
   *  (builds/cascadestudio.yml) for exactly this purpose, but calling it in
   *  this build raises "Cannot call OCJS.getStandard_FailureData due to
   *  unbound types: St9exception": Standard_Failure derives from
   *  std::exception, which the build never registers, so embind treats the
   *  whole type as unresolved. The module also exports no runtime helpers
   *  (HEAPU8 / getValue / UTF8ToString are all absent), so the wasm Memory is
   *  captured at instantiation instead (CascadeWorker's `instantiateWasm`).
   *
   *  Returns `{ message }` on success, or null when the value cannot be
   *  decoded — an Emscripten abort ("memory access out of bounds") arrives as
   *  a RuntimeError rather than a number, a non-OCCT C++ throw has a different
   *  layout, and either way the caller must fall back to the raw value.
   *
   *  @param {*} e - the caught value
   *  @returns {{message: string}|null} */
  static decodeOCCTException(e) {
    // Only integral pointer-shaped values can be exception pointers.
    if (typeof e !== 'number' || !Number.isInteger(e) || e <= 0) { return null; }
    const memory = self.ocMemory;
    if (!memory || !memory.buffer) { return null; }
    try {
      // Views must be rebuilt per call: growing the wasm memory detaches the
      // previous ArrayBuffer.
      const u32 = new Uint32Array(memory.buffer);
      const u8 = new Uint8Array(memory.buffer);
      if (e + 12 > u8.length || (e & 3) !== 0) { return null; }
      const stringRef = u32[(e >> 2) + 1];        // myMessage
      if (!stringRef || stringRef + 8 > u8.length) { return null; }
      let text = '';
      for (let i = stringRef + 4; i < u8.length && u8[i] !== 0; i++) {
        if (text.length >= 512) { return null; } // not a message: bail out
        text += String.fromCharCode(u8[i]);
      }
      const message = CascadeStudioUtils._plausibleOCCTText(text);
      return message === null ? null : { message };
    } catch (decodeError) {
      return null; // undecodable: the caller reports the raw value
    }
  }

  /** Accept only short, printable, non-empty text as a decoded OCCT message
   *  (a mis-decoded pointer yields control characters or binary noise). */
  static _plausibleOCCTText(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 512) { return null; }
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(value)) { return null; }
    return value.trim() === '' ? null : value.trim();
  }

  /** Human-readable one-liner for any caught kernel value: OCCT's own message
   *  when the throw was a Standard_Failure pointer, else the raw value. Used
   *  by every worker error path so users see real diagnostics. */
  static describeOCCTException(e) {
    const decoded = CascadeStudioUtils.decodeOCCTException(e);
    if (decoded) {
      return "the OCCT kernel raised '" + decoded.message + "'";
    }
    if (e && typeof e === 'object' && e.message) { return String(e.message); }
    return "the OCCT kernel threw '" + e + "' (a raw wasm exception carrying " +
      "no readable message — most likely an Emscripten abort rather than a " +
      "Standard_Failure)";
  }

  /** This function recursively traverses x and calls `callback()` on each subelement. */
  static recursiveTraverse(x, callback) {
    if (Object.prototype.toString.call(x) === '[object Array]') {
      x.forEach(function (x1) {
        CascadeStudioUtils.recursiveTraverse(x1, callback);
      });
    } else if ((typeof x === 'object') && (x !== null)) {
      if (x.HashCode) {
        callback(x);
      } else {
        for (let key in x) {
          if (x.hasOwnProperty(key)) {
            CascadeStudioUtils.recursiveTraverse(x[key], callback);
          }
        }
      }
    } else {
      callback(x);
    }
  }

  /** This function returns a version of the `inputArray` without the `objectToRemove`. */
  static Remove(inputArray, objectToRemove) {
    return inputArray.filter((el) => {
      return el.hash !== objectToRemove.hash ||
             el.ptr  !== objectToRemove.ptr;
    });
  }

  /** This function returns true if item is indexable like an array. */
  static isArrayLike(item) {
    return (
      Array.isArray(item) ||
      (!!item &&
        typeof item === "object" &&
        item.hasOwnProperty("length") &&
        typeof item.length === "number" &&
        item.length > 0 &&
        (item.length - 1) in item
      )
    );
  }

  /** Mega Brittle Line Number Finding algorithm for Handle Backpropagation;
   * only works in Chrome and FF. */
  static getCallingLocation() {
    let errorStack = (new Error).stack;
    let lineAndColumn = [0, 0];

    let matchingString = ", <anonymous>:";
    if (navigator.userAgent.includes("Chrom")) {
      matchingString = ", <anonymous>:";
    } else if (navigator.userAgent.includes("Moz")) {
      matchingString = "eval:";
    } else {
      lineAndColumn[0] = "-1";
      lineAndColumn[1] = "-1";
      return lineAndColumn;
    }

    errorStack.split("\n").forEach((line) => {
      if (line.includes(matchingString)) {
        lineAndColumn = line.split(matchingString)[1].split(':');
      }
    });
    lineAndColumn[0] = parseFloat(lineAndColumn[0]);
    lineAndColumn[1] = parseFloat(lineAndColumn[1]);

    return lineAndColumn;
  }

  /** This function converts either single dimensional
   * array or a gp_Pnt to a gp_Pnt. */
  static convertToPnt(pnt) {
    let point = pnt;
    if (point.length) {
      point = new self.oc.gp_Pnt_3(point[0], point[1], (point[2]) ? point[2] : 0);
    }
    return point;
  }

  /** This function converts a string to a 32bit integer. */
  static stringToHash(string) {
    let hash = 0;
    if (string.length == 0) return hash;
    for (let i = 0; i < string.length; i++) {
      let char = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  static CantorPairing(x, y) {
    return ((x + y) * (x + y + 1)) / 2 + y;
  }
}

export { CascadeStudioUtils };
