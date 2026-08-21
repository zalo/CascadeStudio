# BILL — upstream build123d 0.11.1 TOPOLOGY layer over our OCCT wasm binding

The static Phase-1 bill for running upstream `geometry.py` + `topology/*.py`
(~19.8k lines) VERBATIM over the opencascade.js fork (embind, OCCT 8.0.1),
replacing build123d-lite's topology. Produced by
`extract_ocp_bill.py` (this directory):

- AST-parses every OCP usage in the 10 target files at METHOD level
  (constructors, instance calls with best-effort local dataflow typing,
  statics, enum members, bare class references), resolving
  `from OCP.X import Y` aliases and `.wrapped` receiver types.
- Introspects REAL OCP 7.9.3 (the reference venv is importable) for pybind
  signatures — overload counts, staticness, tuple returns (= out-params).
- Parses `cascadestudio.d.ts` (1,264 classes, inheritance-aware, ctor
  overload subclasses `Name_1..N`, enum types) AND merges the
  hand-registered surface from the fork's
  `build/additionalBindCode/cascadestudio.js.cpp` (OCJS, OCJS_Out,
  TopoDS_Cast, TopTools_ListOfShape, the BRepAlgoAPI base chain, arrays,
  handles — none of which appear in the d.ts).

Machine-readable output: `ocp-method-bill.json`, `numpy-bill.json`.

## Headline numbers

**803 unique OCP items needed** (class.method / ctor / enum-member),
**2,205 call sites** across the 10 files.

