# tempfile — the MicroPython leg has no tempfile module. build123d's docs
# write meshes/exports into a TemporaryDirectory and read them back; in the
# worker every exporter writes into the in-memory FS by (flattened) file
# name, so a temp directory is just a unique, honestly-named path prefix
# (created in the interpreter's VFS when it can be). Nothing here pretends a
# disk exists: files written by build123d's exporters land in the worker
# MEMFS under the flattened name, exactly as without a temp directory.
import os as _os

_count = [0]


def gettempdir():
    return '/tmp'


def mkdtemp(suffix='', prefix='tmp', dir=None):
    _count[0] += 1
    path = (dir or gettempdir()) + '/' + prefix + 'cs' + str(_count[0]) + suffix
    for d in (dir or gettempdir(), path):
        try:
            _os.mkdir(d)
        except Exception:  # exists / no VFS mkdir — a path prefix suffices
            pass
    return path


class TemporaryDirectory:
    def __init__(self, suffix=None, prefix=None, dir=None, **kwargs):
        self.name = mkdtemp(suffix or '', prefix or 'tmp', dir)

    def __enter__(self):
        return self.name

    def __exit__(self, *exc):
        self.cleanup()
        return False

    def cleanup(self):
        try:
            _os.rmdir(self.name)
        except Exception:
            pass
