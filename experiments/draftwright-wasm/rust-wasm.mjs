// draftwright-rust's wasm package on a STEP exported by the lite headless
// engine (the MCP session's engine), in Node.
//   DW_WASM_PKG=<pkg dir> node experiments/draftwright-wasm/rust-wasm.mjs [part.py]
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MB = 1048576;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = join(ROOT, 'packages', 'cascade-core', 'dist');
// the unpacked pkg/ of a draftwright-rust release (draftwright-wasm-<v>.tgz)
const PKG = (process.env.DW_WASM_PKG || join(HERE, 'pkg')) + '/';
const OUT = process.env.OUT || join(HERE, 'out') + '/';
fs.mkdirSync(OUT, { recursive: true });

const partSrc = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : `
from build123d import *
part = (Box(100, 70, 24) - Pos(0, 0, 0) * Cylinder(9, 40) - Pos(0, 0, 8) * Cylinder(15, 20)
        - Pos(-38, 24, 0) * Cylinder(4, 40) - Pos(38, 24, 0) * Cylinder(4, 40)
        - Pos(-38, -24, 0) * Cylinder(4, 40) - Pos(38, -24, 0) * Cylinder(4, 40))
show(part)
`;
const fonts = {};
for (const f of fs.readdirSync(join(DIST, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(DIST, 'fonts', f)); }
}
const { createHeadlessCascade } = await import(pathToFileURL(join(DIST, 'cascade-headless.mjs')).href);
const engine = await createHeadlessCascade({
  occtWasm: fs.readFileSync(join(DIST, 'cascadestudio.wasm')),
  micropythonJs: await import(pathToFileURL(join(DIST, 'micropython-cs.mjs')).href),
  micropythonWasm: fs.readFileSync(join(DIST, 'micropython-cs.wasm')),
  fonts,
});
let t = Date.now();
const r = await engine.run(partSrc, { language: 'python', mesh: false });
if (!r.ok) { console.log('model failed', r.errors); process.exit(1); }
const step = engine.exportSTEP();
console.log(`[lite] model + STEP ${Date.now() - t} ms, ${step.length} bytes`);
fs.writeFileSync(OUT + 'part.step', step);

t = Date.now();
const dw = await import(pathToFileURL(PKG + 'draftwright_wasm.js').href);
const mod = new WebAssembly.Module(fs.readFileSync(PKG + 'draftwright_wasm_bg.wasm'));
const wasm = dw.initSync({ module: mod });
console.log(`[draftwright-wasm] compile+init ${Date.now() - t} ms, memory ${(wasm.memory.buffer.byteLength / MB).toFixed(1)} MB`);

t = Date.now();
const e = new dw.Engine('part.step', new TextEncoder().encode(step));
const snap = JSON.parse(e.snapshot());
console.log(`[draftwright-wasm] analyse+plan ${Date.now() - t} ms: faces ${e.faceCount()}, features ${e.featureCount()}, `
  + `problems ${snap.problems.length}, memory ${(wasm.memory.buffer.byteLength / MB).toFixed(1)} MB`);
for (const p of snap.problems.slice(0, 8)) { console.log('   problem', JSON.stringify(p).slice(0, 200)); }
t = Date.now();
const svg = e.renderSvg();
const pdf = e.renderPdf();
console.log(`[draftwright-wasm] render ${Date.now() - t} ms: svg ${svg.length} B, pdf ${pdf.length} B, memory ${(wasm.memory.buffer.byteLength / MB).toFixed(1)} MB`);
fs.writeFileSync(OUT + 'part.svg', svg);
fs.writeFileSync(OUT + 'part.pdf', pdf);
t = Date.now();
const d = JSON.parse(e.apply(JSON.stringify([{ op: 'set', path: 'sheet/title/material', value: 'AlMg3' }]), true));
console.log(`[draftwright-wasm] edit ${Date.now() - t} ms, delta keys ${Object.keys(d).join(',')}`);
const plan = JSON.parse(e.plan());
console.log('[plan] items', Array.isArray(plan.items) ? plan.items.length : Object.keys(plan).join(','));
e.free();
console.log(`[node] heap ${(process.memoryUsage().heapUsed / MB).toFixed(1)} MB`);
