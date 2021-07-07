function LengthOfCurve(geomAdaptor, UMin, UMax, segments = 5) {
  let point1 = new THREE.Vector3(), point2 = new THREE.Vector3(), arcLength = 0, gpPnt = new oc.gp_Pnt();
  for (let s = UMin; s <= UMax; s += (UMax - UMin) / segments){
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

function ShapeToMesh(shape, maxDeviation, fullShapeEdgeHashes, fullShapeFaceHashes) {
    let facelist = [], edgeList = [];
    try {
      shape = new oc.TopoDS_Shape(shape);

      // Set up the Incremental Mesh builder, with a precision
      new oc.BRepMesh_IncrementalMesh(shape, maxDeviation, false, maxDeviation * 5);

      // Construct the edge hashes to assign proper indices to the edges
      let fullShapeEdgeHashes2 = {};

      // Iterate through the faces and triangulate each one
      let triangulations = []; let uv_boxes = []; let curFace = 0;
      ForEachFace(shape, (faceIndex, myFace) => {
        let aLocation = new oc.TopLoc_Location();
        let myT = oc.BRep_Tool.prototype.Triangulation(myFace, aLocation);
        if (myT.IsNull()) { console.error("Encountered Null Face!"); argCache = {}; return; }

        let this_face = {
          vertex_coord: [],
          uv_coord: [],
          normal_coord: [],
          tri_indexes: [],
          number_of_triangles: 0,
          face_index: fullShapeFaceHashes[myFace.HashCode(100000000)]
        };

        let pc = new oc.Poly_Connect(myT);
        let Nodes = myT.get().Nodes();

        // Write vertex buffer
        this_face.vertex_coord = new Array(Nodes.Length() * 3);
        for(let i = 0; i < Nodes.Length(); i++) {
          let p = Nodes.Value(i + 1).Transformed(aLocation.Transformation());
          this_face.vertex_coord[(i * 3) + 0] = p.X();
          this_face.vertex_coord[(i * 3) + 1] = p.Y();
          this_face.vertex_coord[(i * 3) + 2] = p.Z();
        }

        // Write UV buffer
        let orient = myFace.Orientation();
        if (myT.get().HasUVNodes()) {
          // Get UV Bounds
          let UMin = 0, UMax = 0, VMin = 0, VMax = 0;

          let UVNodes = myT.get().UVNodes(), UVNodesLength = UVNodes.Length();
          this_face.uv_coord = new Array(UVNodesLength * 2);
          for(let i = 0; i < UVNodesLength; i++) {
            let p = UVNodes.Value(i + 1);
            let x = p.X(), y = p.Y();
            this_face.uv_coord[(i * 2) + 0] = x;
            this_face.uv_coord[(i * 2) + 1] = y;

            // Compute UV Bounds
            if(i == 0){ UMin = x; UMax = x; VMin = y; VMax = y; }
            if (x < UMin) { UMin = x; } else if (x > UMax) { UMax = x; }
            if (y < VMin) { VMin = y; } else if (y > VMax) { VMax = y; }
          }

          // Compute the Arclengths of the Isoparametric Curves of the face
          let surface = oc.BRep_Tool.prototype.Surface(myFace).get();
          let UIso_Handle = surface.UIso(UMin + ((UMax - UMin) * 0.5));
          let VIso_Handle = surface.VIso(VMin + ((VMax - VMin) * 0.5));
          let UAdaptor = new oc.GeomAdaptor_Curve(VIso_Handle);
          let VAdaptor = new oc.GeomAdaptor_Curve(UIso_Handle);
          uv_boxes.push({
            w: LengthOfCurve(UAdaptor, UMin, UMax),
            h: LengthOfCurve(VAdaptor, VMin, VMax),
            index: curFace
          });

          // Normalize each face's UVs to 0-1
          for (let i = 0; i < UVNodesLength; i++) {
            let x = this_face.uv_coord[(i * 2) + 0],
                y = this_face.uv_coord[(i * 2) + 1];
            
            x = ((x - UMin)/(UMax - UMin));
            y = ((y - VMin)/(VMax - VMin));
            if (orient !== oc.TopAbs_FORWARD) { x = 1.0 - x; }

            this_face.uv_coord[(i * 2) + 0] = x;
            this_face.uv_coord[(i * 2) + 1] = y;
          }
        }

        // Write normal buffer
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
        
        // Write triangle buffer
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
        curFace += 1;

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

      // Scale each face's UVs to Worldspace and pack them into a 0-1 Atlas with potpack
      let padding = 2;
      for (let f = 0; f < uv_boxes.length; f++) {  uv_boxes[f].w += padding; uv_boxes[f].h += padding; }
      let packing_stats = potpack(uv_boxes);
      for (let f = 0; f < uv_boxes.length; f++) {
        let box = uv_boxes[f];
        let this_face = facelist[box.index];
        for (let q = 0; q < this_face.uv_coord.length/2; q++) {
          let x = this_face.uv_coord[(q * 2) + 0],
              y = this_face.uv_coord[(q * 2) + 1];
          
          x = ((x * (box.w - padding)) + (box.x + (padding*0.5))) / Math.max(packing_stats.w, packing_stats.h);
          y = ((y * (box.h - padding)) + (box.y + (padding*0.5))) / Math.max(packing_stats.w, packing_stats.h);

          this_face.uv_coord[(q * 2) + 0] = x;
          this_face.uv_coord[(q * 2) + 1] = y;

          //Visualize Packed UVs
          //this_face.vertex_coord[(q * 3) + 0] = x * 100.0;
          //this_face.vertex_coord[(q * 3) + 1] = y * 100.0;
          //this_face.vertex_coord[(q * 3) + 2] = 0.0;
        }
      }

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
