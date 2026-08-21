// probe-jsfree.mjs — JS-mode repeat scene + 1MB/64KB free census between runs
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const SCENE = `
let s = "CascadeStudio";
for (let i = 0; i < 10; i++) { Translate([0, 70 * i, 0], Text3D(s + i, 40, 8)); }
let plate = Box(150, 40, 8);
plate = FilletEdges(plate, 3, [0,1,2,3]);
Translate([0, -70, 0], plate);
`;
const CENSUS = `
let oc = self.oc; let held = []; let c1 = 0;
let base = self.ocMemory.buffer.byteLength;
for (let i = 0; i < 1200; i++) {
  let a = new oc.TColStd_Array1OfReal_2(1, 131072);
  if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
  held.push(a); c1++;
}
for (const a of held) { try { a.delete(); } catch (e) {} }
held = []; let c64 = 0; base = self.ocMemory.buffer.byteLength;
for (let i = 0; i < 20000; i++) {
  let a = new oc.TColStd_Array1OfReal_2(1, 8192);
  if (self.ocMemory.buffer.byteLength > base) { a.delete(); break; }
  held.push(a); c64++;
}
for (const a of held) { try { a.delete(); } catch (e) {} }
console.log('CENSUS free1MB=' + c1 + ' free64K=' + Math.round(c64 / 16) + ' arena=' + (base / 1048576).toFixed(1));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  page.on('console', (m) => { const t = m.text(); if (t.includes('CENSUS')) console.log(t); });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  for (let i = 0; i < 5; i++) {
    await page.evaluate((c) => window.CascadeAPI.runCode(c), SCENE);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
    const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
    console.log(`run ${i + 1}: occt ${(s.occtWasm / 1048576).toFixed(1)} MB, argCache ${s.argCacheCount}, alive ${s.ocpStats ? s.ocpStats.alive : '-'}`);
    await page.evaluate((c) => window.CascadeAPI.runCode(c), CENSUS);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  }
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
