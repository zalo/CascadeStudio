# Metaclass-free `enum` shim (MicroPython has no custom metaclasses, so
# EnumMeta cannot exist). Members declared as `auto()` (or plain int/str
# UPPER_CASE class attributes) are converted into bound member objects by a
# post-import pass: _finalize_enums(module) — called by the upstream-b123d
# loader right after `build123d.build_enums` is registered.
#
# Fidelity vs CPython enum (audited against build123d Level-A usage):
#   Member.name / Member.value / repr()       -> supported
#   identity comparison (mode != Mode.PRIVATE)-> supported (singletons)
#   Cls.__members__ / Cls._member_names_      -> supported (set by finalize)
#   iteration over the CLASS (for m in Mode)  -> NOT supported (needs a
#       metaclass); use Cls.__members__.values()
#   value lookup Cls(value)                   -> NOT supported (class call
#       constructs); build123d Level A avoids it except geometry's
#       to_align_offset, which lite's adapter geometry module reimplements.


class _Member:
    _auto_counter = [0]

    def __init__(self):
        _Member._auto_counter[0] += 1
        self._value_ = _Member._auto_counter[0]
        self._name_ = '?'
        self._cls_name_ = '?'

    @property
    def name(self):
        return self._name_

    @property
    def value(self):
        return self._value_

    def __repr__(self):
        return '<' + self._cls_name_ + '.' + self._name_ + '>'

    def __str__(self):
        return self._cls_name_ + '.' + self._name_


def auto():
    return _Member()


def unique(cls):
    return cls


class Enum:
    pass


class IntEnum(Enum):
    pass


class Flag(Enum):
    pass


class IntFlag(Enum):
    pass


def _finalize_enum_class(cls):
    members = {}
    order = []
    for k in dir(cls):
        if k.startswith('_'):
            continue
        v = getattr(cls, k)
        if isinstance(v, _Member):
            v._name_ = k
            v._cls_name_ = cls.__name__
            members[k] = v
            order.append(k)
        elif isinstance(v, (int, float, str, tuple)) and k.upper() == k:
            inst = _Member()
            inst._name_ = k
            inst._cls_name_ = cls.__name__
            inst._value_ = v
            setattr(cls, k, inst)
            members[k] = inst
            order.append(k)
    order.sort()
    cls.__members__ = members
    cls._member_names_ = order
    return cls


def _finalize_enums(mod):
    # MicroPython has no metaclasses: convert class attributes after import
    for attr in dir(mod):
        cls = getattr(mod, attr)
        if isinstance(cls, type) and issubclass(cls, Enum) \
                and cls not in (Enum, IntEnum, Flag, IntFlag):
            _finalize_enum_class(cls)
