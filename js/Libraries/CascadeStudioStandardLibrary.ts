// Cascade Studio Standard Library
// Adding new standard library features and functions:
// 1. Research the OpenCascade API: https://www.opencascade.com/doc/occt-7.4.0/refman/html/annotated.html
// 2. Write your new function inside of Cascade Studio, using "oc." to refer to the raw OpenCascade API.
// 3. Add your new convenience function to this file
// 4. Add typescript annotations to index.ts in this same directory
// 5. Submit a PR to the main repository! https://github.com/zalo/CascadeStudio/pulls
// -
// (Optional) If base functions appear to be missing, fork opencascade.js and add them to this file: 
//  - https://github.com/donalffons/opencascade.js/blob/master/opencascade.idl
//  - Upon push, Github Actions will build a new version of the library and commit it back to the repo
//  - From there, you can graft those into CascadeStudio/node_modules/opencascade.js/dist (following its existing conventions)

/** Import Misc. Utilities that aren't part of the Exposed Library */
ImportLibrary(['../Libraries/CascadeStudioStandardUtils.ts']);

/** The list that stores all of the OpenCascade shapes for rendering.  
 * Add to this when using imported files or doing custom oc. operations. 
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var sceneShapes: oc.TopoDS_Shape[];

/** The dictionary that stores all of your imported STEP and IGES files.  Push to sceneShapes to render in the view! 
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var externalShapes: { [filename: string]: oc.TopoDS_Shape };

/** Explicitly Cache the result of this operation so that it can return instantly next time it is called with the same arguments.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let box = CacheOp(arguments, () => { return new oc.BRepPrimAPI_MakeBox(x, y, z).Shape(); });``` */
function CacheOp(arguments: IArguments, cacheMiss: () => oc.TopoDS_Shape): oc.TopoDS_Shape;
 /** Remove this object from this array.  Useful for preventing objects being added to `sceneShapes` (in cached functions).
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let box = CacheOp(arguments, () => { let box = Box(x,y,z); sceneShapes = Remove(sceneShapes, box); return box; });``` */
function Remove(array: any[], toRemove: any): any[];

/** This function imports a typescript file to the current workspace.
 * Note, urls are not imported multiple times unless forceReload is true. */
function ImportLibrary(urls: string[], forceReload?: boolean): void;

/** Creates a solid box with dimensions x, y, and, z and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myBox = Box(10, 20, 30);```*/
function Box(x: number, y: number, z: number, centered?: boolean): oc.TopoDS_Shape {
  if (!centered) { centered = false;}
  let curBox = CacheOp(arguments, () => {
    // Construct a Box Primitive
    let box = new oc.BRepPrimAPI_MakeBox_1(x, y, z).Shape();
    if (centered) {
      return Translate([-x / 2, -y / 2, -z / 2], box);
    } else {
      return box;
    }
  });

  sceneShapes.push(curBox);
  return curBox;
}

/** Creates a solid sphere of specified radius and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let mySphere = Sphere(40);```*/
function Sphere(radius: number): oc.TopoDS_Shape {
  let curSphere = CacheOp(arguments, () => {
    // Construct a Sphere Primitive
    let spherePlane = new oc.gp_Ax2_3(new oc.gp_Pnt_3(0, 0, 0), oc.gp.DZ());
    return new oc.BRepPrimAPI_MakeSphere_9(spherePlane, radius).Shape();
  });

  sceneShapes.push(curSphere);
  return curSphere;
}

/** Creates a solid cylinder of specified radius and height and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myCylinder = Cylinder(30, 50);```*/
function Cylinder(radius: number, height: number, centered?: boolean): oc.TopoDS_Shape {
  let curCylinder = CacheOp(arguments, () => {
    let cylinderPlane = new oc.gp_Ax2_3(new oc.gp_Pnt_3(0, 0, centered ? -height / 2 : 0), new oc.gp_Dir_4(0, 0, 1));
    return new oc.BRepPrimAPI_MakeCylinder_3(cylinderPlane, radius, height).Shape();
  });
  sceneShapes.push(curCylinder);
  return curCylinder;
}

/** Creates a solid cone of specified bottom radius, top radius, and height and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myCone = Cone(30, 50);```*/
function Cone(radius1: number, radius2: number, height: number): oc.TopoDS_Shape {
  let curCone = CacheOp(arguments, () => {
    return new oc.BRepPrimAPI_MakeCone_1(radius1, radius2, height).Shape();
  });
  sceneShapes.push(curCone);
  return curCone;
}

/** Creates a polygon from a list of 3-component lists (points) and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let triangle = Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]);```*/
function Polygon(points: number[][], wire?: boolean): oc.TopoDS_Shape {
  let curPolygon = CacheOp(arguments, () => {
    let gpPoints = [];
    for (let ind = 0; ind < points.length; ind++) {
      gpPoints.push(convertToPnt(points[ind]));
    }

    let polygonWire = new oc.BRepBuilderAPI_MakeWire_1();
    for (let ind = 0; ind < points.length - 1; ind++) {
      let seg = new oc.GC_MakeSegment_1(gpPoints[ind], gpPoints[ind + 1]).Value().get();
      let edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(seg)).Edge();
      let innerWire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
      polygonWire.Add_2(innerWire);
    }
    let seg2 = new oc.GC_MakeSegment_1(gpPoints[points.length - 1], gpPoints[0]).Value().get();
    let edge2 = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(seg2)).Edge();
    let innerWire2 = new oc.BRepBuilderAPI_MakeWire_2(edge2).Wire();
    polygonWire.Add_2(innerWire2);
    let finalWire = polygonWire.Wire();

    if (wire) {
      return finalWire;
    } else {
      return new oc.BRepBuilderAPI_MakeFace_15(finalWire, false).Face();
    }
  });
  sceneShapes.push(curPolygon);
  return curPolygon;
}

