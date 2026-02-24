<p align="center">
  <a href="https://zalo.github.io/CascadeStudio/?code=bZDLCsIwEEX3%2FYqhqwhRUjWCiCv9AnXhAxehHWkgtNKmoH%2FvTGsflGYRSOaek8w49JDmDk8msVUJezg7m2AhwuYilLBSIGHJ21rNdgED5TvFAoEXAfVB6LYYf53NSHHn4uF%2FEP0bLFMSfFHhiLgxccq98SgeSkZSPSVsKdspR8B1CFB8EgguhclKV2fmWkuguubg0b5e9PMsRhFwK01XEh6dvhfdBs7nbGyNSNlaL%2Fjxq6MID6aMTYI8wA1VF5FmbIJaDqmzrxKbhzTsAfUD&gui=VY4xC8IwFIT%2Fy5tjSDMIzeIg6KRIEBdxeCQPG0gTaRIcxP9uRAztTffd3XAvMHF8xEAhH3EkUGAwGbR0cfQEBgdKg6YESvCukcZwr9Or4KJj8sbg7HwGtZLiZ%2F%2F9N5Ci9jvnPeUNqDwVYrBFM1Cj%2FRRLsCePYZ4520CjdaVekD3vF1q%2FPw%3D%3D"><img src="./packages/cascade-studio/icon/CascadeStudioBanner-1257x519.png" href></a>
</p>
<p align="center">
  <a href="https://github.com/zalo/CascadeStudio/deployments/activity_log?environment=github-pages">
      <img src="https://img.shields.io/github/deployments/zalo/CascadeStudio/github-pages?label=Github%20Pages%20Deployment" title="Github Pages Deployment"></a>
  <a href="https://github.com/zalo/CascadeStudio/deployments/activity_log?environment=Production">
      <img src="https://img.shields.io/github/deployments/zalo/CascadeStudio/Production?label=Vercel%20Deployment" title="Vercel Deployment"></a>
  <a href="https://github.com/zalo/CascadeStudio/commits/master">
      <img src="https://img.shields.io/github/last-commit/zalo/CascadeStudio" title="Last Commit Date"></a>
  <a href="https://github.com/zalo/CascadeStudio/blob/master/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-brightgreen" title="License: MIT"></a>
</p>

## A Full Live-Scripted CAD Kernel and IDE in the Browser.

