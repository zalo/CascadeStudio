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
    // Update existing meta tag or create one for agent discovery
    let meta = document.querySelector('meta[name="cascade-api"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'cascade-api';
      document.head.appendChild(meta);
    }
    meta.content = 'window.CascadeAPI';
  }

  // --- Code Management ---

  /** Set the editor code. */
  setCode(code) {
    this._app.editor.setCode(code);
  }

  /** Get the current editor code. */
  getCode() {
    return this._app.editor.getCode();
  }

  /** Evaluate the current code and return a Promise that resolves when generation is complete. */
  evaluate() {
    if (this._evaluatePromise) { return this._evaluatePromise; }
    this._evaluatePromise = new Promise((resolve) => {
      // Wrap the existing handler to detect completion
      const originalHandler = this._app.messageBus.handlers["combineAndRenderShapes"];
      this._app.messageBus.on("combineAndRenderShapes", (payload) => {
        // Restore original handler first
        if (originalHandler) {
          this._app.messageBus.on("combineAndRenderShapes", originalHandler);
        } else {
          this._app.messageBus.off("combineAndRenderShapes");
        }
        // Call original handler
        if (originalHandler) originalHandler(payload);
        this._evaluatePromise = null;
        resolve();
      });
      this._app.editor.evaluateCode(false);
      // If evaluateCode returned without sending to worker (e.g. transpile error),
      // workerWorking will be false — resolve immediately to avoid hanging
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

  // --- Results ---

  /** Get console logs since last evaluation. */
  getConsoleLog() {
    return this._app.console.getLogs();
  }

  /** Get errors since last evaluation. */
  getErrors() {
    return this._app.console.getErrors();
  }

  /** Get the current model as STEP format string. Returns a Promise. */
  getSTEP() {
    return this._app.messageBus.request("saveShapeSTEP");
  }

  /** Get the current model as STL format string. Synchronous. */
  getSTL() {
    const viewport = this._app.viewport;
    if (!viewport || !viewport.mainObject) return '';
    const exporter = new STLExporter();
    return exporter.parse(viewport.mainObject);
  }

  /** Get the current model as OBJ format string. Synchronous. */
  getOBJ() {
    const viewport = this._app.viewport;
    if (!viewport || !viewport.mainObject) return '';
    const exporter = new OBJExporter();
    return exporter.parse(viewport.mainObject);
  }

  /** Take a screenshot of the viewport as a base64 PNG data URL. */
  screenshot() {
    const viewport = this._app.viewport;
    if (!viewport) return '';
    // Force render
    viewport.environment.renderer.render(viewport.environment.scene, viewport.environment.camera);
    return viewport.environment.curCanvas.toDataURL('image/png');
  }

  // --- State ---

  /** Returns true if the worker has finished initialization. */
  isReady() {
    return this._app.startup !== null;
  }

  /** Returns true if the worker is currently evaluating code. */
  isWorking() {
    return window.workerWorking;
  }

  /** Set the editor mode: 'cascadestudio' or 'openscad'. */
  setMode(mode) {
    this._app.editor.setMode(mode);
    const modeSelect = document.getElementById('editorMode');
    if (modeSelect) modeSelect.value = mode;
  }

  /** Get the current editor mode. */
  getMode() {
    return this._app.editor.mode;
  }

  // --- Self-Documentation ---

  /** Get structured capabilities description for agent consumption. */
  getCapabilities() {
    return {
      version: '1.0',
      modes: ['cascadestudio', 'openscad'],
      currentMode: this.getMode(),
      isReady: this.isReady(),
      isWorking: this.isWorking(),
      api: {
        code: {
          setCode: { params: ['code: string'], description: 'Set editor code' },
          getCode: { params: [], returns: 'string', description: 'Get editor code' },
          evaluate: { params: [], returns: 'Promise<void>', description: 'Evaluate code, resolves when rendering completes' },
        },
        results: {
          getConsoleLog: { params: [], returns: 'string[]', description: 'Get console logs since last eval' },
          getErrors: { params: [], returns: 'string[]', description: 'Get errors since last eval' },
          getSTEP: { params: [], returns: 'Promise<string>', description: 'Export model as STEP' },
          getSTL: { params: [], returns: 'string', description: 'Export model as STL' },
          getOBJ: { params: [], returns: 'string', description: 'Export model as OBJ' },
          screenshot: { params: [], returns: 'string', description: 'Viewport screenshot as base64 PNG data URL' },
        },
        state: {
          isReady: { params: [], returns: 'boolean', description: 'Worker initialized' },
          isWorking: { params: [], returns: 'boolean', description: 'Worker evaluating' },
          setMode: { params: ['mode: string'], description: 'Set editor mode (cascadestudio/openscad)' },
          getMode: { params: [], returns: 'string', description: 'Get current mode' },
        },
      },
      cadFunctions: {
        primitives: {
          'Box(x, y, z, centered?)': 'Create a box',
          'Sphere(radius)': 'Create a sphere',
          'Cylinder(radius, height, centered?)': 'Create a cylinder',
          'Cone(r1, r2, height)': 'Create a cone',
          'Polygon(points, wire?)': 'Create a polygon face or wire',
          'Circle(radius, wire?)': 'Create a circle face or wire',
          'BSpline(points, closed?)': 'Create a BSpline curve',
          'Text3D(text, size, height, fontName?)': 'Create extruded 3D text',
          'Wedge(dx, dy, dz, ltx)': 'Create a wedge (tapered box)',
          'Sketch(startingPoint)': 'Start a 2D sketch chain (.LineTo().ArcTo().End().Face())',
        },
        transforms: {
          'Translate(offset, shape, keepOriginal?)': 'Translate a shape',
          'Rotate(axis, degrees, shape, keepOriginal?)': 'Rotate a shape around axis',
          'Scale(factor, shape, keepOriginal?)': 'Scale a shape',
          'Mirror(vector, shape, keepOriginal?)': 'Mirror a shape across plane',
          'Transform(translation, rotation, scale, shape)': 'Full transform (used by gizmos)',
        },
        booleans: {
          'Union(shapes, keepObjects?, fuzz?, keepEdges?)': 'Boolean union of shapes',
          'Difference(mainBody, tools, keepObjects?, fuzz?, keepEdges?)': 'Boolean subtraction',
          'Intersection(shapes, keepObjects?, fuzz?, keepEdges?)': 'Boolean intersection',
        },
        operations: {
          'Extrude(face, direction, keepFace?)': 'Extrude a face along a direction vector',
          'Revolve(shape, degrees, direction?, keepShape?)': 'Revolve a shape around an axis',
          'RotatedExtrude(wire, height, rotation, keepWire?)': 'Helical extrusion',
          'Loft(wires, keepWires?)': 'Loft through wire profiles',
          'Pipe(shape, wirePath, keepInputs?)': 'Sweep a shape along a path',
          'Offset(shape, distance, tolerance?, keepShape?)': 'Offset/shell a shape',
          'FilletEdges(shape, radius, edgeList, keepOriginal?)': 'Fillet edges',
          'ChamferEdges(shape, distance, edgeList, keepOriginal?)': 'Chamfer edges',
          'Section(shape, planeOrigin?, planeNormal?)': 'Cross-section at plane',
          'RemoveInternalEdges(shape, keepShape?)': 'Remove internal edges',
        },
        iteration: {
          'ForEachSolid(shape, callback)': 'Iterate solids in compound',
          'ForEachFace(shape, callback)': 'Iterate faces',
          'ForEachEdge(shape, callback)': 'Iterate edges',
          'ForEachWire(shape, callback)': 'Iterate wires',
          'ForEachVertex(shape, callback)': 'Iterate vertices',
        },
        gui: {
          'Slider(name, default, min, max, realTime?, step?, precision?)': 'Add a slider control',
          'Checkbox(name, default?)': 'Add a checkbox control',
          'TextInput(name, default?, realTime?)': 'Add a text input control',
          'Dropdown(name, default?, options?, realTime?)': 'Add a dropdown control',
          'Button(name)': 'Add a button',
        },
        selectors: {
          'Edges(shape)': 'Create an EdgeSelector for chaining — .ofType(), .parallel(), .max(), .min(), .indices()',
          'Faces(shape)': 'Create a FaceSelector for chaining — .ofType(), .parallel(), .max(), .min(), .indices()',
          'EdgeSelector.ofType(type)': 'Filter edges by curve type: "Line", "Circle", "BSpline", etc.',
          'EdgeSelector.parallel(axis)': 'Filter edges parallel to axis vector',
          'EdgeSelector.perpendicular(axis)': 'Filter edges perpendicular to axis vector',
          'EdgeSelector.max(axis)': 'Select edges at highest position along axis',
          'EdgeSelector.min(axis)': 'Select edges at lowest position along axis',
          'EdgeSelector.indices()': 'Return edge indices for FilletEdges/ChamferEdges',
          'FaceSelector.ofType(type)': 'Filter faces by surface type: "Plane", "Cylinder", etc.',
          'FaceSelector.max(axis)': 'Select face(s) at highest position along axis',
          'FaceSelector.min(axis)': 'Select face(s) at lowest position along axis',
        },
        measurement: {
          'Volume(shape)': 'Solid volume',
          'SurfaceArea(shape)': 'Total surface area',
          'CenterOfMass(shape)': 'Center of mass as [x,y,z]',
          'EdgeLength(shape)': 'Total edge length',
        },
        utility: {
          'Remove(array, item)': 'Remove item from sceneShapes array',
          'GetWire(shape, index, keepOriginal?)': 'Get a wire by index from a shape',
          'GetSolidFromCompound(shape, index, keepOriginal?)': 'Get solid by index',
          'GetNumSolidsInCompound(shape)': 'Count solids in compound',
          'SaveFile(filename, fileURL)': 'Trigger file download',
        },
      },
    };
  }

  /** Get example code for both modes. */
  getExamples() {
    return {
      cascadestudio: {
        description: 'CascadeStudio JavaScript mode — call CAD functions directly',
        basic: `// Primitives
let box = Box(10, 20, 30);
let sphere = Sphere(50);
let cyl = Cylinder(10, 40, true);
let cone = Cone(20, 5, 30);`,
        transforms: `// Transforms
let box = Box(10, 10, 10);
Translate([20, 0, 0], box);
Rotate([0, 0, 1], 45, Box(10, 10, 10));
Mirror([1, 0, 0], Box(10, 10, 10));
Scale(2, Sphere(10));`,
        booleans: `// Booleans
let sphere = Sphere(50);
let cylX = Rotate([1, 0, 0], 90, Cylinder(30, 200, true));
let cylY = Rotate([0, 1, 0], 90, Cylinder(30, 200, true));
let cylZ = Cylinder(30, 200, true);
Difference(sphere, [cylX, cylY, cylZ]);`,
        extrusions: `// Extrusions
let face = Polygon([[0,0],[100,0],[100,50],[50,100],[0,100]]);
Extrude(face, [0, 0, 20]);

let circle = Circle(30);
Revolve(circle, 360, [0, 1, 0]);`,
        sketch: `// Sketch API
let sketch = new Sketch([0, 0])
  .LineTo([100, 0])
  .Fillet(20)
  .LineTo([100, 100])
  .End(true)
  .Face();
Extrude(sketch, [0, 0, 20]);`,
        gui: `// GUI Controls
let radius = Slider("Radius", 20, 5, 50);
let height = Slider("Height", 40, 10, 100);
let centered = Checkbox("Centered", true);
Cylinder(radius, height, centered);`,
      },
      openscad: {
        description: 'OpenSCAD mode — use standard OpenSCAD syntax',
        basic: `// Primitives
cube(10);
sphere(r=20);
cylinder(h=30, r=10);`,
        transforms: `// Transforms
translate([20, 0, 0]) cube(10);
rotate([0, 0, 45]) cube(10);
mirror([1, 0, 0]) sphere(15);`,
        booleans: `// Booleans
difference() {
  cube(20, center=true);
  sphere(13);
}`,
        modules: `// Custom modules
module rounded_box(size, r) {
  minkowski() {
    cube(size - 2*r, center=true);
    sphere(r);
  }
}
rounded_box(30, 5);`,
        loops: `// For loops
for (i = [0:4]) {
  translate([i * 15, 0, 0])
    sphere(5);
}`,
      },
    };
  }
}

export { CascadeAPI };
