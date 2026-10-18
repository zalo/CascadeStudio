# Regenerate the build123d-mcp text resources this Worker serves:
#   src/knowledge.js       build123d://quickref, build123d://selectors
#   src/skills-upstream.js build123d://skill/modeling, build123d://skill/edit
#
#   python3 -I examples/cloudflare-worker/scripts/vendor-build123d-mcp-text.py <build123d-mcp checkout>
#
# build123d-mcp is Apache-2.0 (Paul Fremantle and contributors); its Python
# modules are read as DATA here (ast.literal_eval of the Section(...) texts),
# never imported or executed. The edits are listed in each output's header.
import ast
import json
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1])
pkg = repo / 'src' / 'build123d_mcp'
here = Path(__file__).resolve().parent.parent
rev = subprocess.run(['git', '-C', str(repo), 'rev-parse', '--short', 'HEAD'],
                     capture_output=True, text=True).stdout.strip() or 'unknown'


def sections(mod):
    tree = ast.parse((pkg / (mod + '.py')).read_text())
    out = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == 'Section':
            entry = {'text': None, 'label': None}
            for i, a in enumerate(node.args[:2]):
                entry[['text', 'label'][i]] = ast.literal_eval(a)
            for kw in node.keywords:
                if kw.arg in ('text', 'label'):
                    entry[kw.arg] = ast.literal_eval(kw.value)
            out.append(entry)
    return out


def adapt_quickref(secs):
    res = []
    for s in secs:
        t, label = s['text'], s['label']
        if t.startswith('BUILD123D QUICK REFERENCE'):
            t = ('BUILD123D QUICK REFERENCE (build123d-lite on this server) — all measurements in mm\n'
                 '====================================================================================')
        if t.startswith('## New in build123d 0.11'):
            t = ('## New in build123d 0.11\n'
                 'build123d-lite on this server has these (it is validated against build123d 0.11.1).')
        for head in ('## ConvexPolyhedron', '## BSpline', '## ConstrainedArcs'):
            if t.startswith(head):
                t = t.replace(' (0.11+)', '')
        if t.startswith('## Also new in 0.11'):
            t = ("## Also in 0.11 (see build123d's docs/CHANGELOG for details)\n"
                 '- ParabolicCenterArc / HyperbolicCenterArc — conic-section arcs.\n'
                 '- Broader, more robust intersection support (the `&` operator) across 1D/2D/3D and\n'
                 '  composite shapes.\n'
                 '- Not here: single-line (engraving) fonts — this server bundles only the FreeSans\n'
                 '  outline font.')
        if t.startswith('## MCP server conventions'):
            t = ('## Server conventions (this MCP server)\n'
                 '- ONE script per session: execute appends code and re-runs the whole script (unchanged\n'
                 '  operations are cached); set_script replaces it; get_script shows it with line numbers.\n'
                 '- The scene is what show() registers. show(part, "part") names it — tools take the name\n'
                 "  as object_name (or the shape's index). A name shown again replaces its shape; a named\n"
                 '  list shows its members as name[0], name[1], ... Unnamed show(a, b) shows both.\n'
                 '- No show() at all: a top-level `result` is shown as "result"; otherwise every shape the\n'
                 '  script made is shown, sketches included.\n'
                 '- named_face(shape, "top") returns the highest-Z face; also bottom/front/back/left/right\n'
                 "  (front = the -Y face, like build123d's Plane.FRONT and the front render view).\n"
                 '- find_edges(shape, geom="circle", radius=4.25, at_z=10.2) filters edges for fillet/chamfer;\n'
                 '  prints count + radii + Z levels.\n'
                 '- from build123d_drafting import find_holes, find_bosses, find_hole_patterns and\n'
                 '  import augura (printability) work inside scripts too.\n'
                 "- After a change, execute reports each shown shape's volume / face-count / bbox deltas\n"
                 '  and warns when a boolean changed nothing.')
        if t.startswith('## Common gotchas'):
            t = t.replace('- After every -, +, & : call measure() and check topology.faces — a failed boolean leaves counts unchanged',
                          "- After every -, +, & : read execute's change line (or measure()) — a failed boolean leaves the counts unchanged")
            t += ('\n- Not available here: numpy and other packages, the drafting module (Draft, DimensionLine,\n'
                  '  TechnicalDrawing), 3MF, import_svg/import_stl, files (open()). Files come from export.')
        res.append({'label': label, 'text': t})
    return res


