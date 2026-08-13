    def test_sort_by_tie_break(self):
        """Objects that tie on the criteria are ordered by geometry, not by the
        order they arrived in - which for shapes out of a boolean operation is the
        kernel's traversal order."""
        edges = [
            Edge.make_line((0, -5, 10), (10, -5, 10)),
            Edge.make_line((0, 5, 10), (10, 5, 10)),
        ]
        for incoming in (edges, edges[::-1]):
            with self.subTest(first=incoming[0].center().Y):
                sorted_edges = ShapeList(incoming).sort_by(Axis.Z, tie_break=True)
                self.assertAlmostEqual(sorted_edges[0].center().Y, -5, 6)

    def test_sort_by_keeps_ties_in_order_by_default(self):
        """Ties keep their incoming order, so chained sorts still work."""
        short = Edge.make_line((0, -5, 10), (2, -5, 10))
        long = Edge.make_line((0, 5, 10), (10, 5, 10))
        for incoming in ([short, long], [long, short]):
            with self.subTest(first=incoming[0].length):
                by_arrival = ShapeList(incoming).sort_by(Axis.Z)
                self.assertAlmostEqual(by_arrival[0].length, incoming[0].length, 6)
                chained = ShapeList(incoming).sort_by(SortBy.LENGTH).sort_by(Axis.Z)
                self.assertAlmostEqual(chained[0].length, short.length, 6)