/** Creates a circle from a radius and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let circle = Circle(50);```*/
function Circle(radius:number, wire?:boolean) : oc.TopoDS_Shape {
  let curCircle = CacheOp(arguments, () => {
    let circle = new oc.GC_MakeCircle_2(new oc.gp_Ax2_3(new oc.gp_Pnt_3(0, 0, 0),
      new oc.gp_Dir_4(0, 0, 1)), radius).Value().get();
    let edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(circle)).Edge();
    let circleWire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
    if (wire) { return oc.TopoDS.Wire_1(circleWire); }
    return new oc.BRepBuilderAPI_MakeFace_15(circleWire, false).Face();
  });
  sceneShapes.push(curCircle);
  return curCircle;
}

/** Creates a bspline from a list of 3-component lists (points). 
 * This can be converted into a face via the respective oc.BRepBuilderAPI functions.
 * Or used directly with BRepPrimAPI_MakeRevolution()
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let bspline = BSpline([[0,0,0], [40, 0, 50], [50, 0, 50]], true);```*/
function BSpline(points:number[][], closed?:boolean) : oc.TopoDS_Shape {
  let curSpline = CacheOp(arguments, () => {
    let ptList = new oc.TColgp_Array1OfPnt_2(1, points.length + (closed ? 1 : 0));
    for (let pIndex = 1; pIndex <= points.length; pIndex++) {
      ptList.SetValue(pIndex, convertToPnt(points[pIndex - 1]));
    }
    if (closed) { ptList.SetValue(points.length + 1, ptList.Value(1)); }

    let geomCurveHandle = new oc.GeomAPI_PointsToBSpline_2(ptList, 3, 8, oc.GeomAbs_Shape.GeomAbs_C2, 1.0e-3).Curve().get();
    let edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(geomCurveHandle)).Edge();
    return     new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
  });
  sceneShapes.push(curSpline);
  return curSpline;
}

/** Creates set of glyph solids from a string and a font-file and adds it to sceneShapes.
 * Note that all the characters share a singular face. 
 * 
 * Defaults: size:36, height:0.15, fontName: 'Consolas'
 * 
 * Try 'Roboto' or 'Papyrus' for an alternative typeface.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myText = Text3D("Hello!");```*/
function Text3D(text: string, size?: number, height?: number, fontName?: string) : oc.TopoDS_Shape {
  if (!size   ) { size    = 36; }
  if (!height && height !== 0.0) { height  = 0.15; }
  if (!fontName) { fontName = "Consolas"; }

  let textArgs = JSON.stringify(arguments);
  let curText = CacheOp(arguments, () => {
    if (fonts[fontName] === undefined) { argCache = {}; console.log("Font not loaded or found yet!  Try again..."); return; }
    let textFaces = [];
    let commands = fonts[fontName].getPath(text, 0, 0, size).commands;
    for (let idx = 0; idx < commands.length; idx++) {
      if (commands[idx].type === "M") {
        // Start a new Glyph
        var firstPoint = new oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);
        var lastPoint = firstPoint;
        var currentWire = new oc.BRepBuilderAPI_MakeWire_1();
      } else if (commands[idx].type === "Z") {
        // End the current Glyph and Finish the Path

        let faceBuilder = null;
        if (textFaces.length > 0) {
          faceBuilder = new oc.BRepBuilderAPI_MakeFace_22(
            textFaces[textFaces.length - 1], currentWire.Wire());
        } else {
          faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(currentWire.Wire(), false);
        }

        textFaces.push(faceBuilder.Face());
      } else if (commands[idx].type === "L") {
        let nextPoint = new oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);
        if (lastPoint.X() === nextPoint.X() && lastPoint.Y() === nextPoint.Y()) { continue; }
        let lineSegment = new oc.GC_MakeSegment_1(lastPoint, nextPoint).Value().get();
        let lineEdge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(lineSegment)).Edge();
        currentWire.Add_2(new oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());
        lastPoint = nextPoint;
      } else if (commands[idx].type === "Q") {
        let controlPoint = new oc.gp_Pnt_3(commands[idx].x1, commands[idx].y1, 0);
        let nextPoint    = new oc.gp_Pnt_3(commands[idx].x,  commands[idx].y,  0);

        let ptList = new oc.TColgp_Array1OfPnt_2(1, 3);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint);
        ptList.SetValue(3, nextPoint);
        let quadraticCurve = new oc.Geom_BezierCurve_1(ptList); // THIS IS THE LINE THAT IS FAILING
        let lineEdge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(new oc.Handle_Geom_BezierCurve_2(quadraticCurve).get())).Edge();
        currentWire.Add_2(new oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());

        lastPoint = nextPoint;
      } else if (commands[idx].type === "C") {
        let controlPoint1 = new oc.gp_Pnt_3(commands[idx].x1, commands[idx].y1, 0);
        let controlPoint2 = new oc.gp_Pnt_3(commands[idx].x2, commands[idx].y2, 0);
        let nextPoint = new oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);

        let ptList = new oc.TColgp_Array1OfPnt_2(1, 4);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint1);
        ptList.SetValue(3, controlPoint2);
        ptList.SetValue(4, nextPoint);
        let cubicCurve = new oc.Geom_BezierCurve(ptList);
        let lineEdge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(new oc.Handle_Geom_BezierCurve(cubicCurve).get())).Edge();
        currentWire.Add_2(new oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());
          
        lastPoint = nextPoint;
      }
    }

    if (height === 0) {
      return textFaces[textFaces.length - 1];
    } else {
      textFaces[textFaces.length - 1].hash = stringToHash(textArgs);
      let textSolid = Rotate([1, 0, 0], -90, Extrude(textFaces[textFaces.length - 1], [0, 0, height * size]));
      sceneShapes = Remove(sceneShapes, textSolid);
      return textSolid;
    }
  });

  sceneShapes.push(curText);
  return curText;
}

