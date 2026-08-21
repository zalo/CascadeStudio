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


def parse_param(p, stats=None):
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
        # EXPLICIT machine-readable default encoding (the shim's resolveDefault
        # must never have to guess from the raw repr string):
        #   default_enum  = [EnumType, Member, intValue]
        #   default_lit   = the JSON literal itself (bool/None/number/string)
        #   default_ctor0 = class name to default-construct fresh per call
        #                   (the Message_ProgressRange pattern; class taken
        #                   from the object REPR, not the declared param type)
        kind = None
        em = re.match(r"^<(\w+)\.(\w+): (-?\d+)>$", dflt)
        om = re.match(r"^<(?:OCP\.)+[\w.]*?(\w+) object at 0x[0-9a-f]+>$", dflt)
        sm = re.match(r"^'(.*)'$", dflt)
        if em:
            d["default_enum"] = [em.group(1), em.group(2), int(em.group(3))]
            kind = "enum"
        elif dflt == "True":
            d["default_lit"] = True
            kind = "lit"
        elif dflt == "False":
            d["default_lit"] = False
            kind = "lit"
        elif dflt == "None":
            d["default_lit"] = None
            kind = "lit"
        elif re.match(r"^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$", dflt):
            d["default_lit"] = float(dflt) if ("." in dflt or "e" in dflt
                                               or "E" in dflt) else int(dflt)
            kind = "lit"
        elif sm:
            d["default_lit"] = sm.group(1)
            kind = "lit"
        elif om:
            d["default_ctor0"] = om.group(1)
            kind = "ctor0"
        else:
            kind = "opaque"
        if stats is not None:
            stats["defaults"] += 1
            stats["default_" + kind] = stats.get("default_" + kind, 0) + 1
            if kind == "opaque":
                stats.setdefault("opaque_examples", [])
                if len(stats["opaque_examples"]) < 20:
                    stats["opaque_examples"].append(dflt[:80])
    return d


def parse_doc(doc, stats=None):
    sigs = []
    for line in (doc or "").split("\n"):
        m = SIG_RE.match(line)
        if not m:
            continue
        name, params, ret = m.groups()
        plist = [parse_param(p, stats) for p in split_params(params)]
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


def parse_sigs(obj, stats=None):
    """__doc__ first (pybind writes every overload there); fall back to
    __text_signature__ (single-signature builtins that keep no doc)."""
    sigs = parse_doc(getattr(obj, "__doc__", None), stats)
    if sigs:
        return sigs
    ts = getattr(obj, "__text_signature__", None)
    if ts:
        # __text_signature__ is "(self, a: T = d, ...)": reuse the same parser
        # by synthesizing a doc-style line
        fake = "f" + ts + " -> ?"
        sigs = parse_doc(fake, stats)
        if sigs and stats is not None:
            stats["text_signature_fallbacks"] = \
                stats.get("text_signature_fallbacks", 0) + 1
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
    stats = {"defaults": 0, "classes_requested": len(classes),
             "classes_not_importable": [], "methods": 0,
             "methods_without_sigs": 0, "sigs": 0}
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
            stats["classes_not_importable"].append(cls)
            continue
        entry = {"ctor": parse_sigs(getattr(found, "__init__", None), stats)
                 if hasattr(found, "__init__") else [],
                 "methods": {}}
        for name in dir(found):
            # OCCT methods never start with '_' (the shim's proxy refuses
            # them too); this also drops pybind internals like
            # _pybind11_conduit_v1_ from the no-sig count
            if name.startswith("_"):
                continue
            try:
                a = inspect.getattr_static(found, name)
            except AttributeError:
                continue
            is_static = isinstance(a, staticmethod)
            obj = getattr(found, name)
            if not callable(obj):
                continue
            stats["methods"] += 1
            sigs = parse_sigs(obj, stats)
            if not sigs:
                stats["methods_without_sigs"] += 1
                continue
            stats["sigs"] += len(sigs)
            entry["methods"][name] = {
                "static": bool(is_static),
                "sigs": sigs,
                "tuple_ret": any(s["ret"].startswith(("Tuple[", "tuple["))
                                 for s in sigs),
            }
        out[cls] = entry
    out["__meta__"] = stats
    (HERE / "ocp-defaults.json").write_text(json.dumps(out, indent=0))
    print("classes dumped:", len(out) - 1, "of", len(classes))
    print(json.dumps({k: v for k, v in stats.items()
                      if k != "classes_not_importable"}, indent=1))
    print("not importable:", stats["classes_not_importable"])


if __name__ == "__main__":
    main()
