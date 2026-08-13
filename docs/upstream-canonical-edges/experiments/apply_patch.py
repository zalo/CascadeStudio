"""Apply the canonical-free-edge patch to a build123d source tree."""
import shutil
import sys
from pathlib import Path

tree = Path(sys.argv[1])          # .../build123d  (package dir)
canonical_src = Path(sys.argv[2])  # canonical.py to install

shutil.copyfile(canonical_src, tree / "topology" / "canonical.py")

# ------------------------------------------------------------------ one_d.py
one_d = tree / "topology" / "one_d.py"
s = one_d.read_text()

s = s.replace(
    "from OCP.GeomConvert import GeomConvert_CompCurveToBSplineCurve",
    "from OCP.GeomConvert import GeomConvert, GeomConvert_CompCurveToBSplineCurve",
    1,
)

s = s.replace(
    "from .constrained_lines import (",
    """from .canonical import (
    CANONICAL_SAMPLES,
    CanonicalForm,
    canonical_form as _canonical_form,
)
from .constrained_lines import (""",
    1,
)

CANONICAL_METHODS = '''    def canonical(self) -> Edge | Wire:
        """canonical

        Return this shape with a *canonical* parametrisation: the same geometry,
        but with a start point and a traversal direction that are determined by
        the geometry alone instead of by the CAD kernel's construction history.

        Free edges - the ones produced by :meth:`~topology.Shape.cut`,
        :meth:`~topology.Shape.intersect`, ``section`` or ``project_to_shape``
        rather than drawn by the user - inherit the seam, direction and
        parameter range that the kernel found convenient. Those depend on the
        parametric frames of the surfaces involved (which meridian of a sphere
        is ``u = 0``), on the seed point of the surface/surface intersector and
        on the order the boolean assembler visited the faces of the result, so
        two geometrically identical solids can yield section edges that start in
        different places and run in opposite directions. Anything measured from
        ``position_at(0)``, ``tangent_at`` or ``Axis(edge)`` then moves with
        them.

        The canonical form is defined as:

        * open shapes start at the lexicographically smaller end point,
        * closed shapes start at the lexicographically smallest point of the
          loop (the midpoint of its extremal band, see
          :mod:`~topology.canonical`) and wind counter-clockwise about the
          dominant axis of their area vector,
        * positions are normalised arc length, as ``position_at`` already does.

        Returns:
            Edge | Wire: same geometry, canonical parametrisation. Open shapes
            keep their type; a closed shape that has to be re-seamed is returned
            as a single Edge, because a closed ``Wire`` has no distinguished
            start point for ``position_at`` to key off.

        Example:
            >>> # a text path on a sphere that does not depend on how the
            >>> # sphere happens to be parametrised
            >>> arch = sphere.cut(cylinder).edges().sort_by(Axis.Z)[0].canonical()
        """
        form = self.canonical_form()

        if not form.closed:
            return self if form.sign > 0 else _reverse_1d(self)

        if form.sign > 0 and form.start <= TOLERANCE / max(self.length, TOLERANCE):
            return self  # already canonical: keep the original curve type

        seam = self.position_at(form.start)
        direction = self.tangent_at(form.start) * form.sign
        ordered = _walk_loop(_split_1d_at_point(self, seam), seam, direction)
        return _concatenate_edges(ordered)

    def canonical_form(self, samples: int = CANONICAL_SAMPLES) -> CanonicalForm:
        """canonical_form

        The canonical start position and direction of this shape, without
        rebuilding it - see :meth:`canonical`.

        Args:
            samples (int, optional): arc length samples used by the seam search.
                Defaults to ``CANONICAL_SAMPLES``.

        Returns:
            CanonicalForm: canonical start (normalised) and direction sign
        """
        length = self.length
        if length <= TOLERANCE:
            return CanonicalForm(0.0, 1, False)
        closed = (self.position_at(0) - self.position_at(1)).length <= TOLERANCE
        return _canonical_form(
            lambda distance: self.position_at(min(max(distance / length, 0.0), 1.0)),
            length,
            closed,
            samples=samples,
        )

'''

anchor = """    def common_plane(
        self, *lines: Edge | Wire | None, tolerance: float = TOLERANCE
    ) -> None | Plane:"""
