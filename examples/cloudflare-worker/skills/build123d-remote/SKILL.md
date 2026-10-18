---
name: build123d-remote
description: Design 3D parts (brackets, enclosures, mounts, knobs, any mechanical part) with build123d in remote CAD sessions — no local Python or CAD install. Build the model step by step, look at rendered views, measure and validate it, and export STEP/STL/GLB/SVG, through the cascade-build123d MCP server or its plain HTTP API. Use whenever the user asks for a CAD model or a 3D-printable part.
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
- **No MCP, but a shell with network access** — the same tools over HTTP (send `-H "Authorization: Bearer <key>"` if the server is keyed):

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
2. **Build in steps**: `execute` appends code to the session script and runs it; if it raises, the appended code is rolled back and the error names its line. `set_script` replaces the whole script (kept even if it raises). The first `execute` adds `from build123d import *`.
3. **Look after every feature**: `render_view` with `view: "iso"` plus an orthographic view that shows the feature (`front`, `top`, `right`). The label states the overall size; check it against the plan. Shapes can be highlighted (`highlight: [index]`).
4. **Measure**: `measure` gives each shape's bounding box, volume, area, centre of mass and validity (with `density` in g/cm³ also the mass). Compare with the plan.
5. **Fix errors** with `last_error` (the failing line in context). Usual causes: a selector that matched nothing (print it first), a fillet larger than its neighbouring faces allow, a boolean between shapes that do not touch.
6. **Before risky changes** `save_snapshot`; go back with `restore_snapshot`.
7. **Finish**: `validate` must say PASS, then `export` (`step` for CAD, `stl` for printing, `glb` for viewers, `svg` for a hidden-line drawing — each returns a URL kept for an hour), and give the user `open_in_editor`'s link: the CascadeStudio editor on the same session, where they can see the model, edit the script, and their edits come back to you (`session_state`, `get_script`).

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

show(part)
```

- **show() once, at the end**, with everything that should be displayed, measured and exported (`show(a, b)`; tools index shapes in that order). Without it every intermediate shape is shown, sketches included. With `execute`, a chunk that calls `show()` comments out earlier one-line `show()` calls.
- Algebra mode (`a + b`, `a - b`, `a & b`, `Pos(...) * shape`, `Rot(...) * shape`) and builder mode (`with BuildPart() as p:` … `p.part`) both work.
- Selectors: `edges()/faces()/vertices()/solids()`, `.filter_by(Axis.Z | GeomType.CIRCLE | Plane.XY)`, `.sort_by(Axis.Z)[-1]`, `.group_by(Axis.Z)[0]`.
- 2-D → 3-D: `BuildSketch` with `Rectangle`, `RectangleRounded`, `Circle`, `Polygon`, `SlotOverall`, `Text`; then `extrude`, `revolve`, `loft`, `sweep`.
- Not available: numpy and other packages, the drafting module (`Draft`, `DimensionLine`, `TechnicalDrawing`), 3MF output, `import_svg`/`import_stl`, `open()`. Files come from `export`.

## Reading a render

Orthographic, shaded grey with dark edges; highlighted shapes are orange. The triad at the bottom left is X red, Y green, Z blue; the label gives the view (azimuth/elevation) and the overall size in mm.
