// smoke.mjs — drive the Worker with the same three scripts test/headless-node.mjs
// runs, so the Cloudflare leg is verified against the Node leg.
//
//   npx wrangler dev --port 8787      # in one shell
//   node scripts/smoke.mjs            # in another   (BASE=... to point elsewhere)
//
// Prints the curl-equivalent of each call, then a PASS/FAIL table.

const BASE = process.env.BASE || 'http://127.0.0.1:8787';

const STARTER = `from build123d import *

L, W, T = 80, 60, 8
boss_d, boss_h, bore_d = 34, 20, 16
hole_d, inset = 6, 10

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

const EXPORTS = `from build123d import *
part = Box(20, 12, 6) - Cylinder(3, 40)
print("source volume:", part.volume)
export_step(part, "part.step")
export_brep(part, "part.brep")
back = import_brep("part.brep")
print("roundtrip volume:", back.volume)
show(back)
`;

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
  if (!ok) { failures++; }
};

async function render(code, formats) {
  const t0 = Date.now();
  const res = await fetch(BASE + '/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, formats }),
  });
  const body = await res.json();
  return { status: res.status, body, ms: Date.now() - t0 };
}

console.log('=== GET /health ===');
const health = await (await fetch(BASE + '/health')).json();
console.log('  boot ' + health.bootMs + ' ms   occtWasm '
  + (health.memory.occtWasm / 1048576).toFixed(1) + ' MB');
check('health ok', health.ok === true);

console.log('\n=== (a) Box(10, 10, 10) -> step + brep + stl ===');
const a = await render('from build123d import *\nb = Box(10, 10, 10)\nprint("volume:", b.volume)\nshow(b)',
  ['step', 'brep', 'stl']);
check('HTTP 200', a.status === 200, String(a.status));
check('ok', a.body.ok === true, JSON.stringify(a.body.errors));
check('STEP is ISO-10303-21', (a.body.step || '').startsWith('ISO-10303-21'));
check('BREP non-empty', (a.body.brep || '').length > 100, (a.body.brep || '').length + ' bytes');
check('STL has 12 facets', ((a.body.stl || '').match(/facet normal/g) || []).length === 12);
console.log('  ' + a.ms + ' ms   ' + report(a.body));

console.log('\n=== (b) PYTHON_STARTER_CODE (flanged bearing mount) ===');
const b = await render(STARTER, ['step']);
check('HTTP 200', b.status === 200, String(b.status));
check('ok', b.body.ok === true, JSON.stringify(b.body.errors));
const vol = parseFloat(((b.body.logs || []).find((l) => l.startsWith('volume:')) || '').split(' ')[1]);
check('volume ~= 48603.5 mm^3', Math.abs(vol - 48603.5) < 1, String(vol));
check('STEP is substantial', (b.body.step || '').length > 20000, (b.body.step || '').length + ' bytes');
console.log('  ' + b.ms + ' ms   ' + report(b.body));

console.log('\n=== (c) export_step() / export_brep() inside the script ===');
const c = await render(EXPORTS, ['step']);
check('HTTP 200', c.status === 200, String(c.status));
check('ok', c.body.ok === true, JSON.stringify(c.body.errors));
const files = c.body.files || {};
check('script wrote part.step', (files['part.step'] || '').startsWith('ISO-10303-21'));
check('script wrote part.brep', (files['part.brep'] || '').length > 100);
const src = parseFloat(((c.body.logs || []).find((l) => l.startsWith('source volume:')) || '').split(': ')[1]);
const rt = parseFloat(((c.body.logs || []).find((l) => l.startsWith('roundtrip volume:')) || '').split(': ')[1]);
check('import_brep round-trips the volume', Math.abs(src - rt) < 1e-6 * Math.abs(src), src + ' vs ' + rt);
console.log('  ' + c.ms + ' ms   ' + report(c.body));

console.log('\n=== (d) a failing script comes back as JSON, not a 500 ===');
const d = await render('from build123d import *\nnope()\n', ['step']);
check('HTTP 422', d.status === 422, String(d.status));
check('NameError reported', (d.body.errors || []).some((e) => /NameError/.test(e)),
  JSON.stringify(d.body.errors));

console.log('\n' + (failures === 0 ? 'ALL WORKER CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);

function report(body) {
  const m = body.memory || {};
  return 'occt ' + (m.occtWasm / 1048576).toFixed(1) + ' MB + python '
    + (m.pythonWasm / 1048576).toFixed(1) + ' MB = ' + (m.totalWasm / 1048576).toFixed(1)
    + ' MB   (eval ' + (body.timings && body.timings.evalMs) + ' ms)';
}
