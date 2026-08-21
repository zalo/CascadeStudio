// proofs.mjs — node micro-proofs for the micropython-cs interpreter patches
// (see packages/cascade-core/vendor/micropython-cs/PROVENANCE.md).
// Runs the VENDORED custom artifacts and, for comparison, the stock npm
// settrace artifacts. Usage:  node experiments/micropython-patches/proofs.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CUSTOM = join(ROOT, 'packages', 'cascade-core', 'vendor', 'micropython-cs');
const STOCK = join(ROOT, 'node_modules', '@micropython', 'micropython-webassembly-pyscript');

async function boot(mjs, wasm) {
  const mod = await import(mjs);
  return mod.loadMicroPython({ url: wasm, heapsize: 8 * 1024 * 1024 });
}

const PROOFS = `
import sys, time

# ---- patch 1: sys._getframe — identity-stable frames, LIVE f_lineno ----
ok = hasattr(sys, '_getframe')
print('getframe present:', ok)
if ok:
    def g():
        f = sys._getframe(0)
        r1 = sys._getframe(0) is f            # identity stable
        r2 = f.f_back.f_code.co_name == 'caller'
        a = f.f_lineno
        b = f.f_lineno                        # next line -> lineno moved
        return r1, r2, b - a == 1
    def caller():
        return g()
    print('getframe identity/back/live-lineno:', caller())
    try:
        sys._getframe(99)
        print('getframe depth check: FAIL')
    except ValueError:
        print('getframe depth ValueError: True')

# settrace-tax proof: call-heavy pure Python with NO trace installed
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
t0 = time.time()
fib(20)
print('fib(20) ms:', round((time.time() - t0) * 1000.0, 1))

# ---- patch 2: nested isinstance/issubclass classinfo tuples ----
class A: pass
class B(A): pass
print('nested isinstance:', isinstance(1.5, (int, (float, str))),
      isinstance('x', (int, (float, str))),
      isinstance(B(), (int, (str, A))),
      issubclass(B, ((A,),)))

# ---- patch 3: float hashing ----
print('hash int-parity:', hash(1.0) == hash(1), hash(-12.0) == hash(-12), hash(0.0) == 0)
print('hash dyadic distinct:', len({hash(i / 64.0) for i in range(1, 64)}))
print('hash tenths distinct:', len({hash(i / 10.0) for i in range(520)}))
keys = [(i / 1000.0, (i * 13 % 511) / 1000.0, (i * 7 % 511) / 1000.0) for i in range(512)]
t0 = time.time()
s = set(keys)
n = 0
for k in keys:
    if k in s:
        n += 1
print('float-set 512 build+probe ms:', round((time.time() - t0) * 1000.0, 1), 'hits:', n)

# ---- patch 4: stable sort, key called once per element ----
l = [(0, 'a'), (1, 'b'), (0, 'c'), (1, 'd'), (0, 'e')]
print('sort stable:', sorted(l, key=lambda t: t[0]))
print('sort stable rev:', sorted(l, key=lambda t: t[0], reverse=True))
calls = []
def key_fn(x):
    calls.append(x)
    return x % 3
sorted([5, 3, 1, 4, 2, 0], key=key_fn)
print('key called once per element:', len(calls) == 6)
data = [((i * 137) % 997, i) for i in range(4000)]
t0 = time.time()
sorted(data, key=lambda t: t[0])
print('sorted 4000 w/key ms:', round((time.time() - t0) * 1000.0, 1))

# ---- patch 5: custom metaclasses (feature-detected like the CS shims) ----
class _PM(type):
    pass
try:
    exec("class _PC(metaclass=_PM):\\n    pass")
    _has_meta = True
except TypeError:
    _has_meta = False
print('metaclasses present:', _has_meta)
if _has_meta:
    # AxisMeta-style class properties
    class AxisMeta(type):
        @property
        def X(cls):
            return cls((1, 0, 0))
    src = '''
class Axis(metaclass=AxisMeta):
    def __init__(self, d):
        self.d = d
print('meta class-property:', Axis.X.d, Axis.X is not Axis.X, type(Axis) is AxisMeta)

# BaseObjectMeta-style __call__ firewall + super().__call__
class Fire(type):
    seen = []
    def __call__(cls, *a, **k):
        Fire.seen.append(cls.__name__)
        return super().__call__(*a, **k)
class FObj(metaclass=Fire):
    def __init__(self, v=0):
        self.v = v
class FBox(FObj):
    pass
b = FBox(7)
print('meta call-firewall:', b.v, Fire.seen, type(FBox) is Fire)

# EnumMeta-style __new__ synthesis + class __getitem__/__iter__/__contains__
class EMeta(type):
    def __new__(mcs, name, bases, ns):
        cls = super().__new__(mcs, name, bases, ns)
        cls._members_ = {}
        for k in sorted(ns):
            if not k.startswith('_') and isinstance(ns[k], int):
                m = object.__new__(cls)
                m._name_ = k
                setattr(cls, k, m)
                cls._members_[k] = m
        return cls
    def __getitem__(cls, k):
        return cls._members_[k]
    def __iter__(cls):
        return iter(sorted(cls._members_))
    def __contains__(cls, m):
        return m in cls._members_.values()
class Color(metaclass=EMeta):
    RED = 1
    GREEN = 2
print('meta enum-style:', Color['RED'] is Color.RED, list(Color),
      Color.GREEN in Color, isinstance(Color.RED, Color))

# Generic[T]-style base-list subscription via metaclass __getitem__
class GMeta(type):
    def __getitem__(cls, item):
        return cls
class Generic(metaclass=GMeta):
    pass
class Builder(Generic):
    pass
class BuildPart(Builder[int]):
    pass
print('meta base-subscript:', BuildPart.__bases__ == (Builder,),
      type(BuildPart) is GMeta)

# metaclass inheritance + most-derived rule + conflicts
class M2(Fire):
    pass
class D(FBox, metaclass=M2):
    pass
print('meta most-derived:', type(D) is M2)
try:
    class Bad(FObj, metaclass=GMeta):
        pass
    print('meta conflict: FAIL')
except TypeError:
    print('meta conflict: TypeError')
'''
    exec(src)
`;

for (const [name, mjs, wasm] of [
  ['CUSTOM micropython-cs', join(CUSTOM, 'micropython.mjs'), join(CUSTOM, 'micropython.wasm')],
  ['STOCK npm settrace   ', join(STOCK, 'micropython.mjs'), join(STOCK, 'micropython-settrace.wasm')],
]) {
  console.log('\n===== ' + name + ' =====');
  const mp = await boot(mjs, wasm);
  // stock comparison: install the tracer like the settrace fallback does,
  // so its fib number reflects what CascadeStudio actually pays there
  if (name.startsWith('STOCK')) {
    mp.runPython('import sys\n' +
      'def _tr(f, e, a):\n    return _tr\n' +
      "sys.settrace(_tr)\n");
  }
  mp.runPython(PROOFS);
}
console.log('\nAll proofs ran.');
