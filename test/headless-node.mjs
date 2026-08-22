// headless-node.mjs — the authoritative proof that cascade-core runs with no
// browser at all: plain Node, no Chromium, no DOM, no Three.js.
//
//   npm run build            # dist/cascade-headless.mjs + the wasm assets
//   node test/headless-node.mjs
//
// (also wired into `npm run test:headless`)
//
// It boots the SHIPPED bundle (packages/cascade-core/dist/cascade-headless.mjs)
// exactly the way a Cloudflare Worker does — assets injected by the host,
// MicroPython's wasm handed over as BYTES through the patched
// `instantiateWasm` hook rather than a URL — and then runs:
//
//   (a) a trivial Box(1, 1, 1)                      -> STEP + BREP
//   (b) the app's PYTHON_STARTER_CODE               (parametric bearing mount)
//   (c) a script calling export_step()/export_brep() -> MEMFS round-trip
//   (d) the CascadeStudio JS standard library        (language: 'cascadestudio')
//
// Assertions: no errors, STEP starts with ISO-10303-21, BREP round-trips
// through import_brep with an equal volume, and occtWasm + pythonWasm stay
// well under the 128 MB a Cloudflare Worker isolate gets.
//
// Env knobs: CS_PY_SRC=lite|upstream, CS_MP_HEAP=<bytes>.

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORE_DIST = join(ROOT, 'packages', 'cascade-core', 'dist');

const MB = 1024 * 1024;
const WORKER_MEMORY_LIMIT = 128 * MB;

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
  if (!ok) { failures++; }
}
function section(title) { console.log('\n=== ' + title + ' ==='); }
function mb(n) { return (n / MB).toFixed(1) + ' MB'; }

// ------------------------------------------------------------------ //
// Assets. In Node the host reads them off disk; in workerd they come   //
// from wasm module bindings and inlined text (same shape of call).     //
// ------------------------------------------------------------------ //
function required(p) {
  if (!fs.existsSync(p)) {
    console.error('missing build artifact: ' + p + '\nrun `npm run build` first.');
    process.exit(2);
  }
  return p;
}

const occtWasm = fs.readFileSync(required(join(CORE_DIST, 'cascadestudio.wasm')));
const micropythonWasm = fs.readFileSync(required(join(CORE_DIST, 'micropython-cs.wasm')));
const micropythonJs = await import(
  pathToFileURL(required(join(CORE_DIST, 'micropython-cs.mjs'))).href);

const fonts = {};
const fontDir = join(CORE_DIST, 'fonts');
for (const f of fs.readdirSync(fontDir)) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(fontDir, f)); }
}

const { createHeadlessCascade } = await import(
  pathToFileURL(required(join(CORE_DIST, 'cascade-headless.mjs'))).href);

// pysrc=upstream needs the 3.5 MB vendored upstream-build123d tree served to
// the runtime as text. That extra payload (and ~2x the interpreter boot) is
// exactly why headless DEFAULTS to lite — CS_PY_SRC=upstream re-measures it.
const PY_SRC = process.env.CS_PY_SRC || 'lite';
const upstreamPy = PY_SRC === 'upstream'
  ? async (rel) => fs.readFileSync(join(CORE_DIST, 'upstream-b123d', rel), 'utf8')
  : undefined;

// ------------------------------------------------------------------ //
section('boot');
// ------------------------------------------------------------------ //
const tBoot = Date.now();
const engine = await createHeadlessCascade({
  runtime: 'micropython',
  pySrc: PY_SRC,
  occtWasm,
  micropythonJs,
  micropythonWasm,
  fonts,
  upstreamPy,
});
const bootMs = Date.now() - tBoot;
const bootMem = engine.memoryStats();
console.log('  boot ' + bootMs + ' ms   occtWasm ' + mb(bootMem.occtWasm)
  + '   pythonWasm ' + mb(bootMem.pythonWasm) + ' (interpreter not booted yet)');
check('boot produced no errors', engine.errors.length === 0, engine.errors.join(' | '));

// ------------------------------------------------------------------ //
section('(a) Box(1, 1, 1)');
// ------------------------------------------------------------------ //
const boxResult = await engine.run([
  'from build123d import *',
  'b = Box(1, 1, 1)',
  'print("volume:", b.volume)',
  'show(b)',
].join('\n'));

check('run ok', boxResult.ok, boxResult.errors.join(' | '));
check('one top-level shape', boxResult.shapeCount === 1, 'shapeCount=' + boxResult.shapeCount);
const boxVolLog = boxResult.logs.find((l) => l.startsWith('volume:'));
check('volume logged as 1.0',
  !!boxVolLog && Math.abs(parseFloat(boxVolLog.split(': ')[1]) - 1) < 1e-9,
  String(boxVolLog));

