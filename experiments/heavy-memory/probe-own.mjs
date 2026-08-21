// probe-own.mjs — ownership map: does each call return a fresh allocation or an internal pointer?
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
let t = Text3D("Cascade0", 40, 8);
let mesher = new oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
mesher.delete();
let face0 = null, edge0 = null, loc = new oc.TopLoc_Location_1();
self.ForEachFace(t, (i, f) => { if (!face0) { face0 = f; } });
self.ForEachEdge(face0, (i, e) => { if (!edge0) { edge0 = e; } });
let myT = oc.BRep_Tool.Triangulation(face0, loc, 0);
let myP = oc.BRep_Tool.PolygonOnTriangulation_1(edge0, myT, loc);
let T = myT.get();
if (!T.HasNormals()) { T.ComputeNormals(); }
const P = myP ? myP.get() : null;
let exp0 = new oc.TopExp_Explorer_2(t, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
const same = (name, f) => { try { const a = f(), b = f(); console.log('OWN ' + name + ': ' + (a.$$.ptr === b.$$.ptr ? 'INTERNAL-REF (same ptr!)' : 'fresh copy')); } catch (e) { console.log('OWN ' + name + ': threw ' + String(e).slice(0, 80)); } };
same('Explorer.Current', () => exp0.Current());
same('Triangulation.Node', () => T.Node(1));
same('Triangulation.UVNode', () => T.UVNode(1));
same('Triangulation.Normal_1', () => T.Normal_1(1));
same('Triangulation.Triangle', () => T.Triangle(1));
same('Location.Transformation', () => loc.Transformation());
same('Polygon.Nodes', () => P.Nodes());
same('BRep_Tool.Triangulation(handle)', () => oc.BRep_Tool.Triangulation(face0, loc, 0));
same('BRep_Tool.Surface_2(handle)', () => oc.BRep_Tool.Surface_2(face0));
same('TopoDS_Cast.Face_1', () => oc.TopoDS_Cast.Face_1(exp0.Current()));
same('face.Orientation copy? shape', () => face0.Located ? face0 : face0);
same('gp_Pnt.XYZ (const-ref)', () => { let s = new oc.gp_Pnt_1(); const r = s.XYZ(); s.delete(); return r; });
exp0.delete();
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + String(e).slice(0, 200)));
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('OWN ') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
