from _typeshed import Incomplete
from build123d.build_common import WorkplaneList as WorkplaneList, flatten_sequence as flatten_sequence, validate_inputs as validate_inputs
from build123d.build_enums import AngularDirection as AngularDirection, ContinuityLevel as ContinuityLevel, GeomType as GeomType, Keep as Keep, LengthMode as LengthMode, Mode as Mode, Sagitta as Sagitta, Side as Side, Tangency as Tangency
from build123d.build_line import BuildLine as BuildLine
from build123d.geometry import Axis as Axis, Location as Location, Plane as Plane, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike
from build123d.topology import Curve as Curve, Edge as Edge, Face as Face, Vertex as Vertex, Wire as Wire
from build123d.topology.shape_core import Shape as Shape, ShapeList as ShapeList
from collections.abc import Callable as Callable, Iterable
from typing import overload

class BaseCurveObject(Curve):
    """BaseCurveObject specialized for Curve.

    Args:
        curve (Wire): wire to create
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, curve: Curve, mode: Mode = ...) -> None: ...

class BaseLineObject(Wire):
    """BaseLineObject specialized for Wire.

    Args:
        curve (Wire): wire to create
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, curve: Wire, mode: Mode = ...) -> None: ...

class BaseEdgeObject(Edge):
    """BaseEdgeObject specialized for Edge.

    Args:
        curve (Edge): edge to create
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, curve: Edge, mode: Mode = ...) -> None: ...

class Airfoil(BaseLineObject):
    """
    Create an airfoil described by a 4-digit (or fractional) NACA airfoil
    (e.g. '2412' or '2213.323').

    The NACA four-digit wing sections define the airfoil_code by:
    - First digit describing maximum camber as percentage of the chord.
    - Second digit describing the distance of maximum camber from the airfoil leading edge
    in tenths of the chord.
    - Last two digits describing maximum thickness of the airfoil as percent of the chord.

    Args:
        airfoil_code : str
            The NACA 4-digit (or fractional) airfoil code (e.g. '2213.323').
        n_points : int
            Number of points per upper/lower surface.
        finite_te : bool
            If True, enforces a finite trailing edge (default False).
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    """
    @staticmethod
    def parse_naca4(value: str | float) -> tuple[float, float, float]:
        """
        Parse NACA 4-digit (or fractional) airfoil code into parameters.
        """
    code: str
    max_camber: float
    camber_pos: float
    thickness: float
    finite_te: bool
    def __init__(self, airfoil_code: str, n_points: int = 50, finite_te: bool = False, mode: Mode = ...) -> None: ...
    @property
    def camber_line(self) -> Edge:
        """Camber line of the airfoil as an Edge."""

class Bezier(BaseEdgeObject):
    """Line Object: Bezier Curve

    Create a non-rational bezier curve defined by a sequence of points and include optional
    weights to create a rational bezier curve. The number of weights must match the number
    of control points.

    Args:
        cntl_pnts (sequence[VectorLike]): points defining the curve
        weights (list[float], optional): control point weights. Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, *cntl_pnts: VectorLike, weights: list[float] | None = None, mode: Mode = ...) -> None: ...

