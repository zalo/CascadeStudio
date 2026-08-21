# pysrc=real — REAL build123d 0.11.1 on Pyodide over the OCP shim

**State: COMPLETE.** `?pyruntime=pyodide&pysrc=real` (localStorage
`cascade-py-src=real`, pyodide only) runs **REAL, UNMODIFIED build123d
0.11.1** — the actual PyPI wheel, real CPython 3.14 semantics, real numpy,
native metaclasses/typing, ZERO source transforms, ZERO stdlib shims — with
the OCP-over-embind shim (OcpShim.js + the SHARED generated proxies in
upstream-py/ocp_shim/) as the only substitution. This is the
reference/crossover leg that measures the "just shim the externals"
architecture head-to-head against build123d-lite and the MicroPython
pytopo=upstream stack. **Default-OFF by design** (Pyodide is not the default
runtime); every existing leg is untouched (gate battery below).

Branch `feat/pyodide-real-build123d` (on top of Stage-3 `4b67d8a`).

## Headline results

| leg (4 pages, this machine) | classification (222 scored) | wall |
|---|---|---|
| **pyodide + pysrc=real (this work)** | **216 PASS / 3 MISMATCH / 2 ERROR / 1 TIMEOUT** | **148 s** |
| micropython default (pytopo=upstream), same-day gate | 216 / 1 / 4 / 1 (in the 216/2/3/1 band; twist_extrude contention flap, PASSES solo; tips/b04 flapped PASS-ward) | 160 s |
| pyodide + lite, same-day gate | 206 / 10 / 5 / 1 (exact committed set) | 142 s |

**Per-script deltas vs the Stage-3 default leg — every one classified:**

| script | mp-default | py-real | root cause |
|---|---|---|---|
| docs/objects_2d | ERROR `NameError: Draft` | **MISMATCH** (`t2` bbox d = 0.025 mm) | **REAL drafting RUNS on this leg** — `Draft`/`DimensionLine`/`ExtensionLine`/`TechnicalDrawing` execute over `Text -> Compound.make_text` (glue-routed to opentype.js). The 25 µm residual is COMPROMISE(text) glyph metrics (FreeSans vs Arial), not a code gap. The ~450-line drafting port CLAUDE.md priced for the other legs is simply unnecessary here. |
| docs-rst/tips/b04 | PASS-flap / MISMATCH | MISMATCH (d = 0.2) | the documented COMPROMISE(traversal-order) COMPLETE-tie `sort_by(Axis.Z)`; the tie resolves per-stack. Same residual family as the default leg's own documented state. |
| examples/twist_extrude | ERROR (contention) | PASS | default-leg contention flap only — verified PASS solo on micropython. |

Non-PASS set of the real leg = the documented honest gaps exactly:
objects_1d (baseline residual, identical delta 0.0122), objects_2d (25 µm
font metrics — an ERROR on every other leg), tips/b04 (tie), dual_color_3mf
(lib3mf), curved_support (sympy), spitfire_wing_gordon (TIMEOUT — gordon at
wing scale, same everywhere).

**Interpreter-semantics finding: ZERO divergence.** Real CPython + real
numpy reproduce the MicroPython-stack classification on all 222 scripts
(216 PASS both sides); the transform+shim MicroPython leg is therefore
semantics-complete on this corpus. heat_exchanger PASSES under 4-page
contention here; the whole algebra_performance family passes easily.

## Benchmarks (same session, bench-runtime.mjs + in-browser grid runs, idle machine)

| | brython+lite (default) | micropython+upstream (default flag-leg) | pyodide+lite | **pyodide+real** |
|---|---|---|---|---|
| runtime assets, raw bytes over HTTP | 1.38 MB | 0.60 MB (interpreter only — the upstream-b123d payload rides in libMs) | 13.52 MB | **18.62 MB** |
| cold first eval (boot + trivial + mesh) | ~0.49 s | ~1.00 s | ~1.27 s | **~2.16 s** |
| boot split (fetch/init/lib) | ~0.42 s | ~0.92 s | ~1.19 s | **~2.09 s** (init ~1.05 + wheels 0.16 + shim/stubs 0.21 + `import build123d` 0.52 + glue 0.01) |
| warm trivial eval | 58-64 ms | 61-64 ms | 58 ms | **58 ms** |
| starter eval (flanged bearing mount) | ~302 ms | ~348 ms | ~310 ms | **~335 ms** |
| 54-hole grid model (150x100x10, 9x6 Hole grid + Z-fillets, warm) | 459 ms | 792 ms | 403 ms | **461 ms** |
| interpreter wasm heap after starter | 0 (JS heap) | 19.5 MB | 43.2 MB | **51.9 MB** |
| OCCT wasm after starter / after grid | 32.0 MB floor | 32.0 | 32.0 | **32.0** |

