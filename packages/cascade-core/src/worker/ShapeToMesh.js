// ShapeToMesh - Triangulation and meshing of OpenCascade shapes for rendering
// No Three.js dependency — uses inline Vec3 class

/** Lightweight 3D vector (replaces THREE.Vector3 for worker-side meshing). */
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  distanceTo(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

/** Handles triangulation and meshing of OpenCascade shapes for 3D rendering. */
class CascadeStudioMesher {
  constructor() {
    // Expose meshing methods on self for use by MainWorker
    self.ShapeToMesh = this.shapeToMesh.bind(this);
    self.LengthOfCurve = CascadeStudioMesher.lengthOfCurve;
    // Note: ForEachFace/ForEachEdge are assigned to self by CascadeStudioStandardLibrary
  }

  static lengthOfCurve(geomAdaptor, UMin, UMax, segments = 5) {
    let point1 = new Vec3(), point2 = new Vec3(), arcLength = 0, gpPnt = new self.oc.gp_Pnt_1();
    for (let s = UMin; s <= UMax; s += (UMax - UMin) / segments) {
      geomAdaptor.D0(s, gpPnt);
      point1.set(gpPnt.X(), gpPnt.Y(), gpPnt.Z());
      if (s == UMin) {
        point2.copy(point1);
      } else {
        arcLength += point1.distanceTo(point2);
      }
      point2.copy(point1);
    }
    CascadeStudioMesher._del(gpPnt);
    return arcLength;
  }

  /** Best-effort embind delete (meshing creates hundreds of thousands of
   *  owned per-node wrapper copies per run; leaking them was a measured
   *  30-90 MB of the heavy-model mesh-phase high-water). */
  static _del(...objs) {
    for (const o of objs) {
      try { if (o && o.$$ && o.$$.ptr) { o.delete(); } } catch (e) { /* skip */ }
    }
  }

  /** Iterate over all the faces in this shape, calling `callback` on each one. */
  static forEachFace(shape, callback) {
    let face_index = 0;
    let anExplorer = new self.oc.TopExp_Explorer_2(shape,
      self.oc.TopAbs_ShapeEnum.TopAbs_FACE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
      const cur = anExplorer.Current();
      const face = self.oc.TopoDS_Cast.Face_1(cur);
      callback(face_index++, face);
      CascadeStudioMesher._del(face, cur);
    }
    CascadeStudioMesher._del(anExplorer);
  }

  /** Iterate over all the UNIQUE indices and edges in this shape, calling `callback` on each one. */
  static forEachEdge(shape, callback) {
    let edgeHashes = {};
    let edgeIndex = 0;
    let anExplorer = new self.oc.TopExp_Explorer_2(shape,
      self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
      const cur = anExplorer.Current();
      let edge = self.oc.TopoDS_Cast.Edge_1(cur);
      let edgeHash = self.oc.OCJS.HashCode(edge, 100000000);
      if (!edgeHashes.hasOwnProperty(edgeHash)) {
        edgeHashes[edgeHash] = edgeIndex;
        callback(edgeIndex++, edge);
      }
      CascadeStudioMesher._del(edge, cur);
    }
    CascadeStudioMesher._del(anExplorer);
    return edgeHashes;
  }

  /** Triangulate `shape` into face/edge records for rendering.
   *  `faceHashToShapeIndex`/`edgeHashToShapeIndex` (optional) map subshape
   *  hashes to their owning top-level sceneShape index; when provided, each
   *  face/edge record carries a `shape_index` for pick → shape resolution. */
  shapeToMesh(shape, maxDeviation, fullShapeEdgeHashes, fullShapeFaceHashes,
              faceHashToShapeIndex, edgeHashToShapeIndex) {
    let facelist = [], edgeList = [];
    let shapeIndexOfFace = (hash) => (faceHashToShapeIndex && hash in faceHashToShapeIndex) ? faceHashToShapeIndex[hash] : -1;
    let shapeIndexOfEdge = (hash) => (edgeHashToShapeIndex && hash in edgeHashToShapeIndex) ? edgeHashToShapeIndex[hash] : -1;
    try {
      let oc = self.oc;
      // Set up the Incremental Mesh builder, with a precision
      const _mark = (l) => {
        try {
          if (self._csMemMark) { self._csMemMark(l); return; }
          if (!self._csMemSamples) { self._csMemSamples = []; }
          self._csMemSamples.push([l, self.ocMemory ? self.ocMemory.buffer.byteLength : 0]);
        } catch (e) { /* diagnostics */ }
      };
      const _del = CascadeStudioMesher._del;

      // STREAMING MESHER: decompose compounds into their immediate children
      // (recursively) and mesh → extract ONE chunk at a time, constructing
      // and deleting the BRepMesh_IncrementalMesh algo per chunk. The
      // kernel's internal meshing peak (measured: the ENTIRE ~140 MB
      // heavy-model mesh transient sits inside the ctor; extraction adds
      // zero high-water) then scales with the LARGEST chunk instead of the
      // whole scene. TopoDS_Iterator visits children in insertion order —
      // the same order TopExp_Explorer sweeps them — so facelist/edgeList
      // emission (and the pick → line payload) is identical to
      // whole-compound meshing. Triangulations stay ATTACHED until the
      // single BRepTools.Clean at the end: a subshape shared by two chunks
      // (e.g. General-Fuse contact faces) is meshed once and REUSED by the
      // later chunk's algo, exactly like the old whole-compound pass — a
      // per-chunk Clean would re-mesh it against only its own chunk and
      // could change the tessellation. Non-compound inputs are one chunk.
      const chunks = [];
      const explode = (s, owned, depth) => {
        if (depth < 8 && s.ShapeType().value === 0 /* TopAbs_COMPOUND */) {
          const it = new oc.TopoDS_Iterator_2(s, true, true);
          for (; it.More(); it.Next()) { explode(it.Value(), true, depth + 1); }
          _del(it);
          if (owned) { _del(s); }
        } else {
          chunks.push({ shape: s, owned: owned });
        }
      };
      if (self._csMeshWhole) { chunks.push({ shape: shape, owned: false }); }
      else { explode(shape, false, 0); }

      // Construct the edge hashes to assign proper indices to the edges
      let fullShapeEdgeHashes2 = {};

      let triangulations = []; let uv_boxes = []; let curFace = 0;
      for (let chunkInd = 0; chunkInd < chunks.length; chunkInd++) {
      const chunkShape = chunks[chunkInd].shape;
      let mesher = new oc.BRepMesh_IncrementalMesh_2(chunkShape, maxDeviation, false, maxDeviation * 5, false);

      // Iterate through the faces and triangulate each one
      CascadeStudioMesher.forEachFace(chunkShape, (faceIndex, myFace) => {
        let aLocation = new oc.TopLoc_Location_1();
        let myT = oc.BRep_Tool.Triangulation(myFace, aLocation, 0 /* Poly_MeshPurpose_NONE */);
        if (myT.IsNull()) { console.error("Encountered Null Face!"); for (let k in self.argCache) delete self.argCache[k]; _del(myT, aLocation); return; }
        const T = myT.get();           // non-owning alias; freed via myT
        const faceTrsf = aLocation.Transformation();

        let faceHash = self.oc.OCJS.HashCode(myFace, 100000000);
        let this_face = {
          vertex_coord: [],
          uv_coord: [],
          normal_coord: [],
          tri_indexes: [],
          number_of_triangles: 0,
          face_index: fullShapeFaceHashes[faceHash],
          shape_index: shapeIndexOfFace(faceHash)
        };

        let nbNodes = T.NbNodes();

        // Write vertex buffer (delete the two owned gp_Pnt copies per node)
        this_face.vertex_coord = new Array(nbNodes * 3);
        for (let i = 1; i <= nbNodes; i++) {
          let p0 = T.Node(i);
          let p = p0.Transformed(faceTrsf);
          this_face.vertex_coord[((i - 1) * 3) + 0] = p.X();
          this_face.vertex_coord[((i - 1) * 3) + 1] = p.Y();
          this_face.vertex_coord[((i - 1) * 3) + 2] = p.Z();
          _del(p0, p);
        }

        // Write UV buffer
        let orient = myFace.Orientation_1();
        if (T.HasUVNodes()) {
          let UMin = 0, UMax = 0, VMin = 0, VMax = 0;

          let UVNodesLength = nbNodes;
          this_face.uv_coord = new Array(UVNodesLength * 2);
          for (let i = 0; i < UVNodesLength; i++) {
            let p = T.UVNode(i + 1);
            let x = p.X(), y = p.Y();
            _del(p);
            this_face.uv_coord[(i * 2) + 0] = x;
            this_face.uv_coord[(i * 2) + 1] = y;

            if (i == 0) { UMin = x; UMax = x; VMin = y; VMax = y; }
            if (x < UMin) { UMin = x; } else if (x > UMax) { UMax = x; }
            if (y < VMin) { VMin = y; } else if (y > VMax) { VMax = y; }
          }

          // Compute the Arclengths of the Isoparametric Curves of the face
          let surfHandle = oc.BRep_Tool.Surface_2(myFace);
          let surface = surfHandle.get();
          let UIso_Handle = surface.UIso(UMin + ((UMax - UMin) * 0.5));
          let VIso_Handle = surface.VIso(VMin + ((VMax - VMin) * 0.5));
          let UAdaptor = new oc.GeomAdaptor_Curve_2(VIso_Handle);
          let VAdaptor = new oc.GeomAdaptor_Curve_2(UIso_Handle);
          uv_boxes.push({
            w: CascadeStudioMesher.lengthOfCurve(UAdaptor, UMin, UMax),
            h: CascadeStudioMesher.lengthOfCurve(VAdaptor, VMin, VMax),
            index: curFace
          });
          // the iso curves are freshly built Geom_Curves: release them
          _del(UAdaptor, VAdaptor, UIso_Handle, VIso_Handle, surfHandle);

          // Normalize each face's UVs to 0-1
          for (let i = 0; i < UVNodesLength; i++) {
            let x = this_face.uv_coord[(i * 2) + 0],
                y = this_face.uv_coord[(i * 2) + 1];

            x = ((x - UMin) / (UMax - UMin));
            y = ((y - VMin) / (VMax - VMin));
            if (orient !== oc.TopAbs_Orientation.TopAbs_FORWARD) { x = 1.0 - x; }

            this_face.uv_coord[(i * 2) + 0] = x;
            this_face.uv_coord[(i * 2) + 1] = y;
          }
        }

        // Write normal buffer (OCCT 8.0: StdPrs_ToolTriangulatedShape.Normal was removed)
        if (!T.HasNormals()) { T.ComputeNormals(); }
        let IsReversed = (orient !== oc.TopAbs_Orientation.TopAbs_FORWARD);
        let IsReversedFactor = IsReversed ? -1 : 1;
        this_face.normal_coord = new Array(nbNodes * 3);
        for (let i = 0; i < nbNodes; i++) {
          let d0 = T.Normal_1(i + 1);
          let d = d0.Transformed(faceTrsf);
          this_face.normal_coord[(i * 3) + 0] = IsReversedFactor * d.X();
          this_face.normal_coord[(i * 3) + 1] = IsReversedFactor * d.Y();
          this_face.normal_coord[(i * 3) + 2] = IsReversedFactor * d.Z();
          _del(d0, d);
        }

        // Write triangle buffer
        let nbTriangles = T.NbTriangles();
        this_face.tri_indexes = new Array(nbTriangles * 3);
        for (let nt = 1; nt <= nbTriangles; nt++) {
          let t = T.Triangle(nt);
          let n1 = t.Value(1);
          let n2 = t.Value(2);
          let n3 = t.Value(3);
          if (orient !== oc.TopAbs_Orientation.TopAbs_FORWARD) {
            let tmp = n1;
            n1 = n2;
            n2 = tmp;
          }
          this_face.tri_indexes[((nt - 1) * 3) + 0] = n1 - 1;
          this_face.tri_indexes[((nt - 1) * 3) + 1] = n2 - 1;
          this_face.tri_indexes[((nt - 1) * 3) + 2] = n3 - 1;
          _del(t);
        }
        this_face.number_of_triangles = nbTriangles;
        facelist.push(this_face);
        curFace += 1;

        CascadeStudioMesher.forEachEdge(myFace, (index, myEdge) => {
          let edgeHash = self.oc.OCJS.HashCode(myEdge, 100000000);
          if (fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
            let this_edge = {
              vertex_coord: [],
              edge_index: -1,
              shape_index: shapeIndexOfEdge(edgeHash)
            };

            let myP = null;
            try {
              myP = oc.BRep_Tool.PolygonOnTriangulation_1(myEdge, myT, aLocation);
              if (!myP.IsNull()) {
                let edgeNodes = myP.get().Nodes();

                this_edge.vertex_coord = new Array(edgeNodes.Length() * 3);
                for (let j = 0; j < edgeNodes.Length(); j++) {
                  let vertexIndex = edgeNodes.Value(j + 1);
                  this_edge.vertex_coord[(j * 3) + 0] = this_face.vertex_coord[((vertexIndex - 1) * 3) + 0];
                  this_edge.vertex_coord[(j * 3) + 1] = this_face.vertex_coord[((vertexIndex - 1) * 3) + 1];
                  this_edge.vertex_coord[(j * 3) + 2] = this_face.vertex_coord[((vertexIndex - 1) * 3) + 2];
                }
                _del(edgeNodes);
              } else {
                throw new Error("Null polygon on triangulation");
              }
            } catch (e) {
              // Fallback: discretize edge directly using BRepAdaptor_Curve
              // BRepAdaptor_Curve already applies the edge's location transform,
              // so the returned points are in world coordinates — no additional transform needed
              let adaptorCurve = new oc.BRepAdaptor_Curve_2(myEdge);
              let tangDef = new oc.GCPnts_TangentialDeflection_2(adaptorCurve, maxDeviation, 0.1, 2, 1.0e-9, 1.0e-7);
              this_edge.vertex_coord = new Array(tangDef.NbPoints() * 3);
              for (let j = 0; j < tangDef.NbPoints(); j++) {
                let vertex = tangDef.Value(j + 1);
                this_edge.vertex_coord[(j * 3) + 0] = vertex.X();
                this_edge.vertex_coord[(j * 3) + 1] = vertex.Y();
                this_edge.vertex_coord[(j * 3) + 2] = vertex.Z();
                _del(vertex);
              }
              _del(tangDef, adaptorCurve);
            }
            _del(myP);

            this_edge.edge_index = fullShapeEdgeHashes[edgeHash];
            edgeList.push(this_edge);
          } else {
            fullShapeEdgeHashes2[edgeHash] = edgeHash;
          }
        });
        triangulations.push(myT);
        _del(faceTrsf, aLocation);
      });

      // The incremental-mesh algo (and its internal model) dies with the
      // chunk; the triangulations it attached to the TShapes stay for
      // extraction reuse and are detached by the single Clean below.
      _del(mesher);
      if (self._csMemPerChunkMarks) {
        _mark('mesh-chunk-' + (chunkInd + 1) + '/' + chunks.length + '-done');
      }
      } // end of chunk loop
      _mark('mesh-tri-done');

      // Scale each face's UVs to Worldspace and pack them into a 0-1 Atlas with potpack
      let padding = 2;
      for (let f = 0; f < uv_boxes.length; f++) { uv_boxes[f].w += padding; uv_boxes[f].h += padding; }
      let packing_stats = self.potpack(uv_boxes);
      for (let f = 0; f < uv_boxes.length; f++) {
        let box = uv_boxes[f];
        let this_face = facelist[box.index];
        for (let q = 0; q < this_face.uv_coord.length / 2; q++) {
          let x = this_face.uv_coord[(q * 2) + 0],
              y = this_face.uv_coord[(q * 2) + 1];

          x = ((x * (box.w - padding)) + (box.x + (padding * 0.5))) / Math.max(packing_stats.w, packing_stats.h);
          y = ((y * (box.h - padding)) + (box.y + (padding * 0.5))) / Math.max(packing_stats.w, packing_stats.h);

          this_face.uv_coord[(q * 2) + 0] = x;
          this_face.uv_coord[(q * 2) + 1] = y;
        }
      }

      // Attribution census: how much wasm-side Poly_Triangulation data the
      // extracted mesh represents (nodes: gp_Pnt 24B + UV 16B + normal 12B;
      // triangles: 12B), plus the JS-side extraction-array footprint.
      try {
        if (self._csMemSamples) {
          let nodes = 0, tris = 0, jsDoubles = 0;
          for (const f of facelist) {
            nodes += f.vertex_coord.length / 3; tris += f.number_of_triangles;
            jsDoubles += f.vertex_coord.length + f.uv_coord.length +
                         f.normal_coord.length + f.tri_indexes.length;
          }
          for (const e of edgeList) { jsDoubles += e.vertex_coord.length; }
          // Chunk decomposition census: per-chunk face counts.
          let chunkFaces = [];
          const countFaces = (s) => { let n = 0; CascadeStudioMesher.forEachFace(s, () => n++); return n; };
          for (const c of chunks) { chunkFaces.push(countFaces(c.shape)); }
          chunkFaces.sort((a, b) => b - a);
          _mark('mesh-census faces=' + facelist.length + ' nodes=' + nodes +
            ' tris=' + tris + ' triWasmMB=' +
            ((nodes * 52 + tris * 12) / 1048576).toFixed(1) +
            ' jsArrMB=' + ((jsDoubles * 8) / 1048576).toFixed(1) +
            ' chunks=' + chunkFaces.length +
            ' topChunkFaces=' + chunkFaces.slice(0, 5).join('/'));
        }
      } catch (e) { /* diagnostics */ }
      _mark('mesh-faces-done');
      // Release the triangulations now that the buffers are extracted.
      // Nullify() only clears OUR handle copies — the TShapes keep theirs, so
      // shapes retained across runs (argCache, user refs, the scene compound)
      // used to pin ~100 MB of mesh data per heavy run, and REMESHING a
      // still-triangulated shape leaks its old mesh (measured: six remeshes
      // of one sphere ratcheted 286->697 MB without Clean, dead flat with
      // it). BRepTools.Clean detaches the triangulation from the shape
      // itself; the next evaluation or history scrub simply remeshes.
      for (let i = 0; i < triangulations.length; i++) {
        triangulations[i].Nullify();
        _del(triangulations[i]);
      }
      triangulations.length = 0;
      try {
        (oc.BRepTools.Clean_1 || oc.BRepTools.Clean).call(oc.BRepTools, shape, false);
      } catch (e) {
        try { (oc.BRepTools.Clean_1 || oc.BRepTools.Clean).call(oc.BRepTools, shape); }
        catch (e2) { /* keep going: Clean is an optimization */ }
      }
      _mark('mesh-clean-done');

      // Get the free edges that aren't on any triangulated face/surface
      CascadeStudioMesher.forEachEdge(shape, (index, myEdge) => {
        let edgeHash = self.oc.OCJS.HashCode(myEdge, 100000000);
        if (!fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
          let this_edge = {
            vertex_coord: [],
            edge_index: -1,
            shape_index: shapeIndexOfEdge(edgeHash)
          };

          // BRepAdaptor_Curve already applies the edge's location transform,
          // so the returned points are in world coordinates — no additional transform needed
          let adaptorCurve = new oc.BRepAdaptor_Curve_2(myEdge);
          let tangDef = new oc.GCPnts_TangentialDeflection_2(adaptorCurve, maxDeviation, 0.1, 2, 1.0e-9, 1.0e-7);

          this_edge.vertex_coord = new Array(tangDef.NbPoints() * 3);
          for (let j = 0; j < tangDef.NbPoints(); j++) {
            let vertex = tangDef.Value(j + 1);
            this_edge.vertex_coord[(j * 3) + 0] = vertex.X();
            this_edge.vertex_coord[(j * 3) + 1] = vertex.Y();
            this_edge.vertex_coord[(j * 3) + 2] = vertex.Z();
            _del(vertex);
          }
          _del(tangDef, adaptorCurve);

          this_edge.edge_index = fullShapeEdgeHashes[edgeHash];
          fullShapeEdgeHashes2[edgeHash] = edgeHash;
          edgeList.push(this_edge);
        }
      });
      // Release the owned per-chunk shape copies (the iterator Values).
      for (const c of chunks) { if (c.owned) { _del(c.shape); } }
      chunks.length = 0;
      _mark('mesh-edges-done');

    } catch (err) {
      setTimeout(() => {
        // A raw wasm exception is a NUMBER: assigning .message to it throws a
        // TypeError in strict mode, which used to hide the real fault. Decode
        // the pointer into OCCT's own message instead.
        if (typeof err !== 'object' || err === null) {
          throw new Error("INTERNAL OPENCASCADE ERROR DURING GENERATE: " +
            self.describeOCCTException(err));
        }
        err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
        throw err;
      }, 0);
    }

    return [facelist, edgeList];
  }
}

export { CascadeStudioMesher };
