# build123d-lite validation report

Generated 2026-08-21T08:33:36.522Z - 232 scripts (222 scored, 10 excluded because real build123d fails natively).

| Status | Count |
|---|---|
| PASS | 216 |
| MISMATCH | 2 |
| ERROR | 3 |
| TIMEOUT | 1 |
| SKIP | 10 |

## Feature-gap frequency (ERROR bucket)

| Gap | Scripts |
|---|---|
| `NotImplemented: build123d-lite Mesher writes STL only (no lib3mf in the WASM build); got dual_color.3mf` | 1 |
| `NameError: Draft` | 1 |
| `AttributeError: symbols` | 1 |

## Mismatches (runs, but geometry differs)

- **docs/objects_1d**
  - 'scene' bbox[0] -0.1822 vs -0.1700 (d=0.0122)
- **docs-rst/tips/b04**
  - 'vertical_sketch' bbox[1] -0.5000 vs -0.7000 (d=0.2000)

## Passing scripts

- examples/boxes_on_faces (1 shapes)
- examples/boxes_on_faces_algebra (2 shapes)
- examples/build123d_customizable_logo_algebra (13 shapes)
- examples/build123d_customizable_logo (14 shapes)
- examples/build123d_logo (13 shapes)
- examples/build123d_logo_algebra (12 shapes)
- examples/canadian_flag_algebra (25 shapes)
- examples/canadian_flag (20 shapes)
- examples/circuit_board (1 shapes)
- examples/circuit_board_algebra (1 shapes)
- examples/cast_bearing_unit (10 shapes)
- examples/clock_algebra (6 shapes)
- examples/custom_sketch_objects (9 shapes)
- examples/custom_sketch_objects_algebra (9 shapes)
- examples/din_rail (3 shapes)
- examples/din_rail_algebra (41 shapes)
- examples/extrude (10 shapes)
- examples/clock (5 shapes)
- examples/extrude_algebra (35 shapes)
- examples/handle (10 shapes)
- examples/handle_algebra (4 shapes)
- examples/fast_grid_holes (4 shapes)
- examples/bicycle_tire (102 shapes)
- examples/holes (4 shapes)
- examples/holes_algebra (4 shapes)
- examples/intersecting_chamfers (1 shapes)
- examples/intersecting_chamfers_algebra (2 shapes)
- examples/bracelet (16 shapes)
- examples/intersecting_pipes (3 shapes)
- examples/joints_algebra (9 shapes)
- examples/joints (9 shapes)
- examples/key_cap_algebra (5 shapes)
- examples/key_cap (5 shapes)
- examples/lego_algebra (3 shapes)
- examples/lego (3 shapes)
- examples/loft (4 shapes)
- examples/loft_algebra (3 shapes)
- examples/mixed_algebra_context (9 shapes)
- examples/multiple_workplanes (1 shapes)
- examples/multiple_workplanes_algebra (1 shapes)
- examples/heat_exchanger_algebra (4 shapes)
- examples/pegboard_j_hook (10 shapes)
- examples/pegboard_j_hook_algebra (11 shapes)
- examples/pillow_block (2 shapes)
- examples/pillow_block_algebra (2 shapes)
- examples/platonic_solids (5 shapes)
- examples/packed_boxes (100 shapes)
- examples/playing_cards (14 shapes)
- examples/maker_coin (8 shapes)
- examples/roller_coaster (4 shapes)
- examples/roller_coaster_algebra (4 shapes)
- examples/shamrock (1 shapes)
- examples/stud_wall (2 shapes)
- examples/tea_cup_algebra (5 shapes)
- examples/heat_exchanger (3 shapes)
- examples/twist_extrude (2 shapes)
- examples/vase (8 shapes)
- examples/projection (16 shapes)
- general_examples/ex01 (1 shapes)
- general_examples/ex02 (1 shapes)
- general_examples/ex03 (2 shapes)
- general_examples/ex08 (3 shapes)
- examples/toy_truck (13 shapes)
- general_examples/ex09 (1 shapes)
- examples/vase_algebra (8 shapes)
- general_examples/ex10 (1 shapes)
- general_examples/ex12 (7 shapes)
- general_examples/ex14 (6 shapes)
- general_examples/ex13 (1 shapes)
- general_examples/ex15 (8 shapes)
- general_examples/ex11 (2 shapes)
- general_examples/ex17 (2 shapes)
- general_examples/ex18 (1 shapes)
- general_examples/ex19 (6 shapes)
- general_examples/ex20 (1 shapes)
- general_examples/ex21 (2 shapes)
- general_examples/ex22 (2 shapes)
- general_examples/ex23 (5 shapes)
- general_examples/ex24 (3 shapes)
- general_examples/ex25 (4 shapes)
- general_examples/ex26 (2 shapes)
- general_examples/ex16 (3 shapes)
- general_examples/ex27 (2 shapes)
- general_examples/ex30 (5 shapes)
- general_examples/ex28 (7 shapes)
- general_examples/ex31 (2 shapes)
- general_examples/ex29 (7 shapes)
- examples/projection_algebra (16 shapes)
- general_examples/ex32 (3 shapes)
- general_examples/ex35 (5 shapes)
- general_examples/ex33 (3 shapes)
- general_examples/ex37 (2 shapes)
- general_examples_algebra/ex01 (1 shapes)
- general_examples_algebra/ex02 (1 shapes)
- general_examples_algebra/ex03 (2 shapes)
- general_examples_algebra/ex08 (3 shapes)
- general_examples_algebra/ex09 (1 shapes)
- general_examples/ex34 (4 shapes)
- general_examples_algebra/ex12 (6 shapes)
- general_examples_algebra/ex14 (6 shapes)
- general_examples_algebra/ex13 (1 shapes)
- general_examples_algebra/ex11 (2 shapes)
- general_examples_algebra/ex15 (8 shapes)
- general_examples_algebra/ex17 (2 shapes)
- general_examples/ex36 (3 shapes)
- general_examples_algebra/ex18 (2 shapes)
- general_examples_algebra/ex19 (6 shapes)
- general_examples_algebra/ex20 (2 shapes)
- general_examples_algebra/ex16 (10 shapes)
- general_examples_algebra/ex21 (1 shapes)
- general_examples_algebra/ex23 (4 shapes)
- general_examples_algebra/ex22 (2 shapes)
- general_examples_algebra/ex26 (2 shapes)
- general_examples_algebra/ex25 (5 shapes)
- general_examples_algebra/ex24 (2 shapes)
- general_examples_algebra/ex27 (2 shapes)
- general_examples_algebra/ex30 (3 shapes)
- general_examples_algebra/ex31 (1 shapes)
- general_examples_algebra/ex32 (2 shapes)
- general_examples_algebra/ex33 (1 shapes)
- general_examples_algebra/ex35 (4 shapes)
- general_examples_algebra/ex28 (3 shapes)
- docs/center (5 shapes)
- general_examples_algebra/ex29 (8 shapes)
- general_examples_algebra/ex34 (3 shapes)
- docs/objects_1d_airfoil (2 shapes)
- docs/objects_1d_blend_curve (4 shapes)
- docs/objects_1d_bspline (2 shapes)
- docs/objects_1d_constrained (7 shapes)
- docs/objects_1d_ellipticalstartarc (4 shapes)
- docs/objects_1d_parabolic_hyperbolic (3 shapes)
- general_examples_algebra/ex36 (3 shapes)
- docs/pack_demo (12 shapes)
- docs/selector_example (1 shapes)
- docs/objects_3d (10 shapes)
- docs/heart_token (16 shapes)
- docs-selectors/filter_all_edges_circle (12 shapes)
- docs-selectors/filter_axisplane (13 shapes)
- docs-selectors/filter_geomtype (1 shapes)
- docs/slide_latch (7 shapes)
- docs-selectors/filter_nested (7 shapes)
- docs-selectors/filter_inner_wire_count (53 shapes)
- docs-selectors/filter_shape_properties (4 shapes)
- docs-selectors/group_hole_area (3 shapes)
- docs/tutorial_joints (8 shapes)
- docs-selectors/selectors_operators (9 shapes)
- docs-selectors/sort_along_wire (2 shapes)
- docs-selectors/sort_axis (8 shapes)
- docs-selectors/group_properties_with_keys (10 shapes)
- docs-selectors/sort_sortby (6 shapes)
- ttt/ttt-24-SPO-06-Buffer_Stand (9 shapes)
- ttt/ttt-ppp0101 (9 shapes)
- ttt/ttt-23-02-02-sm_hanger (14 shapes)
- ttt/ttt-ppp0102 (6 shapes)
- docs-selectors/group_axis (3 shapes)
- ttt/ttt-ppp0103 (4 shapes)
- ttt/ttt-ppp0104 (9 shapes)
- ttt/ttt-ppp0106 (9 shapes)
- ttt/ttt-ppp0105 (5 shapes)
- ttt/ttt-ppp0108 (6 shapes)
- ttt/ttt-ppp0109 (8 shapes)
- docs-rst/OpenSCAD/b01 (2 shapes)
- docs-rst/OpenSCAD/b02 (2 shapes)
- ttt/ttt-ppp0110 (14 shapes)
- docs-rst/OpenSCAD/all (2 shapes)
- docs-rst/algebra_performance/b03 (1 shapes)
- ttt/ttt-ppp0107 (11 shapes)
- docs-rst/build_sketch/b03 (1 shapes)
- docs-rst/import_export/b01 (1 shapes)
- docs-rst/key_concepts_algebra/b01 (2 shapes)
- docs-rst/key_concepts_algebra/b02 (1 shapes)
- docs-rst/key_concepts_algebra/b03 (1 shapes)
- docs-rst/key_concepts_algebra/b04 (1 shapes)
- docs-rst/key_concepts_algebra/b13 (1 shapes)
- docs-rst/key_concepts_builder/b01 (4 shapes)
- docs-rst/key_concepts_builder/b02 (1 shapes)
- docs-rst/key_concepts_builder/b03 (1 shapes)
- docs-rst/key_concepts_builder/b09 (2 shapes)
- docs-rst/key_concepts_builder/b10 (1 shapes)
- docs-rst/key_concepts_builder/b11 (1 shapes)
- docs-rst/key_concepts_builder/b13 (2 shapes)
- docs-rst/key_concepts_builder/b14 (1 shapes)
- docs-rst/key_concepts_builder/b17 (1 shapes)
- docs-rst/key_concepts_builder/b19 (1 shapes)
- docs-rst/key_concepts_builder/b20 (1 shapes)
- docs-rst/key_concepts_builder/b21 (2 shapes)
- docs-rst/location_arithmetic/all (2 shapes)
- docs-rst/selectors/b02 (3 shapes)
- docs-rst/selectors/all (3 shapes)
- docs-rst/tips/b01 (2 shapes)
- docs-rst/tips/b05 (1 shapes)
- docs-rst/topology_selection/b01 (1 shapes)
- docs-rst/topology_selection/b03 (1 shapes)
- docs-rst/topology_selection/b04 (1 shapes)
- docs-rst/topology_selection/b05 (1 shapes)
- docs-rst/topology_selection/b06 (1 shapes)
- docs-rst/topology_selection/b07 (1 shapes)
- docs-rst/topology_selection/b08 (3 shapes)
- docs-rst/topology_selection/b09 (4 shapes)
- docs-rst/topology_selection/b12 (14 shapes)
- docs-rst/tutorial_constraints/b03 (1 shapes)
- docs-rst/tutorial_constraints/b05 (4 shapes)
- docs-rst/tutorial_constraints/b06 (3 shapes)
- docs-rst/tutorial_constraints/b07 (3 shapes)
- docs-rst/tutorial_constraints/b08 (3 shapes)
- docs-rst/tutorial_constraints/b09 (5 shapes)
- docs-rst/tutorial_constraints/b10 (2 shapes)
- docs-rst/tutorial_constraints/b11 (2 shapes)
- docs-rst/tutorial_constraints/b13 (7 shapes)
- docs-rst/tutorial_design/b07 (3 shapes)
- docs-rst/tutorial_stl_reconstruction/b03 (1 shapes)
- docs-rst/tutorial_stl_reconstruction/b04 (26 shapes)
- docs-rst/objects-text/b10 (1 shapes)
- docs-rst/topology_selection-filter_examples/b01 (1 shapes)
- docs-rst/algebra_performance/b01 (3 shapes)
- docs-rst/algebra_performance/all (67 shapes)

