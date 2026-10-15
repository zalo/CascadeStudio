// cascade-headless on Cloudflare Workers — the build123d-LITE entry
// (the default wrangler environment). The routes live in ./app.js; this
// module only gathers the assets and decides whether to boot at global scope.
//
// Every asset is a module of the Worker script:
//   *.wasm    CompiledWasm bindings — workerd will not compile WebAssembly at
//             runtime, so these are the ONLY form it accepts
//   *.mjs     the MicroPython Emscripten glue, imported statically (workerd
//             forbids import() of a URL)
//   *.ttf     Data modules (ArrayBuffers) — the four FreeSans faces
//             build123d's FontStyle names; cascade-core parses a face only
//             when a script first uses it
//
// Total Upload ~31 MiB of Cloudflare's 64 MiB (uncompressed — the only size
// limit since 2026-09-04, Free and Paid alike). build123d-lite's Python is a
// string inside cascade-headless.mjs.

import { env } from 'cloudflare:workers';
import { createWorker } from './app.js';

import occtWasm from '../assets/cascadestudio.wasm';
import micropythonWasm from '../assets/micropython-cs.wasm';
import * as micropythonJs from '../assets/micropython-cs.mjs';

import FreeSans from '../assets/fonts/FreeSans.ttf';
import FreeSansBold from '../assets/fonts/FreeSansBold.ttf';
import FreeSansOblique from '../assets/fonts/FreeSansOblique.ttf';
import FreeSansBoldOblique from '../assets/fonts/FreeSansBoldOblique.ttf';

const worker = createWorker({
  pySrc: 'lite',
  occtWasm,
  micropythonJs,
  micropythonWasm,
  fonts: { FreeSans, FreeSansBold, FreeSansOblique, FreeSansBoldOblique },
});

// `BOOT` = request (default) | startup | warm — see BOOT_MODES in app.js.
// Top-level await is fine here: with every asset a module, the boot settles
// through microtasks alone.
await worker.bootAtStartup(env.BOOT);

export default { fetch: worker.fetch };
