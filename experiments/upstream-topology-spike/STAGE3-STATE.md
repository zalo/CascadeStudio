# STAGE 3 — upstream geometry.py + topology/*.py VERBATIM (pytopo=upstream)

**State: FLIPPED. `pytopo=upstream` is the DEFAULT** (PYTOPO_DEFAULT +
resolvePyTopo; `?pytopo=lite` opts out; missing ocp_shim payload
warns-and-falls-back). Post-flip default-leg harness: **216 PASS /
2 MISMATCH / 3 ERROR / 1 TIMEOUT** — every non-PASS is a documented
honest gap (objects_1d + tips/b04 residual mismatches; dual_color_3mf
lib3mf / objects_2d drafting / curved_support sympy; spitfire gordon
TIMEOUT). Branch `feat/upstream-full-topology`.

## The perf round that unlocked the flip (2026-08-21)

The 4 perf TIMEOUTs were NOT VM-bound: a symbolized profile (interpreter
JSFLAGS_EXTRA + --profiling-funcs) showed the BRIDGE PROTOCOL —
mp_jsffi_to_js + the mp->js proxy registry (mp_map_lookup 27% +
mp_obj_equal 15%, one EM_JS round-trip per temp-list registration) and the
{ok,value} record's two 'get' traps per call. Fixes:
- the variadic no-proxy fast path: _csMpCallV + _csOcpNewV/CallVar/StaticV
  (scalar/JsProxy args cross individually; sentinel error returns;
  container/kwargs keep the deep path) across browser._Fn,
  topo_bridge._fn_call and ocp_core;
- _CsOrderedStore replaces OrderedDict in the dedup transforms
  (MicroPython ordered maps do LINEAR lookup — the r5 fix had made
  _topods_entities O(n^2));
- interpreter codegen levers measured and REJECTED (cgoto ~4%, -O3 ~3%
  at +18% size, 256 MB heap ~4%).
Solo: b01 148->18 s, bicycle_tire 250->29 s, group_axis 34->7.7 s,
clock TIMEOUT->21.6 s. Full harness wall 158 s.

Interpreter repo (micropython-cs, cs-patches-v1.28.0, NOT pushed):
patch 9 landed properly as `83f1550` (out-of-int32 integral JS numbers
convert as floats + tests/ports/webassembly/int_large.mjs) and `7f63764`
(JSFLAGS_EXTRA); artifacts re-vendored from source, PROVENANCE updated.

Also fixed en route: tutorial_joints (Compound(joints=) REPARENTS joints —
pybind's downcast returns the same C++ object, embind casts copy, so
connect_to's in-place locate() didn't move the new wrapper), and flap
armor (gp_* ctor failures -> Standard_ConstructionError BY SITE;
StandardUtils.Remove tolerates raising property traps).

## Final gate battery (2026-08-21, post-flip, all on this tree)

| leg | classification | per-script |
|---|---|---|
| DEFAULT (micropython, pytopo=upstream) | **216 / 2 / 3 / 1** | non-PASS = the documented honest gaps ONLY: objects_1d + tips/b04 (residual MM), dual_color_3mf (lib3mf) + objects_2d (drafting, lands on 'NameError: Draft') + curved_support (sympy), spitfire (gordon TIMEOUT) |
| pytopo=lite (CS_PY_TOPO=lite) | 206 / 10 / 5 / 1 | per-script = the committed upstream-Level-A set exactly; heat_exchanger lands PASS-side of its documented flap (faster bridge) |
| pysrc=lite | 206 / 10 / 5 / 1 | per-script IDENTICAL to the committed lite set |
| Brython control | 206 / 10 / 5 / 1 | per-script IDENTICAL to the committed lite set |
| full playwright suite | **96 passed / 1 skipped** | two spec updates were REQUIRED-AND-HONEST: Curve.length was a lite-only extension (REAL 0.11.1 raises AttributeError — verified in the ref venv) and bbox tuples print ints for in-int32 integral jsffi numbers |

## Flip decision (this run): DEFAULT STAYS pytopo=lite

