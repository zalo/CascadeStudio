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

// Fonts are the one asset that has to be rationed. build123d asks for a
// SPECIFIC family member per FontStyle — FreeSans / FreeSansBold /
// FreeSansOblique / FreeSansBoldOblique — and a name that is not bundled is
// now a hard, named error rather than a null shape (it used to surface as
// "Cannot set properties of undefined (setting 'hash')"; examples/clock hits
// it with font_style=FontStyle.BOLD). But the four together are 2.20 MB
// gzipped against 0.84 MB of headroom under Cloudflare's 10 MB compressed
// limit, so only the two that the validation corpus actually uses ship:
//
//   FreeSans     0.93 MB gz   FontStyle.REGULAR (the default)
//   FreeSansBold 0.51 MB gz   FontStyle.BOLD
//   (FreeSansOblique 0.46 + FreeSansBoldOblique 0.30 do not fit)
//
// Adding one means copying it here AND importing it in src/index.js (a
// Worker's wasm/data bindings must be static imports).
const files = [
  ['cascade-headless.mjs', 'cascade-headless.mjs'],
  ['cascadestudio.wasm', 'cascadestudio.wasm'],
  ['micropython-cs.mjs', 'micropython-cs.mjs'],
  ['micropython-cs.wasm', 'micropython-cs.wasm'],
  [path.join('fonts', 'FreeSans.ttf'), 'FreeSans.ttf'],
  [path.join('fonts', 'FreeSansBold.ttf'), 'FreeSansBold.ttf'],
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
