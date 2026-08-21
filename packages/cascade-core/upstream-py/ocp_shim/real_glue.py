# real_glue (pyodide, pysrc=real) — the worker glue under REAL, UNMODIFIED
# build123d 0.11.1 running on Pyodide (CPython/wasm) with the OCP-over-embind
# shim as the ONLY substitution.
#
# The Pyodide port of ocp_shim/topo_glue.py (the MicroPython pytopo=upstream
# glue), plus the few _finalize.py hooks that still apply on a REAL package:
#
#  * show()/sceneShapes — unwrap upstream Shape.wrapped (shim proxies) to the
#    raw JS TopoDS objects the mesher consumes; membership tested by js_id
#    (Pyodide mints a fresh JsProxy per conversion, so `is` cannot be used)
#  * implicit scene — _cs_after_run(globals) when a script never calls show()
#  * measurement — _measure_globals_json (the b123d-validation contract)
#  * export/import plumbing — export_stl/brep, import_step/brep, Mesher
#    OVERRIDE the real package's (lib3mf / StlAPI / STEPCAFControl paths are
#    not available in this wasm build — same honest compromise as every
#    other leg; each override is module-attribute glue, never a source edit)
#  * kernel-text routing — Compound.make_text -> lite's opentype.js path
#    (COMPROMISE(text): no kernel fonts in wasm)
#  * Gordon surfaces — Face.make_gordon_surface -> GordonSurface.js
#  * `show`/`show_object`/`show_all` are APPENDED to build123d.__all__ so the
#    harness scripts' `from build123d import *` binds them (the real package
#    has an explicit __all__; ocp_vscode is not importable in the worker)
#
# Loaded ONLY by PyodideRealB123d.js when pyruntime=pyodide & pysrc=real.
import sys

import build123d as _pkg
import build123d_lite as _lt
import ocp_core as _c
from browser import self as w

from build123d.topology import (Shape, ShapeList, Compound, Curve, Edge,
                                Wire, Face, Vertex, Shell, Solid)


# pybind collection protocols on the specific proxy classes upstream
# topology iterates/calls (CPython honors post-hoc class attribute sets).
def _cs_attach_collection_protocols():
    import ocp_registry as _reg
    for name in ('TopTools_HSequenceOfShape', 'TColStd_HSequenceOfReal',
                 'TColgp_HSequenceOfPnt'):
        cls = getattr(_reg, name, None)
        if cls is not None:
            cls.__iter__ = _c._seq_iter
    for name in ('TopTools_ListOfShape',):
        cls = getattr(_reg, name, None)
        if cls is not None:
            cls.__iter__ = _c._list_iter
    for name in ('TopTools_IndexedMapOfShape',
                 'TopTools_IndexedDataMapOfShapeListOfShape'):
        cls = getattr(_reg, name, None)
        if cls is not None:
            cls.__call__ = _c._map_call

    # pybind hasher functor: hasher(shape) -> int (topo_distance_to's peer
    # lookup). Rebind the name in the importing module to a Python functor
    # (same OCCT HashCode the proxies hash by).
    import js as _js

    class _CsShapeHasher:
        def __init__(self, *a, **k):
            pass

        def __call__(self, s):
            raw = getattr(s, '_ref', s)
            h = _js._csOcpHashCode(raw)
            return id(s) if h is None else int(h)

    for _mod_name in ('build123d.topology.shape_core',):
        _m = sys.modules.get(_mod_name)
        if _m is not None and hasattr(_m, 'TopTools_ShapeMapHasher'):
            _m.TopTools_ShapeMapHasher = _CsShapeHasher


_cs_attach_collection_protocols()


def _raw(obj):
    """Raw JS TopoDS object of an upstream Shape (or shim proxy / lite shape /
    raw), for w.* JS calls and sceneShapes membership."""
    if isinstance(obj, Shape):
        wrapped = obj.wrapped
        if wrapped is None:
            raise ValueError('empty shape')
        return wrapped._ref
    if isinstance(obj, _c.OcpProxy):
        return obj._ref
    if isinstance(obj, _lt.Shape):
        return _lt._topo(obj)
    return obj


def _from_raw(topo, cls=None):
    """An upstream Shape over a raw JS TopoDS (downcast by the class ctor)."""
    p = _c.wrap(topo)
    if cls is not None:
        return cls(p)
    code = int(p.ShapeType().value)
    by_code = {7: Vertex, 6: Edge, 5: Wire, 4: Face,
               3: Shell, 2: Solid, 0: Compound}
    return by_code.get(code, Compound)(p)


