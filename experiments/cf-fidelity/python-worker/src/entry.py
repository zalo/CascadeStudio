# Probe: can a Cloudflare PYTHON Worker reach a JS module / a wasm module
# bundled next to it? (the question for hosting real build123d on the
# platform's own Pyodide, with our OCCT kernel + OCP shim in JS)
from workers import WorkerEntrypoint, Response
import sys, json

def probe():
    out = {"python": sys.version.split()[0]}
    try:
        import pyodide
        out["pyodide"] = pyodide.__version__
    except Exception as e:
        out["pyodide"] = repr(e)
    try:
        import numpy
        out["numpy"] = numpy.__version__
    except Exception as e:
        out["numpy"] = repr(e)[:200]
    for name in ("helper", "helper.mjs", "./helper.mjs"):
        try:
            m = __import__(name)
            out["import " + name] = "ok: " + str(dir(m))[:200]
        except Exception as e:
            out["import " + name] = repr(e)[:200]
    try:
        from js import globalThis
        out["globalThis.__csHelper"] = str(getattr(globalThis, "__csHelper", None))
    except Exception as e:
        out["globalThis"] = repr(e)[:200]
    try:
        from pyodide.code import run_js
        out["run_js"] = str(run_js("1+1"))
    except Exception as e:
        out["run_js"] = repr(e)[:200]
    for name in ("tiny", "tiny.wasm"):
        try:
            m = __import__(name)
            out["import " + name] = "ok: " + str(m)[:200]
        except Exception as e:
            out["import " + name] = repr(e)[:200]
    try:
        from js import WebAssembly, Uint8Array
        from pyodide.ffi import to_js
        WebAssembly.Module.new(to_js(bytes([0, 97, 115, 109, 1, 0, 0, 0])))
        out["WebAssembly.Module(bytes)"] = "ALLOWED"
    except Exception as e:
        out["WebAssembly.Module(bytes)"] = repr(e)[:200]
    import os
    try:
        out["bundle files"] = sorted(os.listdir("/session/metadata"))[:20]
    except Exception as e:
        out["bundle files"] = repr(e)[:200]
    return out

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response(json.dumps(probe(), indent=1), headers={"content-type": "application/json"})
