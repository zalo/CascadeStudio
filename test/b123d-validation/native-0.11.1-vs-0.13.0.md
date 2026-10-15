# Native build123d 0.11.1 → 0.13.0: what changed in REAL build123d's own geometry

build123d 0.13.0 (PyPI, 2026-09-21) is 0.12.0's features + a port to
OCP/OCCT 8.0.1 — the same OCCT version as CascadeStudio's wasm kernel. This
report answers, independently of lite: **for every script in the validation
corpus, did native build123d's geometry change between 0.11.1 (OCP 7.9.3) and
0.13.0 (OCP 8.0.1), and why?** It also records the "before" numbers of the
unmodified browser legs against the new reference (§7).

## TL;DR

- **The kernel bump changed nothing measurable.** 0.12.0 and 0.13.0 share
  their Python API and differ only in OCP 7.9.3 → 8.0.1. On identical code
  they agree on 238 of 239 scored scripts (217 identical within 1e-9 /
  1e-7, 21 with float drift ≤ 1e-6 — one bbox at 9.6e-4); the single
  "change" is `docs-rst/tips/b04`, which is **natively nondeterministic** in
  every version (§4).
- **The edge-orientation / traversal-order set did NOT move.** `joints` x2,
  `projection` x2, `sort_axis` and `filter_all_edges_circle` give
  byte-identical native answers on OCP 7.9.3 (0.11.1 and 0.12.0) and on OCP
  8.0.1 (0.13.0). The premise of COMPROMISE(edge-orientation) /
  COMPROMISE(traversal-order) — "OCP 7.x vs our 8.0.1" — is refuted: native
  8.0.1 reproduces 7.9.3's answer, so lite's differing answer comes from
  lite's construction, not the kernel version (consistent with the Stage-3
  upstream topology resolving them on the same wasm kernel).
- **All real geometry changes are 0.12 semantics.** On identical code,
  0.11.1 → 0.13.0 changes geometry in **6 scripts** of the 0.11.1-era corpus
  and **4** of the 0.13.0 corpus (plus the tips/b04 coin flip); every one is
  reproduced by 0.12.0 on OCP 7.9.3:
  `Locations` now positions a builder (key_concepts_builder x2),
  variables created inside a `BuildLine(<workplane>)` are now LOCAL
  (sm_hanger, objects_1d), `sweep(path=<BuildLine>)` now sweeps the
  builder's LOCAL line (ttt-ppp0102, +1.4%), and `project()`'s pending
  planes now follow each projected face's orientation so the far-side
  projection is extruded INTO the part (maker_coin, −1.2%).
- **API breaks hit the docs, not the old scripts.** None of the 0.11.1-era
  corpus scripts uses a removed API (0 newly-failing when the OLD code runs on
  0.13.0). But the 0.13.0 docs/examples were migrated to the new API, so 30
  new-corpus scripts cannot run on 0.11.1 — `insert()` alone accounts for 20
  of them; it is also the #1 ERROR bucket of both browser legs (§7).
- **3 of the 50 frozen regression scripts** (`test/python-mode-examples.spec.js`)
  have different native values under 0.13.0: `docs-rst/key_concepts_builder/b13`
  (`model` 141.37 → 282.74), `examples/maker_coin` (13160.2 → 13000.3) and
  `ttt/ttt-ppp0102` (42248.6 → 42847.4). The other 47 are unchanged.
- **The corpus**: 382 → **425** candidates; 232 → **247** scored scripts,
  222 → **239** scored, 10 → **8** native SKIPs.

## 1. Setup

| | |
|---|---|
| 0.13.0 venv | `~/Desktop/ocjs-deps/b123d-013-venv` — CPython 3.13.13, build123d 0.13.0, cadquery-ocp-novtk 8.0.1.1.0, ocp-gordon 0.3.1, ocpsvg 0.7.0, numpy 2.5.4, bd_materials 0.2.4 (+ pytest) |
| 0.12.0 venv | `~/Desktop/ocjs-deps/b123d-012-venv` — CPython 3.13.13, build123d 0.12.0, cadquery-ocp-novtk **7.9.3.1.1** (the same OCP as the 0.11.1 venv) — the control that separates API from kernel |
| 0.11.1 | `~/Desktop/ocjs-deps/b123d-ref-venv` is **broken as a venv** (its `bin/python` → `/usr/bin/python3`, which the OS moved from 3.12 to 3.14; `/usr/bin/python3.12` is gone). Left untouched; `~/Desktop/ocjs-deps/b123d-0111-python` is a wrapper that runs its cp312 site-packages on mise's CPython 3.12.14 — use it as `B123D_REF_PY` |
| source | `~/Desktop/ocjs-deps/src/build123d-v0.13.0` (tag `v0.13.0`, 38effd34) |
| fonts | `~/Desktop/ocjs-deps/fonts-ref` — see below |

