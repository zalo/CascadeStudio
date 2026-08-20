import json
from .topology import Edge as Edge, Face as Face, Shape as Shape, Vertex as Vertex
from OCP.Bnd import Bnd_Box, Bnd_OBB
from OCP.Quantity import Quantity_ColorRGBA
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS_Face, TopoDS_Shape
from OCP.gp import gp_Ax1, gp_Ax2, gp_Ax3, gp_Dir, gp_GTrsf, gp_Pln, gp_Pnt, gp_Trsf, gp_Vec, gp_XYZ
from _typeshed import Incomplete
from build123d.build_enums import Align as Align, Align2D as Align2D, Align3D as Align3D, Extrinsic as Extrinsic, Intrinsic as Intrinsic
from collections.abc import Callable as Callable, Iterable, Sequence
from typing import Any, TypeAlias, overload

logger: Incomplete
TOLERANCE: float
TOL_DIGITS: Incomplete
TOL: float
DEG2RAD: Incomplete
RAD2DEG: Incomplete
GEOM_KEY_DIGITS: Incomplete

class Vector:
    """Create a 3-dimensional vector

    Args:
        x (float): x component
        y (float): y component
        z (float): z component
        vec (Vector |  Sequence(float) |  gp_Vec |  gp_Pnt |  gp_Dir |  gp_XYZ): vector
            representations

    Note that if no z value is provided it's assumed to be zero. If no values are provided
    the returned Vector has the value of 0, 0, 0.

    Attributes:
        wrapped (gp_Vec): the OCP vector object

    """
    @overload
    def __init__(self, X: float, Y: float, Z: float) -> None: ...
    @overload
    def __init__(self, X: float, Y: float) -> None: ...
    @overload
    def __init__(self, v: Vector) -> None: ...
    @overload
    def __init__(self, v: Sequence[float]) -> None: ...
    @overload
    def __init__(self, v: gp_Vec | gp_Pnt | gp_Dir | gp_XYZ) -> None: ...
    @overload
    def __init__(self) -> None: ...
    def __iter__(self): ...
    @property
    def X(self) -> float:
        """Get x value"""
    @X.setter
    def X(self, value: float) -> None:
        """Set x value"""
    @property
    def Y(self) -> float:
        """Get y value"""
    @Y.setter
    def Y(self, value: float) -> None:
        """Set y value"""
    @property
    def Z(self) -> float:
        """Get z value"""
    @Z.setter
    def Z(self, value: float) -> None:
        """Set z value"""
    @property
    def wrapped(self) -> gp_Vec:
        """OCCT object"""
    def to_tuple(self) -> tuple[float, float, float]:
        """Return tuple equivalent"""
    @property
    def length(self) -> float:
        """Vector length"""
    def cross(self, vec: Vector) -> Vector:
        """Mathematical cross function"""
    def dot(self, vec: Vector) -> float:
        """Mathematical dot function"""
    def sub(self, vec: VectorLike) -> Vector:
        """Mathematical subtraction function"""
    def __sub__(self, vec: VectorLike) -> Vector:
        """Mathematical subtraction operator -"""
    def add(self, vec: VectorLike) -> Vector:
        """Mathematical addition function"""
    def __add__(self, vec: VectorLike) -> Vector:
        """Mathematical addition operator +"""
    def __radd__(self, vec: Vector) -> Vector:
        """Mathematical reverse addition operator +"""
    def multiply(self, scale: float) -> Vector:
        """Mathematical multiply function"""
    def __mul__(self, scale: float) -> Vector:
        """Mathematical multiply operator *"""
    def __truediv__(self, denom: float) -> Vector:
        """Mathematical division operator /"""
    def __rmul__(self, scale: float) -> Vector:
        """Mathematical multiply operator *"""
    def normalized(self) -> Vector:
        """Scale to length of 1"""
    def reverse(self) -> Vector:
        """Return a vector with the same magnitude but pointing in the opposite direction"""
    def center(self) -> Vector:
        """center

        Returns:
          The center of myself is myself.
          Provided so that vectors, vertices, and other shapes all support a
          common interface, when center() is requested for all objects on the
          stack.

        """
    def get_angle(self, vec: Vector) -> float:
        """Unsigned angle between vectors"""
    def get_signed_angle(self, vec: Vector, normal: Vector | None = None) -> float:
        """Signed Angle Between Vectors

        Return the signed angle in degrees between two vectors with the given normal
        based on this math: angle = atan2((Va × Vb) ⋅ Vn, Va ⋅ Vb)

        Args:
            v (Vector): Second Vector
            normal (Vector, optional): normal direction. Defaults to None.

        Returns:
            float: Angle between vectors
        """
    def project_to_line(self, line: Vector) -> Vector:
        """Returns a new vector equal to the projection of this Vector onto the line
        represented by Vector <line>

        Args:
            line (Vector): project to this line

        Returns:
            Vector: Returns the projected vector.

        """
    def distance_to_plane(self, plane: Plane) -> float:
        """Minimum unsigned distance between vector and plane"""
    def signed_distance_from_plane(self, plane: Plane) -> float:
        """Signed distance from plane to point vector."""
    def project_to_plane(self, plane: Plane) -> Vector:
        """Vector is projected onto the plane provided as input.

        Args:
          args: Plane object

        Returns the projected vector.
          plane: Plane:

        Returns:

        """
    def __neg__(self) -> Vector:
        """Flip direction of vector operator -"""
    def __abs__(self) -> float:
        """Vector length operator abs()"""
    def __and__(self, other: Axis | Location | Plane | VectorLike | Shape):
        """intersect vector with other &"""
    def __format__(self, spec) -> str:
        """Format Vector"""
    def __eq__(self, other: object) -> bool:
        """Vectors equal operator =="""
    def __hash__(self) -> int:
        """Hash of Vector"""
    def __round__(self, ndigits: int | None = None): ...
    def __copy__(self) -> Vector:
        """Return copy of self"""
    def __deepcopy__(self, _memo) -> Vector:
        """Return deepcopy of self"""
    def to_pnt(self) -> gp_Pnt:
        """Convert to OCCT gp_Pnt object"""
    def to_dir(self) -> gp_Dir:
        """Convert to OCCT gp_Dir object"""
    def transform(self, affine_transform: Matrix, is_direction: bool = False) -> Vector:
        """Apply affine transformation

        Args:
            affine_transform (Matrix): affine transformation matrix
            is_direction (bool, optional): Should self be transformed as a vector or direction?
                Defaults to False (vector)

        Returns:
            Vector: transformed vector
        """
    def rotate(self, axis: Axis, angle: float) -> Vector:
        """Rotate about axis

        Rotate about the given Axis by an angle in degrees

        Args:
            axis (Axis): Axis of rotation
            angle (float): angle in degrees

        Returns:
            Vector: rotated vector
        """
    @overload
    def intersect(self, vector: VectorLike) -> Vector | None:
        """Find intersection of vector and vector"""
    @overload
    def intersect(self, location: Location) -> Vector | None:
        """Find intersection of vector and location"""
    @overload
    def intersect(self, axis: Axis) -> Vector | None:
        """Find intersection of vector and axis"""
    @overload
    def intersect(self, plane: Plane) -> Vector | None:
        """Find intersection of vector and plane"""
    @overload
    def intersect(self, shape: Shape) -> Shape | None:
        """Find intersection of vector and shape"""