class BlendCurve(BaseEdgeObject):
    '''Line Object: BlendCurve

    Create a smooth Bézier-based transition curve between two existing edges.

    The blend is constructed as a cubic (C1) or quintic (C2) Bézier curve
    whose control points are determined from the position, first derivative,
    and (for C2) second derivative of the input curves at the chosen endpoints.
    Optional scalar multipliers can be applied to the endpoint tangents to
    control the "tension" of the blend.

    Args:
        curve0 (Edge): First curve to blend from.
        curve1 (Edge): Second curve to blend to.
        continuity (ContinuityLevel, optional):
            Desired geometric continuity at the join:
            - ContinuityLevel.C0: position match only (straight line)
            - ContinuityLevel.C1: match position and tangent direction (cubic Bézier)
            - ContinuityLevel.C2: match position, tangent, and curvature (quintic Bézier)
            Defaults to ContinuityLevel.C2.
        end_points (tuple[VectorLike, VectorLike] | None, optional):
            Pair of points specifying the connection points on `curve0` and `curve1`.
            Each must coincide (within TOLERANCE) with the start or end of the
            respective curve. If None, the closest pair of endpoints is chosen.
            Defaults to None.
        tangent_scalars (tuple[float, float] | None, optional):
            Scalar multipliers applied to the first derivatives at the start
            of `curve0` and the end of `curve1` before computing control points.
            Useful for adjusting the pull/tension of the blend without altering
            the base curves. Defaults to (1.0, 1.0).
        mode (Mode, optional): Boolean operation mode when used in a
            BuildLine context. Defaults to Mode.ADD.

    Raises:
        ValueError: `tangent_scalars` must be a pair of float values.
        ValueError: If specified `end_points` are not coincident with the start
            or end of their respective curves.

    Example:
        >>> blend = BlendCurve(curve_a, curve_b, ContinuityLevel.C1, tangent_scalars=(1.2, 0.8))
        >>> show(blend)
    '''
    def __init__(self, curve0: Edge, curve1: Edge, continuity: ContinuityLevel = ..., end_points: tuple[VectorLike, VectorLike] | None = None, tangent_scalars: tuple[float, float] | None = None, mode: Mode = ...) -> None: ...

class BSpline(BaseEdgeObject):
    """Line Object: BSpline

    An exact B-spline edge defined directly from control points and knot data.

    BSpline creates an exact B-spline from control points, a knot sequence, and
    optional weights. Control points define the control polygon that pulls the curve,
    but the curve does not generally pass through them. Knots define the parameter-space
    structure of the spline: they determine where polynomial spans begin and
    end and how smoothly those spans join. Repeated knot values indicate knot multiplicity.
    For a spline of degree p, a knot with multiplicity m has continuity
    C^(p-m) at that location, so increasing multiplicity reduces smoothness. Repeating the
    first and last knots degree + 1 times creates a clamped spline that
    starts and ends at the first and last control points. Optional weights create a
    rational B-spline, allowing some control points to pull more strongly than
    others and enabling exact representation of conic sections.`

    Unlike :class:`~build123d.objects_curve.Spline`, which creates an interpolated curve
    through a set of points using ``GeomAPI_Interpolate``, ``BSpline`` preserves
    the supplied spline definition by building the underlying OCCT
    ``Geom_BSplineCurve`` from its poles, knot vector, optional weights,
    degree, and periodic flag.

    Args:
        control_points (Iterable[VectorLike]): Control points (poles) defining the
            spline shape. These are not generally points on the curve.
        knots (Iterable[float]): Knot sequence for the spline. Repeated knot
            values are allowed and are converted internally into unique knot
            values plus multiplicities as required by OCCT.
        degree (int): Polynomial degree of the spline.
        weights (Iterable[float] | None, optional): Optional per-control-point
            weights for rational B-splines. If omitted, the spline is
            non-rational.
        periodic (bool, optional): Whether to create a periodic spline. Defaults
            to ``False``.
        mode (Mode, optional): Builder combination mode. Defaults to ``Mode.ADD``.

    """
    def __init__(self, control_points: Iterable[VectorLike], knots: Iterable[float], degree: int, weights: Iterable[float] | None = None, periodic: bool = False, mode: Mode = ...) -> None: ...

