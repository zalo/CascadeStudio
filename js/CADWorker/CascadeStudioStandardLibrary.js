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

import { CascadeStudioUtils } from './CascadeStudioStandardUtils.js';

// --- CAD API Functions ---
// These are regular function declarations (NOT class methods) to preserve
// `arguments.callee` access needed by CacheOp for hashing and progress tracking.

function Box(x, y, z, centered) {
  if (!centered) { centered = false;}
  let curBox = self.CacheOp(arguments, "Box", () => {
    let box = new self.oc.BRepPrimAPI_MakeBox(x, y, z).Shape();
    if (centered) {
      return Translate([-x / 2, -y / 2, -z / 2], box);
    } else {
      return box;
    }
  });
  self.sceneShapes.push(curBox);
  return curBox;
}

function Sphere(radius) {
  let curSphere = self.CacheOp(arguments, "Sphere", () => {
    let spherePlane = new self.oc.gp_Ax2(new self.oc.gp_Pnt(0, 0, 0), self.oc.gp.prototype.DZ());
    return new self.oc.BRepPrimAPI_MakeSphere(spherePlane, radius).Shape();
  });
  self.sceneShapes.push(curSphere);
  return curSphere;
}

function Cylinder(radius, height, centered) {
  let curCylinder = self.CacheOp(arguments, "Cylinder", () => {
    let cylinderPlane = new self.oc.gp_Ax2(new self.oc.gp_Pnt(0, 0, centered ? -height / 2 : 0), new self.oc.gp_Dir(0, 0, 1));
    return new self.oc.BRepPrimAPI_MakeCylinder(cylinderPlane, radius, height).Shape();
  });
  self.sceneShapes.push(curCylinder);
  return curCylinder;
}

function Cone(radius1, radius2, height) {
  let curCone = self.CacheOp(arguments, "Cone", () => {
    return new self.oc.BRepPrimAPI_MakeCone(radius1, radius2, height).Shape();
  });
  self.sceneShapes.push(curCone);
  return curCone;
}

function Polygon(points, wire) {
  let curPolygon = self.CacheOp(arguments, "Polygon", () => {
    let gpPoints = [];
    for (let ind = 0; ind < points.length; ind++) {
      gpPoints.push(self.convertToPnt(points[ind]));
    }

    let polygonWire = new self.oc.BRepBuilderAPI_MakeWire();
    for (let ind = 0; ind < points.length - 1; ind++) {
      let seg = new self.oc.GC_MakeSegment(gpPoints[ind], gpPoints[ind + 1]).Value();
      let edge = new self.oc.BRepBuilderAPI_MakeEdge(seg).Edge();
      let innerWire = new self.oc.BRepBuilderAPI_MakeWire(edge).Wire();
      polygonWire.Add(innerWire);
    }
    let seg2 = new self.oc.GC_MakeSegment(gpPoints[points.length - 1], gpPoints[0]).Value();
    let edge2 = new self.oc.BRepBuilderAPI_MakeEdge(seg2).Edge();
    let innerWire2 = new self.oc.BRepBuilderAPI_MakeWire(edge2).Wire();
    polygonWire.Add(innerWire2);
    let finalWire = polygonWire.Wire();

    if (wire) {
      return finalWire;
    } else {
      return new self.oc.BRepBuilderAPI_MakeFace(finalWire).Face();
    }
  });
  self.sceneShapes.push(curPolygon);
  return curPolygon;
}

function Circle(radius, wire) {
  let curCircle = self.CacheOp(arguments, "Circle", () => {
    let circle = new self.oc.GC_MakeCircle(new self.oc.gp_Ax2(new self.oc.gp_Pnt(0, 0, 0),
      new self.oc.gp_Dir(0, 0, 1)), radius).Value();
    let edge = new self.oc.BRepBuilderAPI_MakeEdge(circle).Edge();
    let circleWire = new self.oc.BRepBuilderAPI_MakeWire(edge).Wire();
    if (wire) { return circleWire; }
    return new self.oc.BRepBuilderAPI_MakeFace(circleWire).Face();
  });
  self.sceneShapes.push(curCircle);
  return curCircle;
}

function BSpline(inPoints, closed) {
  let curSpline = self.CacheOp(arguments, "BSpline", () => {
    let ptList = new self.oc.TColgp_Array1OfPnt(1, inPoints.length + (closed ? 1 : 0));
    for (let pIndex = 1; pIndex <= inPoints.length; pIndex++) {
      ptList.SetValue(pIndex, self.convertToPnt(inPoints[pIndex - 1]));
    }
    if (closed) { ptList.SetValue(inPoints.length + 1, ptList.Value(1)); }

    let geomCurveHandle = new self.oc.GeomAPI_PointsToBSpline(ptList).Curve();
    let edge = new self.oc.BRepBuilderAPI_MakeEdge(geomCurveHandle).Edge();
    return     new self.oc.BRepBuilderAPI_MakeWire(edge).Wire();
  });
  self.sceneShapes.push(curSpline);
  return curSpline;
}

