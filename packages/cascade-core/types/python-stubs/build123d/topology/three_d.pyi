from .composite import Compound as Compound, Part as Part
from .one_d import Edge as Edge, Mixin1D as Mixin1D, Wire as Wire
from .shape_core import Joint as Joint, Shape as Shape, ShapeList as ShapeList, TOPODS as TOPODS, downcast as downcast, get_top_level_topods_shapes as get_top_level_topods_shapes, shapetype as shapetype, unwrap_topods_compound as unwrap_topods_compound
from .two_d import Face as Face, Mixin2D as Mixin2D, Shell as Shell, sort_wires_by_build_order as sort_wires_by_build_order
from .utils import find_max_dimension as find_max_dimension
from .zero_d import Vertex as Vertex
from OCP.TopoDS import TopoDS_Shape as TopoDS_Shape, TopoDS_Solid, TopoDS_Wire as TopoDS_Wire
from _typeshed import Incomplete
from build123d.build_enums import CenterOf as CenterOf, GeomType as GeomType, Keep as Keep, Kind as Kind, Transition as Transition, Until as Until
from build123d.geometry import Axis as Axis, BoundBox as BoundBox, Color as Color, DEG2RAD as DEG2RAD, Location as Location, OrientedBoundBox as OrientedBoundBox, Plane as Plane, Vector as Vector, VectorLike as VectorLike
from collections.abc import Iterable
from typing_extensions import Self

