import abc
from .composite import Compound as Compound, Curve as Curve
from .one_d import Edge as Edge, Mixin1D as Mixin1D, Wire as Wire
from .shape_core import Shape as Shape, ShapeList as ShapeList, SkipClean as SkipClean, TOPODS as TOPODS, downcast as downcast, get_top_level_topods_shapes as get_top_level_topods_shapes, shapetype as shapetype
from .three_d import Solid as Solid
from .utils import find_max_dimension as find_max_dimension
from .zero_d import Vertex as Vertex
from OCP.Geom import Geom_Surface as Geom_Surface
from OCP.TopoDS import TopoDS_Face, TopoDS_Shape, TopoDS_Shell
from abc import ABC, abstractmethod
from build123d.build_enums import CenterOf as CenterOf, ContinuityLevel as ContinuityLevel, GeomType as GeomType, Keep as Keep, SortBy as SortBy, Transition as Transition
from build123d.geometry import Axis as Axis, Color as Color, DEG2RAD as DEG2RAD, Location as Location, OrientedBoundBox as OrientedBoundBox, Plane as Plane, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike
from collections.abc import Iterable
from typing import Any, Literal, TypeVar, overload
from typing_extensions import Self

T = TypeVar('T', Edge, Wire, 'Face')

class Mixin2D(ABC, Shape[TOPODS], metaclass=abc.ABCMeta):
    """Additional methods to add to Face and Shell class"""
    @classmethod
    def cast(cls, obj: TopoDS_Shape) -> Vertex | Edge | Wire | Face | Shell:
        """Returns the right type of wrapper, given a OCCT object"""
    @classmethod
    def extrude(cls, obj: Shape, direction: VectorLike) -> Edge | Face | Shell | Solid | Compound:
        """Unused - only here because Mixin1D is a subclass of Shape"""
    def __neg__(self) -> Self:
        """Reverse normal operator -"""
    @overload
    def split_by_perimeter(self, perimeter: Edge | Wire, keep: Literal[Keep.INSIDE, Keep.OUTSIDE]) -> Face | Shell | ShapeList[Face] | None:
        """split_by_perimeter and keep inside or outside"""
    @overload
    def split_by_perimeter(self, perimeter: Edge | Wire, keep: Literal[Keep.BOTH]) -> tuple[Face | Shell | ShapeList[Face] | None, Face | Shell | ShapeList[Face] | None]:
        """split_by_perimeter and keep inside and outside"""
    @overload
    def split_by_perimeter(self, perimeter: Edge | Wire, keep: Literal[Keep.INSIDE] = ...) -> Face | Shell | ShapeList[Face] | None:
        """split_by_perimeter and keep inside (default)"""
    def find_intersection_points(self, other: Axis, tolerance: float = ...) -> list[tuple[Vector, Vector]]:
        """Find point and normal at intersection

        Return both the point(s) and normal(s) of the intersection of the axis and the shape

        Args:
            axis (Axis): axis defining the intersection line

        Returns:
            list[tuple[Vector, Vector]]: Point and normal of intersection
        """
    def touch(self, other: Shape, tolerance: float = 1e-06, found_faces: ShapeList | None = None, found_edges: ShapeList | None = None) -> ShapeList:
        """Find boundary contacts between this 2D shape and another shape.

        Returns the highest-dimensional contact at each location, filtered to
        avoid returning lower-dimensional boundaries of higher-dimensional contacts.

        For Face/Shell:
        - Face + Face → Vertex (shared corner or crossing point without edge/face overlap)
        - Face + Edge/Vertex → no touch (intersect already returns dim 0)

        Args:
            other: Shape to find contacts with
            tolerance: tolerance for contact detection
            found_faces: pre-found faces to filter against (from Mixin3D.touch)
            found_edges: pre-found edges to filter against (from Mixin3D.touch)

        Returns:
            ShapeList of contact shapes (Vertex only for 2D+2D)
        """
    @abstractmethod
    def location_at(self, *args: Any, **kwargs: Any) -> Location:
        """A location from a face or shell"""
    def offset(self, amount: float) -> Self:
        """Return a copy of self moved along the normal by amount"""
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

