# `collections.abc` shim: isinstance() targets as type TUPLES (no
# metaclasses / __instancecheck__ on MicroPython). Covers the builtin
# containers plus generators. KNOWN LIMIT: a custom iterable class that is
# not one of these misclassifies (ShapeList subclasses list, so it is fine).
# NOTE: stock MicroPython silently returns False for NESTED classinfo tuples,
# so `isinstance(x, (SomeClass, Iterable))` with these tuple-valued names
# breaks there; the custom micropython-cs interpreter build fixes nested
# tuples natively (CPython semantics).
_gen = type((_x for _x in ()))
_lazy = (map, zip, filter, enumerate, reversed)  # lazy-iterator builtins
Iterable = (list, tuple, set, frozenset, dict, range, str, bytes, _gen) + _lazy
Sequence = (list, tuple, range, str, bytes)
Mapping = (dict,)
Callable = type(lambda: 0)
Iterator = (_gen,) + _lazy
Hashable = object
Sized = (list, tuple, set, dict, str, bytes)
Collection = (list, tuple, set, frozenset, dict, range, str, bytes)
MutableMapping = (dict,)
MutableSequence = (list,)
MutableSet = (set,)
