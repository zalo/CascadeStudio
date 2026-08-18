from collections.abc import Iterable
from build123d.build_common import *
from build123d.build_enums import *
from build123d.build_line import *
from build123d.build_part import *
from build123d.build_sketch import *
from build123d.exporters import *
from build123d.geometry import *
from build123d.importers import *
from build123d.joints import *
from build123d.mesher import *
from build123d.objects_curve import *
from build123d.objects_part import *
from build123d.objects_sketch import *
from build123d.operations_generic import *
from build123d.operations_part import *
from build123d.operations_sketch import *
from build123d.pack import *
from build123d.topology import *
from build123d.drafting import *
from build123d.exporters3d import *
from build123d.text import FontManager as FontManager, available_fonts as available_fonts

# ---------------------------------------------------------------------------
# CascadeStudio (build123d-lite) viewer extensions — not part of upstream
# build123d. They exist so scripts can control the 3-D viewport directly.
# ---------------------------------------------------------------------------

def show(*shapes: Shape | Iterable[Shape], **kwargs: object) -> None:
    """Put one or more shapes in the CascadeStudio 3-D viewport.

    NOTE (build123d-lite): unlike ocp_vscode's show() (which replaces the
    view on every call), repeated calls APPEND to the scene so scripts can
    show several results separately — COMPROMISE(show-semantics). Extra
    viewer kwargs (names=, colors=, ...) are accepted and ignored."""

def show_object(shape: Shape | Iterable[Shape], name: str | None = None, options: dict | None = None, **kwargs: object) -> None:
    """ocp_vscode/CQ-editor-compatible alias of show()."""

def show_all(*args: object, **kwargs: object) -> None:
    """Show every shape bound to a module-level variable."""

def volume(shape: Shape) -> float:
    """Volume of a shape in mm^3 (summed per solid —
    COMPROMISE(volume-measure))."""

__all__ = [
    'Airfoil',
    'Align',
    'AngularDirection',
    'ArrowHead',
    'Axis',
    'BSpline',
    'BallJoint',
    'BasePartObject',
    'BaseSketchObject',
    'Bezier',
    'BlendCurve',
    'BoundBox',
    'Box',
    'BuildLine',
    'BuildPart',
    'BuildSketch',
    'Builder',
    'CANONICAL_BAND',
    'CANONICAL_SAMPLES',
    'CM',
    'CanonicalForm',
    'CenterArc',
    'CenterOf',
    'Circle',
    'Color',
    'Compound',
    'Cone',
    'ConstrainedArcs',
    'ConstrainedLines',
    'ContinuityLevel',
    'ConvexPolyhedron',
    'CounterBoreHole',
    'CounterSinkHole',
    'Curve',
    'Cylinder',
    'CylindricalJoint',
    'DoubleTangentArc',
    'Edge',
    'Ellipse',
    'EllipticalCenterArc',
    'EllipticalStartArc',
    'ExportDXF',
    'ExportSVG',
    'Extrinsic',
    'FT',
    'Face',
    'FilletPolyline',
    'FontStyle',
    'G',
    'GeomType',
    'GridLocations',
    'GroupBy',
    'HeadType',
    'Helix',
    'HexLocations',
    'Hole',
    'HyperbolicCenterArc',
    'IN',
    'IntersectingLine',
    'Intrinsic',
    'JernArc',
    'Joint',
    'KG',
    'Keep',
    'Kind',
    'LB',
    'LengthMode',
    'Line',
    'LineType',
    'LinearJoint',
    'Location',
    'LocationList',
    'Locations',
    'M',
    'MM',
    'Mesher',
    'Mode',
    'ParabolicCenterArc',
    'Part',
    'Plane',
    'PolarLine',
    'PolarLocations',
    'Polygon',
    'Polyline',
    'Pos',
    'RadiusArc',
    'Rectangle',
    'RectangleRounded',
    'RegularPolygon',
    'RevoluteJoint',
    'RigidJoint',
    'Rot',
    'Rotation',
    'RotationLike',
    'Sagitta',
    'SagittaArc',
    'Select',
    'Shape',
    'ShapeList',
    'Shell',
    'Side',
    'Sketch',
    'SlotArc',
    'SlotCenterPoint',
    'SlotCenterToCenter',
    'SlotOverall',
    'Solid',
    'SortBy',
    'Sphere',
    'Spline',
    'THOU',
    'Tangency',
    'TangentArc',
    'Text',
    'TextAlign',
    'ThreePointArc',
    'Torus',
    'Transition',
    'Trapezoid',
    'Triangle',
    'Unit',
    'Until',
    'Vector',
    'VectorLike',
    'Vertex',
    'Wedge',
    'Wire',
    'Workplanes',
    'add',
    'bounding_box',
    'canonical_form',
    'chamfer',
    'draft',
    'edges',
    'edges_to_wires',
    'export_gltf',
    'export_step',
    'export_stl',
    'extrude',
    'faces',
    'fillet',
    'full_round',
    'import_step',
    'import_stl',
    'import_svg',
    'lexicographic_key',
    'loft',
    'loop_area_vector',
    'make_brake_formed',
    'make_face',
    'make_hull',
    'mirror',
    'new_edges',
    'offset',
    'pack',
    'project',
    'revolve',
    'scale',
    'section',
    'show',
    'show_all',
    'show_object',
    'solids',
    'split',
    'sweep',
    'thicken',
    'topo_distance_to',
    'vertices',
    'volume',
    'wires',
]

