// probe-delcheck2.mjs — which sub-loop retains memory (post-onset slope)?
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const V = process.argv[2] || 'nodes';
const INNER = {
  nodes: `let n = T.NbNodes();
      for (let k = 1; k <= n; k++) { let p0 = T.Node(k); let p = p0.Transformed(trsf); p.X(); del(p0, p); }`,
  nodesplain: `let n = T.NbNodes();
      for (let k = 1; k <= n; k++) { let p0 = T.Node(k); p0.X(); del(p0); }`,
  ctorplain: `let n = T.NbNodes();
      for (let k = 1; k <= n; k++) { let p0 = new oc.gp_Pnt_1(); p0.X(); del(p0); }`,
  tris: `let nt = T.NbTriangles();
      for (let k = 1; k <= nt; k++) { let tr = T.Triangle(k); tr.Value(1); del(tr); }`,
  facesonly: ``,
};
const CODE = `
let oc = self.oc;
let del = (...a) => { for (const o of a) { try { if (o && o.$$ && o.$$.ptr) o.delete(); } catch (e) {} } };
let t = Text3D("CascadeStudio0", 40, 8);
let mb = () => (self.ocMemory.buffer.byteLength / 1048576).toFixed(1);
let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
del(mesher);
console.log('DEL2 ${V} start ' + mb());
for (let i = 0; i < 40; i++) {
  self.ForEachFace(t, (fi, face) => {
    let loc = new oc.TopLoc_Location_1();
    let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
    if (!myT.IsNull()) {
      const T = myT.get();
      const trsf = loc.Transformation();
      ${INNER[V]}
      del(trsf);
    }
    del(myT, loc);
  });
  if (i % 4 === 3) console.log('DEL2 ${V} iter' + i + ' ' + mb());
}
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('DEL2') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
