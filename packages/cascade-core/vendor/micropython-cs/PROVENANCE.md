# micropython-cs — custom MicroPython wasm build for CascadeStudio

Custom-patched MicroPython WebAssembly artifacts (pyscript variant), preferred
by `MicroPythonRuntime.js` over the stock npm settrace artifacts when present
in `dist/` (see the build script's copy step and the runtime's probe).

## Base

- MicroPython **v1.28.0**, tag commit `e0e9fbb` — the same source release the
  npm package `@micropython/micropython-webassembly-pyscript@1.28.0-6`
  (the stock artifacts CascadeStudio falls back to) was built from.
- Local patched checkout: `~/Desktop/micropython-cs`.

## Patches applied (in order, on top of e0e9fbb)

| SHA | Patch |
|---|---|
| `0ddab14` | py/objtype: Support nested tuples in isinstance/issubclass classinfo. |
| `b8cd6c2` | py/mpconfig: Enable high-quality float hash at full-features ROM level. |
| `84b32a9` | py/objlist: Add a stable merge sort for list.sort() and sorted(). |
| `0c13823` | py/modsys: Add sys._getframe(), with frames built on demand. |
| `75cfbb6` | ports/webassembly: Append CFLAGS_EXTRA to CFLAGS. |
| `68d0e32` | py/objfloat: Fold high float bits into the hash on narrow mp_int_t. |
| `2a4a92e` | py/objtype: Support custom metaclasses (subclasses of type). |
| `9e360ce` | py/modbuiltins: Support metaclass= and class keywords in __build_class__. |
| `83f1550` | ports/webassembly: Convert out-of-int32 integral JS numbers as floats. |
| `7f63764` | ports/webassembly: Append JSFLAGS_EXTRA to JSFLAGS. |

What they give this runtime (each feature-detected in browser.py /
Build123dLite.js, so the stock artifacts keep working):

- **`sys._getframe(depth)`** — frames built on demand from the code-state
  chain the settrace feature maintains; identity-stable per activation, LIVE
  `f_lineno`, `f_back` materialized on demand. With it, browser.py installs
  NO trace function, removing both the trace-callback tax (~3.5x on
  pure-Python loops) and the hidden eager per-call frame allocation of
  settrace builds (measured 58–92x on call-heavy pure-Python code on the
  unix port).
- **Nested classinfo tuples** in `isinstance`/`issubclass` (CPython
  semantics; previously silently `False`).
- **Well-distributed float hashing** (high-quality hash enabled at the
  full-features ROM level + a high-bits fold for 32-bit `mp_int_t`): fixes
  the ~100x set-probing degradation on float/coordinate-tuple keys.
- **Stable `list.sort()`/`sorted()`** (bottom-up merge sort, key called once
  per element) — `_stable_sorted`'s probe detects this and takes the native
  path.
- **Custom metaclasses** (`MICROPY_PY_METACLASSES`, on at the pyscript ROM
  level): `class M(type)` creates a real metatype whose instances are types,
  `class X(B, metaclass=M)` works (explicit kwarg wins, else CPython's
  most-derived rule over the bases; extra class keywords reach the
  metaclass), class creation runs through the metaclass
  `__call__`/`__new__`/`__init__` chain (`type.__new__`/`__call__`/
  `__init__` exist as the terminal supers), and class-level attribute/
  subscript/iteration/`in`/`len` dispatch falls back to the metaclass with
  the descriptor protocol (metaclass properties = class properties).  With
  it, the upstream-b123d shims switch to a real metaclass `enum.EnumMeta`
  and a `Generic` whose metaclass `__getitem__` makes `class B(Builder[T])`
  legal, retiring the class-base-subscript transform and the
  `_finalize_enums` post-import pass (both feature-detected — the stock
  artifacts keep the old paths).  Out of scope: `__init_subclass__`,
  `__mro_entries__`, metaclass `__instancecheck__`/`__subclasscheck__`,
  metaclass data descriptors intercepting class-attribute stores.

