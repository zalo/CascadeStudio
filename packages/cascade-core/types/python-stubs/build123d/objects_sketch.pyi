from _typeshed import Incomplete
from build123d.build_common import LocationList as LocationList, flatten_sequence as flatten_sequence, validate_inputs as validate_inputs
from build123d.build_enums import Align as Align, FontStyle as FontStyle, Mode as Mode, TextAlign as TextAlign
from build123d.build_sketch import BuildSketch as BuildSketch
from build123d.geometry import Axis as Axis, Location as Location, Rotation as Rotation, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike, to_align_offset as to_align_offset
from build123d.topology import Compound as Compound, Edge as Edge, Face as Face, ShapeList as ShapeList, Sketch as Sketch, Vertex as Vertex, Wire as Wire, topo_explore_common_vertex as topo_explore_common_vertex, tuplify as tuplify
from collections.abc import Iterable
from os import PathLike

class BaseSketchObject(Sketch):
    """BaseSketchObject

    Base class for all BuildSketch objects

    Args:
        face (Face): face to create
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    rotation: Incomplete
    mode: Incomplete
    def __init__(self, obj: Compound | Face, rotation: float = 0, align: Align | tuple[Align, Align] | None = None, mode: Mode = ...) -> None: ...

class Circle(BaseSketchObject):
    """Sketch Object: Circle

    Create a circle defined by radius.

    Args:
        radius (float): circle radius
        arc_size (float, optional): angular size of sector. Defaults to 360.
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    radius: Incomplete
    arc_size: Incomplete
    align: Incomplete
    def __init__(self, radius: float, arc_size: float = 360.0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class Ellipse(BaseSketchObject):
    """Sketch Object: Ellipse

    Create an ellipse defined by x- and y- radii.

    Args:
        x_radius (float): x radius of the ellipse (along the x-axis of plane)
        y_radius (float): y radius of the ellipse (along the y-axis of plane)
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    x_radius: Incomplete
    y_radius: Incomplete
    align: Incomplete
    def __init__(self, x_radius: float, y_radius: float, rotation: float = 0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class Polygon(BaseSketchObject):
    """Sketch Object: Polygon

    Create a polygon defined by given sequence of points.

    Note: the order of the points defines the resulting normal of the Face in Algebra
    mode, where counter-clockwise order creates an upward normal while clockwise order
    a downward normal. In Builder mode, the Face is added with an upward normal.

    Args:
        pts (VectorLike | Iterable[VectorLike]): sequence of points defining the
            vertices of the polygon
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.NONE, Align.NONE)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    pts: Incomplete
    align: Incomplete
    def __init__(self, *pts: VectorLike | Iterable[VectorLike], rotation: float = 0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class Rectangle(BaseSketchObject):
    """Sketch Object: Rectangle

    Create a rectangle defined by width and height.

    Args:
        width (float): rectangle width
        height (float): rectangle height
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    width: Incomplete
    rectangle_height: Incomplete
    align: Incomplete
    def __init__(self, width: float, height: float, rotation: float = 0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class RectangleRounded(BaseSketchObject):
    """Sketch Object: Rectangle Rounded

    Create a rectangle defined by width and height with filleted corners.

    Args:
        width (float): rectangle width
        height (float): rectangle height
        radius (float): fillet radius
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    width: Incomplete
    rectangle_height: Incomplete
    radius: Incomplete
    align: Incomplete
    def __init__(self, width: float, height: float, radius: float, rotation: float = 0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class RegularPolygon(BaseSketchObject):
    """Sketch Object: Regular Polygon

    Create a regular polygon defined by radius and side count. Use major_radius to define whether
    the polygon circumscribes (along the vertices) or inscribes (along the sides) the radius circle.

    Args:
        radius (float): construction radius
        side_count (int): number of sides
        major_radius (bool): If True the radius is the major radius (circumscribed circle),
            else the radius is the minor radius (inscribed circle). Defaults to True
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    radius: float
    apothem: float
    side_count: Incomplete
    align: Incomplete
    def __init__(self, radius: float, side_count: int, major_radius: bool = True, rotation: float = 0, align: tuple[Align, Align] = ..., mode: Mode = ...) -> None: ...

class SlotArc(BaseSketchObject):
    """Sketch Object: Slot Arc

    Create a slot defined by a line and height. May be an arc, stright line, spline, etc.

    Args:
        arc (Edge | Wire): center line of slot
        height (float): diameter of end arcs
        rotation (float, optional): angle to rotate object. Defaults to 0
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    arc: Incomplete
    slot_height: Incomplete
    def __init__(self, arc: Edge | Wire, height: float, rotation: float = 0, mode: Mode = ...) -> None: ...

class SlotCenterPoint(BaseSketchObject):
    """Sketch Object: Slot Center Point

    Create a slot defined by the center of the slot and the center of one end arc.
    The slot will be symmetric about the center point.

    Args:
        center (VectorLike): center point
        point (VectorLike): center of arc point
        height (float): diameter of end arcs
        rotation (float, optional): angle to rotate object. Defaults to 0
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    slot_center: Incomplete
    point: Incomplete
    slot_height: Incomplete
    def __init__(self, center: VectorLike, point: VectorLike, height: float, rotation: float = 0, mode: Mode = ...) -> None: ...

class SlotCenterToCenter(BaseSketchObject):
    """Sketch Object: Slot Center To Center

    Create a slot defined by the distance between the centers of the two end arcs.

    Args:
        center_separation (float): distance between arc centers
        height (float): diameter of end arcs
        rotation (float, optional): angle to rotate object. Defaults to 0
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    center_separation: Incomplete
    slot_height: Incomplete
    def __init__(self, center_separation: float, height: float, rotation: float = 0, mode: Mode = ...) -> None: ...

class SlotOverall(BaseSketchObject):
    """Sketch Object: Slot Overall

    Create a slot defined by the overall width and height.

    Args:
        width (float): overall width of slot
        height (float): diameter of end arcs
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    """
    width: Incomplete
    slot_height: Incomplete
    def __init__(self, width: float, height: float, rotation: float = 0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class Text(BaseSketchObject):
    '''Sketch Object: Text

    Create text defined by text string and font size.

    Fonts installed to the system can be specified by name and FontStyle. Fonts with
    subfamilies not in FontStyle should be specified with the subfamily name, e.g.
    "Arial Black". Alternatively, a specific font file can be specified with font_path.

    Use `available_fonts()` to list available font names for `font` and FontStyles.
    Note: on Windows, fonts must be installed with "Install for all users" to be found
    by name.

    Not all fonts have every FontStyle available, however ITALIC and BOLDITALIC will
    still italicize the font if the respective font file is not available.

    text_align specifies alignment of text inside the bounding box, while align the
    aligns the bounding box itself.

    Optionally, the Text can be positioned on a non-linear edge or wire with a path and
    position_on_path.

    Args:
        txt (str): text to render
        font_size (float): size of the font in model units
        font (str, optional): font name. Defaults to "Arial"
        font_path (PathLike | str, optional): system path to font file. Defaults to None
        font_style (Font_Style, optional): font style, REGULAR, BOLD, BOLDITALIC, or
            ITALIC. Defaults to Font_Style.REGULAR
        text_align (tuple[TextAlign, TextAlign], optional): horizontal text align
            LEFT, CENTER, or RIGHT. Vertical text align BOTTOM, CENTER, TOP, or
            TOPFIRSTLINE. Defaults to (TextAlign.CENTER, TextAlign.CENTER)
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of
            object. Defaults to None
        path (Edge | Wire, optional): path for text to follow. Defaults to None
        position_on_path (float, optional): the relative location on path to position
            the text, values must be between 0.0 and 1.0. Defaults to 0.0
        single_line_width (float, optional): width of outlined single line font.
            Defaults to 4% of font_size
        rotation (float, optional): angle to rotate object. Defaults to 0
        mode (Mode, optional): combination mode. Defaults to Mode.ADD
    '''
    txt: Incomplete
    font_size: Incomplete
    font: Incomplete
    font_style: Incomplete
    text_align: Incomplete
    align: Incomplete
    text_path: Incomplete
    position_on_path: Incomplete
    single_line_width: Incomplete
    rotation: Incomplete
    mode: Incomplete
    def __init__(self, txt: str, font_size: float, font: str = 'Arial', font_style: FontStyle = ..., text_align: tuple[TextAlign, TextAlign] = ..., align: Align | tuple[Align, Align] | None = None, path: Edge | Wire | None = None, position_on_path: float = 0.0, single_line_width: float | None = None, rotation: float = 0.0, mode: Mode = ...) -> None:
        """NOTE (build123d-lite): font_path is not supported (only the bundled
        FreeSans family exists in this environment) and has been removed from
        the signature; non-Latin glyph metrics may differ from other Arial
        substitutes — COMPROMISE(text)."""

class Trapezoid(BaseSketchObject):
    """Sketch Object: Trapezoid

    Create a trapezoid defined by major width, height, and interior angle(s).

    Args:
        width (float): trapezoid major width
        height (float): trapezoid height
        left_side_angle (float): bottom left interior angle
        right_side_angle (float, optional): bottom right interior angle. If not provided,
            the trapezoid will be symmetric. Defaults to None
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to (Align.CENTER, Align.CENTER)
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: Give angles result in an invalid trapezoid
    """
    width: Incomplete
    trapezoid_height: Incomplete
    left_side_angle: Incomplete
    right_side_angle: Incomplete
    align: Incomplete
    def __init__(self, width: float, height: float, left_side_angle: float, right_side_angle: float | None = None, rotation: float = 0, align: Align | tuple[Align, Align] | None = ..., mode: Mode = ...) -> None: ...

class Triangle(BaseSketchObject):
    """Sketch Object: Triangle

    Create a triangle defined by one side length and any of two other side lengths or interior
    angles. The interior angles are opposite the side with the same designation
    (i.e. side 'a' is opposite angle 'A'). Side 'a' is the bottom side, followed by 'b'
    on the right, going counter-clockwise.

    Args:
        a (float, optional): side 'a' length. Defaults to None
        b (float, optional): side 'b' length. Defaults to None
        c (float, optional): side 'c' length. Defaults to None
        A (float, optional): interior angle 'A'. Defaults to None
        B (float, optional): interior angle 'B'. Defaults to None
        C (float, optional): interior angle 'C'. Defaults to None
        rotation (float, optional): angle to rotate object. Defaults to 0
        align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of object.
            Defaults to None
        mode (Mode, optional): combination mode. Defaults to Mode.ADD

    Raises:
        ValueError: One length and two other values were not provided
    """
    a: Incomplete
    b: Incomplete
    c: Incomplete
    A: Incomplete
    B: Incomplete
    C: Incomplete
    edge_a: Incomplete
    edge_b: Incomplete
    edge_c: Incomplete
    vertex_A: Incomplete
    vertex_B: Incomplete
    vertex_C: Incomplete
    def __init__(self, *, a: float | None = None, b: float | None = None, c: float | None = None, A: float | None = None, B: float | None = None, C: float | None = None, align: Align | tuple[Align, Align] | None = None, rotation: float = 0, mode: Mode = ...) -> None: ...
