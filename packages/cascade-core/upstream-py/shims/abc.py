# `abc` shim: ABC as a plain base, abstractmethod as identity. Abstractness
# is NOT enforced (instantiating an incomplete subclass fails only when the
# missing method is called) — build123d never relies on the enforcement.
class ABC:
    pass


def abstractmethod(f):
    return f


class ABCMeta(type):
    pass


def abstractproperty(f):
    return property(f)
