from .kernel import list_shapes as list_shapes
from OCP.BRepAlgoAPI import BRepAlgoAPI_BuilderAlgo as BRepAlgoAPI_BuilderAlgo
from OCP.BRepBuilderAPI import BRepBuilderAPI_Sewing as BRepBuilderAPI_Sewing
from OCP.BRepTools import BRepTools_History
from OCP.ShapeUpgrade import ShapeUpgrade_UnifySameDomain as ShapeUpgrade_UnifySameDomain
from OCP.TopoDS import TopoDS_Shape as TopoDS_Shape
from OCP.collections import List_TopoDS_Shape as List_TopoDS_Shape
from _typeshed import Incomplete
from collections.abc import Callable as Callable, Iterable
from typing import Protocol
from typing_extensions import Self

TRACKED_TYPES: Incomplete

class MakeShapeLike(Protocol):
    """The history interface every BRepBuilderAPI_MakeShape descendant has."""
    def Generated(self, shape: TopoDS_Shape, /) -> List_TopoDS_Shape: ...
    def Modified(self, shape: TopoDS_Shape, /) -> List_TopoDS_Shape: ...

def tracked_subshapes(shapes: Iterable[TopoDS_Shape]) -> list[TopoDS_Shape]:
    """Every distinct vertex, edge, face and solid of the given shapes."""

class ShapeHistory:
    """The record of what an operation did to its inputs' sub-shapes.

    Each tracked sub-shape of an input ends up in one of four states in the
    result: untouched (it is still there, unchanged), modified (rebuilt into
    one or more sub-shapes of the same kind), generating (a sub-shape of
    another kind was made from it, as a face is made from an edge by an
    extrusion) or removed. Booleans and ``ShapeUpgrade_UnifySameDomain``
    hand over a complete record; other algorithms answer per sub-shape and
    :meth:`from_algorithm` collects those answers.

    Records chain with :meth:`merge`, so that after a fuse and a clean a face
    of the original input still maps to the face it became.

    A record also knows which inputs were already there (``before``) and which
    the operation brought in (``brought``): for ``a + b`` the argument and the
    tool. That is what lets a sub-shape of the result be classified as last or
    new, see :meth:`is_last` and :meth:`is_new`.
    """
    wrapped: Incomplete
    before: list[TopoDS_Shape]
    brought: list[TopoDS_Shape]
    def __init__(self, history: BRepTools_History | None = None, before: Iterable[TopoDS_Shape] = (), brought: Iterable[TopoDS_Shape] = ()) -> None: ...
    @classmethod
    def from_boolean(cls, operation: BRepAlgoAPI_BuilderAlgo, before: Iterable[TopoDS_Shape] = (), brought: Iterable[TopoDS_Shape] = ()) -> ShapeHistory:
        """The record a boolean operation (or splitter) kept while building."""
    @classmethod
    def from_unify(cls, upgrader: ShapeUpgrade_UnifySameDomain) -> ShapeHistory:
        """The record of a ``clean``."""
    @classmethod
    def from_algorithm(cls, algorithm: MakeShapeLike, inputs: Iterable[TopoDS_Shape], result: TopoDS_Shape) -> ShapeHistory:
        """Collect the per-sub-shape answers of a ``BRepBuilderAPI_MakeShape``.

        ``IsDeleted`` is not consulted: several algorithms answer it for the
        sub-shape kinds they track and guess for the rest, so a sub-shape is
        removed when it is neither still in ``result`` nor modified into
        something that is. An algorithm that raises when asked about a kind it
        does not track (``BRepFilletAPI_MakeFillet2d`` only answers for edges)
        is taken to have no answer for it.
        """
    @classmethod
    def from_sewing(cls, sewing: BRepBuilderAPI_Sewing, inputs: Iterable[TopoDS_Shape]) -> ShapeHistory:
        """The record of sewing faces into a shell.

        Sewing reports faces it rebuilt through ``Modified`` and the edges and
        vertices it merged through ``ModifiedSubShape``; a face it dropped as a
        duplicate is neither, and is recorded as removed.
        """
    @classmethod
    def from_relocation(cls, before: TopoDS_Shape, after: TopoDS_Shape) -> ShapeHistory:
        """The record of moving a shape: each sub-shape modified into its moved self.

        A move keeps every TShape and changes only Locations, so the pairing is
        by TShape. Sub-shapes whose Location did not change are left untouched.
        """
    @classmethod
    def of(cls, *shapes: object) -> ShapeHistory | None:
        """The records the given shapes carry from the operations that made them,
        merged into one, or None if none of them carries one.

        A ``Shape`` made by an operation that records holds the record as
        ``_history``; anything else, including a list of shapes, is looked
        through for shapes that do.
        """
    def add_modified(self, before: TopoDS_Shape, after: TopoDS_Shape) -> Self:
        """Record that ``before`` was rebuilt into ``after``.

        For what an algorithm did but does not say: ``BRepFilletAPI_MakeFillet2d``
        rebuilds the face it works on without reporting it.
        """
    def merge(self, later: ShapeHistory | None) -> Self:
        """Extend this record with the operation that came after it."""
    def with_inputs(self, before: Iterable[TopoDS_Shape], brought: Iterable[TopoDS_Shape]) -> Self:
        """Say which inputs were already there and which were brought in."""
    def is_last(self, shape: TopoDS_Shape) -> bool:
        """Did the operation bring this sub-shape of the result in, or create it?

        A sub-shape that descends from something brought in, untouched or
        rebuilt, is last, including one that also descends from what was there
        before, such as the vertex a new edge shares with an old one. One that
        descends only from what was there before is not. One the record cannot
        attribute to any input is new, and so last.
        """
    def is_new(self, shape: TopoDS_Shape) -> bool:
        """Did this sub-shape of the result exist in no input, in any form?"""
    def modified(self, shape: TopoDS_Shape) -> list[TopoDS_Shape]:
        """What an input sub-shape was rebuilt into, if anything."""
    def generated(self, shape: TopoDS_Shape) -> list[TopoDS_Shape]:
        """What was made from an input sub-shape, if anything."""
    def is_removed(self, shape: TopoDS_Shape) -> bool:
        """Was an input sub-shape removed by the operation?"""
    def trace(self, inputs: Iterable[TopoDS_Shape]) -> Trace:
        """Index the record from the result's side for the given inputs."""

class Trace:
    """The record of a :class:`ShapeHistory` read from the result's side.

    Built for a set of inputs, it answers for any sub-shape of the result
    whether it was one of those inputs' sub-shapes left untouched, was
    modified from one, or was generated from one.
    """
    untouched: Incomplete
    modified_from: Incomplete
    generated_from: Incomplete
    def __init__(self, history: ShapeHistory, inputs: Iterable[TopoDS_Shape]) -> None: ...
    def is_untouched(self, shape: TopoDS_Shape) -> bool:
        """Was this result sub-shape an input sub-shape, unchanged?"""
    def is_modified(self, shape: TopoDS_Shape) -> bool:
        """Was this result sub-shape rebuilt from an input sub-shape?"""
    def is_generated(self, shape: TopoDS_Shape) -> bool:
        """Was this result sub-shape made from an input sub-shape of another kind?"""
    def is_descendant(self, shape: TopoDS_Shape) -> bool:
        """Did this result sub-shape come from the inputs in any way?"""
