// headless-corpus.mjs — the validation corpus through the HEADLESS engine in
// plain Node (no browser), with the peak isolate memory of every model.
//
//   node experiments/cf-fidelity/headless-corpus.mjs [--pysrc upstream|lite|real]
//        [--mpdir DIR] [--workers 6] [--only substr] [--timeout 60000]
//        [--out results.json] [--baseline results.json] [--shared]
//
// Each script runs in a worker_thread realm with its OWN engine (wasm memories
// only grow, so a fresh engine per script makes `occtWasm + pythonWasm` after
// the run that script's high-water mark — what a fresh Cloudflare isolate
// would need). --shared keeps one engine per worker instead (engine.reset()
// between scripts, like a warm isolate). Classification is run-lite.mjs's:
// PASS (volume 0.5%, bbox 1e-3 per axis, every reference shape by name),
// MISMATCH, ERROR, TIMEOUT, SKIP (reference failed natively).
// --baseline prints per-script classification differences against a
// committed results file (e.g. experiments/upstream-topology-spike/
// stage3-flip-default-results.json for the upstream default leg).
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MB = 1048576;
const MEASURE_FOOTER = `

import build123d as _b123d_lite_mod
print("B123D_MEASURE " + _b123d_lite_mod._measure_globals_json(globals()))
`;