VectorLike: TypeAlias = Vector | tuple[float, float] | tuple[float, float, float] | Sequence[float]

class AxisMeta(type):
    """Axis meta class to enable class properties"""
    @property
    def X(cls) -> Axis:
        """X Axis"""
    @property
    def Y(cls) -> Axis:
        """Y Axis"""
    @property
    def Z(cls) -> Axis:
        """Z Axis"""

class Axis(metaclass=AxisMeta):
    """Axis

    Axis defined by point and direction or by two points

    Args:
        origin (VectorLike): start point
        direction (VectorLike): direction
        end_point (VectorLike): point used with origin to define direction
        edge (Edge): origin & direction defined by start of edge
        location (Location): location to convert to axis

    Attributes:
        position (Vector): the global position of the axis origin
        direction (Vector): the normalized direction vector
        wrapped (gp_Ax1): the OCP axis object
    """
    @overload
    def __init__(self, gp_ax1: gp_Ax1) -> None:
        """Axis: point and direction"""
    @overload
    def __init__(self, location: Location) -> None:
        """Axis from location"""
    @overload
    def __init__(self, origin: VectorLike, direction: VectorLike) -> None:
        """Axis: point and direction"""
    @overload
    def __init__(self, origin: VectorLike, *, end_point: VectorLike) -> None:
        """Axis: point and end point"""
    @overload
    def __init__(self, edge: Edge, *, canonical: bool = False) -> None:
        """Axis: start of Edge. canonical=True (build123d-lite extension)
        measures from the edge's canonical parametrization, so the axis does
        not depend on the kernel's seam/direction choice for free edges."""
    @property
    def wrapped(self):
        """OCP object"""
    @property
    def position(self) -> Vector:
        """The position or origin of the Axis"""
    @position.setter
    def position(self, position: VectorLike):
        """Set the position or origin of the Axis"""
    @property
    def direction(self) -> Vector:
        """The normalized direction of the Axis"""
    @direction.setter
    def direction(self, direction: VectorLike):
        """Set the direction of the Axis"""
    @property
    def location(self) -> Location:
        """Return self as Location"""
    def __copy__(self) -> Axis:
        """Return copy of self"""
    def __deepcopy__(self, _memo) -> Axis:
        """Return deepcopy of self"""
    def __hash__(self) -> int:
        """Hash of Axis"""
    def __format__(self, spec) -> str:
        """Format Axis"""
    def __eq__(self, other: object) -> bool: ...
    def located(self, new_location: Location):
        """relocates self to a new location possibly changing position and direction"""
    def to_plane(self) -> Plane:
        """Return self as Plane"""
    def is_coaxial(self, other: Axis, angular_tolerance: float = 1e-05, linear_tolerance: float = 1e-05) -> bool:
        """are axes coaxial

        True if the angle between self and other is lower or equal to angular_tolerance and
        the distance between self and other is lower or equal to linear_tolerance.

        Args:
            other (Axis): axis to compare to
            angular_tolerance (float, optional): max angular deviation. Defaults to 1e-5.
            linear_tolerance (float, optional): max linear deviation. Defaults to 1e-5.

        Returns:
            bool: axes are coaxial
        """
    def is_normal(self, other: Axis, angular_tolerance: float = 1e-05) -> bool:
        """are axes normal

        Returns True if the direction of this and another axis are normal to each other. That is,
        if the angle between the two axes is equal to 90° within the angular_tolerance.

        Args:
            other (Axis): axis to compare to
            angular_tolerance (float, optional): max angular deviation. Defaults to 1e-5.

        Returns:
            bool: axes are normal
        """
    def is_opposite(self, other: Axis, angular_tolerance: float = 1e-05) -> bool:
        """are axes opposite

        Returns True if the direction of this and another axis are parallel with
        opposite orientation. That is, if the angle between the two axes is equal
        to 180° within the angular_tolerance.

        Args:
            other (Axis): axis to compare to
            angular_tolerance (float, optional): max angular deviation. Defaults to 1e-5.

        Returns:
            bool: axes are opposite
        """
    def is_parallel(self, other: Axis, angular_tolerance: float = 1e-05) -> bool:
        """are axes parallel

        Returns True if the direction of this and another axis are parallel with same
        orientation or opposite orientation. That is, if the angle between the two axes is
        equal to 0° or 180° within the angular_tolerance.

        Args:
            other (Axis): axis to compare to
            angular_tolerance (float, optional): max angular deviation. Defaults to 1e-5.

        Returns:
            bool: axes are parallel
        """
    def is_skew(self, other: Axis, tolerance: float = 1e-05) -> bool:
        """are axes skew

        Returns True if this axis and another axis are skew, meaning they are neither
        parallel nor coplanar. Two axes are skew if they do not lie in the same plane
        and never intersect.

        Mathematically, this means:

        - The axes are **not parallel** (the cross product of their direction vectors
          is nonzero).

        - The axes are **not coplanar** (the vector between their positions is not
          aligned with the plane spanned by their directions).

        If either condition is false (i.e., the axes are parallel or coplanar), they are
        not skew.

        Args:
            other (Axis): axis to compare to
            tolerance (float, optional): max deviation. Defaults to 1e-5.

        Returns:
            bool: axes are skew
        """
    def angle_between(self, other: Axis) -> float:
        """calculate angle between axes

        Computes the angular value, in degrees, between the direction of self and other
        between 0° and 360°.

        Args:
            other (Axis): axis to compare to

        Returns:
            float: angle between axes
        """
    def reverse(self) -> Axis:
        """Return a copy of self with the direction reversed"""
    def __neg__(self) -> Axis:
        """Flip direction operator -"""
    def __and__(self, other: Axis | Location | Plane | VectorLike | Shape) -> Vector | Location | Axis | None:
        """intersect vector with other &"""
    @overload
    def intersect(self, vector: VectorLike) -> Vector | None:
        """Find intersection of axis and vector"""
    @overload
    def intersect(self, location: Location) -> Vector | Location | None:
        """Find intersection of axis and location"""
    @overload
    def intersect(self, axis: Axis) -> Vector | Axis | None:
        """Find intersection of axis and axis"""
    @overload
    def intersect(self, plane: Plane) -> Vector | Axis | None:
        """Find intersection of axis and plane"""
    @overload
    def intersect(self, shape: Shape) -> Shape | None:
        """Find intersection of axis and shape"""

