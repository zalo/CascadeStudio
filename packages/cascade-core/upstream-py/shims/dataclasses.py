# Mini `dataclasses` shim: positional/keyword __init__ from __annotations__
# order with class-attribute defaults. No __repr__/__eq__/frozen semantics.
# NOTE MicroPython keeps __annotations__ only when the module was compiled
# WITHOUT `from __future__ import annotations`... annotations on classes are
# collected at class-body execution; if absent, the decorated class must
# define _fields itself (none of build123d Level A does).
def field(**k):
    if 'default_factory' in k:
        return k['default_factory']()
    return k.get('default', None)


def dataclass(*a, **k):
    def wrap(cls):
        anns = getattr(cls, '__annotations__', {}) or {}
        names = list(anns.keys())

        def __init__(self, *args, **kw):
            for i, v in enumerate(args):
                setattr(self, names[i], v)
            for n in names[len(args):]:
                if n in kw:
                    setattr(self, n, kw[n])
                elif hasattr(cls, n):
                    setattr(self, n, getattr(cls, n))
            for n, v in kw.items():
                setattr(self, n, v)
        cls.__init__ = __init__
        return cls
    if a and isinstance(a[0], type):
        return wrap(a[0])
    return wrap
