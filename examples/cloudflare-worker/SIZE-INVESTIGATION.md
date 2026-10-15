# Getting build123d onto Cloudflare Workers: size, startup, CPU

Investigated 2026-10-15 on branch `feat/cf-workers-size` (based on
`feat/build123d-0.13`), with fork-side experiments on
`zalo/opencascade.js` branch `cf-size-experiments` (local, not pushed).
**Nothing was deployed.** Everything below was measured locally: in Node
22.22 (V8 12.4), in local workerd (`wrangler dev`, wrangler 4.125.0), and
with `wrangler deploy --dry-run --outdir`. Edge-only questions are listed
at the end with the commands that would answer them.

## Where we stand (2026-10-15, merged branch)

All three memory reductions are in this state:

- the opencascade.js fork's native-EH artifacts, with 8 MB initial memory
  and a 512 KB stack (§7);
- MicroPython's 6 MiB reservation and mid-run GC, from the fidelity round;
- the JS-heap fixes: `keep_names = false`, lazy fonts, and the Python map
  released after boot.

Measurement conditions:

- **Memory** is local workerd, read through the inspector with the fidelity
  agent's `experiments/cf-fidelity/workerd-ladder.mjs`, one fresh isolate
  per model, on inspector port 9301 (another project holds 9229). "Live" is
  wasm plus the V8 heap after a full GC. **+AB** adds V8's ArrayBuffer
  backing stores (fonts, kernel image, MEMFS); whether Cloudflare counts
  those is an edge question.
- **CPU** is main-thread CPU in Node (`scripts/startup-bench.mjs`, idle
  machine, load < 1), through the Worker's own fetch handler.
- **Sizes** are `wrangler deploy --dry-run`.
- Raw rows: `experiments/cf-fidelity/workerd-ladder-013-merged.json`. The
  high-fidelity flavors in depth: [FIDELITY-ON-WORKERS.md](FIDELITY-ON-WORKERS.md).

**Size and startup**

| entry | Total Upload (of 64 MiB) | global-scope startup CPU (of 1 s) | cold first `/render`, local workerd |
|---|---:|---|---:|
| lite (`src/index.js`) | **25,354 KiB** (39%) | 0 (`BOOT=request`); 41 ms (`startup`) | 234 ms |
| warm (`--env warm`) | 25,354 KiB (39%) | **224 ms** (`warm`) | **42 ms** |
| upstream (`src/index-upstream.js`) | **28,688 KiB** (44%) | 0; ~45 ms (`startup`); 668 ms if warm were allowed (the entry refuses it, see the notes) | 686 ms |
| real (`src/real.js`) | **48,649 KiB** (74%) | 0 (imports only; Pyodide boots on the first request) | 1,835 ms |

**Basic-model memory and per-request CPU**

| entry | starter, live / +AB (of 128 MB) | Box → STEP CPU, warm (Free: 10 ms) | 4-hole plate CPU | starter CPU |
|---|---|---:|---:|---:|
| lite | **27.3 / 36.3 MB** | **3 ms** | 15 ms | 85 ms |
| warm | as lite | 3 ms | 15 ms | 85 ms |
| upstream | **31.0 / 41.3 MB** | **5 ms** | 17 ms | 140 ms |
| real | **87.8 / 107.9 MB** | ~32 ms (eval, local workerd) | – | ~224 ms (eval) |

**Heavy models, live / +AB, MB (of 128)**

| entry | maker_coin | heat_exchanger | bracelet |
|---|---|---|---|
| lite | 71.6 / 80.6 | 65.2 / 74.2 | 114.0 / 123.0 |
| upstream | 70.1 / 80.4 | 117.2 / **127.5** (borderline) | **198.0** / 208.3 (over) |
| real | 122.5 / **142.6** (fits only if AB are not counted) | **137.2** / 157.3 (over) | **192.8** / 212.9 (over) |

Before this merge, on 32 MB OCCT, the fidelity branch's own ladder had
upstream at 56.8 / 66.7 for the starter and real at 113.6 / 133.3. The
real starter now fits even with ArrayBuffers counted.

**Reading it:**

- **64 MiB:** every entry fits. Real is the largest at 74%.
- **128 MB:** every basic model fits on every flavor. Lite fits every heavy
  model measured, `bracelet` included. Upstream fits all but `bracelet`.
  Real fits basic models and fits `maker_coin` live, but not the heaviest
  models.
- **Warm isolates:** a warm isolate keeps its OCCT high-water, because wasm
  memory never shrinks (FIDELITY-ON-WORKERS.md §7).
- **1 s startup:**
  - Lite can boot and warm at global scope with 4.5x headroom on this
    machine.
  - Upstream's warm boot is down to 0.67 s from ~1.0 s, thanks to native
    EH, 0.13 and the interpreter patches. That is 1.5x headroom, which is
    not enough to switch on without an edge measurement, so
    `index-upstream.js` still downgrades `warm` to `startup`.
  - Real can only boot lazily.
- **CPU:**
  - **Free** (10 ms per request) holds a single primitive with a STEP
    export, and nothing with a boolean.
  - **Paid** has the CPU for everything in the corpus.

## The answer

