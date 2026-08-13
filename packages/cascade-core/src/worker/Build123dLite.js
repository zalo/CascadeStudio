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
_TOL_1E6 = 1e-6      # build123d's TOLERANCE


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


class Unit:
    """Standard units (build123d's Unit enum) — Mesher(unit=...)."""
    MC = 'MC'
    MM = 'MM'
    CM = 'CM'
    M = 'M'
    IN = 'IN'
    FT = 'FT'


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


class LineType:
    CONTINUOUS = 'CONTINUOUS'
    CENTER = 'CENTER'
    DASHED = 'DASHED'
    DOT = 'DOT'
    HIDDEN = 'HIDDEN'
    PHANTOM = 'PHANTOM'
    ISO_DASH = 'ISO_DASH'
    ISO_DOT = 'ISO_DOT'
    ISO_DASH_DOT = 'ISO_DASH_DOT'
    ISO_LONG_DASH_DOT = 'ISO_LONG_DASH_DOT'


class FontStyle:
    REGULAR = 'REGULAR'
    BOLD = 'BOLD'
    ITALIC = 'ITALIC'
    BOLDITALIC = 'BOLDITALIC'


# Type aliases build123d exports for annotations (used in signatures of
# user subclasses like the PlatonicSolid example); the actual accepted
# values are whatever the receiving function converts.
VectorLike = tuple
RotationLike = tuple


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

    def get_signed_angle(self, vec, normal=None):
        """Signed angle in DEGREES between this vector and vec about normal
        (default -Z, like build123d): atan2((Va x Vb) . Vn, Va . Vb)."""
        n = Vector(0, 0, -1) if normal is None else Vector(normal)
        b = Vector(vec)
        return math.degrees(math.atan2(self.cross(b).dot(n), self.dot(b)))

    def reverse(self):
        return -self

    def rotate(self, axis, angle):
        """This vector rotated angle degrees about the given Axis DIRECTION
        (the joint math only ever rotates direction vectors)."""
        R = _axis_angle_mat(tuple(axis.direction), angle)
        return Vector(_mat_vec(R, self._v))

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

    @property
    def x_axis(self):
        """Axis along this location's local X (build123d Location.x_axis)."""
        R = self._R
        return Axis(self._t, (R[0][0], R[1][0], R[2][0]))

    @property
    def y_axis(self):
        R = self._R
        return Axis(self._t, (R[0][1], R[1][1], R[2][1]))

    @property
    def z_axis(self):
        R = self._R
        return Axis(self._t, (R[0][2], R[1][2], R[2][2]))

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
            moved._loc = self * other.location
            if isinstance(moved, Curve) and moved._specs:
                # keep segment data consistent with the moved geometry so
                # make_face()/sweep() can still chain the result exactly
                fn_dir = lambda d: _mat_vec(self._R, d)
                try:
                    moved._specs = [_seg_transform(s, self._transform_point,
                                                   fn_dir)
                                    for s in moved._specs]
                except NotImplementedError:
                    # opaque 'raw' segments cannot be re-derived; the moved
                    # TOPO is still exact, only spec-level chaining is lost
                    moved._specs = []
            return moved
        if isinstance(other, (list, tuple, ShapeList)):
            return ShapeList([self * s for s in other])
        return NotImplemented

    def __neg__(self):
        """Flip the orientation without moving the origin (build123d -loc:
        Location(-Plane(self)), i.e. z and y reversed, x kept)."""
        return Location(-Plane(self))

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
        # Axis(edge): origin at the start, direction along the tangent.
        # (duck-typed on .topo — the Shape class is defined later in this
        # module, and Axis.X/Y/Z are created at module load)
        if hasattr(origin, 'topo') and origin.topo is not None:
            topo = origin.topo
            if topo.ShapeType().value != 6:
                es = origin.edges()
                topo = es[0].topo
            p = w._edgePointAt(topo, 0.0)
            t = w._edgeTangentAt(topo, 0.0)
            self.position = Vector(tuple(p))
            self.direction = Vector(tuple(t)).normalized()
            return
        self.position = Vector(origin)
        self.direction = Vector(direction).normalized()

    @property
    def origin(self):
        return self.position

    @property
    def location(self):
        """Location whose z axis is this axis (build123d Axis.location)."""
        return Plane(self.position, z_dir=self.direction).location

    def located(self, loc):
        """This axis placed by loc (build123d Axis.located)."""
        p = loc._transform_point(tuple(self.position))
        d = _mat_vec(loc._R, tuple(self.direction))
        return Axis(p, d)

    def is_parallel(self, other, angular_tolerance=1e-5):
        # tolerance in DEGREES, like build123d's Axis.is_parallel
        d = min(1.0, abs(self.direction.dot(other.direction)))
        return math.acos(d) <= math.radians(angular_tolerance) or \
            d > (1.0 - 1e-9)

    def is_normal(self, other, angular_tolerance=1e-5):
        d = min(1.0, abs(self.direction.dot(other.direction)))
        return abs(math.degrees(math.acos(d)) - 90.0) <= angular_tolerance

    def is_opposite(self, other, angular_tolerance=1e-5):
        d = max(-1.0, min(1.0, self.direction.dot(other.direction)))
        return abs(math.degrees(math.acos(d)) - 180.0) <= \
            max(angular_tolerance, 1e-4)

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


def _ortho_x_dir(z_dir, x_dir):
    """The x direction gp_Ax3(origin, z, x) actually adopts: x projected into
    the plane normal to z, normalized. build123d hands a possibly
    NON-perpendicular x_dir straight to gp_Ax3 (Plane.__init__), which
    orthogonalizes it — e.g. Face.location_at(point, x_dir=(1, 0, 0)) on a
    curved surface."""
    z = Vector(z_dir).normalized()
    x = Vector(x_dir)
    x = x - z * x.dot(z)
    ln = x.length
    if ln < 1e-12:
        raise ValueError('x_dir must not be parallel to z_dir')
    return x / ln


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
                self.x_dir = _ortho_x_dir(self.z_dir, tuple(u))
            else:
                self.x_dir = Vector(_default_x_dir(tuple(self.z_dir)))
            self.y_dir = self.z_dir.cross(self.x_dir)
            return
        self.origin = Vector(origin)
        self.z_dir = Vector(z_dir).normalized()
        if x_dir is None:
            self.x_dir = Vector(_default_x_dir(tuple(self.z_dir)))
        else:
            self.x_dir = _ortho_x_dir(self.z_dir, x_dir)
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

    def from_local_coords(self, pt):
        """A point given in this plane's local frame, in world coordinates
        (build123d Plane.from_local_coords)."""
        v = Vector(pt)
        return (self.origin + self.x_dir * v.X + self.y_dir * v.Y +
                self.z_dir * v.Z)

    def to_local_coords(self, pt):
        """The world point expressed in this plane's local frame."""
        d = Vector(pt) - self.origin
        return Vector(d.dot(self.x_dir), d.dot(self.y_dir), d.dot(self.z_dir))

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


def _solid_volume(t):
    """Sum of per-solid volumes (0 for shapes without solids) — matches
    build123d's volume on compounds and sidesteps the meaningless partial
    integrals VolumeProperties gives open faces."""
    return w.SolidsVolume(t)


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
        # graceful promotions like build123d: Shape(list_of_shapes) makes a
        # compound, Shape(other_shape) adopts its geometry
        if isinstance(topo, (list, tuple, ShapeList)):
            topos = [_topo(s) for s in topo
                     if not (isinstance(s, Shape) and s.topo is None)]
            if len(topos) == 0:
                topo = None
            elif len(topos) == 1:
                topo = topos[0]
            else:
                topo = w.MakeCompound(topos)
        elif isinstance(topo, Shape):
            topo = topo.topo
        self.topo = topo
        self.label = ''
        self.color = None
        self.children = []
        # build123d tracks a top-level Location on every shape; lite bakes
        # transforms into geometry but keeps the equivalent composed Location
        # here so joints / locate() / .position can reason about frames.
        self._loc = None  # None = identity
        self.joints = {}

    @property
    def wrapped(self):
        """The underlying raw (JS/OCCT) shape — build123d compat."""
        return self.topo

    # --- location bookkeeping (baked geometry + tracked frame) ---
    @property
    def location(self):
        return self._loc if self._loc is not None else Location()

    @location.setter
    def location(self, value):
        self.locate(value)

    @property
    def position(self):
        return self.location.position

    @position.setter
    def position(self, value):
        cur = self.location
        delta = Vector(value) - cur.position
        if self.topo is not None:
            self.topo = w.Translate([delta.X, delta.Y, delta.Z], self.topo)
        self._loc = Location._make(cur._R, tuple(Vector(value)))

    @property
    def orientation(self):
        return self.location.orientation

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
        vols = [_solid_volume(t) for t in topos]
        fused = w.Union(topos)
        # COMPROMISE(kernel-guard): this OCCT 8.0.1 wasm build has a known
        # kernel fault where BooleanFuse SILENTLY DROPS an operand when
        # coplanar faces meet along BSpline edges. The JS Union now detects
        # the drop and rebuilds the union from the General-Fuse partition
        # (whose split phase is unaffected); if even that fails, a valid
        # fuse can never be smaller than its largest input, so RAISE here
        # (never return silently-wrong geometry).
        if max(vols) > 1e-6:
            rv = _solid_volume(fused)
            if rv < max(vols) * 0.999 - 1e-9:
                raise RuntimeError(
                    'KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an '
                    'operand (result volume ' + repr(rv) + ' < largest '
                    'input ' + repr(max(vols)) + ') and the General-Fuse '
                    'rebuild could not recover it. This build\\'s '
                    'BooleanFuse mishandles coplanar BSpline-edged contact '
                    'faces; offset or restructure the touching geometry.')
        return _wrap_like(self, fused)

    def __iter__(self):
        """Iterate contained shapes like build123d Compound iteration:
        solids for 3D content, else faces, else edges."""
        if self.topo is None:
            return iter(())
        sol = self.solids()
        if len(sol) > 0:
            return iter(sol)
        fac = self.faces()
        if len(fac) > 0:
            return iter(fac)
        return iter(self.edges())

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

    def __neg__(self):
        """Reversed-orientation copy (build123d's Mixin2D.__neg__:
        TopoDS_Shape::Complemented). Defined on the base class because lite
        re-wraps transformed faces as Sketch (see _wrap_like), so -face and
        -sketch must both work; Face overrides it to stay a Face."""
        if self.topo is None:
            raise ValueError('Invalid Shape')
        return _wrap_like(self, w.ReverseShape(self.topo, True))

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

    def solid(self):
        ss = self.solids()
        return ss[0] if len(ss) > 0 else None

    # --- measurement ---
    @property
    def volume(self):
        if self.topo is None:
            return 0.0
        return w.SolidsVolume(self.topo)

    @property
    def area(self):
        if self.topo is None:
            return 0.0
        return w.SurfaceArea(self.topo)

    @property
    def length(self):
        if getattr(self, '_length_attr', None) is not None:
            return self._length_attr
        if self.topo is None:
            return 0.0
        return w.EdgeLength(self.topo)

    @length.setter
    def length(self, value):
        self._length_attr = value

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
        """Copy at the ABSOLUTE location loc (build123d semantics): the
        tracked location is replaced, so the delta loc * current⁻¹ is what
        gets applied to the baked geometry."""
        delta = loc * self.location.inverse()
        placed = delta * self
        placed._loc = Location(loc)
        return placed

    def move(self, loc):
        moved = loc * self
        self.topo = moved.topo
        self._loc = moved._loc
        # the segment specs travel with the geometry: mirror()/make_face()
        # rebuild from them, so stale specs would silently un-place the shape
        if isinstance(self, Curve):
            self._specs = moved._specs
        return self

    def locate(self, loc):
        placed = self.located(loc)
        self.topo = placed.topo
        self._loc = placed._loc
        if isinstance(self, Curve):
            self._specs = placed._specs
        return self

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

    def translate(self, v):
        return Pos(Vector(v)) * self

    def scale(self, factor, about=None):
        c = _v3(about) if about is not None else tuple(self.location.position)
        if not isinstance(factor, (int, float)):
            f = tuple(factor)
            return scale(self, f, about=c, mode=Mode.PRIVATE)
        return _wrap_like(self, w.ScaleUniform(self.topo, factor, list(c)))

    def mirror(self, mirror_plane=None):
        return mirror(self, about=mirror_plane or Plane.XZ, mode=Mode.PRIVATE)

    def project_to_shape(self, target, direction):
        """Delegate to Face.project_to_shape for every face of this shape
        (build123d defines projection per shape class; sketches project
        their faces)."""
        out = ShapeList()
        for f in self.faces():
            out.extend(Face(f.topo).project_to_shape(target, direction))
        return out

    def find_intersection_points(self, other, tolerance=1e-6):
        """(point, unit surface normal) pairs where the Axis crosses this
        shape's surface, sorted along the axis —
        BRepIntCurveSurface_Inter, like build123d."""
        hits = w.IntersectLineShape(self.topo, list(other.position),
                                    list(other.direction), tolerance)
        return [(Vector(tuple(h[0])), Vector(tuple(h[1]))) for h in hits]

    def project_faces(self, faces, path, start=0):
        """Project faces onto this shape following a path on the shape —
        upstream Shape.project_faces: each face is positioned on the
        surface-normal plane at its path position and projected inward."""
        path_length = path.length
        shape_center = self.center()
        if isinstance(faces, Shape):
            faces = faces.faces()
        faces = [f for f in faces]
        first_face_min_x = faces[0].bounding_box().min[0]
        projected = ShapeList()
        for face in faces:
            bbox = face.bounding_box()
            face_center_x = (bbox.min[0] + bbox.max[0]) / 2.0
            u = start + (face_center_x - first_face_min_x) / path_length
            path_position = path.position_at(u)
            path_tangent = path.tangent_at(u)
            axis = Axis(path_position, shape_center - path_position)
            surface_point, surface_normal = \
                self.find_intersection_points(axis)[0]
            pl = Plane(origin=surface_point, x_dir=path_tangent,
                       z_dir=surface_normal)
            projection_face = pl * face.moved(
                Location((-face_center_x, 0, 0)))
            projected.append(Face(projection_face.topo).project_to_shape(
                self, surface_normal * -1)[0])
        return projected

    def project_to_viewport(self, viewport_origin, viewport_up=(0, 0, 1),
                            look_at=None):
        """Hidden-line projection (HLRBRep): returns (visible, hidden)
        edge compounds like build123d."""
        vo = Vector(viewport_origin)
        target = Vector(look_at) if look_at is not None else \
            self.bounding_box().center()
        view_dir = (target - vo).normalized()
        vis, hid = w.HLRProject(self.topo, list(view_dir))
        return (Curve(vis).edges(), Curve(hid).edges())

    def is_valid(self):
        return self.topo is not None

    def clean(self):
        return self

    def _lite_copy(self):
        c = _wrap_like(self, self.topo)
        c._loc = self._loc
        c.label = self.label
        # copy.copy in build123d preserves joints REPARENTED to the copy
        # (shape_core.copy_attributes_to)
        if self.joints:
            c.joints = {k: j._lite_rebind(c) for k, j in self.joints.items()}
        c.children = list(self.children)
        return c

    def __copy__(self):
        return self._lite_copy()

    def __deepcopy__(self, memo=None):
        return self._lite_copy()


