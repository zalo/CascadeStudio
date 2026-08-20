from _typeshed import Incomplete
from build123d.build_common import Builder as Builder, LocationList as LocationList, WorkplaneList as WorkplaneList, flatten_sequence as flatten_sequence, validate_inputs as validate_inputs
from build123d.build_enums import GeomType as GeomType, Keep as Keep, Kind as Kind, Mode as Mode, Side as Side, Transition as Transition
from build123d.build_line import BuildLine as BuildLine
from build123d.build_part import BuildPart as BuildPart
from build123d.build_sketch import BuildSketch as BuildSketch
from build123d.geometry import Axis as Axis, Plane as Plane, Rotation as Rotation, RotationLike as RotationLike, Vector as Vector, VectorLike as VectorLike
from build123d.objects_curve import BaseLineObject as BaseLineObject
from build123d.objects_part import BasePartObject as BasePartObject
from build123d.objects_sketch import BaseSketchObject as BaseSketchObject
from build123d.topology import Compound as Compound, Curve as Curve, Edge as Edge, Face as Face, GroupBy as GroupBy, Part as Part, Shape as Shape, ShapeList as ShapeList, Shell as Shell, Sketch as Sketch, Solid as Solid, Vertex as Vertex, Wire as Wire, isclose_b as isclose_b
from collections.abc import Iterable
from typing import TypeAlias

logger: Incomplete
AddType: TypeAlias = Edge | Wire | Face | Solid | Compound | Builder

def add(objects: AddType | Iterable[AddType], rotation: float | RotationLike | None = None, clean: bool = True, mode: Mode = ...) -> Compound:
    """Generic Object: Add Object to Part or Sketch

    Add an object to a builder.

    BuildPart:
        Edges and Wires are added to pending_edges. Compounds of Face are added to
        pending_faces. Solids or Compounds of Solid are combined into the part.
    BuildSketch:
        Edges and Wires are added to pending_edges. Compounds of Face are added to sketch.
    BuildLine:
        Edges and Wires are added to line.

    Args:
        objects (Edge |  Wire |  Face |  Solid |  Compound  or Iterable of): objects to add
        rotation (float |  RotationLike, optional): rotation angle for sketch,
            rotation about each axis for part. Defaults to None.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
       mode (Mode, optional): combine mode. Defaults to Mode.ADD.
    """
