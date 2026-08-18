from build123d.build_common import WorkplaneList as WorkplaneList, flatten_sequence as flatten_sequence, logger as logger, validate_inputs as validate_inputs
from build123d.build_enums import GeomType as GeomType, Kind as Kind, Mode as Mode, Side as Side, Until as Until
from build123d.build_part import BuildPart as BuildPart
from build123d.geometry import Axis as Axis, Plane as Plane, Vector as Vector, VectorLike as VectorLike
from build123d.topology import Compound as Compound, Curve as Curve, DraftAngleError as DraftAngleError, Edge as Edge, Face as Face, Part as Part, ShapeList as ShapeList, Shell as Shell, Sketch as Sketch, Solid as Solid, Vertex as Vertex, Wire as Wire
from collections.abc import Iterable

def draft(faces: Face | Iterable[Face], neutral_plane: Plane, angle: float) -> Part:
    """Part Operation: draft

    Apply a draft angle to the given faces of the part

    Args:
        faces: Faces to which the draft should be applied.
        neutral_plane: Plane defining the neutral direction and position.
        angle: Draft angle in degrees.
    """
def extrude(to_extrude: Face | Sketch | None = None, amount: float | None = None, dir: VectorLike | None = None, until: Until | None = None, target: Compound | Solid | None = None, both: bool = False, taper: float = 0.0, clean: bool = True, mode: Mode = ...) -> Part:
    """Part Operation: extrude

    Extrude a sketch or face by an amount or until another object.

    Args:
        to_extrude (Union[Face, Sketch], optional): object to extrude. Defaults to None.
        amount (float, optional): distance to extrude, sign controls direction. Defaults to None.
        dir (VectorLike, optional): direction. Defaults to None.
        until (Until, optional): extrude limit. Defaults to None.
        target (Shape, optional): extrude until target. Defaults to None.
        both (bool, optional): extrude in both directions. Defaults to False.
        taper (float, optional): taper angle. Defaults to 0.0.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: No object to extrude
        ValueError: No target object

    Returns:
        Part: extruded object
    """
def loft(sections: Face | Sketch | Iterable[Vertex | Face | Sketch] | None = None, ruled: bool = False, clean: bool = True, mode: Mode = ...) -> Part:
    """Part Operation: loft

    Loft the pending sketches/faces, across all workplanes, into a solid.

    Args:
        sections (Vertex, Face, Sketch): slices to loft into object. If not provided, pending_faces
            will be used. If vertices are to be used, a vertex can be the first, last, or
            first and last elements.
        ruled (bool, optional): discontiguous layer tangents. Defaults to False.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.
    """
def make_brake_formed(thickness: float, station_widths: float | Iterable[float], line: Edge | Wire | Curve | None = None, side: Side = ..., kind: Kind = ..., clean: bool = True, mode: Mode = ...) -> Part:
    """make_brake_formed

    Create a part typically formed with a sheet metal brake from a single outline.
    The line parameter describes how the material is to be bent. Either a single
    width value or a width value at each vertex or station is provided to control
    the width of the end part.  Note that if multiple values are provided there
    must be one for each vertex and that the resulting part is composed of linear
    segments.

    Args:
        thickness (float): sheet metal thickness
        station_widths (Union[float, Iterable[float]]): width of part at
            each vertex or a single value. Note that this width is perpendicular
            to the provided line/plane.
        line (Union[Edge, Wire, Curve], optional): outline of part. Defaults to None.
        side (Side, optional): offset direction. Defaults to Side.LEFT.
        kind (Kind, optional): offset intersection type. Defaults to Kind.ARC.
        clean (bool, optional): clean the resulting solid. Defaults to True.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: invalid line type
        ValueError: not line provided
        ValueError: line not suitable
        ValueError: incorrect # of width values

    Returns:
        Part: sheet metal part
    """
def project_workplane(origin: VectorLike | Vertex, x_dir: VectorLike | Vertex, projection_dir: VectorLike, distance: float) -> Plane:
    """Part Operation: project_workplane

    Return a plane to be used as a BuildSketch or BuildLine workplane
    with a known origin and x direction. The plane's origin will be
    the projection of the provided origin (in 3D space). The plane's
    x direction will be the projection of the provided x_dir (in 3D space).

    Args:
        origin (Union[VectorLike, Vertex]): origin in 3D space
        x_dir (Union[VectorLike, Vertex]): x direction in 3D space
        projection_dir (VectorLike): projection direction
        distance (float): distance from origin to workplane

    Raises:
        RuntimeError: Not suitable for BuildLine or BuildSketch
        ValueError: x_dir perpendicular to projection_dir

    Returns:
        Plane: workplane aligned for projection
    """
def revolve(profiles: Face | Iterable[Face] | None = None, axis: Axis = ..., revolution_arc: float = 360.0, clean: bool = True, mode: Mode = ...) -> Part:
    """Part Operation: Revolve

    Revolve the profile or pending sketches/face about the given axis.
    Note that the most common use case is when the axis is in the same plane as the
    face to be revolved but this isn't required.

    Args:
        profiles (Face, optional): 2D profile(s) to revolve.
        axis (Axis, optional): axis of rotation. Defaults to Axis.Z.
        revolution_arc (float, optional): angular size of revolution. Defaults to 360.0.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: Invalid axis of revolution
    """
def section(obj: Part | None = None, section_by: Plane | Iterable[Plane] = ..., height: float = 0.0, clean: bool = True, mode: Mode = ...) -> Sketch:
    """Part Operation: section

    Slices current part at the given height by section_by or current workplane(s).

    Args:
        obj (Part, optional): object to section. Defaults to None.
        section_by (Plane, optional): plane(s) to section object.
            Defaults to None.
        height (float, optional): workplane offset. Defaults to 0.0.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
        mode (Mode, optional): combination mode. Defaults to Mode.INTERSECT.
    """
def thicken(to_thicken: Face | Sketch | None = None, amount: float | None = None, normal_override: VectorLike | None = None, both: bool = False, clean: bool = True, mode: Mode = ...) -> Part:
    """Part Operation: thicken

    Create a solid(s) from a potentially non planar face(s) by thickening along the normals.

    Args:
        to_thicken (Union[Face, Sketch], optional): object to thicken. Defaults to None.
        amount (float): distance to extrude, sign controls direction.
        normal_override (Vector, optional): The normal_override vector can be used to
            indicate which way is 'up', potentially flipping the face normal direction
            such that many faces with different normals all go in the same direction
            (direction need only be +/- 90 degrees from the face normal). Defaults to None.
        both (bool, optional): thicken in both directions. Defaults to False.
        clean (bool, optional): Remove extraneous internal structure. Defaults to True.
        mode (Mode, optional): combination mode. Defaults to Mode.ADD.

    Raises:
        ValueError: No object to extrude
        ValueError: No target object

    Returns:
        Part: extruded object
    """
