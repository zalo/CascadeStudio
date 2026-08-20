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


def _cs_current_builder():
    """The active upstream Builder, across upstream versions: 0.11.1 keeps a
    Builder._current ContextVar; dev (future 0.12) unified it into the
    BuildScope stack behind Builder._get_context()."""
    cur = getattr(_common.Builder, '_current', None)
    if cur is not None:
        return cur.get(None)
    return _common.Builder._get_context(log=False)


# lite operations with NO upstream Level-A counterpart that must also reach
# an UPSTREAM builder context: call lite's (context-free here — lite's own
# builder stack is empty in upstream mode), then hand the result to the
# active upstream builder with the operation's combination mode.
def _cs_builder_op(fn, mode):
    def wrapped(*a, **k):
        res = fn(*a, **k)
        ctx = _cs_current_builder()
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
    ctx = _cs_current_builder()
    if ctx is not None and getattr(res, 'topo', None) is not None:
        ctx._add_to_context(*res.edges(), mode=mode)
    return res


_pkg.Airfoil = _cs_airfoil


# upstream's DoubleTangentArc leaves the tangent TARGET over-extended
# ("beyond the intersection") and relies on native wire fixing to trim it at
# face time; this kernel's ShapeFix can't modify topology (the mode setters
# are unbound), so use lite's validated solver AND trim the target inside the
# active upstream BuildLine, exactly like lite does in its own builders
# (COMPROMISE(double-tangent-arc)).
def _cs_double_tangent_arc(pnt, tangent, other, keep=None, mode=None):
    lk = getattr(_lt.Keep, getattr(keep, 'name', 'TOP'), _lt.Keep.TOP)
    arc = _lt.DoubleTangentArc(pnt, tangent, other, keep=lk,
                               mode=_lt.Mode.PRIVATE)
    ctx = _cs_current_builder()
    if ctx is not None and getattr(ctx, '_tag', '') == 'BuildLine' and \
            ctx._obj is not None and getattr(ctx._obj, 'topo', None) is not None:
        try:
            p1 = arc @ 1
            other_keys = set()
            for oe in other.edges():
                other_keys.add(_lt._shape_key(oe, 'edge'))
            rebuilt = []
            for e in ctx._obj.edges():
                if _lt._shape_key(e, 'edge') in other_keys:
                    try:
                        u = e.param_at_point(tuple(p1))
                        if u > 1e-9:
                            e = e.trim(0.0, u)
                    except Exception:
                        pass
                rebuilt.append(e)
            ctx._obj = type(ctx._obj)(rebuilt)
        except Exception:
            pass
    if ctx is not None:
        ctx._add_to_context(*arc.edges(),
                            mode=mode if mode is not None else _enums.Mode.ADD)
    return arc


_pkg.DoubleTangentArc = _cs_double_tangent_arc




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


# --- dev (future 0.12) BaseObjectMeta construction-firewall emulation -----
# Upstream dev builds BaseObject on a METACLASS whose __call__ wraps every
# object construction in an isolated BuildScope and publishes the finished
# instance to its captured Builder. MicroPython has no metaclasses; the
# loader strips `metaclass=BaseObjectMeta` and this pass reproduces the
# __call__ semantics in two halves:
#   * BaseObject.__new__ — everything the metaclass did BEFORE construction
#     (validate the builder restriction, capture contexts, build + PUSH the
#     isolated scope; owner.root, which upstream's own __new__ set, is set
#     here too), leaving the pending (scope, token) on the instance;
#   * a wrapper on each terminal publisher __init__ (Base{Part,Sketch,Curve,
#     Line,Edge}Object) — pop + _publish_to_context when the OUTERMOST
#     __init__ completes. This relies on upstream's own convention that a
#     subclass __init__ ends with super().__init__(...): statements AFTER
#     that super call would run outside the isolated scope (none of the
#     library objects do this).
# KNOWN COMPROMISE: if a subclass __init__ raises BEFORE reaching the
# terminal super().__init__, the pushed scope leaks until the worker's
# between-runs _cs_reset_all (the evaluation is erroring out anyway).
if hasattr(_common, 'BaseObjectMeta'):
    def _cs_bo_new(cls, *args, **kwargs):
        inst = object.__new__(cls)
        parent_scope = _common._get_build_scope()
        if parent_scope is None:
            return inst
        parent_object_scope = _common.BaseObjectMeta._get_context()
        location_context = _common.LocationList._get_context()
        publication_target = _common.Builder._get_context(log=False)
        _common.BaseObjectMeta._validate_builder(cls, publication_target)
        publication_locations = (
            tuple(location_context.locations)
            if location_context is not None
            else _common._identity_locations()
        )
        object_local_locations = (
            tuple(location_context.local_locations)
            if location_context is not None
            else _common._identity_locations()
        )
        owner = _common._BaseObjectScopeOwner()
        owner.root = inst
        isolated_scope = _common.BuildScope(
            parent=parent_scope,
            builder=None,
            operation_locations=_common._identity_locations(),
            publication_locations=publication_locations,
            output_placements=_common._identity_locations(),
            owner=owner,
            publication_target=publication_target,
            isolated=True,
            location_context=_common.LocationList([_geometry.Location()]),
            object_context=parent_object_scope,
            object_local_locations=object_local_locations,
            object_placements=(
                parent_scope.output_placements
                if parent_scope is not None
                else _common._identity_locations()
            ),
        )
        token = _common._push_build_scope(isolated_scope)
        inst._cs_pending_scope = (isolated_scope, token)
        return inst

    _common.BaseObject.__new__ = _cs_bo_new

    def _cs_finish_object(inst, publish):
        pend = getattr(inst, '_cs_pending_scope', None)
        if pend is None:
            return
        inst._cs_pending_scope = None
        scope, token = pend
        _common._pop_build_scope(token)
        if publish:
            inst._publish_to_context(scope)

    def _cs_wrap_publisher_init(kls):
        orig = kls.__init__

        def wrapped(self, *a, **k):
            try:
                orig(self, *a, **k)
            except BaseException:
                _cs_finish_object(self, False)
                raise
            _cs_finish_object(self, True)
        kls.__init__ = wrapped

    for _mname, _cname in (('objects_part', 'BasePartObject'),
                           ('objects_sketch', 'BaseSketchObject'),
                           ('objects_curve', 'BaseCurveObject'),
                           ('objects_curve', 'BaseLineObject'),
                           ('objects_curve', 'BaseEdgeObject')):
        _omod = sys.modules.get('build123d.' + _mname)
        _okls = getattr(_omod, _cname, None) if _omod is not None else None
        if _okls is not None:
            _cs_wrap_publisher_init(_okls)


# lite's show()/show_object() coerce LITE builders to their result; teach
# them the UPSTREAM Builder too (an upstream BuildPart is not lite's Builder,
# so _topo() rejects it and the viewport stays empty).
def _cs_unwrap_builders(shapes):
    conv = []
    for s in shapes:
        if isinstance(s, _common.Builder):
            try:
                s = s._output_obj() if hasattr(s, '_output_obj') else s._obj
            except AttributeError:
                pass
        conv.append(s)
    return conv


def _cs_show(*shapes, **kwargs):
    return _lt.show(*_cs_unwrap_builders(shapes), **kwargs)


def _cs_show_object(shape, name=None, options=None, **kwargs):
    return _lt.show_object(_cs_unwrap_builders([shape])[0], name=name,
                           options=options, **kwargs)


_pkg.show = _cs_show
_pkg.show_object = _cs_show_object


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
