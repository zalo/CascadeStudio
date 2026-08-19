/**
 * Build script for cascade-core.
 * Bundles the worker with esbuild, copies WASM + fonts.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..');
const monoRoot = path.join(pkgRoot, '..', '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const distDir = path.join(pkgRoot, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Regenerate the oc.* symbol manifest, then bundle the worker entry point
require('./generate-occt-symbols.cjs');
console.log('[cascade-core] Bundling worker...');
execFileSync(npx, [
  'esbuild',
  path.join(pkgRoot, 'src', 'worker', 'CascadeWorker.js'),
  '--bundle', '--minify', '--keep-names', '--sourcemap',
  '--format=esm', '--target=es2022',
  '--outfile=' + path.join(distDir, 'cascade-worker.js'),
  '--external:fs', '--external:path', '--external:os',
  '--external:module', '--external:worker_threads',
  '--loader:.wasm=file',
  '--define:ESBUILD=true',
], { cwd: monoRoot, stdio: 'inherit' });

// 2. Copy OpenCascade WASM to dist/
console.log('[cascade-core] Copying WASM...');
const wasmSrc = path.join(monoRoot, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.wasm');
if (fs.existsSync(wasmSrc)) {
  fs.copyFileSync(wasmSrc, path.join(distDir, 'cascadestudio.wasm'));
}

// 3. Copy Brython (lazy-loaded by the worker for Python/build123d mode)
console.log('[cascade-core] Copying Brython...');
const brythonSrc = path.join(monoRoot, 'node_modules', 'brython', 'brython.js');
if (fs.existsSync(brythonSrc)) {
  fs.copyFileSync(brythonSrc, path.join(distDir, 'brython.js'));
}

// 3a. Copy MicroPython (the `?pyruntime=micropython` low-memory runtime;
// the settrace wasm variant is required for the line-mapping and
// caller-frame hooks — see MicroPythonRuntime.js).
console.log('[cascade-core] Copying MicroPython...');
const mpDir = path.join(monoRoot, 'node_modules', '@micropython', 'micropython-webassembly-pyscript');
for (const f of ['micropython.mjs', 'micropython-settrace.wasm']) {
  const src = path.join(mpDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, f));
  }
}

// 3b. Copy the Pyodide core distribution, IF it has been vendored
// (`node packages/cascade-core/scripts/fetch-pyodide.cjs`). Optional by
// design: Pyodide is the experimental `?pyruntime=pyodide` alternative to
// Brython, ~13.5 MB, off by default and absent from a plain checkout.
const pyodideSrc = path.join(monoRoot, 'vendor', 'pyodide');
if (fs.existsSync(pyodideSrc)) {
  console.log('[cascade-core] Copying Pyodide (experimental runtime)...');
  const pyodideDist = path.join(distDir, 'pyodide');
  fs.mkdirSync(pyodideDist, { recursive: true });
  for (const file of fs.readdirSync(pyodideSrc)) {
    fs.copyFileSync(path.join(pyodideSrc, file), path.join(pyodideDist, file));
  }
}

// 3c. Copy the upstream-build123d layer (experimental `?pysrc=upstream` on
// the MicroPython runtime): the committed seam adapters + stdlib shims from
// upstream-py/, plus the VENDORED upstream 0.11.1 sources IF fetched
// (`node packages/cascade-core/scripts/fetch-upstream-b123d.cjs`).
const upstreamPySrc = path.join(pkgRoot, 'upstream-py');
if (fs.existsSync(upstreamPySrc)) {
  console.log('[cascade-core] Copying upstream-b123d layer...');
  const upstreamDist = path.join(distDir, 'upstream-b123d');
  fs.cpSync(upstreamPySrc, upstreamDist, { recursive: true });
  const vendored = path.join(monoRoot, 'vendor', 'build123d-0.11.1');
  if (fs.existsSync(vendored)) {
    fs.cpSync(vendored, path.join(upstreamDist, 'upstream'), { recursive: true });
  } else {
    console.log('[cascade-core]   (no vendor/build123d-0.11.1 — pysrc=upstream disabled)');
  }
}

// 4. Copy fonts to dist/fonts/
console.log('[cascade-core] Copying fonts...');
const fontsDir = path.join(pkgRoot, 'fonts');
const distFontsDir = path.join(distDir, 'fonts');
if (fs.existsSync(fontsDir)) {
  fs.mkdirSync(distFontsDir, { recursive: true });
  for (const file of fs.readdirSync(fontsDir)) {
    fs.copyFileSync(path.join(fontsDir, file), path.join(distFontsDir, file));
  }
}

console.log('[cascade-core] Build complete!');