def _builder_shape(obj):
    """obj._obj when obj is a BUILDER holding a shape with geometry."""
    try:
        cand = getattr(obj, '_obj', None)
    except Exception:
        return None
    if isinstance(cand, Shape) and cand.wrapped is not None:
        return cand
    return None


# ------------------------------------------------------------- scene ----- #

def _scene_len():
    try:
        return len(w.sceneShapes)
    except TypeError:
        return int(w.sceneShapes.length)


def _push_scene(raw):
    rid = raw.js_id
    for existing in w.sceneShapes:
        try:
            if existing.js_id == rid:
                return
        except AttributeError:
            continue
    w.sceneShapes.push(raw)


def show(*shapes, **kwargs):
    """lite's show() semantics over upstream shapes (COMPROMISE(
    show-semantics)): the first show REPLACES the auto scene, later append."""
    if not getattr(w, '_b123dSceneDefined', False):
        while _scene_len() > 0:
            w.sceneShapes.pop()
        w._b123dSceneDefined = True
    flat = []
    for s in shapes:
        if isinstance(s, (list, tuple, ShapeList)):
            flat.extend(s)
        else:
            flat.append(s)
    for s in flat:
        b = _builder_shape(s)
        if b is not None:
            s = b
        try:
            raw = _raw(s)
        except (TypeError, ValueError):
            continue
        if raw is None:
            continue
        _push_scene(raw)


def show_object(shape, name=None, options=None, **kwargs):
    show(shape)


def show_all(*args, **kwargs):
    pass


def _cs_after_run(g):
    """Populate the implicit scene after a run that never called show()."""
    if getattr(w, '_b123dSceneDefined', False):
        return
    if _scene_len() > 0:
        return
    for name, obj in list(g.items()):
        if name.startswith('_'):
            continue
        b = _builder_shape(obj)
        if b is not None:
            obj = b
        if isinstance(obj, Shape) and obj.wrapped is not None:
            _push_scene(_raw(obj))


# -------------------------------------------------------- measurement ---- #

def volume(shape):
    """Absolute volume of a shape in mm^3 (sum over solids)."""
    return w.SolidsVolume(_raw(shape))


def _json_num(x):
    x = float(x)
    if x != x or x in (float('inf'), float('-inf')):
        return 'null'
    return repr(x)


def _measure_globals_json(g):
    """The b123d-validation harness contract (mirrors lite's
    _measure_globals_json / reference.py)."""
    entries = []

    def measure(name, obj):
        try:
            m = w.MeasureShape(_raw(obj))
        except Exception as exc:  # noqa: BLE001 - report, never crash the run
            entries.append('"' + name + '":{"measure_error":"' +
                           str(exc).replace('"', "'")[:120] + '"}')
            return
        if m is None:
            entries.append('"' + name + '":{"measure_error":"null shape"}')
            return
        bbox = 'null'
        mb = m.bbox
        if mb is not None and int(mb.length) == 6:
            bbox = '[' + ','.join([_json_num(v) for v in mb]) + ']'
        entries.append('"' + name + '":{' +
                       '"volume":' + _json_num(m.volume) +
                       ',"area":' + _json_num(m.area) +
                       ',"faces":' + str(int(m.faces)) +
                       ',"edges":' + str(int(m.edges)) +
                       ',"bbox":' + bbox + '}')

    for name, obj in list(g.items()):
        if name.startswith('_') or name in ('show', 'show_object', 'show_all'):
            continue
        b = _builder_shape(obj)
        if b is not None:
            measure(name, b)
        elif isinstance(obj, Shape):
            if obj.wrapped is not None:
                measure(name, obj)
        elif isinstance(obj, (list, tuple)) and len(obj) > 0 and \
                all(isinstance(x, Shape) for x in obj):
            # same rule as lite/reference.py: skip face-less elements, sort
            # by bbox center (element order is traversal noise)
            solids = [x for x in obj
                      if x.wrapped is not None and len(x.faces()) > 0]

            def _bbkey(x):
                bb = w.BoundingBox(_raw(x), 0.01)
                if not bb:
                    return (0.0, 0.0, 0.0)
                return (round((bb[0] + bb[3]) / 2, 3),
                        round((bb[1] + bb[4]) / 2, 3),
                        round((bb[2] + bb[5]) / 2, 3))
            solids = sorted(solids[:64], key=_bbkey)
            for i, x in enumerate(solids):
                measure(name + '[' + str(i) + ']', x)
    return '{' + ','.join(entries) + '}'


