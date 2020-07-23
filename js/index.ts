var myLayout : GoldenLayout.GoldenLayout;
var gui: ControlKit.ControlKit;
var mainPart: oc.TopoDS_Shape;

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

    animate() : void;
}

var cascadeViewport : CascadeEnvironment;
