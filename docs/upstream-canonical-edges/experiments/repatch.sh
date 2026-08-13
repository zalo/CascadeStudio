#!/bin/bash
# Copy the installed build123d 0.11.1 into /tmp/b123d-0111 and apply the
# canonical-free-edges patch to it, so it can be imported with
#   PYTHONPATH=/tmp/b123d-0111
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SP=${SP:-~/Desktop/ocjs-deps/b123d-ref-venv/lib/python3.12/site-packages/build123d}
rm -rf /tmp/b123d-0111 && mkdir -p /tmp/b123d-0111
cp -r "$SP" /tmp/b123d-0111/build123d
rm -rf /tmp/b123d-0111/build123d/__pycache__ /tmp/b123d-0111/build123d/topology/__pycache__
python3 "$HERE/apply_patch.py" /tmp/b123d-0111/build123d "$HERE/../patch/src/build123d/topology/canonical.py"
