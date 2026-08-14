# build123d-lite validation harness

Validates CascadeStudio's Python mode (`build123d-lite`, running on Brython in
the CAD worker) against **real build123d** by running the upstream
documentation/examples scripts through both and comparing the geometry each
produces.

Not part of the default playwright suite — run it manually when extending
`packages/cascade-core/src/worker/Build123dLite.js`.

## How it works

1. **`collect.py`** enumerates candidate scripts from a build123d source
   clone (`B123D_SRC`, default `/tmp/b123d`) — **everything runnable in
   `examples/` and `docs/`**:
   - every `examples/*.py`;
   - the numbered snippets split out of `docs/general_examples.py` (builder
     mode) and `docs/general_examples_algebra.py` (algebra mode);
   - the standalone documentation scripts `docs/*.py` (`objects_1d/2d/3d`,
     `tutorial_joints`, `slide_latch`, `rod_end`, `heart_token`,
     `spitfire_wing_gordon`, `technical_drawing`, …),
     `docs/objects/examples/*.py` and `docs/topology_selection/examples/*.py`;
   - the 13 **Too Tall Toby** challenge parts in `docs/assets/ttt/*.py`, whose
     closing `assert abs(got_mass - want_mass) < tolerance` is kept verbatim —
     a ~0.1% bar that a script must clear on its own;
   - every ``code-block:: build123d`` / ``python`` snippet in `docs/**/*.rst`,
     plus one cumulative script per page (what a reader pasting a whole
     tutorial page actually runs). `>>>` doctest transcripts are unwrapped.

   Viewer imports (`ocp_vscode`) and viewer-only calls are stripped
   statement-wise (a multi-line `write_svg(...)` goes as a whole); SVG/DXF
   export machinery is left in place, since lite ships a no-op `ExportSVG` and
   the reference run gets a scratch `assets/` directory. Output:
   `manifest-all.json` (382 candidates, code inlined).
