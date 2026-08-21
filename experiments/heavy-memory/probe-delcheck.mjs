// probe-delcheck.mjs — count del() failures / double-ptr anomalies per iteration
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
let failures = 0, attempts = 0, noptr = 0;
let del = (...a) => { for (const o of a) {
  attempts++;
  try {
    if (o && o.$$ && o.$$.ptr) { o.delete(); }
    else { noptr++; }
  } catch (e) { failures++; }
} };
let t = Text3D("CascadeStudio0", 40, 8);
let mb = () => (self.ocMemory.buffer.byteLength / 1048576).toFixed(1);
let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
del(mesher);
console.log('DELCHK start ' + mb());
for (let i = 0; i < 20; i++) {
  failures = 0; attempts = 0; noptr = 0;
  self.ForEachFace(t, (fi, face) => {
    let loc = new oc.TopLoc_Location_1();
    let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
    if (!myT.IsNull()) {
      const T = myT.get();
      const trsf = loc.Transformation();
      let n = T.NbNodes();
      for (let k = 1; k <= n; k++) { let p0 = T.Node(k); let p = p0.Transformed(trsf); p.X(); del(p0, p); }
      if (!T.HasNormals()) { T.ComputeNormals(); }
      for (let k = 0; k < n; k++) { let d0 = T.Normal_1(k + 1); let d = d0.Transformed(trsf); d.X(); del(d0, d); }
      let nt = T.NbTriangles();
      for (let k = 1; k <= nt; k++) { let tr = T.Triangle(k); tr.Value(1); del(tr); }
      del(trsf);
    }
    del(myT, loc);
  });
  console.log('DELCHK iter' + i + ' ' + mb() + ' attempts ' + attempts + ' failures ' + failures + ' noptr ' + noptr);
}
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('DELCHK') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
