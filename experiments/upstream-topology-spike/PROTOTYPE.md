# PROTOTYPE — upstream build123d TOPOLOGY over our OCCT wasm (the OCP shim spike, Phase 2)

> **Hardening round (Stage 2) landed on this branch** — the six work items
> and their gates:
> 1. Static overload pinning: build-time dispatch classification in
>    table.json — 5,168 direct pins / 188 typed (coarse-type match,
>    statically decisive) / 53 ambiguous (9 billed; runtime REFUSES with
>    the candidate list on a score tie — never guesses) / 190 dead
>    unbound-type variants dropped. Self-check: `dispatch-report.json`.
> 2. Explicit pybind defaults table: 937 defaults (728 literal, 81 enum,
>    128 fresh-construct Message_ProgressRange), 0 opaque, cached in
>    ocp-defaults.json — regeneration does not need the venv.
> 3. numpy micro-shim (pytopo=upstream only): billed surface exactly;
>    lstsq validated vs real numpy to 3.5e-13 over 502 axis intersections
>    (`validate-numpy-micro.py`).
> 4. Convention glue: 12 OCJS_Out out-param helpers glued (Tangency
>    family with PntSol mutation, FilletAlgo.Result via proxy-_ref
>    rebinding); the rest are greppable `PENDING_FORK_BINDING` hooks.
> 5. Perf: see "Perf pass" below — dispatched calls 1.2–1.3x the bridge
>    envelope floor (target ≤2x).
> 6. Stretch: upstream `topology/constrained_lines.py` runs VERBATIM
>    behind lite Edge.make_constrained_arcs/lines (constrained_bridge.py);
>    all 12 constrained harness scripts classify identically.
>
> End gates: topo-poc 7/7; harnesses per-script identical to the
> committed baselines (upstream 205/10/5/2 incl. the documented
> heat_exchanger contention flap; lite 206/10/5/1); full suite 95
> passed / 1 skipped.

Companion to `BILL.md` (Phase 1, the static method bill). This records what
the Phase-2 prototype PROVED, the shim pattern that emerged, and the honest
cost model for full topology adoption.

## What runs (all verified against REAL OCCT 8.0.1 wasm)

`topo-poc.mjs` (node inner loop: real wasm + real worker StandardLibrary +
MicroPython, ~1 s boot) — four micro-tests, ALL PASS; the same code passes
in the real browser app via `?pyruntime=micropython&pytopo=upstream`
(smoke: upstream `topo_explore_common_vertex` over lite `Box(2,2,2)` edges →
corner `(-1,-1,1)`, printed from user Python):

| Test | What it proves |
|---|---|
| t1 shim smoke | ctor/static/instance dispatch, pybind-defaults fill (`VolumeProperties_s(shape, props)` with 3 omitted bools), enum identity + `==` + DICT KEYS, `ta.TopAbs_SOLID` module-member aliases, `TopExp_Explorer(shape, kind)` ctor default (`ToAvoid=TopAbs_SHAPE` enum default), TopoDS_Cast downcast, handle auto-deref, **polymorphic `isinstance(surf, Geom_Plane)`** |
| t2 upstream utils VERBATIM | `_make_topods_face_from_wires` (kwargs `OnlyPlane=True`, ShapeFix, MakeFace among ~20 overloads) + `_extrude_topods_shape` (lite `Vector.wrapped` bridge) → area 12 / volume 60 EXACT |
| t3 upstream zero_d VERBATIM, mixed | upstream `Vertex(1,2,3)` through the shim; upstream `topo_explore_common_vertex(lite_edge, lite_edge)` — the mixed-mode bet: lite shapes' `.wrapped` flows into verbatim upstream code |
| t4 upstream shape_core (3,855 lines) imports; ShapeList over lite shapes | `sort_by(Axis.Z)` / `group_by(Axis.Z)` / `filter_by(Plane.XY)` on lite faces — the Plane predicate is the OCCT-heavy path (GeomLib_IsPlanarSurface + handle wrap + UVBounds + BRepGProp_Face.Normal out-params via class-ref mutation) |

