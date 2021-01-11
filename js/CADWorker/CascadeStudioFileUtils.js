// File Import and Export Utilities

/** This function synchronously loads the "files" in the 
 * current project into the `externalFiles` dictionary upon startup.*/
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

/** This function synchronously reads the text contents of a file. */
const loadFileSync = async (file) => {
  return new Promise((resolve, reject) => {
    resolve(new FileReaderSync().readAsText(file));
  });
}

/** This function synchronously loads a list of files into the 
 * `externalShapes` dictionary and renders them to the viewport. */
function loadFiles(files) {
  let extFiles = {};
  sceneShapes = [];
  for (let i = 0; i < files.length; i++) {
    var lastImportedShape = null;
    loadFileSync(files[i]).then(async (fileText) => {
      let fileName = files[i].name;
      if (fileName.toLowerCase().includes(".stl")) {
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
          let response = messageHandlers["combineAndRenderShapes"]({ maxDeviation: GUIState['MeshRes'] || 0.1 });
          postMessage({ "type": "combineAndRenderShapes", payload: response });
        }
      }
      //consoleGolden.setState(extFiles);
      postMessage({ "type": "loadFiles", payload: extFiles });
      //return extFiles;
    });
  };
}
messageHandlers["loadFiles"] = loadFiles;

/** This function parses the ASCII contents of a `.STEP` or `.IGES` 
 * File as a Shape into the `externalShapes` dictionary. */
function importSTEPorIGES(fileName, fileText) {
  // Writes the uploaded file to Emscripten's Virtual Filesystem
  oc.FS.createDataFile("/", fileName, fileText, true, true);

  // Choose the correct OpenCascade file parsers to read the CAD file
  var reader = null; let tempFilename = fileName.toLowerCase();
  if (tempFilename.endsWith(".step") || tempFilename.endsWith(".stp")) {
    reader = new oc.STEPControl_Reader();
  } else if (tempFilename.endsWith(".iges") || tempFilename.endsWith(".igs")) {
    reader = new oc.IGESControl_Reader();
  } else { console.error("opencascade.js can't parse this extension! (yet)"); }

  let readResult = reader.ReadFile(fileName);            // Read the file
  if (readResult === 1) {
    console.log(fileName + " loaded successfully!     Converting to OCC now...");
    reader.TransferRoots();                              // Translate all transferable roots to OpenCascade
    let stepShape           = reader.OneShape();         // Obtain the results of translation in one OCCT shape
    
    // Add to the externalShapes dictionary
    externalShapes[fileName] = new oc.TopoDS_Shape(stepShape);
    externalShapes[fileName].hash = stringToHash(fileName);
    console.log("Shape Import complete! Use sceneShapes.push(externalShapes['"+fileName+"']); to add it to the scene!");
    
    // Remove the file when we're done (otherwise we run into errors on reupload)
    oc.FS.unlink("/" + fileName);
    
    return externalShapes[fileName];
  } else {
    console.error("Something in OCCT went wrong trying to read " + fileName);
    return null;
  }
}

/** This function parses the contents of an ASCII .STL File as a Shape 
 * into the `externalShapes` dictionary. */
function importSTL(fileName, fileText) {
  // Writes the uploaded file to Emscripten's Virtual Filesystem
  oc.FS.createDataFile("/", fileName, fileText, true, true);

  // Choose the correct OpenCascade file parsers to read the STL file
  var reader    = new oc.StlAPI_Reader();
  let readShape = new oc.TopoDS_Shape ();

  if (reader.Read(readShape, fileName)) {
    console.log(fileName + " loaded successfully!     Converting to OCC now...");
    
    // Convert Shell to Solid as is expected
    let solidSTL = new oc.BRepBuilderAPI_MakeSolid();
    solidSTL.Add(new oc.TopoDS_Shape(readShape));

    // Add to the externalShapes dictionary
    externalShapes[fileName] = new oc.TopoDS_Shape(solidSTL.Solid());
    externalShapes[fileName].hash = stringToHash(fileName);
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

/** This function returns `currentShape` `.STEP` file content.  
 * `currentShape` is set upon the successful completion of `combineAndRenderShapes()`.  */
function saveShapeSTEP (filename = "CascadeStudioPart.step") {
  let writer = new oc.STEPControl_Writer();
  // Convert to a .STEP File
  let transferResult = writer.Transfer(currentShape, 0);
  if (transferResult === 1) {
    // Write the STEP File to the virtual Emscripten Filesystem Temporarily
    let writeResult = writer.Write(filename);
    if (writeResult === 1) {
      // Read the STEP File from the filesystem and clean up
      let stepFileText = oc.FS.readFile("/" + filename, { encoding:"utf8" });
      oc.FS.unlink("/" + filename);

      // Return the contents of the STEP File
      return stepFileText;
    }else{
      console.error("WRITE STEP FILE FAILED.");
    }
  }else{
    console.error("TRANSFER TO STEP WRITER FAILED.");
  }
}
messageHandlers["saveShapeSTEP"] = saveShapeSTEP;

/** Removes the externally imported shapes/files from the project. */ 
messageHandlers["clearExternalFiles"] = () => { externalShapes = {}; };