class Face(Mixin2D[TopoDS_Face]):
    """A Face in build123d represents a 3D bounded surface within the topological data
    structure. It encapsulates geometric information, defining a face of a 3D shape.
    These faces are integral components of complex structures, such as solids and
    shells. Face enables precise modeling and manipulation of surfaces, supporting
    operations like trimming, filleting, and Boolean operations."""
    order: float
    @overload
    def __init__(self, obj: TopoDS_Face | Plane, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a Face from an OCCT TopoDS_Shape/TopoDS_Face

        Args:
            obj (TopoDS_Shape | Plane, optional): OCCT Face or Plane.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @overload
    def __init__(self, outer_wire: Wire, inner_wires: Iterable[Wire] | None = None, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a planar Face from a boundary Wire with optional hole Wires.

        Args:
            outer_wire (Wire): closed perimeter wire
            inner_wires (Iterable[Wire], optional): holes. Defaults to None.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @property
    def area_without_holes(self) -> float:
        """
        Calculate the total surface area of the face, including the areas of any holes.

        This property returns the overall area of the face as if the inner boundaries (holes)
        were filled in.

        Returns:
            float: The total surface area, including the area of holes. Returns 0.0 if
            the face is empty.
        """
    @property
    def axis_of_rotation(self) -> None | Axis:
        """Get the rotational axis of a cylinder or torus"""
    @property
    def axes_of_symmetry(self) -> list[Axis]:
        """Computes and returns the axes of symmetry for a planar face.

        The method determines potential symmetry axes by analyzing the face’s
        geometry:

        - It first validates that the face is non-empty and planar.

        - For faces with inner wires (holes), it computes the centroid of the
          holes and the face's overall center (COG).

            - If the holes' centroid significantly deviates from the COG (beyond
              a specified tolerance), the symmetry axis is taken along the line
              connecting these points; otherwise, each hole’s center is used to
              generate a candidate axis.

        - For faces without holes, candidate directions are derived by sampling
          midpoints along the outer wire's edges.

            - If curved edges are present, additional candidate directions are
              obtained from an oriented bounding box (OBB) constructed around the
              face.

        For each candidate direction, the face is split by a plane (defined
        using the candidate direction and the face’s normal).  The top half of the face
        is then mirrored across this plane, and if the area of the intersection between
        the mirrored half and the bottom half matches the bottom half’s area within a
        small tolerance, the direction is accepted as an axis of symmetry.

        Returns:
            list[Axis]: A list of Axis objects, each defined by the face's
                center and a direction vector, representing the symmetry axes of
                the face.

        Raises:
            ValueError: If the face or its underlying representation is empty.
            ValueError: If the face is not planar.
        """
    @property
    def center_location(self) -> Location:
        """Location at the center of face"""
    @property
    def geometry(self) -> None | str:
        """geometry of planar face"""
    @property
    def is_circular_convex(self) -> bool:
        """
        Determine whether a given face is convex relative to its underlying geometry
        for supported geometries: cylinder, sphere, torus.

        Returns:
            bool: True if convex; otherwise, False.
        """
    @property
    def is_circular_concave(self) -> bool:
        """
        Determine whether a given face is concave relative to its underlying geometry
        for supported geometries: cylinder, sphere, torus.

        Returns:
            bool: True if concave; otherwise, False.
        """
    @property
    def is_planar(self) -> Plane | None:
        """Is the face planar even though its geom_type may not be PLANE - if so return Plane"""
    @property
    def length(self) -> None | float:
        """length of planar face"""
    @property
    def radii(self) -> None | tuple[float, float]:
        """Return the major and minor radii of a torus otherwise None"""
    @property
    def radius(self) -> None | float:
        """Return the radius of a cylinder or sphere, otherwise None"""
    @property
    def seams(self) -> ShapeList[Edge]:
        """Return the seams contained within this Face"""
    @property
    def semi_angle(self) -> None | float:
        """Return the semi angle of a cone, otherwise None"""
    @property
    def uv_face(self) -> Face:
        """Create a planar face from a face's parametric-space boundary.

        Each boundary edge's pcurve on ``self`` is converted to a normal
        build123d ``Edge`` on the XY plane, where X is the surface U parameter and Y
        is the surface V parameter. The original outer/inner wire structure is kept
        so the result can be displayed with normal build123d/ocp-vscode tooling.

        Args:
            source_face: Planar or non-planar face to inspect.

        Returns:
            A planar ``Face`` in UV parameter space.
        """
    @property
    def volume(self) -> float:
        """volume - the volume of this Face, which is always zero"""
    @property
    def width(self) -> None | float:
        """width of planar face"""
    @classmethod
    def extrude(cls, obj: Edge, direction: VectorLike) -> Face:
        """extrude

        Extrude an Edge into a Face.

        Args:
            direction (VectorLike): direction and magnitude of extrusion

        Raises:
            ValueError: Unsupported class
            RuntimeError: Generated invalid result

        Returns:
            Face: extruded shape
        """
    @classmethod
    def make_bezier_surface(cls, points: list[list[VectorLike]], weights: list[list[float]] | None = None) -> Face:
        """make_bezier_surface

        Construct a Bézier surface from the provided 2d array of points.

        Args:
            points (list[list[VectorLike]]): a 2D list of control points
            weights (list[list[float]], optional): control point weights. Defaults to None.

        Raises:
            ValueError: Too few control points
            ValueError: Too many control points
            ValueError: A weight is required for each control point

        Returns:
            Face: a potentially non-planar face
        """
    @classmethod
    def make_gordon_surface(cls, profiles: Iterable[VectorLike | Edge], guides: Iterable[VectorLike | Edge], tolerance: float = 0.0003) -> Face:
        """
        Constructs a Gordon surface from a network of profile and guide curves.

        Requirements:
        1. Profiles and guides may be defined as points or curves.
        2. Only the first or last profile or guide may be a point.
        3. At least one profile and one guide must be a non-point curve.
        4. Each profile must intersect with every guide.
        5. Both ends of every profile must lie on a guide.
        6. Both ends of every guide must lie on a profile.

        Args:
            profiles (Iterable[VectorLike | Edge]): Profiles defined as points or edges.
            guides (Iterable[VectorLike | Edge]): Guides defined as points or edges.
            tolerance (float, optional): Tolerance used for surface construction and
                intersection calculations.

        Raises:
            ValueError: input Edge cannot be empty.

        Returns:
            Face: the interpolated Gordon surface
        """
    @classmethod
    def make_plane(cls, plane: Plane = ...) -> Face:
        """Create a unlimited size Face aligned with plane"""
    @classmethod
    def make_rect(cls, width: float, height: float, plane: Plane = ...) -> Face:
        """make_rect

        Make a Rectangle centered on center with the given normal

        Args:
            width (float, optional): width (local x).
            height (float, optional): height (local y).
            plane (Plane, optional): base plane. Defaults to Plane.XY.

        Returns:
            Face: The centered rectangle
        """
    @classmethod
    def make_surface(cls, exterior: Wire | Iterable[Edge], surface_points: Iterable[VectorLike] | None = None, interior_wires: Iterable[Wire] | None = None) -> Face:
        """Create Non-Planar Face

        Create a potentially non-planar face bounded by exterior (wire or edges),
        optionally refined by surface_points with optional holes defined by
        interior_wires.

        Args:
            exterior (Union[Wire, list[Edge]]): Perimeter of face
            surface_points (list[VectorLike], optional): Points on the surface that
                refine the shape. Defaults to None.
            interior_wires (list[Wire], optional): Hole(s) in the face. Defaults to None.

        Raises:
            RuntimeError: Internal error building face
            RuntimeError: Error building non-planar face with provided surface_points
            RuntimeError: Error adding interior hole
            RuntimeError: Generated face is invalid

        Returns:
            Face: Potentially non-planar face
        """
    @classmethod
    def make_surface_from_array_of_points(cls, points: list[list[VectorLike]], tol: float = 0.01, smoothing: tuple[float, float, float] | None = None, min_deg: int = 1, max_deg: int = 3) -> Face:
        """make_surface_from_array_of_points

        Approximate a spline surface through the provided 2d array of points.
        The first dimension correspond to points on the vertical direction in the parameter
        space of the face. The second dimension correspond to points on the horizontal
        direction in the parameter space of the face. The 2 dimensions are U,V dimensions
        of the parameter space of the face.

        Args:
            points (list[list[VectorLike]]): a 2D list of points, first dimension is V
                parameters second is U parameters.
            tol (float, optional): tolerance of the algorithm. Defaults to 1e-2.
            smoothing (Tuple[float, float, float], optional): optional tuple of
                3 weights use for variational smoothing. Defaults to None.
            min_deg (int, optional): minimum spline degree. Enforced only when
                smoothing is None. Defaults to 1.
            max_deg (int, optional): maximum spline degree. Defaults to 3.

        Raises:
            ValueError: B-spline approximation failed

        Returns:
            Face: a potentially non-planar face defined by points
        """
    @overload
    @classmethod
    def make_surface_from_curves(cls, edge1: Edge, edge2: Edge) -> Face: ...
    @overload
    @classmethod
    def make_surface_from_curves(cls, wire1: Wire, wire2: Wire) -> Face: ...
    @classmethod
    def make_surface_patch(cls, edge_face_constraints: Iterable[tuple[Edge, Face, ContinuityLevel]] | None = None, edge_constraints: Iterable[Edge] | None = None, point_constraints: Iterable[VectorLike] | None = None) -> Face:
        """make_surface_patch

        Create a potentially non-planar face patch bounded by exterior edges which can
        be optionally refined using support faces to ensure e.g. tangent surface
        continuity. Also can optionally refine the surface using surface points.

        Args:
            edge_face_constraints (list[tuple[Edge, Face, ContinuityLevel]], optional):
                Edges defining perimeter of face with adjacent support faces subject to
                ContinuityLevel. Defaults to None.
            edge_constraints (list[Edge], optional): Edges defining perimeter of face
                without adjacent support faces. Defaults to None.
            point_constraints (list[VectorLike], optional): Points on the surface that
                refine the shape. Defaults to None.

        Raises:
            RuntimeError: Error building non-planar face with provided constraints
            RuntimeError: Generated face is invalid

        Returns:
            Face: Potentially non-planar face
        """
    @classmethod
    def revolve(cls, profile: Edge, angle: float, axis: Axis) -> Face:
        """sweep

        Revolve an Edge around an axis.

        Args:
            profile (Edge): the object to sweep
            angle (float): the angle to revolve through
            axis (Axis): rotation Axis

        Returns:
            Face: resulting face
        """
    @classmethod
    def sew_faces(cls, faces: Iterable[Face]) -> list[ShapeList[Face]]:
        """sew faces

        Group contiguous faces and return them in a list of ShapeList

        Args:
            faces (Iterable[Face]): Faces to sew together

        Raises:
            RuntimeError: OCCT SewedShape generated unexpected output

        Returns:
            list[ShapeList[Face]]: grouped contiguous faces
        """
    @classmethod
    def sweep(cls, profile: Curve | Edge | Wire, path: Curve | Edge | Wire, transition=...) -> Face:
        """sweep

        Sweep a 1D profile along a 1D path. Both the profile and path must be composed
        of only 1 Edge.

        Args:
            profile (Union[Curve,Edge,Wire]): the object to sweep
            path (Union[Curve,Edge,Wire]): the path to follow when sweeping
            transition (Transition, optional): handling of profile orientation at C1 path
                discontinuities. Defaults to Transition.TRANSFORMED.

        Raises:
            ValueError: Only 1 Edge allowed in profile & path

        Returns:
            Face: resulting face, may be non-planar
        """
    def center(self, center_of: CenterOf = ...) -> Vector:
        """Center of Face

        Return the center based on center_of

        Args:
            center_of (CenterOf, optional): centering option. Defaults to CenterOf.GEOMETRY.

        Returns:
            Vector: center
        """
    def chamfer_2d(self, distance: float, distance2: float, vertices: Iterable[Vertex], edge: Edge | None = None) -> Face:
        """Apply 2D chamfer to a face

        Args:
            distance (float): chamfer length
            distance2 (float): chamfer length
            vertices (Iterable[Vertex]): vertices to chamfer
            edge (Edge): identifies the side where length is measured. The vertices must be
                part of the edge

        Raises:
            ValueError: Cannot chamfer at this location
            ValueError: One or more vertices are not part of edge

        Returns:
            Face: face with a chamfered corner(s)

        """
    def fillet_2d(self, radius: float, vertices: Iterable[Vertex]) -> Face:
        """Apply 2D fillet to a face

        Args:
          radius: float:
          vertices: Iterable[Vertex]:

        Returns:

        """
    def geom_adaptor(self) -> Geom_Surface:
        """Return the Geom Surface for this Face"""
    def inner_wires(self) -> ShapeList[Wire]:
        """Extract the inner or hole wires from this Face"""
    def is_coplanar(self, plane: Plane) -> bool:
        """Is this planar face coplanar with the provided plane"""
    def is_inside(self, point: VectorLike, tolerance: float = 1e-06) -> bool:
        """Point inside Face

        Returns whether or not the point is inside a Face within the specified tolerance.
        Points on the edge of the Face are considered inside.

        Args:
          point(VectorLike): tuple or Vector representing 3D point to be tested
          tolerance(float): tolerance for inside determination. Defaults to 1.0e-6.
          point: VectorLike:
          tolerance: float:  (Default value = 1.0e-6)

        Returns:
          bool: indicating whether or not point is within Face

        """
    @overload
    def location_at(self, surface_point: VectorLike | None = None, *, x_dir: VectorLike | None = None) -> Location: ...
    @overload
    def location_at(self, u: float, v: float, *, x_dir: VectorLike | None = None) -> Location: ...
    def make_holes(self, interior_wires: list[Wire]) -> Face:
        """Make Holes in Face

        Create holes in the Face 'self' from interior_wires which must be entirely interior.
        Note that making holes in faces is more efficient than using boolean operations
        with solid object. Also note that OCCT core may fail unless the orientation of the wire
        is correct - use `Wire(forward_wire.wrapped.Reversed())` to reverse a wire.

        Example:

            For example, make a series of slots on the curved walls of a cylinder.

        .. image:: slotted_cylinder.png

        Args:
          interior_wires: a list of hole outline wires
          interior_wires: list[Wire]:

        Returns:
          Face: 'self' with holes

        Raises:
          RuntimeError: adding interior hole in non-planar face with provided interior_wires
          RuntimeError: resulting face is not valid

        """
    @overload
    def normal_at(self, surface_point: VectorLike | None = None) -> Vector:
        """normal_at point on surface

        Args:
            surface_point (VectorLike, optional): a point that lies on the surface where
                the normal. Defaults to the center (None).

        Returns:
            Vector: surface normal direction
        """
    @overload
    def normal_at(self, u: float, v: float) -> Vector:
        """normal_at u, v values on Face

        Args:
            u (float): the horizontal coordinate in the parameter space of the Face,
                between 0.0 and 1.0
            v (float): the vertical coordinate in the parameter space of the Face,
                between 0.0 and 1.0
                Defaults to the center (None/None)

        Raises:
            ValueError: Either neither or both u v values must be provided

        Returns:
            Vector: surface normal direction
        """
    def outer_wire(self) -> Wire:
        """Extract the perimeter wire from this Face"""
    def position_at(self, u: float, v: float) -> Vector:
        """position_at

        Computes a point on the Face given u, v coordinates.

        Args:
            u (float): the horizontal coordinate in the parameter space of the Face,
                between 0.0 and 1.0
            v (float): the vertical coordinate in the parameter space of the Face,
                between 0.0 and 1.0

        Returns:
            Vector: point on Face
        """
    def project_to_shape(self, target_object: Shape, direction: VectorLike) -> ShapeList[Face | Shell]:
        '''Project Face to target Object

        Project a Face onto a Shape generating new Face(s) on the surfaces of the object.

        A projection with no taper is illustrated below:

        .. image:: flatProjection.png
            :alt: flatProjection

        Note that an array of faces is returned as the projection might result in faces
        on the "front" and "back" of the object (or even more if there are intermediate
        surfaces in the projection path). faces "behind" the projection are not
        returned.

        Args:
            target_object (Shape): Object to project onto
            direction (VectorLike): projection direction

        Returns:
            ShapeList[Face]: Face(s) projected on target object ordered by distance
        '''
    def to_arcs(self, tolerance: float = 0.001) -> Face:
        """to_arcs

        Approximate planar face with arcs and straight line segments.

        This is a utility used internally to convert or adapt a face for Boolean operations. Its
        purpose is not typically for general use, but rather as a helper within the Boolean kernel
        to ensure input faces are in a compatible and canonical form.

        Args:
            tolerance (float, optional): Approximation tolerance. Defaults to 1e-3.

        Returns:
            Face: approximated face
        """
    def without_holes(self) -> Face:
        """without_holes

        Remove all of the holes from this face.

        Returns:
            Face: A new Face instance identical to the original but without any holes.
        """
    def wire(self) -> Wire:
        """Return the outerwire, generate a warning if inner_wires present"""
    @overload
    def wrap(self, planar_shape: Edge, surface_loc: Location, tolerance: float = 0.001, extension_factor: float = 0.1) -> Edge: ...
    @overload
    def wrap(self, planar_shape: Wire, surface_loc: Location, tolerance: float = 0.001, extension_factor: float = 0.1) -> Wire: ...
    @overload
    def wrap(self, planar_shape: Face, surface_loc: Location, tolerance: float = 0.001, extension_factor: float = 0.1) -> Face: ...
    def wrap_faces(self, faces: Iterable[Face], path: Wire | Edge, start: float = 0.0) -> ShapeList[Face]:
        """wrap_faces

        Wrap a sequence of 2D faces onto a 3D surface, aligned along a guiding path.

        This method places multiple planar `Face` objects (defined in the XY plane) onto a
        curved 3D surface (`self`), following a given path (Wire or Edge) that lies on or
        closely follows the surface. Each face is spaced along the path according to its
        original horizontal (X-axis) position, preserving the relative layout of the input
        faces.

        The wrapping process attempts to maintain the shape and size of each face while
        minimizing distortion. Each face is repositioned to the origin, then individually
        wrapped onto the surface starting at a specific point along the path. The face's
        new orientation is defined using the path's tangent direction and the surface normal
        at that point.

        This is particularly useful for placing a series of features—such as embossed logos,
        engraved labels, or patterned tiles—onto a freeform or cylindrical surface, aligned
        along a reference edge or curve.

        Args:
            faces (Iterable[Face]): An iterable of 2D planar faces to be wrapped.
            path (Wire | Edge): A curve on the target surface that defines the alignment
                direction. The X-position of each face is mapped to a relative position
                along this path.
            start (float, optional): The relative starting point on the path (between 0.0
                and 1.0) where the first face should be placed. Defaults to 0.0.

        Returns:
            ShapeList[Face]: A list of wrapped face objects, aligned and conformed to the
                surface.
        """

class Shell(Mixin2D[TopoDS_Shell]):
    """A Shell is a fundamental component in build123d's topological data structure
    representing a connected set of faces forming a closed surface in 3D space. As
    part of a geometric model, it defines a watertight enclosure, commonly encountered
    in solid modeling. Shells group faces in a coherent manner, playing a crucial role
    in representing complex shapes with voids and surfaces. This hierarchical structure
    allows for efficient handling of surfaces within a model, supporting various
    operations and analyses."""
    order: float
    def __init__(self, obj: TopoDS_Shell | Face | Iterable[Face] | None = None, label: str = '', color: Color | None = None, parent: Compound | None = None) -> None:
        """Build a shell from an OCCT TopoDS_Shape/TopoDS_Shell

        Args:
            obj (TopoDS_Shape | Face | Iterable[Face], optional): OCCT Shell, Face or Faces.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @property
    def volume(self) -> float:
        """volume - the volume of this Shell if manifold, otherwise zero"""
    @classmethod
    def extrude(cls, obj: Wire, direction: VectorLike) -> Shell:
        """extrude

        Extrude a Wire into a Shell.

        Args:
            direction (VectorLike): direction and magnitude of extrusion

        Raises:
            ValueError: Unsupported class
            RuntimeError: Generated invalid result

        Returns:
            Edge: extruded shape
        """
    @classmethod
    def make_loft(cls, objs: Iterable[Vertex | Wire], ruled: bool = False) -> Shell:
        """make loft

        Makes a loft from a list of wires and vertices. Vertices can appear only at the
        beginning or end of the list, but cannot appear consecutively within the list nor
        between wires. Wires may be closed or opened.

        Args:
            objs (list[Vertex, Wire]): wire perimeters or vertices
            ruled (bool, optional): stepped or smooth. Defaults to False (smooth).

        Raises:
            ValueError: Too few wires

        Returns:
            Shell: Lofted object
        """
    @classmethod
    def revolve(cls, profile: Curve | Wire, angle: float, axis: Axis) -> Face:
        """sweep

        Revolve a 1D profile around an axis.

        Args:
            profile (Curve | Wire): the object to revolve
            angle (float): the angle to revolve through
            axis (Axis): rotation Axis

        Returns:
            Shell: resulting shell
        """
    @classmethod
    def sweep(cls, profile: Curve | Edge | Wire, path: Curve | Edge | Wire, transition=...) -> Shell:
        """sweep

        Sweep a 1D profile along a 1D path

        Args:
            profile (Union[Curve, Edge, Wire]): the object to sweep
            path (Union[Curve, Edge, Wire]): the path to follow when sweeping
            transition (Transition, optional): handling of profile orientation at C1 path
                discontinuities. Defaults to Transition.TRANSFORMED.

        Returns:
            Shell: resulting Shell, may be non-planar
        """
    def center(self) -> Vector:
        """Center of mass of the shell"""
    def location_at(self, surface_point: VectorLike, *, x_dir: VectorLike | None = None) -> Location:
        """location_at

        Get the location (origin and orientation) on the surface of the shell.

        Args:
            surface_point (VectorLike): A 3D point near the surface.
            x_dir (VectorLike, optional): Direction for the local X axis. If not given,
                the tangent in the U direction is used.

        Returns:
            Location: A full 3D placement at the specified point on the shell surface.
        """

def sort_wires_by_build_order(wire_list: list[Wire]) -> list[list[Wire]]:
    """Tries to determine how wires should be combined into faces.

    Assume:
        The wires make up one or more faces, which could have 'holes'
        Outer wires are listed ahead of inner wires
        there are no wires inside wires inside wires
        ( IE, islands -- we can deal with that later on )
        none of the wires are construction wires

    Compute:
        one or more sets of wires, with the outer wire listed first, and inner
        ones

    Returns, list of lists.

    Args:
      wire_list: list[Wire]:

    Returns:

    """
