from _typeshed import Incomplete
from build123d.build_common import LocationList as LocationList, validate_inputs as validate_inputs
from build123d.build_enums import Align as Align, Mode as Mode
from build123d.build_part import BuildPart as BuildPart
from build123d.geometry import Location as Location, Plane as Plane, Rotation as Rotation, RotationLike as RotationLike, Vector as Vector, VectorLike as VectorLike
from build123d.topology import Compound as Compound, Face as Face, Part as Part, ShapeList as ShapeList, Shell as Shell, Solid as Solid, Wire as Wire, tuplify as tuplify
from collections.abc import Iterable

class BasePartObject(Part):
    """BasePartObject

    Base class for all BuildPart objects & operations

    Args:
        solid (Solid): object to create
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    rotation: Incomplete
    mode: Incomplete
    def __init__(self, part: Part | Solid, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] | None = None, mode: Mode = ...) -> None: ...

class Box(BasePartObject):
    """Part Object: Box

    Create a box defined by length, width, and height.

    Args:
        length (float): box length
        width (float): box width
        height (float): box height
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to (Align.CENTER, Align.CENTER, Align.CENTER)
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    length: Incomplete
    width: Incomplete
    box_height: Incomplete
    def __init__(self, length: float, width: float, height: float, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] = ..., mode: Mode = ...) -> None: ...

class Cone(BasePartObject):
    """Part Object: Cone

    Create a cone defined by bottom radius, top radius, and height.

    Args:
        bottom_radius (float): bottom radius
        top_radius (float): top radius, may be zero
        height (float): cone height
        arc_size (float, optional): angular size of cone. Defaults to 360
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to (Align.CENTER, Align.CENTER, Align.CENTER)
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    bottom_radius: Incomplete
    top_radius: Incomplete
    cone_height: Incomplete
    arc_size: Incomplete
    align: Incomplete
    def __init__(self, bottom_radius: float, top_radius: float, height: float, arc_size: float = 360, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] = ..., mode: Mode = ...) -> None: ...

class ConvexPolyhedron(BasePartObject):
    """Part Object: ConvexPolyhedron

    Create a convex solid from the convex hull of the provided points.

    Args:
        points (Iterable[VectorLike]): vertices of the polyhedron
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to Align.NONE
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    def __init__(self, points: Iterable[VectorLike], rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class CounterBoreHole(BasePartObject):
    """Part Operation: Counter Bore Hole

    Create a counter bore hole defined by radius, counter bore radius, counter bore and depth.

    Args:
        radius (float): hole radius
        counter_bore_radius (float): counter bore radius
        counter_bore_depth (float): counter bore depth
        depth (float, optional): hole depth, through part if None. Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.SUBTRACT
    """
    radius: Incomplete
    counter_bore_radius: Incomplete
    counter_bore_depth: Incomplete
    hole_depth: Incomplete
    mode: Incomplete
    def __init__(self, radius: float, counter_bore_radius: float, counter_bore_depth: float, depth: float | None = None, mode: Mode = ...) -> None: ...

class CounterSinkHole(BasePartObject):
    """Part Operation: Counter Sink Hole

    Create a countersink hole defined by radius, countersink radius, countersink
    angle, and depth.

    Args:
        radius (float): hole radius
        counter_sink_radius (float): countersink radius
        depth (float, optional): hole depth, through part if None. Defaults to None
        counter_sink_angle (float, optional): cone angle. Defaults to 82
        mode (Mode, optional): combination mode. Defaults to Mode.SUBTRACT
    """
    radius: Incomplete
    counter_sink_radius: Incomplete
    hole_depth: Incomplete
    counter_sink_angle: Incomplete
    mode: Incomplete
    def __init__(self, radius: float, counter_sink_radius: float, depth: float | None = None, counter_sink_angle: float = 82, mode: Mode = ...) -> None: ...

class Cylinder(BasePartObject):
    """Part Object: Cylinder

    Create a cylinder defined by radius and height.

    Args:
        radius (float): cylinder radius
        height (float): cylinder height
        arc_size (float, optional): angular size of cone. Defaults to 360.
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to (Align.CENTER, Align.CENTER, Align.CENTER)
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    radius: Incomplete
    cylinder_height: Incomplete
    arc_size: Incomplete
    align: Incomplete
    def __init__(self, radius: float, height: float, arc_size: float = 360, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] = ..., mode: Mode = ...) -> None: ...

class Hole(BasePartObject):
    """Part Operation: Hole

    Create a hole defined by radius and depth.

    Args:
        radius (float): hole radius
        depth (float, optional): hole depth, through part if None. Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.SUBTRACT
    """
    radius: Incomplete
    hole_depth: Incomplete
    mode: Incomplete
    def __init__(self, radius: float, depth: float | None = None, mode: Mode = ...) -> None: ...

class Sphere(BasePartObject):
    """Part Object: Sphere

    Create a sphere defined by a radius.

    Args:
        radius (float): sphere radius
        arc_size1 (float, optional): angular size of bottom hemisphere. Defaults to -90.
        arc_size2 (float, optional): angular size of top hemisphere. Defaults to 90.
        arc_size3 (float, optional): angular revolution about pole. Defaults to 360.
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to (Align.CENTER, Align.CENTER, Align.CENTER)
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    radius: Incomplete
    arc_size1: Incomplete
    arc_size2: Incomplete
    arc_size3: Incomplete
    align: Incomplete
    def __init__(self, radius: float, arc_size1: float = -90, arc_size2: float = 90, arc_size3: float = 360, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] = ..., mode: Mode = ...) -> None: ...

