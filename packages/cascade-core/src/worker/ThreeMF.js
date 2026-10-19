// ThreeMF.js — a 3MF writer with no lib3mf: 3MF is a ZIP (OPC package) of
// XML parts, so the core spec's mesh objects can be written directly. Used by
// build123d-lite's Mesher.write('x.3mf') (Export3MF, into MEMFS like its STL)
// and by headless hosts (engine.export3MF). Synchronous: entries are STORED
// (no deflate), which every 3MF reader accepts.
//
// One <object> per shape, its tessellation welded into a shared-vertex mesh
// (3MF meshes must be manifold, and slicers treat duplicated vertices as
// holes); optional per-object colours as a <basematerials> group.

const te = new TextEncoder();

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) { crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8); }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP of STORED entries: [{name, data: Uint8Array}] -> Uint8Array. */
export function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = te.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, f.data.length, true); dv.setUint32(22, f.data.length, true);
    dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
    local.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, f.data.length, true); cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    cen.set(name, 46);
    parts.push(local, f.data);
    central.push(cen);
    offset += local.length + f.data.length;
  }
  const cenSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cenSize + 22);
  let p = 0;
  for (const part of parts.concat(central, [end])) { out.set(part, p); p += part.length; }
  return out;
}

/** Weld one object's faces ({vertex_coord, tri_indexes}) into shared
 *  vertices; drops triangles that collapse. */
function weld(faces) {
  let lo = [Infinity, Infinity, Infinity]; let hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    const v = f.vertex_coord;
    for (let i = 0; i < v.length; i += 3) {
      for (let k = 0; k < 3; k++) { if (v[i + k] < lo[k]) { lo[k] = v[i + k]; } if (v[i + k] > hi[k]) { hi[k] = v[i + k]; } }
    }
  }
  const q = (Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1) * 1e-9;
  const ids = new Map(); const verts = []; const tris = [];
  for (const f of faces) {
    const v = f.vertex_coord; const t = f.tri_indexes;
    const local = new Array(v.length / 3);
    for (let i = 0; i < local.length; i++) {
      const key = Math.round(v[i * 3] / q) + ',' + Math.round(v[i * 3 + 1] / q) + ',' + Math.round(v[i * 3 + 2] / q);
      let id = ids.get(key);
      if (id === undefined) { id = verts.length / 3; ids.set(key, id); verts.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); }
      local[i] = id;
    }
    for (let k = 0; k + 2 < t.length; k += 3) {
      const a = local[t[k]], b = local[t[k + 1]], c = local[t[k + 2]];
      if (a !== b && b !== c && a !== c) { tris.push(a, b, c); }
    }
  }
  return { verts, tris };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const num = (v) => (Math.abs(v) < 1e-12 ? '0' : String(+v.toFixed(6)));
const hex2 = (x) => ('0' + Math.max(0, Math.min(255, Math.round(x * 255))).toString(16)).slice(-2).toUpperCase();

/** The 3MF package for objects [{name, faces, color: [r,g,b] (0-1) | null}]
 *  (faces as ShapeToMesh returns them). `unit`: a 3MF unit name
 *  (millimeter, inch, ...). Returns {bytes, objects, triangles}. */
export function encode3MF(objects, o = {}) {
  const unit = o.unit || 'millimeter';
  const colored = objects.filter((x) => x.color);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<model unit="' + unit
    + '" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n'
    + '<metadata name="Application">CascadeStudio build123d-lite</metadata>\n<resources>\n';
  if (colored.length) {
    xml += '<basematerials id="1">\n' + colored.map((x) => '<base name="' + esc(x.name || 'color') + '" displaycolor="#'
      + hex2(x.color[0]) + hex2(x.color[1]) + hex2(x.color[2]) + 'FF"/>').join('\n') + '\n</basematerials>\n';
  }
  let triangles = 0;
  const items = [];
  objects.forEach((obj, k) => {
    const id = k + 2;
    const { verts, tris } = weld(obj.faces || []);
    if (!tris.length) { return; }
    triangles += tris.length / 3;
    const ci = colored.indexOf(obj);
    const vparts = [];
    for (let i = 0; i < verts.length; i += 3) {
      vparts.push('<vertex x="' + num(verts[i]) + '" y="' + num(verts[i + 1]) + '" z="' + num(verts[i + 2]) + '"/>');
    }
    const tparts = [];
    for (let i = 0; i < tris.length; i += 3) {
      tparts.push('<triangle v1="' + tris[i] + '" v2="' + tris[i + 1] + '" v3="' + tris[i + 2] + '"/>');
    }
    xml += '<object id="' + id + '" type="model" name="' + esc(obj.name || 'object' + k) + '"'
      + (ci >= 0 ? ' pid="1" pindex="' + ci + '"' : '') + '>\n<mesh>\n<vertices>\n' + vparts.join('\n')
      + '\n</vertices>\n<triangles>\n' + tparts.join('\n') + '\n</triangles>\n</mesh>\n</object>\n';
    items.push('<item objectid="' + id + '"/>');
  });
  xml += '</resources>\n<build>\n' + items.join('\n') + '\n</build>\n</model>\n';
  const types = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
    + '</Relationships>';
  const bytes = zipStore([
    { name: '[Content_Types].xml', data: te.encode(types) },
    { name: '_rels/.rels', data: te.encode(rels) },
    { name: '3D/3dmodel.model', data: te.encode(xml) },
  ]);
  return { bytes, objects: items.length, triangles };
}
