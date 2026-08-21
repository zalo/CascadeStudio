#!/usr/bin/env python3
"""Dump pybind signatures (param names/types/DEFAULTS, staticness, tuple
returns) for every OCP class the topology bill needs, from the REAL OCP
7.9.3 in the reference venv. The shim generator uses the defaults to fill
omitted trailing arguments (embind has no default args).

  ~/Desktop/ocjs-deps/b123d-ref-venv/bin/python3 dump_ocp_defaults.py
"""
import inspect
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BILL = json.loads((HERE / "ocp-method-bill.json").read_text())

sys.path.insert(
    0,
    "/home/agent-untrusted/Desktop/ocjs-deps/b123d-ref-venv/lib/python3.12/"
    "site-packages",
)

SIG_RE = re.compile(r"^\s*(?:\d+\.\s*)?(\w+)\((.*)\)\s*->\s*(.+?)\s*$")


def split_params(s):
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch in "([{<":
            depth += 1
        elif ch in ")]}>":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def parse_param(p):
    # name: type = default   (default may be <Enum.Member: 3> or literal)
    m = re.match(r"^(\*?\w+)\s*(?::\s*(.*?))?\s*(?:=\s*(.+))?$", p)
    if not m:
        return {"raw": p}
    name, typ, dflt = m.groups()
    d = {"name": name}
    if typ:
        d["type"] = typ.replace("OCP.OCP.", "OCP.")
    if dflt is not None:
        d["default"] = dflt
        em = re.match(r"^<(\w+)\.(\w+): (-?\d+)>$", dflt)
        if em:
            d["default_enum"] = [em.group(1), em.group(2), int(em.group(3))]
    return d


def parse_doc(doc):
    sigs = []
    for line in (doc or "").split("\n"):
        m = SIG_RE.match(line)
        if not m:
            continue
        name, params, ret = m.groups()
        plist = [parse_param(p) for p in split_params(params)]
        if plist and plist[0].get("name") == "self":
            plist = plist[1:]
            is_static = False
        else:
            is_static = True
        sigs.append({
            "params": plist,
            "ret": ret.replace("OCP.OCP.", "OCP."),
            "static_form": is_static,
        })
    return sigs


def main():
    classes = sorted(
        c for c in BILL["per_class"]
        if c not in ("?",) and not c.startswith("[module")
    )
    closure_file = HERE / "closure.json"
    if closure_file.exists():
        classes = sorted(set(classes) | set(json.loads(closure_file.read_text())))
    out = {}
    for cls in classes:
        found = None
        entry_bill = BILL["per_class"].get(cls) or {}
        mod_name = entry_bill.get("module")
        candidates = [mod_name] if mod_name and mod_name != "?" else []
        # fall back: guess module from prefix
        candidates.append(cls.split("_")[0])
        for mod in candidates:
            try:
                m = __import__("OCP." + mod, fromlist=[cls])
                found = getattr(m, cls, None)
                if found is not None:
                    break
            except Exception:
                continue
        if found is None:
            continue
        entry = {"ctor": parse_doc(getattr(found, "__init__", None).__doc__
                                   if hasattr(found, "__init__") else None),
                 "methods": {}}
        for name in dir(found):
            if name.startswith("__"):
                continue
            try:
                a = inspect.getattr_static(found, name)
            except AttributeError:
                continue
            is_static = isinstance(a, staticmethod)
            obj = getattr(found, name)
            if not callable(obj):
                continue
            sigs = parse_doc(getattr(obj, "__doc__", None))
            if not sigs:
                continue
            entry["methods"][name] = {
                "static": bool(is_static),
                "sigs": sigs,
                "tuple_ret": any(s["ret"].startswith(("Tuple[", "tuple["))
                                 for s in sigs),
            }
        out[cls] = entry
    (HERE / "ocp-defaults.json").write_text(json.dumps(out, indent=0))
    print("classes dumped:", len(out), "of", len(classes))


if __name__ == "__main__":
    main()