Gates: fast spec gate (CS_TEST_PORT=8412: py-runtime / py-src-upstream /
python-mode) 8 passed / 1 skipped; `pytopo` **defaults OFF** (loader constant
`PYTOPO_DEFAULT='lite'`; `?pytopo=upstream` / localStorage `cascade-py-topo`
opt in), so mainline classification cannot move. Full-harness neutrality run
recorded in the commit message of the round that lands after this file.

## The measured pybind-vs-embind convention gaps (each now handled in the shim)

These are THE facts the bill could not know statically — measured by probe,
now encoded in `OcpShim.js` + `ocp_core.py`:

1. **Embind auto-downcasts polymorphic raw pointers** to the most-derived
   REGISTERED class (`BRep_Tool.Surface_s(face).get()` returns a JS
   `Geom_Plane`, `Pln()` callable). pybind's biggest magic is FREE. wrap()
   just maps `constructor.name` onto the generated proxy class (inheritance
   mirrored from the d.ts), so `isinstance` works with NO metaclasses.
2. **Embind enum members are identity-stable singletons** (`a === b`,
   `ShapeType() === member`), and MicroPython's jsffi preserves proxy
   identity both directions → pybind enum `==`/dict-key semantics come free
   (upstream's `downcast_lut[shape.ShapeType()]` works with RAW proxies).
3. **Handles**: pybind auto-derefs and converts null→None; the dispatcher
   does `IsNull() ? null : get()` on every returned `Handle_*` (keeping the
   handle alive — embind objects are never GC-freed anyway). pybind also
   implicitly wraps a raw transient into `handle<T>` params: the dispatcher
   retries `Expected null or instance of Handle_X` failures with
   `new Handle_X_2(arg)`.
4. **Defaults**: embind has no default args; pybind sigs (dumped from real
   OCP 7.9.3) fill omitted tails, INCLUDING enum defaults
   (`<TopAbs_ShapeEnum.TopAbs_SHAPE: 8>` → `oc.TopAbs_ShapeEnum.TopAbs_SHAPE`)
   and object-valued defaults (fresh `Message_ProgressRange_1()`).
5. **7.9.3 (pybind reference) → 8.0.1 (our wasm) API drift is real**: many
   methods GREW a trailing `Message_ProgressRange` param
   (`ShapeFix_Face.Perform()` vs `Perform(theProgress)`). The dispatcher
   pads it when the d.ts variant expects exactly that. Any future OCP-parity
   layer must treat version drift as a first-class dispatch case.
6. **Same-arity overloads are landmines**: embind COERCES (an object passed
   to a bool param is silently truthy) — `BRepGProp_Face(face)` picked
   `_1(IsUseSpan: bool)` and crashed INSIDE wasm ('null function') rather
   than at conversion. The dispatcher now type-scores candidates against
   d.ts param types before calling. This is the one failure mode that is
   silent-wrong rather than loud, and the reason the generated table (not
   blind probing) is the right architecture.
7. **MicroPython specifics**: no `cls.__new__` (wrap() constructs through a
   sentinel first-arg), no bound dunders on builtin instances
   (`list(self).__getitem__(key)` → transformed to `[key]`), no name
   mangling (the anytree shim stores literal `_NodeMixin__children`),
   `itertools.groupby` absent (bridged).

## The mixed-mode interop pattern (upstream classes ↔ lite shapes)

Proven ARCHITECTURALLY POSSIBLE, with a bounded bridge (`topo_bridge.py`,
~120 lines, loaded only under pytopo=upstream):

- lite shapes carry real JS `TopoDS_Shape`s in `.topo`; patching lite
  `Shape.wrapped` to return a TYPED shim proxy gives upstream code full
  fidelity (`isinstance(shape.wrapped, TopoDS_Face)` in `filter_by`'s
  predicates) while lite's own internals keep using `.topo` raw.
- the browser `_Fn` bridge is re-pointed (at pytopo boot only) to unwrap
  `._ref` proxies, so lite's w.* calls keep working when handed one.
- lite `Shape.__init__` unwraps proxies (upstream `Vertex.__init__` ends
  with `super().__init__(topods_proxy)`).
- lite geometry grows the OCP-facing surface upstream topology reads:
  `Vector.wrapped` (gp_Vec), `Axis.wrapped` (gp_Ax1), `Plane.wrapped`
  (gp_Pln), `Vector(gp_* proxy)` construction.
- the seam's `shape_core` re-export module gains the names upstream
  utils/zero_d import from it: a REAL `downcast` (TopoDS_Cast by
  ShapeType), `shapetype`, `_make_topods_compound_from_shapes`,
  `TrimmingTool`.

The catch, and it is the important architectural finding: **classes can only
be SWAPPED wholesale, bottom-up, together with their producers.** Exporting
upstream `Vertex` as `topology.Vertex` would break `isinstance` for every
lite-produced vertex, so the spike keeps lite's classes exported and proves
upstream code at the FUNCTION level (utils, zero_d functions, shape_core
ShapeList methods over duck-typed lite members). Full adoption therefore
means replacing lite's topology as a unit (geometry.py + topology/*) — at
which point lite reduces to the JS StandardLibrary op layer and the
scene/caching bookkeeping — not swapping one class at a time. This matches
what the bill's per-file table suggests (the OCP-facing bottom is one
strongly-connected layer through shape_core).

