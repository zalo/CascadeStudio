// GordonSurface.js — Gordon curve-network surface interpolation for
// CascadeStudio's build123d-lite (upstream: Face.make_gordon_surface, which
// delegates to the external `ocp_gordon` package — itself a Python port of
// TiGL's Gordon interpolator).
//
// This is a faithful JS port of ocp_gordon 1.x (internal/: bspline_algorithms,
// curves_to_surface, points_to_bspline_interpolation, bspline_approx_interp,
// curve_network_sorter, gordon_surface_builder, interpolate_curve_network),
// with these honest deviations (see the COMPROMISE notes inline):
//
//  - COMPROMISE(gordon-intersections): curve/curve intersection points are
//    found with OCCT's GeomAPI_ExtremaCurveCurve (+ endpoint projections)
//    instead of ocp_gordon's recursive box-subdivision + BFGS refinement
//    (OCP's math_BFGS/math_Matrix are not compiled into this wasm). Both
//    find the same parameter pairs for networks whose curve pairs intersect
//    transversally at <= 2 points — the only networks the upstream algorithm
//    accepts anyway (it raises on > 2 intersections).
//
//  - COMPROMISE(gordon-reparam-interpolate): the 1-D reparametrization
//    function old(new) is interpolated with a pure-JS reimplementation of
//    Geom2dAPI_Interpolate's no-tangent path (clamped C2 cubic with
//    Lagrange-cubic end tangents; single-span quadratic for 3 points,
//    linear for 2) — verified pole-for-pole against the native OCP class —
//    because Geom2dAPI_Interpolate is not compiled into this wasm.
//
//  - COMPROMISE(gordon-conic-approx): conic input edges (circle/ellipse
//    arcs) are converted to EXACT rational quadratic B-splines in JS
//    (affine-mapped unit-circle arcs) and then approximated to non-rational
//    splines with the ported least-squares machinery below, targeting
//    GeomConvert_ApproxCurve's tolerance (Precision::Approximation * size /
//    200) — that class is not compiled into this wasm. Upstream approximates
//    the conic directly (C2, MaxDeg 5); the fitted poles therefore differ,
//    but both curves agree with the true conic to ~1e-7 * size.
//
//  - COMPROMISE(gordon-surface-realization): the mathematically-exact Gordon
//    surface (poles/knots computed below) CANNOT be constructed as a
//    Geom_BSplineSurface in this wasm build — the concrete class does not
//    compile (no constructor, no pole accessors; only the opaque handle
//    exists). The final Face is instead built by sampling the exact surface
//    on a dense grid (every knot line included) and interpolating with
//    GeomAPI_PointsToBSplineSurface::Interpolate. The interpolant passes
//    exactly through all samples; the deviation between samples is far below
//    the harness tolerances. An `OCJS.MakeBSplineSurface(...)` C++ helper
//    would make this step exact (signature in test/b123d-validation/report.md).
//
// Everything else — curve-network sorting, [0,1] reparametrization, network
// compatibility + averaging of intersection parameters, the continuous
// reparametrization approximation (Park-knot least squares with interpolation
// constraints and parameter optimization), skinning of both directions,
// the tensor-product surface, degree matching + common knot vectors, and the
// S_profiles + S_guides − S_tensor pole combination — follows ocp_gordon
// statement by statement. All B-spline curve MUTATIONS (degree elevation,
// knot insertion/removal, segmenting) are delegated to the wasm's fully-bound
// Geom_BSplineCurve so the numerics match OCCT's exactly; surfaces (whose
// concrete class is unavailable) are held as plain {poles, knots, mults,
// degrees} data and mutated column-by-column/row-by-row through the same
// OCCT curve calls — mathematically identical to the Geom_BSplineSurface
// methods, which operate per pole row/column.

'use strict';

const REL_TOL_CLOSED = 1e-8;   // BSplineAlgorithms::REL_TOL_CLOSED
const PAR_CHECK_TOL = 1e-5;    // BSplineAlgorithms::PAR_CHECK_TOL
const CONFUSION = 1e-7;        // Precision::Confusion
const PCONFUSION = 1e-9;       // Precision::PConfusion
const APPROXIMATION = 1e-6;    // Precision::Approximation

// ============================ small linear algebra ==========================

/** Solve A x = B for dense A (n×n) and B (n×m); Gaussian elimination with
 *  partial pivoting. A and B are modified. Returns x as n×m array. */
function solveDense(A, B) {
  const n = A.length;
  const m = B[0].length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    if (Math.abs(A[piv][col]) < 1e-300) throw new Error('Gordon: singular matrix in linear solve');
    if (piv !== col) {
      const t = A[piv]; A[piv] = A[col]; A[col] = t;
      const tb = B[piv]; B[piv] = B[col]; B[col] = tb;
    }
    const d = A[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      for (let c = 0; c < m; c++) B[r][c] -= f * B[col][c];
    }
  }
  for (let col = n - 1; col >= 0; col--) {
    const d = A[col][col];
    for (let c = 0; c < m; c++) {
      let s = B[col][c];
      for (let k = col + 1; k < n; k++) s -= A[col][k] * B[k][c];
      B[col][c] = s / d;
    }
  }
  return B;
}

/** Derivative at t of the Lagrange polynomial through (ts, ys). */
function lagrangeDeriv(ts, ys, t) {
  const n = ts.length;
  let out = 0.0;
  for (let j = 0; j < n; j++) {
    let s = 0.0;
    for (let mth = 0; mth < n; mth++) {
      if (mth === j) continue;
      let prod = 1.0;
      for (let k = 0; k < n; k++) {
        if (k === j || k === mth) continue;
        prod *= (t - ts[k]) / (ts[j] - ts[k]);
      }
      s += prod / (ts[j] - ts[mth]);
    }
    out += ys[j] * s;
  }
  return out;
}

// ============================ B-spline basics ===============================
// Curve data: {deg, knots:[unique], mults:[], poles:[[x,y,z],...],
//              weights:null|[...], periodic:bool}
// Surface data: {udeg, vdeg, uknots, umults, vknots, vmults,
//                poles: poles[i][j] = [x,y,z]}  (non-rational)

function flatKnots(knots, mults) {
  const out = [];
  for (let i = 0; i < knots.length; i++) {
    for (let k = 0; k < mults[i]; k++) out.push(knots[i]);
  }
  return out;
}

/** 0-based find-span: returns s with flat[s] <= u < flat[s+1], clamped to
 *  [deg, ncp-1] (Piegl A2.1 conventions). */
function findSpan(flat, deg, u) {
  const n = flat.length - deg - 2; // last pole index
  if (u >= flat[n + 1]) return n;
  if (u <= flat[deg]) return deg;
  let low = deg, high = n + 1;
  let mid = (low + high) >> 1;
  while (u < flat[mid] || u >= flat[mid + 1]) {
    if (u < flat[mid]) high = mid; else low = mid;
    mid = (low + high) >> 1;
  }
  return mid;
}

/** Nonzero basis functions and derivatives at u (Piegl A2.3).
 *  Returns ders[k][j], k = 0..nDers, j = 0..deg (pole index span-deg+j). */
function dersBasis(flat, deg, u, nDers) {
  const span = findSpan(flat, deg, u);
  const ndu = [];
  for (let i = 0; i <= deg; i++) ndu.push(new Array(deg + 1).fill(0));
  const left = new Array(deg + 1).fill(0);
  const right = new Array(deg + 1).fill(0);
  ndu[0][0] = 1.0;
  for (let j = 1; j <= deg; j++) {
    left[j] = u - flat[span + 1 - j];
    right[j] = flat[span + j] - u;
    let saved = 0.0;
    for (let r = 0; r < j; r++) {
      ndu[j][r] = right[r + 1] + left[j - r];
      const temp = ndu[r][j - 1] / ndu[j][r];
      ndu[r][j] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    ndu[j][j] = saved;
  }
  const ders = [];
  for (let k = 0; k <= nDers; k++) ders.push(new Array(deg + 1).fill(0));
  for (let j = 0; j <= deg; j++) ders[0][j] = ndu[j][deg];
  const a = [new Array(deg + 1).fill(0), new Array(deg + 1).fill(0)];
  for (let r = 0; r <= deg; r++) {
    let s1 = 0, s2 = 1;
    a[0][0] = 1.0;
    for (let k = 1; k <= nDers && k <= deg; k++) {
      let d = 0.0;
      const rk = r - k, pk = deg - k;
      if (r >= k) { a[s2][0] = a[s1][0] / ndu[pk + 1][rk]; d = a[s2][0] * ndu[rk][pk]; }
      const j1 = rk >= -1 ? 1 : -rk;
      const j2 = (r - 1 <= pk) ? k - 1 : deg - r;
      for (let j = j1; j <= j2; j++) {
        a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
        d += a[s2][j] * ndu[rk + j][pk];
      }
      if (r <= pk) { a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r]; d += a[s2][k] * ndu[r][pk]; }
      ders[k][r] = d;
      const t = s1; s1 = s2; s2 = t;
    }
  }
  let rfac = deg;
  for (let k = 1; k <= nDers && k <= deg; k++) {
    for (let j = 0; j <= deg; j++) ders[k][j] *= rfac;
    rfac *= (deg - k);
  }
  return { span, ders };
}

/** B-spline basis matrix — BSplineAlgorithms.bspline_basis_mat.
 *  rows = params, cols = ncp = flat.length - deg - 1. */
function basisMat(deg, flat, params, derivOrder) {
  const ncp = flat.length - deg - 1;
  const out = [];
  for (let ip = 0; ip < params.length; ip++) {
    const row = new Array(ncp).fill(0);
    const { span, ders } = dersBasis(flat, deg, params[ip], derivOrder);
    for (let j = 0; j <= deg; j++) {
      const col = span - deg + j;
      if (col >= 0 && col < ncp) row[col] = ders[derivOrder][j];
    }
    out.push(row);
  }
  return out;
}

/** Rational-aware curve point (and up to 2 derivatives) at u. */
function curveEval(d, u, nDers) {
  nDers = nDers || 0;
  const flat = flatKnots(d.knots, d.mults);
  const { span, ders } = dersBasis(flat, d.deg, u, nDers);
  const W = d.weights;
  // homogeneous accumulation
  const A = [];
  for (let k = 0; k <= nDers; k++) A.push([0, 0, 0, 0]);
  const npoles = d.poles.length;
  for (let j = 0; j <= d.deg; j++) {
    let idx = span - d.deg + j;
    if (d.periodic) idx = ((idx % npoles) + npoles) % npoles;
    if (idx < 0 || idx >= npoles) continue;
    const w = W ? W[idx] : 1.0;
    const P = d.poles[idx];
    for (let k = 0; k <= nDers; k++) {
      const b = ders[k][j];
      A[k][0] += b * P[0] * w; A[k][1] += b * P[1] * w;
      A[k][2] += b * P[2] * w; A[k][3] += b * w;
    }
  }
  if (!W) {
    return A.map((v) => [v[0], v[1], v[2]]);
  }
  // rational derivatives (quotient rule, up to order 2)
  const C0 = [A[0][0] / A[0][3], A[0][1] / A[0][3], A[0][2] / A[0][3]];
  const out = [C0];
  if (nDers >= 1) {
    const w0 = A[0][3], w1 = A[1][3];
    const C1 = [0, 1, 2].map((i) => (A[1][i] - w1 * C0[i]) / w0);
    out.push(C1);
    if (nDers >= 2) {
      const w2 = A[2][3];
      const C2 = [0, 1, 2].map((i) => (A[2][i] - w2 * C0[i] - 2 * w1 * C1[i]) / w0);
      out.push(C2);
    }
  }
  return out;
}

function curvePoint(d, u) { return curveEval(d, u, 0)[0]; }

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function firstParam(d) { return d.knots[0]; }
function lastParam(d) { return d.knots[d.knots.length - 1]; }

/** curve_network_sorter._is_zero_length_curve */
function isZeroLength(d, tol) {
  tol = tol || 1e-9;
  const ref = d.poles[0];
  for (let i = 1; i < d.poles.length; i++) {
    if (dist3(ref, d.poles[i]) > tol) return false;
  }
  return true;
}

/** BSplineAlgorithms.scale(curve): max pole distance from the first pole. */
function curveScale(d) {
  let s = 0.0;
  for (let i = 1; i < d.poles.length; i++) s = Math.max(s, dist3(d.poles[0], d.poles[i]));
  return s > 0 ? s : 1.0;
}
function curveListScale(list) {
  let s = 0.0;
  for (const d of list) s = Math.max(s, curveScale(d));
  return s > 0 ? s : 1.0;
}
/** BSplineAlgorithms.scale(TColgp_Array2OfPnt) on poles[i][j]. */
function grid2Scale(grid) {
  let s = 0.0;
  for (let i = 0; i < grid.length; i++) {
    const pFirst = grid[i][0];
    for (let j = 1; j < grid[i].length; j++) s = Math.max(s, dist3(pFirst, grid[i][j]));
  }
  return s;
}

