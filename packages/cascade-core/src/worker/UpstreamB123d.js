// UpstreamB123d.js - run UPSTREAM build123d 0.11.1 Level-A source on the
// MicroPython runtime, over build123d-lite's geometry/topology classes.
//
// Opt-in via `?pyruntime=micropython&pysrc=upstream` (localStorage
// 'cascade-py-src'). NOTHING here loads in the default modes.
//
// Layout at runtime (dist/upstream-b123d/, copied by the cascade-core build):
//   manifest.json            - registration order
//   shims/*.py               - stdlib shims (typing, enum, inspect, ...)
//   build123d/*.py           - the seam adapters (geometry, topology, ...)
//   upstream/*.py            - VENDORED upstream sources (vendor/build123d-
//                              0.11.1/, fetched by scripts/fetch-upstream-
//                              b123d.cjs; absent from a plain checkout)
//   ocp_import_map.json      - OCP names build123d imports (per module)
//
// The upstream sources are transformed at registration time with mechanical,
// version-robust rewrites (all line-count preserving except the multi-line
// TypeAlias collapse, which only affects library tracebacks):
//   1. module-level `X: TypeAlias = ...`  ->  `X = object`
//   2. runtime builtin-generic subscripts stripped (list[...] -> list; plus
//      ShapeList[...], which MicroPython cannot subscript at runtime)
//   3. class bases: `class B(Builder[Part])` -> `class B(Builder)`;
//      `Generic[...]` dropped from bases.  RETIRED when the interpreter
//      supports custom metaclasses (the custom micropython-cs build): the
//      typing shim's Generic then carries a metaclass whose __getitem__
//      returns the class, so `class Builder(ABC, Generic[T])` and
//      `class B(Builder[Part])` run as-written (probed at load; the stock
//      artifacts keep the transform)
//   4. `match X:` -> `for _cs_match_ in [X]:` with `case A() | B():` ->
//      `if/elif isinstance(_cs_match_, (A, B)):` and `case _:` -> `else:`
//      (ONLY simple class patterns and the wildcard are supported; any other
//      pattern raises at load time rather than mis-translating)

import { installOcpShim } from './OcpShim.js';

/** The upstream-TOPOLOGY spike (experiments/upstream-topology-spike/):
 *  'upstream' additionally boots the generated OCP-over-embind shim
 *  (upstream-py/ocp_shim/) and registers upstream topology/utils.py +
 *  zero_d.py VERBATIM (plus shape_core.py best-effort under an alias),
 *  interoperating with lite shapes through topo_bridge.py. Default OFF so
 *  mainline classification cannot move; opt in with ?pytopo=upstream
 *  (self._csPyTopo). */
export const PYTOPO_DEFAULT = 'lite';

/** Upstream Level-A modules, in dependency order. objects_part/objects_curve
 *  are the object layers over the builders; joints/pack/operations_sketch are
 *  stretch (registered when present, failures logged but non-fatal). */
export const UPSTREAM_LEVEL_A = [
  'build_enums', 'build_common', 'build_line', 'build_part', 'build_sketch',
  'objects_part', 'objects_curve',
];
export const UPSTREAM_STRETCH = ['objects_sketch', 'operations_generic',
  'operations_part', 'operations_sketch', 'joints', 'pack'];

// --------------------------------------------------------------------- //
// Source transforms                                                      //
// --------------------------------------------------------------------- //

export function stripRuntimeGenerics(src, extraNames) {
  // remove runtime-evaluated generic subscriptions: list[...] -> list etc.
  // (annotations are strings under `from __future__ import annotations`, so
  // this only affects real expressions like TypeVar("T", Any, list[Any]) or
  // ShapeList[Any]() calls).
  const names = ['list', 'tuple', 'dict', 'set', 'frozenset', 'type',
    'ShapeList', 'ContextVar', ...(extraNames || [])];
  let out = src;
  for (const n of names) {
    let i = 0;
    while ((i = out.indexOf(n + '[', i)) !== -1) {
      const before = i === 0 ? ' ' : out[i - 1];
      if (/[A-Za-z0-9_.]/.test(before)) { i += n.length; continue; }
      let d = 0, j = i + n.length;
      for (; j < out.length; j++) {
        if (out[j] === '[') { d++; }
        else if (out[j] === ']') { d--; if (d === 0) { j++; break; } }
      }
      out = out.slice(0, i + n.length) + out.slice(j);
    }
  }
  return out;
}

export function stripTypeAliases(src) {
  // MicroPython evaluates module-level TypeAlias assignments eagerly and has
  // no PEP 604 `|` on classes / builtin generics: neutralize the RHS
  // (annotation-only use). Multi-line RHSs (geometry.py's VectorLike /
  // ColorLike parenthesized unions) are blanked line-by-line so the module
  // keeps its line count.
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\w+): TypeAlias = (.*)$/);
    if (!m) { continue; }
    let depth = 0;
    for (const ch of m[2]) {
      if (ch === '(' || ch === '[') { depth++; }
      else if (ch === ')' || ch === ']') { depth--; }
    }
    lines[i] = m[1] + ' = object';
    for (let j = i + 1; depth > 0 && j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '(' || ch === '[') { depth++; }
        else if (ch === ')' || ch === ']') { depth--; }
      }
      lines[j] = '';
      i = j;
    }
  }
  return lines.join('\n');
}

