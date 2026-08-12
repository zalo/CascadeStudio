// SketchTool - stateful multi-click polyline/arc sketching (Fusion/SolidWorks-
// style sketch → extrude workflow). Emits `new Sketch(...).LineTo(...)
// .ArcTo(...).End(true).Face()` plus an optional Extrude/Revolve against the
// StandardLibrary Sketch builder.
import * as THREE from 'three';
import { Tool } from './Tool.js';

const IDLE = 0, DRAWING = 1, CLOSED = 2, HEIGHT_DRAG = 3;

/** Sketch tool state machine:
 *  1. clicks on the sketch plane place vertices (1 mm grid snap); a
 *     rubber-band previews the pending segment (length + angle label);
 *     the Line/Arc toggle (or the L / A keys) selects the segment type —
 *     in Arc mode each segment takes two clicks (through-point, then end)
 *     and the rubber-band renders the live three-point circular arc;
 *     Escape removes the last vertex (a half-placed arc through-point is
 *     its own undo step); Enter or clicking the first vertex closes the
 *     profile (min 3 vertices) — closing works from Arc mode too
 *  2. once closed, the inline panel offers Extrude / Revolve / Face only
 *     with a numeric value; for Extrude, dragging vertically inside the
 *     profile sets the height interactively (the input reflects the drag);
 *     clicking corner vertices toggles them into a sketch-fillet set
 *     (vertex 0, the Sketch start point, cannot be filleted — CLAUDE.md
 *     pitfall 5; arc-junction vertices are allowed, verified against ChFi2d)
 *  3. Apply emits e.g.:
 *       let profile1 = new Sketch([20, 10])
 *         .LineTo([60, 10]).ArcTo([70, 25], [60, 40]).LineTo([20, 40])
 *         .End(true).Face();
 *       let part1 = Extrude(profile1, [0, 0, 25]);
 *
 *  The sketch plane is a parameter (CAD origin + u/v basis) so that
 *  sketch-on-face support can be added later; v1 always uses the ground
 *  plane (XY at z=0), which maps 1:1 onto the default `new Sketch([u, v])`
 *  plane in the emitted code. */
class SketchTool extends Tool {
  constructor(manager) {
    super(manager, 'sketch');
    this.state = IDLE;

    // Sketch plane (CAD space): origin + orthonormal u/v basis.
    // v1: ground plane. A future sketch-on-face feature swaps this out
    // (emission would then need a Transform/plane argument as well).
    this.plane = {
      origin: [0, 0, 0],
      uDir:   [1, 0, 0],
      vDir:   [0, 1, 0],
      nDir:   [0, 0, 1],
    };

    this.vertices = [];           // snapped [u, v] anchor points
    // segments[j] connects vertices[j] → vertices[j+1]:
    //   { type: 'line' } | { type: 'arc', through: [u, v] }
    this.segments = [];
    this.closingSegment = null;   // null = implicit line close via End(true)
    this.segMode = 'line';        // 'line' | 'arc' (L / A keys)
    this.filletVerts = new Set(); // vertex indices (>= 1) to .Fillet()
    this.height = 0;              // extrude height (CAD, may be negative)

    this._pendingThrough = null;  // arc through-point awaiting its end click
    this._downPos = null;
    this._group = null;           // THREE.Group (rotation maps CAD Z-up → three Y-up)
    this._loopLine = null;
    this._rubberLine = null;
    this._markers = [];
    this._extrudePreview = null;
    this._panel = null;
  }

  isInteracting() { return this.state !== IDLE; }

  activate() {
    if (!this._panel) { this._buildPanel(); }
    this._panel.style.display = '';
    this._updatePanelStage();
  }

  deactivate() {
    this.cancel();
    if (this._panel) { this._panel.style.display = 'none'; }
  }

  cancel() {
    this.manager.removePreview(this._group);
    this._group = null;
    this._loopLine = null;
    this._rubberLine = null;
    this._markers = [];
    this._extrudePreview = null;
    this.vertices = [];
    this.segments = [];
    this.closingSegment = null;
    this.filletVerts.clear();
    this._pendingThrough = null;
    this.height = 0;
    this.segMode = 'line'; // each new profile starts in Line mode
    if (this.state === HEIGHT_DRAG) { this.manager.endInteraction(); }
    this.state = IDLE;
    this.manager.hideLabel();
    this._updatePanelStage();
  }

