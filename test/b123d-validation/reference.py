#!/usr/bin/env python3
"""reference.py - run every manifest script under REAL build123d and record
ground-truth measurements.

For each script (child subprocess, 60s timeout, scratch cwd):
  * exec() the code with show/show_object/show_all stubbed out,
  * find every module-level shape result:
      - build123d Shape instances (Part/Sketch/Curve/Compound/Face/Wire/...)
      - Builder instances (BuildPart/BuildSketch/BuildLine) -> their result
      - lists/tuples whose elements are all Shapes (first 32, as name[i])
  * measure each: volume, bounding box (6 floats), surface area,
    face count, edge count - keyed by the VARIABLE NAME so the lite run can
    compare per-name instead of guessing.

Scripts that fail natively are recorded with status "error" (their message is
kept: they are excluded from lite scoring, not silently dropped).

Usage:
  python3 reference.py [--manifest manifest.json] [--out reference.json]
                       [--jobs 4] [--only substring]
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = os.environ.get(
    "B123D_REF_PY",
    os.path.expanduser("~/Desktop/ocjs-deps/b123d-ref-venv/bin/python"))
TIMEOUT = int(os.environ.get("B123D_REF_TIMEOUT", "60"))

# The child harness: executed by the reference venv's python. Reads the
# script source from argv[1], prints one JSON object on the last stdout line.
CHILD = r'''
import json, sys, math

def _stub(*a, **k): pass

def measure_shape(obj):
    bb = obj.bounding_box()
    return {
        "volume": float(abs(obj.volume)),
        "bbox": [float(bb.min.X), float(bb.min.Y), float(bb.min.Z),
                 float(bb.max.X), float(bb.max.Y), float(bb.max.Z)],
        "area": float(obj.area),
        "faces": len(obj.faces()),
        "edges": len(obj.edges()),
    }

def main():
    src = open(sys.argv[1]).read()
    from build123d import Shape
    from build123d.build_common import Builder

    ns = {
        "__name__": "main",  # match the lite worker's module name
        # docs selector examples resolve their STEP assets relative to
        # os.path.dirname(os.path.abspath(__file__)) - the scratch cwd, where
        # reference.py has symlinked them (the lite worker defines the same
        # name in the user module, see PythonRuntime.js)
        "__file__": sys.argv[1],
        "show": _stub, "show_object": _stub, "show_all": _stub,
        "set_port": _stub, "set_defaults": _stub, "set_colormap": _stub,
    }
    exec(compile(src, "script.py", "exec"), ns)

    shapes = {}
    def add(name, obj):
        try:
            shapes[name] = measure_shape(obj)
        except Exception as e:
            shapes[name] = {"measure_error": "%s: %s" % (type(e).__name__, e)}

    for name, obj in list(ns.items()):
        if name.startswith("_") or name in ("show", "show_object", "show_all",
                                            "set_port", "set_defaults",
                                            "set_colormap"):
            continue
        if isinstance(obj, Builder):
            try:
                result = obj._obj
            except Exception:
                result = None
            if result is not None:
                add(name, result)
        elif isinstance(obj, Shape):
            add(name, obj)
        elif isinstance(obj, (list, tuple)) and obj and \
                all(isinstance(x, Shape) for x in obj):
            # skip face-less elements (edge/vertex selector lists) and sort
            # the rest by bbox center — element order frequently differs
            # between build123d and lite (same rule as the lite measurer)
            solids = [x for x in obj if len(x.faces()) > 0]
            def bbkey(x):
                bb = x.bounding_box()
                return (round((bb.min.X + bb.max.X) / 2, 3),
                        round((bb.min.Y + bb.max.Y) / 2, 3),
                        round((bb.min.Z + bb.max.Z) / 2, 3))
            for i, x in enumerate(sorted(solids[:64], key=bbkey)):
                add("%s[%d]" % (name, i), x)

    print("B123D_REF_JSON " + json.dumps({"shapes": shapes}))

main()
'''


B123D_SRC = os.environ.get("B123D_SRC", "/tmp/b123d")


def _prepare_scratch(entry, sdir):
    """Give the script the filesystem neighbourhood it expects.

    docs scripts write SVGs into `assets/` and open STEP assets next to
    themselves (`os.path.dirname(__file__)`), so create the output directories
    and symlink every non-.py sibling from the script's own source directory.
    """
    for sub in ("assets", os.path.join("assets", "topology_selection"),
                os.path.join("assets", "ttt")):
        os.makedirs(os.path.join(sdir, sub), exist_ok=True)
    reldir = entry.get("data_dir")
    if not reldir:
        return
    absdir = os.path.join(B123D_SRC, reldir)
    if not os.path.isdir(absdir):
        return
    for fname in os.listdir(absdir):
        if fname.endswith(".py"):
            continue
        src = os.path.join(absdir, fname)
        dst = os.path.join(sdir, fname)
        if os.path.isfile(src) and not os.path.exists(dst):
            try:
                os.symlink(src, dst)
            except OSError:
                pass


def run_one(entry, scratch):
    sid = entry["id"]
    sdir = os.path.join(scratch, sid.replace("/", "_"))
    os.makedirs(sdir, exist_ok=True)
    _prepare_scratch(entry, sdir)
    spath = os.path.join(sdir, "script.py")
    with open(spath, "w") as f:
        f.write(entry["code"])
    hpath = os.path.join(sdir, "harness.py")
    with open(hpath, "w") as f:
        f.write(CHILD)
    try:
        proc = subprocess.run(
            [VENV_PY, hpath, spath], capture_output=True, text=True,
            timeout=TIMEOUT, cwd=sdir)
    except subprocess.TimeoutExpired:
        return sid, {"status": "timeout"}
    if proc.returncode != 0:
        # last non-empty stderr line is the interesting one
        lines = [l for l in proc.stderr.strip().split("\n") if l.strip()]
        return sid, {"status": "error",
                     "error": lines[-1] if lines else "unknown"}
    for line in proc.stdout.strip().split("\n")[::-1]:
        if line.startswith("B123D_REF_JSON "):
            data = json.loads(line[len("B123D_REF_JSON "):])
            shapes = data["shapes"]
            if not shapes:
                return sid, {"status": "no-shapes"}
            return sid, {"status": "ok", "shapes": shapes}
    return sid, {"status": "error", "error": "harness produced no JSON"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default=os.path.join(HERE, "manifest.json"))
    ap.add_argument("--out", default=os.path.join(HERE, "reference.json"))
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--only", default=None,
                    help="only run scripts whose id contains this substring")
    args = ap.parse_args()

    manifest = json.load(open(args.manifest))
    if args.only:
        manifest = [e for e in manifest if args.only in e["id"]]

    results = {}
    if os.path.exists(args.out) and not args.only:
        pass  # full runs regenerate from scratch
    elif os.path.exists(args.out):
        results = json.load(open(args.out))

    with tempfile.TemporaryDirectory(prefix="b123d-ref-") as scratch:
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            for sid, res in pool.map(lambda e: run_one(e, scratch), manifest):
                results[sid] = res
                print("%-45s %s" % (sid, res["status"]))

    with open(args.out, "w") as f:
        json.dump(results, f, indent=1, sort_keys=True)
    ok = sum(1 for r in results.values() if r["status"] == "ok")
    print("\n%d/%d scripts measured ok -> %s" % (ok, len(results), args.out))


if __name__ == "__main__":
    main()
