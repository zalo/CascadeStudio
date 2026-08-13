# build123d-lite validation report

Generated 2026-08-13T03:58:34.623Z - 129 scripts (126 scored, 3 excluded because real build123d fails natively).

| Status | Count |
|---|---|
| PASS | 85 |
| MISMATCH | 15 |
| ERROR | 26 |
| TIMEOUT | 0 |
| SKIP | 3 |

## Feature-gap frequency (ERROR bucket)

| Gap | Scripts |
|---|---|
| `other: Line 3749: Uncaught Error: Python JavascriptError: Cannot create property '__traceback__' on number ` | 2 |
| `AttributeError: make_surface_from_array_of_points` | 2 |
| `NotImplemented: multisection sweep is not supported in build123d-lite` | 2 |
| `NotImplemented: section is not supported in build123d-lite` | 2 |
| `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds` | 2 |
| `AttributeError: face` | 1 |
| `AttributeError: extrude` | 1 |
| `NotImplemented: make_hull is not supported in build123d-lite` | 1 |
| `NotImplemented: one-sided line offsets (side=) are not supported in build123d-lite` | 1 |
| `other: Line 3749: Uncaught Error: Python JavascriptError: Cannot pass \"[object Object]\" as a TopoDS_Shape` | 1 |
| `TypeError: 'NullType' object is not iterable` | 1 |
| `AttributeError: x_axis` | 1 |
| `NameError: DoubleTangentArc` | 1 |
| `AttributeError: wires` | 1 |
| `other: Line 3749: Uncaught Error: Python JavascriptError: e.ShapeType is not a function` | 1 |
| `ImportError: undefined` | 1 |
| `AttributeError: make_sphere` | 1 |
| `AttributeError: project_to_shape` | 1 |
| `NotImplemented: RigidJoint is not supported in build123d-lite` | 1 |
| `AttributeError: extrude_linear_with_rotation` | 1 |
| `NotImplemented: cannot reconstruct a BSplineCurve edge as a segment in build123d-lite` | 1 |

## Mismatches (runs, but geometry differs)

- **examples/build123d_logo_algebra**
  - 'build' bbox[0] 4.1360 vs 4.4010 (d=0.2650)
  - 'build_text' bbox[0] -10.3250 vs -4.8500 (d=5.4750)
  - 'cmpd' volume 84.952 vs 64.391 (31.93%)
  - 'cmpd' bbox[1] -6.3920 vs -4.5120 (d=1.8800)
  - 'extension_lines' bbox[3] 28.9220 vs 18.5020 (d=10.4200)
  - 'l2' bbox[0] 28.9220 vs 18.5020 (d=10.4200)
  - 'three_d' volume 112.620 vs 64.391 (74.90%)
  - 'three_d' bbox[3] 28.9220 vs 18.5020 (d=10.4200)
- **examples/build123d_customizable_logo_algebra**
  - 'build' bbox[0] 4.1360 vs 0.3118 (d=3.8242)
  - 'build_text' bbox[0] -10.3250 vs -4.8500 (d=5.4750)
  - 'cmpd' volume 78.351 vs 64.391 (21.68%)
  - 'cmpd' bbox[1] -9.6720 vs -7.0024 (d=2.6696)
  - 'cust_text' bbox[0] -10.3250 vs -8.9393 (d=1.3857)
  - 'extension_lines' bbox[3] 28.9220 vs 18.5020 (d=10.4200)
  - 'l2' bbox[0] 28.9220 vs 18.5020 (d=10.4200)
  - 'three_d' volume 112.620 vs 64.391 (74.90%)
- **examples/custom_sketch_objects**
  - 'lid' volume 30067.985 vs 13597.408 (121.13%)
  - 'lid_builder' volume 30067.985 vs 13597.408 (121.13%)
  - 'suits' bbox[3] 49.9830 vs 27.8583 (d=22.1247)
- **examples/custom_sketch_objects_algebra**
  - 'lid' volume 10748.835 vs 13597.408 (-20.95%)
- **examples/extrude**
  - 'multiple' volume 1393.577 vs 1037.829 (34.28%)
  - 'multiple' bbox[0] -9.1600 vs -6.0000 (d=3.1600)
- **examples/extrude_algebra**
  - 'faces[0]' bbox[0] -9.1600 vs -5.0000 (d=4.1600)
  - 'faces[10]' bbox[0] -3.2355 vs -3.2500 (d=0.0145)
  - 'faces[11]' bbox[0] -3.2355 vs -3.2500 (d=0.0145)
  - 'faces[12]' bbox[0] -3.4800 vs 1.0510 (d=4.5310)
  - 'faces[13]' bbox[0] -3.4800 vs 1.0510 (d=4.5310)
  - 'faces[14]' bbox[0] 5.0000 vs 1.4845 (d=3.5155)
  - 'faces[15]' bbox[0] 5.0000 vs 1.4845 (d=3.5155)
  - 'faces[16]' bbox[0] 5.0000 vs 1.4845 (d=3.5155)
