# Editing sessions on Durable Objects

`--env session` keeps an **editing session** warm: one Durable Object per
session id holds a build123d-lite engine whose op cache survives between
edits, so an edit recomputes only what it changed — and the cached working
set is persisted in the object's SQLite storage, so it survives eviction too.

```bash
npm run dev:session          # prepare-assets + wrangler dev --env session
curl -sX POST http://localhost:8787/session/demo/render -H 'content-type: application/json' \
  -d '{"code":"from build123d import *\nshow(Box(10,10,10))","formats":["brep"]}'
BASE=http://127.0.0.1:8787 node scripts/session-bench.mjs --models mount,plate16
```

| route | |
|---|---|
| `POST /session/<id>/render` | `{code, formats, measure?}` → the `/render` JSON plus `cache` (hits/misses/volatile) and `session` (warm?, restore, server phase timings, the previous render's post-response work) |
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

### 5. Keep-warm

Per the [lifecycle docs](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/),
an idle object with nothing pending **hibernates after ~10 s** and loses its
memory; one that cannot hibernate (a pending `setTimeout` is enough) is
**evicted after 70–140 s** without events. For `KEEP_WARM_MS` (5 min) after
the last render the session holds a timer and re-arms a storage alarm every
30 s. Duration is billed while it holds ($12.50 per million GB-s at 128 MB,
≈ $0.0058 per hour). `KEEP_WARM_MS=0` turns it off; persistence makes a cold
return cost a boot plus a restore instead of a full evaluation.

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
  Python plus the kernel queries lite makes outside `CacheOp` (bounding
  boxes, selectors): summed over the corpus, re-runs take 57% of cold time.
- **The in-memory cache holds the last run's working set only** (the
  end-of-run sweep is unchanged), so reverting an edit two steps back misses
  the ops in between.
- **Not bit-reproducible across the session's history**: results can differ
  from a cold run by the CLOSE margin. A final export can be re-run cold.
- Snapshot keys are salted with the engine bundle hash (`assets/bundle-id.json`):
  a deploy invalidates every stored snapshot.
