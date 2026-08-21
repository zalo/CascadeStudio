// gen-ocp-shim.mjs — generate the OCP adapter (Python proxies + JS dispatch
// table) from the Phase-1 bill, the fork's cascadestudio.d.ts and the pybind
// signature dump. Regenerability IS the point: rerun after a d.ts change or
// a build123d bump re-bill.
//
//   node experiments/upstream-topology-spike/gen-ocp-shim.mjs
//
// Outputs (packages/cascade-core/upstream-py/ocp_shim/):
//   table.json        — JS dispatcher table (ctor/method variants + pybind
//                       defaults + tuple-return glue markers)
//   _registry.py      — every generated proxy class (inheritance mirrored
//                       from the d.ts), statics, enum members
//   OCP/<Module>.py   — per-OCP-module re-export files (written over the
//                       loader's inert _Any stubs when pytopo=upstream)
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'packages', 'cascade-core', 'upstream-py', 'ocp_shim');
const DTS = join(ROOT, 'node_modules', 'opencascade.js', 'dist', 'cascadestudio.d.ts');

const bill = JSON.parse(fs.readFileSync(join(HERE, 'ocp-method-bill.json'), 'utf8'));
const defaults = JSON.parse(fs.readFileSync(join(HERE, 'ocp-defaults.json'), 'utf8'));
const importMap = JSON.parse(fs.readFileSync(
  join(ROOT, 'packages', 'cascade-core', 'upstream-py', 'ocp_import_map.json'), 'utf8'));