class BoundBox:
    """A BoundingBox for a Shape"""
    @overload
    def __init__(self, bounding_box: Bnd_Box) -> None:
        """Construct a bounding box from a Bnd_Box"""
    @overload
    def __init__(self, shape: TopoDS_Shape, tolerance: float | None = None, optimal: bool = True) -> None:
        """Construct a bounding box from a TopoDS_Shape"""
    @property
    def measure(self) -> float:
        """Return the overall Lebesgue measure of the bounding box.

        - For 1D objects: length
        - For 2D objects: area
        - For 3D objects: volume
        """
    @property
    def diagonal(self) -> float:
        """body diagonal length (i.e. object maximum size)"""
    def center(self) -> Vector:
        """Return center of the bounding box"""
    def add(self, obj: tuple[float, float, float] | Vector | BoundBox, tol: float | None = None) -> BoundBox:
        """Returns a modified (expanded) bounding box

        obj can be one of several things:
            1. a 3-tuple corresponding to x,y, and z amounts to add
            2. a vector, containing the x,y,z values to add
            3. another bounding box, where a new box will be created that
               encloses both.

        This bounding box is not changed.

        Args:
          obj: tuple[float, float, float] | Vector | BoundBox]:
          tol: float:  (Default value = None)

        Returns:

        """
    @staticmethod
    def find_outside_box_2d(bb1: BoundBox, bb2: BoundBox) -> BoundBox | None:
        """Compares bounding boxes

        Compares bounding boxes. Returns none if neither is inside the other.
        Returns the outer one if either is outside the other.

        BoundBox.is_inside works in 3d, but this is a 2d bounding box, so it
        doesn't work correctly plus, there was all kinds of rounding error in
        the built-in implementation i do not understand.

        Args:
          bb1: BoundBox:
          bb2: BoundBox:

        Returns:

        """
    @classmethod
    def from_topo_ds(cls, shape: TopoDS_Shape, tolerance: float | None = None, optimal: bool = True) -> BoundBox:
        """Constructs a bounding box from a TopoDS_Shape

        Args:
            shape: TopoDS_Shape:
            tolerance: float:  (Default value = None)
            optimal: bool:  This algorithm builds precise bounding box (Default value = True)

        Returns:

        """
    def is_inside(self, second_box: BoundBox) -> bool:
        """Is the provided bounding box inside this one?

        Args:
          b2: BoundBox:

        Returns:

        """
    def overlaps(self, other: BoundBox, tolerance: float = ...) -> bool:
        """Check if this bounding box overlaps with another.

        Args:
            other: BoundBox to check overlap with
            tolerance: Distance tolerance for overlap detection

        Returns:
            True if bounding boxes overlap (share any volume), False otherwise
        """
    def to_align_offset(self, align: Align2D | Align3D) -> Vector:
        """Amount to move object to achieve the desired alignment"""

