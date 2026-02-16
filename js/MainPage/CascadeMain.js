// CascadeMain.js - ES Module
// This script governs the layout and initialization of all of the sub-windows
// If you're looking for the internals of the CAD System, they're in /js/CADWorker
// If you're looking for the 3D Three.js Viewport, they're in /js/MainPage/CascadeView*

import { GoldenLayout } from '../../lib/golden-layout/golden-layout.js';
import { CascadeEnvironment } from './CascadeView.js';
import { MessageBus } from './MessageBus.js';
import { EditorManager } from './EditorManager.js';
import { ConsoleManager } from './ConsoleManager.js';
import { GUIManager } from './GUIManager.js';
import { OpenSCADTranspiler } from '../OpenSCAD/OpenSCADTranspiler.js';
import { OpenSCADMonaco } from '../OpenSCAD/OpenSCADMonaco.js';
import { CascadeAPI } from './CascadeAPI.js';
import { deflateSync, inflateSync, strToU8, strFromU8 } from '../../node_modules/three/examples/jsm/libs/fflate.module.js';

/** Main application class for Cascade Studio.
 *  Manages layout, editor, worker, and UI state. */
class CascadeStudioApp {
  constructor() {
    this.myLayout = null;
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
      this.gui.state = {};
      if (loadFromURL) {
        codeStr  = CascadeStudioApp.decode(searchParams.get("code"));
        this.gui.state = JSON.parse(CascadeStudioApp.decode(searchParams.get("gui")));
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
              componentState: this.gui.state,
              height: 80.0,
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

  /** Register all GL v2 components. Called before loadLayout(). */
  _registerComponents() {
    this.editor.registerComponent(this.myLayout);
    this._registerCascadeView();
    this.console.registerComponent(this.myLayout);
  }

  /** Register the dockable Three.js 3D Viewport component. */
  _registerCascadeView() {
    this.myLayout.registerComponent('cascadeView', (container, state) => {
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
    });
  }

  /** Serialize the project's current state into a .json file and save it. */
  async saveProject() {
    let currentCode = this.editor.getCode();
    if (!this.file.handle) {
      this.file.handle = await CascadeStudioApp.getNewFileHandle(
        "Cascade Studio project files", "application/json", "json"
      );
    }

    this.editor.container.setState({ code: currentCode.split(/\r\n|\r|\n/) });

    CascadeStudioApp.writeFile(this.file.handle, JSON.stringify(this.myLayout.saveLayout(), null, 2)).then(() => {
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