**Fonts.** Native `Text()` resolves its default "Arial" through OCCT's
`Font_FontMgr`, i.e. through the host's fonts. This machine has no Arial and
OCCT fell back to `omarchy` (an icon font with no Latin glyphs): every
`Text()` came back EMPTY and a dozen scripts "failed natively"
(build123d_logo, maker_coin, extrude, projection, objects_2d, ex34, clock …).
The old reference was generated on Ubuntu 24.04 with `fonts-freefont-ttf`
20211204+svn4273-2 — whose FreeSans files are byte-identical to the ones lite
bundles — on which OCCT maps "Arial" to FreeSans. `reference.py` now registers
exactly that font set into `Font_FontMgr` before every script
(`B123D_REF_FONTS`, default `~/Desktop/ocjs-deps/fonts-ref`; recreate it from
the .deb, see `FONTS_DIR` in reference.py). **Proof the environment is
reproduced:** re-running 0.11.1 over the committed 0.11.1 corpus gives 221/222
scored scripts identical and 1 at 1e-7 bbox drift, with every native status
unchanged.

**Builder measurement convention** (reference.py `builder_product`): since
0.12's unified BuildScope, a builder's `_obj` is its LOCAL construction product
(`part_local`/`line_local`). The reference keeps 0.11.1's meaning fixed: the
PLACED `.part` / `.line`, and the LOCAL `.sketch_local` (as before). Where the
local bbox differs, it is recorded as `local_bbox` (informational) — 8 builder
variables in the scored corpus (`docs-rst/build_line/b01 path`,
`key_concepts_builder/b17 placed_parts`, `objects_1d example_8/filletpolyline`,
`tea_cup handle_path`, `sm_hanger side_line/wing_line`, `ttt-ppp0102 l1`).
Measuring `_obj` would have turned all 8 into spurious CHANGEs.
**A lite/upstream measurer that reads `_obj` on 0.12+ source will mismatch
exactly those 8 variables.**

## 2. Method

Five native runs, each a full `reference.py` sweep:

| run | library | kernel | code |
|---|---|---|---|
| `reference-0.11.1-all.json` (committed) | 0.11.1 | OCP 7.9.3 | 0.11.1-era corpus (a master snapshot of ~2026-08-10) |
| `native-runs/0.11.1-on-0.13.0-corpus.json` | 0.11.1 | OCP 7.9.3 | 0.13.0 corpus |
| `native-runs/0.12.0-on-0.13.0-corpus.json` | 0.12.0 | OCP 7.9.3 | 0.13.0 corpus |
| `reference-all.json` (the new reference) | 0.13.0 | OCP 8.0.1 | 0.13.0 corpus |
| `native-runs/0.1{2.0,3.0}-on-0.11.1-corpus.json` | 0.12.0 / 0.13.0 | 7.9.3 / 8.0.1 | 0.11.1-era corpus |

Pairs on IDENTICAL code isolate the library: 0.11.1 → 0.12.0 = API/semantics
(same kernel), 0.12.0 → 0.13.0 = kernel (same API). Per variable:
`same` (volume 1e-9 rel, bbox 1e-7), `drift` (inside the harness PASS
tolerance: 0.5% volume, 1e-3 bbox), `CHANGED` (outside it). Tool:
`native-delta.py A.json B.json`.

## 3. Corpus changes (collect.py)

| | 0.11.1 | 0.13.0 |
|---|---|---|
| candidates (`manifest-all.json`) | 382 | **425** |
| scored corpus (`manifest.json`) | 232 | **247** |
| scored | 222 | **239** |
| native SKIP | 10 | **8** |

