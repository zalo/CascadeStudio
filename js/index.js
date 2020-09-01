var myLayout, monacoEditor,
    threejsViewport, consoleContainer, consoleGolden, gui,
    guiPanel, GUIState, count = 0, focused = true,
    mainProject = false, messageHandlers = {}, workerWorking = false, startup;

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

// Functions to be overwritten by the editor window
//function Update(){}

function initialize() {
    this.searchParams = new URLSearchParams(window.location.search);

    // Three Data Loading Methods - LocalStorage (mainProject), URL, and Gallery
    let loadFromURL     = this.searchParams.has("code");
    let loadfromGallery = this.searchParams.has("project");
    let loadfromStorage = window.localStorage.getItem('studioState-0.0.3');

    // Set up the Windowing System  ---------------------------------------
    mainProject = (loadFromURL || loadfromGallery) ? false : true;
    let stuntedInitialization = loadfromGallery && !galleryProject;
    if (loadfromGallery && galleryProject) {
        // Destroy old config, load new one
        if(myLayout != null){
            myLayout.destroy();
            myLayout = null;
        }
        myLayout = new GoldenLayout(JSON.parse(galleryProject));
    } else if (!mainProject || !loadfromStorage) {
        let codeStr = starterCode;
        GUIState = {};
        if (loadFromURL) {
            codeStr  = decode(this.searchParams.get("code"));
            GUIState = JSON.parse(decode(this.searchParams.get("gui")));
        } else if (stuntedInitialization) {
            // Begin passing on the initialization logic, this is a dead timeline
            codeStr = '';
        } else {
            makeMainProject();
        }

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
        });
    } else {
        myLayout = new GoldenLayout(JSON.parse(loadfromStorage));
    }

    // Set up saving code changes to the localStorage
    myLayout.on('stateChanged', function () {
        if (myLayout.toConfig() !== null && mainProject) {
            window.localStorage.setItem('studioState-0.0.3', JSON.stringify(myLayout.toConfig()));
        }
    });

    // Set up the Monaco Code Editor
    myLayout.registerComponent('codeEditor', function (container, state) {
        myLayout.on("initialised", () => {
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            });
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            var extraLibs = [];
            let prefix = window.location.origin.includes("zalo.github.io") ? "/CascadeStudio" : "";

            // Golden Layout Typescript definitions...
            //fetch(prefix+"node_modules/golden-layout/index.d.ts").then((response) => {
            //    response.text().then(function (text) {
            //        extraLibs.push({ content: text, filePath: 'file://'+prefix+'/node_modules/golden-layout/index.d.ts' });
            //    });
            //}).catch(error => console.log(error.message));

            // Add Symbols from opencascade.js...
            fetch(prefix + "/node_modules/opencascade.js/dist/oc.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://' + prefix + '/node_modules/opencascade.js/dist/oc.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // Three.js Typescript definitions...
            fetch(prefix + "/node_modules/three/build/three.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://' + prefix + '/node_modules/three/build/three.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from ControlKit.js...
            //fetch(prefix+"/node_modules/controlkit/bin/controlkit.d.ts").then((response) => {
            //    response.text().then(function (text) {
            //        extraLibs.push({ content: text, filePath: 'file://'+prefix+'/node_modules/controlkit/bin/controlkit.d.ts' });
            //    });
            //}).catch(error => console.log(error.message));

            // Add Symbols from this file...
            fetch(prefix + "/js/index.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://' + prefix + '/js/index.d.ts' });
                    monaco.editor.createModel("", "typescript"); //text
                    monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);
                });
            }).catch(error => console.log(error.message));

            monacoEditor = monaco.editor.create(container.getElement().get(0), {
                value: state.code,
                language: "typescript",
                theme: "vs-dark",
                automaticLayout: true,
                minimap: { enabled: false }//,
                //model: null
            });

            // Refresh the code once every couple seconds if necessary
            monacoEditor.evaluateCode = (saveToURL = false) => {
                // Set the "workerWorking" flag, so we don't submit multiple jobs to the worker thread simultaneously
                if (workerWorking) { return; }
                workerWorking = true;

                // Refresh these every so often to ensure we're always getting intellisense
                monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);

                let newCode = monacoEditor.getValue();

                // Clear Errors
                monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', []);

                if (gui) {
                    gui.clearPanels();
                    guiPanel = gui.addPanel({ label: 'Cascade Control Panel' })
                        .addButton('Evaluate', () => { monacoEditor.evaluateCode(true); });
                    messageHandlers["addSlider"]({ name: "MeshRes", default: 0.1, min: 0.01, max: 2 });
                }

                threejsViewport.clearTransformHandles();
                cascadeStudioWorker.postMessage({ // Evaluates the code in the editor
                    "type": "Evaluate",
                    payload: {
                        "code": newCode,
                        "GUIState": GUIState
                    }
                });

                // This assembles all of the objects in the "workspace" and begins saving them out
                cascadeStudioWorker.postMessage({
                    "type": "combineAndRenderShapes",
                    payload: { maxDeviation: GUIState["MeshRes"] }
                });

                container.setState({ code: newCode }); // Saves this code to the local cache if it compiles

                if (!loadfromGallery && saveToURL) {
                    if (mainProject) {
                        console.log("Saved to local storage and URL!");
                    } else {
                        console.log("Saved to URL!"); //Generation Complete! 
                    }
                    window.history.replaceState({}, 'Cascade Studio',
                        "?code=" + encode(newCode) + "&gui=" + encode(JSON.stringify(GUIState)));
                }
                console.log("Generating Model");
            }
            // Allow F5 to refresh the model
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

    // Set up the 3D Viewport into the CAD Model
    myLayout.registerComponent('cascadeView', function (container, state) {
        GUIState = state;
        container.setState(GUIState);
        myLayout.on("initialised", () => {
            let floatingGUIContainer = document.createElement("div");
            floatingGUIContainer.style.position = 'absolute';
            floatingGUIContainer.id = "threejsViewportContainer";
            container.getElement().get(0).appendChild(floatingGUIContainer);
            if (!loadfromGallery || galleryProject) {
                gui = new ControlKit({ parentDomElementId: "threejsViewportContainer" });
            }
                
            threejsViewport = new CascadeEnvironment(container);
        });
    });

    // Set up the Error and Status Reporting Console
    myLayout.registerComponent('console', function (container) {
        consoleGolden = container;
        consoleContainer = document.createElement("div");
        container.getElement().get(0).appendChild(consoleContainer);
        container.getElement().get(0).style.overflow = 'auto';
        container.getElement().get(0).style.boxShadow = "inset 0px 0px 3px rgba(0,0,0,0.75)";

        const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key, value) => {
                if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) { return; }
                    seen.add(value);
                }
                return value;
            };
        };

        // Overwrite the existing logging/error behaviour
        if (!stuntedInitialization) {
            let alternatingColor = true;
            let realConsoleLog = console.log;
            console.log = function (message) {
                let newline = document.createElement("div");
                newline.style.fontFamily = "monospace";
                newline.style.color = (alternatingColor = !alternatingColor) ? "LightGray" : "white";
                newline.style.fontSize = "1.2em";
                newline.innerHTML = "&gt;  " + JSON.stringify(message, getCircularReplacer()).slice(1, -1);
                consoleContainer.appendChild(newline);
                consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;
                realConsoleLog.apply(console, arguments);
            };
            // Call this console.log when triggered from the WASM
            messageHandlers["log"] = (payload) => { console.log(payload); };

            window.onerror = function (err, url, line, colno, errorObj) {
                let newline = document.createElement("div");
                newline.style.color = "red";
                newline.style.fontFamily = "monospace";
                newline.style.fontSize = "1.2em";
                newline.innerHTML = "Line : " + line + " " + JSON.stringify(err, getCircularReplacer()).slice(1, -1);
                consoleContainer.appendChild(newline);
                consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;

                // Highlight the error'd code in the editor
                if (!errorObj.stack.includes("wasm-function")) {
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

            messageHandlers["Progress"] = (opNumber) => {
                // Add a dot to the progress indicator for each 
                // progress message we find in the queue
                consoleContainer.parentElement.lastElementChild.lastElementChild.innerText = "> Generating Model" + ".".repeat(opNumber);
            }

            console.log("Welcome to Cascade Studio!");
            console.log("Loading CAD Kernel...");
        }
    });

    // Doesn't get triggered in time to do any good
    //window.onbeforeunload = function () {}
    window.onblur = () => { focused = false; }
    window.onfocus = () => { focused = true; }
    document.onblur = window.onblur; document.onfocus = window.onfocus;
    window.onorientationchange = function (event) {
        myLayout.updateSize(window.innerWidth, window.innerHeight -
            document.getElementsByClassName('topnav')[0].offsetHeight);
    };

    myLayout.init();
    myLayout.updateSize(window.innerWidth, window.innerHeight -
        document.getElementById('topnav').offsetHeight);
    if (mainProject) { makeMainProject(); }

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
    // Otherwise, enqueue that call for when the main thread is ready
    if (!stuntedInitialization && startup) { startup(); }

    // Todo: Enqueue these so the sliders are added/removed at the same time to eliminate flashing
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
}

