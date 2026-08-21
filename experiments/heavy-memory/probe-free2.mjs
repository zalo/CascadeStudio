import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const FREE_PROBE = `
let oc = self.oc;
let held = [];
let count = 0;
let base = self.ocMemory.buffer.byteLength;
const n1 = Math.floor(1048576 / 8);
for (let i = 0; i < 1200; i++) {
  let a = new oc.TColStd_Array1OfReal_2(1, n1);
  if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
  held.push(a); count++;
}
for (const a of held) { try { a.delete(); } catch (e) {} }
held = [];
let count64 = 0;
base = self.ocMemory.buffer.byteLength;
const n64 = Math.floor(65536 / 8);
for (let i = 0; i < 20000; i++) {
  let a = new oc.TColStd_Array1OfReal_2(1, n64);
  if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
  held.push(a); count64++;
}
for (const a of held) { try { a.delete(); } catch (e) {} }
console.log('FREEMB:' + count + ':' + Math.round(count64 / 16) + ':' + (base / 1048576).toFixed(1));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  page.on('console', (m) => { const t = m.text(); if (t.includes('FREEMB:')) console.log('SAMPLE ' + t); });
  await page.goto(`http://localhost:${process.env.CS_TEST_PORT || '8441'}/?mode=python&pyruntime=pyodide&pysrc=real`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async (c) => { window.CascadeAPI.setMode('python'); return window.CascadeAPI.runCode(c); }, HEAVY);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
    await page.evaluate(async (c) => {
      window.CascadeAPI.setMode('cascadestudio');
      return window.CascadeAPI.runCode(c);
    }, FREE_PROBE);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  }
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  const hits = [...text.matchAll(/FREEMB:(\d+):([\d.]+)/g)].map((m) => m[1] + ' MB free at arena ' + m[2]);
  console.log(hits.join('\n'));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