class Color:
    """
    Color object based on OCCT Quantity_ColorRGBA.

    Attributes:
        wrapped (Quantity_ColorRGBA): the OCP color object
    """
    @overload
    def __init__(self, color_like: ColorLike) -> None:
        '''Color from ColorLike

        Args:
            color_like (ColorLike):
                name, ex: "red" or "#ff0000",
                name + alpha, ex: ("red", 0.5) or "#ff000080",
                rgb, ex: (1., 0., 0.),
                rgb + alpha, ex: (1., 0., 0., 0.5),
                hex, ex: 0xff0000,
                hex + alpha, ex: (0xff0000, 0x80),
                Color,
                Quantity_ColorRGBA
        '''
    @overload
    def __init__(self, name: str, alpha: float = 1.0) -> None:
        '''Color from name or hexadecimal string

        `CSS3 Color Names
            <https://en.wikipedia.org/wiki/Web_colors#Extended_colors>`

        `OCCT Color Names
            <https://dev.opencascade.org/doc/refman/html/_quantity___name_of_color_8hxx.html>`_

        Hexadecimal string may be RGB or RGBA format with leading "#"

        Args:
            name (str): color, e.g. "blue" or "#0000ff""
            alpha (float, optional): 0.0 <= alpha <= 1.0. Defaults to 1.0
        '''
    @overload
    def __init__(self, red: float, green: float, blue: float, alpha: float = 1.0) -> None:
        """Color from sRGB and Alpha values

        Args:
            red (float): 0.0 <= red <= 1.0
            green (float): 0.0 <= green <= 1.0
            blue (float): 0.0 <= blue <= 1.0
            alpha (float, optional): 0.0 <= alpha <= 1.0. Defaults to 1.0
        """
    @overload
    def __init__(self, color_code: int, alpha: int = 255) -> None:
        """Color from a hexadecimal color code with an optional alpha value

        Args:
            color_code (hexadecimal int): 0xRRGGBB
            alpha (hexadecimal int): 0x00 <= alpha as hex <= 0xFF
        """
    def __iter__(self): ...
    def __copy__(self) -> Color:
        """Return copy of self"""
    def __deepcopy__(self, _memo) -> Color:
        """Return deepcopy of self"""
    @classmethod
    def categorical_set(cls, color_count: int, starting_hue: ColorLike | float = 0.0, alpha: float | Iterable[float] = 1.0) -> list[Color]:
        """Generate a palette of evenly spaced colors.

        Creates a list of visually distinct colors suitable for representing
        discrete categories (such as different parts, assemblies, or data
        series). Colors are evenly spaced around the hue circle and share
        consistent lightness and saturation levels, resulting in balanced
        perceptual contrast across all hues.

        Produces palettes similar in appearance to the **Tableau 10** and **D3
        Category10** color sets—both widely recognized standards in data
        visualization for their clarity and accessibility. These values have
        been empirically chosen to maintain consistent perceived brightness
        across hues while avoiding overly vivid or dark colors.

        Args:
            color_count (int): Number of colors to generate.
            starting_hue (ColorLike | float): Either a Color-like object or
                a hue value in the range [0.0, 1.0] that defines the starting color.
            alpha (float | Iterable[float]): Alpha value(s) for the colors. Can be a
                single float or an iterable of length `color_count`.

        Returns:
            list[Color]: List of generated colors.

        Raises:
            ValueError: If starting_hue is out of range or alpha length mismatch.
        """
ColorLike: TypeAlias = str | tuple[str, float | int] | tuple[float | int, float | int, float | int] | tuple[float | int, float | int, float | int, float | int] | int | tuple[int, int] | Color | Quantity_ColorRGBA

class GeomEncoder(json.JSONEncoder):
    '''
    A JSON encoder for build123d geometry objects.

    This class extends ``json.JSONEncoder`` to provide custom serialization for
    geometry objects such as Axis, Color, Location, Plane, and Vector. It converts
    each geometry object into a dictionary containing exactly one key that identifies
    the geometry type (e.g. ``"Axis"``, ``"Vector"``, etc.), paired with a tuple or
    list that represents the underlying data. Any other object types are handled by
    the standard encoder.

    The inverse decoding is performed by the ``geometry_hook`` static method, which
    expects the dictionary to have precisely one key from the known geometry types.
    It then uses a class registry (``CLASS_REGISTRY``) to look up and instantiate
    the appropriate class with the provided values.

    **Usage Example**::

        import json

        # Suppose we have some geometry objects:
        axis = Axis(position=(0, 0, 0), direction=(1, 0, 0))
        vector = Vector(0.0, 1.0, 2.0)

        data = {
            "my_axis": axis,
            "my_vector": vector
        }

        # Encode them to JSON:
        encoded_data = json.dumps(data, cls=GeomEncoder, indent=4)

        # Decode them back:
        decoded_data = json.loads(encoded_data, object_hook=GeomEncoder.geometry_hook)

    '''
    def default(self, o):
        """Return a JSON-serializable representation of a known geometry object."""
    @staticmethod
    def geometry_hook(json_dict):
        """Convert dictionaries back into geometry objects for decoding."""

