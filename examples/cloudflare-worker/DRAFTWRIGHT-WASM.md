# Drawings on the MCP endpoint: draftwright as WebAssembly

*2026-10-18. The question: can [draftwright](https://github.com/pzfreo/draftwright) (Paul
Fremantle's automated engineering-drawing generator) run inside the MCP endpoint ([MCP.md](MCP.md)),
so an agent can hand the person a dimensioned, toleranced drawing? This is gap 6 in
[AGENTIC-CAD-GAPS.md](AGENTIC-CAD-GAPS.md).*

*Everything here was measured locally, in Node 22 and in `wrangler dev` (workerd, wrangler
4.125.0). Nothing was deployed. Downloaded sources and packages were kept outside the repository
and are not committed. The probe scripts are in `experiments/draftwright-wasm/` (§5).*

## Summary

**Yes, through the Rust port.** [draftwright-rust](https://github.com/pzfreo/draftwright-rust)
publishes a browser wasm package, `draftwright-wasm`. It has no OpenCascade and no Python: it reads
a STEP file with its own Rust B-rep kernel (haecceity, from
[quiddity-rust](https://github.com/pzfreo/quiddity-rust)) and returns SVG and PDF bytes.

Our sessions already export STEP, so the pipeline is: `show()`n object → STEP → `draftwright-wasm`
→ drawing.

| | plate (13 faces) | bearing mount (21 faces) |
|---|---|---|
| compile + init in Node | 24–34 ms | |
| compile + init in workerd (module binding) | ~1 ms | |
| analyse + plan | 0.6–0.7 s | 1.4–1.5 s |
| render SVG + PDF | 17–25 ms | 32–43 ms |
| wasm memory | 11–15 MB | 15–23 MB |

- **Package:** 15.1 MB raw for `v0.1.0-alpha.5` (its docs quote 13.6 MB raw / 3.0 MB Brotli for an earlier build).
- **Bundle size:** the session Worker is 25.5 MiB of the 64 MiB limit, so it would fit even in the
  same Worker.
- **Drawing quality:** right on the parts tried. See §2.
- **The limit is dense parts:** 200–300-face parts need 66–540 MB and 7–18 s, and NIST CTC-02
  (637 faces) needed 98 s. They don't fit a 128 MB isolate. See §3.
- **Licence:** AGPL-3.0, and the author runs a hosted product. This needs a decision before
  shipping. See §4.
- **Built:** a separate drafting Worker plus the `make_drawing` tool, verified locally (§5).

**The Python route was also tried:** Python draftwright on our real-build123d Pyodide flavor. It
produces a correct drawing too, but only with a stack of polyfills, and it needs ~128 MB of wasm
before V8 is counted, so it doesn't fit a Worker. It is recorded in §6 because it found real gaps
in the OCP shim.

## 1. What draftwright-rust is

- **Status:** a pure-Rust port, "alpha 5" (`v0.1.0-alpha.5`, 2026-10-18). Each `v*` release
  attaches `draftwright-wasm-<version>.tgz` plus a SHA-256 file; it is not on npm.
- **What it draws:** front, plan, side and iso views from hidden-line projection; section A–A; the
  dimension planners (envelope, holes and patterns with counterbore/countersink callouts, slots,
  bosses, fillets, chamfers, steps); hole tables; lint.
- **PMI:** it reads AP242 PMI from the STEP and draws feature control frames, datums and
  toleranced dimensions.
- **Output:** PDF with embedded subset fonts and searchable text, plus SVG. DXF is drawn, but its
  export is disabled for now.
- **Self-reporting:** every drawing reports what it could not state, as coded problems.
- **Known limits** (its README): leader crossings and ink overlaps on dense parts. It is checked
  against Python draftwright's output, with a verdict recorded for every difference.
- **API:** an `Engine` session over JSON strings.
  - `new Engine(name, stepBytes)` analyses and plans.
  - `snapshot()` returns `{problems, plan, spec, svg, …}`.
  - `apply(opsJson, commit)` edits the Spec, e.g. `{op: 'set', path: 'sheet/title/material', …}`.
  - `undo()`/`redo()`; `renderSvg()`/`renderPdf()` return bytes.
  - `setPmi(...)` attaches Specify's PMI.
  - Errors throw a JSON string `{code, message, choices}`.
- **Host imports:** only the panic hook's three; no clock, filesystem or threads.

## 2. Measured

**Pipeline in Node** (`rust-wasm.mjs`): the lite headless engine (MicroPython, the session's
engine) builds the part and exports STEP, then `draftwright-wasm` draws it.
- **The README's mounting plate:**
  - 37.6 KB of STEP; 13 faces, 5 features recognised.
  - A4 at 1:2, with section A–A and the callouts `⌀18 THRU ⊔ ⌀30 ↧14` and `4× ⌀8 THRU (2×2)`.
  - Five problems, among them `general_tolerance_missing` (which carries a suggested fix op) and
    `extension_through_feature` ×2. These are exactly the kind of feedback an agent can act on.
- **The editor's starter bearing mount:**
  - 21 faces, 14 features.
  - A3 at 2:1, with `4× R12`, `4× ⌀6 THRU (2×2)`, `⌀16 THRU`, `⌀34`, the `⌀5 THRU` set screw
    and `2× R1.5`.
  - Two problems.

**workerd** (`worker/`): a 40-line Worker imports the `.wasm` as a module binding and calls
`initSync({module})`, since workerd can't compile wasm at runtime.
- The plate plans in 615 ms and renders in 17 ms, using 15 MB.
- A non-STEP body comes back as a clean JSON `invalid` error.
- The PDF matches the Node render's text.

## 3. Dense parts

Fresh Node process per part (wasm memory only grows, so one isolate carries its high-water mark
into the next request), using draftwright-rust's own test fixtures:

| part | faces | features | plan | wasm memory |
|---|---:|---:|---:|---:|
| plate | 13 | 5 | 0.7 s | 11 MB |
| bearing mount | 21 | 14 | 1.5 s | 15 MB |
| internal_station | 222 | 54 | 7.3 s | 124 MB |
| gear_wheel | 292 | 1 | 11.0 s | 66 MB |
| bracket_positions (AP242) | 286 | 31 | 15.5 s | 252 MB |
| NIST FTC-10 (AP242) | 282 | 74 | 18.5 s | 538 MB |
| NIST CTC-02 (AP242) | 637 | 141 | 98 s (workerd) | — |

Memory follows recognition and hidden-line work, not face count alone (gear_wheel versus FTC-10).
Agent-built parts are usually in the first two rows, but CADGenBench-class parts reach the rest.

Options for dense parts:
- **Gate:** refuse above a face or feature budget, with a clear message.
- **A container:** a [Cloudflare Container](https://developers.cloudflare.com/containers/) running
  the native `draftwright` binary (`draftwright serve` is a JSON-lines service), which has gigabytes
  of memory and no CPU cap.
- **Upstream:** report the peaks to pzfreo. The 538 MB on FTC-10 looks like an analysis
  high-water mark, which may well be reducible.

## 4. Licence and the author

- **The licence:** draftwright, draftwright-rust and quiddity-rust are all **AGPL-3.0-only**, with
  a CLA for contributors (which suggests dual licensing).
- **What AGPL asks of a public service:** §13 means users who interact with it over the network
  must be offered the Corresponding Source. For an unmodified upstream release, that is a link to
  the exact tag plus the licence, shown in the tool output and the docs.
- **Keep it a separate program.** Running it in its own Worker, reached by service binding, keeps
  CascadeStudio's MIT code a separate program rather than one combined work. That is cleaner for
  the licence, and it also keeps draftwright's memory out of the session DO's 128 MB.
- **The author's hosted product.** pzfreo runs a hosted, OAuth, beta connector, **Specify +
  Draftwright**, at `https://mcp.draftwright.io/mcp-stateless`
  ([plugin](https://github.com/pzfreo/draftwright-claude-plugin)). It has MCP Apps cards and
  account limits. A free embedded copy would compete with it. He also wrote build123d-mcp, whose
  harness we ported. **Recommendation:** ask him before shipping. That could also turn into a
  collaboration: he publishes the wasm package for exactly this kind of embedding.
- **Why not just use his connector?** Users could add both connectors, but remote MCP servers have
  no sanctioned way to pass a file between them. The model would have to carry the STEP, which is
  the sandbox-egress problem again. Embedding is the only one-hop path.

*This is an engineering reading of the licence, not legal advice.*

## 5. Built: the drafting Worker and `make_drawing`

Built and verified locally, not deployed. See [drafting/README.md](drafting/README.md).
1. **`drafting/`, the `cascade-drafting` Worker:**
   - `scripts/fetch-draftwright.mjs` downloads the pinned release (`v0.1.0-alpha.5`, whose `.wasm`
     is 15.1 MB, not the 13.6 MB in its docs), checks its SHA-256 and unpacks it into the
     gitignored `drafting/vendor/`.
   - The Worker exposes `draw()`/`info()` as Workers RPC (`entrypoint = "Drafting"`), plus a curl
     HTTP surface for `wrangler dev`.
   - It has no public URL (`workers_dev = false`), and the directory carries the AGPL text.
2. **The session Worker's `DRAFTING` service binding:** `tools/list` shows `make_drawing` only
   where it is bound.
3. **The `make_drawing` tool:**
   - It draws one shown object (`object_name` when several).
   - Title block and sheet arguments become Spec ops; `ops` passes raw ones, including a problem's
     own fix.
   - It stores the PDF and SVG as session files and lists the problems with their fixes.
   - It names both sources.
   - The STEP is written inside the engine queue and the drawing awaited outside it (an `outside`
     continuation in `mcpTool`). Measured locally: another session's `measure` returned in 323 ms
     while a 66-face drawing took 3.2 s.
4. **A face limit** (`MAX_FACES`, default 80): the Worker counts the STEP's faces before opening
   it. The calibration table is in the drafting README.
5. **`scripts/mcp-test.mjs`:** ten drawing checks when the binding is present, all passing locally.
   They cover the sheet line, the PDF magic, the title block fields, a problem's fix, a bad edit,
   JSON-text `ops`, the one-part rule and the face limit.

**Still open:**
- **Deployment:** deploy the drafting Worker before the session Worker binds it.
- **Edge memory accounting:** tune `MAX_FACES` from a deployed run.
- **Persisting the Spec between calls:** each call starts from the defaults plus its own ops.
- **A container for parts over the limit.**
- **The licence and author question in §4.**

**Probe scripts** are in [`experiments/draftwright-wasm/`](../../experiments/draftwright-wasm/),
whose README covers fetching the release and the wheels:
- `rust-wasm.mjs`: the lite STEP → drawing pipeline.
- `rust-step.mjs`: one STEP file per fresh process, for time and memory.
- `worker/`: the workerd probe.
- `pyodide/`: the Python route, including `extend-shim.py`, which regenerates the shim with
  draftwright's names billed.

## 6. Record: Python draftwright on the Pyodide real flavor

Before the Rust package turned up, Python draftwright 0.5.0.dev0 (`f1a5db9`) was run on our
`pysrc=real` flavor: Pyodide 314.0.4, the unmodified build123d 0.13.0 wheel, and the
OCP-over-embind shim.

**Dependencies:**
- **Not on the Pyodide index (17 extra packages, ~12 MB of wheels):**
  - pure Python: draftwright, quiddity 0.3.10, build123d-drafting-helpers 0.15.5, ezdxf,
    svgpathtools, svgwrite, fonttools, reportlab 5, svglib, tinycss2, cssselect2, steputils,
    antlr4 4.9.3 (unpacked from its sdist);
  - wasm builds from Pyodide's CDN: lxml and Pillow.
- **Left out:** pypdfium2 (PNG only).

**Result.** `build_drawing` + `lint` + SVG/PDF/DXF exports all ran, and the plate drawing was
correct, with section A–A.

**Cost.** It doesn't fit a 128 MB isolate:
- the real-flavor boot is 3.1 s, and `import draftwright` adds 1–1.6 s;
- the Python wasm heap is 90 MB after import and 108 MB after drawing, plus 20 MB of OCCT,
  before V8 is counted;
- `build_drawing` takes 4.4–5.6 s;
- the exports take 1.1 s (SVG), 1.8 s (PDF) and 3 s (DXF).

**Gaps it found in our OCP shim.** These are worth fixing for the real and upstream flavors
anyway.
- **Generator:** the shim generator bills classes only from build123d's
  `geometry.py`/`topology/`. So bound classes that the exporters or other libraries use were
  inert stubs (`GeomConvert_BSplineCurveToBezierCurve`, `BRepIntCurveSurface_Inter`,
  `STEPControl_Reader`, …), and registry classes like `TopTools_ListOfShape` weren't re-exported
  by their module.
  - Fix: bill the exporters too, and re-export the registry classes by module.
- **pybind parity:**
  - `gp_*.Coord()` with out-params;
  - iterating `TColgp`/`TColStd` arrays (`Poles()`);
  - `float * gp_Vec` (`__rmul__`);
  - `GeomConvert.SplitBSplineCurve_s`'s default `SameOrientation`. The dispatch table only has
    defaults for billed statics, and JS hands integral reals back as `int`, which defeats type
    sniffing.
- **Glue:**
  - `real_glue`'s no-op `ExportSVG` predates real svgpathtools;
  - lite text rejects `font_path=`;
  - `BRepTools.Write_s` to a Python stream has no bridge.
- **Missing fork bindings:**
  - `BRepClass_FaceClassifier`;
  - `IntCurvesFace_ShapeIntersector`;
  - `ShapeAnalysis_Surface`/`CanonicalRecognition`;
  - `BRepCheck_Status`;
  - the XCAF dimension and tolerance readers (`XCAFDoc_DimTolTool`, `XCAFDoc_Datum`,
    `XCAFDoc_Dimension`, `XCAFDoc_GeomTolerance`, `TDF_Tool`, `TDF_LabelSequence`);
  - the OSD thread pool.

  The probe got by with Python stand-ins over bound classes (`BRepIntCurveSurface_Inter`,
  `BRepExtrema_DistShapeShape`); real bindings belong in the fork's YAML. The XCAF readers are
  also what an assembly/PMI round would need ([AGENTIC-CAD-GAPS.md](AGENTIC-CAD-GAPS.md) §5).