collect.py now also reads `.. code:: python` / bare `.. code::` / bare
`.. code-block::` blocks (ids `cNN`, plus a cumulative `call`) and
`.. doctest::` blocks (`dNN`) without renumbering the existing `bNN` ids,
collects `docs/assets/readme/readme.py` (the README example), and drops
`show()` calls whose arguments name ocp_vscode-only symbols (`ColorMap`,
`Camera`). No new viewer calls needed stripping; `llms.txt` is generated at
docs-build time and is not in the repo.

**New in the scored corpus (25):** `examples/spring` (helical spring),
`general_examples/ex38` + `general_examples_algebra/ex38` (rotation methods),
`docs-readme/readme`, `docs-rst/algebra_performance/b04` (vectorized
locations), `key_concepts_algebra/b14,b15`, `key_concepts_builder/b05,b06,b12,
b16,b22,b23,b24` (mixing builder/algebra, positioned builders; several are
renumbered old blocks), `docs-rst/assemblies/c03` (local/global assembly
locations), `c06`, `c07`, `call` (pack walk-through), `key_concepts/d01`
(Location doctest), `build_line/b01` (`line_local`), `import_export/b02`
(`export_obj`), `topology_selection/b10,b13,b14,b15`. The positioned-sketch
example (`general_examples ex37`) and the materials tutorial were already in
the 0.11.1-era snapshot; `Superellipse` lives in `docs/objects_2d`.

**Left the scored corpus (10):** `key_concepts_builder/b03,b09,b10,b11,b19,b21`
(renumbered: their code now lives at `b06,b12,b13,b14,b22,b24`) and
`topology_selection/b03,b04,b06,b07` (the page was rewritten). Ids that exist
in both corpora but hold DIFFERENT code after renumbering:
`key_concepts_builder/b13,b14,b17,b20` (= old b10, b11, b14, b17),
`topology_selection/b05` (= old `selectors/b02`), `topology_selection/b09`
(= old b12) — compare those by code, not by id.

**Native SKIPs now (8):** `bd_warehouse` x3 (rigid_joints_pipe, rod_end,
technical_drawing), `ImageFace` (constraint_examples), `tcv_screenshots`
(docs-objects/text), `general_examples_algebra/ex10` (NameError: `length`),
and no module-level shapes (python_logo, line_types). `examples/tea_cup` —
an AssertionError on 0.11.1 — now runs (§5); `sort_distance_from` is no
longer a ColorMap NameError.

## 4. Kernel: OCP 7.9.3 → 8.0.1 (0.12.0 → 0.13.0, identical code)

| | 0.13.0 corpus (222 common scored ids) | 0.11.1-era corpus (232) |
|---|---|---|
| identical | 192 | 204 |
| drift | 21 | 18 |
| CHANGED | 1 (`tips/b04`) | 1 (`tips/b04`) |
| still failing natively | 8 | 9 |

Drift magnitudes: volume ≤ 8.9e-7 relative (`loft`), bbox ≤ 3e-6 — except
`docs/objects_1d example_7` (a curve's bbox max-Y: 3.38968 → 3.39064,
**9.6e-4**, just under the 1e-3 PASS bound: a lite leg matching one version
can flip on the other).

**`docs-rst/tips/b04` is natively nondeterministic** — `vertices().group_by(
Axis.X)[-1].sort_by(Axis.Z)[-1]` on a sketch whose local vertices all have
Z = 0 is a complete tie, and the winner varies run to run with the same
library: 0.13.0 gave −0.5 three times and −0.7 three times in 6 runs,
0.12.0 2/4, 0.11.1 1/7. The committed reference holds −0.7. Any leg's result
on this script is a coin flip; it should not count for or against anyone.

**The edge-orientation / traversal-order question.** Native values of the
scripts lite currently fails as COMPROMISE(edge-orientation)/(traversal-order):

| script / variable | 0.11.1 (7.9.3) | 0.12.0 (7.9.3) | 0.13.0 (8.0.1) | lite (8.0.1 wasm) |
|---|---|---|---|---|
| joints `pin_arm` bbox xmin | 8.0835 | 8.0835 | 8.0835 | 5.3933 |
| joints `slider_arm` bbox xmin | −3.7834 | −3.7834 | −3.7834 | 5.3255 |
| projection `projected_text` xmin | −49.6470 | −49.6470 | −49.6470 | −49.7713 |
| sort_axis `part` volume | 5585.16 | 5585.16 | 5585.16 | 4765.10 |
| filter_all_edges_circle `f` ymin | −21 | −21 | −21 | +21 |
| tips/b04 `vertical_sketch` ymin | −0.7 (mostly) | −0.5/−0.7 | −0.5/−0.7 | −0.5 |

