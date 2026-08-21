// probe-pair.mjs — exact pair-pattern leak isolation, 200k reps each
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
let mb = () => self.ocMemory.buffer.byteLength;
let del = (...a) => { for (const o of a) { try { if (o && o.$$ && o.$$.ptr) o.delete(); } catch (e) {} } };
let t = Text3D("CascadeStudio0", 40, 8);
let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
del(mesher);
let face0 = null, T = null, myT = null, loc = new oc.TopLoc_Location_1();
self.ForEachFace(t, (i, f) => { if (!face0) { face0 = f; } });
myT = oc.BRep_Tool.Triangulation(face0, loc, 0);
T = myT.get();
let trsf = loc.Transformation();
let scratch = new oc.gp_Pnt_1();
const N = 200000;
const tests = {
  'node-only': () => { let a = T.Node(1); del(a); },
  'node-node': () => { let a = T.Node(1); let b = T.Node(2); del(a, b); },
  'ctor-transformed': () => { let a = new oc.gp_Pnt_1(); let b = a.Transformed(trsf); del(a, b); },
  'node-transformed': () => { let a = T.Node(1); let b = a.Transformed(trsf); del(a, b); },
  'node-transformed-revfree': () => { let a = T.Node(1); let b = a.Transformed(trsf); del(b, a); },
  'scratch-transformed': () => { let b = scratch.Transformed(trsf); del(b); },
};
for (const [name, fn] of Object.entries(tests)) {
  const b0 = mb();
  for (let i = 0; i < N; i++) fn();
  const d = mb() - b0;
  console.log('PAIR ' + name + ': ' + (d / N).toFixed(3) + ' B/call (total ' + (d / 1048576).toFixed(1) + ' MB)');
}
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('PAIR') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
