// MeshRaster.js — a small software renderer for viewport meshes, so a host
// with no GPU (a Cloudflare Worker, Node) can hand an agent a picture of the
// model. Input is the face/edge records ShapeToMesh / IncrementalMesher
// produce; output is RGB pixels (PngEncode.js turns them into a PNG).
//
// Orthographic CAD view (Z up), fitted to the scene; z-buffered triangles
// with two lights per vertex (Gouraud), the model's edges drawn on top with
// a depth test, silhouettes from depth discontinuities, an axis triad and
// a couple of text lines in a 5x7 bitmap font. Rendered at 2x and box-
// filtered down for anti-aliasing.

const DEG = Math.PI / 180;

/** Named views: [azimuth, elevation] in degrees. Azimuth 0 looks from the
 *  front (-Y), 90 from the right (+X); elevation 90 looks straight down.
 *  Same convention as CascadeAPI.setCameraAngle. */
export const VIEWS = {
  iso: [45, 30], front: [0, 0], back: [180, 0], right: [90, 0], left: [-90, 0],
  top: [0, 90], bottom: [0, -90], 'iso-back': [225, 30], 'iso-below': [45, -30],
};

// 5x7 glyphs, one byte per row (low 5 bits, MSB = leftmost column)
const FONT = {
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12], 'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14], 'D': [28, 18, 17, 17, 17, 18, 28], 'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16], 'G': [14, 17, 16, 23, 17, 17, 15], 'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14], 'J': [7, 2, 2, 2, 2, 18, 12], 'K': [17, 18, 20, 24, 20, 18, 17],
  'L': [16, 16, 16, 16, 16, 16, 31], 'M': [17, 27, 21, 21, 17, 17, 17], 'N': [17, 17, 25, 21, 19, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14], 'P': [30, 17, 17, 30, 16, 16, 16], 'Q': [14, 17, 17, 17, 21, 18, 13],
  'R': [30, 17, 17, 30, 20, 18, 17], 'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14], 'V': [17, 17, 17, 17, 17, 10, 4], 'W': [17, 17, 17, 21, 21, 21, 10],
  'X': [17, 17, 10, 4, 10, 17, 17], 'Y': [17, 17, 10, 4, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], '-': [0, 0, 0, 31, 0, 0, 0],
  ':': [0, 12, 12, 0, 12, 12, 0], '×': [0, 0, 17, 10, 4, 10, 17], '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '=': [0, 0, 31, 0, 31, 0, 0],
  '|': [4, 4, 4, 4, 4, 4, 4], ',': [0, 0, 0, 0, 12, 4, 8], '+': [0, 4, 4, 31, 4, 4, 0],
  '#': [10, 10, 31, 10, 31, 10, 10],
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** The view basis for an azimuth/elevation (degrees): `toEye` points from
 *  the model to the viewer, `right`/`up` span the screen. */
export function viewBasis(azimuth, elevation) {
  const az = azimuth * DEG; const el = elevation * DEG;
  const toEye = norm([Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)]);
  const fwd = [-toEye[0], -toEye[1], -toEye[2]];
  const up0 = Math.abs(toEye[2]) > 0.999 ? [0, 1, 0] : [0, 0, 1];
  const right = norm(cross(fwd, up0));
  const up = cross(right, fwd);
  return { toEye, right, up };
}

const PALETTE = [[0.74, 0.77, 0.82], [0.62, 0.74, 0.86], [0.80, 0.74, 0.62], [0.66, 0.80, 0.68],
  [0.80, 0.68, 0.76], [0.70, 0.70, 0.86]];
const HIGHLIGHT = [1.0, 0.56, 0.18];
const CAP = [0.84, 0.36, 0.36];

/** 5x7 bitmap text into an RGB buffer (upper-cased; `fpx` px per font
 *  pixel). `halo` draws a 1-font-pixel background-coloured outline first. */
function drawText(rgb, w, h, str, x, y, col, fpx, halo) {
  const put = (X, Y, c) => {
    if (X < 0 || Y < 0 || X >= w || Y >= h) { return; }
    const i = Y * w + X;
    rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
  };
  const glyphs = (fn) => {
    let cxp = x;
    for (const ch0 of String(str)) {
      const g = FONT[ch0.toUpperCase()] || FONT[' '];
      for (let row = 0; row < 7; row++) {
        for (let colI = 0; colI < 5; colI++) {
          if (g[row] & (16 >> colI)) { fn(cxp + colI * fpx, y + row * fpx); }
        }
      }
      cxp += 6 * fpx;
    }
  };
  if (halo) {
    glyphs((X0, Y0) => {
      for (let yy = -fpx; yy < 2 * fpx; yy++) { for (let xx = -fpx; xx < 2 * fpx; xx++) { put(X0 + xx, Y0 + yy, halo); } }
    });
  }
  glyphs((X0, Y0) => {
    for (let yy = 0; yy < fpx; yy++) { for (let xx = 0; xx < fpx; xx++) { put(X0 + xx, Y0 + yy, col); } }
  });
}

