# Python runtime comparison: Brython vs Pyodide for build123d-lite

**Question.** Python mode runs build123d-lite on **Brython** — an early choice
made on instinct ("stay lean") and never measured. Would **Pyodide** (real
CPython 3.14 on wasm) be the better host for the *same* lite modules? This is
about the interpreter only: build123d-lite, the CascadeStudio standard library
and OCCT are unchanged, and running real build123d over OCP.wasm is explicitly
out of scope.

**Decision criteria, in the project owner's priority order:** memory and
startup time first, download size alongside them, throughput a distant last. A
runtime that is faster per script but heavier at rest or slower to boot loses
unless the difference is dramatic.

**Answer: keep Brython.** Pyodide turned out to be a genuine drop-in — it
reproduces the validation harness *exactly*, script for script, mismatch
magnitude for mismatch magnitude — and it is marginally faster once running.
But on the three criteria that were asked for it loses by a wide margin: **23x
the download**, **~3x the boot**, and **~2.2x the memory** the runtime adds to
the worker. Nothing a user can see improves. The prototype stays in the tree
behind `?pyruntime=pyodide`, off by default: it is cheap to keep, it is the
only Python runtime that could ever host real build123d, and it turns "we use
Brython to stay lean" from a belief into a number.

Everything below was measured on this machine (32 cores, Chromium headful on
`DISPLAY=:99`, assets served by `http-server` over localhost), on the same
build, alternating runtimes.

## 1. Download size (compressed)

| | Brython | Pyodide core 314.0.4 |
|---|---|---|
| files | `brython.js` | `pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json` |
| raw | 1.32 MB | 12.90 MB |
| gzip -9 | **0.26 MB** | **6.09 MB** (23.4x) |
| brotli | 0.21 MB | 5.21 MB (24.8x) |

`python_stdlib.zip` (2.43 MB) is already deflated, so it does not compress
again — no server configuration recovers that half of the payload. Both
runtimes are lazily loaded on the FIRST Python evaluation, so JS/OpenSCAD mode
pays nothing either way; the comparison is what a Python-mode user downloads
once (and re-downloads whenever the cache is evicted or the version changes).

For scale, the app's other big download is the OCCT kernel: 25.7 MB raw /
7.59 MB gzipped. Adding Pyodide would nearly *double* what a first-time
Python-mode visitor pulls down; adding Brython costs 3% of it.

## 2. Startup

`firstEval` is the honest user-facing number: `runCode(<trivial script>)` on a
page that has loaded but never run Python — interpreter boot + build123d-lite
import + evaluate + mesh. Median of 3 runs; each run used a fresh browser
context (cold HTTP cache) and then a second page in the same context (warm).

| | Brython | Pyodide | ratio |
|---|---|---|---|
| first Python evaluation, cold cache | **369 ms** (361/369/395) | **1107 ms** (1053/1107/1195) | 3.0x |
| first Python evaluation, warm cache | **366 ms** | **1061 ms** | 2.9x |
| — of which: fetch the interpreter | 7 ms | 3 ms (`pyodide.mjs` only) | |
| — of which: interpreter init | 24 ms | 916–1041 ms (wasm compile + CPython bring-up + stdlib zip) | |
| — of which: compile build123d-lite (8.8k lines) | 273 ms | **74 ms** | 0.27x |
| second evaluation (no boot) | 59 ms | 57 ms | 0.97x |
| starter-script evaluation | 302 ms | 280 ms | 0.93x |
| assets over HTTP, cache bypassed | 7.5 ms / 1.3 MB | 45 ms / 12.9 MB | |

Two things worth naming:

* **Localhost hides the download.** Cold and warm are within noise here
  because 12.9 MB off a loopback socket costs ~45 ms. On a real connection the
  gzipped 6.09 MB is 5+ seconds at 10 Mbps and ~0.5 s on a fast link, all of
  it in front of the user's first evaluation. The size table, not the cold
  timing, is the real startup penalty.
* **Pyodide is the better *compiler*.** CPython compiles build123d-lite in
  74 ms where Brython needs 273 ms — Brython's cost is translating 8.8k lines
  of Python to JavaScript. Pyodide loses anyway, because it must first stand
  up a CPython interpreter (~950 ms) that Brython never needs.

## 3. Memory

`performance.memory` does not exist in workers, and everything Python costs
lives in the worker — so the measurement is the **RSS of the browser's
renderer processes** (page + workers share one), sampled after forcing GC in
both contexts (`--js-flags=--expose-gc`), plus the exact wasm linear-memory
sizes read inside the worker. RSS is sticky, so read the deltas.

| Worker memory | Brython | Pyodide |
|---|---|---|
| baseline before any Python (JS mode) | 679–689 MB RSS, of which OCCT wasm 100 MB | same |
| **added by boot + trivial script** | **+63 MB** (48/63/85) | **+141 MB** (116/141/155) |
| **added after the starter script** | **+81 MB** (76/81/94) | **+164 MB** (157/164/168) |
| **added after the whole 232-script corpus** (single page, no reload) | **+1356 MB** | **+1435 MB** |
| OCCT wasm heap after the corpus | 1115 MB | 1115 MB (identical) |
| CPython wasm heap (exact) | — | 43.3 MB at boot, **43.3 MB after the corpus** |