## Errors by script

- examples/dual_color_3mf: `NotImplemented: build123d-lite Mesher writes STL only (no lib3mf in the WASM build); got dual_color.3mf`
- docs/objects_2d: `NameError: Draft`
- ttt/ttt-23-t-24-curved_support: `AttributeError: symbols`

## Timeouts

- docs/spitfire_wing_gordon

## Excluded (reference failed natively)

- examples/python_logo: reference no-shapes
- examples/tea_cup: reference error
- general_examples_algebra/ex10: reference error
- docs/constraint_examples: reference error
- docs/line_types: reference no-shapes
- docs/rigid_joints_pipe: reference error
- docs/rod_end: reference error
- docs/technical_drawing: reference error
- docs-objects/text: reference error
- docs-selectors/sort_distance_from: reference error

# Defaults audit (every remaining non-PASS, root-caused)

Hand-maintained (`defaults-audit.md`, appended to this report by run-lite.mjs).
For each remaining non-PASS script: the root cause, the upstream (build123d
0.11.1 / OCP 7.x) defaults compared against build123d-lite's (OCCT 8.0.1
wasm), and an honest verdict. Closed-this-round rows are kept where the
investigation itself is the record.

| Script(s) | Root cause | Upstream defaults vs lite | Verdict |
|---|---|---|---|
| examples/joints, examples/joints_algebra (MISMATCH) | Slider/pin positions are measured along `Axis(edge)` of slot edges selected after booleans; the parts land at the other end of the (geometrically correct) slot. | Both sides map `position_at(u)` orientation-aware (`u -> 1-u` when the edge is not FORWARD): upstream `Mixin1D._occt_param_at`, lite `Edge.position_at`. Verified the underlying curves agree; only the sub-edge TopAbs orientation flag differs (OCP 7.x vs 8.0.1 wasm construction history). | Same defaults, kernel construction-history difference — COMPROMISE(edge-orientation). Canonicalising `Edge.make_mid_way`'s references (the upstream canonical free-edge rule, default-on) shrank pin_arm 8.16 -> 2.69 mm and slider_arm 11.80 -> 9.11 mm; the remainder needs the example itself to select its two TIED top edges with `sort_by(Axis.Z, tie_break=True)`, which is opt-in upstream too. |
| examples/projection, examples/projection_algebra (MISMATCH, `projected_text` only, d=0.12) | The text wraps the *opposite way* around the sphere: the arch path (closed sphere-cylinder intersection edge) is TopAbs_REVERSED in OCP 7.x but FORWARD in 8.0.1 wasm over the SAME geometric parametrization (verified: raw curve at 25% is +Y on both; upstream's flag flips traversal to -Y first, lite's does not). | Everything else now byte-matches: `make_text` align default fixed to `None`, `position_at` switched to arc-length fraction via GCPnts_AbscissaPoint, and per-glyph text faces split disjoint outer contours (i/j dots) into separate faces (40 faces == upstream). | Same defaults, kernel edge-orientation history on a closed intersection curve — COMPROMISE(edge-orientation). Not honestly closable. |
| docs-selectors/sort_axis (MISMATCH, -14.7% volume) | `revolve(face, -Axis(edge), 90)` sweeps the OTHER WAY: the slot edge selected off the extruded solid has raw parametrization `(34,16,4) -> (34,16,0)` in this kernel and `(34,16,0) -> (34,16,4)` in OCP 7.x, so `Axis(edge)` points -Z instead of +Z. The profile face, its edge, its length and midpoint all agree exactly. | `Axis(edge)` is RAW-curve on both sides by design (`canonical=True` is opt-in, exactly as in the upstream patch), so neither side canonicalizes here. | Same defaults, kernel construction-history difference — COMPROMISE(edge-orientation), the same species as joints/projection. Opting the example into `Axis(edge, canonical=True)` would close it, and the canonical rule does give upstream's direction (open edge from the lexicographically smaller end). |
| docs-selectors/filter_all_edges_circle (MISMATCH, `f` only) | The script keeps the loop variable of `for i, f in enumerate(faces)`, i.e. THE LAST of a mirror-symmetric pair of bearing-bore faces at y = ±21. Every other measured shape (including all 53 sorted `faces[i]`) matches. | Not a defaults difference: `part.faces()` is the kernel's face traversal order, and the mirrored pair comes out in the opposite order here. | COMPROMISE(traversal-order). |
| docs-rst/tips/b04 (MISMATCH, bbox 0.2 mm) | `vertices().group_by(Axis.X)[-1].sort_by(Axis.Z)[-1]` inside `BuildSketch(Plane.XZ)`: the sketch's LOCAL vertices all have z = 0, so `sort_by(Axis.Z)` is a COMPLETE TIE between (0.5, ±0.5) and the stable sort hands back whichever the kernel enumerated last. Verified natively: upstream's rectangle enumerates [(0.5, 0.5), (0.5, -0.5)] and picks (0.5, -0.5). | Same default (a plain stable sort; `tie_break=True` is opt-in upstream too, and is exactly the fix the canonical-edges work proposes for this). | COMPROMISE(traversal-order): lite builds its rectangle from a different first corner, so the tie resolves the other way. |
| docs/objects_1d (MISMATCH, `scene` bbox 0.07 mm) | `scene = Compound(...) + Compound.make_triad(2)`. | The triad's axes and spline arrow heads are built exactly; upstream also draws 'X'/'Y'/'Z' with the **`singleline` STROKE font**, which this build does not ship (only the outline font FreeSans). | COMPROMISE(triad-labels). The triad is a viewer symbol; the deviation is confined to scripts that measure it. (`l1`/`l3`/`l4` also differ because the file reuses those names across nine examples and the harness compares the last binding.) |
| examples/cast_bearing_unit (**was ERROR, now PASS**) | The previous verdict — "genuine kernel fault in the 8.0.1 wasm fillet" — was WRONG. `FilletEdges` was aborting the wasm heap because lite's `make_hull` handed it a POLYLINE boundary (hundreds of micro-edges) instead of the trimmed arcs upstream produces. | `make_hull` is now a statement-for-statement port of `Wire.make_convex_hull` (sample -> 2-D hull -> connecting lines + trimmed source edges), so the fillet sees the same topology upstream's does. | Closed: lite bug (a simplified hull), not a kernel fault. The same fix closed docs-rst/tips/b01 (ChamferEdges "internal OCCT error"). |
| examples/toy_truck (ERROR) | `FilletEdges` raises "INTERNAL OPENCASCADE ERROR" (caught, no heap corruption) on the truck's body fillet. Unlike cast_bearing_unit this input has no hull in it. | Upstream `Solid.fillet` = `BRepFilletAPI_MakeFillet(shape)` (default ChFi3d_Rational) + `Add(radius, edge)`; lite is identical (explicit ChFi3d_Rational, same Add). No tolerance/continuity knobs differ. | Same defaults, kernel behaviour on this input. |
| examples/dual_color_3mf (ERROR, geometry closed) | All six measured shapes match the reference exactly; the script fails on its last statement, `Mesher.write("dual_color.3mf")`. | Upstream's `Wire.offset_2d` open-mode branch is ported exactly. | COMPROMISE(mesher): there is no lib3mf in this wasm build, so only STL export exists. |
| ttt/ttt-ppp0110 (ERROR) | The KNOWN 8.0.1 coplanar-BSpline fuse fault, in the one shape where the General-Fuse rebuild cannot recover the dropped operand (result volume 0). | Upstream fuse defaults reproduce the drop on this kernel; see the ex34 row below. | Genuine kernel fault, detected and raised (COMPROMISE(kernel-guard) cannot recover this one). |
| general_examples/ex34, general_examples_algebra/ex34 (PASS since the kernel-guard round) | `BRepAlgoAPI_Fuse` silently DROPS an operand when coplanar faces meet along BSpline edges (glyph solids fused onto a box face); result was the bare box. | Upstream fuse defaults — no fuzzy value, glue off, NonDestructive unset — reproduce the drop identically on this kernel; it is the fuse *result-assembly* phase that is broken, the General-Fuse *split* phase is correct on the same inputs. Lite's `Union` detects the drop and rebuilds from the `BOPAlgo_Builder` partition; see COMPROMISE(kernel-guard). | Genuine kernel fault (8.0.1 wasm), worked around via the exact GF partition. |
| examples/bracelet, examples/bicycle_tire, examples/build123d_logo*, examples/maker_coin (PASS) | Freeform-surface, wrap, Text-normal and `new_edges` rounds — see the git history of this file for the full write-ups; kept here only as the record that they are closed. | — | Closed in earlier rounds. |
| SKIP x10 (python_logo, tea_cup builder, general_examples_algebra/ex10, docs/line_types, docs/constraint_examples, docs/rigid_joints_pipe, docs/rod_end, docs/technical_drawing, docs-objects/text, docs-selectors/sort_distance_from) | Real build123d 0.11.1 fails natively on these: no module-level shapes, or an import/API that 0.11.1 does not have (`bd_warehouse` x3, `ImageFace`, `tcv_screenshots`, `ColorMap`). | n/a | Excluded from scoring by the harness. |

