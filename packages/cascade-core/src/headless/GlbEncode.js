// GlbEncode.js — viewport mesh -> binary glTF 2.0 (.glb), one mesh node per
// scene shape. glTF is Y-up and in metres; CAD here is Z-up and in
// millimetres, so positions become (x, z, -y) / 1000 — the same axis swap the
// CascadeStudio viewport makes, and the size a glTF viewer expects.

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

/** @param {{faces: object[]}} mesh  face records (vertex_coord, normal_coord,
 *         tri_indexes, shape_index)
 *  @param {object} [o] {unit: model units per metre (default 1000), names: string[]}
 *  @returns {Uint8Array} the .glb file */
export function encodeGLB(mesh, o = {}) {
  const perMetre = o.unit || 1000;
  const groups = new Map();
  for (const f of mesh.faces || []) {
    if (!f.tri_indexes || !f.tri_indexes.length) { continue; }
    const si = f.shape_index === undefined ? 0 : f.shape_index;
    if (!groups.has(si)) { groups.set(si, []); }
    groups.get(si).push(f);
  }
  const chunks = [];
  let offset = 0;
  const bufferViews = []; const accessors = []; const meshes = []; const nodes = [];
  const addView = (bytes, target) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); offset += pad; }
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    offset += bytes.byteLength;
    return bufferViews.length - 1;
  };
  for (const [si, faces] of groups) {
    let nv = 0; let ni = 0;
    for (const f of faces) { nv += f.vertex_coord.length / 3; ni += f.tri_indexes.length; }
    const pos = new Float32Array(nv * 3); const nrm = new Float32Array(nv * 3); const idx = new Uint32Array(ni);
    const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
    let vo = 0; let io = 0;
    for (const f of faces) {
      const v = f.vertex_coord; const n = f.normal_coord; const t = f.tri_indexes;
      const count = v.length / 3;
      for (let i = 0; i < count; i++) {
        const x = v[i * 3] / perMetre, y = v[i * 3 + 2] / perMetre, z = -v[i * 3 + 1] / perMetre;
        const j = (vo + i) * 3;
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
        if (x < lo[0]) { lo[0] = x; } if (y < lo[1]) { lo[1] = y; } if (z < lo[2]) { lo[2] = z; }
        if (x > hi[0]) { hi[0] = x; } if (y > hi[1]) { hi[1] = y; } if (z > hi[2]) { hi[2] = z; }
        if (n && n.length) { nrm[j] = n[i * 3]; nrm[j + 1] = n[i * 3 + 2]; nrm[j + 2] = -n[i * 3 + 1]; }
        else { nrm[j + 1] = 1; }
      }
      for (let k = 0; k < t.length; k++) { idx[io + k] = t[k] + vo; }
      vo += count; io += t.length;
    }
    const pv = addView(pos, ARRAY_BUFFER);
    const nvw = addView(nrm, ARRAY_BUFFER);
    const iv = addView(idx, ELEMENT_ARRAY_BUFFER);
    accessors.push({ bufferView: pv, componentType: FLOAT, count: nv, type: 'VEC3', min: lo, max: hi });
    accessors.push({ bufferView: nvw, componentType: FLOAT, count: nv, type: 'VEC3' });
    accessors.push({ bufferView: iv, componentType: UNSIGNED_INT, count: ni, type: 'SCALAR' });
    const a = accessors.length;
    meshes.push({ primitives: [{ attributes: { POSITION: a - 3, NORMAL: a - 2 }, indices: a - 1, material: 0 }] });
    nodes.push({ mesh: meshes.length - 1, name: (o.names && o.names[si]) || ('shape' + si) });
  }
  const gltf = {
    asset: { version: '2.0', generator: 'cascade-core GlbEncode' },
    scene: 0,
    scenes: [{ nodes: nodes.map((n, i) => i) }],
    nodes, meshes, accessors, bufferViews,
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.75, 0.77, 0.8, 1], metallicFactor: 0.3, roughnessFactor: 0.6 } }],
    buffers: [{ byteLength: offset }],
  };
  if (!meshes.length) { delete gltf.buffers; delete gltf.bufferViews; delete gltf.accessors; delete gltf.meshes; gltf.scenes = [{ nodes: [] }]; gltf.nodes = []; }
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLen = Math.ceil(json.length / 4) * 4;
  const binLen = Math.ceil(offset / 4) * 4;
  const total = 12 + 8 + jsonLen + (offset ? 8 + binLen : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);   // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true);  // 'JSON'
  out.set(json, 20);
  for (let i = json.length; i < jsonLen; i++) { out[20 + i] = 0x20; }
  if (offset) {
    let p = 20 + jsonLen;
    dv.setUint32(p, binLen, true);
    dv.setUint32(p + 4, 0x004e4942, true);   // 'BIN\0'
    p += 8;
    for (const c of chunks) { out.set(c, p); p += c.length; }
  }
  return out;
}
