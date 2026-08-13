#!/bin/bash
# Apply the canonical-free-edges patch to a build123d source tree.
#
#   ./repatch.sh                      # -> /tmp/b123d-0111 from the installed 0.11.1
#   ./repatch.sh /path/to/build123d-checkout/src/build123d
#                                     # -> patch a git checkout in place (e.g. dev)
#
# The PR itself targets gumyr/build123d dev; patch/canonical-free-edges.diff is
# generated from that branch and applies with `patch -p1`.  This script exists so
# the same edits can be regenerated from a pristine tree at any time.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
CANONICAL="$HERE/../patch/src/build123d/topology/canonical.py"

if [ -n "$1" ]; then
  python3 "$HERE/apply_patch.py" "$1" "$CANONICAL"
  exit 0
fi

SP=${SP:-~/Desktop/ocjs-deps/b123d-ref-venv/lib/python3.12/site-packages/build123d}
rm -rf /tmp/b123d-0111 && mkdir -p /tmp/b123d-0111
cp -r "$SP" /tmp/b123d-0111/build123d
rm -rf /tmp/b123d-0111/build123d/__pycache__ /tmp/b123d-0111/build123d/topology/__pycache__
python3 "$HERE/apply_patch.py" /tmp/b123d-0111/build123d "$CANONICAL"
