// probe.mjs - debug helper: run ONE Python script (file path or --id from
// manifest.json) through the built app and print the raw measurement JSON
// plus errors/logs. Usage:
//   CS_TEST_HEADFUL=1 DISPLAY=:99 node probe.mjs /tmp/snippet.py
//   CS_TEST_HEADFUL=1 DISPLAY=:99 node probe.mjs --id examples/extrude_algebra
// Env: CS_TEST_PORT (default 8517; the server must already be running or
// dist is served on the port by run-lite.mjs conventions).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PORT = parseInt(process.env.CS_TEST_PORT || '8517', 10);
// CS_PY_RUNTIME=pyodide runs the script on the experimental CPython runtime
// (needs the vendored Pyodide core — see PyodideRuntime.js).
const PY_RUNTIME_QUERY = process.env.CS_PY_RUNTIME === 'pyodide' ? '?pyruntime=pyodide' : '';

const args = process.argv.slice(2);
let code;
if (args[0] === '--id') {
  const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
  code = manifest.find((e) => e.id === args[1]).code;
} else {
  code = readFileSync(args[0], 'utf8');
}
code += '\n\nimport build123d as _b123d_lite_mod\n' +
  'print("B123D_MEASURE " + _b123d_lite_mod._measure_globals_json(globals()))\n';

async function ensureServer() {
  const alive = await new Promise((res) => {
    const req = http.get({ host: 'localhost', port: PORT, path: '/' }, (r) => { r.resume(); res(true); });
    req.on('error', () => res(false));
    req.setTimeout(2000, () => { req.destroy(); res(false); });
  });
  if (alive) return null;
  const proc = spawn('npx', ['http-server', './packages/cascade-studio/dist',
    '-p', String(PORT), '-c-1', '--silent'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  return proc;
}

const serverProc = await ensureServer();
const browser = await chromium.launch({
  headless: !process.env.CS_TEST_HEADFUL,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', () => {});
await page.goto(`http://localhost:${PORT}/${PY_RUNTIME_QUERY}`, { timeout: 60000 });
await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 90000 });
await page.evaluate(() => window.CascadeAPI.setMode('python'));
await page.evaluate(async (c) => { return await window.CascadeAPI.runCode(c); }, code);
try {
  await page.waitForFunction(
    () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('B123D_MEASURE ')) ||
          window.CascadeAPI.getErrors().some((e) => e.includes('Python ')),
    undefined, { timeout: 90000 });
} catch (e) { /* fall through and dump whatever we have */ }
const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
const line = logs.find((l) => l.startsWith('B123D_MEASURE '));
if (line) {
  let payload = line.slice('B123D_MEASURE '.length);
  let measure;
  try { measure = JSON.parse(payload); } catch (e) { measure = JSON.parse(JSON.parse('"' + payload + '"')); }
  console.log(JSON.stringify(measure, null, 1));
} else {
  console.log('NO MEASUREMENT');
}
console.log('--- errors ---');
for (const e of errors) console.log(e.replace(/\\n/g, '\n'));
console.log('--- last logs ---');
for (const l of logs.slice(-12)) if (!l.startsWith('B123D_MEASURE')) console.log(l);
await browser.close();
if (serverProc) serverProc.kill();
