# Where free-edge seams, directions and parametrisations come from

Research record for the upstream build123d PR drafted in this directory.
Date: 2026-08-13. Kernels: **OCP 7.9.3** (native, `~/Desktop/ocjs-deps/b123d-ref-venv`)
and **OCCT 8.0.1** (opencascade.js `cascadestudio` wasm build in this repo).
build123d: **0.11.1** (the version the validation harness compares against).

---

## 0. Verdicts up front

1. **The two kernels agree.** On a 13-case intersection battery (sphere/cylinder in
   six different parametric frames, sphere/sphere, cylinder/cylinder, plane/cylinder,
   torus/plane, the `examples/projection.py` arch, a box cut by a cylinder), OCP 7.9.3
   and OCCT 8.0.1 produce the **same number of section edges, the same split points,
   the same orientation flags, the same curve types and the same parameter ranges**.
   The only differences anywhere in the battery are the *upper bound* of two
   walk-line parameter ranges (3982 vs 3964 and 813 vs 804), i.e. the intersector
   walked a handful more points; endpoints and lengths still agree to 1e-6 mm
   (Table 1).
2. **The "(0,1) native vs (0,2480) wasm" observation in
   `test/b123d-validation/kernel-orientation-experiment.md` is an API artefact, not a
   kernel difference.** `BRepAlgoAPI_Section` sets `Approximation(false)` and returns a
   *degree-1 polyline* BSpline whose knots are the walk-line indices (range `0 ... N-1`);
   a regular `BRepAlgoAPI_Cut/Fuse/Common` leaves the section attribute at its
   default `true` and returns an *approximated* BSpline with range `0 ... 1`.
   Native 7.9.3 reproduces **both** numbers depending on which of the two you call
   (Tables 1 and 2). Nothing changed between 7.9 and 8.0 here.
3. **The real defect is upstream of any kernel version**: the seam, the direction and
   even the *number* of edges of a free (section/projection) edge are functions of
   the **parametric frames of the input surfaces**, not of their geometry. Rotating a
   sphere about its own axis - the geometrically identical solid, volumes equal to
   2 ppm - moves `edge.position_at(0)` of `examples/projection.py`'s arch path by up
   to 98 mm (Table 4). Rotating the *subtracted cylinder* about its own axis moves
   `examples/joints.py`'s slider axis by 3.04 mm (Table 5a). Both are reproducible
   inside a single kernel, with no wasm involved.
4. **Canonicalisation works.** A backend-independent canonical form (seam =
   midpoint of the lexicographically extremal band, direction = counter-clockwise
   about the dominant axis of the loop's area vector, parametrisation = normalised
   arc length) makes all five sphere frames give identical measurements to
   **4e-5 mm** (Table 4) and makes the two kernels agree to **0 mm on 13 of 14 loops,
   2.6e-5 mm on the 14th** (Table 3). The joints construction becomes exactly
   frame-independent once free-edge direction *and* `ShapeList.sort_by` tie order are
   both canonicalised (Table 5).

---

## 1. Mechanism

### 1.1 Three independent leaks

| leak | what it decides | who decides it |
|---|---|---|
| **A. Seam / split points** | where a closed intersection locus is cut into edges, and hence what `position_at(0)` returns | the surface/surface *walking* algorithm: a walk stops at a parametric domain boundary of either surface, which for a sphere/cylinder/torus is its `u = 0` seam meridian |
| **B. Parametrisation** | the numeric parameter range of the curve | whether the caller asked for approximation (`BRepAlgoAPI_Section` -> no, every other boolean -> yes) |
| **C. Reported orientation** | whether `edge.is_forward` is True, i.e. whether `position_at(u)` is flipped to `1-u` | the order in which the boolean assembler's result shell is traversed: a section edge exists once but is used FORWARD by one face and REVERSED by the other, and build123d keeps whichever occurrence the explorer hits first |

### 1.2 Leak A: the seam is a surface-domain boundary crossing

Empirically (Table 1, OCP 7.9.3 and OCCT 8.0.1 alike):

* `sphere(R10) & cylinder(r5 @ x=+6)` -> **2 edges**, split at `(1, 0, +-9.9499)`.
  Those points sit exactly on the sphere's `u = 0` meridian (measured `u = 0.0 deg`).
* Move the cylinder to `x = -6` -> the loop no longer crosses the sphere's seam but
  does cross the *cylinder's* seam -> still 2 edges, now split at `(-1, 0, +-9.9499)`
  where `u_cyl = 0.0 deg`.
* Rotate only the **sphere's own X direction** to `+Y` or `-X` (identical solid!) so
  that the loop crosses neither seam -> **1 closed edge**, and its single vertex sits
  at `(9.25, 3.7997, 0)`, the walk's *seed* point (the loop's `z = 0` turning point),
  not on any seam.
* Rotate only the **cylinder's own X direction** to `+Y` -> now the loop crosses both
  seams -> **4 edges**, split at the 2 sphere-seam and the 2 cylinder-seam crossings.
* `torus & plane`, `plane & cylinder`, `sphere & sphere` (the analytic circle/ellipse
  branch) behave the same way: the closed edge starts on the periodic surface's
  `u = 0` (torus `u = 0`; cylinder `u = 0`; both spheres `u = 0`).

Same locus, four different edge decompositions, selected purely by where the
primitives' local X axes happen to point.

Code paths (paths relative to the OCCT source root; verified in the local 8.0.1
tree - the same files/functions exist under tag `V7_9_0`):

