# build123d.topology — the SEAM package for running upstream build123d
# Level-A source over build123d-lite's topology classes.
#
# Since the class-DAG unification, lite's hierarchy IS upstream's (Wire is a
# real class distinct from Edge and Curve; Part/Sketch/Curve subclass
# Compound; Solid is distinct from Part; Shape.__eq__/__hash__ are
# topological same-ness; Compound.get_type extracts DIRECT children), so this
# module is genuine re-exports plus the S-sized METHOD fills upstream Level-A
# calls that lite exposes differently (usually as module-level builder-aware
# functions). Every residual gap is recorded in
# experiments/upstream-on-micropython/INVENTORY.md.
import build123d_lite as _lt
from browser import self as _w

from build123d.geometry import BoundBox, Plane, Location, Vector

# ---- direct re-exports (lite's classes ARE upstream's DAG) -----------------
Shape = _lt.Shape
ShapeList = _lt.ShapeList
Compound = _lt.Compound
Curve = _lt.Curve
Edge = _lt.Edge
Wire = _lt.Wire
Face = _lt.Face
Shell = _lt.Shell
Vertex = _lt.Vertex
Solid = _lt.Solid
Part = _lt.Part
Sketch = _lt.Sketch
Mixin1D = _lt.Mixin1D
Joint = _lt.Joint
GroupBy = _lt.GroupBy
DraftAngleError = _lt.DraftAngleError
new_edges = _lt.new_edges
topo_explore_common_vertex = _lt.topo_explore_common_vertex
topo_explore_connected_edges = _lt.topo_explore_connected_edges
SkipClean = getattr(_lt, 'SkipClean', None)


# ---- dev (future 0.12) attribute-protocol fills ----------------------------
# Dev's topology stores the raw TopoDS in Shape._wrapped behind a wrapped
# property WITH a setter; its build_common reads `_wrapped` directly
# (_PublicationService.place's None-guard) and ASSIGNS `.wrapped`
# (publish(preserve_identity=True) adopts the placed topology). Lite stores
# the raw shape in .topo with a getter-only `wrapped`: bridge both here.
def _cs_get_wrapped(self):
    return self.topo


def _cs_set_wrapped(self, value):
    self.topo = value


Shape._wrapped = property(_cs_get_wrapped)
Shape.wrapped = property(_cs_get_wrapped, _cs_set_wrapped)


# Dev's _PublicationService.place / Builder publication call
# Shape.copy_attributes_to(target, exceptions) to carry USER metadata
# (label, color, joints, ...) onto the placed result. Port of upstream
# shape_core's method, with lite's INTERNAL bookkeeping attrs always
# excluded: `topo` (upstream excludes its `wrapped` equivalent by name),
# `_loc` (None means identity — upstream's falsy-target guard would
# otherwise overwrite a placed location with the source's) and `_parent`.
_CS_COPY_ATTR_INTERNAL = ('topo', 'wrapped', '_loc', '_parent',
                          '_cs_pending_scope')


def _cs_copy_attributes_to(self, target, exceptions=None):
    import copy as _copy
    attrs = set(self.__dict__.keys()) & set(target.__dict__.keys())
    if exceptions is not None:
        attrs -= set(exceptions)
    attrs -= set(_CS_COPY_ATTR_INTERNAL)
    for attr in attrs:
        if attr == 'joints':
            if not getattr(target, attr):
                try:
                    target.joints = _copy.deepcopy(self.joints)
                except Exception:
                    target.joints = dict(self.joints)
            for joint in target.joints.values():
                joint.parent = target
        elif not getattr(target, attr):
            setattr(target, attr, getattr(self, attr))


if not hasattr(Shape, 'copy_attributes_to'):
    Shape.copy_attributes_to = _cs_copy_attributes_to


