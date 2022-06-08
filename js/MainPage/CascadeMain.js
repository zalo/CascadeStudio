// This script governs the layout and intialization of all of the sub-windows
// If you're looking for the internals of the CAD System, they're in /js/CADWorker
// If you're looking for the 3D Three.js Viewport, they're in /js/MainPage/CascadeView*

var myLayout, monacoEditor, threejsViewport,
    consoleContainer, consoleGolden, codeContainer, gui,
    GUIState, guiSeparatorAdded = false, userGui = false, count = 0, //focused = true,
    messageHandlers = {},
    startup, file = {}, realConsoleLog;
window.workerWorking = false;

let starterCode = 
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

function initialize(projectContent = null) {
    this.searchParams = new URLSearchParams(window.location.search || window.location.hash.substr(1))

    // Load the initial Project from - "projectContent", or the URL
    let loadFromURL     = this.searchParams.has("code")
    // Set up the Windowing/Docking/Layout System  ---------------------------------------

    // Load a project from the Gallery
    if (projectContent) {
        // Destroy old config, load new one
        if(myLayout != null){
            myLayout.destroy();
            myLayout = null;
        }
        myLayout = new GoldenLayout(JSON.parse(projectContent));

    // Else load a project from the URL or create a new one from scratch
    } else {
        let codeStr = starterCode;
        GUIState = {};
        if (loadFromURL) {
            codeStr  = decode(this.searchParams.get("code"));
            GUIState = JSON.parse(decode(this.searchParams.get("gui")));
        }

        // Define the Default Golden Layout
        // Code on the left, Model on the right
        // Console on the bottom right
        myLayout = new GoldenLayout({
            content: [{
                type: 'row',
                content: [{
                    type: 'component',
                    componentName: 'codeEditor',
                    title: '* Untitled',
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
        });

    }

    // Set up the Dockable Monaco Code Editor
    myLayout.registerComponent('codeEditor', function (container, state) {
        myLayout.on("initialised", () => {
            // Destroy the existing editor if it exists
            if (monacoEditor) {
                monaco.editor.getModels().forEach(model => model.dispose());
                monacoEditor = null;
            }

            // Set the Monaco Language Options
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            });
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            // Import Typescript Intellisense Definitions for the relevant libraries...
            var extraLibs = [];
            let prefix = window.location.href.startsWith("https://zalo.github.io/") ? "/CascadeStudio/" : "";
            // opencascade.js Typescript Definitions...
            fetch(prefix + "node_modules/opencascade.js/dist/oc.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://' + prefix + 'node_modules/opencascade.js/dist/oc.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // Three.js Typescript definitions...
            fetch(prefix + "node_modules/three/build/three.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://' + prefix + 'node_modules/three/build/three.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // CascadeStudio Typescript Definitions...
            fetch(prefix + "js/StandardLibraryIntellisense.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://' + prefix + 'js/StandardLibraryIntellisense.d.ts' });
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
                if (codeLines[li].startsWith("function")) {
                    curCollapse = { "startLineNumber": (li + 1) };
                } else if (codeLines[li].startsWith("}") && curCollapse !== null) {
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
                // Don't evaluate if the `window.workerWorking` flag is true
                if (window.workerWorking) { return; }

                // Set the "window.workerWorking" flag, so we don't submit 
                // multiple jobs to the worker thread simultaneously
                window.workerWorking = true;

                // Refresh these every so often to ensure we're always getting intellisense
                monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);

                // Retrieve the code from the editor window as a string
                let newCode = monacoEditor.getValue();

                // Clear Inline Monaco Editor Error Highlights
                monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', []);

                // Refresh the GUI Panel
                if (gui) {
                    gui.dispose();
                }

                gui = new Tweakpane.Pane({
                    title: 'Cascade Control Panel',
                    container: document.getElementById('guiPanel')
                });
                guiSeparatorAdded = false;
                userGui = false;
                messageHandlers["addButton"]({ name: "Evaluate", label: "Function", callback: () => { monacoEditor.evaluateCode(true) } });
                messageHandlers["addSlider"]({ name: "MeshRes", default: 0.1, min: 0.01, max: 2, step: 0.01, dp: 2 });
                messageHandlers["addCheckbox"]({ name: "Cache?", default: true });
                messageHandlers["addCheckbox"]({ name: "GroundPlane?", default: true });
                messageHandlers["addCheckbox"]({ name: "Grid?", default: true });
                userGui = true;
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
                // TODO: GUIState[] may be referenced upon transfer and not copied (checkboxes are false after reload although the default is true
                    payload: { maxDeviation: GUIState["MeshRes"], sceneOptions: { groundPlaneVisible: GUIState["GroundPlane?"], gridVisible: GUIState["Grid?"] } }
                });

                // Saves the current code to the project
                container.setState({ code: newCode });

                // Determine whether to save the code + gui (no external files) 
                // to the URL depending on the current mode of the editor.
                if (saveToURL) {
                    console.log("Saved to URL!"); //Generation Complete! 
                    window.history.replaceState({}, 'Cascade Studio',
                      new URL(location.pathname + "#code=" + encode(newCode) + "&gui=" + encode(JSON.stringify(GUIState)), location.href).href
                    );
                }

                // Print a friendly message (to which we'll append progress updates)
                console.log("Generating Model");
            };

            document.onkeydown = function (e) {
                // Force the F5 Key to refresh the model instead of refreshing the page
                if ((e.which || e.keyCode) == 116) {
                    e.preventDefault();
                    monacoEditor.evaluateCode(true);
                    return false;
                }
                // Save the project on Ctrl+S
                if (String.fromCharCode(e.keyCode).toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    saveProject();
                    monacoEditor.evaluateCode(true);
                }
                return true;
            };

            document.onkeyup = function (e) {
                if (!file.handle || e.which === 0) {
                    return true;
                }
                if (file.content == monacoEditor.getValue()) {
                    codeContainer.setTitle(file.handle.name);
                } else {
                    codeContainer.setTitle('* ' + file.handle.name);
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
            // Destroy the existing editor if it exists
            if (threejsViewport) {
                threejsViewport.active = false;
                threejsViewport = null;
            }

            let floatingGUIContainer = document.createElement("div");
            floatingGUIContainer.className = 'gui-panel';
            floatingGUIContainer.id = "guiPanel";
            container.getElement().get(0).appendChild(floatingGUIContainer);
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
        if (!realConsoleLog) {
            let alternatingColor = true;
            realConsoleLog = console.log;
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
                realConsoleLog.apply(console, arguments);
            };
            // Call this console.log when triggered from the WASM
            messageHandlers["log"  ] = (payload) => { console.log(payload); };
            messageHandlers["error"] = (payload) => { window.workerWorking = false; console.error(payload); };

            // Print Errors in Red
            window.onerror = function (err, url, line, colno, errorObj) {
                let newline = document.createElement("div");
                newline.style.color = "red";
                newline.style.fontFamily = "monospace";
                newline.style.fontSize = "1.2em";
                let errorText = JSON.stringify(err, getCircularReplacer());
                if (errorText.startsWith('"')) { errorText = errorText.slice(1, -1); }
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
    window.onorientationchange = function (event) {
        myLayout.updateSize(window.innerWidth, window.innerHeight -
            document.getElementsByClassName('topnav')[0].offsetHeight);
    };

    // Initialize the Layout
    myLayout.init();
    myLayout.updateSize(window.innerWidth, window.innerHeight -
        document.getElementById('topnav').offsetHeight);

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
        startup();
    }
    // Otherwise, enqueue that call for when the Main Page is ready
    if (startup) { startup(); }

    // Register callbacks from the CAD Worker to add Sliders, Buttons, and Checkboxes to the UI
    // TODO: Enqueue these so the sliders are added/removed at the same time to eliminate flashing
    messageHandlers["addSlider"] = (payload) => {
        if (!(payload.name in GUIState)) { GUIState[payload.name] = payload.default; }
        const params = {
            min: payload.min,
            max: payload.max,
            step: payload.step,
        };
        if (payload.dp) {
            params.format = v => v.toFixed(payload.dp);
        }

        addGuiSeparator();
        const slider = gui.addInput(
            GUIState,
            payload.name,
            params
        );

        if (payload.realTime) {
            slider.on('change', e => {
                if (e.last) {
                    delayReloadEditor();
                }
            });
        }
    }
    messageHandlers["addButton"] = (payload) => {
        addGuiSeparator();
        gui.addButton({ title: payload.name, label: payload.label }).on('click', payload.callback);
    }

    messageHandlers["addCheckbox"] = (payload) => {
        if (!(payload.name in GUIState)) { GUIState[payload.name] = payload.default || false; }
        addGuiSeparator();
        gui.addInput(GUIState, payload.name).on('change', () => {
            delayReloadEditor();
        })
    }

    messageHandlers["addTextbox"] = (payload) => {
        if (!(payload.name in GUIState)) { GUIState[payload.name] = payload.default || ''; }
        addGuiSeparator();
        const input = gui.addInput(GUIState, payload.name)
        if (payload.realTime) {
            input.on('change', e => {
                if (e.last) {
                    delayReloadEditor();
                }
            })
        }
    }

    messageHandlers['addDropdown'] = (payload) => {
        if (!(payload.name in GUIState)) { GUIState[payload.name] = payload.default || ''; }
        const options = payload.options || {}

        addGuiSeparator();
        const input = gui.addInput(GUIState, payload.name, { options })
        if (payload.realTime) {
            input.on('change', e => {
                if (e.last) {
                    delayReloadEditor();
                }
            })
        }
    }

    messageHandlers["resetWorking"] = () => { window.workerWorking = false; }
}

function addGuiSeparator() {
    if (userGui && !guiSeparatorAdded) {
        guiSeparatorAdded = true;
        gui.addSeparator();
    }
}

/* Workaround for Tweakpane errors when tearing down gui during change event callbacks */
function delayReloadEditor() {
    setTimeout(() => { monacoEditor.evaluateCode(); }, 0);
}

async function getNewFileHandle(desc, mime, ext, open = false) {
    const options = {
      types: [
        {
          description: desc,
          accept: {
            [mime]: ['.' + ext],
          },
        },
      ],
    };
    if (open) {
        return await window.showOpenFilePicker(options);
    } else {
        return await window.showSaveFilePicker(options);
    }
}

async function writeFile(fileHandle, contents) {
    // Create a FileSystemWritableFileStream to write to.
    const writable = await fileHandle.createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
}

/** This function serializes the Project's current state 
 * into a `.json` file and saves it to the selected location. */
async function saveProject() {
    let currentCode = monacoEditor.getValue();
    if (!file.handle) {
        file.handle = await getNewFileHandle(
            "Cascade Studio project files",
            "application/json",
            "json"
        );
    }

    codeContainer.setState({ code: currentCode.split(/\r\n|\r|\n/) });

    writeFile(file.handle, JSON.stringify(myLayout.toConfig(), null, 2)).then(() => {
        codeContainer.setTitle(file.handle.name);
        console.log("Saved project to " + file.handle.name);
        file.content = currentCode;
    });
}

async function downloadFile(data, name, mime, ext) {
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

/** This loads a .json file as the currentProject.*/
const loadProject = async () => {
    // Don't allow loading while the worker is working to prevent race conditions.
    if (window.workerWorking) { return; }

    // Load Project .json from a file
    [file.handle] = await getNewFileHandle(
        'Cascade Studio project files',
        'application/json',
        'json',
        open = true
    );
    let fileSystemFile = await file.handle.getFile();
    let jsonContent = await fileSystemFile.text();
    window.history.replaceState({}, 'Cascade Studio','?');
    initialize(projectContent=jsonContent);
    codeContainer.setTitle(file.handle.name);
    file.content = monacoEditor.getValue();
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
 * from the `externalFiles` dict. */
function clearExternalFiles() {
    cascadeStudioWorker.postMessage({
        "type": "clearExternalFiles"
    });
    consoleGolden.setState({});
}

/** This decodes a base64 and zipped string to the original version of that string */
function decode(string) { return RawDeflate.inflate(window.atob(decodeURIComponent(string))); }
/** This function encodes a string to a base64 and zipped version of that string */
function encode(string) { return encodeURIComponent(window.btoa(RawDeflate.deflate(string))); }

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
