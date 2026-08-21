import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('http://localhost:8441/?mode=python&pyruntime=pyodide&pysrc=real', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), HEAVY);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('guard lines: ' + logs.filter((l) => l.includes('fuse guard')).length);
  const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
  console.log('occt ' + (s.occtWasm / 1048576).toFixed(1) + ' alive ' + (s.ocpStats && s.ocpStats.alive));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
