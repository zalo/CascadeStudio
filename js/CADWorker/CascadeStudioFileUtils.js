// File Import and Export Utilities

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
  }

  /** Synchronously loads the "files" in the current project into
   * the `externalFiles` dictionary upon startup. */
  loadPrexistingExternalFiles(externalFileDict) {
    console.log("Loading Pre-Existing external files...");
    for (let key in externalFileDict) {
      if (key.includes(".stl")) {
        this.importSTL(key, externalFileDict[key].content);
      } else {
        this.importSTEPorIGES(key, externalFileDict[key].content);
      }
    }
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
            postMessage({ "type": "combineAndRenderShapes", payload: response });
          }
        }
        postMessage({ "type": "loadFiles", payload: extFiles });
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
      reader = new oc.STEPControl_Reader();
    } else if (tempFilename.endsWith(".iges") || tempFilename.endsWith(".igs")) {
      reader = new oc.IGESControl_Reader();
    } else { console.error("opencascade.js can't parse this extension! (yet)"); }

    let readResult = reader.ReadFile(fileName);
    if (readResult === 1) {
      console.log(fileName + " loaded successfully!     Converting to OCC now...");
      reader.TransferRoots();
      let stepShape = reader.OneShape();

      self.externalShapes[fileName] = new oc.TopoDS_Shape(stepShape);
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

      let solidSTL = new oc.BRepBuilderAPI_MakeSolid();
      solidSTL.Add(new oc.TopoDS_Shape(readShape));

      self.externalShapes[fileName] = new oc.TopoDS_Shape(solidSTL.Solid());
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
    let writer = new oc.STEPControl_Writer();
    let transferResult = writer.Transfer(self.currentShape, 0);
    if (transferResult === 1) {
      let writeResult = writer.Write(filename);
      if (writeResult === 1) {
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