class Location:
    """Location in 3D space. Depending on usage can be absolute or relative.

    This class wraps the TopLoc_Location class from OCCT. It can be used to move Shape
    objects in both relative and absolute manner. It is the preferred type to locate objects
    in build123d.

    Attributes:
        wrapped (TopLoc_Location): the OCP location object

    """
    @overload
    def __init__(self) -> None:
        """Location with no position or orientation"""
    @overload
    def __init__(self, location: Location) -> None:
        """Location from Location"""
    @overload
    def __init__(self, position: VectorLike, angle: float = 0) -> None:
        """Location from position and rotation around z-axis by optional angle"""
    @overload
    def __init__(self, position: VectorLike, orientation: RotationLike | None = None) -> None:
        """Location from position and optional orientation (see Rotation class)"""
    @overload
    def __init__(self, position: VectorLike, orientation: RotationLike, ordering: Extrinsic | Intrinsic) -> None:
        """Location from position and optional orientation (see Rotation class).
        Orientation determined by optional ordering, defaults to Intrinsic.XYZ
        """
    @overload
    def __init__(self, plane: Plane) -> None:
        """Location from location of Plane."""
    @overload
    def __init__(self, plane: Plane, plane_offset: VectorLike) -> None:
        """Location from location of Plane translated by plane_offset"""
    @overload
    def __init__(self, top_loc: TopLoc_Location) -> None:
        """Location from low-level TopLoc_Location object"""
    @overload
    def __init__(self, gp_trsf: gp_Trsf) -> None:
        """Location from low-level gp_Trsf object"""
    @overload
    def __init__(self, position: VectorLike, direction: VectorLike, angle: float) -> None:
        """Location from position and rotation around direction by angle"""
    @property
    def wrapped(self) -> TopLoc_Location:
        """OCP object"""
    @property
    def position(self) -> Vector:
        """Extract Position component of self

        Returns:
          Vector: Position part of Location

        """
    @position.setter
    def position(self, value: VectorLike):
        """Set the position component of this Location

        Args:
            value (VectorLike): New position
        """
    @property
    def orientation(self) -> Vector:
        """Extract orientation/rotation component of self

        Returns:
          Vector: orientation part of Location

        """
    @orientation.setter
    def orientation(self, rotation: VectorLike):
        """Set the orientation component of this Location

        Args:
            rotation (VectorLike): Intrinsic XYZ angles in degrees
        """
    @property
    def x_axis(self) -> Axis:
        """Default X axis when used as a plane"""
    @property
    def y_axis(self) -> Axis:
        """Default Y axis when used as a plane"""
    @property
    def z_axis(self) -> Axis:
        """Default Z axis when used as a plane"""
    def inverse(self) -> Location:
        """Inverted location"""
    def __copy__(self) -> Location:
        """Lib/copy.py shallow copy"""
    def __deepcopy__(self, _memo) -> Location:
        """Lib/copy.py deep copy"""
    @overload
    def __mul__(self, other: _ShapeT) -> _ShapeT: ...
    @overload
    def __mul__(self, other: Location) -> Location: ...
    @overload
    def __mul__(self, other: Iterable[Location]) -> list[Location]: ...
    def __pow__(self, exponent: int) -> Location: ...
    def __eq__(self, other: object) -> bool:
        """Compare Locations"""
    def __hash__(self) -> int:
        """Hash of Location"""
    def __iter__(self): ...
    def __neg__(self) -> Location:
        """Flip the orientation without changing the position operator -"""
    def __and__(self, other: Axis | Location | Plane | VectorLike | Shape) -> Vector | Location | None:
        """intersect axis with other &"""
    def center(self) -> Vector:
        """Return center of the location - useful for sorting"""
    def mirror(self, mirror_plane: Plane) -> Location:
        """
        Return a new Location mirrored across the given plane.

        This method reflects both the position and orientation of the current Location
        across the specified mirror_plane using affine vector mathematics.

        Due to the mathematical properties of reflection:
            - The true mirror of a right-handed coordinate system is a *left-handed* one.

        However, `build123d` requires all coordinate systems to be right-handed.
        Therefore, this implementation:
        - Reflects the X and Z directions across the mirror plane
        - Recomputes the Y direction as: `Y = X × Z`

        This ensures the resulting Location maintains a valid right-handed frame,
        while remaining as close as possible to the geometric mirror.

        Args:
            mirror_plane (Plane): The plane to mirror across.

        Returns:
            Location: A new mirrored Location that preserves right-handedness.
        """
    def to_axis(self) -> Axis:
        """Convert the location into an Axis"""
    def to_tuple(self) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
        """Convert the location to a translation, rotation tuple."""
    def __format__(self, spec) -> str:
        """Format Location"""
    @overload
    def intersect(self, vector: VectorLike) -> Vector | None:
        """Find intersection of location and vector"""
    @overload
    def intersect(self, location: Location) -> Vector | Location | None:
        """Find intersection of location and location"""
    @overload
    def intersect(self, axis: Axis) -> Vector | Location | None:
        """Find intersection of location and axis"""
    @overload
    def intersect(self, plane: Plane) -> Vector | Location | None:
        """Find intersection of location and plane"""
    @overload
    def intersect(self, shape: Shape) -> Shape | None:
        """Find intersection of location and shape"""

class LocationEncoder(json.JSONEncoder):
    '''Custom JSON Encoder for Location values

    Example:

    .. code::

        data_dict = {
            "part1": {
                "joint_one": Location((1, 2, 3), (4, 5, 6)),
                "joint_two": Location((7, 8, 9), (10, 11, 12)),
            },
            "part2": {
                "joint_one": Location((13, 14, 15), (16, 17, 18)),
                "joint_two": Location((19, 20, 21), (22, 23, 24)),
            },
        }
        json_object = json.dumps(data_dict, indent=4, cls=LocationEncoder)
        with open("sample.json", "w") as outfile:
            outfile.write(json_object)
        with open("sample.json", "r") as infile:
            copy_data_dict = json.load(infile, object_hook=LocationEncoder.location_hook)

    '''
    def default(self, o: Location) -> dict:
        """Return a serializable object"""
    @staticmethod
    def location_hook(obj) -> dict:
        """Convert Locations loaded from json to Location objects

        Example:
            read_json = json.load(infile, object_hook=LocationEncoder.location_hook)
        """

