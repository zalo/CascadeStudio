# ezdxf.zoom stub (see ezdxf_stub.py).
def extents(*a, **k):
    raise NotImplementedError('ezdxf.zoom: ezdxf stub (pysrc=real)')


def __getattr__(name):
    if name.startswith('__'):
        raise AttributeError(name)
    raise NotImplementedError('ezdxf.zoom.' + name + ': ezdxf stub (pysrc=real)')