| Classification | Unique items | Call sites | Meaning |
|---|---|---|---|
| EXACT (incl. enums, ctors, narrowed) | **453** (56%) | 1,020 | name+shape present as-is |
| OVERLOAD-MAPPABLE | **213** (27%) | 742 | present as `Name_1..N` / ctor-overload classes — resolved MECHANICALLY by the generated shim (arity, then arg-type dispatch) |
| CONVENTION-GAP: out-params | **20** | 43 | pybind returns a tuple; embind loses `Standard_Real&` — needs an `OCJS_Out` helper OR a bound alternative. **12 of the 20 already have OCJS_Out helpers** (the Geom2dGcc Tangency family + ProjectPointOnSurf, added for lite) |
| CONVENTION-GAP: rename | **7** | 128 | `TopoDS.Vertex/Edge/…_s` downcasts → our hand-bound `TopoDS_Cast.X_1/_2` (one lut in the shim) |
| UNATTRIBUTED-FOUND | **64** | 195 | dataflow couldn't type the receiver, but the method name IS bound (mostly Geom curve-inspection: `Circle()`, `NbPoles()`, `FirstParameter()`…) — expected to resolve at runtime; per-method risk is a wrong-overload pick, not absence |
| **MISSING (needs a fork binding or a workaround)** | **44** | 73 (3.3%) | see the list below — concentrated in **14 classes** |
| honest leftovers (unattributed-missing) | 2 | 2 | `BRep_TEdge.Curves()→IsCurve3D/Curve3D` (Face.is_coplanar's exotic edge check) |

Rollup: **83% of unique items (80% of call sites) run against today's wasm
with a mechanical shim; 12%/17% need small per-family glue; 5.5%/3.3% need
new fork bindings.**

## The MISSING list (fork-binding asks, grouped, with the upstream feature)

| Class (methods) | Upstream feature blocked | Note |
|---|---|---|
| `BRepOffset_MakeOffset` (ctor, Initialize, MakeOffsetShape, Shape) | `offset_topods_face` (1-D/2-D offsets path) | the SAME unbound class behind lite's COMPROMISE(thicken); generated binding fails to compile — needs a hand registration |
| `Extrema_ExtPC` + `Extrema_POnCurv` (ctor, IsDone, NbExt, Point, SquareDistance, Parameter, Value) | `Wire.param_at` (point→comp-curve parameter) | ExtPC over an Adaptor3d_Curve; alternative glue: ShapeAnalysis_Curve::Project (bound?) or GCPnts sampling like lite |
| `GProp_PrincipalProps` (Moments, First/Second/ThirdAxisOfInertia) | `Shape.principal_properties` | rarely used; no corpus script needs it |
| `gp_Mat` (Value) | `Shape.matrix_of_inertia` | same family |
| `TopTools_HSequenceOfShape` (ctor, Append, Length, Value) | `Wire.combine` (ShapeAnalysis_FreeBounds::ConnectEdgesToWires) | the KNOWN unbound type behind lite's COMPROMISE(edges-to-wires); the compromise chain-on-endpoints glue can substitute |
| `TopTools_IndexedMapOfShape` (ctor, Add, Extent) | `topo_explore_connected_faces` | TopExp.MapShapes overloads need it; `TopTools_IndexedDataMapOfShapeListOfShape` IS hand-bound — one more map registration |
| `TopTools_SequenceOfShape` (ctor, Append) | `Shape.split` side-processing | small hand binding or shim-side list |
| `TopTools_ListOfShape.Extent/IsEmpty/Last/RemoveFirst` | `Shape.split`, boolean bookkeeping | the hand binding has Append/Size/Clear/First — 4 one-line additions (`Extent`==Size, `IsEmpty`==Size()==0 glue-able today) |
| `TColgp_HArray2OfPnt`, `TColStd_HArray2OfReal` (ctor, SetValue) | `Face.make_bezier_surface` | lite's make_surface_from_array_of_points used the bound `TColgp_Array2OfPnt`; HArray2 registration is the same macro pattern as the bound HArray1s |
| `NCollection_Utf8String` (ctor) + `StdPrs_BRepTextBuilder` + `Font_*` glyph queries (`FontName/FontPath/IsSingleStrokeFont/ToCString` — unattributed) | `Compound.make_text` (kernel text) | lite deliberately replaced kernel text with opentype.js (COMPROMISE(text)); routing upstream `make_text` to lite's is the honest path — kernel fonts don't exist in wasm anyway |
| `BRepAlgo.ConvertFace_s` | `Face.to_arcs` | one static |
| `BRepTools_History.Modified` + `BRepAlgoAPI_Common.History` | `Solid.extrude_until` history walk | lite's extrude(until=) does the same job without History — glue or a History binding |
| `BRepAlgoAPI_Fuse.SetGlue` (+ `BOPAlgo_GlueEnum`) | `fuse(glue=)` kwarg | default fuse path unaffected |
| `TopoDS_Cast.CompSolid` absent (Vertex..Compound bound) | CompSolid downcast lut entry | one line in additionalBindCode |
| `TopAbs_State.TopAbs_IN` enum | point-membership check | enum registration |

Everything else the 19.8k lines touch is bound.

## Out-param inventory (CONVENTION-GAP, 20 items)

Already served by existing OCJS_Out helpers (12): the whole
`Geom2dGcc_*Tangency*` family, `ProjectPointOnSurf_LowerDistanceParameters`
/`_Parameters`.

Need NEW helpers or bound alternatives (8):

- `BRep_Tool.Range_s` (12 sites — HOT) → alternative: bound
  `BRepAdaptor_Curve.FirstParameter/LastParameter` (glue), or one OCJS_Out
  helper (better: exact).
- `BRepTools.UVBounds_s` (8 sites) → OCJS_Out helper.
- `BRep_Tool.CurveOnSurface_s` (2) → helper (returns handle + 2 reals).
- `Bnd_Box.Get` (1) → glue: bound `CornerMin/CornerMax`.
- `GProp_GProps.StaticMoments` (1), `BRepExtrema_DistShapeShape.ParOnEdgeS2`
  (1), `Geom2dAPI_ProjectPointOnCurve.Parameter` (1),
  `GeomAPI_ExtremaCurveCurve.Parameters` (1) → helpers (lite's
  GordonSurface.js already works around ExtremaCurveCurve without it —
  reusable).

So the REAL new-binding session is: ~6 classes hand-registered
(BRepOffset_MakeOffset, Extrema_ExtPC(+POnCurv), GProp_PrincipalProps+gp_Mat,
TopTools_IndexedMapOfShape, TopTools_HSequenceOfShape or its glue,
HArray2 pair), ~8 method additions to existing hand bindings, ~6 OCJS_Out
helpers, 2 enum/lut entries. By the fork CHANGELOG's own precedent (the
Geom2dGcc round bound 24 files + a helper class in one session), this is
**1–2 focused fork-build days**, and every ask is small/mechanical — none
requires new embind machinery.

