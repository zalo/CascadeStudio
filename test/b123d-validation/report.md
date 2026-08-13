# build123d-lite validation report

Generated 2026-08-13T16:21:11.722Z - 129 scripts (126 scored, 3 excluded because real build123d fails natively).

| Status | Count |
|---|---|
| PASS | 119 |
| MISMATCH | 4 |
| ERROR | 3 |
| TIMEOUT | 0 |
| SKIP | 3 |

## Feature-gap frequency (ERROR bucket)

| Gap | Scripts |
|---|---|
| `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds` | 1 |
| `NotImplemented: build123d-lite Mesher writes STL only (no lib3mf in the WASM build); got dual_color.3mf` | 1 |
| `other: Line 5985: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in FilletEdges: the OC` | 1 |

## Mismatches (runs, but geometry differs)

- **examples/joints**
  - 'pin_arm' bbox[0] -0.0729 vs 8.0835 (d=8.1564)
  - 'screw_arm' bbox[0] 1.0688 vs 3.6800 (d=2.6113)
  - 'slider_arm' bbox[0] 8.0158 vs -3.7834 (d=11.7992)
- **examples/joints_algebra**
  - 'pin_arm' bbox[0] -0.0729 vs 8.0835 (d=8.1564)
  - 'screw_arm' bbox[0] 1.0688 vs 3.6800 (d=2.6113)
  - 'slider_arm' bbox[0] 8.0158 vs -3.7834 (d=11.7992)
- **examples/projection**
  - 'projected_text' bbox[0] -49.7713 vs -49.6470 (d=0.1243)
- **examples/projection_algebra**
  - 'projected_text' bbox[0] -49.7713 vs -49.6470 (d=0.1243)

## Passing scripts

- examples/boxes_on_faces (1 shapes)
- examples/boxes_on_faces_algebra (2 shapes)
- examples/build123d_customizable_logo_algebra (13 shapes)
- examples/build123d_customizable_logo (14 shapes)
- examples/build123d_logo (13 shapes)
- examples/build123d_logo_algebra (12 shapes)
- examples/canadian_flag (20 shapes)
- examples/canadian_flag_algebra (25 shapes)
- examples/circuit_board (1 shapes)
- examples/circuit_board_algebra (1 shapes)
- examples/clock_algebra (6 shapes)
- examples/clock (5 shapes)
- examples/custom_sketch_objects (9 shapes)
- examples/custom_sketch_objects_algebra (9 shapes)
- examples/din_rail (3 shapes)
- examples/din_rail_algebra (41 shapes)
- examples/extrude (10 shapes)
- examples/extrude_algebra (35 shapes)
- examples/handle (10 shapes)
- examples/handle_algebra (4 shapes)
- examples/bicycle_tire (102 shapes)
- examples/fast_grid_holes (4 shapes)
- examples/holes (4 shapes)
- examples/holes_algebra (4 shapes)
- examples/intersecting_chamfers (1 shapes)
- examples/intersecting_chamfers_algebra (2 shapes)
- examples/intersecting_pipes (3 shapes)
- examples/key_cap (5 shapes)
- examples/key_cap_algebra (5 shapes)
- examples/lego (3 shapes)
- examples/lego_algebra (3 shapes)
- examples/loft (4 shapes)
- examples/bracelet (16 shapes)
- examples/loft_algebra (3 shapes)
- examples/mixed_algebra_context (9 shapes)
- examples/multiple_workplanes (1 shapes)
- examples/multiple_workplanes_algebra (1 shapes)
- examples/heat_exchanger (3 shapes)
- examples/packed_boxes (100 shapes)
- examples/pegboard_j_hook (10 shapes)
- examples/pegboard_j_hook_algebra (11 shapes)
- examples/pillow_block (2 shapes)
- examples/pillow_block_algebra (2 shapes)
- examples/platonic_solids (5 shapes)
- examples/heat_exchanger_algebra (4 shapes)
- examples/playing_cards (14 shapes)
- examples/roller_coaster (4 shapes)
- examples/roller_coaster_algebra (4 shapes)
- examples/shamrock (1 shapes)
- examples/maker_coin (8 shapes)
- examples/stud_wall (2 shapes)
- examples/twist_extrude (2 shapes)
- examples/vase (8 shapes)
- examples/vase_algebra (8 shapes)
- examples/tea_cup_algebra (5 shapes)
- general_examples/ex01 (1 shapes)
- general_examples/ex02 (1 shapes)
- general_examples/ex03 (2 shapes)
- general_examples/ex08 (3 shapes)
- general_examples/ex09 (1 shapes)
- general_examples/ex10 (1 shapes)
- general_examples/ex12 (7 shapes)
- general_examples/ex11 (2 shapes)
- general_examples/ex14 (6 shapes)
- general_examples/ex13 (1 shapes)
- general_examples/ex15 (8 shapes)
- general_examples/ex17 (2 shapes)
- general_examples/ex18 (1 shapes)
- general_examples/ex19 (6 shapes)
- general_examples/ex16 (3 shapes)
- general_examples/ex20 (1 shapes)
- general_examples/ex21 (2 shapes)
- general_examples/ex22 (2 shapes)
- general_examples/ex23 (5 shapes)
- general_examples/ex25 (4 shapes)
- general_examples/ex26 (2 shapes)
- general_examples/ex24 (3 shapes)
- general_examples/ex27 (2 shapes)
- general_examples/ex29 (7 shapes)
- general_examples/ex28 (7 shapes)
- general_examples/ex30 (5 shapes)
- general_examples/ex32 (3 shapes)
- general_examples/ex31 (2 shapes)
- general_examples/ex33 (3 shapes)
- general_examples/ex35 (5 shapes)
- general_examples/ex36 (3 shapes)
- general_examples/ex34 (4 shapes)
- general_examples_algebra/ex01 (1 shapes)
- general_examples/ex37 (2 shapes)
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
- general_examples_algebra/ex20 (2 shapes)
- general_examples_algebra/ex19 (6 shapes)
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
- general_examples_algebra/ex34 (3 shapes)
- general_examples_algebra/ex36 (3 shapes)

