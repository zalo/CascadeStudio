import abc
import types
from _typeshed import Incomplete
from abc import ABC
from build123d.build_enums import Align as Align, Mode as Mode, Select as Select, Unit as Unit
from build123d.geometry import Axis as Axis, Location as Location, Plane as Plane, Vector as Vector, VectorLike as VectorLike, to_align_offset as to_align_offset
from build123d.topology import Compound as Compound, Curve as Curve, Edge as Edge, Face as Face, Joint as Joint, Part as Part, Shape as Shape, ShapeList as ShapeList, Sketch as Sketch, Solid as Solid, Vertex as Vertex, Wire as Wire, new_edges as new_edges, tuplify as tuplify
from collections.abc import Callable as Callable, Iterable
from typing import Any, Generic, TypeVar, overload
from typing_extensions import Self

logger: Incomplete
MC: float
MM: int
CM: Incomplete
M: Incomplete
IN: Incomplete
FT: Incomplete
THOU: Incomplete
UNITS_PER_METER: Incomplete
G: int
KG: Incomplete
LB: Incomplete
T = TypeVar('T', Any, list[Any])

def flatten_sequence(*obj: T) -> ShapeList[Any]:
    """Convert a sequence of object potentially containing iterables into a flat list"""

operations_apply_to: Incomplete
B = TypeVar('B', bound='Builder')
ShapeT = TypeVar('ShapeT', bound=Shape)

class Builder(ABC, Generic[ShapeT], metaclass=abc.ABCMeta):
    """Builder

    Base class for the build123d Builders.

    Args:
        workplanes: sequence of Union[Face, Plane, Location]: set plane(s) to work on
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Attributes:
        mode (Mode): builder's combination mode
        workplanes (list[Plane]): active workplanes
        builder_parent (Builder): build to pass objects to on exit

    """
    mode: Incomplete
    workplanes: Incomplete
    parent_frame: Incomplete
    builder_parent: Builder | None
    lasts: dict
    workplanes_context: Incomplete
    exit_workplanes: list[Plane]
    obj_before: Shape | None
    to_combine: list[Shape]
    def __init__(self, *workplanes: Face | Plane | Location, mode: Mode = ...) -> None: ...
    @property
    def max_dimension(self) -> float:
        """Maximum size of object in all directions"""
    @property
    def new_edges(self) -> ShapeList[Edge]:
        """Edges that changed during last operation"""
    def __enter__(self) -> Self:
        """Upon entering record the parent and a token to restore contextvars"""
    def __exit__(self, exception_type: type[BaseException] | None, exception_value: BaseException | None, traceback: types.TracebackType | None) -> None:
        """Upon exiting restore context and send object to parent"""
    def vertices(self, select: Select = ...) -> ShapeList[Vertex]:
        """Return Vertices

        Return either all or the vertices created during the last operation.

        Args:
            select (Select, optional): Vertex selector. Defaults to Select.ALL.

        Returns:
            ShapeList[Vertex]: Vertices extracted
        """
    def vertex(self, select: Select = ...) -> Vertex:
        """Return Vertex

        Return a vertex.

        Args:
            select (Select, optional): Vertex selector. Defaults to Select.ALL.

        Returns:
            Vertex: Vertex extracted
        """
    def edges(self, select: Select = ...) -> ShapeList[Edge]:
        """Return Edges

        Return either all or the edges created during the last operation.

        Args:
            select (Select, optional): Edge selector. Defaults to Select.ALL.

        Returns:
            ShapeList[Edge]: Edges extracted
        """
    def edge(self, select: Select = ...) -> Edge:
        """Return Edge

        Return an edge.

        Args:
            select (Select, optional): Edge selector. Defaults to Select.ALL.

        Returns:
            Edge: Edge extracted
        """
    def wires(self, select: Select = ...) -> ShapeList[Wire]:
        """Return Wires

        Return either all or the wires created during the last operation.

        Args:
            select (Select, optional): Wire selector. Defaults to Select.ALL.

        Returns:
            ShapeList[Wire]: Wires extracted
        """
    def wire(self, select: Select = ...) -> Wire:
        """Return Wire

        Return a wire.

        Args:
            select (Select, optional): Wire selector. Defaults to Select.ALL.

        Returns:
            Wire: Wire extracted
        """
    def faces(self, select: Select = ...) -> ShapeList[Face]:
        """Return Faces

        Return either all or the faces created during the last operation.

        Args:
            select (Select, optional): Face selector. Defaults to Select.ALL.

        Returns:
            ShapeList[Face]: Faces extracted
        """
    def face(self, select: Select = ...) -> Face:
        """Return Face

        Return a face.

        Args:
            select (Select, optional): Face selector. Defaults to Select.ALL.

        Returns:
            Face: Face extracted
        """
    def solids(self, select: Select = ...) -> ShapeList[Solid]:
        """Return Solids

        Return either all or the solids created during the last operation.

        Args:
            select (Select, optional): Solid selector. Defaults to Select.ALL.

        Returns:
            ShapeList[Solid]: Solids extracted
        """
    def solid(self, select: Select = ...) -> Solid:
        """Return Solid

        Return a solid.

        Args:
            select (Select, optional): Solid selector. Defaults to Select.ALL.

        Returns:
            Solid: Solid extracted
        """
    def validate_inputs(self, validating_class, objects: Shape | Iterable[Shape] | None = None):
        """Validate that objects/operations and parameters apply"""
    def __add__(self, _other) -> Self:
        """Invalid add"""
    def __sub__(self, _other) -> Self:
        """Invalid sub"""
    def __and__(self, _other) -> Self:
        """Invalid and"""
    def __getattr__(self, name) -> None:
        """The user is likely trying to reference the builder's object"""

