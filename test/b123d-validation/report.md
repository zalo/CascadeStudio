# build123d-lite validation report

Generated 2026-08-13T05:58:58.741Z - 129 scripts (126 scored, 3 excluded because real build123d fails natively).

| Status | Count |
|---|---|
| PASS | 110 |
| MISMATCH | 4 |
| ERROR | 12 |
| TIMEOUT | 0 |
| SKIP | 3 |

## Feature-gap frequency (ERROR bucket)

| Gap | Scripts |
|---|---|
| `RuntimeError: KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an operand (result volume 1341.` | 2 |
| `AttributeError: extrude` | 1 |
| `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds` | 1 |
| `AttributeError: revolve` | 1 |
| `NotImplemented: one-sided line offsets (side=) are not supported in build123d-lite` | 1 |
| `other: Line 5038: Uncaught Error: Python AssertionError` | 1 |
| `NotImplemented: scipy.spatial.ConvexHull is not available in build123d-lite (only optimize.minimize / optimize.minimize_scalar are shimmed)` | 1 |
| `AttributeError: make_sphere` | 1 |
| `AttributeError: thicken` | 1 |
| `AttributeError: find_intersection_points` | 1 |
| `other: Line 5038: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in FilletEdges: the OC` | 1 |

## Mismatches (runs, but geometry differs)

- **examples/canadian_flag**
  - 'canadian_flag' bbox[5] 6.2477 vs 6.2440 (d=0.0037)
  - 'center_field' bbox[2] 0.4789 vs 0.4804 (d=0.0015)
  - 'east_field' bbox[5] 5.9334 vs 5.9394 (d=0.0060)
  - 'maple_leaf' bbox[2] 1.4687 vs 1.4674 (d=0.0014)
  - 'the_wind' bbox[2] -6.0675 vs -6.0738 (d=0.0063)
  - 'west_field' bbox[2] -0.1371 vs -0.1394 (d=0.0023)
- **examples/canadian_flag_algebra**
  - 'canadian_flag' bbox[5] 6.2477 vs 6.2440 (d=0.0037)
  - 'center_field' bbox[2] 0.4789 vs 0.4804 (d=0.0015)
  - 'east_field' bbox[5] 5.9334 vs 5.9394 (d=0.0060)
  - 'maple_leaf' bbox[2] 1.4687 vs 1.4674 (d=0.0014)
  - 'the_wind' bbox[2] -6.0675 vs -6.0738 (d=0.0063)
  - 'west_field' bbox[2] -0.1371 vs -0.1394 (d=0.0023)
- **examples/joints**
  - 'pin_arm' bbox[0] -0.0729 vs 8.0835 (d=8.1564)
  - 'screw_arm' bbox[0] 2.6849 vs 3.6800 (d=0.9951)
  - 'slider_arm' bbox[0] 8.0158 vs -3.7834 (d=11.7992)
- **examples/joints_algebra**
  - 'pin_arm' bbox[0] -0.0729 vs 8.0835 (d=8.1564)
  - 'screw_arm' bbox[0] 2.6849 vs 3.6800 (d=0.9951)
  - 'slider_arm' bbox[0] 8.0158 vs -3.7834 (d=11.7992)

## Passing scripts

