# build123d-lite validation harness

Validates CascadeStudio's Python mode (`build123d-lite`, running on Brython in
the CAD worker) against **real build123d** by running the upstream
documentation/examples scripts through both and comparing the geometry each
produces.

Not part of the default playwright suite — run it manually when extending
`packages/cascade-core/src/worker/Build123dLite.js`.

## How it works

1. **`collect.py`** enumerates candidate scripts from a build123d source
   clone (`B123D_SRC`, default `/tmp/b123d`): every `examples/*.py` plus the
   numbered snippets split out of `docs/general_examples.py` (builder mode)
   and `docs/general_examples_algebra.py` (algebra mode). Viewer imports
   (`ocp_vscode`) and SVG-export helpers are stripped; geometry code is kept
   verbatim. Output: `manifest.json` (script code inlined).
2. **`reference.py`** runs each script under the reference venv
   (`B123D_REF_PY`, default `~/Desktop/ocjs-deps/b123d-ref-venv/bin/python`,
   build123d 0.11.1) in a guarded subprocess (60s timeout) and records, for
   every module-level shape result — `Shape` instances, `Builder._obj`
   results and lists of Shapes, keyed by VARIABLE NAME — volume, bounding box
   (6 floats), area, face count, edge count. Scripts that fail natively are
   recorded and excluded from scoring. Output: `reference.json`.
3. **`run-lite.mjs`** (playwright) serves the built app, switches to Python
   mode and runs every script with a measurement footer appended. The footer
   calls `build123d._measure_globals_json(globals())`, which measures the
   same module-level-variable convention through the worker's
   `MeasureShape`/`BoundingBox` hooks (StandardLibrary.js; bbox comes from a
   fine 5e-4 triangulation of a deep copy because the WASM build has no
   Bnd_Box binding). Classification per script:
   - **PASS** — every reference shape matches by name: volume within 0.5%
     relative, bbox within 1e-3 per axis
   - **MISMATCH** — runs, but geometry differs (the interesting bucket)
   - **ERROR** — Python exception; bucketed by first missing feature
   - **TIMEOUT** — evaluation exceeded 60s (page is reloaded)
   - **SKIP** — reference build123d itself fails natively

   Output: `results.json` + `report.md` (status counts, sorted feature-gap
   frequency table, per-script mismatch details).

## Running

```bash
# everything (collect -> reference -> build + lite run):
test/b123d-validation/run.sh

# on this machine (headless chromium cannot create a WebGL context):
CS_TEST_HEADFUL=1 DISPLAY=:99 test/b123d-validation/run.sh

# individual stages:
test/b123d-validation/run.sh collect
test/b123d-validation/run.sh reference
CS_TEST_HEADFUL=1 DISPLAY=:99 test/b123d-validation/run.sh lite

# single script while debugging:
CS_TEST_HEADFUL=1 DISPLAY=:99 node test/b123d-validation/run-lite.mjs \
  --only general_examples_algebra/ex07
```

Env knobs: `B123D_SRC`, `B123D_REF_PY`, `B123D_REF_JOBS` (default 4),
`CS_TEST_PORT` (default 8517), `CS_TEST_HEADFUL`/`DISPLAY`.

## Current coverage

<!-- COVERAGE:BEGIN (updated by hand from report.md) -->
129 candidate scripts, 126 scored (3 excluded — real build123d fails on them
natively). On the OCCT 8.0.1 wasm build:

| Status | Count | Note |
|---|---|---|
| PASS | 85 | volume within 0.5%, bbox within 1e-3/axis, per variable |
| MISMATCH | 15 | see report.md; root causes: an 8.0.1 wasm kernel fault fusing coplanar BSpline-edged faces (ex34 ×2, examples/extrude), Plane(face) x_dir on rotated-sketch faces (boxes-on-faces family), sweep via MakePipe vs MakePipeShell profile rotation (roller_coaster), spline end-condition residuals of 0.016-0.03 mm (ex12, vase), BaseSketchObject scaling flows (custom_sketch_objects, shamrock, playing_cards ace) |
| ERROR | 26 | honest NotImplemented/unbound: surface-from-point-grid (TColgp_Array2OfPnt unbound, 2), multisection sweep (2), wasm kernel "memory access out of bounds" (tea_cup_algebra boolean over lofted BSpline body; toy_truck LocOpe_DPrism on a filleted sketch), joints, make_hull, project_to_shape, DoubleTangentArc, scipy, one-offs |
| TIMEOUT | 0 | (the old timeouts were the pre-Bnd_Box measurement cost) |

Iteration history: round 0 (pre-builders lite) 0 PASS / 126 ERROR → builders +
algebra + selectors + stdlib shims 21 → 2D fillets, hole conventions, face
orientation, CacheOp-collision fix 40 → sweep paths, cubic splines,
Plane.rotated, fused cuts 50 → OCCT 8.0.1 + exact Bnd_Box + deg→rad precision
fix 59 → Text (opentype/FreeSans + kern parity), tangent splines, thick-solid
openings, taper, Kind.INTERSECTION 71 → same-frame builder gating,
Face.offset, until=, HLR projection, pack/random shims, non-uniform scale
85. Full harness pass: ~45 s (4 pages) / ~2.5 min (single page); ALWAYS run
with CS_TEST_HEADFUL=1 DISPLAY=:99 (headless Chromium has no WebGL here — it
manifests as every script reporting "no measurement produced").
<!-- COVERAGE:END -->

## Notes / caveats

- Comparison is **by variable name**, so a shape must end up in the same
  module-level variable in both runs. Builder variables are measured via
  their result object (`_obj`), matching build123d's `BuildSketch._obj ==
  sketch_local` (LOCAL coordinates) semantics.
- Face/edge counts are recorded but NOT part of the pass criterion: the
  CascadeStudio standard library always runs ShapeUpgrade_UnifySameDomain
  after booleans, so counts legitimately differ from build123d.
- `Spline()` in lite approximates (GeomAPI_PointsToBSpline, 1e-3) instead of
  interpolating; scripts whose geometry depends on splines can land in
  MISMATCH with small volume deltas even though they are "working".
- The 10 best representative passing scripts are frozen as regression tests
  in `test/python-mode-examples.spec.js` (part of the default suite).
