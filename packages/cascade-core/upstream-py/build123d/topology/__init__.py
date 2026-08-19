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


class _CompoundKwargsInit:
    """upstream Compound's ctor surface: __init__(obj, label=, color=,
    material=, joints=, parent=, children=). Mixed into the Part/Sketch
    upstream-identity classes."""

    def _cs_init(self, obj=None, label='', color=None, material='',
                 joints=None, parent=None, children=None, **kwargs):
        _lt.Shape.__init__(self, obj)
        self.label = label or ''
        if color is not None:
            self.color = color
        self.material = material or ''
        if children:
            self.children = list(children)
        if joints:
            self.joints = {k: j._lite_rebind(self) for k, j in joints.items()}
        if parent is not None:
            try:
                self.parent = parent
            except Exception:
                pass


class Part(_lt.Compound, _CompoundKwargsInit):
    """Upstream-identity Part: like upstream, a Compound subclass that is NOT
    a Solid — builder transfers classify it through the Compound branch of
    _add_to_context (get_type extraction) with no double count against
    Solid = lite Part."""

    _dim = 3

    def __init__(self, *a, **k):
        self._cs_init(*a, **k)


class Sketch(_lt.Compound, _CompoundKwargsInit):
    """Upstream-identity Sketch (Compound subclass, like upstream)."""

    _dim = 2

    def __init__(self, *a, **k):
        self._cs_init(*a, **k)


class _CsBuilderCurve(_lt.Curve, _lt.Compound):
    """BuildLine's _sub_class (rebound in build123d._finalize): carries BOTH
    upstream identities — a Curve for objects_curve's isinstance checks and a
    Compound so a nested BuildLine's transferred result classifies through
    the parent builder's Compound branch. topology.Curve itself stays lite's
    Curve so lite-produced curves keep passing objects_curve's checks."""

    _dim = 1

    def __init__(self, obj=None, label='', **kwargs):
        _lt.Curve.__init__(self, obj)
        self.label = label or ''


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


if not hasattr(_lt.Shape, 'topo_parent'):
    # operations_generic's algebra-mode fillet/chamfer find the owning shape
    # of a selected Edge/Vertex through .topo_parent; lite tracks the same
    # link as .parent (set by the edges()/faces()/vertices() selectors)
    _lt.Shape.topo_parent = property(lambda self: self._parent)

# upstream tags every topology class with its dimension (Shape._dim);
# operations_generic dispatches fillet/chamfer/offset on it
if not hasattr(_lt.Part, '_dim'):
    _lt.Part._dim = 3
    _lt.Shell._dim = 2
    _lt.Face._dim = 2
    _lt.Sketch._dim = 2
    _lt.Curve._dim = 1        # Edge inherits; adapter Wire inherits
    _lt.Vertex._dim = 0
    def _compound_dim(self):
        if self.topo is None:
            return None
        if len(self.solids()) > 0:
            return 3
        if len(self.faces()) > 0:
            return 2
        return 1
    _lt.Compound._dim = property(_compound_dim)


def _shape_fillet_3d(self, radius, edge_list):
    """upstream Mixin3D.fillet(radius, edge_list) as a method on the seam
    Shape (lite exposes filleting as the module-level fillet(edges, r) over
    per-shape edge indices)."""
    edges = list(edge_list)
    idxs = [getattr(e, 'index', None) for e in edges]
    if not edges or any(i is None for i in idxs):
        raise ValueError('fillet: the edges must come from this shape\'s '
                         'edges() selector')
    return _lt._wrap_like(self, _w.FilletEdges(_lt._topo(self), radius, idxs))


def _shape_chamfer_3d(self, length, length2, edge_list, face=None):
    """upstream Mixin3D.chamfer(length, length2, edge_list) — symmetric
    chamfers only (lite's kernel binding takes one distance)."""
    if length2 is not None and length2 != length:
        raise NotImplementedError(
            'asymmetric chamfers are not supported in build123d-lite')
    if face is not None:
        raise NotImplementedError(
            'chamfer(face=) is not supported in build123d-lite')
    edges = list(edge_list)
    idxs = [getattr(e, 'index', None) for e in edges]
    if not edges or any(i is None for i in idxs):
        raise ValueError('chamfer: the edges must come from this shape\'s '
                         'edges() selector')
    return _lt._wrap_like(self, _w.ChamferEdges(_lt._topo(self), length, idxs))


