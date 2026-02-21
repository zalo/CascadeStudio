// CascadeAPI.js - Programmatic API for agent/CLI integration

import { STLExporter } from '../../node_modules/three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from '../../node_modules/three/examples/jsm/exporters/OBJExporter.js';

/** Exposes window.CascadeAPI for programmatic control of Cascade Studio.
 *  Designed for use by AI agents (via Playwright) and developer tooling. */
class CascadeAPI {
  constructor(app) {
    this._app = app;
  }

  /** Install the API on window and update discovery meta tag. */
  install() {
    window.CascadeAPI = this;
    let meta = document.querySelector('meta[name="cascade-api"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'cascade-api';
      document.head.appendChild(meta);
    }
    meta.content = 'window.CascadeAPI';

    // Console messages for agent discovery — separate calls so each appears
    // as its own [LOG] line in Playwright's Events section (multi-line strings
    // get truncated to a single line and the agent misses the key info).
    console.log('[CascadeAPI] Ready. Run: CascadeAPI.getQuickStart() for docs');
    console.log('[CascadeAPI] Key methods: runCode(code), saveScreenshot(file), setCameraAngle(az,el)');
    console.log('[CascadeAPI] NEVER use browser_take_screenshot or browser_run_code');
  }

  // ===== Golden Path (use these) =====

  /** Run code end-to-end: set code, evaluate, wait, and return results.
   *  Returns: { success, errors, logs, historySteps } */
  async runCode(code) {
    await new Promise(r => setTimeout(r, 50));
    this.setCode(code);
    await this.evaluate();
    return {
      success: this.getErrors().length === 0,
      errors: this.getErrors(),
      logs: this.getConsoleLog(),
      historySteps: this.getHistorySteps(),
    };
  }

