// node-real.mjs — REAL build123d (pysrc=real) on Pyodide through the HEADLESS
// engine in plain Node, using the same host seam a Worker uses
// (createHeadlessCascade({runtime: 'pyodide', pySrc: 'real', pyodide: {boot,
// installWheels}})) and the prepared build (patched glue, numpy-lite with
// precompiled side modules). Reports memory per model.
//
//   (cd examples/cloudflare-worker && node scripts/prepare-pyodide.mjs)
//   node experiments/cf-fidelity/pyodide-workerd/node-real.mjs [manifest-id …]
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const B = join(HERE, '..', '..', '..', 'examples', 'cloudflare-worker', 'assets', 'pyodide') + '/';
const V = join(ROOT, 'vendor', 'pyodide') + '/';
const DIST = process.env.CF_DIST || join(ROOT, 'packages', 'cascade-core', 'dist');
const MB = 1048576;
const mb = (n) => (n / MB).toFixed(1);

const manifest = JSON.parse(fs.readFileSync(join(B, 'manifest.json'), 'utf8'));
const dynlibModules = {};
for (const d of manifest.dynlibs) {
  dynlibModules[d.name] = new WebAssembly.Module(fs.readFileSync(B + 'dynlib/' + d.name + '.wasm'));
}
globalThis.__csDynlibModules = dynlibModules;
const { loadPyodide } = await import(pathToFileURL(B + 'pyodide.mjs').href);
const createPyodideModule = (await import(pathToFileURL(B + 'pyodide.asm.mjs').href)).default;

const WHEEL_FILES = {
  numpy: ['numpy-lite.zip', 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl'],
  'typing-extensions': ['typing_extensions-4.15.0-py3-none-any.whl'],
};
const pyodideHost = {
  async boot({ stdout, stderr }) {
    return loadPyodide({ indexURL: V, createPyodideModule, stdout, stderr });
  },
  async installWheels(py, names) {
    for (const n of names) {
      const [file, asName] = WHEEL_FILES[n] || [n];
      const bytes = new Uint8Array(fs.readFileSync(B + 'wheels/' + file));
      await py._api.install(bytes, asName || file, py._api.sitePackages,
        new Map([['INSTALLER', 'cascade-headless']]));
    }
  },
};

const fonts = {};
for (const f of fs.readdirSync(join(DIST, 'fonts'))) {
  if (f.endsWith('.ttf')) { fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(join(DIST, 'fonts', f)); }
}
const { createHeadlessCascade } = await import(pathToFileURL(join(DIST, 'cascade-headless.mjs')).href);
const t0 = Date.now();
const engine = await createHeadlessCascade({
  runtime: 'pyodide', pySrc: 'real', occtWasm: fs.readFileSync(join(DIST, 'cascadestudio.wasm')), fonts,
  pyodide: pyodideHost,
  upstreamPy: async (rel) => fs.readFileSync(join(DIST, 'upstream-b123d', rel), 'utf8'),
});
console.log('engine boot ' + (Date.now() - t0) + ' ms');

const corpus = JSON.parse(fs.readFileSync(join(ROOT, 'test/b123d-validation/manifest.json'), 'utf8'));
const jobs = [['box', 'from build123d import *\nb = Box(10, 10, 10)\nprint("volume:", b.volume)\nshow(b)']];
for (const id of process.argv.slice(2)) { jobs.push([id, corpus.find((x) => x.id === id).code]); }
for (const [name, code] of jobs) {
  const t1 = Date.now();
  const r = await engine.run(code, { language: 'python', mesh: false });
  const m = engine.memoryStats();
  const meas = engine.measure();
  console.log(`${name}: ok=${r.ok} ${Date.now() - t1} ms shapes=${r.shapeCount} vol=${meas ? meas.volume.toFixed(3) : '-'}`
    + `  occt ${mb(m.occtWasm)} + pyodide ${mb(m.pythonWasm)} = ${mb(m.occtWasm + m.pythonWasm)} MB`
    + `  js heap ${mb(process.memoryUsage().heapUsed)} MB`
    + (r.ok ? '' : '\n   ' + r.errors.join('\n   ').slice(0, 1500)));
  if (name === 'box') { console.log('   boot timing ' + JSON.stringify(globalThis.self._pythonBootTiming)); }
  if (r.ok) {
    try { const s = engine.exportSTEP(); console.log('   step ' + s.length + ' bytes'); } catch (e) { console.log('   STEP failed ' + e.message); }
  }
  engine.reset();
}
process.exit(0);
