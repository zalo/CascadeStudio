// MeshCodec round trip: the viewport mesh packed into typed buffers, sent as
// frames (big ones gzipped), re-chunked arbitrarily, read back and unpacked.
// The remote-session editor depends on it (RemoteCascadeEngine.js decodes
// what examples/cloudflare-worker/src/session.js encodes).
//
//   node test/mesh-codec.mjs
import { FRAME, GZIP_MIN_BYTES, frameHeader, frameJSON, gzipBytes, packMesh, readFrames, unpackMesh }
  from '../packages/cascade-core/src/engine/MeshCodec.js';

let failed = 0;
const check = (what, ok) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) { failed++; } };

const faces = [
  { vertex_coord: [0, 1, 2, 3, 4, 5, 6, 7, 8.5], normal_coord: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv_coord: [0, 0, 1, 0, 0, 1], tri_indexes: [0, 1, 2], number_of_triangles: 1,
    face_index: 0, shape_index: 3 },
  { vertex_coord: [], normal_coord: [], uv_coord: [], tri_indexes: [], number_of_triangles: 0,
    face_index: 1, shape_index: -1 },
];
const edges = [{ vertex_coord: Array.from({ length: 30000 }, (_, i) => i * 0.5), edge_index: 2, shape_index: 3 }];
const packed = packMesh({ faces, edges });
check('packMesh puts every coordinate in the Float32 buffer', packed.f32.length === 9 + 9 + 6 + 30000);
check('packMesh puts triangle indices in the Uint32 buffer', packed.u32.length === 3);

const frames = [
  [FRAME.PHASE, new TextEncoder().encode(JSON.stringify({ phase: 'evaluating' }))],
  [FRAME.RESULT, new TextEncoder().encode(JSON.stringify({ ok: true, mesh: { lists: packed.meta } }))],
  [FRAME.F32, new Uint8Array(packed.f32.buffer)],
  [FRAME.U32, new Uint8Array(packed.u32.buffer)],
];
const parts = [];
let gzipped = 0;
for (let [kind, bytes] of frames) {
  if (bytes.length >= GZIP_MIN_BYTES) { bytes = await gzipBytes(bytes); kind |= FRAME.GZIP; gzipped++; }
  parts.push(frameHeader(kind, bytes.length), bytes);
}
check('only the big frame is gzipped', gzipped === 1);
const wire = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
let off = 0;
for (const p of parts) { wire.set(p, off); off += p.length; }

for (const chunk of [1, 7, 777, wire.length]) {
  const stream = new ReadableStream({ start(c) {
    for (let i = 0; i < wire.length; i += chunk) { c.enqueue(wire.slice(i, i + chunk)); }
    c.close();
  } });
  const kinds = [];
  let result = null; let f32 = null; let u32 = null;
  for await (const { kind, bytes } of readFrames(stream)) {
    kinds.push(kind);
    if (kind === FRAME.RESULT) { result = frameJSON(bytes); }
    if (kind === FRAME.F32) { f32 = new Float32Array(bytes.buffer, 0, bytes.byteLength / 4); }
    if (kind === FRAME.U32) { u32 = new Uint32Array(bytes.buffer, 0, bytes.byteLength / 4); }
  }
  const out = unpackMesh(result.mesh.lists, f32, u32);
  check(chunk + '-byte chunks: kinds ' + kinds.join(',') + ', gzip bit stripped',
    kinds.join(',') === '1,2,3,4');
  check(chunk + '-byte chunks: the mesh round-trips',
    Array.from(out.faces[0].vertex_coord).join() === faces[0].vertex_coord.join()
    && Array.from(out.faces[0].tri_indexes).join() === '0,1,2'
    && out.faces[0].shape_index === 3 && out.faces[1].vertex_coord.length === 0
    && out.edges[0].vertex_coord.length === 30000 && out.edges[0].vertex_coord[29999] === 29999 * 0.5
    && out.edges[0].edge_index === 2);
}

const truncated = new ReadableStream({ start(c) { c.enqueue(wire.slice(0, wire.length - 3)); c.close(); } });
let threw = false;
try { for await (const f of readFrames(truncated)) { void f; } } catch (e) { threw = /truncated/.test(e.message); }
check('a truncated stream is an error, not a short mesh', threw);

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('ALL MESH CODEC CHECKS PASSED');
