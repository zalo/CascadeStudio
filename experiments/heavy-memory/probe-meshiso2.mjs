// probe-meshiso2.mjs — bisect the extraction leak inside shapeToMesh
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const VARIANT = process.argv[2] || 'B';
const BODY = {
  // B: triangulation handles only
  B: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      tris.push(myT);
      del(loc);
    });`,
  // C: + nodes + normals extraction
  C: `
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
      tris.push(myT);
      del(loc);
    });`,
  // D: + UV + iso curves
  D: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        if (T.HasUVNodes()) {
          let n = T.NbNodes(), UMin = 0, UMax = 0, VMin = 0, VMax = 0;
          for (let i = 0; i < n; i++) {
            let p = T.UVNode(i + 1); let x = p.X(), y = p.Y(); del(p);
            if (i === 0) { UMin = UMax = x; VMin = VMax = y; }
            if (x < UMin) UMin = x; else if (x > UMax) UMax = x;
            if (y < VMin) VMin = y; else if (y > VMax) VMax = y;
          }
          let sh = oc.BRep_Tool.Surface_2(face);
          let surf = sh.get();
          let uh = surf.UIso(UMin + (UMax - UMin) * 0.5);
          let vh = surf.VIso(VMin + (VMax - VMin) * 0.5);
          let ua = new oc.GeomAdaptor_Curve_2(vh);
          let va = new oc.GeomAdaptor_Curve_2(uh);
          self.LengthOfCurve(ua, UMin, UMax);
          self.LengthOfCurve(va, VMin, VMax);
          del(ua, va, uh, vh, sh);
        }
      }
      tris.push(myT);
      del(loc);
    });`,
  // E: + edge polygons on triangulation
  E: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        self.ForEachEdge(face, (ei, edge) => {
          let myP = null;
          try {
            myP = oc.BRep_Tool.PolygonOnTriangulation_1(edge, myT, loc);
            if (!myP.IsNull()) {
              let nodes = myP.get().Nodes();
              for (let j = 0; j < nodes.Length(); j++) { nodes.Value(j + 1); }
              del(nodes);
            }
          } catch (e) {}
          del(myP);
        });
      }
      tris.push(myT);
      del(loc);
    });`,

  // C1: nodes only
  C1: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        const trsf = loc.Transformation();
        let n = T.NbNodes();
        for (let i = 1; i <= n; i++) { let p0 = T.Node(i); let p = p0.Transformed(trsf); p.X(); del(p0, p); }
        del(trsf);
      }
      tris.push(myT);
      del(loc);
    });`,
  // C2: ComputeNormals only
  C2: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        if (!T.HasNormals()) { T.ComputeNormals(); }
      }
      tris.push(myT);
      del(loc);
    });`,
  // C3: ComputeNormals + Normal_1 loop
  C3: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        const trsf = loc.Transformation();
        if (!T.HasNormals()) { T.ComputeNormals(); }
        let n = T.NbNodes();
        for (let i = 0; i < n; i++) { let d0 = T.Normal_1(i + 1); let d = d0.Transformed(trsf); d.X(); del(d0, d); }
        del(trsf);
      }
      tris.push(myT);
      del(loc);
    });`,
  // C4: triangles only
  C4: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        let nt = T.NbTriangles();
        for (let k = 1; k <= nt; k++) { let tr = T.Triangle(k); tr.Value(1); del(tr); }
      }
      tris.push(myT);
      del(loc);
    });`,

  // C1a: Node copies only, no Transformed
  C1a: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        let n = T.NbNodes();
        for (let i = 1; i <= n; i++) { let p0 = T.Node(i); p0.X(); del(p0); }
      }
      tris.push(myT);
      del(loc);
    });`,
  // C1b: Transformed only on a scratch point
  C1b: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        const trsf = loc.Transformation();
        let scratch = new oc.gp_Pnt_1();
        let n = T.NbNodes();
        for (let i = 1; i <= n; i++) { let p = scratch.Transformed(trsf); p.X(); del(p); }
        del(scratch, trsf);
      }
      tris.push(myT);
      del(loc);
    });`,
  // C1c: pure embind churn control (create/delete 2n gp_Pnt)
  C1c: `
    self.ForEachFace(t, (fi, face) => {
      let loc = new oc.TopLoc_Location_1();
      let myT = oc.BRep_Tool.Triangulation(face, loc, 0);
      if (!myT.IsNull()) {
        const T = myT.get();
        let n = T.NbNodes();
        for (let i = 1; i <= 2 * n; i++) { let p = new oc.gp_Pnt_1(); p.X(); del(p); }
      }
      tris.push(myT);
      del(loc);
    });`,
};
const CODE = `
let oc = self.oc;
let del = (...a) => { for (const o of a) { try { if (o && o.$$ && o.$$.ptr) o.delete(); } catch (e) {} } };
let t = Text3D("CascadeStudio0", 40, 8);
let mb = () => (self.ocMemory.buffer.byteLength / 1048576).toFixed(1);
console.log('MESHISO variant ${VARIANT} start ' + mb());
for (let i = 0; i < 8; i++) {
  let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
  mesher.delete();
  let tris = [];
  ${BODY[VARIANT]}
  for (const h of tris) { try { h.Nullify(); } catch (e) {} del(h); }
  (oc.BRepTools.Clean_1 || oc.BRepTools.Clean).call(oc.BRepTools, t, false);
  console.log('MESHISO iter' + i + ' ' + mb());
}
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
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
