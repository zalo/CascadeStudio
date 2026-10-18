# build123d-mcp material in this Worker

[build123d-mcp](https://github.com/pzfreo/build123d-mcp) by Paul Fremantle and contributors is licensed under Apache-2.0 (the `LICENSE` file here; the project ships no NOTICE file). This server reuses two kinds of material from commit `59b2561`.

**Adapted text** (Apache-2.0 §4: the license is in this directory, and the changes are stated here and in each file's header):

| here | from | changes |
|---|---|---|
| `src/knowledge.js` (`build123d://quickref`, `build123d://selectors`) | `src/build123d_mcp/quickref.py`, `selectors_cookbook.py` | build123d-lite coverage notes; this server's conventions (session script, named `show()`, the `result` fallback, `named_face`'s front = −Y); version banners dropped; a duplicated pitfall removed. Every runnable section is run by `scripts/mcp-test.mjs`. |
| `src/repair-hints.js` | `src/build123d_mcp/tools/repair_hints.py` | the pattern→hint table reworded for this server's tools and errors; sandbox and mesh-gate hints dropped (no sandbox, no mesh gate here); lite-specific hints added. |

**Reimplemented behaviour.** These follow the descriptions and output vocabulary of build123d-mcp's tools. They are written fresh on the OCCT wasm bindings, not copied:
- `packages/cascade-core/src/headless/ShapeAnalysis.js`:
  - the validity gate's edge→face map and solid-overlap sweep (`tools/validate.py`);
  - `clearance` (`tools/measure.py`);
  - `align_check` (`tools/align_check.py`);
  - the face inventory and inertia tensor (`tools/measure.py`).
- `src/session.js`:
  - `execute`'s change line and its boolean no-op and degenerate warnings (`session.py`);
  - `compare`, `resolve`, `design_audit`;
  - `named_face` and `find_edges`, in build123d-lite.

The tool names and argument names match build123d-mcp's where the meaning matches, so guidance written for it carries over.