- **Out-of-int32 integral JS numbers convert as floats** (`83f1550`):
  upstream jsffi converts any JS number with `Number.isInteger(x)` through
  the i32 proxy kind, so integral doubles >= 2^31 crossed into Python
  WRAPPED (1e15 -> -1530494976) and huge integral doubles as 0 (1e100 -> 0
  -- which silently degenerated OCCT's +-Precision::Infinite parameter
  ranges, found via upstream `Edge(Axis)` in Stage 3). Out-of-int32
  integral numbers now take the DOUBLE path (CPython/Pyodide semantics).
  Test: tests/ports/webassembly/int_large.mjs. (First shipped as a
  hand-edit of the vendored artifact; the artifacts are now built from the
  source commit.)
- **JSFLAGS_EXTRA** (`7f63764`): build-machinery only (profiling builds
  pass --profiling-funcs without overriding the port's required link
  flags).

Measured and NOT adopted (2026-08-21 Stage-3 perf round):
`-DMICROPY_OPT_COMPUTED_GOTO=1` (~4% on the b01 hot loop, br_table gains
are small in wasm engines) and `-O3` over `-Os` (~3% more, +18% wasm
size). The real hot-loop win was BRIDGE-protocol work in the app tree
(the variadic no-proxy fast path — b01 148 s → 18 s), not codegen.

## Post-build glue patch (headless / Cloudflare Workers)

`micropython.mjs` here carries ONE hand-applied edit on top of the build
output, needed by the headless entry point (`src/headless.js`): the stock
`loadMicroPython(options)` destructures a fixed option list and builds its
own Emscripten `Module`, so there is no way to reach `Module.instantiateWasm`
— which is the ONLY way to boot the interpreter on Cloudflare Workers, where
wasm arrives as an already-compiled `WebAssembly.Module` binding and
`WebAssembly.compile()` is forbidden. The patch is a single statement
appended right after the `let Module = {locateFile: …};` line:

```js
options.instantiateWasm && (Module.instantiateWasm = options.instantiateWasm);
```

Re-apply it after any rebuild (grep the .mjs for `options.instantiateWasm`).
Everything else about the artifact is unchanged, and omitting the option
keeps the original `url`-based path byte-for-byte.

## Build command

```bash
source ~/Desktop/ocjs-deps/emsdk/emsdk_env.sh   # emsdk 4.0.23
cd ~/Desktop/micropython-cs
make -C ports/webassembly submodules
make -C ports/webassembly -j16 min VARIANT=pyscript BUILD=build-pyscript-settrace \
  CFLAGS_EXTRA="-DMICROPY_PY_SYS_SETTRACE=1" \
  EXPORTED_RUNTIME_METHODS_EXTRA=",PATH,PATH_FS,UTF8ToString,getValue,lengthBytesUTF8,setValue,stringToUTF8,HEAPU8"
cp ports/webassembly/build-pyscript-settrace/micropython.min.mjs <here>/micropython.mjs
cp ports/webassembly/build-pyscript-settrace/micropython.wasm    <here>/micropython.wasm
```

Notes:
- `MICROPY_PY_SYS_SETTRACE=1` also enables `MICROPY_PY_SYS_GETFRAME` (its
  default is on when settrace is on). The settrace path stays available as
  browser.py's fallback for the stock artifacts.
- `HEAPU8` must be in `EXPORTED_RUNTIME_METHODS`: emsdk 4.x no longer
  exports it by default and `CascadeWorker.memoryStats()` reads
  `_module.HEAPU8.length`. (The other names replicate the port Makefile's
  default list, since a command-line variable overrides its `+=`.)
- `micropython.mjs` here is the terser-minified `micropython.min.mjs`
  (`--compress --module`), matching how the npm artifact is packaged.

## Sizes

| file | raw | gzip -9 |
|---|---|---|
| micropython.mjs | 108 KB | 30 KB |
| micropython.wasm | 486 KB (483 KB before metaclasses: +3067 B, +0.63%) | 207 KB |
| (npm settrace pair for comparison) | 108 + 489 KB | ~228 KB combined |

## License

MicroPython is MIT-licensed (Copyright (c) 2013-2025 Damien P. George and
contributors); these artifacts are compiled from the base release plus the
patches above and are redistributed under the same MIT license.