/** Render a mesh. Options:
 *    width, height (px, default 800x600), supersample (default 2),
 *    view ('iso', 'front', ... see VIEWS) or azimuth/elevation (degrees),
 *    shapes      only these scene-shape indices (default: all)
 *    highlight   these scene-shape indices in orange
 *    edges       draw the model's edges (default true)
 *    labels      text lines for the bottom-left corner
 *    background  [r, g, b] (0-255, default white)
 *    colors      {shapeIndex: [r, g, b] (0-1)} per-object base colours
 *    clip        {axis: 0|1|2, at, keep: 'below'|'above'}: cut the model at
 *                a plane; what lies inside the solids shows as a flat cap
 *                colour (back faces seen through the cut)
 *    objectLabels {shapeIndex: text} drawn at each object's centre
 *  Returns {width, height, rgb, scale (px per model unit), view}. */
export function renderMeshImage(mesh, o = {}) {
  const W = Math.max(64, Math.min(2048, Math.round(o.width || 800)));
  const H = Math.max(64, Math.min(2048, Math.round(o.height || 600)));
  const ss = Math.max(1, Math.min(3, Math.round(o.supersample || 2)));
  const w = W * ss; const h = H * ss;
  const preset = VIEWS[o.view] || VIEWS.iso;
  const azimuth = Number.isFinite(o.azimuth) ? o.azimuth : preset[0];
  const elevation = Number.isFinite(o.elevation) ? o.elevation : preset[1];
  const { toEye, right, up } = viewBasis(azimuth, elevation);
  const only = Array.isArray(o.shapes) && o.shapes.length ? new Set(o.shapes) : null;
  const hi = new Set(Array.isArray(o.highlight) ? o.highlight : []);
  const keep = (si) => !only || only.has(si);
  const faces = (mesh.faces || []).filter((f) => keep(f.shape_index));
  const edges = (mesh.edges || []).filter((e) => keep(e.shape_index));
  const clip = o.clip && [0, 1, 2].includes(o.clip.axis) && Number.isFinite(o.clip.at) ? o.clip : null;
  const clipSign = clip && clip.keep === 'above' ? -1 : 1;   // keep v*sign <= at*sign
  const cut = (wv) => clip !== null && (wv - clip.at) * clipSign > 0;

  // ---- fit the scene ----
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const extend = (v) => {
    for (let i = 0; i < v.length; i += 3) {
      const px = v[i] * right[0] + v[i + 1] * right[1] + v[i + 2] * right[2];
      const py = v[i] * up[0] + v[i + 1] * up[1] + v[i + 2] * up[2];
      const pz = v[i] * toEye[0] + v[i + 1] * toEye[1] + v[i + 2] * toEye[2];
      if (px < x0) { x0 = px; } if (px > x1) { x1 = px; }
      if (py < y0) { y0 = py; } if (py > y1) { y1 = py; }
      if (pz < z0) { z0 = pz; } if (pz > z1) { z1 = pz; }
    }
  };
  for (const f of faces) { extend(f.vertex_coord); }
  for (const e of edges) { extend(e.vertex_coord); }
  const bg = o.background || [255, 255, 255];
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { rgb[i * 3] = bg[0]; rgb[i * 3 + 1] = bg[1]; rgb[i * 3 + 2] = bg[2]; }
  const labels = (o.labels || []).filter(Boolean);
  const fpx = 2 * ss;                               // one font pixel
  const labelH = labels.length ? labels.length * 9 * fpx + 6 * ss : 0;
  const margin = 24 * ss;
  const empty = !(x1 >= x0);
  const sxr = Math.max(x1 - x0, 1e-9); const syr = Math.max(y1 - y0, 1e-9);
  const scale = empty ? 1 : Math.min((w - 2 * margin) / sxr, (h - 2 * margin - labelH) / syr);
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const ox = w / 2; const oy = (h - labelH) / 2;
  const zr = Math.max(z1 - z0, 1e-9);
  const zbuf = new Float32Array(w * h).fill(-Infinity);

  // ---- triangles (Gouraud: two lights evaluated per vertex) ----
  const key = norm([toEye[0] + 0.5 * up[0] - 0.4 * right[0], toEye[1] + 0.5 * up[1] - 0.4 * right[1],
    toEye[2] + 0.5 * up[2] - 0.4 * right[2]]);
  let sx = new Float32Array(0), sy = sx, sz = sx, sr = sx, sg = sx, sb = sx, sw = sx, sf = sx;
  for (const f of faces) {
    const v = f.vertex_coord; const n = f.normal_coord; const t = f.tri_indexes;
    const nv = v.length / 3;
    if (sx.length < nv) {
      sx = new Float32Array(nv * 2); sy = new Float32Array(nv * 2); sz = new Float32Array(nv * 2);
      sr = new Float32Array(nv * 2); sg = new Float32Array(nv * 2); sb = new Float32Array(nv * 2);
      sw = new Float32Array(nv * 2); sf = new Float32Array(nv * 2);
    }
    const base = hi.has(f.shape_index) ? HIGHLIGHT : (o.colors && o.colors[f.shape_index])
      || PALETTE[((f.shape_index | 0) % PALETTE.length + PALETTE.length) % PALETTE.length];
    for (let i = 0; i < nv; i++) {
      const px = v[i * 3], py = v[i * 3 + 1], pz = v[i * 3 + 2];
      sx[i] = ((px * right[0] + py * right[1] + pz * right[2]) - cx) * scale + ox;
      sy[i] = oy - ((px * up[0] + py * up[1] + pz * up[2]) - cy) * scale;
      sz[i] = px * toEye[0] + py * toEye[1] + pz * toEye[2];
      let nx = n.length ? n[i * 3] : 0, ny = n.length ? n[i * 3 + 1] : 0, nz = n.length ? n[i * 3 + 2] : 1;
      let nd = nx * toEye[0] + ny * toEye[1] + nz * toEye[2];
      sf[i] = nd;                                               // raw facing (caps)
      if (clip) { sw[i] = v[i * 3 + clip.axis]; }
      if (nd < 0) { nx = -nx; ny = -ny; nz = -nz; nd = -nd; }   // two-sided
      const nk = Math.max(0, nx * key[0] + ny * key[1] + nz * key[2]);
      const spec = 0.08 * Math.pow(nd, 40);
      const lit = 0.25 + 0.42 * nd + 0.28 * nk;
      sr[i] = Math.min(1, base[0] * lit + spec); sg[i] = Math.min(1, base[1] * lit + spec);
      sb[i] = Math.min(1, base[2] * lit + spec);
    }
    for (let k = 0; k < t.length; k += 3) {
      const a = t[k], b = t[k + 1], c = t[k + 2];
      const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], qx = sx[c], qy = sy[c];
      const area = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      if (Math.abs(area) < 1e-9) { continue; }
      const inv = 1 / area;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, qx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, qx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, qy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, qy)));
      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const w0 = ((bx - px) * (qy - py) - (by - py) * (qx - px)) * inv;
          const w1 = ((qx - px) * (ay - py) - (qy - py) * (ax - px)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) { continue; }
          const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c];
          const idx = y * w + x;
          if (z <= zbuf[idx]) { continue; }
          if (clip && cut(w0 * sw[a] + w1 * sw[b] + w2 * sw[c])) { continue; }
          zbuf[idx] = z;
          if (clip && w0 * sf[a] + w1 * sf[b] + w2 * sf[c] < 0) {
            // a back face seen through the cut: the solid's inside -> cap
            rgb[idx * 3] = 255 * CAP[0]; rgb[idx * 3 + 1] = 255 * CAP[1]; rgb[idx * 3 + 2] = 255 * CAP[2];
            continue;
          }
          rgb[idx * 3] = 255 * (w0 * sr[a] + w1 * sr[b] + w2 * sr[c]);
          rgb[idx * 3 + 1] = 255 * (w0 * sg[a] + w1 * sg[b] + w2 * sg[c]);
          rgb[idx * 3 + 2] = 255 * (w0 * sb[a] + w1 * sb[b] + w2 * sb[c]);
        }
      }
    }
  }

  // ---- silhouettes: depth discontinuities ----
  const jump = zr * 0.02;
  const ink = [38, 42, 48];
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const z = zbuf[i]; const zx = zbuf[i + 1]; const zy = zbuf[i + w];
      const fz = z !== -Infinity;
      let edge = false;
      if (fz !== (zx !== -Infinity) || fz !== (zy !== -Infinity)) { edge = true; }
      else if (fz && (Math.abs(z - zx) > jump || Math.abs(z - zy) > jump)) { edge = true; }
      if (edge) {
        // ink the nearer side so the line sits on the model
        const j = !fz ? (zx !== -Infinity ? i + 1 : i + w) : (zx > z ? i + 1 : (zy > z ? i + w : i));
        rgb[j * 3] = ink[0]; rgb[j * 3 + 1] = ink[1]; rgb[j * 3 + 2] = ink[2];
      }
    }
  }

  // ---- edges, depth-tested ----
  const r = 0.7 * ss;
  const plot = (x, y, z, col) => {
    const xa = Math.max(0, Math.floor(x - r)), xb = Math.min(w - 1, Math.ceil(x + r));
    const ya = Math.max(0, Math.floor(y - r)), yb = Math.min(h - 1, Math.ceil(y + r));
    for (let yy = ya; yy <= yb; yy++) {
      for (let xx = xa; xx <= xb; xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y;
        if (dx * dx + dy * dy > r * r + 0.25) { continue; }
        const i = yy * w + xx;
        if (z !== null && z < zbuf[i] - zr * 0.004) { continue; }
        rgb[i * 3] = col[0]; rgb[i * 3 + 1] = col[1]; rgb[i * 3 + 2] = col[2];
      }
    }
  };
  const line = (xa, ya, za, xb, yb, zb, col) => {
    const len = Math.hypot(xb - xa, yb - ya);
    const steps = Math.max(1, Math.ceil(len / (0.5 * ss)));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      plot(xa + (xb - xa) * u, ya + (yb - ya) * u, za === null ? null : za + (zb - za) * u, col);
    }
  };
  if (o.edges !== false) {
    for (const e of edges) {
      const v = e.vertex_coord;
      const ec = hi.has(e.shape_index) ? [150, 70, 10] : ink;
      for (let i = 0; i + 5 < v.length; i += 3) {
        const p = (j) => [((v[j] * right[0] + v[j + 1] * right[1] + v[j + 2] * right[2]) - cx) * scale + ox,
          oy - ((v[j] * up[0] + v[j + 1] * up[1] + v[j + 2] * up[2]) - cy) * scale,
          v[j] * toEye[0] + v[j + 1] * toEye[1] + v[j + 2] * toEye[2]];
        if (clip && (cut(v[i + clip.axis]) || cut(v[i + 3 + clip.axis]))) { continue; }
        const A = p(i); const B = p(i + 3);
        line(A[0], A[1], A[2], B[0], B[1], B[2], ec);
      }
    }
  }

  // ---- axis triad and labels ----
  const text = (str, x, y, col, halo) => drawText(rgb, w, h, str, x, y, col, fpx, halo);
  if (o.objectLabels) {
    // each object's name at the centre of its projected vertices
    const acc = new Map();
    for (const f of faces) {
      const v = f.vertex_coord;
      const a = acc.get(f.shape_index) || [0, 0, 0];
      for (let i = 0; i < v.length; i += 3) {
        a[0] += ((v[i] * right[0] + v[i + 1] * right[1] + v[i + 2] * right[2]) - cx) * scale + ox;
        a[1] += oy - ((v[i] * up[0] + v[i + 1] * up[1] + v[i + 2] * up[2]) - cy) * scale;
        a[2]++;
      }
      acc.set(f.shape_index, a);
    }
    for (const [si, a] of acc) {
      const name = o.objectLabels[si];
      if (!name || !a[2]) { continue; }
      const str = String(name).slice(0, 24);
      text(str, Math.round(a[0] / a[2] - str.length * 3 * fpx), Math.round(a[1] / a[2] - 3.5 * fpx), [20, 24, 28], bg);
    }
  }
  const tx = 34 * ss; const ty = h - labelH - 34 * ss;
  const axes = [[[1, 0, 0], [205, 45, 45], 'X'], [[0, 1, 0], [40, 150, 60], 'Y'], [[0, 0, 1], [45, 85, 215], 'Z']];
  for (const [a, col, name] of axes) {
    const L = 24 * ss;
    const ex = tx + dot(a, right) * L; const ey = ty - dot(a, up) * L;
    line(tx, ty, null, ex, ey, null, col);
    if (Math.hypot(ex - tx, ey - ty) > 4 * ss) {
      text(name, Math.round(ex + (ex - tx) * 0.25 - 2.5 * fpx), Math.round(ey + (ey - ty) * 0.25 - 3.5 * fpx), col);
    }
  }
  labels.forEach((s, k) => text(s, 70 * ss, h - labelH + k * 9 * fpx, [70, 74, 80]));

  // ---- box filter down to the output size ----
  let out = rgb;
  if (ss > 1) {
    out = new Uint8Array(W * H * 3);
    const n = ss * ss;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let R = 0, G = 0, B = 0;
        for (let yy = 0; yy < ss; yy++) {
          let i = ((y * ss + yy) * w + x * ss) * 3;
          for (let xx = 0; xx < ss; xx++, i += 3) { R += rgb[i]; G += rgb[i + 1]; B += rgb[i + 2]; }
        }
        const j = (y * W + x) * 3;
        out[j] = R / n; out[j + 1] = G / n; out[j + 2] = B / n;
      }
    }
  }
  return { width: W, height: H, rgb: out, scale: scale / ss, view: { azimuth, elevation }, empty };
}

