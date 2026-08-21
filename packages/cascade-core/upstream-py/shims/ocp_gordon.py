# `ocp_gordon` stub: upstream two_d.py imports interpolate_curve_network at
# module level. The REAL Gordon-surface path in this app is lite's JS port
# (GordonSurface.js, w.GordonSurfaceFace) — the pytopo=upstream worker glue
# overrides Face.make_gordon_surface to use it, so this function is only
# reached if that override is missing. Raise honestly.


def interpolate_curve_network(profiles, guides, tolerance=3e-4):
    raise NotImplementedError(
        'ocp_gordon.interpolate_curve_network: use Face.make_gordon_surface '
        '(served by the GordonSurface.js port) — the standalone ocp_gordon '
        'package is not available in this runtime')
