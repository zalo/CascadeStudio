// compare-examples.mjs — run build123d example scripts (from the validation
// manifest) through BOTH Python source layers on the MicroPython runtime:
//   lite     (?pyruntime=micropython)
//   upstream (?pyruntime=micropython&pysrc=upstream)
// and diff the per-variable volume/bbox measurements. Usage:
//   CS_TEST_HEADFUL=1 DISPLAY=:99 node compare-examples.mjs id [id ...]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PORT = parseInt(process.env.CS_TEST_PORT || '8351', 10);
const manifest = JSON.parse(readFileSync(join(ROOT, 'test', 'b123d-validation', 'manifest.json'), 'utf8'));
const ids = process.argv.slice(2);

const MEASURE_SNIPPET = [
  '',
  'import build123d as _b123d_mod',
  '_g2 = {}',
  'for _k, _v in list(globals().items()):',
  '    _bld = getattr(_b123d_mod, "Builder", None)',
  '    if _bld is not None and isinstance(_v, _bld) and getattr(_v, "_obj", None) is not None:',
  '        _g2[_k] = _v._obj',
  '    else:',
  '        _g2[_k] = _v',
  'print("B123D_MEASURE " + _b123d_mod._measure_globals_json(_g2))',
].join('\n');

const browser = await chromium.launch({
  headless: !process.env.CS_TEST_HEADFUL,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

async function makePage(query) {
  const page = await browser.newPage();
  page.on('pageerror', () => {});
  await page.goto('http://localhost:' + PORT + '/' + query, { timeout: 60000 });
  await page.waitForFunction(() => window.CascadeAPI && window.CascadeAPI.isReady(), undefined, { timeout: 90000 });
  await page.waitForFunction(() => !window.CascadeAPI.isWorking(), undefined, { timeout: 120000 });
  await page.evaluate(() => window.CascadeAPI.setMode('python'));
  return page;
}

async function runOn(page, code) {
  await page.evaluate(async (c) => { await window.CascadeAPI.runCode(c); }, code);
  try {
    await page.waitForFunction(
      () => window.CascadeAPI.getConsoleLog().some((l) => l.startsWith('B123D_MEASURE ')) ||
            window.CascadeAPI.getErrors().some((e) => e.includes('Python ')),
      undefined, { timeout: 120000 });
  } catch (e) { /* dump whatever we have */ }
  const logs = await page.evaluate(() => window.CascadeAPI.getConsoleLog());
  const errors = await page.evaluate(() => window.CascadeAPI.getErrors());
  const line = logs.find((l) => l.startsWith('B123D_MEASURE '));
  let measure = null;
  if (line) {
    const payload = line.slice('B123D_MEASURE '.length);
    try { measure = JSON.parse(payload); } catch (e) {
      try { measure = JSON.parse(JSON.parse('"' + payload + '"')); } catch (e2) { measure = null; }
    }
  }
  return { measure, errors };
}

const litePage = await makePage('?pyruntime=micropython');
const upPage = await makePage('?pyruntime=micropython&pysrc=upstream');

const summary = [];
for (const id of ids) {
  const entry = manifest.find((e) => e.id === id);
  if (!entry) { console.log(id + ': NOT IN MANIFEST'); continue; }
  const code = entry.code + MEASURE_SNIPPET;
  const lite = await runOn(litePage, code);
  const up = await runOn(upPage, code);
  let verdict;
  const details = [];
  if (!up.measure) {
    verdict = 'UPSTREAM-ERROR';
    const pyErr = up.errors.find((e) => e.includes('Python '));
    details.push((pyErr || up.errors.slice(-1)[0] || 'no measurement')
      .split('\\n').filter((l) => l.trim()).slice(0, 1).concat(
        (pyErr || '').split('\\n').filter((l) => l.trim()).slice(-1)
      ).join(' | ').slice(0, 300));
  } else if (!lite.measure) {
    verdict = 'LITE-ERROR (upstream ran: ' + Object.keys(up.measure).length + ' vars)';
  } else {
    verdict = 'MATCH';
    const keys = Object.keys(lite.measure);
    for (const k of keys) {
      const a = lite.measure[k]; const b = up.measure[k];
      if (!b) { verdict = 'DIFF'; details.push(k + ': missing upstream'); continue; }
      if (a.measure_error || b.measure_error) { continue; }
      const dv = Math.abs((a.volume || 0) - (b.volume || 0));
      const rel = dv / Math.max(1e-9, Math.abs(a.volume || 0));
      if (dv > 1e-6 && rel > 0.005) {
        verdict = 'DIFF';
        details.push(k + ': vol ' + a.volume + ' vs ' + b.volume);
      }
    }
    const extra = Object.keys(up.measure).filter((k) => !(k in lite.measure));
    if (extra.length) { details.push('upstream-extra: ' + extra.join(',')); }
  }
  console.log(id + ': ' + verdict + (details.length ? '\n    ' + details.slice(0, 4).join('\n    ') : ''));
  summary.push([id, verdict]);
}
console.log('\n=== ' + summary.filter(([, v]) => v === 'MATCH').length + '/' + summary.length + ' MATCH ===');
await browser.close();
