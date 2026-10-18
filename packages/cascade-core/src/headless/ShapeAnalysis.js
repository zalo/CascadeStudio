// ShapeAnalysis.js — exact B-rep checks for hosts that answer questions
// about a model: the validity gate's edge→face map, solid overlaps,
// clearance, alignment, a face inventory and the inertia tensor.
//
// The checks and their vocabulary follow build123d-mcp's tools/validate.py,
// measure.py and align_check.py (github.com/pzfreo/build123d-mcp, Apache-2.0,
// Paul Fremantle and contributors); this is a reimplementation on the
// OCCT wasm bindings, not a copy of that code. Plain functions over `oc`
// (the OCCT module) and `S` (the worker scope, for SolidsVolume /
// SurfaceArea): nothing here touches the scene or the op cache.

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** Unique sub-shapes of `kind` ('TopAbs_SOLID', ...), as owned handles
 *  (call free() on the result). */
export function subShapes(oc, shape, kind) {
  const buckets = new Map();
  const out = [];
  const ex = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum[kind], oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; ex.More(); ex.Next()) {
    const cur = ex.Current();
    const h = oc.OCJS.HashCode(cur, 100000000);
    const bucket = buckets.get(h);
    if (bucket && bucket.some((b) => b.IsSame(cur))) { cur.delete(); continue; }
    if (bucket) { bucket.push(cur); } else { buckets.set(h, [cur]); }
    out.push(cur);
  }
  ex.delete();
  return out;
}

export function free(list) {
  for (const s of list || []) { try { s.delete(); } catch (e) { /* owned elsewhere */ } }
}

/** Fast axis-aligned box (BRepBndLib::Add, gap removed): [x0,y0,z0,x1,y1,z1]
 *  or null for an empty shape. */
export function fastBox(oc, shape) {
  const box = new oc.Bnd_Box_1();
  try {
    oc.BRepBndLib.Add(shape, box, false);
    if (box.IsVoid()) { return null; }
    box.SetGap(0);
    return [box.GetXMin(), box.GetYMin(), box.GetZMin(), box.GetXMax(), box.GetYMax(), box.GetZMax()];
  } finally { box.delete(); }
}

function edgeMidpoint(oc, edge) {
  let c = null;
  try {
    c = new oc.BRepAdaptor_Curve_2(edge);
    const p = c.Value((c.FirstParameter() + c.LastParameter()) / 2);
    const at = [r4(p.X()), r4(p.Y()), r4(p.Z())];
    p.delete();
    return at;
  } catch (e) { return null; } finally { if (c) { c.delete(); } }
}

/** The edge→face map: every non-degenerated edge of a closed manifold
 *  solid is used exactly twice (two faces, or a seam twice in one face).
 *  One use is an open boundary, three or more a non-manifold junction.
 *  Edges no face uses (free wires) are not boundaries and are skipped —
 *  build123d-mcp's _edge_defects, counted the way TopExp::
 *  MapShapesAndAncestors counts (per face occurrence).
 *  Returns {openEdges, nonManifoldEdges, defects: [{kind, at, uses}]}. */
export function edgeDefects(oc, shape, maxDefects = 20) {
  const buckets = new Map();
  const records = [];
  const exF = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exF.More(); exF.Next()) {
    const face = exF.Current();
    const exE = new oc.TopExp_Explorer_2(face, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for (; exE.More(); exE.Next()) {
      const e = exE.Current();
      const h = oc.OCJS.HashCode(e, 100000000);
      let list = buckets.get(h);
      if (!list) { list = []; buckets.set(h, list); }
      const rec = list.find((r) => r.edge.IsSame(e));
      if (rec) { rec.uses++; e.delete(); continue; }
      const r = { edge: e, uses: 1 };
      list.push(r);
      records.push(r);
    }
    exE.delete();
    face.delete();
  }
  exF.delete();
  let openEdges = 0;
  let nonManifoldEdges = 0;
  const defects = [];
  for (const r of records) {
    if (r.uses === 2) { continue; }
    const edge = oc.TopoDS_Cast.Edge_1(r.edge);
    if (!oc.BRep_Tool.Degenerated(edge)) {
      const kind = r.uses === 1 ? 'open_edge' : 'nonmanifold_edge';
      if (r.uses === 1) { openEdges++; } else { nonManifoldEdges++; }
      if (defects.length < maxDefects) { defects.push({ kind, at: edgeMidpoint(oc, edge), uses: r.uses }); }
    }
    edge.delete();
  }
  free(records.map((r) => r.edge));
  return { openEdges, nonManifoldEdges, defects };
}

