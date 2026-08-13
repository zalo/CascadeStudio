// Build123dLite.js - the "build123d-lite" Python library source (cascade-core)
//
// A subset of build123d (https://build123d.readthedocs.io) implemented on top
// of the CascadeStudio standard library that the CAD worker exposes on `self`
// (Box, Union, WireFromSegments, MeasureShape, ...). PythonRuntime.js
// registers this source as the importable Brython module `build123d`, so user
// scripts start with `from build123d import *`. Both ALGEBRA mode
// (Pos(...) * Box(...) - Cylinder(...)) and BUILDER mode
// (with BuildPart() as bp: ...) are supported; builders are plain context
// managers over a module-level stack (no inspect.currentframe tricks needed —
// we own this implementation).
//
// The source is embedded as a JS template string (rather than a .py asset
// copied to dist) so the worker bundle needs no extra fetch or dev/build
// dual-path handling beyond brython.js itself, and so the library is always
// version-locked to the worker code that consumes it.
// IMPORTANT: the Python source must contain no backticks and no "${".
//
// Honest-subset notes (differences from real build123d) — verified against
// build123d 0.11.1 via test/b123d-validation:
//  * Rotation(x,y,z) is intrinsic-XYZ (matrix Rx*Ry*Rz), matching build123d.
//  * align= offsets are computed from the object's own bounding box (mesh
//    approximated for non-analytic shapes), like build123d.
//  * Spline() APPROXIMATES through points (GeomAPI_PointsToBSpline, 1e-3
//    tolerance) instead of interpolating exactly; tangents= is rejected.
//  * Unsupported (raise NotImplementedError rather than fake geometry):
//    Text (font metrics differ), joints, extrude(until=...), taper,
//    thicken/project/make_hull, partial spheres, Wedge, Ellipse,
//    offset(openings=...), split(keep=Keep.BOTH), non-uniform scale.
//  * Boolean results are cleaned with ShapeUpgrade_UnifySameDomain (the
//    standard library always does); face/edge COUNTS can therefore differ
//    from build123d even when the geometry (volume/bbox) matches.

