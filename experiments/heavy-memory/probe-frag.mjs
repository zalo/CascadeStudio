import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const TRIVIAL = 'from build123d import *\nb = Box(1, 1, 1)\nshow(b)\n';
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:8441/?mode=python&pyruntime=pyodide&pysrc=real', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  for (const code of [HEAVY, TRIVIAL]) {
    await page.evaluate(async (c) => window.CascadeAPI.runCode(c), code);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  }
  // JS-mode: allocate progressively larger contiguous arrays; report when arena grows
  const probe = `
let oc = self.oc;
let out = { tenMBFits: 0, oneMBFits: 0 };
let base = self.ocMemory.buffer.byteLength;
let held = [];
const n10 = Math.floor(10 * 1048576 / 8);
for (let i = 0; i < 60; i++) {
  let a = new oc.TColStd_Array1OfReal_2(1, n10);
  if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
  held.push(a); out.tenMBFits++;
}
for (const a of held) { try { a.delete(); } catch (e) {} }
held = [];
base = self.ocMemory.buffer.byteLength;
const n1 = Math.floor(1048576 / 8);
for (let i = 0; i < 400; i++) {
  let a = new oc.TColStd_Array1OfReal_2(1, n1);
  if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
  held.push(a); out.oneMBFits++;
}
for (const a of held) { try { a.delete(); } catch (e) {} }
out.arenaMB = +(self.ocMemory.buffer.byteLength / 1048576).toFixed(1);
console.log('FRAG:' + JSON.stringify(out));
Box(1,1,1);
`;
  await page.evaluate(async (c) => {
    window.CascadeAPI.setMode('cascadestudio');
    await window.CascadeAPI.runCode(c);
  }, probe);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  const idx = text.lastIndexOf('FRAG:{');
  console.log(text.slice(idx, idx + 300));
  const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
  console.log('occt now ' + (s.occtWasm / 1048576).toFixed(1));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
