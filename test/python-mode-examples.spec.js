// @ts-check
// Regression tests: representative REAL build123d scripts frozen from the
// validation harness (test/b123d-validation) at build123d 0.11.1.
// Each test runs the upstream script (Apache-2.0, from the build123d repo's
// docs/examples) through Python mode and asserts the volumes of its
// module-level shapes against the values REAL build123d produced natively
// (0.5% relative tolerance — the harness's PASS criterion).
//
// Regenerate expectations with:  test/b123d-validation/run.sh
const { test, expect } = require('@playwright/test');

/** Measurement footer — same convention as test/b123d-validation/run-lite.mjs */
const FOOTER = '\n\nimport build123d as _m\nprint("B123D_MEASURE " + _m._measure_globals_json(globals()))\n';

async function gotoAndReady(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 90000 });
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
}

async function runAndMeasure(page, code) {
  await page.evaluate((c) => window.CascadeAPI.runCode(c), code + FOOTER);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('B123D_MEASURE ')),
    undefined, { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  const payload = logs.find((l) => l.startsWith('B123D_MEASURE ')).slice('B123D_MEASURE '.length);
  // the console panel stores JSON.stringify(arg) minus outer quotes
  try { return JSON.parse(payload); } catch (e) { return JSON.parse(JSON.parse('"' + payload + '"')); }
}

