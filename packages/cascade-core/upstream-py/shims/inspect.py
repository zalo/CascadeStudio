# `inspect` shim: currentframe() must return the CALLER's frame, which is
# exactly f_back of our own frame. Preferred path: sys._getframe (the custom
# micropython-cs interpreter build — live frames, no tracing). Fallback
# (stock settrace artifacts): the settrace current-frame tracker the runtime
# already maintains (browser._cur; our own frame is the latest 'call' event
# the tracer saw). Frame objects are identity-stable in MicroPython on both
# paths, so build_common's same-scope builder rule
# (`parent._python_frame == frame.f_back`) works unchanged.
import sys as _sys
import browser as _browser

if hasattr(_sys, '_getframe'):
    def currentframe():
        return _sys._getframe(0).f_back
else:
    def currentframe():
        f = _browser._cur[0]
        return f.f_back if f is not None else None


def stack(*a, **k):
    frames = []
    f = currentframe()
    while f is not None:
        frames.append(f)
        f = f.f_back
    return frames


def signature(*a, **k):
    raise NotImplementedError('inspect.signature is not available')


def getmodule(*a, **k):
    return None


def isclass(obj):
    return isinstance(obj, type)


def isfunction(obj):
    return callable(obj)
