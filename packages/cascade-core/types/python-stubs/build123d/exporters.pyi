import xml.etree.ElementTree as ET
from OCP.Geom import Geom_BezierCurve as Geom_BezierCurve
from _typeshed import Incomplete
from build123d.build_common import UNITS_PER_METER as UNITS_PER_METER
from build123d.build_enums import GeomType as GeomType, Unit as Unit
from build123d.geometry import Color as Color, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike
from build123d.topology import BoundBox as BoundBox, Compound as Compound, Edge as Edge, Shape as Shape, Wire as Wire
from collections.abc import Iterable
from enum import Enum
from ezdxf.colors import RGB
from io import BytesIO
from os import PathLike
from typing import TypeAlias
from typing_extensions import Self

PathSegment: TypeAlias

class Drawing:
    """A base drawing object"""
    visible_lines: Incomplete
    hidden_lines: Incomplete
    def __init__(self, shape: Shape, *, look_at: VectorLike | None = None, look_from: VectorLike = (1, -1, 1), look_up: VectorLike = (0, 0, 1), with_hidden: bool = True, focus: float | None = None) -> None: ...

class AutoNameEnum(Enum):
    """An enum class that automatically sets members' value to their name."""

class LineType(AutoNameEnum):
    """Line Types"""
    CONTINUOUS = ...
    BORDER = ...
    BORDER2 = ...
    BORDERX2 = ...
    CENTER = ...
    CENTER2 = ...
    CENTERX2 = ...
    DASHDOT = ...
    DASHDOT2 = ...
    DASHDOTX2 = ...
    DASHED = ...
    DASHED2 = ...
    DASHEDX2 = ...
    DIVIDE = ...
    DIVIDE2 = ...
    DIVIDEX2 = ...
    DOT = ...
    DOT2 = ...
    DOTX2 = ...
    HIDDEN = ...
    HIDDEN2 = ...
    HIDDENX2 = ...
    PHANTOM = ...
    PHANTOM2 = ...
    PHANTOMX2 = ...
    ISO_DASH = 'ACAD_ISO02W100'
    ISO_DASH_SPACE = 'ACAD_ISO03W100'
    ISO_LONG_DASH_DOT = 'ACAD_ISO04W100'
    ISO_LONG_DASH_DOUBLE_DOT = 'ACAD_ISO05W100'
    ISO_LONG_DASH_TRIPLE_DOT = 'ACAD_ISO06W100'
    ISO_DOT = 'ACAD_ISO07W100'
    ISO_LONG_DASH_SHORT_DASH = 'ACAD_ISO08W100'
    ISO_LONG_DASH_DOUBLE_SHORT_DASH = 'ACAD_ISO09W100'
    ISO_DASH_DOT = 'ACAD_ISO10W100'
    ISO_DOUBLE_DASH_DOT = 'ACAD_ISO11W100'
    ISO_DASH_DOUBLE_DOT = 'ACAD_ISO12W100'
    ISO_DOUBLE_DASH_DOUBLE_DOT = 'ACAD_ISO13W100'
    ISO_DASH_TRIPLE_DOT = 'ACAD_ISO14W100'
    ISO_DOUBLE_DASH_TRIPLE_DOT = 'ACAD_ISO15W100'

class ColorIndex(Enum):
    """Colors"""
    RED = 1
    YELLOW = 2
    GREEN = 3
    CYAN = 4
    BLUE = 5
    MAGENTA = 6
    BLACK = 7
    GRAY = 8
    LIGHT_GRAY = 9

class DotLength(Enum):
    """Line type dash pattern dot widths, expressed in tenths of an inch."""
    TRUE_DOT = 0.0
    INKSCAPE_COMPAT = 0.01
    QCAD_IMPERIAL = 0.2

def ansi_pattern(*args):
    """Prepare an ANSI line pattern for ezdxf usage.
    Input pattern is specified in inches.
    Output is given in tenths of an inch, and the total pattern length
    is prepended to the list."""
def iso_pattern(*args):
    """Prepare an ISO line pattern for ezdxf usage.
    Input pattern is specified in millimeters.
    Output is given in tenths of an inch, and the total pattern length
    is prepended to the list."""
def unit_conversion_scale(from_unit: Unit, to_unit: Unit) -> float:
    """Return the multiplicative conversion factor to go from from_unit to to_unit."""

