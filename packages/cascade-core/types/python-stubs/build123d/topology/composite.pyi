from .one_d import Edge as Edge, Mixin1D as Mixin1D, Wire as Wire
from .shape_core import Joint as Joint, Shape as Shape, ShapeList as ShapeList, downcast as downcast, shapetype as shapetype, topods_dim as topods_dim
from .three_d import Mixin3D as Mixin3D, Solid as Solid
from .two_d import Face as Face, Shell as Shell
from .utils import tuplify as tuplify, unwrapped_shapetype as unwrapped_shapetype
from .zero_d import Vertex as Vertex
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common as BRepAlgoAPI_Common, BRepAlgoAPI_Section as BRepAlgoAPI_Section
from OCP.TopoDS import TopoDS_Compound, TopoDS_Shape as TopoDS_Shape
from _typeshed import Incomplete
from build123d.build_enums import Align as Align, CenterOf as CenterOf, FontStyle as FontStyle, TextAlign as TextAlign
from build123d.geometry import Axis as Axis, Color as Color, Location as Location, Plane as Plane, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike, logger as logger
from build123d.text import FONT_ASPECT as FONT_ASPECT, FontManager as FontManager
from collections.abc import Iterable, Iterator, Sequence
from os import PathLike
from typing_extensions import Self

