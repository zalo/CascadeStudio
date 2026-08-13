"""
build123d canonical free-edge tests

name: test_canonical.py
by:   Gumyr
date: (pending)

desc: Tests for Mixin1D.canonical / canonical_form, Axis(edge, canonical=True),
      the deterministic tie break in ShapeList.sort_by and the kernel
      independence they buy.

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

import unittest

from build123d.build_enums import GeomType, Mode
from build123d.build_part import BuildPart
from build123d.build_sketch import BuildSketch
from build123d.geometry import TOLERANCE, Axis, Location, Plane, Vector
from build123d.objects_part import Cylinder
from build123d.objects_sketch import Rectangle
from build123d.operations_part import extrude
from build123d.topology import Edge, Face, ShapeList, Solid, Wire
from build123d.topology.one_d import edges_to_wires
from OCP.TopoDS import TopoDS

from build123d.topology.canonical import (
    CANONICAL_BAND,
    canonical_form,
    lexicographic_key,
    loop_area_vector,
)


class DirectApiTestCase(unittest.TestCase):
    def assertTupleAlmostEquals(self, first, second, places, msg=None):
        """Check Tuples"""
        self.assertEqual(len(second), len(first))
        for i, j in zip(second, first):
            self.assertAlmostEqual(i, j, places, msg=msg)


class TestCanonicalGeometry(DirectApiTestCase):
    """The rule itself, on inputs that need no CAD kernel"""

    def test_lexicographic_key(self):
        self.assertLess(lexicographic_key(Vector(-1, 5, 5)), lexicographic_key(Vector(0, 0, 0)))
        self.assertLess(lexicographic_key(Vector(0, -1, 9)), lexicographic_key(Vector(0, 0, 0)))
        self.assertLess(lexicographic_key(Vector(0, 0, -1)), lexicographic_key(Vector(0, 0, 0)))

    def test_loop_area_vector(self):
        square = [Vector(0, 0, 0), Vector(1, 0, 0), Vector(1, 1, 0), Vector(0, 1, 0)]
        self.assertTupleAlmostEquals(tuple(loop_area_vector(square)), (0, 0, 1), 6)
        self.assertTupleAlmostEquals(tuple(loop_area_vector(square[::-1])), (0, 0, -1), 6)

    def test_polyline_sampler(self):
        """canonical_form() only needs "the point at arc length d", so it can be
        driven by a polyline - which is how the rule is checked against a
        second CAD kernel."""
        corners = [Vector(-1, -1, 0), Vector(1, -1, 0), Vector(1, 1, 0), Vector(-1, 1, 0)]
        perimeter = 8.0

        def sampler(distance: float) -> Vector:
            distance %= perimeter
            index = int(distance // 2)
            local = (distance - 2 * index) / 2
            start, end = corners[index], corners[(index + 1) % 4]
            return start + (end - start) * local

        form = canonical_form(sampler, perimeter, closed=True)
        # counter clockwise about +Z, seam at the middle of the x = -1 side
        self.assertEqual(form.sign, 1)
        self.assertTupleAlmostEquals(tuple(sampler(form.start * perimeter)), (-1, 0, 0), 4)


class TestCanonicalShapes(DirectApiTestCase):
    """Mixin1D.canonical() / canonical_form()"""

    def test_open_edge_starts_at_smaller_end(self):
        forward = Edge.make_line((0, 0, 0), (10, 0, 0))
        backward = Edge.make_line((10, 0, 0), (0, 0, 0))
        flagged = forward.reversed()
        for edge in (forward, backward, flagged):
            canonical = edge.canonical()
            self.assertTupleAlmostEquals(tuple(canonical.position_at(0)), (0, 0, 0), 6)
            self.assertTupleAlmostEquals(tuple(canonical.tangent_at(0)), (1, 0, 0), 6)

    def test_closed_edge_seam_and_winding(self):
        circle = Edge.make_circle(10)
        for shape in (circle, circle.reversed()):
            canonical = shape.canonical()
            self.assertTupleAlmostEquals(tuple(canonical.position_at(0)), (-10, 0, 0), 4)
            # counter clockwise about +Z
            self.assertTupleAlmostEquals(tuple(canonical.position_at(0.25)), (0, -10, 0), 4)
            self.assertAlmostEqual(canonical.length, circle.length, 6)

    def test_closed_wire_flat_band_midpoint(self):
        """A straight extremal side has no unique lexicographic minimum, so the
        seam is the middle of the band - which also has a defined tangent."""
        rectangle = Wire(Face.make_rect(20, 10).outer_wire())
        canonical = rectangle.canonical()
        self.assertTupleAlmostEquals(tuple(canonical.position_at(0)), (-10, 0, 0), 6)
        self.assertTupleAlmostEquals(tuple(canonical.tangent_at(0)), (0, -1, 0), 6)
        self.assertAlmostEqual(canonical.length, 60, 6)

    def test_canonical_is_idempotent(self):
        for shape in (
            Edge.make_circle(7, Plane.XZ),
            Edge.make_line((3, 2, 1), (-1, 0, 4)),
            Wire(Face.make_rect(6, 4).outer_wire()),
        ):
            once = shape.canonical()
            twice = once.canonical()
            self.assertTupleAlmostEquals(tuple(twice.position_at(0)), tuple(once.position_at(0)), 5)
            self.assertTupleAlmostEquals(tuple(twice.position_at(0.3)), tuple(once.position_at(0.3)), 5)

    def test_canonical_form_of_empty_length(self):
        form = Edge.make_line((0, 0, 0), (10, 0, 0)).canonical_form()
        self.assertEqual(form, (0.0, 1, False))


class TestKernelIndependence(DirectApiTestCase):
    """The bug this is all for: results must not depend on the parametric frames
    of the solids that produced a free edge."""

    @staticmethod
    def arch_path(sphere_rotation: float) -> Edge:
        """examples/projection.py's arch path.  Rotating a sphere about its own
        axis yields the geometrically identical solid, but moves the sphere's
        u = 0 seam meridian - and with it the seam of the section edge."""
        sphere = Solid.make_sphere(50)
        if sphere_rotation:
            sphere = sphere.rotate(Axis.Z, sphere_rotation)
        cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))
        return sphere.cut(cutter).edges().sort_by(Axis.Z)[0]

    def test_section_edge_seam_is_frame_dependent(self):
        """Documents the problem: the raw seam follows the sphere's meridian."""
        self.assertTupleAlmostEquals(tuple(self.arch_path(0).position_at(0)), (48.9898, 0, 10), 3)
        self.assertTupleAlmostEquals(tuple(self.arch_path(180).position_at(0)), (-48.9898, 0, 10), 3)

    def test_canonical_section_edge_is_frame_independent(self):
        reference = self.arch_path(0).canonical()
        for rotation in (45, 90, 180, 270):
            canonical = self.arch_path(rotation).canonical()
            self.assertAlmostEqual(canonical.length, reference.length, 4)
            for position in (0.0, 0.25, 0.5, 0.75):
                self.assertTupleAlmostEquals(tuple(canonical.position_at(position)), tuple(reference.position_at(position)), 3, )

    @staticmethod
    def section_loop(sphere_rotation: float = 0.0) -> Wire:
        """A closed sphere/cylinder intersection loop, reassembled into a Wire.

        Rotating the sphere about its own axis gives the identical solid but
        moves the sphere's u = 0 meridian, which changes how many Edges the loop
        arrives in and where they start.
        """
        sphere = Solid.make_sphere(10)
        if sphere_rotation:
            sphere = sphere.rotate(Axis.Z, sphere_rotation)
        cutter = Solid.make_cylinder(5, 40, Plane.XY.offset(-20)).locate(
            Location((6, 0, 0))
        )
        loop = [
            edge
            for edge in sphere.cut(cutter).edges()
            if edge.geom_type == GeomType.BSPLINE
        ]
        return max(edges_to_wires(loop), key=lambda wire: wire.length)

    def test_reversed_loop_canonicalizes_the_same_way(self):
        """A Wire and the same Wire reversed must canonicalize identically.

        Regression: the seam of this loop lands on one of the Wire's own
        vertices, where two Edges meet heading in opposite directions.  Ranking
        the pieces by raw end point distance (1e-16 scale) before the tangent let
        floating point noise pick the piece heading *against* the canonical
        direction, and the loop was walked backwards.
        """
        for rotation in (0, 45, 90):
            wire = self.section_loop(rotation)
            reversed_wire = Wire(TopoDS.Wire_s(wire.wrapped.Reversed()))
            forward = wire.canonical()
            backward = reversed_wire.canonical()
            for position in (0.0, 0.25, 0.5, 0.75):
                self.assertTupleAlmostEquals(
                    tuple(backward.position_at(position)),
                    tuple(forward.position_at(position)),
                    4,
                    msg=f"sphere rotated {rotation} deg",
                )

    def test_loop_canonical_form_is_frame_independent(self):
        """Every frame of the same locus - and every traversal of it - has to
        agree, including the frames where the loop arrives as 1, 2 or 4 Edges."""
        reference = self.section_loop(0).canonical()
        for rotation in (37, 45, 90, 180, 270):
            wire = self.section_loop(rotation)
            for shape in (wire, Wire(TopoDS.Wire_s(wire.wrapped.Reversed()))):
                canonical = shape.canonical()
                self.assertAlmostEqual(canonical.length, reference.length, 4)
                for position in (0.0, 0.25, 0.5):
                    self.assertTupleAlmostEquals(
                        tuple(canonical.position_at(position)),
                        tuple(reference.position_at(position)),
                        3,
                        msg=f"sphere rotated {rotation} deg",
                    )

    def test_seam_already_at_the_start_is_not_reseamed(self):
        """A shape whose seam is its own start point must come back untouched.

        Regression: the "already canonical" test compared ``form.start`` against
        a tolerance without wrapping it, so a band midpoint that landed an
        epsilon *below* 1.0 - the same point as an epsilon above 0.0 - took the
        re-seam path.
        """
        for shape in (
            self.section_loop(0).canonical(),
            Edge.make_circle(10).canonical(),
            Wire(Face.make_rect(20, 10).outer_wire()).canonical(),
        ):
            form = shape.canonical_form()
            wrapped = form.start % 1.0
            box = shape.bounding_box()
            resolution = max(TOLERANCE, CANONICAL_BAND * max(box.size.X, box.size.Y, box.size.Z))
            self.assertLessEqual(
                min(wrapped, 1.0 - wrapped) * shape.length,
                resolution,
                msg="canonical() must leave the seam at the start",
            )
            self.assertIs(shape.canonical(), shape)

    def test_sort_by_ties_are_deterministic(self):
        """With tie_break, objects that tie on the criterion are ordered by
        geometry instead of by the order they arrived in - which for shapes out
        of a boolean is the kernel's traversal order."""
        edges = [
            Edge.make_line((0, -5, 10), (10, -5, 10)),
            Edge.make_line((0, 5, 10), (10, 5, 10)),
        ]
        first = ShapeList(edges).sort_by(Axis.Z, tie_break=True)
        second = ShapeList(edges[::-1]).sort_by(Axis.Z, tie_break=True)
        self.assertTupleAlmostEquals(tuple(first[0].center()), tuple(second[0].center()), 6)
        self.assertTupleAlmostEquals(tuple(first[0].center()), (5, -5, 10), 6)

    def test_sort_by_is_stable_without_tie_break(self):
        """The default must keep ties in their incoming order, so that chained
        sorts (sort_by(SortBy.RADIUS).sort_by(Axis.Z)) still work."""
        edges = [
            Edge.make_line((0, -5, 10), (10, -5, 10)),
            Edge.make_line((0, 5, 10), (10, 5, 10)),
        ]
        for order in (edges, edges[::-1]):
            sorted_edges = ShapeList(order).sort_by(Axis.Z)
            self.assertTupleAlmostEquals(
                tuple(sorted_edges[0].center()), tuple(order[0].center()), 6
            )

    def test_make_mid_way_is_frame_independent(self):
        """examples/joints.py's slider axis."""
        results = []
        for rotation in (0, 90, 180):
            with BuildPart() as part:
                with BuildSketch():
                    Rectangle(10, 10)
                extrude(amount=10, taper=3)
                Cylinder(2.5, 10, rotation=(0, 90, rotation), mode=Mode.SUBTRACT)
            solid = Solid(part.part.wrapped)
            top = (
                solid.edges()
                .filter_by(Axis.X, tolerance=30)
                .sort_by(Axis.Z, tie_break=True)[-2:]
            )
            results.append(Edge.make_mid_way(*top, 0.67).position_at(0))
        for result in results[1:]:
            self.assertTupleAlmostEquals(tuple(result), tuple(results[0]), 5)


