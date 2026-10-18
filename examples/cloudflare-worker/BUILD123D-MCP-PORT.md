# Porting build123d-mcp's harness to the serverless MCP endpoint

[build123d-mcp](https://github.com/pzfreo/build123d-mcp) (Paul Fremantle, Apache-2.0; read at `59b2561`) is a local MCP server. It runs real build123d in a Python worker process, with an AST sandbox and subprocesses that bound the expensive operations. Its value is in what it wraps around build123d:
- **Guidance:** a quick reference and a selectors cookbook.
- **Checks:** a validity gate before export, and change diagnostics after every step.
- **Verification by numbers:** clearance, alignment, a face inventory, a selector resolver, and a parameter audit.

This document records what of that runs here, on the session Durable Object ([MCP.md](MCP.md)), and what is left. Attribution and the license are in [`third_party/build123d-mcp/`](third_party/build123d-mcp/).

## How the two models differ

| | build123d-mcp | here |
|---|---|---|
| state | a live Python namespace per session; `execute` adds to it | the session **script**; every call re-runs it, which is cheap because unchanged operations are hits in the stable op cache |
| isolation | AST checks, an import allow-list, worker subprocesses | MicroPython in wasm in a Worker: no filesystem, no network, no subprocess to escape to |
| budgets | killable subprocesses | wall-clock budgets inside the call (`design_audit`, the overlap sweep) under the Worker's CPU limit |
| objects | `show(shape, "name")` registers into `session.objects` | the same call, in build123d-lite: names travel with the scene, tools take `object_name` |
| snapshots | copies of the live shapes | copies of the script, plus a summary of its objects for `compare(kind="snapshot")` |

**Named `show()` in build123d-lite.** `show(part, "part")` names the shape before it, and `names=[...]` names shapes in order. A named list shows its members as `name[0]`, `name[1]`, … Showing a name again replaces its shape, and the object keeps its index: named shapes are ordered by when their name was first shown. With no `show()` at all, a top-level `result` is shown, which is build123d-mcp's convention; the session appends `show(result, "result")` after the last line, so line numbers don't move. `named_face` and `find_edges`, build123d-mcp's session helpers, are in lite too. `named_face`'s *front* is the −Y face, as in build123d's `Plane.FRONT` and the front render; build123d-mcp's own helper takes +Y.

## Tools: wave 1 (#202)

| build123d-mcp | here | notes |
|---|---|---|
| `execute` | `execute` | Rollback and line mapping as before. Added: a change line per shown object (volume, faces, solids, size), a warning when code ran but no shown shape changed (a boolean that missed), a warning when a shape lost its volume, and repair hints on errors. |
| `measure` | `measure` | Added: `object_name`; `material` presets; for up to four objects the face inventory (collapsed, slivers folded) and the inertia tensor. With a density or material, the mass and inertia in g·mm². |
| `validate` | `validate` | The B-rep gate: BRepCheck; the edge→face map (open and non-manifold edges, degenerated edges skipped); a sketch or surface FAILs; overlapping solids inside an object FAIL. Separate objects that interpenetrate get a warning. `object_name`. |
| `locate_gate_defects` | `locate_gate_defects` | Edge midpoints with face counts, overlap pairs with their volume, BRepCheck and no-solid entries, each with a hint. |
| `compare` | `compare` | `fit` (BRepExtrema distance, Cut/Common volumes, apart/touching/containing/interpenetrating); `align` (flush, center, clearance); `shape` (deltas plus the exact volume added and removed); `snapshot` (per object, from the summaries). |
| `resolve` | `resolve` | A probe run: the script plus one appended line evaluating the selector on the object. Same descriptor: arc centre, area centroid, normal, axis and radius, count. Labels are kept in `session_state`. |
| `design_audit` | `design_audit` | Same parameter rules and verdict taxonomy. Extras: tuple assignments (`a, b = 10, 20`); the rewrite keeps line numbers; variants run in-process under `AUDIT_BUDGET_MS` (30 s), and cached ops make each variant re-run only what depends on the parameter. |
| `repair_hints` | `repair_hints` | The table adapted (`src/repair-hints.js`). Matching hints are also appended to failing `execute`, `set_script`, `validate` and `last_error` results. |
| resources `quickref`, `selectors` | the same URIs | 38 runnable sections, every one run by `scripts/mcp-test.mjs`. |
| `render_view` | `render_view` | Added: `objects` and `highlight` by name, and `direction` as an alias for `view`. |
| `save_snapshot`, `restore_snapshot`, `session_state`, `reset`, `last_error`, `workflow_hints` | the same | Snapshots keep an object summary. `session_state` lists the objects and resolve labels. |
| `script` | `get_script` | |
| `version` | `serverInfo` | |

## Tools: wave 2 (#203)

**Upstream's own Python, vendored.** Where build123d-mcp delegates to its sister packages, the same code runs here: build123d-lite gained importable modules, generated by `packages/cascade-core/scripts/vendor-drafting.py` with mechanical, listed edits. Licences and the edit list are in `packages/cascade-core/third_party/`.
- **`build123d_drafting`:** build123d-drafting-helpers' feature finders and the countersink recognizer.
- **`augura`:** the BREP printability checks.
- **`_cs_mcp_features`:** the MCP serializers.

The vendored code reads the B-rep through `_cs_ocp`, a small OCP shim over the worker's OCCT. These modules can also be imported from a script, in the editor too. Brython and Pyodide register them on first mention, so a Python boot doesn't pay for them.

| build123d-mcp | here | notes |
|---|---|---|
| `find_holes`, `find_hole_patterns`, `find_bosses`, `find_bored_bosses`, `find_countersinks` | the same | The vendored `features.py` and countersink recognizer, and the vendored `find_features.py` serializers, so the records match upstream's. A probe run reads them on the shown objects. |
| `analyze_printability` | the same | The vendored augura BREP path: overhangs and bridges, watertight, tip-over, brim, minimum feature, thin walls, bed fit. Its one OCP call, `BRepCheck_Shell.Closed`, is answered by an orientation-aware edge-use check. |
| `cross_sections` | the same | Each slice is the Common of the solid with a covering plane face, not section wires plus loop nesting. Holes come out as holes, so the area is exact; extras: regions, holes, size. |
| `render_view` | the same | Added: quality presets, per-object `colors`, `clip_plane`/`clip_at` (a back face seen through the cut is drawn as a flat cap), `label_objects`, a hidden-line PNG (`style: "lines"`), edge-only scenes. |
| `export` | the same | Added: `object_name`; the export gate verdict on 3-D formats (`strict` refuses a FAIL); DXF from the exact HLR projection. |
| `import_cad_file` | the same | STEP or BREP from a URL or as text, kept with the session. The script gains `name = import_step(...)` plus a named `show()`. Another session's imports never reach this one's engine. |
| `compare(kind="shape")` | the same | Added: change regions on the exact B-rep (faces matched by type, area and centroid; unmatched ones grouped through shared edges; distance from the other shape's surface), instead of upstream's tessellation comparison. |
| `validate` (the mesh gate) | the same | Also tessellates (conforming per-face meshing) and welds: triangle edges used more than twice FAIL, mesh gaps where the B-rep is closed warn. Skipped above 2,000 faces. |
| `health_check`, `destroy_session` | the same | `destroy_session` needs `confirm: true`. |
| skills `build123d://skill/modeling`, `skill/edit` | the same URIs | Served verbatim, with a prepended note on what differs here (`scripts/vendor-build123d-mcp-text.py`, which also regenerates the reference resources). |

**Lite gained real build123d API on the way:**
- `Shape.is_same` and `is_equal`;
- `Solid`/`Compound`/`Face.is_inside` (`BRepClass3d_SolidClassifier`);
- `topo_explore_connected_faces`;
- a cone face's `axis_of_rotation` (`gp_Cone` is unbound);
- a `__future__` module for MicroPython.

## Later waves

**Still open from wave 2:**
- **Mesh check:** upstream's non-manifold *vertex* check (corner-to-corner touches).
- **Skills:** upstream's `skill/repair`, whose recipes are OCP code that lite can't run; it needs adapted recipes.
- **`execute_file`:** has no meaning without a filesystem (`set_script` takes the text).

**Wave 3.** Needs more of the stack:
- **quiddity** powers `recognise_features`, `find_candidates`, `interface_features`, `edit_feature` and `inspect_part`. It needs numpy, scipy and OCP. Try it on the Pyodide runtime flavor (real CPython, numpy available), with the OCP calls over `OcpShim`.
- **The drafting module** (`Draft`, `DimensionLine`, `TechnicalDrawing`), once lite has it (CLAUDE.md, "Known honest gaps").
- **The part library** (`search_library`, `load_part`) needs bd_warehouse on lite.
- ~~**3MF**~~ done without lib3mf: `packages/cascade-core/src/worker/ThreeMF.js` writes the package (STORED zip, welded mesh objects, colours). `export` has `3mf`, and lite's `Mesher.write('x.3mf')` works, so the corpus's dual_color_3mf passes (224/239).

**Not ported:**

| tools | why |
|---|---|
| the drawing tools (`inspect_drawing`, `prepare_drawing`, `crop_drawing`, `view_axes`, `lint_drawing`, `render_drawing`, `save_drawing_annotations`, `suggest_view_layout`) | deprecated upstream in favour of draftwright (AGPL) |
| `execute_file`, `bank_candidate`, `install_skill` | local files; here the script travels as text, and `SKILL.md` is a file to upload |
| `list_sessions` | session ids are the only protection of an open deployment, so they are never listed |
| `repair_advice`, `mesh_section`, `mesh_holes` | long recipes tied to upstream's gate ladder, and tools for imported meshes that need STL import first |
| skills `skill/repair`, `skill/drawing` | OCP repair recipes lite cannot run; the deprecated drawing workflow |
