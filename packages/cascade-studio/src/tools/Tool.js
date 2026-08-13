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
