"""Apply the canonical-free-edges work as a stack of small patches.

    python3 apply_stack.py <build123d-package-dir> <tests-dir> <canonical.py> a|b|c

  a  ShapeList.sort_by(..., tie_break=True)                     (shape_core.py)
  b  the rule + Mixin1D.canonical()/canonical_form()            (canonical.py, one_d.py)
  c  the consumers: Axis(edge, canonical=True), make_mid_way     (geometry.py, one_d.py)
"""

import shutil
import sys
from pathlib import Path


def edit(path: Path, old: str, new: str, count: int = 1) -> None:
    text = path.read_text()
    assert old in text, f"anchor not found in {path.name}: {old[:60]!r}"
    path.write_text(text.replace(old, new, count))


# ---------------------------------------------------------------------------
# a) ShapeList.sort_by(..., tie_break=True)
# ---------------------------------------------------------------------------
GEOMETRIC_KEY = '''def _geometric_key(shape: Shape | Vector) -> tuple:
    """A deterministic, purely geometric ordering key.

    Sorted vertex positions, then the center for shapes that share their vertices
    (two arcs spanning the same end points), rounded to TOL_DIGITS so geometry
    that agrees to within tolerance always sorts the same way.  Used by
    ShapeList.sort_by(tie_break=True).
    """
    if isinstance(shape, Vector):  # a ShapeList can also hold plain Vectors
        return (tuple(round(c, TOL_DIGITS) for c in (shape.X, shape.Y, shape.Z)), ())
    positions = []
    explorer = TopExp_Explorer(shape.wrapped, ta.TopAbs_VERTEX)
    while explorer.More():
        point = BRep_Tool.Pnt_s(TopoDS.Vertex_s(explorer.Current()))
        positions.append(tuple(round(c, TOL_DIGITS) for c in point.Coord()))
        explorer.Next()
    center = shape.center()
    return (
        tuple(sorted(positions)),
        tuple(round(c, TOL_DIGITS) for c in (center.X, center.Y, center.Z)),
    )


'''

OLD_SORT_DOC = '''        Args:
            sort_by (Callable[[T], K] | Axis | Edge | Wire | SortBy | property,
                optional): sort criteria. Defaults to Axis.Z.
            reverse (bool, optional): flip order of sort. Defaults to False.

        Raises:'''

NEW_SORT_DOC = '''        Objects that tie on the criteria keep their incoming order, which is what
        makes chained sorts such as ``sort_by(SortBy.RADIUS).sort_by(Axis.Z)``
        work.  For shapes that came out of a boolean operation that incoming order
        is the CAD kernel's traversal order, i.e. a function of construction
        history; ``tie_break=True`` orders tied objects by geometry instead.

        Args:
            sort_by (Callable[[T], K] | Axis | Edge | Wire | SortBy | property,
                optional): sort criteria. Defaults to Axis.Z.
            reverse (bool, optional): flip order of sort. Defaults to False.
            tie_break (bool, optional): order tied objects by geometry rather than
                by their incoming order. Defaults to False.

        Raises:'''


