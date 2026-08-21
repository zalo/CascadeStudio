# Heavy-model memory round — state (2026-08-21)

Branch: `feat/heavy-model-memory` (on top of 85bcda2, the completed
pysrc=real state). Mission: make heavy models memory-efficient on
`?pyruntime=pyodide&pysrc=real`, attribution first. Everything below is
measured on this machine (fresh page per memory cell — OCCT wasm never
shrinks; `CS_TEST_HEADFUL=1 DISPLAY=:99`, server on 8441).

## Phase 1 — attribution (all measured)

1. **embind lifetime is the whole 286-vs-165 delta.** Nothing in the stack
   ever called `.delete()` (grep: 0 in StandardLibrary/StandardUtils/
   CascadeWorker/OcpShim). The wasm glue HAS embind's FinalizationRegistry
   code, but `attachFinalizer` only registers smart-ptr handles and this
   build creates none (`$$.smartPtr` always false — probed). heat_exchanger
   on pysrc=real leaks **265,598 embind objects**: TopoDS_Shape 91,734 /
   gp_Vec 31,179 / TopoDS_Edge 29,192 / gp_XYZ 24,511 / TopoDS_Face 18,286 /
   TopoDS_Vertex 17,494 / gp_Pnt 12,440 / gp_Trsf 10,436 / TopLoc 6,136 /
   BRepAdaptor_Curve 4,133 / BRepBuilderAPI_Copy 602 /
   ShapeUpgrade_UnifySameDomain 161 / TopExp_Explorer 220. mp+upstream:
   identical (265,590) → interpreter-independent, the shim owns it.
2. **Cache/history**: real leg pins ~nothing (argCache 0 — CacheOp only
   runs via the lite glue; history 156 steps but 1 shape ref, scene is
   assembled at end). Lite legs: argCache 607 entries, modelHistory 1049
   steps pinning **107,409** JS shape refs (O(steps × scene) snapshots) —
   irrelevant to wasm while nothing deletes; they matter as the PROTECTION
   set once deletion exists. (The user's earlier in-run
   `_w.Object.keys(_w.argCache)` probe failed because worker logs post
   asynchronously and MicroPython proxies print opaquely — reading the
   counts from `memoryStats()` after the run works; note argCache is
   cleared at the START of the next run, pruned-to-used at end of each.)
3. **Upstream-vs-lite delta** = leaked-intermediate volume (the ledger
   above), not a bigger final model. Confirmed by the fix: with frees on,
   the EVALUATION phase of pysrc=real ends at 95.8 MB vs lite's 48.4.
4. **MicroPython churn**: arena (its wasm heap) ratchets 20→33→77→129→258→
   386→463-612 MB across the run with **1.2 MB live after collect**;
   `gc.threshold` returns 16384 but is a NO-OP (8 MB / 256 KB / 1 MB
   settings → byte-identical 612.0); explicit `gc.collect()` every 8192
   proxy creations RUNS (counted: 32/heavy) and changes nothing; JS GC
   hints mid-run (worker `globalThis.gc()` under --expose-gc) change
   nothing. The port grows its split GC heap on allocation bursts between
   any collect cadence reachable from Python → **needs an interpreter patch**
   (micropython-cs follow-up: MICROPY_GC_ALLOC_THRESHOLD or
   collect-before-grow). Kept as a note in ocp_core.py.

Also measured (ownership semantics, via in-worker JS probes):
- `builder.Shape()`, `Explorer.Current()`, `TopoDS_Cast.*` return fresh
  OWNING copies (distinct `$$.ptr`) → safe to `.delete()`.
- `Handle_X.get()` returns a NON-owning alias (same ptr, fresh `$$`,
  count=1) → deleting the raw double-frees; delete the HANDLE instead.
- Freed objects DO reuse within the arena (12-sphere probe).
- All arena sizes sit on emscripten's ×1.2 geometric growth ladder
  (…138, 165.2, 198.3, 237.8, 285.4, 343.5…): deltas are rung-quantized.

## Phase 2 — fixes landed (commit aa37265)

- **OcpShim deterministic lifetime (default ON, `?ocplt=leak` to A/B)**:
  retain-on-return (`_csPy`, set JS-side — no extra FFI call),
  `OcpProxy.__del__` → `_csOcpFree` (ocp_core_pyodide.py; CPython refcount =
  prompt), queued frees flushed at op boundaries (recordExternalOp) +
  eval start/end + every 4096. Protection set: sceneShapes, history steps,
  externalShapes, argCache, fuse-guard-pinned operands. Transient allow-list
  (BRepAdaptor_/GeomAdaptor_/Geom2dAdaptor_/ShapeUpgrade_UnifySameDomain/
  ShapeFix_{Shape,Wire,Face,Solid}); `_csHandled` marking at every
  handle-wrap site; `_csOwnH` owner-handle riding on deref'd raws. Scratch
  deletion of dispatch-internal temporaries. Fuse-guard glue hardened
  ($$-ptr checks + operand pinning Append→Shape) and its own temporaries
  freed.
- **ShapeToMesh cleanup (all legs)**: per-node gp_Pnt/gp_Dir copies, per-face
  handles/locations/iso curves/adaptors/tangDefs, explorer+cast copies, the
  mesher object; **BRepTools.Clean after extraction** (Nullify never
  detached triangulations from TShapes; a REMESH of a still-triangulated
  shape leaked the old mesh — isolated: 6 remeshes of one sphere 286→697 MB
  without Clean, FLAT with it; cached shapes now remesh on re-eval:
  heat_exchanger re-eval +3 s, typical models ms).