2. **`reference.py`** runs each candidate under the reference venv
   (`B123D_REF_PY`, default `~/Desktop/ocjs-deps/b123d-ref-venv/bin/python`,
   build123d 0.11.1) in a guarded subprocess (60s timeout, scratch cwd with
   `__file__` set and the script's non-`.py` siblings symlinked in) and
   records, for every module-level shape result — `Shape` instances,
   `Builder._obj` results and lists of Shapes, keyed by VARIABLE NAME —
   volume, bounding box (6 floats), area, face count, edge count. Scripts that
   fail natively are recorded and excluded from scoring.
   Output: `reference-all.json`.

   `collect.py prune` then writes the **scored corpus**, `manifest.json` +
   `reference.json`: real scripts are always kept (a native failure becomes a
   SKIP), while `.rst` fragments that produced no geometry natively — `...`
   placeholders, prose pseudo-code, snippets that only print — are dropped,
   because they were never runnable code. 382 candidates → **232 scripts**.
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

## Canonical free edges (cross-kernel check)

build123d-lite implements the upstream **canonical free-edge parametrization**
proposal — research record, patch and reproduction scripts now live with the
build123d contribution itself, on
[zalo/build123d branch `canonical-research`](https://github.com/zalo/build123d/tree/canonical-research/research)
(`research/`). A free edge (section / projection / boolean
output) inherits a seam, direction and parameter range that depend on the
*parametric frames* of the operand surfaces, so `position_at(0)` and
`Axis(edge)` move when a geometrically identical solid is re-framed;
`edge.canonical()` replaces those with a rule computed from geometry alone.
Lite ports the rule with the same names and the same defaults: `canonical()`,
`Axis(edge, canonical=True)` and `sort_by(..., tie_break=True)` are opt-in — the
default sort stays a plain stable sort, because ties carrying the incoming order
is itself a contract that chained sorts rely on — while
`Edge.make_mid_way`'s canonicalization is unconditional.

`canonical-cross-kernel.mjs` checks lite's `canonical()` on **OCCT 8.0.1 (wasm)**
against **patched upstream build123d 0.11.1 on OCP 7.9.3**, over three
constructions: the `examples/projection.py` arch (a sphere ∩ cylinder section
loop, 5 sphere frames), a sphere ∩ cylinder locus reassembled with
`edges_to_wires` (each kernel chops it into a different NUMBER of edges), and
`examples/joints.py`'s `make_mid_way` slider axis (3 cutter frames).

```bash
# 1. reference side (patched build123d on OCP 7.9.3), in a checkout of the
#    research branch: git clone -b canonical-research https://github.com/zalo/build123d
cd <build123d-canonical-research>/research/experiments && ./repatch.sh
PYTHONPATH=/tmp/b123d-0111 ~/Desktop/ocjs-deps/b123d-ref-venv/bin/python \
  lite_cross_kernel.py > canonical-lite-reference.json

# 2. lite side + diff (needs `npm run build`); point the harness at that JSON
CS_TEST_HEADFUL=1 DISPLAY=:99 B123D_CANONICAL_REFERENCE=<...>/canonical-lite-reference.json \
  node test/b123d-validation/canonical-cross-kernel.mjs
```

Result (committed in `canonical-cross-kernel.json`): **185 canonical
measurements, worst delta 0.00e+0 mm**, against 5 recorded raw (pre-canonical)
kernel differences — which is the premise, not a failure. The harness also checks
frame consistency *inside* each kernel, and all three cases are consistent in
both.

That frame-consistency check earned its keep: it caught the patch failing its own
premise (reversing a reassembled section Wire canonicalized to the other seam of
the loop, winding the other way — reproducible on OCP 7.9.3 alone), which the
patch author fixed in three places, now mirrored here. See REPORT.md §3.3 for the
numbers: a circular "already canonical" test at band-width resolution, a
`_walk_loop` ranking that consults the tangent before the noise-scale gap, and
band discovery by local minima with midpoints ranked on quantised coordinates.
The lite port had a fourth instance of the same species — `_reverse_1d` flipped a
Wire's orientation flag, which `Curve._walk` ignores — so a Wire is now rebuilt
from its edges in reverse order. The canonical seams of loops whose extremal band
comes in a mirror-symmetric pair moved as a result, and the expectations here were
regenerated.

The rule itself is frozen in `test/python-mode-canonical.spec.js` (part of the
default suite), including a section loop asserted against hand-computed values.

## Current coverage

<!-- COVERAGE:BEGIN (updated by hand from report.md) -->
382 candidates → **232 scripts** in the scored corpus, 222 scored (10 excluded —
real build123d fails on them natively). On the OCCT 8.0.1 wasm build:

| Status | Count | Note |
|---|---|---|
| PASS | 204 | volume within 0.5%, bbox within 1e-3/axis, per variable |
| MISMATCH | 8 | joints x2 + projection x2 + sort_axis — COMPROMISE(edge-orientation); filter_all_edges_circle + tips/b04 — COMPROMISE(traversal-order) (a mirror-symmetric pair / a fully TIED sort_by); objects_1d — COMPROMISE(triad-labels) |
| ERROR | 9 | the `drafting` module x1 (objects_2d), `import_step` x2, `full_round` x1 (needs a 2-D Voronoi), sm_hanger x1 (1-D wire fillet + `make_brake_formed`), `sympy` x1, 3MF export x1, and 2 kernel faults (toy_truck fillet, ttt-ppp0110 fuse) |
| TIMEOUT | 1 | spitfire_wing_gordon: reaches the wing Gordon surface, which needs ~390 s here (harness budget 60 s) and then returns a null surface |
| SKIP | 10 | real build123d 0.11.1 fails natively (`bd_warehouse` x3, `ImageFace`, `ColorMap`, `tcv_screenshots`, no module-level shapes) |

Every non-PASS is root-caused in the **defaults-audit table** appended to
report.md. Iteration on the broadened corpus: 158 PASS on the first pass →
Select.LAST/NEW + `new_edges` + module-level context selectors → `os` shim →
FilletPolyline / IntersectingLine / SlotCenterPoint / LengthMode / partial
Sphere / `Edge.radius`/`is_interior`/`find_tangent`/`make_circle` / `Axis(
Location)` / `Shell.extrude` / `Compound.make_triad` → builder-scoped location
contexts → property selectors → **177** → topology-selection properties
(`Face.is_circular_convex`/`center_location`, `Mixin1D.normal`,
`param_at_point`, `Shape.distance*`, `GroupBy.group`) + an EXACT convex hull
→ 185 → the 1-D analytic objects (BSpline, parabolic/hyperbolic arcs,
EllipticalStartArc, BlendCurve, Airfoil, Triangle) → 194 → Wedge,
ConvexPolyhedron, text-on-path, `topo_distance_to`, `pytest.approx` and the
position_at/circle-edge/copy-snapshot fidelity fixes → 199 → 2-D face offsets +
BuildSketch's face alignment → 201 → upstream's taper-extrude branch → 202 →
closed-form ConstrainedArcs/ConstrainedLines for circle/point targets → **204**.

<details><summary>previous corpus (129 candidates / 126 scored)</summary>

| Status | Count | Note |
|---|---|---|
| PASS | 119 | volume within 0.5%, bbox within 1e-3/axis, per variable |
| MISMATCH | 4 | all COMPROMISE(edge-orientation): joints x2, projection x2 |
| ERROR | 3 | two fillet kernel faults (cast_bearing_unit — since root-caused to lite's simplified hull and now PASSING — and toy_truck) + the 3MF export gap |
| TIMEOUT | 0 | |

Iteration history: round 0 (pre-builders lite) 0 PASS / 126 ERROR → builders +
algebra + selectors + stdlib shims 21 → 2D fillets, hole conventions, face
orientation, CacheOp-collision fix 40 → sweep paths, cubic splines,
Plane.rotated, fused cuts 50 → OCCT 8.0.1 + exact Bnd_Box + deg→rad precision
fix 59 → Text (opentype/FreeSans + kern parity), tangent splines, thick-solid
openings, taper, Kind.INTERSECTION 71 → same-frame builder gating,
Face.offset, until=, HLR projection, pack/random shims, non-uniform scale
85 → exact GeomAPI_Interpolate splines, MakePipeShell sweeps (multisection/
normal/binormal), section/make_hull/draft/project, joints, scipy shim +
DoubleTangentArc, surface-from-points, Mesher STL, baked uniform scale,
Text2D cache fix, kernel-fault guards 110 → exact PointsToBSplineSurface
(AsGeomSurface), quickhull3d ConvexHull, thicken, general-fuse fallback for
the coplanar fuse operand-drop fault, per-glyph +Z text normals (conditional
reverse), make_text align=None parity, arc-length position_at
(GCPnts_AbscissaPoint), per-contour glyph faces (i/j dots),
find_intersection_points + project_faces 117 → Gordon curve-network surfaces
(ocp_gordon port + least-squares realization), surface location_at/normal_at,
wire project_to_shape, planar Face(wire) → **bracelet** 118 → wrap()/
wrap_faces(), Face.make_surface, Edge.make_spline/param_at/trim, Trapezoid
obtuse-angle fix, make_face clean parity → **bicycle_tire** 119 → one-sided
open-line offsets (offset(side=)) → dual_color_3mf geometry (still ERROR on
its 3MF write).

</details>

Full harness pass: ~150 s (4 pages, 232 scripts) / ~5 min single-page; a full
`reference.py` sweep of the 382 candidates is ~90 s with `--jobs 12`. ALWAYS run
the lite stage with CS_TEST_HEADFUL=1 DISPLAY=:99 (headless Chromium has no
WebGL here — it manifests as every script reporting "no measurement produced").
<!-- COVERAGE:END -->

## Notes / caveats

- Comparison is **by variable name**, so a shape must end up in the same
  module-level variable in both runs. Builder variables are measured via
  their result object (`_obj`), matching build123d's `BuildSketch._obj ==
  sketch_local` (LOCAL coordinates) semantics.
- Face/edge counts are recorded but NOT part of the pass criterion: the
  CascadeStudio standard library always runs ShapeUpgrade_UnifySameDomain
  after booleans, so counts legitimately differ from build123d.
- Every deliberate deviation from upstream is marked in source with a
  grep-able `COMPROMISE(<topic>)` comment (see CLAUDE.md's "Known
  compromises" list for the index).
- Debug a single script with
  `CS_TEST_HEADFUL=1 DISPLAY=:99 node test/b123d-validation/probe.mjs
  [--id <manifest id> | /path/to/snippet.py]` — prints the raw measurement
  JSON, worker errors and the last console lines.
- After a raw wasm kernel abort ("memory access out of bounds") the OCCT
  heap is corrupt; run-lite.mjs recycles the page before the next script.
- **50** representative passing scripts are frozen as regression tests in
  `test/python-mode-examples.spec.js` (part of the default suite) — including
  seven Too Tall Toby challenge parts (their own mass asserts run too), the
  `new_edges` / context-selector / `is_interior` / `FilletPolyline` doc blocks,
  the two "Locations around a builder" cases and, since this round, five
  landmarks for the new machinery: `Wedge`/`ConvexPolyhedron` (objects_3d),
  `Triangle` (tutorial_constraints/b03), the parabolic/hyperbolic arcs,
  slide_latch (sketch-face alignment + Select.LAST vertices) and
  group_properties_with_keys (copy snapshots + the exact hull + GroupBy.group).