class OrientedBoundBox:
    """
    An Oriented Bounding Box

    This class computes the oriented bounding box for a given build123d shape.
    It exposes properties such as the center, principal axis directions, the
    extents along these axes, and the full diagonal length of the box.

    Note: The axes of the oriented bounding box are arbitrary and may not be
    consistent across platforms or time.
    """
    def __init__(self, shape: Bnd_OBB | Shape) -> None:
        """
        Create an oriented bounding box from either a precomputed Bnd_OBB or
        a build123d Shape (which wraps a TopoDS_Shape).

        Args:
            shape (Bnd_OBB | Shape): Either a precomputed Bnd_OBB or a build123d shape
                from which to compute the oriented bounding box.
        """
    @property
    def wrapped(self):
        """OCP object"""
    @property
    def corners(self) -> list[Vector]:
        """
        Compute and return the unique corner points of the oriented bounding box
        in the coordinate system defined by the OBB's plane.

        For degenerate shapes (e.g. a line or a planar face), only the unique
        points are returned. For 2D shapes the corners are returned in an order
        that allows a polygon to be directly created from them.

        Returns:
            list[Vector]: The unique corner points.
        """
    @property
    def diagonal(self) -> float:
        """
        The full length of the body diagonal of the oriented bounding box,
        which represents the maximum size of the object.

        Returns:
            float: The diagonal length.
        """
    @property
    def location(self) -> Location:
        """
        The Location of the center of the oriented bounding box.

        Returns:
            Location: center location
        """
    @property
    def plane(self) -> Plane:
        """
        The oriented coordinate system of the bounding box.

        Returns:
            Plane: The coordinate system defined by the center and primary
                   (X) and tertiary (Z) directions of the bounding box.
        """
    @property
    def size(self) -> Vector:
        """
        The full extents of the bounding box along its primary axes.

        Returns:
            Vector: The oriented size (full dimensions) of the box.
        """
    @property
    def x_direction(self) -> Vector:
        """
        The primary (X) direction of the oriented bounding box.

        Returns:
            Vector: The X direction as a unit vector.
        """
    @property
    def y_direction(self) -> Vector:
        """
        The secondary (Y) direction of the oriented bounding box.

        Returns:
            Vector: The Y direction as a unit vector.
        """
    @property
    def z_direction(self) -> Vector:
        """
        The tertiary (Z) direction of the oriented bounding box.

        Returns:
            Vector: The Z direction as a unit vector.
        """
    def center(self) -> Vector:
        """
        Compute and return the center point of the oriented bounding box.

        Returns:
            Vector: The center point of the box.
        """
    def is_completely_inside(self, other: OrientedBoundBox) -> bool:
        """
        Determine whether the given oriented bounding box is entirely contained
        within this bounding box.

        This method checks that every point of 'other' lies strictly within the
        boundaries of this box, according to the tolerance criteria inherent to the
        underlying OCCT implementation.

        Args:
            other (OrientedBoundBox): The bounding box to test for containment.

        Raises:
            ValueError: If the 'other' bounding box has an uninitialized (null) underlying geometry.

        Returns:
            bool: True if 'other' is completely inside this bounding box; otherwise, False.
        """
    def is_outside(self, point: Vector) -> bool:
        """
        Determine whether a given point lies entirely outside this oriented bounding box.

        A point is considered outside if it is neither inside the box nor on its surface,
        based on the criteria defined by the OCCT implementation.

        Args:
            point (Vector): The point to test.

        Raises:
            ValueError: If the point's underlying geometry is not set (null).

        Returns:
            bool: True if the point is completely outside the bounding box; otherwise, False.
        """

class Rotation(Location):
    """Subclass of Location used only for object rotation

    Attributes:
        X (float): rotation in degrees about X axis
        Y (float): rotation in degrees about Y axis
        Z (float): rotation in degrees about Z axis
        optionally specify rotation ordering with Intrinsic or Extrinsic enums,
            defaults to Intrinsic.XYZ

    """
    @overload
    def __init__(self, rotation: RotationLike, ordering: None) -> None:
        """Subclass of Location used only for object rotation
        ordering is for order of rotations in Intrinsic or Extrinsic enums"""
    @overload
    def __init__(self, X: float = 0, Y: float = 0, Z: float = 0, ordering: Extrinsic | Intrinsic = ...) -> None:
        """Subclass of Location used only for object rotation
        ordering is for order of rotations in Intrinsic or Extrinsic enums"""
Rot = Rotation
RotationLike: TypeAlias = Rotation | tuple[float, float, float]

class Pos(Location):
    """A position only sub-class of Location"""
    @overload
    def __init__(self, v: VectorLike) -> None:
        """Position by VectorLike"""
    @overload
    def __init__(self, v: Iterable) -> None:
        """Position by Vertex"""
    @overload
    def __init__(self, X: float = 0, Y: float = 0, Z: float = 0) -> None:
        """Position by X, Y, Z"""

class Matrix:
    '''A 3d , 4x4 transformation matrix.

    Used to move geometry in space.

    The provided "matrix" parameter may be None, a gp_GTrsf, or a nested list of
    values.

    If given a nested list, it is expected to be of the form:

        [[m11, m12, m13, m14],
         [m21, m22, m23, m24],
         [m31, m32, m33, m34]]

    A fourth row may be given, but it is expected to be: [0.0, 0.0, 0.0, 1.0]
    since this is a transform matrix.

    Attributes:
        wrapped (gp_GTrsf): the OCP transformation function
    '''
    @overload
    def __init__(self) -> None: ...
    @overload
    def __init__(self, trsf: gp_GTrsf | gp_Trsf) -> None: ...
    @overload
    def __init__(self, matrix: Sequence[Sequence[float]]) -> None: ...
    wrapped: Incomplete
    def rotate(self, axis: Axis, angle: float):
        """General rotate about axis by angle in degrees"""
    def inverse(self) -> Matrix:
        """Invert Matrix"""
    @overload
    def multiply(self, other: Vector) -> Vector: ...
    @overload
    def multiply(self, other: Matrix) -> Matrix: ...
    def transposed_list(self) -> Sequence[float]:
        """Needed by the cqparts gltf exporter"""
    def __copy__(self) -> Matrix:
        """Return copy of self"""
    def __deepcopy__(self, _memo) -> Matrix:
        """Return deepcopy of self"""
    def __getitem__(self, row_col: tuple[int, int]) -> float:
        """Provide Matrix[r, c] syntax for accessing individual values. The row
        and column parameters start at zero, which is consistent with most
        python libraries, but is counter to gp_GTrsf(), which is 1-indexed.
        """

