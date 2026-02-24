/** The list that stores all of the OpenCascade shapes for rendering.
 * Add to this when using imported files or doing custom oc. operations.
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var sceneShapes: oc.TopoDS_Shape[];

/** The dictionary that stores all of your imported STEP and IGES files.  Push to sceneShapes to render in the view!
 * @example```sceneShapes.push(externalShapes['myStep.step']);``` */
var externalShapes: { [filename: string]: oc.TopoDS_Shape };

/** Type definition for Int */
type integer = number;

// ============================================================
// Sketch API
// ============================================================

/** Starts sketching a 2D shape which can contain lines, arcs, bezier splines, and fillets.
 * @param startingPoint - Starting point as [x, y] in the chosen plane
 * @param plane - Drawing plane: 'XY' (default), 'XZ', or 'YZ'. For revolve profiles use 'XZ'.
 * [Source](https://github.com/zalo/CascadeStudio/blob/master/js/CADWorker/CascadeStudioStandardLibrary.js)
 * @example```let sketch = new Sketch([0,0]).LineTo([100,0]).Fillet(20).LineTo([100,100]).End(true).Face();```
 * @example```let profile = new Sketch([0,0], "XZ").LineTo([15,0]).LineTo([15,10]).LineTo([0,10]).End(true).Face(); Revolve(profile, 360);```*/
class Sketch {
    constructor(startingPoint: number[], plane?: 'XY' | 'XZ' | 'YZ');

    faces       : oc.TopoDS_Face[];
    wires       : oc.TopoDS_Wire[];
    firstPoint  : oc.gp_Pnt;
    lastPoint   : oc.gp_Pnt;
    wireBuilder : oc.BRepBuilderAPI_MakeWire;

    Start   (startingPoint       : number[]       ) : Sketch;
    End     (closed             ?: boolean       , reversed?:boolean) : Sketch;
    AddWire (wire                : oc.TopoDS_Wire ) : Sketch;

    LineTo  (nextPoint           : number[]       ) : Sketch;
    ArcTo   (pointOnArc          : number[], arcEnd : number[]) : Sketch;
    BezierTo(bezierControlPoints : number[][]): Sketch;
    BSplineTo(bsplinePoints      : number[][]): Sketch;
    /** Fillets the corner at the most recent vertex. Must be called AFTER `.LineTo()` or `.ArcTo()`.
     * Only applies to Faces! If a Wire is needed, use `.Wire()` or `GetWire()` on the resulting Face.
     * @example```new Sketch([0,0]).LineTo([10,0]).Fillet(2).LineTo([10,10]).End(true).Face();``` */
    Fillet  (radius              : number         ) : Sketch;
    Face    (reversed           ?:boolean) : oc.TopoDS_Face;
    Wire    (reversed           ?:boolean) : oc.TopoDS_Wire;
    /** Punches a circular hole in the existing face (may need to use reversed) */
    Circle  (center             ?:number[], radius?:number, reversed?:boolean) : Sketch;
}

// ============================================================
// Primitives
// ============================================================

/** Creates a solid box with dimensions x, y, and z and adds it to `sceneShapes` for rendering.
 * @example```let myBox = Box(10, 20, 30);```
 * @example```let centeredBox = Box(10, 20, 30, true);```*/
function Box(x: number, y: number, z: number, centered?: boolean): oc.TopoDS_Shape;

/** Creates a solid sphere of specified radius and adds it to `sceneShapes` for rendering.
 * @example```let mySphere = Sphere(40);```*/
function Sphere(radius: number): oc.TopoDS_Shape;

/** Creates a solid cylinder of specified radius and height and adds it to `sceneShapes` for rendering.
 * @example```let myCylinder = Cylinder(30, 50);```
 * @example```let centeredCyl = Cylinder(30, 50, true);```*/
function Cylinder(radius: number, height: number, centered?: boolean): oc.TopoDS_Shape;

/** Creates a solid cone with bottom radius, top radius, and height.
 * @example```let myCone = Cone(30, 10, 50);```*/
function Cone(radius1: number, radius2: number, height: number): oc.TopoDS_Shape;

