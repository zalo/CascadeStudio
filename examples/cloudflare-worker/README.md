# cascade-headless on Cloudflare Workers

Turn **build123d Python** into **STEP / BREP / STL** inside a Cloudflare
Worker — OpenCascade 8.0.1 (wasm) + MicroPython 1.28 (wasm) + build123d,
all in one 128 MB isolate. No browser, no DOM, no Three.js, no mesher unless
STL is asked for.

Every asset — both wasm binaries, the MicroPython glue, the four FreeSans
faces and (upstream only) the Python layer — is a **module of the Worker
script**: 31.7 MiB (lite) / 34.9 MiB (upstream) of Cloudflare's 64 MiB,
which since 2026-09-04 is the only size limit, uncompressed, on Free and
Paid alike. [SIZE-INVESTIGATION.md](SIZE-INVESTIGATION.md) has the
measurements behind every number in this section and the next.

Two deployments, one codebase — see [Source flavors](#source-flavors):

| | build123d | corpus | live |
|---|---|---|---|
| default | **build123d-lite** (embedded) | 206/222 | `cascade-headless.makeshifted.workers.dev` |
| `--env upstream` | **verbatim upstream 0.11.1** over the OCP shim | 216/222 | `cascade-headless-upstream.makeshifted.workers.dev` |

```bash
cd examples/cloudflare-worker
npm install                 # wrangler (a devDependency of THIS example only)
npm run dev                 # prepare-assets + wrangler dev  -> :8787   (lite)
npm run dev:upstream        # the same, verbatim upstream build123d
npm run dev:warm            # lite, engine booted + warmed at global scope (BOOT=warm)
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
`formats: ["step"]`, `measure: true` — the static-assets layout and the
shipping JS-exceptions wasm; not re-run since, as nothing has been
deployed). Times are **client-side round trips**
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

Same wasm, same fonts, same routes (`src/app.js`); the entry module picks
which build123d boots — `src/index.js` (lite) or `src/index-upstream.js`,
which adds the upstream Python layer as a Text module so that a lite
isolate never holds it. One isolate serves one flavor: the engine keeps
its state on the worker global and a Python runtime registers ONE library,
so this is a wrangler environment, not a query parameter.

| | `lite` (default) | `upstream` |
|---|---|---|
| what runs | `Build123dLite.js` — a re-implementation, embedded in the bundle as a Python string | build123d 0.11.1's OWN `geometry.py` + `topology/*.py` + object/builder layers, **verbatim**, over an OCP-over-embind shim |
| validation corpus | 206 PASS / 10 MISMATCH / 5 ERROR / 1 TIMEOUT | **216 PASS** / 2 / 3 / 1 |
| cold first request (edge, 2026-08, static-assets layout) | **3.0 s** | **5.6 s** |
| warm trivial model | **44-57 ms** | **61-89 ms** |
| extra modules in the script | 4.11 MB of fonts | 4.11 MB of fonts + 3.15 MB of Python (one JSON map) |
| `Box`/starter isolate memory | **51.5 MB** | **51.5 MB** — identical, because the shapes live in OCCT's heap either way |
| heavy models | clock 65.0 MB, heat_exchanger 86.6 MB | clock and heat_exchanger exceed 128 MB |
| Total Upload (`wrangler deploy --dry-run`) | 32,492.57 KiB = 31.7 MiB | 35,720.74 KiB = 34.9 MiB |
| library boot (Node, first Python run) | ~120-135 ms | ~0.86-1.0 s — over budget for `BOOT=warm` |

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
npx wrangler deploy --env warm       # lite, BOOT=warm -> cascade-headless-warm
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

Everything below was run against **workerd**, not merely reasoned about.

**Local** (`wrangler dev`, wrangler 4.125.0, 2026-10-15, every asset
inline) — `node scripts/smoke.mjs` against `--env=""`, `--env upstream`
AND `--env warm`: **ALL WORKER CHECKS PASSED** on all three, eight groups
including the FreeSans family and the two SSE cases.

```
                                     lite            upstream        lite, BOOT=warm
GET /health  (engine boot)           110 ms          181 ms          at global scope
(a) Box(10,10,10) -> step+brep+stl   252 ms  51.5 MB 845 ms  51.5 MB  56 ms  51.5 MB
(b) PYTHON_STARTER_CODE              410 ms  51.5 MB 486 ms  51.5 MB 490 ms  51.5 MB
(c) export_step()/export_brep()       63 ms  51.5 MB  77 ms  51.5 MB  78 ms  51.5 MB
    import_brep round-trip           1270.353996706151 on all three
```

(a) is the first request into a fresh isolate, so for `request` mode it
carries the Python boot; `warm` paid that at global scope.

**Edge** (2026-08-23, the static-assets layout — nothing has been
deployed since) — both flavors deployed from the same script
(`Total Upload: 28285.76 KiB / gzip: 8417.11 KiB`, startup 3 ms, 5 static
assets), full smoke suite green against both `*.workers.dev` URLs, geometry
byte-identical to the Node and local-workerd legs, plus the ladders above.

| | lite | upstream |
|---|---|---|
| deploy | `cascade-headless` | `cascade-headless-upstream` |
| smoke | ALL WORKER CHECKS PASSED | ALL WORKER CHECKS PASSED |
| cold first `/render` | 3033 ms | 5615 ms |
| warm `Box` round trips | 49, 44, 45, 48, 55, 57, 51 ms | 74, 89, 76, 70, 61, 65, 61 ms |
| ladder | 8 of 9 return STEP | 6 of 9 |

Two edge-only quirks the numbers depend on:

* the in-response `timings` fields read 0 on a deployed Worker, because
  Cloudflare freezes `Date.now()` during synchronous CPU work (Spectre
  mitigation) — measure latency **client-side**;
* a cold isolate also paid the static-asset fetch: 0.36-1.15 s for lite's
  4.31 MB of fonts, 0.20-0.68 s for upstream's 7.61 MB, once per isolate.
  That layout is retired — the fonts and the Python are modules of the
  script now — so this cost is gone; what the larger script costs a cold
  isolate instead has to be measured on the edge (SIZE-INVESTIGATION.md
  §6, item 8).

The Node leg (`node test/headless-node.mjs`, and
`CS_PY_SRC=upstream node test/headless-node.mjs`) stays the authoritative
regression test — both ALL PASS.

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
| `phase: booting` | only when the request finds the engine not yet booted (`BOOT=request`, a cold isolate) |
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
four ship, as **Data modules** of the script (`assets/fonts/*.ttf`,
ArrayBuffers). cascade-core keeps the bytes and **parses a face the first
time a script uses it** — eagerly parsing all four at boot used to cost
~150 ms of boot and ~50 MB of V8 heap in workerd (~115 ms / ~100 MB in
Node), for a feature most scripts never touch. The first `Text()` in an
isolate pays 30-60 ms per face, once.

| face | `FontStyle` | raw |
|---|---|---:|
| `FreeSans` | `REGULAR` (default) | 1.76 MB |
| `FreeSansBold` | `BOLD` | 0.95 MB |
| `FreeSansOblique` | `ITALIC` | 0.84 MB |
| `FreeSansBoldOblique` | `BOLDITALIC` | 0.55 MB |

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
`assets/fonts/` — and add an `import` for it next to the other four in
`src/index.js` / `src/index-upstream.js`.

## Memory and timing

| | lite | upstream |
|---|---|---|
| isolate limit | **128 MB** (JS heap + wasm) | **128 MB** |
| wasm after boot (OCCT only) | 32.0 MB | 32.0 MB |
| wasm after any Python run (OCCT + MicroPython) | **51.5 MB** | **51.5 MB** |
| V8 heap, fresh isolate (workerd inspector) | 5.1 MB + 4.1 MB font backing stores | 11.4 MB (+ the 3 MB Python string) |
| V8 heap after 6 Box renders | 18.4 MB used / 29.7 MB total | 39.3 MB / 65.6 MB |
| engine boot (`/health`, `bootMs`, local workerd) | ~70-110 ms | ~65-180 ms |
| Python library registration (first Python request, Node) | ~120-135 ms | **~0.86-1.0 s** |
| global-scope CPU with `BOOT=warm` (Node, `scripts/startup-bench.mjs`) | **~0.29-0.35 s** of the 1 s budget | ~0.95-1.08 s — refused |
| first `/render` into a fresh isolate (local workerd) | 228-252 ms (`BOOT=request`), **56 ms** (`BOOT=warm`) | ~0.8 s |
| cold first `/render`, edge (2026-08, static-assets layout) | **3.0 s** | **5.6 s** |
| warm `Box(1,1,1)` round trip, edge (2026-08) | 44-57 ms | 61-89 ms |
| starter model (fillets, booleans, `GridLocations`) | ~250-300 ms eval | ~320-400 ms eval |

`/health` reports `pySrc`, `bootMs`, `cold` and `boot` (the `BOOT` mode and
whether the global scope booted/warmed the engine; its ms fields read 0 on
the edge and in workerd, whose clocks are frozen at global scope).

51.5 MB of wasm for a basic model on EITHER flavor, with the remaining
headroom for the model itself. Where they part company is heavy models — see
[Source flavors](#source-flavors).

### When the engine boots — `BOOT`

| `BOOT` | global scope does | cost on the 1 s startup budget (lite) |
|---|---|---|
| `request` (default) | nothing — the first request boots the engine | 0 |
| `startup` | OCCT instantiate + embind registration + init + kernel snapshot | ~80-120 ms |
| `warm` | `startup` + the Python boot + a Box -> BREP + STEP warm-up | ~290-350 ms |

Top-level await works here only because every asset is a module: the boot
then settles through microtasks alone (workerd rejects a top-level await
that waits on I/O: "Top-level await in module is unsettled"). The warm-up
lends its one `exportSTEP()` a plausible clock — workerd's `Date.now()` is
0 at global scope and OCCT's `Quantity_Date` rejects years before 1979.
The upstream entry downgrades `warm` to `startup`: its library boot alone
is ~1 s of CPU. `warm` is opt-in until a real deploy has printed its
"Worker Startup Time".

## Bundle size

Since **2026-09-04** a Worker may be **64 MiB uncompressed on Free and
Paid alike**, and there is **no compressed limit** — `wrangler deploy
--dry-run --outdir` prints `Total Upload`, which is what counts; the gzip
figure is informational
([limits](https://developers.cloudflare.com/workers/platform/limits/),
[changelog](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/)).

Everything is therefore a module of the script (`assets/`, built by
`scripts/prepare-assets.cjs`):

| module | raw | type | |
|---|---:|---|---|
| `cascadestudio.wasm` (OCCT 8.0.1) | 25.77 MB | CompiledWasm | workerd will not compile wasm at runtime |
| `cascade-headless.mjs` | 1.03 MB | bundled JS | the engine (build123d-lite's Python is a string inside it) |
| `micropython-cs.wasm` | 0.46 MB | CompiledWasm | |
| `micropython-cs.mjs` | 0.10 MB | bundled JS | Emscripten glue; workerd forbids `import()` of a URL |
| `fonts/FreeSans*.ttf` (4 faces) | 4.11 MB | Data | parsed on first use |
| `upstream-b123d.json` (158 modules) | 3.15 MB | Text | upstream entry only, `JSON.parse`d once at boot |
| **Total Upload, lite** | **32,492.57 KiB = 31.7 MiB** | | **50% of 64 MiB** |
| **Total Upload, upstream** | **35,720.74 KiB = 34.9 MiB** | | **55% of 64 MiB** |

The fonts and the upstream Python used to be Workers Static Assets fetched
through `env.ASSETS` at boot, purely to fit the old 10 MiB-gzip cap (the
script was 9909 KiB gz before that split, 8417 KiB after). That cost a
subrequest round trip on every cold isolate (0.2-1.15 s on the edge) and
kept the boot inside a fetch handler, where `env` lives. Neither is worth
anything now.

The OCCT wasm is no longer a floor that matters, but it is still the
biggest thing here, and the cheapest CPU win as well: rebuilt with native
wasm exceptions it is 19.66 MB (−27%) and evaluates models 10-73% faster
with identical geometry. That needs a fork rebuild — see
SIZE-INVESTIGATION.md §3.

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
4. **CPU time.** The free plan gives 10 ms of CPU per request. Even with
   the whole boot moved to global scope (`BOOT=warm`), only a single
   primitive fits: in Node, Box -> BREP is ~5 ms and Box -> STEP 7-10 ms.
   A plate with four holes takes 26-39 ms and the starter 130-290 ms
   (SIZE-INVESTIGATION.md §5). **Use a paid plan.** A paid plan's DEFAULT
   is 30 s, and that is a real
   ceiling for this workload: `examples/heat_exchanger` spent ~37 s and came
   back **HTTP 503**. `wrangler.toml` therefore asks for the paid maximum,
   **`[limits] cpu_ms = 300000`** (5 min), under which heat_exchanger
   completes in 72 s and returns a 3.77 MB STEP. A request that still exceeds
   it is killed and 503s — nothing in the Worker can extend it further, so
   anything heavier belongs in a queue/Durable Object, not a single request.
5. **One engine per isolate.** `createWorker()` keeps one engine per
   isolate, so the ~70-110 ms boot and 32 MB are paid once and reused —
   at global scope with `BOOT=startup`/`warm`; `/render` calls
   `engine.reset()` afterwards, which rewinds OCCT to its boot image — the
   next request gets a pristine allocator (no heap ratcheting) AND an
   un-poisoned kernel (see
   [Two ceilings that were real](#two-ceilings-that-were-real)).
6. **`pySrc: 'lite'` by default.** The `upstream` source layer (verbatim
   upstream build123d 0.11.1, `--env upstream`) adds 3.15 MB of Python to
   the script and boots ~7x slower (~0.9 s vs ~0.13 s of library load) for
   identical basic-model memory. Lite is embedded in the JS bundle.

## Files

```
wrangler.toml                 module rules, BOOT, [env.upstream], [env.warm], why nodejs_compat is off
src/app.js                    the routes: POST /render (+ ?stream=1), GET /health; BOOT modes
src/index.js                  lite entry: imports the modules, boots per BOOT
src/index-upstream.js         upstream entry: the same + the upstream Python map
src/node-module-stub.js       resolves the glues' dead node-only imports
scripts/prepare-assets.cjs    cascade-core/dist -> assets/ (every module the entries import)
scripts/smoke.mjs             curl-equivalent end-to-end checks, incl. the SSE stream
scripts/edge-bench.mjs        the capability ladder (+ --fidelity, the flavor delta)
scripts/startup-bench.mjs     src/app.js from Node: global-scope + per-request CPU per BOOT mode
scripts/cpu-bench.mjs         per-phase engine CPU (compile/boot/first run/warm/corpus), any dist
SIZE-INVESTIGATION.md         limits, sizes, wasm variants, startup, Free-plan CPU — measured
```

`assets/` is gitignored (`cascadestudio.wasm` alone is 26 MB). Run `npm run build` in the repo root first, then
`npm run prepare-assets`.
