// cascade-headless on Cloudflare Workers — the routes, shared by both
// source-flavor entry modules (src/index.js = build123d-lite,
// src/index-upstream.js = verbatim upstream build123d 0.11.1).
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
// MicroPython 1.28 (wasm) and build123d. No browser, no DOM, no mesher
// unless STL is asked for.
//
// Every asset arrives as a MODULE of the Worker script (wasm as compiled
// module bindings, fonts as Data, the upstream Python as Text) — see
// SIZE-INVESTIGATION.md for why that is now the right packaging: Cloudflare
// dropped the compressed-size limit (64 MiB uncompressed on Free AND Paid,
// 2026-09-04) and the whole thing is ~35 MiB. Having the bytes in the
// script is also what lets the engine boot at GLOBAL SCOPE (`BOOT`): the old
// `env.ASSETS` binding only existed inside a fetch handler.

import { createHeadlessCascade } from '../assets/cascade-headless.mjs';

/** The startup modes, chosen by the `BOOT` var (wrangler.toml):
 *
 *   request  (default) boot on the first request that needs the engine, as
 *            this example always has. Nothing runs at global scope.
 *   startup  boot OCCT at global scope (instantiate, embind registration,
 *            OCCT init, kernel-image snapshot) — ~70-110 ms of CPU locally.
 *            Python still boots on the first /render.
 *   warm     `startup` PLUS a Box -> STEP warm-up run at global scope: the
 *            interpreter + library boot, the second kernel-image snapshot and
 *            V8's first-call compilation of the whole evaluate/export path.
 *            Afterwards a trivial request costs single-digit milliseconds of
 *            CPU. ~300 ms locally for lite; ~1.3 s for upstream, which is
 *            OVER Cloudflare's 1 s startup limit — the upstream entry
 *            refuses it (see index-upstream.js).
 *
 *  Global scope is billed to Cloudflare's startup budget (1 s of CPU,
 *  enforced at deploy — error 10021), not to the request, which is what
 *  makes `warm` the only configuration with any chance on the Free plan's
 *  10 ms of CPU per request. Everything it runs settles through microtasks
 *  only (the assets are modules, no I/O), which is the precondition for
 *  top-level await in workerd ("Top-level await in module is unsettled"
 *  otherwise). */
export const BOOT_MODES = ['request', 'startup', 'warm'];

const WARMUP_CODE = 'from build123d import *\nshow(Box(10, 10, 10))\n';

/** @param {object} o
 *  @param {'lite'|'upstream'|'real'} o.pySrc
 *  @param {WebAssembly.Module} o.occtWasm
 *  @param {object} o.micropythonJs   the imported micropython-cs.mjs namespace
 *  @param {WebAssembly.Module} o.micropythonWasm
 *  @param {Record<string, ArrayBuffer>} o.fonts
 *  @param {ArrayBuffer|string} [o.upstreamTree]  upstream/real flavors: the
 *         JSON relative-path -> source map (vendored build123d + the OCP shim
 *         and glue) — a Data module's ArrayBuffer (or text). Parsed once at
 *         engine boot; the ArrayBuffer is then DETACHED (transfer) so its
 *         backing store can be collected, and the parsed map is dropped once
 *         the library has registered. Nothing of it stays in the isolate.
 *  @param {object} [o.pyodide]  real flavor: the host that boots Pyodide from
 *         module bindings ({boot, installWheels}; src/real.js)
 *  @param {boolean} [o.stableCache]  keep the op cache across runs with
 *         content-derived keys (the Durable Object editing session,
 *         src/session.js). Such an engine must not be reset per request. */
