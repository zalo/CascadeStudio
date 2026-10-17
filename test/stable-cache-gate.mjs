// stable-cache-gate.mjs — correctness gate for the stable cross-run op cache
// (createHeadlessCascade({stableCache: true}); StandardUtils _stableHash) and
// its persistence (snapshotCache/restoreCache), the two things a Durable
// Object editing session relies on (examples/cloudflare-worker, --env session).
//
// ONE long-lived engine runs every validation-corpus script that PASSes on
// lite/MicroPython (test/b123d-validation/results-013-lite-micropython.json),
// four times each, and compares the per-variable measurements the harness
// footer prints (volume, area, bbox, topology counts):
//
//   shared    with the PREVIOUS script's cache still loaded (an isolate that
//             served another session: keys must never cross-match wrongly)
//   cold      after resetKernel() — the reference
//   warm      again, served from the cache
//   restored  after snapshotCache() -> resetKernel() -> restoreCache()
//             (what an evicted session sees when it comes back)
//
// Verdicts per script (the worst of shared/warm/restored against cold):
//   EXACT  byte-identical measurements
//   CLOSE  same topology counts; volume/area within 1e-6 relative and bbox
//          within 1e-6 absolute. An op that MISSES (its inputs are restored
//          or cached shapes at other heap addresses than in the cold run)
//          can land in the last digits elsewhere: OCCT iterates some maps in
//          address order. Same class of difference as two cold runs in
//          isolates with different allocation histories.
//   FAIL   anything else — a wrong cache hit looks like this.
// Scripts with no measurement on the cold run are reported (COLD_ERROR),
// not failed.
//
//   npm run build
//   node test/stable-cache-gate.mjs [--only substr] [--limit N] [--out file.json]
//
// Env: CS_GATE_SKIP=id1,id2 (default skips the corpus's TIMEOUT-prone
// scripts), B123D_SRC=<build123d clone> for the two asset-importing scripts.

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const D = join(ROOT, 'packages', 'cascade-core', 'dist');
const V = join(HERE, 'b123d-validation');
const B123D_SRC = process.env.B123D_SRC
  || join(process.env.HOME || '', 'Desktop/ocjs-deps/src/build123d-v0.13.0');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const ONLY = opt('only', null);
const LIMIT = Number(opt('limit', '0')) || Infinity;
const OUT = opt('out', null);
const SKIP = new Set((process.env.CS_GATE_SKIP
  || 'docs/spitfire_wing_gordon,examples/heat_exchanger').split(',').filter(Boolean));

const MEASURE_FOOTER = `

import build123d as _b123d_lite_mod
print("B123D_MEASURE " + _b123d_lite_mod._measure_globals_json(globals()))
`;

const fonts = {};
for (const f of fs.readdirSync(join(D, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.slice(0, -4)] = fs.readFileSync(join(D, 'fonts', f)); }
}
const micropythonJs = await import(pathToFileURL(join(D, 'micropython-cs.mjs')).href);
const { createHeadlessCascade } = await import(pathToFileURL(join(D, 'cascade-headless.mjs')).href);
const engine = await createHeadlessCascade({
  stableCache: true,
  occtWasm: fs.readFileSync(join(D, 'cascadestudio.wasm')),
  micropythonJs,
  micropythonWasm: fs.readFileSync(join(D, 'micropython-cs.wasm')),
  fonts,
});

const manifest = JSON.parse(fs.readFileSync(join(V, 'manifest-all.json'), 'utf8'));
const status = JSON.parse(fs.readFileSync(join(V, 'results-013-lite-micropython.json'), 'utf8'));
let entries = manifest.filter((e) => status[e.id] && status[e.id].status === 'PASS'
  && !SKIP.has(e.id) && (!ONLY || e.id.includes(ONLY)));
entries = entries.slice(0, LIMIT);

function assetsOf(entry) {
  const files = {};
  for (const name of entry.assets || []) {
    const p = join(B123D_SRC, entry.data_dir || '', name);
    if (fs.existsSync(p)) { files[name] = fs.readFileSync(p, 'utf8'); }
  }
  return files;
}

async function measureRun(code) {
  const t0 = performance.now();
  const r = await engine.run(code + MEASURE_FOOTER);
  const ms = performance.now() - t0;
  const line = r.logs.find((l) => l.startsWith('B123D_MEASURE '));
  let measure = null;
  if (line) {
    const payload = line.slice('B123D_MEASURE '.length);
    try { measure = JSON.parse(payload); }
    catch (e) { measure = JSON.parse(JSON.parse('"' + payload + '"')); }
  }
  return { ms, ok: r.ok, errors: r.errors, measure, cache: r.cache };
}

const REL = 1e-6;
const ABS = 1e-6;
const closeNum = (a, b, rel) => a === b
  || Math.abs(a - b) <= (rel ? REL * Math.max(1, Math.abs(a)) : ABS);

