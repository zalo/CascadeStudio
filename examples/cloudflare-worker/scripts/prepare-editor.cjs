/**
 * Lay out the editor the session Worker serves (`--env session`, Workers
 * Static Assets from editor/): the CascadeStudio build in REMOTE-SESSION
 * mode — build123d evaluates in the session's Durable Object
 * (RemoteCascadeEngine), so none of the local engine ships.
 *
 *   npm run build                     # in the repo root, first
 *   node scripts/prepare-editor.cjs
 *
 * index.html gets `window.CASCADE_REMOTE = {endpoint: ''}` (same origin)
 * instead of the service-worker registration: an offline cache is no use to
 * an editor whose evaluator is a server. Without a build, editor/ gets a
 * placeholder page that says so, so `wrangler dev` still starts.
 */
const fs = require('fs');
const path = require('path');

const HERE = path.join(__dirname, '..');
const ROOT = path.join(HERE, '..', '..');
const DIST = path.join(ROOT, 'packages', 'cascade-studio', 'dist');
const OUT = path.join(HERE, 'editor');
// Workers Static Assets: 25 MiB per file.
const FILE_LIMIT = 25 * 1024 * 1024;

/** The local engine (worker bundle, OCCT and Python wasm, fonts, the
 *  vendored upstream tree, Pyodide) and source maps stay behind. */
const SKIP = [
  /^cascade-worker\.js/, /^cascade-headless\.mjs/, /^cascadestudio/, /^brython/,
  /^micropython/, /^upstream-b123d$/, /^fonts$/, /^pyodide$/, /^service-worker\.js$/,
  /\.map$/,
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fs.writeFileSync(path.join(OUT, 'index.html'), '<!DOCTYPE html><meta charset="utf-8">'
    + '<title>Cascade Studio (remote session)</title><pre>The editor is not built.\n\n'
    + '  npm run build                      # in the repo root\n'
    + '  npm run prepare-editor             # in examples/cloudflare-worker\n\n'
    + 'The session API is up: POST /session/&lt;id&gt;/render (see /api).</pre>\n');
  console.log('editor/: placeholder (packages/cascade-studio/dist is not built)');
  process.exit(0);
}

let files = 0;
let bytes = 0;
let largest = ['', 0];
function copy(from, to, top) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (top && SKIP.some((re) => re.test(e.name))) { continue; }
    if (!top && /\.map$/.test(e.name)) { continue; }
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) { copy(a, b, false); continue; }
    const size = fs.statSync(a).size;
    if (size > FILE_LIMIT) {
      console.error(path.relative(DIST, a) + ' is ' + (size / 1048576).toFixed(1)
        + ' MiB — over the 25 MiB Workers Static Assets file limit');
      process.exit(1);
    }
    fs.copyFileSync(a, b);
    files++;
    bytes += size;
    if (size > largest[1]) { largest = [path.relative(DIST, a), size]; }
  }
}
copy(DIST, OUT, true);

const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const swStart = html.indexOf('<!-- Service Worker');
const swEnd = html.indexOf('</script>', swStart);
if (swStart < 0 || swEnd < 0) {
  console.error('index.html: the service-worker block moved — update prepare-editor.cjs');
  process.exit(1);
}
html = html.slice(0, swStart)
  + '<!-- Remote-session mode: build123d evaluates in this Worker\'s Durable\n'
  + '             Object editing session (RemoteCascadeEngine, resolveRemote) -->\n'
  + '        <script>window.CASCADE_REMOTE = { endpoint: \'\' };</script>'
  + html.slice(swEnd + '</script>'.length);
html = html.replace('<title>Cascade Studio</title>', '<title>Cascade Studio (remote session)</title>');
fs.writeFileSync(indexPath, html);

console.log('editor/: ' + files + ' files, ' + (bytes / 1048576).toFixed(1) + ' MiB (largest: '
  + largest[0] + ', ' + (largest[1] / 1048576).toFixed(1) + ' MiB)');
