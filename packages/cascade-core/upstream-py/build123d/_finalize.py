# build123d._finalize — imported LAST by the upstream-b123d loader: copies
# the user-facing API onto the build123d package module (so both
# `from build123d import *` and `import build123d` work), wires the reset
# hook the worker calls before every evaluation, and re-exports lite's
# viewer/measurement helpers.
import sys

import build123d as _pkg
import build123d_lite as _lt
import contextvars as _cv

from build123d import build_enums as _enums
from build123d import build_common as _common
from build123d import build_line as _line
from build123d import build_part as _part
from build123d import build_sketch as _sketch
from build123d import geometry as _geometry
from build123d import topology as _topology

_OPTIONAL = ('objects_part', 'objects_curve', 'objects_sketch', 'joints',
             'pack', 'operations_sketch', 'operations_generic',
             'operations_part', 'drafting')

# The topology layer beneath us is ALWAYS upstream's own (Stage 3: upstream
# geometry + topology verbatim over the OCP shim, ocp_shim/topo_glue.py as
# the worker glue). The seam-over-lite layer (pytopo=lite) and its branches
# here were retired with the build123d 0.13 bump.


def _cs_current_builder():
    """The active upstream Builder, version-agnostic: 0.11.1 kept it in a
    class ContextVar (Builder._current); 0.12+ deleted that for the unified
    BuildScope stack (Builder._get_context reads it)."""
    getctx = getattr(_common.Builder, '_get_context', None)
    if getctx is not None:
        try:
            return getctx(log=False)
        except TypeError:
            return getctx()
    cur = getattr(_common.Builder, '_current', None)
    return cur.get(None) if cur is not None else None


def _public_names(mod):
    all_names = getattr(mod, '__all__', None)
    if all_names:
        return list(all_names)
    return [n for n in dir(mod) if not n.startswith('_')]


def _copy_module(mod):
    for name in _public_names(mod):
        try:
            setattr(_pkg, name, getattr(mod, name))
        except AttributeError:
            pass


# Order matters: later modules win on name collisions (objects_* override
# the seam's raw classes for user-facing names like Line/Box, exactly as
# upstream's __init__ star-import order does).
_copy_module(_enums)
_copy_module(_geometry)
_copy_module(_topology)
_copy_module(_common)
_copy_module(_line)
_copy_module(_part)
_copy_module(_sketch)
for _name in _OPTIONAL:
    _mod = sys.modules.get('build123d.' + _name)
    if _mod is not None:
        _copy_module(_mod)

# CLASS fallbacks: user-facing lite CLASSES the upstream Level-A layer does
# not define (LineType, the exporters, ...) fall back to lite's validated
# implementations. Functions are deliberately NOT filled: lite's object
# functions are lite-builder-aware and would silently skip an UPSTREAM
# builder context — an honest NameError beats silently-missing geometry.
for _name in dir(_lt):
    if _name.startswith('_') or hasattr(_pkg, _name):
        continue
    _val = getattr(_lt, _name)
    if isinstance(_val, type):
        setattr(_pkg, _name, _val)

# viewer + measurement + export hooks (worker/harness contract): the worker
# glue (topo_glue) serves them over UPSTREAM shapes (raw-TopoDS unwrapping);
# lite-only helper FUNCTIONS with no upstream counterpart still come from
# lite where they remain shape-compatible.
import topo_glue as _glue
for _name in ('show', 'show_object', 'show_all', 'volume',
              '_measure_globals_json', 'export_stl', 'export_step',
              'export_gltf', 'export_brep', 'import_brep', 'import_step',
              'Mesher', '_cs_after_run'):
    setattr(_pkg, _name, getattr(_glue, _name))
for _name in ('ExportSVG', 'polar', 'delta', 'available_fonts'):
    if not hasattr(_pkg, _name) and hasattr(_lt, _name):
        setattr(_pkg, _name, getattr(_lt, _name))

# lite's ArrowHead (drafting) computed lite-side, adopted as an UPSTREAM
# Sketch (so Pos * head / .moved() work); enum kwargs translate by name
def _cs_arrowhead(size, head_type=None, rotation=0, mode=None):
    import topo_glue as _g
    ht = _lt.HeadType.CURVED if head_type is None else \
        getattr(_lt.HeadType, getattr(head_type, 'name', ''), head_type)
    res = _lt.ArrowHead(size, head_type=ht, rotation=rotation,
                        mode=_lt.Mode.PRIVATE)
    head = _g._from_raw(_lt._topo(res), _topology.Sketch)
    ctx = _cs_current_builder()
    if ctx is not None:
        ctx._add_to_context(
            head, mode=mode if mode is not None else _enums.Mode.ADD)
    return head

