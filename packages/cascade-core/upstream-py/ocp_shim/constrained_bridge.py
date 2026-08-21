# constrained_bridge (pytopo=upstream) — routes lite Edge.make_constrained_
# arcs/lines onto the VERBATIM upstream topology/constrained_lines.py (the
# whole Geom2dGcc solver layer, ~880 lines, runs over the OCP shim; BILL.md
# counts zero blocked call sites in it). This file ports ONLY the thin
# overload dispatchers from upstream one_d.py (make_constrained_arcs /
# make_constrained_lines final defs) because one_d itself stays lite:
#
#  * Axis tangencies become infinite Geom_Line edges (upstream
#    Edge.__init__'s Axis branch, built through the shim)
#  * Vertex tangencies become their absolute point (upstream evaluates
#    Vector(vertex) + vertex.position, where .position is the LOCATION
#    part — zero for bare vertices; lite's center() is the same point)
#  * edge_factory=lite Edge: upstream functions hand back TopoDS_Edge
#    proxies and topo_bridge's Shape.__init__ unwraps them
#
# Loaded ONLY by UpstreamB123d.js when pytopo=upstream (default OFF).
import sys
from math import atan2, radians

import build123d_lite as _lt
from build123d.geometry import Axis, Vector

_ucl = sys.modules['build123d.topology.constrained_lines']
_sc = sys.modules['build123d.topology.shape_core']
ShapeList = _sc.ShapeList


def _edge_from_axis(ax):
    from ocp_registry import (BRepBuilderAPI_MakeEdge, Geom_Line, gp_Pnt,
                              gp_Dir)
    p, d = ax.position, ax.direction
    line = Geom_Line(gp_Pnt(float(p.X), float(p.Y), float(p.Z)),
                     gp_Dir(float(d.X), float(d.Y), float(d.Z)))
    return _lt.Edge(BRepBuilderAPI_MakeEdge(line).Edge())


def _as_tangency(a, allow_axis_ref=False):
    """One tangency argument -> Edge | (Edge, Tangency) | Vector | Axis."""
    if isinstance(a, Axis):
        return a if allow_axis_ref else _edge_from_axis(a)
    if isinstance(a, _lt.Edge):
        return a
    if isinstance(a, tuple) and len(a) == 2 and not isinstance(
            a[0], (int, float)):
        head = a[0]
        if isinstance(head, Axis):
            return (_edge_from_axis(head), a[1])
        return a  # (Edge, Tangency)
    if isinstance(a, _lt.Shape):  # Vertex
        return Vector(tuple(a.center()))
    return Vector(a)


def _make_constrained_arcs(cls, *args, **kwargs):
    from build123d.build_enums import Sagitta
    sagitta = kwargs.pop('sagitta', Sagitta.SHORT)
    tangency_args = [
        kwargs.pop('tangency_one', args[0] if len(args) > 0 else None),
        kwargs.pop('tangency_two', args[1] if len(args) > 1 else None),
        kwargs.pop('tangency_three', args[2] if len(args) > 2 else None),
    ]
    radius = kwargs.pop('radius', None)
    center = kwargs.pop('center', None)
    center_on = kwargs.pop('center_on', None)
    if kwargs:
        raise TypeError('Unexpected argument(s): ' + ', '.join(kwargs.keys()))

    tangencies = [_as_tangency(t) for t in tangency_args if t is not None]
    # points always last (upstream's stable sort on isinstance(Vector))
    tangencies = sorted(tangencies, key=lambda x: isinstance(x, Vector))

    tan_count = len(tangencies)
    if not 1 <= tan_count <= 3:
        raise TypeError('Provide 1 to 3 tangency targets.')
    if radius is not None and radius <= 0:
        raise ValueError('radius must be > 0.0')
    if center_on is not None and isinstance(center_on, Axis):
        center_on = _edge_from_axis(center_on)

    if tan_count == 2 and radius is not None and center is None \
            and center_on is None:
        return _ucl._make_2tan_rad_arcs(
            *tangencies, radius=radius, sagitta=sagitta, edge_factory=cls)
    if tan_count == 2 and center_on is not None and radius is None \
            and center is None:
        return _ucl._make_2tan_on_arcs(
            *tangencies, center_on=center_on, sagitta=sagitta,
            edge_factory=cls)
    if tan_count == 3 and radius is None and center is None \
            and center_on is None:
        return _ucl._make_3tan_arcs(*tangencies, sagitta=sagitta,
                                    edge_factory=cls)
    if tan_count == 1 and center is not None and radius is None \
            and center_on is None:
        return _ucl._make_tan_cen_arcs(*tangencies, center=center,
                                       edge_factory=cls)
    if tan_count == 1 and center_on is not None and radius is not None:
        return _ucl._make_tan_on_rad_arcs(
            *tangencies, center_on=center_on, radius=radius,
            edge_factory=cls)
    raise ValueError('Unsupported or ambiguous combination of constraints.')


def _make_constrained_lines(cls, *args, **kwargs):
    tangency_args = [
        kwargs.pop('tangency_one', args[0] if len(args) > 0 else None),
        kwargs.pop('tangency_two', args[1] if len(args) > 1 else None),
    ]
    angle = kwargs.pop('angle', None)
    direction = kwargs.pop('direction', None)
    direction = Vector(direction) if direction is not None else None
    is_ref = angle is not None or direction is not None
    if kwargs:
        raise TypeError('Unexpected argument(s): ' + ', '.join(kwargs.keys()))

    tangency_args = [t for t in tangency_args if t is not None]
    if len(tangency_args) != 2:
        raise TypeError('Provide exactly 2 tangency targets.')
    tangencies = [
        _as_tangency(t, allow_axis_ref=(i == 1 and is_ref))
        for i, t in enumerate(tangency_args)
    ]
    # point | Axis always last (upstream's stable sort)
    tangencies = sorted(tangencies,
                        key=lambda x: isinstance(x, (Axis, Vector)))

    if is_ref:
        if angle is not None:
            ang_rad = radians(angle)
        else:
            ang_rad = atan2(direction.Y, direction.X)
        if not isinstance(tangencies[1], Axis):
            raise TypeError('angle/direction form needs an Axis reference')
        return _ucl._make_tan_oriented_lines(
            tangencies[0], tangencies[1], ang_rad, edge_factory=cls)
    return _ucl._make_2tan_lines(tangencies[0], tangencies[1],
                                 edge_factory=cls)


_lt.Edge.make_constrained_arcs = classmethod(_make_constrained_arcs)
_lt.Edge.make_constrained_lines = classmethod(_make_constrained_lines)
