// shot.mjs — starter screenshot via CascadeAPI.screenshot() → PNG file
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2] || '/tmp/starter.png';
const PORT = process.env.CS_TEST_PORT || '8452';
const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
  args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await (await browser.newContext()).newPage();
page.on('pageerror', () => {});
await page.goto(`http://localhost:${PORT}/?mode=python`, { timeout: 60000 });
await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
await new Promise((r) => setTimeout(r, 2000));
const dataUrl = await page.evaluate(() => window.CascadeAPI.screenshot());
writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('wrote ' + OUT);
await browser.close();
