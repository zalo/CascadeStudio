# FORK-ASKS — bindings the upstream TOPOLOGY layer needs from opencascade.js

> **STATUS: LANDED.** Every ask below shipped in fork commit
> `05d088d36ba3b9d8690fb650d62289a9e4a471cd` (branch
> cascadestudio-v3-occt801; d.ts 380→400 Handle_ classes, +43 classes,
> zero removals, initial memory still 32 MB) — with ONE deliberate
> exception: `NCollection_Utf8String` (kernel text) was skipped
> permanently; `make_text` stays on lite's opentype.js path
> (COMPROMISE(text) applies regardless — no system fonts in wasm).
> `BRepExtrema_ParOnEdgeS1` was not asked and not bound (S2 is the billed
> sibling); its shim hook stays PENDING_FORK_BINDING. Integration round:
> every closed hook is exercised by `topo-poc.mjs` t8 with real geometry.

Input for the fork's CHANGELOG pipeline (branch cascadestudio-v3-occt801).
Derived from `ocp-method-bill.json` (73 of 2,205 call sites blocked, 14
classes) and verified against `build/additionalBindCode/cascadestudio.js.cpp`.
Every item is the same kind of small hand-registration as previous rounds
(Geom2dGcc / OCJS_Out / TopTools maps).

## New class registrations (generated bindings fail or were never listed)

| Class + methods needed | Feature | Note |
|---|---|---|
| `BRepOffset_MakeOffset` (ctor, Initialize, MakeOffsetShape, Shape) | `offset_topods_face` | SAME class behind lite's COMPROMISE(thicken) — closing it retires that compromise too |
| `Extrema_ExtPC` (ctor(P,C), IsDone, NbExt, Point, SquareDistance) + `Extrema_POnCurv` (Parameter, Value) | `Wire.param_at` | takes Adaptor3d_Curve — BRepAdaptor_CompCurve is already bound |
| `GProp_PrincipalProps` (Moments, First/Second/ThirdAxisOfInertia) | `Shape.principal_properties` | returned by the bound `GProp_GProps.PrincipalProperties()` — only the class registration is missing |
| `gp_Mat` (Value) | `Shape.matrix_of_inertia` | returned by bound `MatrixOfInertia()` |
| `TopTools_IndexedMapOfShape` (ctor, Add, Extent, + the TopExp.MapShapes overload that fills it) | `topo_explore_connected_faces` | the IndexedDataMap sibling is already hand-bound — same macro pattern |
| `TopTools_HSequenceOfShape` (ctor, Append, Length, Value) + `ShapeAnalysis_FreeBounds::ConnectEdgesToWires` reachability | `Wire.combine` | ALSO retires lite's COMPROMISE(edges-to-wires) |
| `TopTools_SequenceOfShape` (ctor, Append) | `Shape.split` bookkeeping | or shim-side JS array |
| `TColgp_HArray2OfPnt`, `TColStd_HArray2OfReal` (ctor(4), SetValue) + their Handles | `Face.make_bezier_surface` | same HANDLE_BINDINGS/ARRAY macro family as the bound HArray1s |
| `BRepAlgo::ConvertFace_s` | `Face.to_arcs` | one static |
| `BRepTools_History` (Modified) + `BRepAlgoAPI_*::History()` | `Solid.extrude_until` history walk | alternatively keep lite's history-free algorithm |

## Additions to EXISTING hand bindings (one-liners)

- `TopTools_ListOfShape`: `Extent`, `IsEmpty`, `Last`, `RemoveFirst`
  (has Append/Size/Clear/First).
- `TopoDS_Cast`: `CompSolid_1/_2` (has Vertex..Compound).
- `BRepAlgoAPI_Fuse` (via BuilderAlgo base): `SetGlue(BOPAlgo_GlueEnum)` +
  the `BOPAlgo_GlueEnum` enum registration.
- `TopAbs_State` enum (`TopAbs_IN` is read).
- `NCollection_Utf8String` ctor — ONLY if kernel text is ever wanted;
  recommended: keep routing `make_text` to lite's opentype.js path
  (COMPROMISE(text) applies regardless — no system fonts in wasm).

## New OCJS_Out helpers (scalar out-params)

| Helper | pybind signature served |
|---|---|
| `BRepTool_Range(edge)` → `{first, last}` | `BRep_Tool::Range(E)` (12 call sites — the spike glues it via BRepAdaptor_Curve, exact but allocates an adaptor per call) |
| `BRepTools_UVBounds(face)` → `{umin, umax, vmin, vmax}` | `BRepTools::UVBounds` (8 sites — spike glue: BRepAdaptor_Surface(restriction=true)) |
| `BRepTool_CurveOnSurface(edge, face)` → `{curve2d, first, last}` | `BRep_Tool::CurveOnSurface` |
| `GProp_StaticMoments(props)` → `{ix, iy, iz}` | `GProp_GProps::StaticMoments` |
| `BRepExtrema_ParOnEdgeS2(dss, i)` → `{t}` | `BRepExtrema_DistShapeShape::ParOnEdgeS2` |
| `Geom2dAPI_ProjectPointOnCurve_Parameter(p, i)` → `{u}` | same-name method |
| `GeomAPI_ExtremaCurveCurve_Parameters(ecc, i)` → `{u1, u2}` | (GordonSurface.js already works around it — a helper would simplify that too) |

