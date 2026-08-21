# HONEST requests stub (pysrc=real on Pyodide): exporters3d imports requests
# at module level for export_to_pcbway uploads. Any USE raises loudly.


def _raise(name):
    raise NotImplementedError(
        'requests.' + name + ' is not available in the browser worker')


def get(*a, **k):
    _raise('get')


def post(*a, **k):
    _raise('post')


def __getattr__(name):
    if name.startswith('__'):
        raise AttributeError(name)
    _raise(name)
