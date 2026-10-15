# bd_materials — HONEST stub for the MicroPython leg (build123d 0.13 imports
# `FinishedMaterial` and `resolve` at shape_core/composite/three_d module
# level for Shape.material / mass()).
#
# The real package (bernhard-42/bd_materials, pure Python, ~7.6k lines of
# frozen kw_only dataclasses over typing.get_args(Literal) + difflib) runs
# UNMODIFIED on the pysrc=real Pyodide leg. On MicroPython it is not
# bundled: shapes keep upstream's default (no material — `.material` is
# None, `mass()` raises upstream's own "Shape's density is missing"), and
# any attempt to RESOLVE a material raises loudly here instead of inventing
# densities.

_WHY = ('bd_materials is not bundled on the MicroPython runtime (build123d '
        '0.13 materials need ?pyruntime=pyodide&pysrc=real)')


class FinishedMaterial:
    """Placeholder type: nothing on this leg ever constructs one."""

    def __init__(self, *args, **kwargs):
        raise NotImplementedError('bd_materials.FinishedMaterial: ' + _WHY)


def resolve(name, *args, **kwargs):
    raise NotImplementedError('bd_materials.resolve(' + repr(name) + '): '
                              + _WHY)


def material_names():
    raise NotImplementedError('bd_materials.material_names: ' + _WHY)
