// CsOcpShim.js — the `_cs_ocp` Python module: the handful of OCP names the
// vendored build123d_drafting feature finders (Build123dDrafting.js) use,
// answered by the worker's OCCT through two StandardLibrary helpers
// (_csSurfaceInfo, _csOrientation) — lite has no OCP layer of its own. Also
// the `Record` base that stands in for frozen dataclasses (MicroPython keeps
// no __annotations__, so fields are listed explicitly). No backticks or
// dollar-brace below: this is a template string.
export const CS_OCP_PY = `
"""_cs_ocp (build123d-lite): BRepAdaptor_Surface, GeomAbs_* and
TopAbs_Orientation as the vendored build123d_drafting module uses them, and
Record, a frozen-dataclass stand-in (asdict, is_dataclass)."""
from browser import self as _w

GeomAbs_Plane = 'Plane'
GeomAbs_Cylinder = 'Cylinder'
GeomAbs_Cone = 'Cone'
GeomAbs_Sphere = 'Sphere'
GeomAbs_Torus = 'Torus'
GeomAbs_BezierSurface = 'BezierSurface'
GeomAbs_BSplineSurface = 'BSplineSurface'
GeomAbs_SurfaceOfRevolution = 'SurfaceOfRevolution'
GeomAbs_SurfaceOfExtrusion = 'SurfaceOfExtrusion'
GeomAbs_OffsetSurface = 'OffsetSurface'
GeomAbs_OtherSurface = 'OtherSurface'


class TopAbs_Orientation:
    TopAbs_FORWARD = 'FORWARD'
    TopAbs_REVERSED = 'REVERSED'
    TopAbs_INTERNAL = 'INTERNAL'
    TopAbs_EXTERNAL = 'EXTERNAL'


def orientation(wrapped):
    """TopoDS_Shape::Orientation() as a TopAbs_Orientation name."""
    return str(_w._csOrientation(wrapped))


class _XYZ:
    def __init__(self, x, y, z):
        self._v = (float(x), float(y), float(z))

    def X(self):
        return self._v[0]

    def Y(self):
        return self._v[1]

    def Z(self):
        return self._v[2]


class _Ax1:
    def __init__(self, loc, d):
        self._loc = _XYZ(*loc)
        self._dir = _XYZ(*d)

    def Location(self):
        return self._loc

    def Direction(self):
        return self._dir


class _Ax3(_Ax1):
    def __init__(self, loc, d, direct):
        _Ax1.__init__(self, loc, d)
        self._direct = bool(direct)

    def Direct(self):
        return self._direct

    def Axis(self):
        return _Ax1(self._loc._v, self._dir._v)


class _Cylinder:
    def __init__(self, i):
        self._r = i[0]
        self._pos = _Ax3(i[1:4], i[4:7], i[7])

    def Radius(self):
        return self._r

    def Axis(self):
        return self._pos.Axis()

    def Position(self):
        return self._pos

    def Location(self):
        return self._pos.Location()


class _Cone:
    def __init__(self, i):
        self._a = i[0]
        self._apex = _XYZ(*i[1:4])
        self._ax = _Ax1(i[4:7], i[7:10])
        self._ref = i[10]

    def SemiAngle(self):
        return self._a

    def Apex(self):
        return self._apex

    def Axis(self):
        return self._ax

    def Location(self):
        return self._ax.Location()

    def RefRadius(self):
        return self._ref


class _Sphere:
    def __init__(self, i):
        self._r = i[0]
        self._pos = _Ax3(i[1:4], (0.0, 0.0, 1.0), i[4])

    def Radius(self):
        return self._r

    def Location(self):
        return self._pos.Location()

    def Position(self):
        return self._pos


class _Torus:
    def __init__(self, i):
        self._big, self._small = i[0], i[1]
        self._pos = _Ax3(i[2:5], i[5:8], i[8])

    def MajorRadius(self):
        return self._big

    def MinorRadius(self):
        return self._small

    def Axis(self):
        return self._pos.Axis()

    def Position(self):
        return self._pos


class BRepAdaptor_Surface:
    """BRepAdaptor_Surface(face.wrapped): the surface type, the parameter
    ranges and the analytic surface of a face."""

    def __init__(self, wrapped, restriction=True):
        info = [x for x in _w._csSurfaceInfo(wrapped)]
        self._type = str(info[0])
        self._u0, self._u1, self._v0, self._v1 = [float(x) for x in info[1:5]]
        self._params = [float(x) for x in info[6:]]

    def GetType(self):
        return self._type

    def FirstUParameter(self):
        return self._u0

    def LastUParameter(self):
        return self._u1

    def FirstVParameter(self):
        return self._v0

    def LastVParameter(self):
        return self._v1

    def _need(self, kind, n):
        if self._type != kind or len(self._params) < n:
            raise ValueError('BRepAdaptor_Surface: the face is a ' + self._type + ', not a ' + kind)
        return self._params

    def Cylinder(self):
        return _Cylinder(self._need('Cylinder', 8))

    def Cone(self):
        return _Cone(self._need('Cone', 11))

    def Sphere(self):
        return _Sphere(self._need('Sphere', 5))

    def Torus(self):
        return _Torus(self._need('Torus', 9))


class BRepCheck_Status:
    BRepCheck_NoError = 'NoError'
    BRepCheck_NotClosed = 'NotClosed'


class BRepCheck_Shell:
    """BRepCheck_Shell(shell).Closed(): NoError when the shell is closed and
    consistently oriented (StandardLibrary _csShellClosed)."""

    def __init__(self, wrapped):
        self._shell = wrapped

    def Closed(self, update=False):
        return BRepCheck_Status.BRepCheck_NoError if _w._csShellClosed(self._shell) \
            else BRepCheck_Status.BRepCheck_NotClosed


class StrEnumValue:
    """A StrEnum member without a metaclass: .name, .value, compares and
    hashes like its string value."""

    def __init__(self, name, value):
        self.name = name
        self.value = value

    def __str__(self):
        return self.value

    def __repr__(self):
        return '<' + self.name + ': ' + repr(self.value) + '>'

    def __format__(self, spec):
        return format(self.value, spec)

    def __eq__(self, other):
        return (other.value if isinstance(other, StrEnumValue) else other) == self.value

    def __ne__(self, other):
        return not self.__eq__(other)

    def __lt__(self, other):
        return self.value < (other.value if isinstance(other, StrEnumValue) else other)

    def __hash__(self):
        return hash(self.value)


class Record:
    """A frozen dataclass stand-in: subclasses list _fields (and optional
    _defaults); instances compare and hash by value."""
    _fields = ()
    _defaults = {}

    def __init__(self, *args, **kwargs):
        names = self._fields
        if len(args) > len(names):
            raise TypeError(type(self).__name__ + '() takes ' + str(len(names)) + ' arguments')
        for i in range(len(names)):
            n = names[i]
            if i < len(args):
                v = args[i]
            elif n in kwargs:
                v = kwargs.pop(n)
            elif n in self._defaults:
                v = self._defaults[n]
            else:
                raise TypeError(type(self).__name__ + "() missing argument '" + n + "'")
            setattr(self, n, v)
        if kwargs:
            raise TypeError(type(self).__name__ + '() got unexpected ' + ', '.join(kwargs))

    def _values(self):
        return tuple(getattr(self, n) for n in self._fields)

    def __eq__(self, other):
        return type(other) is type(self) and self._values() == other._values()

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return hash(self._values())

    def __repr__(self):
        return type(self).__name__ + '(' + ', '.join(
            n + '=' + repr(getattr(self, n)) for n in self._fields) + ')'


def is_dataclass(o):
    return isinstance(o, Record) or (isinstance(o, type) and issubclass(o, Record))


def asdict(o):
    if isinstance(o, Record):
        return dict((n, asdict(getattr(o, n))) for n in o._fields)
    if isinstance(o, (list, tuple)):
        return type(o)(asdict(x) for x in o)
    if isinstance(o, dict):
        return dict((k, asdict(v)) for k, v in o.items())
    return o
`;