**Size is no longer the problem, CPU is.** Cloudflare dropped the
compressed-size limit, and every entry fits 64 MiB inline. The Free
plan's 10 ms per request is out of reach for real models, even with every
boot cost moved to global scope and the native-EH kernel: a box exports in
~3 ms, a plate with four holes takes ~15 ms, the starter ~85 ms. **Paid is
the answer.** The sections below are the investigation as it happened.
§2-§6 were measured before the fork rebuild and before the merge, under
machine load; §7 is the adopted build.

## 1. The limits as of today

Re-checked 2026-10-15 against
<https://developers.cloudflare.com/workers/platform/limits/> (page
last updated 2026-10-12) and the changelog
<https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/>:

| limit | Free | Paid |
|---|---|---|
| Worker size | **64 MiB uncompressed** | **64 MiB uncompressed** |
| compressed size | **none** (removed 2026-09-04; it was 3 MB / 10 MB) | **none** |
| measured as | `Total Upload` from `wrangler deploy --dry-run --outdir` (gzip figure is informational) | same |
| memory per isolate | 128 MB, JS heap + wasm | 128 MB |
| startup (parse + run global scope) | 1 s of CPU, error 10021 | 1 s |
| CPU per HTTP request | **10 ms** | 30 s default, up to 5 min (`limits.cpu_ms`) |

Isolates tolerate occasional CPU overruns but consistent ones get
terminated. Time spent waiting on I/O does not count.

## 2. Size under the new rules (Q1)

`wrangler deploy --dry-run --outdir` (wrangler 4.125.0). The upload is the
bundled `index.js` plus every non-JS module. Source maps do not count:
28,964,623 B = 27,021,699 (OCCT wasm) + 486,414 (MicroPython wasm) +
1,456,510 (index.js) = 28,285.76 KiB.

| layout | OCCT wasm | lite Total Upload | upstream Total Upload | gzip (informational) |
|---|---|---:|---:|---:|
| as shipped 2026-08-23: fonts + upstream Python as **static assets** | shipping (JS EH) | 28,285.76 KiB = **27.6 MiB** | same script | 8,417 KiB |
| **everything inline** (this branch): fonts = Data modules, upstream Python = Text module | shipping (JS EH) | 32,492.57 KiB = **31.7 MiB (50%)** | 35,720.74 KiB = **34.9 MiB (55%)** | 10,700 / 11,113 KiB |
| everything inline | **native wasm EH** (§3) | 25,180.27 KiB = **24.6 MiB (38%)** | 28,408.45 KiB = **27.7 MiB (43%)** | 9,741 / 10,154 KiB |

The inline gzip figures would have failed the old 10 MiB cap, which is
why the static-assets split existed at all. Under the new rule nothing
about it is binding.

**What else fits** (lite inline leaves 32 MiB; upstream 29 MiB):

- All four FreeSans faces (4.11 MB): already included above.
- **Both flavors in one script**: yes, that is the upstream row. Lite's
  Python is a string inside `cascade-headless.mjs` either way. One isolate
  still serves one flavor, because the engine state is per-realm and a
  runtime registers one library. So a per-request flavor switch would need
  two Workers behind a service binding, not a bigger script. The example
  keeps one entry per flavor so a lite isolate never holds upstream's
  3 MB source string.
- A second OCCT wasm (for example full plus pruned, or JS EH plus wasm EH):
  +17-26 MB, still under 64 MiB.
- Pyodide/real CPython does **not** become possible by size alone. It
  loads packages as side modules, which means `WebAssembly.compile` at
  runtime, and workerd forbids that.

**Implemented** (commit `e45aedd`): `prepare-assets.cjs` lays every module
into `assets/`, `wrangler.toml` drops `[assets]`, `src/app.js` holds the
routes, and `src/index.js` / `src/index-upstream.js` are thin entries.
This removes the cold-isolate asset fetch, which measured 0.2-1.15 s on
the edge in 2026-08. It also removes the subrequests and makes a
global-scope boot possible, because `env.ASSETS` only exists inside a
handler while module imports exist at global scope.

## 3. OCCT wasm: anatomy and shrink experiments (Q2)

### Anatomy of the shipping 25.77 MiB

The shipping config was relinked with `--emit-symbol-map`. Same code
section to the byte (23,698,462 B). Only the minified import-name order
differs. Every defined function's body was then attributed to a toolkit
by demangled name: `experiments/cf-size/anatomy.py` on the fork branch,
using OCCT's own `PACKAGES` files.

| section | bytes | |
|---|---:|---|
| code | 23,698,462 | 32,886 functions |
| data | 3,160,007 | static tables, strings, RTTI names |
| elem (function table) | 113,292 | |
| imports | 549 functions | **476 of them `invoke_*`** (JS-emulated exceptions) |

| code by origin | bytes | share |
|---|---:|---:|
| OCCT ModelingAlgorithms (GeomAlgo, Fillet, Bool, ShHealing, TopAlgo, Offset, BO, HLR, Feat, Mesh, Prim) | 10.65 MB | 44.9% |
| OCCT DataExchange: **TKDESTEP 2.80 MB, TKDEIGES 1.61 MB**, XSBase 0.49, XCAF 0.26, glTF 0.07, STL 0.02 | 5.27 MB | 22.2% |
| OCCT ModelingData (GeomBase 1.55, BRep 0.89, G3d 0.67, G2d 0.18) | 3.29 MB | 13.9% |
| OCCT FoundationClasses (TKernel 0.85, TKMath 0.59) | 1.45 MB | 6.1% |
| **embind binding glue** (all `emscripten::` invokers + registration) | **1.09 MB** | **4.6%** |
| OCCT Visualization (TKV3d 0.70, TKService 0.10; pulled in by XCAF/glTF) | 0.80 MB | 3.4% |
| libc++ / libc++abi / libc | 0.61 MB | 2.6% |
| OCCT ApplicationFramework (OCAF for XCAF) | 0.41 MB | 1.7% |

