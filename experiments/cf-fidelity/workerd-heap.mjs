// workerd-heap.mjs — read the Worker isolate's V8 heap through `wrangler dev`'s
// inspector proxy (CDP Runtime.getHeapUsage), to put the JS side next to the
// wasm memories /render reports. Local workerd does NOT enforce the 128 MB
// isolate limit; this is how close a model gets to it.
//
//   node experiments/cf-fidelity/workerd-heap.mjs [ws://127.0.0.1:9229/ws]
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// wrangler's proxy insists on an Origin header, which Node's built-in
// WebSocket cannot send: use `ws` (a wrangler dependency of the example).
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'examples', 'cloudflare-worker', 'package.json'));
const WS = require('ws');
const ws = new WS(process.argv[2] || 'ws://127.0.0.1:9229/ws',
  { headers: { Origin: 'http://127.0.0.1:9229' } });
const MB = 1048576;
ws.on('message', (d) => {
  const m = JSON.parse(String(d));
  if (m.id === 2) {
    const out = {};
    for (const [k, v] of Object.entries(m.result)) { out[k + 'MB'] = +(v / MB).toFixed(1); }
    console.log(JSON.stringify(out));
    process.exit(0);
  }
});
ws.on('open', () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.getHeapUsage' }));
});
ws.on('error', (e) => { console.error(e.message); process.exit(1); });
setTimeout(() => { console.error('timeout'); process.exit(1); }, 10000);