// These foreach functions are not cache friendly right now!
/** Iterate over all the solids in this shape, calling `callback` on each one. */
function ForEachSolid(shape: oc.TopoDS_Shape, callback: (index: Number, shell: oc.TopoDS_Solid) => void): void {
  let solid_index = 0;
  let anExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(solid_index++, oc.TopoDS.Solid_1(anExplorer.Current()));
  }
}
/** Returns the number of solids in this compound shape. */
function GetNumSolidsInCompound(shape: oc.TopoDS_Shape) : number {
  if (!shape || shape.ShapeType() > 1 || shape.IsNull()) { console.error("Not a compound shape!"); return shape; }
  let solidsFound = 0;
  ForEachSolid(shape, (i, s) => { solidsFound++; });
  return solidsFound;
}
/** Gets the indexth solid from this compound shape. */
function GetSolidFromCompound(shape: oc.TopoDS_Shape, index?:number, keepOriginal?:boolean): oc.TopoDS_Solid {
  if (!shape || shape.ShapeType() > 1 || shape.IsNull()) { console.error("Not a compound shape!"); return shape; }
  if (!index) { index = 0;}

  let sol = CacheOp(arguments, () => {
    let innerSolid = {}; let solidsFound = 0;
    ForEachSolid(shape, (i, s) => {
      if (i === index) { innerSolid = new oc.BRepBuilderAPI_Copy_2(s, true, false).Shape(); } solidsFound++;
    });
    if (solidsFound === 0) { console.error("NO SOLIDS FOUND IN SHAPE!"); innerSolid = shape; }
    innerSolid.hash = shape.hash + 1;
    return innerSolid;
  });

  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(sol);

  return sol;
}

/** Iterate over all the shells in this shape, calling `callback` on each one. */
function ForEachShell(shape: oc.TopoDS_Shape, callback: (index: Number, shell: oc.TopoDS_Shell) => void): void {
  let shell_index = 0;
  let anExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_SHELL, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, oc.TopAbs_ShapeEnum.TopAbs_SHELL, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(shell_index++, oc.TopoDS.Shell_1(anExplorer.Current()));
  }
}

/** Iterate over all the faces in this shape, calling `callback` on each one. */
function ForEachFace(shape: oc.TopoDS_Shape, callback: (index: number, face: oc.TopoDS_Face) => void): void {
  let face_index = 0;
  let anExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(face_index++, oc.TopoDS.Face_1(anExplorer.Current()));
  }
}

/** Iterate over all the wires in this shape, calling `callback` on each one. */
function ForEachWire(shape: oc.TopoDS_Shape, callback: (index: number, wire: oc.TopoDS_Wire) => void): void {
  let wire_index = 0;
  let anExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_WIRE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, oc.TopAbs_ShapeEnum.TopAbs_WIRE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(wire_index++, oc.TopoDS.Wire_1(anExplorer.Current()));
  }
}
/** Gets the indexth wire from this face (or above) shape. */
function GetWire(shape: oc.TopoDS_Face, index?:number, keepOriginal?:boolean): oc.TopoDS_Wire {
  if (!shape || shape.ShapeType() > 4 || shape.IsNull()) { console.error("Not a wire shape!"); return shape; }
  if (!index) { index = 0;}

  let wire = CacheOp(arguments, () => {
    let innerWire = { hash: 0 }; let wiresFound = 0;
    ForEachWire(shape, (i, s) => {
      if (i === index) { innerWire = oc.TopoDS.Wire_1(s); } wiresFound++;
    });
    if (wiresFound === 0) { console.error("NO WIRES FOUND IN SHAPE!"); innerWire = shape; }
    innerWire.hash = shape.hash + 1;
    return innerWire;
  });

  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(wire);

  return wire;
}

/** Iterate over all the UNIQUE indices and edges in this shape, calling `callback` on each one. */
function ForEachEdge(shape: oc.TopoDS_Shape, callback: (index: number, edge: oc.TopoDS_Edge) => void): {[edgeHash:number] : number} {
  let edgeHashes = {};
  let edgeIndex = 0;
  let anExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    let edge = oc.TopoDS.Edge_1(anExplorer.Current());
    let edgeHash = edge.HashCode(100000000);
    if(!edgeHashes.hasOwnProperty(edgeHash)){
      edgeHashes[edgeHash] = edgeIndex;
      callback(edgeIndex++, edge);
    }
  }
  return edgeHashes;
}

/** Iterate over all the vertices in this shape, calling `callback` on each one. */
function ForEachVertex(shape: oc.TopoDS_Shape, callback: (vertex: oc.TopoDS_Vertex) => void): void {
  let anExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_VERTEX, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, oc.TopAbs_ShapeEnum.TopAbs_VERTEX, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(oc.TopoDS.Vertex_1(anExplorer.Current()));
  }
}

/** Attempt to Fillet all selected edge indices in "edgeList" with a radius. 
 * Hover over the edges you'd like to select and use those indices as in the example.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```FilletEdges(shape, 1, [0,1,2,7]);``` */
function FilletEdges(shape: oc.TopoDS_Shape, radius: number, edgeList: number[], keepOriginal?:boolean): oc.TopoDS_Shape { 
  let curFillet = CacheOp(arguments, () => {
    let mkFillet = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    let foundEdges = 0;
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkFillet.Add_2(radius, edge); foundEdges++; }
    });
    if (foundEdges == 0) {
      console.error("Fillet Edges Not Found!  Make sure you are looking at the object _before_ the Fillet is applied!");
      return new oc.BRepBuilderAPI_Copy_2(shape, true, false).Shape();
    }
    return new oc.BRepBuilderAPI_Copy_2(mkFillet.Shape(), true, false).Shape();
  });
  sceneShapes.push(curFillet);
  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shape); }
  return curFillet;
}

/** Attempt to Chamfer all selected edge indices in "edgeList" symmetrically by distance. 
 * Hover over the edges you'd like to select and use those indices in the edgeList array.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```ChamferEdges(shape, 1, [0,1,2,7]);``` */
function ChamferEdges(shape: oc.TopoDS_Shape, distance: number, edgeList: number[], keepOriginal?:boolean): oc.TopoDS_Shape { 
  let curChamfer = CacheOp(arguments, () => {
    let mkChamfer = new oc.BRepFilletAPI_MakeChamfer(shape);
    let foundEdges = 0;
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkChamfer.Add_2(distance, edge); foundEdges++; }
    });
    if (foundEdges == 0) {
      console.error("Chamfer Edges Not Found!  Make sure you are looking at the object _before_ the Chamfer is applied!");
      return new oc.BRepBuilderAPI_Copy_2(shape, true, false).Shape();
    }
    return new oc.BRepBuilderAPI_Copy_2(mkChamfer.Shape(), true, false).Shape();
  });
  sceneShapes.push(curChamfer);
  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shape); }
  return curChamfer;
}

