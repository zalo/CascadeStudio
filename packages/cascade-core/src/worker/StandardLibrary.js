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

import { CascadeStudioUtils } from './StandardUtils.js';

// --- CAD API Functions ---
// These are regular function declarations (NOT class methods) to preserve
// `arguments.callee` access needed by CacheOp for hashing and progress tracking.

function Box(x, y, z, centered) {
  if (!centered) { centered = false;}
  let curBox = self.CacheOp(arguments, "Box", () => {
    let box = new self.oc.BRepPrimAPI_MakeBox_2(x, y, z).Shape();
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
    let spherePlane = new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(0, 0, 0), self.oc.gp.DZ());
    return new self.oc.BRepPrimAPI_MakeSphere_9(spherePlane, radius).Shape();
  });
  self.sceneShapes.push(curSphere);
  return curSphere;
}

function Cylinder(radius, height, centered) {
  let curCylinder = self.CacheOp(arguments, "Cylinder", () => {
    let cylinderPlane = new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(0, 0, centered ? -height / 2 : 0), new self.oc.gp_Dir_5(0, 0, 1));
    return new self.oc.BRepPrimAPI_MakeCylinder_3(cylinderPlane, radius, height).Shape();
  });
  self.sceneShapes.push(curCylinder);
  return curCylinder;
}

function Cone(radius1, radius2, height) {
  let curCone = self.CacheOp(arguments, "Cone", () => {
    return new self.oc.BRepPrimAPI_MakeCone_1(radius1, radius2, height).Shape();
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

    let polygonWire = new self.oc.BRepBuilderAPI_MakeWire_1();
    for (let ind = 0; ind < points.length - 1; ind++) {
      let seg = new self.oc.GC_MakeSegment_1(gpPoints[ind], gpPoints[ind + 1]).Value();
      let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(seg.get())).Edge();
      let innerWire = new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
      polygonWire.Add_2(innerWire);
    }
    let seg2 = new self.oc.GC_MakeSegment_1(gpPoints[points.length - 1], gpPoints[0]).Value();
    let edge2 = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(seg2.get())).Edge();
    let innerWire2 = new self.oc.BRepBuilderAPI_MakeWire_2(edge2).Wire();
    polygonWire.Add_2(innerWire2);
    let finalWire = polygonWire.Wire();

    if (wire) {
      return finalWire;
    } else {
      return new self.oc.BRepBuilderAPI_MakeFace_15(finalWire, false).Face();
    }
  });
  self.sceneShapes.push(curPolygon);
  return curPolygon;
}

function Circle(radius, wire) {
  let curCircle = self.CacheOp(arguments, "Circle", () => {
    let circle = new self.oc.GC_MakeCircle_2(new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(0, 0, 0),
      new self.oc.gp_Dir_5(0, 0, 1)), radius).Value();
    let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(circle.get())).Edge();
    let circleWire = new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
    if (wire) { return circleWire; }
    return new self.oc.BRepBuilderAPI_MakeFace_15(circleWire, false).Face();
  });
  self.sceneShapes.push(curCircle);
  return curCircle;
}

