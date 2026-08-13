# Add `ShapeList.sort_by(..., tie_break=True)`

*Target branch: `dev`. Independent of the other two patches. +70/−11 lines.*

## Problem

Objects that tie on a sort criterion keep their incoming order. That is a useful
contract - it is what makes chained sorts such as
`.sort_by(SortBy.RADIUS).sort_by(Axis.Z)` work, and `examples/heat_exchanger.py`
depends on it - but for shapes that came out of a boolean operation the *incoming*
order is the CAD kernel's traversal order. That order depends on the parametric
frames of the surfaces involved and on the order the boolean assembler visited the
result's faces, so two geometrically identical solids can hand back the same two
edges in the opposite order.

`examples/joints.py` hits exactly this:

```python
base_top_edges = base.edges().filter_by(Axis.X, tolerance=30).sort_by(Axis.Z)[-2:]
...
s1 = LinearJoint("slide", base, axis=Axis(Edge.make_mid_way(*base_top_edges, 0.67)))
```

Both edges have the same `Axis.Z` key. Rotating the subtracted cylinder about its
own axis - the geometrically identical solid, volume equal to 1e-10 - swaps them,
`make_mid_way` measures its 67 % from the other one, and the slider joint moves by
3.04 mm.

## What this adds

`tie_break=True` orders the tied objects by geometry instead of by arrival:
sorted vertex positions, then the center for shapes that share their vertices
(two arcs spanning the same end points), rounded to `TOL_DIGITS` so that geometry
agreeing to within tolerance always sorts the same way.

Because `sorted()` is stable, this is implemented by making the *incoming* order
geometric rather than by rewriting the sort: one extra line in the body, one
helper, and the eight existing branches only change `self` to `candidates`.

## Compatibility and cost

The default is `False` and nothing changes: same stable sort, same keys, and the
geometric key is never computed. 200 sorts of 297 text glyph edges, OCP 7.9.3:

| | `dev` | this patch, default | `tie_break=True` |
|---|---|---|---|
| `sort_by(Axis.Z)` (every element ties) | 1.168 s | 1.168 s | 2.1 s |
| `sort_by(SortBy.LENGTH)` | 0.071 s | 0.069 s | 0.3 s |

The opt-in path pays a vertex-and-center key per object; it is a deliberate
trade for a much smaller diff than computing keys only for the tied subsets.

I first tried this with the tie-break **on** by default and the suite showed why
that is wrong: `heat_exchanger.py` uses
`.sort_by(SortBy.RADIUS).sort_by(Axis.Z, reverse=True)[2*n:3*n]`, and breaking
ties geometrically made it fillet different edges (its `fillet_volume` assertion
fails). Ties carrying the incoming order is worth keeping as the default.

## Tests

Two tests in `tests/test_direct_api/test_shape_list.py`, next to the existing
`sort_by` ones:

* `test_sort_by_tie_break` - the same two tied edges, handed in either order, sort
  the same way,
* `test_sort_by_keeps_ties_in_order_by_default` - the default keeps arrival order
  and the chained-sort idiom still works.

`tests/test_direct_api`: 1169 -> 1171 passed, 2 skipped, no failures. Rest of
`tests/`: unchanged (1037 passed, 1 skipped).
