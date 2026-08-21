// probe-meshiso3.mjs — does the creep need the remesh, the extraction, or both?
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const VARIANT = process.argv[2] || 'extract-only';
const EXTRACT = `
  self.ForEachFace(t, (fi, face) => {
    let loc = new oc.TopLoc_Location_1();
    let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
    if (!myT.IsNull()) {
      const T = myT.get();
      const trsf = loc.Transformation();
      let n = T.NbNodes();
      for (let i = 1; i <= n; i++) { let p0 = T.Node(i); let p = p0.Transformed(trsf); p.X(); del(p0, p); }
      if (!T.HasNormals()) { T.ComputeNormals(); }
      for (let i = 0; i < n; i++) { let d0 = T.Normal_1(i + 1); let d = d0.Transformed(trsf); d.X(); del(d0, d); }
      let nt = T.NbTriangles();
      for (let k = 1; k <= nt; k++) { let tr = T.Triangle(k); tr.Value(1); del(tr); }
      del(trsf);
    }
    del(myT); // extract-only: do NOT Nullify (keep the mesh attached)
    del(loc);
  });`;
const BODIES = {
  // mesh once; extract in a loop; never Clean
  'extract-only': { pre: `
    let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
    del(mesher);`, loop: EXTRACT },
  // remesh in a loop; never extract (kernel-only, known flat) but WITH ComputeNormals
  'remesh-normals': { pre: '', loop: `
    let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
    del(mesher);
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) { const T = myT.get(); if (!T.HasNormals()) { T.ComputeNormals(); } }
      del(myT, loc);
    });
    (oc.BRepTools.Clean_1 || oc.BRepTools.Clean).call(oc.BRepTools, t, false);`,
  },
};
const B = BODIES[VARIANT];
const CODE = `
let oc = self.oc;
let del = (...a) => { for (const o of a) { try { if (o && o.$$ && o.$$.ptr) o.delete(); } catch (e) {} } };
let t = Text3D("CascadeStudio0", 40, 8);
let mb = () => (self.ocMemory.buffer.byteLength / 1048576).toFixed(1);
${B.pre}
self._csForceGC = ${process.env.CS_FORCE_GC === '1'};
console.log('MESHISO ${VARIANT} start ' + mb());
for (let i = 0; i < 24; i++) {
  if (self._csForceGC && typeof globalThis.gc === 'function') { globalThis.gc(); globalThis.gc(); }
  ${B.loop}
  console.log('MESHISO iter' + i + ' ' + mb());
}
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--js-flags=--expose-gc'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('MESHISO') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