assert anchor in s
s = s.replace(anchor, CANONICAL_METHODS + anchor, 1)

REVERSE_HELPER = '''def _reverse_1d(shape: Edge | Wire) -> Edge | Wire:
    """A copy of an Edge or Wire that is traversed in the opposite direction."""
    if isinstance(shape, Wire):
        reversed_wire = Wire(TopoDS.Wire_s(shape.wrapped.Reversed()))
        reversed_wire.label = shape.label
        return reversed_wire
    return shape.reversed()


def _split_1d_at_point(shape: Edge | Wire, point: Vector) -> list[Edge]:
    """The Edges of ``shape``, with the one that contains ``point`` split there."""
    pieces: list[Edge] = []
    for edge in shape.edges():
        ends_at_point = min(
            (edge.position_at(0) - point).length, (edge.position_at(1) - point).length
        )
        if ends_at_point > TOLERANCE and edge.distance_to(point) <= TOLERANCE:
            parameter = edge.param_at_point(point)
            if TOLERANCE < parameter * edge.length < edge.length - TOLERANCE:
                pieces.extend([edge.trim(0.0, parameter), edge.trim(parameter, 1.0)])
                continue
        pieces.append(edge)
    return pieces


def _walk_loop(pieces: list[Edge], start: Vector, direction: Vector) -> list[Edge]:
    """Order and orient ``pieces`` into a chain that leaves ``start`` heading
    along ``direction``, purely by matching end points."""
    remaining = list(pieces)
    # the requested start comes from a sampled parameter, so allow a gap that
    # scales with the size of the loop
    gap_tolerance = max(TOLERANCE, 1e-6 * sum(piece.length for piece in pieces))
    ordered: list[Edge] = []
    position, heading = start, direction
    while remaining:
        best, best_score, flip = None, None, False
        for candidate in remaining:
            for reverse in (False, True):
                edge = candidate.reversed() if reverse else candidate
                score = (
                    (edge.position_at(0) - position).length,
                    -edge.tangent_at(0).dot(heading),
                )
                if best_score is None or score < best_score:
                    best, best_score, flip = candidate, score, reverse
        if best is None or best_score[0] > gap_tolerance:
            return pieces  # not a connected chain - keep the input order
        edge = best.reversed() if flip else best
        ordered.append(edge)
        remaining.remove(best)
        position, heading = edge.position_at(1), edge.tangent_at(1)
    return ordered


def _concatenate_edges(edges: list[Edge]) -> Edge:
    """A single Edge whose curve is the concatenation of ``edges``, in order.

    Used to give a re-seamed closed loop an unambiguous start point: a closed
    ``TopoDS_Wire`` carries no distinguished first edge, while an Edge's curve
    parametrisation does.
    """

    def bspline_of(edge: Edge) -> Geom_BSplineCurve:
        first, last = BRep_Tool.Range_s(edge.wrapped)
        curve = BRep_Tool.Curve_s(edge.wrapped, first, last)
        bspline = GeomConvert.CurveToBSplineCurve_s(Geom_TrimmedCurve(curve, first, last))
        if edge.wrapped.Orientation() == TopAbs_Orientation.TopAbs_REVERSED:
            bspline.Reverse()
        return bspline

    if len(edges) == 1:
        return Edge(BRepBuilderAPI_MakeEdge(bspline_of(edges[0])).Edge())
    builder = GeomConvert_CompCurveToBSplineCurve(bspline_of(edges[0]))
    for edge in edges[1:]:
        builder.Add(bspline_of(edge), TOLERANCE, True)
    return Edge(BRepBuilderAPI_MakeEdge(builder.BSplineCurve()).Edge())


'''
anchor2 = "def edges_to_wires(edges: Iterable[Edge], tol: float = 1e-6) -> ShapeList[Wire]:"
assert anchor2 in s
s = s.replace(anchor2, REVERSE_HELPER + anchor2, 1)
one_d.write_text(s)

# --------------------------------------------------------------- geometry.py
geometry = tree / "geometry.py"
g = geometry.read_text()

