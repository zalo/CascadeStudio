// Build123dLite.js - the "build123d-lite" Python library source (cascade-core)
//
// A deliberately small, algebra-mode-only subset of build123d
// (https://build123d.readthedocs.io) implemented on top of the CascadeStudio
// standard library that the CAD worker exposes on `self` (Box, Union, ...).
// PythonRuntime.js registers this source as the importable Brython module
// `build123d`, so user scripts start with `from build123d import *`.
//
// The source is embedded as a JS template string (rather than a .py asset
// copied to dist) so the worker bundle needs no extra fetch or dev/build
// dual-path handling beyond brython.js itself, and so the library is always
// version-locked to the worker code that consumes it.
//
// Honest-subset notes (differences from real build123d):
//  * Algebra mode only — no BuildPart/BuildSketch/BuildLine context managers.
//  * Selectors: shape.edges() returns ALL edges (plus an `indices=` escape
//    hatch used by the GUI Fillet tool). No group_by/filter_by/sort_by yet.
//  * Rot(X, Y, Z) applies rotations about the CAD X, then Y, then Z axes
//    (degrees) about the origin, like build123d's Rotation for the simple
//    cases; there is no full Location/Plane math.
//  * No numpy-dependent APIs, no Compound/ShapeList, no 2D fillets.

