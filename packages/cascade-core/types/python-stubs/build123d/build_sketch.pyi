from _typeshed import Incomplete
from build123d.build_common import Builder as Builder, WorkplaneList as WorkplaneList
from build123d.build_enums import Mode as Mode
from build123d.geometry import Location as Location, Plane as Plane
from build123d.topology import Compound as Compound, Edge as Edge, Face as Face, ShapeList as ShapeList, Sketch as Sketch, Wire as Wire

class BuildSketch(Builder[Sketch]):
    """BuildSketch

    The BuildSketch class is a subclass of Builder for building planar 2D
    sketches (objects with area but not volume) from faces or lines.
    It has an _obj property that returns the current sketch being built.
    The sketch property consists of the sketch(es) applied to the input
    workplanes while the sketch_local attribute is the sketch constructed
    on Plane.XY. The class overrides the solids method of Builder since
    they don't apply to lines.

    Note that all sketch construction is done within sketch_local on Plane.XY.
    When objects are added to the sketch they must be coplanar to Plane.XY,
    usually handled automatically but may need user input for Edges and Wires
    since their construction plane isn't always able to be determined.

    Args:
        workplanes (Union[Face, Plane, Location], optional): objects converted to
            plane(s) to place the sketch on. Defaults to Plane.XY.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
    mode: Incomplete
    pending_edges: ShapeList[Edge]
    def __init__(self, *workplanes: Face | Plane | Location, mode: Mode = ...) -> None: ...
    @property
    def sketch_local(self) -> Sketch | None:
        """Get the builder's object"""
    @sketch_local.setter
    def sketch_local(self, value: Sketch) -> None:
        """Set the builder's object"""
    @property
    def sketch(self):
        """The global version of the sketch - may contain multiple sketches"""
    def solids(self, *args) -> None:
        """solids() not implemented"""
    def solid(self, *args) -> None:
        """solid() not implemented"""
    def consolidate_edges(self) -> Wire | list[Wire]:
        """Unify pending edges into one or more Wires"""