// --------------------------------------------------------------------- //
// 1. Parse the d.ts (classes incl. param types, ctor overload subclasses, //
//    enums) + merge the hand-registered additionalBindCode surface.       //
// --------------------------------------------------------------------- //
function parseDts(text) {
  const classes = {};   // name -> {parent, methods:{js:[{static,params[]}]}, ctors:[{js,params[]}]}
  const enums = {};     // name -> [members]
  let cur = null, curEnum = null, pendingCtor = null;
  const ctorRe = /^\s*export declare class (\w+?)_(\d+) extends (\w+) \{/;
  const classRe = /^\s*export declare class (\w+)(?: extends (\w+))?\s*\{/;
  const methRe = /^\s*(static )?(\w+)\((.*)\): (.+);/;
  const enumRe = /^export declare type (\w+) = \{/;
  const memberRe = /^\s*(\w+): \{\};?/;
  const splitParams = (s) => {
    if (!s.trim()) { return []; }
    const out = []; let depth = 0, curp = '';
    for (const ch of s) {
      if ('([{<'.includes(ch)) { depth++; }
      if (')]}>'.includes(ch)) { depth--; }
      if (ch === ',' && depth === 0) { out.push(curp.trim()); curp = ''; }
      else { curp += ch; }
    }
    if (curp.trim()) { out.push(curp.trim()); }
    return out.map((p) => (p.split(':')[1] || '').trim());
  };
  for (const line of text.split('\n')) {
    let m = ctorRe.exec(line);
    if (m && m[1] === m[3]) {
      classes[m[1]] = classes[m[1]] || { methods: {}, ctors: [] };
      pendingCtor = { base: m[1], js: `${m[1]}_${m[2]}` };
      cur = null;
      continue;
    }
    m = classRe.exec(line);
    if (m) {
      cur = m[1];
      classes[cur] = classes[cur] || { methods: {}, ctors: [] };
      if (m[2]) { classes[cur].parent = m[2]; }
      pendingCtor = null;
      continue;
    }
    const cm = /^\s*constructor\((.*)\);?\s*$/.exec(line);
    if (cm && (pendingCtor || cur)) {
      const params = splitParams(cm[1]);
      if (pendingCtor) {
        classes[pendingCtor.base].ctors.push({ js: pendingCtor.js, params });
        pendingCtor = null;
      } else {
        classes[cur].ctors.push({ js: cur, params });
      }
      continue;
    }
    m = enumRe.exec(line);
    if (m) { curEnum = m[1]; enums[curEnum] = []; cur = null; continue; }
    if (curEnum) {
      const mm = memberRe.exec(line);
      if (mm) { enums[curEnum].push(mm[1]); }
      else if (line.trim() === '}') { curEnum = null; }
      continue;
    }
    if (cur) {
      const mm = methRe.exec(line);
      if (mm) {
        const [, st, name, params] = mm;
        (classes[cur].methods[name] = classes[cur].methods[name] || []).push({
          static: !!st, params: splitParams(params),
        });
      } else if (line.trim() === '}') { cur = null; }
    }
  }
  return { classes, enums };
}

const { classes: dts, enums: dtsEnums } = parseDts(fs.readFileSync(DTS, 'utf8'));

// hand-registered surface (additionalBindCode) — mirrors extract_ocp_bill.py
const ARR1 = ['Size', 'Length', 'IsEmpty', 'Lower', 'Upper', 'IsDeletable', 'Resize', 'SetValue', 'Value'];
const EXTRA = {
  TopoDS_Cast: { statics: ['Vertex_1', 'Vertex_2', 'Edge_1', 'Edge_2', 'Wire_1', 'Wire_2', 'Face_1', 'Face_2', 'Shell_1', 'Shell_2', 'Solid_1', 'Solid_2', 'Compound_1', 'Compound_2'] },
  OCJS: { statics: ['getStandard_FailureData', 'HashCode', 'BooleanCut', 'BooleanFuse', 'BooleanCommon'] },
  OCJS_Out: { statics: ['Circ2d2TanRad_Tangency1', 'Circ2d2TanRad_Tangency2', 'Circ2d2TanOn_Tangency1', 'Circ2d2TanOn_Tangency2', 'Circ2d3Tan_Tangency1', 'Circ2d3Tan_Tangency2', 'Circ2d3Tan_Tangency3', 'Circ2dTanCen_Tangency1', 'Circ2dTanOnRad_Tangency1', 'Lin2dTanObl_Tangency1', 'FilletAlgo_Result', 'ProjectPointOnSurf_LowerDistanceParameters', 'ProjectPointOnSurf_Parameters'] },
  TopTools_ListOfShape: { methods: ['Append', 'Size', 'Clear', 'First'], ctors: [[]] },
  TopTools_IndexedDataMapOfShapeListOfShape: { methods: ['Extent', 'Contains', 'FindKey', 'FindFromIndex', 'FindFromKey', 'FindIndex', 'Clear'], ctors: [[]] },
  TColgp_Array1OfPnt: { methods: ARR1, ctors: [[], ['int', 'int']] },
  TColgp_Array1OfDir: { methods: ARR1, ctors: [[], ['int', 'int']] },
  TColgp_Array1OfPnt2d: { methods: ARR1, ctors: [[], ['int', 'int']] },
  TColgp_Array1OfVec: { methods: ARR1, ctors: [[], ['int', 'int']] },
  TColStd_Array1OfReal: { methods: ARR1, ctors: [[], ['int', 'int']] },
  TColStd_Array1OfInteger: { methods: ARR1, ctors: [[], ['int', 'int']] },
  TColgp_HArray1OfPnt: { methods: ['SetValue', 'Value', 'Lower', 'Upper'], ctors: [['int', 'int']] },
  TColStd_HArray1OfBoolean: { methods: ['SetValue', 'Value'], ctors: [['int', 'int']] },
  TColgp_Array2OfPnt: { methods: ['SetValue', 'Value', 'NbRows', 'NbColumns'], ctors: [['int', 'int', 'int', 'int']] },
  math_Matrix: { methods: ['Value', 'SetValue', 'LowerRow', 'UpperRow', 'LowerCol', 'UpperCol'], ctors: [['int', 'int', 'int', 'int']] },
  BRepAlgoAPI_Algo: { parent: 'BRepBuilderAPI_MakeShape', methods: ['Shape', 'Clear', 'ClearWarnings', 'SetFuzzyValue', 'FuzzyValue', 'HasErrors', 'HasWarnings', 'SetRunParallel', 'RunParallel', 'SetUseOBB'] },
  BRepAlgoAPI_BuilderAlgo: { parent: 'BRepAlgoAPI_Algo', methods: ['SetArguments', 'SetNonDestructive', 'NonDestructive'] },
  BRepMesh_IncrementalMesh: { parent: 'BRepMesh_DiscretRoot', ctors: [['TopoDS_Shape', 'double', 'bool', 'double', 'bool']] },
};
for (const [name, d] of Object.entries(EXTRA)) {
  const c = dts[name] = dts[name] || { methods: {}, ctors: [] };
  if (d.parent && !c.parent) { c.parent = d.parent; }
  for (const m of d.methods || []) {
    (c.methods[m] = c.methods[m] || []).push({ static: false, params: null });
  }
  for (const m of d.statics || []) {
    (c.methods[m] = c.methods[m] || []).push({ static: true, params: null });
  }
  for (const [i, params] of (d.ctors || []).entries()) {
    c.ctors.push({ js: d.ctors.length > 1 ? `${name}_${i + 1}` : `${name}_2`, params });
  }
}
// hand-bound Handle types (HANDLE_BINDINGS macro)
for (const h of ['Handle_Geom_Curve', 'Handle_Geom_BezierCurve', 'Handle_Geom_BSplineCurve',
  'Handle_Geom_TrimmedCurve', 'Handle_Geom_Circle', 'Handle_Geom_Surface',
  'Handle_Poly_Triangulation', 'Handle_Poly_PolygonOnTriangulation', 'Handle_TColgp_HArray1OfPnt']) {
  const c = dts[h] = dts[h] || { methods: {}, ctors: [] };
  for (const m of ['IsNull', 'Nullify', 'get']) {
    (c.methods[m] = c.methods[m] || []).push({ static: false, params: null });
  }
  c.ctors.push({ js: h + '_2', params: ['ptr'] });
}

// --------------------------------------------------------------------- //
// 2. Compute the class closure: billed classes + ancestors + descendants //
// --------------------------------------------------------------------- //
const billed = Object.keys(bill.per_class)
  .filter((c) => c !== '?' && !c.startsWith('[module'));
const inDts = new Set(billed.filter((c) => dts[c]));
const closure = new Set(inDts);
// ancestors
for (const c of [...closure]) {
  let p = dts[c] && dts[c].parent;
  while (p && dts[p] && !closure.has(p)) { closure.add(p); p = dts[p].parent; }
}
// descendants of billed (for most-derived _wrap lookups, e.g. Geom_Plane
// returned where the bill only names Geom_Surface)
let grew = true;
while (grew) {
  grew = false;
  for (const [name, c] of Object.entries(dts)) {
    if (!closure.has(name) && c.parent && closure.has(c.parent)) {
      closure.add(name); grew = true;
    }
  }
}
// keep it sane: drop ctor-overload subclasses (they're not real classes)
for (const name of [...closure]) {
  if (/_\d+$/.test(name) && dts[name.replace(/_\d+$/, '')]) { closure.delete(name); }
}
// The d.ts sometimes writes typedef'd NCollection names for hand-bound
// TCol/TopTools instantiations; map them onto the registered classes.
const TYPEDEF = {
  'NCollection_Array1<double>': 'TColStd_Array1OfReal',
  'NCollection_Array1<int>': 'TColStd_Array1OfInteger',
  'NCollection_Array1<gp_Pnt>': 'TColgp_Array1OfPnt',
  'NCollection_Array1<gp_Pnt2d>': 'TColgp_Array1OfPnt2d',
  'NCollection_Array1<gp_Vec>': 'TColgp_Array1OfVec',
  'NCollection_Array1<gp_Dir>': 'TColgp_Array1OfDir',
  'NCollection_Array2<gp_Pnt>': 'TColgp_Array2OfPnt',
  'NCollection_Array2<double>': 'TColStd_Array2OfReal',
  'NCollection_List<TopoDS_Shape>': 'TopTools_ListOfShape',
};
// classes referenced as PARAM types by closure methods/ctors (+ ancestors):
// the runtime dispatcher must be able to normalize an argument's embind
// class name and chain-walk it onto the declared param class (the
// Message_ProgressRange fill was invisible to posScore without this)
{
  let grewP = true;
  while (grewP) {
    grewP = false;
    for (const name of [...closure]) {
      const c = dts[name];
      const paramLists = [
        ...c.ctors.map((x) => x.params || []),
        ...Object.values(c.methods).flat().map((v) => v.params || []),
      ];
      for (const ps of paramLists) {
        for (let t of ps) {
          t = String(t).trim();
          if (TYPEDEF[t]) { t = TYPEDEF[t]; }
          if (!dts[t] || /_\d+$/.test(t) || closure.has(t)) { continue; }
          closure.add(t);
          grewP = true;
          let p = dts[t].parent;
          while (p && dts[p] && !closure.has(p)) { closure.add(p); p = dts[p].parent; }
        }
      }
    }
  }
}

// --------------------------------------------------------------------- //
// 3. Needed enums                                                        //
// --------------------------------------------------------------------- //
const importedNames = new Set(Object.values(importMap).flat());
// there are only ~25 enum types in the whole d.ts: generate them all (module
// imports like `import OCP.GeomAbs as ga` read members the import map never
// names)
const neededEnums = new Set(Object.keys(dtsEnums));
// enums referenced by generated method params (for defaults + args)
for (const cls of closure) {
  for (const variants of Object.values(dts[cls].methods)) {
    for (const v of variants) {
      for (const t of v.params || []) {
        const tn = t.replace(/<.*>/, '');
        if (dtsEnums[tn]) { neededEnums.add(tn); }
      }
    }
  }
}

// --------------------------------------------------------------------- //
// 4. Emit table.json (JS dispatcher data)                                //
// --------------------------------------------------------------------- //
// pybind param → table param. The dump now carries EXPLICIT default
// encodings (default_lit / default_enum / default_ctor0 — see
// dump_ocp_defaults.py); the raw repr string is not shipped.
const mapPyParam = (p) => ({
  name: p.name || null,
  type: p.type || null,
  dflt_lit: p.default_lit !== undefined ? p.default_lit : undefined,
  dflt_enum: p.default_enum || undefined,
  dflt_ctor0: p.default_ctor0 || undefined,
  has_dflt: p.default !== undefined ? true : undefined,
});

const table = { classes: {}, enums: {}, handleClasses: [] };

// ---- static overload pinning ----------------------------------------- //
// Coarse-type tags shared with the RUNTIME dispatcher (OcpShim.js argKind):
//   'b' bool, 'n' number, 's' string, 'e:<Enum>' registered enum,
//   'c:<Class>' registered class, '?' anything (embind val / unregistered).
const coarseOf = (t) => {
  if (t === null || t === undefined) { return '?'; }
  let ts = String(t).trim();
  if (TYPEDEF[ts]) { ts = TYPEDEF[ts]; }
  if (!ts || ts === 'any' || ts === 'GLvoid') { return '?'; }
  if (/^(Standard_Boolean|bool|boolean)$/.test(ts)) { return 'b'; }
  if (/^(Standard_(Real|Integer|ShortReal|Size|Byte|ExtCharacter|Utf32Char)|int|double|float|number)$/.test(ts)) { return 'n'; }
  if (/^(string|Standard_CString|Standard_Character|NCollection_String|XCAFDoc_PartId)$/.test(ts)) { return 's'; }
  if (dtsEnums[ts]) { return 'e:' + ts; }
  if (dts[ts] && !/_\d+$/.test(ts)) { return 'c:' + ts; }
  return '?'; // unregistered token (enum the wasm never bound, etc.)
};
const isAncestor = (anc, cls) => {
  let c = cls;
  const seen = new Set();
  while (c && !seen.has(c)) {
    if (c === anc) { return true; }
    seen.add(c);
    c = dts[c] && dts[c].parent;
  }
  return false;
};
// Can the RUNTIME argKind always separate these two coarse param tags?
const separable = (a, b) => {
  if (a === '?' || b === '?') { return false; }  // '?' weak-matches anything
  if (a === b) { return false; }
  const ac = a[0] === 'c', bc = b[0] === 'c';
  if (ac && bc) { return true; }  // distinct classes: exact/ancestor scoring
  // decides (related classes rank by specificity; a null arg still ties —
  // the runtime REFUSES in that case rather than guessing)
  return true;  // prim vs prim / enum vs enum / prim vs class all differ
};
const PRIMKEY = (sig) => sig.every((k) => k === 'b' || k === 'n' || k === 's'
  || k.startsWith('e:'));
/** Per-arity dispatch for one method's variants:
 *    {d: js, s: csig}                      exactly one variant at this arity
 *    {c: [{js, s}], k: {sigkey: js}, a: 1} multiple: typed match at runtime
 *      (k = exact prim/enum key pins; a=1 marks statically-inseparable pairs
 *       — the runtime matcher REFUSES on ties instead of guessing)
 *  Variants with unknown params (hand-registered surface) get NO dispatch
 *  entry: the runtime keeps the legacy try-in-order path for those. */
const buildDispatch = (variants) => {
  const byArity = {};
  let unknown = 0;
  for (const v of variants) {
    if (!v.params) { unknown++; continue; }
    const ar = v.params.length;
    (byArity[ar] = byArity[ar] || []).push(v);
  }
  const dispatch = {};
  const kinds = {};
  for (const [ar, rawVs] of Object.entries(byArity)) {
    // collapse const/non-const duplicate registrations: identical raw d.ts
    // param lists with NO 'any' are the same C++ overload bound twice —
    // keeping the first is pybind's single-overload call, not a guess.
    // ('any'-typed params are kept: distinct val-typed overloads can share
    // a raw sig and MUST stay separate → ambiguous → runtime refusal.)
    const seenRaw = new Set();
    const vs = [];
    for (const v of rawVs) {
      const raw = v.params.join('|');
      if (!v.csig.includes('?') && seenRaw.has(raw)) { continue; }
      seenRaw.add(raw);
      vs.push(v);
    }
    if (vs.length === 1 && !unknown) {
      dispatch[ar] = { d: vs[0].js, s: vs[0].csig };
      kinds[ar] = 'direct';
      continue;
    }
    const cands = vs.map((v) => ({ js: v.js, s: v.csig }));
    let amb = false;
    for (let i = 0; i < cands.length && !amb; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        const si = cands[i].s, sj = cands[j].s;
        if (!si.some((k, p) => separable(k, sj[p]))) { amb = true; break; }
      }
    }
    const entry = { c: cands };
    // exact-key pins when every candidate is prim/enum-only and keys are
    // unique: the runtime resolves these with ONE map lookup, no scoring
    if (cands.every((c) => PRIMKEY(c.s))) {
      const k = {};
      let dup = false;
      for (const c of cands) {
        const key = c.s.join(',');
        if (k[key]) { dup = true; break; }
        k[key] = c.js;
      }
      if (!dup) { entry.k = k; }
    }
    if (amb || unknown) { entry.a = 1; }
    dispatch[ar] = entry;
    kinds[ar] = (amb || unknown) ? 'ambiguous' : 'typed';
  }
  return { dispatch, kinds, unknown };
};
const report = { direct: 0, typed: 0, ambiguous: 0, unknownOnly: 0,
  pinnedPrimKeys: 0, runtimeDispatched: [], ambiguousKeys: [] };

for (const cls of [...closure].sort()) {
  const d = dts[cls];
  const pd = defaults[cls] || { ctor: [], methods: {} };
  const methods = {};
  // group js variants by BASE python name
  const byBase = {};
  for (const [js, variants] of Object.entries(d.methods)) {
    const base = js.replace(/_\d+$/, '');
    (byBase[base] = byBase[base] || []).push(
      ...variants.map((v) => ({ js, static: v.static, params: v.params,
        csig: v.params ? v.params.map(coarseOf) : null })));
  }
  const billEntry = bill.per_class[cls] || null;
  const tallyDispatch = (owner, kinds, cands, sigSites) => {
    for (const [ar, kind] of Object.entries(kinds)) {
      report[kind === 'direct' ? 'direct' : kind === 'typed' ? 'typed' : 'ambiguous']++;
      if (kind === 'direct') { continue; }
      const billed = Object.entries(sigSites || {})
        .filter(([k]) => k.split(':')[0] === ar)
        .reduce((n, [, c]) => n + c, 0);
      const rec = {
        key: owner + '/' + ar,
        kind,
        cands: (cands[ar] || []).map((c) => c.js + '(' + c.s.join(',') + ')'),
        billedSites: billed,
      };
      report.runtimeDispatched.push(rec);
      if (kind === 'ambiguous') { report.ambiguousKeys.push(rec); }
    }
  };
  for (const [base, variants] of Object.entries(byBase)) {
    // pybind defaults: look up both Name and Name_s
    const pysig = pd.methods[base] || pd.methods[base + '_s'] || null;
    const { dispatch, kinds } = buildDispatch(variants);
    if (!Object.keys(kinds).length) { report.unknownOnly++; }
    for (const e of Object.values(dispatch)) {
      if (e.k) { report.pinnedPrimKeys += Object.keys(e.k).length; }
    }
    const billedMeth = billEntry
      && (billEntry.methods[base] || billEntry.methods[base + '_s']) || null;
    tallyDispatch(cls + '.' + base, kinds,
      Object.fromEntries(Object.entries(dispatch).map(([a, e]) => [a, e.c || [{ js: e.d, s: e.s }]])),
      billedMeth && billedMeth.sig_sites);
    methods[base] = {
      variants,
      dispatch,
      static: variants.every((v) => v.static),
      pybind: pysig ? pysig.sigs.map((s) => ({
        params: s.params.map(mapPyParam),
      })) : null,
      tuple_ret: pysig ? pysig.tuple_ret : false,
    };
  }
  const ctorVariants = d.ctors.map((c) => ({ js: c.js, params: c.params,
    csig: c.params ? c.params.map(coarseOf) : null }));
  const { dispatch: cdispatch, kinds: ckinds } = buildDispatch(ctorVariants);
  tallyDispatch(cls + '.__init__', ckinds,
    Object.fromEntries(Object.entries(cdispatch).map(([a, e]) => [a, e.c || [{ js: e.d, s: e.s }]])),
    billEntry && billEntry.ctor && billEntry.ctor.sig_sites);
  table.classes[cls] = {
    parent: d.parent || null,
    ctors: d.ctors,
    cdispatch,
    pyctor: pd.ctor ? pd.ctor.map((s) => ({
      params: s.params.map(mapPyParam),
    })) : null,
    methods,
  };
  if (cls.startsWith('Handle_')) { table.handleClasses.push(cls); }
}
for (const e of [...neededEnums].sort()) { table.enums[e] = dtsEnums[e]; }

// --------------------------------------------------------------------- //
// 5. Emit _registry.py                                                   //
// --------------------------------------------------------------------- //
const lines = [
  '# GENERATED by experiments/upstream-topology-spike/gen-ocp-shim.mjs — DO NOT EDIT',
  '# Python proxy classes over the opencascade.js embind surface, inheritance',
  '# mirrored from cascadestudio.d.ts so upstream isinstance checks work.',
  'import ocp_core as _c',
  '',
];
// topo-sort classes (parents first)
const emitted = new Set();
const emitCls = (name) => {
  if (emitted.has(name) || !closure.has(name)) { return; }
  const p = dts[name].parent;
  if (p && closure.has(p)) { emitCls(p); }
  const base = (p && closure.has(p)) ? p : '_c.OcpProxy';
  lines.push(`class ${name}(${base}):`);
  lines.push(`    _cs = '${name}'`);
  emitted.add(name);
};
for (const name of [...closure].sort()) { emitCls(name); }
lines.push('');
// statics (bare + _s aliases, pybind style)
for (const cls of [...closure].sort()) {
  const t = table.classes[cls];
  for (const [base, m] of Object.entries(t.methods)) {
    if (!m.static) { continue; }
    if (/^\d/.test(base)) { continue; }
    lines.push(`${cls}.${base}_s = _c.static('${cls}', '${base}')`);
    lines.push(`${cls}.${base} = ${cls}.${base}_s`);
  }
}
lines.push('');
// enum holders with eagerly-fetched members (raw JS proxies: identity-stable)
for (const e of [...neededEnums].sort()) {
  lines.push(`class ${e}(_c.OcpEnum):`);
  lines.push(`    _cs = '${e}'`);
  for (const m of dtsEnums[e]) {
    lines.push(`${e}.${m} = _c.enum_member('${e}', '${m}')`);
  }
}
lines.push('');
lines.push('_c.register_classes(globals())');
lines.push('');

// --------------------------------------------------------------------- //
// 6. Per-OCP-module files                                                //
// --------------------------------------------------------------------- //
const moduleFiles = {};
for (const [mod, names] of Object.entries(importMap)) {
  // Standard/StdFail names appear in `except` clauses: they must stay the
  // loader's real-Exception stubs, and ocp_core raises through them.
  if (mod === 'Standard' || mod === 'StdFail') { continue; }
  const have = names.filter((n) => closure.has(n) || neededEnums.has(n));
  if (!have.length) { continue; }
  const enumMemberNames = new Set(
    [...neededEnums].filter((e) => e.startsWith(mod + '_'))
      .flatMap((e) => dtsEnums[e]));
  const missing = names.filter((n) => !closure.has(n) && !neededEnums.has(n)
    && !enumMemberNames.has(n));
  const src = [
    `# GENERATED OCP.${mod} — proxies over the embind binding (gen-ocp-shim.mjs)`,
    `from ocp_registry import ${have.join(', ')}  # noqa: F401`,
  ];
  if (mod === 'TopoDS') {
    // OCP exposes the TopoDS *utility* class whose statics are our
    // hand-bound TopoDS_Cast; synthesize it
    src.push('import ocp_core as _c');
    src.push('class TopoDS:');
    for (const k of ['Vertex', 'Edge', 'Wire', 'Face', 'Shell', 'Solid', 'Compound']) {
      src.push(`    ${k} = ${k}_s = _c.topods_downcast('${k}')`);
    }
    src.push("    CompSolid = CompSolid_s = _c.topods_downcast('CompSolid')  # raises: not in TopoDS_Cast (fork ask)");
  }
  // pybind exposes enum MEMBERS at module level too (ta.TopAbs_VERTEX)
  for (const e of neededEnums) {
    if (!e.startsWith(mod + '_')) { continue; }
    if (!have.includes(e)) {
      src.push(`from ocp_registry import ${e}  # noqa: F401`);
    }
    for (const m of dtsEnums[e]) {
      src.push(`${m} = ${e}.${m}`);
    }
  }
  if (missing.length) {
    src.push('class _Any:');
    src.push('    def __init__(self, *a, **k):');
    src.push('        raise NotImplementedError(');
    src.push(`            'OCP.${mod}.' + self.__class__.__name__ + ' is not in the generated shim')`);
    for (const n of missing) {
      if (n === 'TopoDS' && mod === 'TopoDS') { continue; }
      src.push(`class ${n}(_Any):`);
      src.push('    pass');
    }
  }
  moduleFiles[mod] = src.join('\n') + '\n';
}

// --------------------------------------------------------------------- //
// 7. Write everything                                                    //
// --------------------------------------------------------------------- //
fs.mkdirSync(join(OUT, 'OCP'), { recursive: true });
fs.writeFileSync(join(OUT, 'table.json'), JSON.stringify(table));
fs.writeFileSync(join(OUT, '_registry.py'), lines.join('\n'));
for (const [mod, src] of Object.entries(moduleFiles)) {
  fs.writeFileSync(join(OUT, 'OCP', mod + '.py'), src);
}
fs.writeFileSync(join(HERE, 'closure.json'), JSON.stringify([...closure].sort()));
// ---- generator SELF-CHECK: every key the runtime still dispatches ------ //
report.runtimeDispatched.sort((a, b) => b.billedSites - a.billedSites
  || (a.key < b.key ? -1 : 1));
report.ambiguousKeys.sort((a, b) => b.billedSites - a.billedSites
  || (a.key < b.key ? -1 : 1));
const billedAmb = report.ambiguousKeys.filter((r) => r.billedSites > 0);
fs.writeFileSync(join(HERE, 'dispatch-report.json'), JSON.stringify({
  note: 'gen-ocp-shim.mjs self-check: per-(class,method,arity) dispatch. '
    + 'direct = build-time pinned; typed = runtime coarse-type match, '
    + 'statically guaranteed decisive; ambiguous = statically inseparable '
    + 'pair exists (or an unknown-sig hand-registered variant shadows) — '
    + 'the runtime REFUSES with the candidate list on a tie.',
  totals: {
    directKeys: report.direct,
    typedKeys: report.typed,
    ambiguousKeys: report.ambiguous,
    unknownSigOnlyMethods: report.unknownOnly,
    pinnedPrimTypeKeys: report.pinnedPrimKeys,
    billedAmbiguousKeys: billedAmb.length,
  },
  billedAmbiguous: billedAmb,
  ambiguous: report.ambiguousKeys,
  runtimeDispatched: report.runtimeDispatched,
}, null, 1));
console.log('dispatch: direct', report.direct, '| typed', report.typed,
  '| ambiguous', report.ambiguous, '(billed:', billedAmb.length + ')',
  '| prim-key pins', report.pinnedPrimKeys,
  '| unknown-sig-only methods', report.unknownOnly);
if (billedAmb.length) {
  console.log('BILLED ambiguous keys (runtime will refuse on tie):');
  for (const r of billedAmb) {
    console.log('  ' + r.key + ' x' + r.billedSites + '  [' + r.cands.join(' | ') + ']');
  }
}
fs.writeFileSync(join(OUT, 'MANIFEST.json'), JSON.stringify({
  modules: Object.keys(moduleFiles).sort(),
  classCount: closure.size,
  enumCount: neededEnums.size,
}, null, 1));
console.log('generated:', closure.size, 'classes,', neededEnums.size, 'enums,',
  Object.keys(moduleFiles).length, 'OCP modules ->', OUT);