- examples/boxes_on_faces (1 shapes)
- examples/boxes_on_faces_algebra (2 shapes)
- examples/build123d_customizable_logo_algebra (13 shapes)
- examples/build123d_logo (13 shapes)
- examples/build123d_customizable_logo (14 shapes)
- examples/build123d_logo_algebra (12 shapes)
- examples/circuit_board (1 shapes)
- examples/circuit_board_algebra (1 shapes)
- examples/clock_algebra (6 shapes)
- examples/custom_sketch_objects (9 shapes)
- examples/clock (5 shapes)
- examples/custom_sketch_objects_algebra (9 shapes)
- examples/din_rail (3 shapes)
- examples/din_rail_algebra (41 shapes)
- examples/extrude (10 shapes)
- examples/extrude_algebra (35 shapes)
- examples/handle_algebra (4 shapes)
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
- examples/loft_algebra (3 shapes)
- examples/mixed_algebra_context (9 shapes)
- examples/multiple_workplanes (1 shapes)
- examples/multiple_workplanes_algebra (1 shapes)
- examples/packed_boxes (100 shapes)
- examples/pegboard_j_hook (10 shapes)
- examples/pegboard_j_hook_algebra (11 shapes)
- examples/pillow_block (2 shapes)
- examples/pillow_block_algebra (2 shapes)
- examples/heat_exchanger (3 shapes)
- examples/roller_coaster (4 shapes)
- examples/roller_coaster_algebra (4 shapes)
- examples/shamrock (1 shapes)
- examples/stud_wall (2 shapes)
- examples/maker_coin (8 shapes)
- examples/playing_cards (14 shapes)
- examples/twist_extrude (2 shapes)
- examples/vase (8 shapes)
- general_examples/ex01 (1 shapes)
- general_examples/ex02 (1 shapes)
- general_examples/ex03 (2 shapes)
- general_examples/ex08 (3 shapes)
- general_examples/ex09 (1 shapes)
- examples/vase_algebra (8 shapes)
- general_examples/ex10 (1 shapes)
- general_examples/ex12 (7 shapes)
- examples/heat_exchanger_algebra (4 shapes)
- general_examples/ex14 (6 shapes)
- general_examples/ex11 (2 shapes)
- general_examples/ex15 (8 shapes)
- general_examples/ex13 (1 shapes)
- general_examples/ex17 (2 shapes)
- general_examples/ex18 (1 shapes)
- general_examples/ex19 (6 shapes)
- general_examples/ex20 (1 shapes)
- general_examples/ex16 (3 shapes)
- general_examples/ex22 (2 shapes)
- general_examples/ex23 (5 shapes)
- general_examples/ex26 (2 shapes)
- general_examples/ex25 (4 shapes)
- general_examples/ex24 (3 shapes)
- general_examples/ex27 (2 shapes)
- general_examples/ex21 (2 shapes)
- general_examples/ex30 (5 shapes)
- general_examples/ex32 (3 shapes)
- general_examples/ex29 (7 shapes)
- general_examples/ex28 (7 shapes)
- general_examples/ex31 (2 shapes)
- general_examples/ex33 (3 shapes)
- general_examples/ex35 (5 shapes)
- general_examples_algebra/ex01 (1 shapes)
- general_examples/ex37 (2 shapes)
- general_examples_algebra/ex02 (1 shapes)
- general_examples_algebra/ex03 (2 shapes)
- general_examples_algebra/ex08 (3 shapes)
- general_examples_algebra/ex09 (1 shapes)
- general_examples_algebra/ex12 (6 shapes)
- general_examples/ex36 (3 shapes)
- general_examples_algebra/ex14 (6 shapes)
- general_examples_algebra/ex15 (8 shapes)
- general_examples_algebra/ex17 (2 shapes)
- general_examples_algebra/ex13 (1 shapes)
- general_examples_algebra/ex11 (2 shapes)
- general_examples_algebra/ex20 (2 shapes)
- general_examples_algebra/ex18 (2 shapes)
- general_examples_algebra/ex19 (6 shapes)
- general_examples_algebra/ex21 (1 shapes)
- general_examples_algebra/ex16 (10 shapes)
- general_examples_algebra/ex22 (2 shapes)
- general_examples_algebra/ex23 (4 shapes)
- general_examples_algebra/ex25 (5 shapes)
- general_examples_algebra/ex24 (2 shapes)
- general_examples_algebra/ex26 (2 shapes)
- general_examples_algebra/ex27 (2 shapes)
- general_examples_algebra/ex30 (3 shapes)
- general_examples_algebra/ex32 (2 shapes)
- general_examples_algebra/ex33 (1 shapes)
- general_examples_algebra/ex31 (1 shapes)
- general_examples_algebra/ex29 (8 shapes)
- general_examples_algebra/ex28 (3 shapes)
- general_examples_algebra/ex35 (4 shapes)
- general_examples_algebra/ex36 (3 shapes)

## Errors by script

- examples/bracelet: `AttributeError: extrude`
- examples/cast_bearing_unit: `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds`
- examples/bicycle_tire: `AttributeError: revolve`
- examples/dual_color_3mf: `NotImplemented: one-sided line offsets (side=) are not supported in build123d-lite`
- examples/handle: `other: Line 5038: Uncaught Error: Python AssertionError`
- examples/platonic_solids: `NotImplemented: scipy.spatial.ConvexHull is not available in build123d-lite (only optimize.minimize / optimize.minimize_scalar are shimmed)`
- examples/projection: `AttributeError: make_sphere`
- examples/projection_algebra: `AttributeError: thicken`
- examples/tea_cup_algebra: `AttributeError: find_intersection_points`
- examples/toy_truck: `other: Line 5038: Uncaught Error: Python JavascriptError: INTERNAL OPENCASCADE ERROR in FilletEdges: the OC`
- general_examples/ex34: `RuntimeError: KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an operand (result volume 1341.`
- general_examples_algebra/ex34: `RuntimeError: KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an operand (result volume 1341.`

## Timeouts


## Excluded (reference failed natively)

- examples/python_logo: reference no-shapes
- examples/tea_cup: reference error
- general_examples_algebra/ex10: reference error
