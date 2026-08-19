// @ts-check
// The Python SOURCE-layer flag: `?pyruntime=micropython&pysrc=upstream` runs
// UPSTREAM build123d 0.11.1 Level-A source (vendored, transformed — see
// packages/cascade-core/src/worker/UpstreamB123d.js) over build123d-lite's
// geometry/topology classes. Frozen here: the two proof-of-concept goals and
// the guard rails around the flag. Skips when the upstream sources have not
// been vendored (node packages/cascade-core/scripts/fetch-upstream-b123d.cjs).
const { test, expect } = require('@playwright/test');

async function gotoAndReady(page, query = '') {
  await page.goto('/' + query);
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 90000 });
}

async function upstreamAvailable(page) {
  return page.evaluate(async () => {
    try {
      const response = await fetch('upstream-b123d/upstream/build_common.py',
        { method: 'HEAD' });
      return response.ok;
    } catch (e) { return false; }
  });
}

test('pysrc=upstream runs upstream BuildLine/BuildPart over lite\'s seam', async ({ page }) => {
  await gotoAndReady(page, '?pyruntime=micropython&pysrc=upstream');
  test.skip(!(await upstreamAvailable(page)),
    'vendor/build123d-0.11.1 not fetched — pysrc=upstream disabled');

  // Goal 1: a BuildLine through UPSTREAM build_common/build_line
  const r1 = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'assert getattr(__import__("build123d"), "_upstream_level_a", False)',
    'with BuildLine() as l:',
    '    Line((0, 0), (10, 0))',
    '    Line((10, 0), (10, 10))',
    'res = l.line',
    'bb = res.bounding_box()',
    'print("POC1", round(res.length, 6), tuple(bb.min), tuple(bb.max))',
  ].join('\n'));
  expect(r1.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('POC1 ')),
    { timeout: 90000 });
  let logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs.find((l) => l.startsWith('POC1 ')))
    .toBe('POC1 20 (0.0, 0.0, 0.0) (10.0, 10.0, 0.0)');

  // Goal 2: a BuildPart Box through UPSTREAM objects_part/build_part
  const r2 = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'with BuildPart() as p:',
    '    Box(5, 5, 5)',
    'bb = p.part.bounding_box()',
    'print("POC2", round(p.part.volume, 6), tuple(bb.min), tuple(bb.max))',
    'show(p.part)',
  ].join('\n'));
  expect(r2.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('POC2 ')),
    { timeout: 90000 });
  logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs.find((l) => l.startsWith('POC2 ')))
    .toBe('POC2 125.0 (-2.5, -2.5, -2.5) (2.5, 2.5, 2.5)');
});

test('pysrc=upstream requires the MicroPython runtime; default stays lite', async ({ page }) => {
  // Default Python mode is untouched by the flag machinery
  await gotoAndReady(page, '?pyruntime=micropython');
  const r = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'import build123d',
    'print("LITECHECK", getattr(build123d, "_upstream_level_a", False))',
  ].join('\n'));
  expect(r.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('LITECHECK')),
    { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs.find((l) => l.startsWith('LITECHECK'))).toBe('LITECHECK False');

  // pysrc=upstream on a non-MicroPython runtime fails loudly, not silently
  await gotoAndReady(page, '?pysrc=upstream');
  await page.evaluate((code) => window.CascadeAPI.runCode(code), 'part = Box(1, 1, 1)');
  await page.waitForFunction(
    () => window.CascadeAPI.getErrors().length > 0,
    { timeout: 90000 });
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors.join('\n')).toContain('pysrc=upstream');
});