# ------------------------------------------------------ export/import ---- #
# These OVERRIDE the real package's exporters (module-attribute glue): the
# real code paths need lib3mf / StlAPI_Writer / STEPCAFControl / vtk, none of
# which exist in this wasm build. Identical contract to every other leg.

def export_stl(to_export, file_path, tolerance=1e-3, angular_tolerance=0.1,
               ascii_format=False):
    """STL into the worker MEMFS (COMPROMISE(mesher), same as lite)."""
    text = w.ExportSTL(_raw(to_export), str(file_path).replace('/', '_'),
                       tolerance, angular_tolerance)
    return text is not None


def export_brep(to_export, file_path):
    text = w.ExportBREP(_raw(to_export), str(file_path).replace('/', '_'))
    return bool(text)


def import_brep(file_name):
    name = str(file_name).replace('/', '_')
    topo = w.ImportBREP(name)
    if topo is None or not topo:
        raise ValueError('Could not import ' + str(file_name))
    res = _from_raw(topo, Compound)
    res.label = str(file_name).split('/')[-1]
    return res


def import_step(file_name):
    """STEP assets handed to the worker up front (CascadeAPI.
    loadExternalFiles), resolved by base name — same contract as lite."""
    name = str(file_name)
    topo = w.GetExternalShape(name)
    if topo is None or not topo:
        raise FileNotFoundError(
            'import_step: "' + name + '" was not delivered to the worker. '
            'The CAD worker has no filesystem; pass the file content with '
            'CascadeAPI.loadExternalFiles({"' + name.split('/')[-1] +
            '": <step text>}) before running the script.')
    res = _from_raw(topo, Compound)
    res.label = name.split('/')[-1]
    return res


class ExportSVG:
    """No-op SVG exporter override (same contract as lite's: the browser
    worker has no filesystem for the .svg and no svgpathtools — a warning is
    printed instead; geometry side effects only)."""

    def __init__(self, *args, **kwargs):
        print('build123d (pysrc=real): ExportSVG writes nothing in the browser')

    def add_layer(self, *args, **kwargs):
        return self

    def add_shape(self, *args, **kwargs):
        return self

    def write(self, *args, **kwargs):
        return True


def export_step(*args, **kwargs):
    print('build123d (pysrc=real): export_step is a no-op in the browser')
    return True


def export_gltf(*args, **kwargs):
    print('build123d (pysrc=real): export_gltf is a no-op in the browser')
    return True


class Mesher:
    """STL-only mesher over upstream shapes (COMPROMISE(mesher): no lib3mf
    in this wasm build; 3MF writes raise honestly at the real Mesher)."""

    def __init__(self, unit='MM', **kwargs):
        self.unit = unit
        self._shapes = []
        self.linear_deflection = 0.001
        self.angular_deflection = 0.1

    @property
    def mesh_count(self):
        return len(self._shapes)

    def add_shape(self, shape, linear_deflection=0.001,
                  angular_deflection=0.1, **kwargs):
        items = shape if isinstance(shape, (list, tuple, ShapeList)) else [shape]
        for s in items:
            self._shapes.append(s)
        self.linear_deflection = linear_deflection
        self.angular_deflection = angular_deflection

    def add_code_to_metadata(self):
        pass

    def add_meta_data(self, *args, **kwargs):
        pass

    def write(self, file_name):
        name = str(file_name)
        if not name.lower().endswith('.stl'):
            raise NotImplementedError(
                'build123d-lite Mesher writes STL only (no lib3mf in the '
                'WASM build); got ' + name)
        if not self._shapes:
            raise ValueError('Mesher: no shapes added')
        topos = [_raw(s) for s in self._shapes]
        topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos, True)
        text = w.ExportSTL(topo, name.replace('/', '_'),
                           self.linear_deflection, self.angular_deflection)
        if text is None:
            raise RuntimeError('STL export failed')
        return True

    def read(self, file_name):
        raise NotImplementedError('Mesher.read is not supported in '
                                  'the browser worker')


