from .one_d import Edge as Edge, Wire as Wire
from .shape_core import Shape as Shape, ShapeList as ShapeList, downcast as downcast, shapetype as shapetype
from .zero_d import Vertex as Vertex
from OCP.TopAbs import TopAbs_ShapeEnum
from OCP.TopoDS import TopoDS_Shape as TopoDS_Shape
from build123d.geometry import BoundBox as BoundBox, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike
from collections.abc import Iterable
from typing import Any

def delta(shapes_one: Iterable[Shape], shapes_two: Iterable[Shape]) -> list[Shape]:
    """Compare the OCCT objects of each list and return the differences"""
def find_max_dimension(shapes: Shape | Iterable[Shape]) -> float:
    """Return the maximum dimension of one or more shapes"""
def isclose_b(x: float, y: float, rel_tol: float = 1e-09, abs_tol: float = 1e-14) -> bool:
    '''Determine whether two floating point numbers are close in value.
    Overridden abs_tol default for the math.isclose function.

    Args:
        x (float): First value to compare
        y (float): Second value to compare
        rel_tol (float, optional): Maximum difference for being considered "close",
            relative to the magnitude of the input values. Defaults to 1e-9.
        abs_tol (float, optional): Maximum difference for being considered "close",
            regardless of the magnitude of the input values. Defaults to 1e-14
            (unlike math.isclose which defaults to zero).

    Returns: True if a is close in value to b, and False otherwise.
    '''
def new_edges(*objects: Shape, combined: Shape) -> ShapeList[Edge]:
    """new_edges

    Given a sequence of shapes and the combination of those shapes, find the newly added edges

    Args:
        objects (Shape): sequence of shapes
        combined (Shape): result of the combination of objects

    Returns:
        ShapeList[Edge]: new edges
    """
def polar(length: float, angle: float) -> tuple[float, float]:
    """Convert polar coordinates into cartesian coordinates"""
def tuplify(obj: Any, dim: int) -> tuple | None:
    """Create a size tuple"""
def unwrapped_shapetype(obj: Shape) -> TopAbs_ShapeEnum:
    """Return Shape's TopAbs_ShapeEnum"""
