// OcpShim.js — JS side of the OCP-over-embind adapter (the upstream-topology
// spike). Installs the guarded dispatch surface the generated Python proxy
// layer (upstream-py/ocp_shim/) calls through the browser bridge:
//
//   _csOcpNew(cls, args)          construct (ctor-overload classes Cls_N)
//   _csOcpStatic(cls, name, args) static call (embind statics, _N suffixes)
//   _csOcpCall(ref, name, args)   instance call (probes name / name_N)
//   _csOcpEnum(enum, member)      enum member object (identity-stable)
//   _csOcpKind/Parent/Item/Len    wrap()-support queries
//
// pybind-parity implemented here:
//  * overload resolution: exact-arity candidates first (in _N order), then
//    variants whose pybind signature has DEFAULTS for the missing tail
//    (embind has no default args — the tail is filled from the table);
//    embind BindingErrors during a candidate call fall through to the next
//  * returned Handle_* auto-deref: null handle -> null (pybind: None),
//    else .get() (embind downcasts to the most-derived registered class)
//  * tuple-returning out-param methods route through GLUE (OCJS_Out helpers
//    or bound alternatives) and return JS arrays
//
// NOTE: callers run this inside the _csMpCall guard (browser bridge), so any
// throw here surfaces as a Python exception, never a raw wasm unwind.

