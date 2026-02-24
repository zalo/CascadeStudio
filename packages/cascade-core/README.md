<p align="center">
  <a href="https://zalo.github.io/CascadeStudio/"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/CascadeStudioBanner-1257x519.png"></a>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/cascade-core">
      <img src="https://img.shields.io/npm/v/cascade-core" title="npm version"></a>
  <a href="https://github.com/zalo/CascadeStudio/blob/master/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-brightgreen" title="License: MIT"></a>
</p>

# cascade-core

Reusable CAD modeling engine built on [OpenCascade](https://github.com/Open-Cascade-SAS/OCCT) WASM. Evaluate CAD code in a Web Worker and get triangle mesh data back — no GUI dependencies.

This is the headless engine that powers [Cascade Studio](https://zalo.github.io/CascadeStudio/). Use it to embed parametric CAD modeling in any web application.

<p align="center">
  <img title="CSG Operations" src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/CSG.gif" height="192">
  <img title="GUI Controls" src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/GUI.gif" height="192">
  <img title="STEP Import" src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/ImportSTEP.gif" height="192">
</p>

## Install

```bash
npm install cascade-core
```

## Quick Start

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

Copy `cascade-worker.js`, `cascadestudio.wasm`, and `fonts/` from `node_modules/cascade-core/dist/` to your static assets directory.

## Examples

These are all built with the cascade-core standard library — [try them live](https://zalo.github.io/CascadeStudio/):

<p align="center">
  <a title="Logo Example" href="https://zalo.github.io/CascadeStudio/?code=lZDBasMwDIbveQqRSz3QitMshTF2ap4gyWFr6MFNVGowcUkc2N5%2BUjuW0HWM6mBs%2F%2Fq%2FH8lRgKN3VJjWjgO8QelsS72KLx8xQqoBYSXHk354iSLHjuF0pJ5Aih3nh8pEFbH5dLZjxlbEW7X5blBTsCRohNCPdEV5F0rhgwmkao0J6h3CM%2Ff%2BQ7nCvM0xDLkDE1W96QZ3dj5mGQJrmdhzezjw5F1D6rIQhPonD6cJput29wuY6AlY0UdIcxVvzNCYlmT5a1aXCYcuCr%2F3wS8EcMO%2FmvvLMLbWx%2FCH%2Fws%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0jQwgTJg8SMDIACjvlpmTk1pir2RVUlSaqqPknJickQrl1QIA"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/Logo.png" height="128"></a>
  <a title="Default Example" href="https://zalo.github.io/CascadeStudio/?code=lZE%2Fa8MwEMV3f4qLJxVU7ObPUEqGkgydEw9tQgbHOlsCRSqSTJpvX0m2axMKpcIYWXf6ved3WQYbg6VDKGEvBUMDVy4qDlchJVRaOaMlOI5gSiZaC7qOX9VNCuW7bSLRAdcSd1193WNI2h2kFBY5UJiH1zJ%2FeEmSbKr5ydH4jWJQcIMImwHse7S1QjVez%2Bi24SBcFLPdlbDW%2FX2yCuBQHHwdQvG3NfDJ6DmYyyk40%2BId5SNQdtp5r%2BSY0yeanyg8%2B94%2FKHeY9ynGQ%2F6BCWHt27MzZeVi8GM%2BtdGXeNRlkBSmVFb2VsE%2FqyCzFXXtq6pC0gVH4fjji45%2FOm4Pp0H4lTE%2FotoIVEzeoPHzcXEgOupeBGMSZ1Phx%2FkqSi%2BDdIFfbrEl6ZuYpR75DQ%3D%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZSCElMyS4GKjA1gbJgSIwMdE4PYWgA%3D"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/Default.png" height="128"></a>
  <a title="General Overview Example" href="https://zalo.github.io/CascadeStudio/?code=lVbbbuM2EH33V0z9RCey40uyTZPNQzbZTRdYoIvYRS%2BGH2iJsthIpEBSvrTIv3eGlGzZG3RR52JZnsuZmTOHuriAWSYt4C8HW%2FA8hyf8J8wOElFoZZ3hTqoVZHoDTkNlBVhdCNApuEwAX3OZ82UuIK1U7CR6dDoXFzDNZSLMDTwYwZ3wwWVRopn1X6AvdxBzBUtBMROKzZO%2FKuug5IYXwgljmySFTkTeyYUDB3d1aNb9SnbdCEYRDAeX%2BD748ap3G7K%2FCBdnN3CvQCqMlPIYAWoDieEbqmb8CDbjJQFTCcSVWQvrE3jLO1BiUwdh8%2F5oeOai%2FvWZW%2FQGnyQ2x7HxmesNOnD8%2BiKVmGk2h%2F%2FtAOQA33f4qBLmTCXQCnEyqpZA16Xcwdw7YAM%2B6G2790bEjqtVlXMDpZG2gI10GfUWx%2Fl7BH9Evg9%2FwqMshLJ%2BihQJw7DxMILwh4gi6DQppmUmjDiasL9DQ7OliGUqcayGJ7IKwWaGK5ujLZsPo2FETVpEdRhGn3q9aB%2F9YZdLdcKg5l4Az%2BvYHnkm5Cpz3rmxwpDfgn7QShw3Zq3zNdHPYAv%2F1jIJwROZpsIQU5wufYaldk4XPqcMeTAUG135sSH5rlrgG%2FqxqRAw02XPf0HUOth83OIgEwRTXxAaTz6ea0zLYY0zI8ZKGh5OxDvWxszHgjmWx0Z9qtDXumhheNYOa0zeSrPBkBjeOBnjqu%2Badh6GFrrpy3YbaUNfjwOyJ%2BF%2BwzgeSS80OoLLK2r3HsNXWWLm6UaI8pvyyNnbkVFdz4dpibNDfniCDBdRTRS8GE0i3MNoMlwgZ1KeW9Fmy3MY401zYeFjshI28llsIDdtDKJY6sp5UTmUe7%2BVtlUim49CdvgJu1pHZC32%2BvWmqZPNUR%2BwEf136IS4vSwt2iB%2FSVMr3A3uWO7Zh8NFDiHxYue3h5YYlrsTcAn2n6tYNFEatUY5lbTOqJteIqV60Rv7IsFWxWGitFveMyRnM7F1k0fW%2FRl1c%2FKOhJMY3H3WSG%2FdpTkOxsczDB6HnZk8%2BluQGtwGjktdidmuJHVVgSf7FPKHVhJiRxfLtTrnttteSa93BnXa1%2FFkZPKWWvSvqNmkR6MIf9p9%2FaJT7Opn0vlSh9bWJFPAjeE7UiRPBDoM8JiBGLFKVWkUD8SDO%2B977%2BNRMDY%2FIfcJljFBeZAmzgW7jsALcq%2B9e0HCkY26Uklfp%2BkRFEHUBK32M2eoVpJEyPe00HTGZnrt9SdIRwjoOQ3sROAQ3yV1F6GN2yAeMl6kJKD3ZYlLznE5%2B4lYGZSkmFZA%2FyeoIHEhhM%2F7vbRk36R%2B9OopkLXIm%2BkTTKulpzkFx%2BOKDohwYtUkctysmmNsr6GI8z63%2BgZ%2BVah%2BrOeX2E%2FZBkFkvbePFRzOAQDbny8IeL6vwfNxMqyHh2vaWYQnBzqSoSrDs80Sh9BAramzQn7iE4pDGMo%2FUQhud7SkZc53h8P4M2K9g%2BFtB00Y3d3hx%2F718BYv3kN4P7%2BDy2Hvn3A21Gbbxmxbm22PzOglU7ZP8b5GN8iFWrmsZXXSmW0EO9KjqHaYNyEW%2BAzR2L%2Fur5pvz8%2FDt6%2Bd186%2F&gui=dYwxC8IwEEb%2Fy80hJDVFyOLgrEgQF3E40sMEaSpJioP4342BWkHd7vG9d3ewQ38dAoW8xZ5Ag8VksaODpxsw2FByhhJoweWbDIZzUY%2BCC8maE4M1Wkcr0DmOxMBg58eSLBSX7YRT0wimREn2zttLoFQ8%2BUHza8UkX7bFzNXIP5YdRuzrWq9%2FBmWKs%2FWiL%2FPxBA%3D%3D"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/Variety.png" height="128"></a>
  <a title="Rotated Extrusion Example" href="https://zalo.github.io/CascadeStudio/?code=VY2xCsMwDER3f4VGGxRw0roNhIzpXEo3kyFgYQwmhkSlzd9XeIsGoTvpnjIx8DftfLy3tKwxE4zwKrwwgenH2yeQViD1LPmIZdXeN51DaFppdkbwZ2URLnUWIWkyCDXuZNH11gxKPVLOxFOItOvzazkRRItwR7gKCG%2FYC6vabjbDHw%3D%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0DS0gTJi8rpGBjpEBUN4tMycntcReyaqkqDS1FgA%3D"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/RotatedExtrusion.png" height="128"></a>
  <a title="Fillet Example" href="https://zalo.github.io/CascadeStudio/?code=RZHNTsMwEITveYpRT65kSNKKQ4UQEhU8AJQDqnrIz7YxJHbluH9CvDu7TgM5JM7ufjOTTZpi6akIhNAQqktrbE0eha1joXSFr%2BPbpzNWSl3SUkAwbUC8HvDWGkEANVlxeaKRQeNmJvdZNr2PQOnOGIGVL2zfsqdaZzyskWfZRuPJnRWfNO5iSSP4A02v%2FJjsg%2FlXFyQwGzKfa2Elj8byOqSEnmXZH%2By6cjR%2Ft8ZZRJgz6X%2FhDQ8nZquWDVVf3FKTF9My%2FTgZk3wnwqUphkZcUHD7uJ7SheA6UL2jHm4be8YG8j1VQRxLCieiuEL0TbGnPqoNUs%2BCKYmpsdBYL3Q%2Blzw%2FScJ2K0ZEmAVrU7G%2BWkTPfD5FVYg0XBkKY4lzXFCbvij5o3bCit12iCtI5w49oXFH8jwAecaRIffwh3E0dNo7H25%2FAQ%3D%3D&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0jQwgTJg8SMDIACjvlpmTk1pir2RVUlSaqqPknJickQrl1QIA"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/Fillet.png" height="128"></a>
  <a title="Loft Example" href="https://zalo.github.io/CascadeStudio/?code=fZE9C8IwEIb3%2ForDKULEVu0gIg6uDiJuwSHGqy2GniQRFPG%2FmzRa%2FMIMubyXu%2FcJF40OCqkwgyn8XUvSlz3VTIjeIOfQbOmGg4B3GQ4PESuj8FfOnLA7SfSDOPDEtZG11dIhEykP1aPgsSLXpDLfGF1H3uP1AT7dy1rim0o%2Fid0X5vCLmac8%2F80c%2BzivjNLIAqH1Svp9WFDhQIIlXe3AlvKI4EpDp33pI4IyZC1YVK6i2iZVAWxeojps6cw6oXfWeRpeGy8mmj%2FgcTAxDNuRwe0O&gui=q1ZKzs8tyM9LzSvxS8xNVbJSSk4sTk5MSQ3LTC1X0lHyTS3OCEotVrIy0DOE84IS89KBSqMN9AwMdYxidZRCMnNKlKx0DS0gTJi8rpGBjpEBUN4tMycntcReyaqkqDRVR8knPw3GqQUA"><img src="https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-studio/icon/Loft.png" height="128"></a>
</p>

## API

### `new CascadeEngine({ workerUrl })`

Create an engine instance. `workerUrl` is the path to the bundled worker file.

### `engine.init() → Promise`

Load the worker and OpenCascade WASM. Resolves when ready.

### `engine.evaluate(code, options?) → Promise<{ meshData, sceneOptions }>`

Evaluate CAD code and return triangulated mesh data.

- `code` — JavaScript string using the standard library (Box, Sphere, Sketch, etc.)
- `options.guiState` — slider/checkbox state object
- `options.maxDeviation` — mesh resolution (default 0.1)
- Returns `{ meshData: { faces, edges }, sceneOptions }`

### `engine.meshHistoryStep(index, maxDeviation?) → Promise`

Triangulate a specific modeling history step.

### `engine.exportSTEP() → Promise<string>`

Export the current shape as STEP file text.

### `engine.on(event, handler)` / `engine.off(event, handler)`

Listen for events: `log`, `error`, `Progress`, `resetWorking`, `modelHistory`, `addSlider`, `addButton`, `addCheckbox`, `addTextbox`, `addDropdown`, `saveFile`.

### `engine.isReady` / `engine.isWorking`

Boolean status properties.

### `engine.dispose()`

Terminate the worker and clean up.

## Standard Library

The evaluated code has access to these functions:

- **Primitives**: `Box`, `Sphere`, `Cylinder`, `Cone`, `Circle`, `Polygon`, `Text3D`, `BSpline`, `Wedge`
- **Sketch**: `new Sketch([x,y], plane?).LineTo().Fillet().ArcTo().BSplineTo().End().Face()`
- **Transforms**: `Translate`, `Rotate`, `Scale`, `Mirror`
- **Booleans**: `Union`, `Difference`, `Intersection`
- **Operations**: `Extrude`, `Revolve`, `Loft`, `Pipe`, `Offset`, `FilletEdges`, `ChamferEdges`
- **Selectors**: `Edges(shape).ofType().parallel().max().min().indices()`
- **Measurement**: `Volume`, `SurfaceArea`, `CenterOfMass`
- **GUI**: `Slider`, `Checkbox` (values come from `guiState`)

See the full TypeScript definitions in `types/StandardLibraryIntellisense.ts`.

## OpenSCAD

```javascript
import { OpenSCADTranspiler } from 'cascade-core';

const transpiler = new OpenSCADTranspiler();
const jsCode = transpiler.transpile(`
  difference() {
    cube(20, center=true);
    sphere(r=12);
  }
`);
const result = await engine.evaluate(jsCode);
```

## Credits

 - [opencascade.js](https://github.com/donalffons/opencascade.js) (CAD Kernel — OCCT 8.0.0 RC4 via Embind)
 - [opentype.js](https://github.com/opentypejs/opentype.js) (Font Parsing for Text3D)
 - [potpack](https://github.com/mapbox/potpack) (Texture Atlas Packing)

## License

MIT
