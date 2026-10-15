// Entry module of the `--env real` flavor: REAL, unmodified build123d 0.11.1
// (the PyPI wheel) + real numpy on Pyodide 314 (CPython 3.14), over the same
// OCP-over-embind shim and the same OCCT kernel as the other two flavors.
//
// This file only adds the Pyodide MODULE BINDINGS (~20 MB uncompressed —
// which is why it is a separate entry and not in the lite/upstream script)
// and hands cascade-core a host that boots Pyodide from them; the request
// handling is src/index.js, unchanged. Assets come from
// scripts/prepare-pyodide.mjs (assets/pyodide/), which also documents the
// three glue patches that make Pyodide bootable without runtime wasm
// compilation. See FIDELITY-ON-WORKERS.md.
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
import worker from './index.js';

/** cascade-core's names (PyodideRealB123d.js) -> the bundled archives. numpy
 *  ships as numpy-lite.zip: its .so files are 0-byte placeholders, the real
 *  side modules are the precompiled `dynlibModules`. */
const WHEELS = {
  numpy: ['numpy-lite.zip', 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl'],
  'typing-extensions': ['typing_extensions-4.15.0-py3-none-any.whl'],
};

globalThis.__csPyodideHost = {
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

export default worker;
