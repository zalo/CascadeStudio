# after `import draftwright`: BRepTools.Write_s into a Python BytesIO stream
# has no shim path (no std::ostream bridge): a geometric sort key instead.
import draftwright.export as _dwx, builtins as _bi
def _brep_key(part):
    _bi._CS_SKIPPED.append('draftwright.export._brep_key (BRepTools.Write_s to BytesIO)')
    vs = sorted((round(v.X, 9), round(v.Y, 9), round(v.Z, 9)) for v in part.vertices())
    return repr((type(part).__name__, getattr(part, 'geom_type', None), vs, round(part.length if hasattr(part, 'length') else 0, 9))).encode()
_dwx._brep_key = _brep_key