Pyodide's 43 MB CPython heap is only a third of what it actually costs: the
rest is Chromium holding a compiled 9.6 MB wasm module and the unpacked
stdlib. Brython's ~60–80 MB is the V8 heap holding brython.js plus the
JavaScript it generated for build123d-lite.

Context for both numbers: the OCCT wasm is 100 MB of linear memory before
either runtime starts, so Brython adds ~10% to an already heavy worker and
Pyodide adds ~25%.

## 4. Throughput (the criterion that was ranked last)

Full 232-script validation harness, 4 pages, 3 runs each, alternating:

| | Brython | Pyodide |
|---|---|---|
| harness wall time | 165 / 161 / 161 s (median **161 s**) | 154 / 153 / 153 s (median **153 s**) |
| per-script, single page, median | 155 ms | 148 ms |
| per-script, single page, p95 | 8172 ms | 7519 ms |
| 232 scripts on ONE page, wall | 680 s | 680 s |

Pyodide is ~5% faster over the corpus and indistinguishable on a single
evaluation (57 vs 59 ms). That is unsurprising: the wall time of a CAD script
is dominated by OCCT, not by the interpreter, and the interpreter's own
overhead is one JS↔Python boundary crossing per CAD call either way.

## 5. Correctness: is it a drop-in?

Yes — and this was the surprise. Running the full corpus on both runtimes,
three times each:

| Status | Brython | Pyodide |
|---|---|---|
| PASS | 204 | 204 |
| MISMATCH | 8 | 8 |
| ERROR | 9 | 9 |
| TIMEOUT | 1 | 1 |
| SKIP (reference fails natively) | 10 | 10 |

**Zero per-script status deltas**, in all three paired runs, and the eight
MISMATCH entries carry byte-identical problem strings (e.g. `'slider_arm'
bbox[0] 5.3255 vs -3.7834 (d=9.1089)` on both) — the geometry is not merely
"as good", it is the same geometry. Two ERROR *labels* differ while the
classification does not, and in both cases Pyodide's message is better:

* `ttt-23-t-24-curved_support`: `ImportError: sympy` (Pyodide) vs
  `ImportError: undefined` (Brython) — CPython names the missing module.
* `toy_truck`: the same known OCCT fillet fault, reported as
  `pyodide.ffi.JsException` instead of Brython's `JavascriptError`.

The harness only looks at geometry, so **line mapping was checked separately**
— the feature that pays for the frame-walking seam. The same script produces
the same history steps on both runtimes, down to the line numbers
(`Box@3, Cylinder@5, Difference@7, Sphere@10`, the last one from inside a
helper function), which is what drives the modeling timeline, Select-pick →
editor-line flash and the Fillet tool's variable resolution.

## 6. What porting the interpreter actually took

`PyodideRuntime.js` runs the SAME `Build123dLite.js` source string. The work
was entirely in the seams Brython papers over:

* **The `w` bridge.** `from browser import self as w` is a Brython builtin; on
  Pyodide a `browser` module is registered whose `self` proxies the worker's
  JS globals *with Brython's conversion behaviour* — Python lists/tuples
  become real JS arrays on the way out (Pyodide would otherwise pass a
  PyProxy, and `Array.isArray` in the standard library would fail), JS arrays
  become list-likes on the way in.
* **Object identity.** build123d-lite compares shapes with `is`
  (`any(existing is topo for existing in w.sceneShapes)`). Brython hands out
  one stable wrapper per JS object; Pyodide mints a fresh JsProxy per
  conversion (`a is b` is False, though `a == b` is True). The bridge memoizes
  proxies by `js_id` for the duration of an evaluation.
* **Live arrays.** `w.sceneShapes` is mutated through `.push()`/`.pop()` by
  `show()`, so the list-like writes those two through to the JS array.
* **Frame walking.** `getPythonUserLine` (CacheOp's line tagging, which drives
  history steps and pick→editor-line) and `_pythonCallerFrame` (the Builder
  same-stack-frame rule) are plain `sys._getframe()` walks — simpler than
  Brython's `$B.frame_obj` chain, and they work when the call arrives from JS
  because the JS call is synchronous from Python.
* **`__file__`.** Twelve upstream doc scripts compute an asset directory from
  `os.path.dirname(os.path.abspath(__file__))`. Brython defines `__file__` in
  the user module; a bare CPython `exec` does not. Setting the same string on
  both runtimes was the ONLY change needed to go from 194 to 204 PASS.
* **Stdlib.** Only the POLICY shims are registered on Pyodide (scipy's
  Nelder-Mead/quickhull stand-ins, the `pytest.approx` subset, the `logging`
  swallower); `math`, `copy`, `typing`, `functools`, `itertools`, `operator`,
  `timeit`, `random` and `os` come from the real stdlib and behaved
  identically.
* **Errors.** Same surface — `Python <summary>\n<traceback>` with user line
  numbers — built from `traceback.format_exception` with the runner frame
  dropped, including the OCCT raw-pointer decode.

Nothing in build123d-lite had to change, and nothing about it is
Brython-specific beyond those seams.

## 7. What switching WOULD buy (and what it would cost)

Honest ledger, since the answer is "no":

* Real CPython semantics and a real stdlib (`pathlib`, `dataclasses`, `re`,
  `decimal`, …) instead of hand-written shims — today lite needs eight of
  them, and they are a maintenance surface.