def adapt_selectors(secs):
    res = []
    for s in secs:
        t, label = s['text'], s['label']
        if t.startswith('## Common pitfalls'):
            seen = []
            for ln in t.split('\n'):
                if seen and ln.startswith('# 4.') and any(x.startswith('# 4.') for x in seen):
                    break
                seen.append(ln)
            t = '\n'.join(seen).rstrip()
            while t.endswith('#'):
                t = t[:-1].rstrip()
        res.append({'label': label, 'text': t})
    return res


q = adapt_quickref(sections('quickref'))
c = adapt_selectors(sections('selectors_cookbook'))
js = ('// knowledge.js — GENERATED by scripts/vendor-build123d-mcp-text.py; re-run it, do not edit.\n'
      '// The build123d reference resources this MCP server serves (build123d://quickref,\n'
      '// build123d://selectors).\n//\n'
      '// Adapted from build123d-mcp (github.com/pzfreo/build123d-mcp @' + rev + ',\n'
      '// src/build123d_mcp/quickref.py and selectors_cookbook.py, Apache-2.0,\n'
      '// Paul Fremantle and contributors; see third_party/build123d-mcp/LICENSE);\n'
      "// modified for CascadeStudio: build123d-lite's coverage, this server's\n"
      '// conventions (session script, named show(), the `result` fallback), the\n'
      '// version banners dropped, one duplicated pitfall removed. Sections with\n'
      '// a label are runnable: scripts/mcp-test.mjs runs every one of them\n'
      '// through the server and fails on an error.\n')
js += '\n/** @type {{label: string|null, text: string}[]} */\n'
js += 'export const QUICKREF_SECTIONS = ' + json.dumps(q, indent=1, ensure_ascii=False) + ';\n\n'
js += '/** @type {{label: string|null, text: string}[]} */\n'
js += 'export const SELECTORS_SECTIONS = ' + json.dumps(c, indent=1, ensure_ascii=False) + ';\n\n'
js += '''const join = (sections) => sections.map((s) => s.text).join('\\n\\n');
export const QUICKREF = join(QUICKREF_SECTIONS);
export const SELECTORS = 'Examples below run on build123d-lite, this server\\'s port of build123d.\\n\\n'
  + join(SELECTORS_SECTIONS);

/** [label, code] for every runnable section (the tests run them all). */
export const RUNNABLE_EXAMPLES = QUICKREF_SECTIONS.concat(SELECTORS_SECTIONS)
  .filter((s) => s.label).map((s) => [s.label, s.text]);
'''
(here / 'src' / 'knowledge.js').write_text(js)

NOTE = ('> **On this server** (CascadeStudio build123d sessions; this text is build123d-mcp\'s, '
        'Apache-2.0, served unmodified below this note): build123d here is build123d-lite, a port, '
        'in ONE session script that every call re-runs (`execute` appends, `set_script` replaces). '
        'Name objects with `show(obj, "name")`. Tools that do not exist here: '
        '{missing}. `script()` is `get_script`. OCP imports do not work in scripts. '
        'Everything else named below exists with the same arguments.\n\n')
skills = {}
for key, missing in (('modeling', '`execute_file`, `repair_advice`, `bank_candidate`'),
                     ('edit', '`repair_advice`, `bank_candidate`, `recognise_features`, `interface_features`, `edit_feature`')):
    text = (pkg / 'skills' / ('b123d-' + key) / 'SKILL.md').read_text()
    skills[key] = NOTE.replace('{missing}', missing) + text
sj = ('// skills-upstream.js — GENERATED by scripts/vendor-build123d-mcp-text.py; re-run it, do not edit.\n'
      '// build123d-mcp @' + rev + "'s skills b123d-modeling and b123d-edit (src/build123d_mcp/skills/),\n"
      '// Apache-2.0, Paul Fremantle and contributors; served as build123d://skill/modeling and\n'
      '// build123d://skill/edit with a prepended note on what differs on this server (the only change).\n'
      'export const UPSTREAM_SKILLS = ' + json.dumps(skills, indent=1, ensure_ascii=False) + ';\n')
(here / 'src' / 'skills-upstream.js').write_text(sj)
print('knowledge.js:', len(q), 'quickref +', len(c), 'selectors sections; skills:', ', '.join(skills))
