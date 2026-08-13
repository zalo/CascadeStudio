"""
build123d topology

name: canonical.py
by:   Gumyr
date: (pending)

desc:

Canonical parametrisation of free 1D shapes - the answer to "where would geometry
alone put the start point?".

The seam, direction and parameter range of an edge that came out of an
intersection, section, projection or boolean rather than being drawn are chosen by
the CAD kernel for its own convenience, and depend on the parametric frames of the
surfaces involved, on the seed point of the intersector and on the face order of
the boolean assembler. This module replaces those choices with:

- open shapes start at the lexicographically smaller end point,
- closed shapes start at the lexicographically smallest point of the loop and wind
  counter-clockwise about the dominant axis of their area vector.

It needs nothing but a point-at-arc-length callable, so it applies to an Edge, a
Wire or a polyline.

license:

    Copyright 2026 Gumyr

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

"""

from __future__ import annotations

from math import floor
from typing import Callable, NamedTuple

from build123d.geometry import TOLERANCE, Vector

#: Arc length samples used to find the extremal features of a closed loop.
CANONICAL_SAMPLES = 512

#: Width of the "extremal band" as a fraction of the loop's largest extent.  The
#: seam is the *midpoint* of that band rather than the extremum itself: the
#: location of a smooth minimum is only computable to O(sqrt(eps)) along the
#: curve and moves with the sampling, while the band's ends are transversal
#: crossings (exact) whose midpoint cancels the quadratic term.  It is also the
#: resolution to which the seam is defined.
CANONICAL_BAND = 1e-6

Sampler = Callable[[float], Vector]


class CanonicalForm(NamedTuple):
    """Canonical traversal of a 1D shape: the normalised arc length ``start`` of the
    canonical start point along the shape's own parametrisation (0.0 when open),
    ``sign`` +1 if the shape's own direction is canonical and -1 if not, and whether
    it was treated as ``closed``."""

    start: float
    sign: int
    closed: bool


def _coordinate(point: Vector, index: int) -> float:
    """The index-th coordinate of a Vector."""
    return (point.X, point.Y, point.Z)[index]


def _area_vector(points: list[Vector]) -> Vector:
    """Vector area of a closed polyline, ``1/2 sum (p-c) x (p'-c)``.

    Its direction is the loop's winding axis - exact for planar loops, the least
    squares normal otherwise - and its length is the enclosed area, so it doubles
    as a degeneracy measure.
    """
    count = len(points)
    center = sum(points, Vector(0, 0, 0)) * (1 / count)
    offsets = [point - center for point in points]
    area = Vector(0, 0, 0)
    for index, offset in enumerate(offsets):
        area += offset.cross(offsets[(index + 1) % count])
    return area * 0.5


