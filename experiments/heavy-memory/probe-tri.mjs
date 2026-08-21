import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:8452/?mode=python&pyruntime=pyodide&pysrc=real', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  for (let i = 0; i < 4; i++) {
    await page.evaluate(async (c) => window.CascadeAPI.runCode(c), HEAVY);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
    const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
    console.log(`run${i + 1}: occt ${(s.occtWasm / 1048576).toFixed(1)} alive ${s.ocpStats.alive} errs ${s.ocpStats.errs} meshRetention ${JSON.stringify(s.meshRetention)}`);
    console.log('  topErr: ' + JSON.stringify(s.ocpStats.topErr));
    console.log('  topAlive: ' + JSON.stringify(s.ocpStats.topAlive ? s.ocpStats.topAlive.slice(0, 10) : null));
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
