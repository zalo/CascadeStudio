// ToolManager - LeapShape-style GUI modeling tools for the 3D viewport.
// Every GUI operation emits JavaScript code into the Monaco editor;
// the code IS the scene.
import * as THREE from 'three';
import { SelectTool } from './SelectTool.js';
import { BoxTool } from './BoxTool.js';
import { CylinderTool } from './CylinderTool.js';
import { SphereTool } from './SphereTool.js';
import { SketchTool } from './SketchTool.js';
import { FilletTool } from './FilletTool.js';

/** Owns the viewport toolbar, routes pointer events to the active tool
 *  (ahead of OrbitControls), and provides shared raycasting / snapping /
 *  code-emission helpers for the tools. */
class ToolManager {
  /** @param {import('../CascadeView.js').CascadeEnvironment} viewport */
  constructor(viewport) {
    this.viewport = viewport;
    this.environment = viewport.environment;

    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Instantiate the tools
    this.tools = {
      select:   new SelectTool(this),
      box:      new BoxTool(this),
      cylinder: new CylinderTool(this),
      sphere:   new SphereTool(this),
      sketch:   new SketchTool(this),
      fillet:   new FilletTool(this),
    };
    this.activeToolName = 'select';

    this._buildToolbar();
    this._buildDimLabel();
    this._bindEvents();
  }

  get activeTool() { return this.tools[this.activeToolName]; }
  get editor() { return this.viewport._app.editor; }
  get scene() { return this.environment.scene; }

  /** Current editor language mode ('cascadestudio' | 'openscad' | 'python').
   *  Tools dispatch on this when emitting code. */
  get codeLanguage() { return this.editor.mode; }
  get isPythonMode() { return this.codeLanguage === 'python'; }

  /** Activate a tool by name; the previous tool's interaction is cancelled. */
  activate(name) {
    if (!this.tools[name] || name === this.activeToolName) return;
    if (name === 'sketch' && this.isPythonMode) {
      console.error('The Sketch tool is not available in Python mode yet — ' +
        'switch the editor to CascadeStudio JS mode to sketch profiles.');
      return;
    }
    this.activeTool.deactivate();
    this.activeToolName = name;
    this.activeTool.activate();

    // Update toolbar highlight + viewport cursor
    for (let btn of this._toolbarEl.children) {
      btn.classList.toggle('cs-tool-active', btn.dataset.tool === name);
    }
    const canvas = this.environment.renderer.domElement;
    canvas.style.cursor = (name === 'select') ? '' : 'crosshair';
    this.environment.viewDirty = true;
  }

  /** Notify the active tool that the scene meshes were rebuilt
   *  (its cached edge/shape selection is no longer valid). */
  onSceneRebuilt() {
    if (this.activeTool.onSceneRebuilt) { this.activeTool.onSceneRebuilt(); }
  }

  /** Called by EditorManager.setMode when the language mode changes.
   *  The Sketch tool emits JS-only Sketch chains, so it is disabled in
   *  Python mode (grayed out with an explanatory tooltip). */
  onLanguageChanged() {
    const sketchBtn = [...this._toolbarEl.children]
      .find((btn) => btn.dataset.tool === 'sketch');
    if (sketchBtn) {
      const disabled = this.isPythonMode;
      sketchBtn.classList.toggle('cs-tool-disabled', disabled);
      if (!sketchBtn.dataset.defaultTitle) { sketchBtn.dataset.defaultTitle = sketchBtn.title; }
      sketchBtn.title = disabled
        ? 'Sketch — not available in Python mode yet (switch to CascadeStudio JS mode)'
        : sketchBtn.dataset.defaultTitle;
    }
    if (this.isPythonMode && this.activeToolName === 'sketch') {
      this.activate('select');
    }
  }

  // ===== Coordinate helpers (three.js scene is Y-up, CAD code is Z-up) =====

  /** CAD [x, y, z] → three.js world Vector3. */
  cadToThree(p) { return new THREE.Vector3(p[0], p[2], -p[1]); }

  /** three.js world Vector3 → CAD [x, y, z]. */
  threeToCad(v) { return [v.x, -v.z, v.y]; }

  /** Snap a CAD coordinate value to the integer mm grid. */
  snap(value) { return Math.round(value); }

  /** three.js ground-plane point → snapped CAD [x, y, 0]. */
  snapGroundToCad(v) {
    const p = this.threeToCad(v);
    return [this.snap(p[0]), this.snap(p[1]), 0];
  }

  // ===== Raycast helpers =====

