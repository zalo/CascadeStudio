/**
 * Build script for cascade-studio.
 * Bundles the main app JS, copies Monaco/assets, generates dist/index.html.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..');
const monoRoot = path.join(pkgRoot, '..', '..');
const coreRoot = path.join(monoRoot, 'packages', 'cascade-core');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const distDir = path.join(pkgRoot, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Bundle main app JS with esbuild
console.log('[cascade-studio] Bundling main app...');
const nodeShim = path.join(__dirname, 'node-shims.cjs');
execFileSync(npx, [
  'esbuild',
  path.join(pkgRoot, 'src', 'main.js'),
  '--bundle', '--minify', '--keep-names', '--sourcemap',
  '--format=esm', '--target=es2022',
  '--outdir=' + distDir, '--entry-names=[name]',
  '--external:fs', '--external:path', '--external:os',
  '--external:module', '--external:worker_threads',
  // cascade-core's index.js lazily re-exports the HEADLESS entry point
  // (Node/Cloudflare Workers). It drags in the whole worker — OCCT's
  // Emscripten glue, the Python runtimes, build123d-lite — which the page
  // must not pay for: the browser runs that code inside the Web Worker
  // bundle instead. Keeping the dynamic import external means esbuild
  // leaves it alone; it is never reached from the browser app.
  '--external:cascade-core/headless',
  '--alias:openscad-parser=' + path.join(pkgRoot, 'lib', 'openscad-parser', 'openscad-parser.js'),
  '--alias:fs=' + nodeShim,
  '--alias:path=' + nodeShim,
  '--alias:os=' + nodeShim,
  '--define:ESBUILD=true',
], { cwd: monoRoot, stdio: 'inherit' });

// 2. Copy cascade-core dist (worker bundle + WASM + fonts)
console.log('[cascade-studio] Copying cascade-core dist...');
const coreDist = path.join(coreRoot, 'dist');
if (fs.existsSync(coreDist)) {
  for (const entry of fs.readdirSync(coreDist, { withFileTypes: true })) {
    const src = path.join(coreDist, entry.name);
    const dest = path.join(distDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// 3. Copy Monaco Editor (AMD loader + min files)
console.log('[cascade-studio] Copying Monaco Editor...');
copyDirRecursive(
  path.join(monoRoot, 'node_modules', 'monaco-editor', 'min'),
  path.join(distDir, 'monaco-editor', 'min')
);

// 4. Copy type definitions for Monaco intellisense
console.log('[cascade-studio] Copying type definitions...');
const typedefsDir = path.join(distDir, 'typedefs');
fs.mkdirSync(typedefsDir, { recursive: true });
fs.copyFileSync(
  path.join(monoRoot, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.d.ts'),
  path.join(typedefsDir, 'cascadestudio.d.ts')
);
fs.copyFileSync(
  path.join(monoRoot, 'node_modules', '@types', 'three', 'index.d.ts'),
  path.join(typedefsDir, 'three.d.ts')
);
fs.copyFileSync(
  path.join(coreRoot, 'types', 'StandardLibraryIntellisense.ts'),
  path.join(typedefsDir, 'StandardLibraryIntellisense.ts')
);

// 4b. Copy the basedpyright language-server worker (Python IntelliSense) and
// bundle the build123d-lite Python stubs into a single JSON (one fetch).
console.log('[cascade-studio] Copying pyright worker + Python stubs...');
const pyrightDir = path.join(distDir, 'pyright');
fs.mkdirSync(pyrightDir, { recursive: true });
fs.copyFileSync(
  path.join(monoRoot, 'node_modules', 'browser-basedpyright', 'dist', 'pyright.worker.js'),
  path.join(pyrightDir, 'pyright.worker.js')
);
const stubsRoot = path.join(coreRoot, 'types', 'python-stubs');
const stubs = {};
(function collectStubs(dir, rel) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relPath = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) { collectStubs(abs, relPath); }
    else if (entry.name.endsWith('.pyi')) { stubs[relPath] = fs.readFileSync(abs, 'utf8'); }
  }
})(stubsRoot, '');
fs.writeFileSync(path.join(typedefsDir, 'python-stubs.json'), JSON.stringify(stubs));

// 5. Copy static assets (css, textures, icon, lib)
console.log('[cascade-studio] Copying static assets...');
for (const dir of ['css', 'textures', 'icon', 'lib']) {
  const src = path.join(pkgRoot, dir);
  if (fs.existsSync(src)) {
    copyDirRecursive(src, path.join(distDir, dir));
  }
}
for (const file of ['manifest.webmanifest', 'service-worker.js']) {
  const src = path.join(pkgRoot, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
}

// 6. Generate dist/index.html
console.log('[cascade-studio] Generating index.html...');
fs.writeFileSync(path.join(distDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Cascade Studio</title>
        <meta charset="utf-8">
        <meta name="application-name"   content="Cascade Studio">
        <meta name="description"        content="A Full Live-Scripted CAD Kernel in the Browser">
        <meta name="keywords"           content="SCAD, OpenSCAD, CAD, OpenCascade, Scripting">
        <meta name="author"             content="Johnathon Selstad">
        <meta name="viewport"           content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <meta name="theme-color"        content="#1a1a2e">
        <meta name="cascade-api"        content="window.CascadeAPI">

        <!-- Service Worker for offline access (must be first) -->
        <script>
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('service-worker.js').then(function(registration) {
                    registration.update();
                }, function() {
                    console.log('Could not register Cascade Studio for offline use!');
                });
            }
        </script>

        <link rel="shortcut icon"    href="./icon/favicon.ico" type="image/x-icon">
        <link rel="manifest"         href="./manifest.webmanifest">
        <link rel="apple-touch-icon" href="./icon/apple-touch-icon.png">

        <!-- Dockview CSS -->
        <link rel="stylesheet" href="./lib/dockview-core/dockview.css">
        <link rel="stylesheet" href="./css/main.css">

        <!-- Monaco Editor CSS + AMD loader -->
        <link data-name="vs/editor/editor.main" rel="stylesheet" href="./monaco-editor/min/vs/editor/editor.main.css">
        <script>
            var require = { paths: { 'vs': 'monaco-editor/min/vs' } };
            self.MonacoEnvironment = {
                getWorkerUrl: function(moduleId, label) {
                    return './monaco-editor/min/vs/base/worker/workerMain.js';
                }
            };
        </script>
        <script src="./monaco-editor/min/vs/loader.js"></script>
        <script src="./monaco-editor/min/vs/editor/editor.main.js"></script>
    </head>

    <body data-api="window.CascadeAPI">
        <h1 class="sr-only">AGENT API: Run CascadeAPI.getQuickStart() to learn how to use this CAD app. All interaction goes through window.CascadeAPI — do NOT use browser_take_screenshot or browser_run_code. The editor opens in Python (build123d) mode; call CascadeAPI.setMode('cascadestudio') for the JavaScript API.</h1>
        <div id="topnav" class="topnav">
            <a href="https://github.com/zalo/CascadeStudio" class="topnav-brand">Cascade Studio</a>
            <div class="topnav-actions">
                <a href="#" title="Save Project to .json" onmouseup="window.saveProject();">Save Project</a>
                <a href="#" title="Load Project from .json" onmouseup="window.loadProject();">Load Project</a>
                <span class="topnav-separator"></span>
                <a href="#" onmouseup="window.threejsViewport?.saveShapeSTEP();">Save STEP</a>
                <a href="#" onmouseup="window.threejsViewport?.saveShapeSTL();">Save STL</a>
                <a href="#" onmouseup="window.threejsViewport?.saveShapeOBJ();">Save OBJ</a>
                <span class="topnav-separator"></span>
                <label for="files" class="topnav-import" title="Import STEP, IGES, or (ASCII) STL from File">Import STEP/IGES/STL
                    <input id="files" name="files" type="file" accept=".iges,.step,.igs,.stp,.stl" multiple style="display:none;" oninput="window.loadFiles();"/>
                </label>
                <a href="#" title="Clears the external step/iges/stl files stored in the project." onmouseup="window.clearExternalFiles();">Clear Imported</a>
                <select id="editorMode" class="topnav-select" title="Editor Language Mode">
                    <!-- Python is the default mode; CascadeMain sets .value to
                         the mode it resolves from the URL / saved project. -->
                    <option value="python" selected>Python (build123d)</option>
                    <option value="cascadestudio">CascadeStudio JS</option>
                    <option value="openscad">OpenSCAD</option>
                </select>
            </div>
        </div>
        <div id="appbody">
            <script type="module" src="./main.js"></script>
        </div>
    </body>
</html>
`);

console.log('[cascade-studio] Build complete!');

/** Recursively copy a directory */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