### Selectors, 1-D solvers and GUI-doc round (this round)

177 PASS -> **204 PASS**, 34 ERROR -> 9, 11 MISMATCH -> 8, and every script
that passed before still passes. Buckets worked in order:
topology-selection properties, 1-D constrained objects, the
"deliberate but tractable" items, then a triage pass over the MISMATCHes.

| Script(s) | Root cause | Upstream defaults vs lite | Verdict |
|---|---|---|---|
| docs-selectors/filter_nested, /filter_shape_properties, /filter_all_edges_circle, /group_axis, /group_hole_area, /sort_along_wire, /sort_sortby, /group_properties_with_keys (ERROR x8 -> 7 PASS + 1 traversal-order MISMATCH) | The selector surface the topology-selection docs exercise: `ShapeList.wires`, `Face.is_circular_convex/_concave`, `Face.center_location`/`position_at`, `Mixin1D.normal`, `Edge`/`Wire.param_at_point`, `sort_by(<edge or wire>)`, `Shape.distance`/`distance_to`/`closest_points`, `GroupBy.group(key)`, iterating a Builder in `add()`, and fillet/chamfer over edges pooled from SEVERAL intermediate shapes. | All ported from 0.11.1. Three defaults had to change to match: `sort_by_distance` sorts by the MINIMAL distance (`distance_to`, BRepExtrema_DistShapeShape) rather than centre distance, `filter_by_position` returns its survivors SORTED along the axis, and `group_by` passes non-numeric keys through unrounded. fillet/chamfer now take their target from the ACTIVE BUILDER like upstream (`target = context._obj`) and map each edge onto it geometrically. | Closed. `Face._curvature_sign` is a substitution, not a behaviour compromise: gp_Cylinder/gp_Sphere/gp_Torus are unbound here, so the reference distance comes from the second fundamental form (`S_dd . N < 0` is exactly `normal . (P - reference) > 0` for these three quadrics) — COMPROMISE(curvature-sign). |
| docs/objects_1d_airfoil, _blend_curve, _bspline, _ellipticalstartarc, _parabolic_hyperbolic, docs-rst/tutorial_constraints/b03, /b05, /b09, /b10 (ERROR x9 -> PASS) | The 1-D CONSTRAINED/analytic objects: `BSpline`, `ParabolicCenterArc`/`HyperbolicCenterArc` (incl. the LIMIT form of `arc_size`), `EllipticalStartArc`, `BlendCurve`, `Airfoil`, `Triangle`, plus `derivative_at`, `curvature_comb`, `Edge.trim` by point, `trim_to_other` and `ArrowHead`. | Each is now the upstream construction on bound OCCT classes: `Geom_BSplineCurve` from poles/knots/multiplicities, `gp_Parab`/`gp_Hypr` trimmed by `GC_MakeArcOf*` (including make_hyperbola's major>=minor swap with the matching angle-range shift), the ellipse frame from the start tangent, and the cubic/quintic Bezier control points from `derivative_at(1)`/`derivative_at(2)`. `Triangle` carries a port of the `trianglesolver` package's law-of-sines/cosines solver. Airfoil's point dedup has to round to GEOM_KEY_DIGITS the way `Vector.__hash__` does — without it the two trailing-edge points differ by 1.8e-17 and OCCT's `BSplCLib::Interpolate` fails on the periodic spline. | Closed. |
| docs/objects_1d_constrained, docs-rst/tutorial_constraints/b13 (ERROR x2 -> PASS) | `ConstrainedArcs` / `ConstrainedLines`: circles and lines constrained by tangency to other geometry, with GccEnt qualifiers, `Sagitta` arc selection and a user `selector`. | Upstream is a thin wrapper over OCCT's 2-D geometric constraint solvers (`Geom2dGcc_Circ2d2TanRad`, `_Circ2d2TanOn`, `_Circ2d3Tan`, `_Circ2dTanCen`, `_Circ2dTanOnRad`, `_Lin2d2Tan`, `_Lin2dTanObl`) plus `Geom2dGcc_QualifiedCurve`. **None of that family exists in this wasm build** — the .d.ts declares them, but the module exposes no such property at runtime, and neither does `GccEnt`. The two cases the docs exercise (circle/point targets) are therefore solved in CLOSED FORM here, with upstream's semantics kept intact: the centre loci are circles of radius `R ± r` per qualifier (OUTSIDE = external contact, ENCLOSING = the solution contains the target, ENCLOSED = the reverse), a solution is rejected when its contact point falls outside the target's TRIMMED range (upstream's `_param_in_trim`), and both arcs between the contact parameters are built so `Sagitta.SHORT/LONG/BOTH` picks the same one. | Closed for the documented cases, verified against the reference's own intermediates: 8 solution arcs with lengths [2.8095, 2.8095, 3.0834, 3.0834, 3.4914, 3.4914, 6.6149, 6.6149] and the 4 common tangent lines with identical end points. The `center=`/`center_on=`/three-tangency/oriented-line overloads still raise, with the reason: their solution SETS feed a user selector, so guessing an enumeration would be guessing the answer. |
| docs/objects_3d (`Wedge`), docs-rst/topology_selection/b12 (`topo_distance_to`), docs-rst/objects-text/b10 (text along a path) (ERROR x3 -> PASS) | Individually missing objects/operations. objects_3d also needed `ConvexPolyhedron`. | `Wedge` is `BRepPrimAPI_MakeWedge`'s min/max form (bound as `_3`), `ConvexPolyhedron` sews the quickhull3d facets, `topo_distance_to` is a BFS over the parent's peer adjacency (Faces via an Edge, Edges/Wires via a Vertex, Shells/Solids via a Face) with sub-shapes identified geometrically, and `Text(path=)` places each glyph exactly like `Compound.make_text`'s `position_glyph`. | Closed. |
| docs/spitfire_wing_gordon (was `ImportError: pytest`, now TIMEOUT) | The script asserts `wing.volume / 1e9 == pytest.approx(1.9879945989)`. | Added a REAL `pytest.approx` (documented defaults rel 1e-6 / abs 1e-12, sequences and dicts); every other pytest attribute raises. The script now runs: `Vector(())` is the origin (`0 * (x, y, z)` is how the docs write a conditional offset) and `intersect(Axis)` on a 1-D shape returns the ShapeList of Vertex upstream returns. | Open, measured: the wing's Gordon surface takes **386 s** in this wasm build (the harness budget is 60 s) and then comes back null. The blocker is the cost/robustness of COMPROMISE(gordon-surface-realization) at wing scale, not the missing shim. |
| docs/objects_2d (ERROR, `Draft`) | `Draft` here is **not** the draft-angle operation (lite has had `draft()`/BRepOffsetAPI_DraftAngle for rounds) — it is `drafting.Draft`, the dimension-styling dataclass, and the script goes on to use `ExtensionLine`, `DimensionLine` and `TechnicalDrawing`. | n/a — the blocker is the whole `drafting` module (dimension lines with arrows, extension lines, label text and the drawing frame), 42 measured shapes deep. `ArrowHead`/`HeadType` are now implemented; the rest is not. | Deliberate gap, with the misidentification corrected: no kernel binding is missing here. |
| ttt/ttt-24-SPO-06-Buffer_Stand (ERROR, `full_round`) | `full_round` replaces an edge with the arc of the largest empty circle that fits in the face. | Upstream generates the CANDIDATE centres with `scipy.spatial.Voronoi` (2-D) over 100 samples per edge and then averages the best three candidates — so the result depends on the exact candidate set. Lite's scipy shim raises for 2-D `Voronoi`/`ConvexHull` (qhull is not available; the 3-D hull is served by the bundled quickhull3d). | Deliberate gap, with the reason: it needs a 2-D Voronoi diagram. The honest route is a Delaunay triangulation (circumcentres ARE the Voronoi vertices), which would reproduce the same candidate SET; it is the next numerical method worth adding, not a defaults difference. |
| ttt/ttt-23-02-02-sm_hanger (ERROR, was "no edges given" and un-triaged) | Two real gaps, in order: (1) `fillet(side_line.vertices(), 7)` is the **1-D** corner fillet of an open line (upstream's `Wire.fillet_2d` -> ChFi2d/Geom2dGcc), and (2) the script's shape comes from `make_brake_formed`, sheet-metal brake forming, which lite does not implement at all. | The misleading "no edges given" was itself a lite bug: `Builder.vertices()` read `self._obj`, which for a BuildLine only exists after `__exit__`, so a mid-context `side_line.vertices()` came back empty. The selectors now read the line built so far, and the fillet raises a message naming `Wire.fillet_2d`. | Triaged: two missing features (1-D wire fillet, brake forming), not a selector-result difference. |
| ttt/ttt-23-t-24-curved_support (ERROR, `sympy`) | The part's dimensions are derived with sympy's symbolic solver. | n/a | Deliberate gap: shimming a symbolic algebra system is out of scope. |
| docs/slide_latch (was MISMATCH, now PASS) | The open question — "does 0.11.1 localize `add(<global face>)` inside a face-workplane BuildSketch?" — is answered: **yes, conditionally.** `BuildSketch._add_to_context` expresses a face that is NOT coplanar with Plane.XY in its own plane's frame and drops it onto z = 0 (keeping the in-plane x/y offset), and then orients EVERY incoming face +Z. | Lite now performs the same two steps in `_combine`. | Closed: lite bug (missing sketch-face alignment). |
| docs/heart_token (was MISMATCH, bbox 2.0 mm, now PASS) | Two lite bugs in one script: `offset(amount=2, kind=Kind.INTERSECTION)` on a SKETCH ran a 3-D `MakeOffsetShape` (thickening the sketch by ±2 in z) instead of upstream's 2-D wire offset, and `mirror(about=Plane.YZ)` inside a BuildSketch left TWO half faces because a mirrored face has a -Z normal and coplanar faces with opposite normals are not the same domain, so they never fused. | `offset()` now offsets the outer wire by +amount and each inner wire by -amount and rebuilds the planar face (upstream's face branch), and the sketch-face alignment above supplies the +Z orientation that lets the halves fuse (1 face, area 200.20972988622623 == upstream). | Closed: two lite bugs. |
| docs-selectors/group_properties_with_keys (was ERROR then MISMATCH, now PASS) | After `Mixin1D.normal` and `GroupBy.group(key)` landed, two deeper differences remained: (1) `copy.copy(<builder>)` returned the SAME builder, so `before_fillet`/`after_fillet`/`after_holes` all reported the FINAL geometry, and (2) lite built a full `CenterArc` as TWO half arcs, which changed `group_by(Edge.length)` keys and the per-edge sampling of `make_hull` (hull area 490.92205 vs upstream 490.921953, and 11 selected edges instead of 12). | `copy.copy` now shallow-copies the builder like upstream's (later operations rebind `_obj`, so the copy IS the snapshot), and a full circle is ONE closed edge. The hull is now bit-identical (490.921953150644) and the length groups and 12 selected edges match exactly; before_fillet 9751.639 / after_fillet 9730.739 == upstream. | Closed: two lite bugs. |
| docs-selectors/selectors_operators (was MISMATCH, bbox 6.0 mm, now PASS) | `line @ 2/3` parses as `(line @ 2) / 3` — Python's `@` has the same precedence as `/` — so the docs place objects at twice the line's end point divided by three. Lite CLAMPED `position_at` to [0, 1] and returned the end point. | Upstream extrapolates (`param_at`: "positions outside [0, 1] are not validated and yield OCCT-dependent results"); lite now does too. | Closed: lite bug. |
| ttt/ttt-ppp0107 (was MISMATCH, -1.0% / -0.9%, now PASS) | The audit's guess ("two `extrude(until=)` intermediates") was WRONG: `zz`/`zz2` are a TAPERED extrude, `extrude(amount=15, taper=-10)`. Lite always used `LocOpe_DPrism`. | `Solid.extrude_taper` uses TWO algorithms: DPrism only for a POSITIVE taper along the profile normal with no holes, otherwise a LOFT between the profile wires and their 2-D offsets (`-length * tan(taper)`, Kind.INTERSECTION, inner wires flipped). A bare `taper=-10` rectangle now measures 2957.1391331767363 — bit-identical to the reference. | Closed: lite bug (one algorithm instead of two). |
| every raw kernel error, everywhere (infrastructure, earlier round) | Emscripten throws OCCT's C++ exceptions as bare pointer NUMBERS. | The fork binds `OCJS::getStandard_FailureData` for exactly this, but it is UNCALLABLE here ("unbound types: St9exception"). | COMPROMISE(failure-decode): CascadeWorker keeps the wasm `Memory` via Emscripten's `instantiateWasm` hook and StandardUtils reads `Standard_Failure`'s message out of it directly. |

