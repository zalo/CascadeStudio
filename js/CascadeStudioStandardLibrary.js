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

function Box(x, y, z, centered = false) {
  let curBox = CacheOp(arguments, () => {
    // Construct a Box Primitive
    let box = new oc.BRepPrimAPI_MakeBox(x, y, z).Shape();
    if (centered) { Translate([-x / 2, -y / 2, -z / 2], box); }
    return box;
  });

  sceneShapes.push(curBox);
  return curBox;
}

function Sphere(radius) {
  let curSphere = CacheOp(arguments, () => {
    // Construct a Sphere Primitive
    let spherePlane = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, 0), oc.gp.prototype.DZ());
    return new oc.BRepPrimAPI_MakeSphere(spherePlane, radius).Shape();
  });

  sceneShapes.push(curSphere);
  return curSphere;
}

function Cylinder(radius, height, centered) {
  let curCylinder = CacheOp(arguments, () => {
    let cylinderPlane = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, centered ? -height / 2 : 0), new oc.gp_Dir(0, 0, 1));
    return new oc.BRepPrimAPI_MakeCylinder(cylinderPlane, radius, height).Shape();
  });
  sceneShapes.push(curCylinder);
  return curCylinder;
}

function Cone(radius1, radius2, height) {
  let curCone = CacheOp(arguments, () => {
    return new oc.BRepPrimAPI_MakeCone(radius1, radius2, height).Shape();
  });
  sceneShapes.push(curCone);
  return curCone;
}

function Polygon(points, wire) {
  let curPolygon = CacheOp(arguments, () => {
    let gpPoints = [];
    for (let ind = 0; ind < points.length; ind++) {
      gpPoints.push(convertToPnt(points[ind]));
    }

    let polygonWire = new oc.BRepBuilderAPI_MakeWire();
    for (let ind = 0; ind < points.length - 1; ind++) {
      let seg = new oc.GC_MakeSegment(gpPoints[ind], gpPoints[ind + 1]).Value();
      let edge = new oc.BRepBuilderAPI_MakeEdge(seg).Edge();
      let innerWire = new oc.BRepBuilderAPI_MakeWire(edge).Wire();
      polygonWire.Add(innerWire);
    }
    let seg2 = new oc.GC_MakeSegment(gpPoints[points.length - 1], gpPoints[0]).Value();
    let edge2 = new oc.BRepBuilderAPI_MakeEdge(seg2).Edge();
    let innerWire2 = new oc.BRepBuilderAPI_MakeWire(edge2).Wire();
    polygonWire.Add(innerWire2);
    let finalWire = polygonWire.Wire();

    if (wire) {
      return finalWire;
    } else {
      return new oc.BRepBuilderAPI_MakeFace(finalWire).Face();
    }
  });
  sceneShapes.push(curPolygon);
  return curPolygon;
}

function Circle(radius, wire) {
  let curCircle = CacheOp(arguments, () => {
    let circle = new oc.GC_MakeCircle(new oc.gp_Ax2(new oc.gp_Pnt(0, 0, 0),
      new oc.gp_Dir(0, 0, 1)), radius).Value();
    let edge = new oc.BRepBuilderAPI_MakeEdge(circle).Edge();
    let circleWire = new oc.BRepBuilderAPI_MakeWire(edge).Wire();
    if (wire) { return circleWire; }
    return new oc.BRepBuilderAPI_MakeFace(circleWire).Face();
  });
  sceneShapes.push(curCircle);
  return curCircle;
}

function BSpline(inPoints, closed, wire) {
  let curSpline = CacheOp(arguments, () => {
    let ptList = new oc.TColgp_Array1OfPnt(1, inPoints.length + (closed ? 1 : 0));
    for (let pIndex = 1; pIndex <= inPoints.length; pIndex++) {
      ptList.SetValue(pIndex, convertToPnt(inPoints[pIndex - 1]));
    }
    if (closed) { ptList.SetValue(inPoints.length + 1, ptList.Value(1)); }

    let geomCurveHandle = new oc.GeomAPI_PointsToBSpline(ptList).Curve();
    if (wire) {
      let edge = new oc.BRepBuilderAPI_MakeEdge(geomCurveHandle).Edge();
      return     new oc.BRepBuilderAPI_MakeWire(edge).Wire();
    } else {
      return geomCurveHandle;
    }
  });
  if (wire) { sceneShapes.push(curSpline) };
  return curSpline;
}