class CenterArc(BaseEdgeObject):
    """Line Object: Center Arc

    Create a circular arc defined by a center point and radius.

    Args:
        center (VectorLike): center point of arc
        radius (float): arc radius
        start_angle (float): arc starting angle from x-axis
        arc_size (float | Shape | Axis | Location | Plane | VectorLike): angular size
            of arc or an arc limit.

            When a limit object is provided instead of a numeric angular size, CenterArc
            constructs the valid arc(s) from the given start point, trims them at their
            first intersection with the limit, and returns the one requiring the shortest
            travel from the start. Therefore, one can only generate arcs < 180° using a limit.
            If neither valid arc intersects the limit, a ValueError is raised.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, center: VectorLike, radius: float, start_angle: float, arc_size: float | Shape | Axis | Location | Plane | VectorLike, mode: Mode = ...) -> None: ...

class ConstrainedArcs(BaseCurveObject):
    """Line Object: Arc(s) constrained by other geometric objects.

    The result is always a Curve containing one or more Edges. If you need
    to access Edge-specific properties or methods (such as ``arc_center``),
    extract the edge or edges first::

        result = ConstrainedArcs(...)
        arc = result.edge()           # extract the Edge
        center = arc.arc_center       # now Edge methods are available

    Note that in Builder mode the ``selector`` parameter must be provided or
    all results will be combined into the BuildLine context. In Algebra mode
    the selector can be applied as a parameter or in the normal way to the
    ConstrainedArcs object. The content of the selector is the same in both cases.

    Examples:
        An arc built from three edge constraints.

        Algebra::

            l4 = PolarLine((0, 0), 4, 60)
            l5 = PolarLine((0, 0), 4, 40)
            a3 = CenterArc((0, 0), 4, 0, 90)
            ex_a3 = (
                ConstrainedArcs(l4, l5, a3, sagitta=Sagitta.BOTH).edges().sort_by(Edge.length)[0]
            )

        Builder::

            with BuildLine() as arc_ex3:
                l4 = PolarLine((0, 0), 4, 60)
                l5 = PolarLine((0, 0), 4, 40)
                a3 = CenterArc((0, 0), 4, 0, 90)
                ex_a3 = ConstrainedArcs(
                    l4,
                    l5,
                    a3,
                    sagitta=Sagitta.BOTH,
                    selector=lambda arcs: arcs.sort_by(Edge.length)[0],
                )

    """
    @overload
    def __init__(self, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_two: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, radius: float, sagitta: Sagitta = ..., selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create all planar circular arcs of a given radius that are tangent/contacting
        the two provided objects on the XY plane.

        Args:
            tangency_one, tangency_two
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entities to be contacted/touched by the circle(s)
            radius (float): arc radius
            sagitta (LengthConstraint, optional): returned arc selector
                (i.e. either the short, long or both arcs). Defaults to
                LengthConstraint.SHORT.
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda arcs: arcs.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            Accept all results (default behaviour)::

                a1 = CenterArc((-5, 0), 4, 0, 360)
                a2 = CenterArc((5, 0), 3, 0, 360)
                arcs = ConstrainedArcs(a1, a2, radius=10, selector=lambda arcs: arcs)
        """
    @overload
    def __init__(self, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_two: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, center_on: Axis | Edge, sagitta: Sagitta = ..., selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create all planar circular arcs whose circle is tangent to two objects and whose
        CENTER lies on a given locus (line/circle/curve) on the XY plane.

        Args:
            tangency_one, tangency_two
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entities to be contacted/touched by the circle(s)
            center_on (Axis | Edge): center must lie on this object
            sagitta (LengthConstraint, optional): returned arc selector
                (i.e. either the short, long or both arcs). Defaults to
                LengthConstraint.SHORT.
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda arcs: arcs.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            Pick just the first result::

                l2 = PolarLine((0, 0), 4, -20, length_mode=LengthMode.HORIZONTAL)
                l3 = Line((4, -2), (4, 2))
                arcs = ConstrainedArcs(
                    l2, l3, center_on=Axis((3, 0), (0, 1)), selector=lambda arcs: arcs[0]
                )
        """
    @overload
    def __init__(self, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_two: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_three: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, sagitta: Sagitta = ..., selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create planar circular arc(s) on XY tangent to three provided objects.

        Args:
            tangency_one, tangency_two, tangency_three
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entities to be contacted/touched by the circle(s)
            sagitta (LengthConstraint, optional): returned arc selector
                (i.e. either the short, long or both arcs). Defaults to
                LengthConstraint.SHORT.
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda arcs: arcs.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            Pick the shortest one::

                l4 = PolarLine((0, 0), 4, 60)
                l5 = PolarLine((0, 0), 4, 40)
                a3 = CenterArc((0, 0), 4, 0, 90)
                arcs = ConstrainedArcs(
                    l4, l5, a3, sagitta=Sagitta.BOTH,
                    selector=lambda arcs: arcs.sort_by(Edge.length)[0]
                )

        """
    @overload
    def __init__(self, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, center: VectorLike, selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create planar circle(s) on XY whose center is fixed and that are tangent/contacting
        a single object.

        Args:
            tangency_one
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entity to be contacted/touched by the circle(s)
            center (VectorLike): center position
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda arcs: arcs.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.


        Example:
            Pick the only result::

                arcs = ConstrainedArcs(Axis.Y, center=(-2, 1), selector=lambda arcs: arcs[0])

        """
    @overload
    def __init__(self, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, radius: float, center_on: Edge, selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """

        Create planar circle(s) on XY that:
        - are tangent/contacting a single object, and
        - have a fixed radius, and
        - have their CENTER constrained to lie on a given locus curve.

        Args:
            tangency_one
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entity to be contacted/touched by the circle(s)
            radius (float): arc radius
            center_on (Axis | Edge): center must lie on this object
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda arcs: arcs.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            There is only one result so a selector isn't helpful::

                l6 = PolarLine((0, 0), 5, -20)
                l7 = Line((3, -2), (3, 2))
                arcs = ConstrainedArcs(l6, radius=1, center_on=l7)

        """

class ConstrainedLines(BaseCurveObject):
    """Line Object: Lines(s) constrained by other geometric objects.

    The result is always a Curve containing one or more Edges. If you need
    to access Edge-specific properties or methods (such as ``length``),
    extract the edge or edges first::

        result = ConstrainedLines(...)
        lines = result.edges()      # extract the Edges
        length = lines[1].length    # now Edge methods are available

    Note that in Builder mode the ``selector`` parameter must be provided or
    all results will be combined into the BuildLine context. In Algebra mode
    the selector can be applied as a parameter or in the normal way to the
    ConstrainedArcs object. The content of the selector is the same in both cases.
    """
    @overload
    def __init__(self, tangency_one: tuple[Edge, Tangency] | Axis | Edge, tangency_two: tuple[Edge, Tangency] | Axis | Edge, *, selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create all planar line(s) on the XY plane tangent to two provided curves.

        Args:
            tangency_one, tangency_two
                (tuple[Edge, Tangency] | Axis | Edge):
                Geometric entities to be contacted/touched by the line(s).
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda lines: lines.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            Accept all results (default behaviour)::

                a1 = CenterArc((-5, 0), 4, 0, 360)
                a2 = CenterArc((5, 0), 3, 0, 360)
                lines = ConstrainedLines(a1, a2, selector=lambda lines: lines)
        """
    @overload
    def __init__(self, tangency_one: tuple[Edge, Tangency] | Edge, tangency_two: VectorLike, *, selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create all planar line(s) on the XY plane tangent to one curve and passing
        through a fixed point.

        Args:
            tangency_one
                (tuple[Edge, Tangency] | Edge):
                Geometric entity to be contacted/touched by the line(s).
            tangency_two (VectorLike):
                Fixed point through which the line(s) must pass.
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda lines: lines.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            Pick just the first result::

                a1 = CenterArc((-5, 0), 4, 0, 360)
                lines = ConstrainedLines(a1, (0, 6), selector=lambda lines: lines[0])
        """
    @overload
    def __init__(self, tangency_one: tuple[Edge, Tangency] | Edge, tangency_two: Axis, *, angle: float | None = None, direction: VectorLike | None = None, selector: Callable[[ShapeList[Edge]], Edge | ShapeList[Edge]] = ..., mode: Mode = ...) -> None:
        """
        Create all planar line(s) on the XY plane tangent to one curve with a
        fixed orientation, defined either by an angle measured from a reference
        axis or by a direction vector.

        Args:
            tangency_one (Edge): edge that line will be tangent to
            tangency_two (Axis): reference axis from which the angle is measured
            angle : float, optional
                Line orientation in degrees (measured CCW from the X-axis).
            direction : VectorLike, optional
                Direction vector for the line (only X and Y components are used).
            Note: one of angle or direction must be provided
            selector (Callable, optional): typically a lambda which chooses one or more of the
                results. Defaults to lambda lines: lines.
            mode (Mode, optional): combination mode. Defaults to Mode.ADD.

        Example:
            Pick the arc whose midpoint is closest to a given point::

                a1 = CenterArc((-5, 0), 4, 0, 360)
                lines = ConstrainedLines(
                    a1,
                    Axis.Y,
                    angle=30,
                    selector=lambda lines: lines.sort_by_distance((0, 0))[0],
                )
        """

class DoubleTangentArc(BaseEdgeObject):
    """Line Object: Double Tangent Arc

    Create a circular arc defined by a point/tangent pair and another line find a tangent to.

    The arc specified with TOP or BOTTOM depends on the geometry and isn't predictable.

    Contains a solver.

    Args:
        pnt (VectorLike): start point
        tangent (VectorLike): tangent at start point
        other (Curve | Edge | Wire): line object to tangent
        keep (Keep, optional): specify which arc if more than one, TOP or BOTTOM.
            Defaults to Keep.TOP
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        RunTimeError: no double tangent arcs found
    """
    def __init__(self, pnt: VectorLike, tangent: VectorLike, other: Curve | Edge | Wire, keep: Keep = ..., mode: Mode = ...) -> None: ...

class EllipticalCenterArc(BaseEdgeObject):
    """Line Object: Elliptical Center Arc

    Create an elliptical arc defined by a center point, x- and y- radii.

    Args:
        center (VectorLike): ellipse center
        x_radius (float): x radius of the ellipse (along the x-axis of plane)
        y_radius (float): y radius of the ellipse (along the y-axis of plane)
        start_angle (float, optional): arc start angle from x-axis.
            Defaults to 0.0
        end_angle (float | None): arc end angle from x-axis.
            Defaults to None
        arc_size (float | Shape | Axis | Location | Plane | VectorLike): angular size
            of arc (negative to change direction) or an arc limit.

            When a limit object is provided instead of a numeric angular size,
            EllipticalCenterArc constructs the valid arc(s) from the given start
            point, trims them at their first intersection with the limit, and
            returns the one requiring the shortest travel from the start.
            Therefore, one can only generate arcs < 180° using a limit. If
            neither valid arc intersects the limit, a ValueError is raised.
        rotation (float, optional): angle to rotate arc. Defaults to 0.0
        angular_direction (AngularDirection | None): arc direction.
            Defaults to None.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    """
    def __init__(self, center: VectorLike, x_radius: float, y_radius: float, start_angle: float = 0.0, end_angle: float | None = None, *, arc_size: float | Shape | Axis | Location | Plane | VectorLike = 90.0, rotation: float = 0.0, angular_direction: AngularDirection | None = None, mode: Mode = ...) -> None: ...

class EllipticalStartArc(BaseEdgeObject):
    """Line Object: EllipticalStartArc

    Create a circular arc defined by a start point/tangent pair, radius and arc size.

    Args:
        start_pnt (VectorLike): start point
        start_tangent (VectorLike): tangent at start point
        x_radius (float): x radius of the ellipse (along the x-axis of plane)
        y_radius (float): y radius of the ellipse (along the y-axis of plane)
        arc_size (float): angular size of arc (negative to change direction)
        start_angle (float): angular position of the start point
        major_axis_dir (VectorLike): direction of ellipse x-axis
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Note:
        One of start_angle or major_axis_dir must be provided.
    """
    def __init__(self, start_pnt: VectorLike, start_tangent: VectorLike, x_radius: float, y_radius: float, arc_size: float, *, start_angle: float | None = None, major_axis_dir: VectorLike | None = None, mode: Mode = ...) -> None: ...

class ParabolicCenterArc(BaseEdgeObject):
    """Line Object: Parabolic Center Arc

    Create a parabolic arc defined by a vertex point and focal length
    (distance from focus to vertex).

    Args:
        vertex (VectorLike): parabola vertex
        focal_length (float): focal length the parabola (distance from the
            vertex to focus along the x-axis of plane)
        start_angle (float, optional): arc start angle.
            Defaults to 0.0
        end_angle (float | None, optional): arc end angle.
            Defaults to None
        arc_size (float | Shape | Axis | Location | Plane | VectorLike): angular size
            of arc (negative to change direction) or an arc limit.

            When a limit object is provided instead of a numeric angular size,
            ParabolicCenterArc constructs candidate arcs from the given start
            point, trims them at their first intersection with the limit, and
            returns the one requiring the shortest travel from the start. If
            neither valid arc intersects the limit, a ValueError is raised.
        rotation (float, optional): angle to rotate arc. Defaults to 0.0
        angular_direction (AngularDirection | None, optional): arc direction.
            Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, vertex: VectorLike, focal_length: float, start_angle: float = 0.0, end_angle: float | None = None, *, arc_size: float | Shape | Axis | Location | Plane | VectorLike = 90.0, rotation: float = 0.0, angular_direction: AngularDirection | None = None, mode: Mode = ...) -> None: ...

class HyperbolicCenterArc(BaseEdgeObject):
    """Line Object: Hyperbolic Center Arc

    Create a hyperbolic arc defined by a center point and focal length
    (distance from focus to vertex).

    Args:
        center (VectorLike): hyperbola center
        x_radius (float): x radius of the ellipse (along the x-axis of plane)
        y_radius (float): y radius of the ellipse (along the y-axis of plane)
        start_angle (float, optional): arc start angle from x-axis.
            Defaults to 0.0
        end_angle (float | None, optional): arc end angle from x-axis.
            Defaults to None
        arc_size (float | Shape | Axis | Location | Plane | VectorLike): angular size
            of arc (negative to change direction) or an arc limit.

            When a limit object is provided instead of a numeric angular size,
            HyperbolicCenterArc constructs candidate arcs from the given start
            point, trims them at their first intersection with the limit, and
            returns the one requiring the shortest travel from the start. If
            neither valid arc intersects the limit, a ValueError is raised.
        rotation (float, optional): angle to rotate arc. Defaults to 0.0
        angular_direction (AngularDirection | None, optional): arc direction.
            Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, center: VectorLike, x_radius: float, y_radius: float, start_angle: float = 0.0, end_angle: float | None = None, *, arc_size: float | Shape | Axis | Location | Plane | VectorLike = 90.0, rotation: float = 0.0, angular_direction: AngularDirection | None = None, mode: Mode = ...) -> None: ...

class Helix(BaseEdgeObject):
    """Line Object: Helix

    Create a helix defined by pitch, height, and radius. The helix may have a taper
    defined by cone_angle.

    If cone_angle is not 0, radius is the initial helix radius at center. cone_angle > 0
    increases the final radius. cone_angle < 0 decreases the final radius.

    Args:
        pitch (float): distance between loops
        height (float): helix height
        radius (float): helix radius
        center (VectorLike, optional): center point. Defaults to (0, 0, 0)
        direction (VectorLike, optional): direction of central axis. Defaults to (0, 0, 1)
        cone_angle (float, optional): conical angle from direction.
            Defaults to 0
        lefthand (bool, optional): left handed helix. Defaults to False
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, pitch: float, height: float, radius: float, center: VectorLike = (0, 0, 0), direction: VectorLike = (0, 0, 1), cone_angle: float = 0, lefthand: bool = False, mode: Mode = ...) -> None: ...

class FilletPolyline(BaseLineObject):
    """Line Object: Fillet Polyline
    Create a sequence of straight lines defined by successive points that are filleted
    to a given radius.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of two or more points
        radius (float | Iterable[float]): radius to fillet at each vertex or a
            single value for all vertices.
            A radius of 0 will create a sharp corner (vertex without fillet).

        close (bool, optional): close end points with extra Edge and corner fillets.
            Defaults to False

        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Two or more points not provided
        ValueError: radius must be non-negative
    """
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], radius: float | Iterable[float], close: bool = False, mode: Mode = ...) -> None: ...

