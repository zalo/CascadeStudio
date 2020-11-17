import GoldenLayout from 'golden-layout'
import * as monaco from 'monaco-editor'
import ControlKit from 'controlkit'
import { CascadeEnvironment } from './CascadeView'

// This script governs the layout and intialization of all of the sub-windows
// If you're looking for the internals of the CAD System, they're in /js/CADWorker
// If you're looking for the 3D Three.js Viewport, they're in /js/MainPage/CascadeView*

var myLayout, monacoEditor,
    consoleContainer, consoleGolden, codeContainer, gui,
    guiPanel, GUIState, count = 0, //focused = true,
    mainProject = false, messageHandlers = {}, startup,
    isInitialized = false;

let starterCode =
`// Welcome to Cascade Studio!   Here are some useful functions:
//  Translate(), Rotate(), Scale(), Union(), Difference(), Intersection()
//  Box(), Sphere(), Cylinder(), Cone(), Text3D(), Polygon()
//  Offset(), Extrude(), RotatedExtrude(), Revolve(), Pipe(), Loft(),
//  FilletEdges(), ChamferEdges(),
//  Slider(), Button(), Checkbox()

let holeRadius = Slider("Radius", 30 , 20 , 40);

let sphere     = Sphere(50);
let cylinderZ  =                     Cylinder(holeRadius, 200, true);
let cylinderY  = Rotate([0,1,0], 90, Cylinder(holeRadius, 200, true));
let cylinderX  = Rotate([1,0,0], 90, Cylinder(holeRadius, 200, true));

Translate([0, 0, 50], Difference(sphere, [cylinderX, cylinderY, cylinderZ]));

Translate([-25, 0, 40], Text3D("Hi!"));

// Don't forget to push imported or oc-defined shapes into sceneShapes to add them to the workspace!`;

export function getEditor() {
  return monacoEditor
}

