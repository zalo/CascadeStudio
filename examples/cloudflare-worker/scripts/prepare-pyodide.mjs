// prepare-pyodide.mjs — turn the vendored Pyodide 314 core + the pysrc=real
// wheels into something workerd can boot WITHOUT compiling WebAssembly or
// evaluating strings at runtime (the `--env real` flavor; see
// FIDELITY-ON-WORKERS.md).
//
//   node packages/cascade-core/scripts/fetch-pyodide.cjs   # repo root, once
//   node scripts/prepare-pyodide.mjs [outDir]
//
// Output (default ./assets/pyodide, gitignored — module bindings of the
// `real` entry, src/real.js):
//   pyodide.mjs              loader, unchanged
//   pyodide.asm.mjs          Emscripten glue, two surgical patches (below)
//   pyodide.asm.wasm         interpreter (-> CompiledWasm module binding)
//   pyemtrampoline.wasm      CPython's call trampoline, extracted from the hex
//                            string the glue would otherwise compile at boot
//   python_stdlib.zip        stdlib (-> Data binding, written to MEMFS)
//   dynlib/<so>.wasm         every numpy side module, as its own .wasm file
//                            (-> CompiledWasm bindings, keyed by .so name)
//   wheels/numpy-lite.zip    numpy's Python half: the .so files replaced by
//                            0-byte placeholders (dlopen still has to FIND the
//                            path), tests/ dropped
//   wheels/*.whl             the pure wheels, unchanged
//   manifest.json            sizes + the dynlib name list
//
// The glue patches (each asserted to apply exactly once):
//  1. loadDynamicLibrary's loadLibData(): when globalThis.__csDynlibModules
//     has a precompiled WebAssembly.Module for the library's basename, hand
//     THAT to loadWebAssemblyModule (which already accepts a Module) instead
//     of the bytes read from MEMFS. Emscripten otherwise does
//     WebAssembly.instantiate(bytes) — runtime compilation, which workerd
//     forbids.
//  2. getWasmTrampolineModule(): prefer globalThis.__csPyEMTrampoline (a
//     precompiled module of the same bytes). Without it the glue's own
//     try/catch falls back to the slower JS trampoline (the iOS path), so
//     this one is a speed patch, not a correctness one.
import fs from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'pyodide');
const OUT = process.argv[2] || join(HERE, '..', 'assets', 'pyodide');
if (!fs.existsSync(join(VENDOR, 'pyodide.asm.wasm'))) {
  console.error('vendor/pyodide is missing — run `node packages/cascade-core/scripts/fetch-pyodide.cjs` in the repo root first.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(join(OUT, 'dynlib'), { recursive: true });
fs.mkdirSync(join(OUT, 'wheels'), { recursive: true });

for (const f of ['pyodide.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip']) {
  fs.copyFileSync(join(VENDOR, f), join(OUT, f));
}

// ---- glue patches -------------------------------------------------------
let glue = fs.readFileSync(join(VENDOR, 'pyodide.asm.mjs'), 'utf8');
const once = (label, from, to) => {
  const n = glue.split(from).length - 1;
  if (n !== 1) { throw new Error(`patch ${label}: expected 1 match, found ${n}`); }
  glue = glue.replace(from, to);
};
once('dynlib',
  'var f=findLibraryFS(libName,flags.rpath);if(f){var libData=FS.readFile(f,{encoding:"binary"});',
  'var f=findLibraryFS(libName,flags.rpath);if(f){var __csPre=globalThis.__csDynlibModules&&'
  + 'globalThis.__csDynlibModules[f.split("/").pop()];var libData=__csPre||FS.readFile(f,{encoding:"binary"});');
const tm = glue.match(/function getWasmTrampolineModule\(\)\{return new WebAssembly\.Module\(hexStringToUTF8Array\("([0-9a-f]+)"\)\)\}/);
if (!tm) { throw new Error('trampoline module not found'); }
fs.writeFileSync(join(OUT, 'pyemtrampoline.wasm'), Buffer.from(tm[1], 'hex'));
once('trampoline', tm[0], tm[0].replace('{return new WebAssembly.Module(',
  '{return globalThis.__csPyEMTrampoline||new WebAssembly.Module('));
// 3. convertJsFunctionToWasm(): addFunction() wraps a JS function as a wasm
//    function by compiling a tiny module whose bytes depend ONLY on the
//    signature. dylink does this for every GOT entry a JS library function
//    satisfies (the main module's own, at boot). Prefer a precompiled module
//    per signature (globalThis.__csSigModules, keyed with p->i since both are
//    i32 in wasm32); record any signature that has none.
once('sigs',
  'var convertJsFunctionToWasm=(func,sig)=>{',
  'var convertJsFunctionToWasm=(func,sig)=>{var __csK=sig.replace(/p/g,"i");var __csM=globalThis.__csSigModules&&'
  + 'globalThis.__csSigModules[__csK];if(__csM){return new WebAssembly.Instance(__csM,{e:{f:func}}).exports["f"]}'
  + 'if(globalThis.__csSigSeen){globalThis.__csSigSeen.add(__csK)}');
fs.writeFileSync(join(OUT, 'pyodide.asm.mjs'), glue);

// the signature modules (same byte construction as the glue's
// convertJsFunctionToWasm) for every signature sigs.json lists
// pyodide-sigs.json is recorded by experiments/cf-fidelity/pyodide-workerd/record-sigs.mjs
const SIGS = JSON.parse(fs.readFileSync(join(HERE, 'pyodide-sigs.json'), 'utf8'));
const uleb = (arr) => [arr.length % 128 | 128, arr.length >> 7, ...arr];
const codes = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
const pack = (t) => uleb(Array.from(t, (c) => codes[c]));
fs.mkdirSync(join(OUT, 'sig'), { recursive: true });
for (const sig of SIGS) {
  const bytes = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1,
    ...uleb([1, 96, ...pack(sig.slice(1)), ...pack(sig[0] === 'v' ? '' : sig[0])]),
    2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
  fs.writeFileSync(join(OUT, 'sig', sig + '.wasm'), bytes);
}

// ---- numpy: split the side modules out of the wheel ----------------------
const npWheel = fs.readdirSync(VENDOR).find((f) => f.startsWith('numpy-') && f.endsWith('.whl'));
const tmp = fs.mkdtempSync('/tmp/cs-np-');
execFileSync('unzip', ['-q', join(VENDOR, npWheel), '-d', tmp]);
const dynlibs = [];
// Unpacked wheels live in MEMFS, i.e. in JS ArrayBuffers that count against
// the isolate's 128 MB: drop what `import numpy` (and build123d) never reads
// — 2.4 of numpy's 5.5 MB of Python-side files.
const PRUNE_DIRS = new Set(['numpy/f2py', 'numpy/_core/include', 'numpy/_core/lib',
  'numpy/random/lib', 'numpy/_pyinstaller', 'numpy/doc', 'numpy/testing']);
const PRUNE_EXT = /\.(pyi|pxd|pyx|c|h|md|txt)$/;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'tests' || PRUNE_DIRS.has(p.slice(tmp.length + 1))) { fs.rmSync(p, { recursive: true, force: true }); continue; }
      walk(p);
    } else if (PRUNE_EXT.test(e.name) && !p.includes('.dist-info')) {
      fs.rmSync(p);                       // typing stubs, C headers/sources, docs
    } else if (e.name.endsWith('.so')) {
      const name = e.name;
      if (dynlibs.some((x) => x.name === name)) { throw new Error('duplicate .so basename ' + name); }
      fs.copyFileSync(p, join(OUT, 'dynlib', name + '.wasm'));
      dynlibs.push({ name, bytes: fs.statSync(p).size, path: p.slice(tmp.length + 1) });
      fs.writeFileSync(p, '');            // placeholder: dlopen must still FIND it
    }
  }
};
walk(tmp);
execFileSync('zip', ['-q', '-r', '-9', join(OUT, 'wheels', 'numpy-lite.zip'), '.'], { cwd: tmp });
fs.rmSync(tmp, { recursive: true, force: true });

