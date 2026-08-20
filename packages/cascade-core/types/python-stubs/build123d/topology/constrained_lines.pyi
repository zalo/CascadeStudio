from .shape_core import ShapeList as ShapeList
from .zero_d import Vertex as Vertex
from OCP.Geom import Geom_Curve as Geom_Curve
from OCP.Geom2d import Geom2d_Curve as Geom2d_Curve
from OCP.TopoDS import TopoDS_Vertex as TopoDS_Vertex
from build123d.build_enums import Sagitta as Sagitta, Tangency as Tangency
from build123d.geometry import Axis as Axis, TOLERANCE as TOLERANCE, Vector as Vector, VectorLike as VectorLike
from build123d.topology.one_d import Edge as Edge
from typing import TypeVar

TWrap = TypeVar('TWrap')
