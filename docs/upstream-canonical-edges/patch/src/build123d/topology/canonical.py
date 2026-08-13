"""
build123d canonical free-edge parametrisation

name: canonical.py
by:   Gumyr
date: (pending)

desc:
    Free edges and wires - the ones that come out of intersections, sections,
    projections and boolean operations rather than being drawn by the user -
    carry a start point ("seam"), a traversal direction and a parameter range
    that the CAD kernel picked for its own convenience.  Those choices are
    *implementation defined*: they depend on the parametric frames of the
    surfaces that produced the curve (which meridian is ``u = 0``), on the
    seed point of the surface/surface walking algorithm and on the order in
    which the boolean assembler happened to visit the faces of the result.

    Two solids that are geometrically identical - a sphere and the same sphere
    rotated about its own axis, say - therefore produce section edges with
    different seams and different directions, and anything measured from
    ``position_at(0)`` or ``Axis(edge)`` silently moves with them.

    This module defines a *canonical form* for a 1D shape that is computed from
    geometry alone (no kernel internals) so that identical geometry always
    yields identical measurements:

    * **open** shapes are traversed from the lexicographically smaller of their
      two end points,
    * **closed** shapes start at the lexicographically smallest point of the
      loop and wind counter-clockwise about the dominant axis of their area
      vector,
    * positions are measured as normalised arc length, which is what
      ``Mixin1D.position_at`` already does.

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

from typing import Callable, Iterable, NamedTuple

from build123d.geometry import TOLERANCE, Vector

#: Number of arc length samples used to search for the canonical seam.  The
#: search resolves near-extremal arcs down to ``length / (SAMPLES / 2)``.
CANONICAL_SAMPLES = 512

#: Relative size of the "lexicographically extremal" band, as a fraction of the
#: bounding box diagonal of the loop.  Making the band a finite width (instead
#: of hunting for the extremum itself) is what makes the seam well conditioned:
#: the band edges are transversal crossings, so they are located to full
#: precision, and the midpoint of the band cancels the leading curvature term.
CANONICAL_BAND = 1e-6

Sampler = Callable[[float], Vector]


class CanonicalForm(NamedTuple):
    """Canonical traversal of a 1D shape.

    Args:
        start (float): arc length distance, measured along the shape's current
            (orientation aware) parametrisation, of the canonical start point.
            Always ``0.0`` for open shapes.
        sign (int): ``+1`` if the shape's current direction is canonical,
            ``-1`` if it must be traversed backwards.
        closed (bool): whether the shape was treated as a closed loop.
    """

    start: float
    sign: int
    closed: bool

    def position(self, position: float) -> float:
        """Map a canonical normalised position to the shape's own normalised
        position, so that ``shape.position_at(form.position(u))`` walks the
        shape canonically."""
        if self.closed:
            return (self.start + self.sign * position) % 1.0
        return position if self.sign > 0 else 1.0 - position


# ---------------------------------------------------------------------------
# pure geometry helpers - these take a sampler so that they can be used with
# anything that can be evaluated by arc length (and unit tested with polylines)
# ---------------------------------------------------------------------------
def _coordinate(point: Vector, index: int) -> float:
    """The ``index``-th coordinate of a Vector."""
    return (point.X, point.Y, point.Z)[index]


def lexicographic_key(point: Vector | Iterable[float]) -> tuple[float, float, float]:
    """The (x, y, z) sort key used by every canonical comparison."""
    if isinstance(point, Vector):
        return (point.X, point.Y, point.Z)
    x, y, z = point
    return (x, y, z)


def loop_area_vector(points: list[Vector]) -> Vector:
    """Vector area (Newell) of a closed polyline: ``½ Σ (pᵢ-c) × (pᵢ₊₁-c)``.

    Its direction is the loop's winding axis (exact for planar loops, the
    least-squares normal for non planar ones) and its length is the enclosed
    area, so it doubles as a degeneracy measure.
    """
    count = len(points)
    center = Vector(
        sum(p.X for p in points) / count,
        sum(p.Y for p in points) / count,
        sum(p.Z for p in points) / count,
    )
    area = Vector(0, 0, 0)
    for i in range(count):
        first = points[i] - center
        second = points[(i + 1) % count] - center
        area += first.cross(second)
    return area * 0.5


def _dominant_axis(area: Vector) -> int:
    """Index of the axis the loop winds about, preferring X, then Y, then Z on
    exact ties (a tie means the loop's plane bisects two axes, where no
    geometric rule can do better than a documented convention)."""
    magnitudes = (abs(area.X), abs(area.Y), abs(area.Z))
    best = 0
    for index in (1, 2):
        if magnitudes[index] > magnitudes[best]:
            best = index
    return best


def _cyclic_runs(flags: list[bool]) -> list[tuple[int, int]]:
    """Maximal cyclic runs of ``True`` as (start_index, count) pairs."""
    count = len(flags)
    if all(flags):
        return [(0, count)]
    runs: list[tuple[int, int]] = []
    for index in range(count):
        if flags[index] and not flags[index - 1]:
            length = 1
            while flags[(index + length) % count]:
                length += 1
            runs.append((index, length))
    return runs


def _golden_min(
    function: Callable[[float], float], low: float, high: float, iterations: int = 40
) -> tuple[float, float]:
    """(location, value) of the minimum of a unimodal ``function`` on
    ``[low, high]``.

    The *value* of a smooth minimum is well conditioned; its location is not
    (an error ``δ`` in the location only changes the value by ``O(δ²)``), so the
    location is used as nothing more than a seed for the band search below.
    """
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


def _bisect_level(
    function: Callable[[float], float], inside: float, outside: float, level: float
) -> float:
    """Distance where ``function`` crosses ``level``, bracketed by a point
    below the level and a point above it.  A transversal crossing, hence full
    precision."""
    low, high = inside, outside
    for _ in range(60):
        mid = 0.5 * (low + high)
        if function(mid) <= level:
            low = mid
        else:
            high = mid
    return 0.5 * (low + high)


def canonical_form(
    sampler: Sampler,
    length: float,
    closed: bool,
    samples: int = CANONICAL_SAMPLES,
    band: float = CANONICAL_BAND,
) -> CanonicalForm:
    """Canonical traversal of a curve given an arc length sampler.

    Args:
        sampler: ``sampler(distance) -> Vector``, ``distance`` in ``[0, length]``.
        length: total arc length.
        closed: whether ``sampler(0) == sampler(length)``.
        samples: number of arc length samples used for the seam search.
        band: width of the extremal band relative to the bounding box diagonal.

    Returns:
        CanonicalForm: canonical start distance and direction.
    """
    if length <= TOLERANCE:
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
    if abs(_coordinate(area, axis)) > TOLERANCE**2:
        sign = 1 if _coordinate(area, axis) > 0 else -1

    # ---- seam: midpoint of the lexicographically extremal band
    diagonal = max(
        max(_coordinate(p, i) for p in points) - min(_coordinate(p, i) for p in points)
        for i in range(3)
    )
    tolerance_band = max(band * max(diagonal, TOLERANCE), TOLERANCE * 1e-3)

    seam = 0.0
    for coordinate in (0, 1, 2):

        def value(distance: float, coordinate: int = coordinate) -> float:
            return _coordinate(sampler(distance % length), coordinate)

        values = [_coordinate(p, coordinate) for p in points]
        index = min(range(samples), key=lambda i: values[i])
        # the value of the minimum, refined so that the band below does not
        # depend on the (kernel supplied) phase of the sampling
        seed, minimum = _golden_min(value, (index - 1) * step, (index + 1) * step)
        if values[index] < minimum:
            seed, minimum = index * step, values[index]
        level = minimum + tolerance_band

        inside = [sample_value <= level for sample_value in values]
        if all(inside):
            continue  # loop is flat in this coordinate: fall through to the next

        # Candidate bands: the sampled runs, plus the refined minimum itself in
        # case the band is narrower than the sampling step.
        others = [other for other in (0, 1, 2) if other != coordinate]
        candidates: list[tuple[tuple[float, ...], float]] = []
        for start, count in _cyclic_runs(inside):
            members = [points[(start + offset) % samples] for offset in range(count)]
            key = tuple(
                min(_coordinate(member, other) for member in members) for other in others
            )
            candidates.append((key, start * step))
        seed_point = sampler(seed % length)
        candidates.append(
            (tuple(_coordinate(seed_point, other) for other in others), seed)
        )

        # A surviving tie means the loop is exactly symmetric, where no
        # geometric rule can choose - the first candidate in traversal order
        # wins, which is stable for a given input.
        _, inside_distance = min(candidates, key=lambda candidate: candidate[0])
        if value(inside_distance) > level:  # sampled run start just outside
            inside_distance = seed

        # Walk out to the first sample outside the band, then bisect: the band
        # edges are transversal crossings, so they are found to full precision,
        # and their midpoint cancels the leading curvature term of the extremum.
        backward = inside_distance
        for _ in range(samples):
            if value(backward - step) > level:
                break
            backward -= step
        forward = inside_distance
        for _ in range(samples):
            if value(forward + step) > level:
                break
            forward += step
        band_start = _bisect_level(value, backward, backward - step, level)
        band_end = _bisect_level(value, forward, forward + step, level)
        span = (band_end - band_start) % length
        seam = (band_start + 0.5 * span) % length
        break

    return CanonicalForm(seam / length, sign, True)
