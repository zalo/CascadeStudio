import OCP.GeomAbs as ga
import abc
import types
from .composite import Compound as Compound
from .one_d import Edge as Edge, Wire as Wire
from .three_d import Solid as Solid
from .two_d import Face as Face, Shell as Shell
from .zero_d import Vertex as Vertex
from IPython.lib.pretty import RepresentationPrinter as RepresentationPrinter
from OCP.BRepAlgoAPI import BRepAlgoAPI_BooleanOperation as BRepAlgoAPI_BooleanOperation
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_ShapeEnum
from OCP.TopoDS import TopoDS_Compound, TopoDS_Shape
from _typeshed import Incomplete
from abc import ABC, abstractmethod
from anytree import NodeMixin
from build123d.build_enums import CenterOf as CenterOf, GeomType as GeomType, Keep as Keep, SortBy as SortBy, Transition as Transition
from build123d.build_part import BuildPart as BuildPart
from build123d.geometry import Axis as Axis, BoundBox as BoundBox, Color as Color, ColorLike as ColorLike, DEG2RAD as DEG2RAD, Location as Location, Matrix as Matrix, NotAllLocationLikeError as NotAllLocationLikeError, OrientedBoundBox as OrientedBoundBox, Plane as Plane, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike, all_location_like as all_location_like, logger as logger
from collections.abc import Callable, Iterable, Iterator
from typing import Any, ClassVar, Generic, Literal, Protocol, SupportsIndex, TypeVar, overload
from typing_extensions import Self

Shapes: Incomplete
TrimmingTool: Incomplete
TOPODS = TypeVar('TOPODS', bound=TopoDS_Shape)
CalcFn = Callable[[TopoDS_Shape, GProp_GProps], None]
CompositeFactory: Incomplete

