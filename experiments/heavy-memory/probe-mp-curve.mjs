import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:8441/?mode=python&pyruntime=micropython&pysrc=upstream', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  const samples = [];
  const timer = setInterval(async () => {
    try {
      const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
      samples.push([Math.round((Date.now() - t0) / 100) / 10, +(s.pythonWasm / 1048576).toFixed(0), +(s.occtWasm / 1048576).toFixed(0)]);
    } catch (e) {}
  }, 700);
  const t0 = Date.now();
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), HEAVY);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  clearInterval(timer);
  console.log('t[s], pyWasmMB, occtMB');
  console.log(samples.map((s) => s.join(',')).join('\n'));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
