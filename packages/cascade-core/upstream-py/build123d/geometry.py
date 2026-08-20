# build123d.geometry — the SEAM module for running upstream build123d Level-A
# source over build123d-lite's classes (`?pyruntime=micropython&pysrc=upstream`).
#
# Upstream's geometry.py is numpy-heavy and is REPLACED by this module: it
# re-exports lite's pure-Python Vector/Location/Plane/Axis/... under
# upstream's names and adds the handful of module-level helpers upstream
# Level-A imports from build123d.geometry. Every adaptation is recorded in
# experiments/upstream-on-micropython/INVENTORY.md.
import math
import logging

import build123d_lite as _lt

# ---- direct re-exports (lite classes ARE the geometry layer) -------------
Vector = _lt.Vector
Location = _lt.Location
Plane = _lt.Plane
Axis = _lt.Axis
Pos = _lt.Pos
Rot = _lt.Rot
Rotation = _lt.Rotation
Matrix = _lt.Matrix
BoundBox = _lt.BoundBox
OrientedBoundBox = _lt.OrientedBoundBox
Color = _lt.Color
VectorLike = _lt.VectorLike        # = tuple (annotation-only upstream)
RotationLike = _lt.RotationLike    # = tuple (annotation-only upstream)
ColorLike = tuple

# ---- constants upstream code imports from geometry ------------------------
TOLERANCE = 1e-6
TOL_DIGITS = 6
DEG2RAD = math.pi / 180.0
RAD2DEG = 180.0 / math.pi

logger = logging.getLogger('build123d')

from build123d.build_enums import Align  # registered before this module


class NotAllLocationLikeError(TypeError):
    """Raised when an iterable contains objects that cannot be converted to
    Locations."""

    def __init__(self, wrong_types):
        names = sorted(set(t.__name__ for t in wrong_types))
        super().__init__(', '.join(names))


def all_location_like(items):
    """The items as a list unless any of them is not a Location | Plane."""
    items = list(items)
    wrong = set(type(item) for item in items
                if not isinstance(item, (Location, Plane)))
    if wrong:
        raise NotAllLocationLikeError(wrong)
    return items


def to_align_offset(min_point, max_point, align, center=None):
    """Amount to move an object to achieve the desired alignment.

    Ported from upstream geometry.to_align_offset. One deliberate change:
    upstream maps items through `Align(...)` (Enum value lookup); the
    metaclass-free enum shim cannot intercept class calls, so members are
    used directly (the arguments always ARE members in Level-A call sites).
    """
    if center is None:
        center = (Vector(min_point) + Vector(max_point)) / 2

    if align is None or align is Align.NONE:
        return Vector(0, 0, 0)
    if align is Align.MIN:
        return -Vector(min_point)
    if align is Align.MAX:
        return -Vector(max_point)
    if align is Align.CENTER:
        return -Vector(center)

    align_offset = []
    for alignment, min_coord, max_coord, center_coord in zip(
            align, tuple(Vector(min_point)), tuple(Vector(max_point)),
            tuple(Vector(center))):
        if alignment is Align.MIN:
            align_offset.append(-min_coord)
        elif alignment is Align.CENTER:
            align_offset.append(-center_coord)
        elif alignment is Align.MAX:
            align_offset.append(-max_coord)
        else:  # Align.NONE or None
            align_offset.append(0)
    return Vector(*align_offset)


# ---- additive patches on lite classes (upstream call-surface gaps) --------
# Each is an INVENTORY.md entry. Patches are additive: they only ADD methods
# lite never defined (or, for __eq__, defines identically-shaped semantics),
# so lite's own modes are unaffected even though the classes are shared.

# (Vector.add/.sub are lite-native now and lite's __add__/__sub__ route
#  through them, so build_common's workplane-relative-tuple monkeypatch works
#  EXACTLY as upstream — B14 is closed.)


def _location_eq(self, other):
    if not isinstance(other, Location):
        return NotImplemented
    if self._t != other._t:
        # tolerant compare (translation tuples are floats)
        for a, b in zip(self._t, other._t):
            if abs(a - b) > 1e-12:
                return False
    for ra, rb in zip(self._R, other._R):
        for a, b in zip(ra, rb):
            if abs(a - b) > 1e-12:
                return False
    return True


if '__eq__' not in Location.__dict__:
    # BasePartObject compares `rotate != Rotation()` / `location != Location()`
    Location.__eq__ = _location_eq


