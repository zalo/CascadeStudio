#!/usr/bin/env python3
"""PHASE 1 static bill: every OCP usage in upstream build123d 0.11.1
geometry.py + topology/*.py, at METHOD level, cross-referenced against the
opencascade.js fork's embind surface (cascadestudio.d.ts).

Run with the reference venv python (needs importable OCP 7.9.3 for pybind
signature introspection):

  ~/Desktop/ocjs-deps/b123d-ref-venv/bin/python3 extract_ocp_bill.py

Outputs (next to this script):
  ocp-method-bill.json   - the full machine-readable bill
  numpy-bill.json        - every np.* usage in geometry.py/one_d.py (+ any other)
"""

from __future__ import annotations

import ast
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

B123D = Path(
    "/home/agent-untrusted/Desktop/ocjs-deps/b123d-ref-venv/lib/python3.12/"
    "site-packages/build123d"
)
DTS = Path(
    "/home/agent-untrusted/Desktop/cs-ocp-spike/node_modules/opencascade.js/"
    "dist/cascadestudio.d.ts"
)
OUT_DIR = Path(__file__).resolve().parent

TARGET_FILES = [B123D / "geometry.py"] + sorted((B123D / "topology").glob("*.py"))

# What build123d class wraps what OCP type (for `self.wrapped` / `<var>.wrapped`
# receiver typing). Verified against upstream sources.
B123D_WRAPPED = {
    # geometry.py
    "Vector": "gp_Vec",
    "Axis": "gp_Ax1",
    "AxisMeta": "gp_Ax1",
    "Location": "TopLoc_Location",
    "LocationEncoder": "TopLoc_Location",
    "Rotation": "TopLoc_Location",
    "Pos": "TopLoc_Location",
    "Rot": "TopLoc_Location",
    "Matrix": "gp_GTrsf",
    "BoundBox": "Bnd_Box",
    "OrientedBoundBox": "Bnd_OBB",
    "Color": "Quantity_ColorRGBA",
    "Plane": "gp_Pln",  # Plane.wrapped is a gp_Pln
    # topology
    "Shape": "TopoDS_Shape",
    "Comparable": "TopoDS_Shape",
    "Mixin1D": "TopoDS_Shape",
    "Mixin2D": "TopoDS_Shape",
    "Mixin3D": "TopoDS_Shape",
    "Vertex": "TopoDS_Vertex",
    "Edge": "TopoDS_Edge",
    "Wire": "TopoDS_Wire",
    "Face": "TopoDS_Face",
    "Shell": "TopoDS_Shell",
    "Solid": "TopoDS_Solid",
    "CompSolid": "TopoDS_CompSolid",
    "Compound": "TopoDS_Compound",
    "Part": "TopoDS_Compound",
    "Sketch": "TopoDS_Compound",
    "Curve": "TopoDS_Compound",
    "ShapeList": "TopoDS_Shape",
    "GroupBy": "TopoDS_Shape",
}

# ------------------------------------------------------------------ #
# 1. OCP introspection (pybind docstrings)                            #
# ------------------------------------------------------------------ #

sys.path.insert(0, str(B123D.parent))
import OCP  # noqa: E402


def ocp_class(module: str, name: str):
    try:
        mod = __import__("OCP." + module, fromlist=[name])
    except Exception:
        return None
    return getattr(mod, name, None)


SIG_RE = re.compile(r"^\s*\d*\.?\s*(\w+)\((.*?)\)\s*->\s*(.+?)\s*$")


def pybind_sigs(obj) -> list[dict]:
    """Parse pybind11 __doc__ into a list of {params:int, ret:str, tuple:bool}."""
    doc = getattr(obj, "__doc__", None) or ""
    sigs = []
    for line in doc.split("\n"):
        m = SIG_RE.match(line)
        if not m:
            continue
        name, params, ret = m.groups()
        # param count: split on top-level commas
        depth = 0
        n = 0 if not params.strip() else 1
        for ch in params:
            if ch in "([{":
                depth += 1
            elif ch in ")]}":
                depth -= 1
            elif ch == "," and depth == 0:
                n += 1
        # drop 'self' for instance methods
        if params.strip().startswith("self"):
            n -= 1
        sigs.append({
            "params": n,
            "ret": ret,
            "tuple_ret": ret.startswith(("Tuple[", "tuple[")),
        })
    return sigs


def introspect(module: str, cls: str, meth: str | None):
    """Return info about OCP.<module>.<cls>[.<meth>]: kind, sigs."""
    c = ocp_class(module, cls)
    if c is None:
        return {"exists": False}
    if meth is None:
        init = getattr(c, "__init__", None)
        return {"exists": True, "kind": "class", "ctor_sigs": pybind_sigs(init)}
    a = None
    try:
        a = getattr(c, meth)
    except AttributeError:
        # maybe it's a module-level name (enums)
        return {"exists": False}
    import inspect as _inspect

    is_static = isinstance(
        _inspect.getattr_static(c, meth, None), staticmethod
    ) or type(a).__name__ in ("builtin_function_or_method",)
    kind = "static" if is_static else "method"
    if isinstance(a, (int, float)) or type(a).__name__ == "pybind11_type":
        kind = "attr"
    if not callable(a):
        kind = "attr"
    return {"exists": True, "kind": kind, "sigs": pybind_sigs(a)}