function Text3D(text, size, height, fontName) {
  if (!size   ) { size    = 36; }
  if (!height && height !== 0.0) { height  = 0.15; }
  if (!fontName) { fontName = "Roboto"; }

  let textArgs = JSON.stringify(arguments);
  let curText = self.CacheOp(arguments, "Text3D", () => {
    if (self.loadedFonts[fontName] === undefined) { self.argCache = {}; console.log("Font not loaded or found yet!  Try again..."); return; }
    let textFaces = [];
    let commands = self.loadedFonts[fontName].getPath(text, 0, 0, size).commands;
    for (let idx = 0; idx < commands.length; idx++) {
      if (commands[idx].type === "M") {
        var firstPoint = new self.oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
        var lastPoint = firstPoint;
        var currentWire = new self.oc.BRepBuilderAPI_MakeWire();
      } else if (commands[idx].type === "Z") {
        try {
          let faceBuilder = null;
          if (textFaces.length > 0) {
            faceBuilder = new self.oc.BRepBuilderAPI_MakeFace(
              textFaces[textFaces.length - 1], currentWire.Wire());
          } else {
            faceBuilder = new self.oc.BRepBuilderAPI_MakeFace(currentWire.Wire());
          }
          textFaces.push(faceBuilder.Face());
        } catch (e) {
          console.error("ERROR: OCC encountered malformed characters when constructing faces from this font (likely self-intersections)!  Try using a more robust font like 'Roboto'.");
        }
      } else if (commands[idx].type === "L") {
        let nextPoint = new self.oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);
        if (lastPoint.X() === nextPoint.X() && lastPoint.Y() === nextPoint.Y()) { continue; }
        let lineSegment = new self.oc.GC_MakeSegment(lastPoint, nextPoint).Value();
        let lineEdge = new self.oc.BRepBuilderAPI_MakeEdge(lineSegment).Edge();
        currentWire.Add(new self.oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());
        lastPoint = nextPoint;
      } else if (commands[idx].type === "Q") {
        let controlPoint = new self.oc.gp_Pnt(commands[idx].x1, commands[idx].y1, 0);
        let nextPoint = new self.oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);

        let ptList = new self.oc.TColgp_Array1OfPnt(1, 3);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint);
        ptList.SetValue(3, nextPoint);
        let quadraticCurve = new self.oc.Geom_BezierCurve(ptList);
        let lineEdge = new self.oc.BRepBuilderAPI_MakeEdge(new self.oc.Handle_Geom_BezierCurve(quadraticCurve)).Edge();
        currentWire.Add(new self.oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());

        lastPoint = nextPoint;
      } else if (commands[idx].type === "C") {
        let controlPoint1 = new self.oc.gp_Pnt(commands[idx].x1, commands[idx].y1, 0);
        let controlPoint2 = new self.oc.gp_Pnt(commands[idx].x2, commands[idx].y2, 0);
        let nextPoint = new self.oc.gp_Pnt(commands[idx].x, commands[idx].y, 0);

        let ptList = new self.oc.TColgp_Array1OfPnt(1, 4);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint1);
        ptList.SetValue(3, controlPoint2);
        ptList.SetValue(4, nextPoint);
        let cubicCurve = new self.oc.Geom_BezierCurve(ptList);
        let lineEdge = new self.oc.BRepBuilderAPI_MakeEdge(new self.oc.Handle_Geom_BezierCurve(cubicCurve)).Edge();
        currentWire.Add(new self.oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());

        lastPoint = nextPoint;
      }
    }

    if (height === 0) {
      return textFaces[textFaces.length - 1];
    } else {
      textFaces[textFaces.length - 1].hash = self.stringToHash(textArgs);
      let textSolid = Rotate([1, 0, 0], -90, Extrude(textFaces[textFaces.length - 1], [0, 0, height * size]));
      self.sceneShapes = self.Remove(self.sceneShapes, textSolid);
      return textSolid;
    }
  });

  self.sceneShapes.push(curText);
  return curText;
}

// --- Shape Traversal Functions ---

function ForEachSolid(shape, callback) {
  let solid_index = 0;
  let anExplorer = new self.oc.TopExp_Explorer(shape, self.oc.TopAbs_SOLID);
  for (anExplorer.Init(shape, self.oc.TopAbs_SOLID); anExplorer.More(); anExplorer.Next()) {
    callback(solid_index++, self.oc.TopoDS.prototype.Solid(anExplorer.Current()));
  }
}
function GetNumSolidsInCompound(shape) {
  if (!shape || shape.ShapeType() > 1 || shape.IsNull()) { console.error("Not a compound shape!"); return shape; }
  let solidsFound = 0;
  ForEachSolid(shape, (i, s) => { solidsFound++; });
  return solidsFound;
}
function GetSolidFromCompound(shape, index, keepOriginal) {
  if (!shape || shape.ShapeType() > 1 || shape.IsNull()) { console.error("Not a compound shape!"); return shape; }
  if (!index) { index = 0;}

  let sol = self.CacheOp(arguments, "GetSolidFromCompound", () => {
    let innerSolid = {}; let solidsFound = 0;
    ForEachSolid(shape, (i, s) => {
      if (i === index) { innerSolid = new self.oc.TopoDS_Solid(s); } solidsFound++;
    });
    if (solidsFound === 0) { console.error("NO SOLIDS FOUND IN SHAPE!"); innerSolid = shape; }
    innerSolid.hash = shape.hash + 1;
    return innerSolid;
  });

  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(sol);

  return sol;
}