class Mixin3D(Shape[TOPODS]):
    """Additional methods to add to 3D Shape classes"""
    find_intersection_points: Incomplete
    @classmethod
    def cast(cls, obj: TopoDS_Shape) -> Self:
        """Returns the right type of wrapper, given a OCCT object"""
    @classmethod
    def extrude(cls, obj: Shape, direction: VectorLike) -> Edge | Face | Shell | Solid | Compound:
        """Unused - only here because Mixin1D is a subclass of Shape"""
    def center(self, center_of: CenterOf = ...) -> Vector:
        """Return center of object

        Find center of object

        Args:
            center_of (CenterOf, optional): center option. Defaults to CenterOf.MASS.

        Raises:
            ValueError: Center of GEOMETRY is not supported for this object
            NotImplementedError: Unable to calculate center of mass of this object

        Returns:
            Vector: center
        """
    def chamfer(self, length: float, length2: float | None, edge_list: Iterable[Edge], face: Face | None = None) -> Solid | Part:
        """Chamfer

        Chamfers the specified edges of this solid.

        Args:
            length (float): length > 0, the length (length) of the chamfer
            length2 (Optional[float]): length2 > 0, optional parameter for asymmetrical
                chamfer. Should be `None` if not required.
            edge_list (Iterable[Edge]): a list of Edge objects, which must belong to
                this solid
            face (Face, optional): identifies the side where length is measured. The edge(s)
                must be part of the face

        Returns:
            Solid | Part:  Chamfered solid or 3D composite
        """
    def dprism(self, basis: Face | None, bounds: list[Face | Wire], depth: float | None = None, taper: float = 0, up_to_face: Face | None = None, thru_all: bool = True, additive: bool = True) -> Solid:
        """dprism

        Make a prismatic feature (additive or subtractive)

        Args:
            basis (Optional[Face]): face to perform the operation on
            bounds (list[Union[Face,Wire]]): list of profiles
            depth (float, optional): depth of the cut or extrusion. Defaults to None.
            taper (float, optional): in degrees. Defaults to 0.
            up_to_face (Face, optional): a face to extrude until. Defaults to None.
            thru_all (bool, optional): cut thru_all. Defaults to True.
            additive (bool, optional): Defaults to True.

        Returns:
            Solid: prismatic feature
        """
    def fillet(self, radius: float, edge_list: Iterable[Edge]) -> Solid | Part:
        """Fillet

        Fillets the specified edges of this solid.

        Args:
            radius (float): float > 0, the radius of the fillet
            edge_list (Iterable[Edge]): a list of Edge objects, which must belong to this solid

        Returns:
            Solid | Part: Filleted solid or 3D composite
        """
    def hollow(self, faces: Iterable[Face] | None, thickness: float, tolerance: float = 0.0001, kind: Kind = ...) -> Solid:
        """Hollow

        Return the outer shelled solid of self.

        Args:
            faces (Optional[Iterable[Face]]): faces to be removed,
            which must be part of the solid. Can be an empty list.
            thickness (float): shell thickness - positive shells outwards, negative
                shells inwards.
            tolerance (float, optional): modelling tolerance of the method. Defaults to 0.0001.
            kind (Kind, optional): intersection type. Defaults to Kind.ARC.

        Raises:
            ValueError: Kind.TANGENT not supported

        Returns:
            Solid: A hollow solid.
        """
    def is_inside(self, point: VectorLike, tolerance: float = 1e-06) -> bool:
        """Returns whether or not the point is inside a solid or compound
        object within the specified tolerance.

        Args:
          point: tuple or Vector representing 3D point to be tested
          tolerance: tolerance for inside determination, default=1.0e-6
          point: VectorLike:
          tolerance: float:  (Default value = 1.0e-6)

        Returns:
          bool indicating whether or not point is within solid

        """
    def max_fillet(self, edge_list: Iterable[Edge], tolerance: float = 0.1, max_iterations: int = 10) -> float:
        """Find Maximum Fillet Size

        Find the largest fillet radius for the given Shape and edges with a
        recursive binary search.

        Example:

              max_fillet_radius = my_shape.max_fillet(shape_edges)
              max_fillet_radius = my_shape.max_fillet(shape_edges, tolerance=0.5, max_iterations=8)


        Args:
            edge_list (Iterable[Edge]): a sequence of Edge objects, which must belong to this solid
            tolerance (float, optional): maximum error from actual value. Defaults to 0.1.
            max_iterations (int, optional): maximum number of recursive iterations. Defaults to 10.

        Raises:
            RuntimeError: failed to find the max value
            ValueError: the provided Shape is invalid

        Returns:
            float: maximum fillet radius
        """
    def offset_3d(self, openings: Iterable[Face] | None, thickness: float, tolerance: float = 0.0001, kind: Kind = ...) -> Solid:
        """Shell

        Make an offset solid of self.

        Args:
            openings (Optional[Iterable[Face]]): faces to be removed,
                which must be part of the solid. Can be an empty list.
            thickness (float): offset amount - positive offset outwards, negative inwards
            tolerance (float, optional): modelling tolerance of the method. Defaults to 0.0001.
            kind (Kind, optional): intersection type. Defaults to Kind.ARC.

        Raises:
            ValueError: Kind.TANGENT not supported

        Returns:
            Solid: A shelled solid.
        """
    def project_to_viewport(self, viewport_origin: VectorLike, viewport_up: VectorLike = (0, 0, 1), look_at: VectorLike | None = None, focus: float | None = None) -> tuple[ShapeList[Edge], ShapeList[Edge]]:
        """project_to_viewport

        Project a shape onto a viewport returning visible and hidden Edges.

        Args:
            viewport_origin (VectorLike): location of viewport
            viewport_up (VectorLike, optional): direction of the viewport y axis.
                Defaults to (0, 0, 1).
            look_at (VectorLike, optional): point to look at.
                Defaults to None (center of shape).
            focus (float, optional): the focal length for perspective projection
                Defaults to None (orthographic projection)

        Returns:
            tuple[ShapeList[Edge],ShapeList[Edge]]: visible & hidden Edges
        """