**Binding glue is not where the bytes are; the kernel is.** And in the
kernel, the JS exception emulation is a tax on every function. The
disassembly has 606k direct call sites. Of those, 191,109 call
`invoke_*` (each a wasm→JS→wasm round trip at run time), 96,930 call
`__cxa_find_matching_catch_*` and 12,330 call `__resumeException`, each
with its `__THREW__` bookkeeping.

**Binding surface actually used.** The 291 yml symbols plus 106 derived
bases/handles give 369 bound classes. Lite's JS layer names 163 base
symbols (191 `oc.*` names incl. overloads; `UsedOCCTSymbols.generated.js`).
The upstream sources import 240 OCP names, of which 192 map to yml
symbols. The union is 216 of 291. The 75 others are mostly embind
inheritance bases or classes reached as return types, which cannot be
dropped. The genuinely unused families in a headless build are IGES,
glTF, XCAF/OCAF and STEPCAF (the browser uses IGES import).

### Variants

All variants were linked from the same object files. Sizes are in bytes.
CPU is main-thread CPU (`process.threadCpuUsage`) in Node, minimum of two
interleaved runs on a shared, loaded machine. Compare columns, not
absolute values. Geometry was checked by `measure()` (volume, area,
length, solid/face/edge counts, bbox at full double precision) plus the
error text on 27 corpus scripts: 23 random plus maker_coin, toy_truck,
ttt-ppp0110 and sort_axis. heat_exchanger and clock were checked
separately.

| variant (link flags vs shipping) | wasm raw | gzip -9 | glue | starter warm | ttt-ppp0101 | clock | heat_exchanger (wall, 1 run) | Box→STEP warm | geometry | verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| **shipping**: `-O3 -fexceptions -sDISABLE_EXCEPTION_CATCHING=0` | 27,021,699 | 7,935,917 | 235,026 | 234 ms | 612 ms | 5.09 s | 34.2 s | 6.3 ms | (reference) | |
| (a) `-Oz` | 25,947,892 (−4.0%) | 7,735,928 | 234,339 | 570 ms (**+63%**) | 1682 ms (**+97%**) | 10.8 s (+66%) | – | 13.2 ms | – | **no**: 4% smaller, 50-100% slower |
| (b) `-fwasm-exceptions` (legacy wasm EH) | 19,596,589 (**−27.5%**) | 6,986,725 | 122,932 | **102 ms (−57%)** | **292 ms (−52%)** | **3.62 s (−29%)** | – | **3.8 ms (−40%)** | 27/27 identical | yes, but kernel messages are opaque |
| **(b′) (b) + `-sEXPORT_EXCEPTION_HANDLING_HELPERS`** | **19,659,264 (−27.2%)** | 7,008,685 | 125,011 | ≈(b) | ≈(b) | 3.54 s (wall) | **9.2 s (−73%)** | ≈(b) | 27/27 + heat_exchanger + clock identical; OCCT messages decoded | **recommended** |
| (b″) (b′) + `-sWASM_LEGACY_EXCEPTIONS=0` (exnref) | 20,274,060 (−25.0%) | 7,076,883 | 125,011 | 101-111 ms | – | – | – | 3.6 ms | headless gate passes | no: +3% over legacy, Chrome 137/Safari 18.4 only |
| (c) (b′) minus IGES, XCAF/OCAF, STEPCAF, glTF bindings | 16,763,252 (−38.0%) | 6,130,060 | 110,558 | – | – | – | – | – | lite gate passes **except** IGES import; upstream fails at import (`OCP.XCAFDoc` enum registered eagerly) | not now (see below) |

The (c) toolkit deltas over (b′) are TKDEIGES −1.10 MB, TKV3d −0.48 MB
(so TKV3d was there only for XCAF), TKDESTEP −0.25 MB, TKernel −0.14 MB,
OCAF −0.25 MB and glTF −0.05 MB.

Wasm memory was identical in every variant: 32.0 MB after boot, 51.5 MB
after any basic model.

### (b′) native wasm exceptions: the one big lever

- **Why it works.** Emscripten's JS-emulated EH routes every call that
  can throw through a landing pad out to JS (`invoke_iii(fnptr, …)` with a
  JS `try`) and back. That is 191k call sites, and it is both the code
  bloat (−7.4 MB, −31% of the code section) and the CPU cost (an OCCT
  boolean chain is call-dense; heat_exchanger's ~1000 ops went from 34.2 s
  to 9.2 s).
