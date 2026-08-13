"""Kernel probe: how does OCCT place seams / parametrize / orient closed
intersection edges?  Native OCP 7.9.3 side.

Emits JSON on stdout (one object) so the wasm side can be diffed against it.
"""

import json
import math
import sys

from OCP.gp import gp_Pnt, gp_Dir, gp_Ax2, gp_Ax3, gp_Pln, gp_Vec
from OCP.BRepPrimAPI import (
    BRepPrimAPI_MakeSphere,
    BRepPrimAPI_MakeCylinder,
    BRepPrimAPI_MakeBox,
    BRepPrimAPI_MakeTorus,
)
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeFace, BRepBuilderAPI_NurbsConvert
from OCP.BRepAlgoAPI import BRepAlgoAPI_Section, BRepAlgoAPI_Cut
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_ShapeEnum, TopAbs_Orientation
from OCP.TopoDS import TopoDS
from OCP.BRep import BRep_Tool
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.GCPnts import GCPnts_AbscissaPoint
from OCP.GeomAbs import GeomAbs_CurveType
from OCP.GeomAPI import GeomAPI_PointsToBSplineSurface
from OCP.TColgp import TColgp_Array2OfPnt

ORI = {
    TopAbs_Orientation.TopAbs_FORWARD: "FORWARD",
    TopAbs_Orientation.TopAbs_REVERSED: "REVERSED",
    TopAbs_Orientation.TopAbs_INTERNAL: "INTERNAL",
    TopAbs_Orientation.TopAbs_EXTERNAL: "EXTERNAL",
}
CT = {
    GeomAbs_CurveType.GeomAbs_Line: "Line",
    GeomAbs_CurveType.GeomAbs_Circle: "Circle",
    GeomAbs_CurveType.GeomAbs_Ellipse: "Ellipse",
    GeomAbs_CurveType.GeomAbs_Hyperbola: "Hyperbola",
    GeomAbs_CurveType.GeomAbs_Parabola: "Parabola",
    GeomAbs_CurveType.GeomAbs_BezierCurve: "Bezier",
    GeomAbs_CurveType.GeomAbs_BSplineCurve: "BSpline",
    GeomAbs_CurveType.GeomAbs_OffsetCurve: "OffsetCurve",
    GeomAbs_CurveType.GeomAbs_OtherCurve: "OtherCurve",
}


def r6(x):
    return round(x, 6)


def p3(p):
    return [r6(p.X()), r6(p.Y()), r6(p.Z())]


# ---------------------------------------------------------------- seam probes
def seam_u(probe, p):
    """Signed angle (deg) of point p around the probe surface's axis measured
    from its parametric u-origin (its X direction).  0 == on the u=0 seam."""
    c = probe["center"]
    z = probe["zdir"]
    x = probe["xdir"]
    y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]
    d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    du = sum(a * b for a, b in zip(d, x))
    dv = sum(a * b for a, b in zip(d, y))
    return r6(math.degrees(math.atan2(dv, du)))


# --------------------------------------------------------------- edge dumping
def dump_edge(e):
    bac = BRepAdaptor_Curve(e)
    t = CT[bac.GetType()]
    f, l = bac.FirstParameter(), bac.LastParameter()
    out = {
        "ori": ORI[e.Orientation()],
        "type": t,
        "range": [r6(f), r6(l)],
        "closed": bool(BRep_Tool.IsClosed_s(e)),
    }
    if t in ("BSpline", "Bezier"):
        out["degree"] = bac.Degree()
        out["npoles"] = bac.NbPoles()
    try:
        out["length"] = r6(GCPnts_AbscissaPoint.Length_s(bac))
    except Exception:
        out["length"] = None
    out["p_first"] = p3(bac.Value(f))
    out["p_last"] = p3(bac.Value(l))
    out["p_mid"] = p3(bac.Value(0.5 * (f + l)))
    n = 400
    out["poly"] = [p3(bac.Value(f + (l - f) * i / n)) for i in range(n + 1)]
    # geometric closure
    a, b = bac.Value(f), bac.Value(l)
    out["geom_closed"] = a.Distance(b) < 1e-7
    v = gp_Vec()
    pp = gp_Pnt()
    bac.D1(f, pp, v)
    n = v.Magnitude()
    if n > 0:
        out["tan_first"] = [r6(v.X() / n), r6(v.Y() / n), r6(v.Z() / n)]
    # orientation-aware traversal start (what build123d position_at(0) yields)
    if e.Orientation() == TopAbs_Orientation.TopAbs_REVERSED:
        out["walk_start"] = out["p_last"]
        out["walk_dir"] = [-c for c in out.get("tan_first", [0, 0, 0])]
    else:
        out["walk_start"] = out["p_first"]
        out["walk_dir"] = out.get("tan_first")
    return out


