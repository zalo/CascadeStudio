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
// The upstream sources are transformed at registration time with FOUR
// mechanical, version-robust rewrites (all line-count preserving except the
// multi-line TypeAlias collapse, which only affects library tracebacks):
//   1. module-level `X: TypeAlias = ...`  ->  `X = object`
//   2. runtime builtin-generic subscripts stripped (list[...] -> list; plus
//      ShapeList[...], which MicroPython cannot subscript at runtime)
//   3. class bases: `class B(Builder[Part])` -> `class B(Builder)`;
//      `Generic[...]` dropped from bases
//   4. `match X:` -> `for _cs_match_ in [X]:` with `case A() | B():` ->
//      `if/elif isinstance(_cs_match_, (A, B)):` and `case _:` -> `else:`
//      (ONLY simple class patterns and the wildcard are supported; any other
//      pattern raises at load time rather than mis-translating)

/** Which vendored upstream source tree is ACTIVE. This is the single
 *  version-bump switch: the build copies vendor/<this>/ into
 *  dist/upstream-b123d/upstream/, the unbuilt dev path fetches from it, and
 *  the module lists below are keyed by it. Flip back to 'build123d-0.11.1'
 *  to run the release snapshot. */
export const ACTIVE_UPSTREAM_VENDOR = 'build123d-dev-44a8d7c1';

/** Upstream Level-A modules, in dependency order, per vendored version.
 *  objects_part/objects_curve are the object layers over the builders;
 *  joints/pack/operations_sketch are stretch (registered when present,
 *  failures logged but non-fatal). The dev branch (future 0.12) split
 *  build_constants out of build_common and pack_utils out of pack. */
const VENDOR_MODULES = {
  'build123d-0.11.1': {
    levelA: [
      'build_enums', 'build_common', 'build_line', 'build_part',
      'build_sketch', 'objects_part', 'objects_curve',
    ],
    stretch: ['objects_sketch', 'operations_generic', 'operations_part',
      'operations_sketch', 'joints', 'pack'],
  },
  'build123d-dev-44a8d7c1': {
    levelA: [
      'build_enums', 'build_constants', 'build_common', 'build_line',
      'build_part', 'build_sketch', 'objects_part', 'objects_curve',
    ],
    stretch: ['objects_sketch', 'operations_generic', 'operations_part',
      'operations_sketch', 'joints', 'pack_utils', 'pack'],
  },
};
export const UPSTREAM_LEVEL_A = VENDOR_MODULES[ACTIVE_UPSTREAM_VENDOR].levelA;
export const UPSTREAM_STRETCH = VENDOR_MODULES[ACTIVE_UPSTREAM_VENDOR].stretch;

// --------------------------------------------------------------------- //
// Source transforms                                                      //
// --------------------------------------------------------------------- //

export function stripRuntimeGenerics(src) {
  // remove runtime-evaluated generic subscriptions: list[...] -> list etc.
  // (annotations are strings under `from __future__ import annotations`, so
  // this only affects real expressions like TypeVar("T", Any, list[Any]) or
  // ShapeList[Any]() calls).
  const names = ['list', 'tuple', 'dict', 'set', 'frozenset', 'type',
    'ShapeList', 'ContextVar'];
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
  // (annotation-only use). All Level-A TypeAlias RHSs are single-line
  // (multi-line ones exist only in geometry.py, which is replaced by the
  // seam adapter); refuse loudly rather than mis-translate.
  if (/^\w+: TypeAlias = [([]\s*$/m.test(src)) {
    throw new Error('multi-line TypeAlias RHS is not supported by the '
      + 'upstream-source transform');
  }
  return src.replace(/^(\w+): TypeAlias = .*$/gm, '$1 = object');
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
      const cm = line.match(/^(\s*)case (.+):\s*$/);
      if (!cm) { continue; }
      if (cm[1].length !== indent.length + 4) { continue; } // nested content
      const pat = cm[2].trim();
      if (pat === '_') {
        lines[j] = cm[1] + 'else:';
      } else {
        const classes = pat.split('|').map((p) => p.trim());
        const bad = classes.find((p) => !/^[A-Za-z_][A-Za-z0-9_.]*\(\)$/.test(p));
        if (bad) {
          throw new Error('unsupported match pattern in ' + name + ': ' + pat);
        }
        const tup = classes.map((p) => p.slice(0, -2)).join(', ');
        lines[j] = cm[1] + (first ? 'if' : 'elif') +
          ' isinstance(_cs_match_, (' + tup + ')):';
        first = false;
      }
    }
  }
  return lines.join('\n');
}

