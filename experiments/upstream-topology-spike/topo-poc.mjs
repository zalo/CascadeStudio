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

# PENDING_FORK_BINDING hooks raise loudly, with the marker in the message
from OCP.BRepOffset import BRepOffset_MakeOffset
try:
    BRepOffset_MakeOffset()
    raise AssertionError('BRepOffset_MakeOffset should raise')
except NotImplementedError as e:
    assert 'PENDING_FORK_BINDING' in str(e), str(e)
props3 = GProp_GProps()
try:
    props3.StaticMoments()
    raise AssertionError('StaticMoments should raise')
except Exception as e:
    assert 'PENDING_FORK_BINDING' in str(e), str(e)
print('T5 OK tangency tuple+mutation, ProjectPointOnCurve.Parameter, FilletAlgo.Result rebinding, PENDING hooks')
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
  't4-shape-core-import': `
import b123d_shape_core_u as sc
from build123d import *
b = Box(2, 3, 4)
# upstream ShapeList over LITE shapes (duck-typed members)
sl = sc.ShapeList(b.faces())
assert len(sl) == 6
top = sl.sort_by(Axis.Z)[-1]
assert abs(tuple(top.center())[2] - 2.0) < 1e-9, 'sort_by top face'
groups = sl.group_by(Axis.Z)
assert len(groups[-1]) == 1
filtered = sl.filter_by(Plane.XY)
assert len(filtered) == 2, 'filter_by Plane.XY: ' + str(len(filtered))
print('T4 OK upstream ShapeList selectors over lite faces')
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
