from .kernel import list_shapes as list_shapes
from .one_d import Edge as Edge, Wire as Wire
from .shape_core import Shape as Shape, ShapeList as ShapeList, TrimmingTool as TrimmingTool, downcast as downcast, find_same_topods as find_same_topods
from OCP.TopoDS import TopoDS_Edge, TopoDS_Face as TopoDS_Face, TopoDS_Vertex
from build123d.build_enums import Convexity as Convexity, Keep as Keep, Select as Select, Unit as Unit
from build123d.geometry import Axis as Axis, Location as Location, Matrix as Matrix, Plane as Plane, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike
from collections.abc import Iterable
from typing import ClassVar, overload

class Vertex(Shape[TopoDS_Vertex]):
    """A Vertex in build123d represents a zero-dimensional point in the topological
    data structure. It marks the endpoints of edges within a 3D model, defining precise
    locations in space. Vertices play a crucial role in defining the geometry of objects
    and the connectivity between edges, facilitating accurate representation and
    manipulation of 3D shapes. They hold coordinate information and are essential
    for constructing complex structures like wires, faces, and solids."""
    build123d_type: ClassVar[str]
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
    def mass(self, mass_unit: Unit = ..., length_unit: Unit = ...) -> float:
        """mass - the mass of this Vertex, which is always zero"""
    @property
    def convexity(self) -> Convexity:
        """How the shape this vertex was selected from sits around it.

        Selected through a face, as ``face.vertices()`` or
        ``face.edges()[0].vertices()`` does, the vertex is a corner of that
        face: ``CONVEX`` at the corner of a plate, ``CONCAVE`` at the corner of
        a slot or the step in an L, ``SMOOTH`` where two edges meet in line.
        The corner is read in the face's own parameters, so a corner on a
        curved face classifies the same way as one on a flat face.

        Selected straight off a solid or shell, the vertex is classified by the
        edges meeting there: ``CONVEX`` where every crease is convex, as at the
        corner of a box, ``CONCAVE`` where every crease is concave, as at the
        bottom corner of a pocket, and ``SADDLE`` where both kinds meet, as at
        the inner corner of a step. Smooth edges do not count. See
        :class:`~build_enums.Convexity`.

        Raises:
            ValueError: the vertex has no ``topo_parent``, or its face or edges
                cannot be classified - a seam vertex has no single corner in
                its face's parameters, for instance
        """
    @property
    def X(self) -> float:
        """The X coordinate of this Vertex, including its current Location."""
    @property
    def Y(self) -> float:
        """The Y coordinate of this Vertex, including its current Location."""
    @property
    def Z(self) -> float:
        """The Z coordinate of this Vertex, including its current Location."""
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
    def vertices(self, select: Select = ...) -> ShapeList[Vertex]:
        """vertices - all the vertices in this Shape"""

def topo_explore_common_vertex(edge1: Edge | TopoDS_Edge, edge2: Edge | TopoDS_Edge) -> Vertex | None:
    """Given two edges, find the common vertex"""
