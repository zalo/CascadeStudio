"""Brython's bridge to the Web Worker global scope (build123d-lite runtime).

`from browser import self as w` exposes the CascadeStudio worker's standard
library (w.Box, w.Union, ...). Prefer the build123d API; this escape hatch is
untyped."""
from typing import Any

self: Any
window: Any
document: Any

def __getattr__(name: str) -> Any: ...