if (!isMainThread) {
  // ------------------------------------------------------------------ worker
  const { dist, mpdir, pysrc } = workerData;
  const occtWasm = fs.readFileSync(join(dist, 'cascadestudio.wasm'));
  const micropythonWasm = pysrc === 'real' ? undefined : fs.readFileSync(join(mpdir, 'micropython-cs.wasm'));
  const micropythonJs = pysrc === 'real' ? undefined : await import(pathToFileURL(join(mpdir, 'micropython-cs.mjs')).href);
  // pysrc=real: REAL build123d on Pyodide through the same host seam the
  // Worker's --env real uses (examples/cloudflare-worker/src/real.js), from
  // the prepared assets/pyodide/ (patched glue, precompiled numpy modules).
  let pyodideHost;
  if (pysrc === 'real') {
    const PB = join(ROOT, 'examples', 'cloudflare-worker', 'assets', 'pyodide') + '/';
    const pman = JSON.parse(fs.readFileSync(PB + 'manifest.json', 'utf8'));
    globalThis.__csDynlibModules = {};
    for (const d of pman.dynlibs) {
      globalThis.__csDynlibModules[d.name] = new WebAssembly.Module(fs.readFileSync(PB + 'dynlib/' + d.name + '.wasm'));
    }
    const { loadPyodide } = await import(pathToFileURL(PB + 'pyodide.mjs').href);
    const createPyodideModule = (await import(pathToFileURL(PB + 'pyodide.asm.mjs').href)).default;
    const WHEELS = { numpy: ['numpy-lite.zip', 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl'],
      'typing-extensions': ['typing_extensions-4.15.0-py3-none-any.whl'] };
    pyodideHost = {
      boot: ({ stdout, stderr }) => loadPyodide({ indexURL: join(ROOT, 'vendor', 'pyodide') + '/',
        createPyodideModule, stdout, stderr }),
      async installWheels(py, names) {
        for (const n of names) {
          const [file, asName] = WHEELS[n] || [n];
          await py._api.install(new Uint8Array(fs.readFileSync(PB + 'wheels/' + file)), asName || file,
            py._api.sitePackages, new Map([['INSTALLER', 'cascade-headless']]));
        }
      },
    };
  }
  const fonts = {};
  for (const f of fs.readdirSync(join(dist, 'fonts'))) {
    if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(dist, 'fonts', f)); }
  }
  const { createHeadlessCascade } = await import(pathToFileURL(join(dist, 'cascade-headless.mjs')).href);
  const upstreamPy = pysrc === 'upstream' || pysrc === 'real'
    ? async (rel) => fs.readFileSync(join(dist, 'upstream-b123d', rel), 'utf8') : undefined;
  const t0 = Date.now();
  const engine = await createHeadlessCascade({
    runtime: pysrc === 'real' ? 'pyodide' : 'micropython', pyodide: pyodideHost,
    pySrc: pysrc, occtWasm, micropythonJs, micropythonWasm, fonts, upstreamPy,
  });
  const bootMs = Date.now() - t0;
  parentPort.postMessage({ type: 'ready', bootMs });
  parentPort.on('message', async (job) => {
    const t1 = Date.now();
    let r;
    try {
      if (job.assets) { engine.loadExternalFiles(job.assets); }
      r = await engine.run(job.code + MEASURE_FOOTER, { language: 'python', mesh: false });
    } catch (e) {
      r = { ok: false, errors: ['host exception: ' + (e && e.message)], logs: [] };
    }
    const evalMs = Date.now() - t1;
    const m = engine.memoryStats();
    let measure = null;
    const line = (r.logs || []).find((l) => l.startsWith('B123D_MEASURE '));
    if (line) {
      try { measure = JSON.parse(line.slice('B123D_MEASURE '.length)); } catch (e) { measure = null; }
    }
    parentPort.postMessage({
      type: 'done', id: job.id, evalMs, measure, errors: (r.errors || []).slice(0, 4),
      occtMB: m.occtWasm / MB, pyMB: m.pythonWasm / MB,
      ocpAlive: m.ocpStats ? m.ocpStats.alive : null,
    });
    try { engine.reset(); } catch (e) { /* next job sees it */ }
  });
} else {
  // ------------------------------------------------------------------ main
  const argv = process.argv.slice(2);
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i < 0 ? dflt : argv[i + 1]; };
  const dist = resolve(opt('--dist', join(ROOT, 'packages', 'cascade-core', 'dist')));
  const mpdir = resolve(opt('--mpdir', dist));
  const pysrc = opt('--pysrc', 'upstream');
  const WORKERS = parseInt(opt('--workers', '6'), 10);
  const ONLY = opt('--only', null);
  const TIMEOUT = parseInt(opt('--timeout', '60000'), 10);
  const OUT = opt('--out', null);
  const BASELINE = opt('--baseline', null);
  const SHARED = argv.includes('--shared');
  const B123D_SRC = process.env.B123D_SRC || '/tmp/b123d';
  const VOL_REL_TOL = 0.005, VOL_ZERO_ABS = 1e-6, BBOX_ABS_TOL = 1e-3;

  const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'test/b123d-validation/manifest.json'), 'utf8'))
    .filter((e) => !ONLY || ONLY.split(',').some((o) => e.id.includes(o)));
  const reference = JSON.parse(fs.readFileSync(join(ROOT, 'test/b123d-validation/reference.json'), 'utf8'));

  const readAssets = (entry) => {
    const names = entry.assets || [];
    if (!names.length) { return null; }
    const files = {};
    for (const n of names) {
      const p = join(B123D_SRC, entry.data_dir || '', n);
      if (fs.existsSync(p)) { files[n] = fs.readFileSync(p, 'utf8'); }
    }
    return Object.keys(files).length ? files : null;
  };
  const compareShapes = (refShapes, got) => {
    const problems = [];
    for (const [name, ref] of Object.entries(refShapes)) {
      if (ref.measure_error) { continue; }
      const lite = got[name];
      if (!lite) { problems.push(`missing shape '${name}'`); continue; }
      if (lite.measure_error) { problems.push(`'${name}' measure error: ${lite.measure_error}`); continue; }
      if (ref.volume <= VOL_ZERO_ABS) {
        if (lite.volume > 1e-3) { problems.push(`'${name}' volume ${lite.volume.toFixed(4)} vs ~0`); }
      } else if (Math.abs(lite.volume - ref.volume) > VOL_REL_TOL * ref.volume) {
        problems.push(`'${name}' volume ${lite.volume.toFixed(3)} vs ${ref.volume.toFixed(3)}`);
      }
      if (!lite.bbox) { problems.push(`'${name}' has no bbox`); continue; }
      for (let i = 0; i < 6; i++) {
        if (Math.abs(lite.bbox[i] - ref.bbox[i]) > BBOX_ABS_TOL) {
          problems.push(`'${name}' bbox[${i}] ${lite.bbox[i].toFixed(4)} vs ${ref.bbox[i].toFixed(4)}`);
          break;
        }
      }
    }
    return problems;
  };

  const results = {};
  const queue = [];
  for (const e of manifest) {
    const ref = reference[e.id];
    if (!ref || ref.status !== 'ok') { results[e.id] = { status: 'SKIP' }; continue; }
    queue.push(e);
  }
  const total = queue.length;
  let done = 0;
  const t0 = Date.now();

  const spawn = () => new Promise((res) => {
    const w = new Worker(fileURLToPath(import.meta.url), {
      workerData: { dist, mpdir, pysrc },
      resourceLimits: { maxOldGenerationSizeMb: 4096 },
      stdout: true, stderr: true,
    });
    w.stdout.resume(); w.stderr.resume();   // the engine echoes every log line
    w.once('message', (m) => res({ w, bootMs: m.bootMs }));
    w.once('error', (e) => { console.log('worker boot error', e.message); res(null); });
  });

  async function lane(lid) {
    let cur = null;
    while (queue.length) {
      const entry = queue.shift();
      if (!cur) { cur = await spawn(); if (!cur) { results[entry.id] = { status: 'ERROR', gap: 'boot' }; continue; } }
      const { w } = cur;
      const out = await new Promise((res) => {
        let settled = false;
        const finish = (v) => { if (!settled) { settled = true; clearTimeout(timer); w.off('message', onMsg); w.off('error', onErr); w.off('exit', onExit); res(v); } };
        const onMsg = (m) => { if (m.type === 'done' && m.id === entry.id) { finish(m); } };
        const onErr = (e) => finish({ crashed: 'worker error: ' + (e && e.message) });
        const onExit = (c) => finish({ crashed: 'worker exited ' + c });
        const timer = setTimeout(() => finish({ timeout: true }), TIMEOUT);
        w.on('message', onMsg); w.on('error', onErr); w.on('exit', onExit);
        w.postMessage({ id: entry.id, code: entry.code, assets: readAssets(entry) });
      });
      const ref = reference[entry.id];
      let res;
      if (out.timeout) {
        res = { status: 'TIMEOUT' };
      } else if (out.crashed) {
        res = { status: 'ERROR', gap: out.crashed };
      } else if (!out.measure) {
        const txt = out.errors.join(' | ').replace(/\\n/g, '\n');
        const py = txt.match(/(\w+Error|\w+Exception)[:][^\n]*/);
        res = { status: 'ERROR', gap: (py ? py[0] : txt.split('\n')[0]).slice(0, 140) };
      } else {
        const problems = compareShapes(ref.shapes, out.measure);
        res = problems.length ? { status: 'MISMATCH', problems: problems.slice(0, 4) } : { status: 'PASS' };
      }
      if (out.evalMs != null) {
        Object.assign(res, { evalMs: out.evalMs, occtMB: +out.occtMB.toFixed(1), pyMB: +out.pyMB.toFixed(1),
          totalMB: +(out.occtMB + out.pyMB).toFixed(1), ocpAlive: out.ocpAlive });
      }
      results[entry.id] = res;
      done++;
      console.log(`[${done}/${total}] ${entry.id.padEnd(46)} ${res.status.padEnd(8)} `
        + (res.totalMB != null ? `${String(res.totalMB).padStart(6)} MB (occt ${res.occtMB} + py ${res.pyMB}) ${res.evalMs} ms` : '')
        + (res.status === 'PASS' ? '' : '  ' + (res.gap || (res.problems || [])[0] || '')));
      if (!SHARED || out.timeout || out.crashed) {
        try { await w.terminate(); } catch (e) { /* gone */ }
        cur = null;
      }
    }
    if (cur) { try { await cur.w.terminate(); } catch (e) { /* gone */ } }
  }
  await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, (_, i) => lane(i)));

  const counts = {};
  for (const r of Object.values(results)) { counts[r.status] = (counts[r.status] || 0) + 1; }
  const scored = Object.values(results).filter((r) => r.totalMB != null);
  const over = Object.entries(results).filter(([, r]) => r.totalMB != null && r.totalMB > 128);
  const peak = scored.reduce((a, r) => Math.max(a, r.totalMB), 0);
  console.log(`\n== ${pysrc} totals == ${JSON.stringify(counts)} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(`   peak isolate ${peak.toFixed(1)} MB; over 128 MB: ${over.length} ` + over.map(([k, r]) => `${k}=${r.totalMB}`).join(', '));
  if (BASELINE) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    const diffs = [];
    for (const [k, r] of Object.entries(results)) {
      const b = base[k] ? base[k].status : 'absent';
      if (b !== r.status) { diffs.push(`${k}: ${b} -> ${r.status} ${r.gap || (r.problems || [])[0] || ''}`); }
    }
    console.log(`   vs baseline ${BASELINE}: ${diffs.length} differences` + (diffs.length ? '\n     ' + diffs.join('\n     ') : ''));
  }
  if (OUT) { fs.writeFileSync(OUT, JSON.stringify(results, null, 1)); console.log('   -> ' + OUT); }
  process.exit(0);
}