- **Rebuild cost.** A full recompile of the OCCT sources (5,549 files)
  and of the 395 link-closure bindings, because `-fwasm-exceptions` is a
  compile flag. That was 7.6 min of sources plus ~9 min of bindings at
  `OCJS_JOBS=12 nice 15`, then a 3-4 min LTO link with a 6-7 GB peak RSS.
  The fork branch makes it one env var (`OCJS_EXCEPTIONS=wasm`). With
  `OCJS_CUSTOM_CLOSURE_ONLY=1` a fresh tree compiles 81 instead of ~2,500
  `myMain.h` bindings. The legacy-vs-exnref choice happens at LTO link
  time, so one compile serves both.
- **COMPROMISE(failure-decode)** still works, and is simpler. Under wasm
  EH a C++ throw reaches JS as a `WebAssembly.Exception`, not a pointer.
  Its payload needs the C++ tag, which emscripten only exports with
  `-sEXPORT_EXCEPTION_HANDLING_HELPERS` (+62 KB). With it,
  `Module.getExceptionMessage(ex)` returns `Standard_Failure::what()`, i.e.
  OCCT's own message. Commit `0e41c99` routes the five
  `typeof e === 'number'` checks through `isOCCTThrow()`, decodes
  WebAssembly.Exceptions that way and releases the refcount. Before/after
  on toy_truck's fillet, identical on both builds: `INTERNAL OPENCASCADE
  ERROR in FilletEdges: the OCCT kernel raised 'BRep_API: command not
  done'`. Without the helpers flag it degrades to "threw '[object
  WebAssembly.Exception]'", which is why (b′) and not (b). The same commit
  makes `_exporterFault` decode too, so exporter errors no longer show the
  raw pointer.
- **Support.** Legacy wasm EH runs on Chrome 95+, Firefox 100+, Safari
  15.2+, Node 17+ and workerd (verified: `smoke.mjs` ALL WORKER CHECKS
  PASSED on `--env=""`, `--env upstream` and `--env warm` with this wasm).
  exnref needs Chrome 137, Firefox 131 or Safari 18.4 (emscripten's
  `feature_matrix.py`), and buys nothing here.
- **Verified on (b′).** `node test/headless-node.mjs` and
  `CS_PY_SRC=upstream node test/headless-node.mjs` both report ALL PASS.
  workerd smoke passed on all three environments. The full Playwright
  suite gave 97 passed / 4 skipped / 1 failed; the failure is
  `py-src-real.spec.js`, which needs the gitignored `vendor/pyodide` and
  times out on any fresh worktree (it lacks its siblings' availability
  guard). It was run headful on an Xvfb `:99` that happened to be up; per
  the coordinator, use `env -u DISPLAY npx playwright test` from now on.
  The 27-script plus heat_exchanger/clock geometry comparison was
  identical.
- **Not done:** the full 232-script b123d-validation harness on (b′).
  Run it before repinning.

### (c) binding pruning: real, but not worth a second artifact now

It saves another 2.9 MB (−15% on top of (b′)) and drops TKV3d with XCAF.
But it removes IGES import from the headless engine (`FileUtils` binds
`IGESControl_Reader_1`). It also needs the OCP shim to register absent
classes and enums lazily: upstream currently dies at import on
`XCAFDoc_ColorType.XCAFDoc_ColorGen`. And it means shipping a second wasm
next to the browser's. With the size limit at 64 MiB and lite inline at
24.6 MiB on (b′), none of that buys anything.

### (d) other levers looked at

- **V8 compile time barely depends on size.** V8 compiles wasm lazily, so
  `WebAssembly.compile` of the 26 MB module costs 6-10 ms of main-thread
  CPU and 20-35 ms wall in every variant. That is mostly decoding, and
  workerd does it itself for a CompiledWasm binding. Forced eager
  compiles show what lazy compilation hides: Liftoff takes 110-175 ms wall
  (0.4-0.6 s CPU across threads), and TurboFan-everything takes 2.8-4.1 s
  wall (11-16 s CPU) for *all* variants. (b′) is not cheaper there,
  because wasm-EH `try` blocks are TurboFan work. The real compile cost is
  first-call Liftoff on the request path: the first Box→STEP after a
  Python boot costs 27-36 ms against 7-9 ms warm. `BOOT=warm` moves it to
  global scope (§4).
- **Closure Compiler on the glue**: 235 KB, or 125 KB on (b′). Irrelevant
  next to the wasm.
- **`-sSTACK_SIZE`**: measured in §7. The 64 KB default was overflowing,
  and that turned out to be the "kernel heap corruption". 512 KB is now
  in the fork.
- **Dropping IGES/XCAF toolkits**: covered by (c).

## 4. Startup (Q3)

Global-scope work is billed to the 1 s startup budget, not to a request.
Every asset is now a module, so the engine can boot in top-level await.
The boot settles through microtasks alone. Verified in workerd: a
`WebAssembly.instantiate` of a CompiledWasm module settles at top level,
while one that needs I/O fails with "Top-level await in module is
unsettled". The example exposes this as the `BOOT` var (commit `e45aedd`):

| `BOOT` | global scope does | lite: global-scope CPU | upstream |
|---|---|---:|---:|
| `request` (default) | nothing | 0 | 0 |
| `startup` | OCCT instantiate + embind registration + init + kernel snapshot | **80-120 ms** | 83-115 ms |
| `warm` | + MicroPython + library boot, 2nd snapshot, a Box → BREP + STEP warm-up (first-call compilation of the whole path) | **287-353 ms** | **947-1077 ms: over 1 s, refused by `index-upstream.js`** |

