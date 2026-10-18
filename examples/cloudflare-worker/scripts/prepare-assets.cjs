/**
 * Lay out the module tree a cascade-headless Worker imports.
 *
 *   npm run build            # in the repo root, first
 *   node scripts/prepare-assets.cjs
 *
 * assets/ is gitignored (cascadestudio.wasm alone is 27 MB).
 *
 * EVERYTHING here is a module of the Worker SCRIPT — imported by
 * src/index.js / src/index-upstream.js:
 *
 *   cascadestudio.wasm        CompiledWasm bindings: Workers cannot compile
 *   micropython-cs.wasm       WebAssembly at runtime.
 *   micropython-cs.mjs        Emscripten glue; workerd forbids import() of a URL.
 *   cascade-headless.mjs      the engine bundle (build123d-LITE's Python source
 *                             is a string inside it).
 *   fonts/FreeSans*.ttf       Data modules — the four faces build123d's
 *                             FontStyle names; parsed only when a script uses one.
 *   upstream-b123d.json       Text module, upstream entry only — the whole
 *                             verbatim build123d 0.11.1 layer (vendored sources
 *                             + shims + the OCP binding table) as ONE
 *                             relative-path -> text map.
 *
 * The fonts and the upstream Python used to be Workers Static Assets (public/,
 * fetched through env.ASSETS at boot) to fit the old 10 MiB-gzip script cap.
 * That cap is gone (64 MiB UNCOMPRESSED on Free and Paid since 2026-09-04),
 * and the static-asset split cost a subrequest round trip per cold isolate
 * and kept the boot out of global scope — see SIZE-INVESTIGATION.md.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HERE = path.join(__dirname, '..');
const ROOT = path.join(HERE, '..', '..');
const CORE_DIST = path.join(ROOT, 'packages', 'cascade-core', 'dist');
const OUT = path.join(HERE, 'assets');
const PUB = path.join(HERE, 'public');   // the retired static-assets tree
// Cloudflare's only Worker size limit since 2026-09-04: 64 MiB uncompressed
// (`Total Upload`), Free and Paid alike.
const LIMIT = 64 * 1024 * 1024;

if (!fs.existsSync(path.join(CORE_DIST, 'cascade-headless.mjs'))) {
  console.error('packages/cascade-core/dist is not built — run `npm run build` in the repo root first.');
  process.exit(1);
}
fs.rmSync(PUB, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';

// ------------------------------------------------------------------ //
// 1. Module bindings.                                                 //
// ------------------------------------------------------------------ //
const BINDINGS = [
  'cascade-headless.mjs',
  'cascadestudio.wasm',
  'micropython-cs.mjs',
  'micropython-cs.wasm',
];

console.log('assets/ (modules of the Worker script — 64 MiB uncompressed limit)');
let scriptRaw = 0;
let scriptGz = 0;
for (const name of BINDINGS) {
  const from = path.join(CORE_DIST, name);
  if (!fs.existsSync(from)) { console.error('missing ' + from); process.exit(1); }
  const buf = fs.readFileSync(from);
  fs.writeFileSync(path.join(OUT, name), buf);
  scriptRaw += buf.length;
  scriptGz += gz(buf);
  console.log('  ' + name.padEnd(26) + mb(buf.length).padStart(9)
    + '   ' + mb(gz(buf)).padStart(9) + ' gz');
}
// Older layouts kept fonts at assets/*.ttf (and later in public/); drop
// strays so the figures below describe what the entries import.
for (const stale of fs.readdirSync(OUT)) {
  if (/\.ttf$/.test(stale)) { fs.unlinkSync(path.join(OUT, stale)); console.log('  (removed stale ' + stale + ')'); }
}

// ------------------------------------------------------------------ //
// 2. Fonts (Data modules).                                            //
// ------------------------------------------------------------------ //
// build123d's Text() asks for a SPECIFIC family member per FontStyle —
// FreeSans / FreeSansBold / FreeSansOblique / FreeSansBoldOblique — and a
// name that is not shipped is a hard, named error rather than a null shape.
// All four ship (they were unaffordable under the old 10 MiB-gzip cap).
let fontRaw = 0;
const fontDir = path.join(CORE_DIST, 'fonts');
const shippedFonts = [];
for (const f of fs.readdirSync(fontDir).sort()) {
  if (!/^FreeSans.*\.ttf$/.test(f)) { continue; }  // the family build123d names
  const buf = fs.readFileSync(path.join(fontDir, f));
  fs.writeFileSync(path.join(OUT, 'fonts', f), buf);
  shippedFonts.push(f.replace(/\.ttf$/, ''));
  fontRaw += buf.length;
  scriptRaw += buf.length;
  scriptGz += gz(buf);
  console.log('  ' + ('fonts/' + f).padEnd(26) + mb(buf.length).padStart(9)
    + '   ' + mb(gz(buf)).padStart(9) + ' gz');
}
if (!shippedFonts.length) { console.error('no FreeSans fonts in ' + fontDir); process.exit(1); }

// ------------------------------------------------------------------ //
// 3. The upstream build123d Python layer, as one map (Text module).    //
// ------------------------------------------------------------------ //
const UP = path.join(CORE_DIST, 'upstream-b123d');
let upstreamRaw = 0;
let upstreamGz = 0;
if (fs.existsSync(UP)) {
  const tree = {};
  let files = 0;
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = path.join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { walk(abs, r); continue; }
      if (!/\.(py|json)$/.test(e.name)) { continue; }   // README.md is not loaded
      tree[r] = fs.readFileSync(abs, 'utf8');
      files++;
    }
  };
  walk(UP, '');
  const json = Buffer.from(JSON.stringify(tree), 'utf8');
  fs.writeFileSync(path.join(OUT, 'upstream-b123d.json'), json);
  upstreamRaw = json.length;
  upstreamGz = gz(json);
  console.log('  ' + 'upstream-b123d.json'.padEnd(26) + mb(json.length).padStart(9)
    + '   ' + mb(gz(json)).padStart(9) + ' gz   (' + files + ' modules)');
} else {
  console.log('  upstream-b123d.json        SKIPPED — no dist/upstream-b123d '
    + '(the lite flavor still deploys; `--env upstream` will not build)');
}

// ------------------------------------------------------------------ //
// 4. Build id (the editing session salts its persisted cache with it:  //
//    keys written by one engine build mean nothing to another).        //
// ------------------------------------------------------------------ //
{
  const crypto = require('crypto');
  const h = crypto.createHash('sha256');
  for (const name of ['cascade-headless.mjs', 'cascadestudio.wasm', 'micropython-cs.wasm']) {
    h.update(fs.readFileSync(path.join(OUT, name)));
  }
  if (fs.existsSync(path.join(OUT, 'upstream-b123d.json'))) {
    h.update(fs.readFileSync(path.join(OUT, 'upstream-b123d.json')));
  }
  const bundleId = h.digest('hex').slice(0, 16);
  fs.writeFileSync(path.join(OUT, 'bundle-id.json'), JSON.stringify({ bundleId }) + '\n');
  console.log('  bundle-id.json             ' + bundleId);
}

const pct = (n) => (100 * n / LIMIT).toFixed(0) + '% of 64 MiB';
console.log('\n  lite script      ' + mb(scriptRaw).padStart(9) + '   ' + mb(scriptGz).padStart(9)
  + ' gz   ' + pct(scriptRaw) + '  (raw sum; `wrangler deploy --dry-run` reports Total Upload)');
console.log('  upstream script  ' + mb(scriptRaw + upstreamRaw).padStart(9) + '   '
  + mb(scriptGz + upstreamGz).padStart(9) + ' gz   ' + pct(scriptRaw + upstreamRaw));
console.log('  fonts shipped: ' + shippedFonts.join(', ') + '  (' + mb(fontRaw) + ')');