class Shape(NodeMixin, Generic[TOPODS], metaclass=abc.ABCMeta):
    """Shape

    Base class for all CAD objects such as Edge, Face, Solid, etc.

    Args:
        obj (TopoDS_Shape, optional): OCCT object. Defaults to None.
        label (str, optional): Defaults to ''.
        color (ColorLike, optional): Defaults to None.
        parent (Compound, optional): assembly parent. Defaults to None.

    Attributes:
        wrapped (TopoDS_Shape): the OCP object
        label (str): user assigned label
        color (Color): object color
        joints (dict[str:Joint]): dictionary of joints bound to this object (Solid only)
        children (Shape): list of assembly children of this object (Compound only)
        topo_parent (Shape): assembly parent of this object

    """
    composite_factories: ClassVar[dict[int | None, CompositeFactory]]
    shape_LUT: Incomplete
    shape_properties_LUT: dict[TopAbs_ShapeEnum, CalcFn | None]
    inverse_shape_LUT: Incomplete
    downcast_LUT: Incomplete
    geom_LUT_EDGE: dict[ga.GeomAbs_CurveType, GeomType]
    geom_LUT_FACE: dict[ga.GeomAbs_SurfaceType, GeomType]
    class _DisplayNode(NodeMixin):
        """Used to create anytree structures from TopoDS_Shapes"""
        label: Incomplete
        address: Incomplete
        position: Incomplete
        parent: Incomplete
        children: list[Shape]
        def __init__(self, label: str = '', address: int | None = None, position: Vector | Location | None = None, parent: Shape._DisplayNode | None = None) -> None: ...
    for_construction: bool
    label: Incomplete
    color: Incomplete
    parent: Incomplete
    topo_parent: Shape | None
    def __init__(self, obj: TopoDS_Shape | None = None, label: str = '', color: ColorLike | None = None, parent: Compound | None = None) -> None: ...
    @property
    def wrapped(self):
        """OCP TopoDS object"""
    @wrapped.setter
    def wrapped(self, shape: TOPODS): ...
    def __bool__(self) -> bool: ...
    @property
    def area(self) -> float:
        """area -the surface area of all faces in this Shape"""
    @property
    def color(self) -> None | Color:
        """Get the shape's color.  If it's None, get the color of the nearest
        ancestor, assign it to this Shape and return this value."""
    @color.setter
    def color(self, value: ColorLike | None) -> None:
        """Set the shape's color"""
    @property
    def geom_type(self) -> GeomType:
        """Gets the underlying geometry type.

        Returns:
            GeomType: The geometry type of the shape

        """
    @property
    def is_manifold(self) -> bool:
        """is_manifold

        Check if each edge in the given Shape has exactly two faces associated with it
        (skipping degenerate edges). If so, the shape is manifold.

        Returns:
            bool: is the shape manifold or water tight
        """
    @property
    def is_null(self) -> bool:
        """Returns true if this shape is null. In other words, it references no
        underlying shape with the potential to be given a location and an
        orientation.
        """
    @property
    def is_planar_face(self) -> bool:
        """Is the shape a planar face even though its geom_type may not be PLANE"""
    @property
    def is_valid(self) -> bool:
        """Returns True if no defect is detected on the shape S or any of its
        subshapes. See the OCCT docs on BRepCheck_Analyzer::IsValid for a full
        description of what is checked.
        """
    @property
    def global_location(self) -> Location:
        """
        The location of this Shape relative to the global coordinate system.

        This property computes the composite transformation by traversing the
        hierarchy from the root of the assembly to this node, combining the
        location of each ancestor. It reflects the absolute position and
        orientation of the shape in world space, even when the shape is deeply
        nested within an assembly.

        Note:
            This is only meaningful when the Shape is part of an assembly tree
            where parent-child relationships define relative placements.
        """
    @property
    def location(self) -> Location:
        """Get this Shape's Location"""
    @location.setter
    def location(self, value: Location):
        """Set Shape's Location to value"""
    @property
    def matrix_of_inertia(self) -> list[list[float]]:
        """
        Compute the inertia matrix (moment of inertia tensor) of the shape.

        The inertia matrix represents how the mass of the shape is distributed
        with respect to its reference frame. It is a 3×3 symmetric tensor that
        describes the resistance of the shape to rotational motion around
        different axes.

        Returns:
            list[list[float]]: A 3×3 nested list representing the inertia matrix.
            The elements of the matrix are given as:

            | Ixx  Ixy  Ixz |
            | Ixy  Iyy  Iyz |
            | Ixz  Iyz  Izz |

            where:
            - Ixx, Iyy, Izz are the moments of inertia about the X, Y, and Z axes.
            - Ixy, Ixz, Iyz are the products of inertia.

        Example:
            >>> obj = MyShape()
            >>> obj.matrix_of_inertia
            [[1000.0, 50.0, 0.0],
            [50.0, 1200.0, 0.0],
            [0.0, 0.0, 300.0]]

        Notes:
            - The inertia matrix is computed relative to the shape's center of mass.
            - It is commonly used in structural analysis, mechanical simulations,
              and physics-based motion calculations.
        """
    @property
    def orientation(self) -> Vector:
        """Get the orientation component of this Shape's Location"""
    location: Incomplete
    @orientation.setter
    def orientation(self, rotations: VectorLike):
        """Set the orientation component of this Shape's Location to rotations"""
    @property
    def position(self) -> Vector:
        """Get the position component of this Shape's Location"""
    @position.setter
    def position(self, value: VectorLike):
        """Set the position component of this Shape's Location to value"""
    @property
    def principal_properties(self) -> list[tuple[Vector, float]]:
        """
        Compute the principal moments of inertia and their corresponding axes.

        Returns:
            list[tuple[Vector, float]]: A list of tuples, where each tuple contains:
            - A `Vector` representing the axis of inertia.
            - A `float` representing the moment of inertia for that axis.

        Example:
            >>> obj = MyShape()
            >>> obj.principal_properties
            [(Vector(1, 0, 0), 1200.0),
            (Vector(0, 1, 0), 1000.0),
            (Vector(0, 0, 1), 300.0)]
        """
    @property
    def shape_type(self) -> Shapes:
        """Return the shape type string for this class"""
    @property
    def static_moments(self) -> tuple[float, float, float]:
        """
        Compute the static moments (first moments of mass) of the shape.

        The static moments represent the weighted sum of the coordinates
        with respect to the mass distribution, providing insight into the
        center of mass and mass distribution of the shape.

        Returns:
            tuple[float, float, float]: The static moments (Mx, My, Mz),
            where:
            - Mx is the first moment of mass about the YZ plane.
            - My is the first moment of mass about the XZ plane.
            - Mz is the first moment of mass about the XY plane.

        Example:
            >>> obj = MyShape()
            >>> obj.static_moments
            (150.0, 200.0, 50.0)

        """
    @classmethod
    @abstractmethod
    def cast(cls, obj: TopoDS_Shape) -> Self:
        """Returns the right type of wrapper, given a OCCT object"""
    @classmethod
    @abstractmethod
    def extrude(cls, obj: Shape, direction: VectorLike) -> Edge | Face | Shell | Solid | Compound:
        """extrude

        Extrude a Shape in the provided direction.
        * Vertices generate Edges
        * Edges generate Faces
        * Wires generate Shells
        * Faces generate Solids
        * Shells generate Compounds

        Args:
            direction (VectorLike): direction and magnitude of extrusion

        Raises:
            ValueError: Unsupported class
            RuntimeError: Generated invalid result

        Returns:
            Edge | Face | Shell | Solid | Compound: extruded shape
        """
    @staticmethod
    def combined_center(objects: Iterable[Shape], center_of: CenterOf = ...) -> Vector:
        """combined center

        Calculates the center of a multiple objects.

        Args:
            objects (Iterable[Shape]): list of objects
            center_of (CenterOf, optional): centering option. Defaults to CenterOf.MASS.

        Raises:
            ValueError: CenterOf.GEOMETRY not implemented

        Returns:
            Vector: center of multiple objects
        """
    @staticmethod
    def compute_mass(obj: Shape) -> float:
        """Calculates the 'mass' of an object.

        Args:
          obj: Compute the mass of this object
          obj: Shape:

        Returns:

        """
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Vertex']) -> ShapeList[Vertex]: ...
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Edge']) -> ShapeList[Edge]: ...
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Wire']) -> ShapeList[Wire]: ...
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Face']) -> ShapeList[Face]: ...
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Shell']) -> ShapeList[Shell]: ...
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Solid']) -> ShapeList[Solid]: ...
    @overload
    @staticmethod
    def get_shape_list(shape: Shape, entity_type: Literal['Compound']) -> ShapeList[Compound]: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Vertex']) -> Vertex: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Edge']) -> Edge: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Wire']) -> Wire: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Face']) -> Face: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Shell']) -> Shell: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Solid']) -> Solid: ...
    @overload
    @staticmethod
    def get_single_shape(shape: Shape, entity_type: Literal['Compound']) -> Compound: ...
    @classmethod
    def register_composite_factory(cls, dimension: int | None, factory: CompositeFactory) -> None:
        """Register a composite constructor without importing it here."""
    @classmethod
    def make_composite(cls, shapes: Iterable[Shape], dimension: int | None = None) -> Shape:
        """Build the registered composite for a dimension."""
    @overload
    def __add__(self, other: None) -> Self: ...
    @overload
    def __add__(self, other: Shape | Iterable[Shape]) -> Self | Compound: ...
    def __and__(self, other: Shape | Iterable[Shape]) -> None | Self | Compound:
        """intersect shape with self operator &"""
    def __copy__(self) -> Self:
        """Return shallow copy or reference of self

        Create an copy of this Shape that shares the underlying TopoDS_TShape.

        Used when there is a need for many objects with the same CAD structure but at
        different Locations, etc. - for examples fasteners in a larger assembly. By
        sharing the TopoDS_TShape, the memory size of such assemblies can be greatly reduced.

        Changes to the CAD structure of the base object will be reflected in all instances.
        """
    def __deepcopy__(self, memo) -> Self:
        """Return deepcopy of self"""
    def __eq__(self, other) -> bool:
        """Check if two shapes are the same.

        This method checks if the current shape is the same as the other shape.
        Two shapes are considered the same if they share the same TShape with
        the same Locations. Orientations may differ.

        Args:
            other (Shape): The shape to compare with.

        Returns:
            bool: True if the shapes are the same, False otherwise.
        """
    def __hash__(self) -> int:
        """Return hash code"""
    @overload
    def __rmul__(self, other: Plane | Location) -> Self: ...
    @overload
    def __rmul__(self, other: Iterable[Plane | Location]) -> list[Self]: ...
    @overload
    def __sub__(self, other: None) -> Self: ...
    @overload
    def __sub__(self, other: Shape | Iterable[Shape]) -> Self | Compound: ...
    def bounding_box(self, tolerance: float | None = None, optimal: bool = True) -> BoundBox:
        """Create a bounding box for this Shape.

        Args:
            tolerance (float, optional): Defaults to None.

        Returns:
            BoundBox: A box sized to contain this Shape
        """
    wrapped: Incomplete
    def clean(self) -> Self:
        """clean

        Remove internal edges

        Returns:
            Shape: Original object with extraneous internal edges removed
        """
    def closest_points(self, other: Shape | VectorLike) -> tuple[Vector, Vector]:
        """Points on two shapes where the distance between them is minimal"""
    def compound(self) -> Compound:
        """Return the Compound"""
    def compounds(self) -> ShapeList[Compound]:
        """compounds - all the compounds in this Shape"""
    def copy_attributes_to(self, target: Shape, exceptions: Iterable[str] | None = None):
        """Copy common object attributes to target

        Note that preset attributes of target will not be overridden.

        Args:
            target (Shape): object to gain attributes
            exceptions (Iterable[str], optional): attributes not to copy

        Raises:
            ValueError: invalid attribute
        """
    def cut(self, *to_cut: Shape) -> Self | Compound:
        """Remove the positional arguments from this Shape.

        Args:
          *to_cut: Shape:

        Returns:
            Self | Compound: Resulting object may be of a different class than self
        """
    def distance(self, other: Shape) -> float:
        """Minimal distance between two shapes

        Args:
          other: Shape:

        Returns:

        """
    def distance_to(self, other: Shape | VectorLike) -> float:
        """Minimal distance between two shapes"""
    def distance_to_with_closest_points(self, other: Shape | VectorLike) -> tuple[float, Vector, Vector]:
        """Minimal distance between two shapes and the points on each shape"""
    def distances(self, *others: Shape) -> Iterator[float]:
        """Minimal distances to between self and other shapes

        Args:
          *others: Shape:

        Returns:

        """
    def edge(self) -> Edge:
        """Return the Edge"""
    def edges(self) -> ShapeList[Edge]:
        """edges - all the edges in this Shape - subclasses may override"""
    def entities(self, topo_type: Shapes) -> list[TopoDS_Shape]:
        """Return all of the TopoDS sub entities of the given type"""
    def face(self) -> Face:
        """Return the Face"""
    def faces(self) -> ShapeList[Face]:
        """faces - all the faces in this Shape"""
    def faces_intersected_by_axis(self, axis: Axis, tol: float = 0.0001) -> ShapeList[Face]:
        """Line Intersection

        Computes the intersections between the provided axis and the faces of this Shape

        Args:
            axis (Axis): Axis on which the intersection line rests
            tol (float, optional): Intersection tolerance. Defaults to 1e-4.

        Returns:
            list[Face]: A list of intersected faces sorted by distance from axis.position
        """
    def fix(self) -> Self:
        """fix - try to fix shape if not valid"""
    def fuse(self, *to_fuse: Shape, glue: bool = False, tol: float | None = None) -> Self | Compound:
        """fuse

        Fuse a sequence of shapes into a single shape.

        Args:
            to_fuse (sequence Shape): shapes to fuse
            glue (bool, optional): performance improvement for some shapes. Defaults to False.
            tol (float, optional): tolerance. Defaults to None.

        Returns:
            Self | Compound: Resulting object may be of a different class than self

        """
    def get_top_level_shapes(self) -> ShapeList[Shape]:
        """
        Retrieve the first level of child shapes from the shape.

        This method collects all the non-compound shapes directly contained in the
        current shape. If the wrapped shape is a `TopoDS_Compound`, it traverses
        its immediate children and collects all shapes that are not further nested
        compounds. Nested compounds are traversed to gather their non-compound elements
        without returning the nested compound itself.

        Returns:
            ShapeList[Shape]: A list of all first-level non-compound child shapes.

        Example:
            If the current shape is a compound containing both simple shapes
            (e.g., edges, vertices) and other compounds, the method returns a list
            of only the simple shapes directly contained at the top level.
        """
    def intersect(self, *to_intersect: Shape | Vector | Location | Axis | Plane, tolerance: float = 1e-06, include_touched: bool = False) -> ShapeList | None:
        """Find where bodies/interiors meet (overlap or crossing geometry).

        This is the main entry point for intersection operations. Handles
        geometry conversion and delegates to subclass _intersect() implementations.

        Semantics:
            - Multiple arguments use AND (chaining): c.intersect(s1, s2) = c ∩ s1 ∩ s2
            - Compound arguments use OR (distribution): c.intersect(Compound([s1, s2]))
              = (c ∩ s1) ∪ (c ∩ s2)

        Args:
            to_intersect: Shape(s) or geometry objects to intersect with
            tolerance: tolerance for intersection detection
            include_touched: if True, include boundary contacts without interior
                overlap (only relevant when Solids are involved)

        Returns:
            ShapeList of intersection results, or None if no intersection
        """
    def touch(self, other: Shape, tolerance: float = 1e-06) -> ShapeList:
        """Find boundary contacts between this shape and another.

        Base implementation returns empty ShapeList. Subclasses (Mixin2D, Mixin3D,
        Compound) override this to provide actual touch detection.

        Args:
            other: Shape to find contacts with
            tolerance: tolerance for contact detection

        Returns:
            ShapeList of contact shapes (empty for base implementation)
        """
    def is_equal(self, other: Shape) -> bool:
        """Returns True if two shapes are equal, i.e. if they share the same
        TShape with the same Locations and Orientations. Also see
        :py:meth:`is_same`.

        Args:
          other: Shape:

        Returns:

        """
    def is_same(self, other: Shape) -> bool:
        """Returns True if other and this shape are same, i.e. if they share the
        same TShape with the same Locations. Orientations may differ. Also see
        :py:meth:`is_equal`

        Args:
          other: Shape:

        Returns:

        """
    def locate(self, loc: Location) -> Self:
        """Apply a location in absolute sense to self

        Args:
          loc: Location:

        Returns:

        """
    def located(self, loc: Location) -> Self:
        """located

        Apply a location in absolute sense to a copy of self

        Args:
            loc (Location): new absolute location

        Returns:
            Shape: copy of Shape at location
        """
    def mesh(self, tolerance: float, angular_tolerance: float = 0.1):
        """Generate triangulation if none exists.

        Args:
          tolerance: float:
          angular_tolerance: float:  (Default value = 0.1)

        Returns:

        """
    def mirror(self, mirror_plane: Plane | None = None) -> Self:
        """
        Applies a mirror transform to this Shape. Does not duplicate objects
        about the plane.

        Args:
          mirror_plane (Plane): The plane to mirror about. Defaults to Plane.XY
        Returns:
          The mirrored shape
        """
    def move(self, loc: Location) -> Self:
        """Apply a location in relative sense (i.e. update current location) to self

        Args:
          loc: Location:

        Returns:

        """
    def moved(self, loc: Location | Plane) -> Self:
        """moved

        Apply a location in relative sense (i.e. update current location) to a copy of self

        Args:
            loc (Location | Plane): new location relative to current location

        Returns:
            Shape: copy of Shape moved to relative location
        """
    def oriented_bounding_box(self) -> OrientedBoundBox:
        """Create an oriented bounding box for this Shape.

        Returns:
            OrientedBoundBox: A box oriented and sized to contain this Shape
        """
    def project_faces(self, faces: list[Face] | Compound, path: Wire | Edge, start: float = 0) -> ShapeList[Face]:
        """Projected Faces following the given path on Shape

        Project by positioning each face of to the shape along the path and
        projecting onto the surface.

        Note that projection may result in distortion depending on
        the shape at a position along the path.

        .. image:: projectText.png

        Args:
            faces (Union[list[Face], Compound]): faces to project
            path: Path on the Shape to follow
            start: Relative location on path to start the faces. Defaults to 0.

        Returns:
            The projected faces

        """
    def radius_of_gyration(self, axis: Axis) -> float:
        """
        Compute the radius of gyration of the shape about a given axis.

        The radius of gyration represents the distance from the axis at which the entire
        mass of the shape could be concentrated without changing its moment of inertia.
        It provides insight into how mass is distributed relative to the axis and is
        useful in structural analysis, rotational dynamics, and mechanical simulations.

        Args:
            axis (Axis): The axis about which the radius of gyration is computed.
                        The axis should be defined in the same coordinate system
                        as the shape.

        Returns:
            float: The radius of gyration in the same units as the shape's dimensions.

        Example:
            >>> obj = MyShape()
            >>> axis = Axis((0, 0, 0), (0, 0, 1))
            >>> obj.radius_of_gyration(axis)
            5.47

        Notes:
            - The radius of gyration is computed based on the shape’s mass properties.
            - It is useful for evaluating structural stability and rotational behavior.
        """
    def relocate(self, loc: Location):
        """Change the location of self while keeping it geometrically similar

        Args:
            loc (Location): new location to set for self
        """
    def rotate(self, axis: Axis, angle: float, transform: bool = False) -> Self:
        """rotate a copy

        Rotates a shape around an axis.

        Args:
            axis (Axis): rotation Axis
            angle (float): angle to rotate, in degrees
            transform (bool): regenerate the shape instead of just changing its location.
                Defaults to False.

        Returns:
            a copy of the shape, rotated
        """
    def scale(self, factor: float | tuple[float, float, float], about: VectorLike | None = None) -> Self:
        """Scale this shape about a point.

        Non-uniform scaling may change the underlying geometry type to splines.
        When ``about`` isn't provided, the shape is scaled about its location.

        Args:
            factor (float | tuple[float, float, float]): uniform scale factor or
                three scale factors for the X, Y and Z directions.
            about (VectorLike, optional): point to scale about. Defaults to the
                shape's location position.

        Returns:
            Shape: a copy of the scaled shape.
        """
    def shell(self) -> Shell:
        """Return the Shell"""
    def shells(self) -> ShapeList[Shell]:
        """shells - all the shells in this Shape"""
    def show_topology(self, limit_class: Literal['Compound', 'Edge', 'Face', 'Shell', 'Solid', 'Vertex', 'Wire'] = 'Vertex', show_center: bool | None = None) -> str:
        """Display internal topology

        Display the internal structure of a Compound 'assembly' or Shape. Example:

        .. code::

            >>> c1.show_topology()

            c1 is the root         Compound at 0x7f4a4cafafa0, Location(...))
            ├──                    Solid    at 0x7f4a4cafafd0, Location(...))
            ├── c2 is 1st compound Compound at 0x7f4a4cafaee0, Location(...))
            │   ├──                Solid    at 0x7f4a4cafad00, Location(...))
            │   └──                Solid    at 0x7f4a11a52790, Location(...))
            └── c3 is 2nd          Compound at 0x7f4a4cafad60, Location(...))
                ├──                Solid    at 0x7f4a11a52700, Location(...))
                └──                Solid    at 0x7f4a11a58550, Location(...))

        Args:
            limit_class: type of displayed leaf node. Defaults to 'Vertex'.
            show_center (bool, optional): If None, shows the Location of Compound 'assemblies'
                and the bounding box center of Shapes. True or False forces the display.
                Defaults to None.

        Returns:
            str: tree representation of internal structure
        """
    def solid(self) -> Solid:
        """Return the Solid"""
    def solids(self) -> ShapeList[Solid]:
        """solids - all the solids in this Shape"""
    @overload
    def split(self, tool: TrimmingTool, keep: Literal[Keep.TOP, Keep.BOTTOM]) -> Self | list[Self] | None:
        """split and keep inside or outside"""
    @overload
    def split(self, tool: TrimmingTool, keep: Literal[Keep.ALL]) -> list[Self]:
        """split and return the unordered pieces"""
    @overload
    def split(self, tool: TrimmingTool, keep: Literal[Keep.BOTH]) -> tuple[Self | list[Self] | None, Self | list[Self] | None]:
        """split and keep inside and outside"""
    @overload
    def split(self, tool: TrimmingTool, keep: Literal[Keep.INSIDE, Keep.OUTSIDE]) -> None:
        """invalid split"""
    @overload
    def split(self, tool: TrimmingTool) -> Self | list[Self] | None:
        """split and keep inside (default)"""
    @overload
    def split_by_perimeter(self, perimeter: Edge | Wire, keep: Literal[Keep.INSIDE, Keep.OUTSIDE]) -> Face | Shell | ShapeList[Face] | None:
        """split_by_perimeter and keep inside or outside"""
    @overload
    def split_by_perimeter(self, perimeter: Edge | Wire, keep: Literal[Keep.BOTH]) -> tuple[Face | Shell | ShapeList[Face] | None, Face | Shell | ShapeList[Face] | None]:
        """split_by_perimeter and keep inside and outside"""
    @overload
    def split_by_perimeter(self, perimeter: Edge | Wire, keep: Literal[Keep.INSIDE] = ...) -> Face | Shell | ShapeList[Face] | None:
        """split_by_perimeter and keep inside (default)"""
    def tessellate(self, tolerance: float, angular_tolerance: float = 0.1) -> tuple[list[Vector], list[tuple[int, int, int]]]:
        """General triangulated approximation"""
    def to_splines(self, degree: int = 3, tolerance: float = 0.001, nurbs: bool = False) -> Self:
        """to_splines

        A shape-processing utility that forces all geometry in a shape to be converted into
        BSplines. It's useful when working with tools or export formats that require uniform
        geometry, or for downstream processing that only understands BSpline representations.

        Args:
            degree (int, optional): Maximum degree. Defaults to 3.
            tolerance (float, optional): Approximation tolerance. Defaults to 1e-3.
            nurbs (bool, optional): Use rational splines. Defaults to False.

        Returns:
            Self: Approximated shape
        """
    def transform_geometry(self, t_matrix: Matrix) -> Self:
        """Apply affine transform

        WARNING: transform_geometry will sometimes convert lines and circles to
        splines, but it also has the ability to handle skew and stretching
        transformations.

        If your transformation is only translation and rotation, it is safer to
        use :py:meth:`transform_shape`, which doesn't change the underlying type
        of the geometry, but cannot handle skew transformations.

        Args:
            t_matrix (Matrix): affine transformation matrix

        Returns:
            Shape: a copy of the object, but with geometry transformed
        """
    def transform_shape(self, t_matrix: Matrix) -> Self:
        """Apply affine transform without changing type

        Transforms a copy of this Shape by the provided 3D affine transformation matrix.
        Note that not all transformation are supported - primarily designed for translation
        and rotation.  See :transform_geometry: for more comprehensive transformations.

        Args:
            t_matrix (Matrix): affine transformation matrix

        Returns:
            Shape: copy of transformed shape with all objects keeping their type
        """
    def transformed(self, rotate: VectorLike = (0, 0, 0), offset: VectorLike = (0, 0, 0)) -> Self:
        """Transform Shape

        Rotate and translate the Shape by the three angles (in degrees) and offset.

        Args:
            rotate (VectorLike, optional): 3-tuple of angles to rotate, in degrees.
                Defaults to (0, 0, 0).
            offset (VectorLike, optional): 3-tuple to offset. Defaults to (0, 0, 0).

        Returns:
            Shape: transformed object

        """
    def translate(self, vector: VectorLike, transform: bool = False) -> Self:
        """Translates this shape through a transformation.

        Args:
            vector (VectorLike): relative movement vector
            transform (bool): regenerate the shape instead of just changing its location
                Defaults to False.

        Returns:
            object with a relative move applied
        """
    def wire(self) -> Wire:
        """Return the Wire"""
    def wires(self) -> ShapeList[Wire]:
        """wires - all the wires in this Shape"""
    def vertex(self) -> Vertex:
        """Return the Vertex"""
    def vertices(self) -> ShapeList[Vertex]:
        """vertices - all the vertices in this Shape"""