/** BETA: Transform a shape using an in-view transformation gizmo.
 * 
 * Shortcuts: `T` - Translate, `R` - Rotate, `S` - Scale, `W`/`L` - Toggle World/Local
 * 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let transformedSphere = Transform(Sphere(50));```*/
function Transform(translation?: number[], rotation?: (number|number[])[], scale: number, shapes: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape {
  let args = arguments;
  return CacheOp(arguments, () => {
    if (args.length == 4) {
      // Create the transform gizmo and add it to the scene
      postMessage({ "type": "createTransformHandle", payload: { translation: translation, rotation: rotation, scale: scale, lineAndColumn: getCallingLocation() } }, null);
      // Transform the Object(s)
      return Translate(translation, Rotate(rotation[0], rotation[1], Scale(scale, shapes)), keepOriginal);
    } else {
      // Create the transform gizmo and add it to the scene
      postMessage({ "type": "createTransformHandle", payload: { translation: [0, 0, 0], rotation: [[0, 1, 0], 1], scale: 1, lineAndColumn: getCallingLocation() } }, null);
      return translation; // The first element will be the shapes
    }
  });
}

/** Translate a shape along the x, y, and z axes (using an array of 3 numbers).
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let upwardSphere = Translate([0, 0, 50], Sphere(50));```*/
function Translate(offset: number[], shapes: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape {
  let translated = CacheOp(arguments, () => {
    let transformation = new oc.gp_Trsf_1();
    transformation.SetTranslation_1(new oc.gp_Vec_4(offset[0], offset[1], offset[2]));
    let translation = new oc.TopLoc_Location_2(transformation);
    if (!isArrayLike(shapes)) {
      return new oc.BRepBuilderAPI_Copy_2(shapes.Moved(translation), true, false).Shape();
    } else if (shapes.length >= 1) {      // Do the normal translation
      let newTrans = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newTrans.push(new oc.BRepBuilderAPI_Copy_2(shapes[shapeIndex].Moved(translation), true, false).Shape());
      }
      return newTrans;
    }
  });

  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shapes); }
  sceneShapes.push(translated);

  return translated;
}

/** Rotate a shape degrees about a 3-coordinate axis.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let leaningCylinder = Rotate([0, 1, 0], 45, Cylinder(25, 50));```*/
function Rotate(axis: number[], degrees: number, shapes: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape {
  let rotated = null;
  if (degrees === 0) {
    rotated = new oc.BRepBuilderAPI_Copy_2(shapes, true, false).Shape();
  } else {
    rotated = CacheOp(arguments, () => {
      let newRot;
      let transformation = new oc.gp_Trsf_1();
      transformation.SetRotation_1(
        new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Dir_2(
          new oc.gp_Vec_4(axis[0], axis[1], axis[2]))), degrees * 0.0174533);
      let rotation = new oc.TopLoc_Location_2(transformation);
      if (!isArrayLike(shapes)) {
        newRot = new oc.BRepBuilderAPI_Copy_2(shapes.Moved(rotation), true, false).Shape();
      } else if (shapes.length >= 1) {      // Do the normal rotation
        for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
          shapes[shapeIndex].Move(rotation);
        }
      }
      return newRot;
    });
  }
  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shapes); }
  sceneShapes.push(rotated);
  return rotated;
}

/** Scale a shape to be `scale` times its current size.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let scaledCylinder = Scale(50, Cylinder(0.5, 1));```*/
function Scale(scale: number, shapes: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape {
  let scaled = CacheOp(arguments, () => {
    let transformation = new oc.gp_Trsf_1();
    transformation.SetScaleFactor(scale);
    let scaling = new oc.TopLoc_Location_2(transformation);
    if (!isArrayLike(shapes)) {
      return new oc.BRepBuilderAPI_Copy_2(shapes.Moved(scaling), true, false).Shape();
    } else if (shapes.length >= 1) {      // Do the normal rotation
      let newScale = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newScale.push(new oc.BRepBuilderAPI_Copy_2(shapes[shapeIndex].Moved(scaling), true, false).Shape());
      }
      return newScale;
    }
  });

  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shapes); }
  sceneShapes.push(scaled);

  return scaled;
}

// TODO: These ops can be more cache optimized since they're multiple sequential ops
/** Joins a list of shapes into a single solid.
 * The original shapes are removed unless `keepObjects` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let sharpSphere = Union([Sphere(38), Box(50, 50, 50, true)]);```*/
function Union(objectsToJoin: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?: number, keepEdges?: boolean): oc.TopoDS_Shape {
  if (!fuzzValue) { fuzzValue = 0.1; }
  let curUnion = CacheOp(arguments, () => {
    let combined = new oc.BRepBuilderAPI_Copy_2(objectsToJoin[0], true, false).Shape();
    if (objectsToJoin.length > 1) {
      for (let i = 0; i < objectsToJoin.length; i++) {
        if (i > 0) {
          let combinedFuse = new oc.BRepAlgoAPI_Fuse_3(combined, objectsToJoin[i]);
          combinedFuse.SetFuzzyValue(fuzzValue);
          combinedFuse.Build();
          combined = combinedFuse.Shape();
        }
      }
    }

    if (!keepEdges) {
      let fusor = new oc.ShapeUpgrade_UnifySameDomain_2(combined, true, true, false); fusor.Build();
      combined = fusor.Shape();
    }

    return combined;
  });

  for (let i = 0; i < objectsToJoin.length; i++) {
    if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToJoin[i]); }
  }
  sceneShapes.push(curUnion);
  return curUnion;
}

/** Subtracts a list of shapes from mainBody.
 * The original shapes are removed unless `keepObjects` is true.  Returns a Compound Shape unless onlyFirstSolid is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let floatingCorners = Difference(Box(50, 50, 50, true), [Sphere(38)]);```*/
