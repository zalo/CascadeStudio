// Kernel probe (OCCT 8.0.1 wasm side) -- mirror of probe_native.py
import path from 'node:path';
import fs from 'node:fs';

const repo = '/home/agent-untrusted/Desktop/CascadeStudio';
const mod = await import(path.join(repo, 'node_modules/opencascade.js/dist/cascadestudio.js'));
const factory = mod.default ?? mod;
const oc = await factory({ locateFile: (f) => path.join(repo, 'node_modules/opencascade.js/dist/', f) });

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const P = (x, y, z) => new oc.gp_Pnt_3(x, y, z);
const D = (x, y, z) => new oc.gp_Dir_5(x, y, z);
const perp = (z, x) => (x ? x : Math.abs(z[0]) > 0.99 ? [0, 1, 0] : [1, 0, 0]);
const ax2 = (c, z, x) => new oc.gp_Ax2_2(P(...c), D(...z), D(...perp(z, x)));

function sphere(r, xdir = [1, 0, 0], zdir = [0, 0, 1], center = [0, 0, 0]) {
  return new oc.BRepPrimAPI_MakeSphere_9(ax2(center, zdir, xdir), r).Shape();
}
function cylinder(r, h, center = [0, 0, 0], zdir = [0, 0, 1], xdir = null) {
  return new oc.BRepPrimAPI_MakeCylinder_3(ax2(center, zdir, xdir), r, h).Shape();
}
function torus(R, r) {
  return new oc.BRepPrimAPI_MakeTorus_5(ax2([0, 0, 0], [0, 0, 1], [1, 0, 0]), R, r).Shape();
}
function box(p1, p2) {
  return new oc.BRepPrimAPI_MakeBox_4(P(...p1), P(...p2)).Shape();
}
function planeFace(origin, normal, xdir, half = 60) {
  const pln = new oc.gp_Pln_2(new oc.gp_Ax3_3(P(...origin), D(...normal), D(...xdir)));
  return new oc.BRepBuilderAPI_MakeFace_9(pln, -half, half, -half, half).Face();
}
function bsplineWavy() {
  const n = 9;
  const arr = new oc.TColgp_Array2OfPnt_2(1, n, 1, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -40 + (80 * i) / (n - 1);
      const y = -40 + (80 * j) / (n - 1);
      const z = 3 * Math.sin(x / 12) + 2 * Math.cos(y / 15);
      arr.SetValue(i + 1, j + 1, P(x, y, z));
    }
  }
  const bs = new oc.GeomAPI_PointsToBSplineSurface_2(arr, 3, 8, oc.GeomAbs_Shape.GeomAbs_C2, 1.0e-3).Surface();
  const surf = new oc.Handle_Geom_Surface_2(bs.get());
  return new oc.BRepBuilderAPI_MakeFace_8(surf, 1e-6).Face();
}

const ORI = ['FORWARD', 'REVERSED', 'INTERNAL', 'EXTERNAL'];
const CTNAME = {};
for (const k of ['GeomAbs_Line', 'GeomAbs_Circle', 'GeomAbs_Ellipse', 'GeomAbs_Hyperbola',
  'GeomAbs_Parabola', 'GeomAbs_BezierCurve', 'GeomAbs_BSplineCurve', 'GeomAbs_OffsetCurve',
  'GeomAbs_OtherCurve']) {
  CTNAME[oc.GeomAbs_CurveType[k].value] = k.replace('GeomAbs_', '');
}

function seamU(probe, p) {
  const c = probe.center, x = probe.xdir, z = probe.zdir;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const du = d[0] * x[0] + d[1] * x[1] + d[2] * x[2];
  const dv = d[0] * y[0] + d[1] * y[1] + d[2] * y[2];
  return r6((Math.atan2(dv, du) * 180) / Math.PI);
}

function p3(pnt) { return [r6(pnt.X()), r6(pnt.Y()), r6(pnt.Z())]; }

function dumpEdge(e) {
  const bac = new oc.BRepAdaptor_Curve_2(e);
  const t = CTNAME[bac.GetType().value] ?? String(bac.GetType().value);
  const f = bac.FirstParameter(), l = bac.LastParameter();
  const out = {
    ori: ORI[e.Orientation_1().value],
    type: t,
    range: [r6(f), r6(l)],
    closed: !!oc.BRep_Tool.IsClosed_1(e),
  };
  if (t === 'BSpline' || t === 'Bezier') {
    try { out.degree = bac.Degree(); out.npoles = bac.NbPoles(); } catch (_) { /* ignore */ }
  }
  try { out.length = r6(oc.GCPnts_AbscissaPoint.Length_1(bac)); } catch (_) { out.length = null; }
  const a = bac.Value(f), b = bac.Value(l);
  out.p_first = p3(a);
  out.p_last = p3(b);
  out.p_mid = p3(bac.Value(0.5 * (f + l)));
  const samples = 400;
  out.poly = [];
  for (let i = 0; i <= samples; i++) out.poly.push(p3(bac.Value(f + ((l - f) * i) / samples)));
  out.geom_closed = a.Distance(b) < 1e-7;
  const pp = P(0, 0, 0), vv = new oc.gp_Vec_4(0, 0, 0);
  bac.D1(f, pp, vv);
  const n = vv.Magnitude();
  if (n > 0) out.tan_first = [r6(vv.X() / n), r6(vv.Y() / n), r6(vv.Z() / n)];
  if (out.ori === 'REVERSED') {
    out.walk_start = out.p_last;
    out.walk_dir = (out.tan_first || [0, 0, 0]).map((c) => -c);
  } else {
    out.walk_start = out.p_first;
    out.walk_dir = out.tan_first;
  }
  return out;
}