class Solid(Mixin3D[TopoDS_Solid]):
    """A Solid in build123d represents a three-dimensional solid geometry
    in a topological structure. A solid is a closed and bounded volume, enclosing
    a region in 3D space. It comprises faces, edges, and vertices connected in a
    well-defined manner. Solid modeling operations, such as Boolean
    operations (union, intersection, and difference), are often performed on
    Solid objects to create or modify complex geometries."""
    order: float
    material: Incomplete
    joints: Incomplete
    def __init__(self, obj: TopoDS_Solid | Shell | None = None, label: str = '', color: Color | None = None, material: str = '', joints: dict[str, Joint] | None = None, parent: Compound | None = None) -> None:
        """Build a solid from an OCCT TopoDS_Shape/TopoDS_Solid

        Args:
            obj (TopoDS_Shape | Shell, optional): OCCT Solid or Shell.
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            material (str, optional): tag for external tools. Defaults to ''.
            joints (dict[str, Joint], optional): names joints. Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
        """
    @property
    def volume(self) -> float:
        """volume - the volume of this Solid"""
    def touch(self, other: Shape, tolerance: float = 1e-06, found_solids: ShapeList | None = None) -> ShapeList[Vertex | Edge | Face]:
        """Find where this Solid's boundary contacts another shape.

        Returns geometry where boundaries contact without interior overlap:
        - Solid + Solid → Face + Edge + Vertex (all boundary contacts)
        - Solid + Face/Shell → Face + Edge + Vertex (boundary contacts)
        - Solid + Edge/Wire → Vertex (edge endpoints on solid boundary)
        - Solid + Vertex → Vertex if on boundary
        - Solid + Compound → distributes over compound elements

        Args:
            other: Shape to check boundary contacts with
            tolerance: tolerance for contact detection
            found_solids: pre-found intersection solids to filter against

        Returns:
            ShapeList of boundary contact geometry (empty if no contact)
        """
    @classmethod
    def extrude(cls, obj: Face, direction: VectorLike) -> Solid:
        """extrude

        Extrude a Face into a Solid.

        Args:
            direction (VectorLike): direction and magnitude of extrusion

        Raises:
            ValueError: Unsupported class
            RuntimeError: Generated invalid result

        Returns:
            Edge: extruded shape
        """
    @classmethod
    def extrude_linear_with_rotation(cls, section: Face | Wire, center: VectorLike, normal: VectorLike, angle: float, inner_wires: list[Wire] | None = None) -> Solid:
        """Extrude with Rotation

        Creates a 'twisted prism' by extruding, while simultaneously rotating around the
        extrusion vector.

        Args:
            section (Union[Face,Wire]): cross section
            vec_center (VectorLike): the center point about which to rotate
            vec_normal (VectorLike): a vector along which to extrude the wires
            angle (float): the angle to rotate through while extruding
            inner_wires (list[Wire], optional): holes - only used if section is of type Wire.
                Defaults to None.

        Returns:
            Solid: extruded object
        """
    @classmethod
    def extrude_taper(cls, profile: Face, direction: VectorLike, taper: float, flip_inner: bool = True) -> Solid:
        """Extrude a cross section with a taper

        Extrude a cross section into a prismatic solid in the provided direction.

        Note that two difference algorithms are used. If direction aligns with
        the profile normal (which must be positive), the taper is positive and the profile
        contains no holes the OCP LocOpe_DPrism algorithm is used as it generates the most
        accurate results. Otherwise, a loft is created between the profile and the profile
        with a 2D offset set at the appropriate direction.

        Args:
            section (Face]): cross section
            normal (VectorLike): a vector along which to extrude the wires. The length
                of the vector controls the length of the extrusion.
            taper (float): taper angle in degrees.
            flip_inner (bool, optional): outer and inner geometry have opposite tapers to
                allow for part extraction when injection molding.

        Returns:
            Solid: extruded cross section
        """
    @classmethod
    def extrude_until(cls, profile: Face, target: Compound | Solid, direction: VectorLike, until: Until = ...) -> Solid:
        """extrude_until

        Extrude `profile` in the provided `direction` until it encounters a
        bounding surface on the `target`. The termination surface is chosen
        according to the `until` option:

            * ``Until.NEXT`` — Extrude forward until the first intersecting surface.
            * ``Until.LAST`` — Extrude forward through all intersections, stopping at
            the farthest surface.
            * ``Until.PREVIOUS`` — Reverse the extrusion direction and stop at the
            first intersecting surface behind the profile.
            * ``Until.FIRST`` — Reverse the direction and stop at the farthest
            surface behind the profile.

        When ``Until.PREVIOUS`` or ``Until.FIRST`` are used, the extrusion
        direction is automatically inverted before execution.

        Note:
            The bounding surface on the target must be large enough to
            completely cover the extruded profile at the contact region.
            Partial overlaps may yield open or invalid solids.

        Args:
            profile (Face): The face to extrude.
            target (Union[Compound, Solid]): The object that limits the extrusion.
            direction (VectorLike): Extrusion direction.
            until (Until, optional): Surface selection mode controlling which
                intersection to stop at. Defaults to ``Until.NEXT``.

        Raises:
            ValueError: If the provided profile does not intersect the target.

        Returns:
            Solid: The extruded and limited solid.
        """
    @classmethod
    def from_bounding_box(cls, bbox: BoundBox | OrientedBoundBox) -> Solid:
        """A box of the same dimensions and location"""
    @classmethod
    def make_box(cls, length: float, width: float, height: float, plane: Plane = ...) -> Solid:
        """make box

        Make a box at the origin of plane extending in positive direction of each axis.

        Args:
            length (float):
            width (float):
            height (float):
            plane (Plane, optional): base plane. Defaults to Plane.XY.

        Returns:
            Solid: Box
        """
    @classmethod
    def make_cone(cls, base_radius: float, top_radius: float, height: float, plane: Plane = ..., angle: float = 360) -> Solid:
        """make cone

        Make a cone with given radii and height

        Args:
            base_radius (float):
            top_radius (float):
            height (float):
            plane (Plane): base plane. Defaults to Plane.XY.
            angle (float, optional): arc size. Defaults to 360.

        Returns:
            Solid: Full or partial cone
        """
    @classmethod
    def make_cylinder(cls, radius: float, height: float, plane: Plane = ..., angle: float = 360) -> Solid:
        """make cylinder

        Make a cylinder with a given radius and height with the base center on plane origin.

        Args:
            radius (float):
            height (float):
            plane (Plane): base plane. Defaults to Plane.XY.
            angle (float, optional): arc size. Defaults to 360.

        Returns:
            Solid: Full or partial cylinder
        """
    @classmethod
    def make_loft(cls, objs: Iterable[Vertex | Wire], ruled: bool = False) -> Solid:
        """make loft

        Makes a loft from a list of wires and vertices. Vertices can appear only at the
        beginning or end of the list, but cannot appear consecutively within the list
        nor between wires.

        Args:
            objs (list[Vertex, Wire]): wire perimeters or vertices
            ruled (bool, optional): stepped or smooth. Defaults to False (smooth).

        Raises:
            ValueError: Too few wires

        Returns:
            Solid: Lofted object
        """
    @classmethod
    def make_sphere(cls, radius: float, plane: Plane = ..., angle1: float = -90, angle2: float = 90, angle3: float = 360) -> Solid:
        """Sphere

        Make a full or partial sphere - with a given radius center on the origin or plane.

        Args:
            radius (float):
            plane (Plane): base plane. Defaults to Plane.XY.
            angle1 (float, optional): Defaults to -90.
            angle2 (float, optional): Defaults to 90.
            angle3 (float, optional): Defaults to 360.

        Returns:
            Solid: sphere
        """
    @classmethod
    def make_torus(cls, major_radius: float, minor_radius: float, plane: Plane = ..., start_angle: float = 0, end_angle: float = 360, major_angle: float = 360) -> Solid:
        """make torus

        Make a torus with a given radii and angles

        Args:
            major_radius (float):
            minor_radius (float):
            plane (Plane): base plane. Defaults to Plane.XY.
            start_angle (float, optional): start major arc. Defaults to 0.
            end_angle (float, optional): end major arc. Defaults to 360.

        Returns:
            Solid: Full or partial torus
        """
    @classmethod
    def make_wedge(cls, delta_x: float, delta_y: float, delta_z: float, min_x: float, min_z: float, max_x: float, max_z: float, plane: Plane = ...) -> Solid:
        """Make a wedge

        Args:
            delta_x (float):
            delta_y (float):
            delta_z (float):
            min_x (float):
            min_z (float):
            max_x (float):
            max_z (float):
            plane (Plane): base plane. Defaults to Plane.XY.

        Returns:
            Solid: wedge
        """
    @classmethod
    def revolve(cls, section: Face | Wire, angle: float, axis: Axis, inner_wires: list[Wire] | None = None) -> Solid:
        """Revolve

        Revolve a cross section about the given Axis by the given angle.

        Args:
            section (Union[Face,Wire]): cross section
            angle (float): the angle to revolve through
            axis (Axis): rotation Axis
            inner_wires (list[Wire], optional): holes - only used if section is of type Wire.
                Defaults to [].

        Returns:
            Solid: the revolved cross section
        """
    @classmethod
    def sweep(cls, section: Face | Wire, path: Wire | Edge, inner_wires: list[Wire] | None = None, make_solid: bool = True, is_frenet: bool = False, mode: Vector | Wire | Edge | None = None, transition: Transition = ...) -> Solid:
        """Sweep

        Sweep the given cross section into a prismatic solid along the provided path

        The is_frenet parameter controls how the profile orientation changes as it
        follows along the sweep path. If is_frenet is False, the orientation of the
        profile is kept consistent from point to point. The resulting shape has the
        minimum possible twisting. Unintuitively, when a profile is swept along a
        helix, this results in the orientation of the profile slowly creeping
        (rotating) as it follows the helix. Setting is_frenet to True prevents this.

        If is_frenet is True the orientation of the profile is based on the local
        curvature and tangency vectors of the path. This keeps the orientation of the
        profile consistent when sweeping along a helix (because the curvature vector of
        a straight helix always points to its axis). However, when path is not a helix,
        the resulting shape can have strange looking twists sometimes. For more
        information, see Frenet Serret formulas
        http://en.wikipedia.org/wiki/Frenet%E2%80%93Serret_formulas.

        Args:
            section (Union[Face, Wire]): cross section to sweep
            path (Union[Wire, Edge]): sweep path
            inner_wires (list[Wire]): holes - only used if section is a wire
            make_solid (bool, optional): return Solid or Shell. Defaults to True.
            is_frenet (bool, optional): Frenet mode. Defaults to False.
            mode (Union[Vector, Wire, Edge, None], optional): additional sweep
                mode parameters. Defaults to None.
            transition (Transition, optional): handling of profile orientation at C1 path
                discontinuities. Defaults to Transition.TRANSFORMED.

        Returns:
            Solid: the swept cross section
        """
    @classmethod
    def sweep_multi(cls, profiles: Iterable[Wire | Face], path: Wire | Edge, make_solid: bool = True, is_frenet: bool = False, binormal: Vector | Wire | Edge | None = None) -> Solid:
        """Multi section sweep

        Sweep through a sequence of profiles following a path.

        The is_frenet parameter controls how the profile orientation changes as it
        follows along the sweep path. If is_frenet is False, the orientation of the
        profile is kept consistent from point to point. The resulting shape has the
        minimum possible twisting. Unintuitively, when a profile is swept along a
        helix, this results in the orientation of the profile slowly creeping
        (rotating) as it follows the helix. Setting is_frenet to True prevents this.

        If is_frenet is True the orientation of the profile is based on the local
        curvature and tangency vectors of the path. This keeps the orientation of the
        profile consistent when sweeping along a helix (because the curvature vector of
        a straight helix always points to its axis). However, when path is not a helix,
        the resulting shape can have strange looking twists sometimes. For more
        information, see Frenet Serret formulas
        http://en.wikipedia.org/wiki/Frenet%E2%80%93Serret_formulas.

        Args:
            profiles (Iterable[Union[Wire, Face]]): list of profiles
            path (Union[Wire, Edge]): The wire to sweep the face resulting from the wires over
            make_solid (bool, optional): Solid or Shell. Defaults to True.
            is_frenet (bool, optional): Select frenet mode. Defaults to False.
            binormal (Union[Vector, Wire, Edge, None], optional): additional sweep mode parameters.
                Defaults to None.

        Returns:
            Solid: swept object
        """
    @classmethod
    def thicken(cls, surface: Face | Shell, depth: float, normal_override: VectorLike | None = None) -> Solid:
        """Thicken Face or Shell

        Create a solid from a potentially non planar face or shell by thickening along
        the normals.

        .. image:: thickenFace.png

        Non-planar faces are thickened both towards and away from the center of the sphere.

        Args:
            depth (float): Amount to thicken face(s), can be positive or negative.
            normal_override (Vector, optional): Face only. The normal_override vector can be
                used to indicate which way is 'up', potentially flipping the face normal
                direction such that many faces with different normals all go in the same
                direction (direction need only be +/- 90 degrees from the face normal).
                Defaults to None.

        Raises:
            RuntimeError: Opencascade internal failures

        Returns:
            Solid: The resulting Solid object
        """
    def draft(self, faces: Iterable[Face], neutral_plane: Plane, angle: float) -> Solid:
        """Apply a draft angle to the given faces of the solid.

        Args:
            faces: Faces to which the draft should be applied.
            neutral_plane: Plane defining the neutral direction and position.
            angle: Draft angle in degrees.

        Returns:
            Solid with the specified draft angles applied.

        Raises:
            RuntimeError: If draft application fails on any face or during build.
        """

class DraftAngleError(RuntimeError):
    """Solid.draft custom exception"""
    face: Incomplete
    problematic_shape: Incomplete
    def __init__(self, message, face=None, problematic_shape=None) -> None: ...
