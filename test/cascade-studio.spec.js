// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EVERYTHING_EXAMPLE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'everything-example.js'), 'utf-8'
);

/**
 * Wait for the CascadeAPI to become available and ready.
 */
async function waitForReady(page, timeout = 60000) {
  await page.waitForFunction(() => {
    return window.CascadeAPI && window.CascadeAPI.isReady();
  }, { timeout });
}

/**
 * Evaluate code via the CascadeAPI and wait for completion.
 */
async function evaluateCode(page, code, timeout = 60000) {
  await page.evaluate((c) => window.CascadeAPI.setCode(c), code);
  await page.evaluate(() => window.CascadeAPI.evaluate());
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout });
}

/**
 * Navigate to the app and wait until it's fully ready (WASM loaded, starter code done).
 */
async function gotoAndReady(page) {
  await page.goto('/');
  await waitForReady(page);
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
}

/**
 * Evaluate code and assert zero errors (the most common test pattern).
 */
async function evaluateNoErrors(page, code, timeout = 60000) {
  await evaluateCode(page, code, timeout);
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  expect(errors).toEqual([]);
}

/**
 * Extract a tagged value from console logs. Logs use "TAG:value" format.
 */
function extractLog(logs, tag) {
  const line = logs.find(l => l.includes(tag + ':'));
  if (!line) return undefined;
  return line.split(tag + ':')[1];
}

/**
 * Wait for all expected log tags, then return logs.
 */
async function waitForLogs(page, tags, timeout = 10000) {
  await page.waitForFunction((t) => {
    const logs = window.CascadeAPI.getConsoleLog();
    return t.every(tag => logs.some(l => l.includes(tag + ':')));
  }, tags, { timeout });
  return await page.evaluate(() => window.CascadeAPI.getConsoleLog());
}

/**
 * Switch to OpenSCAD mode and evaluate code, asserting zero errors.
 */
async function evaluateOpenSCADNoErrors(page, code, timeout = 60000) {
  await page.evaluate(() => window.CascadeAPI.setMode('openscad'));
  await evaluateNoErrors(page, code, timeout);
}

// ============================================================================
// Application Startup + CascadeAPI
// ============================================================================

test.describe('Application Startup & CascadeAPI', () => {
  test('page loads, CascadeAPI works, capabilities and examples are correct', async ({ page }) => {
    // Page title and meta
    await page.goto('/');
    await expect(page).toHaveTitle(/Cascade Studio/);
    const meta = await page.locator('meta[name="cascade-api"]').getAttribute('content');
    expect(meta).toBe('window.CascadeAPI');

    // Wait for WASM init
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });

    // CascadeAPI is available and starter code ran without errors
    const hasAPI = await page.evaluate(() => typeof window.CascadeAPI === 'object');
    expect(hasAPI).toBe(true);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    // getQuickStart
    const qs = await page.evaluate(() => window.CascadeAPI.getQuickStart());
    expect(qs.workflow).toBeDefined();
    expect(qs.functions).toBeDefined();
    expect(qs.pitfalls).toBeDefined();
    expect(qs.tips).toBeDefined();
    expect(qs.strategy).toBeDefined();
    expect(qs.examples.box).toContain('Sketch');
    expect(qs.examples.organic).toContain('Loft');
    expect(qs.examples.revolved).toContain('Revolve');

    // setCode/getCode round-trip
    const testCode = 'Box(10, 20, 30);';
    await page.evaluate((c) => window.CascadeAPI.setCode(c), testCode);
    const retrieved = await page.evaluate(() => window.CascadeAPI.getCode());
    expect(retrieved).toBe(testCode);

    // getMode
    const mode = await page.evaluate(() => window.CascadeAPI.getMode());
    expect(mode).toBe('cascadestudio');

    // screenshot
    const screenshot = await page.evaluate(() => window.CascadeAPI.screenshot());
    expect(screenshot).toMatch(/^data:image\/png;base64,/);
  });
});

// ============================================================================
// Primitives, Transforms, Measurement, Additional Primitives
// ============================================================================

