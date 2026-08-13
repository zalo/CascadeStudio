"""build123d-level demonstration: results depend on the *parametric frames* of
the input primitives, not only on their geometry."""

import json
from build123d import *

def dump(e, tag):
    return {
        "tag": tag,
        "is_forward": e.is_forward,
        "closed": e.is_closed,
        "length": round(e.length, 9),
        "pos0": [round(v, 6) for v in tuple(e.position_at(0))],
        "pos25": [round(v, 6) for v in tuple(e.position_at(0.25))],
        "tan0": [round(v, 6) for v in tuple(e.tangent_at(0))],
        "axis_pos": [round(v, 6) for v in tuple(Axis(e).position)],
        "axis_dir": [round(v, 6) for v in tuple(Axis(e).direction)],
    }


out = {}

# ---------------------------------------------------------------- arch path
# examples/projection.py Example 3.  The sphere is rotated about its OWN axis:
# geometrically the identical solid, but the parametric seam moves.
arch = {}
for rot in (0, 45, 90, 180):
    sphere = Solid.make_sphere(50)
    if rot:
        sphere = sphere.rotate(Axis.Z, rot)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))
    result = sphere.cut(cutter)
    edges = result.edges()
    e = edges.sort_by(Axis.Z)[0]
    d = dump(e, f"sphere rotated {rot}deg about Z")
    d["n_edges_total"] = len(edges)
    # how many edges make up the closed arch loop?
    d["n_bspline_edges"] = len([x for x in edges if x.geom_type == GeomType.BSPLINE])
    arch[rot] = d
out["arch"] = arch

# also rotate the *cutter* about its own axis (identical cylinder)
arch_cut = {}
for rot in (0, 90):
    sphere = Solid.make_sphere(50)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ.rotated((0, 0, rot))).locate(
        Location((-50, 0, -70))
    )
    result = sphere.cut(cutter)
    e = result.edges().sort_by(Axis.Z)[0]
    arch_cut[rot] = dump(e, f"cutter frame rotated {rot}deg about its own axis")
out["arch_cutter_frame"] = arch_cut

# ------------------------------------------------------- Axis(edge) vs edge
# Axis(edge) ignores the TopAbs orientation flag: for a REVERSED edge it
# disagrees with position_at(0)/tangent_at(0).
e = Edge.make_line((0, 0, 0), (10, 0, 0))
er = Edge(e.wrapped.Reversed())
out["axis_vs_position_at"] = {
    "forward": dump(e, "forward line"),
    "reversed": dump(er, "same line, REVERSED flag"),
}

# --------------------------------------------------------------- joints case
joint = {}
for taper in (0.0, 3.0):
    for rot in (0, 90):
        with BuildPart() as obj:
            with BuildSketch():
                Rectangle(10, 10)
            extrude(amount=10, taper=taper)
            Cylinder(2.5, 10, rotation=(0, 90, rot), mode=Mode.SUBTRACT)
        base = Solid(obj.part.wrapped)
        top = base.edges().filter_by(Axis.X, tolerance=30).sort_by(Axis.Z)[-2:]
        mid = Edge.make_mid_way(*top, 0.67)
        joint[f"taper{taper}_cylrot{rot}"] = {
            "top_is_forward": [t.is_forward for t in top],
            "top_pos0": [[round(v, 6) for v in tuple(t.position_at(0))] for t in top],
            "axis_dirs": [[round(v, 6) for v in tuple(Axis(t).direction)] for t in top],
            "midway_axis_pos": [round(v, 6) for v in tuple(Axis(mid).position)],
            "midway_axis_dir": [round(v, 6) for v in tuple(Axis(mid).direction)],
        }
out["joints"] = joint

print(json.dumps(out, indent=1))
