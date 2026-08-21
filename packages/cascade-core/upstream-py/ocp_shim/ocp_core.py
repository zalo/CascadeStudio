# ocp_core — the runtime under the GENERATED OCP proxy layer (_registry.py).
#
# Python side of the OCP-over-embind shim: thin proxy objects whose every
# method call routes through the guarded JS dispatcher (OcpShim.js installs
# _csOcpNew/_csOcpStatic/_csOcpCall/_csOcpEnum/_csOcpKind/_csOcpParent/
# _csOcpItem/_csOcpLen on the worker global). JS exceptions never cross the
# FFI raw: the browser bridge's _csMpCall guard catches them and this module
# re-raises OCP.Standard.Standard_Failure (what upstream build123d excepts).
#
# pybind-parity rules implemented here (each measured in the spike):
#  * returned Handle_* are auto-deref'd JS-side; a NULL handle arrives as
#    None (pybind converts null handles to None)
#  * polymorphic returns arrive as the MOST-DERIVED registered embind class
#    (embind getActualType downcasting) and wrap() picks the matching proxy
#    class, so upstream isinstance(surface, Geom_Plane) works without
#    metaclasses
#  * enum members are raw JS proxies: embind members are identity-stable
#    singletons, so ==/dict-key semantics match pybind enums
#  * tuple-returning out-param methods are served by the dispatcher's glue
#    map (OCJS_Out helpers / bound alternatives) and arrive as JS arrays,
#    converted to Python tuples here

from browser import self as w
from browser import _CsWorkerError

_registry = {}


def register_classes(g):
    for name, obj in g.items():
        if isinstance(obj, type) and issubclass(obj, OcpProxy) \
                and obj is not OcpProxy:
            _registry[name] = obj


def _fail(msg):
    try:
        from OCP.Standard import Standard_Failure
    except Exception:
        raise RuntimeError(msg)
    if 'not done' in msg:
        try:
            from OCP.StdFail import StdFail_NotDone
            raise StdFail_NotDone(msg)
        except ImportError:
            pass
    raise Standard_Failure(msg)


def _unwrap(a):
    if isinstance(a, OcpProxy):
        return a._ref
    if isinstance(a, (list, tuple)):
        return [_unwrap(x) for x in a]
    return a


_REF = ['_cs_ref_sentinel']  # first-ctor-arg marker (MicroPython lacks
                             # type.__new__, so wrap() constructs THROUGH
                             # __init__ with this sentinel)


def wrap(v):
    if v is None or isinstance(v, (int, float, bool, str)):
        return v
    kind = w._csOcpKind(v)
    if kind == 'array':
        n = int(w._csOcpLen(v))
        return tuple(wrap(w._csOcpItem(v, i)) for i in range(n))
    if kind == 'plain' or kind == 'other':
        return v  # enum members / OCJS_Out records: raw identity-stable proxy
    # kind is an embind class name: find the nearest generated proxy class
    name = kind
    while name:
        cls = _registry.get(name)
        if cls is not None:
            return cls(_REF, v)
        name = w._csOcpParent(name)
    return OcpObj(_REF, v)


def _unwrap_kw(kwargs):
    if not kwargs:
        return None
    return {k: _unwrap(v) for k, v in kwargs.items()}


# Method names whose pybind form MUTATES class-typed arguments by
# reference (TopoDS out-params, e.g. ChFi2d_FilletAlgo.Result fills the two
# trimmed edges). These route through _csOcpCallMut, which returns a flat
# [ret, i1, new1, ...] array; the caller's proxies are rebound to the new
# raw objects — pybind's in-place mutation, at the proxy level. The JS side
# falls back to a normal call when the receiver's class has no mut-glue
# (ShapeFix_Face.Result is a plain getter).
_MUT_METHODS = ('Result',)


class _BoundMethod:
    def __init__(self, owner, name):
        self._owner = owner
        self._name = name

    def __call__(self, *args, **kwargs):
        if self._name in _MUT_METHODS:
            return self._call_mut(args, kwargs)
        try:
            r = w._csOcpCall(self._owner._ref, self._name,
                             [_unwrap(a) for a in args], _unwrap_kw(kwargs))
        except _CsWorkerError as e:
            _fail(str(e))
        return wrap(r)

    def _call_mut(self, args, kwargs):
        try:
            arr = w._csOcpCallMut(self._owner._ref, self._name,
                                  [_unwrap(a) for a in args],
                                  _unwrap_kw(kwargs))
        except _CsWorkerError as e:
            _fail(str(e))
        n = int(w._csOcpLen(arr))
        for k in range(1, n - 1, 2):
            i = int(w._csOcpItem(arr, k))
            new_raw = w._csOcpItem(arr, k + 1)
            target = args[i]
            if isinstance(target, OcpProxy):
                target._ref = new_raw
        return wrap(w._csOcpItem(arr, 0))


class OcpProxy:
    _cs = None

    def __init__(self, *args, **kwargs):
        if len(args) == 2 and args[0] is _REF:
            self._ref = args[1]
            return
        try:
            self._ref = w._csOcpNew(self._cs, [_unwrap(a) for a in args],
                                    _unwrap_kw(kwargs))
        except _CsWorkerError as e:
            _fail(str(e))

    def __getattr__(self, name):
        # OCCT methods never start with '_'; refusing them keeps _ref lookups
        # and Python protocol probes from turning into phantom bound methods
        if name.startswith('_'):
            raise AttributeError(name)
        return _BoundMethod(self, name)

    def __repr__(self):
        return '<ocp_shim ' + str(self._cs) + '>'


class OcpObj(OcpProxy):
    """Fallback wrapper for embind classes outside the generated registry."""
    _cs = '?'


class OcpEnum:
    _cs = None


class _Static:
    def __init__(self, cls, name):
        self._cls = cls
        self._name = name

    def __call__(self, *args, **kwargs):
        try:
            r = w._csOcpStatic(self._cls, self._name,
                               [_unwrap(a) for a in args], _unwrap_kw(kwargs))
        except _CsWorkerError as e:
            _fail(str(e))
        return wrap(r)


def static(cls, name):
    return _Static(cls, name)


def enum_member(enum, member):
    return w._csOcpEnum(enum, member)


def topods_downcast(kind):
    return _Static('TopoDS_Cast', kind)


def pending_fork_binding(what):
    """A callable placeholder for a binding the fork round adds; the marker
    makes integration a grep (PENDING_FORK_BINDING)."""
    def _raise(*a, **k):
        raise NotImplementedError('PENDING_FORK_BINDING: ' + what)
    return _raise
