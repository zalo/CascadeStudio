#!/usr/bin/env python3
"""native-delta.py - compare two NATIVE reference runs (reference.py output)
script by script and variable by variable.

Used for the build123d version bumps: "did real build123d's own geometry
change between version A and version B?" - independent of lite. Each run is
a reference-all.json (or reference.json); the comparison covers the ids
present in BOTH (optionally restricted with --ids-from <manifest.json>).

Per variable present in both runs:
  same     volume within 1e-9 relative and bbox within 1e-7 per axis
  drift    differs, but inside the harness PASS tolerance (0.5% volume,
           1e-3 bbox per axis) - lite could not tell the two versions apart
  CHANGED  outside the harness tolerance - a lite/upstream leg that matched
           version A on this variable now MISMATCHes against version B

Per script (both natively ok): identical / drift / CHANGED (>= 1 CHANGED
variable) / vars-only (geometry agrees but the set of measured names
differs). Otherwise the status transition: newly-failing (ok -> error),
newly-passing (error -> ok), still-failing (same or different error),
plus timeouts / no-shapes.

Usage:
  python3 native-delta.py A.json B.json [--labels 0.11.1 0.13.0]
          [--ids-from manifest.json] [--json out.json] [--md out.md]
"""

import argparse
import json
import math
import re

VOL_REL_TOL = 0.005
VOL_ZERO_ABS = 1e-6
BBOX_ABS_TOL = 1e-3
SAME_VOL_REL = 1e-9
SAME_BBOX_ABS = 1e-7


def var_delta(a, b):
    """-> (class, dvol_rel, dbbox_max, detail)"""
    if "measure_error" in a or "measure_error" in b:
        if a.get("measure_error") == b.get("measure_error"):
            return "same", 0.0, 0.0, "measure_error both"
        return "CHANGED", math.inf, math.inf, "measure_error %r -> %r" % (
            a.get("measure_error"), b.get("measure_error"))
    va, vb = a["volume"], b["volume"]
    if va <= VOL_ZERO_ABS and vb <= VOL_ZERO_ABS:
        dvol = 0.0
    else:
        dvol = abs(vb - va) / max(abs(va), VOL_ZERO_ABS)
    dbb = max(abs(x - y) for x, y in zip(a["bbox"], b["bbox"]))
    if dvol <= SAME_VOL_REL and dbb <= SAME_BBOX_ABS:
        cls = "same"
    elif (va <= VOL_ZERO_ABS and vb <= 1e-3 or dvol <= VOL_REL_TOL) and \
            dbb <= BBOX_ABS_TOL:
        cls = "drift"
    else:
        cls = "CHANGED"
    # which bbox axis moved most - useful for "where did it go"
    detail = ""
    if cls == "CHANGED":
        parts = []
        if not (dvol <= VOL_REL_TOL or (va <= VOL_ZERO_ABS and vb <= 1e-3)):
            parts.append("volume %.6g -> %.6g (%+.3f%%)" % (
                va, vb, 100.0 * (vb - va) / va if va > VOL_ZERO_ABS else math.inf))
        if dbb > BBOX_ABS_TOL:
            i = max(range(6), key=lambda k: abs(a["bbox"][k] - b["bbox"][k]))
            parts.append("bbox[%d] %.4f -> %.4f" % (i, a["bbox"][i], b["bbox"][i]))
        detail = "; ".join(parts)
    return cls, dvol, dbb, detail