const boxStep = engine.exportSTEP();
check('exportSTEP starts with ISO-10303-21', boxStep.startsWith('ISO-10303-21'),
  JSON.stringify(boxStep.slice(0, 24)));
check('exportSTEP ends with END-ISO-10303-21', boxStep.trimEnd().endsWith('END-ISO-10303-21;'));
const boxBrep = engine.exportBREP();
check('exportBREP non-empty', boxBrep.length > 100, boxBrep.length + ' bytes');
check('exportBREP is a CASCADE BREP', /CASCADE Topology/.test(boxBrep),
  JSON.stringify(boxBrep.slice(0, 40)));
const boxStl = engine.exportSTL();
check('exportSTL is an ASCII solid', boxStl.startsWith('solid'), boxStl.length + ' bytes');
check('exportSTL has 12 facets (a cube)',
  (boxStl.match(/facet normal/g) || []).length === 12,
  (boxStl.match(/facet normal/g) || []).length + ' facets');

const afterBox = engine.memoryStats();
console.log('  after Box: occtWasm ' + mb(afterBox.occtWasm) + '   pythonWasm '
  + mb(afterBox.pythonWasm) + '   total ' + mb(afterBox.totalWasm)
  + '   [' + afterBox.pyRuntime + '/' + JSON.stringify(afterBox.bootTiming
    && afterBox.bootTiming.pySrc) + ']');
check('Box run stays under the 128 MB worker budget',
  afterBox.totalWasm < WORKER_MEMORY_LIMIT, mb(afterBox.totalWasm));
check('Python interpreter boot was timed',
  !!afterBox.bootTiming && afterBox.bootTiming.runtime === 'micropython',
  JSON.stringify(afterBox.bootTiming));

// ------------------------------------------------------------------ //
section('(b) PYTHON_STARTER_CODE (parametric flanged bearing mount)');
// ------------------------------------------------------------------ //
// Kept in sync with CascadeStudioApp.PYTHON_STARTER_CODE
// (packages/cascade-studio/src/CascadeMain.js).
const STARTER = `# CascadeStudio build123d mode
from build123d import *

L, W, T = 80, 60, 8        # flange plate: length / width / thickness
boss_d, boss_h, bore_d = 34, 20, 16
hole_d, inset = 6, 10      # M6 bolt holes, inset from the plate edges

plate = Pos(0, 0, T / 2) * Box(L, W, T)
plate = fillet(plate.edges().filter_by(Axis.Z), 12)

mount = plate + Pos(0, 0, T + boss_h / 2) * Cylinder(boss_d / 2, boss_h)
mount -= Cylinder(bore_d / 2, 200)
mount -= GridLocations(L - 2 * inset, W - 2 * inset, 2, 2) * Cylinder(hole_d / 2, 200)
mount -= Pos(0, 0, T + boss_h / 2) * Rot(0, 90, 0) * Cylinder(2.5, 200)

mount = fillet(mount.edges().group_by(Axis.Z)[-1], 1.5)

show(mount)
print("volume:", round(volume(mount), 1), "mm^3")
`;

const tStarter = Date.now();
const starter = await engine.run(STARTER);
const starterMs = Date.now() - tStarter;
check('starter run ok', starter.ok, starter.errors.join(' | '));
check('starter produced a shape', starter.shapeCount === 1, 'shapeCount=' + starter.shapeCount);
const volLog = starter.logs.find((l) => l.startsWith('volume:'));
const starterVolume = volLog ? parseFloat(volLog.split(' ')[1]) : NaN;
// Frozen: the same number the browser build reports for this starter.
check('starter volume ~= 48603.5 mm^3',
  Math.abs(starterVolume - 48603.5) < 1, String(starterVolume));
check('history steps were recorded', starter.historySteps.length > 5,
  starter.historySteps.length + ' steps');

const starterStep = engine.exportSTEP();
check('starter STEP starts with ISO-10303-21', starterStep.startsWith('ISO-10303-21'));
check('starter STEP is substantial', starterStep.length > 20000,
  starterStep.length + ' bytes');

const afterStarter = engine.memoryStats();
console.log('  starter: ' + starterMs + ' ms (eval ' + starter.timings.evalMs
  + ' ms)   occtWasm ' + mb(afterStarter.occtWasm) + '   pythonWasm '
  + mb(afterStarter.pythonWasm) + '   total ' + mb(afterStarter.totalWasm));
check('starter run stays under the 128 MB worker budget',
  afterStarter.totalWasm < WORKER_MEMORY_LIMIT, mb(afterStarter.totalWasm));

