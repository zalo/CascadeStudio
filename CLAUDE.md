# CascadeStudio — Agent Development Guide

## Project Overview

CascadeStudio is a browser-based parametric CAD modeling environment. Users write JavaScript
(or OpenSCAD) in a Monaco editor; code is evaluated in a Web Worker with OpenCascade (OCCT)
compiled to WebAssembly via Emscripten. The 3D viewport uses Three.js with a matcap material.

## Quick Start

```bash
npm run build          # builds cascade-core then cascade-studio
npx http-server ./packages/cascade-studio/dist -p 8080 -c-1 --silent
npx playwright test    # 32 tests (incl. 10 frozen build123d example scripts)
```

## Architecture (Monorepo)

The project is split into two npm workspace packages:

- **cascade-core** — Reusable CAD engine (no GUI deps). Worker + OpenCascade WASM + mesher.
- **cascade-studio** — Browser IDE. Three.js viewport, Monaco editor, Tweakpane GUI.

```
packages/
  cascade-core/
    src/
      engine/
        CascadeEngine.js       ← Main-thread API wrapping Worker + MessageBus
        MessageBus.js          ← Typed worker message routing
      worker/
        CascadeWorker.js       ← Web Worker entry; evaluates user code
        StandardLibrary.js     ← CAD primitives (Box, Sphere, etc.)
        StandardUtils.js       ← Caching, hashing, history tracking
        ShapeToMesh.js         ← OpenCascade → mesh triangulation (no Three.js)
        FileUtils.js           ← STEP/IGES/STL import/export
      openscad/
        OpenSCADTranspiler.js  ← OpenSCAD → CascadeStudio JS transpiler
      index.js                 ← Package entry (exports CascadeEngine, MessageBus, etc.)
    types/
      StandardLibraryIntellisense.ts
    fonts/                     ← TTF fonts for Text3D

  cascade-studio/
    src/
      main.js                  ← ESM entry point
      CascadeMain.js           ← App shell, layout (Dockview), default STARTER_CODE
      CascadeAPI.js            ← window.CascadeAPI — programmatic API for agents
      CascadeView.js           ← 3D viewport, Three.js rendering, modeling timeline
      EditorManager.js         ← Monaco editor, code evaluation, keyboard shortcuts
      ConsoleManager.js        ← Console panel, log/error capture
      GUIManager.js            ← Tweakpane GUI panel (sliders, checkboxes)
      CascadeViewHandles.js    ← 3D gizmo handle visualization
      openscad/
        OpenSCADMonaco.js      ← Monaco language support for OpenSCAD
    css/, textures/, icon/, lib/  ← Static assets

test/                          ← Playwright tests (monorepo root)
```

## Agent API (window.CascadeAPI)

Four methods — that's it:

1. `getQuickStart()` → Learn the API (call this first)
2. `runCode(code)` → Run CAD code, returns `{success, errors, logs, historySteps}`
3. `saveScreenshot(filename)` → Download 3D model screenshot (view with Read at `.playwright-mcp/filename`)
4. `setCameraAngle(azimuth, elevation)` → Rotate view (0=front, 90=right; 0=level, 90=top)

**NEVER** use `browser_take_screenshot` (captures full page UI, not the 3D model) or `browser_run_code` (use `setCameraAngle` instead).

## GUI Modeling Tools

LeapShape-style tools in the viewport toolbar (top-left overlay). **Every GUI operation
emits JavaScript into the Monaco editor — the code IS the scene.** Committing a tool
action appends a snippet (via `executeEdits`, so Monaco undo works) and re-evaluates.

