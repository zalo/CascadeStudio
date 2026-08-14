import { createGordonEngine } from './GordonSurface.js';

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
import quickhull3d from 'quickhull3d';

// --- CAD API Functions ---
// These are regular function declarations (NOT class methods) to preserve
// `arguments.callee` access needed by CacheOp for hashing and progress tracking.

function Box(x, y, z, centered) {
  if (!centered) { centered = false;}
  let curBox = self.CacheOp(arguments, "Box", () => {
    let box = new self.oc.BRepPrimAPI_MakeBox_2(x, y, z).Shape();
    if (centered) {
      let centeredBox = Translate([-x / 2, -y / 2, -z / 2], box);
      // Translate() scene-registers its result, and Box pushes curBox below —
      // deregister the nested result so a cache miss doesn't double-add it
      // (same pattern as Text3D's internal Rotate/Extrude).
      self.sceneShapes = self.Remove(self.sceneShapes, centeredBox);
      return centeredBox;
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

/** Full or PARTIAL sphere (BRepPrimAPI_MakeSphere with two latitude angles
 *  and a longitude sweep, in DEGREES — build123d's Solid.make_sphere). */
function PartialSphere(radius, angle1, angle2, angle3) {
  let sphere = self.CacheOp(arguments, "PartialSphere", () => {
    let ax2 = new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(0, 0, 0), self.oc.gp.DZ());
    const rad = Math.PI / 180;
    return new self.oc.BRepPrimAPI_MakeSphere_12(
      ax2, radius, angle1 * rad, angle2 * rad, angle3 * rad).Shape();
  });
  self.sceneShapes.push(sphere);
  return sphere;
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

/** Kerning between two glyphs in font units, from the worker's own kern
 *  table parse (opentype.js misses multi-subtable kern tables). */
function _kernValue(fontName, leftGlyph, rightGlyph) {
  let pairs = self.fontKernPairs && self.fontKernPairs[fontName];
  if (!pairs) { return 0; }
  return pairs.get(leftGlyph.index + ',' + rightGlyph.index) || 0;
}

/** Convert an opentype.js glyph path (y-down canvas coords, baseline at 0)
 *  into a face-with-holes. Shared by Text3D and Text2D. Lays glyphs out
 *  itself (advance + kern-table pairs, like FreeType) instead of relying on
 *  opentype's getPath kerning. Returns the face, or null when the font is
 *  not loaded yet. */
function _opentypeTextFace(text, size, fontName, perGlyphCompound) {
    if (self.loadedFonts[fontName] === undefined) { for (let k in self.argCache) delete self.argCache[k]; console.log("Font not loaded or found yet!  Try again..."); return null; }
    let font = self.loadedFonts[fontName];
    let scale = size / font.unitsPerEm;
    let glyphCommandRuns = [];
    let penX = 0;
    let prevGlyph = null;
    for (const ch of text) {
      let glyph = font.charToGlyph(ch);
      if (prevGlyph) { penX += _kernValue(fontName, prevGlyph, glyph) * scale; }
      glyphCommandRuns.push(glyph.getPath(penX, 0, size).commands);
      penX += glyph.advanceWidth * scale;
      prevGlyph = glyph;
    }
    if (!perGlyphCompound) {
      return _textCommandsToFace([].concat.apply([], glyphCommandRuns));
    }
    // Per-glyph faces collected in a compound — the topology build123d's
    // Text produces (its faces() are the individual glyphs, with DISJOINT
    // outer contours as separate faces: the dot of an 'i'/'j' is its own
    // face, while nested contours like the counter of an 'o' stay holes).
    let glyphFaces = [];
    for (let g = 0; g < glyphCommandRuns.length; g++) {
      glyphFaces = glyphFaces.concat(_glyphContourFaces(glyphCommandRuns[g]));
    }
    if (glyphFaces.length === 0) { return null; }
    if (glyphFaces.length === 1) { return glyphFaces[0]; }
    let builder = new self.oc.BRep_Builder();
    let compound = new self.oc.TopoDS_Compound();
    builder.MakeCompound(compound);
    for (let g = 0; g < glyphFaces.length; g++) { builder.Add(compound, glyphFaces[g]); }
    compound.hash = self.oc.OCJS.HashCode(compound, 100000000);
    return compound;
}

/** Split one glyph's path commands into faces by contour winding: TrueType
 *  outlines wind outer contours one way and holes the other, so contours
 *  matching the first contour's winding start a NEW face and
 *  opposite-winding contours become holes of the most recent outer. This
 *  reproduces Font_BRepTextBuilder's topology (i/j dots are separate
 *  faces; o/a/d counters are holes). */
function _glyphContourFaces(commands) {
  let contours = [];
  let cur = null;
  for (let i = 0; i < commands.length; i++) {
    if (commands[i].type === "M") { cur = []; contours.push(cur); }
    if (cur) { cur.push(commands[i]); }
  }
  let signedArea = (cmds) => {
    let pts = [];
    for (let i = 0; i < cmds.length; i++) {
      if (cmds[i].x !== undefined) { pts.push([cmds[i].x, cmds[i].y]); }
    }
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      let p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  };
  let outerSign = null;
  let groups = [];
  for (let i = 0; i < contours.length; i++) {
    let s = Math.sign(signedArea(contours[i])) || 1;
    if (outerSign === null) { outerSign = s; }
    if (s === outerSign || groups.length === 0) {
      groups.push(contours[i].slice());
    } else {
      // hole: append to the most recent outer's command run
      let last = groups[groups.length - 1];
      for (let k = 0; k < contours[i].length; k++) { last.push(contours[i][k]); }
    }
  }
  let faces = [];
  for (let i = 0; i < groups.length; i++) {
    let f = _textCommandsToFace(groups[i]);
    if (f) { faces.push(f); }
  }
  return faces;
}

function _textCommandsToFace(commands) {
    let textFaces = [];
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
    return textFaces.length > 0 ? textFaces[textFaces.length - 1] : null;
}

function Text3D(text, size, height, fontName) {
  if (!size   ) { size    = 36; }
  if (!height && height !== 0.0) { height  = 0.15; }
  if (!fontName) { fontName = "Roboto"; }

  let textArgs = JSON.stringify(arguments);
  let curText = self.CacheOp(arguments, "Text3D", () => {
    let textFace = _opentypeTextFace(text, size, fontName);
    if (!textFace) { return; }
    if (height === 0) {
      return textFace;
    } else {
      textFace.hash = self.stringToHash(textArgs);
      let textSolid = Rotate([1, 0, 0], -90, Extrude(textFace, [0, 0, height * size]));
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
    let solid = self.oc.TopoDS_Cast.Solid_1(anExplorer.Current());
    // sub-shapes need a stable hash for CacheOp (see EdgeSelector)
    if (solid.hash === undefined) { solid.hash = self.oc.OCJS.HashCode(solid, 100000000); }
    callback(solid_index++, solid);
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
/** A face bounded by a wire. `onlyPlanar` forces BRepBuilderAPI's OnlyPlane
 *  mode, which build123d's Face(wire) always uses — without it the builder
 *  recovers whatever surface the wire's edges carry pcurves for, so the
 *  boundary of a freeform face rebuilds that same freeform face instead of
 *  capping it flat. */
function MakeFace(wire, keepWire, onlyPlanar) {
  if (!wire || wire.IsNull()) { console.error("MakeFace: input wire is null!"); return wire; }
  let face = self.CacheOp(arguments, "MakeFace", () => {
    let w = wire.ShapeType().value === 5 ? wire : self.oc.TopoDS_Cast.Wire_1(wire);
    return new self.oc.BRepBuilderAPI_MakeFace_15(w, !!onlyPlanar).Face();
  });

  if (!keepWire) { self.sceneShapes = self.Remove(self.sceneShapes, wire); }
  self.sceneShapes.push(face);
  return face;
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
          new self.oc.gp_Vec_4(axis[0], axis[1], axis[2]))), degrees * (Math.PI / 180));
      // Bake the rotation into the geometry (deep copy) instead of hanging a
      // TopLoc_Location on the shape: boolean ops in this WASM build silently
      // fail to fuse/cut shapes that carry rotation Locations (they come out
      // as unfused compounds), which broke e.g. subtracting a rotated copy.
      if (!self.isArrayLike(shapes)) {
        newRot = new self.oc.BRepBuilderAPI_Transform_2(shapes, transformation, true, false).Shape();
      } else if (shapes.length >= 1) {
        newRot = [];
        for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
          newRot.push(new self.oc.BRepBuilderAPI_Transform_2(shapes[shapeIndex], transformation, true, false).Shape());
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

    // Recover from the known 8.0.1 fuse operand-drop fault (see
    // _rebuildFuseFromGF above): a valid fuse can never be smaller than
    // its largest input.
    let maxInput = Math.max(...objectsToJoin.map(o => _quickVolume(o)));
    if (maxInput > 1e-6 && _quickVolume(combined) < maxInput * 0.999 - 1e-9) {
      let rebuilt = _rebuildFuseFromGF(objectsToJoin);
      if (rebuilt && _quickVolume(rebuilt) >= maxInput * 0.999 - 1e-9) {
        console.log("Union: BRepAlgoAPI_Fuse dropped an operand (known OCCT 8.0.1 wasm fault); rebuilt the union from the General-Fuse partition.");
        combined = rebuilt;
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

// KNOWN OCCT 8.0.1 wasm kernel fault: BRepAlgoAPI_Fuse's result-ASSEMBLY
// phase can silently DROP an operand when coplanar faces meet along BSpline
// edges (e.g. font glyphs extruded off a planar face). The defaults audit
// (test/b123d-validation/report.md) showed upstream build123d/OCP defaults
// (no fuzzy value, no NonDestructive) reproduce the drop identically — but
// the General-Fuse SPLIT phase is correct on the same inputs. So fall back
// to the exact GF partition: a compound of disjoint-interior solids whose
// union IS the fuse result (volumes/bboxes exact). COMPROMISE(kernel-guard):
// the partition keeps the internal contact faces (the operands are not
// merged into one solid), so face/edge selectors see the contact topology.
function _rebuildFuseFromGF(shapes) {
  try {
    let op = new self.oc.BOPAlgo_Builder_1();
    for (let i = 0; i < shapes.length; i++) { op.AddArgument(shapes[i]); }
    op.Perform(new self.oc.Message_ProgressRange_1());
    if (op.HasErrors()) { return null; }
    let gf = op.Shape();
    let sawSolid = false;
    ForEachSolid(gf, () => { sawSolid = true; });
    return sawSolid ? gf : null;
  } catch (e) { return null; }
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

/** ShapeUpgrade_UnifySameDomain — build123d's Shape.clean(). `concat` also
 *  concatenates tangent-continuous B-spline/Bezier edges into one curve.
 *  The result is re-typed as a face/wire when it is one, so face/wire APIs
 *  keep working on it. */
function UnifyWire(shape, concat) {
  let fusor = new self.oc.ShapeUpgrade_UnifySameDomain_2(shape, true, true, !!concat);
  fusor.Build();
  let out = fusor.Shape();
  if (out.ShapeType().value === 4) { out = self.oc.TopoDS_Cast.Face_1(out); }
  else if (out.ShapeType().value === 5) { out = self.oc.TopoDS_Cast.Wire_1(out); }
  out.hash = self.oc.OCJS.HashCode(out, 100000000);
  return out;
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

function Offset(shape, offsetDistance, tolerance, keepShape, joinType) {
  if (!shape || shape.IsNull()) { console.error("Offset: input shape is null!"); return shape; }
  if (!tolerance) { tolerance = 0.1; }
  if (offsetDistance === 0.0) { return shape; }
  let join = joinType === 'intersection'
    ? self.oc.GeomAbs_JoinType.GeomAbs_Intersection
    : self.oc.GeomAbs_JoinType.GeomAbs_Arc;
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
      offset = new self.oc.BRepOffsetAPI_MakeOffset_2(face, join, false);
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
      offset.PerformByJoin(shape, offsetDistance, tolerance, self.oc.BRepOffset_Mode.BRepOffset_Skin, false, false, join, false, new self.oc.Message_ProgressRange_1());
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

function OffsetWire(wire, offsetDistance, keepWire) {
  if (!wire || wire.IsNull()) { console.error("OffsetWire: input wire is null!"); return wire; }
  if (!offsetDistance || offsetDistance <= 0) { console.error("OffsetWire: offsetDistance must be positive!"); return wire; }

  let result = self.CacheOp(arguments, "OffsetWire", () => {
    // BRepOffsetAPI_MakeOffset on an open wire automatically produces a closed
    // contour: both sides offset + semicircular arc end caps.
    let offset = new self.oc.BRepOffsetAPI_MakeOffset_1();
    offset.AddWire(wire);
    offset.Perform(offsetDistance);
    return self.oc.TopoDS_Cast.Wire_1(offset.Shape());
  });

  if (!keepWire) { self.sceneShapes = self.Remove(self.sceneShapes, wire); }
  self.sceneShapes.push(result);
  return result;
}

/** BRepOffsetAPI_MakeOffset on a planar wire with an explicit join type —
 *  the exact construction of build123d's Wire.offset_2d (Init(kind) +
 *  AddWire + Perform). For an OPEN wire the result is a closed contour: both
 *  offset sides plus round end caps, which the caller can split per side. */
function OffsetPlanarWire(wire, offsetDistance, joinType) {
  let join = joinType === 'intersection'
    ? self.oc.GeomAbs_JoinType.GeomAbs_Intersection
    : self.oc.GeomAbs_JoinType.GeomAbs_Arc;
  let result = self.CacheOp(arguments, "OffsetPlanarWire", () => {
    let offset = new self.oc.BRepOffsetAPI_MakeOffset_1();
    offset.Init_2(join, false);
    offset.AddWire(_asWire(wire));
    offset.Perform(offsetDistance, 0.0);
    let out = offset.Shape();
    if (out.ShapeType().value === 5) { return self.oc.TopoDS_Cast.Wire_1(out); }
    let wires = [];
    ForEachWire(out, (i, wr) => { wires.push(wr); });
    if (wires.length !== 1) {
      console.error("OffsetPlanarWire: expected one offset wire, got " + wires.length);
      return null;
    }
    return wires[0];
  });
  if (result) { self.sceneShapes.push(result); }
  return result;
}

/** Center of a circular/elliptical edge, or null (build123d Edge.arc_center). */
function _edgeArcCenter(edge) {
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
  let CT = self.oc.GeomAbs_CurveType;
  let type = curve.GetType();
  let loc = null;
  if (type === CT.GeomAbs_Circle) { loc = curve.Circle().Location(); }
  else if (type === CT.GeomAbs_Ellipse) { loc = curve.Ellipse().Location(); }
  if (loc === null) { return null; }
  return [loc.X(), loc.Y(), loc.Z()];
}

/** An EXACT B-spline edge from poles, unique knots + multiplicities, degree and
 *  optional weights (build123d's Edge.make_bspline -> Geom_BSplineCurve). */
function BSplineEdge(poles, knots, mults, degree, weights, periodic) {
  return self.CacheOp(arguments, "BSplineEdge", () => {
    let poleArr = new self.oc.TColgp_Array1OfPnt_2(1, poles.length);
    for (let i = 0; i < poles.length; i++) {
      poleArr.SetValue(i + 1, new self.oc.gp_Pnt_3(poles[i][0], poles[i][1], poles[i][2] || 0));
    }
    let knotArr = new self.oc.TColStd_Array1OfReal_2(1, knots.length);
    for (let i = 0; i < knots.length; i++) { knotArr.SetValue(i + 1, knots[i]); }
    let multArr = new self.oc.TColStd_Array1OfInteger_2(1, mults.length);
    for (let i = 0; i < mults.length; i++) { multArr.SetValue(i + 1, mults[i]); }
    let spline;
    if (weights && weights.length) {
      let weightArr = new self.oc.TColStd_Array1OfReal_2(1, weights.length);
      for (let i = 0; i < weights.length; i++) { weightArr.SetValue(i + 1, weights[i]); }
      spline = new self.oc.Geom_BSplineCurve_2(poleArr, weightArr, knotArr, multArr,
        degree, !!periodic, false);
    } else {
      spline = new self.oc.Geom_BSplineCurve_1(poleArr, knotArr, multArr, degree, !!periodic);
    }
    return new self.oc.BRepBuilderAPI_MakeEdge_24(
      new self.oc.Handle_Geom_Curve_2(spline)).Edge();
  });
}

/** The order-th derivative of an edge's curve at the normalized arc-length
 *  position u — build123d's Mixin1D.derivative_at (BRepAdaptor_Curve::DN at
 *  the same GCPnts_AbscissaPoint parameter position_at uses). NOT normalized:
 *  the magnitude carries the curve's natural "speed", which is what
 *  BlendCurve's tangent scalars scale. */
function _edgeDerivativeAt(edge, u, order) {
  let e = _asEdge(edge);
  let curve = new self.oc.BRepAdaptor_Curve_2(e);
  let vec = curve.DN(_edgeParamAtFraction(curve, u), order);
  return [vec.X(), vec.Y(), vec.Z()];
}

/** Normal of a circular/elliptical edge: its gp_Circ/gp_Elips axis direction
 *  (build123d Mixin1D.normal's conic branch). null for any other curve type —
 *  the caller falls back to a planarity check. */
function _edgeArcNormal(edge) {
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
  let CT = self.oc.GeomAbs_CurveType;
  let type = curve.GetType();
  let dir = null;
  if (type === CT.GeomAbs_Circle) { dir = curve.Circle().Axis().Direction(); }
  else if (type === CT.GeomAbs_Ellipse) { dir = curve.Ellipse().Axis().Direction(); }
  if (dir === null) { return null; }
  return [dir.X(), dir.Y(), dir.Z()];
}

/** Radius of a circular edge, or null when the edge is not a circle
 *  (build123d Edge.radius). */
function _edgeArcRadius(edge) {
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
  if (curve.GetType() !== self.oc.GeomAbs_CurveType.GeomAbs_Circle) { return null; }
  return curve.Circle().Radius();
}

/** A circle or circular ARC edge on a plane given by origin/normal/x-dir,
 *  angles in DEGREES measured from the x direction (build123d
 *  Edge.make_circle; start == end means a full circle). */
function CircularEdge(radius, startAngle, endAngle, origin, normal, xDir) {
  return self.CacheOp(arguments, "CircularEdge", () => {
    let ax2 = new self.oc.gp_Ax2_2(
      new self.oc.gp_Pnt_3(origin[0], origin[1], origin[2]),
      new self.oc.gp_Dir_5(normal[0], normal[1], normal[2]),
      new self.oc.gp_Dir_5(xDir[0], xDir[1], xDir[2]));
    let circle = new self.oc.gp_Circ_2(ax2, radius);
    if (Math.abs(startAngle - endAngle) % 360 < 1e-9) {
      return new self.oc.BRepBuilderAPI_MakeEdge_8(circle).Edge();
    }
    const rad = Math.PI / 180;
    return new self.oc.BRepBuilderAPI_MakeEdge_9(
      circle, startAngle * rad, endAngle * rad).Edge();
  });
}

/** build123d's Edge.is_interior: an edge is INTERIOR when the two faces
 *  meeting at it, each offset outward by length/100, still intersect in an
 *  edge (an exterior/convex edge's offsets separate). Exactly upstream's
 *  construction (topo_explore_connected_faces + offset_topods_face +
 *  BRepAlgoAPI_Section). */
function EdgeIsInterior(edge, parentShape) {
  let e = _asEdge(edge);
  let faces = [];
  let source = parentShape || e;
  if (parentShape) {
    // faces of the parent that contain this edge
    let target = self.oc.OCJS.HashCode(e, 100000000);
    ForEachFace(parentShape, (i, face) => {
      let found = false;
      ForEachEdge(face, (j, fe) => {
        if (self.oc.OCJS.HashCode(fe, 100000000) === target) { found = true; }
      });
      if (found) { faces.push(face); }
    });
  }
  if (faces.length !== 2) { return false; }
  let dist = _edgeLength(e) / 100;
  let offsets = [];
  for (let i = 0; i < 2; i++) {
    // BRepOffset_MakeOffset (upstream's offset_topods_face) is unbound here;
    // BRepOffsetAPI_MakeOffsetShape drives the same BRepOffset algorithm
    let mk = new self.oc.BRepOffsetAPI_MakeOffsetShape();
    mk.PerformByJoin(faces[i], dist, 1e-6,
      self.oc.BRepOffset_Mode.BRepOffset_Skin, false, false,
      self.oc.GeomAbs_JoinType.GeomAbs_Arc, false,
      new self.oc.Message_ProgressRange_1());
    offsets.push(mk.Shape());
  }
  let section = new self.oc.BRepAlgoAPI_Section_3(offsets[0], offsets[1], false);
  section.Build(new self.oc.Message_ProgressRange_1());
  let found = false;
  ForEachEdge(section.Shape(), () => { found = true; });
  return found;
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
        degrees * (Math.PI / 180), copy).Shape();
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
        20 * Math.sin(alpha * rotation * (Math.PI / 180)),
        20 * Math.cos(alpha * rotation * (Math.PI / 180)),
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
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
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
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
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
  // respect the face's topological orientation (outward normals on solids)
  let flip = face.Orientation_1() === self.oc.TopAbs_Orientation.TopAbs_REVERSED ? -1 : 1;
  return [flip * normal.X() / mag, flip * normal.Y() / mag, flip * normal.Z() / mag];
}

/** The x direction build123d's Plane(face) derives: for elementary surfaces
 *  the underlying gp_Ax3's XDirection (surface.Position().XDirection()); for
 *  bounded surfaces (BSpline/Bezier/trimmed) the U derivative at RAW surface
 *  parameters (0.5, 0.5) — exactly geometry.py's Plane.__init__ Face branch. */
function _faceUDir(face) {
  let f = face.ShapeType && face.ShapeType().value === 4 ? self.oc.TopoDS_Cast.Face_1(face) : face;
  let surf = new self.oc.BRepAdaptor_Surface_2(f, false);
  let ST = self.oc.GeomAbs_SurfaceType;
  let type = surf.GetType();
  if (type === ST.GeomAbs_Plane) {
    let xd = surf.Plane().Position().XDirection();
    return [xd.X(), xd.Y(), xd.Z()];
  }
  let pnt = new self.oc.gp_Pnt_1();
  let du = new self.oc.gp_Vec_1();
  let dv = new self.oc.gp_Vec_1();
  if (type === ST.GeomAbs_BSplineSurface || type === ST.GeomAbs_BezierSurface) {
    // Geom_BoundedSurface: build123d evaluates D1 at raw (0.5, 0.5)
    surf.D1(0.5, 0.5, pnt, du, dv);
  } else {
    let uMid = (surf.FirstUParameter() + surf.LastUParameter()) / 2;
    let vMid = (surf.FirstVParameter() + surf.LastVParameter()) / 2;
    surf.D1(uMid, vMid, pnt, du, dv);
  }
  let mag = du.Magnitude();
  if (mag < 1e-10) return null;
  return [du.X() / mag, du.Y() / mag, du.Z() / mag];
}

/** TopoDS_Face view of a shape that IS a face but may still be typed as a
 *  generic TopoDS_Shape (everything that comes back from a transform or a
 *  boolean is). Single-face shells/compounds resolve to their one face: the
 *  extrusion of a wire is a SHELL even when build123d calls the result a
 *  Face, and build123d's face APIs work on it all the same. */
function _asFace(face) {
  if (face.ShapeType().value === 4) { return self.oc.TopoDS_Cast.Face_1(face); }
  let found = [];
  ForEachFace(face, (i, f) => { found.push(f); });
  if (found.length === 1) { return found[0]; }
  throw new Error("expected a single face, got a shape with " + found.length + " faces");
}

/** The face's UV parameter bounds, [uMin, uMax, vMin, vMax] (BRepTools::
 *  UVBounds) — build123d's Face._uv_bounds, the domain its normalized u/v
 *  arguments are mapped into. */
function _faceUVBounds(face) {
  let u1 = { current: 0 }, u2 = { current: 0 }, v1 = { current: 0 }, v2 = { current: 0 };
  self.oc.BRepTools.UVBounds_1(_asFace(face), u1, u2, v1, v2);
  return [u1.current, u2.current, v1.current, v2.current];
}

/** Point and U/V partial derivatives of the face's underlying surface at RAW
 *  surface parameters: [[x,y,z], [dU], [dV]] — the D1 evaluation
 *  build123d's Face.location_at performs (Restriction=false, so the RAW
 *  surface parameterization, exactly like BRep_Tool::Surface). */
function _faceD1(face, u, v) {
  let surf = new self.oc.BRepAdaptor_Surface_2(_asFace(face), false);
  let pnt = new self.oc.gp_Pnt_1();
  let du = new self.oc.gp_Vec_1();
  let dv = new self.oc.gp_Vec_1();
  surf.D1(u, v, pnt, du, dv);
  return [[pnt.X(), pnt.Y(), pnt.Z()],
          [du.X(), du.Y(), du.Z()],
          [dv.X(), dv.Y(), dv.Z()]];
}

/** RAW (u, v) surface parameters of the point of the face's surface closest to
 *  `point` — what build123d reads out of GeomAPI_ProjectPointOnSurf for the
 *  surface_point overloads of normal_at/location_at. `hint` ([u, v]) seeds the
 *  search when the caller already knows roughly where the point lands.
 *
 *  COMPROMISE(point-projection): GeomAPI_ProjectPointOnSurf cannot be
 *  instantiated in this wasm build — every one of its constructors/Init
 *  overloads takes an Extrema_ExtAlgo, and that enum is unbound
 *  ("unbound types: 15Extrema_ExtAlgo"). This is a coarse UV grid search
 *  refined by Newton iterations on grad|S(u,v) - P|^2 = 0, which reaches the
 *  same parameters to machine precision for points on or near the surface.
 *  Unlike OCCT it searches only the face's own UV box (clamped), not the
 *  infinite underlying surface. */
function _faceParamsAtPoint(face, point, hint) {
  let f = _asFace(face);
  let surf = new self.oc.BRepAdaptor_Surface_2(f, false);
  let bounds = _faceUVBounds(f);
  let uMin = bounds[0], uMax = bounds[1], vMin = bounds[2], vMax = bounds[3];
  let px = point[0], py = point[1], pz = point[2];
  let pnt = new self.oc.gp_Pnt_1();
  let d1u = new self.oc.gp_Vec_1(), d1v = new self.oc.gp_Vec_1();
  let d2u = new self.oc.gp_Vec_1(), d2v = new self.oc.gp_Vec_1(), d2uv = new self.oc.gp_Vec_1();
  let dist2 = (u, v) => {
    surf.D0(u, v, pnt);
    let dx = pnt.X() - px, dy = pnt.Y() - py, dz = pnt.Z() - pz;
    return dx * dx + dy * dy + dz * dz;
  };
  let bu, bv;
  if (hint) {
    bu = Math.min(uMax, Math.max(uMin, hint[0]));
    bv = Math.min(vMax, Math.max(vMin, hint[1]));
  } else {
    const N = 24;
    let best = Infinity;
    for (let i = 0; i <= N; i++) {
      let u = uMin + (uMax - uMin) * (i / N);
      for (let j = 0; j <= N; j++) {
        let v = vMin + (vMax - vMin) * (j / N);
        let d = dist2(u, v);
        if (d < best) { best = d; bu = u; bv = v; }
      }
    }
    if (best === Infinity) { return null; }
  }
  let dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let iter = 0; iter < 40; iter++) {
    surf.D2(bu, bv, pnt, d1u, d1v, d2u, d2v, d2uv);
    let fv = [pnt.X() - px, pnt.Y() - py, pnt.Z() - pz];
    let su = [d1u.X(), d1u.Y(), d1u.Z()], sv = [d1v.X(), d1v.Y(), d1v.Z()];
    let suu = [d2u.X(), d2u.Y(), d2u.Z()], svv = [d2v.X(), d2v.Y(), d2v.Z()];
    let suv = [d2uv.X(), d2uv.Y(), d2uv.Z()];
    let g0 = dot(fv, su), g1 = dot(fv, sv);
    let a = dot(su, su) + dot(fv, suu);
    let b = dot(su, sv) + dot(fv, suv);
    let c = dot(sv, sv) + dot(fv, svv);
    let det = a * c - b * b;
    let du, dv;
    if (Math.abs(det) < 1e-30) {
      // singular Hessian (degenerate/ruled directions): plain gradient step
      // scaled by the first fundamental form
      du = dot(su, su) > 1e-30 ? -g0 / dot(su, su) : 0;
      dv = dot(sv, sv) > 1e-30 ? -g1 / dot(sv, sv) : 0;
    } else {
      du = (b * g1 - c * g0) / det;
      dv = (b * g0 - a * g1) / det;
    }
    // backtracking so the residual never grows, clamped into the UV box
    let cur = dot(fv, fv);
    let t = 1.0, stepped = false;
    for (let k = 0; k < 24; k++) {
      let nu = Math.min(uMax, Math.max(uMin, bu + t * du));
      let nv = Math.min(vMax, Math.max(vMin, bv + t * dv));
      if (dist2(nu, nv) <= cur + 1e-18) {
        stepped = Math.abs(nu - bu) > 1e-14 * (1 + Math.abs(bu)) ||
                  Math.abs(nv - bv) > 1e-14 * (1 + Math.abs(bv));
        bu = nu; bv = nv;
        break;
      }
      t *= 0.5;
    }
    if (!stepped) { break; }
  }
  return [bu, bv];
}

/** Unit surface normal at RAW (u, v) parameters, respecting the face's
 *  topological orientation (BRepGProp_Face::Normal) — build123d's
 *  Face.normal_at. */
function _faceNormalAt(face, u, v) {
  let props = new self.oc.BRepGProp_Face_2(_asFace(face), false);
  let pnt = new self.oc.gp_Pnt_1();
  let nrm = new self.oc.gp_Vec_1();
  props.Normal(u, v, pnt, nrm);
  let mag = nrm.Magnitude();
  if (mag < 1e-12) { return [0, 0, 1]; }
  return [nrm.X() / mag, nrm.Y() / mag, nrm.Z() / mag];
}

function _faceSurfaceType(face) {
  let surf = new self.oc.BRepAdaptor_Surface_2(face, true);
  let type = surf.GetType();
  let ST = self.oc.GeomAbs_SurfaceType;
  if (type === ST.GeomAbs_Plane)          return "Plane";
  if (type === ST.GeomAbs_Cylinder)       return "Cylinder";
  if (type === ST.GeomAbs_Cone)           return "Cone";
  if (type === ST.GeomAbs_Sphere)         return "Sphere";
  if (type === ST.GeomAbs_Torus)          return "Torus";
  if (type === ST.GeomAbs_BezierSurface)  return "BezierSurface";
  if (type === ST.GeomAbs_BSplineSurface) return "BSplineSurface";
  return "Other";
}

/** The face's outer boundary wire (BRepTools::OuterWire). */
function _faceOuterWire(face) {
  let f = face.ShapeType().value === 4 ? self.oc.TopoDS_Cast.Face_1(face) : face;
  let wire = self.oc.BRepTools.OuterWire(f);
  if (wire.hash === undefined) { wire.hash = self.oc.OCJS.HashCode(wire, 100000000); }
  return wire;
}

/** Whether an edge's topological orientation is FORWARD (build123d's
 *  Edge.is_forward — position_at/tangent_at flip on REVERSED edges). */
function _edgeIsForward(edge) {
  return _asEdge(edge).Orientation_1() !== self.oc.TopAbs_Orientation.TopAbs_REVERSED;
}

/** TopoDS_Shape::IsSame across the Brython boundary. */
function _sameShape(a, b) {
  return a.IsSame(b);
}

function _vertexPoint(vertex) {
  let p = self.oc.BRep_Tool.Pnt(vertex);
  return [p.X(), p.Y(), p.Z()];
}

/** Curve parameter at the given ARC-LENGTH fraction u of an edge —
 *  GCPnts_AbscissaPoint, matching build123d's default
 *  PositionMode.LENGTH for position_at/tangent_at. (Raw parameter
 *  fraction only coincides with this for uniform-speed curves like
 *  lines and circles; it diverges on BSplines, e.g. surface-surface
 *  intersection curves.) */
function _edgeParamAtFraction(curve, u) {
  let first = curve.FirstParameter();
  let last = curve.LastParameter();
  if (u <= 0) { return first; }
  if (u >= 1) { return last; }
  let len = self.oc.GCPnts_AbscissaPoint.Length_5(curve, first, last);
  let ap = new self.oc.GCPnts_AbscissaPoint_2(curve, len * u, first);
  if (ap.IsDone()) { return ap.Parameter(); }
  return first + (last - first) * u;
}

function _edgePointAt(edge, u) {
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
  let param = _edgeParamAtFraction(curve, u);
  let pnt = new self.oc.gp_Pnt_1();
  curve.D0(param, pnt);
  return [pnt.X(), pnt.Y(), pnt.Z()];
}

function _edgeTangentAt(edge, u) {
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
  let param = _edgeParamAtFraction(curve, u);
  let pnt = new self.oc.gp_Pnt_1();
  let vec = new self.oc.gp_Vec_1();
  curve.D1(param, pnt, vec);
  let mag = vec.Magnitude();
  if (mag < 1e-12) { return [0, 0, 0]; }
  return [vec.X() / mag, vec.Y() / mag, vec.Z() / mag];
}

/** 2D fillet of a planar face's corner vertices (BRepFilletAPI_MakeFillet2d).
 *  `points` selects vertices by position ([[x,y,z], ...], 1e-6 tolerance);
 *  pass null to fillet every corner. Returns the new face. */
function FilletFace2D(face, radius, points, keepFace) {
  if (!face || face.IsNull()) { console.error("FilletFace2D: input face is null!"); return face; }
  let result = self.CacheOp(arguments, "FilletFace2D", () => {
    let f = face.ShapeType().value === 4 ? self.oc.TopoDS_Cast.Face_1(face) : face;
    let mkFillet = new self.oc.BRepFilletAPI_MakeFillet2d_2(f);
    let seen = {};
    let added = 0;
    ForEachVertex(f, (vertex) => {
      let p = self.oc.BRep_Tool.Pnt(vertex);
      let key = p.X().toFixed(6) + "," + p.Y().toFixed(6) + "," + p.Z().toFixed(6);
      if (seen[key]) { return; }
      let wanted = !points;
      if (points) {
        for (let i = 0; i < points.length; i++) {
          if (Math.abs(points[i][0] - p.X()) < 1e-6 &&
              Math.abs(points[i][1] - p.Y()) < 1e-6 &&
              Math.abs((points[i][2] || 0) - p.Z()) < 1e-6) { wanted = true; break; }
        }
      }
      if (wanted) { seen[key] = true; mkFillet.AddFillet(vertex, radius); added++; }
    });
    if (added === 0) {
      console.error("FilletFace2D: no vertices matched — nothing filleted.");
      return face;
    }
    mkFillet.Build(new self.oc.Message_ProgressRange_1());
    return mkFillet.Shape();
  });
  if (!keepFace) { self.sceneShapes = self.Remove(self.sceneShapes, face); }
  self.sceneShapes.push(result);
  return result;
}

/** Reverse a face's topological orientation (flips the oriented normal),
 *  returning a properly-typed TopoDS_Face. */
function ReverseFace(face, keepFace) {
  let reversed = self.oc.TopoDS_Cast.Face_1(face.Reversed());
  reversed.hash = self.oc.OCJS.HashCode(reversed, 100000000);
  if (!keepFace) { self.sceneShapes = self.Remove(self.sceneShapes, face); }
  self.sceneShapes.push(reversed);
  return reversed;
}

// ---------------------------------------------------------------------------
// Curve-on-surface primitives for build123d-lite's wrap()/wrap_faces(): the
// exact OCCT calls upstream's Face._wrap_edge / _wrap_wire / _wrap_face and
// Edge._extend_spline / trim / param_at make.
// ---------------------------------------------------------------------------

function _asEdge(shape) {
  return shape.ShapeType().value === 6 ? self.oc.TopoDS_Cast.Edge_1(shape) : shape;
}

/** Curve parameter at an arc-length FRACTION of an edge, allowing fractions
 *  outside [0, 1] (build123d's Edge.param_at, which _extend_spline calls with
 *  -0.1 / 1.1 to run past the ends). */
function _edgeParam(edge, u) {
  let curve = new self.oc.BRepAdaptor_Curve_2(_asEdge(edge));
  let first = curve.FirstParameter(), last = curve.LastParameter();
  let len = self.oc.GCPnts_AbscissaPoint.Length_5(curve, first, last);
  let ap = new self.oc.GCPnts_AbscissaPoint_2(curve, len * u, first);
  if (ap.IsDone()) { return ap.Parameter(); }
  return first + (last - first) * u;
}

/** The part of an edge between two arc-length fractions (build123d
 *  Edge.trim), oriented from f0 towards f1. */
function TrimEdge(edge, f0, f1) {
  let e = _asEdge(edge);
  let p0 = _edgeParam(e, f0), p1 = _edgeParam(e, f1);
  let first = { current: 0 }, last = { current: 0 };
  let curve = self.oc.BRep_Tool.Curve_2(e, first, last);
  let lo = Math.min(p0, p1), hi = Math.max(p0, p1);
  let trimmed = new self.oc.BRepBuilderAPI_MakeEdge_25(curve, lo, hi).Edge();
  if (p1 < p0) { trimmed = self.oc.TopoDS_Cast.Edge_1(trimmed.Reversed()); }
  trimmed.hash = self.oc.OCJS.HashCode(trimmed, 100000000);
  self.sceneShapes.push(trimmed);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Canonical free-edge parametrization primitives (build123d-lite's
// Mixin1D.canonical — see the upstream proposal in
// docs/upstream-canonical-edges/). The rule itself is pure geometry and lives
// in Python (Build123dLite.js); these are the four kernel operations it needs:
// reverse a 1D shape, locate a point on an edge, measure a point's distance to
// an edge, and concatenate an ordered edge chain into ONE edge (which is what
// gives a re-seamed closed loop an unambiguous start point).
// ---------------------------------------------------------------------------

/** Reverse the topological orientation of an Edge or a Wire, keeping the
 *  concrete TopoDS type (build123d's Edge.reversed / _reverse_1d). */
function ReverseEdgeOrWire(shape) {
  let reversed = shape.Reversed();
  let kind = shape.ShapeType().value;
  if (kind === 6) { reversed = self.oc.TopoDS_Cast.Edge_1(reversed); }
  else if (kind === 5) { reversed = self.oc.TopoDS_Cast.Wire_1(reversed); }
  reversed.hash = self.oc.OCJS.HashCode(reversed, 100000000);
  self.sceneShapes.push(reversed);
  return reversed;
}

/** Minimal distance between two shapes and the closest point ON EACH
 *  (BRepExtrema_DistShapeShape) — build123d's
 *  Shape.distance_to_with_closest_points / closest_points / distance.
 *  Returns [distance, [x1, y1, z1], [x2, y2, z2]], or null when the extrema
 *  algorithm finds no solution. */
function _distShapeShape(shapeA, shapeB) {
  let ext = new self.oc.BRepExtrema_DistShapeShape_1();
  ext.LoadS1(shapeA);
  ext.LoadS2(shapeB);
  ext.Perform(new self.oc.Message_ProgressRange_1());
  if (!ext.IsDone() || ext.NbSolution() < 1) { return null; }
  let p1 = ext.PointOnShape1(1), p2 = ext.PointOnShape2(1);
  return [ext.Value(), [p1.X(), p1.Y(), p1.Z()], [p2.X(), p2.Y(), p2.Z()]];
}

/** Sign of a face's curvature relative to its OWN geometry, for the three
 *  surface types build123d's Face.is_circular_convex/_concave support
 *  (cylinder, sphere, torus): positive = convex, negative = concave, 0 for
 *  every other surface type — build123d's Face._curvature_sign.
 *
 *  COMPROMISE(curvature-sign): upstream reads the surface's own reference
 *  geometry (gp_Cylinder's axis, gp_Sphere's centre, the core circle of a
 *  gp_Torus) and dots `normal_at() . (center - reference)`. gp_Cylinder /
 *  gp_Sphere / gp_Torus are UNBOUND in this wasm build (Adaptor3d_Surface
 *  declares the accessors, but their return types were never registered), so
 *  the same sign is taken from the second fundamental form instead: for a
 *  point P with oriented unit normal N, `S_dd . N < 0` exactly when the centre
 *  of curvature along d lies opposite N, i.e. when the surface is convex — and
 *  `normal . (P - reference)` is that same comparison for these three
 *  quadrics. The parameter direction with the LARGER |curvature| is the one
 *  upstream references (the circular direction of a cylinder, whose other
 *  direction is straight; the tube/minor direction of a torus, which is
 *  exactly upstream's core-circle reference). */
function _faceCurvatureSign(face) {
  let f = _asFace(face);
  let surf = new self.oc.BRepAdaptor_Surface_2(f, true);
  let ST = self.oc.GeomAbs_SurfaceType;
  let type = surf.GetType();
  if (type !== ST.GeomAbs_Cylinder && type !== ST.GeomAbs_Sphere &&
      type !== ST.GeomAbs_Torus) { return 0.0; }
  let u = (surf.FirstUParameter() + surf.LastUParameter()) / 2;
  let v = (surf.FirstVParameter() + surf.LastVParameter()) / 2;
  let pnt = new self.oc.gp_Pnt_1();
  let du = new self.oc.gp_Vec_1(), dv = new self.oc.gp_Vec_1();
  let duu = new self.oc.gp_Vec_1(), dvv = new self.oc.gp_Vec_1();
  let duv = new self.oc.gp_Vec_1();
  surf.D2(u, v, pnt, du, dv, duu, dvv, duv);
  let normal = du.Crossed(dv);
  let mag = normal.Magnitude();
  if (mag < 1e-12) { return 0.0; }
  let flip = f.Orientation_1() === self.oc.TopAbs_Orientation.TopAbs_REVERSED ? -1 : 1;
  let nx = flip * normal.X() / mag, ny = flip * normal.Y() / mag, nz = flip * normal.Z() / mag;
  let curvature = (second, first) => {
    let sq = first.SquareMagnitude();
    if (sq < 1e-24) { return 0.0; }
    return (second.X() * nx + second.Y() * ny + second.Z() * nz) / sq;
  };
  let ku = curvature(duu, du), kv = curvature(dvv, dv);
  let k = Math.abs(ku) >= Math.abs(kv) ? ku : kv;
  if (Math.abs(k) < 1e-12) { return 0.0; }
  // report the reference distance (1/|k| == the radius upstream dots against),
  // signed the way upstream signs it
  return -Math.sign(k) / Math.abs(k);
}

/** Minimal distance from a point to an edge (build123d's Shape.distance_to for
 *  the Edge/point case), measured on the edge's own parameter range. */
function _edgeDistanceToPoint(edge, point) {
  let e = _asEdge(edge);
  let curve = new self.oc.BRepAdaptor_Curve_2(e);
  let first = curve.FirstParameter(), last = curve.LastParameter();
  let pnt = new self.oc.gp_Pnt_3(point[0], point[1], point[2]);
  let best = Infinity;
  for (let u of [first, last]) {
    let p = new self.oc.gp_Pnt_1();
    curve.D0(u, p);
    best = Math.min(best, p.Distance(pnt));
  }
  let handle = self.oc.BRep_Tool.Curve_2(e, { current: 0 }, { current: 0 });
  let projector = new self.oc.GeomAPI_ProjectPointOnCurve_3(pnt, handle, first, last);
  if (projector.NbPoints() > 0) { best = Math.min(best, projector.LowerDistance()); }
  return best;
}

/** The normalized ARC-LENGTH position (0..1, measured along the underlying
 *  curve from its first parameter) of the point on an edge closest to `point`
 *  — build123d's Edge.param_at_point, same three-stage strategy: endpoint
 *  snap, GeomAPI_ProjectPointOnCurve validated by re-evaluation, then a
 *  sampled + golden-section search. Returns -1 when the point is not on the
 *  edge. */
function _edgeParamAtPoint(edge, point) {
  let e = _asEdge(edge);
  let curve = new self.oc.BRepAdaptor_Curve_2(e);
  let first = curve.FirstParameter(), last = curve.LastParameter();
  let total = self.oc.GCPnts_AbscissaPoint.Length_5(curve, first, last);
  if (!(total > 0)) { return 0.0; }
  let pnt = new self.oc.gp_Pnt_3(point[0], point[1], point[2]);
  let pointAtParam = (u) => {
    let p = new self.oc.gp_Pnt_1();
    curve.D0(Math.min(last, Math.max(first, u)), p);
    return p;
  };
  let distAtFraction = (u) => {
    let p = new self.oc.gp_Pnt_1();
    curve.D0(_edgeParamAtFraction(curve, u), p);
    return p.Distance(pnt);
  };
  // 1. endpoint snap (a vertex of the edge)
  if (pointAtParam(first).Distance(pnt) <= 1e-6) { return 0.0; }
  if (pointAtParam(last).Distance(pnt) <= 1e-6) { return 1.0; }
  // 2. projection onto the curve, wrapped back into range when periodic
  let handle = self.oc.BRep_Tool.Curve_2(e, { current: 0 }, { current: 0 });
  let projector = new self.oc.GeomAPI_ProjectPointOnCurve_2(pnt, handle);
  if (projector.NbPoints() > 0) {
    let param = projector.LowerDistanceParameter();
    if (curve.IsPeriodic()) {
      let period = curve.Period();
      param = first + (((param - first) % period) + period) % period;
    }
    if (param >= first - 1e-9 && param <= last + 1e-9) {
      param = Math.min(last, Math.max(first, param));
      let u = self.oc.GCPnts_AbscissaPoint.Length_5(curve, first, param) / total;
      if (distAtFraction(u) <= 1e-6) { return u; }
    }
  }
  // 3. sampled scan + golden-section refinement of the distance minimum
  let samples = 512, bestU = 0.0, bestD = Infinity;
  for (let i = 0; i <= samples; i++) {
    let u = i / samples, d = distAtFraction(u);
    if (d < bestD) { bestD = d; bestU = u; }
  }
  let invPhi = 0.6180339887498949;
  let lo = Math.max(0, bestU - 1 / samples), hi = Math.min(1, bestU + 1 / samples);
  let x1 = hi - invPhi * (hi - lo), x2 = lo + invPhi * (hi - lo);
  let f1 = distAtFraction(x1), f2 = distAtFraction(x2);
  for (let i = 0; i < 60; i++) {
    if (f1 <= f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - invPhi * (hi - lo); f1 = distAtFraction(x1); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = lo + invPhi * (hi - lo); f2 = distAtFraction(x2); }
  }
  let u = f1 <= f2 ? x1 : x2;
  // -1 (not null) for "not on this edge": a JS null crosses into Brython as
  // NullType, which cannot be compared or tested with `is None`
  return distAtFraction(u) <= 1e-6 ? u : -1.0;
}

function _bsplineDataOf(curve) {
  let data = {
    deg: curve.Degree(), periodic: curve.IsPeriodic(),
    knots: [], mults: [], poles: [], weights: null,
  };
  for (let i = 1; i <= curve.NbPoles(); i++) {
    let p = curve.Pole(i);
    data.poles.push([p.X(), p.Y(), p.Z()]);
  }
  for (let i = 1; i <= curve.NbKnots(); i++) {
    data.knots.push(curve.Knot(i));
    data.mults.push(curve.Multiplicity(i));
  }
  if (curve.IsRational()) {
    data.weights = [];
    for (let i = 1; i <= curve.NbPoles(); i++) { data.weights.push(curve.Weight(i)); }
  }
  return data;
}

function _bsplineFromData(data) {
  let count = data.poles.length;
  let poles = new self.oc.TColgp_Array1OfPnt_2(1, count);
  for (let i = 0; i < count; i++) {
    poles.SetValue(i + 1, new self.oc.gp_Pnt_3(
      data.poles[i][0], data.poles[i][1], data.poles[i][2]));
  }
  let knots = new self.oc.TColStd_Array1OfReal_2(1, data.knots.length);
  for (let i = 0; i < data.knots.length; i++) { knots.SetValue(i + 1, data.knots[i]); }
  let mults = new self.oc.TColStd_Array1OfInteger_2(1, data.mults.length);
  for (let i = 0; i < data.mults.length; i++) { mults.SetValue(i + 1, data.mults[i]); }
  if (data.weights) {
    let weights = new self.oc.TColStd_Array1OfReal_2(1, count);
    for (let i = 0; i < count; i++) { weights.SetValue(i + 1, data.weights[i]); }
    return new self.oc.Geom_BSplineCurve_2(
      poles, weights, knots, mults, data.deg, !!data.periodic, false);
  }
  return new self.oc.Geom_BSplineCurve_1(poles, knots, mults, data.deg, !!data.periodic);
}

/** Exact rational-quadratic NURBS of a conic arc: built in the unit-circle
 *  parameter plane (where the classic cos(alpha/2) construction is exact) and
 *  mapped through the conic's own affine frame, which is exact for ellipses
 *  too because an ellipse IS an affine image of a circle. */
function _conicArcData(origin, xDir, yDir, radiusX, radiusY, u0, u1) {
  let span = u1 - u0;
  let segments = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 2) - 1e-9));
  let step = span / segments;
  let half = Math.cos(step / 2);
  let map = (px, py) => [0, 1, 2].map(
    (k) => origin[k] + px * radiusX * xDir[k] + py * radiusY * yDir[k]);
  let poles = [map(Math.cos(u0), Math.sin(u0))], weights = [1];
  for (let i = 0; i < segments; i++) {
    let a0 = u0 + i * step, a1 = a0 + step, mid = 0.5 * (a0 + a1);
    poles.push(map(Math.cos(mid) / half, Math.sin(mid) / half));
    weights.push(half);
    poles.push(map(Math.cos(a1), Math.sin(a1)));
    weights.push(1);
  }
  let knots = [], mults = [];
  for (let i = 0; i <= segments; i++) {
    knots.push(u0 + i * step);
    mults.push(i === 0 || i === segments ? 3 : 2);
  }
  return { deg: 2, periodic: false, knots, mults, poles, weights };
}

/** An edge's curve as B-spline pole/knot data, trimmed to the edge's range and
 *  oriented the way the EDGE runs (build123d's `bspline_of` inside
 *  _concatenate_edges: CurveToBSplineCurve of a Geom_TrimmedCurve, reversed
 *  for a REVERSED edge). This wasm build cannot bind
 *  Convert_ParameterisationType, so GeomConvert is unavailable and the
 *  analytic curve types are converted here instead — exactly, not by
 *  approximation. */
function _edgeBSplineData(edge) {
  let e = _asEdge(edge);
  let curve = new self.oc.BRepAdaptor_Curve_2(e);
  let type = curve.GetType(), types = self.oc.GeomAbs_CurveType;
  let first = curve.FirstParameter(), last = curve.LastParameter();
  let bspline;
  if (type === types.GeomAbs_Line) {
    let p0 = new self.oc.gp_Pnt_1(), p1 = new self.oc.gp_Pnt_1();
    curve.D0(first, p0);
    curve.D0(last, p1);
    bspline = _bsplineFromData({
      deg: 1, periodic: false, knots: [first, last], mults: [2, 2], weights: null,
      poles: [[p0.X(), p0.Y(), p0.Z()], [p1.X(), p1.Y(), p1.Z()]],
    });
  } else if (type === types.GeomAbs_Circle || type === types.GeomAbs_Ellipse) {
    let isCircle = type === types.GeomAbs_Circle;
    let conic = isCircle ? curve.Circle() : curve.Ellipse();
    let frame = conic.Position();
    let origin = frame.Location(), xDir = frame.XDirection(), yDir = frame.YDirection();
    bspline = _bsplineFromData(_conicArcData(
      [origin.X(), origin.Y(), origin.Z()],
      [xDir.X(), xDir.Y(), xDir.Z()],
      [yDir.X(), yDir.Y(), yDir.Z()],
      isCircle ? conic.Radius() : conic.MajorRadius(),
      isCircle ? conic.Radius() : conic.MinorRadius(),
      first, last));
  } else if (type === types.GeomAbs_BezierCurve) {
    let bezier = curve.Bezier().get();
    let poles = [], weights = bezier.IsRational() ? [] : null;
    for (let i = 1; i <= bezier.NbPoles(); i++) {
      let p = bezier.Pole(i);
      poles.push([p.X(), p.Y(), p.Z()]);
      if (weights) { weights.push(bezier.Weight(i)); }
    }
    let deg = bezier.Degree();
    bspline = _bsplineFromData({
      deg, periodic: false, knots: [0, 1], mults: [deg + 1, deg + 1], poles, weights,
    });
    if (first > 0 || last < 1) { bspline.Segment(first, last, 1e-9); }
  } else if (type === types.GeomAbs_BSplineCurve) {
    // rebuild from data first: Segment() mutates in place and the adaptor's
    // handle points at the edge's own basis curve
    bspline = _bsplineFromData(_bsplineDataOf(curve.BSpline().get()));
    bspline.Segment(first, last, 1e-9);
  } else {
    throw new Error(
      "build123d-lite cannot canonicalize a closed shape containing a " +
      "hyperbola, parabola or offset curve (no exact B-spline form)");
  }
  if (e.Orientation_1() === self.oc.TopAbs_Orientation.TopAbs_REVERSED) {
    bspline.Reverse();
  }
  return _bsplineDataOf(bspline);
}

/** ONE edge whose curve is the exact concatenation of an ordered, head-to-tail
 *  edge chain (build123d's _concatenate_edges, which uses
 *  GeomConvert_CompCurveToBSplineCurve — unavailable here, see
 *  _edgeBSplineData). Used to give a re-seamed closed loop an unambiguous
 *  start point: a closed TopoDS_Wire carries no distinguished first edge,
 *  while an Edge's curve parametrization does. */
function ConcatEdgesToEdge(edges) {
  let pieces = edges.map(_edgeBSplineData);
  let degree = pieces.reduce((d, piece) => Math.max(d, piece.deg), 1);
  pieces = pieces.map((piece) => {
    if (piece.deg === degree) { return piece; }
    let raised = _bsplineFromData(piece);
    raised.IncreaseDegree(degree);
    return _bsplineDataOf(raised);
  });
  let joined = pieces[0];
  for (let i = 1; i < pieces.length; i++) {
    let next = pieces[i];
    let shift = joined.knots[joined.knots.length - 1] - next.knots[0];
    let rational = !!(joined.weights || next.weights);
    let weightsA = joined.weights || joined.poles.map(() => 1);
    let weightsB = next.weights || next.poles.map(() => 1);
    // the junction pole is shared, so rescale the incoming weights to match
    let scale = weightsA[weightsA.length - 1] / weightsB[0];
    joined = {
      deg: degree,
      periodic: false,
      poles: joined.poles.concat(next.poles.slice(1)),
      weights: rational
        ? weightsA.concat(weightsB.slice(1).map((weight) => weight * scale))
        : null,
      knots: joined.knots.concat(next.knots.slice(1).map((knot) => knot + shift)),
      // C0 junction: multiplicity == degree instead of the clamped degree + 1
      mults: joined.mults.slice(0, -1).concat([degree]).concat(next.mults.slice(1)),
    };
  }
  let handle = new self.oc.Handle_Geom_Curve_2(_bsplineFromData(joined));
  let out = new self.oc.BRepBuilderAPI_MakeEdge_24(handle).Edge();
  out.hash = self.oc.OCJS.HashCode(out, 100000000);
  self.sceneShapes.push(out);
  return out;
}

/** An edge's 3D curve projected onto a face's surface (GeomProjLib::Project —
 *  build123d's "snap_to_face" step of _wrap_edge). */
function ProjectEdgeOnFace(edge, face) {
  let e = _asEdge(edge);
  let first = { current: 0 }, last = { current: 0 };
  let curve = self.oc.BRep_Tool.Curve_2(e, first, last);
  let surf = self.oc.BRep_Tool.Surface_2(_asFace(face));
  let projected = self.oc.GeomProjLib.Project(curve, surf);
  if (!projected) { return null; }
  let out = new self.oc.BRepBuilderAPI_MakeEdge_24(projected).Edge();
  out.hash = self.oc.OCJS.HashCode(out, 100000000);
  self.sceneShapes.push(out);
  return out;
}

/** Extend a B-spline edge past one of its ends by `factor` of its length and
 *  snap the result back onto a face's surface — build123d's
 *  Edge._extend_spline, used to make the first and last wrapped edges of a
 *  closed wire cross so they can be trimmed to a clean junction. */
function ExtendSplineOnFace(edge, atStart, face, factor) {
  let e = _asEdge(edge);
  let adaptor = new self.oc.BRepAdaptor_Curve_2(e);
  let bspl = adaptor.BSpline().get();
  let poles = [];
  for (let i = 1; i <= bspl.NbPoles(); i++) {
    let p = bspl.Pole(i);
    poles.push([p.X(), p.Y(), p.Z()]);
  }
  let pointAt = (f) => {
    let pnt = new self.oc.gp_Pnt_1();
    adaptor.D0(_edgeParam(e, f), pnt);
    return [pnt.X(), pnt.Y(), pnt.Z()];
  };
  let tangentAt = (f) => {
    let pnt = new self.oc.gp_Pnt_1(), vec = new self.oc.gp_Vec_1();
    adaptor.D1(_edgeParam(e, f), pnt, vec);
    let m = vec.Magnitude() || 1;
    return [vec.X() / m, vec.Y() / m, vec.Z() / m];
  };
  let ends = atStart ? [-factor, 1] : [0, 1 + factor];
  if (atStart) { poles.unshift(pointAt(-factor)); } else { poles.push(pointAt(1 + factor)); }
  let tangents = [tangentAt(ends[0]), tangentAt(ends[1])];
  let extended = InterpolatedEdge(poles, tangents, false, true);
  return ProjectEdgeOnFace(extended, face);
}

/** A single edge exactly interpolating the given points (GeomAPI_Interpolate,
 *  build123d's Edge.make_spline). */
function InterpolatedEdge(points, tangents, periodic, scale) {
  let wire = WireFromSegments([['interp', points.map((p) => [p[0], p[1], p[2]]),
    [tangents && tangents.length ? tangents : null, !!periodic,
     scale === undefined ? true : !!scale]]], true);
  let edges = [];
  ForEachEdge(wire, (i, e) => { edges.push(e); });
  if (edges.length !== 1) {
    throw new Error('InterpolatedEdge: expected one edge, got ' + edges.length);
  }
  return edges[0];
}

/** Curve parameters of the closest extremum between two edges' curves
 *  (GeomAPI_ExtremaCurveCurve, build123d's first/last wrapped-edge junction).
 *  Returns [paramOnFirst, paramOnSecond] or null. */
function ExtremaEdgeParams(edgeA, edgeB) {
  let fa = { current: 0 }, la = { current: 0 }, fb = { current: 0 }, lb = { current: 0 };
  let ca = self.oc.BRep_Tool.Curve_2(_asEdge(edgeA), fa, la);
  let cb = self.oc.BRep_Tool.Curve_2(_asEdge(edgeB), fb, lb);
  let ext = new self.oc.GeomAPI_ExtremaCurveCurve_2(ca, cb);
  if (ext.NbExtrema() < 1) { return null; }
  let u = { current: 0 }, v = { current: 0 };
  ext.LowerDistanceParameters(u, v);
  return [u.current, v.current];
}

/** A potentially NON-planar face bounded by the given edges, optionally
 *  refined by interior points and holed by interior wires — the exact
 *  BRepOffsetAPI_MakeFilling construction of build123d's Face.make_surface. */
function FillingFace(edges, points, interiorWires) {
  let filling = new self.oc.BRepOffsetAPI_MakeFilling(
    3, 15, 2, false, 0.00001, 0.0001, 0.01, 0.1, 8, 9);
  let C0 = self.oc.GeomAbs_Shape.GeomAbs_C0;
  for (let i = 0; i < edges.length; i++) {
    filling.Add_1(_asEdge(edges[i]), C0, true);
  }
  filling.Build(new self.oc.Message_ProgressRange_1());
  if (!filling.IsDone()) { console.error("FillingFace: surface filling failed"); return null; }
  if (points && points.length) {
    for (let i = 0; i < points.length; i++) {
      filling.Add_4(new self.oc.gp_Pnt_3(points[i][0], points[i][1], points[i][2]));
    }
    filling.Build(new self.oc.Message_ProgressRange_1());
    if (!filling.IsDone()) {
      console.error("FillingFace: surface filling with interior points failed");
      return null;
    }
  }
  let face = self.oc.TopoDS_Cast.Face_1(filling.Shape());
  if (interiorWires && interiorWires.length) {
    face = _asFace(FaceWithHoles(_faceOuterWire(face), interiorWires.map(_asWire)));
  }
  let fixer = new self.oc.ShapeFix_Shape_2(face);
  fixer.Perform(new self.oc.Message_ProgressRange_1());
  face = _asFace(fixer.Shape());
  face.hash = self.oc.OCJS.HashCode(face, 100000000);
  self.sceneShapes.push(face);
  return face;
}

/** A wire from edges, reordered and gap-closed with ShapeFix_Wire (build123d
 *  closes the wrapped-wire junction this way). */
function WireFromEdgesFixed(edges, precision) {
  let mkWire = new self.oc.BRepBuilderAPI_MakeWire_1();
  // build123d adds every edge at once (TopTools_ListOfShape), which lets the
  // builder connect them in any order instead of demanding that each new edge
  // touch the wire built so far
  let list = new self.oc.TopTools_ListOfShape();
  for (let i = 0; i < edges.length; i++) { list.Append(_asEdge(edges[i])); }
  mkWire.Add_3(list);
  let raw;
  if (mkWire.IsDone()) {
    raw = mkWire.Wire();
  } else {
    // The gaps between independently projected wrapped edges can exceed
    // MakeWire's connectivity tolerance. Assemble the wire directly and let
    // ShapeFix close the gaps — which is exactly what build123d's
    // SetPrecision(2 * closing_error) + FixConnected pass is there for.
    let builder = new self.oc.BRep_Builder();
    raw = new self.oc.TopoDS_Wire();
    builder.MakeWire(raw);
    for (let i = 0; i < edges.length; i++) { builder.Add(raw, _asEdge(edges[i])); }
  }
  let fixer = new self.oc.ShapeFix_Wire_1();
  if (precision > 0) { fixer.SetPrecision(precision); }
  fixer.Load_1(raw);
  fixer.FixReorder_1(false);
  fixer.FixConnected_1(precision > 0 ? precision : 1e-7);
  let wire = fixer.Wire();
  wire.hash = self.oc.OCJS.HashCode(wire, 100000000);
  self.sceneShapes.push(wire);
  return wire;
}

/** Whether a wire is topologically closed (BRep_Tool::IsClosed). */
function _wireIsClosed(wire) {
  return !!self.oc.BRep_Tool.IsClosed_1(_asWire(wire));
}

/** A wire's edges in CONNECTION order (BRepTools_WireExplorer — build123d's
 *  Wire.order_edges); ForEachEdge follows TopExp's storage order instead. */
function OrderedEdges(wire) {
  let out = [];
  let exp = new self.oc.BRepTools_WireExplorer_2(_asWire(wire));
  for (; exp.More(); exp.Next()) {
    let e = self.oc.TopoDS_Cast.Edge_1(exp.Current());
    if (e.hash === undefined) { e.hash = self.oc.OCJS.HashCode(e, 100000000); }
    out.push(e);
  }
  return out;
}

/** The single TopoDS_Face of a one-face shape (shell/compound), or the shape
 *  unchanged when it holds none or several. Extruding a one-edge wire yields a
 *  SHELL here where build123d's Face.extrude casts straight to TopoDS_Face,
 *  and downstream OCCT algorithms (BRepProj_Projection above all) treat a
 *  shell differently from the face inside it. */
function AsSingleFace(shape, keepShape) {
  if (shape.ShapeType().value === 4) { return shape; }
  let found = [];
  ForEachFace(shape, (i, f) => { found.push(f); });
  if (found.length !== 1) { return shape; }
  let face = found[0];
  if (face.hash === undefined) { face.hash = self.oc.OCJS.HashCode(face, 100000000); }
  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(face);
  return face;
}

/** TopoDS_Wire view of a wire, or a wire built from a shape's edges. */
function _asWire(shape) {
  if (shape.ShapeType().value === 5) { return self.oc.TopoDS_Cast.Wire_1(shape); }
  let mkWire = new self.oc.BRepBuilderAPI_MakeWire_1();
  ForEachEdge(shape, (i, e) => { mkWire.Add_1(e); });
  return mkWire.Wire();
}

/** Project a wire (or a shape's edges) onto a target shape, either along a
 *  direction or from a conical `center` point (pass one, null the other) —
 *  BRepProj_Projection, exactly build123d's Wire/Edge.project_to_shape.
 *  Results keep the input's orientation and, when the projection lands on
 *  more than one surface, are sorted nearest-first along the projection
 *  (wires BEHIND the profile are dropped for directional projection, like
 *  build123d).
 *  COMPROMISE(projection-sort): build123d sorts by Wire.center() (the
 *  position at half arc length); this sorts by center of mass, which orders
 *  front/back hits identically but can differ for exotic wires. */
function ProjectWireOnShape(profile, target, direction, center) {
  let wire = _asWire(profile);
  let proj = direction
    ? new self.oc.BRepProj_Projection_1(wire, target,
        new self.oc.gp_Dir_5(direction[0], direction[1], direction[2]))
    : new self.oc.BRepProj_Projection_2(wire, target,
        new self.oc.gp_Pnt_3(center[0], center[1], center[2]));
  let wanted = wire.Orientation_1();
  let found = [];
  for (; proj.More(); proj.Next()) {
    let pw = proj.Current();
    if (pw.Orientation_1() !== wanted) { pw = self.oc.TopoDS_Cast.Wire_1(pw.Reversed()); }
    // build123d cleans the projected wires "to remove cases where projection
    // artificially split edges".
    // COMPROMISE(projected-edge-split): this kernel splits more eagerly than
    // OCP 7.x's — a single projected arc comes back as two BSpline edges
    // meeting where the curve grazes the surface boundary — so unification
    // has to CONCATENATE B-splines (build123d's clean() leaves that flag off)
    // to get back to build123d's one-edge result. Same curve, same length.
    pw = UnifyWire(pw, true);
    pw.hash = self.oc.OCJS.HashCode(pw, 100000000);
    found.push(pw);
  }
  if (found.length > 1) {
    let c0 = _shapeLinearCenter(wire);
    let keyed = [];
    for (let i = 0; i < found.length; i++) {
      let c = _shapeLinearCenter(found[i]);
      let d = [c[0] - c0[0], c[1] - c0[1], c[2] - c0[2]];
      let len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
      if (direction) {
        let dot = d[0] * direction[0] + d[1] * direction[1] + d[2] * direction[2];
        if (dot < 0) { continue; }  // behind the profile: not a projection hit
      }
      keyed.push([len, found[i]]);
    }
    keyed.sort((a, b) => a[0] - b[0]);
    found = keyed.map((k) => k[1]);
  }
  for (let i = 0; i < found.length; i++) { self.sceneShapes.push(found[i]); }
  return found;
}

function _shapeLinearCenter(shape) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.LinearProperties(shape, props, false, false);
  let c = props.CentreOfMass();
  return [c.X(), c.Y(), c.Z()];
}

/** Reverse ANY shape's topological orientation (TopoDS_Shape::Complemented —
 *  what build123d's Mixin2D.__neg__ does), re-typing the result when it is a
 *  face so downstream face APIs keep working. */
function ReverseShape(shape, keepShape) {
  let reversed = shape.Complemented();
  if (reversed.ShapeType().value === 4) {
    reversed = self.oc.TopoDS_Cast.Face_1(reversed);
  }
  reversed.hash = self.oc.OCJS.HashCode(reversed, 100000000);
  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(reversed);
  return reversed;
}

/** Uniform scale about a center point, BAKED into the geometry
 *  (BRepBuilderAPI_Transform + gp_Trsf::SetScale — what build123d's
 *  Shape.scale does). The legacy Scale() encodes the factor in a
 *  TopLoc_Location, which downstream OCCT algorithms handle
 *  inconsistently (TopLoc is only specified for isometries). */
function ScaleUniform(shape, factor, center, keepShape) {
  if (!shape || shape.IsNull()) { console.error("ScaleUniform: input shape is null!"); return shape; }
  if (!center) { center = [0, 0, 0]; }
  let scaled = self.CacheOp(arguments, "ScaleUniform", () => {
    let trsf = new self.oc.gp_Trsf_1();
    trsf.SetScale(new self.oc.gp_Pnt_3(center[0], center[1], center[2]), factor);
    let op = new self.oc.BRepBuilderAPI_Transform_2(shape, trsf, true, false);
    op.Build(new self.oc.Message_ProgressRange_1());
    return op.Shape();
  });
  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(scaled);
  return scaled;
}

/** Non-uniform scale via gp_GTrsf + BRepBuilderAPI_GTransform (converts
 *  analytic surfaces to BSplines where needed — same as build123d). */
function ScaleXYZ(factors, shape, keepShape) {
  if (!shape || shape.IsNull()) { console.error("ScaleXYZ: input shape is null!"); return shape; }
  let scaled = self.CacheOp(arguments, "ScaleXYZ", () => {
    let gtrsf = new self.oc.gp_GTrsf_1();
    gtrsf.SetValue(1, 1, factors[0]);
    gtrsf.SetValue(2, 2, factors[1]);
    gtrsf.SetValue(3, 3, factors[2]);
    let op = new self.oc.BRepBuilderAPI_GTransform_2(shape, gtrsf, true);
    op.Build(new self.oc.Message_ProgressRange_1());
    return op.Shape();
  });
  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(scaled);
  return scaled;
}

/** Hidden-line-removal projection: project the shape onto a viewport with
 *  the given view direction, returning [visibleEdges, hiddenEdges] as two
 *  compounds (HLRBRep — what build123d's project_to_viewport uses). */
function HLRProject(shape, viewDir, keepShape) {
  let result = self.CacheOp(arguments, "HLRProject", () => {
    let hlr = new self.oc.HLRBRep_Algo_1();
    hlr.Add_2(shape, 0);
    let projDir = new self.oc.gp_Dir_5(viewDir[0], viewDir[1], viewDir[2]);
    let ax2 = new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(0, 0, 0), projDir);
    let projector = new self.oc.HLRAlgo_Projector_2(ax2);
    hlr.Projector_1(projector);
    hlr.Update();
    hlr.Hide_1();
    let toShape = new self.oc.HLRBRep_HLRToShape(new self.oc.Handle_HLRBRep_Algo_2(hlr));
    let visible = [];
    let hidden = [];
    let grab = (s, into) => { if (s && !s.IsNull()) { into.push(s); } };
    grab(toShape.VCompound_1(), visible);
    grab(toShape.Rg1LineVCompound_1(), visible);
    grab(toShape.OutLineVCompound_1(), visible);
    grab(toShape.HCompound_1(), hidden);
    grab(toShape.Rg1LineHCompound_1(), hidden);
    grab(toShape.OutLineHCompound_1(), hidden);
    let mk = (list) => {
      let builder = new self.oc.BRep_Builder();
      let compound = new self.oc.TopoDS_Compound();
      builder.MakeCompound(compound);
      for (let i = 0; i < list.length; i++) { builder.Add(compound, list[i]); }
      self.oc.BRepLib.BuildCurves3d_2(compound);
      compound.hash = self.oc.OCJS.HashCode(compound, 100000000);
      return compound;
    };
    return [mk(visible), mk(hidden)];
  });
  return result;
}

/** Surface through a 2D grid of points, returned as a face. build123d uses
 *  GeomAPI_PointsToBSplineSurface, whose Surface() accessor returns
 *  Handle_Geom_BSplineSurface — a type this WASM build does not bind — so
 *  instead each row (fixed V, varying U) is interpolated exactly
 *  (GeomAPI_Interpolate, 1e-6) and the rows are skinned with
 *  BRepOffsetAPI_ThruSections (non-solid, 1e-6). Both constructions
 *  approximate the same grid to well below harness tolerance.
 *  `points` outer index = V, inner = U, like build123d. */
function SurfaceFromPoints(points, tol, degMin, degMax, smoothing) {
  let curFace = self.CacheOp(arguments, "SurfaceFromPoints", () => {
    // The exact calls build123d's Face.make_surface_from_array_of_points
    // makes: GeomAPI_PointsToBSplineSurface(points, DegMin, DegMax,
    // GeomAbs_C2, Tol3D) — a 2-D least-squares fit — then
    // BRepBuilderAPI_MakeFace(surface, Precision::Confusion()).
    // With smoothing weights: the variational (Weight1..3) constructor.
    let arr = new self.oc.TColgp_Array2OfPnt_2(1, points.length, 1, points[0].length);
    for (let i = 0; i < points.length; i++) {
      let row = points[i];
      for (let j = 0; j < row.length; j++) {
        let p = row[j];
        arr.SetValue(i + 1, j + 1, new self.oc.gp_Pnt_3(p[0], p[1], p.length > 2 ? p[2] : 0));
      }
    }
    let alg;
    if (smoothing && smoothing.length === 3) {
      alg = new self.oc.GeomAPI_PointsToBSplineSurface_4(
        arr, smoothing[0], smoothing[1], smoothing[2], degMax,
        self.oc.GeomAbs_Shape.GeomAbs_C2, tol);
    } else {
      alg = new self.oc.GeomAPI_PointsToBSplineSurface_2(
        arr, degMin, degMax, self.oc.GeomAbs_Shape.GeomAbs_C2, tol);
    }
    if (!alg.IsDone()) {
      console.error("SurfaceFromPoints: B-spline surface approximation failed");
      return null;
    }
    let surfaceHandle = alg.Surface().AsGeomSurface();
    let face = new self.oc.BRepBuilderAPI_MakeFace_8(surfaceHandle, 1.0e-7).Face();
    face.hash = self.oc.OCJS.HashCode(face, 100000000);
    return face;
  });
  self.sceneShapes.push(curFace);
  return curFace;
}

/** Sweep profile wires along a spine wire with BRepOffsetAPI_MakePipeShell —
 *  the exact calls build123d's Solid.sweep/sweep_multi make:
 *    - trihedron: SetMode(isFrenet) (false = corrected Frenet), unless a
 *      constant `binormal` vector ([x,y,z], build123d normal=) or an
 *      auxiliary spine wire (`auxSpine`, build123d binormal=) is given
 *    - transition: 'transformed' | 'round' | 'right' (ignored when null,
 *      matching sweep_multi which never sets a transition mode)
 *    - every profile is added with Add(profile, WithContact=false,
 *      WithCorrection=rotate) where rotate is true only for a binormal vector
 *  Multiple profiles = multisection sweep (profile correspondence is OCCT's).
 *  Profiles must be TopoDS_Wire; returns a solid (MakeSolid), or the raw
 *  shell when makeShell is true. */
function PipeShellSweep(profileWires, spineWire, isFrenet, transition, binormal, auxSpine, auxCurvilinear, makeShell) {
  let result = self.CacheOp(arguments, "PipeShellSweep", () => {
    let toWire = (w) => {
      // rebuild for exact Embind TopoDS_Wire typing (see Loft)
      let mw = new self.oc.BRepBuilderAPI_MakeWire_1();
      let exp = new self.oc.TopExp_Explorer_2(w, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (exp.More()) { mw.Add_1(self.oc.TopoDS_Cast.Edge_1(exp.Current())); exp.Next(); }
      return mw.Wire();
    };
    let builder = new self.oc.BRepOffsetAPI_MakePipeShell(toWire(spineWire));
    let rotate = false;
    if (binormal && binormal.length) {
      let ax = new self.oc.gp_Ax2_1();
      let start = _edgePointAt(
        new self.oc.TopExp_Explorer_2(spineWire, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
          self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE).Current(), 0.0);
      ax.SetLocation(new self.oc.gp_Pnt_3(start[0], start[1], start[2]));
      ax.SetDirection(new self.oc.gp_Dir_5(binormal[0], binormal[1], binormal[2]));
      builder.SetMode_2(ax);
      rotate = true;
    } else if (auxSpine) {
      // binormal wire -> CurvilinearEquivalence true (Solid._set_sweep_mode);
      // extrude_linear_with_rotation's helix aux spine passes false
      let curv = (auxCurvilinear === undefined || auxCurvilinear === null || auxCurvilinear === '') ? true : !!auxCurvilinear;
      builder.SetMode_5(toWire(auxSpine), curv, self.oc.BRepFill_TypeOfContact.BRepFill_NoContact);
    } else {
      builder.SetMode_1(!!isFrenet);
    }
    if (transition) {
      let TM = self.oc.BRepBuilderAPI_TransitionMode;
      let mode = transition === 'round' ? TM.BRepBuilderAPI_RoundCorner :
                 transition === 'right' ? TM.BRepBuilderAPI_RightCorner :
                 TM.BRepBuilderAPI_Transformed;
      builder.SetTransitionMode(mode);
    }
    for (let i = 0; i < profileWires.length; i++) {
      builder.Add_1(toWire(profileWires[i]), false, rotate);
    }
    builder.Build(new self.oc.Message_ProgressRange_1());
    if (!makeShell) { builder.MakeSolid(); }
    return builder.Shape();
  });
  self.sceneShapes.push(result);
  return result;
}

/** Planar face from an outer wire plus hole wires (build123d's
 *  Face(outer_wire, inner_wires)) — no booleans: MakeFace + Add(wire) with a
 *  ShapeFix_Face orientation pass so the holes subtract regardless of the
 *  input wires' winding. */
function FaceWithHoles(outerWire, holeWires) {
  let curFace = self.CacheOp(arguments, "FaceWithHoles", () => {
    let toWire = (shape) => shape.ShapeType().value === 5
      ? self.oc.TopoDS_Cast.Wire_1(shape) : self.oc.TopoDS_Cast.Wire_1(
        new self.oc.TopExp_Explorer_2(shape, self.oc.TopAbs_ShapeEnum.TopAbs_WIRE,
          self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE).Current());
    let mk = new self.oc.BRepBuilderAPI_MakeFace_15(toWire(outerWire), true);
    for (let i = 0; i < holeWires.length; i++) { mk.Add(toWire(holeWires[i])); }
    let fixer = new self.oc.ShapeFix_Face_2(mk.Face());
    fixer.FixOrientation_1();
    return fixer.Face();
  });
  self.sceneShapes.push(curFace);
  return curFace;
}

/** Apply a draft angle to the given faces of a solid — BRepOffsetAPI_DraftAngle
 *  with build123d's Solid.draft conventions (pull direction and neutral plane
 *  from the neutral Plane's z_dir/origin, Flag=true). */
function DraftAngleFaces(shape, faces, angleDeg, planeOrigin, planeNormal, keepShape) {
  let result = self.CacheOp(arguments, "DraftAngleFaces", () => {
    let builder = new self.oc.BRepOffsetAPI_DraftAngle_2(shape);
    let dir = new self.oc.gp_Dir_5(planeNormal[0], planeNormal[1], planeNormal[2]);
    let pln = new self.oc.gp_Pln_3(
      new self.oc.gp_Pnt_3(planeOrigin[0], planeOrigin[1], planeOrigin[2]), dir);
    for (let i = 0; i < faces.length; i++) {
      let f = faces[i].ShapeType().value === 4 ? self.oc.TopoDS_Cast.Face_1(faces[i]) : faces[i];
      builder.Add(f, dir, angleDeg * (Math.PI / 180), pln, true);
      if (!builder.AddDone()) {
        console.error("DraftAngleFaces: draft could not be added to face " + i);
        return shape;
      }
    }
    builder.Build(new self.oc.Message_ProgressRange_1());
    return builder.Shape();
  });
  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(result);
  return result;
}

/** Write the shape as an STL file into the worker's Emscripten MEMFS and
 *  return the file's text content (ASCII) or byte length (binary) — the
 *  engine behind build123d-lite's Mesher/export_stl. */
function ExportSTL(shape, filename, linearDeflection, angularDeflection, asciiFormat) {
  if (!shape || shape.IsNull()) { console.error("ExportSTL: input shape is null!"); return null; }
  if (!linearDeflection) { linearDeflection = 1e-3; }
  if (!angularDeflection) { angularDeflection = 0.1; }
  new self.oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, true, angularDeflection, true);
  let writer = new self.oc.StlAPI_Writer();
  // StlAPI_Writer defaults to ASCII in OCCT; the binding exposes ASCIIMode()
  // as a getter only, so we always write ASCII (fine for MEMFS round-trips)
  let done = writer.Write_1(shape, "/" + filename, new self.oc.Message_ProgressRange_1());
  if (!done) { console.error("ExportSTL: STL write failed"); return null; }
  let text = self.oc.FS.readFile("/" + filename, { encoding: "utf8" });
  return text;
}

/** Group shapes into a single TopoDS_Compound (no boolean fusion). */
function MakeCompound(shapes, keepInputs) {
  let builder = new self.oc.BRep_Builder();
  let compound = new self.oc.TopoDS_Compound();
  builder.MakeCompound(compound);
  for (let i = 0; i < shapes.length; i++) { builder.Add(compound, shapes[i]); }
  // not CacheOp'd — give the result a stable identity for downstream CacheOps
  compound.hash = self.oc.OCJS.HashCode(compound, 100000000);
  if (!keepInputs) {
    for (let i = 0; i < shapes.length; i++) { self.sceneShapes = self.Remove(self.sceneShapes, shapes[i]); }
  }
  self.sceneShapes.push(compound);
  return compound;
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
      // Sub-shapes carry no .hash, so CacheOp's ptr-stripping would hash any
      // two of them identically ("{}") — give each a stable identity so ops
      // that receive raw edges/faces are cached correctly.
      if (edge.hash === undefined) { edge.hash = self.oc.OCJS.HashCode(edge, 100000000); }
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
      // see EdgeSelector: raw sub-shapes need a stable hash for CacheOp
      if (face.hash === undefined) { face.hash = self.oc.OCJS.HashCode(face, 100000000); }
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

/** build123d's `new_edges(*objects, combined=)` (topology/utils.py): the edges
 *  of `combined` that no shape in `originals` contributed — i.e. the edges the
 *  combining operation created.
 *
 *  Implemented with upstream's exact algorithm rather than a geometric
 *  comparison: a boolean CUT of the combined shape's edge list by the
 *  originals' edge list, which also splits partially-shared edges so only the
 *  genuinely new portion survives.
 *
 *  @param {TopoDS_Shape} combined - the result of the operation
 *  @param {TopoDS_Shape[]} originals - its inputs
 *  @returns {TopoDS_Edge[]} the new edges */
function NewEdges(combined, originals) {
  if (!combined || combined.IsNull()) { return []; }
  let combinedEdges = new self.oc.TopTools_ListOfShape();
  let combinedCount = 0;
  let allCombined = [];
  ForEachEdge(combined, (i, edge) => {
    combinedEdges.Append(edge); combinedCount++; allCombined.push(edge);
  });
  if (combinedCount === 0) { return []; }
  let originalEdges = new self.oc.TopTools_ListOfShape();
  let originalCount = 0;
  for (let i = 0; i < originals.length; i++) {
    if (!originals[i] || originals[i].IsNull()) { continue; }
    ForEachEdge(originals[i], (j, edge) => { originalEdges.Append(edge); originalCount++; });
  }
  if (originalCount === 0) { return allCombined; }
  let cut = new self.oc.BRepAlgoAPI_Cut_1();
  cut.SetArguments(combinedEdges);
  cut.SetTools(originalEdges);
  // (upstream also calls SetRunParallel(True) - a BOPAlgo_Options perf flag
  //  that is not bound in this build; it does not affect the result)
  cut.Build(new self.oc.Message_ProgressRange_1());
  let out = [];
  ForEachEdge(cut.Shape(), (i, edge) => { out.push(edge); });
  return out;
}

// --- Measurement Functions ---

function Volume(shape) {
  let props = new self.oc.GProp_GProps_1();
  self.oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  return props.Mass();
}

/** Sum of |volume| over the shape's SOLIDS only — immune to the spurious
 *  open-face contributions VolumeProperties picks up on mixed compounds
 *  in this OCCT build (build123d-lite's Shape.volume semantics). */
function SolidsVolume(shape) {
  let total = 0;
  ForEachSolid(shape, (i, solid) => { total += Math.abs(Volume(solid)); });
  return total;
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

/** Build a single TopoDS_Wire from an ordered list of connected segments.
 *  Each segment is [kind, points] with 3D points; kinds:
 *    'line'   [start, end]
 *    'arc3'   [start, pointOnArc, end]        (circular arc through 3 points)
 *    'bezier' [ctrl0, ctrl1, ..., ctrlN]      (Bezier control points)
 *    'spline' [p0, p1, ..., pN]               (fit through points, C2, 1e-3)
 *    'interp' [p0, p1, ..., pN] + params [tangents|null, periodic, scale]
 *             (exact GeomAPI_Interpolate — build123d's Edge.make_spline;
 *             tangents is null, [t0, t1] end tangents, or one per point)
 *  Used by build123d-lite's BuildLine/make_face (the segment MATH lives in
 *  Python; this helper only assembles edges with the same OCCT calls the
 *  Sketch class already uses). Returns the wire (scene-registered). */
function WireFromSegments(segments, keepInputs) {
  let curWire = self.CacheOp(arguments, "WireFromSegments", () => {
    let toPnt = (p) => new self.oc.gp_Pnt_3(p[0], p[1], p.length > 2 ? p[2] : 0);
    // Disjoint segment runs (e.g. build123d dimension lines with arrows)
    // become SEPARATE wires collected into a compound — feeding a
    // disconnected edge to one MakeWire aborts inside the kernel.
    let wires = [];
    let wireBuilder = new self.oc.BRepBuilderAPI_MakeWire_1();
    let started = false;
    let lastEnd = null;
    let closeRun = () => {
      if (started) { wires.push(wireBuilder.Wire()); }
      wireBuilder = new self.oc.BRepBuilderAPI_MakeWire_1();
      started = false;
    };
    let near = (a, b) => a && b &&
      Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 &&
      Math.abs((a[2] || 0) - (b[2] || 0)) < 1e-6;
    for (let s = 0; s < segments.length; s++) {
      let segPts = segments[s][1];
      if (started && !near(lastEnd, segPts[0])) { closeRun(); }
      lastEnd = segPts[segPts.length - 1];
      let kind = segments[s][0], pts = segments[s][1];
      let curveHandle = null;
      if (kind === 'line') {
        curveHandle = new self.oc.GC_MakeSegment_1(toPnt(pts[0]), toPnt(pts[1])).Value();
      } else if (kind === 'arc3') {
        curveHandle = new self.oc.GC_MakeArcOfCircle_4(toPnt(pts[0]), toPnt(pts[1]), toPnt(pts[2])).Value();
      } else if (kind === 'bezier') {
        let ptList = new self.oc.TColgp_Array1OfPnt_2(1, pts.length);
        for (let i = 0; i < pts.length; i++) { ptList.SetValue(i + 1, toPnt(pts[i])); }
        let bezier = new self.oc.Geom_BezierCurve_1(ptList);
        let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(bezier)).Edge();
        wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire());
        started = true;
        continue;
      } else if (kind === 'spline') {
        let ptList = new self.oc.TColgp_Array1OfPnt_2(1, pts.length);
        for (let i = 0; i < pts.length; i++) { ptList.SetValue(i + 1, toPnt(pts[i])); }
        // cubic fit only: higher degrees oscillate/overshoot on the densely
        // sampled clamped splines build123d-lite feeds through here
        curveHandle = new self.oc.GeomAPI_PointsToBSpline_2(ptList, 3, 3,
          (self.oc.GeomAbs_Shape ? self.oc.GeomAbs_Shape.GeomAbs_C2 : 2), 1.0e-4).Curve();
      } else if (kind === 'interp') {
        // exact interpolation through the points — GeomAPI_Interpolate, the
        // same calls as build123d's Edge.make_spline (tol 1e-6):
        //   params = [tangents, periodic, scale]
        //   tangents: null | [[t0],[t1]] end tangents | one (or null) per point
        //   scale: true = only tangent DIRECTION matters (OCCT rescales)
        let p = segments[s][2] || [];
        let tangents = (p[0] && p[0].length) ? p[0] : null;
        let periodic = !!p[1];
        let scaleFlag = (p[2] === undefined || p[2] === null) ? true : !!p[2];
        let ptList = new self.oc.TColgp_HArray1OfPnt_2(1, pts.length);
        for (let i = 0; i < pts.length; i++) { ptList.SetValue(i + 1, toPnt(pts[i])); }
        let interp = new self.oc.GeomAPI_Interpolate_1(
          new self.oc.Handle_TColgp_HArray1OfPnt_2(ptList), periodic, 1.0e-6);
        if (tangents && tangents.length === 2 && pts.length !== 2) {
          // start/end tangents only (build123d passes them via Load this way)
          interp.Load_1(new self.oc.gp_Vec_4(tangents[0][0], tangents[0][1], tangents[0][2]),
                        new self.oc.gp_Vec_4(tangents[1][0], tangents[1][1], tangents[1][2]),
                        scaleFlag);
        } else if (tangents && tangents.length > 0) {
          if (tangents.length !== pts.length) {
            console.error("WireFromSegments: interp needs 2 or per-point tangents");
            continue;
          }
          let tanArr = new self.oc.TColgp_Array1OfVec_2(1, tangents.length);
          let flagArr = new self.oc.TColStd_HArray1OfBoolean_2(1, tangents.length);
          for (let i = 0; i < tangents.length; i++) {
            let t = tangents[i];
            let has = !!(t && t.length === 3);
            flagArr.SetValue(i + 1, has);
            tanArr.SetValue(i + 1, new self.oc.gp_Vec_4(has ? t[0] : 0, has ? t[1] : 0, has ? t[2] : 0));
          }
          interp.Load_2(tanArr, new self.oc.Handle_TColStd_HArray1OfBoolean_2(flagArr), scaleFlag);
        }
        interp.Perform();
        if (!interp.IsDone()) {
          console.error("WireFromSegments: B-spline interpolation failed");
          continue;
        }
        curveHandle = interp.Curve();
      } else if (kind === 'raw') {
        // pre-existing TopoDS_Edge passed through untouched (exact geometry
        // for edges that cannot be reconstructed as an analytic segment)
        let edge = self.oc.TopoDS_Cast.Edge_1(segments[s][2][0]);
        wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire());
        started = true;
        continue;
      } else if (kind === 'earc') {
        // elliptical arc: pts = [start, end] (chaining bookkeeping only),
        // params = [center, xdir, normal, major, minor, a1deg, a2deg]
        let p = segments[s][2];
        let ax2 = new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(p[0][0], p[0][1], p[0][2]),
          new self.oc.gp_Dir_5(p[2][0], p[2][1], p[2][2]));
        ax2.SetXDirection(new self.oc.gp_Dir_5(p[1][0], p[1][1], p[1][2]));
        let elips = new self.oc.gp_Elips_2(ax2, p[3], p[4]);
        let deg = Math.PI / 180;
        let arc = new self.oc.GC_MakeArcOfEllipse_1(elips, p[5] * deg, p[6] * deg, true).Value();
        let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(arc.get())).Edge();
        wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire());
        started = true;
        continue;
      } else if (kind === 'parab' || kind === 'hypr') {
        // conic arc: pts = [start, end] (chaining bookkeeping only), params =
        // [origin, xdir, normal, focal | [xr, yr], a1deg, a2deg, sense]
        // — build123d's Edge.make_parabola / make_hyperbola
        let p = segments[s][2];
        let ax2 = new self.oc.gp_Ax2_4(new self.oc.gp_Pnt_3(p[0][0], p[0][1], p[0][2]),
          new self.oc.gp_Dir_5(p[2][0], p[2][1], p[2][2]));
        ax2.SetXDirection(new self.oc.gp_Dir_5(p[1][0], p[1][1], p[1][2]));
        let deg = Math.PI / 180;
        let arc;
        if (kind === 'parab') {
          arc = new self.oc.GC_MakeArcOfParabola_1(
            new self.oc.gp_Parab_2(ax2, p[3]), p[4] * deg, p[5] * deg, !!p[6]).Value();
        } else {
          arc = new self.oc.GC_MakeArcOfHyperbola_1(
            new self.oc.gp_Hypr_2(ax2, p[3][0], p[3][1]), p[4] * deg, p[5] * deg,
            !!p[6]).Value();
        }
        let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(
          new self.oc.Handle_Geom_Curve_2(arc.get())).Edge();
        wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire());
        started = true;
        continue;
      } else if (kind === 'bspline') {
        // EXACT B-spline: pts = [start, end] (chaining bookkeeping only),
        // params = [poles, knots, mults, degree, weights, periodic]
        // — build123d's Edge.make_bspline
        let p = segments[s][2];
        let edge = BSplineEdge(p[0], p[1], p[2], p[3], p[4], p[5]);
        wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire());
        started = true;
        continue;
      } else {
        console.error("WireFromSegments: unknown segment kind '" + kind + "'");
        continue;
      }
      let edge = new self.oc.BRepBuilderAPI_MakeEdge_24(new self.oc.Handle_Geom_Curve_2(curveHandle.get())).Edge();
      wireBuilder.Add_2(new self.oc.BRepBuilderAPI_MakeWire_2(edge).Wire());
      started = true;
    }
    closeRun();
    if (wires.length === 1) { return wires[0]; }
    let builder = new self.oc.BRep_Builder();
    let compound = new self.oc.TopoDS_Compound();
    builder.MakeCompound(compound);
    for (let i = 0; i < wires.length; i++) { builder.Add(compound, wires[i]); }
    return compound;
  });
  self.sceneShapes.push(curWire);
  return curWire;
}

/** Hollow a solid with the given wall thickness, removing `openingFaces`
 *  (raw face sub-shapes of `shape`) — BRepOffsetAPI_MakeThickSolid, the same
 *  operation build123d's offset(openings=...) performs. Negative offset
 *  shells inward. */
function ThickSolidOffset(shape, openingFaces, offsetDistance, tolerance, keepShape) {
  if (!shape || shape.IsNull()) { console.error("ThickSolidOffset: input shape is null!"); return shape; }
  if (!tolerance) { tolerance = 1e-4; }
  let result = self.CacheOp(arguments, "ThickSolidOffset", () => {
    let facesToRemove = new self.oc.TopTools_ListOfShape();
    for (let i = 0; i < openingFaces.length; i++) { facesToRemove.Append(openingFaces[i]); }
    let mkThick = new self.oc.BRepOffsetAPI_MakeThickSolid();
    mkThick.MakeThickSolidByJoin(shape, facesToRemove, offsetDistance, tolerance,
      self.oc.BRepOffset_Mode.BRepOffset_Skin, false, false,
      self.oc.GeomAbs_JoinType.GeomAbs_Arc, false, new self.oc.Message_ProgressRange_1());
    return mkThick.Shape();
  });
  if (!keepShape) { self.sceneShapes = self.Remove(self.sceneShapes, shape); }
  self.sceneShapes.push(result);
  return result;
}

/** Thicken a face into a solid along its normals like build123d's
 *  Solid.thicken. COMPROMISE(thicken): upstream drives BRepOffset_MakeOffset
 *  with Thickening=true (offset shell + MakeMissingWalls + MakeSolid); that
 *  class is unbound here and BRepOffsetAPI_MakeThickSolid never builds the
 *  missing walls for open input. So this reconstructs the same solid
 *  manually: the offset surface comes from the identical BRepOffset engine
 *  (MakeThickSolidByJoin with no closing faces, Skin/Intersection join like
 *  upstream), the side walls are RULED ThruSections lofts between each
 *  boundary wire and its offset image (upstream's MakeMissingWalls also
 *  builds ruled walls between matching edges), and the three sheets are
 *  sewn and solidified. */
function ThickenSolid(surface, depth) {
  if (!surface || surface.IsNull()) { console.error("ThickenSolid: input surface is null!"); return surface; }
  let result = self.CacheOp(arguments, "ThickenSolid", () => {
    // Closed surfaces (e.g. a full sphere face) have no free boundary to
    // build walls from — upstream produces a hollow two-shell solid there,
    // which this reconstruction does not support.
    let edgeCounts = [];
    let edgeExp = new self.oc.TopExp_Explorer_2(surface,
      self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    for (; edgeExp.More(); edgeExp.Next()) {
      let e = self.oc.TopoDS_Cast.Edge_1(edgeExp.Current());
      let found = null;
      for (let k = 0; k < edgeCounts.length; k++) {
        if (edgeCounts[k].edge.IsSame(e)) { found = edgeCounts[k]; break; }
      }
      if (found) { found.count++; } else { edgeCounts.push({ edge: e, count: 1, degen: self.oc.BRep_Tool.Degenerated(e) }); }
    }
    let freeEdges = edgeCounts.filter((e) => e.count === 1 && !e.degen).length;
    if (freeEdges === 0) {
      console.error("ThickenSolid: the surface is closed (no free boundary); thicken of closed surfaces is not supported");
      return null;
    }

    // 1) the offset surface (pure offset of the input, no walls)
    let closingFaces = new self.oc.TopTools_ListOfShape();
    let mkThick = new self.oc.BRepOffsetAPI_MakeThickSolid();
    mkThick.MakeThickSolidByJoin(surface, closingFaces, depth, 1.0e-5,
      self.oc.BRepOffset_Mode.BRepOffset_Skin, true, false,
      self.oc.GeomAbs_JoinType.GeomAbs_Intersection, true,
      new self.oc.Message_ProgressRange_1());
    let offsetShell = mkThick.Shape();
    if (!offsetShell || offsetShell.IsNull()) {
      console.error("ThickenSolid: offset surface construction failed");
      return null;
    }

    // 2) pair each boundary wire with its offset image (nearest centroid)
    let wiresOf = (shape) => {
      let out = [];
      ForEachWire(shape, (i, wire) => { out.push(wire); });
      return out;
    };
    let wireCenter = (wire) => {
      let props = new self.oc.GProp_GProps_1();
      self.oc.BRepGProp.LinearProperties(wire, props, false, false);
      let p = props.CentreOfMass();
      return [p.X(), p.Y(), p.Z()];
    };
    let baseWires = wiresOf(surface);
    let offWires = wiresOf(offsetShell);
    if (baseWires.length === 0 || offWires.length === 0 ||
        baseWires.length !== offWires.length) {
      console.error("ThickenSolid: could not match boundary wires (" +
        baseWires.length + " vs " + offWires.length + ")");
      return null;
    }
    let offCenters = offWires.map(wireCenter);

    // 3) ruled walls per wire pair + 4) sew everything into a solid
    let facesToSew = [];
    ForEachFace(surface, (i, f) => { facesToSew.push(f); });
    ForEachFace(offsetShell, (i, f) => { facesToSew.push(f); });
    for (let i = 0; i < baseWires.length; i++) {
      let c = wireCenter(baseWires[i]);
      let best = 0, bestD = Infinity;
      for (let j = 0; j < offWires.length; j++) {
        let d = Math.pow(c[0] - offCenters[j][0], 2) +
                Math.pow(c[1] - offCenters[j][1], 2) +
                Math.pow(c[2] - offCenters[j][2], 2);
        if (d < bestD) { bestD = d; best = j; }
      }
      let loft = new self.oc.BRepOffsetAPI_ThruSections(false, true, 1.0e-6);
      loft.AddWire(self.oc.TopoDS_Cast.Wire_1(baseWires[i]));
      loft.AddWire(self.oc.TopoDS_Cast.Wire_1(offWires[best]));
      loft.Build(new self.oc.Message_ProgressRange_1());
      ForEachFace(loft.Shape(), (k, f) => { facesToSew.push(f); });
    }

    let sew = new self.oc.BRepBuilderAPI_Sewing(1.0e-5, true, true, true, false);
    for (let i = 0; i < facesToSew.length; i++) { sew.Add(facesToSew[i]); }
    sew.Perform(new self.oc.Message_ProgressRange_1());
    let solids = [];
    ForEachShell(sew.SewedShape(), (i, shell) => {
      let fixer = new self.oc.ShapeFix_Solid_1();
      let solid = fixer.SolidFromShell(shell);
      if (solid && !solid.IsNull()) { solids.push(solid); }
    });
    if (solids.length === 0) {
      console.error("ThickenSolid: sewing the thickened boundary failed");
      return null;
    }
    return solids[0];
  });
  self.sceneShapes = self.Remove(self.sceneShapes, surface);
  self.sceneShapes.push(result);
  return result;
}

/** Draft-angle ("tapered") extrusion of a planar face — LocOpe_DPrism, the
 *  primitive behind build123d's extrude(taper=...). Positive taper angles
 *  narrow the profile with height. */
function TaperExtrude(face, height, angleDeg, keepFace) {
  if (!face || face.IsNull()) { console.error("TaperExtrude: input face is null!"); return face; }
  let result = self.CacheOp(arguments, "TaperExtrude", () => {
    let f = face.ShapeType().value === 4 ? self.oc.TopoDS_Cast.Face_1(face) : face;
    // LocOpe_DPrism measures Height along the tapered slant; scale so the
    // resulting solid is `height` tall like build123d's extrude(taper=)
    let slant = height / Math.cos(angleDeg * (Math.PI / 180));
    let dprism = new self.oc.LocOpe_DPrism_2(f, slant, angleDeg * (Math.PI / 180));
    return dprism.Shape();
  });
  if (!keepFace) { self.sceneShapes = self.Remove(self.sceneShapes, face); }
  self.sceneShapes.push(result);
  return result;
}

/** Render text as a planar face for build123d-lite's Text: opentype.js
 *  outlines from the bundled Liberation Sans (what Linux fontconfig
 *  resolves 'Arial' to, so glyph geometry matches native build123d), plus
 *  OCCT-text-builder-compatible alignment offsets. Alignment references
 *  the FONT LAYOUT metrics (advance width, ascender/descender), not the
 *  ink bounding box — like Font_TextFormatter. */
function Text2D(text, size, fontName, halign, valign) {
  if (!fontName) { fontName = "FreeSans"; }
  let curText = self.CacheOp(arguments, "Text2D", () => {
    let face = _opentypeTextFace(text, size, fontName, true);
    if (!face) { return; }
    let font = self.loadedFonts[fontName];
    let upm = font.unitsPerEm;
    // Width for alignment: kerned advance PLUS a spurious kern(last, last)
    // pair — Font_TextFormatter (which build123d's Text uses) evaluates the
    // kerning of the final glyph against itself when flushing the line, and
    // matching it here makes centered text line up exactly.
    let advance = 0;
    let prev = null;
    for (const ch of text) {
      let g = font.charToGlyph(ch);
      if (prev) { advance += _kernValue(fontName, prev, g) / upm * size; }
      advance += g.advanceWidth / upm * size;
      prev = g;
    }
    if (prev) { advance += _kernValue(fontName, prev, prev) / upm * size; }
    // Vertical alignment uses the OS/2 typographic metrics (verified against
    // build123d 0.11.1: TOP = -typoAscender, CENTER = lineSpacing/2 -
    // typoAscender, BOTTOM = baseline).
    let os2 = font.tables.os2 || {};
    let typoAsc = (os2.sTypoAscender !== undefined ? os2.sTypoAscender : font.ascender) / upm * size;
    let typoDesc = (os2.sTypoDescender !== undefined ? os2.sTypoDescender : font.descender) / upm * size;
    let typoGap = (os2.sTypoLineGap !== undefined ? os2.sTypoLineGap : 0) / upm * size;
    let lineSpacing = typoAsc - typoDesc + typoGap;
    let dx = halign === 'left' ? 0 : halign === 'right' ? -advance : -advance / 2;
    let dy = valign === 'bottom' ? 0 :
             valign === 'top' ? -typoAsc : lineSpacing / 2 - typoAsc;
    // opentype glyph paths are y-DOWN (canvas convention) — mirror across
    // the baseline (bakes geometry, keeping hole orientations valid), then
    // reverse the face so its oriented normal is +Z like build123d text
    // (mirroring flips the surface handedness; extrusions and fuses follow
    // the ORIENTED normal)
    // The freshly built face MUST carry a stable hash before entering the
    // CacheOp'd Mirror below: un-hashed shapes hash as "{}" (ptr stripped),
    // which made every Text2D after the first REUSE the first text's
    // mirrored geometry (fresh alignment, stale glyphs).
    face.hash = self.oc.OCJS.HashCode(face, 100000000);
    let mirrored = Mirror([0, 1, 0], face);
    let translated = Translate([dx, dy, 0], mirrored);
    let moved;
    if (translated.ShapeType().value === 4) {
      moved = self.oc.TopoDS_Cast.Face_1(translated.Reversed());
    } else {
      // per-glyph compound: give each glyph face a +Z ORIENTED normal (the
      // same rule as the single-face branch). The mirror transform above
      // already flipped the sub-face orientation flags inside the compound
      // (BRepTools_TrsfModification keeps oriented normals consistent for
      // container shapes), so reverse CONDITIONALLY on the actual oriented
      // normal instead of blindly — a blind .Reversed() double-flips.
      let builder = new self.oc.BRep_Builder();
      let compound = new self.oc.TopoDS_Compound();
      builder.MakeCompound(compound);
      ForEachFace(translated, (i, f) => {
        builder.Add(compound, _faceNormal(f)[2] < 0 ? f.Reversed() : f);
      });
      compound.hash = self.oc.OCJS.HashCode(compound, 100000000);
      moved = compound;
    }
    self.sceneShapes = self.Remove(self.sceneShapes, moved);
    return moved;
  });
  if (curText) { self.sceneShapes.push(curText); }
  return curText;
}

/** Axis-aligned bounding box [minX,minY,minZ,maxX,maxY,maxZ] via
 *  BRepBndLib.AddOptimal — the exact box, no triangulation-tolerance
 *  padding, matching build123d's Shape.bounding_box(optimal=True).
 *  (The `deflection` parameter is legacy from the pre-OCCT-8.0.1 build,
 *  which had no Bnd_Box binding and meshed a deep copy instead.) */
function BoundingBox(shape, deflection) {
  if (!shape || shape.IsNull()) { console.error("BoundingBox: input shape is null!"); return null; }
  let box = new self.oc.Bnd_Box_1();
  self.oc.BRepBndLib.AddOptimal(shape, box, false, false);
  if (box.IsVoid()) { return null; }
  return [box.GetXMin(), box.GetYMin(), box.GetZMin(),
          box.GetXMax(), box.GetYMax(), box.GetZMax()];
}

/** Measure a shape for the build123d validation harness / lite bounding_box:
 *  volume (mm^3, absolute), surface area, unique face/edge counts, and the
 *  mesh-approximated bounding box. Returns a plain JS object. */
function MeasureShape(shape, deflection) {
  if (!shape || shape.IsNull()) { console.error("MeasureShape: input shape is null!"); return null; }
  let nFaces = 0; ForEachFace(shape, () => { nFaces++; });
  let nEdges = 0; ForEachEdge(shape, () => { nEdges++; });
  // COMPROMISE(volume-measure): VolumeProperties on OPEN faces yields
  // meaningless partial integrals — report 0 for shapes with no solid
  // (matches build123d's Sketch.volume). For compounds MIXING solids and
  // stray faces, this OCCT 8.0.1 build's VolumeProperties also picks up
  // spurious face contributions (7.x reported the solids' volume alone),
  // so volume is summed per-solid instead of one whole-shape integral.
  let nSolids = 0; ForEachSolid(shape, () => { nSolids++; });
  return {
    volume: nSolids > 0 ? SolidsVolume(shape) : 0,
    area: SurfaceArea(shape),
    faces: nFaces,
    edges: nEdges,
    bbox: BoundingBox(shape, deflection)
  };
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

/** 3-D convex hull of an array of [x,y,z] points via quickhull3d (pure JS,
 *  esbuild-bundled into the worker). Returns triangulated facets as arrays
 *  of vertex indices — the same convention as scipy's ConvexHull.simplices
 *  (used by build123d-lite's scipy.spatial shim). */
function ConvexHull3D(points) {
  return quickhull3d(points);
}

/** Sew a list of faces into shell(s) and build solid(s) — the OCCT calls
 *  behind build123d's Solid(Shell(faces)): BRepBuilderAPI_Sewing +
 *  ShapeFix_Solid::SolidFromShell (which also orients the shell outward).
 *  Returns a single solid, or a compound if the faces sew into multiple
 *  closed shells. */
function SewSolidFromFaces(faces) {
  let curSolid = self.CacheOp(arguments, "SewSolidFromFaces", () => {
    let sew = new self.oc.BRepBuilderAPI_Sewing(1.0e-6, true, true, true, false);
    for (let i = 0; i < faces.length; i++) { sew.Add(faces[i]); }
    sew.Perform(new self.oc.Message_ProgressRange_1());
    let sewed = sew.SewedShape();
    let solids = [];
    ForEachShell(sewed, (i, shell) => {
      let fixer = new self.oc.ShapeFix_Solid_1();
      let solid = fixer.SolidFromShell(shell);
      if (solid && !solid.IsNull()) { solids.push(solid); }
    });
    if (solids.length === 0) {
      console.error("SewSolidFromFaces: sewing produced no closed shell");
      return null;
    }
    if (solids.length === 1) { return solids[0]; }
    let builder = new self.oc.BRep_Builder();
    let compound = new self.oc.TopoDS_Compound();
    builder.MakeCompound(compound);
    for (let i = 0; i < solids.length; i++) { builder.Add(compound, solids[i]); }
    return compound;
  });
  self.sceneShapes.push(curSolid);
  return curSolid;
}

/** Intersect an infinite line with a shape's surface —
 *  BRepIntCurveSurface_Inter, exactly build123d's
 *  Shape.find_intersection_points. Returns [[point, unitNormalAtPoint,
 *  distanceAlongLine], ...] sorted by distance along the line. */
function IntersectLineShape(shape, origin, direction, tolerance) {
  if (!tolerance) { tolerance = 1e-6; }
  let pnt = new self.oc.gp_Pnt_3(origin[0], origin[1], origin[2]);
  let dir = new self.oc.gp_Dir_5(direction[0], direction[1], direction[2]);
  let line = new self.oc.gp_Lin_3(pnt, dir);
  let inter = new self.oc.BRepIntCurveSurface_Inter();
  inter.Init_2(shape, line, tolerance);
  let out = [];
  while (inter.More()) {
    let p = inter.Pnt();
    let face = inter.Face();
    let gpf = new self.oc.BRepGProp_Face_2(face, false);
    let np = new self.oc.gp_Pnt_1();
    let nv = new self.oc.gp_Vec_1();
    gpf.Normal(inter.U(), inter.V(), np, nv);
    let mag = nv.Magnitude();
    let n = mag > 1e-12 ? [nv.X() / mag, nv.Y() / mag, nv.Z() / mag] : [0, 0, 1];
    out.push([[p.X(), p.Y(), p.Z()], n, inter.W()]);
    inter.Next();
  }
  out.sort((a, b) => a[2] - b[2]);
  return out;
}

/** A TopoDS_Vertex at the given [x,y,z] point (BRepBuilderAPI_MakeVertex). */
function PointVertex(p) {
  let v = new self.oc.BRepBuilderAPI_MakeVertex(
    new self.oc.gp_Pnt_3(p[0], p[1], p.length > 2 ? p[2] : 0)).Vertex();
  v.hash = self.oc.OCJS.HashCode(v, 100000000);
  return v;
}

// --- Library Class (organizes initialization and self-registration) ---

/** Wraps initialization of all CAD standard library functions.
 *  CAD functions are regular function declarations (not class methods)
 *  to preserve `arguments.callee` access required by CacheOp. */
class CascadeStudioStandardLibrary {
  constructor() {
    // Instantiate utility dependencies
    this.utils = new CascadeStudioUtils();

    // Gordon curve-network surfaces (build123d Face.make_gordon_surface —
    // see GordonSurface.js). Engine is created lazily: oc must be live.
    let gordonEngine = null;
    self.GordonSurfaceFace = function (profiles, guides, tolerance) {
      if (!gordonEngine) { gordonEngine = createGordonEngine(self.oc); }
      // The engine's edgeToCurveData needs a downcast TopoDS_Edge; callers
      // hand generic TopoDS_Shape (single-edge wires included). Points pass
      // through as [x, y, z] arrays.
      const toEdge = (item) => {
        if (Array.isArray(item)) { return item; }
        const t = item.ShapeType().value;
        if (t === 6) { return self.oc.TopoDS_Cast.Edge_1(item); }
        let edge = null, count = 0;
        for (let ex = new self.oc.TopExp_Explorer_2(item, self.oc.TopAbs_ShapeEnum.TopAbs_EDGE, self.oc.TopAbs_ShapeEnum.TopAbs_SHAPE); ex.More(); ex.Next()) {
          edge = self.oc.TopoDS_Cast.Edge_1(ex.Current()); count++;
        }
        if (count !== 1) { throw new Error("make_gordon_surface: each profile/guide must be a single edge or a point (got " + count + " edges)"); }
        return edge;
      };
      return gordonEngine.gordonSurfaceFace(profiles.map(toEdge), guides.map(toEdge), tolerance);
    };

    // Assign all CAD API functions to self for eval() access
    self.Box = Box;
    self.Sphere = Sphere;
    self.PartialSphere = PartialSphere;
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
    self.MakeFace = MakeFace;
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
    self.UnifyWire = UnifyWire;
    self.Offset = Offset;
    self.OffsetWire = OffsetWire;
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
    self.NewEdges = NewEdges;
    self.EdgeSelector = EdgeSelector;
    self.FaceSelector = FaceSelector;

    // Measurement
    self.Volume = Volume;
    self.SolidsVolume = SolidsVolume;
    self.SurfaceArea = SurfaceArea;
    self.CenterOfMass = CenterOfMass;
    self.EdgeLength = EdgeLength;
    self.BoundingBox = BoundingBox;
    self.MeasureShape = MeasureShape;
    self.WireFromSegments = WireFromSegments;
    self.ThickSolidOffset = ThickSolidOffset;
    self.ThickenSolid = ThickenSolid;
    self.TaperExtrude = TaperExtrude;
    self.Text2D = Text2D;
    self.ScaleXYZ = ScaleXYZ;
    self.ScaleUniform = ScaleUniform;
    self.ReverseFace = ReverseFace;
    self.ReverseShape = ReverseShape;
    self.ProjectWireOnShape = ProjectWireOnShape;
    self.AsSingleFace = AsSingleFace;
    self._edgeParam = _edgeParam;
    self.TrimEdge = TrimEdge;
    self.ReverseEdgeOrWire = ReverseEdgeOrWire;
    self._edgeDistanceToPoint = _edgeDistanceToPoint;
    self._edgeParamAtPoint = _edgeParamAtPoint;
    self.ConcatEdgesToEdge = ConcatEdgesToEdge;
    self.ProjectEdgeOnFace = ProjectEdgeOnFace;
    self.ExtendSplineOnFace = ExtendSplineOnFace;
    self.InterpolatedEdge = InterpolatedEdge;
    self.ExtremaEdgeParams = ExtremaEdgeParams;
    self.FillingFace = FillingFace;
    self.WireFromEdgesFixed = WireFromEdgesFixed;
    self._wireIsClosed = _wireIsClosed;
    self.OrderedEdges = OrderedEdges;
    self.OffsetPlanarWire = OffsetPlanarWire;
    self._edgeArcCenter = _edgeArcCenter;
    self._edgeArcRadius = _edgeArcRadius;
    self._edgeArcNormal = _edgeArcNormal;
    self._edgeDerivativeAt = _edgeDerivativeAt;
    self.BSplineEdge = BSplineEdge;
    self._distShapeShape = _distShapeShape;
    self._faceCurvatureSign = _faceCurvatureSign;
    self.CircularEdge = CircularEdge;
    self.EdgeIsInterior = EdgeIsInterior;
    self.HLRProject = HLRProject;
    self.SurfaceFromPoints = SurfaceFromPoints;
    self.PipeShellSweep = PipeShellSweep;
    self.ExportSTL = ExportSTL;
    self.DraftAngleFaces = DraftAngleFaces;
    self.FaceWithHoles = FaceWithHoles;

    // Per-entity introspection helpers (used by build123d-lite's Python
    // selectors: filter_by/group_by/sort_by need positions, directions,
    // lengths, areas and geometry types of individual edges/faces).
    self._edgeMidpoint = _edgeMidpoint;
    self._edgeLength = _edgeLength;
    self._edgeCurveType = _edgeCurveType;
    self._edgeDirection = _edgeDirection;
    self._faceCentroid = _faceCentroid;
    self._faceArea = _faceArea;
    self._faceNormal = _faceNormal;
    self._faceUDir = _faceUDir;
    self._faceUVBounds = _faceUVBounds;
    self._faceD1 = _faceD1;
    self._faceParamsAtPoint = _faceParamsAtPoint;
    self._faceNormalAt = _faceNormalAt;
    self._faceSurfaceType = _faceSurfaceType;
    self._faceOuterWire = _faceOuterWire;
    self._sameShape = _sameShape;
    self._edgeIsForward = _edgeIsForward;
    self._vertexPoint = _vertexPoint;
    self._edgePointAt = _edgePointAt;
    self._edgeTangentAt = _edgeTangentAt;
    self.MakeCompound = MakeCompound;
    self.FilletFace2D = FilletFace2D;

    // Additional primitives & operations
    self.Wedge = Wedge;
    self.Section = Section;
    self.ConvexHull3D = ConvexHull3D;
    self.SewSolidFromFaces = SewSolidFromFaces;
    self.IntersectLineShape = IntersectLineShape;
    self.PointVertex = PointVertex;
  }
}

export { CascadeStudioStandardLibrary };
