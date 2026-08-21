// PyodideRealB123d.js — run REAL, UNMODIFIED build123d 0.11.1 (the actual
// PyPI wheel: real CPython semantics, real numpy, native metaclasses/typing,
// ZERO source transforms, ZERO stdlib shims) on the Pyodide runtime, with
// the OCP-over-embind shim (OcpShim.js + upstream-py/ocp_shim/) as the ONLY
// substitution.
//
// Opt-in via `?pyruntime=pyodide&pysrc=real` (localStorage
// 'cascade-py-src' = 'real' on the pyodide runtime). NOTHING here loads in
// any other mode. This is the reference/crossover leg of the runtime
// comparison (test/b123d-validation/runtime-comparison.md): it measures the
// "just shim the externals" architecture head-to-head against build123d-lite
// and the MicroPython pytopo=upstream stack.
//
// What it installs, in order:
//   1. wheels: numpy + typing_extensions (Pyodide CDN builds, vendored into
//      vendor/pyodide/ by scripts/fetch-pyodide.cjs) and the PURE wheels
//      build123d 0.11.1 / anytree / webcolors / trianglesolver (PyPI,
//      vendored the same way). All served from dist — no network at runtime.
//   2. the OCP package: inert stubs for every module build123d imports
//      (ocp_import_map.json — Standard/StdFail as real Exception classes),
//      then the GENERATED proxy modules (ocp_shim/OCP/*.py + _registry.py)
//      over ocp_core_pyodide.py (the Pyodide call layer; the dispatch table,
//      defaults and generated proxies are SHARED with the MicroPython leg).
//   3. import-satisfying stubs for the heavyweight/unbuildable third-party
//      deps (real-deps/MANIFEST.json: ezdxf, svgpathtools, ocpsvg,
//      fontTools.ttLib, lib3mf, sklearn.cluster, requests, IPython.lib.pretty,
//      sympy, ocp_gordon) — each raises loudly on USE.
//   4. build123d-lite as the module `build123d_lite` (the glue's kernel-op
//      library: opentype.js text, GordonSurface.js).
//   5. `import build123d` — the real package, verbatim.
//   6. ocp_shim/real_glue.py — the worker glue (show/scene/measure/export,
//      make_text + gordon routing, joints reparenting, reset hook).

import { installOcpShim } from './OcpShim.js';
import { BUILD123D_LITE_PY } from './Build123dLite.js';

/** Pure wheels vendored into vendor/pyodide/ (fetch-pyodide.cjs pins the
 *  same versions). numpy/typing_extensions ride the pyodide-lock instead. */
export const REAL_WHEELS = [
  'build123d-0.11.1-py3-none-any.whl',
  'anytree-2.13.0-py3-none-any.whl',
  'webcolors-24.8.0-py3-none-any.whl',
  'trianglesolver-1.2-py3-none-any.whl',
];

const OCP_STUBS_PY = `
import json, os, sys
os.makedirs('/lib/OCP', exist_ok=True)
if '/lib' not in sys.path:
    sys.path.insert(0, '/lib')
open('/lib/OCP/__init__.py', 'w').close()
for _mod, _names in json.loads(_CS_OCP_MAP).items():
    if _mod in ('Standard', 'StdFail'):
        # these names appear in except clauses: real Exception subclasses
        _body = '\\n'.join('class ' + n + '(Exception):\\n    pass'
                           for n in _names) + '\\n'
    elif _mod == 'GccEnt':
        _body = '\\n'.join(n + ' = ' + str(i)
                           for i, n in enumerate(_names)) + '\\n'
    else:
        _body = ('class _Any:\\n'
                 '    def __init__(self, *a, **k):\\n        pass\\n'
                 '    def __call__(self, *a, **k):\\n        return _Any()\\n'
                 '    def __getattr__(self, n):\\n        return _Any()\\n'
                 + '\\n'.join(n + ' = _Any' for n in _names) + '\\n')
    with open('/lib/OCP/' + _mod + '.py', 'w') as _f:
        _f.write(_body)
`;

