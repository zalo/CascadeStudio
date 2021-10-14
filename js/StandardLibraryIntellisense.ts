/** The list that stores all of the OpenCascade shapes for rendering.  
 * Add to this when using imported files or doing custom oc. operations. 
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var sceneShapes: oc.TopoDS_Shape[];

/** The dictionary that stores all of your imported STEP and IGES files.  Push to sceneShapes to render in the view! 
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var externalShapes: { [filename: string]: oc.TopoDS_Shape };

/** Type definition for Int */
type integer = number;

/** Starts sketching a 2D shape which can contain lines, arcs, bezier splines, and fillets.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let sketch = new Sketch([0,0]).LineTo([100,0]).Fillet(20).LineTo([100,100]).End(true).Face();```*/
class Sketch {
    constructor(startingPoint: number[]);

    faces       : oc.TopoDS_Face[];
    wires       : oc.TopoDS_Wire[];
    firstPoint  : oc.gp_Pnt;
    lastPoint   : oc.gp_Pnt;
    wireBuilder : oc.BRepBuilderAPI_MakeWire;
    
    Start   (startingPoint       : number[]       ) : Sketch;
    End     (closed             ?: boolean       , reversed?:boolean) : Sketch;
    AddWire (wire                : oc. TopoDS_Wire) : Sketch;
    
    LineTo  (nextPoint           : number[]       ) : Sketch;
    ArcTo   (pointOnArc          : number[], arcEnd : number[]) : Sketch;
    BezierTo(bezierControlPoints : number[][]): Sketch;
    BSplineTo(bsplinePoints      : number[][]): Sketch; 
    /** Adds a 2D Fillet of specified radius at this vertex.  Only applies to Faces!
     * If a Wire is needed, use ForEachWire() to get the Wire from the resulting Face! */
    Fillet  (radius              : number         ) : Sketch;
    Face    (reversed           ?:boolean) : oc.TopoDS_Face;
    Wire    (reversed           ?:boolean) : oc.TopoDS_Wire;
    /** Punches a circular hole in the existing face (may need to use reversed) */
    Circle  (center             ?:number[], radius:number, reversed?:boolean) : Sketch;
}

/** Creates a solid box with dimensions x, y, and, z and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myBox = Box(10, 20, 30);```*/
function Box(x: number, y: number, z: number, centered?: boolean): oc.TopoDS_Shape;
/** Creates a solid sphere of specified radius and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let mySphere = Sphere(40);```*/
function Sphere(radius: number): oc.TopoDS_Shape;
/** Creates a solid cylinder of specified radius and height and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myCylinder = Cylinder(30, 50);```*/
function Cylinder(radius: number, height: number, centered?: boolean): oc.TopoDS_Shape;
/** Creates a solid cone of specified bottom radius, top radius, and height and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myCone = Cone(30, 50);```*/
function Cone(radius1: number, radius2: number, height: number): oc.TopoDS_Shape;
/** Creates a polygon from a list of 3-component lists (points) and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let triangle = Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]);```*/
function Polygon(points: number[][], wire?: boolean): oc.TopoDS_Shape;
/** Creates a circle from a radius and adds it to `sceneShapes` for rendering. 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let circle = Circle(50);```*/
function Circle(radius:number, wire?:boolean) : oc.TopoDS_Shape;
/** Creates a bspline from a list of 3-component lists (points). 
 * This can be converted into a face via the respective oc.BRepBuilderAPI functions.
 * Or used directly with BRepPrimAPI_MakeRevolution()
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let bspline = BSpline([[0,0,0], [40, 0, 50], [50, 0, 50]], true);```*/
function BSpline(points:number[][], closed?:boolean) : oc.TopoDS_Shape;
/** Creates set of glyph solids from a string and a font-file and adds it to sceneShapes.
 * Note that all the characters share a singular face. 
 * 
 * Defaults: size:36, height:0.15, fontName: 'Roboto'
 * 
 * Try 'Roboto' or 'Papyrus' for an alternative typeface.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let myText = Text3D("Hello!");```*/
function Text3D(text?: string = "Hi!", size?: number = "36", height?: number = 0.15, fontURL?: string = "Roboto") : oc.TopoDS_Shape;


/** Joins a list of shapes into a single solid.
 * The original shapes are removed unless `keepObjects` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let sharpSphere = Union([Sphere(38), Box(50, 50, 50, true)]);```*/
function Union(objectsToJoin: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?:number, keepEdges?: boolean): oc.TopoDS_Shape;
/** Subtracts a list of shapes from mainBody.
 * The original shapes are removed unless `keepObjects` is true.  Returns a Compound Shape unless onlyFirstSolid is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let floatingCorners = Difference(Box(50, 50, 50, true), [Sphere(38)]);```*/
