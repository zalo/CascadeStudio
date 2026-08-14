# build123d-lite validation report

Generated 2026-08-14T00:23:42.691Z - 232 scripts (222 scored, 10 excluded because real build123d fails natively).

| Status | Count |
|---|---|
| PASS | 177 |
| MISMATCH | 11 |
| ERROR | 34 |
| TIMEOUT | 0 |
| SKIP | 10 |

## Feature-gap frequency (ERROR bucket)

| Gap | Scripts |
|---|---|
| `NameError: BlendCurve` | 2 |
| `NameError: ConstrainedArcs` | 2 |
| `NameError: ParabolicCenterArc` | 2 |
| `ImportError: undefined` | 2 |
| `NotImplemented: import_step is not supported in build123d-lite` | 2 |
| `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds` | 1 |
| `NotImplemented: build123d-lite Mesher writes STL only (no lib3mf in the WASM build); got dual_color.3mf` | 1 |
| `other: Line 7224: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in FilletEdges: the OC` | 1 |
| `NameError: Airfoil` | 1 |
| `NameError: BSpline` | 1 |
| `NameError: EllipticalStartArc` | 1 |
| `NotImplemented: Wedge is not supported in build123d-lite` | 1 |
| `NameError: Draft` | 1 |
| `AttributeError: wires` | 1 |
| `AttributeError: center_location` | 1 |
| `AttributeError: is_circular_convex` | 1 |
| `ValueError: all edges must belong to the same shape` | 1 |
| `TypeError: 'BuildPart' object is not iterable` | 1 |
| `TypeError: unsupported sort/group key: <Curve object>` | 1 |
| `AttributeError: normal` | 1 |
| `ValueError: no edges given (use shape.edges() selectors)` | 1 |
| `AttributeError: distance` | 1 |
| `NameError: full_round` | 1 |
| `RuntimeError: KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an operand (result volume 0 < l` | 1 |
| `other: Line 7224: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in ChamferEdges: the O` | 1 |
| `NameError: topo_distance_to` | 1 |
| `NameError: Triangle` | 1 |
| `AttributeError: trim` | 1 |
| `NotImplemented: Text along a path is not supported in build123d-lite` | 1 |

## Mismatches (runs, but geometry differs)

- **examples/joints**
  - 'pin_arm' bbox[0] 5.3933 vs 8.0835 (d=2.6903)
  - 'screw_arm' bbox[0] 1.0688 vs 3.6800 (d=2.6113)
  - 'slider_arm' bbox[0] 5.3255 vs -3.7834 (d=9.1089)
- **examples/joints_algebra**
  - 'pin_arm' bbox[0] 5.3933 vs 8.0835 (d=2.6903)
  - 'screw_arm' bbox[0] 1.0688 vs 3.6800 (d=2.6113)
  - 'slider_arm' bbox[0] 5.3255 vs -3.7834 (d=9.1089)
- **examples/projection**
  - 'projected_text' bbox[0] -49.7713 vs -49.6470 (d=0.1243)
- **examples/projection_algebra**
  - 'projected_text' bbox[0] -49.7713 vs -49.6470 (d=0.1243)
- **docs/heart_token**
  - 'heart_token' bbox[0] -9.9827 vs -11.9827 (d=2.0000)
  - 'outline' bbox[0] -9.9827 vs -11.9827 (d=2.0000)
- **docs/objects_1d**
  - 'l1' bbox[3] 5.0000 vs 0.0000 (d=5.0000)
  - 'l3' bbox[0] 6.0000 vs 1.2420 (d=4.7580)
  - 'l4' bbox[1] 4.5000 vs 0.0000 (d=4.5000)
  - 'scene' bbox[0] -0.0667 vs -0.1700 (d=0.1033)
- **docs-selectors/selectors_operators**
  - 'b' bbox[0] 0.5000 vs 6.5000 (d=6.0000)
  - 'c' bbox[0] 1.0000 vs 7.0000 (d=6.0000)
  - 'faces[0]' bbox[0] 0.5000 vs 6.5000 (d=6.0000)
  - 'faces[1]' bbox[0] 1.0000 vs 7.0000 (d=6.0000)
- **docs-selectors/sort_axis**
  - 'part' volume 4765.102 vs 5585.161 (-14.68%)
  - 'part' bbox[3] 34.0000 vs 50.0000 (d=16.0000)
