// mesh-sig.mjs — mesh-equivalence gate for the streaming-mesher round.
// Captures a deterministic signature of the FULL mesh payload (per-face
// vertex/normal/uv/triangle buffers + face_index/shape_index, per-edge
// buffers + edge_index/shape_index, shapeLines) for a set of corpus models.
//   CS_TEST_HEADFUL=1 DISPLAY=:99 CS_TEST_PORT=8452 \
//     node experiments/heavy-memory/mesh-sig.mjs /tmp/sig-before.json
// Then rebuild and compare with a second run + diff of the two JSONs.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/mesh-sig.json';
const PORT = parseInt(process.env.CS_TEST_PORT || '8452', 10);
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;

const GRID = `from build123d import *
with BuildPart() as plate:
    Box(150, 100, 10)
    fillet(plate.edges().filter_by(Axis.Z), radius=6)
    with GridLocations(15, 15, 9, 6):
        Hole(radius=3)
show(plate)
`;

const JS_MULTI = `
// multi-sceneShape scene: several top-level solids + free edges (wire, open bspline)
Box(30, 20, 10);
Translate([50, 0, 0], Sphere(15));
Translate([-50, 0, 0], Cylinder(10, 25));
let w = Circle(40, true);
Translate([0, 60, 0], BSpline([[0,0,0],[10,10,5],[20,-5,10]], false));
`;

const JS_EDGY = `
// edges-heavy: fillets + a hollowed boolean + sketch wires
let b = FilletEdges(Box(20, 20, 20), 3, [0, 1, 2, 3]);
Translate([45, 0, 0], Difference(Box(20, 20, 20, true), [Sphere(12)]));
let profile = new Sketch([-10,-10]).LineTo([10,-10]).Fillet(4)
  .LineTo([10,10]).Fillet(4).LineTo([-10,10]).End(true);
Translate([-45, 0, 0], profile);
`;

const MODELS = [
  { name: 'js-multi', mode: 'cascadestudio', code: JS_MULTI },
  { name: 'js-edgy', mode: 'cascadestudio', code: JS_EDGY },
  { name: 'py-starter', mode: 'python', code: null }, // filled from the app class
  { name: 'py-grid', mode: 'python', code: GRID },
  { name: 'py-heavy', mode: 'python', code: HEAVY },
];

async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto(`http://localhost:${PORT}/?mode=python`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });

  // Hook renderMeshData to capture a signature of every mesh payload.
  await page.evaluate(() => {
    const vp = window.CascadeAPI._app.viewport;
    const orig = vp.renderMeshData.bind(vp);
    const hashArr = (h, arr) => {
      for (let i = 0; i < arr.length; i++) {
        // quantize: payload should be bit-identical; 2^16 scaling flags any
        // real change while ignoring nothing-burgers at the 1e-10 level
        h = Math.imul(h ^ (Math.round(arr[i] * 65536) | 0), 16777619) | 0;
      }
      return h;
    };
    window.__meshSigs = [];
    vp.renderMeshData = (md, so) => {
      try {
        if (md && md.faces) {
          let h = 2166136261 | 0;
          let nv = 0, nt = 0, ne = 0, nev = 0;
          const faceMeta = [], edgeMeta = [];
          for (const f of md.faces) {
            nv += f.vertex_coord.length / 3; nt += f.number_of_triangles;
            faceMeta.push([f.face_index, f.shape_index, f.vertex_coord.length, f.number_of_triangles]);
            h = hashArr(h, f.vertex_coord); h = hashArr(h, f.normal_coord);
            h = hashArr(h, f.uv_coord); h = hashArr(h, f.tri_indexes);
          }
          for (const e of md.edges) {
            ne++; nev += e.vertex_coord.length / 3;
            edgeMeta.push([e.edge_index, e.shape_index, e.vertex_coord.length]);
            h = hashArr(h, e.vertex_coord);
          }
          window.__meshSigs.push({
            faces: md.faces.length, vertices: nv, triangles: nt,
            edges: ne, edgeVertices: nev, hash: h >>> 0,
            shapeLines: (md.shapeLines || []).slice(),
            faceMeta, edgeMeta
          });
        }
      } catch (err) { window.__meshSigs.push({ error: String(err) }); }
      return orig(md, so);
    };
  });

  const results = {};
  for (const m of MODELS) {
    const code = m.code || await page.evaluate(() =>
      window.CascadeAPI._app.constructor.PYTHON_STARTER_CODE);
    await page.evaluate((mode) => window.CascadeAPI.setMode(mode), m.mode);
    const before = await page.evaluate(() => window.__meshSigs.length);
    await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
    await page.waitForFunction((n) => window.__meshSigs.length > n, before, { timeout: 60000 });
    const sig = await page.evaluate(() => window.__meshSigs[window.__meshSigs.length - 1]);
    results[m.name] = sig;
    console.log(m.name + ': faces=' + sig.faces + ' verts=' + sig.vertices +
      ' tris=' + sig.triangles + ' edges=' + sig.edges + ' edgeVerts=' + sig.edgeVertices +
      ' hash=' + sig.hash + ' shapeLines=[' + sig.shapeLines + ']');
  }
  writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log('wrote ' + OUT);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
