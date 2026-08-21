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
  // parameter expects; embind does not. ITERATIVELY wrap whichever arg
  // matches the Handle_X each conversion error names — multi-handle calls
  // (BRepBuilderAPI_MakeEdge(curve2d, surface)) need several rounds. The
  // target arg is picked by class-chain match on the handle's inner type,
  // falling back to the first wrappable raw transient.
  const mkHandle = (handleName, a) => {
    for (const suffix of ['_2', '_3']) {
      const H = oc[handleName + suffix];
      if (!H) { continue; }
      try { return new H(a); } catch (e) { /* next */ }
    }
    return null;
  };
  const retryWithHandle = (fn, thisArg, args, firstHandle) => {
    const cur = args.slice();
    let handleName = firstHandle;
    for (let round = 0; round <= args.length; round++) {
      const inner = handleName.slice(7);
      let idx = -1, blind = -1;
      for (let i = 0; i < cur.length; i++) {
        const a = cur[i];
        if (!isEmbind(a)) { continue; }
        const cn = String(a.constructor.name);
        if (cn.lastIndexOf('Handle_', 0) === 0) { continue; }
        if (chainHas(normCls(cn), inner)) { idx = i; break; }
        if (blind === -1) { blind = i; }
      }
      if (idx === -1) { idx = blind; }
      if (idx === -1) { return null; }
      const h = mkHandle(handleName, cur[idx]);
      if (!h) { return null; }
      cur[idx] = h;
      try {
        return { done: true, value: fn.apply(thisArg, cur) };
      } catch (e) {
        const msg = (e && e.message) ? String(e.message) : String(e);
        const hm = /Expected null or instance of (Handle_\w+)/.exec(msg);
        if (!hm) { return null; }
        handleName = hm[1];
      }
    }
    return null;
  };

  // ------------------------------------------------------------------ //
  // Pinned dispatch (see gen-ocp-shim.mjs). Build-time classification    //
  // per (class, method, arity): {d} direct-pinned js name, or {c:[...]}  //
  // candidates carrying coarse-type sigs matched DECISIVELY at runtime.  //
  // A tie REFUSES with the candidate list — the dispatcher never guesses //
  // (the BRepGProp_Face_1 bool-coercion incident is the reason).         //
  // ------------------------------------------------------------------ //

  // enum member object -> enum type name (embind members are identity-
  // stable singletons, so a Map keyed on them is exact)
  const enumMap = new Map();
  for (const [en, members] of Object.entries(table.enums || {})) {
    const e = oc[en];
    if (!e) { continue; }
    for (const m of members) {
      if (e[m] !== undefined) { enumMap.set(e[m], en); }
    }
  }

  // runtime coarse kind of an argument (tags shared with the generator)
  const argKind = (a) => {
    if (a === null || a === undefined) { return '0'; }
    const t = typeof a;
    if (t === 'boolean') { return 'b'; }
    if (t === 'number') { return 'n'; }
    if (t === 'string') { return 's'; }
    if (Array.isArray(a)) { return 'a'; }
    if (t === 'object') {
      const en = enumMap.get(a);
      if (en) { return 'e:' + en; }
      if (a.$$ !== undefined && a.constructor) {
        return 'c:' + normCls(a.constructor.name);
      }
    }
    return 'o';
  };

  const chainCache = new Map();
  const chainHas = (cls, target) => {
    if (cls === target) { return true; }
    let chain = chainCache.get(cls);
    if (!chain) {
      chain = [];
      let c = cls;
      const seen = new Set();
      while (c && !seen.has(c)) {
        chain.push(c);
        seen.add(c);
        const t = table.classes[c];
        c = t ? t.parent : null;
      }
      chainCache.set(cls, chain);
    }
    return chain.indexOf(target) !== -1;
  };

  // score of one arg against one coarse param tag; 0 = incompatible
  const posScore = (kind, want) => {
    if (want === '?') { return 1; }
    const w0 = want.charCodeAt(0);
    if (w0 === 98 /* b */) { return kind === 'b' ? 3 : 0; }
    if (w0 === 110 /* n */) { return kind === 'n' ? 3 : (kind === 'b' ? 1 : 0); }
    if (w0 === 115 /* s */) { return kind === 's' ? 3 : 0; }
    if (w0 === 101 /* e */) { return kind === want ? 3 : 0; }
    // 'c:X' class param
    if (kind === '0' || kind === 'o') { return 1; }
    if (kind.charCodeAt(0) !== 99 /* c */) { return 0; }
    const target = want.slice(2), have = kind.slice(2);
    if (have === target) { return 4; }
    if (chainHas(have, target)) { return 3; }
    // raw transient where a handle is expected: pybind wraps implicitly
    if (target.lastIndexOf('Handle_', 0) === 0 && chainHas(have, target.slice(7))) {
      return 2;
    }
    return 0;
  };

  // pick ONE candidate or refuse. Returns {cand} | {tie:[js...]} | null.
  const matchCands = (cands, args, kinds) => {
    let best = null, bestScore = -1, tie = false;
    for (const c of cands) {
      const sig = c.s;
      if (!sig || sig.length !== args.length) { continue; }
      let sc = 0, ok = true;
      for (let i = 0; i < args.length; i++) {
        const p = posScore(kinds[i], sig[i]);
        if (!p) { ok = false; break; }
        sc += p;
      }
      if (!ok) { continue; }
      if (sc > bestScore) { best = c; bestScore = sc; tie = false; }
      else if (sc === bestScore) { tie = true; }
    }
    if (tie) {
      return { tie: cands.filter((c) => c.s && c.s.length === args.length)
        .map((c) => c.js + '(' + c.s.join(',') + ')') };
    }
    return best ? { cand: best } : null;
  };

  const CONV_ERR = /Cannot pass|Expected null or instance|argument count|BindingError|reading '\$\$'|function \w+ called with|unbound types/i;

  // invoke a pinned/matched variant: pre-wrap raw transients into the
  // Handle_X the sig declares, surface OCCT raises, and report embind
  // conversion errors as CONTINUE (the next argSet may fill defaults)
  const invoke = (fn, thisArg, args, sig) => {
    let callArgs = args;
    if (sig) {
      for (let i = 0; i < args.length; i++) {
        const want = sig[i];
        if (!want || want.charCodeAt(0) !== 99) { continue; }
        const target = want.slice(2);
        if (target.lastIndexOf('Handle_', 0) !== 0) { continue; }
        const a = args[i];
        if (!isEmbind(a) || a.constructor.name.lastIndexOf('Handle_', 0) === 0) { continue; }
        const H = oc[target + '_2'] || oc[target + '_3'];
        if (!H) { continue; }
        try {
          if (callArgs === args) { callArgs = args.slice(); }
          callArgs[i] = new H(a);
        } catch (e) { /* leave raw; embind will report */ }
      }
    }
    try {
      return { done: true, value: fn.apply(thisArg, callArgs) };
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : String(e);
      const hm = /Expected null or instance of (Handle_\w+)/.exec(msg);
      if (hm) {
        const r = retryWithHandle(fn, thisArg, callArgs, hm[1]);
        if (r) { return r; }
      }
      if (typeof e !== 'number' && CONV_ERR.test(msg)) {
        return { done: false, err: e };
      }
      throw e;
    }
  };

  // table-driven dispatch over completed argument sets.
  //   getFn(js) resolves a variant name to a callable (ctor/static/method).
  //   A score TIE is RETURNED (not thrown): the caller may still have
  //   lazily-built default-fill argument sets to try; it throws refuseTie
  //   only once every phase is exhausted.
  const refuseTie = (label, tieInfo) => {
    throw new Error('ocp_shim: ambiguous overload ' + label + '/'
      + tieInfo.arity + ' — runtime arg types [' + tieInfo.kinds.join(', ')
      + '] do not decide between [' + tieInfo.cands.join(' | ')
      + ']; refusing to guess');
  };
  const runDispatch = (dispatch, getFn, thisArg, argSets, label) => {
    if (!dispatch) { return { done: false }; }
    let lastErr = null, tieInfo = null;
    for (const args of argSets) {
      if (args === null) { continue; }
      const e = dispatch[args.length];
      if (!e) { continue; }
      if (e.d) {
        // even a single-variant pin must TYPE-CHECK before calling: embind
        // COERCES (a face passed to a bool param is silently truthy and
        // crashes inside wasm) and pybind may serve this arity through a
        // different overload's defaults — the next argSet is the fill
        if (e.s) {
          let ok = true;
          for (let i = 0; i < args.length; i++) {
            if (!posScore(argKind(args[i]), e.s[i])) { ok = false; break; }
          }
          if (!ok) { continue; }
        }
        const fn = getFn(e.d);
        if (typeof fn !== 'function') { continue; }
        const r = invoke(fn, thisArg, args, e.s);
        if (r.done) { return r; }
        lastErr = r.err;
        continue;
      }
      const kinds = args.map(argKind);
      if (e.k) {
        const hit = e.k[kinds.join(',')];
        if (hit) {
          const fn = getFn(hit);
          if (typeof fn === 'function') {
            const r = invoke(fn, thisArg, args, null);
            if (r.done) { return r; }
            lastErr = r.err;
            continue;
          }
        }
      }
      const m = matchCands(e.c, args, kinds);
      if (m && m.tie) {
        tieInfo = { arity: args.length, kinds, cands: m.tie };
        continue;
      }
      if (m && m.cand) {
        const fn = getFn(m.cand.js);
        if (typeof fn !== 'function') { continue; }
        const r = invoke(fn, thisArg, args, m.cand.s);
        if (r.done) { return r; }
        lastErr = r.err;
      }
    }
    return { done: false, err: lastErr, tie: tieInfo };
  };

  // legacy try-in-order path — ONLY for candidates the table has no coarse
  // sigs for (hand-registered surface: TopoDS_Cast, OCJS_Out, arrays,
  // handles) and for classes outside the generated closure entirely.
  const tryCall = (fns, thisArg, argSets) => {
    let lastErr = null;
    for (const args of argSets) {
      if (args === null) { continue; }
      for (const fn of fns) {
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
          if (typeof e !== 'number' && CONV_ERR.test(msg)) {
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
  // constructor.name 'Cls_N'; normalize to the base class. The suffix is
  // stripped even when the base is outside the table (no real OCCT class
  // name ends in _<digits>) so posScore can exact-match param classes the
  // closure never listed.
  const normCls = (name) => {
    if (!name || table.classes[name]) { return name; }
    const m = /^(.*)_\d+$/.exec(name);
    return m ? m[1] : name;
  };

  // ---- glue: out-param methods pybind serves as tuple returns ---------- //
  const GLUE = {
    // PENDING_FORK_BINDING(optional-exactness: OCJS_Out.BRepTool_Range):
    // the adaptor reports the same range; a helper would skip the alloc
    'BRep_Tool.Range': (args) => {
      const a = new oc.BRepAdaptor_Curve_2(args[0]);
      return [a.FirstParameter(), a.LastParameter()];
    },
    // PENDING_FORK_BINDING(optional-exactness: OCJS_Out.BRepTools_UVBounds):
    // pybind UVBounds_s(face) -> (umin, umax, vmin, vmax); the bound
    // BRepAdaptor_Surface (restriction=true) reports the same bounds
    'BRepTools.UVBounds': (args) => {
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
    // pybind Parameter(Index) has a plain float-returning overload; the
    // embind Parameter_1 IS that overload (the tuple form is Parameter_2)
    'Geom2dAPI_ProjectPointOnCurve.Parameter': (args, ref) =>
      ref.Parameter_1(args[0]),
  };
  // The Geom2dGcc Tangency family: pybind Tangency{1,2,3}(Index, PntSol)
  // -> (ParSol, ParArg), MUTATING the caller's PntSol. The fork's OCJS_Out
  // helpers return {parSol, parArg, x, y}; the raw gp_Pnt2d the caller
  // passed is shared with its Python proxy, so SetX/SetY IS the pybind
  // mutation.
  const TANGENCY_HELPERS = {
    'Geom2dGcc_Circ2d2TanRad.Tangency1': 'Circ2d2TanRad_Tangency1',
    'Geom2dGcc_Circ2d2TanRad.Tangency2': 'Circ2d2TanRad_Tangency2',
    'Geom2dGcc_Circ2d2TanOn.Tangency1': 'Circ2d2TanOn_Tangency1',
    'Geom2dGcc_Circ2d2TanOn.Tangency2': 'Circ2d2TanOn_Tangency2',
    'Geom2dGcc_Circ2d3Tan.Tangency1': 'Circ2d3Tan_Tangency1',
    'Geom2dGcc_Circ2d3Tan.Tangency2': 'Circ2d3Tan_Tangency2',
    'Geom2dGcc_Circ2d3Tan.Tangency3': 'Circ2d3Tan_Tangency3',
    'Geom2dGcc_Circ2dTanCen.Tangency1': 'Circ2dTanCen_Tangency1',
    'Geom2dGcc_Circ2dTanOnRad.Tangency1': 'Circ2dTanOnRad_Tangency1',
    'Geom2dGcc_Lin2dTanObl.Tangency1': 'Lin2dTanObl_Tangency1',
  };
  for (const [key, helper] of Object.entries(TANGENCY_HELPERS)) {
    GLUE[key] = (args, ref) => {
      const rec = oc.OCJS_Out[helper](ref, args[0]);
      const pnt = args[1];
      if (pnt && typeof pnt.SetX === 'function') {
        pnt.SetX(rec.x);
        pnt.SetY(rec.y);
      }
      return [rec.parSol, rec.parArg];
    };
  }
  // out-param cases with NO helper bound yet (the fork round adds them —
  // integration is `grep PENDING_FORK_BINDING`):
  const PENDING_FORK = {
    'BRep_Tool.CurveOnSurface':
      'OCJS_Out.BRepTool_CurveOnSurface(edge, face) -> {curve2d, first, last}',
    'GProp_GProps.StaticMoments':
      'OCJS_Out.GProp_StaticMoments(props) -> {ix, iy, iz}',
    'BRepExtrema_DistShapeShape.ParOnEdgeS1':
      'OCJS_Out.BRepExtrema_ParOnEdgeS1(dss, i) -> {t}',
    'BRepExtrema_DistShapeShape.ParOnEdgeS2':
      'OCJS_Out.BRepExtrema_ParOnEdgeS2(dss, i) -> {t}',
    'GeomAPI_ExtremaCurveCurve.Parameters':
      'OCJS_Out.GeomAPI_ExtremaCurveCurve_Parameters(ecc, i) -> {u1, u2}',
  };
  for (const [key, ask] of Object.entries(PENDING_FORK)) {
    GLUE[key] = () => {
      throw new Error('ocp_shim: PENDING_FORK_BINDING(' + key + ') — needs '
        + ask);
    };
  }
  // ---- glue that MUTATES caller arguments (pybind by-ref TopoDS out-  ---- //
  // params; served through the _csOcpCallMut protocol: the Python side
  // rebinds the passed proxies' _ref). Returns [ret, i1, new1, i2, new2...].
  const GLUE_MUT = {
    'ChFi2d_FilletAlgo.Result': (args, ref) => {
      // pybind Result(thePoint, theEdge1, theEdge2, iSolution=-1) -> Edge
      const out = oc.OCJS_Out.FilletAlgo_Result(ref, args[0]);
      return [out.fillet, 1, out.trimmed1, 2, out.trimmed2];
    },
  };

  // shared two-phase dispatch: raw args first (no allocation), then the
  // lazily-built pybind default-fills + version-drift progress pads
  const dispatchPhases = (dispatch, getFn, thisArg, args, kwargs, pybind,
    variants, label) => {
    const hasKw = kwargs && Object.keys(kwargs).length;
    let r = hasKw ? { done: false }
      : runDispatch(dispatch, getFn, thisArg, [args], label);
    if (r.done) { return r; }
    const tie1 = r.tie;
    const err1 = r.err;
    const sets = fillDefaults(args, kwargs, pybind);
    const pad = padProgress(args, variants);
    if (pad) { sets.push(pad); }
    for (const f of sets.slice()) {
      const p = padProgress(f, variants);
      if (p) { sets.push(p); }
    }
    r = runDispatch(dispatch, getFn, thisArg, sets, label);
    if (r.done) { return r; }
    return { done: false, err: r.err || err1, tie: r.tie || tie1,
      sets: [hasKw ? null : args, ...sets] };
  };

  self._csOcpNew = function (cls, args, kwargs) {
    kwargs = normKw(kwargs);
    const t = tableClass(cls);
    // 1. pinned dispatch (build-time resolved; refuses on ambiguity)
    let r = dispatchPhases(t && t.cdispatch, ocCtor, null, args, kwargs,
      t && t.pyctor, t && t.ctors, cls + '.__init__');
    if (r.done) { return r.value; }
    const sets = r.sets || [args];
    const tieInfo = r.tie;
    let lastErr = r.err;
    // 2. legacy try-in-order — ONLY unknown-sig variants / unlisted classes
    const cands = [];
    if (t) {
      for (const c of t.ctors) {
        if (c.params) { continue; } // typed: dispatch already decided
        cands.push({ fn: ocCtor(c.js), arity: null, params: null });
      }
    } else {
      if (oc[cls]) { cands.push({ fn: ocCtor(cls), arity: null }); }
      for (let i = 1; i <= 9; i++) {
        if (oc[cls + '_' + i]) { cands.push({ fn: ocCtor(cls + '_' + i), arity: null }); }
      }
    }
    if (cands.length) {
      r = tryCall(cands, null, sets);
      if (r.done) { return r.value; }
      lastErr = r.err || lastErr;
    }
    if (tieInfo) { refuseTie(cls + '.__init__', tieInfo); }
    throw lastErr || new Error('ocp_shim: no matching constructor ' + cls +
      '/' + args.length + ' (arg kinds: [' + args.map(argKind).join(', ')
      + '])');
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
    // 1. pinned dispatch
    let r = dispatchPhases(m && m.dispatch, (js) => holder[js], holder,
      args, kwargs, m && m.pybind, m && m.variants, cls + '.' + name);
    if (r.done) { return deref(r.value); }
    const sets = r.sets || [args];
    const tieInfo = r.tie;
    let lastErr = r.err;
    // 2. legacy try-in-order for unknown-sig variants / unlisted methods
    const cands = [];
    if (m) {
      for (const v of m.variants) {
        if (!v.static || v.params) { continue; }
        cands.push({ fn: holder[v.js], arity: null, params: null });
      }
    } else {
      if (typeof holder[name] === 'function') { cands.push({ fn: holder[name], arity: null }); }
      for (let i = 1; i <= 9; i++) {
        if (typeof holder[name + '_' + i] === 'function') {
          cands.push({ fn: holder[name + '_' + i], arity: null });
        }
      }
    }
    if (cands.length) {
      r = tryCall(cands, holder, sets);
      if (r.done) { return deref(r.value); }
      lastErr = r.err || lastErr;
    }
    if (tieInfo) { refuseTie(cls + '.' + name, tieInfo); }
    throw lastErr || new Error('ocp_shim: no matching static ' + cls + '.' +
      name + '/' + args.length);
  };

  // (constructor.name, method) -> {m, mcls, glue} — the per-call class-
  // chain walk and GLUE lookups happen ONCE per (class, method) pair
  const resolveCache = new Map();
  const resolveMethod = (cn0, name) => {
    const key = cn0 + '.' + name;
    let res = resolveCache.get(key);
    if (res !== undefined) { return res; }
    let cn = normCls(cn0), m = null, mcls = null;
    while (cn) {
      const t = tableClass(cn);
      if (t && t.methods[name]) { m = t.methods[name]; mcls = cn; break; }
      cn = t ? t.parent : null;
    }
    const glue = (mcls && GLUE[mcls + '.' + name]) || GLUE[cn0 + '.' + name]
      || GLUE[normCls(cn0) + '.' + name] || null;
    res = { m, mcls, glue };
    resolveCache.set(key, res);
    return res;
  };

  self._csOcpCall = function (ref, name, args, kwargs) {
    kwargs = normKw(kwargs);
    if (!ref) { throw new Error('ocp_shim: method ' + name + ' on null ref'); }
    const cn0 = (ref.constructor && ref.constructor.name) || '?';
    const { m, mcls, glue } = resolveMethod(cn0, name);
    if (glue) { return glue(args, ref); }
    if (m && m.tuple_ret) {
      throw new Error('ocp_shim: out-param method needs glue: ' +
        (mcls || cn0) + '.' + name);
    }
    // 1. pinned dispatch
    let r = dispatchPhases(m && m.dispatch, (js) => ref[js], ref, args,
      kwargs, m && m.pybind, m && m.variants, (mcls || cn0) + '.' + name);
    if (r.done) { return deref(r.value); }
    const sets = r.sets || [args];
    const tieInfo = r.tie;
    let lastErr = r.err;
    // 2. legacy try-in-order for unknown-sig variants / unlisted methods
    const knownJs = new Set();
    if (m) {
      for (const v of m.variants) { if (v.params) { knownJs.add(v.js); } }
    }
    const cands = [];
    if (typeof ref[name] === 'function' && !knownJs.has(name)) {
      cands.push({ fn: ref[name], arity: null, params: null });
    }
    for (let i = 1; i <= 9; i++) {
      const js = name + '_' + i;
      if (typeof ref[js] === 'function' && !knownJs.has(js)) {
        cands.push({ fn: ref[js], arity: null, params: null });
      }
    }
    if (!cands.length && !m) {
      throw new Error('ocp_shim: no method ' + name + ' on ' +
        (ref.constructor ? ref.constructor.name : typeof ref));
    }
    if (cands.length) {
      r = tryCall(cands, ref, sets);
      if (r.done) { return deref(r.value); }
      lastErr = r.err || lastErr;
    }
    if (tieInfo) { refuseTie((mcls || cn0) + '.' + name, tieInfo); }
    const base = 'ocp_shim: no matching overload ' + name + '/' + args.length
      + ' on ' + cn0
      + ' (pinned dispatch: ' + (m && m.dispatch ? 'yes' : 'no')
      + ', pybind: ' + (m ? 'yes' : 'no') + ')';
    throw new Error(lastErr ? base + ' — last: ' + (lastErr.message || lastErr)
      : base);
  };

  /** Methods whose pybind form MUTATES class-typed args by reference
   *  (TopoDS_Edge out-params). The Python proxy layer routes calls to
   *  method names in GLUE_MUT here; the return is a flat array
   *  [ret, i1, new1, i2, new2, ...] and ocp_core rebinds args[i]._ref.
   *  Falls back to the normal call when the receiver's class has no
   *  mut-glue (e.g. ShapeFix_Face.Result is a plain getter). */
  self._csOcpCallMut = function (ref, name, args, kwargs) {
    let cn = normCls(ref && ref.constructor && ref.constructor.name);
    while (cn) {
      const g = GLUE_MUT[cn + '.' + name];
      if (g) { return g(args, ref); }
      const t = tableClass(cn);
      cn = t ? t.parent : null;
    }
    return [self._csOcpCall(ref, name, args, kwargs)];
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
