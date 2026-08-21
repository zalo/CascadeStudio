# INVENTORY — upstream build123d 0.11.1 Level-A on MicroPython over lite's seam

Companion to `FINDINGS.md` (the import-level screen). This file records **every
seam API upstream Level-A needed that build123d-lite's classes lacked or
mismatched**, found by executing real code (the PoC goals, the Python starter
script, and 15+ upstream example scripts) — it prices the full integration.

Where things live:

- Loader + source transforms: `packages/cascade-core/src/worker/UpstreamB123d.js`
- Stdlib shims: `packages/cascade-core/upstream-py/shims/*.py`
- Seam adapters: `packages/cascade-core/upstream-py/build123d/{geometry.py,topology/__init__.py,_finalize.py}`
- Vendored upstream sources: `vendor/build123d-0.11.1/` (COMMITTED since
  4fdc7c3, Apache-2.0 LICENSE included;
  `node packages/cascade-core/scripts/fetch-upstream-b123d.cjs` re-vendors)
- Selection: `?pyruntime=micropython` DEFAULTS to upstream since 4fdc7c3;
  `&pysrc=lite` (localStorage `cascade-py-src`) opts back into lite
- Node inner loop: `experiments/upstream-on-micropython/upstream-poc.mjs`
- lite-vs-upstream example diff: `experiments/upstream-on-micropython/compare-examples.mjs`

Legend for **Fix**: `adapter` = handled in the seam adapter modules (no lite
change), `lite-patch` = a monkey-patch installed ON lite's classes at
upstream-boot time (additive; default modes never load it), `transform` = a
mechanical source rewrite of the upstream file, `open` = not fixed (honest gap).
**Cost** = estimated effort to close PROPERLY in a real integration
(S < 1 h, M ≈ half-day, L ≈ days).

## A. Class-identity mismatches (the structural findings)

> **SECTION CLOSED (commit b384dcd + 0626d97, 2026-08-19).** Lite's topology
> DAG now IS upstream's: `Wire` is a real class (Mixin1D subclass, distinct
> from Edge and Curve), `Part`/`Sketch`/`Curve` subclass `Compound`, `Solid`
> is a separate single-solid class, `Shape.__eq__`/`__hash__` are TopoDS
> IsSame-based topological same-ness, `Compound.get_type` extracts DIRECT
> children over a real TopoDS_Iterator JS helper, `Shape._dim`/`topo_parent`/
> `material` are native, and `_wrap_like` yields upstream-identity classes
> with no seam remapping. The seam adapter (topology/__init__.py) shrank to
> re-exports + the B-section method fills; A1–A8 rows below are kept for the
> record with their closing state.

These were the expensive ones: upstream Level-A dispatches on the topology
class DAG, and lite's DAG was flatter. The proper fix — give lite upstream's
exact hierarchy (`Wire` ≠ `Curve`, `Solid` ≠ `Part`,
`Part/Sketch/Curve ⊂ Compound`) — is DONE; every row is CLOSED.

