# cascade-headless on Cloudflare Workers

Turn **build123d Python** into **STEP / BREP / STL** inside a Cloudflare
Worker — OpenCascade 8.0.1 (wasm) + MicroPython 1.28 (wasm) + build123d,
all in one 128 MB isolate. No browser, no DOM, no Three.js, no mesher unless
STL is asked for.

Two deployments, one codebase — see [Source flavors](#source-flavors):

| | build123d | corpus | live |
|---|---|---|---|
| default | **build123d-lite** (embedded) | 206/222 | `cascade-headless.makeshifted.workers.dev` |
| `--env upstream` | **verbatim upstream 0.11.1** over the OCP shim | 216/222 | `cascade-headless-upstream.makeshifted.workers.dev` |

```bash
cd examples/cloudflare-worker
npm install                 # wrangler (a devDependency of THIS example only)
npm run dev                 # prepare-assets + wrangler dev  -> :8787   (lite)
npm run dev:upstream        # the same, PY_SRC=upstream
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
| `POST /render` | `{code, formats:["step","brep","stl"], language?}` → the JSON above (`422` when the script fails, with the Python traceback in `errors`) |
| `POST /render?stream=1` | the same job as a `text/event-stream` of phase events — see [Progress streaming](#progress-streaming). `Accept: text/event-stream` selects it too |
| `GET /health` | boots the engine and reports memory (warms the isolate) |
| `GET /` | usage text |

## Capability envelope

`scripts/edge-bench.mjs` against **both deployed** Workers (2026-08-23,
`formats: ["step"]`, `measure: true`). Times are **client-side round trips**
including network — a deployed Worker freezes `Date.now()` during CPU work,
so its own `timings` read 0. Memory is what the isolate reports; `vol` is the
combined scene's volume, which is the only thing that distinguishes a wrong
answer from a right one at HTTP 200.

| model | | lite | | upstream | |
|---|---|---:|---:|---:|---:|
| | | time | isolate | time | isolate |
| `examples/boxes_on_faces` | builder nesting | 0.5 s | 51.5 MB | 5.8 s | 51.5 MB |
| `examples/maker_coin` | fillets + text + `new_edges` | 36.7 s | 70.8 MB | 30.0 s | 66.0 MB |
| `ttt/ttt-ppp0101` | TTT challenge part | 2.4 s | 70.8 MB | 4.8 s | 66.0 MB |
| `ttt/ttt-24-SPO-06-Buffer_Stand` | heavier TTT | 4.2 s | 96.4 MB | 6.5 s | 110.9 MB |
| `examples/intersecting_pipes` | booleans + fillets | 5.6 s | 51.5 MB | 9.9 s | 51.5 MB |
| `examples/build123d_logo` | text + sketches | 3.4 s | 51.5 MB | 6.3 s | 51.5 MB |
| `examples/clock` | `FontStyle.BOLD` + 2-D fillets | 29.8 s | 65.0 MB | **503** | > 128 MB |
| `examples/heat_exchanger` | ~1000 ops | 84.8 s | 86.6 MB | **503** | > 128 MB |
| `examples/bicycle_tire` | wrap + thicken, 1081 solids | **503** | 163.3 MB | **503** | > 128 MB |

The first request into a cold isolate adds ~3 s (lite) / ~5.6 s (upstream);
warm, the same trivial model round-trips in 44-57 ms / 61-89 ms. All of a
ladder's models run in ONE isolate, in order: nothing poisons anything
downstream of it any more (it used to — see
[Two ceilings that were real](#two-ceilings-that-were-real)). A model that
kills the isolate does cost the NEXT one a 503, so re-run a 503 on its own
before believing it.

### The fidelity ladder

The three models below are why `--env upstream` exists. `edge-bench.mjs
--fidelity` runs just these.

| model | lite | upstream | native |
|---|---|---|---|
| `docs-selectors/sort_axis` | **200**, vol 8533.385 | **200**, vol **9353.444** | 9353.444 |
| `ttt/ttt-ppp0110` | **422** "Union produced near-zero volume" | **200**, vol **207159.364** | 207159.364 |
| `examples/toy_truck` | **422** FilletEdges "BRep_API: command not done" | **503** `exceededMemory` (168.7 MB in Node, where it PASSES in 9.4 s) | 6160.103 (`body`) |

`sort_axis` is the one to look at: both flavors return HTTP 200 and only the
NUMBER is different. Lite's `revolve(face, -Axis(edge), 90)` sweeps the other
way because the selected sub-edge's TopAbs orientation differs from OCP 7.x
over identical curve geometry (`COMPROMISE(edge-orientation)`), so `part`
comes out 14.7% light; upstream's 9353.444 is `before` 3768.283 + `part`
5585.161 to the digit. This is exactly the class of difference a corpus score
summarises, and the reason the bench asks for `measure: true`.

`toy_truck` is the honest counter-example: upstream builds it and lite cannot,
but the upstream leg needs 168.7 MB to do it, so on the edge it trades a 422
for a 503. `wrangler tail --env upstream` names the reason —
`"outcome":"exceededMemory"`.

## Source flavors

Same script, same wasm, same static assets; `PY_SRC` picks which build123d
boots. One isolate serves one flavor: the engine keeps its state on the
worker global and a Python runtime registers ONE library, so this is a
wrangler environment, not a query parameter.

| | `lite` (default) | `upstream` |
|---|---|---|
| what runs | `Build123dLite.js` — a re-implementation, embedded in the bundle as a Python string | build123d 0.11.1's OWN `geometry.py` + `topology/*.py` + object/builder layers, **verbatim**, over an OCP-over-embind shim |
| validation corpus | 206 PASS / 10 MISMATCH / 5 ERROR / 1 TIMEOUT | **216 PASS** / 2 / 3 / 1 |
| cold first request | **3.0 s** | **5.6 s** |
| warm trivial model | **44-57 ms** | **61-89 ms** |
| static assets fetched at boot | 4.31 MB (fonts) | 7.61 MB (fonts + 3.15 MB Python) |
| `Box`/starter isolate memory | **51.5 MB** | **51.5 MB** — identical, because the shapes live in OCCT's heap either way |
| heavy models | clock 65.0 MB, heat_exchanger 86.6 MB | clock and heat_exchanger exceed 128 MB |
| script size | 8417 KiB gz | 8417 KiB gz (the same script) |

The **memory** row is the whole trade. Upstream topology runs every boolean,
every selector and every glyph through the OCP shim, and each dispatch
retains ~32-230 B in the interpreter for the duration of the run. That is
run-scoped — the next run reports ~1.1 MB live — but MicroPython's GC arena
grows by doubling and NEVER shrinks, so a model that makes millions of FFI
calls ratchets the isolate past 128 MB and does not give it back.
`examples/clock` alone takes MicroPython from 19.5 MB to 386 MB in Node.
Bounding it needs an interpreter patch; see the
`NOTE(heavy-model memory round)` in
`packages/cascade-core/upstream-py/ocp_shim/ocp_core.py`.

So: **lite for throughput and heavy models, upstream for fidelity.** If a
script is in the 10-model delta (or uses an API lite does not have), deploy
it against `--env upstream` and keep it under the memory line.

```bash
npx wrangler deploy                  # lite   -> cascade-headless
npx wrangler deploy --env upstream   # upstream -> cascade-headless-upstream
BASE=https://cascade-headless-upstream.<subdomain>.workers.dev \
  node scripts/edge-bench.mjs --fidelity
```

## Two ceilings that were real

Both were found by `scripts/edge-bench.mjs` against the live Worker, and both
were something other than what the symptom suggested.

**"export failed: memory access out of bounds" was not the 128 MB cap.** It
reproduces in plain Node, at 32 MB, with the wasm memory free to grow, and
the export itself costs ~0 MB. Two OCCT 8.0.1 kernel algorithms scribble over
their own heap in this wasm build — `BRepFilletAPI_MakeFillet::Build` with
`ChFi3d_Rational` (maker_coin's nine `Select.NEW` edges) and
`BRepOffsetAPI_ThruSections::Build` (the ruled wall `thicken()` lofts,
bicycle_tire). The geometry they return is correct; a live allocation
elsewhere gets handed out twice, and the casualty is a lazily-built
singleton, so `new STEPControl_Writer` traps for the rest of the isolate's
life. That is what made the ladder alternate: once maker_coin had run,
Buffer_Stand and build123d_logo failed too, though on a fresh isolate they
export fine.

cascade-core now snapshots OCCT's linear memory right after module init (3.7
MB of the 32 MB initial heap; ~20 ms to take, ~2 ms to restore) and rewinds
to it — `COMPROMISE(kernel-heap-reset)` in
`packages/cascade-core/src/worker/CascadeWorker.js`. `engine.reset()` does it
between requests, so an isolate is never left poisoned, and `exportSTEP()`
does it on failure: carry the shape out as BREP, rewind, re-import, write.
maker_coin's healed STEP round-trips through `import_step` to 7.7e-8 relative
volume.

**`examples/clock`'s `Cannot set properties of undefined (setting 'hash')`
was a missing font.** The Worker bundled `FreeSans` only;
`Text(font_style=FontStyle.BOLD)` asks for `FreeSansBold`, the text builder
returned null and `CacheOp` died on it. `FreeSansBold` now ships, and a face
that is genuinely absent raises an error that names it (see
[Fonts](#fonts)).

## Verified in this environment

Everything below was run locally against **workerd** via `wrangler dev`
(wrangler 4.125.0), not merely reasoned about:

```
=== GET /health ===
  boot 147 ms   occtWasm 32.0 MB
  PASS  health ok

=== (a) Box(10, 10, 10) -> step + brep + stl ===
  PASS  HTTP 200 / ok / STEP is ISO-10303-21 / BREP non-empty / STL has 12 facets
  201 ms   occt 32.0 MB + python 19.5 MB = 51.5 MB   (eval 148 ms)

=== (b) PYTHON_STARTER_CODE (flanged bearing mount) ===
  PASS  volume ~= 48603.5 mm^3 / STEP is substantial (117981 bytes)
  375 ms   occt 32.0 MB + python 19.5 MB = 51.5 MB   (eval 323 ms)

=== (c) export_step() / export_brep() inside the script ===
  PASS  script wrote part.step / part.brep
  PASS  import_brep round-trips the volume  — 1270.353996706151 vs 1270.3539967061508
  57 ms   occt 32.0 MB + python 19.5 MB = 51.5 MB   (eval 23 ms)

=== (d) a failing script comes back as JSON, not a 500 ===
  PASS  HTTP 422 / NameError reported
```

The numbers are identical to the Node leg (`node test/headless-node.mjs`),
which stays the authoritative regression test.

**Edge-verified** (2026-08-22): `wrangler deploy` to a real Cloudflare
account succeeded (`Total Upload: 31056.16 KiB / gzip: 9908.60 KiB`, startup
3 ms) and the full smoke suite — now eight groups, including the two font
cases and the two SSE cases — passed against the deployed `*.workers.dev` URL
(`BASE=https://<name>.workers.dev node scripts/smoke.mjs`), with geometry
byte-identical to the Node and local-workerd legs, plus the nine-model
capability ladder above. Warm request round-trip for a `Box` render is
~90–100 ms; a cold isolate adds ~2 s (wasm instantiation + MicroPython boot,
paid once per isolate). One edge-only quirk: the in-response `timings` fields
read 0 on deployed Workers because Cloudflare freezes `Date.now()` during
synchronous CPU work (Spectre mitigation) — measure latency client-side.

## Progress streaming

```bash
curl -sN -X POST 'http://localhost:8787/render?stream=1' \
  -H 'content-type: application/json' \
  -d '{"code":"from build123d import *\nshow(Box(10,10,10))","formats":["step"]}'
```

```
event: phase
data: {"phase":"evaluating","language":"python","formats":["step"]}

event: phase
data: {"phase":"evaluated","shapeCount":1,"ok":true}

event: phase
data: {"phase":"exporting","format":"step"}

event: done
data: {"ok":true,"step":"ISO-10303-21;…","progressOps":[{"n":1,"op":"Box"},…],…}
```

| event | when |
|---|---|
| `phase: booting` | only on a COLD isolate, before the ~2 s wasm + interpreter boot |
| `phase: evaluating` | before the script runs |
| `phase: evaluated` | `{shapeCount, ok, errors?}` |
| `phase: exporting` | once per requested format, `{format}` |
| `done` / `error` | terminal; carries **exactly** the JSON endpoint's payload |

**The honest limitation: this is phase-level, not per-op.** The evaluation is
one synchronous call into wasm — the isolate does not yield inside it, so
anything enqueued mid-evaluation could only be flushed after it finished, and
"live" per-op events would be a burst at the end pretending to be progress.
The events above are the real `await` boundaries in the request, and nothing
finer exists to report. The per-op timeline (`{n, op}`, from the worker's own
`Progress` messages) is a RECORD and arrives with `done`, in `progressOps`.

Two implementation notes worth keeping:

* enqueueing is not flushing. Each write is followed by `scheduler.wait(0)`;
  without it workerd delivers every event at once when the handler returns.
  Verified client-side (`scripts/smoke.mjs` case (g) timestamps arrivals):
  local workerd `evaluating@18ms evaluated@285ms exporting@296ms done@314ms`,
  deployed edge `evaluating@23ms evaluated@1028ms exporting@1028ms
  done@1102ms` on the starter model.
* phase timestamps must be taken by the CLIENT. A deployed Worker freezes
  `Date.now()` during CPU work, so server-side stamps inside one synchronous
  stretch are all equal.

The plain JSON `POST /render` is unchanged; `progressOps` is the only new
field and it is purely additive.

### Shrinking the STEP payload

`engine.exportSTEP({ parametricCurves: false })` sets OCCT's
`write.surfacecurve.mode` to 0, dropping each edge's 2-D parametrisation on
its faces and keeping only the 3-D geometry. Measured on the corpus:

| model | full | lean | round-trip volume |
|---|---:|---:|---|
| `ttt-24-SPO-06-Buffer_Stand` | 144 KB | 53 KB (−63%) | 1.1e-5 rel |
| `ttt-ppp0101` | 121 KB | 45 KB (−63%) | 2.0e-7 rel |
| `intersecting_pipes` | 194 KB | 75 KB (−61%) | 9.2e-11 rel |

It is a **payload** knob, not a headroom one: STEP export costs ~0 MB of wasm
memory either way (measured `memoryStats().occtWasm` before/after: 32.0 → 32.0
MB on every model that exports). Opt-in, so the default file stays what other
CAD tools expect.

## Fonts

build123d's `Text()` resolves `font_style` to a SPECIFIC family member. All
four now ship, as **static assets** rather than script bindings — which is
what made them affordable (they were 2.20 MB gz against 0.33 MB of headroom
inside the script):

| face | `FontStyle` | gzip | |
|---|---|---:|---|
| `FreeSans` | `REGULAR` (default) | 0.94 MB | static asset |
| `FreeSansBold` | `BOLD` | 0.51 MB | static asset |
| `FreeSansOblique` | `ITALIC` | 0.47 MB | static asset |
| `FreeSansBoldOblique` | `BOLDITALIC` | 0.30 MB | static asset |

A face that is genuinely absent still fails with a `422` naming it, rather
than the old `Cannot set properties of undefined (setting 'hash')`:

```
the font "X" is not available in this engine (loaded: FreeSans, …).
A headless host supplies fonts itself — pass the TTF bytes for it,
e.g. createHeadlessCascade({ fonts: { X: <bytes> } }).
```

An unknown font NAME (`font="Comic Sans MS"`) falls back to the bundled
family instead. To add a face: drop the TTF in `packages/cascade-core/fonts/`
— `scripts/prepare-assets.cjs` copies every `FreeSans*.ttf` into
`public/fonts/` and `src/index.js` fetches it lazily, so no static import is
needed any more.

## Memory and timing

| | lite | upstream |
|---|---|---|
| isolate limit | **128 MB** | **128 MB** |
| after boot (OCCT only) | 32.0 MB | 32.0 MB |
| after any Python run (OCCT + MicroPython) | **51.5 MB** | **51.5 MB** |
| engine boot (`/health`, `bootMs`) | ~150-360 ms | ~170-580 ms |
| static-asset fetch on a cold isolate (`assetMs`) | 0.36-1.15 s / 4.31 MB | 0.20-0.68 s / 7.61 MB |
| Python library registration (first Python request) | ~130 ms | **~640 ms** |
| cold first `/render` (client round trip) | **3.0 s** | **5.6 s** |
| warm `Box(1,1,1)` round trip | 44-57 ms | 61-89 ms |
| starter model (fillets, booleans, `GridLocations`) | ~300 ms eval | ~340 ms eval |

`/health` reports `pySrc`, `bootMs`, `assetMs`, `assetBytes` and `cold`, so
the cost of the static-assets split is measurable from outside.

51.5 MB of 128 MB for a basic model on EITHER flavor, with the remaining
headroom for the model itself. Where they part company is heavy models — see
[Source flavors](#source-flavors).

## Bundle size — the real constraint

Cloudflare's compressed Worker **script** limit is **10 MiB (10240 KiB)** on
paid plans and 3 MB on the free plan. Static assets do not count against it.

**Worker script** (`assets/`, module bindings — `wrangler deploy` reports the
bundled figure):

| asset | raw | gzip | why it must be in the script |
|---|---|---:|---|
| `cascadestudio.wasm` (OCCT 8.0.1) | 25.77 MB | **7.62 MB** | workerd will not compile wasm at runtime |
| `cascade-headless.mjs` | 1.03 MB | 0.29 MB | the engine (build123d-lite's Python is a string inside it) |
| `micropython-cs.wasm` | 0.46 MB | 0.20 MB | same wasm rule |
| `micropython-cs.mjs` | 0.10 MB | 0.03 MB | Emscripten glue; workerd forbids `import()` of a URL |
| **`wrangler deploy`** | **28285 KiB** | **8417 KiB** | **1823 KiB of headroom** |

**Static assets** (`public/`, fetched through the `ASSETS` binding at engine
boot — 0 KiB of script):

| asset | raw | gzip | fetched by |
|---|---|---:|---|
| `fonts/FreeSans*.ttf` (4 faces) | 4.10 MB | 2.22 MB | both flavors, at boot |
| `py/upstream-b123d.json` (158 modules) | 3.15 MB | 0.40 MB | `PY_SRC=upstream` only |

Before this split the script was **9909 KiB gz — 97% of the limit**, with the
390 KiB gz upstream Python layer still to fit. Moving the fonts out bought
1492 KiB and made both flavors deployable from the same 8417 KiB script.

The upstream Python ships as ONE relative-path → text map rather than 158
files because the loader asks for ~120 modules by name and every
`env.ASSETS.fetch()` is a Worker subrequest; one fetch plus one
`JSON.parse` costs 20 ms locally.

The OCCT wasm is the floor. A smaller kernel build (dropping IGES/STL
readers, the mesher, `Geom2dGcc`, …) is the only way under the free plan's
3 MB, and that is a fork-level exercise — see
`node_modules/opencascade.js/CLAUDE.md`.

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
     `new Function`** by default, which killed the very first boot attempt
     here. The OpenCascade fork is therefore compiled with
     **`-sDYNAMIC_EXECUTION=0`** (`builds/cascadestudio.yml`): embind then
     emits closure-based invokers and emval closure-based call thunks, so the
     shipped glue never generates code from strings. Same glue everywhere —
     browser worker, Node and workerd — at a measured +2-4% on model
     evaluation and +3-8% on the mesh-readback path (the non-specialized
     invoker is slower; kernel time is untouched, and the wasm binary is
     byte-identical). `packages/cascade-core/scripts/build-headless.cjs` asserts
     it: no `new Function(`/`eval(` may reach the bundle from the glue, or the
     build fails.
   - Consequence: **`language: "cascadestudio"` (the JS standard library) is
     NOT available on Workers** — evaluating user JS is `eval` by
     definition. Python mode is unaffected.
2. **No dynamic `import()` of a URL.** `micropython-cs.mjs` is imported
   statically and handed to the runtime as a namespace object
   (`_csMicroPythonLocate.mod`).
3. **`nodejs_compat` is deliberately OFF.** It defines `process`, and an
   Emscripten glue built for every environment sniffs
   `globalThis.process?.versions?.node` to decide it is running under Node —
   at which point it reaches for `createRequire`/`fs` and dies. OpenCascade's
   glue is immune now (`-sENVIRONMENT=web`: there is no node branch left in
   it), but MicroPython's vendored glue still has one, so the flag stays off
   and the four node specifiers its dead branch mentions (`module`, `fs`,
   `path`, `url`) are still aliased to `src/node-module-stub.js` in
   `wrangler.toml` so the bundler can resolve them. Verified by deleting the
   `[alias]` block: the build fails with four "Could not resolve" errors.
4. **CPU time.** The free plan gives 10 ms of CPU — not enough to boot the
   kernel, let alone model. A paid plan's DEFAULT is 30 s, and that is a real
   ceiling for this workload: `examples/heat_exchanger` spent ~37 s and came
   back **HTTP 503**. `wrangler.toml` therefore asks for the paid maximum,
   **`[limits] cpu_ms = 300000`** (5 min), under which heat_exchanger
   completes in 72 s and returns a 3.77 MB STEP. A request that still exceeds
   it is killed and 503s — nothing in the Worker can extend it further, so
   anything heavier belongs in a queue/Durable Object, not a single request.
5. **One engine per isolate.** `enginePromise` is a module global, so the
   ~147 ms boot and 32 MB are paid once and reused; `/render` calls
   `engine.reset()` afterwards, which rewinds OCCT to its boot image — the
   next request gets a pristine allocator (no heap ratcheting) AND an
   un-poisoned kernel (see
   [Two ceilings that were real](#two-ceilings-that-were-real)).
6. **`pySrc: 'lite'`.** The `upstream` source layer (verbatim upstream
   build123d 0.11.1) also works headless, but needs 3.5 MB of extra Python
   text bundled and boots ~5x slower (642 ms vs 122 ms of library load) for
   identical memory. Lite is embedded in the JS bundle.

## Files

```
wrangler.toml                 module rules, [assets], [env.upstream], why nodejs_compat is off
src/index.js                  the Worker: POST /render (+ ?stream=1), GET /health
src/node-module-stub.js       resolves the glues' dead node-only imports
scripts/prepare-assets.cjs    cascade-core/dist -> assets/ (script) + public/ (static)
scripts/smoke.mjs             curl-equivalent end-to-end checks, incl. the SSE stream
scripts/edge-bench.mjs        the capability ladder (+ --fidelity, the flavor delta)
```

Both `assets/` and `public/` are gitignored (`cascadestudio.wasm` alone is
26 MB). Run `npm run build` in the repo root first, then
`npm run prepare-assets`.
