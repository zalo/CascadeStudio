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
import { alignCheck, MATERIALS } from '../../../packages/cascade-core/src/headless/ShapeAnalysis.js';
import { repairHints } from './repair-hints.js';
import { WORKFLOW } from './mcp-tools.js';
import { partInfo, searchParts } from '../../../packages/cascade-core/src/worker/CsParts.js';

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

const label = (s) => '[' + s.index + ']' + (s.name ? ' "' + s.name + '"' : '');

/** One line per shown shape: what the agent needs after every run. */
function sceneText(shapes, r) {
  if (!r.shapeCount || !shapes.length) {
    return 'shapes: none shown (register them with show(obj, "name"), or assign a top-level `result`)';
  }
  return 'shapes: ' + shapes.length + '\n' + shapes.map((s) => '  ' + label(s) + ' ' + (s.type || '?')
    + (s.line ? ' (line ' + s.line + ')' : '') + ': ' + (s.solids || 0) + ' solid(s), ' + (s.faces || 0)
    + ' faces, volume ' + fmt(s.volume || 0) + ' mm^3, bbox ' + bboxText(s.bbox)
    + (s.error ? ' — ' + s.error : '')).join('\n');
}

/** What a run's scene looked like, kept with the run's result (execute's
 *  change line, compare kind="snapshot"). */
const summaryOf = (shapes) => shapes.map((s) => ({ index: s.index, name: s.name || null, type: s.type || null,
  solids: s.solids || 0, faces: s.faces || 0, volume: s.volume || 0, bbox: s.bbox || null }));

const keyOf = (s) => (s.name ? 'name:' + s.name : 'index:' + s.index);
const size = (b) => (b ? [b[3] - b[0], b[4] - b[1], b[5] - b[2]] : [0, 0, 0]);
const sameShape = (a, b) => a.volume === b.volume && a.faces === b.faces && a.solids === b.solids
  && JSON.stringify(a.bbox) === JSON.stringify(b.bbox);

/** build123d-mcp's change diagnostics, per shown object: volume / face /
 *  size deltas against the previous run, a warning when code that should
 *  have changed the model left every shape identical (a boolean that
 *  missed, or the edited shape is not the one shown), and one when a
 *  shape lost its volume. */