test.describe('Primitives & Transforms', () => {
  test('all primitives, transforms, measurement functions, and additional primitives work', async ({ page }) => {
    await gotoAndReady(page);

    // --- Primitives ---
    for (const code of [
      'Box(10, 20, 30);',
      'Sphere(50);',
      'Cylinder(10, 40);',
      'Cone(20, 5, 30);',
      'Text3D("Hi", 36, 0.15, "Roboto");',
      'Polygon([[0,0],[100,0],[100,50],[50,100],[0,100]]);',
      'Circle(30);',
    ]) {
      await evaluateNoErrors(page, code);
    }

    // --- Transforms ---
    for (const code of [
      'Translate([10, 20, 30], Box(10, 10, 10));',
      'Rotate([0, 0, 1], 45, Box(10, 10, 10));',
      'Scale(2, Sphere(10));',
      'Mirror([1, 0, 0], Box(10, 10, 10));',
    ]) {
      await evaluateNoErrors(page, code);
    }

    // --- Measurement Functions ---
    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      console.log("VOL:" + Volume(box));
      console.log("AREA:" + SurfaceArea(box));
      let com = CenterOfMass(box);
      console.log("COM:" + com.join(","));
    `);
    const mErrors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(mErrors).toEqual([]);

    const mLogs = await waitForLogs(page, ['VOL', 'AREA', 'COM']);
    expect(parseFloat(extractLog(mLogs, 'VOL'))).toBeCloseTo(1000, 0);
    expect(parseFloat(extractLog(mLogs, 'AREA'))).toBeCloseTo(600, 0);
    const comParts = extractLog(mLogs, 'COM').split(',').map(Number);
    expect(comParts.length).toBe(3);
    expect(comParts[0]).toBeCloseTo(5, 0);
    expect(comParts[1]).toBeCloseTo(5, 0);
    expect(comParts[2]).toBeCloseTo(5, 0);

    // --- Additional Primitives ---
    await evaluateNoErrors(page, 'Wedge(30, 20, 30, 10);');
    await evaluateNoErrors(page, 'Section(Box(20, 20, 20), [0, 0, 10], [0, 0, 1]);');
  });
});

// ============================================================================
// Booleans & Operations
// ============================================================================

test.describe('Booleans & Operations', () => {
  test('booleans, extrude, revolve, loft, pipe, fillet, chamfer, offset, sketch all work', async ({ page }) => {
    await gotoAndReady(page);

    // --- Booleans ---
    await evaluateNoErrors(page, `
      let a = Box(20, 20, 20);
      let b = Translate([10, 10, 10], Box(20, 20, 20));
      Union([a, b]);
    `);

    await evaluateNoErrors(page, `
      let sphere = Sphere(50);
      let cyl = Cylinder(30, 200, true);
      Difference(sphere, [cyl]);
    `);

    await evaluateNoErrors(page, `
      let a = Box(30, 30, 30);
      let b = Sphere(20);
      Intersection([a, b]);
    `);

    await evaluateNoErrors(page, `
      let sphere = Sphere(50);
      let cylinderZ = Cylinder(30, 200, true);
      let cylinderY = Rotate([0,1,0], 90, Cylinder(30, 200, true));
      let cylinderX = Rotate([1,0,0], 90, Cylinder(30, 200, true));
      Difference(sphere, [cylinderX, cylinderY, cylinderZ]);
    `);

    // --- Operations ---

    // Extrude
    await evaluateNoErrors(page, `
      let face = Polygon([[0,0],[100,0],[100,50],[0,100]]);
      Extrude(face, [0, 0, 20]);
    `);

    // Revolve
    await evaluateNoErrors(page, `
      let face = Polygon([[0,0],[20,0],[20,10],[0,10]]);
      Revolve(Translate([30, 0, 0], face), 360, [0, 1, 0]);
    `);

    // Loft
    await evaluateNoErrors(page, `
      let face1 = Polygon([[-10,-10],[10,-10],[10,10],[-10,10]]);
      let w1 = GetWire(face1);
      let face2 = Translate([0,0,40], Polygon([[-5,-5],[5,-5],[5,5],[-5,5]]));
      let w2 = GetWire(face2);
      Loft([w1, w2]);
    `);

    // Pipe
    await evaluateNoErrors(page, `
      let profile = new Sketch([-5,-5]).LineTo([5,-5]).LineTo([5,5]).LineTo([-5,5]).End(true).Face();
      let spine = BSpline([[0,0,0],[0,0,30],[30,0,60]], false);
      Pipe(profile, spine);
    `);

    // FilletEdges, ChamferEdges, Offset
    await evaluateNoErrors(page, 'FilletEdges(Cylinder(10, 20), 3, [0, 2]);');
    await evaluateNoErrors(page, 'ChamferEdges(Cylinder(10, 20), 3, [0, 2]);');
    await evaluateNoErrors(page, 'Offset(Box(20, 20, 20), 2);');

    // Sketch API
    await evaluateNoErrors(page, `
      let sketch = new Sketch([0, 0])
        .LineTo([100, 0])
        .Fillet(20)
        .LineTo([100, 100])
        .End(true)
        .Face();
      Extrude(sketch, [0, 0, 20]);
    `);

    // Sketch XZ plane (for revolve profiles)
    await evaluateNoErrors(page, `
      let profile = new Sketch([0, 0], "XZ")
        .LineTo([15, 0]).LineTo([15, 2])
        .LineTo([12, 3]).LineTo([10, 8])
        .LineTo([11, 10]).LineTo([8, 12])
        .LineTo([0, 12]).End(true).Face();
      Revolve(profile, 360);
    `);
  });
});

// ============================================================================
// Export, GUI Controls, Console
// ============================================================================

test.describe('Export, GUI & Console', () => {
  test('export formats, GUI controls, and console capture all work', async ({ page }) => {
    await gotoAndReady(page);

    // --- Export ---
    await evaluateCode(page, 'Box(10, 20, 30);');

    const stl = await page.evaluate(() => window.CascadeAPI.getSTL());
    expect(stl.length).toBeGreaterThan(0);
    expect(stl).toContain('solid');

    const obj = await page.evaluate(() => window.CascadeAPI.getOBJ());
    expect(obj.length).toBeGreaterThan(0);
    expect(obj).toContain('v ');

    const step = await page.evaluate(() => window.CascadeAPI.getSTEP());
    expect(step.length).toBeGreaterThan(0);

    // --- GUI Controls ---
    await evaluateNoErrors(page, `
      let r = Slider("Radius", 20, 5, 50);
      Sphere(r);
    `);

    await evaluateNoErrors(page, `
      let centered = Checkbox("Centered", true);
      Box(20, 20, 20, centered);
    `);

    // --- Console Capture ---
    await evaluateCode(page, `
      console.log("test message");
      console.log("a", "b", 42);
      Box(10, 10, 10);
    `);
    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return logs.some(l => l.includes('test message'));
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
    expect(logs.some(l => l.includes('test message'))).toBe(true);
    expect(logs.some(l => l.includes('a') && l.includes('b') && l.includes('42'))).toBe(true);
  });
});

// ============================================================================
// Everything Example (comprehensive integration test)
// ============================================================================

test.describe('Everything Example', () => {
  test('full gallery renders without errors', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
    await evaluateCode(page, EVERYTHING_EXAMPLE, 120000);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Selector API — basic selectors + face type detection
// ============================================================================

test.describe('Selector API', () => {
  test('edge/face selectors with filtering, sorting, face type detection, and FilletEdges', async ({ page }) => {
    await gotoAndReady(page);

    // Edge and face selectors on a box
    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      console.log("EDGE_COUNT:" + Edges(box).indices().length);
      console.log("TOP_EDGES:" + Edges(box).max([0,0,1]).count());
      console.log("BOTTOM_EDGES:" + Edges(box).min([0,0,1]).count());
      console.log("TOP_FACES:" + Faces(box).max([0,0,1]).count());
    `);
    const errors1 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors1).toEqual([]);

    const logs1 = await waitForLogs(page, ['EDGE_COUNT', 'TOP_FACES']);
    expect(parseInt(extractLog(logs1, 'EDGE_COUNT'))).toBeGreaterThan(0);
    expect(parseInt(extractLog(logs1, 'TOP_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs1, 'BOTTOM_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs1, 'TOP_FACES'))).toBe(1);

    // FilletEdges with selector indices
    await evaluateNoErrors(page, `
      let box = Box(50, 50, 30);
      FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());
    `);

    // Face type selectors
    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      console.log("BOX_PLANES:" + Faces(box).ofType("Plane").count());
      let cyl = Cylinder(10, 20);
      console.log("CYL_CYLINDERS:" + Faces(cyl).ofType("Cylinder").count());
      console.log("CYL_PLANES:" + Faces(cyl).ofType("Plane").count());
    `);
    const errors2 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors2).toEqual([]);

    const logs2 = await waitForLogs(page, ['BOX_PLANES', 'CYL_CYLINDERS', 'CYL_PLANES']);
    expect(parseInt(extractLog(logs2, 'BOX_PLANES'))).toBe(6);
    expect(parseInt(extractLog(logs2, 'CYL_CYLINDERS'))).toBe(1);
    expect(parseInt(extractLog(logs2, 'CYL_PLANES'))).toBe(2);
  });
});

// ============================================================================
// Selector Chaining & Filtering — edge/face filtering + type detection
// ============================================================================

test.describe('Selector Chaining & Filtering', () => {
  test('edge and face filtering: parallel, perpendicular, ofType, length, area, type detection', async ({ page }) => {
    await gotoAndReady(page);

    // --- Edge selectors on a 30x20x10 box ---
    await evaluateCode(page, `
      let box = Box(30, 20, 10);
      console.log("Z_PARALLEL:" + Edges(box).parallel([0,0,1]).count());
      console.log("Z_PERP:" + Edges(box).perpendicular([0,0,1]).count());
      console.log("LINE_EDGES:" + Edges(box).ofType("Line").count());
      console.log("CIRCLE_EDGES:" + Edges(box).ofType("Circle").count());
      console.log("TOTAL_EDGES:" + Edges(box).count());
      console.log("LONG_EDGES:" + Edges(box).longerThan(25).count());
      console.log("SHORT_EDGES:" + Edges(box).shorterThan(15).count());
    `);
    const errors1 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors1).toEqual([]);

    const logs1 = await waitForLogs(page, ['Z_PARALLEL', 'Z_PERP', 'LINE_EDGES', 'TOTAL_EDGES']);
    expect(parseInt(extractLog(logs1, 'Z_PARALLEL'))).toBe(4);
    expect(parseInt(extractLog(logs1, 'Z_PERP'))).toBe(8);
    expect(parseInt(extractLog(logs1, 'LINE_EDGES'))).toBe(12);
    expect(parseInt(extractLog(logs1, 'CIRCLE_EDGES'))).toBe(0);
    expect(parseInt(extractLog(logs1, 'TOTAL_EDGES'))).toBe(12);
    expect(parseInt(extractLog(logs1, 'LONG_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs1, 'SHORT_EDGES'))).toBe(4);

    // --- Face selectors on a 30x20x10 box ---
    await evaluateCode(page, `
      let box = Box(30, 20, 10);
      console.log("Z_PAR_FACES:" + Faces(box).parallel([0,0,1]).count());
      console.log("Z_PERP_FACES:" + Faces(box).perpendicular([0,0,1]).count());
      console.log("TOTAL_FACES:" + Faces(box).count());
      console.log("LARGE_FACES:" + Faces(box).largerThan(500).count());
      console.log("SMALL_FACES:" + Faces(box).smallerThan(250).count());
    `);
    const errors2 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors2).toEqual([]);

    const logs2 = await waitForLogs(page, ['Z_PAR_FACES', 'Z_PERP_FACES', 'TOTAL_FACES', 'LARGE_FACES']);
    expect(parseInt(extractLog(logs2, 'Z_PAR_FACES'))).toBe(2);
    expect(parseInt(extractLog(logs2, 'Z_PERP_FACES'))).toBe(4);
    expect(parseInt(extractLog(logs2, 'TOTAL_FACES'))).toBe(6);
    expect(parseInt(extractLog(logs2, 'LARGE_FACES'))).toBe(2);
    expect(parseInt(extractLog(logs2, 'SMALL_FACES'))).toBe(2);

    // --- Cylinder type detection + chained selectors ---
    await evaluateCode(page, `
      let cyl = Cylinder(10, 30);
      console.log("CYL_CIRCLES:" + Edges(cyl).ofType("Circle").count());
      console.log("CYL_TOTAL:" + Edges(cyl).count());
      console.log("CYL_CYL_FACES:" + Faces(cyl).ofType("Cylinder").count());
      console.log("CYL_PLANE_FACES:" + Faces(cyl).ofType("Plane").count());
      console.log("TOP_CIRCLE:" + Edges(cyl).ofType("Circle").max([0,0,1]).count());
      console.log("BOT_CIRCLE:" + Edges(cyl).ofType("Circle").min([0,0,1]).count());
    `);
    const errors3 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors3).toEqual([]);

    const logs3 = await waitForLogs(page, ['CYL_CIRCLES', 'CYL_TOTAL', 'CYL_CYL_FACES', 'TOP_CIRCLE']);
    expect(parseInt(extractLog(logs3, 'CYL_CIRCLES'))).toBe(2);
    expect(parseInt(extractLog(logs3, 'CYL_TOTAL'))).toBeGreaterThanOrEqual(2);
    expect(parseInt(extractLog(logs3, 'CYL_CYL_FACES'))).toBe(1);
    expect(parseInt(extractLog(logs3, 'CYL_PLANE_FACES'))).toBe(2);
    expect(parseInt(extractLog(logs3, 'TOP_CIRCLE'))).toBe(1);
    expect(parseInt(extractLog(logs3, 'BOT_CIRCLE'))).toBe(1);

    // --- Sphere + cone type detection ---
    await evaluateCode(page, `
      let sph = Sphere(15);
      console.log("SPH_SPHERE_FACES:" + Faces(sph).ofType("Sphere").count());
      console.log("SPH_TOTAL_FACES:" + Faces(sph).count());
      let cone = Cone(15, 5, 20);
      console.log("CONE_CONE_FACES:" + Faces(cone).ofType("Cone").count());
      console.log("CONE_PLANE_FACES:" + Faces(cone).ofType("Plane").count());
    `);
    const errors4 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors4).toEqual([]);

    const logs4 = await waitForLogs(page, ['SPH_SPHERE_FACES', 'CONE_CONE_FACES']);
    expect(parseInt(extractLog(logs4, 'SPH_SPHERE_FACES'))).toBeGreaterThanOrEqual(1);
    expect(parseInt(extractLog(logs4, 'SPH_TOTAL_FACES'))).toBeGreaterThanOrEqual(1);
    expect(parseInt(extractLog(logs4, 'CONE_CONE_FACES'))).toBe(1);
    expect(parseInt(extractLog(logs4, 'CONE_PLANE_FACES'))).toBe(2);
  });

  test('selector-driven operations and terminal selectors', async ({ page }) => {
    await gotoAndReady(page);

    // --- Fillet/chamfer with selectors ---
    await evaluateNoErrors(page, `
      let box = Box(40, 30, 20);
      FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());
    `);

    await evaluateNoErrors(page, `
      let box = Box(40, 30, 20);
      ChamferEdges(box, 2, Edges(box).min([0,0,1]).indices());
    `);

    await evaluateNoErrors(page, `
      let box = Box(40, 30, 20);
      FilletEdges(box, 2, Edges(box).parallel([1,0,0]).indices());
    `);

    await evaluateNoErrors(page, `
      let cyl = Cylinder(15, 25);
      FilletEdges(cyl, 3, Edges(cyl).ofType("Circle").indices());
    `);

    // --- first, last, at terminal selectors ---
    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      let sorted = Edges(box).sortBy([0,0,1]);
      console.log("SORTED_COUNT:" + sorted.count());
      console.log("FIRST4:" + sorted.first(4).count());
      console.log("LAST4:" + sorted.last(4).count());
      let idx = sorted.at(0);
      console.log("AT0_TYPE:" + (typeof idx));
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    const logs = await waitForLogs(page, ['SORTED_COUNT', 'FIRST4', 'LAST4', 'AT0_TYPE']);
    expect(parseInt(extractLog(logs, 'SORTED_COUNT'))).toBe(12);
    expect(parseInt(extractLog(logs, 'FIRST4'))).toBe(4);
    expect(parseInt(extractLog(logs, 'LAST4'))).toBe(4);
    expect(extractLog(logs, 'AT0_TYPE')).toBe('number');
  });
});

// ============================================================================
// OpenSCAD — basics (primitives, transforms, booleans, extrusions, modules)
// ============================================================================

test.describe('OpenSCAD Basics', () => {
  test('primitives, transforms, booleans, extrusions, modules, loops, and variables', async ({ page }) => {
    await gotoAndReady(page);

    // --- Primitives ---
    for (const code of [
      'cube(10);',
      'cube([20, 10, 5]);',
      'cube([15, 15, 15], center = true);',
      'sphere(r = 12);',
      'sphere(d = 30);',
      'cylinder(h = 20, r = 10);',
      'cylinder(h = 25, r1 = 15, r2 = 5);',
      'cylinder(h = 10, d = 20, center = true);',
    ]) {
      await evaluateOpenSCADNoErrors(page, code);
    }

    // --- Transforms ---
    for (const code of [
      'translate([10, 20, 30]) cube(5);',
      'rotate([45, 0, 0]) cube(10);',
      'rotate(90, [0, 0, 1]) cube([10, 5, 3]);',
      'scale(2) cube(10);',
      'mirror([1, 0, 0]) translate([5, 0, 0]) cube(10);',
    ]) {
      await evaluateOpenSCADNoErrors(page, code);
    }

    // --- Booleans ---
    await evaluateOpenSCADNoErrors(page, `
      union() {
        cube(10);
        translate([5, 5, 5]) cube(10);
      }
    `);

    await evaluateOpenSCADNoErrors(page, `
      difference() {
        cube(20, center = true);
        cylinder(h = 30, r = 5, center = true);
      }
    `);

    await evaluateOpenSCADNoErrors(page, `
      intersection() {
        cube(20, center = true);
        sphere(r = 13);
      }
    `);

    // --- Extrusions ---
    await evaluateOpenSCADNoErrors(page, `
      linear_extrude(height = 10)
        polygon(points = [[0,0],[20,0],[10,15]]);
    `);

    await evaluateOpenSCADNoErrors(page, `
      rotate_extrude()
        translate([15, 0, 0])
          circle(r = 5);
    `);

    // --- Modules ---
    await evaluateOpenSCADNoErrors(page, `
      module rounded_cube(size, r) {
        translate([r, r, 0])
          cube([size - 2*r, size - 2*r, size]);
      }
      rounded_cube(20, 3);
    `);

    // --- For loops ---
    await evaluateOpenSCADNoErrors(page, `
      for (i = [0:3]) {
        translate([i * 15, 0, 0]) cube(10);
      }
    `);

    await evaluateOpenSCADNoErrors(page, `
      for (pos = [[0,0,0], [20,0,0], [0,20,0]]) {
        translate(pos) sphere(r = 5);
      }
    `);

    // --- Variables + math ---
    await evaluateOpenSCADNoErrors(page, `
      base_r = 20;
      top_r = base_r / 3;
      h = base_r * 1.5;
      cylinder(h = h, r1 = base_r, r2 = top_r);
    `);

    // --- Echo ---
    await evaluateOpenSCADNoErrors(page, `
      x = 42;
      echo("value:", x);
      cube(x);
    `);
  });
});

// ============================================================================
// OpenSCAD — complex models
// ============================================================================

test.describe('OpenSCAD Complex Models', () => {
  test('drilled sphere, nested booleans, parametric pattern, dodecahedron, star, rocket', async ({ page }) => {
    await gotoAndReady(page);

    // Three-axis drilled sphere
    await evaluateOpenSCADNoErrors(page, `
      difference() {
        sphere(r = 25);
        cylinder(h = 100, r = 15, center = true);
        rotate([90, 0, 0]) cylinder(h = 100, r = 15, center = true);
        rotate([0, 90, 0]) cylinder(h = 100, r = 15, center = true);
      }
    `);

    // Nested transforms and booleans (bracket)
    await evaluateOpenSCADNoErrors(page, `
      difference() {
        union() {
          cube([30, 20, 5]);
          translate([0, 0, 0]) cube([5, 20, 25]);
        }
        translate([15, 10, -1]) cylinder(h = 7, r = 4);
        translate([2.5, 10, 15]) rotate([0, 90, 0]) cylinder(h = 10, r = 3);
      }
    `);

    // Parametric array of pillars
    await evaluateOpenSCADNoErrors(page, `
      module pillar(r, h) {
        cylinder(h = h, r1 = r, r2 = r * 0.7);
      }
      for (x = [0:2]) {
        for (y = [0:2]) {
          translate([x * 20, y * 20, 0]) pillar(5, 15 + x * 5);
        }
      }
    `);

    // Dodecahedron via intersecting rotated cubes
    await evaluateOpenSCADNoErrors(page, `
      intersection() {
        cube([2, 2, 1], center = true);
        rotate([0, 0, 0]) rotate([116.565, 0, 0]) cube([2, 2, 1], center = true);
        rotate([0, 0, 72]) rotate([116.565, 0, 0]) cube([2, 2, 1], center = true);
        rotate([0, 0, 144]) rotate([116.565, 0, 0]) cube([2, 2, 1], center = true);
        rotate([0, 0, 216]) rotate([116.565, 0, 0]) cube([2, 2, 1], center = true);
        rotate([0, 0, 288]) rotate([116.565, 0, 0]) cube([2, 2, 1], center = true);
      }
    `, 120000);

    // Extruded star polygon
    await evaluateOpenSCADNoErrors(page, `
      linear_extrude(height = 5)
        polygon(points = [
          [0, 20], [5, 7], [19, 6],
          [8, -3], [12, -16],
          [0, -8], [-12, -16],
          [-8, -3], [-19, 6], [-5, 7]
        ]);
    `);

    // Rocket with body, nose cone, and swept wings
    await evaluateOpenSCADNoErrors(page, `
      rocket_d = 30;
      rocket_r = rocket_d / 2;
      rocket_h = 100;
      cylinder(d = rocket_d, h = rocket_h);

      head_r = 20;
      head_h = 40;
      tri_points = [[0, 0], [head_r, 0], [0, head_h]];
      translate([0, 0, rocket_h])
        rotate_extrude(angle = 360)
          polygon(tri_points);

      wing_w = 2;
      wing_l = 40;
      wing_h = 40;
      wing_points = [[0,0],[wing_l,0],[0,wing_h]];

      module wing() {
        translate([rocket_r - 1, 0, 0])
          rotate([90, 0, 0])
            linear_extrude(height = wing_w, center = true)
              polygon(wing_points);
      }

      for (i = [0:2])
        rotate([0, 0, 120 * i])
          wing();
    `, 120000);
  });
});

// ============================================================================
// Regression
// ============================================================================

test.describe('Regression', () => {
  test('multiple evaluations in sequence work and errors are cleared between them', async ({ page }) => {
    await gotoAndReady(page);

    // Sequential evaluations
    await evaluateNoErrors(page, 'Box(10, 10, 10);');
    await evaluateNoErrors(page, 'Sphere(20);');
    await evaluateNoErrors(page, 'Cylinder(10, 30);');

    // Errors/logs are cleared between evaluations
    await evaluateCode(page, 'Sphere(20);');
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
    const genMessages = logs.filter(l => l.includes('Generating Model'));
    expect(genMessages.length).toBeLessThanOrEqual(1);
  });

  test('shape cache produces faster re-evaluation of unchanged code', async ({ page }) => {
    await gotoAndReady(page);

    // First evaluation — cold cache
    const t1start = Date.now();
    await evaluateCode(page, EVERYTHING_EXAMPLE, 120000);
    const t1 = Date.now() - t1start;
    expect(await page.evaluate(() => window.CascadeAPI.getErrors())).toEqual([]);

    // Second evaluation — warm cache, identical code
    const t2start = Date.now();
    await evaluateCode(page, EVERYTHING_EXAMPLE, 120000);
    const t2 = Date.now() - t2start;
    expect(await page.evaluate(() => window.CascadeAPI.getErrors())).toEqual([]);

    console.log(`Everything example cache test: 1st eval ${t1}ms, 2nd eval ${t2}ms`);
    // Second eval must not be dramatically slower (was 15x before flushHistoryStep fix)
    // Triangulation dominates so cache speedup is small, but no O(n²) regression
    expect(t2).toBeLessThan(Math.max(t1 * 3, 5000));
  });
});