## Errors by script

- examples/cast_bearing_unit: `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds`
- examples/dual_color_3mf: `NotImplemented: build123d-lite Mesher writes STL only (no lib3mf in the WASM build); got dual_color.3mf`
- examples/toy_truck: `other: Line 5985: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in FilletEdges: the OC`

## Timeouts


## Excluded (reference failed natively)

- examples/python_logo: reference no-shapes
- examples/tea_cup: reference error
- general_examples_algebra/ex10: reference error

# Defaults audit (every remaining non-PASS, root-caused)

Hand-maintained (`defaults-audit.md`, appended to this report by run-lite.mjs).
For each remaining non-PASS script: the root cause, the upstream (build123d
0.11.1 / OCP 7.x) defaults compared against build123d-lite's (OCCT 8.0.1
wasm), and an honest verdict. Closed-this-round rows are kept where the
investigation itself is the record.

| Script(s) | Root cause | Upstream defaults vs lite | Verdict |
|---|---|---|---|
| examples/joints, examples/joints_algebra (MISMATCH) | Slider/pin positions are measured along `Axis(edge)` of slot edges selected after booleans; the parts land at the other end of the (geometrically correct) slot. | Both sides map `position_at(u)` orientation-aware (`u -> 1-u` when the edge is not FORWARD): upstream `Mixin1D._occt_param_at`, lite `Edge.position_at`. Verified the underlying curves agree; only the sub-edge TopAbs orientation flag differs (OCP 7.x vs 8.0.1 wasm construction history). | Same defaults, kernel construction-history difference — COMPROMISE(edge-orientation). |
| examples/projection, examples/projection_algebra (MISMATCH, `projected_text` only, d=0.12) | The text wraps the *opposite way* around the sphere: the arch path (closed sphere-cylinder intersection edge) is TopAbs_REVERSED in OCP 7.x but FORWARD in 8.0.1 wasm over the SAME geometric parametrization (verified: raw curve at 25% is +Y on both; upstream's flag flips traversal to -Y first, lite's does not). | Everything else now byte-matches: `make_text` align default fixed to `None` (was bbox-CENTER; closed a 1.02 mm shift on `flat_planar_text_faces`), `position_at` switched to arc-length fraction via GCPnts_AbscissaPoint (upstream `_occt_param_at` does exactly this even in PARAMETER mode), and per-glyph text faces now split disjoint outer contours (i/j dots) into separate faces (40 faces == upstream). | Same defaults, kernel edge-orientation history on a closed intersection curve — COMPROMISE(edge-orientation). Not honestly closable. |
| general_examples/ex34, general_examples_algebra/ex34 (now PASS) | `BRepAlgoAPI_Fuse` silently DROPS an operand when coplanar faces meet along BSpline edges (glyph solids fused onto a box face); result was the bare box. | Upstream fuse defaults — no fuzzy value (`tol=None`), glue off, NonDestructive unset — reproduce the drop identically on this kernel; it is the fuse *result-assembly* phase that is broken, the General-Fuse *split* phase is correct on the same inputs. Lite's `Union` detects the drop (result volume < largest input) and rebuilds from the `BOPAlgo_Builder` partition; see COMPROMISE(kernel-guard). Lite also always passes fuzz 1e-7 (upstream 0) and runs ShapeUpgrade_UnifySameDomain (upstream's `clean=True`). | Genuine kernel fault (8.0.1 wasm), worked around via the exact GF partition. Fixed this round together with the Text normal flip (extrusions follow the face's oriented normal). |
| examples/build123d_logo_algebra, examples/build123d_customizable_logo_algebra (now PASS) | Regression from the per-glyph text compound: glyph faces inside a mirrored COMPOUND already get their orientation flags flipped by BRepTools_TrsfModification, so Text2D's unconditional `.Reversed()` double-flipped them to -Z and algebra `extrude()` (which follows the face's oriented normal) went below z=0. | Upstream text faces have +Z oriented normals; lite now reverses each glyph face CONDITIONALLY on its measured oriented normal. Builder-mode scripts were unaffected because BuildSketch extrudes along the workplane z_dir, not the face normal. | Lite bug (double reversal), fixed. |
| examples/bracelet (ERROR) | Needs `Face.make_gordon_surface` — upstream delegates to the external `ocp_gordon` package (a Python port of TiGL's curve-network Gordon interpolator, not an OCCT API) — plus `Face.location_at` surface frames and 2D `moved()` class preservation. | No comparable defaults: the Gordon interpolator does not exist in OCCT at all (upstream imports it from a separate PyPI package). | Can't adopt — would mean porting the whole ocp_gordon interpolator; honest feature gap. |
| examples/cast_bearing_unit (ERROR) | `FilletEdges` on the hull/draft solid corrupts the wasm heap ("memory access out of bounds"); after a raw abort the OCCT heap is unusable. | Upstream `Solid.fillet` = `BRepFilletAPI_MakeFillet(shape)` (default ChFi3d_Rational) + `Add(radius, edge)`. Lite is identical (explicit ChFi3d_Rational, same Add). No tolerance/continuity knobs differ. | Same defaults, genuine kernel fault in the 8.0.1 wasm fillet on this input. |
| examples/toy_truck (ERROR) | Same fillet path; this input now raises "INTERNAL OPENCASCADE ERROR in FilletEdges" (caught, no heap corruption). | Identical fillet defaults as above. | Same defaults, genuine kernel fault. |
| examples/bicycle_tire (ERROR) | `Shape.wrap_faces` (place planar faces onto a curved surface along a path, geodesic-ish layout) is unimplemented. | Upstream is a large 0.11 feature built on surface UV mapping/projection; no lite counterpart to compare defaults against. | Unimplemented — honest feature gap (raises AttributeError: wrap_faces). |
| examples/dual_color_3mf (ERROR) | `offset_2d(..., side=Side.LEFT/RIGHT)` — one-sided offsets of OPEN lines. Lite's line offset only supports the symmetric `Side.BOTH` construction and raises NotImplemented. | Upstream: `BRepOffsetAPI_MakeOffset` open-mode with side selection + end closing; lite has not ported the open one-sided branch. | Unimplemented (deliberate NotImplemented with message); not a defaults issue. |
| SKIP x3 (python_logo, tea_cup builder, general_examples_algebra/ex10) | Real build123d 0.11.1 fails natively on these (no shapes / exceptions). | n/a | Excluded from scoring by the harness. |
