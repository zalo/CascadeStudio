# Experiment-only polyfills for OCP-shim gaps met on draftwright's path.
import ocp_core as _oc
from OCP import gp as _gp
def _coord_poly(dim):
    def Coord(self, *a):
        if not a:
            b = _oc._BoundMethod
            return tuple(b(self, n)() for n in ('X', 'Y', 'Z')[:dim])
        return _oc._BoundMethod(self, 'Coord')(*a)
    return Coord
for _n, _d in (('gp_Dir', 3), ('gp_Pnt', 3), ('gp_Vec', 3), ('gp_XYZ', 3),
               ('gp_Dir2d', 2), ('gp_Pnt2d', 2), ('gp_Vec2d', 2), ('gp_XY', 2)):
    _c = getattr(_gp, _n, None)
    if _c is not None and isinstance(_c, type):
        _c.Coord = _coord_poly(_d)
print('polyfills installed')
# scipy.spatial.cKDTree (quiddity circular patterns): brute-force nearest
# neighbour on numpy, enough for its point clouds.
import sys as _sys, types as _types
import numpy as _np
class cKDTree:
    def __init__(self, data):
        self.data = _np.asarray(data, dtype=float)
    def query(self, x, k=1, workers=1, **kw):
        x = _np.asarray(x, dtype=float)
        one = x.ndim == 1
        x = _np.atleast_2d(x)
        d = _np.empty(len(x)); i = _np.empty(len(x), dtype=int)
        for s in range(0, len(x), 512):
            dd = ((x[s:s + 512, None, :] - self.data[None, :, :]) ** 2).sum(-1)
            j = dd.argmin(1); i[s:s + 512] = j; d[s:s + 512] = _np.sqrt(dd[_np.arange(len(j)), j])
        return (d[0], i[0]) if one else (d, i)
try:
    import scipy.spatial as _ss
except Exception:
    _ss = None
if _ss is None:
    _sc = _sys.modules.get('scipy') or _types.ModuleType('scipy'); _sys.modules['scipy'] = _sc
    _ss = _types.ModuleType('scipy.spatial'); _sys.modules['scipy.spatial'] = _ss; _sc.spatial = _ss
if not hasattr(_ss, 'cKDTree'):
    _ss.cKDTree = cKDTree
# Unbound-class bypasses (each = a fork binding to add). Record, don't fake.
import builtins as _bi
_bi._CS_SKIPPED = []
def _skip(modname, fn, ret):
    import importlib
    m = importlib.import_module(modname)
    def _s(*a, **k):
        _bi._CS_SKIPPED.append(modname + '.' + fn)
        return ret
    setattr(m, fn, _s)

# IntCurvesFace_ShapeIntersector over BRepIntCurveSurface_Inter, which the
# wasm build DOES bind but the generated shim does not proxy: a hand proxy.
from OCP.BRepIntCurveSurface import BRepIntCurveSurface_Inter
class IntCurvesFace_ShapeIntersector:
    def Load(self, shape, tol):
        self._shape, self._tol, self._res = shape, tol, []
    def Perform(self, lin, pmin, pmax):
        it = BRepIntCurveSurface_Inter()
        it.Init(self._shape, lin, self._tol)
        res = []
        while it.More():
            w = it.W()
            if pmin - self._tol <= w <= pmax + self._tol:
                res.append((w, it.Face()))
            it.Next()
        res.sort(key=lambda r: r[0])
        self._res = res
    def IsDone(self):
        return True
    def NbPnt(self):
        return len(self._res)
    def WParameter(self, i):
        return self._res[i - 1][0]
    def Face(self, i):
        return self._res[i - 1][1]
import OCP.IntCurvesFace as _icf
_icf.IntCurvesFace_ShapeIntersector = IntCurvesFace_ShapeIntersector
for _mn in ('quiddity.thin_walls', 'quiddity.interior_voids', 'quiddity._interior_void_grid'):
    import importlib as _il
    _m = _il.import_module(_mn)
    if hasattr(_m, 'IntCurvesFace_ShapeIntersector'):
        _m.IntCurvesFace_ShapeIntersector = IntCurvesFace_ShapeIntersector
