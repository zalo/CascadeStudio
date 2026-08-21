// probe-free6.mjs — ptrType swap + universality across classes
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
// 1) swap ptrType to the ctor-subclass type, then delete
let c = new oc.gp_Pnt_1();
let a = T.Node(1);
const pa = a.$$.ptr; const pre = words(pa);
a.$$.ptrType = c.$$.ptrType;
a.delete();
const post = words(pa);
console.log('FREE6 swap-delete changed=' + (pre !== post) + ' pre=[' + pre + '] post=[' + post + ']');
c.delete();
// 2) universality: gp_Dir from Normal_1, gp_Trsf from Transformation, TopoDS_Face cast
const check = (name, obj) => {
  const p = obj.$$.ptr; const b = words(p);
  console.log('FREE6 ' + name + ': ptrType=' + obj.$$.ptrType.name);
  obj.delete();
  console.log('FREE6 ' + name + ' freed=' + (b !== words(p)));
};
check('Normal_1->gp_Dir', T.Normal_1(1));
check('Transformation->gp_Trsf', loc.Transformation());
let exp0 = new oc.TopExp_Explorer_2(t, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
check('Explorer.Current->TopoDS_Shape', exp0.Current());
exp0.delete();
check('Triangle->Poly_Triangle', T.Triangle(1));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + String(e).slice(0, 300)));
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('FREE6') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
