/** The list that stores all of the OpenCascade shapes for rendering.  
 * Add to this when using imported files or doing custom operations. 
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var sceneShapes: oc.TopoDS_Shape[];

/** The dictionary that stores all of your imported STEP and IGES files.  Push to sceneShapes to render in the view! 
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var externalShapes: { [filename: string]: oc.TopoDS_Shape };

/** The base generic 3D Rendering Viewport implementation. */
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

/** The Cascade Studio specific 3D Rendering Viewport; mainOnbject contains all the faces and edges. */
interface CascadeEnvironment {
    constructor(goldenContainer: any);

    environment    : Environment;
    updating       : Boolean;
    matcapMaterial : THREE.MeshMatcapMaterial;
    mainObject     : THREE.Group;
    
    updateShape (shape : oc.TopoDS_Shape, maxDeviation:Number) : void;

    animate() : void;
}

/** The 3D Rendering Viewport; mainOnbject contains all the faces and edges. */
var threejsViewport: CascadeEnvironment;


/** Creates a solid box with dimensions x, y, and, z and adds it to `sceneShapes` for rendering. 
 * @example```let myBox = Box(10, 20, 30);```*/
function Box(x: Number, y: Number, z: Number, centered?: Boolean): oc.TopoDS_Shape;
/** Creates a solid sphere of specified radius and adds it to `sceneShapes` for rendering. 
 * @example```let mySphere = Sphere(40);```*/
function Sphere(radius: Number): oc.TopoDS_Shape;
/** Creates a solid cylinder of specified radius and height and adds it to `sceneShapes` for rendering. 
 * @example```let myCylinder = Cylinder(30, 50);```*/
function Cylinder(radius: Number, height: Number, centered?: Boolean): oc.TopoDS_Shape;
/** Creates a solid cone of specified bottom radius, top radius, and height and adds it to `sceneShapes` for rendering. 
 * @example```let myCone = Cone(30, 50);```*/
function Cone(radius1: Number, radius2: Number, height: Number): oc.TopoDS_Shape;
/** Creates a polygon from a list of 3-component lists (points) and adds it to `sceneShapes` for rendering. 
 * @example```let triangle = Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]);```*/
function Polygon(points:Number[][]) : oc.TopoDS_Shape;

/** Joins a list of shapes into a single solid.
 * The original shapes are removed unless `keepObjects` is true.
 * @example```let sharpSphere = Union([Sphere(38), Box(50, 50, 50, true)]);```*/
function Union(objectsToJoin: oc.TopoDS_Shape[], keepObjects?: Boolean): oc.TopoDS_Shape;
/** Subtracts a list of shapes from mainBody.
 * The original shapes are removed unless `keepObjects` is true.
 * @example```let floatingCorners = Difference(Box(50, 50, 50, true), [Sphere(38)]);```*/
function Difference(mainBody: oc.TopoDS_Shape, objectsToSubtract: oc.TopoDS_Shape[], keepObjects?: Boolean): oc.TopoDS_Shape;
/** Takes only the intersection of a list of shapes.
 * The original shapes are removed unless `keepObjects` is true.
 * @example```let roundedBox = Intersection([Box(50, 50, 50, true), Sphere(38)]);```*/
function Intersection(objectsToIntersect: oc.TopoDS_Shape[], keepObjects?: Boolean) : oc.TopoDS_Shape;
/** Extrudes a flat face along direction, a 3-component vector.
 * The original face is removed unless `keepFace` is true.
 * @example```let tallTriangle = Extrude(Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]), [0, 0, 50]);```*/
function Extrude(face: oc.TopoDS_Shape, direction: Number[], keepFace?: Boolean);

/** Creates a labeled slider with specified defaults, mins, and max ranges.
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40);```
 * `name` needs to be unique!
 * 
 * `callback` triggers whenever the mouse is let go, and `realTime` will cause the slider to update every frame that there is movement (but it's buggy!)
*/
function Slider(name: String, defaultValue: Number, min: Number, max: Number, realTime?:Boolean, callback?: CallableFunction): Number;
/** Creates a button that will trigger `callback` when clicked.
 * @example```Button("Yell", ()=>{ console.log("Help!  I've been clicked!"); });```
*/
function Button(name: String, callback?: CallableFunction) : void;
/** Creates a checkbox that returns true or false.
 * @example```let currentCheckboxValue = Checkbox("Check?", true);```
 * 
 * `callback` triggers when the button is clicked.
*/
function Checkbox(name: String, defaultValue: Boolean, callback?: CallableFunction): Boolean;

/** Translate a shape along the x, y, and z axes (using an array of 3 numbers).
 * @example```let upwardSphere = Translate([0, 0, 50], Sphere(50));```
*/
function Translate(offset: Number[], shape: oc.TopoDS_Shape): oc.TopoDS_Shape;
/** Translate a list of shapes along the x, y, and z axes (using an array of 3 numbers).
 * @example```let upwardBoxSphere = Translate([0, 0, 50], [Sphere(38), Box(50, 50, 50)]);```
*/
function Translate(offset: Number[], shapes: oc.TopoDS_Shape[]): oc.TopoDS_Shape[];

/** Rotate a shape degrees about a 3-coordinate axis.
 * @example```let leaningCylinder = Rotate([0, 1, 0], 45, Cylinder(25, 50));```
*/
function Rotate(axis: Number[], degrees: Number, shape: oc.TopoDS_Shape): oc.TopoDS_Shape;
/** Rotate a list of shapes degrees about a 3-coordinate axis.
 * @example```let leaningCylinder = Rotate([0, 1, 0], 45, [Cylinder(25, 50), Cylinder(15, 70)]);```
*/
function Rotate(axis: Number[], degrees: Number, shapes: oc.TopoDS_Shape[]): oc.TopoDS_Shape[];

/** Scale a shape to be `scale` times its current size.
 * @example```let scaledCylinder = Scale(50, Cylinder(0.5, 1));```
*/
function Scale(scale: Number, shape: oc.TopoDS_Shape): oc.TopoDS_Shape;
/** Scale a list of shapes to be `scale` times their current size.
 * @example```let scaledCylinder = Scale(50, [Cylinder(0.5, 1), Cylinder(0.25, 2)]);```
*/
function Scale(scale: Number, shapes: oc.TopoDS_Shape[]): oc.TopoDS_Shape[];

/** Iterate over all the faces in this shape, calling `callback` on each one. */
function ForEachFace(shape: oc.TopoDS_Shape, callback: (index: Number, face: oc.TopoDS_Shape) => void): void;
/** Iterate over all the wires in this shape, calling `callback` on each one. */
function ForEachWire(shape: oc.TopoDS_Shape, callback: (wire: oc.TopoDS_Shape) => void): void;
/** Iterate over all the UNIQUE indices and edges in this shape, calling `callback` on each one. */
function ForEachEdge(shape: oc.TopoDS_Shape, callback: (index: Number, edge: oc.TopoDS_Shape) => void): {[edgeHash:number] : Number}[];
/** Iterate over all the vertices in this shape, calling `callback` on each one. */
function ForEachVertex(shape: oc.TopoDS_Shape, callback: (vertex: oc.TopoDS_Shape) => void): void;
/** Attempt to Fillet all selected edges on this shape with a radius. 
 * Hover over the edges you'd like to select and use those indices as shown below:
 * ```FilletEdges(shape, 1, (index) => {return [0,1,2,7].includes(index);});``` */
function FilletEdges(shape: oc.TopoDS_Shape, radius : Number, edgeSelector?: (index:Number, edge:oc.TopoDS_Shape) => void): oc.TopoDS_Shape;