Notable: REAL build123d on CPython beats the MicroPython+upstream stack on
the mid-weight model (461 vs 792 ms) and lands within 15% of lite-on-pyodide;
warm trivial evals are identical across all four legs (OCCT dominates).

**What pysrc=real adds to a deploy** (on top of the pyodide+lite leg's
13.5 MB): wheels 3.39 MB (numpy 2.92 — already-compressed zip — + build123d
0.368 + typing_extensions 0.045 + anytree 0.045 + webcolors 0.015 +
trianglesolver 0.005) + the OCP-shim payload it shares with the MicroPython
leg (table.json 110.6 KB gz + _registry 13.4 KB gz + 79 OCP modules) + the
new bridge/glue Python (~11 KB gz). Nothing is fetched from the network at
runtime — everything serves from dist (`fetch-pyodide.cjs` vendors the
wheels; version-pinned, provenance in the script).

## Import-chain ledger

- **REAL, verbatim from the wheel**: every build123d module incl. the ones
  no other leg loads — `drafting` (WORKS), `exporters`, `exporters3d`,
  `importers`, `import_dxf`, `mesher`, `persistence` (`modify_copyreg()`
  runs; BinTools serialization would no-op via the inert stub), `text`
  (module-level `FontManager()` completes via the preglue stand-in),
  `brep_from_stl`, `vtk_tools` (its own `has_vtk=False` branch), `version`.
