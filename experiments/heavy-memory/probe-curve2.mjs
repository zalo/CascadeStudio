import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const RUNTIME = process.argv[2] || 'micropython';
const PYSRC = process.argv[3] || 'upstream';
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto(`http://localhost:8441/?mode=python&pyruntime=${RUNTIME}&pysrc=${PYSRC}`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate(async () => {
    window.CascadeAPI.setMode('cascadestudio');
    await window.CascadeAPI.runCode('self._csMemSampleMask=2047; Box(1,1,1);');
    window.CascadeAPI.setMode('python');
  });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 60000 });
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), HEAVY);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  const samples = await page.evaluate(async () => {
    // read the worker-side sample buffer via a JS-mode eval
    window.CascadeAPI.setMode('cascadestudio');
    const r = await window.CascadeAPI.runCode('console.log("SAMPLES:" + JSON.stringify(self._csMemSamples||[])); Box(1,1,1);');
    return r;
  });
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  const idx = text.lastIndexOf('SAMPLES:');
  const end = text.indexOf('\n', idx);
  const arr = JSON.parse(text.slice(idx + 8, end > 0 ? end : undefined).replace(/\\"/g, '"'));
  console.log('calls, freed, pyWasmMB, occtMB');
  for (const row of arr) console.log(row.length === 4 ? [row[0], row[1], Math.round(row[2] / 1048576), Math.round(row[3] / 1048576)].join(', ') : row.join(', '));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
