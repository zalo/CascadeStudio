// CascadeEngine.js - Main-thread API for cascade-core
// Wraps a Web Worker + MessageBus to provide a clean async interface.

import { MessageBus } from './MessageBus.js';

/** High-level API for running CAD code and receiving mesh results.
 *
 *  Usage:
 *    const engine = new CascadeEngine({ workerUrl: './cascade-worker.js' });
 *    await engine.init();
 *    const result = await engine.evaluate(code, { guiState });
 *    // result.meshData = { faces, edges }
 */
class CascadeEngine {
  constructor({ workerUrl }) {
    this._workerUrl = workerUrl;
    this._worker = null;
    this._messageBus = null;
    this._ready = false;
    this._working = false;
    this._listeners = {};
  }

  /** Load worker + WASM, resolves when the worker signals readiness. */
  async init() {
    this._worker = new Worker(this._workerUrl, { type: 'module' });
    this._messageBus = new MessageBus(this._worker);

    // Wire up event forwarding for all known worker message types
    const eventTypes = [
      'log', 'error', 'Progress', 'addSlider', 'addButton',
      'addCheckbox', 'addTextbox', 'addDropdown', 'saveFile',
      'createTransformHandle'
    ];
    for (const type of eventTypes) {
      this._messageBus.on(type, (payload) => {
        this._emit(type, payload);
      });
    }

    this._messageBus.on('resetWorking', () => {
      this._working = false;
      this._emit('resetWorking');
    });

    this._messageBus.on('modelHistory', (steps) => {
      this._emit('modelHistory', steps);
    });

    // Wait for the startupCallback from the worker
    return new Promise((resolve) => {
      this._messageBus.on('startupCallback', () => {
        this._ready = true;
        resolve();
      });
    });
  }

  /** Evaluate CAD code and return mesh data.
   *  Fires intermediate events (log, addSlider, etc.) in real-time.
   *  Returns: { meshData: { faces, edges }, sceneOptions, logs, errors } */
  async evaluate(code, { guiState = {}, maxDeviation, sceneOptions } = {}) {
    if (!this._ready) throw new Error('CascadeEngine not initialized. Call init() first.');

    this._working = true;

    // Send evaluation command (fire-and-forget — worker processes asynchronously)
    this._messageBus.send('Evaluate', {
      code,
      GUIState: guiState
    });

    // Request meshing — this returns a Promise that resolves with [facesAndEdges, sceneOptions]
    const result = await this._messageBus.request('combineAndRenderShapes', {
      maxDeviation: maxDeviation || guiState['MeshRes'] || 0.1,
      sceneOptions: sceneOptions || {
        groundPlaneVisible: guiState['GroundPlane?'],
        gridVisible: guiState['Grid?']
      }
    }, 120000);

    this._working = false;

    if (!result) return { meshData: null, sceneOptions: {} };

    const [[faces, edges], resultSceneOptions] = result;
    return {
      meshData: { faces, edges },
      sceneOptions: resultSceneOptions || {}
    };
  }

  /** Triangulate and return mesh data for a specific history step. */
  async meshHistoryStep(stepIndex, maxDeviation = 0.1) {
    return this._messageBus.request('meshHistoryStep', {
      stepIndex,
      maxDeviation
    });
  }

  /** Export the current shape as STEP text. */
  async exportSTEP() {
    return this._messageBus.request('saveShapeSTEP');
  }

  /** Send files to the worker for import. */
  importFiles(files) {
    this._messageBus.send('loadFiles', files);
  }

  /** Load pre-existing external files (from saved project state). */
  loadPrexistingExternalFiles(dict) {
    this._messageBus.send('loadPrexistingExternalFiles', dict);
  }

  /** Clear all externally loaded files. */
  clearExternalFiles() {
    this._messageBus.send('clearExternalFiles');
  }

  /** Register an event handler. */
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  /** Remove an event handler. */
  off(event, handler) {
    if (!this._listeners[event]) return;
    if (!handler) {
      delete this._listeners[event];
    } else {
      this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    }
  }

  get isReady() { return this._ready; }
  get isWorking() { return this._working; }

  /** Escape hatch for direct MessageBus access. */
  get messageBus() { return this._messageBus; }

  /** Clean up the worker. */
  dispose() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
      this._messageBus = null;
      this._ready = false;
    }
  }

  /** Emit an event to all registered listeners. */
  _emit(event, ...args) {
    const handlers = this._listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }
}

export { CascadeEngine };
