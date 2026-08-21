# FORK-ASKS — bindings the upstream TOPOLOGY layer needs from opencascade.js

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
