// canonical-cross-kernel.mjs — does build123d-lite's canonical() on OCCT 8.0.1
// agree with PATCHED upstream build123d's canonical() on OCP 7.9.3?
//
// The rule (Build123dLite.js `canonical_form`, ported from the upstream
// canonical-free-edges proposal) is defined from geometry alone, so the answer
// must be yes even though the two kernels seam and orient free edges
// differently. This runs the SAME three constructions the native reference
// script runs and diffs the numbers.
//
//   # reference (patched build123d 0.11.1 + OCP 7.9.3), regenerate on demand:
//   cd docs/upstream-canonical-edges/experiments && ./repatch.sh
//   PYTHONPATH=/tmp/b123d-0111 ~/Desktop/ocjs-deps/b123d-ref-venv/bin/python \
//     lite_cross_kernel.py > canonical-lite-reference.json
//
//   # lite side + comparison (needs `npm run build` first):
//   CS_TEST_HEADFUL=1 DISPLAY=:99 node test/b123d-validation/canonical-cross-kernel.mjs
//
// Exit code 0 when every measurement agrees within --tol (default 1e-3 mm).

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const PORT = parseInt(argVal('--port', process.env.CS_TEST_PORT || '8517'), 10);
const TOL = parseFloat(argVal('--tol', '1e-3'));
const REFERENCE = argVal('--reference', join(
  ROOT, 'docs', 'upstream-canonical-edges', 'experiments',
  'canonical-lite-reference.json'));
const OUT = argVal('--out', join(HERE, 'canonical-cross-kernel.json'));

// The lite side of the comparison: the same script as
// docs/upstream-canonical-edges/experiments/lite_cross_kernel.py, in lite's
// dialect (build123d-lite implements the same public API).
const SCRIPT = `
from build123d import *

def _j(x):
    # build123d-lite runs on Brython, which has no json module
    if isinstance(x, bool):
        return 'true' if x else 'false'
    if isinstance(x, (int, float)):
        return repr(float(x))
    if isinstance(x, str):
        return '"' + x + '"'
    if isinstance(x, (list, tuple)):
        return '[' + ','.join([_j(v) for v in x]) + ']'
    if isinstance(x, dict):
        return '{' + ','.join(['"' + k + '":' + _j(v) for k, v in x.items()]) + '}'
    raise TypeError(str(type(x)))

def brief(shape):
    return {
        "length": round(shape.length, 4),
        "pos0": [round(v, 4) for v in tuple(shape.position_at(0))],
        "pos25": [round(v, 4) for v in tuple(shape.position_at(0.25))],
        "pos50": [round(v, 4) for v in tuple(shape.position_at(0.50))],
        "pos75": [round(v, 4) for v in tuple(shape.position_at(0.75))],
        "tan0": [round(v, 4) for v in tuple(shape.tangent_at(0))],
    }

def positive_x_loop(wires):
    return [wr for wr in wires
            if min([wr.position_at(i / 64.0).X for i in range(64)]) > 0][0]

out = {}

arch = {}
for rotation in (0, 45, 90, 180, 270):
    sphere = Solid.make_sphere(50)
    if rotation:
        sphere = sphere.rotate(Axis.Z, rotation)
    cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))
    edge = sphere.cut(cutter).edges().sort_by(Axis.Z)[0]
    arch["rot" + str(rotation)] = {
        "raw_start": [round(v, 4) for v in tuple(edge.position_at(0))],
        "canonical": brief(edge.canonical()),
    }
out["arch"] = arch

reassembled = {}
for rotation in (0, 90, 180):
    sphere = Solid.make_sphere(10)
    if rotation:
        sphere = sphere.rotate(Axis.Z, rotation)
    cutter = Solid.make_cylinder(5, 40, Plane.YZ).locate(Location((-20, 0, 3)))
    edges = sphere.cut(cutter).edges().filter_by(GeomType.BSPLINE)
    loop = positive_x_loop(edges_to_wires(edges))
    form = loop.canonical_form()
    reassembled["rot" + str(rotation)] = {
        "edge_count": len(edges),
        "loop_edge_count": len(loop.edges()),
        "raw_start": [round(v, 4) for v in tuple(loop.position_at(0))],
        "form_start": round(form.start, 6),
        "form_sign": form.sign,
        "canonical": brief(loop.canonical()),
    }
out["sphere_cylinder_reassembled"] = reassembled

joints = {}
for rotation in (0, 90, 180):
    with BuildPart() as part:
        with BuildSketch():
            Rectangle(10, 10)
        extrude(amount=10, taper=3)
        Cylinder(2.5, 10, rotation=(0, 90, rotation), mode=Mode.SUBTRACT)
    solid = part.part
    top = solid.edges().filter_by(Axis.X, tolerance=30).sort_by(Axis.Z)[-2:]
    midway = Edge.make_mid_way(top[0], top[1], 0.67)
    joints["rot" + str(rotation)] = {
        "volume": round(solid.volume, 4),
        "canonical_axes": [
            [[round(v, 4) for v in tuple(Axis(e, canonical=True).position)],
             [round(v, 4) for v in tuple(Axis(e, canonical=True).direction)]]
            for e in top
        ],
        "midway_start": [round(v, 5) for v in tuple(midway.position_at(0))],
        "midway_end": [round(v, 5) for v in tuple(midway.position_at(1))],
    }
out["joints"] = joints

print("CANON_JSON " + _j(out))
`;

