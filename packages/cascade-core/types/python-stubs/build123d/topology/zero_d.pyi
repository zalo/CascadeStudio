from .one_d import Edge as Edge, Wire as Wire
from .shape_core import Shape as Shape, ShapeList as ShapeList, TrimmingTool as TrimmingTool, downcast as downcast, shapetype as shapetype
from OCP.TopoDS import TopoDS_Edge, TopoDS_Shape as TopoDS_Shape, TopoDS_Vertex
from build123d.build_enums import Keep as Keep
from build123d.geometry import Axis as Axis, Location as Location, Matrix as Matrix, Plane as Plane, Vector as Vector, VectorLike as VectorLike
from collections.abc import Iterable
from typing import overload
from typing_extensions import Self

class Vertex(Shape[TopoDS_Vertex]):
    """A Vertex in build123d represents a zero-dimensional point in the topological
    data structure. It marks the endpoints of edges within a 3D model, defining precise
    locations in space. Vertices play a crucial role in defining the geometry of objects
    and the connectivity between edges, facilitating accurate representation and
    manipulation of 3D shapes. They hold coordinate information and are essential
    for constructing complex structures like wires, faces, and solids."""
    order: float
    @overload
    def __init__(self) -> None:
        """Default Vertext at the origin"""
    @overload
    def __init__(self, ocp_vx: TopoDS_Vertex) -> None:
        """Vertex from OCCT TopoDS_Vertex object"""
    @overload
    def __init__(self, X: float, Y: float, Z: float) -> None:
        """Vertex from three float values"""
    @overload
    def __init__(self, v: Iterable[float]) -> None:
        """Vertex from Vector or other iterators"""
    @property
    def volume(self) -> float:
        """volume - the volume of this Vertex, which is always zero"""
    @classmethod
    def cast(cls, obj: TopoDS_Shape) -> Self:
        """Returns the right type of wrapper, given a OCCT object"""
    @classmethod
    def extrude(cls, obj: Shape, direction: VectorLike) -> Vertex:
        """extrude - invalid operation for Vertex"""
    def __add__(self, other: Vertex | Vector | tuple[float, float, float]) -> Vertex:
        '''Add

        Add to a Vertex with a Vertex, Vector or Tuple

        Args:
            other: Value to add

        Raises:
            TypeError: other not in [Tuple,Vector,Vertex]

        Returns:
            Result

        Example:
            part.faces(">z").vertices("<y and <x").val() + (0, 0, 15)

            which creates a new Vertex 15 above one extracted from a part. One can add or
            subtract a `Vertex` , `Vector` or `tuple` of float values to a Vertex.
        '''
    def __and__(self, *args, **kwargs) -> None:
        """intersect operator +"""
    def __iter__(self):
        """Initialize to beginning"""
    def __sub__(self, other: Vertex | Vector | tuple) -> Vertex:
        '''Subtract

        Subtract a Vertex with a Vertex, Vector or Tuple from self

        Args:
            other: Value to add

        Raises:
            TypeError: other not in [Tuple,Vector,Vertex]

        Returns:
            Result

        Example:
            part.faces(">z").vertices("<y and <x").val() - Vector(10, 0, 0)
        '''
    def center(self) -> Vector:
        """The center of a vertex is itself!"""
    def split(self, tool: TrimmingTool, keep: Keep = ...):
        """split - not implemented"""
    def to_tuple(self) -> tuple[float, float, float]:
        """Return vertex as three tuple of floats"""
    def transform_shape(self, t_matrix: Matrix) -> Vertex:
        """Apply affine transform without changing type

        Transforms a copy of this Vertex by the provided 3D affine transformation matrix.
        Note that not all transformation are supported - primarily designed for translation
        and rotation.  See :transform_geometry: for more comprehensive transformations.

        Args:
            t_matrix (Matrix): affine transformation matrix

        Returns:
            Vertex: copy of transformed shape with all objects keeping their type
        """
    def vertex(self) -> Vertex:
        """Return the Vertex"""
    def vertices(self) -> ShapeList[Vertex]:
        """vertices - all the vertices in this Shape"""

def topo_explore_common_vertex(edge1: Edge | TopoDS_Edge, edge2: Edge | TopoDS_Edge) -> Vertex | None:
    """Given two edges, find the common vertex"""
