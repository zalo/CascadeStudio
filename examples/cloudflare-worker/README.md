# cascade-headless on Cloudflare Workers

Turn **build123d Python** into **STEP / BREP / STL** inside a Cloudflare
Worker — OpenCascade 8.0.1 (wasm) + MicroPython 1.28 (wasm) + build123d-lite,
all in one 128 MB isolate. No browser, no DOM, no Three.js, no mesher unless
STL is asked for.

```bash
cd examples/cloudflare-worker
npm install                 # wrangler (a devDependency of THIS example only)
npm run dev                 # prepare-assets + wrangler dev  -> :8787
node scripts/smoke.mjs      # drives the same scripts as test/headless-node.mjs
```

```bash
curl -sX POST http://localhost:8787/render \
  -H 'content-type: application/json' \
  -d '{"code":"from build123d import *\nshow(Box(10,10,10))","formats":["step","brep"]}'
```

```jsonc
{
  "ok": true,
  "errors": [],
  "logs": ["volume: 999.9999999999998", "Cache: 0 hits, 2 misses"],
  "shapeCount": 1,
  "step": "ISO-10303-21;\nHEADER;\n…",
  "brep": "DBRep_DrawableShape\n\nCASCADE Topology V3…",
  "files": { "part.step": "…" },   // whatever the script itself exported
  "memory": { "occtWasm": 33554432, "pythonWasm": 20447232, "totalWasm": 54001664 },
  "timings": { "bootedMs": 0, "evalMs": 3, "combineMs": 1, "totalMs": 26 }
}
```

| route | |
|---|---|
| `POST /render` | `{code, formats:["step","brep","stl"], language?, mesh?}` → the JSON above (`422` when the script fails, with the Python traceback in `errors`) |
| `GET /health` | boots the engine and reports memory (warms the isolate) |
| `GET /` | usage text |

## Verified in this environment

Everything below was run locally against **workerd** via `wrangler dev`
(wrangler 4.125.0), not merely reasoned about:

```
=== GET /health ===
  boot 123 ms   occtWasm 32.0 MB
  PASS  health ok

=== (a) Box(10, 10, 10) -> step + brep + stl ===
  PASS  HTTP 200 / ok / STEP is ISO-10303-21 / BREP non-empty / STL has 12 facets
  26 ms   occt 32.0 MB + python 19.5 MB = 51.5 MB   (eval 3 ms)

=== (b) PYTHON_STARTER_CODE (flanged bearing mount) ===
  PASS  volume ~= 48603.5 mm^3 / STEP is substantial (117981 bytes)
  367 ms   occt 32.0 MB + python 19.5 MB = 51.5 MB   (eval 316 ms)

=== (c) export_step() / export_brep() inside the script ===
  PASS  script wrote part.step / part.brep
  PASS  import_brep round-trips the volume  — 1270.353996706151 vs 1270.3539967061508
  49 ms   occt 32.0 MB + python 19.5 MB = 51.5 MB   (eval 19 ms)

=== (d) a failing script comes back as JSON, not a 500 ===
  PASS  HTTP 422 / NameError reported
```

The numbers are identical to the Node leg (`node test/headless-node.mjs`),
which stays the authoritative regression test.

**Not verified**: an actual `wrangler deploy` to Cloudflare's edge (no account
in this environment). Everything up to and including `wrangler deploy
--dry-run` is green, and `wrangler dev` runs the real workerd binary — the
same runtime, the same restrictions — so the remaining risk is account/limits
configuration, not code.

## Memory and timing

| | |
|---|---|
| isolate limit | **128 MB** |
| after boot (OCCT only) | 32.0 MB |
| after any Python run (OCCT + MicroPython) | **51.5 MB** |
| engine boot | ~123 ms |
| MicroPython + build123d-lite boot (first Python request) | ~134 ms |
| `Box(10,10,10)` eval | ~3 ms |
| starter model (fillets, booleans, GridLocations) eval | ~316 ms |

51.5 MB of 128 MB, with the remaining headroom available for the model
itself. The MicroPython GC heap is fixed at 16 MB (`CS_MP_HEAP`), so growth
under load is OCCT-side only.

## Bundle size — the real constraint

