// @ts-check
// Freeze tests for build123d-lite's CANONICAL free-edge parametrization
// (Build123dLite.js `canonical_form` / `Curve.canonical` / `Axis(edge,
// canonical=True)` / `Edge.make_mid_way` / the `ShapeList.sort_by` tie break),
// a port of the upstream canonical-free-edges proposal in
// docs/upstream-canonical-edges/.
//
// The rule: OPEN shapes start at the lexicographically smaller end point;
// CLOSED shapes start at the arc-length midpoint of the extremal band
// {x <= x_min + 1e-6 * bbox} (x -> y -> z fall-through for loops that are flat
// in a coordinate) and wind counter-clockwise about the dominant axis of the
// loop's area vector; positions are normalized arc length.
//
// Cross-kernel evidence that these numbers are the same ones patched upstream
// build123d produces on OCP 7.9.3 lives in
// test/b123d-validation/canonical-cross-kernel.mjs (not part of this suite).
const { test, expect } = require('@playwright/test');

async function gotoPythonMode(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
}

/** Run a Python snippet that prints "KEY v0 v1 ..." lines and return them as a
 *  map of key -> number[] (or the raw string when not numeric). The first
 *  Python evaluation also fetches + boots Brython, hence the long timeout. */
async function runAndCollect(page, body, timeout = 180000) {
  const code = [
    'from build123d import *',
    'def p(tag, *vals):',
    '    out = [tag]',
    '    for v in vals:',
    '        if isinstance(v, (int, float)) and not isinstance(v, bool):',
    '            out.append(repr(round(float(v), 6)))',
    '        elif isinstance(v, (list, tuple)) or hasattr(v, "__iter__"):',
    '            for c in tuple(v):',
    '                out.append(repr(round(float(c), 6)))',
    '        else:',
    '            out.append(str(v))',
    "    print(' '.join(out))",
    '',
    body,
    'print("CANON_TESTS_DONE")',
  ].join('\n');

  await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.includes('CANON_TESTS_DONE')) ||
          window.CascadeAPI.getErrors().length > 0,
    undefined, { timeout }
  );
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors).toEqual([]);
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  const out = {};
  for (const line of logs) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const values = parts.slice(1).map(Number);
    out[parts[0]] = values.some(Number.isNaN) ? parts.slice(1).join(' ') : values;
  }
  return out;
}

function expectClose(actual, expected, digits = 4) {
  expect(actual).toBeDefined();
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], digits);
  }
}

