var myLayout, monacoEditor, loadedState, 
cascadeViewport, consoleContainer, gui, 
GUIState, count = 0, focused = true;

let starterCode = 
`// Welcome to Cascade Studio!
// This code is saved to your localStorage, so don't be afraid to leave and come back!
// GUI uses https://github.com/automat/controlkit.js

// Define GUI State Variables here
GUIState['width'     ] =  0.5; 
GUIState['widthRange'] = [0.1, 1];

gui.addPanel({label: 'Cascade Control Panel'})
   //.addStringInput(GUIState,          'name', { label: 'IP Addr'  } )
   .addButton     ('Recompile Model' ,                          () => { recompileModel(); } )
   .addSlider     (GUIState, 'width', 'widthRange', { onFinish: () => { recompileModel(); }} );

function printName     () { console.log(GUIState['name']); }
function recompileModel() { console.log("Model Recompiling!"); }
`;

// Functions to be overwritten by the editor window
//function Update(){}

function initialize(){
    // Set up the Windowing System  ---------------------------------------
    loadedState = localStorage.getItem( 'savedState' );
    if( loadedState !== null ) {
        myLayout = new GoldenLayout( JSON.parse( loadedState ) );
    } else {
        myLayout = new GoldenLayout( {
            content: [{
                type: 'row',
                content:[{
                    type: 'component',
                    componentName: 'cascadeView',
                    title:'CAD View',
                    //componentState: { ip: '192.168.1.142:3000' },
                    isClosable: false
                },{
                    type: 'column',
                    content:[{
                        type: 'component',
                        componentName: 'codeEditor',
                        title:'Code Editor',
                        componentState: { code: starterCode },
                        isClosable: false
                    },{
                        type: 'component',
                        componentName: 'console',
                        title:'Console',
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
        } );
    }

    // Set up saving code changes to the localStorage
    myLayout.on( 'stateChanged', function(){
        localStorage.setItem( 'savedState', JSON.stringify( myLayout.toConfig()));
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
            fetch("/node_modules/golden-layout/index.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///node_modules/golden-layout/index.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Three.js Typescript definitions...
            fetch("/node_modules/three/build/three.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///node_modules/three/build/three.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from ControlKit.js...
            fetch("/node_modules/controlkit/bin/controlkit.d.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'file:///node_modules/controlkit/bin/controlkit.d.ts');
                });
            }).catch(error => console.log(error.message));

            // Add Symbols from this file...
            fetch("/js/index.ts").then((response) => {
                response.text().then(function (text) {
                    monaco.editor.createModel(text, "javascript");
                });
            }).catch(error => console.log(error.message));

            monacoEditor = monaco.editor.create(container.getElement().get(0), {
                value: state.code,
                language: "javascript",
                theme: "vs-dark",
                automaticLayout: true//,
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
        }, 1);
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
            cascadeViewport = new CascadeEnvironment(container); 
        }, 1.3);
    });

    // Set up the Error and Status Reporting Console
    myLayout.registerComponent('console', function(container){
        consoleContainer = document.createElement("div");
        consoleContainer.style.color = "white";
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
        let realConsoleLog = console.log;
        console.log = function(message) {
            let newline = document.createElement("div");
            newline.innerHTML = "&gt;  " + JSON.stringify(message, getCircularReplacer());
            consoleContainer.appendChild(newline);
            consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;
            realConsoleLog.apply(console, arguments);
        };
        window.onerror = function(error, url, line) {
            let newline = document.createElement("div");
            newline.style.color = "red";
            newline.innerHTML = "Line : "+line + " " + JSON.stringify(error, getCircularReplacer());
            consoleContainer.appendChild(newline);
            consoleContainer.parentElement.scrollTop = consoleContainer.parentElement.scrollHeight;

            // Highlight the error'd code in the editor
            monaco.editor.setModelMarkers(monacoEditor.getModel(), 'test', [{
                startLineNumber: line,
                startColumn: 1,
                endLineNumber: line,
                endColumn: 1000,
                message: JSON.stringify(error, getCircularReplacer()),
                severity: monaco.MarkerSeverity.Error
            }]);
        };
    });

    // Doesn't get triggered in time to do any good
    window.onbeforeunload = function () {}
    window.onblur   = function (){ focused = false; }
    window.onfocus  = function (){ focused = true;  }
    document.onblur = window.onblur; document.onfocus = window.onfocus;

    myLayout.init();
}
