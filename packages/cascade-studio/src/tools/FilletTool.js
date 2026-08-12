// FilletTool - click edges to select them, set a radius, Enter commits
import { Tool } from './Tool.js';

/** Fillet tool. Clicking a solid's edge toggles it in the selection
 *  (highlighted orange). A small inline panel takes the radius; Enter (or
 *  Apply) emits `shapeVar = FilletEdges(shapeVar, radius, [indices]);` for
 *  each shape with selected edges, reusing the exact per-shape edge indices
 *  that the hover tooltip shows and FilletEdges() consumes. */
class FilletTool extends Tool {
  constructor(manager) {
    super(manager, 'fillet');
    // globalEdgeIndex → { shapeIndex, localEdgeIndex }
    this.selection = new Map();
    this._downPos = null;
    this._panel = null;
  }

  isInteracting() { return this.selection.size > 0; }

  activate() {
    if (!this._panel) { this._buildPanel(); }
  }

  deactivate() {
    this.cancel();
  }

  cancel() {
    this._clearSelection();
    this._downPos = null;
  }

  /** The scene meshes were rebuilt — any selected edge references are stale. */
  onSceneRebuilt() {
    this.selection.clear();
    this._updatePanel();
  }

  /** Record the pointer-down position; never consume (orbiting stays live). */
  onPointerDown(event) {
    if (event.button === 0) {
      this._downPos = { x: event.clientX, y: event.clientY };
    }
    return false;
  }

  /** On a click (< 5 px of movement), toggle the edge under the pointer. */
  onPointerUp(event) {
    if (event.button !== 0 || !this._downPos) return false;
    const moved = Math.hypot(
      event.clientX - this._downPos.x,
      event.clientY - this._downPos.y
    );
    this._downPos = null;
    if (moved > 5) return false;

    const hit = this.manager.raycastEdge(event);
    if (!hit) return false;
    const pick = this.manager.viewport.getPickInfo(hit);
    if (!pick || pick.kind !== 'edge' || pick.localEdgeIndex < 0 || pick.shapeIndex < 0) {
      return false;
    }

    if (this.selection.has(pick.globalEdgeIndex)) {
      this.selection.delete(pick.globalEdgeIndex);
    } else {
      this.selection.set(pick.globalEdgeIndex, {
        shapeIndex: pick.shapeIndex,
        localEdgeIndex: pick.localEdgeIndex
      });
    }
    this._paintSelection();
    this._updatePanel();
    return true;
  }

  /** Commit the fillet: emit FilletEdges() calls and re-evaluate. */
  commit(radius) {
    if (this.selection.size === 0) return;
    if (!(radius > 0)) {
      console.error('Fillet radius must be a positive number.');
      return;
    }

    // Group selected local edge indices by owning sceneShape
    const byShape = new Map();
    for (let { shapeIndex, localEdgeIndex } of this.selection.values()) {
      if (!byShape.has(shapeIndex)) { byShape.set(shapeIndex, new Set()); }
      byShape.get(shapeIndex).add(localEdgeIndex);
    }

    const claimedNames = new Set();
    const snippets = [];
    for (let [shapeIndex, indexSet] of byShape) {
      const lineNumber = this.manager.viewport.getShapeLine(shapeIndex);
      if (lineNumber < 1) {
        console.error('Fillet: could not map the clicked shape back to a code line.');
        continue;
      }
      const varName = this._resolveVarName(lineNumber, claimedNames);
      if (!varName) {
        console.error('Fillet: could not identify a variable for the shape on line ' +
          lineNumber + '. Assign the shape to a variable first.');
        continue;
      }
      claimedNames.add(varName);
      const indices = [...indexSet].sort((a, b) => a - b);
      snippets.push(varName + ' = FilletEdges(' + varName + ', ' + radius +
        ', [' + indices.join(', ') + ']);');
    }

    this._clearSelection();
    if (snippets.length > 0) {
      this.manager.commitCode(snippets.join('\n'));
    }
  }

  /** Find (or create) the variable name holding the shape produced at
   *  `lineNumber`. Bare expression statements like `Box(10, 10, 10);` are
   *  rewritten in place to `let box1 = Box(10, 10, 10);`. */
  _resolveVarName(lineNumber, claimedNames) {
    const editor = this.manager.editor;
    const lineText = editor.getLineContent(lineNumber);

    let m = lineText.match(/^\s*(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (!m) { m = lineText.match(/^\s*([A-Za-z_$][\w$]*)\s*=[^=]/); }
    if (m) { return m[1]; }

    // Bare expression statement — rewrite it with a fresh assignment
    const expr = lineText.match(/^(\s*)((?:new\s+)?([A-Za-z_$][\w$]*)\s*\(.*)$/);
    if (!expr) { return null; }
    const name = this.manager.nextVarName(expr[3].toLowerCase(), claimedNames);
    editor.replaceLine(lineNumber, expr[1] + 'let ' + name + ' = ' + expr[2]);
    return name;
  }

  /** Push the current selection into the edge mesh's highlight colors. */
  _paintSelection() {
    const line = this._edgeMesh();
    if (!line) return;
    line.selectedEdges = new Set(this.selection.keys());
    line.clearHighlights();
    this.manager.environment.viewDirty = true;
  }

  _clearSelection() {
    this.selection.clear();
    const line = this._edgeMesh();
    if (line) {
      line.selectedEdges = new Set();
      line.clearHighlights();
      this.manager.environment.viewDirty = true;
    }
    this._updatePanel();
  }

  /** The current model's LineSegments mesh (or null). */
  _edgeMesh() {
    const mainObject = this.manager.viewport.mainObject;
    if (!mainObject) return null;
    return mainObject.children.find((c) => c.type === 'LineSegments') || null;
  }

  // ===== Radius panel DOM =====

  _buildPanel() {
    this._panel = document.createElement('div');
    this._panel.className = 'cs-fillet-panel';
    this._panel.style.display = 'none';

    this._countEl = document.createElement('span');
    this._countEl.className = 'cs-fillet-count';

    const label = document.createElement('span');
    label.textContent = 'r =';

    this._input = document.createElement('input');
    this._input.type = 'number';
    this._input.value = '2';
    this._input.min = '0.1';
    this._input.step = '0.5';
    this._input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.commit(parseFloat(this._input.value)); }
      if (e.key === 'Escape') { this.cancel(); }
    });

    const apply = document.createElement('button');
    apply.textContent = 'Apply';
    apply.addEventListener('click', (e) => {
      e.stopPropagation();
      this.commit(parseFloat(this._input.value));
    });

    this._panel.appendChild(this._countEl);
    this._panel.appendChild(label);
    this._panel.appendChild(this._input);
    this._panel.appendChild(apply);
    this.manager.viewport.goldenContainer.element.appendChild(this._panel);
  }

  _updatePanel() {
    if (!this._panel) return;
    if (this.selection.size === 0) {
      this._panel.style.display = 'none';
      return;
    }
    this._countEl.textContent = this.selection.size + ' edge' +
      (this.selection.size !== 1 ? 's' : '');
    this._panel.style.display = '';
    this._input.focus();
  }
}

export { FilletTool };