export function cleanClassBases(src) {
  // class bases: Base[T] -> Base (runtime class subscription needs
  // metaclasses); Generic[...] dropped entirely.
  return src.replace(/^(class \s*\w+\()([^)\n]*)(\):)/gm, (m, a, bases, c) => {
    let b = bases.replace(/Generic\[[^\]]*\]\s*,?\s*/g, '')
      .replace(/,\s*Generic\[[^\]]*\]/g, '');
    b = b.replace(/\[[^\]]*\]/g, '').replace(/,\s*$/, '');
    if (b.trim() === '') { b = 'object'; }
    return a + b + c;
  });
}

/** match-statement rewrite (MicroPython has no match). Line-count preserving:
 *    match EXPR:                    -> for _cs_match_ in [EXPR]:
 *        case A() | B():            ->     if isinstance(_cs_match_, (A, B)):
 *        case C():                  ->     elif isinstance(_cs_match_, (C,)):
 *        case _:                    ->     else:
 *  Only simple class patterns / wildcard are supported; anything else throws. */
export function rewriteMatchStatements(src, name) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)match (.+):\s*$/);
    if (!m) { continue; }
    const indent = m[1];
    lines[i] = indent + 'for _cs_match_ in [' + m[2] + ']:';
    let first = true;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') { continue; }
      const lineIndent = line.match(/^\s*/)[0];
      if (lineIndent.length <= indent.length) { break; } // match block ended
      const cm = line.match(/^(\s*)case (.+?):\s*(#.*)?$/) ||
        line.match(/^(\s*)case (.+)$/); // multi-line case head (guard spans lines)
      if (!cm) { continue; }
      if (cm[1].length !== indent.length + 4) { continue; } // nested content
      const pat = cm[2].trim();
      const kw = first ? 'if' : 'elif';
      if (pat === '_') {
        lines[j] = cm[1] + 'else:';
      } else if (/^\([A-Za-z_][A-Za-z0-9_]*(\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*\)( if .*)?$/.test(pat)) {
        // flat tuple-of-names CAPTURE pattern, optional guard (the guard may
        // continue on the following source lines — only this line is
        // rewritten, so the translation must not add unbalanced brackets).
        // (n1, n2) if G  ->  elif _cs_match_seq(_cs_match_, 2) and
        //   ((n1 := _cs_match_[0]) or True) and ... and G
        const gm = pat.match(/^\(([^)]*)\)(?: if (.*))?$/);
        const names = gm[1].split(',').map((s) => s.trim());
        const binds = names.map((n, k) =>
          '((' + n + ' := _cs_match_[' + k + ']) or True)').join(' and ');
        let out = cm[1] + kw + ' _cs_match_seq(_cs_match_, ' + names.length +
          ') and ' + binds;
        if (gm[2] !== undefined) {
          out += ' and ' + gm[2] + (line.trimEnd().endsWith(':') ? ':' : '');
        } else {
          out += ':';
        }
        lines[j] = out;
        first = false;
      } else if (/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(pat)) {
        // dotted VALUE pattern (enum member): equality compare
        lines[j] = cm[1] + kw + ' _cs_match_ == ' + pat + ':';
        first = false;
      } else {
        const classes = pat.split('|').map((p) => p.trim());
        const bad = classes.find((p) => !/^[A-Za-z_][A-Za-z0-9_.]*\(\)$/.test(p));
        if (bad) {
          throw new Error('unsupported match pattern in ' + name + ': ' + pat);
        }
        const tup = classes.map((p) => p.slice(0, -2)).join(', ');
        lines[j] = cm[1] + kw +
          ' isinstance(_cs_match_, (' + tup + ')):';
        first = false;
      }
    }
  }
  return lines.join('\n');
}