# Dev's objects_sketch.Text resolves its font up front via
# Compound.resolve_font(font, font_path, font_style) -> (name, path,
# Font_SystemFont). This build has no Font_FontMgr — lite's honest
# FontManager knows exactly the bundled FreeSans family (COMPROMISE(text)),
# and lite's make_text falls back to FreeSans for unknown names, so resolve
# the same way and return the face NAME in the Font_SystemFont slot.
def _cs_resolve_font(font='Arial', font_path=None, font_style=None):
    fm = _lt.FontManager()
    style = font_style if font_style is not None else _lt.FontStyle.REGULAR
    try:
        face = fm.find_font(font, style)
    except Exception:
        try:
            face = fm.find_font('FreeSans', style)
        except Exception:
            face = 'FreeSans'
    return (face, '', face)


if not hasattr(Compound, 'resolve_font'):
    Compound.resolve_font = staticmethod(_cs_resolve_font)


# Dev's BuildPart.pending_edges_as_wire chains the published pending edges
# with Wire.combine. Upstream's ConnectEdgesToWires connects through shared
# VERTEX TOLERANCES; lite's port compares raw endpoints against tol=1e-9,
# and a 1-D fillet arc endpoint sits ~1e-7 from the trimmed line end (well
# inside OCCT's Precision::Confusion), splitting the wire — sm_hanger's
# make_brake_formed then saw a 3-edge line. Chain at 1e-7 in upstream mode.
def _cs_wire_combine(cls, wires, tol=1e-9):
    edges = []
    for item in wires:
        if isinstance(item, _lt.Edge):
            edges.append(item)
        else:
            edges.extend(item.edges())
    return _lt.edges_to_wires(edges, max(tol, 1e-7))


Mixin1D.combine = classmethod(_cs_wire_combine)


# ---- upstream result-class semantics ---------------------------------------
# Upstream's Shape.moved/located and `loc * shape` PRESERVE the class (a moved
# Face is a Face); lite's algebra convention remaps operation results via its
# module-global _wrap_like (Face->Sketch, Edge->Curve, Vertex->Part). Upstream
# Level-A dispatches on the class AFTER transforms (add()'s isinstance(obj,
# Face) after obj.moved(rotation), pending-edge batching, solid extraction), so
# rebind _wrap_like (lite resolves the global at call time) to a
# class-preserving version at upstream boot. Default modes never load this.
_orig_wrap_like = _lt._wrap_like


def _cs_wrap_like(obj, topo):
    cls = type(obj) if isinstance(obj, _lt.Shape) else _lt.Part
    if cls is _lt.Vertex and not (
            topo is not None and hasattr(topo, 'ShapeType')
            and topo.ShapeType().value == 7):
        # an operation ON a vertex may not RETURN a vertex (e.g. a boolean's
        # compound) — fall back to the base wrapper for non-vertex results
        cls = _lt.Shape
    res = object.__new__(cls)
    _lt.Shape.__init__(res, topo)
    if isinstance(res, _lt.Mixin1D):
        res._specs = list(getattr(obj, '_specs', []) or [])
    if cls is _lt.Vertex:
        _p = _w._vertexPoint(topo)
        res.X, res.Y, res.Z = _p[0], _p[1], _p[2]
    return res


if _lt._wrap_like is _orig_wrap_like:
    _lt._wrap_like = _cs_wrap_like


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


# ---- S-sized method fills (upstream methods over lite's capabilities) ------
def _cs_edge_indices(target, edges):
    """Per-TARGET edge indices for FilletEdges/ChamferEdges. An edge selected
    through an intermediate shape (f.outer_wire().edges()) carries indices
    relative to THAT shape — remap geometrically onto the target's edges
    like lite's _edges_by_parent (same midpoint+length key)."""
    if not edges:
        raise ValueError('no edges given (use shape.edges() selectors)')
    keyed = None
    idxs = []
    for e in edges:
        if getattr(e, 'parent', None) is target and \
                getattr(e, 'index', None) is not None:
            i = e.index
        else:
            if keyed is None:
                keyed = {}
                for te in target.edges():
                    keyed[_lt._shape_key(te, 'edge')] = te.index
            i = keyed.get(_lt._shape_key(e, 'edge'))
            if i is None:
                raise ValueError('one of these edges is not an edge of the '
                                 'shape being filleted/chamfered')
        if i not in idxs:
            idxs.append(i)
    return idxs