g = g.replace(
    "        edge (Edge): origin & direction defined by start of edge",
    """        edge (Edge): origin & direction defined by start of edge
        canonical (bool): with ``edge``, take the origin & direction from the
            edge's canonical traversal instead of from the underlying curve's
            first parameter. Defaults to False (see ``Mixin1D.canonical``).""",
    1,
)

g = g.replace(
    '''    @overload
    def __init__(self, edge: Edge) -> None:
        """Axis: start of Edge"""
''',
    '''    @overload
    def __init__(self, edge: Edge, *, canonical: bool = False) -> None:
        """Axis: start of Edge

        With ``canonical=False`` (the default, and the historical behaviour) the
        origin and direction are read from the underlying curve at its first
        parameter.  That depends on the Edge's construction history and
        disagrees with ``edge.position_at(0)``/``edge.tangent_at(0)`` whenever
        the Edge is REVERSED.

        With ``canonical=True`` they come from the Edge's *canonical* traversal
        (see ``Mixin1D.canonical``), so geometrically identical Edges always
        give identical Axes.
        """
''',
    1,
)

g = g.replace(
    '''        edge = kwargs.pop("edge", None)
        location = kwargs.pop("location", None)
''',
    '''        edge = kwargs.pop("edge", None)
        location = kwargs.pop("location", None)
        canonical = kwargs.pop("canonical", False)
''',
    1,
)

g = g.replace(
    '''            topods_edge: TopoDS_Edge = edge.wrapped  # type: ignore[annotation-unchecked]
            curve = BRep_Tool.Curve_s(topods_edge, float(), float())
            param_min, _ = BRep_Tool.Range_s(topods_edge)
            origin_pnt = gp_Pnt()
            tangent_vec = gp_Vec()
            curve.D1(param_min, origin_pnt, tangent_vec)
            origin = Vector(origin_pnt)
            direction = Vector(gp_Dir(tangent_vec))''',
    '''            if canonical:
                # Geometry decides which end is the origin, not the kernel's
                # construction history - see Mixin1D.canonical()
                canonical_edge = edge.canonical()
                origin = canonical_edge.position_at(0)
                direction = canonical_edge.tangent_at(0)
            else:
                topods_edge: TopoDS_Edge = edge.wrapped  # type: ignore[annotation-unchecked]
                curve = BRep_Tool.Curve_s(topods_edge, float(), float())
                param_min, _ = BRep_Tool.Range_s(topods_edge)
                origin_pnt = gp_Pnt()
                tangent_vec = gp_Vec()
                curve.D1(param_min, origin_pnt, tangent_vec)
                origin = Vector(origin_pnt)
                direction = Vector(gp_Dir(tangent_vec))''',
    1,
)
geometry.write_text(g)
print("patched", tree)

# ------------------------------------------------------ Edge.make_mid_way
one_d2 = tree / "topology" / "one_d.py"
m = one_d2.read_text()
old_mid = """        flip = Axis(first).is_opposite(Axis(second))
        pnts = [
            Edge.make_line(
                first.position_at(i), second.position_at(1 - i if flip else i)
            ).position_at(middle)
            for i in [0, 1]
        ]
        return Edge.make_line(*pnts)"""
new_mid = """        # The direction and start point of the two reference Edges are
        # incidental - a section Edge starts wherever the kernel's intersector
        # happened to seam it - so pair the ends up canonically instead of
        # relying on the construction history (the is_opposite() flip below is
        # kept for reference Edges that are not parallel).
        first, second = first.canonical(), second.canonical()
        flip = Axis(first, canonical=True).is_opposite(Axis(second, canonical=True))
        pnts = [
            Edge.make_line(
                first.position_at(i), second.position_at(1 - i if flip else i)
            ).position_at(middle)
            for i in [0, 1]
        ]
        return Edge.make_line(*pnts)"""
assert old_mid in m
m = m.replace(old_mid, new_mid, 1)
one_d2.write_text(m)
print("patched make_mid_way")

# ------------------------------------------------- ShapeList.sort_by tie break
shape_core = tree / "topology" / "shape_core.py"
c = shape_core.read_text()

