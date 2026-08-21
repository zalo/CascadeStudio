# STAGE 3 — upstream geometry.py + topology/*.py VERBATIM (pytopo=upstream)

**State as of this checkpoint: Phase 3 (the grind), mid-flight.**
Branch `feat/upstream-full-topology`. Default pytopo stays `lite`
(`PYTOPO_DEFAULT` in UpstreamB123d.js); nothing in the default modes moved.

## Phase log

| Phase | Status |
|---|---|
| 0 — merge feat/micropython-metaclasses | DONE. Conflicts per plan; enum shim's JsProxy member handling ported into BOTH EnumMeta and the fallback (topo-poc t7 caught it). Metaclass probe green in the worker. |
| 1 — upstream geometry.py verbatim | DONE (landed with Phase 2 as a unit). numpy micro-shim serves `Axis._intersect_axis`/`color_wheel`; AxisMeta/PlaneMeta run natively; new transforms: multi-line TypeAlias blanking, value/tuple-capture match patterns (multi-line guards, walrus binding), general PEP-448 list-splat displays, PEP-604 `isinstance(x, A | B)` tuples. topo-poc t9 covers Vector/Axis-intersect/Plane round-trips/Location-Euler/Rotation/Matrix/BoundBox. |
| 2 — topology as a unit + worker glue | DONE (bring-up). All 8 upstream topology modules + verbatim `topology/__init__.py` registered bottom-up under pytopo=upstream; seam adapters now load ONLY under pytopo=lite. Worker glue `ocp_shim/topo_glue.py`: show()/sceneShapes (raw-TopoDS unwrap, lite semantics), implicit post-run scene (`_cs_after_run`), `_measure_globals_json` (harness contract), export_stl/brep + import_step/brep + Mesher, `Compound.make_text` -> lite opentype path, `Face.make_gordon_surface` -> GordonSurface.js. History seam: `StandardUtils.recordExternalOp` + OCP-shim op-family recording (BRepPrimAPI/BRepAlgoAPI/... ctors) + TopoDS return tagging (`producingLine` -> pick->line works). Kernel-guard ported to the shim's Fuse path (SetArguments/SetTools operand tracking, Shape() volume guard, GF rebuild on drop/raise). |
| 3 — the grind | IN PROGRESS, see score progression. |
| 4 — gates + flip decision | NOT STARTED. |

## Harness score progression (222 scored; baselines: lite 206/10/5/1, upstream-Level-A-over-lite 205/10/5/2)