function Text3D(text, size, height, fontURL) {
  if (!size   ) { size    = 36; }
  if (!height ) { height  = 0.15; }
  if (!fontURL) { fontURL = curFontURL; }

  let curText = CacheOp(arguments, () => {
    if (fontURL !== curFontURL) {
      curFontURL = fontURL;
      let textArgs = arguments;
      opentype.load(curFontURL, (err, font) => {
        if (err) { console.log(err); }
        robotoFont = font;
        argCache[ComputeHash(textArgs)] = null; // Invalidate the cache!
        console.log("New Font Loaded!  Please re-evaluate your model to see changes...");
      });
    }

    if (robotoFont === undefined) { console.log("Font not loaded yet!  Try again..."); return; }
    let textFaces = [];
    let commands = robotoFont.getPath(text, 0, 0, size).commands;
    for (let idx = 0; idx < commands.length; idx++) {
      if (commands[idx].type === "M") {
        // Start a new Glyph
        var firstPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
        var lastPoint = firstPoint;
        var currentWire = new oc.BRepBuilderAPI_MakeWire();
      } else if (commands[idx].type === "Z") {
        // End the current Glyph and Finish the Path

        let faceBuilder = null;
        if (textFaces.length > 0) {
          faceBuilder = new oc.BRepBuilderAPI_MakeFace(
            textFaces[textFaces.length - 1], currentWire.Wire());
        } else {
          faceBuilder = new oc.BRepBuilderAPI_MakeFace(currentWire.Wire());
        }

        textFaces.push(faceBuilder.Face());
      } else if (commands[idx].type === "L") {
        let nextPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
        if (lastPoint.X() === nextPoint.X() && lastPoint.Y() === nextPoint.Y()) { continue; }
        let lineSegment = new oc.GC_MakeSegment(lastPoint, nextPoint).Value();
        let lineEdge = new oc.BRepBuilderAPI_MakeEdge(lineSegment).Edge();
        currentWire.Add(new oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());
        lastPoint = nextPoint;
      } else if (commands[idx].type === "Q") {
        let controlPoint = new oc.gp_Pnt(commands[idx].x1, commands[idx].y1, 0);
        let nextPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);

        let ptList = new oc.TColgp_Array1OfPnt(1, 3);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint);
        ptList.SetValue(3, nextPoint);
        let quadraticCurve = new oc.Geom_BezierCurve(ptList);
        let lineEdge = new oc.BRepBuilderAPI_MakeEdge(new oc.Handle_Geom_BezierCurve(quadraticCurve)).Edge();
        currentWire.Add(new oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());

        lastPoint = nextPoint;
      } else if (commands[idx].type === "C") {
        let controlPoint1 = new oc.gp_Pnt(commands[idx].x1, commands[idx].y1, 0);
        let controlPoint2 = new oc.gp_Pnt(commands[idx].x2, commands[idx].y2, 0);
        let nextPoint = new oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);

        let ptList = new oc.TColgp_Array1OfPnt(1, 4);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint1);
        ptList.SetValue(3, controlPoint2);
        ptList.SetValue(4, nextPoint);
        let cubicCurve = new oc.Geom_BezierCurve(ptList);
        let lineEdge = new oc.BRepBuilderAPI_MakeEdge(new oc.Handle_Geom_BezierCurve(cubicCurve)).Edge();
        currentWire.Add(new oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());
          
        lastPoint = nextPoint;
      }
    }

    if (height === 0) {
      return textFaces[textFaces.length - 1];
    } else {
      textFaces[textFaces.length - 1].text = text; // Invalidate the text cache for the Extrude Call!
      return Rotate([1, 0, 0], -90, Extrude(textFaces[textFaces.length - 1], [0, 0, height * size]));
    }
  });

  if(height === 0) { sceneShapes.push(curText); }
  return curText;
}

