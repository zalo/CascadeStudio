import './node_modules/@micropython/micropython-webassembly-pyscript/micropython.mjs';
import { PY_SHIM_MODULES } from '/home/agent-untrusted/Desktop/CascadeStudio/packages/cascade-core/src/worker/Build123dLite.js';
import fs from 'fs';
const B = '/home/agent-untrusted/Desktop/ocjs-deps/b123d-ref-venv/lib/python3.12/site-packages/build123d';
const mp = await globalThis.loadMicroPython({stdout: (t) => console.log(t), url: './node_modules/@micropython/micropython-webassembly-pyscript/micropython-settrace.wasm'});
mp.registerJsModule('jsworker', { self: { _csMpKind: () => 'func', _csMpCall: () => ({ok: true, value: null}), Math, Date } });
mp.runPython(`import sys, os
sys.modules['_cs_bos'] = os  # pin the BUILTIN os before any shim shadows it
try: os.mkdir('/lib')
except OSError: pass
sys.path.insert(0, '/lib')
with open('/lib/browser.py', 'w') as f: f.write('from jsworker import self')`);
const reg = (name, src) => {
  mp.globals.set('_N', name); mp.globals.set('_S', src);
  mp.runPython(`
import sys
import _cs_bos as os
_parts = _N.split('.')
_d = '/lib'
for _p in _parts[:-1]:
    _d = _d + '/' + _p
    try: os.mkdir(_d)
    except OSError: pass
    if not '__init__.py' in os.listdir(_d):
        open(_d + '/__init__.py', 'w').close()
_pkg = _N == 'scipy'
_alias = _N in ('math','json','os','random','enum','abc','warnings','inspect','dataclasses','contextvars','typing_extensions')
if _alias and '.' not in _N:
    _path = '/lib/_cs_' + _N + '.py'
    with open(_path, 'w') as f: f.write(_S)
    sys.modules[_N] = __import__('_cs_' + _N)
elif _pkg:
    try: os.mkdir('/lib/' + _N)
    except OSError: pass
    with open('/lib/' + _N + '/__init__.py', 'w') as f: f.write(_S)
    __import__(_N)
else:
    _path = _d + '/' + _parts[-1] + '.py'
    with open(_path, 'w') as f: f.write(_S)
    __import__(_N)
    if len(_parts) > 1 and _parts[0] in sys.modules:
        setattr(sys.modules[_parts[0]], _parts[-1], sys.modules[_N])
`);
};
// lite's existing shims
for (const n of ['typing', 'copy', 'functools', 'itertools', 'operator', 'logging', 'os', 'json', 'math', 'random']) { try { reg(n, PY_SHIM_MODULES[n]); } catch (e) { console.log('SHIM-FAIL ' + n + ' :: ' + String(e.message||e).split('\n').filter(l=>l.trim()).slice(-2).join(' | ').slice(0,150)); } }
for (const n of ['_scipy_shim', 'scipy', 'scipy.optimize', 'scipy.spatial']) { try { reg(n, PY_SHIM_MODULES[n]); } catch (e) { console.log('SHIM-FAIL ' + n); } }
const tryRegDotted = (n, src) => {
  mp.globals.set('_N', n); mp.globals.set('_S', src);
  try { mp.runPython(`
import sys
_alias = '_cs_' + _N.replace('.', '_')
with open('/lib/' + _alias + '.py', 'w') as f: f.write(_S)
sys.modules[_N] = __import__(_alias)
`); } catch (e) { console.log('SHIM-FAIL ' + n + ' :: ' + String(e.message||e).split('\n').filter(l=>l.trim()).slice(-2).join(' | ').slice(0,150)); }
};
try { mp.runPython(`
import logging as _lg
class _NullHandler:
    def __init__(self, *a, **k): pass
    def handle(self, r): pass
    def emit(self, r): pass
    def createLock(self): pass
_lg.NullHandler = _NullHandler
if not hasattr(_lg, 'getLogger'):
    class _L:
        def __getattr__(self, n): return lambda *a, **k: None
    _lg.getLogger = lambda *a, **k: _L()
`); } catch (e) { console.log('LOGPATCH-FAIL :: ' + String(e.message||e).slice(-150)); }
tryRegDotted('typing', `# functional typing shim for running UPSTREAM source on MicroPython
TYPE_CHECKING = False
class _Sub:
    def __init__(self, name):
        self._name = name
    def __getitem__(self, item):
        return self
    def __call__(self, *a, **k):
        return _Sub(self._name)
    def __repr__(self):
        return 'typing.' + self._name
class _SubBase:
    # subscript -> a plain subclassable base
    def __init__(self, name): self._name = name
    def __getitem__(self, item): return object
Generic = _SubBase('Generic')
Protocol = object
def TypeVar(name, *a, **k):
    return _Sub('TypeVar:' + name)
def ParamSpec(name, *a, **k):
    return _Sub('ParamSpec:' + name)
def NewType(name, tp):
    return lambda x: x
def overload(f):
    return f
def final(f):
    return f
def runtime_checkable(c):
    return c
def cast(t, v):
    return v
def no_type_check(f):
    return f
def get_type_hints(*a, **k):
    return {}
Any = _Sub('Any')
Union = _Sub('Union')
Optional = _Sub('Optional')
Callable = _Sub('Callable')
Iterable = _Sub('Iterable')
Iterator = _Sub('Iterator')
Sequence = _Sub('Sequence')
Mapping = _Sub('Mapping')
MutableMapping = _Sub('MutableMapping')
List = _Sub('List')
Dict = _Sub('Dict')
Set = _Sub('Set')
Tuple = _Sub('Tuple')
Type = _Sub('Type')
ClassVar = _Sub('ClassVar')
Literal = _Sub('Literal')
Annotated = _Sub('Annotated')
TypeAlias = _Sub('TypeAlias')
Self = _Sub('Self')
Never = _Sub('Never')
NoReturn = _Sub('NoReturn')
Collection = _Sub('Collection')
Hashable = _Sub('Hashable')
Sized = _Sub('Sized')
class NamedTuple:
    pass
`);
tryRegDotted('__future__', 'annotations = 0\ndivision = 0\nprint_function = 0\nunicode_literals = 0');
tryRegDotted('collections.abc', `# functional shim: isinstance() targets as type tuples (no metaclasses here)
_gen = type((_x for _x in ()))
Iterable = (list, tuple, set, frozenset, dict, range, str, bytes, _gen)
Sequence = (list, tuple, range, str, bytes)
Mapping = (dict,)
Callable = type(lambda: 0)
Iterator = (_gen,)
Hashable = object
Sized = (list, tuple, set, dict, str, bytes)
Collection = (list, tuple, set, frozenset, dict, range, str, bytes)
`);
const tryReg = (n, src) => { try { reg(n, src); } catch (e) { console.log('SHIM-FAIL ' + n + ' :: ' + String(e.message||e).split('\n').filter(l=>l.trim()).slice(-2).join(' | ').slice(0,150)); } };
// new shims for upstream source
tryReg('warnings', 'def warn(*a, **k):\n    pass\ndef simplefilter(*a, **k):\n    pass\ndef filterwarnings(*a, **k):\n    pass\nclass DeprecationWarning2: pass');
tryReg('abc', 'class ABC:\n    pass\ndef abstractmethod(f):\n    return f\nclass ABCMeta(type):\n    pass');
tryReg('contextvars', `class Token:
    def __init__(self, var, old): self.var = var; self.old = old
_MISSING = object()
class ContextVar:
    def __init__(self, name, default=_MISSING):
        self._name = name
        self._stack = []
        self._default = default
    def get(self, default=_MISSING):
        if self._stack: return self._stack[-1]
        if self._default is not _MISSING: return self._default
        if default is not _MISSING: return default
        raise LookupError(self._name)
    def set(self, value):
        old = self._stack[-1] if self._stack else _MISSING
        self._stack.append(value)
        return Token(self, old)
    def reset(self, token):
        if self._stack: self._stack.pop()`);
