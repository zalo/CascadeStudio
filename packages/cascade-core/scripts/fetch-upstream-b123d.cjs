#!/usr/bin/env node
// fetch-upstream-b123d.cjs - vendor UPSTREAM build123d Python sources for the
// `?pysrc=upstream` mode (they run, transformed, on the MicroPython runtime —
// see src/worker/UpstreamB123d.js).
//
// The vendor dir is COMMITTED (it is the MicroPython runtime's default source
// layer); this script is the version-bump tool. Which vendored dir is ACTIVE
// is a single constant: ACTIVE_UPSTREAM_VENDOR in UpstreamB123d.js.
//
// Usage:
//   node fetch-upstream-b123d.cjs --src <dir containing build123d *.py> \
//       --out build123d-0.13.0 --version 0.13.0 \
//       --provenance "<text for the vendor README>"
//
// Source of the files (first match wins):
//   1. --src <dir> (or env B123D_SRC) — a build123d package directory
//      (git checkout: <repo>/src/build123d; installed: site-packages/build123d)
//   2. the local 0.13.0 reference venv used by test/b123d-validation
// The script only copies local files (deterministic, offline).
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const version = argOf('--version') || '0.13.0';

const FILES = [
  'build_enums.py', 'build_constants.py', 'build_common.py', 'build_line.py',
  'build_part.py', 'build_sketch.py', 'objects_part.py', 'objects_curve.py',
  // stretch modules (loaded best-effort at runtime)
  'objects_sketch.py', 'operations_generic.py', 'operations_part.py',
  'operations_sketch.py', 'joints.py', 'pack_utils.py', 'pack.py',
  // drafting (Draft/DimensionLine/ExtensionLine/TechnicalDrawing/Arrow*):
  // pure upstream objects over Text -> the glue's opentype.js make_text
  'drafting.py',
  // geometry.py + the WHOLE topology package run VERBATIM under
  // pytopo=upstream (Stage 3); history.py/kernel.py are new in 0.13
  'geometry.py', 'topology/__init__.py', 'topology/kernel.py',
  'topology/history.py', 'topology/utils.py', 'topology/zero_d.py',
  'topology/shape_core.py', 'topology/one_d.py', 'topology/two_d.py',
  'topology/three_d.py', 'topology/composite.py',
  'topology/constrained_lines.py',
];

const CANDIDATES = [
  argOf('--src'),
  process.env.B123D_SRC,
  path.join(process.env.HOME || '', 'Desktop', 'ocjs-deps', 'b123d-013-venv',
    'lib', 'python3.13', 'site-packages', 'build123d'),
].filter(Boolean);

const srcDir = CANDIDATES.find((d) => fs.existsSync(path.join(d, 'build_common.py')));
if (!srcDir) {
  console.error('[fetch-upstream-b123d] no build123d source tree found.');
  console.error('  Pass --src <dir with build123d *.py> or set B123D_SRC');
  console.error('  (e.g. a git checkout\'s src/build123d at tag v' + version + ').');
  process.exit(1);
}

const outName = argOf('--out') || ('build123d-' + version);
const provenance = argOf('--provenance');

const monoRoot = path.join(__dirname, '..', '..', '..');
const outDir = path.join(monoRoot, 'vendor', outName);
fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
const missing = [];
for (const f of FILES) {
  const from = path.join(srcDir, f);
  if (!fs.existsSync(from)) {
    missing.push(f);
    continue;
  }
  const to = path.join(outDir, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
}
if (missing.length) {
  console.warn('[fetch-upstream-b123d] missing (skipped): ' + missing.join(', '));
}
// upstream's LICENSE/NOTICE (Apache-2.0) ride along: the vendor dir is
// COMMITTED, so the license text must be present in the repo and in deploys.
for (const legal of ['LICENSE', 'NOTICE']) {
  const candidates = [
    path.join(srcDir, '..', `build123d-${version}.dist-info`, 'licenses', legal),
    path.join(srcDir, '..', legal),
    path.join(srcDir, '..', '..', legal),
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
  'build123d ' + version + '\nsources copied from ' + srcDir + '\n');
if (provenance) {
  fs.writeFileSync(path.join(outDir, 'README.md'),
    '# Vendored upstream build123d ' + version + ' sources\n\n' + provenance + '\n\n'
    + 'Copied by `packages/cascade-core/scripts/fetch-upstream-b123d.cjs`.\n'
    + 'License: Apache-2.0 (see LICENSE/NOTICE in this directory). No file is\n'
    + 'modified: the mechanical, version-robust source transforms are applied\n'
    + 'at load time by `packages/cascade-core/src/worker/UpstreamB123d.js`.\n\n'
    + 'The ACTIVE vendored version is selected by the single constant\n'
    + '`ACTIVE_UPSTREAM_VENDOR` in UpstreamB123d.js. To bump: vendor the new\n'
    + 'tree with this script, flip the constant (+ the per-vendor module list),\n'
    + 're-bill the OCP surface (experiments/upstream-topology-spike/\n'
    + 'extract_ocp_bill.py + gen-ocp-shim.mjs) and re-run the validation\n'
    + 'harness (`CS_PY_RUNTIME=micropython CS_PY_SRC=upstream`).\n');
}
console.log('[fetch-upstream-b123d] copied ' + copied + ' files to ' + outDir);
