"""bd_materials as build123d-lite ships it (a shim over an embedded copy of
bd_materials 0.2.4's name table) — COMPROMISE(materials): grades carry name,
family, category and density only; finishes and processes are inert."""
from typing import Any, Callable
from . import core as core, finishes as finishes

class _Grade:
    name: str
    family: str
    category: str
    density: float

class FinishedMaterial:
    material: _Grade
    finish: Any
    color: Any
    process: Any
    pbr: Any
    @property
    def name(self) -> str: ...

class _Category:
    def __getattr__(self, name: str) -> Callable[..., FinishedMaterial]: ...

metals: _Category
plastics: _Category
resins: _Category
glass: _Category
wood: _Category
paper: _Category
textile: _Category

def resolve(name: str) -> FinishedMaterial:
    """A fresh FinishedMaterial for a family name (its default grade) or a
    grade name; case-insensitive, spaces/hyphens read as underscores."""
def material_names() -> list[str]: ...
def canonical_name(material: FinishedMaterial) -> str: ...
def factory(name: str) -> Callable[..., FinishedMaterial]: ...