export function initialize(codeUpdateCallback = () => {}, initCode, onInit) {
  // this.searchParams = new URLSearchParams(window.location.search);
  // if(isInitialized) {
  //   console.log(Object.keys(monacoEditor))
  //   return
  // }
  //   isInitialized = true

    // Load the initial Project from - LocalStorage (mainProject), URL, or the Gallery
    // let loadFromURL     = this.searchParams.has("code");
    // let loadfromGallery = this.searchParams.has("project");
    // let loadfromStorage = window.localStorage.getItem('studioState-0.0.3');
    let loadFromURL     = null
    let loadfromGallery = null
    let loadfromStorage = null

    // Set up the Windowing/Docking/Layout System  ---------------------------------------
    mainProject = (loadFromURL || loadfromGallery) ? false : true;
    let stuntedInitialization = loadfromGallery && !galleryProject;

    // Load a project from the Gallery
    if (loadfromGallery && galleryProject) {
        // Destroy old config, load new one
        if(myLayout != null){
            myLayout.destroy();
            myLayout = null;
        }
        myLayout = new GoldenLayout(JSON.parse(galleryProject), document.getElementById( 'cascade-container'));

    // Else load a project from the URL or create a new one from scratch
    } else if (!mainProject || !loadfromStorage || true) {
        let codeStr = initCode ? initCode : starterCode;
        GUIState = {};
        // if (loadFromURL) {
        //     // codeStr  = decode(this.searchParams.get("code"));
        //     // GUIState = JSON.parse(decode(this.searchParams.get("gui")));
        // } else if (stuntedInitialization) {
        //     // Begin passing on the initialization logic, this is a dead timeline
        //     codeStr = '';
        // } else {
        //     makeMainProject();
        // }

        // Define the Default Golden Layout
        // Code on the left, Model on the right
        // Console on the bottom right
        myLayout = new GoldenLayout({
            content: [{
                type: 'row',
                content: [{
                    type: 'component',
                    componentName: 'codeEditor',
                    title: 'Code Editor',
                    componentState: { code: codeStr },
                    width: 50.0,
                    isClosable: false
                }, {
                    type: 'column',
                    content: [{
                        type: 'component',
                        componentName: 'cascadeView',
                        title: 'CAD View',
                        componentState: GUIState,
                        isClosable: false
                    }, {
                        type: 'component',
                        componentName: 'console',
                        title: 'Console',
                        componentState: {},
                        height: 20.0,
                        isClosable: false
                    }]
                }]
            }],
            settings: {
                showPopoutIcon: false,
                showMaximiseIcon: false,
                showCloseIcon: false
            }
        }, document.getElementById( 'cascade-container'));

    // Else load the project wholesale from local storage
    } else {
        myLayout = new GoldenLayout(JSON.parse(loadfromStorage), document.getElementById( 'cascade-container'));
    }

    // Set up saving code changes to the localStorage
    myLayout.on('stateChanged', function () {
        if (myLayout.toConfig() !== null && mainProject) {
            window.localStorage.setItem('studioState-0.0.3', JSON.stringify(myLayout.toConfig()));
        }
    });

    // Set up the Dockable Monaco Code Editor
    myLayout.registerComponent('codeEditor', function (container, state) {
        myLayout.on("initialised", () => {
            // Set the Monaco Language Options
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            });
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            // Import Typescript Intellisense Definitions for the relevant libraries...
            var extraLibs = [];
            // let prefix = window.location.href.startsWith("https://zalo.github.io/") ? "/CascadeStudio" : "";
            // opencascade.js Typescript Definitions...
            // fetch(prefix + "/node_modules/opencascade.js/dist/oc.d.ts").then((response) => {
            // This d.ts file is moved into /public by the script "move-ts-defs" in package.json
            fetch("/CADWorker/node_modules/opencascade.js/dist/oc.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://CADWorker/node_modules/opencascade.js/dist/oc.d.ts' });
                });
            }).catch(error => {
              console.log(error.message)
            });

            // Three.js Typescript definitions...
            // This d.ts file is moved into /public by the script "move-ts-defs" in package.json
            fetch("/CADWorker/node_modules/three/build/three.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://CADWorker/node_modules/three/build/three.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // CascadeStudio Typescript Definitions...
            // This .ts file is moved into /public by the script "move-ts-defs" in package.json
            fetch("/StandardLibraryIntellisense.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://StandardLibraryIntellisense.d.ts' });
                    monaco.editor.createModel("", "typescript"); //text
                    monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);
                });
            }).catch(error => console.log(error.message));

            // Check for code serialization as an array
            codeContainer = container;
            if (isArrayLike(state.code)) {
                let codeString = "";
                for (let i = 0; i < state.code.length; i++) {
                    codeString += state.code[i] + "\n";
                }
                codeString = codeString.slice(0,-1);
                state.code = codeString;
                container.setState({ code: codeString });
            }

            // Initialize the Monaco Code Editor inside this dockable container
            monacoEditor = monaco.editor.create(container.getElement().get(0), {
                value: state.code,
                language: "typescript",
                theme: "vs-dark",
                automaticLayout: true,
                minimap: { enabled: false }//,
                //model: null
            });

            // Collapse all Functions in the Editor to suppress library clutter -----------------
            let codeLines = state.code.split(/\r\n|\r|\n/);
            let collapsed = []; let curCollapse = null;
            for (let li = 0; li < codeLines.length; li++) {
                if (codeLines[li] && codeLines[li].startsWith("function")) {
                    curCollapse = { "startLineNumber": (li + 1) };
                } else if (codeLines[li] && codeLines[li].startsWith("}") && curCollapse !== null) {
                    curCollapse["endLineNumber"] = (li + 1);
                    collapsed.push(curCollapse);
                    curCollapse = null;
                }
            }
            let mergedViewState = Object.assign(monacoEditor.saveViewState(), {
                "contributionsState": {
                    "editor.contrib.folding": {
                        "collapsedRegions": collapsed,
                        "lineCount": codeLines.length,
                        "provider": "indent"
                    },
                    "editor.contrib.wordHighlighter": false
                }
            });
            monacoEditor.restoreViewState(mergedViewState);
            // End Collapsing All Functions -----------------------------------------------------

            /** This function triggers the evaluation of the editor code
             *  inside the CAD Worker thread.*/
            monacoEditor.evaluateCode = (saveToURL = false) => {
                // Don't evaluate if the `workerWorking` flag is true
                if (workerWorking) { return; }

                // Set the "workerWorking" flag, so we don't submit
                // multiple jobs to the worker thread simultaneously
                workerWorking = true;

                // Refresh these every so often to ensure we're always getting intellisense
                monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);

                // Retrieve the code from the editor window as a string
                let newCode = monacoEditor.getValue();
                codeUpdateCallback(newCode)

                // Clear Inline Monaco Editor Error Highlights
                monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', []);

                // Refresh the GUI Panel
                if (gui) {
                    gui.clearPanels();

                    guiPanel = gui.addPanel({ label: 'Cascade Control Panel' })
                        .addButton('Evaluate', () => { monacoEditor.evaluateCode(true); });
                    messageHandlers["addSlider"]({ name: "MeshRes", default: 0.1, min: 0.01, max: 2 });
                    messageHandlers["addCheckbox"]({ name: "Cache?", default: true });
                }

                // Remove any existing Transform Handles that could be laying around
                threejsViewport.clearTransformHandles();

                // Set up receiving files from the worker thread
                // This lets users download arbitrary information
                // from the CAD engine via the `saveFile()` function
                messageHandlers["saveFile"] = (payload) => {
                    let link = document.createElement("a");
                    link.href = payload.fileURL;
                    link.download = payload.filename;
                    link.click();
                };

                // Send the current editor code and GUI state to the Worker thread
                // This is where the magic happens!
                cascadeStudioWorker.postMessage({
                    "type": "Evaluate",
                    payload: {
                        "code": newCode,
                        "GUIState": GUIState
                    }
                });

                // After evaluating, assemble all of the objects in the "workspace"
                // and begin saving them out
                cascadeStudioWorker.postMessage({
                    "type": "combineAndRenderShapes",
                    payload: { maxDeviation: GUIState["MeshRes"] }
                });

                // Saves the current code to the project
                container.setState({ code: newCode });

                // Determine whether to save the code + gui (no external files)
                // to the URL depending on the current mode of the editor.
                if (!loadfromGallery && saveToURL) {
                    if (mainProject) {
                        console.log("Saved to local storage and URL!");
                    } else {
                        console.log("Saved to URL!"); //Generation Complete!
                    }
                    // window.history.replaceState({}, 'Cascade Studio',
                    //     "?code=" + encode(newCode) + "&gui=" + encode(JSON.stringify(GUIState)));
                }

                // Print a friendly message (to which we'll append progress updates)
                console.log("Generating Model");
                onInit()
            };

            // Force the F5 Key to refresh the model instead of refreshing the page
            document.onkeydown = function (e) {
                if ((e.which || e.keyCode) == 116) {
                    e.preventDefault();
                    monacoEditor.evaluateCode(true);
                    return false;
                }
                return true;
            };
        });
    });

    // Set up the Dockable Three.js 3D Viewport for viewing the CAD Model
    myLayout.registerComponent('cascadeView', function (container, state) {
        GUIState = state;
        container.setState(GUIState);
        myLayout.on("initialised", () => {
            let floatingGUIContainer = document.createElement("div");
            floatingGUIContainer.style.position = 'absolute';
            floatingGUIContainer.id = "threejsViewportContainer";
            container.getElement().get(0).appendChild(floatingGUIContainer);
            if (!loadfromGallery || galleryProject) {
              if(!isInitialized) {
                gui = new ControlKit({ parentDomElementId: "threejsViewportContainer" });
                isInitialized = true
              }

                gui.clearPanels = function () {
                    let curNode = this._node._element;
                    while (curNode.firstChild) {
                        curNode.removeChild(curNode.firstChild);
                    }
                    this._panels = [];
                }.bind(gui);
            }

            threejsViewport = new CascadeEnvironment(container);
        });
    });

    // Set up the Error and Status Reporting Dockable Console Window
    myLayout.registerComponent('console', function (container) {
        consoleGolden = container;
        consoleContainer = document.createElement("div");
        container.getElement().get(0).appendChild(consoleContainer);
        container.getElement().get(0).style.overflow  = 'auto';
        container.getElement().get(0).style.boxShadow = "inset 0px 0px 3px rgba(0,0,0,0.75)";

        // This should allow objects with circular references to print to the text console
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

        // Overwrite the existing logging/error behaviour to print messages to the Console window
        if (!stuntedInitialization) {
            let alternatingColor = true;
            let realConsoleLog = console.log;
            console.log = function (message) {
                let newline = document.createElement("div");
                newline.style.fontFamily = "monospace";
                newline.style.color = (alternatingColor = !alternatingColor) ? "LightGray" : "white";
                newline.style.fontSize = "1.2em";
                if (message !== undefined) {
                    let messageText = JSON.stringify(message, getCircularReplacer());
                    if (messageText && messageText.startsWith('"')) { messageText = messageText.slice(1, -1); }
                    newline.innerHTML = "&gt;  " + messageText;
                } else {
                    newline.innerHTML = "undefined";
                }
                consoleContainer.appendChild(newline);
                consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;
                realConsoleLog.apply(console, arguments);
            };
            // Call this console.log when triggered from the WASM
            messageHandlers["log"  ] = (payload) => { console.log(payload); };
            messageHandlers["error"] = (payload) => { workerWorking = false; console.error(payload); };

            // Print Errors in Red
            window.onerror = function (err, url, line, colno, errorObj) {
                let newline = document.createElement("div");
                newline.style.color = "red";
                newline.style.fontFamily = "monospace";
                newline.style.fontSize = "1.2em";
                let errorText = JSON.stringify(err, getCircularReplacer());
                if (errorText && errorText.startsWith('"')) { errorText = errorText.slice(1, -1); }
                newline.innerHTML = "Line " + line + ": " + errorText;
                consoleContainer.appendChild(newline);
                consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;

                // Highlight the error'd code in the editor
                if (!errorObj || !(errorObj.stack.includes("wasm-function"))) {
                    monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', [{
                        startLineNumber: line,
                        startColumn: colno,
                        endLineNumber: line,
                        endColumn: 1000,
                        message: JSON.stringify(err, getCircularReplacer()),
                        severity: monaco.MarkerSeverity.Error
                    }]);
                }
            };

            // If we've received a progress update from the Worker Thread, append it to our previous message
            messageHandlers["Progress"] = (payload) => {
                // Add a dot to the progress indicator for each progress message we find in the queue
                consoleContainer.parentElement.lastElementChild.lastElementChild.innerText =
                    "> Generating Model" + ".".repeat(payload.opNumber) + ((payload.opType)? " ("+payload.opType+")" : "");
            };

            // Print friendly welcoming messages
            console.log("Welcome to Cascade Studio!");
            console.log("Loading CAD Kernel...");
        }
    });

    // onbeforeunload doesn't get triggered in time to do any good
    //window.onbeforeunload = function () {}
    //window.onblur  = () => { focused = false; }
    //window.onfocus = () => { focused = true; }
    //document.onblur = window.onblur; document.onfocus = window.onfocus;

    // Resize the layout when the browser resizes
    const getIdeHeight = () => window.innerHeight - 320 - 44 - 200
    // document.getElementsByClassName('cadhub-main-header')[0].offsetHeight-
    // document.getElementsByClassName('cadhub-ide-toolbar')[0].offsetHeight
    const onResize = (event) => {
      myLayout.updateSize(window.innerWidth, getIdeHeight());
    };
    window.onorientationchange = onResize
    window.onresize = onResize

    // Initialize the Layout
    myLayout.init();
    myLayout.updateSize(window.innerWidth, getIdeHeight());
    if (mainProject) { makeMainProject(); }

    // If the Main Page loads before the CAD Worker, register a
    // callback to start the model evaluation when the CAD is ready.
    messageHandlers["startupCallback"] = () => {
        startup = function () {
            // Reimport any previously imported STEP/IGES Files
            let curState = consoleGolden.getState();
            if (curState && Object.keys(curState).length > 0) {
                cascadeStudioWorker.postMessage({
                    "type": "loadPrexistingExternalFiles",
                    payload: consoleGolden.getState()
                });
            }

            monacoEditor.evaluateCode();
        }
        // Call the startup if we're ready when the wasm is ready
        if (!stuntedInitialization) { startup(); }
    }
    // Otherwise, enqueue that call for when the Main Page is ready
    if (!stuntedInitialization && startup) { startup(); }

    // Register callbacks from the CAD Worker to add Sliders, Buttons, and Checkboxes to the UI
    // TODO: Enqueue these so the sliders are added/removed at the same time to eliminate flashing
    messageHandlers["addSlider"] = (payload) => {
        if (!(payload.name in GUIState)) { GUIState[payload.name] = payload.default; }
        GUIState[payload.name + "Range"] = [payload.min, payload.max];
        guiPanel.addSlider(GUIState, payload.name, payload.name + 'Range', {
            onFinish: () => { monacoEditor.evaluateCode(); },
            onChange: () => { if (payload.realTime) { monacoEditor.evaluateCode(); } }
        });
    }
    messageHandlers["addButton"] = (payload) => {
        guiPanel.addButton(payload.name, () => { monacoEditor.evaluateCode(); });
    }
    messageHandlers["addCheckbox"] = (payload) => {
        if (!(payload.name in GUIState)) { GUIState[payload.name] = payload.default; }
        guiPanel.addCheckbox(GUIState, payload.name, { onChange: () => { monacoEditor.evaluateCode() } });
    }
    messageHandlers["resetWorking"] = () => { workerWorking = false; }
    // run code as the last part of the init process
    monacoEditor.evaluateCode()
}