* `src/IntWalk/IntWalk_PWalking.cxx:1039-1057` - the marching loop sets
  `Arrive = true` as soon as a walked point leaves either surface's
  `[UFirst, ULast] x [VFirst, VLast]`; `IntWalk_PWalking.cxx:1861-1885` applies the
  same `UFirst/ULast` guards with `ResoU/ResoV`. For a periodic surface the domain
  boundary **is** the seam meridian, so a locus that crosses the seam is delivered as
  two or more `IntPatch_WLine`s, each starting and ending on the seam.
* `src/IntPatch/IntPatch_Intersection.cxx` (start-point search, via
  `IntPolyh_Intersection`) - chooses the walk *seed*, which is what becomes the single
  vertex of a closed edge when there is no seam crossing.
* `src/IntTools/IntTools_WLineTool.cxx:492-1314` (`DecompositionOfWLine`) - in the
  approximating branch the WLine is additionally **split at points that lie on a
  parametric boundary**: the per-point test at lines 560-615 walks both surfaces and
  both parameters, asks `aGASurface->IsUPeriodic()/UPeriod()`, normalises with
  `GeomInt::AdjustPeriodic` (line 590) and cuts the point list wherever
  `bIsCurrentPointOnBoundary` changes (lines 616-635).
* `src/IntTools/IntTools_LineConstructor` (used as `myLConstruct` in
  `IntTools_FaceFace.cxx`) - cuts the line further by the *face* restrictions; that is
  what turns the `sph_sph` circle into two half circles (`0..pi`, `pi..2pi`).

### 1.3 Leak B: parametrisation is an argument, not a kernel version

* `src/BRepAlgoAPI/BRepAlgoAPI_Section.cxx:132` sets `myApprox = false`, and
  `:211-212` pushes it into the pave filler
  (`BOPAlgo_SectionAttribute theSecAttr(myApprox, ...); myDSFiller->SetSectionAttribute(...)`).
* `src/BOPAlgo/BOPAlgo_SectionAttribute.hxx:25-29` - the **default** constructor is
  `myApproximation(true)`, so `BRepAlgoAPI_Cut/Fuse/Common` (which never touch the
  attribute) do approximate.
* `src/BOPAlgo/BOPAlgo_PaveFiller_6.cxx:327-328,506` - `PerformFF` reads
  `mySectionAttribute.Approximation()` into `bApprox` and hands it to
  `IntTools_FaceFace::SetParameters(bApprox, ...)`.
* `src/IntTools/IntTools_FaceFace.cxx:1184-1223` - `if (!myApprox)` builds the curve
  with `GeomInt_IntSS::MakeBSpline(WL, ifprm, ilprm)`;
  `src/GeomInt/GeomInt_IntSS_1.cxx:1452-1470` shows this is a **degree-1** BSpline
  whose poles are the walk-line points and whose knots are `knots(i) = i-1`, hence a
  parameter range of `0 ... NbPnts-1`. That is the `0..2480` (2481 poles) figure.
* `src/IntTools/IntTools_FaceFace.cxx:1224-1360` - the `else` branch runs
  `IntTools_WLineTool::DecompositionOfWLine` and then `GeomInt_WLApprox`
  (`ApproxInt_Approx`), with the parametrisation type chosen by
  `ApproxInt_KnotTools::DefineParType(...)` (`Approx_ChordLength` by default),
  producing smooth degree <= 8 BSplines on `0 ... 1` - the `0..1` / 135-268 poles
  figures in Table 2.

Both kernels do this identically; Table 1 (Section) and Table 2 (Cut) come from the
same battery on the same kernels.

### 1.4 Leak C: orientation of a section edge in a boolean result

A section edge is created **once**, FORWARD, by `BOPTools_AlgoTools::MakeSectEdge`
(`src/ModelingAlgorithms/TKBO/BOPTools/BOPTools_AlgoTools_2.cxx:102`) during
`BOPAlgo_PaveFiller::PostTreatFF` (`src/BOPAlgo/BOPAlgo_PaveFiller.hxx:322`). The two
faces that share it then each receive it with whatever orientation closes their wire -
`BOPAlgo_BuilderFace` (`src/BOPAlgo/BOPAlgo_BuilderFace.cxx:250`) via
`BOPAlgo_WireSplitter::SplitBlock` (`src/BOPAlgo/BOPAlgo_WireSplitter.hxx:62`) - and
the faces are collected into shells by `BOPAlgo_ShellSplitter::MakeShells`
(`src/BOPAlgo/BOPAlgo_ShellSplitter.cxx:621`).

Consequence for build123d: a `TopExp_Explorer` over the result returns the same edge
twice, once FORWARD and once REVERSED (visible in the raw dumps - e.g. `b123d_arch`
cut, indices 1 FORWARD and 4 REVERSED, identical curve). `Shape.entities()`
(`topology/shape_core.py:3805-3816`) de-duplicates with `out[hash(item)] = item`, and
`hash(TopoDS_Shape)` **ignores orientation** (verified: `hash(e) == hash(e.Reversed())`
is `True`), so **the first occurrence in the explorer's order wins**. The reported
`is_forward` - and therefore `position_at`'s `u -> 1-u` flip - is decided by the face
order inside the result shell, an internal of the boolean assembler.

That is the mechanism behind the `REVERSED vs FORWARD` note in `defaults-audit.md`;
it is *not* a difference in the intersection curve, and on the raw battery the two
kernels even agree on it.

### Table 1 - `BRepAlgoAPI_Section` edge inventory (OCP 7.9.3 native | OCCT 8.0.1 wasm)