class Comparable(ABC, metaclass=abc.ABCMeta):
    """Abstract base class that requires comparison methods"""
    @abstractmethod
    def __eq__(self, other: Any) -> bool: ...
    @abstractmethod
    def __lt__(self, other: Any) -> bool: ...

class SupportsLessThan(Protocol):
    """ShapeList comparison criteria"""
    def __lt__(self, other: Any) -> bool: ...
T = TypeVar('T', bound=Shape | Vector)
K = TypeVar('K', bound=SupportsLessThan)

class GroupBy(Generic[T, K]):
    """Result of a Shape.groupby operation. Groups can be accessed by index or key"""
    key_to_group_index: list[tuple[K, int]]
    groups: list[ShapeList[T]]
    key_f: Incomplete
    def __init__(self, key_f: Callable[[T], K], shapelist: Iterable[T], *, reverse: bool = False) -> None: ...
    def __getitem__(self, key: int): ...
    def __iter__(self): ...
    def __len__(self) -> int: ...
    def group(self, key: K):
        """Select group by key"""
    def group_for(self, shape: T):
        """Select group by shape"""

def topo_distance_to(other: Shape | Iterable[Shape]) -> Callable[[Shape], int | float]:
    """Return a key function that yields topological distance to ``other``.

    The returned callable is intended for use with :meth:`ShapeList.sort_by`
    and :meth:`ShapeList.group_by`. Distances are measured on the full topology
    of the shared ``topo_parent`` of the reference shape(s), not only within
    the ``ShapeList`` being sorted or grouped.

    The first-pass implementation supports homogeneous collections of:
    ``Vertex``, ``Edge``, ``Wire``, ``Face``, ``Shell``, and ``Solid``.

    Adjacency is defined by shared lower-order topology:
    - ``Face`` via shared ``Edge``
    - ``Edge``/``Wire`` via shared ``Vertex``
    - ``Shell``/``Solid`` via shared ``Face``
    - ``Vertex`` via shared ``Edge``

    Reference shapes have distance ``0``. Directly connected shapes have
    distance ``1``. Each additional intervening peer increases the distance
    by ``1``. Unreachable shapes return ``inf``.

    Args:
        other: reference shape or shapes

    Raises:
        ValueError: empty reference set, mixed shape types, unsupported
            shape type, missing ``topo_parent``, or multiple parents

    Returns:
        Callable[[Shape], int | float]: key function for sorting/grouping
    """

