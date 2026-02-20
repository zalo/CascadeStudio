// CascadeMain.js - ES Module
// This script governs the layout and initialization of all of the sub-windows
// If you're looking for the internals of the CAD System, they're in /js/CADWorker
// If you're looking for the 3D Three.js Viewport, they're in /js/MainPage/CascadeView*

import { createDockview } from '../../lib/dockview-core/dockview-core.js';
import { CascadeEnvironment } from './CascadeView.js';
import { MessageBus } from './MessageBus.js';
import { EditorManager } from './EditorManager.js';
import { ConsoleManager } from './ConsoleManager.js';
import { GUIManager } from './GUIManager.js';
import { OpenSCADTranspiler } from '../OpenSCAD/OpenSCADTranspiler.js';
import { OpenSCADMonaco } from '../OpenSCAD/OpenSCADMonaco.js';
import { CascadeAPI } from './CascadeAPI.js';
import { deflateSync, inflateSync, strToU8, strFromU8 } from '../../node_modules/three/examples/jsm/libs/fflate.module.js';

/** Adapter that wraps a dockview panel to provide a Golden-Layout-compatible container API.
 *  This minimizes changes needed in EditorManager, ConsoleManager, and CascadeView. */
class DockviewContainer {
  constructor(element, panelApi) {
    this.element = element;
    this._panelApi = panelApi;
    this._state = {};
    this._resizeCallbacks = [];

    panelApi.onDidDimensionsChange(() => {
      this._resizeCallbacks.forEach(cb => cb());
    });
  }

  get width()  { return this.element.offsetWidth; }
  get height() { return this.element.offsetHeight; }

  setState(obj) { this._state = obj; }
  getState()    { return this._state; }
  setTitle(title) { this._panelApi.setTitle(title); }

  on(event, callback) {
    if (event === 'resize') {
      this._resizeCallbacks.push(callback);
    }
  }

  // Stub for CascadeView's layoutManager access
  get layoutManager() {
    return {
      eventHub: { emit: () => {} },
      updateSize: () => {}
    };
  }
}

/** Main application class for Cascade Studio.
 *  Manages layout, editor, worker, and UI state. */
class CascadeStudioApp {
  constructor() {
    this.myLayout = null;
    this._dockviewApi = null;
    this.messageBus = null;
    this.editor = null;
    this.console = null;
    this.gui = null;
    this.viewport = null;
    this.api = null;
    this.startup = null;
    this.file = {};

    // OpenSCAD support
    this._openscadTranspiler = new OpenSCADTranspiler();
    this._openscadMonaco = new OpenSCADMonaco();

    window.workerWorking = false;
  }

