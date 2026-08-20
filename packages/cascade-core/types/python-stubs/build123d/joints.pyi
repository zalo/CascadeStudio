from _typeshed import Incomplete
from build123d.build_common import validate_inputs as validate_inputs
from build123d.build_enums import Align as Align
from build123d.build_part import BuildPart as BuildPart
from build123d.geometry import Axis as Axis, Location as Location, Plane as Plane, Rotation as Rotation, RotationLike as RotationLike, Vector as Vector, VectorLike as VectorLike
from build123d.topology import Compound as Compound, Edge as Edge, Joint as Joint, Solid as Solid
from typing import overload

class RigidJoint(Joint):
    """RigidJoint

    A rigid joint fixes two components to one another.

    Args:
        label (str): joint label
        to_part (Union[Solid, Compound], optional): object to attach joint to
        joint_location (Location): global location of joint

    Attributes:
        relative_location (Location): joint location relative to bound object

    """
    @property
    def location(self) -> Location:
        """Location of joint"""
    @property
    def symbol(self) -> Compound:
        """A CAD symbol (XYZ indicator) as bound to part"""
    relative_location: Incomplete
    def __init__(self, label: str, to_part: Solid | Compound | None = None, joint_location: Location | None = None) -> None: ...
    @overload
    def connect_to(self, other: BallJoint, *, angles: RotationLike | None = None, **kwargs):
        """Connect RigidJoint and BallJoint"""
    @overload
    def connect_to(self, other: CylindricalJoint, *, position: float | None = None, angle: float | None = None):
        """Connect RigidJoint and CylindricalJoint"""
    @overload
    def connect_to(self, other: LinearJoint, *, position: float | None = None):
        """Connect RigidJoint and LinearJoint"""
    @overload
    def connect_to(self, other: RevoluteJoint, *, angle: float | None = None):
        """Connect RigidJoint and RevoluteJoint"""
    @overload
    def connect_to(self, other: RigidJoint):
        """Connect two RigidJoints together"""
    @overload
    def relative_to(self, other: BallJoint, *, angles: RotationLike | None = None):
        """RigidJoint relative to BallJoint"""
    @overload
    def relative_to(self, other: CylindricalJoint, *, position: float | None = None, angle: float | None = None):
        """RigidJoint relative to CylindricalJoint"""
    @overload
    def relative_to(self, other: LinearJoint, *, position: float | None = None):
        """RigidJoint relative to LinearJoint"""
    @overload
    def relative_to(self, other: RevoluteJoint, *, angle: float | None = None):
        """RigidJoint relative to RevoluteJoint"""
    @overload
    def relative_to(self, other: RigidJoint):
        """Connect two RigidJoints together"""

class RevoluteJoint(Joint):
    """RevoluteJoint

    Component rotates around axis like a hinge.

    Args:
        label (str): joint label
        to_part (Union[Solid, Compound], optional): object to attach joint to
        axis (Axis): axis of rotation
        angle_reference (VectorLike, optional): direction normal to axis defining where
            angles will be measured from. Defaults to None.
        range (tuple[float, float], optional): (min,max) angle of joint. Defaults to (0, 360).

    Attributes:
        angle (float): angle of joint
        angle_reference (Vector): reference for angular positions
        angular_range (tuple[float,float]): min and max angular position of joint
        relative_axis (Axis): joint axis relative to bound part

    Raises:
        ValueError: angle_reference must be normal to axis
    """
    @property
    def location(self) -> Location:
        """Location of joint"""
    @property
    def symbol(self) -> Compound:
        """A CAD symbol representing the axis of rotation as bound to part"""
    angular_range: Incomplete
    angle_reference: Incomplete
    relative_axis: Incomplete
    def __init__(self, label: str, to_part: Solid | Compound | None = None, axis: Axis = ..., angle_reference: VectorLike | None = None, angular_range: tuple[float, float] = (0, 360)) -> None: ...
    def connect_to(self, other: RigidJoint, *, angle: float | None = None):
        """Connect RevoluteJoint and RigidJoint

        Args:
            other (RigidJoint): relative to joint
            angle (float, optional): angle in degrees. Defaults to range min.

        Returns:
            TypeError: other must of type RigidJoint
            ValueError: angle out of range
        """
    def relative_to(self, other: RigidJoint, *, angle: float | None = None):
        """Relative location of RevoluteJoint to RigidJoint

        Args:
            other (RigidJoint): relative to joint
            angle (float, optional): angle in degrees. Defaults to range min.

        Raises:
            TypeError: other must of type RigidJoint
            ValueError: angle out of range
        """

class LinearJoint(Joint):
    """LinearJoint

    Component moves along a single axis.

    Args:
        label (str): joint label
        to_part (Union[Solid, Compound], optional): object to attach joint to
        axis (Axis): axis of linear motion
        range (tuple[float, float], optional): (min,max) position of joint.
            Defaults to (0, inf).

    Attributes:
        axis (Axis): joint axis
        angle (float): angle of joint
        linear_range (tuple[float,float]): min and max positional values
        position (float): joint position
        relative_axis (Axis): joint axis relative to bound part

    """
    @property
    def location(self) -> Location:
        """Location of joint"""
    @property
    def symbol(self) -> Compound:
        """A CAD symbol of the linear axis positioned relative to_part"""
    axis: Incomplete
    linear_range: Incomplete
    position: Incomplete
    relative_axis: Incomplete
    angle: Incomplete
    def __init__(self, label: str, to_part: Solid | Compound | None = None, axis: Axis = ..., linear_range: tuple[float, float] = ...) -> None: ...
    @overload
    def connect_to(self, other: RevoluteJoint, *, position: float | None = None, angle: float | None = None):
        """Connect LinearJoint and RevoluteJoint"""
    @overload
    def connect_to(self, other: RigidJoint, *, position: float | None = None):
        """Connect LinearJoint and RigidJoint"""
    @overload
    def relative_to(self, other: RigidJoint, *, position: float | None = None):
        """Relative location of LinearJoint to RigidJoint"""
    @overload
    def relative_to(self, other: RevoluteJoint, *, position: float | None = None, angle: float | None = None):
        """Relative location of LinearJoint to RevoluteJoint"""

