# Vendored upstream build123d 0.11.1 (Level-A sources)

Provenance: the unmodified `build123d/*.py` module files from the
**build123d 0.11.1** release as published on PyPI (pip sdist/wheel,
`pip download build123d==0.11.1`), verified byte-identical to the
`build123d-0.11.1.dist-info` install in the local reference venv that
`test/b123d-validation` compares against. `LICENSE` and `NOTICE` are
upstream's (Apache-2.0). No files are modified: the mechanical,
version-robust source transforms (TypeAlias/match/list-splat/generics
rewrites) are applied at load time by
`packages/cascade-core/src/worker/UpstreamB123d.js`.

Only the Level-A layer is vendored (builders, objects, operations, joints,
pack — see `UPSTREAM_LEVEL_A`/`UPSTREAM_STRETCH` in UpstreamB123d.js);
`geometry.py` and the `topology/` package are NOT: they are replaced by
build123d-lite's classes re-exported through the seam adapters in
`packages/cascade-core/upstream-py/build123d/`.

These files are COMMITTED (not gitignored) so the MicroPython runtime's
default source layer (`?pyruntime=micropython` → upstream) is deterministic
on fresh checkouts and deploys. To bump the vendored version, point
`B123D_SRC` at a newer source tree and run:

```bash
node packages/cascade-core/scripts/fetch-upstream-b123d.cjs
```

then re-run the validation harness (`test/b123d-validation/run-lite.mjs`
with `CS_PY_RUNTIME=micropython`).