function Difference(mainBody: oc.TopoDS_Shape, objectsToSubtract: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?: number, keepEdges?: boolean): oc.TopoDS_Shape {
  let storedArgs = arguments;
  if(!fuzzValue) { fuzzValue = 0.1; }
  let curDifference = CacheOp(arguments, () => {
    if (!mainBody || mainBody.IsNull()) { console.error("Main Shape in Difference is null!"); }
    let difference = new oc.BRepBuilderAPI_Copy_2(mainBody, true, false).Shape();
    if (objectsToSubtract.length >= 1) {
      for (let i = 0; i < objectsToSubtract.length; i++) {
        if (!objectsToSubtract[i] || objectsToSubtract[i].IsNull()) { console.error("Tool in Difference is null!"); }
        let differenceCut = new oc.BRepAlgoAPI_Cut_3(difference, objectsToSubtract[i]);
        differenceCut.SetFuzzyValue(fuzzValue);
        differenceCut.Build();
        difference = differenceCut.Shape();
      }
    }
    
    if (!keepEdges) {
      let fusor = new oc.ShapeUpgrade_UnifySameDomain_2(difference, true, true, false); fusor.Build();
      difference = fusor.Shape();
    }

    difference.hash = ComputeHash(storedArgs);
    if (GetNumSolidsInCompound(difference) === 1) {
      difference = GetSolidFromCompound(difference, 0);
    }

    return difference;
  });

  if (!keepObjects) { sceneShapes = Remove(sceneShapes, mainBody); }
  for (let i = 0; i < objectsToSubtract.length; i++) {
    if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToSubtract[i]); }
  }
  sceneShapes.push(curDifference);
  return curDifference;
}

/** Takes only the intersection of a list of shapes.
 * The original shapes are removed unless `keepObjects` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let roundedBox = Intersection([Box(50, 50, 50, true), Sphere(38)]);```*/
function Intersection(objectsToIntersect: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?: number, keepEdges?: boolean) : oc.TopoDS_Shape {
  if (!fuzzValue) { fuzzValue = 0.1; }
  let curIntersection = CacheOp(arguments, () => {
    let intersected = new oc.BRepBuilderAPI_Copy_2(objectsToIntersect[0], true, false).Shape();
    if (objectsToIntersect.length > 1) {
      for (let i = 0; i < objectsToIntersect.length; i++) {
        if (i > 0) {
          let intersectedCommon = new oc.BRepAlgoAPI_Common_3(intersected, objectsToIntersect[i]);
          //intersectedCommon.SetFuzzyValue(fuzzValue);
          intersectedCommon.Build();
          intersected = intersectedCommon.Shape();
        }
      }
    }

    if (!keepEdges) {
      let fusor = new oc.ShapeUpgrade_UnifySameDomain_2(intersected, true, true, false); fusor.Build();
      intersected = fusor.Shape();
    }

    return intersected;
  });

  for (let i = 0; i < objectsToIntersect.length; i++) {
    if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToIntersect[i]); }
  }
  sceneShapes.push(curIntersection);
  return curIntersection;
}

/** Extrudes a shape along direction, a 3-component vector. Edges form faces, Wires form shells, Faces form solids, etc.
 * The original face is removed unless `keepFace` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let tallTriangle = Extrude(Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]), [0, 0, 50]);```*/
function Extrude(face: oc.TopoDS_Shape, direction: number[], keepFace?: boolean) : oc.TopoDS_Shape {
  let curExtrusion = CacheOp(arguments, () => {
    return new oc.BRepPrimAPI_MakePrism_1(face,
      new oc.gp_Vec_4(direction[0], direction[1], direction[2]), false, true).Shape();
  });
  
  if (!keepFace) { sceneShapes = Remove(sceneShapes, face); }
  sceneShapes.push(curExtrusion);
  return curExtrusion;
}

/** Removes internal, unused edges from the insides of faces on this shape.  Keeps the model clean.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let cleanPart = RemoveInternalEdges(part);```*/
function RemoveInternalEdges(shape: oc.TopoDS_Shape, keepShape?: boolean) : oc.TopoDS_Shape {
  let cleanShape = CacheOp(arguments, () => {
    let fusor = new oc.ShapeUpgrade_UnifySameDomain(shape);
    fusor.Build();
    return fusor.Shape();
  });
  
  if (!keepShape) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(cleanShape);
  return cleanShape;
}

/** Offsets the faces of a shape by offsetDistance
 * The original shape is removed unless `keepShape` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let roundedCube = Offset(Box(10,10,10), 10);```*/
function Offset(shape: oc.TopoDS_Shape, offsetDistance: number, tolerance?: number, keepShape?: boolean) : oc.TopoDS_Shape {
  if (!shape || shape.IsNull()) { console.error("Offset received Null Shape!"); }
  if (!tolerance) { tolerance = 0.1; }
  if (offsetDistance === 0.0) { return shape; }
  let curOffset = CacheOp(arguments, () => {
    let offset = null;
    if (shape.ShapeType() === 5) {
      offset = new oc.BRepOffsetAPI_MakeOffset();
      offset.AddWire(shape);
      offset.Perform(offsetDistance);
    } else {
      offset = new oc.BRepOffsetAPI_MakeOffsetShape_1();
      //BRepOffsetAPI_MakeOffsetShape_2(TopoDS_Shape, double, double, BRepOffset_Mode, bool, bool, GeomAbs_JoinType, bool)
      //const BRepOffset_Mode Mode=BRepOffset_Skin, const Standard_Boolean Intersection=Standard_False, const Standard_Boolean SelfInter=Standard_False, const GeomAbs_JoinType Join=GeomAbs_Arc, const Standard_Boolean RemoveIntEdges=Standard_False
      offset.PerformByJoin(shape, offsetDistance, tolerance, oc.BRepOffset_Mode.BRepOffset_Skin, false, false, oc.GeomAbs_JoinType.GeomAbs_Arc, false);
    }
    let offsetShape = new oc.BRepBuilderAPI_Copy_2(offset.Shape(), true, false).Shape();

    // Convert Shell to Solid as is expected
    if (offsetShape.ShapeType() == 3) {
      let solidOffset = new oc.BRepBuilderAPI_MakeSolid();
      solidOffset.Add(offsetShape);
      offsetShape = new oc.BRepBuilderAPI_Copy_2(solidOffset.Solid(), true, false).Shape();
    }
    
    return offsetShape;
  });
  
  if (!keepShape) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(curOffset);
  return curOffset;
}