/** Creates a polygon from a list of 3-component point arrays.
 * Returns a face by default; pass `wire=true` to get a wire instead (useful for Revolve, Pipe).
 * @example```let triangle = Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]]);```
 * @example```let wireTriangle = Polygon([[0, 0, 0], [50, 0, 0], [25, 50, 0]], true);```*/
function Polygon(points: number[][], wire?: boolean): oc.TopoDS_Shape;

/** Creates a circle of the given radius.
 * - `wire=false` (default): returns a **face** — use for Extrude, Revolve.
 * - `wire=true`: returns a **wire** — use for Loft, Pipe, RotatedExtrude.
 * @example```let disk = Circle(50);```
 * @example```let ring = Circle(50, true);```*/
function Circle(radius: number, wire?: boolean) : oc.TopoDS_Shape;

/** Creates a BSpline curve through a list of 3-component points.
 * - `closed=false` (default): open curve — use for Pipe paths.
 * - `closed=true`: closed loop — use for rings/profiles.
 * @example```let curve = BSpline([[0,0,0], [40,0,50], [50,0,50]]);```
 * @example```let loop = BSpline([[0,0,0], [40,0,50], [50,0,50]], true);```*/
function BSpline(points: number[][], closed?: boolean) : oc.TopoDS_Shape;

/** Creates extruded 3D text glyphs from a string and font name.
 * All characters share a single shape. Default font is 'Roboto'.
 * @param text The text to render (default: "Hi!")
 * @param size Font size in mm (default: 36)
 * @param height Extrusion depth in mm (default: 0.15)
 * @param fontName Font name — try 'Roboto', 'Consolas', or 'Papyrus' (default: 'Roboto')
 * @example```let myText = Text3D("Hello!", 12, 2);```
 * @example```let label = Text3D("CS", 10, 0.5, "Consolas");```*/
function Text3D(text?: string, size?: number, height?: number, fontName?: string) : oc.TopoDS_Shape;

/** Creates a wedge (tapered box) with base dimensions dx, dy, dz and top length ltx.
 * @example```let wedge = Wedge(30, 20, 30, 10);```*/
function Wedge(dx: number, dy: number, dz: number, ltx: number): oc.TopoDS_Shape;

// ============================================================
// Boolean Operations
// ============================================================

/** Joins a list of shapes into a single solid via boolean fusion.
 * Shapes should overlap or touch — non-overlapping shapes may produce unexpected results.
 * Includes a volume sanity check that warns if the result is near-zero.
 * The original shapes are removed unless `keepObjects` is true.
 * @example```let merged = Union([Sphere(38), Box(50, 50, 50, true)]);```*/
function Union(objectsToJoin: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?: number, keepEdges?: boolean): oc.TopoDS_Shape;

/** Subtracts a list of tool shapes from mainBody via boolean cut.
 * Includes a volume sanity check that warns if the main body is destroyed.
 * The original shapes are removed unless `keepObjects` is true.
 * `keepObjects` can be a boolean or `[keepMainBody, keepTools]` array.
 * @example```let hollowBox = Difference(Box(50,50,50,true), [Sphere(38)]);```*/
function Difference(mainBody: oc.TopoDS_Shape, objectsToSubtract: oc.TopoDS_Shape[], keepObjects?: boolean | boolean[], fuzzValue?: number, keepEdges?: boolean): oc.TopoDS_Shape;

/** Takes only the intersection (shared volume) of a list of shapes.
 * Includes a volume sanity check that warns if the result is near-zero.
 * The original shapes are removed unless `keepObjects` is true.
 * @example```let roundedBox = Intersection([Box(50,50,50,true), Sphere(38)]);```*/
function Intersection(objectsToIntersect: oc.TopoDS_Shape[], keepObjects?: boolean, fuzzValue?: number, keepEdges?: boolean): oc.TopoDS_Shape;

/** Removes internal, unused edges from the insides of faces on this shape. Keeps the model clean.
 * @example```let cleanPart = RemoveInternalEdges(part);```*/