function BSpline(inPoints, closed) {
  let curSpline = self.CacheOp(arguments, "BSpline", () => {
    let ptList = new self.oc.TColgp_Array1OfPnt_2(1, inPoints.length + (closed ? 1 : 0));
    for (let pIndex = 1; pIndex <= inPoints.length; pIndex++) {
      ptList.SetValue(pIndex, self.convertToPnt(inPoints[pIndex - 1]));
    }
    if (closed) { ptList.SetValue(inPoints.length + 1, ptList.Value(1)); }

    let geomCurveHandle = new self.oc.GeomAPI_PointsToBSpline_2(ptList, 3, 8, (self.oc.GeomAbs_Shape ? self.oc.GeomAbs_Shape.GeomAbs_C2 : 2), 1.0e-3).Curve();
    let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(geomCurveHandle.get())).Edge();
    return     new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
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
    if (self.loadedFonts[fontName] === undefined) { for (let k in self.argCache) delete self.argCache[k]; console.log("Font not loaded or found yet!  Try again..."); return; }
    let textFaces = [];
    let commands = self.loadedFonts[fontName].getPath(text, 0, 0, size).commands;
    for (let idx = 0; idx < commands.length; idx++) {
      if (commands[idx].type === "M") {
        var firstPoint = new self.oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);
        var lastPoint = firstPoint;
        var currentWire = new self.oc.BRepBuilderAPI_MakeWire_1();
      } else if (commands[idx].type === "Z") {
        try {
          let faceBuilder = null;
          if (textFaces.length > 0) {
            faceBuilder = new self.oc.BRepBuilderAPI_MakeFace_22(
              textFaces[textFaces.length - 1], currentWire.Wire());
          } else {
            faceBuilder = new self.oc.BRepBuilderAPI_MakeFace_15(currentWire.Wire(), false);
          }
          textFaces.push(faceBuilder.Face());
        } catch (e) {
          console.error("ERROR: OCC encountered malformed characters when constructing faces from this font (likely self-intersections)!  Try using a more robust font like 'Roboto'.");
        }
      } else if (commands[idx].type === "L") {
        let nextPoint = new self.oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);
        if (lastPoint.X() === nextPoint.X() && lastPoint.Y() === nextPoint.Y()) { continue; }
        let lineSegment = new self.oc.GC_MakeSegment_1(lastPoint, nextPoint).Value();
        let lineEdge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(lineSegment.get())).Edge();
        currentWire.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());
        lastPoint = nextPoint;
      } else if (commands[idx].type === "Q") {
        let controlPoint = new self.oc.gp_Pnt_3(commands[idx].x1, commands[idx].y1, 0);
        let nextPoint = new self.oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);

        let ptList = new self.oc.TColgp_Array1OfPnt_2(1, 3);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint);
        ptList.SetValue(3, nextPoint);
        let quadraticCurve = new self.oc.Geom_BezierCurve_1(ptList);
        let lineEdge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(quadraticCurve)).Edge();
        currentWire.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());

        lastPoint = nextPoint;
      } else if (commands[idx].type === "C") {
        let controlPoint1 = new self.oc.gp_Pnt_3(commands[idx].x1, commands[idx].y1, 0);
        let controlPoint2 = new self.oc.gp_Pnt_3(commands[idx].x2, commands[idx].y2, 0);
        let nextPoint = new self.oc.gp_Pnt_3(commands[idx].x, commands[idx].y, 0);

        let ptList = new self.oc.TColgp_Array1OfPnt_2(1, 4);
        ptList.SetValue(1, lastPoint);
        ptList.SetValue(2, controlPoint1);
        ptList.SetValue(3, controlPoint2);
        ptList.SetValue(4, nextPoint);
        let cubicCurve = new self.oc.Geom_BezierCurve_1(ptList);
        let lineEdge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(cubicCurve)).Edge();
        currentWire.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());

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
  let anExplorer = new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_SOLID, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_SOLID, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(solid_index++, self.oc.TopoDS_Cast.Solid_1(anExplorer.Current()));
  }
}
function GetNumSolidsInCompound(shape) {
  if (!shape || shape.ShapeType().value > 1 || shape.IsNull()) { console.error("Not a compound shape!"); return shape; }
  let solidsFound = 0;
  ForEachSolid(shape, (i, s) => { solidsFound++; });
  return solidsFound;
}
function GetSolidFromCompound(shape, index, keepOriginal) {
  if (!shape || shape.ShapeType().value > 1 || shape.IsNull()) { console.error("Not a compound shape!"); return shape; }
  if (!index) { index = 0;}

  let sol = self.CacheOp(arguments, "GetSolidFromCompound", () => {
    let innerSolid = {}; let solidsFound = 0;
    ForEachSolid(shape, (i, s) => {
      if (i === index) { innerSolid = s; } solidsFound++;
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
  let anExplorer = new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_SHELL, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_SHELL, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(shell_index++, self.oc.TopoDS_Cast.Shell_1(anExplorer.Current()));
  }
}

function ForEachFace(shape, callback) {
  let face_index = 0;
  let anExplorer = new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_FACE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_FACE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(face_index++, self.oc.TopoDS_Cast.Face_1(anExplorer.Current()));
  }
}

function ForEachWire(shape, callback) {
  let wire_index = 0;
  let anExplorer = new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_WIRE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_WIRE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(wire_index++, self.oc.TopoDS_Cast.Wire_1(anExplorer.Current()));
  }
}
function GetWire(shape, index, keepOriginal) {
  if (!shape || shape.ShapeType().value > 4 || shape.IsNull()) { console.error("Not a wire shape!"); return shape; }
  if (!index) { index = 0;}

  let wire = self.CacheOp(arguments, "GetWire", () => {
    let innerWire = {}; let wiresFound = 0;
    ForEachWire(shape, (i, s) => {
      if (i === index) { innerWire = s; } wiresFound++;
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
  let anExplorer = new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    let edge = self.oc.TopoDS_Cast.Edge_1(anExplorer.Current());
    let edgeHash = self.oc.OCJS.HashCode(edge, 100000000);
    if(!edgeHashes.hasOwnProperty(edgeHash)){
      edgeHashes[edgeHash] = edgeIndex;
      callback(edgeIndex++, edge);
    }
  }
  return edgeHashes;
}

function ForEachVertex(shape, callback) {
  let anExplorer = new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_VERTEX, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (anExplorer.Init(shape, self.oc.TopAbs_ShapeEnum.TopAbs_VERTEX, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); anExplorer.More(); anExplorer.Next()) {
    callback(self.oc.TopoDS_Cast.Vertex_1(anExplorer.Current()));
  }
}

// --- Edge/Face Operations ---

function FilletEdges(shape, radius, edgeList, keepOriginal) {
  if (!shape || shape.IsNull()) { console.error("FilletEdges: input shape is null!"); return shape; }
  if (!edgeList || edgeList.length === 0) { console.error("FilletEdges: edgeList is empty — no edges to fillet."); return shape; }
  let curFillet = self.CacheOp(arguments, "FilletEdges", () => {
    let mkFillet = new self.oc.BRepFilletAPI_MakeFillet(shape, self.oc.ChFi3d_FilletShape.ChFi3d_Rational);
    let foundEdges = 0;
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkFillet.Add_2(radius, edge); foundEdges++; }
    });
    if (foundEdges == 0) {
      console.error("Fillet Edges Not Found!  Make sure you are looking at the object _before_ the Fillet is applied!");
      return shape;
    }
    mkFillet.Build(new self.oc.Message_ProgressRange_1());
    return mkFillet.Shape();
  });
  self.sceneShapes.push(curFillet);
  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  return curFillet;
}

function ChamferEdges(shape, distance, edgeList, keepOriginal) {
  if (!shape || shape.IsNull()) { console.error("ChamferEdges: input shape is null!"); return shape; }
  if (!edgeList || edgeList.length === 0) { console.error("ChamferEdges: edgeList is empty — no edges to chamfer."); return shape; }
  let curChamfer = self.CacheOp(arguments, "ChamferEdges", () => {
    let mkChamfer = new self.oc.BRepFilletAPI_MakeChamfer(shape);
    let foundEdges = 0;
    ForEachEdge(shape, (index, edge) => {
      if (edgeList.includes(index)) { mkChamfer.Add_2(distance, edge); foundEdges++; }
    });
    if (foundEdges == 0) {
      console.error("Chamfer Edges Not Found!  Make sure you are looking at the object _before_ the Chamfer is applied!");
      return shape;
    }
    mkChamfer.Build(new self.oc.Message_ProgressRange_1());
    return mkChamfer.Shape();
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
    let transformation = new self.oc.gp_Trsf_1();
    transformation.SetTranslation_1(new self.oc.gp_Vec_4(offset[0], offset[1], offset[2]));
    let translation = new self.oc.TopLoc_Location_4(transformation);
    if (!self.isArrayLike(shapes)) {
      return shapes.Moved(translation, false);
    } else if (shapes.length >= 1) {
      let newTrans = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newTrans.push(shapes[shapeIndex].Moved(translation, false));
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
    rotated = shapes;
  } else {
    rotated = self.CacheOp(arguments, "Rotate", () => {
      let newRot;
      let transformation = new self.oc.gp_Trsf_1();
      transformation.SetRotation_1(
        new self.oc.gp_Ax1_2(new self.oc.gp_Pnt_3(0, 0, 0), new self.oc.gp_Dir_3(
          new self.oc.gp_Vec_4(axis[0], axis[1], axis[2]))), degrees * 0.0174533);
      let rotation = new self.oc.TopLoc_Location_4(transformation);
      if (!self.isArrayLike(shapes)) {
        newRot = shapes.Moved(rotation, false);
      } else if (shapes.length >= 1) {
        for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
          shapes[shapeIndex].Move(rotation, false);
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
    const mirrorTransform   = new self.oc.gp_Trsf_1();
    const mirrorPlaneOrigin = new self.oc.gp_Pnt_3(0, 0, 0);
    const mirrorPlaneNormal = new self.oc.gp_Dir_5(vector[0], vector[1], vector[2]);
    mirrorTransform.SetMirror_3(new self.oc.gp_Ax2_4(mirrorPlaneOrigin, mirrorPlaneNormal));

    if (!self.isArrayLike(shapes)) {
      return new self.oc.BRepBuilderAPI_Transform_2(shapes, mirrorTransform, false, false).Shape();
    } else if (shapes.length >= 1) {
      let newMirroring = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newMirroring.push(new self.oc.BRepBuilderAPI_Transform_2(shapes[shapeIndex], mirrorTransform, false, false).Shape());
      }
      return newMirroring;
    }
  })
  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shapes); }
  self.sceneShapes.push(mirrored);

  return mirrored;
}

function Scale(scale, shapes, keepOriginal) {
  if (Array.isArray(scale)) {
    console.error("Scale() takes a single number, not an array. Non-uniform scaling [x,y,z] is not supported. Using scale[0]=" + scale[0] + " instead.");
    scale = scale[0];
  }
  let scaled = self.CacheOp(arguments, "Scale", () => {
    let transformation = new self.oc.gp_Trsf_1();
    transformation.SetScaleFactor(scale);
    let scaling = new self.oc.TopLoc_Location_4(transformation);
    if (!self.isArrayLike(shapes)) {
      return shapes.Moved(scaling, false);
    } else if (shapes.length >= 1) {
      let newScale = [];
      for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        newScale.push(shapes[shapeIndex].Moved(scaling, false));
      }
      return newScale;
    }
  });

  if (!keepOriginal) { self.sceneShapes = self.Remove(self.sceneShapes, shapes); }
  self.sceneShapes.push(scaled);

  return scaled;
}

// --- Boolean Operations ---

function _quickVolume(shape) {
  try {
    let props = new self.oc.GProp_GProps_1();
    self.oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
    return Math.abs(props.Mass());
  } catch (e) { return 0; }
}

function Union(objectsToJoin, keepObjects, fuzzValue, keepEdges) {
  if (!fuzzValue) { fuzzValue = 1e-7; }
  let inputVolumes = objectsToJoin.map(o => _quickVolume(o));
  let totalInput = inputVolumes.reduce((a, b) => a + b, 0);
  let curUnion = self.CacheOp(arguments, "Union", () => {
    let combined = objectsToJoin[0];
    if (objectsToJoin.length > 1) {
      for (let i = 0; i < objectsToJoin.length; i++) {
        if (i > 0) {
          combined = self.oc.OCJS.BooleanFuse(combined, objectsToJoin[i], fuzzValue);
        }
      }
    }

    if (!keepEdges) {
      let fusor = new self.oc.ShapeUpgrade_UnifySameDomain_2(combined, true, true, false); fusor.Build();
      combined = fusor.Shape();
    }

    return combined;
  });
  let resultVol = _quickVolume(curUnion);
  if (totalInput > 1 && resultVol < totalInput * 0.01) {
    console.error("Union produced near-zero volume (" + resultVol.toFixed(1) + " from " + totalInput.toFixed(1) + "). Do the shapes overlap? Non-touching shapes cannot be Unioned — keep them as separate scene objects instead.");
  }

  for (let i = 0; i < objectsToJoin.length; i++) {
    if (!keepObjects) { self.sceneShapes = self.Remove(self.sceneShapes, objectsToJoin[i]); }
  }
  self.sceneShapes.push(curUnion);
  return curUnion;
}

function Difference(mainBody, objectsToSubtract, keepObjects, fuzzValue, keepEdges) {
  if (!fuzzValue) { fuzzValue = 1e-7; }
  let mainVol = _quickVolume(mainBody);
  let curDifference = self.CacheOp(arguments, "Difference", () => {
    if (!mainBody || mainBody.IsNull()) { console.error("Main Shape in Difference is null!"); }

    let difference = mainBody;
    if (objectsToSubtract.length >= 1) {
      for (let i = 0; i < objectsToSubtract.length; i++) {
        if (!objectsToSubtract[i] || objectsToSubtract[i].IsNull()) { console.error("Tool in Difference is null!"); }
        difference = self.oc.OCJS.BooleanCut(difference, objectsToSubtract[i], fuzzValue);
      }
    }

    if (!keepEdges) {
      let fusor = new self.oc.ShapeUpgrade_UnifySameDomain_2(difference, true, true, false); fusor.Build();
      difference = fusor.Shape();
    }

    difference.hash = self.ComputeHash(arguments);
    if (GetNumSolidsInCompound(difference) === 1) {
      difference = GetSolidFromCompound(difference, 0);
    }

    return difference;
  });
  let resultVol = _quickVolume(curDifference);
  if (mainVol > 1 && resultVol < mainVol * 0.01) {
    console.error("Difference destroyed the main body (volume " + mainVol.toFixed(1) + " → " + resultVol.toFixed(1) + "). Check that the tool shapes intersect the body and are not consuming it entirely.");
  }

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
  if (!fuzzValue) { fuzzValue = 1e-7; }
  let inputVolumes = objectsToIntersect.map(o => _quickVolume(o));
  let minInput = Math.min(...inputVolumes);
  let curIntersection = self.CacheOp(arguments, "Intersection", () => {
    let intersected = objectsToIntersect[0];
    if (objectsToIntersect.length > 1) {
      for (let i = 0; i < objectsToIntersect.length; i++) {
        if (i > 0) {
          intersected = self.oc.OCJS.BooleanCommon(intersected, objectsToIntersect[i], fuzzValue);
        }
      }
    }

    if (!keepEdges) {
      let fusor = new self.oc.ShapeUpgrade_UnifySameDomain_2(intersected, true, true, false); fusor.Build();
      intersected = fusor.Shape();
    }

    return intersected;
  });
  let resultVol = _quickVolume(curIntersection);
  if (minInput > 1 && resultVol < minInput * 0.01) {
    console.error("Intersection produced near-zero volume (" + resultVol.toFixed(1) + "). Do the shapes actually overlap?");
  }

  for (let i = 0; i < objectsToIntersect.length; i++) {
    if (!keepObjects) { self.sceneShapes = self.Remove(self.sceneShapes, objectsToIntersect[i]); }
  }
  self.sceneShapes.push(curIntersection);
  return curIntersection;
}

// --- Extrusion and Shape Generation ---

function Extrude(face, direction, keepFace) {
  if (!face || face.IsNull()) { console.error("Extrude: input shape is null! Was it consumed by a previous operation? Use keepFace/keepShape to preserve shapes for reuse."); return face; }
  let curExtrusion = self.CacheOp(arguments, "Extrude", () => {
    return new self.oc.BRepPrimAPI_MakePrism_1(face,
      new self.oc.gp_Vec_4(direction[0], direction[1], direction[2]), false, true).Shape();
  });

  if (!keepFace) { self.sceneShapes = self.Remove(self.sceneShapes, face); }
  self.sceneShapes.push(curExtrusion);
  return curExtrusion;
}

function RemoveInternalEdges(shape, keepShape) {
  let cleanShape = self.CacheOp(arguments, "RemoveInternalEdges", () => {
    let fusor = new self.oc.ShapeUpgrade_UnifySameDomain_2(shape, true, true, false);
    fusor.Build();
    return fusor.Shape();
  });

  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(cleanShape);
  return cleanShape;
}

function Offset(shape, offsetDistance, tolerance, keepShape) {
  if (!shape || shape.IsNull()) { console.error("Offset: input shape is null!"); return shape; }
  if (!tolerance) { tolerance = 0.1; }
  if (offsetDistance === 0.0) { return shape; }
  let curOffset = self.CacheOp(arguments, "Offset", () => {
    let offset = null;
    let shapeType = shape.ShapeType().value;
    if (shapeType === 5) {
      // Wire: 2D planar wire offset
      offset = new self.oc.BRepOffsetAPI_MakeOffset_1();
      offset.AddWire(shape);
      offset.Perform(offsetDistance);
    } else if (shapeType === 4) {
      // Face: 2D boundary offset using the face's own surface as reference plane
      let face = self.oc.TopoDS_Cast.Face_1(shape);
      offset = new self.oc.BRepOffsetAPI_MakeOffset_2(face,
        self.oc.GeomAbs_JoinType.GeomAbs_Arc, false);
      offset.Perform(offsetDistance);
      // Result is a wire — extract and rebuild as a face
      let resultShape = offset.Shape();
      let wExp = new self.oc.TopExp_Explorer_2(resultShape,
        self.oc.TopAbs_ShapeEnum.TopAbs_WIRE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      if (wExp.More()) {
        let offsetWire = self.oc.TopoDS_Cast.Wire_1(wExp.Current());
        let faceMaker = new self.oc.BRepBuilderAPI_MakeFace_15(offsetWire, true);
        return faceMaker.Face();
      }
      return resultShape;
    } else {
      // Solid/Shell: 3D shell offset
      offset = new self.oc.BRepOffsetAPI_MakeOffsetShape();
      offset.PerformByJoin(shape, offsetDistance, tolerance, self.oc.BRepOffset_Mode.BRepOffset_Skin, false, false, self.oc.GeomAbs_JoinType.GeomAbs_Arc, false, new self.oc.Message_ProgressRange_1());
    }
    let offsetShape = offset.Shape();

    if (offsetShape.ShapeType().value === 3) {
      let solidOffset = new self.oc.BRepBuilderAPI_MakeSolid_1();
      solidOffset.Add(self.oc.TopoDS_Cast.Shell_1(offsetShape));
      offsetShape = solidOffset.Solid();
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
  // Negative angles produce inside-out faces; flip direction instead
  if (degrees < 0) {
    degrees = -degrees;
    direction = [-direction[0], -direction[1], -direction[2]];
  }
  let curRevolution = self.CacheOp(arguments, "Revolve", () => {
    if (degrees >= 360.0) {
      return new self.oc.BRepPrimAPI_MakeRevol_2(shape,
        new self.oc.gp_Ax1_2(new self.oc.gp_Pnt_3(0, 0, 0),
          new self.oc.gp_Dir_5(direction[0], direction[1], direction[2])),
        copy).Shape();
    } else {
      return new self.oc.BRepPrimAPI_MakeRevol_1(shape,
        new self.oc.gp_Ax1_2(new self.oc.gp_Pnt_3(0, 0, 0),
          new self.oc.gp_Dir_5(direction[0], direction[1], direction[2])),
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
    pipe.SetMode_5(aspineWire, true, self.oc.BRepFill_TypeOfContact.BRepFill_NoContact);
    pipe.Add_1(wire, false, false);
    pipe.Add_1(upperPolygon, false, false);
    pipe.Build(new self.oc.Message_ProgressRange_1());
    pipe.MakeSolid();
    return pipe.Shape();
  });
  if (!keepWire) { self.sceneShapes = self.Remove(self.sceneShapes, wire); }
  self.sceneShapes.push(curExtrusion);
  return curExtrusion;
}

function Loft(wires, keepWires) {
  // Auto-extract wires from non-wire shapes (e.g. after Translate/Rotate).
  // Embind requires the exact TopoDS_Wire type for AddWire(), so we rebuild
  // wires through BRepBuilderAPI_MakeWire to ensure proper Embind typing.
  let resolvedWires = wires.map((w, i) => {
    let wire = w;
    if (w.ShapeType().value !== 5) {
      // Not a wire — extract the first wire sub-shape
      console.warn("Loft: profile " + i + " is not a wire (ShapeType " + w.ShapeType().value + "), extracting wire automatically. Use GetWire() to avoid this warning.");
      let exp = new self.oc.TopExp_Explorer_2(w, self.oc.TopAbs_ShapeEnum.TopAbs_WIRE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      if (exp.More()) {
        wire = self.oc.TopoDS_Cast.Wire_1(exp.Current());
      } else {
        console.error("Loft: could not extract a wire from profile " + i);
        return w;
      }
    }
    // Rebuild the wire from its edges to get a properly Embind-typed TopoDS_Wire.
    // TopoDS_Cast.Wire_1() and Translate() return references that Embind sees as
    // TopoDS_Shape, which causes AddWire() to throw a BindingError.
    try {
      let mw = new self.oc.BRepBuilderAPI_MakeWire_1();
      let edgeExp = new self.oc.TopExp_Explorer_2(wire, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (edgeExp.More()) {
        mw.Add_1(self.oc.TopoDS_Cast.Edge_1(edgeExp.Current()));
        edgeExp.Next();
      }
      return mw.Wire();
    } catch (e) {
      // If re-wrapping fails, return the original and let AddWire handle it
      return wire;
    }
  });
  let curLoft = self.CacheOp(arguments, "Loft", () => {
    let pipe = new self.oc.BRepOffsetAPI_ThruSections(true, false, 1.0e-6);
    resolvedWires.forEach((wire) => { pipe.AddWire(wire); });
    pipe.Build(new self.oc.Message_ProgressRange_1());
    return pipe.Shape();
  });

  wires.forEach((wire) => {
    if (!keepWires) { self.sceneShapes = self.Remove(self.sceneShapes, wire); }
  });
  self.sceneShapes.push(curLoft);
  return curLoft;
}

function Pipe(shape, wirePath, keepInputs) {
  if (!shape || shape.IsNull()) { console.error("Pipe: profile shape is null!"); return shape; }
  if (!wirePath || wirePath.IsNull()) { console.error("Pipe: wire path is null!"); return wirePath; }
  let curPipe = self.CacheOp(arguments, "Pipe", () => {
    let pipe = new self.oc.BRepOffsetAPI_MakePipe_1(wirePath, shape);
    pipe.Build(new self.oc.Message_ProgressRange_1());
    return pipe.Shape();
  });

  if (!keepInputs) {
    self.sceneShapes = self.Remove(self.sceneShapes, shape);
    self.sceneShapes = self.Remove(self.sceneShapes, wirePath);
  }
  self.sceneShapes.push(curPipe);
  return curPipe;
}

// --- Sketch Class (drawing utility) ---

function Sketch(startingPoint, plane) {
  this.currentIndex = 0;
  this.faces        = [];
  this.wires        = [];
  this.fillets      = [];
  this.argsString   = self.ComputeHash(arguments, true);

  // Plane support: 'XY' (default), 'XZ', 'YZ'
  this._plane = (typeof plane === 'string') ? plane.toUpperCase() : 'XY';
  this._toPnt = function (a, b) {
    if (this._plane === 'XZ') return new self.oc.gp_Pnt_3(a, 0, b);
    if (this._plane === 'YZ') return new self.oc.gp_Pnt_3(0, a, b);
    return new self.oc.gp_Pnt_3(a, b, 0);
  };
  this._getAB = function (pnt) {
    if (this._plane === 'XZ') return [pnt.X(), pnt.Z()];
    if (this._plane === 'YZ') return [pnt.Y(), pnt.Z()];
    return [pnt.X(), pnt.Y()];
  };
  this._normal = function () {
    if (this._plane === 'XZ') return new self.oc.gp_Dir_5(0, 1, 0);
    if (this._plane === 'YZ') return new self.oc.gp_Dir_5(1, 0, 0);
    return new self.oc.gp_Dir_5(0, 0, 1);
  };

  this.firstPoint   = this._toPnt(startingPoint[0], startingPoint[1]);
  this.lastPoint    = this.firstPoint;
  this.wireBuilder  = new self.oc.BRepBuilderAPI_MakeWire_1();

  this.Start = function (startingPoint) {
    this.firstPoint  = this._toPnt(startingPoint[0], startingPoint[1]);
    this.lastPoint   = this.firstPoint;
    this.wireBuilder = new self.oc.BRepBuilderAPI_MakeWire_1();
    this.argsString += self.ComputeHash(arguments, true);
    return this;
  }

  this.End = function (closed, reversed) {
    this.argsString += self.ComputeHash(arguments, true);

    if (closed) {
      let [fa, fb] = this._getAB(this.firstPoint);
      let [la, lb] = this._getAB(this.lastPoint);
      if (fa !== la || fb !== lb) { this.LineTo(this.firstPoint); }
    }

    let wire = this.wireBuilder.Wire();
    if (reversed) { wire = wire.Reversed(); }
    wire.hash = self.stringToHash(this.argsString);
    this.wires.push(wire);

    let faceBuilder = null;
    if (this.faces.length > 0) {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace_15(this.wires[0], false);
      for (let w = 1; w < this.wires.length; w++){
        faceBuilder.Add(this.wires[w]);
      }
    } else {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace_15(wire, false);
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

      let makeFillet = new self.oc.BRepFilletAPI_MakeFillet2d_2(this.faces[this.faces.length - 1]);
      ForEachVertex(this.faces[this.faces.length - 1], (vertex) => {
        let pnt = self.oc.BRep_Tool.Pnt(vertex);
        let [pa, pb] = this._getAB(pnt);
        for (let f = 0; f < this.fillets.length; f++) {
          if (!this.fillets[f].disabled &&
              pa === this.fillets[f].a &&
              pb === this.fillets[f].b ) {
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
    this.wireBuilder.Add_2(wire);
    if (endPoint) { this.lastPoint = endPoint; }
    return this;
  }

  this.LineTo = function (nextPoint) {
    this.argsString += self.ComputeHash(arguments, true);
    let endPoint = null;
    if (nextPoint.X) {
      let [la, lb] = this._getAB(this.lastPoint);
      let [na, nb] = this._getAB(nextPoint);
      if (la === na && lb === nb) { return this; }
      endPoint = nextPoint;
    } else {
      let [la, lb] = this._getAB(this.lastPoint);
      if (la === nextPoint[0] && lb === nextPoint[1]) { return this; }
      endPoint = this._toPnt(nextPoint[0], nextPoint[1]);
    }
    let lineSegment    = new self.oc.GC_MakeSegment_1(this.lastPoint, endPoint).Value();
    let lineEdge       = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(lineSegment.get())).Edge();
    this.wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(lineEdge       ).Wire ());
    this.lastPoint     = endPoint;
    this.currentIndex++;
    return this;
  }

  this.ArcTo = function (pointOnArc, arcEnd) {
    this.argsString += self.ComputeHash(arguments, true);
    let onArc          = this._toPnt(pointOnArc[0], pointOnArc[1]);
    let nextPoint      = this._toPnt(    arcEnd[0],     arcEnd[1]);
    let arcCurve       = new self.oc.GC_MakeArcOfCircle_4(this.lastPoint, onArc, nextPoint).Value();
    let arcEdge        = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(arcCurve.get())).Edge();
    this.wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(arcEdge).Wire());
    this.lastPoint     = nextPoint;
    this.currentIndex++;
    return this;
  }

  this.BezierTo = function (bezierControlPoints) {
    this.argsString += self.ComputeHash(arguments, true);
    let ptList = new self.oc.TColgp_Array1OfPnt_2(1, bezierControlPoints.length+1);
    ptList.SetValue(1, this.lastPoint);
    for (let bInd = 0; bInd < bezierControlPoints.length; bInd++){
      let cp = bezierControlPoints[bInd];
      let ctrlPoint = (cp.X) ? cp : this._toPnt(cp[0], cp[1]);
      ptList.SetValue(bInd + 2, ctrlPoint);
      this.lastPoint = ctrlPoint;
    }
    let cubicCurve     = new self.oc.Geom_BezierCurve_1(ptList);
    let lineEdge       = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(cubicCurve)).Edge();
    this.wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(lineEdge  ).Wire());
    this.currentIndex++;
    return this;
  }

  this.BSplineTo = function (bsplinePoints) {
    this.argsString += self.ComputeHash(arguments, true);
    let ptList = new self.oc.TColgp_Array1OfPnt_2(1, bsplinePoints.length+1);
    ptList.SetValue(1, this.lastPoint);
    for (let bInd = 0; bInd < bsplinePoints.length; bInd++){
      let cp = bsplinePoints[bInd];
      let ctrlPoint = (cp.X) ? cp : this._toPnt(cp[0], cp[1]);
      ptList.SetValue(bInd + 2, ctrlPoint);
      this.lastPoint = ctrlPoint;
    }
    let bsplineHandle  = new self.oc.GeomAPI_PointsToBSpline_2(ptList, 3, 8, (self.oc.GeomAbs_Shape ? self.oc.GeomAbs_Shape.GeomAbs_C2 : 2), 1.0e-3).Curve();
    let lineEdge       = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(bsplineHandle.get())).Edge();
    this.wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(lineEdge).Wire());
    this.currentIndex++;
    return this;
  }

  this.Fillet = function (radius) {
    this.argsString += self.ComputeHash(arguments, true);
    let [fa, fb] = this._getAB(this.lastPoint);
    this.fillets.push({ a: fa, b: fb, radius: radius });
    return this;
  }

  this.Circle = function (center, radius, reversed) {
    this.argsString += self.ComputeHash(arguments, true);
    let centerPnt = (center.X) ? center : this._toPnt(center[0], center[1]);
    let circle = new self.oc.GC_MakeCircle_2(new self.oc.gp_Ax2_4(centerPnt,
    this._normal()), radius).Value();
    let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(circle.get())).Edge();
    let wire = new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
    if (reversed) { wire = wire.Reversed(); }
    wire.hash = self.stringToHash(this.argsString);
    this.wires.push(wire);

    let faceBuilder = null;
    if (this.faces.length > 0) {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace_15(this.wires[0], false);
      for (let w = 1; w < this.wires.length; w++){
        faceBuilder.Add(this.wires[w]);
      }
    } else {
      faceBuilder = new self.oc.BRepBuilderAPI_MakeFace_15(wire, false);
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

// --- Internal Topology Helpers (used by selectors, not exported to user API) ---

function _edgeMidpoint(edge) {
  let curve = new self.oc.BRepAdaptor_Curve_2(edge);
  let midParam = (curve.FirstParameter() + curve.LastParameter()) / 2;
  let pnt = new self.oc.gp_Pnt_1();
  curve.D0(midParam, pnt);
  return [pnt.X(), pnt.Y(), pnt.Z()];
}

function _edgeLength(edge) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.LinearProperties(edge, props, false, false);
  return props.Mass();
}

function _edgeCurveType(edge) {
  let curve = new self.oc.BRepAdaptor_Curve_2(edge);
  let type = curve.GetType();
  let CT = self.oc.GeomAbs_CurveType;
  if (type === CT.GeomAbs_Line)        return "Line";
  if (type === CT.GeomAbs_Circle)      return "Circle";
  if (type === CT.GeomAbs_Ellipse)     return "Ellipse";
  if (type === CT.GeomAbs_Hyperbola)   return "Hyperbola";
  if (type === CT.GeomAbs_Parabola)    return "Parabola";
  if (type === CT.GeomAbs_BezierCurve) return "BezierCurve";
  if (type === CT.GeomAbs_BSplineCurve) return "BSplineCurve";
  return "Other";
}

function _edgeDirection(edge) {
  let curve = new self.oc.BRepAdaptor_Curve_2(edge);
  if (curve.GetType() !== self.oc.GeomAbs_CurveType.GeomAbs_Line) return null;
  let pnt = new self.oc.gp_Pnt_1();
  let vec = new self.oc.gp_Vec_1();
  curve.D1(curve.FirstParameter(), pnt, vec);
  return [vec.X(), vec.Y(), vec.Z()];
}

function _faceCentroid(face) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.SurfaceProperties_1(face, props, false, false);
  let c = props.CentreOfMass();
  return [c.X(), c.Y(), c.Z()];
}

function _faceArea(face) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.SurfaceProperties_1(face, props, false, false);
  return props.Mass();
}

function _faceNormal(face) {
  let surf = new self.oc.BRepAdaptor_Surface_2(face, true);
  let uMid = (surf.FirstUParameter() + surf.LastUParameter()) / 2;
  let vMid = (surf.FirstVParameter() + surf.LastVParameter()) / 2;
  let pnt = new self.oc.gp_Pnt_1();
  let du = new self.oc.gp_Vec_1();
  let dv = new self.oc.gp_Vec_1();
  surf.D1(uMid, vMid, pnt, du, dv);
  let normal = du.Crossed(dv);
  let mag = normal.Magnitude();
  if (mag < 1e-10) return [0, 0, 1];
  return [normal.X() / mag, normal.Y() / mag, normal.Z() / mag];
}

function _dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function _vecLength(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function _normalize(v) {
  let len = _vecLength(v);
  if (len < 1e-10) { throw new Error("Cannot normalize a zero-length vector; check your axis parameter"); }
  return [v[0] / len, v[1] / len, v[2] / len];
}

// --- Selector Classes ---

class EdgeSelector {
  constructor(shape) {
    this._entries = [];
    ForEachEdge(shape, (index, edge) => {
      this._entries.push({ index, edge });
    });
  }

  // --- Filtering ---

  ofType(type) {
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => _edgeCurveType(e.edge) === type);
    return sel;
  }

  parallel(axis, tolerance) {
    if (!tolerance) { tolerance = 1e-4; }
    let normAxis = _normalize(axis);
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let dir = _edgeDirection(e.edge);
      if (!dir) { return false; }
      let normDir = _normalize(dir);
      let dotVal = Math.abs(_dot(normDir, normAxis));
      return Math.abs(dotVal - 1.0) < tolerance;
    });
    return sel;
  }

  perpendicular(axis, tolerance) {
    if (!tolerance) { tolerance = 1e-4; }
    let normAxis = _normalize(axis);
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let dir = _edgeDirection(e.edge);
      if (!dir) { return false; }
      let normDir = _normalize(dir);
      let dotVal = Math.abs(_dot(normDir, normAxis));
      return dotVal < tolerance;
    });
    return sel;
  }

  atAngle(axis, degrees, tolerance) {
    if (!tolerance) { tolerance = 1.0; }
    let normAxis = _normalize(axis);
    let targetRad = degrees * Math.PI / 180;
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let dir = _edgeDirection(e.edge);
      if (!dir) { return false; }
      let normDir = _normalize(dir);
      let dotVal = Math.abs(_dot(normDir, normAxis));
      let angle = Math.acos(Math.min(1, dotVal)) * 180 / Math.PI;
      return Math.abs(angle - degrees) < tolerance;
    });
    return sel;
  }

  // --- Sorting & Positional ---

  sortBy(axis) {
    let normAxis = _normalize(axis);
    let sel = this._clone();
    sel._entries.sort((a, b) => {
      let ma = _edgeMidpoint(a.edge);
      let mb = _edgeMidpoint(b.edge);
      return _dot(ma, normAxis) - _dot(mb, normAxis);
    });
    return sel;
  }

  groupBy(axis, tolerance) {
    if (!tolerance) { tolerance = 1e-3; }
    let normAxis = _normalize(axis);
    let groups = [];
    let sorted = this.sortBy(axis)._entries;
    for (let i = 0; i < sorted.length; i++) {
      let pos = _dot(_edgeMidpoint(sorted[i].edge), normAxis);
      if (groups.length === 0 || Math.abs(pos - groups[groups.length - 1].pos) > tolerance) {
        groups.push({ pos, entries: [sorted[i]] });
      } else {
        groups[groups.length - 1].entries.push(sorted[i]);
      }
    }
    return groups;
  }

  max(axis) {
    let groups = this.groupBy(axis);
    if (groups.length === 0) { return this._empty(); }
    let sel = this._clone();
    sel._entries = groups[groups.length - 1].entries;
    return sel;
  }

  min(axis) {
    let groups = this.groupBy(axis);
    if (groups.length === 0) { return this._empty(); }
    let sel = this._clone();
    sel._entries = groups[0].entries;
    return sel;
  }

  // --- Property Filtering ---

  longerThan(length) {
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => _edgeLength(e.edge) > length);
    return sel;
  }

  shorterThan(length) {
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => _edgeLength(e.edge) < length);
    return sel;
  }

  withinBox(min, max) {
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let mid = _edgeMidpoint(e.edge);
      return mid[0] >= min[0] && mid[0] <= max[0] &&
             mid[1] >= min[1] && mid[1] <= max[1] &&
             mid[2] >= min[2] && mid[2] <= max[2];
    });
    return sel;
  }

  // --- Terminal Methods ---

  indices() {
    return this._entries.map(e => e.index);
  }

  edges() {
    return this._entries.map(e => e.edge);
  }

  count() {
    return this._entries.length;
  }

  first(n) {
    if (!n) { n = 1; }
    let sel = this._clone();
    sel._entries = sel._entries.slice(0, n);
    return sel;
  }

  last(n) {
    if (!n) { n = 1; }
    let sel = this._clone();
    sel._entries = sel._entries.slice(-n);
    return sel;
  }

  at(index) {
    if (index >= 0 && index < this._entries.length) {
      return this._entries[index].index;
    }
    return -1;
  }

  // --- Internal ---

  _clone() {
    let sel = new EdgeSelector.__empty();
    sel._entries = this._entries.slice();
    return sel;
  }

  _empty() {
    let sel = new EdgeSelector.__empty();
    sel._entries = [];
    return sel;
  }
}
// Private constructor bypass to avoid re-traversing shape
EdgeSelector.__empty = function() { this._entries = []; };
EdgeSelector.__empty.prototype = EdgeSelector.prototype;


