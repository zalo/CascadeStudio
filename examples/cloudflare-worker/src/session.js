// session.js — the build123d EDITING SESSION as a Durable Object
// (`--env session`, entry src/index-session.js).
//
// The stateless /render Worker (app.js) boots or reuses whatever isolate a
// request lands on and rewinds the kernel after every job, so an edit costs
// a whole evaluation. Here every request for one session id goes to ONE
// Durable Object, which keeps the engine and its op cache warm between
// edits and persists the cached working set, so an edit only recomputes
// what it changed — even after the object was evicted.
//
//   POST   /session/<id>/render  {code, formats?, measure?}  -> the /render
//                                JSON plus `session: {...}` (warm?, restore,
//                                cache hits/misses, compaction, persistence)
//                                With "mesh" among the formats (the editor,
//                                EDITOR.md) the answer is a FRAMED
//                                stream instead: phase events while the job
//                                runs, then the JSON and the binary viewport
//                                mesh (cascade-core MeshCodec.js).
//   POST   /session/<id>/history {step, maxDeviation?} -> frames: one step
//                                of the last render's modeling history
//   POST   /session/<id>/export  {format: step|brep|stl} -> the shape of the
//                                last render as text
//   GET    /session/<id>         stats (instance, isolate, storage, memory)
//   POST   /session/<id>/evict   drop the in-memory working set (test hook:
//                                the next render restores from storage, as a
//                                fresh isolate would — minus the engine boot)
//   DELETE /session/<id>         forget the session (storage + memory)
//
// How the pieces fit (see README "Editing sessions"):
//
//  * THE CACHE. The engine runs with cascade-core's stable cross-run op
//    cache (createHeadlessCascade({stableCache: true})): op results are
//    keyed by a hash of the op and its arguments, with shapes identified by
//    the key of the op that made them, never by kernel address. Re-running
//    an edited script hits for every op whose inputs did not change.
//
//  * PERSISTENCE. After each render the cached working set is serialized
//    (engine.snapshotCache(): ONE compound in OCCT's binary BREP format —
//    bit-exact, so the restored shapes produce the same keys — plus the
//    index and the ops' history records), gzipped and written to the
//    object's SQLite storage in <=1.9 MB rows. A session that comes back to
//    a cold isolate restores it before running (engine.restoreCache()).
//    Skipped when the set of keys did not change since the last write.
//
//  * COMPACTION. Without the per-request reset, every evaluation leaks its
//    intermediate kernel objects (heat_exchanger: +20-30 MB of OCCT heap per
//    run, past 128 MB on the fourth). When the OCCT heap reaches COMPACT_AT_MB
//    after a render, the session snapshots, rewinds the kernel to its boot
//    image and restores the snapshot: only the working set survives. Wasm
//    memory never shrinks, so this has to run BEFORE growth, not after.
//
//  * ISOLATE SHARING. Cloudflare may run several objects of one class in the
//    same isolate, sharing its 128 MB and its module globals. The engine is
//    one per isolate (cascade-core keeps its state on the global), so it is
//    shared: a lock serializes the sessions, and `owner` records whose
//    working set is loaded — a different session resets the kernel and
//    restores its own snapshot first.
//
//  * KEEP-WARM (off by default). An idle object with nothing pending
//    HIBERNATES after ~10 s and loses its memory; one that cannot hibernate
//    is evicted after 70-140 s without events. For KEEP_WARM_MS after the
//    last render the session holds a timer (which blocks hibernation) and
//    re-arms a storage alarm every ALARM_MS (an event, which defers
//    eviction); duration is billed while it is held. Measured on the edge
//    it buys little: the engine lives at ISOLATE scope, and the isolate
//    outlived the hibernated object across 15 s - 3 min gaps without it and
//    was gone after 7 min with or without it (EDIT-SESSIONS.md).

import { DurableObject } from 'cloudflare:workers';
import { FRAME, FRAMES_CONTENT_TYPE, GZIP_MIN_BYTES, frameHeader, gzipBytes, packMesh }
  from '../../../packages/cascade-core/src/engine/MeshCodec.js';
import { toBase64 } from '../../../packages/cascade-core/src/headless/PngEncode.js';
import { VIEWS } from '../../../packages/cascade-core/src/headless/MeshRaster.js';

const CHUNK_BYTES = 1900000;          // SQLite rows are capped at 2 MB
const ALARM_MS = 30000;
const SNAPSHOT_MAGIC = 0x43534331;    // 'CSC1'
/** Errors that mean the kernel itself faulted (vs a Python error). */
const KERNEL_FAULT = /OPENCASCADE|OCCT kernel|memory access out of bounds|RuntimeError: unreachable|null function/;

/** Isolate-scope state, shared by every EditSession in this isolate. */
const isolate = {
  id: Math.random().toString(36).slice(2, 10),
  startedAt: Date.now(),
  owner: null,          // ctx.id of the session whose working set is loaded
  lock: Promise.resolve(),
  renders: 0,
  compactions: 0,
  bootMs: null,
  // which render's scene + modeling history the engine holds (`<key>:<n>`);
  // null after anything that rewound the kernel
  lastRun: null,
  runSeq: 0,
};

/** Every kernel rewind goes through here: it also discards the scene and
 *  the history steps of the last render. */
function rewind(e) {
  e.resetKernel();
  isolate.lastRun = null;
}

function withEngine(fn) {
  const run = isolate.lock.then(fn, fn);
  isolate.lock = run.catch(() => {});
  return run;
}

const yieldToIo = () => new Promise((resolve) => setTimeout(resolve, 1));

async function pipeThrough(bytes, stream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** snapshotCache() output -> one gzipped byte array (header JSON + BREP). */
async function packSnapshot(snap) {
  const header = new TextEncoder().encode(JSON.stringify({
    format: snap.format, pySrc: snap.pySrc, shapes: snap.shapes,
    entries: snap.entries, skipped: snap.skipped,
  }));
  const bin = snap.bin || new Uint8Array(0);
  const raw = new Uint8Array(8 + header.length + bin.length);
  const dv = new DataView(raw.buffer);
  dv.setUint32(0, SNAPSHOT_MAGIC);
  dv.setUint32(4, header.length);
  raw.set(header, 8);
  raw.set(bin, 8 + header.length);
  return { raw: raw.length, gz: await pipeThrough(raw, new CompressionStream('gzip')) };
}

async function unpackSnapshot(gz) {
  const raw = await pipeThrough(gz, new DecompressionStream('gzip'));
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (dv.getUint32(0) !== SNAPSHOT_MAGIC) { return null; }
  const hlen = dv.getUint32(4);
  const header = JSON.parse(new TextDecoder().decode(raw.subarray(8, 8 + hlen)));
  header.bin = raw.slice(8 + hlen);
  return header;
}

/** A fingerprint of the cache's key set: same keys = same content. */
function keySetDigest() {
  const keys = Object.keys(globalThis.self.argCache || {}).filter((k) => k[0] === 'k').sort();
  let h = 0;
  for (const k of keys) { for (let i = 0; i < k.length; i++) { h = (Math.imul(h, 31) + k.charCodeAt(i)) | 0; } }
  return keys.length + ':' + (h >>> 0).toString(16);
}

/** A mistake in the call (shown to the agent), as opposed to a fault. */
class UserError extends Error {}

const MAX_SCRIPT_BYTES = 256 * 1024;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 32 * 1024 * 1024;

const toolText = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });
const randomId = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)),
  (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
const fmt = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(3));
const bboxText = (b) => (b ? '[' + b.slice(0, 3).map(fmt).join(', ') + '] .. [' + b.slice(3).map(fmt).join(', ')
  + '] (size ' + [b[3] - b[0], b[4] - b[1], b[5] - b[2]].map(fmt).join(' x ') + ')' : 'none');
