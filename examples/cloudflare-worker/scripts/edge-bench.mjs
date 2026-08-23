// edge-bench.mjs — throw a ladder of increasingly heavy validation-corpus
// models at a deployed cascade-headless Worker and report the capability
// envelope: client-side wall time, isolate memory, and what came back.
//
//   BASE=https://<worker>.workers.dev node scripts/edge-bench.mjs
//   BASE=http://127.0.0.1:8787        node scripts/edge-bench.mjs   # workerd
//   ... node scripts/edge-bench.mjs --only examples/maker_coin,examples/clock
//
// Run it from the repo ROOT or from examples/cloudflare-worker — it finds
// test/b123d-validation/manifest.json either way.
//
// Two edge quirks the numbers depend on:
//   * a deployed Worker FREEZES Date.now() during CPU work, so the server's
//     own `timings` read ~0. Everything printed here is measured client-side.
//   * a cold isolate costs ~2 s of boot on its first request, and a request
//     that killed an isolate usually lands on a fresh one.
//
// This is the regression ladder for the "edge limits" round: it is what
// found the STEP-export heap corruption (COMPROMISE(kernel-heap-reset)), the
// missing FreeSansBold, and the 30 s default CPU limit.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  join(HERE, '..', '..', '..', 'test', 'b123d-validation', 'manifest.json'),
  join(process.cwd(), 'test', 'b123d-validation', 'manifest.json'),
];
const manifestPath = CANDIDATES.find((p) => existsSync(p));
if (!manifestPath) {
  console.error('cannot find test/b123d-validation/manifest.json');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const BASE = process.env.BASE || 'https://cascade-headless.makeshifted.workers.dev';

const LADDER = [
  'examples/boxes_on_faces',          // trivial builder nesting
  'examples/maker_coin',              // fillets + text + new_edges
  'ttt/ttt-ppp0101',                  // real TTT challenge part
  'ttt/ttt-24-SPO-06-Buffer_Stand',   // heavier TTT
  'examples/intersecting_pipes',      // booleans on cylinders + fillets
  'examples/build123d_logo',          // text + sketches + extrudes
  'examples/bicycle_tire',            // wrap + thicken + 1081 solids
  'examples/clock',                   // Text(FontStyle.BOLD) + 2-D fillets
  'examples/heat_exchanger',          // the CPU-limit probe (~1000 ops)
];

// FIDELITY LADDER — scripts where the two source flavors DISAGREE. These are
// the reason `--env upstream` exists: build123d-lite classifies 206/222 on
// the validation corpus and the verbatim-upstream layer 216/222, and each of
// these is in the delta (see experiments/upstream-topology-spike/
// STAGE3-STATE.md and test/b123d-validation/report.md).
//
//   toy_truck        lite: the body fillet raises "INTERNAL OPENCASCADE
//                    ERROR" (was filed as an 8.0.1 kernel fault); upstream
//                    Solid.fillet's own call sequence builds it.
//   ttt-ppp0110      lite: the coplanar-BSpline fuse DROPS an operand and
//                    even the General-Fuse rebuild cannot recover it
//                    (volume 0); upstream: PASS.
//   sort_axis        lite: `revolve(face, -Axis(edge), 90)` sweeps the other
//                    way (-14.7% volume) because the selected sub-edge's
//                    TopAbs orientation differs — COMPROMISE(edge-
//                    orientation); upstream: PASS.
const FIDELITY = [
  'examples/toy_truck',
  'ttt/ttt-ppp0110',
  'docs-selectors/sort_axis',
];

const onlyArg = process.argv.indexOf('--only');
const only = onlyArg >= 0 ? String(process.argv[onlyArg + 1]).split(',') : null;
const ids = only
  || (process.argv.includes('--fidelity') ? FIDELITY : LADDER.concat(FIDELITY));

console.log('BASE ' + BASE);
for (const id of ids) {
  const entry = manifest.find((x) => x.id === id);
  if (!entry) { console.log(id.padEnd(36) + 'NOT IN MANIFEST'); continue; }
  const t0 = Date.now();
  let line;
  try {
    const res = await fetch(BASE + '/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: entry.code, formats: ['step'], measure: true }),
    });
    const wall = Date.now() - t0;
    let body;
    try { body = await res.json(); } catch (e) { body = { errors: ['<non-JSON ' + res.status + '>'] }; }
    const mem = body.memory ? (body.memory.totalWasm / 1048576).toFixed(1) + ' MB' : '?';
    // The scene's volume is what tells the two source flavors apart: a
    // fidelity-ladder script can come back HTTP 200 with the WRONG geometry
    // (ttt-ppp0110's dropped fuse operand measures 0; sort_axis revolves the
    // other way and is 14.7% light).
    const vol = body.measurement && typeof body.measurement.volume === 'number'
      ? '  vol=' + body.measurement.volume.toFixed(3) : '';
    line = res.ok
      ? 'OK    ' + String(wall).padStart(6) + ' ms  ' + mem.padStart(8)
        + '  shapes=' + body.shapeCount + '  step=' + (body.step || '').length + ' B' + vol
      : 'HTTP ' + res.status + String(wall).padStart(6) + ' ms  ' + mem.padStart(8) + '  '
        + String((body.errors || [])[0]).split('\n')[0].slice(0, 100);
  } catch (err) {
    line = 'FETCH-FAIL ' + (Date.now() - t0) + ' ms  '
      + String((err.cause && err.cause.code) || err.message).slice(0, 80);
  }
  console.log(id.padEnd(36) + line);
}