These figures come from `scripts/startup-bench.mjs`, which drives
`src/app.js` itself from Node. Two caveats about measuring:

- workerd pins `Date.now()` to 0 at global scope, so neither it nor the
  edge can time its own startup.
- That clock is a trap of its own. A startup-time `exportSTEP()` throws
  `Quantity_Date::Quantity_Date invalid parameters`, because OCCT refuses
  to stamp a STEP header with a year below 1979. The warm-up lends that
  one call a plausible clock.

Upstream's library boot alone is 0.86-1.0 s. That is MicroPython
compiling about 3 MB of transformed Python. The lever would be shipping it
pre-compiled to `.mpy` bytecode, which is not attempted here.

**Lite at ~0.3-0.35 s gives roughly 3x headroom if an edge core is as
fast as this machine.** That is unknown; the 2026-08 edge numbers are
consistent with it (Cloudflare's ~450 ms CPU for a cold starter request,
against ~470 ms here). `wrangler deploy` prints the real "Worker Startup
Time", and a startup over 1 s fails the deploy loudly rather than at run
time.

**Lazy fonts were the biggest boot win** (commit `5db3445`). The headless
worker used to `opentype.parse` every supplied face at boot. Measured
effect of parsing on first use instead:

| | eager (before) | lazy (now) |
|---|---:|---:|
| Node: boot CPU (4 FreeSans faces) | 185 ms | 70-90 ms |
| Node: live JS heap after boot (forced GC) | 125.6 MB | 22.6 MB |
| workerd: `/health` boot | 223 ms | 69-110 ms |
| workerd: V8 heap used after 6 Box renders (inspector `Runtime.getHeapUsage`) | 66.7 MB + 12.2 MB backing stores | 18.4 MB + 12.4 MB |

A script that uses `Text()` pays 30-60 ms per face on first use, once per
isolate.

**Cold first request.** In local workerd with `BOOT=request` and inline
assets, the first `/render` (Box → step+brep+stl) is 228-252 ms
round-trip (eval 168-173 ms). With `BOOT=warm` it is **56 ms (eval
10 ms)**. On the edge, 2026-08 measured 3.0 s (lite) and 5.6 s (upstream)
with the static-asset layout. Of that, 0.2-1.15 s was the asset fetch,
which inlining removes. The rest is edge-only: script distribution to the
colo, the binding compile, and a shared CPU. Only a deploy can show how a
script that is 4-7 MB bigger trades against one fetch fewer (§7).

**Memory.** Wasm is unchanged: 32.0 MB after boot, 51.5 MB after any
basic model, on every variant. The JS side shrank:

- A fresh lite isolate holds 5.1 MB of V8 heap, plus 4.1 MB of font
  backing stores (Data modules).
- Upstream starts at 11.4 MB, because of the 3 MB source string.
- After six renders: lite 18.4 MB used / 29.7 MB total; upstream
  39.3 / 65.6 MB.

How Cloudflare's 128 MB counts V8 heap ("used" or "total", with or
without garbage) is not documented beyond "JS heap + wasm".

These heap figures were read through **explicitly chosen** inspector ports
(`wrangler dev --inspector-port 9291-9299`; another project's workerd holds
9229 on this machine). I re-measured them on 9297/9298 with the
native-exceptions artifact and the same procedure:

| | lite | upstream |
|---|---|---|
| fresh isolate | 4.8 MB | 11.2 MB |
| after 6 Box renders, used / total | 16.9 / 24.9 MB | 37.7 / 64.5 MB |

That agrees with the figures above. The small drop is the smaller glue.

## 5. Free plan: 10 ms CPU per request (Q4)

Per-request main-thread CPU goes through the real fetch handler: JSON
parse, run, export, response serialisation and the kernel reset. This is
`scripts/startup-bench.mjs` with `BOOT=warm`, so every boot cost is
already paid at global scope. Medians of 11; `getrusage` resolution is
~1 ms.

| request | lite, shipping wasm | lite, (b′) wasm | upstream, (b′) | fits 10 ms? |
|---|---:|---:|---:|---|
| `Box(10,10,10)` → BREP | 5-6 ms | 5 ms | 9 ms | lite yes |
| `Box(10,10,10)` → STEP | 9-10 ms | **7 ms** | 13 ms | lite (b′) only, barely |
| plate, 4 `GridLocations` holes → STEP | 38-39 ms | 26-28 ms | 43 ms (shipping) | **no** |
| starter (fillets, booleans) → STEP | 245-292 ms | 130-132 ms | 320-380 ms (shipping) | **no** |
| corpus: boxes_on_faces / ppp0101 / intersecting_pipes / logo / Buffer_Stand (engine only, no HTTP) | 110 / 612 / 378 / 268 / 1247 ms | 64 / 292 / 224 / 172 / 1128 ms | – | **no** |

Without `BOOT=warm` (request or startup modes), the first request in an
isolate also carries the Python boot (~170-200 ms lite, ~0.8-1.1 s
upstream). That alone is 20-100x the Free budget.

**Verdict: Free is a demo tier.** A single primitive exported as BREP or
STEP fits, nothing with a boolean does, and upstream fits nothing.
Anything useful needs Paid: the default 30 s is already enough for every
corpus model except heat_exchanger on the shipping wasm, and on (b′)
heat_exchanger itself drops to ~9 s in Node.