// These foreach functions are not cache friendly right now!
function ForEachShell(shape, callback) {
  let shell_index = 0;
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_SHELL);
  for (anExplorer.Init(shape, oc.TopAbs_SHELL); anExplorer.More(); anExplorer.Next()) {
    callback(shell_index++, oc.TopoDS.prototype.Shell(anExplorer.Current()));
  }
}

function ForEachFace(shape, callback) {
  let face_index = 0;
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_FACE);
  for (anExplorer.Init(shape, oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
    callback(face_index++, oc.TopoDS.prototype.Face(anExplorer.Current()));
  }
}

function ForEachWire(shape, callback) {
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_WIRE);
  for (anExplorer.Init(shape, oc.TopAbs_WIRE); anExplorer.More(); anExplorer.Next()) {
    callback(oc.TopoDS.prototype.Wire(anExplorer.Current()));
  }
}

function ForEachEdge(shape, callback) {
  let edgeHashes = {};
  let edgeIndex = 0;
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_EDGE);
  for (anExplorer.Init(shape, oc.TopAbs_EDGE); anExplorer.More(); anExplorer.Next()) {
    let edge = oc.TopoDS.prototype.Edge(anExplorer.Current());
    let edgeHash = edge.HashCode(100000000);
    if(!edgeHashes.hasOwnProperty(edgeHash)){
      edgeHashes[edgeHash] = edgeIndex;
      callback(edgeIndex++, edge);
    }
  }
  return edgeHashes;
}

function ForEachVertex(shape, callback) {
  let anExplorer = new oc.TopExp_Explorer(shape, oc.TopAbs_VERTEX);
  for (anExplorer.Init(shape, oc.TopAbs_VERTEX); anExplorer.More(); anExplorer.Next()) {
    callback(oc.TopoDS.prototype.Vertex(anExplorer.Current()));
  }
}

function FilletEdges(shape, radius, edgeList, keepOriginal = false) { 
  let curFillet = CacheOp(arguments, () => {
    let mkFillet = new oc.BRepFilletAPI_MakeFillet(shape);
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkFillet.Add(radius, edge); }
    });
    return new oc.TopoDS_Solid(mkFillet.Shape());
  });
  sceneShapes.push(curFillet);
  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shape); }
  return curFillet;
}

function ChamferEdges(shape, distance, edgeList, keepOriginal = false) { 
  let curChamfer = CacheOp(arguments, () => {
    let mkChamfer = new oc.BRepFilletAPI_MakeChamfer(shape);
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkChamfer.Add(distance, edge); }
    });
    return new oc.TopoDS_Solid(mkChamfer.Shape());
  });
  sceneShapes.push(curChamfer);
  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shape); }
  return curChamfer;
}

function Transform(translation, rotation, scale, shapes) {
  let args = arguments;
  return CacheOp(arguments, () => {
    if (args.length == 4) {
      // Create the transform gizmo and add it to the scene
      threejsViewport.createTransformHandle(translation, rotation, scale, getCallingLocation());
      // Transform the Object(s)
      return Translate(translation, Rotate(rotation[0], rotation[1], Scale(scale, shapes)));
    } else {
      // Create the transform gizmo and add it to the scene
      threejsViewport.createTransformHandle([0, 0, 0], [[0, 1, 0], 1], 1, getCallingLocation());
      return translation; // The first element will be the shapes
    }
  });
}

function Translate(offset, shapes, keepOriginal) {
  let translated = CacheOp(arguments, () => {
    let transformation = new oc.gp_Trsf();
    transformation.SetTranslation(new oc.gp_Vec(offset[0], offset[1], offset[2]));
    let translation = new oc.TopLoc_Location(transformation);
    if (!isArrayLike(shapes)) {
      return new oc.TopoDS_Shape(shapes.Moved(translation));
    } else if (shapes.length >= 1) {      // Do the normal rotation
      let newTrans = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newTrans.push(new oc.TopoDS_Shape(shapes[shapeIndex].Moved(translation)));
      }
      return newTrans;
    }
  });

  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shapes); }
  sceneShapes.push(translated);

  return translated;
}

