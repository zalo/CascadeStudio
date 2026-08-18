"""build123d-lite ships a real pytest.approx shim (documented tolerances).
The rest of pytest is NOT available in this environment."""
from typing import Any

def approx(expected: object, rel: float | None = None, abs: float | None = None, nan_ok: bool = False) -> Any:
    """Approximate-comparison helper (the only pytest API available here)."""
