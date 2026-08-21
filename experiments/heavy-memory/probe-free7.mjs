// probe-free7.mjs — identify the base vs subclass rawDestructor wasm functions
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const CODE = `
let oc = self.oc;
const words = (ptr) => Array.from(new Uint32Array(self.ocMemory.buffer, ptr - 8, 4)).join(',');
let c = new oc.gp_Pnt_1();
let cast = c.$$.ptrType; // subclass ptrType
// find base ptrType via a method return
let d = c.Transformed(new oc.gp_Trsf_1());
console.log('FREE7 base name=' + d.$$.ptrType.name + ' sub name=' + cast.name);
const baseD = d.$$.ptrType.registeredClass.rawDestructor;
const subD = cast.registeredClass.rawDestructor;
console.log('FREE7 baseD=' + String(baseD.name) + ' subD=' + String(subD.name) + ' same=' + (baseD === subD));
try { console.log('FREE7 baseD.toString=' + baseD.toString().slice(0, 120)); } catch (e) {}
try { console.log('FREE7 subD.toString=' + subD.toString().slice(0, 120)); } catch (e) {}
// base destructor applied to a ctor-made object:
let e2 = new oc.gp_Pnt_1(); const pe = e2.$$.ptr; const pre = words(pe);
baseD(pe);
console.log('FREE7 baseD-on-ctor-object freed=' + (pre !== words(pe)));
// subclass destructor on a method-returned object:
let f2 = c.Transformed(new oc.gp_Trsf_1()); const pf = f2.$$.ptr; const pre2 = words(pf);
subD(pf);
console.log('FREE7 subD-on-returned-object freed=' + (pre2 !== words(pf)));
Box(1,1,1);
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + String(e).slice(0, 200)));
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.includes('FREE7') && !seen.has(t)) { seen.add(t); console.log(t); } });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
