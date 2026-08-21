import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const N = parseInt(process.argv[2] || '2', 10);
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:8441/?mode=python&pyruntime=pyodide&pysrc=real', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate(async () => {
    window.CascadeAPI.setMode('cascadestudio');
    await window.CascadeAPI.runCode('self._csMemFreeProbe=1; Box(1,1,1);');
    window.CascadeAPI.setMode('python');
  });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 60000 });
  const TRIVIAL = 'from build123d import *\nb = Box(1, 1, 1)\nshow(b)\n';
  const seq = process.argv[3] === 'interleave' ? [HEAVY, TRIVIAL, HEAVY] : Array(N).fill(HEAVY);
  for (const code of seq) {
    await page.evaluate(async (c) => window.CascadeAPI.runCode(c), code);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  }
  await page.evaluate(async () => {
    window.CascadeAPI.setMode('cascadestudio');
    await window.CascadeAPI.runCode('console.log("MARKS:" + JSON.stringify((self._csMemSamples||[]).filter(r => typeof r[0] === "string"))); Box(1,1,1);');
  });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  const idx = text.lastIndexOf('MARKS:');
  const end = text.indexOf('\n', idx);
  const arr = JSON.parse(text.slice(idx + 6, end > 0 ? end : undefined).replace(/\\"/g, '"'));
  for (const [l, o, f] of arr) console.log(l + ', ' + (o / 1048576).toFixed(1) + (f !== undefined && f >= 0 ? ', free ' + f : ''));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
