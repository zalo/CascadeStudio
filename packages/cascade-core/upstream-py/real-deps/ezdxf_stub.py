# HONEST ezdxf stub (pysrc=real on Pyodide): real ezdxf is a 32 MB pure tree
# — unreasonable for a browser payload whose DXF entry points cannot write a
# file anyway. This satisfies build123d's MODULE-LEVEL import surface
# (exporters.py, import_dxf.py) exactly; any USE raises loudly.
#
# Import surface served (verified against build123d 0.11.1):
#   import ezdxf; from ezdxf import zoom; from ezdxf.colors import RGB,
#   aci2rgb; from ezdxf.math import Vec2; ezdxf.units.MM/... (class-level
#   dict values); ezdxf.DXF2013 (def-time default); ezdxf.DXFStructureError
#   (except clause); from ezdxf.entities import DXFGraphic; from
#   ezdxf.entities.boundary_paths import ArcEdge/EdgePath/EllipseEdge/
#   LineEdge/PolylinePath/SplineEdge (isinstance targets).

DXF2013 = 'AC1027'  # the def-time default of ExportDXF(version=...)


class DXFStructureError(Exception):
    pass


def _raise(name):
    raise NotImplementedError(
        'ezdxf.' + name + ' is not available in the browser worker '
        '(pysrc=real ships an import-satisfying ezdxf stub; DXF '
        'export/import needs the real 32 MB ezdxf package and a filesystem)')


def new(*a, **k):
    _raise('new')


def read(*a, **k):
    _raise('read')


def readfile(*a, **k):
    _raise('readfile')


def __getattr__(name):
    if name.startswith('__'):  # import-machinery probes need AttributeError
        raise AttributeError(name)
    _raise(name)
