const openCascadeHelper = {
  setOpenCascade (openCascade) {
    this.openCascade = openCascade;
  },
  tessellate (shape, maxDeviation) {
    const facelist = [], edgeList = [];
    try{
      new this.openCascade.BRepMesh_IncrementalMesh(shape, maxDeviation);
      const ExpFace = new this.openCascade.TopExp_Explorer();
      for(ExpFace.Init(shape, this.openCascade.TopAbs_FACE); ExpFace.More(); ExpFace.Next()) {
        const myFace = this.openCascade.TopoDS.prototype.Face(ExpFace.Current());
        const aLocation = new this.openCascade.TopLoc_Location();
        const myT = this.openCascade.BRep_Tool.prototype.Triangulation(myFace, aLocation);
        if(myT.IsNull()) {
          continue;
        }

        const this_face = {
          vertex_coord: [],
          normal_coord: [],
          tri_indexes: [],
          number_of_triangles: 0,
        };

        const pc = new this.openCascade.Poly_Connect(myT);
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
        const myNormal = new this.openCascade.TColgp_Array1OfDir(Nodes.Lower(), Nodes.Upper());
        const SST = new this.openCascade.StdPrs_ToolTriangulatedShape();
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
          if(orient !== this.openCascade.TopAbs_FORWARD) {
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
      }

      const anEdgeExplorer = new this.openCascade.TopExp_Explorer(shape, this.openCascade.TopAbs_EDGE);
      for(anEdgeExplorer.Init(shape, this.openCascade.TopAbs_EDGE); anEdgeExplorer.More(); anEdgeExplorer.Next()) {
        const myEdge = this.openCascade.TopoDS.prototype.Edge(anEdgeExplorer.Current());

        // Solid objects always double cover each edge
        // TODO: Make this better for open faces and lines
        if(myEdge.Orientation() > 0) continue;

        const aLocation = new this.openCascade.TopLoc_Location();
        const adaptorCurve = new this.openCascade.BRepAdaptor_Curve(myEdge);
        const tangDef = new this.openCascade.GCPnts_TangentialDeflection(adaptorCurve, maxDeviation, 0.5);

        // write vertex buffer
        let this_edge = new Array(tangDef.NbPoints() * 3);
        for(let i = 0; i < tangDef.NbPoints(); i++) {
          const p = tangDef.Value(i + 1).Transformed(aLocation.Transformation());
          this_edge[(i * 3) + 0] = p.X();
          this_edge[(i * 3) + 1] = p.Y();
          this_edge[(i * 3) + 2] = p.Z();
        }

        edgeList.push(this_edge);
      }
    } catch(err) {
      setTimeout(() => {
        err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
        throw err; 
      }, 0);
    }

    return [facelist, edgeList];
  }
}