| case | edges | param ranges (7.9.3) | split points | u on operand frames (deg) | 8.0.1 agrees? |
|---|---|---|---|---|---|
| sph_cyl_xp6 | 2 x BSpline | 0..2480; 0..1318 | (1, -0, 9.94987); (1, 0, -9.94987) | sphere0=0, cyl1=180; sphere0=0, cyl1=180 | identical |
| sph_cyl_xm6 | 2 x BSpline | 0..1972; 0..3964 | (-1, -0, -9.94987); (-1, -0, 9.94987) | sphere0=180, cyl1=0; sphere0=180, cyl1=0 | identical |
| sph_cyl_yp6 | 2 x BSpline | 0..3344; 0..3964 | (5, 6, -6.245); (5, 6, 6.245) | sphere0=50.1944, cyl1=0; sphere0=50.1944, cyl1=0 | param range[1] 3982 vs 3964 |
| sph_cyl_xp6_seam90 | 1 x BSpline | 0..1981 | (9.25, 3.79967, 0) | sphere0=-67.6684, cyl1=49.4584 | identical |
| sph_cyl_xp6_seam180 | 1 x BSpline | 0..1981 | (9.25, 3.79967, 0) | sphere0=-157.668, cyl1=49.4584 | identical |
| sph_cyl_xp6_cylseam90 | 4 x BSpline | 0..602; 0..804; 0..804; 0..3964 | (6, 5, -6.245); (6, 5, -6.245); (6, 5, 6.245); (1, 0, 9.94987) | sphere0=39.8056, cyl1=0; sphere0=39.8056, cyl1=0; sphere0=39.8056, cyl1=0; sphere0=0, cyl1=90 | param range[1] 813 vs 804, param range[2] 813 vs 804 |
| sph_sph | 2 x Circle | 0..3.14159; 3.14159..6.28318 | (6.1, 0, 7.92401); (6.1, -0, -7.92401) | sphere0=0, sphere1=0; sphere0=0, sphere1=0 | identical |
| cyl_cyl | 2 x BSpline | 0..691; 0..691 | (5, -0, -7); (5, -0, 7) | cyl0=0, cyl1=-90; cyl0=0, cyl1=90 | identical |
| plane_cyl | 1 x Ellipse | 1.5708..7.85398 | (10, -0, 0) | cyl0=0 | identical |
| torus_plane | 2 x Circle | 0..6.28318; 0..6.28318 | (25.6569, 0, 2); (14.3431, 0, 2) | torus0=0; torus0=0 | identical |
| bspl_sph | - | - | - | - | wasm probe error (missing binding), not a kernel difference |
| b123d_arch | 1 x BSpline | 0..3475 | (48.9898, -0, 10) | sphere0=0, cyl1=90 | identical |
| box_cyl_cut | 4 x Circle | 0..3.14159; 5..15; 5..15; 0..3.14159 | (-5, 2.5, 0); (-5, 2.5, -0); (-5, -2.5, 0); (5, 2.5, 0) | ; ; ; | identical |

`u on operand frames` is the angle of the split point around each operand's own axis,
measured from that operand's parametric X direction: `0` means "on the `u = 0` seam".
Note the `_seam90` / `_seam180` rows: **identical geometry**, seam rotated, one closed
edge instead of two, split point moved off the seam onto the walk seed. (`bspl_sph`,
a non-periodic BSpline surface against a sphere, ran natively: the loop crosses the
sphere seam once, so it arrives as 2 edges - one boundary at the seam, one at the walk
seed - confirming the seed's role. The wasm side needs a handle up-cast the probe does
not do; irrelevant to the conclusions.)

### Table 2 - the same battery through `BRepAlgoAPI_Cut` (approximation ON, OCP 7.9.3)

| case | intersection edges (deduped) | param range | poles/degree | seam point |
|---|---|---|---|---|
| sph_cyl_xp6 | 4 | 0..1; 0..1; 0..1 | 135/8; 149/8; 135/8 | (1, 0, -9.94987); (1, -0, 9.94987); (1, 0, -9.94987) |
| sph_cyl_xm6 | 4 | 0..1; 0..1; 0..1 | 142/8; 156/8; 142/8 | (-1, -0, -9.94987); (-1, -0, 9.94987); (-1, -0, -9.94987) |
| sph_cyl_yp6 | 4 | 0..1; 0..1; 0..1 | 240/8; 86/7; 240/8 | (5, 6, -6.245); (5, 6, 6.245); (5, 6, -6.245) |
| sph_cyl_xp6_seam90 | 2 | 0..1; 0..1 | 268/8; 268/8 | (9.25, 3.79967, 0); (9.25, 3.79967, 0) |
| sph_cyl_xp6_cylseam90 | 8 | 0..1; 0..1; 0..1 | 156/8; 51/8; 38/7 | (1, 0, 9.94987); (6, 5, -6.245); (6, 5, -6.245) |
| cyl_cyl | 4 | 0..1; 0..1; 0..1 | 107/6; 107/6; 107/6 | (5, 0, 7); (5, 0, 7); (5, -0, -7) |
| b123d_arch | 2 | 0..1; 0..1 | 156/8; 156/8 | (48.9898, -0, 10); (48.9898, -0, 10) |

Same split points as Table 1, different parametrisation (`0..1`, approximated) - and
each edge appears twice, once FORWARD once REVERSED (leak C).

---

## 2. The canonical form

### 2.1 Requirements

* computable from geometry alone: no kernel internals, no surface parametrisation, no
  construction history; the only primitive needed is "give me the point at arc length
  `d`";
