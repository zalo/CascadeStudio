# Canonical parametrisation for free edges (`Mixin1D.canonical`)

## Problem

The seam, the traversal direction and the parameter range of an edge that build123d
did not draw - one produced by `cut`/`fuse`/`intersect`, `section`,
`project_to_shape`, `Shape.edges()` after a boolean - are **implementation-defined
outputs of the CAD kernel**, not properties of the geometry. Today they leak straight
into user-visible results through `position_at`, `tangent_at`, `location_at` and
`Axis(edge)`.

Three independent mechanisms are involved (all verified against OCCT sources and both
OCP 7.9.3 and OCCT 8.0.1; see the evidence below):

1. **Where a closed intersection curve is cut into edges** is decided by the
   surface/surface walking algorithm, which terminates a walk when it leaves either
   surface's parametric domain (`IntWalk_PWalking.cxx`, `Arrive = true` when
   `u < UFirst || u > ULast`), and by `IntTools_WLineTool::DecompositionOfWLine`, which
   splits the walk line at points lying on a parametric boundary. For a sphere,
   cylinder or torus that boundary is the `u = 0` seam meridian of the *primitive's own
   local frame*. Where the locus crosses no seam, the single vertex of the resulting
   closed edge sits at the walker's seed point instead.
2. **The parameter range** depends on which API you called, not on the geometry:
   `BRepAlgoAPI_Section` sets `Approximation(false)` and returns a degree-1 polyline
   BSpline with knots `0 … N-1` (`GeomInt_IntSS::MakeBSpline`), while
   `BRepAlgoAPI_Cut/Fuse/Common` leave `BOPAlgo_SectionAttribute`'s default `true` and
   return an approximated BSpline on `0 … 1`.
3. **The reported orientation** (`Edge.is_forward`, which flips `position_at(u)` to
   `1-u`) is whichever of the two face usages of the section edge the topology explorer
   reaches first: `Shape.entities()` de-duplicates by `hash(TopoDS_Shape)`, which
   ignores orientation, so the winner is decided by the face order the boolean
   assembler produced (`BOPAlgo_ShellSplitter::MakeShells`).

### This is not "a kernel version difference" - it is visible inside one kernel

Rotating a sphere **about its own axis** produces the geometrically identical solid
(volumes below agree to 2 ppm), but moves the sphere's parametric seam, and with it the
seam of the section edge that `examples/projection.py` uses as a text path:

| sphere rotated about Z | result volume | `arch_path.position_at(0)` | `arch_path.tangent_at(0)` |
|---|---|---|---|
| 0 deg | 215833.806 | (48.99, 0, 10) | (0, -1, 0) |
| 45 deg | 215834.659 | (35.33, 35.33, 1.77) | (0.659, -0.675, 0.332) |
| 90 deg | 215835.916 | (0, 49.49, -7.14) | (1, 0, 0) |
| 180 deg | 215833.694 | (-48.99, 0, 10) | (0, 1, 0) |
| 270 deg | 215834.257 | (0, -49.49, -7.14) | (-1, 0, 0) |

