// mcp-tools.js — what the MCP endpoint offers: the tool list (names follow
// build123d-mcp's where the meaning matches, so its workflow guidance
// carries over), the server instructions, the workflow guide, one prompt and
// two resources. The tools themselves run in the session Durable Object
// (session.js, mcpTool()); the protocol is mcp.js.

export const SERVER_INFO = { name: 'cascade-build123d', title: 'CascadeStudio build123d (remote sessions)', version: '0.1.0' };

const session = {
  type: 'string',
  pattern: '^[A-Za-z0-9_.-]{1,64}$',
  description: 'Session id, from new_session or an earlier call. Every call with the same id shares one model.',
};
const sessionOptional = Object.assign({}, session, {
  description: session.description + ' Omit it to start a new session; the reply says which id it got.',
});
const VIEW_NAMES = ['iso', 'front', 'back', 'right', 'left', 'top', 'bottom', 'iso-back', 'iso-below'];

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
      + 'error comes back with its line. `from build123d import *` is added to an empty session. End a chunk '
      + 'with show(obj, ...) when it should change what is displayed: the last show() wins (earlier one-line '
      + 'show calls are commented out). print() output is returned. Units are millimetres.',
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
    description: 'Render the session\'s shapes to a PNG (shaded, edges drawn, axis triad, size label) from a '
      + 'named view or an azimuth/elevation, or to an SVG hidden-line drawing (format "svg"). Look at every '
      + 'feature you add from at least two views.',
    inputSchema: { type: 'object', properties: {
      session,
      view: { type: 'string', enum: VIEW_NAMES, description: 'Named view (default iso).' },
      azimuth: { type: 'number', description: 'Degrees; 0 looks from the front (-Y), 90 from the right (+X). Overrides view.' },
      elevation: { type: 'number', description: 'Degrees; 90 looks straight down. Overrides view.' },
      width: { type: 'integer', minimum: 128, maximum: 1600, description: 'Pixels (default 800).' },
      height: { type: 'integer', minimum: 128, maximum: 1200, description: 'Pixels (default 600).' },
      shapes: { type: 'array', items: { type: 'integer' }, description: 'Only these shapes (indices from measure).' },
      highlight: { type: 'array', items: { type: 'integer' }, description: 'Draw these shapes in orange.' },
      edges: { type: 'boolean', description: 'Draw the model edges (default true).' },
      format: { type: 'string', enum: ['png', 'svg'], description: 'png (default) or an svg hidden-line drawing.' },
      hidden: { type: 'boolean', description: 'svg: draw hidden lines dashed (default true).' },
    }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'measure',
    title: 'Measure the shapes',
    description: 'Per shape: type, solids/faces/edges/vertices, volume (mm^3), area (mm^2), bounding box, centre '
      + 'of mass, validity; with a density (g/cm^3) also the mass in grams.',
    inputSchema: { type: 'object', properties: { session,
      shape: { type: 'integer', description: 'Only this shape index.' },
      density: { type: 'number', description: 'g/cm^3, e.g. 1.24 for PLA, 2.7 for aluminium.' } }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'validate',
    title: 'Check before export',
    description: 'PASS/FAIL with reasons: every shape valid to OpenCascade (BRepCheck), solids closed with positive '
      + 'volume, nothing empty; warnings for disjoint solids and shapes with no solid.',
    inputSchema: { type: 'object', properties: { session }, required: ['session'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'export',
    title: 'Export a file',
    description: 'Export the session\'s shapes and return a download URL (kept for an hour). step and brep are '
      + 'exact; stl is a mesh for printing; glb is a mesh for viewers (metres, Y up); svg is a hidden-line drawing.',
    inputSchema: { type: 'object', properties: { session,
      format: { type: 'string', enum: ['step', 'stl', 'brep', 'glb', 'svg'] },
      filename: { type: 'string', description: 'Base name without extension (default "model").' },
      view: { type: 'string', enum: VIEW_NAMES, description: 'svg only: the drawing view (default iso).' } },
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
    description: 'Save the current script under a name, to come back to with restore_snapshot.',
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

export const INSTRUCTIONS = `Remote build123d CAD: build123d (the "lite" port) on OpenCascade, evaluated in a server-side session, so no local Python is needed.

Loop: execute (or set_script) -> render_view (look, from two views) -> measure / validate -> fix -> export -> open_in_editor to hand the model to a person.
- A session keeps one script. execute appends and rolls back on error; set_script replaces. Re-runs are cheap: unchanged operations come from a cache.
- show(a, b, ...) at the END of the script decides what is displayed, measured and exported (without it, every shape the script made is shown, sketches included). Units are millimetres, Z is up.
- Carry the session id from the first reply into every later call.
- workflow_hints has the full guide and the supported API.`;

export const WORKFLOW = `# Working with remote build123d sessions

## The loop
1. Plan the part: overall size, the main body, then features (holes, fillets, chamfers, cut-outs). Write the key dimensions as variables at the top.
2. Build it in steps with execute: one feature per call. A failing step is rolled back, so the session always holds the last working model.
3. Look after every feature: render_view from "iso" plus one orthographic view ("front", "top" or "right") that shows the feature. Check the size label against your intent.
4. Measure what matters: measure gives the bounding box, volume, centre of mass; compare with the plan. validate before exporting.
5. Fix errors with last_error (it shows the failing line in context). Common causes: a selector that picked nothing (print the selection first), a fillet radius larger than the adjacent edges allow, booleans between shapes that do not touch.
6. save_snapshot before a risky change; restore_snapshot to go back.
7. export: step for CAD, stl for printing, glb for viewers, svg for a drawing. Give the person open_in_editor's link so they can see and tweak the model; their edits appear in session_state/get_script.

## Writing build123d here
- Algebra mode: part = Box(80, 60, 8); part -= Pos(0, 0, 4) * Cylinder(10, 20); part = fillet(part.edges().filter_by(Axis.Z), 3)
- Builder mode: with BuildPart() as p: Box(...); with Locations(...): Hole(...)
- Selectors: edges()/faces()/vertices()/solids() with filter_by(Axis.Z | GeomType.CIRCLE | Plane.XY), sort_by(Axis.Z), group_by(Axis.Z)[-1], slicing.
- Placement: Pos(x, y, z) * shape, Rot(rx, ry, rz) * shape, Locations, GridLocations, PolarLocations, Plane.XZ * sketch.
- 2-D: BuildSketch / Rectangle, Circle, RegularPolygon, Polygon, SlotOverall, Text; then extrude, revolve, loft, sweep.
- Ops: fillet, chamfer, offset, mirror, split, extrude(taper=), revolve, loft, sweep, section, project, thicken, make_hull.
- show(a, b, ...) displays several shapes; measure/render_view index them in that order. Call it once, after the last shape is built: shapes created after a show() are added to the scene as well. With execute, a chunk that calls show() supersedes earlier show() lines.

## What is not available
numpy and other third-party packages, the drafting module (Draft, DimensionLine, TechnicalDrawing), 3MF output, import_svg/import_stl. File I/O happens through export, not open().

## Reading the renders
Shaded grey with dark edges; highlighted shapes are orange. The triad at the bottom left shows X (red), Y (green), Z (blue); the label shows the view and the overall size in mm. Orthographic, so parallel edges stay parallel.`;

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
  { uri: 'build123d://quickref', name: 'quickref', title: 'build123d quick reference', mimeType: 'text/markdown',
    description: 'Short examples of the common build123d calls.' },
];

export const QUICKREF = `# build123d quick reference (remote sessions)

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

# what to display, measure and export: once, at the end
show(Pos(-100, 0, 0) * plate, bracket.part, Pos(100, 0, 0) * knob)
\`\`\`

Selectors: \`part.edges().filter_by(Axis.Z)\`, \`.filter_by(GeomType.CIRCLE)\`, \`.sort_by(Axis.Z)[-1]\`, \`.group_by(Axis.Z)[0]\`, \`part.faces().sort_by(Axis.Z)[-1]\` (top face).
Placement: \`Pos(x, y, z) * s\`, \`Rot(0, 0, 45) * s\`, \`Plane.XZ * sketch\`, \`PolarLocations(20, 6)\`.
Measure in code: \`part.volume\`, \`part.area\`, \`part.bounding_box().size\`, \`print(...)\` (returned by execute).`;
