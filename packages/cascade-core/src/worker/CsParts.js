// CsParts.js — the part library: parametric standard parts as build123d
// scripts in build123d-mcp's part-file format (a PART_INFO dict plus
// make(**params) returning the shape), served by the MCP tools
// search_library / load_part and importable in scripts as `cs_parts`
// (cs_parts.load("hex_nut", size="M4")). Dimensions are the nominal values of
// the cited standards; threads are not modelled (a threaded hole is its
// nominal diameter). No backticks or dollar-brace inside the sources: they
// are template strings.

export const PARTS = {
  hex_nut: `PART_INFO = {
    "category": "fasteners",
    "description": "ISO 4032 hex nut (no thread): across-flats, height and a chamfer on both faces",
    "tags": ["nut", "hex", "metric", "fastener", "iso4032"],
    "parameters": {
        "size": {"type": "str", "default": "M3", "description": "metric size, M2..M24"},
    },
}
from build123d import *
import math

ISO4032 = {"M2": (4.0, 1.6), "M2.5": (5.0, 2.0), "M3": (5.5, 2.4), "M4": (7.0, 3.2), "M5": (8.0, 4.7),
           "M6": (10.0, 5.2), "M8": (13.0, 6.8), "M10": (16.0, 8.4), "M12": (18.0, 10.8),
           "M16": (24.0, 14.8), "M20": (30.0, 18.0), "M24": (36.0, 21.5)}


def make(size="M3"):
    if size not in ISO4032:
        raise ValueError("hex_nut: size must be one of " + ", ".join(ISO4032))
    s, m = ISO4032[size]
    d = float(size[1:])
    nut = extrude(RegularPolygon(s / 2, 6, major_radius=False), m)
    # ISO 30 deg chamfer: a cone from the bearing-face circle (0.95 s) widening
    # at 30 deg to the face, from both faces
    r0 = 0.475 * s
    r_big = s / 2 / math.cos(math.radians(30)) * 1.05
    hc = (r_big - r0) * math.tan(math.radians(30))
    tool = Cone(r0, r_big, hc, align=(Align.CENTER, Align.CENTER, Align.MIN)) \\
        + Pos(0, 0, hc) * Cylinder(r_big, m * 2, align=(Align.CENTER, Align.CENTER, Align.MIN))
    nut = nut & tool & (Pos(0, 0, m) * Rot(180, 0, 0) * tool)
    return nut - Cylinder(d / 2, m * 3)
`,
  hex_bolt: `PART_INFO = {
    "category": "fasteners",
    "description": "ISO 4017 hex head bolt (fully threaded, thread not modelled): head across-flats and height, shank",
    "tags": ["bolt", "screw", "hex", "metric", "fastener", "iso4017"],
    "parameters": {
        "size": {"type": "str", "default": "M5", "description": "metric size, M3..M24"},
        "length": {"type": "float", "default": 20.0, "description": "shank length under the head, mm"},
    },
}
from build123d import *

ISO4017 = {"M3": (5.5, 2.0), "M4": (7.0, 2.8), "M5": (8.0, 3.5), "M6": (10.0, 4.0), "M8": (13.0, 5.3),
           "M10": (16.0, 6.4), "M12": (18.0, 7.5), "M16": (24.0, 10.0), "M20": (30.0, 12.5), "M24": (36.0, 15.0)}


def make(size="M5", length=20.0):
    if size not in ISO4017:
        raise ValueError("hex_bolt: size must be one of " + ", ".join(ISO4017))
    s, k = ISO4017[size]
    d = float(size[1:])
    head = Pos(0, 0, length) * extrude(RegularPolygon(s / 2, 6, major_radius=False), k)
    shank = Cylinder(d / 2, length, align=(Align.CENTER, Align.CENTER, Align.MIN))
    shank = chamfer(shank.edges().group_by(Axis.Z)[0], length=d * 0.1)
    return head + shank
`,
  socket_head_cap_screw: `PART_INFO = {
    "category": "fasteners",
    "description": "ISO 4762 socket head cap screw (thread not modelled): round head with a hex socket",
    "tags": ["screw", "socket", "cap screw", "allen", "metric", "fastener", "iso4762", "shcs"],
    "parameters": {
        "size": {"type": "str", "default": "M3", "description": "metric size, M2..M20"},
        "length": {"type": "float", "default": 12.0, "description": "shank length under the head, mm"},
    },
}
from build123d import *

ISO4762 = {"M2": (3.8, 2.0, 1.5, 1.0), "M2.5": (4.5, 2.5, 2.0, 1.1), "M3": (5.5, 3.0, 2.5, 1.3),
           "M4": (7.0, 4.0, 3.0, 2.0), "M5": (8.5, 5.0, 4.0, 2.5), "M6": (10.0, 6.0, 5.0, 3.0),
           "M8": (13.0, 8.0, 6.0, 4.0), "M10": (16.0, 10.0, 8.0, 5.0), "M12": (18.0, 12.0, 10.0, 6.0),
           "M16": (24.0, 16.0, 14.0, 8.0), "M20": (30.0, 20.0, 17.0, 10.0)}


def make(size="M3", length=12.0):
    if size not in ISO4762:
        raise ValueError("socket_head_cap_screw: size must be one of " + ", ".join(ISO4762))
    dk, k, s, t = ISO4762[size]
    d = float(size[1:])
    head = Cylinder(dk / 2, k, align=(Align.CENTER, Align.CENTER, Align.MIN))
    head = fillet(head.edges().group_by(Axis.Z)[-1], radius=dk * 0.08)
    socket = Pos(0, 0, k - t) * extrude(RegularPolygon(s / 2, 6, major_radius=False), t + 1)
    head = Pos(0, 0, length) * (head - socket)
    shank = Cylinder(d / 2, length, align=(Align.CENTER, Align.CENTER, Align.MIN))
    return head + shank
`,
  washer: `PART_INFO = {
    "category": "fasteners",
    "description": "ISO 7089 plain washer: inner and outer diameter, thickness",
    "tags": ["washer", "metric", "fastener", "iso7089"],
    "parameters": {
        "size": {"type": "str", "default": "M3", "description": "metric size, M2..M24"},
    },
}
from build123d import *

ISO7089 = {"M2": (2.2, 5.0, 0.3), "M2.5": (2.7, 6.0, 0.5), "M3": (3.2, 7.0, 0.5), "M4": (4.3, 9.0, 0.8),
           "M5": (5.3, 10.0, 1.0), "M6": (6.4, 12.0, 1.6), "M8": (8.4, 16.0, 1.6), "M10": (10.5, 20.0, 2.0),
           "M12": (13.0, 24.0, 2.5), "M16": (17.0, 30.0, 3.0), "M20": (21.0, 37.0, 3.0), "M24": (25.0, 44.0, 4.0)}


def make(size="M3"):
    if size not in ISO7089:
        raise ValueError("washer: size must be one of " + ", ".join(ISO7089))
    d1, d2, h = ISO7089[size]
    ring = Cylinder(d2 / 2, h, align=(Align.CENTER, Align.CENTER, Align.MIN))
    return ring - Cylinder(d1 / 2, h * 3)
`,
  ball_bearing: `PART_INFO = {
    "category": "bearings",
    "description": "deep-groove ball bearing envelope (ISO 15 boundary dimensions): bore, outside diameter, width, with the race shoulders; balls not modelled",
    "tags": ["bearing", "ball bearing", "608", "625", "6000", "6200", "skate"],
    "parameters": {
        "series": {"type": "str", "default": "608", "description": "625 626 688 608 6000..6005 6200..6202"},
    },
}
from build123d import *

ISO15 = {"625": (5, 16, 5), "626": (6, 19, 6), "688": (8, 16, 5), "608": (8, 22, 7),
         "6000": (10, 26, 8), "6001": (12, 28, 8), "6002": (15, 32, 9), "6003": (17, 35, 10),
         "6004": (20, 42, 12), "6005": (25, 47, 12), "6200": (10, 30, 9), "6201": (12, 32, 10),
         "6202": (15, 35, 11)}


def make(series="608"):
    if str(series) not in ISO15:
        raise ValueError("ball_bearing: series must be one of " + ", ".join(ISO15))
    d, D, B = ISO15[str(series)]
    gap = (D - d) / 2
    outer = Cylinder(D / 2, B) - Cylinder(D / 2 - gap * 0.3, B * 2)
    inner = Cylinder(d / 2 + gap * 0.3, B) - Cylinder(d / 2, B * 2)
    shield = Cylinder(D / 2 - gap * 0.25, B * 0.84) - Cylinder(d / 2 + gap * 0.25, B)
    return Pos(0, 0, B / 2) * (outer + inner + shield)
`,
  spacer: `PART_INFO = {
    "category": "hardware",
    "description": "round spacer / tube: outside and inside diameter, length",
    "tags": ["spacer", "tube", "bushing", "sleeve"],
    "parameters": {
        "od": {"type": "float", "default": 8.0, "description": "outside diameter, mm"},
        "id": {"type": "float", "default": 4.2, "description": "inside diameter, mm (0 = solid)"},
        "length": {"type": "float", "default": 10.0, "description": "length, mm"},
    },
}
from build123d import *


def make(od=8.0, id=4.2, length=10.0):
    tube = Cylinder(od / 2, length, align=(Align.CENTER, Align.CENTER, Align.MIN))
    if id > 0:
        tube -= Cylinder(id / 2, length * 3)
    return tube
`,
  hex_standoff: `PART_INFO = {
    "category": "hardware",
    "description": "female-female hex standoff: across flats, length, through hole of the thread's nominal diameter",
    "tags": ["standoff", "spacer", "hex", "pcb", "pillar"],
    "parameters": {
        "thread": {"type": "str", "default": "M3", "description": "M2, M2.5, M3, M4"},
        "length": {"type": "float", "default": 10.0, "description": "length, mm"},
    },
}
from build123d import *

FLATS = {"M2": 4.0, "M2.5": 5.0, "M3": 5.5, "M4": 7.0}


def make(thread="M3", length=10.0):
    s = FLATS[thread]
    d = float(thread[1:])
    body = extrude(RegularPolygon(s / 2, 6, major_radius=False), length)
    return body - Cylinder(d / 2, length * 3)
`,
  heat_set_insert_boss: `PART_INFO = {
    "category": "3d printing",
    "description": "boss for a brass heat-set insert (common M2-M5 hole sizes): a cylinder with the insert's pilot hole",
    "tags": ["heat set", "insert", "boss", "3d printing", "threaded"],
    "parameters": {
        "thread": {"type": "str", "default": "M3", "description": "M2, M2.5, M3, M4, M5"},
        "height": {"type": "float", "default": 8.0, "description": "boss height, mm"},
    },
}
from build123d import *

# pilot hole diameter, insert length (typical knurled inserts)
INSERTS = {"M2": (3.2, 4.0), "M2.5": (3.5, 5.0), "M3": (4.0, 5.7), "M4": (5.6, 8.1), "M5": (6.4, 9.5)}


def make(thread="M3", height=8.0):
    hole, depth = INSERTS[thread]
    boss = Cylinder(hole, height, align=(Align.CENTER, Align.CENTER, Align.MIN))
    pocket = Pos(0, 0, height - depth) * Cylinder(hole / 2, depth + 1, align=(Align.CENTER, Align.CENTER, Align.MIN))
    return boss - pocket
`,
  l_bracket: `PART_INFO = {
    "category": "brackets",
    "description": "L bracket: two legs of a given width and thickness, an inside fillet, clearance holes in both legs",
    "tags": ["bracket", "angle", "corner", "mount"],
    "parameters": {
        "width": {"type": "float", "default": 30.0, "description": "bracket width, mm"},
        "leg_a": {"type": "float", "default": 40.0, "description": "base leg length (along X), mm"},
        "leg_b": {"type": "float", "default": 40.0, "description": "upright leg height (along Z), mm"},
        "thickness": {"type": "float", "default": 4.0, "description": "plate thickness, mm"},
        "hole_d": {"type": "float", "default": 5.5, "description": "clearance hole diameter, mm (0 = none)"},
        "fillet_r": {"type": "float", "default": 4.0, "description": "inside corner fillet, mm"},
    },
}
from build123d import *


def make(width=30.0, leg_a=40.0, leg_b=40.0, thickness=4.0, hole_d=5.5, fillet_r=4.0):
    base = Box(leg_a, width, thickness, align=(Align.MIN, Align.CENTER, Align.MIN))
    upright = Box(thickness, width, leg_b, align=(Align.MIN, Align.CENTER, Align.MIN))
    body = base + upright
    if fillet_r > 0:
        inner = body.edges().filter_by(Axis.Y).filter_by(lambda e: abs(e.center().X - thickness) < 1e-6
                                                         and abs(e.center().Z - thickness) < 1e-6)
        body = fillet(inner, radius=fillet_r)
    if hole_d > 0:
        x = thickness + (leg_a - thickness) / 2
        z = thickness + (leg_b - thickness) / 2
        body -= Pos(x, 0, 0) * Cylinder(hole_d / 2, thickness * 4)
        body -= Pos(0, 0, z) * Rot(0, 90, 0) * Cylinder(hole_d / 2, thickness * 4)
    return body
`,
  enclosure: `PART_INFO = {
    "category": "enclosures",
    "description": "rounded box enclosure and its lid with a locating lip, side by side (base at the origin, lid +X)",
    "tags": ["enclosure", "box", "case", "lid", "housing", "3d printing"],
    "parameters": {
        "length": {"type": "float", "default": 80.0, "description": "outside length (X), mm"},
        "width": {"type": "float", "default": 50.0, "description": "outside width (Y), mm"},
        "height": {"type": "float", "default": 30.0, "description": "base outside height (Z), mm"},
        "wall": {"type": "float", "default": 2.0, "description": "wall and floor thickness, mm"},
        "corner_r": {"type": "float", "default": 5.0, "description": "outside corner radius, mm"},
        "lid_t": {"type": "float", "default": 2.0, "description": "lid plate thickness, mm"},
        "clearance": {"type": "float", "default": 0.2, "description": "gap between lip and wall, mm"},
    },
}
from build123d import *


def make(length=80.0, width=50.0, height=30.0, wall=2.0, corner_r=5.0, lid_t=2.0, clearance=0.2):
    outer = extrude(RectangleRounded(length, width, corner_r), height)
    cavity = Pos(0, 0, wall) * extrude(RectangleRounded(length - 2 * wall, width - 2 * wall,
                                                         max(corner_r - wall, 0.5)), height)
    base = outer - cavity
    lid = extrude(RectangleRounded(length, width, corner_r), lid_t)
    lw, ww = length - 2 * wall - 2 * clearance, width - 2 * wall - 2 * clearance
    lip = Pos(0, 0, lid_t) * (extrude(RectangleRounded(lw, ww, max(corner_r - wall, 0.5)), 3)
                              - extrude(RectangleRounded(lw - 2 * wall, ww - 2 * wall,
                                                         max(corner_r - 2 * wall, 0.4)), 3))
    lid = Pos(length + 10, 0, 0) * (lid + lip)
    base.label = "base"
    lid.label = "lid"
    return Compound(children=[base, lid])
`,
  knob: `PART_INFO = {
    "category": "hardware",
    "description": "fluted control knob with a D-shaft bore (flat of 0.5 mm on a 6 mm shaft by default)",
    "tags": ["knob", "potentiometer", "dial", "d-shaft", "grip"],
    "parameters": {
        "diameter": {"type": "float", "default": 30.0, "description": "outside diameter, mm"},
        "height": {"type": "float", "default": 18.0, "description": "height, mm"},
        "flutes": {"type": "int", "default": 12, "description": "number of grip flutes"},
        "shaft_d": {"type": "float", "default": 6.0, "description": "shaft diameter, mm"},
        "flat": {"type": "float", "default": 0.5, "description": "depth of the D flat, mm (0 = round)"},
        "bore_depth": {"type": "float", "default": 12.0, "description": "bore depth, mm"},
    },
}
from build123d import *


def make(diameter=30.0, height=18.0, flutes=12, shaft_d=6.0, flat=0.5, bore_depth=12.0):
    body = Cylinder(diameter / 2, height, align=(Align.CENTER, Align.CENTER, Align.MIN))
    flute = Cylinder(diameter * 0.06, height * 3)
    body -= PolarLocations(diameter / 2 + diameter * 0.02, flutes) * flute
    body = fillet(body.edges().group_by(Axis.Z)[-1], radius=min(diameter * 0.03, 1.5))
    bore = Cylinder(shaft_d / 2, bore_depth, align=(Align.CENTER, Align.CENTER, Align.MIN))
    if flat > 0:
        bore -= Pos(shaft_d / 2 - flat + shaft_d / 2, 0, 0) * Box(shaft_d, shaft_d * 2, bore_depth * 3)
    return body - bore
`,
  pipe_clamp: `PART_INFO = {
    "category": "brackets",
    "description": "two-hole saddle clamp (pipe strap) for a round pipe or rod",
    "tags": ["clamp", "pipe", "strap", "saddle", "tube", "conduit"],
    "parameters": {
        "pipe_d": {"type": "float", "default": 20.0, "description": "pipe outside diameter, mm"},
        "width": {"type": "float", "default": 15.0, "description": "strap width, mm"},
        "thickness": {"type": "float", "default": 3.0, "description": "strap thickness, mm"},
        "hole_d": {"type": "float", "default": 4.5, "description": "mounting hole diameter, mm"},
        "tab": {"type": "float", "default": 12.0, "description": "mounting tab length, mm"},
    },
}
from build123d import *


def make(pipe_d=20.0, width=15.0, thickness=3.0, hole_d=4.5, tab=12.0):
    # the pipe rests on the mounting surface (z = 0): its axis is at z = r_in,
    # the strap arches over it, drops down two legs and ends in two tabs
    r_in = pipe_d / 2
    r_out = r_in + thickness
    ring = Pos(0, 0, r_in) * (Cylinder(r_out, width, rotation=(90, 0, 0))
                              - Cylinder(r_in, width * 2, rotation=(90, 0, 0)))
    arch = ring & Pos(0, 0, r_in) * Box(2 * r_out, width, r_out, align=(Align.CENTER, Align.CENTER, Align.MIN))
    body = arch
    for sx in (-1, 1):
        body += Pos(sx * (r_in + thickness / 2), 0, r_in / 2) * Box(thickness, width, r_in)
        body += Pos(sx * (r_out + tab / 2), 0, thickness / 2) * Box(tab, width, thickness)
        body -= Pos(sx * (r_out + tab / 2), 0, 0) * Cylinder(hole_d / 2, thickness * 6)
    return body
`,
  spur_gear: `PART_INFO = {
    "category": "gears",
    "description": "involute spur gear (20 deg pressure angle, standard addendum/dedendum): module, tooth count, face width, bore",
    "tags": ["gear", "spur", "involute", "transmission", "module"],
    "parameters": {
        "module": {"type": "float", "default": 1.0, "description": "module m (pitch diameter = m * teeth), mm"},
        "teeth": {"type": "int", "default": 20, "description": "number of teeth (>= 8)"},
        "thickness": {"type": "float", "default": 6.0, "description": "face width, mm"},
        "bore": {"type": "float", "default": 5.0, "description": "bore diameter, mm (0 = none)"},
        "pressure_angle": {"type": "float", "default": 20.0, "description": "pressure angle, degrees"},
    },
}
from build123d import *
import math


def _involute(rb, t):
    return (rb * (math.cos(t) + t * math.sin(t)), rb * (math.sin(t) - t * math.cos(t)))


def make(module=1.0, teeth=20, thickness=6.0, bore=5.0, pressure_angle=20.0):
    m, z = float(module), int(teeth)
    rp = m * z / 2
    ra = rp + m
    rf = max(rp - 1.25 * m, m)
    rb = rp * math.cos(math.radians(pressure_angle))
    t_a = math.sqrt(max((ra / rb) ** 2 - 1, 0.0))
    # half tooth angle at the pitch circle, measured from the involute start
    t_p = math.sqrt(max((rp / rb) ** 2 - 1, 0.0))
    inv_p = math.tan(math.atan(t_p)) - math.atan(t_p)
    half = math.pi / (2 * z) + inv_p
    pts = []
    n = 8
    for k in range(z):
        c = 2 * math.pi * k / z
        flank = [_involute(rb, t_a * i / n) for i in range(n + 1)]
        right = []
        for (x, y) in flank:
            r = math.hypot(x, y)
            a = math.atan2(y, x)
            right.append((max(r, rf), -half + a))
        left = [(r, half - a) for (r, a) in reversed(right)]
        if rf < rb:
            pts.append((rf * math.cos(c - half), rf * math.sin(c - half)))
        for (r, a) in right + left:
            pts.append((r * math.cos(c + a), r * math.sin(c + a)))
        if rf < rb:
            pts.append((rf * math.cos(c + half), rf * math.sin(c + half)))
    clean = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 1e-6:
            clean.append(p)
    if math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) < 1e-6:
        clean.pop()
    gear = extrude(Polygon(*clean, align=None), thickness)
    if bore > 0:
        gear -= Cylinder(bore / 2, thickness * 3)
    return gear
`,
};

