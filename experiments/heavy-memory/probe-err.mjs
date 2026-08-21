import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR: ' + String(e).slice(0, 300)));
  await page.goto('http://localhost:8441/?mode=python&pyruntime=pyodide&pysrc=real', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  const r = await page.evaluate(async (c) => window.CascadeAPI.runCode(c), HEAVY);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((res) => setTimeout(res, 1500));
  const errs = await page.evaluate(() => window.CascadeAPI.getErrors ? window.CascadeAPI.getErrors() : []);
  console.log('errors: ' + JSON.stringify(errs).slice(0, 1200));
  console.log('result: ' + JSON.stringify(r).slice(0, 400));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
