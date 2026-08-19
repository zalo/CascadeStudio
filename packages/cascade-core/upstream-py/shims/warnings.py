# `warnings` shim: warnings are dropped (the worker console is the user's
# log surface; build123d Level A only warns about empty builder results).
def warn(*a, **k):
    pass


def simplefilter(*a, **k):
    pass


def filterwarnings(*a, **k):
    pass


def catch_warnings(*a, **k):
    class _Ctx:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False
    return _Ctx()