| Round | PASS | MISMATCH | ERROR | TIMEOUT | What landed before it |
|---|---|---|---|---|---|
| r1 | 112 | 10 | 95 | 5 | the bring-up itself (202 s wall, 4 pages) |
| r2 | 143 | 13 | 59 | 7 | ConnectEdgesToWires out-handle GLUE (every Polyline died -> 27 scripts), sum(start=), _GenericMeta `__or__`, list+ShapeList concat coercion, _cs_prop_get, structural-Iterable fixup, isEmbind hardening |
| r3 | 180 | 12 | 24 | 6 | OcpProxy.__hash__ = OCCT HashCode (explorer dedup — selectors were DOUBLED; fixed the 24-script fillet-vertex cluster + selector inflation everywhere) |
| r4 | 188 | 15 | 12 | 7 | anytree attach-hooks (Compound(children=) was EMPTY -> project_to_viewport family), Geom_Surface inspection GLUE (dropped concrete surface classes), AsGeomSurface deref, HArray2->Array2, enum ordering, float_info |
| r5 | 203 | **1** | 11 | 7 | insertion-ordered dedup (MicroPython dicts are UNORDERED — faces()/edges() were SCRAMBLED: the whole ex33/ex34/logo MISMATCH family), glue enum bridge + align translation |
| r6 | 204 | 1 | 12 | 5 | (r5's tree + ArrowHead/b12/b10-format/user-code-concat partials) |
| r7 | **209** | 3 | 5 | 5 | hasher functor rebind, deque(maxlen), ljust, ArrowHead-as-upstream-Sketch, chained concat |
| r8 | (running) | | | | TypeMismatch/ConstructionError exception mapping (twist_extrude, slide_latch), **the jsffi integral-double FFI fix** (PROVENANCE patch 9: integral JS doubles >= 2^31 crossed into Python WRAPPED to int32 — 1e15 -> -1530494976, 1e100 -> 0; found via Edge(Axis) parameter ranges), MakeEdge unbounded-line glue (b10) |

**The single r5+ MISMATCH is docs/objects_1d — the baseline residual
(triad labels + DTA trim). Upstream topology FIXED lite's other residual
mismatches (joints x2, projection x2, sort_axis, filter_all_edges_circle,
tips/b04, sm_hanger — all PASS under pytopo=upstream).**

## Key architecture facts (for whoever resumes)

- Loader: `UpstreamB123d.js` step 6 branches on pytopo. Upstream topology
  submodules registered bottom-up under a placeholder `__init__`, then the
  real verbatim `__init__.py` replaces the file and the package reloads.
  `build123d.text` is an import-satisfying stub (kernel fonts are a
  PERMANENT-SKIP; make_text routes to lite via glue).
- `_finalize.py` branches on `build123d._cs_pytopo`: glue hooks vs lite
  hooks; upstream draft()/DoubleTangentArc run VERBATIM under pytopo
  (DTA over the scipy Nelder-Mead shim — maker_coin's BuildLine works);
  Airfoil stays a lite-computed override (adopts edges as upstream shapes).
- topo_bridge.py stays loaded (lite interop: lite Shape.wrapped proxies,
  _Fn `_ref` unwrap); its seam shape_core fills are hasattr-guarded off.
- pybind-parity added to the shim this stage: operator dunders (* + - / neg),
  `__hash__` = OCJS.HashCode for TopoDS (cached per proxy), collection
  protocols attached per-class in topo_glue (NOT on OcpProxy — that flips
  callable()/iter() duck-typing), GetEulerAngles glue (Intrinsic_XYZ,
  matrix extraction, round-trips exact), BOPAlgo setter no-ops
  (SetRunParallel exact; SetFuzzyValue/SetNonDestructive =
  COMPROMISE(fuzzy-value) — Compound.__add__ requests fuzzy 1e-6 upstream,
  we run at default precision. FORK ASK candidate), Quantity_Color plain-JS
  stand-in (class dropped by the fork build — FORK ASK candidate),
  ConnectEdgesToWires out-handle GLUE.
- MicroPython gaps closed by transform/builtins: sum(start=), format(),
  round(__round__), cls.__new__(cls), property __get__ (identity walk),
  PEP-604 unions, list+list-subclass concat, match value/capture patterns.
- collections.abc Iterable is structurally extended at _finalize time
  (build123d classes with an INSTANCE __iter__) and rebound in importers.

## r7 classification vs the baseline band (205/10/5/2)

- **PASS 209 > 205.** Upstream topology ADDITIONALLY passes lite's residual
  set: joints x2, projection x2, sort_axis, filter_all_edges_circle,
  tips/b04(→MM parity), sm_hanger, toy_truck, ttt-ppp0110 — the
  COMPROMISE(edge-orientation)/(traversal-order) families largely RESOLVE
  when upstream's own traversal runs.
- MISMATCH 3 (baseline 10): objects_1d (baseline residual, same),
  tutorial_joints (baseline MISMATCH too; ours adds a hinge_inner 160-off —
  joints magnitude differs), tips/b04 (identical residual delta 0.2).
- ERROR 5 (baseline 5): dual_color_3mf / objects_2d / curved_support are
  BASELINE-PARITY errors; spitfire is ERROR here vs baseline TIMEOUT
  (gordon returns null fast instead of grinding past budget); b10 was the
  jsffi integral-double bug — FIXED after r7.
- TIMEOUT 5 (baseline 2): heat_exchanger (baseline contention flap, same);
  bicycle_tire (4m10s solo — thicken/wrap in Python x envelope),
  clock (text+fillet heavy), algebra_performance b01+all (upstream's OWN
  quadratic re-fuse — Compound.__add__ refuses ALL top-level shapes each
  step — x the FFI envelope; b01 is 148 s solo vs 15 s for pytopo=lite,
  which single-fuses. PERF is the honest remaining gap.)

## Known open items (next actions, in order)

1. r8 results (in flight): expect b10 + twist_extrude + slide_latch fixed
   (jsffi fix + exception mapping) — potentially 211-212 PASS / ~3 ERROR.
2. Phase 4 gates NOT yet run: pytopo=lite harness re-verification
   (205/10/5/2 per-script — CRITICAL after the jsffi number fix, which
   touches the shared interpreter), pysrc=lite control, fast spec gate,
   full playwright suite. THEN the flip decision (perf TIMEOUTs argue for
   default-off this round; the per-script shortfall is 4 scripts of perf
   + tutorial_joints magnitude + spitfire reclassification).
3. Perf: the remaining lever is the FFI envelope x upstream's Python-heavy
   hot loops (VM self-time dominates profiles). Candidates: batch
   ListOfShape appends, cache geom_adaptor, MicroPython native-emitter for
   hot topology modules (interpreter-side, next rebuild).
4. history-step SNAPSHOTS under pytopo are end-of-run only (scene is
   glue-assembled); fnName/line are correct. Recorded as honest partial.
5. Boot cost: libMs ~600 ms (vs ~305 pre-Stage-3); heap 16 MB holds
   (32 MB experiment showed no win).
6. FORK-ASKS Stage-3 addendum WRITTEN (Quantity_Color, BOPAlgo setters,
   concrete Geom surface classes, IndexedDataMap Extent, ConnectEdgesToWires
   out-handle, GetEulerAngles helper, ListOfShape iteration).

## How to run things

- Inner loop: `node experiments/upstream-topology-spike/topo-poc.mjs`
  (10 tests, ALL OK expected; single test/script arg supported; B123D_SRC
  defaults to the 0.11.1 ref venv).
- Harness: `B123D_SRC=~/Desktop/build123d CS_PY_RUNTIME=micropython
  CS_PY_TOPO=upstream CS_TEST_HEADFUL=1 DISPLAY=:99
  node test/b123d-validation/run-lite.mjs --port 842X --pages 4
  --out /tmp/pytopo-up-rN.json --report /tmp/pytopo-up-rN.md`
  (npm run build first; ports 8421-8429 only).
- Fast gate: `CS_TEST_PORT=8421 CS_TEST_HEADFUL=1 DISPLAY=:99 npx
  playwright test test/python-mode.spec.js test/py-runtime.spec.js
  test/py-src-upstream.spec.js`.
