var myLayout : GoldenLayout.GoldenLayout;
var gui      : ControlKit.ControlKit;

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

    environment : Environment;
    updating    : Boolean;
    //boxGeometry : THREE.BoxBufferGeometry;
    white       : THREE.MeshLambertMaterial;
    part        : THREE.Group;

    animate() : void;
}

var cascadeViewport : CascadeEnvironment;
