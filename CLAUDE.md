# CascadeStudio — Agent Development Guide

## Project Overview

CascadeStudio is a browser-based parametric CAD modeling environment. Users write JavaScript
(or OpenSCAD) in a Monaco editor; code is evaluated in a Web Worker with OpenCascade (OCCT)
compiled to WebAssembly via Emscripten. The 3D viewport uses Three.js with a matcap material.

## Quick Start

```bash
npm run build          # builds cascade-core then cascade-studio
npx http-server ./packages/cascade-studio/dist -p 8080 -c-1 --silent
npx playwright test    # 94 tests (incl. 50 frozen build123d example scripts)
```

## Architecture (Monorepo)

The project is split into two npm workspace packages:

- **cascade-core** — Reusable CAD engine (no GUI deps). Worker + OpenCascade WASM + mesher.
- **cascade-studio** — Browser IDE. Three.js viewport, Monaco editor, Tweakpane GUI.

```
packages/
  cascade-core/
    src/
      engine/
        CascadeEngine.js       ← Main-thread API wrapping Worker + MessageBus
        MessageBus.js          ← Typed worker message routing
      worker/
        CascadeWorker.js       ← Web Worker entry; evaluates user code
        StandardLibrary.js     ← CAD primitives (Box, Sphere, etc.)
        StandardUtils.js       ← Caching, hashing, history tracking
        ShapeToMesh.js         ← OpenCascade → mesh triangulation (no Three.js)
        FileUtils.js           ← STEP/IGES/STL import/export
      openscad/
        OpenSCADTranspiler.js  ← OpenSCAD → CascadeStudio JS transpiler
      index.js                 ← Package entry (exports CascadeEngine, MessageBus, etc.)
    types/
      StandardLibraryIntellisense.ts
    fonts/                     ← TTF fonts for Text3D

  cascade-studio/
    src/
      main.js                  ← ESM entry point
      CascadeMain.js           ← App shell, layout (Dockview), default STARTER_CODE
      CascadeAPI.js            ← window.CascadeAPI — programmatic API for agents
      CascadeView.js           ← 3D viewport, Three.js rendering, modeling timeline
      EditorManager.js         ← Monaco editor, code evaluation, keyboard shortcuts
      ConsoleManager.js        ← Console panel, log/error capture
      GUIManager.js            ← Tweakpane GUI panel (sliders, checkboxes)
      CascadeViewHandles.js    ← 3D gizmo handle visualization
      openscad/
        OpenSCADMonaco.js      ← Monaco language support for OpenSCAD
    css/, textures/, icon/, lib/  ← Static assets

test/                          ← Playwright tests (monorepo root)
```

## Agent API (window.CascadeAPI)

Four methods — that's it:

1. `getQuickStart()` → Learn the API (call this first)
2. `runCode(code)` → Run CAD code, returns `{success, errors, logs, historySteps}`
3. `saveScreenshot(filename)` → Download 3D model screenshot (view with Read at `.playwright-mcp/filename`)
4. `setCameraAngle(azimuth, elevation)` → Rotate view (0=front, 90=right; 0=level, 90=top)

**NEVER** use `browser_take_screenshot` (captures full page UI, not the 3D model) or `browser_run_code` (use `setCameraAngle` instead).

## GUI Modeling Tools

LeapShape-style tools in the viewport toolbar (top-left overlay). **Every GUI operation
emits JavaScript into the Monaco editor — the code IS the scene.** Committing a tool
action appends a snippet (via `executeEdits`, so Monaco undo works) and re-evaluates.

