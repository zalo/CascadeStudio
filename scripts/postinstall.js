/**
 * Postinstall script for CascadeStudio.
 * Bundles library ESM modules into single browser-ready files.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Bundle dockview-core ESM into a single file for buildless browser use
const dvInput = path.join(root, 'node_modules', 'dockview-core', 'dist', 'esm', 'index.js');
const dvOutput = path.join(root, 'lib', 'dockview-core', 'dockview-core.js');

if (fs.existsSync(dvInput)) {
  const dvDir = path.dirname(dvOutput);
  if (!fs.existsSync(dvDir)) { fs.mkdirSync(dvDir, { recursive: true }); }

  execFileSync(npx, [
    'esbuild', dvInput,
    '--bundle', '--format=esm',
    '--outfile=' + dvOutput, '--sourcemap'
  ], { cwd: root, stdio: 'inherit' });
  console.log('  Bundled dockview-core ESM to', dvOutput);

  // Copy dockview CSS
  const dvCss = path.join(root, 'node_modules', 'dockview-core', 'dist', 'styles', 'dockview.css');
  if (fs.existsSync(dvCss)) {
    fs.copyFileSync(dvCss, path.join(dvDir, 'dockview.css'));
    console.log('  Copied dockview CSS');
  }
}

// Bundle openscad-parser CJS → ESM for buildless browser use
const opInput = path.join(root, 'node_modules', 'openscad-parser', 'dist', 'index.js');
const opOutput = path.join(root, 'lib', 'openscad-parser', 'openscad-parser.js');

if (fs.existsSync(opInput)) {
  const opDir = path.dirname(opOutput);
  if (!fs.existsSync(opDir)) { fs.mkdirSync(opDir, { recursive: true }); }

  const shim = path.join(root, 'scripts', 'node-shims.js');
  execFileSync(npx, [
    'esbuild', opInput,
    '--bundle', '--format=esm',
    '--outfile=' + opOutput, '--sourcemap',
    '--alias:fs=' + shim,
    '--alias:path=' + shim,
    '--alias:os=' + shim
  ], { cwd: root, stdio: 'inherit' });
  console.log('  Bundled openscad-parser ESM to', opOutput);
}
