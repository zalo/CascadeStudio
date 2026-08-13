// @ts-check
// Editor language-mode defaults, starter code, and share-URL serialization.
//   - a parameter-less load starts in Python (build123d) mode
//   - share URLs carry `&mode=` so the language travels with the code
//   - links WITHOUT `&mode=` predate mode serialization and must load as
//     CascadeStudio JS (the Python default must not capture them)
const { test, expect } = require('@playwright/test');

const MODES = ['cascadestudio', 'openscad', 'python'];

/** Sample code per mode, small enough to evaluate quickly. */
const SAMPLE = {
  cascadestudio: 'Box(3, 4, 5);',
  openscad: 'cube([3, 4, 5]);',
  python: 'from build123d import *\nshow(Box(3, 4, 5))\n',
};

async function waitForReady(page, timeout = 90000) {
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), { timeout });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout });
}

/** Load a URL (path + query) and wait for the first evaluation to settle. */
async function load(page, url = '/') {
  await page.goto(url);
  await waitForReady(page);
}

/** The mode-related state the app resolved for the current document. */
function modeState(page) {
  return page.evaluate(() => ({
    mode: window.CascadeAPI.getMode(),
    select: document.getElementById('editorMode').value,
    language: window.monacoEditor.getModel().getLanguageId(),
    code: window.CascadeAPI.getCode(),
    errors: window.CascadeAPI.getErrors(),
  }));
}

test.describe('Editor modes & share URLs', () => {
  test('a fresh load defaults to Python mode with the build123d starter', async ({ page }) => {
    await load(page);

    const state = await modeState(page);
    expect(state.mode).toBe('python');
    expect(state.select).toBe('python');       // topnav switcher agrees
    expect(state.language).toBe('python');     // Monaco tokenizer agrees
    expect(state.code).toContain('# CascadeStudio build123d mode');
    expect(state.code).toContain('from build123d import *');
    expect(state.errors).toEqual([]);

    // The starter rendered exactly one solid
    await page.waitForFunction(() => window.threejsViewport._shapeLines.length === 1,
      null, { timeout: 90000 });
  });

  test('every mode starter evaluates with zero errors', async ({ page }) => {
    await load(page);

    for (const mode of MODES) {
      const starter = await page.evaluate((m) => {
        const app = window.cascadeApp;
        const code = app.constructor.starterCode(m);
        window.CascadeAPI.setMode(m);
        window.CascadeAPI.setCode(code);
        return code;
      }, mode);
      expect(starter.length).toBeGreaterThan(100);

      await page.evaluate(() => window.CascadeAPI.evaluate());
      await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 90000 });
      const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
      expect(errors, `${mode} starter should evaluate cleanly`).toEqual([]);
      await page.waitForFunction(() => window.threejsViewport._shapeLines.length > 0,
        null, { timeout: 90000 });
    }
  });

  for (const mode of MODES) {
    test(`share URL round-trips ${mode} code and mode`, async ({ page }) => {
      await load(page);

      // Save-to-URL (the F5 / Ctrl+S path) writes code, gui state and mode
      await page.evaluate(({ m, c }) => {
        window.CascadeAPI.setMode(m);
        window.CascadeAPI.setCode(c);
        window.cascadeApp.editor.evaluateCode(true);
      }, { m: mode, c: SAMPLE[mode] });
      await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 90000 });

      const url = page.url();
      expect(url).toContain('mode=' + mode);
      expect(url).toContain('code=');

      // A fresh page load of that URL restores both the mode and the code
      await load(page, url);
      const state = await modeState(page);
      expect(state.mode).toBe(mode);
      expect(state.select).toBe(mode);
      expect(state.code).toBe(SAMPLE[mode]);
      expect(state.errors).toEqual([]);
    });
  }

  test('legacy URLs without &mode= still load as CascadeStudio JS', async ({ page }) => {
    await load(page);

    // Build a pre-mode-serialization link exactly as old builds wrote them
    const legacy = await page.evaluate(() => {
      const App = window.cascadeApp.constructor;
      return {
        withGui: '/?code=' + App.encode('Box(12, 13, 14);') + '&gui=' + App.encode('{}'),
        withoutGui: '/?code=' + App.encode('Sphere(9);'),
      };
    });

    await load(page, legacy.withGui);
    let state = await modeState(page);
    expect(state.mode).toBe('cascadestudio');
    expect(state.select).toBe('cascadestudio');
    expect(state.language).toBe('typescript');
    expect(state.code).toBe('Box(12, 13, 14);');
    expect(state.errors).toEqual([]);

    // ...and a link with no &gui= at all must not throw while loading
    await load(page, legacy.withoutGui);
    state = await modeState(page);
    expect(state.mode).toBe('cascadestudio');
    expect(state.code).toBe('Sphere(9);');
    expect(state.errors).toEqual([]);
  });

  test('?mode= without &code= opens that mode\'s starter', async ({ page }) => {
    await load(page, '/?mode=openscad');
    let state = await modeState(page);
    expect(state.mode).toBe('openscad');
    expect(state.language).toBe('openscad');
    expect(state.code).toContain('Parametric Bolt and Nut');
    expect(state.errors).toEqual([]);

    // An unknown mode falls back to the fresh-load default
    await load(page, '/?mode=fortran');
    state = await modeState(page);
    expect(state.mode).toBe('python');
  });
});
