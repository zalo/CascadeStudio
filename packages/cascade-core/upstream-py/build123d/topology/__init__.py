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


# ---- result-class remapping ------------------------------------------------
# lite's _wrap_like (rebound here — Python resolves module globals at call
# time, so every lite-internal call goes through this) re-wraps operation
# results: transformed Faces/Edges become lite Sketch/Curve. Those base-class
# instances carry NO upstream classification identity (not Compound), so a
# builder transfer of e.g. a moved sketch raises "BuildSketch doesn't accept
# ...". Remap the two base classes onto their upstream-identity subclasses.
_orig_wrap_like = _lt._wrap_like


def _cs_wrap_like(obj, topo):
    res = _orig_wrap_like(obj, topo)
    cls = type(res)
    if cls is _lt.Sketch:
        out = object.__new__(Sketch)
        _lt.Shape.__init__(out, res.topo)
        out._loc = res._loc
        out.label = res.label
        return out
    if cls is _lt.Curve:
        out = object.__new__(_CsBuilderCurve)
        _lt.Shape.__init__(out, res.topo)
        out._specs = list(getattr(res, '_specs', []) or [])
        out._loc = res._loc
        out.label = res.label
        return out
    return res


if _lt._wrap_like is _orig_wrap_like:
    _lt._wrap_like = _cs_wrap_like


def _cs_remap_result(res):
    """Give a lite base-class result upstream classification identity
    (constructions that do NOT go through _wrap_like, e.g. offset_2d's
    `Curve(offset_topo)`)."""
    if type(res) is _lt.Curve or type(res) is _lt.Sketch:
        return _cs_wrap_like(res, res.topo)
    return res


_orig_offset_2d = _lt.Curve.offset_2d


def _cs_offset_2d(self, *a, **k):
    return _cs_remap_result(_orig_offset_2d(self, *a, **k))


if _lt.Curve.offset_2d is _orig_offset_2d:
    _lt.Curve.offset_2d = _cs_offset_2d


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


def _cs_not_owned(items, owners, kind):
    """items of `kind` that do NOT belong to any of the owner shapes
    (upstream's get_type only returns a compound's DIRECT children; lite has
    no direct-children iterator, so ownership is subtracted through lite's
    geometric _shape_key)."""
    if not owners:
        return ShapeList(items)
    owned = set()
    for s in owners:
        for x in _lt._sub_shapes_of(s, kind):
            owned.add(_lt._shape_key(x, kind))
    return ShapeList([x for x in items
                      if _lt._shape_key(x, kind) not in owned])


def _compound_get_type(self, obj_type):
    """upstream Compound.get_type(Edge|Wire|Face|Solid): the compound's OWN
    children of that type — faces inside solids (or edges inside faces) are
    NOT returned, unlike faces()/edges()."""
    solids = self.solids()
    if obj_type is Solid:
        return ShapeList(solids)
    if obj_type is Face:
        return _cs_not_owned(self.faces(), solids, 'face')
    if obj_type is Wire or obj_type is Curve:
        if len(self.faces()) > 0:
            return ShapeList()  # wires inside faces are not free
        return ShapeList(self.wires())
    if obj_type is Edge:
        return _cs_not_owned(self.edges(), list(self.faces()), 'edge')
    if obj_type is Vertex:
        return _cs_not_owned(self.vertices(), list(self.edges()), 'vertex')
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


def _cs_geom_eq(kind):
    def eq(self, other):
        if self is other:
            return True
        if not isinstance(other, type(self)) and \
                not isinstance(self, type(other)):
            return NotImplemented
        if self.topo is None or other.topo is None:
            return self.topo is other.topo
        try:
            return _lt._shape_key(self, kind) == _lt._shape_key(other, kind)
        except Exception:
            return self is other
    return eq


def _cs_geom_hash(kind):
    def h(self):
        if self.topo is None:
            return 0
        try:
            return hash(_lt._shape_key(self, kind))
        except Exception:
            return 0
    return h


if '__eq__' not in _lt.Face.__dict__:
    # upstream Shape.__eq__ is topological same-ness; lite compares identity,
    # and every selector call makes FRESH wrappers, so upstream patterns like
    # `face in solid.faces()` (offset's openings filter) silently miss.
    _lt.Face.__eq__ = _cs_geom_eq('face')
    _lt.Face.__hash__ = _cs_geom_hash('face')
    _lt.Edge.__eq__ = _cs_geom_eq('edge')
    _lt.Edge.__hash__ = _cs_geom_hash('edge')


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


def _cs_lite_enum_lookup(cls_name, member_name):
    lite_cls = getattr(_lt, cls_name, None)
    if lite_cls is None:
        return None
    return getattr(lite_cls, member_name, None)