## Costs measured

- Boot: pytopo=upstream adds ~1.1 MB table.json + ~160 KB Python (registry +
  OCP modules + shims) fetched lazily, and the enum-member prefetch; node
  boot went 305 → ~400 ms libMs. Zero cost when the flag is off.
- Per-call overhead: every OCP call is a Python→JS envelope + dispatch; the
  micro-tests are indistinguishable from lite (OCCT dominates); no harness
  perf claim yet (topology hot loops like ShapeList sorting run in Python
  either way).
- ocp-defaults.json (1.6 MB, spike-side input) and table.json regenerate in
  seconds; the whole adapter is 3 commands after a d.ts or bill change:
  `extract_ocp_bill.py` → `dump_ocp_defaults.py` → `gen-ocp-shim.mjs`.

### Perf pass (hardening round, `bench-shim.mjs`, node, load-avg ~9 box)

The comparable for "a direct lite call" is a raw `w.*` bridge call (the
same `_Fn`/`_csMpCall` guarded envelope every lite JS-op call rides, with a
trivial body). Numbers are ops/s over 20k iterations, ±10% run-to-run:

| Measurement | before pinning+memo | after | target |
|---|---|---|---|
| `p.X()` vs lite-equivalent call | 1.30x | **1.16–1.28x** | ≤ 2x ✔ |
| `gp_Pnt(1,2,3)` vs lite-equivalent call | 1.50x | **1.23–1.35x** | ≤ 2x ✔ |
| `filter_by(Plane.XY)` 504 lite faces (upstream ShapeList) | 0.38–0.42 s | 0.39–0.41 s | OCCT/envelope-bound |

What changed: JS memoizes the per-call class-chain walk + GLUE lookup
(`resolveMethod`), default-fills/progress-pads are built LAZILY (raw args
dispatch first — the common case allocates nothing), and `wrap()` caches
the `_csOcpParent` FFI walk for unregistered classes. Two Python-side
caching attempts were MEASURED AND REJECTED: caching bound methods on the
instance (setattr per short-lived proxy) and installing methods on the
proxy class at first miss both regressed the wrap-heavy `filter_by` loop
~45% (MicroPython attr-lookup cost grows with class/instance dict churn)
while only the latter helped the same-instance micro loop; the original
per-access `_BoundMethod` stands. The hot selector loop's time is OCCT +
FFI-envelope, not dispatch: the dispatcher itself is within ~1.3x of the
envelope floor.

## Deliberately NOT done (stop-line honored)

