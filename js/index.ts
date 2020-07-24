var myLayout : GoldenLayout.GoldenLayout;
var gui: ControlKit.ControlKit;

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

var cascadeViewport : CascadeEnvironment;
