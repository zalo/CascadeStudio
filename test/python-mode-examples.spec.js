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

});
