# Port build123d's drafting module (Draft, Arrow, DimensionLine,
# ExtensionLine, TechnicalDrawing) into build123d-lite:
# src/worker/Build123dDraftingPort.js, appended to BUILD123D_LITE_PY, so the
# classes live in lite's own namespace like every other ported object.
#
#   python3 -I packages/cascade-core/scripts/port-drafting.py \
#       ~/Desktop/ocjs-deps/src/build123d-v0.13.0/src/build123d/drafting.py
#
# build123d is Apache-2.0 (Gumyr and contributors). The source is read as
# text and edited through ast source ranges; nothing is imported. The edits
# (also listed in the output's header):
#   - the import block goes (the code runs in lite's namespace); math names
#     and a `date` shim stay available
#   - ArrowHead/HeadType are not ported (lite has its own, already validated)
#   - every annotation in a def signature and every cast(T, x) -> x:
#     MicroPython/Brython evaluate `X | None` at runtime and fail
#   - @dataclass Draft -> an explicit __init__ calling __post_init__;
#     ClassVar / TypeAlias declarations -> plain assignments or dropped
#   - isinstance(x, Iterable) -> _cs_iterable(x), f.is_integer() ->
#     _cs_is_integer(f) (MicroPython floats have no is_integer)
import ast
import json
import re
import sys
from pathlib import Path

src_path = Path(sys.argv[1])
src = src_path.read_text()
tree = ast.parse(src)
lines = src.split('\n')
starts = [0]
for ln in lines:
    starts.append(starts[-1] + len(ln) + 1)


def off(lineno, col):
    return starts[lineno - 1] + len(lines[lineno - 1][:col].encode('utf-8').decode('utf-8'))


edits = []   # (start, end, replacement) on character offsets


def drop(node, repl=''):
    edits.append((off(node.lineno, node.col_offset), off(node.end_lineno, node.end_col_offset), repl))


def drop_decorator(node):
    # the decorator expression starts after its '@'
    s0 = off(node.lineno, node.col_offset)
    edits.append((src.rfind('@', 0, s0), off(node.end_lineno, node.end_col_offset), ''))


# 1. top-level imports and the alias declarations
first_class = None
for node in tree.body:
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        drop(node)
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        # PathDescriptor: TypeAlias = ... (annotation only, not needed at runtime)
        drop(node)
    if isinstance(node, ast.ClassDef) and node.name in ('ArrowHead',):
        drop(node)
        for d in node.decorator_list:
            drop_decorator(d)

# 2. annotations in def signatures, cast() calls
for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        a = node.args
        for arg in a.posonlyargs + a.args + a.kwonlyargs + ([a.vararg] if a.vararg else []) + ([a.kwarg] if a.kwarg else []):
            if arg.annotation is not None:
                s0 = off(arg.lineno, arg.col_offset) + len(arg.arg)
                edits.append((s0, off(arg.annotation.end_lineno, arg.annotation.end_col_offset), ''))
        if node.returns is not None:
            r0 = off(node.returns.lineno, node.returns.col_offset)
            arrow = src.rfind('->', 0, r0)
            edits.append((arrow, off(node.returns.end_lineno, node.returns.end_col_offset), ''))
    if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == 'cast' and len(node.args) == 2:
        inner = ast.get_source_segment(src, node.args[1])
        edits.append((off(node.lineno, node.col_offset), off(node.end_lineno, node.end_col_offset), '(' + inner + ')'))

# 3. the Draft dataclass: fields -> an explicit __init__
draft = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Draft')
for d in draft.decorator_list:
    drop_decorator(d)
fields = []
for b in draft.body:
    if isinstance(b, ast.AnnAssign):
        ann = ast.get_source_segment(src, b.annotation)
        if ann.startswith('ClassVar'):
            edits.append((off(b.lineno, b.col_offset), off(b.end_lineno, b.end_col_offset),
                          b.target.id + ' = ' + ast.get_source_segment(src, b.value)))
            continue
        fields.append((b.target.id, ast.get_source_segment(src, b.value)))
        drop(b)
init = ('def __init__(self, ' + ', '.join(n + '=' + v for n, v in fields) + '):\n'
        + ''.join('        self.' + n + ' = ' + n + '\n' for n, _ in fields)
        + '        self.__post_init__()\n\n'
        + '    def __repr__(self):\n'
        + "        return 'Draft(' + ', '.join(k + '=' + repr(getattr(self, k)) for k in ("
        + ', '.join(repr(n) for n, _ in fields) + ")) + ')'\n\n    ")