* Real PyPI wheels: `sympy` (+4.0 MB) would close one ERROR;
  `numpy`+`scipy` (+16.3 MB) would give `full_round` its real 2-D Voronoi and
  replace COMPROMISE(scipy-shim). At 6.1 MB gz just for the core, that is a
  20+ MB Python stack for two scripts.
* It is the only path to running *real* build123d over OCP.wasm (the deferred
  roadmap item) — but that project is dominated by the OCP binding surface,
  not by the interpreter, and it can adopt Pyodide when it happens.
* Better error messages (see §5) and no Brython traceback-formatter flakiness
  (`run-lite.mjs` carries a retry for Brython's `reading 'substr'` failures).

Against: 23x the download, 3x the boot, 2.2x the resident memory, a second
wasm module to keep in step with the OCCT one, and a vendored 13 MB blob that
does not belong in npm.

## 8. Recommendation

1. **Keep Brython as the default.** Nothing here justifies the size/boot/memory
   bill.
2. **Keep the Pyodide runtime behind the flag** (`?pyruntime=pyodide`, or
   `localStorage['cascade-py-runtime']`), off by default, with its assets
   *unvendored* in a clean checkout — the build only copies `vendor/pyodide/`
   when someone has fetched it, so the default bundle is byte-identical to
   before.
3. **Revisit only if the premise changes** — a real-build123d/OCP.wasm effort,
   or a hard dependency on numpy/scipy semantics. The measurement harness
   (`bench-runtime.mjs`, `run-lite.mjs --pyruntime`) is committed, so the
   revisit is a re-run, not a rewrite.

## How to reproduce

```bash
node packages/cascade-core/scripts/fetch-pyodide.cjs   # gitignored vendor/pyodide (13 MB)
npm run build

# classification parity (232 scripts) — compare against the committed results.json
CS_TEST_HEADFUL=1 DISPLAY=:99 CS_PY_RUNTIME=pyodide \
  node test/b123d-validation/run-lite.mjs --pages 4 \
  --out /tmp/results-pyodide.json --report /tmp/report-pyodide.md

# startup + memory (3 runs), then the corpus memory/percentile pass
CS_TEST_HEADFUL=1 DISPLAY=:99 \
  node test/b123d-validation/bench-runtime.mjs --runtime pyodide --repeat 3
CS_TEST_HEADFUL=1 DISPLAY=:99 \
  node test/b123d-validation/bench-runtime.mjs --runtime pyodide --repeat 1 --corpus
```

`test/py-runtime.spec.js` (part of the default Playwright suite) keeps the flag
honest: Brython is the default, an unknown value falls back to Brython, and —
when `vendor/pyodide` is present — a build123d script really does evaluate on
CPython.

## 9. MicroPython (added 2026-08-19 — the memory-minimizing third runtime)

`?pyruntime=micropython` runs the same Build123dLite.js source on MicroPython
1.28 wasm (`MicroPythonRuntime.js`; micropython.mjs + the **settrace** wasm
variant, needed for the line-mapping and Builder caller-frame hooks). It was
added with a hard target in mind: **executing basic models inside a 128 MB
memory budget** (Cloudflare Workers class environments).

Measured on this machine (bench-runtime.mjs --runtime micropython --repeat 3,
numbers stable across runs; harness = full 232-script corpus, --pages 4):

| Criterion | Brython (default) | MicroPython | Pyodide |
|---|---|---|---|
| Assets (raw) | 1.38 MB | 108 KB mjs + 489 KB wasm | 13.5 MB |
| Assets (gz) | ~268 KB | **~228 KB** | ~6.2 MB |
| Boot (fetch+init+lib) | ~420-540 ms | **~154 ms** | ~1280 ms |
| Cold first eval | ~600 ms | **~220 ms** | ~1500 ms |
| Interpreter memory after starter | JS-heap resident (not separately measurable in a worker) | **20.4 MB wasm heap** (16 MB GC heap, fixed) | 45.3 MB wasm heap |
| Validation (222 scored scripts) | 205 PASS / 10 MISMATCH / 5 ERROR / 2 TIMEOUT | **206 PASS / 10 MISMATCH / 5 ERROR / 1 TIMEOUT** — the identical mismatch set and expected-ERROR set; heat_exchanger converts Brython's TIMEOUT into a PASS | 205 PASS (identical to Brython) |
| Throughput | baseline | ~3.5x slower on pure-Python loops (settrace); OCCT time unaffected — heat_exchanger, a Brython TIMEOUT, PASSES here | fastest |

The mismatch set is exactly Brython's residual set (joints x2, projection x2,
objects_1d, filter_all_edges_circle, sort_axis, sm_hanger, tips/b04) — the
documented COMPROMISE(edge-orientation)/(traversal-order)/(triad-labels)
items, not MicroPython artifacts.

### The 128 MB question — ANSWERED (2026-08-19, INITIAL_MEMORY=32MB fork rebuild)

The opencascade.js fork was rebuilt with `-sINITIAL_MEMORY=32MB` (was 100MB;
growth to 4GB was already enabled — fork commit ddabdb0, otherwise
byte-identical bindings/d.ts). Measured on the rebuilt kernel:

- **Basic models: ~52 MB wasm total** — OCCT stays at its 32.0 MB floor
  (the starter AND a 54-boolean grid-of-holes with fillets never grow it)
  plus MicroPython's 19.5 MB. Comfortably inside a 128 MB budget with
  2.4x headroom for the JS runtime around it.
