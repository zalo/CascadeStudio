# HONEST numpy stub: allows `import numpy as np` (objects_curve imports it
# at module level but only Airfoil uses it). Any USE raises loudly instead
# of producing fake numbers. (The settrace-ulab MicroPython build could
# serve real numpy-like arrays later — see INVENTORY.md.)
class _NumpyMissing:
    def __getattr__(self, name):
        raise NotImplementedError(
            'numpy is not available in the MicroPython runtime '
            '(needed by numpy.' + name + ')')


pi = 3.141592653589793
_missing = _NumpyMissing()


def __getattr__(name):
    # MicroPython has no PEP 562; this works only if accessed via the module
    # object's instance attributes — kept for documentation; the class-level
    # fallback below is what actually fires.
    return getattr(_missing, name)


class ndarray:
    pass


def _raise(name):
    raise NotImplementedError(
        'numpy.' + name + ' is not available in the MicroPython runtime')


def linspace(*a, **k):
    _raise('linspace')


def array(*a, **k):
    _raise('array')


def zeros_like(*a, **k):
    _raise('zeros_like')


def empty_like(*a, **k):
    _raise('empty_like')


def arctan(*a, **k):
    _raise('arctan')


def sqrt(*a, **k):
    _raise('sqrt')


def cos(*a, **k):
    _raise('cos')


def sin(*a, **k):
    _raise('sin')