// ------------------------------------------------------------------ //
section('(c) export_step() / export_brep() from inside the script');
// ------------------------------------------------------------------ //
const exportScript = [
  'from build123d import *',
  'part = Box(20, 12, 6) - Cylinder(3, 40)',
  'print("source volume:", part.volume)',
  'export_step(part, "part.step")',
  'export_brep(part, "part.brep")',
  'back = import_brep("part.brep")',
  'print("roundtrip volume:", back.volume)',
  'show(back)',
].join('\n');

const exported = await engine.run(exportScript);
check('export script ok', exported.ok, exported.errors.join(' | '));

const scriptStep = engine.readFile('part.step');
check('script-written STEP exists', scriptStep !== null);
check('script-written STEP starts with ISO-10303-21',
  !!scriptStep && scriptStep.startsWith('ISO-10303-21'),
  scriptStep ? JSON.stringify(scriptStep.slice(0, 24)) : 'null');
const scriptBrep = engine.readFile('part.brep');
check('script-written BREP non-empty', !!scriptBrep && scriptBrep.length > 100,
  scriptBrep ? scriptBrep.length + ' bytes' : 'null');

const srcVol = parseFloat((exported.logs.find((l) => l.startsWith('source volume:')) || '').split(': ')[1]);
const rtVol = parseFloat((exported.logs.find((l) => l.startsWith('roundtrip volume:')) || '').split(': ')[1]);
check('import_brep round-trips the volume exactly',
  isFinite(srcVol) && isFinite(rtVol) && Math.abs(srcVol - rtVol) < 1e-6 * Math.abs(srcVol),
  srcVol + ' vs ' + rtVol);
check('MEMFS lists the exported files',
  engine.listFiles().includes('part.step') && engine.listFiles().includes('part.brep'),
  JSON.stringify(engine.listFiles().filter((f) => /part\./.test(f))));

// The STEP the ENGINE writes for the same shape must agree with the one the
// SCRIPT wrote (both go through STEPControl_Writer).
const engineStep = engine.exportSTEP();
check('engine STEP and script STEP have the same entity count',
  countStepEntities(engineStep) === countStepEntities(scriptStep),
  countStepEntities(engineStep) + ' vs ' + countStepEntities(scriptStep));

// ------------------------------------------------------------------ //
section('(d) CascadeStudio JS mode + repeated runs');
// ------------------------------------------------------------------ //
const jsResult = await engine.run(
  'let s = Sphere(5);\nlet b = Translate([12,0,0], Box(4,4,4));',
  { language: 'cascadestudio' });
check('JS-mode run ok', jsResult.ok, jsResult.errors.join(' | '));
check('JS-mode produced two shapes', jsResult.shapeCount === 2,
  'shapeCount=' + jsResult.shapeCount);
check('JS-mode STEP is valid', engine.exportSTEP().startsWith('ISO-10303-21'));

// Back to Python on the same engine — repeated runs must keep working.
const again = await engine.run([
  'from build123d import *',
  'show(Cylinder(4, 10))',
].join('\n'));
check('a fourth run on the same engine still works', again.ok, again.errors.join(' | '));
check('the scene was reset between runs', again.shapeCount === 1,
  'shapeCount=' + again.shapeCount);

// ------------------------------------------------------------------ //
section('(e) errors are RETURNED, not thrown at the host');
// ------------------------------------------------------------------ //
const bad = await engine.run('from build123d import *\nthis_is_not_defined()\n');
check('a failing script reports ok=false', bad.ok === false);
check('the Python traceback comes back in errors',
  bad.errors.some((e) => /NameError/.test(e)), bad.errors.join(' | '));
const stillFine = await engine.run('from build123d import *\nshow(Box(2,2,2))');
check('the engine survives a failed script', stillFine.ok, stillFine.errors.join(' | '));

// ------------------------------------------------------------------ //
section('memory summary');
// ------------------------------------------------------------------ //
const finalMem = engine.memoryStats();
console.log('  occtWasm   ' + mb(finalMem.occtWasm));
console.log('  pythonWasm ' + mb(finalMem.pythonWasm));
console.log('  total      ' + mb(finalMem.totalWasm)
  + '   (Cloudflare Worker limit: ' + mb(WORKER_MEMORY_LIMIT) + ')');
console.log('  node RSS   ' + mb(process.memoryUsage().rss));
check('final total wasm is comfortably under 128 MB',
  finalMem.totalWasm < WORKER_MEMORY_LIMIT * 0.75, mb(finalMem.totalWasm));

console.log('\n' + (failures === 0 ? 'ALL HEADLESS CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);

function countStepEntities(text) {
  return text ? (text.match(/^#\d+ ?=/gm) || []).length : -1;
}