/** Volume of a boolean of two shapes ('common' | 'cut'), or null when the
 *  kernel fails. The result is measured and released. */
export function booleanVolume(oc, S, kind, a, b) {
  const op = kind === 'cut' ? new oc.BRepAlgoAPI_Cut_1() : new oc.BRepAlgoAPI_Common_1();
  const args = new oc.TopTools_ListOfShape(); args.Append(a);
  const tools = new oc.TopTools_ListOfShape(); tools.Append(b);
  const range = new oc.Message_ProgressRange_1();
  let res = null;
  try {
    op.SetArguments(args); op.SetTools(tools);
    op.SetNonDestructive(true);
    op.Build(range);
    if (!op.IsDone()) { return null; }
    res = op.Shape();
    return res.IsNull() ? 0 : Math.abs(S.SolidsVolume(res));
  } catch (e) {
    return null;
  } finally {
    try { if (res) { res.delete(); } } catch (e) { /* best effort */ }
    op.delete(); args.delete(); tools.delete(); range.delete();
  }
}

/** Minimal distance between two shapes and the closest points
 *  (BRepExtrema_DistShapeShape): {distance, onA, onB} or null. */
export function distance(oc, a, b) {
  const ext = new oc.BRepExtrema_DistShapeShape_1();
  const range = new oc.Message_ProgressRange_1();
  try {
    ext.LoadS1(a); ext.LoadS2(b);
    ext.Perform(range);
    if (!ext.IsDone() || ext.NbSolution() < 1) { return null; }
    const p1 = ext.PointOnShape1(1); const p2 = ext.PointOnShape2(1);
    const out = { distance: r6(ext.Value()), onA: [r4(p1.X()), r4(p1.Y()), r4(p1.Z())],
      onB: [r4(p2.X()), r4(p2.Y()), r4(p2.Z())] };
    p1.delete(); p2.delete();
    return out;
  } catch (e) { return null; } finally { ext.delete(); range.delete(); }
}

const boxesApart = (a, b, eps = 1e-6) => a[3] < b[0] - eps || b[3] < a[0] - eps
  || a[4] < b[1] - eps || b[4] < a[1] - eps || a[5] < b[2] - eps || b[5] < a[2] - eps;

const OVERLAP_MIN_VOLUME = 1e-6;

/** Interpenetrating pairs among `solids` (handles), like build123d-mcp's
 *  _solid_overlaps: a bounding-box prefilter, then the exact Common volume.
 *  `kind` is 'containing' when the overlap is the whole smaller body,
 *  else 'interpenetrating'. `checked` is false when the sweep could not be
 *  finished (too many solids, out of time, a failed boolean): then the
 *  caller must not claim the solids are disjoint.
 *  `labels[i]` names solid i in the result (default its index). */
