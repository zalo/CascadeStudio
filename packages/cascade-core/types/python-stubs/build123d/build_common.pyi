import abc
import types
from _typeshed import Incomplete
from abc import ABC, ABCMeta
from build123d.build_constants import CM as CM, FT as FT, G as G, G_PER_LB as G_PER_LB, IN as IN, KG as KG, LB as LB, M as M, MC as MC, MM as MM, THOU as THOU, UNITS_PER_KILOGRAM as UNITS_PER_KILOGRAM, UNITS_PER_METER as UNITS_PER_METER
from build123d.build_enums import Align as Align, Mode as Mode, Select as Select
from build123d.geometry import Axis as Axis, Location as Location, Plane as Plane, Vector as Vector, VectorLike as VectorLike, to_align_offset as to_align_offset
from build123d.topology import Compound as Compound, Curve as Curve, Edge as Edge, Face as Face, Joint as Joint, Part as Part, Shape as Shape, ShapeHistory as ShapeHistory, ShapeList as ShapeList, Sketch as Sketch, Solid as Solid, Vertex as Vertex, Wire as Wire, tuplify as tuplify
from collections.abc import Callable as Callable, Iterable
from dataclasses import dataclass, field as dataclass_field
from typing import Any, Generic, TypeVar
from typing_extensions import Self

logger: Incomplete
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
        placements: sequence of Union[Face, Plane, Location]: output placement(s)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Attributes:
        mode (Mode): builder's combination mode
        placements (tuple[Location, ...]): output placement(s)
        builder_parent (Builder): build to pass objects to on exit
        label (str): label assigned to the builder's output object

    """
    mode: Incomplete
    output_placements: Incomplete
    placements: Incomplete
    parent_frame: Incomplete
    builder_parent: Builder | None
    obj_before: Shape | None
    to_combine: list[Shape]
    def __init__(self, *placements: Face | Plane | Location, mode: Mode = ...) -> None: ...
    @property
    def max_dimension(self) -> float:
        """Maximum size of object in all directions"""
    @property
    def label(self) -> str:
        """Label assigned to the builder's output object."""
    @label.setter
    def label(self, value: str) -> None:
        """Assign a label to the builder's output object."""
    @property
    def new_edges(self) -> ShapeList[Edge]:
        """Edges the last operation created outright, as ``edges(Select.NEW)``"""
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
    @property
    def lasts(self) -> dict:
        """Shapes the last operation brought in or created, by type"""
    @property
    def news(self) -> dict:
        """Shapes the last operation created outright, by type"""
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
    at all times. Locations are expressed in the Builder's local Plane.XY
    construction coordinates. Consequently, ordinary ``Vector`` and tuple
    arithmetic is already local and no workplane-aware Vector monkeypatch is
    required; output placements are applied only when the product is published.

    Args:
        locations (list[Location]): list of locations to add to the context

    """
    @property
    def locations(self) -> list[Location]:
        """Current locations in local construction coordinates."""
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

class _InheritedScopeValue:
    """Sentinel identifying an omitted ``BuildScope.derive()`` argument.

    A nullable scope field needs three instructions when deriving a child:
    inherit the parent value, replace it, or explicitly clear it with ``None``.
    The sentinel represents inheritance without making ``None`` ambiguous.
    It is only an argument state; it is never stored in a ``BuildScope`` field.
    """

@dataclass(frozen=True, slots=True)
class BuildScope:
    """Immutable context state shared by Builders and BaseObjects.

    One scope groups Builder construction, publication, location, and BaseObject
    isolation state so a context transition replaces all related state atomically.
    Earlier implementations used independent ``ContextVar`` stacks for Builder,
    LocationList, WorkplaneList, and BaseObject; those stacks could temporarily
    disagree and made firewall restoration dependent on reset ordering.
    """
    parent: BuildScope | None = ...
    builder: Builder | None = ...
    operation_locations: tuple[Location, ...] = dataclass_field(default_factory=_identity_locations)
    publication_locations: tuple[Location, ...] = dataclass_field(default_factory=_identity_locations)
    output_placements: tuple[Location, ...] = dataclass_field(default_factory=_identity_locations)
    owner: object | None = ...
    publication_target: Builder | None = ...
    isolated: bool = ...
    location_context: LocationList | None = ...
    object_context: BuildScope | None = ...
    object_local_locations: tuple[Location, ...] = dataclass_field(default_factory=_identity_locations)
    object_placements: tuple[Location, ...] = dataclass_field(default_factory=_identity_locations)
    def __post_init__(self) -> None:
        """Reject empty transform sets that would silently produce no geometry.

        Internal factories normally guarantee this invariant, but ``derive()``
        can be called directly with an empty tuple. Publication and operation
        code use Cartesian products over these fields, so an empty value would
        discard a valid product rather than fail near the source of the error.
        """
    def derive(self, *, builder: Builder | None | _InheritedScopeValue = ..., operation_locations: tuple[Location, ...] | _InheritedScopeValue = ..., publication_locations: tuple[Location, ...] | _InheritedScopeValue = ..., output_placements: tuple[Location, ...] | _InheritedScopeValue = ..., owner: object | _InheritedScopeValue = ..., publication_target: Builder | None | _InheritedScopeValue = ..., isolated: bool | _InheritedScopeValue = ..., location_context: LocationList | None | _InheritedScopeValue = ..., object_context: BuildScope | None | _InheritedScopeValue = ..., object_local_locations: tuple[Location, ...] | _InheritedScopeValue = ..., object_placements: tuple[Location, ...] | _InheritedScopeValue = ...) -> BuildScope:
        """Create a child scope, inheriting arguments that were omitted.

        For nullable fields such as ``builder``, omission inherits the parent,
        ``None`` explicitly clears the field, and an object replaces it. The
        private sentinel distinguishes omission from the meaningful ``None``.
        """

@dataclass(slots=True)
class _BaseObjectScopeOwner:
    """Mutable lifecycle state for an otherwise immutable object scope."""
    root: BaseObject | None = ...

class BaseObjectMeta(ABCMeta):
    """Isolate BaseObject internals from their caller's implicit contexts."""
    def __call__(cls, *args, **kwargs):
        """Construct the outer object behind a Builder and placement firewall."""

class _PublicationService:
    """Place completed products and publish them to captured Builders."""
    @staticmethod
    def place(build_product: Shape | None, scope: BuildScope, *, result_type: type[Shape] | None = None) -> Shape | None:
        """Apply every publication/output placement combination exactly once."""
    @classmethod
    def publish(cls, build_product: Shape | None, scope: BuildScope, mode: Mode, *, result_type: type[Shape] | None = None, place: bool = True, preserve_identity: bool = False) -> Shape | None:
        """Place a product and dispatch it once to its publication target."""

class BaseObject(metaclass=BaseObjectMeta):
    """Common context-isolation behavior for builder-aware objects."""
    def __new__(cls, *_args, **_kwargs): ...
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
