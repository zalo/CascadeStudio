from OCP.Font import Font_SystemFont
from _typeshed import Incomplete
from build123d.build_enums import FontStyle as FontStyle
from dataclasses import dataclass

FONT_ASPECT: Incomplete

@dataclass(frozen=True)
class FontInfo:
    """Representation for registered font.

    Not immediately compatible with Font_SystemFont, which only contains a single
    style/aspect.
    """
    name: str
    styles: tuple[FontStyle, ...]

class FontManager:
    """Wrap OCP Font_FontMgr"""
    bundled_path: str
    bundled_fonts: Incomplete
    manager: Incomplete
    def __init__(self) -> None:
        """Initialize FontManager

        Bundled fonts are added to global OCP instance if they haven't already
        """
    def available_fonts(self) -> list[FontInfo]:
        """Get list of available fonts by name and available styles (also called aspects)"""
    def check_font(self, path: str) -> Font_SystemFont | None:
        """Check if font exists at path and return system font"""
    def find_font(self, name: str, style: FontStyle) -> Font_SystemFont:
        """Find font in FontManager library by name and style"""
    def register_font(self, path: str, override: bool = False, single_stroke: bool = False) -> list[str]:
        """Register all font faces in a font file and return font face names."""
    def register_folder(self, path: str, override: bool = False, single_stroke: bool = False) -> list[str]:
        """Register all fonts in a folder"""
    def register_system_fonts(self) -> None:
        """Runner to (re)inititalize the OCCT FontMgr font list since user folder is
        missing on Windows and some fonts may not be imported correctly."""

available_fonts: Incomplete