- **docs/slide_latch**
  - 'latch' volume 29452.879 vs 11831.250 (148.94%)
  - 's1' bbox[0] 30.2500 vs -4.7500 (d=35.0000)
  - 'slide' volume 16943.734 vs 16765.459 (1.06%)
  - 'slide' bbox[0] 4.5000 vs -8.0000 (d=12.5000)
  - 'slide_hole' bbox[0] 35.0000 vs -5.0000 (d=40.0000)
- **ttt/ttt-ppp0107**
  - 'zz' volume 2927.114 vs 2957.139 (-1.02%)
  - 'zz2' volume 1745.447 vs 1760.459 (-0.85%)
- **docs-rst/tips/b04**
  - 'vertical_sketch' bbox[1] -0.5000 vs -0.7000 (d=0.2000)

## Passing scripts

- examples/boxes_on_faces_algebra (2 shapes)
- examples/boxes_on_faces (1 shapes)
- examples/build123d_customizable_logo_algebra (13 shapes)
- examples/build123d_customizable_logo (14 shapes)
- examples/build123d_logo (13 shapes)
- examples/build123d_logo_algebra (12 shapes)
- examples/canadian_flag (20 shapes)
- examples/canadian_flag_algebra (25 shapes)
- examples/circuit_board (1 shapes)
- examples/circuit_board_algebra (1 shapes)
- examples/clock_algebra (6 shapes)
- examples/custom_sketch_objects (9 shapes)
- examples/custom_sketch_objects_algebra (9 shapes)
- examples/din_rail (3 shapes)
- examples/din_rail_algebra (41 shapes)
- examples/clock (5 shapes)
- examples/bicycle_tire (102 shapes)
- examples/extrude_algebra (35 shapes)
- examples/extrude (10 shapes)
- examples/handle (10 shapes)
- examples/handle_algebra (4 shapes)
- examples/fast_grid_holes (4 shapes)
- examples/holes (4 shapes)
- examples/holes_algebra (4 shapes)
- examples/intersecting_chamfers (1 shapes)
- examples/intersecting_chamfers_algebra (2 shapes)
- examples/intersecting_pipes (3 shapes)
- examples/key_cap (5 shapes)
- examples/key_cap_algebra (5 shapes)
- examples/bracelet (16 shapes)
- examples/lego (3 shapes)
- examples/lego_algebra (3 shapes)
- examples/loft (4 shapes)
- examples/loft_algebra (3 shapes)
- examples/mixed_algebra_context (9 shapes)
- examples/multiple_workplanes (1 shapes)
- examples/multiple_workplanes_algebra (1 shapes)
- examples/packed_boxes (100 shapes)
- examples/pegboard_j_hook (10 shapes)
- examples/pegboard_j_hook_algebra (11 shapes)
- examples/pillow_block (2 shapes)
- examples/pillow_block_algebra (2 shapes)
- examples/platonic_solids (5 shapes)
- examples/playing_cards (14 shapes)
- examples/maker_coin (8 shapes)
- examples/heat_exchanger_algebra (4 shapes)
- examples/roller_coaster (4 shapes)
- examples/roller_coaster_algebra (4 shapes)
- examples/shamrock (1 shapes)
- examples/stud_wall (2 shapes)
- examples/tea_cup_algebra (5 shapes)
- examples/heat_exchanger (3 shapes)
- examples/twist_extrude (2 shapes)
- examples/vase (8 shapes)
- general_examples/ex01 (1 shapes)
- general_examples/ex02 (1 shapes)
- general_examples/ex03 (2 shapes)
- general_examples/ex08 (3 shapes)
- general_examples/ex09 (1 shapes)
- general_examples/ex10 (1 shapes)
- general_examples/ex11 (2 shapes)
- general_examples/ex12 (7 shapes)
- examples/vase_algebra (8 shapes)
- general_examples/ex13 (1 shapes)
- general_examples/ex14 (6 shapes)
- general_examples/ex15 (8 shapes)
- general_examples/ex17 (2 shapes)
- general_examples/ex18 (1 shapes)
- general_examples/ex19 (6 shapes)
- general_examples/ex20 (1 shapes)
- general_examples/ex21 (2 shapes)
- general_examples/ex22 (2 shapes)
- general_examples/ex16 (3 shapes)
- general_examples/ex23 (5 shapes)
- general_examples/ex24 (3 shapes)
- general_examples/ex25 (4 shapes)
- general_examples/ex26 (2 shapes)
- general_examples/ex27 (2 shapes)
- general_examples/ex29 (7 shapes)
- general_examples/ex28 (7 shapes)
- general_examples/ex30 (5 shapes)
- general_examples/ex32 (3 shapes)
- general_examples/ex31 (2 shapes)
- general_examples/ex33 (3 shapes)
- general_examples/ex35 (5 shapes)
- general_examples/ex36 (3 shapes)
- general_examples/ex37 (2 shapes)
- general_examples_algebra/ex01 (1 shapes)
- general_examples/ex34 (4 shapes)
- general_examples_algebra/ex02 (1 shapes)
- general_examples_algebra/ex03 (2 shapes)
- general_examples_algebra/ex08 (3 shapes)
- general_examples_algebra/ex09 (1 shapes)
- general_examples_algebra/ex12 (6 shapes)
- general_examples_algebra/ex11 (2 shapes)
- general_examples_algebra/ex14 (6 shapes)
- general_examples_algebra/ex13 (1 shapes)
- general_examples_algebra/ex15 (8 shapes)
- general_examples_algebra/ex17 (2 shapes)
- general_examples_algebra/ex18 (2 shapes)
- general_examples_algebra/ex16 (10 shapes)
- general_examples_algebra/ex19 (6 shapes)
- general_examples_algebra/ex20 (2 shapes)
- general_examples_algebra/ex21 (1 shapes)
- general_examples_algebra/ex22 (2 shapes)
- general_examples_algebra/ex23 (4 shapes)
- general_examples_algebra/ex24 (2 shapes)
- general_examples_algebra/ex25 (5 shapes)
- general_examples_algebra/ex26 (2 shapes)
- general_examples_algebra/ex27 (2 shapes)
- general_examples_algebra/ex29 (8 shapes)
- general_examples_algebra/ex28 (3 shapes)
- general_examples_algebra/ex30 (3 shapes)
- general_examples_algebra/ex32 (2 shapes)
- general_examples_algebra/ex33 (1 shapes)
- general_examples_algebra/ex31 (1 shapes)
- general_examples_algebra/ex35 (4 shapes)
- docs/center (5 shapes)
- general_examples_algebra/ex34 (3 shapes)
- general_examples_algebra/ex36 (3 shapes)
- docs/pack_demo (12 shapes)
- docs/selector_example (1 shapes)
- docs-selectors/filter_axisplane (13 shapes)
- docs-selectors/filter_geomtype (1 shapes)
- ttt/ttt-ppp0103 (4 shapes)
- ttt/ttt-ppp0104 (9 shapes)
- ttt/ttt-ppp0101 (9 shapes)
- ttt/ttt-ppp0102 (6 shapes)
- ttt/ttt-ppp0106 (9 shapes)
- ttt/ttt-ppp0105 (5 shapes)
- ttt/ttt-ppp0108 (6 shapes)
- docs-rst/OpenSCAD/b01 (2 shapes)
- docs-rst/OpenSCAD/b02 (2 shapes)
- docs-rst/OpenSCAD/all (2 shapes)
- ttt/ttt-ppp0109 (8 shapes)
- docs-rst/algebra_performance/b03 (1 shapes)
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
- docs-rst/key_concepts_builder/b10 (1 shapes)
- docs-rst/key_concepts_builder/b09 (2 shapes)
- docs-rst/key_concepts_builder/b13 (2 shapes)
- docs-rst/key_concepts_builder/b14 (1 shapes)
- docs-rst/key_concepts_builder/b11 (1 shapes)
- docs-rst/key_concepts_builder/b19 (1 shapes)
- docs-rst/key_concepts_builder/b20 (1 shapes)
- docs-rst/key_concepts_builder/b17 (1 shapes)
- docs-rst/key_concepts_builder/b21 (2 shapes)
- docs-rst/selectors/b02 (3 shapes)
- docs-rst/location_arithmetic/all (2 shapes)
- docs-rst/selectors/all (3 shapes)
- docs-rst/tips/b05 (1 shapes)
- docs-rst/topology_selection/b01 (1 shapes)
- docs-rst/topology_selection/b03 (1 shapes)
- docs-rst/topology_selection/b04 (1 shapes)
- docs-rst/topology_selection/b05 (1 shapes)
- docs-rst/topology_selection/b06 (1 shapes)
- docs-rst/topology_selection/b07 (1 shapes)
- docs-rst/topology_selection/b08 (3 shapes)
- docs-rst/topology_selection/b09 (4 shapes)
- docs-rst/tutorial_constraints/b06 (3 shapes)
- docs-rst/tutorial_constraints/b07 (3 shapes)
- docs-rst/tutorial_constraints/b08 (3 shapes)
- docs-rst/tutorial_constraints/b11 (2 shapes)
- docs-rst/tutorial_stl_reconstruction/b03 (1 shapes)
- docs-rst/tutorial_design/b07 (3 shapes)
- docs-rst/tutorial_stl_reconstruction/b04 (26 shapes)
- docs-rst/topology_selection-filter_examples/b01 (1 shapes)
- docs-rst/algebra_performance/b01 (3 shapes)
- docs-rst/algebra_performance/all (67 shapes)