- one_d/two_d/three_d/composite were not attempted (per the mission
  stop-line). shape_core was brought to import+selectors, NOT to
  harness-neutral replacement of the seam's shape_core (that requires the
  wholesale class swap above).
- `Vertex.cast`'s `cls.__new__(cls)` (shape_core line 1043 family) and
  `filter_by(property)`'s `filter_by.__get__(obj)` are MicroPython gaps not
  yet exercised — both have straightforward transforms/shims when the full
  layer lands.
- No memory management: embind objects are never `.delete()`d (same policy
  as lite today).

## Go/no-go and staged estimate

**GO, staged.** Nothing found contradicts the bill; every convention gap
fell to a generic dispatcher rule rather than per-method glue. Honest
stages for FULL topology adoption:

1. **Fork-binding session** (1–2 days): the ~14-class MISSING list +
   ListOfShape method adds + ~6 OCJS_Out helpers (see BILL.md and
   FORK-ASKS.md). Nothing architectural.
2. **Shim hardening** (2–3 days): promote the spike dispatcher to
   production — table-driven static pinning where the bill knows the exact
   variant (today's runtime scoring stays as fallback), the remaining glue
   (CurveOnSurface, StaticMoments, ExtremaCC.Parameters), dunder/`__new__`
   transforms, the `numpy` micro-shim (~40 lines), a perf pass on the call
   envelope (cache _BoundMethods; batch attribute reads).
3. **The wholesale swap** (1.5–3 weeks, the real cost): upstream
   geometry.py + topology/* as THE `build123d` bottom layer over the shim,
   lite reduced to the JS op layer + scene bookkeeping; then the
   232-script harness grind to lite parity. Priced by precedent: the
   Level-A integration took ~2 weeks of rounds (47→205 PASS); topology is
   deeper but starts with builders/objects/operations already verbatim and
   the seam patterns proven here. The grind dominates; the shim does not.

The alternative — keep lite's topology and cherry-pick upstream FUNCTIONS
(what pytopo=upstream does today for utils/zero_d) — is cheap, incremental,
and already landed behind the flag; it shrinks re-porting surface
release-by-release without the big swap. Recommended default: hold at stage
1+2 value (bindings + hardened shim + function-level adoption), take stage
3 only when a build123d release makes topology-layer drift the dominant
maintenance cost.

## Harness-neutrality gate (pytopo DEFAULT OFF, run after landing)

Full 232-script harness, `CS_PY_RUNTIME=micropython` (pysrc=upstream
default), machine under load-average ~10 (shared box):

- Raw: 202 PASS / 9 MISMATCH / 7 ERROR / 4 TIMEOUT — normalizes to the
  committed **205 / 10 / 5 / 2 per-script EXACTLY**:
  - `filter_inner_wire_count` + `tutorial_joints` "ERRORs" were the
    DOCUMENTED harness-config pitfall (import_step assets need
    `B123D_SRC=~/Desktop/build123d`); rerun with the env: PASS and
    MISMATCH (= baseline).
  - `bracelet`, `clock` TIMEOUTs were 4-page contention flaps; solo: PASS.
  - `heat_exchanger` is the documented budget-edge flap (upstream-source
    config only; times out under load even solo, while pysrc=lite passes
    the same script in 55 s — exactly the CLAUDE.md note).
- Browser checks under `?pytopo=upstream`: the full PYTHON_STARTER_CODE
  (flanged bearing mount) evaluates with zero errors over the active
  bridge, and the zero_d mixed-mode smoke prints exact geometry.
- Full harness, `CS_PY_RUNTIME=micropython CS_PY_SRC=lite` (the lite
  baseline): **206 PASS / 10 MISMATCH / 5 ERROR / 1 TIMEOUT — per-script
  IDENTICAL to the committed report.md set** (joints x2, projection x2,
  sort_axis, filter_all_edges_circle, tips/b04, objects_1d, tutorial_joints,
  sm_hanger; toy_truck, dual_color_3mf, ttt-ppp0110, objects_2d,
  curved_support; spitfire).
- Full playwright suite: **95 passed / 1 skipped** (exit 0).
