# HONEST ocpsvg stub (pysrc=real on Pyodide): importers.py imports
# ColorAndLabel/import_svg_document at module level; SVG import has no
# filesystem in the browser worker. Any USE raises loudly.


class ColorAndLabel:
    def __init__(self, *a, **k):
        raise NotImplementedError(
            'ocpsvg.ColorAndLabel is not available in the browser worker')

    @classmethod
    def color_and_label_by(cls, *a, **k):
        raise NotImplementedError(
            'ocpsvg is not available in the browser worker')


def import_svg_document(*a, **k):
    raise NotImplementedError(
        'ocpsvg.import_svg_document is not available in the browser worker')
