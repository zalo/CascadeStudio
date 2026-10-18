# The editor on an editing session

The session Worker (`--env session`, [EDIT-SESSIONS.md](EDIT-SESSIONS.md)) also
serves **the CascadeStudio editor** at `/`, in *remote-session mode*: Monaco,
the viewport, the timeline, the GUI tools and the Python language server run
in the page as usual, but build123d is evaluated by the page's editing session,
a Durable Object, instead of a local Web Worker. The page loads no CAD engine
at all: no worker bundle, no OpenCascade or MicroPython wasm. An edit
recomputes only what changed, because the session keeps its op cache warm,
and it survives eviction because the cache is persisted.

```bash
npm run build                        # repo root: cascade-core + cascade-studio
cd examples/cloudflare-worker
npm run dev:session                  # prepare-assets + prepare-editor + wrangler dev
# open http://127.0.0.1:8787/
```

Under `wrangler dev`, serve the editor apart from the Worker (see *Limits*,
local single thread):

```bash
npx http-server editor -p 8797 -c-1
# open http://127.0.0.1:8797/?server=http://127.0.0.1:8787
```

The editor can also be pointed at a session Worker from any other deployment
of CascadeStudio: `?engine=remote&server=<session Worker URL>`. A tab gets
its own session id, kept in `sessionStorage` so that a reload resumes the
same warm session; `?session=<id>` picks one explicitly. Saving to the URL
keeps these parameters.

## How it works

**The engine swap.** `RemoteCascadeEngine`
(`packages/cascade-core/src/engine/RemoteCascadeEngine.js`) has
CascadeEngine's API and emits its events in the same order: `Progress`, `log`,
the GUI widgets, `modelHistory`, `resetWorking`. So the editor, the viewport,
`CascadeAPI` and the GUI tools work without changes. The app picks it in
`resolveRemote()` (EditorManager.js) when `index.html` sets
`window.CASCADE_REMOTE`, which `scripts/prepare-editor.cjs` writes into the
copy the Worker serves, or when the URL has `?engine=remote`. In remote mode:
- the mode switcher is locked to Python;
- STEP/IGES/STL import is hidden;
- a *remote session* badge names the endpoint and the session.

**One evaluation** is `POST /session/<id>/render` with
`{code, formats: ["mesh"], maxDeviation, gui}`. The answer is a **framed
stream** (`application/x-cascade-frames`, `MeshCodec.js`), sent as soon as
the job is accepted:

| frame | when | |
|---|---|---|
| `PHASE` | each await boundary | `booting` (cold isolate), `restoring` (snapshot from SQLite), `evaluating`, `evaluated` → the editor's progress line |
| `RESULT` | after the evaluation | the `/render` JSON: logs, errors, history steps, GUI widgets, `cache`, `session`, and `meshStream: {shapeLines}` |
| `MESH` + `F32` + `U32` | per mesh batch, as it is meshed | the batch's face/edge scalars with offsets into its Float32 (coordinates) and Uint32 (triangle indices) buffers; a face the page already holds is just `{slot, id, ref}` |
| `DONE` | the end | mesh stats (faces, reused, meshed, nodes) and `keep`: the face ids the page should hold on to |

- **Gzip:** frames of 16 KB or more are gzipped by the object itself, because
  Cloudflare compresses only well-known content types. Phase events stay
  uncompressed, so they flush immediately.
- **No preflight:** request bodies go out as `text/plain`, a CORS-safelisted
  type, so a cross-origin editor makes no preflight request. The session
  routes answer any origin.

A first render's mesh (nothing to reuse yet), against the JSON the
browser's worker would post:

| model | mesh as JSON | binary | on the wire (gzip) |
|---|---|---|---|
| mount | 0.3 MB | 0.08 MB | 0.04 MB |
| maker_coin | 1.2 MB | 0.30 MB | 0.18 MB |
| plate16 | 12.5 MB | 3.51 MB | 0.61 MB |
| heat_exchanger | 19.5 MB | 5.33 MB | 1.06 MB |

**Incremental, streamed meshing.** The session meshes with
`IncrementalMesher` (cascade-core/src/worker), not ShapeToMesh. Every face of
the scene is keyed by its **geometry**:
- surface type and orientation;
- nine surface points over its UV box;
- every edge's type, midpoint and end points;

all in world coordinates to 9 significant digits, plus the deflection. A face
whose key was meshed before comes from a cache of typed arrays (12 MB, least
recently used out) instead of BRepMesh.

Kernel identity would not do: OCCT rebuilds every face of an op it re-runs.
After a fillet edit, plate16 keeps 1 of its 522 faces as the same `TopoDS`
face and heat_exchanger 0 of 1190. Geometrically, many are unchanged:

