// @ts-check
// build123d 0.12/0.13 semantics in build123d-lite (Python mode). Every
// expected value below is HARDCODED from running the same script through
// real build123d 0.13.0 in the native venv (~/Desktop/ocjs-deps/b123d-013-venv):
// kernel-history Select.LAST/NEW, the unified BuildScope (builders construct
// locally and publish through placements; an enclosing Locations positions a
// builder; custom objects are built behind a firewall), insert(), Convexity
// and topo_path, BoundBox predicates, Rotation(Axis, angle), iterable
// Locations / Location * iterables, Superellipse, materials and mass,
// assembly locations/volumes, tessellate_with_uvs and export_obj.
const { test, expect } = require('@playwright/test');

async function gotoAndReady(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
}

/** Run Python printing "CHK <name> <repr>" lines and a DONE marker; returns
 *  {name: repr}. Worker logs arrive asynchronously, so poll. */
async function runChecks(page, code, timeout = 90000) {
  const result = await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
  expect(result.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some(
      (l) => typeof l === 'string' && l.indexOf('DONE_013') === 0),
    undefined, { timeout });
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors).toEqual([]);
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  const checks = {};
  for (const line of logs) {
    if (typeof line !== 'string' || !line.startsWith('CHK ')) { continue; }
    const rest = line.slice(4);
    const space = rest.indexOf(' ');
    checks[rest.slice(0, space)] = rest.slice(space + 1);
  }
  return checks;
}

