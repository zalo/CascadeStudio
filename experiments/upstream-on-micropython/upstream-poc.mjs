// upstream-poc.mjs — node inner loop for the UPSTREAM-build123d-on-MicroPython
// proof of concept. Boots the REAL MicroPythonRuntime (pysrc=upstream) with a
// SEMANTIC MOCK of the worker CAD library (lines/boxes with exact analytic
// geometry — enough for the Level-A control-flow: classification, builders,
// alignment, fusion bookkeeping). Real-OCCT numbers are verified in the
// browser afterwards; this loop exists because it runs in ~2 s instead of a
// rebuild + page reload.
//
//   node experiments/upstream-on-micropython/upstream-poc.mjs [script.py]
//
// Prints every w.<fn> call the seam makes (first use), then runs the two
// goal scripts and reports measured length/volume/bbox.
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MP_DIR = join(ROOT, 'node_modules', '@micropython', 'micropython-webassembly-pyscript');
const B123D_SRC = process.env.B123D_SRC ||
  join(process.env.HOME, 'Desktop', 'ocjs-deps', 'b123d-ref-venv', 'lib', 'python3.12', 'site-packages', 'build123d');

// ---------------------------------------------------------------------- //
// worker-global shim (the node stand-in for the Web Worker's `self`)      //
// ---------------------------------------------------------------------- //
globalThis.self = globalThis;
self.argCache = {};
self.sceneShapes = [];

// ---------------------------------------------------------------------- //
// Semantic mock of the worker CAD library (StandardLibrary.js stand-in).  //
// Shapes are plain JS trees: {kind:'edge',p1,p2} {kind:'box',min,max}     //
// {kind:'compound',children} {kind:'face'|'vertex',...}                   //
// ---------------------------------------------------------------------- //
const seen = new Set();
const note = (n) => { if (!seen.has(n)) { seen.add(n); console.log('  [w-call] ' + n); } };
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
};
function walk(t, kinds, out) {
  if (!t) { return out; }
  if (t.kind === 'compound' || t.kind === 'wire') {
    for (const c of t.children) { walk(c, kinds, out); }
    return out;
  }
  if (kinds.includes(t.kind)) { out.push(t); }
  // boxes decompose into synthetic sub-shapes on demand
  if (t.kind === 'box') {
    if (kinds.includes('face')) {
      for (let i = 0; i < 6; i++) { out.push({ kind: 'face', of: t, i }); }
    }
    if (kinds.includes('edge')) {
      for (const [a, b] of boxEdges(t)) { out.push({ kind: 'edge', p1: a, p2: b }); }
    }
    if (kinds.includes('vertex')) {
      for (const p of boxCorners(t)) { out.push({ kind: 'vertex', p }); }
    }
  }
  if (t.kind === 'edge' && kinds.includes('vertex')) {
    out.push({ kind: 'vertex', p: t.p1 }, { kind: 'vertex', p: t.p2 });
  }
  return out;
}
function boxCorners(t) {
  const [a, b] = [t.min, t.max]; const out = [];
  for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) out.push([x, y, z]);
  return out;
}
function boxEdges(t) {
  const c = boxCorners(t); const idx = [[0, 1], [0, 2], [0, 4], [3, 1], [3, 2], [3, 7],
    [5, 1], [5, 4], [5, 7], [6, 2], [6, 4], [6, 7]];
  return idx.map(([i, j]) => [c[i], c[j]]);
}
function bboxOf(t) {
  const pts = [];
  walk(t, ['edge', 'box', 'vertex', 'face'], []).forEach((s) => {
    if (s.kind === 'edge') { pts.push(s.p1, s.p2); }
    else if (s.kind === 'box') { pts.push(s.min, s.max); }
    else if (s.kind === 'vertex') { pts.push(s.p); }
    else if (s.kind === 'face') { pts.push(s.of.min, s.of.max); }
  });
  if (t.kind === 'box') { pts.push(t.min, t.max); }
  if (!pts.length) { return [0, 0, 0, 0, 0, 0]; }
  const mn = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
  const mx = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  return [...mn, ...mx];
}
function translate(t, d) {
  if (t.kind === 'edge') { return { kind: 'edge', p1: V.add(t.p1, d), p2: V.add(t.p2, d) }; }
  if (t.kind === 'box') { return { kind: 'box', min: V.add(t.min, d), max: V.add(t.max, d) }; }
  if (t.kind === 'compound' || t.kind === 'wire') {
    return { kind: t.kind, children: t.children.map((c) => translate(c, d)) };
  }
  if (t.kind === 'vertex') { return { kind: 'vertex', p: V.add(t.p, d) }; }
  throw new Error('mock translate: unsupported ' + t.kind);
}

