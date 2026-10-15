# Precompiled .mpy for the upstream flavor — measurement harness

Not wired into the product (see FIDELITY-ON-WORKERS.md §3 for numbers and
what integration would take). Reproduce:

1. `CF_DIST=<a cascade-core dist copy> node dump-lib.mjs` — boots the upstream
   flavor headless and dumps the TRANSFORMED Python tree the loader wrote into
   MEMFS (/lib, 155 modules) to /tmp/cf-upy/lib (edit the paths at the top).
2. `mpy-cross` (built from the same micropython-cs tree:
   `make -C mpy-cross`) every file into /tmp/cf-upy/mpy.
3. `node compile-time.mjs` — time `compile()` of all 155 sources on the wasm
   interpreter (the cost .mpy removes).
4. `mpy-boot.mjs` — end-to-end upstream boot from source vs from .mpy. Needs a
   dist copy whose cascade-headless.mjs calls `globalThis.__csMpyHook(mp)` right
   after the interpreter loads (one-line patch after `installProxyFreeHook()`);
   the hook writes the .mpy tree into MEMFS and makes the loader's .py writes
   no-ops where a .mpy exists, so MicroPython imports the bytecode.
