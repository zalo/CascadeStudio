// File Import and Export Utilities

import { csEmit } from './Emit.js';

/** Handles file import/export operations for the CAD worker. */
class CascadeStudioFileIO {
  constructor() {
    // Register message handlers
    self.messageHandlers["loadPrexistingExternalFiles"] = this.loadPrexistingExternalFiles.bind(this);
    self.messageHandlers["loadFiles"] = this.loadFiles.bind(this);
    self.messageHandlers["saveShapeSTEP"] = this.saveShapeSTEP.bind(this);
    self.messageHandlers["clearExternalFiles"] = () => { self.externalShapes = {}; };

    // Expose methods on self for eval() access
    self.loadPrexistingExternalFiles = this.loadPrexistingExternalFiles.bind(this);
    self.loadFiles = this.loadFiles.bind(this);
    self.importSTEPorIGES = this.importSTEPorIGES.bind(this);
    self.importSTL = this.importSTL.bind(this);
    self.saveShapeSTEP = this.saveShapeSTEP.bind(this);
    self.GetExternalShape = this.getExternalShape.bind(this);
  }

  /** Look up an already-imported external shape by file name, tolerating a
   *  full path (only the base name is keyed) and case. Python mode's
   *  `import_step()` resolves its asset this way: the worker has no
   *  filesystem, so the harness/app hands the file over ahead of the run
   *  (CascadeAPI.loadExternalFiles → loadPrexistingExternalFiles) and the
   *  script's `os.path.join(dirname(__file__), "x.step")` is matched on
   *  "x.step". Returns null when the asset was never delivered. */
  getExternalShape(name) {
    const shapes = self.externalShapes || {};
    if (shapes[name]) { return shapes[name]; }
    const base = String(name).split('/').pop().toLowerCase();
    for (const key of Object.keys(shapes)) {
      if (key.split('/').pop().toLowerCase() === base) { return shapes[key]; }
    }
    return null;
  }

  /** Synchronously loads the "files" in the current project into
   * the `externalFiles` dictionary upon startup. */
  loadPrexistingExternalFiles(externalFileDict) {
    console.log("Loading Pre-Existing external files...");
    const loaded = [];
    for (let key in externalFileDict) {
      let shape = null;
      try {
        shape = key.includes(".stl")
          ? this.importSTL(key, externalFileDict[key].content)
          : this.importSTEPorIGES(key, externalFileDict[key].content);
      } catch (e) {
        console.log("Failed to import " + key + ": " + e.message);
      }
      if (shape) { loaded.push(key); }
    }
    // Reported back so callers can WAIT for the import (CascadeAPI's
    // loadExternalFiles awaits this) instead of racing the next evaluation.
    return loaded;
  }

  /** Synchronously loads a list of files into the `externalShapes`
   * dictionary and renders them to the viewport. */
  loadFiles(files) {
    let extFiles = {};
    self.sceneShapes = [];
    for (let i = 0; i < files.length; i++) {
      var lastImportedShape = null;
      CascadeStudioFileIO.loadFileSync(files[i]).then(async (fileText) => {
        let fileName = files[i].name;
        if (fileName.toLowerCase().includes(".stl")) {
          lastImportedShape = this.importSTL(fileName, fileText);
        } else {
          lastImportedShape = this.importSTEPorIGES(fileName, fileText);
        }
        extFiles[fileName] = { content: fileText };
      }).then(async () => {
        if (lastImportedShape) {
          self.sceneShapes.push(lastImportedShape);
        }
        if (i === files.length - 1) {
          if (lastImportedShape) {
            console.log("Imports complete, rendering shapes now...");
            let response = self.messageHandlers["combineAndRenderShapes"]({ maxDeviation: self.GUIState['MeshRes'] || 0.1 });
            csEmit({ "type": "combineAndRenderShapes", payload: response });
          }
        }
        csEmit({ "type": "loadFiles", payload: extFiles });
      });
    }
  }

  /** Parses the ASCII contents of a `.STEP` or `.IGES` File as a
   * Shape into the `externalShapes` dictionary. */
  importSTEPorIGES(fileName, fileText) {
    let oc = self.oc;
    oc.FS.createDataFile("/", fileName, fileText, true, true);

    var reader = null; let tempFilename = fileName.toLowerCase();
    if (tempFilename.endsWith(".step") || tempFilename.endsWith(".stp")) {
      reader = new oc.STEPControl_Reader_1();
    } else if (tempFilename.endsWith(".iges") || tempFilename.endsWith(".igs")) {
      reader = new oc.IGESControl_Reader_1();
    } else { console.error("opencascade.js can't parse this extension! (yet)"); }

    let readResult = reader.ReadFile(fileName);
    if (readResult === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      console.log(fileName + " loaded successfully!     Converting to OCC now...");
      reader.TransferRoots(new oc.Message_ProgressRange_1());
      let stepShape = reader.OneShape();

      self.externalShapes[fileName] = stepShape;
      self.externalShapes[fileName].hash = self.stringToHash(fileName);
      console.log("Shape Import complete! Use sceneShapes.push(externalShapes['" + fileName + "']); to add it to the scene!");

      oc.FS.unlink("/" + fileName);
      return self.externalShapes[fileName];
    } else {
      console.error("Something in OCCT went wrong trying to read " + fileName);
      return null;
    }
  }

  /** Parses the contents of an ASCII .STL File as a Shape
   * into the `externalShapes` dictionary. */
  importSTL(fileName, fileText) {
    let oc = self.oc;
    oc.FS.createDataFile("/", fileName, fileText, true, true);

    var reader = new oc.StlAPI_Reader();
    let readShape = new oc.TopoDS_Shape();

    if (reader.Read(readShape, fileName)) {
      console.log(fileName + " loaded successfully!     Converting to OCC now...");

      let solidSTL = new oc.BRepBuilderAPI_MakeSolid_1();
      solidSTL.Add(oc.TopoDS_Cast.Shell_1(readShape));

      self.externalShapes[fileName] = solidSTL.Solid();
      self.externalShapes[fileName].hash = self.stringToHash(fileName);
      console.log("Shape Import complete! Use sceneShapes.push(externalShapes['" + fileName + "']); to see it!");

      oc.FS.unlink("/" + fileName);
      return self.externalShapes[fileName];
    } else {
      console.log("Something in OCCT went wrong trying to read " + fileName + ".  \n" +
        "Cascade Studio only imports small ASCII stl files for now!");
      return null;
    }
  }

  /** Returns `currentShape` `.STEP` file content. */
  saveShapeSTEP(filename = "CascadeStudioPart.step") {
    let oc = self.oc;
    let writer = new oc.STEPControl_Writer_1();
    let transferResult = writer.Transfer_1(self.currentShape, oc.STEPControl_StepModelType.STEPControl_AsIs, true, new oc.Message_ProgressRange_1());
    if (transferResult === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      let writeResult = writer.Write(filename);
      if (writeResult === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
        let stepFileText = oc.FS.readFile("/" + filename, { encoding: "utf8" });
        oc.FS.unlink("/" + filename);
        return stepFileText;
      } else {
        console.error("WRITE STEP FILE FAILED.");
      }
    } else {
      console.error("TRANSFER TO STEP WRITER FAILED.");
    }
  }

  /** Synchronously reads the text contents of a file. */
  static async loadFileSync(file) {
    return new Promise((resolve, reject) => {
      resolve(new FileReaderSync().readAsText(file));
    });
  }
}

export { CascadeStudioFileIO };