# BRepClass_FaceClassifier (unbound): classify by the minimum distance from a
# vertex at the point to the face and where on the face that distance lands.
from OCP.BRepExtrema import BRepExtrema_DistShapeShape as _Dss
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeVertex as _MkV
from OCP.BRepAdaptor import BRepAdaptor_Surface as _BAS
from OCP.TopAbs import TopAbs_IN as _IN, TopAbs_ON as _ON, TopAbs_OUT as _OUT
class BRepClass_FaceClassifier:
    def __init__(self, *a):
        self._state = _OUT
        if a:
            face, p, tol = a
            if hasattr(p, 'Z'):
                self.Perform(face, p, tol)
            else:
                self.Perform(face, _BAS(face).Value(p.X(), p.Y()), tol)
    def Perform(self, face, p, tol):
        if not hasattr(p, 'Z'):
            p = _BAS(face).Value(p.X(), p.Y())
        d = _Dss(_MkV(p).Vertex(), face)
        if not d.IsDone() or d.NbSolution() < 1 or d.Value() > max(tol, 1e-7) * 10:
            self._state = _OUT; return
        t = d.SupportTypeShape2(1)
        self._state = _IN if 'Face' in str(t) else _ON
    def State(self):
        return self._state
def _provide(mod, name, obj):
    import sys, importlib
    m = importlib.import_module('OCP.' + mod)
    ph = getattr(m, name, None)
    setattr(m, name, obj)
    for _mn, _m in list(sys.modules.items()):
        if _m is None or not _mn.startswith(('quiddity', 'draftwright', 'build123d_drafting')):
            continue
        for k, v in list(vars(_m).items()):
            if v is ph and ph is not None:
                setattr(_m, k, obj)
_provide('BRepClass', 'BRepClass_FaceClassifier', BRepClass_FaceClassifier)
# Text(font_path=...) -> the bundled FreeSans (lite's opentype text has no
# path loading; IBM Plex metrics differ, so layout is approximate here).
import build123d_lite as _lt
_lite_text = _lt.Text
def _text_nopath(*a, **k):
    if k.pop('font_path', None) is not None:
        _bi._CS_SKIPPED.append('Text(font_path=) -> FreeSans')
    return _lite_text(*a, **k)
_lt.Text = _text_nopath

# the glue's no-op ExportSVG predates real svgpathtools: restore upstream's
import build123d as _b, build123d.exporters as _bx
_b.ExportSVG = _bx.ExportSVG
# GeomConvert_BSplineCurveToBezierCurve: bound in the wasm, missing from the
# generated shim -> a hand proxy (the SVG/DXF exporters convert HLR circles
# and glyph outlines through it).
from OCP.GeomConvert import GeomConvert_BSplineCurveToBezierCurve
import OCP.GeomConvert as _gc
_gc.GeomConvert_BSplineCurveToBezierCurve = GeomConvert_BSplineCurveToBezierCurve
_bx.GeomConvert_BSplineCurveToBezierCurve = GeomConvert_BSplineCurveToBezierCurve
# TopTools_FormatVersion: not bound (only feeds BRepTools.Write_s to a
# stream, replaced after import): inert members
class _FV:
    TopTools_FormatVersion_VERSION_1 = 1
    TopTools_FormatVersion_VERSION_2 = 2
    TopTools_FormatVersion_VERSION_3 = 3
_provide('TopTools', 'TopTools_FormatVersion', _FV)

# pybind iterates TColgp_Array1OfPnt (Poles()); the proxy has no __iter__
import ocp_registry as _rg
_A1P = _rg.TColgp_Array1OfPnt
def _arr_iter(self):
    for i in range(self.Lower(), self.Upper() + 1):
        yield self.Value(i)
for _an in dir(_rg):
    if _an.startswith(('TColgp_Array1Of', 'TColStd_Array1Of', 'TColgp_HArray1Of', 'TColStd_HArray1Of')):
        _ac = getattr(_rg, _an)
        if isinstance(_ac, type) and '__iter__' not in vars(_ac):
            _ac.__iter__ = _arr_iter
            _ac.__len__ = lambda self: self.Length()
# pybind fills SplitBSplineCurve's SameOrientation default (the dispatch table
# has no default for an unbilled static); pybind's gp_Vec has __rmul__.
from OCP.GeomConvert import GeomConvert as _GC
_split = _GC.SplitBSplineCurve_s
def _split_poly(*a):
    if len(a) == 4 and not isinstance(a[3], bool):  # JS returns integral reals as int
        a = a + (True,)
    return _split(*a)
_GC.SplitBSplineCurve_s = staticmethod(_split_poly) if isinstance(_GC, type) else _split_poly
for _vn in ('gp_Vec', 'gp_XYZ', 'gp_Vec2d', 'gp_XY'):
    _vc = getattr(_rg, _vn, None)
    if isinstance(_vc, type):
        _vc.__rmul__ = lambda self, k: _oc._BoundMethod(self, 'Multiplied')(k)
