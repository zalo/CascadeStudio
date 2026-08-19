# Running UPSTREAM build123d source on MicroPython — feasibility screen

Goal: shrink build123d-lite's surface by running as much verbatim upstream
build123d 0.11.1 Python as possible on the MicroPython runtime
(`?pyruntime=micropython`), so tracking new build123d releases stops meaning
re-porting semantics into `Build123dLite.js`.

## Result of the screen (2026-08-19, `import-screen.mjs`)

**Compile level: 27 of 36 upstream modules compile verbatim on MicroPython
1.28.** The 9 failures are exactly two mechanical syntax patterns:
6 `match` statements (geometry, objects_curve, one_d, two_d, exporters,
brep_from_stl) and 3 `[*x]` list-splat displays (operations_part,
composite, utils). Both trivially source-transformable.

**Runtime level: 9 of the 10 target "Level A" modules import VERBATIM**
(build_enums, build_common — the 1,500-line builder heart —, build_line,
build_part, build_sketch, joints, pack, objects_part, operations_sketch;
operations_generic blocks only on its import of objects_curve, the
numpy+sympy+scipy module), given:

1. **Stdlib shims** (small, one-time): extended `typing` (functional:
   subscriptables + `Generic[T]` resolving to a plain base), `__future__`,
   `collections.abc` (isinstance-usable type tuples), `abc`, `contextvars`
   (trivial non-async ContextVar — build123d's builder stacks), `inspect`
   (`currentframe()` — implementable EXACTLY over the settrace machinery the
   MicroPython runtime already has for `_pythonCallerFrame`!), `warnings`,
   `dataclasses` (mini), `enum` (METACLASS-FREE: MicroPython has no custom
   metaclasses, so Enum members are finalized by a post-import pass;
   identity semantics preserved), plus the existing lite shims (`logging`
   needed `NullHandler`).
2. **Three mechanical source transforms** at module-registration time
   (version-robust, ~40 lines total in `import-screen.mjs`):
   - `X: TypeAlias = ...` module-level assignments → `X = object`
     (MicroPython evaluates them eagerly; no PEP 604 `|`, no builtin
     generics).
   - Bracket-balanced strip of runtime builtin-generic subscriptions
     (`list[...]` → `list` etc.; annotations are strings under
     `from __future__ import annotations`, so this only affects real
     expressions like `TypeVar("T", Any, list[Any])`).
   - Class-base cleanup: `class BuildPart(Builder[Part])` →
     `class BuildPart(Builder)`; `Generic[...]` dropped from bases
     (runtime class subscription needs metaclasses).
   - (match/list-splat rewrites for the 9 files above, when those modules
     are adopted.)
3. **The bottom layer stays ours**: `build123d.geometry` and
   `build123d.topology.*` were Any-stubs in this screen. In the real
   integration they are build123d-lite's EXISTING classes (Vector, Location,
   Plane, Axis, Matrix — pure Python already; Shape/ShapeList/… over the
   worker's OCCT calls) re-exposed under upstream's module layout. numpy
   never enters: it is confined to geometry.py (replaced), objects_curve.py
   (lite's validated 1-D objects stay), topology/one_d.py (ours stays) and
   brep_from_stl.py (skipped).

## What this buys

The Level-A layer (builders, context machinery, Locations/Workplanes,
objects_part/sketch, operations, joints, pack) is exactly the part of
build123d that churns between releases — and exactly the part lite re-ports
by hand today. Running it verbatim would shrink lite to the stable
OCP-facing seam (geometry + topology core), turning a build123d version bump
into: update the sources, re-run the transforms, re-run the 232-script
harness.

## Open risks for the prototype (next step, this branch)

- **API parity of the seam**: upstream's Level A calls a wide sub-surface of
  geometry/topology (`Plane.XY` class attrs, `Shape.wrapped`, ShapeList
  behaviors, `Compound` constructors...). Lite implements most of it — the
  prototype must inventory the misses.
- **Metaclass-free Enum fidelity**: iteration (`for m in Mode`), `.name`
  /`.value`, and `Enum` isinstance checks are shimmed; upstream code paths
  that rely on `EnumMeta` behaviors need auditing.
- **`isinstance(x, Iterable)`-style checks** against the type-tuple
  collections.abc shim: covers list/tuple/set/dict/range/str/generator; a
  custom iterable (ShapeList subclasses list, fine) that isn't one of these
  would misclassify.
- **`inspect.currentframe()` semantics**: build_common uses frames for the
  same-scope builder rule; the settrace-based implementation must return
  frames whose identity matches upstream's usage (the MicroPython runtime
  already solved this for lite's port of the same rule).
- **Performance**: upstream source is heavier than lite (validation layers,
  logging); MicroPython + settrace already costs ~3.5x on pure Python.
  Measure on the harness before judging.

## How to re-run the screen

```bash
cd /tmp/pybackends   # needs: npm i @micropython/micropython-webassembly-pyscript
node <this dir>/import-screen.mjs
```

`ocp_import_map.json` (85 OCP submodules / 278 names build123d imports —
93% already bound in our wasm, measured earlier) and
`b123d_internal_map.json` (the geometry/topology names Level A pulls) are
committed alongside; both are regenerated by the scripts embedded in the
screen harness.
