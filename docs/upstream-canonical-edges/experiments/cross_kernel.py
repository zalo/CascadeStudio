"""Cross-kernel check of the canonical form.

Both probes dumped, for every section edge, a 401 point polyline of the
underlying curve.  Here we
  1. stitch each case's edges into closed loops purely geometrically,
  2. measure the two sided discrete Hausdorff distance between the two
     kernels' loops (are the loci identical?),
  3. run build123d's *backend independent* canonical_form() on both loops via a
     polyline sampler and compare the canonical seam and direction.

Nothing in step 3 touches a kernel: it only needs "give me the point at arc
length d".
"""

import json
import math
import sys

from build123d.geometry import Vector
from build123d.topology.canonical import canonical_form

TOL = 1e-6


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def stitch(polys):
    """Chain polylines into loops by matching end points."""
    remaining = [list(p) for p in polys]
    loops = []
    while remaining:
        chain = remaining.pop(0)
        changed = True
        while changed:
            changed = False
            for i, candidate in enumerate(remaining):
                for cand in (candidate, candidate[::-1]):
                    if dist(chain[-1], cand[0]) < 1e-5:
                        chain += cand[1:]
                        remaining.pop(i)
                        changed = True
                        break
                    if dist(chain[0], cand[-1]) < 1e-5:
                        chain = cand[:-1] + chain
                        remaining.pop(i)
                        changed = True
                        break
                if changed:
                    break
        loops.append(chain)
    return loops


class PolylineSampler:
    def __init__(self, points):
        self.points = [Vector(*p) for p in points]
        self.cumulative = [0.0]
        for a, b in zip(self.points, self.points[1:]):
            self.cumulative.append(self.cumulative[-1] + (b - a).length)
        self.length = self.cumulative[-1]

    def __call__(self, distance):
        distance = min(max(distance, 0.0), self.length)
        low, high = 0, len(self.cumulative) - 1
        while high - low > 1:
            mid = (low + high) // 2
            if self.cumulative[mid] <= distance:
                low = mid
            else:
                high = mid
        span = self.cumulative[high] - self.cumulative[low]
        fraction = 0.0 if span == 0 else (distance - self.cumulative[low]) / span
        return self.points[low] + (self.points[high] - self.points[low]) * fraction


def point_to_segment(p, a, b):
    ab = [b[i] - a[i] for i in range(3)]
    ap = [p[i] - a[i] for i in range(3)]
    denom = sum(v * v for v in ab)
    t = 0.0 if denom == 0 else max(0.0, min(1.0, sum(ap[i] * ab[i] for i in range(3)) / denom))
    return dist(p, [a[i] + t * ab[i] for i in range(3)])


def hausdorff(a, b, step=5):
    """Two sided discrete Hausdorff distance, point to *segment* so that the
    result is not limited by the sampling density of the other polyline."""

    def one_way(p, q):
        return max(
            min(point_to_segment(point, q[i], q[i + 1]) for i in range(len(q) - 1))
            for point in p[::step]
        )

    return max(one_way(a, b), one_way(b, a))


def canonical_of(points):
    sampler = PolylineSampler(points)
    closed = dist(points[0], points[-1]) < 1e-6
    form = canonical_form(sampler, sampler.length, closed)
    seam = sampler(form.start * sampler.length)
    ahead = sampler((form.start + form.sign * 0.001) % 1.0 * sampler.length)
    heading = (ahead - seam).normalized() if (ahead - seam).length > 0 else Vector(0, 0, 0)
    return {
        "length": round(sampler.length, 6),
        "closed": closed,
        "seam": [round(v, 6) for v in tuple(seam)],
        "sign": form.sign,
        "heading": [round(v, 4) for v in tuple(heading)],
        "quarter": [
            round(v, 6)
            for v in tuple(
                sampler(((form.start + form.sign * 0.25) % 1.0) * sampler.length)
            )
        ],
    }


native = json.load(open("/tmp/kx/native.json"))["cases"]
wasm = json.load(open("/tmp/kx/wasm.json"))["cases"]

report = {}
for case in native:
    entry = {}
    for mode in ("section",):
        a, b = native[case][mode], wasm[case][mode]
        if isinstance(a, dict) or isinstance(b, dict) or not a or not b:
            continue
        loops_a = stitch([e["poly"] for e in a])
        loops_b = stitch([e["poly"] for e in b])
        loops_a.sort(key=len, reverse=True)
        loops_b.sort(key=len, reverse=True)
        if len(loops_a) != len(loops_b):
            entry[mode] = {"loop_count_differs": [len(loops_a), len(loops_b)]}
            continue
        per_loop = []
        for loop_a, loop_b in zip(loops_a, loops_b):
            canon_a, canon_b = canonical_of(loop_a), canonical_of(loop_b)
            per_loop.append(
                {
                    "hausdorff": f"{hausdorff(loop_a, loop_b):.2e}",
                    "native_raw_start": [round(v, 6) for v in loop_a[0]],
                    "wasm_raw_start": [round(v, 6) for v in loop_b[0]],
                    "native_canonical": canon_a,
                    "wasm_canonical": canon_b,
                    "canonical_seam_delta": f"{dist(canon_a['seam'], canon_b['seam']):.2e}",
                    "same_direction": canon_a["heading"] == canon_b["heading"],
                }
            )
        entry[mode] = per_loop
    report[case] = entry

print(json.dumps(report, indent=1))
