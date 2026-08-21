/**
 * Fetch the Pyodide **core** distribution into `vendor/pyodide/` (gitignored).
 *
 * Pyodide is the EXPERIMENTAL alternative Python runtime for build123d-lite
 * (`?pyruntime=pyodide`); Brython remains the default. The core tarball is the
 * smallest official bundle — the interpreter plus the Python stdlib, with no
 * packages (no numpy/scipy) — which is the only variant that is even in the
 * same conversation as Brython on size.
 *
 * It is NOT an npm dependency on purpose: ~13.5 MB of wasm/zip has no business
 * in node_modules (or in git) for an experiment that is off by default. The
 * build copies `vendor/pyodide/` into dist only when it exists, so a checkout
 * without it builds and runs exactly as before.
 *
 *   node packages/cascade-core/scripts/fetch-pyodide.cjs [version]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VERSION = process.argv[2] || '314.0.4';
const monoRoot = path.join(__dirname, '..', '..', '..');
const vendorDir = path.join(monoRoot, 'vendor', 'pyodide');

// Only what loadPyodide actually fetches at runtime; the tarball also carries
// CLI entry points and .d.ts files that would just bloat dist.
const RUNTIME_FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

// pysrc=real (REAL build123d 0.11.1 over the OCP shim on Pyodide —
// PyodideRealB123d.js) additionally needs these wheels next to the core
// files. numpy/typing_extensions come from the Pyodide CDN matching the
// vendored version; the pure wheels come from PyPI via `pip download`
// (version-pinned; PyodideRealB123d.REAL_WHEELS lists the same names).
const CDN_WHEELS = [
  'numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl',
  'typing_extensions-4.15.0-py3-none-any.whl',
];
const PYPI_WHEELS = {
  'build123d-0.11.1-py3-none-any.whl': 'build123d==0.11.1',
  'anytree-2.13.0-py3-none-any.whl': 'anytree==2.13.0',
  'webcolors-24.8.0-py3-none-any.whl': 'webcolors==24.8.0',
  'trianglesolver-1.2-py3-none-any.whl': 'trianglesolver==1.2',
};

function fetchWheels() {
  const cdnBase = 'https://cdn.jsdelivr.net/pyodide/v' + VERSION + '/full/';
  for (const wheel of CDN_WHEELS) {
    const dst = path.join(vendorDir, wheel);
    if (fs.existsSync(dst)) { continue; }
    console.log('[pyodide] downloading ' + cdnBase + wheel);
    execFileSync('curl', ['-sL', cdnBase + wheel, '-o', dst], { stdio: 'inherit' });
  }
  const missing = Object.entries(PYPI_WHEELS)
    .filter(([wheel]) => !fs.existsSync(path.join(vendorDir, wheel)));
  if (missing.length > 0) {
    console.log('[pyodide] pip download ' + missing.map(([, s]) => s).join(' '));
    execFileSync('pip', ['download', '--no-deps', '-d', vendorDir,
      ...missing.map(([, spec]) => spec)], { stdio: 'inherit' });
  }
}

if (RUNTIME_FILES.every((f) => fs.existsSync(path.join(vendorDir, f)))) {
  fetchWheels();
  console.log('[pyodide] already present in ' + vendorDir);
  process.exit(0);
}

const url = 'https://github.com/pyodide/pyodide/releases/download/' +
  VERSION + '/pyodide-core-' + VERSION + '.tar.bz2';
const tmp = path.join(monoRoot, 'vendor', 'pyodide-core.tar.bz2');
fs.mkdirSync(path.join(monoRoot, 'vendor'), { recursive: true });
console.log('[pyodide] downloading ' + url);
execFileSync('curl', ['-sL', url, '-o', tmp], { stdio: 'inherit' });

const extractDir = path.join(monoRoot, 'vendor', '.pyodide-extract');
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });
execFileSync('tar', ['xjf', tmp, '-C', extractDir], { stdio: 'inherit' });

fs.mkdirSync(vendorDir, { recursive: true });
for (const file of RUNTIME_FILES) {
  fs.copyFileSync(path.join(extractDir, 'pyodide', file), path.join(vendorDir, file));
}
fs.rmSync(extractDir, { recursive: true, force: true });
fs.rmSync(tmp, { force: true });
fetchWheels();

let total = 0;
for (const file of RUNTIME_FILES) { total += fs.statSync(path.join(vendorDir, file)).size; }
console.log('[pyodide] ' + VERSION + ' ready in ' + vendorDir +
  ' (' + (total / 1048576).toFixed(1) + ' MB raw)');
