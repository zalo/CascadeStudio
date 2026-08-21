// probe-stream.mjs — streaming-mesher A/B on a multi-solid scene.
// Fresh page per variant (wasm high-water). Usage:
//   CS_TEST_HEADFUL=1 DISPLAY=:99 CS_TEST_PORT=8452 \
//     node experiments/heavy-memory/probe-stream.mjs [whole|stream] [repeats]
import { chromium } from 'playwright';

const VARIANT = process.argv[2] || 'stream';
const REPEATS = parseInt(process.argv[3] || '1', 10);
const PORT = parseInt(process.env.CS_TEST_PORT || '8452', 10);

// Heavy multi-solid JS scene: three Text3D compounds (one solid per glyph,
// curved BSpline faces — tessellation-heavy) + a filleted hole plate.
const SCENE = `
${VARIANT === 'whole' ? 'self._csMeshWhole = 1;' : 'self._csMeshWhole = 0;'}
self._csMemPerChunkMarks = 0;
let s = "CascadeStudio";
for (let i = 0; i < 10; i++) {
  Translate([0, 70 * i, 0], Text3D(s + i, 40, 8));
}
let plate = Box(150, 40, 8);
plate = FilletEdges(plate, 3, [0,1,2,3]);
Translate([0, -70, 0], plate);
`;

async function main() {
  const browser = await chromium.launch({ headless: !process.env.CS_TEST_HEADFUL,
    args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', () => {});
  await page.goto(`http://localhost:${PORT}/?mode=cascadestudio`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 120000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 300000 });
  for (let r = 0; r < REPEATS; r++) {
    const t0 = Date.now();
    await page.evaluate((c) => window.CascadeAPI.runCode(c), SCENE);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 600000 });
    const dt = Date.now() - t0;
    const stats = await page.evaluate(() => window.CascadeAPI._memoryStats
      ? window.CascadeAPI._memoryStats() : null);
    console.log(`run ${r + 1}: ${dt} ms, occtWasm ${stats ? (stats.occtWasm / 1048576).toFixed(1) : '?'} MB`);
  }
  // dump the phase marks
  await page.evaluate(async () => {
    await window.CascadeAPI.runCode('console.log("MARKS:" + JSON.stringify((self._csMemSamples||[]).filter(r => typeof r[0] === "string"))); Box(1,1,1);');
  });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => (document.querySelector('.console') || document.body).innerText);
  const idx = text.lastIndexOf('MARKS:');
  const end = text.indexOf('\n', idx);
  try {
    const arr = JSON.parse(text.slice(idx + 6, end > 0 ? end : undefined).replace(/\\"/g, '"'));
    for (const [l, o] of arr) console.log(l + ', ' + (o / 1048576).toFixed(1));
  } catch (e) { console.log('marks unavailable'); }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
