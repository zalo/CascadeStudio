// GUIManager.js - Tweakpane control panel management

import { Pane } from 'tweakpane';

/** Manages the Tweakpane GUI panel and its controls (sliders, buttons, etc.). */
class GUIManager {
  constructor(app) {
    this._app = app;
    this._gui = null;
    this._guiSeparatorAdded = false;
    this._userGui = false;
    this.state = {};
    // Store handler functions for direct calling from reset()
    this._handlers = {};
  }

  /** Register engine event handlers for GUI control creation. */
  registerHandlers(engine) {
    this._handlers["addSlider"] = (payload) => {
      if (!(payload.name in this.state)) { this.state[payload.name] = payload.default; }
      const params = { min: payload.min, max: payload.max, step: payload.step };
      if (payload.dp) { params.format = v => v.toFixed(payload.dp); }

      this._addSeparator();
      const slider = this._gui.addBinding(this.state, payload.name, params);

      if (payload.realTime) {
        slider.on('change', e => {
          if (e.last) { this._delayReload(); }
        });
      }
    };

    this._handlers["addButton"] = (payload) => {
      this._addSeparator();
      const button = this._gui.addButton({ title: payload.name, label: payload.label || payload.name });
      if (typeof payload.callback === 'function') {
        button.on('click', payload.callback);
      } else {
        button.on('click', () => { this._delayReload(); });
      }
    };

    this._handlers["addCheckbox"] = (payload) => {
      if (!(payload.name in this.state)) { this.state[payload.name] = payload.default || false; }
      this._addSeparator();
      this._gui.addBinding(this.state, payload.name).on('change', () => {
        this._delayReload();
      });
    };

    this._handlers["addTextbox"] = (payload) => {
      if (!(payload.name in this.state)) { this.state[payload.name] = payload.default || ''; }
      this._addSeparator();
      const input = this._gui.addBinding(this.state, payload.name);
      if (payload.realTime) {
        input.on('change', e => {
          if (e.last) { this._delayReload(); }
        });
      }
    };

    this._handlers["addDropdown"] = (payload) => {
      if (!(payload.name in this.state)) { this.state[payload.name] = payload.default || ''; }
      const options = payload.options || {};
      this._addSeparator();
      const input = this._gui.addBinding(this.state, payload.name, { options });
      if (payload.realTime) {
        input.on('change', e => {
          if (e.last) { this._delayReload(); }
        });
      }
    };

    // Register with the engine event system
    for (const type of Object.keys(this._handlers)) {
      engine.on(type, this._handlers[type]);
    }
  }

  /** Reset the GUI panel and add default controls before evaluation. */
  reset() {
    if (this._gui) { this._gui.dispose(); }
    this._gui = new Pane({
      title: 'Cascade Control Panel',
      container: document.getElementById('guiPanel'),
      expanded: !navigator.webdriver && window.innerWidth >= window.innerHeight,
    });
    this._guiSeparatorAdded = false;
    this._userGui = false;

    // Add built-in controls directly
    this._handlers["addButton"]({ name: "Evaluate", label: "Function", callback: () => { this._app.editor.evaluateCode(true); } });
    this._handlers["addSlider"]({ name: "MeshRes", default: 0.1, min: 0.01, max: 2, step: 0.01, dp: 2 });
    this._handlers["addCheckbox"]({ name: "Cache?", default: true });
    this._handlers["addCheckbox"]({ name: "GroundPlane?", default: true });
    this._handlers["addCheckbox"]({ name: "Grid?", default: true });
    this._userGui = true;
  }

  /** Add a separator before user-defined controls. */
  _addSeparator() {
    if (this._userGui && !this._guiSeparatorAdded) {
      this._guiSeparatorAdded = true;
      this._gui.addBlade({ view: 'separator' });
    }
  }

  /** Workaround for Tweakpane errors during change event callbacks. */
  _delayReload() {
    setTimeout(() => { this._app.editor.evaluateCode(); }, 0);
  }
}

export { GUIManager };