## numpy verdict: TRIVIAL — a micro-shim, not a mini-numpy

`numpy-bill.json`: geometry.py + topology use numpy in exactly THREE
functions:

| Site | Usage |
|---|---|
| `geometry.py` `Axis._intersect_axis` | `np.array` (5), `np.cross` (1), `np.linalg.lstsq` on a 3×3 system (1) — closed-form 3×3 solve replaces it |
| `geometry.py` `Color.color_wheel` | `np.linspace` |
| `topology/one_d.py` `curvature_comb` | `np.linspace` |

A ~40-line pure-Python shim (tiny array + cross + linspace + 3×3 lstsq)
covers 100%. No numpy port, no routing to lite needed. (`objects_curve.py`'s
heavier numpy/sympy use is OUTSIDE this bill — the 1-D objects layer already
runs via lite in the shipped upstream mode.)

## Per-file readiness (call sites: OK / needs-glue / blocked-on-binding)

| File | total | OK | glue | blocked |
|---|---|---|---|---|
| topology/utils.py | 97 | 91 | 6 | **0** |
| topology/zero_d.py | 45 | 41 | 4 | **0** |
| geometry.py | 539 | 524 | 13 | 2 |
| topology/constrained_lines.py | 277 | 264 | 13 | **0** |
| topology/composite.py | 85 | 79 | 4 | 2 |
| topology/shape_core.py | 701 | 655 | 25 | 21 |
| topology/two_d.py | 475 | 423 | 40 | 12 |
| topology/three_d.py | 288 | 237 | 42 | 9 |
| topology/one_d.py | 919 | 864 | 28 | 27 |

The bottom-up bring-up order (utils → zero_d → shape_core) hits ZERO missing
bindings until shape_core, whose 21 blocked sites are principal-properties
(5), ListOfShape conveniences (13, glue-able), CompSolid downcast (1),
is_coplanar's TEdge check (2).

## Caveats (honesty box)

- Instance-method attribution is best-effort dataflow; 64 unique methods
  (195 sites) are UNATTRIBUTED-FOUND — the name exists in the binding but
  the exact class wasn't proven. Expected failure mode at runtime is a
  wrong-overload pick, caught by the Phase-2 harness, not silent absence.
- OVERLOAD-MAPPABLE assumes the generated dispatcher can pick `_N` by arity
  + JS-side type sniffing; overload pairs distinguished ONLY by C++ types of
  equal JS shape (e.g. Standard_Real vs Standard_ShortReal) need call-site
  pinning. Phase 2 proves the pattern.
- Handle semantics: pybind auto-derefs `opencascade::handle<T>` — OCP code
  calls `Geom_Curve` methods directly on what our binding returns as
  `Handle_Geom_Curve` (needs `.get()`), and only ~9 Handle types have hand
  bindings with `.get()`. The shim must auto-deref on attribute access —
  a PROXY-level rule, not per-method work, but it is load-bearing.
- Enum identity: our enums are `{Member: {}}` objects; upstream compares and
  dict-keys them (`downcast_lut[shape.ShapeType()]`). The proxy must wrap
  enum returns into singletons (same trick as lite's `_finalize_enums`).

## Bottom line

**GO for the Phase-2 shim prototype.** The binding was ALREADY sized for
build123d's OCP surface (fork commit 4bfed22 "OCCT 8.0.1 build with
build123d OCP surface"), and it shows: only 3.3% of call sites touch a
missing symbol, and every miss is a small hand-registration of exactly the
kind the fork has done in every previous round. The expensive unknowns are
NOT the binding surface — they are (a) the proxy-layer semantics
(handles/enums/out-params/overload dispatch) and (b) MicroPython running
19.8k more lines of upstream Python (match statements, dataclasses,
performance). Phase 2 measures both.

Preliminary effort estimate for FULL topology adoption (refined after
Phase 2): 1–2 fork-build days (bindings above) + shim generator (this
spike) + an INVENTORY-style harness grind that history prices at 1–2 weeks
(the Level-A integration took ~2 weeks of rounds to lite parity; topology is
deeper but arrives with the seam already proven).