Use code to create 3D Models with features ranging from simple primitives + CSG to complex revolves, sweeps, and fillets. Cascade Studio exposes the full power of the [OpenCascade](https://github.com/Open-Cascade-SAS/OCCT) kernel (OCCT 8.0), while providing a concise standard library for simple operations.

Write in JavaScript or OpenSCAD, visualize in real-time, and export to `.step`, `.stl`, or `.obj`. Copy the URL to share your model with anyone.

## Features

 - **Powerful Standard Library** for primitives, booleans, sweeps, lofts, fillets, and more
 - **Sketch API** with plane parameter (`new Sketch([x,y], 'XZ')`) for drawing in XY, XZ, or YZ planes
 - **Selector API** for querying edges and faces: `Edges(shape).parallel([0,0,1]).max([0,0,1]).indices()`
 - **Measurement Functions**: `Volume()`, `SurfaceArea()`, `CenterOfMass()`
 - **Dual Editor Modes**: JavaScript and OpenSCAD
 - **IntelliSense** autocomplete with full TypeScript definitions and JSDoc
 - **Modeling History Timeline** to scrub through build steps in the 3D viewport
 - **Agent API** (`window.CascadeAPI`) for programmatic control via Playwright or developer tooling
 - **Reusable CAD Engine** — `cascade-core` npm package for embedding CAD modeling in any web app
 - Access to the full OpenCASCADE kernel via the `oc.` namespace
 - Automatic caching acceleration of standard library operations
 - `.STEP`/`.IGES`/`.STL` import and `.STEP`/`.STL`/`.OBJ` export
 - URL serialization of code for easy sharing
 - Save/Load projects to preserve code, layout, and imported files
 - Integrated GUI system (sliders, checkboxes, buttons) via Tweakpane
 - Responsive layout with mobile support
 - Installable for offline use as a Progressive Web App
 - **Free and open source under the MIT License**


<p align="center">
  <img title="Use the OpenCASCADE Geometry Kernel to Model your toughest projects." src="./packages/cascade-studio/icon/CSG.gif"          height="192">
  <img title="Define Custom GUIs to easily and simply customize your models!"src="./packages/cascade-studio/icon/GUI.gif"                  height="192">
  <img title="Import and export .STL files and work with them like normal geometry!"src="./packages/cascade-studio/icon/ImportSTL.gif"    height="192">
  <img title="Import and export .STEP files from other CAD Applications!"src="./packages/cascade-studio/icon/ImportSTEP.gif"              height="192">
  <a title="ALPHA: Augment your models with graphical gizmos to get the best of both worlds!" href="https://zalo.github.io/CascadeStudio/?code=fZLBahsxEIbveQqRSz3QitMshTF2ap4gyWFr6MFNVGowcUkc2N5%2BUjuW0HWM6mBs%2F%2Fq%2FH8lRgKN3VJjWjgO8QelsS72KLx8xQqoBYSXHk354iSLHjuF0pJ5Aih3nh8pEFbH5dLZjxlbEW7X5blBTsCRohNCPdEV5F0rhgwmkao0J6h3CM%2Ff%2BQ7nCvM0xDLkDE1W96QZ3dj5mGQJrmdhzezjw5F1D6rIQhPonD6cJput29wuY6AlY0UdIcxVvzNCYlmT5a1aXCYcuCr%2F3wS8EcMO%2FmvvLMLbWx%2FCH%2Fws%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0jQwgTJg8SMDIACjvlpmTk1pir2RVUlSaqqPknJickQrl1QIA"><img src="./packages/cascade-studio/icon/Gizmo.gif"        height="192"></a>
  <img title="Install Cascade Studio for working offline!"                          src="./packages/cascade-studio/icon/Installable.gif"  width="275">
  <img title="Use world-class intellisense with VS Code's Text Editor!"             src="./packages/cascade-studio/icon/Intellisense.gif" width="275">
</p>


## Examples

<p align="center">
  <a title="Logo Example" href="https://zalo.github.io/CascadeStudio/?code=bZDLCsIwEEX3%2FYqhqwhRUjWCiCv9AnXhAxehHWkgtNKmoH%2FvTGsflGYRSOaek8w49JDmDk8msVUJezg7m2AhwuYilLBSIGHJ21rNdgED5TvFAoEXAfVB6LYYf53NSHHn4uF%2FEP0bLFMSfFHhiLgxccq98SgeSkZSPSVsKdspR8B1CFB8EgguhclKV2fmWkuguubg0b5e9PMsRhFwK01XEh6dvhfdBs7nbGyNSNlaL%2Fjxq6MID6aMTYI8wA1VF5FmbIJaDqmzrxKbhzTsAfUD&gui=VY4xC8IwFIT%2Fy5tjSDMIzeIg6KRIEBdxeCQPG0gTaRIcxP9uRAztTffd3XAvMHF8xEAhH3EkUGAwGbR0cfQEBgdKg6YESvCukcZwr9Or4KJj8sbg7HwGtZLiZ%2F%2F9N5Ci9jvnPeUNqDwVYrBFM1Cj%2FRRLsCePYZ4520CjdaVekD3vF1q%2FPw%3D%3D"><img src="./packages/cascade-studio/icon/Logo.png" height="192"></a>
  <a title="Default Example" href="https://zalo.github.io/CascadeStudio/?code=lZE%2Fa8MwEMV3f4qLJxVU7ObPUEqGkgydEw9tQgbHOlsCRSqSTJpvX0m2axMKpcIYWXf6ved3WQYbg6VDKGEvBUMDVy4qDlchJVRaOaMlOI5gSiZaC7qOX9VNCuW7bSLRAdcSd1193WNI2h2kFBY5UJiH1zJ%2FeEmSbKr5ydH4jWJQcIMImwHse7S1QjVez%2Bi24SBcFLPdlbDW%2FX2yCuBQHHwdQvG3NfDJ6DmYyyk40%2BId5SNQdtp5r%2BSY0yeanyg8%2B94%2FKHeY9ynGQ%2F6BCWHt27MzZeVi8GM%2BtdGXeNRlkBSmVFb2VsE%2FqyCzFXXtq6pC0gVH4fjji45%2FOm4Pp0H4lTE%2FotoIVEzeoPHzcXEgOupeBGMSZ1Phx%2FkqSi%2BDdIFfbrEl6ZuYpR75DQ%3D%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZSCElMyS4GKjA1gbJgSIwMdE4PYWgA%3D"><img src="./packages/cascade-studio/icon/Default.png" height="192"></a>
  <a title="General Overview Example" href="https://zalo.github.io/CascadeStudio/?code=lVbbbuM2EH33V0zzRCdy1s5lmyabh2ySpgss0EWcohfDD7RE2WxkUSCp2G6Rf%2B8ZUvItiy7WuUiWhjNnZs4c8t07epppR%2FiV5OayKOgB%2F5RdUabmpnTeSq%2FLKc3Mgryh2ilyZq7I5ORniuSL1IWcFIryuky9xopOB06Hhc6UvaRbq6RXwbmeVzBz4QXWSk%2BpLGmi2GfGvmX2d%2B08VdLKufLKujbI3GSq6BTKk6frxrU4%2BMJ2BwkNEuofn%2BF6%2FON59ypGf1Y%2BnV3STUm6hKdcpgBoLGVWLjibkztyM1kxsDKjtLYvyoUAwfKaSrVonIhRb9A%2F9Env4tCPu8c%2FaxTHi5ND3z3u0O7nsy7VkxEj%2Bu4FxAvo2wvuy0x4WytYAafgbBl0k8o1jcICFOCjWW7X3qrUy3JaF9JSZbWb00L7GdcW7fwjoT%2BTUIe%2F6E7PVelCF9kT3IiTfkLxD4gS6rQhhtVMWbXT4fCEm%2BYqlepco61WZrqOzp6sLF0BWzHqJ%2F2EizROGjeCv3W7ydr77arQ5R6D2mcRPLIKvgPymdLTmQ%2BLWyu4fAv61pQ7kK16McUL08%2BihP8YnUXnmc5zZZkp3lQhwsR4b%2BYhpo5x4EoMzkPbQL7zLfAt%2FcRQKXoyVTe8YGptbO6XaGQGMM0Nownkk4VBWEkv6BkzVnPz0JGwsDEWwReNkJ4Y9DjDkOt4C8Oj8cgx%2B1qYBVzCvfU6xaiv2nJumharGdL2C%2B1iXXcdigflf4efgATxudAJnZ1zudcYvugKkYcLpao36fHiYMdGTT4fhxV6B34EgvTHSUMU3AxOE8xhctofgzO5LJzaZstjbONle%2BPoPpsql4QouHAmPDFAMTE1ZASiskn3ZqkjQ2OKYjSI0eknVLXxKLbYG8abu842Tf6997AF3KBG421sv%2Ba5U%2F4So8WroWmWqQO%2BpT4MDc8uTVZ7mDKUXZZpLNGWSENF4Qf6aaIy6vLZLNyzJlc3Q93OYVgZg4sntfSnd%2BLgF8jl6XvWSybuwaMBq80Bt%2B%2F4ZLd1ccVmVE7vwiPKLYZAYpZr9bQC8BypxOluQ%2BgftoIwKQ6QrjOFdBxoHSDInIU8hzwerM6%2BJhK9c64xy9Agwc92XT%2BbHFX9xPJewXuY58itkqS1csVCFPrPewB2F0qBVZe1gWYAD0Y91D74Y2ditMfpPSyYr4RutU0LJS4SKAZ0uLs9clG5QUJTl1nP5PkOFMWMJIMnTc8FREqz9oSazgFLYZfFXEJ2omJEh4HKJPZ0DfjOuLqAdrIN4nYm55Au7H1VhdmWmMlepqYWSpQy81GI%2FwEVlS26CHG%2FFZbt29B3QTQVWAveDB9oWE8Czdk5dineF%2BJG1ZDISzttd6%2B1dALnTeHMJf1WQvREN8xu6LKLOihibd7sJmjOBoBYbysAPFrnEPh4ikRC8zCmnXE8MPBOTHUVjzQTNKGF2lBnCn7iYOIBowwHCSUdTkjaVYVcbfbgT8B6Tf2rDkwEP13ha%2B%2Bif4WbDxSvR9d01u%2F%2BG7eExmzZmi0bs%2BWOGX90LtYhPjTojgtVTv1sy2qvMsuEVqxHSbNg1LoY4%2BjQ2r%2Bu79q3R0fx7WvntfMf&gui=dY8xC8IwEIX%2Fy80hJLVF6OLg0EkpRVzE4UgOG7SpJCkO4n83Ftss7XYf73sP7g2q7569JRuO2BGUoNAr1HQ29AIGB%2FJtQx5KweVMDdpbVC%2BCC8myK4M9qpZ2UAY3EIMGtRliZZNzWUw4dTLBchErp9aouyUfvTg8U5rOmeTbIpphNMJCUqPDbkzHa82gQC5ZP1owK9cPVtcPtOmRyhn9h88X"><img src="./packages/cascade-studio/icon/Variety.png" height="192"></a>
  <a title="Rotated Extrusion Example" href="https://zalo.github.io/CascadeStudio/?code=VY2xCsMwDER3f4VGGxRw0roNhI7pXEo3kyFgYQwmhkSlzd9HeIsGoZN07zIx8C9tvH%2FWNC8xEzzgXXhmCuOf128grUDqVfIey6K9bzqH0LTS7ITgz8oiXOosQtxkEKrdyaHrrRmUeqYsqWOItOlztLwIokW4I1wFhDfshVXXbjLDAQ%3D%3D&gui=TYoxC8IwEEb%2Fy83XcskkWRwEnRQp4iIOR3LYQHqRJsVB%2FO8W1OL2ve%2B9J%2Fg83LOK1gMPAg48F89BzlEegLCX0ndSwFFrFupYb3N6oZYM2ivCKaYKrjGrz%2Fz5xhJamv02piR1Da6OkyBs2Pey0G7Mk4ZjYv3%2FYvjC6w0%3D"><img src="./packages/cascade-studio/icon/RotatedExtrusion.png" width="256"></a>
  <a title="Fillet Example" href="https://zalo.github.io/CascadeStudio/?code=RZHNTsMwEITveYpRT65kSNKKQ4UQEhU8AJQDqnrIz7YxJHbluH9CvDu7TgM5JM7ufjOTTZpi6akIhNAQqktrbE0eha1joXSFr%2BPbpzNWSl3SUkAwbUC8HvDWGkEANVlxeaKRQeNmJvdZNr2PQOnOGIGVL2zfsqdaZzyskWfZRuPJnRWfNO5iSSP4A02v%2FJjsg%2FlXFyQwGzKfa2Elj8byOqSEnmXZH%2By6cjR%2Ft8ZZRJgz6X%2FhDQ8nZquWDVVf3FKTF9My%2FTgZk3wnwqUphkZcUHD7uJ7SheA6UL2jHm4be8YG8j1VQRxLCieiuEL0TbGnPqoNUs%2BCKYmpsdBYL3Q%2Blzw%2FScJ2K0ZEmAVrU7G%2BWkTPfD5FVYg0XBkKY4lzXFCbvij5o3bCit12iCtI5w49oXFH8jwAecaRIffwh3E0dNo7H25%2FAQ%3D%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0jQwgTJg8SMDIACjvlpmTk1pir2RVUlSaqqPknJickQrl1QIA"><img src="./packages/cascade-studio/icon/Fillet.png" height="192"></a>
  <a title="Loft Example" href="https://zalo.github.io/CascadeStudio/?code=fZE9C8IwEIb3%2ForDKULEVu0gIg6uDiJuwSHGqy2GniQRFPG%2FmzRa%2FMIMubyXu%2FcJF40OCqkwgyn8XUvSlz3VTIjeIOfQbOmGg4B3GQ4PESuj8FfOnLA7SfSDOPDEtZG11dIhEykP1aPgsSLXpDLfGF1H3uP1AT7dy1rim0o%2Fid0X5vCLmac8%2F80c%2BzivjNLIAqH1Svp9WFDhQIIlXe3AlvKI4EpDp33pI4IyZC1YVK6i2iZVAWxeojps6cw6oXfWeRpeGy8mmj%2FgcTAxDNuRwe0O&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0DS0gTJi8rpGBjpEBUN4tMycntcReyaqkqDRVR8knPw3GqQUA"><img src="./packages/cascade-studio/icon/Loft.png" height="192"></a>
</p>


## Getting Started

### Quick Start

```bash
npm install
npm run build
npx http-server ./packages/cascade-studio/dist -p 8080 -c-1
# Open http://localhost:8080
```

### Standard Library

Cascade Studio provides a concise standard library for common CAD operations:

```javascript
// Primitives
Box(x, y, z, centered?)
Sphere(radius)
Cylinder(radius, height, centered?)
Cone(r1, r2, height)
Circle(radius, wire?)          // wire=true for Loft/Pipe, false for Extrude
Polygon(points, wire?)
Text3D(text, size, height, font?)

// Sketch API — draw in any plane
let face = new Sketch([0, 0])           // default XY plane
  .LineTo([20, 0]).Fillet(3)
  .LineTo([20, 10]).Fillet(3)
  .LineTo([0, 10])
  .End(true).Face();

let profile = new Sketch([0, 0], "XZ")  // XZ plane for Revolve profiles
  .LineTo([15, 0]).LineTo([10, 8]).LineTo([0, 8])
  .End(true).Face();
Revolve(profile, 360);

// Transforms — all return NEW shapes
Translate([x, y, z], shape)
Rotate([ax, ay, az], degrees, shape)
Scale(factor, shape)
Mirror([vx, vy, vz], shape)

// Booleans
Union(shapes)
Difference(mainBody, [tools])
Intersection(shapes)

// Operations
Extrude(face, [dx, dy, dz], keepFace?)
Revolve(shape, degrees, [ax, ay, az]?)
Loft([wires])
Pipe(shape, wirePath)
Offset(shape, distance)
FilletEdges(shape, radius, edgeIndices)
ChamferEdges(shape, distance, edgeIndices)

// Selectors
Edges(shape).ofType("Line"|"Circle").parallel([axis]).max([axis]).min([axis]).indices()
Faces(shape).ofType("Plane"|"Cylinder").max([axis]).indices()

// Measurement
Volume(shape)
SurfaceArea(shape)
CenterOfMass(shape)
```

### OpenSCAD Mode

Switch to OpenSCAD mode via the dropdown in the top navigation bar. Cascade Studio transpiles OpenSCAD to its JavaScript standard library:

```openscad
difference() {
    cube([20, 20, 20], center=true);
    sphere(r=12);
}
```

### Using cascade-core in Your Own Project

The CAD engine is available as a standalone package with no GUI dependencies:

```javascript
import { CascadeEngine } from 'cascade-core';

const engine = new CascadeEngine({ workerUrl: './cascade-worker.js' });
await engine.init();

const result = await engine.evaluate(`
  let box = Box(20, 20, 20);
  FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());
