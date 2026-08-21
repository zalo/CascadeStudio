# ocp_core (PYODIDE variant) — the runtime under the GENERATED OCP proxy
# layer (_registry.py) when real CPython (Pyodide) is the interpreter
# (`?pyruntime=pyodide&pysrc=real`).
#
# Same contract as ocp_core.py (the MicroPython variant): thin proxy objects
# whose method calls route through OcpShim.js's dispatch surface
# (_csOcpNew/_csOcpStatic/_csOcpCall/...). The dispatch table, defaults and
# the generated proxies (_registry.py, OCP/*.py) are SHARED — only this call
# layer forks. Pyodide differences that shape it:
#
#  * JS exceptions ARE catchable (pyodide.ffi.JsException), so the deep path
#    (kwargs / container args) is a direct call in try/except — no {ok,value}
#    record. Raw OCCT wasm exceptions cross as numbers inside the
#    JsException message; they are decoded via js.describeOCCTException.
#  * The variadic guarded entries (_csOcpNewV/...) are kept as the fast path:
#    they avoid building a JS array per call AND already decode OCCT numbers
#    into _csLastErr. Their error sentinel cannot be compared with `is`
#    (Pyodide mints a fresh JsProxy per conversion), so it is detected by its
#    `_csErrMark` property.
#  * embind enum members must be IDENTITY-STABLE on the Python side (upstream
#    keys dicts on them and compares with ==): every member minted by
#    enum_member() is interned by js_id, and wrap() returns the interned
#    proxy for any 'plain' return that matches.
#  * numpy is REAL on this leg: numpy scalars reaching the FFI are coerced
#    through float() (Pyodide would otherwise proxy them into JS, where
#    embind refuses them).

import numbers
import re

import js
from pyodide.ffi import to_js, JsProxy, JsException

_OBJ_FROM_ENTRIES = js.Object.fromEntries

_registry = {}


def register_classes(g):
    for name, obj in g.items():
        if isinstance(obj, type) and issubclass(obj, OcpProxy) \
                and obj is not OcpProxy:
            _registry[name] = obj


def _fail(msg, cls=None):
    try:
        from OCP.Standard import Standard_Failure
    except Exception:
        raise RuntimeError(msg)
    if cls is not None and cls.startswith('gp_'):
        # gp_* constructors raise Standard_ConstructionError almost
        # exclusively; classify by SITE (build_common CATCHES
        # ConstructionError for the BuildSketch plane-alignment fallback)
        try:
            from OCP.Standard import Standard_ConstructionError
            raise Standard_ConstructionError(msg)
        except ImportError:
            pass
    if 'not done' in msg:
        try:
            from OCP.StdFail import StdFail_NotDone
            raise StdFail_NotDone(msg)
        except ImportError:
            pass
    if ('ConstructionError' in msg or 'CrossCross' in msg
            or 'zero norm' in msg):
        try:
            from OCP.Standard import Standard_ConstructionError
            raise Standard_ConstructionError(msg)
        except ImportError:
            pass
    if 'TopoDS::' in msg:
        # a failed TopoDS_Cast downcast raises Standard_TypeMismatch with the
        # cast's name (upstream excepts EXACTLY that type)
        try:
            from OCP.Standard import Standard_TypeMismatch
            raise Standard_TypeMismatch(msg)
        except ImportError:
            pass
    raise Standard_Failure(msg)


# a raw OCCT C++ exception escapes embind as a thrown NUMBER; Pyodide wraps
# it in JsException whose message is the stringified number
_RAW_NUM = re.compile(r'^(?:Error:\s*)?(\d{3,})$')


def _errmsg(e):
    s = str(e).strip()
    m = _RAW_NUM.match(s)
    if m is not None:
        try:
            return 'INTERNAL OPENCASCADE ERROR: ' + \
                js.describeOCCTException(int(m.group(1)))
        except Exception:
            pass
    return s


def _scalar(a):
    """Coerce non-plain-Python reals (numpy scalars) at the FFI boundary."""
    if isinstance(a, numbers.Real):
        return float(a)
    if isinstance(a, numbers.Integral):
        return int(a)
    return a


def _unwrap(a):
    if isinstance(a, (OcpProxy, OcpEnumMember)):
        return a._ref
    if isinstance(a, (list, tuple)):
        return [_unwrap(x) for x in a]
    if isinstance(a, (bool, int, float, str)) or a is None:
        return a
    if isinstance(a, JsProxy):
        return a
    # numpy scalars / ndarrays (real numpy on this leg)
    if isinstance(a, (numbers.Real, numbers.Integral)):
        return _scalar(a)
    if hasattr(a, 'tolist'):
        return _unwrap(a.tolist())
    return a


def _js_args(args):
    return to_js([_unwrap(a) for a in args],
                 dict_converter=_OBJ_FROM_ENTRIES)


def _unwrap_kw(kwargs):
    if not kwargs:
        return None
    return to_js({k: _unwrap(v) for k, v in kwargs.items()},
                 dict_converter=_OBJ_FROM_ENTRIES)


