// auth.js — the session Worker's front door: the MCP endpoint, its sign-in,
// and everything else (the session API, the editor's assets). With an
// access key, the REST bridge to the tools (/session/<id>/tools/<name>,
// /session/<id>/view.png) needs it too; the editor's own routes stay open.
//
// Three modes, by configuration:
//   no MCP_ACCESS_KEY            /mcp is open (like the session API)
//   MCP_ACCESS_KEY               /mcp needs `Authorization: Bearer <key>` —
//                                the Claude API's MCP connector
//                                (authorization_token) and Claude Code
//                                (--header) send it directly
//   MCP_ACCESS_KEY + OAUTH_KV    also OAuth 2.1 (@cloudflare/workers-oauth-
//                                provider), what claude.ai connectors speak:
//                                discovery, dynamic client registration,
//                                PKCE, tokens in KV. The sign-in step is a
//                                consent page that asks for the access key.
//                                The key still works as a bearer token
//                                (resolveExternalToken).

import { OAuthProvider, AuthorizationError } from '@cloudflare/workers-oauth-provider';

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');

/** Constant-time string comparison (the access key). */
function sameSecret(a, b) {
  const x = new TextEncoder().encode(String(a || ''));
  const y = new TextEncoder().encode(String(b || ''));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) { diff |= (x[i] || 0) ^ (y[i] || 0); }
  return diff === 0 && x.length > 0;
}

const bearer = (request) => {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
};

function consentPage(details, handle, error) {
  const name = escapeHtml(details.clientName || details.clientId);
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect ${name} to CascadeStudio build123d</title>
<style>body{font:15px system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1d2125}
input[type=password]{width:100%;padding:.5rem;font-size:1rem;margin:.4rem 0 1rem}button{padding:.5rem 1rem;font-size:1rem;margin-right:.5rem}
.warn{background:#fff4e5;border-left:4px solid #f0a020;padding:.5rem .8rem}.err{color:#b3261e}</style>
<h1>Connect ${name}?</h1>
<p>${details.clientDomain ? 'Published by <strong>' + escapeHtml(details.clientDomain) + '</strong>.'
    : 'This app registered itself; its name is not verified.'}
It will be able to run build123d CAD sessions on this server. Access goes to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${details.redirectIsLoopback ? '<p class="warn">This sends access to an app on your computer. Continue only if you just started connecting from it.</p>' : ''}
${error ? '<p class="err">' + escapeHtml(error) + '</p>' : ''}
<form method="post">
<input type="hidden" name="handle" value="${escapeHtml(handle)}">
${(details.scope || []).map((s) => '<input type="hidden" name="scope" value="' + escapeHtml(s) + '">').join('')}
<label>Access key<input type="password" name="key" autocomplete="current-password" autofocus></label>
<button name="decision" value="approve">Allow</button><button name="decision" value="deny">Deny</button>
</form>`;
}

const page = (html, headers = new Headers(), status = 200) => {
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status, headers });
};

/** The /authorize endpoint: the library validates the request; this page
 *  shows who is asking and checks the access key. */
async function authorize(request, env) {
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (request.method === 'GET') {
      const authReq = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authReq);
      const consent = await oauth.beginConsent(authReq);
      return page(consentPage(details, consent.handle), consent.headers);
    }
    if (request.method !== 'POST') { return new Response('method not allowed', { status: 405 }); }
    const form = await request.formData();
    const handle = String(form.get('handle') || '');
    if (form.get('decision') !== 'approve') {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    if (!sameSecret(form.get('key'), env.MCP_ACCESS_KEY)) {
      // the handle is still unused: show the same form again
      return page('<!doctype html><meta charset="utf-8"><p>Wrong access key. Go back and try again.</p>',
        new Headers(), 401);
    }
    const scope = form.getAll('scope').map(String);
    const approved = await oauth.approveConsent(request, handle, { scope: scope.length ? scope : ['mcp'] });
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request, userId: 'access-key', metadata: {},
      scope: approved.request.scope, props: { user: 'access-key' },
    });
    approved.headers.set('Location', redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (err) {
    if (err instanceof AuthorizationError && err.redirectTo) { return Response.redirect(err.redirectTo, 302); }
    if (err instanceof AuthorizationError) {
      return new Response(escapeHtml(err.description || err.message), { status: 400,
        headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    throw err;
  }
}

/** @param {object} o
 *  @param {{fetch}} o.session  createSession(...) — the session routes
 *  @param {{handle}} o.mcp     createMcpHandler(...) */
export function createApp({ session, mcp }) {
  const providers = new Map();

  const publicOrigin = (request, env) => String(env.PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, '');

  function provider(origin) {
    if (!providers.has(origin)) {
      providers.set(origin, new OAuthProvider({
        apiRoute: '/mcp',
        apiHandler: { fetch: (request, env) => mcp.handle(request, env, origin) },
        defaultHandler: {
          fetch: (request, env, ctx) => (new URL(request.url).pathname === '/authorize'
            ? authorize(request, env) : session.fetch(request, env, ctx)),
        },
        authorizeEndpoint: '/authorize',
        tokenEndpoint: '/oauth/token',
        clientRegistrationEndpoint: '/oauth/register',
        scopesSupported: ['mcp', 'offline_access'],
        requiredScopes: ['mcp'],
        resourceMetadata: { resource: origin + '/mcp', authorization_servers: [origin],
          resource_name: 'CascadeStudio build123d sessions', bearer_methods_supported: ['header'] },
        // the access key itself also works as a bearer token (API, Claude Code)
        resolveExternalToken: async ({ token, env }) => (sameSecret(token, env.MCP_ACCESS_KEY)
          ? { props: { user: 'access-key' }, audience: origin + '/mcp' } : null),
      }));
    }
    return providers.get(origin);
  }

  async function fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = publicOrigin(request, env);
    const isMcp = url.pathname === '/mcp';
    if (isMcp && request.method === 'OPTIONS') { return mcp.handle(request, env, origin); }
    // the REST bridge to the tools (session.js) takes the same access key
    if (env.MCP_ACCESS_KEY && request.method !== 'OPTIONS'
        && /^\/session\/[^/]+\/(tools\/|view\.png$)/.test(url.pathname)
        && !sameSecret(bearer(request), env.MCP_ACCESS_KEY)) {
      return new Response(JSON.stringify({ error: 'send Authorization: Bearer <access key>' }), { status: 401,
        headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer realm="cad"',
          'access-control-allow-origin': '*' } });
    }
    if (!env.MCP_ACCESS_KEY) {
      return isMcp ? mcp.handle(request, env, origin) : session.fetch(request, env, ctx);
    }
    if (!env.OAUTH_KV) {
      if (!isMcp) { return session.fetch(request, env, ctx); }
      if (sameSecret(bearer(request), env.MCP_ACCESS_KEY)) { return mcp.handle(request, env, origin); }
      return new Response(JSON.stringify({ error: 'invalid_token', error_description: 'send Authorization: Bearer <access key>' }), {
        status: 401, headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer realm="mcp"',
          'access-control-allow-origin': '*', 'access-control-expose-headers': 'www-authenticate' } });
    }
    return provider(origin).fetch(request, env, ctx);
  }

  return { fetch };
}
