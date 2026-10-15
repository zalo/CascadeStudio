# The high-fidelity build123d flavors on Cloudflare Workers

*2026-10-15, branch `feat/cf-fidelity-flavors`. Lane: getting the two
high-fidelity flavors — **upstream** (build123d's own Python, verbatim, on
the custom MicroPython) and **real** (the unmodified PyPI wheel + real numpy
on Pyodide/CPython 3.14) — to fit Cloudflare's limits. Memory first, then
size and startup.*

*Everything was measured locally: workerd (`wrangler dev`, wrangler 4.125.0)
or plain Node. Nothing was deployed. The questions only the edge can settle
are listed in §6, with the command that would settle each.*

*Sections 1-5 were measured on build123d **0.11.1**. The branch has since
merged `feat/build123d-0.13`, and the headline numbers were re-measured on
**0.13.0** right below. The mechanisms and fixes are version-independent:
they live in the interpreter, the shim and the host.*

## Re-measured on build123d 0.13.0 (after the merge)

The headless corpus ran in Node with a fresh engine per script; peaks are
`occtWasm + pythonWasm`. The workerd totals add the V8 live heap (after GC,
via the inspector) and V8's ArrayBuffer backing stores.

| | upstream 0.13.0 | real 0.13.0 |
|---|---|---|
| classification (headless) | 232/3/3/1 of 239. The browser baseline is 233/2/3/1. The one difference, `docs-rst/tips/b04`, is a complete-tie `sort_by` that also mismatches headless on the pure `feat/build123d-0.13` build, the stock interpreter and leak mode, so it does not come from this branch. | 232/3/3/1, **0 differences** from `results-013-real.json` |
| corpus models under 128 MB of wasm | **237 / 238** (only `bracelet`, 179.9) | **237 / 238** (only `bracelet`, 163.8) |
| median | 38.0 MB | 83.9 MB (the floor) |
| `heat_exchanger` (wasm, Node) | 69.9 | 104.4 |
| `bicycle_tire` / `clock` / `toy_truck` | 40.4 / 38.0 / 38.0 | 83.9 each |
| `projection` / `_algebra` | 105.6 / 87.8 (were 126.1 / 115.9 on 0.11.1) | 89.1 / 89.1 |
| workerd starter, wasm + V8 / **+ ArrayBuffers** | 56.8 / **66.7** | 113.6 / **133.3** |
| workerd `maker_coin` | 73.2 / **83.1** | 124.9 / **144.6** |
| workerd `heat_exchanger` | 116.2 / **126.1** (OCCT 90.3 in workerd vs 63.9 in Node: GC timing against the kernel's transient puts it a growth step higher) | 140.1 / **159.8** |
| workerd `toy_truck` / `clock` / `bicycle_tire` | 67.9 / 73.3 / 69.4 | — |

**Verdict on 0.13.0:**

- **Upstream:** fits for everything except `bracelet`. `heat_exchanger` now
  sits at 126 MB in workerd once ArrayBuffers are counted, so it is
  borderline.
- **Real:** fits the 64 MiB size limit. Basic models are 114 MB on wasm + V8
  heap, but 133 MB with ArrayBuffers counted, so whether it fits depends on
  the edge accounting question in §6.

Raw data: `experiments/cf-fidelity/corpus-013-*.json` and
`workerd-ladder-013.json`.

## Verdict (measured on 0.11.1; see the 0.13.0 table above)

| flavor | fits 64 MiB script? | fits 128 MB isolate? | cold first render | corpus |
|---|---|---|---|---|
| **upstream** (MicroPython) | yes — 28,342 KiB, unchanged | **yes**: 220/221 corpus models on wasm (was 210/221). On wasm + V8 heap + ArrayBuffers in workerd, every heavy model measured fits on a fresh isolate (`heat_exchanger` 95.7, `bicycle_tire` 68.9, `toy_truck` 67.2, `clock` 74.8 MB) except `projection` (+`_algebra`) and `bracelet`. | 1.2 s local | 216/2/3/1, per-script identical |
| **real** (Pyodide) | **yes — 48,745 KiB** (47.6 MiB) | **borderline**: 220/221 on wasm (floor 83.9 MB: OCCT 32 + Pyodide 51.9). In workerd, basic and mid-size models are 112-125 MB on wasm + V8 heap, but 132-144 MB once V8's ArrayBuffers (MEMFS, kernel image, fonts) count too. `heat_exchanger` is over either way. | 1.85 s local | 216/3/2/1, per-script identical |
| Cloudflare **Python Workers** | — | — | — | **blocked**: a Python Worker cannot reach a bundled JS or wasm module, and cannot compile wasm or evaluate JS, so the OCCT kernel cannot live in its isolate |

What changed to get there, in order of size of effect:

1. **The MicroPython "arena ratchet" was not retention.** The stock pyscript
   interpreter never garbage-collects inside a top-level call. A new
   interpreter patch makes collection work at any depth (+27% wasm). The
   upstream flavor's interpreter heap now tracks live data (1-3 MB) instead
   of everything a run ever allocated (up to 612 MB).
2. With collections happening mid-run, **MicroPython's JsProxy finalisers now
   free OCCT objects**. This gives the MicroPython leg the embind lifetime
   that the Pyodide leg gets from `__del__`. A shim bug that had kept every
   `GeomAPI_*` value object alive was also fixed: `bicycle_tire`'s OCCT heap
   was 2.3 GB and is now 32 MB.
3. **The JS heap had ~50 MB of avoidable weight.** On upstream after the
   starter model, the V8 live heap fell from 71 MB to 18.9 MB:
   - Wrangler's default `keep_names` gave each of ~216k embind closures its
     own property store.
   - Four parsed fonts sat in memory that most models never use.
   - The 3 MB Python source map stayed alive after boot.
4. **The MicroPython reservation shrank from 16.3 MiB to 6 MiB.** That is
   interpreter patch 12, together with a 4 MiB initial GC heap.
5. **Real build123d boots in workerd from module bindings only.** It needs
   three surgical patches to Pyodide's glue, and nothing is compiled at
   runtime.

## The limits as of 2026-10-15

From <https://developers.cloudflare.com/workers/platform/limits/>, last
updated 2026-10-12:

| limit | Free and Paid |
|---|---|
| Worker size | **64 MiB uncompressed**. There is no compressed limit any more. |
| Memory | **128 MB per isolate**, "including the JavaScript heap and WebAssembly allocations" |
| Startup | 1 s to parse and execute the global scope |
| CPU per HTTP request | 10 ms on Free; up to 5 min on Paid (default 30 s) |

Code generation is also restricted: `WebAssembly.compile`, `new
WebAssembly.Module(bytes)`, `eval` and `new Function` all throw. Wasm arrives
only as `CompiledWasm` module bindings. This was verified in local workerd:
`Wasm code generation disallowed by embedder` and `Code generation from
strings disallowed for this context`.

## 1. The MicroPython arena (upstream flavor)

### Root cause

`ports/webassembly/main.c` in MicroPython 1.28 does the following for the
pyscript variant (`MICROPY_GC_SPLIT_HEAP_AUTO`):

```c
// Don't collect anything.  Instead require the heap to grow.
void gc_collect(void) { gc_collect_pending = true; }
// Collect at the top-level, where there are no root pointers from stack/registers.
static void gc_collect_top_level(void) { ... }   // runs when external_call_depth hits 0
```

A collection deep inside a call cannot see the GC roots that suspended C
frames keep in **wasm locals and on the wasm operand stack**. Those live
outside linear memory, so a memory scan misses them. The port therefore
defers every collection until control returns to JavaScript.

For us, a whole model evaluation is ONE top-level call (`runPython`).
Nothing is collected until it returns, and `gc_try_add_heap` keeps adding
areas, doubling the total each time. So the "arena" was simply **every byte
the run allocated**:

- The ~32-230 B "retention per dispatch" was garbage, not retention.
- The "~1 MB live afterwards" was the top-level collect finally running.
- `gc.collect()` and `gc.threshold()` were no-ops for the same reason. This
  also explains the earlier observation that "verified running, 32x/run,
  changes nothing".

A 300k-iteration allocation loop in one `runPython` makes the point. The
heap ends at 64.3 MB on the stock interpreter and 16.3 MB on the patched one
(`mem_alloc` 1.07 MB).

### The fix: interpreter patch 11

`zalo/micropython` fork, branch `cs-gc-incremental`, commit `8a616fb`:
"webassembly: Collect garbage during execution in the pyscript variant".

The roots are made visible at link time instead of deferring collection:

```make
JSFLAGS += -s BINARYEN_EXTRA_PASSES=--flatten,--coalesce-locals,--spill-pointers,-Os
JSFLAGS += -s STACK_SIZE=128KB
```

`gc_collect()` then does `gc_collect_start(); emscripten_scan_stack(...);
gc_collect_end();`, a conservative C-stack scan like a bare-metal port's
(`MICROPY_GC_SCAN_SPILLED_STACK`). Each pass has a job:

- **`--flatten`** puts every intermediate value in a local. Without it,
  values LLVM leaves on the operand stack across a call stay invisible. For
  example, the result of `f(new_a(), new_b())`'s first allocation is in
  flight while the second allocates. Spill-only is therefore unsound.
- **`--coalesce-locals`** is needed because spill-pointers reserves one
  spill slot per pointer-sized local. Uncoalesced, the frames are so large
  that `import os` hits the recursion limit (measured).
- **`--spill-pointers`** stores every live pointer local to the C stack
  before each call.
- The trailing **`-Os`** re-optimises. Spill stores are memory writes, and
  Binaryen has no linear-memory dead-store elimination, so they survive.

| | stock pyscript | **patch 11** | Asyncify + `emscripten_scan_registers` (the standard variant's way) | spill-only | flatten+spill, no coalesce |
|---|---|---|---|---|---|
| wasm | 486 KB | **617 KB (+27%)**, 235 KB gz | 1282 KB (+164%) | 686 KB | 1081 KB |
| sound | (no in-run GC) | yes | yes | **no** (operand stack) | yes |
| alloc loop, 300k iterations | 343 ms, 64.3 MB heap | **352-359 ms, 16.3 MB** | broke deep recursion | 378 ms | `import os` fails |
| recursion depth | 91 (pystack-bound) | **91** (C stack raised to keep it) | — | 68 | — |

Rejected options:

- **Disposing and re-instantiating the interpreter between requests** bounds
  nothing *within* a run. The ratchet was per run, not per isolate.
- **A hard cap with collect-before-grow** is impossible without seeing the
  roots, which is the whole problem.

### Using the collections: embind lifetime, heap size, and a shim bug

- **JsProxy death frees OCCT objects.** MicroPython keeps ONE JsProxy per JS
  object, and its finaliser deletes the object from the port's global
  `proxy_js_ref_map`. `MicroPythonRuntime.js installProxyFreeHook()` wraps
  that Map's `delete`, which has one caller. `OcpShim.js _csOcpRelease()`
  queues the embind object, and the queue is flushed at the next dispatch
  entry. That is a safe point, because every argument is still held by a
  live proxy. The release runs from inside a GC, so it only queues.
- **`canDelete()` no longer refuses known value types.** The name guard
  `/^Geom/` stopped every `GeomAPI_*`/`Geom2dGcc_*`/`GeomConvert_*` object
  from ever being deleted, on Pyodide too. It now applies only to classes the
  binding table has no inheritance chain for, since classes it knows are
  transient are already caught by the chain check. `bicycle_tire` had kept
  8,685 `GeomAPI_ProjectPointOnSurf` objects with their Extrema sampling
  grids alive: OCCT 2347 MB → 115 MB.
- **Smaller heap, plus `gc.threshold(4 MB)`.** A collection is what finalises
  proxies, so the GC heap size sets how much dead OCCT data piles up between
  collections. Measured OCCT high-water at a 16 / 8 / 4 MB heap:
  `bicycle_tire` 115.3 / 55.1 / 52.5 MB, and `projection` 179.1 / 109.8 /
  77.9 MB. With the 4 MB heap plus the threshold, `bicycle_tire` is 32.0 MB
  and eval times are unchanged.
- **Interpreter patch 12** (`3647b6a`) starts linear memory at 6 MiB instead
  of emscripten's 16 MiB default, because live Python after loading the
  library is 0.8 MB (lite) / 1.15 MB (upstream). Memory growth stays on.
  `pythonWasm` for a basic model went from 19.5 to 16.3 to **6.0 MiB**.
- **The same reserved-but-untouched pattern exists in OCCT.** The kernel
  links with `-sINITIAL_MEMORY=32MB` (`(memory 512 …)`), but its boot image
  is ~3.7 MB (the COMPROMISE(kernel-heap-reset) snapshot size). Shrinking it
  needs a fork relink and is out of this lane; it is recorded here. (Since
  done: the fork's native-EH artifacts link `-sINITIAL_MEMORY=8MB`, see
  SIZE-INVESTIGATION.md §7.)
  Pyodide's `pyodide.asm.wasm` declares 30 MiB (`(memory 480 …)`) and grows
  to 51.9 MB after `import build123d`.

### Results: corpus high-water

Headless Node, a fresh engine per script, `occtWasm + pythonWasm`. Wasm
memories only grow, so the size after the run is the peak.
`experiments/cf-fidelity/headless-corpus.mjs`; JSON in
`experiments/cf-fidelity/corpus-*.json`.

**upstream**, before → after:

| model | before (occt + mp) | after (occt + mp) |
|---|---:|---:|
| `bicycle_tire` | 3009.7 (2539.3 + 470.4) | **48.3** (32 + 16.3) |
| `heat_exchanger` | 733.1 (121.1 + 612) | **71.4** (55.1 + 16.3) |
| `clock` | 494.2 (32 + 462.2) | **48.3** |
| `algebra_performance/all` | 464.3 (154.7 + 309.6) | **48.3** |
| `algebra_performance/b01` | 456.9 | **48.3** |
| `bracelet` | 201.9 (182.4 + 19.5) | 190.2 (173.9 + 16.3) |
| `projection` | 198.6 (179.1 + 19.5) | **126.1** (109.8 + 16.3) |
| `toy_truck` | 168.7 (39.6 + 129.1) | **48.3** |
| `group_axis` | 161.2 | **48.3** |
| `heat_exchanger_algebra` | 159.8 | **86.9** |
| corpus models under 128 MB | 210 / 221 | **220 / 221** |
| median | 51.5 | 48.3 |
| sum of eval times | 795 s | 779 s |
| classification | 216/2/3/1 | **216/2/3/1, 0 per-script differences** |

These are the 16.3 MB-interpreter (pre-patch-12) "after" figures. With
patch 12 every `+ 16.3` becomes `+ 6.0` to `+ 8.4`: `heat_exchanger` 63.5,
`clock`/`bicycle_tire` 40.4, `toy_truck` 38.0.

**lite** (same interpreter, same patches):

| model | before | after |
|---|---:|---:|
| `bicycle_tire` | 150.9 (85.9 + 65) | **94.3** (85.9 + 8.4) |
| `bracelet` | 112.9 | 99.4 |
| `Buffer_Stand` | 109.3 (32 + 77.3) | **38.0** |
| `heat_exchanger` | 82.1 | 53.1 |
| `maker_coin` | 70.8 | 38.0 |
| corpus models under 128 MB | 220 / 221 | **221 / 221** (peak 99.4) |
| median | 51.5 | **38.0** |
| classification | 206/10/5/1 | 206/10/5/1, 0 differences |

**real** (Pyodide, headless through the same host seam as the Worker):
216/3/2/1, with 0 per-script differences against
`experiments/pyodide-real/pysrc-real-results.json`. Floor 83.9 MB; peak
`bracelet` 162.6 (110.6 + 51.9); `heat_exchanger` 107.1. 220/221 models are
under 128 MB on wasm.

## 2. The JS heap (all flavors) — measured in workerd

Cloudflare counts the JavaScript heap together with the wasm memories. The
V8 heap was read through `wrangler dev`'s inspector by
`experiments/cf-fidelity/workerd-ladder.mjs`:

- **`Runtime.getHeapUsage`** gives the heap as the request left it. The
  inspector never answers `HeapProfiler.collectGarbage`, so a heap snapshot,
  which forces a full GC, is used to get the live figure.
- **The inspector target is verified to be this worker.** Other projects'
  `wrangler dev` share this machine and the default port 9229; an earlier
  "12 MB" reading came from someone else's isolate.

Upstream flavor, V8 heap after the starter model, from the snapshot
attribution:

| state | V8 live heap |
|---|---:|
| `/health` only (boot, no Python), original | 71.1 MB |
| + `keep_names = false` (wrangler re-bundles with esbuild's keepNames on by default; `__name()` gave ~216k embind invoker closures each a property store) | ~47 MB |
| + lazy font parsing (`CascadeWorker._loadFonts`, headless asset path; the four FreeSans faces' glyph objects and kern maps) and releasing the Python source map after boot | **18.9 MB** |

What remains:

- Script source: 2.65 MB.
- OCCT embind classes and accessors: roughly 10 MB.
- OCP shim tables.
- Interpreter glue.
- Outside the V8 heap but inside the isolate, ~10 MB of ArrayBuffer backing
  stores: the 3.75 MB kernel image and the 4.1 MB of font bytes.

The same keepNames waste exists in cascade-core's own headless bundle: Node
heap after engine boot fell from 125.8 to 73.0 MB, and keepNames is now off
in `build-headless.cjs`. The browser worker bundle (`build.cjs
--keep-names`) carries it too. That is noted but not changed here, since the
browser is not this lane.

### Combined peak per model (wasm + live V8 heap)

Local workerd, `--mode fresh` (a new isolate per model) and `--mode
sequence` (one isolate, in order). Combined = `occtWasm + pythonWasm` + V8
live heap after GC. Add ~10 MB for ArrayBuffer backing stores if Cloudflare
counts those as well; that is an edge question, see below. Raw rows are in
`experiments/cf-fidelity/workerd-ladder.json`.

Two totals are shown. **wasm + V8** counts every wasm memory plus the V8
live heap. **+ ArrayBuffers** adds V8's backing-store memory:

- the 3.75 MB kernel image;
- the 4.1 MB of font bytes;
- for the real flavor, Pyodide's MEMFS (stdlib zip, unpacked wheels) and
  its Data bindings, 19.2 MB in total.

Which of the two Cloudflare enforces is the first edge question in §6. The
2026-08 edge evidence suggests it is not even the smaller one.

**How each flavor stands:**

- **Upstream, fresh isolate:** every heavy model measured is under 128 MB on
  both totals, including `heat_exchanger` (95.7), `bicycle_tire` (68.9),
  `toy_truck` (67.2) and `heat_exchanger_algebra` (124.9). Over:
  `projection`/`_algebra` (145-150) and `bracelet` (208). In 2026-08 the
  edge 503'd `clock`, `heat_exchanger`, `bicycle_tire` and `toy_truck`.
- **Upstream, one isolate:** the OCCT high-water carries over. The sequence
  stays under 128 MB through `heat_exchanger` (113.5). After
  `heat_exchanger_algebra` (OCCT 90.3) every following request is over.
- **Lite:** everything measured is under 128 on a fresh isolate, `bracelet`
  123.2 being the worst. Lite `bicycle_tire` was the known
  COMPROMISE(kernel-heap-reset) STEP 422, not a memory failure — a
  shadow-stack overflow on the 64 KB-stack build; it exports on the fork's
  512 KB-stack artifacts (SIZE-INVESTIGATION.md §7). In one
  isolate the sequence stays under through `heat_exchanger` (118.2) and
  crosses at `bicycle_tire` (OCCT 85.9).
- **Real:** every basic and mid-size model is under 128 on wasm + V8
  (112.5-124.6), but over once the ArrayBuffers are added (131.7-143.8). Its
  floor is the 51.9 MB Pyodide heap plus a ~29 MB V8 heap.
  `heat_exchanger` is over either way.

**upstream fresh** (a new isolate per model)

| model | HTTP | round trip | OCCT | Python | V8 live | ArrayBuffers | wasm + V8 | **+ ArrayBuffers** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 200 | 1.2 s | 32 | 6 | 18.1 | 9.7 | 56.1 | **65.8** |
| boxes_on_faces | 200 | 0.9 s | 32 | 6 | 17.4 | 9.7 | 55.4 | **65.1** |
| ttt-24-SPO-06-Buffer_Stand | 200 | 2.9 s | 32 | 6 | 18.3 | 9.7 | 56.3 | **66** |
| maker_coin | 200 | 9.3 s | 32 | 6 | 29.4 | 9.7 | 67.4 | **77.1** |
| toy_truck | 200 | 9.3 s | 32 | 6 | 19.5 | 9.7 | 57.5 | **67.2** |
| clock | 200 | 19.7 s | 32 | 8.4 | 24.7 | 9.7 | 65.1 | **74.8** |
| heat_exchanger | 200 | 50.2 s | 57.9 | 8.4 | 19.7 | 9.7 | 86 | **95.7** |
| heat_exchanger_algebra | 200 | 24.9 s | 90.3 | 6 | 18.9 | 9.7 | 115.2 | **124.9** |
| bicycle_tire | 200 | 93.0 s | 32 | 8.4 | 18.8 | 9.7 | 59.2 | **68.9** |
| projection | 200 | 17.9 s | 104.6 | 6 | 30.1 | 9.7 | 140.7 ✗ | **150.4** ✗ |
| projection_algebra | 200 | 18.0 s | 99.6 | 6 | 29.6 | 9.7 | 135.1 ✗ | **144.8** ✗ |
| algebra_performance/all | 200 | 18.3 s | 32 | 6 | 17.8 | 9.7 | 55.8 | **65.5** |
| bracelet | 200 | 48.5 s | 173.9 | 6 | 18.8 | 9.7 | 198.7 ✗ | **208.4** ✗ |

**upstream sequence** (ONE isolate, in this order)

| model | HTTP | round trip | OCCT | Python | V8 live | ArrayBuffers | wasm + V8 | **+ ArrayBuffers** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 200 | 1.2 s | 32 | 6 | 18.1 | 9.7 | 56.1 | **65.8** |
| boxes_on_faces | 200 | 0.2 s | 32 | 6 | 18.6 | 9.7 | 56.6 | **66.3** |
| ttt-24-SPO-06-Buffer_Stand | 200 | 2.2 s | 32 | 6 | 18.8 | 9.7 | 56.8 | **66.5** |
| maker_coin | 200 | 8.6 s | 32 | 6 | 29.8 | 9.7 | 67.8 | **77.5** |
| toy_truck | 200 | 8.6 s | 32 | 6 | 30.6 | 9.7 | 68.6 | **78.3** |
| clock | 200 | 22.1 s | 32 | 6 | 36.6 | 9.7 | 74.6 | **84.3** |
| heat_exchanger | 200 | 47.2 s | 57.9 | 8.4 | 37.5 | 9.7 | 103.8 | **113.5** |
| heat_exchanger_algebra | 200 | 22.1 s | 90.3 | 8.4 | 36.8 | 9.7 | 135.4 ✗ | **145.1** ✗ |
| bicycle_tire | 200 | 94.0 s | 90.3 | 8.4 | 37.2 | 9.7 | 135.8 ✗ | **145.5** ✗ |
| projection | 200 | 19.5 s | 121.1 | 8.4 | 37.1 | 9.7 | 166.6 ✗ | **176.3** ✗ |
| projection_algebra | 200 | 18.1 s | 121.1 | 8.4 | 37.1 | 9.7 | 166.6 ✗ | **176.3** ✗ |
| algebra_performance/all | 200 | 18.9 s | 121.1 | 8.4 | 37.8 | 9.7 | 167.3 ✗ | **177** ✗ |
| bracelet | 200 | 45.0 s | 121.1 | 8.4 | 37.4 | 9.7 | 166.9 ✗ | **176.6** ✗ |

**real fresh** (a new isolate per model)

| model | HTTP | round trip | OCCT | Python | V8 live | ArrayBuffers | wasm + V8 | **+ ArrayBuffers** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 200 | 3.7 s | 32 | 51.9 | 29.2 | 19.2 | 113.2 | **132.4** ✗ |
| boxes_on_faces | 200 | 2.7 s | 32 | 51.9 | 28.6 | 19.2 | 112.5 | **131.7** ✗ |
| ttt-ppp0101 | 200 | 3.9 s | 32 | 51.9 | 29.8 | 19.2 | 113.7 | **132.9** ✗ |
| intersecting_pipes | 200 | 4.9 s | 32 | 51.9 | 29.5 | 19.2 | 113.4 | **132.6** ✗ |
| ttt-24-SPO-06-Buffer_Stand | 200 | 4.6 s | 32 | 51.9 | 29.5 | 19.2 | 113.5 | **132.7** ✗ |
| maker_coin | 200 | 12.8 s | 32 | 51.9 | 40.7 | 19.2 | 124.6 | **143.8** ✗ |
| toy_truck | 200 | 9.5 s | 32 | 51.9 | 30.7 | 19.2 | 114.6 | **133.8** ✗ |
| clock | 200 | 14.1 s | 32 | 51.9 | 35.8 | 19.2 | 119.8 | **139** ✗ |
| heat_exchanger | 200 | 39.8 s | 57.9 | 51.9 | 30.4 | 19.2 | 140.3 ✗ | **159.5** ✗ |

**real sequence** (ONE isolate, in this order)

| model | HTTP | round trip | OCCT | Python | V8 live | ArrayBuffers | wasm + V8 | **+ ArrayBuffers** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 200 | 3.0 s | 32 | 51.9 | 29.3 | 19.2 | 113.2 | **132.4** ✗ |
| boxes_on_faces | 200 | 0.3 s | 32 | 51.9 | 29.5 | 19.2 | 113.5 | **132.7** ✗ |
| ttt-ppp0101 | 200 | 1.5 s | 32 | 51.9 | 30.1 | 19.2 | 114 | **133.2** ✗ |
| intersecting_pipes | 200 | 1.6 s | 32 | 51.9 | 30.2 | 19.2 | 114.1 | **133.3** ✗ |
| ttt-24-SPO-06-Buffer_Stand | 200 | 1.6 s | 32 | 51.9 | 30.3 | 19.2 | 114.2 | **133.4** ✗ |
| maker_coin | 200 | 11.0 s | 32 | 51.9 | 41.3 | 19.2 | 125.3 | **144.5** ✗ |
| toy_truck | 200 | 8.1 s | 32 | 51.9 | 41.8 | 19.2 | 125.8 | **145** ✗ |
| clock | 200 | 9.5 s | 32 | 51.9 | 47.6 | 19.2 | 131.6 ✗ | **150.8** ✗ |
| heat_exchanger | 200 | 35.2 s | 57.9 | 51.9 | 48.5 | 19.2 | 158.4 ✗ | **177.6** ✗ |

**lite fresh** (a new isolate per model)

| model | HTTP | round trip | OCCT | Python | V8 live | ArrayBuffers | wasm + V8 | **+ ArrayBuffers** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 200 | 0.8 s | 32 | 6 | 14.7 | 8.5 | 52.7 | **61.2** |
| boxes_on_faces | 200 | 0.4 s | 32 | 6 | 14.1 | 8.5 | 52.1 | **60.6** |
| ttt-24-SPO-06-Buffer_Stand | 200 | 1.9 s | 32 | 6 | 15.9 | 8.5 | 53.9 | **62.4** |
| maker_coin | 200 | 10.0 s | 32 | 6 | 26.6 | 8.5 | 64.6 | **73.1** |
| clock | 200 | 4.5 s | 32 | 16.7 | 25.1 | 8.5 | 73.8 | **82.3** |
| extrude | 200 | 5.6 s | 55.1 | 6 | 26.6 | 8.5 | 87.8 | **96.3** |
| heat_exchanger | 200 | 22.7 s | 47.6 | 10.1 | 18.5 | 8.5 | 76.2 | **84.7** |
| bicycle_tire | 422 | 78.2 s | 85.9 | 8.4 | 19.5 | 8.5 | 113.8 | **122.3** |
| bracelet | 200 | 50.7 s | 93.4 | 6 | 15.4 | 8.5 | 114.7 | **123.2** |

**lite sequence** (ONE isolate, in this order)

| model | HTTP | round trip | OCCT | Python | V8 live | ArrayBuffers | wasm + V8 | **+ ArrayBuffers** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 200 | 0.8 s | 32 | 6 | 14.7 | 8.5 | 52.7 | **61.2** |
| boxes_on_faces | 200 | 0.2 s | 32 | 6 | 15 | 8.5 | 53 | **61.5** |
| ttt-24-SPO-06-Buffer_Stand | 200 | 1.6 s | 32 | 6 | 16.3 | 8.5 | 54.3 | **62.8** |
| maker_coin | 200 | 9.9 s | 32 | 6 | 27.1 | 8.5 | 65.1 | **73.6** |
| clock | 200 | 4.1 s | 32 | 16.8 | 36.6 | 8.5 | 85.3 | **93.8** |
| extrude | 200 | 5.0 s | 55.1 | 16.8 | 34.6 | 8.5 | 106.5 | **115** |
| heat_exchanger | 200 | 21.6 s | 55.1 | 16.8 | 37.9 | 8.5 | 109.7 | **118.2** |
| bicycle_tire | 422 | 73.1 s | 85.9 | 16.8 | 39 | 8.5 | 141.6 ✗ | **150.1** ✗ |
| bracelet | 200 | 45.3 s | 94.8 | 16.8 | 35.3 | 8.5 | 146.8 ✗ | **155.3** ✗ |



## 3. Real build123d on Workers (Pyodide)

**Real build123d runs in workerd.** `--env real` (entry `src/real.js`)
passed `scripts/smoke.mjs` with ALL WORKER CHECKS PASSED, and
`sort_axis`/`ppp0110` return the native volumes.

### What was in the way, and the fix for each

| obstacle | where | fix |
|---|---|---|
| `pyodide.mjs` `import()`s `pyodide.asm.mjs` by URL | loader | `loadPyodide({createPyodideModule})`, using the statically imported factory (a public option) |
| `pyodide.asm.wasm` compiled from bytes (`instantiateStreaming`/`instantiate(bytes)`) | loader's `instantiateWasm` | wrap the factory and replace `settings.instantiateWasm` with `WebAssembly.instantiate(<CompiledWasm Module>)`, adding the two `Jsv*` imports' pure-JS fallback |
| `addFunction()` → `convertJsFunctionToWasm()` compiles a tiny module **per signature**. dylink does this for GOT entries satisfied by JS functions, starting with the main module at boot. | `pyodide.asm.mjs` | **glue patch 3**: look the signature up in precompiled modules, i.e. 28 `sig/<sig>.wasm` CompiledWasm bindings recorded by `experiments/cf-fidelity/pyodide-workerd/record-sigs.mjs` (`scripts/pyodide-sigs.json`) |
| numpy's 13 `.so` side modules: `loadWebAssemblyModule(bytes)` → `WebAssembly.instantiate(bytes)` | dylink | **glue patch 1**: `loadLibData()` hands dylink a precompiled `WebAssembly.Module` keyed by `.so` basename, and dylink already accepts a Module. The wheel ships as `numpy-lite.zip` with 0-byte `.so` placeholders, because dlopen must still *find* the path. `tests/` is dropped. |
| CPython's call trampoline is built from a hex string at boot | `getWasmTrampolineModule` | **glue patch 2**: a precompiled `pyemtrampoline.wasm`. Without it the glue falls back to the slower JS trampoline, so this patch is for speed, not correctness. |
| Emscripten's setImmediate polyfill adds a *capturing* `message` listener ("useCapture must be false") | glue | define `setImmediate` before boot |
| `new URL(x, location)`, plus `fetch(python_stdlib.zip)` | loader | a `location` base and a fetch shim that answers that one URL from a `Data` binding |
| `eval` in the glue | EM_ASM/EM_JS of side modules, `emscripten_run_script`, `loadScript` | never reached. numpy's side modules carry no EM_ASM/EM_JS (checked). |
| `nodejs_compat` | — | stays off (Pyodide 314 has an `IN_WORKERD` branch) |

`scripts/prepare-pyodide.mjs` applies the three glue patches and asserts
that each applies exactly once. The host seam in cascade-core is
`createHeadlessCascade({runtime: 'pyodide', pySrc: 'real', pyodide: {boot,
installWheels}, upstreamPy})`. That seam is also how the corpus ran
headless, with the identical classification above.

### Size

Dry run, not deployed: `wrangler deploy --dry-run --env real`.

| | |
|---|---:|
| `cascadestudio.wasm` | 27.02 MB (25.77 MiB) |
| `pyodide.asm.wasm` | 9.60 MB |
| numpy side modules (13) | 5.15 MB |
| `python_stdlib.zip` | 2.55 MB |
| `pyodide.asm.mjs` (patched) | 1.25 MB |
| wheels (numpy-lite, pruned of stubs/headers/f2py/testing, + build123d + anytree + webcolors + trianglesolver + typing_extensions) | 1.35 MB |
| engine bundle + glue | ~1.5 MB |
| **Total Upload** | **48,745 KiB of 65,536 KiB** (gzip 17,977 KiB, which no longer matters) |

Fonts and the Python text were static assets on this branch. After the merge with `feat/cf-workers-size` every entry carries them as modules (SIZE-INVESTIGATION.md), and the real script is 48,648 KiB with the 8 MB native-EH OCCT artifact.

### Startup and memory

| | |
|---|---|
| global scope | imports only; boot is lazy, on the first request |
| cold first `/render` | **1.85 s** locally: Pyodide init 0.93 s, `import build123d` + shim 0.82 s |
| warm starter | 425 ms (smoke (b)) |
| wasm after any model | OCCT 32.0 + Pyodide **51.9** = 83.9 MB (Pyodide declares 30 MiB) |

The real flavor's wasm floor is 83.9 MB, against 38 MB for upstream. On
top of it sit a ~29 MB V8 heap and 19.2 MB of ArrayBuffers (pruning numpy's
stubs, headers, f2py and testing saved 2.8 MB of the latter, with the
classification unchanged). That is the whole margin.

Further cuts would be:

- the stdlib zip is held twice (the Data binding plus its MEMFS copy),
  2.5 MB;
- lazily importing numpy submodules;
- shrinking Pyodide's heap, a Pyodide rebuild.

None is done; see the ladder table.

## 4. Cloudflare's own Python Workers

These were probed in local workerd (`experiments/cf-fidelity/python-worker/`,
compatibility date 2026-08-27, `python_workers` +
`disable_python_external_sdk`). The platform runs **Pyodide 314.0.4 /
Python 3.14.2** — the same version as ours. The results:

- A bundled `.mjs` with an `ESModule` rule is not importable from Python, and
  its top level never runs.
- A `.wasm` with a `CompiledWasm` rule is not importable either. The only
  file mounted in `/session/metadata` is `entry.py`.
- `WebAssembly.Module(bytes)` → `Wasm code generation disallowed by
  embedder`.
- `pyodide.code.run_js` → `EvalError: Code generation from strings
  disallowed`.

workerd's Pyodide loads numpy's side modules through an internal capability
that user code does not have. **So the OCCT kernel (25.8 MiB wasm + embind
JS) cannot be loaded into a Python Worker's isolate.**

- A service binding to a JS Worker that owns the kernel would turn each OCP
  call into a cross-isolate RPC. Heavy models make ~10⁶ of them, so that is
  not viable.
- Python Workers' deploy-time memory snapshots therefore cannot help us.
- Doing the equivalent ourselves (a Pyodide `_makeSnapshot` after `import
  build123d`) would be a ~52 MB Data module. It would not fit next to the
  kernel under 64 MiB.

The JS Worker with our own Pyodide (section 3) is the only route, and it
works.

## 5. Upstream flavor: size and startup

| | today |
|---|---|
| script | the same 28,342 KiB script as lite (the Python is a static asset) |
| `py/upstream-b123d.json` | 3.15 MB raw / 0.40 MB gz, fetched once at boot |
| Python actually loaded | 155 modules, 1.66 MB of *transformed* source |
| library load (`libMs`, Node) | 575-822 ms (machine load varies) |
| cold first `/render` (local workerd) | 1.22 s |

**Precompiled `.mpy` (mpy-cross, same tree, mpy v6.3).** This was measured
end to end, not shipped; see `experiments/cf-fidelity/mpy/`.

| | `.py` | `.mpy` |
|---|---:|---:|
| bytes | 1,736,145 | **518,363 (−70%)** |
| gzip of the tree | 409 KB | 283 KB |
| `compile()` of all 155 on the wasm interpreter | 340 ms | 0 |
| library boot (`libMs`, 3 runs each) | 571-577 ms | **270-281 ms (−52%)** |

`Box` round-trips identically. Shipping it means two things:

- A build step: boot upstream in Node, dump the loader's transformed `/lib`,
  run mpy-cross, and emit a map.
- A loader switch: write the `.mpy` into MEMFS, and have
  `_cs_register_module` skip the `.py` write when a `.mpy` exists.

The `.mpy` must be regenerated whenever the vendored source, the transforms
or the interpreter's mpy version change, so it needs a version stamp. That
is **not done**: it touches the loader and the build of every upstream
consumer. **Frozen modules** compiled into the interpreter would save the
same compile time and also skip MEMFS. The cost is that the 1.7 MB of source
would move into the interpreter wasm, about +0.5 MB as bytecode, and that
build is per build123d version. The `.mpy` map is the better first step.

## 6. Edge-only questions, and the command that settles each

Nothing was deployed. Each command below would deploy to the user's account,
so it is listed rather than run.

1. **What exactly does the 128 MB count?** The deployed evidence is
   inconsistent with "wasm + full V8 heap". Upstream `Buffer_Stand` returned
   200 on 2026-08-23 with 110.9 MB of wasm, while the V8 live heap at the
   time measured 71 MB locally (pre-keep_names). That would be 182 MB if
   both counted. Settle it with `npx wrangler deploy --env upstream` and
   then:

   ```
   BASE=https://cascade-headless-upstream.<sub>.workers.dev \
     node scripts/edge-bench.mjs
   wrangler tail --env upstream
   ```

   Look at `exceededMemory` against the `memory` field per model. A
   deliberate probe would settle it faster: a route that allocates N MB of
   JS arrays after boot.
2. **Real flavor on the edge:**

   ```
   npm run prepare-assets && npm run prepare-pyodide && npx wrangler deploy --env real
   ```

   then `BASE=… node scripts/smoke.mjs`. This checks that
   48,745 KiB uploads, the startup-time report (wrangler prints "Worker
   Startup Time"), and the cold-start latency including ~18 MB of module
   bindings.
3. **Startup CPU profile:** `npx wrangler check startup --env real`. This
   needs `wrangler login`; it was not run.
4. **Isolate recycling after a heavy model** (`--mode sequence` shows the
   OCCT high-water persisting across requests): see whether the edge kills
   and recycles the isolate cleanly or 503s the next request.

## 7. What remains

- **`bracelet`** is 174 MB of OCCT on upstream (93 MB on lite). It is
  inside the Gordon-surface path (JS `GordonSurface.js` via `topo_glue`),
  not in the shim ledger: ~2k shim objects in total. It is over 128 MB on
  every flavor except lite.
- **`projection` / `projection_algebra`**: OCCT 100-121 MB (HLR /
  `project_to_shape`). Under 128 on wasm alone; over once the V8 heap is
  added.
- **A warm isolate keeps its OCCT high-water.** After
  `heat_exchanger_algebra` (90 MB OCCT) the sequence is over 128 for every
  following model. That needs isolate recycling, or an OCCT memory that can
  shrink, which wasm memory cannot.
- **The `.mpy` loader** (section 5): −300 ms upstream boot, −1.2 MB of text.
- **OCCT `INITIAL_MEMORY=32MB`** against a 3.7 MB boot image: a fork relink,
  out of lane.
- **The browser worker bundle** is still built with `--keep-names` (same
  heap waste in the browser).
- **Reproducibility.** The interpreter patches live on `zalo/micropython`
  branch `cs-gc-incremental` (pushed 2026-10-15; local worktree
  `~/Desktop/mp-cf-fidelity`). The vendored artifacts and PROVENANCE.md are
  enough to rebuild.