class Export2D:
    """Base class for 2D exporters (DXF, SVG)."""
    PARAMETRIC_TOLERANCE: float
    DEFAULT_COLOR_INDEX: Incomplete
    DEFAULT_LINE_WEIGHT: float
    DEFAULT_LINE_TYPE: Incomplete
    LINETYPE_DEFS: Incomplete
    LTYPE_SCALE: Incomplete

class ExportDXF(Export2D):
    '''
    The ExportDXF class provides functionality for exporting 2D shapes to DXF
    (Drawing Exchange Format) format. DXF is a widely used file format for
    exchanging CAD (Computer-Aided Design) data between different software
    applications.


    Args:
        version (str, optional): The DXF version to use for the output file.
            Defaults to ezdxf.DXF2013.
        unit (Unit, optional): The unit used for the exported DXF. It should be
            one of the Unit enums: Unit.MC, Unit.MM, Unit.CM,
            Unit.M, Unit.IN, or Unit.FT. Defaults to Unit.MM.
        color (Optional[ColorIndex], optional): The default color index for shapes.
            It can be specified as a ColorIndex enum or None.. Defaults to None.
        line_weight (Optional[float], optional): The default line weight
            (stroke width) for shapes, in millimeters. . Defaults to None.
        line_type (Optional[LineType], optional): e default line type for shapes.
            It should be a LineType enum or None.. Defaults to None.


    Example:

        .. code-block:: python

            exporter = ExportDXF(unit=Unit.MM, line_weight=0.5)
            exporter.add_layer("Layer 1", color=ColorIndex.RED, line_type=LineType.DASHED)
            exporter.add_shape(shape_object, layer="Layer 1")
            exporter.write("output.dxf")

    Raises:
        ValueError: unit not supported

    '''
    METRIC_UNITS: Incomplete
    def __init__(self, version: str = ..., unit: Unit = ..., color: ColorIndex | None = None, line_weight: float | None = None, line_type: LineType | None = None) -> None: ...
    def add_layer(self, name: str, *, color: ColorIndex | None = None, line_weight: float | None = None, line_type: LineType | None = None) -> Self:
        """add_layer

        Adds a new layer to the DXF export with the given properties.

        Args:
            name (str): The name of the layer definition. Must be unique among all layers.
            color (Optional[ColorIndex], optional): The color index for shapes on this layer.
                It can be specified as a ColorIndex enum or None. Defaults to None.
            line_weight (Optional[float], optional): The line weight (stroke width) for shapes
                on this layer, in millimeters. Defaults to None.
            line_type (Optional[LineType], optional): The line type for shapes on this layer.
                It should be a LineType enum or None. Defaults to None.

        Returns:
            Self: DXF document with additional layer
        """
    def add_shape(self, shape: Shape | Iterable[Shape], layer: str = '') -> Self:
        '''add_shape

        Adds a shape to the specified layer.

        Args:
            shape (Shape | Iterable[Shape]): The shape or collection of shapes to be
                  added. It can be a single Shape object or an iterable of Shape objects.
            layer (str, optional): The name of the layer where the shape will be
                added. If not specified, the default layer will be used. Defaults to "".

        Returns:
            Self: Document with additional shape
        '''
    def write(self, file_name: PathLike | str | bytes | BytesIO, ascii_format: bool = True):
        """write

        Writes the DXF data to the specified file name.

        Args:
            file_name (PathLike |  str |  bytes | BytesIO): The file name (including path) where
                the DXF data will be written.
            ascii_format (bool, optional): Export the file as ASCII (True) or binary
                (False) DXF format. Defaults to True.
        """

