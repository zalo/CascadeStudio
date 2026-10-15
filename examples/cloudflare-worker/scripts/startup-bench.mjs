// startup-bench.mjs — the Worker's OWN code (src/app.js) driven from Node, to
// measure what Cloudflare bills: the global-scope startup (1 s limit) and the
// per-request CPU (10 ms on Free) for each BOOT mode.
//
//   npm run prepare-assets                       # assets/ must exist
//   node scripts/startup-bench.mjs               # lite, BOOT=warm
//   node scripts/startup-bench.mjs --boot startup
//   node scripts/startup-bench.mjs --flavor upstream --boot warm
//
// Why Node: a deployed Worker freezes Date.now()/performance.now() during CPU
// work and local workerd pins the clock to 0 at global scope, so neither can
// time its own startup. Node runs the identical module graph (app.js +
// cascade-headless.mjs + the same wasm) and reports MAIN-THREAD CPU via
// process.threadCpuUsage(). The only thing it cannot reproduce is the speed
// of a Cloudflare edge machine — `wrangler deploy` prints the real
// "Worker Startup Time" for that.
//
// Requests go through the real fetch handler (`new Request(...)` ->
// worker.fetch), so per-request CPU includes JSON parsing, the export and the
// kernel reset — everything but the network.

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const FLAVOR = arg('--flavor', 'lite');
const BOOT = arg('--boot', 'warm');
const N = Number(arg('--repeat', '15'));

if (!fs.existsSync(join(ASSETS, 'cascade-headless.mjs'))) {
  console.error('assets/ is missing — run `npm run prepare-assets` first');
  process.exit(2);
}
const cpu = () => { const t = process.threadCpuUsage(); return (t.user + t.system) / 1000; };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

// Module "loading" — what workerd does before the global scope runs. The
// wasm compile is reported separately (workerd compiles CompiledWasm
// bindings itself; V8 compiles lazily, so this is mostly validation).
let c0 = cpu();
const occtWasm = await WebAssembly.compile(fs.readFileSync(join(ASSETS, 'cascadestudio.wasm')));
const micropythonWasm = await WebAssembly.compile(fs.readFileSync(join(ASSETS, 'micropython-cs.wasm')));
const compileMs = cpu() - c0;
c0 = cpu();
const micropythonJs = await import(join(ASSETS, 'micropython-cs.mjs'));
const { createWorker } = await import(join(HERE, '..', 'src', 'app.js'));
const fonts = {};
for (const f of ['FreeSans', 'FreeSansBold', 'FreeSansOblique', 'FreeSansBoldOblique']) {
  fonts[f] = ab(fs.readFileSync(join(ASSETS, 'fonts', f + '.ttf')));
}
const upstreamTreeText = FLAVOR === 'upstream'
  ? fs.readFileSync(join(ASSETS, 'upstream-b123d.json'), 'utf8') : undefined;
const importMs = cpu() - c0;

// ---- the global scope ---------------------------------------------------
c0 = cpu();
const worker = createWorker({ pySrc: FLAVOR, occtWasm, micropythonJs, micropythonWasm,
  fonts, upstreamTreeText });
await worker.bootAtStartup(BOOT);
const startupMs = cpu() - c0;

// Silence OCCT's STEP-writer chatter (it goes straight to stdout).
const realWrite = process.stdout.write.bind(process.stdout);
const quiet = () => { process.stdout.write = () => true; };
const loud = () => { process.stdout.write = realWrite; };

async function request(code, formats) {
  const req = new Request('http://worker/render', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, formats }) });
  quiet();
  const t = cpu();
  const res = await worker.fetch(req, {}, { waitUntil() {} });
  const body = await res.json();
  const ms = cpu() - t;
  loud();
  return { ms, status: res.status, body };
}

const BOX = 'from build123d import *\nshow(Box(10, 10, 10))\n';
const PLATE = 'from build123d import *\n'
  + 'p = Box(60, 40, 6) - GridLocations(44, 24, 2, 2) * Cylinder(3, 20)\nshow(p)\n';
const STARTER = fs.readFileSync(join(HERE, 'starter.py'), 'utf8');
const health = await (await worker.fetch(new Request('http://worker/health'), {}, {})).json();

console.log('flavor ' + FLAVOR + '   BOOT=' + BOOT + '   node ' + process.version);
console.log('  wasm compile (workerd does this)   ' + compileMs.toFixed(1) + ' ms');
console.log('  import modules                     ' + importMs.toFixed(1) + ' ms');
console.log('  GLOBAL SCOPE (startup budget 1 s)  ' + startupMs.toFixed(1) + ' ms   '
  + JSON.stringify(health.boot));

const rows = [];
for (const [name, code, formats] of [
  ['Box -> BREP', BOX, ['brep']],
  ['Box -> STEP', BOX, ['step']],
  ['plate with 4 holes -> STEP', PLATE, ['step']],
  ['starter (fillets, booleans) -> STEP', STARTER, ['step']],
]) {
  const first = await request(code, formats);
  const xs = [];
  for (let i = 0; i < N; i++) { xs.push((await request(code, formats)).ms); }
  rows.push({ name, first: first.ms, median: median(xs), min: Math.min(...xs), max: Math.max(...xs),
    ok: first.status === 200 });
  console.log('  ' + name.padEnd(36) + 'first ' + first.ms.toFixed(1).padStart(7) + ' ms   then median '
    + median(xs).toFixed(1).padStart(7) + ' ms (min ' + Math.min(...xs).toFixed(1) + ', max '
    + Math.max(...xs).toFixed(1) + ')   HTTP ' + first.status
    + (first.status !== 200 ? ' ' + JSON.stringify(first.body.errors).slice(0, 120) : ''));
}
const out = arg('--json', null);
if (out) {
  fs.writeFileSync(out, JSON.stringify({ flavor: FLAVOR, boot: BOOT, compileMs, importMs, startupMs,
    requests: rows }, null, 2));
}