first_method = next(b for b in draft.body if isinstance(b, ast.FunctionDef) or
                    (isinstance(b, ast.FunctionDef)) or isinstance(b, ast.AsyncFunctionDef) or
                    (hasattr(b, 'decorator_list') and b.decorator_list))
anchor = first_method.decorator_list[0] if getattr(first_method, 'decorator_list', None) else first_method
at = off(anchor.lineno, anchor.col_offset)
if anchor is not first_method:
    at = src.rfind('@', 0, at)   # before the decorator's '@'
edits.append((at, at, init))

# edits inside a dropped class are moot
dropped = [(off(n.lineno, n.col_offset), off(n.end_lineno, n.end_col_offset))
           for n in tree.body if isinstance(n, ast.ClassDef) and n.name in ('ArrowHead',)]
edits = [e for e in edits if not any(a <= e[0] and e[1] <= b and (e[0], e[1]) != (a, b) for a, b in dropped)]
# apply edits, last first
edits.sort(key=lambda e: e[0], reverse=True)
out = src
last = None
for s0, e0, rep in edits:
    if last is not None and e0 > last:
        raise SystemExit('overlapping edits at %d' % s0)
    out = out[:s0] + rep + out[e0:]
    last = s0

out = re.sub(r'isinstance\((\w+), Iterable\)', r'_cs_iterable(\1)', out)
out = re.sub(r'(log2\([^()]*\))\.is_integer\(\)', r'_cs_is_integer(\1)', out)
out = re.sub(r'\n{3,}', '\n\n\n', out)
for bad in (r'^\s*(from|import) ', r'\bcast\(', r'Iterable\)', r'\.is_integer\(', r'@dataclass', r'TypeAlias'):
    m = re.search(bad, out, re.M)
    assert not m, 'an edit missed: ' + bad + ' at ' + out[max(0, m.start() - 80):m.start() + 80]

header = ('\n\n# ---------------------------------------------------------------------------\n'
          '# drafting — build123d ' + src_path.parent.parent.parent.name + "'s src/build123d/drafting.py\n"
          '# (Apache-2.0, Gumyr and contributors), PORTED by scripts/port-drafting.py:\n'
          '# imports dropped (lite namespace), ArrowHead kept from lite, signature\n'
          '# annotations and cast() removed, the Draft dataclass given an explicit\n'
          '# __init__, Iterable / float.is_integer checks through _cs_ helpers.\n'
          '# ---------------------------------------------------------------------------\n'
          'from math import copysign, floor, gcd, log2, pi, radians, sin\n\n\n'
          'def _cs_iterable(x):\n'
          '    # a point sequence; lite shapes iterate (upstream Edge/Wire do not)\n'
          '    if isinstance(x, (str, bytes, Shape)):\n'
          '        return False\n'
          '    try:\n'
          '        iter(x)\n'
          '        return True\n'
          '    except TypeError:\n'
          '        return False\n\n\n'
          'def _cs_is_integer(f):\n'
          '    return float(f) == float(int(f))\n\n\n'
          'class date:\n'
          '    """datetime.date as drafting uses it (today(), isoformat(), str()):\n'
          '    MicroPython has no datetime; the worker\'s JS Date answers."""\n\n'
          '    def __init__(self, year, month, day):\n'
          '        self.year, self.month, self.day = int(year), int(month), int(day)\n\n'
          '    @classmethod\n'
          '    def today(cls):\n'
          '        d = w.Date.new()\n'
          '        return cls(d.getFullYear(), int(d.getMonth()) + 1, d.getDate())\n\n'
          '    def isoformat(self):\n'
          "        return '%04d-%02d-%02d' % (self.year, self.month, self.day)\n\n"
          '    __str__ = isoformat\n\n'
          '    def __repr__(self):\n'
          "        return 'date(%d, %d, %d)' % (self.year, self.month, self.day)\n\n\n")
body = out.split('"""', 2)
# the module docstring carries build123d's licence notice: kept, as comments
notice = '\n'.join('# ' + ln if ln.strip() else '#' for ln in body[1].strip('\n').split('\n')) + '\n\n'
module = header + notice + (body[2] if out.lstrip().startswith('"""') else out).lstrip('\n')
dest = Path(__file__).resolve().parent.parent / 'src' / 'worker' / 'Build123dDraftingPort.js'
dest.write_text('// GENERATED by scripts/port-drafting.py from build123d\'s drafting.py — do not edit.\n'
                '// Appended to BUILD123D_LITE_PY (Build123dLite.js); see the header inside.\n'
                'export const DRAFTING_PY = ' + json.dumps(module) + ';\n')
print('wrote', dest, len(module), 'chars,', len(fields), 'Draft fields')
