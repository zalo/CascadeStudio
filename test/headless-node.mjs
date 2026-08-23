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
section('(c2) loadExternalFiles() + import_step()');
// ------------------------------------------------------------------ //
// The worker has no filesystem, so import_step() resolves assets the host
// handed over up front — same contract as CascadeAPI.loadExternalFiles.
engine.loadExternalFiles({ 'widget.step': scriptStep });
const imported = await engine.run([
  'from build123d import *',
  'w = import_step("assets/widget.step")',
  'print("imported volume:", w.volume)',
  'show(w)',
].join('\n'));
check('import_step run ok', imported.ok, imported.errors.join(' | '));
const impVol = parseFloat((imported.logs.find((l) => l.startsWith('imported volume:')) || '').split(': ')[1]);
check('import_step recovers the exported volume',
  isFinite(impVol) && Math.abs(impVol - srcVol) < 1e-3 * Math.abs(srcVol),
  impVol + ' vs ' + srcVol);

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
section('(d2) reset() between jobs — the kernel-image / OCP-ledger seam');
// ------------------------------------------------------------------ //
// What a long-lived Cloudflare isolate actually does: job, reset, job,
// export. reset() REWINDS OCCT's linear memory (COMPROMISE(kernel-heap-
// reset)), which dangles every embind wrapper in existence — including the
// ones the PYTHON LIBRARY made at import time. Upstream build123d's
// signatures carry `plane: Plane = Plane.XY` default arguments whose gp_Pln
// is built during that import, so before the post-library recapture the
// first reset() broke the engine permanently: the next Box(1, 1, 1) died in
// `gp_Dir::Cross() - result vector has zero norm` and never recovered.
for (let round = 0; round < 3; round++) {
  const cyc = await engine.run([
    'from build123d import *',
    'p = Box(10, 10, 10) - Cylinder(3, 12)',
    'show(p)',
    'print("cycle volume:", round(p.volume, 4))',
  ].join('\n'));
  check('reset cycle ' + round + ' runs', cyc.ok, cyc.errors.join(' | '));
  const v = parseFloat((cyc.logs.find((l) => l.startsWith('cycle volume:')) || '').split(': ')[1]);
  check('reset cycle ' + round + ' volume is sane',
    Math.abs(v - (1000 - Math.PI * 9 * 10)) < 1, String(v));
  check('reset cycle ' + round + ' exports STEP',
    engine.exportSTEP().startsWith('ISO-10303-21'));
  engine.reset();
  check('reset cycle ' + round + ' left the kernel healthy', engine.kernelHealthy());
}
// A shape that outlives a reset (stashed on a long-lived module, the only
// way a user script can keep one) must fail LOUDLY rather than read a
// stranger's memory out of the restored heap — the shim's epoch guard.
const stash = await engine.run([
  'from build123d import *',
  'import build123d as _keep',
  '_keep._cs_stale = Box(7, 7, 7)',
  'show(_keep._cs_stale)',
].join('\n'));
check('the stash run works', stash.ok, stash.errors.join(' | '));
engine.reset();
const stale = await engine.run([
  'from build123d import *',
  'import build123d as _keep',
  'try:',
  '    print("stale volume:", _keep._cs_stale.volume)',
  'except BaseException as e:',
  '    print("stale raised:", type(e).__name__)',
  '_keep._cs_stale = None',
  'show(Box(1, 1, 1))',
].join('\n'));
check('touching a pre-reset shape does not crash the engine', stale.ok,
  stale.errors.join(' | '));
console.log('  NOTE  pre-reset shape: '
  + (stale.logs.find((l) => l.startsWith('stale ')) || '(no line)'));
check('the engine still works after a stale-shape touch',
  engine.exportSTEP().startsWith('ISO-10303-21'));
engine.reset();

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
section('(f) fonts: a font that is not loaded fails BY NAME');
// ------------------------------------------------------------------ //
// Regression for the Cloudflare "clock" failure: the Worker shipped only
// FreeSans, examples/clock asks for FontStyle.BOLD (= FreeSansBold), the text
// builder returned null, and CacheOp died on it with "Cannot set properties
// of undefined (setting 'hash')" — a message that named neither the font nor
// the operation.
// Node loads the whole bundled family, so the Worker's leaner font set is
// simulated by hiding one face — the same state the engine is in when a host
// hands over only some of the TTFs.
const hiddenFace = globalThis.self.loadedFonts.FreeSansBoldOblique;
delete globalThis.self.loadedFonts.FreeSansBoldOblique;
const missingFont = await engine.run([
  'from build123d import *',
  'show(extrude(Text("B", 10, font_style=FontStyle.BOLDITALIC), 1))',
].join('\n'));
globalThis.self.loadedFonts.FreeSansBoldOblique = hiddenFace;
check('a missing font reports ok=false', missingFont.ok === false);
check('the error names the font that is missing',
  missingFont.errors.some((e) => /FreeSansBoldOblique/.test(e)), missingFont.errors.join(' | '));
