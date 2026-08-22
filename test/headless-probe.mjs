// headless-probe.mjs — ad-hoc single-model probe over the headless bundle.
//
//   node test/headless-probe.mjs <manifest-id> [--step] [--profile]
//
// Prints eval result, errors, and memoryStats around each export phase.
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORE_DIST = join(ROOT, 'packages', 'cascade-core', 'dist');
const MB = 1048576;
const mb = (n) => (n / MB).toFixed(1);

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const doStep = args.includes('--step');

const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'test/b123d-validation/manifest.json'), 'utf8'));

const occtWasm = fs.readFileSync(join(CORE_DIST, 'cascadestudio.wasm'));
const micropythonWasm = fs.readFileSync(join(CORE_DIST, 'micropython-cs.wasm'));
const micropythonJs = await import(pathToFileURL(join(CORE_DIST, 'micropython-cs.mjs')).href);
const fonts = {};
for (const f of fs.readdirSync(join(CORE_DIST, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(CORE_DIST, 'fonts', f)); }
}
const { createHeadlessCascade } = await import(pathToFileURL(join(CORE_DIST, 'cascade-headless.mjs')).href);
const engine = await createHeadlessCascade({
  runtime: 'micropython', pySrc: 'lite', occtWasm, micropythonJs, micropythonWasm, fonts,
});

for (const id of ids) {
  const entry = manifest.find((x) => x.id === id);
  if (!entry) { console.log(id, 'NOT IN MANIFEST'); continue; }
  console.log('\n=== ' + id + ' ===');
  const t0 = Date.now();
  const r = await engine.run(entry.code);
  const evalMs = Date.now() - t0;
  const m0 = engine.memoryStats();
  console.log('  eval ' + evalMs + ' ms  ok=' + r.ok + '  shapes=' + r.shapeCount
    + '  occt ' + mb(m0.occtWasm) + ' MB  py ' + mb(m0.pythonWasm) + ' MB');
  for (const e of r.errors) { console.log('  ERROR: ' + String(e).split('\n').slice(0, 6).join('\n         ')); }
  if (!doStep || !r.ok) { continue; }
  globalThis.self._csStepPhaseLog = [];
  const t1 = Date.now();
  let step = null;
  try { step = engine.exportSTEP(); }
  catch (e) { console.log('  EXPORT FAILED: ' + e.message); }
  const m1 = engine.memoryStats();
  console.log('  step ' + (Date.now() - t1) + ' ms  bytes=' + (step ? step.length : 0)
    + '  occt ' + mb(m1.occtWasm) + ' MB  (delta ' + mb(m1.occtWasm - m0.occtWasm) + ' MB)');
  for (const [label, bytes] of (globalThis.self._csStepPhaseLog || [])) {
    console.log('      ' + label.padEnd(28) + mb(bytes) + ' MB');
  }
  engine.reset();
}
process.exit(0);
