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

## Tools: wave 1 (this PR)

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

## Later waves

**Wave 2.** Portable with what is here; mostly JS over the bound OCCT, or pure Python into lite:

| tool | plan |
|---|---|
| `find_holes`, `find_hole_patterns`, `find_bosses`, `find_bored_bosses`, `find_countersinks` | build123d-drafting-helpers (Apache-2.0, pure Python) on lite's selectors; fetch it and check its imports against lite's coverage |
| `cross_sections` | slices with `BRepAlgoAPI_Section`, section areas from faces built on the section wires |
| `analyze_printability` | vendor augura (small, portable): overhang faces from normals, thin walls from BRepExtrema between opposite faces, the bed footprint |
| `render_view` | quality presets, per-object colours, clip planes with caps, object labels, hidden-line PNG (rasterize the HLR edges), edge-only scenes (they throw today) |
| `export` | `object_name`; the export gate (validate before writing, refuse or warn); DXF from the HLR projection |
| `compare(kind="shape")` | per-region surface deviation (mesh distance between the two tessellations) |
| `import_cad_file` | a tool that takes STEP/BREP text or a URL into the session's external files (lite `import_step` already reads them) |
| `health_check`, `destroy_session` | wrap `GET /session/<id>` and `DELETE /session/<id>` |
| the mesh gate | build123d-mcp also tessellates and checks the mesh for non-manifold edges and vertices (self-touching faces that the B-rep checks miss). Here: weld the incremental mesher's output and count edge incidence. |
| skills `build123d://skill/modeling`, `skill/edit`, `skill/repair` | adapt the texts to this server's tools |

**Wave 3.** Needs more of the stack:
- **quiddity** powers `recognise_features`, `find_candidates`, `interface_features`, `edit_feature` and `inspect_part`. It needs numpy, scipy and OCP. Try it on the Pyodide runtime flavor (real CPython, numpy available), with the OCP calls over `OcpShim`.
- **The drafting module** (`Draft`, `DimensionLine`, `TechnicalDrawing`), once lite has it (CLAUDE.md, "Known honest gaps").
- **The part library** (`search_library`, `load_part`) needs bd_warehouse on lite.
- **3MF** needs lib3mf in the wasm build.

**Not ported:**

| tools | why |
|---|---|
| the drawing tools (`inspect_drawing`, `prepare_drawing`, `crop_drawing`, `view_axes`, `lint_drawing`, `render_drawing`, `save_drawing_annotations`, `suggest_view_layout`) | deprecated upstream in favour of draftwright (AGPL) |
| `execute_file`, `bank_candidate`, `install_skill` | local files; here the script travels as text, and `SKILL.md` is a file to upload |
| `list_sessions` | session ids are the only protection of an open deployment, so they are never listed |
| `repair_advice`, `mesh_section`, `mesh_holes` | long recipes tied to upstream's gate ladder, and tools for imported meshes that need STL import first |
