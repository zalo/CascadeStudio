import { Vector3 } from '../../node_modules/three/build/three.module.js';

/** Handles triangulation and meshing of OpenCascade shapes for 3D rendering. */
class CascadeStudioMesher {
  constructor() {
    // Expose meshing methods on self for use by MainWorker
    self.ShapeToMesh = this.shapeToMesh.bind(this);
    self.LengthOfCurve = CascadeStudioMesher.lengthOfCurve;
    // Note: ForEachFace/ForEachEdge are assigned to self by CascadeStudioStandardLibrary
  }

  static lengthOfCurve(geomAdaptor, UMin, UMax, segments = 5) {
    let point1 = new Vector3(), point2 = new Vector3(), arcLength = 0, gpPnt = new self.oc.gp_Pnt_1();
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
    return arcLength;
  }

  /** Iterate over all the faces in this shape, calling `callback` on each one. */
  static forEachFace(shape, callback) {
    let face_index = 0;
    let anExplorer = new self.oc.TopExp_Explorer_2(shape,
      self.oc.TopAbs_ShapeEnum.TopAbs_FACE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
      callback(face_index++, self.oc.TopoDS_Cast.Face_1(anExplorer.Current()));
    }
  }

  /** Iterate over all the UNIQUE indices and edges in this shape, calling `callback` on each one. */
  static forEachEdge(shape, callback) {
    let edgeHashes = {};
    let edgeIndex = 0;
    let anExplorer = new self.oc.TopExp_Explorer_2(shape,
      self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
      let edge = self.oc.TopoDS_Cast.Edge_1(anExplorer.Current());
      let edgeHash = self.oc.OCJS.HashCode(edge, 100000000);
      if (!edgeHashes.hasOwnProperty(edgeHash)) {
        edgeHashes[edgeHash] = edgeIndex;
        callback(edgeIndex++, edge);
      }
    }
    return edgeHashes;
  }

