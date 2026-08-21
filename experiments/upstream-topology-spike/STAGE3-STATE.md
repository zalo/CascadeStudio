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
| r3 | (running) | | | | OcpProxy.__hash__ = OCCT HashCode (explorer dedup — selectors were DOUBLED; fixed the 24-script fillet-vertex cluster), collection protocols on specific proxy classes, Quantity_Color stand-in, 2-D ConvexHull, sort_by(property), format() |

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

## Known open items (next actions, in order)

1. r3 results triage. Expected remaining clusters from r2: ZeroDivision x3
   (logo scripts — user-code line, uninvestigated), AttributeError IsNull x2,
   AssertionError x2, GeomAPI_Point ctor x2 (truncated name — probably
   GeomAPI_PointsToBSpline* unbound path), `symbols` x1 (Joint.symbol
   family), ContinuityLevel `__ge__` x1 (enum ORDERING — shim _Member has no
   ordering; add int-value comparison), sys.float_info x1,
   make_mid_way arg-count x1, 'None is not a valid Align' x1,
   'NoneType not subscriptable' x1, kernel raise x1, max_fillet x1,
   widths x1. TIMEOUTs grew 5 -> 7 (heat_exchanger + algebra_performance/
   group_axis — check whether shim overhead or contention).
2. MISMATCH set (13 at r2) — compare against lite's residual set
   (joints/projection/sort_axis families) once ERRORs are thinner.
3. history-step SNAPSHOTS under pytopo are end-of-run only (scene is
   glue-assembled); fnName/line are correct. Recorded as honest partial.
4. Boot cost: libMs ~600 ms (vs ~305 pre-Stage-3); heap 16 MB holds so far
   (watch algebra_performance TIMEOUTs for GC pressure —
   consider MP_HEAP_BYTES bump if pythonWasm memoryStats show pressure).
5. Phase 4 gates not run yet: pytopo=lite harness re-verification
   (206/10/5/1 per-script), pysrc=lite control, Brython control, full
   playwright suite, then the flip decision.
6. FORK-ASKS addendum to write: Quantity_Color (skip Vec3 ctor),
   BOPAlgo_Options::SetFuzzyValue/SetNonDestructive/SetRunParallel,
   ShapeAnalysis_FreeBounds::ConnectEdgesToWires out-handle form (or keep
   the GLUE), BRepExtrema ParOnEdgeS1 (pre-existing PENDING).

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
