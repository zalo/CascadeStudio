// probe-free5.mjs — compare ptrType/rawDestructor between ctor and method-return handles
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
const words = (ptr) => Array.from(new Uint32Array(self.ocMemory.buffer, ptr - 8, 4)).join(',');
let c = new oc.gp_Pnt_1();
let a = T.Node(1);
console.log('FREE5 ctor ptrType.name=' + c.$$.ptrType.name + ' | node ptrType.name=' + a.$$.ptrType.name);
console.log('FREE5 sameRegisteredClass=' + (c.$$.ptrType.registeredClass === a.$$.ptrType.registeredClass) +
  ' samePtrType=' + (c.$$.ptrType === a.$$.ptrType));
console.log('FREE5 ctor destructorFunction=' + typeof c.$$.ptrType.destructorFunction +
  ' node destructorFunction=' + typeof a.$$.ptrType.destructorFunction);
console.log('FREE5 rawDestructor typeof=' + typeof a.$$.ptrType.registeredClass.rawDestructor);
// manual rawDestructor on the node object's ptr
const pa = a.$$.ptr;
const pre = words(pa);
try { a.$$.ptrType.registeredClass.rawDestructor(pa); } catch (e) { console.log('FREE5 manual rawDestructor threw: ' + e); }
const post = words(pa);
console.log('FREE5 manual-destroy pre=[' + pre + '] post=[' + post + '] changed=' + (pre !== post));
c.delete();
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + String(e).slice(0, 300)));
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('FREE5') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