def edges_of(shape):
    exp = TopExp_Explorer(shape, TopAbs_ShapeEnum.TopAbs_EDGE)
    out = []
    while exp.More():
        out.append(TopoDS.Edge_s(exp.Current()))
        exp.Next()
    return out


def bspline_surface_wavy():
    n = 9
    arr = TColgp_Array2OfPnt(1, n, 1, n)
    for i in range(n):
        for j in range(n):
            x = -40 + 80 * i / (n - 1)
            y = -40 + 80 * j / (n - 1)
            z = 3.0 * math.sin(x / 12.0) + 2.0 * math.cos(y / 15.0)
            arr.SetValue(i + 1, j + 1, gp_Pnt(x, y, z))
    surf = GeomAPI_PointsToBSplineSurface(arr).Surface()
    return BRepBuilderAPI_MakeFace(surf, 1e-6).Face()


def perp(zdir, xdir):
    if xdir is not None:
        return xdir
    return (0, 1, 0) if abs(zdir[0]) > 0.99 else (1, 0, 0)


def sphere(r, xdir=(1, 0, 0), zdir=(0, 0, 1), center=(0, 0, 0)):
    ax = gp_Ax2(gp_Pnt(*center), gp_Dir(*zdir), gp_Dir(*perp(zdir, xdir)))
    return BRepPrimAPI_MakeSphere(ax, r).Shape()


def cylinder(r, h, center=(0, 0, 0), zdir=(0, 0, 1), xdir=None):
    ax = gp_Ax2(gp_Pnt(*center), gp_Dir(*zdir), gp_Dir(*perp(zdir, xdir)))
    return BRepPrimAPI_MakeCylinder(ax, r, h).Shape()


def plane_face(origin, normal, xdir, half=60):
    ax3 = gp_Ax3(gp_Pnt(*origin), gp_Dir(*normal), gp_Dir(*xdir))
    return BRepBuilderAPI_MakeFace(gp_Pln(ax3), -half, half, -half, half).Face()