* deterministic and *well conditioned*: two computations of the same locus, from
  different discretisations or different kernels, must agree well inside a modelling
  tolerance;
* cheap: `O(1)` for the common case (an open edge), one pass of a few hundred curve
  evaluations for a closed loop;
* tie-breaking rules stated exhaustively.

### 2.2 The rule

Let `p(d)` be the shape's existing orientation-aware arc-length parametrisation
(build123d's `position_at` in `PositionMode.PARAMETER` is already normalised arc
length - `Mixin1D._occt_param_at` goes through `GCPnts_AbscissaPoint`), `L` its
length, `TOL` the modelling tolerance (1e-6 mm), and `delta = 1e-6 * diag` where
`diag` is the largest bounding-box extent of the loop.

**Open shapes** (`|p(0) - p(L)| > TOL`): traverse from the end whose `(x, y, z)` tuple
is lexicographically smaller. Ties are impossible - equal keys mean the ends coincide,
i.e. the shape is closed.

**Closed shapes**:

1. *Direction.* Sample `M = 512` points by arc length, take the vector area
   `A = 1/2 sum (p_i - c) x (p_i+1 - c)` (Newell; exact for planar loops, the
   least-squares winding axis otherwise), pick the axis `k` with the largest `|A_k|`
   (exact comparison, preferring X then Y then Z on ties) and require `A_k > 0`: the
   loop winds counter-clockwise seen from `+k`. If `|A_k| <= TOL^2` (a degenerate,
   self-cancelling loop) keep the incoming direction.
2. *Seam.* For coordinate `c` in `(x, y, z)`:
   * find every **local minimum** of `c` over the sampled loop (plateaus - a straight
     extremal side - collapse to one representative), and refine each one's *value* by
     a 40-iteration golden section; the value of a smooth minimum is well conditioned
     even though its location is not;
   * let `m` be the smallest of those values. If every sample is within `delta` of `m`
     the loop is flat in this coordinate: continue to the next one (this is what makes
     a circle in the plane `x = const` fall through to `y`);
   * every local minimum within `delta` of `m` defines a **band**
     `{d : c(p(d)) <= m + delta}` around it. Refine each band's two ends by
     **bisection** on `c(p(d)) = m + delta` (a transversal crossing, hence full
     precision) and reduce the band to its **arc-length midpoint**;
   * rank those midpoints by the *remaining* coordinates, each **quantised to
     `delta`**, and take the smallest; that point is the seam. Stop.
   * if all three coordinates are flat, the loop is a point: seam `= 0`.

   Both the band discovery and the ranking are deliberately phrased on the *bands*
   rather than on the samples that happen to fall inside them: a band is usually
   narrower than the sampling step, so "the smallest `y` among a band's samples"
   would be a function of the sampling phase - and therefore of the incoming
   parametrisation, which is the very thing being canonicalised (see section 3.3).
3. *Parametrisation.* Normalised arc length from the seam in the canonical direction.

Why a *band midpoint* rather than the extremum itself: for `c(s) = m + a s^2 + ...`
the extremum's *location* can only be found to `O(sqrt(eps/a))` - for a 50 mm radius
and `eps = 1e-12` that is already 1e-4 mm of along-curve wobble, and it depends on the
sampling phase. The band's ends are transversal crossings, so each is exact, and their
midpoint cancels the quadratic term: the residual is `O(b*delta/a^2)` from the cubic
term (~1e-5 mm for the same geometry) and depends only on the geometry and `delta`,
not on the discretisation or the kernel. It also handles a *straight* extremal side
gracefully - the seam becomes the middle of the flat side, which has a well-defined
tangent, instead of an arbitrary corner.

Why normalised **arc length** rather than the curve-native parameter: the native
parameter is exactly the quantity that is implementation-defined (Table 1 vs Table 2:
`0..2480` vs `0..1` for the same locus), whereas arc length is a geometric invariant -
and build123d already resolves `position_at` through `GCPnts_AbscissaPoint`, so this
part of the rule is a no-op in terms of behaviour.

**Residual freedom, stated honestly.** If a loop has a symmetry that maps one
candidate band onto another so that *all* remaining coordinates of their midpoints
agree to within `delta` (a circle centred on an axis, a square), no geometric rule can
break the tie - by definition of symmetry. The implementation keeps the first candidate in the incoming traversal
order, so the result is stable for a given input and any two answers differ only by a
symmetry of the loop. The same caveat applies to `_dominant_axis` when two `|A_k|`
are equal to the last bit (a loop whose plane exactly bisects two axes).

### 2.3 Does it unify the kernels? Yes.

`experiments/cross_kernel.py` takes the 401-point polylines both probes dumped for
every section edge, stitches them into loops **geometrically**, and runs the same
`canonical_form()` on both - nothing in that path touches a kernel.

### Table 3 - canonical form computed from polylines of BOTH kernels