## Errors by script

- examples/cast_bearing_unit: `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds`
- examples/dual_color_3mf: `NotImplemented: build123d-lite Mesher writes STL only (no lib3mf in the WASM build); got dual_color.3mf`
- examples/toy_truck: `other: Line 7224: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in FilletEdges: the OC`
- docs/objects_1d_airfoil: `NameError: Airfoil`
- docs/objects_1d_blend_curve: `NameError: BlendCurve`
- docs/objects_1d_bspline: `NameError: BSpline`
- docs/objects_1d_constrained: `NameError: ConstrainedArcs`
- docs/objects_1d_ellipticalstartarc: `NameError: EllipticalStartArc`
- docs/objects_1d_parabolic_hyperbolic: `NameError: ParabolicCenterArc`
- docs/objects_3d: `NotImplemented: Wedge is not supported in build123d-lite`
- docs/objects_2d: `NameError: Draft`
- docs/spitfire_wing_gordon: `ImportError: undefined`
- docs-selectors/filter_inner_wire_count: `NotImplemented: import_step is not supported in build123d-lite`
- docs/tutorial_joints: `NotImplemented: import_step is not supported in build123d-lite`
- docs-selectors/filter_nested: `AttributeError: wires`
- docs-selectors/filter_all_edges_circle: `AttributeError: center_location`
- docs-selectors/filter_shape_properties: `AttributeError: is_circular_convex`
- docs-selectors/group_hole_area: `ValueError: all edges must belong to the same shape`
- docs-selectors/group_axis: `TypeError: 'BuildPart' object is not iterable`
- docs-selectors/sort_along_wire: `TypeError: unsupported sort/group key: <Curve object>`
- docs-selectors/group_properties_with_keys: `AttributeError: normal`
- ttt/ttt-23-02-02-sm_hanger: `ValueError: no edges given (use shape.edges() selectors)`
- ttt/ttt-23-t-24-curved_support: `ImportError: undefined`
- docs-selectors/sort_sortby: `AttributeError: distance`
- ttt/ttt-24-SPO-06-Buffer_Stand: `NameError: full_round`
- ttt/ttt-ppp0110: `RuntimeError: KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an operand (result volume 0 < l`
- docs-rst/tips/b01: `other: Line 7224: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in ChamferEdges: the O`
- docs-rst/topology_selection/b12: `NameError: topo_distance_to`
- docs-rst/tutorial_constraints/b03: `NameError: Triangle`
- docs-rst/tutorial_constraints/b05: `NameError: BlendCurve`
- docs-rst/tutorial_constraints/b10: `NameError: ParabolicCenterArc`
- docs-rst/tutorial_constraints/b13: `NameError: ConstrainedArcs`
- docs-rst/tutorial_constraints/b09: `AttributeError: trim`
- docs-rst/objects-text/b10: `NotImplemented: Text along a path is not supported in build123d-lite`