class Compound(Mixin3D[TopoDS_Compound]):
    """A Compound in build123d is a topological entity representing a collection of
    geometric shapes grouped together within a single structure. It serves as a
    container for organizing diverse shapes like edges, faces, or solids. This
    hierarchical arrangement facilitates the construction of complex models by
    combining simpler shapes. Compound plays a pivotal role in managing the
    composition and structure of intricate 3D models in computer-aided design
    (CAD) applications, allowing engineers and designers to work with assemblies
    of shapes as unified entities for efficient modeling and analysis."""
    order: float
    material: Incomplete
    joints: Incomplete
    children: Incomplete
    def __init__(self, obj: TopoDS_Compound | Iterable[Shape] | None = None, label: str = '', color: Color | None = None, material: str = '', joints: dict[str, Joint] | None = None, parent: Compound | None = None, children: Sequence[Shape] | None = None) -> None:
        """Build a Compound from Shapes

        Args:
            obj (TopoDS_Compound | Iterable[Shape], optional): OCCT Compound or shapes
            label (str, optional): Defaults to ''.
            color (Color, optional): Defaults to None.
            material (str, optional): tag for external tools. Defaults to ''.
            joints (dict[str, Joint], optional): names joints. Defaults to None.
            parent (Compound, optional): assembly parent. Defaults to None.
            children (Sequence[Shape], optional): assembly children. Defaults to None.
        """
    @property
    def volume(self) -> float:
        """volume - the volume of this Compound"""
    @classmethod
    def cast(cls, obj: TopoDS_Shape) -> Vertex | Edge | Wire | Face | Shell | Solid | Compound:
        """Returns the right type of wrapper, given a OCCT object"""
    @classmethod
    def extrude(cls, obj: Shell, direction: VectorLike) -> Compound:
        """extrude

        Extrude a Shell into a Compound.

        Args:
            direction (VectorLike): direction and magnitude of extrusion

        Raises:
            ValueError: Unsupported class
            RuntimeError: Generated invalid result

        Returns:
            Edge: extruded shape
        """
    @classmethod
    def make_text(cls, txt: str, font_size: float, font: str = 'Arial', font_path: PathLike[str] | str | None = None, font_style: FontStyle = ..., text_align: tuple[TextAlign, TextAlign] = ..., align: Align | tuple[Align, Align] | None = None, position_on_path: float = 0.0, text_path: Edge | Wire | None = None, single_line_width: float = 0.0) -> Compound:
        '''Text that optionally follows a path.

        The text that is created can be combined as with other sketch features by specifying
        a mode or rotated by the given angle. In addition, edges have been previously created
        with arc or segment, the text will follow the path defined by these edges. The start
        parameter can be used to shift the text along the path to achieve precise positioning.

        Args:
            txt (str): text to render
            font_size (float): size of the font in model units
            font (str, optional): font name. Defaults to "Arial"
            font_path (PathLike | str, optional): system path to font file. Defaults to None
            font_style (Font_Style, optional): font style, REGULAR, BOLD, BOLDITALIC, or
                ITALIC. Defaults to Font_Style.REGULAR
            text_align (tuple[TextAlign, TextAlign], optional): horizontal text align
                LEFT, CENTER, or RIGHT. Vertical text align BOTTOM, CENTER, TOP, or
                TOPFIRSTLINE. Defaults to (TextAlign.CENTER, TextAlign.CENTER)
            align (Align | tuple[Align, Align], optional): align MIN, CENTER, or MAX of
                object. Defaults to None
            position_on_path (float, optional): the relative location on path to position
                the text, values must be between 0.0 and 1.0. Defaults to 0.0
            text_path: (Edge | Wire, optional): path for text to follow. Defaults to None
                Compound object containing multiple Shapes representing the text
            single_line_width (float): width of outlined single line font.
                Defaults to 0.0

        Examples::

            fox = Compound.make_text(
                txt="The quick brown fox jumped over the lazy dog",
                font_size=10,
                position_on_path=0.1,
                text_path=jump_edge,
            )

        '''
    @classmethod
    def make_triad(cls, axes_scale: float) -> Compound:
        """The coordinate system triad (X, Y, Z axes)"""
    def __add__(self, other: None | Shape | Iterable[Shape]) -> Compound | Wire:
        """Combine other to self `+` operator

        Note that if all of the objects are connected Edges/Wires the result
        will be a Wire, otherwise a Shape.
        """
    def __and__(self, other: Shape | Iterable[Shape]) -> Compound:
        """Intersect other to self `&` operator"""
    def __bool__(self) -> bool:
        """
        Check if empty.
        """
    def __iter__(self) -> Iterator[Shape]:
        """
        Iterate over subshapes.

        """
    def __len__(self) -> int:
        """Return the number of subshapes"""
    def __sub__(self, other: None | Shape | Iterable[Shape]) -> Compound:
        """Cut other to self `-` operator"""
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
    def compound(self) -> Compound:
        """Return the Compound"""
    def compounds(self) -> ShapeList[Compound]:
        """compounds - all the compounds in this Shape"""
    def do_children_intersect(self, include_parent: bool = False, tolerance: float = 1e-05) -> tuple[bool, tuple[Shape | None, Shape | None], float]:
        """Do Children Intersect

        Determine if any of the child objects within a Compound/assembly intersect by
        intersecting each of the shapes with each other and checking for
        a common volume.

        Args:
            include_parent (bool, optional): check parent for intersections. Defaults to False.
            tolerance (float, optional): maximum allowable volume difference. Defaults to 1e-5.

        Returns:
            tuple[bool, tuple[Shape, Shape], float]:
                do the object intersect, intersecting objects, volume of intersection
        """
    def get_type(self, obj_type: type[Vertex] | type[Edge] | type[Face] | type[Shell] | type[Solid] | type[Wire]) -> list[Vertex | Edge | Face | Shell | Solid | Wire]:
        """get_type

        Extract the objects of the given type from a Compound. Note that this
        isn't the same as Faces() etc. which will extract Faces from Solids.

        Args:
            obj_type (Union[Vertex, Edge, Face, Shell, Solid, Wire]): Object types to extract

        Returns:
            list[Union[Vertex, Edge, Face, Shell, Solid, Wire]]: Extracted objects
        """
    def touch(self, other: Shape, tolerance: float = 1e-06) -> ShapeList[Vertex | Edge | Face]:
        """Distribute touch over compound elements.

        Iterates over elements and collects touch results. Only Solid and
        Face elements produce boundary contacts; other shapes return empty.

        Args:
            other: Shape to check boundary contacts with
            tolerance: tolerance for contact detection

        Returns:
            ShapeList of boundary contact geometry (empty if no contact)
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
    def unwrap(self, fully: bool = True) -> Self | Shape:
        """Strip unnecessary Compound wrappers

        Args:
            fully (bool, optional): return base shape without any Compound
                wrappers (otherwise one Compound is left). Defaults to True.

        Returns:
            Union[Self, Shape]: base shape
        """

class Curve(Compound):
    """A Compound containing 1D objects - aka Edges"""
    __add__: Incomplete
    def __matmul__(self, position: float) -> Vector:
        """Position on curve operator @ - only works if continuous"""
    def __mod__(self, position: float) -> Vector:
        """Tangent on wire operator % - only works if continuous"""
    def __xor__(self, position: float) -> Location:
        """Location on wire operator ^ - only works if continuous"""
    def wires(self) -> ShapeList[Wire]:
        """A list of wires created from the edges"""

class Sketch(Compound):
    """A Compound containing 2D objects - aka Faces"""
    def __iadd__(self, other: None | Shape | Iterable[Shape]) -> Sketch: ...

class Part(Compound):
    """A Compound containing 3D objects - aka Solids"""
    def __iadd__(self, other: None | Shape | Iterable[Shape]) -> Part: ...