**Tools**: Select (default), Box, Cylinder, Sphere, Sketch, Fillet. One active at a
time; Escape cancels the current interaction, then returns to Select; committing a tool action also returns to Select (creation tools are one-shot — reactivate from the toolbar to place another). OrbitControls
are disabled while a creation drag is in progress (like HandleManager's gizmo drags).

**Gestures — every numeric stage accepts BOTH** (`Tool.stageDown`/`stageUp`):
press-drag-release, and click-move-click. A release with the stage's dimension still
zero is **non-destructive** (the stage stays armed; Escape is the only way to throw
away an in-progress solid). This was a real bug: the height stage used to `cancel()`
on any pointerdown while the height was 0, so pressing to drag the height destroyed
the whole box/cylinder — the second drag always failed with a real mouse, while the
synthetic-PointerEvent tests only exercised move-then-click and passed. Regression
tests drive Playwright's `page.mouse` (real CDP input), not `dispatchEvent`.

- **Box**: pointerdown on the ground plane (snapped to integer mm) → size the footprint
  → lock it → size the height → commits `let box1 = Translate([x,y,0], Box(w,d,h));`
- **Cylinder**: from the center → size the radius → lock it → size the height → commits
- **Sphere**: from the center → size the radius → commits
- **Sketch**: stateful multi-click profile drawing (Fusion-style sketch → extrude).
  Clicks place grid-snapped vertices with a rubber-band preview (length/angle label);
  the Line/Arc toggle (or `L`/`A` keys) picks the segment type — Arc segments take two
  clicks (through-point, then end) and preview the live three-point arc. Escape is
  vertex-level undo (a half-placed arc through-point is its own undo step); Enter or
  clicking the first vertex closes (min 3 vertices; closing works from Arc mode too).
  Once closed, corner-vertex clicks toggle sketch fillets (vertex 0, the Sketch start
  point, can't be filleted — pitfall 5), and an inline panel commits as
  **Extrude / Revolve / Face only**; for Extrude, dragging vertically inside the
  profile sets the height interactively (the input reflects the drag). Emits the
  Sketch builder chain, e.g.
  `let profile1 = new Sketch([20,5]).LineTo([35,5]).ArcTo([42,12],[35,20])`
  `.LineTo([20,20]).Fillet(3).End(true).Face(); let part1 = Extrude(profile1, [0,0,15]);`
  The sketch plane is a parameter on the tool (CAD origin + u/v basis in
  `SketchTool.plane`) to make sketch-on-face feasible later; v1 always uses the
  ground plane (XY at z=0), which maps 1:1 onto the default `new Sketch([u,v])` plane.
- **Fillet**: click edges to multi-select (orange highlight), set radius in the inline
  panel, Enter/Apply commits `shapeVar = FilletEdges(shapeVar, r, [indices]);`. The edge
  indices are exactly the per-shape indices the hover tooltip shows. If the producing
  line is a bare expression (`Box(10,10,10);`), it is rewritten to `let box1 = ...` first.
- **Select**: clicking a shape reveals + flashes the editor line that produced it.

**File map** (`packages/cascade-studio/src/tools/`):
- `ToolManager.js` — toolbar DOM, capture-phase pointer routing (fires before
  OrbitControls), raycast/snap/CAD↔three helpers, variable naming, code emission,
  Escape/keyboard routing (tools can consume Escape for stage-level undo)
- `Tool.js` — base class; `SelectTool.js`, `BoxTool.js`, `CylinderTool.js`,
  `SphereTool.js`, `SketchTool.js`, `FilletTool.js` — per-tool state machines

**Pick → line mapping**: `CacheOp` (StandardUtils.js) tags every produced shape with
`.producingLine`; `combineAndRenderShapes` (CascadeWorker.js) builds face/edge-hash →
sceneShape-index maps plus a `shapeLines` array that flow through ShapeToMesh into the
mesh payload (`face.shape_index`, `edge.shape_index`, `meshData.shapeLines`). The
viewport stores the shape index in the third vertex-color channel (faces) and in
`globalEdgeMetadata` (edges); `viewport.getPickInfo(intersect)` + `getShapeLine(i)`
resolve a click to an editor line.

**Coordinates**: three.js scene is Y-up, CAD is Z-up. CAD `[x,y,z]` ↔ three `(x, z, -y)`
(see `ToolManager.cadToThree/threeToCad`, same mapping as CascadeViewHandles.js).

**Testing hooks**: `CascadeAPI._tools` exposes the ToolManager. `test/gui-tools.spec.js`
drives tools two ways: synthetic PointerEvents on the canvas (fast, but they cannot
reproduce gesture bugs) and `page.mouse.down/move/up`, which is real CDP input — use the
latter for anything gesture-shaped. Fresh loads are Python mode now, so the JS-emission
specs call `CascadeAPI.setMode('cascadestudio')` in their `gotoAndReady` helper.

## Python (build123d) Mode

The **default** editor language mode (alongside `'cascadestudio'` and `'openscad'`):
users write **build123d algebra-mode** Python that evaluates in the existing CAD worker.
A parameter-less load opens `PYTHON_STARTER_CODE` (a parametric flanged bearing mount:
`Box` + `filter_by(Axis.Z)` fillet, fused boss, bore, `GridLocations` bolt holes, a
`Rot`'d set screw, `group_by(Axis.Z)[-1]` rim fillet) — see "URL Encoding & Mode
Defaults" for how each entry point picks its mode.

**Architecture — Brython in the worker (NOT Pyodide — now a measured choice,
see `test/b123d-validation/runtime-comparison.md`)**:
- `packages/cascade-core/src/worker/PythonRuntime.js` lazily bootstraps Brython on the
  FIRST Python evaluation: brython.js (~1.38 MB raw / ~300 KB gz, copied to dist by the
  cascade-core build) is fetched as text and indirect-eval'd in the worker global scope
  (module workers lack importScripts; brython.js is strict-mode, so its `__BRYTHON__`/`$B`
  are exported onto `globalThis` from inside the eval'd text). JS mode pays zero cost.
- `packages/cascade-core/src/worker/Build123dLite.js` embeds the **build123d-lite**
  Python source (a JS template string — beware: it must contain no backticks or `${`).
  It is registered as the importable module `build123d` via
  `__BRYTHON__.runPythonSource(src, 'build123d')`; user code runs as module `'main'`,
  so user line numbers map 1:1 to editor lines (nothing is prepended).
- Python accesses the worker's standard library via `from browser import self as w` —
  e.g. `w.Box(...)`, `w.Union([...])`. The JS functions own all sceneShapes bookkeeping,
  so wrapped shapes are never double-added. (Brython wrappers defeat `indexOf` identity;
  use Python `is` to compare shapes across the boundary.)
- `CascadeWorker.evaluate` branches on `payload.language === 'python'`: the evaluation
  becomes async (Brython bootstrap) and its pending promise gates
  `combineAndRenderShapes`; the worker's onmessage router supports Promise-returning
  handlers. `resetWorking`/`modelHistory` still fire in the same order as JS mode.
- Python errors throw a JS Error whose message is `Python <summary>\n<full traceback>`
  (extracted via `$B.error_trace(exc)`); it surfaces through the usual worker →
  `window.onerror` → `CascadeAPI.getErrors()` path. NOTE: worker logs/errors post
  asynchronously — tests must poll for console content, not sample right after runCode.
- **Python IntelliSense is basedpyright in a browser worker**:
  `packages/cascade-studio/src/PythonLanguage.js` is a minimal LSP client
  (vscode-jsonrpc over postMessage, the micro:bit-fork `browser/boot` /
  `browser/newWorker` protocol) around `browser-basedpyright`'s self-contained
  `pyright.worker.js` (copied to `dist/pyright/`, ~3.2 MB gz, lazy-booted
  ~1.5 s after a Python-mode load — JS/OpenSCAD loads pay zero). It
  typechecks against stubs generated from REAL build123d 0.11.1 and modified
  to lite's surface (pruned `__all__`, removed unsupported params, lite-only
  APIs added, compromise notes in hover docstrings) — see
  `packages/cascade-core/types/python-stubs/README.md` for regeneration.
  The build bundles the stub tree into `dist/typedefs/python-stubs.json`;
  diagnostics land as Monaco markers under owner `'basedpyright'`
  (`test/python-lsp.spec.js` freezes the contract). Hover, completion and
  signature help are registered for language `'python'`; leaving Python mode
  clears the markers.
- **Line mapping works in Python mode**: `CacheOp` calls `self.getPythonUserLine()`
  (walks Brython's frame chain to the innermost `'main'` frame, `frame.$lineno`) instead
  of parsing JS eval stack frames. History steps, Select-pick → line flash, and the
  Fillet tool's variable resolution all work on Python lines.
- **`?pyruntime=pyodide`** (or `localStorage['cascade-py-runtime']`) swaps the
  interpreter for real CPython 3.14 on wasm — same Build123dLite.js source,
  `packages/cascade-core/src/worker/PyodideRuntime.js`, needs
  `node packages/cascade-core/scripts/fetch-pyodide.cjs` (gitignored `vendor/pyodide/`,
  copied to dist only when present). It is a validated drop-in (identical 204/222
  classification, identical mismatch magnitudes) and is NOT the default: it costs 23x
  the download and ~3x the boot for no user-visible win. Numbers, the interop-seam
  notes and the recommendation live in `test/b123d-validation/runtime-comparison.md`;
  the flag is covered by `test/py-runtime.spec.js` and benchmarked by
  `test/b123d-validation/bench-runtime.mjs`. `CS_PY_RUNTIME=pyodide|micropython`
  switches run-lite.mjs/probe.mjs over.
- **`?pyruntime=micropython`** (source layer: UPSTREAM build123d by default —
  see the next bullet) swaps the interpreter for MicroPython 1.28 wasm
  (`packages/cascade-core/src/worker/MicroPythonRuntime.js`, ~237 KB gz,
  copied to dist by the cascade-core build) — the smallest and lowest-memory
  runtime: ~150 ms boot, ~20 MB interpreter wasm heap after the starter (vs
  Pyodide's ~45 MB), aimed at memory-budgeted headless execution.
  **The interpreter is a CUSTOM-PATCHED build (micropython-cs)**: vendored +
  committed in `packages/cascade-core/vendor/micropython-cs/` (PROVENANCE.md:
  base v1.28.0 tag e0e9fbb, eight patch SHAs, build command), copied to dist
  as `micropython-cs.mjs/.wasm` and PREFERRED at boot; the stock npm settrace
  pair remains the feature-detected fallback (everything works on both —
  `_pythonBootTiming.artifact/getframe` says which booted, frozen in
  test/py-runtime.spec.js). The patches: `sys._getframe` built on demand
  from the settrace code-state chain (identity-stable frames, LIVE
  f_lineno; browser.py then installs NO tracer, so the settrace ~3.5x
  pure-Python tax AND the eager per-call frame allocation are gone —
  fib(20) 520→6 ms in-worker), nested isinstance/issubclass classinfo
  tuples (upstream MicroPython bug: silently False), high-quality float
  hashing + a 32-bit high-bits fold (kills the ~100x float-tuple
  set-probing degradation; lite's integer-key vertex equality is
  belt-and-braces now), and a STABLE native list.sort/sorted with
  key-called-once (lite's `_stable_sorted` probe takes the native path; the
  upstream seam no longer overrides builtins.sorted), and — since the
  metaclass round — **CUSTOM METACLASSES** (`MICROPY_PY_METACLASSES`:
  `class M(type)` creates a real metatype whose instances are types,
  `class X(B, metaclass=M)` works with CPython's most-derived rule, class
  creation runs the metaclass `__call__`/`__new__`/`__init__` chain with
  `type.__new__`/`__call__`/`__init__` as the terminal supers, and class
  attr/subscript/iter/`in`/`len` fall back to the metaclass with the
  descriptor protocol, i.e. metaclass properties are class properties).
  With metaclasses the upstream-b123d loader takes NATIVE paths, all
  independently feature-detected so the stock pair keeps the old behavior
  (proven in-browser by hiding the custom pair): the enum shim becomes a
  real metaclass `EnumMeta` (members ARE instances of their enum class,
  `for m in Cls` / `Cls[name]` / `x in Cls` / `len(Cls)` / `Cls(value)`
  work; the `_finalize_enums` post-import pass is skipped; `Enum`
  subclasses `_Member` so the seam's `isinstance(v, enum._Member)` bridge
  is unchanged), the typing shim's `Generic` carries a metaclass
  `__getitem__` returning the class (so `class Builder(ABC, Generic[T])`
  and `class BuildPart(Builder[Part])` run AS WRITTEN and subclasses
  inherit the metaclass), and `transformUpstreamSource` RETIRES the
  class-base-subscript/`Generic[...]` transform (`cleanClassBases` only
  applies on metaclass-free interpreters; `stripRuntimeGenerics` stays —
  builtins can't grow metaclasses). Frozen in test/py-src-upstream.spec.js
  ("NATIVE metaclasses"); node micro-proofs in
  experiments/micropython-patches/proofs.mjs (metaclass section);
  interpreter-side tests in micropython-cs tests/basics/metaclass*.py
  (CPython-output-identical). NOT implemented (documented): `__init_subclass__`,
  `__mro_entries__`, metaclass `__instancecheck__`/`__subclasscheck__`,
  metaclass data descriptors intercepting class-attr stores. Full-harness walls
  improved (upstream 200→171 s, lite 148→142 s) with BOTH legs classifying
  per-script IDENTICALLY to the committed baselines. Known open item: on
  the two guard/boolean-heavy giants (clock, heat_exchanger) in upstream
  mode the faster interpreter LOSES ~25-40% wall to stochastic browser-side
  stalls (results identical; bisected to execution pacing, not to any
  patch) — see runtime-comparison.md §9 "custom-interpreter round".
  On the stock fallback, the settrace variant powers the two
  runtime hooks (`getPythonUserLine`, `_pythonCallerFrame`) via a
  current-frame tracker + live `f_back` walking (no frame stack — MicroPython
  fires no 'return' event on exception unwind; tracing costs ~3.5x on
  pure-Python loops, nothing on OCCT time). ALL worker-library calls go
  through a guarded JS bridge (`_csMpCall`) because a JS exception crossing
  the FFI unwinds the VM uncatchably; the Python-side `browser` shim converts
  container args with jsffi.to_js (identity-preserving both ways — better
  than Brython). Same Build123dLite.js source + PY_SHIM_MODULES (registered
  via MEMFS files; builtin-conflicting names via alias + sys.modules).
  Portability idioms the shared Python source must keep to (MicroPython has
  no `type.__new__`, exposes no dunder ATTRIBUTES on builtins, and instance
  `__dict__` is read-only): `object.__new__(cls)` for allocation,
  `_is_nested_seq()` instead of hasattr-`__len__` duck checks,
  `_list_getitem`/`_property_getter`/`_bit_length` helpers, setattr loops
  instead of `__dict__.update`, and the scipy shim only sets `__path__ = []`
  when missing (MicroPython needs its native STRING `__path__`).
- **On MicroPython the DEFAULT SOURCE LAYER is upstream** (`pysrc` resolution,
  localStorage `cascade-py-src`): `?pyruntime=micropython` runs UPSTREAM
  build123d 0.11.1 Level-A source (builders, build_common, objects_*,
  operations_*, joints, pack — VENDORED and COMMITTED in
  `vendor/build123d-0.11.1/` with upstream's Apache-2.0 LICENSE;
  `node packages/cascade-core/scripts/fetch-upstream-b123d.cjs` is the
  version-bump tool; transformed at load by
  `packages/cascade-core/src/worker/UpstreamB123d.js`) as the `build123d`
  package, over lite's classes re-exported as
  `build123d.geometry`/`build123d.topology[.*]` (seam in
  `packages/cascade-core/upstream-py/` — since the class-DAG unification it
  is genuine re-exports + S-sized method fills + the enum bridge); lite
  registers as `build123d_lite`. `&pysrc=lite` opts back into lite; if the
  upstream payload is missing at runtime the no-flag default falls back to
  lite with a console warning (explicit `pysrc=upstream` stays a hard
  error, and non-MicroPython runtimes reject it loudly). Frozen by
  `test/py-src-upstream.spec.js`; `CS_PY_SRC=lite|upstream` switches
  run-lite.mjs/probe.mjs (and when harness results look implausibly clean,
  run with `CS_DEBUG_PYSRC=1` and check the '[debug] page booted pySrc='
  lines — a stale http-server on the harness port once masked the whole
  upstream leg). Harness (2026-08-20, 32MB kernel, post grind round):
  micropython+upstream classifies **205 PASS / 10 MISMATCH / 5 ERROR /
  2 TIMEOUT** of the 222 scored scripts — effectively LITE PARITY (lite:
  206/10/5/1; the failure sets overlap but differ: upstream additionally
  PASSES sort_axis, toy_truck and ttt-ppp0110, and additionally fails
  bicycle_tire (+0.84%, thicken band), ex08_algebra (face-winding
  orientation family), Buffer_Stand (fuse-drop kernel fault on ITS
  construction), sm_hanger as ERROR instead of MISMATCH, and
  heat_exchanger flaps TIMEOUT under 4-page contention; both LITE
  baselines stay per-script IDENTICAL to the committed 206/10/5/1). The
  honest shortfall list (per-script, with causes) lives in
  `experiments/upstream-on-micropython/INVENTORY.md` §H; the A-section
  (class-DAG) is CLOSED by the unification and the 2026-08-20 grind round
  closed the seam-method and semantics gaps. Compare against lite with
  `experiments/upstream-on-micropython/compare-examples.mjs`.
- **The TOPOLOGY layer under pysrc=upstream is UPSTREAM'S OWN (Stage 3,
  the DEFAULT — `PYTOPO_DEFAULT='upstream'`; `?pytopo=lite` / localStorage
  `cascade-py-topo` opt back into the seam; `CS_PY_TOPO=lite|upstream` for
  run-lite.mjs; a missing ocp_shim payload warns-and-falls-back to lite)**:
  upstream 0.11.1's **geometry.py + the WHOLE topology package run
  VERBATIM** over the hardened OCP-over-embind shim
  (`upstream-py/ocp_shim/`, OcpShim.js) — the seam adapter modules load
  only under pytopo=lite, and lite reduces to the JS op layer + the worker
  glue `ocp_shim/topo_glue.py` (show()/sceneShapes raw-TopoDS unwrap,
  implicit post-run scene, `_measure_globals_json`, export/import, text ->
  lite opentype (COMPROMISE(text)), gordon -> GordonSurface.js,
  Compound(joints=) reparenting — embind casts COPY where pybind shares).
  History rides the SHIM (recordExternalOp at BRepPrimAPI/BRepAlgoAPI/...-
  family granularity + TopoDS `producingLine` tagging, so pick->line
  resolves); the kernel-guard fuse-drop recovery is ported to the shim's
  SetArguments/SetTools/Build/Shape path. Post-flip default-leg harness
  (2026-08-21): **216 PASS / 2 MISMATCH / 3 ERROR / 1 TIMEOUT** of 222 —
  beyond every previous configuration: upstream traversal RESOLVES lite's
  residual COMPROMISE(edge-orientation)/(traversal-order) set (joints x2,
  projection x2, sort_axis, filter_all_edges_circle, sm_hanger, toy_truck,
  ttt-ppp0110), and the whole non-PASS set is the documented honest gaps
  (objects_1d, tips/b04 flap; dual_color_3mf lib3mf, objects_2d drafting,
  curved_support sympy; spitfire gordon TIMEOUT). Perf: the bridge's
  variadic no-proxy fast path (see runtime-comparison.md §10) cleared the
  hot-loop TIMEOUTs (b01 148->18 s, bicycle_tire 250->29 s); full harness
  wall 158 s. State/history:
  `experiments/upstream-topology-spike/STAGE3-STATE.md`; fork asks:
  FORK-ASKS.md Stage-3 addendum; interpreter patches 9-10 (jsffi
  out-of-int32 integral doubles — 1e100 crossed as 0 — and JSFLAGS_EXTRA)
  live as real micropython-cs commits, artifacts re-vendored.
  2026-08-19): `Wire` is a real class (distinct from `Edge` and `Curve`;
  all three subclass `Mixin1D`, lite's "any 1-D shape" isinstance target,
  which carries the shared behaviors + `_specs` bookkeeping);
  `Part`/`Sketch`/`Curve` subclass `Compound` (with upstream's kwargs ctor:
  `obj=`, `label=`, `material=`, `joints=`, `parent=`, `children=`);
  `Solid` is a separate single-solid class carrying the `make_*` /
  `extrude` / `revolve` / `thicken` classmethods (`.solids()` returns
  Solids, `.wires()`/`outer_wire()`/`edges_to_wires` return Wires);
  `Compound.get_type(T)` extracts DIRECT children (StandardLibrary's
  `DirectChildren` over TopoDS_Iterator); `Shape.__eq__`/`__hash__` are
  upstream's topological same-ness (TopoDS `IsSame` — the JS seam preserves
  TShape identity across selector calls; hash = rounded-bbox key).
  Bookkeeping that MEANS identity (parent/children links, sceneShapes)
  uses explicit `is` scans — keep it that way when touching those paths.
- **`?pyruntime=pyodide&pysrc=real` — REAL, UNMODIFIED build123d 0.11.1 on
  Pyodide (the reference/crossover leg, default-OFF)**: the actual PyPI
  wheel (real CPython 3.14 semantics, real numpy 2.4.3, native
  metaclasses/typing — ZERO source transforms, ZERO stdlib shims) runs with
  the OCP-over-embind shim as the ONLY substitution.
  `packages/cascade-core/src/worker/PyodideRealB123d.js` boots it (vendored
  wheels — `fetch-pyodide.cjs` now fetches numpy/typing_extensions from the
  Pyodide CDN and build123d/anytree/webcolors/trianglesolver from PyPI —
  inert OCP stubs + the SHARED generated proxies over
  `upstream-py/ocp_shim/ocp_core_pyodide.py`, import stubs in
  `upstream-py/real-deps/` for ezdxf/svgpathtools/ocpsvg/fontTools/lib3mf/
  sklearn/requests, lite as `build123d_lite`, then `import build123d` +
  `real_glue.py`/`real_preglue.py` worker glue). Pyodide FFI landmine: its
  JsProxy is UNHASHABLE and freshly minted per conversion — embind enum
  members are interned `OcpEnumMember` wrappers (hash/eq by js_id), show()
  membership compares js_id. Harness **216 PASS / 3 MISMATCH / 2 ERROR /
  1 TIMEOUT** (148 s wall) — PASS-parity with the Stage-3 default and
  **REAL drafting (Draft/DimensionLine) RUNS on this leg** (objects_2d is a
  25 µm font-metric MISMATCH here instead of an ERROR); interpreter
  semantics finding: a clean NULL (no divergence vs the transformed
  MicroPython stack anywhere in the corpus). Costs vs pyodide+lite:
  +3.4 MB wheels (18.6 MB assets total), boot 2.1 s vs 1.3 s
  (`import build123d` is 0.52 s of it), interpreter heap 51.9 vs 43.2 MB;
  warm evals identical, 54-hole grid 461 ms (faster than
  micropython+upstream's 792 ms). Frozen by `test/py-src-real.spec.js`;
  `CS_PY_SRC=real` switches run-lite.mjs/probe.mjs/bench-runtime.mjs
  (`--pysrc real`); ledger/benchmarks/state in
  `experiments/pyodide-real/STATE.md` + runtime-comparison.md §11.
- **Heavy-model memory (2026-08-21, runtime-comparison.md §12)**: the OCP
  shim now frees kernel objects DETERMINISTICALLY on the Pyodide legs —
  every embind object returned to Python is retained (`_csPy`);
  `OcpProxy.__del__` balances it and OcpShim.js deletes unreachable objects
  at op boundaries (protection: sceneShapes/history/externalShapes/argCache/
  fuse-guard pins; raw `Standard_Transient` wrappers only via an allow-list —
  `Handle.get()` returns NON-owning aliases, so blanket raw-transient
  deletion use-after-frees). `?ocplt=leak` opts back into the old behavior
  for A/B. ShapeToMesh deletes its per-node wrapper copies and calls
  `BRepTools.Clean` after extraction (Nullify never detached triangulations;
  cached shapes therefore remesh on re-evaluation). heat_exchanger OCCT
  high-water: lite legs 165.6 → **138 MB**, pysrc=real 286.3 → **238.5 MB**
  (alive embind objects 265,598 → ~5.6k, eval time unchanged);
  mp+upstream stays 286.3 (MicroPython has no `__del__`; its 556-612 MB GC
  arena is a port-level grow-on-burst ratchet — gc.threshold is compiled
  out, explicit collects verified ineffective; needs a micropython-cs
  patch). **`?lowmem=1`** (or localStorage `cascade-low-memory`='1'): the
  worker keeps history step METADATA but drops the per-step shape refs
  (timeline scrubbing logs a console note instead) and deletes pruned
  argCache entries' kernel objects at end-of-evaluation — bounds retention
  for iterative editing; single-run numbers are unchanged.

**build123d-lite coverage** (vs real build123d 0.11.1 — validated by running
EVERY runnable script in the upstream `examples/` and `docs/` trees through both,
see `test/b123d-validation/`: the examples, the docs' own `.py` scripts, the 13
Too Tall Toby challenge parts (mass asserts kept) and every docs `.rst`
code-block; currently **205/222 scripts PASS** (volume within 0.5%, bbox within
1e-3/axis), 10 MISMATCH, 5 ERROR, 2 TIMEOUT, 10 SKIP (real build123d fails
natively) — full breakdown with per-script reasons AND a hand-maintained
root-cause/defaults audit of every non-PASS in the committed
`test/b123d-validation/report.md`. A full 232-script harness pass takes ~150 s
with `--pages 4` (~5 min single-page); the harness MUST run with
`CS_TEST_HEADFUL=1 DISPLAY=:99` on this machine (headless Chromium has no WebGL,
which manifests as every script reporting "no measurement produced"). Debug a
single script with `test/b123d-validation/probe.mjs` (prints raw measurements +
errors). Since the GeomAPI-array binding round: Spline/Helix interpolate EXACTLY
(GeomAPI_Interpolate, incl. tangents=/tangent_scalars=/per-point tangents/periodic),
sweep uses MakePipeShell with upstream's trihedron/transition modes (incl.
multisection, normal=, binormal=), section()/make_hull/draft/project (BuildPart
form) work, joints are live (RigidJoint/RevoluteJoint/LinearJoint/
CylindricalJoint/BallJoint with connect_to), scipy.optimize.minimize is shimmed
(pure-Python Nelder-Mead) with DoubleTangentArc on top, and Mesher writes STL
into MEMFS. Since the surface/text-parity round:
make_surface_from_array_of_points is EXACT (GeomAPI_PointsToBSplineSurface via
the fork's `Handle_Geom_BSplineSurface.AsGeomSurface` — never call `.get()` on
the surface handle, wrap with `BRepBuilderAPI_MakeFace_8(hs, tol)`), Text
topology matches upstream (one face per disjoint outer contour — i/j dots are
separate faces; counters stay holes; +Z oriented normals per glyph face),
`position_at`/`tangent_at` use arc-length fractions (GCPnts_AbscissaPoint,
upstream's `_occt_param_at`), thicken/Solid.thicken work (reconstructed
BRepOffset walls), Solid/Face.extrude/revolve/make_loft/make_sphere/
make_cylinder classmethods, Compound.make_text, Shell(faces)+Solid(shell)
sewing, Vertex(...) point forms, find_intersection_points +
Shape.project_faces (text-on-path projection), and scipy.spatial.ConvexHull is
served by the worker's bundled quickhull3d. The known OCCT 8.0.1 wasm fuse
fault (coplanar BSpline-edged contact faces DROP an operand) is now detected
by volume and RECOVERED from the correct General-Fuse partition instead of
raising. Since the freeform-surface round: `Face.make_gordon_surface` builds
real curve-network Gordon surfaces (a JS port of ocp_gordon — GordonSurface.js
— realized through a scored least-squares refit, see
COMPROMISE(gordon-surface-realization)), `Face.wrap`/`Shape.wrap_faces`
conform flat Edges/Wires/Faces onto a curved surface along a path,
`Face.make_surface` fills a non-planar boundary (BRepOffsetAPI_MakeFilling),
`Face.location_at`/`normal_at` give surface frames at normalized u/v or a 3D
point, `Wire`/`Edge.project_to_shape` project along a direction or from a
cone apex (BRepProj_Projection), and `offset(side=Side.LEFT/RIGHT)` does
one-sided offsets of OPEN lines. `Face(wire)` is now planar-only like
upstream, `make_face` cleans its result like upstream's `_add_to_context`,
and `Trapezoid`'s obtuse-side-angle case matches upstream. Since the
selectors/1-D-solver round: `make_hull` is a statement-for-statement port of
`Wire.make_convex_hull` (trimmed source arcs, no polyline approximation — which
also closed two supposed "kernel fillet faults"), the topology-selection
property surface is complete (`Face.center_location`/`position_at`/
`is_circular_convex`/`is_circular_concave`, `Mixin1D.normal`,
`Edge`/`Wire.param_at_point`, `Shape.distance`/`distance_to`/`closest_points`
via BRepExtrema, `sort_by(<Edge|Wire>)`, `topo_distance_to`,
`GroupBy.group(key)`), the analytic 1-D objects are in (`BSpline`,
`ParabolicCenterArc`/`HyperbolicCenterArc` incl. limit `arc_size`,
`EllipticalStartArc`, `BlendCurve`, `Airfoil`, `Triangle`, `derivative_at`,
`curvature_comb`, `trim` by point, `trim_to_other`), `Wedge`,
`ConvexPolyhedron`, `Text(path=)` and `ArrowHead` exist, and five fidelity
defaults were corrected: `position_at` EXTRAPOLATES outside [0, 1] (`line @ 2/3`
parses as `(line @ 2) / 3`), a full `CenterArc` is ONE closed edge,
`copy.copy(<Builder>)` snapshots, `extrude(taper=)` follows both of upstream's
algorithms, and `BuildSketch` localizes + orients (+Z) every incoming face.
Since the OCCT-binding round: OCCT's whole **`Geom2dGcc` 2-D constraint-solver
family is real here** (the fork's binding files were failing to compile on one
enum-out-param method — see its CHANGELOG), so `ConstrainedArcs`/
`ConstrainedLines` are a statement-for-statement port of upstream's
`topology/constrained_lines.py` across ALL overloads; `Wire.fillet_2d` (1-D
corner fillets on `ChFi2d_FilletAlgo`) and `make_brake_formed` landed with it;
`full_round` works on a real pure-Python 2-D `scipy.spatial.Voronoi`
(Bowyer-Watson circumcentres, vertex-set-identical to scipy); `import_step`
reads assets handed to the worker up front (`CascadeAPI.loadExternalFiles`);
`gp_Cylinder`/`gp_Sphere`/`gp_Torus` and `Extrema_ExtAlgo` retired the
`curvature-sign` and `point-projection` compromises; and joints gained
`symbol`, survival through `Shape.moved`/`Compound(joints=)`,
`Shape.show_topology` and `Compound.do_children_intersect`. Since the
upstream-exports round: lite exposes 204 of upstream's effective 200-name
`__all__` surface (only the 12 deliberate skips are absent — drafting beyond
`ArrowHead`, `Export2D`/`DotLength`, `import_dxf`,
`import_svg_as_buildline_code`, `detect_primitives`, `export_to_pcbway`) —
newly: `MC`/`UNITS_PER_METER`, the seven remaining enums, `polar`/`delta`/
`topo_explore_common_vertex`/`topo_explore_connected_edges`, singular
`Builder.vertex/edge/wire/face/solid` + module-level getters, `Matrix`
(pure-Python affine), `OrientedBoundBox` (real `Bnd_OBB`),
`GeomEncoder`/`LocationEncoder` (on a pure-Python `json` shim — Brython's
json can't load in a module worker), `DraftAngleError`, `BaseLineObject`,
the four deprecated tangent objects (`PointArcTangentLine`/`Arc`,
`ArcArcTangentLine`/`Arc` — native-parity to 6 decimals),
`project_workplane`, `import_brep`/`export_brep` (BRepTools via MEMFS), and
an honest `FontManager`/`available_fonts` (bundled FreeSans family only);
frozen in `test/python-mode-upstream-exports.spec.js`:

| Area | Supported | Not supported |
|---|---|---|
| Builders | `with BuildPart/BuildSketch/BuildLine(...)` as plain context managers over a module-level stack (nesting, `mode=`, multiple workplanes, pending faces/edges/path), `Mode.ADD/SUBTRACT/INTERSECT/REPLACE/PRIVATE`, `add()` (incl. Locations-context replication into BuildLine), `Select.LAST`/`Select.NEW` for vertices/edges/faces/solids (upstream's `post - pre` bookkeeping; a builder gets a FRESH location context on entry, so an enclosing `Locations` never replicates its result), `Workplanes()` (shares the Locations fanout path — a plane basis IS its Location) | — |
| 3D objects | `Box`, `Cylinder` (incl. `arc_size`), `Sphere`, `Cone`, `Torus`, `Wedge`, `ConvexPolyhedron`, `Hole`, `CounterBoreHole`, `CounterSinkHole` — all with `rotation=`/`align=`/`mode=`; partial `Sphere(r, a1, a2, a3)`; `Solid.extrude_linear_with_rotation` | partial cones |
| 2D objects | `Rectangle`, `RectangleRounded`, `Circle`, `Ellipse`, `Polygon`, `RegularPolygon`, `Triangle` (ported trianglesolver), `Trapezoid`, `SlotOverall`, `SlotCenterToCenter`, `SlotCenterPoint`, `SlotArc`, `Text` (opentype.js/FreeSans, FreeType-parity kerning, incl. `path=`/`position_on_path=`), `ArrowHead`/`HeadType`, `BaseSketchObject`/`BasePartObject` subclassing, `Face(outer_wire, [hole_wires])`, `Face.make_rect`, `Face.make_surface_from_array_of_points`, `Face.radius`/`Face.axis_of_rotation` | `Text(font_path=)`, the rest of `drafting` (`Draft`, `ExtensionLine`, `DimensionLine`, `TechnicalDrawing`) |
| 1D objects | `Line`, `Polyline`, `PolarLine` (incl. `length_mode=` and a limit shape as `length=`), `FilletPolyline`, `IntersectingLine`, `ThreePointArc`, `RadiusArc`, `SagittaArc`, `CenterArc` (a full one is ONE closed edge, like upstream), `TangentArc`, `JernArc`, `Bezier` (incl. weights), `Spline` (EXACT GeomAPI_Interpolate incl. `tangents=`/`tangent_scalars=`/per-point/periodic), `BSpline` (EXACT poles/knots/multiplicities/weights), `DoubleTangentArc`, `BlendCurve` (C0/C1/C2), `Helix`, `EllipticalCenterArc`, `EllipticalStartArc`, `ParabolicCenterArc`/`HyperbolicCenterArc` (incl. the LIMIT form of `arc_size`), `Airfoil` (NACA 4-digit), `ConstrainedArcs`/`ConstrainedLines` (ALL upstream overloads on OCCT's real Geom2dGcc solvers: `radius=`, `center_on=`, three-tangency, `center=`, `radius=`+`center_on=`, two-tangent lines, tangent+point, oriented lines — Tangency qualifiers, trim-range rejection and Sagitta selection), `curve @ u / % u / ^ u` (incl. multi-edge curves and EXTRAPOLATION outside [0, 1]), `Edge.make_line/make_circle/make_mid_way/make_spline/make_bspline/param_at/param_at_point/trim (by point)/trim_to_other`, `derivative_at`, `curvature_comb`, `Mixin1D.normal`, `Wire(edges)`, `Wire.order_edges`/`is_closed`/`param_at_point`, `Edge.arc_center`/`radius`/`is_interior`/`find_tangent`/`find_intersection_points` | conical `Helix` |
| Ops | `extrude` (dir/both/`taper=` — both of upstream's algorithms: LocOpe_DPrism for a positive taper along the normal, otherwise the offset loft — /`until=Until.NEXT/LAST`), `revolve` (arbitrary Axis), `loft`, `sweep` (MakePipeShell: `is_frenet`, `transition=`, `normal=`, `binormal=`, `multisection=True`), `fillet`/`chamfer` (3D edges), `fillet` (2D sketch vertices), `offset` (2D + solid, `openings=`, Kind.ARC/INTERSECTION), `mirror`, `split` (Keep.TOP/BOTTOM), `scale` (uniform about location + non-uniform gp_GTrsf; spec-level inside BuildLine), `make_face`, `make_hull`, `section()`, `draft()`, `project()` (BuildPart pending-faces form), `project_to_shape`, `project_to_viewport` (HLR), `project_faces` (path-on-shape), `find_intersection_points`, `thicken` (see COMPROMISE(thicken)), `bounding_box()`, `pack()`, `offset` (2-D FACE offsets follow upstream's outer/inner-wire branch), `offset(side=Side.LEFT/RIGHT, closed=)` on open lines, `Face.wrap`/`Shape.wrap_faces`, `Face.make_surface`, `Face.make_gordon_surface`, `Face.location_at`/`normal_at`, `Wire`/`Edge.project_to_shape`, `Wire.offset_2d`, `Wire.fillet_2d` (1-D corner fillets, ChFi2d_FilletAlgo), `make_brake_formed`, `full_round`, `edges_to_wires` | `offset(min_edge_length=)` (no `fix_degenerate_edges`), `split(Keep.BOTH)`, screen-projection `project()` forms |
| Locations | full `Location` (matrix-based; 1/2/3-arg incl. axis-angle), `.position/.orientation/.x_axis/.y_axis/.z_axis`, `Axis(Location)`/`Axis(Plane)`, `Pos`, `Rot`/`Rotation`, `Plane` (named planes, `Plane(face)` with the exact gp_Ax3/D1 x_dir rule, `offset()`, `rotated()`), `Locations`, `GridLocations`, `PolarLocations`, `HexLocations`, `Workplanes` (context managers AND iterables, `append()`), `planes * shape`, `locs * shape`; shapes track a composed `.location` (`locate()/located()` are absolute; `.position` settable) | `Location.orientation` edge cases |
| Joints | `RigidJoint`, `RevoluteJoint`, `LinearJoint`, `CylindricalJoint`, `BallJoint` — upstream's exact relative-location algebra; `connect_to` repositions the other part; `copy.copy` AND `Shape.moved` rebind joints; `Compound(joints=)` reparents them; builder-scoped joints transfer to the part on exit; `Joint.symbol`, `Shape.show_topology`, `Compound.do_children_intersect`, `shape.parent = <compound>` | assembly structure / XCAF (roadmap) |
| Selectors | `.edges()/.faces()/.vertices()/.solids()/.wires()` as ShapeLists (a Builder's selectors read the shape built SO FAR, which matters inside a BuildLine) (plus the module-level `edges()`/`vertices()`/… context getters and `Select.ALL/LAST/NEW` on every builder, `new_edges(*objects, combined=)`) with `filter_by` (Axis with DEGREES tolerance/GeomType/Plane/callable/class property), `filter_by_position`, `group_by`, `sort_by` (Axis/SortBy/class property incl. RADIUS, opt-in geometric `tie_break=`), `sort_by(<Edge|Wire>)` (parameter along that shape), `sort_by_distance` (MINIMAL distance), `topo_distance_to`, `GroupBy.group(key)`/`group_for`, slicing, `+` keeps ShapeList; `Face.center_location`/`position_at`/`is_circular_convex`/`is_circular_concave`, `Shape.distance`/`distance_to`/`closest_points` (BRepExtrema); Edge `position_at/tangent_at/@/%` are orientation-aware, `Axis(edge)` raw-curve like upstream | — |
| Canonical edges | `canonical()`/`canonical_form()` on Edge/Wire, `canonical_form(sampler, length, closed)`, `lexicographic_key`, `loop_area_vector`, `CanonicalForm`, `CANONICAL_SAMPLES`/`CANONICAL_BAND`, `Axis(edge, canonical=True)`, `Edge.reversed()`; `Edge.make_mid_way` canonicalizes its references (default-on) and `sort_by(..., tie_break=True)` breaks ties geometrically (opt-in) — defaults exactly as in the patch | automatic merging of C0-continuous free edges (out of scope upstream too — reassemble with `edges_to_wires` first) |
| Algebra | `+ - &` (incl. lists; multi-tool cuts fuse tools first; fuse guarded against the known 8.0.1 drop fault), `Part()/Sketch()/Curve()` empty starters, `Compound(children=)`, `copy.copy`, `Shape.__iter__` | — |
| Measure | `volume/area/length` (volume = per-solid sum), `center()`, `bounding_box()` (exact Bnd_Box), `.wrapped`, `.is_forward` | mass properties |
| Stdlib | `math`, `copy` (incl. `copy.copy(<Builder>)` snapshots), `typing`, `functools`, `itertools`, `operator`, `logging`, `random`/`timeit` (CPython-exact), `os` (PATH ARITHMETIC ONLY — `os.path.join/dirname/abspath/...`, `getcwd`; no filesystem is faked, `os.path.exists` is always False), `scipy.optimize.minimize`/`minimize_scalar` (pure-Python Nelder-Mead / bounded golden-section), `scipy.spatial.ConvexHull` (3-D, bundled quickhull3d), `scipy.spatial.Voronoi` (2-D, Bowyer-Watson Delaunay circumcentres — `.vertices` only, verified vertex-set-identical to scipy on full_round's inputs), `pytest.approx` (real, documented tolerances) | `numpy`, `sympy`, the rest of `pytest`, 2-D `ConvexHull`, Voronoi ridges/regions (raise loudly), everything else |
| Export/import | `Mesher` (STL into worker MEMFS), `export_stl` (MEMFS), `import_step` (assets handed to the worker up front — `CascadeAPI.loadExternalFiles({name: text})`; resolved by base name) | 3MF (no lib3mf — raises), `export_step/gltf` (no-ops), `ExportDXF`, `import_stl`/`import_svg` |

**Known honest gaps** (kept as ERRORs rather than fake geometry — see the
defaults-audit table in report.md for per-script root causes and
upstream-vs-lite defaults comparisons): the `drafting` module beyond
`ArrowHead` (`Draft`, `ExtensionLine`, `DimensionLine`, `TechnicalDrawing` —
`Draft` in docs/objects_2d is the dimension-styling dataclass, NOT the
draft-angle operation, which lite has had for rounds; the port is ~450 code
lines whose accuracy rides entirely on `Compound.make_text` glyph metrics,
since `Text(...).bounding_box().size.X` feeds every arrow position and
`DimensionLine`'s 3-candidate label placement), `sympy`, 3MF export (no lib3mf
in this wasm build — dual_color_3mf builds all six of its shapes correctly and
then fails on `Mesher.write`), `fix_degenerate_edges`/`offset(min_edge_length=)`
and `split(Keep.BOTH)`.
`docs/spitfire_wing_gordon` is a TIMEOUT, not a gap: it runs (real
`pytest.approx` shim) and spends ~390 s building the wing's Gordon surface
before returning a null surface — the cost/robustness of
COMPROMISE(gordon-surface-realization) at that scale. `examples/heat_exchanger`
sits right at the 60 s harness budget (~55 s on an idle machine) and times out
when the four harness pages contend; it passes on its own.
Two scripts die on KNOWN OCCT 8.0.1 wasm kernel faults with byte-identical
defaults to upstream: the truck-body `FilletEdges` (toy_truck) and the
coplanar-BSpline fuse operand drop that even the General-Fuse rebuild cannot
recover (ttt-ppp0110). NOTE for the record: the OTHER "kernel fillet fault",
cast_bearing_unit, turned out to be a LITE bug — a simplified convex hull
handing hundreds of micro-edges to BRepFilletAPI — and now passes, together
with docs-rst/tips/b01.
The remaining MISMATCHes are traversal/orientation history plus two
single-shape residuals: COMPROMISE(edge-orientation) for joints x2, projection
x2 and docs-selectors/sort_axis (sub-edge FORWARD/REVERSED flags and hence
`Axis(edge)` differ from OCP 7.x over identical curve geometry),
COMPROMISE(traversal-order) for docs-selectors/filter_all_edges_circle (the
script keeps the LAST of a mirror-symmetric face pair) and docs-rst/tips/b04 (a
`sort_by(Axis.Z)` over local sketch vertices that is a COMPLETE tie, so the
kernel's enumeration decides), COMPROMISE(triad-labels) for docs/objects_1d,
`m6_screw` alone in docs/tutorial_joints (a `CylindricalJoint` hole frame), and
`l1`/`l2` alone in ttt-23-02-02-sm_hanger (a BuildLine on a non-XY workplane
leaves its module-level line variables in LOCAL coordinates in lite, and the
harness compares the last binding of a reused name). Canonical free edges
(below) shrank two of joints' three residuals (pin_arm 8.16 -> 2.69 mm,
slider_arm 11.80 -> 9.11 mm) without changing any classification; closing the
rest needs the examples to opt into `sort_by(..., tie_break=True)` /
`Axis(edge, canonical=True)`, which is opt-in upstream too.

**Known compromises** (each marked in source with a grep-able
`COMPROMISE(<topic>)` comment — `grep -rn "COMPROMISE(" packages/` is the
authoritative list):
- `scipy-shim` — pure-Python Nelder-Mead/golden-section instead of scipy; all other scipy APIs raise.
- `joints` — location algebra on lite shapes; no assembly tree/XCAF (roadmap), no joint symbols.
- `mesher` — STL only, written into the worker's in-memory Emscripten FS (no lib3mf, no disk).
- `double-tangent-arc` — scan+bisection root solve over a sampled/refined curve distance; trims the over-extended target segment where upstream relies on wire fixing.
- `kernel-guard` — fuse results smaller than the largest input are rebuilt from the (correct) General-Fuse partition; the partition keeps internal contact faces, so selectors see the contact topology.
- `sweep` — trihedron/transition calls match upstream exactly; residual MakePipeShell numeric differences are kernel-version.
- `helix` — exact interpolation through dense samples with analytic tangents (no surface-curve segment type).
- `edge-orientation` — sub-edge FORWARD/REVERSED can differ from OCP 7.x over identical curve geometry; Axis(edge)-based measuring lands at the other end (joints x2, sort_axis) and closed intersection-curve paths traverse the opposite way (projection x2).
- `traversal-order` — where a script keeps whichever of two SYMMETRIC results the kernel enumerated last (filter_all_edges_circle) or resolves a completely TIED `sort_by` (tips/b04), the answer follows OCCT's traversal of lite's construction, not OCP 7.x's of upstream's. `sort_by(..., tie_break=True)` makes it deterministic, and is opt-in upstream too.
- `thicken` — upstream's BRepOffset_MakeOffset Thickening mode is unbound; the same offset shell is built via MakeThickSolidByJoin and the missing side walls are reconstructed as ruled lofts + sewing.
- `project` — only the BuildPart pending-faces form; projected pending planes use the reversed projection direction (validated on maker_coin).
- `text` — bundled FreeSans only; non-Latin glyph metrics may differ from other Arial substitutes.
- `raw-segments` — non-line/circle edges ride through wires as opaque TopoDS edges (exact, but not transformable at spec level).
- `volume-measure` — volume is summed per solid (8.0.1's VolumeProperties picks up stray-face contributions on mixed compounds).
- `gordon-*` (GordonSurface.js) — the ocp_gordon port: curve/curve intersections via GeomAPI_ExtremaCurveCurve, a JS Geom2dAPI_Interpolate reimplementation, conic→non-rational approximation, and `gordon-surface-realization` (the exact tensor-product surface cannot be built as a Geom_BSplineSurface in this wasm build, so it is refit from a dense sample grid with a C2 least-squares approximation scored against the exact surface's area — bracelet's tip lands within 0.02%).
- `projection-sort` / `projected-edge-split` — projected wires are ordered by centre of mass (upstream uses the half-arc-length point), and a projected curve that this kernel splits where it grazes the surface boundary is re-concatenated (build123d's clean() leaves the B-spline-concat flag off).
- `edges-to-wires` — ShapeAnalysis_FreeBounds::ConnectEdgesToWires needs the unbound TopTools_HSequenceOfShape, so edges are chained on their endpoints and each group is ordered by ShapeFix_Wire.
- `failure-decode` — OCCT's C++ exceptions arrive in JS as raw pointer numbers. The fork binds `OCJS::getStandard_FailureData` for exactly this, but it is UNCALLABLE here ("unbound types: St9exception" — `Standard_Failure` derives from `std::exception`, which the build never registers) and no runtime helpers (`HEAPU8`/`getValue`/`UTF8ToString`) are exported, so CascadeWorker keeps the wasm `Memory` via Emscripten's `instantiateWasm` hook and StandardUtils reads `Standard_Failure`'s `StringRef` message out of it directly. Users see e.g. "the OCCT kernel raised 'BRep_API: command not done'" instead of "threw '6454200'".
- `new-edges-partial` — `new_edges()` maps its result back to the corresponding edges OF the combined shape (so it can be filleted like upstream's maker_coin does); an edge that is only PARTLY new has no counterpart and is returned as bare geometry.
- `triad-labels` — `Compound.make_triad` draws the axes and arrow heads exactly, but not upstream's X/Y/Z labels: those need the `singleline` STROKE font, and this build ships only the outline font FreeSans.

**Roadmap (deliberately deferred)**:
- XCAF-based assemblies: real part identities, STEP hierarchy/names/colors, a
  viewport assembly tree, and upgrading joints from location algebra to real
  assembly constraints.
- Real-build123d-over-OCP-shim crossover: revisit once the remaining gap is
  dominated by semantics-replication effort; current blockers are numpy in
  geometry.py and the sheer OCP binding surface.

**Canonical free edges**: lite implements the upstream *canonical free-edge
parametrization* proposal (research record + patch in
`docs/upstream-canonical-edges/`). A free edge — one produced by a section,
projection or boolean rather than drawn — inherits the seam, direction and
parameter range the kernel found convenient, and those depend on the parametric
frames of the operand surfaces, so `position_at(0)` / `Axis(edge)` move when a
geometrically identical solid is re-framed. `edge.canonical()` returns the same
geometry traversed from a geometry-defined start: open shapes from the
lexicographically smaller end; closed shapes from the arc-length midpoint of the
extremal band `{x ≤ x_min + 1e-6·bbox}`, where the candidate bands are the
**local minima** of the sampled coordinate (plateaus collapsed), each
bisection-refined to its midpoint, and the midpoints are ranked with the
remaining coordinates **quantised to the band width** so a mirror-symmetric pair
ties on `y` and `z` decides (x→y→z fall-through for flat loops); winding CCW
about the dominant axis of the loop's area vector. **Defaults match the patch exactly**:
`canonical()`, `Axis(edge, canonical=True)` and `sort_by(..., tie_break=True)`
are opt-in (the default sort stays a plain stable sort, so chained
`sort_by(SortBy.RADIUS).sort_by(Axis.Z)` keeps working), while
`Edge.make_mid_way`'s canonicalization is unconditional. The `tie_break` key is
the shape's vertex positions sorted+rounded to 6 digits, with `center()` as a
second stage, computed only inside a tie group. Re-seaming a closed loop needs
one substitution, not a compromise: `GeomConvert_CompCurveToBSplineCurve` is
unusable here (`Convert_ParameterisationType` is an unbound Embind type), so
`ConcatEdgesToEdge` (StandardLibrary.js) does the concatenation itself —
exactly, converting analytic conics through the rational-quadratic construction
and degree-raising with OCCT's `IncreaseDegree`. Verified against PATCHED
upstream build123d on OCP 7.9.3: 185 canonical measurements agree to
**0.00e+0 mm** while the raw seams differ
(`test/b123d-validation/canonical-cross-kernel.mjs`, reference generated by
`docs/upstream-canonical-edges/experiments/lite_cross_kernel.py`). Frozen in
`test/python-mode-canonical.spec.js`.

**GUI tools in Python mode**: Box/Cylinder/Sphere emit `name = Pos(cx, cy, cz) *
Primitive(...)` — since build123d primitives are centered, the emission converts the
dragged corner/base placement into the shape's center. Fillet emits
`var = fillet(var.edges(indices=[...]), r)`. The **Sketch tool stays JS-only** (it emits
a `new Sketch(...)` builder chain): in Python mode its toolbar button is grayed
(`cs-tool-disabled`) and its tooltip says "not available in Python mode yet (switch to
CascadeStudio JS mode)"; `ToolManager.activate('sketch')` refuses with a console error.
See `test/python-mode.spec.js`.

**Validation against real build123d**: `test/b123d-validation/` (see its README)
runs the upstream build123d examples through BOTH real build123d 0.11.1 (native
venv) and Python mode, comparing per-variable volume/bbox. Re-run it whenever
Build123dLite.js changes. FIFTY representative passing scripts are frozen
as regression tests in `test/python-mode-examples.spec.js` (part of the default
suite) with volumes/bboxes hardcoded from the native run — the newest five cover
`Wedge`/`ConvexPolyhedron`, `Triangle`, the parabolic/hyperbolic arcs,
slide_latch (sketch-face alignment + `Select.LAST` vertices) and
group_properties_with_keys (builder copy snapshots + the exact convex hull +
`GroupBy.group`).

## Playwright Testing

WebGL requires `--use-gl=angle --use-angle=swiftshader` in playwright.config.js launch args.

Environment overrides (for machines where the defaults don't work):
- `CS_TEST_PORT=8517` — test server port (default 8080; use when 8080 is occupied)
- `CS_TEST_HEADFUL=1 DISPLAY=:99` — run headful against an X server (use when headless
  Chromium cannot create a SwiftShader WebGL context, as on this machine)

```javascript
await page.goto('http://localhost:8080');
await page.waitForFunction(() => window.CascadeAPI?.isReady());
await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });

// Use runCode for tests (combines setCode + evaluate + getErrors):
const result = await page.evaluate((code) => CascadeAPI.runCode(code), myCode);
expect(result.errors).toEqual([]);

// Screenshots:
await page.evaluate(() => CascadeAPI.saveScreenshot('model.png'));
// View with Read tool at .playwright-mcp/model.png
```

## CAD Modeling — Common Pitfalls

### 1. Loft() Prefers TopoDS_Wire

`Loft()` works best with wires. After transforms (Translate, Rotate), shapes become
generic `TopoDS_Shape` even if they started as wires. Loft now auto-extracts wires
with a warning, but for clearest code use `GetWire()` explicitly:

```javascript
let w1 = Circle(10, true);
let w2 = Translate([0,0,10], Circle(5, true));
Loft([GetWire(w1), GetWire(w2)]);
```

### 2. FilletEdges() Must Be Applied Before Hollowing

When filleting a solid shape, apply FilletEdges BEFORE boolean operations that
create internal geometry. After Difference/Union, the edge topology changes and
the selector may not find the edges you expect.

```javascript
// GOOD: Fillet the solid tray, then hollow it
let tray = Extrude(face, [0, 0, height]);
tray = FilletEdges(tray, 2, Edges(tray).max([0,0,1]).indices());
tray = Difference(tray, [cavity]);  // Hollow after filleting

// BAD: Fillet after hollowing — edges may not be found
let tray = Extrude(face, [0, 0, height]);
tray = Difference(tray, [cavity]);
tray = FilletEdges(tray, 2, Edges(tray).max([0,0,1]).indices());  // May fail!
```

### 3. Offset() on Faces Returns a Wire/Face, Not a Solid

`Offset(face, distance)` returns a 2D offset of the face boundary. To create a
hollow solid, offset the face and extrude separately:

```javascript
let inner = Offset(outerFace, -wallThickness);
let cavity = Translate([0, 0, wall], Extrude(inner, [0, 0, height]));
solid = Difference(solid, [cavity]);
```

### 4. Negative Volume from Face Orientation

`Volume()` may return a negative value if the shape's face normals are inverted.
This is cosmetic — use `Math.abs(Volume(shape))` if you need the magnitude.

### 5. Sketch Fillet Order

Sketch `.Fillet()` must be called AFTER `.LineTo()` — it fillets the corner at
the most recent vertex. Calling `.Fillet()` before any lines will fail silently.

```javascript
new Sketch([-10, -10])
  .LineTo([10, -10]).Fillet(5)    // Fillet the corner at [10, -10]
  .LineTo([10,  10]).Fillet(5)    // Fillet the corner at [10,  10]
  .End(true).Face();
```

### 6. Transforms Return New Shapes

`Translate()`, `Rotate()`, `Scale()`, `Mirror()` return new shapes. If you pass
`keepOriginal: true` (3rd param for Translate/Rotate), the original stays in
`sceneShapes` AND you get a copy. By default, the original is consumed.

### 7. Circle(r, true) vs Circle(r, false)

- `Circle(r, true)` → wire (for Loft, Pipe, RotatedExtrude profiles)
- `Circle(r, false)` or `Circle(r)` → face (for Extrude, Revolve)

### 8. Scale() Takes a Scalar, Not a Vector

`Scale(factor, shape)` only accepts a single number, not `[x, y, z]`.
Non-uniform scaling is not supported. Passing an array now logs an error and
falls back to `scale[0]` instead of producing a null shape.

### 9. BSpline for Pipe Paths

`BSpline(points, closed)` creates a smooth curve through the given points.
Use `closed: false` for open paths (Pipe rails) and `closed: true` for rings.

### 10. Union() Works Best with Overlapping Shapes

`Union(shapes)` performs a boolean fusion. Non-overlapping shapes may produce
unexpected results. All boolean operations (Union, Difference, Intersection)
now include volume sanity checks that warn when the result is near-zero.

```javascript
// Keep non-touching shapes as separate scene objects
let tray = Extrude(face, [0, 0, 30]);
let holder = Translate([60, 0, 0], Cylinder(15, 50));
// Both render in the scene without Union
```

### 11. Extrude() Consumes the Input Face

`Extrude(face, direction)` consumes the face by default (`keepFace=false`).
If you need to reuse the face later (e.g., for `Offset()`), either pass
`keepFace: true` or recreate the profile from a new Sketch.

```javascript
// BAD — outerFace is consumed, Offset fails
let outerFace = new Sketch(...).End(true).Face();
let tray = Extrude(outerFace, [0, 0, 30]);
let inner = Offset(outerFace, -3);  // outerFace is gone!

// GOOD — recreate the inner profile independently
let tray = Extrude(outerFace, [0, 0, 30]);
let innerFace = new Sketch(/* smaller dimensions */).End(true).Face();
```

### 12. Sketch Plane Parameter for Revolve Profiles

`new Sketch([x,y], 'XZ')` draws in the XZ plane — `[x,y]` maps to `[X, 0, Z]` in 3D.
This is the correct way to create revolve profiles (lathe-turned parts):

```javascript
// GOOD: Sketch in XZ plane, then Revolve around Z axis
let profile = new Sketch([0, 0], "XZ")
  .LineTo([15, 0]).LineTo([15, 2])
  .LineTo([10, 8]).LineTo([0, 8])
  .End(true).Face();
Revolve(profile, 360);

// BAD: Default Sketch (XY plane) + Revolve around Z = flat concentric circles
let profile = new Sketch([0, 0])
  .LineTo([15, 0]).LineTo([15, 8]).LineTo([0, 8])
  .End(true).Face();
Revolve(profile, 360);  // Produces a flat disk!
```

Supported planes: `'XY'` (default), `'XZ'`, `'YZ'`.

### 13. Null Shape Cascading Errors

If any operation produces a null shape (e.g., from bad Scale, failed Fillet, etc.),
subsequent operations that consume it will fail. Most functions (Extrude, FilletEdges,
ChamferEdges, Offset, Pipe, Difference) now check for null inputs and log a
descriptive error with early return instead of cascading cryptic failures.

## Iterative Model Development Workflow

When building a model interactively via Playwright:

1. **Build**: `npm run build`
2. **Start server**: `npx http-server ./packages/cascade-studio/dist -p PORT -c-1 --silent`
   - Use `-c-1` to disable caching
   - Use a **new port** if changing JS code — browsers cache ESM aggressively
3. **Navigate**: `page.goto('http://localhost:PORT')`
4. **Wait for WASM**: `await page.waitForFunction(() => window.CascadeAPI?.isReady())`
5. **Inject code**: `page.evaluate((c) => { CascadeAPI.setCode(c); }, code)`
6. **Evaluate**: `await page.evaluate(() => CascadeAPI.evaluate())`
7. **Wait**: `await page.waitForFunction(() => !CascadeAPI.isWorking())`
8. **Check errors**: `page.evaluate(() => CascadeAPI.getErrors())`
9. **Screenshot**: `CascadeAPI.saveScreenshot("model.png")` → view with Read at `.playwright-mcp/model.png`
10. **Camera angle**: `CascadeAPI.setCameraAngle(azimuth, elevation)` to rotate (0=front, 90=right)
11. **Iterate**: Fix errors, re-inject, re-evaluate

### Screenshot Download Pattern

```javascript
// Simple: one-line screenshot (auto-fits camera, collapses GUI)
await page.evaluate(() => CascadeAPI.saveScreenshot('model.png'));
// View with Read tool at .playwright-mcp/model.png

// With custom camera angle:
await page.evaluate(() => {
  CascadeAPI.setCameraAngle(90, 30);  // right side, 30° elevation
  CascadeAPI.saveScreenshot('model-side.png');
});
// View with Read tool at .playwright-mcp/model-side.png
```

**NEVER** use Playwright `browser_take_screenshot` — it captures the full page UI.
**NEVER** use `browser_run_code` for mouse dragging — use `setCameraAngle()` instead.

### History Step Screenshots

```javascript
const steps = await page.evaluate(() => CascadeAPI.getHistorySteps());
// steps = [{fnName: "Extrude", lineNumber: 18, shapeCount: 1}, ...]

// Screenshot a specific build step:
await page.evaluate(() => CascadeAPI.screenshotHistoryStep(0)); // First step
// Then download via the pattern above

// Return to final result:
await page.evaluate(() => CascadeAPI.showFinalResult());
```

## Build System

- **Bundler**: esbuild (ESM, minified, source maps)
- **Monorepo**: npm workspaces (`packages/cascade-core`, `packages/cascade-studio`)
- **cascade-core build** (`packages/cascade-core/scripts/build.cjs`):
  - Bundles `src/worker/CascadeWorker.js` → `dist/cascade-worker.js`
  - Copies WASM + fonts to `dist/`
- **cascade-studio build** (`packages/cascade-studio/scripts/build.cjs`):
  - Bundles `src/main.js` → `dist/main.js`
  - Copies cascade-core dist, Monaco, type defs, static assets
  - Generates `dist/index.html`
- **Output**: `packages/cascade-studio/dist/`

## URL Encoding & Mode Defaults

Projects can be shared via URL: `?code=<encoded>&gui=<encoded>&mode=python`

- `code` / `gui`: `encodeURIComponent(btoa(deflateSync(text)))` (using fflate).
  Decoding: `inflateSync(atob(decodeURIComponent(encoded)))` (compatible with master's
  RawDeflate). A missing/malformed `gui` is tolerated.
- `mode`: **plain, human-readable** — one of `CascadeStudioApp.MODES`
  (`cascadestudio` | `openscad` | `python`). Written by the save-to-URL path
  (F5 / Ctrl+S → `EditorManager.evaluateCode(true)`).

Mode resolution (`CascadeStudioApp.initialize`, tested in `test/modes-and-urls.spec.js`):

| Load                              | Mode                                        |
|-----------------------------------|---------------------------------------------|
| no params, no project             | `python` (`CascadeStudioApp.DEFAULT_MODE`)  |
| `?code=…` **without** `&mode=`    | `cascadestudio` — legacy links predate mode serialization and must not be captured by the Python default |
| `?mode=…` (with or without code)  | that mode (unknown value → default)         |
| saved project `_cascadeState.mode`| that mode (legacy project files → `cascadestudio`) |

Starters live on the app class (`STARTER_CODE`, `OPENSCAD_STARTER_CODE`,
`PYTHON_STARTER_CODE`, dispatched by `CascadeStudioApp.starterCode(mode)`); all three
must evaluate with zero errors. `saveProject()` serializes `mode` alongside the code.

## Key Dependencies

- **opencascade.js**: Custom fork of OCCT 8.0.1 compiled with emsdk 4.0.23
  (branch `cascadestudio-v3-occt801` of the fork checkout; the build pipeline
  and the reason each hand-registered symbol exists are in its CHANGELOG.md.
  The worker cross-checks `USED_OCCT_SYMBOLS` against the module at startup, so
  a renumbered overload or a silently-dropped binding fails loudly.)
  - See `node_modules/opencascade.js/CLAUDE.md` for build details
- **Three.js r170**: 3D rendering (matcap material, OrbitControls)
  - `THREE.ColorManagement.enabled = false` for legacy rendering
- **Monaco Editor**: Code editor with TypeScript IntelliSense
- **Dockview**: Panel layout system (replaces Golden Layout)
- **Tweakpane v4**: GUI controls (sliders, checkboxes)
- **fflate**: DEFLATE compression for URL encoding

## Blind Agent Tests

Test that a fresh agent can discover and use the CascadeAPI without reading local files.
Run in the background so you can continue working:

```javascript
// 1. Build and start server
npm run build
npx http-server ./packages/cascade-studio/dist -p 8113 -c-1 --silent &

// 2. Launch via Task tool
Task({
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  description: "Blind agent test",
  prompt: `You are testing a browser-based CAD application at http://localhost:8113
Your task: Model a chess knight piece. Make it recognizable and detailed.
Instructions:
1. Navigate to the app
2. Wait for it to load
3. Discover the API by reading the page
4. Build the knight iteratively — run code, check errors, take screenshots to verify
5. Use multiple camera angles to verify from different sides
6. Save a final screenshot when satisfied
Important: Do NOT read any local project files. Discover everything through the browser.`
})
```

**Success criteria**: 0 uses of `browser_take_screenshot` and `browser_run_code`, multiple uses of `saveScreenshot` and `setCameraAngle`.
