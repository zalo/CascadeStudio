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

// The fonts and the upstream build123d Python layer are WORKERS STATIC
// ASSETS (`[assets]` in wrangler.toml, ./public built by
// scripts/prepare-assets.cjs), fetched through `env.ASSETS` at engine-boot
// time. They used to be module bindings; moving them out took the script
// from 9909 KiB gz — 97% of Cloudflare's 10240 KiB limit — to ~8434 KiB, and
// it is what makes the upstream flavor deployable at all. The wasm files
// CANNOT follow: workerd will not compile WebAssembly at runtime.

/** The four family members build123d names per FontStyle. A face that is
 *  not shipped is a hard, named error rather than a null shape. All four fit
 *  now that they are not in the script. */
const FONT_FACES = ['FreeSans', 'FreeSansBold', 'FreeSansOblique',
  'FreeSansBoldOblique'];

/** One engine per isolate, booted on the first request and reused. Booting
 *  costs ~0.3 s of CPU and ~32 MB (plus ~0.65 s of Python library for the
 *  upstream flavor), so this matters. */
let enginePromise = null;
/** What the boot spent on static assets — reported by /health so the cost of
 *  the packaging split is measurable from outside. */
let assetMs = 0;
let assetBytes = 0;

/** `env.ASSETS` is only reachable from a fetch handler, which is why engine
 *  boot is lazy and per-request. Absolute URL required. */
function assetFetcher(env, request) {
  const origin = new URL(request.url).origin;
  return async (p) => {
    const t0 = Date.now();
    const res = await env.ASSETS.fetch(new URL(p, origin));
    if (!res.ok) {
      throw new Error('static asset ' + p + ': HTTP ' + res.status
        + ' — run `npm run prepare-assets` and redeploy');
    }
    const buf = await res.arrayBuffer();
    assetMs += Date.now() - t0;
    assetBytes += buf.byteLength;
    return buf;
  };
}

function engine(env, request) {
  if (!enginePromise) {
    const pySrc = (env && env.PY_SRC) === 'upstream' ? 'upstream' : 'lite';
    const get = assetFetcher(env, request);
    enginePromise = (async () => {
      assetMs = 0;
      assetBytes = 0;
      let upstreamPy;
      if (pySrc === 'upstream') {
        // ONE fetch for the whole layer. The loader asks for ~120 modules by
        // relative path; 120 subrequests would cost far more than a single
        // 3.15 MB / 0.40 MB gz map plus a parse.
        const tree = JSON.parse(new TextDecoder().decode(
          await get('/py/upstream-b123d.json')));
        upstreamPy = async (rel) => {
          const text = tree[String(rel).replace(/^\.?\//, '')];
          if (text === undefined) {
            throw new Error('upstream-b123d: no such module in the asset map: ' + rel);
          }
          return text;
        };
      }
      const fonts = {};
      for (const face of FONT_FACES) {
        // Thunks: cascade-core resolves them lazily, so a face nothing asks
        // for is never fetched.
        fonts[face] = () => get('/fonts/' + face + '.ttf');
      }
      return createHeadlessCascade({
        runtime: 'micropython',
        // 'lite'     — build123d-lite, embedded in the bundle: ~5x faster to
        //              boot, 206/222 on the validation corpus.
        // 'upstream' — build123d 0.11.1's own Python over the OCP shim:
        //              216/222, ~0.65 s more boot. See README.
        pySrc,
        occtWasm,
        micropythonJs,
        micropythonWasm,
        fonts,
        upstreamPy,
      });
    })().catch((e) => { enginePromise = null; throw e; });
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
      const cold = enginePromise === null;
      let e;
      try { e = await engine(env, request); }
      catch (err) { return json({ ok: false, error: 'engine boot failed: ' + err.message }, 500); }
      return json({ ok: true,
        pySrc: (env && env.PY_SRC) || 'lite',
        bootMs: Math.round(e.bootMs),
        // Cold-isolate cost of the static-assets split, measured server-side.
        // (Date.now() freezes during CPU work on the edge, so trust the
        // CLIENT's round trip for the total — this is the I/O part.)
        assetMs, assetBytes, cold,
        elapsedMs: Date.now() - t0,
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
      try { e = await engine(env, request); }
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
        try { e = await engine(env, request); }
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