# ------------------------------------------------------------------ #
# 2. AST extraction                                                   #
# ------------------------------------------------------------------ #


class Usage:
    def __init__(self):
        # key: (module, cls, meth_or_None, kind) -> list of "file:line"
        self.items: dict[tuple, list[str]] = defaultdict(list)
        # key -> list of coarse call-site arg signatures (parallel, one per
        # call site; None for non-call usages). See ModuleScanner._argsig.
        self.sigs: dict[tuple, list] = defaultdict(list)

    def add(self, module, cls, meth, kind, where, argsig=None):
        self.items[(module, cls, meth, kind)].append(where)
        self.sigs[(module, cls, meth, kind)].append(argsig)


class ModuleScanner(ast.NodeVisitor):
    def __init__(self, fname: str, usage: Usage, np_usage):
        self.f = fname
        self.usage = usage
        self.np = np_usage
        self.alias: dict[str, tuple[str, str]] = {}   # local name -> (module, ocp name)
        self.modalias: dict[str, str] = {}            # local name -> OCP module
        self.np_names: set[str] = set()
        self.class_stack: list[str] = []
        self.env_stack: list[dict] = [{}]             # var -> ocp class
        self.benv_stack: list[dict] = [{}]            # var -> build123d class

    # -- imports ---------------------------------------------------- #
    def visit_ImportFrom(self, node):
        if node.module and node.module.startswith("OCP."):
            mod = node.module[4:]
            for a in node.names:
                self.alias[a.asname or a.name] = (mod, a.name)
        elif node.module == "numpy":
            for a in node.names:
                self.np_names.add(a.asname or a.name)
        self.generic_visit(node)

    def visit_Import(self, node):
        for a in node.names:
            if a.name.startswith("OCP."):
                self.modalias[a.asname or a.name] = a.name[4:]
            elif a.name == "numpy":
                self.np_names.add(a.asname or "numpy")
        self.generic_visit(node)

    # -- scopes ------------------------------------------------------ #
    def visit_ClassDef(self, node):
        self.class_stack.append(node.name)
        self.generic_visit(node)
        self.class_stack.pop()

    def _visit_func(self, node):
        env, benv = {}, {}
        for arg in list(node.args.args) + list(node.args.kwonlyargs):
            ann = arg.annotation
            names = self._ann_names(ann)
            for nm in names:
                if nm in self.alias:
                    env[arg.arg] = self.alias[nm][1]
                    break
                if nm in B123D_WRAPPED:
                    benv[arg.arg] = nm
                    break
        if self.class_stack and node.args.args and node.args.args[0].arg in ("self", "cls"):
            benv["self"] = self.class_stack[-1]
        self.env_stack.append(env)
        self.benv_stack.append(benv)
        self.generic_visit(node)
        self.env_stack.pop()
        self.benv_stack.pop()

    visit_FunctionDef = _visit_func
    visit_AsyncFunctionDef = _visit_func

    def _ann_names(self, ann):
        if ann is None:
            return []
        if isinstance(ann, ast.Constant) and isinstance(ann.value, str):
            try:
                ann = ast.parse(ann.value, mode="eval").body
            except SyntaxError:
                return []
        out = []
        for n in ast.walk(ann):
            if isinstance(n, ast.Name):
                out.append(n.id)
        return out

    # -- typing helpers ---------------------------------------------- #
    @property
    def env(self):
        return self.env_stack[-1]

    @property
    def benv(self):
        return self.benv_stack[-1]

    def where(self, node):
        return f"{self.f}:{node.lineno}"

    def infer(self, node) -> str | None:
        """Best-effort OCP class of an expression."""
        if isinstance(node, ast.Name):
            return self.env.get(node.id)
        if isinstance(node, ast.Attribute):
            if node.attr == "wrapped":
                b = self.infer_b123d(node.value)
                if b and b in B123D_WRAPPED:
                    return B123D_WRAPPED[b]
                # unattributed .wrapped in topology -> TopoDS_Shape heuristic
                if "topology" in self.f:
                    return "TopoDS_Shape"
                return None
            base = self.infer(node.value)
            if base:
                info = introspect(*OCP_CLASS_MODULE.get(base, ("", base)), node.attr) \
                    if base in OCP_CLASS_MODULE else None
                # handled via call sites; attribute chains rare
            return None
        if isinstance(node, ast.Call):
            return self.infer_call_ret(node)
        return None

    def infer_b123d(self, node) -> str | None:
        if isinstance(node, ast.Name):
            return self.benv.get(node.id)
        return None

    def infer_call_ret(self, node: ast.Call) -> str | None:
        f = node.func
        if isinstance(f, ast.Name) and f.id in self.alias:
            return self.alias[f.id][1]  # constructor returns its class
        if isinstance(f, ast.Attribute):
            recv_cls = None
            if isinstance(f.value, ast.Name) and f.value.id in self.alias:
                recv_cls = self.alias[f.value.id][1]
                mod = self.alias[f.value.id][0]
            else:
                recv_cls = self.infer(f.value)
                mod = OCP_CLASS_MODULE.get(recv_cls, (None,))[0] if recv_cls else None
            if recv_cls and mod:
                key = (mod, recv_cls, f.attr)
                info = INTROSPECT_CACHE.get(key)
                if info is None:
                    info = introspect(mod, recv_cls, f.attr)
                    INTROSPECT_CACHE[key] = info
                if info.get("exists") and info.get("sigs"):
                    ret = info["sigs"][0]["ret"]
                    m = re.match(r"(?:OCP\.)+(\w+)\.(\w+)", ret)
                    if m:
                        OCP_CLASS_MODULE.setdefault(m.group(2), (m.group(1), m.group(2)))
                        return m.group(2)
        return None

    # -- the actual recording ----------------------------------------- #
    def visit_Assign(self, node):
        self.generic_visit(node)
        t = self.infer(node.value)
        b = None
        if t is None and isinstance(node.value, ast.Call):
            pass
        for tgt in node.targets:
            if isinstance(tgt, ast.Name):
                if t:
                    self.env[tgt.id] = t
                elif tgt.id in self.env:
                    del self.env[tgt.id]

    def visit_AnnAssign(self, node):
        self.generic_visit(node)
        if isinstance(node.target, ast.Name) and node.value is not None:
            t = self.infer(node.value)
            if t:
                self.env[node.target.id] = t

    # -- coarse static typing of a call-site argument -------------------- #
    # Tags align with the shim's RUNTIME argKind classes (OcpShim.js):
    #   'b' bool, 'n' number, 's' string, '0' None, 'c:<Class>' OCP class,
    #   'm:<Type>.<Member>' attr read off an imported OCP name (enum member
    #   or class constant; the generator resolves enums), '?' unknown.
    def _coarse(self, node):
        if isinstance(node, ast.Constant):
            v = node.value
            if isinstance(v, bool):
                return "b"
            if isinstance(v, (int, float)):
                return "n"
            if isinstance(v, str):
                return "s"
            if v is None:
                return "0"
            return "?"
        if isinstance(node, ast.UnaryOp) and isinstance(
                node.op, (ast.USub, ast.UAdd)):
            return "n" if self._coarse(node.operand) == "n" else "?"
        t = self.infer(node)
        if t:
            return "c:" + t
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            nm = node.value.id
            if nm in self.alias:
                return "m:" + self.alias[nm][1] + "." + node.attr
            if nm in self.modalias:
                return "m:[" + self.modalias[nm] + "]." + node.attr
        if isinstance(node, ast.Call):
            fn = node.func
            if isinstance(fn, ast.Name):
                if fn.id == "bool":
                    return "b"
                if fn.id in ("int", "float", "len", "abs", "round"):
                    return "n"
                if fn.id == "str":
                    return "s"
        return "?"

    def _argsig(self, node: ast.Call) -> str:
        sig = ",".join(self._coarse(a) for a in node.args)
        kw = sorted(k.arg or "**" for k in node.keywords)
        if kw:
            sig += "|kw:" + ",".join(kw)
        return sig

    def visit_Call(self, node):
        f = node.func
        nargs = len(node.args) + len(node.keywords)
        argsig = self._argsig(node)
        # numpy
        root = self._np_root(f)
        if root:
            self.np.add(root, self.where(node), call=True)
        if isinstance(f, ast.Name) and f.id in self.alias:
            mod, cls = self.alias[f.id]
            self.usage.add(mod, cls, None, f"ctor/{nargs}", self.where(node),
                           argsig)
        elif isinstance(f, ast.Attribute):
            # Cls.Meth(...) where Cls imported from OCP
            if isinstance(f.value, ast.Name) and f.value.id in self.alias:
                mod, cls = self.alias[f.value.id]
                self.usage.add(mod, cls, f.attr, f"static/{nargs}",
                               self.where(node), argsig)
            # modalias.Name(...)  (e.g. ta.TopAbs_XXX -- rare as call)
            elif isinstance(f.value, ast.Name) and f.value.id in self.modalias:
                mod = self.modalias[f.value.id]
                self.usage.add(mod, f.attr, None, f"modcall/{nargs}",
                               self.where(node), argsig)
            else:
                recv = self.infer(f.value)
                if recv:
                    mod = OCP_CLASS_MODULE.get(recv, ("?",))[0]
                    self.usage.add(mod, recv, f.attr, f"imeth/{nargs}",
                                   self.where(node), argsig)
                else:
                    # unattributed instance call -- keep the method name if it
                    # LOOKS like an OCCT method (CamelCase) and the receiver is
                    # not obviously a python object
                    if re.match(r"^[A-Z]", f.attr) and f.attr not in (
                        "X", "Y", "Z"  # keep these actually
                    ) or f.attr in ("X", "Y", "Z"):
                        if not self._is_python_recv(f.value):
                            self.usage.add("?", "?", f.attr, f"unattr/{nargs}",
                                           self.where(node), argsig)
        self.generic_visit(node)

    def _is_python_recv(self, node) -> bool:
        # receivers that are clearly build123d-level (self, cls, known b123d var)
        if isinstance(node, ast.Name) and node.id in ("self", "cls"):
            return True
        if self.infer_b123d(node):
            return True
        return False

    def visit_Attribute(self, node):
        # enum member / static attr reads (not calls -- calls handled above)
        if isinstance(node.value, ast.Name):
            nm = node.value.id
            if nm in self.alias:
                mod, cls = self.alias[nm]
                self.usage.add(mod, cls, node.attr, "attr", self.where(node))
            elif nm in self.modalias:
                mod = self.modalias[nm]
                self.usage.add(mod, node.attr, None, "modattr", self.where(node))
            elif nm in self.np_names:
                self.np.add(self._np_path(node), self.where(node), call=False)
        self.generic_visit(node)

    def visit_Name(self, node):
        # bare class references (isinstance tuples, except clauses, defaults)
        if isinstance(node.ctx, ast.Load) and node.id in self.alias:
            mod, cls = self.alias[node.id]
            self.usage.add(mod, cls, None, "classref", self.where(node))

    # numpy helpers
    def _np_root(self, f) -> str | None:
        # np.foo(...) / np.linalg.bar(...)
        path = self._np_path(f)
        return path

    def _np_path(self, node) -> str | None:
        parts = []
        while isinstance(node, ast.Attribute):
            parts.append(node.attr)
            node = node.value
        if isinstance(node, ast.Name) and node.id in self.np_names:
            return ".".join(reversed(parts)) if parts else node.id
        return None