function ForEachShell(shape, callback) {
  let shell_index = 0;
  let anExplorer = new self.oc.TopExp_Explorer(shape, self.oc.TopAbs_SHELL);
  for (anExplorer.Init(shape, self.oc.TopAbs_SHELL); anExplorer.More(); anExplorer.Next()) {
    callback(shell_index++, self.oc.TopoDS.prototype.Shell(anExplorer.Current()));
  }
}

function ForEachFace(shape, callback) {
  let face_index = 0;
  let anExplorer = new self.oc.TopExp_Explorer(shape, self.oc.TopAbs_FACE);
  for (anExplorer.Init(shape, self.oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
    callback(face_index++, self.oc.TopoDS.prototype.Face(anExplorer.Current()));
  }
}

function ForEachWire(shape, callback) {
  let wire_index = 0;
  let anExplorer = new self.oc.TopExp_Explorer(shape, self.oc.TopAbs_WIRE);
  for (anExplorer.Init(shape, self.oc.TopAbs_WIRE); anExplorer.More(); anExplorer.Next()) {
    callback(wire_index++, self.oc.TopoDS.prototype.Wire(anExplorer.Current()));
  }
}
function GetWire(shape, index, keepOriginal) {
  if (!shape || shape.ShapeType() > 4 || shape.IsNull()) { console.error("Not a wire shape!"); return shape; }
  if (!index) { index = 0;}

  let wire = self.CacheOp(arguments, "GetWire", () => {
    let innerWire = {}; let wiresFound = 0;
    ForEachWire(shape, (i, s) => {
      if (i === index) { innerWire = new self.oc.TopoDS_Wire(s); } wiresFound++;
    });
    if (wiresFound === 0) { console.error("NO WIRES FOUND IN SHAPE!"); innerWire = shape; }
    innerWire.hash = shape.hash + 1;
    return innerWire;
  });

  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(wire);

  return wire;
}

function ForEachEdge(shape, callback) {
  let edgeHashes = {};
  let edgeIndex = 0;
  let anExplorer = new self.oc.TopExp_Explorer(shape, self.oc.TopAbs_EDGE);
  for (anExplorer.Init(shape, self.oc.TopAbs_EDGE); anExplorer.More(); anExplorer.Next()) {
    let edge = self.oc.TopoDS.prototype.Edge(anExplorer.Current());
    let edgeHash = edge.HashCode(100000000);
    if(!edgeHashes.hasOwnProperty(edgeHash)){
      edgeHashes[edgeHash] = edgeIndex;
      callback(edgeIndex++, edge);
    }
  }
  return edgeHashes;
}

function ForEachVertex(shape, callback) {
  let anExplorer = new self.oc.TopExp_Explorer(shape, self.oc.TopAbs_VERTEX);
  for (anExplorer.Init(shape, self.oc.TopAbs_VERTEX); anExplorer.More(); anExplorer.Next()) {
    callback(self.oc.TopoDS.prototype.Vertex(anExplorer.Current()));
  }
}

// --- Edge/Face Operations ---

function FilletEdges(shape, radius, edgeList, keepOriginal) {
  let curFillet = self.CacheOp(arguments, "FilletEdges", () => {
    let mkFillet = new self.oc.BRepFilletAPI_MakeFillet(shape);
    let foundEdges = 0;
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkFillet.Add(radius, edge); foundEdges++; }
    });
    if (foundEdges == 0) {
      console.error("Fillet Edges Not Found!  Make sure you are looking at the object _before_ the Fillet is applied!");
      return new self.oc.TopoDS_Solid(shape);
    }
    return new self.oc.TopoDS_Solid(mkFillet.Shape());
  });
  self.sceneShapes.push(curFillet);
  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  return curFillet;
}

function ChamferEdges(shape, distance, edgeList, keepOriginal) {
  let curChamfer = self.CacheOp(arguments, "ChamferEdges", () => {
    let mkChamfer = new self.oc.BRepFilletAPI_MakeChamfer(shape);
    let foundEdges = 0;
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkChamfer.Add(distance, edge); foundEdges++; }
    });
    if (foundEdges == 0) {
      console.error("Chamfer Edges Not Found!  Make sure you are looking at the object _before_ the Chamfer is applied!");
      return new self.oc.TopoDS_Solid(shape);
    }
    return new self.oc.TopoDS_Solid(mkChamfer.Shape());
  });
  self.sceneShapes.push(curChamfer);
  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  return curChamfer;
}

// --- Transform Operations ---

function Transform(translation, rotation, scale, shapes) {
  let args = arguments;
  return self.CacheOp(arguments, "Transform", () => {
    if (args.length == 4) {
      postMessage({ "type": "createTransformHandle", payload: { translation: translation, rotation: rotation, scale: scale, lineAndColumn: self.getCallingLocation() } });
      return Translate(translation, Rotate(rotation[0], rotation[1], Scale(scale, shapes)));
    } else {
      postMessage({ "type": "createTransformHandle", payload: { translation: [0, 0, 0], rotation: [[0, 1, 0], 1], scale: 1, lineAndColumn: self.getCallingLocation() } });
      return translation;
    }
  });
}

