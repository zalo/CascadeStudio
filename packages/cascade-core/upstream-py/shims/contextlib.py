# `contextlib` shim (MicroPython 1.28 ships none): just what upstream
# build123d Level-A uses — AbstractContextManager as a plain base class and
# the generator-based @contextmanager decorator.


class AbstractContextManager:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None


class _GeneratorContextManager(AbstractContextManager):
    def __init__(self, gen):
        self._gen = gen

    def __enter__(self):
        try:
            return next(self._gen)
        except StopIteration:
            raise RuntimeError("generator didn't yield")

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            try:
                next(self._gen)
            except StopIteration:
                return False
            raise RuntimeError("generator didn't stop")
        try:
            self._gen.throw(exc if exc is not None else exc_type())
        except StopIteration:
            return True
        return False


def contextmanager(func):
    def helper(*args, **kwargs):
        return _GeneratorContextManager(func(*args, **kwargs))
    return helper


class suppress(AbstractContextManager):
    def __init__(self, *exceptions):
        self._exceptions = exceptions

    def __exit__(self, exc_type, exc, tb):
        return exc_type is not None and issubclass(exc_type, self._exceptions)
