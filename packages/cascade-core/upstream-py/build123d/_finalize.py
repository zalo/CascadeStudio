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
             'operations_part')


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

# lite's viewer + measurement + export hooks (worker/harness contract), plus
# the handful of lite-only user-facing FUNCTIONS with no upstream Level-A
# counterpart and no builder-context dependence that could silently misfire
# (ArrowHead is sketch-context-aware in lite, but under an upstream builder
# its result is still returned and add()-able; the harness measures it).
for _name in ('show', 'show_object', 'show_all', 'volume',
              '_measure_globals_json', 'export_stl', 'export_step',
              'export_gltf', 'export_brep', 'import_brep', 'import_step',
              'Mesher', 'ExportSVG', 'ArrowHead', 'polar', 'delta',
              'topo_distance_to', 'edges_to_wires'):
    if hasattr(_lt, _name):
        setattr(_pkg, _name, getattr(_lt, _name))


# lite operations with NO upstream Level-A counterpart that must also reach
# an UPSTREAM builder context: call lite's (context-free here — lite's own
# builder stack is empty in upstream mode), then hand the result to the
# active upstream builder with the operation's combination mode.
def _cs_builder_op(fn, mode):
    def wrapped(*a, **k):
        res = fn(*a, **k)
        ctx = _common.Builder._current.get(None)
        if ctx is not None and res is not None and \
                getattr(res, 'topo', None) is not None:
            ctx._add_to_context(res, mode=mode)
        return res
    return wrapped


_pkg.draft = _cs_builder_op(_lt.draft, _enums.Mode.REPLACE)

# upstream's Airfoil needs real numpy (an honest raise on this runtime);
# lite's Airfoil is the VALIDATED numpy-free port. Its builder bookkeeping
# talks to LITE's builder stack (empty in upstream mode), so hand the edges
# to the active upstream BuildLine like objects_curve._add_curve_to_context.
def _cs_airfoil(airfoil_code, n_points=50, finite_te=False,
                mode=_enums.Mode.ADD):
    res = _lt.Airfoil(airfoil_code, n_points=n_points, finite_te=finite_te,
                      mode=_lt.Mode.PRIVATE)
    ctx = _common.Builder._current.get(None)
    if ctx is not None and getattr(res, 'topo', None) is not None:
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
