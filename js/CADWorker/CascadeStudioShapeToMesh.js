import { oc, setArgCache } from "./CascadeStudioWorkerState";
import { ForEachEdge, ForEachFace } from "./CascadeStudioStandardLibrary.js";

export function ShapeToMesh (shape, maxDeviation, fullShapeEdgeHashes, fullShapeFaceHashes) {
    let facelist = [], edgeList = [];
    try {
      shape = new oc.TopoDS_Shape(shape);

      // Set up the Incremental Mesh builder, with a precision
      new oc.BRepMesh_IncrementalMesh(shape, maxDeviation, false, maxDeviation * 5);

      // Construct the edge hashes to assign proper indices to the edges
      let fullShapeEdgeHashes2 = {};

      // Iterate through the faces and triangulate each one
      let triangulations = [];
      ForEachFace(shape, (faceIndex, myFace) => {
        let aLocation = new oc.TopLoc_Location();
        let myT = oc.BRep_Tool.prototype.Triangulation(myFace, aLocation);
        if (myT.IsNull()) { console.error("Encountered Null Face!"); setArgCache({}); return; }

        let this_face = {
          vertex_coord: [],
          normal_coord: [],
          tri_indexes: [],
          number_of_triangles: 0,
          face_index: fullShapeFaceHashes[myFace.HashCode(100000000)]
        };

        let pc = new oc.Poly_Connect(myT);
        let Nodes = myT.get().Nodes();

        // write vertex buffer
        this_face.vertex_coord = new Array(Nodes.Length() * 3);
        for(let i = 0; i < Nodes.Length(); i++) {
          let p = Nodes.Value(i + 1).Transformed(aLocation.Transformation());
          this_face.vertex_coord[(i * 3) + 0] = p.X();
          this_face.vertex_coord[(i * 3) + 1] = p.Y();
          this_face.vertex_coord[(i * 3) + 2] = p.Z();
        }

        // write normal buffer
        let myNormal = new oc.TColgp_Array1OfDir(Nodes.Lower(), Nodes.Upper());
        let SST = new oc.StdPrs_ToolTriangulatedShape();
        SST.Normal(myFace, pc, myNormal);
        this_face.normal_coord = new Array(myNormal.Length() * 3);
        for(let i = 0; i < myNormal.Length(); i++) {
          let d = myNormal.Value(i + 1).Transformed(aLocation.Transformation());
          this_face.normal_coord[(i * 3)+ 0] = d.X();
          this_face.normal_coord[(i * 3)+ 1] = d.Y();
          this_face.normal_coord[(i * 3)+ 2] = d.Z();
        }
        
        // write triangle buffer
        let orient = myFace.Orientation();
        let triangles = myT.get().Triangles();
        this_face.tri_indexes = new Array(triangles.Length() * 3);
        let validFaceTriCount = 0;
        for(let nt = 1; nt <= myT.get().NbTriangles(); nt++) {
          let t = triangles.Value(nt);
          let n1 = t.Value(1);
          let n2 = t.Value(2);
          let n3 = t.Value(3);
          if(orient !== oc.TopAbs_FORWARD) {
            let tmp = n1;
            n1 = n2;
            n2 = tmp;
          }
          // if(TriangleIsValid(Nodes.Value(1), Nodes.Value(n2), Nodes.Value(n3))) {
            this_face.tri_indexes[(validFaceTriCount * 3) + 0] = n1 - 1;
            this_face.tri_indexes[(validFaceTriCount * 3) + 1] = n2 - 1;
            this_face.tri_indexes[(validFaceTriCount * 3) + 2] = n3 - 1;
            validFaceTriCount++;
          // }
        }
        this_face.number_of_triangles = validFaceTriCount;
        facelist.push(this_face);

        ForEachEdge(myFace, (index, myEdge) => {
          let edgeHash = myEdge.HashCode(100000000);
          if (fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
            let this_edge = {
              vertex_coord: [],
              edge_index: -1
            };

            let myP = oc.BRep_Tool.prototype.PolygonOnTriangulation(myEdge, myT, aLocation);
            let edgeNodes = myP.get().Nodes();

            // write vertex buffer
            this_edge.vertex_coord = new Array(edgeNodes.Length() * 3);
            for(let j = 0; j < edgeNodes.Length(); j++) {
              let vertexIndex = edgeNodes.Value(j+1);
              this_edge.vertex_coord[(j * 3) + 0] = this_face.vertex_coord[((vertexIndex-1) * 3) + 0];
              this_edge.vertex_coord[(j * 3) + 1] = this_face.vertex_coord[((vertexIndex-1) * 3) + 1];
              this_edge.vertex_coord[(j * 3) + 2] = this_face.vertex_coord[((vertexIndex-1) * 3) + 2];
            }

            this_edge.edge_index = fullShapeEdgeHashes[edgeHash];

            edgeList.push(this_edge);
          } else {
            fullShapeEdgeHashes2[edgeHash] = edgeHash;
          }
        });
        triangulations.push(myT);
      });
      // Nullify Triangulations between runs so they're not stored in the cache
      for (let i = 0; i < triangulations.length; i++) { triangulations[i].Nullify(); }

      // Get the free edges that aren't on any triangulated face/surface
      ForEachEdge(shape, (index, myEdge) => {
        let edgeHash = myEdge.HashCode(100000000);
        if (!fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
          let this_edge = {
            vertex_coord: [],
            edge_index: -1
          };

          let aLocation = new oc.TopLoc_Location();
          let adaptorCurve = new oc.BRepAdaptor_Curve(myEdge);
          let tangDef = new oc.GCPnts_TangentialDeflection(adaptorCurve, maxDeviation, 0.1);

          // write vertex buffer
          this_edge.vertex_coord = new Array(tangDef.NbPoints() * 3);
          for(let j = 0; j < tangDef.NbPoints(); j++) {
            let vertex = tangDef.Value(j+1).Transformed(aLocation.Transformation());
            this_edge.vertex_coord[(j * 3) + 0] = vertex.X();
            this_edge.vertex_coord[(j * 3) + 1] = vertex.Y();
            this_edge.vertex_coord[(j * 3) + 2] = vertex.Z();
          }

          this_edge.edge_index = fullShapeEdgeHashes[edgeHash];
          fullShapeEdgeHashes2[edgeHash] = edgeHash;

          edgeList.push(this_edge);
        }
      });

    } catch(err) {
      setTimeout(() => {
        err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
        throw err; 
      }, 0);
    }

    return [facelist, edgeList];
  }
