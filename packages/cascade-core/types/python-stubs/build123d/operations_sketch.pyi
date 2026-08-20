from build123d.build_common import flatten_sequence as flatten_sequence, validate_inputs as validate_inputs
from build123d.build_enums import Mode as Mode, SortBy as SortBy, Transition as Transition
from build123d.build_sketch import BuildSketch as BuildSketch
from build123d.geometry import Plane as Plane, Vector as Vector
from build123d.topology import Compound as Compound, Curve as Curve, Edge as Edge, Face as Face, ShapeList as ShapeList, Shell as Shell, Sketch as Sketch, Wire as Wire, topo_explore_connected_edges as topo_explore_connected_edges
from collections.abc import Iterable

def full_round(edge: Edge, invert: bool = False, voronoi_point_count: int = 100, mode: Mode = ...) -> tuple[Sketch, Vector, float]:
    '''Sketch Operation: full_round

    Given an edge from a Face/Sketch, modify the face by replacing the given edge with the
    arc of the Voronoi largest empty circle that will fit within the Face.  This
    "rounds off" the end of the object.

    Args:
        edge (Edge): target Edge to remove
        invert (bool, optional): make the arc concave instead of convex. Defaults to False.
        voronoi_point_count (int, optional): number of points along each edge
            used to create the voronoi vertices as potential locations for the
            center of the largest empty circle. Defaults to 100.
        mode (Mode, optional): combination mode. Defaults to Mode.REPLACE.

    Raises:
        ValueError: Invalid geometry

    Returns:
        Sketch: the modified shape

    '''
def make_face(edges: Edge | Wire | Curve | Iterable[Edge | Wire | Curve] | None = None, mode: Mode = ...) -> Sketch:
    """Sketch Operation: make_face

    Create a face from the given perimeter edges.

    Args:
        edges (Edge | Wire | Curve): perimeter edges that must combine into a
            single closed wire. Defaults to all sketch pending edges.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
def make_hull(edges: Edge | Iterable[Edge] | None = None, mode: Mode = ...) -> Sketch:
    """Sketch Operation: make_hull

    Create a face from the convex hull of the given edges

    Args:
        edges (Edge, optional): sequence of edges to hull. Defaults to all
            sketch pending edges.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
def trace(lines: Curve | Edge | Wire | Iterable[Curve | Edge | Wire] | None = None, line_width: float = 1, mode: Mode = ...) -> Sketch:
    """Sketch Operation: trace

    Convert edges, wires or pending edges into faces by sweeping a perpendicular line along them.

    Args:
        lines (Curve | Edge | Wire | Iterable[Curve | Edge | Wire]], optional): lines to
            trace. Defaults to sketch pending edges.
        line_width (float, optional): Defaults to 1.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: No objects to trace

    Returns:
        Sketch: Traced lines
    """