test.describe('Python mode: build123d 0.12/0.13 semantics', () => {
  test("Select.LAST / Select.NEW from the kernel's record (0.12)", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "with BuildPart() as part:",
      "    Box(5, 5, 1)",
      "    Cylinder(1, 5)",
      "    print(\"CHK\", \"sel_builder\", repr((len(part.faces(Select.LAST)), len(part.edges(Select.NEW)), len(part.edges(Select.LAST)), len(part.vertices(Select.NEW)), len(part.faces(Select.NEW)), len(part.solids(Select.NEW)))))",
      "with BuildPart() as part2:",
      "    Box(5, 5, 1, align=(Align.CENTER, Align.CENTER, Align.MAX))",
      "    Cylinder(2, 2, align=(Align.CENTER, Align.CENTER, Align.MIN))",
      "    print(\"CHK\", \"sel_touch\", repr((len(part2.edges(Select.NEW)), len(part2.edges(Select.LAST)))))",
      "with BuildPart() as part3:",
      "    Box(5, 5, 1)",
      "    Cylinder(1, 5)",
      "    fillet(part3.edges().filter_by(lambda e: e.length == 1), 1)",
      "    print(\"CHK\", \"sel_fillet\", repr((len(part3.faces(Select.LAST)), len(part3.edges(Select.NEW)), round(part3.part.volume, 4))))",
      "cross = Rectangle(8, 2)",
      "cross += Rectangle(2, 8)",
      "tray = Box(20, 20, 5) - Pos(Z=1.5) * Box(16, 16, 5)",
      "print(\"CHK\", \"sel_algebra\", repr((len(cross.vertices(Select.NEW)), len(cross.edges(Select.LAST)), len(tray.faces(Select.LAST)))))",
      "try:",
      "    Rectangle(1, 1).edges(Select.NEW)",
      "    print(\"CHK\", \"sel_norecord\", repr(\"no raise\"))",
      "except ValueError:",
      "    print(\"CHK\", \"sel_norecord\", repr(\"raises\"))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.sel_builder, "sel_builder").toBe("(4, 2, 6, 2, 0, 1)");
    expect(c.sel_touch, "sel_touch").toBe("(0, 3)");
    expect(c.sel_fillet, "sel_fillet").toBe("(4, 16, 36.708)");
    expect(c.sel_algebra, "sel_algebra").toBe("(4, 6, 5)");
    expect(c.sel_norecord, "sel_norecord").toBe("'raises'");
  });

  test("builders construct locally and publish through placements (BuildScope)", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "with Locations((-10, 0), (10, 0)):",
      "    with BuildPart() as two:",
      "        Box(1, 1, 1)",
      "print(\"CHK\", \"scope_locs\", repr((len(two.part_local.solids()), len(two.part.solids()), round(two.part.volume, 6))))",
      "with BuildPart() as bp:",
      "    with Locations((-20, 0), (20, 0)):",
      "        with BuildSketch() as holes:",
      "            Circle(2)",
      "    extrude(amount=3)",
      "print(\"CHK\", \"scope_sketch\", repr((len(bp.part.solids()), round(bp.part.volume, 4))))",
      "with BuildLine(Plane.YZ) as path:",
      "    l1 = RadiusArc((1, 2), (2, 1), 1)",
      "print(\"CHK\", \"scope_line\", repr(([round(v, 6) + 0.0 for v in path.line_local @ 0], [round(v, 6) + 0.0 for v in path.line @ 0], [round(v, 6) + 0.0 for v in l1 @ 0])))",
      "with BuildPart(Plane.XZ) as placed:",
      "    Box(2, 4, 6)",
      "    face_y = placed.faces().sort_by(Axis.Z)[-1].center().Z",
      "print(\"CHK\", \"scope_local_sel\", repr((round(face_y, 6), [round(v, 6) for v in placed.part.bounding_box().max])))",
      "with BuildPart() as labelled:",
      "    Box(1, 1, 1)",
      "    labelled.label = \"my_part\"",
      "print(\"CHK\", \"label\", repr(labelled.part.label))",
      "class Bracket(BasePartObject):",
      "    def __init__(self, mode=Mode.ADD):",
      "        helper = Box(1, 1, 1)          # must NOT leak into the caller's builder",
      "        super().__init__(Box(2, 2, 2) - helper, mode=mode)",
      "with BuildPart() as firewall:",
      "    with Locations((5, 0, 0)):",
      "        Bracket()",
      "print(\"CHK\", \"firewall\", repr((round(firewall.part.volume, 6), [round(v, 6) for v in firewall.part.bounding_box().min])))",
      "with BuildPart() as ins:",
      "    Box(4, 4, 4)",
      "    insert(Pos(0, 0, 3) * Box(2, 2, 2))",
      "print(\"CHK\", \"insert\", repr(round(ins.part.volume, 6)))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.scope_locs, "scope_locs").toBe("(1, 2, 2.0)");
    expect(c.scope_sketch, "scope_sketch").toBe("(2, 75.3982)");
    expect(c.scope_line, "scope_line").toBe("([1.0, 2.0, 0.0], [0.0, 1.0, 2.0], [1.0, 2.0, 0.0])");
    expect(c.scope_local_sel, "scope_local_sel").toBe("(3.0, [1.0, 3.0, 2.0])");
    expect(c.label, "label").toBe("'my_part'");
    expect(c.firewall, "firewall").toBe("(7.0, [4.0, -1.0, -1.0])");
    expect(c.insert, "insert").toBe("72.0");
  });

  test("Convexity / topo_path", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "box = Box(1, 1, 1)",
      "f0 = box.faces()[0]",
      "e0 = f0.edges()[0]",
      "print(\"CHK\", \"topo_path\", repr((len(e0.topo_path), e0.topo_parent is box, e0.topo_owner is f0)))",
      "L = extrude(Polygon((0, 0), (4, 0), (4, 1), (1, 1), (1, 3), (0, 3)), 2)",
      "print(\"CHK\", \"convex_L\", repr((len(L.edges() | Convexity.CONCAVE), sorted(str(v.convexity) for v in L.vertices()).count(\"Convexity.SADDLE\"), [len(g) for g in L.edges().group_by(Convexity)])))",
      "cyl = Cylinder(2, 3)",
      "print(\"CHK\", \"convex_faces\", repr([str(f.convexity) for f in cyl.faces().sort_by(Axis.Z)]))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.topo_path, "topo_path").toBe("(2, True, True)");
    expect(c.convex_faces, "convex_faces").toBe("['Convexity.SMOOTH', 'Convexity.CONVEX', 'Convexity.SMOOTH']");
  });

  test("BoundBox / Rotation / Locations / Location * iterables", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "b1 = Box(10, 10, 10).bounding_box()",
      "b2 = BoundBox(Pos(5, 0, 0) * Box(10, 10, 10))",
      "b3 = BoundBox(Box(2, 2, 2))",
      "print(\"CHK\", \"bbox\", repr((b1.overlaps(b2), b1.intersects(b2), b1.contains(b3), b3.within(b1), b1.touches(BoundBox(Pos(10, 0, 0) * Box(10, 10, 10))), BoundBox(Rectangle(4, 4)).contains(BoundBox(Rectangle(2, 2))))))",
      "r = Rotation(Axis((1, 0, 0), (0, 0, 1)), 90)",
      "print(\"CHK\", \"rot_axis\", repr([round(v, 6) + 0.0 for v in r.position] + [round(v, 6) + 0.0 for v in r.orientation]))",
      "print(\"CHK\", \"locs_gen\", repr((len(Locations((i, 0) for i in range(3)).local_locations), len(Pos(1, 0, 0) * (Box(1, 1, 1) for _ in range(2))))))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.bbox, "bbox").toBe("(True, True, True, True, True, True)");
    expect(c.rot_axis, "rot_axis").toBe("[1.0, -1.0, 0.0, 0.0, 0.0, 90.0]");
    expect(c.locs_gen, "locs_gen").toBe("(3, 2)");
  });

  test("Superellipse", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "print(\"CHK\", \"superellipse\", repr([round(Superellipse(40, 30, o).area, 3) for o in (0.5, 1, 2, 4)]))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.superellipse, "superellipse").toBe("[200.002, 600.0, 942.478, 1111.377]");
  });

  test("materials and mass", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "m = Box(10, 10, 10)",
      "m.material = \"brass\"",
      "print(\"CHK\", \"mass\", repr((m.material.material.name, round(m.mass(), 6), int(round(m.mass(Unit.KG) * 1e6)), round(m.mass(Unit.G, Unit.CM), 3))))",
      "asm = Compound(children=[m, Pos(20, 0, 0) * Box(10, 10, 10)])",
      "asm.children[1].material = \"aluminum\"",
      "print(\"CHK\", \"mass_asm\", repr(round(asm.mass(), 6)))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.mass, "mass").toBe("('Brass_C360_HALF_HARD', 8.5, 8500, 8500.0)");
    expect(c.mass_asm, "mass_asm").toBe("11.2");
  });

  test("assemblies", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "child = Box(1, 1, 1)",
      "child.location = Location((0, 2, 0))",
      "assembly = Compound(children=[child])",
      "assembly.location = Location((3, 0, 0))",
      "print(\"CHK\", \"global_loc\", repr([round(v, 6) for v in child.global_location.position]))",
      "a1 = Compound(children=[Box(1, 1, 1)])",
      "a2 = Compound(children=[a1, Box(1, 1, 1)])",
      "print(\"CHK\", \"asm_volume\", repr(round(a2.volume, 6)))",
      "loc = Box(1, 1, 1).location",
      "loc.position = (1, 2, 3)",
      "print(\"CHK\", \"loc_set\", repr([round(v, 6) for v in loc.position]))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.global_loc, "global_loc").toBe("[3.0, 2.0, 0.0]");
    expect(c.asm_volume, "asm_volume").toBe("1.0");
    expect(c.loc_set, "loc_set").toBe("[1.0, 2.0, 3.0]");
  });

  test("export_obj / tessellation", async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      "from build123d import *",
      "v, t, n, uv = Box(20, 10, 5).tessellate_with_uvs(0.01)",
      "print(\"CHK\", \"tess\", repr((len(v), len(t), len(n), len(uv))))",
      "print(\"CHK\", \"obj\", repr(export_obj(Box(20, 10, 5), \"box.obj\", atlas_gutter=0.002)))",
      "show(Box(1, 1, 1))",
      "print(\"DONE_013\")",
    ].join('\n');
    const c = await runChecks(page, code);
    // native build123d 0.13.0, verbatim
    expect(c.tess, "tess").toBe("(24, 12, 24, 24)");
    expect(c.obj, "obj").toBe("True");
  });

});
