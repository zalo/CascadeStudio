// @ts-check
// The editor in REMOTE-SESSION mode: build123d evaluates in a Durable Object
// editing session (examples/cloudflare-worker, `--env session`) through
// RemoteCascadeEngine — no local worker, no OCCT wasm in the page.
//
// Opt-in: needs a running session Worker, so it is skipped unless
// CS_REMOTE_URL points at an editor page in remote mode, e.g.
//
//   (cd examples/cloudflare-worker && npm run dev:session)        # :8787
//   CS_REMOTE_URL=http://127.0.0.1:8787/ npx playwright test remote-session
//
// or, with the editor served apart from wrangler (see EDITOR.md for why
// that is the steadier local setup):
//
//   npx http-server examples/cloudflare-worker/editor -p 8797 -c-1
//   CS_REMOTE_URL='http://127.0.0.1:8797/?server=http://127.0.0.1:8787' \
//     npx playwright test remote-session
const { test, expect } = require('@playwright/test');

const REMOTE_URL = process.env.CS_REMOTE_URL;
test.skip(!REMOTE_URL, 'set CS_REMOTE_URL to an editor page in remote-session mode');
// one session per test: sessions are serialized server-side
test.describe.configure({ mode: 'serial' });

const BOX = `from build123d import *
with BuildPart() as p:
    Box(40, 30, 10)
    fillet(p.edges().filter_by(Axis.Z), 3)
    with Locations((0, 0, 5)):
        Cylinder(8, 12, align=(Align.CENTER, Align.CENTER, Align.MIN))
    Hole(4)
show(p.part)
`;

async function gotoSession(page) {
  const url = new URL(REMOTE_URL);
  url.searchParams.set('session', 'pw-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  await page.goto(url.href);
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), { timeout: 120000 });
}

async function run(page, code) {
  const result = await page.evaluate((c) => window.CascadeAPI.runCode(c), code);
  const report = await page.evaluate(() => window.cascadeApp.engine.lastReport);
  return { result, report };
}

test('starts in remote mode, Python only, and evaluates the starter remotely', async ({ page }) => {
  await gotoSession(page);
  expect(await page.evaluate(() => window.cascadeApp.engine.isRemote)).toBe(true);
  expect(await page.evaluate(() => window.CascadeAPI.getMode())).toBe('python');
  await expect(page.locator('#remoteBadge')).toBeVisible();
  const disabled = await page.evaluate(() => Array.from(document.getElementById('editorMode').options)
    .filter((o) => o.disabled).map((o) => o.value));
  expect(disabled.sort()).toEqual(['cascadestudio', 'openscad']);
  expect(await page.evaluate(() => window.CascadeAPI.getErrors())).toEqual([]);
  expect((await page.evaluate(() => window.CascadeAPI.getHistorySteps())).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.threejsViewport._shapeLines.length)).toBeGreaterThan(0);
  // no local engine was started
  expect(await page.evaluate(() => performance.getEntriesByType('resource')
    .some((e) => /cascadestudio.*\.wasm|cascade-worker\.js/.test(e.name)))).toBe(false);
});

test('an edit re-uses the session cache; the mesh carries the source lines', async ({ page }) => {
  await gotoSession(page);
  const first = await run(page, BOX);
  expect(first.result.errors).toEqual([]);
  const again = await run(page, BOX);
  expect(again.report.cache.misses).toBe(0);
  expect(again.report.cache.hits).toBe(first.report.cache.hits + first.report.cache.misses);
  // the incremental mesh: every face of a re-run is the same geometry, and
  // this page already holds it, so only references travel
  expect(again.report.meshStats.reused).toBe(again.report.meshStats.faces);
  expect(again.report.meshStats.meshed).toBe(0);
  expect(again.report.wireBytes).toBeLessThan(first.report.wireBytes);
  const edited = await run(page, BOX.replace('Box(40, 30, 10)', 'Box(44, 30, 10)'));
  expect(edited.report.cache.hits).toBeGreaterThan(0);
  expect(edited.report.cache.misses).toBeGreaterThan(0);
  expect(edited.report.session.warm).toBe(true);
  expect(edited.report.meshStats.reused).toBeGreaterThan(0);
  expect(edited.report.meshStats.meshed).toBeGreaterThan(0);
  // the scene shape was made by the Hole on line 7
  await page.waitForFunction(() => window.threejsViewport._shapeLines.length === 1);
  expect(await page.evaluate(() => window.threejsViewport._shapeLines)).toEqual([7]);
  const tris = await page.evaluate(() => {
    let n = 0;
    window.threejsViewport.mainObject.traverse((o) => { if (o.isMesh && o.geometry.index) { n += o.geometry.index.count / 3; } });
    return n;
  });
  expect(tris).toBeGreaterThan(100);
});