// The pure wheels are exactly cascade-core's REAL_WHEELS (PyodideRealB123d.js
// is the one list; vendor/pyodide may also hold wheels of an older pin).
const realSrc = fs.readFileSync(join(ROOT, 'packages', 'cascade-core', 'src', 'worker', 'PyodideRealB123d.js'), 'utf8');
const pure = JSON.parse(realSrc.match(/export const REAL_WHEELS = (\[[^\]]*\])/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
for (const w of pure) {
  if (!fs.existsSync(join(VENDOR, w))) {
    console.error('vendor/pyodide/' + w + ' is missing — re-run packages/cascade-core/scripts/fetch-pyodide.cjs');
    process.exit(1);
  }
}
for (const w of pure) { fs.copyFileSync(join(VENDOR, w), join(OUT, 'wheels', w)); }

const size = (p) => fs.statSync(join(OUT, p)).size;
const manifest = {
  pyodide: JSON.parse(fs.readFileSync(join(VENDOR, 'pyodide-lock.json'), 'utf8')).info,
  dynlibs,
  wheels: ['numpy-lite.zip', ...pure],
  sizes: {
    'pyodide.asm.wasm': size('pyodide.asm.wasm'),
    'pyodide.asm.mjs': size('pyodide.asm.mjs'),
    'pyodide.mjs': size('pyodide.mjs'),
    'pyemtrampoline.wasm': size('pyemtrampoline.wasm'),
    'python_stdlib.zip': size('python_stdlib.zip'),
    dynlibs: dynlibs.reduce((a, d) => a + d.bytes, 0),
    wheels: ['numpy-lite.zip', ...pure].reduce((a, w) => a + size(join('wheels', w)), 0),
  },
};
manifest.sizes.total = Object.values(manifest.sizes).reduce((a, b) => a + b, 0);
fs.writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify(manifest.sizes, null, 1));

