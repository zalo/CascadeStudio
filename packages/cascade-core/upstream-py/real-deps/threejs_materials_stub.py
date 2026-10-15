# threejs_materials — HONEST import-satisfying stub (pysrc=real, Pyodide).
#
# build123d 0.13 imports PbrProperties/inject_materials at exporters3d
# module level, and bd_materials' FinishedMaterial.pbr resolves the three.js
# PBR "look" through it. The real package needs Pillow + pygltflib and ships
# ~86 MB of texture maps (it reads them to average a textured material's
# color) — none of which belongs in a worker. The material PHYSICS
# (bd_materials: density -> Shape.mass(), the property ranges) is REAL on
# this leg; only the visual look is unavailable: every factory / PBR use
# raises loudly. COMPROMISE(material-look) in real_glue.py keeps
# `shape.material = ...` working (it skips upstream's derive-color-from-look
# step, which is the one place the setter touches the look).

_WHY = ('threejs_materials (three.js PBR looks: Pillow + pygltflib + ~86 MB '
        'of textures) is not bundled in this runtime — material physics '
        '(bd_materials density / mass()) works, the visual look does not')


class CsPbrUnavailable(NotImplementedError):
    """Raised for any three.js-look request (COMPROMISE(material-look))."""


class PbrProperties:
    def __init__(self, *args, **kwargs):
        raise CsPbrUnavailable('threejs_materials.PbrProperties: ' + _WHY)


def inject_materials(*args, **kwargs):
    raise CsPbrUnavailable('threejs_materials.inject_materials: ' + _WHY)


def collect_gltf_textures(*args, **kwargs):
    raise CsPbrUnavailable('threejs_materials.collect_gltf_textures: ' + _WHY)


class _Factory:
    """A bd_materials.pbr factory namespace (coats/glass/metal/...)."""

    def __init__(self, name):
        self._name = name

    def __getattr__(self, attr):
        if attr.startswith('__'):
            raise AttributeError(attr)

        def _raise(*args, **kwargs):
            raise CsPbrUnavailable('threejs_materials.' + self._name + '.'
                                   + attr + ': ' + _WHY)
        return _raise


coats = _Factory('coats')
glass = _Factory('glass')
metal = _Factory('metal')
paper = _Factory('paper')
plastic = _Factory('plastic')
textile = _Factory('textile')
wood = _Factory('wood')
