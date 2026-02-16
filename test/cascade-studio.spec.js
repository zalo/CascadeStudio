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

// ============================================================================
// Test Suite: Application Startup
// ============================================================================

test.describe('Application Startup', () => {
  test('page loads and displays title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cascade Studio/);
  });

  test('CascadeAPI is available on window', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const hasAPI = await page.evaluate(() => typeof window.CascadeAPI === 'object');
    expect(hasAPI).toBe(true);
  });

  test('meta tag for API discovery exists', async ({ page }) => {
    await page.goto('/');
    const meta = await page.locator('meta[name="cascade-api"]').getAttribute('content');
    expect(meta).toBe('window.CascadeAPI');
  });

  test('starter code evaluates without errors', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    // The starter code should auto-evaluate on startup
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: CascadeAPI Methods
// ============================================================================

test.describe('CascadeAPI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('getCapabilities returns structured object', async ({ page }) => {
    const caps = await page.evaluate(() => window.CascadeAPI.getCapabilities());
    expect(caps.version).toBe('1.0');
    expect(caps.modes).toContain('cascadestudio');
    expect(caps.modes).toContain('openscad');
    expect(caps.api).toBeDefined();
    expect(caps.cadFunctions).toBeDefined();
    expect(caps.cadFunctions.primitives).toBeDefined();
    expect(caps.cadFunctions.booleans).toBeDefined();
  });

  test('getExamples returns code for both modes', async ({ page }) => {
    const examples = await page.evaluate(() => window.CascadeAPI.getExamples());
    expect(examples.cascadestudio).toBeDefined();
    expect(examples.openscad).toBeDefined();
    expect(examples.cascadestudio.basic).toContain('Box');
    expect(examples.openscad.basic).toContain('cube');
  });

  test('setCode/getCode round-trips correctly', async ({ page }) => {
    const testCode = 'Box(10, 20, 30);';
    await page.evaluate((c) => window.CascadeAPI.setCode(c), testCode);
    const retrieved = await page.evaluate(() => window.CascadeAPI.getCode());
    expect(retrieved).toBe(testCode);
  });

  test('getMode returns cascadestudio by default', async ({ page }) => {
    const mode = await page.evaluate(() => window.CascadeAPI.getMode());
    expect(mode).toBe('cascadestudio');
  });

  test('screenshot returns base64 PNG data URL', async ({ page }) => {
    const screenshot = await page.evaluate(() => window.CascadeAPI.screenshot());
    expect(screenshot).toMatch(/^data:image\/png;base64,/);
  });
});

// ============================================================================
// Test Suite: Primitive Shapes
// ============================================================================