/** Script output worth showing: not the engine's own log lines. */
const userLogs = (logs) => (logs || []).filter((l) => !/^(Cache: |\[pyruntime\] )/.test(l));
const logsText = (r) => {
  const logs = userLogs(r.logs);
  return logs.length ? '\nprint output:\n' + logs.slice(-40).join('\n') : '';
};

/** One line per shown shape: what the agent needs after every run. */
function sceneText(e, r) {
  if (!r.shapeCount) { return 'shapes: none shown (call show(obj), or leave a shape in a module variable)'; }
  let shapes = [];
  try { shapes = e.inspectShapes({ quick: true }); } catch (err) { shapes = []; }
  return 'shapes: ' + shapes.length + '\n' + shapes.map((s) => '  [' + s.index + '] ' + (s.type || '?')
    + (s.line ? ' (line ' + s.line + ')' : '') + ': ' + (s.solids || 0) + ' solid(s), ' + (s.faces || 0)
    + ' faces, volume ' + fmt(s.volume || 0) + ' mm^3, bbox ' + bboxText(s.bbox)
    + (s.error ? ' — ' + s.error : '')).join('\n');
}

const MIME = { step: 'model/step', stl: 'model/stl', brep: 'application/octet-stream',
  glb: 'model/gltf-binary', svg: 'image/svg+xml' };

/** Tool implementations: `this` is the EditSession, `e` the engine (the
 *  engine lock is held). Throw UserError for the caller's mistakes. */