/** Revolves this shape "degrees" about "axis" (a 3-component array).  Edges form faces, Wires form shells, Faces form solids, etc.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js) 
 * @example```let cone = Revolve(Polygon([[0, 0, 0], [0, 0, 50], [50, 0, 0]]));```*/
function Revolve(shape: oc.TopoDS_Shape, degrees?: number, axis?: number[], keepShape?: boolean, copy?: boolean): oc.TopoDS_Shape{
  if (!degrees  ) { degrees = 360.0; }
  if (!axis     ) { axis    = [0, 0, 1]; }
  let curRevolution = CacheOp(arguments, () => {
    if (degrees >= 360.0) {
      return new oc.BRepPrimAPI_MakeRevol_2(shape,
        new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0),
          new oc.gp_Dir_4(axis[0], axis[1], axis[2])),
        copy).Shape();
    } else {
      return new oc.BRepPrimAPI_MakeRevol_1(shape,
        new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0),
          new oc.gp_Dir_4(axis[0], axis[1], axis[2])),
        degrees * 0.0174533, copy).Shape();
    }
  });
  
  if (!keepShape) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(curRevolution);
  return curRevolution;
}

/** Extrudes and twists a flat *wire* upwards along the z-axis (see the optional argument for Polygon).
 * The original wire is removed unless `keepWire` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let twistyTriangle = RotatedExtrude(Polygon([[-25, -15, 0], [25, -15, 0], [0, 35, 0]], true), 50, 90);```*/
function RotatedExtrude(wire: oc.TopoDS_Shape, height: number, rotation: number, keepWire?: boolean) : oc.TopoDS_Shape{
  if (!wire || wire.IsNull()) { console.error("RotatedExtrude received Null Wire!"); }
  let curExtrusion = CacheOp(arguments, () => {
    let upperPolygon = Rotate([0, 0, 1], rotation, Translate([0, 0, height], wire, true));
    sceneShapes = Remove(sceneShapes, upperPolygon);

    // Define the straight spine going up the middle of the sweep
    let spineWire = BSpline([
      [0, 0, 0],
      [0, 0, height]], false);
    sceneShapes = Remove(sceneShapes, spineWire); // Don't render these

    // Define the guiding helical auxiliary spine (which controls the rotation)
    let steps = 30;
    let aspinePoints = [];
    for (let i = 0; i <= steps; i++) {
      let alpha = i / steps;
      aspinePoints.push([
        20 * Math.sin(alpha * rotation * 0.0174533),
        20 * Math.cos(alpha * rotation * 0.0174533),
        height * alpha]);
    }

    let aspineWire = BSpline(aspinePoints, false);
    sceneShapes = Remove(sceneShapes, aspineWire); // Don't render these

    // Sweep the face wires along the spine to create the extrusion
    let pipe = new oc.BRepOffsetAPI_MakePipeShell(spineWire);
    pipe.SetMode_5(aspineWire, true, oc.BRepFill_TypeOfContact.BRepFill_NoContact);
    pipe.Add_1(wire, false, false);
    pipe.Add_1(upperPolygon, false, false);
    pipe.Build();
    pipe.MakeSolid();
    return new oc.BRepBuilderAPI_Copy_2(pipe.Shape(), true, false).Shape();
  });
  if (!keepWire) { sceneShapes = Remove(sceneShapes, wire); }
  sceneShapes.push(curExtrusion);
  return curExtrusion;
}

/** Lofts a solid through the sections defined by an array of 2 or more closed wires.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js) */
 function Loft(wireSections: oc.TopoDS_Wire[], keepWires?: boolean): oc.TopoDS_Shape {
  let curLoft = CacheOp(arguments, () => {
    let pipe = new oc.BRepOffsetAPI_ThruSections(true, false, 1.0e-06);

    // Construct a Loft that passes through the wires
    wireSections.forEach((wire) => { pipe.AddWire(oc.TopoDS.Wire_1(wire)); });

    pipe.Build();
    return new oc.BRepBuilderAPI_Copy_2(pipe.Shape(), true, false).Shape();
  });

  wireSections.forEach((wire) => {
    if (!keepWires) { sceneShapes = Remove(sceneShapes, wire); }
  });
  sceneShapes.push(curLoft);
  return curLoft;
}

/** Sweeps this shape along a path wire.
 * The original shapes are removed unless `keepObjects` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js) 
 * @example```let pipe = Pipe(Circle(20), BSpline([[0,0,0],[0,0,50],[20,0,100]], false, true));```*/
function Pipe(shape: oc.TopoDS_Shape, wirePath: oc.TopoDS_Shape, keepInputs?: boolean): oc.TopoDS_Shape {
  let curPipe = CacheOp(arguments, () => {
    let pipe = new oc.BRepOffsetAPI_MakePipe_1(wirePath, shape);
    pipe.Build();
    return new oc.BRepBuilderAPI_Copy_2(pipe.Shape(), true, false).Shape();
  });
  
  if (!keepInputs) {
    sceneShapes = Remove(sceneShapes, shape);
    sceneShapes = Remove(sceneShapes, wirePath);
  }
  sceneShapes.push(curPipe);
  return curPipe;
}

/** Starts sketching a 2D shape which can contain lines, arcs, bezier splines, and fillets.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let sketch = new Sketch([0,0]).LineTo([100,0]).Fillet(20).LineTo([100,100]).End(true).Face();```*/
class Sketch {
  currentIndex: number;
  faces       : oc.TopoDS_Face[];
  wires       : oc.TopoDS_Wire[];
  firstPoint  : oc.gp_Pnt;
  lastPoint   : oc.gp_Pnt;
  wireBuilder : oc.BRepBuilderAPI_MakeWire;
  fillets     : { x: number, y: number, radius: number }[];
  argsString  : string
  /** This starts a new wire in the sketch.  This wire will be added to 
   * the existing wires when when building the face.  If it has an opposite
   *  winding order, this wire will subtract from the existing face. */
  constructor(startingPoint: number[]) {
    this.currentIndex = 0;
    this.faces        = [];
    this.wires        = [];
    this.firstPoint   = new oc.gp_Pnt_3(startingPoint[0], startingPoint[1], 0);
    this.lastPoint    = this.firstPoint;
    this.wireBuilder  = new oc.BRepBuilderAPI_MakeWire_1();
    this.fillets      = [];
    this.argsString   = ComputeHash(arguments, true);
  }

