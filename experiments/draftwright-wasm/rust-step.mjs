// One STEP file through draftwright-wasm in a fresh process: time + wasm
// memory (wasm memory only grows, so a fresh process gives the part's peak).
//   DW_WASM_PKG=<pkg dir> node experiments/draftwright-wasm/rust-step.mjs part.step[.gz]
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
// the unpacked pkg/ of a draftwright-rust release (draftwright-wasm-<v>.tgz)
const PKG = (process.env.DW_WASM_PKG || join(HERE, 'pkg')) + '/';
const dw = await import(pathToFileURL(PKG + 'draftwright_wasm.js').href);
const wasm = dw.initSync({ module: new WebAssembly.Module(fs.readFileSync(PKG + 'draftwright_wasm_bg.wasm')) });
const f = process.argv[2];
const bytes = fs.readFileSync(f);   // gzip is recognised by its magic bytes
const t = Date.now();
const e = new dw.Engine(f.split('/').pop(), new Uint8Array(bytes));
const planMs = Date.now() - t;
const mem1 = wasm.memory.buffer.byteLength / 1048576;
const t2 = Date.now(); e.renderPdf(); const renderMs = Date.now() - t2;
console.log(JSON.stringify({ file: f.split('/').pop(), faces: e.faceCount(), features: e.featureCount(), planMs, renderMs,
  wasmMB: +mem1.toFixed(1), afterRenderMB: +(wasm.memory.buffer.byteLength / 1048576).toFixed(1) }));
