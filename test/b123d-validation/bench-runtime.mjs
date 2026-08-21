// bench-runtime.mjs - measure what the choice of Python interpreter COSTS:
// startup (cold + warm), worker memory at rest and after work, and the bytes
// each runtime has to download. Backs test/b123d-validation/runtime-comparison.md.
//
//   CS_TEST_HEADFUL=1 DISPLAY=:99 node test/b123d-validation/bench-runtime.mjs \
//     --runtime brython|pyodide|micropython [--repeat 3] [--corpus] [--out /tmp/bench.json]
//
// Env: CS_TEST_PORT (default 8517). Requires `npm run build` first; the
// pyodide runtime additionally needs the vendored core distribution
// (packages/cascade-core/scripts/fetch-pyodide.cjs).
//
// What each number means:
//   assetFetchMs   wall time to download the runtime's own assets over HTTP
//                  with the cache bypassed (localhost — a LOWER BOUND on any
//                  real network; the byte table is the honest proxy)
//   bootTiming     worker-reported split: fetch / interpreter init / compiling
//                  build123d-lite, from PythonRuntime.js + PyodideRuntime.js
//   firstEvalMs    runCode(trivial script) on a page that has never run
//                  Python: boot + evaluate + mesh, i.e. what a user waits for
//   warmEvalMs     the same call once the runtime is up (no boot in it)
//   memory         occtWasm / pythonWasm are exact wasm linear-memory sizes
//                  read inside the worker. `performance.memory` does NOT
//                  exist in workers, so Brython's cost (plain JS objects) is
//                  invisible from there — the renderer process's RSS is
//                  sampled instead, after forcing GC in both the page and the
//                  worker (--js-flags=--expose-gc). RSS is the honest
//                  apples-to-apples number: it covers V8 heaps and wasm
//                  memories alike. It is also sticky (V8 rarely returns pages
//                  to the OS), so read the DELTAS, not the absolutes.
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
const PORT = parseInt(process.env.CS_TEST_PORT || '8517', 10);
const RUNTIME = argVal('--runtime', process.env.CS_PY_RUNTIME || 'brython');
const REPEAT = parseInt(argVal('--repeat', '3'), 10);
const WITH_CORPUS = args.includes('--corpus');
const CORPUS_TIMEOUT = parseInt(argVal('--script-timeout', '30000'), 10);
const OUT = argVal('--out', `/tmp/bench-${RUNTIME}.json`);

// Python SOURCE layer (--pysrc / CS_PY_SRC): '' (runtime default), 'lite',
// 'upstream' (micropython), or 'real' (pyodide: REAL build123d 0.11.1 over
// the OCP shim — PyodideRealB123d.js).
const PY_SRC = argVal('--pysrc', process.env.CS_PY_SRC || '');

const RUNTIME_ASSETS = {
  brython: ['brython.js'],
  pyodide: ['pyodide/pyodide.mjs', 'pyodide/pyodide.asm.mjs',
    'pyodide/pyodide.asm.wasm', 'pyodide/python_stdlib.zip',
    'pyodide/pyodide-lock.json'],
  micropython: ['micropython.mjs', 'micropython-settrace.wasm'],
};
if (RUNTIME === 'pyodide' && PY_SRC === 'real') {
  // what pysrc=real ADDS to the pyodide download: the wheels + the shared
  // OCP-shim payload (table/registry/OCP modules are fetched individually at
  // boot; the table+registry dominate — the per-module files are counted via
  // the manifest at runtime and are small)
  RUNTIME_ASSETS.pyodide = RUNTIME_ASSETS.pyodide.concat([
    'pyodide/numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl',
    'pyodide/typing_extensions-4.15.0-py3-none-any.whl',
    'pyodide/build123d-0.11.1-py3-none-any.whl',
    'pyodide/anytree-2.13.0-py3-none-any.whl',
    'pyodide/webcolors-24.8.0-py3-none-any.whl',
    'pyodide/trianglesolver-1.2-py3-none-any.whl',
    'upstream-b123d/ocp_shim/table.json',
    'upstream-b123d/ocp_shim/_registry.py',
    'upstream-b123d/ocp_import_map.json',
  ]);
}

const TRIVIAL = `from build123d import *
b = Box(1, 1, 1)
show(b)
`;