class JernArc(BaseEdgeObject):
    """Line Object: Jern Arc

    Create a circular arc defined by a start point/tangent pair, radius and arc size or arc limit.

    Args:
        start (VectorLike): start point
        tangent (VectorLike): tangent at start point
        radius (float): arc radius
        arc_size (float | Shape | Axis | Location | Plane | VectorLike): angular size
            of arc (negative to change direction) or an arc limit.

            When a limit object is provided instead of a numeric angular size, JernArc
            constructs the valid tangent arc(s) from the given start point and tangent,
            trims them at their first intersection with the limit, and returns the one
            requiring the shortest travel from the start. If neither valid arc intersects
            the limit, a ValueError is raised.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Attributes:
        start (Vector): start point
        end_of_arc (Vector): end point of arc
        center_point (Vector): center of arc
    """
    start: Incomplete
    center_point: Incomplete
    end_of_arc: Incomplete
    def __init__(self, start: VectorLike, tangent: VectorLike, radius: float, arc_size: float | Shape | Axis | Location | Plane | VectorLike, mode: Mode = ...) -> None: ...

class Line(BaseEdgeObject):
    """Line Object: Line

    Create a straight line defined by two points.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of two points
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Two point not provided
    """
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], mode: Mode = ...) -> None: ...

class IntersectingLine(BaseEdgeObject):
    """Intersecting Line Object: Line

    Create a straight line defined by a point/direction pair and another line to intersect.

    Args:
        start (VectorLike): start point
        direction (VectorLike): direction to make line
        other (Edge): line object to intersect
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    """
    def __init__(self, start: VectorLike, direction: VectorLike, other: Curve | Edge | Wire, mode: Mode = ...) -> None: ...

