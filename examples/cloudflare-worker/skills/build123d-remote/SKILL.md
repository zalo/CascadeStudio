---
name: build123d-remote
description: Design 3D parts (brackets, enclosures, mounts, knobs, any mechanical part) with build123d in remote CAD sessions — no local Python or CAD install. Build the model step by step, look at rendered views, verify it with numbers (measure, clearances, selector checks, a validity gate, a parameter audit), and export STEP/STL/GLB/SVG, through the cascade-build123d MCP server or its plain HTTP API. Use whenever the user asks for a CAD model or a 3D-printable part.
---

# build123d CAD in remote sessions

A server-side session runs build123d (the "lite" port, on OpenCascade) for you: it keeps one script per session, re-runs it cheaply (unchanged operations are cached), and gives back renders, measurements and files. Units are millimetres, Z is up.

## Connecting

The server is `https://cascade-headless-session.makeshifted.workers.dev` (or wherever the user deployed `examples/cloudflare-worker --env session`). Use whichever is available:

- **MCP tools already connected** (tools named `execute`, `render_view`, `measure`, …, often prefixed like `mcp__cad__`): use them directly.
- **Connect MCP** — the endpoint is `<server>/mcp` (Streamable HTTP):
  - claude.ai: Settings → Connectors → Add custom connector → the URL. If the server has an access key it asks for it on the sign-in page.
  - Claude Code: `claude mcp add --transport http cad <server>/mcp` (add `--header "Authorization: Bearer <key>"` for a keyed server).
  - Claude API: `"mcp_servers": [{"type": "url", "url": "<server>/mcp", "name": "cad", "authorization_token": "<key>"}]` with `"tools": [{"type": "mcp_toolset", "mcp_server_name": "cad"}]` and the MCP connector beta header.
