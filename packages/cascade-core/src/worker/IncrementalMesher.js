// IncrementalMesher.js — viewport meshing for a long-lived host (the
// Durable Object editing session): face records like ShapeToMesh's, but
// every face is keyed by its GEOMETRY, and a face meshed before (by the
// previous edit, a timeline step, ...) reuses that mesh instead of going
// through BRepMesh again. A generator, so the host can stream the result.
//
// Why geometry and not kernel identity: an edit's ops recompute from cached
// inputs, but OCCT rebuilds every face of an op it re-runs — after a fillet
// edit 1 of plate16's 522 faces and 0 of heat_exchanger's 1190 are still the
// same TopoDS face — while many of them are geometrically unchanged:
//   heat_exchanger fillet radius 50%, tube extension 37%, maker_coin fillet
//   81%, mount hole size 71%; a re-run 100%.
// Geometric keys also survive the session's compaction (snapshot, kernel
// rewind, restore), which gives every shape a new identity.
//
// The key of a face: surface type, orientation, nine surface points over the
// face's UV box, and every edge's type, midpoint and end points — all in
// world coordinates to 9 significant digits, plus the deflection. Two faces
// with equal keys have the same surface over the same region with the same
// boundary; the reused mesh is the one BRepMesh made for that geometry.
//
// Batches: reused faces first (they cost nothing), then the newly meshed
// ones every `batchNodes` nodes, then the edges. Every record carries its
// `slot`, its position in ShapeToMesh's order, so a consumer can assemble
// the final lists in that order. UVs are left out: the viewport's matcap
// material never reads them (ShapeToMesh packs them into an atlas, which
// would make every face depend on every other).

import { CascadeStudioMesher } from './ShapeToMesh.js';

const _del = CascadeStudioMesher._del;
const EMPTY_F32 = new Float32Array(0);

const P = (p) => {
  const x = p.X(), y = p.Y(), z = p.Z();
  return (Math.abs(x) < 1e-9 ? 0 : x).toPrecision(9) + ','
    + (Math.abs(y) < 1e-9 ? 0 : y).toPrecision(9) + ','
    + (Math.abs(z) < 1e-9 ? 0 : z).toPrecision(9);
};

export class IncrementalMesher {
  /** @param {object} [o]
   *  @param {number} [o.maxBytes] cap on the cached face meshes (typed-array
   *         bytes); least recently used faces go first */
  constructor({ maxBytes = 12 * 1048576 } = {}) {
    this.maxBytes = maxBytes;
    this.clear();
  }

  /** Forget every cached mesh. */
  clear() {
    this.faces = new Map();     // key -> {id, rec, bytes, used}
    this.edges = new Map();     // key -> {coords, used}
    this.bytes = 0;
    this.nextId = 1;
    this.pass = 0;
  }

  /** Ids of the cached face meshes (what a client may hold on to). */
  liveIds() { return Array.from(this.faces.values(), (e) => e.id); }

  stats() {
    return { faces: this.faces.size, edges: this.edges.size,
      MB: Math.round(this.bytes / 1048576 * 10) / 10 };
  }

  _edgeKey(edge, dev) {
    const oc = self.oc;
    let c = null;
    try {
      if (oc.BRep_Tool.Degenerated(edge)) { return null; }
      c = new oc.BRepAdaptor_Curve_2(edge);
      const t0 = c.FirstParameter(), t1 = c.LastParameter();
      const pts = [t0, (t0 + t1) / 2, t1].map((t) => { const p = c.Value(t); const k = P(p); _del(p); return k; });
      return c.GetType().value + '|' + pts[1] + '|' + [pts[0], pts[2]].sort().join('|') + '|' + dev;
    } catch (e) {
      return null;
    } finally { _del(c); }
  }