function edgesOf(shape) {
  const out = [];
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) out.push(oc.TopoDS_Cast.Edge_1(exp.Current()));
  return out;
}

const sphProbe = (xd = [1, 0, 0], c = [0, 0, 0]) => ({ name: 'sphere', center: c, zdir: [0, 0, 1], xdir: xd });
const cylProbe = (c, zd = [0, 0, 1], xd = [1, 0, 0]) => ({ name: 'cyl', center: c, zdir: zd, xdir: xd });

const cases = [
  ['sph_cyl_xp6', () => sphere(10), () => cylinder(5, 40, [6, 0, -20]), [sphProbe(), cylProbe([6, 0, -20])]],
  ['sph_cyl_xm6', () => sphere(10), () => cylinder(5, 40, [-6, 0, -20]), [sphProbe(), cylProbe([-6, 0, -20])]],
  ['sph_cyl_yp6', () => sphere(10), () => cylinder(5, 40, [0, 6, -20]), [sphProbe(), cylProbe([0, 6, -20])]],
  ['sph_cyl_xp6_seam90', () => sphere(10, [0, 1, 0]), () => cylinder(5, 40, [6, 0, -20]), [sphProbe([0, 1, 0]), cylProbe([6, 0, -20])]],
  ['sph_cyl_xp6_seam180', () => sphere(10, [-1, 0, 0]), () => cylinder(5, 40, [6, 0, -20]), [sphProbe([-1, 0, 0]), cylProbe([6, 0, -20])]],
  ['sph_cyl_xp6_cylseam90', () => sphere(10), () => cylinder(5, 40, [6, 0, -20], [0, 0, 1], [0, 1, 0]), [sphProbe(), cylProbe([6, 0, -20], [0, 0, 1], [0, 1, 0])]],
  ['sph_sph', () => sphere(10), () => sphere(8, [1, 0, 0], [0, 0, 1], [5, 0, 0]), [sphProbe(), sphProbe([1, 0, 0], [5, 0, 0])]],
  ['cyl_cyl', () => cylinder(5, 60, [0, 0, -30]), () => cylinder(7, 60, [-30, 0, 0], [1, 0, 0]), [cylProbe([0, 0, -30]), cylProbe([-30, 0, 0], [1, 0, 0], [0, 1, 0])]],
  ['plane_cyl', () => cylinder(10, 60, [0, 0, -30]), () => planeFace([0, 0, 0], [0, 0.5, 1], [1, 0, 0]), [cylProbe([0, 0, -30])]],
  ['torus_plane', () => torus(20, 6), () => planeFace([0, 0, 2], [0, 0, 1], [1, 0, 0]), [{ name: 'torus', center: [0, 0, 0], zdir: [0, 0, 1], xdir: [1, 0, 0] }]],
  ['bspl_sph', () => bsplineWavy(), () => sphere(30), [sphProbe()]],
  ['b123d_arch', () => sphere(50), () => cylinder(80, 100, [-50, 0, -70], [1, 0, 0]), [sphProbe(), cylProbe([-50, 0, -70], [1, 0, 0], [0, 1, 0])]],
  ['box_cyl_cut', () => box([-5, -5, 0], [5, 5, 10]), () => cylinder(2.5, 20, [-10, 0, 0], [1, 0, 0]), []],
];

const out = { kernel: 'OCCT 8.0.1 wasm', cases: {} };
for (const [name, mk1, mk2, probes] of cases) {
  const rec = { section: null, cut: null };
  for (const mode of ['section', 'cut']) {
    try {
      const s1 = mk1(), s2 = mk2();
      let shape;
      if (mode === 'section') {
        const op = new oc.BRepAlgoAPI_Section_3(s1, s2, true);
        op.Build(new oc.Message_ProgressRange_1());
        shape = op.Shape();
      } else {
        const op = new oc.BRepAlgoAPI_Cut_3(s1, s2, new oc.Message_ProgressRange_1());
        op.Build(new oc.Message_ProgressRange_1());
        shape = op.Shape();
      }
      const es = edgesOf(shape).map((e) => {
        const d = dumpEdge(e);
        d.seam_u_first = {};
        d.seam_u_last = {};
        probes.forEach((p, i) => {
          d.seam_u_first[p.name + i] = seamU(p, d.p_first);
          d.seam_u_last[p.name + i] = seamU(p, d.p_last);
        });
        return d;
      });
      rec[mode] = es;
    } catch (err) {
      rec[mode] = { error: String(err && err.message ? err.message : err) };
    }
  }
  out.cases[name] = rec;
  process.stderr.write(`done ${name}\n`);
}
fs.writeFileSync('/tmp/kx/wasm.json', JSON.stringify(out));
console.log('OK');
