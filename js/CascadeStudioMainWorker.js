var oc = null, externalShapes = {}, sceneShapes = [],
  GUIState, fullShapeEdgeHashes = {}, fullShapeFaceHashes = {},
  robotoFont = null, curFontURL = '../fonts/Consolas.ttf', currentShape;

// Capture Logs and Errors and forward them to the main thread
let realConsoleLog = console.log;
let realConsoleError = console.error;
console.log = function(message) {
  setTimeout(() => {
    postMessage({ type: "log", payload: message });
  }, 0);
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

// Import the set of scripts we'll need to perform all the CAD operations
importScripts(
  '../node_modules/three/build/three.min.js',
  './CascadeStudioStandardLibrary.js',
  './openCascadeHelper.js',
  '../node_modules/opencascade.js/dist/opencascade.wasm.js',
  '../node_modules/opentype.js/dist/opentype.min.js');

opentype.load(curFontURL, function (err, font) { //'../fonts/Roboto-Black.ttf' '../fonts/Papyrus.ttf' '../fonts/Consolas.ttf'
    if (err) { console.log(err); }
    robotoFont = font;
});

// Load the full Open Cascade Web Assembly Module
new opencascade({
  locateFile(path) {
    if (path.endsWith('.wasm')) {
      return "../node_modules/opencascade.js/dist/opencascade.wasm.wasm";
    }
    return path;
  }
}).then((openCascade) => {
  // Register the "OpenCascade" WebAssembly Module under the shorthand "oc"
  var oc = openCascade;
  openCascadeHelper.setOpenCascade(oc);

  // Ping Pong Messages Back and Forth based on their registration in messageHandlers
  onmessage = function (e) {
    //console.log(e.data.type);
    let response = messageHandlers[e.data.type](e.data.payload);
    if (response) { postMessage({ "type": e.data.type, payload: response }); };
  }

  // Initial Evaluation after everything has been loaded...
  postMessage({ type: "startupCallback" });
});

var messageHandlers = {};
function Evaluate(payload) {
  opNumber = 0; // This keeps track of the progress of the evaluation
  GUIState = payload.GUIState;
  try {
    eval(payload.code);
  } catch (e) {
    //console.error(JSON.stringify(e));
    postMessage({ type: "resetWorking" });
  }
}
messageHandlers["Evaluate"] = Evaluate;

function combineAndRenderShapes(payload) {
  currentShape     = new oc.TopoDS_Compound();
  let sceneBuilder = new oc.BRep_Builder();
  sceneBuilder.MakeCompound(currentShape);
  let fullShapeEdgeHashes = {};
  let fullShapeFaceHashes = {};
  if (sceneShapes.length > 0) {
    for (let shapeInd = 0; shapeInd < sceneShapes.length; shapeInd++) {
      if (!sceneShapes[shapeInd] || sceneShapes[shapeInd].IsNull()) {
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
      //console.error("Adding Shape of Type: "+sceneShapes[shapeInd].ShapeType());
      sceneBuilder.Add(currentShape, sceneShapes[shapeInd]);
    }

    // Tesellate
    const facesAndEdges = openCascadeHelper.tessellate(currentShape,
      payload.maxDeviation||0.1, fullShapeEdgeHashes, fullShapeFaceHashes);
    sceneShapes = [];
    return facesAndEdges;
  } else {
    console.error("There were no scene shapes returned!");
    return [null, null];
  }
}
messageHandlers["combineAndRenderShapes"] = combineAndRenderShapes;

// File Import and Export Utilities
function loadPrexistingExternalFiles(externalFileDict) {
  console.log("Loading Pre-Existing external files...");
  for (let key in externalFileDict) {
    if (key.includes(".stl")) {
        importSTL       (key, externalFileDict[key].content);
    } else {
        importSTEPorIGES(key, externalFileDict[key].content);
    }
  }
}
messageHandlers["loadPrexistingExternalFiles"] = loadPrexistingExternalFiles;
const loadFileSync = async (file) => {
  return new Promise((resolve, reject) => {
    resolve(new FileReaderSync().readAsText(file));
  });
}
function loadFiles(files) {
  let extFiles = {};
  sceneShapes = [];
  for (let i = 0; i < files.length; i++) {
    var lastImportedShape = null;
    loadFileSync(files[i]).then(async (fileText) => {
      const fileName = files[i].name;
      if (fileName.includes(".stl")) {
        lastImportedShape = importSTL(fileName, fileText);
      } else {
        lastImportedShape = importSTEPorIGES(fileName, fileText);
      }
      extFiles[fileName] = { content: fileText };
    }).then(async () => {
      if (lastImportedShape) {
        sceneShapes.push(lastImportedShape);
      }
      if (i === files.length - 1) {
        if (lastImportedShape) {
          console.log("Imports complete, rendering shapes now...");
          combineAndRenderShapes({ maxDeviation: GUIState['MeshRes'] || 0.1 });
        }
      }
      //consoleGolden.setState(extFiles);
      postMessage({ "type": "loadFiles", payload: extFiles });
      //return extFiles;
    });
  };
}
messageHandlers["loadFiles"] = loadFiles;

function importSTEPorIGES(fileName, fileText) {
  // Writes the uploaded file to Emscripten's Virtual Filesystem
  oc.FS.createDataFile("/", fileName, fileText, true, true);

  // Choose the correct OpenCascade file parsers to read the CAD file
  var reader = null;
  if (fileName.endsWith(".step") || fileName.endsWith(".stp")) {
    reader = new oc.STEPControl_Reader();
  } else if (fileName.endsWith(".iges") || fileName.endsWith(".igs")) {
    reader = new oc.IGESControl_Reader();
  } else { console.error("opencascade.js can't parse this extension! (yet)"); }

  let readResult = reader.ReadFile(fileName);            // Read the file
  if (readResult === 1) {
    console.log(fileName + " loaded successfully!     Converting to OCC now...");
    let numRootsTransferred = reader.TransferRoots();    // Translate all transferable roots to OpenCascade
    let stepShape           = reader.OneShape();         // Obtain the results of translation in one OCCT shape
    
    // Add to the externalShapes dictionary
    externalShapes[fileName] = new oc.TopoDS_Shape(stepShape);
    console.log("Shape Import complete! Use sceneShapes.push(externalShapes['"+fileName+"']); to add it to the scene!");
    
    // Remove the file when we're done (otherwise we run into errors on reupload)
    oc.FS.unlink("/" + fileName);
    
    return externalShapes[fileName];
  } else {
    console.error("Something in OCCT went wrong trying to read " + fileName);
    return null;
  }
}
function importSTL(fileName, fileText) {
  // Writes the uploaded file to Emscripten's Virtual Filesystem
  oc.FS.createDataFile("/", fileName, fileText, true, true);

  // Choose the correct OpenCascade file parsers to read the STL file
  var reader    = new oc.StlAPI_Reader();
  let readShape = new oc.TopoDS_Shape ();

  if (reader.Read(readShape, fileName)) {
    console.log(fileName + " loaded successfully!     Converting to OCC now...");
    
    // Add to the externalShapes dictionary
    externalShapes[fileName] = readShape;
    console.log("Shape Import complete! Use sceneShapes.push(externalShapes['" + fileName + "']); to see it!");
    
    // Remove the file when we're done (otherwise we run into errors on reupload)
    oc.FS.unlink("/" + fileName);
    
    return externalShapes[fileName];
  } else {
    console.log("Something in OCCT went wrong trying to read " + fileName + ".  \n" +
      "Cascade Studio only imports small ASCII stl files for now!");
    return null;
  }
}

// NEEDS currentShape defined!!
function saveShapeSTEP (filename = "CascadeStudioPart.step") {
  let writer = new oc.STEPControl_Writer();
  let transferResult = writer.Transfer(currentShape, 0);
  if(transferResult === 1){
    let writeResult = writer.Write(filename);
    if(writeResult === 1){
      let stepFileText = oc.FS.readFile("/" + filename, { encoding:"utf8" });
      oc.FS.unlink("/" + filename);

      return URL.createObjectURL( new Blob([stepFileText], { type: 'text/plain' }) );
    }else{
      console.error("WRITE STEP FILE FAILED.");
    }
  }else{
    console.error("TRANSFER TO STEP WRITER FAILED.");
  }
}
messageHandlers["saveShapeSTEP"] = saveShapeSTEP;

// Remove the externally imported shapes from the project
function clearExternalFiles () {
  externalShapes = {};
}
messageHandlers["clearExternalFiles"] = clearExternalFiles;