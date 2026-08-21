# HONEST svgpathtools stub (pysrc=real on Pyodide): build123d's exporters.py
# builds the module-level TypeAlias `PT.Line | PT.Arc | ...` at import time
# (so these MUST be classes), and importers.py calls svg2paths at runtime.
# SVG path export/import has no filesystem in the browser worker; any USE
# raises loudly.


class _Unavailable:
    def __init__(self, *a, **k):
        raise NotImplementedError(
            'svgpathtools.' + type(self).__name__ + ' is not available in '
            'the browser worker (pysrc=real ships an import-satisfying stub)')


class Line(_Unavailable):
    pass


class Arc(_Unavailable):
    pass


class QuadraticBezier(_Unavailable):
    pass


class CubicBezier(_Unavailable):
    pass


class Path(_Unavailable):
    pass


def svg2paths(*a, **k):
    raise NotImplementedError(
        'svgpathtools.svg2paths is not available in the browser worker')


def __getattr__(name):
    if name.startswith('__'):
        raise AttributeError(name)
    raise NotImplementedError(
        'svgpathtools.' + name + ' is not available in the browser worker')