function Rotate(axis, degrees, shapes, keepOriginal) {
  if (degrees === 0) { return shapes; }
  let rotated = CacheOp(arguments, () => {
    let newRot;
    let transformation = new oc.gp_Trsf();
    transformation.SetRotation(
      new oc.gp_Ax1(new oc.gp_Pnt(0, 0, 0), new oc.gp_Dir(
        new oc.gp_Vec(axis[0], axis[1], axis[2]))), degrees * 0.0174533);
    let rotation = new oc.TopLoc_Location(transformation);
    if (!isArrayLike(shapes)) {
      newRot = new oc.TopoDS_Shape(shapes.Moved(rotation));
    } else if (shapes.length >= 1) {      // Do the normal rotation
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        shapes[shapeIndex].Move(rotation);
      }
    }
    return newRot;
  });
  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shapes); }
  sceneShapes.push(rotated);
  return rotated;
}

function Scale(scale, shapes, keepOriginal) {
  let scaled = CacheOp(arguments, () => {
    let transformation = new oc.gp_Trsf();
    transformation.SetScaleFactor(scale);
    let scaling = new oc.TopLoc_Location(transformation);
    if (!isArrayLike(shapes)) {
      return new oc.TopoDS_Shape(shapes.Moved(scaling));
    } else if (shapes.length >= 1) {      // Do the normal rotation
      let newScale = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newScale.push(new oc.TopoDS_Shape(shapes[shapeIndex].Moved(scaling)));
      }
      return newScale;
    }
  });

  if (!keepOriginal) { sceneShapes = Remove(sceneShapes, shapes); }
  sceneShapes.push(scaled);

  return scaled;
}

// TODO: These ops can be more cache optimized since they're multiple sequential ops
function Union(objectsToJoin, keepObjects) {
  let curUnion = CacheOp(arguments, () => {
    let combined = new oc.TopoDS_Shape(objectsToJoin[0]);
    if (objectsToJoin.length > 1) {
      for (let i = 0; i < objectsToJoin.length; i++) {
        if (i > 0) { combined = new oc.BRepAlgoAPI_Fuse(combined, objectsToJoin[i]).Shape(); }
      }
    }
    return combined;
  });

  for (let i = 0; i < objectsToJoin.length; i++) {
    if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToJoin[i]); }
  }
  sceneShapes.push(curUnion);
  return curUnion;
}

