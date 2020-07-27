const openCascadeHelper = {
  setOpenCascade (openCascade) {
    oc = openCascade;
  },
  tessellate (shape, maxDeviation) {
    const facelist = [], edgeList = [];
    try {
      // Set up the Incremental Mesh builder, with a precision
      new oc.BRepMesh_IncrementalMesh(shape, maxDeviation);

      // Construct the edge hashes to assign proper indices to the edges
      let fullShapeEdgeHashes  = ForEachEdge(shape, (index, edge) => { });
      let fullShapeEdgeHashes2 = {};

      // Iterate through the faces and triangulate each one
      ForEachFace(shape, (faceIndex, myFace) => {
        let aLocation = new oc.TopLoc_Location();
        const myT = oc.BRep_Tool.prototype.Triangulation(myFace, aLocation);
        if (myT.IsNull()) { console.error("Encountered Null Face!"); return; }

        const this_face = {
          vertex_coord: [],
          normal_coord: [],
          tri_indexes: [],
          number_of_triangles: 0,
          face_index: faceIndex
        };

        const pc = new oc.Poly_Connect(myT);
        const Nodes = myT.get().Nodes();

        // write vertex buffer
        this_face.vertex_coord = new Array(Nodes.Length() * 3);
        for(let i = 0; i < Nodes.Length(); i++) {
          const p = Nodes.Value(i + 1).Transformed(aLocation.Transformation());
          this_face.vertex_coord[(i * 3) + 0] = p.X();
          this_face.vertex_coord[(i * 3) + 1] = p.Y();
          this_face.vertex_coord[(i * 3) + 2] = p.Z();
        }

        // write normal buffer
        const myNormal = new oc.TColgp_Array1OfDir(Nodes.Lower(), Nodes.Upper());
        const SST = new oc.StdPrs_ToolTriangulatedShape();
        SST.Normal(myFace, pc, myNormal);
        this_face.normal_coord = new Array(myNormal.Length() * 3);
        for(let i = 0; i < myNormal.Length(); i++) {
          const d = myNormal.Value(i + 1).Transformed(aLocation.Transformation());
          this_face.normal_coord[(i * 3)+ 0] = d.X();
          this_face.normal_coord[(i * 3)+ 1] = d.Y();
          this_face.normal_coord[(i * 3)+ 2] = d.Z();
        }
        
        // write triangle buffer
        const orient = myFace.Orientation();
        const triangles = myT.get().Triangles();
        this_face.tri_indexes = new Array(triangles.Length() * 3);
        let validFaceTriCount = 0;
        for(let nt = 1; nt <= myT.get().NbTriangles(); nt++) {
          const t = triangles.Value(nt);
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
          if (!fullShapeEdgeHashes2.hasOwnProperty(edgeHash)) {
            const this_edge = {
              vertex_coord: [],
              edge_index: -1
            };

            const myP = oc.BRep_Tool.prototype.PolygonOnTriangulation(myEdge, myT, aLocation);
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
            fullShapeEdgeHashes2[edgeHash] = edgeHash;

            edgeList.push(this_edge);
          }
        });

      });


    } catch(err) {
      setTimeout(() => {
        err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
        throw err; 
      }, 0);
    }

    return [facelist, edgeList];
  }
}
