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

## Tools: wave 1

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

## Tools: wave 2

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

## Wave 3

**The part library** (`search_library`, `load_part`). Upstream's mechanism is a directory of part files given with `--library`; it ships no parts. Here the library is curated and bundled, in the same file format (`PART_INFO` plus `make(**params)`). It lives in `packages/cascade-core/src/worker/CsParts.js` and is importable in scripts as `cs_parts`. There are 13 parts:
- **Fasteners:** ISO 4032 hex nuts, ISO 4017 hex bolts, ISO 4762 socket head cap screws, ISO 7089 washers.
- **Bearings:** ISO 15 ball bearings (625–6005, 6200–6202).
- **Hardware:** hex standoffs, spacers, heat-set insert bosses, knobs.
- **Brackets, enclosures, gears:** L brackets, pipe clamps, enclosures with lids, involute spur gears.

`load_part` appends a readable `name = cs_parts.load("hex_nut", size="M8")` plus a named `show()`. Each part runs as a black box: its intermediate shapes never join the scene. Every part passes the validity gate with defaults and with other parameters. The test also checks dimensions; the spur gear's tip diameter, for example, is m(z+2).

**The drafting module.** `Draft`, `Arrow`, `DimensionLine`, `ExtensionLine` and `TechnicalDrawing` come from build123d 0.13's own `drafting.py`.
- **How it's ported:** `packages/cascade-core/scripts/port-drafting.py` appends it to lite's source with listed edits, made through AST source ranges.
- **Lite gained, on the way:**
  - `Wire.trim` across edges;
  - edge/wire-profile `sweep`;
  - `trace`, `tangent_angle_at`, `perpendicular_line`, `Vector.get_angle`/`project_to_line`;
  - `Builder._get_context`;
  - geometry from `Compound(children=)`;
  - an Enum `HeadType`;
  - an `ArrowHead` that honours `rotation=` outside a builder.
- **Result:** `docs/objects_2d` matches on 41 of 42 shapes, up from ERROR. The 42nd is a `Text` 25 µm wider, the opentype.js-vs-FreeType residual the upstream leg shows too.

**3MF** (above): the corpus is now 224 PASS / 10 MISMATCH / 4 ERROR / 1 TIMEOUT.

**The quiddity spike** (`recognise_features`, `find_candidates`, `interface_features`, `edit_feature`, `inspect_part`). I measured it statically and did not run the downloaded code. The findings:
- **Size:** 45,000 lines of Python in 42 OCP-importing files.
- **numpy/scipy:** one file only, using `asarray`, `quantile`, `outer`, `cross` and `concatenate` plus scipy's `cKDTree`. A pure-Python shim is easy.
- **OCP:** about 90 distinct names from 30 modules. The upstream flavor's OCP shim already maps most of them. Missing are `BRepClass_FaceClassifier`, `IntCurvesFace_ShapeIntersector`, `ShapeAnalysis_CanonicalRecognition`/`_Surface`, the `TColStd`/`TColgp` arrays and `Geom_BSplineSurface` handles, plus `OSD_Parallel`/`OSD_ThreadPool` (sequential stubs would do). `gp_Cone` is not bound in this OCCT build at all; the ring-based substitute (`_coneAxisFromRings`) shows the way round it.
- **Where it can run:** quiddity calls real build123d and OCP together on the same objects. That is the upstream flavor (build123d 0.13 over the OCP shim on MicroPython), not lite, whose `.wrapped` is a raw handle. The MCP endpoint would need a second, upstream-flavor session class for these tools, which also costs more memory per session.
- **Verdict:** feasible, but a project of its own: shim additions, a numpy subset, an upstream-flavor session object, then fidelity checks against native quiddity. It stays out of this PR.

**Still open, as before:**
- the drafting *tools* (upstream deprecated them in favour of draftwright, AGPL);
- `bd_warehouse` (threads, a large OCP surface);
- `Mesher.read` (no mesh import).

**Not ported:**

| tools | why |
|---|---|
| the drawing tools (`inspect_drawing`, `prepare_drawing`, `crop_drawing`, `view_axes`, `lint_drawing`, `render_drawing`, `save_drawing_annotations`, `suggest_view_layout`) | deprecated upstream in favour of draftwright (AGPL); here `make_drawing` calls draftwright-rust in a separate AGPL Worker ([drafting/README.md](drafting/README.md)) |
| `execute_file`, `bank_candidate`, `install_skill` | local files; here the script travels as text, and `SKILL.md` is a file to upload |
| `list_sessions` | session ids are the only protection of an open deployment, so they are never listed |
| `repair_advice`, `mesh_section`, `mesh_holes` | long recipes tied to upstream's gate ladder, and tools for imported meshes that need STL import first |
| skills `skill/repair`, `skill/drawing` | OCP repair recipes lite cannot run; the deprecated drawing workflow |
