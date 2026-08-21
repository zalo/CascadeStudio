# HONEST lib3mf stub (pysrc=real on Pyodide): lib3mf is a native library with
# no wasm build here (COMPROMISE(mesher): STL only, via the glue Mesher).
# build123d/mesher.py needs, AT CLASS-DEFINITION TIME, distinct hashable
# values for Lib3MF.ModelUnit.* and Lib3MF.ObjectType.* (it builds forward
# AND reverse dicts) and Lib3MF.__file__; Wrapper raises at Mesher().


class _Tag:
    __slots__ = ('_name',)

    def __init__(self, name):
        self._name = name

    def __repr__(self):
        return '<lib3mf-stub ' + self._name + '>'


class _TagSpace:
    def __init__(self, prefix):
        self._prefix = prefix
        self._cache = {}

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        got = self.__dict__['_cache'].get(name)
        if got is None:
            got = _Tag(self._prefix + '.' + name)
            self.__dict__['_cache'][name] = got
        return got

    def __call__(self, *a, **k):
        raise NotImplementedError(
            'lib3mf is not available in the browser worker (no lib3mf in '
            'the wasm build); Mesher writes STL only')


class _Lib3MF:
    __file__ = '/lib3mf-stub'
    ModelUnit = _TagSpace('ModelUnit')
    ObjectType = _TagSpace('ObjectType')

    class Wrapper:
        def __init__(self, *a, **k):
            raise NotImplementedError(
                '3MF is not available in the browser worker (no lib3mf in '
                'the wasm build); use the STL Mesher instead')

    def __getattr__(self, name):
        raise NotImplementedError(
            'lib3mf.' + name + ' is not available in the browser worker')


Lib3MF = _Lib3MF()
