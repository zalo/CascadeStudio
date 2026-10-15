from OCP.TopoDS import TopoDS_Shape as TopoDS_Shape
from OCP.collections import List_TopoDS_Shape

def list_shapes(shapes: List_TopoDS_Shape) -> list[TopoDS_Shape]:
    """A kernel list as a Python list.

    Iterating a ``List_TopoDS_Shape`` through its Python protocol costs
    over a millisecond per list, even an empty one; popping a copy of it
    from the front costs microseconds.
    """
