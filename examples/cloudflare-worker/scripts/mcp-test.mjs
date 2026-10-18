// The MCP endpoint (src/mcp.js, the tools in src/session.js) driven by the
// official MCP TypeScript SDK client — the client real MCP hosts use.
//
//   BASE=http://127.0.0.1:8787 node scripts/mcp-test.mjs
//   BASE=... ACCESS_KEY=... node scripts/mcp-test.mjs          # a keyed deployment
//   BASE=... ACCESS_KEY=... OAUTH=1 node scripts/mcp-test.mjs  # + the OAuth flow
//   RATE=1 ...                                                 # + the per-minute limit
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs';
import { STARTER } from '../src/mcp-tools.js';
import { RUNNABLE_EXAMPLES } from '../src/knowledge.js';

const BASE = (process.env.BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const KEY = process.env.ACCESS_KEY || '';
let failed = 0;
const check = (what, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + what + (detail !== undefined ? '  — ' + String(detail).slice(0, 160) : ''));
  if (!ok) { failed++; }
};

async function connect(token) {
  const client = new Client({ name: 'mcp-test', version: '1.0.0' });
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  await client.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp'), { requestInit: { headers } }));
  return client;
}
const text = (r) => (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
const pngSize = (b64) => {
  const b = Buffer.from(b64, 'base64');
  return b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
};
const urlIn = (s) => (String(s).match(/https?:\/\/\S+\/files\/\S+/) || [])[0];

const client = await connect(KEY);
console.log('server:', JSON.stringify(client.getServerVersion()));
const call = (name, args = {}) => client.callTool({ name, arguments: args });

// ---- discovery ----
const tools = (await client.listTools()).tools.map((t) => t.name);
check('20 tools listed', tools.length === 20, tools.join(' '));
check('instructions sent', /render_view/.test(client.getInstructions() || ''));
const prompts = (await client.listPrompts()).prompts;
check('the start-cad-session prompt', prompts.some((p) => p.name === 'start-cad-session'));
const pr = await client.getPrompt({ name: 'start-cad-session', arguments: { description: 'a 20 mm cube' } });
check('the prompt fills in the description', /20 mm cube/.test(pr.messages[0].content.text));
const quick = await client.readResource({ uri: 'build123d://quickref' });
check('the quickref resource', /BuildPart/.test(quick.contents[0].text) && /Server conventions/.test(quick.contents[0].text));
const sel = await client.readResource({ uri: 'build123d://selectors' });
check('the selectors resource', /Drill-down idiom/.test(sel.contents[0].text));
check('the starter resource', /show\(/.test((await client.readResource({ uri: 'build123d://starter' })).contents[0].text));
check('repair_hints (no session needed)', /from build123d import/.test(text(await call('repair_hints',
  { error_text: "NameError: name 'Box' is not defined" }))));
check('workflow_hints', /The loop/.test(text(await call('workflow_hints'))));

// ---- a session ----
const ns = text(await call('new_session'));
const sid = (ns.match(/session: (\S+)/) || [])[1];
check('new_session returns an id and an editor link', !!sid && /\?session=/.test(ns), ns.split('\n')[1]);

let r = await call('execute', { session: sid, code: 'plate = Box(60, 40, 8)\nplate = fillet(plate.edges().filter_by(Axis.Z), 4)\nshow(plate)\nprint("vol", round(plate.volume))' });
check('execute: OK, rev 1, one shape', !r.isError && /rev 1/.test(text(r)) && /shapes: 1/.test(text(r)), text(r).split('\n')[0]);
check('execute returns print output', /vol 1909\d/.test(text(r)), (text(r).match(/vol \d+/) || [])[0]);
r = await call('execute', { session: sid, code: 'oops = plate.no_such_method()' });
check('a failing execute is an error and rolled back', r.isError && /nothing was appended/.test(text(r)));
check('its line is mapped to the code that was sent', /line 1 of the code you sent/.test(text(r)), text(r).split('\n')[1]);
r = await call('get_script', { session: sid });
check('get_script: still rev 1', /^rev 1/.test(text(r)) && !/no_such_method/.test(text(r)));
r = await call('execute', { session: sid, code: 'plate -= Cylinder(6, 20)\nplate -= GridLocations(44, 24, 2, 2) * Cylinder(2.5, 20)\nshow(plate)' });
check('execute appends: rev 2', !r.isError && /rev 2/.test(text(r)), text(r).split('\n')[0]);
const script = await (await fetch(BASE + '/session/' + sid + '/script')).json();
check('the editor route sees the same script', script.rev === 2 && /GridLocations/.test(script.code || ''), 'rev ' + script.rev);

// ---- look ----
r = await call('render_view', { session: sid, view: 'iso' });
const img = (r.content || []).find((c) => c.type === 'image');
const size = img && pngSize(img.data);
check('render_view: a PNG, 800x600', !!size && size[0] === 800 && size[1] === 600, JSON.stringify(size));
check('render_view: the size label text', /size 60 x 40 x 8/.test(text(r)), text(r));
r = await call('render_view', { session: sid, view: 'top', width: 400, height: 300, highlight: [0] });
check('render_view: top view at 400x300', JSON.stringify(pngSize(((r.content || []).find((c) => c.type === 'image') || {}).data || '')) === '[400,300]');
r = await call('render_view', { session: sid, format: 'svg', view: 'front' });
const svgUrl = urlIn(text(r));
check('render_view svg: a drawing and a file', !r.isError && !!svgUrl && /<svg/.test(text(r)), text(r).split('\n')[0]);

// ---- measure, validate ----
r = await call('measure', { session: sid, density: 2.7 });
const m = JSON.parse(text(r));
check('measure: volume, centre of mass, mass', m.shapes[0].volume > 15000 && m.shapes[0].centerOfMass && m.shapes[0].massGrams > 40,
  JSON.stringify({ volume: m.shapes[0].volume, mass: m.shapes[0].massGrams, faces: m.shapes[0].faces }));
r = await call('validate', { session: sid });
check('validate: PASS', !r.isError && /^Validity gate: PASS/.test(text(r)), text(r).split('\n')[0]);

// ---- export ----
for (const [format, magic] of [['step', 'ISO-10303-21'], ['stl', 'solid'], ['glb', 'glTF'], ['brep', 'DBRep'], ['svg', '<svg']]) {
  r = await call('export', { session: sid, format, filename: 'plate' });
  const url = urlIn(text(r));
  let head = '';
  if (url) { head = Buffer.from(await (await fetch(url)).arrayBuffer()).subarray(0, 40).toString('latin1'); }
  check('export ' + format + ': a download URL that serves the file', !!url && head.includes(magic), url);
}

// ---- snapshots, set_script, errors ----
check('save_snapshot', !(await call('save_snapshot', { session: sid, name: 'plate-v2' })).isError);
r = await call('set_script', { session: sid, code: 'from build123d import *\nball = Sphere(10)\nshow(ball)' });
check('set_script replaces: rev 3', !r.isError && /rev 3/.test(text(r)));
r = await call('set_script', { session: sid, code: 'from build123d import *\nball = Sphere(10)\nbroken = ball.nope\nshow(ball)' });
check('a failing set_script is kept (rev 4) and reported', r.isError && /rev 4/.test(text(r)));
r = await call('last_error', { session: sid });
check('last_error shows the line in context', /> {3}3 {2}broken = ball\.nope/.test(text(r)), text(r).split('\n').slice(-3).join(' | '));
r = await call('restore_snapshot', { session: sid, name: 'plate-v2' });
check('restore_snapshot brings the plate back (rev 5)', !r.isError && /rev 5/.test(text(r)) && /size 60 x 40 x 8/.test(text(r)));
r = await call('session_state', { session: sid });
const st = JSON.parse(text(r));
check('session_state: rev, snapshots, files, editor link', st.script.rev === 5 && st.snapshots.length === 1
  && st.files.length >= 5 && /\?session=/.test(st.editor), JSON.stringify({ rev: st.script.rev, files: st.files.length }));
check('open_in_editor', /\?session=/.test(text(await call('open_in_editor', { session: sid }))));

// ---- the documentation's own examples run ----
const code = STARTER.split('```python')[1].split('```')[0];
r = await call('set_script', { session: sid, code });
check('the starter example runs and shows its three named parts', !r.isError && /shapes: 3/.test(text(r))
  && /"bracket"/.test(text(r)), text(r).split('\n').slice(0, 5).join(' | '));
r = await call('set_script', { session: sid, code: 'from build123d import *\na = Box(1, 1, 1)\nshow(a)' });
r = await call('execute', { session: sid, code: 'b = Pos(5, 0, 0) * Box(2, 2, 2)\nshow(b)' });
let after = text(await call('get_script', { session: sid }));
check('a chunk with an unnamed show() supersedes the earlier one', !r.isError && /shapes: 1/.test(text(r))
  && /# show\(a\)/.test(after), text(r).split('\n')[1]);
// (own sessions: the per-minute limit is per session)
const newSid = async () => (text(await call('new_session')).match(/session: (\S+)/) || [])[1];
const exSid = await newSid();
let bad = [];
for (const [lbl, ex] of RUNNABLE_EXAMPLES) {
  const x = await call('set_script', { session: exSid, code: ex });
  if (x.isError || /shapes: none/.test(text(x))) { bad.push(lbl + ': ' + text(x).split('\n').slice(1, 3).join(' ')); }
}
check('all ' + RUNNABLE_EXAMPLES.length + ' runnable quickref/selectors sections run and show something', !bad.length, bad.join(' || '));

// ---- named objects, change diagnostics ----
const mainSid = sid;
{
const sid = await newSid();
r = await call('execute', { session: sid, code: 'x = Bxo(1, 2, 3)' });
check('a failing execute carries repair hints', r.isError && /hints:\n- A name is not defined/.test(text(r)), text(r).slice(-120));
r = await call('set_script', { session: sid, code: 'from build123d import *\nbase = Box(40, 30, 6)\nshow(base, "base")\n'
  + 'pin = Pos(0, 0, 8) * Cylinder(3, 10)\nshow(pin, "pin")' });
check('named show(): both objects listed by name', !r.isError && /\[0\] "base"/.test(text(r)) && /\[1\] "pin"/.test(text(r)), text(r));
r = await call('execute', { session: sid, code: 'base = base - Cylinder(3, 20)\nshow(base, "base")' });
check('re-showing a name replaces it, and the change is reported', !r.isError && /shapes: 2/.test(text(r))
  && /"base": volume 7200 -> 7030\.354 \(-169\.646, -2\.4%\), faces 6 -> 7/.test(text(r)), text(r));
r = await call('execute', { session: sid, code: 'base = base - Pos(100, 0, 0) * Box(1, 1, 1)\nshow(base, "base")' });
check('a boolean that missed is flagged', !r.isError && /Warning: the code ran but no shown shape changed/.test(text(r)), text(r));
r = await call('measure', { session: sid, object_name: 'pin', material: 'pla' });
let mm = JSON.parse(text(r).replace(/ — .*$/, ''));
check('measure object_name + material: face inventory, inertia, mass', mm.shapes.length === 1 && mm.shapes[0].name === 'pin'
  && mm.shapes[0].faceInventory.some((f) => f.type === 'Cylinder' && f.diameter === 6) && mm.shapes[0].inertia.Izz > 0
  && Math.abs(mm.shapes[0].massGrams - 0.351) < 0.01, JSON.stringify(mm.shapes[0]).slice(0, 300));
r = await call('compare', { session: sid, a: 'pin', b: 'base', kind: 'fit' });
let cf = JSON.parse(text(r));
check('compare fit: the pin sits on the plate in its hole (touching)', cf.status === 'touching' && cf.clearance === 0, text(r));
r = await call('compare', { session: sid, a: 'pin', b: 'base', kind: 'align', axis: 'Z', mode: 'clearance' });
check('compare align', Math.abs(JSON.parse(text(r)).delta) < 1e-6 && /touching/.test(text(r)), text(r));
r = await call('compare', { session: sid, a: 'base', b: 'pin', kind: 'shape' });
let cs = JSON.parse(text(r));
check('compare shape: exact added/removed volumes', cs.magnitude_method === 'exact_volume' && Math.abs(cs.changed.removed_volume - 7030.354) < 0.01, text(r).slice(0, 200));
r = await call('resolve', { session: sid, object_name: 'base', selector: '.faces().sort_by(Axis.Z)[-1]', label: 'top' });
let rs = JSON.parse(text(r));
check('resolve: the top face, its normal and centre', rs.type === 'Face' && rs.geom_type === 'PLANE' && rs.normal[2] === 1
  && rs.center[2] === 3 && rs.ref === '@cad[base#top]', text(r).slice(0, 200));
r = await call('resolve', { session: sid, object_name: 'base', selector: '.edges().filter_by(GeomType.CIRCLE)' });
rs = JSON.parse(text(r));
check('resolve a list: count, arc centres, radius', rs.count === 2 && rs.entities[0].radius === 3, text(r).slice(0, 200));
r = await call('resolve', { session: sid, object_name: 'base', selector: '.nope()' });
check('resolve: a bad selector is an error', r.isError && /selector raised/.test(text(r)), text(r));
check('session_state lists the resolve label and objects', /"top"/.test(text(await call('session_state', { session: sid })))
  && /"base"/.test(text(await call('session_state', { session: sid }))));
check('save_snapshot with a summary', /2 object/.test(text(await call('save_snapshot', { session: sid, name: 'two' }))));
await call('execute', { session: sid, code: 'pin = Pos(0, 0, 8) * Cylinder(3, 14)\nshow(pin, "pin")' });
r = await call('compare', { session: sid, a: 'two', kind: 'snapshot' });
check('compare snapshot: the pin changed, the base did not', /~ \[1\] "pin"/.test(text(r)) && /= \[0\] "base"/.test(text(r)), text(r));
r = await call('render_view', { session: sid, objects: 'pin', highlight: ['pin'] });
check('render_view objects by name', /1 object\(s\): \[1\] "pin"/.test(text(r)), text(r));

// ---- the validity gate ----
r = await call('set_script', { session: sid, code: 'from build123d import *\npair = Compound([Box(10, 10, 10), Pos(5, 0, 0) * Box(10, 10, 10)])\n'
  + 'show(pair, "pair", Face.make_rect(10, 10), "sheet")' });
r = await call('validate', { session: sid });
check('validate FAILs overlapping solids and a sheet', r.isError && /overlap \(interpenetrating, 500/.test(text(r))
  && /"sheet" has no solid/.test(text(r)) && /4 open edge/.test(text(r)), text(r).split('\n')[0]);
r = await call('validate', { session: sid, object_name: 'sheet' });
check('validate object_name', r.isError && !/"pair"/.test(text(r).split('\n')[0]), text(r).split('\n')[0]);
r = await call('locate_gate_defects', { session: sid });
let ld = JSON.parse(text(r));
check('locate_gate_defects: the overlap and the open edges with coordinates', ld.counts.solid_overlap === 1 && ld.counts.open_edge === 4
  && ld.defects.find((d) => d.kind === 'open_edge').at.length === 3, JSON.stringify(ld.counts));
r = await call('set_script', { session: sid, code: 'from build123d import *\nshow(Box(10, 10, 10), "a", Pos(8, 0, 0) * Box(10, 10, 10), "b")' });
r = await call('validate', { session: sid });
check('separate objects that interpenetrate: PASS with a warning', !r.isError && /PASS/.test(text(r)) && /interpenetrate/.test(text(r)), text(r).split('\n')[0]);

// ---- design_audit, the result fallback ----
r = await call('set_script', { session: sid, code: 'from build123d import *\n\nwidth = 40.0\nthick = 4.0\nr = 1.9\n'
  + 'plate = Box(width, 30, thick)\nplate = fillet(plate.edges(), r)\nshow(plate, "plate")' });
r = await call('design_audit', { session: sid });
let da = JSON.parse(text(r));
const vr = (n) => (da.audit.find((x) => x.name === n) || {}).verdict;
check('design_audit: width robust, the fillet radius needs review', da.summary.total_params === 3 && vr('width') === 'robust'
  && ['coupling', 'brittle'].includes(vr('r')) && da.summary.needs_review >= 1, JSON.stringify(da.summary) + ' r=' + vr('r') + ' thick=' + vr('thick'));
r = await call('get_script', { session: sid });
check('design_audit leaves the script alone', /r = 1\.9/.test(text(r)) && !/r = 2\.09/.test(text(r)));
r = await call('measure', { session: sid, object_name: 'plate' });
check('the next tool re-runs the real script', !r.isError && Math.abs(JSON.parse(text(r)).shapes[0].bbox[3] - 20) < 1e-6);
r = await call('set_script', { session: sid, code: 'from build123d import *\nsketch = Rectangle(5, 5)\nresult = Box(1, 2, 3)' });
check('no show(): a top-level result is shown', !r.isError && /shapes: 1/.test(text(r)) && /"result"/.test(text(r)), text(r));
}

const skill = fs.readFileSync(new URL('../skills/build123d-remote/SKILL.md', import.meta.url), 'utf8');
r = await call('set_script', { session: sid, code: skill.split('```python')[1].split('```')[0] });
check('the skill\'s example runs', !r.isError && /shapes: 1/.test(text(r)) && /size 80 x 50 x 26/.test(text(r)),
  text(r).split('\n').slice(0, 3).join(' | '));

// ---- the REST bridge ----
const rest = BASE + '/session/' + sid;
const auth = KEY ? { authorization: 'Bearer ' + KEY } : {};
const rv = await fetch(rest + '/tools/validate', { method: 'POST', headers: auth, body: '{}' });
check('REST: POST /tools/validate', rv.status === 200 && /^Validity gate: PASS/.test((await rv.json()).content[0].text));
const png = await fetch(rest + '/view.png?view=front&width=320&height=240', { headers: auth });
const pb = Buffer.from(await png.arrayBuffer());
check('REST: GET /view.png', png.status === 200 && pb.readUInt32BE(16) === 320, png.headers.get('content-type'));

// ---- reset, mistakes ----
r = await call('reset', { session: sid });
check('reset empties the script', !r.isError && /empty/.test(text(r)));
r = await call('render_view', { session: sid });
check('render_view on an empty session is an error', r.isError && /empty/.test(text(r)));
r = await call('measure', {});
check('a tool without a session id is an error', r.isError && /session/.test(text(r)));
r = await call('execute', { code: 'show(Box(1, 2, 3))' });
check('execute without a session starts one', !r.isError && /session: [a-z0-9]{12}/.test(text(r)));
await client.close();

// ---- auth ----
if (KEY) {
  const anon = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json',
    accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  check('without the access key /mcp refuses (401 + a Bearer challenge)', anon.status === 401
    && /Bearer/.test(anon.headers.get('www-authenticate') || ''), anon.headers.get('www-authenticate'));
  let refused = false;
  try { await connect('not-the-key'); } catch (e) { refused = /401|nauthori|invalid/i.test(String(e)); }
  check('a wrong key is refused', refused);
}

if (process.env.OAUTH) {
  const prm = await (await fetch(BASE + '/.well-known/oauth-protected-resource/mcp')).json();
  check('protected resource metadata', prm.resource === BASE + '/mcp' && prm.authorization_servers[0] === BASE, JSON.stringify(prm));
  const asm = await (await fetch(BASE + '/.well-known/oauth-authorization-server')).json();
  check('authorization server metadata', !!asm.registration_endpoint && asm.code_challenge_methods_supported.includes('S256'));
  const redirect = 'http://127.0.0.1:9/callback';
  const reg = await (await fetch(asm.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'mcp-test', redirect_uris: [redirect], token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) })).json();
  check('dynamic client registration', !!reg.client_id, reg.client_id);
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: redirect,
    code_challenge: challenge, code_challenge_method: 'S256', scope: 'mcp', state: 'st8', resource: BASE + '/mcp' });
  const ap = await fetch(asm.authorization_endpoint + '?' + q, { redirect: 'manual' });
  const html = await ap.text();
  const handle = (html.match(/name="handle" value="([^"]+)"/) || [])[1];
  const cookie = (ap.headers.getSetCookie ? ap.headers.getSetCookie() : [ap.headers.get('set-cookie')]).filter(Boolean)
    .map((c) => c.split(';')[0]).join('; ');
  check('the consent page asks for the access key', ap.status === 200 && !!handle && /Access key/.test(html));
  const form = (key) => new URLSearchParams({ handle, scope: 'mcp', key, decision: 'approve' });
  const bad = await fetch(asm.authorization_endpoint, { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: form('wrong') });
  check('a wrong access key is refused', bad.status === 401);
  const ok = await fetch(asm.authorization_endpoint, { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: form(KEY) });
  const loc = new URL(ok.headers.get('location') || 'http://x/');
  check('the right key redirects back with a code', ok.status === 302 && !!loc.searchParams.get('code')
    && loc.searchParams.get('state') === 'st8', ok.status + ' ' + loc.href.slice(0, 80));
  const tok = await (await fetch(asm.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: loc.searchParams.get('code'), redirect_uri: redirect,
      client_id: reg.client_id, code_verifier: verifier, resource: BASE + '/mcp' }) })).json();
  check('the code becomes an access token', !!tok.access_token, Object.keys(tok).join(','));
  const oc = await connect(tok.access_token);
  check('the OAuth token opens /mcp', (await oc.listTools()).tools.length === 20);
  await oc.close();
}

if (process.env.RATE) {
  const rc = await connect(KEY);
  const s2 = (text(await rc.callTool({ name: 'new_session', arguments: {} })).match(/session: (\S+)/) || [])[1];
  let limited = -1;
  for (let i = 0; i < 70; i++) {
    const x = await rc.callTool({ name: 'get_script', arguments: { session: s2 } });
    if (x.isError && /rate limit/.test(text(x))) { limited = i; break; }
  }
  check('the per-minute limit stops a session', limited === Number(process.env.RATE_EXPECT || 60), 'limited at call ' + limited);
  await rc.close();
}

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('ALL MCP CHECKS PASSED');
