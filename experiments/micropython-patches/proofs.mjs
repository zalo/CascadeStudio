// proofs.mjs — node micro-proofs for the four micropython-cs interpreter
// patches (see packages/cascade-core/vendor/micropython-cs/PROVENANCE.md).
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
