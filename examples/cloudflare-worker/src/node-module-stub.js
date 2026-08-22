// Stub for the bare `module` specifier.
//
// OpenCascade's Emscripten glue contains
//   if (ENVIRONMENT_IS_NODE) { const {createRequire} = await import("module"); … }
// which is dead code on Cloudflare Workers (there is no `process`, so
// ENVIRONMENT_IS_NODE is false) — but the bundler still has to RESOLVE the
// specifier. This is what it resolves to.
export function createRequire() {
  throw new Error('node:module is not available on Cloudflare Workers');
}
export default { createRequire };