class Part(Shape):
    def __init__(self, topo=None):
        # Solid(Shell(faces)) sews the faces into a closed solid, and
        # Solid(other_shape) adopts its geometry — like build123d.
        if isinstance(topo, Shape):
            fl = getattr(topo, '_face_shapes', None) \
                if isinstance(topo, Shell) else None
            if fl:
                topo = w.SewSolidFromFaces([_topo(f) for f in fl])
            else:
                topo = topo.topo
        Shape.__init__(self, topo)

    @classmethod
    def extrude(cls, obj, direction):
        """Extrude a Face into a Solid (build123d Solid.extrude)."""
        d = Vector(direction)
        return cls(w.Extrude(_topo(obj), [d.X, d.Y, d.Z], True))

    @classmethod
    def make_sphere(cls, radius, plane=None, angle1=-90, angle2=90,
                    angle3=360):
        """A sphere solid (full spheres only, like the examples use)."""
        if angle1 != -90 or angle2 != 90 or angle3 != 360:
            raise NotImplementedError(
                'partial spheres are not supported in build123d-lite')
        s = cls(w.Sphere(radius))
        if plane is not None:
            s = plane * s
            s._loc = None  # the plane is BAKED (upstream keeps identity)
        return s

    @classmethod
    def make_cylinder(cls, radius, height, plane=None, angle=360):
        """A cylinder solid with its base on the given plane's origin,
        extending along the plane normal (build123d Solid.make_cylinder)."""
        if angle != 360:
            raise NotImplementedError(
                'partial cylinders are not supported in build123d-lite')
        s = cls(w.Cylinder(radius, height, False))
        if plane is not None:
            s = plane * s
            s._loc = None  # the plane is BAKED (upstream keeps identity)
        return s

    @classmethod
    def make_loft(cls, objs, ruled=False):
        """Loft through wires (build123d Solid.make_loft)."""
        wires = []
        for o in objs:
            t = _topo(o)
            wires.append(t if t.ShapeType().value == 5
                         else w.GetWire(t, 0, True))
        return cls(w.Loft(wires))

    @classmethod
    def revolve(cls, section, angle=360, axis=None, inner_wires=None):
        """Revolve a Face/Wire section about an Axis
        (build123d Solid.revolve)."""
        if axis is None:
            axis = Axis.Z
        sec = section if isinstance(section, Face) or not inner_wires \
            else Face(section, list(inner_wires))
        o = tuple(axis.position)
        d = list(axis.direction)
        topo = _topo(sec)
        shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Revolve(topo, angle, d)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        return cls(topo)

    @classmethod
    def thicken(cls, surface, depth, normal_override=None):
        """Thicken a Face/Shell into a Solid along its normals — the exact
        BRepOffset construction of build123d's Solid.thicken (full offset
        shell, GeomAbs_Intersection join)."""
        f = surface
        d = float(depth)
        if normal_override is not None and isinstance(f, Face):
            n = f.normal_at()
            if n.dot(Vector(normal_override).normalized()) < 0:
                d = -d
        return cls(w.ThickenSolid(_topo(f), d))

    @classmethod
    def extrude_linear_with_rotation(cls, section, center=(0, 0, 0),
                                     normal=(0, 0, 1), angle=0,
                                     inner_wires=None):
        """Twisted prism: sweep along a straight spine with a helical
        auxiliary spine — the exact MakePipeShell construction of
        build123d's Solid.extrude_linear_with_rotation."""
        c = _v3(center)
        nvec = Vector(normal)
        h = nvec.length
        spine = w.WireFromSegments([('line', [list(c),
                                              list(Vector(c) + nvec)])])
        pitch = 360.0 / angle * h
        hel = Helix(pitch, h, 1, center=c,
                    direction=tuple(nvec.normalized()), mode=Mode.PRIVATE)
        aux = w.WireFromSegments(_chain_segments(hel._specs))
        if isinstance(section, Face):
            outer = w._faceOuterWire(section.topo)
            inner = [x.topo for x in section.inner_wires()]
        else:
            outer = _topo(section)
            inner = [_topo(x) for x in _tolist(inner_wires)]
        solid = w.PipeShellSweep([outer], spine, False, '', [], aux, False)
        if inner:
            tools = [w.PipeShellSweep([iw], spine, False, '', [], aux, False)
                     for iw in inner]
            solid = w.Difference(solid, tools)
        return cls(solid)


class Sketch(Shape):
    pass


class Curve(Shape):
    def __init__(self, topo=None, specs=None):
        if isinstance(topo, (list, tuple, ShapeList)):
            # Wire(edges) / Curve(edges): one chained wire from the edges
            sp = []
            for it in topo:
                if isinstance(it, Curve) and it._specs:
                    sp.extend(it._specs)
                elif isinstance(it, Shape):
                    sp.extend(_specs_from_topo_edges(it))
                else:
                    raise TypeError('Curve/Wire from a list expects edges')
            chained = _chain_segments(sp)
            Shape.__init__(self, w.WireFromSegments(chained))
            self._specs = chained
            return
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

    def _edge_chain(self):
        """This curve's edges in CONNECTION order: BRepTools_WireExplorer for
        a real wire (what build123d's BRepAdaptor_CompCurve follows), TopExp
        storage order for anything else."""
        if self.topo is not None and self.topo.ShapeType().value == 5:
            return list(w.OrderedEdges(self.topo))
        return list(w.Edges(self.topo).edges())

    def _walk(self, u, tangent):
        """Evaluate position/tangent at length-fraction u along the (possibly
        multi-edge) curve, orienting each edge to chain head-to-tail."""
        es = self._edge_chain()
        if len(es) == 1:
            fn = w._edgeTangentAt if tangent else w._edgePointAt
            return Vector(tuple(fn(es[0], float(u))))
        lens = [w._edgeLength(e) for e in es]
        ends = [(tuple(w._edgePointAt(e, 0.0)), tuple(w._edgePointAt(e, 1.0)))
                for e in es]
        # orient edges into a chain (WireFromSegments adds them in order,
        # but individual edges may run tip-to-tail reversed)
        flips = [False] * len(es)
        # In a real WIRE the edges above are in CONNECTION order, so the only
        # ambiguity left is the first edge's raw parametrization direction —
        # flip it when its start (not its end) is what touches the second edge.
        # (For a COMPOUND of edges the order itself is arbitrary, and the
        # greedy chaining below starting from edge 0 as-is is what matches
        # build123d's BRepAdaptor_CompCurve there.)
        if len(es) > 1 and self.topo.ShapeType().value == 5:
            a0, a1 = ends[0]
            b0, b1 = ends[1]
            if min(math.dist(a0, b0), math.dist(a0, b1)) < \
                    min(math.dist(a1, b0), math.dist(a1, b1)):
                flips[0] = True
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

    def position_at(self, u):
        """Point at length-fraction u along the wire (build123d
        Mixin1D.position_at; Edge overrides it to be orientation-aware)."""
        return self._walk(u, False)

    def tangent_at(self, u=0.5):
        return self._walk(u, True)

    def location_at(self, u, x_dir=None):
        """Location at length-fraction u: origin on the curve, z along the
        tangent (build123d convention for sweep section placement)."""
        pos = self._walk(u, False)
        tan = self._walk(u, True)
        if x_dir is not None:
            pl = Plane(pos, x_dir=Vector(x_dir), z_dir=tan)
        else:
            pl = Plane(pos, z_dir=tan)
        return pl.location

    def __xor__(self, u):  # curve ^ u -> location
        return self.location_at(u)

    def project_to_shape(self, target_object, direction=None, center=None):
        """Project this wire onto the surfaces of a shape, either along a
        direction or conically from a center point (pass exactly one) —
        BRepProj_Projection, like build123d's Wire.project_to_shape. One or
        more wires come back, nearest projection first."""
        if (direction is None) == (center is None):
            raise ValueError('Provide exactly one of direction or center')
        d = list(Vector(direction).normalized()) if direction is not None \
            else None
        c = list(Vector(center)) if center is not None else None
        out = w.ProjectWireOnShape(_topo(self), _topo(target_object), d, c)
        return ShapeList([Curve(t) for t in out])

    @property
    def is_closed(self):
        """Whether the wire/edge closes on itself (BRep_Tool::IsClosed)."""
        if self.topo is None:
            return False
        return bool(w._wireIsClosed(self.topo))

    def offset_2d(self, distance, kind=Kind.ARC, side=Side.BOTH, closed=True):
        """2D offset of this planar wire (build123d Wire.offset_2d).
        side=LEFT/RIGHT keeps only one side of the offset of an OPEN wire
        (the end caps and the other side are dropped); closed=True then joins
        that side back to the original line to make a closed region."""
        if kind == Kind.TANGENT:
            raise NotImplementedError('Kind.TANGENT offsets are not supported '
                                      'in build123d-lite')
        join = 'intersection' if kind == Kind.INTERSECTION else 'arc'
        line = self
        edges = line.edges()
        if len(edges) == 1:
            # BRepOffsetAPI_MakeOffset mishandles a single-edge wire, so split
            # it in half first (exactly build123d's workaround)
            halves = [edges[0].trim(0.0, 0.5), edges[0].trim(0.5, 1.0)]
            src = w.WireFromEdgesFixed([_topo(h) for h in halves], 1e-7)
        else:
            src = _topo(line)
        offset_topo = w.OffsetPlanarWire(src, distance, join)
        if offset_topo is None:
            raise RuntimeError('2D offset produced no wire')
        offset_wire = Curve(offset_topo)
        if side == Side.BOTH:
            oes = offset_wire.edges()
            return oes[0] if len(oes) == 1 else offset_wire

        # drop the semicircular end caps, then keep the side asked for
        endpoints = (line.position_at(0), line.position_at(1))

        def _is_end_cap(e):
            if e.geom_type != GeomType.CIRCLE:
                return False
            c = e.arc_center
            for pt in endpoints:
                if (c - pt).length < _TOL_1E6:
                    return True
            return False

        sides = edges_to_wires(offset_wire.edges().filter_by(_is_end_cap,
                                                            reverse=True))
        if len(sides) != 2:
            raise RuntimeError('one-sided offset expected two offset sides, '
                               'got ' + repr(len(sides)))
        tan0 = line.tangent_at(0)
        angles = [tan0.get_signed_angle(wr.position_at(0.5) - endpoints[0])
                  for wr in sides]
        if side == Side.LEFT:
            offset_wire = sides[int(angles[0] > angles[1])]
        else:
            offset_wire = sides[int(angles[0] <= angles[1])]

        if closed:
            self0, self1 = endpoints
            end0 = offset_wire.position_at(0)
            end1 = offset_wire.position_at(1)
            if (self0 - end0).length - abs(distance) <= _TOL_1E6:
                edge0 = Edge.make_line(self0, end0)
                edge1 = Edge.make_line(self1, end1)
            else:
                edge0 = Edge.make_line(self0, end1)
                edge1 = Edge.make_line(self1, end0)
            joined = list(line.edges()) + list(offset_wire.edges()) + \
                [edge0, edge1]
            offset_wire = Curve(w.WireFromEdgesFixed(
                [_topo(e) for e in joined], _TOL_1E6))

        oes = offset_wire.edges()
        return oes[0] if len(oes) == 1 else offset_wire

    def order_edges(self):
        """The edges in CONNECTION order (build123d Wire.order_edges —
        BRepTools_WireExplorer, not TopExp's storage order)."""
        return ShapeList([Edge(t) for t in w.OrderedEdges(self.topo)])

    @property
    def start_point(self):
        return self @ 0

    @property
    def end_point(self):
        return self @ 1

    @classmethod
    def make_polygon(cls, pts, close=True):
        """Closed polygonal wire through pts (build123d Wire.make_polygon)."""
        return Polyline(*[tuple(_v3(p)) for p in pts], close=close,
                        mode=Mode.PRIVATE)


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

    @classmethod
    def make_text(cls, txt, font_size, font='Arial', font_path=None,
                  font_style=None,
                  text_align=('center', 'center'),  # TextAlign values
                  align=None, position_on_path=0.0, text_path=None):
        """2D text as a compound of faces (build123d Compound.make_text).
        Like upstream, align defaults to None: only the Font_TextFormatter
        (advance-based) text_align applies, NOT bbox alignment."""
        if text_path is not None:
            raise NotImplementedError(
                'Compound.make_text(text_path=) is not supported in '
                'build123d-lite')
        t = Text(txt, font_size, font=font, font_path=font_path,
                 font_style=font_style if font_style is not None
                 else FontStyle.REGULAR,
                 text_align=text_align, align=align, mode=Mode.PRIVATE)
        res = cls.__new__(cls)
        Shape.__init__(res, t.topo)
        return res


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

    @property
    def is_forward(self):
        return bool(w._edgeIsForward(self.topo))

    @property
    def arc_center(self):
        """Center of a circular/elliptical edge (build123d Edge.arc_center)."""
        c = w._edgeArcCenter(self.topo)
        if c is None:
            raise ValueError('arc_center is only defined for circles and '
                             'ellipses')
        return Vector(tuple(c))

    def position_at(self, u):
        # orientation-aware like build123d (Axis(edge) stays raw-curve).
        # COMPROMISE(edge-orientation): which end of a selector edge is
        # FORWARD depends on the kernel's construction history, and OCCT
        # 8.0.1 (wasm) does not always orient sub-edges the way OCP 7.x
        # does — scripts that measure along Axis(edge) of a selected edge
        # (the joints examples) can legitimately land at the opposite end.
        uu = u if self.is_forward else 1.0 - u
        return Vector(tuple(w._edgePointAt(self.topo, float(uu))))

    def tangent_at(self, u=0.5):
        uu = u if self.is_forward else 1.0 - u
        t = Vector(tuple(w._edgeTangentAt(self.topo, float(uu))))
        return t if self.is_forward else -t

    def __matmul__(self, u):
        return self.position_at(u)

    def __mod__(self, u):
        return self.tangent_at(u)

    def project_to_shape(self, target_object, direction=None, center=None):
        """The projected EDGES of this edge on a shape (build123d
        Edge.project_to_shape flattens the projected wires to edges)."""
        wires = Curve.project_to_shape(self, target_object, direction, center)
        return wires.edges()

    def param_at(self, position=0.5):
        """The raw OCCT curve parameter at the normalized ARC-LENGTH position
        (build123d Edge.param_at; positions outside [0, 1] extrapolate)."""
        return w._edgeParam(self.topo, float(position))

    def trim(self, start, end):
        """A new edge keeping only the section between two normalized
        arc-length positions (build123d Edge.trim)."""
        return Edge(w.TrimEdge(self.topo, float(start), float(end)))

    def _extend_spline(self, at_start, surface_face, extension_factor=0.1):
        """A copy of this B-spline edge extended past one end by
        extension_factor of its length and snapped back onto the surface
        (build123d Edge._extend_spline)."""
        if self.geom_type != GeomType.BSPLINE:
            raise TypeError('_extend_spline only works with splines')
        topo = w.ExtendSplineOnFace(self.topo, bool(at_start),
                                    _topo(surface_face),
                                    float(extension_factor))
        if topo is None:
            raise RuntimeError('Failed to snap extended edge to surface')
        return Edge(topo)

    @classmethod
    def make_spline(cls, points, tangents=None, periodic=False,
                    parameters=None, scale=True, tol=1e-6):
        """Edge interpolating the points EXACTLY (GeomAPI_Interpolate, like
        build123d's Edge.make_spline). tangents are either the two end
        tangents or one per point."""
        pts = [list(_v3(p)) for p in points]
        tans = [list(_v3(t)) for t in tangents] if tangents else []
        return cls(w.InterpolatedEdge(pts, tans, bool(periodic), bool(scale)))

    @classmethod
    def make_line(cls, p1, p2):
        """Linear edge between two points (build123d Edge.make_line)."""
        seg = ('line', [list(_v3(p1)), list(_v3(p2))])
        wire = w.WireFromSegments([seg])
        edges = list(w.Edges(wire).edges())
        return cls(edges[0])

    @classmethod
    def make_mid_way(cls, first, second, middle=0.5):
        """Linear edge a fractional distance between two edges
        (build123d Edge.make_mid_way, flip-aware)."""
        flip = Axis(first).is_opposite(Axis(second))
        pnts = []
        for i in (0.0, 1.0):
            a = first.position_at(i)
            b = second.position_at(1.0 - i if flip else i)
            pnts.append(a + (b - a) * middle)
        return cls.make_line(pnts[0], pnts[1])