## 6. Recommendation, ranked

**Done on this branch (no fork rebuild).** Verified with both headless
gates and `smoke.mjs` against `wrangler dev` on all three environments.

1. **Inline every asset** (`e45aedd`): 31.7 / 34.9 MiB of 64 MiB, no
   cold-isolate asset fetch, no subrequests, global-scope boot possible.
2. **Parse fonts on first use** (`5db3445`): boot −55-65%, about −48 MB
   of V8 heap in workerd, browser path untouched.
3. **`BOOT=warm` for lite, opt-in** (`e45aedd`, `[env.warm]`): ~0.3 s of
   startup CPU buys single-digit-ms trivial requests. It is the only
   configuration with any Free-plan story. The default stays `request`
   until a real deploy has printed the startup time.
4. **Kernel-throw decode ready for native wasm EH** (`0e41c99`): no
   behaviour change on today's wasm, and it removes the CascadeStudio side
   of the fork switch.

**Next, a fork rebuild.**

5. **Switch the fork to native wasm exceptions**, legacy encoding, with
   `-sEXPORT_EXCEPTION_HANDLING_HELPERS`: −27% wasm and 10-73% less CPU,
   identical geometry. That is the single biggest win found, for the
   browser app as much as for Workers. Recipe:
   `OCJS_EXCEPTIONS=wasm` on `compileSources.py` and `buildFromYaml.py`
   (fork branch `cf-size-experiments`, commit `4d2b704`), plus the two
   link flags (`experiments/cf-size/size-weh-h.yml`). Raise `-sSTACK_SIZE`
   in the same rebuild. Before repinning, run the full b123d-validation
   harness. The suite and the headless gates already pass. Note for
   `smoke.mjs`: its "`evaluating` arrives >100 ms before `done`" check had
   only 14 ms to spare on (b′), because the starter got that fast.
6. **Don't**: `-Oz` (4% smaller, up to 2x slower), exnref (bigger,
   narrower support), or binding pruning until size matters again.

**Needs the user's Cloudflare account** (not run here: no deploys).

7. `npx wrangler deploy --env warm` (or `npx wrangler versions upload
   --env warm`, which does not route traffic). It prints **Worker Startup
   Time** for `BOOT=warm`, which settles whether ~0.3 s locally is under
   1 s on Cloudflare's machines. An over-budget startup fails the upload
   with 10021 rather than breaking traffic.
8. `npx wrangler deploy` (inline layout), then from a cold colo
   `BASE=https://cascade-headless.<sub>.workers.dev node scripts/smoke.mjs`,
   timing the first `/render` client-side. This settles whether inlining
   (4 MB more script, one fetch fewer) beats the 2026-08 3.0 s cold start.
   `node scripts/edge-bench.mjs` re-runs the capability ladder.
9. To know the per-request CPU the edge actually bills: Workers
   Observability, or the dashboard's CPU-time percentiles, for the
   requests in §5.
