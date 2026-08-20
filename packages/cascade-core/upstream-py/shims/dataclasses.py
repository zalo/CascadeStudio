# Mini `dataclasses` shim: positional/keyword __init__ from __annotations__
# order with class-attribute defaults. No __repr__/__eq__/frozen semantics
# (frozen classes stay writable; build123d never mutates them).
# NOTE MicroPython keeps __annotations__ only when the module was compiled
# WITHOUT `from __future__ import annotations`... annotations on classes are
# collected at class-body execution; if absent, the decorated class must
# define _fields itself (the upstream-source loader's rewriteDataclassFields
# transform records the ordered field names in `_fields`).


class _Field:
    # default_factory must run PER INSTANCE (upstream BuildScope relies on it
    # so scopes never share one mutable identity Location), so field() returns
    # a marker the generated __init__ resolves.
    def __init__(self, kw):
        self.kw = kw

    def resolve(self):
        if 'default_factory' in self.kw:
            return self.kw['default_factory']()
        return self.kw.get('default', None)


def field(**k):
    return _Field(k)


def dataclass(*a, **kwargs):
    def wrap(cls):
        anns = getattr(cls, '__annotations__', {}) or {}
        names = list(getattr(cls, '_fields', None) or anns.keys())

        def __init__(self, *args, **kw):
            for i, v in enumerate(args):
                setattr(self, names[i], v)
            for n in names[len(args):]:
                if n in kw:
                    setattr(self, n, kw[n])
                elif hasattr(cls, n):
                    v = getattr(cls, n)
                    if isinstance(v, _Field):
                        v = v.resolve()
                    setattr(self, n, v)
            for n, v in kw.items():
                setattr(self, n, v)
            post = getattr(self, '__post_init__', None)
            if post is not None:
                post()
        cls.__init__ = __init__
        return cls
    if a and isinstance(a[0], type):
        return wrap(a[0])
    return wrap
