# HONEST sympy stub: allows `import sympy` (objects_curve module level; only
# ArcArcTangentArc uses it). Any USE raises loudly.
def _raise(name):
    raise NotImplementedError(
        'sympy.' + name + ' is not available in the MicroPython runtime')


def Circle(*a, **k):
    _raise('Circle')


def Point(*a, **k):
    _raise('Point')


def N(*a, **k):
    _raise('N')


def intersection(*a, **k):
    _raise('intersection')