class Face(Shape):
    def __init__(self, topo, parent=None, index=None):
        # Face(outer_wire, [hole_wires]) like build123d
        inner = None
        if isinstance(parent, (list, tuple, ShapeList)) and \
                all(isinstance(x, (Curve, Edge)) for x in parent):
            inner = list(parent)
            parent = None
        if isinstance(topo, (Curve, Edge)):
            outer = _topo(topo)
            if outer.ShapeType().value != 5:
                outer = w.GetWire(outer, 0, True)
            if inner:
                def _wire_of(x):
                    tw = _topo(x)
                    return tw if tw.ShapeType().value == 5 \
                        else w.GetWire(tw, 0, True)
                topo = w.FaceWithHoles(outer, [_wire_of(x) for x in inner])
            else:
                # build123d's Face(wire) is always PLANAR (OnlyPlane=True)
                topo = w.MakeFace(outer, True, True)
        Shape.__init__(self, topo)
        self.parent = parent
        self.index = index

    @classmethod
    def make_gordon_surface(cls, profiles, guides, tolerance=0.0003):
        # Gordon curve-network surface interpolation. Upstream delegates to
        # the external ocp_gordon package; here the algorithm is a JS port
        # (GordonSurface.js, COMPROMISE notes in its header) exposed as
        # w.GordonSurfaceFace. Profiles/guides: Edge/Curve/Wire or points
        # (only first/last entries may be points, matching upstream).
        def conv(item):
            if isinstance(item, Shape):
                return _topo(item)
            v = Vector(item)
            return [v.X, v.Y, v.Z]
        p = [conv(i) for i in profiles]
        g = [conv(i) for i in guides]
        return cls(w.GordonSurfaceFace(p, g, tolerance))

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
        if center_of == CenterOf.BOUNDING_BOX:
            return self.bounding_box().center()
        return Vector(tuple(w._faceCentroid(self.topo)))

    def _surface_params(self, surface_point, u, v):
        """RAW (u, v) surface parameters for build123d's two overloads: a
        3D point projected onto the surface, or NORMALIZED u/v mapped into
        the face's UV bounds."""
        if surface_point is None:
            b = tuple(w._faceUVBounds(self.topo))
            return (b[0] + u * (b[1] - b[0]), b[2] + v * (b[3] - b[2]))
        uv = w._faceParamsAtPoint(self.topo, list(Vector(surface_point)))
        if uv is None:
            raise ValueError('could not project the point onto this surface')
        return (uv[0], uv[1])

    def _surface_args(self, args, kwargs, extra=()):
        """Shared argument parsing for normal_at/location_at: either
        (surface_point) or (u, v), defaulting to the face center."""
        surface_point, u, v = None, -1.0, -1.0
        if args:
            if isinstance(args[0], (Vector, tuple, list)):
                surface_point = args[0]
            elif isinstance(args[0], (int, float)):
                u = args[0]
            if len(args) == 2 and isinstance(args[1], (int, float)):
                v = args[1]
        allowed = ('surface_point', 'u', 'v') + tuple(extra)
        unknown = [k for k in kwargs if k not in allowed]
        if unknown:
            raise ValueError('Unexpected argument(s) ' + ', '.join(unknown))
        surface_point = kwargs.get('surface_point', surface_point)
        u = kwargs.get('u', u)
        v = kwargs.get('v', v)
        if surface_point is None and u < 0 and v < 0:
            u, v = 0.5, 0.5
        elif surface_point is None and (u < 0 or v < 0):
            raise ValueError('Both u & v values must be specified')
        return (surface_point, u, v)

    def normal_at(self, *args, **kwargs):
        """Unit surface normal, at the face center by default, or at a 3D
        surface_point / normalized (u, v) — build123d Face.normal_at."""
        if not args and not kwargs:
            # the whole-face mid-parameter normal (identical evaluation, but
            # this path is what every other lite call site already uses)
            return Vector(tuple(w._faceNormal(self.topo)))
        surface_point, u, v = self._surface_args(args, kwargs)
        u_val, v_val = self._surface_params(surface_point, u, v)
        return Vector(tuple(w._faceNormalAt(self.topo, u_val, v_val)))

    def location_at(self, *args, **kwargs):
        """location_at(u, v, *, x_dir=None) | location_at(surface_point, *,
        x_dir=None): the placement (origin + orientation) on this surface.
        z is the surface normal (dU x dV), x defaults to the U tangent —
        build123d Face.location_at. Defaults to the face center (0.5, 0.5)."""
        surface_point, u, v = self._surface_args(args, kwargs, ('x_dir',))
        user_x_dir = kwargs.get('x_dir', None)
        u_val, v_val = self._surface_params(surface_point, u, v)
        d = w._faceD1(self.topo, u_val, v_val)
        origin = Vector(tuple(d[0]))
        du, dv = Vector(tuple(d[1])), Vector(tuple(d[2]))
        z_dir = du.cross(dv).normalized()
        x_dir = Vector(user_x_dir) if user_x_dir is not None else du
        return Location(Plane(origin=origin, x_dir=x_dir, z_dir=z_dir))

    def offset(self, amount):
        """The face's plane offset by amount (build123d Face.offset)."""
        return Plane(self).offset(amount)

    def outer_wire(self):
        """The face's outer boundary wire (BRepTools::OuterWire)."""
        return Curve(w._faceOuterWire(self.topo))

    def inner_wires(self):
        """Hole wires: every wire of the face except the outer one."""
        outer = w._faceOuterWire(self.topo)
        out = ShapeList()

        def _cb(i, wire):
            if not w._sameShape(wire, outer):
                out.append(Curve(wire))
        w.ForEachWire(self.topo, _cb)
        return out

    def project_to_shape(self, target, direction):
        """Project this face onto target along direction: extrude the
        face by the combined bbox diagonal and intersect with the target
        (BRepAlgoAPI_Common) — exactly build123d's Face.project_to_shape.
        Returns faces ordered by distance along the projection axis."""
        d = Vector(direction).normalized()
        bb1 = list(w.BoundingBox(self.topo))
        bb2 = list(w.BoundingBox(_topo(target)))
        lo = [min(bb1[i], bb2[i]) for i in range(3)]
        hi = [max(bb1[i + 3], bb2[i + 3]) for i in range(3)]
        diag = math.sqrt(sum((hi[i] - lo[i]) ** 2 for i in range(3)))
        prism = w.Extrude(self.topo, [d[0] * diag, d[1] * diag, d[2] * diag],
                          True)
        # like build123d: intersect the prism with the target's SHELLS (its
        # boundary surface), so the result is surface pieces on the target
        # — front AND back — never the prism's own side walls
        shells = []

        def _shell_cb(i, sh):
            shells.append(sh)
        w.ForEachShell(_topo(target), _shell_cb)
        if not shells:
            shells = [_topo(target)]
        pieces = []
        for sh in shells:
            common = w.Intersection([prism, sh], True, 1e-7, True)
            pieces.extend(Shape(common).faces())
        origin = self.center()

        def _dist(f):
            c = w._faceCentroid(f.topo)
            return ((c[0] - origin.X) * d[0] + (c[1] - origin.Y) * d[1] +
                    (c[2] - origin.Z) * d[2])
        return ShapeList(sorted([Face(f.topo) for f in pieces], key=_dist))

    @classmethod
    def make_surface(cls, exterior, surface_points=None, interior_wires=None):
        """A potentially NON-planar face bounded by exterior (a wire or
        edges), pulled towards surface_points and holed by interior_wires —
        the exact BRepOffsetAPI_MakeFilling construction of build123d's
        Face.make_surface."""
        if isinstance(exterior, Shape):
            edges = [e.topo for e in exterior.edges()]
        else:
            edges = [_topo(e) for e in exterior]
        pts = [list(Vector(p)) for p in (surface_points or [])]
        holes = [_topo(x) for x in (interior_wires or [])]
        topo = w.FillingFace(edges, pts, holes)
        if topo is None:
            raise RuntimeError('non planar face is invalid')
        return cls(topo)

    # --- wrapping flat geometry onto this surface (build123d Face.wrap) ---

    def _intersect_surface_normal(self, point, direction, target_center):
        """(point, unit normal) of the closest crossing of the axis
        (point, direction) with this surface — the inner helper of
        build123d's Face._wrap_edge."""
        hits = self.find_intersection_points(Axis(point, direction))
        if not hits:
            raise RuntimeError('wrapping over surface boundary, try a '
                               'different surface_loc')
        best, best_d = hits[0], (hits[0][0] - point).length
        for h in hits[1:]:
            d = (h[0] - point).length
            if d < best_d:
                best, best_d = h, d
        return best

    def _wrap_edge(self, planar_edge, surface_loc, snap_to_face=True,
                   tolerance=0.001):
        """Wrap one flat edge onto this surface: march along the edge in the
        local surface frame, casting each step back onto the surface, refining
        the subdivision until the wrapped length matches — build123d's
        Face._wrap_edge."""
        if self.topo is None:
            raise ValueError('cannot wrap around an empty face')
        target_center = self.center(CenterOf.BOUNDING_BOX)
        surface_x_direction = surface_loc.x_axis.direction
        planar_edge_length = planar_edge.length

        def find_point_on_surface(current_point, normal, relative_position):
            local_plane = Plane(origin=current_point,
                                x_dir=surface_x_direction, z_dir=normal)
            world_point = local_plane.from_local_coords(relative_position)
            return self._intersect_surface_normal(
                world_point, world_point - target_center, target_center)

        if planar_edge.position_at(0).length > tolerance:
            # the edge does not start at the surface location: wrap a
            # construction line to find where it does
            to_start_edge = Edge.make_line((0, 0, 0), planar_edge @ 0)
            wrapped_to_start = self._wrap_edge(to_start_edge, surface_loc,
                                              True, tolerance)
            start_pnt = wrapped_to_start @ 1
            start_normal = self._intersect_surface_normal(
                start_pnt, start_pnt - target_center, target_center)[1]
        else:
            start_pnt = surface_loc.position
            start_normal = surface_loc.z_axis.direction

        closed = planar_edge.is_closed
        subdivisions = 3
        loop_count = 0
        length_error = 1e308
        wrapped_edge = None
        while length_error > tolerance and loop_count < 10:
            points = [start_pnt]
            current_point, current_normal = start_pnt, start_normal
            for div in range(1, subdivisions + (0 if closed else 1)):
                prev = planar_edge.position_at((div - 1) / subdivisions)
                curr = planar_edge.position_at(div / subdivisions)
                current_point, current_normal = find_point_on_surface(
                    current_point, current_normal, curr - prev)
                points.append(current_point)
            wrapped_edge = Edge.make_spline(points, periodic=closed)
            length_error = abs(planar_edge_length - wrapped_edge.length)
            subdivisions *= 2
            loop_count += 1

        if length_error > tolerance:
            raise RuntimeError('Length error of ' + repr(length_error) +
                               ' exceeds tolerance ' + repr(tolerance))
        if not snap_to_face:
            return wrapped_edge
        snapped = w.ProjectEdgeOnFace(_topo(wrapped_edge), self.topo)
        if snapped is None:
            raise RuntimeError('Projection failed, try setting snap_to_face '
                               'to False.')
        return Edge(snapped)

    def _wrap_wire(self, planar_wire, surface_loc, tolerance=0.001,
                   extension_factor=0.1):
        """Wrap a flat wire onto this surface edge by edge, then close the
        junction the distortion opens between the first and last edge —
        build123d's Face._wrap_wire."""
        surface_point = surface_loc.position
        surface_x_direction = surface_loc.x_axis.direction

        planar_edges = planar_wire.order_edges()
        if len(planar_edges) == 1:
            return Curve([self._wrap_edge(planar_edges[0], surface_loc, True,
                                          tolerance)])

        wrapped_edges = []
        first_start_point = None

        if planar_edges[0].position_at(0) == Vector(0, 0, 0):
            edge_surface_point = surface_point
            planar_edge_end_point = Vector(0, 0, 0)
        else:
            construction_line = Edge.make_line(
                (0, 0, 0), planar_edges[0].position_at(0))
            wrapped_construction_line = self._wrap_edge(
                construction_line, surface_loc, True, tolerance)
            edge_surface_point = wrapped_construction_line.position_at(1)
            planar_edge_end_point = planar_edges[0].position_at(0)
        edge_surface_location = Location(Plane(
            origin=edge_surface_point, x_dir=surface_x_direction,
            z_dir=self.normal_at(edge_surface_point)))

        for planar_edge in planar_edges:
            # re-wrap as an Edge: _wrap_like turns a transformed Edge into a
            # Curve, and Curve.position_at is not orientation-aware, so a
            # REVERSED edge of the wire would march from the wrong end
            local_planar_edge = Edge(_topo(
                planar_edge.translate(-planar_edge_end_point)))
            wrapped_edge = self._wrap_edge(local_planar_edge,
                                           edge_surface_location, True,
                                           tolerance)
            edge_surface_point = wrapped_edge.position_at(1)
            edge_surface_location = Location(Plane(
                origin=edge_surface_point, x_dir=surface_x_direction,
                z_dir=self.normal_at(edge_surface_point)))
            planar_edge_end_point = planar_edge.position_at(1)
            if first_start_point is None:
                first_start_point = wrapped_edge.position_at(0)
            wrapped_edges.append(wrapped_edge)

        if not planar_wire.is_closed:
            return Curve(wrapped_edges)

        # extend the first and last wrapped edge so that they cross, then trim
        # both at the crossing
        first_edge = wrapped_edges[0]._extend_spline(True, self,
                                                    extension_factor)
        last_edge = wrapped_edges[-1]._extend_spline(False, self,
                                                     extension_factor)
        params = w.ExtremaEdgeParams(_topo(first_edge), _topo(last_edge))
        if params is None:
            raise RuntimeError('Extended first/last edges do not intersect; '
                               'increase extension.')
        param_first, param_last = params[0], params[1]

        u_start_first = first_edge.param_at(0)
        u_end_first = first_edge.param_at(1)
        new_start = (param_first - u_start_first) / (u_end_first - u_start_first)
        trimmed_first = first_edge.trim(new_start, 1.0)

        u_start_last = last_edge.param_at(0)
        u_end_last = last_edge.param_at(1)
        new_end = (param_last - u_start_last) / (u_end_last - u_start_last)
        trimmed_last = last_edge.trim(0.0, new_end)

        wrapped_edges[0] = trimmed_first
        wrapped_edges[-1] = trimmed_last

        closing_error = (trimmed_first.position_at(0) -
                         trimmed_last.position_at(1)).length
        wire = w.WireFromEdgesFixed([_topo(e) for e in wrapped_edges],
                                    2 * closing_error)
        return Curve(wire)

    def _wrap_face(self, planar_face, surface_loc, tolerance=0.001,
                   extension_factor=0.1):
        """Wrap a flat face onto this surface (build123d Face._wrap_face)."""
        wrapped_perimeter = self._wrap_wire(planar_face.outer_wire(),
                                            surface_loc, tolerance,
                                            extension_factor)
        wrapped_holes = [self._wrap_wire(iw, surface_loc, tolerance,
                                         extension_factor)
                         for iw in planar_face.inner_wires()]
        wrapped_face = Face.make_surface(
            wrapped_perimeter, surface_points=[surface_loc.position],
            interior_wires=wrapped_holes)
        # flip the wrapped face if it ended up facing away from the surface
        surface_normal = surface_loc.z_axis.direction
        wrapped_normal = wrapped_face.normal_at(surface_loc.position)
        if surface_normal.dot(wrapped_normal) < 0:
            wrapped_face = -wrapped_face
        return wrapped_face

    def wrap(self, planar_shape, surface_loc, tolerance=0.001,
             extension_factor=0.1):
        """Wrap a flat Edge/Wire/Face (drawn on Plane.XY) onto this surface
        starting at surface_loc (build123d Face.wrap)."""
        if isinstance(planar_shape, Edge):
            return self._wrap_edge(planar_shape, surface_loc, True, tolerance)
        if isinstance(planar_shape, (Face, Sketch)):
            return self._wrap_face(planar_shape, surface_loc, tolerance,
                                   extension_factor)
        if isinstance(planar_shape, Curve):
            return self._wrap_wire(planar_shape, surface_loc, tolerance,
                                   extension_factor)
        raise TypeError('planar_shape must be an Edge, Wire or Face')

    def wrap_faces(self, faces, path, start=0.0):
        """Wrap flat faces onto this surface, spaced along a path that lies on
        it: each face keeps its relative X position, mapped to arc length
        along the path (build123d Shape.wrap_faces)."""
        path_length = path.length
        face_list = [f for f in faces]
        first_face_min_x = face_list[0].bounding_box().min[0]
        wrapped = ShapeList()
        for face in face_list:
            bbox = face.bounding_box()
            face_center_x = (bbox.min[0] + bbox.max[0]) / 2.0
            delta_x = face_center_x - first_face_min_x
            relative_position = start + delta_x / path_length
            path_position = path.position_at(relative_position)
            surface_location = Location(Plane(
                origin=path_position,
                x_dir=path.tangent_at(relative_position),
                z_dir=self.normal_at(path_position)))
            face.position = face.position - Vector(delta_x, 0, 0)
            wrapped.append(self._wrap_face(face, surface_location))
        return wrapped

    @classmethod
    def make_surface_from_array_of_points(cls, points, tol=1e-2,
                                          smoothing=None, min_deg=1,
                                          max_deg=3):
        """Approximate a BSpline surface through a 2D grid of points —
        upstream's exact GeomAPI_PointsToBSplineSurface 2-D least-squares
        fit (outer index = V, inner = U)."""
        pts = [[list(_v3(p)) for p in row] for row in points]
        # [] = no smoothing (None does not survive CacheOp's JSON hashing)
        smooth = list(smoothing) if smoothing is not None else []
        topo = w.SurfaceFromPoints(pts, tol, min_deg, max_deg, smooth)
        if topo is None:
            raise ValueError('B-spline surface approximation failed')
        return cls(topo)

    def __neg__(self):
        """The same face with reversed orientation (build123d -face)."""
        return Face(w.ReverseFace(self.topo, True))

    @classmethod
    def extrude(cls, obj, direction):
        """Extrude an Edge into a Face (build123d Face.extrude). Extruding a
        one-edge WIRE gives a shell here, so unwrap it to the single face
        build123d would have produced."""
        d = Vector(direction)
        topo = w.Extrude(_topo(obj), [d.X, d.Y, d.Z], True)
        return cls(w.AsSingleFace(topo, True))

    @classmethod
    def revolve(cls, profile, angle=360, axis=None):
        """Revolve an Edge/Wire profile into a Face of revolution
        (build123d Face.revolve)."""
        if axis is None:
            axis = Axis.Z
        o = tuple(axis.position)
        d = list(axis.direction)
        topo = _topo(profile)
        shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Revolve(topo, angle, d)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        return cls(topo)

    @classmethod
    def make_rect(cls, width, height, plane=None):
        """A width x height rectangle face on the given plane (Plane.XY)."""
        topo = w.Polygon([[-width / 2.0, -height / 2.0, 0],
                          [width / 2.0, -height / 2.0, 0],
                          [width / 2.0, height / 2.0, 0],
                          [-width / 2.0, height / 2.0, 0]])
        face = cls(topo)
        if plane is not None:
            face = cls((plane.location * face).topo)
        return face


