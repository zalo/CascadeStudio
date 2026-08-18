import types
from _typeshed import Incomplete
from build123d.build_common import Builder as Builder, WorkplaneList as WorkplaneList, logger as logger
from build123d.build_enums import Mode as Mode
from build123d.geometry import Location as Location, Plane as Plane
from build123d.topology import Curve as Curve, Edge as Edge, Face as Face

class BuildLine(Builder[Curve]):
    """BuildLine

    The BuildLine class is a subclass of Builder for building lines (objects
    with length but not area or volume). It has an _obj property that returns
    the current line being built. The class overrides the faces and solids methods
    of Builder since they don't apply to lines.

    BuildLine only works with a single workplane which is used to convert tuples
    as inputs to global coordinates. For example:

    .. code::

        with BuildLine(Plane.YZ) as radius_arc:
            RadiusArc((1, 2), (2, 1), 1)

    creates an arc from global points (0, 1, 2) to (0, 2, 1). Note that points
    entered as Vector(x, y, z) are considered global and are not localized.

    The workplane is also used to define planes parallel to the workplane that
    arcs are created on.

    Args:
        workplane (Union[Face, Plane, Location], optional): plane used when local
            coordinates are used and when creating arcs. Defaults to Plane.XY.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
    def __init__(self, workplane: Face | Plane | Location = ..., mode: Mode = ...) -> None: ...
    @property
    def line(self) -> Curve | None:
        """Get the current line"""
    @line.setter
    def line(self, value: Curve) -> None:
        """Set the current line"""
    exit_workplanes: Incomplete
    def __exit__(self, exception_type: type[BaseException] | None, exception_value: BaseException | None, traceback: types.TracebackType | None) -> None:
        """Upon exiting restore context and send object to parent"""
    def faces(self, *args) -> None:
        """faces() not implemented"""
    def face(self, *args) -> None:
        """face() not implemented"""
    def solids(self, *args) -> None:
        """solids() not implemented"""
    def solid(self, *args) -> None:
        """solid() not implemented"""