function Difference(mainBody: oc.TopoDS_Shape, objectsToSubtract: oc.TopoDS_Shape[], keepObjects?: boolean | boolean[], fuzzValue?:number, keepEdges?: boolean): oc.TopoDS_Shape;
/** Takes only the intersection of a list of shapes.
 * The original shapes are removed unless `keepObjects` is true. 
 * `keepObjects` can also be a list [keepMainBody: boolean, keepObjectsToSubtract: boolean]
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let roundedBox = Intersection([Box(50, 50, 50, true), Sphere(38)]);```*/
function Intersection(objectsToIntersect: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?: number, keepEdges?: boolean): oc.TopoDS_Shape;
/** Removes internal, unused edges from the insides of faces on this shape.  Keeps the model clean.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let cleanPart = RemoveInternalEdges(part);```*/
function RemoveInternalEdges(shape: oc.TopoDS_Shape, keepShape?: boolean) : oc.TopoDS_Shape;
/** Extrudes a shape along direction, a 3-component vector. Edges form faces, Wires form shells, Faces form solids, etc.
 * The original face is removed unless `keepFace` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let tallTriangle = Extrude(Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]), [0, 0, 50]);```*/
function Extrude(face: oc.TopoDS_Shape, direction: number[], keepFace?: boolean) : oc.TopoDS_Shape;
/** Extrudes and twists a flat *wire* upwards along the z-axis (see the optional argument for Polygon).
 * The original wire is removed unless `keepWire` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let twistyTriangle = RotatedExtrude(Polygon([[-25, -15, 0], [25, -15, 0], [0, 35, 0]], true), 50, 90);```*/
function RotatedExtrude(wire: oc.TopoDS_Shape, height: number, rotation: number, keepWire?: boolean) : oc.TopoDS_Shape;
/** Lofts a solid through the sections defined by an array of 2 or more closed wires.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js) */
function Loft(wireSections: oc.TopoDS_Shape[], keepWires?: boolean): oc.TopoDS_Shape;
/** Revolves this shape "degrees" about "axis" (a 3-component array).  Edges form faces, Wires form shells, Faces form solids, etc.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js) 
 * @example```let cone = Revolve(Polygon([[0, 0, 0], [0, 0, 50], [50, 0, 0]]));```*/
function Revolve(shape: oc.TopoDS_Shape, degrees?: number, axis?: number[], keepShape?: boolean, copy?: boolean): oc.TopoDS_Shape;
/** Sweeps this shape along a path wire.
 * The original shapes are removed unless `keepObjects` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js) 
 * @example```let pipe = Pipe(Circle(20), BSpline([[0,0,0],[0,0,50],[20,0,100]], false, true));```*/
function Pipe(shape: oc.TopoDS_Shape, wirePath: oc.TopoDS_Shape, keepInputs?: boolean): oc.TopoDS_Shape;
/** Offsets the faces of a shape by offsetDistance
 * The original shape is removed unless `keepShape` is true.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let roundedCube = Offset(Box(10,10,10), 10);```*/
function Offset(shape: oc.TopoDS_Shape, offsetDistance: number, tolerance?: number, keepShape?: boolean) : oc.TopoDS_Shape;

/** Creates a labeled slider with specified defaults, mins, and max ranges.
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40);```
 * `name` needs to be unique!
 * 
 * `callback` triggers whenever the mouse is let go, and `realTime` will cause the slider to update every frame that there is movement (but it's buggy!)
 * 
 * @param step controls the amount that the keyboard arrow keys will increment or decrement a value. Defaults to 1/100 (0.01).
 * @param precision controls how many decimal places the slider can have (i.e. "0" is integers, "1" includes tenths, etc.). Defaults to 2 decimal places (0.00).
 * 
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40, false);```
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40, false, 0.01);```
 * @example```let currentSliderValue = Slider("Radius", 30 , 20 , 40, false, 0.01, 2);```
 */
function Slider(name: string, defaultValue: number, min: number, max: number, realTime?: boolean, step?: number, precision?: integer): number;
/** @deprecated Callbacks can no longer be triggered from the CAD Worker Thread.
 * Creates a button ~~that will trigger `callback` when clicked.~~
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```Button("Yell", ()=>{ console.log("Help!  I've been clicked!"); });```*/
function Button(name: string) : void;
/** Creates a checkbox that returns true or false.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let currentCheckboxValue = Checkbox("Check?", true);```
 * 
 * `callback` triggers when the button is clicked.*/
function Checkbox(name: string, defaultValue: boolean): boolean;

/** Creates a text box input element that returns a string
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let text = TextInput("Banner", "Hello!", false);```
 */
function TextInput(name: string, defaultValue: string, realTime?: boolean): string;

/** Creates a dropdown list element that returns the value of the selected item
 *
 * @param options Object with a list of key and value pairs to display in dropdown
 * @example```let position = Dropdown("Position", 0, { top: 0, center: 5, bottom: 10 }, false);```
 * @example```let iconSelection = Dropdown("Icon", "heart", { Heart: "heart", Key: "key", Cog: "cog" }, false);```
 */
function Dropdown(name: string, defaultValue: string, options: { [key: string]: string }, realTime?: boolean): string;
function Dropdown(name: string, defaultValue: number, options: { [key: string]: number }, realTime?: boolean): number;

