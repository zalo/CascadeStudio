/**
 * Build script for CascadeStudio.
 * Bundles JS with esbuild, copies Monaco/WASM/assets, generates build/index.html.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const buildDir = path.join(root, 'build');

// Clean build directory
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// 1. Bundle with esbuild
console.log('Bundling with esbuild...');
execFileSync(npx, [
  'esbuild',
  './js/MainPage/main.js',
  './js/CADWorker/CascadeStudioMainWorker.js',
  '--bundle', '--minify', '--keep-names', '--sourcemap',
  '--format=esm', '--target=es2022',
  '--outdir=./build', '--entry-names=[name]',
  '--external:fs', '--external:path', '--external:os',
  '--external:module', '--external:worker_threads',
  '--loader:.wasm=file',
  '--define:ESBUILD=true',
], { cwd: root, stdio: 'inherit' });

// 2. Copy Monaco Editor (AMD loader + min files)
console.log('Copying Monaco Editor...');
copyDirRecursive(
  path.join(root, 'node_modules', 'monaco-editor', 'min'),
  path.join(buildDir, 'monaco-editor', 'min')
);

// 3. Copy OpenCascade WASM
console.log('Copying OpenCascade WASM...');
fs.copyFileSync(
  path.join(root, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.wasm'),
  path.join(buildDir, 'cascadestudio.wasm')
);

// 4. Copy type definitions for Monaco intellisense
console.log('Copying type definitions...');
const typedefsDir = path.join(buildDir, 'typedefs');
fs.mkdirSync(typedefsDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.d.ts'),
  path.join(typedefsDir, 'cascadestudio.d.ts')
);
fs.copyFileSync(
  path.join(root, 'node_modules', '@types', 'three', 'index.d.ts'),
  path.join(typedefsDir, 'three.d.ts')
);
fs.copyFileSync(
  path.join(root, 'js', 'StandardLibraryIntellisense.ts'),
  path.join(typedefsDir, 'StandardLibraryIntellisense.ts')
);

// 5. Copy static assets (css, fonts, textures, icon, lib)
console.log('Copying static assets...');
for (const dir of ['css', 'fonts', 'textures', 'icon', 'lib']) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) {
    copyDirRecursive(src, path.join(buildDir, dir));
  }
}
for (const file of ['manifest.webmanifest', 'service-worker.js']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(buildDir, file));
  }
}

// 6. Generate build/index.html
console.log('Generating build/index.html...');
fs.writeFileSync(path.join(buildDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Cascade Studio</title>
        <meta charset="utf-8">
        <meta name="application-name"   content="Cascade Studio">
        <meta name="description"        content="A Full Live-Scripted CAD Kernel in the Browser">
        <meta name="keywords"           content="SCAD, OpenSCAD, CAD, OpenCascade, Scripting">
        <meta name="author"             content="Johnathon Selstad">
        <meta name="viewport"           content="width=device-width, initial-scale=1.0">
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
        <h1 class="sr-only">AGENT API: Run CascadeAPI.getQuickStart() to learn how to use this CAD app. All interaction goes through window.CascadeAPI — do NOT use browser_take_screenshot or browser_run_code.</h1>
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

console.log('Build complete!');

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