def _bbox_to_align_offset(self, align):
    return to_align_offset(self.min, self.max, align)


if not hasattr(BoundBox, 'to_align_offset'):
    BoundBox.to_align_offset = _bbox_to_align_offset


# upstream Plane.from/to_local_coords also accept SHAPES (BuildSketch's
# .sketch property, BuildPart's pending-face globalization); lite's handle
# points only. Superset wrappers: Shape -> rigid transform by the plane's
# location, everything else -> lite's point math.
_orig_from_local = Plane.from_local_coords
_orig_to_local = Plane.to_local_coords


def _keep_shape_class(obj, moved):
    # lite's _wrap_like re-wraps a transformed Face as a Sketch (transforms
    # produce sketches in lite's model); the upstream seam needs the class
    # preserved (BuildPart's pending_faces filters isinstance(o, Face))
    if isinstance(obj, _lt.Face) and not isinstance(moved, _lt.Face):
        return _lt.Face(moved.topo)
    if isinstance(obj, _lt.Vertex) and not isinstance(moved, _lt.Vertex):
        return _lt.Vertex(moved.topo)
    return moved


def _plane_from_local_coords(self, obj):
    if isinstance(obj, _lt.Shape):
        return _keep_shape_class(obj, self.location * obj)
    return _orig_from_local(self, obj)


def _plane_to_local_coords(self, obj):
    if isinstance(obj, _lt.Shape):
        return _keep_shape_class(obj, self.location.inverse() * obj)
    return _orig_to_local(self, obj)


if Plane.from_local_coords is _orig_from_local:
    Plane.from_local_coords = _plane_from_local_coords
    Plane.to_local_coords = _plane_to_local_coords


def _vector_get_angle(self, v):
    """upstream Vector.get_angle: UNSIGNED angle to another vector, degrees."""
    b = Vector(v)
    denom = self.length * b.length
    if denom < 1e-30:
        return 0.0
    d = max(-1.0, min(1.0, self.dot(b) / denom))
    return math.degrees(math.acos(d))


if not hasattr(Vector, 'get_angle'):
    Vector.get_angle = _vector_get_angle


class _CsPlaneTransform:
    """Stand-in for upstream Plane.forward_transform/reverse_transform (gp_Trsf
    wrapped in Matrix): Level-A only ever feeds these to Vector.transform, so
    a (plane, direction-of-mapping) pair carries everything needed."""

    def __init__(self, plane, to_world):
        self.plane = plane
        self.to_world = to_world


def _plane_forward_transform(self):
    return _CsPlaneTransform(self, False)   # world -> plane-local


def _plane_reverse_transform(self):
    return _CsPlaneTransform(self, True)    # plane-local -> world


if not hasattr(Plane, 'forward_transform'):
    Plane.forward_transform = property(_plane_forward_transform)
    Plane.reverse_transform = property(_plane_reverse_transform)


def _vector_transform(self, tm, is_direction=False):
    """upstream Vector.transform(Matrix, is_direction=) — implemented for the
    plane transforms Level-A passes (objects_curve localizes DIRECTIONS with
    workplane.reverse_transform)."""
    if isinstance(tm, _CsPlaneTransform):
        pl = tm.plane
        if tm.to_world:
            out = (pl.x_dir * self.X + pl.y_dir * self.Y + pl.z_dir * self.Z)
            if not is_direction:
                out = out + pl.origin
            return out
        d = self if is_direction else (self - pl.origin)
        return Vector(d.dot(pl.x_dir), d.dot(pl.y_dir), d.dot(pl.z_dir))
    raise NotImplementedError(
        'Vector.transform supports plane forward/reverse transforms only in '
        'build123d-lite')


if not hasattr(Vector, 'transform'):
    Vector.transform = _vector_transform


def _bbox_add(self, other):
    """BoundBox.add(point-or-bbox) — upstream returns an ENLARGED copy."""
    pts = [tuple(self.min), tuple(self.max)]
    if isinstance(other, BoundBox):
        pts.append(tuple(other.min))
        pts.append(tuple(other.max))
    else:
        pts.append(tuple(Vector(other)))
    mins = [min(p[i] for p in pts) for i in range(3)]
    maxs = [max(p[i] for p in pts) for i in range(3)]
    return BoundBox([mins[0], mins[1], mins[2], maxs[0], maxs[1], maxs[2]])


if not hasattr(BoundBox, 'add'):
    BoundBox.add = _bbox_add
