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

```bash
npm run dev:session                       # API + editor + /mcp on :8787
claude mcp add --transport http cad http://127.0.0.1:8787/mcp
BASE=http://127.0.0.1:8787 node scripts/mcp-test.mjs     # the protocol + every tool
```

## Tools

The names follow [build123d-mcp](https://github.com/pzfreo/build123d-mcp)'s
where the meaning matches, so guidance written for it carries over.

| tool | what it does |
|---|---|
| `new_session` | a fresh session id and the editor link (also implicit: `execute`/`set_script` without a session start one) |
| `execute` | append code to the session script and run it all; on error the append is rolled back and the error names its line in the code that was sent. A chunk that calls `show()` comments out earlier one-line `show()` calls, so the last show wins. |
| `set_script` / `get_script` | replace or read the whole script (numbered lines, revision, who changed it last: agent or editor) |
| `render_view` | a PNG (shaded, edges, silhouettes, axis triad, view + size label) from a named view or an azimuth/elevation; `highlight`/`shapes` pick shapes; `format: "svg"` gives an exact hidden-line drawing as a file, inlined when small |
| `measure` | per shape: topology counts, volume, area, bounding box, centre of mass, validity; with `density` also the mass |
| `validate` | PASS/FAIL: valid to BRepCheck, solids with positive volume, nothing empty; warnings for disjoint solids and shapes with no solid |
| `export` | `step`, `brep` (exact), `stl` (mesh), `glb` (mesh, metres, Y up), `svg` (drawing) → a download URL, kept `FILE_TTL_S` (1 h) |
| `session_state` / `last_error` | the overview (script, last run, snapshots, files, editor link) / the error with surrounding lines |
| `save_snapshot` / `restore_snapshot` | named copies of the script |
| `reset` | empty the script |
| `open_in_editor` | the CascadeStudio editor on this session |
| `workflow_hints` | the workflow guide (also the `build123d://workflow` resource; `build123d://quickref`; prompt `start-cad-session`) |

Plain HTTP reaches the same tools, for agents with a shell but no MCP client:
- `POST /session/<id>/tools/<name>` takes the arguments as JSON and returns the MCP result.
- `GET /session/<id>/view.png?view=iso` returns the PNG.

The skill below shows both.

## How it works

- **The protocol (`src/mcp.js`).** Streamable HTTP, stateless, answered with
  plain JSON: `initialize`, `ping`, `tools/*`, `prompts/*`, `resources/*`.
  - **Why stateless:** Cloudflare recommends it for remote MCP servers (`McpAgent` is deprecated), and MCP session ids don't survive between Claude API requests. The CAD state is addressed by the `session` argument instead, which the model carries through the conversation.
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
- **Files without a filesystem.** Exports are stored in the session object's own SQLite storage, in rows of 1.9 MB or less, and served at `/session/<id>/files/<random id>/<name>`.
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
  - that the quickref's and the skill's code run;
  - the REST bridge.
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

## Limits

- **build123d-lite, not real build123d.** It passes 223 of the 239 corpus scripts. numpy, the drafting module and 3MF are absent, and the tools say so in their errors.
- **The scene is what `show()` says.** Lite's first `show()` of a run defines the scene and later ones append, and shapes made after a `show()` join the scene too. The guidance is one `show()` at the end; `execute` comments out superseded one-line `show()` calls.
- **Exact drawings are slow on big models.** Hidden-line removal took 11 s locally for heat_exchanger, so it would be several times that on the edge. The polygonal HLR algorithm isn't bound in this OCCT build.
- **The REST bridge and the editor share the open session API.** Without an access key, anyone who knows a session id can use that session. With a key, the tools need it but the editor's routes don't.
- **Files live an hour,** in the session's storage, and are deleted with the session.