- **Growth works on demand**: the corpus's heaviest script
  (examples/heat_exchanger) grows OCCT to 165.6 MB and the MicroPython heap
  to 78.2 MB (the wasm port's GC heap grows past its initial heapsize) —
  such models exceed 128 MB on ANY configuration and are out of the budget
  question's scope. It also runs FASTER here than on Brython (34 s vs ~55 s
  despite settrace).
- **Zero regressions from the smaller floor**: full 94-test suite green and
  the full 232-script harness classifies identically
  (205/10/5/2 with 4-page contention; heat_exchanger passes solo).

### Upstream-source memory cost (2026-08-19 — pysrc default flip round)

`?pyruntime=micropython` now DEFAULTS to running UPSTREAM build123d 0.11.1
Level-A source over lite's seam (`&pysrc=lite` opts back). Measured on the
32MB-INITIAL_MEMORY kernel via `CascadeAPI._memoryStats()` in the browser
(idle machine; starter = PYTHON_STARTER_CODE; mid-weight = a 150x100x10
plate with a 9x6 `GridLocations` of 54 `Hole`s + vertical-edge fillets):

| | micropython + lite (`pysrc=lite`) | micropython + upstream (default) |
|---|---|---|
| Boot (fetch/init/lib) | 4.2 / 7.3 / 132.9 = **144 ms** | 4.3 / 7.3 / 321.9 = **334 ms** |
| Starter eval | 316 ms | 326 ms |
| Interpreter wasm heap after starter | 20.4 MB | 20.4 MB |
| OCCT wasm heap after starter | 33.6 MB (32 MiB floor) | 33.6 MB (32 MiB floor) |
| **Basic-model wasm total** | **54.0 MB** | **54.0 MB** |
| Mid-weight (54-hole grid) eval | 721 ms | 1445 ms |
| Interpreter heap after mid-weight | 20.4 MB | 34.6 MB (GC heap grew once) |
| OCCT heap after mid-weight | 33.6 MB | 33.6 MB |
| Added dist payload (upstream-b123d/) | — | 420 KB raw / **103 KB gz** (vendored upstream 79.5 KB gz + seam adapters 13.3 + shims 6.4 + manifests 3.5) |

**The 128 MB budget question is UNCHANGED by the flip**: the basic-model
total stays ~54 MB wasm (2.4x headroom); the upstream layer costs +190 ms of
boot (Python-source registration), ~2x on the mid-weight model's
interpreter-side time (validation layers + settrace) and one 14 MB GC-heap
growth step under sustained upstream bookkeeping — 68.2 MB total for the
grid model, still comfortably inside the budget. Correctness state of the
upstream layer (2026-08-20 grind round: **205/222 PASS vs lite's 206/222**,
per-script deltas: upstream additionally passes sort_axis/toy_truck/ppp0110
and additionally fails bicycle_tire/ex08_algebra/Buffer_Stand, sm_hanger as
ERROR, heat_exchanger as a contention TIMEOUT) is recorded in
`experiments/upstream-on-micropython/INVENTORY.md` §H/§I.

### Custom-interpreter round (2026-08-21 — micropython-cs: four patches into MicroPython v1.28.0)