class FaceSelector {
  constructor(shape) {
    this._entries = [];
    ForEachFace(shape, (index, face) => {
      this._entries.push({ index, face });
    });
  }

  // --- Filtering ---

  ofType(type) {
    let ST = self.oc.GeomAbs_SurfaceType;
    let typeMap = {
      "Plane": ST.GeomAbs_Plane,
      "Cylinder": ST.GeomAbs_Cylinder,
      "Cone": ST.GeomAbs_Cone,
      "Sphere": ST.GeomAbs_Sphere,
      "Torus": ST.GeomAbs_Torus,
      "BSplineSurface": ST.GeomAbs_BSplineSurface,
      "BezierSurface": ST.GeomAbs_BezierSurface,
    };
    let target = typeMap[type];
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let surf = new self.oc.BRepAdaptor_Surface_2(e.face, true);
      return surf.GetType() === target;
    });
    return sel;
  }

  parallel(axis, tolerance) {
    if (!tolerance) { tolerance = 1e-4; }
    let normAxis = _normalize(axis);
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let normal = _faceNormal(e.face);
      let dotVal = Math.abs(_dot(normal, normAxis));
      return Math.abs(dotVal - 1.0) < tolerance;
    });
    return sel;
  }

  perpendicular(axis, tolerance) {
    if (!tolerance) { tolerance = 1e-4; }
    let normAxis = _normalize(axis);
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => {
      let normal = _faceNormal(e.face);
      let dotVal = Math.abs(_dot(normal, normAxis));
      return dotVal < tolerance;
    });
    return sel;
  }

  // --- Sorting & Positional ---

  sortBy(axis) {
    let normAxis = _normalize(axis);
    let sel = this._clone();
    sel._entries.sort((a, b) => {
      let ca = _faceCentroid(a.face);
      let cb = _faceCentroid(b.face);
      return _dot(ca, normAxis) - _dot(cb, normAxis);
    });
    return sel;
  }

  max(axis) {
    let groups = this._groupBy(axis);
    if (groups.length === 0) { return this._empty(); }
    let sel = this._clone();
    sel._entries = groups[groups.length - 1].entries;
    return sel;
  }

  min(axis) {
    let groups = this._groupBy(axis);
    if (groups.length === 0) { return this._empty(); }
    let sel = this._clone();
    sel._entries = groups[0].entries;
    return sel;
  }

  // --- Property Filtering ---

  largerThan(area) {
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => _faceArea(e.face) > area);
    return sel;
  }

  smallerThan(area) {
    let sel = this._clone();
    sel._entries = sel._entries.filter(e => _faceArea(e.face) < area);
    return sel;
  }

  // --- Terminal Methods ---

  indices() {
    return this._entries.map(e => e.index);
  }

  faces() {
    return this._entries.map(e => e.face);
  }

  count() {
    return this._entries.length;
  }

  // --- Internal ---

  _groupBy(axis, tolerance) {
    if (!tolerance) { tolerance = 1e-3; }
    let normAxis = _normalize(axis);
    let groups = [];
    let sorted = this.sortBy(axis)._entries;
    for (let i = 0; i < sorted.length; i++) {
      let pos = _dot(_faceCentroid(sorted[i].face), normAxis);
      if (groups.length === 0 || Math.abs(pos - groups[groups.length - 1].pos) > tolerance) {
        groups.push({ pos, entries: [sorted[i]] });
      } else {
        groups[groups.length - 1].entries.push(sorted[i]);
      }
    }
    return groups;
  }

  _clone() {
    let sel = new FaceSelector.__empty();
    sel._entries = this._entries.slice();
    return sel;
  }

  _empty() {
    let sel = new FaceSelector.__empty();
    sel._entries = [];
    return sel;
  }
}
FaceSelector.__empty = function() { this._entries = []; };
FaceSelector.__empty.prototype = FaceSelector.prototype;


