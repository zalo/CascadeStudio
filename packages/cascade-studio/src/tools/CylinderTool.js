// CylinderTool - click center, drag radius, then drag height
import * as THREE from 'three';
import { Tool } from './Tool.js';

const IDLE = 0, DRAG_RADIUS = 1, DRAG_HEIGHT = 2;

/** Cylinder creation tool:
 *  1. pointerdown on the ground plane sets the center (snapped to mm)
 *  2. drag sizes the radius (live preview)
 *  3. release, then move sizes the height
 *  4. click commits: emits `let cylinderN = Translate(..., Cylinder(r, h));` */
class CylinderTool extends Tool {
  constructor(manager) {
    super(manager, 'cylinder');
    this.state = IDLE;
    this.preview = null;
    this.centerCAD = null; // CAD [x, y, 0]
    this.radius = 0;
    this.height = 0;       // CAD z height (may be negative)
  }

  isInteracting() { return this.state !== IDLE; }

  onPointerDown(event) {
    if (event.button !== 0) return false;

    if (this.state === IDLE) {
      const hit = this.manager.raycastGround(event);
      if (!hit) return false;
      this.centerCAD = this.manager.snapGroundToCad(hit);
      this.radius = 0;
      this.height = 0;
      this._createPreview();
      this.manager.beginInteraction();
      this.state = DRAG_RADIUS;
      return true;
    }

    if (this.state === DRAG_HEIGHT) {
      if (Math.abs(this.height) > 0) {
        this._commit();
      } else {
        this.cancel();
      }
      return true;
    }
    return false;
  }

  onPointerMove(event) {
    if (this.state === DRAG_RADIUS) {
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
    if (this.state === DRAG_HEIGHT) {
      const centerThree = this.manager.cadToThree(this.centerCAD);
      centerThree.y = 0;
      this.height = this.manager.heightFromRay(event, centerThree);
      this._updatePreview();
      this.manager.showLabel(event, 'h = ' + this.height);
      return true;
    }
    return false;
  }

  onPointerUp(event) {
    if (this.state === DRAG_RADIUS) {
      if (this.radius === 0) {
        this.cancel();
      } else {
        this.state = DRAG_HEIGHT;
      }
      return true;
    }
    return false;
  }

  cancel() {
    this.manager.removePreview(this.preview);
    this.preview = null;
    if (this.state !== IDLE) { this.manager.endInteraction(); }
    this.state = IDLE;
    this.manager.hideLabel();
  }

  _createPreview() {
    // three.js CylinderGeometry's axis is Y-up, which matches CAD Z-up
    this.preview = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 48),
      this.manager.createPreviewMaterial()
    );
    this.manager.addPreview(this.preview);
    this._updatePreview();
  }

  _updatePreview() {
    if (!this.preview) return;
    const h = this.height;
    const zMin = Math.min(0, h);
    const center = [this.centerCAD[0], this.centerCAD[1], zMin + Math.abs(h) / 2];
    this.preview.position.copy(this.manager.cadToThree(center));
    const r = Math.max(this.radius, 0.01);
    this.preview.scale.set(r, Math.max(Math.abs(h), 0.01), r);
    this.manager.environment.viewDirty = true;
  }

  _commit() {
    const center = this.centerCAD;
    const r = this.radius;
    const h = this.height;
    this.cancel();
    this.emitCylinder([center[0], center[1], Math.min(0, h)], r, Math.abs(h));
  }

  /** Emit code for a cylinder with CAD base center `base`, radius, height. */
  emitCylinder(base, radius, height) {
    const name = this.manager.nextVarName('cylinder');
    const cylCall = 'Cylinder(' + radius + ', ' + height + ')';
    if (this.manager.isPythonMode) {
      // build123d's Cylinder is CENTERED along Z (spans -h/2 .. +h/2), so
      // place it via Pos at the cylinder's mid-height point.
      const center = [base[0], base[1], base[2] + height / 2];
      const needsPos = center[0] !== 0 || center[1] !== 0 || center[2] !== 0;
      this.manager.commitCode(needsPos
        ? name + ' = Pos(' + center.join(', ') + ') * ' + cylCall
        : name + ' = ' + cylCall);
      return;
    }
    const needsTranslate = base[0] !== 0 || base[1] !== 0 || base[2] !== 0;
    const snippet = needsTranslate
      ? 'let ' + name + ' = Translate([' + base[0] + ', ' + base[1] + ', ' + base[2] + '], ' + cylCall + ');'
      : 'let ' + name + ' = ' + cylCall + ';';
    this.manager.commitCode(snippet);
  }
}

export { CylinderTool };