def _shape_fillet_3d(self, radius, edge_list):
    """upstream Mixin3D.fillet(radius, edge_list) as a method on the seam
    Shape (lite exposes filleting as the module-level fillet(edges, r) over
    per-shape edge indices)."""
    idxs = _cs_edge_indices(self, [e for e in edge_list])
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
    idxs = _cs_edge_indices(self, [e for e in edge_list])
    return _lt._wrap_like(self, _w.ChamferEdges(_lt._topo(self), length, idxs))


if not hasattr(_lt.Shape, 'fillet'):
    _lt.Shape.fillet = _shape_fillet_3d
    _lt.Shape.chamfer = _shape_chamfer_3d


def _face_fillet_2d(self, radius, vertices):
    """upstream Face.fillet_2d(radius, vertices) over lite's
    BRepFilletAPI_MakeFillet2d binding. Dedupe by position: builder
    .vertices() yields each shared corner once per incident edge (lite keeps
    free-edge compounds), and filleting the same corner twice raises
    'BRep_API: command not done'."""
    pts = []
    for v in vertices:
        p = [v.X, v.Y, v.Z]
        if not any(abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2])
                   <= 1e-9 for q in pts):
            pts.append(p)
    return _lt.Face(_w.FilletFace2D(_lt._topo(self), radius, pts))


def _face_chamfer_2d(self, distance, distance2, vertices, edge=None):
    raise NotImplementedError(
        '2D vertex chamfers are not supported in build123d-lite')


def _wire_fillet_2d(self, radius, vertices):
    """upstream Wire/Edge.fillet_2d(radius, vertices) — 1-D corner fillets
    (ChFi2d_FilletAlgo in lite). Dedupe the vertices by POSITION first:
    upstream's Builder.vertices() dedups via set() + TopoDS same-ness, which
    only works when coincident endpoints were FUSED into one shared vertex;
    lite keeps builder lines as compounds of free edges, so each corner
    arrives twice (once per incident edge) and the second fillet of the same
    corner would fail after the first one trimmed it away."""
    uniq, seen = [], []
    for v in vertices:
        key = (round(v.X, 9), round(v.Y, 9), round(v.Z, 9))
        if key not in seen:
            seen.append(key)
            uniq.append(v)
    return _lt._wire_fillet_2d(self, uniq, radius)


if not hasattr(_lt.Face, 'fillet_2d'):
    _lt.Face.fillet_2d = _face_fillet_2d
    _lt.Face.chamfer_2d = _face_chamfer_2d
    _lt.Mixin1D.fillet_2d = _wire_fillet_2d


def _edge_make_tangent_arc(cls, start, tangent, end):
    """upstream Edge.make_tangent_arc (GC_MakeArcOfCircle's point/tangent/
    point form), computed analytically in the arc's own plane — lite's
    TangentArc object is XY-only, and upstream localizes the points BEFORE
    calling this. The circle is realized as an exact three-point arc
    (start, mid-sweep, end), which also fixes the traversal direction."""
    import math
    p1 = Vector(start)
    p3 = Vector(end)
    t = Vector(tangent).normalized()
    d = p3 - p1
    n = t.cross(d)
    if n.length < 1e-12:
        # tangent aligned with the chord: the arc degenerates to a line
        return _lt.Edge.make_line(tuple(p1), tuple(p3))
    u = t
    v = n.normalized().cross(t)   # in-plane normal; d.dot(v) > 0 by triple product
    du = d.dot(u)
    dv = d.dot(v)
    r = (du * du + dv * dv) / (2.0 * dv)   # always > 0 in this basis
    c = p1 + v * r
    phi1 = math.atan2((p1 - c).dot(v), (p1 - c).dot(u))
    phi3 = math.atan2((p3 - c).dot(v), (p3 - c).dot(u))
    sweep = (phi3 - phi1) % (2.0 * math.pi)
    mid_phi = phi1 + sweep / 2.0
    mid = c + (u * math.cos(mid_phi) + v * math.sin(mid_phi)) * abs(r)
    return _lt.Edge.make_three_point_arc(tuple(p1), tuple(mid), tuple(p3))