def _local_minima(values: list[float]) -> list[int]:
    """One representative index per local minimum of a cyclic sample list.

    Plateaus - a straight extremal side - collapse to their middle sample, so the
    candidate count follows the number of features, not the sample count.
    """
    count = len(values)
    if not count or all(value == values[0] for value in values):
        return [0] if count else []
    minima = []
    for index in range(count):
        if values[index] >= values[index - 1]:
            continue  # not a strict descent into index
        end = index
        while values[(end + 1) % count] == values[index] and end - index < count:
            end += 1
        if values[(end + 1) % count] > values[index]:
            minima.append(((index + end) // 2) % count)
    return minima


def _parabolic_minimum(
    values: list[float], index: int, step: float
) -> tuple[float, float]:
    """(location, value) of the minimum through three samples around ``index``.

    Exact for a quadratic, so it removes the sampling phase from the level that
    defines the extremal band - the sampled value alone can sit a long way above
    the true minimum.
    """
    before, here = values[index - 1], values[index]
    after = values[(index + 1) % len(values)]
    curvature = before - 2 * here + after
    if curvature <= 0:
        return index * step, here
    shift = 0.5 * (before - after) / curvature
    return (index + shift) * step, here - 0.5 * curvature * shift**2


def _bisect_level(
    value: Callable[[float], float], inside: float, outside: float, level: float
) -> float:
    """Distance where ``value`` crosses ``level``, bracketed by a point below the
    level and a point above it.  A transversal crossing, hence full precision."""
    low, high = inside, outside
    for _ in range(60):
        middle = 0.5 * (low + high)
        low, high = (middle, high) if value(middle) <= level else (low, middle)
    return 0.5 * (low + high)


def _band_midpoint(
    value: Callable[[float], float],
    inside: float,
    level: float,
    step: float,
    samples: int,
    length: float,
) -> float:
    """Arc length midpoint of the ``value <= level`` band containing ``inside``.

    Independent of where the samples fell, which is what makes the seam
    independent of the incoming parametrisation.
    """
    backward = forward = inside
    for _ in range(samples):
        if value(backward - step) > level:
            break
        backward -= step
    for _ in range(samples):
        if value(forward + step) > level:
            break
        forward += step
    start = _bisect_level(value, backward, backward - step, level)
    end = _bisect_level(value, forward, forward + step, level)
    return (start + 0.5 * ((end - start) % length)) % length


def canonical_form(
    sampler: Sampler,
    length: float,
    closed: bool,
    samples: int = CANONICAL_SAMPLES,
    band: float = CANONICAL_BAND,
) -> CanonicalForm:
    """Canonical traversal of a curve given an arc length sampler.

    Args:
        sampler (Sampler): ``sampler(distance) -> Vector``, distance in [0, length].
        length (float): arc length of the curve.
        closed (bool): whether ``sampler(0) == sampler(length)``.
        samples (int, optional): samples used to find extremal features.
            Defaults to CANONICAL_SAMPLES.
        band (float, optional): extremal band width, relative to the loop's
            largest extent. Defaults to CANONICAL_BAND.

    Returns:
        CanonicalForm: canonical start position and direction.
    """
    if length <= TOLERANCE:
        return CanonicalForm(0.0, 1, closed)

    if not closed:
        start, end = sampler(0.0), sampler(length)
        forward = (start.X, start.Y, start.Z) <= (end.X, end.Y, end.Z)
        return CanonicalForm(0.0, 1 if forward else -1, False)

    step = length / samples
    points = [sampler(index * step) for index in range(samples)]

    # wind counter-clockwise about the dominant winding axis, preferring X then
    # Y then Z where two are exactly equal (no rule can do better there)
    area = _area_vector(points)
    dominant = max(range(3), key=lambda index: abs(_coordinate(area, index)))
    sign = -1 if _coordinate(area, dominant) < -(TOLERANCE**2) else 1

    extent = max(
        max(_coordinate(p, i) for p in points) - min(_coordinate(p, i) for p in points)
        for i in range(3)
    )
    tolerance = max(band * max(extent, TOLERANCE), TOLERANCE * 1e-3)

    for axis in range(3):

        def value(distance: float, axis: int = axis) -> float:
            return _coordinate(sampler(distance % length), axis)

        values = [_coordinate(point, axis) for point in points]
        # every local minimum is a candidate feature; its *value* refines well
        # (its location does not), which is what the band level needs
        features = [_parabolic_minimum(values, index, step) for index in _local_minima(values)]
        if not features:
            continue
        level = min(minimum for _, minimum in features) + tolerance
        if all(sample <= level for sample in values):
            continue  # flat in this coordinate: fall through to the next

        # Rank the candidate bands by their own midpoints in the remaining
        # coordinates, quantised to the band width: comparing the samples inside
        # a band would depend on the sampling phase, and comparing raw floats
        # would let the last bits of a mirror symmetric pair pick the winner
        # instead of letting the next coordinate decide.
        others = [other for other in range(3) if other != axis]
        candidates = []
        for location, minimum in features:
            if minimum > level or value(location) > level:
                continue
            middle = _band_midpoint(value, location, level, step, samples, length)
            point = sampler(middle)
            key = tuple(floor(_coordinate(point, o) / tolerance + 0.5) for o in others)
            candidates.append((key, middle))
        if candidates:
            # a surviving tie means the loop is symmetric about this band to
            # within tolerance, where the choice is arbitrary by definition
            return CanonicalForm(min(candidates)[1] / length, sign, True)

    return CanonicalForm(0.0, sign, True)  # degenerate: every coordinate is flat
