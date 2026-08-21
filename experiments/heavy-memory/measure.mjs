// measure.mjs — heavy-model memory A/B harness (heavy-model-memory round).
//
// Each measurement gets a FRESH page (wasm linear memory never shrinks, so a
// page's occtWasm is the high-water mark of everything that ran in it).
//
//   CS_TEST_HEADFUL=1 DISPLAY=:99 node experiments/heavy-memory/measure.mjs \
//     --runtime pyodide --pysrc real --model heavy [--query 'lowmem=1'] \
//     [--repeat-eval 1] [--out /tmp/mem.json]
//
// Models: starter | grid | heavy (heat_exchanger) | all (one fresh page per
// model). --repeat-eval N runs the SAME script N times in one page (cross-run
// retention/ratchet). Env: CS_TEST_PORT (default 8441).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const PORT = parseInt(process.env.CS_TEST_PORT || '8441', 10);
const RUNTIME = argVal('--runtime', 'pyodide');
const PY_SRC = argVal('--pysrc', '');
const MODEL = argVal('--model', 'all');
const EXTRA_QUERY = argVal('--query', '');
const REPEAT_EVAL = parseInt(argVal('--repeat-eval', '1'), 10);
const OUT = argVal('--out', '');

const GRID = `from build123d import *
with BuildPart() as plate:
    Box(150, 100, 10)
    fillet(plate.edges().filter_by(Axis.Z), radius=6)
    with GridLocations(15, 15, 9, 6):
        Hole(radius=3)
show(plate)
`;

const manifest = JSON.parse(readFileSync(
  join(ROOT, 'test', 'b123d-validation', 'manifest-all.json'), 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;

async function newPage(context) {
  const page = await context.newPage();
  page.on('pageerror', () => {});
  let query = `?mode=python&pyruntime=${RUNTIME}`;
  if (PY_SRC) query += `&pysrc=${PY_SRC}`;
  if (EXTRA_QUERY) query += '&' + EXTRA_QUERY;
  await page.goto(`http://localhost:${PORT}/${query}`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined,
    { timeout: 300000 }); // the python starter runs on load
  return page;
}

async function runPython(page, code, timeout) {
  const t0 = Date.now();
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), code);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined,
    { timeout: timeout || 600000 });
  return Date.now() - t0;
}

async function stats(page) {
  await page.evaluate(() => { if (typeof globalThis.gc === 'function') { globalThis.gc(); globalThis.gc(); } });
  return page.evaluate(() => window.CascadeAPI._memoryStats());
}

const fmt = (b) => +(b / 1048576).toFixed(1);

async function main() {
  const browser = await chromium.launch({
    headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--expose-gc'],
  });
  const models = MODEL === 'all' ? ['starter', 'grid', 'heavy'] : [MODEL];
  const results = {};
  for (const model of models) {
    const context = await browser.newContext();
    const page = await newPage(context);
    // page load already ran the starter; measure that point first
    const afterLoad = await stats(page);
    const code = model === 'grid' ? GRID : model === 'heavy' ? HEAVY : null;
    let evalMs = [];
    if (code) {
      for (let i = 0; i < REPEAT_EVAL; i++) { evalMs.push(await runPython(page, code)); }
    } else {
      // starter: re-run the starter REPEAT_EVAL-1 more times for ratchet data
      const starter = await page.evaluate(() =>
        window.CascadeAPI._app.constructor.starterCode('python'));
      for (let i = 1; i < REPEAT_EVAL; i++) { evalMs.push(await runPython(page, starter)); }
    }
    const after = await stats(page);
    results[model] = {
      evalMs,
      occtAfterLoadMB: fmt(afterLoad.occtWasm),
      occtAfterMB: fmt(after.occtWasm),
      pyWasmAfterMB: fmt(after.pythonWasm),
      jsHeapUsedMB: fmt(after.jsHeapUsed),
      argCacheCount: after.argCacheCount,
      sceneShapesCount: after.sceneShapesCount,
      historySteps: after.historySteps,
      historyShapePins: after.historyShapePins,
      ocpStats: after.ocpStats,
    };
    const o = results[model];
    console.log(`[${RUNTIME}${PY_SRC ? '+' + PY_SRC : ''}${EXTRA_QUERY ? '?' + EXTRA_QUERY : ''}] ${model}: ` +
      `occt ${o.occtAfterLoadMB} -> ${o.occtAfterMB} MB, py ${o.pyWasmAfterMB} MB, ` +
      `eval ${evalMs.join('/')} ms, cache ${o.argCacheCount}, hist ${o.historySteps}/${o.historyShapePins} pins` +
      (o.ocpStats ? `, ocp alive ${o.ocpStats.alive}` : ''));
    if (o.ocpStats) {
      console.log('  top classes: ' + o.ocpStats.topClasses.slice(0, 15)
        .map(([c, n]) => `${c}:${n}`).join(' '));
    }
    await page.close();
    await context.close();
  }
  await browser.close();
  if (OUT) { writeFileSync(OUT, JSON.stringify(results, null, 1)); console.log('wrote ' + OUT); }
}

main().catch((e) => { console.error(e); process.exit(1); });