# ------------------------------------------------------------------- battery
def cases():
    C = []

    def add(name, s1, s2, probes, note=""):
        C.append({"name": name, "s1": s1, "s2": s2, "probes": probes, "note": note})

    sph_probe = lambda xd=(1, 0, 0), c=(0, 0, 0): {
        "name": "sphere",
        "center": list(c),
        "zdir": [0, 0, 1],
        "xdir": list(xd),
    }
    cyl_probe = lambda c, zd=(0, 0, 1), xd=(1, 0, 0): {
        "name": "cyl",
        "center": list(c),
        "zdir": list(zd),
        "xdir": list(xd),
    }

    # 1 reference: intersection crosses the sphere's u=0 (+X) seam meridian
    add(
        "sph_cyl_xp6",
        sphere(10),
        cylinder(5, 40, (6, 0, -20)),
        [sph_probe(), cyl_probe((6, 0, -20))],
        "curve crosses sphere u=0 at (1,0,+-9.95)",
    )
    # 2 same locus mirrored: curve does NOT cross sphere u=0 (it crosses u=180)
    add(
        "sph_cyl_xm6",
        sphere(10),
        cylinder(5, 40, (-6, 0, -20)),
        [sph_probe(), cyl_probe((-6, 0, -20))],
        "curve crosses sphere u=180 only",
    )
    # 3 curve crosses no sphere seam at all
    add(
        "sph_cyl_yp6",
        sphere(10),
        cylinder(5, 40, (0, 6, -20)),
        [sph_probe(), cyl_probe((0, 6, -20))],
        "curve crosses neither u=0 nor u=180 of sphere",
    )
    # 4 SAME LOCUS as case 1, only the sphere's parametric seam is rotated 90deg
    add(
        "sph_cyl_xp6_seam90",
        sphere(10, xdir=(0, 1, 0)),
        cylinder(5, 40, (6, 0, -20)),
        [sph_probe((0, 1, 0)), cyl_probe((6, 0, -20))],
        "identical geometry to case 1, sphere u=0 seam moved to +Y",
    )
    # 5 SAME LOCUS as case 1, sphere seam at -X (curve does not cross it)
    add(
        "sph_cyl_xp6_seam180",
        sphere(10, xdir=(-1, 0, 0)),
        cylinder(5, 40, (6, 0, -20)),
        [sph_probe((-1, 0, 0)), cyl_probe((6, 0, -20))],
        "identical geometry to case 1, sphere u=0 seam moved to -X",
    )
    # 6 SAME LOCUS as case 1, cylinder's seam rotated to +Y
    add(
        "sph_cyl_xp6_cylseam90",
        sphere(10),
        cylinder(5, 40, (6, 0, -20), xdir=(0, 1, 0)),
        [sph_probe(), cyl_probe((6, 0, -20), xd=(0, 1, 0))],
        "identical geometry to case 1, cylinder u=0 seam moved to +Y",
    )
    # 7 sphere/sphere -> analytic circle
    add(
        "sph_sph",
        sphere(10),
        sphere(8, center=(5, 0, 0)),
        [sph_probe(), sph_probe(c=(5, 0, 0))],
        "analytic circle",
    )
    # 8 cylinder/cylinder crossed axes -> two closed walking lines
    add(
        "cyl_cyl",
        cylinder(5, 60, (0, 0, -30)),
        cylinder(7, 60, (-30, 0, 0), zdir=(1, 0, 0)),
        [cyl_probe((0, 0, -30)), cyl_probe((-30, 0, 0), zd=(1, 0, 0), xd=(0, 1, 0))],
        "two closed curves",
    )
    # 9 plane/cylinder oblique -> analytic ellipse
    add(
        "plane_cyl",
        cylinder(10, 60, (0, 0, -30)),
        plane_face((0, 0, 0), (0, 0.5, 1), (1, 0, 0)),
        [cyl_probe((0, 0, -30))],
        "analytic ellipse",
    )
    # 10 torus/plane
    add(
        "torus_plane",
        BRepPrimAPI_MakeTorus(gp_Ax2(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1), gp_Dir(1, 0, 0)), 20, 6).Shape(),
        plane_face((0, 0, 2), (0, 0, 1), (1, 0, 0)),
        [{"name": "torus", "center": [0, 0, 0], "zdir": [0, 0, 1], "xdir": [1, 0, 0]}],
        "two closed curves on a periodic-in-both-directions surface",
    )
    # 11 non-periodic BSpline surface / sphere -> no seam anywhere
    add(
        "bspl_sph",
        bspline_surface_wavy(),
        sphere(30),
        [sph_probe()],
        "BSpline surface is non-periodic: no parametric seam to split on",
    )
    # 12 the real build123d projection.py arch path (CUT, not Section)
    add(
        "b123d_arch",
        sphere(50),
        cylinder(80, 100, (-50, 0, -70), zdir=(1, 0, 0)),
        [sph_probe(), cyl_probe((-50, 0, -70), zd=(1, 0, 0), xd=(0, 1, 0))],
        "examples/projection.py Example 3 arch path",
    )
    # 13 box cut by cylinder (joints.py flavour: orientation of surviving edges)
    add(
        "box_cyl_cut",
        BRepPrimAPI_MakeBox(gp_Pnt(-5, -5, 0), gp_Pnt(5, 5, 10)).Shape(),
        cylinder(2.5, 20, (-10, 0, 0), zdir=(1, 0, 0)),
        [],
        "joints.py flavour: top edges of a box after a CUT",
    )
    return C


def run():
    out = {"kernel": "OCP native", "cases": {}}
    for c in cases():
        rec = {"note": c["note"], "section": None, "cut": None}
        try:
            sec = BRepAlgoAPI_Section(c["s1"], c["s2"], True)
            sec.Build()
            es = [dump_edge(e) for e in edges_of(sec.Shape())]
            for e in es:
                e["seam_u_first"] = {p["name"] + str(i): seam_u(p, e["p_first"]) for i, p in enumerate(c["probes"])}
                e["seam_u_last"] = {p["name"] + str(i): seam_u(p, e["p_last"]) for i, p in enumerate(c["probes"])}
            rec["section"] = es
        except Exception as ex:
            rec["section"] = {"error": str(ex)}
        try:
            cut = BRepAlgoAPI_Cut(c["s1"], c["s2"])
            cut.Build()
            es = []
            for e in edges_of(cut.Shape()):
                d = dump_edge(e)
                d["seam_u_first"] = {p["name"] + str(i): seam_u(p, d["p_first"]) for i, p in enumerate(c["probes"])}
                d["seam_u_last"] = {p["name"] + str(i): seam_u(p, d["p_last"]) for i, p in enumerate(c["probes"])}
                es.append(d)
            rec["cut"] = es
        except Exception as ex:
            rec["cut"] = {"error": str(ex)}
        out["cases"][c["name"]] = rec
    print(json.dumps(out))


if __name__ == "__main__":
    run()
