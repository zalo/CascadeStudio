// The incremental mesher (packages/cascade-core/src/worker/IncrementalMesher.js)
// against a fresh mesh of the same scene: a face served from the geometry-
// keyed cache must cover the same surface as one meshed now. Also: a re-run
// reuses every face, an edit reuses some, and the cache survives the kernel
// rewind a compaction does (snapshot -> resetKernel -> restore).
// maker_coin and heat_exchanger come from /tmp/perf/models (the editor
// bench's models, examples/cloudflare-worker/scripts/editor-bench.mjs);
// models that are not there are skipped.
//
//   npm run build && node test/incremental-mesh.mjs
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = join(ROOT, 'packages', 'cascade-core', 'dist') + '/';
const fonts = {};
for (const f of fs.readdirSync(D + 'fonts')) { if (f.endsWith('.ttf')) { fonts[f.slice(0, -4)] = fs.readFileSync(D + 'fonts/' + f); } }
const { createHeadlessCascade } = await import(pathToFileURL(D + 'cascade-headless.mjs').href);
const e = await createHeadlessCascade({ occtWasm: fs.readFileSync(D + 'cascadestudio.wasm'),
  micropythonJs: await import(pathToFileURL(D + 'micropython-cs.mjs').href),
  micropythonWasm: fs.readFileSync(D + 'micropython-cs.wasm'), fonts, stableCache: true });

let failed = 0;
const check = (what, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + what + (detail ? '  — ' + detail : ''));
  if (!ok) { failed++; }
};

const BOX = `from build123d import *
with BuildPart() as p:
    Box(40, 30, 10)
    fillet(p.edges().filter_by(Axis.Z), 3)
    with Locations((0, 0, 5)):
        Cylinder(8, 12, align=(Align.CENTER, Align.CENTER, Align.MIN))
    Hole(HOLE)
other = Pos(60, 0, 0) * Sphere(8)
show(p.part, other)
`;
const models = [
  ['box', BOX.replace('HOLE', '4'), BOX.replace('HOLE', '5')],
  ['maker_coin', '/tmp/perf/models/maker_coin.py',
    ['fillet(maker_coin.edges(Select.NEW), 2)', 'fillet(maker_coin.edges(Select.NEW), 1.5)']],
  ['heat_exchanger', '/tmp/perf/models/heat_exchanger.py',
    ['fillet_radius = tube_spacing / 3', 'fillet_radius = tube_spacing / 4']],
];

async function meshOf(code) {
  const r = await e.run(code, { keepScene: true });
  if (!r.ok) { throw new Error(r.errors.join(' | ')); }
  const m = e.meshScene({ maxDeviation: 0.1 });
  const faces = []; const edges = [];
  let batches = 0; let stats;
  for (;;) {
    const { value, done } = m.batches.next();
    if (done) { stats = value; break; }
    batches++;
    faces.push(...value.faces); edges.push(...value.edges);
  }
  faces.sort((a, b) => a.slot - b.slot);
  edges.sort((a, b) => a.slot - b.slot);
  return { faces, edges, stats, batches, shapeLines: m.shapeLines };
}

/** Per face: triangle-area sum and bounding box (what a stale mesh breaks). */
function measure(f) {
  const v = f.vertex_coord; const t = f.tri_indexes;
  let area = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    area += 0.5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
  }
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) {
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[i + k]); hi[k] = Math.max(hi[k], v[i + k]); }
  }
  return { area, lo, hi };
}

function sameSurface(a, b) {
  if (a.length !== b.length) { return 'face count ' + a.length + ' vs ' + b.length; }
  for (let i = 0; i < a.length; i++) {
    const ma = measure(a[i]); const mb = measure(b[i]);
    const dArea = Math.abs(ma.area - mb.area) / Math.max(1e-9, mb.area);
    const dBox = Math.max(...[0, 1, 2].map((k) => Math.max(Math.abs(ma.lo[k] - mb.lo[k]), Math.abs(ma.hi[k] - mb.hi[k]))));
    if (dArea > 1e-3 || dBox > 1e-3 || a[i].face_index !== b[i].face_index || a[i].shape_index !== b[i].shape_index) {
      return 'slot ' + i + ': area ' + ma.area.toFixed(4) + ' vs ' + mb.area.toFixed(4) + ', bbox off by ' + dBox.toExponential(2);
    }
  }
  return null;
}

for (const [name, src, edit] of models) {
  if (!src.includes('\n') && !fs.existsSync(src)) { console.log(name + ': skipped (no ' + src + ')'); continue; }
  console.log(name);
  const code = src.includes('\n') ? src : fs.readFileSync(src, 'utf8');
  const edited = typeof edit === 'string' ? edit : code.replace(edit[0], edit[1]);
  e.meshCache.clear();
  const a = await meshOf(code);
  check('first mesh: every face meshed', a.stats.meshed === a.faces.length && a.stats.reused === 0,
    a.stats.meshed + ' meshed, ' + a.stats.reused + ' reused, ' + a.batches + ' batches');
  const reference = (await e.run(code, { mesh: true, maxDeviation: 0.1 })).mesh;
  check('same faces and edges as ShapeToMesh', a.faces.length === reference[0].length && a.edges.length === reference[1].length,
    a.faces.length + '/' + reference[0].length + ' faces, ' + a.edges.length + '/' + reference[1].length + ' edges');
  check('shapeLines carried', a.shapeLines.length > 0 && a.shapeLines.every((l) => l > 0), JSON.stringify(a.shapeLines));
  const rerun = await meshOf(code);
  check('re-run: every face reused', rerun.stats.reused === rerun.faces.length && rerun.stats.meshed === 0,
    rerun.stats.reused + '/' + rerun.faces.length);
  const b = await meshOf(edited);
  check('edit: some faces reused, the rest meshed', b.stats.reused > 0 && b.stats.meshed > 0,
    b.stats.reused + ' reused, ' + b.stats.meshed + ' meshed of ' + b.faces.length);
  e.meshCache.clear();
  const fresh = await meshOf(edited);
  const diff = sameSurface(b.faces, fresh.faces);
  check('the reused faces cover the same surface as a fresh mesh', diff === null, diff || '');
  // Same vertices as a fresh mesh: a reused face's boundary then matches its
  // re-meshed neighbours exactly as in a fresh mesh (which is conforming).
  const vkey = (f) => Array.from(f.vertex_coord, (x) => x.toFixed(5)).join(',');
  let identical = 0;
  for (let i = 0; i < b.faces.length; i++) { if (vkey(b.faces[i]) === vkey(fresh.faces[i])) { identical++; } }
  check('faces with the same vertices as a fresh mesh', identical === b.faces.length,
    identical + '/' + b.faces.length);
  // compaction: snapshot, rewind the kernel, restore — every shape gets a new identity
  const snap = e.snapshotCache();
  e.resetKernel();
  e.restoreCache(snap);
  const after = await meshOf(edited);
  check('after a kernel rewind the cache still serves every face', after.stats.reused === after.faces.length,
    after.stats.reused + '/' + after.faces.length);
  check('mesh cache within its cap', e.meshCache.bytes <= e.meshCache.maxBytes, JSON.stringify(e.meshCache.stats()));
}

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('ALL INCREMENTAL MESH CHECKS PASSED');