class ShapeList(list[T]):
    """Subclass of list with custom filter and sort methods appropriate to CAD"""
    @property
    def first(self) -> T:
        """First element in the ShapeList"""
    @property
    def last(self) -> T:
        """Last element in the ShapeList"""
    def __add__(self, other: Shape | Iterable[Shape]) -> ShapeList[T]:
        """Return a new ShapeList that includes other"""
    def __iadd__(self, other: Shape | Iterable[Shape]) -> Self:
        """In-place addition to this ShapeList"""
    def __and__(self, other: ShapeList) -> ShapeList[T]:
        """Intersect two ShapeLists operator &"""
    def __eq__(self, other: object) -> bool:
        """ShapeLists equality operator =="""
    @overload
    def __getitem__(self, key: SupportsIndex) -> T: ...
    @overload
    def __getitem__(self, key: slice) -> ShapeList[T]: ...
    def __gt__(self, sort_by: Axis | SortBy = ...) -> ShapeList[T]:
        """Sort operator >"""
    def __lshift__(self, group_by: Axis | SortBy = ...) -> ShapeList[T]:
        """Group and select smallest group operator <<"""
    def __lt__(self, sort_by: Axis | SortBy = ...) -> ShapeList[T]:
        """Reverse sort operator <"""
    def __ne__(self, other: ShapeList) -> bool:
        """ShapeLists inequality operator !="""
    def __or__(self, filter_by: Axis | GeomType = ...) -> ShapeList[T]:
        """Filter by axis or geomtype operator |"""
    def __rshift__(self, group_by: Axis | SortBy = ...) -> ShapeList[T]:
        """Group and select largest group operator >>"""
    def __sub__(self, other: ShapeList) -> ShapeList[T]:
        """Differences between two ShapeLists operator -"""
    def expand(self) -> ShapeList:
        """Expand by dissolving compounds, wires, and shells, filtering nulls.

        Returns:
            ShapeList with compounds dissolved to children, wires to edges,
            shells to faces, and nulls filtered out
        """
    def center(self) -> Vector:
        """The average of the center of objects within the ShapeList"""
    def compound(self) -> Compound:
        """Return the Compound"""
    def compounds(self) -> ShapeList[Compound]:
        """compounds - all the compounds in this ShapeList"""
    def edge(self) -> Edge:
        """Return the Edge"""
    def edges(self) -> ShapeList[Edge]:
        """edges - all the edges in this ShapeList"""
    def face(self) -> Face:
        """Return the Face"""
    def faces(self) -> ShapeList[Face]:
        """faces - all the faces in this ShapeList"""
    def filter_by(self, filter_by: Callable[[T], bool] | Axis | Plane | GeomType | property, reverse: bool = False, tolerance: float = 1e-05) -> ShapeList[T]:
        """filter by

        Either:
        - filter objects of type planar Face or linear Edge by their normal or tangent
        (respectively) and sort the results by the given axis, or
        - filter the objects by the provided type. Note that not all types apply to all
        objects.

        Args:
            filter_by (Callable[[T], bool] | Axis | Plane | GeomType): function, axis,
                plane, or geom type to filter and possibly sort by. Filtering by a plane
                returns faces/edges parallel to that plane.
            reverse (bool, optional): invert the geom type filter. Defaults to False.
            tolerance (float, optional): maximum deviation from axis. Defaults to 1e-5.

        Raises:
            ValueError: Invalid filter_by type

        Returns:
            ShapeList: filtered list of objects
        """
    def filter_by_position(self, axis: Axis, minimum: float, maximum: float, inclusive: tuple[bool, bool] = (True, True)) -> ShapeList[T]:
        """filter by position

        Filter and sort objects by the position of their centers along given axis.
        min and max values can be inclusive or exclusive depending on the inclusive tuple.

        Args:
            axis (Axis): axis to sort by
            minimum (float): minimum value
            maximum (float): maximum value
            inclusive (tuple[bool, bool], optional): include min,max values.
                Defaults to (True, True).

        Returns:
            ShapeList: filtered object list
        """
    def group_by(self, group_by: Callable[[T], K] | Axis | Edge | Wire | SortBy | property = ..., reverse: bool = False, tol_digits: int = 6) -> GroupBy[T, K]:
        """group by

        Group objects by provided criteria and then sort the groups according to the criteria.
        Note that not all group_by criteria apply to all objects.

        Args:
            group_by (Callable[[T], K] | Axis | Edge | Wire | SortBy | property,
                optional): group and sort criteria. Defaults to Axis.Z.
            reverse (bool, optional): flip order of sort. Defaults to False.
            tol_digits (int, optional): Tolerance for building the group keys by
                round(key, tol_digits)

        Returns:
            GroupBy[T, K]: sorted groups of ShapeLists
        """
    def shell(self) -> Shell:
        """Return the Shell"""
    def shells(self) -> ShapeList[Shell]:
        """shells - all the shells in this ShapeList"""
    def solid(self) -> Solid:
        """Return the Solid"""
    def solids(self) -> ShapeList[Solid]:
        """solids - all the solids in this ShapeList"""
    def sort_by(self, sort_by: Callable[[T], K] | Axis | Edge | Wire | SortBy | property = ..., reverse: bool = False, tie_break: bool = False) -> ShapeList[T]:
        """sort by

        Sort objects by provided criteria. Note that not all sort_by criteria apply to all
        objects.

        Args:
            sort_by (Callable[[T], K] | Axis | Edge | Wire | SortBy | property,
                optional): sort criteria. Defaults to Axis.Z.
            reverse (bool, optional): flip order of sort. Defaults to False.

        Raises:
            ValueError: Cannot sort by an empty axis
            ValueError: Cannot sort by an empty object
            ValueError: Invalid sort_by criteria provided

        Returns:
            ShapeList: sorted list of objects
        """
    def sort_by_distance(self, other: Shape | VectorLike, reverse: bool = False) -> ShapeList[T]:
        """Sort by distance

        Sort by minimal distance between objects and other

        Args:
            other (Union[Shape,VectorLike]): reference object
            reverse (bool, optional): flip order of sort. Defaults to False.

        Returns:
            ShapeList: Sorted shapes
        """
    def vertex(self) -> Vertex:
        """Return the Vertex"""
    def vertices(self) -> ShapeList[Vertex]:
        """vertices - all the vertices in this ShapeList"""
    def wire(self) -> Wire:
        """Return the Wire"""
    def wires(self) -> ShapeList[Wire]:
        """wires - all the wires in this ShapeList"""