tryReg('inspect', `import sys
_cur = [None]
def _cs_set_tracker(cur): _cur[0] = cur
def currentframe():
    f = _cur[0][0] if _cur[0] else None
    return f.f_back if f is not None else None
def signature(*a, **k):
    raise NotImplementedError('inspect.signature')
def getmodule(*a, **k):
    return None`);
tryReg('typing_extensions', 'from typing import *\ndef deprecated(*a, **k):\n    def deco(f): return f\n    return deco\nSelf = object()\nParamSpec = lambda name: object()');
tryReg('dataclasses', `def field(**k):
    return k.get('default', None)
def dataclass(*a, **k):
    def wrap(cls):
        anns = getattr(cls, '__annotations__', {}) or {}
        names = list(anns.keys())
        def __init__(self, *args, **kw):
            for i, v in enumerate(args): setattr(self, names[i], v)
            for n in names[len(args):]:
                if n in kw: setattr(self, n, kw[n])
                elif hasattr(cls, n): setattr(self, n, getattr(cls, n))
            for n, v in kw.items(): setattr(self, n, v)
        cls.__init__ = __init__
        return cls
    if a and isinstance(a[0], type): return wrap(a[0])
    return wrap`);
tryReg('enum', `class _AutoVal:
    _n = [0]
    def __init__(self):
        _AutoVal._n[0] += 1
        self._value_ = _AutoVal._n[0]
        self._name_ = '?'
    @property
    def name(self): return self._name_
    @property
    def value(self): return self._value_
    def __repr__(self):
        return self._name_
def auto():
    return _AutoVal()
def unique(cls):
    return cls
class Enum:
    pass
class IntEnum(Enum):
    pass
def _finalize_enums(mod):
    # MicroPython has no metaclasses: convert class attributes after import
    for attr in dir(mod):
        cls = getattr(mod, attr)
        if isinstance(cls, type) and issubclass(cls, Enum) and cls not in (Enum, IntEnum):
            members = {}
            for k in dir(cls):
                v = getattr(cls, k)
                if isinstance(v, _AutoVal):
                    v._name_ = k
                    members[k] = v
                elif not k.startswith('_') and isinstance(v, (int, str)) and k.upper() == k:
                    inst = _AutoVal()
                    inst._name_ = k
                    inst._value_ = v
                    setattr(cls, k, inst)
                    members[k] = inst
            cls.__members__ = members
`);
// OCP Any-stub package generated from upstream's exact imports
const ocpMap = JSON.parse(fs.readFileSync('/tmp/ocp_import_map.json', 'utf8'));
try {
  mp.runPython(`
import sys
import _cs_bos as os
try: os.mkdir('/lib/OCP')
except OSError: pass
open('/lib/OCP/__init__.py', 'w').close()
`);
  for (const [mod, names] of Object.entries(ocpMap)) {
    const body = 'class _Any:\n    def __init__(self, *a, **k): pass\n    def __call__(self, *a, **k): return _Any()\n    def __getattr__(self, n): return _Any()\n' +
      names.map(n => n + ' = _Any').join('\n') + '\n';
    mp.globals.set('_OM', mod); mp.globals.set('_OB', body);
    mp.runPython("with open('/lib/OCP/' + _OM + '.py', 'w') as f: f.write(_OB)");
  }
  console.log('OCP stubs written:', Object.keys(ocpMap).length);
} catch (e) { console.log('OCPSTUB-FAIL :: ' + String(e.message||e).slice(0, 150)); }
// exact-name Any stubs for geometry + topology submodules (no PEP 562 in MicroPython)
const internalMap = JSON.parse(fs.readFileSync('/tmp/b123d_internal_map.json', 'utf8'));
const anyHeader = 'class _Any:\n    def __init__(self, *a, **k): pass\n    def __call__(self, *a, **k): return _Any()\n    def __getattr__(self, n): return _Any()\n    def __mul__(self, o): return _Any()\n    def __add__(self, o): return _Any()\n    def __iter__(self): return iter(())\n';
const KEEP_CLASS = new Set(['Shape', 'ShapeList', 'Compound', 'Curve', 'Sketch', 'Part', 'Wire', 'Edge', 'Face', 'Solid', 'Shell', 'Vertex', 'Joint', 'Comparable', 'GroupBy', 'SkipClean', 'Rotation', 'Location']);
try {
  mp.runPython(`
import sys
import _cs_bos as os
try: os.mkdir('/lib/build123d')
except OSError: pass
open('/lib/build123d/__init__.py', 'w').close()
try: os.mkdir('/lib/build123d/topology')
except OSError: pass
`);
  const topoInitNames = internalMap['build123d.topology'] || [];
  for (const [mod, names] of Object.entries(internalMap)) {
    const rel = mod.replace('build123d.', '').replace('.', '/');
    const path = '/lib/build123d/' + rel + (mod === 'build123d.topology' ? '/__init__.py' : '.py');
    const body = anyHeader + names.map(n => n + ' = _Any' + (KEEP_CLASS.has(n) ? '' : '()')).join('\n') + '\n';
    mp.globals.set('_P3', path); mp.globals.set('_B3', body);
    mp.runPython("with open(_P3, 'w') as f: f.write(_B3)");
  }
  console.log('internal stubs written');
} catch (e) { console.log('INTSTUB-FAIL :: ' + String(e.message||e).split('\n').filter(l=>l.trim()).slice(-2).join(' | ').slice(0,150)); }

