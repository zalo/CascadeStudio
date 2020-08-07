var myLayout, monacoEditor,
    threejsViewport, consoleContainer, consoleGolden, gui,
    guiPanel, GUIState, count = 0, focused = true,
    oc = null, externalShapes = {}, sceneShapes = [], mainProject = false,
    robotoFont = null, curFontURL = './fonts/Consolas.ttf';

let starterCode = 
`// Welcome to Cascade Studio!   Here are some useful functions:
//  Translate(), Rotate(), Scale(), Union(), Difference(), Intersection()
//  Box(), Sphere(), Cylinder(), Cone(), Text3D(), Polygon(), Extrude(), FilletEdges()
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

function initialize(opencascade) {
    console.log("This is a test!");
    oc = opencascade;

    this.searchParams = new URLSearchParams(window.location.search);

    // Set up the Windowing System  ---------------------------------------
    let loadedState = window.localStorage.getItem('studioState-0.0.3');
    if (loadedState === null || this.searchParams.has("code")) {
        let codeStr = starterCode;
        GUIState = {};
        if (this.searchParams.has("code")) {
            codeStr = decode(this.searchParams.get("code"));
            GUIState = JSON.parse(decode(this.searchParams.get("gui")));
            mainProject = false;
        } else { makeMainProject(); }
        mainProject = !this.searchParams.has("code");

        myLayout = new GoldenLayout( {
            content: [{
                type: 'row',
                content:[{
                    type: 'component',
                    componentName: 'codeEditor',
                    title:'Code Editor',
                    componentState: { code: codeStr },
                    width: 50.0,
                    isClosable: false
                },{
                    type: 'column',
                    content:[{
                        type: 'component',
                        componentName: 'cascadeView',
                        title:'CAD View',
                        componentState: GUIState,
                        isClosable: false
                    },{
                        type: 'component',
                        componentName: 'console',
                        title:'Console',
                        componentState: { },
                        height: 20.0,
                        isClosable: false
                    }]
                }]
            }],
            settings:{
                showPopoutIcon:   false,
                showMaximiseIcon: false,
                showCloseIcon:    false
            }
        });
    } else {
        myLayout = new GoldenLayout( JSON.parse( loadedState ));
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
            fetch(prefix+"/node_modules/opencascade.js/dist/oc.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://'+prefix+'/node_modules/opencascade.js/dist/oc.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // Three.js Typescript definitions...
            fetch(prefix+"/node_modules/three/build/three.d.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://'+prefix+'/node_modules/three/build/three.d.ts' });
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from ControlKit.js...
            //fetch(prefix+"/node_modules/controlkit/bin/controlkit.d.ts").then((response) => {
            //    response.text().then(function (text) {
            //        extraLibs.push({ content: text, filePath: 'file://'+prefix+'/node_modules/controlkit/bin/controlkit.d.ts' });
            //    });
            //}).catch(error => console.log(error.message));

            // Add Symbols from this file...
            fetch(prefix+"/js/index.ts").then((response) => {
                response.text().then(function (text) {
                    extraLibs.push({ content: text, filePath: 'file://'+prefix+'/js/index.d.ts' });
                    monaco.editor.createModel("", "typescript"); //text
                    monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);
                    monacoEditor.evaluateCode();
                });
            }).catch(error => console.log(error.message));

            monacoEditor = monaco.editor.create(container.getElement().get(0), {
                value: state.code,
                language: "typescript",
                theme: "vs-dark",
                automaticLayout: true,
                minimap: { enabled: false}//,
                //model: null
            });

            // Refresh the code once every couple seconds if necessary
            monacoEditor.evaluateCode = (saveToURL = false) => {
                // Refresh these every so often to ensure we're always getting intellisense
                monaco.languages.typescript.typescriptDefaults.setExtraLibs(extraLibs);

                let newCode = monacoEditor.getValue();

                // Clear Errors
                monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', []);

                gui.clearPanels();
                guiPanel = gui.addPanel({ label: 'Cascade Control Panel' })
                    .addButton('Evaluate', () => { monacoEditor.evaluateCode(true); });
                Slider("MeshRes", 0.1, 0.01, 2);

                sceneShapes = [];
                window.eval(newCode); // Evaluates the code in the editor

                // This assembles all of the objects in the "workspace" and begins saving them out
                if (sceneShapes.length > 0) {
                    let scene = new oc.TopoDS_Compound();
                    let sceneBuilder = new oc.BRep_Builder();
                    sceneBuilder.MakeCompound(scene);
                    sceneShapes.forEach((curShape) => {
                        sceneBuilder.Add(scene, curShape);
                    });
                    threejsViewport.updateShape(scene, GUIState["MeshRes"]);

                    if (mainProject && saveToURL) {
                        container.setState({ code: newCode }); // Saves this code to the local cache if it compiles
                        console.log("Generation Complete! Saved to local storage and URL!");
                    } else {
                        console.log("Generation Complete!" + (saveToURL?" Saved to URL!": ""));
                    }
                    if (saveToURL) {
                        window.history.replaceState({}, 'Cascade Studio',
                            "?code=" + encode(newCode) + "&gui=" + encode(JSON.stringify(GUIState)));
                    }
                } else {
                    console.log("sceneShapes doesn't have any shapes in it!  Nothing was generated!");
                }
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
    myLayout.registerComponent('cascadeView', function(container, state){
        GUIState = state;
        container.setState(GUIState);
        myLayout.on("initialised", () => {
            let floatingGUIContainer = document.createElement("div");
            floatingGUIContainer.style.position = 'absolute';
            floatingGUIContainer.id = "threejsViewportContainer";
            container.getElement().get(0).appendChild(floatingGUIContainer);
            gui             = new ControlKit({parentDomElementId: "threejsViewportContainer"});
            threejsViewport = new CascadeEnvironment(container, oc); 
        });
    });

    // Set up the Error and Status Reporting Console
    myLayout.registerComponent('console', function (container) {
        consoleGolden = container;
        consoleContainer = document.createElement("div");
        container.getElement().get(0).appendChild(consoleContainer);
        container.getElement().get(0).style.overflow  = 'auto';
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
        let alternatingColor = true;
        let realConsoleLog = console.log;
        console.log = function(message) {
            let newline = document.createElement("div");
            newline.style.fontFamily = "monospace";
            newline.style.color = (alternatingColor = !alternatingColor) ? "LightGray" : "white";
            newline.style.fontSize = "1.2em";
            newline.innerHTML = "&gt;  " + JSON.stringify(message, getCircularReplacer());
            consoleContainer.appendChild(newline);
            consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;
            realConsoleLog.apply(console, arguments);
        };
        window.onerror = function(err, url, line, colno, errorObj) {
            let newline = document.createElement("div");
            newline.style.color = "red";
            newline.style.fontFamily = "monospace";
            newline.style.fontSize = "1.2em";
            newline.innerHTML = "Line : "+line + " " + JSON.stringify(err, getCircularReplacer());
            consoleContainer.appendChild(newline);
            consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;

            // Highlight the error'd code in the editor
            if(!errorObj.stack.includes("wasm-function")){
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

        console.log("Welcome to Cascade Studio!");

        // Reimport any imported STEP/IGES Files
        let prexistingExternalFiles = consoleGolden.getState();
        for (let key in prexistingExternalFiles) {
            importSTEPorIGES(key, prexistingExternalFiles[key].content);
        }; 
    });

    // Doesn't get triggered in time to do any good
    //window.onbeforeunload = function () {}
    window.onblur   = function (){ focused = false; }
    window.onfocus  = function (){ focused = true;  }
    document.onblur = window.onblur; document.onfocus = window.onfocus;
    window.onorientationchange = function(event) { 
        myLayout.updateSize(window.innerWidth, window.innerHeight -
            document.getElementsByClassName('topnav')[0].offsetHeight);
    };

    myLayout.init();
    myLayout.updateSize(window.innerWidth, window.innerHeight -
        document.getElementById('topnav').offsetHeight);
}

opentype.load(curFontURL, function (err, font) { //'./fonts/Roboto-Black.ttf' './fonts/Papyrus.ttf' './fonts/Consolas.ttf'
    if (err) { console.log(err); }
    robotoFont = font;
});

function saveProject () {
    let link = document.createElement("a");
    link.download = "CascadeStudioProject.json";
    link.href = "data:application/json;utf8," + 
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
        location.reload();
    });
}

function loadSTEPorIGES() {
    let extFiles = {};
    let files = document.getElementById("step-file").files;
    for (let i = 0; i < files.length; i++) {
        var lastImportedShape = null;
        loadFileAsync(files[i]).then(async (fileText) => {
            const fileName = files[i].name;
            lastImportedShape = importSTEPorIGES(fileName, fileText);
            extFiles[fileName] = { content: fileText };
        }).then(async () => {
            if (i === files.length - 1) {
                if (lastImportedShape) {
                    threejsViewport.updateShape(lastImportedShape, GUIState["MeshRes"]);
                }
            }
            consoleGolden.setState(extFiles);
        });
    };
}

function importSTEPorIGES(fileName, fileText) {
    // Writes the uploaded file to Emscripten's Virtual Filesystem
    oc.FS.createDataFile("/", fileName, fileText, true, true);

    // Choose the correct OpenCascade file parsers to read the CAD file
    var reader = null, fileType = false;
    if (fileName.endsWith(".step") || fileName.endsWith(".stp")) {
      reader = new oc.STEPControl_Reader();
    } else if (fileName.endsWith(".iges") || fileName.endsWith(".igs")) {
      reader = new oc.IGESControl_Reader();
    } else { console.error("opencascade.js can't parse this extension! (yet)"); }

    const readResult = reader.ReadFile(fileName);            // Read the file
    if (readResult === 1) {
      console.log(fileName + " loaded successfully!     Converting to OCC now...");
      const numRootsTransferred = reader.TransferRoots();    // Translate all transferable roots to OpenCascade
      const stepShape           = reader.OneShape();         // Obtain the results of translation in one OCCT shape
      
      // Add to the externalShapes dictionary
      externalShapes[fileName] = stepShape;
      console.log("Shape Import complete! Use sceneShapes.push(externalShapes['"+fileName+"']); to see it!");
      
      // Remove the file when we're done (otherwise we run into errors on reupload)
      oc.FS.unlink("/" + fileName);
      
      return externalShapes[fileName];
    } else {
      console.error("Something in OCCT went wrong trying to read " + fileName);
      return null;
    }
}

// Remove the externally imported shapes from the project
function clearExternalFiles () {
    externalShapes = {};
    consoleGolden.setState({});
}

function decode(string) {
	return RawDeflate.inflate(window.atob(decodeURIComponent(string)));
}

function encode(string) {
	return encodeURIComponent(window.btoa(RawDeflate.deflate(string)));
}

function makeMainProject() {
    mainProject = true;
    document.getElementById("main-proj-button").remove();
    if (myLayout && mainProject) {
        window.localStorage.setItem('studioState-0.0.3', JSON.stringify(myLayout.toConfig()));
    }
}
