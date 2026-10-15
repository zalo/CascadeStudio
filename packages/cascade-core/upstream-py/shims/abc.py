# `abc` shim: ABC as a plain base, abstractmethod as identity. Abstractness
# is NOT enforced (instantiating an incomplete subclass fails only when the
# missing method is called) — build123d never relies on the enforcement.
#
# ABCMeta derives from the typing shim's _GenericMeta when the interpreter
# has custom metaclasses: MicroPython has no __class_getitem__, so the shim's
# Generic is METACLASS-subscriptable, which makes every Generic subclass
# (upstream Shape -> Part ...) carry _GenericMeta. build123d 0.13's
# `class BasePartObject(Part, BaseObject)` then mixes that with
# BaseObject's BaseObjectMeta(ABCMeta) — in CPython Part's metaclass is plain
# `type`, so BaseObjectMeta is trivially most-derived; here it is only when
# ABCMeta is a _GenericMeta subclass (else: "metaclass conflict").
try:
    from typing import _GenericMeta as _MetaBase
except ImportError:
    _MetaBase = type


class ABC:
    pass


def abstractmethod(f):
    return f


class ABCMeta(_MetaBase):
    pass


def abstractproperty(f):
    return property(f)
