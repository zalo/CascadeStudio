// cascade-core entry point
// Main-thread API for embedding CAD modeling in web applications.

export { CascadeEngine } from './engine/CascadeEngine.js';
export { MessageBus } from './engine/MessageBus.js';
export { OpenSCADTranspiler } from './openscad/OpenSCADTranspiler.js';

/** Boot the browser-free CAD engine (Node / Deno / Bun / Cloudflare
 *  Workers): build123d or CascadeStudio JS in, BREP/STEP/STL out. See
 *  src/headless.js for the options and the full API.
 *
 *  Loaded lazily on purpose — headless.js pulls in the whole worker
 *  (OpenCascade's Emscripten glue, the Python runtimes, build123d-lite),
 *  which a browser page embedding CascadeEngine must not pay for. Import
 *  `cascade-core/headless` directly in a headless host to skip the hop. */
export async function createHeadlessCascade(options) {
  const mod = await import('cascade-core/headless');
  return mod.createHeadlessCascade(options);
}
