#!/usr/bin/env python3
"""collect.py - enumerate candidate build123d scripts for lite-mode validation.

Sources (override the clone location with B123D_SRC):
  * <b123d>/examples/*.py                     - one script each
  * <b123d>/docs/general_examples.py          - split into numbered snippets
  * <b123d>/docs/general_examples_algebra.py  - split into numbered snippets

Each candidate is lightly sanitized (viewer imports/calls removed, svg-export
helpers stripped) but geometry code is untouched. Output is a single
manifest.json: [{id, source, kind, code}].

Usage: python3 collect.py [--out manifest.json]
"""

import argparse
import json
import os
import re
import sys

B123D_SRC = os.environ.get("B123D_SRC", "/tmp/b123d")
HERE = os.path.dirname(os.path.abspath(__file__))

# Scripts that cannot be meaningfully validated headlessly (interactive
# viewers, file exports of external assets, network, ...). Everything else is
# included even if we EXPECT it to fail - failures are data, not noise.
SKIP_EXAMPLES = {
    "benchy.py",            # imports an external STL via Mesher() - no asset in scope
    "benchy_v2024.py",      # same
}

# Line-level sanitizers: viewer/plot/export machinery that is not geometry.
DROP_LINE_PATTERNS = [
    r"^\s*from\s+ocp_vscode\s+import\b",
    r"^\s*import\s+ocp_vscode\b",
    r"^\s*set_port\s*\(",
    r"^\s*set_defaults\s*\(",
    r"^\s*set_colormap\s*\(",
    # SVG/export helpers in docs scripts
    r"^\s*write_svg\s*\(",
    r"^\s*svgout\s*\(",
]
DROP_LINE_RE = [re.compile(p) for p in DROP_LINE_PATTERNS]


def sanitize(code):
    """Remove viewer/export lines; keep everything else verbatim."""
    out = []
    for line in code.split("\n"):
        if any(p.match(line) for p in DROP_LINE_RE):
            # keep the line count stable so tracebacks still map visually
            out.append("# [removed by collect.py] " + line.strip())
            continue
        out.append(line)
    return "\n".join(out)


def strip_module_docstring(code):
    """Drop a leading module docstring (license boilerplate) if present."""
    m = re.match(r'\s*(?:"""(?:.|\n)*?"""|\'\'\'(?:.|\n)*?\'\'\')\s*\n', code)
    if m:
        return code[m.end():]
    return code


def collect_examples(manifest):
    exdir = os.path.join(B123D_SRC, "examples")
    for fname in sorted(os.listdir(exdir)):
        if not fname.endswith(".py") or fname in SKIP_EXAMPLES:
            continue
        code = open(os.path.join(exdir, fname)).read()
        code = sanitize(strip_module_docstring(code))
        manifest.append({
            "id": "examples/" + fname[:-3],
            "source": "examples/" + fname,
            "kind": "example",
            "code": code,
        })


GENERAL_HELPER_RE = re.compile(
    r"def write_svg\(.*?\n(?:    .*\n|\n)*", re.MULTILINE)
SECTION_SPLIT_RE = re.compile(r"^#{10,}\s*$", re.MULTILINE)
SECTION_TITLE_RE = re.compile(r"^#\s*(\d+)\.\s*(.+)$", re.MULTILINE)


def collect_general(manifest, fname, kind):
    """Split docs/general_examples*.py into one snippet per numbered example."""
    path = os.path.join(B123D_SRC, "docs", fname)
    code = open(path).read()
    code = strip_module_docstring(code)
    code = GENERAL_HELPER_RE.sub("", code)  # remove the write_svg() helper

    sections = SECTION_SPLIT_RE.split(code)
    for section in sections:
        m = SECTION_TITLE_RE.search(section)
        if not m:
            continue  # preamble (imports) or trailing junk
        num, title = int(m.group(1)), m.group(2).strip()
        body = sanitize(section).strip("\n")
        # Every snippet gets the same minimal header the source file had.
        snippet = "from build123d import *\nfrom math import *\n\n" + body + "\n"
        manifest.append({
            "id": "%s/ex%02d" % (fname[:-3], num),
            "source": "docs/" + fname + " #%d (%s)" % (num, title),
            "kind": kind,
            "code": snippet,
        })


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "manifest.json"))
    args = ap.parse_args()

    if not os.path.isdir(B123D_SRC):
        sys.exit("build123d clone not found at %s (set B123D_SRC)" % B123D_SRC)

    manifest = []
    collect_examples(manifest)
    collect_general(manifest, "general_examples.py", "docs-builder")
    collect_general(manifest, "general_examples_algebra.py", "docs-algebra")

    with open(args.out, "w") as f:
        json.dump(manifest, f, indent=1)
    print("wrote %d candidates to %s" % (len(manifest), args.out))


if __name__ == "__main__":
    main()