def validate_inputs(context: Builder | None, validating_class, objects: Iterable[Shape] | None = None):
    """A function to wrap the method when used outside of a Builder context"""

class LocationList:
    """Location Context

    A stateful context of active locations. At least one must be active
    at all time. Note that local locations are stored and global locations
    are returned as a property of the local locations and the currently
    active workplanes.

    Args:
        locations (list[Location]): list of locations to add to the context

    """
    @property
    def locations(self) -> list[Location]:
        """Current local locations globalized with current workplanes"""
    local_locations: Incomplete
    def __init__(self, locations: list[Location]) -> None: ...
    def __enter__(self):
        """Upon entering create a token to restore contextvars"""
    def __exit__(self, exception_type: type[BaseException] | None, exception_value: BaseException | None, traceback: types.TracebackType | None) -> None:
        """Upon exiting restore context"""
    def __iter__(self): ...

class HexLocations(LocationList):
    """Location Context: Hex Array

    Creates a context of hexagon array of locations for Part or Sketch. When creating
    hex locations for an array of circles, set `radius` to the radius of the circle
    plus one half the spacing between the circles.

    Args:
        radius (float): distance from origin to vertices (major), or
            optionally from the origin to side (minor or apothem)
            with major_radius = False
        x_count (int): number of points ( > 0 )
        y_count (int): number of points ( > 0 )
        major_radius (bool): If True the radius is the major radius, else the
            radius is the minor radius (also known as inscribed radius).
            Defaults to False.
        align (Union[Align, tuple[Align, Align]], optional): align min, center, or max of object.
            Defaults to (Align.CENTER, Align.CENTER).

    Attributes:
        radius (float): distance from origin to vertices (major), or
            optionally from the origin to side (minor or apothem)
            with major_radius = False
        apothem (float): radius of the inscribed circle, also known as minor radius
        x_count (int): number of points ( > 0 )
        y_count (int): number of points ( > 0 )
        major_radius (bool): If True the radius is the major radius, else the
            radius is the minor radius (also known as inscribed radius).
        align (Union[Align, tuple[Align, Align]]): align min, center, or max of object.
        diagonal (float): major radius
        local_locations (list{Location}): locations relative to workplane

    Raises:
        ValueError: Spacing and count must be > 0
    """
    radius: Incomplete
    apothem: Incomplete
    diagonal: Incomplete
    x_count: Incomplete
    y_count: Incomplete
    major_radius: Incomplete
    align: Incomplete
    local_locations: Incomplete
    def __init__(self, radius: float, x_count: int, y_count: int, major_radius: bool = False, align: Align | tuple[Align, Align] = ...) -> None: ...

