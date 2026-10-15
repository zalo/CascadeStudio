// cascade-headless on Cloudflare Workers — the REAL build123d entry
// (`--env real`): the unmodified build123d 0.13.0 PyPI wheel + real numpy on
// Pyodide 314 (CPython 3.14), over the same OCP-over-embind shim and the
// same OCCT kernel as the lite and upstream flavors. Routes: ./app.js.
//
// On top of the upstream entry's modules this adds the Pyodide MODULE
// BINDINGS (~20 MB uncompressed; this script is the only one that carries
// them) and the host that boots Pyodide from them without compiling wasm or
// evaluating strings at runtime. Assets: scripts/prepare-pyodide.mjs
// (assets/pyodide/), which also documents the three glue patches.
// See FIDELITY-ON-WORKERS.md.
import { env } from 'cloudflare:workers';
import { createWorker } from './app.js';

import occtWasm from '../assets/cascadestudio.wasm';
import micropythonWasm from '../assets/micropython-cs.wasm';
import * as micropythonJs from '../assets/micropython-cs.mjs';

import FreeSans from '../assets/fonts/FreeSans.ttf';
import FreeSansBold from '../assets/fonts/FreeSansBold.ttf';
import FreeSansOblique from '../assets/fonts/FreeSansOblique.ttf';
import FreeSansBoldOblique from '../assets/fonts/FreeSansBoldOblique.ttf';

// The OCP shim + glue the real wheel runs over ship in the same map as the
// upstream flavor's vendored sources.
import upstreamTree from '../assets/upstream-b123d.json';   // Data module (ArrayBuffer)

import { loadPyodide } from '../assets/pyodide/pyodide.mjs';
import createPyodideModule from '../assets/pyodide/pyodide.asm.mjs';
import asmModule from '../assets/pyodide/pyodide.asm.wasm';
import trampolineModule from '../assets/pyodide/pyemtrampoline.wasm';
import stdlib from '../assets/pyodide/python_stdlib.zip';
import lock from '../assets/pyodide/pyodide-lock.json';
import dynlibModules from '../assets/pyodide/dynlibs.mjs';
import sigModules from '../assets/pyodide/sigs.mjs';
import wheels from '../assets/pyodide/wheels.mjs';
import { bootPyodide, installWheel } from './boot-pyodide.mjs';

/** cascade-core asks for 'numpy' + REAL_WHEELS file names
 *  (PyodideRealB123d.js) -> the bundled archives. numpy ships as
 *  numpy-lite.zip: its .so files are 0-byte placeholders, the real side
 *  modules are the precompiled `dynlibModules`. */
const WHEELS = {
  numpy: ['numpy-lite.zip', 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl'],
};

const pyodide = {
  async boot({ stdout, stderr }) {
    globalThis.__csSigModules = sigModules;
    return bootPyodide({ loadPyodide, createPyodideModule, asmModule, trampolineModule,
      dynlibModules, stdlib, lock, stdout, stderr });
  },
  async installWheels(py, names) {
    for (const n of names) {
      const [file, asName] = WHEELS[n] || [n];
      if (!wheels[file]) { throw new Error('pysrc=real: wheel not bundled: ' + file); }
      await installWheel(py, wheels[file], asName || file);
    }
  },
};

const worker = createWorker({
  pySrc: 'real',
  occtWasm,
  micropythonJs,       // unused by the Pyodide runtime; harmless
  micropythonWasm,
  fonts: { FreeSans, FreeSansBold, FreeSansOblique, FreeSansBoldOblique },
  upstreamTree,
  pyodide,
});

// `BOOT=warm` is refused, like the upstream entry: Pyodide init plus the
// numpy/build123d import is ~1.8 s locally, far over the 1 s startup limit.
// `startup` (OCCT only) is fine.
await worker.bootAtStartup(env.BOOT === 'warm' ? 'startup' : env.BOOT);

export default { fetch: worker.fetch };