class Joint(ABC, metaclass=abc.ABCMeta):
    """Joint

    Abstract Base Joint class - used to join two components together

    Args:
        parent (Union[Solid, Compound]): object that joint to bound to

    Attributes:
        label (str): user assigned label
        parent (Shape): object joint is bound to
        connected_to (Joint): joint that is connect to this joint

    """
    label: Incomplete
    parent: Incomplete
    connected_to: Joint | None
    def __init__(self, label: str, parent: BuildPart | Solid | Compound) -> None: ...
    @property
    @abstractmethod
    def location(self) -> Location:
        """Location of joint"""
    @property
    @abstractmethod
    def symbol(self) -> Compound:
        """A CAD object positioned in global space to illustrate the joint"""
    @abstractmethod
    def connect_to(self, *args, **kwargs):
        """All derived classes must provide a connect_to method"""
    @abstractmethod
    def relative_to(self, *args, **kwargs) -> Location:
        """Return relative location to another joint"""

class SkipClean:
    """Skip clean context for use in operator driven code where clean=False wouldn't work"""
    clean: bool
    def __enter__(self) -> None: ...
    def __exit__(self, exception_type: type[BaseException] | None, exception_value: BaseException | None, traceback: types.TracebackType | None) -> None: ...

def downcast(obj: TopoDS_Shape) -> TopoDS_Shape:
    """Downcasts a TopoDS object to suitable specialized type

    Args:
      obj: TopoDS_Shape:

    Returns:

    """
