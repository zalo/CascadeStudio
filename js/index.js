var myLayout, monacoEditor,
    cascadeViewport, consoleContainer, consoleGolden, gui,
    GUIState, count = 0, focused = true,
    oc = null, externalShapes = {};

let starterCode = 
`function CompileModel() {
    console.log("Model Compiling...");

    // Create a Sphere
    let spherePlane    = new oc.gp_Ax2(new oc.gp_Pnt(0, 0, 50.), oc.gp.prototype.DZ());
    let sphere         = new oc.BRepPrimAPI_MakeSphere(spherePlane, 50.0).Solid();

    // Create Cylinders to Subtract
    let xCylinderPlane = new oc.gp_Ax2(new oc.gp_Pnt(-100, 0, 50), new oc.gp_Dir(1, 0, 0));
    let yCylinderPlane = new oc.gp_Ax2(new oc.gp_Pnt(0, -100, 50), new oc.gp_Dir(0, 1, 0));
    let zCylinderPlane = new oc.gp_Ax2(new oc.gp_Pnt(0,    0,-50), new oc.gp_Dir(0, 0, 1));
    let xCylinder      = new oc.BRepPrimAPI_MakeCylinder(xCylinderPlane, GUIState['Radius'], 200.0).Solid();
    let yCylinder      = new oc.BRepPrimAPI_MakeCylinder(yCylinderPlane, GUIState['Radius'], 200.0).Solid();
    let zCylinder      = new oc.BRepPrimAPI_MakeCylinder(zCylinderPlane, GUIState['Radius'], 200.0).Solid();

    // Cut the Cylinders from the Sphere
    sphere             = new oc.BRepAlgoAPI_Cut(sphere, xCylinder).Shape();
    sphere             = new oc.BRepAlgoAPI_Cut(sphere, yCylinder).Shape();
    sphere             = new oc.BRepAlgoAPI_Cut(sphere, zCylinder).Shape();

    // Convert to a mesh
    console.log("Compilation Complete! Converting to Mesh...");
    cascadeViewport.updateShape(sphere, GUIState["Res"]);
    console.log("Generation Complete!");
}


// Define GUI State Variables here
Object.assign(GUIState, {
    "Res"    : 0.1,  "ResRange"    : [0.01, 1.00],
    "Radius" : 30.0, "RadiusRange" : [27.0, 35.0] });

// GUI uses https://github.com/automat/controlkit.js
gui.addPanel({label: 'Cascade Control Panel'})
   .addButton     ('Generate Model' ,                             () => { CompileModel(); }  )
   .addSlider     (GUIState, 'Res',       'ResRange', { onFinish: () => { CompileModel(); }} )
   .addSlider     (GUIState, 'Radius', 'RadiusRange', { onFinish: () => { CompileModel(); }} );
`;

// Functions to be overwritten by the editor window
//function Update(){}

function initialize(opencascade) {
    oc = opencascade;

    // Set up the Windowing System  ---------------------------------------
    let loadedState = window.localStorage.getItem('studioState');
    if (loadedState === null) {
        myLayout = new GoldenLayout( {
            content: [{
                type: 'row',
                content:[{
                    type: 'component',
                    componentName: 'codeEditor',
                    title:'Code Editor',
                    componentState: { code: starterCode },
                    width: 50.0,
                    isClosable: false
                },{
                    type: 'column',
                    content:[{
                        type: 'component',
                        componentName: 'cascadeView',
                        title:'CAD View',
                        componentState: { },
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
        if (myLayout.toConfig() !== null) {
            window.localStorage.setItem('studioState', JSON.stringify(myLayout.toConfig()));
        }
    });

    // Set up the Monaco Code Editor
    myLayout.registerComponent('codeEditor', function (container, state) {
        setTimeout(() => {
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                allowJs: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
            });
            monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

            // Golden Layout Typescript definitions...
            fetch("/CascadeStudio/node_modules/golden-layout/index.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///CascadeStudio/node_modules/golden-layout/index.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from opencascade.js...
            fetch("/CascadeStudio/node_modules/opencascade.js/dist/oc.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///CascadeStudio/node_modules/opencascade.js/dist/oc.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Three.js Typescript definitions...
            fetch("/CascadeStudio/node_modules/three/build/three.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///CascadeStudio/node_modules/three/build/three.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from ControlKit.js...
            fetch("/CascadeStudio/node_modules/controlkit/bin/controlkit.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///CascadeStudio/node_modules/controlkit/bin/controlkit.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from this file...
            fetch("/CascadeStudio/js/index.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.editor.createModel(text, "javascript");
                });
            }).catch(error => console.log(error.message));

            monacoEditor = monaco.editor.create(container.getElement().get(0), {
                value: state.code,
                language: "javascript",
                theme: "vs-dark",
                automaticLayout: true,
                minimap: { enabled: false}//,
                //model: null
            });

            // Refresh the code once every couple seconds if necessary
            setInterval(()=>{ 
                let newCode = monacoEditor.getValue();
                if(newCode !== container.getState().code){
                    // Clear Errors
                    monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', []);
                    consoleContainer.innerHTML = "";

                    gui.clearPanels();

                    window.eval(newCode); 
                }
                container.setState({ code: newCode });
            }, 2000);

            window.eval(state.code); 
            CompileModel();
        }, 300);
    });

    // Set up the 3D Viewport into the CAD Model
    myLayout.registerComponent('cascadeView', function(container, state){
        GUIState = state;
        container.setState(GUIState);
        setTimeout(()=> { 
            let floatingGUIContainer = document.createElement("div");
            floatingGUIContainer.style.position = 'absolute';
            floatingGUIContainer.id = "cascadeViewportContainer";
            container.getElement().get(0).appendChild(floatingGUIContainer);
            gui             = new ControlKit({parentDomElementId: "cascadeViewportContainer"});
            cascadeViewport = new CascadeEnvironment(container, oc); 
        }, 100);
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

        // Reimport any imported STEP/IGES Files
        let prexistingExternalFiles = consoleGolden.getState();
        for (let key in prexistingExternalFiles) {
            importSTEPorIGES(key, prexistingExternalFiles[key].content);
        }; 
    });

    // Doesn't get triggered in time to do any good
    window.onbeforeunload = function () {}
    window.onblur   = function (){ focused = false; }
    window.onfocus  = function (){ focused = true;  }
    document.onblur = window.onblur; document.onfocus = window.onfocus;
    window.onorientationchange = function(event) { 
        myLayout.updateSize(window.innerWidth, window.innerHeight -
            document.getElementsByClassName('topNav')[0].offsetHeight);
    };

    myLayout.init();
    myLayout.updateSize(window.innerWidth, window.innerHeight -
        document.getElementsByClassName('topNav')[0].offsetHeight);
}

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
        window.localStorage.setItem('studioState', jsonFile);
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
                    cascadeViewport.updateShape(lastImportedShape, GUIState["Res"]);
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
      console.log("Shape Import complete!  It is accessible from: externalShapes['"+fileName+"']");
      
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
