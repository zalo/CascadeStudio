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

# lite's viewer + measurement + export hooks (worker/harness contract)
for _name in ('show', 'show_object', 'show_all', 'volume',
              '_measure_globals_json', 'export_stl', 'export_step',
              'export_gltf', 'export_brep', 'import_brep', 'import_step',
              'Mesher'):
    if hasattr(_lt, _name):
        setattr(_pkg, _name, getattr(_lt, _name))


# BuildLine's results must carry BOTH upstream identities (Curve for
# objects_curve, Compound for parent-builder classification); topology.Curve
# itself stays lite's Curve — see topology._CsBuilderCurve.
_line.BuildLine._sub_class = _topology._CsBuilderCurve


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


_pkg._reset_state = _reset_state
_pkg._lite = _lt
_pkg._upstream_level_a = True
