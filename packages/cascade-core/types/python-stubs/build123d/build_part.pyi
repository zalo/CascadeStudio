from build123d.build_common import Builder as Builder, logger as logger
from build123d.build_enums import Mode as Mode
from build123d.geometry import Location as Location, Plane as Plane
from build123d.topology import Edge as Edge, Face as Face, Joint as Joint, Part as Part, Solid as Solid, Wire as Wire

class BuildPart(Builder[Part]):
    """BuildPart

    The BuildPart class is another subclass of Builder for building parts
    (objects with the property of volume) from sketches or 3D objects.
    It has an _obj property that returns the current part being built, and
    several pending lists for storing faces, edges, and planes that will be
    integrated into the final part later. The class overrides the _add_to_pending
    method of Builder.

    Args:
        workplanes (Plane, optional): initial plane to work on. Defaults to Plane.XY.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
    joints: dict[str, Joint]
    pending_faces: list[Face]
    pending_face_planes: list[Plane]
    pending_planes: list[Plane]
    pending_edges: list[Edge]
    def __init__(self, *workplanes: Face | Plane | Location, mode: Mode = ...) -> None: ...
    @property
    def part(self) -> Part | None:
        """Get the current part"""
    @part.setter
    def part(self, value: Part) -> None:
        """Set the current part"""
    @property
    def pending_edges_as_wire(self) -> Wire:
        """Return a wire representation of the pending edges"""
    @property
    def location(self) -> Location | None:
        """Builder's location"""