if not hasattr(_lt.Edge, 'make_tangent_arc'):
    _lt.Edge.make_tangent_arc = classmethod(_edge_make_tangent_arc)


# ---- Edge.make_* kernel primitives upstream objects_curve dispatches to ----
# Each delegates to lite's validated 1-D constructor (mode=PRIVATE, so no
# builder bookkeeping happens here — upstream's BaseLineObject does that) and
# unwraps the single resulting edge. Points/planes arrive GLOBAL (upstream
# localizes before calling), so plane-parameterized forms build the XY-local
# curve and rigidly place it by plane.location (lite transforms segment specs
# along with the geometry).

def _one_edge_placed(curve, plane):
    if plane is not None:
        curve = plane.location * curve
    return _lt._single_edge_of(curve)


def _edge_make_bezier(cls, *cntl_pnts, weights=None):
    return _lt._single_edge_of(
        _lt.Bezier(*[tuple(Vector(p)) for p in cntl_pnts], weights=weights,
                   mode=_lt.Mode.PRIVATE))


def _edge_make_bspline(cls, control_points, knots=None, degree=None,
                       weights=None, periodic=False):
    return _lt._single_edge_of(
        _lt.BSpline([tuple(Vector(p)) for p in control_points], knots, degree,
                    weights=weights, periodic=periodic, mode=_lt.Mode.PRIVATE))


def _edge_make_helix(cls, pitch, height, radius, center=(0, 0, 0),
                     direction=(0, 0, 1), cone_angle=0, lefthand=False):
    return _lt._single_edge_of(
        _lt.Helix(pitch, height, radius, center=tuple(Vector(center)),
                  direction=tuple(Vector(direction)), cone_angle=cone_angle,
                  lefthand=lefthand, mode=_lt.Mode.PRIVATE))


def _cs_is_clockwise(angular_direction):
    return getattr(angular_direction, 'name', None) == 'CLOCKWISE' or \
        angular_direction == _lt.AngularDirection.CLOCKWISE


def _edge_make_ellipse(cls, x_radius, y_radius, plane=None, start_angle=0.0,
                       end_angle=360.0, angular_direction=None):
    """upstream Edge.make_ellipse: an elliptical arc ON the given plane from
    start_angle to end_angle in the given angular direction. A CLOCKWISE arc
    is the CCW arc over the same span traversed backwards (same gp_Elips,
    reversed orientation — what GC_MakeArcOfEllipse's sense=False does)."""
    cw = angular_direction is not None and _cs_is_clockwise(angular_direction)
    a0, a1 = (end_angle, start_angle) if cw else (start_angle, end_angle)
    sweep = (a1 - a0) % 360.0
    if sweep == 0.0:
        sweep = 360.0
    arc = _lt.EllipticalCenterArc((0, 0, 0), x_radius, y_radius,
                                  start_angle=a0, arc_size=sweep,
                                  mode=_lt.Mode.PRIVATE)
    edge = _one_edge_placed(arc, plane)
    return _lt._reverse_1d(edge) if cw else edge


def _edge_make_parabola(cls, focal_length, plane=None, start_angle=0.0,
                        end_angle=180.0, angular_direction=None):
    ad = angular_direction if angular_direction is not None \
        else _lt.AngularDirection.COUNTER_CLOCKWISE
    if _cs_is_clockwise(ad):
        ad = _lt.AngularDirection.CLOCKWISE
    arc = _lt.ParabolicCenterArc((0, 0, 0), focal_length,
                                 start_angle=start_angle, end_angle=end_angle,
                                 angular_direction=ad, mode=_lt.Mode.PRIVATE)
    return _one_edge_placed(arc, plane)


