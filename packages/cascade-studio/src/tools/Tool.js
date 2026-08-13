// Base class for viewport modeling tools

/** Base class for GUI modeling tools (LeapShape-style state machines).
 *  Tools receive raw pointer events from the ToolManager and return `true`
 *  from a handler to consume the event (blocking OrbitControls). */
class Tool {
  /** @param {import('./ToolManager.js').ToolManager} manager
   *  @param {string} name */
  constructor(manager, name) {
    this.manager = manager;
    this.name = name;
    // True while the pointer button is held down for the stage in progress.
    // See stageDown()/stageUp().
    this.stagePressed = false;
  }

  /** Resolve a pointerdown that lands inside an already-running numeric
   *  stage of a multi-stage tool (e.g. the Box's height stage).
   *
   *  Multi-stage tools must accept BOTH natural gestures for every stage:
   *    - press-drag-release  (press, drag to size, release)
   *    - click-move-click    (click to start, move to size, click to lock)
   *
   *  `hasValue` is true when the stage's dimension has already been set by a
   *  preceding pointermove. Returns true when the stage should advance/commit
   *  (the click-move-click case). Returns false when a fresh drag is starting,
   *  and keeps the stage alive — previously a press here cancelled the whole
   *  in-progress solid, so the second drag of Box/Cylinder always failed.
   *  @param {boolean} hasValue @returns {boolean} advance */
  stageDown(hasValue) {
    // Advancing on a click deliberately clears stagePressed: the release of
    // the advancing click must not commit the next stage on a few px of
    // pointer jitter.
    this.stagePressed = !hasValue;
    return hasValue;
  }

  /** Resolve a pointerup inside a running numeric stage. Returns true when
   *  the stage should advance/commit — i.e. the button was pressed for this
   *  stage (press-drag-release) and the dimension is non-degenerate.
   *  A zero-dimension release is NOT destructive: the stage stays live so
   *  the user can keep moving (click-move-click) or press Escape to cancel.
   *  @param {boolean} hasValue @returns {boolean} advance */
  stageUp(hasValue) {
    const pressed = this.stagePressed;
    this.stagePressed = false;
    return pressed && hasValue;
  }

  /** Called when this tool becomes the active tool. */
  activate() {}

  /** Called when another tool becomes active. Cancels any interaction. */
  deactivate() { this.cancel(); }

  /** Abort any in-progress interaction and clean up previews. */
  cancel() {}

  /** True while a multi-step interaction (e.g. drag) is in progress. */
  isInteracting() { return false; }

  /** @param {PointerEvent} event @returns {boolean} consumed */
  onPointerDown(event) { return false; }

  /** @param {PointerEvent} event @returns {boolean} consumed */
  onPointerMove(event) { return false; }

  /** @param {PointerEvent} event @returns {boolean} consumed */
  onPointerUp(event) { return false; }

  /** Handle Escape. Return true if consumed (e.g. stepped back one stage);
   *  returning false lets the ToolManager switch back to the Select tool.
   *  Stateful tools (Sketch) override this for finer-grained undo. */
  onEscape() {
    if (this.isInteracting()) {
      this.cancel();
      return true;
    }
    return false;
  }

  /** @param {KeyboardEvent} event @returns {boolean} consumed */
  onKeyDown(event) { return false; }
}

export { Tool };
