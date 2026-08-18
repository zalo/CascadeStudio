// @ts-check
// Tests for the upstream-export parity round: the build123d 0.11.1 __all__
// names that build123d-lite gained (constants, enums, topology helpers,
// singular getters, encoders, Matrix, OrientedBoundBox, the deprecated
// tangent objects, BREP round-trips, project_workplane, FontManager).
// Every numeric expectation below is HARDCODED from running the same script
// through real build123d 0.11.1 in the reference venv
// (~/Desktop/ocjs-deps/b123d-ref-venv) — see the values marked "native".
const { test, expect } = require('@playwright/test');

/** Navigate to the app and wait until it's fully ready. */
async function gotoAndReady(page) {
  await page.goto('/');
  await page.waitForFunction(() => {
    return window.CascadeAPI && window.CascadeAPI.isReady();
  }, { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
}

/** Worker log/error messages arrive asynchronously (postMessage via
 *  setTimeout), so poll for expected console content instead of sampling. */
async function waitForConsole(page, getter, predicate, timeout = 20000) {
  await page.waitForFunction(
    ({ getter, predicate }) => {
      const items = getter === 'errors'
        ? window.CascadeAPI.getErrors() : window.CascadeAPI.getConsoleLog();
      return new Function('items', 'return ' + predicate)(items);
    },
    { getter, predicate }, { timeout }
  );
  return page.evaluate((g) => g === 'errors'
    ? window.CascadeAPI.getErrors() : window.CascadeAPI.getConsoleLog(), getter);
}

/** Run Python that prints "CHK <name> <repr(value)>" lines and a final DONE
 *  marker; returns {name: valueString}. The first Python evaluation also
 *  boots Brython, hence the generous timeout. */
async function runChecks(page, code, timeout = 90000) {
  const result = await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
  expect(result.errors).toEqual([]);
  expect(result.success).toBe(true);
  const logs = await waitForConsole(page, 'logs',
    'items.some(l => typeof l === "string" && l.indexOf("DONE_UPSTREAM") === 0)',
    timeout);
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors).toEqual([]);
  const checks = {};
  for (const line of logs) {
    if (typeof line !== 'string' || !line.startsWith('CHK ')) { continue; }
    const rest = line.slice(4);
    const space = rest.indexOf(' ');
    checks[rest.slice(0, space)] = rest.slice(space + 1);
  }
  return checks;
}

test.describe('Python mode: upstream build123d exports', () => {
  test('constants, enums, topology helpers and singular getters', async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      'from build123d import *',
      'print("CHK", "MC", repr(MC))',
      'print("CHK", "upm", repr([round(UNITS_PER_METER[Unit.IN], 9),',
      '                          UNITS_PER_METER[Unit.MC], UNITS_PER_METER[Unit.M]]))',
      'print("CHK", "enums", repr([ApproxOption.SPLINE, FrameMethod.FRENET,',
      '    MeshType.MODEL, NumberDisplay.FRACTION, PageSize.A4,',
      '    PositionMode.LENGTH]))',
      '# PrecisionMode keeps upstream member VALUES exactly',
      'print("CHK", "precision", repr((PrecisionMode.SESSION,',
      '    PrecisionMode.GREATEST, PrecisionMode.AVERAGE)))',
      'print("CHK", "polar", repr(tuple(round(v, 6) for v in polar(10, 30))))',
      'b = Box(10, 20, 30)',
      'es = b.edges()',
      '# native build123d: delta 3, conn 4, conn_c1 0, common_v True',
      'print("CHK", "delta", repr(len(delta(es, es[3:]))))',
      'conn = topo_explore_connected_edges(es[0], parent=b)',
      'print("CHK", "conn", repr(len(conn)))',
      'print("CHK", "conn_c1", repr(len(topo_explore_connected_edges(',
      '    es[0], parent=b, continuity=ContinuityLevel.C1))))',
      'print("CHK", "common_v", repr(',
      '    topo_explore_common_vertex(es[0], conn[0]) is not None))',
      'with BuildPart() as bp:',
      '    Box(5, 5, 5)',
      '    print("CHK", "solid_ok", repr(solid() is not None))',
      '    try:',
      '        face()',
      '        print("CHK", "face_raises", repr(False))',
      '    except ValueError as e:',
      '        print("CHK", "face_raises", repr(str(e)))',
      'with BuildLine() as bl:',
      '    l1 = Line((0, 0), (10, 0))',
      '    blo = BaseLineObject(Wire([Edge.make_line((10, 0, 0), (10, 10, 0))]))',
      '    print("CHK", "one_wire", repr(wire() is not None))',
      'print("CHK", "bl_len", repr(round(bl.line.length, 6)))',
      'show(b)',
      'print("DONE_UPSTREAM")',
    ].join('\n');
    const c = await runChecks(page, code);
    expect(c.MC).toBe('0.001');
    expect(c.upm).toBe('[39.37007874, 1000000.0, 1]');
    expect(c.enums).toBe("['SPLINE', 'FRENET', 'MODEL', 'FRACTION', 'A4', 'LENGTH']");
    expect(c.precision).toBe('(2, 1, 0)');
    expect(c.polar).toBe('(8.660254, 5.0)');
    expect(c.delta).toBe('3');            // native: 3
    expect(c.conn).toBe('4');             // native: 4
    expect(c.conn_c1).toBe('0');          // native: 0
    expect(c.common_v).toBe('True');
    expect(c.solid_ok).toBe('True');
    // native error text, verbatim
    expect(c.face_raises).toBe("'Expected exactly one face, found 6'");
    expect(c.one_wire).toBe('True');
    expect(c.bl_len).toBe('20');
  });

  test('Matrix, Geom/Location encoders, OrientedBoundBox, FontManager', async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      'from build123d import *',
      'import json',
      'm = Matrix()',
      'm.rotate(Axis.Z, 90)',
      'm2 = m.multiply(Matrix([[1, 0, 0, 5], [0, 1, 0, 0], [0, 0, 1, 0]]))',
      '# native rows: [[0,-1,0,0],[1,0,0,5],[0,0,1,0],[0,0,0,1]]',
      'print("CHK", "m2_rows", repr([[round(m2[i, j], 9) for j in range(4)]',
      '                              for i in range(4)]))',
      'print("CHK", "m2_v", repr([round(v, 9) for v in m2.multiply(Vector(1, 2, 3))]))',
      'print("CHK", "mi_v", repr([round(v, 9) for v in m.inverse().multiply(Vector(1, 0, 0))]))',
      'ax = Axis((1, 1, 0), (0, 0, 1))',
      'm3 = Matrix()',
      'm3.rotate(ax, 90)',
      'print("CHK", "m3_v", repr([round(v, 9) for v in m3.multiply(Vector(2, 1, 0))]))',
      '# decoding single geometry dicts (the working upstream pattern)',
      'v = json.loads(chr(123) + chr(34) + "Vector" + chr(34) + ": [1.0, 2.0, 3.0]" + chr(125),',
      '               object_hook=GeomEncoder.geometry_hook)',
      'print("CHK", "dec_v", repr([round(x, 9) for x in v]))',
      'loc = Location((1, 2, 3), (10, 20, 30))',
      'rt = json.loads(json.dumps(loc, cls=GeomEncoder),',
      '                object_hook=GeomEncoder.geometry_hook)',
      'print("CHK", "geom_rt", repr([round(x, 6) for x in',
      '                              tuple(rt.position) + tuple(rt.orientation)]))',
      'rt2 = json.loads(json.dumps(dict(j=loc), cls=LocationEncoder, indent=4),',
      '                 object_hook=LocationEncoder.location_hook)["j"]',
      'print("CHK", "loc_rt", repr([round(x, 6) for x in',
      '                             tuple(rt2.position) + tuple(rt2.orientation)]))',
      '# a multi-key dict raises through geometry_hook, exactly like upstream',
      'try:',
      '    json.loads(json.dumps(dict(a=Axis.X, b=Vector(1, 2, 3)), cls=GeomEncoder),',
      '               object_hook=GeomEncoder.geometry_hook)',
      '    print("CHK", "multi", repr("no raise"))',
      'except ValueError:',
      '    print("CHK", "multi", repr("raises"))',
      'big = OrientedBoundBox(Box(10, 20, 30))',
      'small = OrientedBoundBox(Box(5, 5, 5))',
      '# native: size [10,20,30], diagonal 37.416574, 8 corners,',
      '# big.is_completely_inside(small) True (OCCT: does BIG contain OTHER)',
      'print("CHK", "obb_size", repr(sorted(round(v, 6) for v in big.size)))',
      'print("CHK", "obb_diag", repr(round(big.diagonal, 6)))',
      'print("CHK", "obb_center", repr([round(v, 6) for v in big.center()]))',
      'print("CHK", "obb_corners", repr(len(big.corners)))',
      'print("CHK", "obb_contains", repr((big.is_completely_inside(small),',
      '                                   small.is_completely_inside(big))))',
      'print("CHK", "obb_out", repr((big.is_outside((100, 0, 0)),',
      '                              big.is_outside((0, 0, 0)))))',
      '# COMPROMISE(text): only the bundled FreeSans family exists here',
      'print("CHK", "fonts", repr(available_fonts()))',
      'print("CHK", "find_font", repr(FontManager().find_font("Arial", FontStyle.BOLD)))',
      'print("CHK", "check_font", repr(FontManager().check_font("/x.ttf") is None))',
      'try:',
      '    FontManager().register_font("x.ttf")',
      '    print("CHK", "reg_font", repr("no raise"))',
      'except NotImplementedError:',
      '    print("CHK", "reg_font", repr("raises"))',
      'print("CHK", "dae", repr(issubclass(DraftAngleError, RuntimeError)))',
      'show(Box(1, 1, 1))',
      'print("DONE_UPSTREAM")',
    ].join('\n');
    const c = await runChecks(page, code);
    expect(c.m2_rows).toBe('[[0.0, -1.0, 0.0, 0.0], [1.0, 0.0, 0.0, 5.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]]');
    expect(c.m2_v).toBe('[-2.0, 6.0, 3.0]');
    expect(c.mi_v).toBe('[0.0, -1.0, 0.0]');
    expect(c.m3_v).toBe('[1.0, 2.0, 0.0]');
    expect(c.dec_v).toBe('[1.0, 2.0, 3.0]');
    expect(c.geom_rt).toBe('[1.0, 2.0, 3.0, 10.0, 20.0, 30.0]');
    expect(c.loc_rt).toBe('[1.0, 2.0, 3.0, 10.0, 20.0, 30.0]');
    expect(c.multi).toBe("'raises'");
    expect(c.obb_size).toBe('[10.0, 20.0, 30.0]');   // native
    expect(c.obb_diag).toBe('37.416574');            // native
    expect(c.obb_center).toBe('[0.0, 0.0, 0.0]');    // native
    expect(c.obb_corners).toBe('8');                 // native
    expect(c.obb_contains).toBe('(True, False)');    // native
    expect(c.obb_out).toBe('(True, False)');
    expect(c.fonts).toBe(
      '[Font(name=\'FreeSans\', styles=(\'REGULAR\', \'BOLD\', \'BOLDITALIC\', \'ITALIC\'))]');
    expect(c.find_font).toBe("'FreeSansBold'");
    expect(c.check_font).toBe('True');
    expect(c.reg_font).toBe("'raises'");
    expect(c.dae).toBe('True');
  });

  test('deprecated tangent objects match native build123d', async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      'from build123d import *',
      '',
      'def dump(name, e):',
      '    p0, p1 = e @ 0, e @ 1',
      '    print("CHK", name, repr((round(e.length, 6),',
      '                             [round(v, 6) for v in p0],',
      '                             [round(v, 6) for v in p1])))',
      '',
      'with BuildLine() as bl1:',
      '    c = CenterArc((20, 5), 5, 0, 360)',
      '    t = PointArcTangentLine((0, 0), c, side=Side.LEFT)',
      'dump("patl_l", t)',
      'with BuildLine() as bl2:',
      '    c = CenterArc((20, 5), 5, 0, 360)',
      '    t = PointArcTangentLine((0, 0), c, side=Side.RIGHT)',
      'dump("patl_r", t)',
      'with BuildLine() as bl3:',
      '    c1 = CenterArc((0, 0), 5, 0, 360)',
      '    c2 = CenterArc((30, 10), 8, 0, 360)',
      '    for side in (Side.LEFT, Side.RIGHT):',
      '        for keep in (Keep.INSIDE, Keep.OUTSIDE):',
      '            t = ArcArcTangentLine(c1, c2, side=side, keep=keep,',
      '                                  mode=Mode.PRIVATE)',
      '            dump("aatl_" + side + "_" + keep, t)',
      'with BuildLine() as bl4:',
      '    c = CenterArc((30, 5), 6, 0, 360)',
      '    for side in (Side.LEFT, Side.RIGHT):',
      '        t = PointArcTangentArc((0, 0), (1, 0.4), c, side=side,',
      '                               mode=Mode.PRIVATE)',
      '        dump("pata_" + side, t)',
      'with BuildLine() as bl5:',
      '    c1 = CenterArc((0, 0), 5, 0, 360)',
      '    c2 = CenterArc((30, 10), 8, 0, 360)',
      '    for side in (Side.LEFT, Side.RIGHT):',
      '        for keep in ((Keep.INSIDE, Keep.INSIDE),',
      '                     (Keep.OUTSIDE, Keep.OUTSIDE),',
      '                     (Keep.OUTSIDE, Keep.INSIDE)):',
      '            t = ArcArcTangentArc(c1, c2, 40, side=side, keep=keep,',
      '                                 mode=Mode.PRIVATE)',
      '            dump("aata_" + side + "_" + keep[0] + "_" + keep[1], t)',
      '# algebra mode (no builder context)',
      'c = CenterArc((20, 5), 5, 0, 360, mode=Mode.PRIVATE)',
      't = PointArcTangentLine((0, 0), c, side=Side.LEFT, mode=Mode.PRIVATE)',
      'dump("alg_patl", t)',
      'show(Box(1, 1, 1))',
      'print("DONE_UPSTREAM")',
    ].join('\n');
    const c = await runChecks(page, code);
    // every value below is the native build123d 0.11.1 result, verbatim
    // (lengths and endpoints to 6 decimals)
    const native = {
      patl_l: '(20.0, [0.0, 0.0, 0.0], [17.647059, 9.411765, 0.0])',
      patl_r: '(20, [0.0, 0.0, 0.0], [20.0, 0.0, 0.0])',
      aatl_LEFT_INSIDE: '(28.827071, [0.508646, 4.974061, 0.0], [29.186166, 2.041503, 0.0])',
      aatl_LEFT_OUTSIDE: '(31.480152, [-2.024008, 4.572023, 0.0], [26.761588, 17.315237, 0.0])',
      aatl_RIGHT_INSIDE: '(28.827071, [3.391354, -3.674061, 0.0], [24.573834, 15.878497, 0.0])',
      aatl_RIGHT_OUTSIDE: '(31.480152, [1.124008, -4.872023, 0.0], [31.798412, 2.204763, 0.0])',
      pata_LEFT: '(29.918505, [0.0, 0.0, 0.0], [27.960113, 10.642593, 0.0])',
      pata_RIGHT: '(28.322732, [-0.0, 0.0, 0.0], [27.575763, -0.488449, 0.0])',
      aata_LEFT_INSIDE_INSIDE: '(28.747011, [22.959013, 13.797961, 0.0], [1.749417, -4.683966, 0.0])',
      aata_LEFT_OUTSIDE_OUTSIDE: '(27.640454, [24.508159, 15.817189, 0.0], [-0.327894, 4.989237, 0.0])',
      aata_LEFT_OUTSIDE_INSIDE: '(31.169002, [32.526072, 2.409285, 0.0], [2.210635, 4.484762, 0.0])',
      aata_RIGHT_INSIDE_INSIDE: '(28.747011, [-1.410846, 4.796823, 0.0], [26.645987, 2.737039, 0.0])',
      aata_RIGHT_OUTSIDE_OUTSIDE: '(27.640454, [2.731227, -4.188126, 0.0], [29.096841, 2.051145, 0.0])',
      aata_RIGHT_OUTSIDE_INSIDE: '(31.169002, [4.459365, -2.261429, 0.0], [27.466428, 17.588215, 0.0])',
      alg_patl: '(20.0, [0.0, 0.0, 0.0], [17.647059, 9.411765, 0.0])',
    };
    for (const [name, value] of Object.entries(native)) {
      expect(c[name], name).toBe(value);
    }
  });

  test('BREP round-trip and project_workplane match native', async ({ page }) => {
    await gotoAndReady(page);
    const code = [
      'from build123d import *',
      'b = Box(4, 6, 8)',
      'ok = export_brep(b, "roundtrip.brep")',
      'back = import_brep("roundtrip.brep")',
      'print("CHK", "brep", repr((ok, round(back.volume, 6),',
      '                           [round(v, 6) for v in back.bounding_box().size])))',
      'try:',
      '    import_brep("never_written.brep")',
      '    print("CHK", "brep_missing", repr("no raise"))',
      'except ValueError:',
      '    print("CHK", "brep_missing", repr("raises"))',
      '# native: origin (0,0,30), x_dir (0.707107, 0.707107, 0), z_dir (0,0,1)',
      'wp = project_workplane((0, 0, 0), (1, 1, 0), (0, 0, 1), 30)',
      'print("CHK", "pwp", repr(([round(v, 6) for v in wp.origin],',
      '                          [round(v, 6) for v in wp.x_dir],',
      '                          [round(v, 6) for v in wp.z_dir])))',
      '# native (tilted): origin (4,6,11.660254),',
      '# x_dir (-0.33512, 0.894169, -0.29691), z_dir (0.3, 0.4, 0.866025)',
      'wp2 = project_workplane((1, 2, 3), (0, 1, 0.5),',
      '                        (0.3, 0.4, 0.8660254037844386), 10)',
      'print("CHK", "pwp2", repr(([round(v, 6) for v in wp2.origin],',
      '                           [round(v, 6) for v in wp2.x_dir],',
      '                           [round(v, 6) for v in wp2.z_dir])))',
      '# native raises Standard_ConstructionError (zero-norm x_dir); lite',
      '# raises ValueError from the same zero-length normalization',
      'try:',
      '    project_workplane((0, 0, 0), (0, 0, 1), (0, 0, 1), 10)',
      '    print("CHK", "pwp_perp", repr("no raise"))',
      'except Exception:',
      '    print("CHK", "pwp_perp", repr("raises"))',
      'show(b)',
      'print("DONE_UPSTREAM")',
    ].join('\n');
    const c = await runChecks(page, code);
    expect(c.brep).toBe('(True, 192.0, [4.0, 6.0, 8.0])');
    expect(c.brep_missing).toBe("'raises'");
    expect(c.pwp).toBe('([0.0, 0.0, 30.0], [0.707107, 0.707107, 0.0], [0.0, 0.0, 1.0])');
    expect(c.pwp2).toBe('([4.0, 6.0, 11.660254], [-0.33512, 0.894169, -0.29691], [0.3, 0.4, 0.866025])');
    expect(c.pwp_perp).toBe("'raises'");
  });
});