| case/loop | Hausdorff (mm) | raw start 7.9.3 | raw start 8.0.1 | canonical seam | canonical heading | seam delta (mm) | same direction |
|---|---|---|---|---|---|---|---|
| sph_cyl_xp6[0] | 0.00e+00 | (1, -0, 9.94987) | (1, 0, 9.94987) | (1, 0.000288, -9.94987) | (0.0131, 0.9999, 0.0079) | 0.00e+00 | True |
| sph_cyl_xm6[0] | 0.00e+00 | (-1, -0, -9.94987) | (-1, 0, -9.94987) | (-9.25, -3.79967, 0) | (0.1003, -0.0831, -0.9915) | 0.00e+00 | True |
| sph_cyl_yp6[0] | 1.99e-05 | (5, 6, -6.245) | (5, 6, -6.245) | (-4.99998, 5.98964, -6.25493) | (0.0053, 0.7191, 0.6949) | 0.00e+00 | True |
| sph_cyl_xp6_seam90[0] | 0.00e+00 | (9.25, 3.79967, 0) | (9.25, 3.79967, 0) | (1.00019, -0.03848, -9.94976) | (0.0031, 1, 0.0019) | 0.00e+00 | True |
| sph_cyl_xp6_seam180[0] | 0.00e+00 | (9.25, 3.79967, 0) | (9.25, 3.79967, 0) | (1.00019, -0.03848, -9.94976) | (0.0031, 1, 0.0019) | 0.00e+00 | True |
| sph_cyl_xp6_cylseam90[0] | 9.04e-05 | (1, -0, -9.94987) | (1, 0, -9.94987) | (1.00001, 0.00549, -9.94987) | (0.0076, 1, 0.0046) | 2.60e-05 | True |
| sph_sph[0] | 0.00e+00 | (6.1, 0, 7.92401) | (6.1, 0, 7.92401) | (6.1, -7.92401, 0) | (0, 0.0039, -1) | 0.00e+00 | True |
| cyl_cyl[0] | 0.00e+00 | (5, -0, -7) | (5, 0, -7) | (-4.99991, 0.02484, -6.99993) | (0.0091, -0.9999, 0.0065) | 0.00e+00 | True |
| cyl_cyl[1] | 0.00e+00 | (5, -0, 7) | (5, 0, 7) | (-4.99991, 0.02484, 6.99993) | (0.0091, -0.9999, -0.0065) | 0.00e+00 | True |
| plane_cyl[0] | 0.00e+00 | (10, -0, 0) | (10, 0, 0) | (-10, 0, 0) | (0.007, -0.8944, 0.4472) | 0.00e+00 | True |
| torus_plane[0] | 0.00e+00 | (25.6569, 0, 2) | (25.6569, 0, 2) | (-25.6569, 0, 2) | (0.0079, -1, 0) | 0.00e+00 | True |
| torus_plane[1] | 0.00e+00 | (14.3431, 0, 2) | (14.3431, 0, 2) | (-14.3431, 0, 2) | (0.0079, -1, 0) | 0.00e+00 | True |
| b123d_arch[0] | 0.00e+00 | (48.9898, -0, 10) | (48.9898, 0, 10) | (-48.9884, 0.352759, 9.99905) | (0.0015, -1, -0.0011) | 0.00e+00 | True |
| box_cyl_cut[0] | 0.00e+00 | (5, 2.5, -0) | (5, 2.5, 0) | (-5, 0, 2.5) | (0, -1, -0.0075) | 0.00e+00 | True |

Hausdorff is two-sided point-to-*segment* over the stitched polylines, so it measures
the loci rather than the sampling; <= 9e-5 mm is polyline discretisation, consistent
with the 1.9e-14 mm figure from the denser measurement in
`test/b123d-validation/kernel-orientation-experiment.md`. The canonical seams here
inherit that discretisation too (`b123d_arch` lands 0.35 mm off `y = 0`); the accuracy
figures that matter come from the curve-based implementation below.

### 2.4 Does it unify the *frames*? Yes - and that is the stronger claim.

Patched build123d against geometrically identical variants:

### Table 4 - `examples/projection.py` arch path, sphere rotated about its own axis

| sphere rotation | result volume | raw position_at(0) | raw tangent_at(0) | canonical position_at(0) | canonical position_at(0.25) |
|---|---|---|---|---|---|
| 0deg | 215833.806 | (48.9898, -0, 10) | (-0, -1, -0) | (-48.9898, 0, 10) | (-0, -49.4872, -7.14286) |
| 45deg | 215834.6589 | (35.3331, 35.3331, 1.77447) | (0.658505, -0.675197, 0.332386) | (-48.9898, -4e-05, 10) | (4e-05, -49.4872, -7.14286) |
| 90deg | 215835.9162 | (0, 49.4872, -7.14286) | (1, 0, -0) | (-48.9898, -0, 10) | (0, -49.4872, -7.14286) |
| 180deg | 215833.6942 | (-48.9898, 0, 10) | (-0, 1, 0) | (-48.9898, 0, 10) | (0, -49.4872, -7.14286) |
| 270deg | 215834.2566 | (-0, -49.4872, -7.14286) | (-1, -0, 0) | (-48.9898, 0, 10) | (-0, -49.4872, -7.14286) |

Raw `position_at(0)` follows the sphere's meridian exactly (45 deg ->
`(35.33, 35.33)`); canonical agrees across all five frames to **4e-5 mm** (4e-7
relative) with an identical tangent. Volumes differ by <= 2 ppm - the solids are the
same.

### Table 5a - `examples/joints.py` BEFORE (unmodified build123d 0.11.1)

| subtracted cylinder frame | top edges is_forward | Axis(edge) directions | make_mid_way(0.67) axis origin |
|---|---|---|---|
| taper3.0_cylrot0 | [True, False] | [[1, 0, 0], [-1, 0, 0]] | (1.52181, 1.52181, 10) |
| taper3.0_cylrot90 | [True, True] | [[-1, 0, 0], [1, 0, 0]] | (4.47592, -1.52181, 10) |

### Table 5 - `examples/joints.py` AFTER (canonical `make_mid_way` + deterministic sort ties)