if not hasattr(_lt.Shape, 'fillet'):
    _lt.Shape.fillet = _shape_fillet_3d
    _lt.Shape.chamfer = _shape_chamfer_3d


def _face_fillet_2d(self, radius, vertices):
    """upstream Face.fillet_2d(radius, vertices) over lite's
    BRepFilletAPI_MakeFillet2d binding."""
    pts = [[v.X, v.Y, v.Z] for v in vertices]
    return _lt.Face(_w.FilletFace2D(_lt._topo(self), radius, pts))


def _face_chamfer_2d(self, distance, distance2, vertices, edge=None):
    raise NotImplementedError(
        '2D vertex chamfers are not supported in build123d-lite')


def _wire_fillet_2d(self, radius, vertices):
    """upstream Wire/Edge.fillet_2d(radius, vertices) — 1-D corner fillets
    (ChFi2d_FilletAlgo in lite)."""
    return _lt._wire_fillet_2d(self, list(vertices), radius)


if not hasattr(_lt.Face, 'fillet_2d'):
    _lt.Face.fillet_2d = _face_fillet_2d
    _lt.Face.chamfer_2d = _face_chamfer_2d
    _lt.Curve.fillet_2d = _wire_fillet_2d


def _vertex_eq(self, other):
    if self is other:
        return True
    if not isinstance(other, _lt.Vertex):
        return NotImplemented
    ax = getattr(self, 'X', None)
    bx = getattr(other, 'X', None)
    if ax is None or bx is None:  # mid-__init__ (lite's parent setter)
        return False
    return (abs(self.X - other.X) < 1e-9 and abs(self.Y - other.Y) < 1e-9
            and abs(self.Z - other.Z) < 1e-9)


def _vertex_hash(self):
    if getattr(self, 'X', None) is None:
        return 0
    return hash((round(self.X, 6), round(self.Y, 6), round(self.Z, 6)))


if '__eq__' not in _lt.Vertex.__dict__:
    # upstream Shape.__eq__ is geometric same-ness; lite compares identity.
    # operations_generic's 2-D fillet/chamfer do `v in vertices_of_face`
    # against FRESH selector wrappers, so identity-eq silently skips every
    # fillet. Vertices get value equality (the other classes stay identity —
    # see INVENTORY.md shape-equality).
    _lt.Vertex.__eq__ = _vertex_eq
    _lt.Vertex.__hash__ = _vertex_hash


def _face_is_coplanar(self, plane):
    """upstream Face.is_coplanar(plane): the face's plane equals the given
    plane geometrically (orientation-insensitive — _add_to_context flips
    up-side-down faces separately via normal_at)."""
    try:
        p = Plane(self)
    except Exception:
        return False
    if p.z_dir.cross(plane.z_dir).length > 1e-6:
        return False
    return abs((p.origin - plane.origin).dot(plane.z_dir)) < 1e-6


if not hasattr(_lt.Face, 'is_coplanar'):
    _lt.Face.is_coplanar = _face_is_coplanar


# ---- enum identity across the seam ----------------------------------------
# Upstream code and USER code hold upstream's (metaclass-free) enum members;
# lite's selector methods compare against lite's own enum values. Translate
# by class+member NAME at the ShapeList boundary.
import enum as _enum_shim


def _cs_enum_to_lite(v):
    if isinstance(v, _enum_shim._Member):
        lite_cls = getattr(_lt, v._cls_name_, None)
        if lite_cls is not None:
            return getattr(lite_cls, v._name_, v)
    return v


def _wrap_shapelist_method(name):
    orig = getattr(_lt.ShapeList, name)

    def wrapped(self, key=None, *a, **k):
        return orig(self, _cs_enum_to_lite(key), *a, **k)
    return wrapped, orig


if not hasattr(_lt.ShapeList, '_cs_enum_wrapped'):
    for _m in ('filter_by', 'sort_by', 'group_by'):
        if hasattr(_lt.ShapeList, _m):
            _w2, _orig = _wrap_shapelist_method(_m)
            setattr(_lt.ShapeList, _m, _w2)
    _lt.ShapeList._cs_enum_wrapped = True


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
