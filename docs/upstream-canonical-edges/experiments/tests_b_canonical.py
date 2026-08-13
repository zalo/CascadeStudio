"""
build123d imports

name: test_canonical.py
by:   Gumyr
date: (pending)

desc:
    This python module contains tests for the build123d project.

license:

    Copyright 2026 Gumyr

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

"""

from functools import lru_cache

import pytest
from OCP.TopoDS import TopoDS

from build123d import *
from build123d.geometry import TOLERANCE
from build123d.topology.canonical import CANONICAL_BAND, canonical_form
from build123d.topology.one_d import edges_to_wires

RECTANGLE = Wire(Face.make_rect(20, 10).outer_wire())


def approx(shape, position):
    return pytest.approx(tuple(shape.position_at(position)), abs=1e-4)


@lru_cache(maxsize=None)
def section_loop(sphere_rotation: float = 0.0) -> Wire:
    """A closed sphere/cylinder intersection loop, reassembled into a Wire.

    Rotating the sphere about its own axis is the identical solid, but it moves
    the sphere's u = 0 meridian - so the loop arrives as 1, 2 or 4 Edges starting
    in different places.
    """
    sphere = Solid.make_sphere(10)
    if sphere_rotation:
        sphere = sphere.rotate(Axis.Z, sphere_rotation)
    cutter = Solid.make_cylinder(5, 40, Plane.XY.offset(-20)).locate(
        Location((6, 0, 0))
    )
    loop = [e for e in sphere.cut(cutter).edges() if e.geom_type == GeomType.BSPLINE]
    return max(edges_to_wires(loop), key=lambda wire: wire.length)


@lru_cache(maxsize=None)
def arch_path(sphere_rotation: float = 0.0) -> Edge:
    """The text path of examples/projection.py, as a single closed Edge."""
    sphere = Solid.make_sphere(50)
    if sphere_rotation:
        sphere = sphere.rotate(Axis.Z, sphere_rotation)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))
    return sphere.cut(cutter).edges().sort_by(Axis.Z)[0]