function changeText(prev, cur, chunk) {
  if (!prev) { return { lines: [], warnings: [] }; }
  const before = new Map(prev.map((s) => [keyOf(s), s]));
  const lines = []; const warnings = [];
  let unchanged = 0;
  for (const s of cur) {
    const b = before.get(keyOf(s));
    before.delete(keyOf(s));
    if (!b) { lines.push('  ' + label(s) + ' new: volume ' + fmt(s.volume) + ', ' + s.faces + ' faces'); continue; }
    if (sameShape(b, s)) { unchanged++; continue; }
    const dv = s.volume - b.volume;
    const pct = Math.abs(b.volume) > 1e-9 ? ', ' + (dv >= 0 ? '+' : '') + (dv / b.volume * 100).toFixed(1) + '%' : '';
    const parts = ['volume ' + fmt(b.volume) + ' -> ' + fmt(s.volume) + (Math.abs(dv) > 1e-9
      ? ' (' + (dv >= 0 ? '+' : '') + fmt(dv) + pct + ')' : '')];
    if (s.faces !== b.faces) { parts.push('faces ' + b.faces + ' -> ' + s.faces); }
    if (s.solids !== b.solids) { parts.push('solids ' + b.solids + ' -> ' + s.solids); }
    const sb = size(b.bbox); const sc = size(s.bbox);
    if (JSON.stringify(b.bbox) !== JSON.stringify(s.bbox)) {
      parts.push('size ' + sb.map(fmt).join(' x ') + ' -> ' + sc.map(fmt).join(' x ')
        + (sb.every((v, k) => Math.abs(v - sc[k]) < 1e-6) ? ' (moved)' : ''));
    }
    lines.push('  ' + label(s) + ': ' + parts.join(', '));
    if (b.volume > 1e-9 && s.volume < 1e-9) {
      warnings.push(s.solids === 0 && s.faces > 0
        ? label(s) + ' has no solid volume now (a sketch or surface): if this code built a solid, show that one'
        : label(s) + ' has volume ~0 now: degenerate (a failed loft/extrude/intersection?)');
    }
  }
  for (const b of before.values()) { lines.push('  ' + label(b) + ' is no longer shown'); }
  if (unchanged && lines.length) { lines.push('  (' + unchanged + ' unchanged)'); }
  const geometric = chunk !== undefined && String(chunk).split('\n')
    .some((l) => l.trim() && !/^\s*(#|print\(|show\(|from |import )/.test(l));
  if (geometric && cur.length && !lines.length && unchanged === cur.length) {
    warnings.push('the code ran but no shown shape changed (volume, faces and bbox are identical): a boolean may '
      + 'have missed (no intersection?), or the shape it changed is not the one shown (show it by name)');
  }
  return { lines: lines.length ? ['change since the last run:'].concat(lines) : ['change since the last run: none'],
    warnings };
}

/** build123d-mcp's convention: a script that never calls show() shows its
 *  top-level `result`. Appended after the last line, so lines keep their
 *  numbers; the session script itself is stored as written. */
function withResultShow(code) {
  const live = String(code).split('\n').filter((l) => !/^\s*#/.test(l));
  if (live.some((l) => /\bshow(_object)?\s*\(/.test(l))) { return code; }
  if (!/^result\s*(:[^=\n]*)?=(?!=)/m.test(code)) { return code; }
  return String(code).replace(/\s*$/, '') + '\nshow(result, "result")\n';
}

/** Under every export URL: the link is the person's, and a code sandbox
 *  (claude.ai) is behind an egress allow-list that refuses this host unless
 *  the account allows it, with a 403 that retrying never fixes. */
const FILE_LINK_NOTE = 'The link is for the person: it opens in any browser, no sign-in. A code sandbox can download it '
  + 'only if this host is on its allowed domains (claude.ai: Settings > Capabilities); if a download is refused '
  + '(a 403 or connect_rejected from a proxy), give the person the link instead of retrying.';

/** Scene indices for object references: an index, a show() name, a named
 *  list ("cubes" = cubes[0], cubes[1], ...), an array of those, or names
 *  separated by commas. null/undefined/'' = every shape. A list sent as
 *  JSON text ('["plate", "lid"]', '"plate"') counts as the list. */
function resolveObjects(names, ref) {
  if (typeof ref === 'string' && /^\s*["[]/.test(ref)) {
    try { ref = JSON.parse(ref); } catch (err) { ref = ref.trim().replace(/^\[|\]$/g, ''); }
  }
  if (ref === undefined || ref === null || ref === '' || (Array.isArray(ref) && !ref.length)) {
    return names.map((n, i) => i);
  }
  const refs = Array.isArray(ref) ? ref : (typeof ref === 'string' && ref.includes(',') ? ref.split(',') : [ref]);
  const out = [];
  for (const r0 of refs) {
    // bare or quoted, from a comma list like [plate, 'lid']
    const r = typeof r0 === 'string' ? r0.trim().replace(/^(["'])(.*)\1$/, '$2') : r0;
    let hits = [];
    if (Number.isInteger(r) || /^\d+$/.test(String(r))) {
      const i = Number(r);
      if (i < names.length) { hits = [i]; }
    } else {
      hits = names.map((n, i) => (n === r ? i : -1)).filter((i) => i >= 0);
      if (!hits.length) { hits = names.map((n, i) => (n && n.startsWith(r + '[') ? i : -1)).filter((i) => i >= 0); }
    }
    if (!hits.length) {
      const shown = names.map((n, i) => (n ? '"' + n + '"' : String(i)));
      throw new UserError('no shown object ' + JSON.stringify(r) + '; the scene has: '
        + (shown.length ? shown.join(', ') : 'nothing') + (names.some(Boolean) ? '' : ' (name objects with show(obj, "name"))'));
    }
    for (const i of hits) { if (!out.includes(i)) { out.push(i); } }
  }
  return out;
}

/** The validity gate's verdict for e.gate() results (validate,
 *  design_audit): reasons fail it, warnings do not. */
function gateVerdict(g) {
  const reasons = []; const warnings = [];
  for (const s of g.shapes) {
    const tag = label(s);
    if (s.error) { reasons.push(tag + ': ' + s.error); continue; }
    if (s.solids === 0) { reasons.push(tag + ' has no solid (a sketch, surface or curve): show the solid, or validate '
      + 'the part alone with object_name'); }
    if (!s.brepValid) { reasons.push(tag + ' fails BRepCheck (invalid topology or geometry)'); }
    if (s.openEdges) { reasons.push(tag + ' has ' + s.openEdges + ' open edge(s): not watertight'); }
    if (s.nonManifoldEdges) { reasons.push(tag + ' has ' + s.nonManifoldEdges + ' non-manifold edge(s) (faces meet >2-ways)'); }
    if (s.meshNonManifoldEdges) {
      reasons.push(tag + "'s mesh has " + s.meshNonManifoldEdges + ' non-manifold edge(s): self-touching or coincident faces '
        + '(a valid B-rep, but strict mesh consumers reject it)');
    }
    if (s.meshOpenEdges && !s.openEdges) {
      warnings.push(tag + "'s mesh has " + s.meshOpenEdges + ' open edge(s) although the B-rep is closed: tessellation '
        + 'gaps, usually harmless (re-check the exported STL)');
    }
    if (typeof s.meshCheck === 'string' && s.meshCheck.startsWith('skipped')) {
      warnings.push(tag + ': mesh check ' + s.meshCheck + ' — the B-rep checks stand');
    }
    if (s.solids > 0 && !(s.volume > 0)) { reasons.push(tag + ' has solids but no positive volume'); }
    for (const o of s.overlaps || []) {
      reasons.push(tag + ': solids ' + o.a + ' and ' + o.b + ' overlap (' + o.kind + ', ' + fmt(o.volume)
        + ' mm^3): the volume counts it twice; fuse them, or show them as separate objects');
    }
    if (s.overlapChecked === false) { warnings.push(tag + ': overlaps between its solids not checked (' + s.overlapNote + ')'); }
    if (s.solids > 1 && !(s.overlaps || []).length && s.overlapChecked !== false) {
      warnings.push(tag + ' has ' + s.solids + ' disjoint solids (fine for a set of parts; one part should be one solid)');
    }
  }
  if (g.interference) {
    for (const p of g.interference.pairs) {
      warnings.push('objects ' + p.a + ' and ' + p.b + ' ' + (p.kind === 'containing' ? 'overlap completely' : 'interpenetrate')
        + ' (' + fmt(p.volume) + ' mm^3): intended for a press fit? compare(kind="fit") has the details');
    }
    if (!g.interference.checked) { warnings.push('interference between objects not checked (' + g.interference.note + ')'); }
  }
  return { passes: reasons.length === 0, reasons, warnings };
}

// ---- design_audit: the script's top-level numeric parameters ---------- //

const NUM = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
const RE_SINGLE = new RegExp('^([A-Za-z_]\\w*)(\\s*:\\s*[A-Za-z_][\\w\\[\\], .]*)?(\\s*=\\s*)(' + NUM + ')(\\s*(?:#.*)?)$');
const RE_TUPLE = /^\(?\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)+)\s*,?\s*\)?\s*=\s*(.+?)\s*(#.*)?$/;

/** Top-level `name = <number>` (and `a, b = 1, 2`) assignments, like
 *  build123d-mcp's _extract_params; a name assigned again at the top level
 *  is `reassigned` (perturbing the first would be overwritten). */
function extractParams(code) {
  const lines = String(code).split('\n');
  const params = [];
  const assigned = new Map();
  let inString = false;
  let literals = 0;
  lines.forEach((line, n) => {
    const quotes = (line.match(/"""|\'\'\'/g) || []).length;
    const wasInString = inString;
    if (quotes % 2 === 1) { inString = !inString; }
    if (wasInString || quotes) { return; }
    const code0 = line.replace(/#.*$/, '');
    literals += (code0.match(/(?<![\w.])\d+\.?\d*(?:[eE][-+]?\d+)?/g) || []).length;
    if (/^\s/.test(line)) { return; }
    const aug = line.match(/^([A-Za-z_]\w*)\s*[-+*\/%]=/);
    if (aug) { assigned.set(aug[1], (assigned.get(aug[1]) || 0) + 1); return; }
    const m = line.match(RE_SINGLE);
    if (m) {
      assigned.set(m[1], (assigned.get(m[1]) || 0) + 1);
      params.push({ name: m[1], value: Number(m[4]), type: /[.eE]/.test(m[4]) ? 'float' : 'int', line: n, slot: -1 });
      return;
    }
    const t = line.match(RE_TUPLE);
    if (t && !/==/.test(line)) {
      const names = t[1].split(',').map((x) => x.trim());
      const rhs = t[2].replace(/^\(|\)$/g, '').split(',').map((x) => x.trim()).filter((x) => x !== '');
      names.forEach((nm) => assigned.set(nm, (assigned.get(nm) || 0) + 1));
      if (rhs.length === names.length && rhs.every((v) => new RegExp('^' + NUM + '$').test(v))) {
        names.forEach((nm, k) => params.push({ name: nm, value: Number(rhs[k]),
          type: /[.eE]/.test(rhs[k]) ? 'float' : 'int', line: n, slot: k }));
      }
      return;
    }
    const plain = line.match(/^([A-Za-z_]\w*)\s*(?::[^=]*)?=(?!=)/);
    if (plain) { assigned.set(plain[1], (assigned.get(plain[1]) || 0) + 1); }
  });
  const seen = new Set();
  const out = [];
  for (const p of params) {
    if (seen.has(p.name)) { continue; }
    seen.add(p.name);
    if ((assigned.get(p.name) || 0) > 1) { p.reassigned = true; }
    out.push(p);
  }
  return { params: out, inlineLiterals: Math.max(0, literals - out.length) };
}

/** The script with parameter p set to v, on the same line (line numbers
 *  stay, so errors still point at the user's lines). */
function rewriteParam(code, p, v) {
  const lines = String(code).split('\n');
  const text = Number.isInteger(v) && p.type === 'int' ? String(v) : String(v);
  if (p.slot < 0) {
    lines[p.line] = lines[p.line].replace(RE_SINGLE, (m0, a, ann, eq, num, tail) => a + (ann || '') + eq + text + tail);
  } else {
    const [lhs, rest] = [lines[p.line].slice(0, lines[p.line].indexOf('=') + 1), lines[p.line].slice(lines[p.line].indexOf('=') + 1)];
    let k = -1;
    lines[p.line] = lhs + rest.replace(new RegExp(NUM, 'g'), (m) => (++k === p.slot ? text : m));
  }
  return lines.join('\n');
}

/** build123d-mcp's _perturbations: +/-eps, a discrete +/-1 step for an int
 *  that rounds back to itself, no step that drives a positive int to <= 0. */
function perturbations(value, isInt, eps) {
  const out = [];
  for (const sign of [1, -1]) {
    let nv = value * (1 + sign * eps);
    let discrete = false;
    if (isInt) {
      nv = Math.round(nv);
      if (nv === value) { nv = value + sign; discrete = true; }
      if (value > 0 && nv <= 0) { continue; }
    } else {
      nv = Math.round(nv * 1e6) / 1e6;
    }
    if (nv === value) { continue; }
    out.push({ delta_pct: value ? Math.round((nv - value) / value * 100) : null, new_value: nv, discrete });
  }
  return out;
}

const VERDICT_REASON = {
  brittle: 'a +/-eps change fails the validity gate or the solid cannot form: fragile here',
  coupling: 'a dependent feature (fillet/chamfer/shell/offset) failed when this parameter alone changed: EITHER '
    + 'parameter coupling (a fixed feature no longer fits) OR a fragile feature dimension; counted under needs_review',
  not_a_design_parameter: 'perturbing it breaks a geometry selection: likely a measured anchor or selector '
    + 'constant, not an editable design knob (needs_review)',
  inconclusive: 'could not be decided: reassigned at the top level, out of time, or the gate errored',
  robust: 'survives +/-eps',
};

function classifyFailure(err) {
  const low = String(err || '').toLowerCase();
  if (/exceeded|timed? ?out/.test(low)) { return 'timeout'; }
  if (['fillet', 'chamfer', 'shell', 'offset'].some((k) => low.includes(k))) { return 'coupling'; }
  if (['expected exactly one', 'found 0', 'list index out of range'].some((k) => low.includes(k))) { return 'anchor'; }
  return 'rebuild_error';
}

function paramVerdict(results) {
  const seen = new Set();
  for (const r of results) {
    if (r.rebuilt) { seen.add(r.cause === 'gate_error' ? 'inconclusive' : r.passes_gate ? 'robust' : 'brittle'); }
    else if (r.cause === 'timeout') { seen.add('inconclusive'); }
    else if (r.cause === 'coupling') { seen.add('coupling'); }
    else if (r.cause === 'anchor') { seen.add('not_a_design_parameter'); }
    else { seen.add('brittle'); }
  }
  if (!seen.size) { return 'inconclusive'; }
  return ['brittle', 'coupling', 'not_a_design_parameter', 'inconclusive', 'robust'].find((v) => seen.has(v));
}

const NAMED_COLORS = { red: [0.86, 0.24, 0.22], green: [0.30, 0.68, 0.36], blue: [0.26, 0.48, 0.84],
  orange: [0.98, 0.58, 0.20], yellow: [0.95, 0.82, 0.25], purple: [0.58, 0.40, 0.78], violet: [0.58, 0.40, 0.78],
  pink: [0.93, 0.55, 0.70], brown: [0.58, 0.40, 0.26], cyan: [0.30, 0.78, 0.84], magenta: [0.82, 0.32, 0.72],
  gray: [0.62, 0.64, 0.67], grey: [0.62, 0.64, 0.67], black: [0.18, 0.19, 0.21], white: [0.95, 0.95, 0.95],
  steel: [0.66, 0.70, 0.75], aluminum: [0.80, 0.82, 0.85], aluminium: [0.80, 0.82, 0.85], brass: [0.80, 0.66, 0.30],
  copper: [0.78, 0.47, 0.30], gold: [0.86, 0.70, 0.28], wood: [0.72, 0.54, 0.36] };

/** A colour name or #rgb / #rrggbb -> [r, g, b] in 0..1 (null if unreadable). */
function parseColor(v) {
  if (Array.isArray(v) && v.length === 3) { return v.map((x) => Math.max(0, Math.min(1, Number(x) > 1 ? Number(x) / 255 : Number(x)))); }
  const t = String(v || '').trim().toLowerCase();
  if (NAMED_COLORS[t]) { return NAMED_COLORS[t]; }
  const m = t.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) { return null; }
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
}

const withHints = (text) => {
  const hints = repairHints(text);
  return hints.length ? '\nhints:\n' + hints.map((h) => '- ' + h).join('\n') : '';
};

const MIME = { step: 'model/step', stl: 'model/stl', brep: 'application/octet-stream',
  glb: 'model/gltf-binary', svg: 'image/svg+xml', dxf: 'image/vnd.dxf',
  '3mf': 'model/3mf' };

/** Tool implementations: `this` is the EditSession, `e` the engine (the
 *  engine lock is held). Throw UserError for the caller's mistakes. */
const MCP_TOOLS = {
  async execute(e, a) {
    if (typeof a.code !== 'string' || !a.code.trim()) { throw new UserError('"code" is empty'); }
    let cur = this.script().code;
    // Unnamed shows: lite's first show() of a run defines the scene and later
    // ones append (COMPROMISE(show-semantics)), so a chunk that shows the
    // model again would leave its earlier version in the scene too. Earlier
    // one-line top-level UNNAMED show(...) calls are commented out — visible
    // in get_script, and the same script then shows the same thing in the
    // editor. Named shows need nothing: a name shown again replaces itself.
    const unnamed = (l) => !/["']|names\s*=/.test(l);
    if (a.code.split('\n').some((l) => /^show\(.*\)\s*$/.test(l) && unnamed(l))) {
      cur = cur.replace(/^(show\(.*\))[ \t]*$/gm, (m, call) => (unnamed(call) ? '# ' + call
        + '  # superseded by a later show()' : m));
    }
    let prefix = cur ? cur.replace(/\s*$/, '') + '\n' : '';
    if (!cur.trim() && !/^\s*(from|import)\s+build123d/m.test(a.code)) { prefix = 'from build123d import *\n'; }
    const offset = prefix ? prefix.split('\n').length - 1 : 0;
    return this.runAsScript(e, prefix + a.code, { source: 'agent', rollback: true, offset, label: 'appended to',
      chunk: a.code });
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
    const QUALITY = { preview: [1, 0.3], standard: [2, null], high: [3, 0.03] };
    const quality = QUALITY[a.quality] ? a.quality : 'standard';
    const [supersample, qdev] = QUALITY[quality];
    const baseDev = Number((last.gui && last.gui.MeshRes) || last.maxDeviation) || 0.1;
    const dev = qdev === null ? baseDev : (quality === 'high' ? Math.min(baseDev, qdev) : Math.max(baseDev, qdev));
    const DIRECTION = { rear: 'back', side: 'right' };
    const view = a.view || (a.direction ? DIRECTION[a.direction] || a.direction : undefined);
    const shapes = this.quickScene(e);
    const names = e.sceneNames();
    const pick = a.objects !== undefined && a.objects !== '' ? a.objects : a.shapes;
    const only = pick === undefined || pick === '' || (Array.isArray(pick) && !pick.length)
      ? null : resolveObjects(names, pick);
    if (a.format === 'svg') {
      const p = only ? e.pickShape(only) : null;
      let d;
      try {
        d = e.drawingSVG({ view, azimuth: a.azimuth, elevation: a.elevation, width: a.width, height: a.height,
          hidden: a.hidden, shape: p ? p.shape : undefined });
      } finally { if (p) { p.free(); } }
      const f = this.storeFile('drawing-' + (view || 'iso') + '.svg', MIME.svg, new TextEncoder().encode(d.svg));
      const head = 'SVG hidden-line drawing, view az ' + d.view.azimuth + ' el ' + d.view.elevation + ': '
        + d.visible + ' visible and ' + d.hidden + ' hidden lines, ' + fmt(d.size[0]) + ' x ' + fmt(d.size[1])
        + ' mm in the view plane.\nfile: ' + f.url + ' (' + (f.bytes / 1024).toFixed(0) + ' KB, kept '
        + f.expiresInS + ' s)';
      return { content: [{ type: 'text', text: f.bytes <= 40000 ? head + '\n\n' + d.svg : head
        + '\n(too large to show inline; download it)' }], after: {} };
    }
    const highlight = a.highlight === undefined || a.highlight === '' ? undefined : resolveObjects(names, a.highlight);
    const sel = only ? shapes.filter((s) => only.includes(s.index)) : shapes;
    const boxes = sel.map((s) => s.bbox).filter(Boolean);
    const bb = boxes.length ? [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b[k])))
      .concat([3, 4, 5].map((k) => Math.max(...boxes.map((b) => b[k])))) : null;
    const custom = Number.isFinite(a.azimuth) || Number.isFinite(a.elevation);
    const viewName = custom ? 'custom' : (VIEWS[view] ? view : 'iso');
    const preset = VIEWS[view] || VIEWS.iso;
    const az = Number.isFinite(a.azimuth) ? a.azimuth : preset[0];
    const el = Number.isFinite(a.elevation) ? a.elevation : preset[1];
    const sizeLabel = bb ? [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map(fmt).join(' × ') + ' MM' : '';
    const notes = [];
    let clip;
    if (a.clip_plane) {
      const axis = 'xyz'.indexOf(String(a.clip_plane).toLowerCase());
      if (axis < 0) { throw new UserError('clip_plane must be x, y or z'); }
      const at = Number.isFinite(a.clip_at) ? a.clip_at : (bb ? (bb[axis] + bb[axis + 3]) / 2 : 0);
      const keep = a.clip_keep === 'above' ? 'above' : 'below';
      clip = { axis, at, keep };
      notes.push('clipped at ' + 'XYZ'[axis] + ' = ' + fmt(at) + ' (keeping ' + keep + '; the cut shows red where it passes through material)');
    }
    let colors;
    if (a.colors && typeof a.colors === 'object') {
      colors = {};
      for (const [key, value] of Object.entries(a.colors)) {
        const c = parseColor(value);
        if (!c) { throw new UserError('colors: cannot read "' + value + '" (a name like "red" or #rrggbb)'); }
        for (const i of resolveObjects(names, /^\d+$/.test(key) ? Number(key) : key)) { colors[i] = c; }
      }
    }
    const objectLabels = a.label_objects ? Object.fromEntries(sel.map((s) => [s.index, s.name || String(s.index)])) : undefined;
    if (a.style === 'lines') {
      const p = only ? e.pickShape(only) : null;
      let img;
      try {
        img = await e.renderLinesPNG({ azimuth: az, elevation: el, width: a.width, height: a.height, supersample,
          shape: p ? p.shape : undefined, hidden: a.hidden,
          labels: [viewName.toUpperCase() + ' HIDDEN LINE  AZ ' + Math.round(az) + ' EL ' + Math.round(el), sizeLabel] });
      } finally { if (p) { p.free(); } }
      return { content: [
        { type: 'image', data: toBase64(img.png), mimeType: 'image/png' },
        { type: 'text', text: 'hidden-line view ' + viewName + ' (azimuth ' + img.view.azimuth + ', elevation '
          + img.view.elevation + '), exact projection: ' + img.visible + ' visible, ' + img.hidden + ' hidden (dashed) lines, '
          + img.width + 'x' + img.height + ' px. ' + sel.length + ' object(s); bbox ' + bboxText(bb) },
      ], after: {} };
    }
    const img = await e.renderPNG({ azimuth: az, elevation: el, supersample,
      width: a.width, height: a.height, shapes: only || undefined, highlight, edges: a.edges, colors, clip, objectLabels,
      maxDeviation: dev, labels: [viewName.toUpperCase() + '  AZ ' + Math.round(az) + ' EL ' + Math.round(el), sizeLabel] });
    return { content: [
      { type: 'image', data: toBase64(img.png), mimeType: 'image/png' },
      { type: 'text', text: 'view ' + viewName + ' (azimuth ' + img.view.azimuth + ', elevation ' + img.view.elevation
        + '), orthographic, ' + img.width + 'x' + img.height + ' px, ' + fmt(img.scale) + ' px/mm, quality ' + quality + '. '
        + sel.length + ' object(s): ' + sel.map(label).join(', ') + '; bbox ' + bboxText(bb)
        + (highlight ? '; orange: ' + highlight.map((i) => label(shapes[i])).join(', ') : '')
        + (notes.length ? '; ' + notes.join('; ') : '') },
    ], after: {} };
  },

  async measure(e, a) {
    await this.ensureScene(e);
    let rho = 0;
    if (a.material) {
      if (a.density) { throw new UserError('pass either density or material, not both'); }
      rho = MATERIALS[String(a.material).trim().toLowerCase()];
      if (!rho) { throw new UserError('unknown material "' + a.material + '"; presets: ' + Object.keys(MATERIALS).join(', ')); }
    } else if (a.density !== undefined) {
      rho = Number(a.density);
      if (!(rho > 0)) { throw new UserError('density must be positive (g/cm^3)'); }
    }
    let shapes = a.exact_bbox ? e.inspectShapes({ exactBox: true })
      : this.inspectFull(e).map((x) => Object.assign({}, x));
    const ref = a.object_name !== undefined ? a.object_name : a.shape;
    const idx = resolveObjects(e.sceneNames(), ref);
    shapes = shapes.filter((s) => idx.includes(s.index));
    if (shapes.length <= 4) {
      for (const s of shapes) {
        try { Object.assign(s, e.shapeDetails(s.index)); } catch (err) { s.detailsError = (err && err.message) || String(err); }
      }
    }
    for (const s of shapes) {
      if (rho) {
        s.density = rho;
        s.massGrams = fmt((s.volume || 0) * rho / 1000);
        if (s.inertia) { for (const k of Object.keys(s.inertia)) { s.inertia[k] = fmt(s.inertia[k] * rho / 1000); } }
      }
      if (s.inertia) { s.inertiaUnits = rho ? 'g*mm^2 (about the centre of mass)' : 'mm^5 (volume inertia about the centre of mass; pass density or material)'; }
    }
    const note = shapes.length > 4 ? ' — the face inventory and inertia are given for up to four objects: pass object_name' : '';
    return toolText(JSON.stringify({ units: 'mm, mm^2, mm^3', shapes }, null, 1) + note);
  },

  async validate(e, a) {
    const r = await this.ensureScene(e);
    const pre = [];
    if (!r.ok) { pre.push('the script raised: ' + (r.errors[0] || '').split('\n')[0]); }
    if (!r.shapeCount) { pre.push('no shapes are shown'); }
    const g = r.shapeCount ? this.gateFor(e, { indices: resolveObjects(e.sceneNames(), a.object_name) })
      : { shapes: [], interference: null };
    const v = gateVerdict(g);
    const reasons = pre.concat(v.reasons);
    const pass = reasons.length === 0;
    const defects = g.shapes.some((s) => s.openEdges || s.nonManifoldEdges || (s.overlaps || []).length);
    return toolText('Validity gate: ' + (pass ? 'PASS' : 'FAIL') + (reasons.length ? ' — ' + reasons.join('; ') : '')
      + (v.warnings.length ? ' (warning: ' + v.warnings.join('; ') + ')' : '') + '\n'
      + JSON.stringify({ passes_gate: pass, reasons, warnings: v.warnings,
        objects: g.shapes.map((s) => ({ index: s.index, name: s.name, solids: s.solids, volume: s.volume,
          brep_valid: s.brepValid, open_edges: s.openEdges, nonmanifold_edges: s.nonManifoldEdges,
          overlaps: s.overlaps, mesh_check: s.meshCheck, mesh_open_edges: s.meshOpenEdges,
          mesh_nonmanifold_edges: s.meshNonManifoldEdges, ...(s.error ? { error: s.error } : {}) })),
        interference: g.interference }, null, 1)
      + (defects ? '\nlocate_gate_defects gives the coordinates.' : '')
      + (pass ? '' : withHints(reasons.join('\n'))), !pass);
  },

  async locate_gate_defects(e, a) {
    const r = await this.ensureScene(e);
    if (!r.shapeCount) { throw new UserError('nothing to check: the script shows no shapes'); }
    const g = this.gateFor(e, { indices: resolveObjects(e.sceneNames(), a.object_name), maxDefects: 50, interference: false });
    const HINT = {
      open_edge: 'an open boundary: add the missing face, or build a closed solid (extrude/loft/sweep a closed profile)',
      nonmanifold_edge: 'faces meet >2-ways: fuse the touching bodies with overlap, or separate them',
      overlap: 'overlapping solids in one object: fuse them (a + b), or show them as separate objects',
      brep_invalid: 'BRepCheck fails: rebuild the last feature differently (smaller fillet, real boolean overlap)',
      no_solid: 'no solid: this object is a sketch, surface or curve',
      mesh_nonmanifold: 'the tessellation meets >2-ways here: faces touch or coincide; separate them or fuse with real overlap',
      mesh_open: 'a gap in the tessellation: usually harmless when the B-rep is closed; re-check the exported STL',
    };
    const defects = [];
    for (const s of g.shapes) {
      const obj = { index: s.index, name: s.name };
      if (s.error) { defects.push(Object.assign({ kind: 'error', message: s.error }, obj)); continue; }
      if (s.solids === 0) { defects.push(Object.assign({ kind: 'no_solid', hint: HINT.no_solid }, obj)); }
      if (!s.brepValid) { defects.push(Object.assign({ kind: 'brep_invalid', hint: HINT.brep_invalid }, obj)); }
      for (const d of s.defects || []) {
        defects.push(Object.assign({ kind: d.kind, at: d.at, faces_incident: d.uses, hint: HINT[d.kind] }, obj));
      }
      for (const o of s.overlaps || []) {
        defects.push(Object.assign({ kind: 'solid_overlap', solids: [o.a, o.b], volume: o.volume, relation: o.kind,
          hint: HINT.overlap }, obj));
      }
      for (const d of s.meshDefects || []) {
        defects.push(Object.assign({ kind: d.kind, at: d.at, triangles_incident: d.uses,
          hint: d.kind === 'mesh_nonmanifold_edge' ? HINT.mesh_nonmanifold : HINT.mesh_open }, obj));
      }
    }
    const counts = {};
    for (const d of defects) { counts[d.kind] = (counts[d.kind] || 0) + 1; }
    return toolText(JSON.stringify({ defects, counts,
      note: defects.length ? 'coordinates are mm; edge positions are midpoints' : 'no defects: the objects pass the structural checks' }, null, 1));
  },

  async compare(e, a) {
    const kind = a.kind || 'fit';
    if (kind === 'snapshot') { return this.compareSnapshots(e, a); }
    if (!['fit', 'align', 'shape'].includes(kind)) { throw new UserError('kind must be fit, align, shape or snapshot'); }
    if (a.b === undefined || a.b === null || a.b === '') { throw new UserError('compare kind "' + kind + '" needs b'); }
    const r = await this.ensureScene(e);
    if (!r.shapeCount) { throw new UserError('nothing to compare: the script shows no shapes'); }
    const names = e.sceneNames();
    const ia = resolveObjects(names, a.a); const ib = resolveObjects(names, a.b);
    const shapes = this.quickScene(e);
    const nameOf = (idx) => idx.map((i) => label(shapes[i])).join(' + ');
    if (kind === 'fit') {
      return toolText(JSON.stringify(Object.assign({ object_a: nameOf(ia), object_b: nameOf(ib) },
        e.clearance(ia, ib)), null, 1));
    }
    const box = (idx) => {
      const bs = idx.map((i) => shapes[i].bbox).filter(Boolean);
      if (!bs.length) { throw new UserError(nameOf(idx) + ' has no bounding box'); }
      return [0, 1, 2].map((k) => Math.min(...bs.map((b) => b[k]))).concat([3, 4, 5].map((k) => Math.max(...bs.map((b) => b[k]))));
    };
    if (kind === 'align') {
      const res = alignCheck(box(ia), box(ib), a.axis || 'Z', a.mode || 'flush', nameOf(ia), nameOf(ib));
      if (res.error) { throw new UserError(res.error); }
      return toolText(JSON.stringify(res, null, 1));
    }
    const full = this.inspectFull(e);
    const diag = (idx) => {
      const ss = idx.map((i) => full[i]);
      const bb = box(idx);
      const vol = ss.reduce((n, s) => n + (s.volume || 0), 0);
      const com = vol > 0 ? [0, 1, 2].map((k) => fmt(ss.reduce((n, s) => n + (s.centerOfMass || [0, 0, 0])[k] * (s.volume || 0), 0) / vol))
        : (ss[0].centerOfMass || null);
      return { name: nameOf(idx), volume: fmt(vol), faces: ss.reduce((n, s) => n + (s.faces || 0), 0),
        edges: ss.reduce((n, s) => n + (s.edges || 0), 0), vertices: ss.reduce((n, s) => n + (s.vertices || 0), 0),
        bbox: size(bb).map(fmt), center: com };
    };
    const da = diag(ia); const db = diag(ib);
    const changed = e.changedVolumes(ia, ib);
    let regions = null;
    try { regions = e.changedRegions(ia, ib); } catch (err) { regions = { error: (err && err.message) || String(err) }; }
    const off = da.center && db.center ? fmt(Math.hypot(...[0, 1, 2].map((k) => db.center[k] - da.center[k]))) : null;
    return toolText(JSON.stringify({ a: da, b: db,
      delta: { volume: fmt(db.volume - da.volume), faces: db.faces - da.faces, edges: db.edges - da.edges,
        vertices: db.vertices - da.vertices, bbox: [0, 1, 2].map((k) => fmt(db.bbox[k] - da.bbox[k])), center_offset: off },
      changed: { added_volume: changed.added === null ? null : fmt(changed.added),
        removed_volume: changed.removed === null ? null : fmt(changed.removed) },
      magnitude_method: changed.added === null || changed.removed === null ? 'volume_deltas_only' : 'exact_volume',
      surface: regions,
      note: 'a to b. added_volume/removed_volume are the exact material in b and not a / in a and not b (booleans). '
        + 'surface.regions are the faces that differ, matched on the exact B-rep (type, area, centroid) and grouped '
        + 'through shared edges: "added" are in b only, "removed" in a only, with max_deviation = how far they sit '
        + 'from the other shape; a moved feature is a removed region plus an added one. A tangential move can keep '
        + 'every volume total unchanged — the regions still show it.' }, null, 1));
  },

  async resolve(e, a) {
    const sel = String(a.selector || '').trim();
    const obj = String(a.object_name === undefined ? '' : a.object_name).trim();
    if (!obj) { throw new UserError('object_name is needed: a show() name or a top-level variable'); }
    if (!/^[.[]/.test(sel) || /[\n;]/.test(sel)) {
      throw new UserError('selector must be one expression suffix starting with "." or "[", e.g. ".faces().sort_by(Axis.Z)[-1]"');
    }
    const prelude = 'try:\n    _cs_obj = _cs_b._cs_shown_object(' + JSON.stringify(obj) + ')\nexcept KeyError as _cs_err:\n'
      + (/^[A-Za-z_]\w*$/.test(obj) ? '    _cs_obj = globals()[' + JSON.stringify(obj) + '] if '
        + JSON.stringify(obj) + ' in globals() else None\n    if _cs_obj is None:\n        raise _cs_err\n' : '    raise _cs_err\n');
    const desc = await this.runProbe(e, prelude, '_cs_b._cs_describe(_cs_obj' + sel + ')', 'the selector');
    const ref = '@cad[' + obj + (a.label ? '#' + a.label : '') + ']';
    const res = Object.assign({ label: a.label || null, ref, object: obj, selector: sel }, desc);
    if (a.label) {
      const refs = this.meta('refs') || {};
      refs[a.label] = { ref, object: obj, selector: sel, rev: this.script().rev, type: desc.type,
        center: desc.center || null, count: desc.count };
      this.setMeta('refs', refs);
    }
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 1) }], after: {} };
  },

  async find_holes(e, a) { return this.findFeatures(e, a, 'holes'); },
  async find_hole_patterns(e, a) { return this.findFeatures(e, a, 'hole_patterns'); },
  async find_bosses(e, a) { return this.findFeatures(e, a, 'bosses'); },
  async find_bored_bosses(e, a) { return this.findFeatures(e, a, 'bored_bosses'); },
  async find_countersinks(e, a) { return this.findFeatures(e, a, 'countersinks'); },

  async cross_sections(e, a) {
    const r = await this.ensureScene(e);
    if (!r.shapeCount) { throw new UserError('nothing to slice: the script shows no shapes'); }
    const axis = String(a.axis || 'Z').toUpperCase();
    if (!['X', 'Y', 'Z'].includes(axis)) { throw new UserError('axis must be X, Y or Z'); }
    const idx = resolveObjects(e.sceneNames(), a.object_name);
    const n = a.num_slices === undefined ? 10 : Number(a.num_slices);
    if (!(n >= 2 && n <= 200)) { throw new UserError('num_slices must be 2..200'); }
    const slices = e.crossSections(idx, axis, n);
    const areas = slices.map((x) => x.area);
    return toolText(JSON.stringify({ axis, objects: idx.map((i) => label(this.quickScene(e)[i])),
      min_area: areas.length ? Math.min(...areas) : 0, max_area: areas.length ? Math.max(...areas) : 0,
      slices }, null, 1));
  },

  async analyze_printability(e, a) {
    const num = (v, d, what) => {
      if (v === undefined || v === null || v === '') { return d; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) { throw new UserError(what + ' must be a non-negative number'); }
      return n;
    };
    let bv = 'None';
    if (a.build_volume !== undefined && a.build_volume !== null && a.build_volume !== '') {
      const parts = Array.isArray(a.build_volume) ? a.build_volume : String(a.build_volume).trim().split(/[\s,x×]+/);
      if (parts.length !== 3 || parts.some((x) => !(Number(x) > 0))) {
        throw new UserError("build_volume must be 'X Y Z' (three numbers in mm)");
      }
      bv = '(' + parts.map((x) => String(Number(x))).join(', ') + ')';
    }
    const args = 'support_angle=' + num(a.support_angle, 45, 'support_angle') + ', nozzle=' + num(a.nozzle, 0.4, 'nozzle')
      + ', min_perimeters=' + Math.round(num(a.min_perimeters, 2, 'min_perimeters')) + ', build_volume=' + bv
      + ', bed_tol=' + num(a.bed_tol, 0.001, 'bed_tol') + ', min_feature=' + num(a.min_feature, 0.5, 'min_feature');
    const { label: label0, res } = await this.probeObject(e, a.object_name,
      '_cs_f.printability(_cs_obj, ' + args + ')', 'the printability analysis');
    return { content: [{ type: 'text', text: res.summary + ' (' + label0 + ', +Z up, resting on its lowest point)\n\n'
      + JSON.stringify({ counts: res.counts, findings: res.findings }, null, 1) }], after: {} };
  },

  async design_audit(e, a) {
    const eps = a.epsilon === undefined ? 0.1 : Number(a.epsilon);
    if (!(eps > 0 && eps < 1)) { throw new UserError('epsilon must be between 0 and 1 (e.g. 0.1 for +/-10%)'); }
    const maxParams = Math.max(1, Math.min(12, Number.isInteger(a.max_params) ? a.max_params : 8));
    const sc = this.script();
    if (!sc.code.trim()) { throw new UserError('the session script is empty: nothing to audit'); }
    const { params, inlineLiterals } = extractParams(sc.code);
    const publicParam = (p) => ({ name: p.name, value: p.value, type: p.type, ...(p.reassigned ? { reassigned: true } : {}) });
    if (!params.length) {
      return toolText(JSON.stringify({ parameters: [], inline_literal_count: inlineLiterals,
        note: 'No top-level numeric parameters: the script uses inline numbers, so it is a shape to render, not a design '
          + 'to edit. Hoist the key dimensions into named top-level assignments (plate_thickness = 5.0  # mm) and audit again.' }, null, 1));
    }
    const gateOf = (r) => {
      if (!r.ok) { return { rebuilt: false, error: (r.errors[0] || '').split('\n').filter(Boolean).pop() || 'error', full: r.errors.join('\n') }; }
      if (!r.shapeCount) { return { rebuilt: true, passes_gate: false, n_solids: 0, volume: 0, reasons: ['no shapes are shown'] }; }
      try {
        const g = e.gate({ interference: false, budgetMs: 4000 });
        const v = gateVerdict(g);
        return { rebuilt: true, passes_gate: v.passes, n_solids: g.shapes.reduce((n, s) => n + (s.solids || 0), 0),
          volume: fmt(g.shapes.reduce((n, s) => n + (s.volume || 0), 0)), reasons: v.reasons };
      } catch (err) { return { rebuilt: true, gate_error: true, passes_gate: false, reasons: [String(err && err.message || err)] }; }
    };
    const budgetMs = Number(this.env.AUDIT_BUDGET_MS || 30000);
    const deadline = Date.now() + budgetMs;
    const runVariant = async (code) => {
      await this.adopt(e);
      const r = await e.run(withResultShow(code), { keepScene: true, guiState: {} });
      this.ranThisCall = true;
      this.callMisses += r.cache ? r.cache.misses : 1;
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
      this.lastRunRev = null;
      return r;
    };
    const base = gateOf(await runVariant(sc.code));
    if (!base.rebuilt || !base.passes_gate) {
      return { content: [{ type: 'text', text: JSON.stringify({ parameters: params.map(publicParam),
        baseline: base.rebuilt ? { rebuilt: true, passes_gate: false, n_solids: base.n_solids, volume: base.volume, reasons: base.reasons }
          : { rebuilt: false, error: base.error },
        note: base.rebuilt ? 'The script does not pass the validity gate (see validate). Fix that before auditing its parameters.'
          : 'The script raises, so its parameters cannot be audited. Fix it first (last_error).' }, null, 1) }], after: {} };
    }
    const audited = params.slice(0, maxParams);
    const audit = [];
    let outOfTime = false;
    for (const p of audited) {
      if (Date.now() > deadline) { outOfTime = true; break; }
      if (p.reassigned) {
        audit.push(Object.assign(publicParam(p), { perturbations: [], verdict: 'inconclusive', brittle: false,
          reason: 'reassigned at the top level: perturbing the first assignment is overwritten by the later one' }));
        continue;
      }
      const results = [];
      for (const pert of perturbations(p.value, p.type === 'int', eps)) {
        if (Date.now() > deadline) { outOfTime = true; break; }
        const g = gateOf(await runVariant(rewriteParam(sc.code, p, pert.new_value)));
        const entry = { delta_pct: pert.delta_pct, new_value: pert.new_value };
        if (pert.discrete) { entry.discrete_step = true; }
        if (!g.rebuilt) {
          Object.assign(entry, { rebuilt: false, cause: classifyFailure(g.full), error: g.error });
        } else {
          Object.assign(entry, { rebuilt: true, passes_gate: g.passes_gate, n_solids: g.n_solids, volume: g.volume });
          if (base.volume) { entry.volume_delta_pct = Math.round((g.volume - base.volume) / base.volume * 1000) / 10; }
          if (g.gate_error) { Object.assign(entry, { cause: 'gate_error', reasons: g.reasons }); }
          else if (!g.passes_gate) { Object.assign(entry, { cause: 'gate_fail', reasons: g.reasons }); }
        }
        results.push(entry);
      }
      const verdict = paramVerdict(results);
      audit.push(Object.assign(publicParam(p), { perturbations: results, verdict, brittle: verdict === 'brittle',
        reason: VERDICT_REASON[verdict] }));
    }
    const counts = { robust: 0, brittle: 0, coupling: 0, not_a_design_parameter: 0, inconclusive: 0 };
    for (const x of audit) { counts[x.verdict]++; }
    const truncated = params.length > audited.length || audit.length < audited.length || outOfTime;
    let note = 'brittle = certain fragility (a small change fails the gate or cannot rebuild): look at those first. '
      + 'coupling and not_a_design_parameter are ambiguous: read needs_review (brittle + coupling + '
      + 'not_a_design_parameter), not brittle alone. inconclusive is undecided. Each parameter has a reason.';
    if (inlineLiterals > params.length) {
      note += ' ' + inlineLiterals + ' inline numeric literals remain outside the parameters: hoist the load-bearing ones.';
    }
    if (truncated) {
      note += ' Audited ' + audit.length + '/' + params.length + ' parameters' + (outOfTime ? ' (time budget, '
        + Math.round(budgetMs / 1000) + ' s, used up)' : ' (max_params)') + '.';
    }
    return { content: [{ type: 'text', text: JSON.stringify({ parameters: params.map(publicParam),
      baseline: { rebuilt: true, passes_gate: true, n_solids: base.n_solids, volume: base.volume },
      inline_literal_count: inlineLiterals, audit,
      summary: Object.assign({ total_params: params.length, audited: audit.length }, counts,
        { needs_review: counts.brittle + counts.coupling + counts.not_a_design_parameter, truncated, epsilon: eps }),
      note }, null, 1) }], after: {} };
  },

  async import_cad_file(e, a) {
    const src = a.url !== undefined && a.url !== '' ? 'url' : (typeof a.content === 'string' && a.content ? 'content' : null);
    if (!src) { throw new UserError('give the file as url (http/https) or as content (the STEP or BREP text)'); }
    let file = String(a.filename || (src === 'url' ? String(a.url).split(/[?#]/)[0].split('/').pop() : '') || '').trim();
    let bytes;
    if (src === 'url') {
      let u;
      try { u = new URL(String(a.url)); } catch (err) { throw new UserError('url is not a URL'); }
      if (!/^https?:$/.test(u.protocol)) { throw new UserError('url must be http or https'); }
      const resp = await fetch(u.href, { redirect: 'follow' });
      if (!resp.ok) { throw new UserError('fetching the file failed: HTTP ' + resp.status); }
      const len = Number(resp.headers.get('content-length') || 0);
      if (len > MAX_FILE_BYTES) { throw new UserError('the file is over ' + (MAX_FILE_BYTES / 1048576) + ' MB'); }
      bytes = new Uint8Array(await resp.arrayBuffer());
    } else {
      bytes = new TextEncoder().encode(a.content);
    }
    if (bytes.length > MAX_FILE_BYTES) { throw new UserError('the file is over ' + (MAX_FILE_BYTES / 1048576) + ' MB'); }
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
    let kind = /\.(step|stp)$/i.test(file) ? 'step' : /\.brep$/i.test(file) ? 'brep' : null;
    if (!kind) { kind = /ISO-10303-21/.test(head) ? 'step' : /DBRep|CASCADE Topology/.test(head) ? 'brep' : null; }
    if (!kind) {
      throw new UserError('only STEP (.step/.stp) and BREP (.brep) files can be imported here (build123d-lite has no '
        + 'STL/3MF import); this file looks like neither');
    }
    if (!file || !/^[A-Za-z0-9_.-]{1,80}$/.test(file)) { file = 'import.' + kind; }
    if (!/\.(step|stp|brep)$/i.test(file)) { file += '.' + kind; }
    const name = String(a.name || file.replace(/\.[A-Za-z0-9]+$/, '')).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    if (!/^[A-Za-z_]\w{0,40}$/.test(name)) { throw new UserError('name must be a Python identifier'); }
    const sql = this.ctx.storage.sql;
    this.ctx.storage.transactionSync(() => {
      sql.exec('DELETE FROM imports WHERE file = ?', file);
      const n = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
      for (let c = 0; c < n; c++) {
        sql.exec('INSERT INTO imports (file, seq, data) VALUES (?, ?, ?)', file, c,
          bytes.slice(c * CHUNK_BYTES, (c + 1) * CHUNK_BYTES).buffer);
      }
    });
    await this.flush();
    await this.adopt(e);
    this.loadImports(e);
    this.lastRunRev = null;   // the engine's external files changed
    const code = name + ' = ' + (kind === 'step' ? 'import_step' : 'import_brep') + '(' + JSON.stringify(file) + ')\n'
      + 'show(' + name + ', ' + JSON.stringify(name) + ')';
    const res = await MCP_TOOLS.execute.call(this, e, { code });
    res.content[0].text = 'imported ' + file + ' (' + (bytes.length / 1024).toFixed(1) + ' KB, kept with the session) as `'
      + name + '`; the script now reads it with ' + (kind === 'step' ? 'import_step' : 'import_brep') + '("' + file + '").\n'
      + res.content[0].text;
    return res;
  },

  async search_library(e, a) {
    const parts = searchParts(a.query || '');
    return toolText(JSON.stringify({ count: parts.length, parts }, null, 1));
  },

  async load_part(e, a) {
    const name = String(a.name || '');
    const info = partInfo(name);
    if (!info) {
      throw new UserError('no part named "' + name + '"; search_library lists them: '
        + searchParts('').map((p) => p.name).join(', '));
    }
    let params = a.params || {};
    if (typeof params === 'string') {
      try { params = params.trim() ? JSON.parse(params) : {}; } catch (err) { throw new UserError('params must be a JSON object'); }
    }
    const spec = info.parameters || {};
    const args = [];
    for (const [k, v] of Object.entries(params)) {
      if (!spec[k]) { throw new UserError(name + ' has no parameter "' + k + '"; it takes ' + Object.keys(spec).join(', ')); }
      const t = spec[k].type;
      if (t === 'str') { args.push(k + '=' + JSON.stringify(String(v))); }
      else {
        const n = Number(v);
        if (!Number.isFinite(n)) { throw new UserError(k + ' must be a number'); }
        args.push(k + '=' + (t === 'int' ? String(Math.round(n)) : String(n)));
      }
    }
    const var0 = String(a.as_name || name).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    const code = 'import cs_parts\n' + var0 + ' = cs_parts.load(' + JSON.stringify(name) + (args.length ? ', ' + args.join(', ') : '')
      + ')\nshow(' + var0 + ', ' + JSON.stringify(var0) + ')';
    const res = await MCP_TOOLS.execute.call(this, e, { code });
    res.content[0].text = 'loaded the library part ' + name + ' (' + info.description + ') as `' + var0 + '`\n'
      + res.content[0].text;
    return res;
  },

  async health_check(e) {
    const mem = (() => { try { return e.memoryStats(); } catch (err) { return null; } })();
    const sc = this.script();
    const res = this.lastResult || this.meta('result');
    const imports = this.ctx.storage.sql.exec('SELECT file, SUM(LENGTH(data)) AS bytes FROM imports GROUP BY file').toArray();
    return toolText(JSON.stringify({ ok: true, engine: { flavor: this.flavor, bootMs: isolate.bootMs, isolateAgeS: Math.round((Date.now() - isolate.startedAt) / 1000),
      holdsThisSession: isolate.owner === this.key, compactions: isolate.compactions,
      memoryMB: mem ? Object.fromEntries(Object.entries(mem).filter(([k, v]) => typeof v === 'number').map(([k, v]) => [k, Math.round(v / 1048576 * 10) / 10])) : null },
      session: { name: this.sessionName, scriptRev: sc.rev, lines: sc.code ? sc.code.split('\n').length : 0,
        lastRun: res ? { rev: res.rev, ok: res.ok, shapes: res.shapeCount } : null, imports },
      limits: { callsPerMinute: this.callsPerMin, callsPerDay: this.callsPerDay, scriptKB: MAX_SCRIPT_BYTES / 1024,
        fileMB: MAX_FILE_BYTES / 1048576, fileTtlS: this.fileTtlS } }, null, 1));
  },

  async destroy_session(e, a) {
    if (a.confirm !== true) {
      throw new UserError('destroy_session deletes the script, snapshots, exported and imported files and the cache '
        + 'of this session for good: call it again with confirm: true');
    }
    if (isolate.owner === this.key) { rewind(e); isolate.owner = null; }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.ensureTables();
    this.persistedDigest = null;
    this.lastPersist = null;
    this.lastRestore = null;
    this.lastResult = null;
    this.lastRunRev = null;
    return toolText('session ' + this.sessionName + ' destroyed: script, snapshots, files and cache are gone. '
      + 'The id can be used again for a new, empty session.');
  },

  async repair_hints(e, a) {
    return toolText(JSON.stringify({ hints: repairHints(a.error_text, true) }, null, 1));
  },

  async workflow_hints() {
    return toolText(WORKFLOW);
  },

  async export(e, a) {
    const format = String(a.format || '').toLowerCase();
    if (!MIME[format]) { throw new UserError('format must be one of ' + Object.keys(MIME).join(', ')); }
    const r = await this.ensureScene(e);
    if (!r.shapeCount) { throw new UserError('nothing to export: the script shows no shapes'); }
    const names = e.sceneNames();
    const idx = resolveObjects(names, a.object_name);
    const all = idx.length === names.length;
    const shapes = this.quickScene(e);
    const base = String(a.filename || (all ? 'model' : names[idx[0]] || 'model')).replace(/[^A-Za-z0-9_.-]+/g, '_')
      .replace(/\.[A-Za-z0-9]+$/, '') || 'model';
    // the export gate (build123d-mcp's): a 3-D file of an object that fails
    // validate would be rejected by strict consumers — say so, or refuse
    let gateLine = '';
    if (['step', 'stl', 'brep', 'glb', '3mf'].includes(format)) {
      const v = gateVerdict(this.gateFor(e, { indices: idx }));
      gateLine = '\ngate: ' + (v.passes ? 'PASS' : 'FAIL — ' + v.reasons.join('; '));
      if (!v.passes && a.strict) {
        throw new UserError('not exported: the validity gate FAILs (strict) — ' + v.reasons.join('; ')
          + withHints(v.reasons.join('\n')));
      }
    }
    const pick = all ? null : e.pickShape(idx);
    let bytes;
    let clear = false;
    try {
      const shape = pick ? pick.shape : undefined;
      if (format === 'step') { bytes = new TextEncoder().encode(e.exportSTEP({ shape })); }
      else if (format === 'brep') { bytes = new TextEncoder().encode(e.exportBREP({ shape })); }
      else if (format === 'stl') { bytes = new TextEncoder().encode(e.exportSTL({ shape })); clear = true; }
      else if (format === 'glb') { bytes = e.exportGLB({ indices: all ? undefined : idx, names }); }
      else if (format === '3mf') {
        let colors;
        if (a.colors && typeof a.colors === 'object') {
          colors = {};
          for (const [key, value] of Object.entries(a.colors)) {
            const c = parseColor(value);
            if (!c) { throw new UserError('colors: cannot read "' + value + '"'); }
            for (const i of resolveObjects(names, /^\d+$/.test(key) ? Number(key) : key)) { colors[i] = c; }
          }
        }
        bytes = e.export3MF({ indices: idx, colors }).bytes;
      }
      else if (format === 'dxf') { bytes = new TextEncoder().encode(e.drawingDXF({ view: a.view, shape }).dxf); }
      else { bytes = new TextEncoder().encode(e.drawingSVG({ view: a.view, shape }).svg); }
    } finally { if (pick) { pick.free(); } }
    const f = this.storeFile(base + '.' + format, MIME[format], bytes);
    await this.flush();
    const vol = idx.reduce((n, i) => n + (shapes[i].volume || 0), 0);
    return { content: [{ type: 'text', text: format.toUpperCase() + ' ' + (f.bytes / 1024).toFixed(1) + ' KB: '
      + f.url + '\n(kept ' + f.expiresInS + ' s) ' + idx.length + ' object(s): ' + idx.map((i) => label(shapes[i])).join(', ')
      + '; total volume ' + fmt(vol) + ' mm^3' + (format === 'glb' ? ', in metres with Y up' : '') + (format === '3mf' ? ', one mesh object per object, mm' : '')
      + (format === 'dxf' ? ', the ' + (a.view || 'iso') + ' view projected, mm, layers VISIBLE / HIDDEN' : '')
      + gateLine + '\n' + FILE_LINK_NOTE }], after: { clear } };
  },

  /** One shown object as an engineering drawing. The drafting Worker
   *  (drafting/, draftwright-rust, AGPL) plans it from the object's STEP over
   *  the DRAFTING service binding. The STEP is written here, inside the
   *  engine queue; the drawing is awaited outside it (`outside`), so other
   *  sessions on this isolate's engine are not held up while it plans. */
  async make_drawing(e, a) {
    const drafting = this.env.DRAFTING;
    if (!drafting) { throw new UserError('drawings are not available on this deployment (no drafting service is bound)'); }
    const r = await this.ensureScene(e);
    if (!r.shapeCount) { throw new UserError('nothing to draw: the script shows no shapes'); }
    const names = e.sceneNames();
    const shapes = this.quickScene(e);
    const idx = resolveObjects(names, a.object_name);
    if (idx.length !== 1) {
      throw new UserError('make_drawing draws one part: pass object_name (the scene has ' + names.length
        + ' objects: ' + shapes.map(label).join(', ') + ')');
    }
    const ops = [];
    for (const key of ['title', 'number', 'material', 'tolerance', 'drawn_by', 'revision']) {
      if (a[key] !== undefined && a[key] !== '') { ops.push({ op: 'set', path: 'sheet/title/' + key, value: String(a[key]) }); }
    }
    for (const key of ['size', 'scale', 'projection']) {
      if (a[key] !== undefined && a[key] !== '') { ops.push({ op: 'set', path: 'sheet/' + key, value: String(a[key]) }); }
    }
    if (a.ops !== undefined) {
      const list = Array.isArray(a.ops) ? a.ops : [a.ops];
      if (list.some((op) => !op || typeof op !== 'object' || typeof op.op !== 'string' || typeof op.path !== 'string')) {
        throw new UserError('ops must be a list of draftwright Spec edits, each {"op", "path", "value"}');
      }
      ops.push(...list);
    }
    const v = gateVerdict(this.gateFor(e, { indices: idx }));
    const pick = names.length > 1 ? e.pickShape(idx) : null;
    let step;
    try { step = e.exportSTEP({ shape: pick ? pick.shape : undefined }); }
    finally { if (pick) { pick.free(); } }
    const s = shapes[idx[0]];
    const base = String(a.filename || s.name || 'drawing').replace(/[^A-Za-z0-9_.-]+/g, '_')
      .replace(/\.[A-Za-z0-9]+$/, '') || 'drawing';
    const stepBytes = new TextEncoder().encode(step);
    return { outside: async () => {
      let d;
      try {
        d = await drafting.draw(stepBytes, { name: base + '.step', ops, formats: ['pdf', 'svg'] });
      } catch (err) {
        const m = String((err && err.message) || err);
        throw new UserError((/memory/i.test(m) ? 'the drawing service ran out of memory on this part (draw a simpler one): '
          : 'the drawing service is unavailable or failed: ') + m);
      }
      if (!d.ok) {
        throw new UserError('no drawing: ' + d.message
          + (d.choices && d.choices.length ? '\nchoices: ' + JSON.stringify(d.choices) : ''));
      }
      const pdf = this.storeFile(base + '.pdf', 'application/pdf', new Uint8Array(d.pdf));
      const svg = this.storeFile(base + '.svg', MIME.svg, new Uint8Array(d.svg));
      await this.flush();
      const rank = { error: 0, warning: 1, info: 2 };
      const problems = d.problems.slice().sort((p, q) => (rank[p.severity] ?? 3) - (rank[q.severity] ?? 3));
      const lines = ['DRAWING of ' + label(s) + ': ' + (d.sheet.size || '?') + ' at ' + (d.sheet.scale || '?')
        + ', views ' + d.views.join(', ') + '; ' + d.dimensions + ' dimensions; ' + d.faces + ' faces, '
        + d.features + ' features recognised (status: ' + d.status + ')',
        'PDF ' + (pdf.bytes / 1024).toFixed(1) + ' KB: ' + pdf.url,
        'SVG ' + (svg.bytes / 1024).toFixed(1) + ' KB: ' + svg.url + '\n(kept ' + pdf.expiresInS + ' s)'];
      if (problems.length) {
        lines.push('problems (' + problems.length + '); a fix is Spec edits to pass in ops:');
        for (const p of problems.slice(0, 15)) {
          const msg = String(p.message || '');
          lines.push('- [' + p.severity + '] ' + p.code + ': ' + (msg.length > 280 ? msg.slice(0, 277) + '...' : msg)
            + (p.fix && p.fix.length ? '\n  fix: ' + JSON.stringify(p.fix) : ''));
        }
        if (problems.length > 15) { lines.push('... and ' + (problems.length - 15) + ' more'); }
      } else {
        lines.push('problems: none');
      }
      lines.push('gate: ' + (v.passes ? 'PASS' : 'FAIL — ' + v.reasons.join('; ')), FILE_LINK_NOTE,
        'Drawn by ' + d.engine + ' (' + d.license + '); source: ' + d.engineSource
        + (d.serviceSource ? '; this drawing service: ' + d.serviceSource : '') + '.');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } };
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
        objects: res.summary ? res.summary.map((s) => (s.name ? s.name : '[' + s.index + ']')) : undefined,
        errors: res.errors.map((x) => x.split('\n')[0]), cache: res.cache,
        at: new Date(res.at).toISOString() } : null,
      snapshots: snaps.map((s) => ({ name: s.name, rev: s.rev, at: new Date(s.at).toISOString() })),
      refs: this.meta('refs') || {},
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
      : 'rev ' + res.rev + ':\n') + out.join('\n\n') + withHints(res.errors.join('\n')));
  },

  async reset() {
    const sc = this.saveScript('', 'agent');
    this.lastRunRev = null;
    this.recordResult(sc.rev, { ok: true, errors: [], logs: [], shapeCount: 0 });
    this.setMeta('refs', {});
    return toolText('Session reset: the script is empty (rev ' + sc.rev + '). Snapshots and files are kept.');
  },

  async save_snapshot(e, a) {
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(String(a.name || ''))) { throw new UserError('a snapshot "name" is needed (letters, digits, _ . -)'); }
    const sc = this.script();
    let summary = null;
    if (sc.code.trim()) {
      const r = await this.ensureScene(e);
      summary = r.shapeCount ? summaryOf(this.quickScene(e)) : [];
    }
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO snapshots (name, code, rev, at, summary) VALUES (?, ?, ?, ?, ?)',
      a.name, sc.code, sc.rev, Date.now(), summary ? JSON.stringify(summary) : null);
    return { content: [{ type: 'text', text: 'saved snapshot "' + a.name + '" (script rev ' + sc.rev + ', '
      + sc.code.split('\n').length + ' lines' + (summary ? ', ' + summary.length + ' object(s)' : '') + ')' }], after: {} };
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
      this.flavor = o.flavor;
      // module scope runs before the clock starts on workerd (Date.now() is 0 there)
      if (!(isolate.startedAt > 1e12)) { isolate.startedAt = Date.now(); }
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
      sql.exec('CREATE TABLE IF NOT EXISTS snapshots (name TEXT PRIMARY KEY, code TEXT, rev INTEGER, at INTEGER, summary TEXT)');
      // objects created before snapshots kept a summary
      if (!sql.exec('PRAGMA table_info(snapshots)').toArray().some((c) => c.name === 'summary')) {
        sql.exec('ALTER TABLE snapshots ADD COLUMN summary TEXT');
      }
      sql.exec('CREATE TABLE IF NOT EXISTS files (id TEXT, seq INTEGER, data BLOB, PRIMARY KEY (id, seq))');
      // files handed to the session's scripts (import_cad_file): kept with the session
      sql.exec('CREATE TABLE IF NOT EXISTS imports (file TEXT, seq INTEGER, data BLOB, PRIMARY KEY (file, seq))');
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
      this.loadImports(e);
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

    /** This session's imported files into the engine, and nobody else's:
     *  STEP through the external-file table (import_step), BREP into MEMFS
     *  (import_brep). */
    loadImports(e) {
      e.clearExternalFiles();
      for (const f of isolate.memfsImports || []) { try { globalThis.self.oc.FS.unlink('/' + f); } catch (err) { /* gone */ } }
      isolate.memfsImports = [];
      const sql = this.ctx.storage.sql;
      const files = sql.exec('SELECT DISTINCT file FROM imports').toArray().map((r) => r.file);
      const steps = {};
      for (const file of files) {
        const parts = sql.exec('SELECT data FROM imports WHERE file = ? ORDER BY seq', file).toArray();
        const total = parts.reduce((n, r) => n + r.data.byteLength, 0);
        const buf = new Uint8Array(total);
        let off = 0;
        for (const r of parts) { buf.set(new Uint8Array(r.data), off); off += r.data.byteLength; }
        const text = new TextDecoder('latin1').decode(buf);
        if (/\.brep$/i.test(file)) {
          e.writeFile(file.replace(/\//g, '_'), text);
          isolate.memfsImports.push(file.replace(/\//g, '_'));
        } else { steps[file] = text; }
      }
      if (Object.keys(steps).length) { e.loadExternalFiles(steps); }
      return files;
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
      const code = last.language && last.language !== 'python' ? sc.code : withResultShow(sc.code);
      const r = await e.run(code, { language: last.language, mesh: false, keepScene: true,
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
        // the editor's script as written; the run gets the `result` fallback
        const userCode = req.code;
        if (!req.language || req.language === 'python') { req.code = withResultShow(userCode); }
        const out = await worker.runRender(e, req, ch.phase, { reset: false, keepScene: stream });
        const t3 = performance.now();
        isolate.renders++;
        this.instance.renders++;
        isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
        // what history/export re-run when the engine lost this render
        this.setMeta('last', { language: req.language, gui: req.gui, maxDeviation: req.maxDeviation });
        // the editor's code IS the session script (an agent sees the edit)
        const sc = this.saveScript(userCode, 'editor');
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
      const r = await e.run(withResultShow(sc.code), { keepScene: true, guiState: {} });
      this.ranThisCall = true;
      this.callMisses += r.cache ? r.cache.misses : 1;
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
      this.lastRunRev = sc.rev;
      this.lastRunKept = true;
      const res = this.recordResult(sc.rev, r, { summary: r.shapeCount ? summaryOf(this.quickScene(e)) : [] });
      await this.flush();
      return res;
    }

    /** Run the session script plus a probe (`prelude` lines, then one
     *  Python expression that evaluates to a JSON string) and return the
     *  parsed value. The engine then holds the probe run, so the next tool
     *  re-runs the script (all cache hits). `what` names the probe's part
     *  in errors ("the selector"). */
    async runProbe(e, prelude, expr, what = 'the probe') {
      const sc = this.script();
      if (!sc.code.trim()) { throw new UserError('the session script is empty: use execute or set_script first'); }
      // the `result` fallback goes BEFORE the probe, so the probe sees the
      // scene the tools see
      const base = String(withResultShow(sc.code)).replace(/\s*$/, '');
      const lines = base.split('\n').length;
      const MARK = '@@cs-probe@@';
      const probe = base + '\nimport build123d as _cs_b\n' + prelude
        + 'print(' + JSON.stringify(MARK) + ' + (' + expr + '))\n';
      await this.adopt(e);
      const r = await e.run(probe, { keepScene: true, guiState: {} });
      this.ranThisCall = true;
      this.callMisses += r.cache ? r.cache.misses : 1;
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
      this.lastRunRev = null;
      const out = (r.logs || []).filter((l) => l.startsWith(MARK)).pop();
      if (!r.ok || !out) {
        const err = (r.errors || []).join('\n') || 'no result';
        const n = [...err.matchAll(/File "main", line (\d+)/g)].map((m) => Number(m[1])).pop() || 0;
        throw new UserError((n > lines ? what + ' raised' : 'the script raised (fix it first)') + ': '
          + err.split('\n').filter((l) => !/File "main", line/.test(l)).join('\n').trim().split('\n').pop()
          + withHints(err));
      }
      return JSON.parse(out.slice(MARK.length));
    }

    /** find_holes & co: build123d-drafting-helpers' finders (vendored into
     *  build123d-lite as build123d_drafting) on one object, or on all shown
     *  objects as one compound. */
    async findFeatures(e, a, kind) {
      const { label: label0, res } = await this.probeObject(e, a.object_name,
        "_cs_f.report('" + kind + "', _cs_obj)", 'the feature finder');
      return { content: [{ type: 'text', text: JSON.stringify(Object.assign({ object: label0 }, res), null, 1) }],
        after: {} };
    }

    /** A probe on shown objects (one, several as a compound, or all):
     *  `expr` sees the shape as _cs_obj and the vendored modules as _cs_f
     *  (_cs_mcp_features); it returns a JSON-able value. */
    async probeObject(e, objectName, expr, what) {
      const r = await this.ensureScene(e);
      if (!r.shapeCount) { throw new UserError('nothing to inspect: the script shows no shapes'); }
      const names = e.sceneNames();
      const idx = resolveObjects(names, objectName);
      const label0 = idx.length === names.length ? (names.length === 1 ? (names[0] ? '"' + names[0] + '"' : '[0]')
        : 'all shown objects') : idx.map((i) => (names[i] ? '"' + names[i] + '"' : '[' + i + ']')).join(' + ');
      const res = await this.runProbe(e, 'import _cs_mcp_features as _cs_f\n_cs_obj = _cs_b._cs_scene_object('
        + JSON.stringify(idx) + ')\n', '_cs_b._cs_json(' + expr + ')', what);
      return { label: label0, res };
    }

    /** engine.gate() of the current run, cached per run and options
     *  (validate, then locate_gate_defects, ask for the same). */
    gateFor(e, opts) {
      const key = JSON.stringify(opts);
      if (!this.gates || this.gates.run !== isolate.lastRun || isolate.lastRun === null) {
        this.gates = { run: isolate.lastRun, byKey: new Map() };
      }
      if (!this.gates.byKey.has(key)) { this.gates.byKey.set(key, e.gate(opts)); }
      return this.gates.byKey.get(key);
    }

    /** The quick inspection (type, solids, faces, volume, fast box, name)
     *  of the engine's current run, computed once per run. */
    quickScene(e) {
      if (!this.quick || this.quick.run !== isolate.lastRun || isolate.lastRun === null) {
        let shapes = [];
        try { shapes = e.inspectShapes({ quick: true }); } catch (err) { shapes = []; }
        this.quick = { run: isolate.lastRun, shapes };
      }
      return this.quick.shapes;
    }

    /** compare kind="snapshot": per object, snapshot a against the current
     *  session (or snapshot b), from the summaries kept with each. */
    async compareSnapshots(e, a) {
      const sql = this.ctx.storage.sql;
      const load = (name) => {
        const row = sql.exec('SELECT rev, summary FROM snapshots WHERE name = ?', String(name)).toArray()[0];
        if (!row) {
          const all = sql.exec('SELECT name FROM snapshots ORDER BY at').toArray().map((x) => x.name);
          throw new UserError('no snapshot named "' + name + '"; saved: ' + (all.length ? all.join(', ') : 'none'));
        }
        if (row.summary === null) { throw new UserError('snapshot "' + name + '" was saved without a summary: save it again'); }
        return { label: String(name), rev: row.rev, objects: JSON.parse(row.summary) };
      };
      const A = load(a.a);
      let B;
      if (a.b !== undefined && a.b !== null && a.b !== '') { B = load(a.b); }
      else {
        const r = this.script().code.trim() ? await this.ensureScene(e) : { shapeCount: 0 };
        B = { label: 'current', rev: this.script().rev, objects: r.shapeCount ? summaryOf(this.quickScene(e)) : [] };
      }
      if (a.format === 'json') { return toolText(JSON.stringify({ a: A, b: B }, null, 1)); }
      const lines = ['diff: ' + A.label + ' (rev ' + A.rev + ') -> ' + B.label + ' (rev ' + B.rev + ')'];
      const before = new Map(A.objects.map((x) => [keyOf(x), x]));
      for (const x of B.objects) {
        const y = before.get(keyOf(x));
        before.delete(keyOf(x));
        if (!y) { lines.push('  + ' + label(x) + ' (added): volume ' + fmt(x.volume) + ', ' + x.faces + ' faces'); continue; }
        if (sameShape(x, y)) { lines.push('  = ' + label(x) + ': unchanged (volume ' + fmt(x.volume) + ')'); continue; }
        const sx = size(x.bbox); const sy = size(y.bbox);
        lines.push('  ~ ' + label(x) + ': volume ' + fmt(y.volume) + ' -> ' + fmt(x.volume) + ' (' + (x.volume - y.volume >= 0 ? '+' : '')
          + fmt(x.volume - y.volume) + '), faces ' + y.faces + ' -> ' + x.faces
          + (JSON.stringify(sx) !== JSON.stringify(sy) ? ', size ' + sy.map(fmt).join(' x ') + ' -> ' + sx.map(fmt).join(' x ') : ''));
      }
      for (const y of before.values()) { lines.push('  - ' + label(y) + ' (removed): was volume ' + fmt(y.volume)); }
      return { content: [{ type: 'text', text: lines.join('\n') }], after: {} };
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
        // a tool can finish outside the engine queue (make_drawing awaits
        // another Worker): it returns {outside: async () => result}
        let outside = null;
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
          if (typeof result.outside === 'function') { outside = result.outside; }
          else { resolve(result); }
          if (after) {
            await yieldToIo();
            this.lastAfter = await this.afterRun(e, after);
          }
        });
        job.then(() => {
          if (!outside) { return; }
          outside().then(resolve, (err) => resolve(toolText(err instanceof UserError ? err.message
            : 'session error: ' + ((err && err.message) || err), true)));
        }, () => {});
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
    async runAsScript(e, code, { source, rollback = false, offset = 0, label: verb = 'ran', chunk }) {
      if (code.length > MAX_SCRIPT_BYTES) {
        throw new UserError('the script is over ' + (MAX_SCRIPT_BYTES / 1024) + ' KB');
      }
      // what the scene was, to report the change (only if it is this script's)
      const prevRes = this.lastResult || this.meta('result');
      const prev = prevRes && prevRes.ok && !prevRes.rejected && prevRes.rev === this.script().rev
        ? prevRes.summary || null : null;
      await this.adopt(e);
      const r = await e.run(withResultShow(code), { keepScene: true, guiState: {} });
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
          + r.errors.map(mapLines).join('\n\n') + logsText(r) + withHints(r.errors.join('\n')) }],
          isError: true, after: { faulted } };
      }
      sc = this.saveScript(code, source);
      this.lastRunRev = sc.rev;
      this.lastRunKept = true;
      const shapes = r.shapeCount ? this.quickScene(e) : [];
      const summary = summaryOf(shapes);
      this.recordResult(sc.rev, r, { summary });
      await this.flush();
      const lines = [(r.ok ? 'OK' : 'ERROR') + ': ' + verb + ' the session script (rev ' + sc.rev + ', '
        + code.split('\n').length + ' lines). session: ' + this.sessionName];
      if (!r.ok) { lines.push(r.errors.map(mapLines).join('\n\n')); }
      lines.push(sceneText(shapes, r));
      if (r.ok) {
        const ch = changeText(prev, summary, chunk);
        if (prev) { lines.push(...ch.lines); }
        for (const w of ch.warnings) { lines.push('Warning: ' + w); }
      }
      if (r.cache) { lines.push('cache: ' + r.cache.hits + ' hits, ' + r.cache.misses + ' misses'); }
      return { content: [{ type: 'text', text: lines.join('\n') + logsText(r)
        + (r.ok ? '' : withHints(r.errors.join('\n'))) }], isError: !r.ok, after: { faulted } };
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
