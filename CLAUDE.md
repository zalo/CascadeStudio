# CascadeStudio — Agent Development Guide

## Project Overview

CascadeStudio is a browser-based parametric CAD modeling environment. Users write JavaScript
(or OpenSCAD) in a Monaco editor; code is evaluated in a Web Worker with OpenCascade (OCCT)
compiled to WebAssembly via Emscripten. The 3D viewport uses Three.js with a matcap material.

## Quick Start

```bash
npm run build          # esbuild bundles → build/
npx http-server ./build -p 8080 -c-1 --silent
npx playwright test    # 11 tests, ~2 min
```

## Architecture

```
js/MainPage/
  main.js              ← ESM entry point
  CascadeMain.js       ← App shell, layout (Dockview), default STARTER_CODE
  CascadeAPI.js        ← window.CascadeAPI — programmatic API for agents
  CascadeView.js       ← 3D viewport, Three.js rendering, modeling timeline
  EditorManager.js     ← Monaco editor, code evaluation, keyboard shortcuts
  ConsoleManager.js    ← Console panel, log/error capture
  GUIManager.js        ← Tweakpane GUI panel (sliders, checkboxes)
  FileManager.js       ← File system access (save/load projects)

js/CADWorker/
  CascadeStudioMainWorker.js  ← Web Worker entry; evaluates user code
  CascadeStudioStandardLibrary.js  ← CAD primitives (Box, Sphere, etc.)
  CascadeStudioSelectors.js   ← Edges()/Faces() selector API

js/StandardLibraryIntellisense.ts  ← TypeScript definitions for all CAD functions
```

## Agent API (window.CascadeAPI)

The `CascadeAPI` class is installed on `window.CascadeAPI` at startup. It provides:

### Code Management
- `setCode(code)` — Set editor code
- `getCode()` → string — Get current code
- `evaluate()` → Promise — Evaluate code, resolves when rendering is complete

### Results
- `getConsoleLog()` → string[] — Console logs since last eval
- `getErrors()` → string[] — Errors since last eval
- `screenshot()` → string — Base64 PNG data URL of the 3D viewport
- `getSTEP()` → Promise<string> — Export model as STEP
- `getSTL()` → string — Export model as STL
- `getOBJ()` → string — Export model as OBJ

### Model History
- `getHistorySteps()` → {fnName, lineNumber, shapeCount}[] — Intermediate build steps
- `showHistoryStep(index)` → Promise — Navigate to a history step (-1 for final)
- `screenshotHistoryStep(index)` → Promise<string> — Screenshot a specific step
- `showFinalResult()` — Return to final result after scrubbing

### State
- `isReady()` → boolean — Worker has initialized
- `isWorking()` → boolean — Worker is currently evaluating
- `setMode(mode)` — Switch between 'cascadestudio' and 'openscad'
- `getCapabilities()` → object — Full structured API documentation

## Playwright Testing Patterns

### Loading the App

```javascript
await page.goto('http://localhost:8080');
// Wait for WASM to finish loading
await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady());
// Wait for initial code evaluation to complete
await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
```

### Evaluating Code

```javascript
await page.evaluate((code) => window.CascadeAPI.setCode(code), myCode);
await page.evaluate(() => window.CascadeAPI.evaluate());
await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });
const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
// errors should be [] for success
```

### Taking Screenshots

The viewport uses WebGL which requires special browser flags for headless rendering:

```javascript
// playwright.config.js — REQUIRED for WebGL screenshots
launchOptions: {
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
}
```

To capture a screenshot of the 3D model:

```javascript
// Method 1: Use CascadeAPI (returns base64 PNG via Three.js renderer)
const dataURL = await page.evaluate(() => window.CascadeAPI.screenshot());

// Method 2: Trigger a download and read the file
await page.evaluate(() => {
  const dataURL = window.CascadeAPI.screenshot();
  const byteString = atob(dataURL.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: 'image/png' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'screenshot.png';
  a.click();
});
// File saves to .playwright-mcp/ directory
```

