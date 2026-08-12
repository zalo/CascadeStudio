# build123d-lite validation report

Generated 2026-08-12T23:51:12.286Z - 129 scripts (126 scored, 3 excluded because real build123d fails natively).

| Status | Count |
|---|---|
| PASS | 50 |
| MISMATCH | 10 |
| ERROR | 64 |
| TIMEOUT | 2 |
| SKIP | 3 |

## Feature-gap frequency (ERROR bucket)

| Gap | Scripts |
|---|---|
| `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)` | 10 |
| `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)` | 7 |
| `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite` | 6 |
| `NotImplemented: extrude taper is not supported in build123d-lite` | 5 |
| `NotImplemented: only Kind.ARC offsets are supported` | 4 |
| `ImportError: undefined` | 3 |
| `NotImplemented: position/tangent along multi-edge curves` | 3 |
| `other: Line 3015: Uncaught Error: Python AssertionError\nTraceback (most recent call last):\n  File \"casca` | 2 |
| `AttributeError: make_surface_from_array_of_points` | 2 |
| `TypeError: Bezier() got an unexpected keyword argument 'weights'` | 2 |
| `NameError: SlotArc` | 2 |
| `NotImplemented: extrude(until=...) is not supported in build123d-lite` | 2 |
| `AttributeError: face` | 1 |
| `NotImplemented: EllipticalCenterArc is not supported in build123d-lite` | 1 |
| `NotImplemented: make_hull is not supported in build123d-lite` | 1 |
| `ValueError: offset: nothing to offset` | 1 |
| `other: Line 3015: Uncaught Error: Python JavascriptError: Cannot create property '__traceback__' on number ` | 1 |
| `AttributeError: wires` | 1 |
| `other: Line 3015: Uncaught Error: Python JavascriptError: e.ShapeType is not a function\nTraceback (most re` | 1 |
| `AttributeError: local_locations` | 1 |
| `AttributeError: make_sphere` | 1 |
| `AttributeError: project_to_shape` | 1 |
| `AttributeError: translate` | 1 |
| `AttributeError: _tag` | 1 |
| `AttributeError: extrude_linear_with_rotation` | 1 |
| `AttributeError: offset` | 1 |
| `NotImplemented: Ellipse is not supported in build123d-lite (no ellipse curve binding)` | 1 |
| `TypeError: unsupported operand type(s) for -: 'ShapeList' and 'ShapeList'` | 1 |


## Mismatches (runs, but geometry differs)

- **examples/boxes_on_faces_algebra**
  - 'b' volume 29.115 vs 28.200 (3.24%)
- **examples/custom_sketch_objects**
  - 'lid' volume 0.000 vs 13597.408 (-100.00%)
  - 'lid' has no lite bbox
  - 'lid_builder' volume 0.000 vs 13597.408 (-100.00%)
  - 'lid_builder' has no lite bbox
- **examples/custom_sketch_objects_algebra**
  - 'lid' volume 12884.116 vs 13597.408 (-5.25%)
- **examples/din_rail_algebra**
  - 'slot_faces[0]' bbox[2] 17.5000 vs 192.5000 (d=175.0000)
  - 'slot_faces[10]' bbox[2] 267.5000 vs 442.5000 (d=175.0000)
  - 'slot_faces[11]' bbox[2] 292.5000 vs 467.5000 (d=175.0000)
  - 'slot_faces[12]' bbox[2] 317.5000 vs 492.5000 (d=175.0000)
  - 'slot_faces[13]' bbox[2] 342.5000 vs 517.5000 (d=175.0000)
  - 'slot_faces[14]' bbox[2] 367.5000 vs 542.5000 (d=175.0000)
  - 'slot_faces[15]' bbox[2] 392.5000 vs 567.5000 (d=175.0000)
  - 'slot_faces[16]' bbox[2] 417.5000 vs 592.5000 (d=175.0000)
- **examples/mixed_algebra_context**
  - 'bl' bbox[1] 1.0000 vs 0.0000 (d=1.0000)
- **examples/multiple_workplanes_algebra**
  - 'obj' volume 15.868 vs 15.083 (5.21%)
