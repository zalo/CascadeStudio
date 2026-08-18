// @ts-check
// Tests for Python IntelliSense: basedpyright running in a browser worker,
// fed build123d stubs generated from upstream 0.11.1 and modified to match
// build123d-lite's actual surface (pruned __all__, removed unsupported
// params, added lite-only APIs). Diagnostics land as Monaco markers under
// the 'basedpyright' owner; the language server boots lazily ~1.5 s after a
// Python-mode load.
const { test, expect } = require('@playwright/test');

/** Navigate to the app (Python default mode) and wait until it's ready. */
async function gotoAndReady(page) {
  await page.goto('/');
  await page.waitForFunction(() => {
    return window.CascadeAPI && window.CascadeAPI.isReady();
  }, { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
}

/** Set editor text and wait until the basedpyright markers stabilize to
 *  satisfy the predicate (the LSP round-trip is debounced + async). */
async function markersAfter(page, code, predicate, timeout = 90000) {
  await page.evaluate((c) => window.monacoEditor.setValue(c), code);
  await page.waitForFunction(
    (pred) => {
      const markers = window.monaco.editor.getModelMarkers({ owner: 'basedpyright' });
      return new Function('markers', 'return ' + pred)(markers);
    },
    predicate, { timeout }
  );
  return page.evaluate(() =>
    window.monaco.editor.getModelMarkers({ owner: 'basedpyright' })
      .map(m => ({ line: m.startLineNumber, severity: m.severity, message: m.message })));
}

test.describe('Python IntelliSense (basedpyright)', () => {
  test('flags real errors, honors lite-pruned exports, keeps extras clean', async ({ page }) => {
    await gotoAndReady(page);

    // Positive control first — it also proves the language server booted.
    // Draft exists in upstream build123d but NOT in build123d-lite: the
    // stub __all__ was pruned to lite's surface, so pyright must flag it.
    const bad = [
      'from build123d import *',
      'b = Box(1, 2)',                 // missing height
      'n: int = "hello"',              // type error
      'd = Draft()',                   // upstream-only name, pruned from stubs
      's = offset(b, 1, min_edge_length=0.5)', // param removed from lite stubs
    ].join('\n');
    const markers = await markersAfter(page, bad, 'markers.length >= 4');
    const text = markers.map(m => m.message).join('\n');
    expect(text).toContain('height');
    expect(text).toContain('not assignable');
    expect(text).toContain('"Draft" is not defined');
    expect(text).toContain('min_edge_length');
    // All of the planted problems are error-severity (monaco MarkerSeverity.Error = 8)
    expect(markers.filter(m => m.severity === 8).length).toBeGreaterThanOrEqual(4);

    // Lite-only APIs (viewer functions, canonical free-edge extensions,
    // the opt-in sort tie-break) must typecheck cleanly.
    const extras = [
      'from build123d import *',
      'b = Box(1, 2, 3)',
      'show(b)',
      'show_object(b, name="b")',
      'v: float = volume(b)',
      'e = b.edges()[0].canonical()',
      'form = b.edges()[0].canonical_form()',
      'a = Axis(b.edges()[0], canonical=True)',
      'sl = b.edges().sort_by(Axis.Z, tie_break=True)',
      'from scipy.optimize import minimize',
      'import pytest',
      'approx_one = pytest.approx(1.0)',
    ].join('\n');
    const extraMarkers = await markersAfter(page, extras,
      'markers.filter(m => m.severity === 8).length === 0');
    expect(extraMarkers.filter(m => m.severity === 8)).toEqual([]);
  });

  test('starter code typechecks clean; leaving Python mode clears markers', async ({ page }) => {
    await gotoAndReady(page);

    // Force a known-bad state so we can positively observe the LSP working
    // before asserting the starter is clean (avoids a false-pass while the
    // server is still booting).
    await markersAfter(page, 'from build123d import *\nx = Draft()\n', 'markers.length >= 1');

    const starter = await page.evaluate(() => {
      const AppClass = window.cascadeApp ? window.cascadeApp.constructor : null;
      return AppClass ? AppClass.PYTHON_STARTER_CODE : null;
    });
    expect(starter).toBeTruthy();
    const starterMarkers = await markersAfter(page, starter,
      'markers.filter(m => m.severity === 8).length === 0', 30000);
    expect(starterMarkers.filter(m => m.severity === 8)).toEqual([]);

    // Plant an error, then switch to JS mode: python markers must be gone.
    await markersAfter(page, 'from build123d import *\nx = Draft()\n', 'markers.length >= 1');
    await page.evaluate(() => window.CascadeAPI.setMode('cascadestudio'));
    await page.waitForFunction(() =>
      window.monaco.editor.getModelMarkers({ owner: 'basedpyright' }).length === 0,
      { timeout: 10000 });
  });
});
