#!/usr/bin/env node
// fetch-upstream-b123d.cjs - vendor the UPSTREAM build123d 0.11.1 Python
// sources needed by the experimental `?pysrc=upstream` mode (they run,
// transformed, on the MicroPython runtime — see src/worker/UpstreamB123d.js).
//
// Like vendor/pyodide, vendor/build123d-0.11.1/ is gitignored: a plain
// checkout does not carry upstream's sources; run this script to enable the
// mode, then rebuild.
//
// Source of the files (first match wins):
//   1. env B123D_SRC=<dir containing build123d/*.py>
//   2. the local reference venv used by test/b123d-validation
//   3. pip download build123d==0.11.1 (left to the user; this script only
//      copies local files to stay deterministic offline)
'use strict';
const fs = require('fs');
const path = require('path');

const FILES = [
  'build_enums.py', 'build_common.py', 'build_line.py', 'build_part.py',
  'build_sketch.py', 'objects_part.py', 'objects_curve.py',
  // stretch modules (loaded best-effort at runtime)
  'operations_generic.py', 'operations_sketch.py', 'joints.py', 'pack.py',
];

const CANDIDATES = [
  process.env.B123D_SRC,
  path.join(process.env.HOME || '', 'Desktop', 'ocjs-deps', 'b123d-ref-venv',
    'lib', 'python3.12', 'site-packages', 'build123d'),
].filter(Boolean);

const srcDir = CANDIDATES.find((d) => fs.existsSync(path.join(d, 'build_common.py')));
if (!srcDir) {
  console.error('[fetch-upstream-b123d] no build123d 0.11.1 source tree found.');
  console.error('  Set B123D_SRC=<dir with build123d *.py> (e.g. from');
  console.error('  `pip download build123d==0.11.1` -> extracted sdist).');
  process.exit(1);
}

const monoRoot = path.join(__dirname, '..', '..', '..');
const outDir = path.join(monoRoot, 'vendor', 'build123d-0.11.1');
fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const from = path.join(srcDir, f);
  if (!fs.existsSync(from)) {
    console.warn('[fetch-upstream-b123d] missing (skipped): ' + f);
    continue;
  }
  fs.copyFileSync(from, path.join(outDir, f));
  copied++;
}
fs.writeFileSync(path.join(outDir, 'VERSION'),
  'build123d 0.11.1 sources copied from ' + srcDir + '\n');
console.log('[fetch-upstream-b123d] copied ' + copied + ' files to ' + outDir);
