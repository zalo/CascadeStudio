# BUMP LEDGER — upstream build123d 0.11.1 → dev@44a8d7c1 (the future 0.12)

The deliverable of the `feat/upstream-b123d-dev-bump` experiment: every
category of work the version bump forced, with actual effort, to price
future bumps honestly. Target tree: gumyr/build123d@44a8d7c1 (239 commits
past v0.11.1; +2,453/−2,094 lines; build_common rebuilt around an immutable
`BuildScope` + a `BaseObjectMeta` construction-firewall METACLASS;
objects_curve refactored ~1,000 lines; new modules build_constants.py and
pack_utils.py).

Clock started 2026-08-20 11:30 PDT.

## A. Vendoring mechanics — ~40 min

| Task | Effort |
|---|---|
| Parameterize fetch-upstream-b123d.cjs (`--src/--out/--provenance`), add build_constants/pack_utils to FILES | 15 min |
| Vendor tree + LICENSE/NOTICE/provenance README; .gitignore allowlist entry | 5 min |
| Single active-version switch: `ACTIVE_UPSTREAM_VENDOR` const in UpstreamB123d.js; per-vendor module lists; build.cjs reads the const; MicroPythonRuntime dev-path + PoC default follow it | 20 min |

## B. Loader module list — ~10 min

- dev split `build_constants` out of build_common (compat re-import kept
  upstream-side) and `pack_utils` out of pack → two new entries, ordered
  before their importers. Keyed per vendor so 0.11.1 flip-back is intact.

## C. New source transforms — ~45 min (incl. diagnosis)

| Transform | Trigger | Effort |
|---|---|---|
| `stripPositionalOnlyMarkers` — PEP 570 `/` in def signatures (objects_curve `_localize` overload) | SyntaxError | 15 min |
| `rewriteDataclassFields` must STOP at the first def/decorator in the class body — dev's `BuildScope.derive()` has annotated kwonly params that the 0.11.1-era scan rewrote into statements | SyntaxError | 15 min |
| `cleanClassBases` strips `metaclass=<Name>` (accepting only BaseObjectMeta/ABCMeta, refusing others loudly) | SyntaxError (`class X(metaclass=M)` is a MicroPython TypeError) | 15 min |

## D. New stdlib shims — ~45 min