| edit | faces unchanged geometrically | same kernel face |
|---|---|---|
| heat_exchanger: fillet radius | 596 of 1190 (50%) | 1 |
| heat_exchanger: tube extension | 444 of 1190 (37%) | 0 |
| maker_coin: fillet radius | 118 of 146 (81%) | 0 |
| mount: hole size | 15 of 21 (71%) | 8 |
| plate16: fillet radius, or grid size | 1 of 522 | 1 |
| any re-run, or going back to the previous code | all | — |

Geometric keys also survive the session's compaction (snapshot, kernel
rewind, restore), which gives every shape a new identity.
`test/incremental-mesh.mjs` checks the result:
- a reused face covers the same surface as a fresh mesh of the edited model
  (per-face area and bounding box);
- the face and edge counts match ShapeToMesh's;
- the cache serves every face after a kernel rewind.

**The stream:**
- **Order:** the faces with a cached mesh go out in the first batch, at once.
  The rest follow every 20,000 nodes as they are meshed, then the edges.
- **References:** the session tracks which face meshes the page holds, keyed
  by a per-page cache id, and sends those as references. A re-run downloads
  0.08-0.17 MB instead of 0.6-1.1 MB.
- **Viewport:** it draws each batch as it lands (`meshBatch` →
  `renderPartialMesh`): unchanged regions reappear first, changed ones fill
  in. The finished mesh, with its pick metadata, then replaces the batches.
- **Recovery:** if the page ever lacks a referenced face, it starts a fresh
  cache and asks again.
- **No UVs:** the matcap material does not read them, and ShapeToMesh's UV
  atlas would make every face depend on every other.

**Other routes:**
- **Timeline:** `POST /session/<id>/history {step}` meshes one step of the last
  render's modeling history, through the same incremental mesher and stream.
  If a compaction rewound the kernel since, or another session used the
  engine, it first re-runs the session's last code, which is all cache hits.
- **Save STEP:** `POST /session/<id>/export {format}` exports the last
  render's shape, using the same re-run rule.
- **Errors:** script errors come back with the Python traceback. The editor
  takes the innermost `File "main", line N` and puts the error in the console
  and as a marker on that line.

**Meshing face by face.** Headless meshing now gives each face its own
BRepMesh call (`meshPerFace`, the headless default; ShapeToMesh.js). The
mesher's transient memory grows with the number of faces in one call, while
the triangulations themselves are small:

| model | faces | OCCT heap before meshing | meshed in one call | face by face | the triangulations |
|---|---|---|---|---|---|
| plate16 | 522 | 30 MB | 107 MB | 63 MB | 5.5 MB |
| heat_exchanger | 1190 | 42 MB | 136 MB | 57 MB | 8.3 MB |

In one call, heat_exchanger alone would go past the 128 MB a Worker has. Face
by face, later faces reuse the discretization of edges an earlier face already
meshed:
- **Conforming:** every shared edge has the same nodes in both faces (checked
  on all three models).
- **Identical on plate16 and heat_exchanger:** bit-identical node and triangle
  digests, in the same time.
- **Slightly different on curved multi-face edges:** maker_coin has 6,835
  nodes instead of 6,853.

The browser editor keeps the one-call pass.

## Measurements

`scripts/editor-bench.mjs` drives a session the way the editor does: the
mesh path, a timeline step, a STEP export. Same models and edits as
`session-bench.mjs`, plus going back to the original code. Client wall time,
local `wrangler dev`, isolate already booted. Each cell is *now (before the
incremental mesh)*, and *first faces* is when the first batch with faces
reached the page:

| model | first render | re-run (all hits) | edit 1 | edit 2 | back to the original | timeline step |
|---|---|---|---|---|---|---|
| mount | 0.54 s¹ (1.0 s) | 51 ms (125 ms) | 64 ms (89 ms) | 112 ms (178 ms) | 97 ms | 23 ms (40 ms) |
| plate16 | 2.8 s (2.8 s), first faces 1.9 s | 0.30 s (1.7 s) | 1.8 s (2.1 s), first faces 0.67 s | 1.8 s (2.2 s) | 0.74 s | 0.16 s (0.19 s) |
| maker_coin | 4.5 s (4.5 s) | 2.0 s (2.1 s) | 3.2 s (3.2 s) | 3.8 s (3.9 s) | 3.9 s | 1.9 s² (1.3 s²) |
| heat_exchanger | 6.0 s (5.9 s), first faces 4.3 s | 1.5 s (3.2 s) | 3.5 s (4.0 s), first faces 2.2 s | 4.8 s (5.0 s) | 3.5 s | 1.0 s² (1.1 s²) |

¹ including the engine boot. ² after a compaction, so it includes the
re-run of the cached script.

**What the incremental mesh changes:**
- **Unchanged geometry is not meshed again.** A re-run, or going back to code
  whose faces are still cached, costs evaluation plus key computation: 60 ms
  of meshing on plate16 instead of 1.7 s, 0.12 s on heat_exchanger instead of
  2.4 s.
