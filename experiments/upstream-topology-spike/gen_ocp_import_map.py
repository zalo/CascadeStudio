#!/usr/bin/env python3
"""Regenerate packages/cascade-core/upstream-py/ocp_import_map.json — every
OCP name the vendored upstream build123d tree imports, per OCP module
(`from OCP.X import a, b` -> {"X": ["a", "b"]}; `import OCP.X as x` -> the
module is listed with whatever names it also imports, or []).

  python3 -I gen_ocp_import_map.py <vendor-dir> [<out-json>]
"""
import ast
import json
import sys
from pathlib import Path

src = Path(sys.argv[1])
out = Path(sys.argv[2]) if len(sys.argv) > 2 else None
names: dict[str, set] = {}
for f in sorted(src.rglob("*.py")):
    tree = ast.parse(f.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("OCP."):
            names.setdefault(node.module[4:], set()).update(a.name for a in node.names)
        elif isinstance(node, ast.Import):
            for a in node.names:
                if a.name.startswith("OCP."):
                    names.setdefault(a.name[4:], set())
res = {k: sorted(v) for k, v in sorted(names.items(), key=lambda kv: kv[0].lower())}
text = json.dumps(res, indent=1)
if out:
    out.write_text(text + "\n")
print(len(res), "modules,", sum(len(v) for v in res.values()), "names")