export function installOcpShim(self, table) {
  const oc = self.oc;
  const normKw = (kwargs) => {
    if (!kwargs) { return null; }
    if (kwargs instanceof Map) {
      const o = {};
      for (const [k, v] of kwargs) { o[k] = v; }
      return o;
    }
    return kwargs;
  };
  const keepAlive = []; // handles whose .get() results are live

  const isEmbind = (v) => v && typeof v === 'object' && v.constructor &&
    typeof v.constructor.name === 'string' && v.$$ !== undefined;

  const deref = (v) => {
    if (!isEmbind(v)) { return v; }
    const cn = v.constructor.name;
    if (cn.startsWith('Handle_')) {
      if (typeof v.IsNull === 'function' && v.IsNull()) { return null; }
      if (typeof v.get === 'function') {
        keepAlive.push(v);
        return v.get();
      }
    }
    return v;
  };

  // Fresh default-construct a class instance (the Message_ProgressRange
  // pattern all over OCCT 7.5+; pybind object-valued defaults).
  const ctor0 = (cn) => {
    const t = table.classes[cn];
    if (t) {
      const zero = t.ctors.find((c) => c.params && c.params.length === 0);
      if (zero && oc[zero.js]) { return { v: new oc[zero.js]() }; }
    }
    for (const js of [cn + '_1', cn]) {
      if (oc[js]) {
        try { return { v: new oc[js]() }; } catch (e) { /* fall */ }
      }
    }
    return { miss: true };
  };

  // The defaults dump carries EXPLICIT encodings (dump_ocp_defaults.py):
  // dflt_lit (JSON literal), dflt_enum ([Enum, Member, int]),
  // dflt_ctor0 (class to fresh-construct). No repr-string guessing here.
  const resolveDefault = (p) => {
    if (p.dflt_enum) {
      const [en, mem] = p.dflt_enum;
      const e = oc[en] && oc[en][mem];
      return e === undefined ? { miss: true } : { v: e };
    }
    if (Object.prototype.hasOwnProperty.call(p, 'dflt_lit')) {
      return { v: p.dflt_lit };
    }
    if (p.dflt_ctor0) { return ctor0(p.dflt_ctor0); }
    return { miss: true };
  };

  const fillDefaults = (args, kwargs, pySig) => {
    // pybind-style completion: positional args + kwargs by name + declared
    // defaults. Returns ONE completed positional array PER matching pybind
    // signature (type-fit ordering in tryCall picks the right overload).
    if (!pySig) { return []; }
    const kw = kwargs || {};
    const kwNames = Object.keys(kw);
    const fills = [];
    for (const sig of pySig) {
      const ps = sig.params;
      if (ps.length < args.length) { continue; }
      const sigNames = new Set(ps.map((p) => p.name));
      if (!kwNames.every((k) => sigNames.has(k))) { continue; }
      let ok = true;
      const out = args.slice();
      for (let i = args.length; i < ps.length; i++) {
        const p = ps[i];
        if (p.name && Object.prototype.hasOwnProperty.call(kw, p.name)) {
          out.push(kw[p.name]);
          continue;
        }
        const r = resolveDefault(p);
        if (r.miss) { ok = false; break; }
        out.push(r.v);
      }
      if (ok && out.length === ps.length &&
          !fills.some((f) => f.length === out.length)) {
        fills.push(out);
      }
    }
    return fills;
  };

  // OCCT 7.x (pybind reference) -> 8.0.1 (this wasm) drift: many methods
  // grew a trailing Message_ProgressRange param. Pad it when the d.ts
  // variant expects exactly that.
  const padProgress = (args, variants) => {
    for (const v of variants || []) {
      const ps = v.params;
      if (!ps || ps.length <= args.length) { continue; }
      const extra = ps.slice(args.length);
      if (extra.every((t) => String(t).indexOf('Message_ProgressRange') !== -1)) {
        return args.concat(extra.map(() => new oc.Message_ProgressRange_1()));
      }
    }
    return null;
  };

  // pybind implicitly wraps a raw Standard_Transient into the handle<T> a
  // parameter expects; embind does not. When a candidate fails with
  // "Expected ... Handle_X", retry with each object arg wrapped in that
  // handle class (ocjs convention: Handle_X_2 is the from-pointer ctor).
  const retryWithHandle = (fn, thisArg, args, handleName) => {
    for (const suffix of ['_2', '_3']) {
      const H = oc[handleName + suffix];
      if (!H) { continue; }
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!isEmbind(a) || String(a.constructor.name).startsWith('Handle_')) { continue; }
        let h;
        try { h = new H(a); } catch (e) { continue; }
        const swapped = args.slice();
        swapped[i] = h;
        try {
          return { done: true, value: fn.apply(thisArg, swapped) };
        } catch (e) { /* keep looking */ }
      }
    }
    return null;
  };

  // d.ts-type-aware argument matching: embind coerces (an object passed to
  // a bool param is silently truthy), so same-arity overloads MUST be
  // ordered by type fit before calling (BRepGProp_Face_1(bool) vs
  // _2(face, bool) was the motivating crash).
  const typeFit = (arg, t) => {
    if (t === null || t === undefined || t === 'any' || t === '') { return 0; }
    const ts = String(t);
    if (/Standard_Boolean|^bool/.test(ts)) {
      return typeof arg === 'boolean' ? 1 : -1;
    }
    if (/Standard_(Real|Integer|ShortReal|Size)|^(int|double|float)/.test(ts)) {
      return typeof arg === 'number' ? 1 : -1;
    }
    if (/Standard_C(haracter|String)|^string|XCAFDoc_PartId|TCollection_/.test(ts)) {
      return typeof arg === 'string' ? 1 : (typeof arg === 'object' ? 0 : -1);
    }
    // class-typed param
    if (arg === null || arg === undefined) { return 0; }
    return (typeof arg === 'object') ? 1 : -1;
  };
  const candScore = (cand, args) => {
    if (!cand.params || cand.params.length !== args.length) { return 0; }
    let score = 0;
    for (let i = 0; i < args.length; i++) {
      const f = typeFit(args[i], cand.params[i]);
      if (f < 0) { return -1; }
      score += f;
    }
    return score + 1;
  };

  const tryCall = (fns, thisArg, argSets) => {
    let lastErr = null;
    for (const args of argSets) {
      if (args === null) { continue; }
      const ordered = fns
        .map((fn) => ({ fn, score: candScore(fn, args) }))
        .filter((c) => c.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((c) => c.fn);
      for (const fn of ordered) {
        if (typeof fn.fn !== 'function') { continue; }
        if (fn.arity !== undefined && fn.arity !== null &&
            fn.arity !== args.length) { continue; }
        try {
          return { done: true, value: fn.fn.apply(thisArg, args) };
        } catch (e) {
          // embind arg-conversion errors -> try the next candidate;
          // anything else (an OCCT raise, a number) is REAL
          const msg = (e && e.message) ? String(e.message) : String(e);
          const hm = /Expected null or instance of (Handle_\w+)/.exec(msg);
          if (hm) {
            const r = retryWithHandle(fn.fn, thisArg, args, hm[1]);
            if (r) { return r; }
          }
          if (typeof e !== 'number' && /Cannot pass|Expected null or instance|argument count|BindingError|reading '\$\$'|function \w+ called with/i.test(msg)) {
            lastErr = e;
            continue;
          }
          throw e;
        }
      }
    }
    return { done: false, err: lastErr };
  };

  const tableClass = (name) => (table.classes[name] || null);
  // embind instances built via ctor-overload subclasses report
  // constructor.name 'Cls_N'; normalize to the registered base class
  const normCls = (name) => {
    if (!name || table.classes[name]) { return name; }
    const m = /^(.*)_\d+$/.exec(name);
    return (m && table.classes[m[1]]) ? m[1] : name;
  };

  // ---- glue: out-param methods pybind serves as tuple returns ---------- //
  const GLUE = {
    'BRep_Tool.Range': (args) => {
      const a = new oc.BRepAdaptor_Curve_2(args[0]);
      return [a.FirstParameter(), a.LastParameter()];
    },
    'BRepTools.UVBounds': (args) => {
      // pybind UVBounds_s(face) -> (umin, umax, vmin, vmax); the bound
      // BRepAdaptor_Surface (restriction=true) reports the same bounds
      const s = new oc.BRepAdaptor_Surface_2(args[0], true);
      return [s.FirstUParameter(), s.LastUParameter(),
        s.FirstVParameter(), s.LastVParameter()];
    },
    'Bnd_Box.Get': (args, ref) => {
      const mn = ref.CornerMin(), mx = ref.CornerMax();
      return [mn.X(), mn.Y(), mn.Z(), mx.X(), mx.Y(), mx.Z()];
    },
    'GeomAPI_ProjectPointOnSurf.LowerDistanceParameters': (args, ref) => {
      const uv = oc.OCJS_Out.ProjectPointOnSurf_LowerDistanceParameters(ref);
      return [uv.u, uv.v];
    },
    'GeomAPI_ProjectPointOnSurf.Parameters': (args, ref) => {
      const uv = oc.OCJS_Out.ProjectPointOnSurf_Parameters(ref, args[0]);
      return [uv.u, uv.v];
    },
  };

  self._csOcpNew = function (cls, args, kwargs) {
    kwargs = normKw(kwargs);
    const t = tableClass(cls);
    const cands = [];
    if (t) {
      for (const c of t.ctors) {
        cands.push({ fn: ocCtor(c.js), arity: c.params ? c.params.length : null,
          params: c.params });
      }
    }
    // fallback probing: Cls / Cls_1..Cls_9
    if (!cands.length) {
      if (oc[cls]) { cands.push({ fn: ocCtor(cls), arity: null }); }
      for (let i = 1; i <= 9; i++) {
        if (oc[cls + '_' + i]) { cands.push({ fn: ocCtor(cls + '_' + i), arity: null }); }
      }
    }
    const fills = fillDefaults(args, kwargs, t && t.pyctor);
    const sets = [(kwargs && Object.keys(kwargs).length) ? null : args, ...fills];
    sets.push(padProgress(args, t && t.ctors));
    for (const f of fills) { sets.push(padProgress(f, t && t.ctors)); }
    const r = tryCall(cands, null, sets);
    if (!r.done) {
      throw r.err || new Error('ocp_shim: no matching constructor ' + cls +
        '/' + args.length);
    }
    return r.value;
  };
  const ocCtor = (jsName) => {
    const C = oc[jsName];
    if (!C) { return undefined; }
    return function (...a) { return new C(...a); };
  };

  self._csOcpStatic = function (cls, name, args, kwargs) {
    kwargs = normKw(kwargs);
    // walk the table chain for the method (statics are on the class itself
    // in embind, but keep parent-walk for safety)
    let cn = cls, m = null;
    while (cn) {
      const t = tableClass(cn);
      if (t && t.methods[name]) { m = t.methods[name]; break; }
      cn = t ? t.parent : null;
    }
    const g = GLUE[cls + '.' + name];
    if (g) { return g(args, null); }
    if (m && m.tuple_ret) {
      throw new Error('ocp_shim: out-param method needs glue: ' + cls + '.' + name);
    }
    const holder = oc[cls];
    if (!holder) { throw new Error('ocp_shim: class not bound: ' + cls); }
    const cands = [];
    if (m) {
      for (const v of m.variants) {
        if (!v.static) { continue; }
        cands.push({ fn: holder[v.js], arity: v.params ? v.params.length : null,
          params: v.params });
      }
    }
    if (!cands.length) {
      if (typeof holder[name] === 'function') { cands.push({ fn: holder[name], arity: null }); }
      for (let i = 1; i <= 9; i++) {
        if (typeof holder[name + '_' + i] === 'function') {
          cands.push({ fn: holder[name + '_' + i], arity: null });
        }
      }
    }
    const sFills = fillDefaults(args, kwargs, m && m.pybind);
    const sets = [(kwargs && Object.keys(kwargs).length) ? null : args, ...sFills];
    sets.push(padProgress(args, m && m.variants));
    for (const f of sFills) { sets.push(padProgress(f, m && m.variants)); }
    const r = tryCall(cands, holder, sets);
    if (!r.done) {
      throw r.err || new Error('ocp_shim: no matching static ' + cls + '.' +
        name + '/' + args.length);
    }
    return deref(r.value);
  };

  self._csOcpCall = function (ref, name, args, kwargs) {
    kwargs = normKw(kwargs);
    if (!ref) { throw new Error('ocp_shim: method ' + name + ' on null ref'); }
    // table lookup via the object's own (most-derived) class chain
    let cn = normCls(ref.constructor && ref.constructor.name), m = null, mcls = null;
    while (cn) {
      const t = tableClass(cn);
      if (t && t.methods[name]) { m = t.methods[name]; mcls = cn; break; }
      cn = t ? t.parent : (cn = null);
    }
    const g = mcls && GLUE[mcls + '.' + name];
    if (g) { return g(args, ref); }
    // generic glue lookup by any table ancestor failed: check direct name
    if (!g) {
      const g2 = GLUE[(ref.constructor && ref.constructor.name) + '.' + name];
      if (g2) { return g2(args, ref); }
    }
    if (m && m.tuple_ret && !g) {
      throw new Error('ocp_shim: out-param method needs glue: ' +
        (mcls || ref.constructor.name) + '.' + name);
    }
    const vparams = {};
    if (m) { for (const v of m.variants) { vparams[v.js] = v.params; } }
    const cands = [];
    if (typeof ref[name] === 'function') {
      cands.push({ fn: ref[name], arity: null, params: vparams[name] || null });
    }
    for (let i = 1; i <= 9; i++) {
      if (typeof ref[name + '_' + i] === 'function') {
        cands.push({ fn: ref[name + '_' + i], arity: null,
          params: vparams[name + '_' + i] || null });
      }
    }
    if (!cands.length) {
      throw new Error('ocp_shim: no method ' + name + ' on ' +
        (ref.constructor ? ref.constructor.name : typeof ref));
    }
    // arity hints from the table improve candidate ordering
    if (m) {
      const order = {};
      m.variants.forEach((v, i) => { order[v.js] = i; });
      cands.sort((a, b) => (order[a.fn.name] || 0) - (order[b.fn.name] || 0));
    }
    const cFills = fillDefaults(args, kwargs, m && m.pybind);
    const sets = [(kwargs && Object.keys(kwargs).length) ? null : args, ...cFills];
    sets.push(padProgress(args, m && m.variants));
    for (const f of cFills) { sets.push(padProgress(f, m && m.variants)); }
    const r = tryCall(cands, ref, sets);
    if (!r.done) {
      const base = 'ocp_shim: no matching overload ' + name + '/' + args.length
        + ' on ' + (ref.constructor && ref.constructor.name)
        + ' (candidates: ' + cands.length + ', pybind: ' + (m ? 'yes' : 'no') + ')';
      throw new Error(r.err ? base + ' — last: ' + (r.err.message || r.err) : base);
    }
    return deref(r.value);
  };

  self._csOcpEnum = function (en, member) {
    const e = oc[en];
    if (!e || e[member] === undefined) {
      throw new Error('ocp_shim: enum member not bound: ' + en + '.' + member);
    }
    return e[member];
  };

  self._csOcpKind = function (v) {
    if (Array.isArray(v)) { return 'array'; }
    if (isEmbind(v)) { return normCls(v.constructor.name); }
    return 'plain';
  };
  self._csOcpParent = function (name) {
    const t = tableClass(name);
    return (t && t.parent) || null;
  };
  self._csOcpItem = function (v, i) { return deref(v[i]); };
  self._csOcpLen = function (v) { return v.length; };
}