# ------------------------------------------- kernel-gap method routing ---- #
# COMPROMISE(text): no kernel fonts in wasm — upstream Compound.make_text
# (Font_FontMgr/StdPrs_BRepTextBuilder) cannot run; route to lite's validated
# opentype.js path and adopt the faces as an upstream Compound. Enum kwargs
# translate to lite's plain-class members BY NAME.

def _lite_enum(v):
    nm = getattr(v, 'name', None)
    if not isinstance(nm, str):
        return v
    lite_cls = getattr(_lt, type(v).__name__, None)
    if lite_cls is None:
        return v
    return getattr(lite_cls, nm, v)


def _lite_enum_tuple(v):
    if isinstance(v, (tuple, list)):
        return tuple(_lite_enum(a) for a in v)
    return _lite_enum(v)


def _cs_make_text(cls, txt, font_size, font='Arial', font_path=None,
                  font_style=None, text_align=None, align=None,
                  position_on_path=0.0, text_path=None,
                  single_line_width=0.0):
    lite_path = None
    if text_path is not None:
        raw = _raw(text_path)
        code = int(_c.wrap(raw).ShapeType().value)
        lite_path = (_lt.Wire if code == 5 else _lt.Edge)(raw)
    lite_kwargs = {}
    if text_align is not None:
        lite_kwargs['text_align'] = _lite_enum(text_align)
    lite = _lt.Compound.make_text(
        txt, font_size, font=font, font_path=font_path,
        font_style=_lite_enum(font_style), align=_lite_enum_tuple(align),
        position_on_path=position_on_path, text_path=lite_path,
        single_line_width=single_line_width, **lite_kwargs)
    return cls(_c.wrap(_lt._topo(lite)))


Compound.make_text = classmethod(_cs_make_text)


# Joint reparenting: pybind's downcast() returns THE SAME C++ object, so
# Joint.connect_to's in-place parent.locate() moves the new wrapper too;
# embind casts return VALUE COPIES, so Compound(joints=) must REBIND the
# joints' parents to the newly-constructed shape.
_upstream_compound_init = Compound.__init__


def _cs_compound_init(self, *args, **kwargs):
    _upstream_compound_init(self, *args, **kwargs)
    joints = getattr(self, 'joints', None)
    if joints:
        for j in joints.values():
            j.parent = self


Compound.__init__ = _cs_compound_init


# COMPROMISE(gordon-*): upstream delegates to the external ocp_gordon
# package; here the JS port (GordonSurface.js, w.GordonSurfaceFace) builds
# the face directly.
def _cs_make_gordon_surface(cls, profiles, guides, tolerance=3e-4):
    from build123d.geometry import Vector

    def conv(item):
        if isinstance(item, (Shape, _lt.Shape, _c.OcpProxy)):
            return _raw(item)
        v = Vector(item)
        return [v.X, v.Y, v.Z]
    p = [conv(i) for i in profiles]
    g = [conv(i) for i in guides]
    return cls(_c.wrap(w.GordonSurfaceFace(p, g, tolerance)))


Face.make_gordon_surface = classmethod(_cs_make_gordon_surface)


# ------------------------------------------------- package-level hooks ---- #

def _reset_state():
    """Called by the worker bridge before every evaluation: clear lite's
    builder stacks AND the upstream builder ContextVars (a JS-level abort can
    skip Python unwinding, leaking builder contexts)."""
    _lt._reset_state()
    from build123d.build_common import Builder, LocationList, WorkplaneList
    for _cls in (Builder, LocationList, WorkplaneList):
        var = getattr(_cls, '_current', None)
        if var is not None and var.get(None) is not None:
            var.set(None)


for _name in ('show', 'show_object', 'show_all', 'volume',
              '_measure_globals_json', 'export_stl', 'export_step',
              'export_gltf', 'export_brep', 'import_brep', 'import_step',
              'Mesher', 'ExportSVG', '_cs_after_run', '_reset_state'):
    setattr(_pkg, _name, globals()[_name])

# the real package has an explicit __all__; the worker's viewer entry points
# (ocp_vscode replacements) and the volume() helper the starter code uses
# must survive `from build123d import *`
for _name in ('show', 'show_object', 'show_all', 'volume'):
    if _name not in _pkg.__all__:
        _pkg.__all__.append(_name)

_pkg._lite = _lt
_pkg._cs_pysrc = 'real'
