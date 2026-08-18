from build123d.build_common import UNITS_PER_METER as UNITS_PER_METER
from build123d.build_enums import PrecisionMode as PrecisionMode, Unit as Unit
from build123d.geometry import Location as Location
from build123d.topology import Compound as Compound, Curve as Curve, Part as Part, Shape as Shape, Sketch as Sketch
from datetime import datetime
from io import BytesIO
from os import PathLike
from typing import BinaryIO

def export_brep(to_export: Shape, file_path: PathLike | str | bytes | BytesIO | BinaryIO) -> bool:
    """Export this shape to a BREP file

    Args:
        to_export (Shape): object or assembly
        file_path: Union[PathLike, str, bytes, BytesIO]: brep file path or memory buffer

    Returns:
        bool: write status
    """
def export_gltf(to_export: Shape, file_path: PathLike | str | bytes, unit: Unit = ..., binary: bool = False, linear_deflection: float = 0.001, angular_deflection: float = 0.1) -> bool:
    """export_gltf

    WARNING (build123d-lite): a NO-OP in this environment — no glTF writer is
    available in this wasm build; the call succeeds but writes nothing. Use
    the app's Save STL/OBJ/STEP buttons or export_stl instead.

    The glTF (GL Transmission Format) specification primarily focuses on the efficient
    transmission and loading of 3D models as a compact, binary format that is directly
    renderable by graphics APIs like WebGL, OpenGL, and Vulkan. It's designed to store
    detailed 3D model data, including meshes (vertices, normals, textures, etc.),
    animations, materials, and scene hierarchy, among other aspects.

    Args:
        to_export (Shape): object or assembly
        file_path (Union[PathLike, str, bytes]): glTF file path
        unit (Unit, optional): shape units. Defaults to Unit.MM.
        binary (bool, optional): output format. Defaults to False.
        linear_deflection (float, optional): A linear deflection setting which limits
            the distance between a curve and its tessellation. Setting this value too
            low will result in large meshes that can consume computing resources. Setting
            the value too high can result in meshes with a level of detail that is too
            low. The default is a good starting point for a range of cases.
            Defaults to 1e-3.
        angular_deflection (float, optional): Angular deflection setting which limits
            the angle between subsequent segments in a polyline. Defaults to 0.1.

    Raises:
        RuntimeError: Failed to write glTF file

    Returns:
        bool: write status
    """
def export_step(to_export: Shape, file_path: PathLike | str | bytes | BytesIO | BinaryIO, unit: Unit = ..., write_pcurves: bool = True, precision_mode: PrecisionMode = ..., *, timestamp: str | datetime | None = None) -> bool:
    """export_step

    WARNING (build123d-lite): a NO-OP in this environment — XCAF STEP writing
    is unavailable in this wasm build; the call succeeds but writes nothing.
    Use the app's Save STEP button instead.

    Export a build123d Shape or assembly with color and label attributes.
    Note that if the color of a node in an assembly isn't set, it will be
    assigned the color of its nearest ancestor.

    Args:
        to_export (Shape): object or assembly
        file_path (Union[PathLike, str, bytes, BytesIO]): step file path
        unit (Unit, optional): shape units. Defaults to Unit.MM.
        write_pcurves (bool, optional): write parametric curves to the STEP file.
            Defaults to True.
        precision_mode (PrecisionMode, optional): geometric data precision.
            Defaults to PrecisionMode.AVERAGE.

    Raises:
        RuntimeError: Unknown Compound type

    Returns:
        bool: success
    """
def export_stl(to_export: Shape, file_path: PathLike | str | bytes, tolerance: float = 0.001, angular_tolerance: float = 0.1, ascii_format: bool = False) -> bool:
    """Export STL

    Exports a shape to a specified STL file.

    Args:
        to_export (Shape): object or assembly
        file_path (Union[PathLike, str, bytes]): The path and file name to write the STL output to.
        tolerance (float, optional): A linear deflection setting which limits the distance
            between a curve and its tessellation. Setting this value too low will result in
            large meshes that can consume computing resources. Setting the value too high can
            result in meshes with a level of detail that is too low. The default is a good
            starting point for a range of cases. Defaults to 1e-3.
        angular_tolerance (float, optional): Angular deflection setting which limits the angle
            between subsequent segments in a polyline. Defaults to 0.1.
        ascii_format (bool, optional): Export the file as ASCII (True) or binary (False)
            STL format. Defaults to False (binary).

    Returns:
        bool: Success
    """
def export_to_pcbway(to_export: Shape, unit: Unit = ..., write_pcurves: bool = True, precision_mode: PrecisionMode = ...) -> str:
    """Export a shape to PCBWay for quoting.

    This function writes ``to_export`` to a temporary STEP file, uploads that file
    to PCBWay's external web service, opens the returned pricing page in the
    default browser, and returns the pricing page URL.

    Args:
        to_export (Shape): object or assembly
        unit (Unit, optional): shape units. Defaults to Unit.MM.
        write_pcurves (bool, optional): write parametric curves to the STEP file.
            Defaults to True.
        precision_mode (PrecisionMode, optional): geometric data precision.
            Defaults to PrecisionMode.AVERAGE.

    Returns:
        str: URL of the pricing page
    """
