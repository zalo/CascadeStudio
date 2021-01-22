import "babel-polyfill";
import { initOpenCascade } from "../../static_node_modules/opencascade.js";

import {
  oc,
  setOc,
  messageHandlers,
  setGUIState,
  currentShape,
  setCurrentShape,
  opNumber,
  setOpNumber,
  currentLineNumber,
  argCache,
  currentOp,
  usedHashes,
  setUsedHashes,
  resetExternalShapes
} from "./CascadeStudioWorkerState";
import * as remainingGlobals from "./CascadeStudioWorkerState";
import {
  sceneShapes,
  resetSceneShapes
} from "./CascadeStudioSceneShapesService";
import {
  saveShapeSTEP,
  loadFiles,
  loadPrexistingExternalFiles
} from "./CascadeStudioFileUtils";
import * as sceneShapesService from "./CascadeStudioSceneShapesService";
import { ShapeToMesh } from "./CascadeStudioShapeToMesh.js";
import * as standardLibraryModule from "./CascadeStudioStandardLibrary.js";
const { ForEachEdge, ForEachFace } = standardLibraryModule;

// Capture Logs and Errors and forward them to the main thread

const runCode = code => {
  // making the following available to eval
  const { externalShapes } = remainingGlobals;
  const { RemoveFromSceneShapes, sceneShapes } = sceneShapesService;
  const {
    BSpline,
    Box,
    Button,
    ChamferEdges,
    Checkbox,
    Circle,
    Cone,
    Cylinder,
    Difference,
    Extrude,
    FilletEdges,
    ForEachEdge,
    ForEachFace,
    ForEachShell,
    ForEachSolid,
    ForEachVertex,
    ForEachWire,
    GetNumSolidsInCompound,
    GetSolidFromCompound,
    GetWire,
    Intersection,
    Loft,
    Offset,
    Pipe,
    Polygon,
    RemoveInternalEdges,
    Revolve,
    Rotate,
    RotatedExtrude,
    Scale,
    Sketch,
    Slider,
    Sphere,
    Text3D,
    Transform,
    Translate,
    Union
  } = standardLibraryModule;
  eval(code);
};

let realConsoleLog   = console.log;
let realConsoleError = console.error;
console.log = function (message) {
  //postMessage({ type: "log", payload: message });
  setTimeout(() => { postMessage({ type: "log", payload: message }); }, 0);
  realConsoleLog.apply(console, arguments);
};
console.error = function (err, url, line, colno, errorObj) {
  postMessage({ type: "resetWorking" });
  setTimeout(() => {
    err.message = "INTERNAL OPENCASCADE ERROR DURING GENERATE: " + err.message;
    throw err; 
  }, 0);
  
  realConsoleError.apply(console, arguments);
}; // This is actually accessed via worker.onerror in the main thread

initOpenCascade().then(openCascade => {
  // Register the "OpenCascade" WebAssembly Module under the shorthand "oc"
  setOc(openCascade);

  // Ping Pong Messages Back and Forth based on their registration in messageHandlers
  onmessage = function (e) {
    let response = messageHandlers[e.data.type](e.data.payload);
    if (response) { postMessage({ "type": e.data.type, payload: response }); };
  }

  // Initial Evaluation after everything has been loaded...
  postMessage({ type: "startupCallback" });
});
/** This function evaluates `payload.code` (the contents of the Editor Window)
 *  and sets the GUI State. */
function Evaluate(payload) {
  setOpNumber(0);
  setGUIState(payload.GUIState);
  try {
    runCode(payload.code);
  } catch (e) {
    setTimeout(() => {
      e.message = "Line " + currentLineNumber + ": "  + currentOp + "() encountered  " + e.message;
      throw e;
    }, 0);
  } finally {
    postMessage({ type: "resetWorking" });
    // Clean Cache; remove unused Objects
    for (let hash in argCache) {
      if (!usedHashes.hasOwnProperty(hash)) { delete argCache[hash]; } }
    setUsedHashes({});
  }
}
messageHandlers["Evaluate"] = Evaluate;
messageHandlers["saveShapeSTEP"] = saveShapeSTEP;
/** Removes the externally imported shapes/files from the project. */ 
messageHandlers["clearExternalFiles"] = resetExternalShapes;
messageHandlers["loadFiles"] = loadFiles;
messageHandlers["loadPrexistingExternalFiles"] = loadPrexistingExternalFiles;

/**This function accumulates all the shapes in `sceneShapes` into the `TopoDS_Compound` `currentShape`
 * and converts it to a mesh (and a set of edges) with `ShapeToMesh()`, and sends it off to be rendered. */
function combineAndRenderShapes(payload) {
  // Initialize currentShape as an empty Compound Solid
  setCurrentShape(new oc.TopoDS_Compound());
  let sceneBuilder = new oc.BRep_Builder();
  sceneBuilder.MakeCompound(currentShape);
  let fullShapeEdgeHashes = {}; let fullShapeFaceHashes = {};
  postMessage({ "type": "Progress", "payload": { "opNumber": opNumber, "opType": "Combining Shapes" } });
  setOpNumber(opNumber + 1);

  // If there are sceneShapes, iterate through them and add them to currentShape
  if (sceneShapes.length > 0) {
    for (let shapeInd = 0; shapeInd < sceneShapes.length; shapeInd++) {
      if (!sceneShapes[shapeInd] || !sceneShapes[shapeInd].IsNull || sceneShapes[shapeInd].IsNull()) {
        console.error("Null Shape detected in sceneShapes; skipping: " + JSON.stringify(sceneShapes[shapeInd]));
        continue;
      }
      if (!sceneShapes[shapeInd].ShapeType) {
        console.error("Non-Shape detected in sceneShapes; " +
          "are you sure it is a TopoDS_Shape and not something else that needs to be converted to one?");
        console.error(JSON.stringify(sceneShapes[shapeInd]));
        continue;
      }

      // Scan the edges and faces and add to the edge list
      Object.assign(fullShapeEdgeHashes, ForEachEdge(sceneShapes[shapeInd], (index, edge) => { }));
      ForEachFace(sceneShapes[shapeInd], (index, face) => {
        fullShapeFaceHashes[face.HashCode(100000000)] = index;
      });

      sceneBuilder.Add(currentShape, sceneShapes[shapeInd]);
    }

    // Use ShapeToMesh to output a set of triangulated faces and discretized edges to the 3D Viewport
    postMessage({ "type": "Progress", "payload": { "opNumber": opNumber, "opType": "Triangulating Faces" } });
    setOpNumber(opNumber + 1);
    let facesAndEdges = ShapeToMesh(currentShape,
      payload.maxDeviation||0.1, fullShapeEdgeHashes, fullShapeFaceHashes);
    resetSceneShapes();
    postMessage({ "type": "Progress", "payload": { "opNumber": opNumber, "opType": "" } }); // Finish the progress
    return facesAndEdges;
  } else {
    console.error("There were no scene shapes returned!");
  }
  postMessage({ "type": "Progress", "payload": { "opNumber": opNumber, "opType": "" } });
}
messageHandlers["combineAndRenderShapes"] = combineAndRenderShapes;