function Translate(offset, shapes, keepOriginal) {
  let translated = self.CacheOp(arguments, "Translate", () => {
    let transformation = new self.oc.gp_Trsf();
    transformation.SetTranslation(new self.oc.gp_Vec(offset[0], offset[1], offset[2]));
    let translation = new self.oc.TopLoc_Location(transformation);
    if (!self.isArrayLike(shapes)) {
      return new self.oc.TopoDS_Shape(shapes.Moved(translation));
    } else if (shapes.length >= 1) {
      let newTrans = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newTrans.push(new self.oc.TopoDS_Shape(shapes[shapeIndex].Moved(translation)));
      }
      return newTrans;
    }
  });

  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shapes); }
  self.sceneShapes.push(translated);

  return translated;
}

function Rotate(axis, degrees, shapes, keepOriginal) {
  let rotated = null;
  if (degrees === 0) {
    rotated = new self.oc.TopoDS_Shape(shapes);
  } else {
    rotated = self.CacheOp(arguments, "Rotate", () => {
      let newRot;
      let transformation = new self.oc.gp_Trsf();
      transformation.SetRotation(
        new self.oc.gp_Ax1(new self.oc.gp_Pnt(0, 0, 0), new self.oc.gp_Dir(
          new self.oc.gp_Vec(axis[0], axis[1], axis[2]))), degrees * 0.0174533);
      let rotation = new self.oc.TopLoc_Location(transformation);
      if (!self.isArrayLike(shapes)) {
        newRot = new self.oc.TopoDS_Shape(shapes.Moved(rotation));
      } else if (shapes.length >= 1) {
        for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
          shapes[shapeIndex].Move(rotation);
        }
      }
      return newRot;
    });
  }
  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shapes); }
  self.sceneShapes.push(rotated);
  return rotated;
}

function Mirror(vector, shapes, keepOriginal) {
  if (!vector) { vector = [1, 0, 0]; }
  const mirrored = self.CacheOp(arguments, "Mirror", () => {
    const mirrorTransform   = new self.oc.gp_Trsf();
    const mirrorPlaneOrigin = new self.oc.gp_Pnt(0, 0, 0);
    const mirrorPlaneNormal = new self.oc.gp_Dir(vector[0], vector[1], vector[2]);
    mirrorTransform.SetMirror(new self.oc.gp_Ax2(mirrorPlaneOrigin, mirrorPlaneNormal));

    if (!self.isArrayLike(shapes)) {
      return new self.oc.BRepBuilderAPI_Transform(shapes, mirrorTransform).Shape();
    } else if (shapes.length >= 1) {
      let newMirroring = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newMirroring.push(new self.oc.BRepBuilderAPI_Transform(shapes, mirrorTransform).Shape());
      }
      return newMirroring;
    }
  })
  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shapes); }
  self.sceneShapes.push(mirrored);

  return mirrored;
}

function Scale(scale, shapes, keepOriginal) {
  let scaled = self.CacheOp(arguments, "Scale", () => {
    let transformation = new self.oc.gp_Trsf();
    transformation.SetScaleFactor(scale);
    let scaling = new self.oc.TopLoc_Location(transformation);
    if (!self.isArrayLike(shapes)) {
      return new self.oc.TopoDS_Shape(shapes.Moved(scaling));
    } else if (shapes.length >= 1) {
      let newScale = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newScale.push(new self.oc.TopoDS_Shape(shapes[shapeIndex].Moved(scaling)));
      }
      return newScale;
    }
  });

  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shapes); }
  self.sceneShapes.push(scaled);

  return scaled;
}

// --- Boolean Operations ---

function Union(objectsToJoin, keepObjects, fuzzValue, keepEdges) {
  if (!fuzzValue) { fuzzValue = 0.1; }
  let curUnion = self.CacheOp(arguments, "Union", () => {
    let combined = new self.oc.TopoDS_Shape(objectsToJoin[0]);
    if (objectsToJoin.length > 1) {
      for (let i = 0; i < objectsToJoin.length; i++) {
        if (i > 0) {
          let combinedFuse = new self.oc.BRepAlgoAPI_Fuse(combined, objectsToJoin[i]);
          combinedFuse.SetFuzzyValue(fuzzValue);
          combinedFuse.Build();
          combined = combinedFuse.Shape();
        }
      }
    }

    if (!keepEdges) {
      let fusor = new self.oc.ShapeUpgrade_UnifySameDomain(combined); fusor.Build();
      combined = fusor.Shape();
    }

    return combined;
  });

  for (let i = 0; i < objectsToJoin.length; i++) {
    if (!keepObjects) { self.sceneShapes = self.Remove(self.sceneShapes, objectsToJoin[i]); }
  }
  self.sceneShapes.push(curUnion);
  return curUnion;
}

