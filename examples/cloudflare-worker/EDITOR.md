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
| `RESULT` | at the end | the `/render` JSON: logs, errors, history steps, GUI widgets, `cache`, `session`, with `mesh` replaced by the per-face/edge scalars and offsets |
| `F32`, `U32` | after `RESULT` | every coordinate list in one Float32 buffer, every triangle index in one Uint32 buffer |

- **Gzip:** frames of 16 KB or more are gzipped by the object itself, because
  Cloudflare compresses only well-known content types. Phase events stay
  uncompressed, so they flush immediately.
- **No preflight:** request bodies go out as `text/plain`, a CORS-safelisted
  type, so a cross-origin editor makes no preflight request. The session
  routes answer any origin.

| model | mesh as JSON | binary | on the wire (gzip) |
|---|---|---|---|
| mount | 0.3 MB | 0.10 MB | 0.05 MB |
| maker_coin | 1.2 MB | 0.35 MB | 0.21 MB |
| plate16 | 12.5 MB | 4.14 MB | 0.84 MB |
| heat_exchanger | 19.5 MB | 6.30 MB | 1.43 MB |

**Other routes:**
- **Timeline:** `POST /session/<id>/history {step}` meshes one step of the last
  render's modeling history. If a compaction rewound the kernel since, or
  another session used the engine, it first re-runs the session's last code,
  which is all cache hits.
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
`session-bench.mjs`. Client wall time, local `wrangler dev`, isolate already
booted:

| model | first render | re-run (all hits) | edit 1 | edit 2 | timeline step | Save STEP |
|---|---|---|---|---|---|---|
| mount | 1.0 s¹ | 125 ms | 89 ms | 178 ms | 40 ms | 152 ms |
| plate16 | 2.8 s | 1.7 s | 2.1 s | 2.2 s | 187 ms | 326 ms |
| maker_coin | 4.5 s | 2.1 s | 3.2 s | 3.9 s | 1.3 s² | 241 ms |
| heat_exchanger | 5.9 s | 3.2 s | 4.0 s | 5.0 s | 1.1 s² | 408 ms |

¹ including the engine boot. ² after a compaction, so it includes the
re-run of the cached script.

**Meshing now dominates a warm edit of a big model.** A re-run of plate16 is
0.15 s of evaluation and 1.35 s of meshing. For heat_exchanger it is 1.0 s and
1.95 s. Gzip adds about 0.15 s on the big meshes, which pays for itself on
any real network link.

## Limits

- **build123d (lite) only.** CascadeStudio JS and OpenSCAD run in the local
  editor. The headless engine could evaluate CascadeStudio JS, but the stable
  cache's correctness gate covers Python only.
- **No imports yet.** The STEP/IGES/STL import button and `import_step()`
  assets need an upload route.
- **Every render re-meshes the whole scene.** The mesher strips its
  triangulations after each pass. Keeping them on cached shapes would let
  BRepMesh skip unchanged faces, but they would leak into later runs: OCCT's
  bounding boxes prefer a triangulation when one is present, which is why the
  session clears them. The way forward is a JS-side cache of each scene
  shape's mesh, keyed by its stable cache key.
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