_REF = ['_cs_ref_sentinel']  # first-ctor-arg marker (shared convention with
                             # the MicroPython variant: wrap() constructs
                             # THROUGH __init__ with this sentinel)


_wrap_walk_cache = {}  # unregistered embind class name -> resolved proxy cls


# wrap()'s helper calls go DIRECT to the guarded JS entries (never throw)
_KIND = js._csOcpKind
_ITEM = js._csOcpItem
_LEN = js._csOcpLen
_PARENT = js._csOcpParent

# Embind enum members must be HASHABLE and identity-stable on the Python
# side (upstream keys dicts on them — shape_core's shape_LUT/downcast_LUT —
# and compares with ==), but this Pyodide's JsProxy is UNHASHABLE and a fresh
# proxy is minted per conversion (measured: `TypeError: cannot use
# 'pyodide.ffi.JsProxy' as a dict key`). So every member is wrapped ONCE in
# an OcpEnumMember (hash/eq by js_id, pybind-style .name/.value) and interned
# permanently: wrap() returns the same wrapper for every future sighting.
_enum_intern = {}


class OcpEnumMember:
    """A pybind-enum-shaped wrapper over an identity-stable embind member."""

    __slots__ = ('_ref', '_js_id', '_name')

    def __init__(self, ref, name):
        self._ref = ref
        self._js_id = ref.js_id
        self._name = name

    def __hash__(self):
        return self._js_id

    def __eq__(self, other):
        if isinstance(other, OcpEnumMember):
            return other._js_id == self._js_id
        if isinstance(other, JsProxy):
            try:
                return other.js_id == self._js_id
            except Exception:
                return False
        return NotImplemented

    def __ne__(self, other):
        r = self.__eq__(other)
        return r if r is NotImplemented else not r

    @property
    def name(self):
        return self._name

    @property
    def value(self):
        return int(self._ref.value)

    def __int__(self):
        return int(self._ref.value)

    def __repr__(self):
        return '<ocp_shim enum ' + self._name + '>'


def _errmark(r):
    """True when a guarded variadic entry returned the error sentinel."""
    if isinstance(r, JsProxy):
        try:
            return bool(getattr(r, '_csErrMark', False))
        except Exception:
            return False
    return False


def wrap(v):
    if v is None or isinstance(v, (int, float, bool, str)):
        return v
    kind = _KIND(v)
    if kind == 'array':
        n = int(_LEN(v))
        return tuple(wrap(_ITEM(v, i)) for i in range(n))
    if kind == 'plain' or kind == 'other':
        # enum members return as their interned OcpEnumMember wrapper
        # (hashable, ==-stable); other plains (OCJS_Out records) pass raw
        if isinstance(v, JsProxy):
            try:
                got = _enum_intern.get(v.js_id)
            except Exception:
                got = None
            if got is not None:
                return got
        return v
    cls = _registry.get(kind)
    if cls is None:
        cls = _wrap_walk_cache.get(kind)
        if cls is None:
            name = _PARENT(kind)
            while name:
                cls = _registry.get(name)
                if cls is not None:
                    break
                name = _PARENT(name)
            if cls is None:
                cls = OcpObj
            _wrap_walk_cache[kind] = cls
    return cls(_REF, v)


# Method names whose pybind form MUTATES class-typed arguments by reference
# (ChFi2d_FilletAlgo.Result). Same protocol as the MicroPython variant.
_MUT_METHODS = ('Result',)

_NEW_V = js._csOcpNewV
_CALL_V = js._csOcpCallVar
_STATIC_V = js._csOcpStaticV


def _conv_fast(args):
    """Fast-path conversion: scalars/JsProxy/proxies individually; returns
    None when a container arg forces the deep path."""
    conv = []
    for a in args:
        if isinstance(a, (OcpProxy, OcpEnumMember)):
            conv.append(a._ref)
        elif isinstance(a, (list, tuple, dict)):
            return None
        elif isinstance(a, (bool, int, float, str)) or a is None \
                or isinstance(a, JsProxy):
            conv.append(a)
        elif isinstance(a, (numbers.Real, numbers.Integral)):
            conv.append(_scalar(a))
        else:
            return None
    return conv


class _BoundMethod:
    __slots__ = ('_owner', '_name')

    def __init__(self, owner, name):
        self._owner = owner
        self._name = name

    def __call__(self, *args, **kwargs):
        if self._name in _MUT_METHODS:
            return self._call_mut(args, kwargs)
        if not kwargs:
            conv = _conv_fast(args)
            if conv is not None:
                r = _CALL_V(self._owner._ref, self._name, *conv)
                if _errmark(r):
                    _fail(str(js._csLastErr))
                return wrap(r)
        try:
            r = js._csOcpCall(self._owner._ref, self._name,
                              _js_args(args), _unwrap_kw(kwargs))
        except JsException as e:
            _fail(_errmsg(e))
        return wrap(r)

    def _call_mut(self, args, kwargs):
        try:
            arr = js._csOcpCallMut(self._owner._ref, self._name,
                                   _js_args(args), _unwrap_kw(kwargs))
        except JsException as e:
            _fail(_errmsg(e))
        n = int(js._csOcpLen(arr))
        for k in range(1, n - 1, 2):
            i = int(js._csOcpItem(arr, k))
            new_raw = js._csOcpItem(arr, k + 1)
            target = args[i]
            if isinstance(target, OcpProxy):
                target._ref = new_raw
        return wrap(js._csOcpItem(arr, 0))


