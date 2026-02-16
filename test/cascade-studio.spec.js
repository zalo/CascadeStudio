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

// ============================================================================
// Application Startup
// ============================================================================

test.describe('Application Startup', () => {
  test('page loads with correct title and meta', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cascade Studio/);
    const meta = await page.locator('meta[name="cascade-api"]').getAttribute('content');
    expect(meta).toBe('window.CascadeAPI');
  });

  test('CascadeAPI is available and starter code evaluates without errors', async ({ page }) => {
    await gotoAndReady(page);
    const hasAPI = await page.evaluate(() => typeof window.CascadeAPI === 'object');
    expect(hasAPI).toBe(true);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// CascadeAPI Methods
// ============================================================================

test.describe('CascadeAPI', () => {
  test('getCapabilities, getExamples, setCode/getCode, getMode, screenshot', async ({ page }) => {
    await gotoAndReady(page);

    // getCapabilities
    const caps = await page.evaluate(() => window.CascadeAPI.getCapabilities());
    expect(caps.version).toBe('1.0');
    expect(caps.modes).toContain('cascadestudio');
    expect(caps.modes).toContain('openscad');
    expect(caps.api).toBeDefined();
    expect(caps.cadFunctions).toBeDefined();
    expect(caps.cadFunctions.primitives).toBeDefined();
    expect(caps.cadFunctions.booleans).toBeDefined();

    // getExamples
    const examples = await page.evaluate(() => window.CascadeAPI.getExamples());
    expect(examples.cascadestudio).toBeDefined();
    expect(examples.openscad).toBeDefined();
    expect(examples.cascadestudio.basic).toContain('Box');
    expect(examples.openscad.basic).toContain('cube');

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
// Primitives
// ============================================================================

test.describe('Primitives', () => {
  test('Box, Sphere, Cylinder, Cone, Text3D, Polygon all render without errors', async ({ page }) => {
    await gotoAndReady(page);

    for (const code of [
      'Box(10, 20, 30);',
      'Sphere(50);',
      'Cylinder(10, 40);',
      'Cone(20, 5, 30);',
      'Text3D("Hi", 36, 0.15, "Roboto");',
      'Polygon([[0,0],[100,0],[100,50],[50,100],[0,100]]);',
    ]) {
      await evaluateNoErrors(page, code);
    }
  });

  test('Circle renders without errors', async ({ page }) => {
    await gotoAndReady(page);
    await evaluateNoErrors(page, 'Circle(30);');
  });
});

// ============================================================================
// Transforms
// ============================================================================

test.describe('Transforms', () => {
  test('Translate, Rotate, Scale, Mirror all render without errors', async ({ page }) => {
    await gotoAndReady(page);
    for (const code of [
      'Translate([10, 20, 30], Box(10, 10, 10));',
      'Rotate([0, 0, 1], 45, Box(10, 10, 10));',
      'Scale(2, Sphere(10));',
      'Mirror([1, 0, 0], Box(10, 10, 10));',
    ]) {
      await evaluateNoErrors(page, code);
    }
  });
});

// ============================================================================
// Booleans
// ============================================================================

test.describe('Booleans', () => {
  test('Union, Difference, Intersection, three-hole sphere all render without errors', async ({ page }) => {
    await gotoAndReady(page);

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
  });
});

// ============================================================================
// Operations (Extrude, Revolve, Loft, Pipe, Fillet, Chamfer, Offset, Sketch)
// ============================================================================

test.describe('Operations', () => {
  test('Extrude, Revolve, Loft, Pipe, FilletEdges, ChamferEdges, Offset, Sketch all render', async ({ page }) => {
    await gotoAndReady(page);

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
  });
});

// ============================================================================
// Export Formats
// ============================================================================

test.describe('Export', () => {
  test('getSTL, getOBJ, getSTEP all return non-empty data', async ({ page }) => {
    await gotoAndReady(page);
    await evaluateCode(page, 'Box(10, 20, 30);');

    const stl = await page.evaluate(() => window.CascadeAPI.getSTL());
    expect(stl.length).toBeGreaterThan(0);
    expect(stl).toContain('solid');

    const obj = await page.evaluate(() => window.CascadeAPI.getOBJ());
    expect(obj.length).toBeGreaterThan(0);
    expect(obj).toContain('v ');

    const step = await page.evaluate(() => window.CascadeAPI.getSTEP());
    expect(step.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// GUI Controls
// ============================================================================

test.describe('GUI Controls', () => {
  test('Slider and Checkbox create GUI controls and render', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateNoErrors(page, `
      let r = Slider("Radius", 20, 5, 50);
      Sphere(r);
    `);

    await evaluateNoErrors(page, `
      let centered = Checkbox("Centered", true);
      Box(20, 20, 20, centered);
    `);
  });
});

// ============================================================================
// Console Capture
// ============================================================================

test.describe('Console', () => {
  test('console.log messages and multiple arguments are captured', async ({ page }) => {
    await gotoAndReady(page);

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
  test('full gallery renders (some features may require additional bindings)', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
    await evaluateCode(page, EVERYTHING_EXAMPLE, 120000);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Selector API
// ============================================================================

test.describe('Selector API', () => {
  test('edge and face selectors with filtering, sorting, and FilletEdges integration', async ({ page }) => {
    await gotoAndReady(page);

    // Run all selector checks in one evaluation
    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      console.log("EDGE_COUNT:" + Edges(box).indices().length);
      console.log("LINE_COUNT:" + Edges(box).ofType("Line").count());
      console.log("TOP_EDGES:" + Edges(box).max([0,0,1]).count());
      console.log("BOTTOM_EDGES:" + Edges(box).min([0,0,1]).count());
      console.log("Z_EDGES:" + Edges(box).parallel([0,0,1]).count());
      console.log("TOP_FACES:" + Faces(box).max([0,0,1]).count());
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    // Wait for all expected log tags to arrive (worker messages may lag slightly)
    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['EDGE_COUNT:', 'TOP_FACES:'].every(tag => logs.some(l => l.includes(tag)));
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    const edgeCount = parseInt(extractLog(logs, 'EDGE_COUNT'));
    expect(edgeCount).toBeGreaterThan(0);

    expect(parseInt(extractLog(logs, 'LINE_COUNT'))).toBe(12);
    expect(parseInt(extractLog(logs, 'TOP_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs, 'BOTTOM_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs, 'Z_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs, 'TOP_FACES'))).toBe(1);

    // FilletEdges with selector indices
    await evaluateNoErrors(page, `
      let box = Box(50, 50, 30);
      FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());
    `);
  });

  test('face type selectors detect Plane and Cylinder', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      console.log("BOX_PLANES:" + Faces(box).ofType("Plane").count());
      let cyl = Cylinder(10, 20);
      console.log("CYL_CYLINDERS:" + Faces(cyl).ofType("Cylinder").count());
      console.log("CYL_PLANES:" + Faces(cyl).ofType("Plane").count());
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['BOX_PLANES:', 'CYL_CYLINDERS:', 'CYL_PLANES:'].every(tag => logs.some(l => l.includes(tag)));
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseInt(extractLog(logs, 'BOX_PLANES'))).toBe(6);
    expect(parseInt(extractLog(logs, 'CYL_CYLINDERS'))).toBe(1);
    expect(parseInt(extractLog(logs, 'CYL_PLANES'))).toBe(2);
  });
});

// ============================================================================
// Measurement Functions
// ============================================================================

test.describe('Measurement Functions', () => {
  test('Volume, SurfaceArea, CenterOfMass return correct values for a 10x10x10 box', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let box = Box(10, 10, 10);
      console.log("VOL:" + Volume(box));
      console.log("AREA:" + SurfaceArea(box));
      let com = CenterOfMass(box);
      console.log("COM:" + com.join(","));
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    // Wait for all expected log tags to arrive (worker messages may lag slightly)
    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['VOL:', 'AREA:', 'COM:'].every(tag => logs.some(l => l.includes(tag)));
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseFloat(extractLog(logs, 'VOL'))).toBeCloseTo(1000, 0);
    expect(parseFloat(extractLog(logs, 'AREA'))).toBeCloseTo(600, 0);

    const comParts = extractLog(logs, 'COM').split(',').map(Number);
    expect(comParts.length).toBe(3);
    expect(comParts[0]).toBeCloseTo(5, 0);
    expect(comParts[1]).toBeCloseTo(5, 0);
    expect(comParts[2]).toBeCloseTo(5, 0);
  });
});

// ============================================================================
// Additional Primitives (Wedge, Section)
// ============================================================================

test.describe('Additional Primitives', () => {
  test('Wedge and Section render without errors', async ({ page }) => {
    await gotoAndReady(page);
    await evaluateNoErrors(page, 'Wedge(30, 20, 30, 10);');
    await evaluateNoErrors(page, 'Section(Box(20, 20, 20), [0, 0, 10], [0, 0, 1]);');
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
});
