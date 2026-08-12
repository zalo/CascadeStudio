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

    // Switching modes swaps in the Python starter (previous content was the JS starter)
    const starter = await page.evaluate(() => {
      window.CascadeAPI.setMode('python');
      return window.CascadeAPI.getCode();
    });
    expect(await page.evaluate(() => window.CascadeAPI.getMode())).toBe('python');
    expect(starter).toContain('from build123d import *');
    expect(starter).toContain('part = Box(40, 30, 10) - Pos(0, 0, 0) * Cylinder(8, 20)');
    expect(starter).toContain('part = fillet(part.edges(), 2)');
    expect(starter).toContain('show(part)');

    const result = await runCodeAndRender(page, starter, 1);
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);

    // History steps carry real Python line numbers (via Brython's frame chain)
    const fnNames = result.historySteps.map((s) => s.fnName);
    expect(fnNames).toEqual(expect.arrayContaining(['Box', 'Cylinder', 'Difference', 'FilletEdges']));
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