function RemoveInternalEdges(shape: oc.TopoDS_Shape, keepShape?: boolean) : oc.TopoDS_Shape;

// ============================================================
// Extrusion & Shape Generation
// ============================================================

/** Extrudes a shape along a direction vector. Faces become solids, wires become shells, edges become faces.
 * The original face is consumed unless `keepFace` is true.
 * Use `keepFace=true` when you need to reuse the face (e.g., with `Offset()` to create inner cavities).
 * @example```let box = Extrude(Polygon([[0,0,0],[50,0,0],[25,50,0]]), [0,0,50]);```
 * @example```let tray = Extrude(outerFace, [0,0,30], true);  // keepFace for Offset```*/
function Extrude(face: oc.TopoDS_Shape, direction: number[], keepFace?: boolean) : oc.TopoDS_Shape;

/** Extrudes and twists a flat wire upwards along the z-axis.
 * The original wire is removed unless `keepWire` is true.
 * @example```let twisted = RotatedExtrude(Polygon([[-25,-15,0],[25,-15,0],[0,35,0]], true), 50, 90);```*/
function RotatedExtrude(wire: oc.TopoDS_Shape, height: number, rotation: number, keepWire?: boolean) : oc.TopoDS_Shape;

/** Lofts a solid through 2 or more closed wire profiles.
 * Non-wire shapes are automatically converted to wires (with a warning).
 * For best results, pass explicit wires via `GetWire()`.
 * @example```Loft([Circle(20, true), Translate([0,0,50], Circle(10, true))]);```*/
function Loft(wireSections: oc.TopoDS_Shape[], keepWires?: boolean): oc.TopoDS_Shape;

/** Revolves a shape around an axis. Faces become solids, wires become shells.
 * @param degrees Angle of revolution (default: 360)
 * @param direction Axis of revolution as [x,y,z] (default: [0,0,1])
 * @example```let donut = Revolve(Translate([20,0,0], Circle(5)), 360, [0,1,0]);```
 * @example```let cup = Revolve(cupProfile, 360, [0,0,1]);```*/
function Revolve(shape: oc.TopoDS_Shape, degrees?: number, direction?: number[], keepShape?: boolean, copy?: boolean): oc.TopoDS_Shape;

/** Sweeps a profile shape along a wire path.
 * The original shapes are removed unless `keepInputs` is true.
 * @example```let pipe = Pipe(Circle(20), BSpline([[0,0,0],[0,0,50],[20,0,100]]));```*/
function Pipe(shape: oc.TopoDS_Shape, wirePath: oc.TopoDS_Shape, keepInputs?: boolean): oc.TopoDS_Shape;

/** Offsets a shape by offsetDistance. Behavior depends on the input shape type:
 * - **Face**: 2D boundary offset — shrinks (negative) or grows (positive) the face outline, returns a new face. Useful with `Extrude(..., true)` + `Offset()` to create inner cavities.
 * - **Solid/Shell**: 3D shell offset — offsets all faces of the solid outward/inward.
 * - **Wire**: 2D planar wire offset.
 *
 * The original shape is removed unless `keepShape` is true.
 * @example```let innerFace = Offset(outerFace, -wallThickness);```
 * @example```let roundedCube = Offset(Box(10,10,10), 10);```*/
function Offset(shape: oc.TopoDS_Shape, offsetDistance: number, tolerance?: number, keepShape?: boolean) : oc.TopoDS_Shape;

/** Creates a cross-section of a shape at the given plane.
 * Returns the intersection wire/edges.
 * @example```let crossSection = Section(Box(20,20,20), [0,0,10], [0,0,1]);```*/
function Section(shape: oc.TopoDS_Shape, planeOrigin?: number[], planeNormal?: number[]): oc.TopoDS_Shape;

// ============================================================
// Transform Operations
// ============================================================

/** Translate a shape along the x, y, and z axes. Returns the translated shape.
 * The original is consumed from `sceneShapes` unless `keepOriginal` is true.
 * **Important**: Capture the return value if you need to use the translated shape later.
 * @example```let moved = Translate([0, 0, 50], Sphere(50));```
 * @example```Translate([10, 0, 0], myShape, true);  // keep original```*/