  _faceKey(face, dev) {
    const oc = self.oc;
    let s = null;
    try {
      s = new oc.BRepAdaptor_Surface_2(face, true);
      const parts = [s.GetType().value, face.Orientation_1().value, dev];
      const u0 = s.FirstUParameter(), u1 = s.LastUParameter();
      const v0 = s.FirstVParameter(), v1 = s.LastVParameter();
      if (![u0, u1, v0, v1].every(Number.isFinite)) { return null; }
      for (const a of [0.2, 0.5, 0.8]) {
        for (const b of [0.2, 0.5, 0.8]) {
          const p = s.Value(u0 + a * (u1 - u0), v0 + b * (v1 - v0));
          parts.push(P(p));
          _del(p);
        }
      }
      const edges = [];
      let ok = true;
      CascadeStudioMesher.forEachEdge(face, (i, edge) => {
        const k = this._edgeKey(edge, dev);
        if (k === null && !oc.BRep_Tool.Degenerated(edge)) { ok = false; }
        if (k !== null) { edges.push(k); }
      });
      if (!ok) { return null; }
      parts.push(edges.sort().join(';'));
      return parts.join('/');
    } catch (e) {
      return null;
    } finally { _del(s); }
  }

  /** Triangulate one face and read its mesh into typed arrays. */
  _meshFace(face, dev) {
    const oc = self.oc;
    _del(new oc.BRepMesh_IncrementalMesh_2(face, dev, false, dev * 5, false));
    const loc = new oc.TopLoc_Location_1();
    const tri = oc.BRep_Tool.Triangulation(face, loc, 0);
    if (tri.IsNull()) { _del(tri, loc); return null; }
    const T = tri.get();
    const trsf = loc.Transformation();
    const n = T.NbNodes();
    const vertex = new Float32Array(n * 3);
    for (let i = 1; i <= n; i++) {
      const p0 = T.Node(i);
      const p = p0.Transformed(trsf);
      vertex[(i - 1) * 3] = p.X(); vertex[(i - 1) * 3 + 1] = p.Y(); vertex[(i - 1) * 3 + 2] = p.Z();
      _del(p0, p);
    }
    const reversed = face.Orientation_1() !== oc.TopAbs_Orientation.TopAbs_FORWARD;
    if (!T.HasNormals()) { T.ComputeNormals(); }
    const f = reversed ? -1 : 1;
    const normal = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d0 = T.Normal_1(i + 1);
      const d = d0.Transformed(trsf);
      normal[i * 3] = f * d.X(); normal[i * 3 + 1] = f * d.Y(); normal[i * 3 + 2] = f * d.Z();
      _del(d0, d);
    }
    const nt = T.NbTriangles();
    const tris = new Uint32Array(nt * 3);
    for (let k = 1; k <= nt; k++) {
      const t = T.Triangle(k);
      let n1 = t.Value(1), n2 = t.Value(2);
      const n3 = t.Value(3);
      if (reversed) { const tmp = n1; n1 = n2; n2 = tmp; }
      tris[(k - 1) * 3] = n1 - 1; tris[(k - 1) * 3 + 1] = n2 - 1; tris[(k - 1) * 3 + 2] = n3 - 1;
      _del(t);
    }
    _del(trsf, tri, loc);
    return { vertex_coord: vertex, normal_coord: normal, uv_coord: EMPTY_F32,
      tri_indexes: tris, number_of_triangles: nt };
  }

  _polygonOn(edge, face) {
    const oc = self.oc;
    const loc = new oc.TopLoc_Location_1();
    const tri = oc.BRep_Tool.Triangulation(face, loc, 0);
    let poly = null;
    try {
      if (tri.IsNull()) { return null; }
      poly = oc.BRep_Tool.PolygonOnTriangulation_1(edge, tri, loc);
      if (poly.IsNull()) { return null; }
      const T = tri.get();
      const trsf = loc.Transformation();
      const nodes = poly.get().Nodes();
      const out = new Float32Array(nodes.Length() * 3);
      for (let j = 0; j < nodes.Length(); j++) {
        const p0 = T.Node(nodes.Value(j + 1));
        const p = p0.Transformed(trsf);
        out[j * 3] = p.X(); out[j * 3 + 1] = p.Y(); out[j * 3 + 2] = p.Z();
        _del(p0, p);
      }
      _del(nodes, trsf);
      return out;
    } catch (e) {
      return null;
    } finally { _del(poly, tri, loc); }
  }

  _discretize(edge, dev) {
    const oc = self.oc;
    let curve = null; let defl = null;
    try {
      curve = new oc.BRepAdaptor_Curve_2(edge);
      defl = new oc.GCPnts_TangentialDeflection_2(curve, dev, 0.1, 2, 1.0e-9, 1.0e-7);
      const out = new Float32Array(defl.NbPoints() * 3);
      for (let j = 0; j < defl.NbPoints(); j++) {
        const v = defl.Value(j + 1);
        out[j * 3] = v.X(); out[j * 3 + 1] = v.Y(); out[j * 3 + 2] = v.Z();
        _del(v);
      }
      return out;
    } catch (e) {
      return EMPTY_F32;
    } finally { _del(defl, curve); }
  }

  /** Mesh `shapes` (the scene, in order). Yields batches
   *  {faces: [...], edges: [...]} — the first one (the reused faces, maybe
   *  none) also carries {total, reused} — and returns stats. A face record is
   *  {slot, id, face_index, shape_index, reused, vertex_coord, normal_coord,
   *  uv_coord, tri_indexes, number_of_triangles}; an edge record is
   *  {slot, edge_index, shape_index, vertex_coord}. */
  *mesh(shapes, dev = 0.1, { batchNodes = 20000 } = {}) {
    const oc = self.oc;
    const pass = ++this.pass;
    const stats = { faces: 0, reused: 0, meshed: 0, nodes: 0, meshedNodes: 0, edges: 0,
      edgesReused: 0, uncached: 0 };
    const valid = (s) => {
      try { return !!s && s.$$ !== undefined && typeof s.IsNull === 'function' && !s.IsNull() && !!s.ShapeType; }
      catch (e) { return false; }
    };

    // ---- 1. key every face; serve the known ones at once ----
    const slots = [];
    const owned = [];
    const edgeIndex = {};     // edge hash -> index in its scene shape (FilletEdges' numbering)
    const edgeShape = {};     // edge hash -> scene shape index
    shapes.forEach((shape, si) => {
      if (!valid(shape)) { return; }
      const hashes = self.ForEachEdge(shape, () => {});
      for (const h in hashes) { edgeIndex[h] = hashes[h]; edgeShape[h] = si; }
      let fi = 0;
      const ex = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      for (; ex.More(); ex.Next()) {
        const cur = ex.Current();
        const face = oc.TopoDS_Cast.Face_1(cur);
        owned.push(face, cur);
        const key = this._faceKey(face, dev);
        slots.push({ slot: slots.length, face, key, si, fi: fi++, entry: key === null ? null : this.faces.get(key) || null, meshed: false });
      }
      _del(ex);
    });
    stats.faces = slots.length;
    const record = (s, reused) => Object.assign({ slot: s.slot, id: s.entry ? s.entry.id : 0,
      face_index: s.fi, shape_index: s.si, reused }, s.entry ? s.entry.rec : s.rec);

    // the first batch always comes, with the totals (a progress bar's)
    let batch = { faces: [], edges: [] };
    for (const s of slots) {
      if (!s.entry) { continue; }
      s.entry.used = pass;
      batch.faces.push(record(s, true));
      stats.reused++;
      stats.nodes += s.entry.rec.vertex_coord.length / 3;
    }
    batch.total = slots.length;
    batch.reused = batch.faces.length;
    yield batch;
    batch = { faces: [], edges: [] };

    // ---- 2. mesh the rest, a batch every `batchNodes` nodes ----
    let pending = 0;
    for (const s of slots) {
      if (s.entry) { continue; }
      // a geometric twin earlier in this pass is reused too
      const twin = s.key !== null ? this.faces.get(s.key) : null;
      if (twin) {
        s.entry = twin; twin.used = pass;
        batch.faces.push(record(s, true));
        stats.reused++;
        stats.nodes += twin.rec.vertex_coord.length / 3;
        continue;
      }
      let rec = null;
      try { rec = this._meshFace(s.face, dev); } catch (e) { rec = null; }
      s.meshed = true;
      if (!rec) { continue; }
      const nodes = rec.vertex_coord.length / 3;
      stats.meshed++; stats.nodes += nodes; stats.meshedNodes += nodes;
      if (s.key !== null) {
        const bytes = rec.vertex_coord.byteLength + rec.normal_coord.byteLength + rec.tri_indexes.byteLength;
        s.entry = { id: this.nextId++, rec, bytes, used: pass };
        this.faces.set(s.key, s.entry);
        this.bytes += bytes;
      } else {
        s.rec = rec;
        stats.uncached++;
      }
      batch.faces.push(record(s, false));
      pending += nodes;
      if (pending >= batchNodes) { yield batch; batch = { faces: [], edges: [] }; pending = 0; }
    }

    // ---- 3. edges: ShapeToMesh's rule — an edge is drawn from the second
    // face that has it; free edges (on no face) are discretized ----
    const seen = {};
    let eslot = 0;
    const edgeCoords = (edge, face, faceMeshed) => {
      const key = this._edgeKey(edge, dev);
      let coords = faceMeshed ? this._polygonOn(edge, face) : null;
      if (!coords && key !== null) {
        const hit = this.edges.get(key);
        if (hit) { hit.used = pass; stats.edgesReused++; return hit.coords; }
      }
      if (!coords) { coords = this._discretize(edge, dev); }
      if (key !== null) { this.edges.set(key, { coords, used: pass }); }
      return coords;
    };
    for (const s of slots) {
      CascadeStudioMesher.forEachEdge(s.face, (i, edge) => {
        const h = oc.OCJS.HashCode(edge, 100000000);
        if (!Object.prototype.hasOwnProperty.call(seen, h)) { seen[h] = true; return; }
        batch.edges.push({ slot: eslot++, edge_index: edgeIndex[h], shape_index: h in edgeShape ? edgeShape[h] : -1,
          vertex_coord: edgeCoords(edge, s.face, s.meshed) });
      });
    }
    shapes.forEach((shape) => {
      if (!valid(shape)) { return; }
      CascadeStudioMesher.forEachEdge(shape, (i, edge) => {
        const h = oc.OCJS.HashCode(edge, 100000000);
        if (Object.prototype.hasOwnProperty.call(seen, h)) { return; }
        seen[h] = true;
        batch.edges.push({ slot: eslot++, edge_index: edgeIndex[h], shape_index: h in edgeShape ? edgeShape[h] : -1,
          vertex_coord: edgeCoords(edge, null, false) });
      });
    });
    stats.edges = eslot;

    // ---- 4. detach this pass's triangulations, trim the cache ----
    for (const shape of shapes) {
      if (!valid(shape)) { continue; }
      try { (oc.BRepTools.Clean_1 || oc.BRepTools.Clean).call(oc.BRepTools, shape, false); }
      catch (e) { try { (oc.BRepTools.Clean_1 || oc.BRepTools.Clean).call(oc.BRepTools, shape); } catch (e2) { /* best effort */ } }
    }
    for (const o of owned) { _del(o); }
    if (this.bytes > this.maxBytes) {
      const byAge = Array.from(this.faces.entries()).sort((a, b) => a[1].used - b[1].used);
      for (const [key, e] of byAge) {
        if (this.bytes <= this.maxBytes || e.used === pass) { break; }
        this.faces.delete(key);
        this.bytes -= e.bytes;
      }
    }
    for (const [key, e] of this.edges) { if (e.used < pass - 1) { this.edges.delete(key); } }

    if (batch.faces.length || batch.edges.length) { yield batch; }
    return stats;
  }
}
