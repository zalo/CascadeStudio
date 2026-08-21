# GENERATED OCP.TopoDS — proxies over the embind binding (gen-ocp-shim.mjs)
from ocp_registry import TopoDS_Builder, TopoDS_CompSolid, TopoDS_Compound, TopoDS_Edge, TopoDS_Face, TopoDS_Iterator, TopoDS_Shape, TopoDS_Shell, TopoDS_Solid, TopoDS_Vertex, TopoDS_Wire  # noqa: F401
import ocp_core as _c
class TopoDS:
    Vertex = Vertex_s = _c.topods_downcast('Vertex')
    Edge = Edge_s = _c.topods_downcast('Edge')
    Wire = Wire_s = _c.topods_downcast('Wire')
    Face = Face_s = _c.topods_downcast('Face')
    Shell = Shell_s = _c.topods_downcast('Shell')
    Solid = Solid_s = _c.topods_downcast('Solid')
    Compound = Compound_s = _c.topods_downcast('Compound')
    CompSolid = CompSolid_s = _c.topods_downcast('CompSolid')
class _Any:
    def __init__(self, *a, **k):
        raise NotImplementedError(
            'OCP.TopoDS.' + self.__class__.__name__ + ' is not in the generated shim')
