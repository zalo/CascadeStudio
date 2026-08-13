// run-lite.mjs - run every manifest script through CascadeStudio's Python
// (build123d-lite) mode and compare the produced geometry against
// reference.json (real build123d measurements).
//
// Classification per script:
//   PASS      every reference shape (matched BY VARIABLE NAME) agrees:
//             volume within 0.5% relative, bbox within 1e-3 per axis
//   MISMATCH  runs, but geometry differs / shapes missing
//   ERROR     Python-mode exception; bucketed by first missing feature
//   TIMEOUT   evaluation did not finish in time (page is reloaded)
//   SKIP      reference itself failed natively (excluded from scoring)
//
// Usage:
//   node test/b123d-validation/run-lite.mjs [--only substr] [--port 8517]
//        [--out results.json] [--report report.md]
// Env: CS_TEST_HEADFUL=1 DISPLAY=:99 to run headful (as on this machine).
//
// Requires: `npm run build` first (serves packages/cascade-studio/dist).

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const ONLY = argVal('--only', null);
const PORT = parseInt(argVal('--port', process.env.CS_TEST_PORT || '8517'), 10);
const OUT = argVal('--out', join(HERE, 'results.json'));
const REPORT = argVal('--report', join(HERE, 'report.md'));
const SCRIPT_TIMEOUT = parseInt(argVal('--timeout', '60000'), 10);
const PAGES = parseInt(argVal('--pages', '4'), 10);

const VOL_REL_TOL = 0.005;    // 0.5% relative volume tolerance
const VOL_ZERO_ABS = 1e-6;    // "zero volume" threshold for 2D/1D shapes
const BBOX_ABS_TOL = 1e-3;    // per-axis absolute bbox tolerance

// Appended to every script; prints one JSON line measured by the worker
// (see Build123dLite.js _measure_globals_json + StandardLibrary MeasureShape).
const MEASURE_FOOTER = `

import build123d as _b123d_lite_mod
print("B123D_MEASURE " + _b123d_lite_mod._measure_globals_json(globals()))
`;

