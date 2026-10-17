// session-bench.mjs — time an editing session (--env session) against the
// stateless /render Worker on the same edit sequence.
//
//   npx wrangler dev --env session --port 8795     # (or a deployed URL)
//   npx wrangler dev --port 8791                   # optional stateless baseline
//   BASE=http://127.0.0.1:8795 STATELESS=http://127.0.0.1:8791 \
//     node scripts/session-bench.mjs [models.json] [--models mount,plate16] [--out f.json]
//
// Per model, in one fresh session:
//   cold      first render (engine boot if the isolate is new + full compute)
//   rerun     the same code again                 -> every op a cache hit
//   edit1     a late-in-the-script edit           -> only the tail recomputes
//   edit2     a second edit
//   revert    back to the original                -> hits again (still cached?)
//   restored  /evict (drop the in-memory working set), then edit1 again
//             -> restored from the session's SQLite snapshot
// and, with STATELESS set, the stateless /render of `cold` and `edit1`
// (each a full evaluation by design). Client-side wall time is what a user
// waits; `evalMs` is the server's evaluation time (0 on the edge's frozen
// clock during CPU work — read the client column there).

import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8795';
const STATELESS = process.env.STATELESS || '';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const MODELS_FILE = args.find((a) => a.endsWith('.json') && args[args.indexOf(a) - 1] !== '--out');
const ONLY = opt('models', null);
const OUT = opt('out', null);
const REPEAT = Number(opt('repeat', '1'));
// measure() meshes the scene for its bounding box (~2 s on plate16), which
// would swamp the edit timings: opt in with --measure.
const MEASURE = args.includes('--measure');

/** name -> {file|code, edits: [[from, to], [from, to]]} */
const DEFAULT_MODELS = {
  mount: { file: '/tmp/perf/models/mount.py',
    edits: [['FILLET = 1.5', 'FILLET = 2.0'], ['hole_d, inset = 6, 10', 'hole_d, inset = 5, 10']] },
  plate16: { file: '/tmp/perf/models/plate16.py',
    edits: [['FILLET = 0.5', 'FILLET = 0.8'], ['FILLET = 0.5', 'FILLET = 0.3']] },
  maker_coin: { file: '/tmp/perf/models/maker_coin.py',
    edits: [['Text("OS", font_size=15)', 'Text("CS", font_size=15)'],
      ['fillet(maker_coin.edges(Select.NEW), 2)', 'fillet(maker_coin.edges(Select.NEW), 1.5)']] },
  heat_exchanger: { file: '/tmp/perf/models/heat_exchanger.py',
    edits: [['fillet_radius = tube_spacing / 3', 'fillet_radius = tube_spacing / 4'],
      ['tube_extension = 3 * MM', 'tube_extension = 4 * MM']] },
};
const models = MODELS_FILE ? JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8')) : DEFAULT_MODELS;

async function call(method, url, body) {
  const t0 = performance.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { json = { ok: false, errors: [text.slice(0, 300)] }; }
      return { status: res.status, ms: performance.now() - t0, body: json };
    } catch (e) {
      if (attempt >= 2) { return { status: 0, ms: performance.now() - t0, body: { ok: false, errors: [String(e)] } }; }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const row = (label, r) => {
  const b = r.body || {};
  const c = b.cache || {};
  const s = b.session || {};
  return {
    step: label,
    status: r.status,
    clientMs: Math.round(r.ms),
    evalMs: b.timings ? b.timings.evalMs : null,
    hits: c.hits, misses: c.misses, volatile: c.volatile,
    warm: s.warm, booted: s.engineBooted,
    restoreMs: s.restore ? s.restore.totalMs : null,
    instance: s.instance, isolate: s.isolate,
    volume: b.measurement ? +b.measurement.volume.toFixed(4) : null,
    brepKB: b.brep ? Math.round(b.brep.length / 1024) : null,
    error: b.ok ? undefined : (b.errors || [b.error]).join(' | ').slice(0, 160),
  };
};

const results = {};
for (const [name, m] of Object.entries(models)) {
  if (ONLY && !ONLY.split(',').includes(name)) { continue; }
  const code = m.code || fs.readFileSync(m.file, 'utf8');
  const v1 = code.replace(m.edits[0][0], m.edits[0][1]);
  const v2 = code.replace(m.edits[1][0], m.edits[1][1]);
  if (v1 === code || v2 === code) { console.error(name + ': an edit did not apply'); process.exit(2); }
  const rows = [];
  for (let rep = 0; rep < REPEAT; rep++) {
    const sid = 'bench-' + name + '-' + Date.now().toString(36);
    const S = BASE + '/session/' + sid;
    const render = (src) => call('POST', S + '/render', { code: src, formats: ['brep'], measure: MEASURE });
    rows.push(row('cold', await render(code)));
    rows.push(row('rerun', await render(code)));
    rows.push(row('edit1', await render(v1)));
    rows.push(row('edit2', await render(v2)));
    rows.push(row('revert', await render(code)));
    await new Promise((r) => setTimeout(r, 1500));   // let the snapshot land
    await call('POST', S + '/evict');
    rows.push(row('restored', await render(v1)));
    const stats = await call('GET', S);
    rows.push({ step: 'storage', snapshot: stats.body.storage && stats.body.storage.snapshot,
      lastPersist: stats.body.storage && stats.body.storage.lastPersist,
      compactions: stats.body.isolate && stats.body.isolate.compactions,
      occtMB: stats.body.memory ? +(stats.body.memory.occtWasm / 1048576).toFixed(1) : null });
    await call('DELETE', S);
    if (STATELESS) {
      const sr = (src) => call('POST', STATELESS + '/render', { code: src, formats: ['brep'], measure: MEASURE });
      rows.push(Object.assign(row('stateless-cold', await sr(code)), { stateless: true }));
      rows.push(Object.assign(row('stateless-edit1', await sr(v1)), { stateless: true }));
    }
  }
  results[name] = rows;
  console.log('\n== ' + name);
  console.table(rows.filter((r) => r.step !== 'storage').map((r) => ({
    step: r.step, client: r.clientMs, eval: r.evalMs, hit: r.hits, miss: r.misses,
    warm: r.warm, boot: r.booted, restore: r.restoreMs, brepKB: r.brepKB,
    err: r.error ? r.error.slice(0, 60) : '' })));
  const st = rows.find((r) => r.step === 'storage');
  if (st) {
    console.log('  snapshot:', JSON.stringify(st.snapshot), ' compactions:', st.compactions,
      ' occt MB:', st.occtMB);
  }
}
if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ base: BASE, stateless: STATELESS, results }, null, 1)); }
