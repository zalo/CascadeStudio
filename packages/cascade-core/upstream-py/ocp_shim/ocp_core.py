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
from jsworker import self as _rawjs

# The variadic FAST PATH (see OcpShim.js "guarded VARIADIC entries"):
# scalar/JsProxy args cross the FFI individually — no temporary list rides
# the mp->js proxy registry (jsffi.to_js was ~38% of hot-loop profiles) —
# and errors come back as an identity-stable sentinel instead of an
# {ok, value} record (two JsProxy 'get' traps per call).
_ERRMARK = getattr(_rawjs, '_CS_ERRMARK', None)
_OCP_NEW_V = getattr(_rawjs, '_csOcpNewV', None)
_OCP_CALL_V = getattr(_rawjs, '_csOcpCallVar', None)
_OCP_STATIC_V = getattr(_rawjs, '_csOcpStaticV', None)

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
        # exclusively (gp_Ax3's CrossCross degenerate-frame case etc.);
        # classify by SITE because the raw wasm pointer is not always
        # decodable into the message the string matches below need
        # (build_common CATCHES ConstructionError for the BuildSketch
        # plane-alignment fallback — slide_latch)
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
        # gp_* construction faults are Standard_ConstructionError upstream
        # (build_common CATCHES it: the BuildSketch plane-alignment fallback)
        try:
            from OCP.Standard import Standard_ConstructionError
            raise Standard_ConstructionError(msg)
        except ImportError:
            pass
    if 'TopoDS::' in msg:
        # a failed TopoDS_Cast downcast raises Standard_TypeMismatch with
        # the cast's name as message (upstream excepts EXACTLY that type:
        # extrude_linear_with_rotation's compound-unwrap fallback)
        try:
            from OCP.Standard import Standard_TypeMismatch
            raise Standard_TypeMismatch(msg)
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


_wrap_walk_cache = {}  # unregistered embind class name -> resolved proxy
                       # class (caches the _csOcpParent FFI walk; registered
                       # names hit _registry directly and never enter it)


# wrap()'s helper calls go DIRECT to the jsworker functions (they are
# guarded JS-side and never throw): no _Fn envelope on the hottest path.
_KIND = _rawjs._csOcpKind
_ITEM = _rawjs._csOcpItem
_LEN = _rawjs._csOcpLen
_PARENT = _rawjs._csOcpParent


def wrap(v):
    if v is None or isinstance(v, (int, float, bool, str)):
        return v
    kind = _KIND(v)
    if kind == 'array':
        n = int(_LEN(v))
        return tuple(wrap(_ITEM(v, i)) for i in range(n))
    if kind == 'plain' or kind == 'other':
        return v  # enum members / OCJS_Out records: raw identity-stable proxy
    # kind is an embind class name: find the nearest generated proxy class
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
        if not kwargs and _OCP_CALL_V is not None:
            conv = []
            deep = False
            for a in args:
                if isinstance(a, OcpProxy):
                    conv.append(a._ref)
                elif isinstance(a, (list, tuple)):
                    deep = True
                    break
                else:
                    conv.append(a)
            if not deep:
                r = _OCP_CALL_V(self._owner._ref, self._name, *conv)
                if r is _ERRMARK:
                    _fail(str(_rawjs._csLastErr))
                return wrap(r)
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
        if not kwargs and _OCP_NEW_V is not None:
            conv = []
            deep = False
            for a in args:
                if isinstance(a, OcpProxy):
                    conv.append(a._ref)
                elif isinstance(a, (list, tuple)):
                    deep = True
                    break
                else:
                    conv.append(a)
            if not deep:
                r = _OCP_NEW_V(self._cs, *conv)
                if r is _ERRMARK:
                    _fail(str(_rawjs._csLastErr), self._cs)
                self._ref = r
                return
        try:
            self._ref = w._csOcpNew(self._cs, [_unwrap(a) for a in args],
                                    _unwrap_kw(kwargs))
        except _CsWorkerError as e:
            _fail(str(e), self._cs)

    def __getattr__(self, name):
        # OCCT methods never start with '_'; refusing them keeps _ref lookups
        # and Python protocol probes from turning into phantom bound methods
        if name.startswith('_'):
            raise AttributeError(name)
        return _BoundMethod(self, name)

    # pybind maps C++ operators onto Python dunders (TopLoc_Location * ,
    # gp_Trsf *, gp_Vec + - ...); embind binds them as named methods.
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
        # Location) so explorer pseudo-duplicates collapse in dict/set
        # dedup (upstream _topods_entities). Non-shapes hash by identity.
        h = getattr(self, '_cs_hash', None)
        if h is None:
            h = w._csOcpHashCode(self._ref)
            h = id(self) if h is None else int(h)
            self._cs_hash = h
        return h

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
        if not kwargs and _OCP_STATIC_V is not None:
            conv = []
            deep = False
            for a in args:
                if isinstance(a, OcpProxy):
                    conv.append(a._ref)
                elif isinstance(a, (list, tuple)):
                    deep = True
                    break
                else:
                    conv.append(a)
            if not deep:
                r = _OCP_STATIC_V(self._cls, self._name, *conv)
                if r is _ERRMARK:
                    _fail(str(_rawjs._csLastErr))
                return wrap(r)
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


# pybind collection protocols, attached to SPECIFIC proxy classes only
# (a generic OcpProxy.__iter__/__call__ would flip callable()/iter() duck-
# typing branches all over upstream code). Used by topo_glue at boot.
def _seq_iter(self):
    """sequences: Length()/Value(i), 1-based"""
    n = int(_BoundMethod(self, 'Length')())
    value = _BoundMethod(self, 'Value')
    for i in range(1, n + 1):
        yield value(i)


def _list_iter(self):
    """lists (TopTools_ListOfShape — no index access bound): destructive
    First/RemoveFirst read, APPENDING BACK to restore (FindFromKey and
    friends return value copies through embind)"""
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
    """A callable placeholder for a binding the fork round adds; the marker
    makes integration a grep (PENDING_FORK_BINDING)."""
    def _raise(*a, **k):
        raise NotImplementedError('PENDING_FORK_BINDING: ' + what)
    return _raise
