# Functional `typing` shim for running UPSTREAM build123d source on
# MicroPython (which has no typing module).
# Everything subscriptable returns itself; Generic[...] resolves to a
# subclassable base. Replaces lite's minimal typing shim in sys.modules
# AFTER lite has imported (one shared module instance otherwise).
#
# When the interpreter supports custom metaclasses (the custom
# micropython-cs build), Generic is a REAL class whose metaclass __getitem__
# returns the class itself: `class Builder(ABC, Generic[T])` then works
# unmodified, subclasses INHERIT the metaclass, and `class B(Builder[Part])`
# is legal Python at runtime — which is what lets the upstream-b123d loader
# retire its class-base-subscript transform. On the stock artifacts Generic
# falls back to the old subscript-to-`object` stand-in (and the loader keeps
# the transform).
TYPE_CHECKING = False


class _Sub:
    def __init__(self, name):
        self._name = name

    def __getitem__(self, item):
        return self

    def __call__(self, *a, **k):
        return _Sub(self._name)

    def __repr__(self):
        return 'typing.' + self._name


class _SubBase:
    # subscript -> a plain subclassable base
    def __init__(self, name):
        self._name = name

    def __getitem__(self, item):
        return object


def _cs_probe_metaclasses():
    class _M(type):
        pass
    try:
        exec("class _C(metaclass=_M):\n    pass", {'_M': _M})
        return True
    except TypeError:
        return False


if _cs_probe_metaclasses():
    class _GenericMeta(type):
        # class subscription: Generic[T] (and Subclass[T]) -> the class
        def __getitem__(cls, item):
            return cls

    class Generic(metaclass=_GenericMeta):
        pass
else:
    Generic = _SubBase('Generic')

Protocol = object


def TypeVar(name, *a, **k):
    return _Sub('TypeVar:' + name)


def ParamSpec(name, *a, **k):
    return _Sub('ParamSpec:' + name)


def NewType(name, tp):
    return lambda x: x


def overload(f):
    return f


def final(f):
    return f


def runtime_checkable(c):
    return c


def cast(t, v):
    return v


def no_type_check(f):
    return f


def get_type_hints(*a, **k):
    return {}


def get_args(tp):
    return ()


def get_origin(tp):
    return None


Any = _Sub('Any')
SupportsIndex = _Sub('SupportsIndex')
Union = _Sub('Union')
Optional = _Sub('Optional')
Callable = _Sub('Callable')
Iterable = _Sub('Iterable')
Iterator = _Sub('Iterator')
Sequence = _Sub('Sequence')
Mapping = _Sub('Mapping')
MutableMapping = _Sub('MutableMapping')
List = _Sub('List')
Dict = _Sub('Dict')
Set = _Sub('Set')
FrozenSet = _Sub('FrozenSet')
Tuple = _Sub('Tuple')
Type = _Sub('Type')
ClassVar = _Sub('ClassVar')
Literal = _Sub('Literal')
Annotated = _Sub('Annotated')
TypeAlias = _Sub('TypeAlias')
Self = _Sub('Self')
Never = _Sub('Never')
NoReturn = _Sub('NoReturn')
Collection = _Sub('Collection')
Hashable = _Sub('Hashable')
Sized = _Sub('Sized')
IO = _Sub('IO')
TextIO = _Sub('TextIO')
BinaryIO = _Sub('BinaryIO')


class NamedTuple:
    pass
