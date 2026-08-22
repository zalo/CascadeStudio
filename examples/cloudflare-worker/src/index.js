// cascade-headless on Cloudflare Workers.
//
//   POST /render  {"code": "<build123d python>", "formats": ["step","brep","stl"]}
//   -> {"ok": true, "step": "ISO-10303-21;…", "brep": "…", "stl": "…",
//       "files": {...}, "logs": [...], "errors": [], "memory": {...},
//       "timings": {...}}
//
//   GET  /        a short usage page
//   GET  /health  boot the engine and report memory (warms the isolate)
//
// Everything runs inside the 128 MB isolate: OpenCascade 8.0.1 (wasm),
// MicroPython 1.28 (wasm) and build123d-lite. No browser, no DOM, no mesher
// unless STL is asked for.

import { createHeadlessCascade } from '../assets/cascade-headless.mjs';

// Wasm module BINDINGS — already compiled by the runtime, which is the only
// form workerd accepts (see wrangler.toml).
import occtWasm from '../assets/cascadestudio.wasm';
import micropythonWasm from '../assets/micropython-cs.wasm';
// The MicroPython Emscripten glue. Imported statically because workerd
// forbids dynamic import of a URL — cascade-core's MicroPythonRuntime takes
// the namespace object directly (`_csMicroPythonLocate.mod`).
import * as micropythonJs from '../assets/micropython-cs.mjs';
// build123d's Text() needs a font, and it asks for a SPECIFIC family member
// per FontStyle. Two of the four FreeSans faces fit under the 10 MB
// compressed Worker limit (see scripts/prepare-assets.cjs); asking for one
// of the other two now fails with a message that names it.
import freeSans from '../assets/FreeSans.ttf';
import freeSansBold from '../assets/FreeSansBold.ttf';

/** One engine per isolate, booted on the first request and reused. Booting
 *  costs ~0.3 s of CPU and ~32 MB, so this matters. */
let enginePromise = null;

function engine() {
  if (!enginePromise) {
    enginePromise = createHeadlessCascade({
      runtime: 'micropython',
      // 'lite' — embedded in the bundle, ~5x faster to boot than the
      // upstream source layer, and it does not need 3.5 MB of extra Python
      // assets in a Worker. Switch to 'upstream' only with an `upstreamPy`
      // loader for the vendored tree.
      pySrc: 'lite',
      occtWasm,
      micropythonJs,
      micropythonWasm,
      fonts: { FreeSans: freeSans, FreeSansBold: freeSansBold },
    }).catch((e) => { enginePromise = null; throw e; });
  }
  return enginePromise;
}

const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' },
});

const USAGE = `cascade-headless — build123d -> STEP/BREP/STL on Cloudflare Workers

  curl -sX POST http://localhost:8787/render -H 'content-type: application/json' \\
    -d '{"code":"from build123d import *\\nshow(Box(10,10,10))","formats":["step"]}'

  curl -sN -X POST 'http://localhost:8787/render?stream=1' \\
    -H 'content-type: application/json' \\
    -d '{"code":"from build123d import *\\nshow(Box(10,10,10))","formats":["step"]}'

POST /render            {code, formats:[step|brep|stl], language?}
POST /render?stream=1   the same job as text/event-stream phase events
GET  /health            boot + memory
`;

/** Yield to the event loop so anything already written to a response stream
 *  is actually flushed to the client before the next synchronous wasm call
 *  monopolises the isolate. workerd will not flush across a purely
 *  CPU-bound stretch on its own. */
const yieldToIo = () => (typeof scheduler !== 'undefined' && scheduler.wait)
  ? scheduler.wait(0)
  : new Promise((resolve) => setTimeout(resolve, 0));

/** Parse + validate a /render body. Returns {code, formats} or {error}. */
function parseRenderBody(body) {
  const code = body && body.code;
  if (typeof code !== 'string' || !code.trim()) { return { error: 'missing "code"' }; }
  const formats = Array.isArray(body.formats) && body.formats.length
    ? body.formats.map((f) => String(f).toLowerCase())
    : ['step'];
  return { code, formats, language: (body && body.language) || 'python' };
}

/** The whole job, with a hook fired at every real await boundary.
 *
 *  `onPhase(name, detail)` may return a promise; the caller awaits it, which
 *  is what makes the SSE writes flush. The phases ARE the await boundaries —
 *  there is nothing finer to report honestly, because the evaluation itself
 *  is one synchronous call into wasm.
 *
 *  Returns the same object the JSON endpoint has always returned, plus the
 *  additive `progressOps` timeline. */