/** The `cs_parts` Python module: the sources above plus the loader. */
const LOADER = `
"""cs_parts (build123d-lite): the part library. load(name, **params) runs a
part file (PART_INFO + make(**params)) and returns its shape; info(name) and
search(query) describe them."""
from build123d import *


def _src(name):
    if name not in PARTS:
        raise KeyError('no part named ' + repr(name) + ' in the library; parts: ' + ', '.join(sorted(PARTS)))
    return PARTS[name]


def _namespace(name):
    ns = {'__name__': 'cs_parts_' + name}
    exec(_src(name), ns)
    return ns


def info(name):
    return _namespace(name)['PART_INFO']


def search(query=''):
    words = [w for w in str(query).lower().split() if w]
    out = []
    for name in sorted(PARTS):
        i = info(name)
        params = [k + ' ' + str(v.get('description', '')) + ' ' + str(v.get('default', ''))
                  for k, v in i.get('parameters', {}).items()]
        hay = ' '.join([name, i.get('category', ''), i.get('description', '')] + list(i.get('tags', [])) + params).lower()
        if all(w in hay for w in words):
            out.append(dict(name=name, **i))
    return out


def load(name, **params):
    ns = _namespace(name)
    spec = ns['PART_INFO'].get('parameters', {})
    unknown = [k for k in params if k not in spec]
    if unknown:
        raise TypeError(name + ': unknown parameter(s) ' + ', '.join(unknown) + '; it takes ' + ', '.join(spec))
    args = {}
    for k, v in params.items():
        kind = spec[k].get('type')
        args[k] = int(v) if kind == 'int' else (float(v) if kind == 'float' else (str(v) if kind == 'str' else v))
    import build123d as _b
    mark = _b._cs_scene_mark()
    try:
        return ns['make'](**args)
    finally:
        # a part is a black box: its intermediate shapes never join the scene
        _b._cs_scene_restore(mark)
`;

export const CS_PARTS_PY = 'PARTS = ' + JSON.stringify(PARTS) + '\n' + LOADER;

/** A part's PART_INFO as data (the dict literals above are JSON once their
 *  trailing commas go). */
export function partInfo(name) {
  const src = PARTS[name];
  if (!src) { return null; }
  const block = src.slice(src.indexOf('{'), src.indexOf('\n}\n') + 2);
  return JSON.parse(block.replace(/,(\s*[}\]])/g, '$1'));
}

/** Parts matching every word of `query` (name, category, description,
 *  tags), with their parameters. */
export function searchParts(query = '') {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return Object.keys(PARTS).sort().map((name) => Object.assign({ name }, partInfo(name)))
    .filter((p) => {
      const params = Object.entries(p.parameters || {}).map(([k, v]) => k + ' ' + (v.description || '') + ' ' + v.default);
      const hay = [p.name, p.category, p.description].concat(p.tags || [], params).join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
}
