# `contextvars` shim: build123d uses ContextVar purely as a builder STACK
# (set on __enter__, reset on __exit__) in single-threaded code, so a plain
# list-backed implementation is exact. _cs_reset_all() clears every var
# between user evaluations (a JS-level abort can skip Python unwinding).
_MISSING = object()
_ALL_VARS = []


class Token:
    def __init__(self, var, old):
        self.var = var
        self.old = old


class ContextVar:
    def __init__(self, name, default=_MISSING):
        self._name = name
        self._stack = []
        self._default = default
        _ALL_VARS.append(self)

    def get(self, default=_MISSING):
        if self._stack:
            return self._stack[-1]
        if default is not _MISSING:
            return default
        if self._default is not _MISSING:
            return self._default
        raise LookupError(self._name)

    def set(self, value):
        old = self._stack[-1] if self._stack else _MISSING
        self._stack.append(value)
        return Token(self, old)

    def reset(self, token):
        if self._stack:
            self._stack.pop()


def _cs_reset_all():
    for v in _ALL_VARS:
        del v._stack[:]


def copy_context():
    raise NotImplementedError('contextvars.copy_context')