async function ensureServer() {
  const alive = await new Promise((res) => {
    const req = http.get({ host: 'localhost', port: PORT, path: '/' }, (r) => { r.resume(); res(true); });
    req.on('error', () => res(false));
    req.setTimeout(2000, () => { req.destroy(); res(false); });
  });
  if (alive) return null;
  const proc = spawn('npx', ['http-server', './packages/cascade-studio/dist',
    '-p', String(PORT), '-c-1', '--silent'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  return proc;
}

/** A page that has loaded the app in JS mode — nothing Python has happened
 *  yet, so its worker is the BASELINE the Python runtime is charged against. */
async function newJsModePage(context) {
  const page = await context.newPage();
  page.on('pageerror', () => {});
  const query = `?mode=cascadestudio${RUNTIME !== 'brython' ? '&pyruntime=' + RUNTIME : ''}` +
    (['lite', 'upstream', 'real'].includes(PY_SRC) ? '&pysrc=' + PY_SRC : '');
  await page.goto(`http://localhost:${PORT}/${query}`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 90000 });
  return page;
}

/** Total RSS of THIS browser's renderer processes (the page and its workers
 *  live there together). Chromium tells us which pids are renderers over
 *  CDP's SystemInfo.getProcessInfo; the resident size comes from /proc. */
async function rendererRssKb(cdp) {
  let info;
  try {
    info = await cdp.send('SystemInfo.getProcessInfo');
  } catch (e) { return 0; }
  let total = 0;
  for (const proc of info.processInfo || []) {
    if (proc.type !== 'renderer') { continue; }
    try {
      const statm = readFileSync(`/proc/${proc.id}/statm`, 'utf8').split(' ');
      total += (parseInt(statm[1], 10) * 4096) / 1024;   // resident pages -> KB
    } catch (e) { /* the process exited between the two reads */ }
  }
  return Math.round(total);
}

/** GC-settled memory picture: force collection in the page AND the worker
 *  (memoryStats does the worker side), then sample both. */
async function stats(page, cdp) {
  await page.evaluate(() => { if (typeof globalThis.gc === 'function') { globalThis.gc(); globalThis.gc(); } });
  const worker = await page.evaluate(() => window.CascadeAPI._memoryStats());
  await new Promise((r) => setTimeout(r, 400)); // let the OS settle the RSS
  worker.rendererRssKb = await rendererRssKb(cdp);
  return worker;
}

/** Download the runtime's assets with the HTTP cache bypassed. */
async function measureAssets(page, assets) {
  return page.evaluate(async (list) => {
    const out = { totalMs: 0, totalBytes: 0, files: {} };
    for (const name of list) {
      const t0 = performance.now();
      const response = await fetch(name + '?nocache=' + Math.random(), { cache: 'no-store' });
      const buffer = await response.arrayBuffer();
      const ms = performance.now() - t0;
      out.files[name] = { ms: +ms.toFixed(1), bytes: buffer.byteLength };
      out.totalMs += ms;
      out.totalBytes += buffer.byteLength;
    }
    out.totalMs = +out.totalMs.toFixed(1);
    return out;
  }, assets);
}

async function runPython(page, code, timeout) {
  const t0 = Date.now();
  await page.evaluate(async (c) => {
    window.CascadeAPI.setMode('python');
    return await window.CascadeAPI.runCode(c);
  }, code);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined,
    { timeout: timeout || 120000 });
  return Date.now() - t0;
}

async function main() {
  const serverProc = await ensureServer();
  const browser = await chromium.launch({
    headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--expose-gc'],
  });

  // A browser-level CDP session is how we learn which pids are renderers.
  const cdp = await browser.newBrowserCDPSession();
  const runs = [];
  for (let i = 0; i < REPEAT; i++) {
    // A fresh context is a fresh HTTP cache: the first page pays the cold
    // download, the second one does not.
    const context = await browser.newContext();
    const run = { index: i };

    // COLD: a fresh context, so nothing of the runtime is cached yet. The
    // baseline is this very page before any Python has run — same renderer
    // process, so the deltas are clean. (The asset download measurement runs
    // LAST, for the same reason: 13 MB of ArrayBuffers in this renderer would
    // otherwise show up in the memory numbers.)
    let page = await newJsModePage(context);
    run.baseline = await stats(page, cdp);
    run.coldFirstEvalMs = await runPython(page, TRIVIAL);
    run.afterBoot = await stats(page, cdp);
    run.warmEvalMs = await runPython(page, TRIVIAL);
    const starter = await page.evaluate(() =>
      window.CascadeAPI._app.constructor.starterCode('python'));
    run.starterEvalMs = await runPython(page, starter);
    run.afterStarter = await stats(page, cdp);
    await page.close();

    // WARM: same context, so the runtime's assets come from the HTTP cache.
    page = await newJsModePage(context);
    run.baselineWarm = await stats(page, cdp);
    run.warmFirstEvalMs = await runPython(page, TRIVIAL);
    run.afterWarmBoot = await stats(page, cdp);

    if (WITH_CORPUS) {
      const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
      let ran = 0, failed = 0, stalled = 0;
      const perScript = {};
      const t0 = Date.now();
      for (const entry of manifest) {
        try {
          perScript[entry.id] = await runPython(page, entry.code, CORPUS_TIMEOUT);
          ran++;
        } catch (e) {
          failed++;
          // A stuck worker would poison every later script; stop rather than
          // report a memory number for half a corpus.
          const idle = await page.waitForFunction(() => !window.CascadeAPI.isWorking(),
            undefined, { timeout: 60000 }).then(() => true, () => false);
          if (!idle) { stalled++; break; }
        }
      }
      const sorted = Object.values(perScript).sort((a, b) => a - b);
      const at = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1,
        Math.floor(q * sorted.length))] : 0);
      run.corpus = {
        ran, failed, stalled, wallMs: Date.now() - t0,
        medianMs: at(0.5), p95Ms: at(0.95), perScript,
      };
      run.afterCorpus = await stats(page, cdp);
    }
    // Last, so the downloaded bytes cannot land in any memory sample.
    run.assetsCold = await measureAssets(page, RUNTIME_ASSETS[RUNTIME]);
    await page.close();
    await context.close();

    runs.push(run);
    console.log(`[${RUNTIME}] run ${i + 1}/${REPEAT}: cold ${run.coldFirstEvalMs}ms, ` +
      `warm ${run.warmFirstEvalMs}ms, boot ${JSON.stringify(run.afterBoot.bootTiming)}, ` +
      `rss ${(run.afterBoot.rendererRssKb / 1024).toFixed(0)}MB (baseline ${(run.baseline.rendererRssKb / 1024).toFixed(0)}MB), ` +
      `pyWasm ${(run.afterBoot.pythonWasm / 1048576).toFixed(1)}MB` +
      (run.corpus ? `, corpus ${run.corpus.ran} scripts in ${(run.corpus.wallMs / 1000).toFixed(0)}s` : ''));
  }

  await browser.close();
  if (serverProc) serverProc.kill();
  writeFileSync(OUT, JSON.stringify({ runtime: RUNTIME, runs }, null, 1));
  console.log('wrote ' + OUT);
}

main();