def bounding_box(objects: Shape | Iterable[Shape] | None = None, mode: Mode = ...) -> Sketch | Part:
    """Generic Operation: Add Bounding Box

    Applies to: BuildSketch and BuildPart

    Add the 2D or 3D bounding boxes of the object sequence

    Args:
        objects (Shape or Iterable of): objects to create bbox for
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
ChamferFilletType: TypeAlias = Edge | Vertex

def chamfer(objects: ChamferFilletType | Iterable[ChamferFilletType], length: float, length2: float | None = None, angle: float | None = None, reference: Edge | Face | None = None) -> Sketch | Part:
    """Generic Operation: chamfer

    Applies to 2 and 3 dimensional objects.

    Chamfer the given sequence of edges or vertices.

    Args:
        objects (Edge | Vertex  or Iterable of): edges or vertices to chamfer
        length (float): chamfer size
        length2 (float, optional): asymmetric chamfer size. Defaults to None.
        angle (float, optional): chamfer angle in degrees. Defaults to None.
        reference (Edge | Face): identifies the side where length is measured. Edge(s) must
            be part of the face. Vertex/Vertices must be part of edge

    Raises:
        ValueError: no objects provided
        ValueError: objects must be Edges
        ValueError: objects must be Vertices
        ValueError: Only one of length2 or angle should be provided
        ValueError: reference can only be used in conjunction with length2 or angle
    """
def fillet(objects: ChamferFilletType | Iterable[ChamferFilletType], radius: float) -> Sketch | Part | Curve:
    """Generic Operation: fillet

    Applies to 2 and 3 dimensional objects.

    Fillet the given sequence of edges or vertices. Note that vertices on
    either end of an open line will be automatically skipped.

    Args:
        objects (Edge | Vertex or Iterable of): edges or vertices to fillet
        radius (float): fillet size - must be less than 1/2 local width

    Raises:
        ValueError: no objects provided
        ValueError: objects must be Edges
        ValueError: objects must be Vertices
        ValueError: nothing to fillet
    """
MirrorType: TypeAlias = Edge | Wire | Face | Compound | Curve | Sketch | Part

def mirror(objects: MirrorType | Iterable[MirrorType] | None = None, about: Plane = ..., mode: Mode = ...) -> Curve | Sketch | Part | Compound:
    '''Generic Operation: mirror

    Applies to 1, 2, and 3 dimensional objects.

    Mirror a sequence of objects over the given plane.

    Args:
        objects (Edge |  Face | Compound  or Iterable of): objects to mirror
        about (Plane, optional): reference plane. Defaults to "XZ".
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: missing objects
    '''
OffsetType: TypeAlias = Edge | Face | Solid | Compound

def offset(objects: OffsetType | Iterable[OffsetType] | None = None, amount: float = 0, openings: Face | list[Face] | None = None, kind: Kind = ..., side: Side = ..., closed: bool = True, mode: Mode = ...) -> Curve | Sketch | Part | Compound:
    """Generic Operation: offset

    NOTE (build123d-lite): min_edge_length is not supported in this
    environment (no fix_degenerate_edges) and has been removed from the
    signature.

    Applies to 1, 2, and 3 dimensional objects.

    Offset the given sequence of Edges, Faces, Compound of Faces, or Solids.
    The kind parameter controls the shape of the transitions. For Solid
    objects, the openings parameter allows selected faces to be open, like
    a hollow box with no lid.

    Args:
        objects (Edge |  Face |  Solid |  Compound  or Iterable of): objects to offset
        amount (float): positive values external, negative internal
        openings (list[Face], optional), sequence of faces to open in part.
            Defaults to None.
        kind (Kind, optional): transition shape. Defaults to Kind.ARC.
        side (Side, optional): side to place offset. Defaults to Side.BOTH.
        closed (bool, optional): if Side!=BOTH, close the LEFT or RIGHT
            offset. Defaults to True.
        min_edge_length (float, optional): repair degenerate edges generated by offset
            by eliminating edges of minimum length in offset wire. Defaults to None.
        mode (Mode, optional): combination mode. Defaults to Mode.REPLACE.

    Raises:
        ValueError: missing objects
        ValueError: Invalid object type
    """
ProjectType: TypeAlias = Edge | Face | Wire | Vector | Vertex

def project(objects: ProjectType | Iterable[ProjectType] | None = None, workplane: Plane | None = None, target: Solid | Compound | Part | None = None, mode: Mode = ...) -> Curve | Sketch | Compound | ShapeList[Vector]:
    """Generic Operation: project

    Applies to 0, 1, and 2 dimensional objects.

    Project the given objects or points onto a BuildLine or BuildSketch workplane in
    the direction of the normal of that workplane. When projecting onto a
    sketch a Face(s) are generated while Edges are generated for BuildLine.
    Will only use the first if BuildSketch has multiple active workplanes.
    In algebra mode a workplane must be provided and the output is either
    a Face, Curve, Sketch, Compound, or ShapeList[Vector].

    Note that only if mode is not Mode.PRIVATE only Faces can be projected into
    BuildSketch and Edge/Wires into BuildLine.

    Args:
        objects (Edge |  Face |  Wire |  VectorLike |  Vertex or Iterable of):
            objects or points to project
        workplane (Plane, optional): screen workplane
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: project doesn't accept group_by
        ValueError: Either a workplane must be provided or a builder must be active
        ValueError: Points and faces can only be projected in PRIVATE mode
        ValueError: Edges, wires and points can only be projected in PRIVATE mode
        RuntimeError: BuildPart doesn't have a project operation
    """
def scale(objects: Shape | Iterable[Shape] | None = None, by: float | tuple[float, float, float] = 1, about: VectorLike | None = None, mode: Mode = ...) -> Curve | Sketch | Part | Compound:
    """Generic Operation: scale

    Applies to 1, 2, and 3 dimensional objects.

    Scale a sequence of objects. Note that when scaling non-uniformly across
    the three axes, the type of the underlying object may change to bspline from
    line, circle, etc.

    Args:
        objects (Edge |  Face |  Compound |  Solid or Iterable of): objects to scale
        by (float | tuple[float, float, float]): scale factor
        about (VectorLike, optional): point to scale about. Defaults to each
            object's location position.
        mode (Mode, optional): combination mode. Defaults to Mode.REPLACE.

    Raises:
        ValueError: missing objects
    """
SplitType: TypeAlias = Edge | Wire | Face | Solid

def split(objects: SplitType | Iterable[SplitType] | None = None, bisect_by: Plane | Face | Shell = ..., keep: Keep = ..., mode: Mode = ...):
    """Generic Operation: split

    NOTE (build123d-lite): Keep.BOTH is not supported in this environment —
    use Keep.TOP / Keep.BOTTOM (run split twice for both halves).

    Applies to 1, 2, and 3 dimensional objects.

    Bisect object with plane and keep either top, bottom or both.

    Args:
        objects (Edge |  Wire |  Face |  Solid or Iterable of), objects to split
        bisect_by (Plane |  Face, optional): plane to segment part.
            Defaults to Plane.XZ.
        keep (Keep, optional): selector for which segment to keep. Defaults to Keep.TOP.
        mode (Mode, optional): combination mode. Defaults to Mode.REPLACE.

    Raises:
        ValueError: missing objects
    """
SweepType: TypeAlias = Compound | Edge | Wire | Face | Solid

def sweep(sections: SweepType | Iterable[SweepType] | None = None, path: Curve | Edge | Wire | Iterable[Edge] | None = None, multisection: bool = False, is_frenet: bool = False, transition: Transition = ..., normal: VectorLike | None = None, binormal: Edge | Wire | None = None, clean: bool = True, mode: Mode = ...) -> Part | Sketch:
    """Generic Operation: sweep

    Sweep pending 1D or 2D objects along path.

    Args:
        sections (Compound |  Edge |  Wire |  Face |  Solid): cross sections to sweep into object
        path (Curve |  Edge |  Wire, optional): path to follow.
            Defaults to context pending_edges.
        multisection (bool, optional): sweep multiple on path. Defaults to False.
        is_frenet (bool, optional): use frenet algorithm. Defaults to False.
        transition (Transition, optional): discontinuity handling option.
            Defaults to Transition.TRANSFORMED.
        normal (VectorLike, optional): fixed normal. Defaults to None.
        binormal (Edge |  Wire, optional): guide rotation along path. Defaults to None.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
        mode (Mode, optional): combination. Defaults to Mode.ADD.
    """