function Difference(mainBody, objectsToSubtract, keepObjects, fuzzValue, keepEdges) {
  if (!fuzzValue) { fuzzValue = 0.1; }
  let curDifference = self.CacheOp(arguments, "Difference", () => {
    if (!mainBody || mainBody.IsNull()) { console.error("Main Shape in Difference is null!"); }

    let difference = new self.oc.TopoDS_Shape(mainBody);
    if (objectsToSubtract.length >= 1) {
      for (let i = 0; i < objectsToSubtract.length; i++) {
        if (!objectsToSubtract[i] || objectsToSubtract[i].IsNull()) { console.error("Tool in Difference is null!"); }
        let differenceCut = new self.oc.BRepAlgoAPI_Cut(difference, objectsToSubtract[i]);
        differenceCut.SetFuzzyValue(fuzzValue);
        differenceCut.Build();
        difference = differenceCut.Shape();
      }
    }

    if (!keepEdges) {
      let fusor = new self.oc.ShapeUpgrade_UnifySameDomain(difference); fusor.Build();
      difference = fusor.Shape();
    }

    difference.hash = self.ComputeHash(arguments);
    if (GetNumSolidsInCompound(difference) === 1) {
      difference = GetSolidFromCompound(difference, 0);
    }

    return difference;
  });

  if (Array.isArray(keepObjects)) {
    if (!keepObjects[0]) { self.sceneShapes = self.Remove(self.sceneShapes, mainBody); }
    for (let i = 0; i < objectsToSubtract.length; i++) {
      if (!keepObjects[1]) { self.sceneShapes = self.Remove(self.sceneShapes, objectsToSubtract[i]); }
    }
  } else {
    if (!keepObjects) { self.sceneShapes = self.Remove(self.sceneShapes, mainBody); }
    for (let i = 0; i < objectsToSubtract.length; i++) {
      if (!keepObjects) { self.sceneShapes = self.Remove(self.sceneShapes, objectsToSubtract[i]); }
    }
  }

  self.sceneShapes.push(curDifference);
  return curDifference;
}

function Intersection(objectsToIntersect, keepObjects, fuzzValue, keepEdges) {
  if (!fuzzValue) { fuzzValue = 0.1; }
  let curIntersection = self.CacheOp(arguments, "Intersection", () => {
    let intersected = new self.oc.TopoDS_Shape(objectsToIntersect[0]);
    if (objectsToIntersect.length > 1) {
      for (let i = 0; i < objectsToIntersect.length; i++) {
        if (i > 0) {
          let intersectedCommon = new self.oc.BRepAlgoAPI_Common(intersected, objectsToIntersect[i]);
          intersectedCommon.SetFuzzyValue(fuzzValue);
          intersectedCommon.Build();
          intersected = intersectedCommon.Shape();
        }
      }
    }

    if (!keepEdges) {
      let fusor = new self.oc.ShapeUpgrade_UnifySameDomain(intersected); fusor.Build();
      intersected = fusor.Shape();
    }

    return intersected;
  });

  for (let i = 0; i < objectsToIntersect.length; i++) {
    if (!keepObjects) { self.sceneShapes = self.Remove(self.sceneShapes, objectsToIntersect[i]); }
  }
  self.sceneShapes.push(curIntersection);
  return curIntersection;
}

// --- Extrusion and Shape Generation ---

function Extrude(face, direction, keepFace) {
  let curExtrusion = self.CacheOp(arguments, "Extrude", () => {
    return new self.oc.BRepPrimAPI_MakePrism(face,
      new self.oc.gp_Vec(direction[0], direction[1], direction[2])).Shape();
  });

  if (!keepFace) { self.sceneShapes = self.Remove(self.sceneShapes, face); }
  self.sceneShapes.push(curExtrusion);
  return curExtrusion;
}

function RemoveInternalEdges(shape, keepShape) {
  let cleanShape = self.CacheOp(arguments, "RemoveInternalEdges", () => {
    let fusor = new self.oc.ShapeUpgrade_UnifySameDomain(shape);
    fusor.Build();
    return fusor.Shape();
  });

  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(cleanShape);
  return cleanShape;
}

function Offset(shape, offsetDistance, tolerance, keepShape) {
  if (!shape || shape.IsNull()) { console.error("Offset received Null Shape!"); }
  if (!tolerance) { tolerance = 0.1; }
  if (offsetDistance === 0.0) { return shape; }
  let curOffset = self.CacheOp(arguments, "Offset", () => {
    let offset = null;
    if (shape.ShapeType() === 5) {
      offset = new self.oc.BRepOffsetAPI_MakeOffset();
      offset.AddWire(shape);
      offset.Perform(offsetDistance);
    } else {
      offset = new self.oc.BRepOffsetAPI_MakeOffsetShape();
      offset.PerformByJoin(shape, offsetDistance, tolerance);
    }
    let offsetShape = new self.oc.TopoDS_Shape(offset.Shape());

    if (offsetShape.ShapeType() == 3) {
      let solidOffset = new self.oc.BRepBuilderAPI_MakeSolid();
      solidOffset.Add(offsetShape);
      offsetShape = new self.oc.TopoDS_Solid(solidOffset.Solid());
    }

    return offsetShape;
  });

  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(curOffset);
  return curOffset;
}

