// EditorManager.js - Monaco editor management

const monaco = window.monaco;

/** Manages the Monaco code editor instance, mode switching, and code evaluation. */
class EditorManager {
  constructor(app) {
    this._app = app;
    this.editor = null;
    this.mode = 'cascadestudio';
    this._extraLibs = [];
    this._codeContainer = null;
    this._openscadProviders = [];
  }

  /** Register the dockable Monaco Code Editor component with Golden Layout. */
  registerComponent(layout) {
    layout.registerComponent('codeEditor', (container, state) => {
      if (this.editor) {
        monaco.editor.getModels().forEach(model => model.dispose());
        this.editor = null;
      }

      // Set the Monaco Language Options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      });
      monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

      // Import Typescript Intellisense Definitions
      const isBuilt = typeof ESBUILD !== 'undefined';
      let prefix = window.location.href.startsWith("https://zalo.github.io/") ? "/CascadeStudio/" : "";
      const ocDtsPath = isBuilt ? 'typedefs/cascadestudio.d.ts' : prefix + 'node_modules/opencascade.js/dist/cascadestudio.d.ts';
      const threeDtsPath = isBuilt ? 'typedefs/three.d.ts' : prefix + 'node_modules/@types/three/index.d.ts';
      const libDtsPath = isBuilt ? 'typedefs/StandardLibraryIntellisense.ts' : prefix + 'js/StandardLibraryIntellisense.ts';
      Promise.all([
        fetch(ocDtsPath).then(r => r.text()),
        fetch(threeDtsPath).then(r => r.text()),
        fetch(libDtsPath).then(r => r.text()),
      ]).then(([ocDts, threeDts, libDts]) => {
        this._extraLibs = [
          { content: ocDts, filePath: 'file://' + ocDtsPath },
          { content: threeDts, filePath: 'file://' + threeDtsPath },
          { content: libDts, filePath: 'file://' + libDtsPath },
        ];
        monaco.editor.createModel("", "typescript");
        monaco.languages.typescript.typescriptDefaults.setExtraLibs(this._extraLibs);
      }).catch(error => console.log("Error loading type definitions: " + error.message));

      // Check for code serialization as an array
      this._codeContainer = container;
      if (EditorManager._isArrayLike(state.code)) {
        let codeString = "";
        for (let i = 0; i < state.code.length; i++) {
          codeString += state.code[i] + "\n";
        }
        codeString = codeString.slice(0, -1);
        state.code = codeString;
        container.setState({ code: codeString });
      }

      // Initialize the Monaco Code Editor
      this.editor = monaco.editor.create(container.element, {
        value: state.code,
        language: "typescript",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false }
      });
      window.monacoEditor = this.editor;

      // Collapse all top-level functions in the Editor
      this._collapseTopLevelFunctions(state.code);

      // Set up keyboard shortcuts
      this._setupKeyboardShortcuts(container);
    });
  }

  /** Get the current code from the editor. */
  getCode() {
    return this.editor ? this.editor.getValue() : '';
  }

  /** Set the code in the editor. */
  setCode(code) {
    if (this.editor) { this.editor.setValue(code); }
  }

  /** Evaluate the current code: transpile if OpenSCAD, then send to worker. */
  evaluateCode(saveToURL = false) {
    if (window.workerWorking) { return; }
    window.workerWorking = true;

    monaco.languages.typescript.typescriptDefaults.setExtraLibs(this._extraLibs);
    let newCode = this.editor.getValue();
    monaco.editor.setModelMarkers(this.editor.getModel(), 'test', []);

    // Refresh the GUI Panel
    this._app.gui.reset();
    this._app.viewport.clearTransformHandles();

    this._app.messageBus.on("saveFile", (payload) => {
      let link = document.createElement("a");
      link.href = payload.fileURL;
      link.download = payload.filename;
      link.click();
    });

    // Transpile OpenSCAD if needed
    let codeToEval = newCode;
    if (this.mode === 'openscad' && this._app._openscadTranspiler) {
      try {
        codeToEval = this._app._openscadTranspiler.transpile(newCode);
      } catch (e) {
        console.error("OpenSCAD transpile error: " + e.message);
        window.workerWorking = false;
        return;
      }
    }

    this._app.messageBus.send("Evaluate", {
      code: codeToEval,
      GUIState: this._app.gui.state
    });

    this._app.messageBus.send("combineAndRenderShapes", {
      maxDeviation: this._app.gui.state["MeshRes"],
      sceneOptions: {
        groundPlaneVisible: this._app.gui.state["GroundPlane?"],
        gridVisible: this._app.gui.state["Grid?"]
      }
    });

    this._codeContainer.setState({ code: newCode });

    if (saveToURL) {
      const AppClass = this._app.constructor;
      console.log("Saved to URL!");
      window.history.replaceState({}, 'Cascade Studio',
        new URL(
          location.pathname + "#code=" + AppClass.encode(newCode) +
          "&gui=" + AppClass.encode(JSON.stringify(this._app.gui.state)),
          location.href
        ).href
      );
    }

    console.log("Generating Model");
  }

  /** Set editor mode: 'cascadestudio' or 'openscad'. */
  setMode(newMode) {
    if (newMode === this.mode) return;
    this.mode = newMode;

    // Dispose existing OpenSCAD providers
    this._openscadProviders.forEach(d => d.dispose());
    this._openscadProviders = [];

    if (newMode === 'openscad') {
      // Switch to OpenSCAD language
      const model = this.editor.getModel();
      monaco.editor.setModelLanguage(model, 'openscad');

      // Register OpenSCAD providers if available
      if (this._app._openscadMonaco) {
        this._openscadProviders = this._app._openscadMonaco.registerProviders(this.editor);
      }
    } else {
      // Switch back to TypeScript
      const model = this.editor.getModel();
      monaco.editor.setModelLanguage(model, 'typescript');
      monaco.languages.typescript.typescriptDefaults.setExtraLibs(this._extraLibs);
    }
  }

  /** Get the golden layout container for the code editor. */
  get container() {
    return this._codeContainer;
  }

  /** Collapse all top-level functions in the editor. */
  _collapseTopLevelFunctions(code) {
    let codeLines = code.split(/\r\n|\r|\n/);
    let collapsed = []; let curCollapse = null;
    for (let li = 0; li < codeLines.length; li++) {
      if (codeLines[li].startsWith("function")) {
        curCollapse = { "startLineNumber": (li + 1) };
      } else if (codeLines[li].startsWith("}") && curCollapse !== null) {
        curCollapse["endLineNumber"] = (li + 1);
        collapsed.push(curCollapse);
        curCollapse = null;
      }
    }
    let mergedViewState = Object.assign(this.editor.saveViewState(), {
      "contributionsState": {
        "editor.contrib.folding": {
          "collapsedRegions": collapsed,
          "lineCount": codeLines.length,
          "provider": "indent"
        },
        "editor.contrib.wordHighlighter": false
      }
    });
    this.editor.restoreViewState(mergedViewState);
  }

  /** Set up keyboard shortcuts for evaluation and save. */
  _setupKeyboardShortcuts(container) {
    document.onkeydown = (e) => {
      if (e.code === 'F5') {
        e.preventDefault();
        this.evaluateCode(true);
        return false;
      }
      if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this._app.saveProject();
        this.evaluateCode(true);
      }
      return true;
    };

    document.onkeyup = (e) => {
      if (!this._app.file.handle || e.which === 0) { return true; }
      if (this._app.file.content == this.editor.getValue()) {
        this._codeContainer.setTitle(this._app.file.handle.name);
      } else {
        this._codeContainer.setTitle('* ' + this._app.file.handle.name);
      }
      return true;
    };
  }

  static _isArrayLike(item) {
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
}

export { EditorManager };
