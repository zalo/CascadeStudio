from .composite import Compound as Compound, Curve as Curve, Part as Part, Sketch as Sketch
from .shape_core import Shape as Shape, ShapeList as ShapeList, SkipClean as SkipClean, TOPODS as TOPODS, downcast as downcast, get_top_level_topods_shapes as get_top_level_topods_shapes, shapetype as shapetype, topods_dim as topods_dim, unwrap_topods_compound as unwrap_topods_compound
from .three_d import Solid as Solid
from .two_d import Face as Face, Shell as Shell
from .utils import isclose_b as isclose_b
from .zero_d import Vertex as Vertex, topo_explore_common_vertex as topo_explore_common_vertex
from OCP.BRepAdaptor import BRepAdaptor_CompCurve, BRepAdaptor_Curve
from OCP.Geom import Geom_Surface as Geom_Surface
from OCP.Geom2d import Geom2d_Curve as Geom2d_Curve
from OCP.GeomFill import GeomFill_TrihedronLaw as GeomFill_TrihedronLaw
from OCP.TopoDS import TopoDS_Edge, TopoDS_Face, TopoDS_Shape as TopoDS_Shape, TopoDS_Wire
from build123d.build_enums import AngularDirection as AngularDirection, CenterOf as CenterOf, ContinuityLevel as ContinuityLevel, FrameMethod as FrameMethod, GeomType as GeomType, Kind as Kind, PositionMode as PositionMode, Sagitta as Sagitta, Side as Side, Tangency as Tangency
from build123d.geometry import Axis as Axis, Color as Color, DEG2RAD as DEG2RAD, Location as Location, Plane as Plane, TOLERANCE as TOLERANCE, TOL_DIGITS as TOL_DIGITS, Vector as Vector, VectorLike as VectorLike, logger as logger
from collections.abc import Iterable
from dataclasses import dataclass
from typing import overload
from typing_extensions import Self

@dataclass(frozen=True)
class _WireFilletCorner:
    """Context needed to fillet a single planar wire corner."""
    wire: Wire
    vertex: Vertex
    all_edges: ShapeList[Edge]
    connected_edges: ShapeList[Edge]
    connected_edge_indices: list[int]

@dataclass(frozen=True)
class _WireFilletSolution:
    """Replacement edges for a filleted wire corner."""
    trimmed_topods_edges: list[TopoDS_Edge]
    fillet_topods_edge: TopoDS_Edge

CANONICAL_SAMPLES: int
CANONICAL_BAND: float

class CanonicalForm:
    """Canonical traversal of a 1D shape (build123d-lite extension).

    start: arc-length position (normalized) of the canonical start point —
    always 0.0 for open shapes. sign: +1 if the current direction is already
    canonical, -1 if it must be traversed backwards. closed: whether the
    shape was treated as a closed loop. Iterable and tuple-comparable."""
    start: float
    sign: int
    closed: bool
    def __init__(self, start: float, sign: int, closed: bool) -> None: ...
    def __iter__(self): ...

def canonical_form(sampler, length: float, closed: bool, samples: int = ..., band: float = ...) -> CanonicalForm:
    """Canonical traversal of a curve given an arc-length sampler
    (build123d-lite extension — see the canonical free-edge rule)."""

def lexicographic_key(point) -> tuple:
    """Rounded (x, y, z) sort key used by the canonical free-edge rule
    (build123d-lite extension)."""

def loop_area_vector(points) -> Vector:
    """Area vector of a closed sampled loop; its dominant axis picks the
    canonical winding direction (build123d-lite extension)."""

