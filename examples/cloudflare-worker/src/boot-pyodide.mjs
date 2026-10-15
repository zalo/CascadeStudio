// boot-pyodide.mjs — bring Pyodide 314 up from module bindings only: no
// fetch of a URL, no dynamic import, no WebAssembly compilation, no eval.
// Host-agnostic: the Worker passes workerd's bindings, the Node test passes
// modules it compiled up front (before it locks code generation down).
//
//   const py = await bootPyodide({
//     loadPyodide,            // from pyodide.mjs (static import)
//     createPyodideModule,    // default export of the patched pyodide.asm.mjs
//     asmModule,              // WebAssembly.Module of pyodide.asm.wasm
//     trampolineModule,       // WebAssembly.Module of pyemtrampoline.wasm (optional)
//     dynlibModules,          // { '<name>.so': WebAssembly.Module }
//     stdlib,                 // ArrayBuffer of python_stdlib.zip
//     lock,                   // parsed pyodide-lock.json
//   });
//   await installWheel(py, bytes, 'numpy-lite.zip')
const FAKE_ORIGIN = 'https://cs-pyodide.invalid/';

export async function bootPyodide(o) {
  // pyodide.mjs resolves its own file URLs against `location` (undefined in
  // workerd) and loads python_stdlib.zip through fetch(); give it a base and
  // answer that one URL from memory.
  if (typeof globalThis.location === 'undefined') {
    globalThis.location = new URL(FAKE_ORIGIN);
  }
  const files = { [FAKE_ORIGIN + 'python_stdlib.zip']: o.stdlib };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && input.url));
    if (url && url.startsWith(FAKE_ORIGIN)) {
      const body = files[url];
      if (!body) { return new Response('not bundled: ' + url, { status: 404 }); }
      return new Response(body, { status: 200 });
    }
    return realFetch(input, init);
  };
  // Emscripten's setImmediate polyfill falls back to a capturing 'message'
  // listener, which workerd rejects ("useCapture must be false").
  if (typeof globalThis.setImmediate !== 'function') {
    globalThis.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
    globalThis.clearImmediate = (id) => clearTimeout(id);
  }
  globalThis.__csDynlibModules = o.dynlibModules || {};
  if (o.trampolineModule) { globalThis.__csPyEMTrampoline = o.trampolineModule; }

  const createPyodideModule = (settings) => {
    // pyodide.mjs installs an instantiateWasm hook that compiles
    // pyodide.asm.wasm from bytes. Replace it: instantiate the precompiled
    // Module, and provide the two imports its hook would have added (the
    // pure-JS fallback of getJsvErrorImport).
    settings.instantiateWasm = (imports, receive) => {
      const marker = Symbol('error marker');
      imports.env.Jsv_GetError_import = () => marker;
      imports.env.JsvError_Check = (v) => v === marker;
      WebAssembly.instantiate(o.asmModule, imports).then(
        (instance) => receive(instance, o.asmModule),
        (e) => { console.error('pyodide.asm.wasm instantiation failed', e); });
      return {};
    };
    return o.createPyodideModule(settings);
  };
  const t0 = Date.now();
  const py = await o.loadPyodide({
    indexURL: FAKE_ORIGIN,
    stdLibURL: FAKE_ORIGIN + 'python_stdlib.zip',
    lockFileContents: o.lock,
    createPyodideModule,
    checkAPIVersion: true,
    stdout: o.stdout || ((l) => console.log(l)),
    stderr: o.stderr || ((l) => console.log('[py-stderr] ' + l)),
  });
  py._csBootMs = Date.now() - t0;
  return py;
}

/** Install a wheel (or a stripped wheel zip) from bytes into site-packages
 *  and load its shared libraries (through the precompiled-dynlib patch).
 *  `filename` must look like a wheel name: Pyodide derives the archive
 *  format from it. This is Pyodide's own package-install path (API.install =
 *  unpack_buffer(calculate_dynlibs=True) + loadDynlibsFromPackage). */
export async function installWheel(py, bytes, filename) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const api = py._api;
  await api.install(buf, filename, api.sitePackages,
    new Map([['INSTALLER', 'cascade-workerd']]));
  return filename;
}
