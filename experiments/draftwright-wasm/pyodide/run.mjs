// Feasibility probe: draftwright on the REAL build123d flavor (Pyodide +
// build123d 0.13.0 wheel + the OCP-over-embind shim), headless in Node.
//   DW_WHEELS=<dir> node experiments/draftwright-wasm/pyodide/run.mjs [stage...]
// DW_WHEELS holds the wheels/zips named in EXTRA (README.md); DW_GEN_SHIM, if
// set, is a directory holding an ocp_shim/ + ocp_import_map.json regenerated
// with draftwright's OCP names billed (README.md).
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MB = 1048576;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DIST = join(ROOT, 'packages', 'cascade-core', 'dist');
// prepared by examples/cloudflare-worker/scripts/prepare-pyodide.mjs and fetch-pyodide.cjs
const PB = (process.env.DW_PYODIDE_ASSETS || join(ROOT, 'examples', 'cloudflare-worker', 'assets', 'pyodide')) + '/';
const INDEX = (process.env.DW_PYODIDE_INDEX || join(ROOT, 'vendor', 'pyodide')) + '/';
const WH = process.env.DW_WHEELS + '/';
// real packages replace these import stubs (real-deps/MANIFEST.json)
const UNSTUB = (process.env.UNSTUB || 'ezdxf,svgpathtools,fontTools').split(',').filter(Boolean);
const EXTRA = [
  'pyparsing-3.3.2-py3-none-any.whl', 'fonttools-4.62.1-py3-none-any.whl',
  'ezdxf-1.4.5-py3-none-any.whl', 'svgwrite-1.4.3-py3-none-any.whl',
  'svgpathtools-1.8.0-py2.py3-none-any.whl', 'antlr4-src.zip', 'steputils-0.1-py3-none-any.whl',
  'quiddity-0.3.10-py3-none-any.whl', 'build123d_drafting_helpers-0.15.5-py3-none-any.whl',
  'charset_normalizer-3.5.2-py3-none-any.whl', 'pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl',
  'reportlab-5.0.1-py3-none-any.whl', 'webencodings-0.5.1-py2.py3-none-any.whl',
  'tinycss2-1.5.1-py3-none-any.whl', 'cssselect2-0.10.1-py3-none-any.whl',
  'lxml-6.0.2-cp314-cp314-pyemscripten_2026_0_wasm32.whl', 'svglib-2.3.0-py3-none-any.whl',
  'draftwright-src.zip',
];

