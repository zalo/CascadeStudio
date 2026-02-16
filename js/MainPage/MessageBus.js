// MessageBus.js - Typed wrapper around Worker postMessage/onmessage

/** Provides typed message routing between main thread and worker.
 *  Supports fire-and-forget (send), handler registration (on), and
 *  request/response with Promise resolution (request). */
class MessageBus {
  constructor(worker) {
    this._worker = worker;
    this._handlers = {};
    this._pendingRequests = {};
    this._nextRequestId = 1;

    this._worker.onmessage = (e) => {
      const { type, payload, requestId } = e.data;

      // Resolve pending request/response Promise
      if (requestId && this._pendingRequests[requestId]) {
        this._pendingRequests[requestId](payload);
        delete this._pendingRequests[requestId];
        return;
      }

      // Route to registered handler
      if (type in this._handlers) {
        let response = this._handlers[type](payload);
        if (response) {
          this._worker.postMessage({ type, payload: response });
        }
      }
    };

    this._worker.onerror = (e) => {
      console.error("CAD Worker error:", e.message, e.filename, e.lineno);
    };
  }

  /** Register a handler for a message type. */
  on(type, handler) {
    this._handlers[type] = handler;
  }

  /** Remove a handler for a message type. */
  off(type) {
    delete this._handlers[type];
  }

  /** Fire-and-forget message to the worker. */
  send(type, payload) {
    this._worker.postMessage({ type, payload });
  }

  /** Send a message and return a Promise that resolves with the response.
   *  Requires the worker to propagate requestId back. */
  request(type, payload) {
    const requestId = this._nextRequestId++;
    return new Promise((resolve) => {
      this._pendingRequests[requestId] = resolve;
      this._worker.postMessage({ type, payload, requestId });
    });
  }

  /** Check if a handler is registered for a message type. */
  has(type) {
    return type in this._handlers;
  }

  /** Direct access to underlying handlers object (backward compat). */
  get handlers() {
    return this._handlers;
  }
}

export { MessageBus };