- **general_examples/ex12**
  - 'ex12' bbox[4] 35.2541 vs 35.0829 (d=0.1712)
  - 'ex12_ln' bbox[4] 35.2527 vs 35.0829 (d=0.1698)
  - 'ex12_sk' bbox[4] 35.2541 vs 35.0829 (d=0.1712)
  - 'l1' bbox[1] 19.2600 vs 18.6037 (d=0.6563)
- **general_examples/ex28**
  - 'ex28' volume 0.000 vs 251188.196 (-100.00%)
  - 'ex28' has no lite bbox
- **general_examples_algebra/ex12**
  - 'ex12' bbox[4] 35.2541 vs 35.0829 (d=0.1712)
  - 'l1' bbox[1] 19.2600 vs 18.6037 (d=0.6563)
  - 'sk12' bbox[4] 35.2541 vs 35.0829 (d=0.1712)
- **general_examples_algebra/ex28**
  - 'ex28' volume 0.000 vs 251188.196 (-100.00%)
  - 'ex28' has no lite bbox

## Passing scripts

- examples/circuit_board (1 shapes)
- examples/circuit_board_algebra (1 shapes)
- examples/din_rail (3 shapes)
- examples/holes (4 shapes)
- examples/holes_algebra (4 shapes)
- examples/intersecting_chamfers (1 shapes)
- examples/intersecting_chamfers_algebra (2 shapes)
- examples/pillow_block (2 shapes)
- examples/pillow_block_algebra (2 shapes)
- general_examples/ex01 (1 shapes)
- general_examples/ex02 (1 shapes)
- general_examples/ex03 (2 shapes)
- general_examples/ex08 (3 shapes)
- general_examples/ex09 (1 shapes)
- general_examples/ex10 (1 shapes)
- general_examples/ex11 (2 shapes)
- general_examples/ex13 (1 shapes)
- general_examples/ex14 (6 shapes)
- general_examples/ex15 (8 shapes)
- general_examples/ex16 (3 shapes)
- general_examples/ex17 (2 shapes)
- general_examples/ex18 (1 shapes)
- general_examples/ex19 (6 shapes)
- general_examples/ex20 (1 shapes)
- general_examples/ex21 (2 shapes)
- general_examples/ex22 (2 shapes)
- general_examples/ex27 (2 shapes)
- general_examples/ex31 (2 shapes)
- general_examples/ex32 (3 shapes)
- general_examples/ex33 (3 shapes)
- general_examples_algebra/ex01 (1 shapes)
- general_examples_algebra/ex02 (1 shapes)
- general_examples_algebra/ex03 (2 shapes)
- general_examples_algebra/ex08 (3 shapes)
- general_examples_algebra/ex09 (1 shapes)
- general_examples_algebra/ex13 (1 shapes)
- general_examples_algebra/ex14 (6 shapes)
- general_examples_algebra/ex15 (8 shapes)
- general_examples_algebra/ex16 (10 shapes)
- general_examples_algebra/ex17 (2 shapes)
- general_examples_algebra/ex18 (2 shapes)
- general_examples_algebra/ex19 (6 shapes)
- general_examples_algebra/ex20 (2 shapes)
- general_examples_algebra/ex21 (1 shapes)
- general_examples_algebra/ex22 (2 shapes)
- general_examples_algebra/ex24 (2 shapes)
- general_examples_algebra/ex27 (2 shapes)
- general_examples_algebra/ex31 (1 shapes)
- general_examples_algebra/ex32 (2 shapes)
- general_examples_algebra/ex33 (1 shapes)

## Errors by script

