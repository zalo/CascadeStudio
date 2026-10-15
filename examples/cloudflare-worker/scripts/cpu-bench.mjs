// cpu-bench.mjs — where does a cascade-headless isolate spend its CPU?
//
//   node examples/cloudflare-worker/scripts/cpu-bench.mjs              # lite
//   CS_PY_SRC=upstream node examples/cloudflare-worker/scripts/cpu-bench.mjs
//   CS_DIST=/path/to/a/cascade-core/dist node …/cpu-bench.mjs           # a wasm variant
//   node …/cpu-bench.mjs --models examples/boxes_on_faces,ttt/ttt-ppp0101
//   node …/cpu-bench.mjs --json out.json
//
// Plain Node, the SHIPPED headless bundle, assets handed over exactly the way
// the Worker does (the OCCT wasm as an already-compiled WebAssembly.Module,
// the MicroPython wasm as a Module, fonts as bytes). It reports MAIN-THREAD
// CPU (`process.threadCpuUsage`) next to wall time for every phase, because
// main-thread CPU is the closest local stand-in for what Cloudflare bills:
// V8's background TurboFan tier-up and concurrent GC run on other threads
// (they are reported separately as `proc` = whole-process CPU).
//
// Phases, in the order an isolate meets them:
//   compile      WebAssembly.compile(occt bytes)  — workerd does this itself
//                for a CompiledWasm binding when it loads the script
//   boot         createHeadlessCascade(): instantiate, embind registration,
//                OCCT init, kernel-image snapshot #1
//   first-box    the first Python run: MicroPython + library boot, snapshot
//                #2, and V8's lazy (first-call) compilation of every wasm
//                function the Box -> STEP path touches
//   box-step     WARM: run(Box) + exportSTEP(), repeated — the per-request
//                cost once everything above has happened (e.g. at global
//                scope), which is what the Free plan's 10 ms is measured on
//   reset        engine.reset() (the kernel-image rewind between requests)
//   <model>      corpus models: first run (cold code paths) and a warm repeat

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DIST = process.env.CS_DIST || join(ROOT, 'packages', 'cascade-core', 'dist');
const PY_SRC = process.env.CS_PY_SRC || 'lite';
const REPEAT = Number(process.env.CS_REPEAT || 10);

const argIdx = (k) => process.argv.indexOf(k);
const DEFAULT_MODELS = [
  'examples/boxes_on_faces',
  'ttt/ttt-ppp0101',
  'examples/intersecting_pipes',
  'examples/build123d_logo',
  'ttt/ttt-24-SPO-06-Buffer_Stand',
];
const MODELS = argIdx('--models') >= 0
  ? String(process.argv[argIdx('--models') + 1]).split(',').filter(Boolean)
  : DEFAULT_MODELS;
const JSON_OUT = argIdx('--json') >= 0 ? process.argv[argIdx('--json') + 1] : null;

const manifest = JSON.parse(fs.readFileSync(
  join(ROOT, 'test', 'b123d-validation', 'manifest.json'), 'utf8'));

const results = { dist: DIST, pySrc: PY_SRC, node: process.version, phases: {} };

