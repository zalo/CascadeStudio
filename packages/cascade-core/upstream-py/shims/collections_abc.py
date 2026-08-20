# `collections.abc` shim: isinstance() targets as type TUPLES (no
# metaclasses / __instancecheck__ on MicroPython). Covers the builtin
# containers, generators and the lazy builtin iterators (filter/map/zip/
# enumerate/reversed — dev build123d's flatten_sequence must flatten a
# `filter` of edges, and validate_inputs rejects what it cannot flatten).
# KNOWN LIMIT: a custom iterable class that is not one of these
# misclassifies (ShapeList subclasses list, so it is fine).
_gen = type((_x for _x in ()))
_lazy = (filter, map, zip, enumerate, reversed)
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
