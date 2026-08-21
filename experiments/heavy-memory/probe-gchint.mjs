import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const HINT = process.argv[2] === 'hint';
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--expose-gc'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:8441/?mode=python&pyruntime=micropython&pysrc=upstream', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  if (HINT) {
    await page.evaluate(async () => {
      window.CascadeAPI.setMode('cascadestudio');
      await window.CascadeAPI.runCode('self._csMemGcHint=1; console.log("hint on, worker gc: " + (typeof globalThis.gc)); Box(1,1,1);');
      window.CascadeAPI.setMode('python');
    });
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 60000 });
  }
  const t0 = Date.now();
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), HEAVY);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  const ms = Date.now() - t0;
  const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
  console.log(`gcHint=${HINT}: eval ${ms} ms, pyWasm ${(s.pythonWasm/1048576).toFixed(1)} MB, occt ${(s.occtWasm/1048576).toFixed(1)} MB`);
  await new Promise((r) => setTimeout(r, 1000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  const i = text.lastIndexOf('worker gc');
  if (i >= 0) console.log(text.slice(i, i + 40));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