| # | Upstream call site | What lite had | What was needed | Fix | Cost to close properly |
|---|---|---|---|---|---|
| A1 | `build_common._add_to_context` typed-classification `{Edge, Wire, Face, Solid, Compound}` | `Wire = Curve` alias, and `Edge ⊂ Curve`, so an Edge classified as BOTH Edge and Wire → `ValueError` on the very first `Line()` | `Wire` as a class DISTINCT from both Edge and Curve | adapter: `class Wire(_lt.Curve)` exported as `topology.Wire`; `topology.Curve` stays lite's Curve | CLOSED b384dcd (lite Wire class; seam re-export) |
| A2 | same classification: builder transfer of a child builder's result (`Sketch`/`Part`/`Curve`) relies on `isinstance(obj, Compound)` + `Compound.get_type` extraction | lite `Part/Sketch/Curve ⊂ Shape` only — transferred results classified as NOTHING → `ValueError: BuildSketch doesn't accept ...` | upstream's `Part/Sketch/Curve ⊂ Compound` | adapter: `Part`/`Sketch` re-implemented as `_lt.Compound` subclasses with upstream's kwargs ctor; `_CsBuilderCurve(_lt.Curve, _lt.Compound)` rebound as `BuildLine._sub_class` (MicroPython multiple inheritance works) | CLOSED b384dcd (Part/Sketch/Curve subclass lite Compound; kwargs ctor native) |
| A3 | `Solid` must catch lite-PRODUCED solids (`Box`→`BasePartObject(part=Solid.make_box(...))`, `.solids()`) but must NOT catch `Part` | lite `Solid = Part` alias | keep `Solid = _lt.Part` and take `Part` OUT of that branch (A2) | adapter | CLOSED b384dcd (real lite Solid class; .solids() returns Solids) |
| A4 | every lite operation RETURN re-enters upstream code; lite's `_wrap_like` maps transformed `Face→Sketch`, `Edge→Curve` and yields BASE-class instances with no upstream identity | e.g. `Locations * face` products / `offset_2d` results couldn't be transferred into builders | results re-mapped onto the upstream-identity classes | lite-patch: rebind module global `_lt._wrap_like` (lite resolves it at call time); plus targeted wraps (`Curve.offset_2d`). KNOWN HOLE: direct constructions (`Curve.__add__` returns `Curve(topo, specs)`) still yield base-class instances | CLOSED b384dcd (_wrap_like yields upstream-identity classes natively; seam rebind deleted in 0626d97) |
| A5 | `Compound.get_type(T)` must return DIRECT children only (upstream: `TopoDS_Iterator`), not descendants — `offset(openings=...)` 2-D-offsets every face of a solid otherwise | no `get_type` at all; lite selectors flatten | direct-children extraction | lite-patch: ownership subtraction via lite's geometric `_shape_key` (approximate but validated on loft/lego/din_rail) | CLOSED b384dcd (StandardLibrary DirectChildren over TopoDS_Iterator; lite Compound.get_type) |
| A6 | `Shape.__eq__/__hash__` are topological same-ness upstream; used by `v in face.vertices()` (2-D fillet), `face in solid.faces()` (offset openings), `set(post) - set(pre)` (Select.LAST/NEW) | identity equality + fresh wrappers from every selector call → **silent wrong geometry** (fillet no-op; openings filter empty → tea-cup/loft offset thickened instead of hollowed) | value equality | lite-patch: `Vertex/Edge/Face.__eq__+__hash__` over lite's `_shape_key`. Solid/Compound still identity; `Select.LAST` post−pre set math still over-approximates for non-core types | CLOSED b384dcd (Shape.__eq__ = TopoDS IsSame — the JS seam DOES preserve TShape identity across selector calls; hash over rounded bbox; identity-meaning scans use explicit 'is') |
| A7 | `Shape._dim` (operations dispatch 1/2/3-D) | absent | per-class dims + content-based for Compound | lite-patch: class attrs + a Compound property | CLOSED b384dcd (native _dim class attrs + content-based Compound._dim property) |
| A8 | `Shape.topo_parent` (algebra-mode fillet/chamfer find the owner of a selected edge) | lite tracks the same link as `.parent` | alias | lite-patch: property | CLOSED b384dcd (native Shape.topo_parent property) |

## B. Missing seam METHODS upstream Level-A calls (lite exposes the same
capability differently — usually as a module-level builder-aware function)

| # | Upstream call site | Lite equivalent | Fix | Cost |
|---|---|---|---|---|
| B1 | `Solid.make_box(l, w, h, plane)` (objects_part.Box) | `Box()` object (centered, context-aware) / JS `w.Box(l,w,h,centered)` | adapter classmethod | S |
| B2 | `Solid.make_cone`, `Solid.make_torus` | `Cone()`/`Torus()` objects | adapter classmethods over the same JS makers | S |
| B3 | `Wire.make_circle(r, plane)` | `Edge.make_circle` (an EDGE; `Face(edge)` then failed in `MakeFace`) / JS `w.Circle(r, wire=True)` | adapter classmethod on the Wire adapter | CLOSED b384dcd (native lite Wire.make_circle) |
| B4 | `Solid.extrude_taper(section, direction, taper, flip_inner)` (key_cap) | lite's `extrude(taper=)` two-algorithm block | adapter port of that block | S (done) |
| B5 | `Solid.extrude_until(section, target, direction, until)` | lite's `extrude(until=)` block | adapter port | S (done) |
| B6 | `Solid.sweep` / `Solid.sweep_multi` (operations_generic.sweep, handle) | lite's `sweep()` function (same `PipeShellSweep` JS call) | adapter classmethods incl. lite's spec-chained path-wire logic | S (done) |
| B7 | `Solid.offset_3d(openings, amount, kind).fix()` (tea_cup, loft) | lite `offset(openings=)` → `w.ThickSolidOffset` | adapter method + `Shape.fix` identity | S (done) |
| B8 | `Face.is_coplanar(plane)` (`_add_to_context`'s BuildSketch alignment) | `Plane(face)` exists | adapter (plane compare, orientation-insensitive) | S |
| B9 | `Face.fillet_2d` / `Face.chamfer_2d` / `Wire.fillet_2d` (operations_generic 2-D branch) | lite `_vertex_op_2d` / `w.FilletFace2D`, `_wire_fillet_2d` | adapter methods (chamfer_2d raises honestly — lite has no 2-D chamfer binding) | S |
| B10 | `Shape.fillet(radius, edges)` / `Shape.chamfer(l, l2, edges)` methods | lite module-level `fillet(edges, r)` via per-shape edge indices | adapter methods over `w.FilletEdges/ChamferEdges` (symmetric chamfers only) | S |
| B11 | `Shape.unwrap(fully)` (offset face branch) | flat compounds | identity | S (revisit if nesting ever matters) |
| B12 | `Shape.bounding_box(optimal=)` kwarg | `bounding_box(tolerance)` | lite-patch wrapper accepting `optimal` | S |
| B13 | `plane.from_local_coords(SHAPE)` / `to_local_coords(SHAPE)` (pending-face globalization, `BuildSketch.sketch`) | points only | lite-patch superset wrapper (rigid transform via `plane.location`), preserving Face class across `_wrap_like` (see A4) | S |
| B14 | `Vector.add/.sub` — build_common MONKEY-PATCHES them at import for workplane-relative tuples | lite has `__add__` only, which does not route through `.add` | adapter adds plain `add/sub`. DIVERGENCE: `vector + (tuple)` inside a non-XY workplane is NOT localized (upstream localizes); exact only on Plane.XY | M (route lite `__add__` through `add`) |
| B15 | `Location.__eq__` (`rotate != Rotation()` in BasePartObject) | absent (identity) | adapter tolerant compare | S |
| B16 | `BoundBox.to_align_offset`, `BoundBox.add` | absent | adapter (ported from upstream geometry) | S |
| B17 | `LocationList.__mul__/__rmul__` algebra products (`GridLocations(...) * shape`) — upstream's own topology provides this via `Shape.__rmul__` over Location iterables | lite's LocationList has them, but upstream's build_common LocationList (now in charge) didn't | adapter patches upstream's class post-import | S |
| B18 | `Compound.get_type` see A5 | | | |
| B19 | `Edge.make_tangent_arc` (canadian_flag) | lite `TangentArc` object | adapter classmethod (not yet written) | open, S |
| B20 | `Compound.make_text(single_line_width=, ...)` — upstream Text passes kwargs lite's text seam lacks (examples/extrude) | lite `Text`/`make_text` (narrower signature) | open (needs a kwargs audit of the text seam) | open, S–M |

## C. Enum identity across the seam

Upstream code holds the (metaclass-free shim) enum members; lite methods
compare against lite's plain-class values (strings/tuples). Identity
comparison silently failed — **the worst kind of bug**: `offset(kind=
Kind.INTERSECTION)` silently offset with ARC transitions, `side == Side.BOTH`
fell into the one-sided branch and errored (lego).

| # | Fix | Cost |
|---|---|---|
| C1 | `_Member.__eq__` bridges by `ClassName.MEMBER` through a lookup the topology adapter installs (`enum._cs_set_lite_lookup`); Python's reflected `__eq__` covers `lite_value == member` too. Members keep singleton identity against each other. | done; disappears if lite adopts the same enum objects |
| C2 | `ShapeList.filter_by/sort_by/group_by` translate upstream members to lite values by name (lite dispatches on its own tuple values for GeomType etc.) | done (lite-patch wrapper; keeps lite's own default when the key is omitted) |

## D. Stdlib / runtime shims (MicroPython)

| # | Need | Fix |
|---|---|---|
| D1 | `typing` (functional: subscriptables, `Generic[T]` → plain base), `typing_extensions`, `__future__`, `collections.abc` (isinstance type-tuples), `abc`, `warnings`, `dataclasses` (mini), `contextvars` (list-backed ContextVar + `_cs_reset_all` for the worker's between-runs reset) | `shims/*.py`, registered via `sys.modules` aliasing (builtins shadow `/lib`) |
| D2 | `enum` — metaclass-free; members finalized by a post-import pass (`_finalize_enums`); `__members__`/`_member_names_` provided; **iteration over the class and `Cls(value)` lookup are impossible without metaclasses** (Level A avoids both; geometry's `to_align_offset` was ported around `map(Align, align)`) | `shims/enum.py` |
| D3 | `inspect.currentframe()` — over the settrace current-frame tracker browser.py already maintains; returns the CALLER's frame (`_cur[0].f_back`); frame identity is stable, so build_common's same-scope builder rule works unchanged (verified: `builder_parent` set correctly for nested builders) | `shims/inspect.py` |
| D4 | `sys.exc_info()` — ABSENT in this MicroPython build and `sys` is read-only | transform `sys.exc_info()` → `_cs_exc_info()` (installed in `builtins`, always returns "not handling"); consequence: `_add_to_context`'s invalid-input error is not softened during exception unwinding |
| D5 | `numpy`/`sympy` — imported at objects_curve module level, used only by `Airfoil`/`PointArcTangentArc`/`ArcArcTangentArc` | honest stubs that import but RAISE on use (`shims/numpy.py`, `shims/sympy.py`); the settrace-**ulab** MicroPython build could provide real arrays later |
| D6 | `trianglesolver` (objects_sketch.Triangle) | shim delegating to lite's ported `_tri_solve` |
| D7 | `os.PathLike` (objects_sketch import) | patch on lite's os shim |
| D8 | `logging.NullHandler` | patch on lite's logging shim |
| D9 | OCP stubs: `OCP.Standard`/`OCP.StdFail` names must be REAL `Exception` subclasses (they appear in `except` clauses); `OCP.GccEnt` values must be ints (they become `Tangency` member values); the other 82 modules are inert `_Any` placeholders generated from `ocp_import_map.json` | loader |

## E. Source transforms (all mechanical, version-robust — `UpstreamB123d.js`)

1. `X: TypeAlias = ...` lines → `X = object` (single-line only; multi-line
   RHS exists only in geometry.py, which is replaced — the loader refuses
   loudly if that changes).
2. Bracket-balanced strip of runtime generic subscripts: `list[...]`,
   `tuple/dict/set/frozenset/type[...]`, plus `ShapeList[...]` and
   `ContextVar[...]` (MicroPython cannot subscript classes at runtime).
3. Class-base cleanup: `class BuildPart(Builder[Part])` → `(Builder)`;
   `Generic[...]` dropped from bases.
4. `match X:` → `for _cs_match_ in [X]:` with `case A() | B():` →
   `if/elif isinstance(_cs_match_, (A, B)):`, `case _:` → `else:` —
   line-count preserving; ONLY simple class patterns are translated, anything
   else raises at load time (Level A has exactly one match, in PolarLine).
5. `[*x]` list displays → `list(x)` (operations_part).
6. `sys.exc_info()` → `_cs_exc_info()` (D4).

## F. Validated behaviour (browser, real OCCT wasm)

PoC goals (all exact):

- `BuildLine` two lines → length **20**, bbox (0,0,0)–(10,10,0)
- `BuildPart Box(5,5,5)` via upstream objects_part → volume **125**, centered bbox
- Full `PYTHON_STARTER_CODE` (flanged bearing mount) through upstream
  `fillet`/`GridLocations`/algebra: volume **48603.5 mm³ — identical to lite**
- Nested `BuildSketch`→`BuildPart`+`extrude` (300), `BuildLine`→`BuildSketch`+
  `make_face` (area 32), 2-D vertex fillet (196.5664), `revolve` (301.593 =
  exact Pappus), context `GridLocations`+`Hole` (2748.6726), `Select.LAST`,
  `PolarLocations * shape` algebra, `filter_by(GeomType.CIRCLE)`

Upstream EXAMPLE scripts, lite-vs-upstream measurement diff
(`compare-examples.mjs`; MATCH = every module variable within 0.5% volume):
`holes`, `holes_algebra`, `intersecting_chamfers`, `circuit_board`,
`din_rail`, `lego`, `handle` (multisection sweep!), `loft`, `key_cap`
(extrude until=NEXT/LAST + taper) and `boxes_on_faces` (workplanes on faces)
all **MATCH** — 10 of the ~19 example ids attempted. `tea_cup` runs
end-to-end but the swept handle differs ~0.3% (upstream path chains
`Wire(edges)` where lite sweeps its recorded pending path — same
MakePipeShell numeric family as COMPROMISE(sweep)). Remaining errors in the
sample: B19/B20 above (`make_tangent_arc`, text kwargs), and
`clock`/`joints`/`key_cap_algebra` produced no measurement inside the
sweep's 120 s per-script budget (uninvestigated — clock is slow in lite
too). Heavy text/Airfoil examples stay out of reach (numpy/glyph parity,
same family as lite's own gaps).

## G. Judgment: cost of the full Level-A integration

The PoC needed ~30 seam adaptations; ~20 were S-sized method aliases/ports
(B-section) that would ship as a permanent `_upstream_seam` module, and the
structural ones (A-section) all trace to ONE root cause: **lite's topology
class DAG differs from upstream's**. The decisive step for a real integration
is to give lite upstream's hierarchy (Wire/Curve split, Part/Sketch/Curve ⊂
Compound, Solid/Part split) and a shape-identity story (A6) — after that,
A1–A8 and most of C disappear, and the remaining work is the B-list plus
whatever the 232-script harness surfaces (estimate: the harness would start
in the 60–70% band on day one, based on this sample, with the remainder
dominated by seam-method coverage, not semantics — the builders/operations
themselves demonstrably run verbatim).

Boot cost: the upstream layer adds ~180 ms to MicroPython's boot
(lite 123 ms → upstream 305 ms libMs in-browser) and ~300 KB of fetched
Python source (uncompressed; the vendored Level-A files total ~340 KB, the committed shims + adapters ~60 KB).
Model-evaluation speed is indistinguishable in these examples (time lives in
OCCT, not the interpreter).

## H. Full-corpus integration round (2026-08-19, the DEFAULT-flip round)

The A-section unification landed (b384dcd/0626d97) and `?pyruntime=micropython`
now DEFAULTS to the upstream source layer (4fdc7c3, vendored + committed).
The full 232-script harness then ran against upstream Level-A for the first
time (`CS_PY_RUNTIME=micropython CS_PY_SRC=upstream`, port 836x — NOTE: always
check `CS_DEBUG_PYSRC=1`'s '[debug] page booted pySrc=' lines; a stale
http-server on the harness port serving another checkout masked the first
attempts entirely).

Progression across the fix rounds (PASS of 222 scored):
47 → 95 (measurement duck-typing for upstream builders, single_line_width,
Vector-in-ShapeList, DirectChildren downcasts) → 147 (**the Plane-mutation
fix**: upstream's named planes are FRESH per access and objects_curve assigns
`.origin` on its working plane; lite's singletons + a copy shim that returned
unknown objects unchanged let one algebra arc corrupt Plane.XY for the whole
page) → 159 (get_type flattens chained wires/nested 1-D compounds to leaf
edges) → **162 PASS / 31 MISMATCH / 26 ERROR / 3 TIMEOUT** (the final
verified run; borderline scripts — clock/heat_exchanger/toy_truck/spitfire —
flap ±3 between runs under 4-page contention; rounds 9/10 measured 159–162.
The same final round measured Brython AND MicroPython+lite at
**206 PASS / 10 MISMATCH / 5 ERROR / 1 TIMEOUT** with the per-script set
identical to the committed baseline — heat_exchanger now PASSES under
contention thanks to the hot-path perf round).

Closed in this round (beyond A1–A8): B3/B14/B19/B20 (all natively or as seam
fills), Edge.make_bezier/bspline/helix/ellipse/parabola/hyperbola/
constrained_arcs/constrained_lines, Wire.make_ellipse/make_convex_hull,
Shape.split method form, Vector.get_angle/transform + Plane.forward/
reverse_transform, Solid.make_sphere partials, tangent_at(point),
settable topo_parent, pack's dataclass fields (MicroPython drops class-body
annotations — loader transform + shim `_fields`), builder-aware draft(),
lite-Airfoil override, LineType/ExportSVG/ArrowHead/polar/delta/
topo_distance_to/edges_to_wires re-exports.

Honest REMAINING list (26 ERROR + 31 MISMATCH, per the final run):
- upstream-seam S/M gaps, one script each: Solid.make_wedge (objects_3d),
  trim_to_other on the seam surface (tutorial_constraints/b10), Airfoil
  result surface (objects_1d_airfoil `.bounding_box`), GeomType-member
  arithmetic (`filter_inner_wire_count` multiplies an enum member),
  Joint `.symbols`/LocationList `.positions` (curved_support, Buffer_Stand),
  BuildSketch pending-face transfer via `add(<sketch>)` then bare
  `extrude(amount=)` — 4 scripts ("A face or sketch must be provided":
  custom_sketch_objects, dual_color_3mf, ex32, ex33), IndexError family
  (pegboard_j_hook, sm_hanger, ppp0104).
- kernel-family errors identical in character to lite's own compromises:
  Union/OffsetPlanarWire/FilletFace2D/ChamferEdges/PipeShellSweep raises
  (ex25×2, ex31, ex33_algebra, group_hole_area, ppp0106, twist_extrude,
  slide_latch, heat_exchanger, lego mass-assert).
- MISMATCHes: lite's documented residual set (joints×2, projection×2,
  objects_1d, filter_all_edges_circle, tips/b04) plus upstream-path
  numeric/traversal differences in the 0.5–48% band (logo text volume −48%,
  group_axis −30%, ex35 +22%, selector_example +20%, din_rail +7.6%,
  ex11 ±6.6%, tutorial_joints −10%, and ~10 more ≤3%).

## I. The grind round (2026-08-20) — 162 → 205 PASS (lite parity)

Every §H item above was root-caused and either FIXED or classified. Final
verified state: **205 PASS / 10 MISMATCH / 5 ERROR / 2 TIMEOUT** of 222
scored — statistically at lite's 206/10/5/1, with a DIFFERENT failure set
(upstream additionally PASSES docs-selectors/sort_axis, toy_truck and
ttt-ppp0110 — three scripts lite itself fails). Both lite baselines (Brython
and micropython+pysrc=lite) re-verified per-script IDENTICAL to the
committed 206/10/5/1, full playwright suite green (95 passed / 1 skipped).

CLOSED (fix → scripts recovered → commit):

| Fix | Scripts | Commit |
|---|---|---|
| class-preserving `_wrap_like` at upstream boot (upstream transform semantics: a moved Face IS a Face — the pending-faces path rode on it) | ex32, ppp0102; custom_sketch_objects/dual_color/ex33 progressed | caf48ff |
| seam fills: `Solid.make_wedge`, `Mixin1D.positions`, `reversed(reconstruct=)`, `Curve.wires()` (chains FREE edges — the whole IndexError family), Locations with enum-member orderings, Airfoil→upstream builder, 1-D fillet vertex dedupe | objects_3d, b10, airfoil, filter_inner_wire_count, pegboard_j_hook (+sm_hanger/ppp0104 progressed) | 46e05d4 |
| lite Union kernel-guard extended to RAISES (fuse + UnifySameDomain — the coplanar-contact family surfacing as 'gp_Vec::Normalize()') | ex31→MM, ex33, ex33_algebra, heart_token, ppp0102 | 63c3ce0 |
| lite DirectChildren sub-shapes get stable hashes (CacheOp JSON-hash strips ptr — ops on sibling children all cache-hit the FIRST; silent wrong geometry across a dozen scripts) | logo×2, din_rail, ex19/22/31/34/35, lego, playing_cards, ppp0104, custom_sketch_objects, selector_example… | fad3317 |
| lite get_type expansion iterative (depth-8 recursion cap DROPPED leaves of lite's per-edge compound nesting) | canadian_flag, shamrock, bicycle_tire→0.84% | 20c277b |
| lite Wire.make_polygon drops duplicated endpoint (zero-length edge made prisms boolean-INERT); JS Extrude/Revolve/TaperExtrude sweep the FORWARD profile face | ex11×2, ex25×2, twist_extrude, selector_example, maker_coin (with DTA below) | 2c1b555 + 80e2489 |
| seam: Vertex point-arithmetic + POSITIONAL equality (now in lite's class body), real Shape.clean (UnifySameDomain), fillet/chamfer edge-index remap onto the target | slide_latch, ppp0106, group_hole_area, filter_nested, sm_hanger progressed | 8fa927c + 97a828c |
| lite Edge.find_intersection_points role-swap (was intersecting the other curve's CHORD); loader installs a STABLE sorted() (MicroPython sort is unstable, pack.py's layout rode on it); copy shim copies plain instances SHALLOWLY like CPython (upstream Builder copy snapshots) | b09, packed_boxes, group_properties_with_keys | 023929e |
| seam Tangency-qualifier translation (untranslated shim members silently solved UNQUALIFIED); lite batches many-operand fuses | b13 | 8c5e9fc |
| lite perf: TShape-HashCode Shape.__hash__ (was a kernel Bnd_Box per hash), INTEGER-key Vertex equality (float-tuple keys degrade MicroPython set probing ~100x; a 512-vertex Select.LAST set went 35 s → 0.4 s) | group_axis, examples/extrude, toy_truck, clock, maker_coin (timeouts) | 97a828c |
| seam DoubleTangentArc via lite's solver, trimming the over-extended target inside the upstream BuildLine (ShapeFix mode setters are unbound getter-only embind) | maker_coin | 80e2489 |
| lite FilletFace2D must PRESERVE face orientation (the _forwardProfile guard belongs on solid-producing consumers only — regressed lite ppp0106 before the fix) | (lite regression fix) | 5dab4d3 |

REMAINING (final classification):
- **lite-family residuals** (same script, same magnitude as pysrc=lite):
  joints×2 / projection×2 (COMPROMISE(edge-orientation)),
  filter_all_edges_circle / tips/b04 (COMPROMISE(traversal-order)),
  objects_1d (triad labels + the DTA trim: lite and the seam both TRIM the
  over-extended double-tangent target where upstream keeps the dangling
  tail — COMPROMISE(double-tangent-arc)), tutorial_joints m6_screw
  (CylindricalJoint hole frame), spitfire_wing_gordon (TIMEOUT,
  COMPROMISE(gordon-surface-realization)), objects_2d (`Draft` drafting
  module — honest gap), dual_color_3mf (no lib3mf), curved_support (sympy).
- **upstream-config-only, classified**:
  - bicycle_tire: 'tire' +0.84% — thicken/wrap numeric band (sub-1%,
    compromise-family; lite lands 0.3% closer on its own construction).
  - ex08_algebra: extrude direction from `Plane(face).z_dir` where the
    make_face wire WINDING differs after lite re-chaining —
    edge-orientation family (fixing lite's Face(wire) winding preservation
    risks the whole baseline for one script).
  - Buffer_Stand: the known fuse-drop kernel fault on ITS rib construction
    (all three fuse routes drop the operand; lite's own construction of the
    same part happens to dodge it). KERNEL.
  - sm_hanger: ERROR (the brake-formed wing's FilletEdges raises
    'command not done' on upstream's construction) vs lite's MISMATCH —
    kernel/geometry family; fixable-later at best to lite's own MISMATCH.
  - heat_exchanger: passes in isolation (~55 s); flaps TIMEOUT under
    4-page contention exactly like the lite Brython note in CLAUDE.md.

Judgment: the upstream-source-over-lite-seam config is now a PEER of the
lite source path on this corpus — same pass rate, three scripts better,
five scripts worse, every difference root-caused above.

## J. Stage 3 (2026-08-21): the seam itself retired under pytopo=upstream

With `pytopo=upstream` the DEFAULT (see
experiments/upstream-topology-spike/STAGE3-STATE.md and CLAUDE.md), the
B-section method fills and the seam re-export modules NO LONGER LOAD on the
default MicroPython path — upstream geometry.py + topology/*.py run
verbatim and the fills' jobs are done by upstream's own methods:

| Retired under the default (still load under ?pytopo=lite) | lines |
|---|---|
| build123d/topology/__init__.py (re-exports + B-section fills) | 774 |
| build123d/geometry.py (seam adapter) | 242 |
| ocp_shim/constrained_bridge.py | 141 |
| topology sub-module stubs | 13 |
| **total seam obsoleted** | **~1,170** |
| replaced by ocp_shim/topo_glue.py (worker glue) | 431 |

The pytopo=lite layer is KEPT (the A/B baseline leg and the payload-missing
fallback), so nothing is deleted from the tree this round; a future prune
can drop the seam once the lite leg is no longer interesting. lite itself
(Build123dLite.js) remains load-bearing three ways: the Brython/Pyodide
`build123d` package, the pytopo=lite layer, and the glue's kernel-op
library (text, gordon, exporters, quickhull).