# lite re-wraps a TRANSFORMED Face as a Sketch (the algebra-mode 2D
# convention, see _wrap_like), so a Sketch very often really is one face:
# share Face's surface-geometry methods with it. Explicit assignment rather
# than making Sketch a Face subclass, because several call sites dispatch on
# isinstance(x, Face) (Face(wire) promotion, revolve, thicken, ...).
Sketch._surface_args = Face._surface_args
Sketch._surface_params = Face._surface_params
Sketch.normal_at = Face.normal_at
Sketch.location_at = Face.location_at
Sketch.outer_wire = Face.outer_wire
Sketch.inner_wires = Face.inner_wires
Sketch._intersect_surface_normal = Face._intersect_surface_normal
Sketch._wrap_edge = Face._wrap_edge
Sketch._wrap_wire = Face._wrap_wire
Sketch._wrap_face = Face._wrap_face
Sketch.wrap = Face.wrap
Sketch.wrap_faces = Face.wrap_faces


class Shell(Shape):
    """A shell — only the build123d forms the examples use: Shell(faces)
    collects faces (Solid(Shell(faces)) then sews them into a closed
    solid via BRepBuilderAPI_Sewing + ShapeFix_Solid), Shell(shape)
    adopts the shape's faces."""

    _face_shapes = None  # default for instances made via _wrap_like

    def __init__(self, faces=None):
        if faces is None:
            Shape.__init__(self, None)
            self._face_shapes = []
            return
        if isinstance(faces, Shape):
            Shape.__init__(self, faces.topo)
            self._face_shapes = list(faces.faces())
            return
        fl = [f for f in _tolist(faces)]
        self._face_shapes = fl
        if len(fl) == 0:
            topo = None
        elif len(fl) == 1:
            topo = _topo(fl[0])
        else:
            topo = w.MakeCompound([_topo(f) for f in fl])
        Shape.__init__(self, topo)


class Vertex(Shape):
    def __init__(self, topo=None, *args, parent=None):
        # Vertex(Vector) / Vertex(x, y, z) / Vertex((x, y, z)) like build123d
        if topo is None or isinstance(topo, (int, float)) or \
                isinstance(topo, (Vector, tuple, list)):
            if topo is None:
                pt = (0.0, 0.0, 0.0)
            elif isinstance(topo, (int, float)):
                pt = (float(topo),) + tuple(float(a) for a in args) + \
                    (0.0, 0.0)
                pt = pt[:3]
            else:
                pt = tuple(Vector(topo))
            topo = w.PointVertex(list(pt))
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


def _is_parallel(s, axis, tolerance=1e-5):
    """Parallelism like build123d's Axis.is_parallel: tolerance is the
    ANGULAR tolerance in radians (gp_Ax1::IsParallel)."""
    d = Vector(axis.direction)
    if isinstance(s, Edge):
        ed = w._edgeDirection(s.topo)
        # JS null crosses Brython as NullType (not None) — test truthiness
        if not ed:
            return False
        v = Vector(tuple(ed)).normalized()
    elif isinstance(s, Face):
        v = Vector(tuple(w._faceNormal(s.topo)))
    else:
        return False
    dot = min(1.0, abs(v.dot(d)))
    # build123d's angular_tolerance is in DEGREES (geometry.py multiplies
    # by pi/180); keep the old 1e-4 dot slack as a floor so near-parallel
    # edges from wasm boolean noise still match
    return math.acos(dot) <= math.radians(tolerance) or dot > (1.0 - 1e-4)


class ShapeList(list):
    def __add__(self, other):
        # plain list.__add__ would decay to a list, losing the selectors
        # (built element-wise: Brython's unbound list.__add__ returns
        # NotImplemented for subclass receivers)
        out = ShapeList(self)
        out.extend(other)
        return out

    def __radd__(self, other):
        out = ShapeList(other)
        out.extend(self)
        return out

    def filter_by(self, f, reverse=False, tolerance=1e-5):
        if isinstance(f, Axis):
            pred = lambda s: _is_parallel(s, f, tolerance)
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

    def __sub__(self, other):
        removed = list(other)
        return ShapeList([s for s in self
                          if not any(s is o or (s.topo is not None and
                                                s.topo is o.topo)
                                     for o in removed)])

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
        self.pending_faces = []        # [Face/Sketch] for BuildPart
        self.pending_face_planes = []  # parallel [Plane] (build123d layout)
        self.joints = {}               # joints created with to_part=None
        self.pending_edge_specs = []  # segment specs for BuildSketch

    def _wrap(self, topo):
        return self._shape_cls(topo)

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
        # transfer joints created in this context onto the result shape
        # (build123d BuildPart._exit_extras)
        if self.joints and self._obj is not None:
            self._obj.joints = self.joints
            for j in self.joints.values():
                j.parent = self._obj
        return False

    def _finalize(self, parent):
        if parent is not None and self._obj is not None and self._obj.topo is not None:
            _combine(parent, self._obj, self.mode)

    @property
    def location(self):
        """The result shape's location (build123d BuildPart.location)."""
        return self._obj.location if self._obj is not None else Location()

    def locate(self, loc):
        if self._obj is None:
            raise ValueError('builder has no result to locate')
        return self._obj.locate(loc)

    # selector passthroughs (builder.edges() etc.)
    def edges(self, select=Select.ALL):
        if select in (Select.LAST, Select.NEW):
            return ShapeList(self._last_edges) if hasattr(self, '_last_edges') else ShapeList()
        return self._obj.edges() if self._obj else ShapeList()

    def wires(self, select=Select.ALL):
        return self._obj.wires() if self._obj else ShapeList()

    def face(self):
        return self._obj.face() if self._obj else None

    def wire(self):
        return self._obj.wire() if self._obj else None

    def edge(self):
        return self._obj.edge() if self._obj else None

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
                parent.pending_faces.append(placed)
                parent.pending_face_planes.append(wp)
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

    def append(self, loc):
        """Location * GridLocations(...) products are mutable lists in
        build123d — stud_wall appends extra studs to one."""
        self.locations.append(loc)

    def extend(self, locs):
        self.locations.extend(locs)

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


