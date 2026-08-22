// GlobalSelf.js — make the worker's `self` global exist off-browser.
//
// Every module under src/worker/ keeps its state on `self` (the CAD standard
// library is exposed there so user JS can `eval()` against it, and the Python
// bridge reaches it through `from browser import self as w`). A Web Worker
// gets that global for free; Node and workerd do not.
//
// Importing this module FIRST — headless.js does, before anything else —
// aliases `self` to `globalThis`, which is exactly what a worker's `self` is.
// The engine mutates `globalThis` either way, so this changes nothing about
// its behaviour; it only makes the name resolvable.

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

export const workerGlobal = globalThis.self;