OLD_SORT_BODY = '''        if callable(sort_by):
            # If a callable is provided, use it directly as the key
            objects = sorted(self, key=sort_by, reverse=reverse)

        elif isinstance(sort_by, property):
            objects = sorted(self, key=sort_by.__get__, reverse=reverse)

        elif isinstance(sort_by, Axis):
            if sort_by.wrapped is None:
                raise ValueError("Cannot sort by an empty axis")
            assert sort_by.location is not None
            axis_as_location = sort_by.location.inverse()
            objects = sorted(
                self,
                key=lambda o: tcast(
                    Location, (axis_as_location * Location(o.center()))
                ).position.Z,
                reverse=reverse,
            )
        elif not sort_by:
            raise ValueError("Cannot sort by an empty object")
        elif hasattr(sort_by, "wrapped") and isinstance(
            sort_by.wrapped, (TopoDS_Edge, TopoDS_Wire)
        ):

            def u_of_closest_center(obj) -> float:
                """u-value of closest point between object center and sort_by"""
                assert not isinstance(sort_by, SortBy)
                pnt1, _pnt2 = sort_by.closest_points(obj.center())
                return sort_by.param_at_point(pnt1)

            # pylint: disable=unnecessary-lambda
            objects = sorted(
                self, key=lambda o: u_of_closest_center(o), reverse=reverse
            )

        elif isinstance(sort_by, SortBy):
            if sort_by == SortBy.LENGTH:
                objects = sorted(
                    self,
                    key=lambda obj: obj.length,
                    reverse=reverse,
                )
            elif sort_by == SortBy.RADIUS:
                with_radius = [obj for obj in self if hasattr(obj, "radius")]
                objects = sorted(
                    with_radius,
                    key=lambda obj: obj.radius,  # type: ignore
                    reverse=reverse,
                )
            elif sort_by == SortBy.DISTANCE:
                objects = sorted(
                    self,
                    key=lambda obj: obj.center().length,
                    reverse=reverse,
                )
            elif sort_by == SortBy.AREA:
                with_area = [obj for obj in self if hasattr(obj, "area")]
                objects = sorted(
                    with_area,
                    key=lambda obj: obj.area,  # type: ignore
                    reverse=reverse,
                )
            elif sort_by == SortBy.VOLUME:
                with_volume = [obj for obj in self if hasattr(obj, "volume")]
                objects = sorted(
                    with_volume,
                    key=lambda obj: obj.volume,  # type: ignore
                    reverse=reverse,
                )
        else:
            raise ValueError("Invalid sort_by criteria provided")

        return ShapeList(objects)  # pylint: disable=possibly-used-before-assignment'''

NEW_SORT_BODY = '''        candidates: list = list(self)

        if callable(sort_by):
            # If a callable is provided, use it directly as the key
            key_function = sort_by

        elif isinstance(sort_by, property):
            key_function = sort_by.__get__

        elif isinstance(sort_by, Axis):
            if sort_by.wrapped is None:
                raise ValueError("Cannot sort by an empty axis")
            assert sort_by.location is not None
            axis_as_location = sort_by.location.inverse()

            def key_function(o):  # type: ignore[misc]
                return tcast(
                    Location, (axis_as_location * Location(o.center()))
                ).position.Z

        elif not sort_by:
            raise ValueError("Cannot sort by an empty object")
        elif hasattr(sort_by, "wrapped") and isinstance(
            sort_by.wrapped, (TopoDS_Edge, TopoDS_Wire)
        ):

            def key_function(obj) -> float:  # type: ignore[misc]
                """u-value of closest point between object center and sort_by"""
                assert not isinstance(sort_by, SortBy)
                pnt1, _pnt2 = sort_by.closest_points(obj.center())
                return sort_by.param_at_point(pnt1)

        elif isinstance(sort_by, SortBy):
            if sort_by == SortBy.LENGTH:
                key_function = lambda obj: obj.length  # noqa: E731
            elif sort_by == SortBy.RADIUS:
                candidates = [obj for obj in candidates if hasattr(obj, "radius")]
                key_function = lambda obj: obj.radius  # type: ignore # noqa: E731
            elif sort_by == SortBy.DISTANCE:
                key_function = lambda obj: obj.center().length  # noqa: E731
            elif sort_by == SortBy.AREA:
                candidates = [obj for obj in candidates if hasattr(obj, "area")]
                key_function = lambda obj: obj.area  # type: ignore # noqa: E731
            elif sort_by == SortBy.VOLUME:
                candidates = [obj for obj in candidates if hasattr(obj, "volume")]
                key_function = lambda obj: obj.volume  # type: ignore # noqa: E731
        else:
            raise ValueError("Invalid sort_by criteria provided")

        # Objects that tie on the sort criterion would otherwise be ordered by
        # the kernel's traversal order, which depends on the construction
        # history of the shape (see Mixin1D.canonical).  Break those ties with a
        # geometric key so that identical geometry always sorts identically.
        # pylint: disable=possibly-used-before-assignment
        decorated = [(key_function(obj), obj) for obj in candidates]
        if len({key for key, _ in decorated}) != len(decorated):
            decorated = [
                ((key, _canonical_sort_key(obj)), obj) for key, obj in decorated
            ]
        decorated.sort(key=lambda pair: pair[0], reverse=reverse)

        return ShapeList([obj for _, obj in decorated])'''