function Revolve(shape, degrees, direction, keepShape, copy) {
  if (!degrees  ) { degrees   = 360.0; }
  if (!direction) { direction = [0, 0, 1]; }
  let curRevolution = self.CacheOp(arguments, "Revolve", () => {
    if (degrees >= 360.0) {
      return new self.oc.BRepPrimAPI_MakeRevol(shape,
        new self.oc.gp_Ax1(new self.oc.gp_Pnt(0, 0, 0),
          new self.oc.gp_Dir(direction[0], direction[1], direction[2])),
        copy).Shape();
    } else {
      return new self.oc.BRepPrimAPI_MakeRevol(shape,
        new self.oc.gp_Ax1(new self.oc.gp_Pnt(0, 0, 0),
          new self.oc.gp_Dir(direction[0], direction[1], direction[2])),
        degrees * 0.0174533, copy).Shape();
    }
  });

  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(curRevolution);
  return curRevolution;
}

function RotatedExtrude(wire, height, rotation, keepWire) {
  if (!wire || wire.IsNull()) { console.error("RotatedExtrude received Null Wire!"); }
  let curExtrusion = self.CacheOp(arguments, "RotatedExtrude", () => {
    let upperPolygon = Rotate([0, 0, 1], rotation, Translate([0, 0, height], wire, true));
    self.sceneShapes = self.Remove(self.sceneShapes, upperPolygon);

    let spineWire = BSpline([
      [0, 0, 0],
      [0, 0, height]], false);
    self.sceneShapes = self.Remove(self.sceneShapes, spineWire);

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
    self.sceneShapes = self.Remove(self.sceneShapes, aspineWire);

    let pipe = new self.oc.BRepOffsetAPI_MakePipeShell(spineWire);
    pipe.SetMode(aspineWire, true);
    pipe.Add(wire);
    pipe.Add(upperPolygon);
    pipe.Build();
    pipe.MakeSolid();
    return new self.oc.TopoDS_Shape(pipe.Shape());
  });
  if (!keepWire) { self.sceneShapes = self.Remove(self.sceneShapes, wire); }
  self.sceneShapes.push(curExtrusion);
  return curExtrusion;
}

function Loft(wires, keepWires) {
  let curLoft = self.CacheOp(arguments, "Loft", () => {
    let pipe = new self.oc.BRepOffsetAPI_ThruSections(true);
    wires.forEach((wire) => { pipe.AddWire(wire); });
    pipe.Build();
    return new self.oc.TopoDS_Shape(pipe.Shape());
  });

  wires.forEach((wire) => {
    if (!keepWires) { self.sceneShapes = self.Remove(self.sceneShapes, wire); }
  });
  self.sceneShapes.push(curLoft);
  return curLoft;
}

function Pipe(shape, wirePath, keepInputs) {
  let curPipe = self.CacheOp(arguments, "Pipe", () => {
    let pipe = new self.oc.BRepOffsetAPI_MakePipe(wirePath, shape);
    pipe.Build();
    return new self.oc.TopoDS_Shape(pipe.Shape());
  });

  if (!keepInputs) {
    self.sceneShapes = self.Remove(self.sceneShapes, shape);
    self.sceneShapes = self.Remove(self.sceneShapes, wirePath);
  }
  self.sceneShapes.push(curPipe);
  return curPipe;
}

// --- Sketch Class (drawing utility) ---