  /** Save a screenshot of the 3D model to a file (triggers browser download).
   *  Auto-fits camera and collapses GUI panel first.
   *  View the result with Read tool at .playwright-mcp/filename */
  saveScreenshot(filename) {
    const gui = this._app.gui;
    if (gui && gui._gui) gui._gui.expanded = false;
    const dataURL = this.screenshot();
    const byteString = atob(dataURL.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/png' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'screenshot.png';
    a.click();
    return filename || 'screenshot.png';
  }

  /** Set camera angle. azimuth: 0=front, 90=right, 180=back. elevation: 0=level, 90=top. */
  setCameraAngle(azimuthDeg, elevationDeg) {
    const viewport = this._app.viewport;
    if (viewport) viewport.setCameraAngle(azimuthDeg, elevationDeg);
    this._hasCustomAngle = true;
  }

  /** Compact quick-start guide. Call this FIRST to learn the API. */
  getQuickStart() {
    return {
      workflow: [
        'result = await CascadeAPI.runCode(code) → {success, errors, logs, historySteps}',
        'CascadeAPI.setCameraAngle(azimuth, elevation) → 0=front, 90=right; 0=level, 90=top',
        'CascadeAPI.saveScreenshot("model.png") → then Read .playwright-mcp/model.png to view',
        'NEVER use browser_take_screenshot (captures full page UI) or browser_run_code (use setCameraAngle instead)',
      ],
      functions: {
        primitives: 'Box(x,y,z,centered?), Sphere(r), Cylinder(r,h,centered?), Cone(r1,r2,h), Circle(r,wire?), Polygon(points,wire?), BSpline(points,closed?), Text3D(text,size,height,font?)',
        sketch: 'new Sketch([x,y]).LineTo([x,y]).Fillet(r).ArcTo([mid],[end]).BSplineTo(pts).End(closed?).Face() or .Wire()',
        transforms: 'Translate([x,y,z], shape), Rotate([ax,ay,az], degrees, shape), Scale(factor, shape), Mirror([vx,vy,vz], shape) — ALL return NEW shape!',
        booleans: 'Union(shapes), Difference(mainBody, [tools]), Intersection(shapes)',
        operations: 'Extrude(face, [dx,dy,dz], keepFace?), Revolve(shape, degrees, [ax,ay,az]?), Loft([wires]), Pipe(shape, wirePath), Offset(shape, distance), FilletEdges(shape, radius, edgeIndices), ChamferEdges(shape, distance, edgeIndices)',
        selectors: 'Edges(shape).ofType("Line"|"Circle").parallel([axis]).max([axis]).min([axis]).indices()',
        measurement: 'Volume(shape), SurfaceArea(shape), CenterOfMass(shape)',
      },
      coordinates: 'X=right, Y=depth, Z=up. Polygon takes 2D [x,y] points in XY plane. Extrude [0,0,z] for vertical.',
      tips: [
        'For organic/curved shapes: Loft rounded Sketch cross-sections. Do NOT extrude a flat profile and try to round it after — FilletEdges and Offset both fail on complex solids.',
        'For lathe-turned parts (bases, vases, bottles): define a half-profile with Polygon or Sketch, then Revolve(face, 360).',
        'Sketch().Fillet(r) rounds corners inline — use this to make smooth cross-sections BEFORE lofting.',
        'Offset() on concave solids often self-intersects → zero volume. Only use on simple convex shapes or 2D faces.',
        'FilletEdges works reliably on simple solids (boxes, cylinders). On complex boolean results it usually fails — build the roundness into the geometry instead.',
        'Polygon takes 2D [x,y] in the XY plane only. To use a profile in another plane, create it in XY then Rotate([1,0,0], 90, shape) to reorient.',
      ],
      pitfalls: [
        'Translate/Rotate/Scale return NEW shapes — always capture: shape = Translate([x,y,z], shape)',
        'Circle(r, true) → wire (for Loft/Pipe), Circle(r) → face (for Extrude)',
        'Extrude consumes the face — pass keepFace=true if you need it again',
        'Loft works best with wires — use GetWire() after transforms',
        'Scale takes a single number, NOT a vector',
      ],
      examples: {
        box: `// Rounded box with cavity
let face = new Sketch([-20, -15])
  .LineTo([20, -15]).Fillet(5)
  .LineTo([20, 15]).Fillet(5)
  .LineTo([-20, 15]).Fillet(5)
  .LineTo([-20, -15]).Fillet(5)
  .End(true).Face();
let box = Extrude(face, [0, 0, 20], true);
box = FilletEdges(box, 2, Edges(box).max([0,0,1]).indices());
let inner = Offset(face, -3);
let cavity = Translate([0, 0, 3], Extrude(inner, [0, 0, 20]));
Difference(box, [cavity]);`,
        organic: `// Organic shape via lofted rounded cross-sections
// Each Sketch has .Fillet() for smooth corners — this is the key technique
let s1 = new Sketch([-10,-8]).LineTo([10,-8]).Fillet(4)
  .LineTo([10,8]).Fillet(4).LineTo([-10,8]).Fillet(4)
  .LineTo([-10,-8]).Fillet(4).End(true).Wire();
let s2 = Translate([3,0,15], new Sketch([-7,-5]).LineTo([7,-5]).Fillet(3)
  .LineTo([7,5]).Fillet(3).LineTo([-7,5]).Fillet(3)
  .LineTo([-7,-5]).Fillet(3).End(true).Wire());
let s3 = Translate([0,0,30], Circle(4, true));
Loft([GetWire(s1), GetWire(s2), GetWire(s3)]);`,
        revolved: `// Lathe-turned base via Revolve
let profile = new Sketch([0,0]).LineTo([15,0]).LineTo([15,2])
  .LineTo([12,3]).Fillet(1).LineTo([10,8]).Fillet(1)
  .LineTo([11,10]).LineTo([8,12]).LineTo([0,12])
  .End(true).Face();
Revolve(profile, 360);`,
      },
      fullDocs: 'await CascadeAPI.getStandardLibrary() → TypeScript definitions with JSDoc',
    };
  }

  /** Fetch full standard library TypeScript definitions with JSDoc and examples. */
  async getStandardLibrary() {
    try {
      const resp = await fetch('./typedefs/StandardLibraryIntellisense.ts');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      return `Error fetching standard library: ${e.message}`;
    }
  }

  // ===== Internal (used by runCode/saveScreenshot/tests) =====

  setCode(code) { this._app.editor.setCode(code); }
  getCode() { return this._app.editor.getCode(); }

  evaluate() {
    if (this._evaluatePromise) { return this._evaluatePromise; }
    this._evaluatePromise = new Promise((resolve) => {
      const originalHandler = this._app.messageBus.handlers["combineAndRenderShapes"];
      this._app.messageBus.on("combineAndRenderShapes", (payload) => {
        if (originalHandler) {
          this._app.messageBus.on("combineAndRenderShapes", originalHandler);
        } else {
          this._app.messageBus.off("combineAndRenderShapes");
        }
        if (originalHandler) originalHandler(payload);
        this._evaluatePromise = null;
        resolve();
      });
      this._app.editor.evaluateCode(false);
      if (!window.workerWorking) {
        if (originalHandler) {
          this._app.messageBus.on("combineAndRenderShapes", originalHandler);
        } else {
          this._app.messageBus.off("combineAndRenderShapes");
        }
        this._evaluatePromise = null;
        resolve();
      }
    });
    return this._evaluatePromise;
  }

  getConsoleLog() { return this._app.console.getLogs(); }
  getErrors() { return this._app.console.getErrors(); }
  getHistorySteps() {
    const viewport = this._app.viewport;
    return viewport ? viewport._historySteps.slice() : [];
  }

  screenshot() {
    const viewport = this._app.viewport;
    if (!viewport) return '';
    if (!this._hasCustomAngle) viewport.fitCamera();
    this._hasCustomAngle = false;
    viewport.environment.renderer.render(viewport.environment.scene, viewport.environment.camera);
    return viewport.environment.curCanvas.toDataURL('image/png');
  }

  fitCamera() {
    const viewport = this._app.viewport;
    if (viewport) viewport.fitCamera();
  }

  isReady() { return this._app.startup !== null; }
  isWorking() { return window.workerWorking; }

  setMode(mode) {
    this._app.editor.setMode(mode);
    const modeSelect = document.getElementById('editorMode');
    if (modeSelect) modeSelect.value = mode;
  }
  getMode() { return this._app.editor.mode; }

  // Debug / history inspection
  showHistoryStep(index) {
    const viewport = this._app.viewport;
    if (viewport) viewport._showHistoryStep(index);
  }
  screenshotHistoryStep(index) {
    this.showHistoryStep(index);
    return this.screenshot();
  }
  showFinalResult() {
    const viewport = this._app.viewport;
    if (viewport) viewport._showFinalResult();
  }
  debugHistory() {
    return this.getHistorySteps().map((s, i) =>
      `${i}: ${s.fnName} (line ${s.lineNumber}, ${s.shapeCount} shapes)`
    ).join('\n');
  }

  // Export formats
  getSTEP() { return this._app.messageBus.request("saveShapeSTEP"); }
  getSTL() {
    const viewport = this._app.viewport;
    if (!viewport || !viewport.mainObject) return '';
    return new STLExporter().parse(viewport.mainObject);
  }
  getOBJ() {
    const viewport = this._app.viewport;
    if (!viewport || !viewport.mainObject) return '';
    return new OBJExporter().parse(viewport.mainObject);
  }
}

export { CascadeAPI };