pytopo=upstream EXCEEDS the baseline on fidelity (+9 scripts incl. lite's
entire COMPROMISE(edge-orientation)/(traversal-order) residual set; only
2 MISMATCH / 3 ERROR, all baseline-family). The honest shortfall is PERF:
4 scripts regress PASS/MM -> TIMEOUT (clock, algebra_performance b01+all,
bicycle_tire — bicycle_tire is 4m10s solo vs the 60 s budget;
b01 is 148 s vs 15 s under pytopo=lite because upstream's own
Compound.__add__ re-fuses ALL top-level shapes each step and the
FFI-envelope multiplies the quadratic Python term). Profiles show
MicroPython VM self-time dominating (~70%), not the shim dispatch.
Flip when the perf work lands (see next actions).

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
| r8 | 210 | 3 | 3 | 6 | TypeMismatch/ConstructionError exception mapping (twist_extrude, slide_latch), **the jsffi integral-double FFI fix** (PROVENANCE patch 9: integral JS doubles >= 2^31 crossed into Python WRAPPED to int32 — 1e15 -> -1530494976, 1e100 -> 0; found via Edge(Axis) parameter ranges), MakeEdge unbounded-line glue (b10) |
| r9 | **210** | **2** | **3** | 7 | None-valued enum members (Align.NONE = None IS a member — objects_sketch defaults) |

**Final r9 per-script classification**: MISMATCH = objects_1d,
tutorial_joints (both baseline-family). ERROR = dual_color_3mf, objects_2d,
curved_support (exactly 3 of the baseline's 5 — toy_truck and ttt-ppp0110
now PASS). TIMEOUT = heat_exchanger + spitfire (the baseline TIMEOUT set)
+ bicycle_tire/clock/algebra_performance-b01/all (PERF — the honest
shortfall) + selectors_operators (one-run contention flap; PASS in r7/r8).

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

1. **PERF (the flip blocker)**: bicycle_tire (250 s solo), clock (text +
   sequential 2-D fillets), algebra_performance b01/all (quadratic re-fuse).
   Profile shows MicroPython VM self-time ~70% (wasm-function[462] et al.),
   proxy conversion ~5%, GC ~1% — the cost is EXECUTING 19.8k lines of
   upstream Python per hot loop, not the dispatcher. Levers, in rough order
   of value: (a) MicroPython native-emitter (@micropython.native) or
   frozen-bytecode for topology modules — interpreter-side, next
   micropython-cs rebuild (also carry PROVENANCE patch 9 forward properly);
   (b) targeted memoization of upstream hot properties (geom_adaptor,
   wrapped-downcast) via loader transforms; (c) a lighter guarded-call
   envelope (single FFI hop) for _BoundMethod.
2. tutorial_joints MISMATCH magnitude (hinge_inner bbox off 160 —
   worse than the baseline's m6_screw-only residual): joint connect_to
   family, uninvestigated.
3. spitfire is TIMEOUT here like baseline (gordon at wing scale);
   selectors_operators flapped TIMEOUT once under contention (PASS solo,
   r7/r8).
4. history-step SNAPSHOTS under pytopo are end-of-run only (scene is
   glue-assembled); fnName/line are correct. Recorded as honest partial.
   GUI pick->line works via TopoDS producingLine tagging.
5. Boot cost: libMs ~600 ms (vs ~305 for the pre-Stage-3 pytopo=upstream,
   ~123 ms lite); heap 16 MB holds (32 MB experiment: no win).
   runtime-comparison.md not yet updated with the full-stack numbers.
6. FORK-ASKS Stage-3 addendum WRITTEN (Quantity_Color, BOPAlgo setters,
   concrete Geom surface classes, IndexedDataMap Extent, ConnectEdgesToWires
   out-handle, GetEulerAngles helper, ListOfShape iteration).
7. INVENTORY line-count accounting for the eventual flip: the pytopo=lite
   seam that upstream topology makes obsolete is ~1,170 lines
   (topology/__init__ 774 + geometry seam 242 + constrained_bridge 141 +
   sub stubs 13), replaced by topo_glue 431 (+ topo_bridge 202 shared);
   the 19,027 vendored upstream lines now run verbatim. Build123dLite.js
   itself STAYS (it is the pytopo=lite layer, the Brython default, and the
   glue's kernel-op library) until a post-flip round prunes it.

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