class TestAxisFromEdge(DirectApiTestCase):
    def test_legacy_axis_ignores_orientation(self):
        """The pre-existing behaviour, kept as the default: Axis(edge) reads the
        underlying curve, so it disagrees with position_at() when the Edge is
        REVERSED."""
        edge = Edge.make_line((0, 0, 0), (10, 0, 0)).reversed()
        self.assertTupleAlmostEquals(tuple(edge.position_at(0)), (10, 0, 0), 6)
        self.assertTupleAlmostEquals(tuple(Axis(edge).position), (0, 0, 0), 6)

    def test_canonical_axis_matches_canonical_edge(self):
        for edge in (
            Edge.make_line((0, 0, 0), (10, 0, 0)),
            Edge.make_line((10, 0, 0), (0, 0, 0)),
            Edge.make_line((0, 0, 0), (10, 0, 0)).reversed(),
        ):
            axis = Axis(edge, canonical=True)
            canonical = edge.canonical()
            self.assertTupleAlmostEquals(tuple(axis.position), tuple(canonical.position_at(0)), 6)
            self.assertTupleAlmostEquals(tuple(axis.direction), tuple(canonical.tangent_at(0)), 6)
            self.assertTupleAlmostEquals(tuple(axis.direction), (1, 0, 0), 6)


if __name__ == "__main__":
    unittest.main()