def apply_a(package: Path) -> None:
    shape_core = package / "topology" / "shape_core.py"
    edit(
        shape_core,
        """from build123d.geometry import (
    DEG2RAD,
    TOLERANCE,""",
        """from build123d.geometry import (
    DEG2RAD,
    TOLERANCE,
    TOL_DIGITS,""",
    )
    edit(
        shape_core,
        """        sort_by: Callable[[T], K] | Axis | Edge | Wire | SortBy | property = Axis.Z,
        reverse: bool = False,
    ) -> ShapeList[T]:""",
        """        sort_by: Callable[[T], K] | Axis | Edge | Wire | SortBy | property = Axis.Z,
        reverse: bool = False,
        tie_break: bool = False,
    ) -> ShapeList[T]:""",
    )
    edit(shape_core, OLD_SORT_DOC, NEW_SORT_DOC)
    # sorted() is stable, so making the incoming order geometric is all it takes
    # for ties to come out geometric
    edit(
        shape_core,
        """        if callable(sort_by):
            # If a callable is provided, use it directly as the key
            objects = sorted(self,""",
        """        candidates = sorted(self, key=_geometric_key) if tie_break else list(self)

        if callable(sort_by):
            # If a callable is provided, use it directly as the key
            objects = sorted(candidates,""",
    )
    for old, new in (
        ("objects = sorted(self, key=sort_by.__get__,", "objects = sorted(candidates, key=sort_by.__get__,"),
        ("""            objects = sorted(
                self,
                key=lambda o: tcast(""", """            objects = sorted(
                candidates,
                key=lambda o: tcast("""),
        ("""            objects = sorted(
                self, key=lambda o: u_of_closest_center(o), reverse=reverse
            )""", """            objects = sorted(
                candidates, key=lambda o: u_of_closest_center(o), reverse=reverse
            )"""),
        ("""                objects = sorted(
                    self,
                    key=lambda obj: obj.length,""", """                objects = sorted(
                    candidates,
                    key=lambda obj: obj.length,"""),
        ('with_radius = [obj for obj in self if hasattr(obj, "radius")]',
         'with_radius = [obj for obj in candidates if hasattr(obj, "radius")]'),
        ("""                objects = sorted(
                    self,
                    key=lambda obj: obj.center().length,""", """                objects = sorted(
                    candidates,
                    key=lambda obj: obj.center().length,"""),
        ('with_area = [obj for obj in self if hasattr(obj, "area")]',
         'with_area = [obj for obj in candidates if hasattr(obj, "area")]'),
        ('with_volume = [obj for obj in self if hasattr(obj, "volume")]',
         'with_volume = [obj for obj in candidates if hasattr(obj, "volume")]'),
    ):
        edit(shape_core, old, new)
    edit(
        shape_core,
        "def _topods_entities(shape: TopoDS_Shape, topo_type: Shapes) -> list[TopoDS_Shape]:",
        GEOMETRIC_KEY
        + "def _topods_entities(shape: TopoDS_Shape, topo_type: Shapes) -> list[TopoDS_Shape]:",
    )


# ---------------------------------------------------------------------------
# b) the rule + Mixin1D.canonical() / canonical_form()
# ---------------------------------------------------------------------------
CANONICAL_METHODS = '''    def canonical(self) -> Edge | Wire:
        """canonical

        Return this shape with a start point and direction that follow from its
        geometry instead of from the CAD kernel's construction history.

        The seam, direction and parameter range of a *free* edge - one produced by
        cut, section or project_to_shape rather than drawn - are implementation
        defined, so a sphere and the same sphere rotated about its own axis give
        section edges that start in different places and run in opposite
        directions.  Anything measured from ``position_at(0)`` or ``tangent_at``
        moves with them; see :mod:`~topology.canonical` for the rule that replaces
        them.

        Returns:
            Edge | Wire: same geometry, canonical parametrisation.  Open shapes
            keep their type; a closed shape that has to be re-seamed comes back as
            a single Edge, since a closed Wire has no distinguished first edge.

        Example:
            >>> path = sphere.cut(cylinder).edges().sort_by(Axis.Z)[0].canonical()
        """
        form = self.canonical_form()
        if not form.closed:
            return self if form.sign > 0 else _reversed_1d(self)

        # "Already seamed here?" is a question about the circular distance, asked
        # at the resolution the seam is defined to - a band midpoint landing an
        # epsilon below 1.0 is the same point as one an epsilon above 0.0, and
        # demanding more precision than the rule's own resolution would re-seam a
        # shape by nanometres on every call.
        size = self.bounding_box().size
        resolution = max(TOLERANCE, CANONICAL_BAND * max(size.X, size.Y, size.Z))
        start = form.start % 1.0
        if min(start, 1.0 - start) * self.length <= resolution:
            return self if form.sign > 0 else _reversed_1d(self)

        seam = self.position_at(form.start)
        pieces = _split_at_point(self, seam)
        return _joined_edge(_walk_from(pieces, seam, self.tangent_at(form.start) * form.sign))

    def canonical_form(self, samples: int = CANONICAL_SAMPLES) -> CanonicalForm:
        """canonical_form

        The canonical start position and direction of this shape, without
        rebuilding it - see :meth:`canonical`.

        Args:
            samples (int, optional): arc length samples used to find the seam.
                Defaults to CANONICAL_SAMPLES.

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

CANONICAL_HELPERS = '''def _reversed_1d(shape: Edge | Wire) -> Edge | Wire:
    """A copy of an Edge or Wire traversed in the opposite direction."""
    if isinstance(shape, Wire):
        return Wire(TopoDS.Wire_s(shape.wrapped.Reversed()))
    return shape.reversed()