  /** Escape: half-placed arc → drop the through-point; then vertex-level
   *  undo while drawing; otherwise cancel the whole sketch. */
  onEscape() {
    if (this.state === DRAWING && this._pendingThrough) {
      this._pendingThrough = null;
      this._rebuildVisuals();
      return true;
    }
    if (this.state === DRAWING && this.vertices.length >= 2) {
      this.vertices.pop();
      this.segments.pop();
      this._rebuildVisuals();
      return true;
    }
    if (this.state !== IDLE) {
      this.cancel();
      return true;
    }
    return false;
  }

  /** Enter closes the profile; L / A switch the segment type. */
  onKeyDown(event) {
    if (event.code === 'Enter' && this.state === DRAWING && this.vertices.length >= 3) {
      this._pendingThrough = null;
      this._closeProfile(null);
      return true;
    }
    if ((event.code === 'KeyL' || event.code === 'KeyA') &&
        (this.state === IDLE || this.state === DRAWING)) {
      this.setSegMode(event.code === 'KeyA' ? 'arc' : 'line');
      return true;
    }
    return false;
  }

  /** Switch between Line and Arc segment placement. */
  setSegMode(mode) {
    if (mode !== 'line' && mode !== 'arc') return;
    this.segMode = mode;
    this._pendingThrough = null;
    this._updatePanelStage();
    if (this._group) { this._rebuildVisuals(); }
  }

  onPointerDown(event) {
    if (event.button !== 0) return false;
    this._downPos = { x: event.clientX, y: event.clientY };

    // In the closed state, dragging inside the profile sets the extrude
    // height interactively (consumes the event so OrbitControls stays out)
    if (this.state === CLOSED && this._panel && this._opSelect.value === 'extrude') {
      if (this._vertexIndexAtScreen(event) < 0) {
        const uv = this._hitUV(event, false);
        if (uv && this._pointInPolygon(uv[0], uv[1])) {
          this.manager.beginInteraction();
          this.state = HEIGHT_DRAG;
          return true;
        }
      }
    }
    return false; // clicks are detected on pointerup; orbiting stays live
  }

  onPointerMove(event) {
    if (this.state === DRAWING) {
      this._updateRubberBand(event);
      return false; // don't consume — orbit drags still work mid-sketch
    }
    if (this.state === HEIGHT_DRAG) {
      const base = this._uvToThree(...this._centroidUV());
      this.height = this.manager.heightFromRay(event, base);
      this._valueInput.value = this.height;
      this._updateExtrudePreview();
      this.manager.showLabel(event, 'h = ' + this.height);
      return true;
    }
    return false;
  }

  onPointerUp(event) {
    if (this.state === HEIGHT_DRAG) {
      this.manager.endInteraction();
      this.state = CLOSED;
      this.manager.hideLabel();
      return true;
    }

    if (event.button !== 0 || !this._downPos) return false;
    const moved = Math.hypot(
      event.clientX - this._downPos.x,
      event.clientY - this._downPos.y
    );
    this._downPos = null;
    if (moved > 5) return false;

    if (this.state === IDLE || this.state === DRAWING) {
      return this._handleDrawClick(event);
    }
    if (this.state === CLOSED) {
      return this._handleClosedClick(event);
    }
    return false;
  }

  // ===== Drawing phase =====