assert OLD_SORT_BODY in c
c = c.replace(OLD_SORT_BODY, NEW_SORT_BODY, 1)

SORT_KEY_HELPER = '''def _canonical_sort_key(shape: Shape | Vector) -> tuple[float, ...]:
    """Deterministic, purely geometric ordering key.

    Used to break ties in :meth:`ShapeList.sort_by`, where the alternative is
    the CAD kernel's traversal order.  Coordinates are rounded to ``TOL_DIGITS``
    so that geometry that agrees to within tolerance always sorts the same way.
    """
    if isinstance(shape, Vector):  # ShapeList also holds plain Vectors
        coordinates: tuple[float, ...] = (shape.X, shape.Y, shape.Z)
    elif not (hasattr(shape, "center") and hasattr(shape, "bounding_box")):
        return ()  # pragma: no cover
    else:
        try:
            center, box = shape.center(), shape.bounding_box()
            coordinates = (
                center.X,
                center.Y,
                center.Z,
                box.min.X,
                box.min.Y,
                box.min.Z,
                box.max.X,
                box.max.Y,
                box.max.Z,
            )
        except (ValueError, TypeError, AssertionError):  # pragma: no cover
            return ()
    return tuple(round(coordinate, TOL_DIGITS) for coordinate in coordinates)


'''
c = c.replace(
    """from build123d.geometry import (
    DEG2RAD,
    TOLERANCE,""",
    """from build123d.geometry import (
    DEG2RAD,
    TOLERANCE,
    TOL_DIGITS,""",
    1,
)

anchor3 = "def _topods_entities(shape: TopoDS_Shape, topo_type: Shapes) -> list[TopoDS_Shape]:"
assert anchor3 in c
c = c.replace(anchor3, SORT_KEY_HELPER + anchor3, 1)
shape_core.write_text(c)
print("patched sort_by")

# ---------------------------------------------- tests/test_algebra.py tie order
# This assertion sorted edges that all tie on Axis.Z and then took .first /
# .last, so it depended on the kernel's traversal order.  Sort by a defined key.
algebra = tree.parent.parent / "tests" / "test_algebra.py"
if algebra.exists():
    a = algebra.read_text()
    old_algebra = '''        self.assertTupleAlmostEquals(
            result.edges()
            .sort_by()
            .filter_by(GeomType.CIRCLE)
            .first.center(CenterOf.BOUNDING_BOX),
            (0.55, 0, 0),
            6,
        )
        self.assertTupleAlmostEquals(
            result.edges()
            .sort_by()
            .filter_by(GeomType.CIRCLE)
            .last.center(CenterOf.BOUNDING_BOX),
            (-0.55, 0, 0),
            6,
        )'''
    new_algebra = '''        circle_edges = result.edges().filter_by(GeomType.CIRCLE).sort_by(Axis.X)
        self.assertTupleAlmostEquals(
            circle_edges.first.center(CenterOf.BOUNDING_BOX),
            (-0.55, 0, 0),
            6,
        )
        self.assertTupleAlmostEquals(
            circle_edges.last.center(CenterOf.BOUNDING_BOX),
            (0.55, 0, 0),
            6,
        )'''
    assert old_algebra in a
    algebra.write_text(a.replace(old_algebra, new_algebra, 1))
    print("patched tests/test_algebra.py tie order")