_enum_shim._cs_set_lite_lookup(_cs_lite_enum_lookup)


def _cs_enum_to_lite(v):
    if isinstance(v, _enum_shim._Member):
        lite_cls = getattr(_lt, v._cls_name_, None)
        if lite_cls is not None:
            return getattr(lite_cls, v._name_, v)
    return v


_NO_KEY = object()


def _wrap_shapelist_method(name):
    orig = getattr(_lt.ShapeList, name)

    def wrapped(self, key=_NO_KEY, *a, **k):
        if key is _NO_KEY:
            return orig(self, *a, **k)  # keep lite's own default key
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


def _solid_make_cone(cls, base_radius, top_radius, height, plane=None,
                     angle=360):
    """upstream Solid.make_cone: base on the plane origin, extending along
    the plane normal."""
    if angle != 360:
        raise NotImplementedError(
            'partial cones are not supported in build123d-lite')
    s = _lt.Part(_w.Cone(base_radius, top_radius, height))
    if plane is not None:
        s = plane.location * s
    return s


def _solid_make_torus(cls, major_radius, minor_radius, plane=None,
                      start_angle=0, end_angle=360, major_angle=360):
    """upstream Solid.make_torus: torus centred at the plane origin."""
    if start_angle != 0 or end_angle != 360 or major_angle != 360:
        raise NotImplementedError(
            'partial tori are not supported in build123d-lite')
    prof = _w.Circle(minor_radius, False)
    prof = _w.Rotate([1, 0, 0], 90, prof)
    prof = _w.Translate([major_radius, 0, 0], prof)
    s = _lt.Part(_w.Revolve(prof, 360, [0, 0, 1]))
    if plane is not None:
        s = plane.location * s
    return s


def _wire_make_circle(cls, radius, plane=None):
    """upstream Wire.make_circle: a closed circular wire (the worker's
    Circle(r, wire=True) is a TopoDS_Wire in the XY plane)."""
    res = object.__new__(cls)
    _lt.Curve.__init__(res, _w.Circle(radius, True))
    if plane is not None:
        res = plane.location * res
    return res


def _solid_extrude_taper(cls, section, direction, taper, flip_inner=True):
    """upstream Solid.extrude_taper(section, direction, taper): port of
    lite's own two-algorithm taper (LocOpe_DPrism for a positive taper along
    the profile normal, otherwise the offset loft)."""
    import math
    dvec = Vector(direction)
    amount = dvec.length
    profile = _lt.Face(_lt._topo(section))
    inner = profile.inner_wires()
    base = Plane(profile)
    along_normal = (dvec.normalized() - base.z_dir).length < 1e-9
    if taper > 0 and not inner and along_normal:
        return _lt.Part(_w.TaperExtrude(_lt._topo(profile), amount, taper))
    offset_amt = -abs(amount) * math.tan(math.radians(taper))
    shift = _lt.Pos(dvec.X, dvec.Y, dvec.Z)
    solids = []
    for i, wire in enumerate([profile.outer_wire()] + list(inner)):
        flip = (-1.0 if flip_inner else 1.0) if i > 0 else 1.0
        local = base.location.inverse() * wire
        local_taper = _lt.Curve(_lt._topo(local)).offset_2d(
            flip * offset_amt, kind=_lt.Kind.INTERSECTION)
        taper_wire = shift * (base.location * _lt.Curve(_lt._topo(local_taper)))
        solids.append(_lt.Part(_w.Loft([_lt._topo(wire),
                                        _lt._topo(taper_wire)], False)))
    solid = solids[0] if len(solids) == 1 else (solids[0] - solids[1:])
    return _lt.Part(_lt._topo(solid))


def _cs_path_wire_topo(path):
    """ONE chained TopoDS_Wire from a path Curve/Wire/Edge (lite sweep's
    exact logic: multi-segment curves rebuild through their specs because
    their topo may be a compound of separate wires)."""
    if isinstance(path, _lt.Curve) and getattr(path, '_specs', None):
        return _w.WireFromSegments(_lt._chain_segments(path._specs))
    t = _lt._topo(path)
    if not hasattr(t, 'ShapeType') or t.ShapeType().value != 5:
        t = _w.GetWire(t, 0, True)
    return t


def _cs_section_wire_topo(section):
    t = _lt._topo(section)
    st = t.ShapeType().value if hasattr(t, 'ShapeType') else -1
    if st == 4:  # face -> outer wire
        return _w._faceOuterWire(t)
    if st != 5:
        return _w.GetWire(t, 0, True)
    return t


