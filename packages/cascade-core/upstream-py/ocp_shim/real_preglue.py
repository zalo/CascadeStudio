# real_preglue (pyodide, pysrc=real) — OCP-layer stand-ins that must exist
# BEFORE `import build123d` runs (real_glue.py loads after and covers the
# rest).
#
# COMPROMISE(kernel-fonts): this wasm build has no Font_FontMgr binding (no
# kernel fonts — Compound.make_text is glue-routed to lite's opentype.js
# path). But REAL build123d/text.py runs a FontManager at MODULE level
# (`available_fonts = FontManager().available_fonts`), whose __init__ needs
# Font_FontMgr.GetInstance_s() + TColStd_SequenceOfHAsciiString. Serve both
# as pure-Python stand-ins at the OCP layer: the manager reports the
# 'singleline' canary alias as already registered, which makes text.py skip
# its bundled-font registration (fontTools) branch entirely; the font LIST is
# honestly empty and FindFont raises loudly.

import OCP.Font as _font_mod
import OCP.TColStd as _tcolstd_mod


class _CsHAsciiString:
    __slots__ = ('_s',)

    def __init__(self, s):
        self._s = s

    def ToCString(self):
        return self._s


class TColStd_SequenceOfHAsciiString:
    """Pure-Python sequence stand-in (the embind class is not bound)."""

    def __init__(self):
        self._items = []

    def Append(self, item):
        self._items.append(item)

    def Length(self):
        return len(self._items)

    def Value(self, index):
        return self._items[index - 1]


class _CsFontMgr:
    """Pure-Python Font_FontMgr stand-in: no kernel fonts in this wasm
    build. Reports the 'singleline' canary so text.py skips registration;
    the available-font list is honestly empty."""

    def GetAllAliases(self, sequence):
        sequence.Append(_CsHAsciiString('singleline'))

    def GetAvailableFonts(self):
        return []

    def CheckFont(self, path):
        return None

    def FindFont(self, *a, **k):
        raise NotImplementedError(
            'kernel fonts are not available in this wasm build '
            '(COMPROMISE(kernel-fonts)); Text rendering is served by the '
            'opentype.js path via Compound.make_text')

    def RegisterFont(self, *a, **k):
        return True

    def AddFontAlias(self, *a, **k):
        return True


_CS_FONT_MGR = _CsFontMgr()


class Font_FontMgr:
    @staticmethod
    def GetInstance_s():
        return _CS_FONT_MGR


_font_mod.Font_FontMgr = Font_FontMgr
_tcolstd_mod.TColStd_SequenceOfHAsciiString = TColStd_SequenceOfHAsciiString