export function rewriteListSplats(src) {
  // `[*name]` list displays (MicroPython has no PEP 448 in displays)
  return src.replace(/\[\*([A-Za-z_][A-Za-z0-9_]*)\]/g, 'list($1)');
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

export function transformUpstreamSource(name, src) {
  let out = src;
  out = stripTypeAliases(out);
  out = copyNamedPlaneAliases(out);
  out = stripRuntimeGenerics(out);
  out = cleanClassBases(out);
  out = rewriteMatchStatements(out, name);
  out = rewriteDataclassFields(out);
  out = rewriteListSplats(out);
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
`;

/** Bootstrap upstream build123d over an already-initialized MicroPython
 *  interpreter. `lite` must already be registered as module 'build123d_lite'.
 *  @param mp        the MicroPython interpreter (loadMicroPython result)
 *  @param br        the imported `browser` module (has _cs_register_module)
 *  @param fetchText async (relativePath) => string  — reads dist/upstream-b123d files
 */
export async function bootstrapUpstreamB123d(mp, br, fetchText) {
  const manifest = JSON.parse(await fetchText('manifest.json'));

  const runPy = (code) => mp.runPython(code);
  runPy(REG_ALIAS_PY.replace(/^/, '')); // define _cs_register_alias in globals

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
    + '_cs_bi._cs_exc_info = lambda: (None, None, None)');
  // MicroPython's sort is UNSTABLE; upstream sources rely on CPython's
  // stable sorted() (pack.py's tie ordering decides the whole layout).
  // Decorate with the input index so ties keep their original order —
  // including under reverse=True (CPython keeps the ORIGINAL order among
  // equals there too, hence the negated index).
  runPy([
    'def _cs_stable_sorted(iterable, key=None, reverse=False):',
    '    items = list(iterable)',
    '    kf = key if key is not None else (lambda v: v)',
    '    if reverse:',
    '        dec = [(kf(v), -i, v) for i, v in enumerate(items)]',
    '    else:',
    '        dec = [(kf(v), i, v) for i, v in enumerate(items)]',
    '    dec.sort(key=lambda t: (t[0], t[1]), reverse=reverse)',
    '    return [t[2] for t in dec]',
    '_cs_bi.sorted = _cs_stable_sorted',
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

  // 4. the build123d package: placeholder init, then seam adapters
  br._cs_register_module('build123d', await fetchText('build123d/__init__.py'), true);

  // 5. upstream build_enums first (geometry imports Align from it), then
  //    finalize its metaclass-free enums
  const regUpstream = async (name) => {
    const raw = await fetchText('upstream/' + name + '.py');
    const src = transformUpstreamSource(name, raw);
    br._cs_register_module('build123d.' + name, src, false);
  };
  await regUpstream('build_enums');
  runPy([
    'import enum as _cs_enum',
    'import sys as _cs_sys',
    "_cs_enum._finalize_enums(_cs_sys.modules['build123d.build_enums'])",
  ].join('\n'));

  // 6. seam adapters
  br._cs_register_module('build123d.geometry', await fetchText('build123d/geometry.py'), false);
  br._cs_register_module('build123d.topology', await fetchText('build123d/topology/__init__.py'), true);
  for (const sub of ['shape_core', 'composite', 'three_d', 'two_d', 'one_d', 'zero_d']) {
    br._cs_register_module('build123d.topology.' + sub,
      await fetchText('build123d/topology/' + sub + '.py'), false);
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

  // 8. populate the package namespace + reset hook
  br._cs_register_module('build123d._finalize', await fetchText('build123d/_finalize.py'), false);

  console.log('[pysrc=upstream] upstream build123d Level-A registered'
    + (stretchLoaded.length ? ' (+ ' + stretchLoaded.join(', ') + ')' : ''));
}