class Workplanes(LocationList):
    """with Workplanes(*planes): — fan objects out over full plane bases.
    The location-fanout stack (Locations/GridLocations/PolarLocations)
    always carries complete Locations, and a Plane's basis IS its
    location (rotation + origin), so Workplanes shares that exact code
    path: every object created inside is replicated onto each plane with
    the plane's orientation applied — 0.11.1 semantics."""

    def __init__(self, *objs):
        locs = []
        for o in objs:
            if isinstance(o, Plane):
                locs.append(o.location)
            elif isinstance(o, Location):
                locs.append(Location(o))
            elif isinstance(o, Face):
                locs.append(Plane(o).location)
            else:
                raise TypeError('Workplanes expects Planes, Faces or '
                                'Locations')
        LocationList.__init__(self, locs or [Location()])


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
    y = height / 2.0
    red_l = 0.0 if left_side_angle == 90 else \
        height / math.tan(math.radians(left_side_angle))
    red_r = 0.0 if right_side_angle == 90 else \
        height / math.tan(math.radians(right_side_angle))
    top_l = top_r = bot_l = bot_r = width / 2.0
    # build123d narrows the TOP for an acute side angle but widens the BOTTOM
    # for an obtuse one (negative reduction), so 'width' is always the width
    # of the wider of the two edges
    if red_l > 0:
        top_l -= red_l
    else:
        bot_l += red_l
    if red_r > 0:
        top_r -= red_r
    else:
        bot_r += red_r
    if bot_l + bot_r < 0:
        raise ValueError('Trapezoid bottom invalid - change angles')
    if top_l + top_r < 0:
        raise ValueError('Trapezoid top invalid - change angles')
    pts = [[-bot_l, -y, 0], [bot_r, -y, 0], [top_r, y, 0], [-top_l, y, 0]]
    xs = [p[0] for p in pts]
    maker = lambda: w.Polygon(pts)
    return _sketch_object(maker, ((min(xs), -y), (max(xs), y)), rotation,
                          align, mode)


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
    """Text rendered from bundled FreeSans outlines with FreeType-parity
    kerning (matches what the reference build123d resolves 'Arial' to on
    this machine for Latin text). COMPROMISE(text): only the bundled
    FreeSans faces exist — other font names fall back with a warning,
    font_path/path raise, and non-Latin glyph METRICS (e.g. Greek) can
    differ from other Arial substitutes."""
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
    params = _seg_params(seg)
    if seg[0] == 'interp' and params is not None:
        tans = params[0]
        if tans:
            tans = [([-t[0], -t[1], -t[2]] if t else [])
                    for t in reversed(tans)]
        params = [tans] + list(params[1:])
    return _seg_make(seg[0], list(reversed(_seg_pts(seg))), params)


def _seg_transform(seg, fn_point, fn_dir):
    """Rigid-transform a segment: points via fn_point, directions via fn_dir.
    Kind-aware params: earc carries [center, xdir, normal, ...], interp
    carries [tangents, periodic, scale], raw carries an untransformable
    TopoDS edge."""
    pts = [fn_point(_v3(p)) for p in _seg_pts(seg)]
    params = _seg_params(seg)
    if params is not None:
        if seg[0] == 'earc':
            params = [list(fn_point(_v3(params[0]))), list(fn_dir(_v3(params[1]))),
                      list(fn_dir(_v3(params[2])))] + list(params[3:])
        elif seg[0] == 'interp':
            tans = params[0]
            if tans:
                tans = [(list(fn_dir(_v3(t))) if t else [])
                        for t in tans]
            params = [tans] + list(params[1:])
        elif seg[0] == 'raw':
            # COMPROMISE(raw-segments): edges that are not lines/circles
            # ride through wires as opaque TopoDS edges — exact geometry,
            # but they cannot be re-derived under transforms (the caller
            # falls back to transforming the baked topo and dropping specs)
            raise NotImplementedError('cannot transform an opaque edge '
                                      'segment in build123d-lite')
    return _seg_make(seg[0], pts, params)


def _seg_scale(seg, k):
    """Uniformly scale a segment about the origin by factor k."""
    pts = [[p[0] * k, p[1] * k, p[2] * k] for p in
           [_v3(p) for p in _seg_pts(seg)]]
    params = _seg_params(seg)
    if params is not None:
        if seg[0] == 'earc':
            c = _v3(params[0])
            params = [[c[0] * k, c[1] * k, c[2] * k], list(params[1]),
                      list(params[2]), params[3] * k, params[4] * k] + \
                     list(params[5:])
        elif seg[0] == 'interp':
            # tangents stay UNCHANGED: GeomAPI_Interpolate parametrizes by
            # chord length, so scaling the points by k scales the parameter
            # range by k too — dP/dt is scale-invariant and the curve
            # scales self-similarly with the original tangent magnitudes
            pass
        elif seg[0] == 'raw':
            raise NotImplementedError('cannot scale an opaque edge segment '
                                      'in build123d-lite')
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


def _sample_curve(obj, per_edge=256):
    """[(point3, edge, u)] samples along every edge of a curve/edge —
    the pure-Python side of curve-distance queries (one JS call per
    sample, cached by callers)."""
    edges = [obj] if isinstance(obj, Edge) else obj.edges()
    out = []
    for e in edges:
        for i in range(per_edge + 1):
            u = i / per_edge
            q = w._edgePointAt(e.topo, u)
            out.append(((q[0], q[1], q[2]), e, u))
    return out


def _closest_on_curve(samples, p):
    """(distance, point, edge, u) of the curve point closest to p: coarse
    scan over the cached samples, then golden-section refinement on the
    winning edge's parameter (near-exact for smooth curves)."""
    best_i = 0
    best_d = None
    for i, (q, e, u) in enumerate(samples):
        d = ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2)
        if best_d is None or d < best_d:
            best_d = d
            best_i = i
    q0, e0, u0 = samples[best_i]
    step = 1.0 if len(samples) < 2 else abs(
        samples[1][2] - samples[0][2]) or 1.0 / 256
    a = max(0.0, u0 - step)
    b = min(1.0, u0 + step)

    def f(u):
        q = w._edgePointAt(e0.topo, u)
        return ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2)
    phi = 0.6180339887498949
    c = b - phi * (b - a)
    d_ = a + phi * (b - a)
    fc, fd = f(c), f(d_)
    for _i in range(48):
        if fc < fd:
            b, d_, fd = d_, c, fc
            c = b - phi * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d_, fd
            d_ = a + phi * (b - a)
            fd = f(d_)
    u = (a + b) / 2.0
    q = w._edgePointAt(e0.topo, u)
    dist = math.sqrt((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 +
                     (q[2] - p[2]) ** 2)
    return dist, tuple(q), e0, u


def DoubleTangentArc(pnt, tangent, other, keep=Keep.TOP, mode=Mode.ADD):
    """Arc tangent to a point/tangent pair AND to another curve.
    COMPROMISE(double-tangent-arc): upstream solves radius with
    scipy.optimize.minimize (Nelder-Mead) over an exact BRepExtrema
    distance; lite finds the same root of dist(center(r)) - r by scan +
    bisection over a sampled-then-refined curve distance. The tangency
    point (hence the arc) matches upstream to well below harness
    tolerance; candidate ORDER follows upstream's [90, -90] sweep about
    the flipped common plane."""
    if keep not in (Keep.TOP, Keep.BOTTOM):
        raise ValueError('Only the TOP or BOTTOM options are supported')
    arc_pt = _v3(pnt)
    t = Vector(tangent).normalized()
    # BuildLine geometry is local-XY planar; upstream flips the derived
    # common plane, making the rotation axis -Z
    axis_dir = (0.0, 0.0, -1.0)
    samples = _sample_curve(other, 512)
    bb = other.bounding_box()
    mins = [min(bb.min[i], arc_pt[i]) for i in range(3)]
    maxs = [max(bb.max[i], arc_pt[i]) for i in range(3)]
    max_size = 10 * math.sqrt(sum((maxs[i] - mins[i]) ** 2 for i in range(3)))

    accepted = []
    for ang in (90.0, -90.0):
        bis = tuple(t.rotate(Axis((0, 0, 0), axis_dir), ang))

        def g(r):
            c = (arc_pt[0] + bis[0] * r, arc_pt[1] + bis[1] * r,
                 arc_pt[2] + bis[2] * r)
            return _closest_on_curve(samples, c)[0] - r

        # first (smallest-r) root: sign-change scan + bisection — the
        # solution Nelder-Mead from x0=0 walks into
        n = 400
        prev_r, prev_v = 1e-9, g(1e-9)
        root = None
        for i in range(1, n + 1):
            r = max_size * i / n
            v = g(r)
            if v == 0.0 or (prev_v > 0) != (v > 0):
                a, b, fa = prev_r, r, prev_v
                for _j in range(60):
                    m = (a + b) / 2.0
                    fm = g(m)
                    if (fa > 0) != (fm > 0):
                        b = m
                    else:
                        a, fa = m, fm
                root = (a + b) / 2.0
                break
            prev_r, prev_v = r, v
        if root is None:
            continue
        center = (arc_pt[0] + bis[0] * root, arc_pt[1] + bis[1] * root,
                  arc_pt[2] + bis[2] * root)
        dist, p1, e1, u1 = _closest_on_curve(samples, center)
        if abs(dist - root) > 1e-4:
            continue
        # tangency: the other curve's tangent must be perpendicular to the
        # radial direction at the touch point (build123d checks the circle
        # tangent is parallel within 0.05 rad)
        ot = w._edgeTangentAt(e1.topo, u1)
        radial = (p1[0] - center[0], p1[1] - center[1], p1[2] - center[2])
        rl = math.sqrt(sum(v * v for v in radial)) or 1.0
        cosang = abs(sum(ot[k] * radial[k] for k in range(3))) / rl
        if cosang > 0.05:
            continue
        accepted.append((center, p1, e1, u1))
    if not accepted:
        raise RuntimeError('No double tangent arcs found')
    chosen = accepted[0] if keep == Keep.TOP else accepted[-1]
    _c, p1, e1, u1 = chosen
    # COMPROMISE(double-tangent-arc): upstream leaves the tangent target
    # over-extended ("beyond the intersection") and relies on the face
    # builder's wire fixing to trim it; lite trims the target's segment in
    # the active BuildLine at the tangency point instead — the resulting
    # FACE is identical, but the target curve's dangling tail is dropped.
    builder = _active_builder(BuildLine)
    if builder is not None and isinstance(other, Curve) and other._specs:
        for i, sg in enumerate(builder._specs):
            if any(sg is s2 for s2 in other._specs) and sg[0] == 'arc3':
                s0 = _v3(w._edgePointAt(e1.topo, 0.0))
                seg0 = _v3(_seg_pts(sg)[0])
                if max(abs(s0[k] - seg0[k]) for k in range(3)) < 1e-6:
                    mid = w._edgePointAt(e1.topo, u1 / 2.0)
                    builder._specs[i] = _seg_make(
                        'arc3', [list(seg0), [mid[0], mid[1], mid[2]],
                                 list(p1)])
                break
    return TangentArc(tuple(arc_pt), p1, tangent=tuple(t), mode=mode)


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


def Spline(*pts, tangents=None, tangent_scalars=None, periodic=False,
           mode=Mode.ADD):
    """Exact interpolation through the points — GeomAPI_Interpolate via the
    'interp' segment kind, replicating build123d's Spline/Edge.make_spline:
    tangents are unit-normalized then multiplied by their scalar (default
    1.0); OCC's Scale flag is True exactly when tangent_scalars is None."""
    if len(pts) == 1 and hasattr(pts[0], '__len__') and \
            hasattr(pts[0][0], '__len__'):
        pts = tuple(pts[0])
    p3 = [list(_v3(p)) for p in pts]
    # NOTE: [] (not None) encodes "no tangents" — Brython None objects break
    # the worker's CacheOp JSON hashing when nested in argument structures
    tans = []
    scale_flag = tangent_scalars is None
    if tangents is not None:
        tg = [(Vector(t).normalized() if t is not None else None)
              for t in tangents]
        if tangent_scalars is None:
            sc = [1.0] * len(tg)
        else:
            sc = list(tangent_scalars)
        # build123d zips tangents with scalars (extra tangents are dropped)
        tans = [(list(t * s) if t is not None else [])
                for t, s in zip(tg, sc)]
        if len(tans) != 2 and len(tans) != len(p3):
            raise ValueError('Spline: provide 2 end tangents or one per point')
    return _line_object([('interp', p3, [tans, bool(periodic), scale_flag])],
                        mode)


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


def Helix(pitch, height, radius, center=(0, 0, 0), direction=(0, 0, 1),
          cone_angle=0, lefthand=False, mode=Mode.ADD):
    """Helical curve. COMPROMISE(helix): the exact Geom helix (a curve on a
    cylindrical surface) cannot be expressed in segment specs on this WASM
    build, so the helix is interpolated (GeomAPI_Interpolate) through dense
    parametric samples with analytic per-point tangents — within ~1e-6 of
    the true helix, far below harness tolerance."""
    if cone_angle:
        raise NotImplementedError('conical Helix is not supported in '
                                  'build123d-lite')
    turns = height / pitch
    n = max(16, int(64 * turns))
    sgn = -1.0 if lefthand else 1.0
    pts = []
    tans = []
    for i in range(n + 1):
        a = sgn * 2.0 * math.pi * turns * i / n
        pts.append((radius * math.cos(a), radius * math.sin(a),
                    height * i / n))
        # d/da of the parametric form (direction only; scale=True)
        t = Vector(-radius * math.sin(a) * sgn, radius * math.cos(a) * sgn,
                   pitch / (2.0 * math.pi)).normalized()
        tans.append(list(t))
    loc = Plane(Vector(center), z_dir=Vector(direction)).location
    fn_dir = lambda d: _mat_vec(loc._R, d)
    spec = _seg_transform(('interp', pts, [tans, False, True]),
                          loc._transform_point, fn_dir)
    return _line_object([spec], mode)


def edges_to_wires(edges, tol=1e-6):
    """Group connected edges into wires (build123d's edges_to_wires).
    COMPROMISE(edges-to-wires): ShapeAnalysis_FreeBounds::ConnectEdgesToWires
    needs TopTools_HSequenceOfShape, which this wasm build does not bind, so
    the chaining is done here on edge endpoints — same grouping, and the
    ordering inside each wire is then fixed by ShapeFix_Wire."""
    remaining = [e for e in edges]
    wires = ShapeList()
    while remaining:
        chain = [remaining.pop(0)]
        start = chain[0].position_at(0)
        end = chain[0].position_at(1)
        grew = True
        while grew:
            grew = False
            for i in range(len(remaining)):
                p0 = remaining[i].position_at(0)
                p1 = remaining[i].position_at(1)
                if (p0 - end).length <= tol or (p1 - end).length <= tol:
                    end = p1 if (p0 - end).length <= tol else p0
                    chain.append(remaining.pop(i))
                    grew = True
                    break
                if (p1 - start).length <= tol or (p0 - start).length <= tol:
                    start = p0 if (p1 - start).length <= tol else p1
                    chain.insert(0, remaining.pop(i))
                    grew = True
                    break
        wires.append(Curve(w.WireFromEdgesFixed([_topo(e) for e in chain],
                                                tol)))
    return wires


def _specs_from_topo_edges(shape):
    """Reconstruct segment specs from raw edges: lines and circular arcs
    analytically; anything else (BSplines, ellipses, ...) as an opaque 'raw'
    segment that passes the TopoDS edge through exactly (chainable into
    wires, but not transformable)."""
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
            specs.append(('raw', [p0, p1], [e.topo]))
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
        for shape, plane in zip(builder.pending_faces,
                                builder.pending_face_planes):
            for f in shape.faces():
                profiles.append((f.topo, plane))
        builder.pending_faces = []
        builder.pending_face_planes = []
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
        if until not in (Until.NEXT, Until.LAST):
            raise NotImplementedError('extrude until=' + str(until) +
                                      ' is not supported in build123d-lite')
        builder = _active_builder(BuildPart)
        body = target if target is not None else \
            (builder._obj if builder is not None else None)
        if body is None or body.topo is None:
            raise ValueError('extrude(until=...) requires a target part')
        profiles = _pending_or_given(to_extrude)
        bb = list(w.BoundingBox(body.topo, 0.01))
        ln = 3.0 * max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2])
        results = []
        for (face, plane) in profiles:
            d = tuple(plane.z_dir)
            candidate = Part(w.Extrude(face, [d[0] * ln, d[1] * ln, d[2] * ln]))
            # pieces of the candidate OUTSIDE the body, ordered along dir
            outside = Part(w.Difference(candidate.topo, [body.topo],
                                        True, 1e-7, True))
            pieces = outside.solids()

            def proj(s):
                sb = list(w.BoundingBox(s.topo, 0.01))
                return (min(sb[0] * d[0], sb[3] * d[0]) +
                        min(sb[1] * d[1], sb[4] * d[1]) +
                        min(sb[2] * d[2], sb[5] * d[2]))
            pieces = sorted(pieces, key=proj)
            if until == Until.NEXT:
                # first void between the sketch plane and the body
                results.append(pieces[0])
            else:
                # everything up to the body's LAST surface: drop the piece
                # that extends to the candidate's far end
                results.append(candidate - pieces[-1])
        obj = results[0] if len(results) == 1 else results[0] + results[1:]
        return _combine(builder, obj, mode)
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
    """Sweep profile faces along a path with BRepOffsetAPI_MakePipeShell,
    matching build123d's Solid.sweep / Solid.sweep_multi trihedron and
    transition usage (SetMode(is_frenet); normal= -> fixed-binormal gp_Ax2
    with WithCorrection; binormal= wire -> auxiliary spine; multisection
    never sets a transition mode and uses each face's OUTER wire only).
    COMPROMISE(sweep): the calls match upstream exactly, but MakePipeShell
    surfaces differ numerically between OCCT 8.0.1 (this wasm) and OCP 7.x
    (~0.02% volume on the multisection handle example)."""
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
    tmap = {Transition.TRANSFORMED: 'transformed', Transition.ROUND: 'round',
            Transition.RIGHT: 'right'}
    trans = tmap.get(transition, 'transformed')
    # 0/[]/'' stand in for "absent" — Brython None breaks CacheOp hashing
    binormal_vec = []
    aux_spine = 0
    if binormal is not None:
        if isinstance(binormal, Curve) and binormal._specs:
            aux_spine = w.WireFromSegments(_chain_segments(binormal._specs))
        else:
            aux_spine = _topo(binormal)
    elif normal is not None:
        binormal_vec = list(Vector(normal))
    profs = _pending_or_given(sections)
    if multisection:
        wires = [w._faceOuterWire(face) for (face, plane) in profs]
        solid = w.PipeShellSweep(wires, path_topo, is_frenet, '',
                                 binormal_vec, aux_spine, True)
        return _combine(builder, Part(solid), mode)
    results = []
    for (face, plane) in profs:
        outer = w._faceOuterWire(face)
        inner = [c.topo for c in Face(face).inner_wires()]
        solid = w.PipeShellSweep([outer], path_topo, is_frenet, trans,
                                 binormal_vec, aux_spine, True)
        if inner:
            tools = [w.PipeShellSweep([iw], path_topo, is_frenet, trans,
                                      binormal_vec, aux_spine, True)
                     for iw in inner]
            solid = w.Difference(solid, tools)
        results.append(Part(solid))
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
           side=Side.BOTH, closed=True, min_edge_length=None,
           mode=Mode.REPLACE):
    if kind == Kind.TANGENT:
        raise NotImplementedError('Kind.TANGENT offsets are not supported in '
                                  'build123d-lite')
    if min_edge_length is not None:
        raise NotImplementedError('offset(min_edge_length=) is not supported '
                                  'in build123d-lite')
    join = 'intersection' if kind == Kind.INTERSECTION else 'arc'
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets and objects is None and isinstance(builder, BuildLine):
        # inside BuildLine the line lives in the pending segment specs
        line = builder.line
        targets = [line] if line is not None else []
    if not targets:
        raise ValueError('offset: nothing to offset')
    if side != Side.BOTH:
        # one-sided offset of an OPEN line (build123d's Wire.offset_2d with
        # side=): keep one offset side, optionally closed back onto the line
        if len(targets) != 1 or not isinstance(targets[0], (Curve, Edge)):
            raise ValueError('offset(side=...) applies to a single line')
        src = targets[0]
        if isinstance(src, Edge):
            src = Curve([src])
        result = src.offset_2d(amount, kind=kind, side=side, closed=closed)
        specs = _specs_from_topo_edges(result)
        curve = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
        if isinstance(builder, BuildLine):
            if mode == Mode.REPLACE:
                builder._specs = list(specs)
            elif mode == Mode.ADD:
                builder._specs.extend(specs)
            elif mode != Mode.PRIVATE:
                raise ValueError('offset: unsupported mode ' + repr(mode) +
                                 ' inside BuildLine')
            return curve
        return _combine(builder, curve, mode)
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
            if s[0] == 'earc' and params is not None:
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


