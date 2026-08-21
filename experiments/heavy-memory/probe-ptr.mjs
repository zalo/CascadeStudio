// probe-ptr.mjs — watch wrapper $$.ptr addresses during the leaking pattern
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
let mb = () => self.ocMemory.buffer.byteLength;
let del = (...a) => { for (const o of a) { try { if (o && o.$$ && o.$$.ptr) o.delete(); } catch (e) {} } };
let t = Text3D("CascadeStudio0", 40, 8);
let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
del(mesher);
let face0 = null, loc = new oc.TopLoc_Location_1();
self.ForEachFace(t, (i, f) => { if (!face0) { face0 = f; } });
let myT = oc.BRep_Tool.Triangulation(face0, loc, 0);
let T = myT.get();
let trsf = loc.Transformation();
console.log('PTR begin');
for (let i = 0; i < 1500000; i++) {
  let a = T.Node(1); let b = a.Transformed(trsf);
  if (i % 100000 === 0) {
    console.log('PTR i=' + i + ' a=' + a.$$.ptr + ' b=' + b.$$.ptr + ' arena=' + (mb()/1048576).toFixed(1));
  }
  del(a, b);
}
console.log('PTR done arena=' + (mb()/1048576).toFixed(1));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('PTR') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