/**
 * Bootstrap real build123d over an already-initialized Pyodide.
 * @param pyodide        the loadPyodide result
 * @param registerModule bridge register_module(name, source) (PyodideRuntime)
 * @param indexURL       dist/pyodide/ base URL (wheels live there)
 */
export async function bootstrapPyodideRealB123d(pyodide, registerModule, indexURL) {
  const fetchOnce = async (rel) => {
    const url = typeof ESBUILD !== 'undefined'
      ? new URL('./upstream-b123d/' + rel, self.location.href).href
      : new URL('../../upstream-py/' + rel, import.meta.url).href;
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = new Error('pysrc=real: could not load ' + rel + ' (' +
        resp.status + '). Is the upstream-b123d payload in dist?');
      err._csPermanent = resp.status === 404;
      throw err;
    }
    return resp.text();
  };
  const fetchText = async (rel) => {
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await fetchOnce(rel);
      } catch (e) {
        lastErr = e;
        if (e && e._csPermanent) { break; }
        await new Promise((res) => setTimeout(res, 150 * (attempt + 1)));
      }
    }
    throw lastErr;
  };

  const say = (m) => console.log('[pysrc=real] ' + m);
  const t0 = performance.now();

  // 1. wheels (all vendored; loadPackage resolves lock names against
  //    indexURL, URL wheels are fetched directly)
  const quiet = { messageCallback: () => {} };
  await pyodide.loadPackage(['numpy', 'typing-extensions'], quiet);
  await pyodide.loadPackage(REAL_WHEELS.map((f) => indexURL + f), quiet);
  const tWheels = performance.now();

  // 2. the OCP package: inert stubs, then the generated shim modules
  pyodide.globals.set('_CS_OCP_MAP', await fetchText('ocp_import_map.json'));
  pyodide.runPython(OCP_STUBS_PY);
  const shimManifest = JSON.parse(await fetchText('ocp_shim/MANIFEST.json'));
  installOcpShim(self, JSON.parse(await fetchText('ocp_shim/table.json')));
  registerModule('ocp_core', await fetchText('ocp_shim/ocp_core_pyodide.py'));
  registerModule('ocp_registry', await fetchText('ocp_shim/_registry.py'));
  for (const mod of shimManifest.modules) {
    const src = await fetchText('ocp_shim/OCP/' + mod + '.py');
    pyodide.FS.writeFile('/lib/OCP/' + mod + '.py', src);
  }
  say('OCP shim installed (' + shimManifest.classCount + ' classes, '
    + shimManifest.modules.length + ' generated modules over '
    + 'the inert stub set)');

  // 3. third-party stubs (each raises loudly on USE — see the manifest)
  const depManifest = JSON.parse(await fetchText('real-deps/MANIFEST.json'));
  for (const entry of depManifest.modules) {
    const src = entry.file ? await fetchText(entry.file) : 'pass\n';
    registerModule(entry.name, src);
  }

  // 4. lite as the glue's kernel-op library
  registerModule('build123d_lite', BUILD123D_LITE_PY);
  const tPrep = performance.now();

  // 4b. OCP-layer stand-ins that must precede the package import
  //     (COMPROMISE(kernel-fonts): text.py runs a FontManager at module
  //     level — see real_preglue.py)
  registerModule('real_preglue', await fetchText('ocp_shim/real_preglue.py'));

  // 5. REAL build123d, verbatim from the wheel
  pyodide.runPython('import build123d');
  const tImport = performance.now();

  // 6. the worker glue
  registerModule('real_glue', await fetchText('ocp_shim/real_glue.py'));

  const tDone = performance.now();
  say('REAL build123d 0.11.1 ready: wheels '
    + (tWheels - t0).toFixed(0) + ' ms, shim+stubs '
    + (tPrep - tWheels).toFixed(0) + ' ms, import build123d '
    + (tImport - tPrep).toFixed(0) + ' ms, glue '
    + (tDone - tImport).toFixed(0) + ' ms');
}