export function solidOverlaps(oc, S, solids, o = {}) {
  const maxSolids = o.maxSolids || 24;
  const deadline = Date.now() + (o.budgetMs || 8000);
  const n = solids.length;
  if (n < 2) { return { overlaps: [], checked: true }; }
  if (n > maxSolids) { return { overlaps: [], checked: false, why: n + ' solids (over ' + maxSolids + ')' }; }
  const boxes = solids.map((s) => fastBox(oc, s));
  const vols = solids.map((s) => Math.abs(S.SolidsVolume(s)));
  const labels = o.labels || solids.map((s, i) => i);
  const overlaps = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!boxes[i] || !boxes[j] || boxesApart(boxes[i], boxes[j])) { continue; }
      if (Date.now() > deadline) { return { overlaps, checked: false, why: 'out of time' }; }
      const v = booleanVolume(oc, S, 'common', solids[i], solids[j]);
      if (v === null) { return { overlaps, checked: false, why: 'a boolean failed' }; }
      if (v > OVERLAP_MIN_VOLUME) {
        const smaller = Math.min(vols[i], vols[j]);
        overlaps.push({ a: labels[i], b: labels[j], volume: r4(v),
          kind: smaller > 0 && Math.abs(v - smaller) <= Math.max(OVERLAP_MIN_VOLUME, smaller * 1e-6)
            ? 'containing' : 'interpenetrating' });
      }
    }
  }
  return { overlaps, checked: true };
}

/** How two shapes sit relative to each other (build123d-mcp's clearance /
 *  compare kind='fit'): the surface distance plus a status that tells the
 *  cases apart that a zero distance conflates — apart, touching,
 *  containing (one inside the other), interpenetrating. */
export function clearance(oc, S, a, b) {
  const d = distance(oc, a, b);
  const aSolid = subShapes(oc, a, 'TopAbs_SOLID'); const bSolid = subShapes(oc, b, 'TopAbs_SOLID');
  const solids = aSolid.length > 0 && bSolid.length > 0;
  free(aSolid); free(bSolid);
  let aOutside = null; let bOutside = null; let common = null;
  if (solids) {
    aOutside = booleanVolume(oc, S, 'cut', a, b);
    bOutside = booleanVolume(oc, S, 'cut', b, a);
    common = booleanVolume(oc, S, 'common', a, b);
  }
  const aInB = aOutside !== null && aOutside < 1e-6;
  const bInA = bOutside !== null && bOutside < 1e-6;
  const overlapping = common !== null && common > 1e-6;
  const status = aInB || bInA ? 'containing' : overlapping ? 'interpenetrating'
    : d && d.distance < 1e-9 ? 'touching' : 'apart';
  return {
    clearance: d ? d.distance : null,
    status,
    containment: aInB ? 'a_in_b' : bInA ? 'b_in_a' : 'neither',
    intersection_volume: common === null ? null : r4(common),
    a_volume_outside_b: aOutside === null ? null : r4(aOutside),
    b_volume_outside_a: bOutside === null ? null : r4(bOutside),
    closest_points: d ? { a: d.onA, b: d.onB } : null,
    ...(solids ? {} : { note: 'not both solids: only the distance is meaningful' }),
  };
}

/** Alignment of two bounding boxes along one axis (build123d-mcp's
 *  align_check): 'flush' compares the max extremes, 'center' the box
 *  centres, 'clearance' the nearest faces (negative = overlap). */