export function createWorker(o) {
  /** One engine per isolate, reused across requests (all of the engine's
   *  state lives on the worker global). */
  let enginePromise = null;
  const boot = { mode: 'request', bootedAtStartup: false, startupMs: null,
    warmupMs: null, error: null };

  /** The upstream/real Python map, parsed once. A Data module arrives as an
   *  ArrayBuffer: after decoding, `transfer()` detaches it (the module's
   *  export becomes a 0-byte buffer) so V8 can free the 3.4 MB backing store.
   *  Cached until the library has registered, so a boot that fails before
   *  that can be retried. */
  let treeCache = null;
  let treeReleased = false;
  function parsedUpstreamTree() {
    if (treeCache) { return treeCache; }
    if (treeReleased) { throw new Error('upstream-b123d: the module map was released after boot'); }
    const src = o.upstreamTree;
    if (src == null) { throw new Error('pySrc ' + o.pySrc + ' needs the upstream-b123d.json module'); }
    let text;
    if (typeof src === 'string') {
      text = src;
    } else {
      if (src.byteLength === 0) { throw new Error('upstream-b123d: the module map was already released'); }
      text = new TextDecoder().decode(src);
      try { if (typeof src.transfer === 'function') { src.transfer(0); } }
      catch (e) { /* not detachable here: it simply stays resident */ }
    }
    treeCache = JSON.parse(text);
    return treeCache;
  }

  function engine() {
    if (!enginePromise) {
      enginePromise = (async () => {
        let upstreamPy;
        let releaseTree = null;
        if (o.pySrc === 'upstream' || o.pySrc === 'real') {
          // The loader asks for ~120 modules by relative path; the whole
          // layer is one module, parsed once. The library reads it only while
          // it registers (first Python request), so the parsed map is
          // dropped afterwards — and the module's own bytes are released
          // right after the parse (see parsedUpstreamTree). Measured in
          // workerd: a Text module kept ~4.4 MB of V8 heap alive for the
          // isolate's life, which pushed real's maker_coin past 128 MB.
          let tree = parsedUpstreamTree();
          releaseTree = () => { tree = null; treeCache = null; treeReleased = true; };
          upstreamPy = async (rel) => {
            if (!tree) { throw new Error('upstream-b123d: the module map was released after boot: ' + rel); }
            const text = tree[String(rel).replace(/^\.?\//, '')];
            if (text === undefined) {
              throw new Error('upstream-b123d: no such module in the bundled map: ' + rel);
            }
            return text;
          };
        }
        const e = await createHeadlessCascade({
          // 'real' runs the REAL build123d wheel on Pyodide (src/real.js
          // supplies the host); lite and upstream run on MicroPython.
          runtime: o.pySrc === 'real' ? 'pyodide' : 'micropython',
          pyodide: o.pySrc === 'real' ? o.pyodide : undefined,
          // 'lite'     — build123d-lite, embedded in the bundle: ~5x faster
          //              to boot, 223/239 on the 0.13.0 validation corpus.
          // 'upstream' — build123d 0.13.0's own Python over the OCP shim:
          //              233/239, ~1 s more boot. See README.
          // 'real'     — the build123d 0.13.0 wheel + numpy on Pyodide, same
          //              shim (FIDELITY-ON-WORKERS.md): 232/239.
          pySrc: o.pySrc,
          occtWasm: o.occtWasm,
          micropythonJs: o.micropythonJs,
          micropythonWasm: o.micropythonWasm,
          // Bytes, not thunks: cascade-core parses each face on first use.
          fonts: o.fonts,
          upstreamPy,
          stableCache: !!o.stableCache,
        });
        if (releaseTree) {
          // Chain onto the hook the kernel-image recapture also rides
          // (fired once the Python library has registered).
          const booted = globalThis.self._csPyLibBooted;
          globalThis.self._csPyLibBooted = () => {
            if (booted) { booted(); }
            releaseTree();
          };
        }
        return e;
      })().catch((e) => { enginePromise = null; throw e; });
    }
    return enginePromise;
  }

  /** Run at GLOBAL SCOPE by the entry module (top-level await). A failure
   *  is recorded, not thrown: throwing here would fail the whole script at
   *  startup, while a lazily-retried boot still lets /health explain it. */
  async function bootAtStartup(mode) {
    boot.mode = BOOT_MODES.includes(mode) ? mode : 'request';
    if (boot.mode === 'request') { return; }
    const t0 = Date.now();
    try {
      const e = await engine();
      boot.startupMs = Date.now() - t0;
      if (boot.mode === 'warm') {
        const t1 = Date.now();
        const r = await e.run(WARMUP_CODE, { language: 'python', mesh: false });
        if (r.ok) {
          e.exportBREP();
          // workerd's clock reads 0 (the Unix epoch) at global scope, and
          // OCCT refuses to stamp a STEP header with it: Quantity_Date only
          // accepts years >= 1979, so a startup-time exportSTEP() throws
          // 'Quantity_Date::Quantity_Date invalid parameters'. The warm-up's
          // output is thrown away, so lend it a plausible clock for the one
          // call (Emscripten reads Date.now() on every time query).
          const realNow = Date.now;
          if (realNow() < 315532800000) { Date.now = () => 1767225600000; }   // 2026-01-01
          try { e.exportSTEP(); }
          catch (err) { boot.error = 'warm-up STEP export failed: ' + err.message; }
          finally { Date.now = realNow; }
        }
        e.reset();
        boot.warmupMs = Date.now() - t1;
        if (!r.ok) { boot.error = 'warm-up run failed: ' + r.errors.join(' | '); }
      }
      boot.bootedAtStartup = true;
    } catch (err) {
      boot.error = 'startup boot failed: ' + ((err && err.message) || err);
    }
  }

  const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
    status, headers: { 'content-type': 'application/json; charset=utf-8' },
  });

  const USAGE = `cascade-headless (build123d ${o.pySrc}) — build123d -> STEP/BREP/STL on Cloudflare Workers

  curl -sX POST http://localhost:8787/render -H 'content-type: application/json' \\
    -d '{"code":"from build123d import *\\nshow(Box(10,10,10))","formats":["step"]}'

  curl -sN -X POST 'http://localhost:8787/render?stream=1' \\
    -H 'content-type: application/json' \\
    -d '{"code":"from build123d import *\\nshow(Box(10,10,10))","formats":["step"]}'

POST /render            {code, formats:[step|brep|stl], language?, measure?}
POST /render?stream=1   the same job as text/event-stream phase events
GET  /health            boot + memory
`;

  /** Yield to the event loop so anything already written to a response
   *  stream is actually flushed to the client before the next synchronous
   *  wasm call monopolises the isolate. workerd will not flush across a
   *  purely CPU-bound stretch on its own. */
  const yieldToIo = () => (typeof scheduler !== 'undefined' && scheduler.wait)
    ? scheduler.wait(0)
    : new Promise((resolve) => setTimeout(resolve, 0));

  /** Parse + validate a /render body. Returns {code, formats, ...} or
   *  {error}. `mesh` (a format) is the editor's viewport payload: [faces,
   *  edges] at `maxDeviation` (mm, default 0.1) plus each scene shape's
   *  source line; `gui` is the editor's widget state, which REPLACES the
   *  engine's for this run. */
  function parseRenderBody(body) {
    const code = body && body.code;
    if (typeof code !== 'string' || !code.trim()) { return { error: 'missing "code"' }; }
    const formats = Array.isArray(body.formats) && body.formats.length
      ? body.formats.map((f) => String(f).toLowerCase())
      : ['step'];
    const dev = Number(body.maxDeviation);
    return { code, formats, language: (body && body.language) || 'python',
      measure: body && body.measure === true,
      maxDeviation: Number.isFinite(dev) ? Math.min(10, Math.max(0.005, dev)) : 0.1,
      gui: body.gui && typeof body.gui === 'object' && !Array.isArray(body.gui) ? body.gui : null };
  }

  /** The whole job, with a hook fired at every real await boundary.
   *
   *  `onPhase(name, detail)` may return a promise; the caller awaits it,
   *  which is what makes the SSE writes flush. The phases ARE the await
   *  boundaries — there is nothing finer to report honestly, because the
   *  evaluation itself is one synchronous call into wasm.
   *
   *  Returns the same object the JSON endpoint has always returned, plus the
   *  additive `progressOps` timeline. */
  async function runRender(e, req, onPhase, { reset = true, keepScene = false } = {}) {
    const t0 = Date.now();
    await onPhase('evaluating', { language: req.language, formats: req.formats });

    // keepScene: the caller meshes the scene itself, incrementally
    // (engine.meshScene — the editing session's streamed mesh)
    const wantsMesh = req.formats.includes('mesh') && !keepScene;
    const result = await e.run(req.code, { language: req.language, mesh: wantsMesh,
      maxDeviation: req.maxDeviation, guiState: req.gui || undefined, keepScene });

    const out = {
      ok: result.ok,
      errors: result.errors,
      logs: result.logs,
      shapeCount: result.shapeCount,
      historySteps: result.historySteps,
      guiWidgets: result.guiWidgets,
      // ADDITIVE: the worker's per-op Progress timeline ({n, op}). It is a
      // record of the evaluation, not live progress — see the README.
      progressOps: result.progressOps || [],
    };

    await onPhase('evaluated', { shapeCount: out.shapeCount, ok: out.ok,
      errors: out.ok ? undefined : out.errors });

    // The viewport payload is produced by the run itself (meshing consumes
    // the scene list), so it is there even when the script raised half-way:
    // the editor shows whatever was built, as it does locally.
    if (wantsMesh && result.mesh) {
      out.mesh = { faces: result.mesh[0], edges: result.mesh[1],
        shapeLines: result.shapeLines || [] };
    }

    if (result.ok && result.shapeCount > 0) {
      // `{"measure": true}` — the combined scene's volume/area/bbox. Cheap
      // (no meshing) and it is what lets a client CHECK a result without
      // parsing the STEP; scripts/edge-bench.mjs uses it to tell the two
      // source flavors apart on the fidelity ladder.
      if (req.measure) {
        try { out.measurement = e.measure(); }
        catch (err) { out.measurement = { error: err.message }; }
      }
      // BREP and STEP are exact; do them before STL, which attaches a
      // triangulation to the shape. Each is attempted independently: a
      // format the kernel cannot produce must not suppress one it can
      // (exportSTEP can recover from a corrupted kernel heap, exportBREP
      // cannot).
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
    out.cache = result.cache;
    // Rewind the kernel so the next request in this isolate starts from a
    // pristine OCCT heap — cascade-core's reset() restores the boot image,
    // which is also what stops one corrupting model (maker_coin's fillet)
    // from poisoning every later export in the isolate. The editing session
    // (src/session.js) keeps its working set instead and compacts it itself.
    if (reset) { e.reset(); }
    return out;
  }

  async function fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const t0 = Date.now();
      const cold = enginePromise === null;
      let e;
      try { e = await engine(); }
      catch (err) { return json({ ok: false, error: 'engine boot failed: ' + err.message }, 500); }
      return json({ ok: true,
        pySrc: o.pySrc,
        bootMs: Math.round(e.bootMs),
        // BOOT mode and what the global scope did. (Date.now() freezes
        // during CPU work on the edge, so startupMs/warmupMs read ~0 there;
        // `wrangler deploy` reports the real "Worker Startup Time".)
        boot: Object.assign({}, boot),
        cold,
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

    // -------------------------------------------------------------- //
    // Plain JSON (unchanged shape, plus the additive progressOps field). //
    // -------------------------------------------------------------- //
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

    // -------------------------------------------------------------- //
    // Server-sent events, one per real await boundary.                 //
    // -------------------------------------------------------------- //
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
  }

  return { fetch, bootAtStartup,
    // for the editing session (src/session.js)
    engine, runRender, parseRenderBody, json,
    isBooted: () => enginePromise !== null };
}