const MCP_TOOLS = {
  async execute(e, a) {
    if (typeof a.code !== 'string' || !a.code.trim()) { throw new UserError('"code" is empty'); }
    let cur = this.script().code;
    // The last show() wins: lite's first show() of a run defines the scene and
    // later ones append (COMPROMISE(show-semantics)), so a chunk that shows
    // the model again would leave its earlier version in the scene too.
    // Earlier one-line top-level show(...) calls are commented out — visible
    // in get_script, and the same script then shows the same thing in the
    // editor.
    if (/^show\(/m.test(a.code)) {
      cur = cur.replace(/^(show\(.*\))[ \t]*$/gm, '# $1  # superseded by a later show()');
    }
    let prefix = cur ? cur.replace(/\s*$/, '') + '\n' : '';
    if (!cur.trim() && !/^\s*(from|import)\s+build123d/m.test(a.code)) { prefix = 'from build123d import *\n'; }
    const offset = prefix ? prefix.split('\n').length - 1 : 0;
    return this.runAsScript(e, prefix + a.code, { source: 'agent', rollback: true, offset, label: 'appended to' });
  },

  async set_script(e, a) {
    if (typeof a.code !== 'string') { throw new UserError('"code" is missing'); }
    return this.runAsScript(e, a.code, { source: 'agent', label: 'replaced' });
  },

  async get_script() {
    const sc = this.script();
    const numbered = sc.code.split('\n').map((l, i) => String(i + 1).padStart(4) + '  ' + l).join('\n');
    return toolText('rev ' + sc.rev + (sc.source ? ', last changed by the ' + sc.source : '')
      + (sc.at ? ' at ' + new Date(sc.at).toISOString() : '') + '\n' + (sc.code ? numbered : '(empty)'));
  },

  async render_view(e, a) {
    const r = await this.ensureScene(e);
    if (!r.shapeCount) {
      throw new UserError('nothing to render: the script shows no shapes' + (r.errors && r.errors.length
        ? ' (it raised: ' + r.errors[0].split('\n')[0] + ')' : ''));
    }
    const last = this.meta('last') || {};
    const dev = Number((last.gui && last.gui.MeshRes) || last.maxDeviation) || 0.1;
    if (a.format === 'svg') {
      const d = e.drawingSVG({ view: a.view, azimuth: a.azimuth, elevation: a.elevation,
        width: a.width, height: a.height, hidden: a.hidden });
      const f = this.storeFile('drawing-' + (a.view || 'iso') + '.svg', MIME.svg, new TextEncoder().encode(d.svg));
      const head = 'SVG hidden-line drawing, view az ' + d.view.azimuth + ' el ' + d.view.elevation + ': '
        + d.visible + ' visible and ' + d.hidden + ' hidden lines, ' + fmt(d.size[0]) + ' x ' + fmt(d.size[1])
        + ' mm in the view plane.\nfile: ' + f.url + ' (' + (f.bytes / 1024).toFixed(0) + ' KB, kept '
        + f.expiresInS + ' s)';
      return { content: [{ type: 'text', text: f.bytes <= 40000 ? head + '\n\n' + d.svg : head
        + '\n(too large to show inline; download it)' }], after: {} };
    }
    const shapes = e.inspectShapes({ quick: true });
    const sel = Array.isArray(a.shapes) && a.shapes.length ? shapes.filter((s) => a.shapes.includes(s.index)) : shapes;
    const boxes = sel.map((s) => s.bbox).filter(Boolean);
    const bb = boxes.length ? [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b[k])))
      .concat([3, 4, 5].map((k) => Math.max(...boxes.map((b) => b[k])))) : null;
    const custom = Number.isFinite(a.azimuth) || Number.isFinite(a.elevation);
    const viewName = custom ? 'custom' : (VIEWS[a.view] ? a.view : 'iso');
    const preset = VIEWS[a.view] || VIEWS.iso;
    const az = Number.isFinite(a.azimuth) ? a.azimuth : preset[0];
    const el = Number.isFinite(a.elevation) ? a.elevation : preset[1];
    const img = await e.renderPNG({ azimuth: az, elevation: el,
      width: a.width, height: a.height, shapes: a.shapes, highlight: a.highlight, edges: a.edges,
      maxDeviation: dev, labels: [viewName.toUpperCase() + '  AZ ' + Math.round(az) + ' EL ' + Math.round(el),
        bb ? [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map(fmt).join(' × ') + ' MM' : ''] });
    return { content: [
      { type: 'image', data: toBase64(img.png), mimeType: 'image/png' },
      { type: 'text', text: 'view ' + viewName + ' (azimuth ' + img.view.azimuth + ', elevation ' + img.view.elevation
        + '), orthographic, ' + img.width + 'x' + img.height + ' px, ' + fmt(img.scale) + ' px/mm. '
        + sel.length + ' shape(s); bbox ' + bboxText(bb) },
    ], after: {} };
  },

  async measure(e, a) {
    await this.ensureScene(e);
    let shapes = a.exact_bbox ? e.inspectShapes({ exactBox: true })
      : this.inspectFull(e).map((x) => Object.assign({}, x));
    if (Number.isInteger(a.shape)) { shapes = shapes.filter((s) => s.index === a.shape); }
    if (!shapes.length) { throw new UserError('no such shape: ' + a.shape); }
    if (Number.isFinite(a.density)) {
      for (const s of shapes) { s.massGrams = fmt((s.volume || 0) * a.density / 1000); s.density = a.density; }
    }
    return toolText(JSON.stringify({ units: 'mm, mm^2, mm^3', shapes }, null, 1));
  },

  async validate(e) {
    const r = await this.ensureScene(e);
    const shapes = r.shapeCount ? this.inspectFull(e) : [];
    const reasons = []; const warnings = [];
    if (!r.ok) { reasons.push('the script raised: ' + (r.errors[0] || '').split('\n')[0]); }
    if (!shapes.length) { reasons.push('no shapes are shown'); }
    for (const s of shapes) {
      const tag = '[' + s.index + ']';
      if (s.error) { reasons.push(tag + ' ' + s.error); continue; }
      if (!s.valid) { reasons.push(tag + ' fails BRepCheck (invalid topology or geometry)'); }
      if (s.solids === 0) { warnings.push(tag + ' has no solid (a sketch, surface or curve)'); }
      if (s.solids > 0 && !(s.volume > 0)) { reasons.push(tag + ' has solids but no positive volume'); }
      if (s.solids > 1) { warnings.push(tag + ' has ' + s.solids + ' disjoint solids'); }
    }
    return toolText((reasons.length ? 'FAIL' : 'PASS') + '\n' + JSON.stringify({ reasons, warnings,
      shapes: shapes.map((s) => ({ index: s.index, type: s.type, valid: s.valid, solids: s.solids,
        volume: s.volume })) }, null, 1), reasons.length > 0);
  },

  async export(e, a) {
    const format = String(a.format || '').toLowerCase();
    if (!MIME[format]) { throw new UserError('format must be one of step, stl, brep, glb, svg'); }
    const r = await this.ensureScene(e);
    if (!r.shapeCount) { throw new UserError('nothing to export: the script shows no shapes'); }
    const base = String(a.filename || 'model').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/\.[A-Za-z0-9]+$/, '') || 'model';
    let bytes;
    let clear = false;
    if (format === 'step') { bytes = new TextEncoder().encode(e.exportSTEP()); }
    else if (format === 'brep') { bytes = new TextEncoder().encode(e.exportBREP()); }
    else if (format === 'stl') { bytes = new TextEncoder().encode(e.exportSTL()); clear = true; }
    else if (format === 'glb') { bytes = e.exportGLB(); }
    else { bytes = new TextEncoder().encode(e.drawingSVG({ view: a.view }).svg); }
    const f = this.storeFile(base + '.' + format, MIME[format], bytes);
    await this.flush();
    const shapes = e.inspectShapes({ quick: true });
    const vol = shapes.reduce((n, s) => n + (s.volume || 0), 0);
    return { content: [{ type: 'text', text: format.toUpperCase() + ' ' + (f.bytes / 1024).toFixed(1) + ' KB: '
      + f.url + '\n(kept ' + f.expiresInS + ' s) ' + shapes.length + ' shape(s), total volume ' + fmt(vol)
      + ' mm^3' + (format === 'glb' ? ', in metres with Y up' : '') }], after: { clear } };
  },

  async session_state() {
    const sc = this.script();
    const res = this.lastResult || this.meta('result');
    const snaps = this.ctx.storage.sql.exec('SELECT name, rev, at FROM snapshots ORDER BY at').toArray();
    const files = this.ctx.storage.sql.exec('SELECT id, name, bytes, expires FROM filemeta WHERE expires > ? ORDER BY created',
      Date.now()).toArray();
    return toolText(JSON.stringify({
      session: this.sessionName,
      editor: this.origin + '/?session=' + encodeURIComponent(this.sessionName),
      script: { rev: sc.rev, lastChangedBy: sc.source, at: sc.at ? new Date(sc.at).toISOString() : null,
        lines: sc.code ? sc.code.split('\n').length : 0,
        text: sc.code.length <= 3000 ? sc.code : sc.code.slice(0, 1500) + '\n...\n(use get_script for the rest)' },
      lastRun: res ? { rev: res.rev, ok: res.ok, rejected: !!res.rejected, shapes: res.shapeCount,
        errors: res.errors.map((x) => x.split('\n')[0]), cache: res.cache,
        at: new Date(res.at).toISOString() } : null,
      snapshots: snaps.map((s) => ({ name: s.name, rev: s.rev, at: new Date(s.at).toISOString() })),
      files: files.map((f) => ({ name: f.name, bytes: f.bytes,
        url: this.origin + '/session/' + encodeURIComponent(this.sessionName) + '/files/' + f.id + '/' + encodeURIComponent(f.name),
        expiresInS: Math.round((f.expires - Date.now()) / 1000) })),
    }, null, 1));
  },

  async last_error() {
    const res = this.lastResult || this.meta('result');
    if (!res || !res.errors.length) { return toolText('no error in the last run' + (res ? ' (rev ' + res.rev + ')' : '')); }
    const lines = this.script().code.split('\n');
    const out = res.errors.map((err) => {
      const hits = [...String(err).matchAll(/File "main", line (\d+)/g)];
      const n = hits.length ? Number(hits[hits.length - 1][1]) : 0;
      let ctx = '';
      if (n > 0 && !res.rejected) {
        ctx = '\n' + lines.slice(Math.max(0, n - 3), n + 2).map((l, i) => {
          const k = Math.max(0, n - 3) + i + 1;
          return (k === n ? '>' : ' ') + String(k).padStart(4) + '  ' + l;
        }).join('\n');
      }
      return err + ctx;
    });
    return toolText((res.rejected ? 'The last execute was rolled back; its error (line numbers are of the script it would have made):\n'
      : 'rev ' + res.rev + ':\n') + out.join('\n\n'));
  },

  async reset() {
    const sc = this.saveScript('', 'agent');
    this.lastRunRev = null;
    this.recordResult(sc.rev, { ok: true, errors: [], logs: [], shapeCount: 0 });
    return toolText('Session reset: the script is empty (rev ' + sc.rev + '). Snapshots and files are kept.');
  },

  async save_snapshot(e, a) {
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(String(a.name || ''))) { throw new UserError('a snapshot "name" is needed (letters, digits, _ . -)'); }
    const sc = this.script();
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO snapshots (name, code, rev, at) VALUES (?, ?, ?, ?)',
      a.name, sc.code, sc.rev, Date.now());
    return toolText('saved snapshot "' + a.name + '" (script rev ' + sc.rev + ', ' + sc.code.split('\n').length + ' lines)');
  },

  async restore_snapshot(e, a) {
    const row = this.ctx.storage.sql.exec('SELECT code, rev FROM snapshots WHERE name = ?', String(a.name || '')).toArray()[0];
    if (!row) { throw new UserError('no snapshot named "' + a.name + '"'); }
    return this.runAsScript(e, row.code, { source: 'agent', label: 'restored snapshot "' + a.name + '" (from rev ' + row.rev + ') into' });
  },

  async open_in_editor() {
    return toolText(this.origin + '/?session=' + encodeURIComponent(this.sessionName)
      + '\nThe CascadeStudio editor on this session: the model, the script, the timeline. Edits made there show up in '
      + 'session_state and get_script; changes made here appear in the open editor.');
  },
};

/**
 * @param worker   createWorker(...) result (app.js) built with stableCache
 * @param o.flavor 'lite' | 'upstream' (for the snapshot salt and reports)
 * @param o.bundleId build id of the engine bundle: a snapshot written by
 *        another build is ignored (its keys may mean something else)
 */
