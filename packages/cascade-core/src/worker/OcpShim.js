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

  const isEmbind = (v) => {
    // guarded: a Python-object PyProxy raises AttributeError from inside
    // its attribute trap when probed for '$$' (e.g. a Vector reaching a
    // dispatch arg through a user error) — report "not embind", never throw
    try {
      return v && typeof v === 'object' && v.constructor &&
        typeof v.constructor.name === 'string' && v.$$ !== undefined;
    } catch (e) { return false; }
  };

  const deref = (v) => {
    if (!isEmbind(v)) { return v; }
    const cn = v.constructor.name;
    if (cn.startsWith('Handle_')) {
      if (typeof v.IsNull === 'function' && v.IsNull()) { return null; }
      // Handle_Geom_BSplineSurface: the fork binds AsGeomSurface for
      // EXACTLY this — .get() on the surface handle is unsafe in this
      // build (see CLAUDE.md make_surface_from_array_of_points note)
      if (typeof v.AsGeomSurface === 'function') {
        keepAlive.push(v);
        return v.AsGeomSurface();
      }
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
      if (isEmbind(a)) {
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
  // The OCJS_Out helpers below landed in fork 05d088d (the FORK-ASKS round).
  const GLUE = {
    // exact helper; accepts pybind's (E) and (E, F) forms
    'BRep_Tool.Range': (args) => {
      const r = oc.OCJS_Out.BRepTool_Range.apply(oc.OCJS_Out, args);
      return [r.first, r.last];
    },
    'BRepTools.UVBounds': (args) => {
      const r = oc.OCJS_Out.BRepTools_UVBounds(args[0]);
      return [r.umin, r.umax, r.vmin, r.vmax];
    },
    // pybind CurveOnSurface_s(E, F, First, Last[, theIsStored]) returns the
    // pcurve (the float args are value-passed dummies; upstream reads the
    // range from Range_s) — the helper also reports first/last for the
    // 2-arg convenience form
    'BRep_Tool.CurveOnSurface': (args, ref) => {
      const r = oc.OCJS_Out.BRepTool_CurveOnSurface(args[0], args[1]);
      return deref(r.curve2d);
    },
    'GProp_GProps.StaticMoments': (args, ref) => {
      const r = oc.OCJS_Out.GProp_StaticMoments(ref);
      return [r.ix, r.iy, r.iz];
    },
    'GProp_PrincipalProps.Moments': (args, ref) => {
      const r = oc.OCJS_Out.PrincipalProps_Moments(ref);
      return [r.ixx, r.iyy, r.izz];
    },
    'BRepExtrema_DistShapeShape.ParOnEdgeS2': (args, ref) => {
      const r = oc.OCJS_Out.BRepExtrema_ParOnEdgeS2(ref, args[0]);
      return [r.t];
    },
    'GeomAPI_ExtremaCurveCurve.Parameters': (args, ref) => {
      const r = oc.OCJS_Out.GeomAPI_ExtremaCurveCurve_Parameters(ref, args[0]);
      return [r.u1, r.u2];
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
    // The BRepAlgoAPI base-chain hand binding exposes SetArguments/SetTools/
    // Build/Shape but not the BOPAlgo_Options setters:
    //  * SetRunParallel — EXACT no-op (this wasm build is single-threaded)
    //  * SetFuzzyValue / SetNonDestructive — COMPROMISE(fuzzy-value): the
    //    setters are unbound, so booleans run at OCCT's default fuzzy
    //    (Precision::Confusion) where upstream requests one (Compound.__add__
    //    passes TOLERANCE=1e-6; Shape.fuse(tol=...)). Candidate fork ask.
    'BRepAlgoAPI_Algo.SetRunParallel': () => undefined,
    'BRepAlgoAPI_Algo.SetFuzzyValue': () => undefined,
    'BRepAlgoAPI_BuilderAlgo.SetNonDestructive': () => undefined,
    // pybind ConnectEdgesToWires(edges, tol, shared, wires&) REASSIGNS the
    // out-HANDLE to a fresh sequence; embind passes a handle copy, so the
    // caller's sequence stays empty. Route through the RETURNING overload
    // (ConnectEdgesToWires_1) and Append into the caller's sequence.
    'ShapeAnalysis_FreeBounds.ConnectEdgesToWires': (args) => {
      let edges = args[0];
      if (isEmbind(edges) &&
          String(edges.constructor.name).lastIndexOf('Handle_', 0) !== 0) {
        edges = new oc.Handle_TopTools_HSequenceOfShape_2(edges);
      }
      const res = oc.ShapeAnalysis_FreeBounds.ConnectEdgesToWires_1(
        edges, args[1], args[2]);
      const out = deref(res);
      if (args.length !== 4) { return out; }
      if (out && typeof out.Length === 'function') {
        for (let i = 1; i <= out.Length(); i++) { args[3].Append(out.Value(i)); }
      }
      return undefined;
    },
    // pybind GetEulerAngles(seq) -> (alpha, beta, gamma); the embind variant
    // value-passes the three Standard_Real& outs. Extracted from the bound
    // rotation matrix instead. build123d calls ONLY gp_Intrinsic_XYZ
    // (Location.orientation / Location.to_tuple): R = Rx(a)·Ry(b)·Rz(g),
    // validated against SetEulerAngles round-trips in topo-poc.
    'gp_Quaternion.GetEulerAngles': (args, ref) => {
      if (args[0] !== oc.gp_EulerSequence.gp_Intrinsic_XYZ) {
        throw new Error('ocp_shim: GetEulerAngles glue supports '
          + 'gp_Intrinsic_XYZ only (build123d uses no other sequence)');
      }
      const m = ref.GetMatrix();
      const r11 = m.Value(1, 1), r12 = m.Value(1, 2), r13 = m.Value(1, 3);
      const r23 = m.Value(2, 3), r33 = m.Value(3, 3);
      const beta = Math.atan2(r13, Math.sqrt(r11 * r11 + r12 * r12));
      const alpha = Math.atan2(-r23, r33);
      const gamma = Math.atan2(-r12, r11);
      return [alpha, beta, gamma];
    },
  };
  // ---- COMPROMISE(quantity-color): Quantity_Color did not survive the
  // fork build (its NCollection_Vec3 ctor is unbound and the whole class
  // was dropped — only Quantity_ColorRGBA + the enums exist). geometry.py's
  // Color rides on it, so the shim serves a PLAIN-JS stand-in carrying the
  // rgb channels; Quantity_ColorRGBA construction maps onto the bound
  // _5(r,g,b,a) form and GetRGB returns the tracked stand-in. Candidate
  // fork ask: bind Quantity_Color (skip the Vec3 ctor).
  const mkFakeQC = (r, g, b) => ({
    _csQC: 1, _r: r, _g: g, _b: b,
    Red: () => r, Green: () => g, Blue: () => b,
    Values: () => [r, g, b],
    IsEqual: (o) => !!(o && o._csQC && o._r === r && o._g === g && o._b === b),
  });
  const rgbaChannels = new WeakMap();
  GLUE['Quantity_ColorRGBA.GetRGB'] = (args, ref) => {
    const c = rgbaChannels.get(ref);
    return c ? mkFakeQC(c[0], c[1], c[2]) : mkFakeQC(0, 0, 0);
  };
  GLUE['Quantity_Color.ColorFromName'] = () => false; // webcolors shim covers CSS3

  // the hand-bound IndexedDataMap has FindKey/FindFromIndex but no Extent —
  // count by probing (fork ask: bind Extent/Size)
  GLUE['TopTools_IndexedDataMapOfShapeListOfShape.Extent'] = (args, ref) => {
    let n = 0;
    for (;;) {
      try { ref.FindKey(n + 1); n++; } catch (e) { break; }
      if (n > 1e7) { break; }
    }
    return n;
  };

  // Concrete Geom surface classes the fork build DROPPED (Toroidal/
  // Spherical/SurfaceOfRevolution are unregistered, so embind's polymorphic
  // downcast returns the BASE Geom_Surface). Upstream face-inspection
  // (axis_of_rotation, is_circular_*) calls the concrete accessors — serve
  // them through the bound GeomAdaptor_Surface.
  const surfAdaptor = (ref) => {
    const h = new oc.Handle_Geom_Surface_2(ref);
    return new oc.GeomAdaptor_Surface_2(h);
  };
  GLUE['Geom_Surface.Torus'] = (args, ref) => surfAdaptor(ref).Torus();
  GLUE['Geom_Surface.Position'] = (args, ref) => {
    const ad = surfAdaptor(ref);
    const t = ad.GetType();
    if (t === oc.GeomAbs_SurfaceType.GeomAbs_Sphere) {
      return ad.Sphere().Position();
    }
    if (t === oc.GeomAbs_SurfaceType.GeomAbs_Torus) {
      return ad.Torus().Position();
    }
    throw new Error('ocp_shim: Geom_Surface.Position glue: unsupported '
      + 'surface type (unregistered concrete Geom class)');
  };
  GLUE['Geom_Surface.MajorRadius'] = (args, ref) => surfAdaptor(ref).Torus().MajorRadius();
  GLUE['Geom_Surface.MinorRadius'] = (args, ref) => surfAdaptor(ref).Torus().MinorRadius();
  GLUE['Geom_Surface.Radius'] = (args, ref) => {
    const ad = surfAdaptor(ref);
    if (ad.GetType() === oc.GeomAbs_SurfaceType.GeomAbs_Sphere) {
      return ad.Sphere().Radius();
    }
    return ad.Cylinder().Radius();
  };
  GLUE['Geom_Surface.Axis'] = (args, ref) => {
    const ad = surfAdaptor(ref);
    if (typeof ad.AxeOfRevolution === 'function') { return ad.AxeOfRevolution(); }
    throw new Error('ocp_shim: Geom_Surface.Axis glue: AxeOfRevolution unbound');
  };

  // ---- kernel-guard (COMPROMISE(kernel-guard), ported to the upstream
  // topology path): this OCCT 8.0.1 wasm build's BRepAlgoAPI_Fuse can
  // silently DROP an operand (coplanar faces meeting along BSpline edges)
  // or RAISE on shared internal walls, while the General-Fuse SPLIT phase
  // is correct on the same inputs. Upstream _bool_op runs Fuse through the
  // shim (SetArguments/SetTools/Build/Shape), so the guard hooks those:
  // operands are tracked through the ListOfShape Append glue, and Shape()
  // on a Fuse validates the result volume against the largest input,
  // rebuilding from the GF partition when the kernel dropped/raised.
  const _qVol = (shape) => {
    try {
      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
      return Math.abs(props.Mass());
    } catch (e) { return 0; }
  };
  const _rebuildFuseFromGF = (shapes) => {
    try {
      const op = new oc.BOPAlgo_Builder_1();
      for (const s of shapes) { op.AddArgument(s); }
      op.Perform(new oc.Message_ProgressRange_1());
      if (op.HasErrors()) { return null; }
      const gf = op.Shape();
      const ex = new oc.TopExp_Explorer_2(gf, oc.TopAbs_ShapeEnum.TopAbs_SOLID,
        oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      return ex.More() ? gf : null;
    } catch (e) { return null; }
  };
  const listContents = new WeakMap();
  const fuseOperands = new WeakMap();
  GLUE['TopTools_ListOfShape.Append'] = (args, ref) => {
    let arr = listContents.get(ref);
    if (!arr) { arr = []; listContents.set(ref, arr); }
    arr.push(args[0]);
    return ref.Append(args[0]);
  };
  const isFuse = (ref) => normCls(String(ref.constructor.name)) === 'BRepAlgoAPI_Fuse';
  GLUE['BRepAlgoAPI_BuilderAlgo.SetArguments'] = (args, ref) => {
    if (isFuse(ref)) {
      const info = fuseOperands.get(ref) || {};
      info.args = (listContents.get(args[0]) || []).slice();
      fuseOperands.set(ref, info);
    }
    return ref.SetArguments(args[0]);
  };
  GLUE['BRepAlgoAPI_BooleanOperation.SetTools'] = (args, ref) => {
    if (isFuse(ref)) {
      const info = fuseOperands.get(ref) || {};
      info.tools = (listContents.get(args[0]) || []).slice();
      fuseOperands.set(ref, info);
    }
    return ref.SetTools(args[0]);
  };
  GLUE['BRepAlgoAPI_BooleanOperation.Build'] = (args, ref) => {
    const callArgs = args.length ? args : [new oc.Message_ProgressRange_1()];
    try {
      return ref.Build.apply(ref, callArgs);
    } catch (e) {
      const info = isFuse(ref) ? fuseOperands.get(ref) : null;
      if (info && (info.args || []).length + (info.tools || []).length > 1) {
        info.buildError = e;  // Shape() decides: GF rebuild or rethrow
        return undefined;
      }
      throw e;
    }
  };
  GLUE['BRepAlgoAPI_Algo.Shape'] = (args, ref) => {
    const info = isFuse(ref) ? fuseOperands.get(ref) : null;
    if (!info) { return tagTopoDS(ref.Shape()); }
    const operands = (info.args || []).concat(info.tools || []);
    if (info.buildError) {
      const rebuilt = _rebuildFuseFromGF(operands);
      if (!rebuilt) { throw info.buildError; }
      console.log('ocp_shim fuse guard: BRepAlgoAPI_Fuse raised (known OCCT '
        + '8.0.1 wasm fault family); rebuilt from the General-Fuse partition.');
      return tagTopoDS(rebuilt);
    }
    const raw = ref.Shape();
    if (operands.length < 2) { return tagTopoDS(raw); }
    const maxInput = Math.max(...operands.map(_qVol));
    if (maxInput > 1e-6 && _qVol(raw) < maxInput * 0.999 - 1e-9) {
      const rebuilt = _rebuildFuseFromGF(operands);
      if (rebuilt && _qVol(rebuilt) >= maxInput * 0.999 - 1e-9) {
        console.log('ocp_shim fuse guard: BRepAlgoAPI_Fuse dropped an operand '
          + '(known OCCT 8.0.1 wasm fault); rebuilt from the General-Fuse '
          + 'partition.');
        return tagTopoDS(rebuilt);
      }
    }
    return tagTopoDS(raw);
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
  // The one out-param case the fork round did NOT cover (unbilled;
  // ParOnEdgeS2 is the billed sibling and landed):
  const PENDING_FORK = {
    'BRepExtrema_DistShapeShape.ParOnEdgeS1':
      'OCJS_Out.BRepExtrema_ParOnEdgeS1(dss, i) -> {t}',
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

  // ---- history seam (pytopo=upstream): lite's CacheOp tagged shapes with
  // the producing editor line; upstream topology calls the shim instead, so
  // the SHIM records history at operation-family granularity (the
  // BRepPrimAPI/BRepAlgoAPI/... constructions — not every gp_Pnt) and tags
  // every TopoDS_* return with the line recorded by the most recent op, so
  // pick -> line mapping (combineAndRenderShapes reads .producingLine off
  // sceneShapes members) keeps resolving.
  const HISTORY_FAMILIES = /^(BRepPrimAPI_|BRepAlgoAPI_|BRepOffsetAPI_|BRepFilletAPI_|BRepFeat_|BRepOffset_Make|LocOpe_|ChFi2d_)/;
  const historyName = (cls) => cls.replace(HISTORY_FAMILIES, '')
    .replace(/^Make/, '') || cls;
  const tagTopoDS = (v) => {
    if (v && typeof v === 'object' && v.$$ !== undefined && v.constructor &&
        String(v.constructor.name).lastIndexOf('TopoDS_', 0) === 0 &&
        self.currentLineNumber) {
      try { v.producingLine = self.currentLineNumber; } catch (e) { /* frozen */ }
    }
    return v;
  };

  self._csOcpNew = function (cls, args, kwargs) {
    kwargs = normKw(kwargs);
    if (HISTORY_FAMILIES.test(cls) && typeof self.recordExternalOp === 'function') {
      self.recordExternalOp(historyName(cls));
    }
    // pybind auto-derefs HArray2 handles into the NCollection_Array2 the
    // surface-approximation ctors expect; the embind Array2/HArray2 classes
    // are unrelated — copy the values across (small grids)
    if ((cls === 'GeomAPI_PointsToBSplineSurface' || cls === 'Geom_BezierSurface'
         || cls === 'Geom_BSplineSurface') && args.length) {
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!isEmbind(a)) { continue; }
        const m = /^TCol(gp|Std)_HArray2Of(Pnt|Real)/.exec(a.constructor.name);
        if (!m) { continue; }
        const AC = oc['TCol' + m[1] + '_Array2Of' + m[2] + '_2'] ||
          oc['TCol' + m[1] + '_Array2Of' + m[2]];
        if (!AC) { continue; }
        const nr = a.NbRows(), nc2 = a.NbColumns();
        const arr = new AC(1, nr, 1, nc2);
        for (let r2 = 1; r2 <= nr; r2++) {
          for (let c2 = 1; c2 <= nc2; c2++) { arr.SetValue(r2, c2, a.Value(r2, c2)); }
        }
        args[i] = arr;  // the args array is the bridge's own copy
      }
    }
    // Unbounded-line MakeEdge: this wasm binding produces a DEGENERATE edge
    // (range 0..0) for the curve-only forms, where pybind/native gives the
    // unbounded parameter range (+-Precision::Infinite = 1e100). Substitute
    // the ranged overload — upstream's is_infinite/trim_infinite handling
    // expects exactly length > 1e100 (Edge(Axis) rides on this).
    if (cls === 'BRepBuilderAPI_MakeEdge' && args.length === 1 && isEmbind(args[0])) {
      const an = normCls(String(args[0].constructor.name));
      
      if (an === 'gp_Lin') {
        return new oc.BRepBuilderAPI_MakeEdge_5(args[0], -1e100, 1e100);
      }
      if (an === 'Geom_Line' || an === 'Handle_Geom_Line') {
        const h = an === 'Geom_Line'
          ? new oc.Handle_Geom_Curve_2(args[0]) : args[0];
        return new oc.BRepBuilderAPI_MakeEdge_25(h, -1e100, 1e100);
      }
    }
    // COMPROMISE(quantity-color) stand-ins (see mkFakeQC above)
    if (cls === 'Quantity_Color' && !oc.Quantity_Color_1) {
      if (args.length === 0) { return mkFakeQC(0, 0, 0); }
      return mkFakeQC(+args[0] || 0, +args[1] || 0, +args[2] || 0);
    }
    if (cls === 'Quantity_ColorRGBA' && args.length && args[0] && args[0]._csQC) {
      const a = args.length > 1 ? +args[1] : 1.0;
      const inst = new oc.Quantity_ColorRGBA_5(args[0]._r, args[0]._g, args[0]._b, a);
      rgbaChannels.set(inst, [args[0]._r, args[0]._g, args[0]._b]);
      return inst;
    }
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
    let C = oc[jsName];
    if (!C && /_\d+$/.test(jsName)) {
      // hand-registered classes (TopTools_ListOfShape, OCJS helpers) bind
      // under the PLAIN name; the generated table pins d.ts-style _N names
      C = oc[jsName.replace(/_\d+$/, '')];
    }
    if (!C) { return undefined; }
    return function (...a) { return new C(...a); };
  };
  // method resolution with the same plain-name fallback
  const methodOn = (holder) => (js) => {
    let f = holder[js];
    if (typeof f !== 'function' && /_\d+$/.test(js)) {
      f = holder[js.replace(/_\d+$/, '')];
    }
    return f;
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
    let r = dispatchPhases(m && m.dispatch, methodOn(holder), holder,
      args, kwargs, m && m.pybind, m && m.variants, cls + '.' + name);
    if (r.done) { return tagTopoDS(deref(r.value)); }
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
      if (r.done) { return tagTopoDS(deref(r.value)); }
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
    let r = dispatchPhases(m && m.dispatch, methodOn(ref), ref, args,
      kwargs, m && m.pybind, m && m.variants, (mcls || cn0) + '.' + name);
    if (r.done) { return tagTopoDS(deref(r.value)); }
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
      if (r.done) { return tagTopoDS(deref(r.value)); }
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

  // pybind hashes TopoDS_Shape by OCCT HashCode (TShape + Location) — the
  // dedup upstream _topods_entities rides on (`out[hash(item)] = item`).
  // Fork helper OCJS.HashCode serves it; non-shapes return null (Python
  // falls back to identity).
  self._csOcpHashCode = function (ref) {
    if (ref && ref.constructor &&
        String(ref.constructor.name).lastIndexOf('TopoDS_', 0) === 0 &&
        oc.OCJS && typeof oc.OCJS.HashCode === 'function') {
      return oc.OCJS.HashCode(ref, 2147483647);
    }
    return null;
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
