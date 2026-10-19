import ast, sys, collections, json
from pathlib import Path
root = Path(sys.argv[1])
pkg = sys.argv[2]
tops = collections.Counter()
ocp = collections.defaultdict(set)
b123d = set()
lazy = collections.Counter()   # imports inside functions
for p in root.rglob('*.py'):
    t = ast.parse(p.read_text())
    funcs = set()
    for n in ast.walk(t):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for m in ast.walk(n):
                if isinstance(m, (ast.Import, ast.ImportFrom)): funcs.add(id(m))
    for n in ast.walk(t):
        if isinstance(n, ast.Import):
            for a in n.names:
                top = a.name.split('.')[0]; tops[top]+=1
                if id(n) in funcs: lazy[top]+=1
        elif isinstance(n, ast.ImportFrom):
            if n.level: continue
            mod = n.module or ''
            top = mod.split('.')[0]; tops[top]+=1
            if id(n) in funcs: lazy[top]+=1
            if top == 'OCP':
                for a in n.names: ocp[mod[4:]].add(a.name)
            if top == 'build123d':
                for a in n.names: b123d.add(a.name)
std = set(sys.stdlib_module_names)
print('third-party / non-stdlib imports:')
for k,v in tops.most_common():
    if k not in std and k != pkg: print('  %-28s %4d (in functions: %d)' % (k, v, lazy[k]))
print('stdlib:', sorted(k for k in tops if k in std))
print('OCP modules: %d, names: %d' % (len(ocp), sum(len(v) for v in ocp.values())))
json.dump({k: sorted(v) for k,v in sorted(ocp.items())}, open(sys.argv[3], 'w'), indent=1)
print('build123d names:', len(b123d))
open(sys.argv[3].replace('.json','-b123d.txt'),'w').write('\n'.join(sorted(b123d)))