export function rewriteListSplats(src) {
  // PEP 448 splats in LIST displays (MicroPython has none): `[a, *b, c]`
  // becomes `([a] + list(b) + [c])`. Bracket-balanced scan over the whole
  // source; a display is rewritten only when it has at least one TOP-LEVEL
  // element starting with `*` (subscripts and plain displays never do).
  // Runs inside-out (recurses into elements) so nested displays work.
  const splitTop = (inner) => {
    const parts = [];
    let depth = 0, start = 0;
    for (let k = 0; k < inner.length; k++) {
      const ch = inner[k];
      if ('([{'.indexOf(ch) !== -1) { depth++; }
      else if (')]}'.indexOf(ch) !== -1) { depth--; }
      else if (ch === ',' && depth === 0) {
        parts.push(inner.slice(start, k)); start = k + 1;
      }
    }
    parts.push(inner.slice(start));
    return parts;
  };
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '[') { out += src[i++]; continue; }
    let d = 0, j = i;
    for (; j < src.length; j++) {
      if ('([{'.indexOf(src[j]) !== -1) { d++; }
      else if (')]}'.indexOf(src[j]) !== -1) { d--; if (d === 0) { break; } }
    }
    if (j >= src.length) { out += src[i++]; continue; }
    const inner = rewriteListSplats(src.slice(i + 1, j));
    const exprs = splitTop(inner).map((p) => p.trim()).filter((e) => e !== '');
    if (!exprs.some((e) => e.startsWith('*'))) {
      out += '[' + inner + ']';
      i = j + 1;
      continue;
    }
    // group consecutive plain elements into list chunks, splats into list()
    const chunks = [];
    let plain = [];
    for (const e of exprs) {
      if (e.startsWith('*')) {
        if (plain.length) { chunks.push('[' + plain.join(', ') + ']'); plain = []; }
        chunks.push('list(' + e.slice(1).trim() + ')');
      } else {
        plain.push(e);
      }
    }
    if (plain.length) { chunks.push('[' + plain.join(', ') + ']'); }
    out += '(' + chunks.join(' + ') + ')';
    i = j + 1;
  }
  return out;
}

/** Bare named-plane ALIASES become copies: upstream's Plane.XY (classproperty)
 *  returns a FRESH plane per access and objects_curve MUTATES .origin on it;
 *  lite's named planes are shared singleton instances, so an aliased mutation
 *  would corrupt Plane.XY for every later evaluation on the page. Only plain
 *  `name = Plane.XY`-style statements are rewritten (signature defaults have
 *  a trailing comma/paren and are left alone — they are never mutated without
 *  first passing through copy.copy, which lite's Plane.__copy__ serves). */
export function copyNamedPlaneAliases(src) {
  return src.replace(
    /^(\s+)(\w+) = (Plane\.(?:XY|XZ|YZ|YX|ZX|ZY))\s*$/gm,
    '$1$2 = $3.copy()');
}

/** MicroPython drops class-body ANNOTATIONS, so @dataclass classes lose the
 *  field order the shim's generated __init__ needs (pack._Node takes a
 *  positional arg). Rewrite each annotated-with-default field line inside a
 *  @dataclass class body into a plain assignment that also records the field
 *  NAME in an ordered `_fields` list the dataclasses shim reads.
 *  Line-count preserving; bare annotations (no default) are left alone (they
 *  are no-ops on MicroPython either way). */
export function rewriteDataclassFields(src) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*@dataclass\b/.test(lines[i])) { continue; }
    // find the class line, then its body indent
    let j = i + 1;
    while (j < lines.length && !/^\s*class /.test(lines[j])) { j++; }
    if (j >= lines.length) { continue; }
    const classIndent = lines[j].match(/^\s*/)[0].length;
    let first = true;
    for (let k = j + 1; k < lines.length; k++) {
      const line = lines[k];
      if (line.trim() === '') { continue; }
      const ind = line.match(/^\s*/)[0].length;
      if (ind <= classIndent) { break; } // class body ended
      const m = line.match(/^(\s+)(\w+):\s*[^=]+?\s*=\s*(.+)$/);
      if (!m) { continue; }
      if (first) {
        lines[k] = m[1] + "_fields = ['" + m[2] + "']; " + m[2] + ' = ' + m[3];
        first = false;
      } else {
        lines[k] = m[1] + "_fields.append('" + m[2] + "'); " + m[2] + ' = ' + m[3];
      }
    }
  }
  return lines.join('\n');
}

export function rewriteListConcatCoercion(src) {
  // MicroPython's list.__add__ REFUSES a list SUBCLASS on the right
  // (`[outer_wire] + inner_wires` with a ShapeList raises "unsupported
  // types for __add__: 'list', 'list'"; subclass-on-the-LEFT works).
  // Coerce the right-hand term to list() when the LEFT is a list DISPLAY
  // (preceded by a non-identifier char, so subscripts are untouched) and
  // the right is a name/attribute/call chain.
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '[') { out += src[i++]; continue; }
    const before = i === 0 ? ' ' : src[i - 1];
    if (/[A-Za-z0-9_)\]'"]/.test(before)) { out += src[i++]; continue; } // subscript
    let d = 0, j = i;
    for (; j < src.length; j++) {
      if ('([{'.indexOf(src[j]) !== -1) { d++; }
      else if (')]}'.indexOf(src[j]) !== -1) { d--; if (d === 0) { break; } }
    }
    if (j >= src.length) { out += src[i++]; continue; }
    const display = src.slice(i, j + 1);
    out += display;
    i = j + 1;
    // wrap EVERY chained `+ term` (the first list() result is a plain list
    // again, so `[a] + g.group(6) + g.group(5)` needs both terms coerced)
    for (;;) {
      const rest = src.slice(i);
      const m = rest.match(/^ \+ ([A-Za-z_][\w.]*(?:\((?:[^()]|\([^()]*\))*\))*)/);
      // only when the term ends there (not followed by [ ( . or word chars)
      if (!m || /^[[(.\w]/.test(rest.slice(m[0].length))) { break; }
      out += ' + list(' + m[1] + ')';
      i += m[0].length;
    }
  }
  return out;
}

