# Why "edge orientation" differs between OCP 7.9 and OCCT 8.0.1 wasm

Controlled experiment (2026-08-13): identical sphere(R10) ∩ cylinder(r5 at
x=+6, axis Z) `BRepAlgoAPI_Section` on both kernels, dumping every section
edge's TopAbs orientation, curve parameter range, and midpoint/derivative.

| | OCP 7.9.3 (native venv) | OCCT 8.0.1 (CascadeStudio wasm) |
|---|---|---|
| edges | 2, both FORWARD | 2, both FORWARD |
| curve ranges | (0, 1) — normalized approx curves | (0, 2480) / (0, 1318) |
| split (seam) points | near (1, 0, ±9.95) | different points entirely |

Findings:

1. On a raw Section, the orientation flag does NOT differ. What changed in
   OCCT 8.0 is the intersection-curve construction itself: parametrization
   (normalized 0..1 in 7.9 vs knot-count-scale ranges in 8.0.1) and the
   choice of where the closed intersection curve is split into edges.
2. The REVERSED-vs-FORWARD difference recorded in defaults-audit.md for the
   projection scripts arises in the BRepProj / curve-on-surface path — a
   downstream artifact of the same rewritten intersection machinery.
3. Root cause statement: orientation, seam placement, and parametrization of
   free section/projection edges are implementation-defined outputs, not API
   contracts (orientation is only meaningful relative to a face). Upstream
   build123d's `Axis(edge)` / `position_at` on such edges inherits OCP 7.x's
   incidental choices. Our geometry is identical; the traversal start/
   direction consumed by those APIs is not.
4. Consequence: a principled "match 7.x" canonicalization is not derivable —
   it would mean reverse-engineering incidental internals case by case. The
   4 affected scripts remain COMPROMISE(edge-orientation), with this file as
   the mechanism record.

Repro scripts: the native and wasm dumps are one-liners embedded in the
session history; reconstruct with BRepAlgoAPI_Section + BRep_Tool.Curve as
above (wasm ctor variants: gp_Dir_5(x,y,z), gp_Ax2_4(P,V),
BRepPrimAPI_MakeCylinder_3(ax,r,h), BRepAlgoAPI_Section_3(s1,s2,true)).

## Addendum: locus identity measurement

Two-sided discrete Hausdorff distance between 800-point samplings of the
section curves from both kernels: **1.93e-14 in both directions** — machine
epsilon. The intersection loci are geometrically identical; ALL divergence
between kernels is parametric (seam placement, parameter scale, traversal
direction). XOR of the raw curves/shapes would leave zero residual volume;
XOR of the final mismatched scenes shows residual only because scripts
consume the parametrization for *placement* (slot-end axis direction,
position_at from the seam), relocating identical components.

Implication: canonicalizing seams/orientation in lite would make results
kernel-stable going forward but cannot reproduce OCP 7.x's incidental
choices, so the 4 reference mismatches remain COMPROMISE(edge-orientation).

## CORRECTION (see docs/upstream-canonical-edges/REPORT.md for the full story)

The parametrization claim above — "(0,1) native vs (0,2480) wasm" — was an
API artefact, NOT a kernel difference: BRepAlgoAPI_Section defaults
Approximation(false) (degree-1 polyline, knots 0..N-1) while the BOP used
inside Cut/Fuse/Common defaults to approximated 0..1 curves. Native 7.9.3
produces BOTH forms depending on the call. The kernels agree on the full
13-case battery (two walk-line point-count deltas aside). The REAL leaks are:
(1) seam splits where the surface/surface walk exits a surface's parametric
domain (primitive local frames decide!), (2) build123d's orientation-
insensitive entity dedup making "first face explored" decide FORWARD vs
REVERSED, and (3) ShapeList.sort_by tie order falling back to kernel
traversal order. Mechanism citations and the canonicalization patch live in
docs/upstream-canonical-edges/.
