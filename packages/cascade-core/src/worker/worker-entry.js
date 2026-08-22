// worker-entry.js — the BROWSER Web Worker entry point (bundled to
// dist/cascade-worker.js).
//
// Everything of substance lives in CascadeWorker.js, which is side-effect
// free so the headless entry (src/headless.js) can construct the same engine
// without a message loop. This file is the browser half: construct, install
// the onmessage router, boot.

import { CascadeStudioWorker } from './CascadeWorker.js';

const worker = new CascadeStudioWorker();
worker.init();

export { CascadeStudioWorker };
