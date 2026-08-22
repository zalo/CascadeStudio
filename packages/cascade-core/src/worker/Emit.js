// Emit.js — the cascade-core worker's single outbound-message seam.
//
// Everything the CAD worker tells the outside world (log/error/Progress/
// resetWorking/modelHistory/the GUI-widget registrations/the mesh payload)
// used to be a bare `postMessage({type, payload})`, which hard-wired the
// engine to a browser Web Worker. It now goes through `csEmit`, which
// resolves its sink at CALL time:
//
//   * `globalThis._csEmit` when an embedder installed one (the headless
//     entry point in src/headless.js collects the messages instead of
//     posting them, and registers GUI-widget defaults so scripts that call
//     Slider()/Checkbox()/... still run),
//   * otherwise `globalThis.postMessage` — i.e. byte-identical behaviour in
//     a browser Web Worker, which is the only environment that has one.
//
// Deliberately NOT captured once at module load: a headless embedder sets
// the hook after this module has been evaluated.

/** Send one message to whatever is listening (worker host or embedder). */
export function csEmit(msg) {
  const sink = globalThis._csEmit;
  if (typeof sink === 'function') { sink(msg); return; }
  globalThis.postMessage(msg);
}

/** Emit a message that the browser worker deliberately posts OUT of the
 *  current call stack (console.log forwarding: a tight modelling loop would
 *  otherwise stall on postMessage). An embedder's sink is called
 *  synchronously instead — headless `run()` returns the logs, so they must
 *  have arrived by the time the evaluation finishes. */
export function csEmitAsync(msg) {
  const sink = globalThis._csEmit;
  if (typeof sink === 'function') { sink(msg); return; }
  setTimeout(() => { globalThis.postMessage(msg); }, 0);
}

/** Run `thunk` outside the current call stack. In a browser worker the
 *  thunk throws, so the exception reaches `window.onerror` through the
 *  worker's error event — the established error path. A headless embedder
 *  replaces `globalThis._csDeferError` with a collector (see headless.js),
 *  which is what turns "errors are thrown at the host" into "errors are
 *  returned from run()". */
export function csDeferError(thunk) {
  const hook = globalThis._csDeferError;
  if (typeof hook === 'function') { hook(thunk); return; }
  setTimeout(thunk, 0);
}
