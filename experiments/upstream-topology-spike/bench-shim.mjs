// bench-shim.mjs — dispatcher-overhead measurements for the OCP shim
// (work item 5 of the hardening round). Boots exactly like topo-poc.mjs,
// then times:
//   A. micro: gp_Pnt ctor + .X() through the shim, vs the raw browser-
//      bridge JS call the shim rides on (the floor), vs a pure-Python
//      lite call of similar shape (lite Vector.X) — the "equivalent
//      direct lite call" of the 2x target
//   B. hot path: upstream ShapeList.filter_by(Plane.XY) over ~500 lite
//      faces (GeomLib_IsPlanarSurface + UVBounds + BRepGProp_Face.Normal
//      per face — the OCP-heaviest selector), vs lite's own
//      filter_by(Plane.XY) over the same faces
//
//   node experiments/upstream-topology-spike/bench-shim.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const B123D_SRC = process.env.B123D_SRC ||
  join(process.env.HOME, 'Desktop', 'ocjs-deps', 'b123d-ref-venv', 'lib', 'python3.12', 'site-packages', 'build123d');

globalThis.self = globalThis;
self.postMessage = () => {};

const ocMod = await import(join(ROOT, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.js'));
self.oc = await ocMod.default();

const esbuild = await import(join(ROOT, 'node_modules', 'esbuild', 'lib', 'main.js'));
const slBundle = join(HERE, '.standard-library.bundle.mjs');
await esbuild.build({
  entryPoints: [join(ROOT, 'packages', 'cascade-core', 'src', 'worker', 'StandardLibrary.js')],
  bundle: true, format: 'esm', outfile: slBundle, logLevel: 'silent',
});
const { CascadeStudioStandardLibrary } = await import(slBundle);
self.sceneShapes = [];
self.GUIState = {};
self.standardLibrary = new CascadeStudioStandardLibrary();

self._csPyTopo = 'upstream';
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
const runtime = await ensureMicroPythonRuntime('upstream');

const BENCH = `
import time

def rate(label, n, fn):
    t0 = time.ticks_us()
    fn(n)
    dt = time.ticks_diff(time.ticks_us(), t0) / 1e6
    print('%-42s %8d ops %8.3f s %12.0f ops/s' % (label, n, dt, n / dt))
    return n / dt

# ---- A. micro ---------------------------------------------------------- #
from OCP.gp import gp_Pnt
from browser import self as w
import build123d_lite as _lt

p = gp_Pnt(1.0, 2.0, 3.0)
raw = p._ref

def shim_ctor(n):
    for _ in range(n):
        gp_Pnt(1.0, 2.0, 3.0)

def shim_x(n):
    for _ in range(n):
        p.X()

def bridge_floor(n):
    for _ in range(n):
        w._csOcpCall(raw, 'X', [], None)

lv = _lt.Vector(1.0, 2.0, 3.0)

def lite_vec_x(n):
    for _ in range(n):
        lv.X

# NOTE: the floor call rides the SAME _Fn/_csMpCall guarded envelope every
# lite w.* call uses — it IS "the equivalent direct lite call" with a
# trivial body, so p.X()/floor is the dispatcher-overhead multiple
# (target: within 2x).
N = 20000
r_ctor = rate('A gp_Pnt(1,2,3) through the shim', N, shim_ctor)
r_x = rate('A p.X() through the shim', N, shim_x)
r_floor = rate('A lite-equivalent w.* bridge call (floor)', N, bridge_floor)
rate('A lite Vector.X (pure Python, reference)', N, lite_vec_x)
print('A shim p.X() overhead vs lite-equivalent call: %.2fx' % (r_floor / r_x))
print('A shim ctor overhead vs lite-equivalent call:  %.2fx' % (r_floor / r_ctor))

# ---- B. ShapeList.filter_by(Plane.XY) over ~500 lite faces ------------- #
import b123d_shape_core_u as sc
from build123d import *

w.sceneShapes.length = 0
faces = []
for i in range(84):
    b = Box(1 + (i % 5) * 0.25, 1, 1)
    faces.extend(b.faces())
print('faces:', len(faces))

sl = sc.ShapeList(faces)
t0 = time.ticks_us()
res_u = sl.filter_by(Plane.XY)
dt_u = time.ticks_diff(time.ticks_us(), t0) / 1e6
print('B upstream filter_by(Plane.XY): %.3f s -> %d faces  (%.2f ms/face)'
      % (dt_u, len(res_u), 1000.0 * dt_u / len(faces)))

lsl = _lt.ShapeList(faces)
t0 = time.ticks_us()
res_l = lsl.filter_by(Plane.XY)
dt_l = time.ticks_diff(time.ticks_us(), t0) / 1e6
print('B lite     filter_by(Plane.XY): %.3f s -> %d faces  (%.2f ms/face)'
      % (dt_l, len(res_l), 1000.0 * dt_l / len(faces)))
print('B upstream/lite ratio: %.2fx' % (dt_u / dt_l))
`;

runtime.run(BENCH);