function Difference(mainBody, objectsToSubtract, keepObjects) {
  let curDifference = CacheOp(arguments, () => {
    let difference = new oc.TopoDS_Shape(mainBody);
    if (objectsToSubtract.length >= 1) {
      for (let i = 0; i < objectsToSubtract.length; i++) {
        difference = new oc.BRepAlgoAPI_Cut(difference, objectsToSubtract[i]).Shape();
      }
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

function Intersection(objectsToIntersect, keepObjects) {
  let curIntersection = CacheOp(arguments, () => {
    let intersected = new oc.TopoDS_Shape(objectsToIntersect[0]);
    if (objectsToIntersect.length > 1) {
      for (let i = 0; i < objectsToIntersect.length; i++) {
        if (i > 0) { intersected = new oc.BRepAlgoAPI_Common(intersected, objectsToIntersect[i]).Shape(); }
      }
    }
    return intersected;
  });

  for (let i = 0; i < objectsToIntersect.length; i++) {
    if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToIntersect[i]); }
  }
  sceneShapes.push(curIntersection);
  return curIntersection;
}

function Extrude(face, direction, keepFace) {
  let curExtrusion = CacheOp(arguments, () => {
    return new oc.BRepPrimAPI_MakePrism(face,
      new oc.gp_Vec(direction[0], direction[1], direction[2])).Shape();
  });
  
  if (!keepFace) { sceneShapes = Remove(sceneShapes, face); }
  sceneShapes.push(curExtrusion);
  return curExtrusion;
}

function Offset(shape, offsetDistance, tolerance, keepShape) {
  if (!tolerance) { tolerance = 0.1; }
  if (offsetDistance === 0.0) { return shape; }
  let curOffset = CacheOp(arguments, () => {
    let offset = new oc.BRepOffsetAPI_MakeOffsetShape();
    offset.PerformByJoin(shape, offsetDistance, tolerance);
    return offset.Shape();
  });
  
  if (!keepShape) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(curOffset);
  return curOffset;
}

function Revolve(shape, degrees = 360.0, direction = [0, 0, 1], keepShape = false, copy = false) {
  let curRevolution = CacheOp(arguments, () => {
    if (degrees >= 360.0) {
      return new oc.BRepPrimAPI_MakeRevol(shape,
        new oc.gp_Ax1(new oc.gp_Pnt(0, 0, 0),
          new oc.gp_Dir(direction[0], direction[1], direction[2])),
        copy).Shape();
    } else {
      return new oc.BRepPrimAPI_MakeRevol(shape,
        new oc.gp_Ax1(new oc.gp_Pnt(0, 0, 0),
          new oc.gp_Dir(direction[0], direction[1], direction[2])),
        degrees * 0.0174533, copy).Shape();
    }
  });
  
  if (!keepShape) { sceneShapes = Remove(sceneShapes, shape); }
  sceneShapes.push(curRevolution);
  return curRevolution;
}

function RotatedExtrude(wire, height, rotation, keepWire = false) {
  let curExtrusion = CacheOp(arguments, () => {
    let upperPolygon = Rotate([0, 0, 1], rotation, Translate([0, 0, height], wire, true));
    sceneShapes = Remove(sceneShapes, upperPolygon);

    // Define the straight spine going up the middle of the sweep
    let spine = BSpline([
      [0, 0, 0],
      [0, 0, height]], false);
    let spineEdge = new oc.BRepBuilderAPI_MakeEdge(spine).Edge();
    let spineWire = new oc.BRepBuilderAPI_MakeWire(spineEdge).Wire();
    //sceneShapes.push(spineEdge);

    // Define the guiding helical auxiliary spine (which controls the rotation)
    let steps = 100;
    let aspinePoints = [];
    for (let i = 0; i <= steps; i++) {
      let alpha = i / steps;
      aspinePoints.push([
        20 * Math.sin(alpha * rotation * 0.0174533),
        20 * Math.cos(alpha * rotation * 0.0174533),
        height * alpha]);
    }

    let aspine = BSpline(aspinePoints, false);
    let aspineEdge = new oc.BRepBuilderAPI_MakeEdge(aspine).Edge();
    let aspineWire = new oc.BRepBuilderAPI_MakeWire(aspineEdge).Wire();
    //sceneShapes.push(aspineEdge);

    // Sweep the face wires along the spine to create the extrusion
    let pipe = new oc.BRepOffsetAPI_MakePipeShell(spineWire);
    pipe.SetMode(aspineWire, true);
    pipe.Add(wire);
    pipe.Add(upperPolygon);
    pipe.Build();
    pipe.MakeSolid();
    return new oc.TopoDS_Solid(pipe.Shape());
  });
  if (!keepWire) { sceneShapes = Remove(sceneShapes, wire); }
  sceneShapes.push(curExtrusion);
  return curExtrusion;
}

function Loft(wires, keepWires = false) {
  let curLoft = CacheOp(arguments, () => {
    let pipe = new oc.BRepOffsetAPI_ThruSections(true);

    // Construct a Loft that passes through the wires
    wires.forEach((wire) => {
      pipe.AddWire(wire);
      if (!keepWires) { sceneShapes = Remove(sceneShapes, wire); }
    });

    pipe.Build();
    return new oc.TopoDS_Solid(pipe.Shape());
  });

  sceneShapes.push(curLoft);
  return curLoft;
}

function Pipe(shape, wirePath, keepInputs = false) {
  let curPipe = CacheOp(arguments, () => {
    let pipe = new oc.BRepOffsetAPI_MakePipe(wirePath, shape);
    pipe.Build();
    return new oc.TopoDS_Solid(pipe.Shape());
  });
  
  if (!keepInputs) {
    sceneShapes = Remove(sceneShapes, shape);
    sceneShapes = Remove(sceneShapes, wirePath);
  }
  sceneShapes.push(curPipe);
  return curPipe;
}

function Slider(name = "Val", defaultValue = 0.5, min = 0.0, max = 1.0, realTime=false) {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  GUIState[name + "Range"] = [min, max];
  postMessage({ "type": "addSlider", payload: { name: name, default: defaultValue, min: min, max: max, realTime: realTime } });
  return GUIState[name];
}

function Button(name = "Action") {
  postMessage({ "type": "addButton", payload: { name: name } });
}

function Checkbox(name = "Toggle", defaultValue = false) {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  postMessage({ "type": "addButton", payload: { name: name, default: defaultValue } });
  return GUIState[name];
}

// Caching functions to speed up evaluation of slow redundant operations
var argCache = {};
function CacheOp(args, cacheMiss) {
  let check = CheckCache(args);
  if (check) {
    //console.log("HIT    "+ ComputeHash(args) +  ", " +ComputeHash(args, true));
    let copy = new oc.TopoDS_Shape(check);
    copy.hash = check.hash;
    return copy;
  } else {
    //console.log("MISSED " + ComputeHash(args) + ", " + ComputeHash(args, true));
    let curHash = ComputeHash(args);
    let miss = cacheMiss();
    AddToCache(curHash, miss);
    return miss;
  }
}
function CheckCache(args) { return argCache[ComputeHash(args)] || null; }
function AddToCache(hash, shape) {
  shape.hash = hash; // This is the sceneShapes version of the object
  shape      = new oc.TopoDS_Shape(shape);
  shape.hash = hash; // This is the cached version of the object
  argCache[hash] = shape;
  return hash;
}

function ComputeHash(args, raw) {
  let argsString = JSON.stringify(args);
  argsString = argsString.replace(/(\"ptr\"\:(-?[0-9]*?)\,)/g, '');
  argsString = argsString.replace(/(\"ptr\"\:(-?[0-9]*))/g, '');
  if (argsString.includes("ptr")) { console.error("YOU DONE MESSED UP YOUR REGEX."); }
  let hashString = args.callee.name + argsString;// + GUIState["MeshRes"];
  if (raw) { return hashString; }
  return stringToHash(hashString);
}

// Random Javascript Utilities
function recursiveTraverse(x, callback) {
  if (Object.prototype.toString.call(x) === '[object Array]') {
    x.forEach(function (x1) {
      recursiveTraverse(x1, callback)
    });
  } else if ((typeof x === 'object') && (x !== null)) {
    if (x.HashCode) {
      callback(x);
    } else {
      for (let key in x) {
        if (x.hasOwnProperty(key)) {
          recursiveTraverse(x[key], callback)
        }
      }
    }
  } else {
    callback(x);
  }
}

function Remove(inputArray, objectToRemove) {
  return inputArray.filter((el) => {
    return el.hash !== objectToRemove.hash ||
           el.ptr  !== objectToRemove.ptr;//el !== objectToRemove;
  });
}

function isArrayLike(item) {
  return (
      Array.isArray(item) || 
      (!!item &&
        typeof item === "object" &&
        item.hasOwnProperty("length") && 
        typeof item.length === "number" && 
        item.length > 0 && 
        (item.length - 1) in item
      )
  );
}

// Mega Brittle Line Number Finding algorithm for back propagation; only works in Chrome and FF
function getCallingLocation() {
  let errorStack = (new Error).stack;
  //console.log(errorStack);
  let lineAndColumn = [0, 0];
  if (navigator.userAgent.includes("Chrom")) {
    lineAndColumn = errorStack.split("\n")[3].split(", <anonymous>:")[1].split(':');
  }else if (navigator.userAgent.includes("Moz")) {
    lineAndColumn = errorStack.split("\n")[2].split("eval:")[1].split(':');
  } else {
    lineAndColumn[0] = "-1";
    lineAndColumn[1] = "-1";
  }
  lineAndColumn[0] = parseFloat(lineAndColumn[0]);
  lineAndColumn[1] = parseFloat(lineAndColumn[1]);

  return lineAndColumn;
}

function convertToPnt(pnt) {
  let point = pnt; // Accept raw gp_Points if we got 'em
  if (point.length) {
    point = new oc.gp_Pnt(point[0], point[1], point[2]);
  }
  return point;
}

// Convert to 32bit integer 
function stringToHash(string) { 
    var hash = 0; 
    if (string.length == 0) return hash; 
    for (i = 0; i < string.length; i++) { 
        char = string.charCodeAt(i); 
        hash = ((hash << 5) - hash) + char; 
        hash = hash & hash; 
    } 
    return hash; 
}

function CantorPairing(x, y) {
  return ((x + y) * (x + y + 1)) / 2 + y;
}
