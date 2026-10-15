// workerd-ladder.mjs — COMBINED isolate memory (all wasm memories + the V8
// heap) per model, measured in local workerd (`wrangler dev`) through the
// inspector, which is what Cloudflare's 128 MB isolate limit counts.
//
//   node experiments/cf-fidelity/workerd-ladder.mjs --env upstream \
//        [--mode fresh|sequence] [--port 8804] [--inspector 8805] \
//        [--models examples/clock,examples/toy_truck,...] [--json out.json]
//
//   --mode fresh     one wrangler dev (one isolate) PER MODEL: that model's
//                    own high-water on a cold isolate (default)
//   --mode sequence  ONE isolate for the whole list, in order: wasm memories
//                    never shrink, so this is the high-water a warm isolate
//                    carries from request to request
//
// Per model: HTTP status, round trip, occtWasm + pythonWasm from the /render
// payload, and V8 heap usedSize/totalSize (CDP Runtime.getHeapUsage) read
// right after the response. combinedUsed = wasm + heap used, combinedTotal =
// wasm + heap total (V8's committed heap). Local workerd does NOT enforce the
// 128 MB limit — this measures how close each model gets. The inspector
// target is verified to be THIS worker (its scripts must come from
// examples/cloudflare-worker) — other projects' `wrangler dev` share the
// machine and the default inspector port.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EX = join(ROOT, 'examples', 'cloudflare-worker');
const require = createRequire(join(EX, 'package.json'));
const WS = require('ws');
const MB = 1048576;

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ENV = opt('--env', '');
const MODE = opt('--mode', 'fresh');
const PORT = parseInt(opt('--port', '8804'), 10);
const INSPECTOR = parseInt(opt('--inspector', '8805'), 10);
const JSON_OUT = opt('--json', null);
const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'test/b123d-validation/manifest.json'), 'utf8'));
const STARTER = fs.readFileSync(join(EX, 'scripts', 'smoke.mjs'), 'utf8')
  .match(/const STARTER = `([\s\S]*?)`;/)[1];
const models = opt('--models', 'starter').split(',').map((id) => {
  if (id === 'starter') { return { id, code: STARTER }; }
  const e = manifest.find((x) => x.id === id);
  if (!e) { throw new Error('not in manifest: ' + id); }
  return { id, code: e.code };
});

let dev = null;
async function startDev() {
  const log = '/tmp/cf-ladder-dev-' + PORT + '.log';
  const args = ['wrangler', 'dev', '--env=' + ENV, '--port', String(PORT), '--ip', '127.0.0.1',
    '--inspector-port', String(INSPECTOR)];
  dev = spawn('npx', args, { cwd: EX, detached: true, stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 500));
    const txt = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
    if (/Ready on/.test(txt)) { break; }
    if (/ERROR|Address already in use/.test(txt) || Date.now() - t0 > 120000) {
      throw new Error('wrangler dev failed to start:\n' + txt.slice(-2000));
    }
  }
}
function stopDev() {
  if (!dev) { return; }
  try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) { /* gone */ }
  dev = null;
  // the workerd child can outlive the group signal; bracket trick per machine rules
  try { execSync(`pkill -f "[w]orkerd serve.*entry=127.0.0.1:${PORT}"`); } catch (e) { /* none */ }
}

function cdp(onOpen, onMessage, timeoutMs) {
  const ws = new WS(`ws://127.0.0.1:${INSPECTOR}/ws`,
    { headers: { Origin: `http://127.0.0.1:${INSPECTOR}` }, maxPayload: 1 << 30 });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('inspector timeout')); }, timeoutMs);
    const send = (id, method, params) => ws.send(JSON.stringify({ id, method, params: params || {} }));
    const done = (v) => { clearTimeout(timer); ws.close(); resolve(v); };
    ws.on('message', (d) => onMessage(JSON.parse(String(d)), send, done));
    ws.on('open', () => onOpen(send));
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