class Mixin1D(Shape[TOPODS]):
    """Methods to add to the Edge and Wire classes"""
    def reversed(self) -> Self:
        """A copy of this Edge/Wire with the opposite orientation
        (the OCCT orientation flag, not a rebuild)."""
    def canonical(self) -> Edge | Wire:
        """This shape re-parametrized canonically: same geometry, start point
        and direction determined by the geometry alone instead of kernel
        construction history (build123d-lite extension; open shapes keep
        their type, a re-seamed closed shape comes back as a single Edge)."""
    def canonical_form(self, samples: int = ...) -> CanonicalForm:
        """The canonical start position (normalized) and direction sign,
        without rebuilding the shape (build123d-lite extension)."""
    @property
    def is_closed(self) -> bool:
        """Are the start and end points equal?"""
    @property
    def is_forward(self) -> bool:
        """Does the Edge/Wire loop forward or reverse"""
    @property
    def is_interior(self) -> bool:
        """
        Check if the edge is an interior edge.

        An interior edge lies between surfaces that are part of the body (internal
        to the geometry) and does not form part of the exterior boundary.

        Returns:
            bool: True if the edge is an interior edge, False otherwise.
        """
    @property
    def length(self) -> float:
        """Edge or Wire length"""
    @property
    def radius(self) -> float:
        """Calculate the radius.

        Note that when applied to a Wire, the radius is simply the radius of the first edge.

        Args:

        Returns:
          radius

        Raises:
          ValueError: if kernel can not reduce the shape to a circular edge

        """
    @property
    def volume(self) -> float:
        """volume - the volume of this Edge or Wire, which is always zero"""
    @classmethod
    def cast(cls, obj: TopoDS_Shape) -> Vertex | Edge | Wire:
        """Returns the right type of wrapper, given a OCCT object"""
    @classmethod
    def extrude(cls, obj: Shape, direction: VectorLike) -> Edge | Face | Shell | Solid | Compound:
        """Unused - only here because Mixin1D is a subclass of Shape"""
    @overload
    def __add__(self, other: None) -> Self: ...
    @overload
    def __add__(self, other: Shape | Iterable[Shape]) -> Edge | Wire | Curve: ...
    def __matmul__(self, position: float) -> Vector:
        """Position on wire operator @"""
    def __mod__(self, position: float) -> Vector:
        """Tangent on wire operator %"""
    def __xor__(self, position: float) -> Location:
        """Location on wire operator ^"""
    def center(self, center_of: CenterOf = ...) -> Vector:
        """Center of object

        Return the center based on center_of

        Args:
            center_of (CenterOf, optional): centering option. Defaults to CenterOf.GEOMETRY.

        Returns:
            Vector: center
        """
    def common_plane(self, *lines: Edge | Wire | None, tolerance: float = ...) -> None | Plane:
        """common_plane

        Find the plane containing all the edges/wires (including self). If there
        is no common plane return None. If the edges are coaxial, select one
        of the infinite number of valid planes.

        Args:
            lines (sequence of Edge | Wire): edges in common with self
            tolerance (float): amount lines can deviate from plane. Defaults to TOLERANCE.

        Returns:
            None |  Plane: Either the common plane or None
        """
    def curvature_comb(self, count: int = 100, max_tooth_size: float | None = None) -> ShapeList[Edge]:
        """
        Build a *curvature comb* for a planar (XY) 1D curve.

        A curvature comb is a set of short line segments (“teeth”) erected
        perpendicular to the curve that visualize the signed curvature κ(u).
        Tooth length is proportional to |κ| and the direction encodes the sign
        (left normal for κ>0, right normal for κ<0). This is useful for inspecting
        fairness and continuity (C0/C1/C2) of edges and wires.

        Args:
            count (int, optional): Number of uniformly spaced samples over the normalized
                parameter. Increase for a denser comb. Defaults to 100.
            max_tooth_size (float | None, optional): Maximum tooth height in model units.
                If None, set to 10% maximum curve dimension. Defaults to None.

        Raises:
            ValueError: Empty curve.
            ValueError: If the curve is not planar on `Plane.XY`.

        Returns:
            ShapeList[Edge]: A list of short `Edge` objects (lines) anchored on the curve
            and oriented along the left normal `n̂ = normalize(t) × +Z`.

        Notes:
            - On circles, κ = 1/R so tooth length is constant.
            - On straight segments, κ = 0 so no teeth are drawn.
            - At inflection points κ→0 and the tooth flips direction.
            - At C0 corners the tangent is discontinuous; nearby teeth may jump.
              C1 yields continuous direction; C2 yields continuous magnitude as well.

        Example:
            >>> comb = my_wire.curvature_comb(count=200, max_tooth_size=2.0)
            >>> show(my_wire, Curve(comb))

        """
    def derivative_at(self, position: float | VectorLike, order: int = 2, position_mode: PositionMode = ...) -> Vector:
        """Derivative At

        Generate a derivative along the underlying curve.

        Args:
            position (float | VectorLike): distance, parameter value or point
            order (int): derivative order. Defaults to 2
            position_mode (PositionMode, optional): position calculation mode. Defaults to
                PositionMode.PARAMETER.

        Raises:
            ValueError: position must be a float or a point

        Returns:
            Vector: position on the underlying curve
        """
    def end_point(self) -> Vector:
        """The end point of this edge.

        Note that circles may have identical start and end points.
        """
    def location_at(self, distance: float, position_mode: PositionMode = ..., frame_method: FrameMethod = ..., x_dir: VectorLike | None = None) -> Location:
        """Locations along curve

        Generate a location along the underlying curve.

        Args:
            distance (float): distance or parameter value
            position_mode (PositionMode, optional): position calculation mode.
                Defaults to PositionMode.PARAMETER.
            frame_method (FrameMethod, optional): moving frame calculation method.
                The FRENET frame can “twist” or flip unexpectedly, especially near flat
                spots. The CORRECTED frame behaves more like a “camera dolly” or
                sweep profile would — it's smoother and more stable.
                Defaults to FrameMethod.FRENET.
            x_dir (VectorLike, optional): override the x_dir to help with plane
                creation along a 1D shape. Must be perpendicular to shapes tangent.
                Defaults to None.

        Returns:
            Location: A Location object representing local coordinate system
                at the specified distance.
        """
    def locations(self, distances: Iterable[float], position_mode: PositionMode = ..., frame_method: FrameMethod = ..., x_dir: VectorLike | None = None) -> list[Location]:
        """Locations along curve

        Generate location along the curve

        Args:
            distances (Iterable[float]): distance or parameter values
            position_mode (PositionMode, optional): position calculation mode.
                Defaults to PositionMode.PARAMETER.
            frame_method (FrameMethod, optional): moving frame calculation method.
                Defaults to FrameMethod.FRENET.
            x_dir (VectorLike, optional): override the x_dir to help with plane
                creation along a 1D shape. Must be perpendicular to shapes tangent.
                Defaults to None.

        Returns:
            list[Location]: A list of Location objects representing local coordinate
                systems at the specified distances.
        """
    def normal(self) -> Vector:
        """Calculate the normal Vector. Only possible for planar curves.

        :return: normal vector

        Args:

        Returns:

        """
    def offset_2d(self, distance: float, kind: Kind = ..., side: Side = ..., closed: bool = True) -> Edge | Wire:
        """2d Offset

        Offsets a planar edge/wire

        Args:
            distance (float): distance from edge/wire to offset
            kind (Kind, optional): offset corner transition. Defaults to Kind.ARC.
            side (Side, optional): side to place offset. Defaults to Side.BOTH.
            closed (bool, optional): if Side!=BOTH, close the LEFT or RIGHT
                offset. Defaults to True.
        Raises:
            RuntimeError: Multiple Wires generated
            RuntimeError: Unexpected result type

        Returns:
            Wire: offset wire
        """
    def perpendicular_line(self, length: float, u_value: float, plane: Plane = ...) -> Edge:
        """perpendicular_line

        Create a line on the given plane perpendicular to and centered on beginning of self

        Args:
            length (float): line length
            u_value (float): position along line between 0.0 and 1.0
            plane (Plane, optional): plane containing perpendicular line. Defaults to Plane.XY.

        Returns:
            Edge: perpendicular line
        """
    def position_at(self, position: float, position_mode: PositionMode = ...) -> Vector:
        """Position At

        Generate a position along the underlying Wire.

        Args:
            position (float): distance or parameter value
            position_mode (PositionMode, optional): position calculation mode. Defaults to
                PositionMode.PARAMETER.

        Returns:
            Vector: position on the underlying curve
        """
    def positions(self, distances: Iterable[float] | None = None, position_mode: PositionMode = ..., deflection: float | None = None) -> list[Vector]:
        """Positions along curve

        Generate positions along the underlying curve

        Args:
            distances (Iterable[float] | None, optional): distance or parameter values.
                Defaults to None.
            position_mode (PositionMode, optional): position calculation mode only applies
                when using distances. Defaults to PositionMode.PARAMETER.
            deflection (float | None, optional): maximum deflection between the curve and
                the polygon that results from the computed points. Defaults to None.


        Returns:
            list[Vector]: positions along curve
        """
    def project(self, face: Face, direction: VectorLike, closest: bool = True) -> Edge | Wire | ShapeList[Edge | Wire]:
        """Project onto a face along the specified direction

        Args:
          face: Face:
          direction: VectorLike:
          closest: bool:  (Default value = True)

        Returns:

        """
    def project_to_viewport(self, viewport_origin: VectorLike, viewport_up: VectorLike = (0, 0, 1), look_at: VectorLike | None = None, focus: float | None = None) -> tuple[ShapeList[Edge], ShapeList[Edge]]:
        """project_to_viewport

        Project a shape onto a viewport returning visible and hidden Edges.

        Args:
            viewport_origin (VectorLike): location of viewport
            viewport_up (VectorLike, optional): direction of the viewport y axis.
                Defaults to (0, 0, 1).
            look_at (VectorLike, optional): point to look at.
                Defaults to None (center of shape).
            focus (float, optional): the focal length for perspective projection
                Defaults to None (orthographic projection)

        Returns:
            tuple[ShapeList[Edge],ShapeList[Edge]]: visible & hidden Edges
        """
    def start_point(self) -> Vector:
        """The start point of this edge

        Note that circles may have identical start and end points.
        """
    def tangent_angle_at(self, location_param: float = 0.5, position_mode: PositionMode = ..., plane: Plane = ...) -> float:
        """tangent_angle_at

        Compute the tangent angle at the specified location

        Args:
            location_param (float, optional): distance or parameter value. Defaults to 0.5.
            position_mode (PositionMode, optional): position calculation mode.
                Defaults to PositionMode.PARAMETER.
            plane (Plane, optional): plane line was constructed on. Defaults to Plane.XY.

        Returns:
            float: angle in degrees between 0 and 360
        """
    def tangent_at(self, position: float | VectorLike = 0.5, position_mode: PositionMode = ...) -> Vector:
        """tangent_at

        Find the tangent at a given position on the 1D shape where the position
        is either a float (or int) parameter or a point that lies on the shape.

        Args:
            position (float |  VectorLike): distance, parameter value, or
                point on shape. Defaults to 0.5.
            position_mode (PositionMode, optional): position calculation mode.
                Defaults to PositionMode.PARAMETER.

        Returns:
            Vector: tangent value
        """