/** This function serializes the Project's current state
 * into a `.json` file and starts downloading it. */
function saveProject() {
    let currentCode = codeContainer.getState().code;
    if (!isArrayLike(currentCode)) {
        codeContainer.setState({ code: currentCode.split(/\r\n|\r|\n/) });
    }
    let link = document.createElement("a");
    link.download = "CascadeStudioProject.json";
    link.href     = "data:application/json;utf8," +
                  encodeURIComponent(JSON.stringify(myLayout.toConfig(), null, 2));
    link.click();
}

/** This function asynchronously reads the text content of a file. */
const loadFileAsync = async (file) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    })
}

/** This loads a .json file into the localStorage and refreshes the page with it.
 *  This will load that data as the new Main Project.*/
function loadProject () {
    // Get Project .json
    loadFileAsync(document.getElementById("project-file").files[0]).then((jsonFile) => {
        window.localStorage.setItem('studioState-0.0.3', jsonFile);
        window.history.replaceState({}, 'Cascade Studio','?');
        location.reload();
    });
}

/** This function triggers the CAD WebWorker to
 * load one or more  .stl, .step, or .iges files. */
function loadFiles(fileElementID = "files") {
    // Ask the worker thread to load these files...
    // I can already feel this not working...
    let files = document.getElementById(fileElementID).files;
    cascadeStudioWorker.postMessage({
        "type": "loadFiles",
        "payload": files
    });

    // Receive a list of the imported files
    messageHandlers["loadFiles"] = (extFiles) => {
        console.log("Storing loaded files!");
        //console.log(extFiles);
        consoleGolden.setState(extFiles);
    };
}

/** This function clears all Externally Loaded files
 * from the `externalFiles` dict and localStorage. */
function clearExternalFiles() {
    cascadeStudioWorker.postMessage({
        "type": "clearExternalFiles"
    });
    consoleGolden.setState({});
}

/** This decodes a base64 and zipped string to the original version of that string */
// function decode(string) { return RawDeflate.inflate(window.atob(decodeURIComponent(string))); }
function decode(string) { return ''; }
/** This function encodes a string to a base64 and zipped version of that string */
// function encode(string) { return encodeURIComponent(window.btoa(RawDeflate.deflate(string))); }
function encode(string) {
  return ''
}
/** This function promotes the project to localStorage, allowing it to persist between sessions.
 * This also saves externally imported files. */
function makeMainProject() {
    mainProject = true;
    let mainProjButton = document.getElementById("main-proj-button");
    if (mainProjButton) { mainProjButton.remove(); }
    if (myLayout && mainProject) {
        window.localStorage.setItem('studioState-0.0.3', JSON.stringify(myLayout.toConfig()));
    }
}
/** This function returns true if item is indexable like an array. */
function isArrayLike(item) {
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