if 'build123d.drafting' not in sys.modules:
    # only when upstream's own drafting module did not load (it carries
    # the verbatim ArrowHead/Arrow next to Draft/DimensionLine/...)
    _pkg.ArrowHead = _cs_arrowhead


# upstream's Airfoil needs real numpy (an honest raise on this runtime);
# lite's Airfoil is the VALIDATED numpy-free port. Its builder bookkeeping
# talks to LITE's builder stack (empty in upstream mode), so hand the edges
# to the active upstream BuildLine like objects_curve._add_curve_to_context.
def _cs_airfoil(airfoil_code, n_points=50, finite_te=False,
                mode=_enums.Mode.ADD):
    res = _lt.Airfoil(airfoil_code, n_points=n_points, finite_te=finite_te,
                      mode=_lt.Mode.PRIVATE)
    # adopt the lite-built edges as UPSTREAM shapes
    import topo_glue as _g
    res = _g._from_raw(_lt._topo(res), _topology.Curve)
    ctx = _cs_current_builder()
    if ctx is not None and res is not None:
        ctx._add_to_context(*res.edges(), mode=mode)
    return res


_pkg.Airfoil = _cs_airfoil






# (BuildLine._sub_class stays upstream's own Curve: since the class-DAG
#  unification lite's Curve carries BOTH identities natively — a Mixin1D for
#  objects_curve's isinstance checks and a Compound for parent-builder
#  classification.)


# Algebra placement: `GridLocations(...) * shape` works upstream because its
# topology Shape.__rmul__ accepts Location iterables; the seam's lite
# Shape.__rmul__ only accepts list/tuple, so give upstream's LocationList the
# products lite's own LocationList has (same semantics).
def _loclist_mul(self, other):
    if isinstance(other, _topology.Shape):
        return _topology.ShapeList([loc * other for loc in self.locations])
    if isinstance(other, (list, tuple)):
        return _topology.ShapeList(
            [loc * s for loc in self.locations for s in other])
    return NotImplemented


def _loclist_rmul(self, other):
    if isinstance(other, _geometry.Location):
        return [other * loc for loc in self.locations]
    if isinstance(other, _geometry.Plane):
        return [other.location * loc for loc in self.locations]
    return NotImplemented


_common.LocationList.__mul__ = _loclist_mul
_common.LocationList.__rmul__ = _loclist_rmul


# CPython's collections.abc.Iterable is STRUCTURAL (any class with __iter__
# passes isinstance); the MicroPython shim is a type TUPLE of builtins. The
# upstream bottom layer isinstance-checks Iterable against its OWN classes
# (Vertex(Vector), build_common flattening over Compound/ShapeList/GroupBy
# ...), so extend the tuple with every build123d class that defines __iter__
# and rebind the name in every module that imported the OLD tuple.
# the shim registers under the dotted name in sys.modules (aliased);
# `import collections.abc` would need a real collections package
_cabc = sys.modules['collections.abc']

_old_iterable = _cabc.Iterable

def _has_instance_iter(cls):
    # __iter__ defined on the class CHAIN itself (a metaclass __iter__ —
    # EnumMeta — makes the CLASS iterable, not its instances)
    stack = [cls]
    while stack:
        k = stack.pop()
        d = getattr(k, '__dict__', None)
        if d and '__iter__' in d:
            return True
        stack.extend(getattr(k, '__bases__', ()))
    return False

_extra = []
for _mname, _mod in list(sys.modules.items()):
    if not _mname.startswith('build123d'):
        continue
    for _attr in dir(_mod):
        _val = getattr(_mod, _attr, None)
        if isinstance(_val, type) and _has_instance_iter(_val) \
                and not issubclass(_val, _old_iterable) \
                and _val not in _extra:
            _extra.append(_val)
if _extra:
    _new_iterable = _old_iterable + tuple(_extra)
    _cabc.Iterable = _new_iterable
    for _mod in list(sys.modules.values()):
        try:
            _cur = getattr(_mod, 'Iterable', None)
        except Exception:
            continue  # raising module __getattr__ (numpy micro-shim)
        if _cur is _old_iterable:
            _mod.Iterable = _new_iterable


def _reset_state():
    """Called by the worker (browser._cs_run_user) before every evaluation:
    clear lite's builder stacks AND every upstream ContextVar (a JS-level
    abort can skip Python unwinding, leaking builder contexts)."""
    _lt._reset_state()
    _cv._cs_reset_all()


# build_common has monkeypatched Vector.add/.sub by now: route lite's
# __add__/__sub__ through them (workplane-relative tuple localization);
# lite's own modes never flip this and keep the direct arithmetic.
_lt._VECTOR_OPS_HOOKED = True

_pkg._reset_state = _reset_state
_pkg._lite = _lt
_pkg._upstream_level_a = True