def scale(objects=None, by=1, about=None, mode=Mode.REPLACE):
    factors = None
    if not isinstance(by, (int, float)):
        f = tuple(by)
        if len(f) == 2:
            f = (f[0], f[1], 1.0)
        if abs(f[0] - f[1]) > 1e-9 or abs(f[0] - f[2]) > 1e-9:
            factors = [f[0], f[1], f[2]]  # gp_GTrsf non-uniform scale
        else:
            by = f[0]
    builder = _active_builder()
    if objects is None and isinstance(builder, BuildLine) and factors is None:
        # scale the accumulated line segments in place (spec-level, so
        # make_face() after scale() still chains exactly)
        builder._specs = [_seg_scale(s, by) for s in builder._specs]
        return builder.line
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])

    def _scaled(t):
        topo = _topo(t)
        # build123d scales about about= or the shape's location position
        c = _v3(about) if about is not None else tuple(t.location.position) \
            if isinstance(t, Shape) else (0.0, 0.0, 0.0)
        if factors is not None:
            shift = (abs(c[0]) > _TOL or abs(c[1]) > _TOL or
                     abs(c[2]) > _TOL)
            if shift:
                topo = w.Translate([-c[0], -c[1], -c[2]], topo, True)
            topo = w.ScaleXYZ(factors, topo)
            if shift:
                topo = w.Translate([c[0], c[1], c[2]], topo)
        else:
            topo = w.ScaleUniform(topo, by, list(c))
        return _wrap_like(t, topo)
    results = [_scaled(t) for t in targets]
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def add(objects, rotation=None, clean=True, mode=Mode.ADD):
    builder = _active_builder()
    if builder is None:
        raise ValueError('add() requires an active builder context')
    objs = _tolist(objects)
    # curves added to a BuildLine contribute their segments (optionally
    # rotated) so make_face()/sweep() keep exact geometry
    if isinstance(builder, BuildLine):
        rot = None
        if rotation is not None:
            r = (0, 0, rotation) if isinstance(rotation, (int, float)) else tuple(rotation)
            rot = Rotation(r[0], r[1], r[2])
        ctx_locs = _ctx_locations()
        out = []
        for o in objs:
            if isinstance(o, Curve) and o._specs:
                specs = list(o._specs)
            elif isinstance(o, (Curve, Edge)):
                specs = _specs_from_topo_edges(o)
            else:
                raise TypeError('add() to BuildLine expects curves')
            if rot is not None:
                fn_dir = lambda d: _mat_vec(rot._R, d)
                specs = [_seg_transform(s, rot._transform_point, fn_dir)
                         for s in specs]
            # replicate at the active Locations contexts, like every other
            # object creation (build123d dimension-arrow pattern)
            placed_specs = []
            for loc in ctx_locs:
                fn_dir = lambda d: _mat_vec(loc._R, d)
                placed_specs.extend([_seg_transform(s, loc._transform_point,
                                                    fn_dir) for s in specs])
            builder._specs.extend(placed_specs)
            out.append(Curve(w.WireFromSegments(_chain_segments(placed_specs)),
                             placed_specs))
        return out[0] if len(out) == 1 else ShapeList(out)
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
                builder.pending_faces.append(Sketch(f.topo))
                builder.pending_face_planes.append(
                    Plane(origin=tuple(c), z_dir=tuple(n)))
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
            elif isinstance(e, (Curve, Edge)):
                specs.extend(_specs_from_topo_edges(e))
            else:
                raise NotImplementedError('make_face from non-curve objects')
    chained = _chain_segments(specs)
    wire = w.WireFromSegments(chained)
    face = w.MakeFace(wire)
    # build123d's make_face goes through _add_to_context, which CLEANS the
    # result (ShapeUpgrade_UnifySameDomain): tangent-continuous Bezier/spline
    # edges merge into one B-spline. That changes the geometry slightly (the
    # merged spline approximates the chain), so skipping it makes downstream
    # results diverge — bicycle_tire's revolved tire was 0.84% off with 40
    # profile edges instead of upstream's 37.
    face = w.UnifyWire(face, True)
    # normalize XY-planar faces to a +Z normal (build123d faces from wires
    # come out +Z regardless of the chained winding; ours follow the wire)
    n = w._faceNormal(face)
    bb = w.BoundingBox(face)
    if n[2] < -0.5 and bb and abs(bb[5] - bb[2]) < 1e-6:
        face = w.ReverseFace(face)
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


def _convex_hull_2d(pts):
    """Andrew monotone chain over (x, y) tuples -> CCW hull without the
    closing point."""
    pts = sorted(set(pts))
    if len(pts) <= 2:
        return list(pts)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _simplify_polyline(pts, tol):
    """Douglas-Peucker on a closed polygon (keeps hull bbox within tol)."""
    if len(pts) < 8:
        return list(pts)

    def dp(seg):
        if len(seg) < 3:
            return list(seg)
        (x1, y1), (x2, y2) = seg[0], seg[-1]
        dx, dy = x2 - x1, y2 - y1
        ln = math.hypot(dx, dy) or 1.0
        worst, wi = -1.0, 0
        for i in range(1, len(seg) - 1):
            d = abs(dy * (seg[i][0] - x1) - dx * (seg[i][1] - y1)) / ln
            if d > worst:
                worst, wi = d, i
        if worst <= tol:
            return [seg[0], seg[-1]]
        left = dp(seg[:wi + 1])
        return left[:-1] + dp(seg[wi:])
    half = len(pts) // 2
    a = dp(pts[:half + 1])
    b = dp(pts[half:] + pts[:1])
    return a[:-1] + b[:-1]


