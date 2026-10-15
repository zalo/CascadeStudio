# Vendored upstream build123d 0.13.0 sources

Provenance: the unmodified `build123d/*.py` module files of the **build123d 0.13.0** release (PyPI 2026-09-21; gumyr/build123d tag `v0.13.0`, commit 38effd34 — the OCP/OCCT 8.0.1 port, PR gumyr/build123d#1442), copied from a git checkout of the tag and verified byte-identical to the PyPI wheel installed in the local 0.13.0 reference venv (`~/Desktop/ocjs-deps/b123d-013-venv`) that `test/b123d-validation` compares against. `LICENSE` and `NOTICE` are upstream's (Apache-2.0).

Vendored: the Level-A layer (builders, objects, operations, joints, pack) AND geometry.py + the whole `topology/` package — under the default `pytopo=upstream` these run VERBATIM over the OCP-over-embind shim (`packages/cascade-core/upstream-py/ocp_shim/`).

Copied by `packages/cascade-core/scripts/fetch-upstream-b123d.cjs`.
License: Apache-2.0 (see LICENSE/NOTICE in this directory). No file is
modified: the mechanical, version-robust source transforms are applied
at load time by `packages/cascade-core/src/worker/UpstreamB123d.js`.

The ACTIVE vendored version is selected by the single constant
`ACTIVE_UPSTREAM_VENDOR` in UpstreamB123d.js. To bump: vendor the new
tree with this script, flip the constant (+ the per-vendor module list),
re-bill the OCP surface (experiments/upstream-topology-spike/
extract_ocp_bill.py + gen-ocp-shim.mjs) and re-run the validation
harness (`CS_PY_RUNTIME=micropython CS_PY_SRC=upstream`).
