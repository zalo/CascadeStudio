from build123d.build_common import Builder as Builder
from build123d.build_enums import Mode as Mode
from build123d.geometry import Location as Location, Plane as Plane
from build123d.topology import Curve as Curve, Edge as Edge, Face as Face
from typing import ClassVar

class BuildLine(Builder[Curve]):
    """BuildLine

    The BuildLine class is a subclass of Builder for building lines (objects
    with length but not area or volume). It has an _obj property that returns
    the current line being built. The class overrides the faces and solids methods
    of Builder since they don't apply to lines.

    BuildLine constructs geometry on local Plane.XY and publishes the completed
    curve to a single placement. For example:

    .. code::

        with BuildLine(Plane.YZ) as radius_arc:
            RadiusArc((1, 2), (2, 1), 1)

    constructs an arc from local points (1, 2, 0) to (2, 1, 0), then publishes
    it to Plane.YZ.

    Args:
        placement (Union[Face, Plane, Location], optional): output placement.
            Defaults to Plane.XY.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
    build123d_type: ClassVar[str]
    def __init__(self, placement: Face | Plane | Location = ..., mode: Mode = ...) -> None: ...
    @property
    def line(self) -> Curve | None:
        """Get the placed line."""
    @line.setter
    def line(self, value: Curve) -> None:
        """Set the current line"""
    @property
    def line_local(self) -> Curve | None:
        """Get the line in the Builder's local construction coordinates."""
    def faces(self, *args) -> None:
        """faces() not implemented"""
    def face(self, *args) -> None:
        """face() not implemented"""
    def solids(self, *args) -> None:
        """solids() not implemented"""
    def solid(self, *args) -> None:
        """solid() not implemented"""