/** BETA: Transform a shape using an in-view transformation gizmo.
 * 
 * Shortcuts: `T` - Translate, `R` - Rotate, `S` - Scale, `W`/`L` - Toggle World/Local Space
 * 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let transformedSphere = Transform(Sphere(50));```*/
function Transform(shape: oc.TopoDS_Shape): oc.TopoDS_Shape;
/** BETA: Transform a shape using an in-view transformation gizmo.
 * 
 * Shortcuts: `T` - Translate, `R` - Rotate, `S` - Scale, `W`/`L` - Toggle World/Local
 * 
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let transformedSphere = Transform(Sphere(50));```*/
function Transform(translation: number[], rotation: (number|number[])[], scale: number, shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Translate a shape along the x, y, and z axes (using an array of 3 numbers).
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let upwardSphere = Translate([0, 0, 50], Sphere(50));```*/
function Translate(offset: number[], shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Rotate a shape degrees about a 3-coordinate axis.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let leaningCylinder = Rotate([0, 1, 0], 45, Cylinder(25, 50));```*/
function Rotate(axis: number[], degrees: number, shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Mirror this shape about 3-coordinate normal vector
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let mirrored = Mirror([0, 0, 1] , Text3D("Hello!"));```*/
function Mirror(vector: number[], shape: oc.TopoDS_Shape, keepShape?: boolean): oc.TopoDS_Shape;

/** Scale a shape to be `scale` times its current size.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let scaledCylinder = Scale(50, Cylinder(0.5, 1));```*/
function Scale(scale: number, shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Iterate over all the solids in this shape, calling `callback` on each one. */
function ForEachSolid(shape: oc.TopoDS_Shape, callback: (index: Number, shell: oc.TopoDS_Solid) => void): void;
/** Gets the indexth solid from this compound shape. */
function GetSolidFromCompound(shape: oc.TopoDS_Shape, index?:number, keepOriginal?:boolean): oc.TopoDS_Solid;
/** Gets the indexth wire from this face (or above) shape. */
function GetWire(shape: oc.TopoDS_Face, index?:number, keepOriginal?:boolean): oc.TopoDS_Wire;
/** Iterate over all the shells in this shape, calling `callback` on each one. */
function ForEachShell(shape: oc.TopoDS_Shape, callback: (index: Number, shell: oc.TopoDS_Shell) => void): void;
/** Iterate over all the faces in this shape, calling `callback` on each one. */
function ForEachFace(shape: oc.TopoDS_Shape, callback: (index: number, face: oc.TopoDS_Face) => void): void;
/** Iterate over all the wires in this shape, calling `callback` on each one. */
function ForEachWire(shape: oc.TopoDS_Shape, callback: (wire: oc.TopoDS_Wire) => void): void;
/** Iterate over all the UNIQUE indices and edges in this shape, calling `callback` on each one. */
function ForEachEdge(shape: oc.TopoDS_Shape, callback: (index: number, edge: oc.TopoDS_Edge) => void): {[edgeHash:number] : Number}[];
/** Iterate over all the vertices in this shape, calling `callback` on each one. */
function ForEachVertex(shape: oc.TopoDS_Shape, callback: (vertex: oc.TopoDS_Vertex) => void): void;
/** Attempt to Fillet all selected edge indices in "edgeList" with a radius. 
 * Hover over the edges you'd like to select and use those indices as in the example.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```FilletEdges(shape, 1, [0,1,2,7]);``` */
function FilletEdges(shape: oc.TopoDS_Shape, radius: number, edgeList: number[], keepOriginal?:boolean): oc.TopoDS_Shape;
/** Attempt to Chamfer all selected edge indices in "edgeList" symmetrically by distance. 
 * Hover over the edges you'd like to select and use those indices in the edgeList array.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```ChamferEdges(shape, 1, [0,1,2,7]);``` */
function ChamferEdges(shape: oc.TopoDS_Shape, distance: number, edgeList: number[], keepOriginal?:boolean): oc.TopoDS_Shape;

/** Download this file URL through the browser.  Use this to export information from the CAD engine.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```SaveFile("myInfo.txt", URL.createObjectURL( new Blob(["Hello, Harddrive!"], { type: 'text/plain' }) ));``` */
function SaveFile(filename: string, fileURL: string): void;

/** Explicitly Cache the result of this operation so that it can return instantly next time it is called with the same arguments.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let box = CacheOp(arguments, () => { return new oc.BRepPrimAPI_MakeBox(x, y, z).Shape(); });``` */
function CacheOp(arguments: IArguments, cacheMiss: () => oc.TopoDS_Shape): oc.TopoDS_Shape;
 /** Remove this object from this array.  Useful for preventing objects being added to `sceneShapes` (in cached functions).
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let box = CacheOp(arguments, () => { let box = Box(x,y,z); sceneShapes = Remove(sceneShapes, box); return box; });``` */
function Remove(array: any[], toRemove: any): any[];