| cylinder frame | solid volume | top edge is_forward | make_mid_way(0.67) start |
|---|---|---|---|
| 0deg | 801.7636 | [True, False] | (-4.47592, 1.52181, 10) |
| 90deg | 801.7636 | [True, True] | (-4.47592, 1.52181, 10) |
| 180deg | 801.7636 | [True, False] | (-4.47592, 1.52181, 10) |

The joints case needed **two** fixes, and finding that out was the main surprise of
Part 2: canonicalising the edges alone was not enough, because
`edges().filter_by(Axis.X).sort_by(Axis.Z)[-2:]` returns two edges with *equal* sort
keys and Python's stable sort then preserves the kernel's traversal order. Rotating
the cutter swapped the two, so `make_mid_way(a, b, 0.67)` measured 67% from the other
edge and the slider axis moved 3.04 mm. Breaking sort ties with a geometric key
closes it.

### 2.5 Scope limits (honest)

* Canonicalising a *single* edge cannot repair a case where the loop is chopped into a
  different *number* of edges, because `edges().sort_by(...)[i]` then selects a
  different piece altogether (measured: rotating the cutter's frame in the arch case
  turns the 320.9 mm closed loop into pieces, and `sort_by(Axis.Z)[0]` picks a
  26.6 mm arc). The fix is to reassemble the loop first (`edges_to_wires(...)` ->
  `Wire.canonical()`); the rule itself works on wires unchanged. Automatic merging of
  C0-continuous free edges would be the complete answer and is deliberately out of
  scope here.
* Exact symmetries leave the seam defined only up to the symmetry group (section 2.2).
* The canonical seam of a re-seamed *closed* shape can only be represented
  unambiguously by an `Edge`: a closed `TopoDS_Wire` has no distinguished first edge,
  and build123d's `Wire.position_at` derives one via `edges().sort_by(self)`, which is
  itself order-fragile. The patch therefore returns a concatenated single `Edge`
  (`GeomConvert_CompCurveToBSplineCurve`, exact) when a closed shape must be
  re-seamed. Related upstream bug found on the way: `Wire.trim()` ignores the wire's
  `is_forward` flag - it trims the underlying forward traversal.

---

## 3. The patches

Three independent-as-possible patches against build123d **dev** @ `ef48b98`,
regenerable with `experiments/apply_stack.py <package> <tests> <canonical.py> a|b|c`.
One PR description each, next to this file.

| # | branch / diff | targets | size | contents |
|---|---|---|---|---|
| 1 | `sort-by-tie-break`, `patch/1-sort-by-tie-break.diff` | `dev` | **+70/-11** | `ShapeList.sort_by(..., tie_break=True)` (opt-in) + `_geometric_key`, 2 tests in the existing `test_shape_list.py` |
| 2 | `canonical-free-edges-v2`, `patch/2-canonical-free-edges.diff` | `dev` | **+622/-4** | the rule (`topology/canonical.py`, 253 lines) + `Mixin1D.canonical()`/`canonical_form()` and their four helpers (`one_d.py`, +145) + `tests/test_direct_api/test_canonical.py` (222 lines, 31 cases) |
| 3 | `canonical-consumers`, `patch/3-canonical-consumers.diff` | patch 2 | **+79/-14** | `Axis(edge, canonical=True)` (opt-in) and `Edge.make_mid_way` canonicalising its references, + 3 tests |

Patches 1 and 2 are independent of each other; 3 needs 2. Total +771/-29, against
+1001/-61 for the single patch this replaces - the saving is mostly a mechanical
`sort_by` refactor that turned out to be avoidable (`sorted()` is stable, so making
the *incoming* order geometric is enough) plus `pytest.mark.parametrize` over the
frame x traversal x shape matrices.

### 3.0 What the rule costs, and why

`topology/canonical.py` is 253 lines: 43 of file header and license, ~54 of
docstrings, and **86 executable lines**. Those 86 are mostly *conditioning*, not
rule:

| device | executable lines | why it is not optional |
|---|---|---|
| seam = arc-length midpoint of the extremal band, ends bisected | ~34 | the location of a smooth minimum is only computable to `O(sqrt(eps))` along the curve and moves with the sampling; a band's ends are transversal crossings that bisect exactly, and their midpoint cancels the quadratic term. It also gives a straight extremal side a defined seam (its middle) rather than an arbitrary corner. |
| bands = local minima of the sampled coordinate, plateaus collapsed, levels refined by a parabolic fit | ~22 | a band is usually narrower than the sampling step, so thresholding samples misses bands whose samples sit just above the level, and a sampled value alone can sit far above the true minimum |
| candidate bands compared through their midpoints, coordinates quantised to the band width | ~8 | comparing samples inside a band makes the answer a function of the sampling phase; comparing raw floats lets the last bits of a mirror-symmetric pair decide instead of the next coordinate |
| winding from the loop's area vector + dominant axis | ~10 | a geometric direction rule; exact for planar loops, least-squares normal otherwise |
| open-edge case, degenerate guards, assembly | ~12 | |

Section 3.3 is the evidence that none of the three conditioning devices is
decoration: an earlier draft omitted all three and the seam moved with the
sampling phase and the traversal direction.

The PRs target **gumyr/build123d `dev`**; the diffs are generated from that branch.
The research above was done against 0.11.1 (the version the validation harness
compares against) and the adaptation to `dev` needed exactly one change - see
section 3.1.

Test results on `dev` (OCP 7.9.3):

| suite | pristine dev | patch 1 | patch 2 | patches 2+3 |
|---|---|---|---|---|
| `tests/test_direct_api` | 1169 passed, 2 skipped | **1171** | **1200** | **1207** |
| rest of `tests/` | 1037 passed, 1 skipped | 1037, 1 skipped | 1037, 1 skipped | 1037, 1 skipped |

