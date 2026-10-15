import fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const DIST = process.env.CF_DIST, MPY = process.env.CF_MPY;
if (MPY) {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(MPY);
  globalThis.__csMpyHook = (mp) => {
    const FS = mp.FS || mp._module.FS;
    for (const f of files) {
      const rel = '/lib' + f.slice(MPY.length);
      const dir = rel.slice(0, rel.lastIndexOf('/'));
      try { FS.mkdirTree(dir); } catch (e) {}
      FS.writeFile(rel, new Uint8Array(fs.readFileSync(f)));
    }
    mp.runPython([
      'import builtins, os',
      '_cs_real_open = builtins.open',
      'def _cs_open(p, mode="r", *a, **k):',
      '    if "w" in mode and isinstance(p, str) and p.endswith(".py") and p.startswith("/lib/"):',
      '        try:',
      '            os.stat(p[:-3] + ".mpy")',
      '            return _cs_real_open("/tmp_discard.py", mode, *a, **k)',
      '        except OSError:',
      '            pass',
      '    return _cs_real_open(p, mode, *a, **k)',
      'builtins.open = _cs_open',
    ].join('\n'));
  };
}
const fonts = {}; for (const f of fs.readdirSync(DIST + '/fonts')) if (/^FreeSans/.test(f)) fonts[f.replace(/\.ttf$/, '')] = fs.readFileSync(DIST + '/fonts/' + f);
const { createHeadlessCascade } = await import(pathToFileURL(DIST + '/cascade-headless.mjs').href);
const engine = await createHeadlessCascade({ runtime: 'micropython', pySrc: 'upstream', occtWasm: fs.readFileSync(DIST + '/cascadestudio.wasm'), fonts,
  micropythonJs: await import(pathToFileURL(DIST + '/micropython-cs.mjs').href), micropythonWasm: fs.readFileSync(DIST + '/micropython-cs.wasm'),
  upstreamPy: async (rel) => fs.readFileSync(DIST + '/upstream-b123d/' + rel, 'utf8') });
const r = await engine.run('from build123d import *\nb = Box(1,2,3)\nprint("vol", b.volume)\nshow(b)');
console.log(MPY ? 'MPY ' : 'PY  ', 'ok', r.ok, r.logs.find((l) => l.startsWith('vol')), JSON.stringify(globalThis.self._pythonBootTiming));
process.exit(0);