class PolarLine(BaseEdgeObject):
    """Line Object: Polar Line

    Create a straight line defined by a start point, length, and angle.
    The length can specify the DIAGONAL, HORIZONTAL, or VERTICAL component of the triangle
    defined by the angle.

    Alternatively, the length parameter can contain a limit to the length of the line
    in the form of another object. If the PolarLine doesn't contact the limit an error
    will be generated.

    Example:

        p = PolarLine(start=(2, 0), length=Axis.Y, angle=135)

    Args:
        start (VectorLike): start point
        length (float | Shape | Axis | Location | Plane | VectorLike): line length (float) or
            limit limit
        angle (float, optional): angle from the local x-axis
        direction (VectorLike, optional): vector direction to determine angle
        length_mode (LengthMode, optional): how length defines the line.
            Defaults to LengthMode.DIAGONAL
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Either angle or direction must be provided
        ValueError: Polar line doesn't intersect length limit

    """
    def __init__(self, start: VectorLike, length: float | Shape | Axis | Location | Plane | VectorLike, angle: float | None = None, direction: VectorLike | None = None, length_mode: LengthMode = ..., mode: Mode = ...) -> None: ...

class Polyline(BaseLineObject):
    """Line Object: Polyline

    Create a sequence of straight lines defined by successive points.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of two or more points
        close (bool, optional): close by generating an extra Edge. Defaults to False
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Two or more points not provided
    """
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], close: bool = False, mode: Mode = ...) -> None: ...

