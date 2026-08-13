# `Mixin1D.canonical()`: a geometric start point for free edges

*Target branch: `dev`. Independent of PR 1; PR 3 builds on this one.
+622/−4 lines (253 new module, 145 integration, 222 tests).*

## Problem

The seam, traversal direction and parameter range of an edge that build123d did
not draw - one produced by `cut`/`fuse`/`intersect`, `section`,
`project_to_shape`, or `Shape.edges()` after a boolean - are **implementation
defined outputs of the CAD kernel**, and they leak into results through
`position_at`, `tangent_at`, `location_at` and `Axis(edge)`.

Three mechanisms, verified against the OCCT sources and reproduced on OCP 7.9.3
and an OCCT 8.0.1 build (the two agree, so this is not a version issue):

1. **Where a closed intersection curve is cut into edges** is decided by the
   surface/surface walk, which stops when it leaves either surface's parametric
   domain (`IntWalk_PWalking.cxx`: `Arrive = true` when `u < UFirst || u > ULast`),
   and by `IntTools_WLineTool::DecompositionOfWLine`, which splits the walk line
   at points lying on a parametric boundary. For a sphere, cylinder or torus that
   boundary is the `u = 0` meridian of the *primitive's own local frame*. Where the
   locus crosses no seam, the closed edge's single vertex sits at the walker's
   seed point instead.
2. **The parameter range** depends on which API was called, not on the geometry:
   `BRepAlgoAPI_Section` sets `Approximation(false)` and returns a degree-1
   polyline BSpline with knots `0..N-1` (`GeomInt_IntSS::MakeBSpline`), while
   `Cut`/`Fuse`/`Common` keep `BOPAlgo_SectionAttribute`'s default `true` and
   return an approximated BSpline on `0..1`.
3. **The reported orientation** (`Edge.is_forward`, which flips `position_at(u)` to
   `1-u`) is whichever of the two face usages of the section edge the topology
   explorer reaches first: `Shape.entities()` de-duplicates by a hash that ignores
   orientation, so the winner is the face order the boolean assembler produced.

None of that is visible in the model, so a user cannot predict it - only observe
it, hard-code the observed result, and have it break on an unrelated edit.
Rotating a sphere about its own axis (the geometrically identical solid, volumes
equal to 2 ppm) moves the start of `examples/projection.py`'s text path by up to
98 mm:

| sphere rotated about Z | result volume | `arch_path.position_at(0)` |
|---|---|---|
| 0 deg | 215833.806 | (48.99, 0, 10) |
| 45 deg | 215834.659 | (35.33, 35.33, 1.77) |
| 90 deg | 215835.916 | (0, 49.49, −7.14) |
| 180 deg | 215833.694 | (−48.99, 0, 10) |

## What this adds

`Mixin1D.canonical()` returns the same geometry with a start point and direction
that follow from the geometry:

* open shapes start at the lexicographically smaller end point,
* closed shapes start at the lexicographically smallest point of the loop and wind
  counter-clockwise about the dominant axis of their area vector,
* positions are normalised arc length, which `position_at` already computes via
  `GCPnts_AbscissaPoint`.

`Mixin1D.canonical_form()` exposes the same answer without rebuilding the shape.
`topology/canonical.py` holds the rule and imports nothing from OCP: it needs only
a point-at-arc-length callable, so it applies to an Edge, a Wire or a polyline -
and is tested against a hand computed square with no kernel involved.

```python
# a text path that does not depend on how the sphere happens to be parametrised
arch = sphere.cut(cylinder).edges().sort_by(Axis.Z)[0].canonical()
```

Measured: the path above agrees across five sphere frames to **4e-5 mm** with
identical tangents, and a sphere/cylinder loop reassembled into a `Wire`
canonicalises identically for seven sphere rotations x both traversals.

## Why the module is 253 lines

86 of those are executable; the rest is the file header, the license block and
docstrings. The executable part is mostly *conditioning*, and that is the part
worth reviewing:

| device | lines | why it is not optional |
|---|---|---|
| seam = arc-length **midpoint of the extremal band** `{d : x(d) <= x_min + 1e-6·extent}`, ends located by bisection | ~34 | the location of a smooth minimum is only computable to `O(sqrt(eps))` along the curve and moves with the sampling; a band's ends are transversal crossings that bisect exactly, and their midpoint cancels the quadratic term. It also gives a straight extremal side a defined seam (its middle) instead of an arbitrary corner. |
| bands found as **local minima** of the sampled coordinate, plateaus collapsed, levels refined by a parabolic fit | ~22 | a band is usually narrower than the sampling step; thresholding samples misses bands whose samples all sit just above the level, and the sampled value alone can sit far above the true minimum |
| candidate bands compared through **their own midpoints**, coordinates **quantised to the band width** | ~8 | comparing the samples inside a band makes the choice a function of the sampling phase; comparing raw floats lets the last bits of a mirror-symmetric pair (a sphere/cylinder loop has one) pick the winner instead of letting the next coordinate decide |
| winding from the loop's area vector + dominant axis | ~10 | a geometric direction rule, exact for planar loops and the least-squares normal otherwise |
| open-edge case, degenerate guards, rule assembly | ~12 | |

Without those, "canonical" still moves with the sampling - which is the very
thing being removed. An earlier draft of this patch had all three defects and the
tests below pin each of them.

## Scope limits, stated plainly

* Canonicalising a single edge cannot repair a case where the *number* of edges
  differs between frames, because `edges().sort_by(...)[i]` then selects a
  different piece; reassemble the loop first (`edges_to_wires`) and canonicalise
  the `Wire`. Automatic merging of C0-continuous free edges would be the complete
  answer and is out of scope here.
* A loop with a symmetry that maps one extremal band onto another so that all
  remaining coordinates of their midpoints agree to within tolerance has a seam
  defined only up to that symmetry - by definition of symmetry.
* A closed shape that has to be re-seamed comes back as a single `Edge`
  (concatenated exactly with `GeomConvert_CompCurveToBSplineCurve`): a closed
  `TopoDS_Wire` has no distinguished first edge, and `Wire.position_at` derives one
  from `edges().sort_by(self)`, which is itself order-fragile.

## Compatibility

Pure addition: `canonical()` and `canonical_form()` are new methods and nothing
existing calls them. PR 3 wires them into `Axis(edge, canonical=True)` and
`Edge.make_mid_way` separately, so this patch can be merged on its own.

## Tests

`tests/test_direct_api/test_canonical.py`, 31 cases, `pytest.mark.parametrize`
over the frame x traversal x shape-type matrices. Named regressions for the three
ways an earlier draft let noise decide:

* `test_seam_already_at_the_start_is_not_reseamed` - the "already canonical" test
  is a circular distance, so a band midpoint an epsilon below 1.0 is recognised as
  the same point as one above 0.0,
* `test_reseamed_loop_leaves_the_seam_forwards` - the pieces of a re-seamed loop
  are ordered by tangent, not by raw end-point distances, which at a seam are
  floating point noise,
* `test_seam_does_not_depend_on_the_frame_or_the_sampling` - every frame of one
  locus agrees, including the frames where it arrives as 1, 2 or 4 Edges,
* plus `test_reversed_wire_canonicalizes_the_same_way` - a Wire and the same Wire
  reversed, which is the shortest reproduction of all three.

`tests/test_direct_api`: 1169 -> 1200 passed, 2 skipped, no failures. Rest of
`tests/`: unchanged (1037 passed, 1 skipped).