test.describe('Primitives', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('Box renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Box(10, 20, 30);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Sphere renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Sphere(50);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Cylinder renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Cylinder(10, 40);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Cone renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Cone(20, 5, 30);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Text3D renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Text3D("Hi", 36, 0.15, "Roboto");');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Polygon renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Polygon([[0,0],[100,0],[100,50],[50,100],[0,100]]);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test.skip('Circle renders without errors (requires GC_MakeCircle binding)', async ({ page }) => {
    await evaluateCode(page, 'Circle(30);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Transforms
// ============================================================================

test.describe('Transforms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('Translate renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Translate([10, 20, 30], Box(10, 10, 10));');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Rotate renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Rotate([0, 0, 1], 45, Box(10, 10, 10));');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Scale renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Scale(2, Sphere(10));');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Mirror renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Mirror([1, 0, 0], Box(10, 10, 10));');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Boolean Operations
// ============================================================================

test.describe('Booleans', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('Union renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let a = Box(20, 20, 20);
      let b = Translate([10, 10, 10], Box(20, 20, 20));
      Union([a, b]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Difference renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let sphere = Sphere(50);
      let cyl = Cylinder(30, 200, true);
      Difference(sphere, [cyl]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Intersection renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let a = Box(30, 30, 30);
      let b = Sphere(20);
      Intersection([a, b]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Three-hole sphere (starter code) renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let sphere = Sphere(50);
      let cylinderZ = Cylinder(30, 200, true);
      let cylinderY = Rotate([0,1,0], 90, Cylinder(30, 200, true));
      let cylinderX = Rotate([1,0,0], 90, Cylinder(30, 200, true));
      Difference(sphere, [cylinderX, cylinderY, cylinderZ]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Operations (Extrude, Revolve, Loft, etc.)
// ============================================================================

test.describe('Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('Extrude renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let face = Polygon([[0,0],[100,0],[100,50],[0,100]]);
      Extrude(face, [0, 0, 20]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Revolve renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let face = Polygon([[0,0],[20,0],[20,10],[0,10]]);
      Revolve(Translate([30, 0, 0], face), 360, [0, 1, 0]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Loft renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let face1 = Polygon([[-10,-10],[10,-10],[10,10],[-10,10]]);
      let w1 = GetWire(face1);
      let face2 = Translate([0,0,40], Polygon([[-5,-5],[5,-5],[5,5],[-5,5]]));
      let w2 = GetWire(face2);
      Loft([w1, w2]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Pipe renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let profile = new Sketch([-5,-5]).LineTo([5,-5]).LineTo([5,5]).LineTo([-5,5]).End(true).Face();
      let spine = BSpline([[0,0,0],[0,0,30],[30,0,60]], false);
      Pipe(profile, spine);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    // BSpline may not be available due to GeomAbs_C2 binding gap
    const unexpectedErrors = errors.filter(e => !e.includes('GeomAbs_C2'));
    expect(unexpectedErrors).toEqual([]);
  });

  test('FilletEdges renders without errors', async ({ page }) => {
    await evaluateCode(page, 'FilletEdges(Cylinder(10, 20), 3, [0, 2]);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('ChamferEdges renders without errors', async ({ page }) => {
    await evaluateCode(page, 'ChamferEdges(Cylinder(10, 20), 3, [0, 2]);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Offset renders without errors', async ({ page }) => {
    await evaluateCode(page, 'Offset(Box(20, 20, 20), 2);');
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Sketch API renders without errors', async ({ page }) => {
    await evaluateCode(page, `
      let sketch = new Sketch([0, 0])
        .LineTo([100, 0])
        .Fillet(20)
        .LineTo([100, 100])
        .End(true)
        .Face();
      Extrude(sketch, [0, 0, 20]);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Export Formats
// ============================================================================

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
    await evaluateCode(page, 'Box(10, 20, 30);');
  });

  test('getSTL returns non-empty string', async ({ page }) => {
    const stl = await page.evaluate(() => window.CascadeAPI.getSTL());
    expect(stl.length).toBeGreaterThan(0);
    expect(stl).toContain('solid');
  });

  test('getOBJ returns non-empty string', async ({ page }) => {
    const obj = await page.evaluate(() => window.CascadeAPI.getOBJ());
    expect(obj.length).toBeGreaterThan(0);
    expect(obj).toContain('v ');
  });

  test('getSTEP returns non-empty string', async ({ page }) => {
    const step = await page.evaluate(() => window.CascadeAPI.getSTEP());
    expect(step.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test Suite: GUI Controls
// ============================================================================

test.describe('GUI Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('Slider creates GUI control and renders', async ({ page }) => {
    await evaluateCode(page, `
      let r = Slider("Radius", 20, 5, 50);
      Sphere(r);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('Checkbox creates GUI control and renders', async ({ page }) => {
    await evaluateCode(page, `
      let centered = Checkbox("Centered", true);
      Box(20, 20, 20, centered);
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Console Capture
// ============================================================================

test.describe('Console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('console.log messages are captured', async ({ page }) => {
    await evaluateCode(page, `
      console.log("test message");
      Box(10, 10, 10);
    `);
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
    expect(logs.some(l => l.includes('test message'))).toBe(true);
  });

  test('console.log captures multiple arguments', async ({ page }) => {
    await evaluateCode(page, `
      console.log("a", "b", 42);
      Box(10, 10, 10);
    `);
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
    expect(logs.some(l => l.includes('a') && l.includes('b') && l.includes('42'))).toBe(true);
  });
});

// ============================================================================
// Test Suite: Everything Example (comprehensive integration test)
// ============================================================================

test.describe('Everything Example', () => {
  test('full gallery renders (some features may require additional bindings)', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
    await evaluateCode(page, EVERYTHING_EXAMPLE, 120000);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    // Filter out known opencascade.js v2 binding gaps
    const unexpectedErrors = errors.filter(e =>
      !e.includes('GeomAbs_C2') && !e.includes('GC_MakeCircle')
    );
    expect(unexpectedErrors).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Multiple Evaluations (regression)
// ============================================================================

test.describe('Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
  });

  test('can evaluate code multiple times in sequence', async ({ page }) => {
    await evaluateCode(page, 'Box(10, 10, 10);');
    let errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await evaluateCode(page, 'Sphere(20);');
    errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await evaluateCode(page, 'Cylinder(10, 30);');
    errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);
  });

  test('errors are cleared between evaluations', async ({ page }) => {
    // First eval with valid code
    await evaluateCode(page, 'Box(10, 10, 10);');
    const errors1 = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors1).toEqual([]);

    // The logs should be cleared on next eval
    await evaluateCode(page, 'Sphere(20);');
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
    // Should not contain logs from previous eval's startup messages
    const genMessages = logs.filter(l => l.includes('Generating Model'));
    expect(genMessages.length).toBeLessThanOrEqual(1);
  });
});
