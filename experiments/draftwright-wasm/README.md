# draftwright as WebAssembly: the probes

These are the scripts behind
[examples/cloudflare-worker/DRAFTWRIGHT-WASM.md](../../examples/cloudflare-worker/DRAFTWRIGHT-WASM.md).
Nothing from draftwright is committed. The release package and the wheels are fetched into
directories you name, and the scripts never import anything from the repo's source tree beyond
`packages/cascade-core/dist` (build that first).

## The Rust package (the recommended route)

```sh
v=0.1.0-alpha.5
mkdir -p /tmp/dw-rel && cd /tmp/dw-rel
gh release download "v$v" --repo pzfreo/draftwright-rust --pattern "draftwright-wasm-$v.tgz*"
sha256sum -c "draftwright-wasm-$v.tgz.sha256" && tar -xzf "draftwright-wasm-$v.tgz"
cd -   # back to the repo

# STEP from the lite headless engine (the MCP session's engine), then a drawing
DW_WASM_PKG=/tmp/dw-rel/pkg node experiments/draftwright-wasm/rust-wasm.mjs [part.py]
# one STEP file per fresh process: plan/render time and peak wasm memory
DW_WASM_PKG=/tmp/dw-rel/pkg node experiments/draftwright-wasm/rust-step.mjs part.step

# under workerd: the wasm as a module binding
cp /tmp/dw-rel/pkg/draftwright_wasm.js /tmp/dw-rel/pkg/draftwright_wasm_bg.wasm experiments/draftwright-wasm/worker/src/
(cd experiments/draftwright-wasm/worker && ../../../examples/cloudflare-worker/node_modules/.bin/wrangler dev --port 8797)
curl -X POST --data-binary @part.step 'http://127.0.0.1:8797/draw'               # JSON summary
curl -X POST --data-binary @part.step 'http://127.0.0.1:8797/draw?format=pdf' -o part.pdf
```

The Worker's `compatibility_date` is 2026-08-27 because the workerd that ships with wrangler
4.125.0 supports nothing newer.

## Python draftwright on the Pyodide real flavor (the record)

`pyodide/run.mjs` boots `pysrc=real` (Pyodide plus the build123d 0.13.0 wheel plus the OCP shim)
and installs these into site-packages before `import build123d`:
- **Pure-Python wheels from PyPI:** pyparsing, fonttools, ezdxf 1.4.5, svgwrite, svgpathtools,
  steputils 0.1, quiddity 0.3.10, build123d-drafting-helpers 0.15.5, charset-normalizer,
  reportlab 5.0.1, webencodings, tinycss2, cssselect2, svglib 2.3.0.
- **wasm builds from `cdn.jsdelivr.net/pyodide/v314.0.4/full/`:** lxml, Pillow.
- **`antlr4-src.zip`:** the `antlr4` package from the 4.9.3 sdist.
- **`draftwright-src.zip`:** `src/draftwright` plus a minimal `dist-info/METADATA`, because
  draftwright reads its own version.

Put them in one directory with the file names listed in `EXTRA`, then:

```sh
python3 -I experiments/draftwright-wasm/pyodide/extend-shim.py /tmp/dw-gen
node /tmp/dw-gen/gen-ocp-shim.mjs        # a shim with draftwright's OCP names billed
DW_WHEELS=<wheel dir> DW_GEN_SHIM=/tmp/dw-gen \
  node experiments/draftwright-wasm/pyodide/run.mjs import plate
```

It needs `examples/cloudflare-worker/assets/pyodide/` (`scripts/prepare-pyodide.mjs`) and
`vendor/pyodide/` (`packages/cascade-core/scripts/fetch-pyodide.cjs`). Point
`DW_PYODIDE_ASSETS` / `DW_PYODIDE_INDEX` at another worktree's copies if this one has none.

What each support file does:
- **`prelude.py`** puts a placeholder in front of every OCP name the shim lacks. A placeholder
  raises only when it is called, so the run reports which unbound classes the drawing path really
  uses.
- **`polyfill.py`** holds the stand-ins and pybind-parity fixes, each commented with the gap it
  covers.
- **`post-import.py`** replaces draftwright's BRep-stream sort key.
- **`all-ocp.json`** is `ocp-imports.py`'s inventory of the OCP names that draftwright, quiddity
  and build123d-drafting-helpers import. The sources are read as text; nothing is imported.