export function createSession(worker, o) {
  const salt = o.flavor + ':' + o.bundleId;

  class EditSession extends DurableObject {
    constructor(ctx, env) {
      super(ctx, env);
      this.key = ctx.id.toString();
      this.instance = { id: Math.random().toString(36).slice(2, 10), createdAt: Date.now(), renders: 0 };
      this.compactAtMB = Number(env.COMPACT_AT_MB || 48);
      this.keepWarmMs = Number(env.KEEP_WARM_MS || 0);
      this.keepWarmUntil = 0;
      this.warmTimer = null;
      this.persistedDigest = null;
      this.lastPersist = null;
      this.lastRestore = null;
      // MCP: limits, and which script revision the engine's last run was
      this.callsPerMin = Number(env.MCP_CALLS_PER_MIN || 60);
      this.callsPerDay = Number(env.MCP_CALLS_PER_DAY || 3000);
      this.fileTtlS = Number(env.FILE_TTL_S || 3600);
      this.lastRunRev = null;
      this.lastRunKept = false;
      this.lastResult = null;
      this.origin = '';
      this.ensureTables();
      this.sessionName = this.meta('name') || this.key.slice(0, 16);
    }

    ensureTables() {
      // (deleteAll() drops the tables too, so DELETE calls this again)
      const sql = this.ctx.storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS snap (seq INTEGER PRIMARY KEY, data BLOB)');
      sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
      sql.exec('CREATE TABLE IF NOT EXISTS snapshots (name TEXT PRIMARY KEY, code TEXT, rev INTEGER, at INTEGER)');
      sql.exec('CREATE TABLE IF NOT EXISTS files (id TEXT, seq INTEGER, data BLOB, PRIMARY KEY (id, seq))');
      sql.exec('CREATE TABLE IF NOT EXISTS filemeta (id TEXT PRIMARY KEY, name TEXT, type TEXT, bytes INTEGER, '
        + 'chunks INTEGER, created INTEGER, expires INTEGER)');
    }

    meta(k) {
      const rows = this.ctx.storage.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray();
      return rows.length ? JSON.parse(rows[0].v) : null;
    }

    async loadSnapshot() {
      const m = this.meta('snapshot');
      if (!m || m.salt !== salt) { return null; }
      const rows = this.ctx.storage.sql.exec('SELECT data FROM snap ORDER BY seq').toArray();
      const total = rows.reduce((n, r) => n + r.data.byteLength, 0);
      if (total !== m.bytes) { return null; }
      const gz = new Uint8Array(total);
      let off = 0;
      for (const r of rows) { gz.set(new Uint8Array(r.data), off); off += r.data.byteLength; }
      const snap = await unpackSnapshot(gz);
      if (snap) { this.persistedDigest = m.digest; }
      return snap;
    }

    async persist(snap, digest) {
      const t0 = Date.now();
      const sql = this.ctx.storage.sql;
      if (!snap) {
        sql.exec('DELETE FROM snap');
        sql.exec('DELETE FROM meta WHERE k = ?', 'snapshot');
        this.persistedDigest = digest;
        this.lastPersist = { at: Date.now(), bytes: 0 };
        return;
      }
      const { raw, gz } = await packSnapshot(snap);
      let chunks = 0;
      this.ctx.storage.transactionSync(() => {
        sql.exec('DELETE FROM snap');
        for (let i = 0; i < gz.length; i += CHUNK_BYTES) {
          sql.exec('INSERT INTO snap (seq, data) VALUES (?, ?)', chunks++,
            gz.slice(i, i + CHUNK_BYTES).buffer);
        }
        sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', 'snapshot',
          JSON.stringify({ salt, digest, bytes: gz.length, raw, chunks,
            entries: snap.entries.length, shapes: snap.shapes, at: Date.now() }));
      });
      this.persistedDigest = digest;
      this.lastPersist = { at: Date.now(), ms: Date.now() - t0, rawBytes: raw,
        gzBytes: gz.length, chunks, entries: snap.entries.length };
    }

    /** Make sure the engine holds THIS session's working set. */
    async adopt(e) {
      if (isolate.owner === this.key) { return { warm: true, restore: null }; }
      const t0 = Date.now();
      if (isolate.owner !== null) { rewind(e); }
      isolate.owner = this.key;
      const snap = await this.loadSnapshot();
      let restore = null;
      if (snap) {
        const t1 = Date.now();
        restore = Object.assign(e.restoreCache(snap), { restoreMs: Date.now() - t1,
          totalMs: Date.now() - t0 });
      }
      this.lastRestore = restore;
      return { warm: false, restore };
    }

    keepWarm() {
      if (!this.keepWarmMs) { return; }
      this.keepWarmUntil = Date.now() + this.keepWarmMs;
      this.armTimer();
      this.ctx.storage.getAlarm().then((at) => {
        if (at === null) { return this.ctx.storage.setAlarm(Date.now() + ALARM_MS); }
        return null;
      });
    }

    armTimer() {
      if (this.warmTimer) { clearTimeout(this.warmTimer); }
      // a pending timer is what keeps an idle object from hibernating
      this.warmTimer = setTimeout(() => { this.warmTimer = null; }, ALARM_MS + 10000);
    }

    async alarm() {
      if (Date.now() < this.keepWarmUntil) {
        this.armTimer();
        await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
      } else if (this.warmTimer) {
        clearTimeout(this.warmTimer);
        this.warmTimer = null;
      }
    }

    /** Where one job's answer goes: plain JSON, or — for the editor's mesh
     *  and history requests — a framed stream (cascade-core MeshCodec.js)
     *  that is answered AT ONCE and carries a phase event per await boundary
     *  (booting, restoring, evaluating, ...) until the result, so a cold
     *  start shows what it is doing. */
    channel(frames) {
      if (!frames) {
        let respond;
        const response = new Promise((resolve) => { respond = resolve; });
        return {
          response,
          phase: async () => {},
          finish: async (out, status) => { respond(worker.json(out, status)); },
        };
      }
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      let open = true;
      const send = async (kind, body) => {
        if (!open) { return; }
        try {
          let bytes = ArrayBuffer.isView(body)
            ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
            : new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body));
          if (bytes.length >= GZIP_MIN_BYTES) {
            bytes = await gzipBytes(bytes);
            kind |= FRAME.GZIP;
          }
          await writer.write(frameHeader(kind, bytes.length));
          await writer.write(bytes);
        } catch (err) { open = false; return; }   // the client went away
        // enqueued is not flushed: let the runtime write it out before the
        // next synchronous stretch of wasm holds the isolate
        await yieldToIo();
      };
      return {
        response: Promise.resolve(new Response(readable, { headers: {
          'content-type': FRAMES_CONTENT_TYPE, 'cache-control': 'no-store' } })),
        phase: (phase, detail) => send(FRAME.PHASE, Object.assign({ phase }, detail)),
        /** `mesh` (optional): an incremental mesh to stream after the
         *  result — {batches, shapeLines, client} (engine.meshScene() plus
         *  the client's cache state, meshClientFor()). */
        finish: async (out, status, mesh) => {
          if (!open) { return; }
          let packed = null;
          if (out.mesh) {
            const { shapeLines, ...lists } = out.mesh;
            packed = packMesh(lists);
            out.mesh = { lists: packed.meta, shapeLines,
              f32: packed.f32.length, u32: packed.u32.length };
          }
          out.status = status;
          if (mesh) { out.meshStream = { shapeLines: mesh.shapeLines }; }
          await send(FRAME.RESULT, out);
          if (packed) {
            await send(FRAME.F32, packed.f32);
            await send(FRAME.U32, packed.u32);
          }
          if (mesh) { await this.streamMesh(send, mesh); }
          open = false;
          try { await writer.close(); } catch (err) { /* already gone */ }
        },
      };
    }

    /** The client's face-mesh cache, as this object knows it: the ids of
     *  the faces it was sent (and told to keep). Keyed by the page's
     *  `clientCache` id, so a reload — a fresh client cache — starts over. */
    meshClientFor(clientId) {
      if (!clientId) { return { id: null, known: new Set() }; }
      if (!this.meshClient || this.meshClient.id !== clientId) {
        this.meshClient = { id: clientId, known: new Set() };
      }
      return this.meshClient;
    }

    /** Stream an incremental mesh: per batch a MESH frame (faces the client
     *  already holds go as {slot, id, ref}) and its F32/U32 buffers, then
     *  DONE with the stats and the ids the client should keep. Each send
     *  yields, so a batch reaches the client while the next one meshes. */
    async streamMesh(send, mesh) {
      const known = mesh.client.known;
      let stats = null;
      try {
        for (;;) {
          const { value, done } = mesh.batches.next();
          if (done) { stats = value; break; }
          const faces = value.faces.map((f) => {
            if (f.reused && f.id && known.has(f.id)) {
              return { slot: f.slot, id: f.id, face_index: f.face_index, shape_index: f.shape_index, ref: 1 };
            }
            if (f.id) { known.add(f.id); }
            const { reused, ...full } = f;
            return full;
          });
          const packed = packMesh({ faces, edges: value.edges });
          await send(FRAME.MESH, { lists: packed.meta, total: value.total, reused: value.reused });
          await send(FRAME.F32, packed.f32);
          await send(FRAME.U32, packed.u32);
        }
      } catch (err) {
        await send(FRAME.DONE, { error: 'meshing failed: ' + ((err && err.message) || err) });
        mesh.client.known = new Set();
        return;
      }
      const live = new Set(mesh.live());
      const keep = Array.from(known).filter((id) => live.has(id));
      mesh.client.known = new Set(keep);
      await send(FRAME.DONE, { stats, keep });
    }

    /** Run `fn(e)` under the engine lock with the session's channel; an
     *  exception rewinds the engine (its state is unknown) and is answered
     *  as a 500. */
    job(ch, fn) {
      const job = withEngine(async () => {
        const booted = worker.isBooted();
        const t0 = performance.now();
        if (!booted) { await ch.phase('booting'); }
        const e = await worker.engine();
        if (!booted) { isolate.bootMs = Math.round(performance.now() - t0); }
        return fn(e, { booted, bootMs: Math.round(performance.now() - t0) });
      });
      job.catch((err) => {
        // the engine state is unknown: rewind it, restore from storage next time
        if (isolate.owner === this.key) {
          worker.engine().then((e) => { rewind(e); }).catch(() => {});
          isolate.owner = null;
        }
        ch.finish({ ok: false, errors: ['session: ' + ((err && err.message) || err)] }, 500);
      });
      this.ctx.waitUntil(job.catch(() => {}));
      return ch.response;
    }

    /** adopt(), announcing a restore from storage on the channel. */
    async adoptWithPhase(e, ch) {
      if (isolate.owner !== this.key && this.meta('snapshot')) {
        await ch.phase('restoring', { bytes: this.meta('snapshot').bytes });
      }
      return this.adopt(e);
    }

    /** The scene and modeling history of this session's last render, in the
     *  engine — re-running its code (all cache hits) when anything rewound
     *  the kernel or another session ran since. null: nothing rendered yet. */
    async ensureLastRun(e, ch) {
      if (isolate.owner === this.key && isolate.lastRun !== null
          && isolate.lastRun === this.lastRun) {
        return { rerun: false };
      }
      const last = this.meta('last') || {};
      const sc = this.script();
      if (!sc.code.trim()) { return null; }
      await this.adoptWithPhase(e, ch);
      await ch.phase('re-running');
      const r = await e.run(sc.code, { language: last.language, mesh: false, keepScene: true,
        guiState: last.gui || undefined });
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
      this.lastRunRev = sc.rev;
      this.lastRunKept = true;
      this.recordResult(sc.rev, r);
      await this.flush();
      return { rerun: true, ok: r.ok };
    }

    async render(request) {
      let body;
      try { body = await request.json(); }
      catch (err) { return worker.json({ ok: false, error: 'invalid JSON body' }, 400); }
      const req = worker.parseRenderBody(body);
      if (req.error) { return worker.json({ ok: false, error: req.error }, 400); }

      const frames = req.formats.includes('mesh');
      // the editor's incremental, streamed mesh (older clients: one mesh)
      const stream = frames && body.meshStream === true;
      const ch = this.channel(frames);
      const tArrive = performance.now();
      return this.job(ch, async (e, boot) => {
        const t1 = performance.now();
        const { warm, restore } = await this.adoptWithPhase(e, ch);
        const t2 = performance.now();
        const out = await worker.runRender(e, req, ch.phase, { reset: false, keepScene: stream });
        const t3 = performance.now();
        isolate.renders++;
        this.instance.renders++;
        isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
        // what history/export re-run when the engine lost this render
        this.setMeta('last', { language: req.language, gui: req.gui, maxDeviation: req.maxDeviation });
        // the editor's code IS the session script (an agent sees the edit)
        const sc = this.saveScript(req.code, 'editor');
        this.lastRunRev = sc.rev;
        this.lastRunKept = stream;
        this.recordResult(sc.rev, out);
        out.session = {
          id: this.key.slice(0, 12),
          instance: this.instance.id,
          isolate: isolate.id,
          engineBooted: !boot.booted,
          warm,
          restore,
          lastPersist: this.lastPersist,
          renders: this.instance.renders,
          // server phases (ms; the edge's clock only advances across I/O)
          timing: { lockWaitMs: Math.round(t1 - tArrive - boot.bootMs), bootMs: boot.bootMs,
            adoptMs: Math.round(t2 - t1), renderMs: Math.round(t3 - t2) },
          // what the PREVIOUS render's post-response work cost
          previousAfter: this.lastAfter || null,
          scriptRev: sc.rev,
        };
        const m = stream ? e.meshScene({ maxDeviation: req.maxDeviation }) : null;
        await ch.finish(out, out.ok ? 200 : 422, m && m.shapeLines.length ? {
          batches: m.batches, shapeLines: m.shapeLines,
          client: this.meshClientFor(body.clientCache), live: () => e.meshCache.liveIds(),
        } : null);
        this.keepWarm();

        // ---- after the response: compaction and persistence ----
        await yieldToIo();
        const faulted = !out.ok && KERNEL_FAULT.test((out.errors || []).join('\n'));
        // meshes written into cached shapes (the viewport mesh, STL export,
        // measure) must not outlive this render — see engine.clearMeshes()
        this.lastAfter = await this.afterRun(e, { clear: frames || req.formats.includes('stl') || req.measure,
          faulted, misses: out.cache ? out.cache.misses : null });
      });
    }

    /** After a run: drop meshes written into cached shapes (`clear`),
     *  compact when the OCCT heap reached COMPACT_AT_MB or the kernel
     *  faulted, persist the working set when its keys changed. `ran`: an
     *  evaluation happened (it leaks its intermediates into the heap). A
     *  call that only looked at the existing scene — render, measure,
     *  export, or a re-run that was all cache hits (`misses: 0`) — compacts
     *  only if the heap grew: compaction rewinds the kernel, and the next
     *  call would re-run the whole script (and compact again, and again). */
    async afterRun(e, { clear = false, faulted = false, ran = true, misses = null } = {}) {
      const a0 = performance.now();
      const after = { compacted: false };
      if (clear) {
        const m0 = performance.now();
        after.meshesCleared = e.clearMeshes();
        after.clearMs = Math.round(performance.now() - m0);
      }
      const digest = keySetDigest();
      const occtMB = globalThis.self.ocMemory.buffer.byteLength / 1048576;
      after.occtMB = Math.round(occtMB * 10) / 10;
      // A kernel fault can leave OCCT's statics damaged (the stateless
      // Worker rewinds after EVERY job for exactly this): rewind after one
      // too, keeping the working set through the snapshot.
      // A run with cache misses leaves its intermediates in the heap: compact
      // at COMPACT_AT_MB. Anything else (an all-hits re-run, a render's
      // meshing, an export) mostly frees what it allocates — the heap's high
      // water mark rises once and stays — so it compacts only at a hard cap.
      const leaky = ran && (misses === null || misses > 0);
      const compact = faulted || occtMB >= (leaky ? this.compactAtMB : this.compactAtMB + 40);
      if (faulted) { after.faulted = true; }
      if (digest !== this.persistedDigest || compact) {
        const s0 = performance.now();
        const snap = e.snapshotCache();
        after.snapshotMs = Math.round(performance.now() - s0);
        if (compact) {
          const c0 = performance.now();
          rewind(e);
          if (snap) { e.restoreCache(snap); }
          isolate.compactions++;
          after.compacted = true;
          after.compactMs = Math.round(performance.now() - c0);
        }
        if (digest !== this.persistedDigest) {
          const p0 = performance.now();
          await this.persist(snap, digest);
          after.persistMs = Math.round(performance.now() - p0);
        }
      }
      after.totalMs = Math.round(performance.now() - a0);
      return after;
    }

    /** One step of the last render's modeling history, meshed (the
     *  editor's timeline). */
    async history(request) {
      let body;
      try { body = await request.json(); }
      catch (err) { return worker.json({ ok: false, error: 'invalid JSON body' }, 400); }
      const step = Number(body && body.step);
      if (!Number.isInteger(step) || step < 0) {
        return worker.json({ ok: false, error: 'missing integer "step"' }, 400);
      }
      const dev = Number(body.maxDeviation);
      const maxDeviation = Number.isFinite(dev) ? Math.min(10, Math.max(0.005, dev)) : 0.1;
      const ch = this.channel(true);
      return this.job(ch, async (e) => {
        const last = await this.ensureLastRun(e, ch);
        if (!last) {
          return ch.finish({ ok: false, errors: ['nothing has been rendered in this session yet'] }, 409);
        }
        if (body.meshStream === true) {
          const m = e.meshHistoryStepIncremental(step, { maxDeviation });
          await ch.finish({ ok: true, step, steps: e.historyLength, rerun: last.rerun }, 200,
            m ? { batches: m.batches, shapeLines: [], client: this.meshClientFor(body.clientCache),
              live: () => e.meshCache.liveIds() } : null);
          return;
        }
        const m0 = performance.now();
        const fe = e.meshHistoryStep(step, maxDeviation);
        await ch.finish({ ok: true, step, steps: e.historyLength, rerun: last.rerun,
          mesh: fe ? { faces: fe[0], edges: fe[1] } : null,
          timing: { meshMs: Math.round(performance.now() - m0) } }, 200);
        await yieldToIo();
        e.clearMeshes();
      });
    }

    /** The last render's shape as STEP/BREP/STL text. */
    async exportShape(request) {
      let body;
      try { body = await request.json(); }
      catch (err) { return worker.json({ ok: false, error: 'invalid JSON body' }, 400); }
      const format = String((body && body.format) || 'step').toLowerCase();
      if (!['step', 'brep', 'stl'].includes(format)) {
        return worker.json({ ok: false, error: 'format must be step, brep or stl' }, 400);
      }
      let respond;
      const response = new Promise((resolve) => { respond = resolve; });
      const ch = {
        response,
        phase: async () => {},
        finish: async (out, status) => { respond(worker.json(out, status)); },
      };
      return this.job(ch, async (e) => {
        const last = await this.ensureLastRun(e, ch);
        if (!last) {
          return ch.finish({ ok: false, errors: ['nothing has been rendered in this session yet'] }, 409);
        }
        const resets = e.kernelResets;
        let text;
        try {
          text = format === 'step' ? e.exportSTEP() : format === 'brep' ? e.exportBREP() : e.exportSTL();
        } catch (err) {
          return ch.finish({ ok: false, errors: [format + ' export failed: ' + err.message] }, 422);
        }
        // exportSTEP() heals a damaged kernel by rewinding it: the working
        // set is gone with it
        if (e.kernelResets !== resets) { isolate.lastRun = null; }
        respond(new Response(text, { headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-cascade-rerun': String(last.rerun) } }));
        if (format === 'stl') { await yieldToIo(); e.clearMeshes(); }
      });
    }

    // ================================================================== //
    // The session script, run records, snapshots, files and rate limits — //
    // shared by the editor's renders and the MCP tools.                  //
    // ================================================================== //

    /** The session script: {code, rev, source ('editor' | 'agent'), at}. */
    script() {
      return this.meta('script') || { code: (this.meta('last') || {}).code || '', rev: 0, source: null, at: null };
    }

    /** Store `code` as the session script; a change bumps the revision. */
    saveScript(code, source) {
      const cur = this.script();
      if (cur.code === code && cur.rev) { return cur; }
      const next = { code, rev: (cur.rev || 0) + 1, source, at: Date.now() };
      this.setMeta('script', next);
      return next;
    }

    setMeta(k, v) {
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, JSON.stringify(v));
    }

    /** Let pending storage writes commit before a long synchronous stretch
     *  of wasm. A SQL write is applied at once but committed when the event
     *  loop turns; an evaluation that then holds the isolate for 30 s+ (a
     *  heavy model on the edge) times the commit out, and the runtime
     *  resets the object ("storage operation exceeded timeout"). */
    async flush() {
      try { await this.ctx.storage.sync(); }
      catch (err) { await yieldToIo(); }
    }

    /** What the last run did (session_state, last_error, the editor). */
    recordResult(rev, r, extra = {}) {
      const res = Object.assign({ rev, ok: !!r.ok, errors: (r.errors || []).slice(0, 20),
        logs: userLogs(r.logs).slice(-50),
        shapeCount: r.shapeCount || 0, cache: r.cache ? { hits: r.cache.hits, misses: r.cache.misses } : null,
        at: Date.now() }, extra);
      this.lastResult = res;
      this.setMeta('result', res);
      return res;
    }

    /** The engine holds this session's current script, run with its scene
     *  kept (re-running it — all cache hits — when not). */
    async ensureScene(e) {
      const sc = this.script();
      if (!sc.code.trim()) { throw new UserError('the session script is empty: use execute or set_script first'); }
      if (isolate.owner === this.key && isolate.lastRun !== null && isolate.lastRun === this.lastRun
          && this.lastRunRev === sc.rev && this.lastRunKept) {
        return this.lastResult || this.meta('result');
      }
      await this.adopt(e);
      const r = await e.run(sc.code, { keepScene: true, guiState: {} });
      this.ranThisCall = true;
      this.callMisses += r.cache ? r.cache.misses : 1;
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
      this.lastRunRev = sc.rev;
      this.lastRunKept = true;
      const res = this.recordResult(sc.rev, r);
      await this.flush();
      return res;
    }

    /** inspectShapes() of the engine's current run, computed once per run
     *  (BRepCheck and the exact bounding boxes are seconds on big models). */
    inspectFull(e) {
      if (!this.inspected || this.inspected.run !== isolate.lastRun || isolate.lastRun === null) {
        this.inspected = { run: isolate.lastRun, shapes: e.inspectShapes({ exactBox: false }) };
      }
      return this.inspected.shapes;
    }

    /** null, or why this call is over the session's rate limit. */
    rateLimited() {
      const now = Date.now();
      this.recentCalls = (this.recentCalls || []).filter((t) => now - t < 60000);
      if (this.recentCalls.length >= this.callsPerMin) {
        return 'rate limit: ' + this.callsPerMin + ' calls a minute per session; wait a little';
      }
      const day = new Date(now).toISOString().slice(0, 10);
      const usage = this.meta('usage');
      const calls = usage && usage.day === day ? usage.calls : 0;
      if (calls >= this.callsPerDay) { return 'rate limit: ' + this.callsPerDay + ' calls a day per session'; }
      this.recentCalls.push(now);
      this.setMeta('usage', { day, calls: calls + 1 });
      return null;
    }

    /** Keep `bytes` as a downloadable file for FILE_TTL_S; returns its URL. */
    storeFile(name, type, bytes) {
      const sql = this.ctx.storage.sql;
      const now = Date.now();
      for (const row of sql.exec('SELECT id FROM filemeta WHERE expires < ?', now).toArray()) { this.dropFile(row.id); }
      const live = sql.exec('SELECT id FROM filemeta ORDER BY created').toArray();
      for (let i = 0; i <= live.length - MAX_FILES; i++) { this.dropFile(live[i].id); }
      if (bytes.length > MAX_FILE_BYTES) {
        throw new UserError('the file is ' + (bytes.length / 1048576).toFixed(1) + ' MB, over the '
          + (MAX_FILE_BYTES / 1048576) + ' MB limit');
      }
      const id = randomId(12);
      let chunks = 0;
      this.ctx.storage.transactionSync(() => {
        const n = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
        for (let c = 0; c < n; c++) {
          sql.exec('INSERT INTO files (id, seq, data) VALUES (?, ?, ?)', id, chunks++,
            bytes.slice(c * CHUNK_BYTES, (c + 1) * CHUNK_BYTES).buffer);
        }
        sql.exec('INSERT INTO filemeta (id, name, type, bytes, chunks, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
          id, name, type, bytes.length, chunks, now, now + this.fileTtlS * 1000);
      });
      return { id, url: this.origin + '/session/' + encodeURIComponent(this.sessionName) + '/files/' + id + '/'
        + encodeURIComponent(name), bytes: bytes.length, expiresInS: this.fileTtlS };
    }

    dropFile(id) {
      this.ctx.storage.sql.exec('DELETE FROM files WHERE id = ?', id);
      this.ctx.storage.sql.exec('DELETE FROM filemeta WHERE id = ?', id);
    }

    serveFile(id) {
      const sql = this.ctx.storage.sql;
      const m = sql.exec('SELECT * FROM filemeta WHERE id = ?', id).toArray()[0];
      if (!m || m.expires < Date.now()) {
        if (m) { this.dropFile(id); }
        return worker.json({ ok: false, error: 'no such file (files are kept for ' + this.fileTtlS + ' s)' }, 404);
      }
      const out = new Uint8Array(m.bytes);
      let off = 0;
      for (const r of sql.exec('SELECT data FROM files WHERE id = ? ORDER BY seq', id).toArray()) {
        out.set(new Uint8Array(r.data), off);
        off += r.data.byteLength;
      }
      return new Response(out, { headers: { 'content-type': m.type,
        'content-disposition': 'attachment; filename="' + m.name.replace(/"/g, '') + '"',
        'cache-control': 'private, max-age=' + Math.max(0, Math.floor((m.expires - Date.now()) / 1000)) } });
    }

    // ================================================================== //
    // MCP tools (called over Durable Object RPC from mcp.js's handler).  //
    // ================================================================== //

    /** Run one MCP tool for this session; resolves an MCP tool result
     *  ({content, isError}). Housekeeping (compaction, persistence) runs
     *  after the result is returned. */
    async mcpTool(name, args = {}, meta = {}) {
      if (meta.origin) { this.origin = meta.origin; }
      if (meta.session && meta.session !== this.sessionName) {
        this.sessionName = meta.session;
        this.setMeta('name', meta.session);
      }
      const impl = MCP_TOOLS[name];
      if (!impl) { return toolText('unknown tool: ' + name, true); }
      const limited = this.rateLimited();
      if (limited) { return toolText(limited, true); }
      await this.flush();
      return new Promise((resolve) => {
        const job = withEngine(async () => {
          const booted = worker.isBooted();
          const t0 = performance.now();
          const e = await worker.engine();
          if (!booted) { isolate.bootMs = Math.round(performance.now() - t0); }
          let result;
          let after = null;
          this.ranThisCall = false;
          this.callMisses = 0;
          try {
            result = await impl.call(this, e, args);
          } catch (err) {
            if (!(err instanceof UserError)) { throw err; }
            result = toolText(err.message, true);
          }
          if (result.after) {
            after = Object.assign({ ran: this.ranThisCall, misses: this.callMisses }, result.after);
            delete result.after;
          }
          resolve(result);
          if (after) {
            await yieldToIo();
            this.lastAfter = await this.afterRun(e, after);
          }
        });
        job.catch((err) => {
          if (isolate.owner === this.key) {
            worker.engine().then((e) => { rewind(e); }).catch(() => {});
            isolate.owner = null;
          }
          resolve(toolText('session error: ' + ((err && err.message) || err), true));
        });
        this.ctx.waitUntil(job.catch(() => {}));
      });
    }

    /** Run `code` as the session script (execute, set_script, restore). */
    async runAsScript(e, code, { source, rollback = false, offset = 0, label = 'ran' }) {
      if (code.length > MAX_SCRIPT_BYTES) {
        throw new UserError('the script is over ' + (MAX_SCRIPT_BYTES / 1024) + ' KB');
      }
      await this.adopt(e);
      const r = await e.run(code, { keepScene: true, guiState: {} });
      this.ranThisCall = true;
      this.callMisses += r.cache ? r.cache.misses : 1;
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
      const faulted = !r.ok && KERNEL_FAULT.test(r.errors.join('\n'));
      const mapLines = (text) => (offset ? String(text).replace(/File "main", line (\d+)/g, (m, n) => {
        const k = Number(n) - offset;
        return k > 0 ? 'File "main", line ' + n + ' (line ' + k + ' of the code you sent)' : m;
      }) : String(text));
      let sc;
      if (!r.ok && rollback) {
        // the engine now holds the rejected run: the next tool re-runs the saved script
        this.lastRunRev = null;
        this.recordResult(this.script().rev, r, { rejected: true });
        return { content: [{ type: 'text', text: 'ERROR, nothing was appended: the session keeps its previous script.\n'
          + r.errors.map(mapLines).join('\n\n') + logsText(r) }], isError: true, after: { faulted } };
      }
      sc = this.saveScript(code, source);
      this.lastRunRev = sc.rev;
      this.lastRunKept = true;
      this.recordResult(sc.rev, r);
      await this.flush();
      const lines = [(r.ok ? 'OK' : 'ERROR') + ': ' + label + ' the session script (rev ' + sc.rev + ', '
        + code.split('\n').length + ' lines). session: ' + this.sessionName];
      if (!r.ok) { lines.push(r.errors.map(mapLines).join('\n\n')); }
      lines.push(sceneText(e, r));
      if (r.cache) { lines.push('cache: ' + r.cache.hits + ' hits, ' + r.cache.misses + ' misses'); }
      return { content: [{ type: 'text', text: lines.join('\n') + logsText(r) }], isError: !r.ok, after: { faulted } };
    }

    async stats() {
      const e = worker.isBooted() ? await worker.engine() : null;
      return worker.json({
        ok: true,
        flavor: o.flavor,
        session: this.key.slice(0, 12),
        instance: Object.assign({ ageMs: Date.now() - this.instance.createdAt }, this.instance),
        isolate: { id: isolate.id, ageMs: Date.now() - isolate.startedAt,
          ownerIsThis: isolate.owner === this.key, renders: isolate.renders,
          compactions: isolate.compactions, bootMs: isolate.bootMs },
        keepWarm: { ms: this.keepWarmMs, untilInMs: Math.max(0, this.keepWarmUntil - Date.now()),
          timer: !!this.warmTimer, alarm: await this.ctx.storage.getAlarm() },
        storage: { snapshot: this.meta('snapshot'), lastPersist: this.lastPersist,
          lastRestore: this.lastRestore },
        cacheEntries: e && isolate.owner === this.key
          ? Object.keys(globalThis.self.argCache).length : null,
        memory: e ? e.memoryStats() : null,
      });
    }

    async fetch(request) {
      const url = new URL(request.url);
      const nameMatch = url.pathname.match(/^\/session\/([^/]+)/);
      if (nameMatch) {
        const name = decodeURIComponent(nameMatch[1]);
        if (name !== this.sessionName) { this.sessionName = name; this.setMeta('name', name); }
      }
      this.origin = url.origin;
      const action = (url.pathname.match(/^\/session\/[^/]+(\/.*)?$/) || [])[1] || '/';
      if (action === '/script' && request.method === 'GET') {
        const sc = this.script();
        const known = Number(url.searchParams.get('rev'));
        // the editor polls with ?rev=<what it has>: only send the text on a change
        return worker.json(Object.assign({ ok: true, rev: sc.rev, source: sc.source, at: sc.at },
          known === sc.rev ? {} : { code: sc.code }));
      }
      const fileMatch = action.match(/^\/files\/([a-z0-9]{6,32})(\/.*)?$/);
      if (fileMatch && request.method === 'GET') { return this.serveFile(fileMatch[1]); }
      // The MCP tools over plain HTTP, for agents without an MCP client:
      //   POST /session/<id>/tools/<name>  {args}  -> the MCP tool result
      //   GET  /session/<id>/view.png?view=iso     -> render_view's PNG
      const meta = { session: this.sessionName, origin: this.origin };
      const toolMatch = action.match(/^\/tools\/([a-z_]{2,40})$/);
      if (toolMatch && request.method === 'POST') {
        let args = {};
        try { const t = await request.text(); args = t.trim() ? JSON.parse(t) : {}; }
        catch (err) { return worker.json({ ok: false, error: 'invalid JSON body' }, 400); }
        const result = await this.mcpTool(toolMatch[1], Object.assign({}, args, { session: this.sessionName }), meta);
        return worker.json(result, result.isError ? 422 : 200);
      }
      if (action === '/view.png' && request.method === 'GET') {
        const q = url.searchParams;
        const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined);
        const result = await this.mcpTool('render_view', { session: this.sessionName, view: q.get('view') || undefined,
          azimuth: num('azimuth'), elevation: num('elevation'), width: num('width'), height: num('height') }, meta);
        const img = (result.content || []).find((c) => c.type === 'image');
        if (result.isError || !img) { return worker.json(result, 422); }
        const bin = atob(img.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        return new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
      }
      if (action === '/render' && request.method === 'POST') { return this.render(request); }
      if (action === '/history' && request.method === 'POST') { return this.history(request); }
      if (action === '/export' && request.method === 'POST') { return this.exportShape(request); }
      if ((action === '/' || action === '') && request.method === 'GET') { return this.stats(); }
      if (action === '/evict' && request.method === 'POST') {
        return withEngine(async () => {
          const owned = isolate.owner === this.key;
          if (owned) {
            rewind(await worker.engine());
            isolate.owner = null;
          }
          return worker.json({ ok: true, dropped: owned });
        });
      }
      if ((action === '/' || action === '') && request.method === 'DELETE') {
        return withEngine(async () => {
          if (isolate.owner === this.key) {
            rewind(await worker.engine());
            isolate.owner = null;
          }
          await this.ctx.storage.deleteAlarm();
          await this.ctx.storage.deleteAll();
          this.ensureTables();
          this.persistedDigest = null;
          this.lastPersist = null;
          this.lastRestore = null;
          return worker.json({ ok: true, deleted: true });
        });
      }
      return worker.json({ ok: false, error: 'unknown session route ' + request.method + ' ' + action }, 404);
    }
  }

  const USAGE = `cascade-headless editing sessions (build123d ${o.flavor}) — one Durable Object per session id

  curl -sX POST http://localhost:8787/session/demo/render -H 'content-type: application/json' \\
    -d '{"code":"from build123d import *\\nshow(Box(10,10,10))","formats":["brep"]}'

POST   /session/<id>/render   {code, formats:[step|brep|stl|mesh], measure?,
                               maxDeviation?, gui?}  ("mesh": framed stream)
POST   /session/<id>/history  {step, maxDeviation?}  (framed stream)
POST   /session/<id>/export   {format: step|brep|stl}  -> text
GET    /session/<id>          session/isolate/storage stats
POST   /session/<id>/evict    drop the in-memory working set (test hook)
DELETE /session/<id>          forget the session
`;

  /** The session API is open to any origin, so an editor served from
   *  elsewhere (a local build, a preview deployment) can use it. */
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-expose-headers': 'x-cascade-rerun',
    'access-control-max-age': '86400',
  };
  const withCors = (response) => {
    const r = new Response(response.body, response);
    for (const [k, v] of Object.entries(CORS)) { r.headers.set(k, v); }
    return r;
  };

  /** The front Worker: routes sessions to their object. It never touches the
   *  engine (in \`wrangler dev\` it can share an isolate with the objects).
   *  The editor (static assets from editor/, EDITOR.md) is served by
   *  Cloudflare ahead of this handler; anything that is not an asset lands
   *  here. */
  async function fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/session\/([A-Za-z0-9_.-]{1,64})(\/.*)?$/);
    if (m) {
      if (request.method === 'OPTIONS') { return new Response(null, { status: 204, headers: CORS }); }
      const stub = env.EDIT_SESSION.get(env.EDIT_SESSION.idFromName(m[1]));
      return withCors(await stub.fetch(request));
    }
    if (url.pathname === '/health') {
      return withCors(worker.json({ ok: true, flavor: o.flavor, sessions: true,
        note: 'the engine boots inside each session object, on its first render' }));
    }
    if (url.pathname === '/' && env.ASSETS) { return env.ASSETS.fetch(request); }
    return new Response(USAGE, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  /** Run an MCP tool in a session's object (Durable Object RPC). */
  function callSessionTool(env, name, args, meta) {
    const stub = env.EDIT_SESSION.get(env.EDIT_SESSION.idFromName(meta.session));
    return stub.mcpTool(name, args, meta);
  }

  return { EditSession, fetch, callSessionTool };
}