`, { guiState: { 'Cache?': true } });

// result.meshData = { faces: [...], edges: [...] }
// Render with Three.js, Babylon.js, or any WebGL framework
```


## Agent API

Cascade Studio exposes `window.CascadeAPI` for programmatic control via [Playwright](https://playwright.dev/) or other browser automation tools.

```javascript
// Navigate and wait for WASM to load
await page.goto('http://localhost:8080');
await page.waitForFunction(() => window.CascadeAPI?.isReady());

// Learn the API
const guide = await page.evaluate(() => CascadeAPI.getQuickStart());

// Run CAD code and check results
const result = await page.evaluate(code => CascadeAPI.runCode(code), `
  let profile = new Sketch([0, 0], "XZ")
    .LineTo([15, 0]).LineTo([10, 8]).LineTo([0, 8])
    .End(true).Face();
  Revolve(profile, 360);
`);
// result = { success: true, errors: [], logs: [...], historySteps: [...] }

// Set camera angle and take a screenshot
await page.evaluate(() => {
  CascadeAPI.setCameraAngle(30, 20);    // azimuth, elevation
  CascadeAPI.saveScreenshot('model.png');
});
```


## Architecture

This is an npm workspaces monorepo with two packages:

- **`cascade-core`** — Reusable CAD engine (no GUI dependencies)
- **`cascade-studio`** — Browser IDE (Three.js viewport, Monaco editor, Tweakpane GUI)

```
packages/
  cascade-core/
    src/
      engine/
        CascadeEngine.js       ← Main-thread API wrapping Worker + MessageBus
        MessageBus.js          ← Typed worker message routing
      worker/
        CascadeWorker.js       ← Web Worker entry; evaluates user code
        StandardLibrary.js     ← CAD primitives (Box, Sphere, Sketch, etc.)
        ShapeToMesh.js         ← OpenCascade shape → mesh triangulation
        FileUtils.js           ← STEP/IGES/STL import/export
      openscad/
        OpenSCADTranspiler.js  ← OpenSCAD → JS transpiler
      index.js                 ← Package entry point

  cascade-studio/
    src/
      main.js                  ← ESM entry point
      CascadeMain.js           ← App shell, Dockview layout
      CascadeAPI.js            ← window.CascadeAPI for agent/programmatic use
      CascadeView.js           ← 3D viewport (Three.js), modeling timeline
      EditorManager.js         ← Monaco editor, code evaluation
      ConsoleManager.js        ← Console panel, log/error capture
      GUIManager.js            ← Tweakpane GUI panel (sliders, checkboxes)
    css/, textures/, icon/, lib/  ← Static assets

test/                            ← Playwright tests (monorepo root)
```

The build system uses **esbuild**. `npm run build` builds `cascade-core` first (worker bundle + WASM + fonts), then `cascade-studio` (main app bundle + static assets), outputting to `packages/cascade-studio/dist/`.


## Testing

Cascade Studio includes a Playwright test suite covering primitives, transforms, booleans, operations, selectors, OpenSCAD, exports, and regression scenarios.

```bash
npm run build
npx playwright test    # 12 tests, ~40s
```

WebGL rendering in headless mode requires `--use-gl=angle --use-angle=swiftshader` (configured in `playwright.config.js`).


## [Community](https://github.com/zalo/CascadeStudio/discussions)

Model code is saved to the URL upon every successful evaluation, so you can copy and paste that link to others to view your model. Share your creations in [Github Discussions](https://github.com/zalo/CascadeStudio/discussions).


## Contributing

```bash
npm install
npm run build
npx http-server ./packages/cascade-studio/dist -p 8080 -c-1
```

Edit source files in `packages/`, rebuild, and refresh. Use a new port if changing JS code, as browsers cache ESM aggressively.

Pull Requests to this repo are automatically hosted to Vercel instances, so other users will be able to test and benefit from your modifications as soon as the PR is submitted.


## Credits

Cascade Studio uses:

 - [opencascade.js](https://github.com/donalffons/opencascade.js) (CAD Kernel — OCCT 8.0.0 RC4 via Embind)
 - [Three.js](https://github.com/mrdoob/three.js/) r170 (3D Rendering)
 - [Monaco Editor](https://github.com/microsoft/monaco-editor) (Code Editor with IntelliSense)
 - [Dockview](https://github.com/mathuo/dockview) (Panel Layout System)
 - [Tweakpane](https://github.com/cocopon/tweakpane) v4 (GUI Controls)
 - [opentype.js](https://github.com/opentypejs/opentype.js) (Font Parsing for Text3D)
 - [fflate](https://github.com/101arrowz/fflate) (URL Code Compression)
 - [potpack](https://github.com/mapbox/potpack) (Texture Atlas Packing)
 - [esbuild](https://github.com/evanw/esbuild) (Bundler)
 - [Playwright](https://playwright.dev/) (Testing)

Cascade Studio is maintained by [Johnathon Selstad @zalo](https://github.com/zalo)
