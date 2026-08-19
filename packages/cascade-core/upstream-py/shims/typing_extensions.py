# `typing_extensions` shim: everything build123d imports from it.
from typing import *  # noqa: F401,F403 - re-export the typing shim


def deprecated(*a, **k):
    def deco(f):
        return f
    return deco
