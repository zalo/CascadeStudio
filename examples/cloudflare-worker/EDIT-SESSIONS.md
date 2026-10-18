# Editing sessions on Durable Objects

`--env session` keeps an **editing session** warm: one Durable Object per
session id holds a build123d-lite engine whose op cache survives between
edits, so an edit recomputes only what it changed — and the cached working
set is persisted in the object's SQLite storage, so it survives eviction too.
The same Worker serves the CascadeStudio editor on top of it at `/`
([EDITOR.md](EDITOR.md)).

```bash
npm run dev:session          # prepare-assets + wrangler dev --env session
curl -sX POST http://localhost:8787/session/demo/render -H 'content-type: application/json' \
  -d '{"code":"from build123d import *\nshow(Box(10,10,10))","formats":["brep"]}'
BASE=http://127.0.0.1:8787 node scripts/session-bench.mjs --models mount,plate16
```

| route | |
|---|---|
| `POST /session/<id>/render` | `{code, formats, measure?, maxDeviation?, gui?}` → the `/render` JSON plus `cache` (hits/misses/volatile) and `session` (warm?, restore, server phase timings, the previous render's post-response work); with `"mesh"` among the formats, a framed stream with the binary viewport mesh ([EDITOR.md](EDITOR.md)) |
| `POST /session/<id>/history` | `{step, maxDeviation?}` → frames: one timeline step of the last render, meshed |
| `POST /session/<id>/export` | `{format: step\|brep\|stl}` → the last render's shape as text |
| `GET /session/<id>` | instance, isolate, keep-warm, storage (snapshot size/rows), memory |
| `POST /session/<id>/evict` | drop the in-memory working set — the next render restores from storage (test hook) |
| `DELETE /session/<id>` | forget the session |

Code: [src/session.js](src/session.js) (the object), [src/index-session.js](src/index-session.js)
(entry), cascade-core's stable cache in `packages/cascade-core/src/worker/StandardUtils.js`
(`_stableHash`) and the snapshot in `packages/cascade-core/src/headless.js`
(`snapshotCache`/`restoreCache`). Correctness gate: `test/stable-cache-gate.mjs`.

## What a session does per render

```
request ─▶ engine lock ─▶ adopt ─▶ evaluate (op cache) ─▶ export ─▶ RESPOND
                           │                                           │
            (owner ≠ me: rewind kernel,               clear meshes, snapshot if the key set
             restore MY snapshot from SQLite)          changed → gzip → SQLite rows;
                                                       compact if the OCCT heap ≥ COMPACT_AT_MB
                                                       or the kernel faulted
```

### 1. The cache: keys that mean the same thing in every run

CascadeStudio has always cached ops (`CacheOp`), but the keys could not be
trusted across runs: a 32-bit hash of the arguments in which any shape no
`CacheOp` produced was identified by its **kernel address**. Freed
addresses are reused, so a later run could match an unrelated shape — which
is why the Python runtimes emptied the cache before every run, and Python
re-runs got **0 hits**.

The stable mode (`createHeadlessCascade({stableCache: true})`) changes the key:

- ~106-bit hash (two cyrb53 lanes) of the op name + JSON arguments;
- a shape argument contributes **only a content-derived identity**:
  - the key of the `CacheOp` that produced it (object identity);
  - a key **derived** from keyed inputs — sub-shapes by (parent key, index)
    from the `ForEach*`/`DirectChildren` explorers, compounds from their
    children, and shapes returned by **pure library functions** that do not
    go through `CacheOp` (`OrderedEdges`, `ReverseFace`, `ThickenSolid`,
    `WireFromEdgesFixed`, …), derived lazily from that call's arguments;
  - the key of a cached result it `IsEqual()`s (a fresh wrapper of the same
    TShape/location/orientation, e.g. a TopoDS downcast);
- anything else (an unkeyed shape, any other embind object, a function, a
  class instance) makes the op **volatile**: computed, never cached, and its
  result poisons everything downstream — no address ever reaches a key;
- floats enter keys at **12 significant digits, |v| < 1e-10 snapped to 0**.
  Arguments computed from geometry carry round-off that depends on how a
  transform was composed; both thresholds sit far below OCCT's confusion
  tolerance (1e-7) and far above round-off.

Measured on the four bench models (Node, one engine, `/tmp/do/probe-stable.mjs`):
no volatile ops on any re-run, and a re-run hits every op.

### 2. Persistence: one binary-BREP compound

`snapshotCache()` writes every cached result with a content-derived key as
**one compound** in OCCT's binary BREP format (`BinTools`) plus a JSON index
— gzipped, in ≤1.9 MB SQLite rows (the 2 MB row cap). Skipped when the key
set has not changed since the last write.

- **One compound**, not a file per entry: BREP keeps shared sub-shapes
  shared within a file, so an op's input and output still share topology
  after a restore.
- **Binary, not text**: the round trip has to be bit-exact, because restored
  results feed the arguments of later ops and the keys hash those doubles.
  On maker_coin's 52 cached results (55,408 sampled vertex/edge values),
  `BinTools` differed in 0 values; `BRepTools` text in 21,331 (max relative
  5e-8). Binary is also ~5× faster to write and half the size. One residual:
  `BinTools` reads each transform back through `gp_Trsf::SetValues`, which
  re-derives scale and form, so rotated locations differ by ~1e-16 — the key
  rounding above absorbs it.
- **The op history rides along.** build123d's `Select.NEW`/`LAST` read the
  kernel's `BRepTools_History` record that each lite primitive leaves on its
  result (`._csHist`). It cannot be enumerated, so it is queried for every
  tracked sub-shape of the op's inputs and the non-empty answers are stored,
  with every referenced shape in the same compound (deduplicated on
  `IsEqual`). Without this, maker_coin's `fillet(edges(Select.NEW))` picked
  edges `[1,2,3,5,…]` after a restore instead of `[2,5,…]`.

### 3. Compaction: the per-request reset, minus the cache

The stateless Worker rewinds OCCT to its boot image after every job. That
reclaims everything an evaluation leaked (embind objects are never freed)
and heals a damaged kernel. A session cannot do that per request without
losing its cache, and without it heat_exchanger's OCCT heap grows
42 → 66 → 93 → 125 → 160 MB over five runs — past 128 MB on the fourth.

So when the OCCT heap reaches `COMPACT_AT_MB` (48) after a render — or the
render hit a kernel fault — the session snapshots, rewinds the kernel and
restores the snapshot: only the working set survives. Wasm memory never
shrinks, so this has to run before the growth, not after it.

### 4. Isolate sharing

Cloudflare may run several objects of one class **in the same isolate**,
sharing its 128 MB and its module globals ([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[metrics](https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/)).
cascade-core keeps its state on the global, so the engine is one per
isolate: a lock serializes the sessions, and `owner` records whose working
set is loaded. A session that finds another owner rewinds the kernel and
restores its own snapshot first — a context switch through BREP.

### 5. Keep-warm (optional, off by default)

Per the [lifecycle docs](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/),
an idle object with nothing pending **hibernates after ~10 s** and loses its
memory; one that cannot hibernate (a pending `setTimeout` is enough) is
**evicted after 70–140 s** without events. With `KEEP_WARM_MS` > 0 the
session holds a timer and re-arms a storage alarm every 30 s for that long
after the last render; duration is billed while it holds ($12.50 per million
GB-s at 128 MB, ≈ $0.0058 per hour). The edge measurements below show why
it defaults to 0: the engine is not in the object.

## Measured locally (`wrangler dev`, 2026-10-17)

`scripts/session-bench.mjs`, BREP output, client wall time; the stateless
column is the `/render` Worker on a warm isolate (median of 4, full
evaluation per edit). Local workerd runs roughly 3× faster than the edge
for the same code; the ratios are what carry over.

| model | stateless edit | session cold | re-run | edit 1 | edit 2 | restored after evict | snapshot (gz) |
|---|---|---|---|---|---|---|---|
| mount | 78 ms | 512 ms (incl. boot) | 38 ms | **29 ms** | 83 ms | 35 ms (restore 4 ms) | 16 KB |
| plate16 | 1.24 s | 1.35 s | 221 ms | **594 ms** | 640 ms | 600 ms (16 ms) | 109 KB |
| maker_coin | 3.8 s | 4.3 s | 1.9 s | **3.1 s** | 3.7 s | 3.1 s (7 ms) | 392 KB |
| heat_exchanger | 3.9 s | 4.0 s | 1.2 s | **1.9 s** | 3.1 s | 1.8 s (31 ms) | 321 KB |

Edits: mount — the final fillet radius / the bolt-hole diameter; plate16 —
the fillet over all 256 holes (the expensive op itself, so edit ≈ that op);
maker_coin — the label text / the detent fillet; heat_exchanger — the tube
weld fillet / the tube extension (which touches every tube).

- A restored session is as fast as a warm one: the restore is 4–31 ms and
  the following run hits exactly what the warm run hit.
- maker_coin and heat_exchanger compact after every render (OCCT heap 54 MB
  ≥ `COMPACT_AT_MB`); compaction runs after the response.
- **Where a 100%-hit re-run still spends time** (maker_coin, Node, 2.2 s):
  `project()` 1.3 s, the SUBTRACT `extrude`'s selection bookkeeping 0.6 s,
  `DoubleTangentArc`'s pure-Python optimizer 0.3 s — library work outside
  `CacheOp`. `project` rides on `ProjectWireOnShape`, which touches the
  scene list, so it cannot be cached generically; converting such functions
  to `CacheOp` one by one is the next step.

## Measured on the edge (deployed 2026-10-17)

`https://cascade-headless-session.makeshifted.workers.dev`, same bench, from
this machine; stateless = the deployed lite Worker
(`cascade-headless.makeshifted.workers.dev`, built from `feat/build123d-0.13`).
Client wall time, one run each — the edge's spread between placements is
large (below), so read these as ±2×.

| model | stateless cold | stateless edit | session cold | re-run | edit 1 | edit 2 | restored after evict |
|---|---|---|---|---|---|---|---|
| mount | 4.6 s | 553 ms | 4.0 s | 187 ms | **177 ms** | 497 ms | 269 ms |
| plate16 | 7.3 s | 4.5 s | 12.3 s | 1.0 s | **3.4 s** | 3.9 s | 4.0 s |
| maker_coin | 15.3 s | 12.6 s | 27.9 s | 10.3 s | **17.1 s** | 18.9 s | 17.5 s |
| heat_exchanger | 29.6 s | 25.1 s | 14.3 s | 2.9 s | **5.4 s** | 8.7 s | 5.1 s |

- **heat_exchanger: an edit is 5× faster than stateless** (5.4 vs 25.1 s),
  mount 3×. plate16's edit IS its most expensive op, so the session saves
  only the rest.
- **maker_coin gains nothing on the edge.** Its label edit recomputes the
  heavy tail, and the uncached library work (above) is large. The run above
  also landed on a slow placement: a second session on another isolate did
  cold 17.4 s and 100%-hit re-runs of 6.1–7.7 s (vs 10.3 s here) — ~3.4×
  local, the usual edge factor.
- The edge freezes the clock during CPU work, so the session's server-side
  phase timings read 0 there; use the client column.

### Keep-warm on the edge: the isolate matters, not the object

A session renders mount, idles, renders again (`/tmp/do/keepwarm.mjs`).
`instance` is the Durable Object (its constructor ran), `isolate` the JS
isolate holding the engine, `warm` = the working set was still loaded.

| idle gap | `KEEP_WARM_MS=300000` (timer + alarm) | `KEEP_WARM_MS=0` |
|---|---|---|
| 15 s | same instance, same isolate, warm (676 ms) | **new instance**, same isolate, warm (626 ms) |
| 60 s | same instance, same isolate, warm (153 ms) | new instance, same isolate, warm (768 ms) |
| 3 min | same instance, same isolate, warm (491 ms) | new instance, same isolate, warm (475 ms) |
| 7 min | new instance, **new isolate**: engine boot + restore of all 20 entries from SQLite, 20/20 hits (2.2 s) | new instance, **new isolate**: boot + restore, 20/20 hits (3.1 s) |
| 15 min | — | new instance, new isolate: boot + restore, 20/20 hits (5.7 s) |

Without keep-warm the object does hibernate after every gap — but the
engine lives at ISOLATE scope (§4), and the isolate outlived the object:
the next render found its working set loaded. Somewhere between 3 and 7
minutes idle the isolate goes, with or without keep-warm, and the SQLite
snapshot turns that cold return into a boot plus a restore (every op a hit)
instead of a full evaluation. One trial per cell: Cloudflare's isolate
lifetime is not a documented guarantee.

So **keep-warm is off by default** (`KEEP_WARM_MS = "0"`). A hibernated
object is not billed for duration (only an object "actively running" or
"idle in-memory and non-hibernateable" is), so a session costs its active
time instead of every second of the editing hour:

| per editing hour, an edit every 15 s | keep-warm on | keep-warm off |
|---|---|---|
| Durable Object duration (128 MB, $12.50/M GB-s) | 3,600 s → **$0.0058** | active time only: mount ~240 × 0.2 s → ~$0.0001; heat_exchanger ~240 × 5.4 s → ~$0.002 |
| requests (DO $0.15/M + front Worker $0.30/M) | 240 → $0.0001 | same |
| SQLite (rows written $1.00/M, storage $0.20/GB-month) | ≤4 rows per changed render, ≤0.4 MB per session → <$0.001 | same |

For comparison, the stateless Workers cost $0.061 (lite) to $0.26 (real)
per such hour on heat_exchanger (Workers-vs-container cost model,
2026-10-15) and take ~5× longer per edit.

## Correctness

`test/stable-cache-gate.mjs` runs every corpus script that passes on lite
(223, heat_exchanger run separately: the default skip list keeps the timeout-prone ones out) in **one long-lived engine**, four times each — with the previous
script's cache still loaded (`shared`), after a kernel rewind (`cold`, the
reference), from the cache (`warm`), and after snapshot → rewind → restore
(`restored`) — and compares every measured variable:

| | scripts |
|---|---|
| EXACT (byte-identical measurements) | 187 |
| CLOSE (same topology, volume/area ≤1e-6 rel., bbox ≤1e-6) | 36 (35 `restored`, 7 `shared`) |
| FAIL | 0 |

Zero misses on every `warm` and `restored` run and zero volatile ops.
CLOSE is the transform residual above (restored) or a cached result computed
under another script's heap layout (shared) — the class of difference two
cold runs in isolates with different allocation histories show.

Getting there found four real problems:

| found | fix |
|---|---|
| a restored entry shared one JS object with an `IsEqual` sibling, so the last key overwrote the others' | a fresh wrapper (`clone()`) per reference |
| `ForEachEdge` (and the mesher's) deduplicated on a 1e8-bucket address hash — din_rail_algebra lost 1 of 528 edges and every later `FilletEdges` index shifted with heap layout | a hash repeat is a repeat only if it `IsSame()`s (**every mode**) |
| `ThickenSolid` let `BRepOffsetAPI_MakeThickSolid` edit its input face in place (bicycle_tire: 28.300134 vs native 28.299963) — with a cache, the edited face was the cached one | work on a `BRepBuilderAPI_Copy` (**every mode**) |
| meshing (STL export, `measure`) writes triangulations into the cached shapes | `engine.clearMeshes()` after such renders |

## Limits and open ends

- **build123d-lite only.** Lite's kernel ops go through `CacheOp`. The
  upstream flavor's go through the OCP shim, which has no op cache yet; an
  upstream session would only get the warm engine (its boot is the bigger
  share there: ~1.1 s of CPU).
- **Re-runs still interpret Python.** A 100%-hit re-run costs the script's
  Python plus the library work lite does outside `CacheOp` (projection,
  selection bookkeeping, bounding boxes): summed over the corpus, re-runs
  take 57% of cold time (see the maker_coin breakdown above).
- **The in-memory cache holds the last run's working set only** (the
  end-of-run sweep is unchanged), so reverting an edit two steps back misses
  the ops in between.
- **Not bit-reproducible across the session's history**: results can differ
  from a cold run by the CLOSE margin. A final export can be re-run cold.
- Snapshot keys are salted with the engine bundle hash (`assets/bundle-id.json`):
  a deploy invalidates every stored snapshot.
