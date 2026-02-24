// This is a small Gallery demonstrating how to use some of the available functions

// Slider: Creates a simple slider that can be used to adjust parameters of the model
let t = Slider("Param", 1, 0.4, 1.75);

// Sketch: An interface for drawing 2D shapes and curves
let face = new Sketch([-10*t,-8*t]).Fillet(2*t).
               LineTo([ 10*t,-8*t]).Fillet(2*t).
               LineTo([  0*t, 8*t]).Fillet(2*t).
               End(true).Face();

let shapes = [
    // Box: Creates a rectangular prism with these X, Y, and Z Dimensions
    Box(20, 20, 20*t),

    // Sphere: Creates a sphere of specified radius
    Translate([0,0,10*t], Sphere(10*t)),

    // Cylinder: Creates a Cylinder with a radius and height
    Cylinder(10, 20*t),

    // Cone: Creates a revolved trapezoid with differing top and bottom radii
    Cone(15, 8*t, 15),

    // Sketch: (See Top)
    face,

    // Extrude: Extrudes a face along a vector direction
    Extrude(face, [20*(1-t), 0, 20]),

    // RotatedExtrude: Extrudes a wire vertically with a specified height and twist
    RotatedExtrude(GetWire(face), 20*t, 45*t),

    // Pipe: Sweeps a face along a Wire
    Pipe(face, BSpline([[0,0,0],[0,0,10],[13,-10,30]], false)),

    // Revolve: Revolves Edges, Wires, and Faces about the specified Axis
    Rotate([1,0,0], 90, Revolve(Translate([10*t,8*t,0], GetWire(face)), -60, [0, 1, 0])),

    // Offset: Dilates or Contracts a shape by the specified distance
    // This is similar to the minkowski sum with a sphere
    Offset(Text3D("H", 36, 0.15, "Roboto"), 2.25*t),

    // Text3D: Creates 3D Text from a TrueType font
    Text3D("Hi!", 36, 0.15*t, "Consolas"),

    // Filler in the Grid
    Translate([0,0,-50], Box(1,1,1)),

    // Loft: Interpolates along an array of Wires into a continuous solid shape
    Loft([GetWire(face), Translate([0,0,20], Circle(8, true))]),

    // Fillet: Round-off an array of edges on a shape (derived from mouse hovering)
    FilletEdges (Cylinder(10, 20), 4*t, [0,2]),

    // Chamfer: Apply a 45-degree cut to an array of edges on a shape
    ChamferEdges(Cylinder(10, 20), 4*t, [0,2]),

    // Difference: CSG Subtract a set of shapes from a target shape
    // See Also: Union() and Intersection()
    Translate([0,0,10], Difference(Sphere(10), [Cylinder(5*t, 30, true)]))
];

// Line up the above shapes into a grid pattern for easy display
let shapeInd = 0;
for(let y = -80; y < 80; y += 40){
    for(let x = -80; x < 80; x += 40){
        if(shapeInd < shapes.length){
            Translate([x, y, 0], shapes[shapeInd]);
        }
        shapeInd++;
    }
}

// --- Selector API Examples ---

// Selector-based filleting (replaces hardcoded indices)
let selectorBox = Box(40, 40, 20);
FilletEdges(selectorBox, 3, Edges(selectorBox).max([0,0,1]).indices());
Translate([120, -80, 0], selectorBox);

// Measurement functions
let measureBox = Box(10, 10, 10);
console.log("Volume:", Volume(measureBox));
console.log("Surface Area:", SurfaceArea(measureBox));
console.log("Center of Mass:", CenterOfMass(measureBox));
console.log("Edge Length:", EdgeLength(measureBox));
Translate([120, -40, 0], measureBox);

// Wedge primitive
Translate([120, 0, 0], Wedge(30, 20, 30, 10));
