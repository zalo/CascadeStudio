import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const DIST = '/tmp/cf-dist-frozen5', OUT = '/tmp/cf-upy/lib';
const fonts = {}; for (const f of fs.readdirSync(DIST + '/fonts')) if (/^FreeSans/.test(f)) fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(DIST + '/fonts/' + f);
const { createHeadlessCascade } = await import(pathToFileURL(DIST + '/cascade-headless.mjs').href);
const t0 = performance.now();
const engine = await createHeadlessCascade({ runtime: 'micropython', pySrc: process.env.CS_PY_SRC || 'upstream', occtWasm: fs.readFileSync(DIST + '/cascadestudio.wasm'), fonts,
  micropythonJs: await import(pathToFileURL(DIST + '/micropython-cs.mjs').href), micropythonWasm: fs.readFileSync(DIST + '/micropython-cs.wasm'),
  upstreamPy: async (rel) => fs.readFileSync(DIST + '/upstream-b123d/' + rel, 'utf8') });
await engine.run('from build123d import *\nshow(Box(1,1,1))');
console.log('boot timing', JSON.stringify(globalThis.self._pythonBootTiming));
const FS = globalThis.self._csMpInterpreter.FS || globalThis.self._csMpInterpreter._module.FS;
let n = 0, bytes = 0;
const walk = (d) => { for (const e of FS.readdir(d)) { if (e === '.' || e === '..') continue; const p = d + '/' + e; const st = FS.stat(p);
  if (FS.isDir(st.mode)) walk(p); else if (p.endsWith('.py')) { const t = FS.readFile(p, { encoding: 'utf8' }); const o = OUT + p.slice(4); fs.mkdirSync(o.slice(0, o.lastIndexOf('/')), { recursive: true }); fs.writeFileSync(o, t); n++; bytes += t.length; } } };
walk('/lib');
console.log('dumped', n, 'files', (bytes / 1048576).toFixed(2), 'MB');
process.exit(0);
