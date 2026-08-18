from _typeshed import Incomplete
from build123d.build_common import IN as IN, MM as MM
from build123d.build_enums import Align as Align, FontStyle as FontStyle, GeomType as GeomType, HeadType as HeadType, Mode as Mode, NumberDisplay as NumberDisplay, PageSize as PageSize, Side as Side, Unit as Unit
from build123d.build_line import BuildLine as BuildLine
from build123d.build_sketch import BuildSketch as BuildSketch
from build123d.geometry import Axis as Axis, Location as Location, Plane as Plane, Pos as Pos, Vector as Vector, VectorLike as VectorLike
from build123d.objects_curve import Line as Line, TangentArc as TangentArc
from build123d.objects_sketch import BaseSketchObject as BaseSketchObject, Polygon as Polygon, Text as Text
from build123d.operations_generic import fillet as fillet, mirror as mirror, sweep as sweep
from build123d.operations_sketch import make_face as make_face, trace as trace
from build123d.topology import Compound as Compound, Curve as Curve, Edge as Edge, ShapeList as ShapeList, Sketch as Sketch, Vertex as Vertex, Wire as Wire
from dataclasses import dataclass
from datetime import date
from typing import ClassVar, TypeAlias

class ArrowHead(BaseSketchObject):
    """Sketch Object: ArrowHead

    Args:
        size (float): tip to tail length
        head_type (HeadType, optional): arrow head shape. Defaults to HeadType.CURVED.
        rotation (float, optional): rotation in degrees. Defaults to 0.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
    def __init__(self, size: float, head_type: HeadType = ..., rotation: float = 0, mode: Mode = ...) -> None: ...

class Arrow(BaseSketchObject):
    """Sketch Object: Arrow with shaft

    Args:
        arrow_size (float): arrow head tip to tail length
        shaft_path (Edge |  Wire): line describing the shaft shape
        shaft_width (float): line width of shaft
        head_at_start (bool, optional): Defaults to True.
        head_type (HeadType, optional): arrow head shape. Defaults to HeadType.CURVED.
        mode (Mode, optional): _description_. Defaults to Mode.ADD.
    """
    def __init__(self, arrow_size: float, shaft_path: Edge | Wire, shaft_width: float, head_at_start: bool = True, head_type: HeadType = ..., mode: Mode = ...) -> None: ...
PointLike: TypeAlias = Vector | Vertex | tuple[float, float, float]
PathDescriptor: TypeAlias = Wire | Edge | list[PointLike]

@dataclass
class Draft:
    '''Draft

    Documenting build123d designs with dimension and extension lines as well as callouts.


    Args:
        font_size (float): size of the text in dimension lines and callouts. Defaults to 5.0.
        font (str): font to use for text. Defaults to "Arial".
        font_style: text style. Defaults to FontStyle.REGULAR.
        head_type (HeadType, optional): arrow head shape. Defaults to HeadType.CURVED.
        arrow_length (float): arrow head length. Defaults to 3.0.
        line_width (float): thickness of all lines. Defaults to 0.5.
        pad_around_text (float): amount of padding around text. Defaults to 2.0.
        unit (Unit): measurement unit. Defaults to Unit.MM.
        number_display (NumberDisplay): numbers as decimal or fractions.
            Default to NumberDisplay.DECIMAL.
        display_units (bool): control the display of units with numbers. Defaults to True.
        decimal_precision (int): number of decimal places when displaying numbers. Defaults to 2.
        fractional_precision (int): maximum fraction denominator - must be a factor of 2.
            Defaults to 64.
        extension_gap (float): gap between the point and start of extension line in extension_line.
            Defaults to 2.0.

    '''
    unit_LUT: ClassVar[dict] = ...
    font_size: float = ...
    font: str = ...
    font_style: FontStyle = ...
    head_type: HeadType = ...
    arrow_length: float = ...
    line_width: float = ...
    pad_around_text: float = ...
    unit: Unit = ...
    number_display: NumberDisplay = ...
    display_units: bool = ...
    decimal_precision: int = ...
    fractional_precision: int = ...
    extension_gap: float = ...
    @property
    def is_metric(self) -> bool:
        """Are metric units being used"""
    def __post_init__(self) -> None:
        """Validate inputs"""

class DimensionLine(BaseSketchObject):
    """Sketch Object: DimensionLine

    Create a dimension line typically for internal measurements.
    Typically used for (but not restricted to) inside dimensions, a dimension line often
    as arrows on either side of a dimension or label.

    There are three options depending on the size of the text and length
    of the dimension line:
    Type 1) The label and arrows fit within the length of the path
    Type 2) The text fit within the path and the arrows go outside
    Type 3) Neither the text nor the arrows fit within the path

    Args:
        path (PathDescriptor): a very general type of input used to describe the path the
            dimension line will follow.
        draft (Draft): instance of Draft dataclass
        sketch (Sketch): the Sketch being created to check for possible overlaps. In builder
            mode the active Sketch will be used if None is provided.
        label (str, optional): a text string which will replace the length (or
            arc length) that would otherwise be extracted from the provided path. Providing
            a label is useful when illustrating a parameterized input where the name of an
            argument is desired not an actual measurement. Defaults to None.
        arrows (tuple[bool, bool], optional): a pair of boolean values controlling the placement
            of the start and end arrows. Defaults to (True, True).
        tolerance (float | tuple[float, float], optional): an optional tolerance
            value to add to the extracted length value. If a single tolerance value is provided
            it is shown as ± the provided value while a pair of values are shown as
            separate + and - values. Defaults to None.
        label_angle (bool, optional): a flag indicating that instead of an extracted length value,
            the size of the circular arc extracted from the path should be displayed in degrees.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: Only 2 points allowed for dimension lines
        ValueError: No output - no arrows selected

    """
    dimension: Incomplete
    def __init__(self, path: PathDescriptor, draft: Draft, sketch: Sketch | None = None, label: str | None = None, arrows: tuple[bool, bool] = (True, True), tolerance: float | tuple[float, float] | None = None, label_angle: bool = False, mode: Mode = ...) -> None: ...

class ExtensionLine(BaseSketchObject):
    """Sketch Object: Extension Line

    Create a dimension line with two lines extending outward from the part to dimension.
    Typically used for (but not restricted to) outside dimensions, with a pair of lines
    extending from the edge of a part to a dimension line.

    Args:
        border (PathDescriptor): a very general type of input defining the object to
            be dimensioned. Typically this value would be extracted from the part but is
            not restricted to this use.
        offset (float): a distance to displace the dimension line from the edge of the object
        draft (Draft): instance of Draft dataclass
        label (str, optional): a text string which will replace the length (or arc length)
            that would otherwise be extracted from the provided path. Providing a label is
            useful when illustrating a parameterized input where the name of an argument
            is desired not an actual measurement. Defaults to None.
        arrows (tuple[bool, bool], optional): a pair of boolean values controlling the placement
            of the start and end arrows. Defaults to (True, True).
        tolerance (float | tuple[float, float], optional): an optional tolerance
            value to add to the extracted length value. If a single tolerance value is provided
            it is shown as ± the provided value while a pair of values are shown as
            separate + and - values. Defaults to None.
        label_angle (bool, optional): a flag indicating that instead of an extracted length
            value, the size of the circular arc extracted from the path should be displayed
            in degrees. Defaults to False.
        measurement_direction (VectorLike, optional): Vector line which to project the dimension
            against. Offset start point is the position of the start of border.
            Defaults to None.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    """
    dimension: Incomplete
    def __init__(self, border: PathDescriptor, offset: float, draft: Draft, sketch: Sketch | None = None, label: str | None = None, arrows: tuple[bool, bool] = (True, True), tolerance: float | tuple[float, float] | None = None, label_angle: bool = False, measurement_direction: VectorLike | None = None, mode: Mode = ...) -> None: ...

class TechnicalDrawing(BaseSketchObject):
    '''Sketch Object: TechnicalDrawing

    The border of a technical drawing with external frame and text box.

    Args:
        designed_by (str, optional): Defaults to "build123d".
        design_date (date, optional): Defaults to date.today().
        page_size (PageSize, optional): Defaults to PageSize.A4.
        title (str, optional): drawing title. Defaults to "Title".
        sub_title (str, optional): drawing sub title. Defaults to "Sub Title".
        drawing_number (str, optional): Defaults to "B3D-1".
        sheet_number (int, optional): Defaults to None.
        drawing_scale (float, optional): displays as 1:value. Defaults to 1.0.
        nominal_text_size (float, optional): size of title text. Defaults to 10.0.
        line_width (float, optional): Defaults to 0.5.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    '''
    page_sizes: Incomplete
    margin: Incomplete
    def __init__(self, designed_by: str = 'build123d', design_date: date | None = None, page_size: PageSize = ..., title: str = 'Title', sub_title: str = 'Sub Title', drawing_number: str = 'B3D-1', sheet_number: int | None = None, drawing_scale: float = 1.0, nominal_text_size: float = 10.0, line_width: float = 0.5, mode: Mode = ...) -> None: ...
