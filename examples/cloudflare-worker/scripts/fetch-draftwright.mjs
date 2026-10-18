/**
 * Fetch the pinned draftwright-wasm release into drafting/vendor/ for the
 * drafting Worker (drafting/README.md). The package is AGPL-3.0-only and is
 * not committed: this downloads the release asset, checks its SHA-256
 * against the pin below and unpacks its pkg/ directory.
 *
 *   node scripts/fetch-draftwright.mjs            # no-op when already present
 *   node scripts/fetch-draftwright.mjs --force
 *
 * To move to a newer release, change VERSION and SHA256 (the release's
 * draftwright-wasm-<v>.tgz.sha256 asset) together.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const VERSION = '0.1.0-alpha.5';
const SHA256 = '2bb8d203b8b86b963515c5d3229d144b3798cfc9a43dafaffcccaeadc1f692e6';
const REPO = 'pzfreo/draftwright-rust';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, '..', 'drafting', 'vendor');
const asset = 'draftwright-wasm-' + VERSION + '.tgz';
const url = 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/' + asset;

const stamp = join(VENDOR, 'VERSION.json');
if (!process.argv.includes('--force') && fs.existsSync(stamp)
    && JSON.parse(fs.readFileSync(stamp, 'utf8')).version === VERSION
    && fs.existsSync(join(VENDOR, 'draftwright_wasm_bg.wasm'))) {
  console.log('[draftwright] ' + VERSION + ' already in drafting/vendor/');
  process.exit(0);
}

console.log('[draftwright] fetching ' + url);
const res = await fetch(url);
if (!res.ok) { throw new Error('download failed: HTTP ' + res.status + ' for ' + url); }
const tgz = Buffer.from(await res.arrayBuffer());
const got = createHash('sha256').update(tgz).digest('hex');
if (got !== SHA256) { throw new Error('checksum mismatch for ' + asset + ': got ' + got + ', pinned ' + SHA256); }

// a ustar reader: 512-byte headers, sizes in octal, files padded to 512
const tar = gunzipSync(tgz);
fs.rmSync(VENDOR, { recursive: true, force: true });
fs.mkdirSync(VENDOR, { recursive: true });
const files = [];
for (let off = 0; off + 512 <= tar.length;) {
  const header = tar.subarray(off, off + 512);
  if (header.every((b) => b === 0)) { break; }
  const str = (a, b) => header.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
  const name = (str(345, 500) ? str(345, 500) + '/' : '') + str(0, 100);
  const size = parseInt(str(124, 136).trim() || '0', 8);
  const type = String.fromCharCode(header[156] || 48);
  const body = tar.subarray(off + 512, off + 512 + size);
  off += 512 + Math.ceil(size / 512) * 512;
  const rel = name.replace(/^\.\//, '');
  if ((type !== '0' && type !== '\0') || !rel.startsWith('pkg/')) { continue; }
  const leaf = rel.slice(4);
  if (!leaf || leaf.includes('/') || leaf.startsWith('.')) { continue; }   // flat package only
  fs.writeFileSync(join(VENDOR, leaf), body);
  files.push(leaf + ' (' + body.length + ' B)');
}
if (!fs.existsSync(join(VENDOR, 'draftwright_wasm_bg.wasm')) || !fs.existsSync(join(VENDOR, 'draftwright_wasm.js'))) {
  throw new Error(asset + ' did not contain pkg/draftwright_wasm.js and pkg/draftwright_wasm_bg.wasm');
}
fs.writeFileSync(stamp, JSON.stringify({ version: VERSION, sha256: SHA256, asset: url,
  source: 'https://github.com/' + REPO + '/tree/v' + VERSION, license: 'AGPL-3.0-only' }, null, 1) + '\n');
console.log('[draftwright] ' + VERSION + ' -> drafting/vendor/: ' + files.join(', '));
