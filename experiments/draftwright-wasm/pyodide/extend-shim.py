# Regenerate the OCP shim with draftwright's OCP names billed, into a scratch
# directory (the repo's ocp_shim/ is left alone):
#
#   python3 -I experiments/draftwright-wasm/pyodide/extend-shim.py <scratch>
#   node <scratch>/gen-ocp-shim.mjs
#
# then run.mjs with DW_GEN_SHIM=<scratch>. all-ocp.json is ocp-imports.py's
# inventory of draftwright + quiddity + build123d-drafting-helpers.
import glob, json, os, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPIKE = ROOT / 'experiments' / 'upstream-topology-spike'
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
for f in ('ocp-method-bill.json', 'ocp-defaults.json'):
    shutil.copy(SPIKE / f, out / f)
gen = (SPIKE / 'gen-ocp-shim.mjs').read_text()
gen = re.sub(r"^const ROOT = .*$", "const ROOT = %r;" % str(ROOT), gen, flags=re.M)
gen = re.sub(r"^const OUT = .*$", "const OUT = %r;" % str(out / 'ocp_shim'), gen, flags=re.M)
gen = gen.replace("join(ROOT, 'packages', 'cascade-core', 'upstream-py', 'ocp_import_map.json')",
                  repr(str(out / 'ocp_import_map.json')))
(out / 'gen-ocp-shim.mjs').write_text(gen)
if not (out / 'ocp_shim').exists():
    shutil.copytree(ROOT / 'packages' / 'cascade-core' / 'upstream-py' / 'ocp_shim', out / 'ocp_shim')

# 1. the import map: build123d's plus every OCP name the draftwright stack imports
m = json.loads((ROOT / 'packages' / 'cascade-core' / 'upstream-py' / 'ocp_import_map.json').read_text())
extra = json.loads((Path(__file__).parent / 'all-ocp.json').read_text())
extra.setdefault('BRepIntCurveSurface', []).append('BRepIntCurveSurface_Inter')   # polyfill.py's stand-in
for mod, names in extra.items():
    cur = m.setdefault(mod, [])
    cur += [n for n in names if n not in cur]
(out / 'ocp_import_map.json').write_text(json.dumps(m, indent=1))

# 2. the bill: the generator's class closure comes from the bill, not the map,
#    so bill every name that the wasm build binds (d.ts) and is not billed yet
dts = (ROOT / 'node_modules' / 'opencascade.js' / 'dist' / 'cascadestudio.d.ts').read_text()
declared = set(re.findall(r'export declare class (\w+)', dts))
bill = json.loads((out / 'ocp-method-bill.json').read_text())
names = {n for v in extra.values() for n in v}
# plus what the repo's generated shim leaves as inert stubs: classes build123d
# imports outside geometry.py/topology/ (the exporters), never billed
for f in glob.glob(str(ROOT / 'packages' / 'cascade-core' / 'upstream-py' / 'ocp_shim' / 'OCP' / '*.py')):
    names |= set(re.findall(r'^class (\w+)\(_Any\)', open(f).read(), re.M))
added = sorted(n for n in names if n in declared and n not in bill['per_class'])
for n in added:
    bill['per_class'][n] = {'methods': {}}
(out / 'ocp-method-bill.json').write_text(json.dumps(bill))
print('billed:', added)
print('not bound in the wasm build:', sorted(n for n in names if n not in declared
                                              and not re.match(r'^(TopAbs|GeomAbs|IFSelect)_', n)))