(joints_algebra and projection_algebra identical to their builder twins.)
**Native OCP 8.0.1 reproduces OCP 7.9.3 exactly** on all of them; tips/b04 is
noise. The kernel-version explanation does not hold; what differs is lite's
own construction/traversal. (The upstream leg on the same wasm kernel PASSES
joints, projection, sort_axis and filter_all_edges_circle — §7.)

## 5. API and semantics: 0.11.1 → 0.12.0 (same kernel)

On the 0.11.1-era code (232 ids): 205 identical, 11 drift, **6 CHANGED**,
1 newly passing, **0 newly failing**. On the 0.13.0 code (all 247 ids,
0.11.1 vs 0.13.0): 184 identical, 20 drift, 4 CHANGED (key_concepts_builder
b16/b17, maker_coin, ttt-ppp0102), 31 newly passing (0.11.1 cannot run the
migrated docs — 30 API breaks + tea_cup). Every geometry change, classified:

| script | variables | 0.11.1 → 0.13.0 | cause (all reproduced by 0.12.0 on OCP 7.9.3) |
|---|---|---|---|
| `docs-rst/key_concepts_builder/b13` (old id; = new `b16`) | `model` | volume 141.37 → 282.74, xmin −3 → −23 | **(b) BuildScope**: `with Locations((-20,0),(20,0)): with BuildSketch()` now places the builder at both locations (was: not replicated) |
| `docs-rst/key_concepts_builder/b14` (old id; = new `b17`) | `placed_parts` | volume 125 → 250 | **(b) BuildScope**: `Locations` around a `BuildPart` now positions/replicates it |
| `ttt/ttt-23-02-02-sm_hanger` | `l1`, `l2` | bbox moves from the XZ plane (z = 65) to XY (y = 65) | **(b) BuildScope**: objects created inside `BuildLine(Plane.XZ)` are LOCAL now; only the builder's `.line` is placed (`side_line`/`wing_line` are unchanged). Lite already produced the local answer — its old "MISMATCH" is the new native truth |
| `docs/objects_1d` | `l1`, `l4` | same move (XZ → XY) | **(b) BuildScope**, as sm_hanger; lite's old l1/l4 mismatch now PASSES (l3 + scene remain) |
| `ttt/ttt-ppp0102` | `p` | volume 42248.6 → 42847.4 (+1.42%), ymax 24.5 → 45 | **(b) BuildScope**: `sweep(path=l1)` with `l1` a `BuildLine(Plane.XZ)` builder now sweeps the builder's LOCAL line (`line_local`); `sweep(path=l1.line)` still gives the old part. The part no longer matches Too Tall Toby's published 43.09 g (43.70 g — inside the script's own 1 g tolerance). Looks like an upstream regression worth reporting |
| `examples/maker_coin` | `maker_coin` | volume 13160.2 → 13000.3 (−1.22%) | **(b) project() pending planes**: `project()` lands the "OS" label on the top AND the bottom of the coin; 0.11.1 recorded +Z planes for all five pending faces (the bottom pair extruded into air), 0.12+ records −Z for the bottom pair, so `extrude(amount=-2, SUBTRACT)` now engraves the label on the underside too (exactly 2x the removed volume). `edges(Select.NEW)` is identical (9 BSPLINE edges, same length) — not the Select.NEW change |
| `examples/tea_cup` | — | AssertionError → runs | **(b)**: the script's own `assert abs(tea_cup.part.volume - 130326) < 1` fails on 0.11.1 and holds on 0.12+ (unchanged code) |
| `docs-rst/tips/b04` | `vertical_sketch` | flips | natively nondeterministic (§4) |

Changes that come from upstream EDITING the docs, not from the library
(0.11.1 on old code vs 0.11.1 on new code): `key_concepts_builder/b20`
(`pipes` 2000 → 999 — now holds old b17's code) and `topology_selection/b09`
(`box` 25 → 1 — now holds old b12's code); six more ids changed only their
variable names (key_concepts_algebra/b13, key_concepts_builder/b13,b14,b17,
topology_selection/b05,b12).

**(a) API breaks** — scripts of the 0.13.0 corpus that 0.11.1 cannot run
(newly passing on 0.12.0):

| new API used by the migrated docs | scripts |
|---|---|
| builder op `insert()` (was `add()`, still a deprecated wrapper) | 20: tutorial_constraints b09/b13, group_axis, heart_token, slide_latch, tutorial_joints, build123d_logo + customizable, clock, custom_sketch_objects, dual_color_3mf, mixed_algebra_context, playing_cards, general_examples ex16/ex32/ex33/ex38, sm_hanger, ppp0107, readme |
| `ExportSVG(line_color=0x636363)` (ColorLike) | 4: objects_1d, objects_2d, selector_example, packed_boxes |
| `Shape.faces(Select…)` / `vertices(Select…)` on algebra results | key_concepts_algebra/b14, topology_selection/b15 |
| `Convexity` | topology_selection/b08 |
| `Builder.label` | key_concepts_builder/b02 |
| `BuildLine.line_local` | build_line/b01 |
| `export_obj` | import_export/b02 |

None of the removed APIs (tangent objects `ArcArcTangentArc/Line`,
`PointArcTangentArc/Line`, `Face.make_plane`, `is_planar_face`, `to_tuple`,
`to_axis`, `to_wire`, `to_plane`, `relocate`, `LocationEncoder`,
`end_angle`/`angular_direction`) is used by any corpus script, old or new: the
0.11.1-era corpus runs on 0.13.0 with zero new failures. `Unit` becoming a
`StrEnum` does not surface in the corpus either.

## 6. The 50 frozen regression scripts

Each frozen script's embedded code (0.11.1-era) re-run natively on 0.11.1 and
0.13.0: **41 identical, 6 drift (≤ 1.2e-6), 3 CHANGED** —

| frozen test | asserted value (0.11.1) | 0.13.0 native | cause |
|---|---|---|---|
| `docs-rst/key_concepts_builder/b13` ("Locations around a nested BuildSketch must NOT replicate (0.11.1 semantics)") | `model` 141.3717 | **282.7433** | BuildScope: it now DOES replicate |
| `examples/maker_coin` | `maker_coin` 13160.2179 | **13000.3091** | project() pending planes |
| `ttt/ttt-ppp0102` | `p` 42248.6183 | **42847.4316** | sweep(path=<BuildLine>) uses the local line |

## 7. Baselines against the 0.13.0 reference (unmodified code)

Code: `feat/headless-core` @ 74eb7a6, `--pages 2`; scripts that TIMEOUTed
under machine contention were re-run alone and merged (`solo_rerun` in the
JSON). Files: `baseline-013-lite.json`, `baseline-013-upstream.json`,
`baseline-013-real.json`. Previous numbers are against the 0.11.1 reference
(232/222 corpus).

| leg | PASS | MISMATCH | ERROR | TIMEOUT | SKIP | before (vs 0.11.1) |
|---|---|---|---|---|---|---|
| Brython + lite (default) | **191** | 13 | 34 | 1 | 8 | 206 / 10 / 5 / 1 / 10 |
| MicroPython + pysrc=upstream (vendored 0.11.1, pytopo=upstream) | **198** | 7 | 33 | 1 | 8 | 216 / 2 / 3 / 1 / 10 |
| Pyodide + pysrc=real (real 0.11.1 wheel over the OCP shim) | **201** | 7 | 30 | 1 | 8 | 216 / 3 / 2 / 1 / 10 |

**Top ERROR buckets** (both source legs): `NameError: insert` (lite 19,
upstream 20 — the single biggest item), then new 0.12 surface one script
each: `Convexity`, `line_local`, `export_obj`, `global_location` (lite) /
`path` (upstream; assemblies c03 + call), `faces()`/`vertices()` taking a
`Select`, settable `Location.position` (lite, key_concepts/d01),
`Builder.label` (AssertionError, key_concepts_builder/b02), `tempfile`
(upstream, topology_selection/b10), plus the known gaps: `Draft`
(objects_2d), sympy (curved_support), the kernel faults (lite: toy_truck
FilletEdges, ttt-ppp0110 fuse drop, and the README example's ChamferEdges).
TIMEOUT on both: spitfire_wing_gordon.

The **real-0.11.1 leg is effectively "native 0.11.1 on the 0.13.0
corpus"**: its ERRORs are the API breaks of §5 (`insert` x21 — objects_2d
reaches `insert` there because real 0.11.1 has `Draft` — `line_local`,
`export_obj`, `Convexity`, `faces()`/`vertices()` with a `Select`,
`Builder.label`, tea_cup's own assert) plus two leg gaps (`Mesher.read` in
topology_selection/b10, sympy in curved_support); its MISMATCHes are exactly
the 0.12 semantics changes (maker_coin, objects_1d l1/l4, ttt-ppp0102,
key_concepts_builder/b16 + b17) and assemblies/c06 + call. The c06 numbers
show the latter is the MEASURER, not the library: native 0.11.1, 0.12.0 and
0.13.0 all report `assembly2.volume == 1`, `assembly3.volume == 1` (the docs'
own comment), while every browser leg — including the REAL 0.11.1 wheel —
reports 2 / 3, because the worker's `MeasureShape` sums per solid
(COMPROMISE(volume-measure)).

**MISMATCH, lite (13):** the unchanged edge-orientation/traversal set
(joints x2, projection x2, sort_axis, filter_all_edges_circle, tips/b04 —
see §4), objects_1d (`l3` + `scene` only; l1/l4 now pass), plus five 0.12
semantics: maker_coin, ttt-ppp0102, key_concepts_builder/b16 + b17
(Locations positions a builder) and assemblies/c06 (`Compound.volume` of a
nested assembly: native 1 / 1 / 1 as the docs' own comments say, lite and
upstream sum the children: 2 / 3 — the worker measurer, see above).
**Upstream (7):** maker_coin, objects_1d (l1/l4 still 0.11.1-placed),
ttt-ppp0102, key_concepts_builder/b16 + b17, tips/b04, assemblies/c06.

Status transitions vs the 0.11.1 baselines: lite PASS → ERROR 17 (insert x15,
Convexity, Builder.label), PASS → MISMATCH 3 (maker_coin, ttt-ppp0102,
key_concepts_builder/b17), MISMATCH → ERROR 2 (tutorial_joints and sm_hanger
now die on `insert` before reaching their old mismatch); new scripts 15 PASS /
10 ERROR / 2 MISMATCH. Upstream: PASS → ERROR 19, PASS → MISMATCH 3; tea_cup
(was SKIP) is an upstream ERROR — its own volume assert, the same assertion
0.11.1 fails natively.

**What the lite/upstream agents have to beat:** fixing `insert()` alone is
worth ~20 scripts on either leg; the five semantics MISMATCHes need the 0.12
BuildScope/project behaviour; the edge-orientation set needs lite's
construction to change, not a kernel argument; tips/b04 is unscoreable.

## Reproduce

```bash
cd test/b123d-validation
export B123D_SRC=~/Desktop/ocjs-deps/src/build123d-v0.13.0
python3 collect.py                                   # -> manifest-all.json (425)
python3 reference.py --manifest manifest-all.json --out reference-all.json --jobs 4
python3 collect.py prune                             # -> manifest.json + reference.json
# controls (same code, other library):
B123D_REF_PY=~/Desktop/ocjs-deps/b123d-012-venv/bin/python python3 reference.py \
  --manifest manifest-all.json --out native-runs/0.12.0-on-0.13.0-corpus.json
B123D_REF_PY=~/Desktop/ocjs-deps/b123d-0111-python python3 reference.py \
  --manifest manifest-all.json --out native-runs/0.11.1-on-0.13.0-corpus.json
python3 native-delta.py native-runs/0.12.0-on-0.13.0-corpus.json reference-all.json \
  --labels 0.12.0 0.13.0 --ids-from manifest.json
# browser legs (headless; DISPLAY is stripped for headless Chromium):
node run-lite.mjs --pages 2 --port <p> --out baseline-013-lite.json --report /tmp/r.md
CS_PY_RUNTIME=micropython CS_PY_SRC=upstream CS_DEBUG_PYSRC=1 node run-lite.mjs ...
CS_PY_RUNTIME=pyodide CS_PY_SRC=real CS_DEBUG_PYSRC=1 node run-lite.mjs ...   # needs fetch-pyodide.cjs + rebuild
```
