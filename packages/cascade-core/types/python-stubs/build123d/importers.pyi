from _typeshed import Incomplete
from build123d.build_common import CM as CM, FT as FT, IN as IN, M as M, MC as MC, MM as MM
from build123d.build_enums import Align as Align, Unit as Unit
from build123d.geometry import Color as Color, Location as Location, TOLERANCE as TOLERANCE, TOL_DIGITS as TOL_DIGITS, Vector as Vector, to_align_offset as to_align_offset
from build123d.topology import Compound as Compound, Edge as Edge, Face as Face, Shape as Shape, ShapeList as ShapeList, Shell as Shell, Solid as Solid, Vertex as Vertex, Wire as Wire, downcast as downcast
from os import PathLike
from pathlib import Path
from typing import Literal, TextIO, overload

topods_lut: Incomplete

def import_brep(file_name: PathLike | str | bytes) -> Shape:
    """Import shape from a BREP file

    Args:
        file_name (Union[PathLike, str, bytes]): brep file

    Raises:
        ValueError: file not found

    Returns:
        Shape: build123d object
    """
def import_step(filename: PathLike | str | bytes) -> Compound:
    """import_step

    Extract shapes from a STEP file and return them as a Compound object.

    Args:
        file_name (Union[PathLike, str, bytes]): file path of STEP file to import

    Raises:
        ValueError: can't open file

    Returns:
        Compound: contents of STEP file
    """
def import_stl(file_name: PathLike | str | bytes, model_unit: Unit = ...) -> Face:
    """import_stl

    Extract shape from an STL file and return it as a Face reference object.

    Note that importing with this method and creating a reference is very fast while
    creating an editable model (with Mesher) may take minutes depending on the size
    of the STL file.

    Args:
        file_name (Union[PathLike, str, bytes]): file path of STL file to import
        model_unit (Unit, optional): the default unit used when creating the model. For
            example, Blender defaults to Unit.M. Defaults to Unit.MM.

    Raises:
        ValueError: Could not import file
        ValueError: Invalid model_unit

    Returns:
        Face: STL model
    """
def import_svg_as_buildline_code(file_name: PathLike | str | bytes, precision: int = ...) -> tuple[str, str]:
    """translate_to_buildline_code

    Translate the contents of the given svg file into executable build123d/BuildLine code.

    Args:
        file_name (PathLike | str | bytes]): svg file name
        precision (int): # digits to round values to. Defaults to # digits in TOLERANCE

    Returns:
        tuple[str, str]: code, builder instance name
    """
@overload
def import_svg(svg_file: str | Path | TextIO, *, flip_y: bool = True, align: Align | tuple[Align, Align] | None = ..., ignore_visibility: bool = False, label_by: Literal['id', 'class', 'inkscape:label'] | str = 'id') -> ShapeList[Wire | Face]: ...
@overload
def import_svg(svg_file: str | Path | TextIO, *, flip_y: bool = True, align: Align | tuple[Align, Align] | None = ..., ignore_visibility: bool = False, label_by: Literal['id', 'class', 'inkscape:label'] | str = 'id', is_inkscape_label: bool | None = None) -> ShapeList[Wire | Face]: ...