def fix(obj: TopoDS_Shape) -> TopoDS_Shape:
    """Fix a TopoDS object to suitable specialized type

    Args:
      obj: TopoDS_Shape:

    Returns:

    """
def get_top_level_topods_shapes(topods_shape: TopoDS_Shape | None) -> list[TopoDS_Shape]:
    """
    Retrieve the first level of child shapes from the shape.

    This method collects all the non-compound shapes directly contained in the
    current shape. If the wrapped shape is a `TopoDS_Compound`, it traverses
    its immediate children and collects all shapes that are not further nested
    compounds. Nested compounds are traversed to gather their non-compound elements
    without returning the nested compound itself.

    Returns:
        list[TopoDS_Shape]: A list of all first-level non-compound child shapes.

    Example:
        If the current shape is a compound containing both simple shapes
        (e.g., edges, vertices) and other compounds, the method returns a list
        of only the simple shapes directly contained at the top level.
    """
def shapetype(obj: TopoDS_Shape | None) -> TopAbs_ShapeEnum:
    """Return TopoDS_Shape's TopAbs_ShapeEnum"""
def topods_dim(topods: TopoDS_Shape) -> int | None:
    """Return the dimension of this TopoDS_Shape"""
def unwrap_topods_compound(compound: TopoDS_Compound, fully: bool = True) -> TopoDS_Compound | TopoDS_Shape:
    """Strip unnecessary Compound wrappers

    Args:
        compound (TopoDS_Compound): The TopoDS_Compound to unwrap.
        fully (bool, optional): return base shape without any TopoDS_Compound
            wrappers (otherwise one TopoDS_Compound is left). Defaults to True.

    Returns:
        TopoDS_Compound | TopoDS_Shape: base shape
    """