`?pyruntime=micropython` now boots CUSTOM-PATCHED artifacts
(`packages/cascade-core/vendor/micropython-cs/`, committed; its PROVENANCE.md
has the patch SHAs, build command and sizes), falling back to the stock npm
settrace pair when they are absent from dist (feature-detected in browser.py
— both paths keep working). Four defects were patched into MicroPython
v1.28.0 (upstream-submission style, one commit each, each with a test in
MicroPython's tests/) and the wasm pyscript variant rebuilt with emsdk
4.0.23:

1. **`sys._getframe`** (`MICROPY_PY_SYS_GETFRAME`, default-on with SETTRACE):
   frames built ON DEMAND from the code-state chain the settrace feature
   already maintains unconditionally — identity-stable per activation, LIVE
   `f_lineno` (recomputed from the saved VM ip on access), `f_back`
   materialized on demand. Frame construction became LAZY with it, which
   removed the hidden cost of settrace-capable builds: every call used to
   allocate a frame + code object even with no tracer (unix port: 200k
   trivial calls 1.20 s -> 0.021 s). browser.py feature-detects it and
   installs NO trace function; `_cs_user_line`/`_cs_caller_frame` walk
   `sys._getframe(0)` — the exact frame `_cur[0]` held on the settrace path,
   so the caller-frame identity (`is`) rule and live-lineno semantics are
   unchanged (same for the upstream-seam inspect shim's `currentframe`).
2. **Nested isinstance/issubclass classinfo tuples** — an upstream MicroPython
   bug (silently False; CPython accepts arbitrary nesting). The
   `collections.abc` shim's tuple-valued names now nest correctly.
3. **Float hashing** — the pyscript variant's ROM level used the fallback
   truncation hash (`(mp_int_t)val`): every float in (-1, 1) hashed to 0 and
   coordinate tuples collapsed onto a handful of buckets (the measured ~100x
   set-probing degradation). High-quality hash enabled at FULL_FEATURES +
   a high-bits fold for 32-bit `mp_int_t` (without the fold, dyadic
   fractions 0.5/0.25/... still all hashed to 0 on wasm, and one-decimal
   floats collided 2:1). The integer-key Vertex equality in lite is
   belt-and-braces now (kept: exact, cheap, stock-artifact safe).
4. **Stable `list.sort`/`sorted`** (`MICROPY_PY_BUILTINS_SORT_STABLE`,
   default-on at extra-features+): bottom-up merge sort, key called ONCE per
   element. `_stable_sorted`'s probe passes and takes the native path, and
   the upstream seam now probes before replacing `builtins.sorted` (the
   decorate-shim is skipped on the custom build).

Measured on this machine (in-worker via probe.mjs unless noted; STOCK = npm
settrace artifacts with the tracer installed — the previous default):

| Micro | STOCK (settrace) | CUSTOM (getframe) |
|---|---|---|
| fib(20), pure Python | 520 ms | **6 ms** (87x) |
| 512 float-tuple set build+probe | 11 ms | **1 ms** |
| sorted(4000, key=) | 96 ms | **2 ms** (48x) |
| hooks: user_line through FRESH depth-20 chains, 2000x | 2205 ms | **46 ms** |
| 60 `Box(mode=PRIVATE)` in a BuildPart (upstream src) | 113 ms | **48 ms** |
| distinct hashes: {i/10 for i in range(520)} / dyadics 1..63/64 | 52 / 1 | **520 / 63** |
| node (proofs.mjs): sorted(4000, key=) with tracer | 1815 ms | 2 ms |

| Boot (upstream src, fetch+init+library registration) | STOCK | CUSTOM |
|---|---|---|
| total | ~369–474 ms | ~344–446 ms (unchanged band) |

| Full harness, --pages 4, same day, alternating | STOCK | CUSTOM |
|---|---|---|
| micropython + upstream (default) | 205/10/5/2, **200 s** | 205/10/5/2, **171 s** |
| micropython + lite | 206/10/5/1, 148 s | 206/10/5/1, **142 s** |

**Both legs classify IDENTICALLY to the committed baselines** — the same 10
MISMATCHes, the same 5 ERRORs, and the same TIMEOUTs (upstream:
spitfire_wing_gordon + the documented heat_exchanger contention flap; lite:
spitfire only — heat_exchanger PASSES) — per-script sets verified, not just
counts. A same-day Brython control run (147 s) reproduced its committed
mismatch/error sets exactly, with heat_exchanger landing on the PASS side of
its documented contention flap (206/10/5/1) — the non-MicroPython paths are
untouched, as expected (no shared files changed).

Hot scripts SOLO (probe wall, includes ~8 s browser+kernel boot):

| Script | STOCK | CUSTOM |
|---|---|---|
| examples/extrude (upstream) | 12.2 s | **9.4 s** |
| docs-selectors/group_axis (upstream) | 11.2 s | **8.9 s** |
| examples/clock (lite) | 7.2 s | **5.7 s** |
| examples/clock (upstream) | **40.9 s** | 57.0 s (below) |
| examples/heat_exchanger (upstream) | **105 s** | 128 s (below) |

**Open item — the clock/heat_exchanger pacing anomaly**: on the two
guard/boolean-heavy giants in UPSTREAM-source mode the custom build loses
~25–40% wall DESPITE every Python-level metric measuring faster. Bisected
exhaustively: identical per-op topology and measurement JSON, identical
CacheOp misses, identical `Shape.__hash__` (88,744) and `_add_to_context`
counts; per-phase instrumentation shows most phases FASTER; the loss is
stochastic multi-second stalls concentrated in the Text-subtract phase whose
position MOVES between runs. Ruled out by experiment: MicroPython GC (64 MB
heap and gc-every-100-bridge-calls change nothing), the sort/hash/isinstance
patches (flag-bisected interpreter builds), the hook bodies (stubbed to
`return 0` — still slow). The one reproducible correlation: any config with
the settrace TRACER installed is fast, any without is slow — i.e. the 3–28x
SLOWER interpreter paces the worker so the browser absorbs the same JS/wasm
garbage without main-thread stalls. Engine-level scheduling, not a
correctness issue; the harness classification is unaffected (clock PASSES
with margin at 4-page contention; heat_exchanger stays the documented
TIMEOUT flap it already was).

### Porting notes (what the shared Python source must avoid)

MicroPython has no `type.__new__`/unbound builtin dunders, exposes no `.fget`
on properties, instance `__dict__` is read-only, `int.bit_length` is missing,
package `__path__` is a string, **its list sort is UNSTABLE**, and a JS
exception crossing the FFI unwinds the VM uncatchably. Build123dLite.js now
uses `object.__new__(cls)`, `_is_nested_seq()`, `_list_getitem`,
`_property_getter`, `_bit_length`, setattr loops, a conditional `__path__`,
and `_stable_sorted()` (probe + index-decoration — build123d's chained
sort_by semantics REQUIRE CPython stability); MicroPythonRuntime.js routes
every worker call through a JS-side try/catch bridge (`_csMpCall`) and
converts container arguments with `jsffi.to_js`. All of these are
behavior-preserving on Brython/Pyodide (the full Brython suite and frozen
examples stayed green throughout).

### Metaclass round (2026-08-20 — micropython-cs: custom metaclasses, patches 7+8)

The interpreter grew `MICROPY_PY_METACLASSES` (micropython-cs commits
`2a4a92e` py/objtype + `9e360ce` py/modbuiltins): `class M(type)` builds a
real metatype whose instances are types, `class X(B, metaclass=M)` works
(explicit kwarg wins, else CPython's most-derived rule; extra class keywords
reach the metaclass), class creation runs the metaclass
`__call__`/`__new__`/`__init__` chain (with `type.__new__`/`__call__`/
`__init__` in type's locals as the terminal supers), and class-level
attribute/subscript/iteration/`in`/`len` fall back to the metaclass with the
descriptor protocol — metaclass properties are class properties. wasm cost
+3067 B raw (+0.63%, gzip band unchanged at ~207 KB); unix-port
micro-benchmarks of NORMAL class creation, instance/class attr lookup,
isinstance and instantiation are within run-to-run noise (the hot paths are
untouched; the only added work on non-metaclass code is a flag test on the
already-failing side of two identity checks).

What it retired in the upstream-b123d layer (each independently
feature-detected; the stock settrace artifacts keep the old paths — proven
in-browser by hiding the custom pair):

- shims/enum.py: real metaclass `EnumMeta` — members ARE instances of their
  enum class, `for m in Cls` / `Cls[name]` / `x in Cls` / `len(Cls)` /
  `Cls(value)` work on the class object, and the `_finalize_enums`
  post-import pass is skipped (Enum subclasses `_Member`, so the seam's
  `isinstance(v, enum._Member)` bridge is untouched).
- shims/typing.py: `Generic` is a class whose metaclass `__getitem__`
  returns the class — `class Builder(ABC, Generic[T])` and
  `class BuildPart(Builder[Part])` run as written.
- UpstreamB123d.js: `cleanClassBases` (class-base subscripts +
  `Generic[...]` stripping) no longer applies on metaclass-capable
  interpreters; `stripRuntimeGenerics` stays (builtin generics cannot grow
  metaclasses).

Validation (same day, --pages 4, B123D_SRC assets from the dev clone):

| leg | classification | wall |
|---|---|---|
| micropython + upstream (default) | 204/10/5/3 — identical per-script to the committed 205/10/5/2 except examples/clock landing on the TIMEOUT side of its documented contention flap (passes solo, 71 s incl. boot) | 175 s |
| micropython + lite | **206/10/5/1 — per-script identical to committed** | 138 s |
| Brython control | **206/10/5/1 — committed sets reproduced exactly** (heat_exchanger on the PASS side of its flap) | 147 s |

Frozen by the new "NATIVE metaclasses" test in test/py-src-upstream.spec.js
(boot-log marker, EnumMeta behaviors, `_GenericMeta` on Builder,
`Builder[int] is Builder`, `BuildPart.__bases__ == (Builder,)`).
Interpreter-side conformance lives in micropython-cs
tests/basics/metaclass*.py (output-identical to CPython; unix suite
basics+misc+float 623/623). NOT implemented (documented divergences):
`__init_subclass__`, `__mro_entries__`, metaclass
`__instancecheck__`/`__subclasscheck__`, metaclass data descriptors
intercepting class-attribute stores, and `type(name, bases, ns)` 3-arg always
uses `type` itself as the metaclass.

## 10. Stage 3 (2026-08-21): upstream TOPOLOGY as the default layer + the bridge-protocol perf round

Under `pytopo=upstream` (the DEFAULT since the Stage-3 flip; `?pytopo=lite`
opts out) upstream 0.11.1's geometry.py + the whole topology package run
VERBATIM over the OCP-over-embind shim — see
`experiments/upstream-topology-spike/STAGE3-STATE.md` for the round-by-round
grind (112 -> 215 PASS) and CLAUDE.md for the architecture.

**The perf finding that made the flip possible**: the hot loops were NOT
MicroPython bytecode execution — a symbolized profile (new JSFLAGS_EXTRA
hook + --profiling-funcs) showed `mp_map_lookup` 27% + `mp_obj_equal` 15%
under `mp_jsffi_to_js` and the mp->js proxy registry
(`proxy_c_add_obj`/`check_existing`, one EM_JS round-trip per registration):
every guarded bridge call built a temporary Python list, registered it as a
PyProxy, deep-converted it element-by-element through 'get' traps, and read
`{ok, value}` back through two more traps. Interpreter codegen levers
measured almost nothing (computed goto ~4%, -O3 ~3% more at +18% wasm
size, 256 MB heap ~4% — all NOT adopted). The fix is the variadic
no-proxy fast path (`_csMpCallV` + `_csOcpNewV/CallVar/StaticV`, sentinel
error returns): scalar/JsProxy args cross individually, container/kwargs
calls keep the deep path. MicroPython's OrderedDict (linear lookup) also
had to leave the ordered-dedup transforms (`_CsOrderedStore`).

| script (solo, node inner loop) | before | after |
|---|---|---|
| algebra_performance/b01 | 148 s | **18 s** |
| bicycle_tire | 250 s | **29 s** |
| group_axis | 34 s | 7.7 s |
| clock | TIMEOUT | 21.6 s |

Full-harness legs (4 pages, this machine):

| leg | classification | wall |
|---|---|---|
| micropython + upstream topo (r10/r11, pre-flip flag) | **215 PASS / 2-3 MM / 3-4 E / 1 T** of 222 | **158 s** |
| (for comparison: the seam-over-lite baseline) | 205 / 10 / 5 / 2 | ~150-175 s |

The 215-band beats every previous configuration ON FIDELITY as well:
upstream traversal resolves lite's residual COMPROMISE(edge-orientation)/
(traversal-order) mismatch families (joints x2, projection x2, sort_axis,
filter_all_edges_circle, sm_hanger, toy_truck, ttt-ppp0110), and the
remaining non-PASS set is baseline-family (objects_1d, tips/b04 flap,
dual_color_3mf, objects_2d drafting, curved_support sympy, spitfire
TIMEOUT). Boot cost of the layer: libMs ~600 ms and ~1.7 MB extra payload
(table.json + registry + glue) on top of the seam layer; interpreter wasm
unchanged (486 KB — cgoto/-O3 rejected).

jsffi patches this stage (micropython-cs, carried as real commits):
`83f1550` out-of-int32 integral JS numbers convert as floats (1e15 crossed
WRAPPED, 1e100 as 0 — corrupted OCCT's +-Precision::Infinite ranges),
`7f63764` JSFLAGS_EXTRA.

## 11. The final crossover (2026-08-21): REAL build123d 0.11.1 on Pyodide — `?pyruntime=pyodide&pysrc=real`

The reference leg the whole comparison was building toward: the ACTUAL
build123d 0.11.1 wheel (real CPython 3.14 semantics, real numpy, native
metaclasses/typing — zero source transforms, zero stdlib shims) on Pyodide,
with the OCP-over-embind shim as the ONLY substitution. Architecture,
import-chain ledger, bridge notes and gates: `experiments/pyodide-real/
STATE.md`; the Pyodide call layer is `upstream-py/ocp_shim/
ocp_core_pyodide.py` under the SAME generated proxies/table as the
MicroPython leg. Default-OFF by design.

**Harness: 216 PASS / 3 MISMATCH / 2 ERROR / 1 TIMEOUT (222 scored, 148 s
wall)** — PASS-parity with the Stage-3 MicroPython default (216), and the
non-PASS set is strictly no worse: docs/objects_2d moves ERROR -> MISMATCH
(25 µm) because **REAL drafting (Draft/DimensionLine/ExtensionLine/
TechnicalDrawing) RUNS on this leg** over the make_text glue — the ~450-line
drafting port priced for the other legs is unnecessary here. The
interpreter-semantics finding is a clean NULL: real CPython + real numpy
reproduce the transformed-MicroPython classification on every script.

Five-way table (same session, bench-runtime.mjs + warm in-browser grid runs,
idle machine; medians of 3):

| | brython+lite (default) | micropython+upstream | pyodide+lite | **pyodide+real** |
|---|---|---|---|---|
| runtime assets over HTTP (raw) | 1.38 MB | 0.60 MB (+103 KB gz upstream payload in libMs) | 13.52 MB | **18.62 MB** |
| cold first eval | ~0.49 s | ~1.00 s | ~1.27 s | ~2.16 s |
| warm trivial eval | ~59 ms | ~63 ms | ~58 ms | **~58 ms** |
| starter eval | ~302 ms | ~348 ms | ~310 ms | ~335 ms |
| 54-hole grid model (warm) | 459 ms | 792 ms | 403 ms | **461 ms** |
| interpreter wasm heap after starter | 0 (JS heap) | 19.5 MB | 43.2 MB | 51.9 MB |
| OCCT wasm floor | 32.0 MB | 32.0 MB | 32.0 MB | 32.0 MB |
| harness classification | 206/10/5/1 | 216/2/3/1 band | 206/10/5/1 | **216/3/2/1** |
| harness wall (4 pages) | — | 160 s | 142 s | 148 s |

What `pysrc=real` adds to a deploy on top of the pyodide runtime: 3.39 MB of
vendored wheels (numpy 2.92 dominates; build123d itself is 368 KB) + the
OCP-shim payload it shares with the MicroPython leg (~130 KB gz) + ~11 KB gz
of bridge/glue. `fetch-pyodide.cjs` vendors everything; nothing touches the
network at runtime.

The one FFI landmine worth remembering: **Pyodide 314's JsProxy is
unhashable and freshly minted per conversion** — embind enum members had to
become interned Python-side wrappers (`OcpEnumMember`, hash/eq by `js_id`)
before upstream's enum-keyed dicts (`shape_LUT`) would work. Everything else
the MicroPython bridge needed (guarded call protocol, variadic fast path,
proxy-registry economics) either collapsed to idiomatic try/except
JsException or carried over unchanged.

Recommendation unchanged: Brython+lite stays the default (size), the
MicroPython+upstream stack stays the fidelity flag-leg at 1/9th the
pyodide+real download; `pysrc=real` is the semantics REFERENCE — the leg you
run when you need to know whether a divergence is ours or upstream's.

## 12. Heavy-model memory (2026-08-21): deterministic embind lifetime

OCCT wasm linear memory never shrinks, so a page's `occtWasm` is the
high-water mark of everything that ran in it; freed embind objects DO reuse
within the arena, which is the only lever. Attribution on
`examples/heat_exchanger` (the corpus's heaviest model) found the whole
286-vs-165 MB upstream-vs-lite delta was **embind object lifetime**: nothing
in the stack ever called `.delete()` (embind's FinalizationRegistry attaches
only to smart-ptr handles, and this build registers none), so `pysrc=real`
leaked **265,598 embind objects per run** — 159k TopoDS wrappers pinning
BRep structures, 602 `BRepBuilderAPI_Copy`, 161
`ShapeUpgrade_UnifySameDomain`, 4.1k `BRepAdaptor_Curve`, ~90k `gp_*` values
(identical count on the MicroPython leg: the shim owns the leak, not the
interpreter). Cache/history pinned nothing on the shim legs (argCache 0,
1 history ref); on lite legs they pin 607 entries / 107k step refs — JS-side
references only, relevant as the *protection set* for the frees below.

**The fix (default-ON for the shim legs)**: every embind object the OCP shim
returns to Python is retained (`_csPy`); `OcpProxy.__del__`
(ocp_core_pyodide.py — CPython refcounting makes this prompt) balances it;
frees are queued and deleted at op boundaries unless the worker still
reaches them (sceneShapes / modelHistory / externalShapes / argCache /
pinned fuse-guard operands). Raw `Standard_Transient` wrappers are deleted
only for an allow-listed adaptor/algorithm family — `Handle.get()` returns a
NON-owning alias (measured), so deleting arbitrary raw transients
use-after-frees; deref'd raws carry their owning handle (`_csOwnH`) and the
flush releases the handle instead. Internal dispatch temporaries (progress
pads, default fills, handle conversions) die with the dispatch. Opt-out for
A/B: `?ocplt=leak`.

**Mesher fixes (all legs)**: `ShapeToMesh` now deletes its per-node/per-face
wrapper copies (hundreds of thousands per heavy run), the iso curves,
adaptors, explorers and the mesher itself, and calls **`BRepTools.Clean`
after extraction** — the old `Nullify()` never detached triangulations from
the TShapes, so argCache pinned every cached shape's mesh forever and a
REMESH of a still-triangulated shape (e.g. a MeshRes change) leaked the old
mesh wholesale (measured: six remeshes of one sphere ratcheted 286→697 MB
without Clean, dead flat with it). The previous run's `currentShape`
compound is deleted at evaluate start. Trade-off: cached shapes remesh on
re-evaluation (heat_exchanger re-eval +3 s; typical models are ms).

**Measured matrix** (fresh page per cell, `CascadeAPI._memoryStats().occtWasm`
after the model, MB; python wasm in parens; starter = PYTHON_STARTER_CODE,
grid = 54-hole plate, heavy = heat_exchanger):

| leg | starter | grid | heavy (was) | heavy (now) |
|---|---|---|---|---|
| brython+lite | 32.0 | 32.0 | 165.6 | **138.0** |
| micropython+lite | 32.0 (19.5) | 32.0 (19.5) | 165.6 | **138.0** (39) |
| micropython+upstream (default) | 32.0 (19.5) | 32.0 (19.5) | 286.3 | **286.3** (612) — no `__del__` on MicroPython; only the shared mesher/scratch fixes apply |
| pyodide+lite | 32.0 (43.3) | 32.0 (43.3) | 165.6 | **138.0** (43.3) |
| **pyodide+real** | 32.0 (51.9) | 32.0 (51.9) | 286.3 | **238.5** (51.9) — alive wrappers 265,598 → ~5.6k, eval time unchanged |

All numbers sit on emscripten's ×1.2 geometric-growth ladder (…, 138, 165,
198, 238, 286, 343, …): true demand is somewhere below each rung, and any
shortfall costs a whole rung. `?lowmem=1` (history metadata-only + delete
pruned argCache entries) does not move the single-run heavy numbers — on the
real leg history pinned ~nothing, on lite legs nothing deletes user-held
shapes — its value is bounded history/cache retention for iterative editing
sessions; timeline scrubbing degrades with a console note.

**Where the remaining 238.5-vs-138 gap lives** (in-worker phase marks +
free-space probes): evaluation itself ends at 95.8 MB (vs lite's 48 — real
upstream stacks bigger kernel transients: the 149-edge fillet, the
mirror-fuse, `clean`/UnifySameDomain), and the mesh phase adds ~100-140 MB
on EVERY leg (the `BRepMesh_IncrementalMesh` constructor's internal peak —
kernel-internal, deviation-driven, not wrapper leakage). Cross-run repeats
of the SAME heavy model still ratchet ~85-100 MB/run (lite: ~35/run):
allocator fragmentation + the growth ladder against the per-run ~140 MB mesh
transient; free-space probes show the freed memory exists but each run's
mesh crosses another rung. Bounded improvements landed (Clean bought one
rung from run 3), the rest is documented as a known limitation.

**MicroPython arena (556-612 MB churn / ~1 MB live)**: verified NOT fixable
from Python — explicit `gc.collect()` every 8192 proxy creations runs
(32×/heavy, counted) and changes nothing; `gc.threshold` is compiled out
(8 MB and 256 KB settings byte-identical to default). The wasm port grows
its split GC heap on allocation bursts between any collect cadence reachable
from Python. Bounding it needs an interpreter patch (micropython-cs
follow-up: enable MICROPY_GC_ALLOC_THRESHOLD or collect-before-grow).

Gates for this round (all green): fast specs 14/14; pyodide+real harness
**216/3/2/1 per-script identical to the committed results.json**;
micropython default harness 217/1/3/1 (strict subset of the documented
216-band non-PASS set); pyodide+lite and Brython controls both the exact
committed 206/10/5/1; full playwright suite 101 passed — details in
experiments/heavy-memory/STATE.md. Reproduce any cell with
`experiments/heavy-memory/measure.mjs`; phase attribution with
`probe-marks.mjs` (in-worker eval/mesh marks + optional free-space census
via `self._csMemFreeProbe`).