class RadiusArc(BaseEdgeObject):
    """Line Object: Radius Arc

    Create a circular arc defined by two points and a radius.

    Args:
        start_point (VectorLike): start point
        end_point (VectorLike): end point
        radius (float): arc radius
        short_sagitta (bool): If True selects the short sagitta (height of arc from
            chord), else the long sagitta crossing the center. Defaults to True
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Insufficient radius to connect end points
    """
    def __init__(self, start_point: VectorLike, end_point: VectorLike, radius: float, short_sagitta: bool = True, mode: Mode = ...) -> None: ...

class SagittaArc(BaseEdgeObject):
    """Line Object: Sagitta Arc

    Create a circular arc defined by two points and the sagitta (height of the arc from chord).

    Args:
        start_point (VectorLike): start point
        end_point (VectorLike): end point
        sagitta (float): arc height from chord between points
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, start_point: VectorLike, end_point: VectorLike, sagitta: float, mode: Mode = ...) -> None: ...

class Spline(BaseEdgeObject):
    """Line Object: Spline

    Create a spline defined by a sequence of points, optionally constrained by tangents.
    Tangents and tangent scalars must have length of 2 for only the end points or a length
    of the number of points.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of two or more points
        tangents (Iterable[VectorLike], optional): tangent directions. Defaults to None
        tangent_scalars (Iterable[float], optional): tangent scales. Defaults to None
        periodic (bool, optional): make the spline periodic (closed). Defaults to False
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], tangents: Iterable[VectorLike] | None = None, tangent_scalars: Iterable[float] | None = None, periodic: bool = False, mode: Mode = ...) -> None: ...

