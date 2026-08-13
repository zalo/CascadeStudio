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

/** Navigate to the app and wait until it's fully ready. Fresh loads start in
 *  Python mode now, so these JS-emission tests select CascadeStudio JS. */
async function gotoAndReady(page, mode = 'cascadestudio') {
  await page.goto('/');
  await waitForReady(page);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  if (mode) { await page.evaluate((m) => window.CascadeAPI.setMode(m), mode); }
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

/** Probe the live camera for two canvas points whose ground-plane hits differ
 *  in BOTH CAD x and y, plus a point above the second one for a height drag.
 *
 *  Fixed CAD coordinates can project outside the canvas (the mouse event then
 *  goes to another panel) and fixed screen offsets can happen to run parallel
 *  to a projected axis (one CAD coordinate then never changes), so ask the
 *  tool's own raycaster instead of assuming a framing. */
async function groundDragPoints(page, minDelta = 5) {
  const points = await page.evaluate((min) => {
    const tools = window.CascadeAPI._tools;
    const r = window.threejsViewport.environment.renderer.domElement.getBoundingClientRect();
    const probe = (fx, fy) => {
      const pt = { clientX: r.left + r.width * fx, clientY: r.top + r.height * fy };
      const hit = tools.raycastGround(pt);
      return hit ? { pt: { x: pt.clientX, y: pt.clientY }, cad: tools.threeToCad(hit).map(Math.round) } : null;
    };
    const a = probe(0.5, 0.62);
    if (!a) return null;
    for (const [fx, fy] of [[0.75, 0.8], [0.25, 0.8], [0.72, 0.68], [0.28, 0.68],
                            [0.8, 0.9], [0.2, 0.9], [0.62, 0.85], [0.38, 0.85]]) {
      const b = probe(fx, fy);
      if (b && Math.abs(b.cad[0] - a.cad[0]) >= min && Math.abs(b.cad[1] - a.cad[1]) >= min) {
        return { a: a.pt, b: b.pt, up: { x: b.pt.x, y: r.top + r.height * 0.25 } };
      }
    }
    return null;
  }, minDelta);
  expect(points, 'the viewport should expose a usable ground-plane drag').not.toBeNull();
  return points;
}

/** Snapshot of a creation tool's state machine. */
function toolState(page, tool) {
  return page.evaluate((name) => {
    const t = window.CascadeAPI._tools.tools[name];
    return {
      state: t.state,
      pressed: t.stagePressed,
      height: t.height,
      radius: t.radius,
      activeTool: window.CascadeAPI._tools.activeToolName,
      controls: window.threejsViewport.environment.controls.enabled,
    };
  }, tool);
}

test.describe('GUI Modeling Tools', () => {
  test('toolbar renders with 6 tools, Select active, Escape returns to Select', async ({ page }) => {
    await gotoAndReady(page);

    const buttons = page.locator('.cs-toolbar .cs-tool-btn');
    await expect(buttons).toHaveCount(6);

    const toolNames = await buttons.evaluateAll((els) => els.map((el) => el.dataset.tool));
    expect(toolNames).toEqual(['select', 'box', 'cylinder', 'sphere', 'sketch', 'fillet']);

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

  // Regression: the old code only accepted "move, then click to commit" for
  // the second stage. Pressing to drag the height cancelled the whole box.
  // This uses Playwright's mouse API (real CDP input, unlike the synthetic
  // PointerEvents above, which is why the old tests never caught it).
  test('Box tool: real pointer press-drag-release drives BOTH stages', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(10, 10, 10);', 1);
    await page.evaluate(() => window.CascadeAPI._tools.activate('box'));

    const { a, b, up: c } = await groundDragPoints(page);

    // Stage 1: press, drag the footprint, release
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    expect(await toolState(page, 'box')).toMatchObject({ state: 1, controls: false });
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    expect(await toolState(page, 'box')).toMatchObject({ state: 2, controls: false });

    // Stage 2: press to start the height drag. The old code cancelled here
    // (state 0, controls re-enabled, nothing emitted).
    await page.mouse.down();
    expect(await toolState(page, 'box')).toMatchObject({
      state: 2, pressed: true, controls: false, activeTool: 'box',
    });

    // ...drag up, then release to commit
    await page.mouse.move(c.x, c.y, { steps: 8 });
    const dims = await page.evaluate(() => {
      const t = window.CascadeAPI._tools.tools.box;
      return {
        w: Math.abs(t.cornerCAD[0] - t.baseCAD[0]),
        d: Math.abs(t.cornerCAD[1] - t.baseCAD[1]),
        h: t.height,
        minX: Math.min(t.baseCAD[0], t.cornerCAD[0]),
        minY: Math.min(t.baseCAD[1], t.cornerCAD[1]),
      };
    });
    expect(dims.w).toBeGreaterThan(0);
    expect(dims.d).toBeGreaterThan(0);
    expect(dims.h).toBeGreaterThan(0);
    await page.mouse.up();

    expect(await toolState(page, 'box')).toMatchObject({
      state: 0, controls: true, activeTool: 'box',
    });
    // The dragged dimensions are exactly what got emitted
    const code = await page.evaluate(() => window.CascadeAPI.getCode());
    expect(code).toContain(
      `let box1 = Translate([${dims.minX}, ${dims.minY}, 0], Box(${dims.w}, ${dims.d}, ${dims.h}));`);

    await waitForToolEvaluation(page, 2);
  });

  test('Cylinder tool: real pointer click-move-click drives both stages', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(10, 10, 10);', 1);
    await page.evaluate(() => window.CascadeAPI._tools.activate('cylinder'));

    const { a: center, b: rim, up: top } = await groundDragPoints(page);

    // Click the center (no drag) — must arm the radius stage, not cancel
    await page.mouse.move(center.x, center.y);
    await page.mouse.click(center.x, center.y);
    expect(await toolState(page, 'cylinder')).toMatchObject({ state: 1, controls: false });

    // Move to size the radius, click to lock it
    await page.mouse.move(rim.x, rim.y, { steps: 5 });
    expect((await toolState(page, 'cylinder')).radius).toBeGreaterThan(0);
    await page.mouse.click(rim.x, rim.y);
    expect(await toolState(page, 'cylinder')).toMatchObject({ state: 2 });

    // Move to size the height, click to commit
    await page.mouse.move(top.x, top.y, { steps: 5 });
    const shape = await page.evaluate(() => {
      const t = window.CascadeAPI._tools.tools.cylinder;
      return { r: t.radius, h: t.height, cx: t.centerCAD[0], cy: t.centerCAD[1] };
    });
    expect(shape.h).toBeGreaterThan(0);
    await page.mouse.click(top.x, top.y);
    expect(await toolState(page, 'cylinder')).toMatchObject({ state: 0, controls: true });

    const code = await page.evaluate(() => window.CascadeAPI.getCode());
    expect(code).toContain(
      `let cylinder1 = Translate([${shape.cx}, ${shape.cy}, 0], Cylinder(${shape.r}, ${shape.h}));`);

    await waitForToolEvaluation(page, 2);
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

  test('Sketch tool: multi-click profile with arc + fillet extrudes and round-trips', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(10, 10, 10);', 1);

    // Draw a profile: two lines, a three-point arc (two clicks), a line,
    // then close by clicking the first vertex; fillet one corner; extrude.
    const result = await page.evaluate((helpers) => {
      eval(helpers);
      function click(x, y) {
        const pt = screenOfCad(x, y, 0);
        fire('pointerdown', pt);
        fire('pointerup', pt);
      }
      function key(code) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      }
      window.CascadeAPI._tools.activate('sketch');
      const sk = window.CascadeAPI._tools.tools.sketch;

      click(20, 5);            // vertex 0
      click(35, 5);            // vertex 1 (line)
      key('KeyA');             // arc mode
      click(42, 12);           // arc through-point (click 1 of 2)
      const pendingThrough = sk._pendingThrough && sk._pendingThrough.slice();
      click(35, 20);           // vertex 2 = arc end (click 2 of 2)
      key('KeyL');             // back to line mode
      click(20, 20);           // vertex 3
      click(20, 5);            // close onto vertex 0
      const stateAfterClose = sk.state;
      const panelVisible = sk._panel.style.display !== 'none';

      click(20, 20);           // toggle corner fillet on vertex 3
      const filletVerts = [...sk.filletVerts];
      click(20, 5);            // vertex 0 must be refused
      const filletVertsAfterV0 = [...sk.filletVerts];

      sk._valueInput.value = '15';
      sk._valueInput.dispatchEvent(new Event('input'));
      sk.commit();
      return {
        pendingThrough, stateAfterClose, panelVisible,
        filletVerts, filletVertsAfterV0,
        stateAfterCommit: sk.state,
        code: window.CascadeAPI.getCode(),
      };
    }, POINTER_HELPERS);

    expect(result.pendingThrough).toEqual([42, 12]);
    expect(result.stateAfterClose).toBe(2);  // CLOSED
    expect(result.panelVisible).toBe(true);
    expect(result.filletVerts).toEqual([3]);
    expect(result.filletVertsAfterV0).toEqual([3]); // start point not filletable
    expect(result.stateAfterCommit).toBe(0); // back to IDLE
    expect(result.code).toContain('new Sketch([20, 5])');
    expect(result.code).toContain('.ArcTo([42, 12], [35, 20])');
    expect(result.code).toContain('.LineTo([20, 20]).Fillet(3)');
    expect(result.code).toContain('.End(true).Face();');
    expect(result.code).toContain('let part1 = Extrude(profile1, [0, 0, 15]);');

    // The emitted sketch evaluates with no errors (Box + extruded part)
    await waitForToolEvaluation(page, 2);

    // Round-trip: the emitted editor code re-runs cleanly through runCode
    const editorCode = await page.evaluate(() => window.CascadeAPI.getCode());
    const rerun = await page.evaluate((c) => window.CascadeAPI.runCode(c), editorCode);
    expect(rerun.errors).toEqual([]);
  });

  test('Sketch tool: Escape steps back one stage at a time', async ({ page }) => {
    await gotoAndReady(page);
    await runCodeAndRender(page, 'Box(10, 10, 10);', 1);

    const result = await page.evaluate((helpers) => {
      eval(helpers);
      function click(x, y) {
        const pt = screenOfCad(x, y, 0);
        fire('pointerdown', pt);
        fire('pointerup', pt);
      }
      function key(code) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      }
      window.CascadeAPI._tools.activate('sketch');
      const sk = window.CascadeAPI._tools.tools.sketch;
      const steps = [];
      const snap = (label) => steps.push({
        label,
        verts: sk.vertices.length,
        pending: !!sk._pendingThrough,
        state: sk.state,
        tool: window.CascadeAPI._tools.activeToolName,
      });

      click(20, 5); click(35, 5); click(35, 20);
      key('KeyA');
      click(42, 12);            // half-placed arc through-point
      snap('drawn');
      key('Escape'); snap('esc1'); // drops the through-point only
      key('Escape'); snap('esc2'); // removes vertex 2
      key('Escape'); snap('esc3'); // removes vertex 1
      key('Escape'); snap('esc4'); // single vertex left → cancels the sketch
      key('Escape'); snap('esc5'); // idle → back to Select
      return steps;
    }, POINTER_HELPERS);

    expect(result[0]).toMatchObject({ label: 'drawn', verts: 3, pending: true,  state: 1 });
    expect(result[1]).toMatchObject({ label: 'esc1',  verts: 3, pending: false, state: 1 });
    expect(result[2]).toMatchObject({ label: 'esc2',  verts: 2, pending: false, state: 1 });
    expect(result[3]).toMatchObject({ label: 'esc3',  verts: 1, pending: false, state: 1 });
    expect(result[4]).toMatchObject({ label: 'esc4',  verts: 0, state: 0, tool: 'sketch' });
    expect(result[5]).toMatchObject({ label: 'esc5',  tool: 'select' });
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