  shapeToMesh(shape, maxDeviation, fullShapeEdgeHashes, fullShapeFaceHashes) {
    let facelist = [], edgeList = [];
    try {
      let oc = self.oc;
      // Set up the Incremental Mesh builder, with a precision
      let mesher = new oc.BRepMesh_IncrementalMesh_2(shape, maxDeviation, false, maxDeviation * 5, false);

      // Construct the edge hashes to assign proper indices to the edges
      let fullShapeEdgeHashes2 = {};

      // Iterate through the faces and triangulate each one
      let triangulations = []; let uv_boxes = []; let curFace = 0;
      CascadeStudioMesher.forEachFace(shape, (faceIndex, myFace) => {
        let aLocation = new oc.TopLoc_Location_1();
        let myT = oc.BRep_Tool.Triangulation(myFace, aLocation, 0 /* Poly_MeshPurpose_NONE */);
        if (myT.IsNull()) { console.error("Encountered Null Face!"); for (let k in self.argCache) delete self.argCache[k]; return; }

        let this_face = {
          vertex_coord: [],
          uv_coord: [],
          normal_coord: [],
          tri_indexes: [],
          number_of_triangles: 0,
          face_index: fullShapeFaceHashes[self.oc.OCJS.HashCode(myFace, 100000000)]
        };

        let nbNodes = myT.get().NbNodes();

        // Write vertex buffer
        this_face.vertex_coord = new Array(nbNodes * 3);
        for (let i = 1; i <= nbNodes; i++) {
          let p = myT.get().Node(i).Transformed(aLocation.Transformation());
          this_face.vertex_coord[((i - 1) * 3) + 0] = p.X();
          this_face.vertex_coord[((i - 1) * 3) + 1] = p.Y();
          this_face.vertex_coord[((i - 1) * 3) + 2] = p.Z();
        }

        // Write UV buffer
        let orient = myFace.Orientation_1();
        if (myT.get().HasUVNodes()) {
          let UMin = 0, UMax = 0, VMin = 0, VMax = 0;

          let UVNodesLength = nbNodes;
          this_face.uv_coord = new Array(UVNodesLength * 2);
          for (let i = 0; i < UVNodesLength; i++) {
            let p = myT.get().UVNode(i + 1);
            let x = p.X(), y = p.Y();
            this_face.uv_coord[(i * 2) + 0] = x;
            this_face.uv_coord[(i * 2) + 1] = y;

            if (i == 0) { UMin = x; UMax = x; VMin = y; VMax = y; }
            if (x < UMin) { UMin = x; } else if (x > UMax) { UMax = x; }
            if (y < VMin) { VMin = y; } else if (y > VMax) { VMax = y; }
          }

          // Compute the Arclengths of the Isoparametric Curves of the face
          let surface = oc.BRep_Tool.Surface_2(myFace).get();
          let UIso_Handle = surface.UIso(UMin + ((UMax - UMin) * 0.5));
          let VIso_Handle = surface.VIso(VMin + ((VMax - VMin) * 0.5));
          let UAdaptor = new oc.GeomAdaptor_Curve_2(VIso_Handle);
          let VAdaptor = new oc.GeomAdaptor_Curve_2(UIso_Handle);
          uv_boxes.push({
            w: CascadeStudioMesher.lengthOfCurve(UAdaptor, UMin, UMax),
            h: CascadeStudioMesher.lengthOfCurve(VAdaptor, VMin, VMax),
            index: curFace
          });

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
        if (!myT.get().HasNormals()) { myT.get().ComputeNormals(); }
        let IsReversed = (orient !== oc.TopAbs_Orientation.TopAbs_FORWARD);
        let IsReversedFactor = IsReversed ? -1 : 1;
        this_face.normal_coord = new Array(nbNodes * 3);
        for (let i = 0; i < nbNodes; i++) {
          let d = myT.get().Normal_1(i + 1).Transformed(aLocation.Transformation());
          this_face.normal_coord[(i * 3) + 0] = IsReversedFactor * d.X();
          this_face.normal_coord[(i * 3) + 1] = IsReversedFactor * d.Y();
          this_face.normal_coord[(i * 3) + 2] = IsReversedFactor * d.Z();
        }

        // Write triangle buffer
        let nbTriangles = myT.get().NbTriangles();
        this_face.tri_indexes = new Array(nbTriangles * 3);
        for (let nt = 1; nt <= nbTriangles; nt++) {
          let t = myT.get().Triangle(nt);
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
        }
        this_face.number_of_triangles = nbTriangles;
        facelist.push(this_face);
        curFace += 1;

        CascadeStudioMesher.forEachEdge(myFace, (index, myEdge) => {
          let edgeHash = self.oc.OCJS.HashCode(myEdge, 100000000);
          if (fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
            let this_edge = {
              vertex_coord: [],
              edge_index: -1
            };

            try {
              let myP = oc.BRep_Tool.PolygonOnTriangulation_1(myEdge, myT, aLocation);
              if (!myP.IsNull()) {
                let edgeNodes = myP.get().Nodes();

                this_edge.vertex_coord = new Array(edgeNodes.Length() * 3);
                for (let j = 0; j < edgeNodes.Length(); j++) {
                  let vertexIndex = edgeNodes.Value(j + 1);
                  this_edge.vertex_coord[(j * 3) + 0] = this_face.vertex_coord[((vertexIndex - 1) * 3) + 0];
                  this_edge.vertex_coord[(j * 3) + 1] = this_face.vertex_coord[((vertexIndex - 1) * 3) + 1];
                  this_edge.vertex_coord[(j * 3) + 2] = this_face.vertex_coord[((vertexIndex - 1) * 3) + 2];
                }
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
              }
            }

            this_edge.edge_index = fullShapeEdgeHashes[edgeHash];
            edgeList.push(this_edge);
          } else {
            fullShapeEdgeHashes2[edgeHash] = edgeHash;
          }
        });
        triangulations.push(myT);
      });

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

      // Nullify Triangulations between runs so they're not stored in the cache
      for (let i = 0; i < triangulations.length; i++) { triangulations[i].Nullify(); }

      // Get the free edges that aren't on any triangulated face/surface
      CascadeStudioMesher.forEachEdge(shape, (index, myEdge) => {
        let edgeHash = self.oc.OCJS.HashCode(myEdge, 100000000);
        if (!fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
          let this_edge = {
            vertex_coord: [],
            edge_index: -1
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
          }

          this_edge.edge_index = fullShapeEdgeHashes[edgeHash];
          fullShapeEdgeHashes2[edgeHash] = edgeHash;
          edgeList.push(this_edge);
        }
      });

    } catch (err) {
      setTimeout(() => {
        err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
        throw err;
      }, 0);
    }

    return [facelist, edgeList];
  }
}

export { CascadeStudioMesher };