- **examples/roller_coaster**
  - 'roller_coaster' bbox[0] -103.0801 vs -109.5901 (d=6.5100)
- **examples/roller_coaster_algebra**
  - 'roller_coaster' bbox[0] -103.0801 vs -109.5901 (d=6.5100)
- **examples/shamrock**
  - 'shamrock_example' bbox[0] -16.2987 vs -4.2501 (d=12.0486)
- **examples/vase**
  - 'l3' bbox[3] 22.1319 vs 22.0984 (d=0.0335)
  - 'l5' bbox[3] 22.5103 vs 22.6327 (d=0.1224)
  - 'outline' bbox[3] 22.5103 vs 22.6327 (d=0.1224)
  - 'profile' bbox[3] 22.5103 vs 22.6327 (d=0.1224)
  - 'vase' volume 7500.524 vs 7560.708 (-0.80%)
  - 'vase' bbox[0] -22.5103 vs -22.6327 (d=0.1224)
- **examples/playing_cards**
  - 'ace_spades' bbox[3] 2.1046 vs 63.5000 (d=61.3954)
  - 'box' volume 37202.997 vs 41557.900 (-10.48%)
  - 'hand' bbox[0] -14.7665 vs -29.2130 (d=14.4465)
  - 'lid_builder' volume 12390.537 vs 16237.304 (-23.69%)
  - 'ten_spades' bbox[3] 2.1046 vs 63.5000 (d=61.3954)
- **general_examples/ex12**
  - 'ex12' bbox[4] 35.0992 vs 35.0829 (d=0.0163)
  - 'ex12_ln' bbox[4] 35.0992 vs 35.0829 (d=0.0163)
  - 'ex12_sk' bbox[4] 35.0992 vs 35.0829 (d=0.0163)
  - 'l1' bbox[1] 18.0564 vs 18.6037 (d=0.5473)
- **general_examples/ex34**
  - 'ex34' volume 1341.006 vs 47753.510 (-97.19%)
  - 'ex34' bbox[0] -25.9125 vs -40.0000 (d=14.0875)
  - 'ex34_sk2' bbox[0] -25.9125 vs -30.7625 (d=4.8500)
- **general_examples_algebra/ex12**
  - 'ex12' bbox[4] 35.0992 vs 35.0829 (d=0.0163)
  - 'l1' bbox[1] 18.0564 vs 18.6037 (d=0.5473)
  - 'sk12' bbox[4] 35.0992 vs 35.0829 (d=0.0163)
- **general_examples_algebra/ex34**
  - 'ex34' volume 1341.006 vs 47754.583 (-97.19%)
  - 'ex34' bbox[0] -25.9125 vs -40.0000 (d=14.0875)
  - 'ex34_sk2' bbox[0] -25.9125 vs -30.7625 (d=4.8500)

## Passing scripts

