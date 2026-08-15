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
