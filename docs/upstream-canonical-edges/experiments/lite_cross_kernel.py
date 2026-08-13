"""Cross-kernel reference for CascadeStudio's build123d-lite canonical() port.

Runs the canonical rule through PATCHED build123d on OCP 7.9.3 and dumps the
measurements that `test/b123d-validation/canonical-cross-kernel.mjs` reproduces
through build123d-lite on OCCT 8.0.1 (wasm).  Every construction here is
expressible in both, so the comparison isolates the KERNEL: identical geometry,
different seams/directions/parametrisations, and canonical() must erase the
difference.

    ./repatch.sh                              # -> /tmp/b123d-0111 (patched 0.11.1)
    PYTHONPATH=/tmp/b123d-0111 \
      ~/Desktop/ocjs-deps/b123d-ref-venv/bin/python lite_cross_kernel.py \
      > canonical-lite-reference.json

(The patch sources in ../patch/src are partial files, so they cannot simply be
prepended to sys.path; repatch.sh materialises the complete patched tree.)
"""

import json

from build123d import (
    Axis,
    BuildPart,
    BuildSketch,
    Cylinder,
    Edge,
    GeomType,
    Location,
    Mode,
    Plane,
    Rectangle,
    Solid,
    extrude,
)
from build123d.topology.one_d import edges_to_wires


def brief(shape):
    """The measurements a canonical traversal is supposed to pin down."""
    return {
        "length": round(shape.length, 4),
        "pos0": [round(v, 4) for v in tuple(shape.position_at(0))],
        "pos25": [round(v, 4) for v in tuple(shape.position_at(0.25))],
        "pos50": [round(v, 4) for v in tuple(shape.position_at(0.50))],
        "pos75": [round(v, 4) for v in tuple(shape.position_at(0.75))],
        "tan0": [round(v, 4) for v in tuple(shape.tangent_at(0))],
    }


def positive_x_loop(wires):
    """The loop that lies entirely at x > 0 (the kernels number wires
    differently, so pick geometrically)."""
    return [
        wire
        for wire in wires
        if min(wire.position_at(i / 64.0).X for i in range(64)) > 0
    ][0]


out = {}

# ------------------------------------------------------- 1. arch (sphere ∩ cyl)
# examples/projection.py Example 3: sphere(R50) cut by cylinder(r80), whose
# section locus arrives as ONE closed edge.  Rotating the sphere about its OWN
# axis is the geometrically identical solid but moves the sphere's u = 0
# meridian, and with it the raw seam - by up to 98 mm (REPORT.md Table 4).
arch = {}
for rotation in (0, 45, 90, 180, 270):
    sphere = Solid.make_sphere(50)
    if rotation:
        sphere = sphere.rotate(Axis.Z, rotation)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))
    edge = sphere.cut(cutter).edges().sort_by(Axis.Z)[0]
    arch["rot%d" % rotation] = {
        "raw_start": [round(v, 4) for v in tuple(edge.position_at(0))],
        "canonical": brief(edge.canonical()),
    }
out["arch"] = arch

# --------------------------------------------- 2. reassembled sphere ∩ cylinder
# sphere(R10) against a cylinder(r5) lying along X at z = 3.  The section locus
# is two loops, and each kernel chops them into a different NUMBER of edges, so
# this exercises upstream's recipe for that case (REPORT.md 2.5): reassemble
# with edges_to_wires, then canonicalise the WIRE.  The B-spline filter drops
# the sphere's own seam meridian and pole edges.
reassembled = {}
for rotation in (0, 90, 180):
    sphere = Solid.make_sphere(10)
    if rotation:
        sphere = sphere.rotate(Axis.Z, rotation)
    cutter = Solid.make_cylinder(5, 40, Plane.YZ).locate(Location((-20, 0, 3)))
    edges = sphere.cut(cutter).edges().filter_by(GeomType.BSPLINE)
    loop = positive_x_loop(edges_to_wires(edges))
    form = loop.canonical_form()
    reassembled["rot%d" % rotation] = {
        "edge_count": len(edges),
        "loop_edge_count": len(loop.edges()),
        "raw_start": [round(v, 4) for v in tuple(loop.position_at(0))],
        "form_start": round(form.start, 6),
        "form_sign": form.sign,
        "canonical": brief(loop.canonical()),
    }
out["sphere_cylinder_reassembled"] = reassembled

# ---------------------------------------------------------------- 3. joints case
# examples/joints.py's slider axis (REPORT.md Table 5): two tapered top edges
# with EQUAL Axis.Z sort keys, measured with Edge.make_mid_way.  Needs both the
# canonical edge traversal and the deterministic sort_by tie break.
joints = {}
for rotation in (0, 90, 180):
    with BuildPart() as part:
        with BuildSketch():
            Rectangle(10, 10)
        extrude(amount=10, taper=3)
        Cylinder(2.5, 10, rotation=(0, 90, rotation), mode=Mode.SUBTRACT)
    solid = part.part
    tied = solid.edges().filter_by(Axis.X, tolerance=30)
    # Selecting the two TIED top edges deterministically is the caller's half of
    # the fix. The patch made that opt-in (`tie_break=True`) after the dev suite
    # showed a default-on tie break breaks chained sorts; an older revision of
    # the patch had it default-on and no keyword, hence the fallback.
    try:
        top = tied.sort_by(Axis.Z, tie_break=True)[-2:]
    except TypeError:
        top = tied.sort_by(Axis.Z)[-2:]
    midway = Edge.make_mid_way(*top, 0.67)
    joints["rot%d" % rotation] = {
        "volume": round(solid.volume, 4),
        "canonical_axes": [
            [
                [round(v, 4) for v in tuple(Axis(e, canonical=True).position)],
                [round(v, 4) for v in tuple(Axis(e, canonical=True).direction)],
            ]
            for e in top
        ],
        "midway_start": [round(v, 5) for v in tuple(midway.position_at(0))],
        "midway_end": [round(v, 5) for v in tuple(midway.position_at(1))],
    }
out["joints"] = joints

print(json.dumps(out, indent=1))