test('the mesh streams into the viewport in batches', async ({ page }) => {
  await gotoSession(page);
  const PLATE = `from build123d import *
plate = Box(110, 110, 5) - GridLocations(10, 10, 10, 10) * Cylinder(3, 10)
plate = fillet(plate.edges().group_by(Axis.Z)[-1], FILLET)
show(plate)
`;
  await run(page, PLATE.replace('FILLET', '0.5'));
  await page.evaluate(() => {
    window.__batches = [];
    window.__partialSeen = false;
    window.cascadeApp.engine.on('meshBatch', (b) => {
      window.__batches.push({ faces: b.faces.length, edges: b.edges.length, total: b.total, reused: b.reused });
    });
    const v = window.threejsViewport;
    const draw = v.renderPartialMesh.bind(v);
    v.renderPartialMesh = (f, e) => { draw(f, e); if (v._partialGroup) { window.__partialSeen = true; } };
  });
  // a grid of 100 holes is over one batch of nodes
  const { report } = await run(page, PLATE.replace('FILLET', '0.5').replace('Box(110, 110, 5)', 'Box(110, 110, 6)'));
  const batches = await page.evaluate(() => window.__batches);
  expect(batches.length).toBeGreaterThan(2);
  expect(batches[0].total).toBe(report.meshStats.faces);
  expect(batches.reduce((n, b) => n + b.faces, 0)).toBe(report.meshStats.faces);
  expect(await page.evaluate(() => window.__partialSeen)).toBe(true);
  // the streamed batches are gone; the full model is shown
  expect(await page.evaluate(() => window.threejsViewport._partialGroup)).toBe(null);
  expect(await page.evaluate(() => window.threejsViewport.mainObject.visible)).toBe(true);
});

/** The MCP endpoint next to the editor's session API (an agent's view). */
function mcpEndpoint() {
  const url = new URL(REMOTE_URL);
  return (url.searchParams.get('server') || url.origin).replace(/\/+$/, '') + '/mcp';
}
async function mcp(name, args) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (process.env.CS_MCP_KEY) { headers.authorization = 'Bearer ' + process.env.CS_MCP_KEY; }
  const resp = await fetch(mcpEndpoint(), { method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  const j = await resp.json();
  return { isError: !!j.result.isError, text: j.result.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') };
}

test('an agent and the editor share one session over MCP', async ({ page }) => {
  const sid = 'pw-mcp-' + Date.now().toString(36);
  const made = await mcp('set_script', { session: sid, code: BOX });
  expect(made.isError).toBe(false);
  // the editor opens on the agent's script and renders it
  const url = new URL(REMOTE_URL);
  url.searchParams.set('session', sid);
  await page.goto(url.href);
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), { timeout: 60000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking() && window.threejsViewport._shapeLines.length === 1,
    { timeout: 120000 });
  expect(await page.evaluate(() => window.CascadeAPI.getCode())).toBe(BOX);
  // the agent changes it; the open editor follows and re-renders
  const appended = await mcp('execute', { session: sid, code: 'marker = Pos(40, 0, 0) * Box(4, 4, 4)\nshow(p.part, marker)' });
  expect(appended.isError).toBe(false);
  await page.waitForFunction(() => window.CascadeAPI.getCode().includes('marker = Pos(40, 0, 0)'), { timeout: 20000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking() && window.threejsViewport._shapeLines.length === 2,
    { timeout: 60000 });
  // the person edits and evaluates; the agent sees it
  await page.evaluate(() => window.CascadeAPI.runCode(window.CascadeAPI.getCode().replace('Box(40, 30, 10)', 'Box(46, 30, 10)')));
  const seen = await mcp('get_script', { session: sid });
  expect(seen.text).toMatch(/last changed by the editor/);
  expect(seen.text).toMatch(/Box\(46, 30, 10\)/);
});

test('Python errors land on their source line', async ({ page }) => {
  await gotoSession(page);
  const { result } = await run(page, BOX + 'p.part.no_such_method()\n');
  expect(result.errors.length).toBe(1);
  expect(result.errors[0]).toMatch(/^Line 9: Python AttributeError/);
  const markers = await page.evaluate(() => window.monaco.editor.getModelMarkers({ owner: 'test' })
    .map((m) => m.startLineNumber));
  expect(markers).toEqual([9]);
});

test('timeline steps and STEP export come from the session', async ({ page }) => {
  await gotoSession(page);
  const { result } = await run(page, BOX);
  expect(result.errors).toEqual([]);
  const steps = await page.evaluate(() => window.CascadeAPI.getHistorySteps().length);
  expect(steps).toBeGreaterThan(2);
  const faces = await page.evaluate(async () => {
    const m = await window.cascadeApp.engine.meshHistoryStep(0, 0.1);
    return m ? m[0].length : -1;
  });
  expect(faces).toBe(6);   // the Box, before the fillet
  await page.evaluate(() => window.threejsViewport._showHistoryStep(0));
  expect(await page.evaluate(() => !!window.threejsViewport._historyObject)).toBe(true);
  const step = await page.evaluate(() => window.cascadeApp.engine.exportSTEP());
  expect(step.startsWith('ISO-10303-21;')).toBe(true);
});
