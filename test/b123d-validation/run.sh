#!/usr/bin/env bash
# End-to-end build123d-lite validation:
#   1. collect candidate scripts from the build123d clone (B123D_SRC=/tmp/b123d)
#      -> manifest-all.json (includes every docs .rst code-block, most of which
#         are prose fragments rather than scripts)
#   2. measure ground truth with REAL build123d (B123D_REF_PY venv python)
#      -> reference-all.json, then prune the fragments that never produced
#         geometry natively -> manifest.json + reference.json (the scored corpus)
#   3. build CascadeStudio and run every script through Python mode,
#      comparing volume/bbox per module-level variable -> report.md
#
# Not part of the default playwright suite. See README.md.
set -euo pipefail
cd "$(dirname "$0")"

STAGE="${1:-all}"

if [[ "$STAGE" == "all" || "$STAGE" == "collect" ]]; then
  python3 collect.py
fi

if [[ "$STAGE" == "all" || "$STAGE" == "reference" ]]; then
  python3 reference.py --manifest manifest-all.json --out reference-all.json \
    --jobs "${B123D_REF_JOBS:-4}"
  python3 collect.py prune
fi

if [[ "$STAGE" == "all" || "$STAGE" == "lite" ]]; then
  (cd ../.. && npm run build)
  node run-lite.mjs
fi