Already covered, no ask: `Bnd_Box.Get` (CornerMin/Max glue),
`GeomAPI_ProjectPointOnSurf.*` (existing OCJS_Out helpers), the whole
Geom2dGcc Tangency family (existing helpers).

## Stage-3 addendum (full upstream topology; each currently served by shim glue)

Found while running geometry.py + the WHOLE topology package verbatim. All
are glued/worked around in OcpShim.js (grep `fork ask` / COMPROMISE), so
these are quality-of-life bindings, not blockers:

| Ask | Blocked/glued feature | Current workaround |
|---|---|---|
| `Quantity_Color` class registration (SKIP its `NCollection_Vec3` ctor — that is what dropped the whole class) | geometry `Color` | COMPROMISE(quantity-color): plain-JS rgb stand-in + `Quantity_ColorRGBA_5`; `GetRGB` serves tracked channels; `ColorFromName` -> False (webcolors shim covers CSS3) |
| `BOPAlgo_Options::SetFuzzyValue` / `SetNonDestructive` (+`SetRunParallel` for completeness) | upstream `Compound.__add__` fuses with fuzzy 1e-6; `Shape.fuse(tol=)` | COMPROMISE(fuzzy-value): no-ops — booleans run at default precision |
| `Geom_ToroidalSurface`, `Geom_SphericalSurface`, `Geom_SurfaceOfRevolution` registrations | `Face.axis_of_rotation`, `is_circular_convex/concave` (embind polymorphic downcast lands on base `Geom_Surface`) | GLUE via `GeomAdaptor_Surface` (Torus/Position/Axis/Radius accessors) |
| `TopTools_IndexedDataMapOfShapeListOfShape::Extent` (or `Size`) | `topo_distance_to` peer counting | GLUE counts by `FindKey` probing |
| `ShapeAnalysis_FreeBounds::ConnectEdgesToWires` 4-arg out-HANDLE form semantics | `Wire.combine` / `edges_to_wires` (the out-handle is REASSIGNED in C++; embind passes a copy) | GLUE routes the returning overload and Appends into the caller's sequence |
| `gp_Quaternion::GetEulerAngles` OCJS_Out helper | `Location.orientation` / `to_tuple` | JS matrix extraction (Intrinsic_XYZ only; SetEulerAngles round-trips exact) |
| `TopTools_ListOfShape` per-index access or iterator | pybind iterates lists (`FindFromKey` results) | destructive First/RemoveFirst read with append-back restore |

## build123d 0.13.0 / OCP 8.0.1 addendum (2026-10-15)

Re-billing 0.13.0's geometry.py + topology/*.py (now incl. topology/
history.py + kernel.py) with pybind introspection against OCP 8.0.1:
878 unique items (803 for 0.11.1): +87 / -12, and two former MISSING items
(`BRepAlgoAPI_Common.History`, `BRepAlgoAPI_Fuse.SetGlue`) are EXACT since
fork 05d088d. OCP 8 moved every NCollection instantiation into
`OCP.collections` (`List_TopoDS_Shape`, `IndexedMap_TopoDS_Shape_
TopTools_ShapeMapHasher`, ...); the shim aliases those onto the bound
typedef classes (`OCP/collections.py`, generated). What is NOT bound, and
how it is served — **no fork rebuild was needed for the 0.13 corpus**:

| Ask | 0.13 feature | Current service |
|---|---|---|
| `NCollection_Map<TopoDS_Shape, TopTools_ShapeMapHasher>` (Add/Contains) and `NCollection_DataMap<TopoDS_Shape, TopoDS_Shape, ...>` (Bind/IsBound/Find) as classes | topology/history.py — the `Select.LAST/NEW` kernel record (ShapeHistory/Trace) | EXACT Python glue (`ocp_glue.CsShapeMap/CsShapeDataMap`: std::hash<TopoDS_Shape> buckets + IsSame — the hasher's own semantics; build123d never hands these maps to the kernel) |
| `TopTools_ListOfShape::Assign` | topology/kernel.list_shapes | EXACT JS glue (drain/restore copy) |
| `BRepAdaptor_Curve2d` | Vertex.convexity (`_face_tangents`) | EXACT glue: Geom2dAdaptor_Curve over `OCJS_Out.BRepTool_CurveOnSurface` (what Initialize does) |
| `BRepLProp_SLProps` | Face.convexity | glue: LProp_SLProps' own computation on the bound `Adaptor3d_Surface::D2` (normal D1U^D1V, fundamental forms, principal curvatures); singular points report "undefined" instead of OCCT's higher-order normal search (build123d samples interior UV fractions only) |
| **`IntTools_FClass2d`** (ctor(face, tol), Perform(gp_Pnt2d) -> TopAbs_State) | Vertex.convexity on a face corner | **PENDING_FORK_BINDING** (raises by name). No exact 2-D point-in-face classifier is bound (`BRepClass_FaceClassifier`, `BRepTopAdaptor_FClass2d` are absent too); a 3-D distance stand-in misclassifies across periodic seams. No corpus script reaches it. |
| `NCollection_String` | kernel text | PERMANENT-SKIP (as `NCollection_Utf8String` before: make_text routes to opentype.js) |

Bundle these three generated bindings (`IntTools_FClass2d`,
`BRepLProp_SLProps`, `BRepAdaptor_Curve2d`) plus the two shape-map
instantiations into the next fork round that is rebuilt for another
reason; on their own they do not justify an LTO relink (no corpus script
is blocked).