// ---- static-import index modules (workerd has no dynamic import of a URL,
// so every binding must be named in an import statement) --------------------
const ident = (s) => '_' + s.replace(/[^A-Za-z0-9]/g, '_');
let idx = '// generated by prep.mjs — precompiled numpy side modules, keyed by .so basename\n';
for (const d of dynlibs) { idx += `import ${ident(d.name)} from './dynlib/${d.name}.wasm';\n`; }
idx += 'export default {\n' + dynlibs.map((d) => `  ${JSON.stringify(d.name)}: ${ident(d.name)},\n`).join('') + '};\n';
fs.writeFileSync(join(OUT, 'dynlibs.mjs'), idx);
let widx = '// generated by prep.mjs — wheels as ArrayBuffers (Data bindings)\n';
for (const w of manifest.wheels) { widx += `import ${ident(w)} from './wheels/${w}';\n`; }
widx += 'export default {\n' + manifest.wheels.map((w) => `  ${JSON.stringify(w)}: ${ident(w)},\n`).join('') + '};\n';
fs.writeFileSync(join(OUT, 'wheels.mjs'), widx);
fs.copyFileSync(join(VENDOR, 'pyodide-lock.json'), join(OUT, 'pyodide-lock.json'));
let sidx = '// generated by prep.mjs — addFunction signature modules (see patch 3)\n';
for (const sig of SIGS) { sidx += `import s_${sig} from './sig/${sig}.wasm';\n`; }
sidx += 'export default {\n' + SIGS.map((sig) => `  ${sig}: s_${sig},\n`).join('') + '};\n';
fs.writeFileSync(join(OUT, 'sigs.mjs'), sidx);
