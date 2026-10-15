// @ts-check
// The Python SOURCE-layer flag: `?pyruntime=micropython&pysrc=upstream` runs
// UPSTREAM build123d 0.13.0 (vendored in vendor/build123d-0.13.0, transformed
// at load — see packages/cascade-core/src/worker/UpstreamB123d.js): Level-A,
// and under the default pytopo=upstream also geometry.py + the whole topology
// package verbatim over the OCP shim. Frozen here: the two proof-of-concept
// goals, the native-metaclass path, the 0.13 features that ride on new
// interpreter/shim support, and the guard rails around the flag. Skips when
// the upstream payload is absent from dist.
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

test('pysrc=upstream runs upstream BuildLine/BuildPart', async ({ page }) => {
  await gotoAndReady(page, '?pyruntime=micropython&pysrc=upstream');
  test.skip(!(await upstreamAvailable(page)),
    'upstream-b123d payload missing from dist — pysrc=upstream disabled');

  // Goal 1: a BuildLine through UPSTREAM build_common/build_line
  const r1 = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'assert getattr(__import__("build123d"), "_upstream_level_a", False)',
    'with BuildLine() as l:',
    '    Line((0, 0), (10, 0))',
    '    Line((10, 0), (10, 10))',
    'res = l.line',
    'bb = res.bounding_box()',
    // NOTE: not res.length — upstream's Curve(Compound) has NO .length
    // (verified against the 0.11.1 and 0.13.0 reference venvs); that was a
    // lite-only extension the pytopo=upstream default no longer papers over
    // float() per component: upstream geometry hands back the raw jsffi
    // numbers, and in-int32 integral doubles arrive as Python ints
    'print("POC1", round(sum(e.length for e in res.edges()), 6), tuple(float(c) for c in bb.min), tuple(float(c) for c in bb.max))',
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
    'print("POC2", round(p.part.volume, 6), tuple(float(c) for c in bb.min), tuple(float(c) for c in bb.max))',
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

test('custom artifacts run upstream source with NATIVE metaclasses (enum/Generic)', async ({ page }) => {
  // The vendored micropython-cs interpreter supports custom metaclasses; the
  // upstream loader must detect that and take the native path: a metaclass
  // EnumMeta (class iteration / Cls[name] / Cls(value) / no _finalize_enums)
  // and a Generic whose metaclass __getitem__ legalizes class-base
  // subscription (`class BuildPart(Builder[Part])` runs untransformed).
  // On the stock settrace artifacts everything falls back to the old
  // transform + post-import-finalize paths (proven manually by hiding the
  // custom pair; this spec covers the committed normal state).
  const browserLogs = [];
  page.on('console', (m) => browserLogs.push(m.text()));
  await gotoAndReady(page, '?pyruntime=micropython&pysrc=upstream');
  test.skip(!(await upstreamAvailable(page)),
    'upstream-b123d payload missing from dist — pysrc=upstream disabled');
  const bootLine = browserLogs
    .find((l) => l.indexOf('[pyruntime] micropython boot') === 0) || '';
  test.skip(bootLine.indexOf('"artifact":"custom"') === -1,
    'stock settrace artifacts booted — no interpreter metaclasses to freeze');

  const registeredLine = browserLogs
    .find((l) => l.indexOf('[pysrc=upstream] upstream build123d Level-A registered') === 0) || '';
  expect(registeredLine).toContain('metaclasses: native enum/Generic');

  const r = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'from build123d import *',
    'import enum as _e',
    'import build123d.build_common as _bc',
    'from build123d.build_part import BuildPart as _BP',
    'print("METACHECK",',
    '      _e._HAS_METACLASSES,',                        // capability probe
    '      isinstance(Align.MIN, Align),',               // members ARE instances
    '      [m.name for m in Align],',                    // class iteration
    '      Align["CENTER"] is Align.CENTER,',            // Cls[name]
    '      Mode(Mode.SUBTRACT.value) is Mode.SUBTRACT,', // Cls(value)
    '      type(_bc.Builder).__name__,',                 // Generic metaclass
    '      _bc.Builder[int] is _bc.Builder,',            // class subscription
    '      _BP.__bases__[0] is _bc.Builder)',            // Builder[Part] base
  ].join('\n'));
  expect(r.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('METACHECK')),
    { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs.find((l) => l.startsWith('METACHECK'))).toBe(
    // NONE = None IS a member in CPython's Enum (Align(None) -> Align.NONE);
    // the shim skipped None-valued members until the Stage-3 round
    "METACHECK True True ['CENTER', 'MAX', 'MIN', 'NONE'] True True _GenericMeta True True");
});