- **Real wheels (vendored, no network at runtime)**: numpy 2.4.3 +
  typing_extensions 4.15.0 (Pyodide CDN, ABI 2026_0), build123d 0.11.1,
  anytree 2.13.0 (replaces the MicroPython leg's mini-shim), webcolors
  24.8.0, trianglesolver 1.2 (PyPI pure wheels).
- **Real CPython stdlib**: everything build123d imports — math/copy/typing/
  functools/itertools/warnings/contextvars/dataclasses/enum/abc/inspect/
  logging/json/os/re/uuid/xml.etree/struct/copyreg/colorsys/bisect/ctypes/
  glob/platform/pathlib/tempfile/webbrowser/datetime/unicodedata.
- **Shimmed (POLICY, identical to every other leg)**: scipy
  (optimize.minimize / minimize_scalar, spatial.ConvexHull / Voronoi — the
  validated pure-Python substitutes; the real scipy wheel would be tens of
  MB for no harness delta) and pytest.approx.
- **Stubbed (import-satisfying, raise loudly on USE — real-deps/)**:
  ezdxf (+units/colors/zoom/math/entities/boundary_paths — 32 MB pure tree
  for DXF paths that need a filesystem; import_dxf/ExportDXF stay
  deliberate skips), svgpathtools + ocpsvg (SVG in/out), fontTools.ttLib
  (27 MB; no system fonts in a worker), lib3mf (native — the 3MF honest
  gap), sklearn.cluster (compiled; detect_primitives skip), requests
  (pcbway upload), sympy (ArcArcTangentArc only — honest gap parity),
  ocp_gordon (served instead by Face.make_gordon_surface glue over
  GordonSurface.js), IPython.lib.pretty (notebook display).
- **Glue (module-attribute overrides + OCP-layer stand-ins; no source
  edits)**: real_glue.py — show/show_object/show_all (+`__all__` additions;
  ocp_vscode is not importable in the worker), volume,
  _measure_globals_json/_cs_after_run/_reset_state (ContextVar reset),
  export_stl/brep + import_step/brep + export_step/gltf + Mesher +
  ExportSVG overrides (MEMFS/no-op contracts identical to the other legs),
  Compound.make_text -> opentype.js, Face.make_gordon_surface ->
  GordonSurface.js, Compound(joints=) reparenting (embind casts are value
  copies), pybind collection protocols + TopTools_ShapeMapHasher functor;
  real_preglue.py — COMPROMISE(kernel-fonts): pure-Python Font_FontMgr /
  TColStd_SequenceOfHAsciiString so REAL text.py imports ('singleline'
  canary reported, font list honestly empty).

## The Pyodide bridge layer (what the FFI port actually took)

`ocp_core_pyodide.py` (464 lines) registered as `ocp_core`; the dispatch
table, ocp-defaults and generated proxies (`_registry.py`, `OCP/*.py`,
`table.json`) are byte-shared with the MicroPython leg. Differences that
mattered, each measured in this bring-up:

1. **JsProxy is UNHASHABLE in Pyodide 314.0.4** (and a fresh proxy is minted
   per conversion) — upstream keys dicts on embind enum members
   (shape_core's `shape_LUT`) and broke immediately. Fix: every enum member
   is wrapped ONCE in an interned `OcpEnumMember` (hash/eq by `js_id`,
   pybind-style `.name`/`.value`); `wrap()` returns the interned wrapper for
   any 'plain' return. This was the ONLY FFI-semantics landmine.
2. The guarded `{ok,value}` protocol collapsed to **direct calls with
   try/except JsException** on the deep path (kwargs/containers), with raw
   OCCT wasm-number decode via `describeOCCTException`. The variadic guarded
   entries (`_csOcpNewV`/...) stay as the fast path — MEASURED at only
   ~8-10% on the 54-hole grid (fast 492/617 ms vs deep-forced 548/663 ms:
   Pyodide's `to_js` is cheap, unlike MicroPython's proxy registry), kept
   because they also own the OCCT-number decode; their sentinel is detected
   by its `_csErrMark` property (`is` cannot work across conversions).
3. numpy scalars reaching the FFI coerce through `float()`
   (`numbers.Real`) — Pyodide would otherwise proxy them into JS where
   embind refuses them.
4. `show()` membership uses `js_id`, not `is` (fresh proxies), and guards
   non-JS objects (an Axis handed to show() cost 3 scripts in round 1).
5. Line mapping/history came for free: `get_python_user_line` walks real
   CPython frames (PyodideRuntime.js), the shim's `recordExternalOp` +
   `producingLine` tagging are shared JS — history steps carry
   op-family names + correct user lines, and pick->line resolves
   (`viewport.getShapeLine`), same honest end-of-run-scene partial as the
   MicroPython leg.

Bridge-layer LOC added: ocp_core_pyodide 464 + real_glue 490 + real_preglue
82 + PyodideRealB123d.js 158 + dep stubs 276 + spec 134 ≈ **1,600 lines**
(vs ~19k upstream lines it unlocks verbatim, plus the whole exporter/
drafting surface no other leg loads).

## Kernel-guard

The COMPROMISE(kernel-guard) fuse-drop volume guard is shared OcpShim.js
GLUE (SetArguments/SetTools operand tracking + Shape() volume validation +
General-Fuse rebuild) and is active on this leg. ttt-ppp0110 — the
coplanar-BSpline drop case — PASSES with the correct volume (207159.36) and
mass assert (211.3 g); the guard log does not fire because upstream
topology's own boolean construction avoids the fault on this kernel, exactly
as on the Stage-3 MicroPython leg.

## Gate battery (all on this tree, 2026-08-21)

| gate | result |
|---|---|
| fast spec gate (python-mode + py-runtime + py-src-upstream) | 10 passed |
| test/py-src-real.spec.js (new) | 4 passed |
| micropython default-leg harness | 216 PASS (in-band; flaps verified solo) |
| pyodide+lite harness | 206/10/5/1 exact |
| pysrc=real harness | 216/3/2/1 |
| full playwright suite | **101 passed** (97 prior + the 4 new py-src-real specs) |

## How to run things

- Leg: `?pyruntime=pyodide&pysrc=real` in the browser (needs
  `node packages/cascade-core/scripts/fetch-pyodide.cjs` — now also vendors
  the six wheels — then `npm run build`).
- Harness: `B123D_SRC=~/Desktop/build123d CS_PY_RUNTIME=pyodide
  CS_PY_SRC=real CS_TEST_HEADFUL=1 DISPLAY=:99
  node test/b123d-validation/run-lite.mjs --port 843X --pages 4`.
- Single script: same env + `node test/b123d-validation/probe.mjs --id <id>`.
- Bench: `CS_TEST_PORT=843X CS_TEST_HEADFUL=1 DISPLAY=:99
  node test/b123d-validation/bench-runtime.mjs --runtime pyodide --pysrc real`.

## Open items / roadmap

- The scipy POLICY shim held for the whole corpus; the real scipy wheel
  (~40 MB) remains a measured non-adoption.
- objects_2d's 25 µm t2 residual would close with an Arial-metric font
  (COMPROMISE(text) — same as everywhere).
- Real ezdxf as pure wheel (~2.5 MB + pyparsing) could un-stub DXF import
  if a use case appears; today it is a deliberate-skip parity decision.
- persistence/BinTools round-trips silently no-op through the inert stub —
  a fork ask (BinTools bindings) would make pickle honest.