export function transformUpstreamSource(name, src, opts) {
  let out = src;
  out = stripTypeAliases(out);
  if (!(opts && opts.upstreamGeometry)) {
    // lite's named planes are shared singletons that a mutation would
    // corrupt; UPSTREAM geometry's Plane.XY classproperty returns a fresh
    // plane per access (and upstream Plane has no .copy()), so the rewrite
    // is only needed (and only valid) over the lite seam.
    out = copyNamedPlaneAliases(out);
  }
  out = stripRuntimeGenerics(out);
  if (!(opts && opts.metaclasses)) {
    // without interpreter metaclasses, class-base subscripts and Generic[...]
    // bases must be rewritten away (see the header comment)
    out = cleanClassBases(out);
  }
  out = rewriteMatchStatements(out, name);
  out = rewriteDataclassFields(out);
  out = rewriteListSplats(out);
  out = rewriteListConcatCoercion(out);
  // MicroPython classes have no bound __new__ attribute; the one corpus
  // call site (Shape.__deepcopy__) constructs through object.__new__
  out = out.replace(/\bcls\.__new__\(cls\)/g, 'object.__new__(cls)');
  // MicroPython property objects have no __get__ (nor .fget); shape_core's
  // filter_by/group_by(property) evaluate through a builtins helper that
  // finds the property on the instance's class by IDENTITY and getattrs it
  out = out.replace(/(\w+)\.__get__\((\w+)\)/g, '_cs_prop_get($1, $2)');
  // ... and the BARE bound-method form (sorted(key=sort_by.__get__))
  out = out.replace(/(\w+)\.__get__(?!\()/g,
    '(lambda _cs_o, _cs_p=$1: _cs_prop_get(_cs_p, _cs_o))');
  // MicroPython dicts are UNORDERED (CPython's are insertion-ordered, and
  // upstream RELIES on it): _topods_entities dedups explorer results through
  // a dict — a plain dict SCRAMBLES every faces()/edges()/vertices() list —
  // and objects_curve dedups point sequences with dict.fromkeys
  out = out.replace(/\bout = \{\}  # using dict to prevent duplicates/,
    'out = _cs_odict()  # ordered dedup (MicroPython dicts are unordered)');
  out = out.replace(/\bdict\.fromkeys\(/g, '_cs_ordered_fromkeys(');
  // MicroPython f-strings do not dispatch __format__ for format SPECS on
  // objects (geometry's Vector/Axis/Location/Plane __repr__/__str__ format
  // themselves with ':.6g'/'.13g'); route through the builtins _cs_format
  // helper, which does
  out = out.replace(/\{([^{}:]+):\.\{TOL_DIGITS\}g\}/g,
    "{_cs_format($1, '.6g')}");
  out = out.replace(/\{([^{}:]+):\.13g\}/g, "{_cs_format($1, '.13g')}");
  // ... and the DYNAMIC-spec form ({self.position:{spec}} inside the
  // geometry __format__ implementations)
  out = out.replace(/\{([^{}:]+):\{(\w+)\}\}/g, '{_cs_format($1, $2)}');
  // MicroPython str has no ljust (shape_core._show_tree): f-string and
  // dotted-name receivers become _cs_ljust(recv, ...) builtins calls
  out = out.replace(/(f"[^"\n]*")\.ljust\(/g, '_cs_ljust($1, ');
  out = out.replace(/([\w.]+)\.ljust\(/g, '_cs_ljust($1, ');
  // MicroPython's collections.deque REQUIRES (iterable, maxlen); give the
  // zero-arg form an unbounded backing (topo_distance_to's BFS frontier)
  out = out.replace(/= deque\(\)/g, '= deque((), 4096)');
  // MicroPython sys has no float_info and sys is read-only (two_d uses .max)
  out = out.replace(/\bsys\.float_info\.max\b/g, '1.7976931348623157e+308');
  out = out.replace(/\bsys\.float_info\.epsilon\b/g, '2.220446049250313e-16');
  out = out.replace(/\bsys\.float_info\.min\b/g, '2.2250738585072014e-308');
  // PEP 604 runtime unions in isinstance (`isinstance(x, Location | Plane)`)
  // — MicroPython types have no __or__; rewrite the union to a tuple. Only
  // the simple-name form appears in the corpus (4 sites, all Location|Plane).
  out = out.replace(
    /isinstance\((\w+), ([A-Za-z_][\w.]*(?:\s*\|\s*[A-Za-z_][\w.]*)+)\)/g,
    (m2, v, union) => 'isinstance(' + v + ', (' +
      union.split('|').map((s) => s.trim()).join(', ') + '))');
  // this MicroPython build has no sys.exc_info and sys is read-only; the
  // loader installs a builtins._cs_exc_info that reports "not handling an
  // exception" (build123d only uses it to soften errors during unwinding)
  out = out.replace(/sys\.exc_info\(\)/g, '_cs_exc_info()');
  return out;
}

// --------------------------------------------------------------------- //
// Loader                                                                 //
// --------------------------------------------------------------------- //

const REG_ALIAS_PY = String.raw`import sys
def _cs_register_alias(name, src):
    """Register a shim under a name that may collide with a MicroPython
    builtin (builtins shadow sys.path): write under an alias, import, remap
    via sys.modules."""
    alias = '_cs_shim_' + name.replace('.', '_')
    with open('/lib/' + alias + '.py', 'w') as fh:
        fh.write(src)
    mod = __import__(alias)
    sys.modules[name] = mod
    if alias in sys.modules:
        del sys.modules[alias]
    return mod
`;

const LOGGING_PATCH_PY = String.raw`import logging as _lg
class _CsNullHandler:
    def __init__(self, *a, **k):
        pass
    def handle(self, r):
        pass
    def emit(self, r):
        pass
    def createLock(self):
        pass
if not hasattr(_lg, 'NullHandler'):
    _lg.NullHandler = _CsNullHandler
import sys as _cs_sys
_cs_os_shim = _cs_sys.modules.get('os')
if _cs_os_shim is not None and not hasattr(_cs_os_shim, 'PathLike'):
    class _CsPathLike:
        pass
    _cs_os_shim.PathLike = _CsPathLike
if _cs_os_shim is not None and not hasattr(_cs_os_shim, 'fspath'):
    def _cs_fspath(p):
        return p if isinstance(p, str) else str(p)
    _cs_os_shim.fspath = _cs_fspath
`;

/** Bootstrap upstream build123d over an already-initialized MicroPython
 *  interpreter. `lite` must already be registered as module 'build123d_lite'.
 *  @param mp        the MicroPython interpreter (loadMicroPython result)
 *  @param br        the imported `browser` module (has _cs_register_module)
 *  @param fetchText async (relativePath) => string  — reads dist/upstream-b123d files
 */
export async function bootstrapUpstreamB123d(mp, br, fetchText, pytopoOpt) {
  const pytopo = pytopoOpt || self._csPyTopo || PYTOPO_DEFAULT;
  const manifest = JSON.parse(await fetchText('manifest.json'));

  const runPy = (code) => mp.runPython(code);
  runPy(REG_ALIAS_PY.replace(/^/, '')); // define _cs_register_alias in globals

  // Interpreter capability probe: custom metaclasses (the custom
  // micropython-cs artifacts have them; the stock npm settrace pair raises
  // TypeError on the metaclass= class keyword). With them, the typing shim's
  // Generic and the enum shim's EnumMeta are REAL metaclass-based
  // implementations, the class-base-subscript transform is retired, and the
  // _finalize_enums post-import pass is not needed. Every capability is
  // feature-detected independently on the Python side too, so a mixed state
  // cannot break the fallback.
  let hasMetaclasses = false;
  try {
    runPy('class _CsMetaProbe(type):\n    pass\n'
      + 'class _CsMetaProbed(metaclass=_CsMetaProbe):\n    pass\n'
      + 'del _CsMetaProbe, _CsMetaProbed');
    hasMetaclasses = true;
  } catch (e) {
    hasMetaclasses = false;
  }
  self._csMpHasMetaclasses = hasMetaclasses;
  const transformOpts = { metaclasses: hasMetaclasses,
    upstreamGeometry: pytopo === 'upstream' };

  const registerAlias = (name, src) => {
    mp.globals.set('_CS_N', name);
    mp.globals.set('_CS_S', src);
    runPy('_cs_register_alias(_CS_N, _CS_S)');
  };

  // 1. stdlib shims (sys.modules aliasing: robust against builtin shadowing)
  for (const entry of manifest.shims) {
    registerAlias(entry.name, await fetchText(entry.file));
  }

  // 2. logging shim patch (lite's logging has no NullHandler) + the
  //    sys.exc_info stand-in (see transformUpstreamSource)
  runPy(LOGGING_PATCH_PY);
  runPy('import builtins as _cs_bi\n'
    + '_cs_bi._cs_exc_info = lambda: (None, None, None)\n'
    // the match-statement rewrite's sequence-pattern helper (tuple-of-names
    // capture patterns in geometry.py's Color)
    + '_cs_bi._cs_match_seq = lambda v, n: isinstance(v, (tuple, list)) and len(v) == n');
  // Stock MicroPython's sort is UNSTABLE; upstream sources rely on CPython's
  // stable sorted() (pack.py's tie ordering decides the whole layout).
  // Decorate with the input index so ties keep their original order —
  // including under reverse=True (CPython keeps the ORIGINAL order among
  // equals there too, hence the negated index). Probed, not assumed: the
  // custom micropython-cs interpreter build has a native STABLE merge sort
  // (which also calls the key exactly once per element), so on it the
  // builtin is left alone and this decorate-sort shim is vestigial.
  runPy([
    '_cs_probe = sorted([(i % 2, i) for i in range(32)], key=lambda t: t[0])',
    '_cs_sort_stable = [t[1] for t in _cs_probe] == ' +
      '[i for i in range(32) if i % 2 == 0] + [i for i in range(32) if i % 2 == 1]',
    'def _cs_stable_sorted(iterable, key=None, reverse=False):',
    '    items = list(iterable)',
    '    kf = key if key is not None else (lambda v: v)',
    '    if reverse:',
    '        dec = [(kf(v), -i, v) for i, v in enumerate(items)]',
    '    else:',
    '        dec = [(kf(v), i, v) for i, v in enumerate(items)]',
    '    dec.sort(key=lambda t: (t[0], t[1]), reverse=reverse)',
    '    return [t[2] for t in dec]',
    'if not _cs_sort_stable:',
    '    _cs_bi.sorted = _cs_stable_sorted',
  ].join('\n'));

  // 3. OCP stubs: exact-name placeholders for every OCP module build123d
  //    imports. OCP.Standard exports must be real Exception subclasses
  //    (they appear in `except` clauses); OCP.GccEnt values are ints (they
  //    become Tangency enum member values); everything else is an inert
  //    _Any (Level-A never calls OCP directly through lite's seam).
  const ocpMap = JSON.parse(await fetchText('ocp_import_map.json'));
  runPy([
    'import sys',
    'import browser as _cs_br',
    '_cs_os = _cs_br._os  # the BUILTIN os (lite os shim has no mkdir)',
    "try:",
    "    _cs_os.mkdir('/lib/OCP')",
    "except OSError:",
    "    pass",
    "open('/lib/OCP/__init__.py', 'w').close()",
  ].join('\n'));
  for (const [mod, names] of Object.entries(ocpMap)) {
    let body;
    if (mod === 'Standard' || mod === 'StdFail') {
      // these names appear in `except` clauses: they must be real
      // Exception subclasses or the except-match raises TypeError
      body = names.map((n) => 'class ' + n + '(Exception):\n    pass').join('\n') + '\n';
    } else if (mod === 'GccEnt') {
      body = names.map((n, i) => n + ' = ' + i).join('\n') + '\n';
    } else {
      body = 'class _Any:\n' +
        '    def __init__(self, *a, **k):\n        pass\n' +
        '    def __call__(self, *a, **k):\n        return _Any()\n' +
        '    def __getattr__(self, n):\n        return _Any()\n' +
        names.map((n) => n + ' = _Any').join('\n') + '\n';
    }
    mp.globals.set('_CS_OM', mod);
    mp.globals.set('_CS_OB', body);
    runPy("with open('/lib/OCP/' + _CS_OM + '.py', 'w') as _f:\n    _f.write(_CS_OB)");
  }

  // 3b. pytopo=upstream: the generated OCP-over-embind shim replaces the
  //     inert stubs for every module it covers (see
  //     experiments/upstream-topology-spike/gen-ocp-shim.mjs)
  if (pytopo === 'upstream') {
    const shimManifest = JSON.parse(await fetchText('ocp_shim/MANIFEST.json'));
    installOcpShim(self, JSON.parse(await fetchText('ocp_shim/table.json')));
    registerAlias('ocp_core', await fetchText('ocp_shim/ocp_core.py'));
    registerAlias('ocp_registry', await fetchText('ocp_shim/_registry.py'));
    for (const mod of shimManifest.modules) {
      mp.globals.set('_CS_OM', mod);
      mp.globals.set('_CS_OB', await fetchText('ocp_shim/OCP/' + mod + '.py'));
      runPy("with open('/lib/OCP/' + _CS_OM + '.py', 'w') as _f:\n    _f.write(_CS_OB)");
    }
    console.log('[pytopo=upstream] OCP shim installed ('
      + shimManifest.classCount + ' classes, ' + shimManifest.modules.length
      + ' modules)');
  }

  // 4. the build123d package: placeholder init, then seam adapters
  br._cs_register_module('build123d', await fetchText('build123d/__init__.py'), true);

  // 5. upstream build_enums first (geometry imports Align from it); on the
  //    metaclass-free fallback, finalize its enums with the post-import pass
  //    (the metaclass EnumMeta realizes members at class creation instead)
  const regUpstream = async (name) => {
    const raw = await fetchText('upstream/' + name + '.py');
    const src = transformUpstreamSource(name, raw, transformOpts);
    br._cs_register_module('build123d.' + name, src, false);
  };
  await regUpstream('build_enums');
  if (!hasMetaclasses) {
    runPy([
      'import enum as _cs_enum',
      'import sys as _cs_sys',
      "_cs_enum._finalize_enums(_cs_sys.modules['build123d.build_enums'])",
    ].join('\n'));
  }

  // 6. the geometry/topology bottom layer.
  //    pytopo=lite (the default): the SEAM adapter modules re-export lite's
  //    classes. pytopo=upstream (Stage 3): upstream geometry.py + the WHOLE
  //    topology package run VERBATIM over the OCP shim, and lite reduces to
  //    the JS op layer + the worker glue (ocp_shim/topo_glue.py).
  if (pytopo !== 'upstream') {
    br._cs_register_module('build123d.geometry', await fetchText('build123d/geometry.py'), false);
    br._cs_register_module('build123d.topology', await fetchText('build123d/topology/__init__.py'), true);
    const seamSubs = ['shape_core', 'composite', 'three_d', 'two_d', 'one_d', 'zero_d'];
    for (const sub of seamSubs) {
      br._cs_register_module('build123d.topology.' + sub,
        await fetchText('build123d/topology/' + sub + '.py'), false);
    }
  } else {
    registerAlias('anytree', await fetchText('ocp_shim/anytree.py'));
    br._cs_register_module('IPython', 'pass\n', true);
    br._cs_register_module('IPython.lib', 'pass\n', true);
    br._cs_register_module('IPython.lib.pretty', await fetchText('ocp_shim/ipython_pretty.py'), false);
    // the numpy MICRO-shim (array/cross/linspace/3x3 lstsq — exactly the
    // billed surface of upstream geometry.py + one_d.py) replaces the
    // honest raising stub ONLY here; everywhere else `import numpy` still
    // raises on use. Registered AFTER the manifest shims, so this wins.
    registerAlias('numpy', await fetchText('ocp_shim/numpy_micro.py'));

    // MicroPython's round() does not dispatch to __round__; upstream
    // geometry rounds Vectors (`round(Vector(x_dir), 14)` in Plane(face)).
    // Install a protocol-aware round in builtins (pytopo=upstream boots
    // only).
    runPy([
      'import builtins as _cs_bi2',
      '_cs_orig_round = _cs_bi2.round',
      'def _cs_round(x, n=None):',
      "    r = getattr(x, '__round__', None)",
      '    if r is not None:',
      '        return r(n) if n is not None else r()',
      '    return _cs_orig_round(x) if n is None else _cs_orig_round(x, n)',
      '_cs_bi2.round = _cs_round',
      // MicroPython's sum() rejects the start KEYWORD (one_d.common_plane
      // sums Vectors with start=Vector(0,0,0)); positional start works
      '_cs_orig_sum = _cs_bi2.sum',
      'def _cs_sum(it, start=0):',
      '    return _cs_orig_sum(it, start)',
      '_cs_bi2.sum = _cs_sum',
      // property evaluation for ShapeList.filter_by/group_by(property):
      // MicroPython property objects have no __get__/.fget — find the
      // property on the instance's class chain BY IDENTITY and getattr it
      'def _cs_prop_get(prop, obj):',
      '    stack = [type(obj)]',
      '    while stack:',
      '        k = stack.pop()',
      "        d = getattr(k, '__dict__', None)",
      '        if d:',
      '            for name in d:',
      '                if d[name] is prop:',
      '                    return getattr(obj, name)',
      "        stack.extend(getattr(k, '__bases__', ()))",
      "    raise AttributeError('property not found on ' + type(obj).__name__)",
      '_cs_bi2._cs_prop_get = _cs_prop_get',
      // MicroPython has no builtin format() (geometry hex-color paths;
      // Vector.__str__ calls format(self, '.6g') — dispatch to __format__)
      "def _cs_format(v, spec=''):",
      "    f = getattr(v, '__format__', None)",
      '    if f is not None:',
      '        try:',
      '            return f(spec)',
      '        except (TypeError, NotImplementedError):',
      '            pass',
      "    return ('{:' + spec + '}').format(v) if spec else str(v)",
      '_cs_bi2._cs_format = _cs_format',
      'try:',
      '    format',
      'except NameError:',
      '    _cs_bi2.format = _cs_format',
      // str.ljust stand-in (MicroPython lacks it; _show_tree)
      'def _cs_ljust(s, n, fill=" "):',
      '    s = str(s)',
      '    return s + fill * max(0, n - len(s))',
      '_cs_bi2._cs_ljust = _cs_ljust',
      // insertion-ordered dedup helpers (MicroPython dicts are unordered;
      // see the _topods_entities / dict.fromkeys transforms). NOT
      // collections.OrderedDict: MicroPython implements ordered maps with
      // LINEAR lookup, which turned every faces()/edges() dedup into
      // O(n^2) mp_map_lookup+mp_obj_equal (27%+15% of b01's profile).
      // A plain (hash-bucketed) dict keyed on the value plus an insertion-
      // order list gives O(1) inserts with the same semantics.
      'class _CsOrderedStore:',
      '    def __init__(self):',
      '        self._d = {}',
      '        self._vals = []',
      '    def __setitem__(self, k, v):',
      '        d = self._d',
      '        i = d.get(k, -1)',
      '        if i >= 0:',
      '            self._vals[i] = v',
      '        else:',
      '            d[k] = len(self._vals)',
      '            self._vals.append(v)',
      '    def values(self):',
      '        return self._vals',
      '_cs_bi2._cs_odict = _CsOrderedStore',
      'def _cs_ordered_fromkeys(seq, value=None):',
      '    seen = {}',
      '    out = []',
      '    for k in seq:',
      '        if k not in seen:',
      '            seen[k] = True',
      '            out.append(k)',
      '    return out',
      '_cs_bi2._cs_ordered_fromkeys = _cs_ordered_fromkeys',
    ].join('\n'));

    const topoTransform = (name, raw) => {
      let src = transformUpstreamSource(name, raw, transformOpts);
      // topology-only extra strips: module-level type-alias factories built
      // on the isinstance-tuple collections.abc shim (Callable[[...], X])
      src = stripRuntimeGenerics(src, ['Callable', 'Iterator']);
      // MicroPython exposes no bound dunders on builtin instances
      // (list(self).__getitem__(key) in ShapeList slicing)
      src = src.replace(/\.__getitem__\(([^()]+)\)/g, '[$1]');
      return src;
    };

    // 6-up.1: upstream geometry.py VERBATIM (numpy micro-shim serves its
    // Axis._intersect_axis / color_wheel calls; AxisMeta runs natively on
    // the metaclass interpreter)
    br._cs_register_module('build123d.geometry',
      topoTransform('geometry', await fetchText('upstream/geometry.py')), false);

    // 6-up.1b: build123d.text is kernel-font machinery (fontTools +
    // Font_FontMgr — COMPROMISE(text): no system fonts in wasm, kernel text
    // permanently skipped). composite.py imports FONT_ASPECT/FontManager at
    // module level; make_text itself is routed to lite's opentype.js path by
    // topo_glue, so an import-satisfying stub suffices.
    br._cs_register_module('build123d.text', [
      'from build123d.build_enums import FontStyle',
      'FONT_ASPECT = {FontStyle.REGULAR: 0, FontStyle.BOLD: 1,',
      '               FontStyle.ITALIC: 2, FontStyle.BOLDITALIC: 3}',
      'class FontManager:',
      '    def __getattr__(self, name):',
      "        raise NotImplementedError('kernel fonts are not available in '",
      "                                  'this wasm build (COMPROMISE(text))')",
      '',
    ].join('\n'), false);

    // 6-up.2: the topology package. Submodules are registered bottom-up
    // under a PLACEHOLDER package __init__ (they only import downward), then
    // the real upstream __init__.py replaces it and the package is reloaded
    // (its relative imports resolve against the already-imported submodules).
    br._cs_register_module('build123d.topology', 'pass\n', true);
    const TOPO_ORDER = ['shape_core', 'utils', 'zero_d', 'constrained_lines',
      'one_d', 'two_d', 'three_d', 'composite'];
    for (const sub of TOPO_ORDER) {
      br._cs_register_module('build123d.topology.' + sub,
        topoTransform(sub, await fetchText('upstream/topology/' + sub + '.py')), false);
    }
    mp.globals.set('_CS_TOPO_INIT',
      topoTransform('topology_init', await fetchText('upstream/topology/__init__.py')));
    runPy([
      'import sys as _cs_sys',
      "with open('/lib/build123d/topology/__init__.py', 'w') as _f:",
      '    _f.write(_CS_TOPO_INIT)',
      "del _cs_sys.modules['build123d.topology']",
      'import build123d.topology as _cs_topo_mod',
      "setattr(_cs_sys.modules['build123d'], 'topology', _cs_topo_mod)",
    ].join('\n'));

    // 6-up.3: lite interop (Shape.wrapped proxies, _Fn unwrap) + the worker
    // glue (show/sceneShapes, measurement, text/gordon routing — everything
    // lite's bottom layer provided to CascadeStudio)
    registerAlias('topo_bridge', await fetchText('ocp_shim/topo_bridge.py'));
    registerAlias('topo_glue', await fetchText('ocp_shim/topo_glue.py'));
    console.log('[pytopo=upstream] upstream geometry + FULL topology registered verbatim');
  }

  // 7. the upstream Level-A modules
  for (const name of UPSTREAM_LEVEL_A) {
    if (name === 'build_enums') { continue; }
    await regUpstream(name);
  }
  const stretchLoaded = [];
  for (const name of UPSTREAM_STRETCH) {
    try {
      await regUpstream(name);
      stretchLoaded.push(name);
    } catch (e) {
      console.log('[pysrc=upstream] stretch module ' + name + ' not loaded: ' +
        String((e && e.message) || e).split('\n').slice(-2).join(' | ').slice(0, 200));
    }
  }

  // 8. populate the package namespace + reset hook (_finalize branches on
  //    the topology layer via build123d._cs_pytopo)
  mp.globals.set('_CS_PYTOPO', pytopo);
  runPy("import sys as _cs_sys\nsetattr(_cs_sys.modules['build123d'], '_cs_pytopo', _CS_PYTOPO)");
  br._cs_register_module('build123d._finalize', await fetchText('build123d/_finalize.py'), false);

  console.log('[pysrc=upstream] upstream build123d Level-A registered'
    + (hasMetaclasses ? ' (metaclasses: native enum/Generic, no base-subscript transform)'
      : ' (no interpreter metaclasses: transform + _finalize_enums fallback)')
    + (stretchLoaded.length ? ' (+ ' + stretchLoaded.join(', ') + ')' : ''));
}
