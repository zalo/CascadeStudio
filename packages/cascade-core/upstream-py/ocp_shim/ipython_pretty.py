# IPython.lib.pretty shim (pytopo=upstream): upstream shape_core imports
# pretty/RepresentationPrinter for notebook display only.


def pretty(obj, *a, **k):
    return repr(obj)


class RepresentationPrinter:
    def __init__(self, *a, **k):
        pass

    def text(self, *a, **k):
        pass

    def pretty(self, obj):
        pass