class TangentArc(BaseEdgeObject):
    """Line Object: Tangent Arc

    Create a circular arc defined by two points and a tangent.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of two points
        tangent (VectorLike): tangent to constrain arc
        tangent_from_first (bool, optional): apply tangent to first point. Applying
            tangent to end point will flip the orientation of the arc. Defaults to True
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Two points are required
    """
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], tangent: VectorLike, tangent_from_first: bool = True, mode: Mode = ...) -> None: ...

class ThreePointArc(BaseEdgeObject):
    """Line Object: Three Point Arc

    Create a circular arc defined by three points.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of three points
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Three points must be provided
    """
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], mode: Mode = ...) -> None: ...

class PointArcTangentLine(BaseEdgeObject):
    """Line Object: Point Arc Tangent Line

    Create a straight, tangent line from a point to a circular arc.

    Args:
        point (VectorLike): intersection point for tangent
        arc (Curve | Edge | Wire): circular arc to tangent, must be GeomType.CIRCLE
        side (Side, optional): side of arcs to place tangent arc center, LEFT or RIGHT.
            Defaults to Side.LEFT
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, point: VectorLike, arc: Curve | Edge | Wire, side: Side = ..., mode: Mode = ...) -> None: ...

class PointArcTangentArc(BaseEdgeObject):
    """Line Object: Point Arc Tangent Arc

    Create an arc defined by a point/tangent pair and another line which the other end
    is tangent to.

    Args:
        point (VectorLike): starting point of tangent arc
        direction (VectorLike): direction at starting point of tangent arc
        arc (Union[Curve, Edge, Wire]): ending arc, must be GeomType.CIRCLE
        side (Side, optional): select which arc to keep Defaults to Side.LEFT
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Arc must have GeomType.CIRCLE
        ValueError: Point is already tangent to arc
        RuntimeError: No tangent arc found
    """
    def __init__(self, point: VectorLike, direction: VectorLike, arc: Curve | Edge | Wire, side: Side = ..., mode: Mode = ...) -> None: ...

class ArcArcTangentLine(BaseEdgeObject):
    """Line Object: Arc Arc Tangent Line

    Create a straight line tangent to two arcs.

    Args:
        start_arc (Curve | Edge | Wire): starting arc, must be GeomType.CIRCLE
        end_arc (Curve | Edge | Wire): ending arc, must be GeomType.CIRCLE
        side (Side): side of arcs to place tangent arc center, LEFT or RIGHT.
            Defaults to Side.LEFT
        keep (Keep): which tangent arc to keep, INSIDE or OUTSIDE.
            Defaults to Keep.INSIDE
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, start_arc: Curve | Edge | Wire, end_arc: Curve | Edge | Wire, side: Side = ..., keep: Keep = ..., mode: Mode = ...) -> None: ...