function cpuNow() {
  const t = process.threadCpuUsage();
  const p = process.cpuUsage();
  return { wall: performance.now(), thread: (t.user + t.system) / 1000,
    proc: (p.user + p.system) / 1000 };
}
function since(a) {
  const b = cpuNow();
  return { wall: b.wall - a.wall, cpu: b.thread - a.thread, proc: b.proc - a.proc };
}
function fmt(m) {
  return 'cpu ' + m.cpu.toFixed(1).padStart(8) + ' ms   wall ' + m.wall.toFixed(1).padStart(8)
    + ' ms   proc ' + m.proc.toFixed(1).padStart(8) + ' ms';
}
function record(name, m, extra) {
  results.phases[name] = Object.assign({ cpuMs: +m.cpu.toFixed(2), wallMs: +m.wall.toFixed(2),
    procMs: +m.proc.toFixed(2) }, extra || {});
  console.log(name.padEnd(34) + fmt(m) + (extra && extra.note ? '   ' + extra.note : ''));
}
function median(xs) { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

// ------------------------------------------------------------------ //
const occtBytes = fs.readFileSync(join(DIST, 'cascadestudio.wasm'));
const mpBytes = fs.readFileSync(join(DIST, 'micropython-cs.wasm'));
results.occtWasmBytes = occtBytes.length;
console.log('dist ' + DIST + '   occt wasm ' + (occtBytes.length / 1048576).toFixed(2)
  + ' MiB   pySrc ' + PY_SRC + '   node ' + process.version
  + '   v8 flags: ' + (process.execArgv.join(' ') || '(defaults)'));

let t = cpuNow();
const occtModule = await WebAssembly.compile(occtBytes);
record('compile occt wasm', since(t));
t = cpuNow();
const mpModule = await WebAssembly.compile(mpBytes);
record('compile micropython wasm', since(t));

const micropythonJs = await import(pathToFileURL(join(DIST, 'micropython-cs.mjs')).href);
const fonts = {};
for (const f of fs.readdirSync(join(DIST, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(DIST, 'fonts', f)); }
}
let upstreamPy;
if (PY_SRC === 'upstream') {
  // The Worker ships this tree as ONE path -> text map; read it the same way.
  const tree = {};
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { walk(join(dir, e.name), r); } else if (/\.(py|json)$/.test(e.name)) {
        tree[r] = fs.readFileSync(join(dir, e.name), 'utf8');
      }
    }
  };
  walk(join(DIST, 'upstream-b123d'), '');
  upstreamPy = async (rel) => tree[String(rel).replace(/^\.?\//, '')];
}

t = cpuNow();
const { createHeadlessCascade } = await import(pathToFileURL(join(DIST, 'cascade-headless.mjs')).href);
record('import engine bundle', since(t));

t = cpuNow();
const engine = await createHeadlessCascade({
  runtime: 'micropython', pySrc: PY_SRC,
  occtWasm: occtModule, micropythonJs, micropythonWasm: mpModule, fonts, upstreamPy,
});
record('boot (instantiate+init+snap)', since(t), { memMB: +(engine.memoryStats().totalWasm / 1048576).toFixed(1) });

const BOX = 'from build123d import *\nshow(Box(10, 10, 10))\n';

t = cpuNow();
let r = await engine.run(BOX);
let step = engine.exportSTEP();
record('first-box (py boot + lazy jit)', since(t), { ok: r.ok && step.startsWith('ISO-10303-21'),
  memMB: +(engine.memoryStats().totalWasm / 1048576).toFixed(1) });
if (!r.ok) { console.log(r.errors); process.exit(1); }
t = cpuNow(); engine.reset(); record('reset (first)', since(t));

// Warm per-request cost: run + export, then reset (separately timed).
const runs = []; const resets = []; const runOnly = []; const exportOnly = [];
for (let i = 0; i < REPEAT; i++) {
  t = cpuNow();
  r = await engine.run(BOX);
  const m1 = since(t);
  const t2 = cpuNow();
  step = engine.exportSTEP();
  const m2 = since(t2);
  runs.push(m1.cpu + m2.cpu); runOnly.push(m1.cpu); exportOnly.push(m2.cpu);
  t = cpuNow(); engine.reset(); resets.push(since(t).cpu);
}
record('box-step warm (median)', { cpu: median(runs), wall: 0, proc: 0 },
  { note: 'run ' + median(runOnly).toFixed(2) + ' + exportSTEP ' + median(exportOnly).toFixed(2)
    + ' ms; min ' + Math.min(...runs).toFixed(2) + ' max ' + Math.max(...runs).toFixed(2),
    runMs: median(runOnly), exportMs: median(exportOnly), all: runs.map((x) => +x.toFixed(2)) });
record('reset warm (median)', { cpu: median(resets), wall: 0, proc: 0 });

// The STEP-less floor: evaluate + combine only (what a "measure" or BREP
// request costs).
const brepRuns = [];
for (let i = 0; i < REPEAT; i++) {
  t = cpuNow(); await engine.run(BOX); engine.exportBREP(); brepRuns.push(since(t).cpu); engine.reset();
}
record('box-brep warm (median)', { cpu: median(brepRuns), wall: 0, proc: 0 });

const TRIVIAL = 'from build123d import *\nb = Box(1, 1, 1)\n';
const trivial = [];
for (let i = 0; i < REPEAT; i++) {
  t = cpuNow(); await engine.run(TRIVIAL); trivial.push(since(t).cpu); engine.reset();
}
record('trivial run, no export (median)', { cpu: median(trivial), wall: 0, proc: 0 });

const STARTER = fs.readFileSync(join(HERE, 'starter.py'), 'utf8');
for (const [name, code] of [['starter', STARTER]].concat(MODELS.map((id) => {
  const e = manifest.find((x) => x.id === id);
  if (!e) { throw new Error('not in manifest: ' + id); }
  return [id, e.code];
}))) {
  for (const pass of ['cold', 'warm']) {
    t = cpuNow();
    r = await engine.run(code);
    let s = '';
    try { s = r.ok && r.shapeCount ? engine.exportSTEP() : ''; } catch (e) { r.errors.push(e.message); }
    const m = since(t);
    const mem = engine.memoryStats().totalWasm / 1048576;
    record(name + ' ' + pass, m, { ok: r.ok, stepBytes: s.length, memMB: +mem.toFixed(1),
      note: (r.ok ? 'ok' : 'FAIL ' + String(r.errors[0]).split('\n')[0].slice(0, 60))
        + '  step ' + s.length + ' B  ' + mem.toFixed(1) + ' MB' });
    engine.reset();
  }
}

if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2)); console.log('wrote ' + JSON_OUT); }
