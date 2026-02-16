// CascadeMain.js - ES Module
// This script governs the layout and initialization of all of the sub-windows
// If you're looking for the internals of the CAD System, they're in /js/CADWorker
// If you're looking for the 3D Three.js Viewport, they're in /js/MainPage/CascadeView*

import { GoldenLayout } from '../../lib/golden-layout/golden-layout.js';
import { CascadeEnvironment } from './CascadeView.js';
import { Pane } from '../../node_modules/tweakpane/dist/tweakpane.js';
import { deflateSync, inflateSync, strToU8, strFromU8 } from '../../node_modules/three/examples/jsm/libs/fflate.module.js';

// Monaco is loaded via AMD script tags in index.html (its ESM workers are too complex for buildless use)
const monaco = window.monaco;

/** Main application class for Cascade Studio.
 *  Manages layout, editor, worker, and UI state. */
class CascadeStudioApp {
  constructor() {
    this.myLayout = null;
    this.monacoEditor = null;
    this.threejsViewport = null;
    this.consoleContainer = null;
    this.consoleGolden = null;
    this.codeContainer = null;
    this.gui = null;
    this.GUIState = {};
    this.guiSeparatorAdded = false;
    this.userGui = false;
    this.messageHandlers = {};
    this.startup = null;
    this.file = {};
    this.realConsoleLog = null;
    this.cascadeStudioWorker = null;

    window.workerWorking = false;
  }

  /** Start the application: create the worker, wire up messages, and initialize. */
  start() {
    // Create the CAD Worker with module type
    // In build mode (ESBUILD defined), the worker is co-located with main.js
    const workerPath = typeof ESBUILD !== 'undefined' ? './CascadeStudioMainWorker.js' : './js/CADWorker/CascadeStudioMainWorker.js';
    this.cascadeStudioWorker = new Worker(workerPath, { type: 'module' });
    this.cascadeStudioWorker.onerror = (e) => {
      console.error("CAD Worker error:", e.message, e.filename, e.lineno);
    };

    // Ping Pong Messages Back and Forth based on their registration in messageHandlers
    this.cascadeStudioWorker.onmessage = (e) => {
      if (e.data.type in this.messageHandlers) {
        let response = this.messageHandlers[e.data.type](e.data.payload);
        if (response) {
          this.cascadeStudioWorker.postMessage({ "type": e.data.type, payload: response });
        }
      }
    };

    // Expose functions to window for inline HTML event handlers
    window.messageHandlers = this.messageHandlers;
    window.saveProject = () => this.saveProject();
    window.loadProject = () => this.loadProject();
    window.loadFiles = (id) => this.loadFiles(id);
    window.clearExternalFiles = () => this.clearExternalFiles();

    // Start the application
    this.initialize();
  }

  /** Initialize the layout and load project content. */
  initialize(projectContent = null) {
    let searchParams = new URLSearchParams(window.location.search || window.location.hash.substr(1));
    let loadFromURL = searchParams.has("code");

    // Load a project from the Gallery
    if (projectContent) {
      if (this.myLayout != null) {
        this.myLayout.destroy();
        this.myLayout = null;
      }
      this.myLayout = new GoldenLayout(document.getElementById("appbody"));
      this._registerComponents();
      this.myLayout.loadLayout(JSON.parse(projectContent));

    // Else load a project from the URL or create a new one from scratch
    } else {
      let codeStr = CascadeStudioApp.STARTER_CODE;
      this.GUIState = {};
      if (loadFromURL) {
        codeStr  = CascadeStudioApp.decode(searchParams.get("code"));
        this.GUIState = JSON.parse(CascadeStudioApp.decode(searchParams.get("gui")));
      }

      this.myLayout = new GoldenLayout(document.getElementById("appbody"));
      this._registerComponents();

      this.myLayout.loadLayout({
        root: {
          type: 'row',
          content: [{
            type: 'component',
            componentType: 'codeEditor',
            title: '* Untitled',
            componentState: { code: codeStr },
            width: 50.0,
            isClosable: false
          }, {
            type: 'column',
            content: [{
              type: 'component',
              componentType: 'cascadeView',
              title: 'CAD View',
              componentState: this.GUIState,
              isClosable: false
            }, {
              type: 'component',
              componentType: 'console',
              title: 'Console',
              componentState: {},
              height: 20.0,
              isClosable: false
            }]
          }]
        },
        header: {
          popout: false,
          maximise: false,
          close: false
        }
      });
    }

    // Resize the layout when the browser resizes
    const updateLayoutSize = () => {
      const h = window.innerHeight - document.getElementById('topnav').offsetHeight;
      this.myLayout.setSize(window.innerWidth, h);
    };
    window.addEventListener('resize', updateLayoutSize);
    window.addEventListener('orientationchange', updateLayoutSize);
    requestAnimationFrame(updateLayoutSize);

    // Register startup callback from the CAD Worker
    this.messageHandlers["startupCallback"] = () => {
      this.startup = () => {
        let curState = this.consoleGolden.getState();
        if (curState && Object.keys(curState).length > 0) {
          this.cascadeStudioWorker.postMessage({
            "type": "loadPrexistingExternalFiles",
            payload: this.consoleGolden.getState()
          });
        }
        this.monacoEditor.evaluateCode();
      };
      this.startup();
    };
    if (this.startup) { this.startup(); }

    // Register callbacks for UI controls
    this._registerUIHandlers();

    this.messageHandlers["resetWorking"] = () => { window.workerWorking = false; };
  }