async function runRender(e, req, onPhase) {
  const t0 = Date.now();
  await onPhase('evaluating', { language: req.language, formats: req.formats });

  const result = await e.run(req.code, { language: req.language, mesh: false });

  const out = {
    ok: result.ok,
    errors: result.errors,
    logs: result.logs,
    shapeCount: result.shapeCount,
    historySteps: result.historySteps,
    // ADDITIVE: the worker's per-op Progress timeline ({n, op}). It is a
    // record of the evaluation, not live progress — see the README.
    progressOps: result.progressOps || [],
  };

  await onPhase('evaluated', { shapeCount: out.shapeCount, ok: out.ok,
    errors: out.ok ? undefined : out.errors });

  if (result.ok && result.shapeCount > 0) {
    // BREP and STEP are exact; do them before STL, which attaches a
    // triangulation to the shape. Each is attempted independently: a format
    // the kernel cannot produce must not suppress one it can (exportSTEP can
    // recover from a corrupted kernel heap, exportBREP cannot).
    const exporters = [
      ['brep', () => e.exportBREP()],
      ['step', () => e.exportSTEP()],
      ['stl', () => e.exportSTL()],
    ];
    for (const [name, run] of exporters) {
      if (!req.formats.includes(name)) { continue; }
      await onPhase('exporting', { format: name });
      try { out[name] = run(); }
      catch (err) {
        out.ok = false;
        out.errors = out.errors.concat([name + ' export failed: ' + err.message]);
      }
    }
    // Anything the SCRIPT itself wrote with export_step()/export_brep()/
    // Mesher().write() lives in the engine's in-memory FS.
    const files = {};
    for (const name of e.listFiles()) {
      if (/\.(step|stp|brep|stl|3mf)$/i.test(name)) {
        files[name] = e.readFile(name);
      }
    }
    if (Object.keys(files).length) { out.files = files; }
  }

  out.memory = e.memoryStats();
  out.timings = Object.assign({ totalMs: Date.now() - t0 }, result.timings);
  // Rewind the kernel so the next request in this isolate starts from a
  // pristine OCCT heap — cascade-core's reset() restores the boot image,
  // which is also what stops one corrupting model (maker_coin's fillet)
  // from poisoning every later export in the isolate.
  e.reset();
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const t0 = Date.now();
      const e = await engine();
      return json({ ok: true, bootMs: Math.round(e.bootMs), elapsedMs: Date.now() - t0,
        memory: e.memoryStats() });
    }

    if (url.pathname !== '/render') {
      return new Response(USAGE, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'POST a JSON body to /render' }, 405);
    }

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ ok: false, error: 'invalid JSON body' }, 400); }
    const req = parseRenderBody(body);
    if (req.error) { return json({ ok: false, error: req.error }, 400); }

    const wantsStream = url.searchParams.get('stream') === '1'
      || /text\/event-stream/.test(request.headers.get('accept') || '');
    const cold = enginePromise === null;

    // ---------------------------------------------------------------- //
    // Plain JSON (unchanged shape, plus the additive progressOps field). //
    // ---------------------------------------------------------------- //
    if (!wantsStream) {
      const t0 = Date.now();
      let e;
      try { e = await engine(); }
      catch (err) { return json({ ok: false, error: 'engine boot failed: ' + err.message }, 500); }
      const bootedMs = Date.now() - t0;
      const out = await runRender(e, req, () => {});
      out.timings.bootedMs = bootedMs;
      return json(out, out.ok ? 200 : 422);
    }

    // ---------------------------------------------------------------- //
    // Server-sent events, one per real await boundary.                  //
    // ---------------------------------------------------------------- //
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const send = async (event, data) => {
      await writer.write(enc.encode('event: ' + event + '\n'
        + 'data: ' + JSON.stringify(data) + '\n\n'));
      // Enqueueing is not flushing: without a turn of the event loop the
      // next phase's synchronous wasm call would hold the isolate and the
      // client would get every event at once, at the end.
      await yieldToIo();
    };

    const pump = (async () => {
      try {
        const t0 = Date.now();
        if (cold) { await send('phase', { phase: 'booting' }); }
        let e;
        try { e = await engine(); }
        catch (err) {
          await send('error', { ok: false, error: 'engine boot failed: ' + err.message });
          return;
        }
        const bootedMs = Date.now() - t0;
        const out = await runRender(e, req,
          (phase, detail) => send('phase', Object.assign({ phase }, detail)));
        out.timings.bootedMs = bootedMs;
        // The terminal event carries exactly the JSON endpoint's payload.
        await send(out.ok ? 'done' : 'error', out);
      } catch (err) {
        try { await send('error', { ok: false, errors: ['worker: ' + err.message] }); }
        catch (e2) { /* the client is gone */ }
      } finally {
        try { await writer.close(); } catch (e) { /* already closed */ }
      }
    })();
    if (ctx && ctx.waitUntil) { ctx.waitUntil(pump); }

    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        // Nothing downstream should buffer a phase stream.
        'x-accel-buffering': 'no',
      },
    });
  },
};