function classifyError(errors) {
  // worker error strings carry LITERAL "\n" sequences — normalize so the
  // per-gap regexes stop at the message end instead of swallowing tracebacks
  const text = errors.join('\n').replace(/\\n/g, '\n');
  let m;
  if ((m = text.match(/NameError: name '([^']+)'/))) return `NameError: ${m[1]}`;
  if ((m = text.match(/AttributeError:.*?(?:attribute|no attribute) '([^']+)'/)))
    return `AttributeError: ${m[1]}`;
  if ((m = text.match(/AttributeError: '([^']+)'/))) return `AttributeError: ${m[1]}`;
  if ((m = text.match(/(?:ImportError|ModuleNotFoundError):[^'\n]*'?([A-Za-z_0-9.]+)'?/)))
    return `ImportError: ${m[1]}`;
  if ((m = text.match(/NotImplementedError: ?([^\n]*)/))) return `NotImplemented: ${m[1]}`;
  if ((m = text.match(/(TypeError|ValueError|KeyError|IndexError|RuntimeError|ZeroDivisionError): ?([^\n]*)/)))
    return `${m[1]}: ${m[2].slice(0, 80)}`;
  if ((m = text.match(/SyntaxError: ?([^\n]*)/))) return `SyntaxError: ${m[1].slice(0, 80)}`;
  return 'other: ' + text.split('\n')[0].slice(0, 100);
}

function compareShapes(refShapes, liteShapes) {
  const problems = [];
  for (const [name, ref] of Object.entries(refShapes)) {
    if (ref.measure_error) continue; // reference could not measure it
    const lite = liteShapes[name];
    if (!lite) { problems.push(`missing shape '${name}'`); continue; }
    if (lite.measure_error) { problems.push(`'${name}' lite measure error: ${lite.measure_error}`); continue; }
    // volume
    if (ref.volume <= VOL_ZERO_ABS) {
      if (lite.volume > 1e-3) problems.push(`'${name}' volume ${lite.volume.toFixed(4)} vs ~0`);
    } else if (Math.abs(lite.volume - ref.volume) > VOL_REL_TOL * ref.volume) {
      problems.push(`'${name}' volume ${lite.volume.toFixed(3)} vs ${ref.volume.toFixed(3)} ` +
        `(${(100 * (lite.volume - ref.volume) / ref.volume).toFixed(2)}%)`);
    }
    // bbox
    if (!lite.bbox) { problems.push(`'${name}' has no lite bbox`); continue; }
    for (let i = 0; i < 6; i++) {
      const d = Math.abs(lite.bbox[i] - ref.bbox[i]);
      if (d > BBOX_ABS_TOL) {
        problems.push(`'${name}' bbox[${i}] ${lite.bbox[i].toFixed(4)} vs ${ref.bbox[i].toFixed(4)} (d=${d.toFixed(4)})`);
        break; // one bbox problem per shape is enough detail
      }
    }
  }
  return problems;
}

async function ensureServer() {
  const alive = await new Promise((res) => {
    const req = http.get({ host: 'localhost', port: PORT, path: '/' }, (r) => {
      r.resume(); res(r.statusCode < 500);
    });
    req.on('error', () => res(false));
    req.setTimeout(2000, () => { req.destroy(); res(false); });
  });
  if (alive) return null;
  const proc = spawn('npx', ['http-server', './packages/cascade-studio/dist',
    '-p', String(PORT), '-c-1', '--silent'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  return proc;
}

async function newReadyPage(browser) {
  const page = await browser.newPage();
  page.on('pageerror', () => {});
  await page.goto(`http://localhost:${PORT}/`, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(),
    undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(),
    undefined, { timeout: 90000 });
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
  return page;
}

async function runScript(page, code) {
  // runCode + wait for the async console flush that carries B123D_MEASURE
  const result = await page.evaluate(async (c) => {
    return await window.CascadeAPI.runCode(c);
  }, code);
  let measure = null;
  // A thrown Python exception means the measurement footer never ran — skip
  // the (long) wait for its console line in that case.
  const earlyErrors = result && result.errors ? result.errors : [];
  const pythonFailed = earlyErrors.some((e) => e.includes('Python '));
  if (!pythonFailed) {
    try {
      // The measurement print is flushed asynchronously and heavy scripts
      // can keep the worker busy well past runCode resolving — wait long
      // (the outer per-script timeout still bounds the total).
      await page.waitForFunction(
        () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('B123D_MEASURE ')) ||
              window.CascadeAPI.getErrors().some((e) => e.includes('Python ')),
        undefined, { timeout: 45000 });
      const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
      const line = logs.find((l) => l.startsWith('B123D_MEASURE '));
      if (line) {
        // The console panel stores JSON.stringify(arg) minus the outer
        // quotes, so inner quotes arrive backslash-escaped — undo that.
        let payload = line.slice('B123D_MEASURE '.length);
        try {
          measure = JSON.parse(payload);
        } catch (e) {
          measure = JSON.parse(JSON.parse('"' + payload + '"'));
        }
      }
    } catch (e) { /* no measurement line - handled by caller */ }
  }
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  return { errors, measure };
}

/** Make sure the worker is idle so a slow script cannot poison the next
 *  one's evaluation queue. Returns false if it stayed busy (caller reloads). */
async function workerIdle(page, timeout) {
  try {
    await page.waitForFunction(() => !window.CascadeAPI.isWorking(),
      undefined, { timeout });
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))
    .filter((e) => !ONLY || e.id.includes(ONLY));
  const reference = JSON.parse(readFileSync(join(HERE, 'reference.json'), 'utf8'));

  const serverProc = await ensureServer();
  const headless = !process.env.CS_TEST_HEADFUL;
  const browser = await chromium.launch({
    headless,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  const t0 = Date.now();
  const results = {};
  const queue = [];
  let done = 0;
  for (const entry of manifest) {
    const ref = reference[entry.id];
    if (!ref || ref.status !== 'ok') {
      results[entry.id] = { status: 'SKIP', reason: `reference ${ref ? ref.status : 'missing'}` };
      done++;
      console.log(`[${done}/${manifest.length}] ${entry.id.padEnd(45)} SKIP (reference)`);
      continue;
    }
    queue.push(entry);
  }

  /** One worker: owns a page, pulls scripts off the shared queue. */
  async function pageWorker(wid) {
    let page = await newReadyPage(browser);
    const freshPage = async () => {
      try { await page.close(); } catch (_) {}
      page = await newReadyPage(browser);
    };
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const ref = reference[entry.id];
      let out;
      try {
        out = await Promise.race([
          runScript(page, entry.code + MEASURE_FOOTER),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), SCRIPT_TIMEOUT)),
        ]);
        // Don't let a still-busy worker poison this page's next script.
        if (!(await workerIdle(page, 20000))) throw new Error('worker stayed busy');
        // Brython's traceback FORMATTER sometimes dies after long run
        // sequences ("reading 'substr'"), masking the real Python error —
        // retry once on a fresh page to recover the true message.
        if (!out.measure &&
            out.errors.some((e) => e.includes("reading 'substr'"))) {
          await freshPage();
          out = await Promise.race([
            runScript(page, entry.code + MEASURE_FOOTER),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), SCRIPT_TIMEOUT)),
          ]);
          await workerIdle(page, 20000);
        }
      } catch (e) {
        results[entry.id] = { status: 'TIMEOUT' };
        done++;
        console.log(`[${done}/${manifest.length}] ${entry.id.padEnd(45)} TIMEOUT - recycling page ${wid}`);
        await freshPage();
        continue;
      }

      const pyErrors = out.errors.filter((e) => /error/i.test(e) || e.includes('Python'));
      // A raw wasm kernel abort corrupts the OCCT heap — every following
      // script on this page would fail with "memory access out of bounds".
      // Classify this script honestly, then recycle the page.
      const poisoned = out.errors.some((e) =>
        e.includes('memory access out of bounds') ||
        e.includes('table index is out of bounds') ||
        e.includes('(a raw wasm exception)') ||
        e.includes('RuntimeError: unreachable'));
      done++;
      if (!out.measure) {
        const gap = classifyError(pyErrors.length ? pyErrors : out.errors.concat(['no measurement produced']));
        results[entry.id] = { status: 'ERROR', gap, errors: pyErrors.slice(0, 3) };
        console.log(`[${done}/${manifest.length}] ${entry.id.padEnd(45)} ERROR  ${gap.split('\n')[0]}`);
        if (poisoned) { await freshPage(); }
        continue;
      }
      if (poisoned) { await freshPage(); }
      const problems = compareShapes(ref.shapes, out.measure);
      if (problems.length === 0) {
        results[entry.id] = { status: 'PASS', shapes: Object.keys(ref.shapes).length };
        console.log(`[${done}/${manifest.length}] ${entry.id.padEnd(45)} PASS   (${Object.keys(ref.shapes).length} shapes)`);
      } else {
        results[entry.id] = { status: 'MISMATCH', problems: problems.slice(0, 8) };
        console.log(`[${done}/${manifest.length}] ${entry.id.padEnd(45)} MISMATCH ${problems[0]}`);
      }
    }
    try { await page.close(); } catch (_) {}
  }

  const workers = [];
  for (let i = 0; i < Math.max(1, Math.min(PAGES, queue.length)); i++) {
    workers.push(pageWorker(i));
  }
  await Promise.all(workers);

  writeFileSync(OUT, JSON.stringify(results, null, 1));
  writeReport(results, REPORT);
  await browser.close();
  if (serverProc) serverProc.kill();

  const counts = {};
  for (const r of Object.values(results)) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(`\n== totals == ${JSON.stringify(counts)} in ${((Date.now() - t0) / 1000).toFixed(0)}s with ${PAGES} pages`);
  console.log(`results -> ${OUT}\nreport  -> ${REPORT}`);
}

function writeReport(results, path) {
  const buckets = { PASS: [], MISMATCH: [], ERROR: [], TIMEOUT: [], SKIP: [] };
  for (const [id, r] of Object.entries(results)) buckets[r.status].push([id, r]);

  const gapCounts = {};
  for (const [, r] of buckets.ERROR) gapCounts[r.gap] = (gapCounts[r.gap] || 0) + 1;
  const gaps = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]);

  const scored = Object.values(results).filter((r) => r.status !== 'SKIP').length;
  let md = `# build123d-lite validation report\n\n`;
  md += `Generated ${new Date().toISOString()} - ${Object.keys(results).length} scripts ` +
        `(${scored} scored, ${buckets.SKIP.length} excluded because real build123d fails natively).\n\n`;
  md += `| Status | Count |\n|---|---|\n`;
  for (const s of ['PASS', 'MISMATCH', 'ERROR', 'TIMEOUT', 'SKIP'])
    md += `| ${s} | ${buckets[s].length} |\n`;

  md += `\n## Feature-gap frequency (ERROR bucket)\n\n| Gap | Scripts |\n|---|---|\n`;
  for (const [gap, n] of gaps) md += `| \`${gap}\` | ${n} |\n`;

  md += `\n## Mismatches (runs, but geometry differs)\n\n`;
  for (const [id, r] of buckets.MISMATCH) {
    md += `- **${id}**\n`;
    for (const p of r.problems) md += `  - ${p}\n`;
  }

  md += `\n## Passing scripts\n\n`;
  for (const [id, r] of buckets.PASS) md += `- ${id} (${r.shapes} shapes)\n`;

  md += `\n## Errors by script\n\n`;
  for (const [id, r] of buckets.ERROR) md += `- ${id}: \`${r.gap}\`\n`;

  md += `\n## Timeouts\n\n`;
  for (const [id] of buckets.TIMEOUT) md += `- ${id}\n`;

  md += `\n## Excluded (reference failed natively)\n\n`;
  for (const [id, r] of buckets.SKIP) md += `- ${id}: ${r.reason}\n`;

  // Hand-maintained root-cause / defaults audit of every non-PASS script,
  // kept in its own file so regenerating this report never loses it.
  try {
    md += `\n` + readFileSync(join(HERE, 'defaults-audit.md'), 'utf8');
  } catch { /* no audit file yet */ }

  writeFileSync(path, md);
}

main().catch((e) => { console.error(e); process.exit(1); });
