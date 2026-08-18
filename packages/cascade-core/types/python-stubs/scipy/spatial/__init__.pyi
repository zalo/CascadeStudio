from typing import Any, Sequence

class ConvexHull:
    """3-D convex hull (served by the worker's bundled quickhull3d).
    2-D input is NOT supported in this environment."""
    points: Any
    vertices: Any
    simplices: Any
    def __init__(self, points: Sequence[Sequence[float]], incremental: bool = False, qhull_options: str | None = None) -> None: ...
    def __getattr__(self, name: str) -> Any: ...

class Voronoi:
    """2-D Voronoi (Bowyer-Watson Delaunay circumcentres). ONLY .vertices is
    available in this environment; ridges/regions raise loudly."""
    vertices: Any
    def __init__(self, points: Sequence[Sequence[float]], furthest_site: bool = False, incremental: bool = False, qhull_options: str | None = None) -> None: ...