def compare(ra, rb, ids):
    out = {}
    for sid in ids:
        a, b = ra.get(sid), rb.get(sid)
        if a is None or b is None:
            continue
        sa, sb = a["status"], b["status"]
        entry = {"a": sa, "b": sb}
        if sa == "ok" and sb == "ok":
            sha, shb = a["shapes"], b["shapes"]
            only_a = sorted(set(sha) - set(shb))
            only_b = sorted(set(shb) - set(sha))
            vars_ = {}
            worst = "same"
            rank = {"same": 0, "drift": 1, "CHANGED": 2}
            for name in sorted(set(sha) & set(shb)):
                cls, dvol, dbb, detail = var_delta(sha[name], shb[name])
                vars_[name] = {"class": cls, "dvol_rel": dvol, "dbbox": dbb}
                if detail:
                    vars_[name]["detail"] = detail
                if rank[cls] > rank[worst]:
                    worst = cls
            entry.update(vars=vars_, only_a=only_a, only_b=only_b)
            if worst == "CHANGED":
                entry["category"] = "CHANGED"
            elif only_a or only_b:
                entry["category"] = "vars-only" if worst != "drift" else "drift+vars"
            else:
                entry["category"] = {"same": "identical", "drift": "drift"}[worst]
        elif sa == "ok":
            entry["category"] = "newly-failing"
            entry["error_b"] = b.get("error", sb)
        elif sb == "ok":
            entry["category"] = "newly-passing"
            entry["error_a"] = a.get("error", sa)
        else:
            ea, eb = a.get("error", sa), b.get("error", sb)
            norm = lambda m: re.sub(r"0x[0-9a-fA-F]+", "0x...", m or "")
            entry["category"] = "still-failing" if norm(ea) == norm(eb) else "still-failing (msg changed)"
            entry["error_a"], entry["error_b"] = ea, eb
        out[sid] = entry
    return out


def summarize(delta):
    counts = {}
    for e in delta.values():
        counts[e["category"]] = counts.get(e["category"], 0) + 1
    return counts


def markdown(delta, la, lb):
    md = []
    counts = summarize(delta)
    md.append("| Category | Scripts |\n|---|---|")
    for k in ["identical", "drift", "vars-only", "drift+vars", "CHANGED",
              "newly-failing", "newly-passing", "still-failing",
              "still-failing (msg changed)"]:
        if counts.get(k):
            md.append("| %s | %d |" % (k, counts[k]))
    md.append("")
    changed = [(k, e) for k, e in sorted(delta.items()) if e["category"] == "CHANGED"]
    if changed:
        md.append("**CHANGED (outside the harness tolerance, %s -> %s):**\n" % (la, lb))
        for sid, e in changed:
            bad = [(n, v) for n, v in e["vars"].items() if v["class"] == "CHANGED"]
            md.append("- `%s` - %d/%d variables: %s" % (
                sid, len(bad), len(e["vars"]),
                "; ".join("`%s` %s" % (n, v.get("detail", "")) for n, v in bad[:4]) +
                (" ..." if len(bad) > 4 else "")))
        md.append("")
    for cat in ("newly-failing", "newly-passing"):
        rows = [(k, e) for k, e in sorted(delta.items()) if e["category"] == cat]
        if rows:
            md.append("**%s:**\n" % cat)
            for sid, e in rows:
                err = e.get("error_b") if cat == "newly-failing" else e.get("error_a")
                md.append("- `%s` - %s" % (sid, (err or "")[:160]))
            md.append("")
    rows = [(k, e) for k, e in sorted(delta.items())
            if e["category"] in ("vars-only", "drift+vars")]
    if rows:
        md.append("**measured-name set changed (geometry of the shared names agrees):**\n")
        for sid, e in rows:
            md.append("- `%s` - only %s: %s; only %s: %s" % (
                sid, la, ", ".join(e["only_a"][:6]) or "-", lb,
                ", ".join(e["only_b"][:6]) or "-"))
        md.append("")
    return "\n".join(md)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a")
    ap.add_argument("b")
    ap.add_argument("--labels", nargs=2, default=["A", "B"])
    ap.add_argument("--ids-from", default=None,
                    help="restrict to the ids of this manifest/reference file")
    ap.add_argument("--json", default=None)
    ap.add_argument("--md", default=None)
    args = ap.parse_args()
    ra, rb = json.load(open(args.a)), json.load(open(args.b))
    ids = sorted(set(ra) & set(rb))
    if args.ids_from:
        src = json.load(open(args.ids_from))
        keep = ({e if isinstance(e, str) else e["id"] for e in src}
                if isinstance(src, list) else set(src))
        ids = [i for i in ids if i in keep]
    delta = compare(ra, rb, ids)
    if args.json:
        json.dump(delta, open(args.json, "w"), indent=1, sort_keys=True)
    md = markdown(delta, *args.labels)
    if args.md:
        open(args.md, "w").write(md + "\n")
    print("%d common ids; %s" % (len(delta), json.dumps(summarize(delta))))
    if not args.md:
        print(md)


if __name__ == "__main__":
    main()
