# Use the canonical traversal in `Axis(edge)` and `Edge.make_mid_way`

*Target branch: the `Mixin1D.canonical()` patch (PR 2). +79/−14 lines.*

## Why this is separate

PR 2 adds a rule and two methods that nothing calls. This one puts them to work in
the two places where build123d consumes a free edge's *incidental* direction. It
is split out because it is the only part with any behavioural reach: a reviewer can
take the rule first and decide about the consumers afterwards.

## `Axis(edge, canonical=True)` - opt-in

The default is unchanged. It reads the underlying curve at its first parameter,
which depends on construction history and - separately from all the kernel
discussion - disagrees with the Edge's own start whenever the Edge is REVERSED:

```python
edge = Edge.make_line((0, 0, 0), (10, 0, 0)).reversed()
edge.position_at(0)    # (10, 0, 0)
edge.tangent_at(0)     # (-1, 0, 0)
Axis(edge).position     # (0, 0, 0)   <- disagrees
Axis(edge).direction    # (1, 0, 0)   <- disagrees
```

With `canonical=True` the Axis comes from the edge's canonical traversal, so it
agrees with `position_at(0)`/`tangent_at(0)` and geometrically identical edges give
identical axes. I have kept it opt-in rather than flipping the default because for
a *drawn* line the construction order is real intent - `Axis(Edge.make_line(b, a))`
meaning "from b to a" is a reasonable thing to have written - and build123d cannot
tell a drawn edge from a kernel-produced one. Making the call explicit is what
makes that distinction expressible.

## `Edge.make_mid_way` - default

`make_mid_way(first, second, middle)` now canonicalises its two reference edges.
Their directions are incidental *by construction*: the method already tried to
compensate for that with `Axis(first).is_opposite(Axis(second))` and a conditional
`1 - i` on the second edge, which is a heuristic for exactly this problem. Using
the rule instead is a strict improvement: where the two edges already arrived with
consistent directions nothing changes, and where they did not the old result was
the truncated/crossed mid way line the docstring already warns about.

This is what `examples/joints.py` needs. Rotating the subtracted cylinder about
its own axis - the identical solid - used to flip the directions of the two top
edges the slider joint is measured from.

Selecting those two *tied* edges deterministically is the other half of that
example and needs `ShapeList.sort_by(..., tie_break=True)`, which is a separate,
independent patch; the test here sorts them explicitly so that only
`make_mid_way` is under test.

## Tests

Three added to `tests/test_direct_api/test_canonical.py`:

* `test_canonical_axis_from_edge` (3 parametrised constructions) - the canonical
  Axis matches the canonical Edge, and both agree for a forward edge, an edge built
  backwards and an edge carrying a REVERSED flag,
* `test_legacy_axis_from_edge_ignores_orientation` - pins the unchanged default,
* `test_make_mid_way_is_frame_independent` (3 cutter frames) - the mid way edge
  lands in the same place for every frame of the identical solid.

`tests/test_direct_api`: 1200 -> 1207 passed, 2 skipped, no failures. Rest of
`tests/`: unchanged (1037 passed, 1 skipped).
