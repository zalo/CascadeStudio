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
      this.ensureTables();
    }

    ensureTables() {
      // (deleteAll() drops the tables too, so DELETE calls this again)
      const sql = this.ctx.storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS snap (seq INTEGER PRIMARY KEY, data BLOB)');
      sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
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
      const last = this.meta('last');
      if (!last) { return null; }
      await this.adoptWithPhase(e, ch);
      await ch.phase('re-running');
      const r = await e.run(last.code, { language: last.language, mesh: false,
        guiState: last.gui || undefined });
      isolate.lastRun = this.lastRun = this.key + ':' + (++isolate.runSeq);
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
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', 'last',
          JSON.stringify({ code: req.code, language: req.language, gui: req.gui,
            maxDeviation: req.maxDeviation }));
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
        };
        const m = stream ? e.meshScene({ maxDeviation: req.maxDeviation }) : null;
        await ch.finish(out, out.ok ? 200 : 422, m && m.shapeLines.length ? {
          batches: m.batches, shapeLines: m.shapeLines,
          client: this.meshClientFor(body.clientCache), live: () => e.meshCache.liveIds(),
        } : null);
        this.keepWarm();

        // ---- after the response: compaction and persistence ----
        await yieldToIo();
        const a0 = performance.now();
        const after = { compacted: false };
        // meshes written into cached shapes (the viewport mesh, STL export,
        // measure) must not outlive this render — see engine.clearMeshes()
        if (frames || req.formats.includes('stl') || req.measure) {
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
        const faulted = !out.ok && KERNEL_FAULT.test((out.errors || []).join('\n'));
        const compact = occtMB >= this.compactAtMB || faulted;
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
        this.lastAfter = after;
      });
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
      const action = (url.pathname.match(/^\/session\/[^/]+(\/.*)?$/) || [])[1] || '/';
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
    'access-control-allow-headers': 'content-type',
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

  return { EditSession, fetch };
}
