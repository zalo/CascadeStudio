// probe-embind.mjs — per-call wasm leak isolation on candidate embind paths
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
let mb = () => self.ocMemory.buffer.byteLength;
let del = (o) => { try { if (o && o.$$ && o.$$.ptr) o.delete(); } catch (e) {} };
let box = Box(10, 10, 10);
let mesher = new oc.BRepMesh_IncrementalMesh_2(box, 0.1, false, 0.5, false);
del(mesher);
let loc = new oc.TopLoc_Location_1();
let face = null;
self.ForEachFace(box, (i, f) => { if (!face) face = f; });
let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
let T = myT.get();
let trsf = loc.Transformation();
let scratch = new oc.gp_Pnt_1();
const N = 100000;
const tests = {
  'ctor gp_Pnt_1': () => { let p = new oc.gp_Pnt_1(); del(p); },
  'T.Node(1)': () => { let p = T.Node(1); del(p); },
  'T.NbNodes()': () => { T.NbNodes(); },
  'scratch.Transformed(trsf)': () => { let p = scratch.Transformed(trsf); del(p); },
  'scratch.X()': () => { scratch.X(); },
  'T.Triangle(1)': () => { let t = T.Triangle(1); del(t); },
  'trsf2 = loc.Transformation()': () => { let t2 = loc.Transformation(); del(t2); },
};
for (const [name, fn] of Object.entries(tests)) {
  for (let i = 0; i < 1000; i++) fn(); // warm the free lists
  const b0 = mb();
  for (let i = 0; i < N; i++) fn();
  const d = mb() - b0;
  console.log('EMBINDLEAK ' + name + ': ' + (d / N).toFixed(2) + ' B/call (total ' + (d / 1048576).toFixed(1) + ' MB)');
}
del(scratch); del(trsf); del(T); del(myT); del(loc);
Box(1, 1, 1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('EMBINDLEAK') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
