# Import-time placeholders for OCP names the shim does not provide: any CALL
# raises, so the run shows which unbound classes the drawing path really uses.
import sys, types, json, importlib
_USED = []
class _PhMeta(type):
    def __getattr__(cls, name):
        if name.startswith('__'):
            raise AttributeError(name)
        return _ph(cls.__qualname__ + '.' + name)
    def __call__(cls, *a, **k):
        _USED.append(cls.__qualname__)
        raise NotImplementedError('OCP ' + cls.__qualname__ + ' is not bound in this build')
def _ph(qual):
    return _PhMeta(qual.split('.')[-1], (), {'__qualname__': qual})
_MAP = json.loads(open('/tmp/all-ocp.json').read())
_added = []
_REEXP = []
for mod, names in _MAP.items():
    full = 'OCP.' + mod
    try:
        m = importlib.import_module(full)
    except ImportError:
        m = types.ModuleType(full); sys.modules[full] = m
        import OCP; setattr(OCP, mod, m)
    import ocp_registry as _reg
    for n in names:
        if not hasattr(m, n):
            if hasattr(_reg, n):   # generated but not re-exported by module
                setattr(m, n, getattr(_reg, n)); _REEXP.append(n); continue
            setattr(m, n, _ph(mod + '.' + n)); _added.append(full + '.' + n)
import builtins
builtins._CS_OCP_PH_USED = _USED
print('OCP re-exported from the registry:', _REEXP)
print('OCP placeholders:', len(_added), ' '.join(a[4:] for a in _added))
