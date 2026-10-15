// cascade-headless on Cloudflare Workers — the verbatim-UPSTREAM build123d
// 0.13.0 entry (`--env upstream`). Same routes (./app.js), same assets as the
// lite entry, plus the upstream Python layer: 158 modules (vendored sources +
// shims + the OCP binding table) as ONE relative-path -> source JSON map,
// imported as a Text module (3.15 MB raw) and parsed once at engine boot.
//
// It is a separate entry so the lite isolate never holds that 3 MB string.

import { env } from 'cloudflare:workers';
import { createWorker } from './app.js';

import occtWasm from '../assets/cascadestudio.wasm';
import micropythonWasm from '../assets/micropython-cs.wasm';
import * as micropythonJs from '../assets/micropython-cs.mjs';

import FreeSans from '../assets/fonts/FreeSans.ttf';
import FreeSansBold from '../assets/fonts/FreeSansBold.ttf';
import FreeSansOblique from '../assets/fonts/FreeSansOblique.ttf';
import FreeSansBoldOblique from '../assets/fonts/FreeSansBoldOblique.ttf';

import upstreamTreeText from '../assets/upstream-b123d.json';

const worker = createWorker({
  pySrc: 'upstream',
  occtWasm,
  micropythonJs,
  micropythonWasm,
  fonts: { FreeSans, FreeSansBold, FreeSansOblique, FreeSansBoldOblique },
  upstreamTreeText,
});

// `BOOT=warm` is refused for this flavor: the upstream library boot alone is
// ~1.1 s of CPU in Node (MicroPython compiling ~3 MB of transformed Python),
// over Cloudflare's 1 s startup limit, so a warm global scope would fail the
// deploy with error 10021. `startup` (OCCT only, ~0.1 s) is fine.
await worker.bootAtStartup(env.BOOT === 'warm' ? 'startup' : env.BOOT);

export default { fetch: worker.fetch };
