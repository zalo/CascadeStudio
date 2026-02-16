/**
 * Postinstall script for CascadeStudio.
 * Bundles golden-layout ESM (which has extensionless imports) into a single browser-ready file.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const glInput = path.join(root, 'node_modules', 'golden-layout', 'dist', 'esm', 'index.js');
const glOutput = path.join(root, 'lib', 'golden-layout', 'golden-layout.js');

// Bundle golden-layout ESM into a single file for buildless browser use
if (fs.existsSync(glInput)) {
  const glDir = path.dirname(glOutput);
  if (!fs.existsSync(glDir)) { fs.mkdirSync(glDir, { recursive: true }); }

  execSync(`npx esbuild ${glInput} --bundle --format=esm --outfile=${glOutput} --sourcemap`, {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('  Bundled golden-layout ESM to', glOutput);

  // Copy CSS files
  const cssBase = path.join(root, 'node_modules', 'golden-layout', 'dist', 'css', 'goldenlayout-base.css');
  const cssTheme = path.join(root, 'node_modules', 'golden-layout', 'dist', 'css', 'themes', 'goldenlayout-dark-theme.css');
  if (fs.existsSync(cssBase)) {
    fs.copyFileSync(cssBase, path.join(glDir, 'goldenlayout-base.css'));
  }
  if (fs.existsSync(cssTheme)) {
    fs.copyFileSync(cssTheme, path.join(glDir, 'goldenlayout-dark-theme.css'));
  }
  console.log('  Copied golden-layout CSS files');
}