No failures anywhere, and `tests/test_examples.py` (which builds every example)
passes 115/115 as it does on pristine `dev`.

No upstream test needed changing: the sort tie-break is opt-in (see section 3.2), so
default behaviour - including chained sorts - is unchanged.

### 3.1 What drifted between 0.11.1 and dev

Only one thing, and it was fatal in a quiet way: **`Vector.to_tuple()` was removed**
(it is `@deprecated` in 0.11.1). Consequences and fixes:

* `canonical.py` used `vector.to_tuple()[index]` in five places -> now a tiny
  `_coordinate(vector, index)` helper reading `.X/.Y/.Z`.
* `_canonical_sort_key` in `shape_core.py` built its key from
  `center().to_tuple()` and `box.min/max.to_tuple()`. It raised `AttributeError`,
  which the original `except (ValueError, TypeError, AttributeError, AssertionError)`
  **swallowed**, so the function silently returned `()` for every shape: all keys
  became equal, the tie-break degraded back to the kernel's order and the two
  determinism tests failed while everything else looked fine. The tie-break key no
  longer catches `AttributeError` at all - a future API rename fails loudly instead
  of degrading into non-determinism.

Nothing else drifted: every anchor the patch generator edits
(`Mixin1D.common_plane`, `edges_to_wires`, `Edge.make_mid_way`, `Axis.__init__`,
`ShapeList.sort_by`, the `OCP.GeomConvert` and `build123d.geometry` import lists)
still matches `dev` byte for byte, and the rule's semantics are unchanged from
section 2.2.

### 3.2 Two things `dev` taught us about the sort tie-break

Adapting to `dev` also ran the patch against a much larger suite (2200+ tests vs the
529 available for 0.11.1), and that changed the design of the tie-break twice.

**a) Cost.** The first key used `shape.center()` **and** `shape.bounding_box()`.
Measured over 297 text glyph edges (OCP 7.9.3): `center()` 2.44 ms per pass,
`bounding_box()` 7.94 ms, raw vertex coordinates 1.18 ms. Because
`sort_by(Axis.Z)` on planar geometry ties on *every* element, that key was paid for
every shape:

| 200 sorts of 297 edges | pristine dev | centre+bbox key | vertex key | vertex key, opt-in (final) |
|---|---|---|---|---|
| `sort_by(Axis.Z)` (everything ties) | 1.26 s | 3.42 s | 1.98 s | 1.17 s |
| `sort_by(Axis.X)` (few ties) | 1.21 s | 3.34 s | 1.46 s | 1.17 s |
| `sort_by(SortBy.LENGTH)` | 0.079 s | 2.04 s | 0.245 s | 0.071 s |

**b) Default-on breaks a legitimate idiom.** `examples/heat_exchanger.py` does

```python
heat_exchanger.edges().filter_by(GeomType.CIRCLE)
    .sort_by(SortBy.RADIUS).sort_by(Axis.Z, reverse=True)[2 * tube_count : 3 * tube_count]
```

- a **chained** sort that relies on Python's stable sort to keep the radius order
inside each equal-Z group. A default tie-break destroys that ordering, the slice
selects different edges, and the example's `assert abs(fillet_volume - 469.883...)`
fails. That is a real, reasonable pattern, so the tie-break became **opt-in**
(`sort_by(..., tie_break=True)`): with the default the sort is byte-for-byte the old
stable sort (benchmark column 4 above), and the geometric order is available where
the caller knows the incoming order is meaningless.

The consequence for `examples/joints.py` is stated honestly in the PR: the edge-level
half of the fix (`Edge.make_mid_way` canonicalising its references) is automatic, but
selecting the two tied top edges deterministically needs the caller to ask -
`sort_by(Axis.Z, tie_break=True)` - which is a one-line change in the example. This
is also why the earlier `test_algebra.test_sketch_plus` edit is **no longer part of
the patch**: with the default unchanged, that test passes as written.

### 3.3 Three defects the lite port's cross-kernel harness found (and their fixes)

`test/b123d-validation/canonical-cross-kernel.mjs` checks canonical agreement *and*
frame consistency inside each kernel, and it caught this branch failing its own
premise: take the `sphere(10)` / `cylinder(r5, x=6)` section loop, reassemble it into
a `Wire` and reverse that Wire - the reversal canonicalised to the **other** seam of
the loop and wound the other way. Reproducible on OCP 7.9.3 alone. Three separate
causes, all of the same species (a decision made on numerical noise before the
decisive quantity is consulted):

