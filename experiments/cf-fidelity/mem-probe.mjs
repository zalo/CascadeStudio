// mem-probe.mjs — peak isolate memory per corpus model, headless Node.
//
//   CS_PY_SRC=upstream node experiments/cf-fidelity/mem-probe.mjs <id> [<id> …]
//     (one shared engine per process, like an isolate — run one id per process for fresh numbers)
//     [--step]       also exportSTEP() after each model
//     [--dist DIR]   cascade-core dist to boot (default packages/cascade-core/dist)
//     [--mp NAME]    micropython artifact base name in dist (default micropython-cs)
//     [--mpdir DIR]  directory holding the micropython pair (default: --dist)
//     [--json FILE]  append one JSON line per model
//   ids may be manifest ids or file:<path to a .py>
//
// "Peak" = the wasm linear-memory sizes AFTER the run (both only ever grow, so
// after == high-water) + the in-run samples the MicroPython bridge takes every
// 8192 calls (self._csMemSamples). Also reports gc.mem_alloc/mem_free of the
// MicroPython GC arena right after the run (before the next top-level collect
// could run, as far as the API allows) and the OCP shim's alive-wrapper count.
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MB = 1048576;
const mb = (n) => (n / MB).toFixed(1);

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  if (i < 0) { return dflt; }
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const DIST = resolve(opt('--dist', join(ROOT, 'packages', 'cascade-core', 'dist')));
const MPNAME = opt('--mp', 'micropython-cs');
const MPDIR = resolve(opt('--mpdir', DIST));
const CODEFILE = opt('--code', null);
const JSONOUT = opt('--json', null);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const ids = argv.filter((a) => !a.startsWith('--'));
const PY_SRC = process.env.CS_PY_SRC || 'upstream';

const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'test/b123d-validation/manifest.json'), 'utf8'));
const occtWasm = fs.readFileSync(join(DIST, 'cascadestudio.wasm'));
const micropythonWasm = fs.readFileSync(join(MPDIR, MPNAME + '.wasm'));
const micropythonJs = await import(pathToFileURL(join(MPDIR, MPNAME + '.mjs')).href);
const fonts = {};
for (const f of fs.readdirSync(join(DIST, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(DIST, 'fonts', f)); }
}
const { createHeadlessCascade } = await import(pathToFileURL(join(DIST, 'cascade-headless.mjs')).href);
const upstreamPy = PY_SRC === 'upstream'
  ? async (rel) => fs.readFileSync(join(DIST, 'upstream-b123d', rel), 'utf8') : undefined;

async function boot() {
  const t0 = Date.now();
  const e = await createHeadlessCascade({
    runtime: 'micropython', pySrc: PY_SRC, occtWasm, micropythonJs, micropythonWasm, fonts, upstreamPy,
  });
  return { engine: e, bootMs: Date.now() - t0 };
}

let { engine, bootMs } = await boot();
console.log('booted ' + PY_SRC + ' in ' + bootMs + ' ms, dist=' + DIST + ' mp=' + MPDIR + '/' + MPNAME);

function mpGcInfo() {
  try {
    const mp = globalThis.self._csMpInterpreter;
    mp.runPython('import gc as _g\nimport jsworker as _jw\n_jw.self._csGcA = _g.mem_alloc()\n_jw.self._csGcF = _g.mem_free()');
    return { alloc: Number(globalThis.self._csGcA), free: Number(globalThis.self._csGcF) };
  } catch (e) { console.log('gcinfo failed: ' + e); return null; }
}

let first = true;
for (const id of ids) {
  const entry = id.startsWith('file:') ? { id, code: fs.readFileSync(id.slice(5), 'utf8') }
    : manifest.find((x) => x.id === id);
  if (!entry) { console.log(id, 'NOT IN MANIFEST'); continue; }
  first = false;
  globalThis.self._csMemSamples = [];
  const before = engine.memoryStats();
  const t0 = Date.now();
  const r = await engine.run(entry.code, { language: 'python', mesh: false });
  const evalMs = Date.now() - t0;
  const m = engine.memoryStats();
  const samples = (globalThis.self._csMemSamples || []).filter((s) => s.length === 4);
  const calls = (globalThis.self._csOcpStats && globalThis.self._csOcpStats.created) || 0;
  const gi = mpGcInfo();
  const rss = process.memoryUsage();
  const ocp = m.ocp || m.ocpStats || null;
  const line = {
    id, pySrc: PY_SRC, ok: r.ok, shapes: r.shapeCount, evalMs,
    occtMB: +mb(m.occtWasm), pyMB: +mb(m.pythonWasm), totalMB: +mb(m.occtWasm + m.pythonWasm),
    occtBeforeMB: +mb(before.occtWasm), pyBeforeMB: +mb(before.pythonWasm),
    ocpCreated: calls, gcAllocMB: gi ? +mb(gi.alloc) : null, gcFreeMB: gi ? +mb(gi.free) : null,
    jsHeapMB: +mb(rss.heapUsed), rssMB: +mb(rss.rss),
    ocpAlive: m.ocpAlive != null ? m.ocpAlive : (ocp && ocp.alive != null ? ocp.alive : null),
    errors: r.errors.map((e) => String(e).split('\n').slice(0, 3).join(' / ')),
  };
  console.log('=== ' + id + ' ===  ok=' + r.ok + ' shapes=' + r.shapeCount + ' eval ' + evalMs + ' ms'
    + '\n    occt ' + mb(before.occtWasm) + ' -> ' + mb(m.occtWasm) + ' MB   py ' + mb(before.pythonWasm)
    + ' -> ' + mb(m.pythonWasm) + ' MB   total ' + mb(m.occtWasm + m.pythonWasm) + ' MB'
    + '\n    bridge calls ~' + calls + '   gc after run: alloc ' + (gi ? mb(gi.alloc) : '?')
    + ' MB free ' + (gi ? mb(gi.free) : '?') + ' MB   js heap ' + mb(rss.heapUsed) + ' MB   rss ' + mb(rss.rss) + ' MB'
    + (line.ocpAlive != null ? '   ocp alive ' + line.ocpAlive : ''));
  for (const e of line.errors) { console.log('    ERROR: ' + e); }
  if (flags.has('--samples')) {
    console.log('    samples (created:freed py/occt MB): ' + samples.map((s) => s[0] + ':' + s[1] + ' ' + mb(s[2]) + '/' + mb(s[3])).join('  '));
  }
  if (flags.has('--step') && r.ok) {
    try {
      const s = engine.exportSTEP();
      line.stepBytes = s.length;
      const m2 = engine.memoryStats();
      line.occtAfterStepMB = +mb(m2.occtWasm);
      console.log('    step ' + s.length + ' bytes, occt ' + mb(m2.occtWasm) + ' MB');
    } catch (e) { console.log('    STEP FAILED: ' + e.message); line.stepError = e.message; }
  }
  if (JSONOUT) { fs.appendFileSync(JSONOUT, JSON.stringify(line) + '\n'); }
  engine.reset();
}
process.exit(0);