class PlaneMeta(type):
    """Plane meta class to enable class properties"""
    @property
    def XY(cls) -> Plane:
        """XY Plane"""
    @property
    def YZ(cls) -> Plane:
        """YZ Plane"""
    @property
    def ZX(cls) -> Plane:
        """ZX Plane"""
    @property
    def XZ(cls) -> Plane:
        """XZ Plane"""
    @property
    def YX(cls) -> Plane:
        """YX Plane"""
    @property
    def ZY(cls) -> Plane:
        """ZY Plane"""
    @property
    def front(cls) -> Plane:
        """Front Plane"""
    @property
    def back(cls) -> Plane:
        """Back Plane"""
    @property
    def left(cls) -> Plane:
        """Left Plane"""
    @property
    def right(cls) -> Plane:
        """Right Plane"""
    @property
    def top(cls) -> Plane:
        """Top Plane"""
    @property
    def bottom(cls) -> Plane:
        """Bottom Plane"""
    @property
    def isometric(cls) -> Plane:
        """Isometric Plane"""

class Plane(metaclass=PlaneMeta):
    '''Plane

    A plane is positioned in space with a coordinate system such that the plane is defined by
    the origin, x_dir (X direction), y_dir (Y direction), and z_dir (Z direction) of this coordinate
    system, which is the "local coordinate system" of the plane. The z_dir is a vector normal to the
    plane. The coordinate system is right-handed.

    A plane allows the use of local 2D coordinates, which are later converted to
    global, 3d coordinates when the operations are complete.

    Planes can be created from faces as workplanes for feature creation on objects.

    =========   ====== ======== ========
    Name        x_dir  y_dir    z_dir
    =========   ====== ======== ========
    XY           +x     +y       +z
    YZ           +y     +z       +x
    ZX           +z     +x       +y
    XZ           +x     +z       -y
    YX           +y     +x       -z
    ZY           +z     +y       -x
    front        +x     +z       -y
    back         -x     +z       +y
    left         -y     +z       -x
    right        +y     +z       +x
    top          +x     +y       +z
    bottom       +x     -y       -z
    isometric    +x+y   -x+y+z   +x+y-z
    =========   ====== ======== ========

    Args:
        gp_pln (gp_Pln): an OCCT plane object
        origin (tuple[float, float, float] | Vector): the origin in global coordinates
        x_dir (tuple[float, float, float] | Vector | None): an optional vector
            representing the X Direction. Defaults to None.
        y_dir (tuple[float, float, float] | Vector | None): optional Y direction.
            Mutually exclusive with z_dir. Requires x_dir.
        z_dir (tuple[float, float, float] | Vector | None): the normal direction
            for the plane. Defaults to (0, 0, 1).

    Attributes:
        origin (Vector): global position of local (0,0,0) point
        x_dir (Vector): x direction
        y_dir (Vector): y direction
        z_dir (Vector): z direction
        forward_transform (Matrix): forward location transformation matrix
        reverse_transform (Matrix): reverse location transformation matrix
        wrapped (gp_Pln): the OCP plane object

    Raises:
        ValueError: z_dir must be non null
        ValueError: y_dir must be non null
        ValueError: x_dir must be non null
        ValueError: the specified x_dir is not orthogonal to the provided normal
        ValueError: x_dir and y_dir must not be parallel
        ValueError: the specified x_dir is not orthogonal to the provided normal

    Returns:
        Plane: A plane

    '''
    @staticmethod
    def get_topods_face_normal(face: TopoDS_Face) -> Vector:
        """Find the normal at the center of a TopoDS_Face"""
    @overload
    def __init__(self, gp_pln: gp_Pln) -> None:
        """Return a plane from a OCCT gp_pln"""
    @overload
    def __init__(self, points: Iterable[VectorLike]) -> None:
        """Return a plane defined by three points"""
    @overload
    def __init__(self, origin: VectorLike, x_dir: VectorLike | None = None, z_dir: VectorLike = (0, 0, 1)) -> None:
        """Return a new plane at origin with x_dir and z_dir"""
    @overload
    def __init__(self, origin: VectorLike, x_dir: VectorLike, *, y_dir: VectorLike) -> None:
        """Return a new plane at origin with x_dir and y_dir"""
    @overload
    def __init__(self, face: Face, x_dir: VectorLike | None = None) -> None:
        """Return a plane extending the face.
        Note: for non planar face this will return the underlying work plane"""
    @overload
    def __init__(self, location: Location) -> None:
        """Return a plane aligned with a given location"""
    @overload
    def __init__(self, axis: Axis, x_dir: VectorLike | None = None) -> None:
        """Return a plane with the z_dir aligned with the axis and optional x_dir direction"""
    @property
    def wrapped(self) -> gp_Pln:
        """The OCP object"""
    def offset(self, amount: float) -> Plane:
        """Move the Plane by amount in the direction of z_dir"""
    def __copy__(self) -> Plane:
        """Return copy of self"""
    def __deepcopy__(self, _memo) -> Plane:
        """Return deepcopy of self"""
    def __eq__(self, other: object):
        """Are planes equal operator =="""
    def __hash__(self) -> int:
        """Hash of Plane"""
    def __neg__(self) -> Plane:
        """Reverse z direction of plane operator -"""
    @overload
    def __mul__(self, other: _ShapeT) -> _ShapeT: ...
    @overload
    def __mul__(self, other: Location | Plane) -> Location: ...
    @overload
    def __mul__(self, other: Iterable[Location | Plane]) -> list[Location]: ...
    @overload
    def __rmul__(self, other: Location) -> Plane: ...
    @overload
    def __rmul__(self, other: Iterable[Location | Plane]) -> list[Plane]: ...
    def __and__(self, other: Axis | Location | Plane | VectorLike | Shape):
        """intersect plane with other &"""
    def __format__(self, spec) -> str:
        """Format Plane"""
    def reverse(self) -> Plane:
        """Reverse z direction of plane"""
    @property
    def origin(self) -> Vector:
        """global position of local (0,0,0) point"""
    @origin.setter
    def origin(self, value: VectorLike):
        """Set the Plane origin"""
    @property
    def z_dir(self) -> Vector:
        """Local Z direction normal to the plane."""
    @property
    def x_dir(self) -> Vector:
        """Local X direction of the plane."""
    @x_dir.setter
    def x_dir(self, direction: VectorLike):
        """Set the local X direction of the plane."""
    @property
    def y_dir(self) -> Vector:
        """Local Y direction of the plane."""
    @y_dir.setter
    def y_dir(self, direction: VectorLike):
        """Set the local Y direction of the plane."""
    def shift_origin(self, locator: Axis | VectorLike | Vertex) -> Plane:
        """shift plane origin

        Creates a new plane with the origin moved within the plane to the point of intersection
        of the axis or at the given Vertex. The plane's x_dir and z_dir are unchanged.

        Args:
            locator (Axis | VectorLike | Vertex): Either Axis that intersects the new
                plane origin or Vertex within Plane.

        Raises:
            ValueError: Vertex isn't within plane
            ValueError: Point isn't within plane
            ValueError: Axis doesn't intersect plane

        Returns:
            Plane: plane with new origin

        """
    def rotated(self, rotation: VectorLike = (0, 0, 0), ordering: Extrinsic | Intrinsic | None = None) -> Plane:
        """Returns a copy of this plane, rotated about the specified axes

        The origin of the workplane is unaffected by the rotation.

        Rotations are done in order x, y, z. If you need a different order,
        specify ordering. e.g. Intrinsic.ZYX changes rotation to
        (z angle, y angle, x angle) and rotates in that order.

        Args:
            rotation (VectorLike, optional): (x angle, y angle, z angle).
                Defaults to (0, 0, 0)
            ordering (Intrinsic |  Extrinsic, optional): order of rotations in
                Intrinsic or Extrinsic rotation mode. Defaults to Intrinsic.XYZ

        Returns:
            Plane: a copy of this plane rotated as requested.
        """
    def moved(self, loc: Location | Plane) -> Plane:
        """Change the position & orientation of a copy of self by applying a relative location

        Args:
            loc (Location | Plane): relative change

        Returns:
            Plane: relocated plane
        """
    def move(self, loc: Location | Plane) -> Plane:
        """Change the position & orientation of self by applying a relative location

        Args:
            loc (Location | Plane): relative change

        Returns:
            Plane: relocated self
        """
    @property
    def forward_transform(self):
        """forward location transformation matrix"""
    @property
    def reverse_transform(self):
        """reverse location transformation matrix"""
    @property
    def location(self) -> Location:
        """Return Location representing the origin and z direction"""
    def to_gp_ax3(self) -> gp_Ax3:
        """Return gp_Ax3 version of the plane"""
    def to_gp_ax2(self) -> gp_Ax2:
        """Return gp_Ax2 version of the plane"""
    def to_local_coords(self, obj: VectorLike | Any | BoundBox):
        """Reposition the object relative to this plane

        Args:
            obj: VectorLike |  Shape |  BoundBox an object to reposition. Note that
            type Any refers to all topological classes.

        Returns:
            an object of the same type, but repositioned to local coordinates

        """
    def from_local_coords(self, obj: tuple | Vector | Any | BoundBox):
        """Reposition the object relative from this plane

        Args:
            obj: VectorLike |  Shape |  BoundBox an object to reposition. Note that
            type Any refers to all topological classes.

        Returns:
            an object of the same type, but repositioned to world coordinates

        """
    def location_between(self, other: Plane) -> Location:
        """Return a location representing the translation from self to other"""
    def contains(self, obj: VectorLike | Axis, tolerance: float = ...) -> bool:
        """contains

        Is this point or Axis fully contained in this plane?

        Args:
            obj (VectorLike | Axis): point or Axis to  evaluate
            tolerance (float, optional): comparison tolerance. Defaults to TOLERANCE.

        Returns:
            bool: self contains point or Axis

        """
    @overload
    def intersect(self, vector: VectorLike) -> Vector | None:
        """Find intersection of plane and vector"""
    @overload
    def intersect(self, location: Location) -> Vector | Location | None:
        """Find intersection of plane and location"""
    @overload
    def intersect(self, axis: Axis) -> Vector | Axis | None:
        """Find intersection of plane and axis"""
    @overload
    def intersect(self, plane: Plane) -> Axis | Plane | None:
        """Find intersection of plane and plane"""
    @overload
    def intersect(self, shape: Shape) -> Shape | None:
        """Find intersection of plane and shape"""

CLASS_REGISTRY: Incomplete

def to_align_offset(min_point: VectorLike, max_point: VectorLike, align: Align2D | Align3D, center: VectorLike | None = None) -> Vector:
    """Amount to move object to achieve the desired alignment"""

class NotAllLocationLikeError(TypeError):
    """Raised when an iterable contains objects that cannot be converted to Locations.

    The exception message lists the unique type names of the invalid objects.
    """
    def __init__(self, wrong_types: Iterable[type[Any]]) -> None: ...

def all_location_like(items: Iterable[Any]) -> list[Location | Plane]:
    """Returns the items as a list unless any of them is not an instance of `Location | Plane`.
    Otherwise raises `NotAllLocationLikeError`."""
