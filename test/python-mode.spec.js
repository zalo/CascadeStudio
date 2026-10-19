// @ts-check
// Tests for the Python (build123d-lite) language mode.
// Python code is evaluated in the CAD worker by Brython (lazy-loaded on the
// first Python evaluation); the build123d-lite module wraps the standard
// library, so shapes/booleans flow through the same scene bookkeeping.
const { test, expect } = require('@playwright/test');

/** Navigate to the app and wait until it's fully ready. */
async function gotoAndReady(page) {
  await page.goto('/');
  await page.waitForFunction(() => {
    return window.CascadeAPI && window.CascadeAPI.isReady();
  }, { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
}

/** Run code via the API and wait for the render to land. The first Python
 *  evaluation also fetches + boots Brython, hence the generous timeout. */
async function runCodeAndRender(page, code, expectedShapes, timeout = 90000) {
  const result = await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
  await page.waitForFunction(
    (n) => window.threejsViewport._shapeLines.length === n,
    expectedShapes, { timeout }
  );
  return result;
}

/** Worker log/error messages arrive asynchronously (postMessage via
 *  setTimeout), so poll for expected console content instead of sampling. */
async function waitForConsole(page, getter, predicate, timeout = 15000) {
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

/** In-page helper source (same as gui-tools.spec.js): project CAD coords to
 *  screen and fire pointer events on the viewport canvas. */
const POINTER_HELPERS = `
  function screenOfCad(x, y, z) {
    var env = window.threejsViewport.environment;
    var rect = env.renderer.domElement.getBoundingClientRect();
    var v = env.camera.position.clone().set(x, z, -y).project(env.camera);
    return { x: rect.left + (v.x + 1) / 2 * rect.width,
             y: rect.top + (1 - (v.y + 1) / 2) * rect.height };
  }
  function fire(type, pt) {
    var canvas = window.threejsViewport.environment.renderer.domElement;
    canvas.dispatchEvent(new PointerEvent(type, {
      clientX: pt.x, clientY: pt.y, button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      bubbles: true, cancelable: true, pointerId: 1
    }));
  }
`;

test.describe('Python (build123d) mode', () => {
  test('starter script evaluates with no errors and renders shapes', async ({ page }) => {
    await gotoAndReady(page);

    // Python is the default mode on a fresh load, so the starter is already in
    // the editor (setMode('python') is a no-op here, and stays correct if the
    // default ever moves again)
    const starter = await page.evaluate(() => {
      window.CascadeAPI.setMode('python');
      return window.CascadeAPI.getCode();
    });
    expect(await page.evaluate(() => window.CascadeAPI.getMode())).toBe('python');
    expect(starter).toContain('from build123d import *');
    expect(starter).toContain('plate = fillet(plate.edges().filter_by(Axis.Z), 12)');
    expect(starter).toContain('mount -= GridLocations(');
    expect(starter).toContain('mount = fillet(mount.edges().group_by(Axis.Z)[-1], 1.5)');
    expect(starter).toContain('show(mount)');

    const result = await runCodeAndRender(page, starter, 1);
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);

    // History steps carry real Python line numbers (via Brython's frame chain)
    const fnNames = result.historySteps.map((s) => s.fnName);
    expect(fnNames).toEqual(expect.arrayContaining(['Box', 'Cylinder', 'Union', 'Difference', 'FilletEdges']));
    for (const step of result.historySteps) {
      expect(step.lineNumber).toBeGreaterThan(0);
    }

    // print(volume(...)) reaches the console (posted asynchronously)
    const logs = await waitForConsole(page, 'logs',
      'items.some(l => l.startsWith("volume:"))');
    expect(logs.join('\n')).toContain('volume:');
  });

  test('algebra ops produce sane volumes (union / difference)', async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.CascadeAPI.setMode('python'));

    const code = [
      'from build123d import *',
      'a = Box(20, 20, 20)',
      'b = Pos(5, 0, 0) * Box(20, 20, 20)',
      'u = a + b',
      'print("union_volume", volume(u))',
      'd = Pos(0, 40, 0) * (Box(20, 20, 20) - Cylinder(5, 40))',
      'print("diff_volume", volume(d))',
      'show(u, d)',
    ].join('\n');

    const result = await runCodeAndRender(page, code, 2);
    expect(result.errors).toEqual([]);

    const logs = await waitForConsole(page, 'logs',
      'items.some(l => l.startsWith("union_volume")) && items.some(l => l.startsWith("diff_volume"))');
    const grab = (tag) => parseFloat(logs.find((l) => l.startsWith(tag)).split(' ')[1]);
    // Two 20^3 boxes overlapping by 15 along X: 8000 + 8000 - 15*20*20 = 10000
    expect(grab('union_volume')).toBeCloseTo(10000, 0);
    // 20^3 minus a through-hole of r=5: 8000 - pi*25*20 ~= 6429.2
    expect(grab('diff_volume')).toBeCloseTo(8000 - Math.PI * 25 * 20, 0);
  });

  test('show(obj, "name"): a re-shown name replaces its shape and keeps its place; harness helpers', async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.CascadeAPI.setMode('python'));
    const code = [
      'from build123d import *',
      'base = Box(40, 30, 6)',
      'show(base, "base")',
      'pin = Pos(0, 0, 8) * Cylinder(3, 10)',
      'show(pin, "pin")',
      'base = base - Cylinder(3, 20)',
      'show(base, "base")',
      'show([Pos(30, 0, 0) * Box(2, 2, 2), Pos(35, 0, 0) * Box(2, 2, 2)], "cubes")',
      'print("top_z", named_face(base, "top").center().Z)',
      'find_edges(base, geom="circle", radius=3)',
      'import build123d as b',
      'print("described", b._cs_describe(b._cs_shown_object("pin").faces().filter_by(GeomType.CYLINDER)[0]))',
    ].join('\n');
    // base (re-shown, not doubled), pin, cubes[0], cubes[1]
    const result = await runCodeAndRender(page, code, 4);
    expect(result.errors).toEqual([]);
    // the cut base (line 6) keeps index 0, ahead of the pin (line 4)
    const lines = await page.evaluate(() => window.threejsViewport._shapeLines.slice());
    expect(lines.slice(0, 2)).toEqual([6, 4]);
    const logs = await waitForConsole(page, 'logs', 'items.some(l => l.startsWith("described"))');
    expect(logs).toContain('top_z 3.0');
    expect(logs.some((l) => /^find_edges: 2 edge\(s\) matched, radii \[3(\.0)?\]/.test(l))).toBe(true);
    // the console log keeps quotes backslash-escaped
    const d = JSON.parse(logs.find((l) => l.startsWith('described')).slice('described '.length).replace(/\\"/g, '"'));
    expect(d.geom_type).toBe('CYLINDER');
    expect(d.radius).toBe(3);
  });

  test('vendored build123d_drafting and augura import on first mention (Brython lazy modules)', async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.CascadeAPI.setMode('python'));
    const code = [
      'from build123d import *',
      'from build123d_drafting import find_holes, find_hole_patterns, recognise_countersinks',
      'import augura',
      'with BuildPart() as p:',
      '    Box(60, 40, 8)',
      '    with PolarLocations(12, 4):',
      '        Hole(radius=2)',
      '    with Locations((22, 12, 4)):',
      '        CounterSinkHole(radius=2, counter_sink_radius=4)',
      'holes = find_holes(p.part)',
      'print("holes", len(holes))',
      'print("patterns", [type(x).__name__ for x in find_hole_patterns(holes)])',
      'print("csink", [c["included_angle"] for c in recognise_countersinks(p.part)])',
      'wall = Box(40, 30, 5) + Pos(0, 0, 10) * Box(0.5, 20, 15)',
      'print("augura", [f.kind for f in augura.analyze(wall).findings])',
      'show(p.part, "plate")',
    ].join('\n');
    const result = await runCodeAndRender(page, code, 1);
    expect(result.errors).toEqual([]);
    const logs = await waitForConsole(page, 'logs', 'items.some(l => l.startsWith("augura"))');
    expect(logs).toContain('holes 5');
    expect(logs.some((l) => /^patterns .*BoltCircle/.test(l))).toBe(true);
    expect(logs.some((l) => /^csink \[82(\.0)?\]/.test(l))).toBe(true);
    expect(logs.some((l) => /^augura .*thin_wall/.test(l))).toBe(true);
  });

  test('the part library (cs_parts) and the drafting module run in the browser', async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.CascadeAPI.setMode('python'));
    const code = [
      'from build123d import *',
      'import cs_parts',
      'nut = cs_parts.load("hex_nut", size="M8")',
      'gear = Pos(40, 0, 0) * cs_parts.load("spur_gear", module=2, teeth=12)',
      'print("parts", len(cs_parts.search("bearing")), round(nut.volume, 1))',
      'd = Draft(font_size=3.0)',
      'with BuildSketch() as sk:',
      '    Rectangle(40, 20)',
      '    e = ExtensionLine([(-20, 10), (20, 10)], -6, d)',
      'print("dims", round(e.dimension, 2), len(sk.sketch.faces()) > 1, round(sk.sketch.bounding_box().max.Y, 1) >= 16)',
      'show(nut, "nut", gear, "gear")',
    ].join('\n');
    const result = await runCodeAndRender(page, code, 2);
    expect(result.errors).toEqual([]);
    const logs = await waitForConsole(page, 'logs', 'items.some(l => l.startsWith("dims"))');
    // M8 ISO 4032 nut: 641.1 mm^3 (13 across flats, 6.8 high, 30 deg chamfers, 8 mm bore)
    expect(logs.some((l) => /^parts 1 641\.1$/.test(l))).toBe(true);
    // a 40 mm dimension, drawn 6 mm above the rectangle's top edge (offset < 0 = left of a +X path)
    expect(logs.some((l) => /^dims 40(\.0)? True True$/.test(l))).toBe(true);   // Brython prints round(40.0, 2) as 40
  });

  test('Python errors surface as console errors with the traceback', async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.CascadeAPI.setMode('python'));

    // Runtime error: line numbers refer to the user's editor lines
    await page.evaluate((c) => window.CascadeAPI.runCode(c),
      'from build123d import *\nb = Box(10, 10, 10)\nq = undefined_name + 1\n');
    let errors = await waitForConsole(page, 'errors',
      'items.some(e => e.includes("NameError"))');
    const nameError = errors.find((e) => e.includes('NameError'));
    expect(nameError).toContain("name 'undefined_name' is not defined");
    expect(nameError).toContain('line 3'); // the user's editor line

    // Syntax error
    await page.evaluate((c) => window.CascadeAPI.runCode(c),
      'from build123d import *\ndef f(:\n');
    errors = await waitForConsole(page, 'errors',
      'items.some(e => e.includes("SyntaxError"))');
    expect(errors.find((e) => e.includes('SyntaxError'))).toContain("'(' was never closed");
  });

  test('GUI Box tool in Python mode emits Pos * Box that round-trips; Sketch is disabled', async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.CascadeAPI.setMode('python'));
    await runCodeAndRender(page, 'from build123d import *\nshow(Box(10, 10, 10))\n', 1);

    // Sketch tool refuses to activate in Python mode (grayed out)
    const sketch = await page.evaluate(() => {
      window.CascadeAPI._tools.activate('sketch');
      return {
        activeTool: window.CascadeAPI._tools.activeToolName,
        disabled: !!document.querySelector('.cs-tool-btn[data-tool="sketch"].cs-tool-disabled'),
      };
    });
    expect(sketch.activeTool).toBe('select');
    expect(sketch.disabled).toBe(true);

    // Drive the box tool: drag footprint (20,20)->(60,50), then height to 25.
    // build123d's Box is centered, so the emitted Pos is the box CENTER.
    const code = await page.evaluate((helpers) => {
      eval(helpers);
      window.CascadeAPI._tools.activate('box');
      fire('pointerdown', screenOfCad(20, 20, 0));
      fire('pointermove', screenOfCad(60, 50, 0));
      fire('pointerup',   screenOfCad(60, 50, 0));
      fire('pointermove', screenOfCad(40, 35, 25));
      fire('pointerdown', screenOfCad(40, 35, 25)); // commit
      fire('pointerup',   screenOfCad(40, 35, 25));
      return window.CascadeAPI.getCode();
    }, POINTER_HELPERS);
    expect(code).toContain('box1 = Pos(40, 35, 12.5) * Box(40, 30, 25)');

    // The commit triggered an evaluation — scene gains a shape, no errors
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
    await page.waitForFunction(
      () => window.threejsViewport._shapeLines.length === 2, undefined, { timeout: 60000 });
    expect(await page.evaluate(() => window.CascadeAPI.getErrors())).toEqual([]);

    // Round-trip: the emitted editor code re-runs cleanly
    const editorCode = await page.evaluate(() => window.CascadeAPI.getCode());
    const rerun = await runCodeAndRender(page, editorCode, 2);
    expect(rerun.errors).toEqual([]);
  });
});
