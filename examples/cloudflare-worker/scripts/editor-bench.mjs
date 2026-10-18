// The editor's path through an editing session, timed: what the remote-
// session editor (EDITOR.md) does on each evaluation — RemoteCascadeEngine,
// a framed /render with the viewport mesh — plus a timeline scrub and a
// STEP export. Same models and edits as session-bench.mjs.
//
//   BASE=http://127.0.0.1:8787 node scripts/editor-bench.mjs [--models mount,plate16] [--out f.json]
//
// Steps per model, one fresh session each:
//   cold      the session's first render (the isolate may already be booted)
//   rerun     the same code again: every op a cache hit; the cost is the
//             script's bookkeeping + meshing + transfer
//   edit1/2   a late-in-the-script edit, then a second one
//   history   mesh one timeline step (re-runs the cached script first when a
//             compaction rewound the kernel since the render)
//   step      export the last render's shape as STEP

import fs from 'node:fs';
import { RemoteCascadeEngine } from '../../../packages/cascade-core/src/engine/RemoteCascadeEngine.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('models', null);
const OUT = opt('out', null);

const MODELS = {
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

const GUI = { MeshRes: 0.1, 'Cache?': true, 'GroundPlane?': true, 'Grid?': true };
const results = {};
for (const [name, m] of Object.entries(MODELS)) {
  if (ONLY && !ONLY.split(',').includes(name)) { continue; }
  const code = fs.readFileSync(m.file, 'utf8');
  const variants = m.edits.map(([from, to]) => {
    const v = code.replace(from, to);
    if (v === code) { throw new Error(name + ': edit not found: ' + from); }
    return v;
  });
  const eng = new RemoteCascadeEngine({ endpoint: BASE,
    sessionId: 'eb-' + name + '-' + Date.now().toString(36) });
  await eng.init();
  const errors = [];
  eng.on('evalError', (e) => errors.push(e.message.split('\n')[0].slice(0, 120)));
  const rows = [];
  const render = async (step, src) => {
    errors.length = 0;
    const r = await eng.evaluate(src, { guiState: GUI, language: 'python' });
    const rep = eng.lastReport;
    const s = rep.session || {};
    rows.push({ step, clientMs: rep.wallMs,
      evalMs: rep.timings && rep.timings.evalMs, meshMs: rep.timings && rep.timings.combineMs,
      hits: rep.cache.hits, misses: rep.cache.misses, warm: s.warm, booted: s.engineBooted,
      faces: r.meshData ? r.meshData.faces.length : 0,
      meshMB: +(rep.meshBytes / 1048576).toFixed(2), wireMB: +(rep.wireBytes / 1048576).toFixed(2),
      isolate: s.isolate, error: errors.length ? errors.join(' | ') : undefined });
  };
  await render('cold', code);
  await render('rerun', code);
  await render('edit1', variants[0]);
  await render('edit2', variants[1]);
  // let the post-response work (snapshot, compaction) finish first
  await new Promise((r) => setTimeout(r, 1500));
  let t0 = performance.now();
  try {
    const h = await eng.meshHistoryStep(1, 0.1);
    rows.push({ step: 'history', clientMs: Math.round(performance.now() - t0), faces: h ? h[0].length : 0 });
  } catch (e) { rows.push({ step: 'history', error: e.message }); }
  t0 = performance.now();
  try {
    const step = await eng.exportSTEP();
    rows.push({ step: 'step', clientMs: Math.round(performance.now() - t0), stepKB: Math.round(step.length / 1024) });
  } catch (e) { rows.push({ step: 'step', error: e.message }); }
  results[name] = rows;
  console.log('\n' + name);
  console.table(rows);
}
if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2)); }
