# ocp_glue — runtime-neutral glue classes for OCP names the opencascade.js
# fork never bound, shared by ocp_core.py (MicroPython) and
# ocp_core_pyodide.py (Pyodide). Re-exported by both as ocp_core.<Name>; the
# generated OCP/<module>.py files import them from there
# (gen-ocp-shim.mjs CLASS_GLUE).
#
# OCP 8 binds NCollection_Map / NCollection_DataMap over TopoDS_Shape as
# OCP.collections.Map_TopoDS_Shape_TopTools_ShapeMapHasher /
# DataMap_TopoDS_Shape_TopoDS_Shape_TopTools_ShapeMapHasher (0.13's
# topology/history.py — the Select.LAST/NEW record). The fork never bound
# them as classes (they only appear as parameter types). They are never
# handed TO the kernel by build123d, so Python glue with the SAME key
# semantics is exact: TopTools_ShapeMapHasher hashes with std::hash
# <TopoDS_Shape> (TShape + Location, orientation-blind) — the very hash
# OcpProxy.__hash__ already uses (OCJS.HashCode) — and compares with IsSame.
def _shape_key(s):
    return hash(s)


class CsShapeMap:
    """Map_TopoDS_Shape_TopTools_ShapeMapHasher (exact-semantics glue)."""

    def __init__(self, *args):
        self._b = {}
        self._n = 0

    def Add(self, s):
        k = _shape_key(s)
        bucket = self._b.get(k)
        if bucket is None:
            self._b[k] = [s]
        else:
            for x in bucket:
                if x.IsSame(s):
                    return False
            bucket.append(s)
        self._n += 1
        return True

    def Contains(self, s):
        bucket = self._b.get(_shape_key(s))
        if bucket:
            for x in bucket:
                if x.IsSame(s):
                    return True
        return False

    def Remove(self, s):
        bucket = self._b.get(_shape_key(s))
        if bucket:
            for i, x in enumerate(bucket):
                if x.IsSame(s):
                    del bucket[i]
                    self._n -= 1
                    return True
        return False

    def Extent(self):
        return self._n

    Size = Extent

    def IsEmpty(self):
        return self._n == 0

    def Clear(self, *args):
        self._b = {}
        self._n = 0

    def __len__(self):
        return self._n

    def __iter__(self):
        for bucket in self._b.values():
            for x in bucket:
                yield x


class CsShapeDataMap:
    """DataMap_TopoDS_Shape_TopoDS_Shape_TopTools_ShapeMapHasher (exact-
    semantics glue; NCollection_DataMap::Bind REPLACES an existing value and
    returns False, Find raises Standard_NoSuchObject on a missing key)."""

    def __init__(self, *args):
        self._b = {}
        self._n = 0

    def _slot(self, s):
        bucket = self._b.get(_shape_key(s))
        if bucket:
            for i, kv in enumerate(bucket):
                if kv[0].IsSame(s):
                    return bucket, i
        return bucket, -1

    def Bind(self, s, v):
        bucket, i = self._slot(s)
        if i >= 0:
            bucket[i] = (bucket[i][0], v)
            return False
        if bucket is None:
            self._b[_shape_key(s)] = [(s, v)]
        else:
            bucket.append((s, v))
        self._n += 1
        return True

    def IsBound(self, s):
        return self._slot(s)[1] >= 0

    Contains = IsBound

    def Find(self, s):
        bucket, i = self._slot(s)
        if i < 0:
            try:
                from OCP.Standard import Standard_NoSuchObject
            except ImportError:
                raise KeyError('NCollection_DataMap::Find')
            raise Standard_NoSuchObject('NCollection_DataMap::Find')
        return bucket[i][1]

    def UnBind(self, s):
        bucket, i = self._slot(s)
        if i < 0:
            return False
        del bucket[i]
        self._n -= 1
        return True

    def Extent(self):
        return self._n

    Size = Extent

    def IsEmpty(self):
        return self._n == 0

    def Clear(self, *args):
        self._b = {}
        self._n = 0




class CsSLProps:
    """BRepLProp_SLProps(surface, u, v, order, resolution) stand-in (the fork
    never bound it; 0.13 Face.convexity). Holds the values the JS glue
    (OcpShim.js _csSLProps — LProp_SLProps' own computation on the bound
    Adaptor3d_Surface::D2) returned; Normal() builds a real gp_Dir proxy."""

    def __init__(self, rec, make_dir):
        self._rec = rec
        self._make_dir = make_dir

    def IsCurvatureDefined(self):
        return bool(self._rec[0])

    def IsNormalDefined(self):
        r = self._rec
        return bool(r[0]) or (r[1] != 0 or r[2] != 0 or r[3] != 0)

    def _need(self):
        if not self._rec[0]:
            try:
                from OCP.LProp import LProp_NotDefined as _nd
            except ImportError:
                _nd = RuntimeError
            raise _nd('BRepLProp_SLProps: curvature not defined')

    def Normal(self):
        if not self.IsNormalDefined():
            self._need()
        r = self._rec
        return self._make_dir(float(r[1]), float(r[2]), float(r[3]))

    def MinCurvature(self):
        self._need()
        return float(self._rec[4])

    def MaxCurvature(self):
        self._need()
        return float(self._rec[5])

    def MeanCurvature(self):
        self._need()
        return float(self._rec[6])

    def GaussianCurvature(self):
        self._need()
        return float(self._rec[7])
