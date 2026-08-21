import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const PROBE = `import gc
try:
    t = gc.threshold()
except Exception as e:
    t = 'err:' + str(e)
a0 = gc.mem_alloc(); f0 = gc.mem_free()
gc.collect()
a1 = gc.mem_alloc(); f1 = gc.mem_free()
print("GCPROBE thresh=", t, " alloc0=", a0, " free0=", f0, " alloc1=", a1, " free1=", f1)
from build123d import *
show(Box(1,1,1))
`;
async function run(page, code) {
  await page.evaluate(async (c) => window.CascadeAPI.runCode(c), code);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
}
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('http://localhost:8441/?mode=python&pyruntime=micropython&pysrc=upstream', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  await run(page, PROBE);   // gc state after starter
  await new Promise((r) => setTimeout(r, 1500));
  const s1 = await page.evaluate(() => window.CascadeAPI._memoryStats());
  await run(page, HEAVY);
  const s2 = await page.evaluate(() => window.CascadeAPI._memoryStats());
  await run(page, PROBE);   // gc state after heavy
  await new Promise((r) => setTimeout(r, 1500));
  const s3 = await page.evaluate(() => window.CascadeAPI._memoryStats());
  console.log('pyWasm after starter/heavy/probe: ' + [s1, s2, s3].map(s => (s.pythonWasm/1048576).toFixed(1)).join(' / '));
  console.log(logs.filter(l => l.includes('GCPROBE')).join('\n'));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