/** Is the inspector target THIS worker? (its scripts come from our tree) */
async function inspectorIsMine() {
  const scripts = [];
  return cdp((send) => { send(1, 'Debugger.enable'); setTimeout(() => send(2, 'Debugger.disable'), 1500); },
    (m, send, done) => {
      if (m.method === 'Debugger.scriptParsed' && m.params.url) { scripts.push(m.params.url); }
      if (m.id === 2) { done(scripts.some((u) => u.includes('cloudflare-worker'))); }
    }, 30000);
}

async function heap() {
  // usedSize/totalSize as the request left them, then again after a full GC.
  // workerd's inspector never answers HeapProfiler.collectGarbage, but a heap
  // snapshot forces a full GC first — take one and throw the chunks away.
  let before = null;
  const h = await cdp((send) => { send(1, 'Runtime.getHeapUsage'); },
    (m, send, done) => {
      // (wrangler's proxy echoes some replies WITH a method field: match ids)
      if (m.id === 1) { before = m.result; send(2, 'HeapProfiler.enable'); send(3, 'HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
      if (m.id === 3) { send(4, 'Runtime.getHeapUsage'); }
      if (m.id === 4) {
        done({ used: before.usedSize, total: before.totalSize, gcUsed: m.result.usedSize,
          gcTotal: m.result.totalSize, backing: m.result.backingStorageSize });
      }
    }, 300000);
  h.mine = await inspectorIsMine();
  return h;
}

async function render(code) {
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/render`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, formats: ['step'], measure: true }),
  });
  const ms = Date.now() - t0;
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, ms, body };
}

const rows = [];
const mb = (n) => +(n / MB).toFixed(1);
if (MODE === 'sequence') { await startDev(); }
try {
  for (const m of models) {
    if (MODE === 'fresh') { await startDev(); }
    const r = await render(m.code);
    const mem = (r.body && r.body.memory) || {};
    const h = await heap();
    const wasm = (mem.occtWasm || 0) + (mem.pythonWasm || 0);
    const row = {
      id: m.id, env: ENV || 'lite', mode: MODE, status: r.status, ms: r.ms,
      vol: r.body && r.body.measurement ? +r.body.measurement.volume.toFixed(3) : null,
      occtMB: mb(mem.occtWasm || 0), pyMB: mb(mem.pythonWasm || 0),
      heapUsedMB: mb(h.used), heapTotalMB: mb(h.total),
      heapGcUsedMB: mb(h.gcUsed), heapGcTotalMB: mb(h.gcTotal), backingMB: mb(h.backing || 0),
      combinedUsedMB: mb(wasm + h.used), combinedTotalMB: mb(wasm + h.total),
      combinedGcUsedMB: mb(wasm + h.gcUsed), combinedGcTotalMB: mb(wasm + h.gcTotal),
      inspectorIsThisWorker: h.mine,
      error: r.body && !r.body.ok ? String((r.body.errors || [r.body.error])[0]).slice(0, 160) : undefined,
    };
    rows.push(row);
    console.log(`${row.id.padEnd(40)} ${row.status} ${String(row.ms).padStart(6)} ms  occt ${row.occtMB} + py ${row.pyMB}`
      + ` + heap ${row.heapUsedMB}/${row.heapTotalMB} (after GC ${row.heapGcUsedMB}/${row.heapGcTotalMB})`
      + ` = ${row.combinedGcUsedMB} MB live, ${row.combinedGcTotalMB} committed`
      + `  ${row.combinedGcTotalMB <= 128 ? 'FITS' : (row.combinedGcUsedMB <= 128 ? 'LIVE-FITS' : 'OVER')}${h.mine ? '' : '  (!! inspector is NOT this worker)'}`
      + (row.error ? '  ' + row.error : ''));
    if (MODE === 'fresh') { stopDev(); await new Promise((r) => setTimeout(r, 1500)); }
  }
} finally {
  stopDev();
}
if (JSON_OUT) {
  const prev = fs.existsSync(JSON_OUT) ? JSON.parse(fs.readFileSync(JSON_OUT, 'utf8')) : [];
  fs.writeFileSync(JSON_OUT, JSON.stringify(prev.concat(rows), null, 1));
}
process.exit(0);
