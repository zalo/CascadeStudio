# Functional `typing` shim for running UPSTREAM build123d source on
# MicroPython (which has no typing module and no metaclasses).
# Everything subscriptable returns itself; Generic[...] resolves to a plain
# subclassable base. Replaces lite's minimal typing shim in sys.modules
# AFTER lite has imported (one shared module instance otherwise).
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