export function alignCheck(boxA, boxB, axis = 'Z', mode = 'flush', nameA = 'A', nameB = 'B') {
  axis = String(axis).toUpperCase();
  if (!['X', 'Y', 'Z'].includes(axis)) { return { error: "axis must be X, Y or Z" }; }
  if (!['flush', 'center', 'clearance'].includes(mode)) { return { error: 'mode must be flush, center or clearance' }; }
  const k = 'XYZ'.indexOf(axis);
  const [aMin, aMax, bMin, bMax] = [boxA[k], boxA[k + 3], boxB[k], boxB[k + 3]];
  const g = (v) => +v.toPrecision(4);
  let delta;
  let interp;
  if (mode === 'flush') {
    delta = r6(aMax - bMax);
    interp = Math.abs(delta) < 1e-4 ? nameA + ' and ' + nameB + ' are flush on ' + axis
      : (delta > 0 ? nameA : nameB) + ' extends ' + g(Math.abs(delta)) + ' mm further than '
        + (delta > 0 ? nameB : nameA) + ' on ' + axis;
  } else if (mode === 'center') {
    delta = r6((aMin + aMax) / 2 - (bMin + bMax) / 2);
    interp = Math.abs(delta) < 1e-4 ? 'the centres of ' + nameA + ' and ' + nameB + ' are aligned on ' + axis
      : 'the centre of ' + nameA + ' is ' + g(Math.abs(delta)) + ' mm ' + (delta > 0 ? 'above' : 'below')
        + ' the centre of ' + nameB + ' on ' + axis;
  } else {
    const gap1 = bMin - aMax; const gap2 = aMin - bMax;
    delta = r6(Math.abs(gap1) <= Math.abs(gap2) ? gap1 : gap2);
    interp = delta > 1e-4 ? nameA + ' and ' + nameB + ' are ' + g(delta) + ' mm apart on ' + axis
      : delta < -1e-4 ? nameA + ' and ' + nameB + ' overlap by ' + g(-delta) + ' mm on ' + axis
        : nameA + ' and ' + nameB + ' are touching on ' + axis;
  }
  return { delta, axis, mode, object_a: nameA, object_b: nameB, interpretation: interp };
}

const ANALYTIC = new Set(['Plane', 'Cylinder', 'Cone', 'Sphere', 'Torus']);

/** The circle through three points: [centre, radius] (null if collinear). */
function circleThrough(a, b, c) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const u = sub(b, a); const v = sub(c, a); const w = cross(u, v);
  const ww = dot(w, w);
  if (ww < 1e-18) { return null; }
  const t1 = cross(w, u).map((x) => x * dot(v, v)); const t2 = cross(v, w).map((x) => x * dot(u, u));
  const off = [0, 1, 2].map((k) => (t1[k] + t2[k]) / (2 * ww));
  return [[a[0] + off[0], a[1] + off[1], a[2] + off[2]], Math.sqrt(dot(off, off))];
}

/** A conical face's half angle and axis. gp_Cone is not bound in this
 *  OCCT build, so they come from the circles through three surface points
 *  at two heights: the centres give the axis, the radii the slope. */
function coneParams(oc, surf) {
  const u0 = surf.FirstUParameter(); const u1 = surf.LastUParameter();
  const v0 = surf.FirstVParameter(); const v1 = surf.LastVParameter();
  const at = (u, v) => { const p = surf.Value(u, v); const out = [p.X(), p.Y(), p.Z()]; p.delete(); return out; };
  const ring = (v) => circleThrough(at(u0, v), at(u0 + (u1 - u0) / 3, v), at(u0 + 2 * (u1 - u0) / 3, v));
  const a = ring(v0 + (v1 - v0) * 0.25); const b = ring(v0 + (v1 - v0) * 0.75);
  if (!a || !b) { return {}; }
  const d = [0, 1, 2].map((k) => b[0][k] - a[0][k]);
  const len = Math.hypot(...d);
  if (len < 1e-12) { return {}; }
  return { semi_angle_deg: Math.round(Math.atan2(Math.abs(b[1] - a[1]), len) * 180 / Math.PI * 100) / 100,
    axis: d.map((x) => Math.round(x / len * 1000) / 1000 + 0) };
}

/** Every face classified by surface type with its parameters (a cylinder's
 *  diameter and axis, a cone's half angle, ...), identical entries
 *  collapsed with a count and non-analytic slivers folded into one line —
 *  build123d-mcp's _face_inventory + _condense_inventory. */