check('the error lists what IS loaded',
  missingFont.errors.some((e) => /loaded: .*FreeSansBold\b/.test(e)), missingFont.errors.join(' | '));
check('no "setting \'hash\'" TypeError',
  !missingFont.errors.some((e) => /setting 'hash'/.test(e)), missingFont.errors.join(' | '));

// examples/clock — the model that surfaced it. Every glyph is BOLD.
const CLOCK = `from build123d import *

clock_radius = 10
with BuildSketch() as minute_indicator:
    with BuildLine() as outline:
        l1 = CenterArc((0, 0), clock_radius * 0.975, 0.75, 4.5)
        l2 = CenterArc((0, 0), clock_radius * 0.925, 0.75, 4.5)
        Line(l1 @ 0, l2 @ 0)
        Line(l1 @ 1, l2 @ 1)
    make_face()
    fillet(minute_indicator.vertices(), radius=clock_radius * 0.01)

with BuildSketch() as clock_face:
    Circle(clock_radius)
    with PolarLocations(0, 60):
        add(minute_indicator.sketch, mode=Mode.SUBTRACT)
    with PolarLocations(clock_radius * 0.875, 12):
        SlotOverall(clock_radius * 0.05, clock_radius * 0.025, mode=Mode.SUBTRACT)
    for hour in range(1, 13):
        with PolarLocations(clock_radius * 0.75, 1, -hour * 30 + 90, 360, rotate=False):
            Text(
                str(hour),
                font_size=clock_radius * 0.175,
                font_style=FontStyle.BOLD,
                mode=Mode.SUBTRACT,
            )

show(clock_face)
print("clock area:", round(clock_face.sketch.area, 4))
`;
const clock = await engine.run(CLOCK);
check('examples/clock runs', clock.ok, clock.errors.join(' | '));
check('clock produced one sketch', clock.shapeCount === 1, 'shapeCount=' + clock.shapeCount);
const clockArea = parseFloat((clock.logs.find((l) => l.startsWith('clock area:')) || '').split(': ')[1]);
check('clock area ~= 283.12 mm^2', Math.abs(clockArea - 283.1211) < 0.5, String(clockArea));
check('clock exports STEP', engine.exportSTEP().startsWith('ISO-10303-21'));

// ------------------------------------------------------------------ //
section('(g) kernel-heap reset: STEP survives an OCCT heap corruption');
// ------------------------------------------------------------------ //
// COMPROMISE(kernel-heap-reset). maker_coin's fillet over nine Select.NEW
// edges makes BRepFilletAPI_MakeFillet::Build scribble over OCCT's heap, and
// every later `new STEPControl_Writer` traps. Distilled to the two ops that
// are needed to trigger it.
const COIN = `from build123d import *
diameter, thickness = 50 * MM, 10 * MM
with BuildPart() as coin:
    with BuildSketch(Plane.XZ) as profile:
        with BuildLine():
            l1 = Polyline((0, thickness * 0.6), (0, 0), ((diameter - thickness) / 2, 0))
            l2 = JernArc(start=l1 @ 1, tangent=l1 % 1, radius=thickness / 2, arc_size=300)
            l3 = DoubleTangentArc(l1 @ 0, tangent=(1, 0), other=l2)
        make_face()
    revolve()
    with BuildSketch() as detents:
        with PolarLocations(radius=(diameter + 5) / 2, count=8):
            Circle(thickness * 1.4 / 2)
    extrude(amount=thickness, mode=Mode.SUBTRACT)
    fillet(coin.edges(Select.NEW), 2)
show(coin)
print("coin volume:", round(coin.part.volume, 4))
`;
const coin = await engine.run(COIN);
check('the coin evaluates cleanly', coin.ok, coin.errors.join(' | '));
const coinVol = parseFloat((coin.logs.find((l) => l.startsWith('coin volume:')) || '').split(': ')[1]);
check('the geometry is correct despite the corruption',
  Math.abs(coinVol - 13320.036) < 1, String(coinVol));
