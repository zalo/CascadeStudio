from build123d.build_constants import UNITS_PER_METER as UNITS_PER_METER
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

    UV texture coordinates from the underlying surface parameterization are
    included in the glTF output as ``TEXCOORD_0`` accessors. These UVs support
    texture mapping, UV baking, and displacement-map workflows such as
    `BumpMesh <https://bumpmesh.com/>`_.

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

    NOTE (build123d-lite): written with STEPControl_Writer (no XCAF document,
    so no names/colors/assembly structure) into the worker's in-memory
    filesystem rather than to disk; unit= is honoured, write_pcurves /
    precision_mode / timestamp are accepted and ignored — COMPROMISE(mesher).

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

    Raises:
        FileNotFoundError: The destination directory does not exist.
    """
def export_obj(to_export: Shape, file_path: PathLike | str | bytes | BytesIO | BinaryIO, linear_deflection: float = 0.001, angular_deflection: float = 0.1, include_uvs: bool = True, atlas_packing: bool = True, atlas_gutter: float = 0.0) -> bool:
    """export_obj

    NOTE (build123d-lite): written into the worker's in-memory filesystem;
    the UV atlas packs the same per-face islands with a different packer —
    COMPROMISE(obj-atlas).

    Exports a shape to Wavefront OBJ format.  When *include_uvs* is True
    (default), per-vertex UV texture coordinates are extracted from
    OpenCASCADE's surface parameterization and written as ``vt`` records.
    These UVs enable texture mapping, UV baking, and displacement-map
    workflows such as `BumpMesh <https://bumpmesh.com/>`_ which can add
    displacement heightmap tessellations to 3D-printable meshes.

    When *atlas_packing* is True (default), all face UVs are packed into a
    single texture atlas preserving each face's physical aspect ratio.

    Args:
        to_export (Shape): object or assembly
        file_path (Union[PathLike, str, bytes, BytesIO, BinaryIO]): OBJ file
            path or writable binary stream (for pyodide/WASM environments).
        linear_deflection (float, optional): Tessellation linear deflection.
            Defaults to 1e-3.
        angular_deflection (float, optional): Tessellation angular deflection.
            Defaults to 0.1.
        include_uvs (bool, optional): Include UV texture coordinates.
            Defaults to True.
        atlas_packing (bool, optional): Pack per-face UVs into a single atlas.
            Only used when *include_uvs* is True. Defaults to True.
        atlas_gutter (float, optional): Normalized empty margin around each UV
            island in a packed atlas. Only used when *atlas_packing* is True.
            Defaults to 0.0.

    Returns:
        bool: success
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