def make_hull(edges=None, mode=Mode.ADD):
    """Face from the 2D convex hull of the given edges (or the pending
    edges + the sketch under construction, like build123d).
    COMPROMISE(make-hull): upstream trims the source edges exactly (scipy
    ConvexHull over 2000 samples/edge + Edge.trim); lite hulls the same
    sample density into a POLYGON face simplified to 1e-4 — the boundary is
    piecewise-linear, within 1e-4 of the exact hull (well under harness
    tolerance), but arcs are not preserved as arcs."""
    builder = _active_builder(BuildSketch)
    hull_edges = []
    if edges is not None:
        for e in _tolist(edges):
            hull_edges.extend([e] if isinstance(e, Edge) else e.edges())
    elif builder is not None:
        if builder.pending_edge_specs:
            tmp = Curve(w.WireFromSegments(
                _chain_segments(builder.pending_edge_specs)))
            hull_edges.extend(tmp.edges())
            builder.pending_edge_specs = []
        if builder._obj is not None and builder._obj.topo is not None:
            hull_edges.extend(builder._obj.edges())
    if not hull_edges:
        raise ValueError('No objects to create a hull')
    pts = []
    per_edge = 2000  # = int(2 / tolerance) like build123d's make_convex_hull
    for ei, e in enumerate(hull_edges):
        for i in range(per_edge + 1):
            q = w._edgePointAt(e.topo, i / per_edge)
            pts.append((round(q[0], 9), round(q[1], 9), ei, i / per_edge))
    hull = _convex_hull_2d(pts)  # metadata rides along in fields 2/3
    if len(hull) < 3:
        raise ValueError('make_hull: degenerate hull')
    # rotate the cyclic hull so it starts at a source-edge change
    n = len(hull)
    start = 0
    for i in range(n):
        if hull[i][2] != hull[i - 1][2]:
            start = i
            break
    hull = hull[start:] + hull[:start]
    # group consecutive hull points into runs on the same source edge
    # (splitting on parameter jumps = hull left the edge and came back)
    step = 1.0 / per_edge
    runs = []
    for p in hull:
        if runs and runs[-1][-1][2] == p[2] and \
                abs(p[3] - runs[-1][-1][3]) <= 3.0 * step:
            runs[-1].append(p)
        else:
            runs.append([p])
    # drop transition-noise micro-runs (a few samples near tangency points)
    # — they would otherwise become micro-edges that break later fillets;
    # the bridges then connect the big runs directly (deviation from the
    # exact hull ~ the sagitta of a few sample steps, far below tolerance)
    big = [r for r in runs if len(r) >= 4]
    if big:
        runs = big
    # reconstruct: arc/line runs exactly from their source edge, plus
    # straight bridges between runs (the hull's tangent lines)
    segs = []

    def _pt(e, u):
        q = w._edgePointAt(e.topo, u)
        return [q[0], q[1], q[2]]
    if len(runs) == 1 and abs(runs[0][-1][3] - runs[0][0][3]) > 0.999:
        # the hull IS one closed source edge (e.g. a single circle)
        e = hull_edges[runs[0][0][2]]
        segs = [('arc3', [_pt(e, 0.0), _pt(e, 0.25), _pt(e, 0.5)]),
                ('arc3', [_pt(e, 0.5), _pt(e, 0.75), _pt(e, 1.0)])]
        face = w.MakeFace(w.WireFromSegments(segs))
        if w._faceNormal(face)[2] < -0.5:
            face = w.ReverseFace(face)
        return _combine(builder, Sketch(face), mode)
    for k, run in enumerate(runs):
        e = hull_edges[run[0][2]]
        if len(run) >= 3:
            t = w._edgeCurveType(e.topo)
            u0, u1 = run[0][3], run[-1][3]
            if t == 'Circle':
                segs.append(('arc3', [_pt(e, u0), _pt(e, (u0 + u1) / 2.0),
                                      _pt(e, u1)]))
            elif t == 'Line':
                segs.append(('line', [_pt(e, u0), _pt(e, u1)]))
            else:
                # COMPROMISE(make-hull): non-line/circle boundary pieces
                # stay sampled polylines (simplified to 1e-4) instead of
                # trimmed source curves
                poly = _simplify_polyline([(p[0], p[1]) for p in run], 1e-4)
                for i in range(len(poly) - 1):
                    segs.append(('line', [[poly[i][0], poly[i][1], 0.0],
                                          [poly[i + 1][0], poly[i + 1][1],
                                           0.0]]))
        elif len(run) == 2:
            segs.append(('line', [[run[0][0], run[0][1], 0.0],
                                  [run[1][0], run[1][1], 0.0]]))
        # bridge to the next run (cyclic)
        nxt = runs[(k + 1) % len(runs)][0]
        tail = segs[-1][1][-1] if segs else [run[-1][0], run[-1][1], 0.0]
        head = [nxt[0], nxt[1], 0.0]
        if abs(tail[0] - head[0]) > 1e-9 or abs(tail[1] - head[1]) > 1e-9:
            segs.append(('line', [list(tail), head]))
    face = w.MakeFace(w.WireFromSegments(segs))
    if w._faceNormal(face)[2] < -0.5:
        face = w.ReverseFace(face)
    return _combine(builder, Sketch(face), mode)


def draft(faces, neutral_plane, angle):
    """Apply a draft angle to faces of the active part
    (BRepOffsetAPI_DraftAngle — build123d's Solid.draft conventions)."""
    face_list = _tolist(faces)
    if not face_list:
        raise ValueError('draft: no faces given')
    parent = face_list[0].parent
    builder = _active_builder(BuildPart)
    target = parent if parent is not None else \
        (builder._obj if builder is not None else None)
    if target is None or target.topo is None:
        raise ValueError('draft: faces have no parent part')
    result = _wrap_like(target, w.DraftAngleFaces(
        target.topo, [f.topo for f in face_list], angle,
        list(neutral_plane.origin), list(neutral_plane.z_dir)))
    if builder is not None:
        builder._obj = builder._wrap(result.topo)
    return result


def project(objects=None, workplane=None, target=None, mode=Mode.ADD):
    """Project objects along a workplane's normal onto a target.
    COMPROMISE(project): only the BuildPart form used by the examples is
    implemented — pending sketch faces are projected onto the part
    (Face.project_to_shape) and the NEAREST resulting face(s) become the
    new pending faces for a following extrude(); the BuildLine/BuildSketch
    screen-projection forms raise."""
    builder = _active_builder(BuildPart)
    if objects is None and isinstance(builder, BuildPart) and \
            builder.pending_faces:
        object_list = list(builder.pending_faces)
        planes = list(builder.pending_face_planes)
        builder.pending_faces = []
        builder.pending_face_planes = []
        workplane = workplane or (planes[0] if planes else Plane.XY)
        if target is None:
            target = builder._obj
        if target is None or target.topo is None:
            raise ValueError('project: no target part')
        tc = target.center()
        for obj in object_list:
            for f in obj.faces():
                oc_ = f.center()
                d = Vector(workplane.z_dir)
                # aim the projection at the target
                if d.dot(tc - oc_) < 0:
                    d = -d
                projected = f.project_to_shape(target, tuple(d))
                if not projected:
                    raise ValueError('project: projection missed the part')
                # ALL projected surface pieces become pending faces (front
                # AND back, like build123d's project into BuildPart). Their
                # pending plane z_dir is the REVERSED projection direction
                # (validated against 0.11.1 maker_coin: a following
                # extrude(-depth, SUBTRACT) cuts front pieces INTO the part
                # and back pieces harmlessly out the back).
                back = -d
                for piece in projected:
                    c = w._faceCentroid(piece.topo)
                    builder.pending_faces.append(Sketch(piece.topo))
                    builder.pending_face_planes.append(
                        Plane(origin=tuple(c), z_dir=tuple(back)))
        return Sketch(w.MakeCompound(
            [s.topo for s in builder.pending_faces], True)) \
            if len(builder.pending_faces) > 1 else builder.pending_faces[0]
    raise NotImplementedError('project onto a screen workplane is not '
                              'supported in build123d-lite (only the '
                              'BuildPart pending-faces form)')


def thicken(to_thicken=None, amount=None, normal_override=None, both=False,
            clean=True, mode=Mode.ADD):
    """Thicken face(s) into solid(s) along their normals — build123d's
    operations_part.thicken over Solid.thicken."""
    if amount is None:
        raise ValueError('An amount must be provided')
    builder = _active_builder(BuildPart)
    if to_thicken is None:
        faces = [Face(t) for t, _pl in _pending_or_given(None)]
    elif isinstance(to_thicken, (list, tuple, ShapeList)):
        faces = [f for f in to_thicken]
    else:
        faces = list(to_thicken.faces())
    solids = []
    for f in faces:
        n = normal_override if normal_override is not None else f.normal_at()
        for direction in ([1, -1] if both else [1]):
            solids.append(Part.thicken(
                f, amount, normal_override=Vector(n) * direction))
    result = solids[0] if len(solids) == 1 else Part().fuse(*solids)
    if builder is not None:
        return _combine(builder, result, mode, Part)
    return Part(_topo(result))


def section(obj=None, section_by=Plane.XZ, height=0.0, clean=True,
            mode=Mode.PRIVATE):
    """Cross-section of a part: intersect (BRepAlgoAPI_Common) with a large
    finite rectangle face on each section plane, exactly like build123d's
    operations_part.section. Returns a Sketch of the section faces; default
    mode is Mode.PRIVATE (the section does NOT modify the builder)."""
    builder = _active_builder(BuildPart)
    to_section = obj if obj is not None else \
        (builder._obj if builder is not None else None)
    if to_section is None:
        raise ValueError('section: no object to section')
    body = _topo(to_section)
    bb = list(w.BoundingBox(body))
    diag = math.sqrt((bb[3] - bb[0]) ** 2 + (bb[4] - bb[1]) ** 2 +
                     (bb[5] - bb[2]) ** 2)
    max_size = max(abs(v) for v in bb) + diag
    planes_in = section_by if isinstance(section_by, (list, tuple)) \
        else [section_by]
    faces = []
    for pl in planes_in:
        cut_plane = Plane(origin=tuple(pl.origin + pl.z_dir * height),
                          z_dir=tuple(pl.z_dir))
        rect = Face.make_rect(2 * max_size, 2 * max_size, cut_plane)
        common = w.Intersection([body, rect.topo], True, 1e-7, True)
        faces.extend(Shape(common).faces())
    if not faces:
        raise ValueError('section: no intersection with the section plane')
    topos = [f.topo for f in faces]
    topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos, True)
    return _combine(builder, Sketch(topo), mode)


# --------------------------------------------------- joints & exporters ---

def _hlr_curve(topo):
    c = Curve(topo)
    return c


class ExportSVG:
    """No-op SVG exporter: geometry-side effects only (browser worker has
    no filesystem for the .svg — a warning is printed instead)."""

    def __init__(self, *args, **kwargs):
        print('build123d-lite: ExportSVG writes nothing in the browser')

    def add_layer(self, *args, **kwargs):
        return self

    def add_shape(self, *args, **kwargs):
        return self

    def write(self, *args, **kwargs):
        return True


def _unsupported(name):
    def f(*args, **kwargs):
        raise NotImplementedError(name + ' is not supported in build123d-lite')
    return f


# COMPROMISE(joints): joints are pure LOCATION ALGEBRA on lite shapes — a
# named attachment frame per part, with connect_to solving the same relative
# Location build123d does and repositioning the other part's baked geometry.
# There is NO assembly structure (no anytree parent/child, no XCAF, no
# symbol/triad rendering); that is a separate roadmap item.
class Joint:
    """Named attachment frame bound to a part (build123d Joint ABC)."""

    def __init__(self, label, parent):
        self.label = label
        self.parent = parent
        self.connected_to = None

    @property
    def location(self):
        return self.parent.location * self.relative_location

    def _connect_to(self, other, **kwargs):
        if not isinstance(other, Joint):
            raise TypeError('other must be a Joint, not ' +
                            type(other).__name__)
        relative_location = self.relative_to(other, **kwargs)
        other.parent.locate(self.parent.location * relative_location)
        self.connected_to = other

    def connect_to(self, other, **kwargs):
        return self._connect_to(other, **kwargs)

    def _lite_rebind(self, new_parent):
        """A copy of this joint bound to new_parent (used by copy.copy)."""
        c = self.__class__.__new__(self.__class__)
        c.__dict__.update(self.__dict__)
        c.parent = new_parent
        c.connected_to = None
        return c


def _joint_part(to_part):
    if to_part is None:
        builder = _active_builder(BuildPart)
        if builder is None:
            raise ValueError('Either specify to_part or place in BuildPart '
                             'scope')
        return builder
    return to_part


class RigidJoint(Joint):
    def __init__(self, label, to_part=None, joint_location=None):
        part = _joint_part(to_part)
        if joint_location is None:
            joint_location = Location()
        self.relative_location = part.location.inverse() * joint_location
        part.joints[label] = self
        Joint.__init__(self, label, part)

    def relative_to(self, other, **kwargs):
        if isinstance(other, RigidJoint):
            return self.relative_location * other.relative_location.inverse()
        if isinstance(other, RevoluteJoint):
            return other.relative_to(self,
                                     angle=kwargs.get('angle')).inverse()
        if isinstance(other, LinearJoint):
            return other.relative_to(
                self, position=kwargs.get('position')).inverse()
        if isinstance(other, CylindricalJoint):
            return other.relative_to(self, position=kwargs.get('position'),
                                     angle=kwargs.get('angle')).inverse()
        if isinstance(other, BallJoint):
            return other.relative_to(self,
                                     angles=kwargs.get('angles')).inverse()
        raise TypeError('unsupported joint pairing')


class RevoluteJoint(Joint):
    def __init__(self, label, to_part=None, axis=None,
                 angle_reference=None, angular_range=(0, 360), **kwargs):
        part = _joint_part(to_part)
        if axis is None:
            axis = Axis.Z
        self.angular_range = angular_range
        if angle_reference is not None:
            self.angle_reference = Vector(angle_reference)
        else:
            self.angle_reference = Plane(origin=(0, 0, 0),
                                         z_dir=axis.direction).x_dir
        self.relative_axis = axis.located(part.location.inverse())
        part.joints[label] = self
        Joint.__init__(self, label, part)

    @property
    def location(self):
        return self.parent.location * self.relative_axis.location

    def relative_to(self, other, angle=None, **kwargs):
        if not isinstance(other, RigidJoint):
            raise TypeError('RevoluteJoint.relative_to expects a RigidJoint')
        angle_degrees = self.angular_range[0] if angle is None else angle
        if angle_degrees < self.angular_range[0] or \
                angle_degrees > self.angular_range[1]:
            raise ValueError('angle (' + str(angle_degrees) +
                             ') must be in range of ' +
                             str(self.angular_range))
        # build123d: "Avoid strange rotations when angle is zero" quirk
        if angle_degrees == 0.0:
            angle_degrees = 360.0
        return (self.relative_axis.location * Rotation(0, 0, angle_degrees) *
                other.relative_location.inverse())