def _edge_make_hyperbola(cls, x_radius, y_radius, plane=None, start_angle=0.0,
                         end_angle=90.0, angular_direction=None):
    ad = angular_direction if angular_direction is not None \
        else _lt.AngularDirection.COUNTER_CLOCKWISE
    if _cs_is_clockwise(ad):
        ad = _lt.AngularDirection.CLOCKWISE
    arc = _lt.HyperbolicCenterArc((0, 0, 0), x_radius, y_radius,
                                  start_angle=start_angle,
                                  end_angle=end_angle, angular_direction=ad,
                                  mode=_lt.Mode.PRIVATE)
    return _one_edge_placed(arc, plane)


def _cs_lite_tangency_args(args):
    """Translate the shim's Tangency MEMBERS in (entity, qualifier) tuples to
    lite's string values — the kernel helper reads the qualifier by VALUE, so
    an untranslated member silently solved UNQUALIFIED (wrong/extra
    candidates: b13's egg_plant)."""
    out = []
    for a in args:
        if isinstance(a, tuple) and len(a) == 2 and \
                not isinstance(a[0], (int, float)):
            nm = getattr(a[1], 'name', None)
            if nm is not None:
                a = (a[0], getattr(_lt.Tangency, nm, a[1]))
        out.append(a)
    return out


def _edge_make_constrained_arcs(cls, *args, radius=None, center=None,
                                center_on=None, sagitta=None):
    sag = sagitta if sagitta is not None else _lt.Sagitta.SHORT
    sn = getattr(sag, 'name', None)
    if sn is not None:
        sag = getattr(_lt.Sagitta, sn, sag)
    topos = _lt._constrained_arc_topos(_cs_lite_tangency_args(args),
                                       radius=radius,
                                       center=center, center_on=center_on,
                                       sagitta=sag)
    return ShapeList([_lt.Edge(t) for t in topos])


def _edge_make_constrained_lines(cls, *args, angle=None, direction=None):
    topos = _lt._constrained_line_topos(_cs_lite_tangency_args(args),
                                        angle=angle, direction=direction)
    return ShapeList([_lt.Edge(t) for t in topos])


if not hasattr(_lt.Edge, 'make_bezier'):
    _lt.Edge.make_bezier = classmethod(_edge_make_bezier)
    _lt.Edge.make_bspline = classmethod(_edge_make_bspline)
    _lt.Edge.make_helix = classmethod(_edge_make_helix)
    _lt.Edge.make_ellipse = classmethod(_edge_make_ellipse)
    _lt.Edge.make_parabola = classmethod(_edge_make_parabola)
    _lt.Edge.make_hyperbola = classmethod(_edge_make_hyperbola)
    _lt.Edge.make_constrained_arcs = classmethod(_edge_make_constrained_arcs)
    _lt.Edge.make_constrained_lines = classmethod(_edge_make_constrained_lines)


def _wire_make_ellipse(cls, x_radius, y_radius, plane=None, start_angle=0.0,
                       end_angle=360.0, angular_direction=None, closed=True):
    """upstream Wire.make_ellipse (objects_sketch.Ellipse builds its face
    from the full elliptical WIRE)."""
    e = _edge_make_ellipse(_lt.Edge, x_radius, y_radius, plane, start_angle,
                           end_angle, angular_direction)
    return cls([e])


def _wire_make_convex_hull(cls, edges, tolerance=1e-3):
    """upstream Wire.make_convex_hull over lite's validated make_hull port
    (which returns the hull FACE; the outer wire is the hull)."""
    hull = _lt.make_hull(list(edges), tolerance=tolerance,
                         mode=_lt.Mode.PRIVATE)
    return hull.faces()[0].outer_wire()


if not hasattr(_lt.Wire, 'make_ellipse'):
    _lt.Wire.make_ellipse = classmethod(_wire_make_ellipse)
    _lt.Wire.make_convex_hull = classmethod(_wire_make_convex_hull)


def _cs_vertex_xyz(other):
    if isinstance(other, _lt.Vertex):
        return other.X, other.Y, other.Z
    v = Vector(other)
    return v.X, v.Y, v.Z


