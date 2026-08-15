// @ts-check
// The Python-interpreter flag: Python mode runs on Brython by default and on
// Pyodide (real CPython on wasm) with ?pyruntime=pyodide. Both execute the
// same Build123dLite.js source — see test/b123d-validation/runtime-comparison.md
// for the measurements behind keeping Brython as the default.
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