class PolarLocations(LocationList):
    """Location Context: Polar Array

    Creates a context of polar array of locations for Part or Sketch

    Args:
        radius (float): array radius
        count (int): Number of points to push
        start_angle (float, optional): angle to first point from +ve X axis. Defaults to 0.0.
        angular_range (float, optional): magnitude of array from start angle. Defaults to 360.0.
        rotate (bool, optional): Align locations with arc tangents. Defaults to True.
        endpoint (bool, optional): If True, `start_angle` + `angular_range` is the last sample.
            Otherwise, it is not included. Defaults to False.

    Attributes:
        local_locations (list{Location}): locations relative to workplane

    Raises:
        ValueError: Count must be greater than or equal to 1
    """
    local_locations: Incomplete
    def __init__(self, radius: float, count: int, start_angle: float = 0.0, angular_range: float = 360.0, rotate: bool = True, endpoint: bool = False) -> None: ...

class Locations(LocationList):
    """Location Context: Push Points

    Creates a context of locations for Part or Sketch

    Args:
        pts (Union[VectorLike, Vertex, Location, Face, Plane, Axis] or iterable of same):
            sequence of points to push

    Attributes:
        local_locations (list{Location}): locations relative to workplane

    """
    local_locations: Incomplete
    def __init__(self, *pts: VectorLike | Vertex | Location | Face | Plane | Axis | Iterable[VectorLike | Vertex | Location | Face | Plane | Axis]) -> None: ...

class GridLocations(LocationList):
    """Location Context: Rectangular Array

    Creates a context of rectangular array of locations for Part or Sketch

    Args:
        x_spacing (float): horizontal spacing
        y_spacing (float): vertical spacing
        x_count (int): number of horizontal points
        y_count (int): number of vertical points
        align (Union[Align, tuple[Align, Align]], optional): align min, center, or max of object.
            Defaults to (Align.CENTER, Align.CENTER).


    Attributes:
        x_spacing (float): horizontal spacing
        y_spacing (float): vertical spacing
        x_count (int): number of horizontal points
        y_count (int): number of vertical points
        align (Union[Align, tuple[Align, Align]]): align min, center, or max of object.
        local_locations (list{Location}): locations relative to workplane

    Raises:
        ValueError: Either x or y count must be greater than or equal to one.
    """
    x_spacing: Incomplete
    y_spacing: Incomplete
    x_count: Incomplete
    y_count: Incomplete
    align: Incomplete
    size: Incomplete
    min: Incomplete
    max: Incomplete
    local_locations: Incomplete
    planes: list[Plane]
    def __init__(self, x_spacing: float, y_spacing: float, x_count: int, y_count: int, align: Align | tuple[Align, Align] = ...) -> None: ...

class WorkplaneList:
    """Workplane Context

    A stateful context of active workplanes. At least one must be active
    at all time.

    Args:
        workplanes (sequence of Union[Face, Plane, Location]): objects to become planes

    Attributes:
        workplanes (list[Plane]): list of workplanes

    """
    workplanes: Incomplete
    locations_context: Incomplete
    def __init__(self, *workplanes: Face | Plane | Location) -> None: ...
    def __enter__(self):
        """Upon entering create a token to restore contextvars"""
    def __exit__(self, exception_type: type[BaseException] | None, exception_value: BaseException | None, traceback: types.TracebackType | None) -> None:
        """Upon exiting restore context"""
    def __iter__(self): ...
    @overload
    @classmethod
    def localize(cls, points: VectorLike) -> Vector: ...
    @overload
    @classmethod
    def localize(cls, *points: VectorLike) -> list[Vector]: ...
T2 = TypeVar('T2')
vertices: Incomplete
edges: Incomplete
wires: Incomplete
faces: Incomplete
solids: Incomplete
vertex: Incomplete
edge: Incomplete
wire: Incomplete
face: Incomplete
solid: Incomplete