class ExportSVG(Export2D):
    '''ExportSVG

    SVG file export functionality.

    The ExportSVG class provides functionality for exporting 2D shapes to SVG
    (Scalable Vector Graphics) format. SVG is a widely used vector graphics format
    that is supported by web browsers and various graphic editors.

    Args:
        unit (Unit, optional): The unit used for the exported SVG. It should be one of
            the Unit enums: Unit.MM, Unit.CM, or Unit.IN. Defaults to
            Unit.MM.
        scale (float, optional): The scaling factor applied to the exported SVG.
            Defaults to 1.
        margin (float, optional): The margin added around the exported shapes.
            Defaults to 0.
        fit_to_stroke (bool, optional): A boolean indicating whether the SVG view box
            should fit the strokes of the shapes. Defaults to True.
        precision (int, optional): The number of decimal places used for rounding
            coordinates in the SVG. Defaults to 6.
        fill_color (ColorIndex |  RGB |  None, optional): The default fill color
            for shapes. It can be specified as a ColorIndex, an RGB tuple, or None.
            Defaults to None.
        line_color (ColorIndex |  RGB |  None, optional): The default line color for
            shapes. It can be specified as a ColorIndex or an RGB tuple, or None.
            Defaults to Export2D.DEFAULT_COLOR_INDEX.
        line_weight (float, optional): The default line weight (stroke width) for
            shapes, in millimeters. Defaults to Export2D.DEFAULT_LINE_WEIGHT.
        line_type (LineType, optional): The default line type for shapes. It should be
            a LineType enum. Defaults to Export2D.DEFAULT_LINE_TYPE.
        dot_length (DotLength |  float, optional): The width of rendered dots in a
            Can be either a DotLength enum or a float value in tenths of an inch.
            Defaults to DotLength.INKSCAPE_COMPAT.


    Example:

        .. code-block:: python

            exporter = ExportSVG(unit=Unit.MM, line_weight=0.5)
            exporter.add_layer("Layer 1", fill_color=(255, 0, 0), line_color=(0, 0, 255))
            exporter.add_shape(shape_object, layer="Layer 1")
            exporter.write("output.svg")

    Raises:
        ValueError: Invalid unit.

    '''
    class _Layer:
        name: Incomplete
        fill_color: Incomplete
        line_color: Incomplete
        line_weight: Incomplete
        line_type: Incomplete
        elements: list[ET.Element]
        def __init__(self, name: str, fill_color: ColorIndex | RGB | Color | None, line_color: ColorIndex | RGB | Color | None, line_weight: float, line_type: LineType) -> None: ...
    unit: Incomplete
    scale: Incomplete
    margin: Incomplete
    fit_to_stroke: Incomplete
    precision: Incomplete
    dot_length: Incomplete
    def __init__(self, unit: Unit = ..., scale: float = 1, margin: float = 0, fit_to_stroke: bool = True, precision: int = 6, fill_color: ColorIndex | RGB | Color | None = None, line_color: ColorIndex | RGB | Color | None = ..., line_weight: float = ..., line_type: LineType = ..., dot_length: DotLength | float = ...) -> None: ...
    def add_layer(self, name: str, *, fill_color: ColorIndex | RGB | Color | None = None, line_color: ColorIndex | RGB | Color | None = ..., line_weight: float = ..., line_type: LineType = ...) -> Self:
        """add_layer

        Adds a new layer to the SVG export with the given properties.

        Args:
            name (str): The name of the layer. Must be unique among all layers.
            fill_color (ColorIndex |  RGB |  Color |  None, optional): The fill color for shapes
                on this layer. It can be specified as a ColorIndex, an RGB tuple,
                a Color, or None.  Defaults to None.
            line_color (ColorIndex |  RGB |  Color |  None, optional): The line color for shapes on
                this layer. It can be specified as a ColorIndex or an RGB tuple,
                a Color, or None.  Defaults to Export2D.DEFAULT_COLOR_INDEX.
            line_weight (float, optional): The line weight (stroke width) for shapes on
                this layer, in millimeters. Defaults to Export2D.DEFAULT_LINE_WEIGHT.
            line_type (LineType, optional): The line type for shapes on this layer.
                It should be a LineType enum. Defaults to Export2D.DEFAULT_LINE_TYPE.

        Raises:
            ValueError: Duplicate layer name
            ValueError: Unknown linetype

        Returns:
            Self: Drawing with an additional layer
        """
    def add_shape(self, shape: Shape | Iterable[Shape], layer: str = '', reverse_wires: bool = False):
        '''add_shape

        Adds a shape or a collection of shapes to the specified layer.

        Args:
            shape (Shape | Iterable[Shape]): The shape or collection of shapes to be
                  added. It can be a single Shape object or an iterable of Shape objects.
            layer (str, optional): The name of the layer where the shape(s) will be added.
                Defaults to "".
            reverse_wires (bool, optional): A boolean indicating whether the wires of the
                shape(s) should be in reversed direction. Defaults to False.

        Raises:
            ValueError: Undefined layer
        '''
    def write(self, path: PathLike | str | bytes | BytesIO):
        """write

        Writes the SVG data to the specified file path.

        Args:
            path (PathLike | str | bytes | BytesIO): The file path where the
                SVG data will be written.
        """