function stripBuiltinGenerics(src) {
  // remove runtime-evaluated builtin generic subscriptions: list[...] -> list
  const names = ['list', 'tuple', 'dict', 'set', 'frozenset', 'type'];
  let out = src;
  for (const n of names) {
    let i = 0;
    while ((i = out.indexOf(n + '[', i)) !== -1) {
      const before = i === 0 ? ' ' : out[i - 1];
      if (/[A-Za-z0-9_.]/.test(before)) { i += n.length; continue; }
      let d = 0, j = i + n.length;
      for (; j < out.length; j++) {
        if (out[j] === '[') d++;
        else if (out[j] === ']') { d--; if (d === 0) { j++; break; } }
      }
      out = out.slice(0, i + n.length) + out.slice(j);
    }
  }
  return out;
}

// now try importing upstream modules verbatim
const order = ['build_enums.py', 'build_common.py', 'build_line.py', 'build_part.py', 'build_sketch.py', 'joints.py', 'pack.py', 'operations_generic.py', 'objects_part.py', 'operations_sketch.py'];
for (const f of order) {
  let src = fs.readFileSync(B + '/' + f, 'utf8');
  // MicroPython evaluates module-level TypeAlias assignments eagerly and has
  // no PEP 604 / builtin generics: neutralize the RHS (annotation-only use)
  src = src.replace(/^(\w+): TypeAlias = .*(?:\n(?:[ \t].*)?)*?(?=\n\w|\n$)/gm, '$1 = object');
  src = stripBuiltinGenerics(src);
  // class bases: Base[T] -> Base (runtime class subscription needs
  // metaclasses); Generic[...] is dropped entirely (its subscript resolves
  // via the typing shim to a plain base only when kept as an expression)
  src = src.replace(/^(class \s*\w+\()([^)\n]*)(\):)/gm, (m, a, bases, c) => {
    let b = bases.replace(/Generic\[[^\]]*\]\s*,?\s*/g, '').replace(/,\s*Generic\[[^\]]*\]/g, '');
    b = b.replace(/\[[^\]]*\]/g, '').replace(/,\s*$/, '');
    if (b.trim() === '') b = 'object';
    return a + b + c;
  });

  const modname = 'build123d.' + f.replace('.py', '');
  mp.globals.set('_N2', modname); mp.globals.set('_S2', src);
  try {
    mp.runPython(`
with open('/lib/build123d/' + _N2.split('.')[1] + '.py', 'w') as f: f.write(_S2)
__import__(_N2)
import sys as _sys
if _N2.endswith('build_enums'):
    import enum as _e
    _e._finalize_enums(_sys.modules[_N2])
print('IMPORT-OK ' + _N2)
`);
  } catch (e) {
    const lines = String(e.message || e).split('\n').filter(l => l.trim());
    console.log('IMPORT-FAIL ' + modname + ' :: ' + lines.slice(-3).join(' | ').slice(0, 200));
  }
}
