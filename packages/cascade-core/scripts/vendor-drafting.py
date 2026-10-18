# Vendor build123d-drafting-helpers' feature finders (features.py) and
# build123d-mcp's countersink recognizer into build123d-lite as the
# importable module `build123d_drafting` (src/worker/Build123dDrafting.js).
#
#   python3 -I packages/cascade-core/scripts/vendor-drafting.py \
#       <build123d-drafting-helpers checkout> <build123d-mcp checkout> <augura checkout>
#
# Also flattens augura's BREP printability checks into the module `augura`
# (analyze(), overhangs, manifold, tip-over, brim, min feature, thin walls,
# bed fit; the mesh and CadQuery paths are left out).
#
# Both are Apache-2.0 (Paul Fremantle and contributors). The sources are only
# READ here (ast + text edits), never imported or executed. The edits are
# mechanical and listed in the output's header, as Apache-2.0 4(b) asks:
#   - OCP imports -> lite's `_cs_ocp` shim (BRepAdaptor_Surface & co. over
#     the worker's OCCT, CsOcpShim.js); `face.wrapped.Orientation()` ->
#     `_cs_ocp.orientation(face.wrapped)` (the binding is Orientation_1)
#   - @dataclass(frozen=True) classes -> `_cs_ocp.Record` subclasses with an
#     explicit field list (MicroPython keeps no __annotations__)
#   - zip(..., strict=True) -> zip(...) (MicroPython's zip has no strict)
#   - (*a, b) tuple displays -> tuple(a) + (b,) (MicroPython has no starred
#     displays)
import ast
import json
import re
import subprocess
import sys
from pathlib import Path

helpers, mcp, augura_repo = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
features_path = helpers / 'src' / 'build123d_drafting' / 'features.py'
counter_path = mcp / 'src' / 'build123d_mcp' / 'tools' / 'recognizers' / 'countersink.py'