| Shim | Trigger | Effort |
|---|---|---|
| `contextlib` (AbstractContextManager + generator `contextmanager` + suppress) — MicroPython ships none | build_common import | 20 min |
| `itertools` superset (product, cycle, permutations, starmap, chain, combinations) — settrace build's builtin is partial | build_common `product`, operations_part `cycle/permutations/starmap` | 15 min |
| `dataclasses` upgrade: per-instance `default_factory` (BuildScope's identity-Location fields DOCUMENT that sharing is a bug) + `__post_init__` call | silent wrong geometry risk + validation loss | 10 min |

## E. New seam names / methods

| Item | Trigger | Effort |
|---|---|---|
| `Shape._wrapped` getter (dev build_common reads it raw in `_PublicationService.place`'s None-guard) + `Shape.wrapped` SETTER (publish(preserve_identity=True) assigns `.wrapped`) | Line published as None → builders empty | 20 min (diagnosis-heavy) |
| `_cs_current_builder()` in _finalize: dev deleted `Builder._current` (ContextVar) for the unified scope stack → version-agnostic helper for the seam's lite-op bridges | AttributeError at runtime | 10 min |

## F. The metaclass emulation (the big structural item) — ~1.5 h

Dev's `BaseObject(metaclass=BaseObjectMeta)` wraps EVERY builder-object
construction in an isolated BuildScope and publishes the finished instance
to its captured Builder. MicroPython has no metaclasses. Emulation
(in _finalize, guarded by `hasattr(build_common, 'BaseObjectMeta')`):

- `BaseObject.__new__` replacement = everything `BaseObjectMeta.__call__`
  did BEFORE construction (validate `_applies_to`, capture location/builder
  contexts, build + PUSH the isolated scope, set `owner.root`), leaving the
  pending (scope, token) on the instance. (Probed first: MicroPython's DFS
  attribute lookup DOES reach `BaseObject.__new__` through
  `BasePartObject(Part, BaseObject)`, and `__init__` still runs after a
  custom `__new__`.)
- Wrappers on the five terminal publisher `__init__`s (Base{Part,Sketch,
  Curve,Line,Edge}Object): pop + `_publish_to_context` when the outermost
  `__init__` completes. Rides on upstream's own convention that subclass
  `__init__` ENDS with `super().__init__(...)`.
- KNOWN COMPROMISES: statements after the terminal super() call would run
  outside the isolated scope (no library object does this); an `__init__`
  that raises before reaching the terminal super() leaks the pushed scope
  until the worker's between-runs `_cs_reset_all`.

## G. Harness grind (browser, full corpus) — ~2.5 h

Run 1 (after §A–F): **120 PASS / 97 ERROR / 4 MISMATCH / 1 TIMEOUT**.
Clusters closed, in order:

| Fix | Scripts recovered | Layer | Effort |
|---|---|---|---|
| `Shape.copy_attributes_to` (dev `_PublicationService.place` carries user metadata onto every placed result; lite internals `topo`/`_loc`/`_parent` excluded — `_loc` is None-for-identity and upstream's falsy-target guard would overwrite placements) | ~80 | seam | 20 min |
| `Compound.resolve_font` (dev Text resolves the font up front) over lite's honest FontManager | 8 (all Text scripts) | seam | 15 min |
| collections.abc tuples + `rewriteNestedTypeTuples` transform: MicroPython `isinstance` does NOT flatten nested classinfo tuples — dev's `flatten_sequence` checks `(list, tuple, set, Iterator)` with the shim's tuple-valued `Iterator`, so a `filter` of edges silently didn't flatten (`fillet(filter(...))` in din_rail; `.topo_parent` on a filter in din_rail_algebra) | 2 + latent | shim + transform | 45 min (diagnosis: the silent-False took a browser bisect) |
| `show()`/`show_object()` unwrap UPSTREAM builders (viewport stayed empty — harness-invisible, user-visible) | 0 (product fix) | seam | 10 min |
| `Mixin1D.combine` chains at 1e-7 in upstream mode (dev `pending_edges_as_wire` rides Wire.combine; a 1-D fillet arc endpoint sits ~7e-8 off the trimmed line, 1e-9 chaining split the wire — surfaced as make_brake_formed's widths ValueError) | sm_hanger | seam | 40 min (diagnosis-heavy) |
| `_cs_path_wire_topo` accepts bare EDGE sweep paths (dev make_brake_formed sweeps per line edge; GetWire refuses edges) | sm_hanger | seam | 10 min |
| harness-config, not code: run-lite/probe need `B123D_SRC=~/Desktop/build123d` for `import_step` ASSETS (2 false ERRORs in runs 1–2) | 2 | — | 15 min lost |

Run 2 (before the last three rows): **201 PASS / 12 MISMATCH / 7 ERROR /
2 TIMEOUT**.

## H. Intentional dev behavior changes (vs the 0.11.1 native reference)

Verified by building a NATIVE dev venv (cp of b123d-ref-venv + source copy —
pip needs setuptools it doesn't have; version reports 0.0.0 without
setuptools_scm) and regenerating the reference for every mismatching script
(`reference.py --manifest`; all 14 run natively on dev). Scripts that
MISMATCH the 0.11.1 reference but PASS against the dev reference:

- **docs-rst/key_concepts_builder/b13** — builder results now REPLICATE under
  an enclosing `Locations` (dev's BuildScope captures publication_locations
  at builder entry): volume 141.37 → 282.74, native-dev-exact.
- **ttt/ttt-ppp0102** — `BuildLine(Plane.XZ)`: 0.11.1 localized POINTS into
  the workplane during construction (module variables global); dev builds on
  LOCAL Plane.XY and publishes to the placement (`workplane=` kwarg renamed
  `placement=`). l1 is now local — and 'p' itself differs (42847.4 native-dev
  = ours, 1.42% off 0.11.1).
- **examples/maker_coin** — volume 12998.909 (native-dev-exact) vs 13160.218
  on 0.11.1: dev changed geometry in the JernArc/DTA/fillet region.
- **docs-rst/tips/b04** — the completely-TIED sort_by that made this a
  traversal-order compromise on 0.11.1 is not tied the same way on dev: ours
  now matches native dev exactly.
- API surface: `Workplanes`/`WorkplaneList` REMOVED upstream (no corpus
  script uses them); builders take `*placements`; `BuildPart.part` returns
  the PLACED part (`part_local` added); `Unit` became a StrEnum;
  `MC`/`UNITS_PER_METER` etc. moved to build_constants (compat re-import
  kept); loft supports multiple holes per section; fillet/chamfer got the
  "did you intend <keyword>=" validation.

## I. Dev bugs found

- None conclusively (native dev ran every corpus script we pointed it at).
  Note `BuildLine.line_local` returns a Curve on which `.length` raised in
  one native-dev probe (`'Curve' object has no attribute 'length'`) — not
  corpus-relevant, unverified against upstream HEAD.

## J. Final numbers (2026-08-20 evening)

Harness, 222 scored scripts, vs the NATIVE 0.11.1 reference
(`CS_PY_RUNTIME=micropython`, pysrc=upstream default, dev vendor active,
`B123D_SRC=~/Desktop/build123d` for import_step assets):

| Config | PASS | MISMATCH | ERROR | TIMEOUT |
|---|---|---|---|---|
| dev@44a8d7c1 upstream (this branch) | **202** | 14 | 4 | 2 |
| — counting the 4 confirmed intentional dev changes as dev-correct | **206** | 10 | 4 | 2 |
| 0.11.1 upstream (previous state) | 205 | 10 | 5 | 2 |
| lite (Brython) re-verified this session | 206 | 10 | 5 | 1 |
| lite (MicroPython) re-verified this session | 206 | 10 | 5 | 1 |

Dev-config non-PASS, fully classified:

- **Intentional dev changes** (PASS against a NATIVE dev reference):
  maker_coin, ttt-ppp0102, key_concepts_builder/b13, sm_hanger.
  sm_hanger is a strict IMPROVEMENT: 0.11.1-upstream ERRORs on it and lite
  MISMATCHes; on dev it matches native dev on all 14 shapes.
- **Lite-family/compromise residuals** (same script + magnitude as the
  documented baselines): joints×2, projection×2 (edge-orientation),
  objects_1d (DTA trim + triad), filter_all_edges_circle, tips/b04
  (traversal/tie — b04 matches native dev in some runs and not others),
  tutorial_joints m6_screw, bicycle_tire +0.84% (thicken band),
  ex08_algebra (face-winding).
- **Honest gaps** (baseline-identical): dual_color_3mf (no lib3mf),
  objects_2d (Draft), curved_support (sympy).
- **Kernel**: Buffer_Stand (fuse-drop on its rib construction; native dev
  passes; 0.11.1-upstream also ERRORs — dev surfaces it as the script's own
  mass assert instead of a raise).
- **TIMEOUT**: spitfire_wing_gordon (gordon-surface realization cost),
  heat_exchanger (4-page contention flap, passes solo — same note as the
  committed baselines).

Gates: fast spec gate (python-mode / py-runtime / py-src-upstream) —
8 passed, 1 skipped. FULL playwright suite: 95 passed / 1 skipped. BOTH lite
baselines re-run this session (Brython on 8384, micropython+pysrc=lite on
8385, booted-pySrc debug lines verified): 206/10/5/1 each, per-script
IDENTICAL to the committed report.md failure sets — the bump touched
nothing outside the upstream-source path.

## Milestones

- 12:45 PDT: PoC goals (BuildLine length 20; BuildPart Box volume 125) pass
  on dev sources in the node inner loop.
- 14:00 PDT: full starter (flanged bearing mount) EXACT in the browser
  (48603.5 mm³).
- 14:30 PDT: harness run 1 — 120 PASS.
- 15:30 PDT: harness run 2 — 201 PASS (target 190 crossed).
- 16:20 PDT: every remaining mismatch classified against a NATIVE dev
  reference; sm_hanger (0.11.1-upstream: ERROR, lite: MISMATCH) runs clean.
- 17:15 PDT: harness run 3 (final) — 202 PASS / 14 MISMATCH / 4 ERROR /
  2 TIMEOUT; fast spec gate green; Brython baseline re-verified per-script
  identical (206/10/5/1).

## K. Verdict on "a bump costs days"

**Confirmed cheap — one working day, not weeks.** Total wall-clock from
empty branch to lite-parity-with-classification: ~6 h, of which:

- ~40 min vendoring mechanics (one-time tooling; the NEXT bump reuses it —
  a re-vendor is now `fetch --src <tree> --out <name>` + one constant flip
  + module-list entry).
- ~2 h load-time friction (transforms/shims). Dominated by ONE structural
  surprise: dev rebuilt build_common around a METACLASS construction
  firewall, which MicroPython cannot express — the emulation (scope push in
  __new__, publish on terminal __init__) is ~120 lines of seam and carries
  two documented edge-case compromises. Everything else was mechanical
  (PEP 570 markers, dataclass field scan bounds, contextlib/itertools shims,
  nested-isinstance-tuple rewrite).
- ~2.5 h harness grind — SIX seam fills total (copy_attributes_to,
  resolve_font, wrapped-setter/_wrapped, show-builder coercion, combine
  tolerance, edge sweep paths), each S-sized once diagnosed; the
  class-DAG unification from the 0.11.1 round meant ZERO structural
  topology work this time.
- ~1 h classification (native dev venv + per-script dev reference), which
  is exactly the work that keeps the result honest.

The prediction in FINDINGS.md ("update the sources, re-run the transforms,
re-run the harness") held, with the caveat that a release that introduces a
NEW CPython-only language/runtime construct (this one: metaclass +
contextlib + PEP 570 + nested classinfo tuples) costs a focused
emulation/shim session on MicroPython. The seam surface itself — lite's
geometry/topology under upstream's Level A — absorbed a 4,500-changed-line
upstream refactor with six small method fills and no lite-source changes at
all (both lite baselines re-verified untouched).