  /** Register callbacks from the CAD Worker to add Sliders, Buttons, etc. */
  _registerUIHandlers() {
    this.messageHandlers["addSlider"] = (payload) => {
      if (!(payload.name in this.GUIState)) { this.GUIState[payload.name] = payload.default; }
      const params = { min: payload.min, max: payload.max, step: payload.step };
      if (payload.dp) { params.format = v => v.toFixed(payload.dp); }

      this._addGuiSeparator();
      const slider = this.gui.addBinding(this.GUIState, payload.name, params);

      if (payload.realTime) {
        slider.on('change', e => {
          if (e.last) { this._delayReloadEditor(); }
        });
      }
    };

    this.messageHandlers["addButton"] = (payload) => {
      this._addGuiSeparator();
      this.gui.addButton({ title: payload.name, label: payload.label }).on('click', payload.callback);
    };

    this.messageHandlers["addCheckbox"] = (payload) => {
      if (!(payload.name in this.GUIState)) { this.GUIState[payload.name] = payload.default || false; }
      this._addGuiSeparator();
      this.gui.addBinding(this.GUIState, payload.name).on('change', () => {
        this._delayReloadEditor();
      });
    };

    this.messageHandlers["addTextbox"] = (payload) => {
      if (!(payload.name in this.GUIState)) { this.GUIState[payload.name] = payload.default || ''; }
      this._addGuiSeparator();
      const input = this.gui.addBinding(this.GUIState, payload.name);
      if (payload.realTime) {
        input.on('change', e => {
          if (e.last) { this._delayReloadEditor(); }
        });
      }
    };

    this.messageHandlers['addDropdown'] = (payload) => {
      if (!(payload.name in this.GUIState)) { this.GUIState[payload.name] = payload.default || ''; }
      const options = payload.options || {};
      this._addGuiSeparator();
      const input = this.gui.addBinding(this.GUIState, payload.name, { options });
      if (payload.realTime) {
        input.on('change', e => {
          if (e.last) { this._delayReloadEditor(); }
        });
      }
    };
  }

  /** Register all GL v2 components. Called before loadLayout(). */
  _registerComponents() {
    this._registerCodeEditor();
    this._registerCascadeView();
    this._registerConsole();
  }

