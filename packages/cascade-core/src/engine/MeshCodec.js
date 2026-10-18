// MeshCodec.js — the viewport mesh payload as binary, and the framed stream
// a remote editing session answers with (examples/cloudflare-worker/src/
// session.js encodes, RemoteCascadeEngine.js decodes).
//
// ShapeToMesh produces `[faces, edges]`: one object per face/edge whose
// coordinate lists are plain JS arrays of doubles. As JSON that is ~18 bytes
// per number; here every numeric list moves into one of two shared buffers
// (Float32 for coordinates — the viewport uploads Float32 anyway — and
// Uint32 for triangle indices) and the objects keep only their scalars plus
// [offset, length] references. Decoding hands the viewport typed-array views
// in place of the arrays; it only indexes and spreads them.
//
// The stream is a sequence of frames, [kind u8][length u32 LE][bytes]:
//   PHASE   JSON {phase, ...}   one per await boundary of the job
//   RESULT  JSON                the render's JSON payload, with `mesh` packed
//   F32     the Float32 buffer  (follows a RESULT that has a mesh)
//   U32     the Uint32 buffer
//   MESH    JSON                one batch of a STREAMED mesh (followed by
//                               its F32 and U32): face/edge scalars with
//                               offsets, or {slot, id, ref} for a face whose
//                               geometry the client already holds
//   DONE    JSON                the end of a streamed mesh: {stats, keep}
//                               (`keep`: the face ids the client should hold
//                               on to — the server will only refer to those)
// A kind with the GZIP bit set carries a gzipped body. The sender gzips the
// big frames itself: Cloudflare compresses only well-known content types,
// and a viewport mesh shrinks ~4.5x (heat_exchanger: 6.3 -> 1.4 MB).

export const FRAME = { PHASE: 1, RESULT: 2, F32: 3, U32: 4, MESH: 5, DONE: 6, GZIP: 0x80 };
export const FRAMES_CONTENT_TYPE = 'application/x-cascade-frames';
/** Frames at least this big go out gzipped. */
export const GZIP_MIN_BYTES = 16384;

async function pipeBytes(bytes, transform) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(transform));
  return new Uint8Array(await out.arrayBuffer());
}
export const gzipBytes = (bytes) => pipeBytes(bytes, new CompressionStream('gzip'));
export const gunzipBytes = (bytes) => pipeBytes(bytes, new DecompressionStream('gzip'));

const U32_KEYS = new Set(['tri_indexes']);

function isNumberList(v) {
  return (Array.isArray(v) && (v.length === 0 || typeof v[0] === 'number'))
    || ArrayBuffer.isView(v);
}

/** [faces, edges] (+ any other lists of such objects) -> {meta, f32, u32}. */
export function packMesh(lists) {
  let nf = 0; let nu = 0;
  for (const name in lists) {
    for (const item of lists[name] || []) {
      for (const k in item) {
        if (!isNumberList(item[k])) { continue; }
        if (U32_KEYS.has(k)) { nu += item[k].length; } else { nf += item[k].length; }
      }
    }
  }
  const f32 = new Float32Array(nf);
  const u32 = new Uint32Array(nu);
  let of = 0; let ou = 0;
  const meta = {};
  for (const name in lists) {
    meta[name] = (lists[name] || []).map((item) => {
      const m = {};
      for (const k in item) {
        const v = item[k];
        if (!isNumberList(v)) { m[k] = v; continue; }
        if (U32_KEYS.has(k)) {
          u32.set(v, ou);
          (m.$u || (m.$u = {}))[k] = [ou, v.length];
          ou += v.length;
        } else {
          f32.set(v, of);
          (m.$f || (m.$f = {}))[k] = [of, v.length];
          of += v.length;
        }
      }
      return m;
    });
  }
  return { meta, f32, u32 };
}

/** Inverse of packMesh: the lists back, numeric fields as typed views. */
export function unpackMesh(meta, f32, u32) {
  const lists = {};
  for (const name in meta) {
    lists[name] = meta[name].map((m) => {
      const item = {};
      for (const k in m) {
        if (k === '$f' || k === '$u') { continue; }
        item[k] = m[k];
      }
      for (const k in m.$f || {}) { const [o, n] = m.$f[k]; item[k] = f32.subarray(o, o + n); }
      for (const k in m.$u || {}) { const [o, n] = m.$u[k]; item[k] = u32.subarray(o, o + n); }
      return item;
    });
  }
  return lists;
}

/** The 5-byte header of a frame; the body is written after it as-is (a
 *  big typed array is not copied behind its header). */
export function frameHeader(kind, length) {
  const out = new Uint8Array(5);
  out[0] = kind;
  new DataView(out.buffer).setUint32(1, length, true);
  return out;
}

/** Async iterator over the frames of a ReadableStream of bytes. Each frame's
 *  bytes are a fresh, 4-byte-aligned copy (safe to view as Float32/Uint32),
 *  already gunzipped; `kind` is reported without the GZIP bit, `wireBytes`
 *  is what the frame took on the wire. */
export async function* readFrames(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let have = 0;
  const need = async (n) => {
    while (have < n) {
      const { value, done } = await reader.read();
      if (done) { return false; }
      chunks.push(value);
      have += value.length;
    }
    return true;
  };
  const take = (n) => {
    const out = new Uint8Array(n);
    let o = 0;
    while (o < n) {
      const c = chunks[0];
      const k = Math.min(c.length, n - o);
      out.set(c.subarray(0, k), o);
      o += k;
      if (k === c.length) { chunks.shift(); } else { chunks[0] = c.subarray(k); }
    }
    have -= n;
    return out;
  };
  try {
    for (;;) {
      if (!(await need(5))) {
        if (have) { throw new Error('truncated frame header'); }
        return;
      }
      const head = take(5);
      const kind = head[0];
      const len = new DataView(head.buffer).getUint32(1, true);
      if (!(await need(len))) { throw new Error('truncated frame (' + len + ' bytes expected)'); }
      const bytes = take(len);
      const wireBytes = 5 + len;
      if (kind & FRAME.GZIP) { yield { kind: kind & ~FRAME.GZIP, bytes: await gunzipBytes(bytes), wireBytes }; }
      else { yield { kind, bytes, wireBytes }; }
    }
  } finally {
    reader.releaseLock();
  }
}

export function frameJSON(bytes) {
  return JSON.parse(new TextDecoder().decode(bytes));
}