def test_rule_needs_nothing_but_a_sampler():
    """canonical_form() only asks for the point at an arc length, so the rule can
    be checked - here against a hand computed square - without a CAD kernel."""
    corners = [Vector(-1, -1, 0), Vector(1, -1, 0), Vector(1, 1, 0), Vector(-1, 1, 0)]

    def sampler(distance: float) -> Vector:
        distance %= 8.0
        index, local = int(distance // 2), (distance % 2) / 2
        start, end = corners[index], corners[(index + 1) % 4]
        return start + (end - start) * local

    form = canonical_form(sampler, 8.0, closed=True)
    assert form.sign == 1  # counter-clockwise about +Z
    # the x = -1 side is extremal, so the seam is the middle of it
    assert tuple(sampler(form.start * 8.0)) == pytest.approx((-1, 0, 0), abs=1e-4)


@pytest.mark.parametrize(
    "edge",
    [
        Edge.make_line((0, 0, 0), (10, 0, 0)),
        Edge.make_line((10, 0, 0), (0, 0, 0)),
        Edge.make_line((0, 0, 0), (10, 0, 0)).reversed(),
    ],
    ids=["forward", "built backwards", "reversed flag"],
)
def test_open_shape_starts_at_the_smaller_end(edge):
    canonical = edge.canonical()
    assert approx(canonical, 0) == (0, 0, 0)
    assert tuple(canonical.tangent_at(0)) == pytest.approx((1, 0, 0), abs=1e-6)


@pytest.mark.parametrize(
    "shape, seam, quarter",
    [
        (Edge.make_circle(10), (-10, 0, 0), (0, -10, 0)),
        (Edge.make_circle(10).reversed(), (-10, 0, 0), (0, -10, 0)),
        (Edge.make_circle(10, Plane.XZ), (-10, 0, 0), (0, 0, 10)),
        (Edge.make_circle(10, Plane.YZ), (0, -10, 0), (0, 0, -10)),
        (RECTANGLE, (-10, 0, 0), (0, -5, 0)),
        (Wire(TopoDS.Wire_s(RECTANGLE.wrapped.Reversed())), (-10, 0, 0), (0, -5, 0)),
    ],
    ids=["circle", "circle reversed", "circle XZ", "circle YZ", "rect", "rect reversed"],
)
def test_closed_shape_seam_and_winding(shape, seam, quarter):
    """The seam is the lexicographically smallest point - the middle of the
    extremal side where that side is straight - and the winding is
    counter-clockwise about the dominant axis of the area vector."""
    canonical = shape.canonical()
    assert approx(canonical, 0) == seam
    assert approx(canonical, 0.25) == quarter
    assert canonical.length == pytest.approx(shape.length, abs=1e-6)


@pytest.mark.parametrize(
    "shape",
    [Edge.make_circle(7, Plane.XZ), Edge.make_line((3, 2, 1), (-1, 0, 4)), RECTANGLE],
    ids=["circle", "line", "rect"],
)
def test_canonical_is_idempotent(shape):
    once = shape.canonical()
    for position in (0.0, 0.3):
        assert approx(once.canonical(), position) == tuple(once.position_at(position))


def test_canonical_form_of_a_degenerate_shape():
    assert Edge.make_line((0, 0, 0), (10, 0, 0)).canonical_form() == (0.0, 1, False)


@pytest.mark.parametrize(
    "shape",
    [section_loop(0).canonical(), Edge.make_circle(10).canonical(), RECTANGLE.canonical()],
    ids=["section loop", "circle", "rect"],
)
def test_seam_already_at_the_start_is_not_reseamed(shape):
    """A shape whose seam is its own start point comes back untouched.

    Regression: the test used to compare ``form.start`` to a tolerance without
    wrapping it, so a band midpoint landing an epsilon *below* 1.0 - the same
    point as one above 0.0 - took the re-seam path.
    """
    start = shape.canonical_form().start % 1.0
    size = shape.bounding_box().size
    resolution = max(TOLERANCE, CANONICAL_BAND * max(size.X, size.Y, size.Z))
    assert min(start, 1.0 - start) * shape.length <= resolution
    assert shape.canonical() is shape


def test_reseamed_loop_leaves_the_seam_forwards():
    """Regression: the pieces of a re-seamed loop were ordered by raw end point
    distance before the tangent.  Both pieces meet the seam at one vertex, so the
    distances are floating point noise and the loop could be walked backwards."""
    loop = section_loop(45)
    form = loop.canonical_form()
    expected = loop.tangent_at(form.start) * form.sign
    assert tuple(loop.canonical().tangent_at(0)) == pytest.approx(
        tuple(expected), abs=1e-4
    )


@pytest.mark.parametrize("rotation", [0, 45, 90])
def test_reversed_wire_canonicalizes_the_same_way(rotation):
    """A Wire and the same Wire reversed must canonicalize identically."""
    wire = section_loop(rotation)
    reversed_wire = Wire(TopoDS.Wire_s(wire.wrapped.Reversed()))
    forward, backward = wire.canonical(), reversed_wire.canonical()
    for position in (0.0, 0.25, 0.5, 0.75):
        assert approx(backward, position) == tuple(forward.position_at(position))


@pytest.mark.parametrize("rotation", [37, 90, 180, 270])
def test_seam_does_not_depend_on_the_frame_or_the_sampling(rotation):
    """Every frame of the same locus has to agree, including the frames where the
    loop arrives as a different number of Edges.

    Regression: the extremal bands were found by thresholding samples and ranked
    by the minima of whichever samples fell inside them, so the mirror symmetric
    pair of bands on this loop resolved differently in different frames.
    """
    reference = section_loop(0).canonical()
    for shape in (
        section_loop(rotation),
        Wire(TopoDS.Wire_s(section_loop(rotation).wrapped.Reversed())),
    ):
        canonical = shape.canonical()
        assert canonical.length == pytest.approx(reference.length, abs=1e-4)
        for position in (0.0, 0.25, 0.5):
            assert approx(canonical, position) == tuple(
                reference.position_at(position)
            )


@pytest.mark.parametrize(
    "rotation, raw_seam",
    [(0, (48.9898, 0, 10)), (180, (-48.9898, 0, 10))],
)
def test_free_edge_seam_follows_the_surface_frame(rotation, raw_seam):
    """The problem, for the record: rotating the sphere about its own axis is the
    identical solid, but the section edge starts somewhere else entirely."""
    assert tuple(arch_path(rotation).position_at(0)) == pytest.approx(raw_seam, abs=1e-3)


@pytest.mark.parametrize("rotation", [45, 90, 180, 270])
def test_canonical_free_edge_ignores_the_surface_frame(rotation):
    reference = arch_path(0).canonical()
    canonical = arch_path(rotation).canonical()
    assert canonical.length == pytest.approx(reference.length, abs=1e-3)
    for position in (0.0, 0.25, 0.5, 0.75):
        assert approx(canonical, position) == tuple(reference.position_at(position))
