// mcp-tools.js — what the MCP endpoint offers: the tool list (names follow
// build123d-mcp's where the meaning matches, so its workflow guidance
// carries over), the server instructions, the workflow guide, one prompt and
// two resources. The tools themselves run in the session Durable Object
// (session.js, mcpTool()); the protocol is mcp.js. The reference resources
// (build123d://quickref, build123d://selectors) are adapted from
// build123d-mcp: knowledge.js.

import { QUICKREF, SELECTORS } from './knowledge.js';

export const SERVER_INFO = { name: 'cascade-build123d', title: 'CascadeStudio build123d (remote sessions)', version: '0.2.0' };

const session = {
  type: 'string',
  pattern: '^[A-Za-z0-9_.-]{1,64}$',
  description: 'Session id, from new_session or an earlier call. Every call with the same id shares one model.',
};
const sessionOptional = Object.assign({}, session, {
  description: session.description + ' Omit it to start a new session; the reply says which id it got.',
});
const VIEW_NAMES = ['iso', 'front', 'back', 'right', 'left', 'top', 'bottom', 'iso-back', 'iso-below'];
const objectName = {
  type: ['string', 'integer'],
  description: 'A shown object: the name given in show(obj, "name"), or its index. A named list is all its '
    + 'members (name[0], name[1], ...). Omit for every shown shape.',
};
const objectList = {
  type: ['array', 'string'], items: { type: ['string', 'integer'] },
  description: 'Shown objects by name or index (an array, or names separated by commas).',
};
const RO = { readOnlyHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: 'new_session',
    title: 'Start a CAD session',
    description: 'Start an empty modeling session and return its id and an editor link a person can open to watch '
      + 'and edit the same model. Optional: execute/set_script start one too when called without a session.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'execute',
    title: 'Run build123d code',
    description: 'Append build123d Python to the session script and run the whole script (unchanged operations '
      + 'are cached, so re-running earlier code is cheap). If it raises, the appended code is rolled back and the '
      + 'error comes back with its line and repair hints. `from build123d import *` is added to an empty session. '
      + 'Register what to display, measure and export with show(obj, "name"): showing a name again replaces it, '
      + 'and a chunk with an unnamed show() supersedes earlier unnamed show lines. With no show() at all, a '
      + 'top-level `result` is shown. The reply lists each shown shape and what changed since the last run '
      + '(volume, faces, bbox), and warns when a boolean changed nothing. print() output is returned. '
      + 'Units are millimetres.',
    inputSchema: { type: 'object', properties: { session: sessionOptional,
      code: { type: 'string', description: 'build123d Python (builder or algebra mode).' } }, required: ['code'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'set_script',
    title: 'Replace the whole script',
    description: 'Replace the session script with a complete build123d program and run it. Unlike execute, the '
      + 'script is kept even if it raises (like saving a file), so it can be fixed with another set_script.',
    inputSchema: { type: 'object', properties: { session: sessionOptional,
      code: { type: 'string', description: 'The complete build123d program.' } }, required: ['code'] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_script',
    title: 'Read the script',
    description: 'The session script with line numbers, its revision, and who changed it last (agent or the '
      + 'person in the editor).',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'render_view',
    title: 'Look at the model',
    description: 'Render the session\'s objects to a PNG (shaded, edges drawn, axis triad, size label) from a '
      + 'named view or an azimuth/elevation; or an exact hidden-line drawing (style "lines", or format "svg" for '
      + 'the file). Section views with clip_plane, colours and name labels per object. Renders confirm appearance; '
      + 'verify dimensions with measure. Look at every feature you add from at least two views.',
    inputSchema: { type: 'object', properties: {
      session,
      view: { type: 'string', enum: VIEW_NAMES, description: 'Named view (default iso).' },
      direction: { type: 'string', description: 'build123d-mcp\'s name for view (also accepts "rear", "side").' },
      azimuth: { type: 'number', description: 'Degrees; 0 looks from the front (-Y), 90 from the right (+X). Overrides view.' },
      elevation: { type: 'number', description: 'Degrees; 90 looks straight down. Overrides view.' },
      width: { type: 'integer', minimum: 128, maximum: 1600, description: 'Pixels (default 800).' },
      height: { type: 'integer', minimum: 128, maximum: 1200, description: 'Pixels (default 600).' },
      objects: Object.assign({}, objectList, { description: 'Only these shown objects (names or indices).' }),
      shapes: { type: 'array', items: { type: ['string', 'integer'] }, description: 'Same as objects.' },
      highlight: Object.assign({}, objectList, { description: 'Draw these objects in orange.' }),
      edges: { type: 'boolean', description: 'Draw the model edges (default true).' },
      format: { type: 'string', enum: ['png', 'svg'], description: 'png (default) or an svg hidden-line drawing.' },
      style: { type: 'string', enum: ['shaded', 'lines'], description: 'png: shaded (default) or an exact hidden-line drawing (hidden edges dashed).' },
      hidden: { type: 'boolean', description: 'svg / lines: draw hidden lines dashed (default true).' },
      quality: { type: 'string', enum: ['preview', 'standard', 'high'], description: 'preview: coarse and fast; high: finer mesh, 3x supersampling.' },
      colors: { type: 'object', additionalProperties: { type: 'string' },
        description: 'Colours by object name or index, e.g. {"lid": "steel", "pin": "#d04030"}.' },
      clip_plane: { type: 'string', enum: ['x', 'y', 'z'], description: 'Cut the model with a plane normal to this axis; material the cut passes through shows red.' },
      clip_at: { type: 'number', description: 'Where the clip plane sits (mm; default the middle of the objects).' },
      clip_keep: { type: 'string', enum: ['below', 'above'], description: 'Which side of the plane to keep (default below).' },
      label_objects: { type: 'boolean', description: 'Write each object\'s name on it.' },
    }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'measure',
    title: 'Measure the shapes',
    description: 'Per shown object: type, solids/faces/edges/vertices, volume (mm^3), area (mm^2), bounding box, '
      + 'centre of mass, validity; for up to four objects also the face inventory (every face as Plane/Cylinder/'
      + 'Cone/Sphere/Torus/BSpline with its diameter, axis, angle; identical faces collapsed with a count) and '
      + 'the inertia tensor. With a density or material also the mass, and the inertia in g*mm^2. Prefer '
      + 'measure over a render to check geometry: numbers are unambiguous, and face counts show whether a '
      + 'boolean did anything.',
    inputSchema: { type: 'object', properties: { session,
      object_name: objectName,
      shape: { type: ['string', 'integer'], description: 'Same as object_name.' },
      density: { type: 'number', description: 'g/cm^3, e.g. 1.24 for PLA, 2.7 for aluminium.' },
      material: { type: 'string', enum: ['steel', 'stainless', 'aluminum', '6061', 'brass', 'copper', 'titanium',
        'abs', 'pla', 'petg', 'nylon'], description: 'A density preset instead of density.' },
      exact_bbox: { type: 'boolean', description: 'Optimal bounding boxes (slower; the default box is tight for '
        + 'planes, cylinders, cones, spheres and tori but may overshoot a B-spline surface).' } }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'validate',
    title: 'Check before export',
    description: 'The validity gate before export: PASS/FAIL with reasons. Each object must be valid to OpenCascade '
      + '(BRepCheck), a closed manifold solid (every edge shared by exactly two faces: no open or non-manifold '
      + 'edges) with positive volume, and its solids must not overlap each other (an overlap counts its volume '
      + 'twice). A sketch, surface or loose curve shown as an object FAILs. Warnings: disjoint solids, and '
      + 'separate objects that interpenetrate. locate_gate_defects says where a FAIL is.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'locate_gate_defects',
    title: 'Where the gate fails',
    description: 'Where an object fails the validity gate, with coordinates: open_edge and nonmanifold_edge '
      + '(the edge midpoint and how many faces use it), overlapping solids (which pair, the overlap volume, '
      + 'containing or interpenetrating), BRepCheck failures; each with a repair hint. Empty when it passes.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'compare',
    title: 'Compare two objects',
    description: 'kind "fit": how two shown objects sit: clearance (surface distance), status apart / touching / '
      + 'containing / interpenetrating, containment, the intersection volume and each one\'s volume outside the '
      + 'other. kind "align": two objects along one axis (mode flush = the max extremes as delta, plus delta_min for '
      + 'the min side, center = the box '
      + 'centres, clearance = the nearest faces; negative = overlap). kind "shape": volume, topology, bbox and '
      + 'centre deltas plus the exact volume added and removed from a to b. kind "snapshot": snapshot a against '
      + 'the current session (or snapshot b), per object.',
    inputSchema: { type: 'object', properties: { session,
      a: { type: ['string', 'integer'], description: 'An object (name or index), or for kind snapshot a snapshot name.' },
      b: { type: ['string', 'integer'], description: 'The second object (or snapshot); snapshot: omit for the current state.' },
      kind: { type: 'string', enum: ['fit', 'align', 'shape', 'snapshot'], description: 'Default fit.' },
      axis: { type: 'string', enum: ['X', 'Y', 'Z'], description: 'align: the axis (default Z).' },
      mode: { type: 'string', enum: ['flush', 'center', 'clearance'], description: 'align: default flush.' },
      format: { type: 'string', enum: ['text', 'json'], description: 'snapshot: default text.' },
    }, required: ['session', 'a'] },
    annotations: RO,
  },
  {
    name: 'resolve',
    title: 'Evaluate a selector',
    description: 'Apply a selector to a shown object and describe what it picks, before using it in a fillet or '
      + 'chamfer: e.g. selector ".faces().sort_by(Axis.Z)[-1]" or ".edges().filter_by(GeomType.CIRCLE)". '
      + 'Returns type, geom_type, area/length and the TRUE centre (a circle\'s arc centre, a face\'s area '
      + 'centroid); a planar face also its normal, a curved face its axis and radius; a list its count, average '
      + 'centre and up to 50 entities. object_name is a name from show() or a top-level variable of the script. '
      + 'With a label the result is kept (session_state lists it).',
    inputSchema: { type: 'object', properties: { session,
      object_name: { type: 'string', description: 'A show() name or a top-level variable.' },
      selector: { type: 'string', description: 'A Python expression suffix applied to the object, starting with "." or "[".' },
      label: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,40}$', description: 'Keep the result under this label.' },
    }, required: ['session', 'object_name', 'selector'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'design_audit',
    title: 'Audit the design\'s parameters',
    description: 'Audit the script as a design to edit, not just a shape: find its top-level numeric parameters '
      + '(width = 60.0, or a, b = 10, 20), rebuild with each one nudged by +/-epsilon (default 10%) and run the '
      + 'validity gate on each variant. A parameter is brittle when a small change fails to rebuild or fails the '
      + 'gate; coupling when a dependent fillet/chamfer/offset breaks; inconclusive when it is reassigned later or '
      + 'the time budget ran out. The session script is not changed. Runs are cached, but each variant re-runs '
      + 'what depends on the parameter: keep max_params small on big models.',
    inputSchema: { type: 'object', properties: { session,
      epsilon: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1, description: 'Relative nudge (default 0.1).' },
      max_params: { type: 'integer', minimum: 1, maximum: 12, description: 'Parameters to audit (default 8).' },
    }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'find_holes',
    title: 'Find drilled holes',
    description: 'Recognise drilled holes on an object (default: every shown object) from its internal cylinders '
      + '(build123d-drafting-helpers\' find_holes): per hole the axis (into the part), the opening location, '
      + 'diameter, depth, bottom (through / flat / drill_point / unknown) and any counterbore or spotface step. '
      + 'Countersinks are reported as plain openings here; see find_countersinks.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'find_hole_patterns',
    title: 'Find hole patterns',
    description: 'Group identical holes into bolt circles (centre, bolt-circle diameter), linear arrays (pitch, '
      + 'direction) and rectangular grids (rows x cols, pitches, angle), with the member holes. As upstream: a '
      + 'grid needs at least 3 along one axis — four holes on a rectangle\'s corners are not reported (read their '
      + 'spacing from find_holes), and a linear array needs 3 or more.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'find_bosses',
    title: 'Find bosses',
    description: 'Recognise external cylindrical bosses (and a turned part\'s outside diameters): axis (base to free '
      + 'end), the free-end location, diameter and height.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'find_bored_bosses',
    title: 'Find bored-boss edit candidates',
    description: 'Candidates for "extend / edit the bored boss" requests: each recognised bore with the planar cap '
      + 'faces around its opening, whether the cap is split across several faces, whether the opening is on the '
      + 'outer envelope, risk flags and construction advice. A diagnostic table, not a proof of which boss is meant.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'find_countersinks',
    title: 'Find countersinks',
    description: 'Recognise countersinks (conical screw-head recesses flaring from a drilled bore): opening location, '
      + 'axis into the part, major (surface) diameter, drill diameter, included angle (e.g. 82/90/100/120) and depth. '
      + 'Drill-point cones and external chamfers are excluded.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'cross_sections',
    title: 'Slice the object',
    description: 'Cross-sections at evenly spaced planes along X, Y or Z (num_slices, default 10, from 1% inside '
      + 'the bounding box to 1% inside its far side): per slice the position, the exact section area (holes '
      + 'subtracted), the number of separate regions and of holes, and the section size. Finds internal '
      + 'voids, wall changes and where a part necks down without a render.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName,
      axis: { type: 'string', enum: ['X', 'Y', 'Z'], description: 'Default Z.' },
      num_slices: { type: 'integer', minimum: 2, maximum: 200, description: 'Default 10.' },
    }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'analyze_printability',
    title: 'Check FDM printability',
    description: 'FDM printability of an object as it is oriented (+Z up, resting on its lowest point), BREP-exact '
      + '(augura): overhangs needing support (and short flat ceilings that bridge), watertight/manifold, tip-over '
      + '(centre of mass outside the bed footprint), brim need (small footprint or tall aspect), the smallest '
      + 'vertical feature (caps the layer height), walls thinner than min_perimeters x nozzle, and, with a '
      + 'build_volume, bed fit. A summary line, then JSON findings (kind, severity, message, area, location).',
    inputSchema: { type: 'object', properties: { session, object_name: objectName,
      support_angle: { type: 'number', description: 'Faces shallower than this many degrees from horizontal need support (default 45).' },
      nozzle: { type: 'number', description: 'Nozzle diameter in mm (default 0.4).' },
      min_perimeters: { type: 'integer', description: 'Walls thinner than min_perimeters x nozzle are flagged (default 2).' },
      build_volume: { type: ['string', 'array'], items: { type: 'number' }, description: '"X Y Z" in mm, e.g. "220 220 250".' },
      bed_tol: { type: 'number', description: 'Z tolerance in mm for bed-contact faces (default 0.001).' },
      min_feature: { type: 'number', description: 'Smallest vertical feature in mm to report (default 0.5).' },
    }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'import_cad_file',
    title: 'Import a STEP or BREP file',
    description: 'Bring a STEP (.step/.stp) or BREP file into the session, from a URL or as text, and show it as a named '
      + 'object: the script gains `name = import_step("file.step")` + `show(name, "name")`, so it can be measured, '
      + 'compared (compare kind "fit" against your design), cut or fused like any shape. The file is kept with the '
      + 'session. STL/3MF cannot be imported (build123d-lite has no mesh import).',
    inputSchema: { type: 'object', properties: { session: sessionOptional,
      url: { type: 'string', description: 'http(s) URL of the file.' },
      content: { type: 'string', description: 'The file text, instead of a URL.' },
      filename: { type: 'string', description: 'File name (default from the URL), e.g. "bracket.step".' },
      name: { type: 'string', description: 'The variable/object name (default the file stem).' },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'health_check',
    title: 'Server and session health',
    description: 'The engine (flavor, boot time, isolate age, memory), the session (script revision, last run, imports) and the limits.',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: RO,
  },
  {
    name: 'destroy_session',
    title: 'Delete the session',
    description: 'Delete everything of this session for good: script, snapshots, exported and imported files, the cache. '
      + 'Needs confirm: true. (reset only empties the script.)',
    inputSchema: { type: 'object', properties: { session, confirm: { type: 'boolean' } }, required: ['session', 'confirm'] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'search_library',
    title: 'Search the part library',
    description: 'Search the part library: standard parts with real dimensions (ISO 4032/4017/4762/7089 hex nuts, bolts, '
      + 'socket head cap screws, washers; ISO 15 ball bearings; standoffs, spacers, heat-set insert bosses; brackets, '
      + 'enclosures, knobs, pipe clamps; involute spur gears). Words match name, category, description and tags; an '
      + 'empty query lists everything. Returns each part\'s parameters with types, defaults and descriptions.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    annotations: RO,
  },
  {
    name: 'load_part',
    title: 'Load a library part',
    description: 'Add a library part to the session as a named object: the script gains '
      + '`name = cs_parts.load("hex_nut", size="M4")` + a named show(), so it can be moved, cut, fused and measured like '
      + 'anything else (and the person in the editor sees the same line). params: the part\'s parameters (others default).',
    inputSchema: { type: 'object', properties: { session: sessionOptional,
      name: { type: 'string', description: 'A part name from search_library.' },
      params: { type: ['object', 'string'], description: 'Parameter overrides, e.g. {"size": "M4"} (or the same as a JSON string).' },
      as_name: { type: 'string', description: 'The variable/object name (default the part name).' },
    }, required: ['name'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'repair_hints',
    title: 'Fix suggestions for an error',
    description: 'Targeted fix suggestions for an error message or validity-gate reason (execute and validate '
      + 'already append the matching ones): Location syntax, missing .part, CadQuery idioms, missing imports, '
      + 'empty booleans, fillet failures, open or non-manifold edges, overlapping solids, what this build123d lacks.',
    inputSchema: { type: 'object', properties: {
      error_text: { type: 'string', description: 'The error or gate reason, in full.' } }, required: ['error_text'] },
    annotations: RO,
  },
  {
    name: 'export',
    title: 'Export a file',
    description: 'Export the shown objects (or one, object_name) and return a download URL (kept for an hour). '
      + 'step and brep are exact; stl and 3mf are meshes for printing (3mf: one named object per object, optional '
      + 'colours); glb is a mesh for viewers (metres, Y up); svg and '
      + 'dxf are an exact hidden-line projection (dxf: mm, layers VISIBLE and HIDDEN). 3-D formats report the '
      + 'validity gate; with strict a FAILing object is not exported. The URL is a plain link to hand the person; '
      + 'a code sandbox can fetch it only if this host is on its allowed domains.',
    inputSchema: { type: 'object', properties: { session, object_name: objectName,
      format: { type: 'string', enum: ['step', 'stl', 'brep', 'glb', '3mf', 'svg', 'dxf'] },
      colors: { type: 'object', additionalProperties: { type: 'string' }, description: '3mf: colours by object, e.g. {"lid": "red"}.' },
      filename: { type: 'string', description: 'Base name without extension (default "model", or the object\'s name).' },
      view: { type: 'string', enum: VIEW_NAMES, description: 'svg/dxf: the projection view (default iso).' },
      strict: { type: 'boolean', description: 'Refuse to export an object that fails the validity gate.' } },
    required: ['session', 'format'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'session_state',
    title: 'Session overview',
    description: 'Script revision and who changed it last, the last run (ok, errors, shapes, cache hits), '
      + 'snapshots, exported files and the editor link.',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'last_error',
    title: 'Last error',
    description: 'The last run\'s error with its line number and the surrounding script lines.',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'reset',
    title: 'Clear the script',
    description: 'Empty the session script (snapshots and files are kept).',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'save_snapshot',
    title: 'Save a snapshot',
    description: 'Save the current script under a name (with a summary of its shapes), to come back to with '
      + 'restore_snapshot or to diff with compare(kind="snapshot").',
    inputSchema: { type: 'object', properties: { session,
      name: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,40}$' } }, required: ['session', 'name'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'restore_snapshot',
    title: 'Restore a snapshot',
    description: 'Replace the script with a saved snapshot and run it.',
    inputSchema: { type: 'object', properties: { session,
      name: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,40}$' } }, required: ['session', 'name'] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'open_in_editor',
    title: 'Editor link',
    description: 'A link to the CascadeStudio editor on this session: a person sees the model, can edit the '
      + 'script, and their edits show up here (session_state, get_script).',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'workflow_hints',
    title: 'How to work with these tools',
    description: 'The modeling workflow, review loop and what this build123d supports.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

/** Arguments as the tool's schema types them. Model clients sometimes send
 *  an array or object as its JSON text ('["plate", "lid"]'), or a number or
 *  boolean as a string ("800", "true"); a top-level argument whose schema
 *  does not take that string as it is gets the value it encodes. Anything
 *  that doesn't parse to an allowed type is passed on unchanged, for the
 *  tool's own validation. */
export function coerceArgs(tool, args) {
  const props = (tool && tool.inputSchema && tool.inputSchema.properties) || {};
  if (!args || typeof args !== 'object' || Array.isArray(args)) { return args; }
  const out = Object.assign({}, args);
  for (const [key, v] of Object.entries(args)) {
    const schema = props[key];
    if (!schema || !schema.type || typeof v !== 'string') { continue; }
    const types = [].concat(schema.type);
    const t = v.trim();
    if ((types.includes('array') && t.startsWith('[')) || (types.includes('object') && t.startsWith('{'))) {
      try {
        const j = JSON.parse(t);
        if (types.includes(Array.isArray(j) ? 'array' : (j && typeof j === 'object' ? 'object' : '-'))) { out[key] = j; continue; }
      } catch (err) { /* not JSON: leave it */ }
    }
    if (types.includes('string')) { continue; }
    if ((types.includes('integer') || types.includes('number')) && /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) {
      const n = Number(t);
      if (types.includes('number') || Number.isInteger(n)) { out[key] = n; continue; }
    }
    if (types.includes('boolean') && (t === 'true' || t === 'false')) { out[key] = t === 'true'; }
  }
  return out;
}

export const INSTRUCTIONS = `Remote build123d CAD: build123d (the "lite" port) on OpenCascade, evaluated in a server-side session, so no local Python is needed.

Loop: execute (or set_script) -> render_view (look, from two views) -> measure / validate -> fix -> export -> open_in_editor to hand the model to a person.
- A session keeps one script. execute appends and rolls back on error; set_script replaces. Re-runs are cheap: unchanged operations come from a cache.
- show(part, "part") registers what is displayed, measured and exported, and names it: tools take the name as object_name. Without show(), a top-level \`result\` is shown. Units are millimetres, Z is up.
- Prefer numbers over pictures to verify: measure (face inventory, inertia), compare(kind="fit") for clearances, resolve to check a selector before a fillet, validate before export.
- Carry the session id from the first reply into every later call.
- workflow_hints has the full guide; build123d://quickref and build123d://selectors have runnable examples.`;

export const WORKFLOW = `# Working with remote build123d sessions

## The loop
1. Plan the part: overall size, the main body, then features (holes, fillets, chamfers, cut-outs). Write the key dimensions as named variables at the top (design_audit checks they survive a +/-10% edit).
2. Build it in steps with execute: one feature per call. A failing step is rolled back (with repair hints), so the session always holds the last working model. Each reply lists the shown shapes and what changed (volume, faces, bbox); a boolean that changed nothing gets a warning.
3. Look after every feature: render_view from "iso" plus one orthographic view ("front", "top" or "right") that shows the feature. Check the size label against your intent.
4. Measure what matters: measure gives the bounding box, volume, centre of mass, the face inventory (hole diameters, axes) and the inertia; compare(kind="fit") says whether two parts clear, touch or collide; compare(kind="align") checks flushness. validate before exporting; locate_gate_defects says where a FAIL is.
5. Before a fillet or chamfer, check the selection: resolve(object_name, ".edges().filter_by(GeomType.CIRCLE)") or find_edges(...) in the script.
6. Fix errors with last_error (the failing line in context) and repair_hints. Common causes: a selector that picked nothing, a fillet radius larger than the adjacent faces allow, booleans between shapes that do not touch.
7. save_snapshot before a risky change; restore_snapshot to go back; compare(kind="snapshot") to see what changed.
8. export: step for CAD, stl for printing, glb for viewers, svg for a drawing. Each returns a download URL for the person: give it as a link. A code sandbox (claude.ai code execution) can fetch it only if this host is on its allowed domains (Settings > Capabilities); when a fetch is refused, give the link and mention that setting rather than retrying. Give the person open_in_editor's link so they can see and tweak the model; their edits appear in session_state/get_script.

## Writing build123d here
- Algebra mode: part = Box(80, 60, 8); part -= Pos(0, 0, 4) * Cylinder(10, 20); part = fillet(part.edges().filter_by(Axis.Z), 3)
- Builder mode: with BuildPart() as p: Box(...); with Locations(...): Hole(...)
- Selectors: edges()/faces()/vertices()/solids() with filter_by(Axis.Z | GeomType.CIRCLE | Plane.XY), sort_by(Axis.Z), group_by(Axis.Z)[-1], slicing. Helpers: named_face(part, "top"), find_edges(part, geom="circle", radius=3).
- Placement: Pos(x, y, z) * shape, Rot(rx, ry, rz) * shape, Locations, GridLocations, PolarLocations, Plane.XZ * sketch.
- 2-D: BuildSketch / Rectangle, Circle, RegularPolygon, Polygon, SlotOverall, Text; then extrude, revolve, loft, sweep.
- Ops: fillet, chamfer, offset, mirror, split, extrude(taper=), revolve, loft, sweep, section, project, thicken, make_hull.
- The scene: show(part, "part") names an object (tools take object_name="part"); showing a name again replaces it; show(a, b) shows several unnamed. Shapes made after the first show() join the scene too, so show at the end or by name.

## What is not available
numpy and other third-party packages, import_svg/import_stl. (The drafting module — Draft, DimensionLine, ExtensionLine, TechnicalDrawing — and the part library — search_library, cs_parts.load — are available.) File I/O happens through export, not open().

## Reading the renders
Shaded grey with dark edges; highlighted objects are orange. The triad at the bottom left shows X (red), Y (green), Z (blue); the label shows the view and the overall size in mm. Orthographic, so parallel edges stay parallel.`;

export const PROMPTS = [
  {
    name: 'start-cad-session',
    title: 'Design a part',
    description: 'Start a session and design a part from a description, with the review loop.',
    arguments: [{ name: 'description', description: 'What to model, with sizes if known.', required: true }],
  },
];

export function promptMessages(name, args = {}) {
  if (name !== 'start-cad-session') { return null; }
  return [{ role: 'user', content: { type: 'text', text: 'Design this part with the cascade-build123d tools: '
    + (args.description || '(no description given)') + '\n\nStart with new_session. Build it one feature at a time '
    + 'with execute, render_view after each feature (iso plus one orthographic view), measure the result against '
    + 'the description, validate, then export a STEP file and give me the editor link.' } }];
}

export const RESOURCES = [
  { uri: 'build123d://workflow', name: 'workflow', title: 'Remote build123d workflow', mimeType: 'text/markdown',
    description: 'The modeling loop and the supported API (same as workflow_hints).' },
  { uri: 'build123d://quickref', name: 'quickref', title: 'build123d quick reference', mimeType: 'text/plain',
    description: 'Runnable examples of the common build123d patterns, primitives, booleans, placement, sketches, '
      + 'selectors, fillets, joints, patterns, sweep/loft/mirror/offset (adapted from build123d-mcp).' },
  { uri: 'build123d://selectors', name: 'selectors', title: 'build123d selectors cookbook', mimeType: 'text/plain',
    description: 'Task-indexed recipes for picking faces, edges and vertices (adapted from build123d-mcp).' },
  { uri: 'build123d://starter', name: 'starter', title: 'A complete example', mimeType: 'text/markdown',
    description: 'One script with algebra mode, builder mode, a revolve and a named show().' },
  { uri: 'build123d://skill/modeling', name: 'skill-modeling', title: 'Skill: model a part (build123d-mcp)', mimeType: 'text/markdown',
    description: 'build123d-mcp\'s modeling workflow (incl. from technical drawings), with a note on what differs here.' },
  { uri: 'build123d://skill/edit', name: 'skill-edit', title: 'Skill: edit an existing model (build123d-mcp)', mimeType: 'text/markdown',
    description: 'build123d-mcp\'s workflow for modifying an existing (often imported) model, with a note on what differs here.' },
];

export { QUICKREF, SELECTORS };

export const STARTER = `# A complete build123d script (remote sessions)

\`\`\`python
from build123d import *

# algebra mode
plate = Box(80, 60, 8)                                   # centred on the origin
plate -= Pos(0, 0, 0) * Cylinder(radius=10, height=20)   # a through hole
plate = fillet(plate.edges().filter_by(Axis.Z), radius=4)
holes = GridLocations(60, 40, 2, 2) * Cylinder(3, 20)
plate -= holes

# builder mode
with BuildPart() as bracket:
    with BuildSketch(Plane.XY) as s:
        RectangleRounded(60, 30, 5)
    extrude(amount=6)
    with Locations((0, 0, 6)):
        Cylinder(8, 20, align=(Align.CENTER, Align.CENTER, Align.MIN))
    Hole(radius=4)
    fillet(bracket.edges().group_by(Axis.Z)[-1], 1)

# a revolved profile
with BuildSketch(Plane.XZ) as prof:
    Polygon((0, 0), (20, 0), (20, 5), (8, 12), (0, 12), align=None)
knob = revolve(prof.sketch, Axis.Z)

# what to display, measure and export, by name (tools take object_name="plate")
show(Pos(-100, 0, 0) * plate, "plate", bracket.part, "bracket", Pos(100, 0, 0) * knob, "knob")
\`\`\`

Selectors: \`part.edges().filter_by(Axis.Z)\`, \`.filter_by(GeomType.CIRCLE)\`, \`.sort_by(Axis.Z)[-1]\`, \`.group_by(Axis.Z)[0]\`, \`part.faces().sort_by(Axis.Z)[-1]\` (top face).
Placement: \`Pos(x, y, z) * s\`, \`Rot(0, 0, 45) * s\`, \`Plane.XZ * sketch\`, \`PolarLocations(20, 6)\`.
Measure in code: \`part.volume\`, \`part.area\`, \`part.bounding_box().size\`, \`print(...)\` (returned by execute).`;