  /** This starts a new wire in the sketch.  This wire will be added to 
   * the existing when when building the face.  If it has an opposite
   *  winding order, this wire will subtract from the existing face. */
  Start = function (startingPoint: number[]) : Sketch {
    this.firstPoint  = new oc.gp_Pnt_3(startingPoint[0], startingPoint[1], 0);
    this.lastPoint   = this.firstPoint;
    this.wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
    this.argsString += ComputeHash(arguments, true);
    return this;
  }

  /** This ends the current wire in the sketch.  If this is the 
   * second closed wire, it will try to subtract its area from 
   * the first closed wire's face if its winding order is reversed
   * relative to the first one. */
  End = function (closed?: boolean, reversed?:boolean) : Sketch {
    this.argsString += ComputeHash(arguments, true);

    if (closed &&
       (this.firstPoint.X() !== this.lastPoint.X() ||
        this.firstPoint.Y() !== this.lastPoint.Y())) {
      this.LineTo(this.firstPoint);
    }

    let wire = this.wireBuilder.Wire();
    if (reversed) { wire = wire.Reversed(); }
    wire.hash = stringToHash(this.argsString);
    this.wires.push(wire);

    let faceBuilder = null;
    if (this.faces.length > 0) {
      faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(this.wires[0], false);
      for (let w = 1; w < this.wires.length; w++){
        faceBuilder.Add(this.wires[w]);
      }
    } else {
      faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    }

    let face = faceBuilder.Face();
    face.hash = stringToHash(this.argsString);
    this.faces.push(face);
    return this;
  }

  /** This Extracts the primary wire of the resultant face. */
  Wire = function (reversed?:boolean) : oc.TopoDS_Wire {
    this.argsString += ComputeHash(arguments, true);
    //let wire = this.wires[this.wires.length - 1];
    this.applyFillets();
    this.faces[this.faces.length - 1].hash = stringToHash(this.argsString);
    let wire = GetWire(this.faces[this.faces.length - 1]);
    if (reversed) { wire = wire.Reversed(); }
    sceneShapes.push(wire);
    return wire;
  }
  /** This extracts the face accumulated from all of the wires specified so far. */
  Face = function (reversed?:boolean) : oc.TopoDS_Face {
    this.argsString += ComputeHash(arguments, true);
    this.applyFillets();
    let face = this.faces[this.faces.length - 1];
    if (reversed) { face = face.Reversed(); }
    face.hash = stringToHash(this.argsString);
    sceneShapes.push(face);
    return face;
  }

  /** INTERNAL: This applies the fillets to the wire in-progress. */
  applyFillets = function () : void {
    // Add Fillets if Necessary
    if (this.fillets.length > 0) {
      let successes = 0; let swapFillets = [];
      for (let f = 0; f < this.fillets.length; f++) { this.fillets[f].disabled = false; }

      // Create Fillet Maker 2D
      let makeFillet = new oc.BRepFilletAPI_MakeFillet2d_2(this.faces[this.faces.length - 1]);
      // TopExp over the vertices
      ForEachVertex(this.faces[this.faces.length - 1], (vertex) => {
        // Check if the X and Y coords of any vertices match our chosen fillet vertex
        let pnt = oc.BRep_Tool.Pnt(vertex);
        for (let f = 0; f < this.fillets.length; f++) {
          if (!this.fillets[f].disabled &&
              pnt.X() === this.fillets[f].x &&
              pnt.Y() === this.fillets[f].y ) {
            // If so: Add a Radius there!
            makeFillet.AddFillet(vertex, this.fillets[f].radius);
            this.fillets[f].disabled = true; successes++;
            break;
          }
        }
      });
      if (successes > 0) { this.faces[this.faces.length - 1] = makeFillet.Shape(); }
        else { console.log("Couldn't find any of the vertices to fillet!!"); }
      this.fillets.concat(swapFillets);
    }
  }

  /** Adds a wire to the face-in-progress. */
  AddWire = function (wire: oc.TopoDS_Wire) : Sketch {
    this.argsString += ComputeHash(arguments, true);
    // This adds another wire (or edge??) to the currently constructing shape...
    this.wireBuilder.Add_2(wire);
    //if (endPoint) { this.lastPoint = endPoint; } // Yike what to do here...?
    return this;
  }

