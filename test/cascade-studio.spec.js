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
      console.log("TOP_EDGES:" + Edges(box).max([0,0,1]).count());
      console.log("BOTTOM_EDGES:" + Edges(box).min([0,0,1]).count());
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

    expect(parseInt(extractLog(logs, 'TOP_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs, 'BOTTOM_EDGES'))).toBe(4);
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
// OpenSCAD Mode
// ============================================================================

/**
 * Switch to OpenSCAD mode and evaluate code.
 */
async function evaluateOpenSCAD(page, code, timeout = 60000) {
  await page.evaluate(() => window.CascadeAPI.setMode('openscad'));
  await evaluateCode(page, code, timeout);
}

/**
 * Switch to OpenSCAD mode and evaluate code, asserting zero errors.
 */
async function evaluateOpenSCADNoErrors(page, code, timeout = 60000) {
  await page.evaluate(() => window.CascadeAPI.setMode('openscad'));
  await evaluateNoErrors(page, code, timeout);
}

test.describe('OpenSCAD Primitives & Transforms', () => {
  test('cube, sphere, cylinder, circle, square, and transforms all render', async ({ page }) => {
    await gotoAndReady(page);

    // Primitives
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

    // Transforms
    for (const code of [
      'translate([10, 20, 30]) cube(5);',
      'rotate([45, 0, 0]) cube(10);',
      'rotate(90, [0, 0, 1]) cube([10, 5, 3]);',
      'scale(2) cube(10);',
      'mirror([1, 0, 0]) translate([5, 0, 0]) cube(10);',
    ]) {
      await evaluateOpenSCADNoErrors(page, code);
    }
  });
});

test.describe('OpenSCAD Booleans & Extrusions', () => {
  test('union, difference, intersection, linear_extrude, rotate_extrude all render', async ({ page }) => {
    await gotoAndReady(page);

    // Union
    await evaluateOpenSCADNoErrors(page, `
      union() {
        cube(10);
        translate([5, 5, 5]) cube(10);
      }
    `);

    // Difference — classic drilled cube
    await evaluateOpenSCADNoErrors(page, `
      difference() {
        cube(20, center = true);
        cylinder(h = 30, r = 5, center = true);
      }
    `);

    // Intersection
    await evaluateOpenSCADNoErrors(page, `
      intersection() {
        cube(20, center = true);
        sphere(r = 13);
      }
    `);

    // Linear extrude
    await evaluateOpenSCADNoErrors(page, `
      linear_extrude(height = 10)
        polygon(points = [[0,0],[20,0],[10,15]]);
    `);

    // Rotate extrude — donut/torus
    await evaluateOpenSCADNoErrors(page, `
      rotate_extrude()
        translate([15, 0, 0])
          circle(r = 5);
    `);
  });
});

test.describe('OpenSCAD Modules, Loops & Variables', () => {
  test('modules, for loops, variables, and echo work correctly', async ({ page }) => {
    await gotoAndReady(page);

    // Module definition + call
    await evaluateOpenSCADNoErrors(page, `
      module rounded_cube(size, r) {
        translate([r, r, 0])
          cube([size - 2*r, size - 2*r, size]);
      }
      rounded_cube(20, 3);
    `);

    // For loop with range
    await evaluateOpenSCADNoErrors(page, `
      for (i = [0:3]) {
        translate([i * 15, 0, 0]) cube(10);
      }
    `);

    // For loop with list
    await evaluateOpenSCADNoErrors(page, `
      for (pos = [[0,0,0], [20,0,0], [0,20,0]]) {
        translate(pos) sphere(r = 5);
      }
    `);

    // Variables + math
    await evaluateOpenSCADNoErrors(page, `
      base_r = 20;
      top_r = base_r / 3;
      h = base_r * 1.5;
      cylinder(h = h, r1 = base_r, r2 = top_r);
    `);

    // Echo → console.log (verify no errors, don't check output since mode is openscad)
    await evaluateOpenSCADNoErrors(page, `
      x = 42;
      echo("value:", x);
      cube(x);
    `);
  });
});

test.describe('OpenSCAD Complex Models', () => {
  test('multi-boolean drilled sphere renders', async ({ page }) => {
    await gotoAndReady(page);

    // Three-axis drilled sphere (same concept as CascadeStudio boolean test)
    await evaluateOpenSCADNoErrors(page, `
      difference() {
        sphere(r = 25);
        cylinder(h = 100, r = 15, center = true);
        rotate([90, 0, 0]) cylinder(h = 100, r = 15, center = true);
        rotate([0, 90, 0]) cylinder(h = 100, r = 15, center = true);
      }
    `);
  });

  test('nested transforms and booleans render', async ({ page }) => {
    await gotoAndReady(page);

    // Bracket-like shape with nested operations
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
  });

  test('parametric pattern with module and for loop renders', async ({ page }) => {
    await gotoAndReady(page);

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
  });

  test('dodecahedron-like intersection renders', async ({ page }) => {
    await gotoAndReady(page);

    // Dodecahedron via intersecting rotated cubes
    // (intersection_for is not supported, so we manually intersect)
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
  });

  test('extruded star polygon renders', async ({ page }) => {
    await gotoAndReady(page);

    // 5-pointed star via linear_extrude of polygon
    await evaluateOpenSCADNoErrors(page, `
      linear_extrude(height = 5)
        polygon(points = [
          [0, 20], [5, 7], [19, 6],
          [8, -3], [12, -16],
          [0, -8], [-12, -16],
          [-8, -3], [-19, 6], [-5, 7]
        ]);
    `);
  });

  test('rocket with body, nose cone, and swept wings renders', async ({ page }) => {
    await gotoAndReady(page);

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
// Extended Selector API
// ============================================================================

test.describe('Selector Chaining & Filtering', () => {
  test('edge selectors: parallel, perpendicular, ofType, longerThan, shorterThan', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let box = Box(30, 20, 10);

      // Edges parallel to Z axis (vertical edges of a box = 4)
      console.log("Z_PARALLEL:" + Edges(box).parallel([0,0,1]).count());

      // Edges perpendicular to Z axis (horizontal edges = 8)
      console.log("Z_PERP:" + Edges(box).perpendicular([0,0,1]).count());

      // All edges of a box are lines
      console.log("LINE_EDGES:" + Edges(box).ofType("Line").count());
      console.log("CIRCLE_EDGES:" + Edges(box).ofType("Circle").count());

      // Total edges of a box = 12
      console.log("TOTAL_EDGES:" + Edges(box).count());

      // Filter by length: box is 30x20x10
      // 4 edges of length 30, 4 of length 20, 4 of length 10
      console.log("LONG_EDGES:" + Edges(box).longerThan(25).count());
      console.log("SHORT_EDGES:" + Edges(box).shorterThan(15).count());
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['Z_PARALLEL:', 'Z_PERP:', 'LINE_EDGES:', 'TOTAL_EDGES:'].every(
        tag => logs.some(l => l.includes(tag))
      );
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseInt(extractLog(logs, 'Z_PARALLEL'))).toBe(4);
    expect(parseInt(extractLog(logs, 'Z_PERP'))).toBe(8);
    expect(parseInt(extractLog(logs, 'LINE_EDGES'))).toBe(12);
    expect(parseInt(extractLog(logs, 'CIRCLE_EDGES'))).toBe(0);
    expect(parseInt(extractLog(logs, 'TOTAL_EDGES'))).toBe(12);
    expect(parseInt(extractLog(logs, 'LONG_EDGES'))).toBe(4);
    expect(parseInt(extractLog(logs, 'SHORT_EDGES'))).toBe(4);
  });

  test('face selectors: parallel, perpendicular, sortBy, largerThan, smallerThan', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let box = Box(30, 20, 10);

      // Faces parallel to Z (top + bottom = 2)
      console.log("Z_PAR_FACES:" + Faces(box).parallel([0,0,1]).count());

      // Faces perpendicular to Z (4 side faces)
      console.log("Z_PERP_FACES:" + Faces(box).perpendicular([0,0,1]).count());

      // Total faces = 6
      console.log("TOTAL_FACES:" + Faces(box).count());

      // Face areas: top/bottom = 30*20 = 600, front/back = 30*10 = 300, left/right = 20*10 = 200
      // largerThan(500) = top + bottom = 2
      console.log("LARGE_FACES:" + Faces(box).largerThan(500).count());
      // smallerThan(250) = left + right = 2
      console.log("SMALL_FACES:" + Faces(box).smallerThan(250).count());
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['Z_PAR_FACES:', 'Z_PERP_FACES:', 'TOTAL_FACES:', 'LARGE_FACES:'].every(
        tag => logs.some(l => l.includes(tag))
      );
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseInt(extractLog(logs, 'Z_PAR_FACES'))).toBe(2);
    expect(parseInt(extractLog(logs, 'Z_PERP_FACES'))).toBe(4);
    expect(parseInt(extractLog(logs, 'TOTAL_FACES'))).toBe(6);
    expect(parseInt(extractLog(logs, 'LARGE_FACES'))).toBe(2);
    expect(parseInt(extractLog(logs, 'SMALL_FACES'))).toBe(2);
  });

  test('cylinder edge/face type detection and chained selectors', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let cyl = Cylinder(10, 30);

      // Cylinder has 2 circular edges (top + bottom); may have a seam edge
      console.log("CYL_CIRCLES:" + Edges(cyl).ofType("Circle").count());
      console.log("CYL_TOTAL:" + Edges(cyl).count());

      // Cylinder faces: 1 cylindrical + 2 planar (top/bottom)
      console.log("CYL_CYL_FACES:" + Faces(cyl).ofType("Cylinder").count());
      console.log("CYL_PLANE_FACES:" + Faces(cyl).ofType("Plane").count());

      // Top circle edge (max Z)
      console.log("TOP_CIRCLE:" + Edges(cyl).ofType("Circle").max([0,0,1]).count());

      // Chained: circular edges at bottom
      console.log("BOT_CIRCLE:" + Edges(cyl).ofType("Circle").min([0,0,1]).count());
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['CYL_CIRCLES:', 'CYL_TOTAL:', 'CYL_CYL_FACES:', 'TOP_CIRCLE:'].every(
        tag => logs.some(l => l.includes(tag))
      );
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseInt(extractLog(logs, 'CYL_CIRCLES'))).toBe(2);
    expect(parseInt(extractLog(logs, 'CYL_TOTAL'))).toBeGreaterThanOrEqual(2);
    expect(parseInt(extractLog(logs, 'CYL_CYL_FACES'))).toBe(1);
    expect(parseInt(extractLog(logs, 'CYL_PLANE_FACES'))).toBe(2);
    expect(parseInt(extractLog(logs, 'TOP_CIRCLE'))).toBe(1);
    expect(parseInt(extractLog(logs, 'BOT_CIRCLE'))).toBe(1);
  });

  test('sphere and cone face type detection', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let sph = Sphere(15);
      console.log("SPH_SPHERE_FACES:" + Faces(sph).ofType("Sphere").count());
      console.log("SPH_TOTAL_FACES:" + Faces(sph).count());

      let cone = Cone(15, 5, 20);
      console.log("CONE_CONE_FACES:" + Faces(cone).ofType("Cone").count());
      console.log("CONE_PLANE_FACES:" + Faces(cone).ofType("Plane").count());
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['SPH_SPHERE_FACES:', 'CONE_CONE_FACES:'].every(
        tag => logs.some(l => l.includes(tag))
      );
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseInt(extractLog(logs, 'SPH_SPHERE_FACES'))).toBeGreaterThanOrEqual(1);
    expect(parseInt(extractLog(logs, 'SPH_TOTAL_FACES'))).toBeGreaterThanOrEqual(1);
    expect(parseInt(extractLog(logs, 'CONE_CONE_FACES'))).toBe(1);
    expect(parseInt(extractLog(logs, 'CONE_PLANE_FACES'))).toBe(2);
  });

  test('selector-driven fillet and chamfer operations', async ({ page }) => {
    await gotoAndReady(page);

    // Fillet top edges of a box using selectors
    await evaluateNoErrors(page, `
      let box = Box(40, 30, 20);
      FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());
    `);

    // Chamfer bottom edges
    await evaluateNoErrors(page, `
      let box = Box(40, 30, 20);
      ChamferEdges(box, 2, Edges(box).min([0,0,1]).indices());
    `);

    // Fillet only edges parallel to X axis
    await evaluateNoErrors(page, `
      let box = Box(40, 30, 20);
      FilletEdges(box, 2, Edges(box).parallel([1,0,0]).indices());
    `);

    // Fillet circular edges of a cylinder
    await evaluateNoErrors(page, `
      let cyl = Cylinder(15, 25);
      FilletEdges(cyl, 3, Edges(cyl).ofType("Circle").indices());
    `);
  });

  test('first, last, at terminal selectors work correctly', async ({ page }) => {
    await gotoAndReady(page);

    await evaluateCode(page, `
      let box = Box(10, 10, 10);

      // sortBy Z then first/last
      let sorted = Edges(box).sortBy([0,0,1]);
      console.log("SORTED_COUNT:" + sorted.count());

      // first(4) = bottom 4 edges, last(4) = top 4 edges
      console.log("FIRST4:" + sorted.first(4).count());
      console.log("LAST4:" + sorted.last(4).count());

      // at(0) returns an index (number)
      let idx = sorted.at(0);
      console.log("AT0_TYPE:" + (typeof idx));
    `);
    const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
    expect(errors).toEqual([]);

    await page.waitForFunction(() => {
      const logs = window.CascadeAPI.getConsoleLog();
      return ['SORTED_COUNT:', 'FIRST4:', 'LAST4:', 'AT0_TYPE:'].every(
        tag => logs.some(l => l.includes(tag))
      );
    }, { timeout: 10000 });
    const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());

    expect(parseInt(extractLog(logs, 'SORTED_COUNT'))).toBe(12);
    expect(parseInt(extractLog(logs, 'FIRST4'))).toBe(4);
    expect(parseInt(extractLog(logs, 'LAST4'))).toBe(4);
    expect(extractLog(logs, 'AT0_TYPE')).toBe('number');
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
