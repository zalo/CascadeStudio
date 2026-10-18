// mcp.js — the Model Context Protocol endpoint (POST /mcp, Streamable HTTP),
// so any MCP client — a claude.ai connector, the Claude API's MCP connector,
// Claude Code — can drive build123d sessions.
//
// Stateless, as Cloudflare now recommends for remote MCP servers: no
// Mcp-Session-Id, every request stands alone and is answered with plain
// JSON. The CAD state lives in the session Durable Objects, addressed by
// the `session` argument the tools carry (an MCP session id would not
// survive across Claude API requests; an id in the conversation does).
//
// Written against the spec rather than the TypeScript SDK: the SDK wants
// nodejs_compat, which this Worker cannot enable (wrangler.toml), and the
// server side of the protocol is small — initialize, ping, tools,
// prompts, resources. test/mcp-session.mjs drives it with the official SDK
// client.

import { SERVER_INFO, TOOLS, INSTRUCTIONS, WORKFLOW, QUICKREF, SELECTORS, STARTER, PROMPTS, RESOURCES,
  promptMessages } from './mcp-tools.js';
import { repairHints } from './repair-hints.js';

const RESOURCE_TEXT = { 'build123d://workflow': WORKFLOW, 'build123d://quickref': QUICKREF,
  'build123d://selectors': SELECTORS, 'build123d://starter': STARTER };

export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, www-authenticate',
  'access-control-max-age': '86400',
};

const json = (body, status = 200, extra = {}) => new Response(body === null ? null : JSON.stringify(body), {
  status, headers: Object.assign({ 'content-type': 'application/json' }, CORS, extra) });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } });
const textResult = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)),
  (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

/** @param {object} o
 *  @param {(env, name, args, meta) => Promise<object>} o.callSessionTool
 *         runs a tool in a session object; returns an MCP tool result */
export function createMcpHandler(o) {
  const toolNames = new Set(TOOLS.map((t) => t.name));

  async function callTool(params, env, origin) {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    if (!toolNames.has(name)) { return textResult('unknown tool: ' + name, true); }
    if (name === 'workflow_hints') { return textResult(WORKFLOW); }
    if (name === 'repair_hints') {
      return textResult(JSON.stringify({ hints: repairHints(args.error_text, true) }, null, 1));
    }
    if (name === 'new_session') {
      const id = randomId();
      return textResult('session: ' + id + '\neditor: ' + origin + '/?session=' + id
        + '\nPass "session": "' + id + '" to every call. Open the editor link to watch and edit the model.');
    }
    let sid = args.session;
    if (sid === undefined && (name === 'execute' || name === 'set_script')) { sid = randomId(); }
    if (typeof sid !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(sid)) {
      return textResult('a "session" id is needed (letters, digits, _ . -; up to 64): start one with new_session', true);
    }
    try {
      return await o.callSessionTool(env, name, Object.assign({}, args, { session: sid }), { session: sid, origin });
    } catch (err) {
      return textResult('session error: ' + ((err && err.message) || err), true);
    }
  }

  async function handleMessage(msg, env, origin) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return msg && msg.id !== undefined ? rpcError(msg.id, -32600, 'invalid request') : null;
    }
    const isNotification = msg.id === undefined || msg.id === null;
    const p = msg.params || {};
    let result;
    switch (msg.method) {
      case 'initialize': {
        const wanted = p.protocolVersion;
        result = {
          protocolVersion: PROTOCOL_VERSIONS.includes(wanted) ? wanted : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false }, prompts: { listChanged: false },
            resources: { listChanged: false, subscribe: false }, logging: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        };
        break;
      }
      case 'ping': result = {}; break;
      case 'tools/list': result = { tools: TOOLS }; break;
      case 'tools/call': result = await callTool(p, env, origin); break;
      case 'prompts/list': result = { prompts: PROMPTS }; break;
      case 'prompts/get': {
        const messages = promptMessages(p.name, p.arguments || {});
        if (!messages) { return rpcError(msg.id, -32602, 'unknown prompt: ' + p.name); }
        result = { description: PROMPTS[0].description, messages };
        break;
      }
      case 'resources/list': result = { resources: RESOURCES }; break;
      case 'resources/templates/list': result = { resourceTemplates: [] }; break;
      case 'resources/read': {
        const text = RESOURCE_TEXT[p.uri];
        if (text === undefined) { return rpcError(msg.id, -32002, 'resource not found: ' + p.uri); }
        const res = RESOURCES.find((r) => r.uri === p.uri);
        result = { contents: [{ uri: p.uri, mimeType: res.mimeType, text }] };
        break;
      }
      case 'logging/setLevel': result = {}; break;
      case 'completion/complete': result = { completion: { values: [], hasMore: false } }; break;
      default:
        if (isNotification) { return null; }   // notifications/initialized, cancelled, ...
        return rpcError(msg.id, -32601, 'method not found: ' + msg.method);
    }
    return isNotification ? null : { jsonrpc: '2.0', id: msg.id, result };
  }

  /** The endpoint. `origin` is this deployment's public origin (links). */
  async function handle(request, env, origin) {
    if (request.method === 'OPTIONS') { return new Response(null, { status: 204, headers: CORS }); }
    if (request.method === 'GET' || request.method === 'DELETE') {
      // no server-initiated stream, no server-side MCP session to end
      return json({ error: 'this endpoint takes POSTed JSON-RPC (Streamable HTTP, stateless)' }, 405, { allow: 'POST' });
    }
    if (request.method !== 'POST') { return json(null, 405, { allow: 'POST' }); }
    let body;
    try { body = await request.json(); }
    catch (err) { return json(rpcError(null, -32700, 'parse error')); }
    if (Array.isArray(body)) {
      // JSON-RPC batches (protocol 2025-03-26; later versions dropped them)
      const out = (await Promise.all(body.map((m) => handleMessage(m, env, origin)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
    }
    const out = await handleMessage(body, env, origin);
    return out ? json(out) : new Response(null, { status: 202, headers: CORS });
  }

  return { handle };
}