export const BUILD123D_LITE_PY = `
# build123d-lite: a subset of build123d (algebra + builder mode) for
# CascadeStudio. Runs under Brython inside the CAD worker; every CAD op
# delegates to the CascadeStudio standard library exposed as JS globals.
# Those JS functions own all sceneShapes bookkeeping.
from browser import self as w
import math

MM = 1.0
CM = 10.0
M = 1000.0
IN = 25.4
FT = 304.8
THOU = 0.0254

_TOL = 1e-9


# ---------------------------------------------------------------- enums ---

class Mode:
    ADD = 'ADD'
    SUBTRACT = 'SUBTRACT'
    INTERSECT = 'INTERSECT'
    REPLACE = 'REPLACE'
    PRIVATE = 'PRIVATE'


class Align:
    MIN = 'MIN'
    CENTER = 'CENTER'
    MAX = 'MAX'
    NONE = None


class Keep:
    TOP = 'TOP'
    BOTTOM = 'BOTTOM'
    BOTH = 'BOTH'
    ALL = 'ALL'
    INSIDE = 'INSIDE'
    OUTSIDE = 'OUTSIDE'


class Until:
    NEXT = 'NEXT'
    LAST = 'LAST'
    PREVIOUS = 'PREVIOUS'
    FIRST = 'FIRST'


class Kind:
    ARC = 'ARC'
    INTERSECTION = 'INTERSECTION'
    TANGENT = 'TANGENT'


class Select:
    ALL = 'ALL'
    LAST = 'LAST'
    NEW = 'NEW'


class CenterOf:
    GEOMETRY = 'GEOMETRY'
    MASS = 'MASS'
    BOUNDING_BOX = 'BOUNDING_BOX'


class Transition:
    TRANSFORMED = 'TRANSFORMED'
    ROUND = 'ROUND'
    RIGHT = 'RIGHT'


class Side:
    LEFT = 'LEFT'
    RIGHT = 'RIGHT'
    BOTH = 'BOTH'


class SortBy:
    LENGTH = 'LENGTH'
    AREA = 'AREA'
    VOLUME = 'VOLUME'
    RADIUS = 'RADIUS'
    DISTANCE = 'DISTANCE'


class GeomType:
    # values are the strings the worker's introspection helpers return
    LINE = ('Line',)
    CIRCLE = ('Circle',)
    ELLIPSE = ('Ellipse',)
    HYPERBOLA = ('Hyperbola',)
    PARABOLA = ('Parabola',)
    BEZIER = ('BezierCurve', 'BezierSurface')
    BSPLINE = ('BSplineCurve', 'BSplineSurface')
    PLANE = ('Plane',)
    CYLINDER = ('Cylinder',)
    CONE = ('Cone',)
    SPHERE = ('Sphere',)
    TORUS = ('Torus',)
    OTHER = ('Other',)


class FontStyle:
    REGULAR = 'REGULAR'
    BOLD = 'BOLD'
    ITALIC = 'ITALIC'
    BOLDITALIC = 'BOLDITALIC'


# -------------------------------------------------------- vector algebra ---

def _num(x):
    return float(x)


class Vector:
    """3D vector with build123d-style .X/.Y/.Z properties."""

    def __init__(self, *args):
        if len(args) == 0:
            self._v = (0.0, 0.0, 0.0)
        elif len(args) == 1:
            a = args[0]
            if isinstance(a, Vector):
                self._v = a._v
            else:
                t = tuple(a)
                if len(t) == 2:
                    self._v = (_num(t[0]), _num(t[1]), 0.0)
                else:
                    self._v = (_num(t[0]), _num(t[1]), _num(t[2]))
        elif len(args) == 2:
            self._v = (_num(args[0]), _num(args[1]), 0.0)
        else:
            self._v = (_num(args[0]), _num(args[1]), _num(args[2]))

    @property
    def X(self):
        return self._v[0]

    @property
    def Y(self):
        return self._v[1]

    @property
    def Z(self):
        return self._v[2]

    def __iter__(self):
        return iter(self._v)

    def __getitem__(self, i):
        return self._v[i]

    def __len__(self):
        return 3

    def __add__(self, o):
        o = Vector(o)
        return Vector(self._v[0] + o._v[0], self._v[1] + o._v[1], self._v[2] + o._v[2])

    __radd__ = __add__

    def __sub__(self, o):
        o = Vector(o)
        return Vector(self._v[0] - o._v[0], self._v[1] - o._v[1], self._v[2] - o._v[2])

    def __rsub__(self, o):
        return Vector(o).__sub__(self)

    def __neg__(self):
        return Vector(-self._v[0], -self._v[1], -self._v[2])

    def __mul__(self, s):
        s = _num(s)
        return Vector(self._v[0] * s, self._v[1] * s, self._v[2] * s)

    __rmul__ = __mul__

    def __truediv__(self, s):
        s = _num(s)
        return Vector(self._v[0] / s, self._v[1] / s, self._v[2] / s)

    def __eq__(self, o):
        try:
            o = Vector(o)
        except Exception:
            return NotImplemented
        return (abs(self._v[0] - o._v[0]) < 1e-12 and
                abs(self._v[1] - o._v[1]) < 1e-12 and
                abs(self._v[2] - o._v[2]) < 1e-12)

    def dot(self, o):
        o = Vector(o)
        return (self._v[0] * o._v[0] + self._v[1] * o._v[1] + self._v[2] * o._v[2])

    def cross(self, o):
        o = Vector(o)
        a, b = self._v, o._v
        return Vector(a[1] * b[2] - a[2] * b[1],
                      a[2] * b[0] - a[0] * b[2],
                      a[0] * b[1] - a[1] * b[0])

    @property
    def length(self):
        return math.sqrt(self.dot(self))

    def normalized(self):
        ln = self.length
        if ln < 1e-14:
            raise ValueError('cannot normalize a zero-length Vector')
        return self / ln

    def reverse(self):
        return -self

    def to_tuple(self):
        return self._v

    def __repr__(self):
        return 'Vector' + repr(self._v)


def _v3(a):
    """Coerce anything point-like to a plain 3-tuple of floats."""
    if isinstance(a, Vector):
        return a._v
    t = tuple(a)
    if len(t) == 2:
        return (_num(t[0]), _num(t[1]), 0.0)
    return (_num(t[0]), _num(t[1]), _num(t[2]))


# 3x3 matrices as tuples of row-tuples
_MAT_I = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def _mat_mul(A, B):
    return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3))
                       for j in range(3)) for i in range(3))


def _mat_vec(A, v):
    return tuple(A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]
                 for i in range(3))


def _mat_is_identity(A):
    for i in range(3):
        for j in range(3):
            if abs(A[i][j] - (1.0 if i == j else 0.0)) > 1e-12:
                return False
    return True


def _rot_mat(rx, ry, rz):
    """Intrinsic-XYZ rotation matrix Rx*Ry*Rz (matches build123d Rotation)."""
    cx, sx = math.cos(math.radians(rx)), math.sin(math.radians(rx))
    cy, sy = math.cos(math.radians(ry)), math.sin(math.radians(ry))
    cz, sz = math.cos(math.radians(rz)), math.sin(math.radians(rz))
    Rx = ((1.0, 0.0, 0.0), (0.0, cx, -sx), (0.0, sx, cx))
    Ry = ((cy, 0.0, sy), (0.0, 1.0, 0.0), (-sy, 0.0, cy))
    Rz = ((cz, -sz, 0.0), (sz, cz, 0.0), (0.0, 0.0, 1.0))
    return _mat_mul(_mat_mul(Rx, Ry), Rz)


def _axis_angle_mat(axis, degrees):
    """Rotation matrix from axis + angle (Rodrigues)."""
    x, y, z = Vector(axis).normalized()
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    C = 1.0 - c
    return ((c + x * x * C, x * y * C - z * s, x * z * C + y * s),
            (y * x * C + z * s, c + y * y * C, y * z * C - x * s),
            (z * x * C - y * s, z * y * C + x * s, c + z * z * C))


def _mat_axis_angle(R):
    """Rotation matrix -> (axis list, angle degrees); robust near 0 and 180."""
    tr = R[0][0] + R[1][1] + R[2][2]
    c = max(-1.0, min(1.0, (tr - 1.0) / 2.0))
    angle = math.acos(c)
    if angle < 1e-10:
        return [0.0, 0.0, 1.0], 0.0
    if abs(angle - math.pi) < 1e-7:
        # axis from the largest diagonal element of (R + I) / 2
        xx = (R[0][0] + 1.0) / 2.0
        yy = (R[1][1] + 1.0) / 2.0
        zz = (R[2][2] + 1.0) / 2.0
        if xx >= yy and xx >= zz:
            x = math.sqrt(max(xx, 0.0))
            axis = [x, R[0][1] / (2.0 * x), R[0][2] / (2.0 * x)]
        elif yy >= zz:
            y = math.sqrt(max(yy, 0.0))
            axis = [R[0][1] / (2.0 * y), y, R[1][2] / (2.0 * y)]
        else:
            z = math.sqrt(max(zz, 0.0))
            axis = [R[0][2] / (2.0 * z), R[1][2] / (2.0 * z), z]
        return axis, 180.0
    s = 2.0 * math.sin(angle)
    axis = [(R[2][1] - R[1][2]) / s,
            (R[0][2] - R[2][0]) / s,
            (R[1][0] - R[0][1]) / s]
    return axis, math.degrees(angle)


# ------------------------------------------------------------- Location ---

class Location:
    """Rigid placement: rotation matrix + translation. Composes with *.
    Right operand applies first: (Pos(0,0,5) * Rot(Z=45)) * shape rotates,
    then translates — like build123d."""

    def __init__(self, *args):
        self._R = _MAT_I
        self._t = (0.0, 0.0, 0.0)
        if len(args) == 0:
            return
        if len(args) == 1:
            a = args[0]
            if isinstance(a, Location):
                self._R, self._t = a._R, a._t
            elif isinstance(a, Plane):
                loc = a.location
                self._R, self._t = loc._R, loc._t
            else:
                self._t = _v3(a)
        elif len(args) == 2:
            self._t = _v3(args[0])
            r = args[1]
            if isinstance(r, (int, float)):
                self._R = _rot_mat(0.0, 0.0, r)
            else:
                r = _v3(r)
                self._R = _rot_mat(r[0], r[1], r[2])
        elif len(args) == 3:
            # Location(position, rotation_axis, angle_degrees)
            self._t = _v3(args[0])
            self._R = _axis_angle_mat(args[1], args[2])
        else:
            raise TypeError('Location: unsupported arguments')

    @classmethod
    def _make(cls, R, t):
        loc = cls.__new__(cls)
        loc._R = R
        loc._t = tuple(t)
        return loc

    @property
    def position(self):
        return Vector(self._t)

    @property
    def orientation(self):
        # Euler intrinsic-XYZ extraction (inverse of _rot_mat)
        R = self._R
        sy = R[0][2]
        sy = max(-1.0, min(1.0, sy))
        ry = math.asin(sy)
        if abs(abs(sy) - 1.0) > 1e-9:
            rx = math.atan2(-R[1][2], R[2][2])
            rz = math.atan2(-R[0][1], R[0][0])
        else:
            rx = math.atan2(R[1][0], R[1][1])
            rz = 0.0
        return Vector(math.degrees(rx), math.degrees(ry), math.degrees(rz))

    def inverse(self):
        Rt = tuple(tuple(self._R[j][i] for j in range(3)) for i in range(3))
        t = _mat_vec(Rt, self._t)
        return Location._make(Rt, (-t[0], -t[1], -t[2]))

    def _transform_point(self, p):
        q = _mat_vec(self._R, _v3(p))
        return (q[0] + self._t[0], q[1] + self._t[1], q[2] + self._t[2])

    def _apply_topo(self, topo):
        if not _mat_is_identity(self._R):
            axis, angle = _mat_axis_angle(self._R)
            if angle != 0.0:
                topo = w.Rotate(axis, angle, topo)
        if abs(self._t[0]) > _TOL or abs(self._t[1]) > _TOL or abs(self._t[2]) > _TOL:
            topo = w.Translate([self._t[0], self._t[1], self._t[2]], topo)
        return topo

    def __mul__(self, other):
        if isinstance(other, Location):
            R = _mat_mul(self._R, other._R)
            t0 = _mat_vec(self._R, other._t)
            return Location._make(R, (t0[0] + self._t[0], t0[1] + self._t[1],
                                      t0[2] + self._t[2]))
        if isinstance(other, Plane):
            return Plane._from_location(Location(self) * other.location)
        if isinstance(other, Shape):
            if other.topo is None:
                return other
            moved = _wrap_like(other, self._apply_topo(other.topo))
            if isinstance(moved, Curve) and moved._specs:
                # keep segment data consistent with the moved geometry so
                # make_face()/sweep() can still chain the result exactly
                fn_dir = lambda d: _mat_vec(self._R, d)
                moved._specs = [_seg_transform(s, self._transform_point, fn_dir)
                                for s in moved._specs]
            return moved
        if isinstance(other, (list, tuple, ShapeList)):
            return ShapeList([self * s for s in other])
        return NotImplemented

    def __repr__(self):
        return ('Location(t=' + repr(self._t) + ', R=' + repr(self._R) + ')')


class Pos(Location):
    def __init__(self, *args, **kwargs):
        if kwargs:
            x = kwargs.get('X', args[0] if len(args) > 0 else 0.0)
            y = kwargs.get('Y', args[1] if len(args) > 1 else 0.0)
            z = kwargs.get('Z', args[2] if len(args) > 2 else 0.0)
            Location.__init__(self, (x, y, z))
        elif len(args) == 1 and not isinstance(args[0], (int, float)):
            Location.__init__(self, args[0])
        else:
            x = args[0] if len(args) > 0 else 0.0
            y = args[1] if len(args) > 1 else 0.0
            z = args[2] if len(args) > 2 else 0.0
            Location.__init__(self, (x, y, z))


class Rotation(Location):
    def __init__(self, X=0, Y=0, Z=0, **kwargs):
        if len(kwargs) > 0:
            X = kwargs.get('X', X)
            Y = kwargs.get('Y', Y)
            Z = kwargs.get('Z', Z)
        Location.__init__(self)
        self._R = _rot_mat(X, Y, Z)


Rot = Rotation


# ----------------------------------------------------------------- Axis ---

class Axis:
    def __init__(self, origin=(0, 0, 0), direction=(0, 0, 1)):
        self.position = Vector(origin)
        self.direction = Vector(direction).normalized()

    @property
    def origin(self):
        return self.position

    def __neg__(self):
        return Axis(self.position, -self.direction)

    def reverse(self):
        return -self

    def __repr__(self):
        return ('Axis(' + repr(tuple(self.position)) + ', ' +
                repr(tuple(self.direction)) + ')')


Axis.X = Axis((0, 0, 0), (1, 0, 0))
Axis.Y = Axis((0, 0, 0), (0, 1, 0))
Axis.Z = Axis((0, 0, 0), (0, 0, 1))


# ---------------------------------------------------------------- Plane ---

def _default_x_dir(z):
    """OCCT gp_Ax2's deterministic X direction for a normal (build123d uses
    gp_Ax3, same rule)."""
    a, b, c = z
    aa, bb, cc = abs(a), abs(b), abs(c)
    if bb <= aa and bb <= cc:
        if aa > cc:
            x = (-c, 0.0, a)
        else:
            x = (c, 0.0, -a)
    elif aa <= bb and aa <= cc:
        if bb > cc:
            x = (0.0, -c, b)
        else:
            x = (0.0, c, -b)
    else:
        if aa > bb:
            x = (-b, a, 0.0)
        else:
            x = (b, -a, 0.0)
    ln = math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2])
    return (x[0] / ln, x[1] / ln, x[2] / ln)


class Plane:
    def __init__(self, origin=(0, 0, 0), x_dir=None, z_dir=(0, 0, 1)):
        if isinstance(origin, Plane):
            p = origin
            self.origin = p.origin
            self.x_dir, self.y_dir, self.z_dir = p.x_dir, p.y_dir, p.z_dir
            return
        if isinstance(origin, Location):
            loc = origin
            R = loc._R
            self.origin = Vector(loc._t)
            self.x_dir = Vector(R[0][0], R[1][0], R[2][0])
            self.y_dir = Vector(R[0][1], R[1][1], R[2][1])
            self.z_dir = Vector(R[0][2], R[1][2], R[2][2])
            return
        if isinstance(origin, Face):
            face = origin
            n = w._faceNormal(face.topo)
            c = w._faceCentroid(face.topo)
            self.origin = Vector(c[0], c[1], c[2])
            self.z_dir = Vector(n[0], n[1], n[2]).normalized()
            # build123d derives x_dir from the face's UV axes
            u = w._faceUDir(face.topo)
            if u is not None:
                self.x_dir = Vector(tuple(u)).normalized()
            else:
                self.x_dir = Vector(_default_x_dir(tuple(self.z_dir)))
            self.y_dir = self.z_dir.cross(self.x_dir)
            return
        self.origin = Vector(origin)
        self.z_dir = Vector(z_dir).normalized()
        if x_dir is None:
            self.x_dir = Vector(_default_x_dir(tuple(self.z_dir)))
        else:
            self.x_dir = Vector(x_dir).normalized()
        self.y_dir = self.z_dir.cross(self.x_dir)

    @classmethod
    def _from_location(cls, loc):
        return cls(loc)

    @property
    def location(self):
        x, y, z = tuple(self.x_dir), tuple(self.y_dir), tuple(self.z_dir)
        R = ((x[0], y[0], z[0]), (x[1], y[1], z[1]), (x[2], y[2], z[2]))
        return Location._make(R, tuple(self.origin))

    def offset(self, amount):
        return Plane(self.origin + self.z_dir * amount, self.x_dir, self.z_dir)

    def rotated(self, rotation=(0, 0, 0)):
        """Plane with axes rotated (intrinsic XYZ, degrees) in the GLOBAL
        frame about the plane origin — matches build123d."""
        r = _v3(rotation)
        R = _rot_mat(r[0], r[1], r[2])
        return Plane(self.origin,
                     Vector(_mat_vec(R, tuple(self.x_dir))),
                     Vector(_mat_vec(R, tuple(self.z_dir))))

    def shift_origin(self, new_origin):
        return Plane(Vector(new_origin), self.x_dir, self.z_dir)

    def __mul__(self, other):
        if isinstance(other, Location):
            return self.location * other
        return self.location * other

    def __neg__(self):
        return Plane(self.origin, self.x_dir, -self.z_dir)

    def __repr__(self):
        return ('Plane(o=' + repr(tuple(self.origin)) + ', x=' +
                repr(tuple(self.x_dir)) + ', z=' + repr(tuple(self.z_dir)) + ')')


# (Plane.XY etc. are assigned after the shape classes exist — Plane.__init__
#  dispatches on Face, which is defined below.)


# --------------------------------------------------------------- shapes ---

def _topo(obj):
    """Unwrap a Shape (or accept a raw TopoDS shape) to the JS shape object."""
    if isinstance(obj, Shape):
        if obj.topo is None:
            raise ValueError('this ' + type(obj).__name__ + ' is empty')
        return obj.topo
    if hasattr(obj, 'ShapeType'):
        return obj
    raise TypeError('expected a build123d-lite Shape, got ' + repr(obj))


def _wrap_like(obj, topo):
    cls = type(obj) if isinstance(obj, Shape) else Part
    if cls is Edge:
        cls = Curve
    elif cls is Face:
        cls = Sketch
    elif cls is Vertex:
        cls = Part
    res = cls.__new__(cls)
    Shape.__init__(res, topo)
    if isinstance(res, Curve):
        res._specs = list(getattr(obj, '_specs', []) or [])
    return res


def _tolist(objs):
    if objs is None:
        return []
    if isinstance(objs, Shape):
        return [objs]
    return list(objs)


class Shape:
    """A shape wrapping a raw OCCT TopoDS shape (self.topo, may be None for
    empty algebra starters like Part()). Supports build123d algebra."""

    def __init__(self, topo=None):
        self.topo = topo
        self.label = ''
        self.color = None
        self.children = []

    @property
    def wrapped(self):
        """The underlying raw (JS/OCCT) shape — build123d compat."""
        return self.topo

    # --- boolean algebra ---
    def __add__(self, other):
        others = [o for o in _tolist(other) if not (isinstance(o, Shape) and o.topo is None)]
        topos = [_topo(o) for o in others]
        if self.topo is not None:
            topos.insert(0, self.topo)
        if len(topos) == 0:
            return _wrap_like(self, None)
        if len(topos) == 1:
            return _wrap_like(self, topos[0])
        return _wrap_like(self, w.Union(topos))

    def __sub__(self, other):
        others = [o for o in _tolist(other) if not (isinstance(o, Shape) and o.topo is None)]
        if self.topo is None:
            raise ValueError('cannot subtract from an empty shape')
        if len(others) == 0:
            return _wrap_like(self, self.topo)
        tools = [_topo(o) for o in others]
        if len(tools) > 1:
            # fuse the tools first: ONE boolean cut, like build123d — the
            # sequential per-tool cuts are also less robust in this OCCT
            tools = [w.Union(tools)]
        return _wrap_like(self, w.Difference(self.topo, tools))

    def __and__(self, other):
        others = _tolist(other)
        topos = [self.topo] + [_topo(o) for o in others]
        return _wrap_like(self, w.Intersection(topos))

    def __rmul__(self, other):
        # [Plane(f) for f in ...] * shape  -> copies placed at each plane
        if isinstance(other, (list, tuple)) and all(
                isinstance(p, (Location, Plane)) for p in other):
            return ShapeList([p * self for p in other])
        return NotImplemented

    def fuse(self, *others):
        return self.__add__(list(others))

    def cut(self, *others):
        return self.__sub__(list(others))

    def intersect(self, *others):
        return self.__and__(list(others))

    # --- selectors ---
    def edges(self, indices=None):
        """All (unique) edges as a ShapeList of Edge. indices=[...] is the
        CascadeStudio escape hatch used by the GUI Fillet tool."""
        if self.topo is None:
            return ShapeList()
        sel = w.Edges(self.topo)
        idxs = list(sel.indices())
        raws = list(sel.edges())
        out = ShapeList()
        for i in range(len(idxs)):
            if indices is None or idxs[i] in indices:
                out.append(Edge(raws[i], parent=self, index=idxs[i]))
        return out

    def faces(self):
        if self.topo is None:
            return ShapeList()
        sel = w.Faces(self.topo)
        idxs = list(sel.indices())
        raws = list(sel.faces())
        out = ShapeList()
        for i in range(len(idxs)):
            out.append(Face(raws[i], parent=self, index=idxs[i]))
        return out

    def vertices(self):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        seen = []
        def _cb(vtx):
            p = w._vertexPoint(vtx)
            key = (round(p[0], 9), round(p[1], 9), round(p[2], 9))
            if key not in seen:
                seen.append(key)
                out.append(Vertex(vtx, parent=self))
        w.ForEachVertex(self.topo, _cb)
        return out

    def solids(self):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        def _cb(i, s):
            out.append(Part(s))
        w.ForEachSolid(self.topo, _cb)
        return out

    def wires(self):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        def _cb(i, s):
            out.append(Curve(s))
        w.ForEachWire(self.topo, _cb)
        return out

    def face(self):
        fs = self.faces()
        return fs[0] if len(fs) > 0 else None

    def edge(self):
        es = self.edges()
        return es[0] if len(es) > 0 else None

    def wire(self):
        ws = self.wires()
        return ws[0] if len(ws) > 0 else None

    def wire(self):
        ws = self.wires()
        return ws[0] if len(ws) > 0 else None

    # --- measurement ---
    @property
    def volume(self):
        if self.topo is None:
            return 0.0
        return abs(w.Volume(self.topo))

    @property
    def area(self):
        if self.topo is None:
            return 0.0
        return w.SurfaceArea(self.topo)

    @property
    def length(self):
        if self.topo is None:
            return 0.0
        return w.EdgeLength(self.topo)

    def center(self, center_of=CenterOf.MASS):
        if center_of == CenterOf.BOUNDING_BOX:
            return self.bounding_box().center()
        return Vector(tuple(w.CenterOfMass(self.topo)))

    def bounding_box(self, tolerance=None):
        return BoundBox(list(w.BoundingBox(self.topo)))

    # --- placement ---
    def moved(self, loc):
        return loc * self

    def located(self, loc):
        # NOTE: unlike build123d, lite shapes bake transforms into geometry,
        # so located() behaves like moved() relative to the built position.
        return loc * self

    def move(self, loc):
        moved = loc * self
        self.topo = moved.topo
        return self

    def locate(self, loc):
        return self.move(loc)

    def rotate(self, axis, angle):
        topo = self.topo
        o = tuple(axis.position)
        shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Rotate(list(axis.direction), angle, topo)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        return _wrap_like(self, topo)

    def scale(self, factor):
        return _wrap_like(self, w.Scale(factor, self.topo))

    def mirror(self, mirror_plane=None):
        return mirror(self, about=mirror_plane or Plane.XZ, mode=Mode.PRIVATE)

    def is_valid(self):
        return self.topo is not None

    def clean(self):
        return self

    def _lite_copy(self):
        return _wrap_like(self, self.topo)

    def __copy__(self):
        return self._lite_copy()

    def __deepcopy__(self, memo=None):
        return self._lite_copy()


class Part(Shape):
    pass


class Sketch(Shape):
    pass


class Curve(Shape):
    def __init__(self, topo=None, specs=None):
        Shape.__init__(self, topo)
        self._specs = list(specs) if specs else []

    def __add__(self, other):
        # curves concatenate their segment specs so make_face()/sweep() can
        # chain them exactly; the topo union still happens for display
        others = [o for o in _tolist(other) if not (isinstance(o, Shape) and o.topo is None)]
        specs = list(self._specs)
        for o in others:
            if isinstance(o, Curve):
                specs.extend(o._specs)
        topos = [o.topo for o in others if o.topo is not None]
        if self.topo is not None:
            topos.insert(0, self.topo)
        if len(topos) == 0:
            return Curve(None, specs)
        topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos)
        return Curve(topo, specs)

    def _walk(self, u, tangent):
        """Evaluate position/tangent at length-fraction u along the (possibly
        multi-edge) curve, orienting each edge to chain head-to-tail."""
        es = list(w.Edges(self.topo).edges())
        if len(es) == 1:
            fn = w._edgeTangentAt if tangent else w._edgePointAt
            return Vector(tuple(fn(es[0], float(u))))
        lens = [w._edgeLength(e) for e in es]
        ends = [(tuple(w._edgePointAt(e, 0.0)), tuple(w._edgePointAt(e, 1.0)))
                for e in es]
        # orient edges into a chain (WireFromSegments adds them in order,
        # but individual edges may run tip-to-tail reversed)
        flips = [False] * len(es)
        for i in range(1, len(es)):
            prev_end = ends[i - 1][0] if flips[i - 1] else ends[i - 1][1]
            d_fwd = math.dist(prev_end, ends[i][0])
            d_rev = math.dist(prev_end, ends[i][1])
            flips[i] = d_rev < d_fwd
        total = sum(lens)
        target = max(0.0, min(1.0, float(u))) * total
        acc = 0.0
        for i, e in enumerate(es):
            if target <= acc + lens[i] + 1e-12 or i == len(es) - 1:
                v = (target - acc) / lens[i] if lens[i] > 0 else 0.0
                if flips[i]:
                    v = 1.0 - v
                fn = w._edgeTangentAt if tangent else w._edgePointAt
                res = Vector(tuple(fn(e, v)))
                if tangent and flips[i]:
                    res = -res
                return res
            acc += lens[i]
        raise ValueError('curve evaluation failed')

    def __matmul__(self, u):  # curve @ u -> position
        return self._walk(u, False)

    def __mod__(self, u):  # curve % u -> tangent
        return self._walk(u, True)

    @property
    def start_point(self):
        return self @ 0

    @property
    def end_point(self):
        return self @ 1


Solid = Part
Wire = Curve


class Compound(Shape):
    def __init__(self, children=None, label='', **kwargs):
        topos = [_topo(c) for c in _tolist(children) if not (isinstance(c, Shape) and c.topo is None)]
        topo = None
        if len(topos) == 1:
            topo = topos[0]
        elif len(topos) > 1:
            topo = w.MakeCompound(topos)
        Shape.__init__(self, topo)
        self.label = label
        self.children = _tolist(children)


class Edge(Curve):
    def __init__(self, topo, parent=None, index=None):
        Curve.__init__(self, topo)
        self.parent = parent
        self.index = index

    @property
    def geom_type(self):
        t = w._edgeCurveType(self.topo)
        for name in ('LINE', 'CIRCLE', 'ELLIPSE', 'HYPERBOLA', 'PARABOLA',
                     'BEZIER', 'BSPLINE', 'OTHER'):
            if t in getattr(GeomType, name):
                return getattr(GeomType, name)
        return GeomType.OTHER

    @property
    def length(self):
        return w._edgeLength(self.topo)

    def center(self, center_of=CenterOf.GEOMETRY):
        return Vector(tuple(w._edgeMidpoint(self.topo)))

    def _edge_topo(self):
        return self.topo

    def position_at(self, u):
        return self @ u

    def tangent_at(self, u):
        return self % u


class Face(Shape):
    def __init__(self, topo, parent=None, index=None):
        Shape.__init__(self, topo)
        self.parent = parent
        self.index = index

    @property
    def geom_type(self):
        t = w._faceSurfaceType(self.topo)
        for name in ('PLANE', 'CYLINDER', 'CONE', 'SPHERE', 'TORUS',
                     'BEZIER', 'BSPLINE', 'OTHER'):
            if t in getattr(GeomType, name):
                return getattr(GeomType, name)
        return GeomType.OTHER

    @property
    def area(self):
        return w._faceArea(self.topo)

    def center(self, center_of=CenterOf.GEOMETRY):
        return Vector(tuple(w._faceCentroid(self.topo)))

    def normal_at(self, *args):
        return Vector(tuple(w._faceNormal(self.topo)))


class Vertex(Shape):
    def __init__(self, topo, parent=None):
        Shape.__init__(self, topo)
        self.parent = parent
        p = w._vertexPoint(topo)
        self.X, self.Y, self.Z = p[0], p[1], p[2]

    def center(self, center_of=CenterOf.GEOMETRY):
        return Vector(self.X, self.Y, self.Z)

    def to_tuple(self):
        return (self.X, self.Y, self.Z)

    def __iter__(self):
        return iter((self.X, self.Y, self.Z))


class BoundBox:
    def __init__(self, six):
        if six is None:
            six = [0.0] * 6
        self.min = Vector(six[0], six[1], six[2])
        self.max = Vector(six[3], six[4], six[5])

    @property
    def size(self):
        return self.max - self.min

    def center(self):
        return (self.min + self.max) * 0.5

    @property
    def diagonal(self):
        return (self.max - self.min).length

    def __repr__(self):
        return 'BoundBox(' + repr(tuple(self.min)) + ', ' + repr(tuple(self.max)) + ')'


Plane.XY = Plane((0, 0, 0), (1, 0, 0), (0, 0, 1))
Plane.XZ = Plane((0, 0, 0), (1, 0, 0), (0, -1, 0))
Plane.YZ = Plane((0, 0, 0), (0, 1, 0), (1, 0, 0))
Plane.YX = Plane((0, 0, 0), (0, 1, 0), (0, 0, -1))
Plane.ZX = Plane((0, 0, 0), (0, 0, 1), (0, 1, 0))
Plane.ZY = Plane((0, 0, 0), (0, 0, 1), (-1, 0, 0))
Plane.front = Plane.XZ
Plane.top = Plane.XY


# ------------------------------------------------------------ ShapeList ---

def _entity_center(s):
    if isinstance(s, Edge):
        return w._edgeMidpoint(s.topo)
    if isinstance(s, Face):
        return w._faceCentroid(s.topo)
    if isinstance(s, Vertex):
        return (s.X, s.Y, s.Z)
    return tuple(w.CenterOfMass(_topo(s)))


def _axis_value(s, axis):
    c = _entity_center(s)
    o = tuple(axis.position)
    d = tuple(axis.direction)
    return ((c[0] - o[0]) * d[0] + (c[1] - o[1]) * d[1] + (c[2] - o[2]) * d[2])


def _entity_radius(s):
    """Radius of a circular edge from three sampled points (no gp_Circ
    binding in the WASM build)."""
    if not isinstance(s, Edge):
        raise TypeError('SortBy.RADIUS only supports edges in build123d-lite')
    p0 = _v3(w._edgePointAt(s.topo, 0.0))
    p1 = _v3(w._edgePointAt(s.topo, 1.0 / 3.0))
    p2 = _v3(w._edgePointAt(s.topo, 2.0 / 3.0))
    u = tuple(p1[k] - p0[k] for k in range(3))
    v = tuple(p2[k] - p0[k] for k in range(3))
    a = math.sqrt(sum((p1[k] - p2[k]) ** 2 for k in range(3)))
    b = math.sqrt(sum(v[k] ** 2 for k in range(3)))
    c = math.sqrt(sum(u[k] ** 2 for k in range(3)))
    cr = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0])
    area2 = math.sqrt(sum(cr[k] ** 2 for k in range(3)))
    if area2 < 1e-12:
        return float('inf')  # straight line
    return a * b * c / (2.0 * area2)


def _sort_key_fn(key):
    if isinstance(key, Axis):
        return lambda s: _axis_value(s, key)
    if key == SortBy.LENGTH:
        return lambda s: s.length
    if key == SortBy.AREA:
        return lambda s: s.area
    if key == SortBy.VOLUME:
        return lambda s: s.volume
    if key == SortBy.RADIUS:
        return _entity_radius
    if key == SortBy.DISTANCE:
        return lambda s: Vector(_entity_center(s)).length
    if callable(key):
        return key
    raise TypeError('unsupported sort/group key: ' + repr(key))


def _is_parallel(s, axis):
    d = Vector(axis.direction)
    if isinstance(s, Edge):
        ed = w._edgeDirection(s.topo)
        if ed is None:
            return False
        v = Vector(tuple(ed)).normalized()
    elif isinstance(s, Face):
        v = Vector(tuple(w._faceNormal(s.topo)))
    else:
        return False
    return abs(v.dot(d)) > (1.0 - 1e-4)


class ShapeList(list):
    def filter_by(self, f, reverse=False, tolerance=1e-5):
        if isinstance(f, Axis):
            pred = lambda s: _is_parallel(s, f)
        elif isinstance(f, tuple):  # a GeomType member
            def pred(s):
                try:
                    return s.geom_type == f
                except Exception:
                    return False
        elif callable(f):
            pred = f
        else:
            raise TypeError('filter_by: unsupported filter ' + repr(f))
        out = ShapeList([s for s in self if bool(pred(s)) != bool(reverse)])
        return out

    def filter_by_position(self, axis, minimum, maximum, inclusive=(True, True)):
        out = ShapeList()
        for s in self:
            v = _axis_value(s, axis)
            lo = v >= minimum if inclusive[0] else v > minimum
            hi = v <= maximum if inclusive[1] else v < maximum
            if lo and hi:
                out.append(s)
        return out

    def sort_by(self, key=Axis.Z, reverse=False):
        fn = _sort_key_fn(key)
        return ShapeList(sorted(self, key=fn, reverse=reverse))

    def sort_by_distance(self, other, reverse=False):
        o = _v3(other) if not isinstance(other, Shape) else _entity_center(other)
        def dist(s):
            c = _entity_center(s)
            return ((c[0] - o[0]) ** 2 + (c[1] - o[1]) ** 2 + (c[2] - o[2]) ** 2)
        return ShapeList(sorted(self, key=dist, reverse=reverse))

    def group_by(self, key=Axis.Z, reverse=False, tol_digits=6):
        fn = _sort_key_fn(key)
        ordered = sorted(self, key=fn, reverse=reverse)
        groups = []
        last = None
        for s in ordered:
            v = round(fn(s), tol_digits)
            if last is None or v != last:
                groups.append(ShapeList())
                last = v
            groups[-1].append(s)
        return GroupBy(groups)

    @property
    def first(self):
        return self[0]

    @property
    def last(self):
        return self[-1]

    def __getitem__(self, i):
        r = list.__getitem__(self, i)
        if isinstance(i, slice):
            return ShapeList(r)
        return r

    def __gt__(self, key):
        return self.sort_by(key)

    def __lt__(self, key):
        return self.sort_by(key, reverse=True)

    def edges(self):
        out = ShapeList()
        for s in self:
            if isinstance(s, Edge):
                out.append(s)
            else:
                out.extend(s.edges())
        return out

    def faces(self):
        out = ShapeList()
        for s in self:
            if isinstance(s, Face):
                out.append(s)
            else:
                out.extend(s.faces())
        return out

    def vertices(self):
        out = ShapeList()
        for s in self:
            out.extend(s.vertices())
        return out


class GroupBy:
    def __init__(self, groups):
        self.groups = groups

    def __getitem__(self, i):
        return self.groups[i]

    def __iter__(self):
        return iter(self.groups)

    def __len__(self):
        return len(self.groups)


# ------------------------------------------------------------- builders ---

_builders = []
_loc_stack = []


def _reset_state():
    """Clear the builder/location context stacks. Called by the worker
    before every user evaluation: the build123d module instance persists
    across runs, so a previous run that died inside a with-block (e.g. a
    JS-level abort that skipped Python unwinding) must not leak its stack
    into the next run."""
    del _builders[:]
    del _loc_stack[:]


def _active_builder(cls=None):
    if not _builders:
        return None
    b = _builders[-1]
    if cls is not None and not isinstance(b, cls):
        return None
    return b


def _ctx_locations():
    locs = [Location()]
    for ctx in _loc_stack:
        locs = [a * b for a in locs for b in ctx.locations]
    return locs


def _combine(builder, obj, mode, warn_cls=None):
    """Merge obj into builder._obj per mode. Returns the CREATED object."""
    if builder is None or mode == Mode.PRIVATE:
        return obj
    if mode == Mode.REPLACE or builder._obj is None or builder._obj.topo is None:
        if mode == Mode.SUBTRACT:
            raise ValueError('Mode.SUBTRACT with nothing to subtract from')
        if mode == Mode.INTERSECT:
            raise ValueError('Mode.INTERSECT with nothing to intersect')
        builder._obj = builder._wrap(obj.topo)
    elif mode == Mode.ADD:
        builder._obj = builder._wrap((builder._obj + obj).topo)
    elif mode == Mode.SUBTRACT:
        builder._obj = builder._wrap((builder._obj - obj).topo)
    elif mode == Mode.INTERSECT:
        builder._obj = builder._wrap((builder._obj & obj).topo)
    else:
        raise ValueError('unsupported mode ' + repr(mode))
    return obj


class Builder:
    _shape_cls = Part
    _tag = 'part'

    def __init__(self, *workplanes, mode=Mode.ADD):
        planes = []
        for wp in workplanes:
            if isinstance(wp, Plane):
                planes.append(wp)
            elif isinstance(wp, Location):
                planes.append(Plane(wp))
            elif isinstance(wp, Face):
                planes.append(Plane(wp))
            else:
                raise TypeError('workplane must be a Plane/Location/Face')
        self.workplanes = planes or [Plane.XY]
        self.mode = mode
        self._obj = None
        self._loc_depth = None
        self.pending_faces = []   # [(Face shape, Plane)] for BuildPart
        self.pending_edge_specs = []  # segment specs for BuildSketch

    def _wrap(self, topo):
        s = self._shape_cls.__new__(self._shape_cls)
        Shape.__init__(s, topo)
        return s

    def __enter__(self):
        self._loc_depth = len(_loc_stack)
        # build123d only transfers a builder's result to the enclosing
        # builder when both with-statements share a stack frame (an inner
        # builder inside e.g. a BaseSketchObject subclass __init__ must NOT
        # auto-combine — the object machinery adds it instead)
        self._python_frame = w._pythonCallerFrame()
        enclosing = _builders[-1] if _builders else None
        if enclosing is not None and \
                enclosing._python_frame is self._python_frame:
            self._parent = enclosing
        else:
            self._parent = None
        _builders.append(self)
        return self

    def __exit__(self, exc_type, exc, tb):
        del _loc_stack[self._loc_depth:]
        _builders.pop()
        if exc_type is not None:
            return False
        self._finalize(self._parent)
        return False

    def _finalize(self, parent):
        if parent is not None and self._obj is not None and self._obj.topo is not None:
            _combine(parent, self._obj, self.mode)

    # selector passthroughs (builder.edges() etc.)
    def edges(self, select=Select.ALL):
        if select in (Select.LAST, Select.NEW):
            return ShapeList(self._last_edges) if hasattr(self, '_last_edges') else ShapeList()
        return self._obj.edges() if self._obj else ShapeList()

    def faces(self, select=Select.ALL):
        if select in (Select.LAST, Select.NEW):
            return ShapeList(self._last_faces) if hasattr(self, '_last_faces') else ShapeList()
        return self._obj.faces() if self._obj else ShapeList()

    def vertices(self, select=Select.ALL):
        return self._obj.vertices() if self._obj else ShapeList()

    def solids(self, select=Select.ALL):
        return self._obj.solids() if self._obj else ShapeList()


class BuildPart(Builder):
    _shape_cls = Part
    _tag = 'part'

    @property
    def part(self):
        return self._obj

    @property
    def _snapshot(self):
        return self._obj

    def _track_new(self, before_edges):
        """Record Select.LAST edges/faces: those not present before the op."""
        if self._obj is None:
            return
        before = set()
        for e in before_edges:
            c = w._edgeMidpoint(e.topo)
            before.add((round(c[0], 6), round(c[1], 6), round(c[2], 6),
                        round(w._edgeLength(e.topo), 6)))
        new = ShapeList()
        for e in self._obj.edges():
            c = w._edgeMidpoint(e.topo)
            key = (round(c[0], 6), round(c[1], 6), round(c[2], 6),
                   round(w._edgeLength(e.topo), 6))
            if key not in before:
                new.append(e)
        self._last_edges = new
        self._last_faces = self._obj.faces()


class BuildSketch(Builder):
    _shape_cls = Sketch
    _tag = 'sketch'

    @property
    def sketch(self):
        """The sketch PLACED on the workplane (unlike _obj, which is local —
        matching build123d's sketch_local semantics)."""
        if self._obj is None or self._obj.topo is None:
            return self._obj
        placed = [wp.location * self._obj for wp in self.workplanes]
        if len(placed) == 1:
            return placed[0]
        return placed[0] + placed[1:]

    @property
    def sketch_local(self):
        return self._obj

    def _finalize(self, parent):
        if self._obj is None or self._obj.topo is None:
            return
        if isinstance(parent, BuildPart):
            for wp in self.workplanes:
                placed = wp.location * self._obj
                parent.pending_faces.append((placed, wp))
        elif parent is not None:
            _combine(parent, self.sketch, self.mode)


class BuildLine(Builder):
    _shape_cls = Curve
    _tag = 'line'

    def __init__(self, *workplanes, mode=Mode.ADD):
        Builder.__init__(self, *workplanes, mode=mode)
        self._specs = []

    @property
    def line(self):
        if self._obj is not None:
            return self._obj
        if not self._specs:
            return None
        # mid-context access (e.g. mirror(bl.line, ...)): build from the
        # accumulated local segments
        return Curve(w.WireFromSegments(_chain_segments(self._specs)),
                     list(self._specs))

    def _finalize(self, parent):
        # transform local specs by this builder's workplane
        wp = self.workplanes[0]
        loc = wp.location
        fn_dir = lambda d: _mat_vec(loc._R, d)
        specs = [_seg_transform(s, loc._transform_point, fn_dir)
                 for s in self._specs]
        if specs:
            self._obj = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
        if isinstance(parent, BuildSketch):
            parent.pending_edge_specs.extend(specs)
        elif isinstance(parent, BuildPart):
            # a BuildLine directly inside BuildPart provides the sweep() path
            parent.pending_path = self._obj
        elif parent is not None and self._obj is not None:
            _combine(parent, self._obj, self.mode)


# ------------------------------------------------- location contexts -----

class LocationList:
    def __init__(self, locations):
        self.locations = list(locations)

    def __enter__(self):
        _loc_stack.append(self)
        return self

    def __exit__(self, exc_type, exc, tb):
        _loc_stack.pop()
        return False

    def __iter__(self):
        return iter(self.locations)

    def __getitem__(self, i):
        return self.locations[i]

    def __len__(self):
        return len(self.locations)

    @property
    def local_locations(self):
        return list(self.locations)

    def __mul__(self, other):
        # PolarLocations(...) * shape -> copies at every location (algebra)
        if isinstance(other, Shape):
            return ShapeList([loc * other for loc in self.locations])
        if isinstance(other, (list, tuple, ShapeList)):
            return ShapeList([loc * s for loc in self.locations for s in other])
        return NotImplemented

    def __rmul__(self, other):
        # Location * GridLocations(...) -> composed location list
        if isinstance(other, Location):
            return LocationList([other * loc for loc in self.locations])
        if isinstance(other, Plane):
            return LocationList([other.location * loc for loc in self.locations])
        return NotImplemented


class Locations(LocationList):
    def __init__(self, *pts):
        locs = []
        for p in pts:
            if isinstance(p, Location):
                locs.append(p)
            elif isinstance(p, Plane):
                locs.append(p.location)
            elif isinstance(p, Face):
                locs.append(Plane(p).location)
            elif isinstance(p, Vertex):
                locs.append(Pos(p.X, p.Y, p.Z))
            elif isinstance(p, Axis):
                pl = Plane(p.position, z_dir=p.direction)
                locs.append(pl.location)
            else:
                locs.append(Pos(Vector(p)))
        LocationList.__init__(self, locs)


class GridLocations(LocationList):
    def __init__(self, x_spacing, y_spacing, x_count, y_count,
                 align=(Align.CENTER, Align.CENTER)):
        x_count, y_count = int(x_count), int(y_count)
        align = _norm_align(align, 2)
        ox = _grid_offset(align[0], x_spacing * (x_count - 1))
        oy = _grid_offset(align[1], y_spacing * (y_count - 1))
        locs = []
        # build123d iterates x in the outer loop (y varies fastest)
        for i in range(x_count):
            for j in range(y_count):
                locs.append(Pos(i * x_spacing + ox, j * y_spacing + oy, 0))
        LocationList.__init__(self, locs)


def _grid_offset(a, extent):
    if a == Align.CENTER:
        return -extent / 2.0
    if a == Align.MAX:
        return -extent
    return 0.0


class HexLocations(LocationList):
    """Hex-packed circle centers (touching circles of the given radius):
    columns 2*apothem apart, rows 2*radius apart, odd columns offset by
    radius; the whole grid is centered like build123d."""

    def __init__(self, radius, x_count, y_count, align=(Align.CENTER, Align.CENTER)):
        x_count, y_count = int(x_count), int(y_count)
        apothem = radius * math.cos(math.radians(30))
        pts = []
        for i in range(x_count):
            for k in range(y_count):
                x = (i - (x_count - 1) / 2.0) * 2.0 * apothem
                y = (k - (y_count - 1) / 2.0) * 2.0 * radius + \
                    (i % 2) * radius - radius / 2.0
                pts.append((x, y))
        # center the grid (build123d aligns on the bounding box)
        align = _norm_align(align, 2)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        sh = _align_shift(align, (min(xs), min(ys), 0), (max(xs), max(ys), 0))
        LocationList.__init__(self, [Pos(p[0] + sh[0], p[1] + sh[1], 0)
                                     for p in pts])


class PolarLocations(LocationList):
    def __init__(self, radius, count, start_angle=0.0, angular_range=360.0,
                 rotate=True):
        count = int(count)
        locs = []
        step = angular_range / count
        for i in range(count):
            a = start_angle + i * step
            loc = Pos(radius * math.cos(math.radians(a)),
                      radius * math.sin(math.radians(a)), 0)
            if rotate:
                loc = loc * Rot(0, 0, a)
            locs.append(loc)
        LocationList.__init__(self, locs)


# ----------------------------------------------------- object creation ---

def _norm_align(align, n):
    if align is None:
        return (None,) * n
    if isinstance(align, str):
        return (align,) * n
    return tuple(align)


def _align_shift(align, bbox_min, bbox_max):
    shift = []
    for i in range(3):
        a = align[i] if i < len(align) else None
        if a == Align.MIN:
            shift.append(-bbox_min[i])
        elif a == Align.CENTER:
            shift.append(-(bbox_min[i] + bbox_max[i]) / 2.0)
        elif a == Align.MAX:
            shift.append(-bbox_max[i])
        else:
            shift.append(0.0)
    return shift


def _create_object(cls, topo_maker, analytic_bbox, rotation3, align, mode,
                   builder_cls):
    """Shared creation pipeline: align (own bbox) -> rotate -> replicate at
    workplane x location-context products -> combine into the builder."""
    builder = _active_builder(builder_cls)
    if builder is None and _builders:
        raise RuntimeError('a ' + cls.__name__ + ' object cannot be created '
                           'directly inside a ' + type(_builders[-1]).__name__ +
                           ' context')
    ctx_locs = _ctx_locations()
    if builder is not None and builder_cls is BuildPart:
        planes = builder.workplanes
    else:
        planes = [Plane.XY]

    rot = None
    if rotation3 is not None:
        if isinstance(rotation3, (int, float)):
            rotation3 = (0.0, 0.0, rotation3)
        r = tuple(rotation3)
        if r[0] or r[1] or r[2]:
            rot = Rotation(r[0], r[1], r[2])

    results = []
    before_edges = None
    if isinstance(builder, BuildPart) and builder._obj is not None:
        before_edges = builder._obj.edges()

    for pl in planes:
        for loc in ctx_locs:
            topo = topo_maker()
            if align is not None and any(a is not None for a in align):
                if analytic_bbox is not None:
                    bmin, bmax = analytic_bbox
                else:
                    bb = list(w.BoundingBox(topo))
                    bmin, bmax = bb[0:3], bb[3:6]
                sh = _align_shift(align, bmin, bmax)
                if sh[0] or sh[1] or sh[2]:
                    topo = w.Translate(sh, topo)
            shape = cls.__new__(cls)
            Shape.__init__(shape, topo)
            if rot is not None:
                shape = rot * shape
            full = pl.location * loc
            shape = full * shape
            results.append(shape)

    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    created = _combine(builder, obj, mode)
    if isinstance(builder, BuildPart) and before_edges is not None:
        builder._track_new(before_edges)
    elif isinstance(builder, BuildPart):
        builder._last_edges = builder._obj.edges() if builder._obj else ShapeList()
        builder._last_faces = builder._obj.faces() if builder._obj else ShapeList()
    return created


# ------------------------------------------------------- 3D primitives ---

def Box(length, width, height, rotation=(0, 0, 0),
        align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    bbox = ((-length / 2.0, -width / 2.0, -height / 2.0),
            (length / 2.0, width / 2.0, height / 2.0))
    return _create_object(Part, lambda: w.Box(length, width, height, True),
                          bbox, rotation, align, mode, BuildPart)


def Cylinder(radius, height, arc_size=360, rotation=(0, 0, 0),
             align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    if arc_size >= 360:
        bbox = ((-radius, -radius, -height / 2.0), (radius, radius, height / 2.0))
        maker = lambda: w.Cylinder(radius, height, True)
    else:
        bbox = None  # measured from the pie's own bounds, like build123d

        def maker():
            prof = w.Polygon([[0, 0, -height / 2.0], [radius, 0, -height / 2.0],
                              [radius, 0, height / 2.0], [0, 0, height / 2.0]])
            return w.Revolve(prof, arc_size, [0, 0, 1])
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def Sphere(radius, arc_size1=-90, arc_size2=90, arc_size3=360,
           rotation=(0, 0, 0),
           align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if arc_size1 != -90 or arc_size2 != 90 or arc_size3 != 360:
        raise NotImplementedError('partial spheres are not supported in build123d-lite')
    align = _norm_align(align, 3)
    bbox = ((-radius, -radius, -radius), (radius, radius, radius))
    return _create_object(Part, lambda: w.Sphere(radius), bbox, rotation,
                          align, mode, BuildPart)


def Cone(bottom_radius, top_radius, height, arc_size=360, rotation=(0, 0, 0),
         align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if arc_size < 360:
        raise NotImplementedError('partial cones are not supported in build123d-lite')
    align = _norm_align(align, 3)
    r = max(bottom_radius, top_radius)
    bbox = ((-r, -r, -height / 2.0), (r, r, height / 2.0))

    def maker():
        return w.Translate([0, 0, -height / 2.0],
                           w.Cone(bottom_radius, top_radius, height))
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def Torus(major_radius, minor_radius, rotation=(0, 0, 0),
          align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    r = major_radius + minor_radius
    bbox = ((-r, -r, -minor_radius), (r, r, minor_radius))

    def maker():
        prof = w.Circle(minor_radius, False)
        prof = w.Rotate([1, 0, 0], 90, prof)
        prof = w.Translate([major_radius, 0, 0], prof)
        return w.Revolve(prof, 360, [0, 0, 1])
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def Wedge(*args, **kwargs):
    raise NotImplementedError('Wedge is not supported in build123d-lite')


def _part_maxdim(builder):
    if builder is None or builder._obj is None or builder._obj.topo is None:
        raise ValueError('Hole requires an existing part in a BuildPart context')
    bb = list(w.BoundingBox(builder._obj.topo, 0.01))
    return max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2])


def _hole_length(depth):
    """Half-length of a hole cylinder: given depth, or 'through everything'.
    build123d holes are CENTERED on the location and span +-depth."""
    if depth is not None:
        return depth
    return 2.0 * _part_maxdim(_active_builder(BuildPart))


def Hole(radius, depth=None, mode=Mode.SUBTRACT):
    ln = _hole_length(depth)
    # build123d: cylinder of height 2*depth centered at the location
    maker = lambda: w.Cylinder(radius, 2.0 * ln, True)
    return _create_object(Part, maker, None, None, None, mode, BuildPart)


def CounterBoreHole(radius, counter_bore_radius, counter_bore_depth,
                    depth=None, mode=Mode.SUBTRACT):
    ln = _hole_length(depth)

    def maker():
        # hole spans -ln..+ln; the counterbore spans -cb_depth..+ln
        hole = w.Cylinder(radius, 2.0 * ln, True)
        bore = w.Translate([0, 0, -counter_bore_depth],
                           w.Cylinder(counter_bore_radius,
                                      counter_bore_depth + ln, False))
        return w.Union([bore, hole])
    return _create_object(Part, maker, None, None, None, mode, BuildPart)


def CounterSinkHole(radius, counter_sink_radius, depth=None,
                    counter_sink_angle=82, mode=Mode.SUBTRACT):
    ln = _hole_length(depth)
    sink_depth = ((counter_sink_radius - radius) /
                  math.tan(math.radians(counter_sink_angle / 2.0)))

    def maker():
        # hole spans -ln..+ln; countersink cone flares from the hole radius
        # at -sink_depth to counter_sink_radius at z=0, then continues as a
        # cylinder of that radius up to +ln (through the space above)
        hole = w.Cylinder(radius, 2.0 * ln, True)
        cone = w.Translate([0, 0, -sink_depth],
                           w.Cone(radius, counter_sink_radius, sink_depth))
        cap = w.Cylinder(counter_sink_radius, ln, False)
        return w.Union([cone, cap, hole])
    return _create_object(Part, maker, None, None, None, mode, BuildPart)


# ------------------------------------------------------- 2D primitives ---

class BasePartObject(Part):
    """Base for user-defined part objects: places an existing Part with
    rotation/align/mode like the built-in primitives (build123d compat)."""

    def __init__(self, part, rotation=(0, 0, 0),
                 align=None, mode=Mode.ADD):
        topo = _topo(part)
        align3 = _norm_align(align, 3) if align is not None else None
        created = _create_object(Part, lambda: topo, None, rotation, align3,
                                 mode, BuildPart)
        Shape.__init__(self, created.topo)


class BaseSketchObject(Sketch):
    """Base for user-defined sketch objects (build123d compat)."""

    def __init__(self, obj, rotation=0, align=None, mode=Mode.ADD):
        topo = _topo(obj)
        created = _sketch_object(lambda: topo, None, rotation, align, mode)
        Shape.__init__(self, created.topo)


def _sketch_object(topo_maker, analytic_bbox, rotation, align, mode):
    align3 = None
    if align is not None:
        a2 = _norm_align(align, 2)
        align3 = (a2[0], a2[1], None)
    bbox3 = None
    if analytic_bbox is not None and align3 is not None:
        (x0, y0), (x1, y1) = analytic_bbox
        bbox3 = ((x0, y0, 0.0), (x1, y1, 0.0))
    rot3 = None
    if rotation:
        rot3 = (0.0, 0.0, rotation)
    return _create_object(Sketch, topo_maker, bbox3, rot3, align3, mode,
                          BuildSketch)


def Rectangle(width, height, rotation=0,
              align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    x, y = width / 2.0, height / 2.0
    maker = lambda: w.Polygon([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]])
    return _sketch_object(maker, ((-x, -y), (x, y)), rotation, align, mode)


def Circle(radius, align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    maker = lambda: w.Circle(radius, False)
    return _sketch_object(maker, ((-radius, -radius), (radius, radius)),
                          0, align, mode)


def Ellipse(*args, **kwargs):
    raise NotImplementedError('Ellipse is not supported in build123d-lite '
                              '(no ellipse curve binding)')


def Polygon(*pts, rotation=0, align=None, mode=Mode.ADD):
    if len(pts) == 1 and not isinstance(pts[0], (Vector,)) and \
            hasattr(pts[0], '__len__') and len(pts[0]) > 0 and \
            hasattr(pts[0][0], '__len__'):
        pts = tuple(pts[0])
    p3 = [_v3(p) for p in pts]
    xs = [p[0] for p in p3]
    ys = [p[1] for p in p3]
    maker = lambda: w.Polygon([[p[0], p[1], 0] for p in p3])
    return _sketch_object(maker, ((min(xs), min(ys)), (max(xs), max(ys))),
                          rotation, align, mode)


def RegularPolygon(radius, side_count, major_radius=True, rotation=0,
                   align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    r = radius if major_radius else radius / math.cos(math.pi / side_count)
    pts = []
    for i in range(side_count):
        a = 2.0 * math.pi * i / side_count
        pts.append([r * math.cos(a), r * math.sin(a), 0])
    maker = lambda: w.Polygon(pts)
    # build123d aligns RegularPolygon on its circumcircle (+-r), not its bbox
    return _sketch_object(maker, ((-r, -r), (r, r)), rotation, align, mode)


def RectangleRounded(width, height, radius, rotation=0,
                     align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if radius <= 0 or radius >= min(width, height) / 2.0:
        raise ValueError('RectangleRounded: invalid corner radius')
    x, y, r = width / 2.0, height / 2.0, radius
    k = r * (1.0 - math.sqrt(0.5))  # arc midpoint inset at 45 degrees
    segs = [
        ['line', [[-x + r, -y, 0], [x - r, -y, 0]]],
        ['arc3', [[x - r, -y, 0], [x - k, -y + k, 0], [x, -y + r, 0]]],
        ['line', [[x, -y + r, 0], [x, y - r, 0]]],
        ['arc3', [[x, y - r, 0], [x - k, y - k, 0], [x - r, y, 0]]],
        ['line', [[x - r, y, 0], [-x + r, y, 0]]],
        ['arc3', [[-x + r, y, 0], [-x + k, y - k, 0], [-x, y - r, 0]]],
        ['line', [[-x, y - r, 0], [-x, -y + r, 0]]],
        ['arc3', [[-x, -y + r, 0], [-x + k, -y + k, 0], [-x + r, -y, 0]]],
    ]
    maker = lambda: w.MakeFace(w.WireFromSegments(segs))
    return _sketch_object(maker, ((-x, -y), (x, y)), rotation, align, mode)


def SlotOverall(width, height, rotation=0,
                align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    r = height / 2.0
    c = width / 2.0 - r  # arc centers at +-c
    if c <= 0:
        raise ValueError('SlotOverall: width must exceed height')
    segs = [
        ['line', [[-c, -r, 0], [c, -r, 0]]],
        ['arc3', [[c, -r, 0], [c + r, 0, 0], [c, r, 0]]],
        ['line', [[c, r, 0], [-c, r, 0]]],
        ['arc3', [[-c, r, 0], [-c - r, 0, 0], [-c, -r, 0]]],
    ]
    maker = lambda: w.MakeFace(w.WireFromSegments(segs))
    return _sketch_object(maker, ((-width / 2.0, -r), (width / 2.0, r)),
                          rotation, align, mode)


def SlotCenterToCenter(center_separation, height, rotation=0,
                       align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    return SlotOverall(center_separation + height, height, rotation=rotation,
                       align=align, mode=mode)


def Trapezoid(width, height, left_side_angle, right_side_angle=None,
              rotation=0, align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if right_side_angle is None:
        right_side_angle = left_side_angle
    x, y = width / 2.0, height / 2.0
    dl = height / math.tan(math.radians(left_side_angle))
    dr = height / math.tan(math.radians(right_side_angle))
    pts = [[-x, -y, 0], [x, -y, 0], [x - dr, y, 0], [-x + dl, y, 0]]
    maker = lambda: w.Polygon(pts)
    return _sketch_object(maker, ((-x, -y), (x, y)), rotation, align, mode)


class TextAlign:
    LEFT = 'left'
    CENTER = 'center'
    RIGHT = 'right'
    BOTTOM = 'bottom'
    TOP = 'top'


def Text(txt, font_size, font='Arial', font_path=None,
         font_style=FontStyle.REGULAR,
         text_align=(TextAlign.CENTER, TextAlign.CENTER), align=None,
         path=None, position_on_path=0.0, single_line_width=None,
         rotation=0.0, mode=Mode.ADD):
    """Text rendered with OCCT's StdPrs_BRepTextBuilder using Liberation
    Sans (= what fontconfig resolves 'Arial' to on Linux, so geometry
    matches native build123d there). Other font names fall back to
    Liberation Sans with a warning; font_path/path are not supported."""
    if path is not None:
        raise NotImplementedError('Text along a path is not supported in '
                                  'build123d-lite')
    if font_path is not None:
        raise NotImplementedError('Text font_path= is not supported in '
                                  'build123d-lite (fonts are bundled)')
    fname = {FontStyle.REGULAR: 'FreeSans',
             FontStyle.BOLD: 'FreeSansBold',
             FontStyle.ITALIC: 'FreeSansOblique',
             FontStyle.BOLDITALIC: 'FreeSansBoldOblique'}.get(font_style)
    if fname is None:
        raise NotImplementedError('unsupported font_style in build123d-lite')
    if font not in ('Arial', 'FreeSans'):
        print('build123d-lite: font ' + repr(font) +
              ' is not bundled; using FreeSans (what OCCT resolves Arial to)')
    maker = lambda: w.Text2D(txt, float(font_size), fname,
                             text_align[0], text_align[1])
    return _sketch_object(maker, None, rotation, align, mode)


# ---------------------------------------------------------- 1D objects ---

def _seg_pts(seg):
    return seg[1]


def _seg_params(seg):
    return seg[2] if len(seg) > 2 else None


def _seg_make(kind, pts, params=None):
    if params is None:
        return [kind, [list(p) for p in pts]]
    return [kind, [list(p) for p in pts], params]


def _seg_reverse(seg):
    return _seg_make(seg[0], list(reversed(_seg_pts(seg))), _seg_params(seg))


def _seg_transform(seg, fn_point, fn_dir):
    """Rigid-transform a segment: points via fn_point, directions via fn_dir
    (earc params carry center/xdir/normal)."""
    pts = [fn_point(_v3(p)) for p in _seg_pts(seg)]
    params = _seg_params(seg)
    if params is not None:
        params = [list(fn_point(_v3(params[0]))), list(fn_dir(_v3(params[1]))),
                  list(fn_dir(_v3(params[2])))] + list(params[3:])
    return _seg_make(seg[0], pts, params)


def _chain_segments(specs):
    """Greedy-chain segments end-to-start (reversing where needed) so OCCT's
    MakeWire accepts them in order. Specs: (kind, [pts...][, params])."""
    if not specs:
        return []
    remaining = [_seg_make(s[0], [tuple(p) for p in _seg_pts(s)], _seg_params(s))
                 for s in specs]
    ordered = [remaining.pop(0)]

    def s_start(s):
        return _seg_pts(s)[0]

    def s_end(s):
        return _seg_pts(s)[-1]

    def close(a, b):
        return (abs(a[0] - b[0]) < 1e-6 and abs(a[1] - b[1]) < 1e-6 and
                abs(a[2] - b[2]) < 1e-6)

    while remaining:
        tail = s_end(ordered[-1])
        head = s_start(ordered[0])
        found = False
        for i, seg in enumerate(remaining):
            if close(s_start(seg), tail):
                ordered.append(remaining.pop(i))
                found = True
                break
            if close(s_end(seg), tail):
                ordered.append(_seg_reverse(remaining.pop(i)))
                found = True
                break
            if close(s_end(seg), head):
                ordered.insert(0, remaining.pop(i))
                found = True
                break
            if close(s_start(seg), head):
                ordered.insert(0, _seg_reverse(remaining.pop(i)))
                found = True
                break
        if not found:
            # disconnected: append remaining as-is and let OCCT complain
            ordered.extend(remaining)
            break
    return ordered


def _line_object(specs, mode=Mode.ADD):
    """Register specs with the active BuildLine (if any) and return a Curve."""
    builder = _active_builder(BuildLine)
    curve = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
    if builder is not None and mode != Mode.PRIVATE:
        builder._specs.extend(specs)
    return curve


def Line(*pts, mode=Mode.ADD):
    if len(pts) == 1:
        pts = tuple(pts[0])
    if len(pts) != 2:
        raise ValueError('Line requires exactly two points')
    return _line_object([('line', [_v3(pts[0]), _v3(pts[1])])], mode)


def Polyline(*pts, close=False, mode=Mode.ADD):
    if len(pts) == 1 and hasattr(pts[0], '__len__') and \
            hasattr(pts[0][0], '__len__'):
        pts = tuple(pts[0])
    p3 = [_v3(p) for p in pts]
    if close and p3[0] != p3[-1]:
        p3.append(p3[0])
    specs = [('line', [p3[i], p3[i + 1]]) for i in range(len(p3) - 1)]
    return _line_object(specs, mode)


def ThreePointArc(*pts, mode=Mode.ADD):
    if len(pts) == 1:
        pts = tuple(pts[0])
    if len(pts) != 3:
        raise ValueError('ThreePointArc requires three points')
    return _line_object([('arc3', [_v3(pts[0]), _v3(pts[1]), _v3(pts[2])])], mode)


def _arc_mid_from_sagitta(p1, p2, sagitta):
    mx, my = (p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    ln = math.hypot(dx, dy)
    if ln < 1e-12:
        raise ValueError('arc endpoints coincide')
    nx, ny = -dy / ln, dx / ln  # left normal of p1->p2
    return (mx + nx * sagitta, my + ny * sagitta, p1[2])


def SagittaArc(start, end, sagitta, mode=Mode.ADD):
    p1, p2 = _v3(start), _v3(end)
    mid = _arc_mid_from_sagitta(p1, p2, sagitta)
    return _line_object([('arc3', [p1, list(mid), p2])], mode)


def RadiusArc(start, end, radius, short_sagitta=True, mode=Mode.ADD):
    p1, p2 = _v3(start), _v3(end)
    c = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    r = abs(radius)
    if r < c / 2.0 - 1e-9:
        raise ValueError('RadiusArc: radius is smaller than half the chord')
    h = math.sqrt(max(r * r - (c / 2.0) ** 2, 0.0))
    sag = (r - h) if short_sagitta else (r + h)
    if radius < 0:
        sag = -sag
    return SagittaArc(start, end, sag, mode=mode)


def CenterArc(center, radius, start_angle, arc_size, mode=Mode.ADD):
    c = _v3(center)

    def at(a):
        return [c[0] + radius * math.cos(math.radians(a)),
                c[1] + radius * math.sin(math.radians(a)), c[2]]
    if abs(arc_size) >= 360:
        specs = [('arc3', [at(start_angle), at(start_angle + 90),
                           at(start_angle + 180)]),
                 ('arc3', [at(start_angle + 180), at(start_angle + 270),
                           at(start_angle + 360)])]
    else:
        specs = [('arc3', [at(start_angle), at(start_angle + arc_size / 2.0),
                           at(start_angle + arc_size)])]
    return _line_object(specs, mode)


def TangentArc(*pts, tangent, tangent_from_first=True, mode=Mode.ADD):
    if len(pts) == 1:
        pts = tuple(pts[0])
    if len(pts) != 2:
        raise ValueError('TangentArc requires two points')
    if not tangent_from_first:
        raise NotImplementedError('TangentArc with tangent_from_first=False')
    p1, p2 = _v3(pts[0]), _v3(pts[1])
    t = _v3(tangent)
    tln = math.hypot(t[0], t[1])
    tx, ty = t[0] / tln, t[1] / tln
    nx, ny = -ty, tx  # left normal of the tangent
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    denom = 2.0 * (dx * nx + dy * ny)
    if abs(denom) < 1e-12:
        return Line(pts[0], pts[1], mode=mode)
    r = (dx * dx + dy * dy) / denom  # signed radius along the left normal
    cx, cy = p1[0] + nx * r, p1[1] + ny * r
    a1 = math.atan2(p1[1] - cy, p1[0] - cx)
    a2 = math.atan2(p2[1] - cy, p2[0] - cx)
    ccw = r > 0  # tangent matches CCW travel when center is on the left
    if ccw:
        while a2 <= a1:
            a2 += 2.0 * math.pi
    else:
        while a2 >= a1:
            a2 -= 2.0 * math.pi
    amid = (a1 + a2) / 2.0
    rad = abs(r)
    mid = [cx + rad * math.cos(amid), cy + rad * math.sin(amid), p1[2]]
    return _line_object([('arc3', [p1, mid, p2])], mode)


def JernArc(start, tangent, radius, arc_size, mode=Mode.ADD):
    p1 = _v3(start)
    t = _v3(tangent)
    tln = math.hypot(t[0], t[1])
    tx, ty = t[0] / tln, t[1] / tln
    # positive arc_size turns left: center on the left normal, CCW sweep
    side = 1.0 if arc_size >= 0 else -1.0
    nx, ny = -ty * side, tx * side
    cx, cy = p1[0] + nx * radius, p1[1] + ny * radius
    a1 = math.atan2(p1[1] - cy, p1[0] - cx)
    a2 = a1 + side * math.radians(abs(arc_size))
    amid = (a1 + a2) / 2.0

    def at(a):
        return [cx + radius * math.cos(a), cy + radius * math.sin(a), p1[2]]
    return _line_object([('arc3', [list(p1), at(amid), at(a2)])], mode)


def PolarLine(start, length, angle=None, direction=None, mode=Mode.ADD,
              **kwargs):
    p1 = _v3(start)
    if direction is not None:
        d = Vector(direction).normalized()
        p2 = [p1[0] + length * d.X, p1[1] + length * d.Y, p1[2] + length * d.Z]
    elif angle is not None:
        p2 = [p1[0] + length * math.cos(math.radians(angle)),
              p1[1] + length * math.sin(math.radians(angle)), p1[2]]
    else:
        raise ValueError('PolarLine requires angle= or direction=')
    return _line_object([('line', [p1, p2])], mode)


def Bezier(*cpts, weights=None, mode=Mode.ADD):
    if len(cpts) == 1 and hasattr(cpts[0], '__len__') and \
            hasattr(cpts[0][0], '__len__'):
        cpts = tuple(cpts[0])
    pts = [_v3(p) for p in cpts]
    if weights is None:
        return _line_object([('bezier', pts)], mode)
    # rational Bezier: the WASM build lacks the weighted Geom_BezierCurve
    # array types, so sample the exact rational curve densely and fit
    if len(weights) != len(pts):
        raise ValueError('Bezier: weights must match control points')
    n = len(pts) - 1
    binom = [1] * (n + 1)
    for i in range(1, n + 1):
        binom[i] = binom[i - 1] * (n - i + 1) // i

    def at(t):
        num = [0.0, 0.0, 0.0]
        den = 0.0
        for i in range(n + 1):
            b = binom[i] * (t ** i) * ((1 - t) ** (n - i)) * weights[i]
            den += b
            for k in range(3):
                num[k] += b * pts[i][k]
        return [num[0] / den, num[1] / den, num[2] / den]
    dense = [at(i / 64.0) for i in range(65)]
    return _line_object([('spline', dense)], mode)


def _cubic_spline(pts, d0=None, d1=None, samples_per_seg=16):
    """Densely sample a C2 cubic through the points (chord-length
    parametrized) — approximates GeomAPI_Interpolate, whose point-array
    types are not bound in the WASM build. End conditions: clamped to the
    derivative vectors d0/d1 when given (validated against build123d's
    Spline(tangents=..., tangent_scalars=...): end derivative =
    unit(tangent) * scalar), else not-a-knot (closest match to OCCT's
    free-end interpolation). Returns the sampled polyline."""
    n = len(pts) - 1
    if n < 1:
        return list(pts)
    if n == 1 and d0 is None:
        return list(pts)
    t = [0.0]
    for i in range(n):
        d = math.sqrt(sum((pts[i + 1][k] - pts[i][k]) ** 2 for k in range(3)))
        t.append(t[-1] + max(d, 1e-12))
    h = [t[i + 1] - t[i] for i in range(n)]
    N = n + 1

    def solve_axis(dim):
        vals = [p[dim] for p in pts]
        A = [[0.0] * N for _ in range(N)]
        r = [0.0] * N
        if d0 is not None:
            A[0][0] = 2 * h[0]
            A[0][1] = h[0]
            r[0] = 3.0 * ((vals[1] - vals[0]) / h[0] - d0[dim])
            A[n][n - 1] = h[n - 1]
            A[n][n] = 2 * h[n - 1]
            r[n] = 3.0 * (d1[dim] - (vals[n] - vals[n - 1]) / h[n - 1])
        elif n >= 2:
            # not-a-knot
            A[0][0] = h[1]
            A[0][1] = -(h[0] + h[1])
            A[0][2] = h[0]
            A[n][n - 2] = h[n - 1]
            A[n][n - 1] = -(h[n - 2] + h[n - 1])
            A[n][n] = h[n - 2]
        else:
            A[0][0] = 1.0
            A[n][n] = 1.0
        for i in range(1, n):
            A[i][i - 1] = h[i - 1]
            A[i][i] = 2.0 * (h[i - 1] + h[i])
            A[i][i + 1] = h[i]
            r[i] = 3.0 * ((vals[i + 1] - vals[i]) / h[i] -
                          (vals[i] - vals[i - 1]) / h[i - 1])
        # gaussian elimination with partial pivoting (N is small)
        for i in range(N):
            piv = i
            for k in range(i + 1, N):
                if abs(A[k][i]) > abs(A[piv][i]):
                    piv = k
            if piv != i:
                A[i], A[piv] = A[piv], A[i]
                r[i], r[piv] = r[piv], r[i]
            for j in range(i + 1, N):
                if A[j][i] != 0.0:
                    f = A[j][i] / A[i][i]
                    for k in range(i, N):
                        A[j][k] -= f * A[i][k]
                    r[j] -= f * r[i]
        c = [0.0] * N
        for i in range(N - 1, -1, -1):
            s = r[i]
            for k in range(i + 1, N):
                s -= A[i][k] * c[k]
            c[i] = s / A[i][i]
        b = [0.0] * n
        dd = [0.0] * n
        for i in range(n):
            b[i] = ((vals[i + 1] - vals[i]) / h[i] -
                    h[i] * (2.0 * c[i] + c[i + 1]) / 3.0)
            dd[i] = (c[i + 1] - c[i]) / (3.0 * h[i])
        return b, c, dd

    coeffs = [solve_axis(k) for k in range(3)]
    out = []
    for i in range(n):
        for s in range(samples_per_seg):
            dt = h[i] * s / samples_per_seg
            pt = []
            for k in range(3):
                b, c, dd = coeffs[k]
                pt.append(pts[i][k] + b[i] * dt + c[i] * dt * dt +
                          dd[i] * dt * dt * dt)
            out.append(tuple(pt))
    out.append(tuple(pts[-1]))
    return out


def Spline(*pts, tangents=None, tangent_scalars=None, periodic=False,
           mode=Mode.ADD):
    if len(pts) == 1 and hasattr(pts[0], '__len__') and \
            hasattr(pts[0][0], '__len__'):
        pts = tuple(pts[0])
    p3 = [_v3(p) for p in pts]
    if periodic and p3[0] != p3[-1]:
        p3.append(p3[0])
    d0 = d1 = None
    if tangents is not None:
        tg = [Vector(t).normalized() for t in tangents]
        if len(tg) != 2:
            raise NotImplementedError('Spline with per-point tangents is not '
                                      'supported in build123d-lite (ends only)')
        sc = tangent_scalars if tangent_scalars is not None else (1.0, 1.0)
        d0 = tuple(tg[0] * sc[0])
        d1 = tuple(tg[1] * sc[1])
    # sample a C2 cubic through the points and fit tightly through the
    # samples — matches build123d's exact interpolation closely (end
    # derivatives = unit tangent * scalar, calibrated against 0.11.1)
    dense = [list(p) for p in _cubic_spline(p3, d0, d1)]
    return _line_object([('spline', dense)], mode)


def EllipticalCenterArc(center, x_radius, y_radius, start_angle=0.0,
                        arc_size=90.0, rotation=0.0, angular_direction=None,
                        mode=Mode.ADD):
    if not isinstance(arc_size, (int, float)):
        raise NotImplementedError('EllipticalCenterArc arc limits (Shape/'
                                  'Axis/...) are not supported in build123d-lite')
    c = _v3(center)
    if arc_size >= 0:
        end_angle = start_angle + arc_size
    else:
        # negative size sweeps clockwise: same point set as the CCW arc
        # from (start + arc_size) to start
        start_angle, end_angle = start_angle + arc_size, start_angle
    rot = math.radians(rotation)
    xd = (math.cos(rot), math.sin(rot), 0.0)

    def at(a):
        ar = math.radians(a)
        lx, ly = x_radius * math.cos(ar), y_radius * math.sin(ar)
        return [c[0] + lx * xd[0] - ly * xd[1], c[1] + lx * xd[1] + ly * xd[0], c[2]]
    # gp_Elips requires major >= minor: swap axes when y_radius dominates
    if x_radius >= y_radius:
        major, minor, a0, a1 = x_radius, y_radius, start_angle, end_angle
        xdir = list(xd)
    else:
        major, minor = y_radius, x_radius
        a0, a1 = start_angle - 90.0, end_angle - 90.0
        xdir = [-xd[1], xd[0], 0.0]
    spec = ('earc', [at(start_angle), at(end_angle)],
            [list(c), xdir, [0.0, 0.0, 1.0], major, minor, a0, a1])
    return _line_object([spec], mode)


def Ellipse(x_radius, y_radius, rotation=0, align=(Align.CENTER, Align.CENTER),
            mode=Mode.ADD):
    """Elliptical sketch face (gp_Elips + GC_MakeArcOfEllipse)."""
    if x_radius >= y_radius:
        major, minor, xdir = x_radius, y_radius, [1.0, 0.0, 0.0]
        p0 = [x_radius, 0, 0]
    else:
        major, minor, xdir = y_radius, x_radius, [0.0, 1.0, 0.0]
        p0 = [0, y_radius, 0]
    segs = [('earc', [p0, [-p0[0], -p0[1], 0]],
             [[0.0, 0.0, 0.0], xdir, [0.0, 0.0, 1.0], major, minor, 0.0, 180.0]),
            ('earc', [[-p0[0], -p0[1], 0], p0],
             [[0.0, 0.0, 0.0], xdir, [0.0, 0.0, 1.0], major, minor, 180.0, 360.0])]
    maker = lambda: w.MakeFace(w.WireFromSegments(_chain_segments(segs)))
    return _sketch_object(maker, ((-x_radius, -y_radius), (x_radius, y_radius)),
                          rotation, align, mode)


def Helix(*args, **kwargs):
    raise NotImplementedError('Helix is not supported in build123d-lite')


def _specs_from_topo_edges(shape):
    """Reconstruct segment specs from raw edges (lines and circular arcs
    exactly, via sampled points)."""
    specs = []
    for e in shape.edges() if not isinstance(shape, Edge) else [shape]:
        t = w._edgeCurveType(e.topo)
        p0 = list(w._edgePointAt(e.topo, 0.0))
        p1 = list(w._edgePointAt(e.topo, 1.0))
        if t == 'Line':
            specs.append(('line', [p0, p1]))
        elif t == 'Circle':
            pm = list(w._edgePointAt(e.topo, 0.5))
            specs.append(('arc3', [p0, pm, p1]))
        else:
            raise NotImplementedError('cannot reconstruct a ' + t +
                                      ' edge as a segment in build123d-lite')
    return specs


def SlotArc(arc, height, rotation=0, mode=Mode.ADD):
    """Slot along an arc path: BRepOffsetAPI_MakeOffset on the open wire
    yields both offset sides plus round end caps — build123d's SlotArc."""
    if isinstance(arc, Curve) and arc._specs:
        specs = arc._specs
    elif isinstance(arc, (Curve, Edge)):
        specs = _specs_from_topo_edges(arc)
    else:
        raise NotImplementedError('SlotArc requires a curve/edge')
    wire = w.WireFromSegments(_chain_segments(specs))
    closed = w.OffsetWire(wire, height / 2.0)
    face = w.MakeFace(closed)
    return _sketch_object(lambda: face, None, rotation, None, mode)


# ------------------------------------------------------------ operations ---

def _pending_or_given(to_extrude):
    """Resolve extrude/revolve/loft profiles: explicit shape(s) or the
    enclosing BuildPart's pending sketch faces. Returns [(face_topo, plane)]."""
    builder = _active_builder(BuildPart)
    profiles = []
    if to_extrude is None:
        if builder is None or not builder.pending_faces:
            raise ValueError('no sketch profile: pass a shape or create one '
                             'with BuildSketch inside BuildPart')
        for (shape, plane) in builder.pending_faces:
            for f in shape.faces():
                profiles.append((f.topo, plane))
        builder.pending_faces = []
    else:
        for s in _tolist(to_extrude):
            for f in s.faces():
                n = w._faceNormal(f.topo)
                c = w._faceCentroid(f.topo)
                profiles.append((f.topo, Plane(origin=tuple(c), z_dir=tuple(n))))
    return profiles


def extrude(to_extrude=None, amount=None, dir=None, until=None, target=None,
            both=False, taper=0.0, clean=True, mode=Mode.ADD):
    if until is not None:
        raise NotImplementedError('extrude(until=...) is not supported in '
                                  'build123d-lite')
    if amount is None and isinstance(to_extrude, (int, float)):
        amount = to_extrude
        to_extrude = None
    if amount is None:
        raise ValueError('extrude requires amount=')
    if taper and (both or dir is not None):
        raise NotImplementedError('extrude taper with both=/dir= is not '
                                  'supported in build123d-lite')
    builder = _active_builder(BuildPart)
    profiles = _pending_or_given(to_extrude)
    results = []
    for (face, plane) in profiles:
        if taper:
            # draft-angle extrusion (LocOpe_DPrism) along the face normal
            solid = w.TaperExtrude(face, amount, taper)
            results.append(Part(solid))
            continue
        d = tuple(Vector(dir).normalized()) if dir is not None else tuple(plane.z_dir)
        vec = [d[0] * amount, d[1] * amount, d[2] * amount]
        if both:
            f2 = w.Translate([-vec[0], -vec[1], -vec[2]], face, True)
            solid = w.Extrude(f2, [2 * vec[0], 2 * vec[1], 2 * vec[2]])
        else:
            solid = w.Extrude(face, vec)
        results.append(Part(solid))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    before = builder._obj.edges() if (builder and builder._obj) else None
    created = _combine(builder, obj, mode)
    if isinstance(builder, BuildPart):
        if before is not None:
            builder._track_new(before)
        elif builder._obj is not None:
            builder._last_edges = builder._obj.edges()
            builder._last_faces = builder._obj.faces()
    return created


def revolve(profiles=None, axis=Axis.Z, revolution_arc=360, clean=True,
            mode=Mode.ADD):
    builder = _active_builder(BuildPart)
    profs = _pending_or_given(profiles)
    o = tuple(axis.position)
    d = list(axis.direction)
    shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
    results = []
    for (face, plane) in profs:
        topo = face
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Revolve(topo, revolution_arc, d)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        results.append(Part(topo))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def loft(sections=None, ruled=False, clean=True, mode=Mode.ADD):
    if ruled:
        raise NotImplementedError('loft(ruled=True) is not supported in '
                                  'build123d-lite')
    builder = _active_builder(BuildPart)
    profs = _pending_or_given(sections)
    wires = []
    for (face, plane) in profs:
        wires.append(w.GetWire(face))
    solid = w.Loft(wires)
    return _combine(builder, Part(solid), mode)


def sweep(sections=None, path=None, multisection=False, is_frenet=False,
          transition=Transition.TRANSFORMED, normal=None, binormal=None,
          clean=True, mode=Mode.ADD):
    if multisection:
        raise NotImplementedError('multisection sweep is not supported in '
                                  'build123d-lite')
    builder = _active_builder(BuildPart)
    if path is None and builder is not None:
        path = getattr(builder, 'pending_path', None)
    if path is None:
        raise ValueError('sweep requires path= (or a BuildLine inside the '
                         'BuildPart)')
    if isinstance(path, Curve) and path._specs:
        # multi-segment curves: build ONE chained wire (their topo may be a
        # compound of separate wires, of which GetWire would take only one)
        path_topo = w.WireFromSegments(_chain_segments(path._specs))
    else:
        path_topo = _topo(path)
        if not hasattr(path_topo, 'ShapeType') or path_topo.ShapeType().value != 5:
            path_topo = w.GetWire(path_topo, 0, True)
    profs = _pending_or_given(sections)
    results = []
    for (face, plane) in profs:
        results.append(Part(w.Pipe(face, path_topo, True)))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def _edges_by_parent(objects):
    edges = []
    for o in _tolist(objects):
        if isinstance(o, Edge):
            edges.append(o)
        elif isinstance(o, (ShapeList, list, tuple)):
            edges.extend([e for e in o if isinstance(e, Edge)])
    if not edges:
        raise ValueError('no edges given (use shape.edges() selectors)')
    parent = edges[0].parent
    for e in edges:
        if e.parent is not parent:
            raise ValueError('all edges must belong to the same shape')
    return parent, [e.index for e in edges]


def _vertex_op_2d(objs, radius, opname):
    """2D fillet of sketch corner vertices (BRepFilletAPI_MakeFillet2d)."""
    if opname != 'fillet':
        raise NotImplementedError('2D vertex chamfers are not supported in '
                                  'build123d-lite')
    verts = [o for o in objs if isinstance(o, Vertex)]
    parent = verts[0].parent
    for v in verts:
        if v.parent is not parent:
            raise ValueError('all vertices must belong to the same sketch')
    if parent is None or parent.topo is None:
        raise ValueError('fillet: vertices have no parent sketch')
    faces = parent.faces()
    if len(faces) != 1:
        raise NotImplementedError('2D vertex fillets on multi-face sketches '
                                  'are not supported in build123d-lite')
    pts = [[v.X, v.Y, v.Z] for v in verts]
    result = _wrap_like(parent, w.FilletFace2D(faces[0].topo, radius, pts))
    builder = _active_builder()
    if builder is not None and builder._obj is not None and \
            (builder._obj is parent or builder._obj.topo is parent.topo):
        builder._obj = result
    return result


def _edge_op(objects, jsfunc, value, opname):
    objs = _tolist(objects)
    if any(isinstance(o, Vertex) for o in objs):
        return _vertex_op_2d(objs, value, opname)
    parent, indices = _edges_by_parent(objs)
    if parent is None or parent.topo is None:
        raise ValueError(opname + ': edges have no parent shape')
    ptopo = parent.topo
    result = _wrap_like(parent, jsfunc(ptopo, value, indices))
    builder = _active_builder()
    if builder is not None and builder._obj is not None and \
            (builder._obj is parent or builder._obj.topo is ptopo):
        builder._obj = result
    return result


def fillet(objects, radius):
    return _edge_op(objects, w.FilletEdges, radius, 'fillet')


def chamfer(objects, length, length2=None, angle=None):
    if length2 is not None or angle is not None:
        raise NotImplementedError('asymmetric chamfers are not supported in '
                                  'build123d-lite')
    return _edge_op(objects, w.ChamferEdges, length, 'chamfer')


def offset(objects=None, amount=0, openings=None, kind=Kind.ARC,
           side=None, min_edge_length=None, mode=Mode.REPLACE):
    if kind == Kind.TANGENT:
        raise NotImplementedError('Kind.TANGENT offsets are not supported in '
                                  'build123d-lite')
    join = 'intersection' if kind == Kind.INTERSECTION else 'arc'
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('offset: nothing to offset')
    if openings is not None:
        # hollow the solid, removing the opening faces (MakeThickSolid —
        # the same operation build123d performs)
        if len(targets) != 1:
            raise ValueError('offset(openings=...) expects a single target')
        target = targets[0]
        faces = [o.topo for o in _tolist(openings)]
        result = _wrap_like(target,
                            w.ThickSolidOffset(_topo(target), faces, amount, 1e-4))
        return _combine(builder, result, mode)
    results = []
    for t in targets:
        results.append(_wrap_like(t, w.Offset(_topo(t), amount, 1e-4, False, join)))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def _mirror_point(p, o, n):
    d = 2.0 * ((p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2])
    return (p[0] - d * n[0], p[1] - d * n[1], p[2] - d * n[2])


def mirror(objects=None, about=Plane.XZ, mode=Mode.ADD):
    builder = _active_builder()
    # Inside BuildLine (or on spec-carrying curves) mirror at the SEGMENT
    # level so make_face()/sweep() can still chain the result exactly.
    if isinstance(builder, BuildLine) or (
            objects is not None and
            all(isinstance(t, Curve) and t._specs for t in _tolist(objects))):
        if objects is None:
            src = list(builder._specs)
        else:
            src = []
            for t in _tolist(objects):
                if not (isinstance(t, Curve) and t._specs):
                    raise NotImplementedError('mirror inside BuildLine needs '
                                              'segment-based curves')
                src.extend(t._specs)
        o = tuple(about.origin)
        n = tuple(about.z_dir)

        def _mirror_dir(d):
            dd = 2.0 * (d[0] * n[0] + d[1] * n[1] + d[2] * n[2])
            return (d[0] - dd * n[0], d[1] - dd * n[1], d[2] - dd * n[2])

        def _mirror_seg(s):
            m = _seg_transform(s, lambda p: _mirror_point(p, o, n), _mirror_dir)
            params = _seg_params(m)
            if params is not None:
                # reflecting xdir AND normal keeps the frame right-handed but
                # maps ellipse angle a -> -a: swap and negate the arc range
                params[5], params[6] = -params[6], -params[5]
            return m
        specs = [_mirror_seg(s) for s in src]
        curve = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
        if isinstance(builder, BuildLine) and mode == Mode.ADD:
            builder._specs.extend(specs)
        return curve
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('mirror: nothing to mirror')
    o = tuple(about.origin)
    n = list(about.z_dir)
    shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
    results = []
    for t in targets:
        topo = _topo(t)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo, True)
            topo = w.Mirror(n, topo)
        else:
            topo = w.Mirror(n, topo, True)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        results.append(_wrap_like(t, topo))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def split(objects=None, bisect_by=Plane.XZ, keep=Keep.TOP, mode=Mode.REPLACE):
    if keep not in (Keep.TOP, Keep.BOTTOM):
        raise NotImplementedError('split keep=' + str(keep) +
                                  ' is not supported in build123d-lite')
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('split: nothing to split')
    results = []
    for t in targets:
        topo = _topo(t)
        bb = list(w.BoundingBox(topo, 0.01))
        size = 4.0 * max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2],
                         abs(bb[0]), abs(bb[3]), abs(bb[1]), abs(bb[4]),
                         abs(bb[2]), abs(bb[5]), 1.0)
        half = w.Box(size, size, size, True)
        zshift = size / 2.0 if keep == Keep.TOP else -size / 2.0
        half = w.Translate([0, 0, zshift], half)
        half_shape = bisect_by.location * Part(half)
        results.append(_wrap_like(t, w.Intersection([topo, half_shape.topo])))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def scale(objects=None, by=1, mode=Mode.REPLACE):
    if not isinstance(by, (int, float)):
        f = tuple(by)
        if abs(f[0] - f[1]) > 1e-9 or abs(f[0] - f[2]) > 1e-9:
            raise NotImplementedError('non-uniform scale is not supported in '
                                      'build123d-lite')
        by = f[0]
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    results = [_wrap_like(t, w.Scale(by, _topo(t))) for t in targets]
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def add(objects, rotation=None, clean=True, mode=Mode.ADD):
    builder = _active_builder()
    if builder is None:
        raise ValueError('add() requires an active builder context')
    objs = _tolist(objects)
    # 2D objects added to a BuildPart become pending sketch faces (build123d)
    def _is_2d(o):
        if not (isinstance(o, Shape) and o.topo is not None):
            return False
        count = [0]
        def _cb(i, s):
            count[0] += 1
        w.ForEachSolid(o.topo, _cb)
        return count[0] == 0 and len(o.faces()) > 0
    if isinstance(builder, BuildPart) and mode == Mode.ADD and \
            all(_is_2d(o) for o in objs):
        for o in objs:
            for f in o.faces():
                n = w._faceNormal(f.topo)
                c = w._faceCentroid(f.topo)
                builder.pending_faces.append(
                    (Sketch(f.topo), Plane(origin=tuple(c), z_dir=tuple(n))))
        return objs[0] if len(objs) == 1 else ShapeList(objs)
    results = []
    for o in objs:
        s = _wrap_like(o, _topo(o))
        if rotation is not None:
            r = tuple(rotation) if not isinstance(rotation, (int, float)) else (0, 0, rotation)
            s = Rotation(r[0], r[1], r[2]) * s
        # replicate at location contexts / workplanes like object creation
        locs = _ctx_locations()
        planes = builder.workplanes if isinstance(builder, BuildPart) else [Plane.XY]
        placed = []
        for pl in planes:
            for loc in locs:
                placed.append((pl.location * loc) * _wrap_like(s, w.Translate([0, 0, 0], s.topo, True)))
        results.append(placed[0] if len(placed) == 1 else placed[0] + placed[1:])
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def make_face(edges=None, mode=Mode.ADD):
    builder = _active_builder(BuildSketch)
    if edges is None:
        if builder is None or not builder.pending_edge_specs:
            raise ValueError('make_face: no pending edges (draw with '
                             'BuildLine inside BuildSketch first)')
        specs = builder.pending_edge_specs
        builder.pending_edge_specs = []
    else:
        specs = []
        for e in _tolist(edges):
            if isinstance(e, Curve) and e._specs:
                specs.extend(e._specs)
            else:
                raise NotImplementedError('make_face from raw edges without '
                                          'segment data')
    chained = _chain_segments(specs)
    wire = w.WireFromSegments(chained)
    face = w.MakeFace(wire)
    # normalize XY-planar faces to a +Z normal (build123d faces from wires
    # come out +Z regardless of the chained winding; ours follow the wire)
    n = w._faceNormal(face)
    bb = w.BoundingBox(face)
    if n[2] < -0.5 and bb and abs(bb[5] - bb[2]) < 1e-9:
        rev = [_seg_reverse(s) for s in reversed(chained)]
        face = w.MakeFace(w.WireFromSegments(rev))
    return _combine(builder, Sketch(face), mode)


def bounding_box(objects=None, mode=Mode.PRIVATE):
    """The bounding box as an object: a Rectangle sketch for 2D input, a Box
    part for 3D (build123d's bounding_box operation)."""
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('bounding_box: nothing to measure')
    results = []
    for t in targets:
        bb = list(w.BoundingBox(_topo(t)))
        flat = abs(bb[5] - bb[2]) < 1e-9
        if flat:
            face = w.Polygon([[bb[0], bb[1], bb[2]], [bb[3], bb[1], bb[2]],
                              [bb[3], bb[4], bb[2]], [bb[0], bb[4], bb[2]]])
            results.append(Sketch(face))
        else:
            box = w.Translate([(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2,
                               (bb[2] + bb[5]) / 2],
                              w.Box(bb[3] - bb[0], bb[4] - bb[1],
                                    bb[5] - bb[2], True))
            results.append(Part(box))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def make_hull(*args, **kwargs):
    raise NotImplementedError('make_hull is not supported in build123d-lite')


def project(*args, **kwargs):
    raise NotImplementedError('project is not supported in build123d-lite')


def thicken(*args, **kwargs):
    raise NotImplementedError('thicken is not supported in build123d-lite')


def section(*args, **kwargs):
    raise NotImplementedError('section is not supported in build123d-lite')


# --------------------------------------------------- joints & exporters ---

def _unsupported(name):
    def f(*args, **kwargs):
        raise NotImplementedError(name + ' is not supported in build123d-lite')
    return f


RigidJoint = _unsupported('RigidJoint')
RevoluteJoint = _unsupported('RevoluteJoint')
LinearJoint = _unsupported('LinearJoint')
CylindricalJoint = _unsupported('CylindricalJoint')
BallJoint = _unsupported('BallJoint')
Mesher = _unsupported('Mesher')
ExportSVG = _unsupported('ExportSVG')
ExportDXF = _unsupported('ExportDXF')
import_step = _unsupported('import_step')
import_stl = _unsupported('import_stl')
import_svg = _unsupported('import_svg')


def export_stl(*args, **kwargs):
    print('build123d-lite: export_stl is a no-op in the browser')
    return True


def export_step(*args, **kwargs):
    print('build123d-lite: export_step is a no-op in the browser')
    return True


def export_gltf(*args, **kwargs):
    print('build123d-lite: export_gltf is a no-op in the browser')
    return True


class Color:
    def __init__(self, *args, **kwargs):
        self.args = args


def _pack2d(objects, width_fn, length_fn):
    """Growing rectangle packer (port of build123d.pack_utils._pack2d, which
    is itself a port of jakesgordon/bin-packing packer.growing.js)."""
    class _Node:
        def __init__(self, x=0.0, y=0.0, w=0.0, h=0.0):
            self.used = False
            self.x, self.y, self.w, self.h = x, y, w, h
            self.down = None
            self.right = None

    sizes = sorted(((o, width_fn(o), length_fn(o)) for o in objects),
                   key=lambda t: max(t[1], t[2]), reverse=True)
    root = _Node(w=sizes[0][1], h=sizes[0][2])

    def find_node(start, ww, hh):
        if start is None:
            return None
        if start.used:
            return find_node(start.right, ww, hh) or find_node(start.down, ww, hh)
        if ww <= start.w and hh <= start.h:
            return start
        return None

    def split_node(node, ww, hh):
        node.used = True
        node.down = _Node(node.x, node.y + hh, node.w, node.h - hh)
        node.right = _Node(node.x + ww, node.y, node.w - ww, hh)
        return node

    def grow_node(ww, hh):
        nonlocal root
        can_down = ww <= root.w
        can_right = hh <= root.h
        should_right = can_right and (root.h >= (root.w + ww))
        should_down = can_down and (root.w >= (root.h + hh))
        if should_right:
            return grow_right(ww, hh)
        if should_down:
            return grow_down(ww, hh)
        if can_right:
            return grow_right(ww, hh)
        if can_down:
            return grow_down(ww, hh)
        return None

    def grow_right(ww, hh):
        nonlocal root
        new_root = _Node(0, 0, root.w + ww, root.h)
        new_root.used = True
        new_root.down = root
        new_root.right = _Node(root.w, 0, ww, root.h)
        root = new_root
        node = find_node(root, ww, hh)
        return split_node(node, ww, hh) if node else None

    def grow_down(ww, hh):
        nonlocal root
        new_root = _Node(0, 0, root.w, root.h + hh)
        new_root.used = True
        new_root.right = root
        new_root.down = _Node(0, root.h, root.w, hh)
        root = new_root
        node = find_node(root, ww, hh)
        return split_node(node, ww, hh) if node else None

    placements = {}
    for (o, ww, hh) in sizes:
        node = find_node(root, ww, hh)
        node = split_node(node, ww, hh) if node else grow_node(ww, hh)
        placements[id(o)] = (node.x, node.y)
    return [placements[id(o)] for o in objects]


def pack(objects, padding, align_z=False):
    """Arrange shapes compactly in Plane.XY (port of build123d.pack.pack)."""
    objects = list(objects)
    bbs = {id(o): o.bounding_box() for o in objects}
    translations = _pack2d(
        objects,
        lambda o: bbs[id(o)].size.X + padding,
        lambda o: bbs[id(o)].size.Y + padding)
    out = []
    for o, t in zip(objects, translations):
        bb = bbs[id(o)]
        dz = -bb.min.Z if align_z else 0.0
        out.append(Pos(t[0] - bb.min.X, t[1] - bb.min.Y, dz) * o)
    return out


# --------------------------------------------------- measurement / show ---

def volume(shape):
    """Absolute volume of a shape in mm^3."""
    return abs(w.Volume(_topo(shape)))


def show(*shapes, **kwargs):
    """Ensure shapes are in the render scene (build123d-sandbox compat).
    Extra viewer kwargs (names=, colors=, ...) are accepted and ignored.
    Membership is tested with 'is' — Brython compares the underlying JS
    objects, so it works across wrapper instances."""
    flat = []
    for s in shapes:
        if isinstance(s, (list, tuple, ShapeList)):
            flat.extend(s)
        else:
            flat.append(s)
    for s in flat:
        if isinstance(s, Builder):
            s = s._obj
        try:
            topo = _topo(s)
        except (TypeError, ValueError):
            continue
        if not any(existing is topo for existing in w.sceneShapes):
            w.sceneShapes.push(topo)


def show_object(shape, name=None, options=None, **kwargs):
    """CQ-editor style alias for show()."""
    show(shape)


def show_all(*args, **kwargs):
    pass


def _json_num(x):
    x = float(x)
    if x != x or x in (float('inf'), float('-inf')):
        return 'null'
    return repr(x)


def _measure_globals_json(g):
    """Measure every module-level Shape / builder result in the given globals
    dict via the worker's MeasureShape hook; returns a JSON object string
    {name: {volume, area, faces, edges, bbox:[6]}} keyed by variable name.
    Mirrors the convention of test/b123d-validation/reference.py so lite and
    real build123d runs can be compared per variable name."""
    entries = []

    def measure(name, obj):
        try:
            topo = _topo(obj)
            m = w.MeasureShape(topo)
        except Exception as exc:  # noqa: BLE001 - report, never crash the run
            entries.append('"' + name + '":{"measure_error":"' +
                           str(exc).replace('"', "'")[:120] + '"}')
            return
        if m is None:
            entries.append('"' + name + '":{"measure_error":"null shape"}')
            return
        bbox = 'null'
        if m.bbox:
            bbox = '[' + ','.join([_json_num(v) for v in m.bbox]) + ']'
        entries.append('"' + name + '":{' +
                       '"volume":' + _json_num(m.volume) +
                       ',"area":' + _json_num(m.area) +
                       ',"faces":' + str(int(m.faces)) +
                       ',"edges":' + str(int(m.edges)) +
                       ',"bbox":' + bbox + '}')

    for name, obj in list(g.items()):
        if name.startswith('_') or name in ('show', 'show_object', 'show_all'):
            continue
        if isinstance(obj, Builder):
            if obj._obj is not None and obj._obj.topo is not None:
                measure(name, obj._obj)
        elif isinstance(obj, Shape):
            if obj.topo is not None:
                measure(name, obj)
        elif isinstance(obj, (list, tuple)) and len(obj) > 0 and \
                all(isinstance(x, Shape) for x in obj):
            # Skip face-less elements (edge/vertex selector lists) and sort
            # the rest by bbox center: element ORDER frequently differs
            # between build123d and lite (selector traversal, location list
            # iteration), so per-index comparison would otherwise be noise.
            # reference.py applies the same rule.
            solids = [x for x in obj
                      if x.topo is not None and len(x.faces()) > 0]
            def _bbkey(x):
                bb = w.BoundingBox(x.topo, 0.01)
                if not bb:
                    return (0.0, 0.0, 0.0)
                return (round((bb[0] + bb[3]) / 2, 3),
                        round((bb[1] + bb[4]) / 2, 3),
                        round((bb[2] + bb[5]) / 2, 3))
            solids = sorted(solids[:64], key=_bbkey)
            for i, x in enumerate(solids):
                measure(name + '[' + str(i) + ']', x)
    return '{' + ','.join(entries) + '}'
`;