  /** Set up the shared raycaster from a pointer event; returns it. */
  pointerRay(event) {
    const canvas = this.environment.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, this.environment.camera);
    return this._raycaster;
  }

  /** Raycast the pointer against the ground plane (three-space y=0).
   *  Returns a THREE.Vector3 world point or null. */
  raycastGround(event) {
    const ray = this.pointerRay(event).ray;
    const target = new THREE.Vector3();
    return ray.intersectPlane(this._groundPlane, target) ? target : null;
  }

  /** Raycast the pointer against the current model. Returns the nearest
   *  intersection or null. */
  raycastScene(event) {
    if (!this.viewport.mainObject) return null;
    const raycaster = this.pointerRay(event);
    const hits = raycaster.intersectObjects(this.viewport.mainObject.children);
    return hits.length > 0 ? hits[0] : null;
  }

  /** Raycast preferring model edges (LineSegments) near the nearest hit.
   *  Returns a LineSegments intersection or null. */
  raycastEdge(event) {
    if (!this.viewport.mainObject) return null;
    const raycaster = this.pointerRay(event);
    const oldThreshold = raycaster.params.Line.threshold;
    raycaster.params.Line.threshold = 2;
    const hits = raycaster.intersectObjects(this.viewport.mainObject.children);
    raycaster.params.Line.threshold = oldThreshold;
    if (hits.length === 0) return null;
    for (let hit of hits) {
      if (hit.object.type === 'LineSegments' && hit.distance <= hits[0].distance + 2) {
        return hit;
      }
    }
    return null;
  }

  /** Compute the height of the pointer along the vertical (three-space Y)
   *  axis through `baseThree`, snapped to the CAD grid. Mirrors LeapShape's
   *  segment-distance approach for the height-drag phase. */
  heightFromRay(event, baseThree) {
    const ray = this.pointerRay(event).ray;
    const upper = baseThree.clone(); upper.y =  10000;
    const lower = baseThree.clone(); lower.y = -10000;
    const closest = new THREE.Vector3();
    ray.distanceSqToSegment(lower, upper, null, closest);
    return this.snap(closest.y - baseThree.y);
  }

  // ===== OrbitControls coordination =====

  /** Disable camera controls for the duration of a tool interaction. */
  beginInteraction() { this.environment.controls.enabled = false; }

  /** Re-enable camera controls when the interaction commits or cancels. */
  endInteraction() { this.environment.controls.enabled = true; }

  // ===== Preview helpers =====

  /** Semi-transparent material for live tool previews. */
  createPreviewMaterial() {
    return new THREE.MeshBasicMaterial({
      color: 0x4CAF50, transparent: true, opacity: 0.4,
      depthWrite: false, side: THREE.DoubleSide
    });
  }

  /** Add a preview object to the scene and mark the view dirty. */
  addPreview(obj) { this.scene.add(obj); this.environment.viewDirty = true; }

  /** Remove a preview object from the scene and mark the view dirty. */
  removePreview(obj) {
    if (obj) { this.scene.remove(obj); }
    this.environment.viewDirty = true;
  }

  // ===== Code emission =====

  /** Collect identifiers already declared/assigned in the editor code. */
  usedVarNames() {
    const code = this.editor.getCode();
    const names = new Set();
    const declRe = /\b(?:let|var|const|function)\s+([A-Za-z_$][\w$]*)/g;
    const assignRe = /(?:^|[\n;{])\s*([A-Za-z_$][\w$]*)\s*=[^=]/g;
    let m;
    while ((m = declRe.exec(code)) !== null) { names.add(m[1]); }
    while ((m = assignRe.exec(code)) !== null) { names.add(m[1]); }
    return names;
  }

  /** Generate a fresh variable name: fnName lowercased + counter. */
  nextVarName(base, extraUsed) {
    const names = this.usedVarNames();
    if (extraUsed) { extraUsed.forEach((n) => names.add(n)); }
    let i = 1;
    while (names.has(base + i)) { i++; }
    return base + i;
  }

  /** Append an emitted snippet to the editor and re-evaluate the code.
   *  If the worker is busy, evaluation is deferred until it frees up. */
  commitCode(snippet) {
    const editor = this.editor;
    editor.insertCode(snippet);
    this.evaluateSoon();
  }

  /** Evaluate the editor code now, or as soon as the worker is free. */
  evaluateSoon() {
    const app = this.viewport._app;
    if (window.workerWorking) {
      const handler = () => {
        app.engine.off('resetWorking', handler);
        setTimeout(() => app.editor.evaluateCode(false), 0);
      };
      app.engine.on('resetWorking', handler);
    } else {
      app.editor.evaluateCode(false);
    }
  }

  // ===== Dimension label (follows the pointer during drags) =====

  _buildDimLabel() {
    this._dimLabel = document.createElement('div');
    this._dimLabel.className = 'cs-tool-label';
    this._dimLabel.style.display = 'none';
    this.viewport.goldenContainer.element.appendChild(this._dimLabel);
  }

  /** Show the floating dimension label near the pointer. */
  showLabel(event, text) {
    const rect = this.viewport.goldenContainer.element.getBoundingClientRect();
    this._dimLabel.textContent = text;
    this._dimLabel.style.left = (event.clientX - rect.left + 14) + 'px';
    this._dimLabel.style.top = (event.clientY - rect.top + 14) + 'px';
    this._dimLabel.style.display = '';
  }

  /** Hide the floating dimension label. */
  hideLabel() { this._dimLabel.style.display = 'none'; }

  // ===== Toolbar + event wiring =====

  /** Create the vertical toolbar overlay in the viewport panel. */
  _buildToolbar() {
    this._toolbarEl = document.createElement('div');
    this._toolbarEl.className = 'cs-toolbar';

    const buttons = [
      { tool: 'select',   icon: '↖', label: 'Select (Esc) — click a shape to reveal its code line' },
      { tool: 'box',      icon: '□', label: 'Box — drag footprint on the ground, then drag height, click to commit' },
      { tool: 'cylinder', icon: '▭', label: 'Cylinder — click center, drag radius, then drag height, click to commit' },
      { tool: 'sphere',   icon: '○', label: 'Sphere — click center, drag radius, release to commit' },
      { tool: 'sketch',   icon: '✎', label: 'Sketch — click to place vertices, click the first vertex (or Enter) to close, then Extrude/Revolve; Escape removes the last vertex' },
      { tool: 'fillet',   icon: '◠', label: 'Fillet — click edges to select, set radius, Enter to commit' },
    ];
    for (let { tool, icon, label } of buttons) {
      const btn = document.createElement('button');
      btn.className = 'cs-tool-btn' + (tool === 'select' ? ' cs-tool-active' : '');
      btn.dataset.tool = tool;
      btn.title = label;
      btn.textContent = icon;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activate(tool);
      });
      this._toolbarEl.appendChild(btn);
    }
    this.viewport.goldenContainer.element.appendChild(this._toolbarEl);
  }

  /** Route pointer events to the active tool BEFORE OrbitControls sees them.
   *  Uses capture-phase listeners on the panel element (an ancestor of the
   *  renderer canvas), so a consuming tool can stopPropagation() and the
   *  canvas-level OrbitControls listeners never fire. */
  _bindEvents() {
    const el = this.viewport.goldenContainer.element;
    const canvas = this.environment.renderer.domElement;

    this._onPointerDown = (e) => {
      if (!this.viewport.active || this._isUIEvent(e)) return;
      // Only begin new interactions on the canvas itself
      if (e.target !== canvas && !this.activeTool.isInteracting()) return;
      if (this.activeTool.onPointerDown(e)) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    this._onPointerMove = (e) => {
      if (!this.viewport.active) return;
      if (this._isUIEvent(e) && !this.activeTool.isInteracting()) return;
      if (this.activeTool.onPointerMove(e)) {
        e.stopPropagation();
      }
    };
    this._onPointerUp = (e) => {
      if (!this.viewport.active) return;
      if (this.activeTool.onPointerUp(e)) {
        e.stopPropagation();
      }
    };
    this._onKeyDown = (e) => {
      if (!this.viewport.active) return;
      const ae = document.activeElement;
      if (ae && ae.closest && ae.closest('.monaco-editor')) return;
      if (e.code === 'Escape') {
        // Tools may consume Escape for stage-level undo (e.g. Sketch vertex
        // removal); unconsumed Escape returns to the Select tool.
        if (!this.activeTool.onEscape() && this.activeToolName !== 'select') {
          this.activate('select');
        }
      } else if (!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'))) {
        if (this.activeTool.onKeyDown(e)) { e.preventDefault(); }
      }
    };

    el.addEventListener('pointerdown', this._onPointerDown, true);
    el.addEventListener('pointermove', this._onPointerMove, true);
    window.addEventListener('pointerup', this._onPointerUp, true);
    window.addEventListener('keydown', this._onKeyDown);
  }

  /** True if the event targets a UI overlay (toolbar, panels, GUI, timeline). */
  _isUIEvent(e) {
    return !!(e.target && e.target.closest &&
      e.target.closest('.cs-toolbar, .cs-fillet-panel, .cs-sketch-panel, .cs-timeline, .gui-panel'));
  }
}

export { ToolManager };