The text therefore starts up to 98 mm away and wraps the other way round for an
edit the user cannot see. The same experiment on `examples/joints.py` - rotating the
*subtracted* cylinder about its own axis, again an identical solid (volume 801.7636 in
every case) - moves the slider joint's axis by 3.04 mm, because the two top edges swap
`is_forward` **and** swap places in `sort_by(Axis.Z)` (their sort keys tie, so the
order came from the kernel's traversal):

| subtracted cylinder frame | top edges `is_forward` | `Axis(edge)` directions | `Edge.make_mid_way(*top, 0.67)` origin |
|---|---|---|---|
| as built | [True, False] | [(1,0,0), (-1,0,0)] | (1.522, 1.522, 10) |
| rotated 90 deg about its own axis | [True, True] | [(-1,0,0), (1,0,0)] | (4.476, -1.522, 10) |

Cross-kernel evidence, for completeness: running the same 13-case intersection battery
on OCP 7.9.3 and on an OCCT 8.0.1 build gives **identical** edge counts, split points,
orientation flags, curve types and parameter ranges (only two walk-line point counts
differ, 3982 vs 3964 and 813 vs 804, with endpoints and lengths equal to 1e-6 mm). The
loci are identical to machine precision (two-sided Hausdorff 1.9e-14 mm on a dense
sampling). So the fragility is not about kernel versions - the *rule* the kernel
follows is simply not a geometric one, and any change of primitive frames, tolerance,
operation order or kernel build can change the answer.

## What this PR adds

1. `build123d/topology/canonical.py` - a small, dependency-free module that computes a
   **canonical traversal** of a 1D shape from geometry alone. It only needs "the point
   at arc length `d`", so it can be driven by a curve, a wire or even a polyline (which
   is how it was validated against a second kernel).

   * **open** shapes start at the lexicographically smaller end point;
   * **closed** shapes start at the lexicographically smallest point of the loop and
     wind counter-clockwise about the dominant axis of the loop's area vector
     (Newell's vector area: exact for planar loops, least-squares winding axis
     otherwise);
   * positions are normalised **arc length**, which is what `position_at` already
     computes via `GCPnts_AbscissaPoint`.

   The "lexicographically smallest point" is defined as the arc-length **midpoint of
   the extremal band** `{d : x(d) <= x_min + delta}` with `delta = 1e-6 * bbox_extent`,
   with the band's ends located by bisection. That is deliberate:

   * the *location* of a smooth minimum can only be found to `O(sqrt(eps))` along the
     curve (1e-4 mm at a 50 mm radius) and depends on the sampling phase, while the
     band's ends are transversal crossings and its midpoint cancels the quadratic term
     - the residual error becomes `O(cubic)`, ~1e-5 mm, and depends only on the
     geometry;
   * a *straight* extremal side (a rectangle) then yields the middle of that side,
     which has a well-defined tangent, instead of an arbitrary corner;
   * a loop that is flat in `x` (a circle in a plane `x = const`) falls through to `y`,
     then `z`, so the rule terminates on every non-degenerate loop.

   Residual freedom is documented rather than hidden: for a loop with an exact
   symmetry mapping one candidate band onto another (a circle centred on an axis, a
   square) no geometric rule can choose, and any two answers differ only by a symmetry
   of the loop.

2. `Mixin1D.canonical()` / `Mixin1D.canonical_form()` - the same geometry, canonically
   parametrised. Open shapes keep their type; a closed shape that has to be re-seamed
   comes back as a single `Edge` built with `GeomConvert_CompCurveToBSplineCurve`
   (exact), because a closed `TopoDS_Wire` has no distinguished first edge for
   `position_at` to key off.

3. `Axis(edge, canonical=True)` - **opt-in**, default unchanged. Besides determinism it
   removes an existing inconsistency: today `Axis(edge)` reads the underlying curve at
   its first parameter and so disagrees with `edge.position_at(0)` / `tangent_at(0)`
   whenever the edge is REVERSED.

4. `Edge.make_mid_way` canonicalises its two reference edges. Their directions are
   incidental by construction - the method already tries to compensate with
   `Axis(first).is_opposite(Axis(second))` - so this replaces a heuristic with a rule.

5. `ShapeList.sort_by` breaks **ties** with a geometric key
   (rounded centre + bounding box) instead of the kernel's traversal order. The sort is
   refactored into one keyed pass, and the tie-break key is only computed when the
   primary keys actually contain duplicates, so there is no cost in the common case.

## Results

* `arch_path.canonical()` agrees across all five sphere frames above to **4e-5 mm**
  (4e-7 relative) with identical tangents.