  /** Connects from the last point in the sketch to the specified next point with a straight line. */
  LineTo = function (nextPoint : number[]) : Sketch {
    this.argsString += ComputeHash(arguments, true);
    let endPoint = null;
    if (nextPoint.X) {
      if (this.lastPoint.X() === nextPoint.X() &&
          this.lastPoint.Y() === nextPoint.Y()) { return this; }
      endPoint = nextPoint;
    } else {
      if (this.lastPoint.X() === nextPoint[0] &&
          this.lastPoint.Y() === nextPoint[1]) { return this; }
      endPoint = new oc.gp_Pnt_3(nextPoint[0], nextPoint[1], 0);
    }

    let lineSegment      = new oc.GC_MakeSegment_1(this.lastPoint, endPoint).Value().get();
    let lineEdge         = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(lineSegment)).Edge();
    this.wireBuilder.Add_2(new oc.BRepBuilderAPI_MakeWire_2(lineEdge       ).Wire ());
    this.lastPoint       = endPoint;
    this.currentIndex++;
    return this;
  }

  /** Constructs an arc from the last point in the sketch through a point on the arc to end at arcEnd */
  ArcTo = function (pointOnArc : number[], arcEnd : number[]) : Sketch {
    this.argsString += ComputeHash(arguments, true);
    let onArc            = new oc.gp_Pnt_3(pointOnArc[0], pointOnArc[1], 0);
    let nextPoint        = new oc.gp_Pnt_3(    arcEnd[0],     arcEnd[1], 0);
    let arcCurve         = new oc.GC_MakeArcOfCircle(this.lastPoint, onArc, nextPoint).Value().get();
    let arcEdge          = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(arcCurve    )).Edge();
    this.wireBuilder.Add_2(new oc.BRepBuilderAPI_MakeWire_2(arcEdge).Wire());
    this.lastPoint       = nextPoint;
    this.currentIndex++;
    return this;
  }

  /** Constructs an order-N Bezier Curve where the first N-1 points are control points
    * and the last point is the endpoint of the curve */
  BezierTo = function (bezierControlPoints : number[][]) : Sketch {
    this.argsString += ComputeHash(arguments, true);
    let ptList = new oc.TColgp_Array1OfPnt_2(1, bezierControlPoints.length+1);
    ptList.SetValue(1, this.lastPoint);
    for (let bInd = 0; bInd < bezierControlPoints.length; bInd++){
      let ctrlPoint = convertToPnt(bezierControlPoints[bInd]);
      ptList.SetValue(bInd + 2, ctrlPoint);
      this.lastPoint = ctrlPoint;
    }
    let cubicCurve       = new oc.Geom_BezierCurve(ptList);
    let handle           = new oc.Handle_Geom_BezierCurve(cubicCurve).get();
    let lineEdge         = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(handle      )).Edge();
    this.wireBuilder.Add_2(new oc.BRepBuilderAPI_MakeWire_2(lineEdge  ).Wire());
    this.currentIndex++;
    return this;
  }

  /* Constructs a BSpline from the previous point through this set of points */
  BSplineTo = function (bsplinePoints : number[][]): Sketch{
    this.argsString += ComputeHash(arguments, true);
    let ptList = new oc.TColgp_Array1OfPnt_2(1, bsplinePoints.length+1);
    ptList.SetValue(1, this.lastPoint);
    for (let bInd = 0; bInd < bsplinePoints.length; bInd++){
      let ctrlPoint = convertToPnt(bsplinePoints[bInd]);
      ptList.SetValue(bInd + 2, ctrlPoint);
      this.lastPoint = ctrlPoint;
    }
    let handle           = new oc.GeomAPI_PointsToBSpline_2(ptList, 3, 8, oc.GeomAbs_Shape.GeomAbs_C2, 1.0e-3).Curve();
    let lineEdge         = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(handle.get())).Edge();
    this.wireBuilder.Add_2(new oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());
    this.currentIndex++;
    return this;
  }

  /** Rounds out this vertex with a specified radius */
  Fillet = function (radius: number) : Sketch {
    this.argsString += ComputeHash(arguments, true);
    this.fillets.push({ x: this.lastPoint.X(), y: this.lastPoint.Y(), radius: radius });
    return this;
  }

  /** Appends a circle to this face as a hole to punch out.  
   * Apply only after "End()" ing your other shapes and you 
   * may need to set "reversed" to true. */
  Circle = function (center:number[], radius:number, reversed?:boolean) : Sketch {
    this.argsString += ComputeHash(arguments, true);
    let circle = new oc.GC_MakeCircle_2(new oc.gp_Ax2_3(convertToPnt(center),
    new oc.gp_Dir_4(0, 0, 1)), radius).Value();
    let edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(circle.get())).Edge();
    let wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
    if (reversed) { wire = wire.Reversed(); }
    wire.hash = stringToHash(this.argsString);
    this.wires.push(wire);

    let faceBuilder = null;
    if (this.faces.length > 0) {
      faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(this.wires[0], false);
      for (let w = 1; w < this.wires.length; w++){
        faceBuilder.Add(this.wires[w]);
      }
    } else {
      faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    }
    let face = faceBuilder.Face();
    face.hash = stringToHash(this.argsString);
    this.faces.push(face);
    return this;
  }
}

/** Download this file URL through the browser.  Use this to export information from the CAD engine.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```SaveFile("myInfo.txt", URL.createObjectURL( new Blob(["Hello, Harddrive!"], { type: 'text/plain' }) ));``` */
 function SaveFile(filename: string, fileURL: string): void {
  postMessage({
    "type": "saveFile",
    payload: { filename: filename, fileURL: fileURL }
  }, null);
}

/** Creates a labeled slider with specified defaults, mins, and max ranges.
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40);```
 * `name` needs to be unique!
 * 
 * `callback` triggers whenever the mouse is let go, and `realTime` will cause the slider to update every frame that there is movement (but it's buggy!)
 * 
 * @param step controls the amount that the keyboard arrow keys will increment or decrement a value. Defaults to 1/100 (0.01).
 * @param precision controls how many decimal places the slider can have (i.e. "0" is integers, "1" includes tenths, etc.). Defaults to 2 decimal places (0.00).
 * 
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40, false);```
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40, false, 0.01);```
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40, false, 0.01, 2);```
 */
function Slider(name: string, defaultValue: number, min: number, max: number, realTime?: boolean, step?: number, precision?: number): number {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  if (!step) { step = 0.01; }
  if (typeof precision === "undefined") {
    precision = 2;
  } else if (precision % 1) { console.error("Slider precision must be an integer"); }
  
  GUIState[name + "Range"] = [min, max];
  postMessage({ "type": "addSlider", payload: { name: name, default: defaultValue, min: min, max: max, realTime: realTime, step: step, dp: precision } }, null);
  return GUIState[name];
}

/** Creates a button that will trigger `callback` when clicked.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```Button("Yell", ()=>{ console.log("Help!  I've been clicked!"); });```*/
function Button(name: string) : void {
  postMessage({ "type": "addButton", payload: { name: name } }, null);
}

/** Creates a checkbox that returns true or false.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let currentCheckboxValue = Checkbox("Check?", true);```
 * 
 * `callback` triggers when the button is clicked.*/
function Checkbox(name: string, defaultValue: boolean): boolean {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  postMessage({ "type": "addCheckbox", payload: { name: name, default: defaultValue } }, null);
  return GUIState[name];
}
