/**
 * Copy the built cascade-core headless artifacts into ./assets/ so wrangler
 * can bundle them as module bindings.
 *
 *   npm run build            # in the repo root, first
 *   node scripts/prepare-assets.cjs
 *
 * assets/ is gitignored: cascadestudio.wasm alone is 27 MB.
 */
const fs = require('fs');
const path = require('path');

const HERE = path.join(__dirname, '..');
const ROOT = path.join(HERE, '..', '..');
const CORE_DIST = path.join(ROOT, 'packages', 'cascade-core', 'dist');
const OUT = path.join(HERE, 'assets');

if (!fs.existsSync(path.join(CORE_DIST, 'cascade-headless.mjs'))) {
  console.error('packages/cascade-core/dist is not built — run `npm run build` in the repo root first.');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

// The FreeSans family is the only font bundled: build123d's Text() uses it,
// and the eight-font set the browser ships is 5 MB — more than a Worker's
// entire compressed size budget. Add more here if a Worker needs them.
const files = [
  ['cascade-headless.mjs', 'cascade-headless.mjs'],
  ['cascadestudio.wasm', 'cascadestudio.wasm'],
  ['micropython-cs.mjs', 'micropython-cs.mjs'],
  ['micropython-cs.wasm', 'micropython-cs.wasm'],
  [path.join('fonts', 'FreeSans.ttf'), 'FreeSans.ttf'],
];

let total = 0;
for (const [src, dst] of files) {
  const from = path.join(CORE_DIST, src);
  if (!fs.existsSync(from)) {
    console.error('missing ' + from);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(OUT, dst));
  const size = fs.statSync(from).size;
  total += size;
  console.log('  ' + dst.padEnd(26) + (size / 1024 / 1024).toFixed(2) + ' MB');
}
console.log('  ' + 'TOTAL'.padEnd(26) + (total / 1024 / 1024).toFixed(2) + ' MB raw'
  + '  (see README.md for the compressed figure vs the 10 MB Worker limit)');
