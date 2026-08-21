# ezdxf.colors stub (see ezdxf_stub.py).
class RGB(tuple):
    def __new__(cls, r=0, g=0, b=0):
        return tuple.__new__(cls, (r, g, b))


def aci2rgb(*a, **k):
    raise NotImplementedError('ezdxf.colors.aci2rgb: ezdxf stub (pysrc=real)')