class OcpProxy:
    _cs = None

    def __init__(self, *args, **kwargs):
        if len(args) == 2 and args[0] is _REF:
            self._ref = args[1]
            return
        if not kwargs:
            conv = _conv_fast(args)
            if conv is not None:
                r = _NEW_V(self._cs, *conv)
                if _errmark(r):
                    _fail(str(js._csLastErr), self._cs)
                self._ref = r
                return
        try:
            self._ref = js._csOcpNew(self._cs, _js_args(args),
                                     _unwrap_kw(kwargs))
        except JsException as e:
            _fail(_errmsg(e), self._cs)

    def __getattr__(self, name):
        # OCCT methods never start with '_'; refusing them keeps _ref lookups
        # and Python protocol probes from becoming phantom bound methods
        if name.startswith('_'):
            raise AttributeError(name)
        return _BoundMethod(self, name)

    # pybind maps C++ operators onto Python dunders; embind binds them as
    # named methods.
    def __mul__(self, other):
        return _BoundMethod(self, 'Multiplied')(other)

    def __add__(self, other):
        return _BoundMethod(self, 'Added')(other)

    def __sub__(self, other):
        return _BoundMethod(self, 'Subtracted')(other)

    def __truediv__(self, other):
        return _BoundMethod(self, 'Divided')(other)

    def __neg__(self):
        return _BoundMethod(self, 'Reversed')()

    def __hash__(self):
        # pybind parity: TopoDS shapes hash by OCCT HashCode (TShape +
        # Location); non-shapes hash by identity.
        h = self.__dict__.get('_cs_hash')
        if h is None:
            h = js._csOcpHashCode(self._ref)
            h = id(self) if h is None else int(h)
            self.__dict__['_cs_hash'] = h
        return h

    def __repr__(self):
        return '<ocp_shim ' + str(self._cs) + '>'


class OcpObj(OcpProxy):
    """Fallback wrapper for embind classes outside the generated registry."""
    _cs = '?'


class OcpEnum:
    _cs = None


class _Static:
    __slots__ = ('_cls', '_name')

    def __init__(self, cls, name):
        self._cls = cls
        self._name = name

    def __call__(self, *args, **kwargs):
        if not kwargs:
            conv = _conv_fast(args)
            if conv is not None:
                r = _STATIC_V(self._cls, self._name, *conv)
                if _errmark(r):
                    _fail(str(js._csLastErr))
                return wrap(r)
        try:
            r = js._csOcpStatic(self._cls, self._name, _js_args(args),
                                _unwrap_kw(kwargs))
        except JsException as e:
            _fail(_errmsg(e))
        return wrap(r)


def static(cls, name):
    return _Static(cls, name)


def enum_member(enum, member):
    v = js._csOcpEnum(enum, member)
    if isinstance(v, JsProxy):
        got = _enum_intern.get(v.js_id)
        if got is not None:
            return got
        wrapped = OcpEnumMember(v, member)
        _enum_intern[v.js_id] = wrapped
        return wrapped
    return v


def topods_downcast(kind):
    return _Static('TopoDS_Cast', kind)


# pybind collection protocols, attached to SPECIFIC proxy classes only by
# the worker glue (a generic OcpProxy.__iter__/__call__ would flip
# callable()/iter() duck-typing branches all over upstream code).
def _seq_iter(self):
    """sequences: Length()/Value(i), 1-based"""
    n = int(_BoundMethod(self, 'Length')())
    value = _BoundMethod(self, 'Value')
    for i in range(1, n + 1):
        yield value(i)


def _list_iter(self):
    """lists (TopTools_ListOfShape — no index access bound): destructive
    First/RemoveFirst read, APPENDING BACK to restore."""
    is_empty = _BoundMethod(self, 'IsEmpty')
    first = _BoundMethod(self, 'First')
    remove_first = _BoundMethod(self, 'RemoveFirst')
    append = _BoundMethod(self, 'Append')
    items = []
    while not is_empty():
        items.append(first())
        remove_first()
    for it in items:
        append(it)
    for it in items:
        yield it


def _map_call(self, *args):
    """pybind operator() (TopTools_IndexedMapOfShape(i) -> FindKey(i))"""
    return _BoundMethod(self, 'FindKey')(*args)


def pending_fork_binding(what):
    def _raise(*a, **k):
        raise NotImplementedError('PENDING_FORK_BINDING: ' + what)
    return _raise