def _vertex_add(self, other):
    """upstream Vertex.__add__: POINT arithmetic (lite's Shape.__add__ is the
    boolean fuse, which silently built garbage for make_brake_formed's
    `vertex - other` distance checks)."""
    ox, oy, oz = _cs_vertex_xyz(other)
    return _lt.Vertex(self.X + ox, self.Y + oy, self.Z + oz)


def _vertex_sub(self, other):
    """upstream Vertex.__sub__ (point arithmetic)."""
    ox, oy, oz = _cs_vertex_xyz(other)
    return _lt.Vertex(self.X - ox, self.Y - oy, self.Z - oz)


# (positional Vertex __eq__/__hash__ live IN lite's Vertex class body —
#  monkeypatched dunders take a degraded path in MicroPython's set probing)
if _lt.Vertex.__sub__ is _lt.Shape.__sub__:
    _lt.Vertex.__add__ = _vertex_add
    _lt.Vertex.__sub__ = _vertex_sub


def _curve_wires(self):
    """upstream Curve.wires(): 'a list of wires created from the edges' —
    a Curve is a compound of FREE edges (no TopoDS wires inside), so chain
    them with Wire.combine (lite already has it on Mixin1D).
    Builder.wires()/fillet's target.wires()[0] depend on this."""
    return _lt.Wire.combine(self.edges())


if _lt.Curve.wires is _lt.Shape.wires:
    _lt.Curve.wires = _curve_wires


def _shape_split(self, tool, keep=None):
    """upstream Mixin3D/Mixin2D.split(plane, keep) as a METHOD, over lite's
    module-level split() (Edge keeps its own split override). Keep.BOTH stays
    lite's honest NotImplementedError."""
    k = keep if keep is not None else _lt.Keep.TOP
    kn = getattr(k, 'name', None)
    if kn is not None:
        k = getattr(_lt.Keep, kn, k)
    return _lt.split(self, bisect_by=tool, keep=k, mode=_lt.Mode.PRIVATE)


if not hasattr(_lt.Shape, 'split'):
    _lt.Shape.split = _shape_split


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
    s = cls(_w.Box(length, width, height, False))
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
    s = cls(_w.Cone(base_radius, top_radius, height))
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
    s = cls(_w.Revolve(prof, 360, [0, 0, 1]))
    if plane is not None:
        s = plane.location * s
    return s


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
        return cls(_w.TaperExtrude(_lt._topo(profile), amount, taper))
    offset_amt = -abs(amount) * math.tan(math.radians(taper))
    shift = _lt.Pos(dvec.X, dvec.Y, dvec.Z)
    solids = []
    for i, wire in enumerate([profile.outer_wire()] + list(inner)):
        flip = (-1.0 if flip_inner else 1.0) if i > 0 else 1.0
        local = base.location.inverse() * wire
        local_taper = _lt.Curve(_lt._topo(local)).offset_2d(
            flip * offset_amt, kind=_lt.Kind.INTERSECTION)
        taper_wire = shift * (base.location * _lt.Curve(_lt._topo(local_taper)))
        solids.append(cls(_w.Loft([_lt._topo(wire),
                                   _lt._topo(taper_wire)], False)))
    solid = solids[0] if len(solids) == 1 else (solids[0] - solids[1:])
    return cls(_lt._topo(solid))


def _cs_path_wire_topo(path):
    """ONE chained TopoDS_Wire from a path Curve/Wire/Edge (lite sweep's
    exact logic: multi-segment curves rebuild through their specs because
    their topo may be a compound of separate wires)."""
    if isinstance(path, _lt.Mixin1D) and getattr(path, '_specs', None):
        return _w.WireFromSegments(_lt._chain_segments(path._specs))
    t = _lt._topo(path)
    if hasattr(t, 'ShapeType') and t.ShapeType().value == 6:
        # a bare EDGE path (dev make_brake_formed sweeps per line edge):
        # GetWire refuses edges, so assemble the one-edge wire directly
        return _w.WireFromEdgesFixed([t], 1e-7)
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
    return cls(solid)


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
    return cls(solid)


