// PngEncode.js — RGB pixels -> PNG bytes, with no dependencies: the zlib
// stream comes from the platform's CompressionStream('deflate') (Workers,
// browsers, Node 18+), the chunk CRCs from a table.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) { c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes, crc = 0xffffffff) {
  for (let i = 0; i < bytes.length; i++) { crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8); }
  return crc;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) { out[4 + i] = type.charCodeAt(i); }
  out.set(data, 8);
  const crc = crc32(data, crc32(out.subarray(4, 8))) ^ 0xffffffff;
  dv.setUint32(8 + data.length, crc >>> 0);
  return out;
}

async function zlib(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** @param {number} width @param {number} height
 *  @param {Uint8Array} rgb  width*height*3 bytes, rows top to bottom
 *  @returns {Promise<Uint8Array>} the PNG file */
export async function encodePNG(width, height, rgb) {
  const stride = width * 3;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;   // filter: none
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 2;    // colour type: RGB
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await zlib(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Base64 of a byte array (MCP image content, data URLs). */
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
