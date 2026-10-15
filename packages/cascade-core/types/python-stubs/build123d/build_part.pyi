from build123d.build_common import Builder as Builder, logger as logger
from build123d.build_enums import Mode as Mode
from build123d.geometry import Location as Location, Plane as Plane
from build123d.topology import Edge as Edge, Face as Face, Joint as Joint, Part as Part, Solid as Solid, Wire as Wire
from typing import ClassVar

class BuildPart(Builder[Part]):
    """BuildPart

    The BuildPart class is another subclass of Builder for building parts
    (objects with the property of volume) from sketches or 3D objects.
    It has an _obj property that returns the current part being built, and
    several pending lists for storing faces, edges, and planes that will be
    integrated into the final part later. The class overrides the _add_to_pending
    method of Builder.

    Args:
        placements (Plane, optional): output placement(s). Defaults to Plane.XY.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
    build123d_type: ClassVar[str]
    joints: dict[str, Joint]
    pending_faces: list[Face]
    pending_face_planes: list[Plane]
    pending_planes: list[Plane]
    pending_edges: list[Edge]
    def __init__(self, *placements: Face | Plane | Location, mode: Mode = ...) -> None: ...
    @property
    def part(self) -> Part | None:
        """Get the placed part."""
    @part.setter
    def part(self, value: Part) -> None:
        """Set the current part"""
    @property
    def part_local(self) -> Part | None:
        """Get the part in the Builder's local construction coordinates."""
    @property
    def pending_edges_as_wire(self) -> Wire:
        """Return a wire representation of the pending edges"""
    @property
    def location(self) -> Location:
        """Builder's location"""