// --- Selector Entry Points ---

function Edges(shape) {
  return new EdgeSelector(shape);
}

function Faces(shape) {
  return new FaceSelector(shape);
}

// --- Measurement Functions ---

function Volume(shape) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  return props.Mass();
}

function SurfaceArea(shape) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.SurfaceProperties_1(shape, props, false, false);
  return props.Mass();
}

function CenterOfMass(shape) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  let c = props.CentreOfMass();
  return [c.X(), c.Y(), c.Z()];
}

function EdgeLength(shape) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.LinearProperties(shape, props, false, false);
  return props.Mass();
}

// --- Additional Primitives ---

function Wedge(dx, dy, dz, ltx) {
  let curWedge = self.CacheOp(arguments, "Wedge", () => {
    return new self.oc.BRepPrimAPI_MakeWedge_1(dx, dy, dz, ltx).Shape();
  });
  self.sceneShapes.push(curWedge);
  return curWedge;
}

// --- Section (Cross-Section) ---

function Section(shape, planeOrigin, planeNormal) {
  if (!planeNormal) { planeNormal = [0, 0, 1]; }
  if (!planeOrigin) { planeOrigin = [0, 0, 0]; }
  if (_vecLength(planeNormal) < 1e-10) { throw new Error("Section: planeNormal must be a non-zero vector"); }
  let curSection = self.CacheOp(arguments, "Section", () => {
    let origin = new self.oc.gp_Pnt_3(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
    let normal = new self.oc.gp_Dir_5(planeNormal[0], planeNormal[1], planeNormal[2]);
    let plane = new self.oc.gp_Pln_3(origin, normal);
    let section = new self.oc.BRepAlgoAPI_Section_5(shape, plane, false);
    section.Build(new self.oc.Message_ProgressRange_1());
    return section.Shape();
  });
  self.sceneShapes.push(curSection);
  return curSection;
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

    // Selectors
    self.Edges = Edges;
    self.Faces = Faces;
    self.EdgeSelector = EdgeSelector;
    self.FaceSelector = FaceSelector;

    // Measurement
    self.Volume = Volume;
    self.SurfaceArea = SurfaceArea;
    self.CenterOfMass = CenterOfMass;
    self.EdgeLength = EdgeLength;

    // Additional primitives & operations
    self.Wedge = Wedge;
    self.Section = Section;
  }
}

export { CascadeStudioStandardLibrary };
