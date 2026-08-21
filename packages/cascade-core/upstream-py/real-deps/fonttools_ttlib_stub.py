# HONEST fontTools.ttLib stub (pysrc=real on Pyodide): real fontTools is a
# 27 MB tree serving build123d/text.py's SYSTEM-FONT discovery — there are no
# system fonts in the browser worker (COMPROMISE(text): Compound.make_text is
# glue-routed to lite's opentype.js path). Any USE raises loudly.


class TTFont:
    def __init__(self, *a, **k):
        raise NotImplementedError(
            'fontTools.ttLib.TTFont is not available in the browser worker '
            '(no system fonts; text rendering is served by the opentype.js '
            'path)')


class _TTCollectionModule:
    """`from fontTools.ttLib import ttCollection` imports a SUBMODULE
    upstream; text.py then uses ttCollection.TTCollection."""

    class TTCollection:
        def __init__(self, *a, **k):
            raise NotImplementedError(
                'fontTools.ttLib.ttCollection is not available in the '
                'browser worker')


ttCollection = _TTCollectionModule