## Timeouts


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
| examples/projection, examples/projection_algebra (MISMATCH, `projected_text` only, d=0.12) | The text wraps the *opposite way* around the sphere: the arch path (closed sphere-cylinder intersection edge) is TopAbs_REVERSED in OCP 7.x but FORWARD in 8.0.1 wasm over the SAME geometric parametrization (verified: raw curve at 25% is +Y on both; upstream's flag flips traversal to -Y first, lite's does not). | Everything else now byte-matches: `make_text` align default fixed to `None` (was bbox-CENTER; closed a 1.02 mm shift on `flat_planar_text_faces`), `position_at` switched to arc-length fraction via GCPnts_AbscissaPoint (upstream `_occt_param_at` does exactly this even in PARAMETER mode), and per-glyph text faces now split disjoint outer contours (i/j dots) into separate faces (40 faces == upstream). | Same defaults, kernel edge-orientation history on a closed intersection curve — COMPROMISE(edge-orientation). Not honestly closable. |
| general_examples/ex34, general_examples_algebra/ex34 (now PASS) | `BRepAlgoAPI_Fuse` silently DROPS an operand when coplanar faces meet along BSpline edges (glyph solids fused onto a box face); result was the bare box. | Upstream fuse defaults — no fuzzy value (`tol=None`), glue off, NonDestructive unset — reproduce the drop identically on this kernel; it is the fuse *result-assembly* phase that is broken, the General-Fuse *split* phase is correct on the same inputs. Lite's `Union` detects the drop (result volume < largest input) and rebuilds from the `BOPAlgo_Builder` partition; see COMPROMISE(kernel-guard). Lite also always passes fuzz 1e-7 (upstream 0) and runs ShapeUpgrade_UnifySameDomain (upstream's `clean=True`). | Genuine kernel fault (8.0.1 wasm), worked around via the exact GF partition. Fixed this round together with the Text normal flip (extrusions follow the face's oriented normal). |
| examples/build123d_logo_algebra, examples/build123d_customizable_logo_algebra (now PASS) | Regression from the per-glyph text compound: glyph faces inside a mirrored COMPOUND already get their orientation flags flipped by BRepTools_TrsfModification, so Text2D's unconditional `.Reversed()` double-flipped them to -Z and algebra `extrude()` (which follows the face's oriented normal) went below z=0. | Upstream text faces have +Z oriented normals; lite now reverses each glyph face CONDITIONALLY on its measured oriented normal. Builder-mode scripts were unaffected because BuildSketch extrudes along the workplane z_dir, not the face normal. | Lite bug (double reversal), fixed. |
| examples/bracelet (now PASS) | Needed `Face.make_gordon_surface` (upstream delegates to the external `ocp_gordon` package — a Python port of TiGL's curve-network Gordon interpolator, not an OCCT API), plus surface `location_at`/`normal_at` frames, `Shape.__neg__`, `Location.__neg__`, wire `project_to_shape`, planar `Face(wire)` and `Shape.solid()`. | The Gordon interpolator is now a JS port (GordonSurface.js) whose EXACT surface reproduces the reference boundaries to 1e-6 relative. Two defaults had to change to match upstream: `Face(wire)` uses BRepBuilderAPI's OnlyPlane mode (lite built whatever surface the wire's pcurves implied, so the tip cap came back as the freeform surface instead of a flat face), and `Plane(origin, x_dir, z_dir)` orthogonalizes a non-perpendicular `x_dir` the way `gp_Ax3` does inside upstream's `Plane.__init__`. | Closed this round. Final: bracelet volume -0.04%, area -0.001%, tip surface +0.02% (COMPROMISE(gordon-surface-realization) — the exact surface cannot be built as a Geom_BSplineSurface in this wasm build, so it is refit from a dense sample grid). |
| examples/cast_bearing_unit (ERROR) | `FilletEdges` on the hull/draft solid corrupts the wasm heap ("memory access out of bounds"); after a raw abort the OCCT heap is unusable. | Upstream `Solid.fillet` = `BRepFilletAPI_MakeFillet(shape)` (default ChFi3d_Rational) + `Add(radius, edge)`. Lite is identical (explicit ChFi3d_Rational, same Add). No tolerance/continuity knobs differ. | Same defaults, genuine kernel fault in the 8.0.1 wasm fillet on this input. |
| examples/toy_truck (ERROR) | Same fillet path; this input now raises "INTERNAL OPENCASCADE ERROR in FilletEdges" (caught, no heap corruption). | Identical fillet defaults as above. | Same defaults, genuine kernel fault. |
| examples/bicycle_tire (now PASS) | `Shape.wrap_faces` (conform planar faces onto a curved surface along a path) was unimplemented. | Ported statement-for-statement from upstream (`Face.wrap`/`_wrap_face`/`_wrap_wire`/`_wrap_edge`, `Face.make_surface`'s BRepOffsetAPI_MakeFilling parameters, `Edge.make_spline`/`param_at`/`trim`/`_extend_spline`). Two lite defaults were wrong and are now upstream's: `Trapezoid` widens the BOTTOM for an obtuse side angle instead of narrowing the top (the tread pattern was 120 mm^2 instead of 96.86), and `make_face` CLEANS its result like upstream's `_add_to_context` (ShapeUpgrade_UnifySameDomain merges tangent Bezier chains into one B-spline — without it the tire profile had 40 edges instead of 37 and the revolved tire was 0.84% off). | Closed this round. All 104 measured shapes match, including the three wrapped tread faces (bit-identical areas), the thickened nubs and all 64 rotated copies. |
| examples/dual_color_3mf (ERROR, narrowed) | Was `offset_2d(..., side=Side.LEFT/RIGHT)` (one-sided offsets of OPEN lines); that is now implemented and ALL SIX measured shapes match the reference exactly (inset 91.6342 mm^3, outset 308.3658 mm^3). The script still ERRORs on its last statement, `Mesher.write("dual_color.3mf")`. | Upstream's `Wire.offset_2d` open-mode branch is ported exactly (MakeOffset with an explicit join type, end-cap removal, side pick by signed angle, close-back edges); verified against native band areas 28.0 / 35.141593. `Wire.position_at` also had to walk a wire in BRepTools_WireExplorer connection order and flip a first edge whose raw parametrization runs backwards. | Geometry closed this round. Remaining failure is COMPROMISE(mesher): there is no lib3mf in this wasm build, so only STL export exists. |
| SKIP x10 (python_logo, tea_cup builder, general_examples_algebra/ex10, docs/line_types, docs/constraint_examples, docs/rigid_joints_pipe, docs/rod_end, docs/technical_drawing, docs-objects/text, docs-selectors/sort_distance_from) | Real build123d 0.11.1 fails natively on these: no module-level shapes, or an import/API that 0.11.1 does not have (`bd_warehouse` x3, `ImageFace`, `tcv_screenshots`, `ColorMap`). | n/a | Excluded from scoring by the harness. |

### Corpus-broadening round (docs/*.py, Too Tall Toby, docs .rst blocks)

The corpus went from 129 candidates / 126 scored to 382 candidates / **232
scripts, 222 scored**. First pass on the new corpus: 158 PASS. After this
round: **177 PASS / 11 MISMATCH / 34 ERROR / 10 SKIP**, and every script that
passed on the old corpus still passes.

| Script(s) | Root cause | Upstream defaults vs lite | Verdict |
|---|---|---|---|
| docs/slide_latch — the USER-REPORTED kernel error, `fillet(l4.vertices(Select.LAST), radius=2)` → "INTERNAL OPENCASCADE ERROR in FilletFace2D" (now MISMATCH) | **LITE BUG, not a kernel fault.** `Builder.vertices(select)` ignored `select` and returned ALL 12 vertices of the sketch, so the fillet was applied to the slot arcs' line/arc TANGENT vertices as well as the corners; `BRepFilletAPI_MakeFillet2d` cannot fillet a tangent vertex and its `Shape()` raised `StdFail_NotDone`. Verified against the venv: upstream's `Select.LAST` returns exactly 4 vertices — the rectangle corners at (±25, ±15) — while lite returned all 12 including (±35, ±20) and (±25, ±20). | Both sides now compute `lasts` as upstream does (`post - pre` per sub-shape type in `_add_to_context`; the combined objects for the builder's own type). Fillet defaults were never in question. | Closed: lite bug fixed (`_combine` records `lasts` for every builder/operation). The DECODED kernel message is "BRep_API: command not done" — see the exception-decoding row below; the raw pointer '6454200' the user saw carried no information at all. Script now runs end to end; it remains a MISMATCH because 0.11.1's `add(<global face>)` inside a `BuildSketch(<face workplane>)` does NOT localize the face (reference `slide_hole` bbox starts at x=35, lite's at x=-5), which shifts the slide cavity — a separate, still-open localization question. |
| every raw kernel error, everywhere (infrastructure) | Emscripten throws OCCT's C++ exceptions as bare pointer NUMBERS, so users saw "the OCCT kernel threw '6454200' (a raw wasm exception)". | The fork DOES bind `OCJS::getStandard_FailureData(intptr_t) -> Standard_Failure*` for exactly this (builds/cascadestudio.yml), but calling it in this build raises **"Cannot call OCJS.getStandard_FailureData due to unbound types: St9exception"** — `Standard_Failure` derives from `std::exception`, which the build never registers, so embind treats the type as unresolved. The module also exports no runtime helpers (`HEAPU8`/`HEAP32`/`getValue`/`UTF8ToString`/`ccall` are all absent) and no `wasmMemory`. | Substitution, not a compromise in behaviour: CascadeWorker keeps the wasm `Memory` via Emscripten's documented `instantiateWasm` hook and StandardUtils reads `Standard_Failure`'s `StringRef` message straight out of it (`*(ptr+4)+4`, NUL-terminated) — COMPROMISE(failure-decode). Wired into CacheOp, ShapeToMesh, the worker's console.error and PythonRuntime; ShapeToMesh also no longer TypeErrors trying to set `.message` on a number. |
| docs-selectors x13 (was `ImportError`) | `import os` — the scripts locate their STEP assets and SVG/PNG output relative to `os.path.dirname(os.path.abspath(__file__))`. | Added an `os` shim that is **path arithmetic only** (join/split/dirname/basename/splitext/normpath/abspath/isabs, `getcwd`, `environ`); `os.path.exists` is always False and there is no `open`/`listdir`, so a script that genuinely needs a file still fails loudly. `__file__` already resolves in Brython. | Closed for 8 of them. The other 5 now fail on distinct selector APIs (below). |
| docs-rst/key_concepts_builder/b13, /b14, docs-rst/build_sketch/b03 (were MISMATCH, 100% volume / 10-20 mm bbox) | Lite applied an ENCLOSING `Locations`/`GridLocations` context to objects created inside a nested builder, so `with GridLocations(...): with BuildSketch(): Rectangle(...)` built four rectangles. | build123d 0.11.1's `Builder.__enter__` installs a FRESH location context (`local_locations = LocationList([Location()])`), so a builder always constructs locally and an enclosing Locations context has no effect on its result — confirmed natively (`model._obj` 141.372 = one cylinder, `pp._obj` 125.0 = one box; 0.11.1 has no `part_local`, and even `holes.sketch` is local). Lite now truncates the location stack at the active builder's own depth. | Lite bug, fixed. (Note the docs prose in the newer clone describes publication-time placement, which 0.11.1 does not implement — the pinned reference is the contract here.) |
| examples/maker_coin (regression caught this round, now PASS again) | `fillet(maker_coin.edges(Select.NEW), 2)` — the new `new_edges` returned raw cut geometry with no per-shape index, and those Brython objects reached `CacheOp`'s `JSON.stringify` ("Converting circular structure to JSON"). | `new_edges` now maps each cut edge back to the corresponding edge OF `combined` (midpoint+length), so the result is filletable exactly as upstream's is; `_edges_by_parent` raises a readable error instead of leaking objects into the hash. COMPROMISE(new-edges-partial): an edge that is only PARTLY new has no counterpart and comes back as bare geometry. | Lite bug, fixed. |
| docs/objects_1d (MISMATCH, `scene` bbox 0.10 mm) | `scene = Compound(...) + Compound.make_triad(2)`. | The triad's axes and spline arrow heads are built exactly; upstream also draws 'X'/'Y'/'Z' with the **`singleline` STROKE font**, which this build does not ship (only the outline font FreeSans). | COMPROMISE(triad-labels). The triad is a viewer symbol; the deviation is confined to scripts that measure it. (`l1`/`l3`/`l4` also differ because the file reuses those names across nine examples and the harness compares the last binding.) |
| docs/objects_1d_airfoil, _blend_curve, _bspline, _constrained, _ellipticalstartarc, _parabolic_hyperbolic, docs-rst/tutorial_constraints/b03, /b05, /b10, /b13 (ERROR x10) | Missing 1-D CONSTRAINED/analytic objects: `Airfoil`, `BlendCurve`, `BSpline`, `ConstrainedArcs`/`ConstrainedLines`, `EllipticalStartArc`, `ParabolicCenterArc`/`HyperbolicCenterArc`, `Triangle`. | Each is a solver or a curve type in its own right (Bézier continuity solvers, tangency-branch selection, conic constructors, a triangle solver) rather than a defaults difference. | Deliberate gap this round — the honest next slice of work, and the largest remaining ERROR bucket. |
| docs-selectors/filter_nested, /filter_shape_properties, /filter_all_edges_circle, /group_axis, /group_hole_area, /sort_along_wire, /sort_sortby, /group_properties_with_keys (ERROR x8) | Selector surface the topology-selection docs exercise: `Face.wires`, `Face.is_circular_convex`, `Edge.center_location`, iterating a Builder, edges pooled from DIFFERENT parents, `sort_by(<wire>)` (distance along a wire), `Vertex.distance`, `Face.normal`. | `filter_by`/`sort_by`/`group_by` now accept a class **property** object and a `Plane` (which closed filter_axisplane and filter_geomtype); the rest are individually missing attributes, not defaults. | Deliberate gap: each needs its own upstream-faithful property. |
| docs/tutorial_joints, docs-selectors/filter_inner_wire_count (ERROR) | `import_step(...)`. tutorial_joints got much further this round (`Axis(Location)` for hole-derived joint axes, `Compound(builder.part.wrapped, joints=...)`) and now stops exactly at its M6 screw import. | There is no filesystem in the worker; STEP import would need the asset uploaded into MEMFS, which the harness does not serve. | Deliberate gap (import support is a separate feature, not a defaults difference). |
| docs/spitfire_wing_gordon (`pytest`), ttt/ttt-23-t-24-curved_support (`sympy`) (ERROR x2) | Third-party Python packages: `pytest.approx` in an assert, and `sympy`'s symbolic solver used to derive the part's dimensions. | n/a | Deliberate gap: shimming a symbolic algebra system is out of scope, and faking `pytest.approx` would only paper over an assert. |
| docs/objects_3d (`Wedge`), docs/objects_2d (`Draft`), ttt/ttt-24-SPO-06-Buffer_Stand (`full_round`), docs-rst/topology_selection/b12 (`topo_distance_to`), docs-rst/objects-text/b10 (text along a path) (ERROR x5) | Individually missing objects/operations. `Sphere(1, 0)` (partial spheres) was the previous blocker on objects_3d and is now implemented via `BRepPrimAPI_MakeSphere`'s angle form. | n/a | Deliberate gap. |
| docs-rst/tips/b01 (ERROR) | `ChamferEdges` raises an internal OCCT error on the tip's overlapping-chamfer input. | Lite's chamfer is `BRepFilletAPI_MakeChamfer` + `Add`, matching upstream. | Same defaults, kernel behaviour on this input — same family as the two fillet faults. |
| ttt/ttt-ppp0110 (ERROR) | The KNOWN 8.0.1 coplanar-BSpline fuse fault, in the one shape where the General-Fuse rebuild cannot recover the dropped operand (result volume 0). | Upstream fuse defaults reproduce the drop on this kernel; see the ex34 row. | Genuine kernel fault, detected and raised (COMPROMISE(kernel-guard) cannot recover this one). |
| ttt/ttt-23-02-02-sm_hanger (ERROR) | A `fillet(...)` selection comes back EMPTY ("no edges given"), i.e. an upstream selector chain that lite resolves to nothing. Reached only after `LengthMode` was implemented. | Not a defaults difference — a selector-result difference that still needs isolating. | Open, un-triaged: the honest state is "further than before, root cause not yet identified". |
| ttt/ttt-ppp0107 (MISMATCH, -1.0% / -0.9% volume on `zz`/`zz2`) | Two intermediate `extrude(until=)` results are slightly small. | Both sides use `Until.NEXT`/`LAST` against the same target; the final part is not measured by the script. | Open, small-magnitude geometry difference. |
| docs/heart_token (MISMATCH, bbox 2.0 mm), docs-selectors/sort_axis (-14.7% volume), docs-selectors/selectors_operators (bbox 6.0 mm), docs-rst/tips/b04 (bbox 0.2 mm) | New this round, each reached by implementing `Shell.extrude` / `FilletPolyline` / the property selectors. | n/a yet | Open: runs, geometry differs. Recorded rather than hidden — these are the next MISMATCHes to chase. |