10. To confirm the Free-plan verdict empirically: deploy `--env warm`
    without `[limits]` to a Free account and watch for error 1102 ("Worker
    exceeded CPU time limit") on everything above a bare box.
11. How the 128 MB is counted: compare the dashboard's isolate memory with
    the V8 heap numbers in §4 on a long-lived isolate.

## 7. Adopted (2026-10-15): native EH by default, 8 MB initial memory, 512 KB stack

The user approved the switch. The fork branch
**`cascadestudio-v3-occt801-wasmeh`** (commit **`99482df`**, pushed and
pinned by CascadeStudio on 2026-10-15) ships two artifact pairs from one binding list:

| artifact | exceptions | wasm | glue | `.d.ts` | role |
|---|---|---:|---:|---|---|
| `cascadestudio.{js,wasm}` | native wasm EH + `-sEXPORT_EXCEPTION_HANDLING_HELPERS` | 19,659,264 B | 125,011 B | byte-identical to shipping, 400 `class Handle_` | **default** everywhere |
| `cascadestudio-jseh.{js,wasm}` | JS-emulated (the old shipping model) | 27,021,699 B | 235,036 B | same | debug / A-B: `?occtexceptions=js` |

Both use `-sINITIAL_MEMORY=8MB -sSTACK_SIZE=512KB`. Only link flags
changed: the default reuses the native-EH object tree, the debug artifact
reuses the shipping JS-EH objects. `buildFromYaml` infers the exception
model from the yml and refuses a contradicting `OCJS_EXCEPTIONS`.

### `-sSTACK_SIZE=512KB`: the 64 KB stack was overflowing

Emscripten places the shadow stack directly above `.data`/`.bss` and lets
it grow down into them, with no check at `-O3`. A canary probe fills the
unused stack before each model and finds the deepest overwritten byte.

**On the shipping 64 KB build** (lite), maker_coin and tea_cup hit the
very bottom, and so did toy_truck and ttt-ppp0110 on upstream. After
tea_cup, `kernelHealthy()` was **false** and its STEP export failed. That
is the COMPROMISE(kernel-heap-reset) symptom: what CascadeStudio had
diagnosed as fillet and ThruSections algorithms scribbling on the heap was
the stack overflowing into OCCT's statics.

**On 1 MB and 512 KB builds**, the high-water over the whole 247-script
0.13 corpus plus the starter (lite, JS EH, 1 MB stack) is **83,248 B**,
from key_cap. The deep models on the final native-EH 512 KB build, both
flavors, peak at 83,552 B (key_cap, upstream); native and JS EH are within
~300 B of each other. Not one kernel ends up unhealthy across the corpus.
Two models that used to fail now work:

- tea_cup exports a 630 KB STEP.
- bicycle_tire exports STEP. It used to be impossible: `BRepTools::Write`
  died after the ThruSections walls.

**Choice: 512 KB**, 6.3x the measured peak. Cost:

- 448 KB more reserved linear memory, of which only the used depth (≤ 82
  KB) is ever touched.
- +448 KB in the retained kernel image, because the image spans the stack
  region: 4.13 MiB against 3.69 MiB.
- ~0.05 ms more per `restoreKernelImage()`.

### `-sINITIAL_MEMORY=8MB`

Footprint of the default build, measured as the last non-zero byte of
linear memory (MiB):

| state | MiB |
|---|---:|
| static data + `.bss` (3,624,654 B) | 3.46 |
| heap base (top of the 512 KB stack, 4,199,808 B) | 4.01 |
| after module init (kernel image #1) | 4.12 |
| after the first Python run (image #2), lite / upstream | 4.13 / 4.19 |
| after Box → STEP | 4.65 / 4.69 |
| after the starter model, lite / upstream | **5.69 / 7.17** |

Every basic request therefore runs **without growing** at 8 MB. 4 MB would
not even hold the boot image. 16 MB would only matter to models that grow
past 32 MB anyway.

### Before/after (Node headless, one engine per flavor)

Models run in sequence in one engine: Box, starter, heat_exchanger, clock,
toy_truck, then heat_exchanger again. The 0.11.1 corpus versions are used,
because the 0.13 clock uses `insert` and lite has no such builder
operation. Cells read `occt wasm MB / main-thread CPU ms`. The machine
was shared and loaded, so compare within a row.

| step | shipping (32 MB, 64 KB, JS EH) | **default** (8 MB, 512 KB, native EH) | **debug** (8 MB, 512 KB, JS EH) |
|---|---|---|---|
| **lite**: boot | 32.0 / 62 | **8.0** / 55 | **8.0** / 73 |
| Box → STEP | 32.0 / 160 | 8.0 / 149 | 8.0 / 191 |
| starter | 32.0 / 300 | 8.0 / **172** | 8.0 / 386 |
| heat_exchanger | 47.6 (8 grows) / 9,127 | 49.1 (36 grows) / **5,451** | 49.1 (36 grows) / 10,697 |
| clock | 47.6 / 4,923 | 49.1 / 4,493 | 49.1 / 5,037 |
| toy_truck (lite's fillet fails, as on every build) | 47.6 / 1,075 | 49.1 / 873 | 49.1 / 1,444 |
| heat_exchanger again | 47.6 / 9,916 | 49.1 / 5,640 | 49.1 / 12,816 |
| **upstream**: boot | 32.0 / 73 | **8.0** / 56 | **8.0** / 63 |
| Box → STEP (incl. library boot) | 32.0 / 748 | 8.0 / 676 | 8.0 / 883 |
| starter | 32.0 / 400 | 8.0 / **227** | 8.0 / 502 |
| heat_exchanger | 147.3 (31 grows) / 44,225 | 145.0 (58 grows) / **28,026** | 145.0 (58 grows) / 41,415 |
| clock | 147.3 / 29,037 | 145.0 / 18,274 | 145.0 / 27,330 |
| toy_truck | 147.3 / 9,446 | 145.0 / 6,177 | 145.0 / 9,527 |

- **Basic-model isolate wasm: 51.5 MB → 27.5 MB** (8.0 OCCT + 19.5
  MicroPython).
- Every model stays geometrically identical (same volumes, same STEP sizes
  apart from header timestamps) and every kernel stays healthy.
- **Growth steps cost nothing measurable.** Interleaved lite
  heat_exchanger, two rounds each: shipping (8 grows) 12.1-12.5 s, debug
  (36 grows) 10.6-13.4 s, default 6.0-6.9 s. Shipping and debug differ
  only in memory and stack settings, and the spread between them is noise.
- Python wasm is unaffected; MicroPython's own arena still doubles.
- The upstream flavor's huge heavy-model numbers are the known MicroPython
  arena ratchet, not OCCT.

### Gates on the new artifacts

| gate | default (native EH) | debug (JS EH) |
|---|---|---|
| `node test/headless-node.mjs` (lite / `CS_PY_SRC=upstream`) | ALL PASS / ALL PASS | ALL PASS / ALL PASS (`CS_OCCT_EXCEPTIONS=js`) |
| new `(d1)` kernel-throw decode (`BRep_API: command not done`, JS mode + Python) | PASS (`getExceptionMessage`) | PASS (raw-pointer decode) |
| `(g)` heal path (now forced deterministically) | PASS, no real damage | PASS, no real damage |
| b123d-validation, Brython + lite, `--pages 2`, vs `baseline-013-lite.json` | **identical: 191/13/34/1/8** (see below) | – |
| b123d-validation, MicroPython + upstream, `--pages 2`, vs `baseline-013-upstream.json` | identical except one run-order flap (see below) | – |
| Playwright full suite (`env -u DISPLAY`, Pyodide fetched so `py-src-real` runs; incl. the new `occt-exceptions.spec.js`) | **105 passed** | **105 passed** with the flag forced (`CS_TEST_OCCT_EXCEPTIONS=js`) |
| `smoke.mjs` vs `wrangler dev` (default / upstream / warm) | **ALL WORKER CHECKS PASSED** ×3 | – (the example ships only the default) |
| `wrangler deploy --dry-run` Total Upload | 25,181.25 KiB lite / 28,409.42 KiB upstream | – |

**Harness details.** The base was the merge of `5a3f9a6`, i.e. the
unchanged 0.11.1-era lite/upstream code the baselines were taken on.

- **Lite:** 190/13/35/1/8 on the first pass. The one delta,
  `docs-selectors/filter_inner_wire_count`, PASS → ERROR, was
  environmental: `/tmp/b123d`, the default `B123D_SRC` clone that the
  harness reads script assets from, no longer exists on this machine, so
  `nema-17-bracket.step` was never delivered. Re-run with
  `B123D_SRC=~/Desktop/build123d` it PASSes. The other asset script,
  `docs/tutorial_joints`, fails `NameError: insert` exactly as in the
  baseline. The lite leg is therefore identical, script for script, to
  `baseline-013-lite.json`.
- **Upstream** (run with the asset clone): 199/6/33/1/8. The one delta is
  `docs-rst/tips/b04`, MISMATCH → PASS. That is the COMPROMISE(traversal-
  order) script whose `sort_by(Axis.Z)` is a complete tie, so OCCT's
  shape-map enumeration, which is pointer-hashed, decides the winner. It
  depends on page history: a solo re-run gives the baseline's MISMATCH
  (`bbox[1] -0.5000 vs -0.7000`). Every other script matches the baseline.
- TIMEOUT on both legs: `docs/spitfire_wing_gordon` (as in the baselines).

### Gates after the merge with `feat/build123d-0.13` (d28c47e)

These ran with the native-EH artifacts copied into `node_modules` (the pin
is unchanged) and Pyodide fetched:

- **Playwright, full suite** (`env -u DISPLAY`): **114 passed**.
- **headless-node**: ALL PASS on lite and upstream with the default
  artifact, and on lite and upstream with the debug artifact
  (`CS_OCCT_EXCEPTIONS=js`).
- **smoke.mjs vs `wrangler dev`**: ALL WORKER CHECKS PASSED on lite,
  upstream, warm and real. Real had one SSE-export failure in its first
  run (the terminal event was `error` at the export phase). It did not
  reproduce in two more full runs, nor in 6 looped smoke sequences in one
  isolate. Logged as a flake.
- **b123d-validation, all four legs**, `--pages 2`,
  `B123D_SRC=~/Desktop/ocjs-deps/src/build123d-v0.13.0`: per script
  **identical** to `results-013-{lite,lite-micropython,upstream,real}.json`
  in one pass (223/9/6/1/8, 223/9/6/1/8, 233/2/3/1/8, 232/3/3/1/8). No
  TIMEOUT flap needed a solo re-run; `tips/b04` happened to match.
  - The stack fix does **not** flip toy_truck or ttt-ppp0110 on lite: both
    fail identically with no overflow.
  - It removes the heap flaps for which the committed lite legs had needed
    solo re-runs: tea_cup(_algebra), key_cap(_algebra), ttt-ppp0102 and
    sort_distance_from. None needed a retry here.

## Reproduce

```bash
# sizes
cd examples/cloudflare-worker && npm ci && npm run prepare-assets
npx wrangler deploy --dry-run --outdir /tmp/dry --env=""         # lite
npx wrangler deploy --dry-run --outdir /tmp/dry-up --env upstream

# startup + per-request CPU through the Worker's own handler (Node)
node scripts/startup-bench.mjs --boot warm
node scripts/startup-bench.mjs --flavor upstream --boot startup

# per-phase engine CPU, corpus models (any dist: CS_DIST=…)
node scripts/cpu-bench.mjs --models examples/boxes_on_faces,ttt/ttt-ppp0101

# workerd heap (wrangler's inspector proxy wants an Origin header)
npx wrangler dev --env warm --port 8793 --inspector-port 9293
#   ws://127.0.0.1:9293/ws, Origin: https://devtools.devprod.cloudflare.dev,
#   Runtime.getHeapUsage

# fork variants (zalo/opencascade.js, branch cf-size-experiments)
experiments/cf-size/run-compile-wasm-eh.sh            # OCCT sources, -fwasm-exceptions
experiments/cf-size/run-link-wasm-eh.sh size-weh-h.yml weh-h
python3 experiments/cf-size/anatomy.py out/weh-h/cascadestudio.wasm out/weh-h/cascadestudio.js.symbols
```

Machine notes: on Python 3.14 the fork's build scripts need
`multiprocessing.set_start_method('fork')` (3.14's `forkserver` default
re-executes their module-level pipeline). The experiments used a private
venv with a `sitecustomize.py` for that. The shared
`~/Desktop/ocjs-deps/pyenv` is a 3.12 venv whose interpreter is gone
since the system moved to 3.14, so `run-build.sh` as written no longer
starts.