### Console Log Capture with Tags

Use tagged console.log for extracting specific values in tests:

```javascript
// In CAD code:
console.log("VOLUME:" + Volume(shape));

// In test:
const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
const volume = parseFloat(logs.find(l => l.startsWith("VOLUME:")).split(":")[1]);
```

## CAD Modeling — Common Pitfalls

### 1. Loft() Requires TopoDS_Wire, Not TopoDS_Shape

`Loft()` only accepts wires. After transforms (Translate, Rotate), shapes become
generic `TopoDS_Shape` even if they started as wires. Use `GetWire()` to extract:

```javascript
// WRONG — Translate returns TopoDS_Shape, Loft fails
let w1 = Translate([0,0,10], Circle(10, true));
Loft([w1, Circle(5, true)]);  // BindingError!

// RIGHT — Use GetWire or create wires at the right position via Sketch
let w1 = Circle(10, true);
let w2 = Translate([0,0,10], Circle(5, true));
Loft([GetWire(w1), GetWire(w2)]);
```

### 2. FilletEdges() Must Be Applied Before Hollowing

When filleting a solid shape, apply FilletEdges BEFORE boolean operations that
create internal geometry. After Difference/Union, the edge topology changes and
the selector may not find the edges you expect.

```javascript
// GOOD: Fillet the solid tray, then hollow it
let tray = Extrude(face, [0, 0, height]);
tray = FilletEdges(tray, 2, Edges(tray).max([0,0,1]).indices());
tray = Difference(tray, [cavity]);  // Hollow after filleting

// BAD: Fillet after hollowing — edges may not be found
let tray = Extrude(face, [0, 0, height]);
tray = Difference(tray, [cavity]);
tray = FilletEdges(tray, 2, Edges(tray).max([0,0,1]).indices());  // May fail!
```

### 3. Offset() on Faces Returns a Wire/Face, Not a Solid

`Offset(face, distance)` returns a 2D offset of the face boundary. To create a
hollow solid, offset the face and extrude separately:

```javascript
let inner = Offset(outerFace, -wallThickness);
let cavity = Translate([0, 0, wall], Extrude(inner, [0, 0, height]));
solid = Difference(solid, [cavity]);
```

### 4. Negative Volume from Face Orientation

`Volume()` may return a negative value if the shape's face normals are inverted.
This is cosmetic — use `Math.abs(Volume(shape))` if you need the magnitude.

### 5. Sketch Fillet Order

Sketch `.Fillet()` must be called AFTER `.LineTo()` — it fillets the corner at
the most recent vertex. Calling `.Fillet()` before any lines will fail silently.

```javascript
new Sketch([-10, -10])
  .LineTo([10, -10]).Fillet(5)    // Fillet the corner at [10, -10]
  .LineTo([10,  10]).Fillet(5)    // Fillet the corner at [10,  10]
  .End(true).Face();
```

### 6. Transforms Return New Shapes

`Translate()`, `Rotate()`, `Scale()`, `Mirror()` return new shapes. If you pass
`keepOriginal: true` (3rd param for Translate/Rotate), the original stays in
`sceneShapes` AND you get a copy. By default, the original is consumed.

### 7. Circle(r, true) vs Circle(r, false)

- `Circle(r, true)` → wire (for Loft, Pipe, RotatedExtrude profiles)
- `Circle(r, false)` or `Circle(r)` → face (for Extrude, Revolve)

### 8. Scale() Takes a Scalar, Not a Vector

`Scale(factor, shape)` only accepts a single number, not `[x, y, z]`.
Non-uniform scaling is not supported. Using an array will produce a null shape
that causes cascading errors ("Not a compound shape!", "Main Shape is null!").

### 9. BSpline for Pipe Paths

