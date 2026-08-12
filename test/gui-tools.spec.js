// @ts-check
// Tests for the LeapShape-style GUI modeling tools (viewport toolbar).
// Every GUI operation emits JavaScript code into the Monaco editor.
const { test, expect } = require('@playwright/test');

/** Wait for the CascadeAPI to become available and ready. */
async function waitForReady(page, timeout = 60000) {
  await page.waitForFunction(() => {
    return window.CascadeAPI && window.CascadeAPI.isReady();
  }, { timeout });
}

/** Navigate to the app and wait until it's fully ready. */
async function gotoAndReady(page) {
  await page.goto('/');
  await waitForReady(page);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
}

/** Run code via the API and wait for the mesh render to land
 *  (shapeLines is populated by renderMeshData, after resetWorking). */
async function runCodeAndRender(page, code, expectedShapes, timeout = 60000) {
  const result = await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
  expect(result.errors).toEqual([]);
  await page.waitForFunction(
    (n) => window.threejsViewport._shapeLines.length === n,
    expectedShapes, { timeout }
  );
}

/** Wait for an in-flight evaluation (started by a tool commit) to finish
 *  and for the render to produce the expected number of scene shapes. */
async function waitForToolEvaluation(page, expectedShapes, timeout = 60000) {
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout });
  await page.waitForFunction(
    (n) => window.threejsViewport._shapeLines.length === n,
    expectedShapes, { timeout }
  );
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors).toEqual([]);
}

/** In-page helper source: project CAD coords to screen and fire pointer
 *  events on the viewport canvas (exercises the real capture-phase routing). */
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

