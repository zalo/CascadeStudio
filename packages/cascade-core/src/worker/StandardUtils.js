// Miscellaneous Helper Functions used in the Standard Library

import { csEmit } from './Emit.js';

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

    // Stable cross-run cache (opt-in: self._csStableCache — see _stableHash).
    // Object -> content-derived key, for every CacheOp result and every
    // shape whose identity was DERIVED from keyed inputs (deriveStableKey).
    this._stableKeys = new WeakMap();
    // Object -> [fnName, inputs] for shapes DERIVED from other shapes
    // (sub-shapes, compounds); the key is computed only if the shape is
    // ever used as an op argument.
    this._derivations = new WeakMap();
    // OCJS.HashCode -> Set of argCache keys, so a fresh wrapper of a cached
    // result (a TopoDS downcast) can be recognised by IsEqual.
    this._stableIndex = new Map();
    this._volatileSeq = 0;
    this.volatileOps = 0;
    this.volatileReasons = {};

    // Expose instance and methods on self for eval() access
    self.argCache = this.argCache;
    self.usedHashes = this.usedHashes;
    self.opNumber = this.opNumber;
    self.modelHistory = this.modelHistory;
    self.CacheOp = this.CacheOp.bind(this);
    self.recordExternalOp = this.recordExternalOp.bind(this);
    self.CheckCache = this.CheckCache.bind(this);
    self.AddToCache = this.AddToCache.bind(this);
    self.ComputeHash = this.ComputeHash.bind(this);
    self.deriveStableKey = this.deriveStableKey.bind(this);
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
    self.isOCCTThrow = CascadeStudioUtils.isOCCTThrow;
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
    csEmit({ "type": "Progress", "payload": { "opNumber": this.opNumber++, "opType": fnName } });
    self.opNumber = this.opNumber;

    let toReturn = null;
    let curHash = this.ComputeHash(args, false, fnName);
    // Stable mode: an op whose inputs have no content-derived identity
    // (ComputeHash returned null) is computed every time and never cached —
    // it gets a per-run tag, so everything downstream of it is volatile too.
    const volatileOp = curHash === null;
    if (volatileOp) {
      curHash = 'v' + (++this._volatileSeq);
      this.volatileOps++;
    } else {
      this.usedHashes[curHash] = curHash;
    }

    let check = volatileOp ? null : this.CheckCache(curHash);
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
        if (typeof e === 'string' || CascadeStudioUtils.isOCCTThrow(e)) {
          throw new Error("INTERNAL OPENCASCADE ERROR in " + fnName + ": " +
            CascadeStudioUtils.describeOCCTException(e));
        }
        throw e;
      }
      // A cacheMiss that produced nothing used to blow up on the next line
      // with "Cannot set properties of undefined (setting 'hash')" — a
      // message that says nothing about which operation gave up or why (it
      // was how a missing FreeSansBold surfaced in the Cloudflare worker).
      // Every such path has already logged its own console.error; name the
      // operation and the line so the log and the exception line up.
      if (toReturn === null || toReturn === undefined) {
        throw new Error(fnName + " produced no shape (line "
          + this.currentLineNumber + ") — see the error logged above it.");
      }
      toReturn.hash = curHash;
      if (self.GUIState["Cache?"] && !volatileOp) { this.AddToCache(curHash, toReturn); }
      // (a volatile op is counted in volatileOps, not as a miss)
      if (!volatileOp) { this.cacheMisses = (this.cacheMisses || 0) + 1; }
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

    csEmit({ "type": "Progress", "payload": { "opNumber": this.opNumber, "opType": null } });
    return toReturn;
  }

  /** History bookkeeping for geometry-producing operations that do NOT go
   *  through CacheOp — the pytopo=upstream OCP shim calls this when a
   *  BRepPrimAPI/BRepAlgoAPI/... operation class is constructed (see
   *  OcpShim.js). Mirrors CacheOp's history/progress protocol (fnName +
   *  Python user line) without the cache. */
  recordExternalOp(fnName) {
    this.flushHistoryStep();
    // Op boundary: safe point to delete embind objects whose Python proxies
    // died (see OcpShim.js "deterministic embind lifetime").
    if (self._csOcpFlushFrees) { self._csOcpFlushFrees(); }
    this.currentOp = fnName;
    self.currentOp = fnName;
    this.currentLineNumber =
      (self.evalLanguage === 'python' && self.getPythonUserLine)
        ? self.getPythonUserLine() : 0;
    self.currentLineNumber = this.currentLineNumber;
    csEmit({ "type": "Progress", "payload": { "opNumber": this.opNumber++, "opType": fnName } });
    self.opNumber = this.opNumber;
    this._pendingHistoryOp = { fnName, lineNumber: this.currentLineNumber };
    csEmit({ "type": "Progress", "payload": { "opNumber": this.opNumber, "opType": null } });
    return this.currentLineNumber;
  }

  /** Flush the pending history step by snapshotting the current sceneShapes.
   *  Called at the start of each CacheOp (to capture the previous op's result)
   *  and after eval() completes (to capture the final op's result).
   *  Metadata (volume, surfaceArea) is deferred to avoid O(n²) cost during eval. */
  flushHistoryStep() {
    if (this._pendingHistoryOp) {
      // Low-memory mode keeps the step METADATA but drops the shape refs:
      // a heavy run's history otherwise pins O(steps x scene) shape wrappers
      // (heat_exchanger: 1049 steps pinning 107k refs), which blocks the
      // deterministic embind frees. screenshotHistoryStep degrades
      // gracefully (meshHistoryStep returns null with a console note).
      this.modelHistory.push({
        fnName: this._pendingHistoryOp.fnName,
        lineNumber: this._pendingHistoryOp.lineNumber,
        shapes: self._csLowMemory ? [] : [...self.sceneShapes],
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
    if (self._csStableCache) { this._indexStable(hash, shape); }
    return hash;
  }

  // ------------------------------------------------------------------ //
  // Stable cross-run op cache (opt-in: self._csStableCache).            //
  //                                                                     //
  // The legacy keys are a 32-bit hash of the arguments in which a shape //
  // appears as its `.hash` — and for any shape no CacheOp produced, as  //
  // OCJS.HashCode, i.e. its kernel ADDRESS. Within one run that is      //
  // fine; across runs a freed address is reused by a different shape    //
  // and the key collides, which is why the Python runtimes empty the    //
  // cache before every run. A long-lived host (a Durable Object editing //
  // session) needs the opposite, so in stable mode:                     //
  //   * a key is 'k' + a ~106-bit hash of the op name and its JSON args //
  //     (no 32-bit collisions in practice);                             //
  //   * a shape argument contributes ONLY a content-derived identity:   //
  //     the key of the CacheOp that produced it (by object identity),   //
  //     a key DERIVED from keyed inputs (deriveStableKey — compounds),  //
  //     or the key of a cached result it IsEqual()s (a fresh wrapper of //
  //     the same TShape/location/orientation, e.g. a TopoDS downcast);  //
  //   * any other shape, embind object, function or class instance     //
  //     makes the op VOLATILE: computed, never cached, and its result   //
  //     poisons everything downstream (so no address ever reaches a    //
  //     key).                                                           //
  // The keys are deterministic across isolates for the same library     //
  // build, which is what lets a host persist the cached working set    //
  // (headless.js snapshotCache/restoreCache).                           //
  // ------------------------------------------------------------------ //

  /** Stable-mode ComputeHash: the key, or null for a volatile op. With
   *  `raw`, the canonical string the key is hashed from (null if volatile). */
  _stableHash(args, raw, fnName) {
    let volatile = null;
    const utils = this;
    let str;
    try {
      str = JSON.stringify(args, function (key, value) {
        if (value === null) { return value; }
        const t = typeof value;
        if (t === 'number') { return CascadeStudioUtils._keyNumber(value); }
        if (t === 'function' || t === 'symbol' || t === 'bigint') {
          volatile = volatile || t;
          return '#?';
        }
        if (t !== 'object') { return value; }
        const k = utils.stableKeyOf(value);
        if (k) { return { '#': k }; }
        if (Array.isArray(value)) { return value; }
        if (value.$$ !== undefined) {
          volatile = volatile || ('unkeyed ' + CascadeStudioUtils._typeName(value));
          return '#?';
        }
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
          volatile = volatile || ('opaque ' + CascadeStudioUtils._typeName(value));
          return '#?';
        }
        return value;
      });
    } catch (e) {
      volatile = 'unserializable';
    }
    if (volatile) {
      const why = (fnName || '?') + ': ' + volatile;
      this.volatileReasons[why] = (this.volatileReasons[why] || 0) + 1;
      return null;
    }
    const canonical = (fnName || '') + str;
    return raw ? canonical : 'k' + CascadeStudioUtils.strongHash(canonical);
  }

  /** The content-derived key of a shape (or cached array) argument, or
   *  null when it has none. */
  stableKeyOf(value) {
    const known = this._stableKeys.get(value);
    if (known !== undefined) { return known; }
    const derivation = this._derivations.get(value);
    if (derivation) {
      this._derivations.delete(value);
      const k = this._stableHash(derivation[1], false, 'derived:' + derivation[0]);
      if (k) { this._stableKeys.set(value, k); return k; }
    }
    if (value.$$ === undefined || typeof value.ShapeType !== 'function') { return null; }
    const oc = self.oc;
    let hc;
    try { hc = oc.OCJS.HashCode(value, 2147483647); } catch (e) { return null; }
    const keys = this._stableIndex.get(hc);
    if (!keys) { return null; }
    for (const k of keys) {
      const c = this.argCache[k];
      if (!c || c.$$ === undefined || typeof c.IsEqual !== 'function') { continue; }
      try {
        // same TShape, location AND orientation
        if (c.IsEqual(value)) {
          this._stableKeys.set(value, k);
          return k;
        }
      } catch (e) { /* a dead wrapper: not a match */ }
    }
    return null;
  }

  /** Record that `shape` (built outside CacheOp: a compound, a sub-shape
   *  picked out of a keyed shape by an explorer) is a pure function of
   *  `inputs`, so it can be keyed as `derived:<fnName>` of their keys if it
   *  is ever an op argument. A no-op outside stable mode. */
  deriveStableKey(shape, fnName, inputs) {
    if (!self._csStableCache || !shape || typeof shape !== 'object') { return; }
    if (!this._stableKeys.has(shape)) { this._derivations.set(shape, [fnName, inputs]); }
  }

  _indexStable(hash, value) {
    this._stableKeys.set(value, hash);
    if (value.$$ === undefined || typeof value.ShapeType !== 'function') { return; }
    let hc;
    try { hc = self.oc.OCJS.HashCode(value, 2147483647); } catch (e) { return; }
    let set = this._stableIndex.get(hc);
    if (!set) { set = new Set(); this._stableIndex.set(hc, set); }
    set.add(hash);
  }

  /** Drop index entries whose cache entry is gone (after the end-of-run
   *  sweep), or everything (after a kernel reset). */
  pruneStableIndex(all) {
    if (all) { this._stableIndex.clear(); return; }
    for (const [hc, set] of this._stableIndex) {
      for (const k of set) { if (this.argCache[k] === undefined) { set.delete(k); } }
      if (set.size === 0) { this._stableIndex.delete(hc); }
    }
  }

  /** A number as it enters a stable key: 12 significant digits, and
   *  |v| < 1e-10 snapped to 0. Arguments computed from geometry carry
   *  round-off that depends on HOW a transform was composed — a restored
   *  snapshot's locations come back through gp_Trsf::SetValues, which
   *  re-derives scale and form, so a face normal reads (1.1e-16, 1,
   *  -2.2e-16) instead of (2.2e-16, 1, -1.1e-16) and an exact key would miss
   *  (din_rail_algebra: 42 misses after a restore). Both thresholds sit far
   *  below OCCT's own confusion tolerance (1e-7) and far above round-off;
   *  a real edit moves values by more. */
  static _keyNumber(v) {
    if (!Number.isFinite(v)) { return String(v); }
    if (Number.isInteger(v)) { return v; }
    if (Math.abs(v) < 1e-10) { return 0; }
    return Number(v.toPrecision(12));
  }

  static _typeName(v) {
    try {
      if (v.$$ && v.$$.ptrType && v.$$.ptrType.registeredClass) {
        return v.$$.ptrType.registeredClass.name;
      }
      return (v.constructor && v.constructor.name) || 'object';
    } catch (e) { return 'object'; }
  }

  /** ~106-bit string hash: two cyrb53 lanes with different seeds, hex. */
  static strongHash(str) {
    const lane = (seed) => {
      let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (2097152 * (h2 >>> 0) + (h1 >>> 0)).toString(16).padStart(14, '0');
    };
    return lane(0) + lane(0x9e3779b9);
  }

  /** This function computes a 32-bit integer hash given a set of `arguments`.
   * If `raw` is true, the raw set of sanitized arguments will be returned instead.
   * @param {string} fnName - The calling function's name */
  ComputeHash(args, raw, fnName) {
    if (self._csStableCache) { return this._stableHash(args, raw, fnName); }
    // A TopoDS argument that no CacheOp produced (an explorer sub-shape, a
    // JS helper's fresh result) carries no `.hash`; stripped of its "ptr" it
    // would stringify like EVERY other such shape and collide in the cache
    // (two different splines mirrored through one cached result). Key such
    // shapes by their live TShape+Location identity instead.
    let argsString = JSON.stringify(args, (key, value) => {
      if (value && typeof value === 'object' && value.$$ !== undefined &&
          value.hash === undefined && typeof value.ShapeType === 'function' &&
          self.oc && self.oc.OCJS) {
        try {
          return { tshape: self.oc.OCJS.HashCode(value, 2147483647),
                   type: value.ShapeType().value };
        } catch (e) { return value; }
      }
      return value;
    });
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
    // Native wasm exceptions (an OCCT build linked with -fwasm-exceptions):
    // the throw reaches JS as a WebAssembly.Exception, not a number, and
    // its payload is only reachable through the C++ tag. Such a build must
    // also be linked with -sEXPORT_EXCEPTION_HANDLING_HELPERS, which gives
    // the module `getExceptionMessage(ex) -> [type, what()]` —
    // Standard_Failure::what() IS the OCCT message.
    if (CascadeStudioUtils._isWasmException(e)) {
      // Bracket access on purpose: these helpers are OPTIONAL module
      // members, and generate-occt-symbols.cjs would otherwise list them
      // among the symbols every build must have.
      const mod = self.oc || {};
      const getMessage = mod['getExceptionMessage'];
      const release = mod['decrementExceptionRefcount'];
      if (typeof getMessage !== 'function') { return null; }
      try {
        const info = getMessage(e);
        const message = CascadeStudioUtils._plausibleOCCTText(info && info[1]);
        // The exception object is refcounted on the C++ side; a throw that
        // ends in JS is never caught again, so release it.
        try { if (typeof release === 'function') { release(e); } }
        catch (refErr) { /* best effort */ }
        return message === null ? null : { message };
      } catch (decodeError) { return null; }
    }
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

  /** Is this caught value a C++ throw out of the OCCT kernel? A raw NUMBER
   *  (the thrown pointer) under Emscripten's JS-emulated exceptions — the
   *  shipping build — or a WebAssembly.Exception under native wasm EH. */
  static isOCCTThrow(e) {
    return typeof e === 'number' || CascadeStudioUtils._isWasmException(e);
  }

  static _isWasmException(e) {
    return typeof WebAssembly !== 'undefined'
      && typeof WebAssembly.Exception === 'function'
      && e instanceof WebAssembly.Exception;
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
      try {
        return el.hash !== objectToRemove.hash ||
               el.ptr  !== objectToRemove.ptr;
      } catch (e) {
        // a foreign entry (e.g. a PyProxy) whose property trap RAISES must
        // not abort the whole evaluation — keep it (it is not the target)
        return true;
      }
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