function Sketch(startingPoint) {
  this.currentIndex = 0;
  this.faces        = [];
  this.wires        = [];
  this.firstPoint   = new self.oc.gp_Pnt(startingPoint[0], startingPoint[1], 0);
  this.lastPoint    = this.firstPoint;
  this.wireBuilder  = new self.oc.BRepBuilderAPI_MakeWire();
  this.fillets      = [];
  this.argsString   = self.ComputeHash(arguments, true);

  this.Start = function (startingPoint) {
    this.firstPoint  = new self.oc.gp_Pnt(startingPoint[0], startingPoint[1], 0);
    this.lastPoint   = this.firstPoint;
    this.wireBuilder = new self.oc.BRepBuilderAPI_MakeWire();
    this.argsString += self.ComputeHash(arguments, true);
    return this;
  }

  this.End = function (closed, reversed) {
    this.argsString += self.ComputeHash(arguments, true);

    if (closed &&
       (this.firstPoint.X() !== this.lastPoint.X() ||
        this.firstPoint.Y() !== this.lastPoint.Y())) {
      this.LineTo(this.firstPoint);
    }

    let wire = this.wireBuilder.Wire();
    if (reversed) { wire = wire.Reversed(); }
    wire.hash = self.stringToHash(this.argsString);
    this.wires.push(wire);

    let faceBuilder = null;
    if (this.faces.length > 0) {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace(this.wires[0]);
      for (let w = 1; w < this.wires.length; w++){
        faceBuilder.Add(this.wires[w]);
      }
    } else {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace(wire);
    }

    let face = faceBuilder.Face();
    face.hash = self.stringToHash(this.argsString);
    this.faces.push(face);
    return this;
  }

  this.Wire = function (reversed) {
    this.argsString += self.ComputeHash(arguments, true);
    this.applyFillets();
    this.faces[this.faces.length - 1].hash = self.stringToHash(this.argsString);
    let wire = GetWire(this.faces[this.faces.length - 1]);
    if (reversed) { wire = wire.Reversed(); }
    self.sceneShapes.push(wire);
    return wire;
  }
  this.Face = function (reversed) {
    this.argsString += self.ComputeHash(arguments, true);
    this.applyFillets();
    let face = this.faces[this.faces.length - 1];
    if (reversed) { face = face.Reversed(); }
    face.hash = self.stringToHash(this.argsString);
    self.sceneShapes.push(face);
    return face;
  }

  this.applyFillets = function () {
    if (this.fillets.length > 0) {
      let successes = 0; let swapFillets = [];
      for (let f = 0; f < this.fillets.length; f++) { this.fillets[f].disabled = false; }

      let makeFillet = new self.oc.BRepFilletAPI_MakeFillet2d(this.faces[this.faces.length - 1]);
      ForEachVertex(this.faces[this.faces.length - 1], (vertex) => {
        let pnt = self.oc.BRep_Tool.prototype.Pnt(vertex);
        for (let f = 0; f < this.fillets.length; f++) {
          if (!this.fillets[f].disabled &&
              pnt.X() === this.fillets[f].x &&
              pnt.Y() === this.fillets[f].y ) {
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

  this.AddWire = function (wire) {
    this.argsString += self.ComputeHash(arguments, true);
    this.wireBuilder.Add(wire);
    if (endPoint) { this.lastPoint = endPoint; }
    return this;
  }

  this.LineTo = function (nextPoint) {
    this.argsString += self.ComputeHash(arguments, true);
    let endPoint = null;
    if (nextPoint.X) {
      if (this.lastPoint.X() === nextPoint.X() &&
          this.lastPoint.Y() === nextPoint.Y()) { return this; }
      endPoint = nextPoint;
    } else {
      if (this.lastPoint.X() === nextPoint[0] &&
          this.lastPoint.Y() === nextPoint[1]) { return this; }
      endPoint = new self.oc.gp_Pnt(nextPoint[0], nextPoint[1], 0);
    }
    let lineSegment    = new self.oc.GC_MakeSegment(this.lastPoint, endPoint).Value();
    let lineEdge       = new self.oc.BRepBuilderAPI_MakeEdge(lineSegment    ).Edge ();
    this.wireBuilder.Add(new self.oc.BRepBuilderAPI_MakeWire(lineEdge       ).Wire ());
    this.lastPoint     = endPoint;
    this.currentIndex++;
    return this;
  }

  this.ArcTo = function (pointOnArc, arcEnd) {
    this.argsString += self.ComputeHash(arguments, true);
    let onArc          = new self.oc.gp_Pnt(pointOnArc[0], pointOnArc[1], 0);
    let nextPoint      = new self.oc.gp_Pnt(    arcEnd[0],     arcEnd[1], 0);
    let arcCurve       = new self.oc.GC_MakeArcOfCircle(this.lastPoint, onArc, nextPoint).Value();
    let arcEdge        = new self.oc.BRepBuilderAPI_MakeEdge(arcCurve    ).Edge() ;
    this.wireBuilder.Add(new self.oc.BRepBuilderAPI_MakeWire(arcEdge).Wire());
    this.lastPoint     = nextPoint;
    this.currentIndex++;
    return this;
  }

  this.BezierTo = function (bezierControlPoints) {
    this.argsString += self.ComputeHash(arguments, true);
    let ptList = new self.oc.TColgp_Array1OfPnt(1, bezierControlPoints.length+1);
    ptList.SetValue(1, this.lastPoint);
    for (let bInd = 0; bInd < bezierControlPoints.length; bInd++){
      let ctrlPoint = self.convertToPnt(bezierControlPoints[bInd]);
      ptList.SetValue(bInd + 2, ctrlPoint);
      this.lastPoint = ctrlPoint;
    }
    let cubicCurve     = new self.oc.Geom_BezierCurve(ptList);
    let handle         = new self.oc.Handle_Geom_BezierCurve(cubicCurve);
    let lineEdge       = new self.oc.BRepBuilderAPI_MakeEdge(handle    ).Edge() ;
    this.wireBuilder.Add(new self.oc.BRepBuilderAPI_MakeWire(lineEdge  ).Wire());
    this.currentIndex++;
    return this;
  }

  this.BSplineTo = function (bsplinePoints) {
    this.argsString += self.ComputeHash(arguments, true);
    let ptList = new self.oc.TColgp_Array1OfPnt(1, bsplinePoints.length+1);
    ptList.SetValue(1, this.lastPoint);
    for (let bInd = 0; bInd < bsplinePoints.length; bInd++){
      let ctrlPoint = self.convertToPnt(bsplinePoints[bInd]);
      ptList.SetValue(bInd + 2, ctrlPoint);
      this.lastPoint = ctrlPoint;
    }
    let handle         = new self.oc.GeomAPI_PointsToBSpline(ptList  ).Curve();
    let lineEdge       = new self.oc.BRepBuilderAPI_MakeEdge(handle  ).Edge() ;
    this.wireBuilder.Add(new self.oc.BRepBuilderAPI_MakeWire(lineEdge).Wire());
    this.currentIndex++;
    return this;
  }

  this.Fillet = function (radius) {
    this.argsString += self.ComputeHash(arguments, true);
    this.fillets.push({ x: this.lastPoint.X(), y: this.lastPoint.Y(), radius: radius });
    return this;
  }

  this.Circle = function (center, radius, reversed) {
    this.argsString += self.ComputeHash(arguments, true);
    let circle = new self.oc.GC_MakeCircle(new self.oc.gp_Ax2(self.convertToPnt(center),
    new self.oc.gp_Dir(0, 0, 1)), radius).Value();
    let edge = new self.oc.BRepBuilderAPI_MakeEdge(circle).Edge();
    let wire = new self.oc.BRepBuilderAPI_MakeWire(edge).Wire();
    if (reversed) { wire = wire.Reversed(); }
    wire.hash = self.stringToHash(this.argsString);
    this.wires.push(wire);

    let faceBuilder = null;
    if (this.faces.length > 0) {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace(this.wires[0]);
      for (let w = 1; w < this.wires.length; w++){
        faceBuilder.Add(this.wires[w]);
      }
    } else {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace(wire);
    }
    let face = faceBuilder.Face();
    face.hash = self.stringToHash(this.argsString);
    this.faces.push(face);
    return this;
  }
}

// --- GUI Controls ---

function SaveFile(filename, fileURL) {
  postMessage({
    "type": "saveFile",
    payload: { filename: filename, fileURL: fileURL }
  });
}

function Slider(name = "Val", defaultValue = 0.5, min = 0.0, max = 1.0, realTime=false, step, precision) {
  if (!(name in self.GUIState)) { self.GUIState[name] = defaultValue; }
  if (!step) { step = 0.01; }
  if (typeof precision === "undefined") {
    precision = 2;
  } else if (precision % 1) { console.error("Slider precision must be an integer"); }

  postMessage({ "type": "addSlider", payload: { name: name, default: defaultValue, min: min, max: max, realTime: realTime, step: step, dp: precision } });
  return self.GUIState[name];
}

function Button(name = "Action") {
  postMessage({ "type": "addButton", payload: { name: name } });
}

function Checkbox(name = "Toggle", defaultValue = false) {
  if (!(name in self.GUIState)) { self.GUIState[name] = defaultValue; }
  postMessage({ "type": "addCheckbox", payload: { name: name, default: defaultValue } });
  return self.GUIState[name];
}

function TextInput(name = "Text", defaultValue = "", realTime = false) {
  if (!(name in self.GUIState)) { self.GUIState[name] = defaultValue; }
  postMessage({ "type": "addTextbox", payload: { name: name, default: defaultValue, realTime: realTime } });
  return self.GUIState[name];
}

function Dropdown(name = "Dropdown", defaultValue = "", options = {}, realTime = false) {
  if (!(name in self.GUIState)) { self.GUIState[name] = defaultValue; }
  postMessage({ "type": "addDropdown", payload: { name: name, default: defaultValue, options: options, realTime: realTime } });
  return self.GUIState[name];
}

// --- Library Class (organizes initialization and self-registration) ---

/** Wraps initialization of all CAD standard library functions.
 *  CAD functions are regular function declarations (not class methods)
 *  to preserve `arguments.callee` access required by CacheOp. */
class CascadeStudioStandardLibrary {
  constructor() {
    // Instantiate utility dependencies
    this.utils = new CascadeStudioUtils();

    // Assign all CAD API functions to self for eval() access
    self.Box = Box;
    self.Sphere = Sphere;
    self.Cylinder = Cylinder;
    self.Cone = Cone;
    self.Polygon = Polygon;
    self.Circle = Circle;
    self.BSpline = BSpline;
    self.Text3D = Text3D;
    self.ForEachSolid = ForEachSolid;
    self.GetNumSolidsInCompound = GetNumSolidsInCompound;
    self.GetSolidFromCompound = GetSolidFromCompound;
    self.ForEachShell = ForEachShell;
    self.ForEachFace = ForEachFace;
    self.ForEachWire = ForEachWire;
    self.GetWire = GetWire;
    self.ForEachEdge = ForEachEdge;
    self.ForEachVertex = ForEachVertex;
    self.FilletEdges = FilletEdges;
    self.ChamferEdges = ChamferEdges;
    self.Transform = Transform;
    self.Translate = Translate;
    self.Rotate = Rotate;
    self.Mirror = Mirror;
    self.Scale = Scale;
    self.Union = Union;
    self.Difference = Difference;
    self.Intersection = Intersection;
    self.Extrude = Extrude;
    self.RemoveInternalEdges = RemoveInternalEdges;
    self.Offset = Offset;
    self.Revolve = Revolve;
    self.RotatedExtrude = RotatedExtrude;
    self.Loft = Loft;
    self.Pipe = Pipe;
    self.Sketch = Sketch;
    self.SaveFile = SaveFile;
    self.Slider = Slider;
    self.Button = Button;
    self.Checkbox = Checkbox;
    self.TextInput = TextInput;
    self.Dropdown = Dropdown;
  }
}

export { CascadeStudioStandardLibrary };