async function ensureServer() {
  const alive = await new Promise((res) => {
    const req = http.get({ host: 'localhost', port: PORT, path: '/' },
      (r) => { r.resume(); res(true); });
    req.on('error', () => res(false));
    req.setTimeout(2000, () => { req.destroy(); res(false); });
  });
  if (alive) return null;
  const proc = spawn('npx', ['http-server', './packages/cascade-studio/dist',
    '-p', String(PORT), '-c-1', '--silent'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  return proc;
}

// The "before" columns: how each kernel happened to seam and orient the free
// edge on the way in. They are RECORDED, not compared - a kernel difference
// here is the premise of the whole exercise, not a failure.
const INPUT_COLUMN = /\.(raw_start|form_start|form_sign|edge_count|loop_edge_count)\b/;

/** Every leaf number in an object, keyed by its path. */
function flatten(value, prefix, into) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, into));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) flatten(value[key], `${prefix}.${key}`, into);
  } else {
    into[prefix] = value;
  }
  return into;
}

const serverProc = await ensureServer();
const browser = await chromium.launch({
  headless: !process.env.CS_TEST_HEADFUL,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', () => {});
await page.goto(`http://localhost:${PORT}/`, { timeout: 60000 });
await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
  undefined, { timeout: 90000 });
await page.waitForFunction(() => !window.CascadeAPI.isWorking(),
  undefined, { timeout: 90000 });
await page.evaluate(() => window.CascadeAPI.setMode('python'));
await page.evaluate(async (code) => await window.CascadeAPI.runCode(code), SCRIPT);
await page.waitForFunction(
  () => window.CascadeAPI.getConsoleLog().some((l) => l.includes('CANON_JSON')) ||
        window.CascadeAPI.getErrors().length > 0,
  undefined, { timeout: 180000 });
const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
await browser.close();
if (serverProc) serverProc.kill();

const line = logs.find((l) => l.includes('CANON_JSON'));
if (!line) {
  console.error('lite produced no measurements:\n' + errors.join('\n'));
  process.exit(1);
}
// worker console strings arrive with escaped quotes
const payload = line.slice(line.indexOf('CANON_JSON') + 'CANON_JSON '.length)
  .replace(/\\"/g, '"');
const lite = JSON.parse(payload);
const native = JSON.parse(readFileSync(REFERENCE, 'utf8'));

const liteFlat = flatten(lite, '', {});
const nativeFlat = flatten(native, '', {});
const disagreements = [];
const inputDeltas = [];
let worst = 0, worstKey = '';
let compared = 0;
for (const key of Object.keys(nativeFlat)) {
  const a = nativeFlat[key], b = liteFlat[key];
  const differs = (typeof a === 'number' && typeof b === 'number')
    ? Math.abs(a - b) > TOL : a !== b;
  const delta = (typeof a === 'number' && typeof b === 'number')
    ? Math.abs(a - b) : null;
  if (INPUT_COLUMN.test(key)) {
    if (differs) inputDeltas.push({ key, native: a, lite: b });
    continue;
  }
  compared += 1;
  if (delta !== null && delta > worst) { worst = delta; worstKey = key; }
  if (differs) disagreements.push({ key, native: a, lite: b, delta });
}

/** Do all frames of one case canonicalize to the same traversal? That is the
 *  property canonical() exists for, and it is checked INSIDE each kernel. */
function frameConsistency(data) {
  const report = {};
  for (const [caseName, frames] of Object.entries(data)) {
    const names = Object.keys(frames);
    const base = flatten(frames[names[0]].canonical ?? frames[names[0]], '', {});
    const off = [];
    for (const name of names.slice(1)) {
      const other = flatten(frames[name].canonical ?? frames[name], '', {});
      const worstHere = Math.max(...Object.keys(base).map((k) =>
        typeof base[k] === 'number' && typeof other[k] === 'number'
          ? Math.abs(base[k] - other[k]) : (base[k] === other[k] ? 0 : Infinity)));
      if (worstHere > TOL) off.push({ frame: name, worst: worstHere });
    }
    report[caseName] = { frames: names.length, inconsistent: off };
  }
  return report;
}
const nativeFrames = frameConsistency(native);
const liteFrames = frameConsistency(lite);

writeFileSync(OUT, JSON.stringify({
  tolerance: TOL,
  compared_measurements: compared,
  worst_delta: worst, worst_key: worstKey,
  disagreements,
  kernel_input_differences: inputDeltas,
  frame_consistency: { native: nativeFrames, lite: liteFrames },
  native, lite,
}, null, 1) + '\n');

console.log(`compared ${compared} canonical measurements ` +
  '(patched build123d / OCP 7.9.3  vs  build123d-lite / OCCT 8.0.1 wasm)');
console.log(`worst delta ${worst.toExponential(2)} mm at ${worstKey || '-'}`);
console.log(`${inputDeltas.length} raw (pre-canonical) kernel differences recorded ` +
  '— the premise, not a failure');
for (const row of disagreements) {
  console.log(`  DISAGREE ${row.key}: native ${row.native} vs lite ${row.lite}` +
    (row.delta === null ? '' : ` (d=${row.delta.toExponential(2)})`));
}
console.log('\nframe consistency (all frames of a case must canonicalize alike):');
let frameFail = false;
for (const caseName of Object.keys(nativeFrames)) {
  const n = nativeFrames[caseName], l = liteFrames[caseName];
  const same = JSON.stringify(n.inconsistent.map((x) => x.frame)) ===
    JSON.stringify(l.inconsistent.map((x) => x.frame));
  console.log(`  ${caseName}: native ${n.inconsistent.length}/${n.frames - 1} off, ` +
    `lite ${l.inconsistent.length}/${l.frames - 1} off` +
    (n.inconsistent.length ? ` [${n.inconsistent.map((x) => x.frame).join(',')}]` : '') +
    (same ? '' : '  <-- KERNELS BEHAVE DIFFERENTLY'));
  if (!same) frameFail = true;
}
if (nativeFrames.sphere_cylinder_reassembled?.inconsistent.length) {
  console.log('\nNote: sphere_cylinder_reassembled.rot0 is frame-inconsistent in BOTH\n' +
    '  kernels, identically. Mechanism (an upstream fragility, not a port\n' +
    '  difference): Mixin1D.canonical() tests "already canonical" as\n' +
    '  form.start <= TOLERANCE/length WITHOUT taking form.start modulo 1, so a\n' +
    '  seam landing on the incoming wire\'s own start point (start = 1 - 4e-11\n' +
    '  natively) takes the re-seam path instead; there _walk_loop compares raw\n' +
    '  end-point distances (1e-16 scale) before the tangent, so the two edges\n' +
    '  meeting at that vertex resolve by floating-point noise and the loop can be\n' +
    '  walked backwards. Reproducible in patched upstream alone: reversing the\n' +
    '  very same wire flips its canonical seam.');
}
console.log(disagreements.length === 0 && !frameFail
  ? '\nAGREE — canonical() is kernel independent'
  : `\n${disagreements.length} disagreement(s)`);
console.log(`-> ${OUT}`);
process.exit(disagreements.length === 0 && !frameFail ? 0 : 1);
