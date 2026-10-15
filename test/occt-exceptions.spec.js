// @ts-check
// The OCCT exception-model switch. The default kernel (cascadestudio.wasm) is
// built with NATIVE wasm exceptions; cascadestudio-jseh.{js,wasm} is the same
// kernel with Emscripten's JS-emulated exceptions, kept as a debug artifact
// and selected with ?occtexceptions=js (or localStorage
// ['cascade-occt-exceptions'] = 'js'). On both, a kernel throw must surface
// as OCCT's own message — COMPROMISE(failure-decode) reads the raw pointer
// under JS EH and calls the module's getExceptionMessage() under native EH.
const { test, expect } = require('@playwright/test');

const KERNEL_MSG = "the OCCT kernel raised 'BRep_API: command not done'";

async function gotoAndReady(page, query = '') {
  await page.goto('/' + query);
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
}

/** The debug pair ships only with an opencascade.js pin that builds it. */
async function debugArtifactAvailable(page) {
  return page.evaluate(async () => {
    try {
      const r = await fetch('cascadestudio-jseh.wasm', { method: 'HEAD' });
      return r.ok;
    } catch (e) { return false; }
  });
}

/** A 6 mm chamfer on a 10 mm box: a deterministic StdFail_NotDone out of
 *  BRepFilletAPI_MakeChamfer. Errors post asynchronously — poll for them. */
async function expectDecodedKernelThrow(page) {
  // Python mode (Brython + build123d-lite)
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
  await page.evaluate((code) => window.CascadeAPI.runCode(code),
    'from build123d import *\nb = chamfer(Box(10, 10, 10).edges(), 6)\nshow(b)\n');
  await page.waitForFunction((msg) => window.CascadeAPI.getErrors().some((e) => e.includes(msg)),
    KERNEL_MSG, { timeout: 30000 });
  // CascadeStudio JS mode (the CacheOp path)
  await page.evaluate(() => window.CascadeAPI.setMode('cascadestudio'));
  await page.evaluate((code) => window.CascadeAPI.runCode(code),
    'let b = Box(10, 10, 10);\nChamferEdges(b, 6, [0,1,2,3,4,5,6,7,8,9,10,11]);\n');
  await page.waitForFunction((msg) => window.CascadeAPI.getErrors().some((e) => e.includes(msg)),
    KERNEL_MSG, { timeout: 30000 });
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  // never the bare pointer (JS EH) or the opaque object (native EH)
  expect(errors.some((e) => /kernel threw '(\d+|\[object WebAssembly\.Exception\])'/.test(e))).toBe(false);
}

test('default OCCT build: native exceptions (with the debug pair present), decoded kernel errors',
  async ({ page }) => {
    await gotoAndReady(page);
    const hasDebug = await debugArtifactAvailable(page);
    const stats = await page.evaluate(() => window.CascadeAPI._memoryStats());
    expect(['wasm', 'js']).toContain(stats.occtExceptions);
    // A pin that builds the debug pair builds native EH as its default; an
    // older pin (JS EH only, no debug pair) reports 'js' here.
    const forced = process.env.CS_TEST_OCCT_EXCEPTIONS === 'js';   // suite-wide debug run
    if (hasDebug) { expect(stats.occtExceptions).toBe(forced ? 'js' : 'wasm'); }
    expect(await page.evaluate(() => window.CascadeAPI.getOcctExceptions()))
      .toBe(forced ? 'js' : 'wasm');
    await expectDecodedKernelThrow(page);
  });

test('?occtexceptions=js boots the JS-exceptions debug artifact; errors still decode',
  async ({ page }) => {
    await gotoAndReady(page);
    test.skip(!(await debugArtifactAvailable(page)),
      'this opencascade.js pin ships no cascadestudio-jseh debug artifact');
    await gotoAndReady(page, '?occtexceptions=js');
    expect(await page.evaluate(() => window.CascadeAPI.getOcctExceptions())).toBe('js');
    const stats = await page.evaluate(() => window.CascadeAPI._memoryStats());
    expect(stats.occtExceptions).toBe('js');
    await expectDecodedKernelThrow(page);
  });

test('the flag persists through localStorage, and an unknown value means the default',
  async ({ page }) => {
    await gotoAndReady(page);
    const hasDebug = await debugArtifactAvailable(page);
    await page.evaluate(() => window.CascadeAPI.setOcctExceptions('js'));
    await gotoAndReady(page);
    expect(await page.evaluate(() => window.CascadeAPI.getOcctExceptions())).toBe('js');
    if (hasDebug) {
      expect((await page.evaluate(() => window.CascadeAPI._memoryStats())).occtExceptions).toBe('js');
    }
    // the URL wins over storage, and nonsense is the default
    await gotoAndReady(page, '?occtexceptions=nonsense');
    expect(await page.evaluate(() => window.CascadeAPI.getOcctExceptions())).toBe('wasm');
    await page.evaluate(() => window.CascadeAPI.setOcctExceptions('wasm'));
    await gotoAndReady(page);
    expect(await page.evaluate(() => window.CascadeAPI.getOcctExceptions())).toBe('wasm');
  });