/** Compare two measurement maps: {exact: bool, problems: [non-close diffs]}. */
function diff(ref, got) {
  const problems = [];
  if (!ref || !got) {
    return { exact: false, problems: [ref ? 'no measurement' : 'reference has no measurement'] };
  }
  let exact = true;
  for (const name of Object.keys(ref)) {
    const a = ref[name];
    const b = got[name];
    if (JSON.stringify(a) === JSON.stringify(b)) { continue; }
    exact = false;
    if (!b) { problems.push('missing ' + name); continue; }
    let close = true;
    for (const k of Object.keys(a)) {
      if (k === 'bbox' && Array.isArray(a.bbox) && Array.isArray(b.bbox)) {
        close = close && a.bbox.every((v, i) => closeNum(v, b.bbox[i], false));
      } else if (typeof a[k] === 'number' && typeof b[k] === 'number') {
        close = close && closeNum(a[k], b[k], k === 'volume' || k === 'area' || k === 'length');
      } else {
        close = close && JSON.stringify(a[k]) === JSON.stringify(b[k]);
      }
    }
    if (!close) {
      problems.push(name + ': ' + JSON.stringify(a).slice(0, 160) + ' vs ' + JSON.stringify(b).slice(0, 160));
    }
  }
  for (const name of Object.keys(got)) {
    if (!(name in ref)) { exact = false; problems.push('extra ' + name); }
  }
  return { exact, problems };
}

const results = {};
const totals = { EXACT: 0, CLOSE: 0, FAIL: 0, COLD_ERROR: 0 };
const timing = { cold: 0, warm: 0, restored: 0, snapshot: 0, restore: 0 };
let snapBytes = 0;
const t00 = performance.now();
for (const [n, entry] of entries.entries()) {
  const files = assetsOf(entry);
  if ((entry.assets || []).length && Object.keys(files).length === 0) {
    results[entry.id] = { status: 'SKIP', reason: 'assets not found under ' + B123D_SRC };
    continue;
  }
  const res = { status: 'EXACT', problems: [], close: [] };
  try {
    if (Object.keys(files).length) { engine.loadExternalFiles(files); }
    const shared = await measureRun(entry.code);
    engine.resetKernel();
    if (Object.keys(files).length) { engine.loadExternalFiles(files); }
    const cold = await measureRun(entry.code);
    if (!cold.measure) {
      res.status = 'COLD_ERROR';
      res.problems.push((cold.errors[0] || 'no measurement').slice(0, 200));
    } else {
      const warm = await measureRun(entry.code);
      let t = performance.now();
      const snap = engine.snapshotCache();
      timing.snapshot += performance.now() - t;
      snapBytes += snap && snap.bin ? snap.bin.length : 0;
      engine.resetKernel();
      if (Object.keys(files).length) { engine.loadExternalFiles(files); }
      t = performance.now();
      const restoredInfo = engine.restoreCache(snap);
      timing.restore += performance.now() - t;
      const restored = await measureRun(entry.code);
      for (const [label, run] of [['shared', shared], ['warm', warm], ['restored', restored]]) {
        if (!run.measure) {
          res.problems.push(label + ' no measurement: ' + (run.errors[0] || '').slice(0, 200));
          continue;
        }
        const d = diff(cold.measure, run.measure);
        if (!d.exact) { res.close.push(label); }
        for (const p of d.problems) { res.problems.push(label + ' ' + p); }
      }
      res.cold = { ms: Math.round(cold.ms), misses: cold.cache.misses, volatile: cold.cache.volatile };
      res.warm = { ms: Math.round(warm.ms), hits: warm.cache.hits, misses: warm.cache.misses,
        volatile: warm.cache.volatile };
      res.restored = { ms: Math.round(restored.ms), hits: restored.cache.hits,
        misses: restored.cache.misses, info: restoredInfo,
        snapshotKB: snap && snap.bin ? Math.round(snap.bin.length / 1024) : 0 };
      timing.cold += cold.ms; timing.warm += warm.ms; timing.restored += restored.ms;
      if (res.problems.length) { res.status = 'FAIL'; }
      else if (res.close.length) { res.status = 'CLOSE'; }
    }
  } catch (e) {
    res.status = 'FAIL';
    res.problems.push('gate exception: ' + ((e && e.message) || e));
  }
  totals[res.status] = (totals[res.status] || 0) + 1;
  results[entry.id] = res;
  const w = res.warm ? `cold ${res.cold.ms} warm ${res.warm.ms} ms (hit ${res.warm.hits} miss ${res.warm.misses} vol ${res.warm.volatile})` : '';
  const r = res.restored ? ` | restored ${res.restored.ms} ms (miss ${res.restored.misses})` : '';
  const c = res.status === 'CLOSE' ? ' [' + res.close.join(',') + ']' : '';
  console.log(`[${n + 1}/${entries.length}] ${entry.id.padEnd(52)} ${res.status.padEnd(10)} ${w}${r}${c}`
    + (res.problems.length ? '\n      ' + res.problems.slice(0, 3).join('\n      ') : ''));
}
const secs = ((performance.now() - t00) / 1000).toFixed(0);
console.log('== totals ==', JSON.stringify(totals), 'in', secs, 's');
console.log('== time ==', Object.fromEntries(Object.entries(timing).map(([k, v]) => [k, Math.round(v)])),
  'snapshots', (snapBytes / 1048576).toFixed(1), 'MB total');
if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ totals, timing, results }, null, 1)); }
process.exit(totals.FAIL ? 1 : 0);