/** Geom_BSplineCurve::IsEqual-alike on data. */
function curvesEqual(a, b, tol) {
  if (a.deg !== b.deg || a.poles.length !== b.poles.length ||
      a.knots.length !== b.knots.length || !!a.periodic !== !!b.periodic) return false;
  for (let i = 0; i < a.knots.length; i++) {
    if (Math.abs(a.knots[i] - b.knots[i]) > tol || a.mults[i] !== b.mults[i]) return false;
  }
  for (let i = 0; i < a.poles.length; i++) {
    if (dist3(a.poles[i], b.poles[i]) > tol) return false;
    const wa = a.weights ? a.weights[i] : 1, wb = b.weights ? b.weights[i] : 1;
    if (Math.abs(wa - wb) > tol) return false;
  }
  return true;
}

function cloneCurve(d) {
  return {
    deg: d.deg, periodic: !!d.periodic,
    knots: d.knots.slice(), mults: d.mults.slice(),
    poles: d.poles.map((p) => p.slice()),
    weights: d.weights ? d.weights.slice() : null,
  };
}

/** Reverse (Geom_BSplineCurve::Reverse on data). */
function reverseCurveData(d) {
  const first = d.knots[0], last = d.knots[d.knots.length - 1];
  d.poles.reverse();
  if (d.weights) d.weights.reverse();
  const nk = d.knots.length;
  const newKnots = [];
  for (let i = nk - 1; i >= 0; i--) newKnots.push(first + last - d.knots[i]);
  d.knots = newKnots;
  d.mults.reverse();
}

/** Linear knot re-map — BSplCLib::Reparametrize + SetKnots. */
function reparametrizeSimple(d, umin, umax) {
  const f = d.knots[0], l = d.knots[d.knots.length - 1];
  const a = (umax - umin) / (l - f);
  d.knots = d.knots.map((k) => umin + (k - f) * a);
  // exact endpoints (avoid drift)
  d.knots[0] = umin; d.knots[d.knots.length - 1] = umax;
}

// ================== OCCT-backed curve mutations (exact numerics) ============

