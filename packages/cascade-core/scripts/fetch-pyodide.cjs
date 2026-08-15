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

if (RUNTIME_FILES.every((f) => fs.existsSync(path.join(vendorDir, f)))) {
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

let total = 0;
for (const file of RUNTIME_FILES) { total += fs.statSync(path.join(vendorDir, file)).size; }
console.log('[pyodide] ' + VERSION + ' ready in ' + vendorDir +
  ' (' + (total / 1048576).toFixed(1) + ' MB raw)');