  /** Start the application: create the worker, wire up messages, and initialize. */
  start() {
    // Create the CAD Worker with module type
    const workerPath = typeof ESBUILD !== 'undefined' ? './CascadeStudioMainWorker.js' : './js/CADWorker/CascadeStudioMainWorker.js';
    const worker = new Worker(workerPath, { type: 'module' });

    // Create subsystem managers
    this.messageBus = new MessageBus(worker);
    this.editor = new EditorManager(this);
    this.console = new ConsoleManager(this);
    this.gui = new GUIManager(this);

    // Register GUI handlers with the message bus
    this.gui.registerHandlers(this.messageBus);

    // Backward compatibility: expose functions to window for inline HTML event handlers
    window.cascadeApp = this;
    window.messageHandlers = this.messageBus.handlers;
    window.saveProject = () => this.saveProject();
    window.loadProject = () => this.loadProject();
    window.loadFiles = (id) => this.loadFiles(id);
    window.clearExternalFiles = () => this.clearExternalFiles();

    // Install the programmatic API
    this.api = new CascadeAPI(this);
    this.api.install();

    // Register OpenSCAD language with Monaco (for syntax highlighting)
    this._openscadMonaco.registerLanguage();

    // Mode toggle handler
    const modeSelect = document.getElementById('editorMode');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.editor.setMode(e.target.value);
      });
    }

    // Start the application
    this.initialize();
  }

  /** Initialize the layout and load project content. */
  initialize(projectContent = null) {
    let searchParams = new URLSearchParams(window.location.search || window.location.hash.substr(1));
    let loadFromURL = searchParams.has("code");

    let codeStr = CascadeStudioApp.STARTER_CODE;
    this.gui.state = {};

    if (projectContent) {
      // Load from saved project — extract code and state from the serialized layout
      try {
        let parsed = JSON.parse(projectContent);
        if (parsed._cascadeState) {
          // New Dockview project format
          codeStr = parsed._cascadeState.code || codeStr;
          this.gui.state = parsed._cascadeState.guiState || {};
        } else if (parsed.content || parsed.root) {
          // Legacy GoldenLayout project format — extract code from componentState
          let code = this._extractLegacyCode(parsed);
          if (code) { codeStr = code; }
        }
      } catch (e) {
        console.error("Failed to parse project:", e);
      }
    } else if (loadFromURL) {
      codeStr = CascadeStudioApp.decode(searchParams.get("code"));
      this.gui.state = JSON.parse(CascadeStudioApp.decode(searchParams.get("gui")));
    }

    // Dispose previous layout
    if (this._dockviewApi) {
      this._dockviewApi.dispose();
      this._dockviewApi = null;
    }

    const appBody = document.getElementById("appbody");
    appBody.innerHTML = '';

    // Set layout height
    const topnavHeight = document.getElementById('topnav').offsetHeight;
    appBody.style.height = (window.innerHeight - topnavHeight) + 'px';

    this._dockviewApi = createDockview(appBody, {
      className: 'dockview-theme-dark',
      disableFloatingGroups: true,
      createComponent: (options) => {
        const element = document.createElement('div');
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.overflow = 'hidden';

        return {
          element,
          init: (params) => {
            const container = new DockviewContainer(element, params.api);

            switch (options.name) {
              case 'codeEditor':
                container.setState({ code: params.params?.code || codeStr });
                this.editor.initPanel(container, container.getState());
                break;
              case 'cascadeView':
                container.setState(params.params?.guiState || this.gui.state);
                this._initCascadeView(container, container.getState());
                break;
              case 'console':
                this.console.initPanel(container);
                break;
            }
          }
        };
      }
    });

    // Add panels — use vertical stack on mobile, side-by-side on desktop
    const isMobile = window.innerHeight > window.innerWidth;

    if (isMobile) {
      // Mobile: cascadeView on top, editor below, console at bottom
      const viewPanel = this._dockviewApi.addPanel({
        id: 'cascadeView',
        component: 'cascadeView',
        title: 'CAD View',
        params: { guiState: this.gui.state }
      });

      const editorPanel = this._dockviewApi.addPanel({
        id: 'codeEditor',
        component: 'codeEditor',
        title: '* Untitled',
        params: { code: codeStr },
        position: { referencePanel: 'cascadeView', direction: 'below' }
      });

      this._dockviewApi.addPanel({
        id: 'console',
        component: 'console',
        title: 'Console',
        position: { referencePanel: 'codeEditor', direction: 'below' }
      });

      // Set mobile proportions: 30% view, 60% editor, 10% console
      try {
        const viewGroup = viewPanel.group;
        if (viewGroup) {
          viewGroup.api.setSize({ height: Math.floor(appBody.offsetHeight * 0.3) });
        }
        const editorGroup = editorPanel.group;
        if (editorGroup) {
          editorGroup.api.setSize({ height: Math.floor(appBody.offsetHeight * 0.6) });
        }
      } catch (e) { /* setSize may not be available on initial render */ }
    } else {
      // Desktop: editor left, cascadeView right, console below view
      const editorPanel = this._dockviewApi.addPanel({
        id: 'codeEditor',
        component: 'codeEditor',
        title: '* Untitled',
        params: { code: codeStr }
      });

      const viewPanel = this._dockviewApi.addPanel({
        id: 'cascadeView',
        component: 'cascadeView',
        title: 'CAD View',
        params: { guiState: this.gui.state },
        position: { referencePanel: 'codeEditor', direction: 'right' }
      });

      this._dockviewApi.addPanel({
        id: 'console',
        component: 'console',
        title: 'Console',
        position: { referencePanel: 'cascadeView', direction: 'below' }
      });

      // Set initial proportions (editor ~50%, view+console ~50%)
      try {
        const editorGroup = editorPanel.group;
        const viewGroup = viewPanel.group;
        if (editorGroup && viewGroup) {
          editorGroup.api.setSize({ width: Math.floor(appBody.offsetWidth * 0.5) });
        }
      } catch (e) { /* setSize may not be available on initial render */ }
    }

    // Resize the layout when the browser resizes
    if (this._updateLayoutSize) {
      window.removeEventListener('resize', this._updateLayoutSize);
      window.removeEventListener('orientationchange', this._updateLayoutSize);
    }
    this._updateLayoutSize = () => {
      const h = window.innerHeight - document.getElementById('topnav').offsetHeight;
      appBody.style.height = h + 'px';
    };
    window.addEventListener('resize', this._updateLayoutSize);
    window.addEventListener('orientationchange', this._updateLayoutSize);
    requestAnimationFrame(this._updateLayoutSize);

    // Register startup callback from the CAD Worker
    this.messageBus.on("startupCallback", () => {
      this.startup = () => {
        let curState = this.console.goldenContainer.getState();
        if (curState && Object.keys(curState).length > 0) {
          this.messageBus.send("loadPrexistingExternalFiles", curState);
        }
        this.editor.evaluateCode();
      };
      this.startup();
    });
    if (this.startup) { this.startup(); }

    this.messageBus.on("resetWorking", () => { window.workerWorking = false; });
  }

  /** Initialize the Three.js 3D Viewport. */
  _initCascadeView(container, state) {
    this.gui.state = state;
    container.setState(this.gui.state);

    if (this.viewport) {
      this.viewport.active = false;
      this.viewport = null;
    }

    let floatingGUIContainer = document.createElement("div");
    floatingGUIContainer.className = 'gui-panel';
    floatingGUIContainer.id = "guiPanel";
    container.element.appendChild(floatingGUIContainer);

    this.viewport = new CascadeEnvironment(
      container, this.messageBus,
      CascadeStudioApp.getNewFileHandle, CascadeStudioApp.writeFile, CascadeStudioApp.downloadFile
    );
    window.threejsViewport = this.viewport;

    // Wire timeline step changes to editor line highlighting
    this._historyDecorations = [];
    this.viewport._onHistoryStepChange = (lineNumber) => {
      let editor = window.monacoEditor;
      if (!editor) return;
      if (lineNumber && lineNumber > 0) {
        this._historyDecorations = editor.deltaDecorations(this._historyDecorations, [{
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'cs-history-line-highlight',
            glyphMarginClassName: 'cs-history-glyph'
          }
        }]);
        editor.revealLineInCenter(lineNumber);
      } else {
        this._historyDecorations = editor.deltaDecorations(this._historyDecorations, []);
      }
    };
  }

  /** Serialize the project's current state into a .json file and save it. */
  async saveProject() {
    let currentCode = this.editor.getCode();
    if (!this.file.handle) {
      this.file.handle = await CascadeStudioApp.getNewFileHandle(
        "Cascade Studio project files", "application/json", "json"
      );
    }

    // Save as a custom format with layout + cascade state
    let projectData = {
      _cascadeState: {
        code: currentCode,
        guiState: this.gui.state,
        externalFiles: this.console.goldenContainer.getState()
      }
    };
    if (this._dockviewApi) {
      projectData._dockviewLayout = this._dockviewApi.toJSON();
    }

    CascadeStudioApp.writeFile(this.file.handle, JSON.stringify(projectData, null, 2)).then(() => {
      this.editor.container.setTitle(this.file.handle.name);
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
    this.editor.container.setTitle(this.file.handle.name);
    this.file.content = this.editor.getCode();
  }

  /** Trigger the CAD WebWorker to load one or more .stl, .step, or .iges files. */
  loadFiles(fileElementID = "files") {
    let files = document.getElementById(fileElementID).files;
    this.messageBus.send("loadFiles", files);

    this.messageBus.on("loadFiles", (extFiles) => {
      console.log("Storing loaded files!");
      this.console.goldenContainer.setState(extFiles);
    });
  }

  /** Clear all externally loaded files from the `externalFiles` dict. */
  clearExternalFiles() {
    this.messageBus.send("clearExternalFiles");
    this.console.goldenContainer.setState({});
  }

  /** Extract code from a legacy GoldenLayout project file. */
  _extractLegacyCode(parsed) {
    // Recursively search for componentState.code in GoldenLayout config
    function findCode(obj) {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.componentState && obj.componentState.code) return obj.componentState.code;
      for (let key of ['content', 'root', 'children']) {
        if (Array.isArray(obj[key])) {
          for (let child of obj[key]) {
            let result = findCode(child);
            if (result) return result;
          }
        }
      }
      return null;
    }
    return findCode(parsed);
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
    // Build binary string in chunks to avoid stack overflow with large data
    let binaryStr = '';
    const chunkSize = 8192;
    for (let i = 0; i < compressed.length; i += chunkSize) {
      binaryStr += String.fromCharCode.apply(null, compressed.subarray(i, i + chunkSize));
    }
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
//  Edges(), Faces() — Select edges/faces by property for FilletEdges/ChamferEdges
//  Volume(), SurfaceArea(), CenterOfMass() — Measurement functions
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