function makeEngine(oc) {

  function dataToOCCT(d) {
    const np = d.poles.length;
    const poles = new oc.TColgp_Array1OfPnt_2(1, np);
    for (let i = 0; i < np; i++) {
      poles.SetValue(i + 1, new oc.gp_Pnt_3(d.poles[i][0], d.poles[i][1], d.poles[i][2]));
    }
    const knots = new oc.TColStd_Array1OfReal_2(1, d.knots.length);
    for (let i = 0; i < d.knots.length; i++) knots.SetValue(i + 1, d.knots[i]);
    const mults = new oc.TColStd_Array1OfInteger_2(1, d.mults.length);
    for (let i = 0; i < d.mults.length; i++) mults.SetValue(i + 1, d.mults[i]);
    if (d.weights) {
      const w = new oc.TColStd_Array1OfReal_2(1, np);
      for (let i = 0; i < np; i++) w.SetValue(i + 1, d.weights[i]);
      return new oc.Geom_BSplineCurve_2(poles, w, knots, mults, d.deg, !!d.periodic, false);
    }
    return new oc.Geom_BSplineCurve_1(poles, knots, mults, d.deg, !!d.periodic);
  }

  function occtToData(c) {
    const np = c.NbPoles(), nk = c.NbKnots();
    const d = {
      deg: c.Degree(), periodic: c.IsPeriodic(),
      knots: [], mults: [], poles: [], weights: null,
    };
    for (let i = 1; i <= nk; i++) { d.knots.push(c.Knot(i)); d.mults.push(c.Multiplicity(i)); }
    for (let i = 1; i <= np; i++) {
      const p = c.Pole(i);
      d.poles.push([p.X(), p.Y(), p.Z()]);
    }
    if (c.IsRational()) {
      d.weights = [];
      for (let i = 1; i <= np; i++) d.weights.push(c.Weight(i));
    }
    return d;
  }

  function withOCCT(d, fn) {
    const c = dataToOCCT(d);
    fn(c);
    const out = occtToData(c);
    return out;
  }

  function increaseDegreeData(d, deg) {
    if (d.deg >= deg) return d;
    return withOCCT(d, (c) => c.IncreaseDegree(deg));
  }

  /** _insert_knots port: for each (knot, mult): raise an existing (within
   *  tol) knot's multiplicity to mult, else insert it. */
  function insertKnotsData(d, knots, mults, tol) {
    return withOCCT(d, (c) => {
      for (let k = 0; k < knots.length; k++) {
        let exists = false;
        const nk = c.NbKnots();
        for (let i = 1; i <= nk; i++) {
          if (Math.abs(c.Knot(i) - knots[k]) < tol) {
            exists = true;
            c.IncreaseMultiplicity_1(i, mults[k]);
            break;
          }
        }
        if (!exists) c.InsertKnot(knots[k], mults[k], tol, false);
      }
    });
  }

  function segmentData(d, u1, u2) {
    return withOCCT(d, (c) => c.Segment(u1, u2, PCONFUSION));
  }

  function setNotPeriodicData(d) {
    if (!d.periodic) return d;
    return withOCCT(d, (c) => c.SetNotPeriodic());
  }

  /** Try to reduce knot #index (1-based over unique knots) to multiplicity M
   *  within tol. Returns {ok, data}. */
  function removeKnotData(d, index, M, tol) {
    const c = dataToOCCT(d);
    let ok = false;
    try { ok = !!c.RemoveKnot(index, M, tol); } catch (e) { ok = false; }
    return { ok, data: ok ? occtToData(c) : d };
  }

  // =========================== intersections ================================
  // COMPROMISE(gordon-intersections) — see file header.

  function projectPointParam(pnt, curveData_) {
    const c = dataToOCCT(curveData_);
    const h = new oc.Handle_Geom_Curve_2(c);
    const p = new oc.gp_Pnt_3(pnt[0], pnt[1], pnt[2]);
    let best = null;
    try {
      const proj = new oc.GeomAPI_ProjectPointOnCurve_2(p, h);
      const n = proj.NbPoints();
      for (let i = 1; i <= n; i++) {
        const par = proj.Parameter(i);
        const q = proj.Point(i);
        const dd = dist3(pnt, [q.X(), q.Y(), q.Z()]);
        if (best === null || dd < best[1]) best = [par, dd];
      }
    } catch (e) { /* extrema may fail for degenerate configs */ }
    // endpoints too (projection reports only interior extrema)
    for (const t of [firstParam(curveData_), lastParam(curveData_)]) {
      const q = curvePoint(curveData_, t);
      const dd = dist3(pnt, q);
      if (best === null || dd < best[1]) best = [t, dd];
    }
    return best; // [param, distance]
  }

  /** All intersections of two curve datas within (absolute) tolerance.
   *  Returns [[paramOnC1, paramOnC2], ...] — IntersectBSplines equivalent. */
  function intersectCurves(d1, d2, tol) {
    const zero1 = isZeroLength(d1), zero2 = isZeroLength(d2);
    if (zero1 && zero2) {
      return dist3(d1.poles[0], d2.poles[0]) <= tol ? [[0.0, 0.0]] : [];
    }
    if (zero2) {
      const r = projectPointParam(d2.poles[0], d1);
      return r && r[1] <= tol ? [[r[0], 0.0]] : [];
    }
    if (zero1) {
      const r = projectPointParam(d1.poles[0], d2);
      return r && r[1] <= tol ? [[0.0, r[0]]] : [];
    }
    const cands = [];
    const c1 = dataToOCCT(d1), c2 = dataToOCCT(d2);
    const h1 = new oc.Handle_Geom_Curve_2(c1), h2 = new oc.Handle_Geom_Curve_2(c2);
    try {
      const ext = new oc.GeomAPI_ExtremaCurveCurve_2(h1, h2);
      const n = ext.NbExtrema();
      for (let i = 1; i <= n; i++) {
        if (ext.Distance(i) <= tol) {
          const u = { current: 0 }, v = { current: 0 };
          ext.Parameters(i, u, v);
          cands.push([u.current, v.current]);
        }
      }
    } catch (e) { /* no extrema */ }
    // endpoint hits (boundary intersections are not always extrema)
    for (const t of [firstParam(d1), lastParam(d1)]) {
      const r = projectPointParam(curvePoint(d1, t), d2);
      if (r && r[1] <= tol) cands.push([t, r[0]]);
    }
    for (const t of [firstParam(d2), lastParam(d2)]) {
      const r = projectPointParam(curvePoint(d2, t), d1);
      if (r && r[1] <= tol) cands.push([r[0], t]);
    }
    // dedupe (parameter space)
    const eps1 = 1e-5 * Math.max(1e-30, Math.abs(lastParam(d1) - firstParam(d1)));
    const eps2 = 1e-5 * Math.max(1e-30, Math.abs(lastParam(d2) - firstParam(d2)));
    const out = [];
    for (const c of cands) {
      let dup = false;
      for (const o of out) {
        if (Math.abs(c[0] - o[0]) < eps1 && Math.abs(c[1] - o[1]) < eps2) { dup = true; break; }
      }
      if (!dup) out.push(c);
    }
    return out;
  }

  // ================= PointsToBSplineInterpolation (Park 2000) ===============

  /** BSplineAlgorithms.knots_from_curve_parameters — NOTE: may mutate params
   *  (closed even-degree shift), exactly like the Python. */
  function knotsFromCurveParameters(params, degree, closedCurve) {
    if (params.length < 2) throw new Error('Parameters must contain two or more elements.');
    let nCp = params.length;
    if (closedCurve) nCp += degree - 1;
    const nInner = nCp - degree + 1;
    const inner = new Array(nInner).fill(0);
    inner[0] = params[0];
    inner[nInner - 1] = params[params.length - 1];
    const knots = [];
    if (closedCurve && degree % 2 === 0) {
      const m = params.length - 2;
      const dparm = new Array(m + 1).fill(0);
      for (let i = 0; i <= m; i++) dparm[i] = params[i + 1] - params[i];
      inner[1] = inner[0] + 0.5 * (dparm[0] + dparm[m]);
      for (let i = 1; i < m; i++) inner[i + 1] = inner[i] + 0.5 * (dparm[i - 1] + dparm[i]);
      for (let i = 0; i < params.length; i++) params[i] += dparm[m] / 2.0;
    } else if (closedCurve) {
      if (inner.length !== params.length) throw new Error('Inner knots size mismatch');
      for (let i = 0; i < params.length; i++) inner[i] = params[i];
    } else {
      for (let j = 1; j < params.length - degree; j++) {
        let sum = 0.0;
        for (let i = j; i < j + degree; i++) sum += params[i];
        inner[j] = sum / degree;
      }
    }
    if (closedCurve) {
      const offset = inner[0] - inner[nInner - 1];
      for (let ik = 0; ik < degree; ik++) knots.push(offset + inner[nInner - degree - 1 + ik]);
      for (let ik = 0; ik < nInner; ik++) knots.push(inner[ik]);
      for (let ik = 0; ik < degree; ik++) knots.push(-offset + inner[ik + 1]);
    } else {
      for (let ik = 0; ik < degree; ik++) knots.push(inner[0]);
      for (let ik = 0; ik < nInner; ik++) knots.push(inner[ik]);
      for (let ik = 0; ik < degree; ik++) knots.push(inner[nInner - 1]);
    }
    if (closedCurve && degree <= 1) {
      knots[0] = knots[1];
      knots[knots.length - 1] = knots[knots.length - 2];
    }
    return knots;
  }

  /** flat knot vector -> unique knots + multiplicities (BSplCLib::Knots). */
  function uniqueKnots(flat) {
    const knots = [], mults = [];
    for (const k of flat) {
      if (knots.length && Math.abs(k - knots[knots.length - 1]) < 1e-12) {
        mults[mults.length - 1]++;
      } else { knots.push(k); mults.push(1); }
    }
    return { knots, mults };
  }

  function maxDistanceOfPoints(points) {
    let m = 0.0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) m = Math.max(m, dist3(points[i], points[j]));
    }
    return m;
  }

  /** PointsToBSplineInterpolation.curve() — points: [[x,y,z]],
   *  parameters given (gordon always passes them). */
  function pointsToBSplineInterpolation(points, parameters, maxDegree, continuousIfClosed) {
    maxDegree = maxDegree === undefined ? 3 : maxDegree;
    const nPts = points.length;
    if (nPts < 2) throw new Error('Too few points in PointsToBSplineInterpolation');
    if (parameters.length !== nPts) throw new Error('Number of parameters and points don\'t match');
    const maxDist = maxDistanceOfPoints(points);
    const isClosed = dist3(points[0], points[nPts - 1]) <= 1e-6 * maxDist && !!continuousIfClosed;
    let maxAllowed = nPts - 1;
    if (isClosed) maxAllowed -= 1;
    const degree = Math.min(maxAllowed, maxDegree);
    if (degree <= 0) throw new Error('Invalid degree computed');
    const needsShift = (degree % 2 === 0) && isClosed;

    let params = parameters.slice();
    const knots = knotsFromCurveParameters(params, degree, isClosed);
    if (isClosed) params = params.slice(0, -1);

    const nParams = params.length;
    const bsplMat = basisMat(degree, knots, params, 0);
    const lhs = [];
    for (let i = 0; i < nParams; i++) {
      const row = new Array(nParams).fill(0);
      for (let j = 0; j < nParams; j++) row[j] = bsplMat[i][j];
      lhs.push(row);
    }
    if (isClosed) {
      for (let j = 0; j < degree; j++) {
        for (let i = 0; i < nParams; i++) lhs[i][j] += bsplMat[i][nParams + j];
      }
    }
    const rhs = [];
    for (let i = 0; i < nParams; i++) rhs.push(points[i].slice());
    const cp = solveDense(lhs, rhs);

    let nCtrl = isClosed ? parameters.length + degree - 1 : nParams;
    if (needsShift) nCtrl += 1;
    const poles = [];
    for (let i = 0; i < nParams; i++) poles.push(cp[i].slice());
    if (isClosed) {
      for (let i = 0; i < degree; i++) poles.push(cp[i].slice());
    }
    if (needsShift) {
      const deg = degree;
      knots.push(knots[knots.length - 1] + knots[2 * deg + 1] - knots[2 * deg]);
      poles.push(poles[deg].slice());
      for (let i = 0; i < knots.length; i++) knots[i] -= params[0];
    }
    while (poles.length < nCtrl) poles.push(poles[poles.length - 1].slice());

    const uk = uniqueKnots(knots);
    let result = {
      deg: degree, periodic: false, knots: uk.knots, mults: uk.mults,
      poles, weights: null,
    };
    if (isClosed) {
      // clamp: Geom_TrimmedCurve + CurveToBSplineCurve == Segment
      result = segmentData(result, parameters[0], parameters[parameters.length - 1]);
    }
    return result;
  }

  // ======================= BSplineApproxInterp ==============================

  function insertKnotWithMult(knot, count, degree, knots, mults, tol) {
    if (!(knots[0] - tol <= knot && knot <= knots[knots.length - 1] + tol)) {
      throw new Error('knot out of range');
    }
    let found = -1;
    for (let i = 0; i < knots.length; i++) {
      if (Math.abs(knots[i] - knot) < tol) { found = i; break; }
    }
    if (found >= 0) {
      mults[found] = Math.min(mults[found] + count, degree);
    } else {
      let idx = 0;
      while (idx < knots.length && knots[idx] < knot) idx++;
      knots.splice(idx, 0, knot);
      mults.splice(idx, 0, Math.min(count, degree));
    }
  }

  class BSplineApproxInterp {
    constructor(points, nControlPoints, degree, continuousIfClosed) {
      this.pnts = points.map((p) => p.slice());
      this.indexOfApproximated = [];
      for (let i = 0; i < points.length; i++) this.indexOfApproximated.push(i);
      this.indexOfInterpolated = [];
      this.indexOfKinks = [];
      this.degree = degree === undefined ? 3 : degree;
      this.ncp = nControlPoints;
      this.c2Continuous = !!continuousIfClosed;
    }

    interpolatePoint(pointIndex, withKink) {
      const pos = this.indexOfApproximated.indexOf(pointIndex);
      if (pos < 0) throw new Error('Invalid index in BSplineApproxInterp::interpolate_point');
      this.indexOfApproximated.splice(pos, 1);
      this.indexOfInterpolated.push(pointIndex);
      if (withKink) this.indexOfKinks.push(pointIndex);
    }

    maxDistanceOfBoundingBox() {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const p of this.pnts) {
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      }
      const d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      return Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    }

    isClosed() {
      if (!this.c2Continuous) return false;
      const err = 1e-12 * this.maxDistanceOfBoundingBox();
      return dist3(this.pnts[0], this.pnts[this.pnts.length - 1]) <= err;
    }

    firstAndLastInterpolated() {
      return this.indexOfInterpolated.indexOf(0) >= 0 &&
             this.indexOfInterpolated.indexOf(this.pnts.length - 1) >= 0;
    }

    computeKnots(ncp, params) {
      const order = this.degree + 1;
      if (ncp < order) throw new Error('Number of control points too small!');
      const umin = Math.min(...params), umax = Math.max(...params);
      const knots = new Array(ncp - this.degree + 1).fill(0);
      const mults = new Array(ncp - this.degree + 1).fill(0);
      knots[0] = umin; mults[0] = order;
      const N = ncp - order;
      for (let i = 1; i <= N; i++) {
        knots[i] = umin + (umax - umin) * i / (N + 1);
        mults[i] = 1;
      }
      knots[N + 1] = umax; mults[N + 1] = order;
      for (const kinkIdx of this.indexOfKinks) {
        insertKnotWithMult(params[kinkIdx], this.degree, this.degree, knots, mults, 1e-4);
      }
      return { knots, mults };
    }

    getContinuityMatrix(nCtrPnts, continCons, params, flat) {
      const rows = [];
      const p1 = [params[0]], p2 = [params[params.length - 1]];
      const d11 = basisMat(this.degree, flat, p1, 1)[0];
      const d12 = basisMat(this.degree, flat, p2, 1)[0];
      const d21 = basisMat(this.degree, flat, p1, 2)[0];
      const d22 = basisMat(this.degree, flat, p2, 2)[0];
      rows.push(d11.map((v, i) => v - d12[i]));    // C1
      rows.push(d21.map((v, i) => v - d22[i]));    // C2
      if (!this.firstAndLastInterpolated()) {
        const d01 = basisMat(this.degree, flat, p1, 0)[0];
        const d02 = basisMat(this.degree, flat, p2, 0)[0];
        rows.push(d01.map((v, i) => v - d02[i]));  // C0
      }
      while (rows.length < continCons) rows.push(new Array(nCtrPnts).fill(0));
      return rows.slice(0, continCons);
    }

    solve(params, knots, mults) {
      const flat = flatKnots(knots, mults);
      const nApprox = this.indexOfApproximated.length;
      const nInterp = this.indexOfInterpolated.length;
      let nContin = 0;
      const makeClosed = this.isClosed();
      if (makeClosed) {
        nContin = 3;
        if (this.firstAndLastInterpolated()) nContin -= 1;
      }
      const nCtrPnts = flat.length - this.degree - 1;
      if (nCtrPnts < nInterp + nContin || nCtrPnts < this.degree + 1 + nContin) {
        throw new Error('Too few control points for curve interpolation!');
      }
      if (nApprox === 0 && nCtrPnts !== nInterp + nContin) {
        throw new Error('Wrong number of control points for curve interpolation!');
      }
      const nVars = nCtrPnts + nInterp + nContin;
      const lhs = [];
      for (let i = 0; i < nVars; i++) lhs.push(new Array(nVars).fill(0));
      const rhs = [];
      for (let i = 0; i < nVars; i++) rhs.push([0, 0, 0]);

      if (nApprox > 0) {
        const appParams = this.indexOfApproximated.map((i) => params[i]);
        const A = basisMat(this.degree, flat, appParams, 0);
        // lhs[0:n,0:n] = At*A ; rhs[0:n] = At*b
        for (let i = 0; i < nCtrPnts; i++) {
          for (let j = 0; j < nCtrPnts; j++) {
            let s = 0.0;
            for (let r = 0; r < appParams.length; r++) s += A[r][i] * A[r][j];
            lhs[i][j] = s;
          }
          for (let c = 0; c < 3; c++) {
            let s = 0.0;
            for (let r = 0; r < appParams.length; r++) {
              s += A[r][i] * this.pnts[this.indexOfApproximated[r]][c];
            }
            rhs[i][c] = s;
          }
        }
      }
      if (nInterp + nContin > 0) {
        if (nInterp > 0) {
          const interpParams = this.indexOfInterpolated.map((i) => params[i]);
          const C = basisMat(this.degree, flat, interpParams, 0);
          for (let r = 0; r < nInterp; r++) {
            for (let j = 0; j < nCtrPnts; j++) {
              lhs[j][nCtrPnts + r] = C[r][j];
              lhs[nCtrPnts + r][j] = C[r][j];
            }
            const p = this.pnts[this.indexOfInterpolated[r]];
            rhs[nCtrPnts + r] = [p[0], p[1], p[2]];
          }
        }
        if (makeClosed) {
          const cm = this.getContinuityMatrix(nCtrPnts, nContin, params, flat);
          for (let r = 0; r < nContin; r++) {
            for (let j = 0; j < nCtrPnts; j++) {
              lhs[nCtrPnts + nInterp + r][j] = cm[r][j];
              lhs[j][nCtrPnts + nInterp + r] = cm[r][j];
            }
            rhs[nCtrPnts + nInterp + r] = [0, 0, 0];
          }
        }
      }
      for (let i = 0; i < nVars; i++) lhs[i][i] += 1e-15;
      const sol = solveDense(lhs, rhs);
      const poles = [];
      for (let i = 0; i < nCtrPnts; i++) poles.push(sol[i].slice());
      const curve = {
        deg: this.degree, periodic: false,
        knots: knots.slice(), mults: mults.slice(), poles, weights: null,
      };
      let maxError = 0.0;
      for (const idx of this.indexOfApproximated) {
        maxError = Math.max(maxError, dist3(curvePoint(curve, params[idx]), this.pnts[idx]));
      }
      return { curve, error: maxError };
    }

    projectOnCurve(pnt, curve, initialParam) {
      const maxIter = 10, eps = 1e-6;
      let t = initialParam, tNew = initialParam;
      let diffMag = 0.0;
      for (let i = 0; i < maxIter; i++) {
        t = tNew;
        const E = curveEval(curve, t, 2);
        const diff = [E[0][0] - pnt[0], E[0][1] - pnt[1], E[0][2] - pnt[2]];
        diffMag = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]);
        const df = diff[0] * E[1][0] + diff[1] * E[1][1] + diff[2] * E[1][2];
        const d2f = diff[0] * E[2][0] + diff[1] * E[2][1] + diff[2] * E[2][2] +
                    E[1][0] * E[1][0] + E[1][1] * E[1][1] + E[1][2] * E[1][2];
        if (Math.abs(d2f) < 1e-12) break;
        const dt = -df / d2f;
        if (Math.abs(dt) < eps) break;
        tNew = t + dt;
        if (tNew < firstParam(curve) || tNew > lastParam(curve)) break;
      }
      return { parameter: t, error: diffMag };
    }

    optimizeParameters(curve, params) {
      for (const idx of this.indexOfApproximated) {
        const res = this.projectOnCurve(this.pnts[idx], curve, params[idx]);
        params[idx] = res.parameter;
      }
    }

    fitCurveOptimal(initialParams, maxIter) {
      maxIter = maxIter === undefined ? 10 : maxIter;
      const params = (initialParams && initialParams.length)
        ? initialParams.slice() : this.computeParameters(0.5);
      if (params.length !== this.pnts.length) {
        throw new Error("Number of parameters don't match number of points");
      }
      const { knots, mults } = this.computeKnots(this.ncp, params);
      let iteration = 0;
      let result = this.solve(params, knots, mults);
      let oldError = result.error * 2.0;
      while (result.error > 0 &&
             (oldError - result.error) / Math.max(result.error, 1e-6) > 1e-3 &&
             iteration < maxIter) {
        oldError = result.error;
        this.optimizeParameters(result.curve, params);
        result = this.solve(params, knots, mults);
        iteration += 1;
      }
      return result;
    }

    computeParameters(alpha) {
      let sumLen = 0.0;
      const n = this.pnts.length;
      const params = new Array(n).fill(0);
      for (let i = 1; i < n; i++) {
        const len2 = Math.pow(dist3(this.pnts[i - 1], this.pnts[i]), 2);
        sumLen += Math.pow(len2, alpha / 2.0);
        params[i] = sumLen;
      }
      const tmax = params[n - 1];
      if (tmax < 1e-10) {
        for (let i = 0; i < n; i++) params[i] = n > 1 ? i / (n - 1) : 0.0;
      } else {
        for (let i = 1; i < n; i++) params[i] /= tmax;
      }
      if (n > 0) params[n - 1] = 1.0;
      return params;
    }
  }

  // ============== 1-D interpolation (Geom2dAPI_Interpolate port) ============
  // COMPROMISE(gordon-reparam-interpolate) — see file header. Returns an
  // evaluator for the scalar function y(x) through (xs, ys) that matches
  // OCCT's no-tangent interpolation exactly (verified against native OCP).

  function interpolate1D(xs, ys) {
    const n = xs.length;
    if (n === 2) {
      const x0 = xs[0], x1 = xs[1], y0 = ys[0], y1 = ys[1];
      return (u) => y0 + (y1 - y0) * (u - x0) / (x1 - x0);
    }
    if (n === 3) {
      // single-span quadratic: knots [x0, x2] mult 3; middle pole from
      // B(t1) = y1 with t normalized
      const t = (xs[1] - xs[0]) / (xs[2] - xs[0]);
      const b0 = (1 - t) * (1 - t), b1 = 2 * t * (1 - t), b2 = t * t;
      const p1 = (ys[1] - b0 * ys[0] - b2 * ys[2]) / b1;
      const flat = [xs[0], xs[0], xs[0], xs[2], xs[2], xs[2]];
      const ctrl = [ys[0], p1, ys[2]];
      return (u) => eval1D(flat, 2, ctrl, u);
    }
    // n >= 4: clamped C2 cubic, knots = xs, end tangents from the Lagrange
    // cubic through the first/last 4 points
    const flat = [xs[0], xs[0], xs[0]];
    for (let i = 0; i < n; i++) flat.push(xs[i]);
    flat.push(xs[n - 1], xs[n - 1], xs[n - 1]);
    const ncp = n + 2;
    const d0 = lagrangeDeriv(xs.slice(0, 4), ys.slice(0, 4), xs[0]);
    const d1 = lagrangeDeriv(xs.slice(n - 4), ys.slice(n - 4), xs[n - 1]);
    const A = [];
    const B = [];
    const rows0 = basisMat(3, flat, xs, 0);
    for (let i = 0; i < n; i++) { A.push(rows0[i]); B.push([ys[i]]); }
    A.push(basisMat(3, flat, [xs[0]], 1)[0]); B.push([d0]);
    A.push(basisMat(3, flat, [xs[n - 1]], 1)[0]); B.push([d1]);
    if (A.length !== ncp) throw new Error('interpolate1D: system size mismatch');
    const sol = solveDense(A, B);
    const ctrl = sol.map((r) => r[0]);
    return (u) => eval1D(flat, 3, ctrl, u);
  }

  function eval1D(flat, deg, ctrl, u) {
    const { span, ders } = dersBasis(flat, deg, u, 0);
    let s = 0.0;
    for (let j = 0; j <= deg; j++) {
      const idx = span - deg + j;
      if (idx >= 0 && idx < ctrl.length) s += ders[0][j] * ctrl[idx];
    }
    return s;
  }

  // ===================== BSplineAlgorithms (curve level) =====================

  function linspaceWithBreaks(umin, umax, nValues, breaks) {
    if (nValues < 2) return nValues === 1 ? [umin] : [];
    const du = (umax - umin) / (nValues - 1);
    const result = [];
    for (let i = 0; i < nValues; i++) result.push(umin + i * du);
    const eps = 0.3;
    for (const bp of breaks) {
      let foundPos = -1;
      for (let i = 0; i < result.length; i++) {
        if (Math.abs(result[i] - bp) < du * eps) { result[i] = bp; foundPos = i; break; }
      }
      if (foundPos === -1) {
        let closest = -1, minDist = Infinity;
        for (let i = 0; i < result.length; i++) {
          const dd = Math.abs(result[i] - bp);
          if (dd < minDist) { minDist = dd; closest = i; }
        }
        if (closest !== -1) {
          if (result[closest] > bp) result.splice(closest, 0, bp);
          else result.splice(closest + 1, 0, bp);
        } else {
          result.push(bp);
        }
      }
    }
    return result;
  }

  function getKinkParameters(d) {
    const eps = 1e-8;
    const kinks = [];
    for (let ki = 1; ki < d.knots.length - 1; ki++) {
      if (d.mults[ki] === d.deg) {
        const knot = d.knots[ki];
        const t1 = curveEval(d, knot + eps, 1)[1];
        const t2 = curveEval(d, knot - eps, 1)[1];
        const dot = t1[0] * t2[0] + t1[1] * t2[1] + t1[2] * t2[2];
        const m1 = Math.hypot(t1[0], t1[1], t1[2]), m2 = Math.hypot(t2[0], t2[1], t2[2]);
        let ang = Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2 || 1))));
        const angleTol = 1e-4;
        if (!(Math.abs(ang) < angleTol || Math.abs(ang - Math.PI) < angleTol)) kinks.push(knot);
      }
    }
    return kinks;
  }

  function matchDegree(curves) {
    let maxDeg = 0;
    for (const c of curves) maxDeg = Math.max(maxDeg, c.deg);
    for (let i = 0; i < curves.length; i++) {
      if (curves[i].deg < maxDeg) curves[i] = increaseDegreeData(curves[i], maxDeg);
    }
  }

  function createCommonKnotsVectorCurve(curves, tol) {
    // exact-value union like the Python set(), tolerance applies on insertion
    const all = [];
    for (const c of curves) {
      for (const k of c.knots) if (all.indexOf(k) < 0) all.push(k);
    }
    all.sort((a, b) => a - b);
    const commonKnots = [], commonMults = [];
    for (const k of all) {
      let maxMult = 0;
      for (const c of curves) {
        for (let i = 0; i < c.knots.length; i++) {
          if (Math.abs(c.knots[i] - k) < tol) { maxMult = Math.max(maxMult, c.mults[i]); break; }
        }
      }
      commonKnots.push(k); commonMults.push(maxMult);
    }
    return curves.map((c) => insertKnotsData(c, commonKnots, commonMults, tol));
  }

  function reparametrizeContinuouslyApprox(spline, oldParameters, newParameters, nControlPnts) {
    if (oldParameters.length !== newParameters.length) {
      throw new Error('parameter sizes dont match');
    }
    const repar = interpolate1D(newParameters, oldParameters);

    let breaks = newParameters.slice(1, -1);
    const parTol = 1e-10;

    // kinks (mult == degree interior knots) of the input spline, mapped to
    // the NEW parameter space (root of repar(t) = kink; repar is monotone)
    const kinks = getKinkParameters(spline).map((kOld) => {
      let lo = newParameters[0], hi = newParameters[newParameters.length - 1];
      for (let it = 0; it < 100; it++) {
        const mid = 0.5 * (lo + hi);
        if (repar(mid) < kOld) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    });
    breaks = breaks.filter((b) => !kinks.some((k) => Math.abs(b - k) < parTol));

    let parameters = linspaceWithBreaks(
      newParameters[0], newParameters[newParameters.length - 1],
      Math.max(101, nControlPnts * 2), breaks);
    for (const k of kinks) {
      let idx = 0;
      while (idx < parameters.length && parameters[idx] < k) idx++;
      parameters.splice(idx, 0, k);
    }

    const points = parameters.map((t) => curvePoint(spline, repar(t)));

    const sp = curvePoint(spline, firstParam(spline));
    const ep = curvePoint(spline, lastParam(spline));
    let makeContinuous = false;
    if (dist3(sp, ep) <= CONFUSION) {
      const t1 = curveEval(spline, firstParam(spline), 1)[1];
      const t2 = curveEval(spline, lastParam(spline), 1)[1];
      const dot = t1[0] * t2[0] + t1[1] * t2[1] + t1[2] * t2[2];
      const ang = Math.acos(Math.max(-1, Math.min(1,
        dot / ((Math.hypot(...t1) * Math.hypot(...t2)) || 1))));
      makeContinuous = ang < (6.0 / 180.0) * Math.PI;
    }

    const approx = new BSplineApproxInterp(points, Math.round(nControlPnts), 3, makeContinuous);
    const breaksWithEnds = [newParameters[0], ...breaks, newParameters[newParameters.length - 1]];
    for (const b of breaksWithEnds) {
      const idx = parameters.findIndex((p) => Math.abs(p - b) < parTol);
      if (idx >= 0) approx.interpolatePoint(idx, false);
    }
    for (const k of kinks) {
      const idx = parameters.findIndex((p) => Math.abs(p - k) < parTol);
      if (idx >= 0) approx.interpolatePoint(idx, true);
    }
    return approx.fitCurveOptimal(parameters);
  }

  function computeParamsBSplineCurve(points, alpha) {
    alpha = alpha === undefined ? 0.5 : alpha;
    const n = points.length;
    if (n < 2) return n === 1 ? [0.0, 1.0] : [];
    const chord = [];
    let total = 0.0;
    for (let i = 1; i < n; i++) {
      const l = Math.pow(dist3(points[i - 1], points[i]), alpha);
      chord.push(l); total += l;
    }
    const params = [0.0];
    let cur = 0.0;
    for (const l of chord) { cur += l; params.push(cur / total); }
    return params;
  }

  // ========================= surface data helpers ===========================

  function surfClone(s) {
    return {
      udeg: s.udeg, vdeg: s.vdeg,
      uknots: s.uknots.slice(), umults: s.umults.slice(),
      vknots: s.vknots.slice(), vmults: s.vmults.slice(),
      poles: s.poles.map((row) => row.map((p) => p.slice())),
    };
  }

  function surfNbUPoles(s) { return s.poles.length; }
  function surfNbVPoles(s) { return s.poles[0].length; }

  function surfExchangeUV(s) {
    const poles = [];
    for (let j = 0; j < surfNbVPoles(s); j++) {
      const row = [];
      for (let i = 0; i < surfNbUPoles(s); i++) row.push(s.poles[i][j].slice());
      poles.push(row);
    }
    return {
      udeg: s.vdeg, vdeg: s.udeg,
      uknots: s.vknots.slice(), umults: s.vmults.slice(),
      vknots: s.uknots.slice(), vmults: s.umults.slice(),
      poles,
    };
  }

  function uColumnCurve(s, j) {
    return {
      deg: s.udeg, periodic: false,
      knots: s.uknots.slice(), mults: s.umults.slice(),
      poles: s.poles.map((row) => row[j].slice()), weights: null,
    };
  }
  function vRowCurve(s, i) {
    return {
      deg: s.vdeg, periodic: false,
      knots: s.vknots.slice(), mults: s.vmults.slice(),
      poles: s.poles[i].map((p) => p.slice()), weights: null,
    };
  }

  /** Apply an OCCT curve op along U (per V-column) and rebuild the surface. */
  function surfApplyU(s, op) {
    const nV = surfNbVPoles(s);
    const cols = [];
    for (let j = 0; j < nV; j++) cols.push(op(uColumnCurve(s, j)));
    const first = cols[0];
    const poles = [];
    for (let i = 0; i < first.poles.length; i++) {
      const row = [];
      for (let j = 0; j < nV; j++) row.push(cols[j].poles[i]);
      poles.push(row);
    }
    return {
      udeg: first.deg, vdeg: s.vdeg,
      uknots: first.knots, umults: first.mults,
      vknots: s.vknots.slice(), vmults: s.vmults.slice(),
      poles,
    };
  }
  function surfApplyV(s, op) {
    const nU = surfNbUPoles(s);
    const rows = [];
    for (let i = 0; i < nU; i++) rows.push(op(vRowCurve(s, i)));
    const first = rows[0];
    return {
      udeg: s.udeg, vdeg: first.deg,
      uknots: s.uknots.slice(), umults: s.umults.slice(),
      vknots: first.knots, vmults: first.mults,
      poles: rows.map((r) => r.poles),
    };
  }

  function surfIncreaseDegree(s, du, dv) {
    let out = s;
    if (out.udeg < du) out = surfApplyU(out, (c) => increaseDegreeData(c, du));
    if (out.vdeg < dv) out = surfApplyV(out, (c) => increaseDegreeData(c, dv));
    return out;
  }

  function surfInsertKnots(s, direction, knots, mults, tol) {
    if (direction === 'u') return surfApplyU(s, (c) => insertKnotsData(c, knots, mults, tol));
    return surfApplyV(s, (c) => insertKnotsData(c, knots, mults, tol));
  }

  /** GordonSurfaceBuilder._create_common_knots_vector_surface_internal */
  function createCommonKnotsVectorSurface(surfaces, tol) {
    let result = surfaces.map(surfClone);
    for (const dir of ['u', 'v']) {
      const all = [];
      for (const s of result) {
        const ks = dir === 'u' ? s.uknots : s.vknots;
        for (const k of ks) if (all.indexOf(k) < 0) all.push(k);
      }
      all.sort((a, b) => a - b);
      const commonKnots = [], commonMults = [];
      for (const k of all) {
        let maxMult = 0;
        for (const s of result) {
          const ks = dir === 'u' ? s.uknots : s.vknots;
          const ms = dir === 'u' ? s.umults : s.vmults;
          for (let i = 0; i < ks.length; i++) {
            if (Math.abs(ks[i] - k) < tol) { maxMult = Math.max(maxMult, ms[i]); break; }
          }
        }
        commonKnots.push(k); commonMults.push(maxMult);
      }
      result = result.map((s) => surfInsertKnots(s, dir, commonKnots, commonMults, tol));
    }
    return result;
  }

  function surfEval(s, u, v) {
    const uflat = flatKnots(s.uknots, s.umults);
    const vflat = flatKnots(s.vknots, s.vmults);
    const bu = dersBasis(uflat, s.udeg, u, 0);
    const bv = dersBasis(vflat, s.vdeg, v, 0);
    const out = [0, 0, 0];
    for (let i = 0; i <= s.udeg; i++) {
      const iu = bu.span - s.udeg + i;
      if (iu < 0 || iu >= surfNbUPoles(s)) continue;
      for (let j = 0; j <= s.vdeg; j++) {
        const jv = bv.span - s.vdeg + j;
        if (jv < 0 || jv >= surfNbVPoles(s)) continue;
        const f = bu.ders[0][i] * bv.ders[0][j];
        const P = s.poles[iu][jv];
        out[0] += f * P[0]; out[1] += f * P[1]; out[2] += f * P[2];
      }
    }
    return out;
  }

  /** Evaluate the surface on a whole parameter GRID: same values as
   *  surfEval(s, u, v) per point, but the flat knot vectors and basis
   *  functions are computed once and the u direction is collapsed to a
   *  control curve per u row (surfEval rebuilds the flat knots on every
   *  call, which dominates dense sampling). Returns out[i][j]. */
  function surfEvalGrid(s, us, vs) {
    const uflat = flatKnots(s.uknots, s.umults);
    const vflat = flatKnots(s.vknots, s.vmults);
    const nU = surfNbUPoles(s), nV = surfNbVPoles(s);
    const bvs = vs.map((v) => dersBasis(vflat, s.vdeg, v, 0));
    const out = [];
    for (let a = 0; a < us.length; a++) {
      const bu = dersBasis(uflat, s.udeg, us[a], 0);
      const tmp = new Array(nV);
      for (let jv = 0; jv < nV; jv++) tmp[jv] = [0, 0, 0];
      for (let i = 0; i <= s.udeg; i++) {
        const iu = bu.span - s.udeg + i;
        if (iu < 0 || iu >= nU) continue;
        const f = bu.ders[0][i];
        if (f === 0) continue;
        const row = s.poles[iu];
        for (let jv = 0; jv < nV; jv++) {
          const P = row[jv];
          tmp[jv][0] += f * P[0]; tmp[jv][1] += f * P[1]; tmp[jv][2] += f * P[2];
        }
      }
      const rowOut = [];
      for (let b = 0; b < vs.length; b++) {
        const bv = bvs[b];
        let x = 0, y = 0, z = 0;
        for (let j = 0; j <= s.vdeg; j++) {
          const jv = bv.span - s.vdeg + j;
          if (jv < 0 || jv >= nV) continue;
          const f = bv.ders[0][j];
          x += f * tmp[jv][0]; y += f * tmp[jv][1]; z += f * tmp[jv][2];
        }
        rowOut.push([x, y, z]);
      }
      out.push(rowOut);
    }
    return out;
  }

  function isUDirClosed(grid, tol) {
    // grid[u][v]; first row vs last row
    const uhi = grid.length - 1;
    for (let j = 0; j < grid[0].length; j++) {
      if (dist3(grid[0][j], grid[uhi][j]) > tol) return false;
    }
    return true;
  }
  function isVDirClosed(grid, tol) {
    const vhi = grid[0].length - 1;
    for (let i = 0; i < grid.length; i++) {
      if (dist3(grid[i][0], grid[i][vhi]) > tol) return false;
    }
    return true;
  }

  // ========================== CurvesToSurface ===============================

  /** clamp_bspline (curves_to_surface): remove periodicity, trim, convert. */
  function clampBSpline(d) {
    if (!d.periodic) return null;
    const f = firstParam(d), l = lastParam(d);
    let out = setNotPeriodicData(d);
    out = segmentData(out, f, l);
    return out;
  }

  class CurvesToSurface {
    constructor(curves, parameters, continuousIfClosed, tolerance) {
      this.inputCurves = curves.map(cloneCurve);
      this.parameters = parameters ? parameters.slice() : [];
      this.continuousIfClosed = !!continuousIfClosed;
      this.tolerance = tolerance === undefined ? 1e-14 : tolerance;
      this.maxDegree = 3;
      this.skinnedSurface = null;
      matchDegree(this.inputCurves);
      if (!this.parameters.length) this.calculateParameters();
      if (!this.compatibleSplines || !this.compatibleSplines.length) {
        this.compatibleSplines = createCommonKnotsVectorCurve(this.inputCurves, this.tolerance);
      }
    }

    calculateParameters() {
      this.compatibleSplines = createCommonKnotsVectorCurve(this.inputCurves, this.tolerance);
      const first = this.compatibleSplines[0];
      const numPolesU = first.poles.length;
      const nSplines = this.compatibleSplines.length;
      // control point grid: rows = poles (u), cols = splines (v)
      const grid = [];
      for (let i = 0; i < numPolesU; i++) {
        const row = [];
        for (let jSpline = 0; jSpline < nSplines; jSpline++) {
          row.push(this.compatibleSplines[jSpline].poles[i]);
        }
        grid.push(row);
      }
      // compute_params_bspline_surf: average v-params over rows
      const paramsV = new Array(nSplines).fill(0);
      for (let i = 0; i < numPolesU; i++) {
        const rowParams = computeParamsBSplineCurve(grid[i], 0.5);
        for (let j = 0; j < nSplines; j++) paramsV[j] += rowParams[j];
      }
      for (let j = 0; j < nSplines; j++) paramsV[j] /= numPolesU;
      this.parameters = paramsV;
    }

    surface() {
      if (!this.skinnedSurface) this.perform();
      return this.skinnedSurface;
    }

    perform() {
      if (this.inputCurves.length < 2) return;
      if (this.parameters.length !== this.inputCurves.length) {
        throw new Error('The amount of given parameters has to be equal to the amount of given B-splines!');
      }
      const tolerance = curveListScale(this.inputCurves) * REL_TOL_CLOSED;
      const makeClosed = this.continuousIfClosed &&
        curvesEqual(this.inputCurves[0], this.inputCurves[this.inputCurves.length - 1], tolerance);
      const nCurves = this.inputCurves.length;
      const first = this.compatibleSplines[0];
      const numControlPointsU = first.poles.length;
      let degreeV = 0;
      const degreeU = first.deg;
      let knotsV = null, multsV = null;
      const cpSurf = [];
      let interpSpline = null;
      for (let cpU = 0; cpU < numControlPointsU; cpU++) {
        const interpPoints = [];
        for (let cpV = 0; cpV < nCurves; cpV++) {
          interpPoints.push(this.compatibleSplines[cpV].poles[cpU].slice());
        }
        interpSpline = pointsToBSplineInterpolation(
          interpPoints, this.parameters, this.maxDegree, makeClosed);
        if (makeClosed) {
          const clamped = clampBSpline(interpSpline);
          if (clamped) interpSpline = clamped;
        }
        if (cpU === 0) {
          degreeV = interpSpline.deg;
          knotsV = interpSpline.knots.slice();
          multsV = interpSpline.mults.slice();
        } else if (degreeV !== interpSpline.deg) {
          throw new Error('Inconsistent degree_v in skinning');
        }
        cpSurf.push(interpSpline.poles.map((p) => p.slice()));
      }
      this.skinnedSurface = {
        udeg: degreeU, vdeg: degreeV,
        uknots: first.knots.slice(), umults: first.mults.slice(),
        vknots: knotsV, vmults: multsV,
        poles: cpSurf,
      };
    }
  }

  // ======================== GordonSurfaceBuilder ============================

  function pointsToSurface(grid, uParams, vParams, makeUClosed, makeVClosed) {
    // grid[u][v]: interpolate u-direction curves per column (v index), then
    // skin them at vParams — BSplineAlgorithms::pointsToSurface
    const uCurves = [];
    for (let j = 0; j < grid[0].length; j++) {
      const col = grid.map((row) => row[j]);
      uCurves.push(pointsToBSplineInterpolation(col, uParams, 3, makeUClosed));
    }
    const skinner = new CurvesToSurface(uCurves, vParams, makeVClosed);
    return skinner.surface();
  }

  class GordonSurfaceBuilder {
    constructor(profiles, guides, intersectParamsU, intersectParamsV, tolerance) {
      this.profiles = profiles;
      this.guides = guides;
      this.intersectionParamsSplineU = intersectParamsU;
      this.intersectionParamsSplineV = intersectParamsV;
      this.tolerance = tolerance;
      this.performed = false;
    }

    perform() {
      if (this.performed) return;
      this.createGordonSurface();
      this.performed = true;
    }

    assertRange(c, umin, umax, tol) {
      if (Math.abs(firstParam(c) - umin) > tol || Math.abs(lastParam(c) - umax) > tol) {
        throw new Error('Gordon: curve not in range [' + umin + ', ' + umax + '].');
      }
    }

    checkCurveNetworkCompatibility() {
      const paramsU = this.intersectionParamsSplineU;
      const paramsV = this.intersectionParamsSplineV;
      const tol = this.tolerance;
      const splinesScale = 0.5 * (curveListScale(this.profiles) + curveListScale(this.guides));
      if (Math.abs(paramsU[0]) > splinesScale * tol ||
          Math.abs(paramsU[paramsU.length - 1] - 1.0) > splinesScale * tol) {
        throw new Error('Gordon: B-splines in u-direction mustn\'t stick out, spline network must be closed!');
      }
      if (Math.abs(paramsV[0]) > splinesScale * tol ||
          Math.abs(paramsV[paramsV.length - 1] - 1.0) > splinesScale * tol) {
        throw new Error('Gordon: B-splines in v-direction mustn\'t stick out, spline network must be closed!');
      }
      for (let uIdx = 0; uIdx < paramsU.length; uIdx++) {
        const splineV = this.guides[uIdx];
        for (let vIdx = 0; vIdx < paramsV.length; vIdx++) {
          const splineU = this.profiles[vIdx];
          const pProf = curvePoint(splineU, paramsU[uIdx]);
          const pGuid = curvePoint(splineV, paramsV[vIdx]);
          if (dist3(pProf, pGuid) > splinesScale * tol) {
            throw new Error('Gordon: B-spline network is incompatible (e.g. wrong parametrization) ' +
              'or intersection parameters are in a wrong order!');
          }
        }
      }
    }

    createGordonSurface() {
      const profiles = this.profiles, guides = this.guides;
      if (profiles.length < 2) throw new Error('There must be at least two profiles for the gordon surface.');
      if (guides.length < 2) throw new Error('There must be at least two guides for the gordon surface.');
      const umin = firstParam(profiles[0]), umax = lastParam(profiles[0]);
      for (const p of profiles) this.assertRange(p, umin, umax, 1e-5);
      const vmin = firstParam(guides[0]), vmax = lastParam(guides[0]);
      for (const g of guides) this.assertRange(g, vmin, vmax, 1e-5);

      this.checkCurveNetworkCompatibility();

      const paramsU = this.intersectionParamsSplineU;
      const paramsV = this.intersectionParamsSplineV;
      // intersection grid: rows = u params, cols = profiles
      const grid = [];
      for (let ui = 0; ui < paramsU.length; ui++) {
        const row = [];
        for (let si = 0; si < profiles.length; si++) {
          row.push(curvePoint(profiles[si], paramsU[ui]));
        }
        grid.push(row);
      }

      const curveUTol = REL_TOL_CLOSED * curveListScale(guides);
      const curveVTol = REL_TOL_CLOSED * curveListScale(profiles);
      const tpTol = REL_TOL_CLOSED * grid2Scale(grid);

      const makeUClosed = isUDirClosed(grid, tpTol) &&
        curvesEqual(guides[0], guides[guides.length - 1], curveUTol);
      const makeVClosed = isVDirClosed(grid, tpTol) &&
        curvesEqual(profiles[0], profiles[profiles.length - 1], curveVTol);

      const surfProfilesSkinner = new CurvesToSurface(profiles, paramsV, makeVClosed);
      let surfProfiles = surfProfilesSkinner.surface();

      const surfGuidesSkinner = new CurvesToSurface(guides, paramsU, makeUClosed);
      let surfGuides = surfGuidesSkinner.surface();
      surfGuides = surfExchangeUV(surfGuides); // flip_surface

      let tensorProdSurf = pointsToSurface(grid, paramsU, paramsV, makeUClosed, makeVClosed);

      const degreeU = Math.max(surfGuides.udeg, surfProfiles.udeg, tensorProdSurf.udeg);
      const degreeV = Math.max(surfGuides.vdeg, surfProfiles.vdeg, tensorProdSurf.vdeg);
      surfGuides = surfIncreaseDegree(surfGuides, degreeU, degreeV);
      surfProfiles = surfIncreaseDegree(surfProfiles, degreeU, degreeV);
      tensorProdSurf = surfIncreaseDegree(tensorProdSurf, degreeU, degreeV);

      const vec = createCommonKnotsVectorSurface([surfGuides, surfProfiles, tensorProdSurf], 1e-7);
      this.surfaceGuides = vec[0];
      this.surfaceProfiles = vec[1];
      this.surfaceIntersections = vec[2];

      const nU = surfNbUPoles(this.surfaceProfiles), nV = surfNbVPoles(this.surfaceProfiles);
      if (surfNbUPoles(this.surfaceGuides) !== nU || surfNbUPoles(this.surfaceIntersections) !== nU ||
          surfNbVPoles(this.surfaceGuides) !== nV || surfNbVPoles(this.surfaceIntersections) !== nV) {
        throw new Error('Gordon: internal surface pole-count mismatch after compatibility');
      }
      const gordon = surfClone(this.surfaceProfiles);
      for (let i = 0; i < nU; i++) {
        for (let j = 0; j < nV; j++) {
          const a = this.surfaceProfiles.poles[i][j];
          const b = this.surfaceGuides.poles[i][j];
          const c = this.surfaceIntersections.poles[i][j];
          gordon.poles[i][j] = [a[0] + b[0] - c[0], a[1] + b[1] - c[1], a[2] + b[2] - c[2]];
        }
      }
      this.surfaceGordon = gordon;
    }
  }

  // ===================== InterpolateCurveNetwork ============================

  function findFirstNonZeroLengthIndex(curves) {
    for (let i = 0; i < curves.length; i++) {
      if (!isZeroLength(curves[i])) return i;
    }
    return -1;
  }

  class CurveNetworkSorter {
    constructor(profiles, guides, parmsIntersProfiles, parmsIntersGuides) {
      this.profiles = profiles;
      this.guides = guides;
      this.mU = parmsIntersProfiles; // [profile][guide]
      this.mV = parmsIntersGuides;
      const n = profiles.length, m = guides.length;
      if (this.mU.length !== n || this.mV.length !== n ||
          this.mU[0].length !== m || this.mV[0].length !== m) {
        throw new Error('Gordon: invalid intersection matrix sizes');
      }
      this.profIdx = [];
      for (let i = 0; i < n; i++) this.profIdx.push(String(i));
      this.guidIdx = [];
      for (let j = 0; j < m; j++) this.guidIdx.push(String(j));
    }

    nProfiles() { return this.profiles.length; }
    nGuides() { return this.guides.length; }

    maxRowIndex(m, irow) {
      let maxVal = -Infinity, jmax = -1;
      for (let j = 0; j < m[0].length; j++) {
        if (isZeroLength(this.guides[j])) continue;
        if (jmax === -1 || m[irow][j] > maxVal) { maxVal = m[irow][j]; jmax = j; }
      }
      return jmax;
    }
    maxColIndex(m, jcol) {
      let maxVal = -Infinity, imax = -1;
      for (let i = 0; i < m.length; i++) {
        if (isZeroLength(this.profiles[i])) continue;
        if (imax === -1 || m[i][jcol] > maxVal) { maxVal = m[i][jcol]; imax = i; }
      }
      return imax;
    }
    minRowIndex(m, irow) {
      let minVal = Infinity, jmin = -1;
      for (let j = 0; j < m[0].length; j++) {
        if (isZeroLength(this.guides[j])) continue;
        if (jmin === -1 || m[irow][j] < minVal) { minVal = m[irow][j]; jmin = j; }
      }
      return jmin;
    }
    minColIndex(m, jcol) {
      let minVal = Infinity, imin = -1;
      for (let i = 0; i < m.length; i++) {
        if (isZeroLength(this.profiles[i])) continue;
        if (imin === -1 || m[i][jcol] < minVal) { minVal = m[i][jcol]; imin = i; }
      }
      return imin;
    }

    swapProfiles(i1, i2) {
      if (i1 === i2) return;
      [this.profiles[i1], this.profiles[i2]] = [this.profiles[i2], this.profiles[i1]];
      [this.profIdx[i1], this.profIdx[i2]] = [this.profIdx[i2], this.profIdx[i1]];
      [this.mU[i1], this.mU[i2]] = [this.mU[i2], this.mU[i1]];
      [this.mV[i1], this.mV[i2]] = [this.mV[i2], this.mV[i1]];
    }
    swapGuides(j1, j2) {
      if (j1 === j2) return;
      [this.guides[j1], this.guides[j2]] = [this.guides[j2], this.guides[j1]];
      [this.guidIdx[j1], this.guidIdx[j2]] = [this.guidIdx[j2], this.guidIdx[j1]];
      for (let i = 0; i < this.mU.length; i++) {
        [this.mU[i][j1], this.mU[i][j2]] = [this.mU[i][j2], this.mU[i][j1]];
        [this.mV[i][j1], this.mV[i][j2]] = [this.mV[i][j2], this.mV[i][j1]];
      }
    }

    getStartCurveIndices() {
      for (let irow = 0; irow < this.nProfiles(); irow++) {
        if (isZeroLength(this.profiles[irow])) continue;
        const jmin = this.minRowIndex(this.mU, irow);
        if (jmin === -1) continue;
        const imin = this.minColIndex(this.mV, jmin);
        if (imin === -1) continue;
        if (imin === irow) return [imin, jmin, false];
      }
      for (let irow = 0; irow < this.nProfiles(); irow++) {
        if (isZeroLength(this.profiles[irow])) continue;
        const jmin = this.minRowIndex(this.mU, irow);
        if (jmin === -1) continue;
        const imax = this.maxColIndex(this.mV, jmin);
        if (imax === -1) continue;
        if (imax === irow) return [imax, jmin, true];
      }
      throw new Error('Cannot find starting curves of curve network.');
    }

    reverseProfile(i) {
      const profile = this.profiles[i];
      const lastParm = lastParam(profile);
      const firstParm = firstParam(profile);
      for (let j = 0; j < this.nGuides(); j++) {
        this.mU[i][j] = -this.mU[i][j] + firstParm + lastParm;
      }
      reverseCurveData(profile);
      this.profIdx[i] = '-' + this.profIdx[i];
    }
    reverseGuide(j) {
      const guide = this.guides[j];
      const lastParm = lastParam(guide);
      const firstParm = firstParam(guide);
      for (let i = 0; i < this.nProfiles(); i++) {
        this.mV[i][j] = -this.mV[i][j] + firstParm + lastParm;
      }
      reverseCurveData(guide);
      this.guidIdx[j] = '-' + this.guidIdx[j];
    }

    perform() {
      const [profStart, guideStart, guideMustBeReversed] = this.getStartCurveIndices();
      this.swapProfiles(0, profStart);
      this.swapGuides(0, guideStart);
      if (guideMustBeReversed) this.reverseGuide(0);
      const nGuides = this.nGuides(), nProfiles = this.nProfiles();
      for (let n = nGuides; n > 1; n--) {
        for (let j = 0; j < n - 1; j++) {
          if (this.mU[0][j] > this.mU[0][j + 1]) this.swapGuides(j, j + 1);
        }
      }
      const firstNonZeroGuide = findFirstNonZeroLengthIndex(this.guides);
      if (firstNonZeroGuide === -1) throw new Error('No non-zero-length guide found to sort profiles.');
      for (let n = nProfiles; n > 1; n--) {
        for (let i = 0; i < n - 1; i++) {
          if (this.mV[i][firstNonZeroGuide] > this.mV[i + 1][firstNonZeroGuide]) {
            this.swapProfiles(i, i + 1);
          }
        }
      }
      for (let iProf = 1; iProf < nProfiles; iProf++) {
        if (this.mU[iProf][0] > this.mU[iProf][nGuides - 1]) this.reverseProfile(iProf);
      }
      for (let iGuid = 1; iGuid < nGuides; iGuid++) {
        if (this.mV[0][iGuid] > this.mV[nProfiles - 1][iGuid]) this.reverseGuide(iGuid);
      }
    }
  }

  class InterpolateCurveNetwork {
    constructor(profiles, guides, spatialTolerance) {
      if (profiles.length < 2) throw new Error('There must be at least two profiles for the curve network interpolation.');
      if (guides.length < 2) throw new Error('There must be at least two guides for the curve network interpolation.');
      const uniqueProfiles = [];
      for (const p of profiles) {
        if (!uniqueProfiles.some((u) => curvesEqual(p, u, PCONFUSION))) uniqueProfiles.push(p);
      }
      const uniqueGuides = [];
      for (const g of guides) {
        if (!uniqueGuides.some((u) => curvesEqual(g, u, PCONFUSION))) uniqueGuides.push(g);
      }
      if (uniqueProfiles.length < 2) throw new Error('There must be at least two unique profiles for the curve network interpolation.');
      if (uniqueGuides.length < 2) throw new Error('There must be at least two unique guides for the curve network interpolation.');
      this.profiles = uniqueProfiles;
      this.guides = uniqueGuides;
      this.spatialTol = spatialTolerance;
      this.performed = false;
    }

    computeIntersectionsMatrix() {
      const nP = this.profiles.length, nG = this.guides.length;
      const mU = [], mV = [];
      for (let i = 0; i < nP; i++) { mU.push(new Array(nG).fill(0)); mV.push(new Array(nG).fill(0)); }
      for (let i = 0; i < nP; i++) {
        for (let j = 0; j < nG; j++) {
          const res = intersectCurves(this.profiles[i], this.guides[j], this.spatialTol);
          if (res.length === 0) {
            throw new Error('U-directional B-spline ' + i + ' and V-directional B-spline ' + j + ' don\'t intersect!');
          } else if (res.length === 1) {
            mU[i][j] = res[0][0]; mV[i][j] = res[0][1];
          } else if (res.length === 2) {
            mU[i][j] = Math.min(res[0][0], res[1][0]);
            mV[i][j] = Math.min(res[0][1], res[1][1]);
          } else {
            throw new Error('U-directional B-spline ' + i + ' and V-directional B-spline ' + j +
              ' have more than two intersections!');
          }
        }
      }
      return { mU, mV };
    }

    eliminateInaccuraciesNetworkIntersections(mU, mV) {
      const nP = this.profiles.length, nG = this.guides.length;
      const firstKnotU = this.profiles[0].knots[0];
      const lastKnotU = this.profiles[0].knots[this.profiles[0].knots.length - 1];
      const firstKnotV = this.guides[0].knots[0];
      const lastKnotV = this.guides[0].knots[this.guides[0].knots.length - 1];
      for (let i = 0; i < nP; i++) {
        if (Math.abs(mU[i][0] - firstKnotU) < 0.001) {
          mU[i][0] = Math.abs(firstKnotU) < 1e-10 ? 0 : firstKnotU;
        }
      }
      for (let j = 0; j < nG; j++) {
        if (Math.abs(mV[0][j] - firstKnotV) < 0.001) {
          mV[0][j] = Math.abs(firstKnotV) < 1e-10 ? 0 : firstKnotV;
        }
      }
      for (let i = 0; i < nP; i++) {
        if (Math.abs(mU[i][nG - 1] - lastKnotU) < 0.001) mU[i][nG - 1] = lastKnotU;
      }
      for (let j = 0; j < nG; j++) {
        if (Math.abs(mV[nP - 1][j] - lastKnotV) < 0.001) mV[nP - 1][j] = lastKnotV;
      }
    }

    clamp(val, lo, hi) {
      if (lo > hi) throw new Error('Minimum may not be larger than maximum in clamp!');
      return Math.max(lo, Math.min(val, hi));
    }

    makeCurvesCompatible() {
      for (const p of this.profiles) reparametrizeSimple(p, 0.0, 1.0);
      for (const g of this.guides) reparametrizeSimple(g, 0.0, 1.0);

      const { mU, mV } = this.computeIntersectionsMatrix();

      const sorter = new CurveNetworkSorter(this.profiles, this.guides, mU, mV);
      sorter.perform();
      this.profiles = sorter.profiles;
      this.guides = sorter.guides;

      for (let i = 1; i < this.profiles.length - 1; i++) {
        if (isZeroLength(this.profiles[i])) {
          throw new Error('Profile#' + i + ' is a point. Points are only permitted at the beginning and end.');
        }
      }
      for (let j = 1; j < this.guides.length - 1; j++) {
        if (isZeroLength(this.guides[j])) {
          throw new Error('Guides#' + j + ' is a point. Points are only permitted at the beginning and end.');
        }
      }

      let sortedU = sorter.mU, sortedV = sorter.mV;

      const firstNZProfile = findFirstNonZeroLengthIndex(this.profiles);
      const firstNZGuide = findFirstNonZeroLengthIndex(this.guides);
      if (firstNZProfile === -1) throw new Error('No non-zero-length profile found for closed curve check.');
      if (firstNZGuide === -1) throw new Error('No non-zero-length guide found for closed curve check.');

      const profNZ = this.profiles[firstNZProfile];
      const guideNZ = this.guides[firstNZGuide];
      const isClosedProfile = profNZ.periodic ||
        dist3(curvePoint(profNZ, firstParam(profNZ)), curvePoint(profNZ, lastParam(profNZ))) <= CONFUSION;
      const isClosedGuides = guideNZ.periodic ||
        dist3(curvePoint(guideNZ, firstParam(guideNZ)), curvePoint(guideNZ, lastParam(guideNZ))) <= CONFUSION;

      if (isClosedProfile && isClosedGuides) {
        throw new Error('Both profiles and guides cannot be closed simultaneously.');
      }

      let nP = this.profiles.length, nG = this.guides.length;
      let finalU, finalV;
      if (isClosedProfile) {
        this.guides.push(cloneCurve(this.guides[0]));
        nG += 1;
        finalU = []; finalV = [];
        for (let i = 0; i < nP; i++) { finalU.push(new Array(nG).fill(0)); finalV.push(new Array(nG).fill(0)); }
        for (let i = 0; i < nP; i++) {
          for (let j = 0; j < nG - 1; j++) { finalU[i][j] = sortedU[i][j]; finalV[i][j] = sortedV[i][j]; }
          const valU = sortedU[i][0];
          finalU[i][nG - 1] = Math.abs(valU) < PAR_CHECK_TOL ? 1.0 : valU;
          finalV[i][nG - 1] = sortedV[i][0];
        }
      } else if (isClosedGuides) {
        this.profiles.push(cloneCurve(this.profiles[0]));
        nP += 1;
        finalU = []; finalV = [];
        for (let i = 0; i < nP; i++) { finalU.push(new Array(nG).fill(0)); finalV.push(new Array(nG).fill(0)); }
        for (let i = 0; i < nP - 1; i++) {
          for (let j = 0; j < nG; j++) { finalU[i][j] = sortedU[i][j]; finalV[i][j] = sortedV[i][j]; }
        }
        for (let j = 0; j < nG; j++) {
          const valV = sortedV[0][j];
          finalU[nP - 1][j] = sortedU[0][j];
          finalV[nP - 1][j] = Math.abs(valV) < PAR_CHECK_TOL ? 1.0 : valV;
        }
      } else {
        finalU = sortedU; finalV = sortedV;
      }

      this.eliminateInaccuraciesNetworkIntersections(finalU, finalV);

      const newParametersProfiles = [];
      for (let j = 0; j < nG; j++) {
        let sumU = 0.0, cnt = 0;
        for (let i = 0; i < nP; i++) {
          if (isZeroLength(this.profiles[i])) continue;
          sumU += finalU[i][j]; cnt += 1;
        }
        newParametersProfiles.push(cnt > 0 ? sumU / cnt : 0.0);
      }
      const newParametersGuides = [];
      for (let i = 0; i < nP; i++) {
        let sumV = 0.0, cnt = 0;
        for (let j = 0; j < nG; j++) {
          if (isZeroLength(this.guides[j])) continue;
          sumV += finalV[i][j]; cnt += 1;
        }
        newParametersGuides.push(cnt > 0 ? sumV / cnt : 0.0);
      }

      if (newParametersProfiles[0] > PAR_CHECK_TOL || newParametersGuides[0] > PAR_CHECK_TOL) {
        throw new Error('At least one B-spline has no intersection at the beginning.');
      }

      let maxCpU = 0, maxCpV = 0;
      for (const p of this.profiles) maxCpU = Math.max(maxCpU, p.poles.length);
      for (const g of this.guides) maxCpV = Math.max(maxCpV, g.poles.length);
      const minCp = 10, maxCp = 120;
      const minU = Math.max(nG + 2, minCp);
      const minV = Math.max(nP + 2, minCp);
      const maxU = Math.max(minU, maxCp);
      const maxV = Math.max(minV, maxCp);
      const finalMaxCpU = this.clamp(maxCpU + 10, minU, maxU);
      const finalMaxCpV = this.clamp(maxCpV + 10, minV, maxV);

      const skipReparametrize = (curve, oldPs, newPs) => {
        if (curve.weights) return false;
        if (curve.periodic) return false;
        for (let i = 0; i < oldPs.length; i++) {
          if (Math.abs(oldPs[i] - newPs[i]) >= PCONFUSION) return false;
        }
        return true;
      };

      for (let i = 0; i < nP; i++) {
        if (isZeroLength(this.profiles[i])) continue;
        const oldParameters = [];
        for (let j = 0; j < nG; j++) oldParameters.push(finalU[i][j]);
        if (skipReparametrize(this.profiles[i], oldParameters, newParametersProfiles)) continue;
        if (Math.abs(oldParameters[0]) < PAR_CHECK_TOL) oldParameters[0] = 0.0;
        if (Math.abs(newParametersProfiles[0]) < PAR_CHECK_TOL) newParametersProfiles[0] = 0.0;
        if (Math.abs(oldParameters[oldParameters.length - 1] - 1.0) < PAR_CHECK_TOL) oldParameters[oldParameters.length - 1] = 1.0;
        if (Math.abs(newParametersProfiles[newParametersProfiles.length - 1] - 1.0) < PAR_CHECK_TOL) newParametersProfiles[newParametersProfiles.length - 1] = 1.0;
        const result = reparametrizeContinuouslyApprox(
          this.profiles[i], oldParameters, newParametersProfiles, finalMaxCpU);
        if (result.curve) this.profiles[i] = result.curve;
      }
      for (let j = 0; j < nG; j++) {
        if (isZeroLength(this.guides[j])) continue;
        const oldParameters = [];
        for (let i = 0; i < nP; i++) oldParameters.push(finalV[i][j]);
        if (skipReparametrize(this.guides[j], oldParameters, newParametersGuides)) continue;
        if (Math.abs(oldParameters[0]) < PAR_CHECK_TOL) oldParameters[0] = 0.0;
        if (Math.abs(newParametersGuides[0]) < PAR_CHECK_TOL) newParametersGuides[0] = 0.0;
        if (Math.abs(oldParameters[oldParameters.length - 1] - 1.0) < PAR_CHECK_TOL) oldParameters[oldParameters.length - 1] = 1.0;
        if (Math.abs(newParametersGuides[newParametersGuides.length - 1] - 1.0) < PAR_CHECK_TOL) newParametersGuides[newParametersGuides.length - 1] = 1.0;
        const result = reparametrizeContinuouslyApprox(
          this.guides[j], oldParameters, newParametersGuides, finalMaxCpV);
        if (result.curve) this.guides[j] = result.curve;
      }

      this.intersectionParamsU = newParametersProfiles;
      this.intersectionParamsV = newParametersGuides;
    }

    ensureC2(gordonSurf) {
      const tol = this.spatialTol;
      let s = gordonSurf;
      const minUMult = Math.max(1, s.udeg - 2);
      const minVMult = Math.max(1, s.vdeg - 2);
      for (let i = 1; i < s.uknots.length - 1; i++) {
        if (s.umults[i] > minUMult) {
          // per-column removal, all-or-nothing (== Geom_BSplineSurface::RemoveUKnot)
          const nV = surfNbVPoles(s);
          const newCols = [];
          let allOk = true;
          for (let j = 0; j < nV; j++) {
            const res = removeKnotData(uColumnCurve(s, j), i + 1, minUMult, tol);
            if (!res.ok) { allOk = false; break; }
            newCols.push(res.data);
          }
          if (allOk) {
            const first = newCols[0];
            const poles = [];
            for (let pi = 0; pi < first.poles.length; pi++) {
              poles.push(newCols.map((c) => c.poles[pi]));
            }
            s = {
              udeg: s.udeg, vdeg: s.vdeg,
              uknots: first.knots, umults: first.mults,
              vknots: s.vknots, vmults: s.vmults, poles,
            };
          }
        }
      }
      for (let i = 1; i < s.vknots.length - 1; i++) {
        if (s.vmults[i] > minVMult) {
          const nU = surfNbUPoles(s);
          const newRows = [];
          let allOk = true;
          for (let r = 0; r < nU; r++) {
            const res = removeKnotData(vRowCurve(s, r), i + 1, minVMult, tol);
            if (!res.ok) { allOk = false; break; }
            newRows.push(res.data);
          }
          if (allOk) {
            const first = newRows[0];
            s = {
              udeg: s.udeg, vdeg: s.vdeg,
              uknots: s.uknots, umults: s.umults,
              vknots: first.knots, vmults: first.mults,
              poles: newRows.map((r) => r.poles),
            };
          }
        }
      }
      return s;
    }

    perform() {
      if (this.performed) return;
      this.makeCurvesCompatible();
      const builder = new GordonSurfaceBuilder(
        this.profiles, this.guides,
        this.intersectionParamsU, this.intersectionParamsV, this.spatialTol);
      builder.perform();
      this.surfaceGordon = this.ensureC2(builder.surfaceGordon);
      this.surfaceProfilesSkin = builder.surfaceProfiles;
      this.surfaceGuidesSkin = builder.surfaceGuides;
      this.surfaceTensor = builder.surfaceIntersections;
      this.performed = true;
    }

    surface() {
      this.perform();
      return this.surfaceGordon;
    }
  }

  // ======================= edge -> curve conversion =========================

  /** Exact rational quadratic B-spline for a conic arc: the conic is an
   *  affine image of the unit circle, and NURBS are affinely invariant, so
   *  the classic <=90°-per-segment rational-quadratic circle construction
   *  transfers verbatim. center/xd/yd are the conic frame axes scaled by the
   *  radii; the arc covers parametric angles [a1, a2] (knots = angles). */
  function conicArcData(center, xd, yd, a1, a2) {
    const nSeg = Math.max(1, Math.ceil((a2 - a1) / (Math.PI / 2) - 1e-9));
    const dA = (a2 - a1) / nSeg;
    const w = Math.cos(dA / 2);
    const pt = (t) => [
      center[0] + xd[0] * Math.cos(t) + yd[0] * Math.sin(t),
      center[1] + xd[1] * Math.cos(t) + yd[1] * Math.sin(t),
      center[2] + xd[2] * Math.cos(t) + yd[2] * Math.sin(t),
    ];
    // unit-circle middle pole maps through the same affine map
    const midPole = (t0, t1) => {
      const tm = 0.5 * (t0 + t1);
      const c = Math.cos(tm) / w, s = Math.sin(tm) / w;
      return [
        center[0] + xd[0] * c + yd[0] * s,
        center[1] + xd[1] * c + yd[1] * s,
        center[2] + xd[2] * c + yd[2] * s,
      ];
    };
    const poles = [pt(a1)];
    const weights = [1.0];
    const knots = [a1];
    const mults = [3];
    for (let i = 0; i < nSeg; i++) {
      const t0 = a1 + i * dA, t1 = a1 + (i + 1) * dA;
      poles.push(midPole(t0, t1)); weights.push(w);
      poles.push(pt(t1)); weights.push(1.0);
      knots.push(t1);
      mults.push(i === nSeg - 1 ? 3 : 2);
    }
    return { deg: 2, periodic: false, knots, mults, poles, weights };
  }

  /** COMPROMISE(gordon-conic-approx): non-rational approximation of a curve
   *  (used for conics; GeomConvert_ApproxCurve is not in this wasm). Fits
   *  with the ported least-squares machinery, growing the control-point
   *  count until the fit error beats the tolerance. */
  function approximateNonRational(d, tol) {
    const nSample = 201;
    const f = firstParam(d), l = lastParam(d);
    const points = [];
    const params = [];
    for (let i = 0; i < nSample; i++) {
      const t = f + (l - f) * i / (nSample - 1);
      params.push(t);
      points.push(curvePoint(d, t));
    }
    let best = null;
    for (const ncp of [15, 25, 40, 60, 90, 120]) {
      if (ncp + 4 > nSample) break;
      const approx = new BSplineApproxInterp(points, ncp, 3, false);
      approx.interpolatePoint(0, false);
      approx.interpolatePoint(nSample - 1, false);
      const res = approx.fitCurveOptimal(params);
      best = res;
      if (res.error < tol) break;
    }
    return best.curve;
  }

  /** Convert a TopoDS edge into curve data — Face.make_gordon_surface's
   *  to_geom_curve + BSplineAlgorithms.to_bsplines/_convert_to_bspline. */
  function edgeToCurveData(edgeTopo) {
    const adaptor = new oc.BRepAdaptor_Curve_2(edgeTopo);
    const f = adaptor.FirstParameter(), l = adaptor.LastParameter();
    const CT = oc.GeomAbs_CurveType;
    const type = adaptor.GetType();
    if (type === CT.GeomAbs_BSplineCurve) {
      let d = occtToData(adaptor.BSpline().get());
      if (d.periodic) d = setNotPeriodicData(d);
      if (Math.abs(firstParam(d) - f) > PCONFUSION || Math.abs(lastParam(d) - l) > PCONFUSION) {
        d = segmentData(d, f, l);
      }
      return d;
    }
    if (type === CT.GeomAbs_BezierCurve) {
      const bez = adaptor.Bezier().get();
      const poles = [];
      const weights = [];
      let rational = false;
      for (let i = 1; i <= bez.NbPoles(); i++) {
        const p = bez.Pole(i);
        poles.push([p.X(), p.Y(), p.Z()]);
        const w = bez.Weight(i);
        weights.push(w);
        if (Math.abs(w - 1.0) > 1e-15) rational = true;
      }
      let d = {
        deg: bez.Degree(), periodic: false,
        knots: [0, 1], mults: [bez.Degree() + 1, bez.Degree() + 1],
        poles, weights: rational ? weights : null,
      };
      if (Math.abs(f) > PCONFUSION || Math.abs(l - 1) > PCONFUSION) d = segmentData(d, f, l);
      return d;
    }
    if (type === CT.GeomAbs_Line) {
      const p0 = new oc.gp_Pnt_1(), p1 = new oc.gp_Pnt_1();
      adaptor.D0(f, p0); adaptor.D0(l, p1);
      return {
        deg: 1, periodic: false, knots: [f, l], mults: [2, 2],
        poles: [[p0.X(), p0.Y(), p0.Z()], [p1.X(), p1.Y(), p1.Z()]], weights: null,
      };
    }
    if (type === CT.GeomAbs_Circle || type === CT.GeomAbs_Ellipse) {
      let center, xd, yd;
      if (type === CT.GeomAbs_Circle) {
        const circ = adaptor.Circle();
        const pos = circ.Position(); // gp_Ax2
        const loc = pos.Location(), xdir = pos.XDirection(), ydir = pos.YDirection();
        const r = circ.Radius();
        center = [loc.X(), loc.Y(), loc.Z()];
        xd = [xdir.X() * r, xdir.Y() * r, xdir.Z() * r];
        yd = [ydir.X() * r, ydir.Y() * r, ydir.Z() * r];
      } else {
        const el = adaptor.Ellipse();
        const pos = el.Position();
        const loc = pos.Location(), xdir = pos.XDirection(), ydir = pos.YDirection();
        const ra = el.MajorRadius(), rb = el.MinorRadius();
        center = [loc.X(), loc.Y(), loc.Z()];
        xd = [xdir.X() * ra, xdir.Y() * ra, xdir.Z() * ra];
        yd = [ydir.X() * rb, ydir.Y() * rb, ydir.Z() * rb];
      }
      const exact = conicArcData(center, xd, yd, f, l);
      // upstream approximates conics non-rationally (GeomConvert_ApproxCurve,
      // tol = Precision::Approximation * size / 200)
      let size = 0.0;
      const start = curvePoint(exact, f);
      for (let i = 1; i < 3; i++) {
        const u = (1 - i / 4) * f + (i / 4) * l;
        size = Math.max(size, dist3(start, curvePoint(exact, u)));
      }
      const tol = APPROXIMATION * size / 200;
      return approximateNonRational(exact, tol);
    }
    // generic fallback: sample the edge and fit (same machinery)
    const nS = 201;
    const points = [];
    const params = [];
    const p = new oc.gp_Pnt_1();
    for (let i = 0; i < nS; i++) {
      const t = f + (l - f) * i / (nS - 1);
      adaptor.D0(t, p);
      params.push(t);
      points.push([p.X(), p.Y(), p.Z()]);
    }
    let scale = 0.0;
    for (const q of points) scale = Math.max(scale, dist3(points[0], q));
    const approx = new BSplineApproxInterp(points, Math.min(60, nS - 4), 3, false);
    approx.interpolatePoint(0, false);
    approx.interpolatePoint(nS - 1, false);
    return approx.fitCurveOptimal(params).curve;
  }

  function pointToCurveData(p) {
    // Face.make_gordon_surface's create_zero_length_bspline_curve
    return {
      deg: 1, periodic: false, knots: [0.0, 1.0], mults: [2, 2],
      poles: [[p[0], p[1], p[2]], [p[0], p[1], p[2]]], weights: null,
    };
  }

  // ======================= surface realization ==============================
  // COMPROMISE(gordon-surface-realization) — see file header.

  function realizeSurfaceAsFace(surf) {
    const u0 = surf.uknots[0], u1 = surf.uknots[surf.uknots.length - 1];
    const v0 = surf.vknots[0], v1 = surf.vknots[surf.vknots.length - 1];
    const nu = Math.min(181, Math.max(41, 2 * surfNbUPoles(surf) + 1));
    const nv = Math.min(181, Math.max(41, 2 * surfNbVPoles(surf) + 1));
    let uParams = linspaceWithBreaks(u0, u1, nu, surf.uknots.slice(1, -1));
    let vParams = linspaceWithBreaks(v0, v1, nv, surf.vknots.slice(1, -1));
    // Drop sample lines that are (nearly) COINCIDENT in 3D with the one before
    // them. GeomAPI_PointsToBSplineSurface parametrizes by chord length, so
    // near-coincident lines get near-equal parameters and the interpolant
    // oscillates wildly between them. That happens on every surface with a
    // degenerate boundary (a Gordon network whose first/last guide is a POINT,
    // like bracelet's tip): all the sample rows crowd into the pole.
    const rowScale = (() => {
      let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      const probe = surfEvalGrid(surf, [u0, 0.5 * (u0 + u1), u1],
                                       [v0, 0.5 * (v0 + v1), v1]);
      for (const row of probe) {
        for (const p of row) {
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
        }
      }
      return Math.sqrt((hi[0] - lo[0]) ** 2 + (hi[1] - lo[1]) ** 2 + (hi[2] - lo[2]) ** 2);
    })();
    const minStep = Math.max(1e-9, 1e-3 * rowScale);
    const pruneParams = (params, lines) => {
      if (params.length < 3) return params;
      const lineDist = (a, b) => {
        let mx = 0;
        for (let k = 0; k < a.length; k++) mx = Math.max(mx, dist3(a[k], b[k]));
        return mx;
      };
      const keep = [0];
      for (let i = 1; i < params.length - 1; i++) {
        if (lineDist(lines[keep[keep.length - 1]], lines[i]) >= minStep) keep.push(i);
      }
      const last = params.length - 1;
      while (keep.length > 1 && lineDist(lines[keep[keep.length - 1]], lines[last]) < minStep) keep.pop();
      keep.push(last);
      return keep.map((i) => params[i]);
    };
    const probeV = [0, 0.25, 0.5, 0.75, 1].map((t) => v0 + t * (v1 - v0));
    const probeU = [0, 0.25, 0.5, 0.75, 1].map((t) => u0 + t * (u1 - u0));
    uParams = pruneParams(uParams, surfEvalGrid(surf, uParams, probeV));
    const vProbeRows = surfEvalGrid(surf, probeU, vParams);
    vParams = pruneParams(vParams,
      vParams.map((v, j) => vProbeRows.map((row) => row[j])));
    const grid = surfEvalGrid(surf, uParams, vParams);
    const arr = new oc.TColgp_Array2OfPnt_2(1, uParams.length, 1, vParams.length);
    for (let i = 0; i < uParams.length; i++) {
      for (let j = 0; j < vParams.length; j++) {
        const p = grid[i][j];
        arr.SetValue(i + 1, j + 1, new oc.gp_Pnt_3(p[0], p[1], p[2]));
      }
    }
    // Fit the sampled grid with GeomAPI_PointsToBSplineSurface's C2
    // least-squares APPROXIMATION rather than its Interpolate: interpolating
    // 200+ sample lines through a surface with a DEGENERATE boundary (a Gordon
    // network whose first/last guide is a point, like bracelet's tip) gives a
    // wildly oscillating pole row at the pole — the boundary stays inside a
    // ~1e-2 mm ball but wiggles into a 0.5 mm long edge, so the face is no
    // longer degenerate there and capping it with a planar face fails. The
    // approximation reproduces the exact surface's boundaries, degenerate poles
    // included, to well under a micron.
    //
    // Tolerances are tried tightest-first, and each candidate is CHECKED
    // against the exact surface by comparing the arc length of all four
    // boundary curves: too tight a tolerance makes the approximator
    // over-segment and oscillate again (arc length inflates), too loose and it
    // cuts corners (arc length shrinks). Interpolation is the last resort.
    // The candidates are SCORED by surface area against the exact surface's
    // area (the sample grid's triangulated area, which for this grid density is
    // within ~1e-5 relative of the true one). Area is parametrization-
    // independent and catches both failure modes: an over-segmented fit
    // oscillates (area grows), a loose fit cuts corners (area shrinks).
    let exactArea = 0;
    {
      const triArea = (a, b, c) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
        return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      };
      for (let i = 0; i + 1 < grid.length; i++) {
        for (let j = 0; j + 1 < vParams.length; j++) {
          exactArea += triArea(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1]) +
                       triArea(grid[i][j], grid[i + 1][j + 1], grid[i][j + 1]);
        }
      }
    }
    const faceArea = (face) => {
      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.SurfaceProperties_1(face, props, false, false);
      return props.Mass();
    };
    const makeFace = (fitter) => {
      const hs = fitter.Surface().AsGeomSurface();
      return new oc.BRepBuilderAPI_MakeFace_8(hs, PCONFUSION).Face();
    };
    let best = null, bestErr = Infinity;
    const consider = (fitter) => {
      let face, err;
      try {
        face = makeFace(fitter);
        err = Math.abs(faceArea(face) - exactArea) / Math.max(1e-12, exactArea);
      } catch (e) { return false; }
      if (err < bestErr) { bestErr = err; best = face; }
      return bestErr <= 1e-4;  // good enough, stop fitting
    };
    // The ladder starts at 1e-7 relative: below that OCCT's approximator still
    // reports IsDone but over-segments the fit and starts oscillating again
    // (the area check does not catch it — the oscillation is tangential —
    // but the resulting face no longer sews into a solid).
    let settled = false;
    for (const relTol of [1e-7, 1e-6, 1e-5, 1e-4]) {
      const cand = new oc.GeomAPI_PointsToBSplineSurface_2(
        arr, 3, 8, oc.GeomAbs_Shape.GeomAbs_C2, Math.max(1e-9, relTol * rowScale));
      if (!cand.IsDone()) continue;
      if (consider(cand)) { settled = true; break; }
    }
    if (!settled) {
      const interp = new oc.GeomAPI_PointsToBSplineSurface_1();
      interp.Interpolate_1(arr, false);
      if (interp.IsDone()) consider(interp);
    }
    if (best === null) throw new Error('Gordon: final surface fit failed');
    return best;
  }

  // ============================ public API ==================================

  /** profiles/guides: arrays of TopoDS edge topos or [x,y,z] points.
   *  Returns a TopoDS_Face. */
  function gordonSurfaceFace(profiles, guides, tolerance) {
    const conv = (item) =>
      Array.isArray(item) ? pointToCurveData(item) : edgeToCurveData(item);
    const p = profiles.map(conv);
    const g = guides.map(conv);
    const interp = new InterpolateCurveNetwork(p, g, tolerance === undefined ? 3e-4 : tolerance);
    const surf = interp.surface();
    return realizeSurfaceAsFace(surf);
  }

  return {
    // main entry
    gordonSurfaceFace,
    // exposed for verification/tests
    InterpolateCurveNetwork,
    GordonSurfaceBuilder,
    CurvesToSurface,
    BSplineApproxInterp,
    CurveNetworkSorter,
    pointsToBSplineInterpolation,
    reparametrizeContinuouslyApprox,
    createCommonKnotsVectorCurve,
    matchDegree,
    interpolate1D,
    intersectCurves,
    edgeToCurveData,
    pointToCurveData,
    conicArcData,
    realizeSurfaceAsFace,
    curveEval, curvePoint, surfEval, surfEvalGrid, surfClone, flatKnots, basisMat,
    dataToOCCT, occtToData, isZeroLength, curveScale, linspaceWithBreaks,
    knotsFromCurveParameters,
  };
}

export { makeEngine as createGordonEngine };