* The `joints.py` slider axis becomes bit-identical across cutter frames.
* Running the canonical rule on the polylines of both kernels' section edges: 13 of 14
  loops give **exactly** the same seam and direction, the 14th differs by 2.6e-5 mm
  (that case is where the two kernels' walk-line point counts differ).
* 14 new tests in `tests/test_direct_api/test_canonical.py`, including the frame
  independence regressions and a kernel-free polyline test of the rule itself.
* `tests/test_direct_api` (529 tests): no change in results.

## Compatibility

The additions (`canonical`, `canonical_form`, `Axis(..., canonical=True)`) are opt-in
and cannot change existing behaviour. Two changes can:

* **`Edge.make_mid_way`** now pairs the ends of its reference edges canonically. Where
  the two edges previously came in with consistent directions, nothing changes; where
  they did not, the old result was the truncated/crossed mid-way line the docstring
  already warns about.
* **`ShapeList.sort_by` tie order.** Any code that (perhaps unknowingly) relies on the
  kernel's order for shapes with equal sort keys can see a different pick. In this
  repository's own suite exactly one test changes: `test_algebra.test_sketch_plus`
  takes `result.edges().sort_by().filter_by(GeomType.CIRCLE).first` where *every* edge
  has the same `Axis.Z` key, and now gets the arc at `x = -0.55` instead of
  `x = +0.55`. The test had frozen an arbitrary order; the assertion is equally valid
  either way once the order is defined. I am happy to split this change out into its
  own PR, or to gate it behind a keyword (`sort_by(..., stable=True)`) if you would
  rather stage it.

The argument for deterministic over incidental: today the answer depends on the
primitives' local frames, the operation order, the tolerance and the kernel build, and
none of those are visible in the model. Users cannot write a rule that predicts it, so
they hard-code the observed result and it silently breaks on an unrelated edit or an
OCP upgrade. A canonical rule is a *documented* contract: it is stated in one place, it
is computable by hand, and when it does not match intent the user can flip it in one
call (`.canonical()`, `reversed()`, `sort_by(Axis.X)`), which is impossible for a rule
that lives inside the intersector.

If a policy change is preferred over opt-in, the natural next step for 0.12 would be
`Axis(edge)` defaulting to `canonical=True` and free edges returned by
`project_to_shape`/`section` being canonicalised at the boundary of build123d, where
they are known to be kernel-produced. That is deliberately *not* done here: build123d
cannot tell a kernel-produced path from a user-drawn one, and canonicalising a path the
user drew would destroy real intent. Keeping the call explicit is what makes the
distinction expressible.

## Alternatives considered

* **Reproduce OCP 7.x's incidental choices.** Rejected: that is a reverse-engineering
  of the intersector's seam and seed selection case by case, and it changes with the
  primitives' frames anyway.
* **Anchor the seam at the point closest to a fixed reference direction from the
  loop's centroid** (transversal crossing, so also well conditioned). Rejected as the
  primary rule because it needs a best-fit plane, and picking among several crossings
  needs its own tie-break; "the lexicographically smallest point of the loop" is
  something a user can locate by eye.
* **Locate the exact lexicographic minimum instead of a band midpoint.** Rejected:
  ill-conditioned along the curve (`O(sqrt(eps))`) and sampling dependent, and it has
  no defined tangent when the extremum is a corner.
* **Native curve parameter instead of arc length.** Rejected: the native parameter is
  precisely the implementation-defined quantity (`0..2480` vs `0..1` for the same
  locus), and `position_at` is already arc-length based.
* **Merge C0-continuous free edges automatically** so that the number of edges also
  becomes kernel-independent. This is the complete fix for the case where a seam
  crossing chops the loop into a different number of pieces (rotating the cutter's
  frame in the arch example turns one 320.9 mm loop into pieces, so
  `edges().sort_by(Axis.Z)[0]` picks a 26.6 mm arc instead). It is a much larger
  change; for now the workaround is `Wire`-ing the loop back together
  (`edges_to_wires(...)`) before calling `.canonical()`, which the rule supports
  unchanged.

## Notes / adjacent bugs noticed

* `Wire.trim()` ignores the wire's `is_forward` flag: on a REVERSED closed wire it
  trims the underlying forward traversal, so `trim(0.9, 1.0)` returns the wrong piece.
* `Wire.position_at()` on a *closed* wire derives its starting edge from
  `edges().sort_by(self)`, which is not well defined for a loop; a closed wire has no
  distinguished start. This is why `canonical()` returns an `Edge` for re-seamed loops.