  /** Place a vertex / arc through-point, or close the profile when the
   *  first vertex is clicked (works from Arc mode: the final segment is
   *  then an arc whose end snaps onto vertex 0). */
  _handleDrawClick(event) {
    const uv = this._hitUV(event, true);
    if (!uv) return false;

    if (this.state === IDLE) {
      this.vertices = [uv];
      this.segments = [];
      this.closingSegment = null;
      this.filletVerts.clear();
      this._pendingThrough = null;
      this.height = 0;
      this._createGroup();
      this._rebuildVisuals();
      this.state = DRAWING;
      return true;
    }

    // Arc mode, first of the two clicks: place the through-point
    if (this.segMode === 'arc' && !this._pendingThrough) {
      this._pendingThrough = uv;
      this._rebuildVisuals();
      return true;
    }

    // Close if clicking on (or within snap distance of) the first vertex
    const rawUV = this._hitUV(event, false);
    const d0 = Math.hypot(rawUV[0] - this.vertices[0][0], rawUV[1] - this.vertices[0][1]);
    const closing = this.vertices.length >= 3 && (d0 <= 1.5 ||
      (uv[0] === this.vertices[0][0] && uv[1] === this.vertices[0][1]));

    if (this.segMode === 'arc' && this._pendingThrough) {
      const through = this._pendingThrough;
      this._pendingThrough = null;
      if (closing) {
        this._closeProfile({ type: 'arc', through });
      } else {
        const last = this.vertices[this.vertices.length - 1];
        if (uv[0] === last[0] && uv[1] === last[1]) return true; // degenerate
        this.vertices.push(uv);
        this.segments.push({ type: 'arc', through });
        this._rebuildVisuals();
      }
      return true;
    }

    if (closing) {
      this._closeProfile(null);
      return true;
    }

    // Ignore duplicate consecutive vertices
    const last = this.vertices[this.vertices.length - 1];
    if (uv[0] === last[0] && uv[1] === last[1]) return true;

    this.vertices.push(uv);
    this.segments.push({ type: 'line' });
    this._rebuildVisuals();
    return true;
  }

  /** @param {?{type: string, through: number[]}} closingSegment
   *  null closes with an implicit straight line (via `.End(true)`). */
  _closeProfile(closingSegment) {
    this.closingSegment = closingSegment;
    this.state = CLOSED;
    this.manager.hideLabel();
    this._rebuildVisuals();
    this._showCommitStage();
  }

  // ===== Closed phase =====

  /** Toggle a corner vertex into the sketch-fillet set. */
  _handleClosedClick(event) {
    const idx = this._vertexIndexAtScreen(event);
    if (idx < 0) return false;
    if (idx === 0) {
      console.log("The sketch start point can't be filleted — pick another corner.");
      return true;
    }
    if (this.filletVerts.has(idx)) {
      this.filletVerts.delete(idx);
    } else {
      this.filletVerts.add(idx);
    }
    this._rebuildVisuals();
    return true;
  }

  /** Emit the profile (+ operation) and re-evaluate. */
  commit() {
    if (this.state !== CLOSED || this.vertices.length < 3) return;
    const op = this._opSelect.value;
    let value = parseFloat(this._valueInput.value);
    if (op === 'extrude' && (!value || isNaN(value))) {
      console.error('Extrude height must be a non-zero number (drag inside the profile or type a value).');
      return;
    }
    if (op === 'revolve' && (isNaN(value) || value === 0)) { value = 360; }
    const filletR = parseFloat(this._filletInput.value);

    const snippet = this._buildSnippet(op, value, filletR);
    this.cancel(); // clears previews, resets to the drawing-ready state
    this.manager.commitCode(snippet);
  }

  /** Build the emitted code against the StandardLibrary Sketch builder. */
  _buildSnippet(op, value, filletR) {
    const mgr = this.manager;
    const profileName = mgr.nextVarName('profile');
    const v = this.vertices;

    // Chained segment calls: .LineTo([x, y]) / .ArcTo([tx, ty], [x, y])
    // with optional .Fillet(r) on selected corner vertices
    const calls = [];
    for (let i = 1; i < v.length; i++) {
      const seg = this.segments[i - 1];
      let call = (seg && seg.type === 'arc')
        ? '.ArcTo([' + seg.through[0] + ', ' + seg.through[1] + '], [' + v[i][0] + ', ' + v[i][1] + '])'
        : '.LineTo([' + v[i][0] + ', ' + v[i][1] + '])';
      if (this.filletVerts.has(i) && filletR > 0) {
        call += '.Fillet(' + filletR + ')';
      }
      calls.push(call);
    }
    if (this.closingSegment && this.closingSegment.type === 'arc') {
      const t = this.closingSegment.through;
      calls.push('.ArcTo([' + t[0] + ', ' + t[1] + '], [' + v[0][0] + ', ' + v[0][1] + '])');
    }

    // ~3 segment calls per line for readability
    const lines = ['let ' + profileName + ' = new Sketch([' + v[0][0] + ', ' + v[0][1] + '])'];
    for (let i = 0; i < calls.length; i += 3) {
      lines.push('  ' + calls.slice(i, i + 3).join(''));
    }
    lines.push('  .End(true).Face();');
    let snippet = lines.join('\n');

    if (op === 'extrude') {
      const partName = mgr.nextVarName('part', new Set([profileName]));
      snippet += '\nlet ' + partName + ' = Extrude(' + profileName + ', [0, 0, ' + value + ']);';
    } else if (op === 'revolve') {
      snippet += '\nRevolve(' + profileName + ', ' + value + ');';
    }
    return snippet;
  }

