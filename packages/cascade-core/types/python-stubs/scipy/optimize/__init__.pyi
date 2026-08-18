from typing import Any, Callable, Sequence

class OptimizeResult:
    x: Any
    fun: float
    nit: int
    nfev: int
    success: bool
    message: str
    def __getattr__(self, name: str) -> Any: ...

def minimize(fun: Callable[..., float], x0: Sequence[float] | float, args: tuple = (), method: str | None = None, bounds: Sequence[tuple[float, float]] | None = None, tol: float | None = None, options: dict | None = None) -> OptimizeResult:
    """build123d-lite shim: pure-Python Nelder-Mead — COMPROMISE(scipy-shim)."""

def minimize_scalar(fun: Callable[..., float], bounds: tuple[float, float] | None = None, args: tuple = (), method: str | None = None, tol: float | None = None, options: dict | None = None) -> OptimizeResult:
    """build123d-lite shim: bounded golden-section — COMPROMISE(scipy-shim)."""