| asset | raw | gzip |
|---|---|---|
| `cascadestudio.wasm` (OCCT 8.0.1) | 27.02 MB | **7.94 MB** |
| `FreeSans.ttf` | 1.84 MB | 0.98 MB |
| `cascade-headless.mjs` | 1.08 MB | 0.30 MB |
| `micropython-cs.wasm` | 0.49 MB | 0.21 MB |
| `micropython-cs.mjs` | 0.11 MB | 0.03 MB |
| **`wrangler deploy --dry-run`** | **30.08 MB** | **9.16 MB** |

Cloudflare's compressed Worker size limit is **10 MB on paid plans** and
**3 MB on the free plan**. So this deploys on a paid plan with ~0.8 MB of
headroom, and does NOT fit the free plan. If you need room:

* drop `FreeSans.ttf` from `scripts/prepare-assets.cjs` (−0.98 MB gz) — only
  `Text()`/`Text3D()` need it;
* the OCCT wasm is the floor. A smaller kernel build (dropping IGES/STL
  readers, the mesher, `Geom2dGcc`, …) is the only way under 3 MB, and that
  is a fork-level exercise — see `node_modules/opencascade.js/CLAUDE.md`.

## Platform restrictions this example respects

1. **No runtime code generation.** `eval`, `new Function` and
   `WebAssembly.compile`/`new WebAssembly.Module` all throw
   *"Code generation from strings disallowed for this context"*.
   - Wasm therefore arrives as **already-compiled module bindings**
     (`[[rules]] type = "CompiledWasm"`), which cascade-core's asset seam
     (`packages/cascade-core/src/worker/WasmAssets.js`) takes directly, and
     which MicroPython's loader reaches through the `instantiateWasm` hook
     (a one-line patch on the vendored glue, see its `PROVENANCE.md`).
   - Emscripten's **embind generates every method invoker with
     `new Function`**, which killed the very first boot attempt here. The
     headless bundle is built with a source transform that swaps
     `createJsInvoker` and `__emval_create_invoker` for closure-based
     equivalents — `COMPROMISE(embind-no-eval)` in
     `packages/cascade-core/scripts/build-headless.cjs`. The browser worker
     bundle is untouched.
   - Consequence: **`language: "cascadestudio"` (the JS standard library) is
     NOT available on Workers** — evaluating user JS is `eval` by
     definition. Python mode is unaffected.
2. **No dynamic `import()` of a URL.** `micropython-cs.mjs` is imported
   statically and handed to the runtime as a namespace object
   (`_csMicroPythonLocate.mod`).
3. **`nodejs_compat` is deliberately OFF.** It defines `process`, and
   OpenCascade's Emscripten glue sniffs `globalThis.process?.versions?.node`
   to decide it is running under Node — at which point it reaches for
   `createRequire`/`fs` and dies. The four node specifiers the dead branches
   mention (`module`, `fs`, `path`, `url`) are aliased to
   `src/node-module-stub.js` in `wrangler.toml` so the bundler can resolve
   them.
4. **CPU time.** The free plan gives 10 ms of CPU — not enough to boot the
   kernel, let alone model. A paid plan's default is 30 s wall / 30 s CPU
   (`[limits] cpu_ms`). The starter model is ~450 ms of CPU including the
   one-time interpreter boot; a heavy part with many fillets can be seconds.
5. **One engine per isolate.** `enginePromise` is a module global, so the
   ~123 ms boot and 32 MB are paid once and reused; `/render` calls
   `engine.reset()` afterwards so the next request starts from the same
   footprint.
6. **`pySrc: 'lite'`.** The `upstream` source layer (verbatim upstream
   build123d 0.11.1) also works headless, but needs 3.5 MB of extra Python
   text bundled and boots ~5x slower (642 ms vs 122 ms of library load) for
   identical memory. Lite is embedded in the JS bundle.

## Files

```
wrangler.toml                 module rules, aliases, why nodejs_compat is off
src/index.js                  the Worker: POST /render, GET /health
src/node-module-stub.js       resolves the glues' dead node-only imports
scripts/prepare-assets.cjs    copies cascade-core/dist -> assets/ (gitignored)
scripts/smoke.mjs             curl-equivalent end-to-end checks
```

`assets/` is gitignored: `cascadestudio.wasm` alone is 27 MB. Run
`npm run build` in the repo root first, then `npm run prepare-assets`.
