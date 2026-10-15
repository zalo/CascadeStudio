#!/usr/bin/env bash
# install-mp-variant.sh <micropython build dir> <out dir>
# Copies a micropython webassembly build (pyscript variant) as
# micropython-cs.{mjs,wasm} into <out dir>, applying the one-statement
# instantiateWasm glue patch documented in vendor/micropython-cs/PROVENANCE.md.
set -euo pipefail
src="$1"; out="$2"
mkdir -p "$out"
anchor='let Module={locateFile:(path,scriptDirectory)=>url||scriptDirectory+path};'
patch='options.instantiateWasm\&\&(Module.instantiateWasm=options.instantiateWasm);'
grep -qF "$anchor" "$src/micropython.min.mjs" || { echo "anchor not found in $src/micropython.min.mjs" >&2; exit 1; }
sed "s|let Module={locateFile:(path,scriptDirectory)=>url\|\|scriptDirectory+path};|&${patch}|" "$src/micropython.min.mjs" > "$out/micropython-cs.mjs"
grep -qF 'options.instantiateWasm&&(Module.instantiateWasm=options.instantiateWasm)' "$out/micropython-cs.mjs" || { echo "patch failed" >&2; exit 1; }
cp "$src/micropython.wasm" "$out/micropython-cs.wasm"
ls -la "$out"