**Tools**: Select (default), Box, Cylinder, Sphere, Sketch, Fillet. One active at a
time; Escape cancels the current interaction, then returns to Select. OrbitControls
are disabled while a creation drag is in progress (like HandleManager's gizmo drags).

- **Box**: pointerdown on the ground plane (snapped to integer mm) → drag footprint →
  release → move to set height → click commits `let box1 = Translate([x,y,0], Box(w,d,h));`
- **Cylinder**: click center → drag radius → drag height → click commits
- **Sphere**: click center → drag radius → release commits
- **Sketch**: stateful multi-click profile drawing (Fusion-style sketch → extrude).
  Clicks place grid-snapped vertices with a rubber-band preview (length/angle label);
  the Line/Arc toggle (or `L`/`A` keys) picks the segment type — Arc segments take two
  clicks (through-point, then end) and preview the live three-point arc. Escape is
  vertex-level undo (a half-placed arc through-point is its own undo step); Enter or
  clicking the first vertex closes (min 3 vertices; closing works from Arc mode too).
  Once closed, corner-vertex clicks toggle sketch fillets (vertex 0, the Sketch start
  point, can't be filleted — pitfall 5), and an inline panel commits as
  **Extrude / Revolve / Face only**; for Extrude, dragging vertically inside the
  profile sets the height interactively (the input reflects the drag). Emits the
  Sketch builder chain, e.g.
  `let profile1 = new Sketch([20,5]).LineTo([35,5]).ArcTo([42,12],[35,20])`
  `.LineTo([20,20]).Fillet(3).End(true).Face(); let part1 = Extrude(profile1, [0,0,15]);`
  The sketch plane is a parameter on the tool (CAD origin + u/v basis in
  `SketchTool.plane`) to make sketch-on-face feasible later; v1 always uses the
  ground plane (XY at z=0), which maps 1:1 onto the default `new Sketch([u,v])` plane.
- **Fillet**: click edges to multi-select (orange highlight), set radius in the inline
  panel, Enter/Apply commits `shapeVar = FilletEdges(shapeVar, r, [indices]);`. The edge
  indices are exactly the per-shape indices the hover tooltip shows. If the producing
  line is a bare expression (`Box(10,10,10);`), it is rewritten to `let box1 = ...` first.
- **Select**: clicking a shape reveals + flashes the editor line that produced it.

**File map** (`packages/cascade-studio/src/tools/`):
- `ToolManager.js` — toolbar DOM, capture-phase pointer routing (fires before
  OrbitControls), raycast/snap/CAD↔three helpers, variable naming, code emission,
  Escape/keyboard routing (tools can consume Escape for stage-level undo)
- `Tool.js` — base class; `SelectTool.js`, `BoxTool.js`, `CylinderTool.js`,
  `SphereTool.js`, `SketchTool.js`, `FilletTool.js` — per-tool state machines

**Pick → line mapping**: `CacheOp` (StandardUtils.js) tags every produced shape with
`.producingLine`; `combineAndRenderShapes` (CascadeWorker.js) builds face/edge-hash →
sceneShape-index maps plus a `shapeLines` array that flow through ShapeToMesh into the
mesh payload (`face.shape_index`, `edge.shape_index`, `meshData.shapeLines`). The
viewport stores the shape index in the third vertex-color channel (faces) and in
`globalEdgeMetadata` (edges); `viewport.getPickInfo(intersect)` + `getShapeLine(i)`
resolve a click to an editor line.

**Coordinates**: three.js scene is Y-up, CAD is Z-up. CAD `[x,y,z]` ↔ three `(x, z, -y)`
(see `ToolManager.cadToThree/threeToCad`, same mapping as CascadeViewHandles.js).

**Testing hooks**: `CascadeAPI._tools` exposes the ToolManager; tests drive tools with
synthetic PointerEvents on the canvas (see `test/gui-tools.spec.js`).

## Python (build123d) Mode

A third editor language mode `'python'` (alongside `'cascadestudio'` and `'openscad'`):
users write **build123d algebra-mode** Python that evaluates in the existing CAD worker.

**Architecture — Brython in the worker (NOT Pyodide, deliberate to stay lean)**:
- `packages/cascade-core/src/worker/PythonRuntime.js` lazily bootstraps Brython on the
  FIRST Python evaluation: brython.js (~1.38 MB raw / ~300 KB gz, copied to dist by the
  cascade-core build) is fetched as text and indirect-eval'd in the worker global scope
  (module workers lack importScripts; brython.js is strict-mode, so its `__BRYTHON__`/`$B`
  are exported onto `globalThis` from inside the eval'd text). JS mode pays zero cost.
- `packages/cascade-core/src/worker/Build123dLite.js` embeds the **build123d-lite**
  Python source (a JS template string — beware: it must contain no backticks or `${`).
  It is registered as the importable module `build123d` via
  `__BRYTHON__.runPythonSource(src, 'build123d')`; user code runs as module `'main'`,
  so user line numbers map 1:1 to editor lines (nothing is prepended).
- Python accesses the worker's standard library via `from browser import self as w` —
  e.g. `w.Box(...)`, `w.Union([...])`. The JS functions own all sceneShapes bookkeeping,
  so wrapped shapes are never double-added. (Brython wrappers defeat `indexOf` identity;
  use Python `is` to compare shapes across the boundary.)
- `CascadeWorker.evaluate` branches on `payload.language === 'python'`: the evaluation
  becomes async (Brython bootstrap) and its pending promise gates
  `combineAndRenderShapes`; the worker's onmessage router supports Promise-returning
  handlers. `resetWorking`/`modelHistory` still fire in the same order as JS mode.
- Python errors throw a JS Error whose message is `Python <summary>\n<full traceback>`
  (extracted via `$B.error_trace(exc)`); it surfaces through the usual worker →
  `window.onerror` → `CascadeAPI.getErrors()` path. NOTE: worker logs/errors post
  asynchronously — tests must poll for console content, not sample right after runCode.
- **Line mapping works in Python mode**: `CacheOp` calls `self.getPythonUserLine()`
  (walks Brython's frame chain to the innermost `'main'` frame, `frame.$lineno`) instead
  of parsing JS eval stack frames. History steps, Select-pick → line flash, and the
  Fillet tool's variable resolution all work on Python lines.

**build123d-lite coverage** (vs real build123d 0.11.1 — validated by running the
upstream docs/examples scripts through both, see `test/b123d-validation/`; currently
**110/126 scripts PASS** (volume within 0.5%, bbox within 1e-3/axis), 4 MISMATCH,
12 ERROR, 0 timeouts — full breakdown with per-script reasons in the committed
`test/b123d-validation/report.md`. A full 129-script harness pass takes ~60 s with
`--pages 4` (~2.5 min single-page); the harness MUST run with
`CS_TEST_HEADFUL=1 DISPLAY=:99` on this machine (headless Chromium has no WebGL,
which manifests as every script reporting "no measurement produced"). Debug a
single script with `test/b123d-validation/probe.mjs` (prints raw measurements +
errors). Since the GeomAPI-array binding round: Spline/Helix interpolate EXACTLY
(GeomAPI_Interpolate, incl. tangents=/tangent_scalars=/per-point tangents/periodic),
sweep uses MakePipeShell with upstream's trihedron/transition modes (incl.
multisection, normal=, binormal=), section()/make_hull/draft/project (BuildPart
form) work, joints are live (RigidJoint/RevoluteJoint/LinearJoint/
CylindricalJoint/BallJoint with connect_to), scipy.optimize.minimize is shimmed
(pure-Python Nelder-Mead) with DoubleTangentArc on top,
make_surface_from_array_of_points skins interpolated rows, Mesher writes STL
into MEMFS, and known OCCT 8.0.1 wasm kernel faults RAISE instead of returning
silently-wrong geometry:

| Area | Supported | Not supported |
|---|---|---|
| Builders | `with BuildPart/BuildSketch/BuildLine(...)` as plain context managers over a module-level stack (nesting, `mode=`, multiple workplanes, pending faces/edges/path), `Mode.ADD/SUBTRACT/INTERSECT/REPLACE/PRIVATE`, `add()` (incl. Locations-context replication into BuildLine), `Select.LAST` for edges, `Workplanes()` (shares the Locations fanout path — a plane basis IS its Location) | — |
| 3D objects | `Box`, `Cylinder` (incl. `arc_size`), `Sphere`, `Cone`, `Torus`, `Hole`, `CounterBoreHole`, `CounterSinkHole` — all with `rotation=`/`align=`/`mode=`; `Solid.extrude_linear_with_rotation` | `Wedge`, partial spheres/cones |
| 2D objects | `Rectangle`, `RectangleRounded`, `Circle`, `Ellipse`, `Polygon`, `RegularPolygon`, `Trapezoid`, `SlotOverall`, `SlotCenterToCenter`, `SlotArc`, `Text` (opentype.js/FreeSans, FreeType-parity kerning), `BaseSketchObject`/`BasePartObject` subclassing, `Face(outer_wire, [hole_wires])`, `Face.make_rect`, `Face.make_surface_from_array_of_points` | `Triangle`, `Text(path=/font_path=)` |
| 1D objects | `Line`, `Polyline`, `PolarLine`, `ThreePointArc`, `RadiusArc`, `SagittaArc`, `CenterArc`, `TangentArc`, `JernArc`, `Bezier` (incl. weights), `Spline` (EXACT GeomAPI_Interpolate incl. `tangents=`/`tangent_scalars=`/per-point/periodic), `DoubleTangentArc`, `Helix`, `EllipticalCenterArc`, `curve @ u / % u / ^ u` (incl. multi-edge curves), `Edge.make_line/make_mid_way`, `Wire(edges)` | `BlendCurve`, conical `Helix` |
| Ops | `extrude` (dir/both/`taper=`/`until=Until.NEXT/LAST`), `revolve` (arbitrary Axis), `loft`, `sweep` (MakePipeShell: `is_frenet`, `transition=`, `normal=`, `binormal=`, `multisection=True`), `fillet`/`chamfer` (3D edges), `fillet` (2D sketch vertices), `offset` (2D + solid, `openings=`, Kind.ARC/INTERSECTION), `mirror`, `split` (Keep.TOP/BOTTOM), `scale` (uniform about location + non-uniform gp_GTrsf; spec-level inside BuildLine), `make_face`, `make_hull`, `section()`, `draft()`, `project()` (BuildPart pending-faces form), `project_to_shape`, `project_to_viewport` (HLR), `bounding_box()`, `pack()` | `thicken`, `full_round`, `trim`, one-sided `offset(side=)`, `split(Keep.BOTH)`, screen-projection `project()` forms |
| Locations | full `Location` (matrix-based; 1/2/3-arg incl. axis-angle), `.position/.orientation/.x_axis/.y_axis/.z_axis`, `Pos`, `Rot`/`Rotation`, `Plane` (named planes, `Plane(face)` with the exact gp_Ax3/D1 x_dir rule, `offset()`, `rotated()`), `Locations`, `GridLocations`, `PolarLocations`, `HexLocations`, `Workplanes` (context managers AND iterables, `append()`), `planes * shape`, `locs * shape`; shapes track a composed `.location` (`locate()/located()` are absolute; `.position` settable) | `Location.orientation` edge cases |
| Joints | `RigidJoint`, `RevoluteJoint`, `LinearJoint`, `CylindricalJoint`, `BallJoint` — upstream's exact relative-location algebra; `connect_to` repositions the other part; `copy.copy` rebinds joints; builder-scoped joints transfer to the part on exit | assembly structure / XCAF (roadmap), joint `symbol` rendering |
| Selectors | `.edges()/.faces()/.vertices()/.solids()/.wires()` as ShapeLists with `filter_by` (Axis with DEGREES tolerance/GeomType/callable), `filter_by_position`, `group_by`, `sort_by` (Axis/SortBy incl. RADIUS), `sort_by_distance`, slicing, `+` keeps ShapeList; Edge `position_at/tangent_at/@/%` are orientation-aware, `Axis(edge)` raw-curve like upstream | — |
| Algebra | `+ - &` (incl. lists; multi-tool cuts fuse tools first; fuse guarded against the known 8.0.1 drop fault), `Part()/Sketch()/Curve()` empty starters, `Compound(children=)`, `copy.copy`, `Shape.__iter__` | — |
| Measure | `volume/area/length` (volume = per-solid sum), `center()`, `bounding_box()` (exact Bnd_Box), `.wrapped`, `.is_forward` | mass properties |
| Stdlib | `math`, `copy`, `typing`, `functools`, `itertools`, `operator`, `logging`, `random`/`timeit` (CPython-exact), `scipy.optimize.minimize`/`minimize_scalar` (pure-Python Nelder-Mead / bounded golden-section) | `numpy`, `scipy.spatial` (raises loudly), everything else |
| Export | `Mesher` (STL into worker MEMFS), `export_stl` (MEMFS) | 3MF (no lib3mf — raises), `export_step/gltf` (no-ops), `ExportDXF`, imports |

**Known honest gaps** (kept as ERRORs rather than fake geometry — see
report.md for the per-script list): `thicken`, screen-projection `project()`,
`Solid.make_sphere/make_loft` classmethods, `Face.extrude/revolve` classmethods,
`wrap_faces`, `find_intersection_points`, `make_gordon_surface`, one-sided
`offset(side=)`, 3D `scipy.spatial.ConvexHull` (platonic_solids), 3MF export.
Two scripts die on KNOWN OCCT 8.0.1 wasm kernel faults that lite DETECTS and
RAISES (never silently-wrong geometry): fusing coplanar BSpline-edged contact
faces drops an operand (ex34 x2), and FilletEdges on certain hull/draft results
aborts the wasm heap (cast_bearing_unit, toy_truck). `handle` fails only its own
in-script 1e-3 volume assert (OCCT 8.0.1 vs OCP 7.x MakePipeShell differ ~0.02%).

**Known compromises** (each marked in source with a grep-able
`COMPROMISE(<topic>)` comment — `grep -rn "COMPROMISE(" packages/` is the
authoritative list):
- `scipy-shim` — pure-Python Nelder-Mead/golden-section instead of scipy; all other scipy APIs raise.
- `joints` — location algebra on lite shapes; no assembly tree/XCAF (roadmap), no joint symbols.
- `mesher` — STL only, written into the worker's in-memory Emscripten FS (no lib3mf, no disk).
- `double-tangent-arc` — scan+bisection root solve over a sampled/refined curve distance; trims the over-extended target segment where upstream relies on wire fixing.
- `kernel-guard` — fuse results smaller than the largest input RAISE naming the known 8.0.1 fuse fault.
- `make-hull` — 2000 samples/edge; line/circle boundary runs reconstructed exactly, other curves stay simplified polylines.
- `surface-from-points` — rows interpolated exactly + ThruSections skin (Handle_Geom_BSplineSurface is unbound); agrees with upstream's 2-D fit to ~5e-3 (canadian_flag x2 MISMATCH).
- `sweep` — trihedron/transition calls match upstream exactly; residual MakePipeShell numeric differences are kernel-version.
- `helix` — exact interpolation through dense samples with analytic tangents (no surface-curve segment type).
- `edge-orientation` — sub-edge FORWARD/REVERSED can differ from OCP 7.x; Axis(edge)-based measuring can land at the other end (joints x2 MISMATCH).
- `project` — only the BuildPart pending-faces form; projected pending planes use the reversed projection direction (validated on maker_coin).
- `text` — bundled FreeSans only; non-Latin glyph metrics may differ from other Arial substitutes.
- `raw-segments` — non-line/circle edges ride through wires as opaque TopoDS edges (exact, but not transformable at spec level).
- `volume-measure` — volume is summed per solid (8.0.1's VolumeProperties picks up stray-face contributions on mixed compounds).

**Roadmap (deliberately deferred)**:
- XCAF-based assemblies: real part identities, STEP hierarchy/names/colors, a
  viewport assembly tree, and upgrading joints from location algebra to real
  assembly constraints.
- Real-build123d-over-OCP-shim crossover: revisit once the remaining gap is
  dominated by semantics-replication effort; current blockers are numpy in
  geometry.py and the sheer OCP binding surface.

**GUI tools in Python mode**: Box/Cylinder/Sphere emit `name = Pos(cx, cy, cz) *
Primitive(...)` — since build123d primitives are centered, the emission converts the
dragged corner/base placement into the shape's center. Fillet emits
`var = fillet(var.edges(indices=[...]), r)`. See `test/python-mode.spec.js`.

**Validation against real build123d**: `test/b123d-validation/` (see its README)
runs the upstream build123d examples through BOTH real build123d 0.11.1 (native
venv) and Python mode, comparing per-variable volume/bbox. Re-run it whenever
Build123dLite.js changes. Twenty-five representative passing scripts are frozen
as regression tests in `test/python-mode-examples.spec.js` (part of the default
suite) with volumes hardcoded from the native run.

## Playwright Testing

WebGL requires `--use-gl=angle --use-angle=swiftshader` in playwright.config.js launch args.

Environment overrides (for machines where the defaults don't work):
- `CS_TEST_PORT=8517` — test server port (default 8080; use when 8080 is occupied)
- `CS_TEST_HEADFUL=1 DISPLAY=:99` — run headful against an X server (use when headless
  Chromium cannot create a SwiftShader WebGL context, as on this machine)

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
2. **Start server**: `npx http-server ./packages/cascade-studio/dist -p PORT -c-1 --silent`
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
- **Monorepo**: npm workspaces (`packages/cascade-core`, `packages/cascade-studio`)
- **cascade-core build** (`packages/cascade-core/scripts/build.cjs`):
  - Bundles `src/worker/CascadeWorker.js` → `dist/cascade-worker.js`
  - Copies WASM + fonts to `dist/`
- **cascade-studio build** (`packages/cascade-studio/scripts/build.cjs`):
  - Bundles `src/main.js` → `dist/main.js`
  - Copies cascade-core dist, Monaco, type defs, static assets
  - Generates `dist/index.html`
- **Output**: `packages/cascade-studio/dist/`

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
npx http-server ./packages/cascade-studio/dist -p 8113 -c-1 --silent &

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
