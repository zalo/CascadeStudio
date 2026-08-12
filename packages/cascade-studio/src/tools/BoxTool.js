// BoxTool - drag a footprint on the ground plane, then drag the height
import * as THREE from 'three';
import { Tool } from './Tool.js';

const IDLE = 0, DRAG_BASE = 1, DRAG_HEIGHT = 2;

/** Box creation tool (LeapShape-style state machine):
 *  1. pointerdown on the ground plane sets the base corner (snapped to mm)
 *  2. drag sizes the footprint rectangle (live preview)
 *  3. release, then move sizes the height
 *  4. click commits: emits `let boxN = Translate(..., Box(w, d, h));` */
class BoxTool extends Tool {
  constructor(manager) {
    super(manager, 'box');
    this.state = IDLE;
    this.preview = null;
    this.baseCAD = null;    // CAD [x, y, 0] of the first corner
    this.cornerCAD = null;  // CAD [x, y, 0] of the dragged corner
    this.height = 0;        // CAD z height (may be negative)
  }

  isInteracting() { return this.state !== IDLE; }

  onPointerDown(event) {
    if (event.button !== 0) return false;

    if (this.state === IDLE) {
      const hit = this.manager.raycastGround(event);
      if (!hit) return false;
      this.baseCAD = this.manager.snapGroundToCad(hit);
      this.cornerCAD = this.baseCAD.slice();
      this.height = 0;
      this._createPreview();
      this.manager.beginInteraction();
      this.state = DRAG_BASE;
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
    if (this.state === DRAG_BASE) {
      const hit = this.manager.raycastGround(event);
      if (hit) {
        this.cornerCAD = this.manager.snapGroundToCad(hit);
        this._updatePreview();
        const { w, d } = this._dims();
        this.manager.showLabel(event, w + ' × ' + d);
      }
      return true;
    }
    if (this.state === DRAG_HEIGHT) {
      const centerThree = this.manager.cadToThree(this._footprintCenterCAD());
      centerThree.y = 0;
      this.height = this.manager.heightFromRay(event, centerThree);
      this._updatePreview();
      this.manager.showLabel(event, 'h = ' + this.height);
      return true;
    }
    return false;
  }

  onPointerUp(event) {
    if (this.state === DRAG_BASE) {
      const { w, d } = this._dims();
      if (w === 0 || d === 0) {
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

  /** Footprint dimensions and min corner in CAD space. */
  _dims() {
    return {
      w: Math.abs(this.cornerCAD[0] - this.baseCAD[0]),
      d: Math.abs(this.cornerCAD[1] - this.baseCAD[1]),
      minX: Math.min(this.baseCAD[0], this.cornerCAD[0]),
      minY: Math.min(this.baseCAD[1], this.cornerCAD[1]),
    };
  }

  /** CAD center of the box (footprint center at half height). */
  _footprintCenterCAD() {
    const { w, d, minX, minY } = this._dims();
    return [minX + w / 2, minY + d / 2, 0];
  }

  _createPreview() {
    this.preview = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.manager.createPreviewMaterial()
    );
    this.manager.addPreview(this.preview);
    this._updatePreview();
  }

  _updatePreview() {
    if (!this.preview) return;
    const { w, d, minX, minY } = this._dims();
    const h = this.height;
    const zMin = Math.min(0, h);
    // CAD center → three.js position; CAD (w, d, |h|) → three scale (x, z, y)
    const center = [minX + w / 2, minY + d / 2, zMin + Math.abs(h) / 2];
    this.preview.position.copy(this.manager.cadToThree(center));
    this.preview.scale.set(Math.max(w, 0.01), Math.max(Math.abs(h), 0.01), Math.max(d, 0.01));
    this.manager.environment.viewDirty = true;
  }

  _commit() {
    const { w, d, minX, minY } = this._dims();
    const h = this.height;
    this.cancel(); // removes preview, re-enables controls, resets state
    this.emitBox([minX, minY, Math.min(0, h)], [w, d, Math.abs(h)]);
  }

  /** Emit code for a box with CAD min-corner `corner` and dims [w, d, h]. */
  emitBox(corner, dims) {
    const name = this.manager.nextVarName('box');
    const boxCall = 'Box(' + dims[0] + ', ' + dims[1] + ', ' + dims[2] + ')';
    const needsTranslate = corner[0] !== 0 || corner[1] !== 0 || corner[2] !== 0;
    const snippet = needsTranslate
      ? 'let ' + name + ' = Translate([' + corner[0] + ', ' + corner[1] + ', ' + corner[2] + '], ' + boxCall + ');'
      : 'let ' + name + ' = ' + boxCall + ';';
    this.manager.commitCode(snippet);
  }
}

export { BoxTool };
