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

});