- **An edit saves what it leaves alone.** heat_exchanger's fillet edit reuses
  half the faces, but those are the small ones, so 69% of the nodes still
  mesh (2.4 → 1.6 s of meshing). A plate16 fillet edit changes every face and
  saves nothing, except that faces now arrive in batches instead of all at
  the end.
- **maker_coin** is dominated by evaluation (`project()`, EDIT-SESSIONS.md);
  its mesh was always small.

### On the edge

Before the incremental mesh: `cascade-headless-session.makeshifted.workers.dev`,
deployed 2026-10-18 from `feat/do-editor` (2aaf689). Client wall time from this machine, one run each
(placement varies about 1.6×, EDIT-SESSIONS.md). The first render includes
booting a fresh isolate:

| model | first render | re-run (all hits) | edit 1 | edit 2 | timeline step | Save STEP |
|---|---|---|---|---|---|---|
| mount | 4.0 s | 516 ms | 361 ms | 504 ms | 80 ms | 276 ms |
| plate16 | 22.2 s | 10.4 s | 13.3 s | 14.4 s | 1.1 s | 2.2 s |
| maker_coin | 18.1 s | 7.4 s | 10.9 s | 12.6 s | 4.4 s² | 0.6 s |
| heat_exchanger | 24.2 s | 11.6 s | 14.9 s | 18.2 s | 3.8 s² | 1.4 s |

Against the same session without a mesh, measured last round (JSON path,
EDIT-SESSIONS.md), on a re-run and on edit 1:

| model | session, no mesh | session, editor path | stateless `/render`, no mesh |
|---|---|---|---|
| mount | 187 ms / 177 ms | 516 ms / 361 ms | — / 553 ms |
| plate16 | 1.0 s / 3.4 s | 10.4 s / 13.3 s | — / 4.5 s |
| heat_exchanger | 2.9 s / 5.4 s | 11.6 s / 14.9 s | — / 25.1 s |

**The edge's CPU makes meshing the bottleneck there.** Frame arrival times
(`PHASE evaluating` → `PHASE evaluated` → result frames) put a plate16
re-run at about 9.5 s inside evaluate-and-mesh, against about 1 s for
evaluation alone. Packing, gzip and transfer take about 0.45 s. That makes
meshing about 8.5 s on the edge, against 1.35 s locally. This is the same
4-6× gap the evaluation itself shows between this workstation and the edge
(plate16 edit: 0.6 s local, 3.4 s edge), not a separate fault:
- **Not memory:** constraining V8's heap locally does not reproduce it.
- **Not the transfer:** the gzipped payload arrives in under half a second.

Models with small meshes stay interactive: a mount edit comes back in under
half a second. Large ones pay their mesh on every edit, which is what the
first item under *Limits* is about.

## Limits

- **build123d (lite) only.** CascadeStudio JS and OpenSCAD run in the local
  editor. The headless engine could evaluate CascadeStudio JS, but the stable
  cache's correctness gate covers Python only.
- **No imports yet.** The STEP/IGES/STL import button and `import_step()`
  assets need an upload route.
- **A changed face is meshed whole, and on the edge that is slow.** Faces
  whose geometry changed go through BRepMesh. An edit that changes every face
  (plate16's fillet radius) costs a full mesh, about 8.5 s on the edge
  (above), now at least arriving in batches. OCCT's `IMeshTools_Parameters`
  (e.g. turning off surface-deflection control) is not bound in this build.
- **Reused faces keep the old mesh's boundary.** A reused face next to a
  re-meshed one keeps the edge nodes it was meshed with. Where the new
  neighbor discretizes that edge differently, a crack smaller than the
  deflection could open. `test/incremental-mesh.mjs` found every face of the
  edited box, maker_coin and heat_exchanger identical (to 1e-5 mm) to a fresh
  mesh, so none opens there. It stays possible on edges whose discretization
  depends on which face meshes them first.
- **The timeline after a compaction re-runs the script.** Compaction (OCCT
  heap ≥ `COMPACT_AT_MB`, which the big models reach on every render) rewinds
  the kernel, and the history steps go with it.
- **Local single thread.** `wrangler dev` runs the Worker, the static assets
  and every Durable Object on one workerd thread. A long render therefore
  blocks the editor's own asset requests. A Chrome request that arrives
  during a render (Monaco loads `codicon.ttf` lazily) comes back as a 500,
  and wrangler 4.125's dev proxy then exits with "Network connection lost".
  curl requests do not trigger it. Serving the editor separately (above)
  avoids it. Deployed, assets never touch the Worker, and session objects
  run apart from the edge Worker that routes to them.
- **No authentication.** Anyone can open a session, and anyone who knows a
  session id can use or delete it. Ids are random per tab.
