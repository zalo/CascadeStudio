// @ts-check
// The final crossover leg: `?pyruntime=pyodide&pysrc=real` runs REAL,
// UNMODIFIED build123d 0.11.1 (the actual PyPI wheel — real CPython
// semantics, real numpy, native metaclasses/typing, zero source transforms,
// zero stdlib shims) with the OCP-over-embind shim as the ONLY substitution
// (see packages/cascade-core/src/worker/PyodideRealB123d.js). Frozen here:
// the bring-up goals, the guard rails around the flag, and the headline
// finding that REAL drafting (Draft/DimensionLine — an honest gap on every
// other leg) works on this leg. Skips when the Pyodide distribution / wheels
// have not been vendored (node packages/cascade-core/scripts/fetch-pyodide.cjs).
const { test, expect } = require('@playwright/test');

async function gotoAndReady(page, query = '') {
  await page.goto('/' + query);
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 120000 });
}

async function realAvailable(page) {
  return page.evaluate(async () => {
    try {
      const core = await fetch('pyodide/pyodide.mjs', { method: 'HEAD' });
      const wheel = await fetch('pyodide/build123d-0.11.1-py3-none-any.whl',
        { method: 'HEAD' });
      return core.ok && wheel.ok;
    } catch (e) { return false; }
  });
}

async function waitForLog(page, prefix) {
  await page.waitForFunction(
    (p) => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith(p)),
    prefix, { timeout: 120000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  return logs.find((l) => l.startsWith(prefix));
}

test('pysrc=real runs REAL build123d 0.11.1 on Pyodide over the OCP shim', async ({ page }) => {
  await gotoAndReady(page, '?pyruntime=pyodide&pysrc=real');
  test.skip(!(await realAvailable(page)),
    'vendor/pyodide (+ wheels) not fetched — pysrc=real disabled');

  // the default Python starter evaluated on load with no errors
  const startupErrors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(startupErrors).toEqual([]);

  // Goal 1: the package IS the real wheel (version, real numpy, native Enum)
  const r1 = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'import sys, enum, build123d, numpy, anytree',
    'from build123d import *',
    'print("REAL1",',
    '      build123d.__version__,',
    '      numpy.__version__ != "",',
    '      isinstance(Align.CENTER, enum.Enum),',
    '      anytree.__name__ == "anytree",',
    '      getattr(build123d, "_cs_pysrc", None))',
  ].join('\n'));
  expect(r1.errors).toEqual([]);
  expect(await waitForLog(page, 'REAL1 ')).toBe('REAL1 0.11.1 True True True real');

  // Goal 2: a BuildPart Box through the REAL builders + the OCP shim
  const r2 = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'with BuildPart() as p:',
    '    Box(5, 5, 5)',
    '    fillet(p.edges().filter_by(Axis.Z), 1)',
    'bb = p.part.bounding_box()',
    'print("REAL2", round(p.part.volume, 6),',
    '      tuple(float(c) for c in bb.min), tuple(float(c) for c in bb.max))',
    'show(p.part)',
  ].join('\n'));
  expect(r2.errors).toEqual([]);
  // 125 - 4 vertical fillets of (1 - pi/4) * 5 = 120.707963
  expect(await waitForLog(page, 'REAL2 ')).toBe(
    'REAL2 120.707963 (-2.5, -2.5, -2.5) (2.5, 2.5, 2.5)');
});

test('REAL drafting (Draft/DimensionLine) works on the real leg', async ({ page }) => {
  // Every other leg records `drafting` as an honest gap (docs/objects_2d
  // lands on "NameError: Draft"); on pysrc=real the REAL drafting.py runs
  // over Text -> Compound.make_text (glue-routed to the opentype.js path).
  await gotoAndReady(page, '?pyruntime=pyodide&pysrc=real');
  test.skip(!(await realAvailable(page)),
    'vendor/pyodide (+ wheels) not fetched — pysrc=real disabled');
  const r = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'from build123d.drafting import Draft, DimensionLine',
    'with BuildSketch() as s:',
    '    Rectangle(40, 20)',
    '    d = Draft(font_size=3)',
    '    DimensionLine([(-20, -10), (20, -10)], draft=d)',
    // the dimension arrows+label ADD area beyond the bare 40x20 rectangle
    'print("DRAFTCHECK", s.sketch.area > 800.5, type(d).__name__)',
  ].join('\n'));
  expect(r.errors).toEqual([]);
  expect(await waitForLog(page, 'DRAFTCHECK ')).toBe('DRAFTCHECK True Draft');
});

test('real-leg errors carry the Python traceback with user line numbers', async ({ page }) => {
  await gotoAndReady(page, '?pyruntime=pyodide&pysrc=real');
  test.skip(!(await realAvailable(page)),
    'vendor/pyodide (+ wheels) not fetched — pysrc=real disabled');
  await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'part = Box(1, 1, 1)',
    'part.no_such_method()',
  ].join('\n'));
  // worker errors post asynchronously — poll rather than sample runCode's
  await page.waitForFunction(
    () => window.CascadeAPI.getErrors().length > 0, { timeout: 90000 });
  const text = (await page.evaluate(() => window.CascadeAPI.getErrors())).join('\n');
  expect(text).toContain('Python AttributeError');
  expect(text).toContain('line 3');
});

test('pysrc=real is pyodide-only and the flag stays default-OFF', async ({ page }) => {
  // pysrc=real on a non-Pyodide runtime fails loudly, not silently
  await gotoAndReady(page, '?pysrc=real');
  await page.evaluate(() => window.CascadeAPI.runCode('part = Box(1, 1, 1)'));
  await page.waitForFunction(
    () => window.CascadeAPI.getErrors().length > 0, { timeout: 90000 });
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors.join('\n')).toContain('pysrc=real');

  // a bare ?pyruntime=pyodide load still boots build123d-lite (default OFF)
  await gotoAndReady(page, '?pyruntime=pyodide');
  const r = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'import build123d',
    'print("OFFCHECK", getattr(build123d, "_cs_pysrc", "lite"))',
  ].join('\n'));
  expect(r.errors).toEqual([]);
  expect(await waitForLog(page, 'OFFCHECK ')).toBe('OFFCHECK lite');
});
