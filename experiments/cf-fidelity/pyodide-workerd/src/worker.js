// Pyodide 314 + numpy on workerd from module bindings only (phase 1 of the
// pysrc=real-on-Workers prototype). GET /boot boots once per isolate and
// reports timings and memory; GET /run?code=... runs Python.
import { loadPyodide } from '../../../../examples/cloudflare-worker/assets/pyodide/pyodide.mjs';
import createPyodideModule from '../../../../examples/cloudflare-worker/assets/pyodide/pyodide.asm.mjs';
import asmModule from '../../../../examples/cloudflare-worker/assets/pyodide/pyodide.asm.wasm';
import trampolineModule from '../../../../examples/cloudflare-worker/assets/pyodide/pyemtrampoline.wasm';
import stdlib from '../../../../examples/cloudflare-worker/assets/pyodide/python_stdlib.zip';
import lock from '../../../../examples/cloudflare-worker/assets/pyodide/pyodide-lock.json';
import dynlibModules from '../../../../examples/cloudflare-worker/assets/pyodide/dynlibs.mjs';
import sigModules from '../../../../examples/cloudflare-worker/assets/pyodide/sigs.mjs';
import wheels from '../../../../examples/cloudflare-worker/assets/pyodide/wheels.mjs';
import { bootPyodide, installWheel } from '../../../../examples/cloudflare-worker/src/boot-pyodide.mjs';

let booting = null;
async function boot() {
  const t0 = Date.now();
  globalThis.__csSigModules = sigModules;
  globalThis.__csSigSeen = new Set();
  const py = await bootPyodide({ loadPyodide, createPyodideModule, asmModule, trampolineModule,
    dynlibModules, stdlib, lock });
  const t1 = Date.now();
  await installWheel(py, wheels['numpy-lite.zip'], 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl');
  const t2 = Date.now();
  py.runPython('import numpy');
  const t3 = Date.now();
  return { py, timings: { loadPyodideMs: t1 - t0, numpyInstallMs: t2 - t1, numpyImportMs: t3 - t2 } };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      const cold = !booting;
      if (!booting) { booting = boot(); }
      const { py, timings } = await booting;
      const code = url.searchParams.get('code') || 'import sys, numpy\nf"{sys.version.split()[0]} numpy {numpy.__version__} det={numpy.linalg.det(numpy.eye(3)*2)}"';
      const t = Date.now();
      const out = String(py.runPython(code));
      const denied = {};
      try { new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); denied.wasmCompile = false; }
      catch (e) { denied.wasmCompile = String(e.message || e); }
      try { (0, eval)('1'); denied.eval = false; } catch (e) { denied.eval = String(e.message || e); }
      return Response.json({ ok: true, cold, out, denied, runMs: Date.now() - t, timings,
        pyodideHeapMB: +(py._module.HEAPU8.length / 1048576).toFixed(1),
        missingSigs: [...globalThis.__csSigSeen] });
    } catch (e) {
      return Response.json({ ok: false, error: String(e && e.stack || e) }, { status: 500 });
    }
  },
};