const pman = JSON.parse(fs.readFileSync(PB + 'manifest.json', 'utf8'));
globalThis.__csDynlibModules = {};
for (const d of pman.dynlibs) {
  globalThis.__csDynlibModules[d.name] = new WebAssembly.Module(fs.readFileSync(PB + 'dynlib/' + d.name + '.wasm'));
}
const { loadPyodide } = await import(pathToFileURL(PB + 'pyodide.mjs').href);
const createPyodideModule = (await import(pathToFileURL(PB + 'pyodide.asm.mjs').href)).default;
const WHEELS = { numpy: ['numpy-lite.zip', 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl'],
  'typing-extensions': ['typing_extensions-4.15.0-py3-none-any.whl'] };
let PY = null;
let extraBytes = 0;
const pyodideHost = {
  boot: ({ stdout, stderr }) => loadPyodide({ indexURL: INDEX, createPyodideModule, stdout, stderr }),
  async installWheels(py, names) {
    PY = py;
    for (const n of names) {
      const [file, asName] = WHEELS[n] || [n];
      await py._api.install(new Uint8Array(fs.readFileSync(PB + 'wheels/' + file)), asName || file,
        py._api.sitePackages, new Map([['INSTALLER', 'cascade-headless']]));
    }
    for (const f of EXTRA) {
      const bytes = fs.readFileSync(WH + f);
      extraBytes += bytes.length;
      py.unpackArchive(new Uint8Array(bytes), 'zip', { extractDir: py._api.sitePackages });
    }
    py.FS.writeFile('/tmp/all-ocp.json', fs.readFileSync(join(HERE, 'all-ocp.json')));
  },
};
const fonts = {};
for (const f of fs.readdirSync(join(DIST, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(DIST, 'fonts', f)); }
}
const upstreamPy = async (rel) => {
  const GEN = (process.env.DW_GEN_SHIM || '/nonexistent') + '/';
  const genPath = rel === 'ocp_import_map.json' ? GEN + rel : rel.startsWith('ocp_shim/') ? GEN + rel : null;
  const txt = (process.env.GENSHIM !== '0' && genPath && fs.existsSync(genPath))
    ? fs.readFileSync(genPath, 'utf8') : fs.readFileSync(join(DIST, 'upstream-b123d', rel), 'utf8');
  if (rel === 'real-deps/MANIFEST.json') {
    const m = JSON.parse(txt);
    m.modules = m.modules.filter((e) => !UNSTUB.some((u) => e.name === u || e.name.startsWith(u + '.')));
    return JSON.stringify(m);
  }
  return txt;
};
const { createHeadlessCascade } = await import(pathToFileURL(join(DIST, 'cascade-headless.mjs')).href);
const mem = (engine, tag) => {
  const m = engine.memoryStats();
  console.log(`[mem] ${tag}: occt ${(m.occtWasm / MB).toFixed(1)} MB, python ${(m.pythonWasm / MB).toFixed(1)} MB, `
    + `JS heap ${(process.memoryUsage().heapUsed / MB).toFixed(1)} MB, arrayBuffers ${(process.memoryUsage().arrayBuffers / MB).toFixed(1)} MB`);
};
const t0 = Date.now();
const engine = await createHeadlessCascade({
  runtime: 'pyodide', pyodide: pyodideHost, pySrc: 'real', occtWasm: fs.readFileSync(join(DIST, 'cascadestudio.wasm')),
  fonts, upstreamPy,
});
console.log(`[boot] ${Date.now() - t0} ms (extra packages ${(extraBytes / MB).toFixed(1)} MB compressed)`);
mem(engine, 'after boot');

const stages = process.argv.slice(2).length ? process.argv.slice(2) : ['import', 'plate'];
const code = {
  import: fs.readFileSync(join(HERE, 'prelude.py'), 'utf8') + fs.readFileSync(join(HERE, 'polyfill.py'), 'utf8') + `
import time, traceback
t = time.time()
try:
    import draftwright
    from draftwright import build_drawing, make_drawing
    print('DW_OK import draftwright %.2f s' % (time.time() - t))
except BaseException as e:
    print('DW_FAIL import'); traceback.print_exc()
` + fs.readFileSync(join(HERE, 'post-import.py'), 'utf8'),
  plate: `
import time, traceback
from build123d import Box, Cylinder, Pos
part = (Box(100, 70, 24) - Pos(0, 0, 0) * Cylinder(9, 40) - Pos(0, 0, 8) * Cylinder(15, 20)
        - Pos(-38, 24, 0) * Cylinder(4, 40) - Pos(38, 24, 0) * Cylinder(4, 40)
        - Pos(-38, -24, 0) * Cylinder(4, 40) - Pos(38, -24, 0) * Cylinder(4, 40))
import logging
class _H(logging.Handler):
    seen = {}
    def emit(self, r):
        m = r.getMessage()
        if 'element failed to convert' in m:
            k = m.split('convert: ', 1)[-1][:160]
            _H.seen[k] = _H.seen.get(k, 0) + 1
logging.getLogger('draftwright').addHandler(_H()); logging.getLogger('draftwright').setLevel(logging.DEBUG)
t = time.time()
try:
    from draftwright import build_drawing
    dwg = build_drawing(part, title='Mounting Plate', number='DWG-001')
    print('DW_OK build_drawing %.2f s' % (time.time() - t))
    t = time.time()
    issues = dwg.lint()
    print('DW_OK lint %.2f s: %d issues' % (time.time() - t, len(issues)))
    for i in issues[:8]:
        print('   lint', i.severity, i.code, str(i.message)[:120])
    for fmt in ('svg', 'dxf', 'pdf'):
        t = time.time()
        try:
            paths = dwg.export('/tmp/plate', formats=(fmt,))
            import os
            print('DW_OK export %s %.2f s %s %d bytes' % (fmt, time.time() - t, paths[fmt], os.path.getsize(paths[fmt])))
        except BaseException as e:
            print('DW_FAIL export', fmt); traceback.print_exc()
except BaseException as e:
    print('DW_FAIL plate'); traceback.print_exc()
import builtins
print('ELEMENT FAILURES:', _H.seen)
print('OCP placeholders CALLED:', sorted(set(builtins._CS_OCP_PH_USED)), 'SKIPPED:', sorted(set(builtins._CS_SKIPPED)))
`,
};
for (const s of stages) {
  const t1 = Date.now();
  const r = await engine.run(code[s] || fs.readFileSync(s, 'utf8'), { language: 'python', mesh: false });
  console.log(`--- stage ${s}: ${Date.now() - t1} ms, ok=${r.ok}`);
  for (const l of r.logs || []) { console.log('  ' + l); }
  for (const e of r.errors || []) { console.log('  ERR ' + String(e).slice(0, 3000)); }
  mem(engine, 'after ' + s);
}
for (const f of ['/tmp/plate.svg', '/tmp/plate.dxf', '/tmp/plate.pdf']) {
  try {
    const b = PY.FS.readFile(f);
    fs.mkdirSync(join(HERE, 'out'), { recursive: true });
    fs.writeFileSync(join(HERE, 'out', f.slice(5)), b);
    console.log('[out] ' + f + ' ' + b.length + ' bytes -> ' + join(HERE, 'out', f.slice(5)));
  } catch (e) { /* not produced */ }
}