test.describe('Python mode: canonical free-edge parametrization', () => {
  test('the rule itself, on inputs that need no CAD kernel', async ({ page }) => {
    await gotoPythonMode(page);
    const got = await runAndCollect(page, [
      // lexicographic_key orders x, then y, then z
      'p("LEX_X", 1 if lexicographic_key(Vector(-1, 5, 5)) < lexicographic_key(Vector(0, 0, 0)) else 0)',
      'p("LEX_Y", 1 if lexicographic_key(Vector(0, -1, 9)) < lexicographic_key(Vector(0, 0, 0)) else 0)',
      'p("LEX_Z", 1 if lexicographic_key(Vector(0, 0, -1)) < lexicographic_key(Vector(0, 0, 0)) else 0)',
      // Newell area of a unit square in the XY plane, both windings
      'square = [Vector(0, 0, 0), Vector(1, 0, 0), Vector(1, 1, 0), Vector(0, 1, 0)]',
      'p("AREA_CCW", loop_area_vector(square))',
      'p("AREA_CW", loop_area_vector(square[::-1]))',
      // the rule only needs "the point at arc length d", so a polyline drives it
      'corners = [Vector(-1, -1, 0), Vector(1, -1, 0), Vector(1, 1, 0), Vector(-1, 1, 0)]',
      'perimeter = 8.0',
      'def sampler(d):',
      '    d = d % perimeter',
      '    i = int(d // 2)',
      '    t = (d - 2 * i) / 2',
      '    a, b = corners[i], corners[(i + 1) % 4]',
      '    return a + (b - a) * t',
      'form = canonical_form(sampler, perimeter, True)',
      'p("SQUARE_SIGN", form.sign)',
      'p("SQUARE_SEAM", sampler(form.start * perimeter))',
      'p("SAMPLES_BAND", CANONICAL_SAMPLES, CANONICAL_BAND)',
      // CanonicalForm.position maps canonical u -> the shape's own u
      'p("FORM_POS", CanonicalForm(0.25, -1, True).position(0.5),'
        + ' CanonicalForm(0.0, -1, False).position(0.25))',
      'show(Box(1, 1, 1))',
    ].join('\n'));

    expectClose(got.LEX_X, [1]);
    expectClose(got.LEX_Y, [1]);
    expectClose(got.LEX_Z, [1]);
    expectClose(got.AREA_CCW, [0, 0, 1], 6);
    expectClose(got.AREA_CW, [0, 0, -1], 6);
    // counter-clockwise about +Z, seam at the middle of the flat x = -1 side
    expectClose(got.SQUARE_SIGN, [1]);
    expectClose(got.SQUARE_SEAM, [-1, 0, 0]);
    // defaults must match the upstream patch
    expectClose(got.SAMPLES_BAND, [512, 1e-6], 12);
    // closed: (0.25 - 1*0.5) % 1 = 0.75; open reversed: 1 - 0.25 = 0.75
    expectClose(got.FORM_POS, [0.75, 0.75], 6);
  });

  test('open shapes start at the lexicographically smaller end; closed shapes '
     + 'at the extremal band midpoint, winding CCW', async ({ page }) => {
    await gotoPythonMode(page);
    const got = await runAndCollect(page, [
      // --- open: all three spellings of the same segment canonicalize alike
      'fwd = Edge.make_line((0, 0, 0), (10, 0, 0))',
      'bwd = Edge.make_line((10, 0, 0), (0, 0, 0))',
      'rev = fwd.reversed()',
      'for name, e in (("FWD", fwd), ("BWD", bwd), ("REV", rev)):',
      '    c = e.canonical()',
      '    p("OPEN_" + name, tuple(c.position_at(0)) + tuple(c.tangent_at(0)))',
      'p("OPEN_FORM", fwd.canonical_form().start, fwd.canonical_form().sign,'
        + ' 1 if fwd.canonical_form().closed else 0)',
      // --- Axis(edge): raw by default (disagrees with position_at on a
      //     REVERSED edge), canonical only when asked
      'p("AXIS_RAW", tuple(Axis(rev).position) + tuple(rev.position_at(0)))',
      'p("AXIS_CANON", tuple(Axis(rev, canonical=True).position)'
        + ' + tuple(Axis(rev, canonical=True).direction))',
      // --- closed circle: seam at x = -R, CCW about +Z
      'circle = Circle(10, mode=Mode.PRIVATE).edges()[0]',
      'for name, s in (("CIRCLE", circle), ("CIRCLE_REV", circle.reversed())):',
      '    c = s.canonical()',
      '    p(name, tuple(c.position_at(0)) + tuple(c.position_at(0.25)) + (c.length,))',
      // --- closed wire with a STRAIGHT extremal side: the band midpoint is the
      //     middle of that side, which unlike a corner has a defined tangent
      'rect = Wire(Rectangle(20, 10, mode=Mode.PRIVATE).edges())',
      'rc = rect.canonical()',
      'p("RECT", tuple(rc.position_at(0)) + tuple(rc.tangent_at(0)) + (rc.length,))',
      // --- idempotent
      'for name, s in (("IDEM_CIRCLE", circle), ("IDEM_RECT", rect)):',
      '    once = s.canonical()',
      '    twice = once.canonical()',
      '    p(name, tuple(once.position_at(0)) + tuple(twice.position_at(0))'
        + ' + tuple(once.position_at(0.3)) + tuple(twice.position_at(0.3)))',
      // --- sort_by: the DEFAULT keeps the incoming order on ties (a stable
      //     sort, which chained sorts rely on); tie_break=True resolves them
      //     geometrically instead
      'ties = [Edge.make_line((0, -5, 10), (10, -5, 10)),'
        + ' Edge.make_line((0, 5, 10), (10, 5, 10))]',
      'p("TIE_DEFAULT", tuple(ShapeList(ties).sort_by(Axis.Z)[0].center())'
        + ' + tuple(ShapeList(ties[::-1]).sort_by(Axis.Z)[0].center()))',
      'p("TIE_BREAK", tuple(ShapeList(ties).sort_by(Axis.Z, tie_break=True)[0].center())'
        + ' + tuple(ShapeList(ties[::-1]).sort_by(Axis.Z, tie_break=True)[0].center()))',
      // chained sorts must survive the default (the heat_exchanger.py idiom)
      'radii = [Edge.make_line((0, 0, 0), (3, 0, 0)), Edge.make_line((0, 1, 0), (1, 1, 0)),'
        + ' Edge.make_line((0, 2, 0), (2, 2, 0))]',
      'p("CHAINED", [e.length for e in'
        + ' ShapeList(radii).sort_by(SortBy.LENGTH).sort_by(Axis.Z)])',
      'show(Box(1, 1, 1))',
    ].join('\n'));

    for (const name of ['OPEN_FWD', 'OPEN_BWD', 'OPEN_REV']) {
      expectClose(got[name], [0, 0, 0, 1, 0, 0], 6);
    }
    expectClose(got.OPEN_FORM, [0, 1, 0], 6);
    // legacy Axis(edge) reads the underlying curve at its first parameter
    expectClose(got.AXIS_RAW, [0, 0, 0, /* position_at(0) */ 10, 0, 0], 6);
    expectClose(got.AXIS_CANON, [0, 0, 0, 1, 0, 0], 6);
    // circle: seam (-10, 0, 0); a quarter later, CCW about +Z, is (0, -10, 0)
    expectClose(got.CIRCLE, [-10, 0, 0, 0, -10, 0, 2 * Math.PI * 10]);
    expectClose(got.CIRCLE_REV, [-10, 0, 0, 0, -10, 0, 2 * Math.PI * 10]);
    // 20 x 10 rectangle: seam mid-way up the x = -10 side, heading -Y
    expectClose(got.RECT, [-10, 0, 0, 0, -1, 0, 60], 6);
    expectClose(got.IDEM_CIRCLE.slice(0, 3), got.IDEM_CIRCLE.slice(3, 6), 5);
    expectClose(got.IDEM_CIRCLE.slice(6, 9), got.IDEM_CIRCLE.slice(9, 12), 5);
    expectClose(got.IDEM_RECT.slice(0, 3), got.IDEM_RECT.slice(3, 6), 5);
    expectClose(got.IDEM_RECT.slice(6, 9), got.IDEM_RECT.slice(9, 12), 5);
    // default: ties carry the incoming order, so reversing the input reverses
    // the result (y = -5 first vs y = +5 first)
    expectClose(got.TIE_DEFAULT, [5, -5, 10, 5, 5, 10], 6);
    // tie_break=True: geometry decides, so both orderings agree
    expectClose(got.TIE_BREAK.slice(0, 3), got.TIE_BREAK.slice(3, 6), 6);
    // a chained sort keeps the inner (length) order inside the tied Z group
    expectClose(got.CHAINED, [1, 2, 3], 6);
  });

  test('a closed section loop canonicalizes to hand-computed values and is '
     + 'independent of the operands\' parametric frames', async ({ page }) => {
    await gotoPythonMode(page);
    const got = await runAndCollect(page, [
      // examples/projection.py Example 3: sphere(R50) cut by a cylinder(r80)
      // lying along X at (y = 0, z = -70). Rotating the sphere about its OWN
      // axis is the geometrically identical solid but moves the sphere's u = 0
      // meridian, and with it the kernel's seam.
      'def arch(rotation):',
      '    sphere = Solid.make_sphere(50)',
      '    if rotation:',
      '        sphere = sphere.rotate(Axis.Z, rotation)',
      '    cutter = Solid.make_cylinder(80, 100, Plane.YZ).locate(Location((-50, 0, -70)))',
      '    return sphere.cut(cutter).edges().sort_by(Axis.Z)[0]',
      'for rotation in (0, 45, 90, 180, 270):',
      '    e = arch(rotation)',
      '    c = e.canonical()',
      '    p("RAW_" + str(rotation), e.position_at(0))',
      '    p("CANON_" + str(rotation), tuple(c.position_at(0)) + tuple(c.position_at(0.25))'
        + ' + tuple(c.position_at(0.5)) + tuple(c.position_at(0.75)) + (c.length,))',
      // joints.py's slider axis: two top edges with EQUAL Axis.Z sort keys,
      // measured with make_mid_way. Needs the canonical edge traversal AND the
      // deterministic sort_by tie break.
      'for rotation in (0, 90, 180):',
      '    with BuildPart() as part:',
      '        with BuildSketch():',
      '            Rectangle(10, 10)',
      '        extrude(amount=10, taper=3)',
      '        Cylinder(2.5, 10, rotation=(0, 90, rotation), mode=Mode.SUBTRACT)',
      // selecting the two TIED top edges deterministically is the caller's
      // half of the fix, hence tie_break=True (exactly as upstream states)
      '    top = part.part.edges().filter_by(Axis.X, tolerance=30)'
        + '.sort_by(Axis.Z, tie_break=True)[-2:]',
      '    m = Edge.make_mid_way(top[0], top[1], 0.67)',
      '    p("MIDWAY_" + str(rotation), tuple(m.position_at(0)) + tuple(m.position_at(1)))',
      'show(Box(1, 1, 1))',
    ].join('\n'));

    // The loop satisfies  y^2 + (z + 70)^2 = 6400  and  x^2 + y^2 + z^2 = 2500,
    // hence  x^2 = 1000 + 140 z  with  -1000/140 <= z <= 10.  So:
    //   * x is smallest at z = 10 (where y = 0): the seam is UNIQUE at
    //     (-sqrt(2400), 0, 10) = (-48.98979, 0, 10);
    //   * the loop's area vector is dominated by its XY projection, which winds
    //     counter-clockwise about +Z, so a quarter turn on from the seam is the
    //     x = 0 point with NEGATIVE y: z = -1000/140 = -7.142857 and
    //     y = -sqrt(6400 - (70 - 1000/140)^2) = -49.487166;
    //   * half a turn on is the seam's mirror (+48.98979, 0, 10) and three
    //     quarters is (0, +49.487166, -7.142857).
    const seam = [-Math.sqrt(2400), 0, 10];
    const quarter = [0, -Math.sqrt(6400 - (70 - 1000 / 140) ** 2), -1000 / 140];
    const half = [Math.sqrt(2400), 0, 10];
    const threeQuarters = [0, -quarter[1], -1000 / 140];
    const expected = [...seam, ...quarter, ...half, ...threeQuarters, 320.9223];

    // the RAW seam follows the sphere's meridian - up to 98 mm of travel
    expectClose(got.RAW_0, [48.9898, 0, 10]);
    expectClose(got.RAW_45, [35.3331, 35.3331, 1.7745]);
    expectClose(got.RAW_90, [0, 49.4872, -7.1429]);
    expectClose(got.RAW_180, [-48.9898, 0, 10]);
    expectClose(got.RAW_270, [0, -49.4872, -7.1429]);

    // ... and canonicalizing pins every frame to the same hand-computed values
    for (const rotation of [0, 45, 90, 180, 270]) {
      expectClose(got[`CANON_${rotation}`], expected, 3);
    }

    // joints: same slider axis whatever frame the cutter was created in
    for (const rotation of [0, 90, 180]) {
      expectClose(got[`MIDWAY_${rotation}`],
        [-4.47592, 1.52181, 10, 4.47592, 1.52181, 10], 4);
    }
  });

  test('a reassembled section loop canonicalizes the same way from every frame '
     + 'AND from either traversal', async ({ page }) => {
    await gotoPythonMode(page);
    const got = await runAndCollect(page, [
      // sphere(10) cut by cylinder(r5) standing at x = 6: the section locus is
      // one closed loop that the kernel delivers as 1, 2 or 4 Edges depending on
      // the sphere's frame, so it has to be reassembled into a Wire first
      // (upstream's recipe for the "different NUMBER of edges" case). This is
      // the loop whose extremal band comes in a MIRROR-SYMMETRIC PAIR, and it is
      // the regression that found the three seam defects fixed in the patch:
      // before them, reversing this very Wire canonicalized to the other seam of
      // the loop, winding the other way (reproducible on OCP 7.9.3 alone).
      'def section_loop(rotation):',
      '    sphere = Solid.make_sphere(10)',
      '    if rotation:',
      '        sphere = sphere.rotate(Axis.Z, rotation)',
      '    cutter = Solid.make_cylinder(5, 40, Plane.XY.offset(-20))'
        + '.locate(Location((6, 0, 0)))',
      '    loop = [e for e in sphere.cut(cutter).edges()'
        + ' if e.geom_type == GeomType.BSPLINE]',
      '    return max(edges_to_wires(loop), key=lambda wr: wr.length)',
      'for rotation in (0, 37, 45, 90, 180, 270):',
      '    wire = section_loop(rotation)',
      '    for tag, shape in (("F", wire), ("R", wire.reversed())):',
      '        c = shape.canonical()',
      '        p("LOOP_" + str(rotation) + tag, tuple(c.position_at(0))'
        + ' + tuple(c.position_at(0.25)) + tuple(c.position_at(0.5)) + (c.length,))',
      // a shape whose seam is already its own start must come back UNTOUCHED —
      // the "already canonical" test is a circular distance judged at band-width
      // resolution, not form.start against TOLERANCE/length
      'for name, shape in (("LOOP", section_loop(0).canonical()),',
      '                    ("CIRCLE", Circle(10, mode=Mode.PRIVATE).edges()[0].canonical()),',
      '                    ("RECT", Wire(Rectangle(20, 10, mode=Mode.PRIVATE).edges()).canonical())):',
      '    form = shape.canonical_form()',
      '    wrapped = form.start % 1.0',
      '    box = shape.bounding_box()',
      '    resolution = max(1e-6,'
        + ' CANONICAL_BAND * max(box.size.X, box.size.Y, box.size.Z))',
      '    p("IDENT_" + name,'
        + ' 1 if min(wrapped, 1.0 - wrapped) * shape.length <= resolution else 0,',
      '      1 if shape.canonical() is shape else 0)',
      'show(Box(1, 1, 1))',
    ].join('\n'));

    // The loop's extremal band in x is the PAIR {(1, 0, +9.9499), (1, 0, -9.9499)}
    // — mirror images, so they tie on y once quantised to the band width and z
    // decides: the seam is the NEGATIVE one. A quarter turn on (counter-clockwise
    // about the dominant axis of the area vector, which is X here) is the loop's
    // z = 0 turning point at +y.
    const expected = [1, 0, -9.9499, 9.25, 3.7997, 0, 1, 0, 9.9499, 65.027];
    for (const rotation of [0, 37, 45, 90, 180, 270]) {
      for (const tag of ['F', 'R']) {
        expectClose(got[`LOOP_${rotation}${tag}`], expected, 3);
      }
    }
    for (const name of ['LOOP', 'CIRCLE', 'RECT']) {
      // seam already at the start, and canonical() returned the very same object
      expectClose(got[`IDENT_${name}`], [1, 1]);
    }
  });
});
