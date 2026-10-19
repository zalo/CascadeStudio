/**
 * Draw a sequence of parts through a live MCP make_drawing, for calibrating
 * the drafting Worker's face limit (drafting/README.md). One session; each
 * part replaces the script, then is drawn. Prints the wall time and the
 * drawing's first line, or the error.
 *
 *   BASE=https://<session worker> node scripts/drawing-ladder.mjs small dense80 dense40 dense40
 *
 * The bigger parts are over the default limit: deploy the drafting Worker
 * with `npm run deploy:drafting -- --var MAX_FACES:1000` for the test, and
 * redeploy without it afterwards. `wrangler tail cascade-drafting --format
 * json` gives each drawing's CPU time and outcome.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const PARTS = {
  small: 'p = Box(60, 40, 8) - Cylinder(6, 20)',                                          // 7 faces
  holes_4x4: 'p = Box(84, 84, 10)\np -= GridLocations(16, 16, 4, 4) * Cylinder(3, 40)',  // 22
  dense80: 'p = Box(200, 140, 10)\np -= GridLocations(18, 16, 10, 8) * Cylinder(3, 40)', // 86
  dense40: 'p = Box(160, 100, 12)\np -= GridLocations(18, 18, 8, 5) * Cylinder(3, 40)\n' // 126, counterbored
    + 'p -= Pos(0, 0, 6) * (GridLocations(18, 18, 8, 5) * Cylinder(5, 8))',
  holes_12x10: 'p = Box(240, 180, 10)\np -= GridLocations(18, 16, 12, 10) * Cylinder(3, 40)', // 126
};
const names = process.argv.slice(2);
const unknown = names.filter((n) => !PARTS[n]);
if (!process.env.BASE || !names.length || unknown.length) {
  console.error('usage: BASE=<url> node scripts/drawing-ladder.mjs <part>...  parts: ' + Object.keys(PARTS).join(' '));
  process.exit(2);
}
const c = new Client({ name: 'drawing-ladder', version: '1' });
await c.connect(new StreamableHTTPClientTransport(new URL(process.env.BASE.replace(/\/+$/, '') + '/mcp')));
const text = (r) => r.content.map((x) => x.text || '').join('\n');
const sid = text(await c.callTool({ name: 'new_session', arguments: {} })).match(/session: (\S+)/)[1];
for (const name of names) {
  const s = await c.callTool({ name: 'set_script', arguments: { session: sid,
    code: 'from build123d import *\n' + PARTS[name] + '\nshow(p)' } });
  if (s.isError) { console.log(name, 'MODEL FAILED', text(s).slice(0, 200)); continue; }
  const t = Date.now();
  const r = await c.callTool({ name: 'make_drawing', arguments: { session: sid } }, undefined, { timeout: 300000 });
  console.log(`${new Date().toISOString().slice(11, 19)} ${name.padEnd(11)} ${String(Date.now() - t).padStart(6)} ms  `
    + (r.isError ? 'ERROR ' : '') + text(r).split('\n')[0].slice(0, 170));
}
await c.close();
