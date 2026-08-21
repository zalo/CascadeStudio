# topo_bridge (pytopo=upstream) — the seam glue that lets UPSTREAM topology
# modules (utils/zero_d, run VERBATIM over the OCP shim) interoperate with
# build123d-lite shapes:
#
#  * lite Shape.__init__ unwraps ocp_shim proxies (upstream Vertex does
#    `super().__init__(topods_proxy)`; lite stores the raw JS topo)
#  * lite Vector grows the `.wrapped` gp_Vec property upstream utils reads
#    (`BRepPrimAPI_MakePrism(obj, direction.wrapped)`)
#  * the seam's build123d.topology.shape_core re-export module gains the
#    names upstream utils/zero_d import from it: a REAL downcast (via
#    TopoDS_Cast), shapetype, TrimmingTool and
#    _make_topods_compound_from_shapes
#
# Loaded ONLY by UpstreamB123d.js when pytopo=upstream (default OFF).
import sys

import build123d_lite as _lt
import ocp_core as _c
from browser import self as _w

# --------------------------------------------------------------------- #
# typing shim additions upstream shape_core needs (additive; the shared    #
# typing shim itself stays untouched for the default modes)               #
# --------------------------------------------------------------------- #
import typing as _typing

for _name in ('SupportsIndex', 'ClassVar', 'Protocol'):
    if not hasattr(_typing, _name):
        setattr(_typing, _name, getattr(_typing, 'Any', object))

import itertools as _it

if not hasattr(_it, 'groupby'):
    def _cs_groupby(iterable, key=None):
        kf = key if key is not None else (lambda x: x)
        cur_key = _sentinel = object()
        group = []
        for item in iterable:
            k = kf(item)
            if cur_key is _sentinel or k != cur_key:
                if cur_key is not _sentinel:
                    yield cur_key, iter(group)
                cur_key = k
                group = []
            group.append(item)
        if cur_key is not _sentinel:
            yield cur_key, iter(group)
    _it.groupby = _cs_groupby

# --------------------------------------------------------------------- #
# lite interop patches                                                   #
# --------------------------------------------------------------------- #
# lite Shape.wrapped returns a TYPED shim proxy (upstream predicates do
# isinstance(shape.wrapped, TopoDS_Face)); the browser _Fn bridge learns to
# unwrap proxies so lite's own w.* calls keep working when handed one.
import browser as _brmod


def _fn_call(self, *args):
    conv = []
    for a in args:
        r = getattr(a, '_ref', None)
        if r is not None:
            conv.append(r)
        elif isinstance(a, (list, tuple)):
            conv.append([getattr(x, '_ref', x) for x in a])
        else:
            conv.append(a)
    res = _brmod.jsffi.to_js(conv)
    r = _brmod._js._csMpCall(self._name, res)
    if r.ok:
        return r.value
    raise _brmod._CsWorkerError(str(r.error))


_brmod._Fn.__call__ = _fn_call


def _shape_wrapped(self):
    t = self.topo
    return None if t is None else _c.wrap(t)


_lt.Shape.wrapped = property(_shape_wrapped)

_orig_shape_init = _lt.Shape.__init__


def _shape_init(self, topo=None, *a, **k):
    _orig_shape_init(self, getattr(topo, '_ref', topo), *a, **k)


_lt.Shape.__init__ = _shape_init


def _vector_wrapped(self):
    from ocp_registry import gp_Vec
    return gp_Vec(float(self.X), float(self.Y), float(self.Z))


_lt.Vector.wrapped = property(_vector_wrapped)

# lite Vector accepts shim gp_Pnt/gp_Vec/gp_Dir/gp_XYZ proxies (upstream
# geometry.Vector does)
_orig_vec_init = _lt.Vector.__init__


def _vec_init(self, *args, **kw):
    if len(args) == 1 and isinstance(args[0], _c.OcpProxy):
        p = args[0]
        _orig_vec_init(self, float(p.X()), float(p.Y()), float(p.Z()))
        return
    _orig_vec_init(self, *args, **kw)


_lt.Vector.__init__ = _vec_init


def _axis_wrapped(self):
    from ocp_registry import gp_Ax1, gp_Pnt, gp_Dir
    p, d = self.position, self.direction
    return gp_Ax1(gp_Pnt(float(p.X), float(p.Y), float(p.Z)),
                  gp_Dir(float(d.X), float(d.Y), float(d.Z)))


_lt.Axis.wrapped = property(_axis_wrapped)


def _plane_wrapped(self):
    from ocp_registry import gp_Pln, gp_Ax3, gp_Pnt, gp_Dir
    o, z, x = self.origin, self.z_dir, self.x_dir
    ax3 = gp_Ax3(gp_Pnt(float(o.X), float(o.Y), float(o.Z)),
                 gp_Dir(float(z.X), float(z.Y), float(z.Z)),
                 gp_Dir(float(x.X), float(x.Y), float(x.Z)))
    return gp_Pln(ax3)


_lt.Plane.wrapped = property(_plane_wrapped)

# --------------------------------------------------------------------- #
# seam shape_core fills (imported BY NAME by upstream utils/zero_d)       #
# --------------------------------------------------------------------- #
_sc = sys.modules['build123d.topology.shape_core']

_KIND_BY_CODE = {7: 'Vertex', 6: 'Edge', 5: 'Wire', 4: 'Face',
                 3: 'Shell', 2: 'Solid', 1: 'CompSolid', 0: 'Compound'}


def _as_proxy(obj):
    if isinstance(obj, _c.OcpProxy):
        return obj
    if obj is None:
        return None
    return _c.wrap(obj)


def shapetype(obj):
    """upstream shape_core.shapetype: TopAbs_ShapeEnum of a raw TopoDS."""
    p = _as_proxy(obj)
    if p is None:
        raise ValueError('shapetype: null shape')
    return p.ShapeType()


def downcast(obj):
    """upstream shape_core.downcast: to the most-derived TopoDS_* class."""
    p = _as_proxy(obj)
    if p is None:
        return None
    code = int(p.ShapeType().value)
    kind = _KIND_BY_CODE.get(code)
    if kind is None or kind == 'CompSolid':
        # TopoDS_Cast has no CompSolid downcast (fork ask) — keep the base
        return p
    return _c.topods_downcast(kind)(p)


def _make_topods_compound_from_shapes(occt_shapes):
    from ocp_registry import TopoDS_Compound, BRep_Builder
    comp = TopoDS_Compound()
    builder = BRep_Builder()
    builder.MakeCompound(comp)
    for s in occt_shapes:
        if s is not None:
            builder.Add(comp, _as_proxy(s))
    return comp


class TrimmingTool:
    """TypeAlias placeholder (annotation-only in upstream)."""


_sc.shapetype = shapetype
_sc.downcast = downcast
_sc._make_topods_compound_from_shapes = _make_topods_compound_from_shapes
_sc.TrimmingTool = TrimmingTool