// Whether the fault FIRES is a property of the exact BRepFilletAPI call
// sequence, and the two source flavors do not make the same one: lite's
// fillet over `Select.NEW` reliably scribbles on OCCT's heap here, upstream
// topology's does not (measured, both flavors, same geometry and the same
// 13320.0365 mm^3 result). So the guard's TRIGGER is only asserted on lite;
// what both flavors must do is export and round-trip, which is checked below
// either way.
const poisoned = engine.kernelHealthy() === false;
if (PY_SRC === 'upstream') {
  console.log('  NOTE  kernel poisoned by the coin fillet: ' + poisoned
    + '  (upstream topology usually avoids the fault; the heal path is still '
    + 'exercised by the lite run)');
} else {
  check('the kernel IS poisoned by the fillet (the fault this guards against)',
    poisoned,
    'kernelHealthy() returned true — has the OCCT build been fixed? '
    + 'If so, the heal path is dead code and can go.');
}
const coinStep = engine.exportSTEP();
check('exportSTEP heals the kernel and writes a STEP',
  coinStep.startsWith('ISO-10303-21'), coinStep.length + ' bytes');
check('the kernel is healthy again afterwards', engine.kernelHealthy() === true);

engine.reset();
engine.loadExternalFiles({ 'coin.step': coinStep });
const coinBack = await engine.run([
  'from build123d import *',
  'c = import_step("assets/coin.step")',
  'print("roundtrip:", round(c.volume, 4))',
  'show(c)',
].join('\n'));
check('the healed STEP re-imports', coinBack.ok, coinBack.errors.join(' | '));
const coinRt = parseFloat((coinBack.logs.find((l) => l.startsWith('roundtrip:')) || '').split(': ')[1]);
check('the healed STEP round-trips the volume within 0.5%',
  isFinite(coinRt) && Math.abs(coinRt - coinVol) < 5e-3 * coinVol,
  coinVol + ' vs ' + coinRt);

// ------------------------------------------------------------------ //
section('memory summary');
// ------------------------------------------------------------------ //
const finalMem = engine.memoryStats();
console.log('  occtWasm   ' + mb(finalMem.occtWasm));
console.log('  pythonWasm ' + mb(finalMem.pythonWasm));
console.log('  total      ' + mb(finalMem.totalWasm)
  + '   (Cloudflare Worker limit: ' + mb(WORKER_MEMORY_LIMIT) + ')');
console.log('  node RSS   ' + mb(process.memoryUsage().rss));
// The ceiling is a property of the SOURCE FLAVOR, not of the engine.
//
//   lite      65 MB after the whole corpus — half a Cloudflare isolate.
//   upstream  the same 51.5 MB for the Box and the starter (measured above:
//             byte-identical to lite, because the shapes live in OCCT's
//             heap either way), but the MicroPython GC ARENA RATCHETS on a
//             model that makes millions of FFI calls. examples/clock alone
//             takes it from 19.5 MB to 386 MB: upstream topology runs every
//             boolean, every selector and every Text glyph through the OCP
//             shim, each dispatch retains ~32-230 B in the interpreter for
//             the duration of the run, and MicroPython's arena grows by
//             doubling and NEVER shrinks (the retention itself is
//             run-scoped — the next run reports ~1.1 MB live — so this is
//             an arena high-water, not a leak). Bounding it needs an
//             interpreter patch; see the NOTE(heavy-model memory round) in
//             upstream-py/ocp_shim/ocp_core.py and README "Source flavors".
//
// So: the strict Worker budget is asserted on the BASIC models for both
// flavors (above), and the corpus high-water is asserted against the
// flavor's measured ceiling here — a regression still trips it.
// Measured corpus high-water: lite 65 MB, upstream 509 MB (examples/clock
// dominates). The upstream ceiling is that plus headroom.
const MEM_CEILING = PY_SRC === 'upstream' ? 640 * MB : WORKER_MEMORY_LIMIT * 0.75;
check('final total wasm is within the ' + PY_SRC + ' ceiling (' + mb(MEM_CEILING) + ')',
  finalMem.totalWasm < MEM_CEILING, mb(finalMem.totalWasm)
  + (PY_SRC === 'upstream'
    ? ' — upstream arena high-water; the 128 MB Worker budget holds for the '
      + 'basic models only (see README "Source flavors")'
    : ''));

console.log('\n' + (failures === 0 ? 'ALL HEADLESS CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);

function countStepEntities(text) {
  return text ? (text.match(/^#\d+ ?=/gm) || []).length : -1;
}
