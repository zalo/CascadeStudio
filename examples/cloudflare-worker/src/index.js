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
// build123d's Text() needs a font; FreeSans is the family lite ships.
import freeSans from '../assets/FreeSans.ttf';

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
      fonts: { FreeSans: freeSans },
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

POST /render   {code, formats:[step|brep|stl], language?, mesh?}
GET  /health   boot + memory
`;

export default {
  async fetch(request) {
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
    const code = body && body.code;
    if (typeof code !== 'string' || !code.trim()) {
      return json({ ok: false, error: 'missing "code"' }, 400);
    }
    const formats = Array.isArray(body.formats) && body.formats.length
      ? body.formats.map((f) => String(f).toLowerCase())
      : ['step'];

    const t0 = Date.now();
    let e;
    try { e = await engine(); }
    catch (err) { return json({ ok: false, error: 'engine boot failed: ' + err.message }, 500); }
    const bootedMs = Date.now() - t0;

    const result = await e.run(code, {
      language: body.language || 'python',
      // STL is the only format that needs triangles, and the engine's
      // exportSTL meshes on demand — so never pay for the viewport mesh.
      mesh: false,
    });

    const out = {
      ok: result.ok,
      errors: result.errors,
      logs: result.logs,
      shapeCount: result.shapeCount,
      historySteps: result.historySteps,
    };

    if (result.ok && result.shapeCount > 0) {
      try {
        // BREP and STEP are exact; do them before STL, which attaches a
        // triangulation to the shape.
        if (formats.includes('brep')) { out.brep = e.exportBREP(); }
        if (formats.includes('step')) { out.step = e.exportSTEP(); }
        if (formats.includes('stl')) { out.stl = e.exportSTL(); }
      } catch (err) {
        out.ok = false;
        out.errors = out.errors.concat(['export failed: ' + err.message]);
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
    out.timings = Object.assign({ bootedMs, totalMs: Date.now() - t0 }, result.timings);
    // Free the retained compound so the next request in this isolate starts
    // from the same footprint.
    e.reset();
    return json(out, out.ok ? 200 : 422);
  },
};
