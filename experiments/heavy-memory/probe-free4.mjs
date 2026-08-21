// probe-free4.mjs — read heap bytes at the chunk before/after delete()
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
let t = Text3D("CascadeStudio0", 40, 8);
let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
mesher.delete();
let face0 = null, loc = new oc.TopLoc_Location_1();
self.ForEachFace(t, (i, f) => { if (!face0) { face0 = f; } });
let myT = oc.BRep_Tool.Triangulation(face0, loc, 0);
let T = myT.get();
const words = (ptr, n) => Array.from(new Uint32Array(self.ocMemory.buffer, ptr - 8, n)).join(',');
// ctor case
let c = new oc.gp_Pnt_1(); const pc = c.$$.ptr;
const preC = words(pc, 8); c.delete(); const postC = words(pc, 8);
console.log('FREE4 ctor ptr=' + pc + ' pre=[' + preC + '] post=[' + postC + '] changed=' + (preC !== postC));
// method-return case
let a = T.Node(1); const pa = a.$$.ptr;
const preA = words(pa, 8); a.delete(); const postA = words(pa, 8);
console.log('FREE4 node ptr=' + pa + ' pre=[' + preA + '] post=[' + postA + '] changed=' + (preA !== postA));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + String(e).slice(0, 300)));
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('FREE4') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
