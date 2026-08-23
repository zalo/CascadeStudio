/**
 * Lay out the two asset trees a cascade-headless Worker needs.
 *
 *   npm run build            # in the repo root, first
 *   node scripts/prepare-assets.cjs
 *
 * Both trees are gitignored (cascadestudio.wasm alone is 27 MB).
 *
 * ------------------------------------------------------------------ //
 * assets/  — MODULE BINDINGS, part of the Worker SCRIPT
 * ------------------------------------------------------------------ //
 * Everything here is `import`ed by src/index.js and counts against
 * Cloudflare's 10 MiB compressed script limit. Only things that HAVE to be
 * in the script live here:
 *
 *   cascadestudio.wasm    Workers cannot compile WebAssembly at runtime, so
 *   micropython-cs.wasm   every .wasm must arrive as an already-compiled
 *                         `WebAssembly.Module` binding (see wrangler.toml).
 *   micropython-cs.mjs    Emscripten glue; workerd forbids import() of a URL.
 *   cascade-headless.mjs  the engine bundle itself (build123d-LITE's Python
 *                         source is a string inside it).
 *
 * ------------------------------------------------------------------ //
 * public/  — WORKERS STATIC ASSETS, served by the Asset Worker
 * ------------------------------------------------------------------ //
 * Fetched at engine-boot time through the `ASSETS` binding, so none of it
 * counts against the script limit:
 *
 *   fonts/FreeSans.ttf         1.44 MB gz of TTF that used to be inlined —
 *   fonts/FreeSansBold.ttf     the single biggest win, and it applies to
 *                              BOTH source flavors.
 *   py/upstream-b123d.json     the whole verbatim-upstream build123d 0.11.1
 *                              Python layer (vendored sources + shims +
 *                              the OCP binding table), as ONE
 *                              relative-path -> text map.
 *
 * Why one JSON rather than 163 files: the upstream loader asks for ~120
 * individual modules, and every `env.ASSETS.fetch()` is a Worker subrequest.
 * One fetch + one parse costs ~40 ms on a cold isolate; 120 round trips cost
 * far more and eat into the subrequest budget. The tree is served verbatim —
 * no source is rewritten here (UpstreamB123d.js owns every transform).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HERE = path.join(__dirname, '..');
const ROOT = path.join(HERE, '..', '..');
const CORE_DIST = path.join(ROOT, 'packages', 'cascade-core', 'dist');
const OUT = path.join(HERE, 'assets');
const PUB = path.join(HERE, 'public');

if (!fs.existsSync(path.join(CORE_DIST, 'cascade-headless.mjs'))) {
  console.error('packages/cascade-core/dist is not built — run `npm run build` in the repo root first.');
  process.exit(1);
}
fs.rmSync(PUB, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(PUB, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(PUB, 'py'), { recursive: true });

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

console.log('assets/ (module bindings — count against the 10 MiB script limit)');
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
// Fonts used to live here. If an older tree still has them, drop them: a
// stale FreeSans.ttf in assets/ is 0.93 MB gz of dead weight that wrangler
// would NOT bundle (nothing imports it any more) but that confuses the
// figures below.
for (const stale of ['FreeSans.ttf', 'FreeSansBold.ttf']) {
  const p = path.join(OUT, stale);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('  (removed stale ' + stale + ')'); }
}

// ------------------------------------------------------------------ //
// 2. Static assets: fonts.                                            //
// ------------------------------------------------------------------ //
// build123d's Text() asks for a SPECIFIC family member per FontStyle —
// FreeSans / FreeSansBold / FreeSansOblique / FreeSansBoldOblique — and a
// name that is not shipped is a hard, named error rather than a null shape.
// All four used to be unaffordable (2.20 MB gz against 0.84 MB of headroom);
// out of the script they cost nothing, so ship whatever the dist has.
console.log('\npublic/ (static assets — fetched through the ASSETS binding)');
let assetRaw = 0;
let assetGz = 0;
const fontDir = path.join(CORE_DIST, 'fonts');
const shippedFonts = [];
for (const f of fs.readdirSync(fontDir).sort()) {
  if (!/^FreeSans.*\.ttf$/.test(f)) { continue; }  // the family build123d names
  const buf = fs.readFileSync(path.join(fontDir, f));
  fs.writeFileSync(path.join(PUB, 'fonts', f), buf);
  shippedFonts.push(f.replace(/\.ttf$/, ''));
  assetRaw += buf.length;
  assetGz += gz(buf);
  console.log('  ' + ('fonts/' + f).padEnd(34) + mb(buf.length).padStart(9)
    + '   ' + mb(gz(buf)).padStart(9) + ' gz');
}
if (!shippedFonts.length) { console.error('no FreeSans fonts in ' + fontDir); process.exit(1); }

// ------------------------------------------------------------------ //
// 3. Static assets: the upstream build123d Python layer, as one map.   //
// ------------------------------------------------------------------ //
const UP = path.join(CORE_DIST, 'upstream-b123d');
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
  fs.writeFileSync(path.join(PUB, 'py', 'upstream-b123d.json'), json);
  assetRaw += json.length;
  assetGz += gz(json);
  console.log('  ' + 'py/upstream-b123d.json'.padEnd(34) + mb(json.length).padStart(9)
    + '   ' + mb(gz(json)).padStart(9) + ' gz   (' + files + ' modules)');
} else {
  console.log('  py/upstream-b123d.json            SKIPPED — no dist/upstream-b123d '
    + '(the lite flavor still deploys; `--env upstream` will not boot)');
}

console.log('\n  script   ' + mb(scriptRaw).padStart(9) + '   ' + mb(scriptGz).padStart(9)
  + ' gz  (raw sum; wrangler reports the bundled figure against its 10 MiB limit)');
console.log('  assets   ' + mb(assetRaw).padStart(9) + '   ' + mb(assetGz).padStart(9)
  + ' gz  (out of the script entirely)');
console.log('  fonts shipped: ' + shippedFonts.join(', '));
