// draftwright-rust's wasm package as a Worker: POST a STEP file, get the
// drawing back. The wasm arrives as a module binding (workerd can't compile).
import { initSync, Engine } from './draftwright_wasm.js';
import wasmModule from './draftwright_wasm_bg.wasm';

let wasm = null;
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const t0 = Date.now();
    if (!wasm) { wasm = initSync({ module: wasmModule }); }
    const tInit = Date.now() - t0;
    if (request.method !== 'POST') {
      return Response.json({ ok: true, initMs: tInit, memoryMB: wasm.memory.buffer.byteLength / 1048576 });
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    const t1 = Date.now();
    let e;
    try {
      e = new Engine(url.searchParams.get('name') || 'part.step', bytes);
    } catch (err) {
      return Response.json({ ok: false, error: String(err) }, { status: 422 });
    }
    try {
      const snap = JSON.parse(e.snapshot());
      const tPlan = Date.now() - t1;
      const fmt = url.searchParams.get('format') || 'json';
      if (fmt === 'svg') { return new Response(e.renderSvg(), { headers: { 'content-type': 'image/svg+xml' } }); }
      if (fmt === 'pdf') { return new Response(e.renderPdf(), { headers: { 'content-type': 'application/pdf' } }); }
      const t2 = Date.now();
      const pdf = e.renderPdf();
      return Response.json({ ok: true, initMs: tInit, planMs: tPlan, renderMs: Date.now() - t2,
        faces: e.faceCount(), features: e.featureCount(), pdfBytes: pdf.length,
        problems: snap.problems.map((p) => p.code), memoryMB: wasm.memory.buffer.byteLength / 1048576 });
    } finally {
      e.free();
    }
  },
};
