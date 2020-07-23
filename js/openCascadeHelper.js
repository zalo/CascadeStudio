const openCascadeHelper = {
  setOpenCascade (openCascade) {
    this.openCascade = openCascade;
  },
  tessellate (shape) {
    const facelist = [];
    new this.openCascade.BRepMesh_IncrementalMesh(shape, 0.1);
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
      for(let i = Nodes.Lower(); i <= Nodes.Upper(); i++) {
        const p = Nodes.Value(i).Transformed(aLocation.Transformation());
        this_face.vertex_coord[((i - 1) * 3)+ 0] = p.X();
        this_face.vertex_coord[((i - 1) * 3)+ 1] = p.Y();
        this_face.vertex_coord[((i - 1) * 3)+ 2] = p.Z();
      }

      // write normal buffer
      const myNormal = new this.openCascade.TColgp_Array1OfDir(Nodes.Lower(), Nodes.Upper());
      const SST = new this.openCascade.StdPrs_ToolTriangulatedShape();
      SST.Normal(myFace, pc, myNormal);
      this_face.normal_coord = new Array(myNormal.Length() * 3);
      for(let i = myNormal.Lower(); i <= myNormal.Upper(); i++) {
        const d = myNormal.Value(i).Transformed(aLocation.Transformation());
        this_face.normal_coord[((i - 1) * 3)+ 0] = d.X();
        this_face.normal_coord[((i - 1) * 3)+ 1] = d.Y();
        this_face.normal_coord[((i - 1) * 3)+ 2] = d.Z();
      }

      // set uvcoords buffers to NULL
      // necessary for JoinPrimitive to be performed
      // this_face.tex_coord = null;
      
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
          this_face.tri_indexes[(validFaceTriCount * 3) + 0] = n1;
          this_face.tri_indexes[(validFaceTriCount * 3) + 1] = n2;
          this_face.tri_indexes[(validFaceTriCount * 3) + 2] = n3;
          validFaceTriCount++;
        // }
      }
      this_face.number_of_triangles = validFaceTriCount;
      facelist.push(this_face);
    }
    return facelist;
  },
  joinPrimitives (facelist) {
    let obP = 0;
    let obN = 0;
    let obTR = 0;
    let advance = 0;
    const locVertexcoord = [];
    const locNormalcoord = [];
    const locTriIndices = [];

    facelist.forEach(myface => {
      for(let x = 0; x < myface.vertex_coord.length/3; x++) {
        locVertexcoord[(obP * 3) + 0] = myface.vertex_coord[(x * 3) + 0];
        locVertexcoord[(obP * 3) + 1] = myface.vertex_coord[(x * 3) + 1];
        locVertexcoord[(obP * 3) + 2] = myface.vertex_coord[(x * 3) + 2];
        obP++;
      }
      for(let x = 0; x < myface.normal_coord.length/3; x++) {
        locNormalcoord[(obN * 3) + 0] = myface.normal_coord[(x * 3) + 0];
        locNormalcoord[(obN * 3) + 1] = myface.normal_coord[(x * 3) + 1];
        locNormalcoord[(obN * 3) + 2] = myface.normal_coord[(x * 3) + 2];
        obN++;
      }
      for(let x = 0; x < myface.tri_indexes.length/3; x++) {
        locTriIndices[(obTR * 3) + 0] = myface.tri_indexes[(x * 3) + 0] + advance - 1;
        locTriIndices[(obTR * 3) + 1] = myface.tri_indexes[(x * 3) + 1] + advance - 1;
        locTriIndices[(obTR * 3) + 2] = myface.tri_indexes[(x * 3) + 2] + advance - 1;
        obTR++;
      }

      advance = obP;
    });
    return [locVertexcoord, locNormalcoord, locTriIndices];
  },
  objGetTriangle (trianglenum, locTriIndices) {
    const pID = locTriIndices[(trianglenum * 3) + 0] * 3;
    const qID = locTriIndices[(trianglenum * 3) + 1] * 3;
    const rID = locTriIndices[(trianglenum * 3) + 2] * 3;

    const vertices = [pID, qID, rID];
    const normals = [pID, qID, rID];
    const texcoords = [pID, qID, rID];
    return [vertices, normals, texcoords];
  },
  generateGeometry (tot_triangle_count, locVertexcoord, locNormalcoord, locTriIndices) {
    const vertices = [];
    const faces = [];
    function v(x, y, z) {
      vertices.push(new THREE.Vector3(x, y, z));
    }
    function f3(a, b, c, n1_x, n1_y, n1_z, n2_x, n2_y, n2_z, n3_x, n3_y, n3_z) {
      faces.push(new THREE.Face3(a, b, c, [
        new THREE.Vector3(n1_x, n1_y, n1_z),
        new THREE.Vector3(n2_x, n2_y, n2_z),
        new THREE.Vector3(n3_x, n3_y, n3_z)
      ]));
    }
    for(let i = 0; i < tot_triangle_count; i++) {
      const [vertices_idx, /*normals_idx*/, /*texcoords_idx*/] = this.objGetTriangle(i, locTriIndices);
      // first vertex
      v(
        locVertexcoord[vertices_idx[0] + 0],
        locVertexcoord[vertices_idx[0] + 1],
        locVertexcoord[vertices_idx[0] + 2]
      );
      // second vertex
      v(
        locVertexcoord[vertices_idx[1] + 0],
        locVertexcoord[vertices_idx[1] + 1],
        locVertexcoord[vertices_idx[1] + 2]
      );
      // third vertex
      v(
        locVertexcoord[vertices_idx[2] + 0],
        locVertexcoord[vertices_idx[2] + 1],
        locVertexcoord[vertices_idx[2] + 2]
      );
    }
    for(let i = 0; i < tot_triangle_count; i++) {
      const [/*vertices_idx*/, normals_idx, /*texcoords_idx*/] = this.objGetTriangle(i, locTriIndices);
      f3(
        0 + i * 3,
        1 + i * 3,
        2 + i * 3,
        locNormalcoord[normals_idx[0] + 0],
        locNormalcoord[normals_idx[0] + 1],
        locNormalcoord[normals_idx[0] + 2],
        locNormalcoord[normals_idx[1] + 0],
        locNormalcoord[normals_idx[1] + 1],
        locNormalcoord[normals_idx[1] + 2],
        locNormalcoord[normals_idx[2] + 0],
        locNormalcoord[normals_idx[2] + 1],
        locNormalcoord[normals_idx[2] + 2]
      );
    }
    return [vertices, faces];
  }
}

//export default openCascadeHelper;
