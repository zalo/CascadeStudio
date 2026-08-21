import { chromium } from 'playwright';
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--expose-gc'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('http://localhost:8441/?mode=cascadestudio', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  const rr = await page.evaluate(async () => window.CascadeAPI.runCode('console.log("gctype:" + (typeof globalThis.gc)); Box(1,1,1);'));
  console.log('runCode: ' + JSON.stringify(rr));
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  console.log('panel: ' + [...text.matchAll(/gctype:\w+/g)].map(m=>m[0]).join(','));
  console.log('pageconsole: ' + logs.filter(l=>l.includes('gctype')).join(','));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