### OCCT binding round: Geom2dGcc, quadrics, STEP assets, Voronoi, brake forming (this round)

204 PASS -> **207 PASS**, 9 ERROR -> 6, and the two remaining
`import_step`/`sm_hanger` scripts went ERROR -> MISMATCH. Four of the nine
errors were blocked on the WASM build rather than on lite, so this round
started in the fork: `builds/cascadestudio.yml`,
`src/filter/filterMethodOrProperties.py` and a new hand-registered `OCJS_Out`
helper class (see the fork's CHANGELOG).

| Script(s) | Root cause | Upstream defaults vs lite | Verdict |
|---|---|---|---|
| docs/objects_1d_constrained, docs-rst/tutorial_constraints/b13 (PASS -> PASS, now on the REAL solvers) | Last round's verdict — "none of the `Geom2dGcc` family exists in this wasm build" — was right about the symptom and wrong about the cause. The classes were in the yml; every binding file in the `Geom2dGcc`/`GccAna` packages failed to COMPILE on one method, `WhichQualifier(Standard_Integer, GccEnt_Position&, GccEnt_Position&)`, whose non-const enum out-params Embind cannot bind (`bind.h:531`). One bad method takes the whole file down, and the build tolerated the failure silently. | The fork now filters any method with a non-const `GccEnt_Position&` parameter (the BSplCLib enum-out-param precedent), so `Geom2dGcc_Circ2d2TanRad`, `_Circ2d2TanOn`, `_Circ2d3Tan`, `_Circ2dTanCen`, `_Circ2dTanOnRad`, `_Lin2d2Tan` and `_Lin2dTanObl` are real here. `ConstrainedArcs`/`ConstrainedLines` are now a statement-for-statement port of build123d's `topology/constrained_lines.py` (kernel side in `StandardLibrary.js`: `ConstrainedArcs2D` / `ConstrainedLines2D`), including `_param_in_trim`, `_enclosed_circ_param_offset` and the Sagitta arc pair. The Tangency parameters come back through `OCJS_Out.<Solver>_Tangency<N>()`, because `Standard_Real&` out-params are passed BY VALUE through Embind. | Closed, and the closed-form stand-in is retired. **All five arc overloads and all three line overloads** were verified against the reference venv on the doc examples (`radius=`, `center_on=`, three-tangency, `center=`, `radius=`+`center_on=`, two-tangent lines, tangent+point, oriented line): worst bbox delta **1.8e-15 mm** over 8 result sets, with identical edge counts. |
| docs-selectors/filter_nested & friends — COMPROMISE(curvature-sign) | `Face.is_circular_convex/_concave` needed the surface's own reference geometry, and `gp_Cylinder`/`gp_Sphere`/`gp_Torus` were unbound, so the sign came from the second fundamental form instead. | The three quadrics are bound now, so `_faceCurvatureSign` reads upstream's own reference (cylinder axis, sphere centre, torus core circle) and dots it against the oriented normal. The second-fundamental-form path is kept as the fallback for kernels without them. | COMPROMISE(curvature-sign) **retired**. |
| Face.normal_at / location_at — COMPROMISE(point-projection) | `GeomAPI_ProjectPointOnSurf` was registered but not constructible: every constructor takes an `Extrema_ExtAlgo`, and the enum was unbound. Lite ran a 24x24 UV grid search refined by Newton. | `Extrema_ExtAlgo`/`Extrema_ExtFlag` are bound, and `LowerDistanceParameters(u&, v&)` is read back through `OCJS_Out`. The grid+Newton search is kept only as a fallback for the cases OCCT reports no solution for. | COMPROMISE(point-projection) **retired**. |
| docs/tutorial_joints, docs-selectors/filter_inner_wire_count (ERROR x2, `import_step`) | Both import a STEP asset from a path next to `__file__`. The CAD worker has no filesystem. | The asset is now delivered ahead of the run instead of being read: `collect.py` records the CAD files a script names, `run-lite.mjs` reads them out of the clone, and `CascadeAPI.loadExternalFiles()` hands them to the worker's existing STEP-import path (MEMFS + `STEPControl_Reader`) and **awaits the import** before evaluating. `import_step` resolves the requested path by base name. | filter_inner_wire_count **PASS** (53 shapes; also needed `Face.radius`, `Face.axis_of_rotation`, `ShapeList.edge()/face()/wire()/vertex()/solid()`, and `Location(position, angles, Intrinsic/Extrinsic order)`). tutorial_joints **MISMATCH on `m6_screw` alone** — the other 7 shapes match to 1e-9; the screw is placed by `CylindricalJoint.relative_to(..., position=5, angle=30)` off `hole2`, and lite's hole-location enumeration puts it on a different hole frame. Joints now survive `Shape.moved` and `Compound(joints=)`, and `Joint.symbol`, `Shape.show_topology` and `Compound.do_children_intersect` are implemented. |
| ttt/ttt-24-SPO-06-Buffer_Stand (ERROR, `full_round`) -> **PASS** | `full_round` picks the largest empty circle from the VORONOI VERTICES of 101 samples per edge over the target edge and its two neighbours, averages the best three, and rebuilds the face. | The scipy shim now has a real 2-D `Voronoi`: a Bowyer-Watson Delaunay whose circumcentres, deduplicated the way qhull's `Qbb Qc` merges cocircular ones, ARE the finite Voronoi vertices. Verified against scipy 1.18 on full_round's own inputs — the vertex SETS are identical (220 and 210 vertices, max deviation 2e-13) and the resulting circle centres agree to 1e-14. `full_round` itself is a statement-for-statement port, including the strict `<` best-three loop. Only `.vertices` is offered; the ridge/region attributes raise. | Closed. The script's own mass assert (3.923 lb ± 0.02) passes. |
| ttt/ttt-23-02-02-sm_hanger (ERROR) -> MISMATCH | Two missing features: the 1-D corner fillet of an OPEN line (`Wire.fillet_2d`) and `make_brake_formed`. | Both ported. `Wire.fillet_2d` maps the wire into its own plane (upstream's `common_plane` + `to_local_coords`), fillets one corner at a time on **`ChFi2d_FilletAlgo`** — upstream's primary solver, now bound in the fork — and splices the arc between the two trimmed edges in connection order, with the Geom2dGcc tangent-arc solver as upstream's fallback. `make_brake_formed` is the upstream algorithm: `offset_2d(thickness, side)` for the section, a station edge per line vertex (the offset vertex exactly `thickness` away), `Face.extrude` by each width along the section plane's normal, and `sweep_multi` between consecutive stations, fused. | The part is now exact where it counts: the filleted `side_line` is 187.2428359925111 mm (bit-identical), the brake-formed side solid is **33201.973161 mm³ / 16 faces** against upstream's 33201.97324 / 16, and the script's own mass assert (1028 g ± 10) passes. The remaining MISMATCH is `l1`/`l2` only — a BuildLine on a non-XY workplane leaves its module-level line variables in LOCAL coordinates in lite, and the harness compares the last binding of a reused name. |
| offset_2d Side.LEFT/RIGHT on a wire that is not parallel to Plane.XY (lite bug found by sm_hanger) | Upstream picks the side with `tangent.get_signed_angle(centre - start)`, a signed angle taken about the FIXED `-Z` reference. For a wire in Plane.XZ the cross product has no `-Z` component, so OCCT's `gp_Vec::AngleWithRef` falls back to the UNSIGNED angle (antiparallel is +180). Python's `atan2` returns **-180** for a negative zero, which flipped every LEFT/RIGHT pick on such wires. | `Vector.get_signed_angle` now returns the unsigned angle when the reference component is negligible, exactly as `AngleWithRef` does. | Closed: lite bug. The tab section then offsets to upstream's side (65.70796326552919 mm, bit-identical). |
| PipeShellSweep profile wires (lite bug found by make_brake_formed) | `PipeShellSweep` rebuilt each profile wire by adding its edges ONE AT A TIME from a `TopExp_Explorer`, which is storage order — `BRepBuilderAPI_MakeWire` silently drops any edge that does not touch the wire built so far. A brake-formed section came out as a 3-face open shell instead of a 6-face solid. | The edges are added as a `TopTools_ListOfShape` so the builder can connect them in any order (the same call `WireFromEdgesFixed` already used). | Closed: lite bug. |
| docs/objects_2d (ERROR, `Draft`) | Unchanged: the `drafting` module. | Scoped-out this round after measuring it: the port is ~450 code lines and its accuracy rides entirely on `Compound.make_text` glyph metrics, since `label_length = Text(...).bounding_box().size.X` feeds every arrow position and the 3-candidate label-placement score in `DimensionLine`. No OCCT binding is missing. | Deliberate gap, now sized. |