- examples/bicycle_tire: `AttributeError: face`
- examples/boxes_on_faces: `other: Line 3015: Uncaught Error: Python AssertionError\nTraceback (most recent call last):\n  File \"casca`
- examples/bracelet: `NotImplemented: EllipticalCenterArc is not supported in build123d-lite`
- examples/build123d_customizable_logo: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/build123d_customizable_logo_algebra: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/build123d_logo: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/build123d_logo_algebra: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/canadian_flag: `AttributeError: make_surface_from_array_of_points`
- examples/canadian_flag_algebra: `AttributeError: make_surface_from_array_of_points`
- examples/cast_bearing_unit: `NotImplemented: make_hull is not supported in build123d-lite`
- examples/clock: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/clock_algebra: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/dual_color_3mf: `ValueError: offset: nothing to offset`
- examples/extrude: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/extrude_algebra: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- examples/fast_grid_holes: `ImportError: undefined`
- examples/handle: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- examples/handle_algebra: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- examples/intersecting_pipes: `other: Line 3015: Uncaught Error: Python JavascriptError: Cannot create property '__traceback__' on number `
- examples/joints: `NotImplemented: extrude taper is not supported in build123d-lite`
- examples/joints_algebra: `NotImplemented: extrude taper is not supported in build123d-lite`
- examples/key_cap: `NotImplemented: extrude taper is not supported in build123d-lite`
- examples/key_cap_algebra: `NotImplemented: extrude taper is not supported in build123d-lite`
- examples/lego: `NotImplemented: only Kind.ARC offsets are supported`
- examples/lego_algebra: `NotImplemented: only Kind.ARC offsets are supported`
- examples/loft: `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite`
- examples/loft_algebra: `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite`
- examples/maker_coin: `NotImplemented: position/tangent along multi-edge curves`
- examples/multiple_workplanes: `other: Line 3015: Uncaught Error: Python AssertionError\nTraceback (most recent call last):\n  File \"casca`
- examples/packed_boxes: `ImportError: undefined`
- examples/pegboard_j_hook: `AttributeError: wires`
- examples/pegboard_j_hook_algebra: `other: Line 3015: Uncaught Error: Python JavascriptError: e.ShapeType is not a function\nTraceback (most re`
- examples/platonic_solids: `ImportError: undefined`
- examples/playing_cards: `AttributeError: local_locations`
- examples/projection: `AttributeError: make_sphere`
- examples/projection_algebra: `AttributeError: project_to_shape`
- examples/roller_coaster: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- examples/roller_coaster_algebra: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- examples/shamrock: `AttributeError: translate`
- examples/stud_wall: `AttributeError: _tag`
- examples/tea_cup_algebra: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- examples/toy_truck: `NotImplemented: extrude taper is not supported in build123d-lite`
- examples/twist_extrude: `AttributeError: extrude_linear_with_rotation`
- examples/vase: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- examples/vase_algebra: `NotImplemented: Spline tangents= is not supported in build123d-lite (approximating fit only)`
- general_examples/ex23: `NotImplemented: position/tangent along multi-edge curves`
- general_examples/ex24: `AttributeError: offset`
- general_examples/ex25: `NotImplemented: only Kind.ARC offsets are supported`
- general_examples/ex26: `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite`
- general_examples/ex29: `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite`
- general_examples/ex30: `TypeError: Bezier() got an unexpected keyword argument 'weights'`
- general_examples/ex34: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- general_examples/ex35: `NameError: SlotArc`
- general_examples/ex36: `NotImplemented: extrude(until=...) is not supported in build123d-lite`
- general_examples/ex37: `NotImplemented: Ellipse is not supported in build123d-lite (no ellipse curve binding)`
- general_examples_algebra/ex11: `TypeError: unsupported operand type(s) for -: 'ShapeList' and 'ShapeList'`
- general_examples_algebra/ex23: `NotImplemented: position/tangent along multi-edge curves`
- general_examples_algebra/ex25: `NotImplemented: only Kind.ARC offsets are supported`
- general_examples_algebra/ex26: `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite`
- general_examples_algebra/ex29: `NotImplemented: offset(openings=...) needs thick-solid support not present in build123d-lite`
- general_examples_algebra/ex30: `TypeError: Bezier() got an unexpected keyword argument 'weights'`
- general_examples_algebra/ex34: `NotImplemented: Text is not supported in build123d-lite (font metrics differ between environments)`
- general_examples_algebra/ex35: `NameError: SlotArc`
- general_examples_algebra/ex36: `NotImplemented: extrude(until=...) is not supported in build123d-lite`

## Timeouts

- examples/heat_exchanger
- examples/heat_exchanger_algebra

## Excluded (reference failed natively)

- examples/python_logo: reference no-shapes
- examples/tea_cup: reference error
- general_examples_algebra/ex10: reference error
