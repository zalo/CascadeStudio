# INVENTORY — upstream build123d 0.11.1 Level-A on MicroPython over lite's seam

Companion to `FINDINGS.md` (the import-level screen). This file records **every
seam API upstream Level-A needed that build123d-lite's classes lacked or
mismatched**, found by executing real code (the PoC goals, the Python starter
script, and 15+ upstream example scripts) — it prices the full integration.

Where things live:

- Loader + source transforms: `packages/cascade-core/src/worker/UpstreamB123d.js`
- Stdlib shims: `packages/cascade-core/upstream-py/shims/*.py`
- Seam adapters: `packages/cascade-core/upstream-py/build123d/{geometry.py,topology/__init__.py,_finalize.py}`
- Vendored upstream sources: `vendor/build123d-0.11.1/` (gitignored;
  `node packages/cascade-core/scripts/fetch-upstream-b123d.cjs`)
- Opt-in: `?pyruntime=micropython&pysrc=upstream` (localStorage `cascade-py-src`)
- Node inner loop: `experiments/upstream-on-micropython/upstream-poc.mjs`
- lite-vs-upstream example diff: `experiments/upstream-on-micropython/compare-examples.mjs`

Legend for **Fix**: `adapter` = handled in the seam adapter modules (no lite
change), `lite-patch` = a monkey-patch installed ON lite's classes at
upstream-boot time (additive; default modes never load it), `transform` = a
mechanical source rewrite of the upstream file, `open` = not fixed (honest gap).
**Cost** = estimated effort to close PROPERLY in a real integration
(S < 1 h, M ≈ half-day, L ≈ days).

## A. Class-identity mismatches (the structural findings)

These are the expensive ones: upstream Level-A dispatches on the topology
class DAG, and lite's DAG is flatter. The proper fix is to give lite
upstream's exact hierarchy (`Wire` ≠ `Curve`, `Solid` ≠ `Part`,
`Part/Sketch/Curve ⊂ Compound`); everything in this section is a workaround
for not doing that yet.

| # | Upstream call site | What lite had | What was needed | Fix | Cost to close properly |
|---|---|---|---|---|---|
| A1 | `build_common._add_to_context` typed-classification `{Edge, Wire, Face, Solid, Compound}` | `Wire = Curve` alias, and `Edge ⊂ Curve`, so an Edge classified as BOTH Edge and Wire → `ValueError` on the very first `Line()` | `Wire` as a class DISTINCT from both Edge and Curve | adapter: `class Wire(_lt.Curve)` exported as `topology.Wire`; `topology.Curve` stays lite's Curve | L (lite hierarchy change, touches every 1-D construction) |
| A2 | same classification: builder transfer of a child builder's result (`Sketch`/`Part`/`Curve`) relies on `isinstance(obj, Compound)` + `Compound.get_type` extraction | lite `Part/Sketch/Curve ⊂ Shape` only — transferred results classified as NOTHING → `ValueError: BuildSketch doesn't accept ...` | upstream's `Part/Sketch/Curve ⊂ Compound` | adapter: `Part`/`Sketch` re-implemented as `_lt.Compound` subclasses with upstream's kwargs ctor; `_CsBuilderCurve(_lt.Curve, _lt.Compound)` rebound as `BuildLine._sub_class` (MicroPython multiple inheritance works) | L (same hierarchy change) |
| A3 | `Solid` must catch lite-PRODUCED solids (`Box`→`BasePartObject(part=Solid.make_box(...))`, `.solids()`) but must NOT catch `Part` | lite `Solid = Part` alias | keep `Solid = _lt.Part` and take `Part` OUT of that branch (A2) | adapter | included in A2 |
| A4 | every lite operation RETURN re-enters upstream code; lite's `_wrap_like` maps transformed `Face→Sketch`, `Edge→Curve` and yields BASE-class instances with no upstream identity | e.g. `Locations * face` products / `offset_2d` results couldn't be transferred into builders | results re-mapped onto the upstream-identity classes | lite-patch: rebind module global `_lt._wrap_like` (lite resolves it at call time); plus targeted wraps (`Curve.offset_2d`). KNOWN HOLE: direct constructions (`Curve.__add__` returns `Curve(topo, specs)`) still yield base-class instances | included in A2 (disappears entirely once lite's classes ARE upstream's) |
| A5 | `Compound.get_type(T)` must return DIRECT children only (upstream: `TopoDS_Iterator`), not descendants — `offset(openings=...)` 2-D-offsets every face of a solid otherwise | no `get_type` at all; lite selectors flatten | direct-children extraction | lite-patch: ownership subtraction via lite's geometric `_shape_key` (approximate but validated on loft/lego/din_rail) | S once a direct-children iterator is bound (JS helper) |
| A6 | `Shape.__eq__/__hash__` are topological same-ness upstream; used by `v in face.vertices()` (2-D fillet), `face in solid.faces()` (offset openings), `set(post) - set(pre)` (Select.LAST/NEW) | identity equality + fresh wrappers from every selector call → **silent wrong geometry** (fillet no-op; openings filter empty → tea-cup/loft offset thickened instead of hollowed) | value equality | lite-patch: `Vertex/Edge/Face.__eq__+__hash__` over lite's `_shape_key`. Solid/Compound still identity; `Select.LAST` post−pre set math still over-approximates for non-core types | M (decide a canonical shape-identity story for lite; upstream uses TShape identity which lite's JS seam doesn't preserve) |
| A7 | `Shape._dim` (operations dispatch 1/2/3-D) | absent | per-class dims + content-based for Compound | lite-patch: class attrs + a Compound property | S |
| A8 | `Shape.topo_parent` (algebra-mode fillet/chamfer find the owner of a selected edge) | lite tracks the same link as `.parent` | alias | lite-patch: property | S |

## B. Missing seam METHODS upstream Level-A calls (lite exposes the same
capability differently — usually as a module-level builder-aware function)

| # | Upstream call site | Lite equivalent | Fix | Cost |
|---|---|---|---|---|
| B1 | `Solid.make_box(l, w, h, plane)` (objects_part.Box) | `Box()` object (centered, context-aware) / JS `w.Box(l,w,h,centered)` | adapter classmethod | S |
| B2 | `Solid.make_cone`, `Solid.make_torus` | `Cone()`/`Torus()` objects | adapter classmethods over the same JS makers | S |
| B3 | `Wire.make_circle(r, plane)` | `Edge.make_circle` (an EDGE; `Face(edge)` then failed in `MakeFace`) / JS `w.Circle(r, wire=True)` | adapter classmethod on the Wire adapter | S |
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