class NpUsage:
    def __init__(self):
        self.calls = defaultdict(list)
        self.attrs = defaultdict(list)

    def add(self, path, where, call):
        if path is None:
            return
        (self.calls if call else self.attrs)[path].append(where)


OCP_CLASS_MODULE: dict[str, tuple[str, str]] = {}
INTROSPECT_CACHE: dict = {}


def preseed_class_modules():
    """Map class name -> module for everything the target files import."""
    for f in TARGET_FILES:
        tree = ast.parse(f.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module \
                    and node.module.startswith("OCP."):
                mod = node.module[4:]
                for a in node.names:
                    OCP_CLASS_MODULE[a.name] = (mod, a.name)
    # seed the wrapped types too
    for cls in set(B123D_WRAPPED.values()):
        if cls.startswith("TopoDS"):
            OCP_CLASS_MODULE.setdefault(cls, ("TopoDS", cls))
        elif cls.startswith("gp"):
            OCP_CLASS_MODULE.setdefault(cls, ("gp", cls))
        elif cls.startswith("TopLoc"):
            OCP_CLASS_MODULE.setdefault(cls, ("TopLoc", cls))
        elif cls.startswith("Bnd"):
            OCP_CLASS_MODULE.setdefault(cls, ("Bnd", cls))
        elif cls.startswith("Quantity"):
            OCP_CLASS_MODULE.setdefault(cls, ("Quantity", cls))


# ------------------------------------------------------------------ #
# 3. d.ts parsing                                                      #
# ------------------------------------------------------------------ #


def parse_dts(path: Path):
    classes: dict[str, dict] = {}
    enums: dict[str, list[str]] = {}
    cur = None
    cur_enum = None
    ctor_re = re.compile(r"^\s*export declare class (\w+?)_(\d+) extends \1 \{")
    class_re = re.compile(
        r"^\s*export declare class (\w+)(?: extends (\w+))?\s*\{")
    meth_re = re.compile(r"^\s*(static )?(\w+)\((.*)\): (.+);")
    enum_re = re.compile(r"^export declare type (\w+) = \{")
    member_re = re.compile(r"^\s*(\w+): \{\};?")
    pending_ctor_base = None
    for line in path.read_text().split("\n"):
        m = ctor_re.match(line)
        if m:
            base = m.group(1)
            classes.setdefault(base, {"methods": {}, "ctors": []})
            pending_ctor_base = base
            cur = None
            continue
        m = class_re.match(line)
        if m:
            cur = m.group(1)
            classes.setdefault(cur, {"methods": {}, "ctors": []})
            classes[cur]["parent"] = m.group(2)
            pending_ctor_base = None
            continue
        cm = re.match(r"^\s*constructor\((.*)\);?\s*$", line)
        if cm and (pending_ctor_base or cur):
            params = cm.group(1)
            n = 0 if not params.strip() else params.count(",") + 1
            classes[pending_ctor_base or cur]["ctors"].append(n)
            pending_ctor_base = None
            continue
        m = enum_re.match(line)
        if m:
            cur_enum = m.group(1)
            enums[cur_enum] = []
            cur = None
            continue
        if cur_enum:
            mm = member_re.match(line)
            if mm:
                enums[cur_enum].append(mm.group(1))
            elif line.strip() == "}":
                cur_enum = None
            continue
        if cur:
            mm = meth_re.match(line)
            if mm:
                static, name, params, ret = mm.groups()
                n = 0 if not params.strip() else params.count(",") + 1
                classes[cur]["methods"].setdefault(name, []).append(
                    {"static": bool(static), "params": n, "ret": ret.strip()}
                )
            elif line.strip() == "}":
                cur = None
    return classes, enums


# ------------------------------------------------------------------ #
# 3b. hand-registered surface (additionalBindCode/cascadestudio.js.cpp)
#     -- these classes/methods exist at runtime but are NOT in the d.ts.
#     Transcribed from ~/Desktop/ocjs-fork/build/additionalBindCode/.
# ------------------------------------------------------------------ #

def _mk(methods, statics=(), ctors=(), parent=None):
    d = {"methods": {}, "ctors": list(ctors), "parent": parent}
    for m in methods:
        d["methods"][m] = [{"static": False, "params": -1, "ret": "?"}]
    for m in statics:
        d["methods"][m] = [{"static": True, "params": -1, "ret": "?"}]
    return d


_ARRAY1 = ["Size", "Length", "IsEmpty", "Lower", "Upper", "IsDeletable",
           "Resize", "SetValue", "Value"]
EXTRA_SURFACE = {
    "TopoDS_Cast": _mk([], statics=[f"{k}_{i}" for k in
        ["Vertex", "Edge", "Wire", "Face", "Shell", "Solid", "Compound"]
        for i in (1, 2)], ctors=[0]),
    "OCJS": _mk([], statics=["getStandard_FailureData", "HashCode",
        "BooleanCut", "BooleanFuse", "BooleanCommon"], ctors=[0]),
    "OCJS_Out": _mk([], statics=[
        "Circ2d2TanRad_Tangency1", "Circ2d2TanRad_Tangency2",
        "Circ2d2TanOn_Tangency1", "Circ2d2TanOn_Tangency2",
        "Circ2d3Tan_Tangency1", "Circ2d3Tan_Tangency2", "Circ2d3Tan_Tangency3",
        "Circ2dTanCen_Tangency1", "Circ2dTanOnRad_Tangency1",
        "Lin2dTanObl_Tangency1", "FilletAlgo_Result",
        "ProjectPointOnSurf_LowerDistanceParameters",
        "ProjectPointOnSurf_Parameters"], ctors=[0]),
    "TopTools_ListOfShape": _mk(["Append", "Size", "Clear", "First"],
                                ctors=[0]),
    "TopTools_IndexedDataMapOfShapeListOfShape": _mk(
        ["Extent", "Contains", "FindKey", "FindFromIndex", "FindFromKey",
         "FindIndex", "Clear"], ctors=[0]),
    "TColStd_IndexedDataMapOfStringString": _mk(["Extent", "Add"], ctors=[0]),
    "TColgp_Array1OfPnt": _mk(_ARRAY1, ctors=[0, 2]),
    "TColgp_Array1OfDir": _mk(_ARRAY1, ctors=[0, 2]),
    "TColgp_Array1OfPnt2d": _mk(_ARRAY1, ctors=[0, 2]),
    "TColgp_Array1OfVec": _mk(_ARRAY1, ctors=[0, 2]),
    "TColStd_Array1OfReal": _mk(_ARRAY1, ctors=[0, 2]),
    "TColStd_Array1OfInteger": _mk(_ARRAY1, ctors=[0, 2]),
    "TColgp_HArray1OfPnt": _mk(["SetValue", "Value", "Lower", "Upper"],
                               ctors=[2]),
    "TColStd_HArray1OfBoolean": _mk(["SetValue", "Value"], ctors=[2]),
    "Handle_TColStd_HArray1OfBoolean": _mk(["IsNull", "Nullify", "get"],
                                           ctors=[1]),
    "TColgp_Array2OfPnt": _mk(["SetValue", "Value", "NbRows", "NbColumns"],
                              ctors=[4]),
    "math_Matrix": _mk(["Value", "SetValue", "LowerRow", "UpperRow",
                        "LowerCol", "UpperCol"], ctors=[4]),
    "TColStd_Array2OfReal": _mk(["Value", "SetValue", "NbRows", "NbColumns"],
                                ctors=[4]),
    "TColStd_HArray1OfInteger": _mk(["Value", "SetValue"], ctors=[2]),
    "TColStd_HArray1OfReal": _mk(["Value", "SetValue"], ctors=[2]),
    "Handle_TColStd_HArray1OfReal": _mk(["IsNull", "get"], ctors=[1]),
    "Handle_TColStd_HArray1OfInteger": _mk(["IsNull", "get"], ctors=[1]),
    "TColgp_HArray1OfPnt2d": _mk(["Value", "SetValue"], ctors=[2]),
    "Handle_TColgp_HArray1OfPnt2d": _mk(["IsNull", "get"], ctors=[1]),
    "Handle_Geom_BSplineSurface": _mk(["IsNull", "Nullify", "AsGeomSurface"],
                                      ctors=[1]),
    "BRepAlgoAPI_Algo": _mk(["Shape", "Clear", "ClearWarnings",
        "SetFuzzyValue", "FuzzyValue", "HasErrors", "HasWarnings",
        "SetRunParallel", "RunParallel", "SetUseOBB"],
        parent="BRepBuilderAPI_MakeShape"),
    "BRepAlgoAPI_BuilderAlgo": _mk(["SetArguments", "SetNonDestructive",
        "NonDestructive"], parent="BRepAlgoAPI_Algo"),
    "BRepMesh_IncrementalMesh": _mk([], ctors=[5],
                                    parent="BRepMesh_DiscretRoot"),
    # Geom2dGcc handle-y Handle types from HANDLE_BINDINGS
    "Handle_Geom_Curve": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Geom_BezierCurve": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Geom_BSplineCurve": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Geom_TrimmedCurve": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Geom_Circle": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Geom_Surface": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Poly_Triangulation": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
    "Handle_Poly_PolygonOnTriangulation": _mk(["IsNull", "Nullify", "get"],
                                              ctors=[1]),
    "Handle_TColgp_HArray1OfPnt": _mk(["IsNull", "Nullify", "get"], ctors=[1]),
}


def merge_extra_surface(dts_classes):
    for name, d in EXTRA_SURFACE.items():
        if name in dts_classes:
            ex = dts_classes[name]
            for k, v in d["methods"].items():
                ex["methods"].setdefault(k, []).extend(v)
            ex["ctors"] = sorted(set(ex["ctors"]) | set(d["ctors"]))
            if d.get("parent") and not ex.get("parent"):
                ex["parent"] = d["parent"]
        else:
            dts_classes[name] = d


# ------------------------------------------------------------------ #
# 4. classification                                                    #
# ------------------------------------------------------------------ #


def classify(usage: Usage, dts_classes, dts_enums):
    # index: base method name -> variants, per class
    def find_class(cls):
        return dts_classes.get(cls)

    def all_methods(cls, seen=None):
        """Methods including inherited ones (embind subclasses inherit)."""
        seen = seen or set()
        out = {}
        while cls and cls in dts_classes and cls not in seen:
            seen.add(cls)
            for k, v in dts_classes[cls]["methods"].items():
                out.setdefault(k, []).extend(v)
            cls = dts_classes[cls].get("parent")
        return out

    enum_member_index = {}
    for en, members in dts_enums.items():
        for mem in members:
            enum_member_index.setdefault(mem, []).append(en)

    bill = defaultdict(lambda: {"methods": {}, "ctor": None, "classref": 0,
                                "enum_members": {}, "module": None})
    item_sites_by_status = defaultdict(list)  # filled at the END of the loop
    for (mod, cls, meth, kind), sites in sorted(
            usage.items.items(), key=lambda kv: tuple(str(x) for x in kv[0])):
        count = len(sites)
        base_kind = kind.split("/")[0]
        # per-call-site coarse arg signatures (kind still carries the arity)
        sig_counts: dict[str, int] = {}
        for s in usage.sigs.get((mod, cls, meth, kind), []):
            if s is None:
                continue
            sig_counts[s] = sig_counts.get(s, 0) + 1

        if base_kind in ("modattr", "modcall"):
            # module-level name: OCP enums / module constants (ta.TopAbs_VERTEX
            # style is actually TopAbs_ShapeEnum.TopAbs_VERTEX in OCP; both
            # covered by the enum-member index)
            name = cls  # here `cls` holds the attr name
            entry = bill[f"[module {mod}]"]
            entry["module"] = mod
            in_enums = enum_member_index.get(name, [])
            info = introspect(mod, name, None)
            status = "EXACT-ENUM" if in_enums else (
                "CLASS" if name in dts_classes else (
                    "EXACT-ENUM-TYPE" if name in dts_enums else "MISSING"))
            entry["enum_members"][name] = {
                "count": count, "status": status,
                "dts_enums": in_enums, "sites": sites[:4],
            }
            continue

        entry = bill[cls]
        entry["module"] = mod

        if base_kind == "classref":
            entry["classref"] += count
            continue

        pyinfo = INTROSPECT_CACHE.get((mod, cls, meth))
        if pyinfo is None:
            pyinfo = introspect(mod, cls, meth)
            INTROSPECT_CACHE[(mod, cls, meth)] = pyinfo

        dcls = find_class(cls)
        if base_kind == "ctor":
            nargs = int(kind.split("/")[1])
            cur = entry["ctor"] or {"count": 0, "arities": {}, "status": None,
                                    "sites": [], "sig_sites": {}}
            cur["count"] += count
            cur["arities"][str(nargs)] = cur["arities"].get(str(nargs), 0) + count
            cur["sites"] = (cur["sites"] + sites)[:6]
            cur.setdefault("sig_sites", {})
            for sg, c in sig_counts.items():
                key = f"{nargs}:{sg}"
                cur["sig_sites"][key] = cur["sig_sites"].get(key, 0) + c
            if dcls is None:
                # maybe it's an enum type used as constructor-ish (rare) or a
                # class whose ctor classes exist but base absent
                cur["status"] = "MISSING-CLASS" if cls not in dts_enums else "ENUM"
            elif dcls["ctors"]:
                cur["status"] = "EXACT" if nargs in dcls["ctors"] or True else "?"
                # embind ctor overloads are positional classes; the shim's
                # dispatcher handles arity -> _N. Call it OVERLOAD-MAPPABLE.
                cur["status"] = "OVERLOAD-MAPPABLE" if len(dcls["ctors"]) > 1 \
                    else "EXACT"
            else:
                cur["status"] = "NO-CTOR-BOUND"
            entry["ctor"] = cur
            continue

        # method-level (static / imeth / unattr / attr)
        mrec = entry["methods"].setdefault(meth, {
            "count": 0, "kinds": {}, "sites": [], "pybind": None, "status": None,
            "tuple_ret": False, "sig_sites": {},
        })
        mrec["count"] += count
        mrec["kinds"][base_kind] = mrec["kinds"].get(base_kind, 0) + count
        mrec["sites"] = (mrec["sites"] + sites)[:6]
        mrec.setdefault("sig_sites", {})
        if "/" in kind:
            _arity = kind.split("/")[1]
            for sg, c in sig_counts.items():
                key = f"{_arity}:{sg}"
                mrec["sig_sites"][key] = mrec["sig_sites"].get(key, 0) + c
        if pyinfo.get("exists") and pyinfo.get("sigs"):
            mrec["pybind"] = {
                "kind": pyinfo.get("kind"),
                "overloads": len(pyinfo["sigs"]),
                "ret": pyinfo["sigs"][0]["ret"],
            }
            mrec["tuple_ret"] = any(s["tuple_ret"] for s in pyinfo["sigs"])

        # classify against d.ts
        base = meth[:-2] if meth.endswith("_s") else meth

        # systematic rename: OCP's TopoDS.Xxx_s downcasts are our hand-bound
        # TopoDS_Cast.Xxx_1/_2 statics
        if cls == "TopoDS" and base in ("Vertex", "Edge", "Wire", "Face",
                                        "Shell", "Solid", "Compound"):
            mrec["status"] = "CONVENTION-GAP(rename:TopoDS_Cast." + base + "_N)"
            continue
        if cls == "?":
            # unattributed: is the name bound ANYWHERE?
            holders = [c for c, d in dts_classes.items() if base in d["methods"]
                       or any(re.match(rf"^{re.escape(base)}_\d+$", k)
                              for k in d["methods"])]
            mrec["status"] = "UNATTRIBUTED-" + ("FOUND" if holders else "MISSING")
            mrec["dts_holders"] = len(holders)
            continue
        if dcls is None:
            if cls in dts_enums:
                mrec["status"] = "EXACT-ENUM" if meth in dts_enums[cls] \
                    else "MISSING-ENUM-MEMBER"
            else:
                mrec["status"] = "MISSING-CLASS"
            continue
        meths = all_methods(cls)
        exact = base in meths
        suffixed = [k for k in meths
                    if re.match(rf"^{re.escape(base)}_\d+$", k)]
        if exact or suffixed:
            variants = (meths.get(base) or []) + \
                [v for k in suffixed for v in meths[k]]
            need_static = pyinfo.get("kind") == "static" or meth.endswith("_s")
            have_static = any(v["static"] for v in variants)
            if mrec["tuple_ret"]:
                mrec["status"] = "CONVENTION-GAP(out-params)"
            elif need_static and not have_static:
                mrec["status"] = "CONVENTION-GAP(staticness)"
            elif exact and len(variants) == 1:
                mrec["status"] = "EXACT"
            else:
                mrec["status"] = "OVERLOAD-MAPPABLE"
        else:
            if base_kind == "attr" and not pyinfo.get("sigs"):
                # enum member read off a class-looking name
                if cls in dts_enums and meth in dts_enums[cls]:
                    mrec["status"] = "EXACT-ENUM"
                    continue
            # isinstance-narrowing rescue: upstream often narrows a Geom_Curve/
            # Geom_Surface/TopoDS_Shape receiver via isinstance before calling
            # a subclass method; our dataflow doesn't model that. If a d.ts
            # SUBCLASS of the receiver has the method, it's really there.
            def _descends(child, ancestor):
                seen = set()
                while child and child not in seen:
                    if child == ancestor:
                        return True
                    seen.add(child)
                    child = dts_classes.get(child, {}).get("parent")
                return False

            holders = [c for c, d in dts_classes.items()
                       if (base in d["methods"] or any(
                           re.match(rf"^{re.escape(base)}_\d+$", k)
                           for k in d["methods"]))]
            sub_holders = [h for h in holders if _descends(h, cls)]
            if sub_holders:
                mrec["status"] = "EXACT-NARROWED"
                mrec["narrowed_holders"] = sub_holders[:5]
            elif holders and cls in ("TopoDS_Shape",):
                # .wrapped-heuristic receiver was probably wrong; the method
                # exists elsewhere -- needs eyes, but not a missing binding
                mrec["status"] = "HEURISTIC-RECEIVER-FOUND"
                mrec["dts_holders_list"] = holders[:5]
            else:
                mrec["status"] = "MISSING"
    return bill


def main():
    preseed_class_modules()
    usage = Usage()
    np_usage = NpUsage()
    for f in TARGET_FILES:
        rel = str(f.relative_to(B123D))
        tree = ast.parse(f.read_text())
        sc = ModuleScanner(rel, usage, np_usage)
        sc.visit(tree)

    dts_classes, dts_enums = parse_dts(DTS)
    merge_extra_surface(dts_classes)
    bill = classify(usage, dts_classes, dts_enums)

    # ---- summary ---------------------------------------------------- #
    tally = defaultdict(int)
    tally_sites = defaultdict(int)
    missing = []
    for cls, entry in bill.items():
        if entry["ctor"]:
            tally["ctor:" + entry["ctor"]["status"]] += 1
            tally_sites["ctor:" + entry["ctor"]["status"]] += entry["ctor"]["count"]
            if "MISSING" in entry["ctor"]["status"]:
                missing.append(f"{cls}.__init__ x{entry['ctor']['count']}")
        for meth, m in entry["methods"].items():
            tally[m["status"]] += 1
            tally_sites[m["status"]] += m["count"]
            if "MISSING" in (m["status"] or ""):
                missing.append(f"{cls}.{meth} x{m['count']} ({m['sites'][0]})")
        for name, e in entry["enum_members"].items():
            tally["enum:" + e["status"]] += 1
            tally_sites["enum:" + e["status"]] += e["count"]
            if "MISSING" in e["status"]:
                missing.append(f"{entry['module']}::{name} x{e['count']}")

    # per-file status histogram (recompute statuses per raw usage item)
    per_file = defaultdict(lambda: defaultdict(int))
    status_index = {}
    for cls, entry in bill.items():
        if entry["ctor"]:
            status_index[(cls, None, "ctor")] = "ctor:" + entry["ctor"]["status"]
        for meth, m in entry["methods"].items():
            status_index[(cls, meth, "meth")] = m["status"]
        for name, e in entry["enum_members"].items():
            status_index[(entry["module"], name, "enum")] = "enum:" + e["status"]
    for (mod, cls, meth, kind), sites in usage.items.items():
        base_kind = kind.split("/")[0]
        if base_kind == "classref":
            st = "classref"
        elif base_kind in ("modattr", "modcall"):
            st = status_index.get((mod, cls, "enum"), "?")
        elif base_kind == "ctor":
            st = status_index.get((cls, None, "ctor"), "?")
        else:
            st = status_index.get((cls, meth, "meth"), "?")
        for s in sites:
            f = s.split(":")[0]
            per_file[f]["total"] += 1
            key = ("BLOCKED" if st and ("MISSING" in st)
                   else "GLUE" if st and ("CONVENTION" in st or
                                          "HEURISTIC" in st or "?" == st)
                   else "OK")
            per_file[f][key] += 1

    out = {
        "generated": "extract_ocp_bill.py over build123d 0.11.1 "
                     "geometry.py+topology/*.py vs cascadestudio.d.ts",
        "summary": {"unique_items": dict(sorted(tally.items())),
                    "call_sites": dict(sorted(tally_sites.items()))},
        "per_file_call_sites": {k: dict(v) for k, v in sorted(per_file.items())},
        "missing_list": sorted(missing),
        "per_class": {k: v for k, v in sorted(bill.items())},
    }
    (OUT_DIR / "ocp-method-bill.json").write_text(json.dumps(out, indent=1))

    np_out = {
        "calls": {k: {"count": len(v), "sites": v[:6]}
                  for k, v in sorted(np_usage.calls.items())},
        "attrs": {k: {"count": len(v), "sites": v[:6]}
                  for k, v in sorted(np_usage.attrs.items())},
    }
    (OUT_DIR / "numpy-bill.json").write_text(json.dumps(np_out, indent=1))

    print(json.dumps(out["summary"], indent=1))
    print("MISSING items:", len(out["missing_list"]))
    for m in out["missing_list"][:60]:
        print("  ", m)
    print("numpy call paths:", len(np_out["calls"]),
          "attr paths:", len(np_out["attrs"]))


if __name__ == "__main__":
    main()