test.describe('Python mode: frozen build123d example scripts', () => {
  // Heavy scripts (hex-array booleans, Gordon-surface projection) exceed the
  // default 120s on slow CI runners (SwiftShader WebGL, 2 cores) — the
  // push-event run of bb1ce0f timed out on heat_exchanger/bracelet while the
  // pull_request run passed on a faster machine. Give every frozen example
  // generous headroom; wall-clock locally is unaffected (they finish early).
  test.setTimeout(360000);

  // general_examples/ex02 — builder mode: Box + Mode.SUBTRACT Cylinder
  test("general_examples/ex02", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 2. Plane with Hole\n# [Ex. 2]\nlength, width, thickness = 80.0, 60.0, 10.0\ncenter_hole_dia = 22.0\n\nwith BuildPart() as ex2:\n    Box(length, width, thickness)\n    Cylinder(radius=center_hole_dia / 2, height=thickness, mode=Mode.SUBTRACT)\n    # [Ex. 2]\n# [removed by collect.py] write_svg()\n\n# show_object(ex2.part)\n");
    // real build123d: ex2.volume == 44198.67288915635
    expect(Math.abs(measured["ex2"].volume - 44198.67288915635))
      .toBeLessThan(44198.67288915635 * 0.005);
  });

  // general_examples/ex08 — BuildLine polyline + mirror + make_face + extrude
  test("general_examples/ex08", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 8. Polylines\n# [Ex. 8]\n(L, H, W, t) = (100.0, 20.0, 20.0, 1.0)\npts = [\n    (0, H / 2.0),\n    (W / 2.0, H / 2.0),\n    (W / 2.0, (H / 2.0 - t)),\n    (t / 2.0, (H / 2.0 - t)),\n    (t / 2.0, (t - H / 2.0)),\n    (W / 2.0, (t - H / 2.0)),\n    (W / 2.0, H / -2.0),\n    (0, H / -2.0),\n]\n\nwith BuildPart() as ex8:\n    with BuildSketch(Plane.YZ) as ex8_sk:\n        with BuildLine() as ex8_ln:\n            Polyline(pts)\n            mirror(ex8_ln.line, about=Plane.YZ)\n        make_face()\n    extrude(amount=L)\n    # [Ex. 8]\n# [removed by collect.py] write_svg()\n\n# show_object(ex8.part)\n");
    // real build123d: ex8.volume == 5800.0
    expect(Math.abs(measured["ex8"].volume - 5800.0))
      .toBeLessThan(5800.0 * 0.005);
  });

  // general_examples/ex11 — chamfer/fillet selectors, Select.LAST, Hole, BuildSketch on a face, GridLocations, RegularPolygon
  test("general_examples/ex11", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 11. Use a face as workplane for BuildSketch and introduce GridLocations\n# [Ex. 11]\nlength, width, thickness = 80.0, 60.0, 10.0\n\nwith BuildPart() as ex11:\n    Box(length, width, thickness)\n    chamfer(ex11.edges().group_by(Axis.Z)[-1], length=4)\n    fillet(ex11.edges().filter_by(Axis.Z), radius=5)\n    Hole(radius=width / 4)\n    fillet(ex11.edges(Select.LAST).sort_by(Axis.Z)[-1], radius=2)\n    with BuildSketch(ex11.faces().sort_by(Axis.Z)[-1]) as ex11_sk:\n        with GridLocations(length / 2, width / 2, 2, 2):\n            RegularPolygon(radius=5, side_count=5)\n    extrude(amount=-thickness, mode=Mode.SUBTRACT)\n    # [Ex. 11]\n# [removed by collect.py] write_svg()\n\n# show_object(ex11)\n");
    // real build123d: ex11.volume == 36177.36505728397
    expect(Math.abs(measured["ex11"].volume - 36177.36505728397))
      .toBeLessThan(36177.36505728397 * 0.005);
  });

  // general_examples/ex13 — Locations(face) + PolarLocations + CounterSink/CounterBore holes
  test("general_examples/ex13", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 13. CounterBoreHoles, CounterSinkHoles and PolarLocations\n# [Ex. 13]\na, b = 40, 4\nwith BuildPart() as ex13:\n    Cylinder(radius=50, height=10)\n    with Locations(ex13.faces().sort_by(Axis.Z)[-1]):\n        with PolarLocations(radius=a, count=4):\n            CounterSinkHole(radius=b, counter_sink_radius=2 * b)\n        with PolarLocations(radius=a, count=4, start_angle=45, angular_range=360):\n            CounterBoreHole(radius=b, counter_bore_radius=2 * b, counter_bore_depth=b)\n    # [Ex. 13]\n# [removed by collect.py] write_svg()\n\n# show_object(ex13.part)\n");
    // real build123d: ex13.volume == 70872.25969468078
    expect(Math.abs(measured["ex13"].volume - 70872.25969468078))
      .toBeLessThan(70872.25969468078 * 0.005);
  });

  // general_examples/ex14 — JernArc + position/tangent (@/%) + sweep along a BuildLine path
  test("general_examples/ex14", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 14. Position on a line with '@', '%' and introduce sweep\n# [Ex. 14]\na, b = 40, 20\n\nwith BuildPart() as ex14:\n    with BuildLine() as ex14_ln:\n        l1 = JernArc(start=(0, 0), tangent=(0, 1), radius=a, arc_size=180)\n        l2 = JernArc(start=l1 @ 1, tangent=l1 % 1, radius=a, arc_size=-90)\n        l3 = Line(l2 @ 1, l2 @ 1 + (-a, a))\n    with BuildSketch(Plane.XZ) as ex14_sk:\n        Rectangle(b, b)\n    sweep()\n    # [Ex. 14]\n# [removed by collect.py] write_svg()\n\n# show_object(ex14.part)\n");
    // real build123d: ex14.volume == 91398.2236861551
    expect(Math.abs(measured["ex14"].volume - 91398.2236861551))
      .toBeLessThan(91398.2236861551 * 0.005);
  });

  // general_examples/ex22 — Plane(face).rotated + GridLocations + extrude(both=True, Mode.SUBTRACT)
  test("general_examples/ex22", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 22. Rotated Workplanes\n# [Ex. 22]\nlength, width, thickness = 80.0, 60.0, 10.0\n\nwith BuildPart() as ex22:\n    Box(length, width, thickness)\n    pln = Plane(ex22.faces().group_by(Axis.Z)[0][0]).rotated((0, -50, 0))\n    with BuildSketch(pln) as ex22_sk:\n        with GridLocations(length / 4, width / 4, 2, 2):\n            Circle(thickness / 4)\n    extrude(amount=-100, both=True, mode=Mode.SUBTRACT)\n    # [Ex. 22]\n# [removed by collect.py] write_svg()\n\n# show_object(ex22.part)\n");
    // real build123d: ex22.volume == 46778.13736363063
    expect(Math.abs(measured["ex22"].volume - 46778.13736363063))
      .toBeLessThan(46778.13736363063 * 0.005);
  });

  // general_examples/ex27 — BuildSketch on a face + split(bisect_by=offset plane)
  test("general_examples/ex27", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 27. Splitting an Object\n# [Ex. 27]\nlength, width, thickness = 80.0, 60.0, 10.0\n\nwith BuildPart() as ex27:\n    Box(length, width, thickness)\n    with BuildSketch(ex27.faces().sort_by(Axis.Z)[0]) as ex27_sk:\n        Circle(width / 4)\n    extrude(amount=-thickness, mode=Mode.SUBTRACT)\n    split(bisect_by=Plane(ex27.faces().sort_by(Axis.Y)[-1]).offset(-width / 2))\n    # [Ex. 27]\n# [removed by collect.py] write_svg()\n\n# show_object(ex27.part)\n");
    // real build123d: ex27.volume == 20465.708264711477
    expect(Math.abs(measured["ex27"].volume - 20465.708264711477))
      .toBeLessThan(20465.708264711477 * 0.005);
  });

  // general_examples_algebra/ex19 — algebra extrude, face/vertex selectors, Pos placement
  test("general_examples_algebra/ex19", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 19. Locating a Workplane on a vertex\n# [Ex. 19]\nlength, thickness = 80.0, 10.0\n\nex19_sk = RegularPolygon(radius=length / 2, side_count=7)\nex19 = extrude(ex19_sk, thickness)\n\ntopf = ex19.faces().sort_by().last\n\nvtx = topf.vertices().group_by(Axis.X)[-1][0]\n\nvtx2Axis = Axis((0, 0, 0), (-1, -0.5, 0))\nvtx2 = topf.vertices().sort_by(vtx2Axis)[-1]\n\nex19_sk2 = Circle(radius=length / 8)\nex19_sk2 = Pos(vtx.X, vtx.Y) * ex19_sk2 + Pos(vtx2.X, vtx2.Y) * ex19_sk2\n\nex19 -= extrude(ex19_sk2, thickness)\n# [Ex. 19]\n# show_object(ex19)\n");
    // real build123d: ex19.volume == 41538.56826564553
    expect(Math.abs(measured["ex19"].volume - 41538.56826564553))
      .toBeLessThan(41538.56826564553 * 0.005);
  });

  // general_examples_algebra/ex24 — Plane(face), plane.offset, loft over a Sketch list
  test("general_examples_algebra/ex24", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 24. Lofts\n# [Ex. 24]\nlength, width, thickness = 80.0, 60.0, 10.0\n\nex24 = Box(length, length, thickness)\nplane = Plane(ex24.faces().sort_by().last)\n\nfaces = Sketch() + [\n    plane * Circle(length / 3),\n    plane.offset(length / 2) * Rectangle(length / 6, width / 6),\n]\n\nex24 += loft(faces)\n# [Ex. 24]\n# show_object(ex24)\n");
    // real build123d: ex24.volume == 102969.87958520795
    expect(Math.abs(measured["ex24"].volume - 102969.87958520795))
      .toBeLessThan(102969.87958520795 * 0.005);
  });

  // examples/pillow_block_algebra — 2D vertex fillets + CounterBoreHoles + GridLocations (real-world part)
  test("examples/pillow_block_algebra", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n\nheight, width, thickness, padding = 60, 80, 10, 12\nscrew_shaft_radius, screw_head_radius, screw_head_height = 1.5, 3, 3\nbearing_axle_radius, bearing_radius, bearing_thickness = 4, 11, 7\n\n# Build pillow block as an extruded sketch with counter bore holes\nplan = Rectangle(width, height)\nplan = fillet(plan.vertices(), radius=5)\npillow_block = extrude(plan, thickness)\n\nplane = Plane(pillow_block.faces().sort_by().last)\n\npillow_block -= plane * CounterBoreHole(\n    bearing_axle_radius, bearing_radius, bearing_thickness, height\n)\nlocs = GridLocations(width - 2 * padding, height - 2 * padding, 2, 2)\npillow_block -= (\n    plane\n    * locs\n    * CounterBoreHole(screw_shaft_radius, screw_head_radius, screw_head_height, height)\n)\n\n# Render the part\nif \"show_object\" in locals():\n    show_object(pillow_block)\n");
    // real build123d: pillow_block.volume == 44436.460392133944
    expect(Math.abs(measured["pillow_block"].volume - 44436.460392133944))
      .toBeLessThan(44436.460392133944 * 0.005);
  });


  // examples/heat_exchanger — HexLocations, SortBy.RADIUS, tube arrays (was a timeout on the old bbox hook)
  test("examples/heat_exchanger", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\n\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\nexchanger_diameter = 10 * CM\nexchanger_length = 30 * CM\nplate_thickness = 5 * MM\n# 149 tubes\ntube_diameter = 5 * MM\ntube_spacing = 2 * MM\ntube_wall_thickness = 0.5 * MM\ntube_extension = 3 * MM\nbundle_diameter = exchanger_diameter - 2 * tube_diameter\nfillet_radius = tube_spacing / 3\nassert tube_extension > fillet_radius\n\n# Build the heat exchanger\nwith BuildPart() as heat_exchanger:\n    # Generate list of tube locations\n    tube_locations = [\n        l\n        for l in HexLocations(\n            radius=(tube_diameter + tube_spacing) / 2,\n            x_count=exchanger_diameter // tube_diameter,\n            y_count=exchanger_diameter // tube_diameter,\n        )\n        if l.position.length < bundle_diameter / 2\n    ]\n    tube_count = len(tube_locations)\n    with BuildSketch() as tube_plan:\n        with Locations(*tube_locations):\n            Circle(radius=tube_diameter / 2)\n            Circle(radius=tube_diameter / 2 - tube_wall_thickness, mode=Mode.SUBTRACT)\n    extrude(amount=exchanger_length / 2)\n    with BuildSketch(\n        Plane(\n            origin=(0, 0, exchanger_length / 2 - tube_extension - plate_thickness),\n            z_dir=(0, 0, 1),\n        )\n    ) as plate_plan:\n        Circle(radius=exchanger_diameter / 2)\n        with Locations(*tube_locations):\n            Circle(radius=tube_diameter / 2 - tube_wall_thickness, mode=Mode.SUBTRACT)\n    extrude(amount=plate_thickness)\n    half_volume_before_fillet = heat_exchanger.part.volume\n    # Simulate welded tubes by adding a fillet to the outside radius of the tubes\n    fillet(\n        heat_exchanger.edges()\n        .filter_by(GeomType.CIRCLE)\n        .sort_by(SortBy.RADIUS)\n        .sort_by(Axis.Z, reverse=True)[2 * tube_count : 3 * tube_count],\n        radius=fillet_radius,\n    )\n    half_volume_after_fillet = heat_exchanger.part.volume\n    mirror(about=Plane.XY)\n\nfillet_volume = 2 * (half_volume_after_fillet - half_volume_before_fillet)\nassert abs(fillet_volume - 469.88331045553787) < 1e-3\n\nshow(heat_exchanger)\n# [End]\n");
    // real build123d: heat_exchanger.volume == 363795.07369811094
    expect(Math.abs(measured["heat_exchanger"].volume - 363795.07369811094))
      .toBeLessThan(363795.07369811094 * 0.005);
  });

  // examples/lego — Kind.INTERSECTION 2D offsets + GridLocations wall grid
  test("examples/lego", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import show_object\n\nGEN_DOCS = False\npip_count = 6\n\nlego_unit_size = 8\npip_height = 1.8\npip_diameter = 4.8\nblock_length = lego_unit_size * pip_count\nblock_width = 16\nbase_height = 9.6\nblock_height = base_height + pip_height\nsupport_outer_diameter = 6.5\nsupport_inner_diameter = 4.8\nridge_width = 0.6\nridge_depth = 0.3\nwall_thickness = 1.2\n\nwith BuildPart() as lego:\n    # Draw the bottom of the block\n    with BuildSketch() as plan:\n        # Start with a Rectangle the size of the block\n        perimeter = Rectangle(width=block_length, height=block_width)\n        if GEN_DOCS:\n            exporter = ExportSVG(scale=6)\n            exporter.add_shape(plan.sketch)\n            exporter.write(\"assets/lego_step4.svg\")\n        # Subtract an offset to create the block walls\n        offset(\n            perimeter,\n            -wall_thickness,\n            kind=Kind.INTERSECTION,\n            mode=Mode.SUBTRACT,\n        )\n        if GEN_DOCS:\n            exporter = ExportSVG(scale=6)\n            exporter.add_shape(plan.sketch)\n            exporter.write(\"assets/lego_step5.svg\")\n        # Add a grid of lengthwise and widthwise bars\n        with GridLocations(x_spacing=0, y_spacing=lego_unit_size, x_count=1, y_count=2):\n            Rectangle(width=block_length, height=ridge_width)\n        with GridLocations(lego_unit_size, 0, pip_count, 1):\n            Rectangle(width=ridge_width, height=block_width)\n        if GEN_DOCS:\n            exporter = ExportSVG(scale=6)\n            exporter.add_shape(plan.sketch)\n            exporter.write(\"assets/lego_step6.svg\")\n        # Subtract a rectangle leaving ribs on the block walls\n        Rectangle(\n            block_length - 2 * (wall_thickness + ridge_depth),\n            block_width - 2 * (wall_thickness + ridge_depth),\n            mode=Mode.SUBTRACT,\n        )\n        if GEN_DOCS:\n            exporter = ExportSVG(scale=6)\n            exporter.add_shape(plan.sketch)\n            exporter.write(\"assets/lego_step7.svg\")\n        # Add a row of hollow circles to the center\n        with GridLocations(\n            x_spacing=lego_unit_size, y_spacing=0, x_count=pip_count - 1, y_count=1\n        ):\n            Circle(radius=support_outer_diameter / 2)\n            Circle(radius=support_inner_diameter / 2, mode=Mode.SUBTRACT)\n        if GEN_DOCS:\n            exporter = ExportSVG(scale=6)\n            exporter.add_shape(plan.sketch)\n            exporter.write(\"assets/lego_step8.svg\")\n    # Extrude this base sketch to the height of the walls\n    extrude(amount=base_height - wall_thickness)\n    if GEN_DOCS:\n        visible, hidden = lego.part.project_to_viewport((-5, -30, 50))\n        exporter = ExportSVG(scale=6)\n        exporter.add_layer(\"Visible\")\n        exporter.add_layer(\n            \"Hidden\", line_color=(99, 99, 99), line_type=LineType.ISO_DOT\n        )\n        exporter.add_shape(visible, layer=\"Visible\")\n        exporter.add_shape(hidden, layer=\"Hidden\")\n        exporter.write(\"assets/lego_step9.svg\")\n    # Create a box on the top of the walls\n    with Locations((0, 0, lego.vertices().sort_by(Axis.Z)[-1].Z)):\n        # Create the top of the block\n        Box(\n            length=block_length,\n            width=block_width,\n            height=wall_thickness,\n            align=(Align.CENTER, Align.CENTER, Align.MIN),\n        )\n    if GEN_DOCS:\n        visible, hidden = lego.part.project_to_viewport((-5, -30, 50))\n        exporter = ExportSVG(scale=6)\n        exporter.add_layer(\"Visible\")\n        exporter.add_layer(\n            \"Hidden\", line_color=(99, 99, 99), line_type=LineType.ISO_DOT\n        )\n        exporter.add_shape(visible, layer=\"Visible\")\n        exporter.add_shape(hidden, layer=\"Hidden\")\n        exporter.write(\"assets/lego_step10.svg\")\n    # Create a workplane on the top of the block\n    with BuildPart(lego.faces().sort_by(Axis.Z)[-1]):\n        # Create a grid of pips\n        with GridLocations(lego_unit_size, lego_unit_size, pip_count, 2):\n            Cylinder(\n                radius=pip_diameter / 2,\n                height=pip_height,\n                align=(Align.CENTER, Align.CENTER, Align.MIN),\n            )\n    if GEN_DOCS:\n        visible, hidden = lego.part.project_to_viewport((-100, -100, 50))\n        exporter = ExportSVG(scale=6)\n        exporter.add_layer(\"Visible\")\n        exporter.add_layer(\n            \"Hidden\", line_color=(99, 99, 99), line_type=LineType.ISO_DOT\n        )\n        exporter.add_shape(visible, layer=\"Visible\")\n        exporter.add_shape(hidden, layer=\"Hidden\")\n        exporter.write(\"assets/lego.svg\")\n\nassert abs(lego.part.volume - 3212.187337781355) < 1e-3\n\nshow_object(lego.part, name=\"lego\")\n");
    // real build123d: lego.volume == 3212.1873377813517
    expect(Math.abs(measured["lego"].volume - 3212.1873377813517))
      .toBeLessThan(3212.1873377813517 * 0.005);
  });

  // examples/loft — loft between pending sketches
  test("examples/loft", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\n\nfrom math import pi, sin\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\nwith BuildPart() as art:\n    slice_count = 10\n    for i in range(slice_count + 1):\n        with BuildSketch(Plane(origin=(0, 0, i * 3), z_dir=(0, 0, 1))) as slice:\n            Circle(10 * sin(i * pi / slice_count) + 5)\n    loft()\n    top_bottom = art.faces().filter_by(GeomType.PLANE)\n    offset(openings=top_bottom, amount=0.5)\n\nwant = 1306.3405290344635\ngot = art.part.volume\ndelta = abs(got - want)\ntolerance = want * 1e-5\nassert delta < tolerance, f\"{delta=} is greater than {tolerance=}; {got=}, {want=}\"\n\nshow(art, names=[\"art\"])\n# [End]\n");
    // real build123d: art.volume == 1306.3405290344635
    expect(Math.abs(measured["art"].volume - 1306.3405290344635))
      .toBeLessThan(1306.3405290344635 * 0.005);
  });

  // examples/packed_boxes — pack() port + exact MT19937 random shim + HLR projection
  test("examples/packed_boxes", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "import functools\nimport operator\nimport random\nimport build123d as bd\n\nGEN_DOCS = False\n\nrandom.seed(123456)\ntest_boxes = [bd.Box(random.randint(1, 20), random.randint(1, 20), random.randint(1, 5))\n              for _ in range(50)]\npacked = bd.pack(test_boxes, 3)\n\n# Lifted from https://build123d.readthedocs.io/en/latest/import_export.html#d-to-2d-projection\ndef export_svg(parts, name):\n    part = functools.reduce(operator.add, parts, bd.Part())\n    view_port_origin=(0, 0, 150)\n    visible, hidden = part.project_to_viewport(view_port_origin)\n    max_dimension = max(*bd.Compound(children=visible + hidden).bounding_box().size)\n    exporter = bd.ExportSVG(scale=100 / max_dimension)\n    exporter.add_layer(\"Visible\")\n    exporter.add_layer(\"Hidden\", line_color=(99, 99, 99), line_type=bd.LineType.ISO_DOT)\n    exporter.add_shape(visible, layer=\"Visible\")\n    exporter.add_shape(hidden, layer=\"Hidden\")\n    if GEN_DOCS:\n        exporter.write(f\"../docs/assets/{name}.svg\")\n\nexport_svg(test_boxes, \"packed_boxes_input\")\nexport_svg(packed, \"packed_boxes_output\")\n");
    // real build123d: packed[0].volume == 342.0
    expect(Math.abs(measured["packed[0]"].volume - 342.0))
      .toBeLessThan(342.0 * 0.005);
    // real build123d: packed[10].volume == 340.00000000000006
    expect(Math.abs(measured["packed[10]"].volume - 340.00000000000006))
      .toBeLessThan(340.00000000000006 * 0.005);
    // real build123d: packed[11].volume == 1020.0
    expect(Math.abs(measured["packed[11]"].volume - 1020.0))
      .toBeLessThan(1020.0 * 0.005);
    // real build123d: packed[12].volume == 99.99999999999997
    expect(Math.abs(measured["packed[12]"].volume - 99.99999999999997))
      .toBeLessThan(99.99999999999997 * 0.005);
    // real build123d: packed[13].volume == 280.0
    expect(Math.abs(measured["packed[13]"].volume - 280.0))
      .toBeLessThan(280.0 * 0.005);
    // real build123d: packed[14].volume == 420.0
    expect(Math.abs(measured["packed[14]"].volume - 420.0))
      .toBeLessThan(420.0 * 0.005);
    // real build123d: packed[15].volume == 96.0
    expect(Math.abs(measured["packed[15]"].volume - 96.0))
      .toBeLessThan(96.0 * 0.005);
    // real build123d: packed[16].volume == 31.999999999999993
    expect(Math.abs(measured["packed[16]"].volume - 31.999999999999993))
      .toBeLessThan(31.999999999999993 * 0.005);
    // real build123d: packed[17].volume == 627.0
    expect(Math.abs(measured["packed[17]"].volume - 627.0))
      .toBeLessThan(627.0 * 0.005);
    // real build123d: packed[18].volume == 168.0
    expect(Math.abs(measured["packed[18]"].volume - 168.0))
      .toBeLessThan(168.0 * 0.005);
    // real build123d: packed[19].volume == 18.0
    expect(Math.abs(measured["packed[19]"].volume - 18.0))
      .toBeLessThan(18.0 * 0.005);
    // real build123d: packed[1].volume == 364.0
    expect(Math.abs(measured["packed[1]"].volume - 364.0))
      .toBeLessThan(364.0 * 0.005);
    // real build123d: packed[20].volume == 120.0
    expect(Math.abs(measured["packed[20]"].volume - 120.0))
      .toBeLessThan(120.0 * 0.005);
    // real build123d: packed[21].volume == 216.0
    expect(Math.abs(measured["packed[21]"].volume - 216.0))
      .toBeLessThan(216.0 * 0.005);
    // real build123d: packed[22].volume == 48.0
    expect(Math.abs(measured["packed[22]"].volume - 48.0))
      .toBeLessThan(48.0 * 0.005);
    // real build123d: packed[23].volume == 153.0
    expect(Math.abs(measured["packed[23]"].volume - 153.0))
      .toBeLessThan(153.0 * 0.005);
    // real build123d: packed[24].volume == 255.99999999999994
    expect(Math.abs(measured["packed[24]"].volume - 255.99999999999994))
      .toBeLessThan(255.99999999999994 * 0.005);
    // real build123d: packed[25].volume == 9.0
    expect(Math.abs(measured["packed[25]"].volume - 9.0))
      .toBeLessThan(9.0 * 0.005);
    // real build123d: packed[26].volume == 34.0
    expect(Math.abs(measured["packed[26]"].volume - 34.0))
      .toBeLessThan(34.0 * 0.005);
    // real build123d: packed[27].volume == 1275.0
    expect(Math.abs(measured["packed[27]"].volume - 1275.0))
      .toBeLessThan(1275.0 * 0.005);
    // real build123d: packed[28].volume == 129.99999999999997
    expect(Math.abs(measured["packed[28]"].volume - 129.99999999999997))
      .toBeLessThan(129.99999999999997 * 0.005);
    // real build123d: packed[29].volume == 60.0
    expect(Math.abs(measured["packed[29]"].volume - 60.0))
      .toBeLessThan(60.0 * 0.005);
    // real build123d: packed[2].volume == 221.0
    expect(Math.abs(measured["packed[2]"].volume - 221.0))
      .toBeLessThan(221.0 * 0.005);
    // real build123d: packed[30].volume == 12.0
    expect(Math.abs(measured["packed[30]"].volume - 12.0))
      .toBeLessThan(12.0 * 0.005);
    // real build123d: packed[31].volume == 39.99999999999999
    expect(Math.abs(measured["packed[31]"].volume - 39.99999999999999))
      .toBeLessThan(39.99999999999999 * 0.005);
    // real build123d: packed[32].volume == 56.0
    expect(Math.abs(measured["packed[32]"].volume - 56.0))
      .toBeLessThan(56.0 * 0.005);
    // real build123d: packed[33].volume == 156.0
    expect(Math.abs(measured["packed[33]"].volume - 156.0))
      .toBeLessThan(156.0 * 0.005);
    // real build123d: packed[34].volume == 182.00000000000003
    expect(Math.abs(measured["packed[34]"].volume - 182.00000000000003))
      .toBeLessThan(182.00000000000003 * 0.005);
    // real build123d: packed[35].volume == 156.0
    expect(Math.abs(measured["packed[35]"].volume - 156.0))
      .toBeLessThan(156.0 * 0.005);
    // real build123d: packed[36].volume == 585.0
    expect(Math.abs(measured["packed[36]"].volume - 585.0))
      .toBeLessThan(585.0 * 0.005);
    // real build123d: packed[37].volume == 168.0
    expect(Math.abs(measured["packed[37]"].volume - 168.0))
      .toBeLessThan(168.0 * 0.005);
    // real build123d: packed[38].volume == 17.999999999999996
    expect(Math.abs(measured["packed[38]"].volume - 17.999999999999996))
      .toBeLessThan(17.999999999999996 * 0.005);
    // real build123d: packed[39].volume == 7.999999999999998
    expect(Math.abs(measured["packed[39]"].volume - 7.999999999999998))
      .toBeLessThan(7.999999999999998 * 0.005);
    // real build123d: packed[3].volume == 1519.9999999999998
    expect(Math.abs(measured["packed[3]"].volume - 1519.9999999999998))
      .toBeLessThan(1519.9999999999998 * 0.005);
    // real build123d: packed[40].volume == 95.99999999999999
    expect(Math.abs(measured["packed[40]"].volume - 95.99999999999999))
      .toBeLessThan(95.99999999999999 * 0.005);
    // real build123d: packed[41].volume == 198.0
    expect(Math.abs(measured["packed[41]"].volume - 198.0))
      .toBeLessThan(198.0 * 0.005);
    // real build123d: packed[42].volume == 27.0
    expect(Math.abs(measured["packed[42]"].volume - 27.0))
      .toBeLessThan(27.0 * 0.005);
    // real build123d: packed[43].volume == 299.99999999999994
    expect(Math.abs(measured["packed[43]"].volume - 299.99999999999994))
      .toBeLessThan(299.99999999999994 * 0.005);
    // real build123d: packed[44].volume == 19.999999999999996
    expect(Math.abs(measured["packed[44]"].volume - 19.999999999999996))
      .toBeLessThan(19.999999999999996 * 0.005);
    // real build123d: packed[45].volume == 396.0
    expect(Math.abs(measured["packed[45]"].volume - 396.0))
      .toBeLessThan(396.0 * 0.005);
    // real build123d: packed[46].volume == 121.0
    expect(Math.abs(measured["packed[46]"].volume - 121.0))
      .toBeLessThan(121.0 * 0.005);
    // real build123d: packed[47].volume == 288.0
    expect(Math.abs(measured["packed[47]"].volume - 288.0))
      .toBeLessThan(288.0 * 0.005);
    // real build123d: packed[48].volume == 81.0
    expect(Math.abs(measured["packed[48]"].volume - 81.0))
      .toBeLessThan(81.0 * 0.005);
    // real build123d: packed[49].volume == 2.9999999999999996
    expect(Math.abs(measured["packed[49]"].volume - 2.9999999999999996))
      .toBeLessThan(2.9999999999999996 * 0.005);
    // real build123d: packed[4].volume == 1425.0
    expect(Math.abs(measured["packed[4]"].volume - 1425.0))
      .toBeLessThan(1425.0 * 0.005);
    // real build123d: packed[5].volume == 918.0
    expect(Math.abs(measured["packed[5]"].volume - 918.0))
      .toBeLessThan(918.0 * 0.005);
    // real build123d: packed[6].volume == 112.0
    expect(Math.abs(measured["packed[6]"].volume - 112.0))
      .toBeLessThan(112.0 * 0.005);
    // real build123d: packed[7].volume == 510.0
    expect(Math.abs(measured["packed[7]"].volume - 510.0))
      .toBeLessThan(510.0 * 0.005);
    // real build123d: packed[8].volume == 680.0
    expect(Math.abs(measured["packed[8]"].volume - 680.0))
      .toBeLessThan(680.0 * 0.005);
    // real build123d: packed[9].volume == 36.0
    expect(Math.abs(measured["packed[9]"].volume - 36.0))
      .toBeLessThan(36.0 * 0.005);
    // real build123d: test_boxes[0].volume == 19.999999999999996
    expect(Math.abs(measured["test_boxes[0]"].volume - 19.999999999999996))
      .toBeLessThan(19.999999999999996 * 0.005);
    // real build123d: test_boxes[10].volume == 60.0
    expect(Math.abs(measured["test_boxes[10]"].volume - 60.0))
      .toBeLessThan(60.0 * 0.005);
    // real build123d: test_boxes[11].volume == 18.0
    expect(Math.abs(measured["test_boxes[11]"].volume - 18.0))
      .toBeLessThan(18.0 * 0.005);
    // real build123d: test_boxes[12].volume == 627.0
    expect(Math.abs(measured["test_boxes[12]"].volume - 627.0))
      .toBeLessThan(627.0 * 0.005);
    // real build123d: test_boxes[13].volume == 1275.0
    expect(Math.abs(measured["test_boxes[13]"].volume - 1275.0))
      .toBeLessThan(1275.0 * 0.005);
    // real build123d: test_boxes[14].volume == 396.0
    expect(Math.abs(measured["test_boxes[14]"].volume - 396.0))
      .toBeLessThan(396.0 * 0.005);
    // real build123d: test_boxes[15].volume == 96.0
    expect(Math.abs(measured["test_boxes[15]"].volume - 96.0))
      .toBeLessThan(96.0 * 0.005);
    // real build123d: test_boxes[16].volume == 27.0
    expect(Math.abs(measured["test_boxes[16]"].volume - 27.0))
      .toBeLessThan(27.0 * 0.005);
    // real build123d: test_boxes[17].volume == 420.0
    expect(Math.abs(measured["test_boxes[17]"].volume - 420.0))
      .toBeLessThan(420.0 * 0.005);
    // real build123d: test_boxes[18].volume == 7.999999999999998
    expect(Math.abs(measured["test_boxes[18]"].volume - 7.999999999999998))
      .toBeLessThan(7.999999999999998 * 0.005);
    // real build123d: test_boxes[19].volume == 56.0
    expect(Math.abs(measured["test_boxes[19]"].volume - 56.0))
      .toBeLessThan(56.0 * 0.005);
    // real build123d: test_boxes[1].volume == 2.9999999999999996
    expect(Math.abs(measured["test_boxes[1]"].volume - 2.9999999999999996))
      .toBeLessThan(2.9999999999999996 * 0.005);
    // real build123d: test_boxes[20].volume == 156.0
    expect(Math.abs(measured["test_boxes[20]"].volume - 156.0))
      .toBeLessThan(156.0 * 0.005);
    // real build123d: test_boxes[21].volume == 99.99999999999997
    expect(Math.abs(measured["test_boxes[21]"].volume - 99.99999999999997))
      .toBeLessThan(99.99999999999997 * 0.005);
    // real build123d: test_boxes[22].volume == 280.0
    expect(Math.abs(measured["test_boxes[22]"].volume - 280.0))
      .toBeLessThan(280.0 * 0.005);
    // real build123d: test_boxes[23].volume == 680.0
    expect(Math.abs(measured["test_boxes[23]"].volume - 680.0))
      .toBeLessThan(680.0 * 0.005);
    // real build123d: test_boxes[24].volume == 340.00000000000006
    expect(Math.abs(measured["test_boxes[24]"].volume - 340.00000000000006))
      .toBeLessThan(340.00000000000006 * 0.005);
    // real build123d: test_boxes[25].volume == 585.0
    expect(Math.abs(measured["test_boxes[25]"].volume - 585.0))
      .toBeLessThan(585.0 * 0.005);
    // real build123d: test_boxes[26].volume == 95.99999999999999
    expect(Math.abs(measured["test_boxes[26]"].volume - 95.99999999999999))
      .toBeLessThan(95.99999999999999 * 0.005);
    // real build123d: test_boxes[27].volume == 39.99999999999999
    expect(Math.abs(measured["test_boxes[27]"].volume - 39.99999999999999))
      .toBeLessThan(39.99999999999999 * 0.005);
    // real build123d: test_boxes[28].volume == 31.999999999999993
    expect(Math.abs(measured["test_boxes[28]"].volume - 31.999999999999993))
      .toBeLessThan(31.999999999999993 * 0.005);
    // real build123d: test_boxes[29].volume == 216.0
    expect(Math.abs(measured["test_boxes[29]"].volume - 216.0))
      .toBeLessThan(216.0 * 0.005);
    // real build123d: test_boxes[2].volume == 9.0
    expect(Math.abs(measured["test_boxes[2]"].volume - 9.0))
      .toBeLessThan(9.0 * 0.005);
    // real build123d: test_boxes[30].volume == 288.0
    expect(Math.abs(measured["test_boxes[30]"].volume - 288.0))
      .toBeLessThan(288.0 * 0.005);
    // real build123d: test_boxes[31].volume == 153.0
    expect(Math.abs(measured["test_boxes[31]"].volume - 153.0))
      .toBeLessThan(153.0 * 0.005);
    // real build123d: test_boxes[32].volume == 918.0
    expect(Math.abs(measured["test_boxes[32]"].volume - 918.0))
      .toBeLessThan(918.0 * 0.005);
    // real build123d: test_boxes[33].volume == 1519.9999999999998
    expect(Math.abs(measured["test_boxes[33]"].volume - 1519.9999999999998))
      .toBeLessThan(1519.9999999999998 * 0.005);
    // real build123d: test_boxes[34].volume == 168.0
    expect(Math.abs(measured["test_boxes[34]"].volume - 168.0))
      .toBeLessThan(168.0 * 0.005);
    // real build123d: test_boxes[35].volume == 299.99999999999994
    expect(Math.abs(measured["test_boxes[35]"].volume - 299.99999999999994))
      .toBeLessThan(299.99999999999994 * 0.005);
    // real build123d: test_boxes[36].volume == 182.00000000000003
    expect(Math.abs(measured["test_boxes[36]"].volume - 182.00000000000003))
      .toBeLessThan(182.00000000000003 * 0.005);
    // real build123d: test_boxes[37].volume == 129.99999999999997
    expect(Math.abs(measured["test_boxes[37]"].volume - 129.99999999999997))
      .toBeLessThan(129.99999999999997 * 0.005);
    // real build123d: test_boxes[38].volume == 168.0
    expect(Math.abs(measured["test_boxes[38]"].volume - 168.0))
      .toBeLessThan(168.0 * 0.005);
    // real build123d: test_boxes[39].volume == 198.0
    expect(Math.abs(measured["test_boxes[39]"].volume - 198.0))
      .toBeLessThan(198.0 * 0.005);
    // real build123d: test_boxes[3].volume == 255.99999999999994
    expect(Math.abs(measured["test_boxes[3]"].volume - 255.99999999999994))
      .toBeLessThan(255.99999999999994 * 0.005);
    // real build123d: test_boxes[40].volume == 121.0
    expect(Math.abs(measured["test_boxes[40]"].volume - 121.0))
      .toBeLessThan(121.0 * 0.005);
    // real build123d: test_boxes[41].volume == 1425.0
    expect(Math.abs(measured["test_boxes[41]"].volume - 1425.0))
      .toBeLessThan(1425.0 * 0.005);
    // real build123d: test_boxes[42].volume == 120.0
    expect(Math.abs(measured["test_boxes[42]"].volume - 120.0))
      .toBeLessThan(120.0 * 0.005);
    // real build123d: test_boxes[43].volume == 342.0
    expect(Math.abs(measured["test_boxes[43]"].volume - 342.0))
      .toBeLessThan(342.0 * 0.005);
    // real build123d: test_boxes[44].volume == 81.0
    expect(Math.abs(measured["test_boxes[44]"].volume - 81.0))
      .toBeLessThan(81.0 * 0.005);
    // real build123d: test_boxes[45].volume == 221.0
    expect(Math.abs(measured["test_boxes[45]"].volume - 221.0))
      .toBeLessThan(221.0 * 0.005);
    // real build123d: test_boxes[46].volume == 17.999999999999996
    expect(Math.abs(measured["test_boxes[46]"].volume - 17.999999999999996))
      .toBeLessThan(17.999999999999996 * 0.005);
    // real build123d: test_boxes[47].volume == 12.0
    expect(Math.abs(measured["test_boxes[47]"].volume - 12.0))
      .toBeLessThan(12.0 * 0.005);
    // real build123d: test_boxes[48].volume == 364.0
    expect(Math.abs(measured["test_boxes[48]"].volume - 364.0))
      .toBeLessThan(364.0 * 0.005);
    // real build123d: test_boxes[49].volume == 112.0
    expect(Math.abs(measured["test_boxes[49]"].volume - 112.0))
      .toBeLessThan(112.0 * 0.005);
    // real build123d: test_boxes[4].volume == 34.0
    expect(Math.abs(measured["test_boxes[4]"].volume - 34.0))
      .toBeLessThan(34.0 * 0.005);
    // real build123d: test_boxes[5].volume == 156.0
    expect(Math.abs(measured["test_boxes[5]"].volume - 156.0))
      .toBeLessThan(156.0 * 0.005);
    // real build123d: test_boxes[6].volume == 48.0
    expect(Math.abs(measured["test_boxes[6]"].volume - 48.0))
      .toBeLessThan(48.0 * 0.005);
    // real build123d: test_boxes[7].volume == 1020.0
    expect(Math.abs(measured["test_boxes[7]"].volume - 1020.0))
      .toBeLessThan(1020.0 * 0.005);
    // real build123d: test_boxes[8].volume == 510.0
    expect(Math.abs(measured["test_boxes[8]"].volume - 510.0))
      .toBeLessThan(510.0 * 0.005);
    // real build123d: test_boxes[9].volume == 36.0
    expect(Math.abs(measured["test_boxes[9]"].volume - 36.0))
      .toBeLessThan(36.0 * 0.005);
  });

  // examples/clock — 2D vertex fillets (FilletFace2D) + PolarLocations + Text
  test("examples/clock", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\n\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\nclock_radius = 10\nwith BuildSketch() as minute_indicator:\n    with BuildLine() as outline:\n        l1 = CenterArc((0, 0), clock_radius * 0.975, 0.75, 4.5)\n        l2 = CenterArc((0, 0), clock_radius * 0.925, 0.75, 4.5)\n        Line(l1 @ 0, l2 @ 0)\n        Line(l1 @ 1, l2 @ 1)\n    make_face()\n    fillet(minute_indicator.vertices(), radius=clock_radius * 0.01)\n\nwith BuildSketch() as clock_face:\n    Circle(clock_radius)\n    with PolarLocations(0, 60):\n        add(minute_indicator.sketch, mode=Mode.SUBTRACT)\n    with PolarLocations(clock_radius * 0.875, 12):\n        SlotOverall(clock_radius * 0.05, clock_radius * 0.025, mode=Mode.SUBTRACT)\n    for hour in range(1, 13):\n        with PolarLocations(clock_radius * 0.75, 1, -hour * 30 + 90, 360, rotate=False):\n            Text(\n                str(hour),\n                font_size=clock_radius * 0.175,\n                font_style=FontStyle.BOLD,\n                mode=Mode.SUBTRACT,\n            )\n\nshow(clock_face)\n# [End]\n");
  });

  // general_examples/ex23 — revolve of pending sketches around Axis.X
  test("general_examples/ex23", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 23. Revolve\n# [Ex. 23]\npts = [\n    (-25, 35),\n    (-25, 0),\n    (-20, 0),\n    (-20, 5),\n    (-15, 10),\n    (-15, 35),\n]\n\nwith BuildPart() as ex23:\n    with BuildSketch(Plane.XZ) as ex23_sk:\n        with BuildLine() as ex23_ln:\n            l1 = Polyline(pts)\n            l2 = Line(l1 @ 1, l1 @ 0)\n        make_face()\n        with Locations((0, 35)):\n            Circle(25)\n        split(bisect_by=Plane.ZY)\n    revolve(axis=Axis.Z)\n    # [Ex. 23]\n# [removed by collect.py] write_svg()\n\n# show_object(ex23.part)\n");
    // real build123d: ex23.volume == 88619.09277001212
    expect(Math.abs(measured["ex23"].volume - 88619.09277001212))
      .toBeLessThan(88619.09277001212 * 0.005);
  });

  // general_examples/ex29 — classic OCC bottle: arcs, make_face orientation, offset(openings=)
  test("general_examples/ex29", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 29. The Classic OCC Bottle\n# [Ex. 29]\nL, w, t, b, h, n = 60.0, 18.0, 9.0, 0.9, 90.0, 6.0\n\nwith BuildPart() as ex29:\n    with BuildSketch(Plane.XY.offset(-b)) as ex29_ow_sk:\n        with BuildLine() as ex29_ow_ln:\n            l1 = Line((0, 0), (0, w / 2))\n            l2 = ThreePointArc(l1 @ 1, (L / 2.0, w / 2.0 + t), (L, w / 2.0))\n            l3 = Line(l2 @ 1, ((l2 @ 1).X, 0, 0))\n            mirror(ex29_ow_ln.line)\n        make_face()\n    extrude(amount=h + b)\n    fillet(ex29.edges(), radius=w / 6)\n    with BuildSketch(ex29.faces().sort_by(Axis.Z)[-1]):\n        Circle(t)\n    extrude(amount=n)\n    necktopf = ex29.faces().sort_by(Axis.Z)[-1]\n    offset(ex29.solids()[0], amount=-b, openings=necktopf)\n    # [Ex. 29]\n# [removed by collect.py] write_svg()\n\n# show_object(ex29.part)\n");
    // real build123d: ex29.volume == 15796.616314840601
    expect(Math.abs(measured["ex29"].volume - 15796.616314840601))
      .toBeLessThan(15796.616314840601 * 0.005);
  });

  // general_examples/ex35 — SlotCenterToCenter + SlotArc from raw arc edges
  test("general_examples/ex35", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 35. Slots\n# [Ex. 35]\nlength, width, thickness = 80.0, 60.0, 10.0\n\nwith BuildPart() as ex35:\n    Box(length, length, thickness)\n    topf = ex35.faces().sort_by(Axis.Z)[-1]\n    with BuildSketch(topf) as ex35_sk:\n        SlotCenterToCenter(width / 2, 10)\n        with BuildLine(mode=Mode.PRIVATE) as ex35_ln:\n            RadiusArc((-width / 2, 0), (0, width / 2), radius=width / 2)\n        SlotArc(arc=ex35_ln.edges()[0], height=thickness, rotation=0)\n        with BuildLine(mode=Mode.PRIVATE) as ex35_ln2:\n            RadiusArc((0, -width / 2), (width / 2, 0), radius=-width / 2)\n        SlotArc(arc=ex35_ln2.edges()[0], height=thickness, rotation=0)\n    extrude(amount=-thickness, mode=Mode.SUBTRACT)\n    # [Ex. 35]\n# [removed by collect.py] write_svg()\n\n# show_object(ex35.part)\n");
    // real build123d: ex35.volume == 49219.02754903829
    expect(Math.abs(measured["ex35"].volume - 49219.02754903829))
      .toBeLessThan(49219.02754903829 * 0.005);
  });

  // general_examples/ex36 — extrude(until=Until.NEXT) boolean trim
  test("general_examples/ex36", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 36. Extrude-Until\n# [Ex. 36]\nrad, rev = 6, 50\n\nwith BuildPart() as ex36:\n    with BuildSketch() as ex36_sk:\n        with Locations((0, rev)):\n            Circle(rad)\n    revolve(axis=Axis.X, revolution_arc=180)\n    with BuildSketch() as ex36_sk2:\n        Rectangle(rad, rev)\n    extrude(until=Until.NEXT)\n    # [Ex. 36]\n# [removed by collect.py] write_svg()\n\n# show_object(ex36.part)\n");
    // real build123d: ex36.volume == 30298.935241110394
    expect(Math.abs(measured["ex36"].volume - 30298.935241110394))
      .toBeLessThan(30298.935241110394 * 0.005);
  });

  // examples/boxes_on_faces — BuildSketch(*faces) with UV-derived Plane(face) x_dir
  test("examples/boxes_on_faces", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Imports]\nimport build123d as bd\n# [removed by collect.py] from ocp_vscode import *\n\n# [Code]\nwith bd.BuildPart() as bp:\n    bd.Box(3, 3, 3)\n    with bd.BuildSketch(*bp.faces()):\n        bd.Rectangle(1, 2, rotation=45)\n    bd.extrude(amount=0.1)\n\nassert abs(bp.part.volume - (3**3 + 6 * (1 * 2 * 0.1)) < 1e-3)\n\nif \"show_object\" in locals():\n    show_object(bp.part.wrapped, name=\"box on faces\")\n# [End]");
    // real build123d: bp.volume == 28.20000000000004
    expect(Math.abs(measured["bp"].volume - 28.20000000000004))
      .toBeLessThan(28.20000000000004 * 0.005);
  });

  // examples/maker_coin — DoubleTangentArc (scipy-family solver) + revolve + PolarLocations detents + project()+emboss
  test("examples/maker_coin", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\n# [Code]\n# Coin Parameters\ndiameter, thickness = 50 * MM, 10 * MM\n\nwith BuildPart() as maker_coin:\n    # On XZ plane draw the profile of half the coin\n    with BuildSketch(Plane.XZ) as profile:\n        with BuildLine() as outline:\n            l1 = Polyline((0, thickness * 0.6), (0, 0), ((diameter - thickness) / 2, 0))\n            l2 = JernArc(\n                start=l1 @ 1, tangent=l1 % 1, radius=thickness / 2, arc_size=300\n            )  # extend the arc beyond the intersection but not closed\n            l3 = DoubleTangentArc(l1 @ 0, tangent=(1, 0), other=l2)\n        make_face()  # make it a 2D shape\n    revolve()  # revolve 360\u00b0\n\n    # Pattern the detents around the coin\n    with BuildSketch() as detents:\n        with PolarLocations(radius=(diameter + 5) / 2, count=8):\n            Circle(thickness * 1.4 / 2)\n    extrude(amount=thickness, mode=Mode.SUBTRACT)  # cut away the detents\n\n    fillet(maker_coin.edges(Select.NEW), 2)  # fillet the cut edges\n\n    # Add an embossed label\n    with BuildSketch(Plane.XY.offset(thickness)) as label:  # above coin\n        Text(\"OS\", font_size=15)\n    project()  # label on top of coin\n    extrude(amount=-thickness / 5, mode=Mode.SUBTRACT)  # emboss label\n\nshow(maker_coin)\n# [End]\n");
    // real build123d: maker_coin.volume == 13160.217918773385
    expect(Math.abs(measured["maker_coin"].volume - 13160.217918773385))
      .toBeLessThan(13160.217918773385 * 0.005);
  });

  // examples/handle_algebra — exact tangent Splines + curve ^ u locations + MULTISECTION sweep (MakePipeShell)
  test("examples/handle_algebra", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\n\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show_object\n\nsegment_count = 6\n\n# Create a path for the sweep along the handle - added to pending_edges\nhandle_center_line = Spline(\n    (-10, 0, 0),\n    (0, 0, 5),\n    (10, 0, 0),\n    tangents=((0, 0, 1), (0, 0, -1)),\n    tangent_scalars=(1.5, 1.5),\n)\n\n# Create the cross sections - added to pending_faces\nsections = Sketch()\nfor i in range(segment_count + 1):\n    location = handle_center_line ^ (i / segment_count)\n    if i % segment_count == 0:\n        circle = location * Circle(1)\n    else:\n        circle = location * Rectangle(1.25, 3)\n        circle = fillet(circle.vertices(), radius=0.2)\n    sections += circle\n\n# Create the handle by sweeping along the path\nhandle = sweep(sections, path=handle_center_line, multisection=True)\n\nshow_object(handle_center_line, name=\"handle_path\")\nfor i, circle in enumerate(sections):\n    show_object(circle, name=\"section\" + str(i))\nshow_object(handle, name=\"handle\", options=dict(alpha=0.6))\n# [End]\n");
    // real build123d: handle.volume == 94.7736147223482
    expect(Math.abs(measured["handle"].volume - 94.7736147223482))
      .toBeLessThan(94.7736147223482 * 0.005);
  });

  // examples/custom_sketch_objects_algebra — Sketch subclasses + uniform scale (baked gp_Trsf) + offset lids
  test("examples/custom_sketch_objects_algebra", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from typing import Union\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\n\nclass Club(Sketch):\n    def __init__(\n        self,\n        height: float,\n        align: Union[Align, tuple[Align, Align]] = None,\n    ):\n        l0 = Line((0, -188), (76, -188))\n        b0 = Bezier(l0 @ 1, (61, -185), (33, -173), (17, -81))\n        b1 = Bezier(b0 @ 1, (49, -128), (146, -145), (167, -67))\n        b2 = Bezier(b1 @ 1, (187, 9), (94, 52), (32, 18))\n        b3 = Bezier(b2 @ 1, (92, 57), (113, 188), (0, 188))\n        club = l0 + b0 + b1 + b2 + b3\n        club += mirror(club, Plane.YZ)\n        club = make_face(club)\n        club = scale(club, height / club.bounding_box().size.Y)\n\n        super().__init__(club.wrapped)\n        # self._align(align)\n\n\nclass Spade(Sketch):\n    def __init__(\n        self,\n        height: float,\n        align: Union[Align, tuple[Align, Align]] = None,\n    ):\n        b0 = Bezier((0, 198), (6, 190), (41, 127), (112, 61))\n        b1 = Bezier(b0 @ 1, (242, -72), (114, -168), (11, -105))\n        b2 = Bezier(b1 @ 1, (31, -174), (42, -179), (53, -198))\n        l0 = Line(b2 @ 1, (0, -198))\n        spade = b0 + b1 + b2 + l0\n        spade += mirror(spade, Plane.YZ)\n        spade = make_face(spade)\n        spade = scale(spade, height / spade.bounding_box().size.Y)\n\n        super().__init__(spade.wrapped)\n        # self._align(align)\n\n\nclass Heart(Sketch):\n    def __init__(\n        self,\n        height: float,\n        align: Union[Align, tuple[Align, Align]] = None,\n    ):\n        b1 = Bezier((0, 146), (20, 169), (67, 198), (97, 198))\n        b2 = Bezier(b1 @ 1, (125, 198), (151, 186), (168, 167))\n        b3 = Bezier(b2 @ 1, (197, 133), (194, 88), (158, 31))\n        b4 = Bezier(b3 @ 1, (126, -13), (94, -48), (62, -95))\n        b5 = Bezier(b4 @ 1, (40, -128), (0, -198))\n        heart = b1 + b2 + b3 + b4 + b5\n        heart += mirror(heart, Plane.YZ)\n        heart = make_face(heart)\n        heart = scale(heart, height / heart.bounding_box().size.Y)\n\n        super().__init__(heart.wrapped)\n        # self._align(align)\n\n\nclass Diamond(Sketch):\n    def __init__(\n        self,\n        height: float,\n        align: Union[Align, tuple[Align, Align]] = None,\n    ):\n        diamond = Bezier((135, 0), (94, 69), (47, 134), (0, 198))\n        diamond += mirror(diamond, Plane.XZ)\n        diamond += mirror(diamond, Plane.YZ)\n        diamond = make_face(diamond)\n        diamond = scale(diamond, height / diamond.bounding_box().size.Y)\n\n        super().__init__(diamond.wrapped)\n        # self._align(align)\n\n\n# The inside of the box fits 2.5x3.5\" playing card deck with a small gap\npocket_w = 2.5 * IN + 2 * MM\npocket_l = 3.5 * IN + 2 * MM\npocket_t = 0.5 * IN + 2 * MM\nwall_t = 3 * MM  # Wall thickness\nbottom_t = wall_t / 2  # Top and bottom thickness\nlid_gap = 0.5 * MM  # Spacing between base and lid\nlip_t = wall_t / 2 - lid_gap / 2  # Lip thickness\n\n\nbox_plan = RectangleRounded(pocket_w + 2 * wall_t, pocket_l + 2 * wall_t, pocket_w / 15)\nbox = extrude(box_plan, amount=bottom_t + pocket_t / 2)\nbase_top = box.faces().sort_by(Axis.Z).last\nwalls = Plane(base_top) * offset(box_plan, -lip_t)\nbox += extrude(walls, amount=pocket_t / 2)\ntop = Plane.XY.offset(wall_t / 2) * offset(box_plan, -wall_t)\nbox -= extrude(top, amount=pocket_t)\n\n\npocket = extrude(box_plan, amount=pocket_t / 2 + bottom_t)\nlid_bottom = offset(box_plan, -(wall_t - lip_t))\npocket -= extrude(lid_bottom, amount=pocket_t / 2)\npocket = Pos(0, 0, (wall_t + pocket_t) / 2) * pocket\n\nplane = Plane(pocket.faces().sort_by().last)\nsuites = Pos(-0.3 * pocket_w, 0.3 * pocket_l) * Heart(pocket_l / 5)\nsuites += Pos(-0.3 * pocket_w, -0.3 * pocket_l) * Diamond(pocket_l / 5)\nsuites += Pos(0.3 * pocket_w, 0.3 * pocket_l) * Spade(pocket_l / 5)\nsuites += Pos(0.3 * pocket_w, -0.3 * pocket_l) * Club(pocket_l / 5)\nsuites = plane * suites\n\nlid = pocket - extrude(suites, dir=(0, 0, 1), amount=-wall_t)\n\nshow(box, lid, names=[\"box\", \"lid\"], alphas=[1.0, 0.6])\n");
    // real build123d: box.volume == 21485.21909241953
    expect(Math.abs(measured["box"].volume - 21485.21909241953))
      .toBeLessThan(21485.21909241953 * 0.005);
    // real build123d: lid.volume == 13597.407606122617
    expect(Math.abs(measured["lid"].volume - 13597.407606122617))
      .toBeLessThan(13597.407606122617 * 0.005);
  });

  // examples/key_cap — taper extrude + non-uniform scale + section() + inner_wires + extrude(until=Until.NEXT)
  test("examples/key_cap", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\n\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\nwith BuildPart() as key_cap:\n    # Start with the plan of the key cap and extrude it\n    with BuildSketch() as plan:\n        Rectangle(18 * MM, 18 * MM)\n    extrude(amount=10 * MM, taper=15)\n    # Create a dished top\n    with Locations((0, -3 * MM, 47 * MM)):\n        Sphere(40 * MM, mode=Mode.SUBTRACT, rotation=(90, 0, 0))\n    # Fillet all the edges except the bottom\n    fillet(\n        key_cap.edges().filter_by_position(Axis.Z, 0, 30 * MM, inclusive=(False, True)),\n        radius=1 * MM,\n    )\n    # Hollow out the key by subtracting a scaled version\n    scale(by=(0.925, 0.925, 0.85), mode=Mode.SUBTRACT)\n\n    # First find the size of the internal cavity at 4*MM\n    key_cap_section = section(key_cap.part, Plane.XY.offset(4 * MM)).face()\n    key_cap_internal_size = key_cap_section.inner_wires()[0].bounding_box().size\n\n    # Add supporting ribs while leaving room for switch activation\n    with BuildSketch(Plane(origin=(0, 0, 4 * MM))):\n        Rectangle(key_cap_internal_size.X, 0.5 * MM)\n        Rectangle(0.5 * MM, key_cap_internal_size.Y)\n        Circle(radius=5.5 * MM / 2)\n    # Extrude the mount and ribs to the key cap underside\n    extrude(until=Until.NEXT)\n    # Find the face on the bottom of the ribs to build onto\n    rib_bottom = key_cap.faces().filter_by_position(Axis.Z, 4 * MM, 4 * MM)[0]\n    # Add the switch socket\n    with BuildSketch(rib_bottom) as cruciform:\n        Circle(radius=5.5 * MM / 2)\n        Rectangle(4.1 * MM, 1.17 * MM, mode=Mode.SUBTRACT)\n        Rectangle(1.17 * MM, 4.1 * MM, mode=Mode.SUBTRACT)\n    extrude(amount=3.5 * MM, mode=Mode.ADD)\n\nassert abs(key_cap.part.volume - 644.8900473617498) < 1e-3\n\nshow(key_cap, alphas=[0.3])\n# [End]\n");
    // real build123d: key_cap.volume == 644.8900474026628
    expect(Math.abs(measured["key_cap"].volume - 644.8900474026628))
      .toBeLessThan(644.8900474026628 * 0.005);
  });

  // examples/stud_wall — RigidJoints as location algebra + copy.copy joint rebinding + connect_to repositioning
  test("examples/stud_wall", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import show\nfrom typing import Union\nimport copy\n\n\n# [Code]\nclass Stud(BasePartObject):\n    \"\"\"Part Object: Stud\n\n    Create a dimensional framing stud.\n\n    Args:\n        length (float): stud size\n        width (float): stud size\n        thickness (float): stud size\n        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0).\n        align (Union[Align, tuple[Align, Align, Align]], optional): align min, center,\n            or max of object. Defaults to (Align.CENTER, Align.CENTER, Align.MIN).\n        mode (Mode, optional): combine mode. Defaults to Mode.ADD.\n    \"\"\"\n\n    _applies_to = [BuildPart._tag]\n\n    def __init__(\n        self,\n        length: float = 8 * FT,\n        width: float = 3.5 * IN,\n        thickness: float = 1.5 * IN,\n        rotation: RotationLike = (0, 0, 0),\n        align: Union[None, Align, tuple[Align, Align, Align]] = (\n            Align.CENTER,\n            Align.CENTER,\n            Align.MIN,\n        ),\n        mode: Mode = Mode.ADD,\n    ):\n        self.length = length\n        self.width = width\n        self.thickness = thickness\n\n        # Create the basic shape\n        with BuildPart() as stud:\n            with BuildSketch():\n                RectangleRounded(thickness, width, 0.25 * IN)\n            extrude(amount=length)\n\n        # Create a Part object with appropriate alignment and rotation\n        super().__init__(part=stud.part, rotation=rotation, align=align, mode=mode)\n\n        # Add joints to the ends of the stud\n        RigidJoint(\"end0\", self, Location())\n        RigidJoint(\"end1\", self, Location((0, 0, length), (1, 0, 0), 180))\n\n\nclass StudWall(Compound):\n    \"\"\"StudWall\n\n    A simple stud wall assembly with top and sole plates.\n\n    Args:\n        length (float): wall length\n        depth (float, optional): stud width. Defaults to 3.5*IN.\n        height (float, optional): wall height. Defaults to 8*FT.\n        stud_spacing (float, optional): center-to-center. Defaults to 16*IN.\n        stud_thickness (float, optional): Defaults to 1.5*IN.\n    \"\"\"\n\n    def __init__(\n        self,\n        length: float,\n        depth: float = 3.5 * IN,\n        height: float = 8 * FT,\n        stud_spacing: float = 16 * IN,\n        stud_thickness: float = 1.5 * IN,\n    ):\n        # Create the object that will be used for top and sole plates\n        plate = Stud(\n            length,\n            depth,\n            rotation=(0, -90, 0),\n            align=(Align.MIN, Align.CENTER, Align.MAX),\n        )\n        # Define where studs will go on the plates\n        stud_locations = Pos(stud_thickness / 2, 0, stud_thickness) * GridLocations(\n            stud_spacing, 0, int(length / stud_spacing) + 1, 1, align=Align.MIN\n        )\n        stud_locations.append(Pos(length - stud_thickness / 2, 0, stud_thickness))\n\n        # Create a single stud that will be copied for efficiency\n        stud = Stud(height - 2 * stud_thickness, depth, stud_thickness)\n\n        # For efficiency studs in the walls are copies with their own position\n        studs = []\n        for i, loc in enumerate(stud_locations):\n            stud_joint = RigidJoint(f\"stud{i}\", plate, loc)\n            stud_copy = copy.copy(stud)\n            stud_joint.connect_to(stud_copy.joints[\"end0\"])\n            studs.append(stud_copy)\n        top_plate = copy.copy(plate)\n        sole_plate = copy.copy(plate)\n\n        # Position the top plate relative to the top of the first stud\n        studs[0].joints[\"end1\"].connect_to(top_plate.joints[\"stud0\"])\n\n        # Build the assembly of parts\n        super().__init__(children=[top_plate, sole_plate] + studs)\n\n        # Add joints to the wall\n        RigidJoint(\"inside0\", self, Location((depth / 2, depth / 2, 0), (0, 0, 1), 90))\n        RigidJoint(\"end0\", self, Location())\n\n\nx_wall = StudWall(13 * FT)\ny_wall = StudWall(9 * FT)\nx_wall.joints[\"inside0\"].connect_to(y_wall.joints[\"end0\"])\n\nshow(x_wall, y_wall, render_joints=False)\n# [End]\n");
    // real build123d: x_wall.volume == 113679138.17586128
    expect(Math.abs(measured["x_wall"].volume - 113679138.17586128))
      .toBeLessThan(113679138.17586128 * 0.005);
    // real build123d: y_wall.volume == 81746795.99163055
    expect(Math.abs(measured["y_wall"].volume - 81746795.99163055))
      .toBeLessThan(81746795.99163055 * 0.005);
  });


  // examples/canadian_flag — surface-from-points (GeomAPI_PointsToBSplineSurface
  // via Handle_Geom_BSplineSurface.AsGeomSurface), projection onto the wavy
  // surface, per-variable bbox parity with real build123d
  test("examples/canadian_flag", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Imports]\nfrom math import sin, cos, pi\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show_object, show, show_all\n\n# [Parameters]\n# Canadian Flags have a 2:1 aspect ratio\nheight = 50\nwidth = 2 * height\nwave_amplitude = 3\n\n# [Code]\n\n\ndef surface(amplitude, u, v):\n    \"\"\"Calculate the surface displacement of the flag at a given position\"\"\"\n    return v * amplitude / 20 * cos(3.5 * pi * u) + amplitude / 10 * v * sin(\n        1.1 * pi * v\n    )\n\n\n# Note that the surface to project on must be a little larger than the faces\n# being projected onto it to create valid projected faces\nthe_wind = Face.make_surface_from_array_of_points(\n    [\n        [\n            Vector(\n                width * (v * 1.1 / 40 - 0.05),\n                height * (u * 1.2 / 40 - 0.1),\n                height * surface(wave_amplitude, u / 40, v / 40) / 2,\n            )\n            for u in range(41)\n        ]\n        for v in range(41)\n    ]\n)\nwith BuildSketch(Plane.XY.offset(10)) as west_field_builder:\n    Rectangle(width / 4, height, align=(Align.MIN, Align.MIN))\nwest_field_planar = west_field_builder.sketch.faces()[0]\neast_field_planar = west_field_planar.mirror(Plane.YZ.offset(width / 2))\n\nwith BuildSketch(Plane((width / 2, 0, 10))) as center_field_builder:\n    Rectangle(width / 2, height, align=(Align.CENTER, Align.MIN))\n    with BuildLine() as outline:\n        l1 = Polyline((0.0000, 0.0771), (0.0187, 0.0771), (0.0094, 0.2569))\n        l2 = Polyline((0.0325, 0.2773), (0.2115, 0.2458), (0.1873, 0.3125))\n        RadiusArc(l1 @ 1, l2 @ 0, 0.0271)\n        l3 = Polyline((0.1915, 0.3277), (0.3875, 0.4865), (0.3433, 0.5071))\n        TangentArc(l2 @ 1, l3 @ 0, tangent=l2 % 1)\n        l4 = Polyline((0.3362, 0.5235), (0.375, 0.6427), (0.2621, 0.6188))\n        SagittaArc(l3 @ 1, l4 @ 0, 0.003)\n        l5 = Polyline((0.2469, 0.6267), (0.225, 0.6781), (0.1369, 0.5835))\n        ThreePointArc(l4 @ 1, (l4 @ 1 + l5 @ 0) * 0.5 + Vector(-0.002, -0.002), l5 @ 0)\n        l6 = Polyline((0.1138, 0.5954), (0.1562, 0.8146), (0.0881, 0.7752))\n        Spline(\n            l5 @ 1,\n            l6 @ 0,\n            tangents=(l5 % 1, l6 % 0),\n            tangent_scalars=(2, 2),\n        )\n        l7 = Line((0.0692, 0.7808), (0.0000, 0.9167))\n        TangentArc(l6 @ 1, l7 @ 0, tangent=l6 % 1)\n        mirror(about=Plane.YZ)\n        scale(by=height)\n    maple_leaf_planar = make_face(mode=Mode.SUBTRACT).face()\n\nmaple_leaf_planar.position += (width / 2, 0, 10)  # Created on local Plane.XY\ncenter_field_planar = center_field_builder.sketch.faces()[0]\n\nwest_field = west_field_planar.project_to_shape(the_wind, (0, 0, -1))[0]\nwest_field.color = Color(\"red\")\neast_field = east_field_planar.project_to_shape(the_wind, (0, 0, -1))[0]\neast_field.color = Color(\"red\")\ncenter_field = center_field_planar.project_to_shape(the_wind, (0, 0, -1))[0]\ncenter_field.color = Color(\"white\")\nmaple_leaf = maple_leaf_planar.project_to_shape(the_wind, (0, 0, -1))[0]\nmaple_leaf.color = Color(\"red\")\n\ncanadian_flag = Compound(children=[west_field, east_field, center_field, maple_leaf])\nshow(Rot(90, 0, 0) * canadian_flag)\n# [End]\n");
    // real build123d bboxes (harness tolerance: 1e-3 per axis)
    const expected = {
      "the_wind": [-5.0, -5.0, -6.0737848329, 105.0, 55.0, 6.2444043552],
      "maple_leaf": [30.625, 3.855, 1.4673525215, 69.375, 45.835, 6.2439667576],
    };
    for (const [name, bbox] of Object.entries(expected)) {
      for (let i = 0; i < 6; i++) {
        expect(Math.abs(measured[name].bbox[i] - bbox[i])).toBeLessThan(1e-3);
      }
    }
  });


  // examples/platonic_solids — scipy ConvexHull shim (bundled quickhull3d),
  // Solid(Shell(faces)) sewing, user BasePartObject subclass
  test("examples/platonic_solids", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\nfrom build123d import *\nfrom math import sqrt\nfrom typing import Union, Literal\nfrom scipy.spatial import ConvexHull\n\n# [removed by collect.py] from ocp_vscode import show\n\nPHI = (1 + sqrt(5)) / 2  # The Golden Ratio\n\n\nclass PlatonicSolid(BasePartObject):\n    \"\"\"Part Object: Platonic Solid\n\n    Create one of the five convex Platonic solids.\n\n    Args:\n        face_count (Literal[4,6,8,12,20]): number of faces\n        diameter (float): double distance to vertices, i.e. maximum size\n        rotation (RotationLike, optional): angles to rotate about axes. Defaults to (0, 0, 0).\n        align (Union[None, Align, tuple[Align, Align, Align]], optional): align min, center,\n            or max of object. Defaults to None.\n        mode (Mode, optional): combine mode. Defaults to Mode.ADD.\n    \"\"\"\n\n    tetrahedron_vertices = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]\n\n    cube_vertices = [(i, j, k) for i in [-1, 1] for j in [-1, 1] for k in [-1, 1]]\n\n    octahedron_vertices = (\n        [(i, 0, 0) for i in [-1, 1]]\n        + [(0, i, 0) for i in [-1, 1]]\n        + [(0, 0, i) for i in [-1, 1]]\n    )\n\n    dodecahedron_vertices = (\n        [(i, j, k) for i in [-1, 1] for j in [-1, 1] for k in [-1, 1]]\n        + [(0, i / PHI, j * PHI) for i in [-1, 1] for j in [-1, 1]]\n        + [(i / PHI, j * PHI, 0) for i in [-1, 1] for j in [-1, 1]]\n        + [(i * PHI, 0, j / PHI) for i in [-1, 1] for j in [-1, 1]]\n    )\n\n    icosahedron_vertices = (\n        [(0, i, j * PHI) for i in [-1, 1] for j in [-1, 1]]\n        + [(i, j * PHI, 0) for i in [-1, 1] for j in [-1, 1]]\n        + [(i * PHI, 0, j) for i in [-1, 1] for j in [-1, 1]]\n    )\n\n    vertices_lookup = {\n        4: tetrahedron_vertices,\n        6: cube_vertices,\n        8: octahedron_vertices,\n        12: dodecahedron_vertices,\n        20: icosahedron_vertices,\n    }\n    _applies_to = [BuildPart._tag]\n\n    def __init__(\n        self,\n        face_count: Literal[4, 6, 8, 12, 20],\n        diameter: float = 1.0,\n        rotation: RotationLike = (0, 0, 0),\n        align: Union[None, Align, tuple[Align, Align, Align]] = None,\n        mode: Mode = Mode.ADD,\n    ):\n        try:\n            platonic_vertices = PlatonicSolid.vertices_lookup[face_count]\n        except KeyError:\n            raise ValueError(\n                f\"face_count must be one of 4, 6, 8, 12, or 20 not {face_count}\"\n            )\n\n        # Create a convex hull from the vertices\n        hull = ConvexHull(platonic_vertices).simplices.tolist()\n\n        # Create faces from the vertex indices\n        platonic_faces = []\n        for face_vertex_indices in hull:\n            corner_vertices = [platonic_vertices[i] for i in face_vertex_indices]\n            platonic_faces.append(Face(Wire.make_polygon(corner_vertices)))\n\n        # Create the solid from the Faces\n        platonic_solid = Solid(Shell(platonic_faces)).clean()\n\n        # By definition, all vertices are the same distance from the origin so\n        # scale proportionally to this distance\n        platonic_solid = platonic_solid.scale(\n            (diameter / 2) / Vector(platonic_solid.vertices()[0]).length\n        )\n\n        super().__init__(part=platonic_solid, rotation=rotation, align=align, mode=mode)\n\n\nsolids = [\n    Rot(0, 0, 72 * i) * Pos(1, 0, 0) * PlatonicSolid(faces)\n    for i, faces in enumerate([4, 6, 8, 12, 20])\n]\nshow(solids)\n\n# [End]\n");
    // real build123d: unit-edge platonic solid volumes
    const volumes = [0.3481454829, 0.1666666667, 0.3170188388, 0.1924500897, 0.0641500299];
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(measured[`solids[${i}]`].volume - volumes[i]))
        .toBeLessThan(volumes[i] * 0.005);
    }
  });


  // examples/tea_cup_algebra — offset shells, multisection sweep handle,
  // loft/thicken pipeline that used to fault the wasm kernel outright
  test("examples/tea_cup_algebra", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\n\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\nwall_thickness = 3 * MM\nfillet_radius = wall_thickness * 0.49\n\n# Create the bowl of the cup as a revolved cross section\n\n# Start & end points with control tangents\ns = Spline(\n    (30 * MM, 10 * MM),\n    (69 * MM, 105 * MM),\n    tangents=((1, 0.5), (0.7, 1)),\n    tangent_scalars=(1.75, 1),\n)\n# Lines to finish creating \u00bd the bowl shape\ns += Polyline(s @ 0, s @ 0 + (10 * MM, -10 * MM), (0, 0), (0, (s @ 1).Y), s @ 1)\nbowl_section = Plane.XZ * make_face(s)  # Create a filled 2D shape\ntea_cup = revolve(bowl_section, axis=Axis.Z)\n\n# Hollow out the bowl with openings on the top and bottom\ntea_cup = offset(\n    tea_cup, -wall_thickness, openings=tea_cup.faces().filter_by(GeomType.PLANE)\n)\n\n# Add a bottom to the bowl\ntea_cup += Pos(0, 0, (s @ 0).Y) * Cylinder(radius=(s @ 0).X, height=wall_thickness)\n\n# Smooth out all the edges\ntea_cup = fillet(tea_cup.edges(), radius=fillet_radius)\n\n# Determine where the handle contacts the bowl\nhandle_intersections = [\n    tea_cup.find_intersection_points(\n        Axis(origin=(0, 0, vertical_offset), direction=(1, 0, 0))\n    )[-1][0]\n    for vertical_offset in [35 * MM, 80 * MM]\n]\n\n# Create a path for handle creation\npath_spline = Spline(\n    handle_intersections[0] - (wall_thickness / 2, 0, 0),\n    handle_intersections[0] + (35 * MM, 0, 30 * MM),\n    handle_intersections[0] + (40 * MM, 0, 60 * MM),\n    handle_intersections[1] - (wall_thickness / 2, 0, 0),\n    tangents=((1, 0, 1.25), (-0.2, 0, -1)),\n)\n\n# Align the cross section to the beginning of the path\nlocation = path_spline ^ 0\nhandle_cross_section = location * RectangleRounded(wall_thickness, 8 * MM, fillet_radius)\n\n# Sweep handle cross section along path\ntea_cup += sweep(handle_cross_section, path=path_spline)\n\n# assert abs(tea_cup.part.volume - 130326.77052487945) < 1e-3\n\nshow(tea_cup, names=[\"tea cup\"])\n# [End]\n");
    // real build123d: tea_cup.volume == 130326.75447606308
    expect(Math.abs(measured["tea_cup"].volume - 130326.75447606308))
      .toBeLessThan(130326.75447606308 * 0.005);
    const bbox = [-67.7762442353, -67.7762446391, 0.0, 101.6138783918, 67.7762446391, 105.0];
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(measured["tea_cup"].bbox[i] - bbox[i])).toBeLessThan(1e-3);
    }
  });


  // general_examples_algebra/ex34 — embossed/debossed text fused onto a box
  // face: per-glyph +Z text normals and the general-fuse fallback for the
  // 8.0.1 coplanar-fuse operand-drop fault
  test("general_examples_algebra/ex34", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# 34. Embossed and Debossed Text\n# [Ex. 34]\nlength, width, thickness, fontsz, fontht = 80.0, 60.0, 10.0, 25.0, 4.0\n\nex34 = Box(length, width, thickness)\nplane = Plane(ex34.faces().sort_by().last)\nex34_sk = plane * Text(\"Hello\", font_size=fontsz, align=(Align.CENTER, Align.MIN))\nex34 += extrude(ex34_sk, amount=fontht)\nex34_sk2 = plane * Text(\"World\", font_size=fontsz, align=(Align.CENTER, Align.MAX))\nex34 -= extrude(ex34_sk2, amount=-fontht)\n# [Ex. 34]\n# show_object(ex34)\n");
    // real build123d: ex34.volume == 47754.582611832375
    expect(Math.abs(measured["ex34"].volume - 47754.582611832375))
      .toBeLessThan(47754.582611832375 * 0.005);
    // embossed "Hello" must rise ABOVE the box top (z=5 -> 9), debossed
    // "World" must not push below it (the logo-regression failure mode)
    expect(Math.abs(measured["ex34"].bbox[5] - 9.0)).toBeLessThan(1e-3);
    expect(Math.abs(measured["ex34"].bbox[2] - (-5.0))).toBeLessThan(1e-3);
  });


  // examples/bracelet - Gordon curve-network surface (point guides), surface
  // location_at + wire projection, sweep of the tip's flat face along an
  // elliptical arc, mirrored tips and alignment holes
  test("examples/bracelet", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\n# Define input parameters\n# - radii: ellipse radii (X, Y) controlling the bracelet centerline shape\n# - width: bracelet width (along Z for the center sweep)\n# - thickness: bracelet thickness (radial thickness of the cross section)\n# - opening_angle: the missing angle that creates the wrist opening\n# - label_str: optional text to emboss on the outside surface\n# - Define input parameters\n# radii, width, thickness, opening_angle, label_str = (45, 30), 25, 5, 80, \"build123d\"\nradii, width, thickness, opening_angle, label_str = (45, 30), 25, 5, 80, \"\"\n\n# Step 1: Create an elliptical arc defining the *centerline* of the bracelet.\n# The arc is truncated to leave an opening (the \"gap\" where the bracelet goes on).\n# Angles are in degrees; 270\u00b0 points downward, which keeps the opening centered at the bottom.\ncenter_arc = EllipticalCenterArc(\n    (0, 0), *radii, 270 + opening_angle / 2, arc_size=360 - opening_angle\n)\n\n# Step 2: Create HALF of the end cross-section, positioned at the end of the arc.\n# We build only half so we can later mirror it to enforce symmetry and reduce\n# curve-network complexity when building the freeform tip.\n#\n# location_at(1) returns a local coordinate frame at the arc end (tangent-aware).\n# x_dir is chosen so the section\u2019s local \"X\" is well-defined and stable.\nend_center_arc = center_arc.location_at(1, x_dir=(0, 0, 1))\nhalf_x_section = EllipticalCenterArc(\n    (0, 0), width / 2, thickness / 2, 90, arc_size=180\n).locate(end_center_arc)\n\n# Step 3: Create a doubly-curved \"tip edge\" curve.\n# The tip edge must live in 3D and conform to the outside of the bracelet.\n# To do that, we:\n#   1) create a surface by extruding the center_arc into a sheet (a ribbon surface)\n#   2) build a planar arc in a local frame at the end of that surface\n#   3) project the planar arc onto the curved surface to get a true 3D curve\n#\n# The resulting tip_arc is a 3D edge that naturally matches the bracelet curvature.\ncenter_surface = -Face.extrude(center_arc, (0, 0, 2 * width)).moved(\n    Location((0, 0, -width), (0, 0, 180))\n)\ntip_center_loc = -center_surface.location_at(center_arc @ 1, x_dir=(1, 0, 0))\nnormal_at_tip_center = tip_center_loc.z_axis.direction\n\n# A planar arc that would represent the outer boundary of the tip *if* the surface\n# were flat. We immediately project it to make it truly conformal in 3D.\nplanar_tip_arc = CenterArc((0, 0), width / 2, 270, 180).locate(tip_center_loc).edge()\ntip_arc = planar_tip_arc.project_to_shape(center_surface, -normal_at_tip_center)[0]\n\n# Step 4: Build the tip as a Gordon surface (a surface fit through a curve network).\n# Gordon surfaces are ideal when:\n#   - you don\u2019t have an obvious analytic surface\n#   - curvature changes in two directions (doubly-curved \"cap\")\n#   - you can define a consistent set of profile curves + guide curves\n#\n# Here:\n#   - profiles define \"across the tip\" shape (section -> bulged spline -> mirrored section)\n#   - guides define \"along the tip\" rails (start point -> projected 3D arc -> end point)\n#\n# Tangents are used to encourage smoothness where the tip joins the swept center section.\nprofile = Spline(\n    half_x_section @ 0,\n    tip_arc @ 0.5,\n    half_x_section @ 1,\n    tangents=(center_arc % 1, -(center_arc % 1)),\n)\ntip_surface = Face.make_gordon_surface(\n    profiles=[half_x_section, profile, half_x_section.mirror(Plane.XY)],\n    guides=[half_x_section @ 0, tip_arc, half_x_section @ 1],\n)\n\n# Step 5: Close the tip surface into a watertight Solid.\n# tip_surface is the outer \"skin\"; we create a side face from its boundary wire\n# and make a shell, then a solid.\ntip_side = Face(tip_surface.wire())\ntip = Solid(Shell([tip_side, tip_surface]))\n\n# Step 6: Sweep the *flat end face* of the tip around the center arc.\n# This is the trick that makes the center section compatible with the freeform tip:\n# the sweep profile is the same face that bounds the tip, so the join is naturally aligned.\ncenter_section = sweep(tip_side, center_arc).solid()\n\n# Step 7: Assemble the bracelet from the center and two mirrored tips.\n# Mirror across YZ to create the opposite end cap.\nbracelet = Solid() + [tip, center_section, tip.mirror(Plane.YZ)]\n\n# Step 8: Add an embossed label.\n# This is often the hardest operation for OCCT in this model:\n# projecting text onto a doubly-curved surface can create many small faces/edges,\n# and thickening them adds even more boolean complexity.\nif label_str:\n    label = Text(label_str, font_size=width * 0.8, align=Align.CENTER)\n\n    # Project the text onto the bracelet using a path-based placement along center_arc.\n    # The parameter offsets the label so it sits centered along arc-length.\n    p_labels = bracelet.project_faces(\n        label, center_arc, 0.5 - 0.5 * (label.bounding_box().size.X) / center_arc.length\n    )\n    # Turn the projected faces into solids via thickening (embossing).\n    embossed_label = [Solid.thicken(f, 0.5) for f in p_labels.faces()]\n    bracelet += embossed_label\n\n# Step 9: Add alignment holes to aid assembly after 3D printing in two halves.\n# These are placed at evenly spaced locations along the arc (including both ends).\n# A small clearance (+0.15) is included for typical FDM tolerances.\nalignment_holes = [\n    Pos(p) * Cylinder(1.75 / 2 + 0.15, 8)\n    for p in [center_arc.position_at(i / 4) for i in range(5)]\n]\nbracelet -= alignment_holes\n\nshow(bracelet)\n# [End]\n");
    // real build123d: bracelet.volume == 18972.11597109143
    expect(Math.abs(measured["bracelet"].volume - 18972.11597109143))
      .toBeLessThan(18972.11597109143 * 0.005);
    const bbox = [-47.5000068068, -28.4290724178, -12.5000001, 47.5000068068, 32.5000001, 12.5000001];
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(measured["bracelet"].bbox[i] - bbox[i])).toBeLessThan(1e-3);
    }
    // the Gordon tip surface itself (realization accuracy)
    expect(Math.abs(measured["tip_surface"].area - 540.9747242723))
      .toBeLessThan(540.9747242723 * 0.005);
  });


  // examples/bicycle_tire - wrap_faces: a flat tread pattern conformed onto
  // the tire's surface of revolution, thickened into nubs and copied around
  test("examples/bicycle_tire", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Code]\nimport copy\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import show\n\nwheel_diameter = 740 * MM\n\nwith BuildSketch() as tire_profile:\n    with BuildLine() as build_profile:\n        l00 = Bezier((0.0, 0.0), (7.05, 0.0), (12.18, 1.54), (15.13, 4.54))\n        l01 = Bezier(l00 @ 1, (15.81, 5.22), (15.98, 5.44), (16.5, 6.23))\n        l02 = Bezier(l01 @ 1, (18.45, 9.19), (19.61, 13.84), (19.94, 20.06))\n        l03 = Bezier(l02 @ 1, (20.1, 23.24), (19.93, 27.48), (19.56, 29.45))\n        l04 = Bezier(l03 @ 1, (19.13, 31.69), (18.23, 33.67), (16.91, 35.32))\n        l05 = Bezier(l04 @ 1, (16.26, 36.12), (15.57, 36.77), (14.48, 37.58))\n        l06 = Bezier(l05 @ 1, (12.77, 38.85), (11.51, 40.28), (10.76, 41.78))\n        l07 = Bezier(l06 @ 1, (10.07, 43.16), (10.15, 43.81), (11.03, 43.98))\n        l08 = Bezier(l07 @ 1, (11.82, 44.13), (12.15, 44.55), (12.08, 45.33))\n        l09 = Bezier(l08 @ 1, (12.01, 46.07), (11.84, 46.43), (11.43, 46.69))\n        l10 = Bezier(l09 @ 1, (10.98, 46.97), (10.07, 46.7), (9.47, 46.1))\n        l11 = Bezier(l10 @ 1, (9.03, 45.65), (8.88, 45.31), (8.84, 44.65))\n        l12 = Bezier(l11 @ 1, (8.78, 43.6), (9.11, 42.26), (9.72, 41.0))\n        l13 = Bezier(l12 @ 1, (10.43, 39.54), (11.52, 38.2), (12.78, 37.22))\n        l14 = Bezier(l13 @ 1, (15.36, 35.23), (16.58, 33.76), (17.45, 31.62))\n        l15 = Bezier(l14 @ 1, (17.91, 30.49), (18.22, 29.27), (18.4, 27.8))\n        l16 = Bezier(l15 @ 1, (18.53, 26.78), (18.52, 23.69), (18.37, 22.61))\n        l17 = Bezier(l16 @ 1, (17.8, 18.23), (16.15, 14.7), (13.39, 11.94))\n        l18 = Bezier(l17 @ 1, (11.89, 10.45), (10.19, 9.31), (8.09, 8.41))\n        l19 = Bezier(l18 @ 1, (3.32, 6.35), (0.0, 6.64))\n        mirror(about=Plane.YZ)\n    make_face()\n\ntire = revolve(Pos(Y=-wheel_diameter / 2) * tire_profile.face(), Axis.X)\n\nwith BuildSketch() as tread_pattern:\n    with Locations((1, 1)):\n        Trapezoid(15, 12, 60, 120, align=Align.MIN)\n    with Locations((1, 8)):\n        with GridLocations(0, 5, 1, 2):\n            Rectangle(50, 2, mode=Mode.SUBTRACT)\n\n# Define the surface and path that the tread pattern will be wrapped onto\nhalf_road_surface = Face.revolve(Pos(Y=-wheel_diameter / 2) * l00, 360, Axis.X)\ntread_path = half_road_surface.edges().sort_by(Axis.X)[0]\n\n# Wrap the planar tread pattern onto the tire's outside surface\ntread_faces = half_road_surface.wrap_faces(tread_pattern.faces(), tread_path)\n\n# Mirror the faces to the other half of the tire\ntread_faces.extend([mirror(t, Plane.YZ) for t in tread_faces])\n\n# Thicken the tread to become solid nubs\n# tread_prime = [Solid.thicken(f, 3 * MM) for f in tread_faces]\ntread_prime = [thicken(f, 3 * MM) for f in tread_faces]\n\n# Copy the nubs around the whole tire\ntread = [Rot(X=r) * copy.copy(t) for t in tread_prime for r in range(0, 360, 2)]\n\nshow(tire, tread)\n# [End]\n");
    // real build123d: tire.volume == 906269.1100540357
    expect(Math.abs(measured["tire"].volume - 906269.1100540357))
      .toBeLessThan(906269.1100540357 * 0.005);
    // the three wrapped tread faces
    const wrapped = [12.228202995761057, 24.30283196548578, 28.299963439775834];
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(measured[`tread_faces[${i}]`].area - wrapped[i]))
        .toBeLessThan(wrapped[i] * 0.005);
    }
    // thickened nub + one of the 64 rotated copies
    expect(Math.abs(measured["tread_prime[0]"].volume - 40.275611681727014))
      .toBeLessThan(40.275611681727014 * 0.005);
    expect(Math.abs(measured["tread[0]"].volume - 88.53291874220363))
      .toBeLessThan(88.53291874220363 * 0.005);
  });


  // one-sided line offsets (offset(side=Side.LEFT/RIGHT)) - the operation
  // examples/dual_color_3mf is built on; values from real build123d 0.11.1
  test("offset(side=) on open lines", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n\n# One-sided offsets of an OPEN line: keep the LEFT / RIGHT side of the offset\n# and close it back onto the original line (build123d offset(side=...)).\nwith BuildSketch() as left_band:\n    with BuildLine():\n        Polyline((0, 0), (10, 0), (10, 6))\n        offset(amount=2, side=Side.LEFT)\n    make_face()\n\nwith BuildSketch() as right_band:\n    with BuildLine():\n        Polyline((0, 0), (10, 0), (10, 6))\n        offset(amount=2, side=Side.RIGHT)\n    make_face()\n\n# The pattern examples/dual_color_3mf builds with it\nwith BuildSketch() as tile_pattern:\n    with BuildLine():\n        Polyline((9, 9), (1, 5), (-0.5, 0))\n        offset(amount=1, side=Side.LEFT)\n    make_face()\n");
    // real build123d: 28.0 (inner band) and 35.141592653589793 (outer band)
    expect(Math.abs(measured["left_band"].area - 28.0)).toBeLessThan(28.0 * 0.005);
    expect(Math.abs(measured["right_band"].area - 35.141592653589793))
      .toBeLessThan(35.141592653589793 * 0.005);
    // real build123d: 13.732352941176471 for the dual_color_3mf tile pattern
    expect(Math.abs(measured["tile_pattern"].area - 13.732352941176471))
      .toBeLessThan(13.732352941176471 * 0.005);
  });


  // ------------------------------------------------------------------
  // Broadened corpus (docs .py scripts, the Too Tall Toby challenge
  // parts and docs .rst code-blocks) - frozen when they first passed.
  // ------------------------------------------------------------------

  // ttt/ttt-ppp0101 — Too Tall Toby PPP01-01 bearing bracket: PolarLine(length_mode=VERTICAL), split, mirror, CounterBoreHole - the script's own mass assert is part of the test
  test("ttt/ttt-ppp0101", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\nwith BuildPart() as p:\n    with BuildSketch() as s:\n        Rectangle(115, 50)\n        with Locations((5 / 2, 0)):\n            SlotOverall(90, 12, mode=Mode.SUBTRACT)\n    extrude(amount=15)\n\n    with BuildSketch(Plane.XZ.offset(50 / 2)) as s3:\n        with Locations((-115 / 2 + 26, 15)):\n            SlotOverall(42 + 2 * 26 + 12, 2 * 26, rotation=90)\n    zz = extrude(amount=-12)\n    split(bisect_by=Plane.XY)\n    edgs = p.part.edges().filter_by(Axis.Y).group_by(Axis.X)[-2]\n    fillet(edgs, 9)\n\n    with Locations(zz.faces().sort_by(Axis.Y)[0]):\n        with Locations((42 / 2 + 6, 0)):\n            CounterBoreHole(24 / 2, 34 / 2, 4)\n    mirror(about=Plane.XZ)\n\n    with BuildSketch() as s4:\n        RectangleRounded(115, 50, 6)\n    extrude(amount=80, mode=Mode.INTERSECT)\n    # fillet does not work right, mode intersect is safer\n\n    with BuildSketch(Plane.YZ) as s4:\n        with BuildLine() as bl:\n            l1 = Line((0, 0), (18 / 2, 0))\n            l2 = PolarLine(l1 @ 1, 8, 60, length_mode=LengthMode.VERTICAL)\n            l3 = Line(l2 @ 1, (0, 8))\n            mirror(about=Plane.YZ)\n        make_face()\n    extrude(amount=115/2, both=True, mode=Mode.SUBTRACT)\n\nshow_object(p)\n\n\ngot_mass = p.part.volume*densa\nwant_mass = 797.15\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f'{got_mass=}, {want_mass=}, {delta=}, {tolerance=}'\n");
    // real build123d: p.volume == 102198.22251481404
    expect(Math.abs(measured["p"].volume - 102198.22251481404))
      .toBeLessThan(102198.22251481404 * 0.005);
    // real build123d: zz.volume == 59180.599605920404
    expect(Math.abs(measured["zz"].volume - 59180.599605920404))
      .toBeLessThan(59180.599605920404 * 0.005);
  });

  // ttt/ttt-ppp0102 — Too Tall Toby PPP01-02: PolarLine(length_mode=) + sweep(path=<BuildLine>)
  test("ttt/ttt-ppp0102", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\n\n# TTT Party Pack 01: PPP0102, mass(abs) = 43.09g\nwith BuildPart() as p:\n    with BuildSketch(Plane.XZ) as sk1:\n        Rectangle(49, 48 - 8, align=(Align.CENTER, Align.MIN))\n        Rectangle(9, 48, align=(Align.CENTER, Align.MIN))\n        with Locations((9 / 2, 40)):\n            Ellipse(20, 8)\n        split(bisect_by=Plane.YZ)\n    revolve(axis=Axis.Z)\n\n    with BuildSketch(Plane.YZ.offset(-15)) as xc1:\n        with Locations((0, 40 / 2 - 17)):\n            Ellipse(10 / 2, 4 / 2)\n        with BuildLine(Plane.XZ) as l1:\n            CenterArc((-15, 40 / 2), 17, 90, 180)\n    sweep(path=l1)\n\n    fillet(p.edges().filter_by(GeomType.CIRCLE, reverse=True).group_by(Axis.X)[0], 1)\n\n    with BuildLine(mode=Mode.PRIVATE) as lc1:\n        PolarLine(\n            (42 / 2, 0), 37, 94, length_mode=LengthMode.VERTICAL\n        )  # construction line\n\n    pts = [\n        (0, 0),\n        (42 / 2, 0),\n        ((lc1.line @ 1).X, (lc1.line @ 1).Y),\n        (0, (lc1.line @ 1).Y),\n    ]\n    with BuildSketch(Plane.XZ) as sk2:\n        Polygon(*pts, align=None)\n        fillet(sk2.vertices().group_by(Axis.X)[1], 3)\n    revolve(axis=Axis.Z, mode=Mode.SUBTRACT)\n\nshow(p)\n\n\ngot_mass = p.part.volume*densc\nwant_mass = 43.09\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f'{got_mass=}, {want_mass=}, {delta=}, {tolerance=}'\n\n");
    // real build123d: p.volume == 42248.61825268254
    expect(Math.abs(measured["p"].volume - 42248.61825268254))
      .toBeLessThan(42248.61825268254 * 0.005);
  });

  // ttt/ttt-ppp0103 — Too Tall Toby PPP01-03: revolve profile + PolarLocations bosses, mass assert
  test("ttt/ttt-ppp0103", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\n\nwith BuildPart() as ppp0103:\n    with BuildSketch() as sk1:\n        RectangleRounded(34 * 2, 95, 18)\n        with Locations((0, -2)):\n            RectangleRounded((34 - 16) * 2, 95 - 18 - 14, 7, mode=Mode.SUBTRACT)\n        with Locations((-34 / 2, 0)):\n            Rectangle(34, 95, 0, mode=Mode.SUBTRACT)\n    extrude(amount=16)\n    with BuildSketch(Plane.XZ.offset(-95 / 2)) as cyl1:\n        with Locations((0, 16 / 2)):\n            Circle(16 / 2)\n    extrude(amount=18)\n    with BuildSketch(Plane.XZ.offset(95 / 2 - 14)) as cyl2:\n        with Locations((0, 16 / 2)):\n            Circle(16 / 2)\n    extrude(amount=23)\n    with Locations(Plane.XZ.offset(95 / 2 + 9)):\n        with Locations((0, 16 / 2)):\n            CounterSinkHole(5.5 / 2, 11.2 / 2, None, 90)\n\nshow(ppp0103)\n\ngot_mass = ppp0103.part.volume*densb\nwant_mass = 96.13\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f'{got_mass=}, {want_mass=}, {delta=}, {tolerance=}'\n");
    // real build123d: ppp0103.volume == 35605.546935185695
    expect(Math.abs(measured["ppp0103"].volume - 35605.546935185695))
      .toBeLessThan(35605.546935185695 * 0.005);
  });

  // ttt/ttt-ppp0104 — Too Tall Toby PPP01-04: extrude/until + fillet chains, mass assert
  test("ttt/ttt-ppp0104", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\nd1, d2, d3 = 38, 26, 16\nh1, h2, h3, h4 = 20, 8, 7, 23\nw1, w2, w3 = 80, 10, 5\nf1, f2, f3 = 4, 10, 5\nsloth1, sloth2 = 18, 12\nslotw1, slotw2 = 17, 14\n\nwith BuildPart() as p:\n    with BuildSketch() as s:\n        Circle(d1 / 2)\n    extrude(amount=h1)\n    with BuildSketch(Plane.XY.offset(h1)) as s2:\n        Circle(d2 / 2)\n    extrude(amount=h2)\n    with BuildSketch(Plane.YZ) as s3:\n        Rectangle(d1 + 15, h3, align=(Align.CENTER, Align.MIN))\n    extrude(amount=w1 - d1 / 2)\n    # fillet workaround \\/\n    ped = p.part.edges().group_by(Axis.Z)[2].filter_by(GeomType.CIRCLE)\n    fillet(ped, f1)\n    with BuildSketch(Plane.YZ) as s3a:\n        Rectangle(d1 + 15, 15, align=(Align.CENTER, Align.MIN))\n        Rectangle(d1, 15, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.MIN))\n    extrude(amount=w1 - d1 / 2, mode=Mode.SUBTRACT)\n    # end fillet workaround /\\\n    with BuildSketch() as s4:\n        Circle(d3 / 2)\n    extrude(amount=h1 + h2, mode=Mode.SUBTRACT)\n    with BuildSketch() as s5:\n        with Locations((w1 - d1 / 2 - w2 / 2, 0)):\n            Rectangle(w2, d1)\n    extrude(amount=-h4)\n    fillet(p.part.edges().group_by(Axis.X)[-1].sort_by(Axis.Z)[-1], f2)\n    fillet(p.part.edges().group_by(Axis.X)[-4].sort_by(Axis.Z)[-2], f3)\n    pln = Plane.YZ.offset(w1 - d1 / 2)\n    with BuildSketch(pln) as s6:\n        with Locations((0, -h4)):\n            SlotOverall(slotw1 * 2, sloth1, 90)\n    extrude(amount=-w3, mode=Mode.SUBTRACT)\n    with BuildSketch(pln) as s6b:\n        with Locations((0, -h4)):\n            SlotOverall(slotw2 * 2, sloth2, 90)\n    extrude(amount=-w2, mode=Mode.SUBTRACT)\n\nshow(p)\n\n\ngot_mass = p.part.volume*densa\nwant_mass = 310\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f'{got_mass=}, {want_mass=}, {delta=}, {tolerance=}'\n");
    // real build123d: p.volume == 39743.211180667735
    expect(Math.abs(measured["p"].volume - 39743.211180667735))
      .toBeLessThan(39743.211180667735 * 0.005);
  });

  // ttt/ttt-ppp0105 — Too Tall Toby PPP01-05: lofted transition + holes, mass assert
  test("ttt/ttt-ppp0105", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\nwith BuildPart() as p:\n    with BuildSketch() as s:\n        SlotOverall(45, 38)\n        offset(amount=3)\n    with BuildSketch(Plane.XY.offset(133 - 30)) as s2:\n        SlotOverall(60, 4)\n        offset(amount=3)\n    loft()\n\n    with BuildSketch() as s3:\n        SlotOverall(45, 38)\n    with BuildSketch(Plane.XY.offset(133 - 30)) as s4:\n        SlotOverall(60, 4)\n    loft(mode=Mode.SUBTRACT)\n\n    extrude(p.part.faces().sort_by(Axis.Z)[0], amount=30)\n\nshow(p)\n\n\ngot_mass = p.part.volume*densc\nwant_mass = 57.08\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f'{got_mass=}, {want_mass=}, {delta=}, {tolerance=}'\n\n");
    // real build123d: p.volume == 55617.528016135795
    expect(Math.abs(measured["p"].volume - 55617.528016135795))
      .toBeLessThan(55617.528016135795 * 0.005);
  });

  // ttt/ttt-ppp0108 — Too Tall Toby PPP01-08: the largest of the challenge parts (3.4 kg), mass assert
  test("ttt/ttt-ppp0108", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\nwith BuildPart() as p:\n    with BuildSketch() as s1:\n        Rectangle(188 / 2 - 33, 162, align=(Align.MIN, Align.CENTER))\n        with Locations((188 / 2 - 33, 0)):\n            SlotOverall(190, 33 * 2, rotation=90)\n        mirror(about=Plane.YZ)\n        with GridLocations(188 - 2 * 33, 190 - 2 * 33, 2, 2):\n            Circle(29 / 2, mode=Mode.SUBTRACT)\n        Circle(84 / 2, mode=Mode.SUBTRACT)\n    extrude(amount=16)\n\n    with BuildPart() as p2:\n        with BuildSketch(Plane.XZ) as s2:\n            with BuildLine() as l1:\n                l1 = Polyline(\n                    (222 / 2 + 14 - 40 - 40, 0),\n                    (222 / 2 + 14 - 40, -35 + 16),\n                    (222 / 2 + 14, -35 + 16),\n                    (222 / 2 + 14, -35 + 16 + 30),\n                    (222 / 2 + 14 - 40 - 40, -35 + 16 + 30),\n                    close=True,\n                )\n            make_face()\n            with Locations((222 / 2, -35 + 16 + 14)):\n                Circle(11 / 2, mode=Mode.SUBTRACT)\n        extrude(amount=20 / 2, both=True)\n        with BuildSketch() as s3:\n            with Locations(l1 @ 0):\n                Rectangle(40 + 40, 8, align=(Align.MIN, Align.CENTER))\n                with Locations((40, 0)):\n                    Rectangle(40, 20, align=(Align.MIN, Align.CENTER))\n        extrude(amount=30, both=True, mode=Mode.INTERSECT)\n        mirror(about=Plane.YZ)\n\nshow(p)\n\n\ngot_mass = p.part.volume*densa\nwant_mass = 3387.06\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f'{got_mass=}, {want_mass=}, {delta=}, {tolerance=}'\n");
    // real build123d: p.volume == 434238.2673538104
    expect(Math.abs(measured["p"].volume - 434238.2673538104))
      .toBeLessThan(434238.2673538104 * 0.005);
    // real build123d: p2.volume == 57318.67288915634
    expect(Math.abs(measured["p2"].volume - 57318.67288915634))
      .toBeLessThan(57318.67288915634 * 0.005);
  });

  // ttt/ttt-ppp0109 — Too Tall Toby PPP01-09: Edge.find_tangent + tangent construction lines, mass assert
  test("ttt/ttt-ppp0109", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from math import sqrt\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\ndensa = 7800 / 1e6  # carbon steel density g/mm^3\ndensb = 2700 / 1e6  # aluminum alloy\ndensc = 1020 / 1e6  # ABS\n\nwith BuildPart() as ppp109:\n    with BuildSketch() as one:\n        Rectangle(69, 75, align=(Align.MAX, Align.CENTER))\n        fillet(one.vertices().group_by(Axis.X)[0], 17)\n    extrude(amount=13)\n    centers = [\n        arc.arc_center\n        for arc in ppp109.edges().filter_by(GeomType.CIRCLE).group_by(Axis.Z)[-1]\n    ]\n    with Locations(*centers):\n        CounterBoreHole(radius=8 / 2, counter_bore_radius=15 / 2, counter_bore_depth=4)\n\n    with BuildSketch(Plane.YZ) as two:\n        with Locations((0, 45)):\n            Circle(15)\n        with BuildLine() as bl:\n            c = Line((75 / 2, 0), (75 / 2, 60), mode=Mode.PRIVATE)\n            u = two.edge().find_tangent(75 / 2 + 90)[0]  # where is the slope 75/2?\n            l1 = IntersectingLine(\n                two.edge().position_at(u), -two.edge().tangent_at(u), other=c\n            )\n            Line(l1 @ 0, (0, 45))\n            Polyline((0, 0), c @ 0, l1 @ 1)\n            mirror(about=Plane.YZ)\n        make_face()\n        with Locations((0, 45)):\n            Circle(12 / 2, mode=Mode.SUBTRACT)\n    extrude(amount=-13)\n\n    with BuildSketch(Plane((0, 0, 0), x_dir=(1, 0, 0), z_dir=(1, 0, 1))) as three:\n        Rectangle(45 * 2 / sqrt(2) - 37.5, 75, align=(Align.MIN, Align.CENTER))\n        with Locations(three.edges().sort_by(Axis.X)[-1].center()):\n            Circle(37.5)\n            Circle(33 / 2, mode=Mode.SUBTRACT)\n        split(bisect_by=Plane.YZ)\n    extrude(amount=6)\n    f = ppp109.faces().filter_by(Axis((0, 0, 0), (-1, 0, 1)))[0]\n    extrude(f, until=Until.NEXT)\n    fillet(ppp109.edges().filter_by(Axis.Y).sort_by(Axis.Z)[2], 16)\n    # extrude(f, amount=10)\n    # fillet(ppp109.edges(Select.NEW), 16)\n\n\nshow(ppp109)\n\ngot_mass = ppp109.part.volume * densb\nwant_mass = 307.23\ntolerance = 1\ndelta = abs(got_mass - want_mass)\nprint(f\"Mass: {got_mass:0.2f} g\")\nassert delta < tolerance, f\"{got_mass=}, {want_mass=}, {delta=}, {tolerance=}\"\n");
    // real build123d: ppp109.volume == 113789.2638826812
    expect(Math.abs(measured["ppp109"].volume - 113789.2638826812))
      .toBeLessThan(113789.2638826812 * 0.005);
  });

  // docs-rst/topology_selection/b08 — new_edges(box, cylinder, combined=part) - the module-level selector
  test("docs-rst/topology_selection/b08", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\nbox = Box(5, 5, 1)\ncircle = Cylinder(2, 5)\npart = box + circle\nedges = new_edges(box, circle, combined=part)\n");
    // real build123d: part.volume == 75.26548245743669
    expect(Math.abs(measured["part"].volume - 75.26548245743669))
      .toBeLessThan(75.26548245743669 * 0.005);
    // real build123d: circle.volume == 62.83185307179585
    expect(Math.abs(measured["circle"].volume - 62.83185307179585))
      .toBeLessThan(62.83185307179585 * 0.005);
    // real build123d: box.volume == 24.999999999999993
    expect(Math.abs(measured["box"].volume - 24.999999999999993))
      .toBeLessThan(24.999999999999993 * 0.005);
  });

  // docs-rst/topology_selection/b09 — new_edges() after a fillet (upstream's Select.NEW-returns-nothing example)
  test("docs-rst/topology_selection/b09", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\nbox = Box(5, 5, 1)\ncircle = Cylinder(2, 5)\npart_before = box + circle\nedges = part_before.edges().filter_by(lambda a: a.length == 1)\npart = fillet(edges, 1)\nedges = new_edges(part_before, combined=part)\n");
    // real build123d: part_before.volume == 75.26548245743669
    expect(Math.abs(measured["part_before"].volume - 75.26548245743669))
      .toBeLessThan(75.26548245743669 * 0.005);
    // real build123d: part.volume == 74.40707511102647
    expect(Math.abs(measured["part"].volume - 74.40707511102647))
      .toBeLessThan(74.40707511102647 * 0.005);
    // real build123d: circle.volume == 62.83185307179585
    expect(Math.abs(measured["circle"].volume - 62.83185307179585))
      .toBeLessThan(62.83185307179585 * 0.005);
  });

  // docs-rst/tips/b05 — module-level vertices() context selector on a rotated workplane
  test("docs-rst/tips/b05", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\nwith BuildSketch(Plane.YZ.rotated((123, 45, 6))) as custom_plane:\n    Rectangle(1, 1, align=Align.MIN)\n    with Locations(vertices().group_by(Axis.X)[-1].sort_by(Axis.Y)[-1]):\n        Circle(0.2)\n");
    // real build123d: custom_plane.area == 1.0942477796076904
    expect(Math.abs(measured["custom_plane"].area - 1.0942477796076904))
      .toBeLessThan(1.0942477796076904 * 0.005);
  });

  // docs-rst/OpenSCAD/b01 — fillet(edges().filter_by(lambda e: e.is_interior))
  test("docs-rst/OpenSCAD/b01", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\n# Builder mode\nwith BuildPart() as angle_iron:\n    with BuildSketch() as profile:\n        Rectangle(3 * CM, 4 * MM, align=Align.MIN)\n        Rectangle(4 * MM, 3 * CM, align=Align.MIN)\n    extrude(amount=10 * CM)\n    fillet(angle_iron.edges().filter_by(lambda e: e.is_interior), 5 * MM)\n");
    // real build123d: angle_iron.volume == 22936.50459150638
    expect(Math.abs(measured["angle_iron"].volume - 22936.50459150638))
      .toBeLessThan(22936.50459150638 * 0.005);
  });

  // docs-rst/tutorial_design/b07 — FilletPolyline
  test("docs-rst/tutorial_design/b07", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import show_all\n\nthickness = 3 * MM\nwidth = 25 * MM\nlength = 50 * MM\nheight = 25 * MM\nhole_diameter = 5 * MM\nbend_radius = 5 * MM\nfillet_radius = 2 * MM\n\nwith BuildPart() as bracket:\n    with BuildSketch() as sketch:\n        with BuildLine() as profile:\n            FilletPolyline(\n                (0, 0), (length / 2, 0), (length / 2, height), radius=bend_radius\n            )\n            offset(amount=thickness, side=Side.LEFT)\n        make_face()\n        mirror(about=Plane.YZ)\n    extrude(amount=width / 2)\n    mirror(about=Plane.XY)\n    corners = bracket.edges().filter_by(Axis.X).group_by(Axis.Y)[-1]\n    fillet(corners, fillet_radius)\n    with Locations(bracket.faces().sort_by(Axis.X)[-1]):\n        Hole(hole_diameter / 2)\n    with BuildSketch(bracket.faces().sort_by(Axis.Y)[0]):\n        SlotOverall(20 * MM, hole_diameter)\n    extrude(amount=-thickness, mode=Mode.SUBTRACT)\n\nshow_all()\n");
    // real build123d: bracket.volume == 6412.652585245836
    expect(Math.abs(measured["bracket"].volume - 6412.652585245836))
      .toBeLessThan(6412.652585245836 * 0.005);
  });

  // docs-rst/key_concepts_builder/b13 — Locations around a nested BuildSketch must NOT replicate (0.11.1 semantics)
  test("docs-rst/key_concepts_builder/b13", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\nwith BuildPart() as model:\n    with Locations((-20, 0), (20, 0)):\n        with BuildSketch() as holes:\n            Circle(3)\n        extrude(amount=5)\n");
    // real build123d: model.volume == 141.3716694115407
    expect(Math.abs(measured["model"].volume - 141.3716694115407))
      .toBeLessThan(141.3716694115407 * 0.005);
  });


  // docs/objects_3d — Wedge (BRepPrimAPI_MakeWedge min/max form) + ConvexPolyhedron
  test("docs/objects_3d", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Setup]\nfrom build123d import *\n\n# [Setup]\n\n\ndef write_svg(filename: str, view_port_origin=(-100, -50, 30)):\n    \"\"\"Save an image of the BuildPart object as SVG\"\"\"\n    builder: BuildPart = BuildPart._get_context()\n\n    visible, hidden = builder.part.project_to_viewport(view_port_origin)\n    max_dimension = max(*Compound(children=visible + hidden).bounding_box().size)\n    exporter = ExportSVG(scale=100 / max_dimension)\n    exporter.add_layer(\"Visible\")\n    exporter.add_layer(\"Hidden\", line_color=(99, 99, 99), line_type=LineType.ISO_DOT)\n    exporter.add_shape(visible, layer=\"Visible\")\n    exporter.add_shape(hidden, layer=\"Hidden\")\n    exporter.write(f\"assets/{filename}.svg\")\n\n\n# [Ex. 1]\nwith BuildPart() as example_1:\n    Box(3, 2, 1)\n    # [Ex. 1]\n    pass  # [removed by collect.py] write_svg(\"box_example\")\n\n# [Ex. 2]\nwith BuildPart() as example_2:\n    Cone(2, 1, 2)\n    # [Ex. 2]\n    pass  # [removed by collect.py] write_svg(\"cone_example\")\n\n# [Ex. 3]\nwith BuildPart() as example_3:\n    Box(3, 2, 1)\n    with Locations(example_3.faces().sort_by(Axis.Z)[-1]):\n        CounterBoreHole(0.2, 0.4, 0.5, 0.9)\n    # [Ex. 3]\n    pass  # [removed by collect.py] write_svg(\"counter_bore_hole_example\")\n\n\n# [Ex. 4]\nwith BuildPart() as example_4:\n    Box(3, 2, 1)\n    with Locations(example_3.faces().sort_by(Axis.Z)[-1]):\n        CounterSinkHole(0.2, 0.4, 0.9)\n    # [Ex. 4]\n    pass  # [removed by collect.py] write_svg(\"counter_sink_hole_example\")\n\n# [Ex. 5]\nwith BuildPart() as example_5:\n    Cylinder(1, 2)\n    # [Ex. 5]\n    pass  # [removed by collect.py] write_svg(\"cylinder_example\")\n\n# [Ex. 6]\nwith BuildPart() as example_6:\n    Box(3, 2, 1)\n    Hole(0.4)\n    # [Ex. 6]\n    pass  # [removed by collect.py] write_svg(\"hole_example\")\n\n# [Ex. 7]\nwith BuildPart() as example_7:\n    Sphere(1, 0)\n    # [Ex. 7]\n    pass  # [removed by collect.py] write_svg(\"sphere_example\")\n\n# [Ex. 8]\nwith BuildPart() as example_8:\n    Torus(1, 0.2)\n    # [Ex. 8]\n    pass  # [removed by collect.py] write_svg(\"torus_example\")\n\n# [Ex. 9]\nwith BuildPart() as example_9:\n    Wedge(1, 1, 1, 0, 0, 0.5, 0.5)\n    # [Ex. 9]\n    pass  # [removed by collect.py] write_svg(\"wedge_example\")\n\n# [Ex. 10]\nwith BuildPart() as example_10:\n    Box(30, 20, 20)\n    Box(20, 30, 20)\n    Box(20, 20, 30)\n    with Locations((-10, 0, 0)):\n        Box(40, 23, 23)\n    ConvexPolyhedron(example_10.vertices())\n    # [Ex. 10]\n    pass  # [removed by collect.py] write_svg(\"convex_polyhedron_example\")\n");
    // real build123d: example_9.volume == 0.5833333333333333
    expect(Math.abs(measured["example_9"].volume - 0.5833333333333333))
      .toBeLessThan(0.5833333333333333 * 0.005);
    // real build123d: example_10.volume == 33876.666666666664
    expect(Math.abs(measured["example_10"].volume - 33876.666666666664))
      .toBeLessThan(33876.666666666664 * 0.005);
  });

  // docs-rst/tutorial_constraints/b03 — Triangle (the trianglesolver port)
  test("docs-rst/tutorial_constraints/b03", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\nfrom math import *\n\nisosceles = Triangle(a=30, b=30, C=60)\nisosceles.c\nisosceles.A\nisosceles.B\nisosceles.vertex_A\n");
    // real build123d: isosceles.area == 389.71143170299746
    expect(Math.abs(measured["isosceles"].area - 389.71143170299746))
      .toBeLessThan(389.71143170299746 * 0.005);
  });

  // docs/objects_1d_parabolic_hyperbolic — ParabolicCenterArc / HyperbolicCenterArc (gp_Parab / gp_Hypr)
  test("docs/objects_1d_parabolic_hyperbolic", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "# [Setup]\nfrom build123d import *\n\n# from ocp_vscode import *\n\ndot = Circle(0.05)\n\nwith BuildLine() as parabolic_center_arc:\n    ParabolicCenterArc((0, 0), 0.25, -60, arc_size=120)\ns = 100 / max(*parabolic_center_arc.line.bounding_box().size)\nsvg = ExportSVG(scale=s)\nsvg.add_shape(parabolic_center_arc.line)\nsvg.add_shape(dot.moved(Location(Vector((0, 0)))))\nsvg.write(\"assets/parabolic_center_arc_example.svg\")\n\nwith BuildLine() as hyperbolic_center_arc:\n    HyperbolicCenterArc((0, 0), 0.5, 1, 0, arc_size=180)\ns = 100 / max(*hyperbolic_center_arc.line.bounding_box().size)\nsvg = ExportSVG(scale=s)\nsvg.add_shape(hyperbolic_center_arc.line)\nsvg.add_shape(dot.moved(Location(Vector((0, 0)))))\nsvg.write(\"assets/hyperbolic_center_arc_example.svg\")\n\n# show_all()\n");
    // real build123d: parabolic_center_arc bbox == [0.0, -1.047197551, 0.0, 1.096622711, 1.047197551, 0.0]
    const bbox_parabolic_center_arc = [0.0, -1.047197551, 0.0, 1.096622711, 1.047197551, 0.0];
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(measured["parabolic_center_arc"].bbox[i] - bbox_parabolic_center_arc[i])).toBeLessThan(1e-3);
    }
    // real build123d: hyperbolic_center_arc bbox == [-1.150649451, 1.0, 0.0, 1.150649451, 2.509178479, 0.0]
    const bbox_hyperbolic_center_arc = [-1.150649451, 1.0, 0.0, 1.150649451, 2.509178479, 0.0];
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(measured["hyperbolic_center_arc"].bbox[i] - bbox_hyperbolic_center_arc[i])).toBeLessThan(1e-3);
    }
  });

  // docs/slide_latch — BuildSketch's face alignment (localize + orient +Z) and Select.LAST vertices
  test("docs/slide_latch", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "from build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\nwith BuildPart() as latch:\n    # Basic box shape to start with filleted corners\n    Box(70, 30, 14)\n    end = latch.faces().sort_by(Axis.X)[-1]  # save the end with the hole\n    fillet(latch.edges().filter_by(Axis.Z), 2)\n    fillet(latch.edges().sort_by(Axis.Z)[-1], 1)\n    # Make screw tabs\n    with BuildSketch(latch.faces().sort_by(Axis.Z)[0]) as l4:\n        with Locations((-30, 0), (30, 0)):\n            SlotOverall(50, 10, rotation=90)\n        Rectangle(50, 30)\n        fillet(l4.vertices(Select.LAST), radius=2)\n    extrude(amount=-2)\n    with GridLocations(60, 40, 2, 2):\n        Hole(2)\n    # Create the hole from the end saved previously\n    with BuildSketch(end) as slide_hole:\n        add(end)\n        offset(amount=-2)\n        fillet(slide_hole.vertices(), 1)\n    extrude(amount=-68, mode=Mode.SUBTRACT)\n    # Slot for the handle to slide in\n    with BuildSketch(latch.faces().sort_by(Axis.Z)[-1]):\n        SlotOverall(32, 8)\n    extrude(amount=-2, mode=Mode.SUBTRACT)\n    # The slider will move align the x axis 12mm in each direction\n    LinearJoint(\"latch\", axis=Axis.X, linear_range=(-12, 12))\n\nwith BuildPart() as slide:\n    # The slide will be a little smaller than the hole\n    with BuildSketch() as s1:\n        add(slide_hole.sketch)\n        offset(amount=-0.25)\n    # The extrusions aren't symmetric\n    extrude(amount=46)\n    extrude(slide.faces().sort_by(Axis.Z)[0], amount=20)\n    # Round off the ends\n    fillet(slide.edges().group_by(Axis.Z)[0], 1)\n    fillet(slide.edges().group_by(Axis.Z)[-1], 1)\n    # Create the knob\n    with BuildSketch() as s2:\n        with Locations((12, 0)):\n            SlotOverall(15, 4, rotation=90)\n        Rectangle(12, 7, align=(Align.MIN, Align.CENTER))\n        fillet(s2.vertices(Select.LAST), 1)\n        split(bisect_by=Plane.XZ)\n    revolve(axis=Axis.X)\n    # Align the joint to Plane.ZY flipped\n    RigidJoint(\"slide\", joint_location=Location(-Plane.ZY))\n\n# Position the slide in the latch: -12 >= position <= 12\nlatch.part.joints[\"latch\"].connect_to(slide.part.joints[\"slide\"], position=12)\n\n# show(latch.part, render_joints=True)\n# show(slide.part, render_joints=True)\nshow(latch.part, slide.part, render_joints=True)\n");
    // real build123d: latch.volume == 11831.250489574682
    expect(Math.abs(measured["latch"].volume - 11831.250489574682))
      .toBeLessThan(11831.250489574682 * 0.005);
    // real build123d: slide.volume == 16765.45878762745
    expect(Math.abs(measured["slide"].volume - 16765.45878762745))
      .toBeLessThan(16765.45878762745 * 0.005);
  });

  // docs-selectors/group_properties_with_keys — copy(builder) snapshots + exact convex hull + GroupBy.group(key)
  test("docs-selectors/group_properties_with_keys", async ({ page }) => {
    await gotoAndReady(page);
    const measured = await runAndMeasure(page, "import os\nfrom copy import copy\n\nfrom build123d import *\n# [removed by collect.py] from ocp_vscode import *\n\nworking_path = os.path.dirname(os.path.abspath(__file__))\nfiledir = os.path.join(working_path, \"..\", \"..\", \"assets\", \"topology_selection\")\n\nwith BuildPart() as part:\n    with BuildSketch(Plane.XZ) as sketch:\n        with BuildLine():\n            CenterArc((-6, 12), 10, 0, 360)\n            Line((-16, 0), (16, 0))\n        make_hull()\n        Rectangle(50, 5, align=(Align.CENTER, Align.MAX))\n\n    extrude(amount=12)\n\n    Box(38, 6, 22, align=(Align.CENTER, Align.MAX, Align.MIN), mode=Mode.SUBTRACT)\n\n    circle = part.edges().filter_by(GeomType.CIRCLE).sort_by(Axis.Y)[0]\n    with Locations(Plane(circle.arc_center, z_dir=circle.normal())):\n        CounterBoreHole(13 / 2, 16 / 2, 4)\n\n    mirror(about=Plane.XZ)\n\n    before_fillet = copy(part)\n\n    length_groups = part.edges().group_by(Edge.length)\n    fillet(length_groups.group(6) + length_groups.group(5), 4)\n\n    after_fillet = copy(part)\n\n    with BuildSketch() as pins:\n        with Locations((-21, 0)):\n            Circle(3 / 2)\n        with Locations((21, 0)):\n            SlotCenterToCenter(1, 3)\n    extrude(amount=-12, mode=Mode.SUBTRACT)\n\n    with GridLocations(42, 16, 2, 2):\n        CounterBoreHole(3.5 / 2, 3.5, 0)\n\n    after_holes = copy(part)\n\n    radius_groups = part.edges().filter_by(GeomType.CIRCLE).group_by(Edge.radius)\n    bearing_edges = radius_groups.group(8).group_by(SortBy.DISTANCE)[-1]\n    pin_edges = radius_groups.group(1.5).filter_by_position(Axis.Z, -5, -5)\n    chamfer([pin_edges, bearing_edges], .5)\n\nlocation = Location((-20, -20))\nitems = [before_fillet.part] + length_groups.group(6) + length_groups.group(5)\nbefore = Compound(items).move(location)\nshow(before, after_fillet.part.move(Location((20, 20))))\n# [removed by collect.py] save_screenshot(os.path.join(filedir, \"group_length_key.png\"))\n\nlocation = Location((-20, -20), (180, 0, 0))\nafter = Compound([after_holes.part] + pin_edges + bearing_edges).move(location)\nshow(after, part.part.move(Location((20, 20), (180, 0, 0))))\n# [removed by collect.py] save_screenshot(os.path.join(filedir, \"group_radius_key.png\"))");
    // real build123d: before_fillet.volume == 9751.638840713076
    expect(Math.abs(measured["before_fillet"].volume - 9751.638840713076))
      .toBeLessThan(9751.638840713076 * 0.005);
    // real build123d: after_fillet.volume == 9730.739028031032
    expect(Math.abs(measured["after_fillet"].volume - 9730.739028031032))
      .toBeLessThan(9730.739028031032 * 0.005);
  });

});