def _solid_offset_3d(self, openings, thickness, tolerance=0.0001,
                     kind=None):
    """upstream Solid.offset_3d over lite's MakeThickSolid binding."""
    faces = [_lt._topo(o) for o in (openings or [])]
    return _lt.Part(_w.ThickSolidOffset(_lt._topo(self), faces, thickness,
                                        tolerance))


def _shape_fix(self):
    """upstream Shape.fix (ShapeFix_Shape): lite's JS ops fix internally."""
    return self


def _shape_clean(self):
    """upstream Shape.clean (ShapeUpgrade_UnifySameDomain). Lite's own ops
    unify internally so lite's clean() is the identity, but upstream's
    builders RELY on clean() merging the seam edges a mirrored profile
    leaves behind (a later 2-D fillet on the un-merged corner raises
    'BRep_API: command not done' — ppp0106)."""
    if self.topo is None:
        return self
    try:
        return _lt._wrap_like(self, _w.UnifyWire(self.topo, False))
    except Exception:
        return self  # the known UnifySameDomain kernel raise: keep unmerged


if _lt.Shape.clean(_lt.Shape) is _lt.Shape:  # lite's clean is the identity
    _lt.Shape.clean = _shape_clean


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


def _solid_make_wedge(cls, delta_x, delta_y, delta_z, min_x, min_z, max_x,
                      max_z, plane=None):
    """upstream Solid.make_wedge (BRepPrimAPI_MakeWedge's min/max form) over
    lite's WedgeMinMax binding."""
    s = cls(_w.WedgeMinMax(delta_x, delta_y, delta_z, min_x, min_z, max_x,
                           max_z))
    if plane is not None:
        s = plane.location * s
    return s


def _mixin1d_positions(self, distances=None, position_mode=None,
                       deflection=None):
    """upstream Mixin1D.positions: points along the curve at the given
    normalized parameters (PositionMode.PARAMETER, the default) or absolute
    arc lengths (PositionMode.LENGTH)."""
    if deflection is not None:
        raise NotImplementedError(
            'positions(deflection=) is not supported in build123d-lite')
    dists = list(distances or [])
    if getattr(position_mode, 'name', 'PARAMETER') == 'LENGTH':
        ln = self.length
        dists = [d / ln for d in dists]
    return [self.position_at(d) for d in dists]


_orig_reversed = _lt.Mixin1D.reversed


def _cs_reversed(self, reconstruct=False):
    """upstream Edge.reversed(reconstruct=): lite's orientation flip IS
    parametrization-reversing for position_at/trim (lite's 1-D evaluators are
    orientation-aware), so reconstruct needs no separate rebuild here."""
    return _orig_reversed(self)


if not hasattr(_lt.Mixin1D, 'positions'):
    _lt.Mixin1D.positions = _mixin1d_positions
    _lt.Mixin1D.reversed = _cs_reversed


# lite's Location 3-arg form dispatches on a STRING Euler-ordering (lite's
# Intrinsic/Extrinsic values); upstream user code passes the shim's enum
# MEMBERS (Location(p, angles, Intrinsic.YXZ)) which lite would treat as an
# axis-angle ANGLE. Translate members to lite's values up front.
_orig_location_init = Location.__init__


def _cs_location_init(self, *args):
    if len(args) == 3 and isinstance(args[2], _enum_shim._Member):
        args = (args[0], args[1], _cs_enum_to_lite(args[2]))
    _orig_location_init(self, *args)


if Location.__init__ is _orig_location_init:
    Location.__init__ = _cs_location_init


if not hasattr(_lt.Solid, 'make_box'):
    _lt.Solid.make_box = classmethod(_solid_make_box)
    _lt.Solid.make_wedge = classmethod(_solid_make_wedge)
    _lt.Solid.extrude_until = classmethod(_solid_extrude_until)
    _lt.Solid.sweep = classmethod(_solid_sweep)
    _lt.Solid.sweep_multi = classmethod(_solid_sweep_multi)
    _lt.Solid.make_cone = classmethod(_solid_make_cone)
    _lt.Solid.make_torus = classmethod(_solid_make_torus)
    _lt.Solid.extrude_taper = classmethod(_solid_extrude_taper)