/** A 2-D line drawing (the exact hidden-line projection's polylines, in
 *  view-plane mm): visible lines solid, hidden ones dashed grey, fitted to
 *  the canvas, with the same label strip as renderMeshImage. Returns
 *  {width, height, rgb, scale}. */
export function renderLineImage(lines, o = {}) {
  const W = Math.max(64, Math.min(2048, Math.round(o.width || 800)));
  const H = Math.max(64, Math.min(2048, Math.round(o.height || 600)));
  const ss = Math.max(1, Math.min(3, Math.round(o.supersample || 2)));
  const w = W * ss; const h = H * ss;
  const rgb = new Uint8Array(w * h * 3).fill(255);
  const visible = lines.visible || []; const hidden = lines.hidden || [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const l of visible.concat(hidden)) {
    for (const [x, y] of l) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const labels = (o.labels || []).filter(Boolean);
  const fpx = 2 * ss;
  const labelH = labels.length ? labels.length * 9 * fpx + 6 * ss : 0;
  const margin = 24 * ss;
  const empty = !(x1 >= x0);
  const scale = empty ? 1 : Math.min((w - 2 * margin) / Math.max(x1 - x0, 1e-9), (h - 2 * margin - labelH) / Math.max(y1 - y0, 1e-9));
  const X = (x) => (x - (x0 + x1) / 2) * scale + w / 2;
  const Y = (y) => (h - labelH) / 2 - (y - (y0 + y1) / 2) * scale;
  const plot = (x, y, r, col) => {
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) { continue; }
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y;
        if (dx * dx + dy * dy > r * r + 0.25) { continue; }
        const i = yy * w + xx;
        rgb[i * 3] = col[0]; rgb[i * 3 + 1] = col[1]; rgb[i * 3 + 2] = col[2];
      }
    }
  };
  const draw = (l, r, col, dash) => {
    let run = 0;
    for (let i = 0; i + 1 < l.length; i++) {
      const ax = X(l[i][0]), ay = Y(l[i][1]), bx = X(l[i + 1][0]), by = Y(l[i + 1][1]);
      const len = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(len / (0.5 * ss)));
      for (let s2 = 0; s2 <= steps; s2++) {
        const u = s2 / steps;
        const d = run + len * u;
        if (dash && (d % (dash[0] + dash[1])) > dash[0]) { continue; }
        plot(ax + (bx - ax) * u, ay + (by - ay) * u, r, col);
      }
      run += len;
    }
  };
  for (const l of hidden) { draw(l, 0.5 * ss, [150, 156, 162], [6 * ss, 4 * ss]); }
  for (const l of visible) { draw(l, 0.8 * ss, [29, 33, 37], null); }
  labels.forEach((s2, k) => drawText(rgb, w, h, s2, 70 * ss, h - labelH + k * 9 * fpx, [70, 74, 80], fpx));
  let out = rgb;
  if (ss > 1) {
    out = new Uint8Array(W * H * 3);
    const n = ss * ss;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let R = 0, G = 0, B = 0;
        for (let yy = 0; yy < ss; yy++) {
          let i = ((y * ss + yy) * w + x * ss) * 3;
          for (let xx = 0; xx < ss; xx++, i += 3) { R += rgb[i]; G += rgb[i + 1]; B += rgb[i + 2]; }
        }
        const j = (y * W + x) * 3;
        out[j] = R / n; out[j + 1] = G / n; out[j + 2] = B / n;
      }
    }
  }
  return { width: W, height: H, rgb: out, scale: scale / ss, empty };
}
