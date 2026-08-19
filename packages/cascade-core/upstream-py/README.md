# upstream-py — the `?pysrc=upstream` source layer

Python sources for the experimental **upstream-build123d-on-MicroPython**
mode (`?pyruntime=micropython&pysrc=upstream`): UPSTREAM build123d 0.11.1
Level-A source runs verbatim (after mechanical transforms) on the MicroPython
runtime, over build123d-lite's classes re-exported as upstream's
`build123d.geometry` / `build123d.topology[.*]` seam.

- `shims/` — stdlib shims MicroPython lacks (typing, metaclass-free enum,
  contextvars, inspect-over-settrace, ...). Registered via `sys.modules`
  aliasing (MicroPython builtins shadow `/lib`).
- `build123d/` — the seam adapter package: `geometry.py` and
  `topology/__init__.py` re-export lite's classes under upstream's names and
  install the (additive, upstream-boot-only) patches lite needs to serve
  upstream's call surface; `_finalize.py` populates the package namespace and
  the worker's reset hook. Every adaptation is catalogued in
  `experiments/upstream-on-micropython/INVENTORY.md`.
- `ocp_import_map.json` — the OCP names build123d imports, used to generate
  inert OCP stubs (`OCP.Standard`/`OCP.StdFail` become real Exception
  subclasses; `OCP.GccEnt` values ints).
- `manifest.json` — shim registration order.

The UPSTREAM sources themselves are NOT committed: run
`node packages/cascade-core/scripts/fetch-upstream-b123d.cjs` (gitignored
`vendor/build123d-0.11.1/`), then `npm run build` copies everything to
`dist/upstream-b123d/`. Loader + source transforms:
`packages/cascade-core/src/worker/UpstreamB123d.js`. Frozen contract:
`test/py-src-upstream.spec.js` (skips when not vendored).

Iterate in node (no build, semantic mock of the CAD library):
`node experiments/upstream-on-micropython/upstream-poc.mjs [script.py]`.
Diff real examples against lite in the browser:
`CS_TEST_HEADFUL=1 DISPLAY=:99 node experiments/upstream-on-micropython/compare-examples.mjs examples/lego ...`
