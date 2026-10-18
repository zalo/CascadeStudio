# cascade-drafting: engineering drawings from STEP

A Worker of its own around [draftwright-rust](https://github.com/pzfreo/draftwright-rust)'s wasm
package. draftwright-rust is Paul Fremantle's pure-Rust port of draftwright; it reads a STEP file
with its own B-rep kernel (no OpenCascade) and plans a dimensioned sheet:
- views, a section where one helps, and hole and feature callouts;
- a title block, with the PMI read from AP242;
- lint, and coded problems with suggested fixes.

The session Worker reaches it over a **service binding** and calls `draw()` as Workers RPC. That
is the MCP tool `make_drawing` ([../MCP.md](../MCP.md)).

**Licence.** This directory is **AGPL-3.0-only** ([LICENSE](LICENSE)), unlike the rest of the
repository (MIT):
- **Why:** it links draftwright-rust, which is AGPL-3.0-only.
- **The boundary:** CascadeStudio's own code stays a separate program on the other side of the
  binding.
- **The source offer (AGPL section 13):** every drawing carries the engine's source (the pinned
  release tag) and this service's source (`SERVICE_SOURCE_URL`), and `make_drawing` shows both.
- **Not committed:** the package itself. `scripts/fetch-draftwright.mjs` downloads the pinned
  release, checks its SHA-256 and unpacks it into `vendor/` (gitignored).

## Running it

```sh
npm run dev:drafting     # fetch + wrangler dev on :8788
npm run dev:session      # in another shell: the session Worker binds DRAFTING to it
```

wrangler's dev registry connects the two: `dev:session` prints
`env.DRAFTING (cascade-drafting#Drafting) ... [connected]`. Without the drafting process, it
says `[not connected]`, and `make_drawing` returns "the drawing service is unavailable".

```sh
curl http://127.0.0.1:8788/                                          # what is running, and its source
curl -X POST --data-binary @part.step 'http://127.0.0.1:8788/draw'               # JSON summary
curl -X POST --data-binary @part.step 'http://127.0.0.1:8788/draw?format=pdf' -o part.pdf
curl -X POST --data-binary @part.step "http://127.0.0.1:8788/draw?ops=$(python3 -c 'import json,urllib.parse;print(urllib.parse.quote(json.dumps([{"op":"set","path":"sheet/title/material","value":"AlMg3"}])))')"
```

**Deploy this before the session Worker:**

```sh
npm run deploy:drafting  # cascade-drafting, no public URL (workers_dev = false)
npm run deploy:session
```

## The RPC surface

- **`draw(step, {name, ops, formats})`:**
  - `step` is STEP bytes or text; `name` gives the default title.
  - `ops` are draftwright Spec edits, e.g. `{"op": "set", "path": "sheet/title/tolerance", "value": "ISO 2768-m"}`.
    The title block fields are `title`, `number`, `material`, `tolerance`, `drawn_by`,
    `approved_by`, `date`, `revision`, `company` and `document_type`, under `sheet/title/`. The
    sheet fields are `sheet/size`, `sheet/scale` and `sheet/projection`.
  - `formats` is a subset of `["pdf", "svg"]`.
- **What `draw` returns:**
  - On success: `{ok: true, faces, features, sheet: {size, scale}, views, status, completeness,
    dimensions, problems: [{severity, code, message, id, fix}], spec, pdf, svg, ms, memoryMB, engine,
    license, engineSource, serviceSource}`.
  - On failure: `{ok: false, code, message}`, where `code` is `too_large`, `invalid` (bad STEP or
    bad ops) or `failed`.
- **`info()`:** the face limit, the formats and the source information.

## Memory: the face limit

draftwright's wasm memory grows with the part and never shrinks. Measured in Node, one fresh
process per part, on parts exported by build123d-lite:

| part | faces | plan | wasm memory |
|---|---:|---:|---:|
| shaft (revolved, grooved) | 11 | 0.6 s | 12 MB |
| bearing mount (the editor's starter) | 21 | 1.5 s | 15 MB |
| plate, 4×4 holes | 22 | 1.2 s | 23 MB |
| bracket (pocket, slots, holes) | 31 | 1.5 s | 24 MB |
| plate, 6×5 holes | 36 | 1.6 s | 39 MB |
| plate, 8×6 holes | 54 | 2.6 s | 65 MB |
| plate, 10×6 holes | 66 | 3.4 s | 74 MB |
| plate, 10×8 holes | 86 | 4.7 s | 95 MB |
| plate, 8×5 counterbored holes | 126 | 4.9 s | 112 MB |

A Worker isolate has 128 MB, which counts V8's heap and the 15 MB module's compiled code as well.
So `MAX_FACES` (wrangler.toml, default 80) refuses bigger parts before opening them, counting the
STEP's `ADVANCED_FACE` entities.

**On the edge** (deployed 2026-10-18, through the live MCP `make_drawing`, with the limit lifted
for the test):

| part | faces | `make_drawing` wall time | drafting CPU (`wrangler tail`) | result |
|---|---:|---:|---:|---|
| plate with a bore | 7 | 0.3–0.5 s warm, 1.5 s cold | — | drawn |
| plate, 6×5 holes | 36 | 10.3 s (first call) | 8.6 s | drawn |
| plate, 8×6 holes | 54 | 7.8 s | 6.6 s | drawn |
| plate, 10×6 holes | 66 | 10.4 s | 9.0 s | drawn |
| plate, 10×8 holes | 86 | 12.7–15.8 s | 13.4 s | drawn |
| plate, 8×5 counterbored | 126 | 12.9–19.2 s | 13.1 s | drawn on a fresh isolate or after the 86; out of memory once |
| plate, 12×10 holes | 126 | 22–30 s | 24.0 s | out of memory, twice |

- **Speed:** the edge runs about three times slower than a local machine.
- **The ceiling depends on the isolate's history.** wasm memory never shrinks, so a part that fits
  a fresh isolate can fail after a big one.
- **Failures are clean, in two forms:**
  - `memory.grow` refused: the glue throws "Invalid array buffer length", and `draw()` returns
    `code: 'out_of_memory'`;
  - the isolate killed: the binding call throws "Worker exceeded memory limit".

  `make_drawing` reports both as "ran out of memory", and the next request gets a working (or
  fresh) isolate; a 7-face part drew in 0.3–0.5 s right after each failure.
- **Why 80:** it stays below the largest part that drew every time (86), because memory per face
  varies. A NIST FTC-10 part needs ~1.9 MB per face.

To move to a newer draftwright-rust release, change `VERSION` and `SHA256` in
`scripts/fetch-draftwright.mjs` and run it with `--force`.
