import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('test/b123d-validation/manifest-all.json', 'utf8'));
const HEAVY = manifest.find((e) => e.id === 'examples/heat_exchanger').code;
const PROBE = `import gc
import ocp_core
a0 = gc.mem_alloc(); f0 = gc.mem_free()
print("MPGC collects=", ocp_core._gc_tick[1], " alloc=", a0, " free=", f0)
from build123d import *
show(Box(1, 1, 1))
`;
async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  const logs = [];
  page.on('console', (m) => { const t = m.text(); if (t.includes('MPGC')) logs.push(t); });
  await page.goto('http://localhost:8441/?mode=python&pyruntime=micropython&pysrc=upstream', { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  for (const code of [HEAVY, PROBE]) {
    await page.evaluate(async (c) => window.CascadeAPI.runCode(c), code);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
  }
  await new Promise((r) => setTimeout(r, 1500));
  const s = await page.evaluate(() => window.CascadeAPI._memoryStats());
  console.log(logs.join('\n'));
  console.log('pyWasm ' + (s.pythonWasm / 1048576).toFixed(1) + ' occt ' + (s.occtWasm / 1048576).toFixed(1));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