  /** Register the dockable Monaco Code Editor component. */
  _registerCodeEditor() {
    this.myLayout.registerComponent('codeEditor', (container, state) => {
      if (this.monacoEditor) {
        monaco.editor.getModels().forEach(model => model.dispose());
        this.monacoEditor = null;
      }

      // Set the Monaco Language Options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      });
      monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

      // Import Typescript Intellisense Definitions
      // In build mode, type defs are copied to typedefs/ by the build script
      const isBuilt = typeof ESBUILD !== 'undefined';
      let prefix = window.location.href.startsWith("https://zalo.github.io/") ? "/CascadeStudio/" : "";
      const ocDtsPath = isBuilt ? 'typedefs/cascadestudio.d.ts' : prefix + 'node_modules/opencascade.js/dist/cascadestudio.d.ts';
      const threeDtsPath = isBuilt ? 'typedefs/three.d.ts' : prefix + 'node_modules/@types/three/index.d.ts';
      const libDtsPath = isBuilt ? 'typedefs/StandardLibraryIntellisense.ts' : prefix + 'js/StandardLibraryIntellisense.ts';
      let extraLibs = [];
      Promise.all([
        fetch(ocDtsPath).then(r => r.text()),
        fetch(threeDtsPath).then(r => r.text()),
        fetch(libDtsPath).then(r => r.text()),
      ]).then(([ocDts, threeDts, libDts]) => {
        extraLibs = [
          { content: ocDts, filePath: 'file://' + ocDtsPath },
          { content: threeDts, filePath: 'file://' + threeDtsPath },
          { content: libDts, filePath: 'file://' + libDtsPath },
        ];
        monaco.editor.createModel("", "typescript");
        monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);
      }).catch(error => console.log("Error loading type definitions: " + error.message));

      // Check for code serialization as an array
      this.codeContainer = container;
      if (CascadeStudioApp.isArrayLike(state.code)) {
        let codeString = "";
        for (let i = 0; i < state.code.length; i++) {
          codeString += state.code[i] + "\n";
        }
        codeString = codeString.slice(0, -1);
        state.code = codeString;
        container.setState({ code: codeString });
      }

      // Initialize the Monaco Code Editor
      this.monacoEditor = monaco.editor.create(container.element, {
        value: state.code,
        language: "typescript",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false }
      });
      window.monacoEditor = this.monacoEditor;

      // Collapse all Functions in the Editor
      let codeLines = state.code.split(/\r\n|\r|\n/);
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
      let mergedViewState = Object.assign(this.monacoEditor.saveViewState(), {
        "contributionsState": {
          "editor.contrib.folding": {
            "collapsedRegions": collapsed,
            "lineCount": codeLines.length,
            "provider": "indent"
          },
          "editor.contrib.wordHighlighter": false
        }
      });
      this.monacoEditor.restoreViewState(mergedViewState);

      // Evaluate code function
      this.monacoEditor.evaluateCode = (saveToURL = false) => {
        if (window.workerWorking) { return; }
        window.workerWorking = true;

        monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);
        let newCode = this.monacoEditor.getValue();
        monaco.editor.setModelMarkers(this.monacoEditor.getModel(), 'test', []);

        // Refresh the GUI Panel
        if (this.gui) { this.gui.dispose(); }
        this.gui = new Pane({
          title: 'Cascade Control Panel',
          container: document.getElementById('guiPanel')
        });
        this.guiSeparatorAdded = false;
        this.userGui = false;
        this.messageHandlers["addButton"]({ name: "Evaluate", label: "Function", callback: () => { this.monacoEditor.evaluateCode(true); } });
        this.messageHandlers["addSlider"]({ name: "MeshRes", default: 0.1, min: 0.01, max: 2, step: 0.01, dp: 2 });
        this.messageHandlers["addCheckbox"]({ name: "Cache?", default: true });
        this.messageHandlers["addCheckbox"]({ name: "GroundPlane?", default: true });
        this.messageHandlers["addCheckbox"]({ name: "Grid?", default: true });
        this.userGui = true;
        this.threejsViewport.clearTransformHandles();

        this.messageHandlers["saveFile"] = (payload) => {
          let link = document.createElement("a");
          link.href = payload.fileURL;
          link.download = payload.filename;
          link.click();
        };

        this.cascadeStudioWorker.postMessage({
          "type": "Evaluate",
          payload: { "code": newCode, "GUIState": this.GUIState }
        });

        this.cascadeStudioWorker.postMessage({
          "type": "combineAndRenderShapes",
          payload: {
            maxDeviation: this.GUIState["MeshRes"],
            sceneOptions: {
              groundPlaneVisible: this.GUIState["GroundPlane?"],
              gridVisible: this.GUIState["Grid?"]
            }
          }
        });

        container.setState({ code: newCode });

        if (saveToURL) {
          console.log("Saved to URL!");
          window.history.replaceState({}, 'Cascade Studio',
            new URL(
              location.pathname + "#code=" + CascadeStudioApp.encode(newCode) +
              "&gui=" + CascadeStudioApp.encode(JSON.stringify(this.GUIState)),
              location.href
            ).href
          );
        }

        console.log("Generating Model");
      };

