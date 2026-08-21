// probe-meshiso.mjs — isolate the per-remesh leak: kernel-only vs full extraction
import { chromium } from 'playwright';
const PORT = process.env.CS_TEST_PORT || '8452';
const VARIANT = process.argv[2] || 'kernel'; // kernel | full
const CODE = `
let t = Text3D("CascadeStudio0", 40, 8);
let mb = () => (self.ocMemory.buffer.byteLength / 1048576).toFixed(1);
console.log('MESHISO start ' + mb());
for (let i = 0; i < 24; i++) {
  ${VARIANT === 'kernel' ? `
  let mesher = new self.oc.BRepMesh_IncrementalMesh_2(t, 0.1, false, 0.5, false);
  mesher.delete();
  (self.oc.BRepTools.Clean_1 || self.oc.BRepTools.Clean).call(self.oc.BRepTools, t, false);
  ` : `
  self.ShapeToMesh(t, 0.1, {}, {});
  `}
  console.log('MESHISO iter' + i + ' ' + mb());
}
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  page.on('console', (m) => { const t = m.text(); if (t.includes('MESHISO')) console.log(t); });
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await page.evaluate((c) => window.CascadeAPI.runCode(c), CODE);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  await new Promise((r) => setTimeout(r, 1500));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
