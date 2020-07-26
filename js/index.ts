var myLayout : GoldenLayout.GoldenLayout;
var gui: ControlKit.ControlKit;
var sceneShapes: oc.TopoDS_Shape[];
var GUIState: { [id: string]: any; };
var monacoEditor: any;

interface Environment {
    constructor(goldenContainer: any);

    time      : THREE.Clock;
    lastTimeRendered : Number;
    camera    : THREE.PerspectiveCamera; 
    scene     : THREE.Scene;
    renderer  : THREE.WebGLRenderer;
    controls  : THREE.OrbitControls;
    isVisible : Boolean;
    viewDirty : Boolean; 

    initEnvironment(): void;
    onWindowResize(): void;
}

interface CascadeEnvironment {
    constructor(goldenContainer: any);

    environment    : Environment;
    updating       : Boolean;
    matcapMaterial : THREE.MeshMatcapMaterial;
    mainObject     : THREE.Object3D;
    
    updateShape (shape : oc.TopoDS_Shape, maxDeviation:Number) : void;

    animate() : void;
}

var cascadeViewport: CascadeEnvironment;

function Box (x : Number, y : Number, z : Number, centered? : Boolean) : oc.TopoDS_Shape;
function Sphere(radius : Number) : oc.TopoDS_Shape;
function Cylinder(radius: Number, height: Number, centered?: Boolean) : oc.TopoDS_Shape;
function Cone(radius1: Number, radius2: Number, height: Number) : oc.TopoDS_Shape;

function Union(objectsToJoin: oc.TopoDS_Shape[], keepObjects?: Boolean) : oc.TopoDS_Shape;
function Difference(mainBody: oc.TopoDS_Shape, objectsToSubtract: oc.TopoDS_Shape[], keepObjects?: Boolean) : oc.TopoDS_Shape;
function Intersection(objectsToIntersect: oc.TopoDS_Shape[], keepObjects?: Boolean) : oc.TopoDS_Shape;

function Slider(name: String, defaultValue: Number, min: Number, max: Number, callback?: Function, realTime?:Boolean): Number;
function Button(name: String, callback?: Function);
function Checkbox(name: String, defaultValue: Boolean, callback?: Function): Boolean;

function Translate(offset: Number[], ...args: oc.TopoDS_Shape) : oc.TopoDS_Shape;
function Rotate(axis: Number[], degrees: Number, ...args: oc.TopoDS_Shape) : oc.TopoDS_Shape;
function Scale(scale: Number, ...args: oc.TopoDS_Shape) : oc.TopoDS_Shape;