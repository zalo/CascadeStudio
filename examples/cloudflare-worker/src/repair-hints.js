// repair-hints.js — targeted fix suggestions for build123d errors and
// validity-gate reasons, appended to failing execute/set_script results and
// served by the repair_hints tool.
//
// Adapted from build123d-mcp (github.com/pzfreo/build123d-mcp @59b2561,
// src/build123d_mcp/tools/repair_hints.py, Apache-2.0, Paul Fremantle and
// contributors; see third_party/build123d-mcp/LICENSE); modified for
// CascadeStudio: reworded for this server's tools and build123d-lite's
// error texts, the sandbox and mesh-gate hints dropped (neither exists
// here), lite-specific hints added.

const HINTS = [
  [[/B-rep is not well-formed/, /BRepCheck/, /fails BRepCheck/],
    'Gate failure: malformed B-rep. Run locate_gate_defects() for where, then rebuild that feature differently '
    + '(a smaller fillet, a boolean with real overlap instead of coincident faces). Re-check with validate().'],
  [[/\bopen edge/, /not watertight/, /open_edge/],
    'Gate failure: an open boundary — the shape is a shell or surface, not a closed solid. locate_gate_defects() '
    + 'gives the edge midpoints. Usual causes: a face or sketch shown instead of the solid made from it, or a '
    + 'loft/sweep that did not close; extrude/loft/sweep a closed profile, or show the solid.'],
  [[/non-manifold edge/, /nonmanifold_edge/, /faces meet >2-ways/, /coincident face/],
    'Gate failure: faces meet more than two to an edge — usually two bodies touching along an edge or face '
    + 'without being fused. Fuse them with + (with a little overlap), or move them apart and show them as '
    + 'separate objects.'],
  [[/interpenetrating/, /overlap/],
    'Overlapping solids inside one shape: its volume counts the overlap twice. Fuse them (a + b) into one '
    + 'solid, or show them as separate named objects if they are separate parts.'],
  [[/AttributeError.*'ShapeList'.*has no attribute/, /'ShapeList'.*has no attribute/],
    'A ShapeList is a list of shapes, not one shape. Take one with [0] / .first() / .last() after a sort_by, '
    + 'or fuse a list into one solid with Part() + a + b.'],
  [[/NoneType.*has no attribute/, /AttributeError.*None/],
    "The value is None. With a builder, read its result: `with BuildPart() as bp: ...` then `bp.part`. "
    + 'In algebra mode assign the result: result = Box(10, 10, 10) - Cylinder(3, 12).'],
  [[/None context requested/, /No context.*requested/, /no active builder/i],
    'An operation that needs a builder ran outside one. Either wrap it in `with BuildPart():` / '
    + '`with BuildSketch():`, or use the algebra form (shape = fillet(shape.edges()..., radius=1)).'],
  [[/cq\./, /Workplane/, /CadQuery/],
    'CadQuery syntax: build123d differs. Box(w, d, h) not cq.Workplane().box(w, d, h); '
    + 'Pos(x, y, z) * shape or shape.move(Location((x, y, z))) instead of .translate(); '
    + 'Rot(0, 0, 45) * shape instead of .rotate(); + / - / & instead of .union()/.cut()/.intersect().'],
  [[/TypeError.*Location/, /Location.*argument/],
    'Location takes tuples: Location((x, y, z)) or Location((x, y, z), (rx, ry, rz)); '
    + 'Pos(x, y, z) and Rot(rx, ry, rz) are the short forms.'],
  [[/BRep_API: command not done/, /StdFail_NotDone/, /BRepFilletAPI/, /[Ff]illet.*fail/, /ValueError.*edges.*fillet/],
    'The kernel could not build the feature. For fillet/chamfer: the radius must be smaller than the faces next '
    + 'to the edge allow (try half), and select only the edges meant — print(len(edges)) or use find_edges(...) '
    + 'first. For a boolean: make the tool overlap the body rather than share a face exactly.'],
  [[/NameError.*\b(Box|Cylinder|Sphere|Cone|Torus|BuildPart|BuildSketch|BuildLine|Align|Axis|Location|Plane|Vector|Pos|Rot|Compound|Fillet|Chamfer|extrude|loft|sweep|revolve|fillet|chamfer|show)\b/],
    'A build123d name is not defined: the script needs `from build123d import *` at the top '
    + '(the first execute adds it to an empty session; set_script must include it).'],
  [[/NameError/],
    'A name is not defined. Every execute re-runs the whole session script, so variables from earlier calls '
    + 'exist only if their code is still in it — check with get_script.'],
  [[/ImportError/, /No module named/, /can't import/],
    'Only build123d and a small standard library are available here: math, copy, typing, functools, '
    + 'itertools, operator, random, logging, os.path (path arithmetic only), plus small scipy shims. '
    + 'No numpy, no files, no network.'],
  [[/numpy/],
    'numpy is not available in this serverless build123d. Use lists, tuples and math; build123d itself '
    + 'takes plain (x, y, z) tuples.'],
  [[/NotImplementedError/, /not (available|supported) in build123d-lite/, /lite does not/],
    'This part of build123d is not in build123d-lite (the port this server runs). build123d://quickref '
    + 'lists what is; most gaps have a simpler equivalent there.'],
  [[/no shape was shown as/],
    'Name the object when showing it: show(part, "part"). Tools then take object_name="part".'],
  [[/Constraint failed/, /AssertionError/],
    'A dimension is impossible: a fillet larger than its face, a hole wider than its wall, a zero or negative '
    + 'size. Check the parameters at the top of the script.'],
  [[/empty.*[Ss]hape/, /[Ss]hape.*empty/, /degenerate/, /no.*solid/, /destroyed the main body/],
    'The result is empty or has no volume: the cutter probably misses the body or swallows it, or a profile '
    + 'was not closed. Check both shapes\' bounding boxes with measure() before the boolean, or '
    + 'compare(a, b, kind="fit").'],
  [[/exceeded.*(CPU|time)/i, /timed? ?out/i],
    'The run took too long. Usual causes: many booleans in a loop (fuse the tools first: '
    + 'body - [t1, t2, ...] is ONE cut), a very fine Helix/Spline, or an accidental huge pattern count.'],
  [[/\.part\b/],
    'With a BuildPart builder read `bp.part` to get the shape. In algebra mode there is no .part.'],
];

const FALLBACK = 'No specific hint matched. last_error() shows the failing line in context; then check: '
  + '(1) shapes exist (not None) before booleans, (2) `from build123d import *` is in the script, '
  + '(3) Location takes a tuple.';

/** Hints for an error or gate reason: [] when nothing specific matched
 *  (unless `fallback`). */
export function repairHints(text, fallback = false) {
  const t = String(text || '');
  const out = [];
  for (const [patterns, hint] of HINTS) {
    if (patterns.some((p) => p.test(t)) && !out.includes(hint)) { out.push(hint); }
  }
  if (!out.length && fallback) { out.push(FALLBACK); }
  return out;
}
