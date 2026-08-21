# `enum` shim for running UPSTREAM build123d source on MicroPython.
#
# TWO implementations, feature-detected at import (the custom micropython-cs
# interpreter supports custom metaclasses; the stock npm artifacts do not):
#
#   * metaclass path — a real EnumMeta: members are realized AT CLASS
#     CREATION as instances of their enum class, and the class object itself
#     supports iteration (`for m in Mode`), `Cls[name]`, `x in Cls`,
#     `len(Cls)` and value lookup `Cls(value)` through the metaclass.  No
#     post-import pass is needed (the upstream-b123d loader detects the
#     capability and skips `_finalize_enums`).
#   * fallback path (metaclass-free) — members declared as `auto()` (or
#     plain int/str UPPER_CASE class attributes) are converted into bound
#     member objects by a post-import pass: _finalize_enums(module), called
#     by the loader right after `build123d.build_enums` is registered.
#     Iteration over the CLASS and value lookup `Cls(value)` are NOT
#     supported there (build123d Level A avoids them except geometry's
#     to_align_offset, which lite's adapter geometry module reimplements).
#
# Common fidelity (audited against build123d Level-A usage):
#   Member.name / Member.value / repr()       -> supported
#   identity comparison (mode != Mode.PRIVATE)-> supported (singletons)
#   Cls.__members__ / Cls._member_names_      -> supported


# Bridge to build123d-lite's plain-class "enums": the seam (lite methods)
# compares enum kwargs against ITS values (strings/tuples), while upstream
# code passes THESE members. _Member.__eq__ resolves the lite value of the
# same Class.NAME through a lookup the topology adapter installs, so e.g.
# upstream Kind.INTERSECTION == lite Kind.INTERSECTION is True on both sides
# (Python falls back to the reflected __eq__ for lite_value == member).
# On the metaclass path Enum SUBCLASSES _Member, so the seam's
# `isinstance(v, enum._Member)` checks cover both implementations.
_LITE_LOOKUP = [None]


def _cs_set_lite_lookup(fn):
    _LITE_LOOKUP[0] = fn


class _Member:
    _auto_counter = [0]

    def __init__(self):
        _Member._auto_counter[0] += 1
        self._value_ = _Member._auto_counter[0]
        self._name_ = '?'
        self._cls_name_ = '?'

    def __eq__(self, other):
        if self is other:
            return True
        if isinstance(other, _Member):
            return False  # members are singletons
        look = _LITE_LOOKUP[0]
        if look is not None:
            lite_value = look(self._cls_name_, self._name_)
            if lite_value is not None:
                return lite_value == other
        return NotImplemented

    def __hash__(self):
        return hash(self._cls_name_ + '.' + self._name_)

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


def _cs_probe_metaclasses():
    class _M(type):
        pass
    try:
        exec("class _C(metaclass=_M):\n    pass", {'_M': _M})
        return True
    except TypeError:
        return False


_HAS_METACLASSES = _cs_probe_metaclasses()


if _HAS_METACLASSES:
    class EnumMeta(type):
        def __new__(mcs, name, bases, ns):
            cls = super().__new__(mcs, name, bases, ns)
            members = {}
            order = []
            for k in ns:
                if k.startswith('_'):
                    continue
                v = ns[k]
                if isinstance(v, _Member):
                    value = v._value_          # auto() sentinel: keep its value
                elif (isinstance(v, (int, float, str, tuple))
                      or type(v).__name__ == 'JsProxy') and k.upper() == k:
                    # JsProxy: pytopo=upstream serves OCP enum members as
                    # embind proxies (build_enums Tangency.X = GccEnt_*);
                    # .value must be the MEMBER proxy (pybind semantics) — a
                    # bare proxy's .value would read embind's int instead
                    value = v
                else:
                    continue                   # methods, properties, ...
                m = object.__new__(cls)
                m._name_ = k
                m._value_ = value
                m._cls_name_ = name
                setattr(cls, k, m)
                members[k] = m
                order.append(k)
            order.sort()
            cls.__members__ = members
            cls._member_names_ = order
            return cls

        def __iter__(cls):
            return iter([cls.__members__[k] for k in cls._member_names_])

        def __getitem__(cls, name):
            return cls.__members__[name]

        def __contains__(cls, member):
            for m in cls.__members__.values():
                if member is m or member == m:
                    return True
            return False

        def __len__(cls):
            return len(cls._member_names_)

        def __call__(cls, value):
            # value lookup: Cls(value) -> the member; Cls(member) -> member
            for m in cls.__members__.values():
                if value is m or m._value_ == value:
                    return m
            raise ValueError(repr(value) + ' is not a valid ' + cls.__name__)

    class Enum(_Member, metaclass=EnumMeta):
        pass

    class IntEnum(Enum):
        pass

    class Flag(Enum):
        pass

    class IntFlag(Enum):
        pass

    def _finalize_enums(mod):
        # kept for interface compatibility; members are realized by EnumMeta
        pass

else:
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
            elif (isinstance(v, (int, float, str, tuple))
                  or type(v).__name__ == 'JsProxy') and k.upper() == k:
                # JsProxy: see the metaclass path's note (pytopo=upstream
                # OCP enum members as embind proxies)
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
        # MicroPython without metaclasses: convert class attrs after import
        for attr in dir(mod):
            cls = getattr(mod, attr)
            if isinstance(cls, type) and issubclass(cls, Enum) \
                    and cls not in (Enum, IntEnum, Flag, IntFlag):
                _finalize_enum_class(cls)
