// cascade-headless on Cloudflare Workers — EDITING SESSIONS (`--env session`):
// one Durable Object per session id keeps a build123d-lite engine warm, with
// cascade-core's stable cross-run op cache, and persists the cached working
// set in its SQLite storage. Routes and design: ./session.js.
//
// Same assets as the lite entry (src/index.js). The stable cache is a
// build123d-LITE feature (lite's kernel ops go through the worker's
// CacheOp); the upstream flavor's ops go through the OCP shim, which has no
// op cache yet, so an upstream session would only get the warm engine.

import { createWorker } from './app.js';
import { createSession } from './session.js';

import occtWasm from '../assets/cascadestudio.wasm';
import micropythonWasm from '../assets/micropython-cs.wasm';
import * as micropythonJs from '../assets/micropython-cs.mjs';

import FreeSans from '../assets/fonts/FreeSans.ttf';
import FreeSansBold from '../assets/fonts/FreeSansBold.ttf';
import FreeSansOblique from '../assets/fonts/FreeSansOblique.ttf';
import FreeSansBoldOblique from '../assets/fonts/FreeSansBoldOblique.ttf';

import { bundleId } from '../assets/bundle-id.json';

const worker = createWorker({
  pySrc: 'lite',
  occtWasm,
  micropythonJs,
  micropythonWasm,
  fonts: { FreeSans, FreeSansBold, FreeSansOblique, FreeSansBoldOblique },
  stableCache: true,
});

const session = createSession(worker, { flavor: 'lite', bundleId });

export class EditSession extends session.EditSession {}

export default { fetch: session.fetch };