- **No MCP, but a shell with network access** — the same tools over HTTP (send `-H "Authorization: Bearer <key>"` if the server is keyed). A sandbox behind an egress allow-list (claude.ai code execution) needs the server's host on its allowed domains (Settings → Capabilities); a refused connection (403, `connect_rejected`) won't fix itself on a retry:

  ```bash
  S=<server>/session/my-part-1        # pick any id: letters, digits, _ . -
  curl -s $S/tools/set_script -d "$(jq -n --arg code "$(cat part.py)" '{code: $code}')"
  curl -s "$S/view.png?view=iso" -o iso.png        # then look at the image
  curl -s "$S/view.png?view=front" -o front.png
  curl -s $S/tools/measure -d '{"density": 1.24}'
  curl -s $S/tools/validate -d '{}'
  curl -s $S/tools/export -d '{"format": "step", "filename": "bracket"}'   # returns a download URL
  ```

  Every tool works this way (`POST $S/tools/<name>` with the tool's arguments as JSON); replies are `{"content": [...], "isError": false}`.

## The loop

1. **Plan**: overall size, the main body, then the features (holes, slots, fillets, chamfers). Put the key dimensions in variables at the top of the script.
2. **Build in steps**: `execute` appends code to the session script and runs it; if it raises, the appended code is rolled back and the error names its line, with repair hints. Each reply lists the shown objects and what changed (volume, faces, size) — read it: "no shown shape changed" after a cut means the cutter missed. `set_script` replaces the whole script (kept even if it raises). The first `execute` adds `from build123d import *`.
3. **Look after every feature**: `render_view` with `view: "iso"` plus an orthographic view that shows the feature (`front`, `top`, `right`). The label states the overall size; check it against the plan. Objects can be shown alone or highlighted by name (`objects: "lid"`, `highlight: ["boss"]`).
4. **Verify with numbers**: `measure` (bounding box, volume, centre of mass, the face inventory with hole diameters and axes, inertia; `material: "pla"` for the mass); `compare` with `kind: "fit"` for whether two parts clear, touch or collide, `kind: "align"` for flushness; `resolve` to see what a selector picks before filleting it; `find_holes` / `find_hole_patterns` / `find_countersinks` / `find_bosses` to read features back (diameters, depths, counterbores, bolt circles); `cross_sections` for wall changes and voids; `analyze_printability` before an STL (overhangs, thin walls, tip-over, bed fit).
5. **Fix errors** with `last_error` (the failing line in context) and `repair_hints`. Usual causes: a selector that matched nothing, a fillet larger than its neighbouring faces allow, a boolean between shapes that do not touch.
6. **Before risky changes** `save_snapshot`; go back with `restore_snapshot`; `compare` with `kind: "snapshot"` shows what changed.
7. **Finish**: `validate` must say PASS (`locate_gate_defects` says where it fails); `design_audit` checks the top-level dimensions survive a ±10% edit. Then `export` (`step` for CAD, `stl` for printing, `glb` for viewers, `svg` for a hidden-line projection; `make_drawing` for a dimensioned engineering drawing as PDF, where it is listed, applying the fixes its problems list through `ops` — each returns a URL kept for an hour: hand it to the user as a link, since a sandbox can only download it if the host is on its allowed domains), and give the user `open_in_editor`'s link: the CascadeStudio editor on the same session, where they can see the model, edit the script, and their edits come back to you (`session_state`, `get_script`).

Carry the session id from the first reply into every call.

## Writing the script

```python
from build123d import *

length, width, thickness = 80, 50, 6
hole_d, inset = 5, 8

plate = Box(length, width, thickness)
plate = fillet(plate.edges().filter_by(Axis.Z), radius=6)
plate -= GridLocations(length - 2 * inset, width - 2 * inset, 2, 2) * Cylinder(hole_d / 2, thickness * 2)
boss = Pos(0, 0, thickness / 2) * Cylinder(12, 20, align=(Align.CENTER, Align.CENTER, Align.MIN))
part = plate + boss
part -= Cylinder(6, 100)                                   # bore through the boss
part = fillet(part.edges().group_by(Axis.Z)[-1], radius=1)  # soften the top rim

show(part, "part")
```

- **show(obj, "name")** registers what is displayed, measured and exported; tools take the name as `object_name`. Showing a name again replaces it (its index stays), so a chunk can re-show the edited part. Unnamed `show(a, b)` works too; with `execute`, a chunk with an unnamed `show()` comments out earlier unnamed one-line calls. With no `show()`, a top-level `result` is shown; failing that, every intermediate shape, sketches included.
- `named_face(part, "top")` and `find_edges(part, geom="circle", radius=3)` are selection helpers (they print what they matched). `from build123d_drafting import find_holes` and `import augura` work in scripts too.
- To work on an existing part, `import_cad_file` brings a STEP or BREP in (from a URL or as text) as a named object.
- Standard parts come from the library: `search_library` ("m4 screw", "608 bearing", "gear"), then `load_part` (or `cs_parts.load("hex_nut", size="M4")` in the script). Position the result like any shape.
- Dimensioned 2-D drawings: `Draft`, `DimensionLine`, `ExtensionLine`, `TechnicalDrawing` (build123d's drafting module).
- Section views: `render_view` with `clip_plane: "x"` (and `clip_at`); exact line drawings with `style: "lines"`; `export` `dxf`/`svg` for the projection as a file. `build123d://quickref` and `build123d://selectors` have runnable examples.
- Algebra mode (`a + b`, `a - b`, `a & b`, `Pos(...) * shape`, `Rot(...) * shape`) and builder mode (`with BuildPart() as p:` … `p.part`) both work.
- Selectors: `edges()/faces()/vertices()/solids()`, `.filter_by(Axis.Z | GeomType.CIRCLE | Plane.XY)`, `.sort_by(Axis.Z)[-1]`, `.group_by(Axis.Z)[0]`.
- 2-D → 3-D: `BuildSketch` with `Rectangle`, `RectangleRounded`, `Circle`, `Polygon`, `SlotOverall`, `Text`; then `extrude`, `revolve`, `loft`, `sweep`.
- Not available: numpy and other packages, `import_svg`/`import_stl`, `open()`. Files come from `export`.

## Reading a render

Orthographic, shaded grey with dark edges; highlighted objects are orange. The triad at the bottom left is X red, Y green, Z blue; the label gives the view (azimuth/elevation) and the overall size in mm.