- examples/boxes_on_faces (1 shapes)
- examples/boxes_on_faces_algebra (2 shapes)
- examples/circuit_board_algebra (1 shapes)
- examples/circuit_board (1 shapes)
- examples/clock_algebra (6 shapes)
- examples/clock (5 shapes)
- examples/din_rail (3 shapes)
- examples/din_rail_algebra (41 shapes)
- examples/holes (4 shapes)
- examples/holes_algebra (4 shapes)
- examples/intersecting_chamfers (1 shapes)
- examples/intersecting_chamfers_algebra (2 shapes)
- examples/intersecting_pipes (3 shapes)
- examples/lego (3 shapes)
- examples/lego_algebra (3 shapes)
- examples/loft (4 shapes)
- examples/loft_algebra (3 shapes)
- examples/mixed_algebra_context (9 shapes)
- examples/multiple_workplanes (1 shapes)
- examples/multiple_workplanes_algebra (1 shapes)
- examples/pillow_block (2 shapes)
- examples/pillow_block_algebra (2 shapes)
- examples/packed_boxes (100 shapes)
- general_examples/ex01 (1 shapes)
- general_examples/ex02 (1 shapes)
- general_examples/ex03 (2 shapes)
- general_examples/ex08 (3 shapes)
- general_examples/ex09 (1 shapes)
- general_examples/ex10 (1 shapes)
- general_examples/ex11 (2 shapes)
- general_examples/ex14 (6 shapes)
- general_examples/ex15 (8 shapes)
- general_examples/ex13 (1 shapes)
- general_examples/ex17 (2 shapes)
- general_examples/ex18 (1 shapes)
- general_examples/ex16 (3 shapes)
- general_examples/ex19 (6 shapes)
- general_examples/ex20 (1 shapes)
- general_examples/ex21 (2 shapes)
- general_examples/ex22 (2 shapes)
- general_examples/ex23 (5 shapes)
- general_examples/ex25 (4 shapes)
- general_examples/ex24 (3 shapes)
- general_examples/ex26 (2 shapes)
- general_examples/ex27 (2 shapes)
- general_examples/ex28 (7 shapes)
- general_examples/ex29 (7 shapes)
- general_examples/ex30 (5 shapes)
- general_examples/ex32 (3 shapes)
- general_examples/ex31 (2 shapes)
- general_examples/ex33 (3 shapes)
- general_examples/ex35 (5 shapes)
- general_examples/ex37 (2 shapes)
- general_examples_algebra/ex01 (1 shapes)
- general_examples_algebra/ex02 (1 shapes)
- general_examples/ex36 (3 shapes)
- general_examples_algebra/ex03 (2 shapes)
- general_examples_algebra/ex08 (3 shapes)
- general_examples_algebra/ex09 (1 shapes)
- general_examples_algebra/ex11 (2 shapes)
- general_examples_algebra/ex14 (6 shapes)
- general_examples_algebra/ex15 (8 shapes)
- general_examples_algebra/ex13 (1 shapes)
- general_examples_algebra/ex17 (2 shapes)
- general_examples_algebra/ex16 (10 shapes)
- general_examples_algebra/ex18 (2 shapes)
- general_examples_algebra/ex20 (2 shapes)
- general_examples_algebra/ex19 (6 shapes)
- general_examples_algebra/ex21 (1 shapes)
- general_examples_algebra/ex22 (2 shapes)
- general_examples_algebra/ex23 (4 shapes)
- general_examples_algebra/ex24 (2 shapes)
- general_examples_algebra/ex25 (5 shapes)
- general_examples_algebra/ex26 (2 shapes)
- general_examples_algebra/ex27 (2 shapes)
- examples/heat_exchanger (3 shapes)
- general_examples_algebra/ex30 (3 shapes)
- general_examples_algebra/ex28 (3 shapes)
- general_examples_algebra/ex29 (8 shapes)
- general_examples_algebra/ex31 (1 shapes)
- general_examples_algebra/ex32 (2 shapes)
- general_examples_algebra/ex33 (1 shapes)
- general_examples_algebra/ex35 (4 shapes)
- general_examples_algebra/ex36 (3 shapes)
- examples/heat_exchanger_algebra (4 shapes)

## Errors by script

- examples/bicycle_tire: `AttributeError: face`
- examples/bracelet: `AttributeError: extrude`
- examples/build123d_customizable_logo: `other: Line 3749: Uncaught Error: Python JavascriptError: Cannot create property '__traceback__' on number `
- examples/build123d_logo: `other: Line 3749: Uncaught Error: Python JavascriptError: Cannot create property '__traceback__' on number `
- examples/canadian_flag: `AttributeError: make_surface_from_array_of_points`
- examples/canadian_flag_algebra: `AttributeError: make_surface_from_array_of_points`
- examples/cast_bearing_unit: `NotImplemented: make_hull is not supported in build123d-lite`
- examples/dual_color_3mf: `NotImplemented: one-sided line offsets (side=) are not supported in build123d-lite`
- examples/fast_grid_holes: `other: Line 3749: Uncaught Error: Python JavascriptError: Cannot pass \"[object Object]\" as a TopoDS_Shape`
- examples/handle: `NotImplemented: multisection sweep is not supported in build123d-lite`
- examples/handle_algebra: `NotImplemented: multisection sweep is not supported in build123d-lite`
- examples/joints: `TypeError: 'NullType' object is not iterable`
- examples/joints_algebra: `AttributeError: x_axis`
- examples/key_cap: `NotImplemented: section is not supported in build123d-lite`
- examples/key_cap_algebra: `NotImplemented: section is not supported in build123d-lite`
- examples/maker_coin: `NameError: DoubleTangentArc`
- examples/pegboard_j_hook: `AttributeError: wires`
- examples/pegboard_j_hook_algebra: `other: Line 3749: Uncaught Error: Python JavascriptError: e.ShapeType is not a function`
- examples/platonic_solids: `ImportError: undefined`
- examples/projection: `AttributeError: make_sphere`
- examples/projection_algebra: `AttributeError: project_to_shape`
- examples/stud_wall: `NotImplemented: RigidJoint is not supported in build123d-lite`
- examples/tea_cup_algebra: `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds`
- examples/toy_truck: `RuntimeError: INTERNAL OPENCASCADE ERROR DURING GENERATE: memory access out of bounds`
- examples/twist_extrude: `AttributeError: extrude_linear_with_rotation`
- examples/vase_algebra: `NotImplemented: cannot reconstruct a BSplineCurve edge as a segment in build123d-lite`

## Timeouts


## Excluded (reference failed natively)

- examples/python_logo: reference no-shapes
- examples/tea_cup: reference error
- general_examples_algebra/ex10: reference error
