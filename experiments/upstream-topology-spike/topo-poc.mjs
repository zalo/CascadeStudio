// topo-poc.mjs — node inner loop for the UPSTREAM-TOPOLOGY-over-OCP-shim
// spike. Unlike upstream-poc.mjs (semantic mock), this boots the REAL OCCT
// wasm + the REAL worker StandardLibrary (lite backend) + MicroPython with
// pysrc=upstream AND pytopo=upstream, then drives micro-tests through
// upstream topology/utils.py + zero_d.py (verbatim, over the generated OCP
// shim) interoperating with lite shapes.
//
//   node experiments/upstream-topology-spike/topo-poc.mjs [script.py]
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const B123D_SRC = process.env.B123D_SRC ||
  join(process.env.HOME, 'Desktop', 'ocjs-deps', 'b123d-ref-venv', 'lib', 'python3.12', 'site-packages', 'build123d');

globalThis.self = globalThis;
self.postMessage = () => {};

// ---- real OCCT wasm --------------------------------------------------- //
const t0 = Date.now();
const ocMod = await import(join(ROOT, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.js'));
self.oc = await ocMod.default();
console.log('[poc] OCCT wasm up in ' + (Date.now() - t0) + ' ms');

// ---- real worker StandardLibrary (lite backend) ----------------------- //
// (bundled first: quickhull3d ships extension-less ESM imports node can't
// resolve raw; esbuild fixes that exactly like the real worker build does)
const esbuild = await import(join(ROOT, 'node_modules', 'esbuild', 'lib', 'main.js'));
const slBundle = join(HERE, '.standard-library.bundle.mjs');
await esbuild.build({
  entryPoints: [join(ROOT, 'packages', 'cascade-core', 'src', 'worker', 'StandardLibrary.js')],
  bundle: true, format: 'esm', outfile: slBundle, logLevel: 'silent',
});
const { CascadeStudioStandardLibrary } = await import(slBundle);
self.sceneShapes = [];
self.GUIState = {};  // worker page state (Cache? off in node)
self.standardLibrary = new CascadeStudioStandardLibrary();
console.log('[poc] StandardLibrary attached');

// ---- MicroPython (pysrc=upstream, pytopo=upstream) --------------------- //
self._csPyTopo = process.env.CS_PYTOPO || 'upstream';
self._csMicroPythonLocate = {
  mjsURL: join(ROOT, 'packages', 'cascade-core', 'vendor', 'micropython-cs', 'micropython.mjs'),
  wasmURL: join(ROOT, 'packages', 'cascade-core', 'vendor', 'micropython-cs', 'micropython.wasm'),
  kind: 'custom',
};
self._csUpstreamFetchText = async (rel) => {
  let p;
  if (rel.startsWith('upstream/')) { p = join(B123D_SRC, rel.slice('upstream/'.length)); }
  else { p = join(ROOT, 'packages', 'cascade-core', 'upstream-py', rel); }
  return fs.readFileSync(p, 'utf8');
};

const { ensureMicroPythonRuntime } = await import(
  join(ROOT, 'packages', 'cascade-core', 'src', 'worker', 'MicroPythonRuntime.js'));

const t1 = Date.now();
let runtime;
try {
  runtime = await ensureMicroPythonRuntime('upstream');
} catch (e) {
  console.error('BOOT FAILED:\n' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
console.log('[poc] python runtime up in ' + (Date.now() - t1) + ' ms');

// ---- the micro-tests --------------------------------------------------- //
const TESTS = {
  't1-shim-smoke': `
from OCP.gp import gp_Pnt, gp_Vec
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_ShapeEnum
from OCP.TopExp import TopExp_Explorer
import OCP.TopAbs as ta
from OCP.BRep import BRep_Tool
from OCP.TopoDS import TopoDS
from OCP.Geom import Geom_Plane, Geom_Surface

p = gp_Pnt(1, 2, 3)
assert (p.X(), p.Y(), p.Z()) == (1.0, 2.0, 3.0), 'gp_Pnt roundtrip'
box = BRepPrimAPI_MakeBox(2, 3, 4).Shape()
props = GProp_GProps()
BRepGProp.VolumeProperties_s(box, props)   # 2 args: pybind DEFAULTS filled
v = props.Mass()
assert abs(v - 24.0) < 1e-9, 'volume ' + str(v)
# enum identity + dict key (pybind parity bets)
st = box.ShapeType()
assert st == TopAbs_ShapeEnum.TopAbs_SOLID, 'enum =='
assert st is TopAbs_ShapeEnum.TopAbs_SOLID or st == TopAbs_ShapeEnum.TopAbs_SOLID
lut = {TopAbs_ShapeEnum.TopAbs_SOLID: 'solid', TopAbs_ShapeEnum.TopAbs_FACE: 'face'}
assert lut[st] == 'solid', 'enum dict key'
assert lut[ta.TopAbs_SOLID] == 'solid', 'module-level member alias'
# explorer with DEFAULT ToAvoid (ctor default fill) + downcast + polymorphic
ex = TopExp_Explorer(box, TopAbs_ShapeEnum.TopAbs_FACE)
n = 0
first_face = None
while ex.More():
    if first_face is None:
        first_face = TopoDS.Face(ex.Current())
    n += 1
    ex.Next()
assert n == 6, 'face count ' + str(n)
surf = BRep_Tool.Surface_s(first_face)     # handle auto-deref
assert isinstance(surf, Geom_Plane), 'polymorphic downcast: ' + str(type(surf))
assert isinstance(surf, Geom_Surface), 'inheritance mirror'
pln = surf.Pln()
print('T1 OK volume', v, 'faces', n, 'surface', type(surf).__name__)
`,
  't2-upstream-utils': `
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakePolygon
from OCP.gp import gp_Pnt
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from build123d.topology.utils import _make_topods_face_from_wires, _extrude_topods_shape, polar, tuplify, isclose_b

poly = BRepBuilderAPI_MakePolygon()
for x, y in ((0, 0), (4, 0), (4, 3), (0, 3)):
    poly.Add(gp_Pnt(x, y, 0))
poly.Close()
wire = poly.Wire()
face = _make_topods_face_from_wires(wire)          # upstream code, verbatim
props = GProp_GProps()
BRepGProp.SurfaceProperties_s(face, props)
area = props.Mass()
assert abs(area - 12.0) < 1e-9, 'face area ' + str(area)
solid = _extrude_topods_shape(face, (0, 0, 5))     # lite Vector.wrapped bridge
vprops = GProp_GProps()
BRepGProp.VolumeProperties_s(solid, vprops)
vol = vprops.Mass()
assert abs(vol - 60.0) < 1e-9, 'prism volume ' + str(vol)
assert polar(2.0, 90)[1] - 2.0 < 1e-9
assert tuplify(1, 3) == (1, 1, 1)
print('T2 OK area', area, 'volume', vol)
`,
  't3-zero-d-mixed': `
from build123d import *
from build123d.topology.zero_d import Vertex as UVertex, topo_explore_common_vertex

# upstream Vertex standalone (constructed through the shim)
uv = UVertex(1, 2, 3)
assert (uv.X, uv.Y, uv.Z) == (1.0, 2.0, 3.0), 'upstream Vertex coords'
uv2 = uv + (1, 1, 1)
assert (uv2.X, uv2.Y, uv2.Z) == (2.0, 3.0, 4.0), 'Vertex add'
assert tuple(uv.center()) == (1.0, 2.0, 3.0), 'center -> lite Vector'

# MIXED MODE: lite-built shapes flow through upstream zero_d verbatim
b = Box(2, 2, 2)
edges = b.edges()
e0 = edges[0]
shared = None
count = 0
for e in edges[1:]:
    v = topo_explore_common_vertex(e0, e)     # upstream code on lite Edges
    if v is not None:
        shared = v
        count += 1
assert shared is not None, 'no common vertex found'
assert count >= 2, 'expected >=2 adjacent edges, got ' + str(count)
c = tuple(shared.center())
assert all(abs(abs(x) - 1.0) < 1e-9 for x in c), 'corner at ' + str(c)
print('T3 OK upstream-Vertex + lite-edge common vertex at', c, 'adjacent', count)
`,
  't5-out-param-glue': `
# The convention-glue round: Tangency-family OCJS_Out glue (tuple return +
# PntSol MUTATION), ChFi2d_FilletAlgo.Result (by-ref TopoDS out-params via
# proxy rebinding), the bound Geom2dAPI_ProjectPointOnCurve.Parameter
# alternative, and a PENDING_FORK_BINDING hook raising loudly.
from OCP.gp import gp_Pnt2d, gp_Dir2d, gp_Ax2d, gp_Lin2d, gp_Pnt, gp_Dir, gp_Pln
from OCP.Geom2d import Geom2d_Line
from OCP.Geom2dAdaptor import Geom2dAdaptor_Curve
from OCP.Geom2dGcc import Geom2dGcc_QualifiedCurve, Geom2dGcc_Circ2d2TanRad
from OCP.GccEnt import GccEnt_Position
from OCP.Geom2dAPI import Geom2dAPI_ProjectPointOnCurve

def qline(px, py, dx, dy):
    lin = gp_Lin2d(gp_Ax2d(gp_Pnt2d(px, py), gp_Dir2d(dx, dy)))
    ad = Geom2dAdaptor_Curve(Geom2d_Line(lin.Position()))
    return Geom2dGcc_QualifiedCurve(ad, GccEnt_Position.GccEnt_unqualified)

gcc = Geom2dGcc_Circ2d2TanRad(qline(0, 0, 1, 0), qline(0, 0, 0, 1), 5.0, 1e-9)
assert gcc.IsDone() and gcc.NbSolutions() > 0, 'no tangent circles'
p1 = gp_Pnt2d(99.0, 99.0)
res = gcc.Tangency1(1, p1)
assert isinstance(res, tuple) and len(res) == 2, 'Tangency1 tuple: ' + str(res)
assert abs(abs(p1.X()) - 5.0) < 1e-7 or abs(abs(p1.Y()) - 5.0) < 1e-7, \\
    'PntSol not mutated: ' + str((p1.X(), p1.Y()))

# ProjectPointOnCurve.Parameter: the float-returning bound overload
line2d = Geom2d_Line(gp_Lin2d(gp_Ax2d(gp_Pnt2d(0, 0), gp_Dir2d(1, 0))).Position())
proj = Geom2dAPI_ProjectPointOnCurve(gp_Pnt2d(3, 4), line2d)
assert proj.NbPoints() >= 1
u = proj.Parameter(1)
assert abs(u - 3.0) < 1e-9, 'Parameter(1) = ' + str(u)

# FilletAlgo.Result mutates the two passed TopoDS_Edge proxies
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeEdge
from OCP.ChFi2d import ChFi2d_FilletAlgo
from OCP.TopoDS import TopoDS_Edge
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
e1 = BRepBuilderAPI_MakeEdge(gp_Pnt(10, 0, 0), gp_Pnt(0, 0, 0)).Edge()
e2 = BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(0, 10, 0)).Edge()
algo = ChFi2d_FilletAlgo()
algo.Init(e1, e2, gp_Pln(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)))
assert algo.Perform(2.0), 'fillet Perform failed'
corner = gp_Pnt(0, 0, 0)
assert algo.NbResults(corner) >= 1
t0, t1 = TopoDS_Edge(), TopoDS_Edge()
fe = algo.Result(corner, t0, t1)
props = GProp_GProps()
BRepGProp.LinearProperties_s(t0, props)
l0 = props.Mass()
assert abs(l0 - 8.0) < 1e-6, 'trimmed edge0 length ' + str(l0)
props2 = GProp_GProps()
BRepGProp.LinearProperties_s(fe, props2)
import math
assert abs(props2.Mass() - 2.0 * math.pi / 2 * 1.0) < 0.5, 'fillet arc length ' + str(props2.Mass())

# the one still-pending hook (unbilled ParOnEdgeS1) raises with the marker;
# everything else the fork 05d088d round closed is exercised in t8
from OCP.BRepExtrema import BRepExtrema_DistShapeShape
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeVertex
v1 = BRepBuilderAPI_MakeVertex(gp_Pnt(0, 0, 5)).Vertex()
e2b = BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(4, 0, 0)).Edge()
dss5 = BRepExtrema_DistShapeShape(e2b, v1)
assert dss5.IsDone()
try:
    dss5.ParOnEdgeS1(1)
    raise AssertionError('ParOnEdgeS1 should raise (no helper bound)')
except Exception as e:
    assert 'PENDING_FORK_BINDING' in str(e), str(e)
print('T5 OK tangency tuple+mutation, ProjectPointOnCurve.Parameter, FilletAlgo.Result rebinding, PENDING hook (ParOnEdgeS1)')
`,
  't6-numpy-micro': `
# pytopo=upstream serves the numpy MICRO-shim (billed surface only):
# the exact Axis._intersect_axis math, cross, linspace. Anything else
# raises loudly.
import numpy as np

p1 = np.array([0.0, 0.0, 0.0])
d1 = np.array([1.0, 0.0, 0.0])
p2 = np.array([5.0, -5.0, 0.0])
d2 = np.array([0.0, 1.0, 0.0])
system_of_equations = np.array([d1, -d2, np.cross(d1, d2)]).T
origin_diff = p2 - p1
t1, _, _ = np.linalg.lstsq(system_of_equations, origin_diff, rcond=None)[0]
intersection_point = p1 + t1 * d1
pt = list(intersection_point)
assert all(abs(a - b) < 1e-9 for a, b in zip(pt, [5.0, 0.0, 0.0])), 'axis intersection ' + str(pt)
ls = list(np.linspace(0, 1, 5, endpoint=False))
assert all(abs(a - b) < 1e-12 for a, b in zip(ls, [0.0, 0.2, 0.4, 0.6, 0.8])), 'linspace ' + str(ls)
try:
    np.zeros((3, 3))
    raise AssertionError('np.zeros should raise')
except (NotImplementedError, AttributeError):
    pass
print('T6 OK numpy micro-shim: lstsq intersection, linspace, out-of-bill raises')
`,
  't7-constrained-verbatim': `
# Upstream topology/constrained_lines.py + one_d's own overload dispatchers
# run VERBATIM (Geom2dGcc over the shim); every solver family must agree
# with the harness-validated LITE kernel path on identical inputs
# (count + sorted lengths). The lite side is built from lite's own classes.
from build123d import *
import build123d_lite as _lt

c1 = CenterArc((4, 0), 2, 0, 360)
c2 = CenterArc((0, 2), 1.5, 0, 360)
e1, e2 = c1.edge(), c2.edge()
le1 = _lt.CenterArc((4, 0), 2, 0, 360, mode=_lt.Mode.PRIVATE).edge()
le2 = _lt.CenterArc((0, 2), 1.5, 0, 360, mode=_lt.Mode.PRIVATE).edge()

def lite_arcs(*args, **kw):
    return [_lt.Edge(t) for t in _lt._constrained_arc_topos(list(args), **kw)]

def lite_lines(*args, **kw):
    return [_lt.Edge(t) for t in _lt._constrained_line_topos(list(args), **kw)]

def compare(tag, up, lt):
    assert len(up) > 0, tag + ': no upstream solutions'
    assert len(up) == len(lt), tag + ': count %d vs lite %d' % (len(up), len(lt))
    ul = sorted(e.length for e in up)
    ll = sorted(e.length for e in lt)
    for a, b in zip(ul, ll):
        assert abs(a - b) < 1e-6, tag + ': length %r vs %r' % (ul, ll)

compare('2tan+rad',
        Edge.make_constrained_arcs(e1, e2, radius=6),
        lite_arcs(le1, le2, radius=6, sagitta=_lt.Sagitta.SHORT))
compare('qualified 2tan+rad',
        Edge.make_constrained_arcs((e1, Tangency.OUTSIDE), (e2, Tangency.OUTSIDE), radius=6),
        lite_arcs((le1, _lt.Tangency.OUTSIDE), (le2, _lt.Tangency.OUTSIDE),
                  radius=6, sagitta=_lt.Sagitta.SHORT))
c3 = CenterArc((2, -4), 1.0, 0, 360)
e3 = c3.edge()
le3 = _lt.CenterArc((2, -4), 1.0, 0, 360, mode=_lt.Mode.PRIVATE).edge()
compare('3tan',
        Edge.make_constrained_arcs(e1, e2, e3),
        lite_arcs(le1, le2, le3, sagitta=_lt.Sagitta.SHORT))
compare('tan+center',
        Edge.make_constrained_arcs(e1, center=(0, -4)),
        lite_arcs(le1, center=(0, -4)))
compare('2tan lines',
        Edge.make_constrained_lines(e1, e2),
        lite_lines(le1, le2))
compare('oriented lines',
        Edge.make_constrained_lines(e1, Axis.X, angle=30),
        lite_lines(le1, _lt.Axis.X, angle=30))
print('T7 OK verbatim constrained_lines agrees with the lite kernel path (6 families)')
`,
  't8-fork-05d088d-bindings': `
# Integration round for fork 05d088d: every closed PENDING_FORK_BINDING
# hook exercised with real geometry through the shim.
import math
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_ShapeEnum
from OCP.TopoDS import TopoDS, TopoDS_CompSolid
from OCP.BRep import BRep_Tool, BRep_Builder
from OCP.BRepTools import BRepTools
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps

box = BRepPrimAPI_MakeBox(2, 3, 4).Shape()
ex = TopExp_Explorer(box, TopAbs_ShapeEnum.TopAbs_FACE)
face = TopoDS.Face(ex.Current())
ex2 = TopExp_Explorer(face, TopAbs_ShapeEnum.TopAbs_EDGE)
edge = TopoDS.Edge(ex2.Current())

# BRep_Tool.Range_s — 1-arg AND (E, F) forms via the exact helper
first, last = BRep_Tool.Range_s(edge)
assert abs(last - first - 4.0) < 1e-9, 'Range ' + str((first, last))
f2, l2 = BRep_Tool.Range_s(edge, face)
assert (f2, l2) == (first, last), 'Range(E,F)'

# BRepTools.UVBounds_s
umin, umax, vmin, vmax = BRepTools.UVBounds_s(face)
assert abs((umax - umin) * (vmax - vmin) - 12.0) < 1e-9, 'UVBounds area'

# BRep_Tool.CurveOnSurface_s (upstream's 4-arg form returns the pcurve)
pcurve = BRep_Tool.CurveOnSurface_s(edge, face, first, last)
assert pcurve is not None, 'CurveOnSurface pcurve'
d0 = pcurve.Value(first)
assert hasattr(d0, 'X'), 'pcurve Value'

# GProp: StaticMoments + PrincipalProps.Moments + gp_Mat.Value
props = GProp_GProps()
BRepGProp.VolumeProperties_s(box, props)
ix, iy, iz = props.StaticMoments()
assert abs(ix - 24.0) < 1e-6 and abs(iy - 36.0) < 1e-6 and abs(iz - 48.0) < 1e-6, \\
    'StaticMoments ' + str((ix, iy, iz))
pp = props.PrincipalProperties()
m1, m2, m3 = pp.Moments()
assert abs(sorted([m1, m2, m3])[0] - 26.0) < 1e-6, 'principal moments ' + str((m1, m2, m3))
ax1 = pp.FirstAxisOfInertia()
assert abs(ax1.X() ** 2 + ax1.Y() ** 2 + ax1.Z() ** 2 - 1.0) < 1e-9, 'axis unit'
mat = props.MatrixOfInertia()
assert abs(mat.Value(1, 1) - 50.0) < 1e-6, 'gp_Mat.Value ' + str(mat.Value(1, 1))

# TopoDS.CompSolid downcast (new lut entries)
builder = BRep_Builder()
cs = TopoDS_CompSolid()
builder.MakeCompSolid(cs)
builder.Add(cs, box)
generic = TopExp_Explorer(cs, TopAbs_ShapeEnum.TopAbs_COMPSOLID).Current()
casted = TopoDS.CompSolid_s(generic)
assert casted.ShapeType() == TopAbs_ShapeEnum.TopAbs_COMPSOLID, 'CompSolid cast'

# Extrema_ExtPC over an adaptor ('unbindable for a year' #1) — upstream
# Wire.param_at's exact call shape, incl. Extrema_POnCurv accessors
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.gp import gp_Pnt
ad = BRepAdaptor_Curve(edge)
extrema = None
from OCP.Extrema import Extrema_ExtPC
extrema = Extrema_ExtPC(gp_Pnt(0.5, 0.1, 0.1), ad)
assert extrema.IsDone() and extrema.NbExt() >= 1, 'ExtPC NbExt'
best = None
for i in range(1, extrema.NbExt() + 1):
    d = extrema.SquareDistance(i)
    if best is None or d < best[0]:
        best = (d, extrema.Point(i).Parameter(), extrema.Point(i).Value())
assert best is not None and abs(best[0] - 0.26) < 1e-9, 'ExtPC sqdist ' + str(best[0])  # edge runs along Z at (0,0): closest (0,0,0.1)
assert hasattr(best[2], 'X'), 'POnCurv.Value gp_Pnt'

# BRepOffset_MakeOffset ('unbindable for a year' #2) — upstream
# offset_topods_face's exact call shape: kwargs Initialize + enum default
from OCP.BRepOffset import BRepOffset_MakeOffset
offsetor = BRepOffset_MakeOffset()
offsetor.Initialize(face, Offset=0.5, Tol=1e-6)
offsetor.MakeOffsetShape()
off = offsetor.Shape()
oprops = GProp_GProps()
BRepGProp.SurfaceProperties_s(off, oprops)
assert abs(oprops.Mass() - 12.0) < 1e-6, 'offset face area ' + str(oprops.Mass())

# BRepExtrema_DistShapeShape.ParOnEdgeS2 (helper glue)
from OCP.BRepExtrema import BRepExtrema_DistShapeShape
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeVertex, BRepBuilderAPI_MakeEdge
v = BRepBuilderAPI_MakeVertex(gp_Pnt(1.0, -2.0, 0.0)).Vertex()
e_line = BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(4, 0, 0)).Edge()
dss = BRepExtrema_DistShapeShape(v, e_line)
assert dss.IsDone() and dss.NbSolution() >= 1
(t_par,) = dss.ParOnEdgeS2(1)
assert abs(t_par - 1.0) < 1e-9, 'ParOnEdgeS2 ' + str(t_par)

# GeomAPI_ExtremaCurveCurve.Parameters (helper glue)
from OCP.GeomAPI import GeomAPI_ExtremaCurveCurve
from OCP.Geom import Geom_Line
from OCP.gp import gp_Dir
l1 = Geom_Line(gp_Pnt(0, 0, 0), gp_Dir(1, 0, 0))
l2 = Geom_Line(gp_Pnt(2, 5, 3), gp_Dir(0, 1, 0))
ecc = GeomAPI_ExtremaCurveCurve(l1, l2)
assert ecc.NbExtrema() >= 1
u1, u2 = ecc.Parameters(1)
assert abs(u1 - 2.0) < 1e-9 and abs(u2 + 5.0) < 1e-9, 'ECC params ' + str((u1, u2))

# TopTools_HSequenceOfShape + ShapeAnalysis_FreeBounds.ConnectEdgesToWires
# (the binding COMPROMISE(edges-to-wires) waited for)
from OCP.TopTools import TopTools_HSequenceOfShape
from OCP.ShapeAnalysis import ShapeAnalysis_FreeBounds
seq = TopTools_HSequenceOfShape()
seq.Append(BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(1, 0, 0)).Edge())
seq.Append(BRepBuilderAPI_MakeEdge(gp_Pnt(1, 0, 0), gp_Pnt(1, 1, 0)).Edge())
assert seq.Length() == 2
wires_out = ShapeAnalysis_FreeBounds.ConnectEdgesToWires_s(seq, 1e-6, False)
assert wires_out is not None and wires_out.Length() == 1, 'ConnectEdgesToWires'
w0 = TopoDS.Wire(wires_out.Value(1))
wprops = GProp_GProps()
BRepGProp.LinearProperties_s(w0, wprops)
assert abs(wprops.Mass() - 2.0) < 1e-9, 'joined wire length'

# HArray2 pair (Face.make_bezier_surface inputs)
from OCP.TColgp import TColgp_HArray2OfPnt
from OCP.TColStd import TColStd_HArray2OfReal
pts = TColgp_HArray2OfPnt(1, 2, 1, 2)
for r in (1, 2):
    for c in (1, 2):
        pts.SetValue(r, c, gp_Pnt(float(r), float(c), 0.0))
assert pts.NbRows() == 2 and pts.NbColumns() == 2
assert pts.Value(2, 1).X() == 2.0
ws = TColStd_HArray2OfReal(1, 2, 1, 2)
ws.SetValue(1, 1, 2.5)
assert abs(ws.Value(1, 1) - 2.5) < 1e-12

# TopTools_SequenceOfShape + IndexedMapOfShape (topo_explore_connected_faces)
from OCP.TopTools import TopTools_SequenceOfShape, TopTools_IndexedMapOfShape
sq = TopTools_SequenceOfShape()
sq.Append(box)
assert sq.Length() == 1
imap = TopTools_IndexedMapOfShape()
from OCP.TopExp import TopExp
TopExp.MapShapes_s(box, TopAbs_ShapeEnum.TopAbs_FACE, imap)
assert imap.Extent() == 6, 'IndexedMap faces ' + str(imap.Extent())

# NCollection_Utf8String stays a PERMANENT-SKIP (deliberate)
from OCP.NCollection import NCollection_Utf8String
try:
    NCollection_Utf8String()
    raise AssertionError('Utf8String should raise')
except NotImplementedError as e:
    assert 'PERMANENT-SKIP' in str(e), str(e)
print('T8 OK fork 05d088d: Range/UVBounds/CurveOnSurface/StaticMoments/'
      'PrincipalProps/gp_Mat/CompSolid/ExtPC/MakeOffset/ParOnEdgeS2/'
      'ECC.Parameters/HSequence+ConnectEdges/HArray2/Seq+IndexedMap')
`,
  't4-shape-core-selectors': `
# build123d.topology.shape_core IS upstream's module now: selectors over
# upstream-built shapes (the OCCT-heavy filter_by(Plane) predicate included)
import sys
sc = sys.modules['build123d.topology.shape_core']
from build123d import *
b = Box(2, 3, 4)
sl = sc.ShapeList(b.faces())
assert len(sl) == 6
top = sl.sort_by(Axis.Z)[-1]
assert abs(tuple(top.center())[2] - 2.0) < 1e-9, 'sort_by top face'
groups = sl.group_by(Axis.Z)
assert len(groups[-1]) == 1
filtered = sl.filter_by(Plane.XY)
assert len(filtered) == 2, 'filter_by Plane.XY: ' + str(len(filtered))
print('T4 OK upstream shape_core selectors over upstream faces')
`,
  't9-geometry-verbatim': `
# PHASE 1 gate: upstream geometry.py VERBATIM — Vector/Axis/Plane/Location/
# Matrix/BoundBox constructed and operated, Axis intersection via the numpy
# micro-shim, Plane/Location round-trips, Rotation Euler round-trip.
import math
from build123d import *
from build123d.geometry import Matrix, BoundBox

v = Vector(1, 2, 3)
assert abs((v + (1, 1, 1)).length - math.sqrt(4 + 9 + 16)) < 1e-12
assert tuple(v.cross(Vector(0, 0, 1))) == (2.0, -1.0, 0.0)

# Axis.intersect(Axis) is the np.linalg.lstsq path
a1 = Axis((0, 0, 0), (1, 0, 0))
a2 = Axis((5, -5, 0), (0, 1, 0))
p = a1.intersect(a2)
assert p is not None and (p - Vector(5, 0, 0)).length < 1e-9, 'axis intersect ' + str(p)

# Plane round-trips: offset, rotated, Plane(Location(plane)) identity
pl = Plane.XY.offset(5)
assert abs(pl.origin.Z - 5.0) < 1e-12
pl2 = Plane(pl.location)
assert (pl2.origin - pl.origin).length < 1e-12
assert (pl2.z_dir - pl.z_dir).length < 1e-12
plr = Plane.XY.rotated((45, 0, 0))
assert abs(plr.z_dir.dot(Plane.XY.z_dir) - math.cos(math.radians(45))) < 1e-9

# Location: position/orientation round-trip (GetEulerAngles glue)
loc = Location((1, 2, 3), (10, 20, 30))
t, r = tuple(loc)
assert (t - Vector(1, 2, 3)).length < 1e-9
assert all(abs(a - b) < 1e-9 for a, b in zip(tuple(r), (10.0, 20.0, 30.0))), \\
    'orientation ' + str(tuple(r))
li = loc * loc.inverse()
assert (li.position - Vector(0, 0, 0)).length < 1e-9

# Rotation algebra
rot = Rotation(0, 0, 90)
pv = (rot * Location((1, 0, 0))).position
assert (pv - Vector(0, 1, 0)).length < 1e-9, 'rotated pos ' + str(pv)

# Matrix (rotate takes DEGREES upstream)
m = Matrix()
m.rotate(Axis.Z, 90)
mv = m.multiply(Vector(1, 0, 0))
assert (mv - Vector(0, 1, 0)).length < 1e-9, 'matrix rotate ' + str(mv)

# BoundBox over an upstream shape (exact Bnd_Box)
bb = Box(2, 4, 6).bounding_box()
assert all(abs(a - b) < 1e-6 for a, b in zip(tuple(bb.size), (2.0, 4.0, 6.0)))
print('T9 OK upstream geometry verbatim (Vector/Axis/Plane/Location/Rotation/Matrix/BoundBox)')
`,
  't10-buildpart-glue': `
# PHASE 2 gate: a real builder flow end-to-end over the full upstream stack
# + the worker glue (show -> sceneShapes raw TopoDS, measurement hook).
import math
from browser import self as w
import build123d as b123d
from build123d import *

with BuildPart() as bp:
    Box(10, 10, 5)
    Cylinder(3, 5, mode=Mode.SUBTRACT)
    fillet(bp.edges().filter_by(Axis.Z), 1)

expected = 500.0 - math.pi * 9 * 5 - (1.0 - math.pi / 4.0) * 5.0 * 4.0
assert abs(bp.part.volume - expected) < 1e-6, 'volume %r vs %r' % (bp.part.volume, expected)

show(bp)
n = int(w.sceneShapes.length)
assert n == 1, 'sceneShapes after show: ' + str(n)
raw = w.sceneShapes[0]
assert hasattr(raw, 'ShapeType') or str(type(raw).__name__) == 'JsProxy', 'raw scene member'

meas = b123d._measure_globals_json({'bp': bp, 'x': 5})
assert '"bp"' in meas and '"volume"' in meas, meas
import json as _json  # noqa: F401 (string check only; shim json is fine)
assert str(round(expected, 3))[:6] in meas, 'measured volume in ' + meas
print('T10 OK BuildPart flow + show/sceneShapes + measurement over the full upstream stack')
`,
};

const only = process.argv[2];
const scripts = only && TESTS[only] ? { [only]: TESTS[only] } :
  (only ? { [only]: fs.readFileSync(only, 'utf8') } : TESTS);

let failed = 0;
for (const [name, code] of Object.entries(scripts)) {
  console.log('\n=== ' + name + ' ===');
  self.sceneShapes.length = 0;
  try {
    runtime.run(code);
  } catch (e) {
    failed++;
    console.log('FAIL:\n' + (e && e.message ? e.message : e));
  }
}
console.log(failed ? '\n' + failed + ' FAILED' : '\nALL OK');
process.exit(failed ? 1 : 0);