class ArcArcTangentArc(BaseEdgeObject):
    """Line Object: Arc Arc Tangent Arc

    Create an arc tangent to two arcs and a radius.

    keep specifies tangent arc position with a Keep pair: (placement, type)

    - placement: start_arc is tangent INSIDE or OUTSIDE the tangent arc. BOTH is a
      special case for overlapping arcs with type INSIDE
    - type: tangent arc is INSIDE or OUTSIDE start_arc and end_arc

    Args:
        start_arc (Curve | Edge | Wire): starting arc, must be GeomType.CIRCLE
        end_arc (Curve | Edge | Wire): ending arc, must be GeomType.CIRCLE
        radius (float): radius of tangent arc
        side (Side): side of arcs to place tangent arc center, LEFT or RIGHT.
            Defaults to Side.LEFT
        keep (Keep | tuple[Keep, Keep]): which tangent arc to keep, INSIDE or OUTSIDE.
            Defaults to (Keep.INSIDE, Keep.INSIDE)
        short_sagitta (bool): If True selects the short sagitta (height of arc from
            chord), else the long sagitta crossing the center. Defaults to True
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    def __init__(self, start_arc: Curve | Edge | Wire, end_arc: Curve | Edge | Wire, radius: float, side: Side = ..., keep: Keep | tuple[Keep, Keep] = ..., short_sagitta: bool = True, mode: Mode = ...) -> None: ...
