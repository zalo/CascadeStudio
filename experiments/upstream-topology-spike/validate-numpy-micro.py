#!/usr/bin/env python3
"""Validate numpy_micro against REAL numpy on the exact code path upstream
geometry.py uses it for: Axis._intersect_axis's 3x3 lstsq (plus cross and
linspace). Run with the reference venv python:

  ~/Desktop/ocjs-deps/b123d-ref-venv/bin/python3 validate-numpy-micro.py
"""
import importlib.util
import math
import random
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MICRO = (HERE / '..' / '..' / 'packages' / 'cascade-core' / 'upstream-py'
         / 'ocp_shim' / 'numpy_micro.py').resolve()
spec = importlib.util.spec_from_file_location('numpy_micro', MICRO)
nm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nm)


def intersect(np_mod, p1v, d1v, p2v, d2v):
    """VERBATIM the np statements of Axis._intersect_axis (geometry.py)."""
    np_ = np_mod
    p1 = np_.array([*p1v])
    d1 = np_.array([*d1v])
    p2 = np_.array([*p2v])
    d2 = np_.array([*d2v])
    system_of_equations = np_.array([d1, -d2, np_.cross(d1, d2)]).T
    origin_diff = p2 - p1
    t1, _, _ = np_.linalg.lstsq(system_of_equations, origin_diff, rcond=None)[0]
    intersection_point = p1 + t1 * d1
    return list(intersection_point)


def norm(v):
    l = math.sqrt(sum(x * x for x in v))
    return [x / l for x in v]


random.seed(42)
cases = []
# random intersecting axis pairs: pick a meeting point, two directions,
# and back the origins away along the directions
for _ in range(500):
    meet = [random.uniform(-50, 50) for _ in range(3)]
    d1 = norm([random.uniform(-1, 1) for _ in range(3)])
    while True:
        d2 = norm([random.uniform(-1, 1) for _ in range(3)])
        c = (d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2],
             d1[0] * d2[1] - d1[1] * d2[0])
        if math.sqrt(sum(x * x for x in c)) > 1e-3:  # not (anti)parallel
            break
    t1 = random.uniform(-30, 30)
    t2 = random.uniform(-30, 30)
    p1 = [meet[i] - t1 * d1[i] for i in range(3)]
    p2 = [meet[i] - t2 * d2[i] for i in range(3)]
    cases.append((p1, d1, p2, d2, meet))
# the doc-style canonical cases
cases.append(([0, 0, 0], [1, 0, 0], [5, -5, 0], [0, 1, 0], [5, 0, 0]))
cases.append(([1, 2, 3], [0, 0, 1], [1, 2, -7], norm([1, 0, 1]), None))

max_dx = 0.0
max_dpt = 0.0
for p1, d1, p2, d2, meet in cases:
    real = intersect(np, p1, d1, p2, d2)
    micro = intersect(nm, p1, d1, p2, d2)
    dpt = max(abs(a - b) for a, b in zip(real, micro))
    max_dpt = max(max_dpt, dpt)
    if meet is not None:
        max_dx = max(max_dx, max(abs(a - b) for a, b in zip(real, meet)))

# linspace parity (both call sites' forms)
ls_fail = 0
for num in (1, 2, 5, 50):
    for endpoint in (True, False):
        a = np.linspace(0.25, 1.25, num, endpoint=endpoint)
        b = nm.linspace(0.25, 1.25, num, endpoint=endpoint)
        if len(a) != len(b) or any(abs(x - y) > 1e-15 for x, y in zip(a, b)):
            ls_fail += 1

print('axis-intersection cases:', len(cases))
print('max |micro - numpy| over intersection points: %.3e' % max_dpt)
print('max |numpy - constructed meeting point|:      %.3e' % max_dx)
print('linspace mismatches:', ls_fail)
ok = max_dpt < 1e-9 and ls_fail == 0
print('RESULT:', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
