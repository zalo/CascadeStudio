// cascade-drafting — engineering drawings from STEP, on Cloudflare Workers.
//
// A Worker of its own around draftwright-rust's wasm package (Paul Fremantle,
// AGPL-3.0-only; fetched into ../vendor/ by scripts/fetch-draftwright.mjs).
// The session Worker reaches it over a service binding and calls draw() as
// Workers RPC (MCP's make_drawing tool). Because it links draftwright, THIS
// Worker is AGPL-3.0-only too (../LICENSE); CascadeStudio's own code stays
// a separate program on the other side of the binding. See ../README.md.
//
// draftwright reads the STEP with its own B-rep kernel (no OpenCascade) and
// plans the whole sheet in one call. Its wasm memory grows with the part
// (~1.1 MB per face on hole-heavy parts, measured) and never shrinks, so
// parts over MAX_FACES are refused before they are opened.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { initSync, Engine } from '../vendor/draftwright_wasm.js';
import wasmModule from '../vendor/draftwright_wasm_bg.wasm';
import VENDOR from '../vendor/VERSION.json';

const MB = 1048576;
const FORMATS = ['pdf', 'svg'];
let wasm = null;

/** Where the running code comes from (AGPL section 13: offered with every
 *  result, so whoever gets a drawing can get the source). */
function sourceInfo(env) {
  return {
    engine: 'draftwright-rust ' + VENDOR.version,
    license: 'AGPL-3.0-only',
    engineSource: VENDOR.source,
    serviceSource: env.SERVICE_SOURCE_URL || '',
  };
}

/** STEP text has one ADVANCED_FACE entity per B-rep face (OCCT's writer and
 *  most others); a gzip upload is counted after the engine opens it. */
function countFaces(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) { return null; }
  const m = new TextDecoder().decode(bytes).match(/=\s*ADVANCED_FACE\s*\(/g);
  return m ? m.length : 0;
}

function engineError(thrown) {
  try {
    const e = JSON.parse(String(thrown));
    return { code: e.code || 'failed', message: e.message || String(thrown), choices: e.choices };
  } catch (err) {
    return { code: 'failed', message: String((thrown && thrown.message) || thrown) };
  }
}

/** One drawing. `step`: STEP bytes or text. opts: {name, ops, formats}.
 *  Resolves {ok: true, ...summary, pdf?, svg?} or {ok: false, code, message};
 *  it only throws if the isolate itself fails. */
export async function draw(env, step, opts = {}) {
  const src = sourceInfo(env);
  const bytes = typeof step === 'string' ? new TextEncoder().encode(step) : new Uint8Array(step);
  const maxFaces = Number(env.MAX_FACES || 120);
  const faces = countFaces(bytes);
  if (faces !== null && faces > maxFaces) {
    return Object.assign({ ok: false, code: 'too_large', faces, maxFaces,
      message: 'the part has ' + faces + ' faces; this service draws parts up to ' + maxFaces
        + ' (its memory grows with the part). Draw a simpler variant, or one body of an assembly.' }, src);
  }
  const formats = (opts.formats && opts.formats.length ? opts.formats : FORMATS).filter((f) => FORMATS.includes(f));
  const t0 = Date.now();
  if (!wasm) { wasm = initSync({ module: wasmModule }); }
  let e;
  try {
    e = new Engine(String(opts.name || 'part.step'), bytes);
  } catch (thrown) {
    return Object.assign({ ok: false }, engineError(thrown), src);
  }
  try {
    if (opts.ops && opts.ops.length) {
      try {
        e.apply(JSON.stringify(opts.ops), true);
      } catch (thrown) {
        return Object.assign({ ok: false, stage: 'ops' }, engineError(thrown), src);
      }
    }
    const snap = JSON.parse(e.snapshot());
    const plan = snap.plan || {};
    const sheet = plan.sheet || {};
    const planMs = Date.now() - t0;
    const t1 = Date.now();
    const out = Object.assign({
      ok: true,
      faces: e.faceCount(),
      features: e.featureCount(),
      sheet: { size: sheet.size || null, scale: sheet.scale || null },
      views: (plan.views || []).map((v) => String(v.id || '').replace(/^v:/, '')),
      status: plan.status || null,
      completeness: plan.completeness || null,
      dimensions: Array.isArray(plan.dimensions) ? plan.dimensions.length : null,
      problems: (snap.problems || []).map((p) => ({ severity: p.severity, code: p.code, message: p.message,
        id: p.id, fix: p.fix })),
      spec: snap.spec,
    }, src);
    if (formats.includes('pdf')) { out.pdf = e.renderPdf(); }
    if (formats.includes('svg')) { out.svg = e.renderSvg(); }
    out.ms = { plan: planMs, render: Date.now() - t1 };
    out.memoryMB = Math.round(wasm.memory.buffer.byteLength / MB);
    return out;
  } finally {
    e.free();
  }
}

/** The service binding's RPC surface (wrangler: entrypoint = "Drafting"). */
export class Drafting extends WorkerEntrypoint {
  async draw(step, opts) {
    return draw(this.env, step, opts);
  }

  async info() {
    return Object.assign({ maxFaces: Number(this.env.MAX_FACES || 120), formats: FORMATS }, sourceInfo(this.env));
  }
}

/** HTTP, for `wrangler dev` and curl (the deployed Worker has no public
 *  route: workers_dev = false). GET / describes the service; POST /draw
 *  takes a STEP body, ?name=, ?format=json|pdf|svg, ?ops=<JSON array>. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      return Response.json(Object.assign({ ok: true, post: '/draw', maxFaces: Number(env.MAX_FACES || 120) },
        sourceInfo(env)));
    }
    if (request.method !== 'POST' || url.pathname !== '/draw') {
      return Response.json({ ok: false, error: 'POST /draw with a STEP body' }, { status: 404 });
    }
    let ops;
    try {
      ops = url.searchParams.get('ops') ? JSON.parse(url.searchParams.get('ops')) : undefined;
    } catch (err) {
      return Response.json({ ok: false, error: 'ops is not JSON' }, { status: 400 });
    }
    const format = url.searchParams.get('format') || 'json';
    const r = await draw(env, await request.arrayBuffer(), { name: url.searchParams.get('name') || 'part.step',
      ops, formats: format === 'json' ? ['pdf'] : [format] });
    if (!r.ok) { return Response.json(r, { status: 422 }); }
    if (format === 'pdf' || format === 'svg') {
      return new Response(r[format], { headers: { 'content-type': format === 'pdf' ? 'application/pdf' : 'image/svg+xml' } });
    }
    const { pdf, svg, spec, ...summary } = r;
    summary.pdfBytes = pdf ? pdf.length : 0;
    return Response.json(summary);
  },
};