const mock = {
  WireFromSegments: (segs) => ({
    kind: 'wire',
    children: segs.map((s) => {
      const [k, pts] = s;
      if (k !== 'line') { throw new Error('mock WireFromSegments: only line segs'); }
      return { kind: 'edge', p1: pts[0].slice(), p2: pts[1].slice() };
    }),
  }),
  Edges: (t) => { const es = walk(t, ['edge'], []); return { indices: () => es.map((_, i) => i + 1), edges: () => es }; },
  Faces: (t) => { const fsx = walk(t, ['face'], []); return { indices: () => fsx.map((_, i) => i + 1), faces: () => fsx }; },
  ForEachVertex: (t, cb) => { for (const v of walk(t, ['vertex'], [])) { cb(v); } },
  ForEachSolid: (t, cb) => { walk(t, ['box'], []).forEach((s, i) => cb(i, s)); },
  ForEachWire: (t, cb) => { walk(t, ['wire'], []).forEach((s, i) => cb(i, s)); },
  _vertexPoint: (v) => v.p,
  Union: (topos) => ({ kind: 'compound', children: topos.slice() }),
  MakeCompound: (topos) => ({ kind: 'compound', children: topos.slice() }),
  Translate: (d, t) => translate(t, d),
  Rotate: (axis, angle, t) => { throw new Error('mock Rotate: not needed for the PoC goals'); },
  Box: (l, w, h, centered) => centered
    ? { kind: 'box', min: [-l / 2, -w / 2, -h / 2], max: [l / 2, w / 2, h / 2] }
    : { kind: 'box', min: [0, 0, 0], max: [l, w, h] },
  SolidsVolume: (t) => walk(t, ['box'], []).reduce((acc, b) =>
    acc + (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]), 0),
  SurfaceArea: (t) => walk(t, ['box'], []).reduce((acc, b) => {
    const d = V.sub(b.max, b.min);
    return acc + 2 * (d[0] * d[1] + d[1] * d[2] + d[0] * d[2]);
  }, 0),
  EdgeLength: (t) => walk(t, ['edge'], []).reduce((acc, e) => acc + V.len(V.sub(e.p2, e.p1)), 0),
  BoundingBox: (t) => bboxOf(t),
  MeasureShape: (t) => ({
    volume: mock.SolidsVolume(t),
    area: mock.SurfaceArea(t),
    faces: walk(t, ['face'], []).length,
    edges: walk(t, ['edge'], []).length,
    bbox: bboxOf(t),
  }),
};
// class-DAG-unification seam: lite's Shape.__eq__/get_type read these
mock._sameShape = (a, b) => a === b;
mock.DirectChildren = (t) => (t && t.kind === 'compound' ? t.children.slice() : []);
// lite's get_type/_edge_chain dispatch on TopoDS ShapeType(); give the mock
// trees the same surface (7=vertex, 6=edge, 5=wire, 4=face, 2=solid, 0=comp)
const SHAPE_TYPE_CODE = { compound: 0, box: 2, face: 4, wire: 5, edge: 6, vertex: 7 };
function decorateShape(t) {
  if (t && typeof t === 'object' && t.kind && !t.ShapeType) {
    const code = SHAPE_TYPE_CODE[t.kind];
    if (code !== undefined) { t.ShapeType = () => ({ value: code }); }
    if (Array.isArray(t.children)) { t.children.forEach(decorateShape); }
  }
  return t;
}
for (const [name, fn] of Object.entries(mock)) {
  self[name] = (...args) => { note(name); return decorateShape(fn(...args)); };
}
// trap OTHER w calls loudly so gaps surface as named errors, not silence
self._csMockMissing = new Set();

// ---------------------------------------------------------------------- //
// Boot the real runtime (pysrc=upstream)                                  //
// ---------------------------------------------------------------------- //
self._csMicroPythonLocate = {
  mjsURL: join(MP_DIR, 'micropython.mjs'),
  wasmURL: join(MP_DIR, 'micropython-settrace.wasm'),
};
self._csUpstreamFetchText = async (rel) => {
  let p;
  if (rel.startsWith('upstream/')) { p = join(B123D_SRC, rel.slice('upstream/'.length)); }
  else { p = join(ROOT, 'packages', 'cascade-core', 'upstream-py', rel); }
  return fs.readFileSync(p, 'utf8');
};

const { ensureMicroPythonRuntime } = await import(
  join(ROOT, 'packages', 'cascade-core', 'src', 'worker', 'MicroPythonRuntime.js'));

const t0 = Date.now();
let runtime;
try {
  runtime = await ensureMicroPythonRuntime('upstream');
} catch (e) {
  console.error('BOOT FAILED:\n' + (e && e.message ? e.message : e));
  process.exit(1);
}
console.log('boot ok in ' + (Date.now() - t0) + ' ms');

const GOAL_SCRIPTS = {
  'goal1-buildline': [
    'from build123d import *',
    'with BuildLine() as l:',
    '    Line((0, 0), (10, 0))',
    '    Line((10, 0), (10, 10))',
    'res = l.line',
    'print("LENGTH", res.length)',
    'bb = res.bounding_box()',
    'print("BBOX", tuple(bb.min), tuple(bb.max))',
  ].join('\n'),
  'goal2-buildpart-box': [
    'from build123d import *',
    'with BuildPart() as p:',
    '    Box(5, 5, 5)',
    'part = p.part',
    'print("VOLUME", part.volume)',
    'bb = part.bounding_box()',
    'print("BBOX", tuple(bb.min), tuple(bb.max))',
  ].join('\n'),
};

const scripts = process.argv[2]
  ? { [process.argv[2]]: fs.readFileSync(process.argv[2], 'utf8') }
  : GOAL_SCRIPTS;

let failed = 0;
for (const [name, code] of Object.entries(scripts)) {
  console.log('\n=== ' + name + ' ===');
  try {
    runtime.run(code);
    console.log('OK');
  } catch (e) {
    failed++;
    console.log('FAIL:\n' + (e && e.message ? e.message : e));
  }
}
process.exit(failed ? 1 : 0);
