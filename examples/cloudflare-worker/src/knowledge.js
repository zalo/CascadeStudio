// knowledge.js — the build123d reference resources this MCP server serves
// (build123d://quickref, build123d://selectors).
//
// Adapted from build123d-mcp (github.com/pzfreo/build123d-mcp @59b2561,
// src/build123d_mcp/quickref.py and selectors_cookbook.py, Apache-2.0,
// Paul Fremantle and contributors; see third_party/build123d-mcp/LICENSE);
// modified for CascadeStudio: build123d-lite's coverage, this server's
// conventions (session script, named show(), the `result` fallback), the
// version banners dropped, one duplicated pitfall removed. Sections with
// a label are runnable: scripts/mcp-test.mjs runs every one of them
// through the server and fails on an error.

/** @type {{label: string|null, text: string}[]} */
export const QUICKREF_SECTIONS = [
 {
  "label": null,
  "text": "BUILD123D QUICK REFERENCE (build123d-lite on this server) — all measurements in mm\n===================================================================================="
 },
 {
  "label": "pattern1",
  "text": "## Pattern 1: algebra mode (functional composition with operators)\n# Use for: one-off shapes, quick composition, when you don't need selectors\n# during construction. Each statement returns a new shape.\nfrom build123d import *\nresult = Box(20, 10, 5)\nresult = result - Cylinder(3, 6).move(Location((0, 0, 0)))\nshow(result, \"part\")"
 },
 {
  "label": "pattern2",
  "text": "## Pattern 2: builder mode (BuildPart context manager)\n# Use for: multi-step parts, anywhere you need extrude/revolve/loft/fillet,\n# or when you want Select.LAST to grab just-added geometry.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 10, 5)\n    Cylinder(3, 6, mode=Mode.SUBTRACT)   # cut hole\nresult = p.part\nshow(result, \"part\")"
 },
 {
  "label": "design_state",
  "text": "## Pattern 3: design-state authoring (a design to EDIT, not a shape to render)\n# Author for editability, not just a valid shape (Arko-T): put named parameters\n# WITH UNITS at the top, then build in a consistent order — base -> secondary\n# features -> finishing. An edit is then a number change here, not a hunt for\n# inline literals; prefer expressions/references over hand-computed coordinates.\n# Run design_audit() to confirm each parameter survives a +/-10% nudge (a small\n# change that collapses the solid or fails the validity gate is a brittle design).\nfrom build123d import *\n\n# --- parameters (mm) ---\nwidth = 60.0\ndepth = 40.0\nheight = 8.0\nbore_d = 10.0\nfillet_r = 3.0\n\nwith BuildPart() as p:\n    Box(width, depth, height)                         # base\n    Cylinder(bore_d / 2, height, mode=Mode.SUBTRACT)  # secondary feature\n    fillet(p.edges().filter_by(Axis.Z), radius=fillet_r)  # finishing\nresult = p.part\nshow(result, \"part\")"
 },
 {
  "label": null,
  "text": "## Primitives\nBox(length, width, height)              # centred at origin\nCylinder(radius, height)\nSphere(radius)\nCone(bottom_radius, top_radius, height)\nTorus(major_radius, minor_radius)"
 },
 {
  "label": null,
  "text": "## Boolean operators (direct algebra)\na + b    # union\na - b    # cut b from a\na & b    # intersection"
 },
 {
  "label": null,
  "text": "## Boolean modes (inside BuildPart)\nmode=Mode.ADD        # default — union with existing solid\nmode=Mode.SUBTRACT   # cut from existing solid\nmode=Mode.INTERSECT  # keep overlap only\nmode=Mode.REPLACE    # replace current solid entirely"
 },
 {
  "label": "align",
  "text": "## Positioning\n# Alignment — corner vs centred\nfrom build123d import *\ncorner = Box(10, 5, 3, align=(Align.MIN, Align.MIN, Align.MIN))        # corner at origin\nresult = Box(10, 5, 3, align=(Align.CENTER, Align.CENTER, Align.MIN))  # centred XY, bottom at Z=0"
 },
 {
  "label": "translate",
  "text": "# Translate (and optionally rotate)\nfrom build123d import *\nshape = Box(10, 5, 3)\nresult = shape.move(Location((5, 0, 0)))\nrotated = shape.move(Location((5, 0, 0), (0, 0, 45)))"
 },
 {
  "label": "extrude",
  "text": "## Sketch → solid (requires BuildPart)\n# Extrude\nfrom build123d import *\nwith BuildPart() as p:\n    with BuildSketch() as sk:            # default plane: XY\n        Circle(10)\n        Rectangle(6, 6, mode=Mode.SUBTRACT)   # cutout in sketch\n    extrude(amount=15)\nresult = p.part"
 },
 {
  "label": "revolve",
  "text": "# Revolve — profile in Plane.XZ, offset from axis\nfrom build123d import *\nwith BuildPart() as p:\n    with BuildSketch(Plane.XZ) as sk:\n        with Locations((12, 0)):\n            Rectangle(4, 8)\n    revolve(axis=Axis.Z)                 # full 360°\nresult = p.part"
 },
 {
  "label": "selectors",
  "text": "## Selecting edges and faces\nfrom build123d import *\nresult = Box(20, 10, 5)\ntop_face    = result.faces().sort_by(Axis.Z)[-1]        # highest-Z face\nbottom_face = result.faces().sort_by(Axis.Z)[0]         # lowest-Z face\ntop_edges   = result.edges().sort_by(Axis.Z)[-4:]       # 4 edges at highest Z (for fillet)\nz_edges     = result.edges().filter_by(Axis.Z)          # edges parallel to Z\nflat_faces  = result.faces().filter_by(GeomType.PLANE)  # planar faces only"
 },
 {
  "label": "fillet_chamfer",
  "text": "## Fillets and chamfers (inside BuildPart only)\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 10, 5)\n    fillet(p.part.edges().sort_by(Axis.Z)[-4:], radius=1)\nresult = p.part\n\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 10, 5)\n    chamfer(p.part.edges().sort_by(Axis.Z)[-4:], length=0.5)\nresult = p.part"
 },
 {
  "label": "joints_rigid",
  "text": "## Joints — assembly relationships\n# Joints express how parts CONNECT, not just where they happen to sit. Move the\n# parent, the child follows. Reach for joints when building assemblies — they\n# scale better than raw .move() because the relationship survives changes.\nfrom build123d import *\nplate = Box(20, 20, 5)\nRigidJoint(\"mount\", to_part=plate, joint_location=Location((0, 0, 2.5)))\n\npin = Box(2, 2, 10)\nRigidJoint(\"base\", to_part=pin, joint_location=Location((0, 0, -5)))\n\n# Snap pin's \"base\" joint to plate's \"mount\" joint. pin is now positioned\n# so its joint coincides with the plate's. Move plate later → pin follows.\nplate.joints[\"mount\"].connect_to(pin.joints[\"base\"])\nshow(plate, \"plate\")\nshow(pin, \"pin\")"
 },
 {
  "label": null,
  "text": "## Joint types\nRigidJoint(label, to_part, joint_location)              # fixed (no DOF)\nRevoluteJoint(label, to_part, axis, angular_range)      # hinge (1 rotation)\nLinearJoint(label, to_part, axis, linear_range)         # slider (1 translation)\nCylindricalJoint(label, to_part, axis, ...)             # rotate + translate same axis\nBallJoint(label, to_part, joint_location, angular_range) # 3 rotations, 0 translations\n\n# For movable joints, pass position/angle to connect_to() to set the configuration:\n#   plate.joints[\"hinge\"].connect_to(arm.joints[\"pivot\"], angle=45)\n#   rail.joints[\"slot\"].connect_to(carriage.joints[\"slide\"], position=10)"
 },
 {
  "label": "grid_locations",
  "text": "## Pattern placement: GridLocations — N×M array of features\n# Inside a BuildPart, GridLocations(x_spacing, y_spacing, x_count, y_count)\n# acts as a context that places every operation inside it at every grid point.\n# This is the idiomatic \"4 holes in a 2x2 grid\" — never write a manual for loop.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(40, 40, 5)\n    with GridLocations(20, 20, 2, 2):\n        Hole(radius=2, depth=5)\nresult = p.part\nshow(result, \"plate_with_grid_holes\")"
 },
 {
  "label": "polar_locations",
  "text": "## Pattern placement: PolarLocations — radial arrays (bolt circles)\n# PolarLocations(radius, count, start_angle=0, angular_range=360) places features\n# evenly around a circle. Each item is also rotated to match its angular position.\nfrom build123d import *\nwith BuildPart() as p:\n    Cylinder(20, 5)\n    with PolarLocations(15, 6):  # 6 holes evenly around radius 15\n        Hole(radius=1.5, depth=5)\nresult = p.part\nshow(result, \"flange\")"
 },
 {
  "label": "manual_locations",
  "text": "## Pattern placement: Locations — explicit coordinate list\n# When the placements aren't a regular array, list them. Each tuple is (x, y, z).\n# Locations also accepts Location objects for full position+rotation control.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(40, 20, 5)\n    with Locations((10, 5, 0), (-10, -5, 0), (0, 0, 0)):\n        Hole(radius=1, depth=5)\nresult = p.part\nshow(result, \"plate_with_3_holes\")"
 },
 {
  "label": "position_tangent_at",
  "text": "## Chaining curves with @ (position) and % (tangent)\n# `edge @ t` returns the position at parameter t (0..1 along the edge).\n# `edge % t` returns the tangent direction at t. Use these to build the next\n# curve from the previous one's endpoint+direction without repeating coordinates.\nfrom build123d import *\nwith BuildLine() as l:\n    l1 = Line((0, 0), (10, 0))\n    l2 = JernArc(start=l1 @ 1, tangent=l1 % 1, radius=5, arc_size=90)\n    l3 = Line(l2 @ 1, (l2 @ 1) + (10, 0))\nresult = l.line\nshow(result, \"chained_path\")"
 },
 {
  "label": "op_sweep",
  "text": "## sweep — drag a profile along a path\n# Use for tubing, mouldings, anything with constant cross-section along a curve.\nfrom build123d import *\nwith BuildLine() as path:\n    Line((0, 0, 0), (0, 0, 20))\nwith BuildSketch() as profile:\n    Circle(2)\nresult = sweep(profile.sketch, path=path.line)\nshow(result, \"tube\")"
 },
 {
  "label": "op_loft",
  "text": "## loft — bridge between two or more profiles\n# Each BuildSketch becomes a section; loft() connects them in order. Profiles\n# can differ in shape (rectangle to circle = transition piece).\nfrom build123d import *\nwith BuildPart() as p:\n    with BuildSketch(Plane.XY) as bottom:\n        Rectangle(20, 20)\n    with BuildSketch(Plane.XY.offset(20)) as top:\n        Circle(5)\n    loft()\nresult = p.part\nshow(result, \"transition\")"
 },
 {
  "label": "op_mirror",
  "text": "## mirror — reflect a shape across a plane\n# Build half a symmetric part, then mirror. Faster and less error-prone than\n# building both halves. mirror() does not union — combine with + or BuildPart.\nfrom build123d import *\nhalf = Box(10, 5, 3).move(Location((5, 0, 0)))   # off-centre half\nresult = half + mirror(half, about=Plane.YZ)\nshow(result, \"symmetric\")"
 },
 {
  "label": "op_offset",
  "text": "## offset — inset/outset a sketch or shell a solid\n# In BuildSketch, offset(amount=...) grows or shrinks the boundary.\n# On a 3D shape, offset_3d / shell creates a hollow version (walls of thickness).\nfrom build123d import *\nwith BuildSketch() as s:\n    Rectangle(10, 10)\n    offset(amount=2)            # +2 outward; negative inward\nresult = thicken(s.sketch, amount=1)   # turn into a 3D shell-base\nshow(result, \"offset_plate\")"
 },
 {
  "label": "op_thicken",
  "text": "## thicken — turn a 2D face into a solid by adding thickness\n# Common for shell parts where you sketch the surface and add wall thickness.\nfrom build123d import *\nsketch = Rectangle(20, 10)\nresult = thicken(sketch, amount=3)\nshow(result, \"thickened_plate\")"
 },
 {
  "label": "mode_private",
  "text": "## Mode.PRIVATE — helper geometry that doesn't join the part\n# Useful for construction shapes you want to reference (e.g. for selectors\n# or measurements) without their volume contributing to the final part.\n# Default Mode.ADD unions; Mode.SUBTRACT cuts; Mode.PRIVATE does neither.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 20, 5)\n    helper = Cylinder(3, 5, mode=Mode.PRIVATE)   # for reference only\n    # `helper` exists as a Solid you can query; p.part doesn't include it\nresult = p.part\nshow(result, \"part_unchanged_by_private\")"
 },
 {
  "label": null,
  "text": "## New in build123d 0.11\nbuild123d-lite on this server has these (it is validated against build123d 0.11.1)."
 },
 {
  "label": "convexpolyhedron",
  "text": "## ConvexPolyhedron — solid convex hull of a point set\n# Use for: wrapping a cloud of points into a solid, simplified collision/clearance\n# bodies, quick \"envelope\" shapes.\nfrom build123d import *\nresult = ConvexPolyhedron([(0, 0, 0), (20, 0, 0), (0, 20, 0), (0, 0, 20), (6, 6, 6)])\nshow(result, \"hull\")"
 },
 {
  "label": "bspline",
  "text": "## BSpline — exact spline edge from control points + knots\n# Use for: precise freeform curves where Spline (interpolating through points) is\n# not exact enough. The result is an Edge — sweep/extrude/revolve it into a face\n# or solid as needed.\nfrom build123d import *\nresult = BSpline([(0, 0), (5, 8), (10, 0)], knots=[0, 0, 0, 1, 1, 1], degree=2)\nshow(result, \"spline_edge\")"
 },
 {
  "label": "constrainedarcs",
  "text": "## ConstrainedArcs / ConstrainedLines — sketch geometry solved against other geometry\n# Use for: arcs/lines defined by tangency or constraints to existing edges, the way\n# a parametric sketcher solves them. The result is a Curve of one or more Edges —\n# pick the one you want with .edges() plus a selector.\nfrom build123d import *\nl4 = PolarLine((0, 0), 4, 60)\nl5 = PolarLine((0, 0), 4, 40)\na3 = CenterArc((0, 0), 4, 0, 90)\nresult = ConstrainedArcs(l4, l5, a3, sagitta=Sagitta.BOTH).edges().sort_by(Edge.length)[0]\nshow(result, \"constrained_arc\")"
 },
 {
  "label": null,
  "text": "## Also in 0.11 (see build123d's docs/CHANGELOG for details)\n- ParabolicCenterArc / HyperbolicCenterArc — conic-section arcs.\n- Broader, more robust intersection support (the `&` operator) across 1D/2D/3D and\n  composite shapes.\n- Not here: single-line (engraving) fonts — this server bundles only the FreeSans\n  outline font."
 },
 {
  "label": null,
  "text": "## Server conventions (this MCP server)\n- ONE script per session: execute appends code and re-runs the whole script (unchanged\n  operations are cached); set_script replaces it; get_script shows it with line numbers.\n- The scene is what show() registers. show(part, \"part\") names it — tools take the name\n  as object_name (or the shape's index). A name shown again replaces its shape; a named\n  list shows its members as name[0], name[1], ... Unnamed show(a, b) shows both.\n- No show() at all: a top-level `result` is shown as \"result\"; otherwise every shape the\n  script made is shown, sketches included.\n- named_face(shape, \"top\") returns the highest-Z face; also bottom/front/back/left/right\n  (front = the -Y face, like build123d's Plane.FRONT and the front render view).\n- find_edges(shape, geom=\"circle\", radius=4.25, at_z=10.2) filters edges for fillet/chamfer;\n  prints count + radii + Z levels.\n- After a change, execute reports each shown shape's volume / face-count / bbox deltas\n  and warns when a boolean changed nothing."
 },
 {
  "label": null,
  "text": "## Common gotchas\n- After every -, +, & : read execute's change line (or measure()) — a failed boolean leaves the counts unchanged\n- fillet/chamfer radius too large → OCC kernel exception; reduce radius or select fewer edges\n- Cylinder/Sphere are centred at origin; use .move() or align= to reposition\n- Locations() inside BuildPart shifts the construction origin — it does NOT move the whole part\n- Pass p.part (the Shape) to show(), not p (the BuildPart context)\n- revolve() needs the profile offset from the revolution axis — a profile touching the axis produces a solid, one crossing it fails\n- Not available here: numpy and other packages, the drafting module (Draft, DimensionLine,\n  TechnicalDrawing), 3MF, import_svg/import_stl, files (open()). Files come from export."
 }
];