- **CascadeWorker**: previous `currentShape` deleted at evaluate start;
  `?lowmem=1` (EditorManager `resolveLowMemory`, plumbed via
  payload.lowMemory): history metadata-only (meshHistoryStep logs a note) +
  `_deleteEmbindTree` on pruned argCache entries; `memoryStats()` extended
  with argCacheCount/sceneShapesCount/historySteps/historyShapePins/
  ocpStats (created/freed/alive, topClasses, topAlive, errs) and a
  triangulation census of currentShape.
- **PyodideRuntime**: `gc.collect()` at the old→new module swap inside
  run_user (cyclic builders die before the new run allocates; reset_state's
  collect was too early — old module still in sys.modules).

## A/B results (fresh pages, heat_exchanger)

| leg | before | after | notes |
|---|---|---|---|
| pyodide+real | 286.3 | **238.5** | alive 265,598 → ~5.6k; eval 15.5-16 s unchanged; `?ocplt=leak` reproduces 286.3 |
| pyodide+lite / mp+lite / brython | 165.6 | **138.0** | mesher cleanup rung |
| mp+upstream | 286.3 | 286.3 | no `__del__` on MicroPython; arena 612 (port-level, see above) |
| starter / grid (all legs) | 32.0 | 32.0 | floor everywhere |

Phase split (in-worker marks, pysrc=real): eval-end 95.8 MB → mesh-end 238.5
— the mesh phase (~100-140 MB inside the BRepMesh_IncrementalMesh ctor) is
kernel-internal and identical on every leg (lite: 48.4 → 173.7 pre-fix).
Known limitation: REPEATS of the same heavy model in one session still
ratchet ~85-100 MB/run (lite ~35/run) — free-space probes (1 MB/64 KB
census: `probe-free2.mjs`, `_csMemFreeProbe`) show freed memory exists but
each run's mesh transient crosses another growth rung (fragmentation +
ladder); Clean bought one rung from run 3. No wrapper-level leak remains
(alive stays ~5.6k across runs; triangulation census 0; guarded-entry error
count 0 — the exception-leak hypothesis is dead).

## Target verdict

Mission target was ≤ ~180 MB (old-lite parity). Landed: **238.5 MB default**
(new lite parity is 138; both carry the same ~100-140 MB kernel mesh-phase
transient). The remaining gap to lite is upstream's genuinely bigger kernel
transients (149-edge fillet, mirror-fuse, clean/UnifySameDomain stacked at
end-of-eval: 95.8 vs 48.4 eval-end) — not reachable by lifetime work.
`lowmem=1` doesn't move single-run numbers (measured); it bounds
history/cache retention for editing sessions.

## Tools (all in experiments/heavy-memory/)

- `measure.mjs` — matrix cells: `--runtime --pysrc --model starter|grid|heavy|all
  --query 'lowmem=1' --repeat-eval N`.
- `probe-marks.mjs` — per-run eval-end/mesh-start/mesh-end marks (+ free
  census when the page sets `self._csMemFreeProbe=1`).
- `probe-curve2.mjs` — mid-run wasm curves (note() samples every 8192
  creations; `self._csMemSampleMask` overrides).
- `probe-free2.mjs` / `probe-frag.mjs` — arena free-space census.
- `probe-tri.mjs` — alive-by-class + triangulation census per run.
- `probe-mpgc2.mjs` / `measure-gcthresh.mjs` / `probe-mp-gc.mjs` — the
  MicroPython arena experiments.

## Post-gate fix: arg-wrap handle lifetime (the one real regression)

The first harness pass caught it: `ConstrainedArcs` scripts died on the
SECOND `Geom2d_TrimmedCurve(circle, ...)` — OCCT's TrimmedCurve ctor COPIES
its basis curve instead of retaining the handle, so the pre-wrap handle the
shim creates around a Python-owned raw transient is that object's ONLY
refcount; scratch-deleting it destroyed the user's circle ("null function"
on the next virtual call, surfaced as the pre-wrap conversion error).
Wrap-handles now ride on the raw (`_csArgH`, like `_csOwnH`) and are
released only when the raw's Python proxy dies. (Two other first-pass
"regressions" were environmental: /tmp/b123d — the upstream clone the
harness reads STEP assets from — had been tmp-cleaned; restored as a
symlink to ~/Desktop/build123d.)

## Gates (this round)

- Fast specs (python-mode, py-runtime, py-src-upstream, py-src-real): 14/14
  green post-change.
- pyodide+real harness: **216/3/2/1 — per-script IDENTICAL to the committed
  results.json** (148 s, 4 pages).
- micropython default harness: **217/1/3/1** — strictly in the documented
  216-band (non-PASS set = {dual_color_3mf, objects_2d, curved_support,
  objects_1d, spitfire}: a strict SUBSET of the committed set; the known
  flaps — twist_extrude, tips/b04, heat_exchanger — all landed PASS-ward).
- pyodide+lite AND Brython control: **206/10/5/1 — the exact committed
  sets**, both.
- Full playwright suite: **101 passed** (2.1 m).

The first harness pass surfaced two ENVIRONMENTAL failures (import_step
assets: /tmp/b123d had been tmp-cleaned — restored as a symlink to
~/Desktop/build123d; run.sh/collect.py expect that clone) and ONE real
regression (arg-wrap handle lifetime, fixed above).