function Translate(offset: number[], shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Rotate a shape by degrees about a 3-component axis. Returns the rotated shape.
 * The original is consumed unless `keepOriginal` is true.
 * @example```let leaning = Rotate([0, 1, 0], 45, Cylinder(25, 50));```*/
function Rotate(axis: number[], degrees: number, shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Mirror a shape across a plane defined by a normal vector. Returns the mirrored shape.
 * The original is consumed unless `keepShape` is true.
 * @example```let mirrored = Mirror([0, 0, 1], Text3D("Hello!"));```*/
function Mirror(vector: number[], shape: oc.TopoDS_Shape, keepShape?: boolean): oc.TopoDS_Shape;

/** Uniformly scale a shape by a single factor. Returns the scaled shape.
 * **Only accepts a number** — non-uniform `[x,y,z]` scaling is not supported.
 * The original is consumed unless `keepOriginal` is true.
 * @example```let big = Scale(2, Sphere(10));```*/
function Scale(scale: number, shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

/** Transform a shape using translation, rotation, and scale.
 * @example```let t = Transform([10,0,0], [[0,1,0], 45], 1.5, myShape);```*/
function Transform(translation: number[], rotation: (number|number[])[], scale: number, shape: oc.TopoDS_Shape, keepOriginal?: boolean): oc.TopoDS_Shape;

// ============================================================
// Edge & Face Operations
// ============================================================

/** Fillet (round) selected edges of a shape by radius.
 * Use `Edges(shape).max/min/ofType/parallel().indices()` to select edges.
 * @example```let rounded = FilletEdges(box, 2, Edges(box).max([0,0,1]).indices());```*/
function FilletEdges(shape: oc.TopoDS_Shape, radius: number, edgeList: number[], keepOriginal?: boolean): oc.TopoDS_Shape;

/** Chamfer (bevel) selected edges of a shape by distance.
 * Use `Edges(shape).max/min/ofType/parallel().indices()` to select edges.
 * @example```let beveled = ChamferEdges(box, 1, Edges(box).max([0,0,1]).indices());```*/
function ChamferEdges(shape: oc.TopoDS_Shape, distance: number, edgeList: number[], keepOriginal?: boolean): oc.TopoDS_Shape;

// ============================================================
// Iteration & Extraction
// ============================================================

/** Iterate over all the solids in a compound shape, calling `callback(index, solid)` on each. */
function ForEachSolid(shape: oc.TopoDS_Shape, callback: (index: number, solid: oc.TopoDS_Solid) => void): void;

/** Returns the number of solids in a compound shape. */
function GetNumSolidsInCompound(shape: oc.TopoDS_Shape): number;

/** Extracts the solid at the given index from a compound shape.
 * @example```let firstSolid = GetSolidFromCompound(compound, 0);```*/
function GetSolidFromCompound(shape: oc.TopoDS_Shape, index?: number, keepOriginal?: boolean): oc.TopoDS_Solid;

/** Extracts the wire at the given index from a face or higher-dimensional shape.
 * Useful for extracting wires after transforms for use with Loft/Pipe.
 * @example```let wire = GetWire(myFace, 0);```*/
function GetWire(shape: oc.TopoDS_Shape, index?: number, keepOriginal?: boolean): oc.TopoDS_Wire;

/** Iterate over all the shells in this shape, calling `callback(index, shell)` on each. */
function ForEachShell(shape: oc.TopoDS_Shape, callback: (index: number, shell: oc.TopoDS_Shell) => void): void;

/** Iterate over all the faces in this shape, calling `callback(index, face)` on each. */
function ForEachFace(shape: oc.TopoDS_Shape, callback: (index: number, face: oc.TopoDS_Face) => void): void;

/** Iterate over all the wires in this shape, calling `callback(wire)` on each. */
function ForEachWire(shape: oc.TopoDS_Shape, callback: (wire: oc.TopoDS_Wire) => void): void;

/** Iterate over all unique edges in this shape, calling `callback(index, edge)` on each. */
function ForEachEdge(shape: oc.TopoDS_Shape, callback: (index: number, edge: oc.TopoDS_Edge) => void): void;

/** Iterate over all the vertices in this shape, calling `callback(vertex)` on each. */
function ForEachVertex(shape: oc.TopoDS_Shape, callback: (vertex: oc.TopoDS_Vertex) => void): void;

// ============================================================
// Selector API
// ============================================================

/** Selector for filtering and querying edges of a shape by geometric properties.
 * Use `Edges(shape)` to create an EdgeSelector, then chain filtering methods,
 * and call `.indices()` to get edge indices for FilletEdges/ChamferEdges.
 * @example```FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());``` */
class EdgeSelector {
    /** Filter to edges of a specific curve type: "Line", "Circle", "Ellipse", "Hyperbola", "Parabola", "BezierCurve", "BSplineCurve" */
    ofType(type: string): EdgeSelector;
    /** Filter to edges whose direction is parallel to the given axis vector */
    parallel(axis: number[], tolerance?: number): EdgeSelector;
    /** Filter to edges whose direction is perpendicular to the given axis vector */
    perpendicular(axis: number[], tolerance?: number): EdgeSelector;
    /** Filter to edges at a specific angle (in degrees) to the given axis */
    atAngle(axis: number[], degrees: number, tolerance?: number): EdgeSelector;

    /** Sort edges by their midpoint projection onto the given axis */
    sortBy(axis: number[]): EdgeSelector;
    /** Group edges by position along axis, returns groups array */
    groupBy(axis: number[], tolerance?: number): { pos: number, entries: any[] }[];
    /** Select edges in the highest group along axis */
    max(axis: number[]): EdgeSelector;
    /** Select edges in the lowest group along axis */
    min(axis: number[]): EdgeSelector;

    /** Filter to edges longer than the specified length */
    longerThan(length: number): EdgeSelector;
    /** Filter to edges shorter than the specified length */
    shorterThan(length: number): EdgeSelector;
    /** Filter to edges whose midpoint lies within the bounding box */
    withinBox(min: number[], max: number[]): EdgeSelector;

    /** Return the edge indices as a number array for FilletEdges/ChamferEdges */
    indices(): number[];
    /** Return the raw TopoDS_Edge objects */
    edges(): oc.TopoDS_Edge[];
    /** Return the number of matched edges */
    count(): number;
    /** Select the first n edges */
    first(n?: number): EdgeSelector;
    /** Select the last n edges */
    last(n?: number): EdgeSelector;
    /** Return the index of the edge at position i in the filtered set */
    at(index: number): number;
}

/** Selector for filtering and querying faces of a shape by geometric properties.
 * Use `Faces(shape)` to create a FaceSelector, then chain filtering methods.
 * @example```let topFace = Faces(box).max([0,0,1]).faces()[0];``` */
class FaceSelector {
    /** Filter to faces of a specific surface type: "Plane", "Cylinder", "Cone", "Sphere", "Torus", "BSplineSurface", "BezierSurface" */
    ofType(type: string): FaceSelector;
    /** Filter to faces whose normal is parallel to the given axis */
    parallel(axis: number[], tolerance?: number): FaceSelector;
    /** Filter to faces whose normal is perpendicular to the given axis */
    perpendicular(axis: number[], tolerance?: number): FaceSelector;

    /** Sort faces by centroid projection onto the given axis */
    sortBy(axis: number[]): FaceSelector;
    /** Select face(s) with the highest centroid along axis */
    max(axis: number[]): FaceSelector;
    /** Select face(s) with the lowest centroid along axis */
    min(axis: number[]): FaceSelector;

    /** Filter to faces with area larger than specified */
    largerThan(area: number): FaceSelector;
    /** Filter to faces with area smaller than specified */
    smallerThan(area: number): FaceSelector;

    /** Return the face indices as a number array */
    indices(): number[];
    /** Return the raw TopoDS_Face objects */
    faces(): oc.TopoDS_Face[];
    /** Return the number of matched faces */
    count(): number;
}

/** Create an EdgeSelector for the given shape. Chain filtering methods, then call `.indices()` for FilletEdges/ChamferEdges.
 * @example```FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());```
 * @example```Edges(box).ofType("Circle").indices()```
 * @example```Edges(box).parallel([0,0,1]).indices()``` */
function Edges(shape: oc.TopoDS_Shape): EdgeSelector;

/** Create a FaceSelector for the given shape. Chain filtering methods to select faces by property.
 * @example```let topFace = Faces(box).max([0,0,1]).faces()[0];```
 * @example```Faces(box).ofType("Plane").indices()``` */
function Faces(shape: oc.TopoDS_Shape): FaceSelector;

// ============================================================
// Measurement Functions
// ============================================================

/** Returns the volume of a solid shape. May be negative if face normals are inverted — use `Math.abs()` if needed.
 * @example```console.log("Volume:", Volume(Box(10, 10, 10)));  // 1000``` */
function Volume(shape: oc.TopoDS_Shape): number;

/** Returns the total surface area of a shape.
 * @example```console.log("Area:", SurfaceArea(Box(10, 10, 10)));  // 600``` */
function SurfaceArea(shape: oc.TopoDS_Shape): number;

/** Returns the center of mass of a shape as [x, y, z].
 * @example```let com = CenterOfMass(Box(10, 10, 10));``` */
function CenterOfMass(shape: oc.TopoDS_Shape): number[];

/** Returns the total edge length of a shape.
 * @example```console.log("Edge length:", EdgeLength(Box(10, 10, 10)));``` */
function EdgeLength(shape: oc.TopoDS_Shape): number;

// ============================================================
// GUI Controls
// ============================================================

/** Creates a labeled slider with specified defaults, min, and max ranges.
 * Returns the current slider value. `name` must be unique.
 * @param step Keyboard arrow key increment (default: 0.01)
 * @param precision Decimal places shown (default: 2)
 * @example```let radius = Slider("Radius", 30, 20, 40);```
 * @example```let height = Slider("Height", 50, 10, 100, false, 1, 0);  // integer slider```*/
function Slider(name: string, defaultValue: number, min: number, max: number, realTime?: boolean, step?: number, precision?: number): number;

/** Creates a button in the GUI panel.
 * @example```Button("Reset");```*/
function Button(name: string) : void;

/** Creates a checkbox that returns true or false.
 * @example```let showLabel = Checkbox("Show Label", true);```*/
function Checkbox(name: string, defaultValue?: boolean): boolean;

/** Creates a text input that returns a string.
 * @example```let text = TextInput("Banner", "Hello!", false);```*/
function TextInput(name: string, defaultValue?: string, realTime?: boolean): string;

/** Creates a dropdown that returns the value of the selected item.
 * @param options Object with display labels as keys and return values as values.
 * @example```let pos = Dropdown("Position", 0, { top: 0, center: 5, bottom: 10 });```
 * @example```let icon = Dropdown("Icon", "heart", { Heart: "heart", Key: "key" });```*/
function Dropdown(name: string, defaultValue: string, options: { [key: string]: string }, realTime?: boolean): string;
function Dropdown(name: string, defaultValue: number, options: { [key: string]: number }, realTime?: boolean): number;

// ============================================================
// Utility
// ============================================================

/** Download a file through the browser. Use to export data from the CAD engine.
 * @example```SaveFile("myInfo.txt", URL.createObjectURL(new Blob(["Hello!"], { type: 'text/plain' })));```*/
function SaveFile(filename: string, fileURL: string): void;

/** Cache the result of an operation so it returns instantly when called with the same arguments.
 * @example```let box = CacheOp(arguments, () => { return new oc.BRepPrimAPI_MakeBox(x, y, z).Shape(); });```*/
function CacheOp(arguments: IArguments, cacheMiss: () => oc.TopoDS_Shape): oc.TopoDS_Shape;

/** Remove an item from an array. Useful for preventing shapes from being added to `sceneShapes`.
 * @example```sceneShapes = Remove(sceneShapes, tempShape);```*/
function Remove(array: any[], toRemove: any): any[];