class Edge(Mixin1D[TopoDS_Edge]):
    """An Edge in build123d is a fundamental element in the topological data structure
    representing a one-dimensional geometric entity within a 3D model. It encapsulates
    information about a curve, which could be a line, arc, or other parametrically
    defined shape. Edge is crucial in for precise modeling and manipulation of curves,
    facilitating operations like filleting, chamfering, and Boolean operations. It
    serves as a building block for constructing complex structures, such as wires
    and faces."""
    order: float
    def __init__(self, obj: TopoDS_Edge | Axis | None | None = None, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build an Edge from an OCCT TopoDS_Shape/TopoDS_Edge

        Args:
            obj (TopoDS_Edge | Axis, optional): OCCT Edge or Axis.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @property
    def arc_center(self) -> Vector:
        """center of an underlying circle or ellipse geometry."""
    @classmethod
    def extrude(cls, obj: Vertex, direction: VectorLike) -> Edge:
        """extrude

        Extrude a Vertex into an Edge.

        Args:
            direction (VectorLike): direction and magnitude of extrusion

        Raises:
            ValueError: Unsupported class
            RuntimeError: Generated invalid result

        Returns:
            Edge: extruded shape
        """
    @classmethod
    def make_bezier(cls, *cntl_pnts: VectorLike, weights: list[float] | None = None) -> Edge:
        """make_bezier

        Create a rational (with weights) or non-rational bezier curve.  The first and last
        control points represent the start and end of the curve respectively.  If weights
        are provided, there must be one provided for each control point.

        Args:
            cntl_pnts (sequence[VectorLike]): points defining the curve
            weights (list[float], optional): control point weights list. Defaults to None.

        Raises:
            ValueError: Too few control points
            ValueError: Too many control points
            ValueError: A weight is required for each control point

        Returns:
            Edge: bezier curve
        """
    @classmethod
    def make_circle(cls, radius: float, plane: Plane = ..., start_angle: float = 360.0, end_angle: float = 360, angular_direction: AngularDirection = ...) -> Edge:
        """make circle

        Create a circle centered on the origin of plane

        Args:
            radius (float): circle radius
            plane (Plane, optional): base plane. Defaults to Plane.XY.
            start_angle (float, optional): start of arc angle. Defaults to 360.0.
            end_angle (float, optional): end of arc angle. Defaults to 360.
            angular_direction (AngularDirection, optional): arc direction.
                Defaults to AngularDirection.COUNTER_CLOCKWISE.

        Returns:
            Edge: full or partial circle
        """
    @overload
    @classmethod
    def make_constrained_arcs(cls, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_two: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, radius: float, sagitta: Sagitta = ...) -> ShapeList[Edge]:
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

        Returns:
            ShapeList[Edge]: tangent arcs
        """
    @overload
    @classmethod
    def make_constrained_arcs(cls, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_two: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, center_on: Axis | Edge, sagitta: Sagitta = ...) -> ShapeList[Edge]:
        """
        Create all planar circular arcs whose circle is tangent to two objects and whose
        CENTER lies on a given locus (line/circle/curve) on the XY plane.

        Args:
            tangency_one, tangency_two
                (tuple[Axus | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entities to be contacted/touched by the circle(s)
            center_on (Axis | Edge): center must lie on this object
            sagitta (LengthConstraint, optional): returned arc selector
                (i.e. either the short, long or both arcs). Defaults to
                LengthConstraint.SHORT.

        Returns:
            ShapeList[Edge]: tangent arcs
        """
    @overload
    @classmethod
    def make_constrained_arcs(cls, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_two: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, tangency_three: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, sagitta: Sagitta = ...) -> ShapeList[Edge]:
        """
        Create planar circular arc(s) on XY tangent to three provided objects.

        Args:
            tangency_one, tangency_two, tangency_three
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entities to be contacted/touched by the circle(s)
            sagitta (LengthConstraint, optional): returned arc selector
                (i.e. either the short, long or both arcs). Defaults to
                LengthConstraint.SHORT.

        Returns:
            ShapeList[Edge]: tangent arcs
        """
    @overload
    @classmethod
    def make_constrained_arcs(cls, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, center: VectorLike) -> ShapeList[Edge]:
        """make_constrained_arcs

        Create planar circle(s) on XY whose center is fixed and that are tangent/contacting
        a single object.

        Args:
            tangency_one
                (tuple[Axis | Edge, PositionConstraint] | Axis | Edge | Vertex | VectorLike):
                Geometric entity to be contacted/touched by the circle(s)
            center (VectorLike): center position

        Returns:
            ShapeList[Edge]: tangent arcs
        """
    @overload
    @classmethod
    def make_constrained_arcs(cls, tangency_one: tuple[Axis | Edge, Tangency] | Axis | Edge | Vertex | VectorLike, *, radius: float, center_on: Edge) -> ShapeList[Edge]:
        """make_constrained_arcs

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
            sagitta (LengthConstraint, optional): returned arc selector
                (i.e. either the short, long or both arcs). Defaults to
                LengthConstraint.SHORT.

        Returns:
            ShapeList[Edge]: tangent arcs
        """
    @overload
    @classmethod
    def make_constrained_lines(cls, tangency_one: tuple[Edge, Tangency] | Axis | Edge, tangency_two: tuple[Edge, Tangency] | Axis | Edge) -> ShapeList[Edge]:
        """
        Create all planar line(s) on the XY plane tangent to two provided curves.

        Args:
            tangency_one, tangency_two
                (tuple[Edge, Tangency] | Axis | Edge):
                Geometric entities to be contacted/touched by the line(s).

        Returns:
            ShapeList[Edge]: tangent lines
        """
    @overload
    @classmethod
    def make_constrained_lines(cls, tangency_one: tuple[Edge, Tangency] | Edge, tangency_two: Vector) -> ShapeList[Edge]:
        """
        Create all planar line(s) on the XY plane tangent to one curve and passing
        through a fixed point.

        Args:
            tangency_one
                (tuple[Edge, Tangency] | Edge):
                Geometric entity to be contacted/touched by the line(s).
            tangency_two (Vector):
                Fixed point through which the line(s) must pass.

        Returns:
            ShapeList[Edge]: tangent lines
        """
    @overload
    @classmethod
    def make_constrained_lines(cls, tangency_one: tuple[Edge, Tangency] | Edge, tangency_two: Axis, *, angle: float | None = None, direction: VectorLike | None = None) -> ShapeList[Edge]:
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

        Returns:
            ShapeList[Edge]: tangent lines
        """
    @classmethod
    def make_ellipse(cls, x_radius: float, y_radius: float, plane: Plane = ..., start_angle: float = 360.0, end_angle: float = 360.0, angular_direction: AngularDirection = ...) -> Edge:
        """make ellipse

        Makes an ellipse centered at the origin of plane.

        Args:
            x_radius (float): x radius of the ellipse (along the x-axis of plane)
            y_radius (float): y radius of the ellipse (along the y-axis of plane)
            plane (Plane, optional): base plane. Defaults to Plane.XY.
            start_angle (float, optional): Defaults to 360.0.
            end_angle (float, optional): Defaults to 360.0.
            angular_direction (AngularDirection, optional): arc direction.
                Defaults to AngularDirection.COUNTER_CLOCKWISE.

        Returns:
            Edge: full or partial ellipse
        """
    @classmethod
    def make_parabola(cls, focal_length: float, plane: Plane = ..., start_angle: float = 0.0, end_angle: float = 90.0, angular_direction: AngularDirection = ...) -> Edge:
        """make parabola

        Makes an parabola centered at the origin of plane.

        Args:
            focal_length (float): focal length the parabola (distance from the
                vertex to focus along the x-axis of plane)
            plane (Plane, optional): base plane. Defaults to Plane.XY.
            start_angle (float, optional): Defaults to 0.0.
            end_angle (float, optional): Defaults to 90.0.
            angular_direction (AngularDirection, optional): arc direction.
                Defaults to AngularDirection.COUNTER_CLOCKWISE.

        Returns:
            Edge: full or partial parabola
        """
    @classmethod
    def make_hyperbola(cls, x_radius: float, y_radius: float, plane: Plane = ..., start_angle: float = 360.0, end_angle: float = 360.0, angular_direction: AngularDirection = ...) -> Edge:
        """make hyperbola

        Makes a hyperbola centered at the origin of plane.

        Args:
            x_radius (float): x radius of the hyperbola (along the x-axis of plane)
            y_radius (float): y radius of the hyperbola (along the y-axis of plane)
            plane (Plane, optional): base plane. Defaults to Plane.XY.
            start_angle (float, optional): Defaults to 360.0.
            end_angle (float, optional): Defaults to 360.0.
            angular_direction (AngularDirection, optional): arc direction.
                Defaults to AngularDirection.COUNTER_CLOCKWISE.

        Returns:
            Edge: full or partial hyperbola
        """
    @classmethod
    def make_helix(cls, pitch: float, height: float, radius: float, center: VectorLike = (0, 0, 0), normal: VectorLike = (0, 0, 1), angle: float = 0.0, lefthand: bool = False) -> Wire:
        """make_helix

        Make a helix with a given pitch, height and radius. By default a cylindrical surface is
        used to create the helix. If the :angle: is set (the apex given in degree) a conical
        surface is used instead.

        Args:
            pitch (float): distance per revolution along normal
            height (float): total height
            radius (float):
            center (VectorLike, optional): Defaults to (0, 0, 0).
            normal (VectorLike, optional): Defaults to (0, 0, 1).
            angle (float, optional): conical angle. Defaults to 0.0.
            lefthand (bool, optional): Defaults to False.

        Returns:
            Wire: helix
        """
    @classmethod
    def make_line(cls, point1: VectorLike, point2: VectorLike) -> Edge:
        """Create a line between two points

        Args:
          point1: VectorLike: that represents the first point
          point2: VectorLike: that represents the second point

        Returns:
          A linear edge between the two provided points

        """
    @classmethod
    def make_mid_way(cls, first: Edge, second: Edge, middle: float = 0.5) -> Edge:
        """make line between edges

        Create a new linear Edge between the two provided Edges. If the Edges are parallel
        but in the opposite directions one Edge is flipped such that the mid way Edge isn't
        truncated.

        Args:
            first (Edge): first reference Edge
            second (Edge): second reference Edge
            middle (float, optional): factional distance between Edges. Defaults to 0.5.

        Returns:
            Edge: linear Edge between two Edges
        """
    @classmethod
    def make_spline(cls, points: list[VectorLike], tangents: list[VectorLike] | None = None, periodic: bool = False, parameters: list[float] | None = None, scale: bool = True, tol: float = 1e-06) -> Edge:
        """Spline

        Interpolate a spline through the provided points.

        Args:
            points (list[VectorLike]):  the points defining the spline
            tangents (list[VectorLike], optional): start and finish tangent.
                Defaults to None.
            periodic (bool, optional): creation of periodic curves. Defaults to False.
            parameters (list[float], optional): the value of the parameter at each
                interpolation point. (The interpolated curve is represented as a vector-valued
                function of a scalar parameter.) If periodic == True, then len(parameters)
                must be len(interpolation points) + 1, otherwise len(parameters)
                must be equal to len(interpolation points). Defaults to None.
            scale (bool, optional): whether to scale the specified tangent vectors before
                interpolating. Each tangent is scaled, so it's length is equal to the derivative
                of the Lagrange interpolated curve. I.e., set this to True, if you want to use
                only the direction of the tangent vectors specified by `tangents` , but not
                their magnitude. Defaults to True.
            tol (float, optional): tolerance of the algorithm (consult OCC documentation).
                Used to check that the specified points are not too close to each other, and
                that tangent vectors are not too short. (In either case interpolation may fail.).
                Defaults to 1e-6.

        Raises:
            ValueError: Parameter for each interpolation point
            ValueError: Tangent for each interpolation point
            ValueError: B-spline interpolation failed

        Returns:
            Edge: the spline
        """
    @classmethod
    def make_bspline(cls, control_points: Iterable[VectorLike], knots: Iterable[float], degree: int, weights: Iterable[float] | None = None, periodic: bool = False) -> Edge:
        """Create an exact B-spline edge from control points and knot data.

        Args:
            control_points (Iterable[VectorLike]): Control points (poles) defining
                the spline shape.
            knots (Iterable[float]): Knot sequence for the spline. Repeated knot
                values are converted to unique knot values plus multiplicities.
            degree (int): Polynomial degree of the spline.
            weights (Iterable[float] | None, optional): Optional per-control-point
                weights for rational B-splines. Defaults to ``None``.
            periodic (bool, optional): Whether to create a periodic spline.
                Defaults to ``False``.

        Raises:
            ValueError: B-spline requires at least one knot.

        Returns:
            Edge: the B-spline edge
        """
    @classmethod
    def make_spline_approx(cls, points: list[VectorLike], tol: float = 0.001, smoothing: tuple[float, float, float] | None = None, min_deg: int = 1, max_deg: int = 6) -> Edge:
        """make_spline_approx

        Approximate a spline through the provided points.

        Args:
            points (list[Vector]):
            tol (float, optional): tolerance of the algorithm. Defaults to 1e-3.
            smoothing (Tuple[float, float, float], optional): optional tuple of 3 weights
                use for variational smoothing. Defaults to None.
            min_deg (int, optional): minimum spline degree. Enforced only when smoothing
                is None. Defaults to 1.
            max_deg (int, optional): maximum spline degree. Defaults to 6.

        Raises:
            ValueError: B-spline approximation failed

        Returns:
            Edge: spline
        """
    @classmethod
    def make_tangent_arc(cls, start: VectorLike, tangent: VectorLike, end: VectorLike) -> Edge:
        """Tangent Arc

        Makes a tangent arc from point start, in the direction of tangent and ends at end.

        Args:
            start (VectorLike): start point
            tangent (VectorLike): start tangent
            end (VectorLike): end point

        Returns:
            Edge: circular arc
        """
    @classmethod
    def make_three_point_arc(cls, point1: VectorLike, point2: VectorLike, point3: VectorLike) -> Edge:
        """Three Point Arc

        Makes a three point arc through the provided points

        Args:
            point1 (VectorLike): start point
            point2 (VectorLike): middle point
            point3 (VectorLike): end point

        Returns:
            Edge: a circular arc through the three points
        """
    def close(self) -> Edge | Wire:
        """Close an Edge"""
    def distribute_locations(self, count: int, start: float = 0.0, stop: float = 1.0, positions_only: bool = False) -> list[Location]:
        """Distribute Locations

        Distribute locations along edge or wire.

        Args:
          self: Wire:Edge:
          count(int): Number of locations to generate
          start(float): position along Edge|Wire to start. Defaults to 0.0.
          stop(float): position along Edge|Wire to end. Defaults to 1.0.
          positions_only(bool): only generate position not orientation. Defaults to False.

        Returns:
          list[Location]: locations distributed along Edge|Wire

        Raises:
          ValueError: count must be two or greater

        """
    def find_intersection_points(self, other: Axis | Edge | None = None, tolerance: float = ...) -> ShapeList[Vector]:
        """find_intersection_points

        Determine the points where a 2D edge crosses itself or another 2D edge

        Args:
            other (Axis | Edge): curve to compare with
            tolerance (float, optional): the precision of computing the intersection points.
                 Defaults to TOLERANCE.

        Raises:
            ValueError: empty edge

        Returns:
            ShapeList[Vector]: list of intersection points
        """
    def find_tangent(self, angle: float) -> list[float]:
        """find_tangent

        Find the parameter values of self where the tangent is equal to angle.

        Args:
            angle (float): target angle in degrees

        Returns:
            list[float]: u values between 0.0 and 1.0
        """
    def geom_adaptor(self) -> BRepAdaptor_Curve:
        """Return the Geom Curve from this Edge"""
    def geom_equal(self, other: Edge, tol: float = 1e-06, num_interpolation_points: int = 5) -> bool:
        """Compare two edges for geometric equality within tolerance.

        This compares the geometric properties of two edges, not their topological
        identity. Two independently created edges with the same geometry will
        return True.

        Args:
            other: Edge to compare with
            tol: Tolerance for numeric comparisons. Defaults to 1e-6.
            num_interpolation_points: Number of points to sample for unknown
                curve types. Defaults to 5.

        Returns:
            bool: True if edges are geometrically equal within tolerance
        """
    def param_at(self, position: float) -> float:
        """
        Map a normalized arc-length position to the underlying OCCT parameter.

        Returns the native OCCT curve parameter corresponding to the
        given normalized `position` (0.0 → start, 1.0 → end). For closed/periodic
        edges, OCCT may return a value **outside** the edge's nominal parameter
        range `[param_min, param_max]` (e.g., by adding/subtracting multiples of
        the period). If you require a value folded into the edge's range, apply a
        modulo with the parameter span.

        Args:
            position (float): Normalized arc-length position along the shape,
                where `0.0` is the start and `1.0` is the end. Values outside
                `[0.0, 1.0]` are not validated and yield OCCT-dependent results.

        Returns:
            float: OCCT parameter (for edges) **or** composite “edgeIndex + fraction”
            parameter (for wires), as described above.

        """
    def param_at_point(self, point: VectorLike) -> float:
        """
        Return the normalized parameter (∈ [0.0, 1.0]) of the location on this edge
        closest to `point`.

        This method always returns a **normalized** parameter across the edge's full
        OCCT parameter range, even though the underlying OCP/OCCT queries work in
        native (non-normalized) parameters. It is robust to several OCCT quirks:

        1) Vertex snap (fast path)
        If `point` coincides (within tolerance) with one of the edge's vertices,
        that vertex's OCCT parameter is used and normalized to [0, 1].
        Note: for a closed edge, a vertex may represent both start and end; the
        mapping is therefore ambiguous and either end may be chosen.

        2) Projection via GeomAPI_ProjectPointOnCurve
        The OCCT projector's `LowerDistanceParameter()` can legitimately return a
        value **outside** the edge's [param_min, param_max] (e.g., periodic curves
        or implementation behavior). The result is wrapped back into range using a
        modulo by the parameter span and then normalized to [0, 1]. The projected
        answer is accepted only if re-evaluating the 3D point at that normalized
        parameter is within tolerance of the input `point`.

        3) Fallback numeric search (robust path)
        If the projector fails the validation, a bounded 1D search is performed
        over [0, 1] using progressive subdivision and local minimization of the
        3D distance ‖edge(u) - point‖. The first minimum found under geometric
        resolution is returned.

        Args:
            point (VectorLike): A point expected to lie on this edge (within tolerance).

        Raises:
            ValueError: If `point` is not on the edge within tolerance.
            ValueError: Can't find param on empty edge
            RuntimeError: If no parameter can be found (e.g., extremely pathological
                curves or numerical failure).
        Returns:
            float: Normalized parameter in [0.0, 1.0] corresponding to the point's
            closest location on the edge.
        """
    def project_to_shape(self, target_object: Shape, direction: VectorLike | None = None, center: VectorLike | None = None) -> ShapeList[Edge]:
        """Project Edge

        Project an Edge onto a Shape generating new wires on the surfaces of the object
        one and only one of `direction` or `center` must be provided. Note that one or
        more wires may be generated depending on the topology of the target object and
        location/direction of projection.

        To avoid flipping the normal of a face built with the projected wire the orientation
        of the output wires are forced to be the same as self.

        Args:
          target_object: Object to project onto
          direction: Parallel projection direction. Defaults to None.
          center: Conical center of projection. Defaults to None.
          target_object: Shape:
          direction: VectorLike:  (Default value = None)
          center: VectorLike:  (Default value = None)

        Returns:
          : Projected Edge(s)

        Raises:
          ValueError: Only one of direction or center must be provided

        """
    def reversed(self, reconstruct: bool = False) -> Edge:
        """reversed

        Return a copy of self with the opposite orientation.

        Args:
            reconstruct (bool, optional): rebuild edge instead of setting OCCT flag.
                Defaults to False.

        Returns:
            Edge: reversed
        """
    def to_axis(self) -> Axis:
        """Translate a linear Edge to an Axis"""
    def to_wire(self) -> Wire:
        """Edge as Wire"""
    def trim(self, start: float | VectorLike, end: float | VectorLike) -> Edge:
        """trim

        Create a new edge by keeping only the section between start and end.

        Args:
            start (float | VectorLike): 0.0 <= start < 1.0 or point on edge
            end (float  | VectorLike): 0.0 < end <= 1.0 or point on edge

        Raises:
            TypeError: invalid input, must be float or VectorLike
            ValueError: can't trim empty edge

        Returns:
            Edge: trimmed edge
        """
    def trim_to_length(self, start: float | VectorLike, length: float) -> Edge:
        """trim_to_length

        Create a new edge starting at the given normalized parameter of a
        given length.

        Args:
            start (float | VectorLike): 0.0 <= start < 1.0 or point on edge
            length (float): target length

        Raise:
            ValueError: can't trim empty edge

        Returns:
            Edge: trimmed edge
        """
    def trim_to_other(self, other: Shape | Axis | Location | Plane | VectorLike) -> Edge | None:
        """Return the shortest Edge of self trimmed by other or None if they don't intersect"""
    @property
    def is_infinite(self) -> bool:
        """Check if edge is infinite (LINE with length > 1e100)."""
    def trim_infinite(self, half_length: float) -> Edge:
        """Trim an infinite line edge to a finite length.

        OCCT's boolean operations struggle with very long edges (length > 1e100).
        This method trims such edges to a reasonable size centered at edge.center().

        For non-infinite edges, returns self unchanged.

        Args:
            half_length: Half-length of the resulting edge

        Returns:
            Trimmed edge if infinite, otherwise self
        """

class Wire(Mixin1D[TopoDS_Wire]):
    """A Wire in build123d is a topological entity representing a connected sequence
    of edges forming a continuous curve or path in 3D space. Wires are essential
    components in modeling complex objects, defining boundaries for surfaces or
    solids. They store information about the connectivity and order of edges,
    allowing precise definition of paths within a 3D model."""
    order: float
    @overload
    def __init__(self, obj: TopoDS_Wire, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a wire from an OCCT TopoDS_Wire

        Args:
            obj (TopoDS_Wire, optional): OCCT Wire.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @overload
    def __init__(self, edge: Edge, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a Wire from an Edge

        Args:
            edge (Edge): Edge to convert to Wire
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @overload
    def __init__(self, wire: Wire, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a Wire from an Wire - used when the input could be an Edge or Wire.

        Args:
            wire (Wire): Wire to convert to another Wire
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @overload
    def __init__(self, wire: Curve, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a Wire from an Curve.

        Args:
            curve (Curve): Curve to convert to a Wire
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @overload
    def __init__(self, edges: Iterable[Edge], sequenced: bool = False, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a wire from Edges

        Build a Wire from the provided unsorted Edges. If sequenced is True the
        Edges are placed in such that the end of the nth Edge is coincident with
        the n+1th Edge forming an unbroken sequence. Note that sequencing a list
        is relatively slow.

        Args:
            edges (Iterable[Edge]): Edges to assemble
            sequenced (bool, optional): arrange in order. Defaults to False.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @classmethod
    def combine(cls, wires: Iterable[Wire | Edge], tol: float = 1e-09) -> ShapeList[Wire]:
        """combine

        Combine a list of wires and edges into a list of Wires.

        Args:
            wires (Iterable[Wire |  Edge]): unsorted
            tol (float, optional): tolerance. Defaults to 1e-9.

        Returns:
            ShapeList[Wire]: Wires
        """
    @classmethod
    def extrude(cls, obj: Shape, direction: VectorLike) -> Wire:
        """extrude - invalid operation for Wire"""
    @classmethod
    def make_circle(cls, radius: float, plane: Plane = ...) -> Wire:
        """make_circle

        Makes a circle centered at the origin of plane

        Args:
            radius (float): circle radius
            plane (Plane): base plane. Defaults to Plane.XY

        Returns:
            Wire: a circle
        """
    @classmethod
    def make_convex_hull(cls, edges: Iterable[Edge], tolerance: float = 0.001) -> Wire:
        """make_convex_hull

        Create a wire of minimum length enclosing all of the provided edges.

        Note that edges can't overlap each other.

        Args:
            edges (Iterable[Edge]): edges defining the convex hull
            tolerance (float): allowable error as a fraction of each edge length.
                Defaults to 1e-3.

        Raises:
            ValueError: edges overlap

        Returns:
            Wire: convex hull perimeter
        """
    @classmethod
    def make_ellipse(cls, x_radius: float, y_radius: float, plane: Plane = ..., start_angle: float = 360.0, end_angle: float = 360.0, angular_direction: AngularDirection = ..., closed: bool = True) -> Wire:
        """make ellipse

        Makes an ellipse centered at the origin of plane.

        Args:
            x_radius (float): x radius of the ellipse (along the x-axis of plane)
            y_radius (float): y radius of the ellipse (along the y-axis of plane)
            plane (Plane, optional): base plane. Defaults to Plane.XY.
            start_angle (float, optional): _description_. Defaults to 360.0.
            end_angle (float, optional): _description_. Defaults to 360.0.
            angular_direction (AngularDirection, optional): arc direction.
                Defaults to AngularDirection.COUNTER_CLOCKWISE.
            closed (bool, optional): close the arc. Defaults to True.

        Returns:
            Wire: an ellipse
        """
    @classmethod
    def make_polygon(cls, vertices: Iterable[VectorLike], close: bool = True) -> Wire:
        """make_polygon

        Create an irregular polygon by defining vertices

        Args:
            vertices (Iterable[VectorLike]):
            close (bool, optional): close the polygon. Defaults to True.

        Returns:
            Wire: an irregular polygon
        """
    @classmethod
    def make_rect(cls, width: float, height: float, plane: Plane = ...) -> Wire:
        """Make Rectangle

        Make a Rectangle centered on center with the given normal

        Args:
            width (float): width (local x)
            height (float): height (local y)
            plane (Plane, optional): plane containing rectangle. Defaults to Plane.XY.

        Returns:
            Wire: The centered rectangle
        """
    @staticmethod
    def order_chamfer_edges(reference_edge: Edge | None, edges: tuple[Edge, Edge]) -> tuple[Edge, Edge]:
        """Order the edges of a chamfer relative to a reference Edge"""
    def chamfer_2d(self, distance: float, distance2: float, vertices: Iterable[Vertex], edge: Edge | None = None) -> Wire:
        """chamfer_2d

        Apply 2D chamfer to a wire

        Args:
            distance (float): chamfer length
            distance2 (float): chamfer length
            vertices (Iterable[Vertex]): vertices to chamfer
            edge (Edge): identifies the side where length is measured. The vertices must be
                part of the edge

        Returns:
            Wire: chamfered wire
        """
    def close(self) -> Wire:
        """Close a Wire"""
    def edges(self) -> ShapeList[Edge]:
        """edges - all the edges in this Shape"""
    def fillet_2d(self, radius: float, vertices: Iterable[Vertex]) -> Wire:
        """fillet_2d

        Apply 2D fillet to a wire

        Args:
            radius (float):
            vertices (Iterable[Vertex]): vertices to fillet

        Raises:
            RuntimeError: Internal error
            ValueError: empty wire

        Returns:
            Wire: filleted wire
        """
    def fix_degenerate_edges(self, precision: float) -> Wire:
        """fix_degenerate_edges

        Fix a Wire that contains degenerate (very small) edges

        Args:
            precision (float): minimum value edge length

        Returns:
            Wire: fixed wire
        """
    def geom_adaptor(self) -> BRepAdaptor_CompCurve:
        """Return the Geom Comp Curve for this Wire"""
    def order_edges(self) -> ShapeList[Edge]:
        """Return the edges in self ordered by wire direction and orientation"""
    def geom_equal(self, other: Wire, tol: float = 1e-06, num_interpolation_points: int = 5) -> bool:
        """Compare two wires for geometric equality within tolerance.

        This compares the geometric properties of two wires by comparing their
        constituent edges pairwise. Two independently created wires with the
        same geometry will return True.

        Args:
            other: Wire to compare with
            tol: Tolerance for numeric comparisons. Defaults to 1e-6.
            num_interpolation_points: Number of points to sample for unknown
                curve types. Defaults to 5.

        Returns:
            bool: True if wires are geometrically equal within tolerance
        """
    def param_at(self, position: float) -> float:
        """
        Return the OCCT comp-curve parameter corresponding to the given wire position.
        This is *not* the edge composite parameter; it is the parameter of the wire’s
        BRepAdaptor_CompCurve.
        """
    def param_at_point(self, point: VectorLike) -> float:
        """
        Return the normalized wire parameter for the point closest to this wire.

        This method projects the given point onto the wire, finds the nearest edge,
        and accumulates arc lengths to determine the fractional position along the
        entire wire. The result is normalized to the interval [0.0, 1.0], where:

        - 0.0 corresponds to the start of the wire
        - 1.0 corresponds to the end of the wire

        Unlike the edge version of this method, the returned value is **not**
        an OCCT curve parameter, but a normalized parameter across the wire as a whole.

        Args:
            point (VectorLike): The point to project onto the wire.

        Raises:
            ValueError: Can't find point on empty wire

        Returns:
            float: Normalized parameter in [0.0, 1.0] representing the relative
            position of the projected point along the wire.
        """
    def project_to_shape(self, target_object: Shape, direction: VectorLike | None = None, center: VectorLike | None = None) -> ShapeList[Wire]:
        """Project Wire

        Project a Wire onto a Shape generating new wires on the surfaces of the object
        one and only one of `direction` or `center` must be provided. Note that one or
        more wires may be generated depending on the topology of the target object and
        location/direction of projection.

        To avoid flipping the normal of a face built with the projected wire the orientation
        of the output wires are forced to be the same as self.

        Args:
          target_object: Object to project onto
          direction: Parallel projection direction. Defaults to None.
          center: Conical center of projection. Defaults to None.
          target_object: Shape:
          direction: VectorLike:  (Default value = None)
          center: VectorLike:  (Default value = None)

        Returns:
          : Projected wire(s)

        Raises:
          ValueError: Only one of direction or center must be provided

        """
    def stitch(self, other: Wire) -> Wire:
        """Attempt to stitch wires

        Args:
            other (Wire): wire to combine

        Raises:
            ValueError: Can't stitch empty wires

        Returns:
            Wire: stitched wires
        """
    def to_wire(self) -> Wire:
        """Return Wire - used as a pair with Edge.to_wire when self is Wire | Edge"""
    def trim(self, start: float | VectorLike, end: float | VectorLike) -> Wire:
        """Trim a wire between [start, end] normalized over total length.

        Args:
            start (float | VectorLike): normalized start position (0.0 to <1.0) or point
            end (float | VectorLike): normalized end position (>0.0 to 1.0) or point

        Returns:
            Wire: trimmed Wire
        """

def edges_to_wires(edges: Iterable[Edge], tol: float = 1e-06) -> ShapeList[Wire]:
    """Convert edges to a list of wires.

    Args:
      edges: Iterable[Edge]:
      tol: float:  (Default value = 1e-6)

    Returns:

    """
def offset_topods_face(face: TopoDS_Face, amount: float) -> TopoDS_Shape:
    """Offset a topods_face"""
def topo_explore_connected_edges(edge: Edge, parent: Shape | None = None, continuity: ContinuityLevel = ...) -> ShapeList[Edge]:
    """
    Find edges connected to the given edge with at least the requested continuity.

    Args:
        edge: The reference edge to explore from.
        parent: Optional parent Shape. If None, uses edge.topo_parent.
        continuity: Minimum required continuity (C0/G0, C1/G1, C2/G2).

    Returns:
        ShapeList[Edge]: Connected edges meeting the continuity requirement.
    """
def topo_explore_connected_faces(edge: Edge, parent: Shape | None = None) -> list[TopoDS_Face]:
    """Given an edge extracted from a Shape, return the topods_faces connected to it"""