def _split_at_point(shape: Edge | Wire, point: Vector) -> list[Edge]:
    """The Edges of a shape, with the one that contains ``point`` split there."""
    pieces: list[Edge] = []
    for edge in shape.edges():
        at_end = min(
            (edge.position_at(0) - point).length, (edge.position_at(1) - point).length
        )
        if at_end > TOLERANCE and edge.distance_to(point) <= TOLERANCE:
            parameter = edge.param_at_point(point)
            if TOLERANCE < parameter * edge.length < edge.length - TOLERANCE:
                pieces += [edge.trim(0.0, parameter), edge.trim(parameter, 1.0)]
                continue
        pieces.append(edge)
    return pieces


def _walk_from(pieces: list[Edge], start: Vector, direction: Vector) -> list[Edge]:
    """Order and orient ``pieces`` into a chain leaving ``start`` along
    ``direction``, by matching end points.

    Candidates are ranked on *whether* the gap is closed, then on the tangent,
    then on the gap: two pieces meet the seam at one vertex, so their gaps are
    floating point noise and comparing those first would walk the loop backwards.
    """
    remaining, ordered = list(pieces), []
    tolerance = max(TOLERANCE, 1e-6 * sum(piece.length for piece in pieces))
    position, heading = start, direction
    while remaining:
        best, best_score, flipped = None, None, False
        for candidate in remaining:
            for flip in (False, True):
                edge = candidate.reversed() if flip else candidate
                gap = (edge.position_at(0) - position).length
                score = (gap > tolerance, -edge.tangent_at(0).dot(heading), gap)
                if best_score is None or score < best_score:
                    best, best_score, flipped = candidate, score, flip
        if best is None or best_score[0]:
            return pieces  # not a connected chain - keep the input order
        edge = best.reversed() if flipped else best
        ordered.append(edge)
        remaining.remove(best)
        position, heading = edge.position_at(1), edge.tangent_at(1)
    return ordered


def _joined_edge(edges: list[Edge]) -> Edge:
    """A single Edge whose curve is the concatenation of ``edges``, in order - a
    re-seamed loop needs an unambiguous start point, which an Edge's curve
    parametrisation provides and a closed TopoDS_Wire does not."""

    def bspline(edge: Edge) -> Geom_BSplineCurve:
        first, last = BRep_Tool.Range_s(edge.wrapped)
        curve = GeomConvert.CurveToBSplineCurve_s(
            Geom_TrimmedCurve(BRep_Tool.Curve_s(edge.wrapped, first, last), first, last)
        )
        if edge.wrapped.Orientation() == TopAbs_Orientation.TopAbs_REVERSED:
            curve.Reverse()
        return curve

    builder = GeomConvert_CompCurveToBSplineCurve(bspline(edges[0]))
    for edge in edges[1:]:
        builder.Add(bspline(edge), TOLERANCE, True)
    return Edge(BRepBuilderAPI_MakeEdge(builder.BSplineCurve()).Edge())