export const BUILD123D_LITE_PY = `
# build123d-lite: a small algebra-mode subset of build123d for CascadeStudio.
#
# Runs under Brython inside the CAD worker. Every CAD operation delegates to
# the CascadeStudio standard library, which the worker exposes as JS globals
# (Box, Union, Difference, ...). Those JS functions own all sceneShapes
# bookkeeping — they push results into the scene and remove inputs consumed
# by booleans/transforms — so this module never adds shapes twice.
from browser import self as w


def _topo(obj):
    """Unwrap a Shape (or accept a raw TopoDS shape) to the JS shape object."""
    if isinstance(obj, Shape):
        return obj.topo
    if hasattr(obj, 'ShapeType'):
        return obj
    raise TypeError('expected a build123d-lite Shape, got ' + repr(obj))


class Shape:
    """A scene shape wrapping a raw OCCT TopoDS shape (self.topo).

    Supports build123d algebra: a + b (fuse), a - b (cut), a & b (common).
    """

    def __init__(self, topo):
        self.topo = topo

    # --- boolean algebra (build123d "algebra mode") ---
    def __add__(self, other):
        return Shape(w.Union([self.topo, _topo(other)]))

    def __sub__(self, other):
        return Shape(w.Difference(self.topo, [_topo(other)]))

    def __and__(self, other):
        return Shape(w.Intersection([self.topo, _topo(other)]))

    # --- selectors (subset) ---
    def edges(self, indices=None):
        """The edges of this shape as an EdgeList (for fillet/chamfer).

        Real build123d returns a ShapeList with group_by/filter_by/sort_by;
        this subset returns every edge unless indices=[...] picks specific
        per-shape edge indices (the same indices the GUI hover tooltip and
        Fillet tool display).
        """
        if indices is None:
            indices = list(w.Edges(self.topo).indices())
        return EdgeList(self, list(indices))

    # --- measurement ---
    @property
    def volume(self):
        return abs(w.Volume(self.topo))

    @property
    def area(self):
        return w.SurfaceArea(self.topo)

    def center(self):
        return tuple(w.CenterOfMass(self.topo))


class EdgeList:
    """A selection of edges on a parent Shape, by per-shape edge index."""

    def __init__(self, shape, indices):
        self.shape = shape
        self.indices = list(indices)

    def __len__(self):
        return len(self.indices)

    def __iter__(self):
        return iter(self.indices)


class Location:
    """A rigid placement built from Pos()/Rot() factories.

    Composes with * (right-most applies first, like build123d):
        Pos(0, 0, 5) * Rot(0, 0, 45) * shape   # rotate, then translate
    Applying to a Shape returns a NEW moved Shape.
    """

    def __init__(self, ops):
        # ops: list of ('pos', x, y, z) / ('rot', x, y, z) in composition order
        self.ops = list(ops)

    def __mul__(self, other):
        if isinstance(other, Location):
            return Location(self.ops + other.ops)
        topo = _topo(other)
        # Right-most op applies first (matrix-composition order)
        for op in reversed(self.ops):
            if op[0] == 'pos':
                if op[1] or op[2] or op[3]:
                    topo = w.Translate([op[1], op[2], op[3]], topo)
            else:
                # Rotations about origin: X, then Y, then Z (degrees)
                if op[1]:
                    topo = w.Rotate([1, 0, 0], op[1], topo)
                if op[2]:
                    topo = w.Rotate([0, 1, 0], op[2], topo)
                if op[3]:
                    topo = w.Rotate([0, 0, 1], op[3], topo)
        return Shape(topo)


def Pos(x=0, y=0, z=0):
    """Position offset: Pos(x, y, z) * shape translates the shape (mm)."""
    return Location([('pos', x, y, z)])


def Rot(x=0, y=0, z=0):
    """Rotation: Rot(x, y, z) * shape rotates about X, then Y, then Z (deg)."""
    return Location([('rot', x, y, z)])


class Axis:
    """Minimal Axis with a direction; only Axis.X/Y/Z are provided."""

    def __init__(self, direction):
        self.direction = tuple(direction)


Axis.X = Axis((1, 0, 0))
Axis.Y = Axis((0, 1, 0))
Axis.Z = Axis((0, 0, 1))


# --- 3D primitives (centered on the origin, like build123d) ---

def Box(length, width, height):
    """A box centered on the origin (build123d convention).

    NOTE: unlike the CascadeStudio JS Box(x, y, z), which is corner-origin
    by default, this Box is centered on all three axes.
    """
    return Shape(w.Box(length, width, height, True))


def Cylinder(radius, height):
    """A Z-axis cylinder centered on the origin (spans -h/2 .. +h/2)."""
    return Shape(w.Cylinder(radius, height, True))


def Sphere(radius):
    """A sphere centered on the origin."""
    return Shape(w.Sphere(radius))


def Cone(bottom_radius, top_radius, height):
    """A Z-axis cone, centered on the origin like build123d's Cone."""
    topo = w.Cone(bottom_radius, top_radius, height)
    return Shape(w.Translate([0, 0, -height / 2], topo))


# --- 2D profiles (so extrude/revolve have something to consume) ---

def Rectangle(width, height):
    """A planar rectangle face on the XY plane, centered on the origin."""
    x, y = width / 2, height / 2
    return Shape(w.Polygon([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]]))


def Circle(radius):
    """A planar disc face on the XY plane, centered on the origin."""
    return Shape(w.Circle(radius, False))


# --- operations ---

def fillet(edge_list, radius):
    """Fillet the edges of an EdgeList: part = fillet(part.edges(), 2)."""
    if not isinstance(edge_list, EdgeList):
        raise TypeError('fillet() expects shape.edges(...), got ' + repr(edge_list))
    return Shape(w.FilletEdges(edge_list.shape.topo, radius, edge_list.indices))


def chamfer(edge_list, length):
    """Chamfer the edges of an EdgeList: part = chamfer(part.edges(), 1)."""
    if not isinstance(edge_list, EdgeList):
        raise TypeError('chamfer() expects shape.edges(...), got ' + repr(edge_list))
    return Shape(w.ChamferEdges(edge_list.shape.topo, length, edge_list.indices))


def extrude(profile, amount, dir=(0, 0, 1)):
    """Linear-extrude a planar face (Rectangle/Circle/imported face)."""
    d = [dir[0] * amount, dir[1] * amount, dir[2] * amount]
    return Shape(w.Extrude(_topo(profile), d))


def revolve(profile, axis=None, revolution_arc=360):
    """Revolve a planar face around an Axis (default Axis.Z) by degrees."""
    d = (axis or Axis.Z).direction
    return Shape(w.Revolve(_topo(profile), revolution_arc, [d[0], d[1], d[2]]))


# --- measurement / display ---

def volume(shape):
    """Absolute volume of a shape in mm^3."""
    return abs(w.Volume(_topo(shape)))


def show(*shapes):
    """Ensure shapes are in the render scene (build123d-sandbox compat).

    The standard library already scene-registers every produced shape, so
    this only re-adds a shape if something explicitly removed it. Membership
    is tested with 'is' — Brython compares the underlying JS objects, so it
    works across wrapper instances (plain .indexOf() does not).
    """
    for s in shapes:
        try:
            topo = _topo(s)
        except TypeError:
            continue
        if not any(existing is topo for existing in w.sceneShapes):
            w.sceneShapes.push(topo)


def show_object(shape, name=None, options=None):
    """CQ-editor style alias for show()."""
    show(shape)
`;
