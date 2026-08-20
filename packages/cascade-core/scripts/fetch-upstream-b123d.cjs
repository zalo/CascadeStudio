#!/usr/bin/env node
// fetch-upstream-b123d.cjs - vendor UPSTREAM build123d Python sources for the
// `?pysrc=upstream` mode (they run, transformed, on the MicroPython runtime —
// see src/worker/UpstreamB123d.js).
//
// The vendor dirs are COMMITTED (they are the MicroPython runtime's default
// source layer); this script is the version-bump tool. Which vendored dir is
// ACTIVE is a single constant: ACTIVE_UPSTREAM_VENDOR in UpstreamB123d.js.
//
// Usage:
//   node fetch-upstream-b123d.cjs                      # re-vendor 0.11.1
//   node fetch-upstream-b123d.cjs --src <dir> --out <vendor-name> \
//       --provenance "<text for README>"               # vendor another tree
//
// Source of the files (first match wins):
//   1. --src <dir containing build123d *.py> (or env B123D_SRC)
//   2. the local reference venv used by test/b123d-validation
//   3. pip download build123d==0.11.1 (left to the user; this script only
//      copies local files to stay deterministic offline)
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const FILES = [
  'build_enums.py', 'build_constants.py', 'build_common.py', 'build_line.py',
  'build_part.py', 'build_sketch.py', 'objects_part.py', 'objects_curve.py',
  // stretch modules (loaded best-effort at runtime)
  'objects_sketch.py', 'operations_generic.py', 'operations_part.py',
  'operations_sketch.py', 'joints.py', 'pack.py', 'pack_utils.py',
];

const CANDIDATES = [
  argOf('--src'),
  process.env.B123D_SRC,
  path.join(process.env.HOME || '', 'Desktop', 'ocjs-deps', 'b123d-ref-venv',
    'lib', 'python3.12', 'site-packages', 'build123d'),
].filter(Boolean);

const srcDir = CANDIDATES.find((d) => fs.existsSync(path.join(d, 'build_common.py')));
if (!srcDir) {
  console.error('[fetch-upstream-b123d] no build123d source tree found.');
  console.error('  Pass --src <dir with build123d *.py> or set B123D_SRC');
  console.error('  (e.g. from `pip download build123d==0.11.1` -> extracted sdist).');
  process.exit(1);
}

const outName = argOf('--out') || 'build123d-0.11.1';
const provenance = argOf('--provenance');

const monoRoot = path.join(__dirname, '..', '..', '..');
const outDir = path.join(monoRoot, 'vendor', outName);
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
// upstream's LICENSE/NOTICE (Apache-2.0) ride along: the vendor dir is
// COMMITTED, so the license text must be present in the repo and in deploys.
for (const legal of ['LICENSE', 'NOTICE']) {
  const candidates = [
    path.join(srcDir, '..', `build123d-0.11.1.dist-info`, 'licenses', legal),
    path.join(srcDir, '..', legal),
    path.join(srcDir, '..', '..', legal),
    path.join(srcDir, '..', '..', '..', legal),
    path.join(srcDir, legal),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) {
    fs.copyFileSync(found, path.join(outDir, legal));
  } else {
    console.warn('[fetch-upstream-b123d] upstream ' + legal + ' not found '
      + 'next to the sources — copy it into ' + outDir + ' by hand');
  }
}
fs.writeFileSync(path.join(outDir, 'VERSION'),
  (provenance || 'build123d 0.11.1') + '\nsources copied from ' + srcDir + '\n');
if (provenance) {
  fs.writeFileSync(path.join(outDir, 'README.md'),
    '# Vendored upstream build123d sources\n\n' + provenance + '\n\n'
    + 'Copied from `' + srcDir + '` by '
    + '`packages/cascade-core/scripts/fetch-upstream-b123d.cjs`.\n'
    + 'License: Apache-2.0 (see LICENSE/NOTICE in this directory).\n\n'
    + 'The ACTIVE vendored version is selected by the single constant\n'
    + '`ACTIVE_UPSTREAM_VENDOR` in '
    + '`packages/cascade-core/src/worker/UpstreamB123d.js`.\n');
}
console.log('[fetch-upstream-b123d] copied ' + copied + ' files to ' + outDir);