export function faceInventory(oc, S, shape) {
  const ST = oc.GeomAbs_SurfaceType;
  const names = new Map([[ST.GeomAbs_Plane, 'Plane'], [ST.GeomAbs_Cylinder, 'Cylinder'],
    [ST.GeomAbs_Cone, 'Cone'], [ST.GeomAbs_Sphere, 'Sphere'], [ST.GeomAbs_Torus, 'Torus'],
    [ST.GeomAbs_BSplineSurface, 'BSpline'], [ST.GeomAbs_BezierSurface, 'Bezier'],
    [ST.GeomAbs_SurfaceOfRevolution, 'Revolution'], [ST.GeomAbs_SurfaceOfExtrusion, 'Extrusion'],
    [ST.GeomAbs_OffsetSurface, 'Offset']]);
  const faces = [];
  const ex = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; ex.More(); ex.Next()) {
    const cur = ex.Current();
    const face = oc.TopoDS_Cast.Face_1(cur);
    cur.delete();
    let surf = null;
    try {
      surf = new oc.BRepAdaptor_Surface_2(face, true);
      const t = surf.GetType();
      const info = { type: names.get(t) || 'Other', area: r4(Math.abs(S.SurfaceArea(face))) };
      if (info.type === 'Cylinder') {
        const c = surf.Cylinder();
        const ax = c.Axis();
        const d = ax.Direction();
        info.diameter = r4(c.Radius() * 2);
        info.axis = [d.X(), d.Y(), d.Z()].map((v) => Math.round(v * 1000) / 1000 + 0);
        d.delete(); ax.delete(); c.delete();
      } else if (info.type === 'Cone') {
        Object.assign(info, coneParams(oc, surf));
      } else if (info.type === 'Sphere') {
        info.radius = r4(surf.Sphere().Radius());
      } else if (info.type === 'Torus') {
        const tor = surf.Torus();
        info.major_r = r4(tor.MajorRadius()); info.minor_r = r4(tor.MinorRadius());
      }
      faces.push(info);
    } catch (e) {
      faces.push({ type: 'Unreadable', area: 0, error: (e && e.message) || String(e) });
    } finally {
      if (surf) { surf.delete(); }
      face.delete();
    }
  }
  ex.delete();
  const total = faces.reduce((n, f) => n + f.area, 0);
  const sliver = Math.max(0.01, total * 1e-4);
  const kept = []; const slivers = [];
  for (const f of faces) { (!ANALYTIC.has(f.type) && !f.error && f.area < sliver ? slivers : kept).push(f); }
  const grouped = new Map();
  for (const f of kept) {
    const key = JSON.stringify(Object.keys(f).sort().map((k) => [k, f[k]]));
    const g = grouped.get(key);
    if (g) { g.count = (g.count || 1) + 1; } else { grouped.set(key, Object.assign({}, f)); }
  }
  const out = [...grouped.values()].sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : b.area - a.area));
  if (slivers.length) {
    out.push({ type: 'slivers_folded', count: slivers.length,
      total_area: r4(slivers.reduce((n, f) => n + f.area, 0)),
      note: 'non-analytic faces < ' + r4(sliver) + ' mm^2 each' });
  }
  return out;
}

/** The volume inertia tensor about the centre of mass (mm^5; times a
 *  density in g/mm^3 it is the mass moment in g·mm^2) — OCCT's
 *  GProp_GProps::MatrixOfInertia, as build123d-mcp's _inertia reports it. */
export function inertia(oc, shape) {
  const props = new oc.GProp_GProps_1();
  try {
    oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
    const m = props.MatrixOfInertia();
    const v = (i, j) => r4(m.Value(i, j));
    const out = { Ixx: v(1, 1), Iyy: v(2, 2), Izz: v(3, 3), Ixy: v(1, 2), Ixz: v(1, 3), Iyz: v(2, 3) };
    m.delete();
    return out;
  } finally { props.delete(); }
}

/** Densities in g/cm^3 for measure(material=...) — build123d-mcp's presets. */
export const MATERIALS = {
  steel: 7.85, stainless: 8.00, aluminum: 2.70, 6061: 2.70, brass: 8.50, copper: 8.96,
  titanium: 4.43, abs: 1.04, pla: 1.24, petg: 1.27, nylon: 1.15,
};