  // ===== Plane / coordinate helpers =====

  /** Raycast the pointer onto the sketch plane; returns [u, v] (snapped
   *  to the mm grid when `snapped`) or null. */
  _hitUV(event, snapped) {
    const p = this.plane;
    const normalThree = this.manager.cadToThree(p.nDir).normalize();
    const originThree = this.manager.cadToThree(p.origin);
    const threePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normalThree, originThree);
    const ray = this.manager.pointerRay(event).ray;
    const hit = new THREE.Vector3();
    if (!ray.intersectPlane(threePlane, hit)) return null;

    const cad = this.manager.threeToCad(hit);
    const rel = [cad[0] - p.origin[0], cad[1] - p.origin[1], cad[2] - p.origin[2]];
    let u = rel[0] * p.uDir[0] + rel[1] * p.uDir[1] + rel[2] * p.uDir[2];
    let vv = rel[0] * p.vDir[0] + rel[1] * p.vDir[1] + rel[2] * p.vDir[2];
    if (snapped) { u = this.manager.snap(u); vv = this.manager.snap(vv); }
    return [u, vv];
  }

  /** Sketch [u, v] (+ offset `w` along the plane normal) → CAD [x, y, z]. */
  _uvToCad(u, v, w = 0) {
    const p = this.plane;
    return [
      p.origin[0] + u * p.uDir[0] + v * p.vDir[0] + w * p.nDir[0],
      p.origin[1] + u * p.uDir[1] + v * p.vDir[1] + w * p.nDir[1],
      p.origin[2] + u * p.uDir[2] + v * p.vDir[2] + w * p.nDir[2],
    ];
  }

  /** Sketch [u, v] → three.js world Vector3. */
  _uvToThree(u, v, w = 0) {
    return this.manager.cadToThree(this._uvToCad(u, v, w));
  }

  /** Sample the circular arc from A through T to B (24 segments).
   *  Returns [u, v] points excluding A, including B. Collinear points
   *  degrade to a straight segment. */
  _sampleArc(A, T, B, count = 24) {
    const d = 2 * (A[0] * (T[1] - B[1]) + T[0] * (B[1] - A[1]) + B[0] * (A[1] - T[1]));
    if (Math.abs(d) < 1e-9) { return [B.slice()]; } // collinear → line
    const a2 = A[0] * A[0] + A[1] * A[1];
    const t2 = T[0] * T[0] + T[1] * T[1];
    const b2 = B[0] * B[0] + B[1] * B[1];
    const cx = (a2 * (T[1] - B[1]) + t2 * (B[1] - A[1]) + b2 * (A[1] - T[1])) / d;
    const cy = (a2 * (B[0] - T[0]) + t2 * (A[0] - B[0]) + b2 * (T[0] - A[0])) / d;
    const r = Math.hypot(A[0] - cx, A[1] - cy);

    const TWO_PI = Math.PI * 2;
    const a0 = Math.atan2(A[1] - cy, A[0] - cx);
    const aT = ((Math.atan2(T[1] - cy, T[0] - cx) - a0) % TWO_PI + TWO_PI) % TWO_PI;
    const aB = ((Math.atan2(B[1] - cy, B[0] - cx) - a0) % TWO_PI + TWO_PI) % TWO_PI;
    // Sweep CCW if the through-point comes before the end going CCW,
    // otherwise sweep CW (negative)
    const sweep = (aT <= aB) ? aB : aB - TWO_PI;

    const pts = [];
    for (let i = 1; i <= count; i++) {
      const ang = a0 + sweep * (i / count);
      pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    pts[pts.length - 1] = B.slice(); // land exactly on B
    return pts;
  }

  /** Sampled outline of the profile in UV space (arcs discretized).
   *  Includes the closing segment when the profile is closed. */
  _outlinePoints() {
    const pts = [this.vertices[0].slice()];
    for (let j = 0; j < this.segments.length; j++) {
      const a = this.vertices[j], b = this.vertices[j + 1];
      const seg = this.segments[j];
      if (seg.type === 'arc') {
        pts.push(...this._sampleArc(a, seg.through, b));
      } else {
        pts.push(b.slice());
      }
    }
    if (this.state === CLOSED || this.state === HEIGHT_DRAG) {
      const last = this.vertices[this.vertices.length - 1];
      if (this.closingSegment && this.closingSegment.type === 'arc') {
        pts.push(...this._sampleArc(last, this.closingSegment.through, this.vertices[0]));
      } else {
        pts.push(this.vertices[0].slice());
      }
    }
    return pts;
  }

  _centroidUV() {
    let cu = 0, cv = 0;
    for (let [u, v] of this.vertices) { cu += u; cv += v; }
    return [cu / this.vertices.length, cv / this.vertices.length];
  }

  /** Ray-casting point-in-polygon test on the sampled outline. */
  _pointInPolygon(u, v) {
    let inside = false;
    const vs = this._outlinePoints();
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const [xi, yi] = vs[i], [xj, yj] = vs[j];
      if (((yi > v) !== (yj > v)) &&
          (u < (xj - xi) * (v - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  /** Index of the vertex whose screen projection is within 12 px, or -1. */
  _vertexIndexAtScreen(event) {
    const env = this.manager.environment;
    const rect = env.renderer.domElement.getBoundingClientRect();
    for (let i = 0; i < this.vertices.length; i++) {
      const world = this._uvToThree(this.vertices[i][0], this.vertices[i][1]);
      const proj = world.project(env.camera);
      const sx = rect.left + (proj.x + 1) / 2 * rect.width;
      const sy = rect.top + (1 - (proj.y + 1) / 2) * rect.height;
      if (Math.hypot(event.clientX - sx, event.clientY - sy) <= 12) return i;
    }
    return -1;
  }

  // ===== Visuals =====

  /** The group's -PI/2 X rotation maps CAD Z-up into the three.js Y-up
   *  scene, so all children use raw CAD coordinates (like mainObject). */
  _createGroup() {
    this._group = new THREE.Group();
    this._group.rotation.x = -Math.PI / 2;
    this.manager.addPreview(this._group);
  }

  /** Convert UV points to slightly normal-offset CAD-space vectors. */
  _uvToLinePoints(uvPts) {
    return uvPts.map(([u, v]) => {
      const c = this._uvToCad(u, v, 0.05);
      return new THREE.Vector3(c[0], c[1], c[2]);
    });
  }

  /** Rebuild the polyline, markers, and previews from current state. */
  _rebuildVisuals() {
    if (!this._group) return;

    // Committed outline (arcs sampled; closed loop once the profile closes)
    if (this._loopLine) { this._group.remove(this._loopLine); }
    const pts = this._uvToLinePoints(this._outlinePoints());
    this._loopLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x4CAF50 })
    );
    this._group.add(this._loopLine);

    // Rubber band (drawing phase only)
    if (this._rubberLine) { this._group.remove(this._rubberLine); this._rubberLine = null; }
    if (this.state === DRAWING || this.state === IDLE) {
      const tail = pts[pts.length - 1].clone();
      this._rubberLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([tail, tail.clone()]),
        new THREE.LineBasicMaterial({ color: 0x88cc88, transparent: true, opacity: 0.7 })
      );
      this._group.add(this._rubberLine);
    }

    // Vertex markers: start = green (unfilletable), fillet-selected =
    // orange, pending arc through-point = blue
    for (let m of this._markers) { this._group.remove(m); }
    this._markers = [];
    const addMarker = (uv, color, radius) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      const c = this._uvToCad(uv[0], uv[1], 0.05);
      marker.position.set(c[0], c[1], c[2]);
      this._group.add(marker);
      this._markers.push(marker);
    };
    for (let i = 0; i < this.vertices.length; i++) {
      const color = (i === 0) ? 0x4CAF50 : (this.filletVerts.has(i) ? 0xff8c1a : 0xbbbbbb);
      addMarker(this.vertices[i], color, i === 0 ? 1.4 : 1.0);
    }
    if (this._pendingThrough) { addMarker(this._pendingThrough, 0x66aaff, 0.8); }

    this._updateExtrudePreview();
    this.manager.environment.viewDirty = true;
  }

  /** Semi-transparent extruded preview of the closed profile. */
  _updateExtrudePreview() {
    if (this._extrudePreview) {
      this._group.remove(this._extrudePreview);
      this._extrudePreview.geometry.dispose();
      this._extrudePreview = null;
    }
    const op = this._panel ? this._opSelect.value : 'extrude';
    if (this.state !== CLOSED && this.state !== HEIGHT_DRAG) return;
    if (op !== 'extrude' || this.height === 0) return;

    const outline = this._outlinePoints();
    const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.abs(this.height), bevelEnabled: false
    });
    this._extrudePreview = new THREE.Mesh(geometry, this.manager.createPreviewMaterial());
    this._extrudePreview.position.z = Math.min(0, this.height);
    this._group.add(this._extrudePreview);
    this.manager.environment.viewDirty = true;
  }

  /** Live rubber-band segment (straight line, or the three-point arc once
   *  a through-point is placed) with a length/radius + angle label. */
  _updateRubberBand(event) {
    if (!this._rubberLine || this.vertices.length === 0) return;
    const uv = this._hitUV(event, true);
    if (!uv) return;
    const last = this.vertices[this.vertices.length - 1];

    if (this._pendingThrough) {
      // Live three-point arc: last vertex → through-point → cursor
      const arcUV = [last, ...this._sampleArc(last, this._pendingThrough, uv)];
      this._rubberLine.geometry.setFromPoints(this._uvToLinePoints(arcUV));
      const d = 2 * (last[0] * (this._pendingThrough[1] - uv[1]) +
                     this._pendingThrough[0] * (uv[1] - last[1]) +
                     uv[0] * (last[1] - this._pendingThrough[1]));
      if (Math.abs(d) > 1e-9) {
        const samples = this._sampleArc(last, this._pendingThrough, uv, 2);
        const mid = samples[0];
        const chord = Math.hypot(uv[0] - last[0], uv[1] - last[1]);
        const sagitta = Math.hypot(mid[0] - (last[0] + uv[0]) / 2, mid[1] - (last[1] + uv[1]) / 2);
        const radius = (sagitta > 1e-9) ? (chord * chord / (8 * sagitta) + sagitta / 2) : 0;
        this.manager.showLabel(event, 'arc r ≈ ' + Math.round(radius * 10) / 10 + ' mm');
      } else {
        this.manager.showLabel(event, 'arc (collinear)');
      }
    } else {
      this._rubberLine.geometry.setFromPoints(this._uvToLinePoints([last, uv]));
      const du = uv[0] - last[0], dv = uv[1] - last[1];
      const len = Math.round(Math.hypot(du, dv) * 10) / 10;
      const ang = Math.round(Math.atan2(dv, du) * 180 / Math.PI);
      const prefix = this.segMode === 'arc' ? 'arc through-point  ' : '';
      this.manager.showLabel(event, prefix + len + ' mm  ∠' + ang + '°');
    }
    this.manager.environment.viewDirty = true;
  }

  // ===== Panel DOM (Line/Arc toggle always; commit widgets when closed) =====

  _buildPanel() {
    this._panel = document.createElement('div');
    this._panel.className = 'cs-sketch-panel';
    this._panel.style.display = 'none';

    // Segment type toggle (L / A keyboard shortcuts)
    this._lineBtn = document.createElement('button');
    this._lineBtn.textContent = 'Line';
    this._lineBtn.title = 'Straight segments (L)';
    this._lineBtn.addEventListener('click', (e) => { e.stopPropagation(); this.setSegMode('line'); });
    this._arcBtn = document.createElement('button');
    this._arcBtn.textContent = 'Arc';
    this._arcBtn.title = 'Three-point arcs: click the through-point, then the arc end (A)';
    this._arcBtn.addEventListener('click', (e) => { e.stopPropagation(); this.setSegMode('arc'); });

    this._opSelect = document.createElement('select');
    for (let [val, label] of [['extrude', 'Extrude'], ['revolve', 'Revolve'], ['face', 'Face only']]) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      this._opSelect.appendChild(opt);
    }
    this._opSelect.addEventListener('change', () => {
      this._valueLabel.textContent = (this._opSelect.value === 'revolve') ? '∠' : 'h =';
      this._valueInput.value = (this._opSelect.value === 'revolve') ? '360' : String(this.height || 10);
      const showValue = this._opSelect.value !== 'face';
      this._valueLabel.style.display = showValue ? '' : 'none';
      this._valueInput.style.display = showValue ? '' : 'none';
      this._updateExtrudePreview();
    });

    this._valueLabel = document.createElement('span');
    this._valueLabel.textContent = 'h =';

    this._valueInput = document.createElement('input');
    this._valueInput.type = 'number';
    this._valueInput.value = '10';
    this._valueInput.step = '1';
    this._valueInput.addEventListener('input', () => {
      if (this._opSelect.value === 'extrude') {
        this.height = parseFloat(this._valueInput.value) || 0;
        this._updateExtrudePreview();
      }
    });

    this._filletLabel = document.createElement('span');
    this._filletLabel.textContent = 'fillet r =';

    this._filletInput = document.createElement('input');
    this._filletInput.type = 'number';
    this._filletInput.value = '3';
    this._filletInput.min = '0.1';
    this._filletInput.step = '0.5';

    this._applyBtn = document.createElement('button');
    this._applyBtn.textContent = 'Apply';
    this._applyBtn.addEventListener('click', (e) => { e.stopPropagation(); this.commit(); });

    this._cancelBtn = document.createElement('button');
    this._cancelBtn.textContent = 'Cancel';
    this._cancelBtn.className = 'cs-sketch-cancel';
    this._cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cancel(); });

    for (let input of [this._valueInput, this._filletInput]) {
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { this.commit(); }
        if (e.key === 'Escape') { this.cancel(); }
      });
    }

    this._panel.appendChild(this._lineBtn);
    this._panel.appendChild(this._arcBtn);
    this._panel.appendChild(this._opSelect);
    this._panel.appendChild(this._valueLabel);
    this._panel.appendChild(this._valueInput);
    this._panel.appendChild(this._filletLabel);
    this._panel.appendChild(this._filletInput);
    this._panel.appendChild(this._applyBtn);
    this._panel.appendChild(this._cancelBtn);
    this.manager.viewport.goldenContainer.element.appendChild(this._panel);
  }

  /** Show only the Line/Arc toggle while drawing; the full commit
   *  controls appear once the profile is closed. */
  _updatePanelStage() {
    if (!this._panel) return;
    const committing = (this.state === CLOSED || this.state === HEIGHT_DRAG);
    for (let el of [this._opSelect, this._valueLabel, this._valueInput,
                    this._filletLabel, this._filletInput, this._applyBtn, this._cancelBtn]) {
      el.style.display = committing ? '' : 'none';
    }
    const drawing = (this.state === IDLE || this.state === DRAWING);
    this._lineBtn.style.display = drawing ? '' : 'none';
    this._arcBtn.style.display = drawing ? '' : 'none';
    this._lineBtn.classList.toggle('cs-seg-active', this.segMode === 'line');
    this._arcBtn.classList.toggle('cs-seg-active', this.segMode === 'arc');
  }

  _showCommitStage() {
    if (!this._panel) { this._buildPanel(); }
    this._panel.style.display = '';
    this._opSelect.value = 'extrude';
    this._valueLabel.textContent = 'h =';
    this._valueInput.value = String(this.height || 10);
    this.height = parseFloat(this._valueInput.value) || 0;
    this._updatePanelStage();
    this._updateExtrudePreview();
  }
}

export { SketchTool };
