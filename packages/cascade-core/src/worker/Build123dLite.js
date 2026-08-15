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
//  * Spline()/Edge.make_spline INTERPOLATE exactly (GeomAPI_Interpolate,
//    incl. tangents=/tangent_scalars=/per-point tangents/periodic).
//  * Unsupported (raise NotImplementedError rather than fake geometry):
//    the drafting module beyond ArrowHead, partial cones,
//    split(keep=Keep.BOTH), offset(min_edge_length=) (no
//    fix_degenerate_edges), Kind.TANGENT offsets, 3MF export, imports.
//  * Boolean results are cleaned with ShapeUpgrade_UnifySameDomain (the
//    standard library always does); face/edge COUNTS can therefore differ
//    from build123d even when the geometry (volume/bbox) matches.
//  * Every remaining deliberate deviation is marked in source with a
//    grep-able COMPROMISE(<topic>) comment; CLAUDE.md indexes them.

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
# mass units (build123d build_common): grams, used by the Too Tall Toby
# challenge scripts to convert a volume into a mass check
G = 1.0
KG = 1000.0
LB = 453.59237

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


class Intrinsic:
    """Order to apply INTRINSIC rotations by axis (build123d Intrinsic; each
    rotation is about the already-rotated frame)."""
    XYZ = 'XYZ'
    XZY = 'XZY'
    YZX = 'YZX'
    YXZ = 'YXZ'
    ZXY = 'ZXY'
    ZYX = 'ZYX'
    XYX = 'XYX'
    XZX = 'XZX'
    YZY = 'YZY'
    YXY = 'YXY'
    ZXZ = 'ZXZ'
    ZYZ = 'ZYZ'


class Extrinsic:
    """Order to apply EXTRINSIC rotations by axis (build123d Extrinsic; every
    rotation is about the FIXED frame)."""
    XYZ = 'xXYZ'
    XZY = 'xXZY'
    YZX = 'xYZX'
    YXZ = 'xYXZ'
    ZXY = 'xZXY'
    ZYX = 'xZYX'
    XYX = 'xXYX'
    XZX = 'xXZX'
    YZY = 'xYZY'
    YXY = 'xYXY'
    ZXZ = 'xZXZ'
    ZYZ = 'xZYZ'


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


class LengthMode:
    """How PolarLine's length argument is measured (build123d LengthMode)."""
    DIAGONAL = 'DIAGONAL'
    HORIZONTAL = 'HORIZONTAL'
    VERTICAL = 'VERTICAL'


class Side:
    LEFT = 'LEFT'
    RIGHT = 'RIGHT'
    BOTH = 'BOTH'


class AngularDirection:
    CLOCKWISE = 'CLOCKWISE'
    COUNTER_CLOCKWISE = 'COUNTER_CLOCKWISE'


class ContinuityLevel:
    """How smoothly a blend joins its neighbours (build123d
    ContinuityLevel): position only, tangent, or curvature."""
    C0 = 0
    C1 = 1
    C2 = 2


class Sagitta:
    """Which of the two arcs between the tangency points a constrained-arc
    solution contributes (build123d Sagitta — the values ARE the indices into
    the length-sorted pair)."""
    SHORT = 0
    LONG = -1
    BOTH = 1


class Tangency:
    """Where the solution lies relative to a tangency argument (build123d
    Tangency, GccEnt's qualifiers)."""
    UNQUALIFIED = 'UNQUALIFIED'
    ENCLOSING = 'ENCLOSING'
    ENCLOSED = 'ENCLOSED'
    OUTSIDE = 'OUTSIDE'


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
    BORDER = 'BORDER'
    DASHDOT = 'DASHDOT'
    DIVIDE = 'DIVIDE'
    ISO_DASH = 'ISO_DASH'
    ISO_DASH_SPACE = 'ISO_DASH_SPACE'
    ISO_LONG_DASH_DOT = 'ISO_LONG_DASH_DOT'
    ISO_LONG_DASH_DOUBLE_DOT = 'ISO_LONG_DASH_DOUBLE_DOT'
    ISO_LONG_DASH_TRIPLE_DOT = 'ISO_LONG_DASH_TRIPLE_DOT'
    ISO_DOT = 'ISO_DOT'
    ISO_LONG_DASH_SHORT_DASH = 'ISO_LONG_DASH_SHORT_DASH'
    ISO_LONG_DASH_DOUBLE_SHORT_DASH = 'ISO_LONG_DASH_DOUBLE_SHORT_DASH'
    ISO_DASH_DOT = 'ISO_DASH_DOT'
    ISO_DOUBLE_DASH_DOT = 'ISO_DOUBLE_DASH_DOT'
    ISO_DASH_DOUBLE_DOT = 'ISO_DASH_DOUBLE_DOT'
    ISO_DOUBLE_DASH_DOUBLE_DOT = 'ISO_DOUBLE_DASH_DOUBLE_DOT'
    ISO_DASH_TRIPLE_DOT = 'ISO_DASH_TRIPLE_DOT'
    ISO_DOUBLE_DASH_TRIPLE_DOT = 'ISO_DOUBLE_DASH_TRIPLE_DOT'


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
                if len(t) == 0:
                    # Vector(()) is the origin upstream too (0 * (x, y, z) is
                    # how the docs write a conditional offset)
                    self._v = (0.0, 0.0, 0.0)
                elif len(t) == 1:
                    self._v = (_num(t[0]), 0.0, 0.0)
                elif len(t) == 2:
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
        reference = self.cross(b).dot(n)
        scale = self.length * b.length * n.length
        if abs(reference) <= 1e-12 * max(scale, _TOL_1E6):
            # OCCT's gp_Vec::AngleWithRef falls back to the UNSIGNED angle when
            # the cross product has no component along the reference (the two
            # vectors are parallel, or the plane they span is perpendicular to
            # it), so antiparallel is +180, never -180. Python's atan2 would
            # return -180 for a negative zero and silently flip every
            # comparison built on this (offset_2d's Side.LEFT/RIGHT pick).
            return math.degrees(math.acos(
                max(-1.0, min(1.0, self.normalized().dot(b.normalized())))))
        return math.degrees(math.atan2(reference, self.dot(b)))

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
    if len(t) == 0:
        return (0.0, 0.0, 0.0)
    if len(t) == 1:
        return (_num(t[0]), 0.0, 0.0)
    if len(t) == 2:
        return (_num(t[0]), _num(t[1]), 0.0)
    return (_num(t[0]), _num(t[1]), _num(t[2]))


# ---------------------------------------- canonical free-edge parametrization
# Free edges and wires - the ones that come out of intersections, sections,
# projections and boolean operations rather than being drawn by the user -
# carry a start point ("seam"), a traversal direction and a parameter range
# that the CAD kernel picked for its own convenience. Those choices are
# IMPLEMENTATION DEFINED: they depend on the parametric frames of the surfaces
# that produced the curve (which meridian is u = 0), on the seed point of the
# surface/surface walking algorithm and on the order in which the boolean
# assembler happened to visit the faces of the result. Two geometrically
# identical solids therefore produce section edges with different seams and
# different directions, and anything measured from position_at(0) or
# Axis(edge) silently moves with them.
#
# This is a port of build123d's proposed topology/canonical.py - same names,
# same defaults, same tie-break conventions; see
# the canonical-edges research record (zalo/build123d branch canonical-research,
# research/) for the full write-up and the upstream
# patch. Pure geometry: the only primitive needed is "give me the point at arc
# length d", which is why it can be driven by a polyline and checked against a
# second CAD kernel.

# Number of arc length samples used to search for the canonical seam. The
# search resolves near-extremal arcs down to length / (SAMPLES / 2).
CANONICAL_SAMPLES = 512

# Relative size of the "lexicographically extremal" band, as a fraction of the
# bounding box diagonal of the loop. Making the band a finite width (instead of
# hunting for the extremum itself) is what makes the seam well conditioned: the
# band edges are transversal crossings, so they are located to full precision,
# and the midpoint of the band cancels the leading curvature term.
CANONICAL_BAND = 1e-6


class CanonicalForm:
    """Canonical traversal of a 1D shape.

    start: arc length distance, measured along the shape's current
    (orientation aware) parametrization, of the canonical start point. Always
    0.0 for open shapes.
    sign: +1 if the shape's current direction is canonical, -1 if it must be
    traversed backwards.
    closed: whether the shape was treated as a closed loop.

    (build123d's is a NamedTuple; this one is iterable and compares equal to
    the equivalent tuple so the two behave alike.)"""

    def __init__(self, start, sign, closed):
        self.start = start
        self.sign = sign
        self.closed = closed

    def position(self, position):
        """Map a canonical normalized position to the shape's own normalized
        position, so that shape.position_at(form.position(u)) walks the shape
        canonically."""
        if self.closed:
            return (self.start + self.sign * position) % 1.0
        return position if self.sign > 0 else 1.0 - position

    def __iter__(self):
        return iter((self.start, self.sign, self.closed))

    def __len__(self):
        return 3

    def __getitem__(self, i):
        return (self.start, self.sign, self.closed)[i]

    def __eq__(self, other):
        try:
            return tuple(self) == tuple(other)
        except TypeError:
            return NotImplemented

    def __repr__(self):
        return ('CanonicalForm(start=' + repr(self.start) + ', sign=' +
                repr(self.sign) + ', closed=' + repr(self.closed) + ')')


def _quantise(value, resolution):
    """value snapped to a multiple of resolution.

    Comparisons of "is this coordinate smaller?" are only meaningful above the
    geometric tolerance; quantising makes near-equal values tie EXACTLY so the
    next coordinate can decide."""
    return int(math.floor(value / resolution + 0.5))


def _coordinate(point, index):
    """The index-th coordinate of a Vector."""
    return (point.X, point.Y, point.Z)[index]


def lexicographic_key(point):
    """The (x, y, z) sort key used by every canonical comparison."""
    if isinstance(point, Vector):
        return (point.X, point.Y, point.Z)
    x, y, z = point
    return (x, y, z)


def loop_area_vector(points):
    """Vector area (Newell) of a closed polyline: 1/2 sum (p_i - c) x (p_i+1 - c).

    Its direction is the loop's winding axis (exact for planar loops, the
    least-squares normal for non planar ones) and its length is the enclosed
    area, so it doubles as a degeneracy measure."""
    count = len(points)
    center = Vector(sum(p.X for p in points) / count,
                    sum(p.Y for p in points) / count,
                    sum(p.Z for p in points) / count)
    area = Vector(0, 0, 0)
    for i in range(count):
        first = points[i] - center
        second = points[(i + 1) % count] - center
        area = area + first.cross(second)
    return area * 0.5


def _dominant_axis(area):
    """Index of the axis the loop winds about, preferring X, then Y, then Z on
    exact ties (a tie means the loop's plane bisects two axes, where no
    geometric rule can do better than a documented convention)."""
    magnitudes = (abs(area.X), abs(area.Y), abs(area.Z))
    best = 0
    for index in (1, 2):
        if magnitudes[index] > magnitudes[best]:
            best = index
    return best


def _golden_min(function, low, high, iterations=40):
    """(location, value) of the minimum of a unimodal function on [low, high].

    The VALUE of a smooth minimum is well conditioned; its location is not (an
    error d in the location only changes the value by O(d^2)), so the location
    is used as nothing more than a seed for the band search below."""
    inv_phi = 0.6180339887498949
    b_low, b_high = low, high
    x_1 = b_high - inv_phi * (b_high - b_low)
    x_2 = b_low + inv_phi * (b_high - b_low)
    f_1, f_2 = function(x_1), function(x_2)
    for _ in range(iterations):
        if f_1 <= f_2:
            b_high, x_2, f_2 = x_2, x_1, f_1
            x_1 = b_high - inv_phi * (b_high - b_low)
            f_1 = function(x_1)
        else:
            b_low, x_1, f_1 = x_1, x_2, f_2
            x_2 = b_low + inv_phi * (b_high - b_low)
            f_2 = function(x_2)
    return (x_1, f_1) if f_1 <= f_2 else (x_2, f_2)


def _bisect_level(function, inside, outside, level):
    """Distance where function crosses level, bracketed by a point below the
    level and a point above it. A transversal crossing, hence full
    precision."""
    low, high = inside, outside
    for _ in range(60):
        mid = 0.5 * (low + high)
        if function(mid) <= level:
            low = mid
        else:
            high = mid
    return 0.5 * (low + high)


