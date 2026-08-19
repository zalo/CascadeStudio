# `trianglesolver` shim: delegates to build123d-lite's ported solver
# (identical signature/return contract: three of six in, all six out,
# angles in radians).
from build123d_lite import _tri_solve


def solve(a=None, b=None, c=None, A=None, B=None, C=None, ssa_flag='forbid'):
    return _tri_solve(a, b, c, A, B, C, ssa_flag)