test.describe('GUI Modeling Tools', () => {
  test('toolbar renders with 5 tools, Select active, Escape returns to Select', async ({ page }) => {
    await gotoAndReady(page);

    const buttons = page.locator('.cs-toolbar .cs-tool-btn');
    await expect(buttons).toHaveCount(5);

    const toolNames = await buttons.evaluateAll((els) => els.map((el) => el.dataset.tool));
    expect(toolNames).toEqual(['select', 'box', 'cylinder', 'sphere', 'fillet']);

    // Select is the default active tool
    const active = await page.evaluate(() =>
      document.querySelector('.cs-tool-btn.cs-tool-active')?.dataset.tool
    );
    expect(active).toBe('select');

    // Clicking a tool button activates it; Escape returns to Select
    await page.evaluate(() => window.CascadeAPI._tools.activate('box'));
    expect(await page.evaluate(() => window.CascadeAPI._tools.activeToolName)).toBe('box');
    await page.evaluate(() =>
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    );
    expect(await page.evaluate(() => window.CascadeAPI._tools.activeToolName)).toBe('select');
  });

  test('Box tool: synthetic pointer drags emit code, evaluate, and round-trip', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(10, 10, 10);', 1);

    // Drive the box tool: drag footprint (20,20)→(60,50), then height to 25
    const result = await page.evaluate((helpers) => {
      eval(helpers);
      window.CascadeAPI._tools.activate('box');
      const boxTool = window.CascadeAPI._tools.tools.box;

      fire('pointerdown', screenOfCad(20, 20, 0));
      fire('pointermove', screenOfCad(60, 50, 0));
      fire('pointerup',   screenOfCad(60, 50, 0));
      const stateAfterFootprint = boxTool.state;
      const controlsDuringDrag = window.threejsViewport.environment.controls.enabled;
      fire('pointermove', screenOfCad(40, 35, 25));
      fire('pointerdown', screenOfCad(40, 35, 25)); // commit
      fire('pointerup',   screenOfCad(40, 35, 25));
      return {
        stateAfterFootprint,
        controlsDuringDrag,
        stateAfterCommit: boxTool.state,
        controlsAfterCommit: window.threejsViewport.environment.controls.enabled,
        code: window.CascadeAPI.getCode(),
      };
    }, POINTER_HELPERS);

    expect(result.stateAfterFootprint).toBe(2);   // DRAG_HEIGHT
    expect(result.controlsDuringDrag).toBe(false); // OrbitControls disabled mid-interaction
    expect(result.stateAfterCommit).toBe(0);       // back to IDLE
    expect(result.controlsAfterCommit).toBe(true);
    expect(result.code).toContain('Box(');
    expect(result.code).toContain('let box1 = Translate([20, 20, 0], Box(40, 30, 25));');

    // The commit triggered an evaluation — the scene gains a shape, no errors
    await waitForToolEvaluation(page, 2);

    // Round-trip: the emitted editor code re-runs cleanly through runCode
    const editorCode = await page.evaluate(() => window.CascadeAPI.getCode());
    const rerun = await page.evaluate((c) => window.CascadeAPI.runCode(c), editorCode);
    expect(rerun.errors).toEqual([]);
    expect(rerun.historySteps.length).toBeGreaterThanOrEqual(2);
  });

  test('Fillet tool: edge click selects, commit emits FilletEdges with picked indices', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(30, 30, 30);', 1);

    // Click a real edge (top edge midpoint of the box) with the fillet tool
    const clicked = await page.evaluate((helpers) => {
      eval(helpers);
      window.CascadeAPI._tools.activate('fillet');
      const fillet = window.CascadeAPI._tools.tools.fillet;
      const pt = screenOfCad(15, 0, 30);
      fire('pointerdown', pt);
      fire('pointerup', pt);
      return {
        selectionSize: fillet.selection.size,
        selection: [...fillet.selection.values()],
        panelVisible: fillet._panel && fillet._panel.style.display !== 'none',
      };
    }, POINTER_HELPERS);

    expect(clicked.selectionSize).toBe(1);
    expect(clicked.selection[0].shapeIndex).toBe(0);
    expect(clicked.selection[0].localEdgeIndex).toBeGreaterThanOrEqual(0);
    expect(clicked.panelVisible).toBe(true);
    const pickedIndex = clicked.selection[0].localEdgeIndex;

    // Commit with radius 3 — the bare `Box(...)` line gets a variable, and
    // a FilletEdges reassignment is appended using the picked edge index
    const code = await page.evaluate(() => {
      window.CascadeAPI._tools.tools.fillet.commit(3);
      return window.CascadeAPI.getCode();
    });
    expect(code).toContain('let box1 = Box(30, 30, 30);');
    expect(code).toContain(`box1 = FilletEdges(box1, 3, [${pickedIndex}]);`);

    // The emitted fillet evaluates with no errors (verifies the hover/pick
    // edge indices are exactly the ones FilletEdges consumes)
    await waitForToolEvaluation(page, 1);
    const steps = await page.evaluate(() => window.CascadeAPI.getHistorySteps());
    expect(steps.some((s) => s.fnName === 'FilletEdges')).toBe(true);
  });

  test('Select tool: clicking a shape maps to its producing code line', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(20, 20, 10);\nTranslate([40, 0, 0], Sphere(8));', 2);

    // The worker reports each sceneShape's producing line
    const shapeLines = await page.evaluate(() => window.threejsViewport._shapeLines);
    expect(shapeLines).toEqual([1, 2]);

    // Click the middle of the box's front face → line 1 flashes in Monaco
    const result = await page.evaluate((helpers) => {
      eval(helpers);
      const pt = screenOfCad(10, 0, 5); // front face center of Box(20, 20, 10)
      fire('pointerdown', pt);
      fire('pointerup', pt);
      const editor = window.cascadeApp.editor;
      const decorations = editor._flashDecorations || [];
      const model = editor.editor.getModel();
      const flashedLines = decorations.map((id) =>
        model.getDecorationRange(id)?.startLineNumber
      );
      return { flashedLines };
    }, POINTER_HELPERS);

    expect(result.flashedLines).toEqual([1]);
  });
});