test('build123d 0.13 on MicroPython: native BaseObjectMeta, kernel-record Select.LAST/NEW, StrEnum, materials gap', async ({ page }) => {
  // 0.12+ wraps every builder-object construction in BaseObjectMeta.__call__
  // (a metaclass construction firewall) — it runs NATIVELY on micropython-cs
  // (no emulation, no metaclass= transform; the typing shim's _GenericMeta
  // is ABCMeta's base so BasePartObject(Part, BaseObject) resolves the most-
  // derived metaclass like CPython). 0.13 takes Select.LAST/NEW from the
  // kernel's own BRepTools_History record (topology/history.py over the
  // shim's OCP-8 collection aliases + the ShapeMap glue). All values below
  // are the native build123d 0.13.0 results.
  await gotoAndReady(page, '?pyruntime=micropython&pysrc=upstream');
  test.skip(!(await upstreamAvailable(page)),
    'upstream-b123d payload missing from dist — pysrc=upstream disabled');
  const r = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'import build123d',
    'from build123d import *',
    'import build123d.build_common as _bc',
    'import build123d.objects_part as _op',
    'with BuildPart() as p:',
    '    Box(10, 10, 10)',
    '    Cylinder(3, 20, mode=Mode.SUBTRACT)',
    '    n_last = len(p.edges(Select.LAST))',
    '    n_new = len(p.edges(Select.NEW))',
    '    fillet(p.edges(Select.LAST).filter_by(GeomType.CIRCLE), 1)',
    'try:',
    '    p.part.mass()',
    '    mass = "no-raise"',
    'except ValueError as e:',
    '    mass = str(e)',
    'print("V013", build123d.__version__,',
    '      type(_bc.BaseObject).__name__, type(_op.BasePartObject).__name__,',
    '      n_last, n_new, round(p.part.volume, 3),',
    '      Unit.MM == "mm", str(Unit.IN), "|" + mass)',
    'show(p.part)',
  ].join('\n'));
  expect(r.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('V013 ')),
    { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs.find((l) => l.startsWith('V013 '))).toBe(
    "V013 0.13.0 BaseObjectMeta BaseObjectMeta 3 2 708.564 True in |Shape's density is missing");
});

test('micropython defaults to upstream source; pysrc=lite opts back into lite', async ({ page }) => {
  // The no-flag MicroPython default is the UPSTREAM source layer (when the
  // vendored payload is available — it is committed, so this is the normal
  // state; a missing payload falls back to lite with a console warning).
  await gotoAndReady(page, '?pyruntime=micropython');
  const vendored = await upstreamAvailable(page);
  const r = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'import build123d',
    'print("DEFAULTCHECK", getattr(build123d, "_upstream_level_a", False))',
  ].join('\n'));
  expect(r.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('DEFAULTCHECK')),
    { timeout: 90000 });
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs.find((l) => l.startsWith('DEFAULTCHECK')))
    .toBe('DEFAULTCHECK ' + (vendored ? 'True' : 'False'));

  // pysrc=lite pins the lite source layer on MicroPython
  await gotoAndReady(page, '?pyruntime=micropython&pysrc=lite');
  const r2 = await page.evaluate((code) => window.CascadeAPI.runCode(code), [
    'import build123d',
    'print("LITECHECK", getattr(build123d, "_upstream_level_a", False))',
  ].join('\n'));
  expect(r2.errors).toEqual([]);
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('LITECHECK')),
    { timeout: 90000 });
  const logs2 = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  expect(logs2.find((l) => l.startsWith('LITECHECK'))).toBe('LITECHECK False');

  // pysrc=upstream on a non-MicroPython runtime fails loudly, not silently
  await gotoAndReady(page, '?pysrc=upstream');
  await page.evaluate((code) => window.CascadeAPI.runCode(code), 'part = Box(1, 1, 1)');
  await page.waitForFunction(
    () => window.CascadeAPI.getErrors().length > 0,
    { timeout: 90000 });
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors.join('\n')).toContain('pysrc=upstream');
});