| # | defect | fix |
|---|---|---|
| 1 | `Mixin1D.canonical()` tested "already canonical" as `form.start <= TOLERANCE/length` **without wrapping** `form.start`. A band midpoint landing an epsilon *below* 1.0 is the same point as one above 0.0, so a loop already seamed at its own start (measured `start = 1 - 8e-9`) took the re-seam path. | Test the **circular** distance, and do it at the resolution the seam is defined to (the band width, from the shape's bounding box) - demanding more precision than the rule's own resolution re-seams by nanometres on every call. A closed shape that only needs its direction flipped now keeps its topology instead of being concatenated. |
| 2 | `_walk_loop` ranked candidate pieces by **raw end-point distance before the tangent**. At a loop's seam the two pieces meet at one vertex, so both distances are noise: measured, the piece heading *along* the canonical direction was 8.9e-16 away and the piece heading *against* it 0.0 - so the loop was walked backwards. | Rank on "is the gap closed at all" -> tangent -> gap. |
| 3 | Candidate bands were discovered by thresholding **samples**, and ranked by the minima of whichever samples fell inside them. A band narrower than the sampling step holds a single sample whose `y` can be 14 microns off the band's own minimum, and a band whose samples all sit just above the threshold is missed entirely - which is how the mirror-symmetric pair of bands on this loop resolved differently in different frames. | Discover bands as the **local minima** of the sampled coordinate (plateaus collapsed), reduce each to its bisection-refined **midpoint**, and rank the midpoints with the coordinates **quantised to the band width**, so a mirror-symmetric pair ties on `y` and `z` decides. |

Result on the motivating loop - which arrives as 1, 2 or 4 Edges depending on the
sphere's frame - measured over 7 sphere rotations x both traversals:

| | before | after |
|---|---|---|
| frame/traversal combinations agreeing | 4 / 14 | **14 / 14** |

The published evidence is unchanged: Table 4 (the arch path) still agrees across all
five sphere frames to 4e-5 mm, Table 5 (joints) is still bit-identical, and the
cross-kernel comparison in Table 3 still gives 13 of 14 loops at exactly 0 mm with the
14th at 2.6e-5 mm. What *did* change are the canonical seams of the loops whose
extremal band comes in a mirror-symmetric pair (`sph_cyl_xp6`, `sph_cyl_xm6`,
`cyl_cyl`, `box_cyl_cut` in Table 3): they now land on the arc the rule prescribes -
the one whose midpoint has the smaller `z` once `y` ties - instead of on whichever arc
the sampling phase favoured. Any recorded expectation of the old values needs
refreshing (`test/b123d-validation/canonical-cross-kernel.json` is regenerated by its
own harness).

---

## 4. Reproducing

```bash
V=~/Desktop/ocjs-deps/b123d-ref-venv/bin/python          # OCP 7.9.3
cd docs/upstream-canonical-edges/experiments

# Rebuild the three branches from a pristine dev checkout:
#   git clone --depth 1 -b dev https://github.com/gumyr/build123d /tmp/b123d-pr
#   cd /tmp/b123d-pr
#   for p in a b c; do
#     python3 .../experiments/apply_stack.py src/build123d tests \
#             .../patch/src/build123d/topology/canonical.py $p
#   done                       # or apply patch/{1,2,3}-*.diff with patch -p1
#   PYTHONPATH=$PWD/src $V -m pytest tests/test_direct_api -q

$V probe_native.py > native.json                          # battery on OCP 7.9.3
node probe_wasm.mjs                                       # same battery on OCCT 8.0.1 wasm (~10 s boot)
$V demo_b123d.py                                          # frame dependence, UNPATCHED build123d

./repatch.sh                                              # copy 0.11.1 into /tmp/b123d-0111 and patch it
PYTHONPATH=/tmp/b123d-0111 $V cross_kernel.py             # canonical form from both kernels' polylines
PYTHONPATH=/tmp/b123d-0111 $V test_canon.py               # unification tables
PYTHONPATH=/tmp/b123d-0111 $V -m unittest discover \
  -s ../patch/tests/test_direct_api -p test_canonical.py   # the 14 new upstream tests
```

## 5. Follow-up found while porting the rule to a second kernel

The rule was subsequently ported into CascadeStudio's build123d-lite (OCCT 8.0.1
wasm) with the same names and defaults, and cross-checked against the patched
upstream on OCP 7.9.3 over the arch, a reassembled sphere/cylinder locus and the
joints construction: **185 canonical measurements, worst delta 0.00e+0 mm**
(`test/b123d-validation/canonical-cross-kernel.mjs`; reference generated by
`experiments/lite_cross_kernel.py`). Two things worth fixing before the PR
lands, both reproducible in the patched upstream alone:

1. **`canonical()`'s "already canonical" early return needs `form.start` modulo
   1.** The test is `form.sign > 0 and form.start <= TOLERANCE / length`, so a
   seam that lands on the incoming shape's *own* start point (measured
   `form.start = 1 - 3.8e-11`) is not recognised and the shape is re-seamed
   unnecessarily.
2. **`_walk_loop`'s first choice is not tolerant.** Its score is
   `((edge.position_at(0) - position).length, -edge.tangent_at(0).dot(heading))`,
   and the two edges meeting at a seam-on-a-vertex are both ~1e-16 away, so the
   distance term decides by floating point noise and the tangent term - which is
   what actually knows the intended direction - never gets a look in. Observed:
   the piece heading *along* `direction` was 8.9e-16 away while the piece heading
   *against* it was 0.0 away, so the loop was walked backwards. Snapping the
   distance to a tolerance (e.g. comparing `round(distance / gap_tolerance)`)
   fixes it.

Symptom of the pair: for `sphere(R10)` cut by a `cylinder(r5)` along X at z = 3,
reassembled with `edges_to_wires`, the unrotated frame canonicalises to the
*opposite* winding from the 90°/180° frames - i.e. exactly the frame dependence
the patch removes elsewhere. Rotating the same wire reproduces it inside 7.9.3.

Not fixed in the port, which mirrors the patch byte-for-byte; the harness
records it instead.

`repatch.sh` still targets the installed 0.11.1 (`SP=...` to override) and is kept
for the 0.11.1 measurements in sections 1 and 2; `apply_stack.py` is what generates
the three PR branches. `patch/src/...` holds the resulting files in full (shape_core
from patch 1, everything else from patches 2+3) for reading without applying
anything. Local OCCT 8.0.1 sources for the citations:
`~/Desktop/ocjs-deps/occt/src`.
