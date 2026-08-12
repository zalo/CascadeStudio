// SelectTool - default tool; clicking a shape reveals its producing code line
import { Tool } from './Tool.js';

/** Default tool. Camera controls stay fully enabled; a click (as opposed to
 *  an orbit drag) picks the shape under the pointer and reveals + flashes
 *  the editor line that produced it. */
class SelectTool extends Tool {
  constructor(manager) {
    super(manager, 'select');
    this._downPos = null;
  }

  /** Record the pointer-down position to distinguish clicks from drags.
   *  Never consumes the event, so OrbitControls keeps working. */
  onPointerDown(event) {
    if (event.button === 0) {
      this._downPos = { x: event.clientX, y: event.clientY };
    }
    return false;
  }

  /** On a click (< 5 px of movement), map the picked shape to its code line. */
  onPointerUp(event) {
    if (event.button !== 0 || !this._downPos) return false;
    const moved = Math.hypot(
      event.clientX - this._downPos.x,
      event.clientY - this._downPos.y
    );
    this._downPos = null;
    if (moved > 5) return false;

    const hit = this.manager.raycastScene(event);
    if (!hit) return false;
    const pick = this.manager.viewport.getPickInfo(hit);
    if (!pick || pick.shapeIndex < 0) return false;

    const lineNumber = this.manager.viewport.getShapeLine(pick.shapeIndex);
    if (lineNumber > 0) {
      this.manager.editor.flashLine(lineNumber);
    }
    return false;
  }

  cancel() { this._downPos = null; }
}

export { SelectTool };
