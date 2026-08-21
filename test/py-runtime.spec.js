// @ts-check
// The Python-interpreter flag: Python mode runs on Brython by default, on
// Pyodide (real CPython on wasm) with ?pyruntime=pyodide, and on MicroPython
// (smallest + lowest memory) with ?pyruntime=micropython. All three execute
// the same Build123dLite.js source — see
// test/b123d-validation/runtime-comparison.md for the measurements.
const { test, expect } = require('@playwright/test');

async function gotoAndReady(page, query = '') {
  await page.goto('/' + query);
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
}

/** Pyodide is vendored, not a dependency (13.5 MB): skip when the build had
 *  nothing to copy (see packages/cascade-core/scripts/fetch-pyodide.cjs). */
async function pyodideAvailable(page) {
  return page.evaluate(async () => {
    try {
      const response = await fetch('pyodide/pyodide.mjs', { method: 'HEAD' });
      return response.ok;
    } catch (e) { return false; }
  });
}

test('Python runtime defaults to Brython and the flag selects Pyodide', async ({ page }) => {
  await gotoAndReady(page);
  expect(await page.evaluate(() => window.CascadeAPI.getPyRuntime())).toBe('brython');

  await gotoAndReady(page, '?pyruntime=pyodide');
  expect(await page.evaluate(() => window.CascadeAPI.getPyRuntime())).toBe('pyodide');

  // An unknown value must not silently become an experimental runtime.
  await gotoAndReady(page, '?pyruntime=nonsense');
  expect(await page.evaluate(() => window.CascadeAPI.getPyRuntime())).toBe('brython');

  // The default page boots Brython and nothing else: no CPython heap.
  const stats = await page.evaluate(() => window.CascadeAPI._memoryStats());
  expect(stats.pyRuntime).toBe('brython');
  expect(stats.pythonWasm).toBe(0);
  expect(stats.bootTiming.runtime).toBe('brython');
});

test('?pyruntime=micropython&pysrc=lite evaluates build123d-lite on MicroPython', async ({ page }) => {
  // pysrc=lite pins the source layer: the MicroPython DEFAULT is upstream
  // build123d source (see py-src-upstream.spec.js for the default's tests)
  await gotoAndReady(page, '?pyruntime=micropython&pysrc=lite');
  expect(await page.evaluate(() => window.CascadeAPI.getPyRuntime())).toBe('micropython');

  const result = await page.evaluate((code) => window.CascadeAPI.runCode(code), `
from build123d import *
import sys
part = Box(10, 10, 10) - Cylinder(2, 20)
print("impl", sys.implementation.name, "volume", round(part.volume, 3))
show(part)
`);
  expect(result.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('impl ')),
    { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  // Same geometry as Brython/Pyodide, through the same worker CAD calls.
  expect(logs.find((l) => l.startsWith('impl '))).toContain('impl micropython volume 874.336');

  const stats = await page.evaluate(() => window.CascadeAPI._memoryStats());
  expect(stats.pyRuntime).toBe('micropython');
  expect(stats.bootTiming.runtime).toBe('micropython');
  // The CUSTOM micropython-cs artifacts are vendored + committed, so a
  // normal build always prefers them, and they provide sys._getframe (the
  // frame hooks run with NO trace function installed). The stock npm
  // settrace artifacts remain the runtime fallback when the pair is absent
  // from dist (feature-detected in browser.py; artifact 'stock-settrace',
  // getframe false — everything below still passes on that path).
  expect(stats.bootTiming.artifact).toBe('custom');
  expect(stats.bootTiming.getframe).toBe(true);
  // The whole interpreter (GC heap included) stays a fraction of Pyodide's:
  // ~20 MB wasm heap vs Pyodide's ~45 MB (and Brython's JS-heap footprint).
  expect(stats.pythonWasm).toBeGreaterThan(8 * 1024 * 1024);
  expect(stats.pythonWasm).toBeLessThan(32 * 1024 * 1024);

  // History steps carry user line numbers (the frame hooks — sys._getframe
  // on the custom artifacts, the settrace tracker on stock).
  const historyResult = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'b = Box(3, 3, 3)',
    'c = Cylinder(1, 5)',
    'show(b, c)',
  ].join('\n'));
  expect(historyResult.errors).toEqual([]);
  const steps = await page.evaluate(() => window.CascadeAPI.getHistorySteps());
  const boxStep = steps.find((s) => s.fnName === 'Box');
  expect(boxStep && boxStep.lineNumber).toBe(2);

  // Python errors carry the traceback with the user's editor line.
  await page.evaluate((code) => window.CascadeAPI.runCode(code),
    'from build123d import *\nboom_undefined\n');
  await page.waitForFunction(
    () => window.CascadeAPI.getErrors().length > 0, { timeout: 30000 });
  const errText = (await page.evaluate(() => window.CascadeAPI.getErrors())).join('\n');
  expect(errText).toContain("NameError");
  expect(errText).toContain('line 2');
});

test('?pyruntime=pyodide evaluates build123d-lite on CPython', async ({ page }) => {
  await gotoAndReady(page, '?pyruntime=pyodide');
  test.skip(!(await pyodideAvailable(page)),
    'vendor/pyodide is absent — run packages/cascade-core/scripts/fetch-pyodide.cjs');

  const result = await page.evaluate((code) => window.CascadeAPI.runCode(code), `
from build123d import *
import sys
part = Box(10, 10, 10) - Cylinder(2, 20)
print("impl", sys.implementation.name, "volume", round(part.volume, 3))
show(part)
`);
  expect(result.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('impl ')),
    { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  // Real CPython, and the geometry went through the same worker CAD calls.
  expect(logs.find((l) => l.startsWith('impl '))).toContain('impl cpython volume 874.336');

  const stats = await page.evaluate(() => window.CascadeAPI._memoryStats());
  expect(stats.pyRuntime).toBe('pyodide');
  expect(stats.bootTiming.runtime).toBe('pyodide');
  expect(stats.pythonWasm).toBeGreaterThan(16 * 1024 * 1024);
});