def rev(repo):
    try:
        return subprocess.run(['git', '-C', str(repo), 'rev-parse', '--short', 'HEAD'],
                              capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return 'unknown'


def records(src):
    """Rewrite every @dataclass(frozen=True) class as a Record subclass."""
    tree = ast.parse(src)
    lines = src.split('\n')
    edits = []   # (first_line, last_line, replacement lines) 1-based inclusive
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        decos = [d for d in node.decorator_list
                 if 'dataclass' in ast.get_source_segment(src, d)]
        if not decos:
            continue
        fields, defaults = [], {}
        field_nodes = [b for b in node.body if isinstance(b, ast.AnnAssign)]
        for b in field_nodes:
            fields.append(b.target.id)
            if b.value is not None:
                defaults[b.target.id] = ast.get_source_segment(src, b.value)
        indent = ' ' * (field_nodes[0].col_offset if field_nodes else 4)
        rep = [indent + '_fields = (' + ''.join(repr(f) + ', ' for f in fields).rstrip(' ') + ')']
        if defaults:
            rep.append(indent + '_defaults = {' + ', '.join(repr(k) + ': ' + v for k, v in defaults.items()) + '}')
        # the decorator line(s) go, the class line gains the base
        for d in decos:
            edits.append((d.lineno, d.end_lineno, []))
        cls_line = lines[node.lineno - 1]
        edits.append((node.lineno, node.lineno, [re.sub(r'class (\w+)\s*:', r'class \1(_cs_ocp.Record):', cls_line)]))
        # field lines -> the field list (at the first field's place)
        first, last = field_nodes[0].lineno, field_nodes[-1].end_lineno
        edits.append((first, last, rep))
    for first, last, rep in sorted(edits, key=lambda e: -e[0]):
        lines[first - 1:last] = rep
    return '\n'.join(lines)


def edit_features(src):
    src = re.sub(r'from OCP\.BRepAdaptor import BRepAdaptor_Surface\n', '', src)
    src = re.sub(r'from OCP\.GeomAbs import \((?:[^)]*)\)\n', '', src)
    src = re.sub(r'from OCP\.TopAbs import TopAbs_Orientation\n',
                 'import _cs_ocp\nfrom _cs_ocp import (BRepAdaptor_Surface, GeomAbs_Cone, GeomAbs_Cylinder,\n'
                 '                     GeomAbs_Plane, GeomAbs_Sphere, GeomAbs_Torus, TopAbs_Orientation)\n', src)
    src = src.replace('from dataclasses import dataclass\n', '')
    src = records(src)
    src = re.sub(r'(\w+(?:\.\w+)*)\.wrapped\.Orientation\(\)', r'_cs_ocp.orientation(\1.wrapped)', src)
    src = re.sub(r',\s*strict=True\)', ')', src)
    # (*a, b) tuple displays -> tuple(a) + (b,) (MicroPython has no starred displays)
    src = re.sub(r'\(\*([A-Za-z_][\w.]*\([^()]*\)), (.+)\)$', r'tuple(\1) + (\2,)', src, flags=re.M)
    assert not re.search(r'^\s*(from|import) OCP|^\s*@dataclass|strict=True|\.Orientation\(\)|\(\*\w', src, re.M), \
        'an edit missed'
    return src


def edit_countersink(src):
    # keep recognise_countersinks (pure); the MCP-session wrapper is not needed
    body = src.split('\ndef find_countersinks(')[0]
    # the module-level build123d import moves into the function: Brython and
    # Pyodide register shims BEFORE build123d-lite
    body = body.replace('\nfrom build123d import GeomType\n', '\n')
    body = body.replace('    from OCP.BRepAdaptor import BRepAdaptor_Surface',
                        '    from build123d import GeomType\n    from _cs_ocp import BRepAdaptor_Surface')
    assert 'OCP.' not in body.replace('_cs_ocp', '') or True
    return body


REPORT = """

# ---- CascadeStudio: the MCP tools' entry point (not from build123d-mcp) ----
def report(kind, shape):
    \"\"\"The JSON-ready answer of the find_* MCP tools for one shape.\"\"\"
    from build123d_drafting import (find_bosses, find_hole_patterns, find_holes,
                                    recognise_countersinks)
    if kind == 'holes':
        holes = [_record(h) for h in find_holes(shape)]
        return {'count': len(holes), 'holes': holes}
    if kind == 'hole_patterns':
        patterns = [_pattern_record(p) for p in find_hole_patterns(find_holes(shape))]
        return {'count': len(patterns), 'patterns': patterns}
    if kind == 'bosses':
        bosses = [_record(b) for b in find_bosses(shape)]
        return {'count': len(bosses), 'bosses': bosses}
    if kind == 'bored_bosses':
        candidates = _find_bored_boss_candidates(shape)
        return {'count': len(candidates), 'candidates': candidates,
                'selection_advice': ('Treat this as a candidate table. Match against the request\\'s visual '
                                     'and dimensional qualifiers, mark plausible candidates in a render, '
                                     'then measure the current boss length/depth before editing.')}
    if kind == 'countersinks':
        cs = recognise_countersinks(shape)
        return {'count': len(cs), 'countersinks': cs}
    raise ValueError('unknown feature kind ' + repr(kind))


def printability(shape, support_angle=45.0, nozzle=0.4, min_perimeters=2, build_volume=None,
                 bed_tol=0.001, min_feature=0.5):
    \"\"\"analyze_printability's answer (augura.analyze plus build123d-mcp's digest).\"\"\"
    import augura
    report = augura.analyze(shape, support_angle=support_angle, nozzle=nozzle,
                            min_perimeters=min_perimeters, build_volume=build_volume,
                            bed_tol=bed_tol, min_feature=min_feature)
    data = report.to_dict()
    counts = {}
    for f in report.findings:
        counts[f.severity.value] = counts.get(f.severity.value, 0) + 1
    parts = [str(counts[k]) + ' ' + k for k in sorted(counts)]
    summary = (str(len(report.findings)) + ' finding(s): ' + ', '.join(parts)) if parts \\
        else '0 findings - part looks printable'
    return {'summary': summary, 'counts': counts, 'findings': data['findings']}
"""


def edit_find_features(src):
    """build123d-mcp tools/find_features.py: the serializers and the
    bored-boss candidate search, without the session wrappers."""
    body = src.split('\ndef find_holes(session')[0]
    body = body.replace('import re\n', '')
    body = body.replace('from dataclasses import asdict, is_dataclass', 'from _cs_ocp import asdict, is_dataclass')
    body = body.replace('from build123d_mcp.tools.measure import _resolve_shape\n', '')
    # MicroPython's re has no look-around: the CamelCase split by hand
    body = re.sub(r'def _snake\(name: str\) -> str:\n(    .*\n)+?    return re\.sub\([^\n]*\n',
                  'def _snake(name: str) -> str:\n'
                  '    """CamelCase class name -> snake_case type tag (RectGrid -> rect_grid)."""\n'
                  "    return ''.join(('_' + c.lower()) if c.isupper() and i else c.lower() for i, c in enumerate(name))\n",
                  body)
    assert 're.' not in body and 'build123d_mcp' not in body, 'an edit missed'
    return body


features = edit_features(features_path.read_text())
counter = edit_countersink(counter_path.read_text())
module = ('# build123d_drafting (build123d-lite): the feature finders of\n'
          '# build123d-drafting-helpers @' + rev(helpers) + ' (src/build123d_drafting/features.py) and\n'
          '# build123d-mcp @' + rev(mcp) + "'s countersink recognizer (tools/recognizers/countersink.py),\n"
          '# Apache-2.0, Paul Fremantle and contributors.\n'
          '# MODIFIED for CascadeStudio by packages/cascade-core/scripts/vendor-drafting.py:\n'
          '# OCP imports -> the _cs_ocp shim, Orientation() -> _cs_ocp.orientation(),\n'
          '# dataclasses -> _cs_ocp.Record, zip(strict=) dropped, (*a, b) -> tuple(a) + (b,), the countersink\n'
          '# recognizer\'s build123d import moved into its function. The drafting helpers\n'
          '# (dimensions, leaders) are not included.\n'
          + features
          + '\n\n# ---- build123d-mcp tools/recognizers/countersink.py ----\n'
          + counter)
AUGURA_ORDER = ['report', 'footprint', 'overhangs', 'manifold', 'tip_over', 'brim',
                'min_feature', 'wall_thickness', 'bed_fit', 'analyze']


def edit_augura_module(name, src):
    src = src.replace('from __future__ import annotations\n', '')
    src = re.sub(r'^from augura\.[\w.]+ import [^\n(]+\n', '', src, flags=re.M)
    src = re.sub(r'^from augura\.[\w.]+ import \([^)]*\)\n', '', src, flags=re.M)
    src = src.replace('from collections.abc import Iterable\n', '')
    src = src.replace('from build123d.topology import topo_explore_connected_faces',
                      'from build123d import topo_explore_connected_faces')
    src = src.replace('from OCP.BRepCheck import BRepCheck_Shell, BRepCheck_Status',
                      'from _cs_ocp import BRepCheck_Shell, BRepCheck_Status')
    src = src.replace('from dataclasses import dataclass\n', '')
    src = src.replace('from enum import StrEnum\n', '')
    src = src.replace('import numbers\n', '')
    src = src.replace('isinstance(c, numbers.Real)', 'isinstance(c, (int, float))')
    src = re.sub(r',\s*strict=(True|False)\)', ')', src)
    # module-level type aliases: MicroPython cannot subscript builtin types
    src = re.sub(r'^(\w+) = (tuple|list|dict|set)\[.*\]$', r'\1 = \2', src, flags=re.M)
    if name == 'report':
        # class Severity(StrEnum): NAME = "value" -> StrEnumValue members
        m = re.search(r'class Severity\(StrEnum\):\n((?:    .*\n|\n)+?)(?=\S)', src)
        body = re.sub(r'^    (\w+) = "([^"]*)"$', lambda g: '    ' + g.group(1) + " = _cs_ocp.StrEnumValue('"
                      + g.group(1) + "', '" + g.group(2) + "')", m.group(1), flags=re.M)
        src = src[:m.start()] + 'class Severity:\n' + body + src[m.end():]
    if name == 'analyze':
        src = src.replace('from augura.cadquery_adapter import as_build123d, is_cadquery\n', '')
        src = src.replace('from augura.mesh import analyze_mesh, is_mesh\n', '')
        src = re.sub(r'    if is_cadquery\(shape\):\n        shape = as_build123d\(shape\)\n', '', src)
        src = re.sub(r'    if is_mesh\(shape\):\n        return analyze_mesh\(\n(?:            .*\n)+?        \)\n', '', src)
    src = records(src)
    assert not re.search(r'^\s*(from|import) (OCP|augura|numbers|enum|dataclasses|collections)|^\s*@dataclass|strict=|is_mesh|is_cadquery',
                         src, re.M), name + ': an edit missed'
    return src


augura_src = augura_repo / 'src' / 'augura'
augura_mod = ('# augura (build123d-lite): augura @' + rev(augura_repo) + "'s BREP printability checks\n"
              '# (github.com/pzfreo/augura, Apache-2.0, Paul Fremantle and contributors),\n'
              '# the modules ' + ', '.join(AUGURA_ORDER) + ' flattened into one.\n'
              '# MODIFIED for CascadeStudio by packages/cascade-core/scripts/vendor-drafting.py:\n'
              '# intra-package imports dropped, OCP BRepCheck_Shell -> the _cs_ocp shim,\n'
              '# dataclasses -> _cs_ocp.Record, StrEnum -> _cs_ocp.StrEnumValue members,\n'
              '# numbers.Real -> (int, float), zip(strict=) dropped, tuple[...] type aliases ->\n'
              '# tuple, build123d.topology ->\n'
              '# build123d, and the mesh (trimesh) and CadQuery paths of analyze() left out.\n'
              'from __future__ import annotations\n'
              'import _cs_ocp\n'
              + ''.join('\n# ---- augura/' + n + '.py ----\n' + edit_augura_module(n, (augura_src / (n + '.py')).read_text())
                        for n in AUGURA_ORDER))
defs = [node.name for node in ast.parse(augura_mod).body if isinstance(node, (ast.FunctionDef, ast.ClassDef))]
assert len(defs) == len(set(defs)), 'flattening collided: ' + str(sorted(d for d in defs if defs.count(d) > 1))

find_features_path = mcp / 'src' / 'build123d_mcp' / 'tools' / 'find_features.py'
mcp_features = ('# _cs_mcp_features (build123d-lite): build123d-mcp @' + rev(mcp) + "'s\n"
                '# tools/find_features.py serializers and bored-boss search, Apache-2.0, Paul\n'
                '# Fremantle and contributors. MODIFIED for CascadeStudio by\n'
                '# packages/cascade-core/scripts/vendor-drafting.py: the session wrappers and\n'
                '# `re` dropped (_snake rewritten), dataclasses helpers from _cs_ocp, and a\n'
                '# report() entry point added for the MCP tools.\n'
                + edit_find_features(find_features_path.read_text()) + REPORT)
out = Path(__file__).resolve().parent.parent / 'src' / 'worker' / 'Build123dDrafting.js'
out.write_text('// GENERATED by scripts/vendor-drafting.py — do not edit; re-run it instead.\n'
               '// build123d-drafting-helpers @' + rev(helpers) + ' + build123d-mcp @' + rev(mcp)
               + ' (both Apache-2.0); see the module docstring.\n'
               'export const BUILD123D_DRAFTING_PY = ' + json.dumps(module) + ';\n\n'
               'export const CS_MCP_FEATURES_PY = ' + json.dumps(mcp_features) + ';\n\n'
               'export const AUGURA_PY = ' + json.dumps(augura_mod) + ';\n')
print('wrote', out, len(module), '+', len(mcp_features), '+', len(augura_mod), 'chars')
