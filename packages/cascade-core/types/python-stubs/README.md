# Python stubs for the in-browser basedpyright language server

These `.pyi` files are what Monaco's Python IntelliSense typechecks against
(see `packages/cascade-studio/src/PythonLanguage.js`). The build bundles the
whole tree into `dist/typedefs/python-stubs.json` (one fetch), and the LSP
client seeds them into pyright's in-memory filesystem under `/typings/`.

## Provenance

`build123d/` was generated from **real build123d 0.11.1** (the reference venv
at `~/Desktop/ocjs-deps/b123d-ref-venv`, same one the validation harness
uses):

```bash
~/Desktop/ocjs-deps/b123d-ref-venv/bin/python -m pip install mypy
~/Desktop/ocjs-deps/b123d-ref-venv/bin/stubgen -p build123d -o out --include-docstrings
```

…then **modified to describe build123d-lite** (what actually runs in the
worker) rather than upstream:

1. **`__all__` pruned to lite's real surface.** The export list in
   `build123d/__init__.pyi` was regenerated from `dir(build123d)` of the live
   lite module intersected with upstream's `__all__` (pyright treats
   non-`__all__` names in stubs as not exported, so `from build123d import
   Draft` and star-import uses of unsupported names are flagged). Regenerate
   the name list by running `import build123d;
   print(sorted(n for n in dir(build123d) if not n.startswith('_')))` through
   `CascadeAPI.runCode` and re-intersecting.
2. **Unsupported parameters removed** so their use is flagged:
   `offset(min_edge_length=)`, `Text(font_path=)`.
3. **Lite-only APIs added**: `show`/`show_object`/`show_all`/`volume`
   (viewer), the canonical free-edge surface (`CanonicalForm`,
   `canonical_form`, `lexicographic_key`, `loop_area_vector`,
   `CANONICAL_SAMPLES`/`CANONICAL_BAND`, `Mixin1D.canonical`/
   `canonical_form`/`reversed`, `Axis(edge, canonical=True)`,
   `ShapeList.sort_by(tie_break=)`).
4. **Compromise notes in docstrings** (surface on hover): the no-op
   `export_step`/`export_gltf`, STL-only `Mesher`, `split` without
   `Keep.BOTH`, `COMPROMISE(show-semantics)`, `COMPROMISE(volume-measure)`.
5. **Deleted modules** lite has no counterpart for: `brep_from_stl`,
   `import_dxf`, `jupyter_tools`, `persistence`, `vtk_tools`, `_version`,
   `version`.

## Sibling stubs

- `browser.pyi` — Brython's worker-global bridge (`from browser import self
  as w`), typed as `Any`.
- `scipy/`, `pytest.pyi` — the exact shim surface lite ships
  (COMPROMISE(scipy-shim); `pytest.approx` only). Everything else stays
  unresolvable on purpose (e.g. `numpy` is flagged as missing, which is the
  truth).
- `OCP/` — `Any`-typed placeholders for the OCP submodules the generated
  build123d stubs import internally; they exist only so pyright doesn't
  report unresolved imports inside the stubs themselves.

## When Build123dLite.js gains or loses API

Regenerate the affected module with stubgen (or hand-edit for small
additions), and keep `__all__` in `build123d/__init__.pyi` in sync with the
live `dir(build123d)`. The Playwright spec `test/python-lsp.spec.js` freezes
the contract (real errors flagged, pruned names flagged, lite extras clean,
starter clean).
