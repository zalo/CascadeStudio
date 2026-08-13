

@pytest.mark.parametrize(
    "edge",
    [
        Edge.make_line((0, 0, 0), (10, 0, 0)),
        Edge.make_line((10, 0, 0), (0, 0, 0)),
        Edge.make_line((0, 0, 0), (10, 0, 0)).reversed(),
    ],
    ids=["forward", "built backwards", "reversed flag"],
)
def test_canonical_axis_from_edge(edge):
    """Axis(edge, canonical=True) agrees with the canonical Edge - including for a
    REVERSED Edge, where the default disagrees with position_at(0)."""
    axis, canonical = Axis(edge, canonical=True), edge.canonical()
    assert tuple(axis.position) == pytest.approx(tuple(canonical.position_at(0)), abs=1e-6)
    assert tuple(axis.direction) == pytest.approx(tuple(canonical.tangent_at(0)), abs=1e-6)
    assert tuple(axis.direction) == pytest.approx((1, 0, 0), abs=1e-6)


def test_legacy_axis_from_edge_ignores_orientation():
    """The default is unchanged: it reads the underlying curve, so a REVERSED
    Edge gives an Axis that disagrees with the Edge's own start."""
    edge = Edge.make_line((0, 0, 0), (10, 0, 0)).reversed()
    assert tuple(edge.position_at(0)) == pytest.approx((10, 0, 0), abs=1e-6)
    assert tuple(Axis(edge).position) == pytest.approx((0, 0, 0), abs=1e-6)


@pytest.mark.parametrize("rotation", [0, 90, 180])
def test_make_mid_way_is_frame_independent(rotation):
    """examples/joints.py measures its slider axis from a mid way Edge between two
    top edges.  Rotating the subtracted cylinder about its own axis is the
    identical solid, but it flips those edges' directions."""
    with BuildPart() as part:
        with BuildSketch():
            Rectangle(10, 10)
        extrude(amount=10, taper=3)
        Cylinder(2.5, 10, rotation=(0, 90, rotation), mode=Mode.SUBTRACT)
    solid = Solid(part.part.wrapped)
    top = solid.edges().filter_by(Axis.X, tolerance=30).sort_by(Axis.Z)[-2:]
    # pick the two tied edges deterministically, so only make_mid_way is tested
    top = sorted(top, key=lambda edge: tuple(edge.canonical().position_at(0)))
    mid_way = Edge.make_mid_way(*top, 0.67)
    assert tuple(mid_way.position_at(0)) == pytest.approx(
        (-4.475922, 1.521814, 10), abs=1e-5
    )