`BSpline(points, closed)` creates a smooth curve through the given points.
Use `closed: false` for open paths (Pipe rails) and `closed: true` for rings.

### 10. Null Shape Cascading Errors

If any operation produces a null shape (e.g., from bad Scale, failed Fillet, etc.),
subsequent operations that consume it will fail with unhelpful messages:
- "Not a compound shape!" — passing null to Union/Difference
- "Main Shape in Difference is null!" — shape was consumed or nullified
- "Null Shape detected in sceneShapes" — final rendering catches it

Fix: identify which operation first failed (check console errors in order).

## Iterative Model Development Workflow

When building a model interactively via Playwright:

1. **Build**: `npm run build`
2. **Start server**: `npx http-server ./build -p PORT -c-1 --silent`
   - Use `-c-1` to disable caching
   - Use a **new port** if changing JS code — browsers cache ESM aggressively
3. **Navigate**: `page.goto('http://localhost:PORT')`
4. **Wait for WASM**: `await page.waitForFunction(() => window.CascadeAPI?.isReady())`
5. **Inject code**: `page.evaluate((c) => { CascadeAPI.setCode(c); }, code)`
6. **Evaluate**: `await page.evaluate(() => CascadeAPI.evaluate())`
7. **Wait**: `await page.waitForFunction(() => !CascadeAPI.isWorking())`
8. **Check errors**: `page.evaluate(() => CascadeAPI.getErrors())`
9. **Screenshot**: Trigger download of `CascadeAPI.screenshot()` base64 PNG
10. **Iterate**: Fix errors, re-inject, re-evaluate

### Screenshot Download Pattern

```javascript
await page.evaluate(() => {
  const dataURL = window.CascadeAPI.screenshot();
  const byteString = atob(dataURL.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: 'image/png' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-screenshot.png';
  a.click();
});
// Downloaded to .playwright-mcp/my-screenshot.png (relative to CWD)
```

### History Step Screenshots

```javascript
const steps = await page.evaluate(() => CascadeAPI.getHistorySteps());
// steps = [{fnName: "Extrude", lineNumber: 18, shapeCount: 1}, ...]

// Screenshot a specific build step:
await page.evaluate(() => CascadeAPI.screenshotHistoryStep(0)); // First step
// Then download via the pattern above

// Return to final result:
await page.evaluate(() => CascadeAPI.showFinalResult());
```

## Build System

- **Bundler**: esbuild (ESM, minified, source maps)
- **Entry points**: `js/MainPage/main.js` + `js/CADWorker/CascadeStudioMainWorker.js`
- **Static assets**: `css/`, `fonts/`, `textures/`, `lib/`, `icon/` → `build/`
- **Type definitions**: Copied to `build/typedefs/` for Monaco IntelliSense
- **WASM**: `node_modules/opencascade.js/dist/cascadestudio.wasm` → `build/`

The build script is `scripts/build.js`. It generates `build/index.html` with
the Monaco AMD loader and ESM script tag for `main.js`.

## URL Encoding

Projects can be shared via URL: `?code=<encoded>&gui=<encoded>`

Encoding: `encodeURIComponent(btoa(deflateSync(text)))` (using fflate)
Decoding: `inflateSync(atob(decodeURIComponent(encoded)))` (compatible with master's RawDeflate)

## Key Dependencies

- **opencascade.js**: Custom fork of OCCT 8.0.0 RC4 compiled with emsdk 4.0.23
  - See `node_modules/opencascade.js/CLAUDE.md` for build details
- **Three.js r170**: 3D rendering (matcap material, OrbitControls)
  - `THREE.ColorManagement.enabled = false` for legacy rendering
- **Monaco Editor**: Code editor with TypeScript IntelliSense
- **Dockview**: Panel layout system (replaces Golden Layout)
- **Tweakpane v4**: GUI controls (sliders, checkboxes)
- **fflate**: DEFLATE compression for URL encoding
