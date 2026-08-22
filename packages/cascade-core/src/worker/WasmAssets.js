// WasmAssets.js — environment-agnostic resolution of the engine's binary
// assets (the OCCT wasm, the MicroPython wasm, the TTF fonts).
//
// A browser worker can just fetch a URL next to its bundle. The two headless
// hosts cannot:
//   * Node has no `fetch('file://…')`, so the caller reads the bytes.
//   * Cloudflare Workers (workerd) ships wasm as MODULE BINDINGS: the value
//     handed to the worker is an already-compiled `WebAssembly.Module`, and
//     `WebAssembly.compile()`/`new WebAssembly.Module(bytes)` are FORBIDDEN
//     at runtime. So the only thing that can be done with it is
//     `WebAssembly.instantiate(module, imports)`.
//
// Hence an "asset spec" is any of:
//   WebAssembly.Module | ArrayBuffer | TypedArray | string (URL) |
//   () => Promise<any of the above>
//
// Emscripten's documented `Module.instantiateWasm` hook takes all of them
// through `instantiateWasmSpec`, and CascadeWorker keeps using that hook for
// the reason it always did: capturing the wasm `Memory` so OCCT's
// Standard_Failure messages can be decoded (see COMPROMISE(failure-decode)).

/** Instantiate `spec` against `imports`.
 *  Resolves to `{ instance, module }` — `module` may be undefined when the
 *  host only handed us a compiled Module (workerd) and Emscripten does not
 *  need it back. */
export async function instantiateWasmSpec(spec, imports) {
  let src = typeof spec === 'function' ? await spec() : await spec;
  if (src == null) { throw new Error('instantiateWasmSpec: no wasm asset provided'); }

  if (typeof WebAssembly.Module !== 'undefined' && src instanceof WebAssembly.Module) {
    // workerd: compiled module binding — instantiate() resolves to an
    // Instance (not a {instance, module} record) for this overload.
    const instance = await WebAssembly.instantiate(src, imports);
    return { instance, module: src };
  }

  if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
    return await WebAssembly.instantiate(toArrayBuffer(src), imports);
  }

  const url = String(src);
  try {
    return await WebAssembly.instantiateStreaming(fetch(url), imports);
  } catch (streamError) {
    // wrong MIME type / no streaming support: fall back exactly like
    // Emscripten's own instantiateAsync does
    const bytes = await (await fetch(url)).arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  }
}

/** Normalize an ArrayBuffer / TypedArray / Node Buffer to a plain
 *  ArrayBuffer covering exactly the view's bytes. */
export function toArrayBuffer(v) {
  if (v instanceof ArrayBuffer) { return v; }
  if (ArrayBuffer.isView(v)) {
    return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  }
  throw new Error('toArrayBuffer: unsupported value ' + Object.prototype.toString.call(v));
}

/** Resolve one named asset (a font, say) from an asset provider:
 *  `assets.<mapKey>[name]` first, then `assets.loadAsset(path)`. Returns an
 *  ArrayBuffer, or null when the asset was not provided. */
export async function assetToArrayBuffer(assets, mapKey, name, path) {
  if (!assets) { return null; }
  const map = assets[mapKey];
  if (map) {
    const hit = map[name] !== undefined ? map[name] : map[path];
    if (hit !== undefined && hit !== null) {
      const v = typeof hit === 'function' ? await hit() : await hit;
      return toArrayBuffer(v);
    }
  }
  if (typeof assets.loadAsset === 'function') {
    const v = await assets.loadAsset(path);
    if (v !== undefined && v !== null) { return toArrayBuffer(v); }
  }
  return null;
}