class LinearJoint(Joint):
    def __init__(self, label, to_part=None, axis=None,
                 linear_range=(0, 1e30), **kwargs):
        part = _joint_part(to_part)
        if axis is None:
            axis = Axis.Z
        self.axis = axis
        self.linear_range = linear_range
        self.position = None
        self.relative_axis = axis.located(part.location.inverse())
        self.angle = None
        part.joints[label] = self
        Joint.__init__(self, label, part)

    @property
    def location(self):
        return self.parent.location * self.relative_axis.location

    def relative_to(self, other, position=None, angle=None, **kwargs):
        position = sum(self.linear_range) / 2 if position is None else position
        if not self.linear_range[0] <= position <= self.linear_range[1]:
            raise ValueError('position (' + str(position) +
                             ') must be in range of ' +
                             str(self.linear_range))
        self.position = position
        if isinstance(other, RevoluteJoint):
            angle = other.angular_range[0] if angle is None else angle
            if not other.angular_range[0] <= angle <= other.angular_range[1]:
                raise ValueError('angle out of range')
            rotation = Location(Plane(
                origin=(0, 0, 0),
                x_dir=other.angle_reference.rotate(other.relative_axis, angle),
                z_dir=other.relative_axis.direction))
        else:
            angle = 0.0
            rotation = Location()
        self.angle = angle
        joint_relative_position = Location(
            self.relative_axis.position +
            self.relative_axis.direction * position) * rotation
        if isinstance(other, RevoluteJoint):
            other_relative_location = Location(other.relative_axis.position)
        else:
            other_relative_location = other.relative_location
        return joint_relative_position * other_relative_location.inverse()


class CylindricalJoint(Joint):
    def __init__(self, label, to_part=None, axis=None, angle_reference=None,
                 linear_range=(0, 1e30), angular_range=(0, 360), **kwargs):
        part = _joint_part(to_part)
        if axis is None:
            axis = Axis.Z
        self.axis = axis
        if angle_reference is not None:
            self.angle_reference = Vector(angle_reference)
        else:
            self.angle_reference = Plane(origin=(0, 0, 0),
                                         z_dir=axis.direction).x_dir
        self.angular_range = angular_range
        self.linear_range = linear_range
        self.relative_axis = axis.located(part.location.inverse())
        self.position = None
        self.angle = None
        part.joints[label] = self
        Joint.__init__(self, label, part)

    @property
    def location(self):
        return self.parent.location * self.relative_axis.location

    def relative_to(self, other, position=None, angle=None, **kwargs):
        if not isinstance(other, RigidJoint):
            raise TypeError('CylindricalJoint.relative_to expects a '
                            'RigidJoint')
        position = sum(self.linear_range) / 2 if position is None else position
        if not self.linear_range[0] <= position <= self.linear_range[1]:
            raise ValueError('position (' + str(position) +
                             ') must be in range of ' +
                             str(self.linear_range))
        self.position = position
        angle = sum(self.angular_range) / 2 if angle is None else angle
        if not self.angular_range[0] <= angle <= self.angular_range[1]:
            raise ValueError('angle (' + str(angle) +
                             ') must be in range of ' +
                             str(self.angular_range))
        self.angle = angle
        joint_relative_position = Location(
            self.relative_axis.position +
            self.relative_axis.direction * position)
        joint_rotation = Location(Plane(
            origin=(0, 0, 0),
            x_dir=self.angle_reference.rotate(self.relative_axis, angle),
            z_dir=self.relative_axis.direction))
        return (joint_relative_position * joint_rotation *
                other.relative_location.inverse())


class BallJoint(Joint):
    def __init__(self, label, to_part=None, joint_location=None,
                 angular_range=((0, 360), (0, 360), (0, 360)),
                 angle_reference=None, **kwargs):
        part = _joint_part(to_part)
        if joint_location is None:
            joint_location = Location()
        self.relative_location = part.location.inverse() * joint_location
        part.joints[label] = self
        self.angular_range = angular_range
        self.angle_reference = angle_reference if angle_reference is not None \
            else Plane.XY
        Joint.__init__(self, label, part)

    def relative_to(self, other, angles=None, **kwargs):
        if not isinstance(other, RigidJoint):
            raise TypeError('BallJoint.relative_to expects a RigidJoint')
        if isinstance(angles, Rotation):
            angle_rotation = angles
        elif isinstance(angles, (tuple, list)):
            angle_rotation = Rotation(angles[0], angles[1], angles[2])
        elif angles is None:
            angle_rotation = Rotation(self.angular_range[0][0],
                                      self.angular_range[1][0],
                                      self.angular_range[2][0])
        else:
            raise TypeError('angles is of an unknown type')
        rotation = angle_rotation * self.angle_reference.location
        o = rotation.orientation
        for i, r in enumerate((o.X, o.Y, o.Z)):
            if not self.angular_range[i][0] <= r <= self.angular_range[i][1]:
                raise ValueError('angles must be in range of ' +
                                 str(self.angular_range))
        return (self.relative_location * rotation *
                other.relative_location.inverse())


class Mesher:
    """STL-only mesher (build123d's Mesher writes 3MF/STL via lib3mf).
    COMPROMISE(mesher): only STL export is supported, via the JS engine's
    StlAPI_Writer into the worker's Emscripten MEMFS — there is no lib3mf in
    the WASM build, so .3mf paths raise; read() is not supported."""

    def __init__(self, unit='MM', **kwargs):
        self.unit = unit
        self._shapes = []
        self.linear_deflection = 0.001
        self.angular_deflection = 0.1

    @property
    def mesh_count(self):
        return len(self._shapes)

    def add_shape(self, shape, linear_deflection=0.001,
                  angular_deflection=0.1, **kwargs):
        for s in _tolist(shape):
            self._shapes.append(s)
        self.linear_deflection = linear_deflection
        self.angular_deflection = angular_deflection

    def add_code_to_metadata(self):
        pass  # no source file in the browser

    def add_meta_data(self, *args, **kwargs):
        pass

    def write(self, file_name):
        name = str(file_name)
        if not name.lower().endswith('.stl'):
            raise NotImplementedError(
                'build123d-lite Mesher writes STL only (no lib3mf in the '
                'WASM build); got ' + name)
        if not self._shapes:
            raise ValueError('Mesher: no shapes added')
        topos = [_topo(s) for s in self._shapes]
        topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos, True)
        text = w.ExportSTL(topo, name.replace('/', '_'),
                           self.linear_deflection, self.angular_deflection)
        if text is None:
            raise RuntimeError('STL export failed')
        return True

    def read(self, file_name):
        raise NotImplementedError('Mesher.read is not supported in '
                                  'build123d-lite')


ExportDXF = _unsupported('ExportDXF')
import_step = _unsupported('import_step')
import_stl = _unsupported('import_stl')
import_svg = _unsupported('import_svg')


def export_stl(to_export, file_path, tolerance=1e-3, angular_tolerance=0.1,
               ascii_format=False):
    """Write an STL into the worker's MEMFS (BRepMesh + StlAPI_Writer, the
    same calls build123d's export_stl makes). COMPROMISE(mesher): the file
    lands in the in-memory Emscripten FS, not the user's disk (browser
    workers have no filesystem access); ascii_format is always True."""
    text = w.ExportSTL(_topo(to_export), str(file_path).replace('/', '_'),
                       tolerance, angular_tolerance)
    return text is not None


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
                   key=lambda t: min(t[1], t[2]), reverse=True)
    sizes = sorted(sizes, key=lambda t: max(t[1], t[2]), reverse=True)
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
    """Absolute volume of a shape in mm^3 (sum over solids)."""
    return w.SolidsVolume(_topo(shape))


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
  _scipy_shim: `
# scipy shim implementation module (imported by the 'scipy' package shims).
# COMPROMISE(scipy-shim): pure-Python Nelder-Mead stands in for
# scipy.optimize.minimize (same simplex init/reflect/expand/contract/shrink
# rules and convergence thresholds as scipy's implementation, but float
# arithmetic instead of numpy arrays — objectives must accept plain lists);
# minimize_scalar supports method='bounded' via golden-section. EVERY other
# scipy API raises loudly instead of approximating.


class OptimizeResult(dict):
    def __getattr__(self, k):
        try:
            return self[k]
        except KeyError:
            raise AttributeError(k)

    def __setattr__(self, k, v):
        self[k] = v


def minimize(fun, x0, args=(), method='Nelder-Mead', bounds=None, tol=None,
             options=None, **kwargs):
    if method is not None and str(method).lower() != 'nelder-mead':
        raise NotImplementedError(
            'scipy shim: only minimize(method="Nelder-Mead") is available '
            'in build123d-lite (got ' + repr(method) + ')')
    if not isinstance(args, (list, tuple)):
        args = (args,)
    try:
        x0 = [float(v) for v in x0]
    except TypeError:
        x0 = [float(x0)]
    n = len(x0)
    xatol = fatol = 1e-4
    if tol is not None:
        xatol = fatol = float(tol)
    opts = options or {}
    xatol = opts.get('xatol', xatol)
    fatol = opts.get('fatol', fatol)
    maxiter = opts.get('maxiter', 200 * n)
    lo = [None] * n
    hi = [None] * n
    if bounds is not None:
        for i, b in enumerate(bounds):
            lo[i], hi[i] = b[0], b[1]

    def clip(x):
        out = []
        for i, v in enumerate(x):
            if lo[i] is not None and v < lo[i]:
                v = lo[i]
            if hi[i] is not None and v > hi[i]:
                v = hi[i]
            out.append(v)
        return out

    def f(x):
        r = fun(list(x), *args)
        try:
            return float(r)
        except TypeError:
            return float(r[0])

    sim = [clip(list(x0))]
    for i in range(n):
        y = list(x0)
        y[i] = y[i] * 1.05 if y[i] != 0 else 0.00025
        sim.append(clip(y))
    fsim = [f(x) for x in sim]
    it = 0
    for it in range(int(maxiter)):
        order = sorted(range(n + 1), key=lambda j: fsim[j])
        sim = [sim[j] for j in order]
        fsim = [fsim[j] for j in order]
        if max(abs(sim[j][i] - sim[0][i])
               for j in range(1, n + 1) for i in range(n)) <= xatol and \
                max(abs(fsim[j] - fsim[0]) for j in range(1, n + 1)) <= fatol:
            break
        cen = [sum(sim[j][i] for j in range(n)) / n for i in range(n)]
        xr = clip([cen[i] + (cen[i] - sim[n][i]) for i in range(n)])
        fr = f(xr)
        if fr < fsim[0]:
            xe = clip([cen[i] + 2.0 * (cen[i] - sim[n][i]) for i in range(n)])
            fe = f(xe)
            if fe < fr:
                sim[n], fsim[n] = xe, fe
            else:
                sim[n], fsim[n] = xr, fr
        elif fr < fsim[n - 1]:
            sim[n], fsim[n] = xr, fr
        else:
            if fr < fsim[n]:
                xc = clip([cen[i] + 0.5 * (cen[i] - sim[n][i])
                           for i in range(n)])
            else:
                xc = clip([cen[i] - 0.5 * (cen[i] - sim[n][i])
                           for i in range(n)])
            fc = f(xc)
            if fc < min(fr, fsim[n]):
                sim[n], fsim[n] = xc, fc
            else:
                for j in range(1, n + 1):
                    sim[j] = clip([sim[0][i] + 0.5 * (sim[j][i] - sim[0][i])
                                   for i in range(n)])
                    fsim[j] = f(sim[j])
    order = sorted(range(n + 1), key=lambda j: fsim[j])
    return OptimizeResult(x=list(sim[order[0]]), fun=fsim[order[0]],
                          success=True, nit=it + 1)


def minimize_scalar(fun, bounds=None, method='bounded', args=(),
                    options=None, **kwargs):
    if str(method).lower() != 'bounded' or bounds is None:
        raise NotImplementedError(
            'scipy shim: only minimize_scalar(method="bounded", bounds=...) '
            'is available in build123d-lite')
    if not isinstance(args, (list, tuple)):
        args = (args,)
    xatol = (options or {}).get('xatol', 1e-5)
    a, b = float(bounds[0]), float(bounds[1])
    phi = 0.6180339887498949
    c = b - phi * (b - a)
    d = a + phi * (b - a)
    fc, fd = fun(c, *args), fun(d, *args)
    while (b - a) > xatol:
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - phi * (b - a)
            fc = fun(c, *args)
        else:
            a, c, fc = c, d, fd
            d = a + phi * (b - a)
            fd = fun(d, *args)
    x = (a + b) / 2.0
    return OptimizeResult(x=x, fun=fun(x, *args), success=True)


def _raising(name):
    def f(*args, **kwargs):
        raise NotImplementedError(
            'scipy.' + name + ' is not available in build123d-lite (only '
            'optimize.minimize / optimize.minimize_scalar are shimmed)')
    return f


class _IndexRows(list):
    """Nested int lists standing in for scipy's ndarray of indices."""

    def tolist(self):
        return [list(r) if isinstance(r, list) else r for r in self]


class ConvexHull:
    """3-D convex hull computed by the worker's bundled quickhull3d.
    Only the attributes the examples use are provided: .points,
    .simplices (triangulated facets, scipy convention) and .vertices.
    2-D hulls are not implemented (scipy uses qhull; the 2-D case in
    lite is served by make_hull's own Andrew-monotone hull)."""

    def __init__(self, points, *args, **kwargs):
        pts = [[float(c) for c in p] for p in points]
        if len(pts) == 0 or len(pts[0]) != 3:
            raise NotImplementedError(
                'scipy shim: only 3-D ConvexHull is supported in '
                'build123d-lite')
        from browser import self as _w
        tris = _w.ConvexHull3D(pts)
        self.points = pts
        self.simplices = _IndexRows(
            _IndexRows(int(i) for i in t) for t in tris)
        seen = set()
        for t in self.simplices:
            seen.update(t)
        self.vertices = _IndexRows(sorted(seen))


Voronoi = _raising('spatial.Voronoi')


class _Namespace:
    def __init__(self, prefix, **entries):
        self._prefix = prefix
        for k, v in entries.items():
            setattr(self, k, v)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        raise NotImplementedError(
            'scipy.' + self._prefix + '.' + name + ' is not available in '
            'build123d-lite')


optimize = _Namespace('optimize', minimize=minimize,
                      minimize_scalar=minimize_scalar,
                      OptimizeResult=OptimizeResult)
spatial = _Namespace('spatial', ConvexHull=ConvexHull, Voronoi=Voronoi)
`,
  scipy: `
# __path__ marks this as a package so Brython's importer resolves the
# pre-registered 'scipy.optimize' / 'scipy.spatial' submodules from cache
__path__ = []
from _scipy_shim import optimize, spatial
`,
  'scipy.optimize': `
from _scipy_shim import minimize, minimize_scalar, OptimizeResult
`,
  'scipy.spatial': `
from _scipy_shim import ConvexHull, Voronoi
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
