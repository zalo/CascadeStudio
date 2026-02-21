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

Four methods — that's it:

1. `getQuickStart()` → Learn the API (call this first)
2. `runCode(code)` → Run CAD code, returns `{success, errors, logs, historySteps}`
3. `saveScreenshot(filename)` → Download 3D model screenshot (view with Read at `.playwright-mcp/filename`)
4. `setCameraAngle(azimuth, elevation)` → Rotate view (0=front, 90=right; 0=level, 90=top)

**NEVER** use `browser_take_screenshot` (captures full page UI, not the 3D model) or `browser_run_code` (use `setCameraAngle` instead).

## Playwright Testing

WebGL requires `--use-gl=angle --use-angle=swiftshader` in playwright.config.js launch args.

```javascript
await page.goto('http://localhost:8080');
await page.waitForFunction(() => window.CascadeAPI?.isReady());
await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 60000 });

// Use runCode for tests (combines setCode + evaluate + getErrors):
const result = await page.evaluate((code) => CascadeAPI.runCode(code), myCode);
expect(result.errors).toEqual([]);

// Screenshots:
await page.evaluate(() => CascadeAPI.saveScreenshot('model.png'));
// View with Read tool at .playwright-mcp/model.png
```

## CAD Modeling — Common Pitfalls

### 1. Loft() Prefers TopoDS_Wire

`Loft()` works best with wires. After transforms (Translate, Rotate), shapes become
generic `TopoDS_Shape` even if they started as wires. Loft now auto-extracts wires
with a warning, but for clearest code use `GetWire()` explicitly:

```javascript
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
Non-uniform scaling is not supported. Passing an array now logs an error and
falls back to `scale[0]` instead of producing a null shape.

### 9. BSpline for Pipe Paths

`BSpline(points, closed)` creates a smooth curve through the given points.
Use `closed: false` for open paths (Pipe rails) and `closed: true` for rings.

### 10. Union() Works Best with Overlapping Shapes

`Union(shapes)` performs a boolean fusion. Non-overlapping shapes may produce
unexpected results. All boolean operations (Union, Difference, Intersection)
now include volume sanity checks that warn when the result is near-zero.

```javascript
// Keep non-touching shapes as separate scene objects
let tray = Extrude(face, [0, 0, 30]);
let holder = Translate([60, 0, 0], Cylinder(15, 50));
// Both render in the scene without Union
```

### 11. Extrude() Consumes the Input Face

`Extrude(face, direction)` consumes the face by default (`keepFace=false`).
If you need to reuse the face later (e.g., for `Offset()`), either pass
`keepFace: true` or recreate the profile from a new Sketch.

```javascript
// BAD — outerFace is consumed, Offset fails
let outerFace = new Sketch(...).End(true).Face();
let tray = Extrude(outerFace, [0, 0, 30]);
let inner = Offset(outerFace, -3);  // outerFace is gone!

// GOOD — recreate the inner profile independently
let tray = Extrude(outerFace, [0, 0, 30]);
let innerFace = new Sketch(/* smaller dimensions */).End(true).Face();
```

### 12. Sketch Plane Parameter for Revolve Profiles

`new Sketch([x,y], 'XZ')` draws in the XZ plane — `[x,y]` maps to `[X, 0, Z]` in 3D.
This is the correct way to create revolve profiles (lathe-turned parts):

```javascript
// GOOD: Sketch in XZ plane, then Revolve around Z axis
let profile = new Sketch([0, 0], "XZ")
  .LineTo([15, 0]).LineTo([15, 2])
  .LineTo([10, 8]).LineTo([0, 8])
  .End(true).Face();
Revolve(profile, 360);

// BAD: Default Sketch (XY plane) + Revolve around Z = flat concentric circles
let profile = new Sketch([0, 0])
  .LineTo([15, 0]).LineTo([15, 8]).LineTo([0, 8])
  .End(true).Face();
Revolve(profile, 360);  // Produces a flat disk!
```

Supported planes: `'XY'` (default), `'XZ'`, `'YZ'`.

### 13. Null Shape Cascading Errors

If any operation produces a null shape (e.g., from bad Scale, failed Fillet, etc.),
subsequent operations that consume it will fail. Most functions (Extrude, FilletEdges,
ChamferEdges, Offset, Pipe, Difference) now check for null inputs and log a
descriptive error with early return instead of cascading cryptic failures.

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
9. **Screenshot**: `CascadeAPI.saveScreenshot("model.png")` → view with Read at `.playwright-mcp/model.png`
10. **Camera angle**: `CascadeAPI.setCameraAngle(azimuth, elevation)` to rotate (0=front, 90=right)
11. **Iterate**: Fix errors, re-inject, re-evaluate

### Screenshot Download Pattern

```javascript
// Simple: one-line screenshot (auto-fits camera, collapses GUI)
await page.evaluate(() => CascadeAPI.saveScreenshot('model.png'));
// View with Read tool at .playwright-mcp/model.png

// With custom camera angle:
await page.evaluate(() => {
  CascadeAPI.setCameraAngle(90, 30);  // right side, 30° elevation
  CascadeAPI.saveScreenshot('model-side.png');
});
// View with Read tool at .playwright-mcp/model-side.png
```

**NEVER** use Playwright `browser_take_screenshot` — it captures the full page UI.
**NEVER** use `browser_run_code` for mouse dragging — use `setCameraAngle()` instead.

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

## Blind Agent Tests

Test that a fresh agent can discover and use the CascadeAPI without reading local files.
Run in the background so you can continue working:

```javascript
// 1. Build and start server
npm run build
npx http-server ./build -p 8113 -c-1 --silent &

// 2. Launch via Task tool
Task({
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  description: "Blind agent test",
  prompt: `You are testing a browser-based CAD application at http://localhost:8113
Your task: Model a chess knight piece. Make it recognizable and detailed.
Instructions:
1. Navigate to the app
2. Wait for it to load
3. Discover the API by reading the page
4. Build the knight iteratively — run code, check errors, take screenshots to verify
5. Use multiple camera angles to verify from different sides
6. Save a final screenshot when satisfied
Important: Do NOT read any local project files. Discover everything through the browser.`
})
```

**Success criteria**: 0 uses of `browser_take_screenshot` and `browser_run_code`, multiple uses of `saveScreenshot` and `setCameraAngle`.