function saveProject () {
    let link = document.createElement("a");
    link.download = "CascadeStudioProject.json";
    link.href     = "data:application/json;utf8," + 
                  encodeURIComponent(JSON.stringify(myLayout.toConfig(), null, ' '));
    link.click();
}

const loadFileAsync = async (file) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    })
}
function loadProject () {
    // Get Project .json
    loadFileAsync(document.getElementById("project-file").files[0]).then((jsonFile) => {
        window.localStorage.setItem('studioState-0.0.3', jsonFile);
        window.history.replaceState({}, 'Cascade Studio','?');
        location.reload();
    });
}

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
        console.log(extFiles);
        consoleGolden.setState(extFiles);
    };
}

function clearExternalFiles() {
    cascadeStudioWorker.postMessage({
        "type": "clearExternalFiles"
    });
    consoleGolden.setState({});
}

function decode(string) { return RawDeflate.inflate(window.atob(decodeURIComponent(string))); }
function encode(string) { return encodeURIComponent(window.btoa(RawDeflate.deflate(string))); }
function makeMainProject() {
    mainProject = true;
    let mainProjButton = document.getElementById("main-proj-button");
    if (mainProjButton) { mainProjButton.remove(); }
    if (myLayout && mainProject) {
        window.localStorage.setItem('studioState-0.0.3', JSON.stringify(myLayout.toConfig()));
    }
}