/** @type {{label: string|null, text: string}[]} */
export const SELECTORS_SECTIONS = [
 {
  "label": null,
  "text": "BUILD123D SELECTORS COOKBOOK\n============================\nTask-indexed reference for picking faces, edges, and vertices.\nUse the explicit form (.sort_by/.filter_by); the operator shortcuts\n(>, <, |, etc.) are summarised at the end.\n\nCanonical idiom from build123d's own FAQ: select from higher up\nin the topology first, then drill down. Find the parent face,\nthen ask the face for its edges. Avoids brittle global queries."
 },
 {
  "label": "drilldown",
  "text": "## Drill-down idiom — find the parent, then its features\n# This is THE canonical pattern. Filleting a hole? Find the hole's face\n# first, then get its edges. Don't try to select a specific edge globally.\nfrom build123d import *\nplate = Box(40, 40, 5) - Cylinder(3, 5).move(Location((0, 0, 0)))\ntop_face = plate.faces().sort_by(Axis.Z)[-1]\nhole_edges = top_face.edges().filter_by(GeomType.CIRCLE)\nprint(f\"top face area: {top_face.area:.1f}, hole edges: {len(hole_edges)}\")\nresult = plate"
 },
 {
  "label": "cardinal_faces",
  "text": "## Cardinal faces — top/bottom/left/right by axis sort\n# named_face(shape, \"top\") wraps the same chain. The raw form gives you\n# fine control (e.g. multiple faces, custom axes).\nfrom build123d import *\nplate = Box(20, 30, 5)\ntop    = plate.faces().sort_by(Axis.Z)[-1]   # highest Z\nbottom = plate.faces().sort_by(Axis.Z)[0]    # lowest Z\nright  = plate.faces().sort_by(Axis.X)[-1]   # highest X\nprint(f\"top={top.area}, bottom={bottom.area}, right={right.area}\")\nresult = plate"
 },
 {
  "label": "by_geom_type_edges",
  "text": "## Edges by geometric type — circles, lines, splines\n# Edge GeomType: LINE, CIRCLE, ELLIPSE, BEZIER, BSPLINE, HYPERBOLA, PARABOLA, OFFSET, OTHER.\nfrom build123d import *\nplate = Box(40, 40, 5) - Cylinder(3, 5).move(Location((0, 0, 0)))\ncircles = plate.edges().filter_by(GeomType.CIRCLE)\nlines   = plate.edges().filter_by(GeomType.LINE)\nprint(f\"circles: {len(circles)}, lines: {len(lines)}\")\nresult = plate"
 },
 {
  "label": "by_geom_type_faces",
  "text": "## Faces by geometric type — planes, cylinders, spheres\n# Face GeomType: PLANE, CYLINDER, CONE, SPHERE, TORUS, BEZIER, BSPLINE, REVOLUTION, EXTRUSION, OFFSET, OTHER.\n# A counterbore = a cylindrical face. Cylinder hole walls are CYLINDER faces.\nfrom build123d import *\npart = Box(40, 40, 10) - Cylinder(5, 10).move(Location((0, 0, 0)))\ncylinders = part.faces().filter_by(GeomType.CYLINDER)\nplanes    = part.faces().filter_by(GeomType.PLANE)\nprint(f\"cylindrical faces (hole walls): {len(cylinders)}, planar: {len(planes)}\")\nresult = part"
 },
 {
  "label": "parallel_perpendicular",
  "text": "## Faces parallel to a plane / perpendicular to an axis\n# filter_by(Plane.XY) → faces parallel to the XY plane (normals along Z).\n# filter_by(Axis.X)   → faces perpendicular to X axis (normals along X).\nfrom build123d import *\npart = Box(20, 20, 5)\nhorizontal = part.faces().filter_by(Plane.XY)  # 2 faces: top + bottom\nside_x     = part.faces().filter_by(Axis.X)    # 2 faces: +X and -X\nprint(f\"horizontal: {len(horizontal)}, perpendicular to X: {len(side_x)}\")\nresult = part"
 },
 {
  "label": "largest_face",
  "text": "## Largest face by area / longest edge by length\n# Use SortBy.AREA, SortBy.LENGTH, SortBy.RADIUS, SortBy.VOLUME, SortBy.DISTANCE.\nfrom build123d import *\npart = Box(40, 20, 10)\nlargest_face = part.faces().sort_by(SortBy.AREA)[-1]\nlongest_edge = part.edges().sort_by(SortBy.LENGTH)[-1]\nprint(f\"largest face area: {largest_face.area}, longest edge: {longest_edge.length}\")\nresult = part"
 },
 {
  "label": "lambda_filter",
  "text": "## Filter by arbitrary property — use a lambda\n# Any boolean expression on the entity. Floats: compare with a tolerance.\nfrom build123d import *\npart = Box(40, 20, 10)\ntwenty_long = part.edges().filter_by(lambda e: abs(e.length - 20) < 1e-3)\nprint(f\"edges ~20mm long: {len(twenty_long)}\")\nresult = part"
 },
 {
  "label": "circles_by_radius",
  "text": "## Circles of a specific radius — combine GeomType with lambda\n# Filtering circular edges first lets the lambda assume .radius exists.\nfrom build123d import *\nplate = (Box(40, 40, 5)\n         - Cylinder(3, 5).move(Location((10, 10, 0)))\n         - Cylinder(5, 5).move(Location((-10, -10, 0))))\nr3 = plate.edges().filter_by(GeomType.CIRCLE).filter_by(lambda e: abs(e.radius - 3) < 1e-3)\nprint(f\"3mm circles: {len(r3)}\")\nresult = plate"
 },
 {
  "label": "select_last_in_builder",
  "text": "## Select.LAST — only the geometry from the most recent operation\n# Inside BuildPart, `p.edges(Select.LAST)` returns just the edges that the\n# last operation produced. Critical when you want to fillet only the\n# freshly-cut hole, not every edge in the part.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 20, 10)\n    Cylinder(3, 10, mode=Mode.SUBTRACT)\n    new = p.edges(Select.LAST)\n    print(f\"edges from cylinder cut: {len(new)}\")\n    fillet(new.filter_by(GeomType.CIRCLE), radius=0.5)\nresult = p.part"
 },
 {
  "label": "select_modes",
  "text": "## Select.ALL vs Select.LAST vs Select.NEW\n# Select.ALL  = every edge/face in the part (default if omitted)\n# Select.LAST = entities produced by the most recent operation\n# Select.NEW  = entities created (not just touched) by the most recent op\n# Select.LAST is the workhorse; ALL is the explicit default; NEW is narrower\n# than LAST and depends on operation semantics.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 20, 10)\n    Cylinder(3, 10, mode=Mode.SUBTRACT)\n    print(f\"ALL: {len(p.edges(Select.ALL))}, LAST: {len(p.edges(Select.LAST))}\")\nresult = p.part"
 },
 {
  "label": "chain_filters",
  "text": "## Chain filters — narrow progressively\n# Each .filter_by() reduces the ShapeList. Order doesn't affect correctness,\n# but cheap filters first (GeomType) before expensive ones (lambda) is faster.\nfrom build123d import *\npart = Box(20, 20, 10) - Cylinder(3, 10).move(Location((0, 0, 0)))\nsmall_circles = part.edges().filter_by(GeomType.CIRCLE).filter_by(lambda e: e.radius < 5)\nprint(f\"small circles: {len(small_circles)}\")\nresult = part"
 },
 {
  "label": "sort_then_slice",
  "text": "## Sort then slice — \"the N largest/smallest\"\n# sort_by returns a ShapeList; standard Python slicing applies.\n# [-2:] = last two (largest), [:2] = first two (smallest), [-1] = single largest.\nfrom build123d import *\nplate = (Box(40, 40, 5)\n         - Cylinder(2, 5).move(Location((10, 10, 0)))\n         - Cylinder(3, 5).move(Location((-10, 10, 0)))\n         - Cylinder(4, 5).move(Location((0, -10, 0))))\ntwo_biggest = plate.edges().filter_by(GeomType.CIRCLE).sort_by(SortBy.RADIUS)[-2:]\nprint(f\"two biggest circles, radii: {sorted(e.radius for e in two_biggest)}\")\nresult = plate"
 },
 {
  "label": "convex_fillets",
  "text": "## Detect outer fillets — Face.is_circular_convex\n# After filleting outer edges, the rounded corners are convex circular faces.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 20, 10)\n    fillet(p.part.edges().filter_by(Axis.Z), radius=2)\nresult = p.part\nouter_fillets = result.faces().filter_by(Face.is_circular_convex)\nprint(f\"outer fillet faces: {len(outer_fillets)}\")"
 },
 {
  "label": "concave_fillets",
  "text": "## Detect hole walls / inner fillets — Face.is_circular_concave\n# Cylindrical hole walls are concave from outside. Useful for finding all\n# holes regardless of size.\nfrom build123d import *\nwith BuildPart() as p:\n    Box(20, 20, 10)\n    Cylinder(5, 10, mode=Mode.SUBTRACT)\nresult = p.part\nhole_walls = result.faces().filter_by(Face.is_circular_concave)\nprint(f\"concave circular faces (hole walls): {len(hole_walls)}\")"
 },
 {
  "label": "inner_wires_count",
  "text": "## Faces with N holes — filter by inner_wires count\n# Inner wires represent holes/recesses cut into a face. Use to locate\n# \"the face that has the 4-bolt pattern\" or similar.\nfrom build123d import *\nplate = (Box(40, 40, 5)\n         - Cylinder(2, 5).move(Location((-10, -10, 0)))\n         - Cylinder(2, 5).move(Location((10, -10, 0)))\n         - Cylinder(2, 5).move(Location((-10, 10, 0)))\n         - Cylinder(2, 5).move(Location((10, 10, 0))))\ntop = plate.faces().sort_by(Axis.Z)[-1]\nprint(f\"top face inner wires (holes): {len(top.inner_wires())}\")\nfaces_with_4_holes = plate.faces().filter_by(lambda f: len(f.inner_wires()) == 4)\nprint(f\"faces with 4 holes: {len(faces_with_4_holes)}\")\nresult = plate"
 },
 {
  "label": null,
  "text": "## Operator shortcuts — terse but harder to read\n# build123d overloads operators on ShapeList. The explicit forms above are\n# usually clearer; these shortcuts appear in community examples.\n#\n#   selector | criterion       →  selector.filter_by(criterion)\n#   selector > criterion       →  selector.sort_by(criterion)        # ascending\n#   selector < criterion       →  selector.sort_by(criterion, reverse=True)\n#   selector >> criterion      →  selector.group_by(criterion)[-1]   # last group\n#   selector << criterion      →  selector.group_by(criterion)[0]    # first group\n#   selector @ Axis.X          →  filter by position along axis\n#\n# Example translation:\n#   part.faces() > Axis.Z                # = sort_by(Axis.Z), ascending\n#   part.faces() | GeomType.CYLINDER     # = filter_by(GeomType.CYLINDER)\n#   part.edges() | GeomType.CIRCLE | (lambda e: e.radius < 5)\n#                                        # = chained filter_by"
 },
 {
  "label": null,
  "text": "## Common pitfalls\n# 1. Sketch on a non-default plane breaks global axis sort.\n#    BuildSketch(Plane.XZ) creates the sketch in local coords (XY of that plane).\n#    Sorting by global Axis.Z gives random results because every sketch point\n#    has Z=0 in local space. Use the local-axis equivalent (Axis.Y for XZ).\n#\n# 2. \"Order is not guaranteed\" — never index unsorted ShapeLists.\n#    part.edges()[5] returns A edge, but which one isn't stable across runs\n#    or operations. Always .sort_by(...) before slicing if order matters.\n#\n# 3. Select.NEW is narrower than Select.LAST.\n#    For some operations they return the same set; for others NEW excludes\n#    edges that existed before but were touched. When in doubt, use LAST.\n#\n# 4. lambda comparing floats with == fails for computed values.\n#    e.length == 20 is unreliable; use abs(e.length - 20) < 1e-3."
 }
];

const join = (sections) => sections.map((s) => s.text).join('\n\n');
export const QUICKREF = join(QUICKREF_SECTIONS);
export const SELECTORS = 'Examples below run on build123d-lite, this server\'s port of build123d.\n\n'
  + join(SELECTORS_SECTIONS);

/** [label, code] for every runnable section (the tests run them all). */
export const RUNNABLE_EXAMPLES = QUICKREF_SECTIONS.concat(SELECTORS_SECTIONS)
  .filter((s) => s.label).map((s) => [s.label, s.text]);