'''


def apply_b(package: Path, canonical_source: Path) -> None:
    shutil.copyfile(canonical_source, package / "topology" / "canonical.py")
    one_d = package / "topology" / "one_d.py"
    edit(
        one_d,
        "from OCP.GeomConvert import GeomConvert_CompCurveToBSplineCurve",
        "from OCP.GeomConvert import GeomConvert, GeomConvert_CompCurveToBSplineCurve",
    )
    edit(
        one_d,
        "from .constrained_lines import (",
        """from .canonical import (
    CANONICAL_BAND,
    CANONICAL_SAMPLES,
    CanonicalForm,
    canonical_form as _canonical_form,
)
from .constrained_lines import (""",
    )
    anchor = """    def common_plane(
        self, *lines: Edge | Wire | None, tolerance: float = TOLERANCE
    ) -> None | Plane:"""
    edit(one_d, anchor, CANONICAL_METHODS + anchor)
    anchor = "def edges_to_wires(edges: Iterable[Edge], tol: float = 1e-6) -> ShapeList[Wire]:"
    edit(one_d, anchor, CANONICAL_HELPERS + anchor)


# ---------------------------------------------------------------------------
# c) the consumers
# ---------------------------------------------------------------------------
def apply_c(package: Path) -> None:
    geometry = package / "geometry.py"
    edit(
        geometry,
        "        edge (Edge): origin & direction defined by start of edge",
        """        edge (Edge): origin & direction defined by start of edge
        canonical (bool): with ``edge``, take the origin and direction from the
            edge's canonical traversal. Defaults to False.""",
    )
    edit(
        geometry,
        '''    @overload
    def __init__(self, edge: Edge) -> None:
        """Axis: start of Edge"""
''',
        '''    @overload
    def __init__(self, edge: Edge, *, canonical: bool = False) -> None:
        """Axis: start of Edge

        By default the origin and direction are read from the underlying curve at
        its first parameter, which depends on the Edge's construction history and
        disagrees with ``edge.position_at(0)``/``tangent_at(0)`` when the Edge is
        REVERSED.  ``canonical=True`` uses the Edge's canonical traversal (see
        ``Mixin1D.canonical``), so identical geometry gives identical Axes.
        """
''',
    )
    edit(
        geometry,
        '''        edge = kwargs.pop("edge", None)
        location = kwargs.pop("location", None)
''',
        '''        edge = kwargs.pop("edge", None)
        location = kwargs.pop("location", None)
        canonical = kwargs.pop("canonical", False)
''',
    )
    edit(
        geometry,
        """            topods_edge: TopoDS_Edge = edge.wrapped  # type: ignore[annotation-unchecked]
            curve = BRep_Tool.Curve_s(topods_edge, float(), float())
            param_min, _ = BRep_Tool.Range_s(topods_edge)
            origin_pnt = gp_Pnt()
            tangent_vec = gp_Vec()
            curve.D1(param_min, origin_pnt, tangent_vec)
            origin = Vector(origin_pnt)
            direction = Vector(gp_Dir(tangent_vec))""",
        """            if canonical:
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
                direction = Vector(gp_Dir(tangent_vec))""",
    )
    edit(
        package / "topology" / "one_d.py",
        """        flip = Axis(first).is_opposite(Axis(second))""",
        """        # The direction and start point of the reference Edges are incidental -
        # a section Edge starts wherever the intersector seamed it - so pair
        # their ends up canonically instead of by construction history.
        first, second = first.canonical(), second.canonical()
        flip = Axis(first, canonical=True).is_opposite(Axis(second, canonical=True))""",
    )


def add_tests_a(tests: Path, snippet: Path) -> None:
    """Two sort_by tests, next to the existing ones in test_shape_list.py."""
    edit(
        tests / "test_direct_api" / "test_shape_list.py",
        "    def test_sort_by_invalid(self):",
        snippet.read_text() + "    def test_sort_by_invalid(self):",
    )


def add_tests_c(tests: Path, snippet: Path) -> None:
    """Consumer tests, appended to the canonical test module from patch (b)."""
    path = tests / "test_direct_api" / "test_canonical.py"
    path.write_text(path.read_text().rstrip("\n") + "\n" + snippet.read_text())


if __name__ == "__main__":
    package_dir, tests_dir, canonical_py, which = (
        Path(sys.argv[1]),
        Path(sys.argv[2]),
        Path(sys.argv[3]),
        sys.argv[4],
    )
    here = Path(__file__).parent
    if which == "a":
        apply_a(package_dir)
        add_tests_a(tests_dir, here / "tests_a_snippet.py")
    elif which == "b":
        apply_b(package_dir, canonical_py)
        shutil.copyfile(
            here / "tests_b_canonical.py",
            tests_dir / "test_direct_api" / "test_canonical.py",
        )
    elif which == "c":
        apply_c(package_dir)
        add_tests_c(tests_dir, here / "tests_c_snippet.py")
    else:
        raise SystemExit("expected a, b or c")
    print(f"applied {which} to {package_dir}")
