// SphereTool - click center, drag radius, release to commit
import * as THREE from 'three';
import { Tool } from './Tool.js';

const IDLE = 0, DRAG_RADIUS = 1;

/** Sphere creation tool:
 *  1. pointerdown on the ground plane sets the center (snapped to mm)
 *  2. drag sizes the radius (live preview)
 *  3. release commits: emits `let sphereN = Translate(..., Sphere(r));` */
class SphereTool extends Tool {
  constructor(manager) {
    super(manager, 'sphere');
    this.state = IDLE;
    this.preview = null;
    this.centerCAD = null; // CAD [x, y, 0]
    this.radius = 0;
  }

  isInteracting() { return this.state !== IDLE; }

  onPointerDown(event) {
    if (event.button !== 0 || this.state !== IDLE) return false;
    const hit = this.manager.raycastGround(event);
    if (!hit) return false;
    this.centerCAD = this.manager.snapGroundToCad(hit);
    this.radius = 0;
    this._createPreview();
    this.manager.beginInteraction();
    this.state = DRAG_RADIUS;
    return true;
  }

  onPointerMove(event) {
    if (this.state !== DRAG_RADIUS) return false;
    const hit = this.manager.raycastGround(event);
    if (hit) {
      const p = this.manager.threeToCad(hit);
      this.radius = this.manager.snap(Math.hypot(
        p[0] - this.centerCAD[0], p[1] - this.centerCAD[1]
      ));
      this._updatePreview();
      this.manager.showLabel(event, 'r = ' + this.radius);
    }
    return true;
  }

  onPointerUp(event) {
    if (this.state !== DRAG_RADIUS) return false;
    if (this.radius > 0) {
      const center = this.centerCAD;
      const r = this.radius;
      this.cancel();
      this.emitSphere(center, r);
    } else {
      this.cancel();
    }
    return true;
  }

  cancel() {
    this.manager.removePreview(this.preview);
    this.preview = null;
    if (this.state !== IDLE) { this.manager.endInteraction(); }
    this.state = IDLE;
    this.manager.hideLabel();
  }

  _createPreview() {
    this.preview = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      this.manager.createPreviewMaterial()
    );
    this.manager.addPreview(this.preview);
    this._updatePreview();
  }

  _updatePreview() {
    if (!this.preview) return;
    this.preview.position.copy(this.manager.cadToThree(this.centerCAD));
    const r = Math.max(this.radius, 0.01);
    this.preview.scale.set(r, r, r);
    this.manager.environment.viewDirty = true;
  }

  /** Emit code for a sphere with CAD center `center` and `radius`. */
  emitSphere(center, radius) {
    const name = this.manager.nextVarName('sphere');
    const sphereCall = 'Sphere(' + radius + ')';
    const needsMove = center[0] !== 0 || center[1] !== 0 || center[2] !== 0;
    if (this.manager.isPythonMode) {
      this.manager.commitCode(needsMove
        ? name + ' = Pos(' + center.join(', ') + ') * ' + sphereCall
        : name + ' = ' + sphereCall);
      return;
    }
    const snippet = needsMove
      ? 'let ' + name + ' = Translate([' + center[0] + ', ' + center[1] + ', ' + center[2] + '], ' + sphereCall + ');'
      : 'let ' + name + ' = ' + sphereCall + ';';
    this.manager.commitCode(snippet);
  }
}

export { SphereTool };