class CylindricalJoint(Joint):
    """CylindricalJoint

    Component rotates around and moves along a single axis like a screw.

    Args:
        label (str): joint label
        to_part (Union[Solid, Compound], optional): object to attach joint to
        axis (Axis): axis of rotation and linear motion
        angle_reference (VectorLike, optional): direction normal to axis defining where
            angles will be measured from. Defaults to None.
        linear_range (tuple[float, float], optional): (min,max) position of joint.
            Defaults to (0, inf).
        angular_range (tuple[float, float], optional): (min,max) angle of joint.
            Defaults to (0, 360).

    Attributes:
        axis (Axis): joint axis
        linear_position (float): linear joint position
        rotational_position (float): revolute joint angle in degrees
        angle_reference (Vector): reference for angular positions
        angular_range (tuple[float,float]): min and max angular position of joint
        linear_range (tuple[float,float]): min and max positional values
        relative_axis (Axis): joint axis relative to bound part
        position (float): joint position
        angle (float): angle of joint

    Raises:
        ValueError: angle_reference must be normal to axis
    """
    @property
    def location(self) -> Location:
        """Location of joint"""
    @property
    def symbol(self) -> Compound:
        """A CAD symbol representing the cylindrical axis as bound to part"""
    axis: Incomplete
    linear_position: Incomplete
    rotational_position: Incomplete
    angle_reference: Incomplete
    angular_range: Incomplete
    linear_range: Incomplete
    relative_axis: Incomplete
    position: float | None
    angle: float | None
    def __init__(self, label: str, to_part: Solid | Compound | None = None, axis: Axis = ..., angle_reference: VectorLike | None = None, linear_range: tuple[float, float] = ..., angular_range: tuple[float, float] = (0, 360)) -> None: ...
    def connect_to(self, other: RigidJoint, *, position: float | None = None, angle: float | None = None):
        '''Connect CylindricalJoint and RigidJoint"

        Args:
            other (Joint): joint to connect to
            position (float, optional): linear position. Defaults to linear range min.
            angle (float, optional): angle in degrees. Defaults to range min.

        Raises:
            TypeError: other must be of type RigidJoint
            ValueError: position out of range
            ValueError: angle out of range
        '''
    def relative_to(self, other: RigidJoint, *, position: float | None = None, angle: float | None = None):
        """Relative location of CylindricalJoint to RigidJoint

        Args:
            other (Joint): joint to connect to
            position (float, optional): linear position. Defaults to linear range min.
            angle (float, optional): angle in degrees. Defaults to range min.

        Raises:
            TypeError: other must be of type RigidJoint
            ValueError: position out of range
            ValueError: angle out of range
        """

class BallJoint(Joint):
    """BallJoint

    A component rotates around all 3 axes using a gimbal system (3 nested rotations).

    Args:
        label (str): joint label
        to_part (Union[Solid, Compound], optional): object to attach joint to
        joint_location (Location): global location of joint
        angular_range
            (tuple[ tuple[float, float], tuple[float, float], tuple[float, float] ], optional):
            X, Y, Z angle (min, max) pairs. Defaults to ((0, 360), (0, 360), (0, 360)).
        angle_reference (Plane, optional): plane relative to part defining zero degrees of
            rotation. Defaults to Plane.XY.

    Attributes:
        relative_location (Location): joint location relative to bound part
        angular_range
            (tuple[ tuple[float, float], tuple[float, float], tuple[float, float] ]):
            X, Y, Z angle (min, max) pairs.
        angle_reference (Plane): plane relative to part defining zero degrees of

    """
    @property
    def location(self) -> Location:
        """Location of joint"""
    @property
    def symbol(self) -> Compound:
        """A CAD symbol representing joint as bound to part"""
    relative_location: Incomplete
    angular_range: Incomplete
    angle_reference: Incomplete
    def __init__(self, label: str, to_part: Solid | Compound | None = None, joint_location: Location | None = None, angular_range: tuple[tuple[float, float], tuple[float, float], tuple[float, float]] = ((0, 360), (0, 360), (0, 360)), angle_reference: Plane = ...) -> None: ...
    def connect_to(self, other: RigidJoint, *, angles: RotationLike | None = None):
        """Connect BallJoint and RigidJoint

        Args:
            other (RigidJoint): joint to connect to
            angles (RotationLike, optional): angles about axes in degrees. Defaults to
                range minimums.

        Raises:
            TypeError: invalid other joint type
            ValueError: angles out of range
        """
    def relative_to(self, other: RigidJoint, *, angles: RotationLike | None = None):
        """relative_to - BallJoint

        Return the relative location from this joint to the RigidJoint of another object

        Args:
            other (RigidJoint): joint to connect to
            angles (RotationLike, optional): angles about axes in degrees. Defaults to
                range minimums.

        Raises:
            TypeError: invalid other joint type
            ValueError: angles out of range
        """