class Torus(BasePartObject):
    """Part Object: Torus

    Create a torus defined by major and minor radii.

    Args:
        major_radius (float): major torus radius
        minor_radius (float): minor torus radius
        minor_start_angle (float, optional): angle to start minor arc. Defaults to 0
        minor_end_angle (float, optional): angle to end minor arc. Defaults to 360
        major_angle (float, optional): angle to revolve minor arc. Defaults to 360
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to (Align.CENTER, Align.CENTER, Align.CENTER)
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    major_radius: Incomplete
    minor_radius: Incomplete
    minor_start_angle: Incomplete
    minor_end_angle: Incomplete
    major_angle: Incomplete
    align: Incomplete
    def __init__(self, major_radius: float, minor_radius: float, minor_start_angle: float = 0, minor_end_angle: float = 360, major_angle: float = 360, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] = ..., mode: Mode = ...) -> None: ...

class Wedge(BasePartObject):
    """Part Object: Wedge

    Create a wedge with a near face defined by xsize and z size, a far face defined by
    xmin to xmax and zmin to zmax, and a depth of ysize.

    Args:
        xsize (float): length of near face along x-axis
        ysize (float): length of part along y-axis
        zsize (float): length of near face z-axis
        xmin (float): minimum position far face along x-axis
        zmin (float): minimum position far face along z-axis
        xmax (float): maximum position far face along x-axis
        zmax (float): maximum position far face along z-axis
        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0)
        align (Align | tuple[Align, Align, Align] | None, optional): align MIN, CENTER,
            or MAX of object. Defaults to (Align.CENTER, Align.CENTER, Align.CENTER)
        mode (Mode, optional): combine mode. Defaults to Mode.ADD
    """
    xsize: Incomplete
    ysize: Incomplete
    zsize: Incomplete
    xmin: Incomplete
    zmin: Incomplete
    xmax: Incomplete
    zmax: Incomplete
    align: Incomplete
    def __init__(self, xsize: float, ysize: float, zsize: float, xmin: float, zmin: float, xmax: float, zmax: float, rotation: RotationLike = (0, 0, 0), align: Align | tuple[Align, Align, Align] = ..., mode: Mode = ...) -> None: ...
