import fs from 'node:fs';
const dir = '/tmp/mpvar/final2';
const mod = await import(dir + '/micropython-cs.mjs');
const wasm = fs.readFileSync(dir + '/micropython-cs.wasm');
const mp = await mod.loadMicroPython({ heapsize: 4 * 1048576, stdout: (l) => console.log(l), stderr: (l) => console.log('ERR', l),
  instantiateWasm: (imports, recv) => { WebAssembly.instantiate(wasm, imports).then((r) => recv(r.instance, r.module)); return {}; } });
const src = JSON.parse(fs.readFileSync('/tmp/cf-upy/src.json', 'utf8'));
let total = 0, fails = 0;
for (const [name, text] of Object.entries(src)) {
  mp.globals.set('_S', text); mp.globals.set('_N', name);
  const t0 = performance.now();
  try { mp.runPython('_c = compile(_S, _N, "exec")'); } catch (e) { fails++; }
  total += performance.now() - t0;
}
console.log('compile all', Object.keys(src).length, 'modules on wasm:', total.toFixed(0), 'ms; failures', fails);
// .mpy load: write each .mpy as a standalone module file and time a load that
// executes nothing but the module body is unavoidable -> measure bytes->code only via file read
