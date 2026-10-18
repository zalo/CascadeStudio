# The MCP endpoint: build123d for any Claude session

The session Worker (`--env session`) serves the **Model Context Protocol** at
`/mcp`, so an AI agent with no local machine can build CAD models:
- **claude.ai:** add it as a custom connector.
- **Claude API agent:** use the MCP connector.
- **Claude Code:** `claude mcp add --transport http`.

Each MCP session id is an editing session ([EDIT-SESSIONS.md](EDIT-SESSIONS.md)): a Durable Object
with a warm build123d engine and a cached working set. It is the same session
the editor uses ([EDITOR.md](EDITOR.md)), so a person can open the model the agent is building
and edit it, and each side sees the other's changes.

**Live:** `https://cascade-headless-session.makeshifted.workers.dev/mcp`. It is open (no access key)
for now, like the session API; see *Signing in* to lock it down.

```bash
npm run dev:session                       # API + editor + /mcp on :8787
claude mcp add --transport http cad http://127.0.0.1:8787/mcp
BASE=http://127.0.0.1:8787 node scripts/mcp-test.mjs     # the protocol + every tool
```

## Tools

The names and arguments follow [build123d-mcp](https://github.com/pzfreo/build123d-mcp)'s
where the meaning matches, so guidance written for it carries over. Its harness — the reference resources,
repair hints, change diagnostics, the validity gate, `compare`, `resolve`, `design_audit` — is ported:
[BUILD123D-MCP-PORT.md](BUILD123D-MCP-PORT.md) has the per-tool matrix and what is left.

**Objects.** `show(part, "part")` registers what is displayed, measured and exported, and names it; the
tools take the name as `object_name` (or `objects`, `a`/`b`), or the index. A name shown again replaces its
shape and keeps its index; a named list shows its members as `name[0]`, `name[1]`, … A script with no
`show()` shows its top-level `result`.

| tool | what it does |
|---|---|
| `new_session` | a fresh session id and the editor link (also implicit: `execute`/`set_script` without a session start one) |
| `execute` | append code to the session script and run it all; on error the append is rolled back and the error names its line in the code that was sent, with repair hints. The reply lists the objects and what changed since the last run (volume, faces, size), and warns when code ran but nothing shown changed (a boolean that missed) or a shape lost its volume. A chunk with an unnamed `show()` comments out earlier unnamed one-line `show()` calls. |
| `set_script` / `get_script` | replace or read the whole script (numbered lines, revision, who changed it last: agent or editor) |
| `render_view` | a PNG (shaded, edges, silhouettes, axis triad, view + size label) from a named view or an azimuth/elevation; `objects`/`highlight` pick objects by name; `colors`, `label_objects`, `quality`; `clip_plane`/`clip_at` for a section view; `style: "lines"` for an exact hidden-line PNG, `format: "svg"` for it as a file |
| `measure` | per object: topology counts, volume, area, bounding box, centre of mass, validity; for up to four objects the face inventory (surface types with diameters, axes, angles) and the inertia tensor; with `density` or `material` the mass and inertia in g·mm² |
| `validate` | the validity gate: PASS/FAIL. Each object must be valid to BRepCheck, a closed manifold solid (no open or non-manifold edges) with positive volume, its solids must not overlap, and its welded tessellation must have no non-manifold edges. Warnings for disjoint solids and for separate objects that interpenetrate. |
| `locate_gate_defects` | where the gate fails: edge midpoints, overlapping solid pairs, BRepCheck failures, each with a hint |
| `compare` | `fit` (clearance; apart / touching / containing / interpenetrating; overlap volumes), `align` (flush / center / clearance along an axis), `shape` (deltas and the exact volume added and removed), `snapshot` (a saved snapshot against now, per object) |
| `resolve` | what a selector picks on an object (`".faces().sort_by(Axis.Z)[-1]"`): type, size, true centre, normal or axis and radius; labels are kept |
| `design_audit` | the script's top-level numeric parameters, each rebuilt at ±10% and gated: robust, brittle, coupling or inconclusive |
| `find_holes`, `find_hole_patterns`, `find_bosses`, `find_bored_bosses`, `find_countersinks` | feature recognition (build123d-drafting-helpers' finders, vendored into lite): holes with depth, bottom and counterbores; bolt circles, arrays, grids; bosses; countersinks |
| `analyze_printability` | FDM checks (augura, vendored): overhangs, watertight, tip-over, brim, min feature, thin walls, bed fit |
| `cross_sections` | exact section areas along an axis, with regions and holes per slice |
| `import_cad_file` | a STEP or BREP file from a URL or as text, kept with the session and shown as a named object |
| `search_library`, `load_part` | the part library: ISO-dimensioned nuts, bolts, cap screws, washers, ball bearings, standoffs, spacers, insert bosses, brackets, enclosures, knobs, clamps, spur gears; `load_part` adds `name = cs_parts.load(...)` + a named `show()` |
| `health_check`, `destroy_session` | engine and session status; delete the session (`confirm: true`) |
| `repair_hints` | fix suggestions for an error text |
| `export` | `step`, `brep` (exact), `stl` (mesh), `glb` (mesh, metres, Y up), `svg`/`dxf` (exact projection) → a download URL, kept `FILE_TTL_S` (1 h); one object with `object_name`; 3-D formats report the gate, `strict` refuses a FAIL |
| `make_drawing` | a dimensioned engineering drawing of one object (PDF + SVG URLs): views, a section where one helps, hole and feature callouts, a title block (`title`, `number`, `material`, `tolerance`, `size`, `scale`, …). The problems come back with fixes as Spec edits, which `ops` applies. Planned by draftwright-rust in the separate drafting Worker ([drafting/README.md](drafting/README.md), AGPL), so it is listed only where that Worker is bound; parts over its face limit are refused |
| `session_state` / `last_error` | the overview (script, last run, snapshots, files, editor link) / the error with surrounding lines |
| `save_snapshot` / `restore_snapshot` | named copies of the script |
| `reset` | empty the script |
| `open_in_editor` | the CascadeStudio editor on this session |
| `workflow_hints` | the workflow guide (also the `build123d://workflow` resource; prompt `start-cad-session`) |
| resources | `build123d://quickref` and `build123d://selectors` (runnable reference sections adapted from build123d-mcp), `build123d://starter` (one complete script), `build123d://skill/modeling` and `skill/edit` (build123d-mcp's skills, with a note on what differs here) |

Plain HTTP reaches the same tools, for agents with a shell but no MCP client:
- `POST /session/<id>/tools/<name>` takes the arguments as JSON and returns the MCP result.
- `GET /session/<id>/view.png?view=iso` returns the PNG.

The skill below shows both.

## How it works

- **The protocol (`src/mcp.js`).** Streamable HTTP, stateless, answered with
  plain JSON: `initialize`, `ping`, `tools/*`, `prompts/*`, `resources/*`.
  - **Why stateless:** Cloudflare recommends it for remote MCP servers (`McpAgent` is deprecated), and MCP session ids don't survive between Claude API requests. The CAD state is addressed by the `session` argument instead, which the model carries through the conversation.
  - **Loose arguments:** model clients sometimes send an array or object as its JSON text (`objects: '["plate", "lid"]'`), or a number or boolean as a string. `coerceArgs` (`src/mcp-tools.js`) turns such a top-level argument into the type its schema asks for, and object references (`object_name`, `a`/`b`) also accept a JSON list.
  - **Why hand-written:** the TypeScript SDK needs `nodejs_compat`, which this Worker can't turn on (wrangler.toml). The server side of the protocol is small. `scripts/mcp-test.mjs` drives it with the official SDK client.
- **The tools (`src/session.js`, `mcpTool()`).** They run inside the session's Durable Object over RPC, under the same engine lock as the editor's renders.
  - **Script:** `meta.script` holds the script, its revision and who changed it last. Editor renders save into it too.
  - **Re-runs:** a tool that needs geometry re-runs the current script only if the engine doesn't hold that revision. Unchanged operations are cache hits.
  - **After a run:** compaction and persistence happen after the result is returned, as for renders.
- **Rendering without a GPU (cascade-core `src/headless/MeshRaster.js`).**
  - **Mesh:** the incremental mesher's faces, so faces the editor already meshed are reused.
  - **Raster:** a z-buffered software rasterizer with per-vertex lighting, edges drawn on top with a depth test, and silhouettes from depth jumps. It renders at 2× and filters down.
  - **Output:** `PngEncode.js` writes the PNG with the platform's `CompressionStream`.
  - **Drawings:** `engine.drawingSVG()` projects the exact B-rep with `HLRBRep_Algo`.
- **Drawings in a Worker of their own (`drafting/`).** `make_drawing` exports the object's STEP inside the engine queue, then awaits the drafting Worker over a service binding (Workers RPC) outside it, so other sessions on the isolate aren't held up while the sheet is planned (0.3–2 s on the edge for small parts, ~15 s near the face limit). The drafting Worker links draftwright-rust's wasm package and is AGPL-3.0-only; every drawing names both sources. Its memory grows ~1.1 MB per face, hence the face limit. Locally, `npm run dev:drafting` beside `dev:session` connects through wrangler's dev registry; deploy it before the session Worker.
- **Files without a filesystem.** Exports are stored in the session object's own SQLite storage, in rows of 1.9 MB or less, and served at `/session/<id>/files/<random id>/<name>`.
  - **Links, not uploads:** an export URL is for the person, who opens it in a browser. A model's code sandbox can fetch it only if its egress allow-list has the host: claude.ai's code execution refuses unlisted hosts with a 403 (`connect_rejected`) until the account adds the domain under Settings → Capabilities. The `export` result, its description and the workflow say so, so a model hands over the link instead of retrying.
  - **Expiry:** each file expires after `FILE_TTL_S`, and expired files are dropped when the next one is stored.
  - **Limits:** 20 files and 32 MB per file per session.
  - **Why not R2:** it would add infrastructure to create, and the files belong with their session.
- **The shared editor.**
  - **Opening:** `GET /session/<id>/script` returns the script. The editor opens on it whenever a session already has one and the URL carries no `code=`.
  - **Following:** while the tab is visible and idle, the editor polls `?rev=<what it has>`, which answers with the text only when it changed. With no unsaved edits it applies the agent's change and re-evaluates (cache hits); otherwise it says once that the script changed.
- **Limits.**
  - **Per session:** 60 tool calls a minute and 3,000 a day (`MCP_CALLS_PER_MIN`, `MCP_CALLS_PER_DAY`); a script of at most 256 KB; renders of at most 1600×1200; the file limits above.
  - **CPU:** each request is capped by `limits.cpu_ms`.

## Signing in (`src/auth.js`)

| configuration | `/mcp` | for |
|---|---|---|
| no `MCP_ACCESS_KEY` | open, like the session API | local work, demos |
| `MCP_ACCESS_KEY` | `Authorization: Bearer <key>` | the Claude API connector (`authorization_token`), Claude Code (`--header`) |
| `MCP_ACCESS_KEY` + `OAUTH_KV` | OAuth 2.1, and the key still works as a bearer token | claude.ai connectors |

- **The OAuth side** is `@cloudflare/workers-oauth-provider`. It covers the 401 challenge and RFC 9728 resource metadata, RFC 8414 server metadata, dynamic client registration, PKCE, and tokens hashed in KV.
- **`/authorize`** is a consent page. It shows the client's name and where the access goes, warns when that is a loopback address, and asks for the access key.
- **The static key** is accepted through the provider's `resolveExternalToken`. That is the provider's documented compatibility pattern; it is our own key, not an upstream token passed through.
- **The REST bridge** takes the key too. The editor's routes stay open, protected by unguessable session ids.

Setup (once per deployment):

```bash
npx wrangler kv namespace create OAUTH_KV --env session     # put the id in wrangler.toml
npx wrangler secret put MCP_ACCESS_KEY --env session
```

## Using it from Claude

- **claude.ai:** go to Settings → Connectors → Add custom connector and give it `https://<worker>/mcp`. Sign in with the access key.
- **Claude Code:** `claude mcp add --transport http cad https://<worker>/mcp --header "Authorization: Bearer <key>"`.
- **Claude API:**

  ```json
  "mcp_servers": [{"type": "url", "url": "https://<worker>/mcp", "name": "cad", "authorization_token": "<key>"}],
  "tools": [{"type": "mcp_toolset", "mcp_server_name": "cad"}]
  ```

  Send it with the MCP connector beta header.
- **The skill:** [`skills/build123d-remote/SKILL.md`](skills/build123d-remote/SKILL.md) is an Agent Skill with the workflow. Upload it to claude.ai or copy it into `.claude/skills/`. It also covers the plain-HTTP route.

## Verified

- **`scripts/mcp-test.mjs`,** using the official MCP SDK client against `wrangler dev`, checks:
  - every tool, the prompt and the resources;
  - the rollback and line mapping;
  - each export format, fetched and checked by its magic bytes;
  - snapshots and the last-show-wins rule;
  - that the starter's and the skill's code run, and all 38 runnable quickref/selectors sections;
  - named objects (replace by name, stable indices), the change line and the missed-boolean warning, `measure` with a material, `compare` of each kind, `resolve` (including a bad selector), the gate on overlapping solids and a sheet, `locate_gate_defects`, `design_audit` (a fillet radius that breaks the solid at +10% is brittle; the script is left alone), and the `result` fallback;
  - the REST bridge;
  - with the drafting Worker bound, `make_drawing`: the sheet, views and links; the PDF by its magic bytes; the title block fields in the SVG; a problem's fix; a bad Spec edit; `ops` as JSON text; the one-part rule; and the face limit.
  - Auth runs: the 401 challenge; wrong and right keys; the whole OAuth flow (metadata, registration, the consent page with a wrong then the right key, code, token, a call with the token); the per-minute limit, which stops at call 60.
- **`test/remote-session.spec.js`** has an agent and the editor share one session. The editor opens on the agent's script, follows an `execute`, and the agent sees the person's edit.
- **A real client:** Claude Code (Sonnet), given only this MCP server, modeled "a 30 × 20 × 10 mm block with a 6 mm through-hole and 1 mm vertical fillets".
  - **Tools:** it rendered two views and described them correctly, measured 5,708.67 mm³ (which it checked by hand), got PASS from `validate`, and exported STEP.
  - **Cost:** 8 turns, 13 s, $0.10.

| on this workstation, after the first render (meshes cached) | |
|---|---|
| `render_view` PNG, 800×600: mount / maker_coin / plate16 / heat_exchanger | 0.11-0.27 s / 0.12-0.5 s / 0.22-0.26 s / 0.55-0.74 s |
| the first view of a model also meshes it | plate16 3.3 s, heat_exchanger 6.5 s |
| `drawingSVG` (exact HLR) | mount 0.1 s, maker_coin 0.7 s, plate16 5.6 s, heat_exchanger 11 s |
| `exportGLB` | 6-360 ms |

### On the edge

Deployed 2026-10-18 (open mode). Client wall time from this machine, one run
each; placement varies about 1.6×.

| call | mount | heat_exchanger |
|---|---|---|
| `set_script`, the session's first run (a fresh isolate also boots the engine, ~4 s) | 4.0 s | 19-32 s |
| `render_view`, the first view (meshes the model) | 1.4 s | 15.6 s |
| `render_view`, another view | 0.87 s | 2.5 s |
| `measure` / `validate` | 0.26 / 0.21 s | 2.3 / 0.1 s |
| `export` step / glb | 0.38 / 0.22 s | 3.0 s / — |
| `render_view` svg drawing | 0.29 s | (not run: 11 s locally) |
| `execute` (a small append) | 0.28 s | — |

**Two edge-only problems surfaced** that `wrangler dev` does not show:
- **Storage commits:** a SQL write in a Durable Object applies at once but commits when the event loop turns. A tool wrote a small row, the rate-limit counter, and then held the isolate for 30 s or more evaluating heat_exchanger. The commit timed out and the runtime reset the object ("storage operation exceeded timeout"). Every write that precedes a long evaluation, render or export is now followed by `await ctx.storage.sync()` (`flush()`).
- **Compaction:** the threshold compacted after every call once heat_exchanger's heap passed 48 MB. Compaction rewinds the kernel, so the next call re-ran the script and compacted again, at 9-15 s per call. Now only runs with cache misses compact at `COMPACT_AT_MB`. Re-runs that are all hits, renders and exports compact only past 48 + 40 MB, and the full inspection is cached per run. A second view dropped from 11 s to 2.5 s, and `measure` from 12 s to 2.3 s. The exact bounding box (`AddOptimal`, 3.5 s locally on heat_exchanger) is now opt-in (`exact_bbox`); the default box is tight for analytic faces.

## Limits

- **build123d-lite, not real build123d.** It passes 224 of the 239 corpus scripts. numpy is absent, and the tools say so in their errors. The drafting module (`DimensionLine`, `ExtensionLine`, `TechnicalDrawing`) is ported.
- **The scene is what `show()` says.** Lite's first `show()` of a run defines the scene and later ones append, and shapes made after a `show()` join the scene too. Named `show()` calls replace by name; for unnamed ones the guidance is one `show()` at the end, and `execute` comments out superseded one-line calls.
- **The mesh check counts edges, not vertices.** build123d-mcp also flags non-manifold vertices (corner-to-corner touches); the quiddity-based recognition tools need numpy ([BUILD123D-MCP-PORT.md](BUILD123D-MCP-PORT.md)).
- **Exact drawings are slow on big models.** Hidden-line removal took 11 s locally for heat_exchanger, so it would be several times that on the edge. The polygonal HLR algorithm isn't bound in this OCCT build.
- **The REST bridge and the editor share the open session API.** Without an access key, anyone who knows a session id can use that session. With a key, the tools need it but the editor's routes don't.
- **Files live an hour,** in the session's storage, and are deleted with the session.
