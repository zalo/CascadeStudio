# build123d.topology — the SEAM package for running upstream build123d
# Level-A source over build123d-lite's topology classes.
#
# Lite's class DAG is FLATTER than upstream's (Wire = Curve, Solid = Part,
# and Part/Sketch/Curve do NOT subclass Compound). Two identity fixes make
# upstream build_common's isinstance-classification work:
#   * Wire is exported as a DISTINCT subclass of lite Curve, so a lite Edge
#     (subclass of Curve) no longer classifies as a Wire.
#   * Part is exported as a subclass of lite Part accepting upstream
#     Compound's kwargs ctor (obj=, label=, material=, joints=, parent=,
#     children=). Solid stays lite Part itself so lite-produced solids
#     classify as Solids.
# Every residual gap is recorded in
# experiments/upstream-on-micropython/INVENTORY.md.
import build123d_lite as _lt
from browser import self as _w

from build123d.geometry import BoundBox, Plane, Location, Vector

# ---- direct re-exports -----------------------------------------------------
Shape = _lt.Shape
ShapeList = _lt.ShapeList
Compound = _lt.Compound
Curve = _lt.Curve
Edge = _lt.Edge
Face = _lt.Face
Shell = _lt.Shell
Vertex = _lt.Vertex
Solid = _lt.Part            # lite aliases Solid = Part; keep THAT class as
#                             Solid so lite-made solids classify correctly
Joint = _lt.Joint
GroupBy = _lt.GroupBy
DraftAngleError = _lt.DraftAngleError
new_edges = _lt.new_edges
topo_explore_common_vertex = _lt.topo_explore_common_vertex
topo_explore_connected_edges = _lt.topo_explore_connected_edges
SkipClean = getattr(_lt, 'SkipClean', None)


# ---- upstream-identity wrapper classes ------------------------------------
class Wire(_lt.Curve):
    """Upstream-identity Wire: distinct from Curve (lite aliases them), so
    build_common's typed-classification does not double-count Edges. Lite
    operations on a Wire instance preserve the class (lite's _wrap_like uses
    type(obj)). Constructing from a raw TopoDS / Edge list follows lite's
    Shape.__init__ promotions."""


class Part(_lt.Part):
    """Upstream-identity Part accepting upstream Compound's ctor kwargs
    (BasePartObject calls super().__init__(obj=..., label=..., material=...,
    joints=..., parent=..., children=...))."""

    def __init__(self, obj=None, label='', color=None, material='',
                 joints=None, parent=None, children=None, **kwargs):
        _lt.Part.__init__(self, obj)
        self.label = label or ''
        if color is not None:
            self.color = color
        self.material = material or ''
        if children:
            self.children = list(children)
        if joints:
            self.joints = dict(joints)
        if parent is not None:
            try:
                self.parent = parent
            except Exception:
                pass


class Sketch(_lt.Sketch):
    """Upstream-identity Sketch with the Compound kwargs ctor (BuildSketch's
    _sub_class; objects_sketch's BaseSketchObject calls it with kwargs)."""

    def __init__(self, obj=None, label='', color=None, material='',
                 joints=None, parent=None, children=None, **kwargs):
        _lt.Shape.__init__(self, obj)
        self.label = label or ''
        if color is not None:
            self.color = color
        self.material = material or ''
        if children:
            self.children = list(children)


# ---- ported upstream helpers ----------------------------------------------
def tuplify(obj, dim):
    """Create a size tuple (upstream topology.utils.tuplify, verbatim port)."""
    if obj is None:
        result = None
    elif isinstance(obj, (tuple, list)):
        result = tuple(obj)
    else:
        result = tuple([obj] * dim)
    return result


def isclose_b(x, y, rel_tol=1e-9, abs_tol=1e-14):
    """upstream topology.utils.isclose_b: math.isclose with build123d's
    defaults (abs_tol=1e-14 instead of 0)."""
    return abs(x - y) <= max(rel_tol * max(abs(x), abs(y)), abs_tol)


def downcast(obj):
    """Upstream downcasts raw TopoDS_Shape to its concrete class; lite's JS
    seam already hands back concrete shapes, so this is the identity."""
    return obj


def unwrapped_shapetype(obj):
    t = _lt._topo(obj)
    return t.ShapeType() if hasattr(t, 'ShapeType') else None


# ---- additive patches on lite classes (upstream call-surface gaps) --------
if not hasattr(_lt.Shape, 'material'):
    # BasePartObject reads part.material off freshly-made lite Solids
    _lt.Shape.material = ''


def _compound_get_type(self, obj_type):
    """upstream Compound.get_type(Edge|Wire|Face|Solid): sub-shapes of that
    class. Wire maps to lite's wire grouping of the compound's edges."""
    if obj_type is Edge:
        return ShapeList(self.edges())
    if obj_type is Face:
        return ShapeList(self.faces())
    if obj_type is Solid:
        return ShapeList(self.solids())
    if obj_type is Wire or obj_type is Curve:
        return ShapeList(self.wires())
    if obj_type is Vertex:
        return ShapeList(self.vertices())
    return ShapeList()


if not hasattr(_lt.Compound, 'get_type'):
    _lt.Compound.get_type = _compound_get_type


def _solid_make_box(cls, length, width, height, plane=None):
    """upstream Solid.make_box: a box at the plane origin extending in the
    POSITIVE direction of each axis (lite's Box object is center-aligned, so
    this calls the worker's Box maker uncentered)."""
    s = _lt.Part(_w.Box(length, width, height, False))
    if plane is not None:
        s = plane.location * s
    return s


if not hasattr(_lt.Part, 'make_box'):
    _lt.Part.make_box = classmethod(_solid_make_box)