// Small stdlib shims registered as importable Brython modules. brython.js
// ships `math` as a built-in JS module but the import machinery cannot load
// it inside a module worker, and brython_stdlib.js (pure-Python stdlib) is
// deliberately not shipped — these cover what the build123d examples use.
export const PY_SHIM_MODULES = {
  math: `
# math shim delegating to the JS Math object (build123d-lite worker)
from browser import self as _w

pi = 3.141592653589793
e = 2.718281828459045
tau = 6.283185307179586
inf = float('inf')
nan = float('nan')


def sin(x): return _w.Math.sin(x)
def cos(x): return _w.Math.cos(x)
def tan(x): return _w.Math.tan(x)
def asin(x): return _w.Math.asin(x)
def acos(x): return _w.Math.acos(x)
def atan(x): return _w.Math.atan(x)
def atan2(y, x): return _w.Math.atan2(y, x)
def sinh(x): return _w.Math.sinh(x)
def cosh(x): return _w.Math.cosh(x)
def tanh(x): return _w.Math.tanh(x)
def sqrt(x): return _w.Math.sqrt(x)
def exp(x): return _w.Math.exp(x)
def fabs(x): return abs(float(x))
def floor(x): return int(_w.Math.floor(x))
def ceil(x): return int(_w.Math.ceil(x))
def trunc(x): return int(_w.Math.trunc(x))
def radians(x): return x * 0.017453292519943295
def degrees(x): return x * 57.29577951308232
def hypot(*a):
    s = 0.0
    for v in a:
        s += v * v
    return _w.Math.sqrt(s)
def log(x, base=None):
    if base is None:
        return _w.Math.log(x)
    return _w.Math.log(x) / _w.Math.log(base)
def log2(x): return _w.Math.log2(x)
def log10(x): return _w.Math.log10(x)
def pow(x, y): return _w.Math.pow(x, y)
def fmod(x, y): return x - y * int(x / y) if y != 0 else nan
def copysign(x, y): return abs(x) * (1.0 if y >= 0 else -1.0)
def isclose(a, b, rel_tol=1e-09, abs_tol=0.0):
    return abs(a - b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)
def isnan(x): return x != x
def isinf(x): return x == inf or x == -inf
def isfinite(x): return not (isnan(x) or isinf(x))
def gcd(a, b):
    a, b = abs(int(a)), abs(int(b))
    while b:
        a, b = b, a % b
    return a
def factorial(n):
    r = 1
    for i in range(2, int(n) + 1):
        r *= i
    return r
def dist(p, q):
    return sqrt(sum((a - b) ** 2 for a, b in zip(p, q)))
def prod(it, start=1):
    r = start
    for v in it:
        r *= v
    return r
`,
  copy: `
# copy shim: shallow/deep copies; build123d-lite Shapes copy via _lite_copy
def copy(x):
    if hasattr(x, '_lite_copy'):
        return x._lite_copy()
    if hasattr(x, '__copy__'):
        return x.__copy__()
    if isinstance(x, list):
        return list(x)
    if isinstance(x, dict):
        return dict(x)
    if isinstance(x, set):
        return set(x)
    return x


def deepcopy(x, memo=None):
    if hasattr(x, '_lite_copy'):
        return x._lite_copy()
    if hasattr(x, '__deepcopy__'):
        return x.__deepcopy__(memo)
    if isinstance(x, list):
        return [deepcopy(v, memo) for v in x]
    if isinstance(x, tuple):
        return tuple(deepcopy(v, memo) for v in x)
    if isinstance(x, dict):
        return dict((deepcopy(k, memo), deepcopy(v, memo)) for k, v in x.items())
    if isinstance(x, set):
        return set(deepcopy(v, memo) for v in x)
    return x
`,
  typing: `
# typing shim: annotations only — subscripting returns the object itself
class _AnyType:
    def __getitem__(self, item):
        return self

    def __call__(self, *a, **k):
        return self


Any = _AnyType()
Union = _AnyType()
Optional = _AnyType()
Literal = _AnyType()
Callable = _AnyType()
Iterable = _AnyType()
Iterator = _AnyType()
Sequence = _AnyType()
List = _AnyType()
Dict = _AnyType()
Tuple = _AnyType()
Set = _AnyType()
Type = _AnyType()
TypeVar = lambda *a, **k: _AnyType()
cast = lambda t, v: v
TYPE_CHECKING = False
`,
  functools: `
# functools shim (pure Python subset)
def reduce(fn, it, *init):
    items = iter(it)
    if init:
        acc = init[0]
    else:
        acc = next(items)
    for v in items:
        acc = fn(acc, v)
    return acc


def partial(fn, *pargs, **pkw):
    def inner(*args, **kw):
        merged = dict(pkw)
        merged.update(kw)
        return fn(*(pargs + args), **merged)
    return inner


def lru_cache(maxsize=None, typed=False):
    def deco(fn):
        cache = {}

        def inner(*args):
            if args in cache:
                return cache[args]
            r = fn(*args)
            cache[args] = r
            return r
        return inner
    if callable(maxsize):
        return deco(maxsize)
    return deco


def wraps(wrapped):
    def deco(fn):
        return fn
    return deco


def cmp_to_key(cmp):
    class K:
        def __init__(self, obj, *a):
            self.obj = obj

        def __lt__(self, other):
            return cmp(self.obj, other.obj) < 0

        def __eq__(self, other):
            return cmp(self.obj, other.obj) == 0
    return K
`,
  itertools: `
# itertools shim (pure Python subset)
def product(*iterables, repeat=1):
    pools = [tuple(p) for p in iterables] * repeat
    result = [[]]
    for pool in pools:
        result = [x + [y] for x in result for y in pool]
    for prod_item in result:
        yield tuple(prod_item)


def chain(*iterables):
    for it in iterables:
        for v in it:
            yield v


def repeat(obj, times=None):
    if times is None:
        while True:
            yield obj
    else:
        for _ in range(times):
            yield obj


def count(start=0, step=1):
    n = start
    while True:
        yield n
        n += step


def islice(it, *args):
    if len(args) == 1:
        start, stop, step = 0, args[0], 1
    elif len(args) == 2:
        start, stop, step = args[0], args[1], 1
    else:
        start, stop, step = args
    for i, v in enumerate(it):
        if stop is not None and i >= stop:
            return
        if i >= start and (i - start) % step == 0:
            yield v


def combinations(iterable, r):
    pool = tuple(iterable)
    n = len(pool)
    if r > n:
        return
    indices = list(range(r))
    yield tuple(pool[i] for i in indices)
    while True:
        for i in reversed(range(r)):
            if indices[i] != i + n - r:
                break
        else:
            return
        indices[i] += 1
        for j in range(i + 1, r):
            indices[j] = indices[j - 1] + 1
        yield tuple(pool[i] for i in indices)


def permutations(iterable, r=None):
    pool = tuple(iterable)
    n = len(pool)
    r = n if r is None else r
    for idx in product(range(n), repeat=r):
        if len(set(idx)) == r:
            yield tuple(pool[i] for i in idx)


def cycle(iterable):
    saved = []
    for v in iterable:
        yield v
        saved.append(v)
    while saved:
        for v in saved:
            yield v


def zip_longest(*iterables, fillvalue=None):
    its = [iter(i) for i in iterables]
    while True:
        row = []
        done = 0
        for it in its:
            try:
                row.append(next(it))
            except StopIteration:
                row.append(fillvalue)
                done += 1
        if done == len(its):
            return
        yield tuple(row)
`,
  operator: `
# operator shim (pure Python subset)
def add(a, b): return a + b
def sub(a, b): return a - b
def mul(a, b): return a * b
def truediv(a, b): return a / b
def neg(a): return -a
def and_(a, b): return a & b
def or_(a, b): return a | b
def eq(a, b): return a == b
def lt(a, b): return a < b
def le(a, b): return a <= b
def gt(a, b): return a > b
def ge(a, b): return a >= b


def itemgetter(*items):
    if len(items) == 1:
        key = items[0]
        return lambda obj: obj[key]
    return lambda obj: tuple(obj[k] for k in items)


def attrgetter(*attrs):
    def resolve(obj, name):
        for part in name.split('.'):
            obj = getattr(obj, part)
        return obj
    if len(attrs) == 1:
        return lambda obj: resolve(obj, attrs[0])
    return lambda obj: tuple(resolve(obj, a) for a in attrs)


def methodcaller(name, *args, **kwargs):
    return lambda obj: getattr(obj, name)(*args, **kwargs)
`,
  timeit: `
# timeit shim (wall-clock via JS Date)
from browser import self as _w


def default_timer():
    return _w.Date.now() / 1000.0


def timeit(stmt='pass', setup='pass', number=1000000, globals=None):
    raise NotImplementedError('timeit.timeit is not supported in the worker')


class Timer:
    def __init__(self, *a, **k):
        pass

    def timeit(self, number=1000000):
        raise NotImplementedError('timeit.Timer is not supported in the worker')
`,
  random: `
# random shim: exact CPython semantics (MT19937 + 53-bit random()) so that
# seeded scripts reproduce the reference geometry bit-for-bit
class _MT:
    def __init__(self):
        self.mt = [0] * 624
        self.index = 625
        self.seed_int(5489)

    def seed_int(self, s):
        self.mt[0] = s & 0xFFFFFFFF
        for i in range(1, 624):
            self.mt[i] = (1812433253 * (self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) + i) & 0xFFFFFFFF
        self.index = 624

    def init_by_array(self, key):
        self.seed_int(19650218)
        i, j = 1, 0
        k = max(624, len(key))
        while k:
            self.mt[i] = ((self.mt[i] ^ ((self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) * 1664525)) + key[j] + j) & 0xFFFFFFFF
            i += 1
            j += 1
            if i >= 624:
                self.mt[0] = self.mt[623]
                i = 1
            if j >= len(key):
                j = 0
            k -= 1
        k = 623
        while k:
            self.mt[i] = ((self.mt[i] ^ ((self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) * 1566083941)) - i) & 0xFFFFFFFF
            i += 1
            if i >= 624:
                self.mt[0] = self.mt[623]
                i = 1
            k -= 1
        self.mt[0] = 0x80000000

    def genrand(self):
        if self.index >= 624:
            for i in range(624):
                y = (self.mt[i] & 0x80000000) + (self.mt[(i + 1) % 624] & 0x7FFFFFFF)
                self.mt[i] = self.mt[(i + 397) % 624] ^ (y >> 1)
                if y % 2:
                    self.mt[i] ^= 2567483615
            self.index = 0
        y = self.mt[self.index]
        self.index += 1
        y ^= y >> 11
        y ^= (y << 7) & 2636928640
        y ^= (y << 15) & 4022730752
        y ^= y >> 18
        return y


_state = _MT()


def seed(a=None):
    if a is None:
        import time
        a = 0
    if isinstance(a, int):
        # CPython: init_by_array over the absolute value's 32-bit chunks
        v = abs(a)
        key = []
        while True:
            key.append(v & 0xFFFFFFFF)
            v >>= 32
            if v == 0:
                break
        _state.init_by_array(key)
    else:
        raise NotImplementedError('random.seed only supports ints here')


def random():
    a = _state.genrand() >> 5
    b = _state.genrand() >> 6
    return (a * 67108864.0 + b) / 9007199254740992.0


def getrandbits(k):
    if k <= 32:
        return _state.genrand() >> (32 - k)
    out = 0
    shift = 0
    while k > 0:
        take = min(k, 32)
        out |= (_state.genrand() >> (32 - take)) << shift
        shift += take
        k -= take
    return out


def _randbelow(n):
    if n <= 0:
        return 0
    k = n.bit_length()
    r = getrandbits(k)
    while r >= n:
        r = getrandbits(k)
    return r


def randrange(start, stop=None, step=1):
    if stop is None:
        return _randbelow(start)
    width = stop - start
    if step == 1:
        return start + _randbelow(width)
    n = (width + step - 1) // step
    return start + step * _randbelow(n)


def randint(a, b):
    return randrange(a, b + 1)


def uniform(a, b):
    return a + (b - a) * random()


def choice(seq):
    return seq[_randbelow(len(seq))]


def shuffle(x):
    for i in range(len(x) - 1, 0, -1):
        j = _randbelow(i + 1)
        x[i], x[j] = x[j], x[i]
`,
  logging: `
# logging shim: swallows everything (worker console is used via print)
DEBUG = 10
INFO = 20
WARNING = 30
ERROR = 40
CRITICAL = 50


class _Logger:
    def debug(self, *a, **k): pass
    def info(self, *a, **k): pass
    def warning(self, *a, **k): pass
    def error(self, *a, **k): pass
    def critical(self, *a, **k): pass
    def exception(self, *a, **k): pass
    def setLevel(self, *a, **k): pass
    def addHandler(self, *a, **k): pass


_logger = _Logger()


def getLogger(name=None):
    return _logger


def basicConfig(*a, **k):
    pass


def debug(*a, **k):
    pass


def info(*a, **k):
    pass


def warning(*a, **k):
    pass


def error(*a, **k):
    pass


def critical(*a, **k):
    pass


def exception(*a, **k):
    pass
`,
};