      document.onkeydown = (e) => {
        if (e.code === 'F5') {
          e.preventDefault();
          this.monacoEditor.evaluateCode(true);
          return false;
        }
        if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.saveProject();
          this.monacoEditor.evaluateCode(true);
        }
        return true;
      };

      document.onkeyup = (e) => {
        if (!this.file.handle || e.which === 0) { return true; }
        if (this.file.content == this.monacoEditor.getValue()) {
          this.codeContainer.setTitle(this.file.handle.name);
        } else {
          this.codeContainer.setTitle('* ' + this.file.handle.name);
        }
        return true;
      };
    });
  }

  /** Register the dockable Three.js 3D Viewport component. */
  _registerCascadeView() {
    this.myLayout.registerComponent('cascadeView', (container, state) => {
      this.GUIState = state;
      container.setState(this.GUIState);

      if (this.threejsViewport) {
        this.threejsViewport.active = false;
        this.threejsViewport = null;
      }

      let floatingGUIContainer = document.createElement("div");
      floatingGUIContainer.className = 'gui-panel';
      floatingGUIContainer.id = "guiPanel";
      container.element.appendChild(floatingGUIContainer);

      this.threejsViewport = new CascadeEnvironment(
        container, this.cascadeStudioWorker, this.messageHandlers,
        CascadeStudioApp.getNewFileHandle, CascadeStudioApp.writeFile, CascadeStudioApp.downloadFile
      );
      window.threejsViewport = this.threejsViewport;
    });
  }

  /** Register the dockable Console component. */
  _registerConsole() {
    this.myLayout.registerComponent('console', (container) => {
      this.consoleGolden = container;
      this.consoleContainer = document.createElement("div");
      container.element.appendChild(this.consoleContainer);
      container.element.style.overflow  = 'auto';
      container.element.style.boxShadow = "inset 0px 0px 3px rgba(0,0,0,0.75)";

      let getCircularReplacer = () => {
        let seen = new WeakSet();
        return (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) { return; }
            seen.add(value);
          }
          return value;
        };
      };

      if (!this.realConsoleLog) {
        let alternatingColor = true;
        this.realConsoleLog = console.log;
        const consoleContainer = this.consoleContainer;

        console.log = function (message) {
          let newline = document.createElement("div");
          newline.style.fontFamily = "monospace";
          newline.style.color = (alternatingColor = !alternatingColor) ? "LightGray" : "white";
          newline.style.fontSize = "1.2em";
          if (message !== undefined) {
            let messageText = JSON.stringify(message, getCircularReplacer());
            if (messageText.startsWith('"')) { messageText = messageText.slice(1, -1); }
            newline.innerHTML = "&gt;  " + messageText;
          } else {
            newline.innerHTML = "undefined";
          }
          consoleContainer.appendChild(newline);
          consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;
          this.realConsoleLog.apply(console, arguments);
        }.bind(this);

        this.messageHandlers["log"]   = (payload) => { console.log(payload); };
        this.messageHandlers["error"] = (payload) => { window.workerWorking = false; console.error(payload); };

        window.onerror = (err, url, line, colno, errorObj) => {
          let newline = document.createElement("div");
          newline.style.color = "red";
          newline.style.fontFamily = "monospace";
          newline.style.fontSize = "1.2em";
          let errorText = JSON.stringify(err, getCircularReplacer());
          if (errorText.startsWith('"')) { errorText = errorText.slice(1, -1); }
          newline.innerHTML = "Line " + line + ": " + errorText;
          consoleContainer.appendChild(newline);
          consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;

          if (!errorObj || !(errorObj.stack.includes("wasm-function"))) {
            monaco.editor.setModelMarkers(this.monacoEditor.getModel(), 'test', [{
              startLineNumber: line,
              startColumn: colno,
              endLineNumber: line,
              endColumn: 1000,
              message: JSON.stringify(err, getCircularReplacer()),
              severity: monaco.MarkerSeverity.Error
            }]);
          }
        };

        this.messageHandlers["Progress"] = (payload) => {
          consoleContainer.parentElement.lastElementChild.lastElementChild.innerText =
            "> Generating Model" + ".".repeat(payload.opNumber) + ((payload.opType) ? " (" + payload.opType + ")" : "");
        };

        console.log("Welcome to Cascade Studio!");
        console.log("Loading CAD Kernel...");
      }
    });
  }

  /** Add a separator to the GUI panel before user-defined controls. */
  _addGuiSeparator() {
    if (this.userGui && !this.guiSeparatorAdded) {
      this.guiSeparatorAdded = true;
      this.gui.addBlade({ view: 'separator' });
    }
  }

  /** Workaround for Tweakpane errors when tearing down gui during change event callbacks. */
  _delayReloadEditor() {
    setTimeout(() => { this.monacoEditor.evaluateCode(); }, 0);
  }

  /** Serialize the project's current state into a .json file and save it. */
  async saveProject() {
    let currentCode = this.monacoEditor.getValue();
    if (!this.file.handle) {
      this.file.handle = await CascadeStudioApp.getNewFileHandle(
        "Cascade Studio project files", "application/json", "json"
      );
    }

    this.codeContainer.setState({ code: currentCode.split(/\r\n|\r|\n/) });

    CascadeStudioApp.writeFile(this.file.handle, JSON.stringify(this.myLayout.saveLayout(), null, 2)).then(() => {
      this.codeContainer.setTitle(this.file.handle.name);
      console.log("Saved project to " + this.file.handle.name);
      this.file.content = currentCode;
    });
  }

  /** Load a .json file as the current project. */
  async loadProject() {
    if (window.workerWorking) { return; }

    [this.file.handle] = await CascadeStudioApp.getNewFileHandle(
      'Cascade Studio project files', 'application/json', 'json', true
    );
    let fileSystemFile = await this.file.handle.getFile();
    let jsonContent = await fileSystemFile.text();
    window.history.replaceState({}, 'Cascade Studio', '?');
    this.initialize(jsonContent);
    this.codeContainer.setTitle(this.file.handle.name);
    this.file.content = this.monacoEditor.getValue();
  }

  /** Trigger the CAD WebWorker to load one or more .stl, .step, or .iges files. */
  loadFiles(fileElementID = "files") {
    let files = document.getElementById(fileElementID).files;
    this.cascadeStudioWorker.postMessage({
      "type": "loadFiles",
      "payload": files
    });

    this.messageHandlers["loadFiles"] = (extFiles) => {
      console.log("Storing loaded files!");
      this.consoleGolden.setState(extFiles);
    };
  }

  /** Clear all externally loaded files from the `externalFiles` dict. */
  clearExternalFiles() {
    this.cascadeStudioWorker.postMessage({ "type": "clearExternalFiles" });
    this.consoleGolden.setState({});
  }

  // --- Static utility methods ---

  /** Get a new file handle via the File System Access API. */
  static async getNewFileHandle(desc, mime, ext, open = false) {
    const options = {
      types: [{
        description: desc,
        accept: { [mime]: ['.' + ext] },
      }],
    };
    if (open) {
      return await window.showOpenFilePicker(options);
    } else {
      return await window.showSaveFilePicker(options);
    }
  }

  /** Write contents to a file handle. */
  static async writeFile(fileHandle, contents) {
    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
  }

  /** Download data as a file via a temporary anchor element. */
  static async downloadFile(data, name, mime, ext) {
    const blob = new Blob([data], { type: mime });
    const a = document.createElement("a");
    a.download = name + "." + ext;
    a.style.display = "none";
    a.href = window.URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(a.href);
  }

  /** Decode a base64+compressed string to the original. Uses fflate. */
  static decode(string) {
    const compressed = Uint8Array.from(atob(decodeURIComponent(string)), c => c.charCodeAt(0));
    return strFromU8(inflateSync(compressed));
  }

  /** Encode a string to a base64+compressed version. Uses fflate. */
  static encode(string) {
    const compressed = deflateSync(strToU8(string));
    const binaryStr = String.fromCharCode(...compressed);
    return encodeURIComponent(btoa(binaryStr));
  }

  /** Returns true if item is indexable like an array. */
  static isArrayLike(item) {
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

/** Default starter code shown in the editor. */
CascadeStudioApp.STARTER_CODE =
`// Welcome to Cascade Studio!   Here are some useful functions:
//  Translate(), Rotate(), Scale(), Mirror(), Union(), Difference(), Intersection()
//  Box(), Sphere(), Cylinder(), Cone(), Text3D(), Polygon()
//  Offset(), Extrude(), RotatedExtrude(), Revolve(), Pipe(), Loft(),
//  FilletEdges(), ChamferEdges(),
//  Slider(), Checkbox(), TextInput(), Dropdown()

let holeRadius = Slider("Radius", 30 , 20 , 40);

let sphere     = Sphere(50);
let cylinderZ  =                     Cylinder(holeRadius, 200, true);
let cylinderY  = Rotate([0,1,0], 90, Cylinder(holeRadius, 200, true));
let cylinderX  = Rotate([1,0,0], 90, Cylinder(holeRadius, 200, true));

Translate([0, 0, 50], Difference(sphere, [cylinderX, cylinderY, cylinderZ]));

Translate([-25, 0, 40], Text3D("Hi!", 36, 0.15, 'Consolas'));

// Don't forget to push imported or oc-defined shapes into sceneShapes to add them to the workspace!`;

export { CascadeStudioApp };