def _solid_sweep(cls, section, path, inner_wires=None, make_solid=True,
                 is_frenet=False, mode=None, transition=None):
    """upstream Solid.sweep over lite's MakePipeShell binding."""
    tname = getattr(transition, 'name', None) or 'TRANSFORMED'
    tmap = {'TRANSFORMED': 'transformed', 'ROUND': 'round', 'RIGHT': 'right'}
    binormal_vec = []
    aux = 0
    if isinstance(mode, _lt.Vector):
        binormal_vec = list(mode)
    elif mode is not None:
        aux = _cs_path_wire_topo(mode)
    solid = _w.PipeShellSweep([_cs_section_wire_topo(section)],
                              _cs_path_wire_topo(path), is_frenet,
                              tmap.get(tname, 'transformed'),
                              binormal_vec, aux, bool(make_solid))
    return _lt.Part(solid)


def _solid_sweep_multi(cls, profiles, path, make_solid=True, is_frenet=False,
                       binormal=None):
    """upstream Solid.sweep_multi over lite's MakePipeShell binding
    (multisection never sets a transition mode, like lite's sweep)."""
    binormal_vec = []
    aux = 0
    if isinstance(binormal, _lt.Vector):
        binormal_vec = list(binormal)
    elif binormal is not None:
        aux = _cs_path_wire_topo(binormal)
    wires = [_cs_section_wire_topo(p) for p in profiles]
    solid = _w.PipeShellSweep(wires, _cs_path_wire_topo(path), is_frenet, '',
                              binormal_vec, aux, bool(make_solid))
    return _lt.Part(solid)


def _solid_offset_3d(self, openings, thickness, tolerance=0.0001,
                     kind=None):
    """upstream Solid.offset_3d over lite's MakeThickSolid binding."""
    faces = [_lt._topo(o) for o in (openings or [])]
    return _lt.Part(_w.ThickSolidOffset(_lt._topo(self), faces, thickness,
                                        tolerance))


def _shape_fix(self):
    """upstream Shape.fix (ShapeFix_Shape): lite's JS ops fix internally."""
    return self


if not hasattr(_lt.Shape, 'offset_3d'):
    _lt.Shape.offset_3d = _solid_offset_3d
    _lt.Shape.fix = _shape_fix


_orig_bounding_box = _lt.Shape.bounding_box


def _cs_bounding_box(self, tolerance=None, optimal=True):
    # upstream signature has optimal=; lite's exact Bnd_Box ignores it
    return _orig_bounding_box(self, tolerance)


if _lt.Shape.bounding_box is _orig_bounding_box:
    _lt.Shape.bounding_box = _cs_bounding_box


def _shape_unwrap(self, fully=True):
    """upstream Shape.unwrap: strip redundant single-child Compound layers.
    Lite compounds are built flat, so this is the identity."""
    return self


if not hasattr(_lt.Shape, 'unwrap'):
    _lt.Shape.unwrap = _shape_unwrap


def _solid_extrude_until(cls, section, target, direction, until=None):
    """upstream Solid.extrude_until (port of lite's Until.NEXT/LAST logic:
    extrude far, subtract the target, keep the pieces the mode asks for)."""
    d = Vector(direction).normalized()
    body = target
    bb = list(_w.BoundingBox(_lt._topo(body), 0.01))
    ln = 3.0 * max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2])
    face = _lt._topo(section)
    candidate = _lt.Part(_w.Extrude(face, [d.X * ln, d.Y * ln, d.Z * ln],
                                    True))
    outside = _lt.Part(_w.Difference(candidate.topo, [_lt._topo(body)],
                                     True, 1e-7, True))
    pieces = outside.solids()

    def proj(s):
        sb = list(_w.BoundingBox(s.topo, 0.01))
        return (min(sb[0] * d.X, sb[3] * d.X) +
                min(sb[1] * d.Y, sb[4] * d.Y) +
                min(sb[2] * d.Z, sb[5] * d.Z))
    pieces = _lt._stable_sorted(pieces, key=proj)
    if not pieces:
        return candidate
    if getattr(until, 'name', '') == 'NEXT':
        return pieces[0]
    return candidate - pieces[-1]


if not hasattr(_lt.Part, 'make_box'):
    _lt.Part.make_box = classmethod(_solid_make_box)
    _lt.Part.extrude_until = classmethod(_solid_extrude_until)
    _lt.Part.sweep = classmethod(_solid_sweep)
    _lt.Part.sweep_multi = classmethod(_solid_sweep_multi)
    _lt.Part.make_cone = classmethod(_solid_make_cone)
    _lt.Part.make_torus = classmethod(_solid_make_torus)
    _lt.Part.extrude_taper = classmethod(_solid_extrude_taper)
    Wire.make_circle = classmethod(_wire_make_circle)
