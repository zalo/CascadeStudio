import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const THRESH = process.argv[2] || '8388608';
const PRE = THRESH === 'none' ? '' : `import gc\ngc.threshold(${THRESH})\n`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--expose-gc'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:8441/?mode=python&pyruntime=micropython&pysrc=upstream', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  const t0 = Date.now();
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), PRE + HEAVY);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  const ms = Date.now() - t0;
  const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
  console.log(`threshold=${THRESH}: eval ${ms} ms, pyWasm ${(s.pythonWasm/1048576).toFixed(1)} MB, occt ${(s.occtWasm/1048576).toFixed(1)} MB`);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
