#!/usr/bin/env python3
"""collect.py - enumerate candidate build123d scripts for lite-mode validation.

Sources (override the clone location with B123D_SRC):
  * <b123d>/examples/*.py                       - one script each
  * <b123d>/docs/general_examples.py            - split into numbered snippets
  * <b123d>/docs/general_examples_algebra.py    - split into numbered snippets
  * <b123d>/docs/*.py                           - the standalone documentation
                                                  scripts (objects_1d/2d/3d,
                                                  tutorial_joints, slide_latch,
                                                  rod_end, line_types, ...)
  * <b123d>/docs/objects/examples/*.py          - per-page object examples
  * <b123d>/docs/topology_selection/examples/*.py - selector examples
  * <b123d>/docs/assets/ttt/*.py                - the "Too Tall Toby" challenge
                                                  parts (each ends in a mass
                                                  assert - a hard PASS bar)
  * <b123d>/docs/**/*.rst                       - every ``code-block:: build123d``
                                                  / ``python`` snippet, plus one
                                                  cumulative script per page
                                                  (what a reader pasting a whole
                                                  tutorial page actually runs)

Each candidate is lightly sanitized (viewer imports/calls removed, doctest
prompts unwrapped) but geometry code is untouched. Output is a single
manifest.json: [{id, source, kind, code, data_dir?}].

Most .rst snippets are prose fragments (``...`` placeholders, undefined names)
rather than runnable scripts, so the manifest is produced in two stages:

    collect.py                      -> manifest-all.json  (every candidate)
    reference.py --manifest ...     -> reference-all.json  (native ground truth)
    collect.py prune                -> manifest.json + reference.json
                                       (only candidates that natively produce
                                        at least one measurable shape)

Scripts that ARE real scripts but fail natively stay in the corpus and are
recorded as SKIP by the lite runner (see reference.py); pruning only drops
candidates that were never runnable code in the first place.

Usage:
  python3 collect.py [--out manifest-all.json]
  python3 collect.py prune [--manifest manifest-all.json]
                          [--reference reference-all.json]
                          [--out manifest.json] [--out-reference reference.json]
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

# docs/*.py that are not build123d scripts at all.
SKIP_DOCS_SCRIPTS = {
    "conf.py",              # sphinx configuration
    "build123d_lexer.py",   # pygments lexer for the docs build
    # split into numbered snippets by collect_general() instead
    "general_examples.py",
    "general_examples_algebra.py",
}

# Line-level sanitizers: viewer/plot machinery that is not geometry.
# NOTE: SVG/DXF export machinery is deliberately NOT stripped - build123d-lite
# ships a no-op ExportSVG, and the reference run has a scratch cwd with an
# assets/ directory, so both sides tolerate it verbatim.
DROP_LINE_PATTERNS = [
    r"^\s*from\s+ocp_vscode\s+import\b",
    r"^\s*import\s+ocp_vscode\b",
    r"^\s*set_port\s*\(",
    r"^\s*set_defaults\s*\(",
    r"^\s*set_colormap\s*\(",
    # ocp_vscode viewer control that has no geometry meaning at all
    r"^\s*save_screenshot\s*\(",
    r"^\s*set_viewer_config\s*\(",
    r"^\s*reset_show\s*\(",
    r"^\s*push_object\s*\(",
    # SVG/export helpers in docs scripts
    r"^\s*write_svg\s*\(",
    r"^\s*svgout\s*\(",
]
DROP_LINE_RE = [re.compile(p) for p in DROP_LINE_PATTERNS]


def _bracket_delta(line):
    """Net (/[/{ nesting change of a line, ignoring strings and comments."""
    depth = 0
    quote = None
    i = 0
    while i < len(line):
        ch = line[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if line.startswith(quote, i):
                i += len(quote)
                quote = None
                continue
            i += 1
            continue
        if ch in "\"'":
            for q in ('"""', "'''"):
                if line.startswith(q, i):
                    quote = q
                    break
            else:
                quote = ch
            i += len(quote)
            continue
        if ch == "#":
            break
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        i += 1
    return depth


def sanitize(code):
    """Remove viewer/export statements; keep everything else verbatim.

    Statement-aware: docs scripts call `write_svg(\\n ... \\n)` across several
    lines, so once a drop pattern matches, the continuation lines are removed
    with it (commenting only the first line used to leave a dangling `)` and
    turn the whole script into a SyntaxError). Line COUNT is preserved so
    tracebacks still map onto the upstream source visually.
    """
    out = []
    lines = code.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if not any(p.match(line) for p in DROP_LINE_RE):
            out.append(line)
            i += 1
            continue
        indent = line[:len(line) - len(line.lstrip())]
        depth = _bracket_delta(line)
        # inside a block the statement cannot just vanish, or the block body
        # becomes empty (IndentationError) - keep a `pass` in its place
        out.append("%s%s# [removed by collect.py] %s"
                   % (indent, "pass  " if indent else "", line.strip()))
        i += 1
        while depth > 0 and i < len(lines):
            out.append("# [removed by collect.py] " + lines[i].strip())
            depth += _bracket_delta(lines[i])
            i += 1
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


# --------------------------------------------------------------------------
# Standalone .py scripts living under docs/ (the documentation's own sources)
# --------------------------------------------------------------------------

# (relative directory under the clone, manifest id prefix, kind)
SCRIPT_DIRS = [
    ("docs", "docs", "docs-script"),
    ("docs/objects/examples", "docs-objects", "docs-script"),
    ("docs/topology_selection/examples", "docs-selectors", "docs-script"),
    ("docs/assets/ttt", "ttt", "ttt"),
]


ASSET_EXTS = (".step", ".stp", ".stl", ".iges", ".igs")


def script_assets(reldir, code):
    """CAD files the script imports from its own directory.

    The reference run gets these as symlinks; the lite run has no filesystem,
    so run-lite.mjs reads them out of the clone and hands the content to the
    worker (CascadeAPI.loadExternalFiles) before evaluating. Only files whose
    name actually appears in the source are listed."""
    absdir = os.path.join(B123D_SRC, reldir)
    if not os.path.isdir(absdir):
        return []
    return sorted(f for f in os.listdir(absdir)
                  if f.lower().endswith(ASSET_EXTS) and f in code)


def collect_script_dirs(manifest):
    for reldir, prefix, kind in SCRIPT_DIRS:
        absdir = os.path.join(B123D_SRC, reldir)
        if not os.path.isdir(absdir):
            continue
        for fname in sorted(os.listdir(absdir)):
            if not fname.endswith(".py") or fname in SKIP_DOCS_SCRIPTS:
                continue
            code = open(os.path.join(absdir, fname)).read()
            code = sanitize(strip_module_docstring(code))
            manifest.append({
                "id": "%s/%s" % (prefix, fname[:-3]),
                "source": "%s/%s" % (reldir, fname),
                "kind": kind,
                "code": code,
                # data files the script may open relative to its own location
                # (STEP assets, output directories) are symlinked next to the
                # script by reference.py
                "data_dir": reldir,
                # CAD assets the script imports, delivered to the worker by
                # run-lite.mjs (the worker has no filesystem)
                "assets": script_assets(reldir, code),
            })


# --------------------------------------------------------------------------
# ``code-block::`` snippets embedded in the .rst documentation pages
# --------------------------------------------------------------------------

CODE_DIRECTIVE_RE = re.compile(
    r"^([ \t]*)\.\.\s+code-block::\s*(build123d|python)\s*$")
RST_OPTION_RE = re.compile(r"^[ \t]*:[A-Za-z0-9_-]+:")


def _indent_width(line):
    return len(line) - len(line.lstrip())


def extract_rst_blocks(path):
    """Yield the dedented source of every python/build123d code-block."""
    lines = open(path).read().split("\n")
    i = 0
    while i < len(lines):
        m = CODE_DIRECTIVE_RE.match(lines[i])
        if not m:
            i += 1
            continue
        base_indent = len(m.group(1).expandtabs(8))
        i += 1
        # directive options (:linenos:, :emphasize-lines: 3, ...) and blanks
        while i < len(lines) and (lines[i].strip() == "" or
                                  RST_OPTION_RE.match(lines[i])):
            if lines[i].strip() != "" and not RST_OPTION_RE.match(lines[i]):
                break
            i += 1
        body = []
        while i < len(lines):
            line = lines[i]
            if line.strip() == "":
                body.append("")
                i += 1
                continue
            if _indent_width(line.expandtabs(8)) <= base_indent:
                break
            body.append(line.expandtabs(8))
            i += 1
        while body and body[-1] == "":
            body.pop()
        if not body:
            continue
        strip = min(_indent_width(l) for l in body if l.strip())
        yield "\n".join(l[strip:] if l.strip() else "" for l in body)


DOCTEST_RE = re.compile(r"^(>>>|\.\.\.)\s?")


def unwrap_doctest(code):
    """Turn a >>> doctest transcript into a plain script.

    Interactive-echo lines (the expected repr output) are dropped; statements
    keep their order. A block with no >>> prompt is returned unchanged.
    """
    lines = code.split("\n")
    if not any(l.lstrip().startswith(">>>") for l in lines):
        return code
    out = []
    in_stmt = False
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith(">>>"):
            out.append(DOCTEST_RE.sub("", stripped))
            in_stmt = True
        elif stripped.startswith("..."):
            out.append(DOCTEST_RE.sub("", stripped))
        elif stripped == "":
            in_stmt = False
            out.append("")
        elif in_stmt:
            # expected output of the previous statement - not code
            continue
        else:
            out.append(line)
    return "\n".join(out)


NEEDS_HEADER_RE = re.compile(r"^\s*(from|import)\s+build123d\b", re.M)


def prepare_snippet(code):
    """Sanitize + doctest-unwrap + ensure the build123d import is present."""
    code = unwrap_doctest(code)
    code = sanitize(code)
    if not NEEDS_HEADER_RE.search(code):
        code = "from build123d import *\nfrom math import *\n\n" + code
    return code.rstrip("\n") + "\n"


def rst_files():
    docs = os.path.join(B123D_SRC, "docs")
    for root, dirs, files in os.walk(docs):
        dirs[:] = [d for d in sorted(dirs) if d not in ("_static", "assets")]
        for fname in sorted(files):
            if fname.endswith(".rst"):
                yield os.path.join(root, fname)


def collect_rst(manifest):
    docs = os.path.join(B123D_SRC, "docs")
    for path in rst_files():
        rel = os.path.relpath(path, docs)
        stem = rel[:-4].replace("/", "-")
        blocks = list(extract_rst_blocks(path))
        if not blocks:
            continue
        for n, block in enumerate(blocks, 1):
            manifest.append({
                "id": "docs-rst/%s/b%02d" % (stem, n),
                "source": "docs/%s code-block #%d" % (rel, n),
                "kind": "docs-rst",
                "code": prepare_snippet(block),
            })
        if len(blocks) > 1:
            # What a reader following the page top-to-bottom actually runs.
            joined = "\n\n".join(unwrap_doctest(b) for b in blocks)
            manifest.append({
                "id": "docs-rst/%s/all" % stem,
                "source": "docs/%s (all %d code-blocks)" % (rel, len(blocks)),
                "kind": "docs-rst-page",
                "code": prepare_snippet(joined),
            })


# --------------------------------------------------------------------------
# Pruning: keep only candidates that natively produce measurable geometry
# --------------------------------------------------------------------------

# Real scripts stay in the corpus even when they fail natively (the lite runner
# reports them as SKIP); prose fragments never were code and are dropped.
ALWAYS_KEEP_KINDS = {"example", "docs-builder", "docs-algebra", "docs-script",
                     "ttt"}


def prune(args):
    manifest = json.load(open(args.manifest))
    reference = json.load(open(args.reference))

    kept, dropped = [], {}
    for entry in manifest:
        ref = reference.get(entry["id"])
        status = ref["status"] if ref else "missing"
        if entry["kind"] in ALWAYS_KEEP_KINDS or status == "ok":
            kept.append(entry)
        else:
            dropped[status] = dropped.get(status, 0) + 1

    kept_ids = {e["id"] for e in kept}
    ref_out = {k: v for k, v in reference.items() if k in kept_ids}

    with open(args.out, "w") as f:
        json.dump(kept, f, indent=1)
    with open(args.out_reference, "w") as f:
        json.dump(ref_out, f, indent=1, sort_keys=True)

    print("kept %d/%d candidates -> %s" % (len(kept), len(manifest), args.out))
    for status, n in sorted(dropped.items(), key=lambda kv: -kv[1]):
        print("  dropped %4d non-runnable snippets (native status: %s)" % (n, status))
    scored = sum(1 for e in kept
                 if reference.get(e["id"], {}).get("status") == "ok")
    print("  %d scored, %d excluded (real build123d fails natively)"
          % (scored, len(kept) - scored))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd")
    ap.add_argument("--out", default=os.path.join(HERE, "manifest-all.json"))

    p = sub.add_parser("prune", help="drop candidates with no native geometry")
    p.add_argument("--manifest", default=os.path.join(HERE, "manifest-all.json"))
    p.add_argument("--reference", default=os.path.join(HERE, "reference-all.json"))
    p.add_argument("--out", default=os.path.join(HERE, "manifest.json"))
    p.add_argument("--out-reference", default=os.path.join(HERE, "reference.json"))
    args = ap.parse_args()

    if args.cmd == "prune":
        return prune(args)

    if not os.path.isdir(B123D_SRC):
        sys.exit("build123d clone not found at %s (set B123D_SRC)" % B123D_SRC)

    manifest = []
    collect_examples(manifest)
    collect_general(manifest, "general_examples.py", "docs-builder")
    collect_general(manifest, "general_examples_algebra.py", "docs-algebra")
    collect_script_dirs(manifest)
    collect_rst(manifest)

    seen = set()
    for entry in manifest:
        if entry["id"] in seen:
            sys.exit("duplicate manifest id: " + entry["id"])
        seen.add(entry["id"])

    with open(args.out, "w") as f:
        json.dump(manifest, f, indent=1)
    counts = {}
    for entry in manifest:
        counts[entry["kind"]] = counts.get(entry["kind"], 0) + 1
    print("wrote %d candidates to %s" % (len(manifest), args.out))
    for kind, n in sorted(counts.items()):
        print("  %-16s %d" % (kind, n))


if __name__ == "__main__":
    main()
