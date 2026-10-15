// record-sigs.mjs — boot the PATCHED glue unrestricted in plain Node (Node
// mode) and record every addFunction signature that had no precompiled
// module (-> sigs.json, which prep.mjs turns into sig/<sig>.wasm). The set is
// fixed by the main module's and numpy's GOT entries, so one boot + numpy
// import covers it.
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const B = join(HERE, '..', '..', '..', 'examples', 'cloudflare-worker', 'assets', 'pyodide') + '/';
const V = join(HERE, '..', '..', '..', 'vendor', 'pyodide') + '/';
const manifest = JSON.parse(fs.readFileSync(B + 'manifest.json', 'utf8'));
globalThis.__csSigSeen = new Set();
globalThis.__csDynlibModules = {};
for (const d of manifest.dynlibs) { globalThis.__csDynlibModules[d.name] = new WebAssembly.Module(fs.readFileSync(B + 'dynlib/' + d.name + '.wasm')); }
const { loadPyodide } = await import(pathToFileURL(B + 'pyodide.mjs').href);
const factory = (await import(pathToFileURL(B + 'pyodide.asm.mjs').href)).default;
const py = await loadPyodide({ indexURL: V, createPyodideModule: factory });
await py._api.install(new Uint8Array(fs.readFileSync(B + 'wheels/numpy-lite.zip')), 'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl',
  py._api.sitePackages, new Map([['INSTALLER', 'cs']]));
py.runPython('import numpy, numpy.linalg, numpy.random, numpy.fft; numpy.linalg.det(numpy.eye(3)); numpy.random.default_rng(1).random(3)');
const sigs = [...globalThis.__csSigSeen].sort();
fs.writeFileSync(join(HERE, '..', '..', '..', 'examples', 'cloudflare-worker', 'scripts', 'pyodide-sigs.json'), JSON.stringify(sigs));
console.log(sigs.length + ' signatures:', sigs.join(' '));