def _local_minima(values):
    """One representative index per local minimum of a cyclic sample list.

    Plateaus (a straight extremal side, say) collapse to their middle sample, so
    the number of candidates stays proportional to the number of FEATURES, not
    to the number of samples."""
    count = len(values)
    if count == 0:
        return []
    if all(value == values[0] for value in values):
        return [0]
    minima = []
    for index in range(count):
        if not values[index] < values[index - 1]:
            continue  # not a strict descent into index
        end = index
        while values[(end + 1) % count] == values[index] and end - index < count:
            end = end + 1
        if values[(end + 1) % count] > values[index]:
            minima.append(((index + end) // 2) % count)
    return minima


def _band_midpoint(value, inside, level, step, samples, length):
    """Arc-length midpoint of the value <= level band that contains inside.

    The band edges are transversal crossings of level, so bisection finds them
    to full precision, and their midpoint cancels the leading curvature term of
    the extremum inside the band. Neither the midpoint nor the width depends on
    where the samples happened to fall."""
    backward = inside
    for _ in range(samples):
        if value(backward - step) > level:
            break
        backward = backward - step
    forward = inside
    for _ in range(samples):
        if value(forward + step) > level:
            break
        forward = forward + step
    band_start = _bisect_level(value, backward, backward - step, level)
    band_end = _bisect_level(value, forward, forward + step, level)
    return (band_start + 0.5 * ((band_end - band_start) % length)) % length


def canonical_form(sampler, length, closed, samples=CANONICAL_SAMPLES,
                   band=CANONICAL_BAND):
    """Canonical traversal of a curve given an arc length sampler.

    sampler(distance) -> Vector, distance in [0, length]; length is the total
    arc length; closed says whether sampler(0) == sampler(length).

    Open shapes are traversed from the lexicographically smaller of their two
    end points. Closed shapes start at the midpoint of the lexicographically
    extremal band and wind counter-clockwise about the dominant axis of their
    area vector."""
    if length <= _TOL_1E6:
        return CanonicalForm(0.0, 1, closed)

    if not closed:
        start, end = sampler(0.0), sampler(length)
        sign = 1 if lexicographic_key(start) <= lexicographic_key(end) else -1
        return CanonicalForm(0.0, sign, False)

    step = length / samples
    points = [sampler(index * step) for index in range(samples)]

    # ---- direction: wind counter-clockwise about the dominant winding axis
    area = loop_area_vector(points)
    axis = _dominant_axis(area)
    sign = 1
    if abs(_coordinate(area, axis)) > _TOL_1E6 * _TOL_1E6:
        sign = 1 if _coordinate(area, axis) > 0 else -1

    # ---- seam: midpoint of the lexicographically extremal band
    diagonal = max(max(_coordinate(p, i) for p in points) -
                   min(_coordinate(p, i) for p in points) for i in range(3))
    tolerance_band = max(band * max(diagonal, _TOL_1E6), _TOL_1E6 * 1e-3)

    seam = 0.0
    for coordinate in (0, 1, 2):

        def value(distance, coordinate=coordinate):
            return _coordinate(sampler(distance % length), coordinate)

        values = [_coordinate(p, coordinate) for p in points]

        # Every local minimum of the sampled coordinate is a candidate feature;
        # refining each one's VALUE (its location is ill conditioned, its value
        # is not) says which of them are extremal to within the band. Looking
        # only at samples below a threshold would miss a band whose samples all
        # sit just above it.
        refined = []
        for index in _local_minima(values):
            location, minimum = _golden_min(value, (index - 1) * step,
                                            (index + 1) * step)
            if values[index] < minimum:
                location, minimum = index * step, values[index]
            refined.append((minimum, location))
        if not refined:
            continue

        level = min(minimum for minimum, _ in refined) + tolerance_band
        if all(sample_value <= level for sample_value in values):
            continue  # loop is flat in this coordinate: fall through to the next

        # Each extremal band is reduced to its own midpoint, and the bands are
        # then ranked by THOSE POINTS in the remaining coordinates. Comparing the
        # minima of whichever samples fell inside a band would make the choice
        # depend on the sampling phase. Coordinates are quantised to the band
        # width so that two candidates whose y agree to within tolerance tie on y
        # and let z decide, instead of the last bits of a mirror-symmetric pair
        # of minima picking the winner.
        others = [other for other in (0, 1, 2) if other != coordinate]
        candidates = []
        for minimum, location in refined:
            if minimum > level:
                continue
            midpoint = _band_midpoint(value, location, level, step, samples, length)
            point = sampler(midpoint)
            candidates.append((tuple(_quantise(_coordinate(point, other),
                                               tolerance_band)
                                     for other in others), midpoint))
        if not candidates:
            continue

        # A surviving tie means the loop is symmetric about this band to within
        # tolerance, where no geometric rule can choose - the smallest midpoint
        # distance wins, which is stable for a given input.
        seam = min(candidates)[1]
        break

    return CanonicalForm(seam / length, sign, True)


# build123d's one_d.py imports the rule under this alias so the Mixin1D method
# of the same name can shadow it
_canonical_form = canonical_form


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


def _euler_mat(angles, order, intrinsic=True):
    """Rotation matrix for an arbitrary Euler sequence (build123d's
    Intrinsic/Extrinsic orders, which map onto gp_EulerSequence). Intrinsic
    applies each rotation about the ALREADY-ROTATED frame, i.e. the matrices
    multiply left-to-right; extrinsic multiplies right-to-left about the fixed
    frame."""
    axes = {'X': lambda a: ((1.0, 0.0, 0.0),
                            (0.0, math.cos(a), -math.sin(a)),
                            (0.0, math.sin(a), math.cos(a))),
            'Y': lambda a: ((math.cos(a), 0.0, math.sin(a)),
                            (0.0, 1.0, 0.0),
                            (-math.sin(a), 0.0, math.cos(a))),
            'Z': lambda a: ((math.cos(a), -math.sin(a), 0.0),
                            (math.sin(a), math.cos(a), 0.0),
                            (0.0, 0.0, 1.0))}
    R = _MAT_I
    letters = list(order)
    values = [math.radians(a) for a in angles]
    if not intrinsic:
        letters = list(reversed(letters))
        values = list(reversed(values))
    for letter, value in zip(letters, values):
        R = _mat_mul(R, axes[letter](value))
    return R


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
            if isinstance(args[2], str):
                # Location(position, (rx, ry, rz), Intrinsic/Extrinsic order)
                # - build123d's Euler-sequence form (gp_EulerSequence)
                order = args[2]
                intrinsic = not order.startswith('x')
                self._t = _v3(args[0])
                self._R = _euler_mat(_v3(args[1]),
                                     order[1:] if not intrinsic else order,
                                     intrinsic)
            else:
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
            # build123d's Shape.moved deep-copies the shape, so its JOINTS come
            # along rebound to the copy (copy_attributes_to); their frames are
            # relative to the parent, so they follow the move automatically.
            if other.joints:
                moved.joints = {k: j._lite_rebind(moved)
                                for k, j in other.joints.items()}
            if isinstance(moved, Curve) and moved._specs:
                # keep segment data consistent with the moved geometry so
                # make_face()/sweep() can still chain the result exactly
                fn_dir = lambda d: _mat_vec(self._R, d)
                try:
                    moved._specs = [_seg_transform(s, self._transform_point,
                                                   fn_dir, self)
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
    def __init__(self, origin=(0, 0, 0), direction=(0, 0, 1), canonical=False):
        # Axis(edge): origin at the start, direction along the tangent.
        # (duck-typed on .topo — the Shape class is defined later in this
        # module, and Axis.X/Y/Z are created at module load)
        # Axis(edge, canonical=True): origin & direction from the edge's
        # CANONICAL traversal instead of from the underlying curve's first
        # parameter (build123d's opt-in; default False keeps the pre-0.12
        # behaviour, which also disagrees with edge.position_at(0) whenever the
        # edge is REVERSED).
        # Axis(location) / Axis(plane): the frame's origin and its z axis
        # (build123d Axis(Location) - used to build joint axes from holes)
        # Duck-typed: Axis.X/Y/Z are constructed at module load, BEFORE the
        # Location and Plane classes exist, so isinstance() cannot be used.
        if hasattr(origin, '_R') and hasattr(origin, 'position'):    # Location
            self.position = Vector(origin.position)
            self.direction = Vector(origin.z_axis.direction).normalized()
            return
        if hasattr(origin, 'z_dir') and hasattr(origin, 'origin'):   # Plane
            self.position = Vector(origin.origin)
            self.direction = Vector(origin.z_dir).normalized()
            return
        if hasattr(origin, 'topo') and origin.topo is not None:
            edge = origin
            if origin.topo.ShapeType().value != 6:
                edge = origin.edges()[0]
            if canonical:
                canonical_edge = edge.canonical()
                self.position = canonical_edge.position_at(0)
                self.direction = canonical_edge.tangent_at(0).normalized()
                return
            p = w._edgePointAt(edge.topo, 0.0)
            t = w._edgeTangentAt(edge.topo, 0.0)
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
    # A Builder stands in for its result everywhere build123d takes a Shape
    # (upstream Shape methods accept builders through the same coercion).
    if isinstance(obj, Builder):
        obj = obj._obj
        if obj is None:
            raise ValueError('this builder has no result yet')
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
    if isinstance(objs, (Shape, Builder)):
        # a Builder stands in for its result and is NOT iterable upstream
        # either (build123d's add() coerces obj._obj per element)
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
        self._parent = None
        # build123d tracks a top-level Location on every shape; lite bakes
        # transforms into geometry but keeps the equivalent composed Location
        # here so joints / locate() / .position can reason about frames.
        self._loc = None  # None = identity
        self.joints = {}

    @property
    def wrapped(self):
        """The underlying raw (JS/OCCT) shape — build123d compat."""
        return self.topo

    @property
    def parent(self):
        return self._parent

    @parent.setter
    def parent(self, value):
        """Attaching a shape to a parent ADDS it to the parent's children -
        build123d's assembly tree is anytree, where setting .parent is how a
        node joins the tree (tutorial_joints does exactly this with the M6
        screw). COMPROMISE(joints) still holds: there is no anytree, only the
        parent/children links that Compound walks."""
        if self._parent is not None and self in self._parent.children:
            self._parent.children.remove(self)
        self._parent = value
        if value is not None and self not in value.children:
            value.children.append(self)

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
        # intersect(Axis) on a 1-D shape is the POINT intersection upstream
        # returns as a ShapeList of Vertex (Mixin1D._intersect), not a boolean
        if len(others) == 1 and isinstance(others[0], Axis) and \
                isinstance(self, Curve):
            return ShapeList([Vertex(tuple(p)) for p in
                              self.find_intersection_points(others[0])])
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

    # --- minimal distance (BRepExtrema_DistShapeShape, like build123d) ---
    def distance_to_with_closest_points(self, other):
        """(distance, point on self, point on other) for the MINIMAL distance
        between two shapes (build123d
        Shape.distance_to_with_closest_points). other may be a point."""
        if self.topo is None:
            raise ValueError('Cannot calculate distance to or from an empty '
                             'shape')
        if isinstance(other, (Shape, Builder)):
            target = _topo(other)
        else:
            target = w.PointVertex(list(_v3(other)))
        res = w._distShapeShape(self.topo, target)
        if not res:
            raise RuntimeError('the distance between these shapes could not '
                               'be computed')
        r = list(res)
        return (r[0], Vector(tuple(r[1])), Vector(tuple(r[2])))

    def distance_to(self, other):
        """Minimal distance to another shape or point (build123d
        Shape.distance_to)."""
        return self.distance_to_with_closest_points(other)[0]

    def distance(self, other):
        """Minimal distance between two shapes (build123d Shape.distance)."""
        if not isinstance(other, (Shape, Builder)):
            raise ValueError('Cannot calculate distance to or from an empty '
                             'shape')
        return self.distance_to_with_closest_points(other)[0]

    def closest_points(self, other):
        """The two points where the distance between the shapes is minimal
        (build123d Shape.closest_points)."""
        return self.distance_to_with_closest_points(other)[1:3]

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

    def show_topology(self, limit_class='Vertex', show_center=None):
        """Tree rendering of the internal structure (build123d
        Shape.show_topology). This is a DIAGNOSTIC string - no geometry rides
        on it - so it reproduces upstream's shape (labels, box-drawing prefix,
        centre or Location per node) without promising byte parity of the
        pointer values upstream prints."""
        order = ['Compound', 'Solid', 'Shell', 'Face', 'Wire', 'Edge',
                 'Vertex']
        getters = {'Solid': 'solids', 'Shell': 'shells', 'Face': 'faces',
                   'Wire': 'wires', 'Edge': 'edges', 'Vertex': 'vertices'}
        if limit_class in order:
            limit = order.index(limit_class)
        else:
            limit = len(order) - 1
        lines = []

        def describe(shape, label):
            name = type(shape).__name__
            use_center = show_center
            if use_center is None:
                use_center = not shape.children
            where = None
            if use_center:
                try:
                    c = shape.center()
                    where = 'Center(' + str(c.X) + ', ' + str(c.Y) + ', ' + \
                        str(c.Z) + ')'
                except Exception:
                    where = None
            if where is None:
                where = 'Location(' + str(shape.location) + ')'
            prefix = ''
            if label:
                prefix = label + ' '
            return prefix + name + ' at ' + where

        def children_of(shape):
            kids = [k for k in shape.children if isinstance(k, Shape)]
            if kids:
                return kids
            name = type(shape).__name__
            if name in order:
                start = order.index(name) + 1
            else:
                start = 1
            for level in order[start:limit + 1]:
                getter = getters.get(level)
                if getter is None:
                    continue
                try:
                    kids = list(getattr(shape, getter)())
                except Exception:
                    kids = []
                if kids:
                    return kids
            return []

        def walk(shape, label, prefix, is_last, is_root, depth=0):
            if depth > 8 or len(lines) > 5000:
                return                     # guard: diagnostics, not geometry
            if is_root:
                root_label = ''
                if label:
                    root_label = label + ' is the root'
                lines.append(describe(shape, root_label))
                child_prefix = ''
            else:
                branch = '\u251c\u2500\u2500 '
                if is_last:
                    branch = '\u2514\u2500\u2500 '
                lines.append(prefix + branch + describe(shape, label))
                if is_last:
                    child_prefix = prefix + '    '
                else:
                    child_prefix = prefix + '\u2502   '
            kids = children_of(shape)
            for i, kid in enumerate(kids):
                if kid is shape:
                    continue
                walk(kid, getattr(kid, 'label', ''), child_prefix,
                     i == len(kids) - 1, False, depth + 1)

        walk(self, self.label, '', True, True)
        return '\\n'.join(lines)

    def do_children_intersect(self, include_parent=False, tolerance=1e-5):
        """Do any of this assembly's children overlap (build123d
        Compound.do_children_intersect)? Same algorithm: a pre-order walk of
        the tree, a bounding-box pre-filter, then a real Intersection whose
        solid volume must exceed the tolerance."""
        nodes = []

        def preorder(shape, depth=0):
            if depth > 8:
                return
            nodes.append(shape)
            for kid in shape.children:
                if isinstance(kid, Shape) and kid is not shape:
                    preorder(kid, depth + 1)

        preorder(self)
        if not include_parent:
            nodes.pop(0)
        boxes = [n.bounding_box() for n in nodes]
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                a, b = boxes[i], boxes[j]
                if (a.max.X < b.min.X or b.max.X < a.min.X or
                        a.max.Y < b.min.Y or b.max.Y < a.min.Y or
                        a.max.Z < b.min.Z or b.max.Z < a.min.Z):
                    continue
                try:
                    common = nodes[i].intersect(nodes[j])
                except Exception:
                    common = None
                if common is None or common.topo is None:
                    continue
                volume = sum([s.volume for s in common.solids()])
                if volume > tolerance:
                    return (True, (nodes[i], nodes[j]), volume)
        return (False, (None, None), 0.0)

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
    # A single-segment Curve (what the 1-D object constructors return) answers
    # the circular-arc queries of its one edge, like build123d's Mixin1D.
    @property
    def arc_center(self):
        return _single_edge_of(self).arc_center

    @property
    def radius(self):
        # the 1-D constructors (JernArc) record their defining radius; other
        # curves read it off their single circular edge
        if getattr(self, '_radius_attr', None) is not None:
            return self._radius_attr
        return _single_edge_of(self).radius

    @radius.setter
    def radius(self, value):
        self._radius_attr = value

    def find_intersection_points(self, other, tolerance=1e-6):
        return _single_edge_of(self).find_intersection_points(other, tolerance)

    def normal(self):
        """Normal of a PLANAR curve (build123d Mixin1D.normal): the conic's own
        axis direction for a circle/ellipse, otherwise the normal of the plane
        the curve lies in.

        The general branch substitutes for BRepLib_FindSurface: its Surface()
        comes back as an unbound handle in this build, so the plane is fitted
        from sampled points instead (exact for a genuinely planar curve, and
        the deviation of the samples from the fit is what decides whether the
        curve IS planar — upstream raises the same ValueError when it is not)."""
        edges = self.edges() if not isinstance(self, Edge) else [self]
        if not edges:
            raise ValueError("Can't find normal of empty edge/wire")
        axis_dir = w._edgeArcNormal(_topo(edges[0]))
        if axis_dir and len(edges) == 1:
            return Vector(tuple(axis_dir)).normalized()
        pts = []
        for e in edges:
            for i in range(5):
                pts.append(Vector(tuple(w._edgePointAt(_topo(e), i / 4.0))))
        centroid = Vector(0, 0, 0)
        for p in pts:
            centroid = centroid + p
        centroid = centroid * (1.0 / len(pts))
        normal, best = None, 0.0
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                cross = (pts[i] - centroid).cross(pts[j] - centroid)
                if cross.length > best:
                    normal, best = cross, cross.length
        if normal is None or best <= _TOL_1E6:
            raise ValueError('Normal not defined')
        normal = normal.normalized()
        span = max([(p - centroid).length for p in pts])
        for p in pts:
            if abs((p - centroid).dot(normal)) > _TOL_1E6 * max(1.0, span):
                raise ValueError('Normal not defined')
        return normal

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

    def _chain_flips(self, es, ends):
        """Which of the chained edges have to be traversed BACKWARDS to run
        head-to-tail (see _walk for why the first edge is special-cased)."""
        flips = [False] * len(es)
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
        return flips

    def param_at_point(self, point):
        """Normalized position (0..1) of point along this wire: the arc
        length from the wire's start to the point, over the wire's total length
        (build123d Wire.param_at_point, which walks the wire in
        BRepTools_WireExplorer order accumulating edge lengths)."""
        es = self._edge_chain()
        pt = list(_v3(point))
        if len(es) == 1:
            return Edge(es[0]).param_at_point(pt)
        lens = [w._edgeLength(e) for e in es]
        ends = [(tuple(w._edgePointAt(e, 0.0)), tuple(w._edgePointAt(e, 1.0)))
                for e in es]
        flips = self._chain_flips(es, ends)
        total = sum(lens)
        best, best_dist = None, None
        acc = 0.0
        for i, e in enumerate(es):
            d = w._edgeDistanceToPoint(e, pt)
            if best_dist is None or d < best_dist:
                u = w._edgeParamAtPoint(e, pt)
                if u < 0.0:   # not ON this edge — snap to the nearer end
                    u = 0.0 if math.dist(tuple(w._edgePointAt(e, 0.0)),
                                         tuple(pt)) < \
                        math.dist(tuple(w._edgePointAt(e, 1.0)), tuple(pt)) \
                        else 1.0
                if flips[i]:
                    u = 1.0 - u
                best, best_dist = (acc + u * lens[i]), d
            acc += lens[i]
        if best_dist is None or best_dist > _TOL_1E6:
            raise ValueError('point ' + repr(tuple(pt)) + ' is ' +
                             repr(best_dist) + ' from this wire')
        return best / total if total > 0 else 0.0

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
        # but individual edges may run tip-to-tail reversed). In a real WIRE
        # the edges above are in CONNECTION order, so the only ambiguity left
        # is the first edge's raw parametrization direction — flip it when its
        # start (not its end) is what touches the second edge. (For a COMPOUND
        # of edges the order itself is arbitrary, and the greedy chaining
        # starting from edge 0 as-is is what matches build123d's
        # BRepAdaptor_CompCurve there.)
        flips = self._chain_flips(es, ends)
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

    def _to_param(self, value):
        """A float position stays as it is; a point becomes its normalized
        position along this shape (build123d Mixin1D._to_param)."""
        if isinstance(value, (int, float)):
            return float(value)
        return self.param_at_point(value)

    def derivative_at(self, position, order=2):
        """The order-th derivative of the underlying curve at the normalized
        position (build123d Mixin1D.derivative_at). NOT normalized: the
        magnitude is the curve's natural speed, which is what BlendCurve's
        tangent_scalars scale. Odd orders follow the shape's orientation."""
        u = self._to_param(position)
        es = self._edge_chain()
        if len(es) == 1:
            # like position_at, a REVERSED edge is traversed the other way
            # (upstream's _occt_param_at maps u -> 1 - u before evaluating)
            forward = bool(w._edgeIsForward(es[0]))
            edge, local_u, flipped = es[0], (u if forward else 1.0 - u), False
        else:
            lens = [w._edgeLength(e) for e in es]
            ends = [(tuple(w._edgePointAt(e, 0.0)),
                     tuple(w._edgePointAt(e, 1.0))) for e in es]
            flips = self._chain_flips(es, ends)
            total = sum(lens)
            target = max(0.0, min(1.0, u)) * total
            acc = 0.0
            edge, local_u, flipped = es[-1], 1.0, flips[-1]
            for i, e in enumerate(es):
                if target <= acc + lens[i] + 1e-12 or i == len(es) - 1:
                    local_u = (target - acc) / lens[i] if lens[i] > 0 else 0.0
                    if flips[i]:
                        local_u = 1.0 - local_u
                    edge, flipped = e, flips[i]
                    break
                acc += lens[i]
        d = Vector(tuple(w._edgeDerivativeAt(edge, float(local_u), int(order))))
        reverse = flipped if len(es) > 1 else not bool(w._edgeIsForward(es[0]))
        if order % 2 == 1 and reverse:
            d = -d
        return d

    def trim(self, start, end):
        """A new Edge keeping only the section between two normalized
        positions, which may be given as POINTS on the curve (build123d
        Edge.trim)."""
        return _single_edge_of(self).trim(start, end)

    def curvature_comb(self, count=100, max_tooth_size=None):
        """The curvature comb of a planar (XY) curve: short line Edges erected
        along the left normal, their length proportional to the signed
        curvature (build123d Mixin1D.curvature_comb, ported statement for
        statement)."""
        closed = bool(self.is_closed) if hasattr(self, 'is_closed') else False
        # numpy's linspace(0, 1, count, endpoint=not closed)
        if closed:
            u_values = [i / count for i in range(count)]
        else:
            u_values = [i / (count - 1) for i in range(count)] if count > 1 \
                else [0.0]
        kappas, tangents = [], []
        for u in u_values:
            tangent = self.derivative_at(u, 1)
            curvature = self.derivative_at(u, 2)
            tangents.append(tangent)
            cross = tangent.cross(curvature)
            kappa = cross.length / (tangent.length ** 3 + _TOL_1E6)
            kappas.append(kappa if cross.Z >= 0 else -kappa)
        max_kappa_size = max([_TOL_1E6] + [abs(k) for k in kappas])
        curve_size = max(tuple(self.bounding_box().size))
        tooth = max_tooth_size if max_tooth_size is not None else curve_size / 10
        scale_factor = tooth / max_kappa_size
        out = ShapeList()
        for i in range(len(u_values)):
            length = scale_factor * kappas[i]
            if abs(length) < _TOL_1E6:
                continue
            pnt = self._walk(u_values[i], False)
            kappa_dir = tangents[i].normalized().cross(Vector(0, 0, 1))
            out.append(Edge.make_line(pnt, pnt + kappa_dir * length))
        return out

    def reversed(self):
        """A copy of this Edge/Wire with the opposite orientation
        (build123d Edge.reversed - the OCCT orientation flag, not a rebuild)."""
        return _reverse_1d(self)

    def canonical(self):
        """This shape with a CANONICAL parametrization: the same geometry, but
        with a start point and a traversal direction determined by the geometry
        alone instead of by the CAD kernel's construction history
        (build123d Mixin1D.canonical - see the canonical_form() rule above).

        Free edges - the ones produced by cut/intersect/section/project_to_shape
        rather than drawn by the user - inherit the seam, direction and
        parameter range the kernel found convenient, so two geometrically
        identical solids can yield section edges that start in different places
        and run in opposite directions. Anything measured from position_at(0),
        tangent_at or Axis(edge) then moves with them.

        Open shapes keep their type; a closed shape that has to be re-seamed
        comes back as a single Edge, because a closed Wire has no distinguished
        start point for position_at to key off."""
        form = self.canonical_form()

        if not form.closed:
            return self if form.sign > 0 else _reverse_1d(self)

        # The seam is a position on a loop, so "is it already at the start?" is a
        # question about the CIRCULAR distance: a band midpoint that lands an
        # epsilon BELOW 1.0 is the same point as one an epsilon above 0.0. The
        # comparison is made at the resolution the seam is actually defined to -
        # the width of the extremal band - because asking for more precision than
        # that would re-seam a shape by a few nanometres, over and over.
        box = self.bounding_box()
        diagonal = max(box.size.X, box.size.Y, box.size.Z)
        relative_tolerance = (max(_TOL_1E6, CANONICAL_BAND * diagonal) /
                              max(self.length, _TOL_1E6))
        wrapped_start = form.start % 1.0
        if min(wrapped_start, 1.0 - wrapped_start) <= relative_tolerance:
            # Already seamed here: at most the direction needs flipping, which
            # keeps the original topology and curve types.
            return self if form.sign > 0 else _reverse_1d(self)

        seam = self.position_at(form.start)
        direction = self.tangent_at(form.start) * form.sign
        ordered = _walk_loop(_split_1d_at_point(self, seam), seam, direction)
        return _concatenate_edges(ordered)

    def canonical_form(self, samples=CANONICAL_SAMPLES):
        """The canonical start position (normalized) and direction sign of this
        shape, without rebuilding it (build123d Mixin1D.canonical_form)."""
        length = self.length
        if length <= _TOL_1E6:
            return CanonicalForm(0.0, 1, False)
        closed = (self.position_at(0) - self.position_at(1)).length <= _TOL_1E6

        def sampler(distance):
            return self.position_at(min(max(distance / length, 0.0), 1.0))

        return _canonical_form(sampler, length, closed, samples=samples)

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
def _wire_combine(cls, wires, tol=1e-9):
    """Group edges/wires into the largest possible wires (build123d
    Wire.combine): the same connectivity grouping edges_to_wires does, which is
    what ShapeAnalysis_FreeBounds::ConnectEdgesToWires computes upstream."""
    edges = []
    for item in _tolist(wires):
        edges.extend(item.edges() if not isinstance(item, Edge) else [item])
    return edges_to_wires(edges, max(tol, 1e-9))


Curve.combine = classmethod(_wire_combine)

Wire = Curve


class Compound(Shape):
    @classmethod
    def make_triad(cls, axes_scale):
        """The coordinate-system triad symbol (build123d Compound.make_triad):
        three axis lines with spline arrow heads.

        COMPROMISE(triad-labels): upstream also draws 'X'/'Y'/'Z' with the
        'singleline' STROKE font, which this build does not ship (only the
        outline font FreeSans), so the labels are omitted. The triad is a
        viewer symbol, never part of a modelled part."""
        s = float(axes_scale)
        parts = [Edge.make_line((0, 0, 0), (s, 0, 0)),
                 Edge.make_line((0, 0, 0), (0, s, 0)),
                 Edge.make_line((0, 0, 0), (0, 0, s))]
        arrow_arc = Edge.make_spline([(0, 0, 0), (-s / 20, s / 30, 0)],
                                     [(-1, 0, 0), (-1, 1.5, 0)])
        arrow = Curve([arrow_arc, arrow_arc.mirror(Plane.XZ)])
        parts.append(Pos(s, 0, 0) * arrow)
        parts.append(Pos(0, s, 0) * (arrow.rotate(Axis.Z, 90)))
        parts.append(Pos(0, 0, s) * (arrow.rotate(Axis.Y, -90)))
        return Curve(parts)

    def __init__(self, children=None, label='', **kwargs):
        # Compound(shape.wrapped) / Compound(topods): a single raw TopoDS shape
        # (build123d's Shape(obj) form, used by Compound subclasses that call
        # super().__init__(builder.part.wrapped, ...) - tutorial_joints' Hinge)
        if children is not None and not isinstance(children, Shape) and \
                hasattr(children, 'ShapeType'):
            children = [children]
        topos = [_topo(c) for c in _tolist(children) if not (isinstance(c, Shape) and c.topo is None)]
        topo = None
        if len(topos) == 1:
            topo = topos[0]
        elif len(topos) > 1:
            topo = w.MakeCompound(topos)
        Shape.__init__(self, topo)
        self.label = label
        self.children = _tolist(children)
        # Compound(..., joints=<dict>) — build123d's Compound.__init__ adopts a
        # joint dict and REPARENTS every joint onto the new compound. This is
        # how a Compound subclass built from a builder keeps the joints the
        # builder collected (tutorial_joints' Hinge).
        joints = kwargs.get('joints')
        if joints:
            self.joints = {k: j._lite_rebind(self) for k, j in joints.items()}

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


def _single_edge_of(curve):
    """The one edge of a single-segment Curve (build123d's 1-D objects return
    Curves whose circular-arc properties read through to that edge)."""
    es = curve.edges()
    if len(es) != 1:
        raise ValueError('this property is only defined for a single edge, '
                         'this curve has ' + str(len(es)))
    return es[0]


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

    def find_intersection_points(self, other, tolerance=1e-6):
        """Points where this 2-D edge crosses an Axis or another Edge
        (build123d Edge.find_intersection_points - the 1-D form, distinct from
        Shape's ray/surface intersection).

        Upstream lifts both curves onto their common plane and calls
        Geom2dAPI_InterCurveCurve; that needs BRep_Tool::CurveOnPlane, which is
        unbound here, so the crossing is solved on the signed distance to the
        other curve's line: sample the arc-length parametrization, then bisect
        every sign change. Exact to tolerance for the analytic line/arc cases
        the constructors use."""
        if hasattr(other, 'position') and hasattr(other, 'direction'):
            base = Vector(other.position)
            d = Vector(other.direction).normalized()
        else:
            o = other.edges()[0] if not isinstance(other, Edge) else other
            base = o.position_at(0)
            d = (o.position_at(1) - base).normalized()
        # signed perpendicular offset of the sampled point from the line,
        # in the plane spanned by d and the sampling normal
        def offset(u):
            q = Vector(tuple(w._edgePointAt(self.topo, float(u))))
            r = q - base
            along = r.dot(d)
            perp = r - d * along
            # sign from the 2-D cross product about z (planar edges)
            sign = 1.0 if (d.X * r.Y - d.Y * r.X) >= 0 else -1.0
            return sign * perp.length

        n = 512
        roots = []
        prev_u, prev = 0.0, offset(0.0)
        if abs(prev) < tolerance:
            roots.append(0.0)
        for i in range(1, n + 1):
            u = i / n
            cur = offset(u)
            if abs(cur) <= tolerance:
                # contact WITHOUT a sign change: an end point sitting on the
                # line, or a tangency. Upstream's Geom2dAPI_InterCurveCurve is
                # tolerance-based and reports these, so the sampled search has
                # to as well (the wing example's trailing edge ends exactly on
                # the axis it is measured against).
                if not any(abs(u - r) < 1e-9 for r in roots):
                    roots.append(u)
            if (prev <= 0.0 <= cur) or (cur <= 0.0 <= prev):
                lo, hi, flo = prev_u, u, prev
                for _ in range(60):
                    mid = (lo + hi) / 2.0
                    fm = offset(mid)
                    if (flo <= 0.0) == (fm <= 0.0):
                        lo, flo = mid, fm
                    else:
                        hi = mid
                root = (lo + hi) / 2.0
                if not any(abs(root - r) < 1e-9 for r in roots):
                    roots.append(root)
            prev_u, prev = u, cur
        out = ShapeList()
        for r in roots:
            p = Vector(tuple(w._edgePointAt(self.topo, float(r))))
            # reject near-misses: the point must really lie on the line
            rel = p - base
            if (rel - d * rel.dot(d)).length <= max(tolerance, 1e-6) * 100:
                out.append(p)
        return out

    @property
    def radius(self):
        """Radius of a circular edge (build123d Edge.radius)."""
        r = w._edgeArcRadius(self.topo)
        if r is None:
            raise ValueError('radius is only defined for circles')
        return r

    @property
    def is_interior(self):
        """True when this edge lies between two faces of the SAME body rather
        than on its outer boundary (build123d Edge.is_interior): offset both
        adjoining faces outward by length/100 and see whether they still
        intersect in an edge."""
        return bool(w.EdgeIsInterior(self.topo, _topo(self.parent)
                                    if self.parent is not None else None))

    def find_tangent(self, angle):
        """The normalized parameters at which this edge's tangent is at 'angle'
        degrees to the local x axis (build123d Edge.find_tangent)."""
        tangent = math.tan(math.radians(angle))
        out = []
        # upstream solves the 2-D tangent condition on the curve; lite scans
        # the arc-length parametrization and bisects each sign change
        def f(u):
            t = w._edgeTangentAt(self.topo, float(u))
            if abs(t[0]) < 1e-12:
                return None
            return t[1] / t[0] - tangent
        n = 512
        prev_u, prev = 0.0, f(0.0)
        for i in range(1, n + 1):
            u = i / n
            cur = f(u)
            if prev is not None and cur is not None and \
                    ((prev <= 0.0 <= cur) or (cur <= 0.0 <= prev)):
                lo, hi, flo = prev_u, u, prev
                for _ in range(60):
                    mid = (lo + hi) / 2.0
                    fm = f(mid)
                    if fm is None:
                        break
                    if (flo <= 0.0) == (fm <= 0.0):
                        lo, flo = mid, fm
                    else:
                        hi = mid
                root = (lo + hi) / 2.0
                if not any(abs(root - r) < 1e-6 for r in out):
                    out.append(root)
            prev_u, prev = u, cur
        return out

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

    def param_at_point(self, point):
        """Normalized parameter (0..1) of the point on this edge closest to
        point (build123d Edge.param_at_point: vertex snap, then
        GeomAPI_ProjectPointOnCurve validated by re-evaluation, then a bounded
        numeric search — all three inside _edgeParamAtPoint)."""
        u = w._edgeParamAtPoint(self.topo, list(_v3(point)))
        if u < 0.0:
            raise ValueError('point ' + repr(tuple(_v3(point))) +
                             ' is not on this edge')
        return u

    def trim(self, start, end):
        """A new edge keeping only the section between two normalized
        arc-length positions, each of which may be given as a POINT on the
        edge instead (build123d Edge.trim)."""
        start_u = self._to_param(start)
        end_u = self._to_param(end)
        trimmed = Edge(w.TrimEdge(self.topo, float(min(start_u, end_u)),
                                  float(max(start_u, end_u))))
        # keep the requested direction (upstream rebuilds it reversed)
        start_point = self.position_at(start_u)
        same_start = (trimmed.position_at(0) - start_point).length < _TOL_1E6
        same_direction = self.tangent_at(start_u).dot(
            trimmed.tangent_at(0)) > 1 - _TOL_1E6
        if same_start and same_direction:
            return trimmed
        return _reverse_1d(trimmed)

    def trim_to_other(self, other):
        """The SHORTEST piece of this edge trimmed at its intersections with
        other, or None when they do not intersect (build123d
        Edge.trim_to_other)."""
        points = self.find_intersection_points(other)
        if not points:
            return None
        trims = ShapeList([self.trim(0.0, p) for p in points])
        return trims.sort_by(Edge.length)[0]

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
    def make_circle(cls, radius, plane=None, start_angle=360.0,
                    end_angle=360.0, angular_direction=None):
        """Full circle or circular arc edge (build123d Edge.make_circle).
        A full circle is the default (start_angle == end_angle)."""
        if plane is None:
            plane = Plane.XY
        topo = w.CircularEdge(float(radius), float(start_angle),
                              float(end_angle),
                              list(plane.origin), list(plane.z_dir),
                              list(plane.x_dir))
        return cls(topo)

    @classmethod
    def make_three_point_arc(cls, p1, p2, p3):
        """Circular arc through three points (build123d
        Edge.make_three_point_arc / GC_MakeArcOfCircle)."""
        wire = w.WireFromSegments([('arc3', [list(_v3(p1)), list(_v3(p2)),
                                             list(_v3(p3))])])
        return Curve(wire).edges()[0]

    def split(self, plane, keep=None):
        """The part of this edge on the +z_dir side of a plane (build123d
        Mixin1D.split, Keep.TOP default). Returns None when nothing is left."""
        pieces = []
        u = _edge_plane_crossing(self, plane)
        if u is None:
            side = plane.to_local_coords(self.position_at(0.5)).Z
            return self if side >= -_TOL_1E6 else None
        for a, b in ((0.0, u), (u, 1.0)):
            if b - a <= _TOL_1E6:
                continue
            piece = self.trim(a, b)
            mid = plane.to_local_coords(piece.position_at(0.5)).Z
            if mid >= -_TOL_1E6:
                pieces.append(piece)
        if not pieces:
            return None
        return pieces[0] if len(pieces) == 1 else pieces

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
        (build123d Edge.make_mid_way, flip-aware).

        The direction and start point of the two reference edges are incidental
        - a section edge starts wherever the kernel's intersector happened to
        seam it - so the ends are paired up CANONICALLY instead of from the
        construction history (the is_opposite() flip below is kept for
        reference edges that are not parallel)."""
        first, second = first.canonical(), second.canonical()
        flip = Axis(first, canonical=True).is_opposite(
            Axis(second, canonical=True))
        pnts = []
        for i in (0.0, 1.0):
            a = first.position_at(i)
            b = second.position_at(1.0 - i if flip else i)
            pnts.append(a + (b - a) * middle)
        return cls.make_line(pnts[0], pnts[1])


# --------------------------------- canonical 1D shape rebuilding helpers ---
# build123d's one_d.py module-level helpers behind Mixin1D.canonical().

def _reverse_1d(shape):
    """A copy of an Edge or Wire that is traversed in the opposite direction.

    An Edge only needs its orientation flag flipped, which Edge.position_at
    honours. A Wire needs more: lite's Curve._walk follows
    BRepTools_WireExplorer's edge order and ignores the wire's own orientation
    flag (upstream's Wire.position_at goes through _occt_param_at and does
    honour it), so flipping the flag alone would silently leave position_at
    unchanged - which is exactly the kind of noise-level failure the canonical
    rule exists to remove. Rebuilding the wire from its edges in REVERSE order,
    each individually reversed, is the same geometry with a genuinely reversed
    traversal. A single-edge wire cannot express it at all, so it comes back as
    an Edge (which can)."""
    if isinstance(shape, Edge):
        return Edge(w.ReverseEdgeOrWire(_topo(shape)))
    edges = list(shape.order_edges())
    if len(edges) == 1:
        return Edge(w.ReverseEdgeOrWire(edges[0].topo))
    return Curve(w.WireFromEdgesFixed(
        [w.ReverseEdgeOrWire(e.topo) for e in edges[::-1]], _TOL_1E6))


def _edge_plane_crossing(edge, plane, samples=64):
    """The normalized parameter at which an edge crosses a plane (the sign of
    the LOCAL z flips), refined by bisection; None when it never crosses."""
    def height(u):
        return plane.to_local_coords(edge.position_at(u)).Z
    prev_u, prev_h = 0.0, height(0.0)
    for i in range(1, samples + 1):
        u = i / samples
        h = height(u)
        if (prev_h < 0.0) != (h < 0.0):
            lo, hi = prev_u, u
            for _ in range(60):
                mid = (lo + hi) / 2.0
                if (height(lo) < 0.0) != (height(mid) < 0.0):
                    hi = mid
                else:
                    lo = mid
            return (lo + hi) / 2.0
        prev_u, prev_h = u, h
    return None


def _split_1d_at_point(shape, point):
    """The Edges of shape, with the one that contains point split there."""
    pieces = []
    pt = list(point)
    for edge in shape.edges():
        ends_at_point = min((edge.position_at(0) - point).length,
                            (edge.position_at(1) - point).length)
        if ends_at_point > _TOL_1E6 and \
                w._edgeDistanceToPoint(edge.topo, pt) <= _TOL_1E6:
            parameter = w._edgeParamAtPoint(edge.topo, pt)
            if parameter >= 0.0 and \
                    _TOL_1E6 < parameter * edge.length < edge.length - _TOL_1E6:
                pieces.append(edge.trim(0.0, parameter))
                pieces.append(edge.trim(parameter, 1.0))
                continue
        pieces.append(edge)
    return pieces


def _walk_loop(pieces, start, direction):
    """Order and orient pieces into a chain that leaves start heading along
    direction, purely by matching end points."""
    remaining = list(pieces)
    # the requested start comes from a sampled parameter, so allow a gap that
    # scales with the size of the loop
    gap_tolerance = max(_TOL_1E6, 1e-6 * sum(piece.length for piece in pieces))
    ordered = []
    position, heading = start, direction
    while len(remaining) > 0:
        best, best_score, flip = None, None, False
        for candidate in remaining:
            for reverse in (False, True):
                # scoring a reversed candidate without building it: its
                # position_at(0) is the candidate's position_at(1) and its
                # tangent_at(0) is the negated tangent_at(1)
                if reverse:
                    gap = (candidate.position_at(1) - position).length
                    heading_score = candidate.tangent_at(1).dot(heading)
                else:
                    gap = (candidate.position_at(0) - position).length
                    heading_score = -candidate.tangent_at(0).dot(heading)
                # Rank on whether the gap is closed at all, then on the tangent,
                # and only then on the gap itself. Comparing raw gaps first would
                # let 1e-16 noise decide between two pieces that meet at the same
                # vertex - and at the seam of a loop those two pieces head in
                # opposite directions, so the loop could be walked backwards.
                score = (gap > gap_tolerance, heading_score, gap)
                if best_score is None or score < best_score:
                    best, best_score, flip = candidate, score, reverse
        if best is None or best_score[0]:
            return pieces  # not a connected chain - keep the input order
        edge = _reverse_1d(best) if flip else best
        ordered.append(edge)
        remaining = [p for p in remaining if p is not best]
        position, heading = edge.position_at(1), edge.tangent_at(1)
    return ordered


def _concatenate_edges(edges):
    """A single Edge whose curve is the concatenation of edges, in order.

    Used to give a re-seamed closed loop an unambiguous start point: a closed
    TopoDS_Wire carries no distinguished first edge, while an Edge's curve
    parametrization does."""
    return Edge(w.ConcatEdgesToEdge([_topo(e) for e in edges]))


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

    def position_at(self, u, v):
        """Point on the face at NORMALIZED (u, v) surface parameters
        (build123d Face.position_at)."""
        u_val, v_val = self._surface_params(None, u, v)
        return Vector(tuple(w._faceD1(self.topo, u_val, v_val)[0]))

    @property
    def center_location(self):
        """Location at the centre of the face (build123d
        Face.center_location): the (0.5, 0.5) surface point with the surface
        normal as z."""
        origin = self.position_at(0.5, 0.5)
        return Plane(origin=origin, z_dir=self.normal_at(origin)).location

    @property
    def _curvature_sign(self):
        """Signed reference distance between the face's centre and its
        underlying geometry's reference point — positive convex, negative
        concave, 0.0 for surfaces that are not a cylinder/sphere/torus
        (build123d Face._curvature_sign; StandardLibrary._faceCurvatureSign
        reads the surface's own gp_Cylinder/gp_Sphere/gp_Torus reference, which
        the fork binds as of the Geom2dGcc round)."""
        return w._faceCurvatureSign(self.topo)

    @property
    def is_circular_convex(self):
        """Is this cylinder/sphere/torus face convex relative to its own
        geometry (build123d Face.is_circular_convex)."""
        return self._curvature_sign > _TOL_1E6

    @property
    def is_circular_concave(self):
        """Is this cylinder/sphere/torus face concave relative to its own
        geometry (build123d Face.is_circular_concave)."""
        return self._curvature_sign < -_TOL_1E6

    def offset(self, amount):
        """The face's plane offset by amount (build123d Face.offset)."""
        return Plane(self).offset(amount)

    @property
    def radius(self):
        """Radius of a cylindrical or spherical face, else None (build123d
        Face.radius, read off the surface's own gp_Cylinder/gp_Sphere)."""
        return w._faceRadius(self.topo)

    @property
    def axis_of_rotation(self):
        """Rotational axis of a cone/cylinder/sphere/torus/revolution face,
        else None (build123d Face.axis_of_rotation)."""
        ax = w._faceAxisOfRotation(self.topo)
        if ax is None:
            return None
        origin, direction = list(ax[0]), list(ax[1])
        return Axis(tuple(origin), tuple(direction))

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

    @classmethod
    def extrude(cls, obj, direction):
        """A wire/edge swept along a direction into an open SHELL
        (build123d Shell.extrude)."""
        d = _v3(direction)
        topo = w.Extrude(_topo(obj), [d[0], d[1], d[2]])
        shell = cls.__new__(cls)
        Shape.__init__(shell, topo)
        shell._face_shapes = None
        return shell

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


_TOL_DIGITS = 6      # abs(log10(build123d's TOLERANCE))


def _canonical_sort_key(shape):
    """Deterministic, purely geometric ordering key (build123d's
    _canonical_sort_key): the shape's VERTEX positions, sorted and rounded to
    TOL_DIGITS - no bounding box, no curve evaluation, so it is cheap enough to
    compute inside a sort. Used to break ties in
    ShapeList.sort_by(tie_break=True), where the only alternative is the order
    the objects arrived in (the CAD kernel's traversal order).

    Vector members are handled explicitly rather than by catching
    AttributeError, so an API change surfaces as a failure instead of as a
    silently disabled tie break."""
    if isinstance(shape, Vector):  # ShapeList also holds plain Vectors
        return tuple(round(c, _TOL_DIGITS) for c in (shape.X, shape.Y, shape.Z))
    if shape.topo is None:
        return ()
    points = sorted([(round(v.X, _TOL_DIGITS), round(v.Y, _TOL_DIGITS),
                      round(v.Z, _TOL_DIGITS)) for v in shape.vertices()])
    return tuple(c for point in points for c in point)


def _canonical_center_key(shape):
    """Second stage tie break, for shapes whose vertices coincide (two arcs
    spanning the same end points, say). Only reached when the vertex key above
    leaves a tie (build123d's _canonical_center_key)."""
    if isinstance(shape, Vector):
        return ()
    try:
        center = shape.center()
    except Exception:
        return ()
    return tuple(round(c, _TOL_DIGITS)
                 for c in (center.X, center.Y, center.Z))


def _sort_key_fn(key):
    if isinstance(key, Axis):
        return lambda s: _axis_value(s, key)
    if isinstance(key, Curve) and getattr(key, 'topo', None) is not None:
        # sort_by(<edge or wire>): the parameter, along that 1-D shape, of the
        # point closest to each object's centre (build123d's
        # u_of_closest_center -> closest_points + param_at_point)
        def along(s):
            pnt = key.closest_points(s.center())[0]
            return key.param_at_point(pnt)
        return along
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
    if isinstance(key, property):
        # sort_by(Face.area) / group_by(Edge.length): a class PROPERTY object
        # is called on each shape (build123d's documented selector form)
        return lambda s: key.fget(s)
    raise TypeError('unsupported sort/group key: ' + repr(key))


def topo_distance_to(other):
    """A sort_by/group_by key function giving the TOPOLOGICAL distance to the
    reference shape(s) (build123d's topo_distance_to): 0 for the references
    themselves, 1 for their direct neighbours, and so on, measured over the
    full topology of their shared parent. Adjacency is sharing a lower-order
    sub-shape, exactly as upstream defines it — Faces via an Edge, Edges/Wires
    via a Vertex, Shells/Solids via a Face — with the sub-shapes identified
    geometrically (lite re-wraps every shape, so there is no TopoDS identity to
    hash)."""
    sources = [other] if isinstance(other, Shape) else list(other)
    if not sources:
        raise ValueError('Cannot measure topological distance to an empty '
                         'object')
    kind_lut = [(Vertex, 'vertex'), (Face, 'face'), (Edge, 'edge'),
                (Shell, 'shell'), (Part, 'solid'), (Curve, 'wire')]
    peer_kind = None
    for cls, name in kind_lut:
        if isinstance(sources[0], cls):
            peer_kind = name
            break
    if peer_kind is None:
        raise ValueError('Topological distance is not supported for ' +
                         type(sources[0]).__name__)
    for s in sources:
        if not isinstance(s, type(sources[0])):
            raise ValueError('Topological distance requires shapes of the '
                             'same type')
    parent = getattr(sources[0], 'parent', None)
    if parent is None or parent.topo is None:
        raise ValueError('Topological distance requires shapes with a '
                         'topo_parent')
    connector = {'vertex': 'edge', 'edge': 'vertex', 'wire': 'vertex',
                 'face': 'edge', 'shell': 'face', 'solid': 'face'}[peer_kind]
    peers = {'vertex': parent.vertices, 'edge': parent.edges,
             'wire': parent.wires, 'face': parent.faces,
             'shell': parent.faces, 'solid': parent.solids}[peer_kind]()

    def sub_keys(shape):
        if connector == 'vertex':
            return [_shape_key(v, 'vertex') for v in shape.vertices()]
        if connector == 'edge':
            return [_shape_key(e, 'edge') for e in shape.edges()]
        return [_shape_key(f, 'face') for f in shape.faces()]
    peer_keys = [_shape_key(p, peer_kind) for p in peers]
    peer_subs = [sub_keys(p) for p in peers]
    # adjacency: peers that share at least one connector sub-shape
    by_sub = {}
    for i, subs in enumerate(peer_subs):
        for key in subs:
            by_sub.setdefault(key, []).append(i)
    neighbours = [set() for _ in peers]
    for key in by_sub:
        group = by_sub[key]
        for i in group:
            for j in group:
                if i != j:
                    neighbours[i].add(j)
    # breadth-first search out of the reference shapes
    distances = {}
    frontier = []
    for s in sources:
        key = _shape_key(s, peer_kind)
        if key in peer_keys:
            i = peer_keys.index(key)
            if i not in distances:
                distances[i] = 0
                frontier.append(i)
    step = 0
    while frontier:
        step += 1
        nxt = []
        for i in frontier:
            for j in neighbours[i]:
                if j not in distances:
                    distances[j] = step
                    nxt.append(j)
        frontier = nxt

    def key_f(shape):
        key = _shape_key(shape, peer_kind)
        if key not in peer_keys:
            return float('inf')
        return distances.get(peer_keys.index(key), float('inf'))
    return key_f


def _group_key_fn(key, tol_digits=6):
    """group_by's key function: the sort key ROUNDED to tol_digits, with
    non-numeric keys passed through unchanged (build123d's group_by wraps
    every branch in try: round(val) / except TypeError: val)."""
    fn = _sort_key_fn(key)

    def rounded(s):
        val = fn(s)
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            return val
        return round(val, tol_digits)
    return rounded


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
        elif hasattr(f, 'z_dir') and hasattr(f, 'origin'):
            # filter_by(Plane): shapes lying IN that plane (build123d's
            # Plane filter - contains() on every vertex)
            def pred(s):
                try:
                    for v in s.vertices():
                        d = (Vector(v.to_tuple()) - Vector(f.origin)).dot(
                            Vector(f.z_dir))
                        if abs(d) > tolerance:
                            return False
                    return True
                except Exception:
                    return False
        elif callable(f):
            pred = f
        elif isinstance(f, property):
            # filter_by(Face.is_planar): a class PROPERTY used as a predicate
            pred = lambda s: bool(f.fget(s))
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
        # build123d returns the survivors SORTED along the same axis
        return out.sort_by(axis)

    def sort_by(self, key=Axis.Z, reverse=False, tie_break=False):
        """Sort by the given criterion (build123d ShapeList.sort_by).

        tie_break=False (the default) keeps Python's stable sort exactly, so
        ties carry the incoming order - which is itself a useful contract for
        CHAINED sorts (sort_by(SortBy.RADIUS).sort_by(Axis.Z) keeps the radius
        order inside each equal-Z group). COMPROMISE(traversal-order): that
        incoming order is the CAD kernel's traversal of lite's construction,
        so a script that resolves a COMPLETE tie this way (or keeps whichever
        of two symmetric results came last) can land on the other candidate
        than it does on OCP 7.x - which is exactly the ambiguity the canonical
        rule below exists to remove, opt-in on both sides. tie_break=True instead resolves ties
        with _canonical_sort_key, so identical geometry always sorts identically
        rather than in the kernel's traversal order (see Curve.canonical). Like
        upstream, the geometric key is computed only for objects inside a tie
        group, and the center-based second stage only where the vertex key ties
        too."""
        fn = _sort_key_fn(key)
        decorated = [(fn(s), s) for s in self]
        if tie_break:
            # keys are computed only for the objects that actually tie, and the
            # cheap one (vertex positions) almost always settles it
            for tie_break_key in (_canonical_sort_key, _canonical_center_key):
                try:
                    tied = {}
                    for k, _ in decorated:
                        tied[k] = tied.get(k, 0) + 1
                except TypeError:  # unhashable keys from a custom callable
                    break
                if all([count == 1 for count in tied.values()]):
                    break
                decorated = [((k, tie_break_key(s) if tied[k] > 1 else ()), s)
                             for k, s in decorated]
        decorated = sorted(decorated, key=lambda pair: pair[0], reverse=reverse)
        return ShapeList([s for _, s in decorated])

    def sort_by_distance(self, other, reverse=False):
        """Sort by the MINIMAL distance between each shape and other
        (build123d ShapeList.sort_by_distance -> Shape.distance_to)."""
        return ShapeList(sorted(self, key=lambda s: s.distance_to(other),
                                reverse=reverse))

    def wires(self):
        out = ShapeList()
        for s in self:
            out.extend(s.wires())
        return out

    def group_by(self, key=Axis.Z, reverse=False, tol_digits=6):
        fn = _group_key_fn(key, tol_digits)
        ordered = sorted(self, key=fn, reverse=reverse)
        groups = []
        keys = []
        last = None
        for s in ordered:
            v = fn(s)
            if last is None or v != last:
                groups.append(ShapeList())
                keys.append(v)
                last = v
            groups[-1].append(s)
        return GroupBy(groups, keys, fn)

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

    def solids(self):
        out = ShapeList()
        for s in self:
            out.extend(s.solids())
        return out

    def _single(self, kind, items):
        if len(items) != 1:
            raise ValueError('Expected exactly one ' + kind + ', found ' +
                             str(len(items)))
        return items[0]

    def edge(self):
        return self._single('edge', self.edges())

    def face(self):
        return self._single('face', self.faces())

    def wire(self):
        return self._single('wire', self.wires())

    def vertex(self):
        return self._single('vertex', self.vertices())

    def solid(self):
        return self._single('solid', self.solids())


class GroupBy:
    """The result of ShapeList.group_by: groups reachable by INDEX or by KEY
    (build123d's GroupBy — group(key) is what the topology-selection docs
    use, e.g. length_groups.group(6))."""

    def __init__(self, groups, keys=None, key_f=None):
        self.groups = groups
        self.key_to_group_index = [(k, i) for i, k in enumerate(keys or [])]
        self.key_f = key_f

    def __getitem__(self, i):
        return self.groups[i]

    def __iter__(self):
        return iter(self.groups)

    def __len__(self):
        return len(self.groups)

    def group(self, key):
        """The group whose key equals key (build123d GroupBy.group)."""
        for k, i in self.key_to_group_index:
            if key == k:
                return self.groups[i]
        raise KeyError(key)

    def group_for(self, shape):
        """The group the given shape belongs to (build123d
        GroupBy.group_for)."""
        if self.key_f is None:
            raise KeyError(shape)
        return self.group(self.key_f(shape))


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
    """The active local locations, in the CURRENT builder's scope only.

    build123d 0.11.1 gives every builder a fresh location context on entry
    (build_common Builder.__enter__ sets local_locations = LocationList(
    [Location()])), so a Locations context wrapping a builder does NOT
    replicate what the builder constructs - the builder always builds locally.
    Truncating at the builder's own stack depth reproduces that exactly; before
    this, an enclosing GridLocations fanned out objects created inside a nested
    BuildSketch (key_concepts_builder's documented "Locations around a builder"
    case built four rectangles instead of one)."""
    builder = _active_builder()
    start = builder._loc_depth if (builder is not None and
                                   builder._loc_depth is not None) else 0
    locs = [Location()]
    for ctx in _loc_stack[start:]:
        locs = [a * b for a in locs for b in ctx.locations]
    return locs


def _sub_shapes_of(shape, kind):
    """The shape's vertices/edges/faces/solids for a Select bookkeeping kind."""
    if shape is None or getattr(shape, 'topo', None) is None:
        return []
    if kind == 'vertex':
        return list(shape.vertices())
    if kind == 'edge':
        return list(shape.edges())
    if kind == 'face':
        return list(shape.faces())
    return list(shape.solids())


def _shape_key(shape, kind):
    """Geometric identity of a sub-shape, for 'post - pre' set arithmetic.

    build123d compares TopoDS identity (which survives a boolean for untouched
    sub-shapes); lite rewraps every shape, so identity is taken from geometry
    instead: position for a vertex, midpoint+length for an edge,
    center+area for a face, center+volume for a solid."""
    topo = shape.topo
    if kind == 'vertex':
        p = w._vertexPoint(topo)
        return (round(p[0], 6), round(p[1], 6), round(p[2], 6))
    if kind == 'edge':
        c = w._edgeMidpoint(topo)
        return (round(c[0], 6), round(c[1], 6), round(c[2], 6),
                round(w._edgeLength(topo), 6))
    if kind == 'face' or kind == 'shell':
        # CenterOfMass is a VOLUME integral in this build and degenerates to
        # the bounding-box corner on an open shape, so every face of a solid
        # got the same key — the face centroid is the honest identity
        c = tuple(w._faceCentroid(topo)) if kind == 'face' else \
            tuple(w.CenterOfMass(topo))
        return (round(c[0], 6), round(c[1], 6), round(c[2], 6),
                round(w.SurfaceArea(topo), 6))
    c = tuple(w.CenterOfMass(topo))
    return (round(c[0], 6), round(c[1], 6), round(c[2], 6),
            round(w.SolidsVolume(topo), 6))


def new_edges(*objects, combined=None):
    """build123d's new_edges(): the edges of 'combined' that none of 'objects'
    contributed - i.e. the edges the combining operation created
    (topology/utils.py). Used by 'builder.edges(Select.NEW)'."""
    if combined is None:
        raise ValueError('new_edges() requires combined=')
    topos = []
    for o in objects:
        if isinstance(o, Builder):
            o = o._obj
        if o is not None and getattr(o, 'topo', None) is not None:
            topos.append(o.topo)
    if isinstance(combined, Builder):
        combined = combined._obj
    if combined is None or combined.topo is None:
        return ShapeList()
    # Return the CORRESPONDING edges of 'combined' (same parent + per-shape
    # index), so the result can be handed straight to fillet()/chamfer() the
    # way upstream's maker_coin does. The cut result is geometry only: it
    # carries no index, and its edges have fresh TopoDS handles.
    own = combined.edges()
    keyed = {}
    for e in own:
        c = w._edgeMidpoint(e.topo)
        keyed[(round(c[0], 6), round(c[1], 6), round(c[2], 6),
               round(w._edgeLength(e.topo), 6))] = e
    out = ShapeList()
    for raw in w.NewEdges(combined.topo, topos):
        c = w._edgeMidpoint(raw)
        key = (round(c[0], 6), round(c[1], 6), round(c[2], 6),
               round(w._edgeLength(raw), 6))
        match = keyed.get(key)
        # COMPROMISE(new-edges-partial): an edge that is only PARTLY new comes
        # back as a trimmed piece with no counterpart in 'combined'; it is
        # returned as bare geometry (usable for measuring, not for fillet()).
        out.append(match if match is not None else Edge(raw, parent=combined))
    return out


def _context_selector(name):
    """build123d's module-level selector getters (build_common's
    __gen_context_component_getter): 'edges()' inside a builder context is
    '<that builder>.edges()'."""
    def getter(select=Select.ALL):
        builder = _active_builder()
        if builder is None:
            raise RuntimeError(name + '() requires a Builder context to be in '
                               'scope')
        return getattr(builder, name)(select)
    return getter


def _align_sketch_faces(obj):
    """build123d's BuildSketch._add_to_context step 'Align sketch planar faces
    with Plane.XY': a face that is NOT coplanar with Plane.XY is expressed in
    its own plane's local frame and dropped onto z = 0, and every face is then
    oriented +Z (an up-side-down face is negated). Without the orientation
    half, a MIRRORED face never fuses with the face it was mirrored from
    (coplanar faces with opposite normals are not the same domain) and a
    BuildSketch mirror leaves two half faces behind."""
    faces = obj.faces()
    if not faces:
        return obj
    aligned = []
    changed = False
    for face in faces:
        normal = face.normal_at()
        coplanar = abs(normal.Z) > 1.0 - _TOL_1E6 and \
            abs(face.center().Z) <= _TOL_1E6
        if not coplanar:
            try:
                plane = Plane(origin=(0, 0, 0), x_dir=(1, 0, 0), z_dir=normal)
            except Exception:
                plane = Plane(origin=(0, 0, 0), z_dir=normal)
            # take the transformed FACE back out of the result (a transformed
            # shape is a generic TopoDS_Shape, which the face helpers reject)
            face = (plane.location.inverse() * face).faces()[0]
            face = (Pos(0, 0, -face.center().Z) * face).faces()[0]
            changed = True
        if face.normal_at().Z <= 0:
            face = -face
            changed = True
        aligned.append(face)
    if not changed:
        return obj
    topos = [_topo(f) for f in aligned]
    return Sketch(topos[0] if len(topos) == 1 else w.MakeCompound(topos))


def _combine(builder, obj, mode, warn_cls=None):
    """Merge obj into builder._obj per mode. Returns the CREATED object."""
    if builder is None or mode == Mode.PRIVATE:
        return obj
    if isinstance(builder, BuildSketch) and obj is not None and \
            getattr(obj, 'topo', None) is not None:
        obj = _align_sketch_faces(obj)
    before = builder._obj
    pre = builder._sub_shape_lists()
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
    builder._record_lasts(pre, obj, before)
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

    def _lite_copy(self):
        """copy.copy(<builder>) — a SHALLOW copy of the builder, exactly like
        upstream's: the copy keeps a reference to the result object as it is
        NOW, and every later operation rebinds the original's _obj, so the copy
        is the snapshot the docs use it as (before_fillet = copy(part))."""
        clone = self.__class__.__new__(self.__class__)
        for key in list(self.__dict__.keys()):
            clone.__dict__[key] = self.__dict__[key]
        return clone

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

    # ---------------------------------------------------------------- #
    # Select.LAST / Select.NEW bookkeeping (build123d Builder.lasts)
    #
    # Upstream records, per operation, 'post - pre' over the builder's
    # sub-shapes — except for the builder's OWN shape type, which is just the
    # objects that were combined in (build_common._add_to_context). The set
    # difference relies on TopoDS identity surviving a boolean; lite wraps
    # every shape in a fresh handle, so the difference is taken on GEOMETRY
    # (vertex position / edge midpoint+length / face center+area / solid
    # center+volume, rounded to 6 digits), which answers the same question.
    # ---------------------------------------------------------------- #
    _SELECT_KINDS = ('vertex', 'edge', 'face', 'solid')
    # the shape type each builder itself produces (build123d Builder._shape)
    _core_kind = 'solid'

    def _sub_shape_lists(self):
        """Current vertices/edges/faces/solids. Topology traversal only — the
        measurements that turn these into keys are deferred until a
        Select.LAST/NEW query actually asks for them."""
        o = self._obj
        if o is None or o.topo is None:
            return dict((k, []) for k in Builder._SELECT_KINDS)
        return {'vertex': list(o.vertices()), 'edge': list(o.edges()),
                'face': list(o.faces()), 'solid': list(o.solids())}

    def _record_lasts(self, pre, created, before):
        self._lasts_pre = pre
        self._lasts_post = self._sub_shape_lists()
        self._lasts_created = created
        self._lasts_before = before
        self._lasts_cache = {}

    def _lasts(self, kind):
        if not hasattr(self, '_lasts_post'):
            return ShapeList()
        if kind in self._lasts_cache:
            return ShapeList(self._lasts_cache[kind])
        if kind == self._core_kind:
            created = self._lasts_created
            out = ShapeList(_sub_shapes_of(created, kind)) if created is not None \
                else ShapeList()
        else:
            seen = set(_shape_key(s, kind) for s in self._lasts_pre[kind])
            out = ShapeList([s for s in self._lasts_post[kind]
                             if _shape_key(s, kind) not in seen])
        self._lasts_cache[kind] = list(out)
        return out

    @property
    def new_edges(self):
        """Edges that the last operation CREATED (build123d Builder.new_edges):
        the combined result's edges cut by the operands' edges."""
        if self._obj is None or not hasattr(self, '_lasts_created'):
            return ShapeList()
        originals = []
        if self._lasts_before is not None and self._lasts_before.topo is not None:
            originals.append(self._lasts_before)
        if self._lasts_created is not None:
            originals.append(self._lasts_created)
        return new_edges(*originals, combined=self._obj)

    def _selection_shape(self):
        """The shape the selectors read. BuildLine overrides it so that
        mid-context selectors (side_line.vertices() inside the with-block, which
        the sheet-metal examples fillet) see the line built SO FAR - _obj only
        exists after __exit__."""
        return self._obj

    # selector passthroughs (builder.edges() etc.)
    def edges(self, select=Select.ALL):
        if select == Select.LAST:
            return self._lasts('edge')
        if select == Select.NEW:
            return self.new_edges
        shape = self._selection_shape()
        return shape.edges() if shape is not None else ShapeList()

    def wires(self, select=Select.ALL):
        if select == Select.LAST:
            return ShapeList(edges_to_wires(self._lasts('edge')))
        if select == Select.NEW:
            raise ValueError('Select.NEW only valid for edges')
        shape = self._selection_shape()
        return shape.wires() if shape is not None else ShapeList()

    def face(self):
        return self._obj.face() if self._obj else None

    def wire(self):
        return self._obj.wire() if self._obj else None

    def edge(self):
        return self._obj.edge() if self._obj else None

    def faces(self, select=Select.ALL):
        if select == Select.LAST:
            return self._lasts('face')
        if select == Select.NEW:
            raise ValueError('Select.NEW only valid for edges')
        shape = self._selection_shape()
        return shape.faces() if shape is not None else ShapeList()

    def vertices(self, select=Select.ALL):
        if select == Select.LAST:
            return self._lasts('vertex')
        if select == Select.NEW:
            raise ValueError('Select.NEW only valid for edges')
        shape = self._selection_shape()
        return shape.vertices() if shape is not None else ShapeList()

    def solids(self, select=Select.ALL):
        if select == Select.LAST:
            return self._lasts('solid')
        if select == Select.NEW:
            raise ValueError('Select.NEW only valid for edges')
        shape = self._selection_shape()
        return shape.solids() if shape is not None else ShapeList()


class BuildPart(Builder):
    _shape_cls = Part
    _tag = 'part'
    _core_kind = 'solid'

    @property
    def part(self):
        return self._obj

    @property
    def _snapshot(self):
        return self._obj


class BuildSketch(Builder):
    _shape_cls = Sketch
    _tag = 'sketch'
    _core_kind = 'face'

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
    _core_kind = 'edge'

    def __init__(self, *workplanes, mode=Mode.ADD):
        Builder.__init__(self, *workplanes, mode=mode)
        self._specs = []

    def _selection_shape(self):
        return self._obj if self._obj is not None else self.line

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
        specs = [_seg_transform(s, loc._transform_point, fn_dir, loc)
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


# Selectors that read the builder in scope: 'edges()' == '<builder>.edges()'
# (build123d exports these alongside the methods, and the docs use them).
vertices = _context_selector('vertices')
edges = _context_selector('edges')
wires = _context_selector('wires')
faces = _context_selector('faces')
solids = _context_selector('solids')


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
    # Select.LAST/NEW bookkeeping happens inside _combine for every operation.
    return _combine(builder, obj, mode)


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
    align = _norm_align(align, 3)
    if arc_size1 == -90 and arc_size2 == 90 and arc_size3 == 360:
        bbox = ((-radius, -radius, -radius), (radius, radius, radius))
        return _create_object(Part, lambda: w.Sphere(radius), bbox, rotation,
                              align, mode, BuildPart)
    # partial sphere: BRepPrimAPI_MakeSphere's two latitude angles and the
    # longitude sweep, exactly build123d's Solid.make_sphere arguments. The
    # bounding box is measured (a spherical wedge has no simple analytic box).
    def maker():
        return w.PartialSphere(radius, arc_size1, arc_size2, arc_size3)
    return _create_object(Part, maker, None, rotation, align, mode, BuildPart)


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


def ConvexPolyhedron(points, rotation=(0, 0, 0), align=Align.NONE,
                     mode=Mode.ADD):
    """Part Object: the convex hull of the given points as a solid
    (build123d ConvexPolyhedron): every hull facet becomes a polygonal Face,
    which are then sewn into a Shell and solidified."""
    pnts = [tuple(_v3(p)) for p in points]
    # the same quickhull3d the scipy shim's ConvexHull uses (upstream reads
    # scipy's .simplices here)
    faces = []
    for facet in w.ConvexHull3D([list(p) for p in pnts]):
        corners = [pnts[int(i)] for i in facet]
        faces.append(Face(Curve([Edge.make_line(corners[i], corners[
            (i + 1) % len(corners)]) for i in range(len(corners))])))
    solid = Part(w.SewSolidFromFaces([f.topo for f in faces]))
    maker = lambda: solid.topo
    align3 = _norm_align(align, 3) if align is not None else None
    return _create_object(Part, maker, None, rotation, align3, mode, BuildPart)


def Wedge(xsize, ysize, zsize, xmin, zmin, xmax, zmax, rotation=(0, 0, 0),
          align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    """Part Object: a wedge whose near face is xsize by zsize and whose far
    face spans xmin..xmax by zmin..zmax, ysize deep (build123d Wedge ->
    Solid.make_wedge -> BRepPrimAPI_MakeWedge's min/max form)."""
    if any([v <= 0 for v in (xsize, ysize, zsize)]):
        raise ValueError('xsize, ysize & zsize must all be greater than zero')
    align = _norm_align(align, 3)
    bbox = ((0.0, 0.0, 0.0), (xsize, ysize, zsize))
    maker = lambda: w.WedgeMinMax(xsize, ysize, zsize, xmin, zmin, xmax, zmax)
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


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


def SlotCenterPoint(center, point, height, rotation=0,
                    align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    """Slot defined by its center and the center of ONE end arc, symmetric
    about the center (build123d SlotCenterPoint)."""
    c = Vector(center)
    p = Vector(point)
    half = p - c
    if half.length <= 0:
        raise ValueError('Distance between center and point must be greater '
                         'than 0 Got: distance = ' + repr(half.length))
    # a SlotOverall of the same length/height, rotated onto the half-line and
    # translated to the center - the identical geometry upstream sews together
    angle = math.degrees(math.atan2(half.Y, half.X))
    slot = SlotOverall(2 * half.length + height, height,
                       rotation=rotation + angle, align=align,
                       mode=Mode.PRIVATE)
    placed = Pos(c.X, c.Y, c.Z) * slot
    return _combine(_active_builder(BuildSketch), placed, mode)


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


class HeadType:
    STRAIGHT = 'STRAIGHT'
    CURVED = 'CURVED'
    FILLETED = 'FILLETED'


def ArrowHead(size, head_type=HeadType.CURVED, rotation=0, mode=Mode.ADD):
    """Sketch Object: an arrow head, tip at the origin pointing +X
    (build123d's drafting.ArrowHead, same construction)."""
    if head_type == HeadType.STRAIGHT:
        return Polygon((-size, size / 3), (-size, -size / 3), (0, 0),
                       align=None, rotation=rotation, mode=mode)
    if head_type not in (HeadType.CURVED, HeadType.FILLETED):
        raise ValueError('unknown arrow HeadType ' + repr(head_type))
    with BuildSketch() as arrow_head:
        with BuildLine():
            side = TangentArc((0, 0), (-size, size / 3),
                              tangent=(-size, size / 6))
            Line(side @ 1, (-7 * size / 8, 0))
            mirror(about=Plane.XZ)
        make_face()
        if head_type == HeadType.FILLETED:
            fillet(arrow_head.vertices().filter_by_position(
                Axis.X, -2 * size, -size / 5), radius=size / 20)
    return add(arrow_head.sketch, rotation=rotation, mode=mode) \
        if _active_builder() is not None else arrow_head.sketch


# --------------------------------------------------------------- Triangle ---
# build123d's Triangle solves the triangle with the trianglesolver package
# (Steven Byrnes, Apache-2.0-compatible MIT); its law-of-sines/cosines solver
# is small enough to port outright, which is what these four helpers are.

def _tri_aaas(D, E, F, f):
    return (f * math.sin(D) / math.sin(F), f * math.sin(E) / math.sin(F), f,
            D, E, F)


def _tri_sss(d, e, f):
    if not (d + e > f and e + f > d and f + d > e):
        raise ValueError('no such triangle')
    F = math.acos((d ** 2 + e ** 2 - f ** 2) / (2 * d * e))
    E = math.acos((d ** 2 + f ** 2 - e ** 2) / (2 * d * f))
    return (d, e, f, math.pi - F - E, E, F)


def _tri_sas(d, e, F):
    return _tri_sss(d, e, math.sqrt(d ** 2 + e ** 2 - 2 * d * e * math.cos(F)))


def _tri_ssa(d, e, D, ssa_flag):
    sin_e = math.sin(D) * e / d
    if abs(sin_e - 1.0) < 1e-9:
        E = math.pi / 2
    else:
        if sin_e >= 1.0:
            raise ValueError('no such triangle')
        e_acute = math.asin(sin_e)
        e_obtuse = math.pi - e_acute
        acute_ok = 0 < (math.pi - D - e_acute) < math.pi
        obtuse_ok = 0 < (math.pi - D - e_obtuse) < math.pi
        if ssa_flag == 'acute':
            if not acute_ok:
                raise ValueError('no such triangle')
            E = e_acute
        elif ssa_flag == 'obtuse':
            if not obtuse_ok:
                raise ValueError('no such triangle')
            E = e_obtuse
        else:
            if acute_ok and obtuse_ok:
                raise ValueError('Two different triangles fit this '
                                 'description')
            if not acute_ok and not obtuse_ok:
                raise ValueError('No such triangle')
            E = e_acute if acute_ok else e_obtuse
    F = math.pi - D - E
    e_, f_, d_, E_, F_, D_ = _tri_aaas(E, F, D, d)
    return (d_, e_, f_, D_, E_, F_)


def _tri_solve(a=None, b=None, c=None, A=None, B=None, C=None,
               ssa_flag='forbid'):
    """trianglesolver.solve, ported: give any three of the six and get all
    six back (angles in RADIANS)."""
    given = [x for x in (a, b, c, A, B, C) if x is not None]
    if len(given) != 3:
        raise ValueError('Must provide exactly 3 inputs')
    sides = [x for x in (a, b, c) if x is not None]
    if not sides:
        raise ValueError('Must provide at least 1 side length')
    if len(sides) == 3:
        return _tri_sss(a, b, c)
    if len(sides) == 2:
        if a is not None and A is not None and b is not None:
            return _tri_ssa(a, b, A, ssa_flag)
        if a is not None and A is not None and c is not None:
            a, c, b, A, C, B = _tri_ssa(a, c, A, ssa_flag)
            return (a, b, c, A, B, C)
        if b is not None and B is not None and a is not None:
            b, a, c, B, A, C = _tri_ssa(b, a, B, ssa_flag)
            return (a, b, c, A, B, C)
        if b is not None and B is not None and c is not None:
            b, c, a, B, C, A = _tri_ssa(b, c, B, ssa_flag)
            return (a, b, c, A, B, C)
        if c is not None and C is not None and a is not None:
            c, a, b, C, A, B = _tri_ssa(c, a, C, ssa_flag)
            return (a, b, c, A, B, C)
        if c is not None and C is not None and b is not None:
            c, b, a, C, B, A = _tri_ssa(c, b, C, ssa_flag)
            return (a, b, c, A, B, C)
        if a is not None and b is not None and C is not None:
            return _tri_sas(a, b, C)
        if b is not None and c is not None and A is not None:
            b, c, a, B, C, A = _tri_sas(b, c, A)
            return (a, b, c, A, B, C)
        if c is not None and a is not None and B is not None:
            c, a, b, C, A, B = _tri_sas(c, a, B)
            return (a, b, c, A, B, C)
        raise ValueError('unsupported triangle specification')
    if A is None:
        A = math.pi - B - C
    elif B is None:
        B = math.pi - A - C
    else:
        C = math.pi - A - B
    if not (A > 0 and B > 0 and C > 0):
        raise ValueError('no such triangle')
    if c is not None:
        return _tri_aaas(A, B, C, c)
    if a is not None:
        b, c, a, B, C, A = _tri_aaas(B, C, A, a)
        return (a, b, c, A, B, C)
    c, a, b, C, A, B = _tri_aaas(C, A, B, b)
    return (a, b, c, A, B, C)


def Triangle(a=None, b=None, c=None, A=None, B=None, C=None, align=None,
             rotation=0, mode=Mode.ADD):
    """Sketch Object: a triangle from one side length and any two other sides
    or interior angles (build123d Triangle). Side 'a' is the bottom, 'b' the
    right, going counter-clockwise; angle 'X' is opposite side 'x'. The result
    carries the solved a/b/c/A/B/C, the three edges and the three vertices."""
    if [v is None for v in (a, b, c)].count(True) == 3 or \
            [v is None for v in (a, b, c, A, B, C)].count(True) != 3:
        raise ValueError('One length and two other values must be provided')
    ar, br, cr, Ar, Br, Cr = _tri_solve(
        a, b, c,
        math.radians(A) if A is not None else None,
        math.radians(B) if B is not None else None,
        math.radians(C) if C is not None else None)
    apex = Vector(cr, 0, 0).rotate(Axis.Z, math.degrees(Br))
    pts = [(0.0, 0.0, 0.0), (ar, 0.0, 0.0), (apex.X, apex.Y, 0.0)]
    cx = sum([p[0] for p in pts]) / 3.0
    cy = sum([p[1] for p in pts]) / 3.0
    pts = [[p[0] - cx, p[1] - cy, 0.0] for p in pts]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    maker = lambda: w.Polygon(pts)
    obj = _sketch_object(maker, ((min(xs), min(ys)), (max(xs), max(ys))),
                         rotation, align, mode)
    obj.a, obj.b, obj.c = ar, br, cr
    obj.A, obj.B, obj.C = math.degrees(Ar), math.degrees(Br), math.degrees(Cr)
    obj.edge_a = obj.edges().filter_by(
        lambda e: abs(e.length - ar) < _TOL_1E6)[0]
    obj.edge_b = obj.edges().filter_by(
        lambda e: abs(e.length - br) < _TOL_1E6 and
        not (abs(e.length - obj.edge_a.length) < _TOL_1E6 and
             (e.center() - obj.edge_a.center()).length < _TOL_1E6))[0]
    obj.edge_c = obj.edges().filter_by(
        lambda e: all([(e.center() - other.center()).length > _TOL_1E6
                       for other in (obj.edge_a, obj.edge_b)]))[0]

    def _common_vertex(e1, e2):
        for v1 in e1.vertices():
            for v2 in e2.vertices():
                if (Vector(v1.to_tuple()) - Vector(v2.to_tuple())).length < \
                        _TOL_1E6:
                    return v1
        raise ValueError('these edges share no vertex')
    obj.vertex_A = _common_vertex(obj.edge_b, obj.edge_c)
    obj.vertex_B = _common_vertex(obj.edge_a, obj.edge_c)
    obj.vertex_C = _common_vertex(obj.edge_a, obj.edge_b)
    return obj


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
    font_path raises, and non-Latin glyph METRICS (e.g. Greek) can
    differ from other Arial substitutes.

    path= places each glyph on a curve like upstream's position_glyph: the
    glyph's bottom-centre advances the relative position along the path, and
    the glyph is rotated by the signed angle between +X and the path tangent
    there."""
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
    if path is None:
        return _sketch_object(maker, None, rotation, align, mode)
    # Text on a path: upstream splits the flat text into its TOP LEVEL shapes
    # (one per glyph) and repositions each of them (Compound.make_text's
    # position_glyph).
    flat = Sketch(maker())
    path_length = path.length
    placed = []
    for glyph in flat.faces():
        bbox = glyph.bounding_box()
        bottom_center_x = (bbox.min.X + bbox.max.X) / 2.0
        relative = position_on_path + bottom_center_x / path_length
        tangent = path.tangent_at(relative)
        wire_angle = Vector(1, 0, 0).get_signed_angle(tangent)
        wire_position = path.position_at(relative)
        shift = wire_position - Vector(bottom_center_x, 0, 0)
        moved = Pos(shift.X, shift.Y, shift.Z) * glyph
        placed.append(moved.rotate(Axis(wire_position, (0, 0, 1)),
                                   -wire_angle))
    result = Sketch(w.MakeCompound([_topo(g) for g in placed]))
    builder = _active_builder()
    if rotation:
        result = Rotation(0, 0, rotation) * result
    return _combine(builder, result, mode) if builder is not None else result


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
    if seg[0] == 'circle' and params is not None:
        n = _v3(params[1])
        params = [list(params[0]), [-n[0], -n[1], -n[2]], list(params[2]),
                  params[3]]
    if seg[0] in ('parab', 'hypr') and params is not None:
        # same parameter interval, opposite sense (GC_MakeArcOf*'s Sense flag)
        params = list(params[:6]) + [not params[6]]
    if seg[0] == 'interp' and params is not None:
        tans = params[0]
        if tans:
            tans = [([-t[0], -t[1], -t[2]] if t else [])
                    for t in reversed(tans)]
        params = [tans] + list(params[1:])
    return _seg_make(seg[0], list(reversed(_seg_pts(seg))), params)


def _seg_transform(seg, fn_point, fn_dir, loc=None):
    """Rigid-transform a segment: points via fn_point, directions via fn_dir.
    Kind-aware params: earc carries [center, xdir, normal, ...], interp
    carries [tangents, periodic, scale], raw carries an untransformable
    TopoDS edge."""
    pts = [fn_point(_v3(p)) for p in _seg_pts(seg)]
    params = _seg_params(seg)
    if params is not None:
        if seg[0] == 'circle':
            # [center, normal, xdir, radius]
            params = [list(fn_point(_v3(params[0]))), list(fn_dir(_v3(params[1]))),
                      list(fn_dir(_v3(params[2]))), params[3]]
        elif seg[0] in ('earc', 'parab', 'hypr'):
            # [center/origin, xdir, normal, ...sizes and angles]
            params = [list(fn_point(_v3(params[0]))), list(fn_dir(_v3(params[1]))),
                      list(fn_dir(_v3(params[2])))] + list(params[3:])
        elif seg[0] == 'bspline':
            # only the POLES move; knots/mults/degree/weights are invariant
            params = [[list(fn_point(_v3(p))) for p in params[0]]] + \
                list(params[1:])
        elif seg[0] == 'interp':
            tans = params[0]
            if tans:
                tans = [(list(fn_dir(_v3(t))) if t else [])
                        for t in tans]
            params = [tans] + list(params[1:])
        elif seg[0] == 'raw':
            # COMPROMISE(raw-segments): edges that are not lines/circles ride
            # through wires as opaque TopoDS edges. A rigid transform given as
            # a Location can still be applied to the edge itself (exact); an
            # arbitrary point/direction mapping cannot, and the caller falls
            # back to transforming the baked topo and dropping specs.
            if loc is None:
                raise NotImplementedError('cannot transform an opaque edge '
                                          'segment in build123d-lite')
            params = [_topo(loc * Edge(params[0]))]
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
        elif seg[0] == 'circle':
            cc = _v3(params[0])
            params = [[cc[0] * k, cc[1] * k, cc[2] * k], list(params[1]),
                      list(params[2]), params[3] * k]
        elif seg[0] in ('parab', 'hypr'):
            # a conic's PARAMETER range does not scale with its size (a
            # parabola's U is the y offset, a hyperbola's is a hyperbolic
            # angle), so scaling one would need the trim range recomputed —
            # refuse rather than return the wrong arc
            raise NotImplementedError('cannot scale a parabolic/hyperbolic '
                                      'arc in build123d-lite')
        elif seg[0] == 'bspline':
            params = [[[p[0] * k, p[1] * k, p[2] * k] for p in
                       [_v3(q) for q in params[0]]]] + list(params[1:])
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
        # ONE closed circle edge, like upstream — not two half arcs. The edge
        # COUNT of a full circle is observable: group_by(Edge.length) keys and
        # anything that samples per edge (make_hull) change with it.
        xdir = [math.cos(math.radians(start_angle)),
                math.sin(math.radians(start_angle)), 0.0]
        specs = [('circle', [at(start_angle), at(start_angle + 360)],
                  [list(c), [0.0, 0.0, 1.0], xdir, float(radius)])]
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
        # upstream applies the tangent to the LAST point instead, which builds
        # the same circle traversed the other way (objects_curve TangentArc)
        pts = (pts[1], pts[0])
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
    arc = _line_object([('arc3', [list(p1), at(amid), at(a2)])], mode)
    # upstream's JernArc records its defining parameters on the object
    arc.radius = radius
    arc.center_point = Vector((cx, cy, p1[2]))
    return arc


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


def PolarLine(start, length, angle=None, direction=None,
              length_mode=LengthMode.DIAGONAL, mode=Mode.ADD, **kwargs):
    """Line from a point at an angle, ending after 'length' or AT a limit
    shape (build123d PolarLine)."""
    p1 = _v3(start)
    if direction is not None:
        d = Vector(direction).normalized()
        angle = math.degrees(math.atan2(d.Y, d.X))
    elif angle is not None:
        a = math.radians(angle)
        d = Vector((math.cos(a), math.sin(a), 0.0))
    else:
        raise ValueError('PolarLine requires angle= or direction=')

    if isinstance(length, (int, float)):
        # length_mode measures the DIAGONAL (default), or the horizontal /
        # vertical projection of the line - upstream divides by cos/sin
        if length_mode == LengthMode.HORIZONTAL:
            scale = abs(length / math.cos(math.radians(angle)))
        elif length_mode == LengthMode.VERTICAL:
            scale = abs(length / math.sin(math.radians(angle)))
        else:
            scale = length
        p2 = [p1[0] + scale * d.X, p1[1] + scale * d.Y, p1[2] + scale * d.Z]
        return _line_object([('line', [p1, p2])], mode)

    # length is a LIMIT SHAPE: run the ray out and stop at the first contact
    # in front of the start point (build123d trims a long edge to the limit)
    target = length._obj if isinstance(length, Builder) else length
    if not isinstance(target, Shape):
        raise NotImplementedError(
            'PolarLine length limits are supported for shapes only in '
            'build123d-lite, not ' + type(length).__name__)
    axis = Axis(p1, tuple(d))
    best = None
    contact = None
    for e in target.edges():
        for h in e.find_intersection_points(axis):
            v = Vector(tuple(h))
            along = (v - Vector(tuple(p1))).dot(d)
            if along > _TOL and (best is None or along < best):
                best, contact = along, v
    if contact is None:
        raise ValueError("Polar line doesn't intersect length limit " +
                         repr(length))
    return _line_object([('line', [p1, list(contact)])], mode)


def _dist3(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 +
                     (a[2] - b[2]) ** 2)


def _unit3(v):
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if n < 1e-15:
        return [0.0, 0.0, 0.0]
    return [v[0] / n, v[1] / n, v[2] / n]


def FilletPolyline(*pts, radius, close=False, mode=Mode.ADD):
    """Polyline whose corners are filleted to a radius (build123d
    FilletPolyline). A radius of 0 leaves that corner sharp.

    Upstream builds each corner fillet with Face.fillet_2d; a fillet between
    two straight segments is the analytic tangent arc, so lite constructs it
    directly (identical geometry, and it keeps the result a spec-level Curve
    that mirror()/make_face() can still transform)."""
    if len(pts) == 1 and hasattr(pts[0], '__len__') and \
            hasattr(pts[0][0], '__len__'):
        pts = tuple(pts[0])
    points = [list(_v3(p)) for p in pts]
    # a user-closed polyline (last == first) is treated as close=True
    if len(points) > 1 and _dist3(points[0], points[-1]) < _TOL:
        close = True
        points.pop()
    if len(points) < 2:
        raise ValueError('FilletPolyline requires two or more pts')

    n = len(points)
    if isinstance(radius, (int, float)):
        radius_list = [float(radius)] * n
        radius_at = lambda i: radius_list[i]
    else:
        radius_list = [float(r) for r in radius]
        expected = n - (0 if close else 2)
        if len(radius_list) != expected:
            raise ValueError('radius list length (' + str(len(radius_list)) +
                             ') must match angle count (' + str(expected) + ')')
        radius_at = lambda i: radius_list[i - (0 if close else 1)]
    for r in radius_list:
        if r < 0:
            raise ValueError('radius ' + repr(r) + ' must be non-negative')

    corners = range(n) if close else range(1, n - 1)
    segs = []
    cursor = list(points[0])
    for i in corners:
        p = points[i]
        prev = points[(i - 1) % n]
        nxt = points[(i + 1) % n]
        r = radius_at(i)
        u = _unit3([p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]])
        v = _unit3([nxt[0] - p[0], nxt[1] - p[1], nxt[2] - p[2]])
        cosang = -(u[0] * v[0] + u[1] * v[1] + u[2] * v[2])
        cosang = max(-1.0, min(1.0, cosang))
        interior = math.acos(cosang)
        if r == 0 or interior < 1e-9 or abs(interior - math.pi) < 1e-9:
            continue  # sharp corner (or collinear: nothing to fillet)
        t = r / math.tan(interior / 2.0)
        a = [p[k] - u[k] * t for k in range(3)]
        b = [p[k] + v[k] * t for k in range(3)]
        # the arc centre lies along the interior bisector
        bis = _unit3([v[k] - u[k] for k in range(3)])
        dist = r / math.sin(interior / 2.0)
        centre = [p[k] + bis[k] * dist for k in range(3)]
        chord_mid = [(a[k] + b[k]) / 2.0 for k in range(3)]
        out = _unit3([chord_mid[k] - centre[k] for k in range(3)])
        arc_mid = [centre[k] + out[k] * r for k in range(3)]
        if _dist3(cursor, a) > _TOL:
            segs.append(('line', [list(cursor), list(a)]))
        segs.append(('arc3', [list(a), arc_mid, list(b)]))
        cursor = b
    end = points[0] if close else points[-1]
    if _dist3(cursor, end) > _TOL:
        segs.append(('line', [list(cursor), list(end)]))
    if not segs:
        raise ValueError('FilletPolyline produced no segments')
    return _line_object(segs, mode)


def IntersectingLine(start, direction, other, mode=Mode.ADD):
    """Line from a point in a direction, ending at the NEAREST intersection
    with another curve (build123d IntersectingLine)."""
    p1 = _v3(start)
    d = Vector(direction).normalized()
    axis = Axis(p1, tuple(d))
    target = other._obj if isinstance(other, Builder) else other
    hits = [h for e in target.edges() for h in e.find_intersection_points(axis)]
    if not hits:
        raise ValueError('No intersections found')
    # upstream takes the intersection CLOSEST to start (unsigned distance)
    best = None
    contact = None
    for h in hits:
        v = Vector(tuple(h))
        dist = (Vector(tuple(p1)) - v).length
        if best is None or dist < best:
            best, contact = dist, v
    p2 = [p1[0] + d.X * best, p1[1] + d.Y * best, p1[2] + d.Z * best]
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


# ----------------------------------------------- conic & spline 1-D objects
# build123d's analytic 1-D objects that are not circular arcs: exact conics
# (gp_Parab / gp_Hypr / gp_Elips through GC_MakeArcOf*) and exact B-splines
# (Geom_BSplineCurve from poles + knots). All of them build a LOCAL segment
# spec, which BuildLine transforms by its workplane on exit like every other
# 1-D object.

def _rot_z(v, degrees_):
    """Rotate a 3-vector about +Z (the workplane normal for 1-D objects)."""
    a = math.radians(degrees_)
    ca, sa = math.cos(a), math.sin(a)
    return [v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca, v[2]]


def _parabola_point(origin, xdir, ydir, focal, u):
    """OCCT gp_Parab parametrization: P(U) = O + U^2/(4 f) X + U Y."""
    k = u * u / (4.0 * focal)
    return [origin[i] + k * xdir[i] + u * ydir[i] for i in range(3)]


def _hyperbola_point(origin, xdir, ydir, major, minor, u):
    """OCCT gp_Hypr parametrization: P(U) = O + a cosh(U) X + b sinh(U) Y."""
    ch, sh = math.cosh(u), math.sinh(u)
    return [origin[i] + major * ch * xdir[i] + minor * sh * ydir[i]
            for i in range(3)]


def _conic_arc_spec(kind, center, xdir, normal, sizes, a1_deg, a2_deg, sense):
    """A 'parab'/'hypr' segment spec, with the chaining end points evaluated
    from the same parametric equation the kernel will use."""
    ydir = list(Vector(tuple(normal)).cross(Vector(tuple(xdir))))
    u1, u2 = math.radians(a1_deg), math.radians(a2_deg)
    if kind == 'parab':
        p0 = _parabola_point(center, xdir, ydir, sizes, u1)
        p1 = _parabola_point(center, xdir, ydir, sizes, u2)
    else:
        p0 = _hyperbola_point(center, xdir, ydir, sizes[0], sizes[1], u1)
        p1 = _hyperbola_point(center, xdir, ydir, sizes[0], sizes[1], u2)
    if not sense:
        p0, p1 = p1, p0
    return (kind, [p0, p1],
            [list(center), list(xdir), list(normal), sizes, a1_deg, a2_deg,
             bool(sense)])


def _arc_limit_curve(specs, arc_limit):
    """build123d's numeric-or-limit arc_size: build the half arc both ways,
    trim each at its first intersection with the limit and keep the shorter
    (ParabolicCenterArc / HyperbolicCenterArc)."""
    full = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
    edge = _single_edge_of(full)
    candidates = ShapeList()
    for candidate in (edge, _reverse_1d(edge)):
        trimmed = candidate.trim_to_other(arc_limit)
        if trimmed is not None:
            candidates.append(trimmed)
    if not candidates:
        raise ValueError('the arc does not intersect the arc limit ' +
                         repr(arc_limit))
    return candidates.sort_by(Edge.length)[0]


def ParabolicCenterArc(vertex, focal_length, start_angle=0.0, end_angle=None,
                       arc_size=90.0, rotation=0.0, angular_direction=None,
                       mode=Mode.ADD):
    """Parabolic arc about a vertex point (build123d ParabolicCenterArc):
    gp_Parab(plane, focal_length) trimmed by GC_MakeArcOfParabola between the
    two given "angles" (upstream converts them to radians and passes them as
    the curve parameters)."""
    c = _v3(vertex)
    xdir = _rot_z([1.0, 0.0, 0.0], rotation)
    normal = [0.0, 0.0, 1.0]
    if end_angle is not None or angular_direction is not None:
        if not isinstance(arc_size, (int, float)):
            raise ValueError('ParabolicCenterArc limit arc_size cannot be '
                             'combined with end_angle / angular_direction')
        end_a = end_angle if end_angle is not None else start_angle + arc_size
        sense = angular_direction != AngularDirection.CLOCKWISE
        spec = _conic_arc_spec('parab', c, xdir, normal, float(focal_length),
                               start_angle, end_a, sense)
        return _line_object([spec], mode)
    if isinstance(arc_size, (int, float)):
        spec = _conic_arc_spec('parab', c, xdir, normal, float(focal_length),
                               start_angle, start_angle + arc_size,
                               arc_size >= 0)
        return _line_object([spec], mode)
    spec = _conic_arc_spec('parab', c, xdir, normal, float(focal_length),
                           start_angle, start_angle + 180.0, True)
    trimmed = _arc_limit_curve([spec], arc_size)
    return _line_object(_specs_from_topo_edges(trimmed), mode)


def HyperbolicCenterArc(center, x_radius, y_radius, start_angle=0.0,
                        end_angle=None, arc_size=90.0, rotation=0.0,
                        angular_direction=None, mode=Mode.ADD):
    """Hyperbolic arc about a center point (build123d HyperbolicCenterArc):
    gp_Hypr trimmed by GC_MakeArcOfHyperbola. gp_Hypr needs major >= minor, so
    a taller-than-wide hyperbola is built rotated by 90 degrees with its angle
    range shifted to match, exactly like Edge.make_hyperbola."""
    c = _v3(center)
    normal = [0.0, 0.0, 1.0]
    if y_radius > x_radius:
        major, minor, correction = y_radius, x_radius, 90.0
    else:
        major, minor, correction = x_radius, y_radius, 0.0
    xdir = _rot_z([1.0, 0.0, 0.0], rotation + correction)
    sizes = [float(major), float(minor)]
    if end_angle is not None or angular_direction is not None:
        if not isinstance(arc_size, (int, float)):
            raise ValueError('HyperbolicCenterArc limit arc_size cannot be '
                             'combined with end_angle / angular_direction')
        end_a = end_angle if end_angle is not None else start_angle + arc_size
        sense = angular_direction != AngularDirection.CLOCKWISE
        spec = _conic_arc_spec('hypr', c, xdir, normal, sizes,
                               start_angle - correction, end_a - correction,
                               sense)
        return _line_object([spec], mode)
    if isinstance(arc_size, (int, float)):
        spec = _conic_arc_spec('hypr', c, xdir, normal, sizes,
                               start_angle - correction,
                               start_angle + arc_size - correction,
                               arc_size >= 0)
        return _line_object([spec], mode)
    spec = _conic_arc_spec('hypr', c, xdir, normal, sizes,
                           start_angle - correction,
                           start_angle + 180.0 - correction, True)
    trimmed = _arc_limit_curve([spec], arc_size)
    return _line_object(_specs_from_topo_edges(trimmed), mode)


def EllipticalStartArc(start_pnt, start_tangent, x_radius, y_radius, arc_size,
                       start_angle=None, major_axis_dir=None, mode=Mode.ADD):
    """Elliptical arc from a start point + tangent (build123d
    EllipticalStartArc): the ellipse frame is derived from the tangent, then
    the arc is the ordinary EllipticalCenterArc of that frame."""
    start = Vector(tuple(_v3(start_pnt)))
    normal = Vector(0, 0, 1)

    def proj(v):
        return v - normal * v.dot(normal)
    tangent = proj(Vector(tuple(_v3(start_tangent))))
    if start_angle is not None:
        rad = math.radians(start_angle)
        pln_tangent = tangent.normalized()
        a_radius = -x_radius * math.sin(rad)
        b_radius = y_radius * math.cos(rad)
        x_dir = (pln_tangent * a_radius -
                 normal.cross(pln_tangent) * b_radius) * \
            (1.0 / (a_radius * a_radius + b_radius * b_radius))
        pln_x_dir = x_dir.normalized()
    elif major_axis_dir is not None:
        pln_x_dir = proj(Vector(tuple(_v3(major_axis_dir)))).normalized()
        pln_y_dir = normal.cross(pln_x_dir)
        start_angle = math.degrees(math.atan2(
            -(tangent.dot(pln_x_dir) / x_radius),
            (tangent.dot(pln_y_dir) / y_radius)))
        rad = math.radians(start_angle)
    else:
        raise ValueError('Either start_angle or major_axis_dir must be '
                         'provided')
    pln_y_dir = normal.cross(pln_x_dir)
    origin = start - pln_x_dir * (x_radius * math.cos(rad)) - \
        pln_y_dir * (y_radius * math.sin(rad))
    rotation = math.degrees(math.atan2(pln_x_dir.Y, pln_x_dir.X))
    return EllipticalCenterArc(origin, x_radius, y_radius,
                               start_angle=start_angle, arc_size=arc_size,
                               rotation=rotation, mode=mode)


# ------------------------------------------- constrained arcs and lines ---
# build123d's ConstrainedArcs/ConstrainedLines are thin wrappers over OCCT's
# 2-D geometric constraint solvers (Geom2dGcc_Circ2d2TanRad, _Circ2d2TanOn,
# _Circ2d3Tan, _Circ2dTanCen, _Circ2dTanOnRad, _Lin2d2Tan, _Lin2dTanObl driven
# through Geom2dGcc_QualifiedCurve). That whole family used to be missing from
# this wasm build - the .d.ts declared it but the module exposed nothing,
# because ONE method (WhichQualifier, which returns GccEnt_Position through
# non-const references Embind cannot bind) failed the compile of every binding
# file in the package. The fork now filters that method, so the solvers are
# real here and the calls below are a statement-for-statement port of
# build123d 0.11.1's topology/constrained_lines.py; the kernel side lives in
# StandardLibrary.js (ConstrainedArcs2D / ConstrainedLines2D).


def _tangency_pair(arg):
    """Normalize one tangency argument to the {edge|point, qualifier} spec the
    kernel helper takes (upstream's _as_gcc_arg input side): a Vertex or a
    plain point is upstream's Geom2d_CartesianPoint argument, an Edge/Curve is
    a Geom2dGcc_QualifiedCurve, and an Axis is the infinite line through it."""
    qualifier = Tangency.UNQUALIFIED
    if isinstance(arg, tuple) and len(arg) == 2 and \
            not isinstance(arg[0], (int, float)):
        arg, qualifier = arg[0], arg[1]
    if isinstance(arg, Axis):
        # upstream passes an Axis through Edge as well: a long line segment
        # through the axis is the same qualified curve for the solvers, whose
        # tangency parameter is then checked against the segment's range
        big = 1e4
        p0 = Vector(arg.position) - Vector(arg.direction) * big
        p1 = Vector(arg.position) + Vector(arg.direction) * big
        arg = Edge.make_line(p0, p1)
    if isinstance(arg, Vertex):
        return {'point': list(arg.to_tuple())[:2]}
    if isinstance(arg, (Curve, Edge)) and getattr(arg, 'topo', None) is not None:
        edge = arg if isinstance(arg, Edge) else _single_edge_of(arg)
        return {'edge': edge.topo, 'qualifier': qualifier}
    if isinstance(arg, (Wire, Shape)) and getattr(arg, 'topo', None) is not None:
        return {'edge': arg.edges()[0].topo, 'qualifier': qualifier}
    v = _v3(arg)
    return {'point': [v[0], v[1]]}


def _constrained_curve(topo_edges, selector, mode):
    """Apply the user's selector and hand the result to the BuildLine, like
    build123d's BaseCurveObject does."""
    edges = ShapeList([Edge(t) for t in topo_edges])
    selected = selector(edges) if selector is not None else edges
    if selected is None:
        raise ValueError('selector must return an Edge or list of Edges, not '
                         'None')
    if isinstance(selected, (Edge, Curve)):
        selected = [selected]
    if not selected:
        raise ValueError('selector must return an Edge or list of Edges, not '
                         'None')
    specs = []
    for edge in selected:
        specs.extend(_specs_from_topo_edges(edge))
    return _line_object(specs, mode)


def _sagitta_index(sagitta):
    if sagitta == Sagitta.BOTH:
        return 1
    if sagitta == Sagitta.LONG:
        return -1
    return 0


def ConstrainedArcs(*args, radius=None, center=None, center_on=None,
                    sagitta=Sagitta.SHORT, selector=None, mode=Mode.ADD):
    """Circular arc(s) constrained by tangency to other geometry (build123d
    ConstrainedArcs). All five upstream overloads are supported, each on the
    OCCT solver upstream uses:

      (t1, t2, radius=)            Geom2dGcc_Circ2d2TanRad
      (t1, t2, center_on=)         Geom2dGcc_Circ2d2TanOn
      (t1, t2, t3)                 Geom2dGcc_Circ2d3Tan
      (t1, center=)                Geom2dGcc_Circ2dTanCen     (full circles)
      (t1, radius=, center_on=)    Geom2dGcc_Circ2dTanOnRad   (full circles)
    """
    if not args:
        raise ValueError('ConstrainedArcs requires at least one tangency')
    opts = {'sagitta': _sagitta_index(sagitta)}
    if center is not None:
        if len(args) != 1:
            raise ValueError('ConstrainedArcs(center=) takes one tangency')
        c = _v3(center)
        opts['center'] = [c[0], c[1]]
    elif center_on is not None:
        on = center_on[0] if isinstance(center_on, tuple) else center_on
        if isinstance(on, Axis):
            big = 1e4
            on = Edge.make_line(Vector(on.position) - Vector(on.direction) * big,
                                Vector(on.position) + Vector(on.direction) * big)
        if getattr(on, 'topo', None) is None:
            raise TypeError('center_on must be an Edge, Wire or Axis')
        opts['centerOn'] = on.topo if isinstance(on, Edge) else on.edges()[0].topo
        if len(args) == 1:
            if radius is None:
                raise ValueError('ConstrainedArcs(center_on=) with one '
                                 'tangency also needs radius=')
            opts['radius'] = float(radius)
    elif len(args) == 3:
        pass                                     # three-tangency solver
    else:
        if radius is None:
            raise ValueError('ConstrainedArcs requires radius=, center=, '
                             'center_on= or three tangencies')
        if radius <= 0:
            raise ValueError('radius must be > 0.0')
        opts['radius'] = float(radius)
    specs = [_tangency_pair(a) for a in args]
    return _constrained_curve(w.ConstrainedArcs2D(specs, opts), selector, mode)


def ConstrainedLines(*args, angle=None, direction=None, selector=None,
                     mode=Mode.ADD):
    """Line(s) constrained by tangency (build123d ConstrainedLines):

      (t1, t2)                     Geom2dGcc_Lin2d2Tan  (t2 may be a point)
      (t1, axis, angle=|direction=) Geom2dGcc_Lin2dTanObl
    """
    if len(args) != 2:
        raise ValueError('ConstrainedLines takes exactly two arguments')
    if angle is not None or direction is not None:
        reference = args[1]
        if not isinstance(reference, Axis):
            raise TypeError('the oriented form of ConstrainedLines needs an '
                            'Axis as its second argument')
        if abs(abs(Vector(reference.direction).Z) - 1) < _TOL_1E6:
            raise ValueError("reference Axis can't be perpendicular to "
                             'Plane.XY')
        if angle is None:
            d = _v3(direction)
            ref_angle = math.atan2(Vector(reference.direction).Y,
                                   Vector(reference.direction).X)
            angle_rad = math.atan2(d[1], d[0]) - ref_angle
        else:
            angle_rad = math.radians(angle)
        opts = {'angle': angle_rad,
                'axis': {'position': [Vector(reference.position).X,
                                      Vector(reference.position).Y],
                         'direction': [Vector(reference.direction).X,
                                       Vector(reference.direction).Y]}}
        edges = w.ConstrainedLines2D([_tangency_pair(args[0])], opts)
    else:
        specs = [_tangency_pair(a) for a in args]
        edges = w.ConstrainedLines2D(specs, {})
    return _constrained_curve(edges, selector, mode)


def BSpline(control_points, knots, degree, weights=None, periodic=False,
            mode=Mode.ADD):
    """An EXACT B-spline edge from poles, a knot sequence and a degree
    (build123d BSpline / Edge.make_bspline): repeated knot values become knot
    multiplicities, weights make it rational."""
    knot_list = [float(k) for k in knots]
    if not knot_list:
        raise ValueError('B-spline requires at least one knot')
    poles = [list(_v3(p)) for p in control_points]
    unique_knots = [knot_list[0]]
    mults = [1]
    for knot in knot_list[1:]:
        if abs(knot - unique_knots[-1]) <= _TOL_1E6:
            mults[-1] += 1
        else:
            unique_knots.append(knot)
            mults.append(1)
    weight_list = [float(x) for x in weights] if weights else []
    params = [poles, unique_knots, mults, int(degree), weight_list,
              bool(periodic)]
    topo = w.BSplineEdge(poles, unique_knots, mults, int(degree), weight_list,
                         bool(periodic))
    p0 = list(w._edgePointAt(topo, 0.0))
    p1 = list(w._edgePointAt(topo, 1.0))
    return _line_object([('bspline', [p0, p1], params)], mode)


def Airfoil(airfoil_code, n_points=50, finite_te=False, mode=Mode.ADD):
    """A NACA 4-digit (or fractional) airfoil section as a closed line
    (build123d Airfoil): cosine-spaced chord stations, the standard thickness
    distribution and camber line, interpolated as one periodic spline."""
    s = str(airfoil_code).replace('NACA', '').strip()
    if '.' in s:
        int_part, frac_part = s.split('.', 1)
        m = int(int_part[0]) / 100.0
        p = int(int_part[1]) / 10.0
        t = float(('%02d' % int(int_part[2:])) + '.' + frac_part) / 100.0
    else:
        m = int(s[0]) / 100.0
        p = int(s[1]) / 10.0
        t = int(s[2:]) / 100.0
    xs = [(1 - math.cos(math.pi * i / (n_points - 1))) / 2.0
          for i in range(n_points)]
    a0, a1, a2, a3 = 0.2969, -0.1260, -0.3516, 0.2843
    a4 = -0.1015 if finite_te else -0.1036
    yt = [5 * t * (a0 * math.sqrt(x) + a1 * x + a2 * x ** 2 + a3 * x ** 3 +
                   a4 * x ** 4) for x in xs]
    yc, dyc = [], []
    for x in xs:
        if m == 0 or p == 0 or p == 1:
            yc.append(0.0)
            dyc.append(0.0)
        elif x < p:
            yc.append(m / p ** 2 * (2 * p * x - x * x))
            dyc.append(2 * m / p ** 2 * (p - x))
        else:
            yc.append(m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x * x))
            dyc.append(2 * m / (1 - p) ** 2 * (p - x))
    theta = [math.atan(d) for d in dyc]
    upper = [(xs[i] - yt[i] * math.sin(theta[i]),
              yc[i] + yt[i] * math.cos(theta[i]), 0.0)
             for i in range(n_points)]
    lower = [(xs[i] + yt[i] * math.sin(theta[i]),
              yc[i] - yt[i] * math.cos(theta[i]), 0.0)
             for i in range(n_points)]
    ordered = upper[::-1] + lower
    # dict.fromkeys over build123d Vectors: identity is the position ROUNDED
    # to GEOM_KEY_DIGITS (Vector.__hash__), which is what collapses the two
    # trailing-edge points (1, +-1.8e-17) into one — without that the
    # periodic interpolation is handed a 3.6e-17 closing gap and OCCT's
    # BSplCLib::Interpolate fails
    unique, seen = [], []
    for pnt in ordered:
        key = (round(pnt[0], 5), round(pnt[1], 5), round(pnt[2], 5))
        if key not in seen:
            seen.append(key)
            unique.append(pnt)
    specs = [('interp', [list(pnt) for pnt in unique],
              [[], not finite_te, True])]
    if finite_te:
        specs.append(('line', [list(unique[-1]), list(unique[0])]))
    return _line_object(specs, mode)


def BlendCurve(curve0, curve1, continuity=ContinuityLevel.C2, end_points=None,
               tangent_scalars=None, mode=Mode.ADD):
    """A Bezier transition between two curves that matches position, tangent
    (C1, cubic) and curvature (C2, quintic) at the join — build123d
    BlendCurve's control-point construction, verbatim."""
    tan_scalars = (1.0, 1.0) if tangent_scalars is None else tuple(tangent_scalars)
    if len(tan_scalars) != 2:
        raise ValueError('tangent_scalars must be a (start, end) pair')
    curves = (curve0, curve1)
    if end_points is None:
        best, end_pnts = None, None
        for v0 in curve0.vertices():
            for v1 in curve1.vertices():
                d = (Vector(v0.to_tuple()) - Vector(v1.to_tuple())).length
                if best is None or d < best:
                    best = d
                    end_pnts = (v0.to_tuple(), v1.to_tuple())
    else:
        end_pnts = tuple(end_points)
    end_params = [0, 0]
    for i in range(2):
        given = Vector(tuple(_v3(end_pnts[i])))
        if (given - curves[i].position_at(0)).length < _TOL_1E6:
            end_params[i] = 0
        elif (given - curves[i].position_at(1)).length < _TOL_1E6:
            end_params[i] = 1
        else:
            raise ValueError('end_points must be at either the start or end '
                             'of a curve')
    start_pos = curve0.position_at(end_params[0])
    end_pos = curve1.position_at(end_params[1])
    start_deriv = curve0.derivative_at(end_params[0], 1) * tan_scalars[0]
    end_deriv = curve1.derivative_at(end_params[1], 1) * tan_scalars[1]
    if continuity == ContinuityLevel.C0:
        return Line(start_pos, end_pos, mode=mode)
    if continuity == ContinuityLevel.C1:
        cntl_pnts = [start_pos, start_pos + start_deriv * (1.0 / 3.0),
                     end_pos - end_deriv * (1.0 / 3.0), end_pos]
    else:
        start_curv = curve0.derivative_at(end_params[0], 2)
        end_curv = curve1.derivative_at(end_params[1], 2)
        cntl_pnts = [start_pos,
                     start_pos + start_deriv * 0.2,
                     start_pos + start_deriv * 0.4 + start_curv * 0.05,
                     end_pos - end_deriv * 0.4 + end_curv * 0.05,
                     end_pos - end_deriv * 0.2,
                     end_pos]
    return Bezier(*cntl_pnts, mode=mode)


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
        elif t == 'Circle' and (abs(p0[0] - p1[0]) > _TOL_1E6 or
                                abs(p0[1] - p1[1]) > _TOL_1E6 or
                                abs(p0[2] - p1[2]) > _TOL_1E6):
            pm = list(w._edgePointAt(e.topo, 0.5))
            specs.append(('arc3', [p0, pm, p1]))
        else:
            # closed circles (start == end) have no three-point form, and
            # anything that is not a line/arc (BSpline, ellipse, ...) rides
            # through as an opaque segment carrying the TopoDS edge itself
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
            # build123d's Solid.extrude_taper uses TWO algorithms: LocOpe_DPrism
            # only when the extrusion runs along the profile normal with a
            # POSITIVE taper and no holes, otherwise a LOFT between the profile
            # wires and their 2-D offsets (offset = -length * tan(taper),
            # Kind.INTERSECTION), with the inner wires' taper flipped.
            profile = Face(face)
            inner = profile.inner_wires()
            if taper > 0 and not inner and plane.z_dir.Z > 0:
                solid = w.TaperExtrude(face, amount, taper)
                results.append(Part(solid))
                continue
            offset_amt = -abs(amount) * math.tan(math.radians(taper))
            base = Plane(profile)
            shift = Pos(base.z_dir.X * amount, base.z_dir.Y * amount,
                        base.z_dir.Z * amount)
            solids = []
            for i, wire in enumerate([profile.outer_wire()] + list(inner)):
                flip = -1.0 if i > 0 else 1.0
                local = base.location.inverse() * wire
                local_taper = Curve(_topo(local)).offset_2d(
                    flip * offset_amt, kind=Kind.INTERSECTION)
                taper_wire = shift * (base.location * Curve(_topo(local_taper)))
                solids.append(Part(w.Loft([_topo(wire), _topo(taper_wire)],
                                          False)))
            solid = solids[0] if len(solids) == 1 else \
                (solids[0] - solids[1:])
            results.append(Part(_topo(solid)))
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
    return _combine(builder, obj, mode)


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


def make_brake_formed(thickness, station_widths, line=None, side=Side.LEFT,
                      kind=Kind.ARC, clean=True, mode=Mode.ADD):
    """Sheet-metal brake forming (build123d make_brake_formed) - a
    statement-for-statement port of operations_part.make_brake_formed.

    The outline is offset by the sheet thickness to get the SECTION, a station
    edge is paired to every vertex of the line (the offset vertex exactly
    thickness away), each station edge is extruded by its width along the
    section plane's normal, and consecutive station faces are swept along the
    matching segment of the line and fused."""
    builder = _active_builder(BuildPart)
    if line is None:
        # upstream reads BuildPart.pending_edges_as_wire; in lite a BuildLine
        # directly inside a BuildPart leaves its result in pending_path
        line = getattr(builder, 'pending_path', None) if builder else None
        if line is None:
            raise ValueError('A line must be provided')
        builder.pending_path = None
    elif isinstance(line, Curve) and len(line.edges()) == 0:
        raise ValueError('A line must be provided')
    offset_line = line.offset_2d(distance=thickness, kind=kind, side=side,
                                 closed=True)
    offset_vertices = offset_line.vertices()
    try:
        plane = Plane(Face(offset_line))
    except Exception:
        raise ValueError('line not suitable - probably straight')

    line_vertices = line.vertices()
    if isinstance(station_widths, (int, float)):
        widths = [float(station_widths)] * len(line_vertices)
    else:
        widths = [float(x) for x in station_widths]
    if len(widths) != len(line_vertices):
        raise ValueError('widths must either be a single number or an '
                         'iterable with a length of the # vertices in line (' +
                         str(len(line_vertices)) + ')')

    station_edges = ShapeList()
    for vertex in line_vertices:
        base = Vector(vertex.to_tuple())
        others = offset_vertices.sort_by_distance(base)
        for other in others[1:]:
            if abs((base - Vector(other.to_tuple())).length - thickness) < 1e-2:
                station_edges.append(Edge.make_line(base,
                                                    Vector(other.to_tuple())))
                break
    station_edges = station_edges.sort_by(line)

    z = Vector(plane.z_dir)
    station_faces = [Face.extrude(e, z * width)
                     for e, width in zip(station_edges, widths)]
    sweep_paths = line.edges().sort_by(line)
    sections = []
    for i in range(len(station_faces) - 1):
        # MakePipeShell needs a WIRE spine; each sweep path here is a single
        # edge of the outline
        path_topo = w.WireFromEdgesFixed([_topo(sweep_paths[i])])
        sections.append(Part(w.PipeShellSweep(
            [w._faceOuterWire(station_faces[i].topo),
             w._faceOuterWire(station_faces[i + 1].topo)],
            path_topo, False, '', [], 0, True)))
    if len(sections) > 1:
        solid = sections[0]
        for extra in sections[1:]:
            solid = solid.fuse(extra)
    else:
        solid = sections[0]
    return _combine(builder, Part(solid.topo), mode)


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
    """(target shape, per-shape edge indices) for fillet/chamfer.

    build123d takes the target from the ACTIVE BUILDER (operations_generic's
    target = context._obj) and hands the raw TopoDS edges to
    BRepFilletAPI, which matches them by identity — so an edge pool assembled
    from several intermediate shapes ([f.outer_wire().edges() for f in
    faces], the topology-selection docs' group_hole_area) is perfectly legal
    as long as every edge IS an edge of the target. Lite re-wraps shapes, so
    the same question is answered geometrically: each edge is mapped onto the
    target's edge with the same midpoint and length."""
    edges = []
    for o in _tolist(objects):
        if isinstance(o, Edge):
            edges.append(o)
        elif isinstance(o, (ShapeList, list, tuple)):
            for e in o:
                if isinstance(e, Edge):
                    edges.append(e)
                elif isinstance(e, (ShapeList, list, tuple)):
                    edges.extend([x for x in e if isinstance(x, Edge)])
    if not edges:
        raise ValueError('no edges given (use shape.edges() selectors)')
    builder = _active_builder()
    target = builder._obj if (builder is not None and
                              builder._obj is not None and
                              builder._obj.topo is not None) else None
    if target is None:
        target = edges[0].parent
        for e in edges:
            if e.parent is not target:
                raise ValueError('all edges must belong to the same shape')
    if target is None or target.topo is None:
        raise ValueError('these edges have no parent shape, so they cannot be '
                         'filleted/chamfered (select them with shape.edges() '
                         '/ builder.edges(...))')
    keyed = {}
    for e in target.edges():
        keyed[_shape_key(e, 'edge')] = e.index
    indices = []
    for e in edges:
        if e.parent is target and e.index is not None:
            indices.append(e.index)
            continue
        idx = keyed.get(_shape_key(e, 'edge'))
        if idx is None:
            raise ValueError('one of these edges is not an edge of the shape '
                             'being filleted/chamfered (select them with '
                             'shape.edges() / builder.edges(...))')
        indices.append(idx)
    return target, indices


def _wire_common_plane(line):
    """The plane a planar wire lies in (build123d Mixin1D.common_plane), with
    its origin at the wire's start. The normal comes from Newell's method over
    the sampled polyline, which is exact for a planar loop and stable for the
    open lines fillet() works on."""
    pts = []
    for edge in line.edges():
        for i in range(5):
            pts.append(edge.position_at(i / 4.0))
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        a = pts[i]
        b = pts[(i + 1) % len(pts)]
        nx += (a.Y - b.Y) * (a.Z + b.Z)
        ny += (a.Z - b.Z) * (a.X + b.X)
        nz += (a.X - b.X) * (a.Y + b.Y)
    normal = Vector(nx, ny, nz)
    if normal.length <= _TOL_1E6:
        # a straight (degenerate) outline - any plane containing it will do
        direction = (pts[-1] - pts[0]).normalized()
        helper_v = Vector(0, 0, 1)
        if abs(direction.dot(helper_v)) > 0.9:
            helper_v = Vector(1, 0, 0)
        normal = direction.cross(helper_v)
    return Plane(origin=line.position_at(0), z_dir=normal.normalized())


def _wire_fillet_corner(edges, index, vertex, radius):
    """Fillet ONE corner of a connection-ordered edge list, returning the new
    list (build123d's _fillet_wire_corner + _splice_wire_fillet_corner).

    The solver is upstream's primary one, ChFi2d_FilletAlgo, which the fork now
    binds; upstream's Geom2dGcc_Circ2d2TanRad fallback is used when ChFi2d
    finds no result on this corner (the same two-tangent-arc construction that
    backs ConstrainedArcs)."""
    e0, e1 = edges[index[0]], edges[index[1]]
    point = [vertex.X, vertex.Y, vertex.Z]
    solved = w.FilletWireCorner(e0.topo, e1.topo, point, radius)
    if solved is not None:
        arc = Edge(solved[0])
        trimmed = [Edge(solved[1]), Edge(solved[2])]
    else:
        # upstream's fallback: every arc of the given radius tangent to both
        # edges, nearest the corner, then each edge trimmed at its contact
        arcs = ShapeList([Edge(t) for t in w.ConstrainedArcs2D(
            [{'edge': e0.topo, 'qualifier': Tangency.UNQUALIFIED},
             {'edge': e1.topo, 'qualifier': Tangency.UNQUALIFIED}],
            {'radius': radius, 'sagitta': 1})])
        if not arcs:
            raise ValueError('Fillet algorithm failed for ' + str(point) +
                             ' with radius ' + str(radius))
        arc = arcs.sort_by_distance(Vector(point))[0]
        trimmed = []
        for e in (e0, e1):
            contact = arc.vertices().sort_by_distance(e)[0]
            pieces = _split_1d_at_point(e, Vector(contact.to_tuple()))
            far = [v for v in e.vertices()
                   if (Vector(v.to_tuple()) - Vector(point)).length > _TOL_1E6]
            keep = None
            for piece in pieces:
                for v in piece.vertices():
                    for f in far:
                        if (Vector(v.to_tuple()) -
                                Vector(f.to_tuple())).length <= _TOL_1E6:
                            keep = piece
            trimmed.append(keep if keep is not None else e)

    out = list(edges)
    out[index[0]] = trimmed[0]
    out[index[1]] = trimmed[1]
    n = len(out)
    if index[1] == (index[0] + 1) % n:
        insert_at = index[0] + 1
    else:
        insert_at = index[1] + 1
    out.insert(insert_at, arc)
    return out


def _wire_fillet_2d(line, vertices, radius):
    """The 1-D corner fillet of an open (or closed) planar wire - build123d's
    Wire.fillet_2d, driven from the fillet() operation's 1-D branch.

    Upstream filters the wire's END vertices out in fillet() (they have only
    one incident edge), fillets the remaining corners ONE AT A TIME, and
    rebuilds the wire from the connection-ordered edge list with the fillet arc
    spliced between the two trimmed edges."""
    # Upstream forces the wire onto Plane.XY for the fillet (ChFi2d and the
    # Geom2dGcc solvers are 2-D) and maps the result back afterwards.
    plane = _wire_common_plane(line)
    to_local = plane.location.inverse()
    local_line = to_local * line
    local_points = [to_local._transform_point(v.to_tuple()) for v in vertices]
    edges = ShapeList([Edge(t) for t in w.OrderedEdges(local_line.topo)])
    start = local_line.position_at(0)
    end = local_line.position_at(1)
    closed = (start - end).length <= _TOL_1E6
    for point in local_points:
        v = Vector(point)
        if not closed and ((v - start).length <= _TOL_1E6 or
                           (v - end).length <= _TOL_1E6):
            continue                      # an end vertex cannot be filleted
        touching = []
        for i, e in enumerate(edges):
            for ev in e.vertices():
                if (Vector(ev.to_tuple()) - v).length <= _TOL_1E6:
                    touching.append(i)
                    break
        if len(touching) != 2:
            raise ValueError('Vertex must connect exactly two edges: ' +
                             str(v))
        edges = _wire_fillet_corner(edges, touching, v, radius)
    result = plane.location * Curve(w.WireFromOrderedEdges(
        [e.topo for e in edges]))
    # keep the wire's DIRECTION (upstream re-reverses when is_forward flips):
    # offset_2d's Side.LEFT/RIGHT is measured against the traversal direction,
    # so a flipped result would offset to the other side
    original_start = line.position_at(0)
    if ((result.position_at(0) - original_start).length >
            (result.position_at(1) - original_start).length):
        result = _reverse_1d(result)
    builder = _active_builder()
    if builder is not None:
        if isinstance(builder, BuildLine):
            builder._specs = _specs_from_topo_edges(result)
            builder._obj = result
        elif (builder._obj is not None and
                (builder._obj is line or builder._obj.topo is line.topo)):
            builder._obj = result
    return result


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
    if len(faces) == 0:
        return _wire_fillet_2d(parent, verts, radius)
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
    def _is_2d(t):
        return t.topo is not None and len(t.solids()) == 0 and \
            len(t.faces()) > 0

    if all([_is_2d(t) for t in targets]):
        # 2-D offset of FACES: upstream offsets the outer wire by +amount and
        # every inner wire by -amount, rebuilds the planar face and subtracts
        # the (possibly overshooting) inner faces — operations_generic.offset's
        # face branch. A 3-D MakeOffsetShape here would thicken the sketch.
        new_faces = []
        for t in targets:
            for face in t.faces():
                outer = face.outer_wire().offset_2d(amount, kind=kind)
                inner_wires = []
                for hole in face.inner_wires():
                    try:
                        inner_wires.append(hole.offset_2d(-amount, kind=kind))
                    except Exception:
                        pass
                new_face = Face(outer)
                if (new_face.normal_at() - face.normal_at()).length > 0.001:
                    new_face = -new_face
                if inner_wires:
                    new_face = new_face - [Face(iw) for iw in inner_wires]
                new_faces.append(new_face)
        obj = Sketch(w.MakeCompound([_topo(f) for f in new_faces])) \
            if len(new_faces) > 1 else Sketch(_topo(new_faces[0]))
        return _combine(builder, obj, mode)

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
    # build123d's add() replaces each Builder argument with its result and
    # drops the ones that have none yet (operations_generic.add's object_iter)
    objs = [(o._obj if isinstance(o, Builder) else o) for o in objs
            if not (isinstance(o, Builder) and o._obj is None)]
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
                specs = [_seg_transform(s, rot._transform_point, fn_dir, rot)
                         for s in specs]
            # replicate at the active Locations contexts, like every other
            # object creation (build123d dimension-arrow pattern)
            placed_specs = []
            for loc in ctx_locs:
                fn_dir = lambda d: _mat_vec(loc._R, d)
                placed_specs.extend([_seg_transform(s, loc._transform_point,
                                                    fn_dir, loc)
                                     for s in specs])
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


def _connected_edges_of(edge, parent):
    """The edges of parent that share a vertex with edge (build123d's
    topo_explore_connected_edges). Upstream accumulates into a set, so ITS
    order is memory-address order and varies run to run; lite keeps the
    parent's own edge order, which is deterministic."""
    if parent is None:
        raise ValueError('edge must be extracted from shape')
    keys = [_shape_key(v, 'vertex') for v in edge.vertices()]
    out = ShapeList()
    for other in parent.edges():
        if _shape_key(other, 'edge') == _shape_key(edge, 'edge'):
            continue
        for v in other.vertices():
            if _shape_key(v, 'vertex') in keys:
                out.append(other)
                break
    return out


def full_round(edge, invert=False, voronoi_point_count=100, mode=Mode.REPLACE):
    """Replace an edge of the sketch's face with the arc of the largest empty
    circle that fits in the face (build123d full_round) - a
    statement-for-statement port of operations_sketch.full_round.

    The candidate centres are the VORONOI VERTICES of 101 samples per edge over
    the target edge and its two neighbours; the best three (by how equal their
    three edge distances are) are averaged. The scipy shim's 2-D Voronoi is a
    Bowyer-Watson triangulation whose circumcentres are qhull's finite Voronoi
    vertices - verified vertex-set-identical to scipy on exactly these
    inputs."""
    from scipy.spatial import Voronoi

    builder = _active_builder(BuildSketch)
    if not isinstance(edge, Edge):
        raise ValueError('A single Edge must be provided')
    parent = getattr(edge, 'parent', None)
    if parent is None and builder is not None:
        parent = builder._obj
    connected = _connected_edges_of(edge, parent)
    if len(connected) != 2:
        raise ValueError('Invalid geometry - 3 or more edges required')

    edge_group = [edge] + list(connected)
    points = []
    for e in edge_group:
        for i in range(voronoi_point_count + 1):
            v = e.position_at(i / voronoi_point_count)
            points.append([v.X, v.Y])
    vertices = [Vector(v[0], v[1], 0) for v in Voronoi(points).vertices]

    best_three = [(float('inf'), 0), (float('inf'), 0), (float('inf'), 0)]
    for i, v in enumerate(vertices):
        distances = [e.distance_to(v) for e in edge_group]
        avg = sum(distances) / 3
        difference = max([abs(d - avg) for d in distances])
        if difference < best_three[-1][0]:
            best_three[-1] = (difference, i)
            best_three.sort(key=lambda x: x[0])
    center = Vector(0, 0, 0)
    for _, i in best_three:
        center = center + vertices[i]
    center = center * (1.0 / 3.0)

    ends = [e.distance_to_with_closest_points(center)[1] for e in connected]
    middle = edge.distance_to_with_closest_points(center)[1]

    origin = (ends[0] + ends[1]) * 0.5
    x_dir = (ends[1] - ends[0]).normalized()
    to_arc = origin - middle
    z_dir = (to_arc - x_dir * to_arc.dot(x_dir)).normalized()
    split_pln = Plane(origin=origin, x_dir=x_dir, z_dir=z_dir)
    trimmed = []
    for e in connected:
        piece = e.split(split_pln)
        if piece is None:
            raise ValueError('Invalid geometry to create the end arc')
        trimmed.append(piece)

    if invert:
        middle = center * 2 - middle

    new_arc = Edge.make_three_point_arc(ends[0], middle, ends[1])

    keep_keys = [_shape_key(e, 'edge') for e in [edge] + list(connected)]
    others = ShapeList([e for e in parent.edges()
                        if _shape_key(e, 'edge') not in keep_keys])

    wires = Wire.combine(list(trimmed) + [new_arc] + list(others))
    wires = ShapeList(wires).sort_by(SortBy.LENGTH, reverse=True)
    pending = Face(wires[0], list(wires[1:]))
    if parent.faces()[0].normal_at() != pending.normal_at():
        pending = -pending
    result = Sketch(pending.topo)
    if builder is not None:
        _combine(builder, result, mode)
        builder.pending_edge_specs = []
    return result


def make_hull(edges=None, tolerance=1e-3, mode=Mode.ADD):
    """Face from the 2D convex hull of the given edges (or the pending edges +
    the sketch under construction) — a statement-for-statement port of
    build123d's Wire.make_convex_hull: sample every edge at
    int(2 / tolerance) parameters, take the 2-D convex hull of the cloud, then
    read the hull back as (a) straight CONNECTING edges between the sampled
    contact points and (b) TRIMMED pieces of the source edges between them. The
    arcs of the hull are therefore the source arcs, exactly, and the only
    approximation is where the tangent lines touch them (upstream's own
    documented limitation)."""
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
    # 1) a cloud of points along all edges (upstream's fragments_per_edge)
    fragments = int(2 / tolerance)
    pts = []
    lookup = []          # global point index -> (edge index, edge parameter)
    for ei, e in enumerate(hull_edges):
        for i in range(fragments):
            param = i / (fragments - 1)
            q = e.position_at(param)
            pts.append((q.X, q.Y, len(lookup)))
            lookup.append((ei, param))
    hull = _convex_hull_2d(pts)
    if len(hull) < 3:
        raise ValueError('make_hull: degenerate hull')
    # 2) the hull facets, as scipy would hand them over: index pairs. A cyclic
    # hull of N vertices has exactly N of them.
    simplices = [(hull[i][2], hull[(i + 1) % len(hull)][2])
                 for i in range(len(hull))]
    # 3+4) connecting edges within one source edge and between two of them
    connecting_edge_data = []
    trim_points = {}

    def _mark(edge_index, point_index):
        if edge_index not in trim_points:
            trim_points[edge_index] = [point_index]
        else:
            trim_points[edge_index].append(point_index)
    for s0, s1 in simplices:
        e0, u0 = lookup[s0]
        e1, u1 = lookup[s1]
        if e0 != e1:
            _mark(e0, s0)
            _mark(e1, s1)
            connecting_edge_data.append(((e0, u0), (e1, u1)))
        elif abs(s0 - s1) != 1:
            lo, hi = min(s0, s1), max(s0, s1)
            _mark(e0, lo)
            _mark(e0, hi)
            connecting_edge_data.append(((e0, lookup[lo][1]),
                                         (e0, lookup[hi][1])))
    # 5) pair the trim points up per edge
    trim_data = {}
    for edge_index in trim_points:
        s_points = sorted(trim_points[edge_index])
        pairs = []
        for i in range(0, len(s_points) - 1, 2):
            if s_points[i] != s_points[i + 1]:
                pairs.append((s_points[i], s_points[i + 1]))
        trim_data[edge_index] = pairs
    # 6) the connecting (tangent/chord) edges
    result_edges = [Edge.make_line(hull_edges[a[0]].position_at(a[1]),
                                   hull_edges[b[0]].position_at(b[1]))
                    for a, b in connecting_edge_data]
    # 7) the surviving pieces of the source edges
    for edge_index in trim_data:
        for (p0, p1) in trim_data[edge_index]:
            result_edges.append(hull_edges[edge_index].trim(
                lookup[p0][1], lookup[p1][1]))
    # 8) one wire, then the planar face the sketch wants
    wire = w.WireFromEdgesFixed([e.topo for e in result_edges], _TOL_1E6)
    face = w.MakeFace(wire)
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

    @property
    def symbol(self):
        """The viewer symbol upstream draws for this joint (build123d
        Joint.symbol). Base form (RigidJoint): a triad at the joint frame,
        scaled to the parent's bounding-box diagonal / 12."""
        size = self.parent.bounding_box().diagonal / 12
        return Compound.make_triad(axes_scale=size).locate(self.location)

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

    @property
    def symbol(self):
        """Axis of rotation (build123d RevoluteJoint.symbol)."""
        radius = self.parent.bounding_box().diagonal / 30
        return Compound([Edge.make_line((0, 0, 0), (0, 0, radius * 10)),
                         Edge.make_circle(radius),
                         Edge.make_line((0, 0, 0), (radius, 0, 0))]
                        ).move(self.location)

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

    @property
    def symbol(self):
        """Linear axis (build123d LinearJoint.symbol)."""
        radius = (self.linear_range[1] - self.linear_range[0]) / 15
        return Compound([Edge.make_line((0, 0, self.linear_range[0]),
                                        (0, 0, self.linear_range[1])),
                         Edge.make_circle(radius)]).move(self.location)

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

    @property
    def symbol(self):
        """Cylindrical axis (build123d CylindricalJoint.symbol)."""
        radius = (self.linear_range[1] - self.linear_range[0]) / 15
        return Compound([Edge.make_line((0, 0, self.linear_range[0]),
                                        (0, 0, self.linear_range[1])),
                         Edge.make_circle(radius),
                         Edge.make_line((0, 0, 0), (radius, 0, 0))]
                        ).move(self.location)

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


def import_step(file_name):
    """Read a STEP asset that was handed to the worker ahead of the run
    (build123d import_step). The worker has no filesystem, so the file cannot
    be opened from the path the script computes next to __file__; instead the
    host delivers its text through CascadeAPI.loadExternalFiles() (which is
    exactly the app's own STEP-import path: STEPControl_Reader over a MEMFS
    data file) and the BASE NAME of the requested path is looked up here.

    Upstream returns a Compound carrying the STEP assembly's labels and
    colours; lite returns the geometry only."""
    name = str(file_name)
    topo = w.GetExternalShape(name)
    if topo is None or not topo:
        raise FileNotFoundError(
            'import_step: "' + name + '" was not delivered to the worker. '
            'The CAD worker has no filesystem; pass the file content with '
            'CascadeAPI.loadExternalFiles({"' + name.split('/')[-1] +
            '": <step text>}) before running the script.')
    res = Compound.__new__(Compound)
    Shape.__init__(res, topo)
    res.label = name.split('/')[-1]
    return res


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
    """Define the render scene (build123d-sandbox / ocp_vscode compat).
    The FIRST show() of an evaluation replaces the auto-added scene with
    exactly the shown shapes (so 2-D intermediates no longer leak into the
    viewport and exports); later show()/show_object() calls append.
    # COMPROMISE(show-semantics): ocp_vscode's show() replaces the view on
    # every call (last-wins); appending on subsequent calls preserves the
    # intent of scripts that show several results separately.
    Extra viewer kwargs (names=, colors=, ...) are accepted and ignored.
    Membership is tested with 'is' — Brython compares the underlying JS
    objects, so it works across wrapper instances."""
    if not getattr(w, '_b123dSceneDefined', False):
        while len(w.sceneShapes) > 0:
            w.sceneShapes.pop()
        w._b123dSceneDefined = True
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


def _bowyer_watson(points):
    """Delaunay triangulation of 2-D points (Bowyer-Watson incremental
    insertion). Returns the triangles as index triples into 'points', with
    every triangle touching the enclosing super-triangle discarded — which is
    exactly the set whose circumcentres are qhull's FINITE Voronoi vertices."""
    pts = [(float(p[0]), float(p[1])) for p in points]
    # dedupe: coincident inputs (shared edge endpoints) would make degenerate
    # triangles; qhull merges them too (Qbb Qc)
    seen = {}
    uniq = []
    for p in pts:
        key = (round(p[0], 12), round(p[1], 12))
        if key not in seen:
            seen[key] = True
            uniq.append(p)
    if len(uniq) < 3:
        return [], uniq
    xs = [p[0] for p in uniq]
    ys = [p[1] for p in uniq]
    cx = (min(xs) + max(xs)) / 2.0
    cy = (min(ys) + max(ys)) / 2.0
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    if span <= 0:
        return [], uniq
    big = 1000.0 * span
    verts = list(uniq) + [(cx - big, cy - big), (cx + big, cy - big),
                          (cx, cy + big)]
    n = len(uniq)
    tris = [(n, n + 1, n + 2)]

    def circum(a, b, c):
        ax, ay = verts[a]
        bx, by = verts[b]
        cx2, cy2 = verts[c]
        d = 2.0 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by))
        if abs(d) < 1e-18:
            return None
        a2 = ax * ax + ay * ay
        b2 = bx * bx + by * by
        c2 = cx2 * cx2 + cy2 * cy2
        ux = (a2 * (by - cy2) + b2 * (cy2 - ay) + c2 * (ay - by)) / d
        uy = (a2 * (cx2 - bx) + b2 * (ax - cx2) + c2 * (bx - ax)) / d
        r2 = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)
        return (ux, uy, r2)

    circles = {tris[0]: circum(*tris[0])}
    for i in range(n):
        px, py = verts[i]
        bad = []
        for t in tris:
            cc = circles.get(t)
            if cc is None:
                continue
            dx = px - cc[0]
            dy = py - cc[1]
            # a strictly-inside test with a relative epsilon: points exactly ON
            # a circumcircle (this input is full of cocircular samples) must not
            # flip the triangulation nondeterministically
            if dx * dx + dy * dy < cc[2] * (1.0 - 1e-12):
                bad.append(t)
        if not bad:
            continue
        edge_count = {}
        for t in bad:
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                key = (e[0], e[1]) if e[0] < e[1] else (e[1], e[0])
                edge_count[key] = edge_count.get(key, 0) + 1
        for t in bad:
            tris.remove(t)
            circles.pop(t, None)
        for key in sorted(edge_count.keys()):
            if edge_count[key] != 1:
                continue                       # interior edge of the cavity
            t = (key[0], key[1], i)
            cc = circum(*t)
            if cc is None:
                continue
            tris.append(t)
            circles[t] = cc
    return [t for t in tris if max(t) < n], uniq


class Voronoi:
    """2-D Voronoi diagram (scipy.spatial.Voronoi).

    Only .vertices is produced, because that is the only attribute
    build123d reads (operations_sketch.full_round takes the Voronoi vertices
    as its candidate centres for the largest empty circle). Those vertices are
    the circumcentres of the Delaunay triangulation, computed here with
    Bowyer-Watson instead of qhull (which is not available in the worker) and
    deduplicated the way qhull's 'Qbb Qc' merges cocircular circumcentres.
    Verified against scipy 1.18 on full_round's own inputs: the vertex SETS are
    identical (220 and 210 vertices, max pairwise deviation 2e-13).

    Unbounded ridges have no finite Voronoi vertex and qhull does not list one
    either; they fall out of the construction because every triangle touching
    the super-triangle is discarded. Nothing else about the diagram (ridges,
    regions, point_region) is offered rather than half-offered."""

    def __init__(self, points, *args, **kwargs):
        rows = [list(p) for p in points]
        if not rows or len(rows[0]) != 2:
            raise NotImplementedError(
                'scipy shim: only 2-D Voronoi is supported in build123d-lite '
                '(qhull is not available in the worker)')
        self.points = _IndexRows(_IndexRows(float(c) for c in r) for r in rows)
        self.ndim = 2
        self.npoints = len(rows)
        tris, uniq = _bowyer_watson(rows)
        verts = []
        seen = {}
        for t in tris:
            ax, ay = uniq[t[0]]
            bx, by = uniq[t[1]]
            cx, cy = uniq[t[2]]
            d = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
            if abs(d) < 1e-18:
                continue
            a2 = ax * ax + ay * ay
            b2 = bx * bx + by * by
            c2 = cx * cx + cy * cy
            ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
            uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
            key = (round(ux, 9), round(uy, 9))
            if key in seen:
                continue
            seen[key] = True
            verts.append((ux, uy))
        self.vertices = _IndexRows(_IndexRows(v) for v in verts)

    def __getattr__(self, name):
        if name in ('ridge_points', 'ridge_vertices', 'regions',
                    'point_region', 'furthest_site'):
            raise NotImplementedError(
                'scipy shim: Voronoi.' + name + ' is not available in '
                'build123d-lite (only .vertices is computed)')
        raise AttributeError(name)


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
  pytest: `
# pytest shim: approx() ONLY, implemented for real (pytest's documented
# default tolerances: relative 1e-6, absolute 1e-12, whichever is looser).
# Several build123d doc scripts close with 'assert value == pytest.approx(x)',
# which is a genuine numeric comparison worth honouring; everything else about
# pytest (fixtures, marks, raises, the test runner) is absent, so a script that
# actually wants to run tests fails loudly.


class approx:
    def __init__(self, expected, rel=None, abs=None, nan_ok=False):
        self.expected = expected
        self.rel = 1e-6 if rel is None else rel
        self.abs = 1e-12 if abs is None else abs
        self.nan_ok = nan_ok

    def _close(self, actual, expected):
        tolerance = max(self.abs, self.rel * builtins_abs(expected))
        return builtins_abs(actual - expected) <= tolerance

    def __eq__(self, actual):
        if isinstance(self.expected, (list, tuple)):
            if len(actual) != len(self.expected):
                return False
            return all([self._close(a, e)
                        for a, e in zip(actual, self.expected)])
        if isinstance(self.expected, dict):
            if set(actual.keys()) != set(self.expected.keys()):
                return False
            return all([self._close(actual[k], self.expected[k])
                        for k in self.expected])
        return self._close(actual, self.expected)

    def __ne__(self, actual):
        return not self.__eq__(actual)

    def __repr__(self):
        return 'approx(' + repr(self.expected) + ' +- ' + \\
            repr(max(self.abs, self.rel * builtins_abs(self.expected))) + ')'


builtins_abs = abs


def __getattr__(name):
    raise NotImplementedError(
        'build123d-lite ships only pytest.approx, not ' + repr(name) +
        ' (there is no test runner in the CAD worker)')
`,
  os: `
# os shim: pure PATH ARITHMETIC only (os.path.join/dirname/abspath/... and
# os.getcwd), which is all the build123d docs scripts use it for - they build
# asset paths next to __file__ for SVG/screenshot output. There is no real
# filesystem in the worker, so nothing here touches one: os.path.exists is
# always False and open()/listdir are absent, so a script that genuinely needs
# a file still fails loudly instead of silently doing nothing.
sep = '/'
extsep = '.'
curdir = '.'
pardir = '..'
linesep = '\\n'
name = 'posix'
environ = {}


def getcwd():
    return '/'


def fspath(p):
    return p


class _Path:
    sep = '/'
    extsep = '.'
    curdir = '.'
    pardir = '..'

    @staticmethod
    def join(*parts):
        out = ''
        for p in parts:
            p = str(p)
            if p.startswith('/'):
                out = p
            elif out == '' or out.endswith('/'):
                out = out + p
            else:
                out = out + '/' + p
        return out

    @staticmethod
    def split(p):
        p = str(p)
        i = p.rfind('/')
        if i < 0:
            return ('', p)
        if i == 0:
            return ('/', p[1:])
        return (p[:i], p[i + 1:])

    @staticmethod
    def dirname(p):
        return _Path.split(p)[0]

    @staticmethod
    def basename(p):
        return _Path.split(p)[1]

    @staticmethod
    def splitext(p):
        base = _Path.basename(p)
        i = base.rfind('.')
        if i <= 0:
            return (str(p), '')
        return (str(p)[:len(str(p)) - (len(base) - i)], base[i:])

    @staticmethod
    def isabs(p):
        return str(p).startswith('/')

    @staticmethod
    def normpath(p):
        p = str(p)
        absolute = p.startswith('/')
        out = []
        for part in p.split('/'):
            if part == '' or part == '.':
                continue
            if part == '..':
                if out and out[-1] != '..':
                    out.pop()
                elif not absolute:
                    out.append('..')
                continue
            out.append(part)
        joined = '/'.join(out)
        if absolute:
            return '/' + joined
        return joined if joined else '.'

    @staticmethod
    def abspath(p):
        p = str(p)
        if not p.startswith('/'):
            p = getcwd() + ('' if getcwd().endswith('/') else '/') + p
        return _Path.normpath(p)

    @staticmethod
    def exists(p):
        return False

    @staticmethod
    def isfile(p):
        return False

    @staticmethod
    def isdir(p):
        return False


path = _Path
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
