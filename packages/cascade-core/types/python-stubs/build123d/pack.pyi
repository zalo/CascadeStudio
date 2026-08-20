from build123d.geometry import Location as Location, Pos as Pos
from build123d.topology.shape_core import Shape as Shape
from collections.abc import Callable as Callable, Collection

def pack(objects: Collection[Shape], padding: float, align_z: bool = False) -> Collection[Shape]:
    """Pack objects in a squarish area in Plane.XY.

    Args:
        objects (Collection[Shape]): objects to arrange
        padding (float): space between objects
        align_z (bool, optional): align shape bottoms to Plane.XY. Defaults to False.

    Returns:
        Collection[Shape]: rearranged objects
    """
