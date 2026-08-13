"""Does canonicalization unify the affected constructions?  (patched build123d)"""

import json
from build123d import *
from build123d.topology.one_d import edges_to_wires
from OCP.TopoDS import TopoDS

out = {}


def brief(shape):
    return {
        "pos0": [round(v, 6) for v in tuple(shape.position_at(0))],
        "pos25": [round(v, 6) for v in tuple(shape.position_at(0.25))],
        "tan0": [round(v, 6) for v in tuple(shape.tangent_at(0))],
        "length": round(shape.length, 6),
    }


# ---------------------------------------------------------------- 1. arch path
# examples/projection.py Example 3: the sphere is rotated about its OWN axis, so
# every configuration is the geometrically identical solid.
arch_raw, arch_canon = {}, {}
for rot in (0, 45, 90, 180, 270):
    sphere = Solid.make_sphere(50)
    if rot:
        sphere = sphere.rotate(Axis.Z, rot)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))
    result = sphere.cut(cutter)
    edge = result.edges().sort_by(Axis.Z)[0]
    arch_raw[rot] = brief(edge) | {"volume": round(result.volume, 4)}
    arch_canon[rot] = brief(edge.canonical())
out["arch_raw"] = arch_raw
out["arch_canonical"] = arch_canon

# -------- 2. the same, with the CUTTER's own frame rotated: the loop is then
# split into several edges, so it has to be reassembled into a Wire first.
arch_loop = {}
for rot in (0, 90, 37):
    sphere = Solid.make_sphere(50)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ.rotated((0, 0, rot))).locate(
        Location((-50, 0, -70))
    )
    result = sphere.cut(cutter)
    loop_edges = [e for e in result.edges() if e.geom_type == GeomType.BSPLINE]
    wire = max(edges_to_wires(loop_edges), key=lambda w: w.length)
    arch_loop[rot] = {
        "volume": round(result.volume, 4),
        "n_loop_edges": len(loop_edges),
        "raw": brief(wire),
        "canonical": brief(wire.canonical()),
    }
out["arch_loop_from_wire"] = arch_loop

# ------------------------------------------------------------- 3. joints case
# examples/joints.py: the slider axis is Axis(Edge.make_mid_way(*top_edges,0.67)).
# The subtracted cylinder's own frame is rotated -> identical solid.
midway = {}
for rot in (0, 90, 180):
    with BuildPart() as obj:
        with BuildSketch():
            Rectangle(10, 10)
        extrude(amount=10, taper=3)
        Cylinder(2.5, 10, rotation=(0, 90, rot), mode=Mode.SUBTRACT)
    base = Solid(obj.part.wrapped)
    top = base.edges().filter_by(Axis.X, tolerance=30).sort_by(Axis.Z)[-2:]
    mid = Edge.make_mid_way(*top, 0.67)  # patched: canonicalizes internally
    midway[rot] = {
        "volume": round(base.volume, 6),
        "is_forward": [t.is_forward for t in top],
        "legacy_axis_dirs": [
            [round(v, 6) for v in tuple(Axis(t, canonical=False).direction)] for t in top
        ],
        "canonical_axis_dirs": [
            [round(v, 6) for v in tuple(Axis(t, canonical=True).direction)] for t in top
        ],
        "midway_pos0": [round(v, 6) for v in tuple(mid.position_at(0))],
        "midway_axis_pos": [
            round(v, 6) for v in tuple(Axis(mid, canonical=True).position)
        ],
        "midway_axis_dir": [
            round(v, 6) for v in tuple(Axis(mid, canonical=True).direction)
        ],
    }
out["joints_midway"] = midway

# ------------------------------------------- 4. Axis(edge) self-consistency
line = Edge.make_line((0, 0, 0), (10, 0, 0))
for name, edge in (
    ("forward", line),
    ("reversed_flag", line.reversed()),
    ("built_backwards", Edge.make_line((10, 0, 0), (0, 0, 0))),
):
    out.setdefault("axis_consistency", {})[name] = {
        "pos0": [round(v, 6) for v in tuple(edge.position_at(0))],
        "tan0": [round(v, 6) for v in tuple(edge.tangent_at(0))],
        "legacy_axis": [
            [round(v, 6) for v in tuple(Axis(edge, canonical=False).position)],
            [round(v, 6) for v in tuple(Axis(edge, canonical=False).direction)],
        ],
        "canonical_axis": [
            [round(v, 6) for v in tuple(Axis(edge, canonical=True).position)],
            [round(v, 6) for v in tuple(Axis(edge, canonical=True).direction)],
        ],
    }

# ---------------------------------- 5. sanity: canonical form of drawn shapes
shapes = {
    "circle_xy": Edge.make_circle(10),
    "circle_xy_reversed": Edge.make_circle(10).reversed(),
    "circle_xz": Edge.make_circle(10, Plane.XZ),
    "rect_wire": Wire(Face.make_rect(20, 10).outer_wire()),
    "rect_wire_reversed": Wire(TopoDS.Wire_s(Face.make_rect(20, 10).outer_wire().wrapped.Reversed())),
}
for name, shape in shapes.items():
    canon = shape.canonical()
    out.setdefault("drawn", {})[name] = {
        "form": list(shape.canonical_form()),
        "canon": brief(canon),
    }

print(json.dumps(out, indent=1))
