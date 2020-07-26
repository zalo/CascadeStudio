function Box (x, y, z, centered = false) {
  let curBox = new oc.BRepPrimAPI_MakeBox(x, y, z).Shape();
  if (centered) { Translate([-x / 2, -y / 2, -z / 2], curBox); }
  sceneShapes.push(curBox);
  return curBox;
}

function Sphere (radius) {
  let spherePlane = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, 0), oc.gp.prototype.DZ());
  let curSphere = new oc.BRepPrimAPI_MakeSphere(spherePlane, radius).Shape();
  sceneShapes.push(curSphere);
  return curSphere;
}

function Cylinder (radius, height, centered=false) {
  let cylinderPlane = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, centered ? -height / 2:0), new oc.gp_Dir(0, 0, 1));
  let curCylinder = new oc.BRepPrimAPI_MakeCylinder(cylinderPlane, radius, height).Shape();
  sceneShapes.push(curCylinder);
  return curCylinder;
}

function Cone(radius1, radius2, height) {
  //console.error("Cone Not Implementable Yet!"); return;
  let curCone = new oc.BRepPrimAPI_MakeCone(radius1, radius2, height).Shape();
  sceneShapes.push(curCone);
  return curCone;
}

function Translate(offset = [0, 0, 0], ...args) {
  let transformation = new oc.gp_Trsf();
  transformation.SetTranslation(new oc.gp_Vec(offset[0], offset[1], offset[2]));
  let translation = new oc.TopLoc_Location(transformation);
  if (args.length === 1) {      // Do the normal translation
    args[0].Move(translation);
    return args[0];
  } else if (args.length > 1) { // Combine them somehow for a multitranslation
    console.error("Multi Translate Not Implemented Yet!");
  }
}

function Rotate(axis = [0, 1, 0], degrees = 0, ...args) {
  let transformation = new oc.gp_Trsf();
  transformation.SetRotation(
    new oc.gp_Ax1(new oc.gp_Pnt(0, 0, 0), new oc.gp_Dir(
      new oc.gp_Vec(axis[0], axis[1], axis[2]))), degrees*0.0174533);
  let rotation = new oc.TopLoc_Location(transformation);
  if (args.length === 1) {      // Do the normal rotation
    args[0].Move(rotation);
    return args[0];
  } else if (args.length > 1) { // Combine them somehow for a multirotation
    console.error("Multi Rotate Not Implemented Yet!");
  }
}

function Scale(scale = 1, ...args) {
  let transformation = new oc.gp_Trsf();
  transformation.SetScaleFactor(scale);
  let scaleTrans = new oc.TopLoc_Location(transformation);
  if (args.length === 1) {      // Do the normal scaling
    args[0].Move(scaleTrans);
    return args[0];
  } else if (args.length > 1) { // Combine them somehow for a multiscale
    console.error("Multi Scale Not Implemented Yet!");
  }
}

function Union(objectsToJoin = [], keepObjects = false) {
  let combined = objectsToJoin[0];
  if (objectsToJoin.length > 1) {
    for (let i = 0; i < objectsToJoin.length; i++) {
      if (i > 0) { combined = new oc.BRepAlgoAPI_Fuse(combined, objectsToJoin[i]).Shape(); }
      if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToJoin[i]); }
    }
  }
  sceneShapes.push(combined);
  return combined;
}

function Difference(mainBody, objectsToSubtract = [], keepObjects = false) {
  let difference = mainBody;
  if (!keepObjects) { sceneShapes = Remove(sceneShapes, mainBody); }
  if (objectsToSubtract.length >= 1) {
    for (let i = 0; i < objectsToSubtract.length; i++) {
      difference = new oc.BRepAlgoAPI_Cut(difference, objectsToSubtract[i]).Shape();
      if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToSubtract[i]); }
    }
  }
  sceneShapes.push(difference);
  return difference;
}

function Intersection(objectsToIntersect = [], keepObjects = false) {
  let intersected = objectsToIntersect[0];
  if (objectsToIntersect.length > 1) {
    for (let i = 0; i < objectsToIntersect.length; i++) {
      if (i > 0) { intersected = new oc.BRepAlgoAPI_Common(intersected, objectsToIntersect[i]).Shape(); }
      if (!keepObjects) { sceneShapes = Remove(sceneShapes, objectsToIntersect[i]); }
    }
  }
  sceneShapes.push(intersected);
  return intersected;
}

function Slider(name = "Val", defaultValue = 0.5, min = 0.0, max = 1.0, callback = monacoEditor.evaluateCode, realTime=false) {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  GUIState[name + "Range"] = [min, max];
  guiPanel.addSlider(GUIState, name, name + 'Range', { onFinish: () => { callback(); }, onChange: () => { if (realTime) { callback(); } } });
  return GUIState[name];
}

function Button(name = "Action", callback = monacoEditor.evaluateCode) {
  guiPanel.addButton(name, () => { callback(); });
}

function Checkbox(name = "Toggle", defaultValue = false, callback = monacoEditor.evaluateCode) {
  if (!(name in GUIState)) { GUIState[name] = defaultValue; }
  guiPanel.addButton(GUIState, name, { onChange: () => { callback(); } });
}

function Remove(inputArray, objectToRemove) {
  return inputArray.filter((el) => { return el !== objectToRemove; });
}
