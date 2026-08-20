"""build123d-lite scipy shim: ONLY scipy.optimize.minimize/minimize_scalar
(pure-Python Nelder-Mead / golden-section) and scipy.spatial ConvexHull (3-D)
/ Voronoi (2-D, .vertices only) exist — COMPROMISE(scipy-shim). Everything
else raises at runtime."""
