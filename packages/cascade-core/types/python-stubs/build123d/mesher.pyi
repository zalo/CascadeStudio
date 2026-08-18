from _typeshed import Incomplete
from build123d.build_enums import MeshType as MeshType, Unit as Unit
from build123d.geometry import Color as Color, TOLERANCE as TOLERANCE
from build123d.topology.composite import Compound as Compound
from build123d.topology.shape_core import Shape as Shape, downcast as downcast
from build123d.topology.three_d import Solid as Solid
from build123d.topology.two_d import Shell as Shell
from collections.abc import Iterable
from io import BytesIO
from lib3mf import Lib3MF
from os import PathLike
from typing import Literal
from uuid import UUID

class Mesher:
    """Mesher

    Tool for exporting and importing meshed objects stored in 3MF or STL files.

    NOTE (build123d-lite): STL only, written into the worker's in-memory
    filesystem (no 3MF — no lib3mf in this wasm build; no real disk) —
    COMPROMISE(mesher).

    Args:
        unit (Unit, optional): model units. Defaults to Unit.MM.
    """
    unit: Incomplete
    wrapper: Incomplete
    model: Incomplete
    meshes: list[Lib3MF.MeshObject]
    def __init__(self, unit: Unit = ...) -> None: ...
    @property
    def model_unit(self) -> Unit:
        """Unit used in the model"""
    @property
    def triangle_counts(self) -> list[int]:
        """Number of triangles in each of the model's meshes"""
    @property
    def vertex_counts(self) -> list[int]:
        """Number of vertices in each of the models's meshes"""
    @property
    def mesh_count(self) -> int:
        """Number of meshes in the model"""
    @property
    def library_version(self) -> str:
        """3MF Consortium Lib#MF version"""
    def add_meta_data(self, name_space: str, name: str, value: str, metadata_type: str, must_preserve: bool):
        """add_meta_data

        Add meta data to the models

        Args:
            name_space (str): categorizer of different metadata entries
            name (str): metadata label
            value (str): metadata content
            metadata_type (str): metadata type
            must_preserve (bool): metadata must not be removed if unused
        """
    def add_code_to_metadata(self) -> None:
        """Add the code calling this method to the 3MF metadata with the custom
        name space `build123d`, name equal to the base file name and the type
        as `python`"""
    def get_meta_data(self) -> list[dict]:
        """Retrieve all of the metadata"""
    def get_meta_data_by_key(self, name_space: str, name: str) -> dict:
        """Retrieve the metadata value and type for the provided name space and name"""
    def get_mesh_properties(self) -> list[dict]:
        """Retrieve the properties from all the meshes"""
    def add_shape(self, shape: Shape | Iterable[Shape], linear_deflection: float = 0.001, angular_deflection: float = 0.1, mesh_type: MeshType = ..., part_number: str | None = None, uuid_value: UUID | None = None):
        """add_shape

        Add a shape to the 3MF/STL file.

        Args:
            shape (Union[Shape, Iterable[Shape]]): build123d object
            linear_deflection (float, optional): mesh control for edges. Defaults to 0.001.
            angular_deflection (float, optional): mesh control for non-planar surfaces.
                Defaults to 0.1.
            mesh_type (MeshType, optional): 3D printing use of mesh. Defaults to MeshType.MODEL.
            part_number (str, optional): part #. Defaults to None.
            uuid_value (uuid, optional): value from uuid package. Defaults to None.

        Raises:
            RuntimeError: 3mf mesh is invalid
            Warning: Degenerate shape skipped
            Warning: 3mf mesh is not manifold
        """
    def read(self, file_name: PathLike | str | bytes) -> list[Shape]:
        """read

        Args:
            file_name Union[PathLike, str, bytes]: file path

        Raises:
            ValueError: Unknown file format - must be 3mf or stl

        Returns:
            list[Shape]: build123d shapes extracted from mesh file
        """
    def write(self, file_name: PathLike | str | bytes):
        """write

        Args:
            file_name Union[Pathlike, str, bytes]: file path

        Raises:
            ValueError: Unknown file format - must be 3mf or stl
        """
    def write_stream(self, stream: BytesIO, file_type: Literal['3mf', 'stl']):
        '''write_stream

        Args:
            stream (BytesIO): byte stream
            file_type: output mesh format, either "3mf" or "stl"

        Raises:
            ValueError: Unknown file format - must be 3mf or stl
        '''
