# `inspect` shim over the settrace current-frame tracker the MicroPython
# runtime already maintains (browser._cur): currentframe() must return the
# CALLER's frame, which is exactly f_back of our own frame (our own frame is
# the latest 'call' event the tracer saw). Frame objects are identity-stable
# in MicroPython, so build_common's same-scope builder rule
# (`parent._python_frame == frame.f_back`) works unchanged.
import browser as _browser


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
