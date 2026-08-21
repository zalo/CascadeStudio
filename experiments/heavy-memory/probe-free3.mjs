// probe-free3.mjs — does delete() actually free method-returned objects?
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
// ctor path
let c1 = new oc.gp_Pnt_1(); const pc1 = c1.$$.ptr; const cnt1 = c1.$$.count.value; c1.delete();
let c2 = new oc.gp_Pnt_1(); const pc2 = c2.$$.ptr; c2.delete();
console.log('FREE3 ctor: ptr1=' + pc1 + ' ptr2=' + pc2 + ' reused=' + (pc1 === pc2) + ' count=' + cnt1);
// method-return path
let a = T.Node(1); const pa = a.$$.ptr; const cnta = a.$$.count.value;
console.log('FREE3 node pre-del: ptr=' + pa + ' count=' + cnta + ' smart=' + (!!a.$$.smartPtr) + ' preserve=' + (!!a.$$.preservePointerOnDelete));
a.delete();
console.log('FREE3 node post-del: ptr=' + a.$$.ptr + ' smartPtr=' + a.$$.smartPtr);
let c3 = new oc.gp_Pnt_1(); const pc3 = c3.$$.ptr; c3.delete();
console.log('FREE3 after-node ctor: ptr=' + pc3 + ' reusedNodeChunk=' + (pc3 === pa));
// second method return immediately after deleting the first
let b1 = T.Node(1); const pb1 = b1.$$.ptr; b1.delete();
let b2 = T.Node(1); const pb2 = b2.$$.ptr; b2.delete();
console.log('FREE3 node-node: ptr1=' + pb1 + ' ptr2=' + pb2 + ' reused=' + (pb1 === pb2));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + String(e).slice(0, 300)));
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('FREE3') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
