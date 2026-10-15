// Build123dLite.js - the "build123d-lite" Python library source (cascade-core)
//
// A subset of build123d (https://build123d.readthedocs.io) implemented on top
// of the CascadeStudio standard library that the CAD worker exposes on `self`
// (Box, Union, WireFromSegments, MeasureShape, ...). PythonRuntime.js
// registers this source as the importable Brython module `build123d`, so user
// scripts start with `from build123d import *`. Both ALGEBRA mode
// (Pos(...) * Box(...) - Cylinder(...)) and BUILDER mode
// (with BuildPart() as bp: ...) are supported; builders are plain context
// managers over a module-level stack (no inspect.currentframe tricks needed —
// we own this implementation).
//
// The source is embedded as a JS template string (rather than a .py asset
// copied to dist) so the worker bundle needs no extra fetch or dev/build
// dual-path handling beyond brython.js itself, and so the library is always
// version-locked to the worker code that consumes it.
// IMPORTANT: the Python source must contain no backticks and no "${".
//
// Honest-subset notes (differences from real build123d) — verified against
// build123d 0.11.1 via test/b123d-validation:
//  * Rotation(x,y,z) is intrinsic-XYZ (matrix Rx*Ry*Rz), matching build123d.
//  * align= offsets are computed from the object's own bounding box (mesh
//    approximated for non-analytic shapes), like build123d.
//  * Spline()/Edge.make_spline INTERPOLATE exactly (GeomAPI_Interpolate,
//    incl. tangents=/tangent_scalars=/per-point tangents/periodic).
//  * Unsupported (raise NotImplementedError rather than fake geometry):
//    the drafting module beyond ArrowHead, partial cones,
//    split(keep=Keep.BOTH), offset(min_edge_length=) (no
//    fix_degenerate_edges), Kind.TANGENT offsets, 3MF export, imports.
//  * Boolean results are cleaned with ShapeUpgrade_UnifySameDomain (the
//    standard library always does); face/edge COUNTS can therefore differ
//    from build123d even when the geometry (volume/bbox) matches.
//  * Every remaining deliberate deviation is marked in source with a
//    grep-able COMPROMISE(<topic>) comment; CLAUDE.md indexes them.

export const BUILD123D_LITE_PY = `
# build123d-lite: a subset of build123d (algebra + builder mode) for
# CascadeStudio. Runs under Brython inside the CAD worker; every CAD op
# delegates to the CascadeStudio standard library exposed as JS globals.
# Those JS functions own all sceneShapes bookkeeping.
from browser import self as w
import math
import json

MC = 0.001
MM = 1.0
CM = 10.0
M = 1000.0
IN = 25.4
FT = 304.8
THOU = 0.0254
# mass units (build123d build_common): grams, used by the Too Tall Toby
# challenge scripts to convert a volume into a mass check
G = 1.0
KG = 1000.0
LB = 453.59237   # G_PER_LB * G

_TOL = 1e-9
_TOL_1E6 = 1e-6      # build123d's TOLERANCE


# ---------------------------------------------------------------- enums ---

class Mode:
    ADD = 'ADD'
    SUBTRACT = 'SUBTRACT'
    INTERSECT = 'INTERSECT'
    REPLACE = 'REPLACE'
    PRIVATE = 'PRIVATE'


class Align:
    MIN = 'MIN'
    CENTER = 'CENTER'
    MAX = 'MAX'
    NONE = None


class Intrinsic:
    """Order to apply INTRINSIC rotations by axis (build123d Intrinsic; each
    rotation is about the already-rotated frame)."""
    XYZ = 'XYZ'
    XZY = 'XZY'
    YZX = 'YZX'
    YXZ = 'YXZ'
    ZXY = 'ZXY'
    ZYX = 'ZYX'
    XYX = 'XYX'
    XZX = 'XZX'
    YZY = 'YZY'
    YXY = 'YXY'
    ZXZ = 'ZXZ'
    ZYZ = 'ZYZ'


class Extrinsic:
    """Order to apply EXTRINSIC rotations by axis (build123d Extrinsic; every
    rotation is about the FIXED frame)."""
    XYZ = 'xXYZ'
    XZY = 'xXZY'
    YZX = 'xYZX'
    YXZ = 'xYXZ'
    ZXY = 'xZXY'
    ZYX = 'xZYX'
    XYX = 'xXYX'
    XZX = 'xXZX'
    YZY = 'xYZY'
    YXY = 'xYXY'
    ZXZ = 'xZXZ'
    ZYZ = 'xZYZ'


class Keep:
    TOP = 'TOP'
    BOTTOM = 'BOTTOM'
    BOTH = 'BOTH'
    ALL = 'ALL'
    INSIDE = 'INSIDE'
    OUTSIDE = 'OUTSIDE'


class Unit:
    """Standard units (build123d 0.12's Unit StrEnum: the members ARE their
    symbols, Unit.MM == 'mm'), lengths and - for mass() - masses."""
    MC = '\\u00b5m'  # MICRO
    MM = 'mm'
    CM = 'cm'
    M = 'm'
    IN = 'in'
    FT = 'ft'
    G = 'g'
    KG = 'kg'
    LB = 'lb'


# build_constants' unit conversions (UNITS_PER_METER[Unit.MM] = 1000)
UNITS_PER_METER = {
    Unit.IN: M / IN,
    Unit.FT: M / FT,
    Unit.MC: M / MC,
    Unit.MM: M / MM,
    Unit.CM: M / CM,
    Unit.M: 1,
}

G_PER_LB = 453.59237

UNITS_PER_KILOGRAM = {
    Unit.G: KG / G,
    Unit.KG: 1,
    Unit.LB: KG / LB,
}

# ------------------------------------------------------------ materials ---
# build123d 0.12 materials (Shape.material / mass()): upstream takes them from
# the bd_materials package. COMPROMISE(materials): lite embeds bd_materials
# 0.2.4's NAME -> grade/family/category/density/colour table (all 156
# registry keys, generated from the package) - everything Shape.material,
# mass() and the PBR colour side effect need; a grade's other property
# ranges, finishes, processes and PBR models are inert stand-ins.

_MATERIAL_ROWS = """
abs|ABS_GENERIC|ABS|plastic|1050|1.0,1.0,1.0,1.0
abs_flame_retardant|ABS_FLAME_RETARDANT|ABS|plastic|1200|1.0,1.0,1.0,1.0
abs_generic|ABS_GENERIC|ABS|plastic|1050|1.0,1.0,1.0,1.0
alloy_steel|AlloySteel_G4140_QUENCHED_TEMPERED|alloy_steel|metal|7850|0.7548,0.7439,0.7314,1.0
alloysteel.g52100_hardened_low_tempered|AlloySteel.G52100_HARDENED_LOW_TEMPERED|alloy_steel|metal|7810|0.7548,0.7439,0.7314,1.0
alloysteel_g1215_cold_drawn|AlloySteel_G1215_COLD_DRAWN|alloy_steel|metal|7850|0.7548,0.7439,0.7314,1.0
alloysteel_g4140_quenched_tempered|AlloySteel_G4140_QUENCHED_TEMPERED|alloy_steel|metal|7850|0.7548,0.7439,0.7314,1.0
alloysteel_g4340_quenched_tempered|AlloySteel_G4340_QUENCHED_TEMPERED|alloy_steel|metal|7850|0.7548,0.7439,0.7314,1.0
alu_alsi10mg_as_built|Alu_ALSI10MG_AS_BUILT|aluminum|metal|2670|0.9621,0.9654,0.9658,1.0
alu_g2024_aerospace|Alu_G2024_AEROSPACE|aluminum|metal|2780|0.9621,0.9654,0.9658,1.0
alu_g2a12_t4|Alu_G2A12_T4|aluminum|metal|2800|0.9621,0.9654,0.9658,1.0
alu_g5052_h32|Alu_G5052_H32|aluminum|metal|2680|0.9621,0.9654,0.9658,1.0
alu_g6061_t6|Alu_G6061_T6|aluminum|metal|2700|0.9621,0.9654,0.9658,1.0
alu_g7075_t6|Alu_G7075_T6|aluminum|metal|2810|0.9621,0.9654,0.9658,1.0
aluminum|Alu_G6061_T6|aluminum|metal|2700|0.9621,0.9654,0.9658,1.0
american_cherry|Hardwood_AMERICAN_CHERRY|cherry|wood|570|0.4431,0.302,0.1922,1.0
asa|Asa_GENERIC|ASA|plastic|1070|1.0,1.0,1.0,1.0
asa_generic|Asa_GENERIC|ASA|plastic|1070|1.0,1.0,1.0,1.0
ash|Hardwood_ASH|ash|wood|670|0.8471,0.7294,0.6471,1.0
beech|Hardwood_BEECH|beech|wood|720|0.7451,0.5255,0.302,1.0
birch|Hardwood_BIRCH|birch|wood|660|0.8941,0.8235,0.749,1.0
borosilicate|Borosilicate_GENERIC|borosilicate|glass|2230|0.9929,0.9978,0.9978,0.3
borosilicate_generic|Borosilicate_GENERIC|borosilicate|glass|2230|0.9929,0.9978,0.9978,0.3
brass|Brass_C360_HALF_HARD|brass|metal|8500|0.9593,0.8952,0.6822,1.0
brass_c360_half_hard|Brass_C360_HALF_HARD|brass|metal|8500|0.9593,0.8952,0.6822,1.0
brass_c360_soft_annealed|Brass_C360_SOFT_ANNEALED|brass|metal|8500|0.9593,0.8952,0.6822,1.0
bronze|Bronze_C51000_PHOSPHOR|bronze|metal|8800|0.8338,0.6966,0.5457,1.0
bronze_c51000_phosphor|Bronze_C51000_PHOSPHOR|bronze|metal|8800|0.8338,0.6966,0.5457,1.0
bronze_c90500_tin|Bronze_C90500_TIN|bronze|metal|8800|0.8338,0.6966,0.5457,1.0
bronze_c93200_bearing|Bronze_C93200_BEARING|bronze|metal|8900|0.8338,0.6966,0.5457,1.0
cardboard|Cardboard_CORRUGATED|corrugated_cardboard|paper|140|0.7294,0.5647,0.302,1.0
cardboard_corrugated|Cardboard_CORRUGATED|corrugated_cardboard|paper|140|0.7294,0.5647,0.302,1.0
castable|Castable_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
castable_generic|Castable_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
ceramic|Ceramic_GENERIC|resin|resin|1650|1.0,1.0,1.0,1.0
ceramic_generic|Ceramic_GENERIC|resin|resin|1650|1.0,1.0,1.0,1.0
cfrp|CFRP_PLATE|CFRP|plastic|1600|0.1843,0.1843,0.1843,1.0
cfrp_plate|CFRP_PLATE|CFRP|plastic|1600|0.1843,0.1843,0.1843,1.0
copper|Copper_C110_ANNEALED|copper|metal|8900|0.9695,0.8112,0.7497,1.0
copper_c110_annealed|Copper_C110_ANNEALED|copper|metal|8900|0.9695,0.8112,0.7497,1.0
engineered_wood|EngineeredWood_MDF|mdf|wood|750|0.5843,0.3961,0.2667,1.0
engineeredwood_mdf|EngineeredWood_MDF|mdf|wood|750|0.5843,0.3961,0.2667,1.0
engineeredwood_osb|EngineeredWood_OSB|osb|wood|640|0.8196,0.6549,0.451,1.0
esd|Esd_GENERIC|resin|resin|1300|1.0,1.0,1.0,1.0
esd_generic|Esd_GENERIC|resin|resin|1300|1.0,1.0,1.0,1.0
felt|Felt_GENERIC|felt|textile|120|0.6314,0.6235,0.6471,1.0
felt_generic|Felt_GENERIC|felt|textile|120|0.6314,0.6235,0.6471,1.0
flexible|Flexible_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
flexible_generic|Flexible_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
foamboard|Foamboard_GENERIC|foamboard|paper|120|0.9216,0.9216,0.9216,1.0
foamboard_generic|Foamboard_GENERIC|foamboard|paper|120|0.9216,0.9216,0.9216,1.0
fr4|FR4_GENERIC|FR4|plastic|1850|1.0,1.0,1.0,1.0
fr4_generic|FR4_GENERIC|FR4|plastic|1850|1.0,1.0,1.0,1.0
gold|Gold_PURE|gold|metal|19300|1.0,0.8927,0.59,1.0
gold_pure|Gold_PURE|gold|metal|19300|1.0,0.8927,0.59,1.0
hardwood|Hardwood_GENERIC|oak|wood|675|0.4745,0.3294,0.2039,1.0
hardwood_american_cherry|Hardwood_AMERICAN_CHERRY|cherry|wood|570|0.4431,0.302,0.1922,1.0
hardwood_ash|Hardwood_ASH|ash|wood|670|0.8471,0.7294,0.6471,1.0
hardwood_beech|Hardwood_BEECH|beech|wood|720|0.7451,0.5255,0.302,1.0
hardwood_birch|Hardwood_BIRCH|birch|wood|660|0.8941,0.8235,0.749,1.0
hardwood_generic|Hardwood_GENERIC|oak|wood|675|0.4745,0.3294,0.2039,1.0
hardwood_maple|Hardwood_MAPLE|maple|wood|705|0.9333,0.8275,0.702,1.0
hardwood_oak|Hardwood_OAK|oak|wood|755|0.4745,0.3294,0.2039,1.0
hardwood_walnut|Hardwood_WALNUT|walnut|wood|640|0.349,0.2392,0.1647,1.0
high_temp|HighTemp_GENERIC|resin|resin|1300|1.0,1.0,1.0,1.0
hightemp_generic|HighTemp_GENERIC|resin|resin|1300|1.0,1.0,1.0,1.0
leather|Leather_GENERIC|leather|textile|950|0.4011,0.267,0.153,1.0
leather_generic|Leather_GENERIC|leather|textile|950|0.4011,0.267,0.153,1.0
magnesium|Magnesium_GENERIC_STRUCTURAL|magnesium|metal|1810|0.8373,0.8204,0.7966,1.0
magnesium_generic_structural|Magnesium_GENERIC_STRUCTURAL|magnesium|metal|1810|0.8373,0.8204,0.7966,1.0
maple|Hardwood_MAPLE|maple|wood|705|0.9333,0.8275,0.702,1.0
mdf|EngineeredWood_MDF|mdf|wood|750|0.5843,0.3961,0.2667,1.0
mild_steel|MildSteel_PLAIN_CARBON_GENERIC|mild_steel|metal|7800|0.7548,0.7439,0.7314,1.0
mildsteel_g1018_cold_drawn|MildSteel_G1018_COLD_DRAWN|mild_steel|metal|7850|0.7548,0.7439,0.7314,1.0
mildsteel_g1045_cold_drawn|MildSteel_G1045_COLD_DRAWN|mild_steel|metal|7850|0.7548,0.7439,0.7314,1.0
mildsteel_ga36_hot_rolled|MildSteel_GA36_HOT_ROLLED|mild_steel|metal|7850|0.7548,0.7439,0.7314,1.0
mildsteel_plain_carbon_generic|MildSteel_PLAIN_CARBON_GENERIC|mild_steel|metal|7800|0.7548,0.7439,0.7314,1.0
nylon|Nylon_PA12|PA|plastic|1010|1.0,1.0,1.0,1.0
nylon_pa12|Nylon_PA12|PA|plastic|1010|1.0,1.0,1.0,1.0
nylon_pa12_gf35|Nylon_PA12_GF35|PA|plastic|1300|1.0,1.0,1.0,1.0
nylon_pa12_sintered|Nylon_PA12_SINTERED|PA|plastic|1000|1.0,1.0,1.0,1.0
nylon_pa6|Nylon_PA6|PA|plastic|1140|1.0,1.0,1.0,1.0
oak|Hardwood_OAK|oak|wood|755|0.4745,0.3294,0.2039,1.0
osb|EngineeredWood_OSB|osb|wood|640|0.8196,0.6549,0.451,1.0
paper|Paper_OFFICE|paper|paper|800|0.9608,0.9569,0.949,1.0
paper_office|Paper_OFFICE|paper|paper|800|0.9608,0.9569,0.949,1.0
pc|PC_GENERIC|PC|plastic|1200|1.0,1.0,1.0,0.3
pc_generic|PC_GENERIC|PC|plastic|1200|1.0,1.0,1.0,0.3
pe|PE_HDPE|PE|plastic|960|1.0,1.0,1.0,1.0
pe_hdpe|PE_HDPE|PE|plastic|960|1.0,1.0,1.0,1.0
peek|Peek_MOLDED|PEEK|plastic|1300|1.0,1.0,1.0,1.0
peek_molded|Peek_MOLDED|PEEK|plastic|1300|1.0,1.0,1.0,1.0
peek_printed|Peek_PRINTED|PEEK|plastic|1300|1.0,1.0,1.0,1.0
petg|PETG_GENERIC|PETG|plastic|1270|1.0,1.0,1.0,1.0
petg_cf|PETG_CF|PETG|plastic|1320|1.0,1.0,1.0,1.0
petg_generic|PETG_GENERIC|PETG|plastic|1270|1.0,1.0,1.0,1.0
phenolic|Phenolic_BAKELITE|phenolic|plastic|1300|1.0,1.0,1.0,1.0
phenolic_bakelite|Phenolic_BAKELITE|phenolic|plastic|1300|1.0,1.0,1.0,1.0
pine|Softwood_PINE|pine|wood|500|0.8235,0.7255,0.6314,1.0
pla|PLA_GENERIC|PLA|plastic|1240|1.0,1.0,1.0,1.0
pla_carbon_filled|PLA_CARBON_FILLED|PLA|plastic|1250|1.0,1.0,1.0,1.0
pla_generic|PLA_GENERIC|PLA|plastic|1240|1.0,1.0,1.0,1.0
pmma|PMMA_GENERIC|PMMA|plastic|1180|1.0,1.0,1.0,0.3
pmma_generic|PMMA_GENERIC|PMMA|plastic|1180|1.0,1.0,1.0,0.3
pom|POM_GENERIC|POM|plastic|1410|1.0,1.0,1.0,1.0
pom_generic|POM_GENERIC|POM|plastic|1410|1.0,1.0,1.0,1.0
pp|PP_GENERIC|PP|plastic|905|1.0,1.0,1.0,1.0
pp_generic|PP_GENERIC|PP|plastic|905|1.0,1.0,1.0,1.0
pps|PPS_CF|PPS|plastic|1400|1.0,1.0,1.0,1.0
pps_cf|PPS_CF|PPS|plastic|1400|1.0,1.0,1.0,1.0
ptfe|PTFE_GENERIC|PTFE|plastic|2170|1.0,1.0,1.0,1.0
ptfe_generic|PTFE_GENERIC|PTFE|plastic|2170|1.0,1.0,1.0,1.0
rubber|Rubber_GENERIC|rubber|plastic|1200|1.0,1.0,1.0,1.0
rubber_generic|Rubber_GENERIC|rubber|plastic|1200|1.0,1.0,1.0,1.0
silver|Silver_PURE|silver|metal|10490|0.996,0.9934,0.9885,1.0
silver_pure|Silver_PURE|silver|metal|10490|0.996,0.9934,0.9885,1.0
soda_lime|SodaLime_GENERIC|soda_lime|glass|2500|0.9929,0.9978,0.9978,0.3
sodalime_generic|SodaLime_GENERIC|soda_lime|glass|2500|0.9929,0.9978,0.9978,0.3
softwood|Softwood_GENERIC|spruce|wood|470|0.9294,0.898,0.7765,1.0
softwood_generic|Softwood_GENERIC|spruce|wood|470|0.9294,0.898,0.7765,1.0
softwood_pine|Softwood_PINE|pine|wood|500|0.8235,0.7255,0.6314,1.0
softwood_spruce|Softwood_SPRUCE|spruce|wood|430|0.9294,0.898,0.7765,1.0
spring_steel|SpringSteel_GENERIC_QUENCHED_TEMPERED|spring_steel|metal|7850|0.7548,0.7439,0.7314,1.0
springsteel_generic_quenched_tempered|SpringSteel_GENERIC_QUENCHED_TEMPERED|spring_steel|metal|7850|0.7548,0.7439,0.7314,1.0
spruce|Softwood_SPRUCE|spruce|wood|430|0.9294,0.898,0.7765,1.0
stainless|Stainless_G304_ANNEALED|stainless|metal|7930|0.8373,0.8204,0.7966,1.0
stainless_g201_annealed|Stainless_G201_ANNEALED|stainless|metal|7860|0.8373,0.8204,0.7966,1.0
stainless_g303_annealed|Stainless_G303_ANNEALED|stainless|metal|8030|0.8373,0.8204,0.7966,1.0
stainless_g304_annealed|Stainless_G304_ANNEALED|stainless|metal|7930|0.8373,0.8204,0.7966,1.0
stainless_g316l_annealed|Stainless_G316L_ANNEALED|stainless|metal|8000|0.8373,0.8204,0.7966,1.0
stainless_g316l_as_built|Stainless_G316L_AS_BUILT|stainless|metal|7990|0.8373,0.8204,0.7966,1.0
stainless_g430_annealed|Stainless_G430_ANNEALED|stainless|metal|7750|0.8373,0.8204,0.7966,1.0
stainless_g430_cold_worked|Stainless_G430_COLD_WORKED|stainless|metal|7750|0.8373,0.8204,0.7966,1.0
standard|Standard_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
standard_generic|Standard_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
titanium|Titanium_GR5_ANNEALED|titanium|metal|4430|0.6951,0.6652,0.635,1.0
titanium_gr5_annealed|Titanium_GR5_ANNEALED|titanium|metal|4430|0.6951,0.6652,0.635,1.0
titanium_tc4_as_built|Titanium_TC4_AS_BUILT|titanium|metal|4430|0.6951,0.6652,0.635,1.0
tool_steel|ToolSteel_D2_HARDENED|tool_steel|metal|7700|0.7548,0.7439,0.7314,1.0
toolsteel_a2_hardened|ToolSteel_A2_HARDENED|tool_steel|metal|7860|0.7548,0.7439,0.7314,1.0
toolsteel_a3_hardened|ToolSteel_A3_HARDENED|tool_steel|metal|7860|0.7548,0.7439,0.7314,1.0
toolsteel_d2_hardened|ToolSteel_D2_HARDENED|tool_steel|metal|7700|0.7548,0.7439,0.7314,1.0
toolsteel_generic_as_built|ToolSteel_GENERIC_AS_BUILT|tool_steel|metal|7800|0.7548,0.7439,0.7314,1.0
toolsteel_h13_hardened|ToolSteel_H13_HARDENED|tool_steel|metal|7800|0.7548,0.7439,0.7314,1.0
toolsteel_o1_hardened|ToolSteel_O1_HARDENED|tool_steel|metal|7830|0.7548,0.7439,0.7314,1.0
toolsteel_s7_hardened|ToolSteel_S7_HARDENED|tool_steel|metal|7830|0.7548,0.7439,0.7314,1.0
tough|Tough_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
tough_generic|Tough_GENERIC|resin|resin|1150|1.0,1.0,1.0,1.0
tpu|TPU_SHORE_95A|TPU|plastic|1200|1.0,1.0,1.0,1.0
tpu_shore_95a|TPU_SHORE_95A|TPU|plastic|1200|1.0,1.0,1.0,1.0
tpu_sintered|TPU_SINTERED|TPU|plastic|1200|1.0,1.0,1.0,1.0
transparent|Transparent_GENERIC|resin|resin|1300|1.0,1.0,1.0,0.3
transparent_generic|Transparent_GENERIC|resin|resin|1300|1.0,1.0,1.0,0.3
walnut|Hardwood_WALNUT|walnut|wood|640|0.349,0.2392,0.1647,1.0
woven|Woven_GENERIC|fabric_weave|textile|500|0.9529,0.9647,0.9804,1.0
woven_generic|Woven_GENERIC|fabric_weave|textile|500|0.9529,0.9647,0.9804,1.0
"""

_MATERIAL_FAMILY_MODULES = """
abs_:plastics alloy_steel:metals aluminum:metals american_cherry:wood
asa:plastics ash:wood beech:wood birch:wood borosilicate:glass
brass:metals bronze:metals cardboard:paper castable:resins ceramic:resins
cfrp:plastics copper:metals engineered_wood:wood esd:resins felt:textile
flexible:resins foamboard:paper fr4:plastics gold:metals hardwood:wood
high_temp:resins leather:textile magnesium:metals maple:wood mdf:wood
mild_steel:metals nylon:plastics oak:wood osb:wood paper:paper pc:plastics
pe:plastics peek:plastics petg:plastics phenolic:plastics pine:wood
pla:plastics pmma:plastics pom:plastics pp:plastics pps:plastics
ptfe:plastics rubber:plastics silver:metals soda_lime:glass softwood:wood
spring_steel:metals spruce:wood stainless:metals standard:resins
titanium:metals tool_steel:metals tough:resins tpu:plastics
transparent:resins walnut:wood woven:textile
"""

_PROPERTY_UNITS = {
    'areal_density': 'g/m\\u00b2',
    'compressive_strength_parallel': 'MPa',
    'density': 'kg/m\\u00b3',
    'elongation_at_break': '%',
    'hardness': 'per hardness_scale',
    'janka_hardness': 'N',
    'modulus_of_elasticity': 'GPa',
    'modulus_of_rupture': 'MPa',
    'poisson_ratio': '',
    'shear_modulus': 'GPa',
    'shear_strength': 'MPa',
    'tensile_strength': 'MPa',
    'thickness': 'mm',
    'yield_strength': 'MPa',
    'glass_transition_temperature': '\\u00b0C',
    'heat_deflection_temperature': '\\u00b0C',
    'max_service_temp': '\\u00b0C',
    'melting_temperature': '\\u00b0C',
    'specific_heat_capacity': 'J/(kg\\u00b7K)',
    'thermal_conductivity': 'W/(m\\u00b7K)',
    'thermal_expansion': '1/K',
}

_MATERIAL_TABLE = {}


def _material_table():
    if not _MATERIAL_TABLE:
        for line in _MATERIAL_ROWS.split(chr(10)):
            if not line.strip():
                continue
            key, grade, family, category, density, color = line.split('|')
            rgba = tuple(float(x) for x in color.split(',')) if color else None
            _MATERIAL_TABLE[key] = (grade, family, category, float(density),
                                    rgba)
    return _MATERIAL_TABLE


def _normalize_material_name(name):
    return name.strip().lower().replace(' ', '_').replace('-', '_')


class _MaterialGrade:
    """A bd_materials material record (the grade): name, family, category
    and density in kg/m^3 (the only scalar property)."""

    def __init__(self, name, family, category, density, transparent=False):
        self.name = name
        self.family = family
        self.category = category
        self.density = density
        self.transparent = transparent

    def __repr__(self):
        return (self.category.capitalize() + 'Material(name=' +
                repr(self.name) + ', family=' + repr(self.family) +
                ', density=' + repr(self.density) + ')')


class _FinishedMaterial:
    """bd_materials' FinishedMaterial: a material grade plus its finish and
    per-part appearance (lite keeps the fields; only the grade's density and
    colour have consequences)."""

    def __init__(self, material, finish=None, color=None, thickness_mm=None,
                 opacity=None, roughness=None, scale=(1.0, 1.0),
                 rotation=0.0, process=None, pbr=None):
        self.material = material
        self.finish = finish
        self.color = color
        self.thickness_mm = thickness_mm
        self.opacity = opacity
        self.roughness = roughness
        self.scale = scale
        self.rotation = rotation
        self.process = process
        self.pbr = pbr

    @property
    def name(self):
        return self.material.name

    def __repr__(self):
        return 'FinishedMaterial(' + self.material.name + ')'


def _material_from_row(row, density=None, finish=None, process=None,
                       color=None):
    grade, family, category, dens, rgba = row
    fm = _FinishedMaterial(
        _MaterialGrade(grade, family, category,
                       dens if density is None else float(density)),
        finish=finish, process=process, color=color)
    fm._lite_rgba = rgba
    return fm


def _material_suggestions(key, names):
    scored = []
    for n in names:
        common = 0
        for a, b in zip(key, n):
            if a != b:
                break
            common += 1
        if common or key in n or n in key:
            scored.append((-common, len(n), n))
    scored = _stable_sorted(scored)
    return [t[2] for t in scored[:3]]


def _resolve_material(name):
    """bd_materials.resolve: a fresh FinishedMaterial for a family name
    (its default grade) or a grade name, matched case-insensitively with
    spaces/hyphens read as underscores."""
    table = _material_table()
    key = _normalize_material_name(str(name))
    if key not in table:
        names = sorted(table.keys())
        hint = _material_suggestions(key, names)
        raise ValueError('unknown material ' + repr(str(name)) +
                         (' -- did you mean ' + ', '.join(hint) + '?'
                          if hint else '') +
                         ' (bd_materials.material_names() lists all ' +
                         str(len(names)) + ')')
    return _material_from_row(table[key])


def _material_names():
    return sorted(_material_table().keys())


def _canonical_material_name(material):
    return _normalize_material_name(material.material.name)


# OCCT write.step.unit names for the length units (export_step)
_STEP_UNIT_NAMES = {Unit.MC: 'UM', Unit.MM: 'MM', Unit.CM: 'CM', Unit.M: 'M',
                    Unit.IN: 'INCH', Unit.FT: 'FT'}


class ApproxOption:
    """DXF export spline approximation strategy (build123d ApproxOption)."""
    ARC = 'ARC'
    NONE = 'NONE'
    SPLINE = 'SPLINE'


class FrameMethod:
    """Moving frame calculation method (build123d FrameMethod)."""
    FRENET = 'FRENET'
    CORRECTED = 'CORRECTED'


class MeshType:
    """3MF mesh types, typically for 3D printing (build123d MeshType)."""
    OTHER = 'OTHER'
    MODEL = 'MODEL'
    SUPPORT = 'SUPPORT'
    SOLIDSUPPORT = 'SOLIDSUPPORT'


class NumberDisplay:
    """Methods for displaying numbers (build123d NumberDisplay)."""
    DECIMAL = 'DECIMAL'
    FRACTION = 'FRACTION'


class PageSize:
    """Drawing page sizes (build123d PageSize)."""
    A0 = 'A0'
    A1 = 'A1'
    A2 = 'A2'
    A3 = 'A3'
    A4 = 'A4'
    A5 = 'A5'
    A6 = 'A6'
    A7 = 'A7'
    A8 = 'A8'
    A9 = 'A9'
    A10 = 'A10'
    LETTER = 'LETTER'
    LEGAL = 'LEGAL'
    LEDGER = 'LEDGER'


class PositionMode:
    """Position along curve mode (build123d PositionMode)."""
    LENGTH = 'LENGTH'
    PARAMETER = 'PARAMETER'


class PrecisionMode:
    """STEP export geometric-data precision. The member VALUES are
    upstream's exact ints (they map to STEP write.precision.mode)."""
    SESSION = 2
    GREATEST = 1
    AVERAGE = 0


class Until:
    NEXT = 'NEXT'
    LAST = 'LAST'
    PREVIOUS = 'PREVIOUS'
    FIRST = 'FIRST'


class Kind:
    ARC = 'ARC'
    INTERSECTION = 'INTERSECTION'
    TANGENT = 'TANGENT'


class Select:
    ALL = 'ALL'
    LAST = 'LAST'
    NEW = 'NEW'


class CenterOf:
    GEOMETRY = 'GEOMETRY'
    MASS = 'MASS'
    BOUNDING_BOX = 'BOUNDING_BOX'


class Transition:
    TRANSFORMED = 'TRANSFORMED'
    ROUND = 'ROUND'
    RIGHT = 'RIGHT'


class LengthMode:
    """How PolarLine's length argument is measured (build123d LengthMode)."""
    DIAGONAL = 'DIAGONAL'
    HORIZONTAL = 'HORIZONTAL'
    VERTICAL = 'VERTICAL'


class Side:
    LEFT = 'LEFT'
    RIGHT = 'RIGHT'
    BOTH = 'BOTH'


class AngularDirection:
    CLOCKWISE = 'CLOCKWISE'
    COUNTER_CLOCKWISE = 'COUNTER_CLOCKWISE'


class ContinuityLevel:
    """How smoothly a blend joins its neighbours (build123d
    ContinuityLevel): position only, tangent, or curvature."""
    C0 = 0
    C1 = 1
    C2 = 2


class Sagitta:
    """Which of the two arcs between the tangency points a constrained-arc
    solution contributes (build123d Sagitta — the values ARE the indices into
    the length-sorted pair)."""
    SHORT = 0
    LONG = -1
    BOTH = 1


class Tangency:
    """Where the solution lies relative to a tangency argument (build123d
    Tangency, GccEnt's qualifiers)."""
    UNQUALIFIED = 'UNQUALIFIED'
    ENCLOSING = 'ENCLOSING'
    ENCLOSED = 'ENCLOSED'
    OUTSIDE = 'OUTSIDE'


class SortBy:
    LENGTH = 'LENGTH'
    AREA = 'AREA'
    VOLUME = 'VOLUME'
    RADIUS = 'RADIUS'
    DISTANCE = 'DISTANCE'


class GeomType:
    # values are the strings the worker's introspection helpers return
    LINE = ('Line',)
    CIRCLE = ('Circle',)
    ELLIPSE = ('Ellipse',)
    HYPERBOLA = ('Hyperbola',)
    PARABOLA = ('Parabola',)
    BEZIER = ('BezierCurve', 'BezierSurface')
    BSPLINE = ('BSplineCurve', 'BSplineSurface')
    PLANE = ('Plane',)
    CYLINDER = ('Cylinder',)
    CONE = ('Cone',)
    SPHERE = ('Sphere',)
    TORUS = ('Torus',)
    OTHER = ('Other',)


class _EnumMember:
    """A minimal Enum member for the build123d 0.12 enums lite must tell
    apart from plain strings in selectors (filter_by/group_by): identity
    equality, a name and a value, ordered by value like GroupBy orders
    Enum keys."""

    def __init__(self, owner, name, value):
        self._owner = owner
        self.name = name
        self.value = value

    def __repr__(self):
        return '<' + self._owner + '.' + self.name + ': ' + \
            repr(self.value) + '>'

    def __str__(self):
        return self._owner + '.' + self.name

    def __lt__(self, other):
        return self.value < other.value

    def __gt__(self, other):
        return self.value > other.value

    def __hash__(self):
        return hash((self._owner, self.value))


class Convexity:
    """How the material of a shape sits around one of its elements
    (build123d 0.12): a property of a Vertex/Edge/Face RELATIVE to the shape
    it was selected from - CONVEX (closes around it by less than half a
    turn), CONCAVE (more than half a turn), SMOOTH (no bend) or SADDLE (both
    senses present)."""
    CONVEX = _EnumMember('Convexity', 'CONVEX', 1)
    CONCAVE = _EnumMember('Convexity', 'CONCAVE', 2)
    SMOOTH = _EnumMember('Convexity', 'SMOOTH', 3)
    SADDLE = _EnumMember('Convexity', 'SADDLE', 4)

    @staticmethod
    def _of(name):
        return getattr(Convexity, str(name))


try:
    FileNotFoundError
except NameError:
    # MicroPython ships only OSError; alias so lite's own raises (import_step)
    # and user 'except FileNotFoundError:' clauses work everywhere
    FileNotFoundError = OSError


class LineType:
    CONTINUOUS = 'CONTINUOUS'
    CENTER = 'CENTER'
    DASHED = 'DASHED'
    DOT = 'DOT'
    HIDDEN = 'HIDDEN'
    PHANTOM = 'PHANTOM'
    BORDER = 'BORDER'
    DASHDOT = 'DASHDOT'
    DIVIDE = 'DIVIDE'
    ISO_DASH = 'ISO_DASH'
    ISO_DASH_SPACE = 'ISO_DASH_SPACE'
    ISO_LONG_DASH_DOT = 'ISO_LONG_DASH_DOT'
    ISO_LONG_DASH_DOUBLE_DOT = 'ISO_LONG_DASH_DOUBLE_DOT'
    ISO_LONG_DASH_TRIPLE_DOT = 'ISO_LONG_DASH_TRIPLE_DOT'
    ISO_DOT = 'ISO_DOT'
    ISO_LONG_DASH_SHORT_DASH = 'ISO_LONG_DASH_SHORT_DASH'
    ISO_LONG_DASH_DOUBLE_SHORT_DASH = 'ISO_LONG_DASH_DOUBLE_SHORT_DASH'
    ISO_DASH_DOT = 'ISO_DASH_DOT'
    ISO_DOUBLE_DASH_DOT = 'ISO_DOUBLE_DASH_DOT'
    ISO_DASH_DOUBLE_DOT = 'ISO_DASH_DOUBLE_DOT'
    ISO_DOUBLE_DASH_DOUBLE_DOT = 'ISO_DOUBLE_DASH_DOUBLE_DOT'
    ISO_DASH_TRIPLE_DOT = 'ISO_DASH_TRIPLE_DOT'
    ISO_DOUBLE_DASH_TRIPLE_DOT = 'ISO_DOUBLE_DASH_TRIPLE_DOT'


class FontStyle:
    REGULAR = 'REGULAR'
    BOLD = 'BOLD'
    ITALIC = 'ITALIC'
    BOLDITALIC = 'BOLDITALIC'


# Type aliases build123d exports for annotations (used in signatures of
# user subclasses like the PlatonicSolid example); the actual accepted
# values are whatever the receiving function converts.
VectorLike = tuple
RotationLike = tuple


# -------------------------------------------------------- vector algebra ---

def _num(x):
    return float(x)


# STOCK MicroPython's list sort is NOT stable; build123d's selector semantics
# (chained sort_by, group_by tie order) require CPython stability, so probe
# once and decorate with the original index when the native sort scrambles.
# On the custom micropython-cs interpreter build the native sort IS a stable
# merge sort, the probe passes, and the fast native path below is taken
_SORT_PROBE = sorted([(i % 2, i) for i in range(32)], key=lambda t: t[0])
_SORT_IS_STABLE = [t[1] for t in _SORT_PROBE] == \
    [i for i in range(32) if i % 2 == 0] + [i for i in range(32) if i % 2 == 1]


def _stable_sorted(seq, key=None, reverse=False):
    """_stable_sorted() with guaranteed CPython stability on every runtime."""
    if _SORT_IS_STABLE:
        if key is None:
            return sorted(seq, reverse=reverse)
        return sorted(seq, key=key, reverse=reverse)
    items = list(seq)
    kf = key if key is not None else (lambda x: x)
    dec = [(kf(v), (-i if reverse else i), v) for i, v in enumerate(items)]
    dec.sort(reverse=reverse)
    return [t[2] for t in dec]


_WARNED = set()


def _warn(message, category='UserWarning'):
    """warnings.warn stand-in (lite ships no warnings module): printed once
    per message, the way Python's default filter shows a warning once per
    call site."""
    if message in _WARNED:
        return
    _WARNED.add(message)
    print(category + ': ' + message)


def _js_error_text(exc):
    """The message of an error raised across the JS boundary."""
    text = str(exc)
    for prefix in ('Error: ', 'JavascriptError: '):
        if text.startswith(prefix):
            text = text[len(prefix):]
    return text


def _is_nested_seq(x):
    """True when x is a non-empty sequence whose first element is itself a
    sequence — the points-list-vs-*points overload check. Portable: hasattr
    (x, '__len' + '__') is always False on MicroPython builtins, so probe
    with len() instead."""
    try:
        return len(x) > 0 and len(x[0]) >= 0
    except TypeError:
        return False


# Flipped by the upstream-source seam AFTER build_common monkeypatches
# Vector.add/.sub with its workplane-relative-tuple localizer; keeps lite's
# own modes on the direct (untraced-call-free) arithmetic path.
_VECTOR_OPS_HOOKED = False


class Vector:
    """3D vector with build123d-style .X/.Y/.Z properties."""

    def __init__(self, *args):
        if len(args) == 0:
            self._v = (0.0, 0.0, 0.0)
        elif len(args) == 1:
            a = args[0]
            if isinstance(a, Vector):
                self._v = a._v
            else:
                t = tuple(a)
                if len(t) == 0:
                    # Vector(()) is the origin upstream too (0 * (x, y, z) is
                    # how the docs write a conditional offset)
                    self._v = (0.0, 0.0, 0.0)
                elif len(t) == 1:
                    self._v = (_num(t[0]), 0.0, 0.0)
                elif len(t) == 2:
                    self._v = (_num(t[0]), _num(t[1]), 0.0)
                else:
                    self._v = (_num(t[0]), _num(t[1]), _num(t[2]))
        elif len(args) == 2:
            self._v = (_num(args[0]), _num(args[1]), 0.0)
        else:
            self._v = (_num(args[0]), _num(args[1]), _num(args[2]))

    @property
    def X(self):
        return self._v[0]

    @property
    def Y(self):
        return self._v[1]

    @property
    def Z(self):
        return self._v[2]

    def __iter__(self):
        return iter(self._v)

    def __getitem__(self, i):
        return self._v[i]

    def __len__(self):
        return 3

    def add(self, o):
        """Named form of + (upstream Vector.add). build_common MONKEY-PATCHES
        this (and .sub) at import with a workplane-relative-tuple localizer;
        __add__/__sub__ route through the method ONLY when the upstream seam
        has flipped _VECTOR_OPS_HOOKED (an extra traced Python call per
        vector op costs real time on settrace MicroPython, so lite's own
        modes keep the direct arithmetic)."""
        o = Vector(o)
        return Vector(self._v[0] + o._v[0], self._v[1] + o._v[1], self._v[2] + o._v[2])

    def sub(self, o):
        o = Vector(o)
        return Vector(self._v[0] - o._v[0], self._v[1] - o._v[1], self._v[2] - o._v[2])

    def __add__(self, o):
        if _VECTOR_OPS_HOOKED:
            return self.add(o)
        o = Vector(o)
        return Vector(self._v[0] + o._v[0], self._v[1] + o._v[1], self._v[2] + o._v[2])

    def __radd__(self, o):
        # tuple + vector cannot be workplane-relative (upstream's wrapper only
        # fires on the tuple ARGUMENT of .add); plain addition
        o = Vector(o)
        return Vector(self._v[0] + o._v[0], self._v[1] + o._v[1], self._v[2] + o._v[2])

    def __sub__(self, o):
        if _VECTOR_OPS_HOOKED:
            return self.sub(o)
        o = Vector(o)
        return Vector(self._v[0] - o._v[0], self._v[1] - o._v[1], self._v[2] - o._v[2])

    def __rsub__(self, o):
        return Vector(o).__sub__(self)

    def __neg__(self):
        return Vector(-self._v[0], -self._v[1], -self._v[2])

    def __mul__(self, s):
        s = _num(s)
        return Vector(self._v[0] * s, self._v[1] * s, self._v[2] * s)

    __rmul__ = __mul__

    def __truediv__(self, s):
        s = _num(s)
        return Vector(self._v[0] / s, self._v[1] / s, self._v[2] / s)

    def __eq__(self, o):
        try:
            o = Vector(o)
        except Exception:
            return NotImplemented
        return (abs(self._v[0] - o._v[0]) < 1e-12 and
                abs(self._v[1] - o._v[1]) < 1e-12 and
                abs(self._v[2] - o._v[2]) < 1e-12)

    def dot(self, o):
        o = Vector(o)
        return (self._v[0] * o._v[0] + self._v[1] * o._v[1] + self._v[2] * o._v[2])

    def cross(self, o):
        o = Vector(o)
        a, b = self._v, o._v
        return Vector(a[1] * b[2] - a[2] * b[1],
                      a[2] * b[0] - a[0] * b[2],
                      a[0] * b[1] - a[1] * b[0])

    @property
    def length(self):
        return math.sqrt(self.dot(self))

    def normalized(self):
        ln = self.length
        if ln < 1e-14:
            raise ValueError('cannot normalize a zero-length Vector')
        return self / ln

    def get_signed_angle(self, vec, normal=None):
        """Signed angle in DEGREES between this vector and vec about normal
        (default -Z, like build123d): atan2((Va x Vb) . Vn, Va . Vb)."""
        n = Vector(0, 0, -1) if normal is None else Vector(normal)
        b = Vector(vec)
        reference = self.cross(b).dot(n)
        scale = self.length * b.length * n.length
        if abs(reference) <= 1e-12 * max(scale, _TOL_1E6):
            # OCCT's gp_Vec::AngleWithRef falls back to the UNSIGNED angle when
            # the cross product has no component along the reference (the two
            # vectors are parallel, or the plane they span is perpendicular to
            # it), so antiparallel is +180, never -180. Python's atan2 would
            # return -180 for a negative zero and silently flip every
            # comparison built on this (offset_2d's Side.LEFT/RIGHT pick).
            return math.degrees(math.acos(
                max(-1.0, min(1.0, self.normalized().dot(b.normalized())))))
        return math.degrees(math.atan2(reference, self.dot(b)))

    def reverse(self):
        return -self

    def rotate(self, axis, angle):
        """This vector rotated angle degrees about the given Axis DIRECTION
        (the joint math only ever rotates direction vectors)."""
        R = _axis_angle_mat(tuple(axis.direction), angle)
        return Vector(_mat_vec(R, self._v))

    def __repr__(self):
        return 'Vector' + repr(self._v)


def _v3(a):
    """Coerce anything point-like to a plain 3-tuple of floats."""
    if isinstance(a, Vector):
        return a._v
    t = tuple(a)
    if len(t) == 0:
        return (0.0, 0.0, 0.0)
    if len(t) == 1:
        return (_num(t[0]), 0.0, 0.0)
    if len(t) == 2:
        return (_num(t[0]), _num(t[1]), 0.0)
    return (_num(t[0]), _num(t[1]), _num(t[2]))


# ---------------------------------------- canonical free-edge parametrization
# Free edges and wires - the ones that come out of intersections, sections,
# projections and boolean operations rather than being drawn by the user -
# carry a start point ("seam"), a traversal direction and a parameter range
# that the CAD kernel picked for its own convenience. Those choices are
# IMPLEMENTATION DEFINED: they depend on the parametric frames of the surfaces
# that produced the curve (which meridian is u = 0), on the seed point of the
# surface/surface walking algorithm and on the order in which the boolean
# assembler happened to visit the faces of the result. Two geometrically
# identical solids therefore produce section edges with different seams and
# different directions, and anything measured from position_at(0) or
# Axis(edge) silently moves with them.
#
# This is a port of build123d's proposed topology/canonical.py - same names,
# same defaults, same tie-break conventions; see
# the canonical-edges research record (zalo/build123d branch canonical-research,
# research/) for the full write-up and the upstream
# patch. Pure geometry: the only primitive needed is "give me the point at arc
# length d", which is why it can be driven by a polyline and checked against a
# second CAD kernel.

# Number of arc length samples used to search for the canonical seam. The
# search resolves near-extremal arcs down to length / (SAMPLES / 2).
CANONICAL_SAMPLES = 512

# Relative size of the "lexicographically extremal" band, as a fraction of the
# bounding box diagonal of the loop. Making the band a finite width (instead of
# hunting for the extremum itself) is what makes the seam well conditioned: the
# band edges are transversal crossings, so they are located to full precision,
# and the midpoint of the band cancels the leading curvature term.
CANONICAL_BAND = 1e-6


class CanonicalForm:
    """Canonical traversal of a 1D shape.

    start: arc length distance, measured along the shape's current
    (orientation aware) parametrization, of the canonical start point. Always
    0.0 for open shapes.
    sign: +1 if the shape's current direction is canonical, -1 if it must be
    traversed backwards.
    closed: whether the shape was treated as a closed loop.

    (build123d's is a NamedTuple; this one is iterable and compares equal to
    the equivalent tuple so the two behave alike.)"""

    def __init__(self, start, sign, closed):
        self.start = start
        self.sign = sign
        self.closed = closed

    def position(self, position):
        """Map a canonical normalized position to the shape's own normalized
        position, so that shape.position_at(form.position(u)) walks the shape
        canonically."""
        if self.closed:
            return (self.start + self.sign * position) % 1.0
        return position if self.sign > 0 else 1.0 - position

    def __iter__(self):
        return iter((self.start, self.sign, self.closed))

    def __len__(self):
        return 3

    def __getitem__(self, i):
        return (self.start, self.sign, self.closed)[i]

    def __eq__(self, other):
        try:
            return tuple(self) == tuple(other)
        except TypeError:
            return NotImplemented

    def __repr__(self):
        return ('CanonicalForm(start=' + repr(self.start) + ', sign=' +
                repr(self.sign) + ', closed=' + repr(self.closed) + ')')


def _quantise(value, resolution):
    """value snapped to a multiple of resolution.

    Comparisons of "is this coordinate smaller?" are only meaningful above the
    geometric tolerance; quantising makes near-equal values tie EXACTLY so the
    next coordinate can decide."""
    return int(math.floor(value / resolution + 0.5))


def _coordinate(point, index):
    """The index-th coordinate of a Vector."""
    return (point.X, point.Y, point.Z)[index]


def lexicographic_key(point):
    """The (x, y, z) sort key used by every canonical comparison."""
    if isinstance(point, Vector):
        return (point.X, point.Y, point.Z)
    x, y, z = point
    return (x, y, z)


def loop_area_vector(points):
    """Vector area (Newell) of a closed polyline: 1/2 sum (p_i - c) x (p_i+1 - c).

    Its direction is the loop's winding axis (exact for planar loops, the
    least-squares normal for non planar ones) and its length is the enclosed
    area, so it doubles as a degeneracy measure."""
    count = len(points)
    center = Vector(sum(p.X for p in points) / count,
                    sum(p.Y for p in points) / count,
                    sum(p.Z for p in points) / count)
    area = Vector(0, 0, 0)
    for i in range(count):
        first = points[i] - center
        second = points[(i + 1) % count] - center
        area = area + first.cross(second)
    return area * 0.5


def _dominant_axis(area):
    """Index of the axis the loop winds about, preferring X, then Y, then Z on
    exact ties (a tie means the loop's plane bisects two axes, where no
    geometric rule can do better than a documented convention)."""
    magnitudes = (abs(area.X), abs(area.Y), abs(area.Z))
    best = 0
    for index in (1, 2):
        if magnitudes[index] > magnitudes[best]:
            best = index
    return best


def _golden_min(function, low, high, iterations=40):
    """(location, value) of the minimum of a unimodal function on [low, high].

    The VALUE of a smooth minimum is well conditioned; its location is not (an
    error d in the location only changes the value by O(d^2)), so the location
    is used as nothing more than a seed for the band search below."""
    inv_phi = 0.6180339887498949
    b_low, b_high = low, high
    x_1 = b_high - inv_phi * (b_high - b_low)
    x_2 = b_low + inv_phi * (b_high - b_low)
    f_1, f_2 = function(x_1), function(x_2)
    for _ in range(iterations):
        if f_1 <= f_2:
            b_high, x_2, f_2 = x_2, x_1, f_1
            x_1 = b_high - inv_phi * (b_high - b_low)
            f_1 = function(x_1)
        else:
            b_low, x_1, f_1 = x_1, x_2, f_2
            x_2 = b_low + inv_phi * (b_high - b_low)
            f_2 = function(x_2)
    return (x_1, f_1) if f_1 <= f_2 else (x_2, f_2)


def _bisect_level(function, inside, outside, level):
    """Distance where function crosses level, bracketed by a point below the
    level and a point above it. A transversal crossing, hence full
    precision."""
    low, high = inside, outside
    for _ in range(60):
        mid = 0.5 * (low + high)
        if function(mid) <= level:
            low = mid
        else:
            high = mid
    return 0.5 * (low + high)


def _local_minima(values):
    """One representative index per local minimum of a cyclic sample list.

    Plateaus (a straight extremal side, say) collapse to their middle sample, so
    the number of candidates stays proportional to the number of FEATURES, not
    to the number of samples."""
    count = len(values)
    if count == 0:
        return []
    if all(value == values[0] for value in values):
        return [0]
    minima = []
    for index in range(count):
        if not values[index] < values[index - 1]:
            continue  # not a strict descent into index
        end = index
        while values[(end + 1) % count] == values[index] and end - index < count:
            end = end + 1
        if values[(end + 1) % count] > values[index]:
            minima.append(((index + end) // 2) % count)
    return minima


def _band_midpoint(value, inside, level, step, samples, length):
    """Arc-length midpoint of the value <= level band that contains inside.

    The band edges are transversal crossings of level, so bisection finds them
    to full precision, and their midpoint cancels the leading curvature term of
    the extremum inside the band. Neither the midpoint nor the width depends on
    where the samples happened to fall."""
    backward = inside
    for _ in range(samples):
        if value(backward - step) > level:
            break
        backward = backward - step
    forward = inside
    for _ in range(samples):
        if value(forward + step) > level:
            break
        forward = forward + step
    band_start = _bisect_level(value, backward, backward - step, level)
    band_end = _bisect_level(value, forward, forward + step, level)
    return (band_start + 0.5 * ((band_end - band_start) % length)) % length


def canonical_form(sampler, length, closed, samples=CANONICAL_SAMPLES,
                   band=CANONICAL_BAND):
    """Canonical traversal of a curve given an arc length sampler.

    sampler(distance) -> Vector, distance in [0, length]; length is the total
    arc length; closed says whether sampler(0) == sampler(length).

    Open shapes are traversed from the lexicographically smaller of their two
    end points. Closed shapes start at the midpoint of the lexicographically
    extremal band and wind counter-clockwise about the dominant axis of their
    area vector."""
    if length <= _TOL_1E6:
        return CanonicalForm(0.0, 1, closed)

    if not closed:
        start, end = sampler(0.0), sampler(length)
        sign = 1 if lexicographic_key(start) <= lexicographic_key(end) else -1
        return CanonicalForm(0.0, sign, False)

    step = length / samples
    points = [sampler(index * step) for index in range(samples)]

    # ---- direction: wind counter-clockwise about the dominant winding axis
    area = loop_area_vector(points)
    axis = _dominant_axis(area)
    sign = 1
    if abs(_coordinate(area, axis)) > _TOL_1E6 * _TOL_1E6:
        sign = 1 if _coordinate(area, axis) > 0 else -1

    # ---- seam: midpoint of the lexicographically extremal band
    diagonal = max(max(_coordinate(p, i) for p in points) -
                   min(_coordinate(p, i) for p in points) for i in range(3))
    tolerance_band = max(band * max(diagonal, _TOL_1E6), _TOL_1E6 * 1e-3)

    seam = 0.0
    for coordinate in (0, 1, 2):

        def value(distance, coordinate=coordinate):
            return _coordinate(sampler(distance % length), coordinate)

        values = [_coordinate(p, coordinate) for p in points]

        # Every local minimum of the sampled coordinate is a candidate feature;
        # refining each one's VALUE (its location is ill conditioned, its value
        # is not) says which of them are extremal to within the band. Looking
        # only at samples below a threshold would miss a band whose samples all
        # sit just above it.
        refined = []
        for index in _local_minima(values):
            location, minimum = _golden_min(value, (index - 1) * step,
                                            (index + 1) * step)
            if values[index] < minimum:
                location, minimum = index * step, values[index]
            refined.append((minimum, location))
        if not refined:
            continue

        level = min(minimum for minimum, _ in refined) + tolerance_band
        if all(sample_value <= level for sample_value in values):
            continue  # loop is flat in this coordinate: fall through to the next

        # Each extremal band is reduced to its own midpoint, and the bands are
        # then ranked by THOSE POINTS in the remaining coordinates. Comparing the
        # minima of whichever samples fell inside a band would make the choice
        # depend on the sampling phase. Coordinates are quantised to the band
        # width so that two candidates whose y agree to within tolerance tie on y
        # and let z decide, instead of the last bits of a mirror-symmetric pair
        # of minima picking the winner.
        others = [other for other in (0, 1, 2) if other != coordinate]
        candidates = []
        for minimum, location in refined:
            if minimum > level:
                continue
            midpoint = _band_midpoint(value, location, level, step, samples, length)
            point = sampler(midpoint)
            candidates.append((tuple(_quantise(_coordinate(point, other),
                                               tolerance_band)
                                     for other in others), midpoint))
        if not candidates:
            continue

        # A surviving tie means the loop is symmetric about this band to within
        # tolerance, where no geometric rule can choose - the smallest midpoint
        # distance wins, which is stable for a given input.
        seam = min(candidates)[1]
        break

    return CanonicalForm(seam / length, sign, True)


# build123d's one_d.py imports the rule under this alias so the Mixin1D method
# of the same name can shadow it
_canonical_form = canonical_form


# 3x3 matrices as tuples of row-tuples
_MAT_I = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def _mat_mul(A, B):
    return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3))
                       for j in range(3)) for i in range(3))


def _mat_vec(A, v):
    return tuple(A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]
                 for i in range(3))


def _mat_is_identity(A):
    for i in range(3):
        for j in range(3):
            if abs(A[i][j] - (1.0 if i == j else 0.0)) > 1e-12:
                return False
    return True


def _rot_mat(rx, ry, rz):
    """Intrinsic-XYZ rotation matrix Rx*Ry*Rz (matches build123d Rotation)."""
    cx, sx = math.cos(math.radians(rx)), math.sin(math.radians(rx))
    cy, sy = math.cos(math.radians(ry)), math.sin(math.radians(ry))
    cz, sz = math.cos(math.radians(rz)), math.sin(math.radians(rz))
    Rx = ((1.0, 0.0, 0.0), (0.0, cx, -sx), (0.0, sx, cx))
    Ry = ((cy, 0.0, sy), (0.0, 1.0, 0.0), (-sy, 0.0, cy))
    Rz = ((cz, -sz, 0.0), (sz, cz, 0.0), (0.0, 0.0, 1.0))
    return _mat_mul(_mat_mul(Rx, Ry), Rz)


def _euler_mat(angles, order, intrinsic=True):
    """Rotation matrix for an arbitrary Euler sequence (build123d's
    Intrinsic/Extrinsic orders, which map onto gp_EulerSequence). Intrinsic
    applies each rotation about the ALREADY-ROTATED frame, i.e. the matrices
    multiply left-to-right; extrinsic multiplies right-to-left about the fixed
    frame."""
    axes = {'X': lambda a: ((1.0, 0.0, 0.0),
                            (0.0, math.cos(a), -math.sin(a)),
                            (0.0, math.sin(a), math.cos(a))),
            'Y': lambda a: ((math.cos(a), 0.0, math.sin(a)),
                            (0.0, 1.0, 0.0),
                            (-math.sin(a), 0.0, math.cos(a))),
            'Z': lambda a: ((math.cos(a), -math.sin(a), 0.0),
                            (math.sin(a), math.cos(a), 0.0),
                            (0.0, 0.0, 1.0))}
    R = _MAT_I
    letters = list(order)
    values = [math.radians(a) for a in angles]
    if not intrinsic:
        letters = list(reversed(letters))
        values = list(reversed(values))
    for letter, value in zip(letters, values):
        R = _mat_mul(R, axes[letter](value))
    return R


def _axis_angle_mat(axis, degrees):
    """Rotation matrix from axis + angle (Rodrigues)."""
    x, y, z = Vector(axis).normalized()
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    C = 1.0 - c
    return ((c + x * x * C, x * y * C - z * s, x * z * C + y * s),
            (y * x * C + z * s, c + y * y * C, y * z * C - x * s),
            (z * x * C - y * s, z * y * C + x * s, c + z * z * C))


def _mat_axis_angle(R):
    """Rotation matrix -> (axis list, angle degrees); robust near 0 and 180."""
    tr = R[0][0] + R[1][1] + R[2][2]
    c = max(-1.0, min(1.0, (tr - 1.0) / 2.0))
    angle = math.acos(c)
    if angle < 1e-10:
        return [0.0, 0.0, 1.0], 0.0
    if abs(angle - math.pi) < 1e-7:
        # axis from the largest diagonal element of (R + I) / 2
        xx = (R[0][0] + 1.0) / 2.0
        yy = (R[1][1] + 1.0) / 2.0
        zz = (R[2][2] + 1.0) / 2.0
        if xx >= yy and xx >= zz:
            x = math.sqrt(max(xx, 0.0))
            axis = [x, R[0][1] / (2.0 * x), R[0][2] / (2.0 * x)]
        elif yy >= zz:
            y = math.sqrt(max(yy, 0.0))
            axis = [R[0][1] / (2.0 * y), y, R[1][2] / (2.0 * y)]
        else:
            z = math.sqrt(max(zz, 0.0))
            axis = [R[0][2] / (2.0 * z), R[1][2] / (2.0 * z), z]
        return axis, 180.0
    s = 2.0 * math.sin(angle)
    axis = [(R[2][1] - R[1][2]) / s,
            (R[0][2] - R[2][0]) / s,
            (R[1][0] - R[0][1]) / s]
    return axis, math.degrees(angle)


# ------------------------------------------------------------- Location ---

class Location:
    """Rigid placement: rotation matrix + translation. Composes with *.
    Right operand applies first: (Pos(0,0,5) * Rot(Z=45)) * shape rotates,
    then translates — like build123d."""

    def __init__(self, *args):
        self._R = _MAT_I
        self._t = (0.0, 0.0, 0.0)
        if len(args) == 0:
            return
        if len(args) == 1:
            a = args[0]
            if isinstance(a, Location):
                self._R, self._t = a._R, a._t
            elif isinstance(a, Plane):
                loc = a.location
                self._R, self._t = loc._R, loc._t
            else:
                self._t = _v3(a)
        elif len(args) == 2:
            self._t = _v3(args[0])
            r = args[1]
            if isinstance(r, (int, float)):
                self._R = _rot_mat(0.0, 0.0, r)
            else:
                r = _v3(r)
                self._R = _rot_mat(r[0], r[1], r[2])
        elif len(args) == 3:
            if isinstance(args[2], str):
                # Location(position, (rx, ry, rz), Intrinsic/Extrinsic order)
                # - build123d's Euler-sequence form (gp_EulerSequence)
                order = args[2]
                intrinsic = not order.startswith('x')
                self._t = _v3(args[0])
                self._R = _euler_mat(_v3(args[1]),
                                     order[1:] if not intrinsic else order,
                                     intrinsic)
            else:
                # Location(position, rotation_axis, angle_degrees)
                self._t = _v3(args[0])
                self._R = _axis_angle_mat(args[1], args[2])
        else:
            raise TypeError('Location: unsupported arguments')

    @classmethod
    def _make(cls, R, t):
        loc = object.__new__(cls)
        loc._R = R
        loc._t = tuple(t)
        return loc

    @property
    def position(self):
        return Vector(self._t)

    @position.setter
    def position(self, value):
        self._t = tuple(_v3(value))

    @property
    def orientation(self):
        # Euler intrinsic-XYZ extraction (inverse of _rot_mat)
        R = self._R
        sy = R[0][2]
        sy = max(-1.0, min(1.0, sy))
        ry = math.asin(sy)
        if abs(abs(sy) - 1.0) > 1e-9:
            rx = math.atan2(-R[1][2], R[2][2])
            rz = math.atan2(-R[0][1], R[0][0])
        else:
            rx = math.atan2(R[1][0], R[1][1])
            rz = 0.0
        return Vector(math.degrees(rx), math.degrees(ry), math.degrees(rz))

    @orientation.setter
    def orientation(self, value):
        r = _v3(value)
        self._R = _rot_mat(r[0], r[1], r[2])

    def __iter__(self):
        """tuple(location) -> (position, orientation): the translation and
        the intrinsic-XYZ Euler DEGREES (build123d 0.12 replaced
        Location.to_tuple with iteration)."""
        return iter((self.position, self.orientation))

    @property
    def x_axis(self):
        """Axis along this location's local X (build123d Location.x_axis)."""
        R = self._R
        return Axis(self._t, (R[0][0], R[1][0], R[2][0]))

    @property
    def y_axis(self):
        R = self._R
        return Axis(self._t, (R[0][1], R[1][1], R[2][1]))

    @property
    def z_axis(self):
        R = self._R
        return Axis(self._t, (R[0][2], R[1][2], R[2][2]))

    def inverse(self):
        Rt = tuple(tuple(self._R[j][i] for j in range(3)) for i in range(3))
        t = _mat_vec(Rt, self._t)
        return Location._make(Rt, (-t[0], -t[1], -t[2]))

    def _transform_point(self, p):
        q = _mat_vec(self._R, _v3(p))
        return (q[0] + self._t[0], q[1] + self._t[1], q[2] + self._t[2])

    def _apply_topo(self, topo):
        if not _mat_is_identity(self._R):
            axis, angle = _mat_axis_angle(self._R)
            if angle != 0.0:
                topo = w.Rotate(axis, angle, topo)
        if abs(self._t[0]) > _TOL or abs(self._t[1]) > _TOL or abs(self._t[2]) > _TOL:
            topo = w.Translate([self._t[0], self._t[1], self._t[2]], topo)
        return topo

    def __mul__(self, other):
        if isinstance(other, Location):
            R = _mat_mul(self._R, other._R)
            t0 = _mat_vec(self._R, other._t)
            return Location._make(R, (t0[0] + self._t[0], t0[1] + self._t[1],
                                      t0[2] + self._t[2]))
        if isinstance(other, Plane):
            return Plane._from_location(Location(self) * other.location)
        if isinstance(other, Shape):
            if other.topo is None:
                return other
            moved = _wrap_like(other, self._apply_topo(other.topo))
            moved._loc = self * other.location
            # build123d's Shape.moved deep-copies the shape, so its JOINTS come
            # along rebound to the copy (copy_attributes_to); their frames are
            # relative to the parent, so they follow the move automatically.
            if other.joints:
                moved.joints = {k: j._lite_rebind(moved)
                                for k, j in other.joints.items()}
            if isinstance(moved, Mixin1D) and moved._specs:
                # keep segment data consistent with the moved geometry so
                # make_face()/sweep() can still chain the result exactly
                fn_dir = lambda d: _mat_vec(self._R, d)
                try:
                    moved._specs = [_seg_transform(s, self._transform_point,
                                                   fn_dir, self)
                                    for s in moved._specs]
                except NotImplementedError:
                    # opaque 'raw' segments cannot be re-derived; the moved
                    # TOPO is still exact, only spec-level chaining is lost
                    moved._specs = []
            return moved
        if isinstance(other, (str, Vector)):
            return NotImplemented
        # build123d 0.12: an iterable (list, generator, map...) is consumed
        # once and applied element-wise - all Locations compose, all movable
        # objects (Shapes, Planes) move
        try:
            items = list(other)
        except TypeError:
            return NotImplemented
        if all(isinstance(i, Location) for i in items):
            return [self * i for i in items]
        if all(isinstance(i, Plane) for i in items):
            return [self * i for i in items]
        if all(isinstance(i, (Shape, Plane)) for i in items):
            return ShapeList([self * i for i in items])
        return NotImplemented

    def __neg__(self):
        """Flip the orientation without moving the origin (build123d -loc:
        Location(-Plane(self)), i.e. z and y reversed, x kept)."""
        return Location(-Plane(self))

    def __repr__(self):
        return ('Location(t=' + repr(self._t) + ', R=' + repr(self._R) + ')')


class Pos(Location):
    def __init__(self, *args, **kwargs):
        if kwargs:
            x = kwargs.get('X', args[0] if len(args) > 0 else 0.0)
            y = kwargs.get('Y', args[1] if len(args) > 1 else 0.0)
            z = kwargs.get('Z', args[2] if len(args) > 2 else 0.0)
            Location.__init__(self, (x, y, z))
        elif len(args) == 1 and not isinstance(args[0], (int, float)):
            Location.__init__(self, args[0])
        else:
            x = args[0] if len(args) > 0 else 0.0
            y = args[1] if len(args) > 1 else 0.0
            z = args[2] if len(args) > 2 else 0.0
            Location.__init__(self, (x, y, z))


def _is_ordering(value):
    for cls in (Intrinsic, Extrinsic):
        for name in ('XYZ', 'XZY', 'YZX', 'YXZ', 'ZXY', 'ZYX', 'XYX', 'XZX',
                     'YZY', 'YXY', 'ZXZ', 'ZYZ'):
            if getattr(cls, name) == value:
                return True
    return False


class Rotation(Location):
    """A pure rotation (build123d 0.12 Rotation overloads): Euler angles
    Rotation(X, Y, Z, ordering=Intrinsic.XYZ), a RotationLike
    Rotation((x, y, z) | Vector | Rotation, ordering), or - new in 0.12 -
    Rotation(Axis, angle): a rotation about the axis LINE (an axis off the
    origin carries a translation, like gp_Trsf.SetRotation)."""

    def __init__(self, *args, **kwargs):
        rotation_like = kwargs.pop('rotation', None)
        x_angle = kwargs.pop('X', None)
        y_angle = kwargs.pop('Y', None)
        z_angle = kwargs.pop('Z', None)
        ordering = kwargs.pop('ordering', None)
        axis = kwargs.pop('axis', None)
        axis_angle = kwargs.pop('angle', None)
        if kwargs:
            raise TypeError('Unexpected keyword arguments: ' +
                            ', '.join(kwargs))
        if args:
            first = args[0]
            if isinstance(first, Axis):
                axis = first if axis is None else axis
                if len(args) > 1 and axis_angle is None:
                    axis_angle = args[1]
                if len(args) > 2:
                    raise TypeError('Too many arguments for axis-angle '
                                    'Rotation')
            elif isinstance(first, (Rotation, Vector, tuple)):
                rotation_like = first if rotation_like is None \
                    else rotation_like
                if len(args) > 1 and ordering is None:
                    ordering = args[1]
                if len(args) > 2:
                    raise TypeError('Too many arguments for RotationLike '
                                    'Rotation')
            elif isinstance(first, (int, float)):
                if x_angle is None:
                    x_angle = first
                if len(args) > 1 and y_angle is None:
                    y_angle = args[1]
                if len(args) > 2 and z_angle is None:
                    z_angle = args[2]
                if len(args) > 3 and ordering is None:
                    ordering = args[3]
                if len(args) > 4:
                    raise TypeError('Too many arguments for Euler-angle '
                                    'Rotation')
            else:
                raise TypeError('Invalid positional arguments: ' + repr(args))
        has_axis_angle = axis is not None or axis_angle is not None
        has_euler = x_angle is not None or y_angle is not None or \
            z_angle is not None
        Location.__init__(self)
        if has_axis_angle:
            if axis is None or axis_angle is None:
                raise TypeError('Both an Axis and angle must be provided')
            if rotation_like is not None or has_euler or ordering is not None:
                raise TypeError('Unsupported or ambiguous Rotation arguments')
            if not isinstance(axis, Axis):
                raise TypeError('Axis must be an Axis, not ' +
                                type(axis).__name__)
            if not isinstance(axis_angle, (int, float)):
                raise TypeError('Angle must be an int or float, not ' +
                                type(axis_angle).__name__)
            if axis_angle != 0.0:
                R = _axis_angle_mat(tuple(axis.direction), axis_angle)
                p = tuple(axis.position)
                q = _mat_vec(R, p)
                self._R = R
                self._t = (p[0] - q[0], p[1] - q[1], p[2] - q[2])
            return
        if ordering is not None and not _is_ordering(ordering):
            raise TypeError('ordering must be an Extrinsic or Intrinsic value')
        if rotation_like is not None:
            if has_euler:
                raise TypeError('Unsupported or ambiguous Rotation arguments')
            if isinstance(rotation_like, Rotation):
                self._R, self._t = rotation_like._R, rotation_like._t
                return
            if not isinstance(rotation_like, (Vector, tuple)):
                raise TypeError('rotation must be a Rotation, Vector, or '
                                'tuple of Euler angles')
            angles = list(rotation_like)[:3]
            angles.extend([0.0] * (3 - len(angles)))
        else:
            angles = [x_angle if x_angle is not None else 0.0,
                      y_angle if y_angle is not None else 0.0,
                      z_angle if z_angle is not None else 0.0]
        for a in angles:
            if not isinstance(a, (int, float)):
                raise TypeError('Euler angles must be int or float values')
        if ordering is None or ordering == Intrinsic.XYZ:
            self._R = _rot_mat(angles[0], angles[1], angles[2])
        else:
            intrinsic = not ordering.startswith('x')
            self._R = _euler_mat(tuple(angles),
                                 ordering if intrinsic else ordering[1:],
                                 intrinsic)


Rot = Rotation


class Matrix:
    """A 3D, 4x4 transformation matrix, used to move geometry in space
    (build123d geometry.Matrix). Upstream wraps gp_GTrsf; lite's Location
    algebra is already pure Python, so the matrix is stored as three rows of
    four floats with the implied last row [0, 0, 0, 1] — same accessors,
    same validation, same repr."""

    def __init__(self, matrix=None):
        rows = [[1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0]]
        if matrix is not None:
            if isinstance(matrix, Matrix):
                rows = [list(r) for r in matrix._rows]
            elif isinstance(matrix, (list, tuple)):
                matrix = [list(row) for row in matrix]
                valid_sizes = all(len(row) == 4 for row in matrix) and \
                    len(matrix) in (3, 4)
                if not valid_sizes:
                    raise TypeError('Matrix constructor requires 2d list of '
                                    '4x3 or 4x4, but got: ' + repr(matrix))
                if len(matrix) == 4 and tuple(matrix[3]) != (0, 0, 0, 1):
                    raise ValueError('Expected the last row to be [0,0,0,1], '
                                     'but got: ' + repr(matrix[3]))
                for row in matrix[:3]:
                    for element in row:
                        if not isinstance(element, (int, float)):
                            raise TypeError('Only float or int are valid in '
                                            'the matrix')
                rows = [[float(v) for v in row] for row in matrix[:3]]
            else:
                raise TypeError(repr(matrix) + ' is of an unexpected type')
        self._rows = rows

    @property
    def wrapped(self):
        """The raw 3x4 rows (upstream exposes the gp_GTrsf here)."""
        return self._rows

    @staticmethod
    def _mul_rows(a, b):
        """Product of two 3x4 affine matrices (implied [0,0,0,1] last row)."""
        out = []
        for i in range(3):
            row = []
            for j in range(4):
                v = sum(a[i][k] * b[k][j] for k in range(3))
                if j == 3:
                    v += a[i][3]
                row.append(v)
            out.append(row)
        return out

    def rotate(self, axis, angle):
        """General rotate about axis by angle in degrees (upstream
        gp_Trsf::SetRotation about the FULL axis, position included)."""
        R = _axis_angle_mat(tuple(Vector(axis.direction).normalized()), angle)
        p = tuple(Vector(axis.position))
        Rp = _mat_vec(R, p)
        rot_rows = [[R[i][0], R[i][1], R[i][2], p[i] - Rp[i]]
                    for i in range(3)]
        self._rows = Matrix._mul_rows(self._rows, rot_rows)

    def inverse(self):
        """Invert Matrix (raises ValueError when singular)."""
        m = self._rows
        det = (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
               m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
               m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
        if abs(det) < 1e-14:
            raise ValueError('Matrix is singular and cannot be inverted')
        inv = [[(m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det,
                (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det,
                (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det],
               [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det,
                (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det,
                (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det],
               [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det,
                (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det,
                (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det]]
        t = [m[0][3], m[1][3], m[2][3]]
        rows = [[inv[i][0], inv[i][1], inv[i][2],
                 -sum(inv[i][k] * t[k] for k in range(3))] for i in range(3)]
        result = Matrix()
        result._rows = rows
        return result

    def multiply(self, other):
        """Matrix multiplication — a Vector is transformed (point transform,
        translation included), a Matrix returns the product."""
        if isinstance(other, Vector):
            m = self._rows
            x, y, z = tuple(other)
            return Vector(m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
                          m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
                          m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3])
        result = Matrix()
        result._rows = Matrix._mul_rows(self._rows, other._rows)
        return result

    def transposed_list(self):
        """Needed by the cqparts gltf exporter (column-major flatten)."""
        data = [list(r) for r in self._rows] + [[0.0, 0.0, 0.0, 1.0]]
        return [data[j][i] for i in range(4) for j in range(4)]

    def __copy__(self):
        result = Matrix()
        result._rows = [list(r) for r in self._rows]
        return result

    def __deepcopy__(self, _memo):
        return self.__copy__()

    def __getitem__(self, row_col):
        """Matrix[r, c] — zero-indexed, the implied 4th row included."""
        if not isinstance(row_col, tuple) or len(row_col) != 2:
            raise IndexError('Matrix subscript must provide (row, column)')
        row, col = row_col
        if not (0 <= row <= 3 and 0 <= col <= 3):
            raise IndexError('Out of bounds access into 4x4 matrix: ' +
                             repr(row_col))
        if row < 3:
            return self._rows[row][col]
        return [0.0, 0.0, 0.0, 1.0][col]

    def __repr__(self):
        transposed = self.transposed_list()
        matrix_str = (',' + chr(10) + '        ').join(
            str(transposed[i::4]) for i in range(4))
        return 'Matrix([' + matrix_str + '])'


# ----------------------------------------------------------------- Axis ---

class Axis:
    def __init__(self, origin=(0, 0, 0), direction=(0, 0, 1), canonical=False):
        # Axis(edge): origin at the start, direction along the tangent.
        # (duck-typed on .topo — the Shape class is defined later in this
        # module, and Axis.X/Y/Z are created at module load)
        # Axis(edge, canonical=True): origin & direction from the edge's
        # CANONICAL traversal instead of from the underlying curve's first
        # parameter (build123d's opt-in; default False keeps the pre-0.12
        # behaviour, which also disagrees with edge.position_at(0) whenever the
        # edge is REVERSED).
        # Axis(location) / Axis(plane): the frame's origin and its z axis
        # (build123d Axis(Location) - used to build joint axes from holes)
        # Duck-typed: Axis.X/Y/Z are constructed at module load, BEFORE the
        # Location and Plane classes exist, so isinstance() cannot be used.
        if hasattr(origin, '_R') and hasattr(origin, 'position'):    # Location
            self.position = Vector(origin.position)
            self.direction = Vector(origin.z_axis.direction).normalized()
            return
        if hasattr(origin, 'z_dir') and hasattr(origin, 'origin'):   # Plane
            self.position = Vector(origin.origin)
            self.direction = Vector(origin.z_dir).normalized()
            return
        if hasattr(origin, 'topo') and origin.topo is not None:
            edge = origin
            if origin.topo.ShapeType().value != 6:
                edge = origin.edges()[0]
            if canonical:
                canonical_edge = edge.canonical()
                self.position = canonical_edge.position_at(0)
                self.direction = canonical_edge.tangent_at(0).normalized()
                return
            p = w._edgePointAt(edge.topo, 0.0)
            t = w._edgeTangentAt(edge.topo, 0.0)
            self.position = Vector(tuple(p))
            self.direction = Vector(tuple(t)).normalized()
            return
        self.position = Vector(origin)
        self.direction = Vector(direction).normalized()

    @property
    def origin(self):
        return self.position

    @property
    def location(self):
        """Location whose z axis is this axis (build123d Axis.location)."""
        return Plane(self.position, z_dir=self.direction).location

    def located(self, loc):
        """This axis placed by loc (build123d Axis.located)."""
        p = loc._transform_point(tuple(self.position))
        d = _mat_vec(loc._R, tuple(self.direction))
        return Axis(p, d)

    def is_parallel(self, other, angular_tolerance=1e-5):
        # tolerance in DEGREES, like build123d's Axis.is_parallel
        d = min(1.0, abs(self.direction.dot(other.direction)))
        return math.acos(d) <= math.radians(angular_tolerance) or \
            d > (1.0 - 1e-9)

    def is_normal(self, other, angular_tolerance=1e-5):
        d = min(1.0, abs(self.direction.dot(other.direction)))
        return abs(math.degrees(math.acos(d)) - 90.0) <= angular_tolerance

    def is_opposite(self, other, angular_tolerance=1e-5):
        d = max(-1.0, min(1.0, self.direction.dot(other.direction)))
        return abs(math.degrees(math.acos(d)) - 180.0) <= \
            max(angular_tolerance, 1e-4)

    def __neg__(self):
        return Axis(self.position, -self.direction)

    def reverse(self):
        return -self

    def __repr__(self):
        return ('Axis(' + repr(tuple(self.position)) + ', ' +
                repr(tuple(self.direction)) + ')')


Axis.X = Axis((0, 0, 0), (1, 0, 0))
Axis.Y = Axis((0, 0, 0), (0, 1, 0))
Axis.Z = Axis((0, 0, 0), (0, 0, 1))


# ---------------------------------------------------------------- Plane ---

def _default_x_dir(z):
    """OCCT gp_Ax2's deterministic X direction for a normal (build123d uses
    gp_Ax3, same rule)."""
    a, b, c = z
    aa, bb, cc = abs(a), abs(b), abs(c)
    if bb <= aa and bb <= cc:
        if aa > cc:
            x = (-c, 0.0, a)
        else:
            x = (c, 0.0, -a)
    elif aa <= bb and aa <= cc:
        if bb > cc:
            x = (0.0, -c, b)
        else:
            x = (0.0, c, -b)
    else:
        if aa > bb:
            x = (-b, a, 0.0)
        else:
            x = (b, -a, 0.0)
    ln = math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2])
    return (x[0] / ln, x[1] / ln, x[2] / ln)


def _ortho_x_dir(z_dir, x_dir):
    """The x direction gp_Ax3(origin, z, x) actually adopts: x projected into
    the plane normal to z, normalized. build123d hands a possibly
    NON-perpendicular x_dir straight to gp_Ax3 (Plane.__init__), which
    orthogonalizes it — e.g. Face.location_at(point, x_dir=(1, 0, 0)) on a
    curved surface."""
    z = Vector(z_dir).normalized()
    x = Vector(x_dir)
    x = x - z * x.dot(z)
    ln = x.length
    if ln < 1e-12:
        raise ValueError('x_dir must not be parallel to z_dir')
    return x / ln


class Plane:
    def __init__(self, origin=(0, 0, 0), x_dir=None, z_dir=(0, 0, 1)):
        if isinstance(origin, Plane):
            p = origin
            self.origin = p.origin
            self.x_dir, self.y_dir, self.z_dir = p.x_dir, p.y_dir, p.z_dir
            return
        if isinstance(origin, Location):
            loc = origin
            R = loc._R
            self.origin = Vector(loc._t)
            self.x_dir = Vector(R[0][0], R[1][0], R[2][0])
            self.y_dir = Vector(R[0][1], R[1][1], R[2][1])
            self.z_dir = Vector(R[0][2], R[1][2], R[2][2])
            return
        if isinstance(origin, Face):
            face = origin
            n = w._faceNormal(face.topo)
            c = w._faceCentroid(face.topo)
            self.origin = Vector(c[0], c[1], c[2])
            self.z_dir = Vector(n[0], n[1], n[2]).normalized()
            # build123d derives x_dir from the face's UV axes
            u = w._faceUDir(face.topo)
            if u is not None:
                self.x_dir = _ortho_x_dir(self.z_dir, tuple(u))
            else:
                self.x_dir = Vector(_default_x_dir(tuple(self.z_dir)))
            self.y_dir = self.z_dir.cross(self.x_dir)
            return
        self.origin = Vector(origin)
        self.z_dir = Vector(z_dir).normalized()
        if x_dir is None:
            self.x_dir = Vector(_default_x_dir(tuple(self.z_dir)))
        else:
            self.x_dir = _ortho_x_dir(self.z_dir, x_dir)
        self.y_dir = self.z_dir.cross(self.x_dir)

    @classmethod
    def _from_location(cls, loc):
        return cls(loc)

    def copy(self):
        """An independent Plane with the same frame. Upstream planes are
        MUTABLE (objects_curve assigns .origin on its working plane) and
        upstream's named planes are FRESH per access; lite's Plane.XY & co
        are shared singletons, so anything that mutates must copy first —
        the copy shim dispatches through __copy__."""
        return Plane(self)

    __copy__ = copy

    @property
    def location(self):
        x, y, z = tuple(self.x_dir), tuple(self.y_dir), tuple(self.z_dir)
        R = ((x[0], y[0], z[0]), (x[1], y[1], z[1]), (x[2], y[2], z[2]))
        return Location._make(R, tuple(self.origin))

    def offset(self, amount):
        return Plane(self.origin + self.z_dir * amount, self.x_dir, self.z_dir)

    def rotated(self, rotation=(0, 0, 0)):
        """Plane with axes rotated (intrinsic XYZ, degrees) in the GLOBAL
        frame about the plane origin — matches build123d."""
        r = _v3(rotation)
        R = _rot_mat(r[0], r[1], r[2])
        return Plane(self.origin,
                     Vector(_mat_vec(R, tuple(self.x_dir))),
                     Vector(_mat_vec(R, tuple(self.z_dir))))

    def shift_origin(self, new_origin):
        return Plane(Vector(new_origin), self.x_dir, self.z_dir)

    def from_local_coords(self, pt):
        """A point given in this plane's local frame, in world coordinates
        (build123d Plane.from_local_coords)."""
        v = Vector(pt)
        return (self.origin + self.x_dir * v.X + self.y_dir * v.Y +
                self.z_dir * v.Z)

    def to_local_coords(self, pt):
        """The world point expressed in this plane's local frame."""
        d = Vector(pt) - self.origin
        return Vector(d.dot(self.x_dir), d.dot(self.y_dir), d.dot(self.z_dir))

    def __mul__(self, other):
        if isinstance(other, Location):
            return self.location * other
        return self.location * other

    def __neg__(self):
        return Plane(self.origin, self.x_dir, -self.z_dir)

    def __repr__(self):
        return ('Plane(o=' + repr(tuple(self.origin)) + ', x=' +
                repr(tuple(self.x_dir)) + ', z=' + repr(tuple(self.z_dir)) + ')')


# (Plane.XY etc. are assigned after the shape classes exist — Plane.__init__
#  dispatches on Face, which is defined below.)


# --------------------------------------------------------------- shapes ---

def _topo(obj):
    """Unwrap a Shape (or accept a raw TopoDS shape) to the JS shape object."""
    # A Builder stands in for its result everywhere build123d takes a Shape
    # (upstream Shape methods accept builders through the same coercion).
    if isinstance(obj, Builder):
        obj = obj._obj
        if obj is None:
            raise ValueError('this builder has no result yet')
    if isinstance(obj, Shape):
        if obj.topo is None:
            raise ValueError('this ' + type(obj).__name__ + ' is empty')
        return obj.topo
    if hasattr(obj, 'ShapeType'):
        return obj
    raise TypeError('expected a build123d-lite Shape, got ' + repr(obj))


def _wrap_like(obj, topo):
    cls = type(obj) if isinstance(obj, Shape) else Part
    if cls is Edge:
        cls = Curve
    elif cls is Face:
        cls = Sketch
    res = object.__new__(cls)
    Shape.__init__(res, topo)
    if isinstance(res, Mixin1D):
        res._specs = list(getattr(obj, '_specs', []) or [])
    return res


def _solid_volume(t):
    """Sum of per-solid volumes (0 for shapes without solids) — matches
    build123d's volume on compounds and sidesteps the meaningless partial
    integrals VolumeProperties gives open faces."""
    return w.SolidsVolume(t)


def _tolist(objs):
    if objs is None:
        return []
    if isinstance(objs, (Shape, Builder)):
        # a Builder stands in for its result and is NOT iterable upstream
        # either (build123d's add() coerces obj._obj per element)
        return [objs]
    return list(objs)


class ShapeHistory:
    """The record of what an operation did to its inputs' sub-shapes
    (build123d 0.12+ topology.ShapeHistory, wrapping the kernel's own
    BRepTools_History). Booleans, unify-cleans and fillets/chamfers hand
    over their record (the JS primitives keep it on the result as
    ._csHist); records chain with merge(). 'before' are the inputs that were
    already there and 'brought' the ones the operation brought in: Select.LAST
    keeps a result sub-shape that descends (untouched or rebuilt) from
    something brought in - or from no input at all - and Select.NEW one that
    descends from no input in any form. The Trace itself runs in JS
    (HistClassify) over IsSame-keyed maps, like upstream's."""

    def __init__(self, history=None, before=(), brought=()):
        self.wrapped = history      # JS BRepTools_History, None = empty record
        self.before = list(before)  # raw TopoDS inputs
        self.brought = list(brought)

    @classmethod
    def of(cls, *shapes):
        """The records the given shapes carry, merged into one, or None."""
        found = []
        for shape in shapes:
            if isinstance(shape, (list, tuple)):
                nested = cls.of(*shape)
                if nested is not None:
                    found.append(nested)
            else:
                history = getattr(shape, '_history', None)
                if isinstance(history, ShapeHistory):
                    found.append(history)
        if not found:
            return None
        if len(found) == 1:
            return found[0]
        merged = cls(before=[s for h in found for s in h.before],
                     brought=[s for h in found for s in h.brought])
        for history in found:
            merged.merge(history)
        return merged

    def copy(self):
        return ShapeHistory(self.wrapped, self.before, self.brought)

    def merge(self, later):
        """Extend this record with the operation that came after it."""
        # (None never crosses into JS: Brython hands it over as an object)
        if later is None or later.wrapped is None:
            return self
        if self.wrapped is None:
            self.wrapped = w.HistMerge(later.wrapped)
        else:
            self.wrapped = w.HistMerge(self.wrapped, later.wrapped)
        return self

    def with_inputs(self, before, brought):
        """Say which inputs were already there and which were brought in."""
        self.before = list(before)
        self.brought = list(brought)
        return self

    def _flags(self, topos):
        if not topos:
            return []
        hist = self.wrapped if self.wrapped is not None else False
        return list(w.HistClassify(hist, self.before, self.brought,
                                   list(topos)))

    def is_last(self, shape):
        return bool(self._flags([_topo(shape)])[0] & 1)

    def is_new(self, shape):
        return bool(self._flags([_topo(shape)])[0] & 2)


class _RecordHolder:
    """Lets ShapeHistory.of() merge bare records."""

    def __init__(self, record):
        self._history = record


def _record_of(topo, before, brought):
    """The ShapeHistory a history-recording JS primitive left on its result
    (HistRecord), with the inputs exactly as that operation saw them (a
    CacheOp hit hands back the record of THAT result); an empty record over
    the given inputs when the result carries none."""
    rec = w.HistRecord(topo) if topo is not None else None
    if rec is None:
        return ShapeHistory(None, before, brought)
    rec = list(rec)
    args = list(rec[1])
    tools = list(rec[2])
    return ShapeHistory(rec[0], args if args else before,
                        tools if tools else brought)


class Shape:
    """A shape wrapping a raw OCCT TopoDS shape (self.topo, may be None for
    empty algebra starters like Part()). Supports build123d algebra."""

    _material = None
    _dim = None     # topological dimension; set per subclass like upstream

    def __init__(self, topo=None):
        # graceful promotions like build123d: Shape(list_of_shapes) makes a
        # compound, Shape(other_shape) adopts its geometry
        if isinstance(topo, (list, tuple, ShapeList)):
            topos = [_topo(s) for s in topo
                     if not (isinstance(s, Shape) and s.topo is None)]
            if len(topos) == 0:
                topo = None
            elif len(topos) == 1:
                topo = topos[0]
            else:
                topo = w.MakeCompound(topos)
        elif isinstance(topo, Shape):
            topo = topo.topo
        self.topo = topo
        self.label = ''
        self.color = None
        self.children = []
        self._parent = None
        # build123d tracks a top-level Location on every shape; lite bakes
        # transforms into geometry but keeps the equivalent composed Location
        # here so joints / locate() / .position can reason about frames.
        self._loc = None  # None = identity
        self.joints = {}
        # how this shape was made (build123d 0.12 _made_by): Select.LAST/NEW
        self._history = None
        # the shapes this one was selected through, outermost first (0.12)
        self.topo_path = ()

    def _made_by(self, history):
        """Note the record of how this shape was made (Select.LAST/NEW)."""
        self._history = history
        return self

    def _select(self, shapes, select):
        """Narrow a list of this shape's sub-shapes by what the last
        operation did (upstream Shape._select)."""
        if select is None or select == Select.ALL:
            return shapes
        if select != Select.LAST and select != Select.NEW:
            raise ValueError('Invalid input, must be one of ' +
                             repr([Select.ALL, Select.LAST, Select.NEW]))
        record = self._history
        if record is None:
            raise ValueError('Select.' + str(select) + ' needs a record of '
                             'how this shape was made, and this one has none '
                             '- it is the result of no recorded operation')
        if len(shapes) == 0:
            return ShapeList()
        flags = record._flags([s.topo for s in shapes])
        bit = 1 if select == Select.LAST else 2
        out = ShapeList()
        for i in range(len(shapes)):
            if flags[i] & bit:
                out.append(shapes[i])
        return out

    @property
    def wrapped(self):
        """The underlying raw (JS/OCCT) shape — build123d compat."""
        return self.topo

    @property
    def parent(self):
        return self._parent

    @parent.setter
    def parent(self, value):
        """Attaching a shape to a parent ADDS it to the parent's children -
        build123d's assembly tree is anytree, where setting .parent is how a
        node joins the tree (tutorial_joints does exactly this with the M6
        screw). COMPROMISE(joints) still holds: there is no anytree, only the
        parent/children links that Compound walks.

        Membership here is by IDENTITY (upstream's anytree compares node
        identity): Shape.__eq__ is geometric same-ness, so 'in'/'remove'
        would silently detach a geometrically-equal sibling."""
        if self._parent is not None:
            kids = self._parent.children
            for i in range(len(kids)):
                if kids[i] is self:
                    del kids[i]
                    break
        self._parent = value
        if value is not None:
            # append unconditionally: every selector wrapper is a fresh
            # object, so a membership scan (which would now have to be a
            # traced-Python identity loop — geometric __eq__ must NOT decide
            # this) costs O(len(children)) per selector call for nothing
            value.children.append(self)

    def _extracted_from(self, source):
        """Record that this sub-shape was selected from 'source' (upstream
        _extracted_from: topo_path grows by the source). This is NOT the
        assembly parent (.parent), so selecting never adds children."""
        if isinstance(source, Shape):
            self.topo_path = tuple(source.topo_path) + (source,)
        return self

    @property
    def topo_parent(self):
        """The OUTERMOST shape this sub-shape was selected through
        (build123d 0.12 topo_path[0])."""
        path = self.topo_path
        return path[0] if path else None

    @topo_parent.setter
    def topo_parent(self, value):
        # upstream: topo_path = () or (value,); it is not the assembly link,
        # so no children bookkeeping happens here
        self.topo_path = () if value is None else (value,)

    @property
    def topo_owner(self):
        """The shape this one was DIRECTLY selected from (0.12
        topo_path[-1])."""
        path = self.topo_path
        return path[-1] if path else None

    @property
    def convexity(self):
        raise ValueError('a ' + type(self).__name__ + ' has no convexity - '
                         'only a Vertex, Edge or Face selected from a larger '
                         'shape does')

    # --- location bookkeeping (baked geometry + tracked frame) ---
    @property
    def location(self):
        # a COPY, like upstream's Location(self.wrapped.Location()): editing
        # the returned location must not move the shape
        return Location(self._loc) if self._loc is not None else Location()

    @location.setter
    def location(self, value):
        self.locate(value)

    @property
    def global_location(self):
        """This shape's location composed with every assembly ancestor's
        (build123d Shape.global_location)."""
        loc = self.location
        node = self._parent
        depth = 0
        while node is not None and depth < 256:
            loc = node.location * loc
            node = node._parent
            depth += 1
        return loc

    @property
    def position(self):
        return self.location.position

    @position.setter
    def position(self, value):
        cur = self.location
        delta = Vector(value) - cur.position
        if self.topo is not None:
            self.topo = w.Translate([delta.X, delta.Y, delta.Z], self.topo)
        self._loc = Location._make(cur._R, tuple(Vector(value)))

    @property
    def orientation(self):
        return self.location.orientation

    # --- boolean algebra ---
    def __add__(self, other):
        others = [o for o in _tolist(other) if not (isinstance(o, Shape) and o.topo is None)]
        topos = [_topo(o) for o in others]
        if self.topo is not None:
            topos.insert(0, self.topo)
        if len(topos) == 0:
            return _wrap_like(self, None)
        if len(topos) == 1:
            return _wrap_like(self, topos[0])
        vols = [_solid_volume(t) for t in topos]
        fused = w.Union(topos, False, 0, False, True)
        # COMPROMISE(kernel-guard): this OCCT 8.0.1 wasm build has a known
        # kernel fault where BooleanFuse SILENTLY DROPS an operand when
        # coplanar faces meet along BSpline edges. The JS Union now detects
        # the drop and rebuilds the union from the General-Fuse partition
        # (whose split phase is unaffected); if even that fails, a valid
        # fuse can never be smaller than its largest input, so RAISE here
        # (never return silently-wrong geometry).
        if max(vols) > 1e-6:
            rv = _solid_volume(fused)
            if rv < max(vols) * 0.999 - 1e-9:
                raise RuntimeError(
                    'KNOWN OCCT 8.0.1 wasm kernel fault: fuse dropped an '
                    'operand (result volume ' + repr(rv) + ' < largest '
                    'input ' + repr(max(vols)) + ') and the General-Fuse '
                    'rebuild could not recover it. This build\\'s '
                    'BooleanFuse mishandles coplanar BSpline-edged contact '
                    'faces; offset or restructure the touching geometry.')
        # the left operand was there before, the rest is brought in
        record = _record_of(fused, topos[:1], topos[1:])
        return _wrap_like(self, fused)._made_by(record)

    def __iter__(self):
        """Iterate contained shapes like build123d Compound iteration:
        solids for 3D content, else faces, else edges."""
        if self.topo is None:
            return iter(())
        sol = self.solids()
        if len(sol) > 0:
            return iter(sol)
        fac = self.faces()
        if len(fac) > 0:
            return iter(fac)
        return iter(self.edges())

    def __sub__(self, other):
        others = [o for o in _tolist(other) if not (isinstance(o, Shape) and o.topo is None)]
        if self.topo is None:
            raise ValueError('cannot subtract from an empty shape')
        if len(others) == 0:
            return _wrap_like(self, self.topo)
        tools = [_topo(o) for o in others]
        originals = list(tools)
        tool_record = None
        if len(tools) > 1:
            # fuse the tools first: ONE boolean cut, like build123d — the
            # sequential per-tool cuts are also less robust in this OCCT
            fused_tools = w.Union(tools, False, 0, False, True)
            tool_record = _record_of(fused_tools, tools[:1], tools[1:])
            tools = [fused_tools]
        cut = w.Difference(self.topo, tools, False, 0, False, True)
        # upstream records ONE cut with every tool brought in; the tool
        # pre-fuse chains in front of it (BRepTools_History merge)
        record = _record_of(cut, [self.topo], tools)
        if tool_record is not None:
            record = tool_record.copy().merge(record)
        record.with_inputs([self.topo], originals)
        return _wrap_like(self, cut)._made_by(record)

    def __and__(self, other):
        others = _tolist(other)
        topos = [self.topo] + [_topo(o) for o in others]
        common = w.Intersection(topos, False, 0, False, True)
        return _wrap_like(self, common)._made_by(
            _record_of(common, topos[:1], topos[1:]))

    def __neg__(self):
        """Reversed-orientation copy (build123d's Mixin2D.__neg__:
        TopoDS_Shape::Complemented). Defined on the base class because lite
        re-wraps transformed faces as Sketch (see _wrap_like), so -face and
        -sketch must both work; Face overrides it to stay a Face."""
        if self.topo is None:
            raise ValueError('Invalid Shape')
        return _wrap_like(self, w.ReverseShape(self.topo, True))

    def __rmul__(self, other):
        # [Plane(f) for f in ...] * shape  -> copies placed at each plane
        if isinstance(other, (list, tuple)) and all(
                isinstance(p, (Location, Plane)) for p in other):
            return ShapeList([p * self for p in other])
        return NotImplemented

    def fuse(self, *others):
        return self.__add__(list(others))

    def cut(self, *others):
        return self.__sub__(list(others))

    def intersect(self, *others):
        # intersect(Axis) on a 1-D shape is the POINT intersection upstream
        # returns as a ShapeList of Vertex (Mixin1D._intersect), not a boolean
        if len(others) == 1 and isinstance(others[0], Axis) and \
                isinstance(self, Mixin1D):
            return ShapeList([Vertex(tuple(p)) for p in
                              self.find_intersection_points(others[0])])
        return self.__and__(list(others))

    # --- selectors ---
    def edges(self, select=None, indices=None):
        """All (unique) edges as a ShapeList of Edge, or those the operation
        that made this shape brought in or created (select=Select.LAST) or
        created outright (Select.NEW) - build123d 0.12. indices=[...] is the
        CascadeStudio escape hatch used by the GUI Fillet tool."""
        if self.topo is None:
            return ShapeList()
        # degenerated edges are never returned (upstream filters them)
        sel = w.Edges(self.topo).nonDegenerate()
        idxs = list(sel.indices())
        raws = list(sel.edges())
        out = ShapeList()
        for i in range(len(idxs)):
            if indices is None or idxs[i] in indices:
                out.append(Edge(raws[i], parent=self, index=idxs[i]))
        return self._select(out, select)

    def faces(self, select=None):
        if self.topo is None:
            return ShapeList()
        sel = w.Faces(self.topo)
        idxs = list(sel.indices())
        raws = list(sel.faces())
        out = ShapeList()
        for i in range(len(idxs)):
            out.append(Face(raws[i], parent=self, index=idxs[i]))
        return self._select(out, select)

    def vertices(self, select=None):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        seen = set()   # a list made this O(n^2) on solid-heavy builders
        def _cb(vtx):
            p = w._vertexPoint(vtx)
            # INTEGER keys: Brython hashes an integral JS number (int) and the
            # same value arriving as a float differently, so float-tuple keys
            # let duplicates through there
            key = (int(round(p[0] * 1e9)), int(round(p[1] * 1e9)),
                   int(round(p[2] * 1e9)))
            if key not in seen:
                seen.add(key)
                out.append(Vertex(vtx, parent=self))
        w.ForEachVertex(self.topo, _cb)
        return self._select(out, select)

    def solids(self, select=None):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        def _cb(i, s):
            out.append(Solid(s)._extracted_from(self))
        w.ForEachSolid(self.topo, _cb)
        return self._select(out, select)

    def shells(self, select=None):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        def _cb(i, s):
            out.append(Shell(s)._extracted_from(self))
        w.ForEachShell(self.topo, _cb)
        return self._select(out, select)

    def wires(self, select=None):
        if self.topo is None:
            return ShapeList()
        out = ShapeList()
        def _cb(i, s):
            out.append(Wire(s)._extracted_from(self))
        w.ForEachWire(self.topo, _cb)
        return self._select(out, select)

    def face(self):
        fs = self.faces()
        return fs[0] if len(fs) > 0 else None

    def edge(self):
        es = self.edges()
        return es[0] if len(es) > 0 else None

    def wire(self):
        ws = self.wires()
        return ws[0] if len(ws) > 0 else None

    def solid(self):
        ss = self.solids()
        return ss[0] if len(ss) > 0 else None

    # --- tessellation (build123d 0.12 tessellate_with_uvs) ---
    def _tessellation(self, tolerance, angular_tolerance, atlas_packing,
                      atlas_gutter):
        if self.topo is None:
            raise ValueError('Cannot tessellate an empty shape')
        m = w.TessellateWithUVs(self.topo, tolerance, angular_tolerance,
                                bool(atlas_packing), float(atlas_gutter))
        v = list(m.vertices)
        n = list(m.normals)
        uv = list(m.uvs)
        t = list(m.triangles)
        verts = [Vector(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)]
        norms = [Vector(n[i], n[i + 1], n[i + 2]) for i in range(0, len(n), 3)]
        uvs = [(uv[i], uv[i + 1]) for i in range(0, len(uv), 2)]
        tris = [(int(t[i]), int(t[i + 1]), int(t[i + 2]))
                for i in range(0, len(t), 3)]
        return verts, tris, norms, uvs

    def tessellate(self, tolerance, angular_tolerance=0.1):
        verts, tris, _n, _uv = self._tessellation(tolerance,
                                                  angular_tolerance, False,
                                                  0.0)
        return verts, tris

    def tessellate_with_uvs(self, tolerance, angular_tolerance=0.1,
                            atlas_packing=True, atlas_gutter=0.0):
        """(vertices, triangles, normals, uvs): the tessellation with
        per-face [0, 1] UVs, optionally packed into one atlas (0.12)."""
        return self._tessellation(tolerance, angular_tolerance,
                                  atlas_packing, atlas_gutter)

    # --- materials and mass (build123d 0.12) ---
    @property
    def material(self):
        """The shape's material: its own, else the nearest assembly
        ancestor's (cached once found), else None."""
        node = self
        depth = 0
        while node is not None and depth < 256:
            m = node._material
            if m is not None:
                if node is not self:
                    self._material = m
                return m
            node = node._parent
            depth += 1
        return None

    @material.setter
    def material(self, value):
        """A bd_materials FinishedMaterial, a material NAME ('brass',
        'Mild Steel', a grade name...) or None. Sets the colour from the
        material's PBR colour, like upstream."""
        if value is None:
            self._material = None
            return
        if isinstance(value, _FinishedMaterial):
            m = value
        elif isinstance(value, str):
            m = _resolve_material(value)
        else:
            raise TypeError('Non supported type ' + type(value).__name__ +
                            ', need FinishedMaterial, str or None')
        self._material = m
        rgba = getattr(m, '_lite_rgba', None)
        if rgba:
            self.color = Color(*rgba)

    def compute_volume(self):
        """The GProp measure of the shape (0.12): 0 for a vertex, length
        for 1-D, area for 2-D, volume for solids."""
        if self.topo is None:
            return 0.0
        st = self.topo.ShapeType().value
        if st == 7:
            return 0.0
        if st in (5, 6):
            return float(w.EdgeLength(self.topo))
        if st in (3, 4):
            return float(w.SurfaceArea(self.topo))
        return float(self.volume)

    def compute_mass(self, mass_unit=None, length_unit=None):
        """volume x density in mass_unit (default grams), the volume
        measured in length_unit^3 (default mm) - build123d 0.12."""
        mass_unit = Unit.G if mass_unit is None else mass_unit
        length_unit = Unit.MM if length_unit is None else length_unit
        if self.topo is None:
            return 0.0
        volume = self.volume
        if volume == 0:
            return 0.0
        material = self.material
        density = material.material.density if \
            isinstance(material, _FinishedMaterial) else None
        if density is None:
            raise ValueError("Shape's density is missing")
        if density == 0:
            _warn("Shape's density is 0")
            return 0.0
        return volume * density * UNITS_PER_KILOGRAM[mass_unit] / \
            UNITS_PER_METER[length_unit] ** 3

    def mass(self, mass_unit=None, length_unit=None):
        """Mass from the material's density (0.12): solids and closed
        shells weigh their volume; faces, edges and vertices weigh 0."""
        if self.topo is None:
            return 0.0
        if isinstance(self, Shell):
            return self.compute_mass(mass_unit, length_unit)
        st = self.topo.ShapeType().value
        if st in (2, 3):   # solid / shell
            return self.compute_mass(mass_unit, length_unit)
        if st in (0, 1):   # compound / compsolid
            return Compound.mass(self, mass_unit, length_unit)
        return 0.0

    # --- measurement ---
    @property
    def volume(self):
        if self.topo is None:
            return 0.0
        return w.SolidsVolume(self.topo)

    @property
    def area(self):
        if self.topo is None:
            return 0.0
        return float(w.SurfaceArea(self.topo))

    @property
    def length(self):
        if getattr(self, '_length_attr', None) is not None:
            return self._length_attr
        if self.topo is None:
            return 0.0
        return w.EdgeLength(self.topo)

    @length.setter
    def length(self, value):
        self._length_attr = value

    def center(self, center_of=CenterOf.MASS):
        if center_of == CenterOf.BOUNDING_BOX:
            return self.bounding_box().center()
        return Vector(tuple(w.CenterOfMass(self.topo)))

    # --- minimal distance (BRepExtrema_DistShapeShape, like build123d) ---
    def distance_to_with_closest_points(self, other):
        """(distance, point on self, point on other) for the MINIMAL distance
        between two shapes (build123d
        Shape.distance_to_with_closest_points). other may be a point."""
        if self.topo is None:
            raise ValueError('Cannot calculate distance to or from an empty '
                             'shape')
        if isinstance(other, (Shape, Builder)):
            target = _topo(other)
        else:
            target = w.PointVertex(list(_v3(other)))
        res = w._distShapeShape(self.topo, target)
        if not res:
            raise RuntimeError('the distance between these shapes could not '
                               'be computed')
        r = list(res)
        return (r[0], Vector(tuple(r[1])), Vector(tuple(r[2])))

    def distance_to(self, other):
        """Minimal distance to another shape or point (build123d
        Shape.distance_to)."""
        return self.distance_to_with_closest_points(other)[0]

    def distance(self, other):
        """Minimal distance between two shapes (build123d Shape.distance)."""
        if not isinstance(other, (Shape, Builder)):
            raise ValueError('Cannot calculate distance to or from an empty '
                             'shape')
        return self.distance_to_with_closest_points(other)[0]

    def closest_points(self, other):
        """The two points where the distance between the shapes is minimal
        (build123d Shape.closest_points)."""
        return self.distance_to_with_closest_points(other)[1:3]

    def bounding_box(self, tolerance=None, optimal=True):
        return BoundBox(self)

    # --- placement ---
    def moved(self, loc):
        return loc * self

    def located(self, loc):
        """Copy at the ABSOLUTE location loc (build123d semantics): the
        tracked location is replaced, so the delta loc * current⁻¹ is what
        gets applied to the baked geometry."""
        delta = loc * self.location.inverse()
        placed = delta * self
        placed._loc = Location(loc)
        return placed

    def move(self, loc):
        moved = loc * self
        self.topo = moved.topo
        self._loc = moved._loc
        # the segment specs travel with the geometry: mirror()/make_face()
        # rebuild from them, so stale specs would silently un-place the shape
        if isinstance(self, Mixin1D):
            self._specs = moved._specs
        return self

    def locate(self, loc):
        placed = self.located(loc)
        self.topo = placed.topo
        self._loc = placed._loc
        if isinstance(self, Mixin1D):
            self._specs = placed._specs
        return self

    def rotate(self, axis, angle):
        topo = self.topo
        o = tuple(axis.position)
        shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Rotate(list(axis.direction), angle, topo)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        return _wrap_like(self, topo)

    def translate(self, v):
        return Pos(Vector(v)) * self

    def scale(self, factor, about=None):
        c = _v3(about) if about is not None else tuple(self.location.position)
        if not isinstance(factor, (int, float)):
            f = tuple(factor)
            return scale(self, f, about=c, mode=Mode.PRIVATE)
        return _wrap_like(self, w.ScaleUniform(self.topo, factor, list(c)))

    def mirror(self, mirror_plane=None):
        return mirror(self, about=mirror_plane or Plane.XZ, mode=Mode.PRIVATE)

    def project_to_shape(self, target, direction):
        """Delegate to Face.project_to_shape for every face of this shape
        (build123d defines projection per shape class; sketches project
        their faces)."""
        out = ShapeList()
        for f in self.faces():
            out.extend(Face(f.topo).project_to_shape(target, direction))
        return out

    def find_intersection_points(self, other, tolerance=1e-6):
        """(point, unit surface normal) pairs where the Axis crosses this
        shape's surface, sorted along the axis —
        BRepIntCurveSurface_Inter, like build123d."""
        hits = w.IntersectLineShape(self.topo, list(other.position),
                                    list(other.direction), tolerance)
        return [(Vector(tuple(h[0])), Vector(tuple(h[1]))) for h in hits]

    def project_faces(self, faces, path, start=0):
        """Project faces onto this shape following a path on the shape —
        upstream Shape.project_faces: each face is positioned on the
        surface-normal plane at its path position and projected inward."""
        path_length = path.length
        shape_center = self.center()
        if isinstance(faces, Shape):
            faces = faces.faces()
        faces = [f for f in faces]
        first_face_min_x = faces[0].bounding_box().min[0]
        projected = ShapeList()
        for face in faces:
            bbox = face.bounding_box()
            face_center_x = (bbox.min[0] + bbox.max[0]) / 2.0
            u = start + (face_center_x - first_face_min_x) / path_length
            path_position = path.position_at(u)
            path_tangent = path.tangent_at(u)
            axis = Axis(path_position, shape_center - path_position)
            surface_point, surface_normal = \
                self.find_intersection_points(axis)[0]
            pl = Plane(origin=surface_point, x_dir=path_tangent,
                       z_dir=surface_normal)
            projection_face = pl * face.moved(
                Location((-face_center_x, 0, 0)))
            projected.append(Face(projection_face.topo).project_to_shape(
                self, surface_normal * -1)[0])
        return projected

    def project_to_viewport(self, viewport_origin, viewport_up=(0, 0, 1),
                            look_at=None):
        """Hidden-line projection (HLRBRep): returns (visible, hidden)
        edge compounds like build123d."""
        vo = Vector(viewport_origin)
        target = Vector(look_at) if look_at is not None else \
            self.bounding_box().center()
        view_dir = (target - vo).normalized()
        vis, hid = w.HLRProject(self.topo, list(view_dir))
        return (Curve(vis).edges(), Curve(hid).edges())

    def show_topology(self, limit_class='Vertex', show_center=None):
        """Tree rendering of the internal structure (build123d
        Shape.show_topology). This is a DIAGNOSTIC string - no geometry rides
        on it - so it reproduces upstream's shape (labels, box-drawing prefix,
        centre or Location per node) without promising byte parity of the
        pointer values upstream prints."""
        order = ['Compound', 'Solid', 'Shell', 'Face', 'Wire', 'Edge',
                 'Vertex']
        getters = {'Solid': 'solids', 'Shell': 'shells', 'Face': 'faces',
                   'Wire': 'wires', 'Edge': 'edges', 'Vertex': 'vertices'}
        if limit_class in order:
            limit = order.index(limit_class)
        else:
            limit = len(order) - 1
        lines = []

        def describe(shape, label):
            name = type(shape).__name__
            use_center = show_center
            if use_center is None:
                use_center = not shape.children
            where = None
            if use_center:
                try:
                    c = shape.center()
                    where = 'Center(' + str(c.X) + ', ' + str(c.Y) + ', ' + \
                        str(c.Z) + ')'
                except Exception:
                    where = None
            if where is None:
                where = 'Location(' + str(shape.location) + ')'
            prefix = ''
            if label:
                prefix = label + ' '
            return prefix + name + ' at ' + where

        def children_of(shape):
            kids = [k for k in shape.children if isinstance(k, Shape)]
            if kids:
                return kids
            name = type(shape).__name__
            if name in order:
                start = order.index(name) + 1
            else:
                start = 1
            for level in order[start:limit + 1]:
                getter = getters.get(level)
                if getter is None:
                    continue
                try:
                    kids = list(getattr(shape, getter)())
                except Exception:
                    kids = []
                if kids:
                    return kids
            return []

        def walk(shape, label, prefix, is_last, is_root, depth=0):
            if depth > 8 or len(lines) > 5000:
                return                     # guard: diagnostics, not geometry
            if is_root:
                root_label = ''
                if label:
                    root_label = label + ' is the root'
                lines.append(describe(shape, root_label))
                child_prefix = ''
            else:
                branch = '\u251c\u2500\u2500 '
                if is_last:
                    branch = '\u2514\u2500\u2500 '
                lines.append(prefix + branch + describe(shape, label))
                if is_last:
                    child_prefix = prefix + '    '
                else:
                    child_prefix = prefix + '\u2502   '
            kids = children_of(shape)
            for i, kid in enumerate(kids):
                if kid is shape:
                    continue
                walk(kid, getattr(kid, 'label', ''), child_prefix,
                     i == len(kids) - 1, False, depth + 1)

        walk(self, self.label, '', True, True)
        return '\\n'.join(lines)

    def do_children_intersect(self, include_parent=False, tolerance=1e-5):
        """Do any of this assembly's children overlap (build123d
        Compound.do_children_intersect)? Same algorithm: a pre-order walk of
        the tree, a bounding-box pre-filter, then a real Intersection whose
        solid volume must exceed the tolerance."""
        nodes = []

        def preorder(shape, depth=0):
            if depth > 8:
                return
            nodes.append(shape)
            for kid in shape.children:
                if isinstance(kid, Shape) and kid is not shape:
                    preorder(kid, depth + 1)

        preorder(self)
        if not include_parent:
            nodes.pop(0)
        boxes = [n.bounding_box() for n in nodes]
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                a, b = boxes[i], boxes[j]
                if (a.max.X < b.min.X or b.max.X < a.min.X or
                        a.max.Y < b.min.Y or b.max.Y < a.min.Y or
                        a.max.Z < b.min.Z or b.max.Z < a.min.Z):
                    continue
                try:
                    common = nodes[i].intersect(nodes[j])
                except Exception:
                    common = None
                if common is None or common.topo is None:
                    continue
                volume = sum([s.volume for s in common.solids()])
                if volume > tolerance:
                    return (True, (nodes[i], nodes[j]), volume)
        return (False, (None, None), 0.0)

    def is_valid(self):
        return self.topo is not None

    def clean(self):
        return self

    # --- shape equality (upstream Shape.__eq__/__hash__) ---
    def __eq__(self, other):
        """Topological same-ness like upstream Shape.__eq__ (TopoDS IsSame:
        same underlying TShape + location; orientation ignored). Lite's
        selectors return FRESH Python wrappers on every call, so identity
        comparison silently misses upstream patterns like
        'face in solid.faces()' (offset openings) or 'v in face.vertices()'
        (2-D fillets); the wrapped TopoDS handles DO preserve TShape identity
        across selector calls. NOTE: internal bookkeeping that means identity
        (parent/children links, sceneShapes) uses explicit 'is' scans."""
        if self is other:
            return True
        if not isinstance(other, Shape):
            return NotImplemented
        if self.topo is None or other.topo is None:
            return self.topo is None and other.topo is None
        return bool(w._sameShape(self.topo, other.topo))

    def __hash__(self):
        """Consistent with __eq__: TopoDS_Shape::HashCode hashes the
        TShape + Location exactly like IsSame compares them (orientation
        excluded from both). Cheap — the previous rounded-bounding-box key
        computed a kernel Bnd_Box per hash, which made upstream's per-op
        Select.LAST set bookkeeping (thousands of sub-shape hashes) dominate
        whole scripts. Not cached: move()/locate() mutate self.topo in
        place."""
        if self.topo is None:
            return 0
        return int(w._shapeHashCode(self.topo))

    def _lite_copy(self):
        c = _wrap_like(self, self.topo)
        c._loc = self._loc
        c.label = self.label
        # copy.copy in build123d preserves joints REPARENTED to the copy
        # (shape_core.copy_attributes_to)
        if self.joints:
            c.joints = {k: j._lite_rebind(c) for k, j in self.joints.items()}
        c.children = list(self.children)
        return c

    def __copy__(self):
        return self._lite_copy()

    def __deepcopy__(self, memo=None):
        return self._lite_copy()


class Compound(Shape):
    """A Shape made of other shapes (upstream identity: Part/Sketch/Curve are
    Compound subclasses; builder transfers classify through Compound and
    extract base objects with get_type)."""

    @property
    def volume(self):
        """build123d Compound.volume: the solids/shells one level down
        (Compound.get_type reads the DIRECT children of the compound and of
        its direct child compounds). For an ASSEMBLY that means each plain
        child counts and a nested sub-assembly does not (its parts sit two
        levels down) - assemblies.rst: assembly3.volume == 1. Lite flattens
        single-child layers, so a non-assembly compound keeps the per-solid
        sum (COMPROMISE(volume-measure))."""
        if self.topo is None:
            return 0.0
        if self.children:
            total = 0.0
            for child in self.children:
                if isinstance(child, Shape) and not child.children:
                    total += child.volume
            return total
        return w.SolidsVolume(self.topo)

    def mass(self, mass_unit=None, length_unit=None):
        """build123d 0.12 Compound.mass: an assembly sums its children's
        masses (each with its own material); otherwise every solid and shell
        weighs in with the compound's material."""
        if self.children:
            return sum(c.mass(mass_unit, length_unit) for c in self.children)
        total = 0.0
        material = self.material
        pieces = list(self.get_type(Solid)) + list(self.get_type(Shell))
        if not pieces and self.topo is not None and \
                self.topo.ShapeType().value in (2, 3):
            pieces = [self]
        for piece in pieces:
            piece._material = material
            total += piece.compute_mass(mass_unit, length_unit)
        return total

    @classmethod
    def make_triad(cls, axes_scale):
        """The coordinate-system triad symbol (build123d Compound.make_triad):
        three axis lines with spline arrow heads.

        COMPROMISE(triad-labels): upstream also draws 'X'/'Y'/'Z' with the
        'singleline' STROKE font, which this build does not ship (only the
        outline font FreeSans), so the labels are omitted. The triad is a
        viewer symbol, never part of a modelled part."""
        s = float(axes_scale)
        parts = [Edge.make_line((0, 0, 0), (s, 0, 0)),
                 Edge.make_line((0, 0, 0), (0, s, 0)),
                 Edge.make_line((0, 0, 0), (0, 0, s))]
        arrow_arc = Edge.make_spline([(0, 0, 0), (-s / 20, s / 30, 0)],
                                     [(-1, 0, 0), (-1, 1.5, 0)])
        arrow = Curve([arrow_arc, arrow_arc.mirror(Plane.XZ)])
        parts.append(Pos(s, 0, 0) * arrow)
        parts.append(Pos(0, s, 0) * (arrow.rotate(Axis.Z, 90)))
        parts.append(Pos(0, 0, s) * (arrow.rotate(Axis.Y, -90)))
        return Curve(parts)

    def __init__(self, obj=None, label='', color=None, material=None,
                 joints=None, parent=None, children=None, **kwargs):
        """build123d Compound(obj, label, color, material, joints, parent,
        children): obj is a raw TopoDS shape or shape(s) gathered into ONE
        compound; children= builds an ASSEMBLY - the children become the
        compound's anytree children (their .parent is this compound) and
        make up its geometry when no obj is given."""
        if obj is not None and not isinstance(obj, Shape) and \
                hasattr(obj, 'ShapeType'):
            obj = [obj]
        kids = _tolist(children) if children is not None else []
        source = obj if obj is not None else kids
        topos = [_topo(c) for c in _tolist(source)
                 if not (isinstance(c, Shape) and c.topo is None)]
        topo = None
        if len(topos) == 1:
            topo = topos[0]
        elif len(topos) > 1:
            topo = w.MakeCompound(topos)
        Shape.__init__(self, topo)
        self.label = label or ''
        if color is not None:
            self.color = color
        if material is not None and material != '':
            self.material = material
        self.children = []
        for kid in kids:
            if isinstance(kid, Shape):
                kid._parent = self
            self.children.append(kid)
        # Compound(..., joints=<dict>) — build123d's Compound.__init__ adopts a
        # joint dict and REPARENTS every joint onto the new compound. This is
        # how a Compound subclass built from a builder keeps the joints the
        # builder collected (tutorial_joints' Hinge).
        if joints:
            self.joints = {k: j._lite_rebind(self) for k, j in joints.items()}
        if parent is not None:
            self.parent = parent

    # upstream tags every topology class with its dimension (Shape._dim);
    # operations dispatch fillet/chamfer/offset on it. A generic Compound's
    # dimension follows its content.
    @property
    def _dim(self):
        if self.topo is None:
            return None
        if len(self.solids()) > 0:
            return 3
        if len(self.faces()) > 0:
            return 2
        return 1

    def get_type(self, obj_type):
        """This compound's DIRECT children of the given class — upstream
        Compound.get_type over TopoDS_Iterator: the faces inside a compound's
        solids (or the edges inside its faces) are NOT returned, unlike
        faces()/edges(). Lite avoids single-child compound layers, so a root
        that itself IS the requested type counts as the one direct child."""
        if self.topo is None:
            return ShapeList()

        def wrap(t):
            st = t.ShapeType().value
            if st == 2:
                return Solid(t)
            if st == 3:
                sh = object.__new__(Shell)
                Shape.__init__(sh, t)
                sh._face_shapes = None
                return sh
            if st == 4:
                return Face(t)
            if st == 5:
                return Wire(t)
            if st == 6:
                return Edge(t)
            if st == 7:
                return Vertex(t)
            return None

        # lite builds 1-D results as CHAINED WIRES and its algebra NESTS
        # compounds (Mixin1D.__add__ re-compounds the previous compound with
        # the new edge) where upstream's Curve wraps a FLAT compound of
        # edges. Both are packaging artifacts: a wire presents as its edges —
        # and ONLY as its edges (get_type(Wire) on upstream's compound-of-
        # edges is EMPTY; reporting the wire AND its edges would double the
        # geometry through build_common's typed[Edge] + typed[Wire] paths) —
        # and nested compounds flatten to their leaves, which is what
        # upstream's one-level iteration sees on its flat compounds.
        def expand(root):
            # iterative: Mixin1D.__add__'s LEFT-LEANING compound nesting can
            # be one level PER EDGE (a 20-segment mirrored profile is 20
            # compounds deep), so a fixed recursion cap silently DROPPED the
            # deeper leaves. Wires and compounds both present as their
            # children; everything else is a leaf.
            out = []
            stack = [root]
            while stack:
                t = stack.pop()
                st = t.ShapeType().value
                if st == 5 or st == 0:
                    kids = list(w.DirectChildren(t))
                    for i in range(len(kids) - 1, -1, -1):
                        stack.append(kids[i])
                else:
                    out.append(t)
            return out

        candidates = expand(self.topo)
        out = ShapeList()
        for t in candidates:
            s = wrap(t)
            if s is not None and isinstance(s, obj_type):
                out.append(s)
        return out

    @classmethod
    def make_text(cls, txt, font_size, font='Arial', font_path=None,
                  font_style=None,
                  text_align=('center', 'center'),  # TextAlign values
                  align=None, position_on_path=0.0, text_path=None,
                  single_line_width=None):
        """2D text as a compound of faces (build123d Compound.make_text).
        Like upstream, align defaults to None: only the Font_TextFormatter
        (advance-based) text_align applies, NOT bbox alignment.

        Enum arguments are normalized BY NAME so the upstream-source seam's
        metaclass-free enum members work here too (lite's FontStyle values
        ARE the member names; TextAlign values are their lowercase).
        single_line_width only matters for single-line STROKE fonts, which
        this build does not ship (outline FreeSans only) — accepted and
        ignored, like lite's own Text object."""
        def _byname(v, lower):
            n = getattr(v, 'name', None)
            if isinstance(n, str):
                return n.lower() if lower else n
            return v
        fs = _byname(font_style if font_style is not None
                     else FontStyle.REGULAR, False)
        ta = (_byname(text_align[0], True), _byname(text_align[1], True))
        t = Text(txt, font_size, font=font, font_path=font_path,
                 font_style=fs, text_align=ta, align=align,
                 path=text_path, position_on_path=position_on_path,
                 mode=Mode.PRIVATE)
        res = object.__new__(cls)
        Shape.__init__(res, t.topo)
        return res


def _adopt_solid_topo(topo):
    """Solid(Shell(faces)) sews the faces into a closed solid, and
    Solid(other_shape)/Part(other_shape) adopt the geometry — like
    build123d."""
    if isinstance(topo, Shape):
        fl = getattr(topo, '_face_shapes', None) \
            if isinstance(topo, Shell) else None
        if fl:
            return w.SewSolidFromFaces([_topo(f) for f in fl])
        return topo.topo
    return topo


def _apply_compound_kwargs(self, label, color, material, joints, parent,
                           children):
    """The tail of upstream Compound.__init__'s kwargs surface, shared by
    Part/Sketch (BasePartObject-style super().__init__ calls)."""
    self.label = label or ''
    if color is not None:
        self.color = color
    if material is not None and material != '':
        self.material = material
    if children:
        self.children = list(children)
        for kid in self.children:
            if isinstance(kid, Shape):
                kid._parent = self
    if joints:
        self.joints = {k: j._lite_rebind(self) for k, j in joints.items()}
    if parent is not None:
        self.parent = parent


class Part(Compound):
    """A Compound of solids (upstream identity: Part is a Compound subclass, distinct from
    Solid). Accepts lite's positional-topo form AND upstream Compound's kwargs
    ctor (obj=, label=, color=, material=, joints=, parent=, children=), which
    BasePartObject-style super().__init__ calls use."""

    _dim = 3

    def __init__(self, topo=None, obj=None, label='', color=None,
                 material=None, joints=None, parent=None, children=None,
                 **kwargs):
        if topo is None and obj is not None:
            topo = obj
        Shape.__init__(self, _adopt_solid_topo(topo))
        _apply_compound_kwargs(self, label, color, material, joints, parent,
                               children)


class Solid(Shape):
    """A SINGLE solid (upstream identity: Solid is NOT a Compound; .solids()
    returns these, and the make_* classmethods build them)."""

    _dim = 3

    def __init__(self, topo=None, obj=None, label='', color=None,
                 material=None, joints=None, parent=None, **kwargs):
        if topo is None and obj is not None:
            topo = obj
        Shape.__init__(self, _adopt_solid_topo(topo))
        if label:
            self.label = label
        if color is not None:
            self.color = color
        if material is not None:
            self.material = material
        if joints:
            self.joints = dict((k, j._lite_rebind(self))
                               for k, j in joints.items())
        if parent is not None:
            self.parent = parent

    @classmethod
    def extrude(cls, obj, direction):
        """Extrude a Face into a Solid (build123d Solid.extrude)."""
        d = Vector(direction)
        return cls(w.Extrude(_topo(obj), [d.X, d.Y, d.Z], True))

    @classmethod
    def make_sphere(cls, radius, plane=None, angle1=-90, angle2=90,
                    angle3=360):
        """A sphere solid; partial spheres go through the same
        BRepPrimAPI_MakeSphere two-latitude + longitude-sweep form the Sphere
        object uses (build123d Solid.make_sphere)."""
        if angle1 != -90 or angle2 != 90 or angle3 != 360:
            s = cls(w.PartialSphere(radius, angle1, angle2, angle3))
        else:
            s = cls(w.Sphere(radius))
        if plane is not None:
            s = plane * s
            s._loc = None  # the plane is BAKED (upstream keeps identity)
        return s

    @classmethod
    def make_cylinder(cls, radius, height, plane=None, angle=360):
        """A cylinder solid with its base on the given plane's origin,
        extending along the plane normal (build123d Solid.make_cylinder)."""
        if angle != 360:
            raise NotImplementedError(
                'partial cylinders are not supported in build123d-lite')
        s = cls(w.Cylinder(radius, height, False))
        if plane is not None:
            s = plane * s
            s._loc = None  # the plane is BAKED (upstream keeps identity)
        return s

    @classmethod
    def make_loft(cls, objs, ruled=False):
        """Loft through wires (build123d Solid.make_loft)."""
        wires = []
        for o in objs:
            t = _topo(o)
            wires.append(t if t.ShapeType().value == 5
                         else w.GetWire(t, 0, True))
        if ruled:
            return cls(w.Loft(wires, False, True))
        return cls(w.Loft(wires))

    @classmethod
    def revolve(cls, section, angle=360, axis=None, inner_wires=None):
        """Revolve a Face/Wire section about an Axis
        (build123d Solid.revolve)."""
        if axis is None:
            axis = Axis.Z
        sec = section if isinstance(section, Face) or not inner_wires \
            else Face(section, list(inner_wires))
        o = tuple(axis.position)
        d = list(axis.direction)
        topo = _topo(sec)
        shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Revolve(topo, angle, d)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        return cls(topo)

    @classmethod
    def thicken(cls, surface, depth, normal_override=None):
        """Thicken a Face/Shell into a Solid along its normals — the exact
        BRepOffset construction of build123d's Solid.thicken (full offset
        shell, GeomAbs_Intersection join)."""
        f = surface
        d = float(depth)
        if normal_override is not None and isinstance(f, Face):
            n = f.normal_at()
            if n.dot(Vector(normal_override).normalized()) < 0:
                d = -d
        return cls(w.ThickenSolid(_topo(f), d))

    @classmethod
    def extrude_linear_with_rotation(cls, section, center=(0, 0, 0),
                                     normal=(0, 0, 1), angle=0,
                                     inner_wires=None):
        """Twisted prism: sweep along a straight spine with a helical
        auxiliary spine — the exact MakePipeShell construction of
        build123d's Solid.extrude_linear_with_rotation."""
        c = _v3(center)
        nvec = Vector(normal)
        h = nvec.length
        spine = w.WireFromSegments([('line', [list(c),
                                              list(Vector(c) + nvec)])])
        pitch = 360.0 / angle * h
        hel = Helix(pitch, h, 1, center=c,
                    direction=tuple(nvec.normalized()), mode=Mode.PRIVATE)
        aux = w.WireFromSegments(_chain_segments(hel._specs))
        if isinstance(section, Face):
            outer = w._faceOuterWire(section.topo)
            inner = [x.topo for x in section.inner_wires()]
        else:
            outer = _topo(section)
            inner = [_topo(x) for x in _tolist(inner_wires)]
        solid = w.PipeShellSweep([outer], spine, False, '', [], aux, False)
        if inner:
            tools = [w.PipeShellSweep([iw], spine, False, '', [], aux, False)
                     for iw in inner]
            solid = w.Difference(solid, tools)
        return cls(solid)


class Sketch(Compound):
    """A Compound of faces (upstream identity: Sketch is a Compound subclass). Accepts
    lite's positional-topo form AND upstream Compound's kwargs ctor."""

    _dim = 2

    def __init__(self, topo=None, obj=None, label='', color=None,
                 material=None, joints=None, parent=None, children=None,
                 **kwargs):
        if topo is None and obj is not None:
            topo = obj
        Shape.__init__(self, topo)
        _apply_compound_kwargs(self, label, color, material, joints, parent,
                               children)


class Mixin1D(Shape):
    """Shared 1-D behavior (upstream Mixin1D): everything Edges, Wires and
    Curves answer — position_at/tangent_at/@/%/^, param_at_point, offset_2d,
    canonical(), segment-spec bookkeeping (_specs). Edge, Wire and Curve all
    subclass this; isinstance(x, Mixin1D) is lite's "any 1-D shape" test."""

    _dim = 1
    # A single-segment Curve (what the 1-D object constructors return) answers
    # the circular-arc queries of its one edge, like build123d's Mixin1D.
    @property
    def arc_center(self):
        return _single_edge_of(self).arc_center

    @property
    def radius(self):
        # the 1-D constructors (JernArc) record their defining radius; other
        # curves read it off their single circular edge
        if getattr(self, '_radius_attr', None) is not None:
            return self._radius_attr
        return _single_edge_of(self).radius

    @radius.setter
    def radius(self, value):
        self._radius_attr = value

    def find_intersection_points(self, other, tolerance=1e-6):
        return _single_edge_of(self).find_intersection_points(other, tolerance)

    def normal(self):
        """Normal of a PLANAR curve (build123d Mixin1D.normal): the conic's own
        axis direction for a circle/ellipse, otherwise the normal of the plane
        the curve lies in.

        The general branch substitutes for BRepLib_FindSurface: its Surface()
        comes back as an unbound handle in this build, so the plane is fitted
        from sampled points instead (exact for a genuinely planar curve, and
        the deviation of the samples from the fit is what decides whether the
        curve IS planar — upstream raises the same ValueError when it is not)."""
        edges = self.edges() if not isinstance(self, Edge) else [self]
        if not edges:
            raise ValueError("Can't find normal of empty edge/wire")
        axis_dir = w._edgeArcNormal(_topo(edges[0]))
        if axis_dir and len(edges) == 1:
            return Vector(tuple(axis_dir)).normalized()
        pts = []
        for e in edges:
            for i in range(5):
                pts.append(Vector(tuple(w._edgePointAt(_topo(e), i / 4.0))))
        centroid = Vector(0, 0, 0)
        for p in pts:
            centroid = centroid + p
        centroid = centroid * (1.0 / len(pts))
        normal, best = None, 0.0
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                cross = (pts[i] - centroid).cross(pts[j] - centroid)
                if cross.length > best:
                    normal, best = cross, cross.length
        if normal is None or best <= _TOL_1E6:
            raise ValueError('Normal not defined')
        normal = normal.normalized()
        span = max([(p - centroid).length for p in pts])
        for p in pts:
            if abs((p - centroid).dot(normal)) > _TOL_1E6 * max(1.0, span):
                raise ValueError('Normal not defined')
        return normal

    def __init__(self, topo=None, specs=None):
        if isinstance(topo, (list, tuple, ShapeList)):
            # Wire(edges) / Curve(edges): one chained wire from the edges.
            # Wire([]) is upstream's EMPTY wire (operations_generic builds one
            # as an offset() starting point).
            sp = []
            for it in topo:
                if isinstance(it, Mixin1D) and it._specs:
                    sp.extend(it._specs)
                elif isinstance(it, Shape):
                    sp.extend(_specs_from_topo_edges(it))
                else:
                    raise TypeError('Curve/Wire from a list expects edges')
            if len(sp) == 0:
                Shape.__init__(self, None)
                self._specs = []
                return
            chained = _chain_segments(sp)
            Shape.__init__(self, w.WireFromSegments(chained))
            self._specs = chained
            return
        Shape.__init__(self, topo)
        self._specs = list(specs) if specs else []

    def __add__(self, other):
        # curves concatenate their segment specs so make_face()/sweep() can
        # chain them exactly; the topo union still happens for display
        others = [o for o in _tolist(other) if not (isinstance(o, Shape) and o.topo is None)]
        specs = list(self._specs)
        for o in others:
            if isinstance(o, Mixin1D):
                specs.extend(o._specs)
        topos = [o.topo for o in others if o.topo is not None]
        if self.topo is not None:
            topos.insert(0, self.topo)
        if len(topos) == 0:
            return Curve(None, specs)
        topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos)
        return Curve(topo, specs)

    def _edge_chain(self):
        """This curve's edges in CONNECTION order: BRepTools_WireExplorer for
        a real wire (what build123d's BRepAdaptor_CompCurve follows), TopExp
        storage order for anything else."""
        if self.topo is not None and self.topo.ShapeType().value == 5:
            return list(w.OrderedEdges(self.topo))
        return list(w.Edges(self.topo).edges())

    def _chain_flips(self, es, ends):
        """Which of the chained edges have to be traversed BACKWARDS to run
        head-to-tail (see _walk for why the first edge is special-cased)."""
        flips = [False] * len(es)
        if len(es) > 1 and self.topo.ShapeType().value == 5:
            a0, a1 = ends[0]
            b0, b1 = ends[1]
            if min(math.dist(a0, b0), math.dist(a0, b1)) < \
                    min(math.dist(a1, b0), math.dist(a1, b1)):
                flips[0] = True
        for i in range(1, len(es)):
            prev_end = ends[i - 1][0] if flips[i - 1] else ends[i - 1][1]
            d_fwd = math.dist(prev_end, ends[i][0])
            d_rev = math.dist(prev_end, ends[i][1])
            flips[i] = d_rev < d_fwd
        return flips

    def param_at_point(self, point):
        """Normalized position (0..1) of point along this wire: the arc
        length from the wire's start to the point, over the wire's total length
        (build123d Wire.param_at_point, which walks the wire in
        BRepTools_WireExplorer order accumulating edge lengths)."""
        es = self._edge_chain()
        pt = list(_v3(point))
        if len(es) == 1:
            return Edge(es[0]).param_at_point(pt)
        lens = [w._edgeLength(e) for e in es]
        ends = [(tuple(w._edgePointAt(e, 0.0)), tuple(w._edgePointAt(e, 1.0)))
                for e in es]
        flips = self._chain_flips(es, ends)
        total = sum(lens)
        best, best_dist = None, None
        acc = 0.0
        for i, e in enumerate(es):
            d = w._edgeDistanceToPoint(e, pt)
            if best_dist is None or d < best_dist:
                u = w._edgeParamAtPoint(e, pt)
                if u < 0.0:   # not ON this edge — snap to the nearer end
                    u = 0.0 if math.dist(tuple(w._edgePointAt(e, 0.0)),
                                         tuple(pt)) < \
                        math.dist(tuple(w._edgePointAt(e, 1.0)), tuple(pt)) \
                        else 1.0
                if flips[i]:
                    u = 1.0 - u
                best, best_dist = (acc + u * lens[i]), d
            acc += lens[i]
        if best_dist is None or best_dist > _TOL_1E6:
            raise ValueError('point ' + repr(tuple(pt)) + ' is ' +
                             repr(best_dist) + ' from this wire')
        return best / total if total > 0 else 0.0

    def _walk(self, u, tangent):
        """Evaluate position/tangent at length-fraction u along the (possibly
        multi-edge) curve, orienting each edge to chain head-to-tail."""
        es = self._edge_chain()
        if len(es) == 1:
            fn = w._edgeTangentAt if tangent else w._edgePointAt
            return Vector(tuple(fn(es[0], float(u))))
        lens = [w._edgeLength(e) for e in es]
        ends = [(tuple(w._edgePointAt(e, 0.0)), tuple(w._edgePointAt(e, 1.0)))
                for e in es]
        # orient edges into a chain (WireFromSegments adds them in order,
        # but individual edges may run tip-to-tail reversed). In a real WIRE
        # the edges above are in CONNECTION order, so the only ambiguity left
        # is the first edge's raw parametrization direction — flip it when its
        # start (not its end) is what touches the second edge. (For a COMPOUND
        # of edges the order itself is arbitrary, and the greedy chaining
        # starting from edge 0 as-is is what matches build123d's
        # BRepAdaptor_CompCurve there.)
        flips = self._chain_flips(es, ends)
        total = sum(lens)
        target = max(0.0, min(1.0, float(u))) * total
        acc = 0.0
        for i, e in enumerate(es):
            if target <= acc + lens[i] + 1e-12 or i == len(es) - 1:
                v = (target - acc) / lens[i] if lens[i] > 0 else 0.0
                if flips[i]:
                    v = 1.0 - v
                fn = w._edgeTangentAt if tangent else w._edgePointAt
                res = Vector(tuple(fn(e, v)))
                if tangent and flips[i]:
                    res = -res
                return res
            acc += lens[i]
        raise ValueError('curve evaluation failed')

    def __matmul__(self, u):  # curve @ u -> position
        return self._walk(u, False)

    def __mod__(self, u):  # curve % u -> tangent
        return self._walk(u, True)

    def position_at(self, u):
        """Point at length-fraction u along the wire (build123d
        Mixin1D.position_at; Edge overrides it to be orientation-aware)."""
        return self._walk(u, False)

    def tangent_at(self, u=0.5):
        # upstream tangent_at also accepts a POINT on the shape
        return self._walk(self._to_param(u), True)

    def location_at(self, u, x_dir=None):
        """Location at length-fraction u: origin on the curve, z along the
        tangent (build123d convention for sweep section placement)."""
        pos = self._walk(u, False)
        tan = self._walk(u, True)
        if x_dir is not None:
            pl = Plane(pos, x_dir=Vector(x_dir), z_dir=tan)
        else:
            pl = Plane(pos, z_dir=tan)
        return pl.location

    def __xor__(self, u):  # curve ^ u -> location
        return self.location_at(u)

    def _to_param(self, value):
        """A float position stays as it is; a point becomes its normalized
        position along this shape (build123d Mixin1D._to_param)."""
        if isinstance(value, (int, float)):
            return float(value)
        return self.param_at_point(value)

    def derivative_at(self, position, order=2):
        """The order-th derivative of the underlying curve at the normalized
        position (build123d Mixin1D.derivative_at). NOT normalized: the
        magnitude is the curve's natural speed, which is what BlendCurve's
        tangent_scalars scale. Odd orders follow the shape's orientation."""
        u = self._to_param(position)
        es = self._edge_chain()
        if len(es) == 1:
            # like position_at, a REVERSED edge is traversed the other way
            # (upstream's _occt_param_at maps u -> 1 - u before evaluating)
            forward = bool(w._edgeIsForward(es[0]))
            edge, local_u, flipped = es[0], (u if forward else 1.0 - u), False
        else:
            lens = [w._edgeLength(e) for e in es]
            ends = [(tuple(w._edgePointAt(e, 0.0)),
                     tuple(w._edgePointAt(e, 1.0))) for e in es]
            flips = self._chain_flips(es, ends)
            total = sum(lens)
            target = max(0.0, min(1.0, u)) * total
            acc = 0.0
            edge, local_u, flipped = es[-1], 1.0, flips[-1]
            for i, e in enumerate(es):
                if target <= acc + lens[i] + 1e-12 or i == len(es) - 1:
                    local_u = (target - acc) / lens[i] if lens[i] > 0 else 0.0
                    if flips[i]:
                        local_u = 1.0 - local_u
                    edge, flipped = e, flips[i]
                    break
                acc += lens[i]
        d = Vector(tuple(w._edgeDerivativeAt(edge, float(local_u), int(order))))
        reverse = flipped if len(es) > 1 else not bool(w._edgeIsForward(es[0]))
        if order % 2 == 1 and reverse:
            d = -d
        return d

    def trim(self, start, end):
        """A new Edge keeping only the section between two normalized
        positions, which may be given as POINTS on the curve (build123d
        Edge.trim)."""
        return _single_edge_of(self).trim(start, end)

    def curvature_comb(self, count=100, max_tooth_size=None):
        """The curvature comb of a planar (XY) curve: short line Edges erected
        along the left normal, their length proportional to the signed
        curvature (build123d Mixin1D.curvature_comb, ported statement for
        statement)."""
        closed = bool(self.is_closed) if hasattr(self, 'is_closed') else False
        # numpy's linspace(0, 1, count, endpoint=not closed)
        if closed:
            u_values = [i / count for i in range(count)]
        else:
            u_values = [i / (count - 1) for i in range(count)] if count > 1 \
                else [0.0]
        kappas, tangents = [], []
        for u in u_values:
            tangent = self.derivative_at(u, 1)
            curvature = self.derivative_at(u, 2)
            tangents.append(tangent)
            cross = tangent.cross(curvature)
            kappa = cross.length / (tangent.length ** 3 + _TOL_1E6)
            kappas.append(kappa if cross.Z >= 0 else -kappa)
        max_kappa_size = max([_TOL_1E6] + [abs(k) for k in kappas])
        curve_size = max(tuple(self.bounding_box().size))
        tooth = max_tooth_size if max_tooth_size is not None else curve_size / 10
        scale_factor = tooth / max_kappa_size
        out = ShapeList()
        for i in range(len(u_values)):
            length = scale_factor * kappas[i]
            if abs(length) < _TOL_1E6:
                continue
            pnt = self._walk(u_values[i], False)
            kappa_dir = tangents[i].normalized().cross(Vector(0, 0, 1))
            out.append(Edge.make_line(pnt, pnt + kappa_dir * length))
        return out

    def common_plane(self, *lines, tolerance=1e-6):
        """The plane containing this and the given edges/wires, or None
        (build123d Mixin1D.common_plane, including its CPython-set-order
        choice of normal sign - see _cpy_set_order)."""
        return _common_plane([self] + list(lines), tolerance)

    @property
    def convexity(self):
        """How the shape this edge was selected from sits around it
        (build123d 0.12 Mixin1D.convexity): the dihedral crease between its
        two faces in topo_parent, sampled along the edge; a seam is SMOOTH."""
        parent = self.topo_parent
        if parent is None or getattr(parent, 'topo', None) is None:
            raise ValueError('edge has no valid parent')
        try:
            name = w.EdgeConvexity(self.topo, _topo(parent))
        except Exception as exc:
            raise ValueError(_js_error_text(exc))
        return Convexity._of(name)

    def reversed(self):
        """A copy of this Edge/Wire with the opposite orientation
        (build123d Edge.reversed - the OCCT orientation flag, not a rebuild)."""
        return _reverse_1d(self)

    def canonical(self):
        """This shape with a CANONICAL parametrization: the same geometry, but
        with a start point and a traversal direction determined by the geometry
        alone instead of by the CAD kernel's construction history
        (build123d Mixin1D.canonical - see the canonical_form() rule above).

        Free edges - the ones produced by cut/intersect/section/project_to_shape
        rather than drawn by the user - inherit the seam, direction and
        parameter range the kernel found convenient, so two geometrically
        identical solids can yield section edges that start in different places
        and run in opposite directions. Anything measured from position_at(0),
        tangent_at or Axis(edge) then moves with them.

        Open shapes keep their type; a closed shape that has to be re-seamed
        comes back as a single Edge, because a closed Wire has no distinguished
        start point for position_at to key off."""
        form = self.canonical_form()

        if not form.closed:
            return self if form.sign > 0 else _reverse_1d(self)

        # The seam is a position on a loop, so "is it already at the start?" is a
        # question about the CIRCULAR distance: a band midpoint that lands an
        # epsilon BELOW 1.0 is the same point as one an epsilon above 0.0. The
        # comparison is made at the resolution the seam is actually defined to -
        # the width of the extremal band - because asking for more precision than
        # that would re-seam a shape by a few nanometres, over and over.
        box = self.bounding_box()
        diagonal = max(box.size.X, box.size.Y, box.size.Z)
        relative_tolerance = (max(_TOL_1E6, CANONICAL_BAND * diagonal) /
                              max(self.length, _TOL_1E6))
        wrapped_start = form.start % 1.0
        if min(wrapped_start, 1.0 - wrapped_start) <= relative_tolerance:
            # Already seamed here: at most the direction needs flipping, which
            # keeps the original topology and curve types.
            return self if form.sign > 0 else _reverse_1d(self)

        seam = self.position_at(form.start)
        direction = self.tangent_at(form.start) * form.sign
        ordered = _walk_loop(_split_1d_at_point(self, seam), seam, direction)
        return _concatenate_edges(ordered)

    def canonical_form(self, samples=CANONICAL_SAMPLES):
        """The canonical start position (normalized) and direction sign of this
        shape, without rebuilding it (build123d Mixin1D.canonical_form)."""
        length = self.length
        if length <= _TOL_1E6:
            return CanonicalForm(0.0, 1, False)
        closed = (self.position_at(0) - self.position_at(1)).length <= _TOL_1E6

        def sampler(distance):
            return self.position_at(min(max(distance / length, 0.0), 1.0))

        return _canonical_form(sampler, length, closed, samples=samples)

    def project_to_shape(self, target_object, direction=None, center=None):
        """Project this wire onto the surfaces of a shape, either along a
        direction or conically from a center point (pass exactly one) —
        BRepProj_Projection, like build123d's Wire.project_to_shape. One or
        more wires come back, nearest projection first."""
        if (direction is None) == (center is None):
            raise ValueError('Provide exactly one of direction or center')
        d = list(Vector(direction).normalized()) if direction is not None \
            else None
        c = list(Vector(center)) if center is not None else None
        out = w.ProjectWireOnShape(_topo(self), _topo(target_object), d, c)
        return ShapeList([Wire(t) for t in out])

    @property
    def is_closed(self):
        """Whether the wire/edge closes on itself (BRep_Tool::IsClosed)."""
        if self.topo is None:
            return False
        return bool(w._wireIsClosed(self.topo))

    def offset_2d(self, distance, kind=Kind.ARC, side=Side.BOTH, closed=True):
        """2D offset of this planar wire (build123d Wire.offset_2d).
        side=LEFT/RIGHT keeps only one side of the offset of an OPEN wire
        (the end caps and the other side are dropped); closed=True then joins
        that side back to the original line to make a closed region."""
        if kind == Kind.TANGENT:
            raise NotImplementedError('Kind.TANGENT offsets are not supported '
                                      'in build123d-lite')
        join = 'intersection' if kind == Kind.INTERSECTION else 'arc'
        line = self
        edges = line.edges()
        if len(edges) == 1:
            # BRepOffsetAPI_MakeOffset mishandles a single-edge wire, so split
            # it in half first (exactly build123d's workaround)
            halves = [edges[0].trim(0.0, 0.5), edges[0].trim(0.5, 1.0)]
            src = w.WireFromEdgesFixed([_topo(h) for h in halves], 1e-7)
        else:
            src = _topo(line)
        offset_topo = w.OffsetPlanarWire(src, distance, join)
        if offset_topo is None:
            raise RuntimeError('2D offset produced no wire')
        offset_wire = Wire(offset_topo)
        if side == Side.BOTH:
            oes = offset_wire.edges()
            return oes[0] if len(oes) == 1 else offset_wire

        # drop the semicircular end caps, then keep the side asked for
        endpoints = (line.position_at(0), line.position_at(1))

        def _is_end_cap(e):
            if e.geom_type != GeomType.CIRCLE:
                return False
            c = e.arc_center
            for pt in endpoints:
                if (c - pt).length < _TOL_1E6:
                    return True
            return False

        sides = edges_to_wires(offset_wire.edges().filter_by(_is_end_cap,
                                                            reverse=True))
        if len(sides) != 2:
            raise RuntimeError('one-sided offset expected two offset sides, '
                               'got ' + repr(len(sides)))
        tan0 = line.tangent_at(0)
        angles = [tan0.get_signed_angle(wr.position_at(0.5) - endpoints[0])
                  for wr in sides]
        if side == Side.LEFT:
            offset_wire = sides[int(angles[0] > angles[1])]
        else:
            offset_wire = sides[int(angles[0] <= angles[1])]

        if closed:
            self0, self1 = endpoints
            end0 = offset_wire.position_at(0)
            end1 = offset_wire.position_at(1)
            if (self0 - end0).length - abs(distance) <= _TOL_1E6:
                edge0 = Edge.make_line(self0, end0)
                edge1 = Edge.make_line(self1, end1)
            else:
                edge0 = Edge.make_line(self0, end1)
                edge1 = Edge.make_line(self1, end0)
            joined = list(line.edges()) + list(offset_wire.edges()) + \
                [edge0, edge1]
            offset_wire = Wire(w.WireFromEdgesFixed(
                [_topo(e) for e in joined], _TOL_1E6))

        oes = offset_wire.edges()
        return oes[0] if len(oes) == 1 else offset_wire

    def order_edges(self):
        """The edges in CONNECTION order (build123d Wire.order_edges —
        BRepTools_WireExplorer, not TopExp's storage order)."""
        return ShapeList([Edge(t) for t in w.OrderedEdges(self.topo)])

    @property
    def start_point(self):
        return self @ 0

    @property
    def end_point(self):
        return self @ 1

    @classmethod
    def make_polygon(cls, pts, close=True):
        """Closed polygonal wire through pts (build123d Wire.make_polygon).
        Callers often pass an EXPLICITLY closed point list (last == first,
        e.g. RegularPolygon's side_count+1 points); combined with close=True
        that produced a zero-length edge, and a face bounded by a degenerate
        edge extrudes into a solid this kernel's booleans silently ignore —
        drop the duplicate endpoint first."""
        vs = [tuple(_v3(p)) for p in pts]
        if close and len(vs) > 2:
            d = Vector(vs[0]) - Vector(vs[-1])
            if d.length <= 1e-9:
                vs = vs[:-1]
        return Polyline(*vs, close=close, mode=Mode.PRIVATE)


def _wire_combine(cls, wires, tol=1e-9):
    """Group edges/wires into the largest possible wires (build123d
    Wire.combine): the same connectivity grouping edges_to_wires does, which is
    what ShapeAnalysis_FreeBounds::ConnectEdgesToWires computes upstream."""
    edges = []
    for item in _tolist(wires):
        edges.extend(item.edges() if not isinstance(item, Edge) else [item])
    return edges_to_wires(edges, max(tol, 1e-9))


Mixin1D.combine = classmethod(_wire_combine)


class Wire(Mixin1D):
    """A connected sequence of edges — ONE wire (upstream identity: a real
    class distinct from Edge and from Curve). Wire(edges) chains them into a
    single wire; Wire(topo) wraps a TopoDS wire; Wire([]) is empty."""

    @classmethod
    def make_circle(cls, radius, plane=None):
        """A closed circular wire (build123d Wire.make_circle); the worker's
        Circle(r, wire=True) is a TopoDS_Wire in the XY plane."""
        res = cls(w.Circle(radius, True))
        if plane is not None:
            res = plane.location * res
        return res


class Curve(Mixin1D, Compound):
    """The 1-D algebra accumulator (upstream identity: a Compound OF 1-D
    shapes). Lite's 1-D object constructors return Curves; all construction
    and behavior live on Mixin1D (its __init__ wins the MRO on every
    runtime — CPython C3 and MicroPython's depth-first lookup agree because
    Compound never overrides a Mixin1D name)."""


def _single_edge_of(curve):
    """The one edge of a single-segment Curve (build123d's 1-D objects return
    Curves whose circular-arc properties read through to that edge)."""
    es = curve.edges()
    if len(es) != 1:
        raise ValueError('this property is only defined for a single edge, '
                         'this curve has ' + str(len(es)))
    return es[0]


class Edge(Mixin1D):
    def __init__(self, topo, parent=None, index=None):
        Mixin1D.__init__(self, topo)
        if parent is not None:
            self._extracted_from(parent)
        self.index = index

    @property
    def geom_type(self):
        t = w._edgeCurveType(self.topo)
        for name in ('LINE', 'CIRCLE', 'ELLIPSE', 'HYPERBOLA', 'PARABOLA',
                     'BEZIER', 'BSPLINE', 'OTHER'):
            if t in getattr(GeomType, name):
                return getattr(GeomType, name)
        return GeomType.OTHER

    @property
    def length(self):
        return w._edgeLength(self.topo)

    def center(self, center_of=CenterOf.GEOMETRY):
        return Vector(tuple(w._edgeMidpoint(self.topo)))

    def _edge_topo(self):
        return self.topo

    @property
    def is_forward(self):
        return bool(w._edgeIsForward(self.topo))

    def find_intersection_points(self, other, tolerance=1e-6):
        """Points where this 2-D edge crosses an Axis or another Edge
        (build123d Edge.find_intersection_points - the 1-D form, distinct from
        Shape's ray/surface intersection).

        Upstream lifts both curves onto their common plane and calls
        Geom2dAPI_InterCurveCurve; that needs BRep_Tool::CurveOnPlane, which is
        unbound here, so the crossing is solved on the signed distance to the
        other curve's line: sample the arc-length parametrization, then bisect
        every sign change. Exact to tolerance for the analytic line/arc cases
        the constructors use."""
        if hasattr(other, 'position') and hasattr(other, 'direction'):
            base = Vector(other.position)
            d = Vector(other.direction).normalized()
        else:
            o = other.edges()[0] if not isinstance(other, Edge) else other
            if o.geom_type != GeomType.LINE and \
                    self.geom_type == GeomType.LINE:
                # the sampled solver treats OTHER as a straight line (its
                # chord) - wrong for a curved other. The intersection set is
                # symmetric, so sample the CURVED side against the line
                # instead (PolarLine's length=<arc> limit hit the arc's
                # chord otherwise).
                return o.find_intersection_points(self, tolerance)
            base = o.position_at(0)
            d = (o.position_at(1) - base).normalized()
        # signed perpendicular offset of the sampled point from the line,
        # in the plane spanned by d and the sampling normal
        def offset(u):
            q = Vector(tuple(w._edgePointAt(self.topo, float(u))))
            r = q - base
            along = r.dot(d)
            perp = r - d * along
            # sign from the 2-D cross product about z (planar edges)
            sign = 1.0 if (d.X * r.Y - d.Y * r.X) >= 0 else -1.0
            return sign * perp.length

        n = 512
        roots = []
        prev_u, prev = 0.0, offset(0.0)
        if abs(prev) < tolerance:
            roots.append(0.0)
        for i in range(1, n + 1):
            u = i / n
            cur = offset(u)
            if abs(cur) <= tolerance:
                # contact WITHOUT a sign change: an end point sitting on the
                # line, or a tangency. Upstream's Geom2dAPI_InterCurveCurve is
                # tolerance-based and reports these, so the sampled search has
                # to as well (the wing example's trailing edge ends exactly on
                # the axis it is measured against).
                if not any(abs(u - r) < 1e-9 for r in roots):
                    roots.append(u)
            if (prev <= 0.0 <= cur) or (cur <= 0.0 <= prev):
                lo, hi, flo = prev_u, u, prev
                for _ in range(60):
                    mid = (lo + hi) / 2.0
                    fm = offset(mid)
                    if (flo <= 0.0) == (fm <= 0.0):
                        lo, flo = mid, fm
                    else:
                        hi = mid
                root = (lo + hi) / 2.0
                if not any(abs(root - r) < 1e-9 for r in roots):
                    roots.append(root)
            prev_u, prev = u, cur
        out = ShapeList()
        for r in roots:
            p = Vector(tuple(w._edgePointAt(self.topo, float(r))))
            # reject near-misses: the point must really lie on the line
            rel = p - base
            if (rel - d * rel.dot(d)).length <= max(tolerance, 1e-6) * 100:
                out.append(p)
        return out

    @property
    def radius(self):
        """Radius of a circular edge (build123d Edge.radius)."""
        r = w._edgeArcRadius(self.topo)
        if r is None:
            raise ValueError('radius is only defined for circles')
        return r

    @property
    def is_interior(self):
        """Is this a CONCAVE edge of the shape it was selected from (build123d
        0.12: convexity == Convexity.CONCAVE)."""
        return self.convexity == Convexity.CONCAVE

    def find_tangent(self, angle):
        """The normalized parameters at which this edge's tangent is at 'angle'
        degrees to the local x axis (build123d Edge.find_tangent)."""
        tangent = math.tan(math.radians(angle))
        out = []
        # upstream solves the 2-D tangent condition on the curve; lite scans
        # the arc-length parametrization and bisects each sign change
        def f(u):
            t = w._edgeTangentAt(self.topo, float(u))
            if abs(t[0]) < 1e-12:
                return None
            return t[1] / t[0] - tangent
        n = 512
        prev_u, prev = 0.0, f(0.0)
        for i in range(1, n + 1):
            u = i / n
            cur = f(u)
            if prev is not None and cur is not None and \
                    ((prev <= 0.0 <= cur) or (cur <= 0.0 <= prev)):
                lo, hi, flo = prev_u, u, prev
                for _ in range(60):
                    mid = (lo + hi) / 2.0
                    fm = f(mid)
                    if fm is None:
                        break
                    if (flo <= 0.0) == (fm <= 0.0):
                        lo, flo = mid, fm
                    else:
                        hi = mid
                root = (lo + hi) / 2.0
                if not any(abs(root - r) < 1e-6 for r in out):
                    out.append(root)
            prev_u, prev = u, cur
        return out

    @property
    def arc_center(self):
        """Center of a circular/elliptical edge (build123d Edge.arc_center)."""
        c = w._edgeArcCenter(self.topo)
        if c is None:
            raise ValueError('arc_center is only defined for circles and '
                             'ellipses')
        return Vector(tuple(c))

    def position_at(self, u):
        # orientation-aware like build123d (Axis(edge) stays raw-curve).
        # COMPROMISE(edge-orientation): which end of a selector edge is
        # FORWARD depends on the CONSTRUCTION history of the shape, and lite
        # builds its shapes through different operations than upstream (the
        # kernel is not the cause: native build123d on OCP 7.9.3 and on OCP
        # 8.0.1 agree byte for byte, and upstream's own topology on this same
        # wasm kernel matches them) — scripts that measure along Axis(edge)
        # of a selected edge (the joints examples) can land at the other end.
        uu = u if self.is_forward else 1.0 - u
        return Vector(tuple(w._edgePointAt(self.topo, float(uu))))

    def tangent_at(self, u=0.5):
        u = self._to_param(u)   # upstream tangent_at also accepts a POINT
        uu = u if self.is_forward else 1.0 - u
        t = Vector(tuple(w._edgeTangentAt(self.topo, float(uu))))
        return t if self.is_forward else -t

    def __matmul__(self, u):
        return self.position_at(u)

    def __mod__(self, u):
        return self.tangent_at(u)

    def project_to_shape(self, target_object, direction=None, center=None):
        """The projected EDGES of this edge on a shape (build123d
        Edge.project_to_shape flattens the projected wires to edges)."""
        wires = Curve.project_to_shape(self, target_object, direction, center)
        return wires.edges()

    def param_at(self, position=0.5):
        """The raw OCCT curve parameter at the normalized ARC-LENGTH position
        (build123d Edge.param_at; positions outside [0, 1] extrapolate)."""
        return w._edgeParam(self.topo, float(position))

    def param_at_point(self, point):
        """Normalized parameter (0..1) of the point on this edge closest to
        point (build123d Edge.param_at_point: vertex snap, then
        GeomAPI_ProjectPointOnCurve validated by re-evaluation, then a bounded
        numeric search — all three inside _edgeParamAtPoint)."""
        u = w._edgeParamAtPoint(self.topo, list(_v3(point)))
        if u < 0.0:
            raise ValueError('point ' + repr(tuple(_v3(point))) +
                             ' is not on this edge')
        return u

    def trim(self, start, end):
        """A new edge keeping only the section between two normalized
        arc-length positions, each of which may be given as a POINT on the
        edge instead (build123d Edge.trim)."""
        start_u = self._to_param(start)
        end_u = self._to_param(end)
        trimmed = Edge(w.TrimEdge(self.topo, float(min(start_u, end_u)),
                                  float(max(start_u, end_u))))
        # keep the requested direction (upstream rebuilds it reversed)
        start_point = self.position_at(start_u)
        same_start = (trimmed.position_at(0) - start_point).length < _TOL_1E6
        same_direction = self.tangent_at(start_u).dot(
            trimmed.tangent_at(0)) > 1 - _TOL_1E6
        if same_start and same_direction:
            return trimmed
        return _reverse_1d(trimmed)

    def trim_to_other(self, other):
        """The SHORTEST piece of this edge trimmed at its intersections with
        other, or None when they do not intersect (build123d
        Edge.trim_to_other)."""
        points = self.find_intersection_points(other)
        if not points:
            return None
        trims = ShapeList([self.trim(0.0, p) for p in points])
        return trims.sort_by(Edge.length)[0]

    def _extend_spline(self, at_start, surface_face, extension_factor=0.1):
        """A copy of this B-spline edge extended past one end by
        extension_factor of its length and snapped back onto the surface
        (build123d Edge._extend_spline)."""
        if self.geom_type != GeomType.BSPLINE:
            raise TypeError('_extend_spline only works with splines')
        topo = w.ExtendSplineOnFace(self.topo, bool(at_start),
                                    _topo(surface_face),
                                    float(extension_factor))
        if topo is None:
            raise RuntimeError('Failed to snap extended edge to surface')
        return Edge(topo)

    @classmethod
    def make_spline(cls, points, tangents=None, periodic=False,
                    parameters=None, scale=True, tol=1e-6):
        """Edge interpolating the points EXACTLY (GeomAPI_Interpolate, like
        build123d's Edge.make_spline). tangents are either the two end
        tangents or one per point."""
        pts = [list(_v3(p)) for p in points]
        tans = [list(_v3(t)) for t in tangents] if tangents else []
        return cls(w.InterpolatedEdge(pts, tans, bool(periodic), bool(scale)))

    @classmethod
    def make_circle(cls, radius, plane=None, start_angle=360.0,
                    end_angle=360.0, angular_direction=None):
        """Full circle or circular arc edge (build123d Edge.make_circle).
        A full circle is the default (start_angle == end_angle). A CLOCKWISE
        arc runs from start_angle DOWN to end_angle: geometrically the
        complement span, traversed backwards (GC_MakeArcOfCircle's
        sense=False) - CenterArc(_, _, 135, -135) covers [0..135] deg, not
        [135..360]."""
        if plane is None:
            plane = Plane.XY
        cw = getattr(angular_direction, 'name',
                     angular_direction) == 'CLOCKWISE'
        a0, a1 = float(start_angle), float(end_angle)
        partial = (a0 % 360.0) != (a1 % 360.0)
        if cw and partial:
            span = (a0 - a1) % 360.0
            a0 = a1 % 360.0
            a1 = a0 + span
        topo = w.CircularEdge(float(radius), a0, a1,
                              list(plane.origin), list(plane.z_dir),
                              list(plane.x_dir))
        edge = cls(topo)
        return _reverse_1d(edge) if cw and partial else edge

    @classmethod
    def make_ellipse(cls, x_radius, y_radius, plane=None, start_angle=360.0,
                     end_angle=360.0, angular_direction=None):
        """Full ellipse or elliptical arc edge (build123d
        Edge.make_ellipse): a full ellipse by default (start == end); a
        CLOCKWISE arc is the CCW arc over the same span traversed backwards."""
        if plane is None:
            plane = Plane.XY
        cw = getattr(angular_direction, 'name',
                     angular_direction) == 'CLOCKWISE'
        a0, a1 = float(start_angle), float(end_angle)
        if (a0 % 360.0) == (a1 % 360.0):
            a0, a1 = 0.0, 360.0
        elif cw:
            a0, a1 = a1, a0
        if a1 <= a0:
            a1 += 360.0
        spec = _ellipse_arc_spec((0.0, 0.0, 0.0), x_radius, y_radius, a0, a1,
                                 0.0)
        local = Curve(w.WireFromSegments(_chain_segments([spec])), [spec])
        edge = cls(_single_edge_of(plane.location * local).topo)
        return _reverse_1d(edge) if cw else edge

    @classmethod
    def make_three_point_arc(cls, p1, p2, p3):
        """Circular arc through three points (build123d
        Edge.make_three_point_arc / GC_MakeArcOfCircle)."""
        wire = w.WireFromSegments([('arc3', [list(_v3(p1)), list(_v3(p2)),
                                             list(_v3(p3))])])
        return Curve(wire).edges()[0]

    def split(self, plane, keep=None):
        """The part of this edge on the +z_dir side of a plane (build123d
        Mixin1D.split, Keep.TOP default). Returns None when nothing is left."""
        pieces = []
        u = _edge_plane_crossing(self, plane)
        if u is None:
            side = plane.to_local_coords(self.position_at(0.5)).Z
            return self if side >= -_TOL_1E6 else None
        for a, b in ((0.0, u), (u, 1.0)):
            if b - a <= _TOL_1E6:
                continue
            piece = self.trim(a, b)
            mid = plane.to_local_coords(piece.position_at(0.5)).Z
            if mid >= -_TOL_1E6:
                pieces.append(piece)
        if not pieces:
            return None
        return pieces[0] if len(pieces) == 1 else pieces

    @classmethod
    def make_line(cls, p1, p2):
        """Linear edge between two points (build123d Edge.make_line)."""
        seg = ('line', [list(_v3(p1)), list(_v3(p2))])
        wire = w.WireFromSegments([seg])
        edges = list(w.Edges(wire).edges())
        return cls(edges[0])

    @classmethod
    def make_mid_way(cls, first, second, middle=0.5):
        """Linear edge a fractional distance between two edges
        (build123d Edge.make_mid_way, flip-aware).

        The direction and start point of the two reference edges are incidental
        - a section edge starts wherever the kernel's intersector happened to
        seam it - so the ends are paired up CANONICALLY instead of from the
        construction history (the is_opposite() flip below is kept for
        reference edges that are not parallel)."""
        first, second = first.canonical(), second.canonical()
        flip = Axis(first, canonical=True).is_opposite(
            Axis(second, canonical=True))
        pnts = []
        for i in (0.0, 1.0):
            a = first.position_at(i)
            b = second.position_at(1.0 - i if flip else i)
            pnts.append(a + (b - a) * middle)
        return cls.make_line(pnts[0], pnts[1])


# --------------------------------- canonical 1D shape rebuilding helpers ---
# build123d's one_d.py module-level helpers behind Mixin1D.canonical().

def _reverse_1d(shape):
    """A copy of an Edge or Wire that is traversed in the opposite direction.

    An Edge only needs its orientation flag flipped, which Edge.position_at
    honours. A Wire needs more: lite's Curve._walk follows
    BRepTools_WireExplorer's edge order and ignores the wire's own orientation
    flag (upstream's Wire.position_at goes through _occt_param_at and does
    honour it), so flipping the flag alone would silently leave position_at
    unchanged - which is exactly the kind of noise-level failure the canonical
    rule exists to remove. Rebuilding the wire from its edges in REVERSE order,
    each individually reversed, is the same geometry with a genuinely reversed
    traversal. A single-edge wire cannot express it at all, so it comes back as
    an Edge (which can)."""
    if isinstance(shape, Edge):
        return Edge(w.ReverseEdgeOrWire(_topo(shape)))
    edges = list(shape.order_edges())
    if len(edges) == 1:
        return Edge(w.ReverseEdgeOrWire(edges[0].topo))
    return Wire(w.WireFromEdgesFixed(
        [w.ReverseEdgeOrWire(e.topo) for e in edges[::-1]], _TOL_1E6))


def _edge_plane_crossing(edge, plane, samples=64):
    """The normalized parameter at which an edge crosses a plane (the sign of
    the LOCAL z flips), refined by bisection; None when it never crosses."""
    def height(u):
        return plane.to_local_coords(edge.position_at(u)).Z
    prev_u, prev_h = 0.0, height(0.0)
    for i in range(1, samples + 1):
        u = i / samples
        h = height(u)
        if (prev_h < 0.0) != (h < 0.0):
            lo, hi = prev_u, u
            for _ in range(60):
                mid = (lo + hi) / 2.0
                if (height(lo) < 0.0) != (height(mid) < 0.0):
                    hi = mid
                else:
                    lo = mid
            return (lo + hi) / 2.0
        prev_u, prev_h = u, h
    return None


def _split_1d_at_point(shape, point):
    """The Edges of shape, with the one that contains point split there."""
    pieces = []
    pt = list(point)
    for edge in shape.edges():
        ends_at_point = min((edge.position_at(0) - point).length,
                            (edge.position_at(1) - point).length)
        if ends_at_point > _TOL_1E6 and \
                w._edgeDistanceToPoint(edge.topo, pt) <= _TOL_1E6:
            parameter = w._edgeParamAtPoint(edge.topo, pt)
            if parameter >= 0.0 and \
                    _TOL_1E6 < parameter * edge.length < edge.length - _TOL_1E6:
                pieces.append(edge.trim(0.0, parameter))
                pieces.append(edge.trim(parameter, 1.0))
                continue
        pieces.append(edge)
    return pieces


def _walk_loop(pieces, start, direction):
    """Order and orient pieces into a chain that leaves start heading along
    direction, purely by matching end points."""
    remaining = list(pieces)
    # the requested start comes from a sampled parameter, so allow a gap that
    # scales with the size of the loop
    gap_tolerance = max(_TOL_1E6, 1e-6 * sum(piece.length for piece in pieces))
    ordered = []
    position, heading = start, direction
    while len(remaining) > 0:
        best, best_score, flip = None, None, False
        for candidate in remaining:
            for reverse in (False, True):
                # scoring a reversed candidate without building it: its
                # position_at(0) is the candidate's position_at(1) and its
                # tangent_at(0) is the negated tangent_at(1)
                if reverse:
                    gap = (candidate.position_at(1) - position).length
                    heading_score = candidate.tangent_at(1).dot(heading)
                else:
                    gap = (candidate.position_at(0) - position).length
                    heading_score = -candidate.tangent_at(0).dot(heading)
                # Rank on whether the gap is closed at all, then on the tangent,
                # and only then on the gap itself. Comparing raw gaps first would
                # let 1e-16 noise decide between two pieces that meet at the same
                # vertex - and at the seam of a loop those two pieces head in
                # opposite directions, so the loop could be walked backwards.
                score = (gap > gap_tolerance, heading_score, gap)
                if best_score is None or score < best_score:
                    best, best_score, flip = candidate, score, reverse
        if best is None or best_score[0]:
            return pieces  # not a connected chain - keep the input order
        edge = _reverse_1d(best) if flip else best
        ordered.append(edge)
        remaining = [p for p in remaining if p is not best]
        position, heading = edge.position_at(1), edge.tangent_at(1)
    return ordered


def _concatenate_edges(edges):
    """A single Edge whose curve is the concatenation of edges, in order.

    Used to give a re-seamed closed loop an unambiguous start point: a closed
    TopoDS_Wire carries no distinguished first edge, while an Edge's curve
    parametrization does."""
    return Edge(w.ConcatEdgesToEdge([_topo(e) for e in edges]))


class Face(Shape):
    def __init__(self, topo, parent=None, index=None):
        # Face(outer_wire, [hole_wires]) like build123d
        inner = None
        if isinstance(parent, (list, tuple, ShapeList)) and \
                all(isinstance(x, Mixin1D) for x in parent):
            inner = list(parent)
            parent = None
        if isinstance(topo, Mixin1D):
            outer = _topo(topo)
            if outer.ShapeType().value != 5:
                outer = w.GetWire(outer, 0, True)
            if inner:
                def _wire_of(x):
                    tw = _topo(x)
                    return tw if tw.ShapeType().value == 5 \
                        else w.GetWire(tw, 0, True)
                topo = w.FaceWithHoles(outer, [_wire_of(x) for x in inner])
            else:
                # build123d's Face(wire) is always PLANAR (OnlyPlane=True)
                topo = w.MakeFace(outer, True, True)
        Shape.__init__(self, topo)
        if parent is not None:
            self._extracted_from(parent)
        self.index = index

    @classmethod
    def make_gordon_surface(cls, profiles, guides, tolerance=0.0003):
        # Gordon curve-network surface interpolation. Upstream delegates to
        # the external ocp_gordon package; here the algorithm is a JS port
        # (GordonSurface.js, COMPROMISE notes in its header) exposed as
        # w.GordonSurfaceFace. Profiles/guides: Edge/Curve/Wire or points
        # (only first/last entries may be points, matching upstream).
        def conv(item):
            if isinstance(item, Shape):
                return _topo(item)
            v = Vector(item)
            return [v.X, v.Y, v.Z]
        p = [conv(i) for i in profiles]
        g = [conv(i) for i in guides]
        return cls(w.GordonSurfaceFace(p, g, tolerance))

    @property
    def geom_type(self):
        t = w._faceSurfaceType(self.topo)
        for name in ('PLANE', 'CYLINDER', 'CONE', 'SPHERE', 'TORUS',
                     'BEZIER', 'BSPLINE', 'OTHER'):
            if t in getattr(GeomType, name):
                return getattr(GeomType, name)
        return GeomType.OTHER

    @property
    def area(self):
        return float(w._faceArea(self.topo))

    def center(self, center_of=CenterOf.GEOMETRY):
        if center_of == CenterOf.BOUNDING_BOX:
            return self.bounding_box().center()
        return Vector(tuple(w._faceCentroid(self.topo)))

    def _surface_params(self, surface_point, u, v):
        """RAW (u, v) surface parameters for build123d's two overloads: a
        3D point projected onto the surface, or NORMALIZED u/v mapped into
        the face's UV bounds."""
        if surface_point is None:
            b = tuple(w._faceUVBounds(self.topo))
            return (b[0] + u * (b[1] - b[0]), b[2] + v * (b[3] - b[2]))
        uv = w._faceParamsAtPoint(self.topo, list(Vector(surface_point)))
        if uv is None:
            raise ValueError('could not project the point onto this surface')
        return (uv[0], uv[1])

    def _surface_args(self, args, kwargs, extra=()):
        """Shared argument parsing for normal_at/location_at: either
        (surface_point) or (u, v), defaulting to the face center."""
        surface_point, u, v = None, -1.0, -1.0
        if args:
            if isinstance(args[0], (Vector, tuple, list)):
                surface_point = args[0]
            elif isinstance(args[0], (int, float)):
                u = args[0]
            if len(args) == 2 and isinstance(args[1], (int, float)):
                v = args[1]
        allowed = ('surface_point', 'u', 'v') + tuple(extra)
        unknown = [k for k in kwargs if k not in allowed]
        if unknown:
            raise ValueError('Unexpected argument(s) ' + ', '.join(unknown))
        surface_point = kwargs.get('surface_point', surface_point)
        u = kwargs.get('u', u)
        v = kwargs.get('v', v)
        if surface_point is None and u < 0 and v < 0:
            u, v = 0.5, 0.5
        elif surface_point is None and (u < 0 or v < 0):
            raise ValueError('Both u & v values must be specified')
        return (surface_point, u, v)

    def normal_at(self, *args, **kwargs):
        """Unit surface normal, at the face center by default, or at a 3D
        surface_point / normalized (u, v) — build123d Face.normal_at."""
        if not args and not kwargs:
            # the whole-face mid-parameter normal (identical evaluation, but
            # this path is what every other lite call site already uses)
            return Vector(tuple(w._faceNormal(self.topo)))
        surface_point, u, v = self._surface_args(args, kwargs)
        u_val, v_val = self._surface_params(surface_point, u, v)
        return Vector(tuple(w._faceNormalAt(self.topo, u_val, v_val)))

    def location_at(self, *args, **kwargs):
        """location_at(u, v, *, x_dir=None) | location_at(surface_point, *,
        x_dir=None): the placement (origin + orientation) on this surface.
        z is the surface normal (dU x dV), x defaults to the U tangent —
        build123d Face.location_at. Defaults to the face center (0.5, 0.5)."""
        surface_point, u, v = self._surface_args(args, kwargs, ('x_dir',))
        user_x_dir = kwargs.get('x_dir', None)
        u_val, v_val = self._surface_params(surface_point, u, v)
        d = w._faceD1(self.topo, u_val, v_val)
        origin = Vector(tuple(d[0]))
        du, dv = Vector(tuple(d[1])), Vector(tuple(d[2]))
        z_dir = du.cross(dv).normalized()
        # build123d 0.12: a REVERSED face's location z matches normal_at
        if w._shapeIsReversed(self.topo):
            z_dir = -z_dir
        x_dir = Vector(user_x_dir) if user_x_dir is not None else du
        return Location(Plane(origin=origin, x_dir=x_dir, z_dir=z_dir))

    def position_at(self, u, v):
        """Point on the face at NORMALIZED (u, v) surface parameters
        (build123d Face.position_at)."""
        u_val, v_val = self._surface_params(None, u, v)
        return Vector(tuple(w._faceD1(self.topo, u_val, v_val)[0]))

    @property
    def center_location(self):
        """Location at the centre of the face (build123d
        Face.center_location): the (0.5, 0.5) surface point with the surface
        normal as z."""
        origin = self.position_at(0.5, 0.5)
        return Plane(origin=origin, z_dir=self.normal_at(origin)).location

    @property
    def _curvature_sign(self):
        """Signed reference distance between the face's centre and its
        underlying geometry's reference point — positive convex, negative
        concave, 0.0 for surfaces that are not a cylinder/sphere/torus
        (build123d Face._curvature_sign; StandardLibrary._faceCurvatureSign
        reads the surface's own gp_Cylinder/gp_Sphere/gp_Torus reference, which
        the fork binds as of the Geom2dGcc round)."""
        return w._faceCurvatureSign(self.topo)

    @property
    def is_circular_convex(self):
        """Is this face CONVEX (build123d 0.12: convexity == CONVEX, for any
        surface type)."""
        return self.convexity == Convexity.CONVEX

    @property
    def is_circular_concave(self):
        """Is this face CONCAVE (build123d 0.12: convexity == CONCAVE)."""
        return self.convexity == Convexity.CONCAVE

    @property
    def convexity(self):
        """How the material sits around this face (build123d 0.12
        Face.convexity): the signs of the principal curvatures relative to
        the outward normal, sampled across the face."""
        if self.topo is None:
            raise ValueError('an empty face has no convexity')
        try:
            name = w.FaceConvexity(self.topo)
        except Exception as exc:
            raise ValueError(_js_error_text(exc))
        return Convexity._of(name)

    def offset(self, amount):
        """The face's plane offset by amount (build123d Face.offset)."""
        return Plane(self).offset(amount)

    @property
    def radius(self):
        """Radius of a cylindrical or spherical face, else None (build123d
        Face.radius, read off the surface's own gp_Cylinder/gp_Sphere)."""
        return w._faceRadius(self.topo)

    @property
    def axis_of_rotation(self):
        """Rotational axis of a cone/cylinder/sphere/torus/revolution face,
        else None (build123d Face.axis_of_rotation)."""
        ax = w._faceAxisOfRotation(self.topo)
        if ax is None:
            return None
        origin, direction = list(ax[0]), list(ax[1])
        return Axis(tuple(origin), tuple(direction))

    def outer_wire(self):
        """The face's outer boundary wire (BRepTools::OuterWire)."""
        return Wire(w._faceOuterWire(self.topo))

    def inner_wires(self):
        """Hole wires: every wire of the face except the outer one."""
        outer = w._faceOuterWire(self.topo)
        out = ShapeList()

        def _cb(i, wire):
            if not w._sameShape(wire, outer):
                out.append(Wire(wire))
        w.ForEachWire(self.topo, _cb)
        return out

    def project_to_shape(self, target, direction):
        """Project this face onto target along direction: extrude the
        face by the combined bbox diagonal and intersect with the target
        (BRepAlgoAPI_Common) — exactly build123d's Face.project_to_shape.
        Returns faces ordered by distance along the projection axis."""
        d = Vector(direction).normalized()
        bb1 = list(w.BoundingBox(self.topo))
        bb2 = list(w.BoundingBox(_topo(target)))
        lo = [min(bb1[i], bb2[i]) for i in range(3)]
        hi = [max(bb1[i + 3], bb2[i + 3]) for i in range(3)]
        diag = math.sqrt(sum((hi[i] - lo[i]) ** 2 for i in range(3)))
        prism = w.Extrude(self.topo, [d[0] * diag, d[1] * diag, d[2] * diag],
                          True)
        # like build123d: intersect the prism with the target's SHELLS (its
        # boundary surface), so the result is surface pieces on the target
        # — front AND back — never the prism's own side walls
        shells = []

        def _shell_cb(i, sh):
            shells.append(sh)
        w.ForEachShell(_topo(target), _shell_cb)
        if not shells:
            shells = [_topo(target)]
        pieces = []
        for sh in shells:
            common = w.Intersection([prism, sh], True, 1e-7, True)
            pieces.extend(Shape(common).faces())
        origin = self.center()

        def _dist(f):
            c = w._faceCentroid(f.topo)
            return ((c[0] - origin.X) * d[0] + (c[1] - origin.Y) * d[1] +
                    (c[2] - origin.Z) * d[2])
        return ShapeList(_stable_sorted([Face(f.topo) for f in pieces], key=_dist))

    @classmethod
    def make_surface(cls, exterior, surface_points=None, interior_wires=None):
        """A potentially NON-planar face bounded by exterior (a wire or
        edges), pulled towards surface_points and holed by interior_wires —
        the exact BRepOffsetAPI_MakeFilling construction of build123d's
        Face.make_surface."""
        if isinstance(exterior, Shape):
            edges = [e.topo for e in exterior.edges()]
        else:
            edges = [_topo(e) for e in exterior]
        pts = [list(Vector(p)) for p in (surface_points or [])]
        holes = [_topo(x) for x in (interior_wires or [])]
        topo = w.FillingFace(edges, pts, holes)
        if topo is None:
            raise RuntimeError('non planar face is invalid')
        return cls(topo)

    # --- wrapping flat geometry onto this surface (build123d Face.wrap) ---

    def _intersect_surface_normal(self, point, direction, target_center):
        """(point, unit normal) of the closest crossing of the axis
        (point, direction) with this surface — the inner helper of
        build123d's Face._wrap_edge."""
        hits = self.find_intersection_points(Axis(point, direction))
        if not hits:
            raise RuntimeError('wrapping over surface boundary, try a '
                               'different surface_loc')
        best, best_d = hits[0], (hits[0][0] - point).length
        for h in hits[1:]:
            d = (h[0] - point).length
            if d < best_d:
                best, best_d = h, d
        return best

    def _wrap_edge(self, planar_edge, surface_loc, snap_to_face=True,
                   tolerance=0.001):
        """Wrap one flat edge onto this surface: march along the edge in the
        local surface frame, casting each step back onto the surface, refining
        the subdivision until the wrapped length matches — build123d's
        Face._wrap_edge."""
        if self.topo is None:
            raise ValueError('cannot wrap around an empty face')
        target_center = self.center(CenterOf.BOUNDING_BOX)
        surface_x_direction = surface_loc.x_axis.direction
        planar_edge_length = planar_edge.length

        def find_point_on_surface(current_point, normal, relative_position):
            local_plane = Plane(origin=current_point,
                                x_dir=surface_x_direction, z_dir=normal)
            world_point = local_plane.from_local_coords(relative_position)
            return self._intersect_surface_normal(
                world_point, world_point - target_center, target_center)

        if planar_edge.position_at(0).length > tolerance:
            # the edge does not start at the surface location: wrap a
            # construction line to find where it does
            to_start_edge = Edge.make_line((0, 0, 0), planar_edge @ 0)
            wrapped_to_start = self._wrap_edge(to_start_edge, surface_loc,
                                              True, tolerance)
            start_pnt = wrapped_to_start @ 1
            start_normal = self._intersect_surface_normal(
                start_pnt, start_pnt - target_center, target_center)[1]
        else:
            start_pnt = surface_loc.position
            start_normal = surface_loc.z_axis.direction

        closed = planar_edge.is_closed
        subdivisions = 3
        loop_count = 0
        length_error = 1e308
        wrapped_edge = None
        while length_error > tolerance and loop_count < 10:
            points = [start_pnt]
            current_point, current_normal = start_pnt, start_normal
            for div in range(1, subdivisions + (0 if closed else 1)):
                prev = planar_edge.position_at((div - 1) / subdivisions)
                curr = planar_edge.position_at(div / subdivisions)
                current_point, current_normal = find_point_on_surface(
                    current_point, current_normal, curr - prev)
                points.append(current_point)
            wrapped_edge = Edge.make_spline(points, periodic=closed)
            length_error = abs(planar_edge_length - wrapped_edge.length)
            subdivisions *= 2
            loop_count += 1

        if length_error > tolerance:
            raise RuntimeError('Length error of ' + repr(length_error) +
                               ' exceeds tolerance ' + repr(tolerance))
        if not snap_to_face:
            return wrapped_edge
        snapped = w.ProjectEdgeOnFace(_topo(wrapped_edge), self.topo)
        if snapped is None:
            raise RuntimeError('Projection failed, try setting snap_to_face '
                               'to False.')
        return Edge(snapped)

    def _wrap_wire(self, planar_wire, surface_loc, tolerance=0.001,
                   extension_factor=0.1):
        """Wrap a flat wire onto this surface edge by edge, then close the
        junction the distortion opens between the first and last edge —
        build123d's Face._wrap_wire."""
        surface_point = surface_loc.position
        surface_x_direction = surface_loc.x_axis.direction

        planar_edges = planar_wire.order_edges()
        if len(planar_edges) == 1:
            return Wire([self._wrap_edge(planar_edges[0], surface_loc, True,
                                         tolerance)])

        wrapped_edges = []
        first_start_point = None

        if planar_edges[0].position_at(0) == Vector(0, 0, 0):
            edge_surface_point = surface_point
            planar_edge_end_point = Vector(0, 0, 0)
        else:
            construction_line = Edge.make_line(
                (0, 0, 0), planar_edges[0].position_at(0))
            wrapped_construction_line = self._wrap_edge(
                construction_line, surface_loc, True, tolerance)
            edge_surface_point = wrapped_construction_line.position_at(1)
            planar_edge_end_point = planar_edges[0].position_at(0)
        edge_surface_location = Location(Plane(
            origin=edge_surface_point, x_dir=surface_x_direction,
            z_dir=self.normal_at(edge_surface_point)))

        for planar_edge in planar_edges:
            # re-wrap as an Edge: _wrap_like turns a transformed Edge into a
            # Curve, and Curve.position_at is not orientation-aware, so a
            # REVERSED edge of the wire would march from the wrong end
            local_planar_edge = Edge(_topo(
                planar_edge.translate(-planar_edge_end_point)))
            wrapped_edge = self._wrap_edge(local_planar_edge,
                                           edge_surface_location, True,
                                           tolerance)
            edge_surface_point = wrapped_edge.position_at(1)
            edge_surface_location = Location(Plane(
                origin=edge_surface_point, x_dir=surface_x_direction,
                z_dir=self.normal_at(edge_surface_point)))
            planar_edge_end_point = planar_edge.position_at(1)
            if first_start_point is None:
                first_start_point = wrapped_edge.position_at(0)
            wrapped_edges.append(wrapped_edge)

        if not planar_wire.is_closed:
            return Wire(wrapped_edges)

        # extend the first and last wrapped edge so that they cross, then trim
        # both at the crossing
        first_edge = wrapped_edges[0]._extend_spline(True, self,
                                                    extension_factor)
        last_edge = wrapped_edges[-1]._extend_spline(False, self,
                                                     extension_factor)
        params = w.ExtremaEdgeParams(_topo(first_edge), _topo(last_edge))
        if params is None:
            raise RuntimeError('Extended first/last edges do not intersect; '
                               'increase extension.')
        param_first, param_last = params[0], params[1]

        u_start_first = first_edge.param_at(0)
        u_end_first = first_edge.param_at(1)
        new_start = (param_first - u_start_first) / (u_end_first - u_start_first)
        trimmed_first = first_edge.trim(new_start, 1.0)

        u_start_last = last_edge.param_at(0)
        u_end_last = last_edge.param_at(1)
        new_end = (param_last - u_start_last) / (u_end_last - u_start_last)
        trimmed_last = last_edge.trim(0.0, new_end)

        wrapped_edges[0] = trimmed_first
        wrapped_edges[-1] = trimmed_last

        closing_error = (trimmed_first.position_at(0) -
                         trimmed_last.position_at(1)).length
        wire = w.WireFromEdgesFixed([_topo(e) for e in wrapped_edges],
                                    2 * closing_error)
        return Wire(wire)

    def _wrap_face(self, planar_face, surface_loc, tolerance=0.001,
                   extension_factor=0.1):
        """Wrap a flat face onto this surface (build123d Face._wrap_face)."""
        wrapped_perimeter = self._wrap_wire(planar_face.outer_wire(),
                                            surface_loc, tolerance,
                                            extension_factor)
        wrapped_holes = [self._wrap_wire(iw, surface_loc, tolerance,
                                         extension_factor)
                         for iw in planar_face.inner_wires()]
        wrapped_face = Face.make_surface(
            wrapped_perimeter, surface_points=[surface_loc.position],
            interior_wires=wrapped_holes)
        # flip the wrapped face if it ended up facing away from the surface
        surface_normal = surface_loc.z_axis.direction
        wrapped_normal = wrapped_face.normal_at(surface_loc.position)
        if surface_normal.dot(wrapped_normal) < 0:
            wrapped_face = -wrapped_face
        return wrapped_face

    def wrap(self, planar_shape, surface_loc, tolerance=0.001,
             extension_factor=0.1):
        """Wrap a flat Edge/Wire/Face (drawn on Plane.XY) onto this surface
        starting at surface_loc (build123d Face.wrap)."""
        if isinstance(planar_shape, Edge):
            return self._wrap_edge(planar_shape, surface_loc, True, tolerance)
        if isinstance(planar_shape, (Face, Sketch)):
            return self._wrap_face(planar_shape, surface_loc, tolerance,
                                   extension_factor)
        if isinstance(planar_shape, Mixin1D):
            return self._wrap_wire(planar_shape, surface_loc, tolerance,
                                   extension_factor)
        raise TypeError('planar_shape must be an Edge, Wire or Face')

    def wrap_faces(self, faces, path, start=0.0):
        """Wrap flat faces onto this surface, spaced along a path that lies on
        it: each face keeps its relative X position, mapped to arc length
        along the path (build123d Shape.wrap_faces)."""
        path_length = path.length
        face_list = [f for f in faces]
        first_face_min_x = face_list[0].bounding_box().min[0]
        wrapped = ShapeList()
        for face in face_list:
            bbox = face.bounding_box()
            face_center_x = (bbox.min[0] + bbox.max[0]) / 2.0
            delta_x = face_center_x - first_face_min_x
            relative_position = start + delta_x / path_length
            path_position = path.position_at(relative_position)
            surface_location = Location(Plane(
                origin=path_position,
                x_dir=path.tangent_at(relative_position),
                z_dir=self.normal_at(path_position)))
            face.position = face.position - Vector(delta_x, 0, 0)
            wrapped.append(self._wrap_face(face, surface_location))
        return wrapped

    @classmethod
    def make_surface_from_array_of_points(cls, points, tol=1e-2,
                                          smoothing=None, min_deg=1,
                                          max_deg=3):
        """Approximate a BSpline surface through a 2D grid of points —
        upstream's exact GeomAPI_PointsToBSplineSurface 2-D least-squares
        fit (outer index = V, inner = U)."""
        pts = [[list(_v3(p)) for p in row] for row in points]
        # [] = no smoothing (None does not survive CacheOp's JSON hashing)
        smooth = list(smoothing) if smoothing is not None else []
        # build123d 0.12: the smoothing (variational) branch needs degree >= 6
        # in OCCT 8 for C2 (PLib_JacobiPolynomial); upstream passes
        # DegMax=max(max_deg, 6) there
        degmax = max(max_deg, 6) if smoothing is not None else max_deg
        topo = w.SurfaceFromPoints(pts, tol, min_deg, degmax, smooth)
        if topo is None:
            raise ValueError('B-spline surface approximation failed')
        return cls(topo)

    def __neg__(self):
        """The same face with reversed orientation (build123d -face)."""
        return Face(w.ReverseFace(self.topo, True))

    @classmethod
    def extrude(cls, obj, direction):
        """Extrude an Edge into a Face (build123d Face.extrude). Extruding a
        one-edge WIRE gives a shell here, so unwrap it to the single face
        build123d would have produced."""
        d = Vector(direction)
        topo = w.Extrude(_topo(obj), [d.X, d.Y, d.Z], True)
        return cls(w.AsSingleFace(topo, True))

    @classmethod
    def revolve(cls, profile, angle=360, axis=None):
        """Revolve an Edge/Wire profile into a Face of revolution
        (build123d Face.revolve)."""
        if axis is None:
            axis = Axis.Z
        o = tuple(axis.position)
        d = list(axis.direction)
        topo = _topo(profile)
        shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Revolve(topo, angle, d)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        return cls(topo)

    @classmethod
    def make_rect(cls, width, height, plane=None):
        """A width x height rectangle face on the given plane (Plane.XY)."""
        topo = w.Polygon([[-width / 2.0, -height / 2.0, 0],
                          [width / 2.0, -height / 2.0, 0],
                          [width / 2.0, height / 2.0, 0],
                          [-width / 2.0, height / 2.0, 0]])
        face = cls(topo)
        if plane is not None:
            face = cls((plane.location * face).topo)
        return face


# lite re-wraps a TRANSFORMED Face as a Sketch (the algebra-mode 2D
# convention, see _wrap_like), so a Sketch very often really is one face:
# share Face's surface-geometry methods with it. Explicit assignment rather
# than making Sketch a Face subclass, because several call sites dispatch on
# isinstance(x, Face) (Face(wire) promotion, revolve, thicken, ...).
Sketch._surface_args = Face._surface_args
Sketch._surface_params = Face._surface_params
Sketch.normal_at = Face.normal_at
Sketch.location_at = Face.location_at
Sketch.outer_wire = Face.outer_wire
Sketch.inner_wires = Face.inner_wires
Sketch._intersect_surface_normal = Face._intersect_surface_normal
Sketch._wrap_edge = Face._wrap_edge
Sketch._wrap_wire = Face._wrap_wire
Sketch._wrap_face = Face._wrap_face
Sketch.wrap = Face.wrap
Sketch.wrap_faces = Face.wrap_faces


class Shell(Shape):
    """A shell — only the build123d forms the examples use: Shell(faces)
    collects faces (Solid(Shell(faces)) then sews them into a closed
    solid via BRepBuilderAPI_Sewing + ShapeFix_Solid), Shell(shape)
    adopts the shape's faces."""

    _face_shapes = None  # default for instances made via _wrap_like

    @classmethod
    def extrude(cls, obj, direction):
        """A wire/edge swept along a direction into an open SHELL
        (build123d Shell.extrude)."""
        d = _v3(direction)
        topo = w.Extrude(_topo(obj), [d[0], d[1], d[2]])
        shell = object.__new__(cls)
        Shape.__init__(shell, topo)
        shell._face_shapes = None
        return shell

    @property
    def volume(self):
        """The volume a manifold shell encloses, else 0 (build123d
        Shell.volume) - what Shell.mass() weighs."""
        if self.topo is None:
            return 0.0
        return float(w.ShellEnclosedVolume([f.topo for f in self.faces()]))

    def __init__(self, faces=None):
        if faces is None:
            Shape.__init__(self, None)
            self._face_shapes = []
            return
        if isinstance(faces, Shape):
            Shape.__init__(self, faces.topo)
            self._face_shapes = list(faces.faces())
            return
        if not isinstance(faces, (list, tuple)) and hasattr(faces, 'ShapeType'):
            # Shell(TopoDS_Shell): wrap the raw shell (shells() selector)
            Shape.__init__(self, faces)
            self._face_shapes = None
            return
        fl = [f for f in _tolist(faces)]
        self._face_shapes = fl
        if len(fl) == 0:
            topo = None
        elif len(fl) == 1:
            topo = _topo(fl[0])
        else:
            topo = w.MakeCompound([_topo(f) for f in fl])
        Shape.__init__(self, topo)


class Vertex(Shape):
    def __init__(self, topo=None, *args, parent=None):
        # Vertex(Vector) / Vertex(x, y, z) / Vertex((x, y, z)) like build123d
        if topo is None or isinstance(topo, (int, float)) or \
                isinstance(topo, (Vector, tuple, list)):
            if topo is None:
                pt = (0.0, 0.0, 0.0)
            elif isinstance(topo, (int, float)):
                pt = (float(topo),) + tuple(float(a) for a in args) + \
                    (0.0, 0.0)
                pt = pt[:3]
            else:
                pt = tuple(Vector(topo))
            topo = w.PointVertex(list(pt))
        Shape.__init__(self, topo)
        if parent is not None:
            self._extracted_from(parent)

    def _xyz(self):
        """The CURRENT point (build123d 0.12 reads BRep_Tool.Pnt, so a
        moved/located vertex reports where it is now), cached per topo."""
        topo = self.topo
        cache = getattr(self, '_xyz_cache', None)
        if cache is not None and cache[0] is topo:
            return cache[1]
        p = w._vertexPoint(topo)
        # float() NOW: on MicroPython the elements arrive as JS number
        # proxies and every later arithmetic op would cross the FFI
        xyz = (float(p[0]), float(p[1]), float(p[2]))
        self._xyz_cache = (topo, xyz)
        return xyz

    @property
    def X(self):
        return self._xyz()[0]

    @property
    def Y(self):
        return self._xyz()[1]

    @property
    def Z(self):
        return self._xyz()[2]

    def center(self, center_of=CenterOf.GEOMETRY):
        return Vector(self._xyz())

    def __iter__(self):
        return iter((self.X, self.Y, self.Z))

    @property
    def convexity(self):
        """How the shape this vertex was selected from sits around it
        (build123d 0.12 Vertex.convexity): selected through a face it is a
        corner of that face (read in the face's own parameters); straight off
        a solid or shell it is classified by the creases meeting there."""
        face = None
        for step in reversed(self.topo_path):
            t = getattr(step, 'topo', None)
            if t is not None and t.ShapeType().value == 4:
                face = step
                break
        try:
            if face is not None:
                name = w.VertexConvexityOnFace(self.topo, face.topo)
            else:
                parent = self.topo_parent
                if parent is None or getattr(parent, 'topo', None) is None:
                    raise ValueError('this vertex was not selected from a '
                                     'shape, so it has no convexity')
                name = w.VertexConvexityCrease(self.topo, _topo(parent))
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(_js_error_text(exc))
        return Convexity._of(name)

    def _pos_key(self):
        # INTEGER key tuple: micron-rounded position. Ints, not floats —
        # STOCK MicroPython set probing over float-tuple keys degrades ~100x
        # (a 512-vertex set() took 35 s with float keys, 0.4 s with ints):
        # its fallback float hash truncates to int, collapsing every
        # fractional coordinate onto a handful of buckets. The custom
        # micropython-cs interpreter build fixes float hashing (high-quality
        # hash + high-bits fold), making this belt-and-braces there — kept
        # because integer keys are exact, cheap, and stock-artifact safe.
        return (int(round(self.X * 1e6)), int(round(self.Y * 1e6)),
                int(round(self.Z * 1e6)))

    def __eq__(self, other):
        """POSITIONAL equality for vertices (micron-rounded, matching the
        canonical tie-break keys): builder code dedups vertices with set()
        and 'v in face.vertices()', which upstream can serve with TopoDS
        IsSame because its builders FUSE lines (shared corners become one
        vertex); lite keeps free-edge compounds, where each corner exists
        once per incident edge and IsSame keeps the duplicates."""
        if not isinstance(other, Vertex):
            return Shape.__eq__(self, other)
        return self._pos_key() == other._pos_key()

    def __hash__(self):
        return hash(self._pos_key())


class BoundBox:
    """An axis-aligned bounding box (build123d BoundBox). Since 0.12 it can
    be built straight from a Shape (BoundBox(shape)) and carries upstream's
    full predicate set - covers/covered_by, contains/within (enclosure WITH
    relevant-dimensional interior), contains_properly, intersects/disjoint
    (distance within tolerance), touches and overlaps (shared interior,
    neither containing the other) - with degenerate axes coincident in both
    boxes dropped from interior comparisons (coplanar rectangles compare in
    2-D). A void box (empty shape) has wrapped None and answers False."""

    def __init__(self, *args, **kwargs):
        shape = kwargs.pop('shape', None)
        kwargs.pop('tolerance', None)
        kwargs.pop('optimal', None)
        six = kwargs.pop('bounding_box', None)
        if kwargs:
            raise TypeError('Unexpected keyword arguments: ' +
                            ', '.join(kwargs))
        void = False
        if args:
            a = args[0]
            if isinstance(a, BoundBox):
                six = None if a.wrapped is None else \
                    list(tuple(a.min)) + list(tuple(a.max))
                void = a.wrapped is None
            elif isinstance(a, (Shape, Builder)) or hasattr(a, 'ShapeType'):
                shape = a
            elif a is None:
                void = True
            elif _is_nested_seq(a) or isinstance(a, (list, tuple)):
                six = list(a)
            else:
                raise TypeError('Invalid positional arguments: ' + repr(args))
        if shape is not None:
            topo = shape.topo if isinstance(shape, Shape) else \
                (_topo(shape) if isinstance(shape, Builder) else shape)
            if topo is None:
                void = True
            else:
                bb = w.BoundingBox(topo)
                if bb:
                    six = list(bb)
                else:
                    void = True
        if six is None:
            void = True
            six = [0.0] * 6
        self.wrapped = None if void else True
        self.min = Vector(six[0], six[1], six[2])
        self.max = Vector(six[3], six[4], six[5])

    @property
    def size(self):
        return self.max - self.min

    @property
    def measure(self):
        """The bounding box's Lebesgue measure: length, area or volume over
        its non-degenerate axes."""
        result = 1.0
        for x in self.size:
            if x > _TOL_1E6:
                result *= x
        return result

    def center(self):
        return (self.min + self.max) * 0.5

    @property
    def diagonal(self):
        if self.wrapped is None:
            return 0.0
        return (self.max - self.min).length

    def add(self, obj, tol=None):
        """A copy expanded to enclose a point or another box (upstream adds
        a Bnd_Box gap of tol, default TOL = 1e-2, on every side)."""
        tol = 1e-2 if tol is None else tol
        pts = []
        if self.wrapped is not None:
            pts.extend([tuple(self.min), tuple(self.max)])
        if isinstance(obj, BoundBox):
            if obj.wrapped is not None:
                pts.extend([tuple(obj.min), tuple(obj.max)])
        else:
            pts.append(tuple(Vector(obj)))
        if not pts:
            return BoundBox(None)
        lo = [min(p[i] for p in pts) - tol for i in range(3)]
        hi = [max(p[i] for p in pts) + tol for i in range(3)]
        return BoundBox(lo + hi)

    @staticmethod
    def find_outside_box_2d(bb1, bb2):
        """Deprecated since build123d 0.12: use BoundBox.contains()."""
        _warn('Use BoundBox.contains() to identify the bounding box that '
              'encloses the other.', 'DeprecationWarning')
        if (bb1.min.X < bb2.min.X and bb1.max.X > bb2.max.X and
                bb1.min.Y < bb2.min.Y and bb1.max.Y > bb2.max.Y):
            return bb1
        if (bb2.min.X < bb1.min.X and bb2.max.X > bb1.max.X and
                bb2.min.Y < bb1.min.Y and bb2.max.Y > bb1.max.Y):
            return bb2
        return None

    def _axes(self, other):
        return list(zip(tuple(self.min), tuple(self.max),
                        tuple(other.min), tuple(other.max)))

    def _interior_axes(self, other, tolerance):
        axes = []
        for s0, s1, o0, o1 in self._axes(other):
            if s1 - s0 <= tolerance and o1 - o0 <= tolerance:
                if abs((s0 + s1) / 2 - (o0 + o1) / 2) > tolerance:
                    return None
            else:
                axes.append((s0, s1, o0, o1))
        return axes

    def _has_interior_overlap(self, other, tolerance):
        if self.wrapped is None or other.wrapped is None:
            return False
        axes = self._interior_axes(other, tolerance)
        if axes is None:
            return False
        for s0, s1, o0, o1 in axes:
            if not (max(s0, o0) < min(s1, o1) - tolerance):
                return False
        return True

    def covers(self, other, tolerance=_TOL_1E6):
        if self.wrapped is None or other.wrapped is None:
            return False
        for s0, s1, o0, o1 in self._axes(other):
            if not (s0 <= o0 + tolerance and o1 <= s1 + tolerance):
                return False
        return True

    def covered_by(self, other, tolerance=_TOL_1E6):
        return other.covers(self, tolerance)

    def contains(self, other, tolerance=_TOL_1E6):
        return self.covers(other, tolerance) and \
            self._has_interior_overlap(other, tolerance)

    def contains_properly(self, other, tolerance=_TOL_1E6):
        if self.wrapped is None or other.wrapped is None:
            return False
        axes = self._interior_axes(other, tolerance)
        if not axes:
            return False
        for s0, s1, o0, o1 in axes:
            if not (s0 + tolerance < o0 and o1 < s1 - tolerance):
                return False
        return True

    def within(self, other, tolerance=_TOL_1E6):
        return other.contains(self, tolerance)

    def intersects(self, other, tolerance=_TOL_1E6):
        if self.wrapped is None or other.wrapped is None:
            return False
        dist2 = 0.0
        for s0, s1, o0, o1 in self._axes(other):
            gap = max(0.0, o0 - s1, s0 - o1)
            dist2 += gap * gap
        return dist2 ** 0.5 <= tolerance

    def disjoint(self, other, tolerance=_TOL_1E6):
        return not self.intersects(other, tolerance)

    def touches(self, other, tolerance=_TOL_1E6):
        return self.intersects(other, tolerance) and \
            not self._has_interior_overlap(other, tolerance)

    def overlaps(self, other, tolerance=_TOL_1E6):
        return self._has_interior_overlap(other, tolerance) and \
            not self.contains(other, tolerance) and \
            not other.contains(self, tolerance)

    def is_inside(self, other, tolerance=_TOL_1E6):
        """Deprecated since build123d 0.12: use within()."""
        _warn('Use BoundBox.within() instead.', 'DeprecationWarning')
        return self.within(other, tolerance)

    def to_align_offset(self, align):
        """Amount to move the object to achieve the desired alignment."""
        a = _norm_align(align, 3)
        return Vector(_align_shift(a, tuple(self.min), tuple(self.max)))

    def __repr__(self):
        return ('bbox: ' + repr(self.min.X) + ' <= x <= ' + repr(self.max.X) +
                ', ' + repr(self.min.Y) + ' <= y <= ' + repr(self.max.Y) +
                ', ' + repr(self.min.Z) + ' <= z <= ' + repr(self.max.Z))


class OrientedBoundBox:
    """An Oriented Bounding Box (build123d geometry.OrientedBoundBox on
    OCCT's Bnd_OBB via BRepBndLib::AddOBB with upstream's arguments).

    Note: like upstream, the axes of the oriented bounding box are arbitrary
    and may not be consistent across platforms or time."""

    def __init__(self, shape):
        if isinstance(shape, Shape):
            if shape.topo is None:
                raise TypeError('cannot compute the OBB of an empty shape')
            obb = w._shapeOBB(shape.topo)
        elif shape is not None and hasattr(shape, 'XHSize'):
            obb = shape  # a precomputed (JS) Bnd_OBB
        else:
            raise TypeError('Expected Bnd_OBB or Shape, got ' +
                            type(shape).__name__)
        self._wrapped = obb

    @property
    def wrapped(self):
        """The raw Bnd_OBB object."""
        return self._wrapped

    @property
    def corners(self):
        """The unique corner points of the box, in the OBB's frame order —
        degenerate (line/planar) shapes return only the unique points, and
        planar corners come back polygon-ordered, like upstream."""
        orders = {
            # Straight line cases
            (True, True, False): [(1, 1, 1), (1, 1, -1)],
            (True, False, True): [(1, 1, 1), (1, -1, 1)],
            (False, True, True): [(1, 1, 1), (-1, 1, 1)],
            # Planar face cases
            (True, False, False): [(1, 1, 1), (1, 1, -1), (1, -1, -1),
                                   (1, -1, 1)],
            (False, True, False): [(1, 1, 1), (1, 1, -1), (-1, 1, -1),
                                   (-1, 1, 1)],
            (False, False, True): [(1, 1, 1), (1, -1, 1), (-1, -1, 1),
                                   (-1, 1, 1)],
            # 3D object case (itertools.product((-1, 1), repeat=3) order)
            (False, False, False): [(-1, -1, -1), (-1, -1, 1), (-1, 1, -1),
                                    (-1, 1, 1), (1, -1, -1), (1, -1, 1),
                                    (1, 1, -1), (1, 1, 1)],
        }
        hs = self.size * 0.5
        order = orders[(hs.X < _TOL_1E6, hs.Y < _TOL_1E6, hs.Z < _TOL_1E6)]
        local_corners = [Vector(sx * hs.X, sy * hs.Y, sz * hs.Z)
                         for sx, sy, sz in order]
        return [self.plane.from_local_coords(c) for c in local_corners]

    @property
    def diagonal(self):
        """Full length of the body diagonal — the maximum object size."""
        return self.wrapped.SquareExtent() ** 0.5

    @property
    def location(self):
        """The Location of the center of the oriented bounding box."""
        return Location(self.plane)

    @property
    def plane(self):
        """The oriented coordinate system of the bounding box."""
        return Plane(origin=self.center(), x_dir=self.x_direction,
                     z_dir=self.z_direction)

    @property
    def size(self):
        """The full extents of the box along its primary axes."""
        return Vector(self.wrapped.XHSize(), self.wrapped.YHSize(),
                      self.wrapped.ZHSize()) * 2.0

    @property
    def x_direction(self):
        """The primary (X) direction, as a unit vector."""
        d = self.wrapped.XDirection()
        return Vector(d.X(), d.Y(), d.Z())

    @property
    def y_direction(self):
        """The secondary (Y) direction, as a unit vector."""
        d = self.wrapped.YDirection()
        return Vector(d.X(), d.Y(), d.Z())

    @property
    def z_direction(self):
        """The tertiary (Z) direction, as a unit vector."""
        d = self.wrapped.ZDirection()
        return Vector(d.X(), d.Y(), d.Z())

    def center(self):
        """The center point of the oriented bounding box."""
        c = self.wrapped.Center()
        return Vector(c.X(), c.Y(), c.Z())

    def is_completely_inside(self, other):
        """Is 'other' entirely contained within this bounding box."""
        return bool(self.wrapped.IsCompletelyInside(other.wrapped))

    def is_outside(self, point):
        """Is the given point entirely outside this oriented bounding box."""
        return bool(w._obbIsOut(self.wrapped, list(Vector(point))))


Plane.XY = Plane((0, 0, 0), (1, 0, 0), (0, 0, 1))
Plane.XZ = Plane((0, 0, 0), (1, 0, 0), (0, -1, 0))
Plane.YZ = Plane((0, 0, 0), (0, 1, 0), (1, 0, 0))
Plane.YX = Plane((0, 0, 0), (0, 1, 0), (0, 0, -1))
Plane.ZX = Plane((0, 0, 0), (0, 0, 1), (0, 1, 0))
Plane.ZY = Plane((0, 0, 0), (0, 0, 1), (-1, 0, 0))
Plane.front = Plane.XZ
Plane.top = Plane.XY


# ------------------------------------------------------------ ShapeList ---

def _entity_center(s):
    if isinstance(s, Edge):
        return w._edgeMidpoint(s.topo)
    if isinstance(s, Face):
        return w._faceCentroid(s.topo)
    if isinstance(s, Vertex):
        return (s.X, s.Y, s.Z)
    if isinstance(s, Vector):
        # a ShapeList OF VECTORS is valid upstream (RegularPolygon sorts its
        # corner points with sort_by(Axis.X)); a Vector is its own center
        return (s.X, s.Y, s.Z)
    return tuple(w.CenterOfMass(_topo(s)))


def _axis_value(s, axis):
    c = _entity_center(s)
    o = tuple(axis.position)
    d = tuple(axis.direction)
    return ((c[0] - o[0]) * d[0] + (c[1] - o[1]) * d[1] + (c[2] - o[2]) * d[2])


def _entity_radius(s):
    """Radius of a circular edge from three sampled points (no gp_Circ
    binding in the WASM build)."""
    if not isinstance(s, Edge):
        raise TypeError('SortBy.RADIUS only supports edges in build123d-lite')
    p0 = _v3(w._edgePointAt(s.topo, 0.0))
    p1 = _v3(w._edgePointAt(s.topo, 1.0 / 3.0))
    p2 = _v3(w._edgePointAt(s.topo, 2.0 / 3.0))
    u = tuple(p1[k] - p0[k] for k in range(3))
    v = tuple(p2[k] - p0[k] for k in range(3))
    a = math.sqrt(sum((p1[k] - p2[k]) ** 2 for k in range(3)))
    b = math.sqrt(sum(v[k] ** 2 for k in range(3)))
    c = math.sqrt(sum(u[k] ** 2 for k in range(3)))
    cr = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0])
    area2 = math.sqrt(sum(cr[k] ** 2 for k in range(3)))
    if area2 < 1e-12:
        return float('inf')  # straight line
    return a * b * c / (2.0 * area2)


_TOL_DIGITS = 6      # abs(log10(build123d's TOLERANCE))


def _canonical_sort_key(shape):
    """Deterministic, purely geometric ordering key (build123d's
    _canonical_sort_key): the shape's VERTEX positions, sorted and rounded to
    TOL_DIGITS - no bounding box, no curve evaluation, so it is cheap enough to
    compute inside a sort. Used to break ties in
    ShapeList.sort_by(tie_break=True), where the only alternative is the order
    the objects arrived in (the CAD kernel's traversal order).

    Vector members are handled explicitly rather than by catching
    AttributeError, so an API change surfaces as a failure instead of as a
    silently disabled tie break."""
    if isinstance(shape, Vector):  # ShapeList also holds plain Vectors
        return tuple(round(c, _TOL_DIGITS) for c in (shape.X, shape.Y, shape.Z))
    if shape.topo is None:
        return ()
    points = _stable_sorted([(round(v.X, _TOL_DIGITS), round(v.Y, _TOL_DIGITS),
                      round(v.Z, _TOL_DIGITS)) for v in shape.vertices()])
    return tuple(c for point in points for c in point)


def _canonical_center_key(shape):
    """Second stage tie break, for shapes whose vertices coincide (two arcs
    spanning the same end points, say). Only reached when the vertex key above
    leaves a tie (build123d's _canonical_center_key)."""
    if isinstance(shape, Vector):
        return ()
    try:
        center = shape.center()
    except Exception:
        return ()
    return tuple(round(c, _TOL_DIGITS)
                 for c in (center.X, center.Y, center.Z))


def _sort_key_fn(key):
    if isinstance(key, Axis):
        return lambda s: _axis_value(s, key)
    if key is Convexity:
        # 0.12: group_by(Convexity) keys every shape by its convexity
        return lambda s: s.convexity
    if isinstance(key, Mixin1D) and getattr(key, 'topo', None) is not None:
        # sort_by(<edge or wire>): the parameter, along that 1-D shape, of the
        # point closest to each object's centre (build123d's
        # u_of_closest_center -> closest_points + param_at_point)
        def along(s):
            pnt = key.closest_points(s.center())[0]
            return key.param_at_point(pnt)
        return along
    if key == SortBy.LENGTH:
        return lambda s: s.length
    if key == SortBy.AREA:
        return lambda s: s.area
    if key == SortBy.VOLUME:
        return lambda s: s.volume
    if key == SortBy.RADIUS:
        return _entity_radius
    if key == SortBy.DISTANCE:
        return lambda s: Vector(_entity_center(s)).length
    if callable(key):
        return key
    if isinstance(key, property):
        # sort_by(Face.area) / group_by(Edge.length): a class PROPERTY object
        # is called on each shape (build123d's documented selector form)
        return _property_getter(key)
    raise TypeError('unsupported sort/group key: ' + repr(key))


def _property_getter(p):
    """Portable class-property selector access: MicroPython property objects
    expose neither .fget nor .__get__, so resolve the attribute NAME from the
    receiver's class on first use and cache it."""
    try:
        return p.fget
    except AttributeError:
        pass
    state = [None]

    def find_name(klasses):
        for klass in klasses:
            for cand in dir(klass):
                try:
                    if getattr(klass, cand) is p:
                        return cand
                except Exception:
                    pass
        return None

    def get(s):
        name = state[0]
        if name is None:
            # the receiver's class first, then every topology class (a
            # property of one class - Solid.volume - used on another whose
            # class overrides it - a Part's Compound.volume)
            name = find_name([type(s)]) or find_name(
                [Shape, Solid, Shell, Face, Mixin1D, Edge, Wire, Vertex,
                 Compound, Part, Sketch, Curve])
            if name is None:
                raise TypeError('unsupported property key: ' + repr(p))
            state[0] = name
        return getattr(s, name)
    return get


def topo_distance_to(other):
    """A sort_by/group_by key function giving the TOPOLOGICAL distance to the
    reference shape(s) (build123d's topo_distance_to): 0 for the references
    themselves, 1 for their direct neighbours, and so on, measured over the
    full topology of their shared parent. Adjacency is sharing a lower-order
    sub-shape, exactly as upstream defines it — Faces via an Edge, Edges/Wires
    via a Vertex, Shells/Solids via a Face — with the sub-shapes identified
    geometrically (lite re-wraps every shape, so there is no TopoDS identity to
    hash)."""
    sources = [other] if isinstance(other, Shape) else list(other)
    if not sources:
        raise ValueError('Cannot measure topological distance to an empty '
                         'object')
    kind_lut = [(Vertex, 'vertex'), (Face, 'face'), (Edge, 'edge'),
                (Shell, 'shell'), (Solid, 'solid'), (Part, 'solid'),
                (Wire, 'wire'), (Curve, 'wire')]
    peer_kind = None
    for cls, name in kind_lut:
        if isinstance(sources[0], cls):
            peer_kind = name
            break
    if peer_kind is None:
        raise ValueError('Topological distance is not supported for ' +
                         type(sources[0]).__name__)
    for s in sources:
        if not isinstance(s, type(sources[0])):
            raise ValueError('Topological distance requires shapes of the '
                             'same type')
    parent = sources[0].topo_parent
    if parent is None or parent.topo is None:
        raise ValueError('Topological distance requires shapes with a '
                         'topo_parent')
    connector = {'vertex': 'edge', 'edge': 'vertex', 'wire': 'vertex',
                 'face': 'edge', 'shell': 'face', 'solid': 'face'}[peer_kind]
    peers = {'vertex': parent.vertices, 'edge': parent.edges,
             'wire': parent.wires, 'face': parent.faces,
             'shell': parent.faces, 'solid': parent.solids}[peer_kind]()

    def sub_keys(shape):
        if connector == 'vertex':
            return [_shape_key(v, 'vertex') for v in shape.vertices()]
        if connector == 'edge':
            return [_shape_key(e, 'edge') for e in shape.edges()]
        return [_shape_key(f, 'face') for f in shape.faces()]
    peer_keys = [_shape_key(p, peer_kind) for p in peers]
    peer_subs = [sub_keys(p) for p in peers]
    # adjacency: peers that share at least one connector sub-shape
    by_sub = {}
    for i, subs in enumerate(peer_subs):
        for key in subs:
            by_sub.setdefault(key, []).append(i)
    neighbours = [set() for _ in peers]
    for key in by_sub:
        group = by_sub[key]
        for i in group:
            for j in group:
                if i != j:
                    neighbours[i].add(j)
    # breadth-first search out of the reference shapes
    distances = {}
    frontier = []
    for s in sources:
        key = _shape_key(s, peer_kind)
        if key in peer_keys:
            i = peer_keys.index(key)
            if i not in distances:
                distances[i] = 0
                frontier.append(i)
    step = 0
    while frontier:
        step += 1
        nxt = []
        for i in frontier:
            for j in neighbours[i]:
                if j not in distances:
                    distances[j] = step
                    nxt.append(j)
        frontier = nxt

    def key_f(shape):
        key = _shape_key(shape, peer_kind)
        if key not in peer_keys:
            return float('inf')
        return distances.get(peer_keys.index(key), float('inf'))
    return key_f


def _group_key_fn(key, tol_digits=6):
    """group_by's key function: the sort key ROUNDED to tol_digits, with
    non-numeric keys passed through unchanged (build123d's group_by wraps
    every branch in try: round(val) / except TypeError: val)."""
    fn = _sort_key_fn(key)

    def rounded(s):
        val = fn(s)
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            return val
        return round(val, tol_digits)
    return rounded


def _is_parallel(s, axis, tolerance=1e-5):
    """Parallelism like build123d's Axis.is_parallel: tolerance is the
    ANGULAR tolerance in radians (gp_Ax1::IsParallel)."""
    d = Vector(axis.direction)
    if isinstance(s, Edge):
        ed = w._edgeDirection(s.topo)
        # JS null crosses Brython as NullType (not None) — test truthiness
        if not ed:
            return False
        v = Vector(tuple(ed)).normalized()
    elif isinstance(s, Face):
        v = Vector(tuple(w._faceNormal(s.topo)))
    else:
        return False
    dot = min(1.0, abs(v.dot(d)))
    # build123d's angular_tolerance is in DEGREES (geometry.py multiplies
    # by pi/180); keep the old 1e-4 dot slack as a floor so near-parallel
    # edges from wasm boolean noise still match
    return math.acos(dot) <= math.radians(tolerance) or dot > (1.0 - 1e-4)


try:
    # CPython/Pyodide/Brython: O(1) base indexing for list subclasses
    _list_getitem = list.__getitem__
except AttributeError:
    # MicroPython exposes no unbound specials on builtins (and its super()
    # can't reach a builtin base's __getitem__ either) — snapshot-and-index
    # is the portable fallback; ShapeLists are small
    def _list_getitem(seq, i):
        return list(seq)[i]


class ShapeList(list):
    def __add__(self, other):
        # plain list.__add__ would decay to a list, losing the selectors
        # (built element-wise: Brython's unbound list.__add__ returns
        # NotImplemented for subclass receivers)
        out = ShapeList(self)
        out.extend(other)
        return out

    def __radd__(self, other):
        out = ShapeList(other)
        out.extend(self)
        return out

    def filter_by(self, f, reverse=False, tolerance=1e-5):
        if isinstance(f, Axis):
            pred = lambda s: _is_parallel(s, f, tolerance)
        elif isinstance(f, _EnumMember) and f._owner == 'Convexity':
            # 0.12: filter_by(Convexity.CONCAVE)
            pred = lambda s: s.convexity == f
        elif isinstance(f, tuple):  # a GeomType member
            def pred(s):
                try:
                    return s.geom_type == f
                except Exception:
                    return False
        elif hasattr(f, 'z_dir') and hasattr(f, 'origin'):
            # filter_by(Plane): shapes lying IN that plane (build123d's
            # Plane filter - contains() on every vertex)
            def pred(s):
                try:
                    for v in s.vertices():
                        d = (Vector(tuple(v)) - Vector(f.origin)).dot(
                            Vector(f.z_dir))
                        if abs(d) > tolerance:
                            return False
                    return True
                except Exception:
                    return False
        elif callable(f):
            pred = f
        elif isinstance(f, property):
            # filter_by(Face.is_planar): a class PROPERTY used as a predicate
            _g = _property_getter(f)
            pred = lambda s: bool(_g(s))
        else:
            raise TypeError('filter_by: unsupported filter ' + repr(f))
        out = ShapeList([s for s in self if bool(pred(s)) != bool(reverse)])
        return out

    def filter_by_position(self, axis, minimum, maximum, inclusive=(True, True)):
        out = ShapeList()
        for s in self:
            v = _axis_value(s, axis)
            lo = v >= minimum if inclusive[0] else v > minimum
            hi = v <= maximum if inclusive[1] else v < maximum
            if lo and hi:
                out.append(s)
        # build123d returns the survivors SORTED along the same axis
        return out.sort_by(axis)

    def sort_by(self, key=Axis.Z, reverse=False, tie_break=False):
        """Sort by the given criterion (build123d ShapeList.sort_by).

        tie_break=False (the default) keeps Python's stable sort exactly, so
        ties carry the incoming order - which is itself a useful contract for
        CHAINED sorts (sort_by(SortBy.RADIUS).sort_by(Axis.Z) keeps the radius
        order inside each equal-Z group). COMPROMISE(traversal-order): that
        incoming order is the CAD kernel's traversal of lite's construction
        (not a kernel-version effect: native OCP 7.9.3 and 8.0.1 agree), so a
        script that resolves a COMPLETE tie this way (or keeps whichever of
        two symmetric results came last) can land on the other candidate
        than upstream's construction does - which is exactly the ambiguity the canonical
        rule below exists to remove, opt-in on both sides. tie_break=True instead resolves ties
        with _canonical_sort_key, so identical geometry always sorts identically
        rather than in the kernel's traversal order (see Curve.canonical). Like
        upstream, the geometric key is computed only for objects inside a tie
        group, and the center-based second stage only where the vertex key ties
        too."""
        fn = _sort_key_fn(key)
        decorated = [(fn(s), s) for s in self]
        if tie_break:
            # keys are computed only for the objects that actually tie, and the
            # cheap one (vertex positions) almost always settles it
            for tie_break_key in (_canonical_sort_key, _canonical_center_key):
                try:
                    tied = {}
                    for k, _ in decorated:
                        tied[k] = tied.get(k, 0) + 1
                except TypeError:  # unhashable keys from a custom callable
                    break
                if all([count == 1 for count in tied.values()]):
                    break
                decorated = [((k, tie_break_key(s) if tied[k] > 1 else ()), s)
                             for k, s in decorated]
        decorated = _stable_sorted(decorated, key=lambda pair: pair[0], reverse=reverse)
        return ShapeList([s for _, s in decorated])

    def sort_by_distance(self, other, reverse=False):
        """Sort by the MINIMAL distance between each shape and other
        (build123d ShapeList.sort_by_distance -> Shape.distance_to)."""
        return ShapeList(_stable_sorted(self, key=lambda s: s.distance_to(other),
                                reverse=reverse))

    def wires(self):
        out = ShapeList()
        for s in self:
            out.extend(s.wires())
        return out

    def group_by(self, key=Axis.Z, reverse=False, tol_digits=6):
        fn = _group_key_fn(key, tol_digits)
        ordered = _stable_sorted(self, key=fn, reverse=reverse)
        groups = []
        keys = []
        last = None
        for s in ordered:
            v = fn(s)
            if last is None or v != last:
                groups.append(ShapeList())
                keys.append(v)
                last = v
            groups[-1].append(s)
        return GroupBy(groups, keys, fn)

    def __sub__(self, other):
        removed = list(other)
        return ShapeList([s for s in self
                          if not any(s is o or (s.topo is not None and
                                                s.topo is o.topo)
                                     for o in removed)])

    @property
    def first(self):
        return self[0]

    @property
    def last(self):
        return self[-1]

    def __getitem__(self, i):
        r = _list_getitem(self, i)
        if isinstance(i, slice):
            return ShapeList(r)
        return r

    def __gt__(self, key):
        return self.sort_by(key)

    def __lt__(self, key):
        return self.sort_by(key, reverse=True)

    def __rshift__(self, key):
        """shapes >> key: the LAST group of group_by(key)."""
        return self.group_by(key)[-1]

    def __lshift__(self, key):
        """shapes << key: the FIRST group of group_by(key)."""
        return self.group_by(key)[0]

    def __or__(self, f):
        """shapes | f: filter_by(f) (e.g. edges() | Convexity.CONCAVE)."""
        return self.filter_by(f)

    def edges(self):
        out = ShapeList()
        for s in self:
            if isinstance(s, Edge):
                out.append(s)
            else:
                out.extend(s.edges())
        return out

    def faces(self):
        out = ShapeList()
        for s in self:
            if isinstance(s, Face):
                out.append(s)
            else:
                out.extend(s.faces())
        return out

    def vertices(self):
        out = ShapeList()
        for s in self:
            out.extend(s.vertices())
        return out

    def solids(self):
        out = ShapeList()
        for s in self:
            out.extend(s.solids())
        return out

    def _single(self, kind, items):
        if len(items) != 1:
            raise ValueError('Expected exactly one ' + kind + ', found ' +
                             str(len(items)))
        return items[0]

    def edge(self):
        return self._single('edge', self.edges())

    def face(self):
        return self._single('face', self.faces())

    def wire(self):
        return self._single('wire', self.wires())

    def vertex(self):
        return self._single('vertex', self.vertices())

    def solid(self):
        return self._single('solid', self.solids())


class GroupBy:
    """The result of ShapeList.group_by: groups reachable by INDEX or by KEY
    (build123d's GroupBy — group(key) is what the topology-selection docs
    use, e.g. length_groups.group(6))."""

    def __init__(self, groups, keys=None, key_f=None):
        self.groups = groups
        self.key_to_group_index = [(k, i) for i, k in enumerate(keys or [])]
        self.key_f = key_f

    def __getitem__(self, i):
        return self.groups[i]

    def __iter__(self):
        return iter(self.groups)

    def __len__(self):
        return len(self.groups)

    def group(self, key):
        """The group whose key equals key (build123d GroupBy.group)."""
        for k, i in self.key_to_group_index:
            if key == k:
                return self.groups[i]
        raise KeyError(key)

    def group_for(self, shape):
        """The group the given shape belongs to (build123d
        GroupBy.group_for)."""
        if self.key_f is None:
            raise KeyError(shape)
        return self.group(self.key_f(shape))


# build123d 0.12's build123d_type class variable (an external-application
# type tag on the geometry, topology and builder classes)
for _cls in (Vector, Axis, Location, Plane, Shape, Vertex, Edge, Wire, Face,
             Shell, Solid, Compound, Curve, Sketch, Part, ShapeList):
    _cls.build123d_type = _cls.__name__
Pos.build123d_type = 'Location'
Rotation.build123d_type = 'Location'
del _cls


# ------------------------------------------------------------- builders ---

_builders = []
_loc_stack = []


class _ObjectScope:
    """The construction firewall around a custom Base*Object (build123d 0.12
    BaseObjectMeta + an isolated BuildScope): while the object's __init__
    runs, the objects and builders it creates see NO builder and NO location
    context, so nothing it makes for itself leaks into the caller's builder
    or gets replicated by the caller's Locations. Pushed onto _builders by
    _BaseObjectMeta.__call__; the finished object is then placed and
    published to the caller like any built-in object."""

    def __init__(self):
        self._loc_depth = len(_loc_stack)


def _reset_state():
    """Clear the builder/location context stacks. Called by the worker
    before every user evaluation: the build123d module instance persists
    across runs, so a previous run that died inside a with-block (e.g. a
    JS-level abort that skipped Python unwinding) must not leak its stack
    into the next run."""
    del _builders[:]
    del _loc_stack[:]


def _active_builder(cls=None):
    if not _builders:
        return None
    b = _builders[-1]
    if isinstance(b, _ObjectScope):
        return None
    if cls is not None and not isinstance(b, cls):
        return None
    return b


def _ctx_locations():
    """The active locations, in the CURRENT scope only.

    build123d gives every builder (and, since 0.12, every custom object
    construction) a fresh identity location context on entry, so a Locations
    context wrapping a builder does NOT replicate what the builder constructs
    - the builder always builds locally on Plane.XY. Since 0.12 the enclosing
    locations instead PLACE the builder's finished result (its publication
    locations, captured in Builder.__enter__). Truncating at the innermost
    scope's stack depth reproduces both."""
    top = _builders[-1] if _builders else None
    start = top._loc_depth if (top is not None and
                               top._loc_depth is not None) else 0
    locs = [Location()]
    for ctx in _loc_stack[start:]:
        locs = [a * b for a in locs for b in ctx.locations]
    return locs


def _loc_is_identity(loc):
    t = loc._t
    return _mat_is_identity(loc._R) and abs(t[0]) <= _TOL and \
        abs(t[1]) <= _TOL and abs(t[2]) <= _TOL


def _sub_shapes_of(shape, kind):
    """The shape's vertices/edges/faces/solids for a Select bookkeeping kind."""
    if shape is None or getattr(shape, 'topo', None) is None:
        return []
    if kind == 'vertex':
        return list(shape.vertices())
    if kind == 'edge':
        return list(shape.edges())
    if kind == 'face':
        return list(shape.faces())
    return list(shape.solids())


def _ik6(x):
    """A micron-rounded INTEGER key component: float-tuple keys hash
    inconsistently on Brython (an integral JS number arrives as int, the
    same value computed in Python as float)."""
    return int(round(float(x) * 1e6))


def _shape_key(shape, kind):
    """Geometric identity of a sub-shape, for 'post - pre' set arithmetic.

    build123d compares TopoDS identity (which survives a boolean for untouched
    sub-shapes); lite rewraps every shape, so identity is taken from geometry
    instead: position for a vertex, midpoint+length for an edge,
    center+area for a face, center+volume for a solid."""
    topo = shape.topo
    if kind == 'vertex':
        p = w._vertexPoint(topo)
        return (_ik6(p[0]), _ik6(p[1]), _ik6(p[2]))
    if kind == 'edge':
        c = w._edgeMidpoint(topo)
        return (_ik6(c[0]), _ik6(c[1]), _ik6(c[2]),
                _ik6(w._edgeLength(topo)))
    if kind == 'face' or kind == 'shell':
        # CenterOfMass is a VOLUME integral in this build and degenerates to
        # the bounding-box corner on an open shape, so every face of a solid
        # got the same key — the face centroid is the honest identity
        c = tuple(w._faceCentroid(topo)) if kind == 'face' else \
            tuple(w.CenterOfMass(topo))
        return (_ik6(c[0]), _ik6(c[1]), _ik6(c[2]),
                _ik6(w.SurfaceArea(topo)))
    c = tuple(w.CenterOfMass(topo))
    return (_ik6(c[0]), _ik6(c[1]), _ik6(c[2]),
            _ik6(w.SolidsVolume(topo)))


def new_edges(*objects, combined=None):
    """build123d's new_edges(): the edges of 'combined' that none of 'objects'
    contributed - i.e. the edges the combining operation created
    (topology/utils.py). It predates 0.12's operation record and still
    compares shapes geometrically, like upstream's."""
    if combined is None:
        raise ValueError('new_edges() requires combined=')
    topos = []
    for o in objects:
        if isinstance(o, Builder):
            o = o._obj
        if o is not None and getattr(o, 'topo', None) is not None:
            topos.append(o.topo)
    if isinstance(combined, Builder):
        combined = combined._obj
    if combined is None or combined.topo is None:
        return ShapeList()
    # Return the CORRESPONDING edges of 'combined' (same parent + per-shape
    # index), so the result can be handed straight to fillet()/chamfer() the
    # way upstream's maker_coin does. The cut result is geometry only: it
    # carries no index, and its edges have fresh TopoDS handles.
    own = combined.edges()
    keyed = {}
    for e in own:
        c = w._edgeMidpoint(e.topo)
        keyed[(_ik6(c[0]), _ik6(c[1]), _ik6(c[2]),
               _ik6(w._edgeLength(e.topo)))] = e
    out = ShapeList()
    for raw in w.NewEdges(combined.topo, topos):
        c = w._edgeMidpoint(raw)
        key = (_ik6(c[0]), _ik6(c[1]), _ik6(c[2]),
               _ik6(w._edgeLength(raw)))
        match = keyed.get(key)
        # COMPROMISE(new-edges-partial): an edge that is only PARTLY new comes
        # back as a trimmed piece with no counterpart in 'combined'; it is
        # returned as bare geometry (usable for measuring, not for fillet()).
        out.append(match if match is not None else Edge(raw, parent=combined))
    return out


def _context_selector(name):
    """build123d's module-level selector getters (build_common's
    __gen_context_component_getter): 'edges()' inside a builder context is
    '<that builder>.edges()'."""
    def getter(select=Select.ALL):
        builder = _active_builder()
        if builder is None:
            raise RuntimeError(name + '() requires a Builder context to be in '
                               'scope')
        return getattr(builder, name)(select)
    return getter


def _align_sketch_faces(obj):
    """build123d's BuildSketch._add_to_context step 'Align sketch planar faces
    with Plane.XY': a face that is NOT coplanar with Plane.XY is expressed in
    its own plane's local frame and dropped onto z = 0, and every face is then
    oriented +Z (an up-side-down face is negated). Without the orientation
    half, a MIRRORED face never fuses with the face it was mirrored from
    (coplanar faces with opposite normals are not the same domain) and a
    BuildSketch mirror leaves two half faces behind."""
    faces = obj.faces()
    if not faces:
        return obj
    aligned = []
    changed = False
    for face in faces:
        normal = face.normal_at()
        coplanar = abs(normal.Z) > 1.0 - _TOL_1E6 and \
            abs(face.center().Z) <= _TOL_1E6
        if not coplanar:
            try:
                plane = Plane(origin=(0, 0, 0), x_dir=(1, 0, 0), z_dir=normal)
            except Exception:
                plane = Plane(origin=(0, 0, 0), z_dir=normal)
            # take the transformed FACE back out of the result (a transformed
            # shape is a generic TopoDS_Shape, which the face helpers reject)
            face = (plane.location.inverse() * face).faces()[0]
            face = (Pos(0, 0, -face.center().Z) * face).faces()[0]
            changed = True
        if face.normal_at().Z <= 0:
            face = -face
            changed = True
        aligned.append(face)
    if not changed:
        return obj
    topos = [_topo(f) for f in aligned]
    return Sketch(topos[0] if len(topos) == 1 else w.MakeCompound(topos))


def _pieces_of(obj):
    """The separate objects an operation brings into a builder: a Compound's
    DIRECT children (upstream _add_to_context reads them with
    Compound.get_type), otherwise the object itself. Kept separate so the
    fuse sees each piece as its own tool, like upstream's
    self._obj.fuse(*solids) - and so the record knows each piece was brought
    in."""
    if obj is None or obj.topo is None:
        return []
    kids = list(w.DirectChildren(obj.topo))
    if len(kids) > 1 and obj.topo.ShapeType().value == 0:
        return [_wrap_like(obj, k) for k in kids]
    return [obj]


def _combine(builder, obj, mode, warn_cls=None):
    """Merge obj into builder._obj per mode (upstream Builder._add_to_context
    for the builder's own shape type) and leave the operation's record on
    the result for Select.LAST/NEW: what was there before, what the
    operation brought in, and the kernel's history of the combining
    boolean. Returns the CREATED object."""
    if builder is None or mode == Mode.PRIVATE:
        return obj
    if isinstance(builder, BuildLine):
        builder._add_curve(obj, mode)
        return obj
    if isinstance(builder, BuildSketch) and obj is not None and \
            getattr(obj, 'topo', None) is not None:
        obj = _align_sketch_faces(obj)
    before = builder._obj
    if before is not None and before.topo is None:
        before = None
    pieces = _pieces_of(obj)
    before_topos = [before.topo] if before is not None else []
    if mode == Mode.REPLACE:
        # the replacement IS the result, so nothing was brought in; its own
        # record (a fillet's, a split's...) relates it to what it replaces
        record = ShapeHistory.of(obj)
        record = record.copy() if record is not None else ShapeHistory()
        builder._obj = builder._wrap(obj.topo)
        builder._obj._made_by(record.with_inputs(before_topos, []))
        return obj
    if before is None:
        if mode == Mode.SUBTRACT:
            raise ValueError('Mode.SUBTRACT with nothing to subtract from')
        if mode == Mode.INTERSECT:
            raise ValueError('Mode.INTERSECT with nothing to intersect')
        if len(pieces) > 1:
            fused = pieces[0] + pieces[1:]
            builder._obj = builder._wrap(fused.topo)
            record = fused._history.copy() if fused._history is not None \
                else ShapeHistory()
        else:
            builder._obj = builder._wrap(obj.topo)
            record = ShapeHistory()    # nothing changed: all untouched
    elif mode == Mode.ADD:
        result = before + pieces
        builder._obj = builder._wrap(result.topo)
        record = result._history.copy()
    elif mode == Mode.SUBTRACT:
        result = before - pieces
        builder._obj = builder._wrap(result.topo)
        record = result._history.copy()
    elif mode == Mode.INTERSECT:
        result = before & obj
        builder._obj = builder._wrap(result.topo)
        record = result._history.copy()
    else:
        raise ValueError('unsupported mode ' + repr(mode))
    builder._obj._made_by(record.with_inputs(before_topos,
                                             [p.topo for p in pieces]))
    return obj


def _publish_to(target, placed, mode):
    """Hand a finished builder's PLACED result to the builder it was nested
    in (upstream _PublicationService.publish -> target._add_to_context):
    a BuildPart takes faces as pending faces and a line as the pending
    path, a BuildSketch takes a line as pending edges, everything else is
    combined per mode."""
    if target is None or placed is None or mode == Mode.PRIVATE:
        return
    if isinstance(target, BuildLine):
        target._add_curve(placed, mode)
    elif isinstance(target, BuildSketch):
        if isinstance(placed, Mixin1D):
            specs = placed._specs if placed._specs else \
                _specs_from_topo_edges(placed)
            target.pending_edge_specs.extend(specs)
        else:
            _combine(target, placed, mode)
    elif isinstance(target, BuildPart):
        if isinstance(placed, Mixin1D):
            # a BuildLine directly inside BuildPart provides the sweep() path
            target.pending_path = placed
        elif placed.topo is not None and len(placed.solids()) == 0 and \
                len(placed.faces()) > 0:
            for f in placed.faces():
                target.pending_faces.append(Sketch(f.topo))
                target.pending_face_planes.append(Plane(f))
        else:
            _combine(target, placed, mode)


def _builder_placement(p):
    if isinstance(p, Location):
        return p
    if isinstance(p, Plane):
        return p.location
    if isinstance(p, Face):
        return Plane(p).location
    raise ValueError('Builder does not accept placement ' + type(p).__name__)


class Builder:
    """Base of the three builders (build123d 0.12 BuildScope model): a
    builder constructs LOCALLY on Plane.XY - its selectors, _obj and
    <part|sketch|line>_local are all local - and on exit PUBLISHES its
    result through its output placement(s) and the locations of any
    enclosing Locations context (so an enclosing Locations now positions a
    builder), handing the placed result to the builder it is nested in."""

    _shape_cls = Part
    _tag = 'part'
    _obj_name = 'None'
    build123d_type = 'Builder'

    def __init__(self, *placements, mode=Mode.ADD):
        locs = []
        for p in placements:
            if isinstance(p, (list, tuple)):
                locs.extend(_builder_placement(q) for q in p)
            else:
                locs.append(_builder_placement(p))
        self.output_placements = tuple(locs) if locs else (Location(),)
        self.placements = self.output_placements
        self.mode = mode
        self._label = ''
        self._obj = None
        self._loc_depth = None
        self._publication_locations = (Location(),)
        self._placed_obj = None
        self._parent = None
        self.pending_faces = []        # [Face/Sketch] for BuildPart
        self.pending_face_planes = []  # parallel [Plane] (build123d layout)
        self.joints = {}               # joints created with to_part=None
        self.pending_edge_specs = []  # segment specs for BuildSketch

    def _wrap(self, topo):
        return self._shape_cls(topo)

    @property
    def label(self):
        """Label assigned to the builder's output object (0.12)."""
        return self._label

    @label.setter
    def label(self, value):
        self._label = value

    @property
    def max_dimension(self):
        """Maximum size of the object in all directions."""
        o = self._obj
        if o is None or o.topo is None:
            return 0.0
        return o.bounding_box().diagonal

    def _lite_copy(self):
        """copy.copy(<builder>) — a SHALLOW copy of the builder, exactly like
        upstream's: the copy keeps a reference to the result object as it is
        NOW, and every later operation rebinds the original's _obj, so the copy
        is the snapshot the docs use it as (before_fillet = copy(part))."""
        clone = object.__new__(self.__class__)
        for key in list(self.__dict__.keys()):
            # setattr, not clone.__dict__[key] = ...: MicroPython instance
            # __dict__ is a read-only view
            setattr(clone, key, self.__dict__[key])
        return clone

    def __enter__(self):
        # where the ENCLOSING location context publishes this builder's
        # result (0.12: an enclosing Locations positions a builder) - read
        # BEFORE this builder's own (fresh) location scope starts
        self._publication_locations = tuple(_ctx_locations())
        self._loc_depth = len(_loc_stack)
        self._placed_obj = None
        # build123d only transfers a builder's result to the enclosing
        # builder when both with-statements share a stack frame (an inner
        # builder inside e.g. a BaseSketchObject subclass __init__ must NOT
        # auto-combine — the object machinery adds it instead)
        self._python_frame = w._pythonCallerFrame()
        enclosing = _active_builder()
        if enclosing is not None and \
                enclosing._python_frame is self._python_frame:
            self._parent = enclosing
        else:
            self._parent = None
        _builders.append(self)
        return self

    def _exit_extras(self):
        """Any builder specific exit actions."""

    def __exit__(self, exc_type, exc, tb):
        del _loc_stack[self._loc_depth:]
        for i in range(len(_builders) - 1, -1, -1):
            if _builders[i] is self:
                del _builders[i:]
                break
        if exc_type is not None:
            return False
        self._exit_extras()
        local = self._obj
        if local is not None and local.topo is None:
            local = None
        if local is not None and self._label:
            local.label = self._label
        placed = self._place(local)
        self._placed_obj = placed
        parent = self._parent
        if parent is not None and self.mode != Mode.PRIVATE:
            if placed is None:
                _warn(self._obj_name + ' is None - ' + type(self).__name__ +
                      " didn't create anything")
            else:
                _publish_to(parent, placed, self.mode)
        return False

    def _place(self, local):
        """Apply every publication location x output placement combination
        once (upstream _PublicationService.place)."""
        if local is None or local.topo is None:
            return None
        combos = [p * o for p in self._publication_locations
                  for o in self.output_placements]
        if len(combos) == 1 and _loc_is_identity(combos[0]):
            return local
        placed = [loc * local for loc in combos]
        if len(placed) == 1:
            result = placed[0]
        else:
            result = self._place_many(placed)
        if local.label and not result.label:
            result.label = local.label
        if local.color is not None and result.color is None:
            result.color = local.color
        if getattr(local, '_material', None) is not None and \
                getattr(result, '_material', None) is None:
            result._material = local._material
        return result

    def _place_many(self, placed):
        return self._shape_cls(w.MakeCompound([p.topo for p in placed]))

    def _output_obj(self):
        """The PLACED result: after exit the published object; inside the
        builder's own scope it is placed on demand; inside a nested location
        context (where the scope belongs to the Locations) upstream hands
        back the local object."""
        if self._placed_obj is not None:
            return self._placed_obj
        if _builders and _builders[-1] is self and \
                len(_loc_stack) == self._loc_depth:
            return self._place(self._obj)
        return self._obj

    @property
    def location(self):
        """The (placed) result's location (build123d BuildPart.location)."""
        o = self._output_obj()
        return o.location if o is not None else Location()

    def locate(self, loc):
        if self._obj is None:
            raise ValueError('builder has no result to locate')
        return self._obj.locate(loc)

    @property
    def new_edges(self):
        """Edges the last operation created outright, as edges(Select.NEW)
        (deprecated in build123d 0.12)."""
        _warn('Builder.new_edges is deprecated; use edges(Select.NEW) '
              'instead.', 'DeprecationWarning')
        return self.edges(Select.NEW)

    # ---------------------------------------------------------------- #
    # Select.LAST / Select.NEW (build123d 0.12): read from the record the
    # last operation left on the builder's object (see _combine and
    # ShapeHistory) - the kernel's own history, so a face an operation
    # merely trimmed is NOT last, and NEW works for every shape type.
    # ---------------------------------------------------------------- #
    def _selection_shape(self):
        return self._obj

    def _selected(self, kind, select):
        shape = self._selection_shape()
        if shape is None or shape.topo is None:
            return ShapeList()
        return getattr(shape, kind)(select)

    @property
    def lasts(self):
        return dict((k, self._selected(k, Select.LAST))
                    for k in ('vertices', 'edges', 'faces', 'solids'))

    @property
    def news(self):
        return dict((k, self._selected(k, Select.NEW))
                    for k in ('vertices', 'edges', 'faces', 'solids'))

    def vertices(self, select=Select.ALL):
        return self._selected('vertices', select)

    def edges(self, select=Select.ALL):
        return self._selected('edges', select)

    def wires(self, select=Select.ALL):
        if select == Select.ALL:
            return self._selected('wires', select)
        return ShapeList(edges_to_wires(self.edges(select)))

    def faces(self, select=Select.ALL):
        return self._selected('faces', select)

    def solids(self, select=Select.ALL):
        return self._selected('solids', select)

    # singular getters (build_common Builder.vertex/edge/wire/face/solid):
    # exactly one sub-shape must be selected, like upstream
    def vertex(self, select=Select.ALL):
        all_vertices = self.vertices(select)
        vertex_count = len(all_vertices)
        if vertex_count != 1:
            raise ValueError('Expected exactly one vertex, found ' +
                             str(vertex_count))
        return all_vertices[0]

    def edge(self, select=Select.ALL):
        all_edges = self.edges(select)
        edge_count = len(all_edges)
        if edge_count != 1:
            raise ValueError('Expected exactly one edge, found ' +
                             str(edge_count))
        return all_edges[0]

    def wire(self, select=Select.ALL):
        all_wires = self.wires(select)
        wire_count = len(all_wires)
        if wire_count != 1:
            raise ValueError('Expected exactly one wire, found ' +
                             str(wire_count))
        return all_wires[0]

    def face(self, select=Select.ALL):
        all_faces = self.faces(select)
        face_count = len(all_faces)
        if face_count != 1:
            raise ValueError('Expected exactly one face, found ' +
                             str(face_count))
        return all_faces[0]

    def solid(self, select=Select.ALL):
        all_solids = self.solids(select)
        solid_count = len(all_solids)
        if solid_count != 1:
            raise ValueError('Expected exactly one solid, found ' +
                             str(solid_count))
        return all_solids[0]


class BuildPart(Builder):
    _shape_cls = Part
    _tag = 'part'
    _obj_name = 'part'
    build123d_type = 'BuildPart'

    @property
    def part(self):
        """The PLACED part (0.12; part_local is the local construction)."""
        return self._output_obj()

    @property
    def part_local(self):
        return self._obj

    @property
    def _snapshot(self):
        return self._obj

    def _exit_extras(self):
        # transfer joints created in this context onto the (local) result
        # shape (build123d BuildPart._exit_extras)
        if self.joints and self._obj is not None:
            self._obj.joints = self.joints
            for j in self.joints.values():
                j.parent = self._obj


class BuildSketch(Builder):
    _shape_cls = Sketch
    _tag = 'sketch'
    _obj_name = 'sketch'
    build123d_type = 'BuildSketch'

    @property
    def sketch(self):
        """The PLACED sketch (sketch_local is the construction on
        Plane.XY)."""
        return self._output_obj()

    @property
    def sketch_local(self):
        return self._obj

    def solids(self, *args):
        raise NotImplementedError("solids() doesn't apply to BuildSketch")


class BuildLine(Builder):
    """BuildLine keeps its curve as LOCAL segment specs (so make_face()/
    sweep() chain exact geometry); _obj / line_local is the curve built from
    them and .line the placed one. Select.LAST/NEW use the geometric 'post -
    pre' comparison: the line is re-chained from its specs, so no TopoDS
    identity survives between operations for a kernel record to describe
    - COMPROMISE(buildline-select)."""

    _shape_cls = Curve
    _tag = 'line'
    _obj_name = 'line'
    build123d_type = 'BuildLine'

    def __init__(self, *placements, mode=Mode.ADD):
        self._specs = []
        Builder.__init__(self, *placements, mode=mode)
        if len(self.output_placements) > 1:
            raise ValueError('BuildLine only accepts one placement')
        self._specs = []
        self._lasts_before = None
        self._lasts_brought = None

    @property
    def _obj(self):
        if not self._specs:
            return None
        return Curve(w.WireFromSegments(_chain_segments(self._specs)),
                     list(self._specs))

    @_obj.setter
    def _obj(self, value):
        if value is None:
            self._specs = []
        elif isinstance(value, Mixin1D) and value._specs:
            self._specs = list(value._specs)
        else:
            self._specs = _specs_from_topo_edges(value)

    @property
    def line(self):
        """The PLACED line (line_local is the construction on Plane.XY)."""
        return self._output_obj()

    @property
    def line_local(self):
        return self._obj

    # --- spec bookkeeping (every BuildLine operation goes through these) ---
    def _add_specs(self, specs):
        self._lasts_before = list(self._specs)
        self._lasts_brought = list(specs)
        self._specs.extend(specs)

    def _set_specs(self, specs):
        """An operation REPLACED the whole line (fillet, offset...)."""
        self._lasts_before = list(self._specs)
        self._lasts_brought = []
        self._specs = list(specs)

    def _add_curve(self, curve, mode):
        if curve is None or mode == Mode.PRIVATE:
            return
        specs = curve._specs if (isinstance(curve, Mixin1D) and curve._specs) \
            else _specs_from_topo_edges(curve)
        if mode == Mode.REPLACE:
            self._set_specs(specs)
        elif mode == Mode.ADD:
            self._add_specs(specs)
        else:
            raise ValueError(str(mode) + ' is not supported inside BuildLine')

    def _place_many(self, placed):
        specs = []
        for p in placed:
            specs.extend(p._specs or [])
        return Curve(w.MakeCompound([p.topo for p in placed]), specs)

    def _selected(self, kind, select):
        line = self._obj
        if line is None:
            return ShapeList()
        if select is None or select == Select.ALL:
            return getattr(line, kind)()
        if select != Select.LAST and select != Select.NEW:
            raise ValueError('Invalid input, must be one of ' +
                             repr([Select.ALL, Select.LAST, Select.NEW]))
        key_kind = {'vertices': 'vertex', 'edges': 'edge', 'faces': 'face',
                    'solids': 'solid'}[kind]
        if self._lasts_before is None:
            # never operated on: everything was brought in by nothing
            return getattr(line, kind)() if select == Select.LAST \
                else ShapeList()

        def _keys(specs):
            if not specs:
                return set()
            c = Curve(w.WireFromSegments(_chain_segments(specs)), list(specs))
            return set(_shape_key(s, key_kind) for s in getattr(c, kind)())
        before = _keys(self._lasts_before)
        brought = _keys(self._lasts_brought)
        out = ShapeList()
        for s in getattr(line, kind)():
            k = _shape_key(s, key_kind)
            if select == Select.LAST:
                if k in brought or k not in before:
                    out.append(s)
            elif k not in brought and k not in before:
                out.append(s)
        return out

    def faces(self, *args):
        raise NotImplementedError("faces() doesn't apply to BuildLine")

    def solids(self, *args):
        raise NotImplementedError("solids() doesn't apply to BuildLine")


# Selectors that read the builder in scope: 'edges()' == '<builder>.edges()'
# (build123d exports these alongside the methods, and the docs use them).
vertices = _context_selector('vertices')
edges = _context_selector('edges')
wires = _context_selector('wires')
faces = _context_selector('faces')
solids = _context_selector('solids')
# ... and the singular forms (vertex() == '<builder>.vertex()', which raises
# unless exactly one is selected — build_common's singular getters)
vertex = _context_selector('vertex')
edge = _context_selector('edge')
wire = _context_selector('wire')
face = _context_selector('face')
solid = _context_selector('solid')


class _BaseObjectMeta(type):
    """build123d 0.12 BaseObjectMeta: construct a custom Base*Object behind
    a builder + placement firewall (an _ObjectScope), then place the finished
    object at the CALLER's locations and publish it to the caller's builder.
    So objects a custom object's __init__ creates for itself no longer leak
    into the caller's builder, and the caller's Locations place the object
    as a whole."""

    def __call__(cls, *args, **kwargs):
        caller = _active_builder()
        applies = getattr(cls, '_lite_applies_to', None)
        if caller is not None and applies is not None and \
                not isinstance(caller, _BUILDER_CLASSES[applies]):
            raise RuntimeError(type(caller).__name__ + " doesn't have a " +
                               cls.__name__ + ' object or operation (' +
                               cls.__name__ + " applies to ['" + applies +
                               "'])")
        locs = _ctx_locations()
        scope = _ObjectScope()
        _builders.append(scope)
        try:
            instance = super().__call__(*args, **kwargs)
        finally:
            for i in range(len(_builders) - 1, -1, -1):
                if _builders[i] is scope:
                    del _builders[i:]
                    break
            del _loc_stack[scope._loc_depth:]
        instance._lite_publish(caller, locs)
        return instance


_BUILDER_CLASSES = {'BuildPart': BuildPart, 'BuildSketch': BuildSketch,
                    'BuildLine': BuildLine}


def _probe_metaclass():
    """Custom metaclasses run instance construction on CPython, Brython and
    the patched MicroPython (micropython-cs). COMPROMISE(object-firewall):
    the STOCK MicroPython fallback artifact has none, so there custom
    Base*Objects keep the pre-0.12 direct publication path (objects created
    inside a custom object's __init__ can reach the caller's builder)."""
    try:
        class _ProbeMeta(type):
            def __call__(cls, *args, **kwargs):
                return 'meta'

        _Probe = _ProbeMeta('_Probe', (), {})
        return _Probe() == 'meta'
    except Exception:
        return False


_HAS_METACLASS = _probe_metaclass()


class _BaseObjectMixin:
    """Publication behaviour shared by the Base*Object classes."""

    def _lite_publish(self, caller, locs):
        mode = getattr(self, 'mode', Mode.ADD)
        if self.topo is None:
            return
        if not (len(locs) == 1 and _loc_is_identity(locs[0])):
            placed = [loc * self for loc in locs]
            if len(placed) == 1:
                one = placed[0]
                topo, loc_, joints = one.topo, one._loc, one.joints
            else:
                topo = w.MakeCompound([p.topo for p in placed])
                loc_, joints = self._loc, self.joints
            specs = []
            if isinstance(self, Mixin1D):
                for p in placed:
                    specs.extend(p._specs or [])
            # preserve identity: the instance itself adopts the placement
            self.topo = topo
            self._loc = loc_
            self.joints = dict((k, j._lite_rebind(self))
                               for k, j in joints.items())
            if isinstance(self, Mixin1D):
                self._specs = specs
        if caller is None or mode == Mode.PRIVATE:
            return
        if isinstance(caller, BuildLine):
            caller._add_curve(self, mode)
        else:
            _combine(caller, self, mode)


if _HAS_METACLASS:
    _BaseObject = _BaseObjectMeta('_BaseObject', (_BaseObjectMixin,), {})
else:
    _BaseObject = _BaseObjectMixin


# ------------------------------------------------- location contexts -----

class LocationList:
    def __init__(self, locations):
        self.locations = list(locations)

    def __enter__(self):
        _loc_stack.append(self)
        return self

    def __exit__(self, exc_type, exc, tb):
        _loc_stack.pop()
        return False

    def __iter__(self):
        return iter(self.locations)

    def __getitem__(self, i):
        return self.locations[i]

    def __len__(self):
        return len(self.locations)

    @property
    def local_locations(self):
        return list(self.locations)

    def append(self, loc):
        """Location * GridLocations(...) products are mutable lists in
        build123d — stud_wall appends extra studs to one."""
        self.locations.append(loc)

    def extend(self, locs):
        self.locations.extend(locs)

    def __mul__(self, other):
        # PolarLocations(...) * shape -> copies at every location (algebra)
        if isinstance(other, Shape):
            return ShapeList([loc * other for loc in self.locations])
        if isinstance(other, (list, tuple, ShapeList)):
            return ShapeList([loc * s for loc in self.locations for s in other])
        return NotImplemented

    def __rmul__(self, other):
        # Location * GridLocations(...) -> composed location list
        if isinstance(other, Location):
            return LocationList([other * loc for loc in self.locations])
        if isinstance(other, Plane):
            return LocationList([other.location * loc for loc in self.locations])
        return NotImplemented


def _flatten_points(items):
    """build123d flatten_sequence for Locations: lists, sets, non-point
    tuples and iterators (generators, map, zip...) are flattened; a tuple of
    numbers is a point, and Vector/Vertex/Location/Plane/Axis/Face stay
    whole."""
    out = []
    for item in items:
        if isinstance(item, (Location, Vector, Vertex, Plane, Axis, Shape,
                             str, int, float)):
            out.append(item)
        elif isinstance(item, tuple) and \
                all(isinstance(v, (int, float)) for v in item):
            out.append(item)
        else:
            try:
                nested = list(item)
            except TypeError:
                out.append(item)
                continue
            out.extend(_flatten_points(nested))
    return out


class Locations(LocationList):
    def __init__(self, *pts):
        locs = []
        for p in _flatten_points(pts):
            if isinstance(p, Location):
                locs.append(p)
            elif isinstance(p, Plane):
                locs.append(p.location)
            elif isinstance(p, Face):
                locs.append(Plane(p).location)
            elif isinstance(p, Vertex):
                locs.append(Pos(p.X, p.Y, p.Z))
            elif isinstance(p, Axis):
                pl = Plane(p.position, z_dir=p.direction)
                locs.append(pl.location)
            else:
                locs.append(Pos(Vector(p)))
        LocationList.__init__(self, locs)


class GridLocations(LocationList):
    def __init__(self, x_spacing, y_spacing, x_count, y_count,
                 align=(Align.CENTER, Align.CENTER)):
        x_count, y_count = int(x_count), int(y_count)
        align = _norm_align(align, 2)
        ox = _grid_offset(align[0], x_spacing * (x_count - 1))
        oy = _grid_offset(align[1], y_spacing * (y_count - 1))
        locs = []
        # build123d iterates x in the outer loop (y varies fastest)
        for i in range(x_count):
            for j in range(y_count):
                locs.append(Pos(i * x_spacing + ox, j * y_spacing + oy, 0))
        LocationList.__init__(self, locs)


def _grid_offset(a, extent):
    if a == Align.CENTER:
        return -extent / 2.0
    if a == Align.MAX:
        return -extent
    return 0.0


class HexLocations(LocationList):
    """Hexagon-array locations (build123d HexLocations, ported verbatim):
    radius is the major radius (centre to vertex) with major_radius=True,
    otherwise the apothem; the array is aligned on its own bounding box."""

    def __init__(self, radius, x_count, y_count, major_radius=False,
                 align=(Align.CENTER, Align.CENTER)):
        x_count, y_count = int(x_count), int(y_count)
        if major_radius:
            diagonal = 2 * radius
            apothem = radius * math.cos(math.pi / 6)
        else:
            diagonal = 4 * radius / math.sqrt(3)
            apothem = radius
        x_spacing = 3 * diagonal / 4
        y_spacing = diagonal * math.sqrt(3) / 2
        if x_spacing <= 0 or y_spacing <= 0 or x_count < 1 or y_count < 1:
            raise ValueError('Spacing and count must be > 0 ')
        self.radius = radius
        self.apothem = apothem
        self.diagonal = diagonal
        self.x_count = x_count
        self.y_count = y_count
        self.major_radius = major_radius
        self.align = _norm_align(align, 2)
        points = []
        for x_val in range(0, x_count, 2):
            for y_val in range(y_count):
                points.append((x_spacing * x_val,
                               y_spacing * y_val + y_spacing / 2))
        for x_val in range(1, x_count, 2):
            for y_val in range(y_count):
                points.append((x_spacing * x_val, y_spacing * y_val + y_spacing))
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        size = (max(xs) - min(xs), max(ys) - min(ys))
        al = self.align
        offset = []
        for i in range(2):
            if al[i] == Align.MIN:
                offset.append(0.0)
            elif al[i] == Align.MAX:
                offset.append(-size[i])
            elif al[i] == Align.CENTER:
                offset.append(-size[i] / 2)
            else:
                offset.append(0.0)
        min_x, min_y = min(xs), min(ys)
        LocationList.__init__(self, [Pos(p[0] + offset[0] - min_x,
                                         p[1] + offset[1] - min_y, 0)
                                     for p in points])


class PolarLocations(LocationList):
    def __init__(self, radius, count, start_angle=0.0, angular_range=360.0,
                 rotate=True, endpoint=False):
        count = int(count)
        if count < 1:
            raise ValueError('At least 1 elements required, requested ' +
                             str(count))
        if count == 1:
            step = 0.0
        else:
            step = angular_range / (count - int(endpoint))
        locs = []
        for i in range(count):
            a = start_angle + i * step
            loc = Pos(radius * math.cos(math.radians(a)),
                      radius * math.sin(math.radians(a)), 0)
            if rotate:
                loc = loc * Rot(0, 0, a)
            locs.append(loc)
        LocationList.__init__(self, locs)


# ----------------------------------------------------- object creation ---

def _norm_align(align, n):
    if align is None:
        return (None,) * n
    if isinstance(align, (tuple, list)):
        return tuple(align)
    # a single Align value applies on every axis; lite's own values are
    # strings, the upstream seam's are (non-iterable) enum members
    return (align,) * n


def _align_shift(align, bbox_min, bbox_max):
    shift = []
    for i in range(3):
        a = align[i] if i < len(align) else None
        if a == Align.MIN:
            shift.append(-bbox_min[i])
        elif a == Align.CENTER:
            shift.append(-(bbox_min[i] + bbox_max[i]) / 2.0)
        elif a == Align.MAX:
            shift.append(-bbox_max[i])
        else:
            shift.append(0.0)
    return shift


def _create_object(cls, topo_maker, analytic_bbox, rotation3, align, mode,
                   builder_cls):
    """Shared creation pipeline: align (own bbox) -> rotate -> place at the
    active locations -> combine into the builder. Since build123d 0.12 a
    builder constructs LOCALLY (its placement applies when it publishes), so
    only the location context places objects; several placements make a
    Compound, like upstream's BaseObject publication."""
    builder = _active_builder(builder_cls)
    top = _active_builder()
    if builder is None and top is not None:
        raise RuntimeError(type(top).__name__ + " doesn't have a " +
                           cls.__name__ + ' object or operation')
    ctx_locs = _ctx_locations()

    rot = None
    if rotation3 is not None:
        if isinstance(rotation3, (int, float)):
            rotation3 = (0.0, 0.0, rotation3)
        r = tuple(rotation3)
        if r[0] or r[1] or r[2]:
            rot = Rotation(r[0], r[1], r[2])

    results = []
    for loc in ctx_locs:
        topo = topo_maker()
        if align is not None and any(a is not None for a in align):
            if analytic_bbox is not None:
                bmin, bmax = analytic_bbox
            else:
                bb = list(w.BoundingBox(topo))
                bmin, bmax = bb[0:3], bb[3:6]
            sh = _align_shift(align, bmin, bmax)
            if sh[0] or sh[1] or sh[2]:
                topo = w.Translate(sh, topo)
        shape = object.__new__(cls)
        Shape.__init__(shape, topo)
        if rot is not None:
            shape = rot * shape
        if not _loc_is_identity(loc):
            shape = loc * shape
        results.append(shape)

    if len(results) == 1:
        obj = results[0]
    else:
        obj = object.__new__(cls)
        Shape.__init__(obj, w.MakeCompound([r.topo for r in results]))
    # Select.LAST/NEW bookkeeping happens inside _combine for every operation.
    return _combine(builder, obj, mode)


# ------------------------------------------------------- 3D primitives ---

def Box(length, width, height, rotation=(0, 0, 0),
        align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    bbox = ((-length / 2.0, -width / 2.0, -height / 2.0),
            (length / 2.0, width / 2.0, height / 2.0))
    return _create_object(Part, lambda: w.Box(length, width, height, True),
                          bbox, rotation, align, mode, BuildPart)


def Cylinder(radius, height, arc_size=360, rotation=(0, 0, 0),
             align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    if arc_size >= 360:
        bbox = ((-radius, -radius, -height / 2.0), (radius, radius, height / 2.0))
        maker = lambda: w.Cylinder(radius, height, True)
    else:
        bbox = None  # measured from the pie's own bounds, like build123d

        def maker():
            prof = w.Polygon([[0, 0, -height / 2.0], [radius, 0, -height / 2.0],
                              [radius, 0, height / 2.0], [0, 0, height / 2.0]])
            return w.Revolve(prof, arc_size, [0, 0, 1])
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def Sphere(radius, arc_size1=-90, arc_size2=90, arc_size3=360,
           rotation=(0, 0, 0),
           align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    if arc_size1 == -90 and arc_size2 == 90 and arc_size3 == 360:
        bbox = ((-radius, -radius, -radius), (radius, radius, radius))
        return _create_object(Part, lambda: w.Sphere(radius), bbox, rotation,
                              align, mode, BuildPart)
    # partial sphere: BRepPrimAPI_MakeSphere's two latitude angles and the
    # longitude sweep, exactly build123d's Solid.make_sphere arguments. The
    # bounding box is measured (a spherical wedge has no simple analytic box).
    def maker():
        return w.PartialSphere(radius, arc_size1, arc_size2, arc_size3)
    return _create_object(Part, maker, None, rotation, align, mode, BuildPart)


def Cone(bottom_radius, top_radius, height, arc_size=360, rotation=(0, 0, 0),
         align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if arc_size < 360:
        raise NotImplementedError('partial cones are not supported in build123d-lite')
    align = _norm_align(align, 3)
    r = max(bottom_radius, top_radius)
    bbox = ((-r, -r, -height / 2.0), (r, r, height / 2.0))

    def maker():
        return w.Translate([0, 0, -height / 2.0],
                           w.Cone(bottom_radius, top_radius, height))
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def Torus(major_radius, minor_radius, rotation=(0, 0, 0),
          align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    align = _norm_align(align, 3)
    r = major_radius + minor_radius
    bbox = ((-r, -r, -minor_radius), (r, r, minor_radius))

    def maker():
        prof = w.Circle(minor_radius, False)
        prof = w.Rotate([1, 0, 0], 90, prof)
        prof = w.Translate([major_radius, 0, 0], prof)
        return w.Revolve(prof, 360, [0, 0, 1])
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def ConvexPolyhedron(points, rotation=(0, 0, 0), align=Align.NONE,
                     mode=Mode.ADD):
    """Part Object: the convex hull of the given points as a solid
    (build123d ConvexPolyhedron): every hull facet becomes a polygonal Face,
    which are then sewn into a Shell and solidified."""
    pnts = [tuple(_v3(p)) for p in points]
    # the same quickhull3d the scipy shim's ConvexHull uses (upstream reads
    # scipy's .simplices here)
    faces = []
    for facet in w.ConvexHull3D([list(p) for p in pnts]):
        corners = [pnts[int(i)] for i in facet]
        faces.append(Face(Curve([Edge.make_line(corners[i], corners[
            (i + 1) % len(corners)]) for i in range(len(corners))])))
    solid = Part(w.SewSolidFromFaces([f.topo for f in faces]))
    maker = lambda: solid.topo
    align3 = _norm_align(align, 3) if align is not None else None
    return _create_object(Part, maker, None, rotation, align3, mode, BuildPart)


def Wedge(xsize, ysize, zsize, xmin, zmin, xmax, zmax, rotation=(0, 0, 0),
          align=(Align.CENTER, Align.CENTER, Align.CENTER), mode=Mode.ADD):
    """Part Object: a wedge whose near face is xsize by zsize and whose far
    face spans xmin..xmax by zmin..zmax, ysize deep (build123d Wedge ->
    Solid.make_wedge -> BRepPrimAPI_MakeWedge's min/max form)."""
    if any([v <= 0 for v in (xsize, ysize, zsize)]):
        raise ValueError('xsize, ysize & zsize must all be greater than zero')
    align = _norm_align(align, 3)
    bbox = ((0.0, 0.0, 0.0), (xsize, ysize, zsize))
    maker = lambda: w.WedgeMinMax(xsize, ysize, zsize, xmin, zmin, xmax, zmax)
    return _create_object(Part, maker, bbox, rotation, align, mode, BuildPart)


def _through_hole_depth():
    """build123d 0.12 _BaseHole._through_hole_depth: the part's bounding-box
    diagonal plus the farthest any active hole location sits from the
    part's centre (so holes on parts away from the origin still cut
    through)."""
    builder = _active_builder(BuildPart)
    if builder is None or builder._obj is None or builder._obj.topo is None:
        raise ValueError('No depth provided')
    center = builder._obj.bounding_box().center()
    dist = 0.0
    for loc in _ctx_locations():
        dist = max(dist, (center - loc.position).length)
    return builder.max_dimension + dist


def _hole_length(depth):
    """Half-length of a hole cylinder: given depth, or 'through everything'.
    build123d holes are CENTERED on the location and span +-depth."""
    if depth is not None:
        return depth
    return _through_hole_depth()


def Hole(radius, depth=None, mode=Mode.SUBTRACT):
    ln = _hole_length(depth)
    # build123d: cylinder of height 2*depth centered at the location
    maker = lambda: w.Cylinder(radius, 2.0 * ln, True)
    return _create_object(Part, maker, None, None, None, mode, BuildPart)


def CounterBoreHole(radius, counter_bore_radius, counter_bore_depth,
                    depth=None, mode=Mode.SUBTRACT):
    ln = _hole_length(depth)

    def maker():
        # hole spans -ln..+ln; the counterbore spans -cb_depth..+ln
        hole = w.Cylinder(radius, 2.0 * ln, True)
        bore = w.Translate([0, 0, -counter_bore_depth],
                           w.Cylinder(counter_bore_radius,
                                      counter_bore_depth + ln, False))
        return w.Union([bore, hole])
    return _create_object(Part, maker, None, None, None, mode, BuildPart)


def CounterSinkHole(radius, counter_sink_radius, depth=None,
                    counter_sink_angle=82, mode=Mode.SUBTRACT):
    ln = _hole_length(depth)
    sink_depth = ((counter_sink_radius - radius) /
                  math.tan(math.radians(counter_sink_angle / 2.0)))

    def maker():
        # hole spans -ln..+ln; countersink cone flares from the hole radius
        # at -sink_depth to counter_sink_radius at z=0, then continues as a
        # cylinder of that radius up to +ln (through the space above)
        hole = w.Cylinder(radius, 2.0 * ln, True)
        cone = w.Translate([0, 0, -sink_depth],
                           w.Cone(radius, counter_sink_radius, sink_depth))
        cap = w.Cylinder(counter_sink_radius, ln, False)
        return w.Union([cone, cap, hole])
    return _create_object(Part, maker, None, None, None, mode, BuildPart)


# ------------------------------------------------------- 2D primitives ---

class BasePartObject(Part, _BaseObject):
    """Base for user-defined part objects: places an existing Part with
    rotation/align/mode like the built-in primitives (build123d compat).
    Constructed behind the _BaseObjectMeta firewall, then placed at the
    caller's locations and published to the caller's BuildPart (0.12)."""

    _lite_applies_to = 'BuildPart'

    def __init__(self, part, rotation=(0, 0, 0),
                 align=None, mode=Mode.ADD):
        topo = _topo(part)
        align3 = _norm_align(align, 3) if align is not None else None
        created = _create_object(Part, lambda: topo, None, rotation, align3,
                                 mode, BuildPart)
        Shape.__init__(self, created.topo)
        self.mode = mode
        if isinstance(rotation, (int, float)):
            rotation = (0, 0, rotation)
        self.rotation = Rotation(*rotation) if isinstance(rotation, tuple) \
            else rotation
        if isinstance(part, Shape):
            if part.label:
                self.label = part.label
            if getattr(part, '_material', None) is not None:
                self._material = part._material
            if part.joints:
                # 0.12: joints of the input part follow it into the object
                # (rotated with it) and are re-parented onto the object
                rotated = self.rotation * part
                self._loc = rotated._loc
                self.joints = dict((k, j._lite_rebind(self))
                                   for k, j in rotated.joints.items())


class BaseSketchObject(Sketch, _BaseObject):
    """Base for user-defined sketch objects (build123d compat)."""

    _lite_applies_to = 'BuildSketch'

    def __init__(self, obj, rotation=0, align=None, mode=Mode.ADD):
        topo = _topo(obj)
        created = _sketch_object(lambda: topo, None, rotation, align, mode)
        Shape.__init__(self, created.topo)
        self.mode = mode
        self.rotation = rotation


def _sketch_object(topo_maker, analytic_bbox, rotation, align, mode):
    align3 = None
    if align is not None:
        a2 = _norm_align(align, 2)
        align3 = (a2[0], a2[1], None)
    bbox3 = None
    if analytic_bbox is not None and align3 is not None:
        (x0, y0), (x1, y1) = analytic_bbox
        bbox3 = ((x0, y0, 0.0), (x1, y1, 0.0))
    rot3 = None
    if rotation:
        rot3 = (0.0, 0.0, rotation)
    return _create_object(Sketch, topo_maker, bbox3, rot3, align3, mode,
                          BuildSketch)


def Rectangle(width, height, rotation=0,
              align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    x, y = width / 2.0, height / 2.0
    maker = lambda: w.Polygon([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]])
    return _sketch_object(maker, ((-x, -y), (x, y)), rotation, align, mode)


def Circle(radius, align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    maker = lambda: w.Circle(radius, False)
    return _sketch_object(maker, ((-radius, -radius), (radius, radius)),
                          0, align, mode)


def Ellipse(*args, **kwargs):
    raise NotImplementedError('Ellipse is not supported in build123d-lite '
                              '(no ellipse curve binding)')


def Polygon(*pts, rotation=0, align=None, mode=Mode.ADD):
    if len(pts) == 1 and not isinstance(pts[0], (Vector,)) and \
            _is_nested_seq(pts[0]):
        pts = tuple(pts[0])
    p3 = [_v3(p) for p in pts]
    xs = [p[0] for p in p3]
    ys = [p[1] for p in p3]
    maker = lambda: w.Polygon([[p[0], p[1], 0] for p in p3])
    return _sketch_object(maker, ((min(xs), min(ys)), (max(xs), max(ys))),
                          rotation, align, mode)


def RegularPolygon(radius, side_count, major_radius=True, rotation=0,
                   align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    r = radius if major_radius else radius / math.cos(math.pi / side_count)
    pts = []
    for i in range(side_count):
        a = 2.0 * math.pi * i / side_count
        pts.append([r * math.cos(a), r * math.sin(a), 0])
    maker = lambda: w.Polygon(pts)
    # build123d aligns RegularPolygon on its circumcircle (+-r), not its bbox
    return _sketch_object(maker, ((-r, -r), (r, r)), rotation, align, mode)


def RectangleRounded(width, height, radius, rotation=0,
                     align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if radius <= 0 or radius >= min(width, height) / 2.0:
        raise ValueError('RectangleRounded: invalid corner radius')
    x, y, r = width / 2.0, height / 2.0, radius
    k = r * (1.0 - math.sqrt(0.5))  # arc midpoint inset at 45 degrees
    segs = [
        ['line', [[-x + r, -y, 0], [x - r, -y, 0]]],
        ['arc3', [[x - r, -y, 0], [x - k, -y + k, 0], [x, -y + r, 0]]],
        ['line', [[x, -y + r, 0], [x, y - r, 0]]],
        ['arc3', [[x, y - r, 0], [x - k, y - k, 0], [x - r, y, 0]]],
        ['line', [[x - r, y, 0], [-x + r, y, 0]]],
        ['arc3', [[-x + r, y, 0], [-x + k, y - k, 0], [-x, y - r, 0]]],
        ['line', [[-x, y - r, 0], [-x, -y + r, 0]]],
        ['arc3', [[-x, -y + r, 0], [-x + k, -y + k, 0], [-x + r, -y, 0]]],
    ]
    maker = lambda: w.MakeFace(w.WireFromSegments(segs))
    return _sketch_object(maker, ((-x, -y), (x, y)), rotation, align, mode)


def SlotOverall(width, height, rotation=0,
                align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    r = height / 2.0
    c = width / 2.0 - r  # arc centers at +-c
    if c <= 0:
        raise ValueError('SlotOverall: width must exceed height')
    segs = [
        ['line', [[-c, -r, 0], [c, -r, 0]]],
        ['arc3', [[c, -r, 0], [c + r, 0, 0], [c, r, 0]]],
        ['line', [[c, r, 0], [-c, r, 0]]],
        ['arc3', [[-c, r, 0], [-c - r, 0, 0], [-c, -r, 0]]],
    ]
    maker = lambda: w.MakeFace(w.WireFromSegments(segs))
    return _sketch_object(maker, ((-width / 2.0, -r), (width / 2.0, r)),
                          rotation, align, mode)


def SlotCenterToCenter(center_separation, height, rotation=0,
                       align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    return SlotOverall(center_separation + height, height, rotation=rotation,
                       align=align, mode=mode)


def SlotCenterPoint(center, point, height, rotation=0,
                    align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    """Slot defined by its center and the center of ONE end arc, symmetric
    about the center (build123d SlotCenterPoint)."""
    c = Vector(center)
    p = Vector(point)
    half = p - c
    if half.length <= 0:
        raise ValueError('Distance between center and point must be greater '
                         'than 0 Got: distance = ' + repr(half.length))
    # a SlotOverall of the same length/height, rotated onto the half-line and
    # translated to the center - the identical geometry upstream sews together
    angle = math.degrees(math.atan2(half.Y, half.X))
    slot = SlotOverall(2 * half.length + height, height,
                       rotation=rotation + angle, align=align,
                       mode=Mode.PRIVATE)
    placed = Pos(c.X, c.Y, c.Z) * slot
    return _combine(_active_builder(BuildSketch), placed, mode)


class Superellipse(BaseSketchObject):
    """Sketch object: a superellipse ("squircle") of the given width, height
    and order (build123d 0.12 Superellipse): the top-right quadrant is a line
    (order 1), an elliptical arc (order 2) or an interpolating spline through
    point_count-2 points of |x/a|^n + |y/b|^n = 1, mirrored into the other
    three quadrants."""

    def __init__(self, width, height, order=4, point_count=16, rotation=0,
                 align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
        if order <= 0:
            raise ValueError('Order must be greater than zero.')
        self.width = width
        self.height_ = height
        self.order = order
        self.point_count = point_count
        self.align = _norm_align(align, 2)
        if order == 1:
            top_right = Edge.make_line((width / 2, 0), (0, height / 2))
        elif order == 2:
            top_right = Edge.make_ellipse(width / 2, height / 2,
                                          start_angle=0, end_angle=90)
        else:
            points = [Vector(width / 2, 0.0)]
            for i in range(1, point_count - 1):
                t = i * math.pi / point_count / 2
                cos_t, sin_t = math.cos(t), math.sin(t)
                x = abs(cos_t) ** (2 / order) * width * \
                    math.copysign(1, cos_t) / 2
                y = abs(sin_t) ** (2 / order) * height * \
                    math.copysign(1, sin_t) / 2
                points.append(Vector(x, y))
            points.append(Vector(0.0, height / 2))
            top_right = Edge.make_spline(points)
        top_left = _single_edge_of(top_right.mirror(Plane.YZ)).reversed()
        bottom_left = _single_edge_of(top_left.mirror(Plane.XZ)).reversed()
        bottom_right = _single_edge_of(top_right.mirror(Plane.XZ)).reversed()
        face = Face(Wire([top_right, top_left, bottom_left, bottom_right]))
        BaseSketchObject.__init__(self, face, rotation, align, mode)


def Trapezoid(width, height, left_side_angle, right_side_angle=None,
              rotation=0, align=(Align.CENTER, Align.CENTER), mode=Mode.ADD):
    if right_side_angle is None:
        right_side_angle = left_side_angle
    y = height / 2.0
    red_l = 0.0 if left_side_angle == 90 else \
        height / math.tan(math.radians(left_side_angle))
    red_r = 0.0 if right_side_angle == 90 else \
        height / math.tan(math.radians(right_side_angle))
    top_l = top_r = bot_l = bot_r = width / 2.0
    # build123d narrows the TOP for an acute side angle but widens the BOTTOM
    # for an obtuse one (negative reduction), so 'width' is always the width
    # of the wider of the two edges
    if red_l > 0:
        top_l -= red_l
    else:
        bot_l += red_l
    if red_r > 0:
        top_r -= red_r
    else:
        bot_r += red_r
    if bot_l + bot_r < 0:
        raise ValueError('Trapezoid bottom invalid - change angles')
    if top_l + top_r < 0:
        raise ValueError('Trapezoid top invalid - change angles')
    pts = [[-bot_l, -y, 0], [bot_r, -y, 0], [top_r, y, 0], [-top_l, y, 0]]
    xs = [p[0] for p in pts]
    maker = lambda: w.Polygon(pts)
    return _sketch_object(maker, ((min(xs), -y), (max(xs), y)), rotation,
                          align, mode)


class HeadType:
    STRAIGHT = 'STRAIGHT'
    CURVED = 'CURVED'
    FILLETED = 'FILLETED'


def ArrowHead(size, head_type=HeadType.CURVED, rotation=0, mode=Mode.ADD):
    """Sketch Object: an arrow head, tip at the origin pointing +X
    (build123d's drafting.ArrowHead, same construction)."""
    if head_type == HeadType.STRAIGHT:
        return Polygon((-size, size / 3), (-size, -size / 3), (0, 0),
                       align=None, rotation=rotation, mode=mode)
    if head_type not in (HeadType.CURVED, HeadType.FILLETED):
        raise ValueError('unknown arrow HeadType ' + repr(head_type))
    with BuildSketch() as arrow_head:
        with BuildLine():
            side = TangentArc((0, 0), (-size, size / 3),
                              tangent=(-size, size / 6))
            Line(side @ 1, (-7 * size / 8, 0))
            mirror(about=Plane.XZ)
        make_face()
        if head_type == HeadType.FILLETED:
            fillet(arrow_head.vertices().filter_by_position(
                Axis.X, -2 * size, -size / 5), radius=size / 20)
    return add(arrow_head.sketch, rotation=rotation, mode=mode) \
        if _active_builder() is not None else arrow_head.sketch


# --------------------------------------------------------------- Triangle ---
# build123d's Triangle solves the triangle with the trianglesolver package
# (Steven Byrnes, Apache-2.0-compatible MIT); its law-of-sines/cosines solver
# is small enough to port outright, which is what these four helpers are.

def _tri_aaas(D, E, F, f):
    return (f * math.sin(D) / math.sin(F), f * math.sin(E) / math.sin(F), f,
            D, E, F)


def _tri_sss(d, e, f):
    if not (d + e > f and e + f > d and f + d > e):
        raise ValueError('no such triangle')
    F = math.acos((d ** 2 + e ** 2 - f ** 2) / (2 * d * e))
    E = math.acos((d ** 2 + f ** 2 - e ** 2) / (2 * d * f))
    return (d, e, f, math.pi - F - E, E, F)


def _tri_sas(d, e, F):
    return _tri_sss(d, e, math.sqrt(d ** 2 + e ** 2 - 2 * d * e * math.cos(F)))


def _tri_ssa(d, e, D, ssa_flag):
    sin_e = math.sin(D) * e / d
    if abs(sin_e - 1.0) < 1e-9:
        E = math.pi / 2
    else:
        if sin_e >= 1.0:
            raise ValueError('no such triangle')
        e_acute = math.asin(sin_e)
        e_obtuse = math.pi - e_acute
        acute_ok = 0 < (math.pi - D - e_acute) < math.pi
        obtuse_ok = 0 < (math.pi - D - e_obtuse) < math.pi
        if ssa_flag == 'acute':
            if not acute_ok:
                raise ValueError('no such triangle')
            E = e_acute
        elif ssa_flag == 'obtuse':
            if not obtuse_ok:
                raise ValueError('no such triangle')
            E = e_obtuse
        else:
            if acute_ok and obtuse_ok:
                raise ValueError('Two different triangles fit this '
                                 'description')
            if not acute_ok and not obtuse_ok:
                raise ValueError('No such triangle')
            E = e_acute if acute_ok else e_obtuse
    F = math.pi - D - E
    e_, f_, d_, E_, F_, D_ = _tri_aaas(E, F, D, d)
    return (d_, e_, f_, D_, E_, F_)


def _tri_solve(a=None, b=None, c=None, A=None, B=None, C=None,
               ssa_flag='forbid'):
    """trianglesolver.solve, ported: give any three of the six and get all
    six back (angles in RADIANS)."""
    given = [x for x in (a, b, c, A, B, C) if x is not None]
    if len(given) != 3:
        raise ValueError('Must provide exactly 3 inputs')
    sides = [x for x in (a, b, c) if x is not None]
    if not sides:
        raise ValueError('Must provide at least 1 side length')
    if len(sides) == 3:
        return _tri_sss(a, b, c)
    if len(sides) == 2:
        if a is not None and A is not None and b is not None:
            return _tri_ssa(a, b, A, ssa_flag)
        if a is not None and A is not None and c is not None:
            a, c, b, A, C, B = _tri_ssa(a, c, A, ssa_flag)
            return (a, b, c, A, B, C)
        if b is not None and B is not None and a is not None:
            b, a, c, B, A, C = _tri_ssa(b, a, B, ssa_flag)
            return (a, b, c, A, B, C)
        if b is not None and B is not None and c is not None:
            b, c, a, B, C, A = _tri_ssa(b, c, B, ssa_flag)
            return (a, b, c, A, B, C)
        if c is not None and C is not None and a is not None:
            c, a, b, C, A, B = _tri_ssa(c, a, C, ssa_flag)
            return (a, b, c, A, B, C)
        if c is not None and C is not None and b is not None:
            c, b, a, C, B, A = _tri_ssa(c, b, C, ssa_flag)
            return (a, b, c, A, B, C)
        if a is not None and b is not None and C is not None:
            return _tri_sas(a, b, C)
        if b is not None and c is not None and A is not None:
            b, c, a, B, C, A = _tri_sas(b, c, A)
            return (a, b, c, A, B, C)
        if c is not None and a is not None and B is not None:
            c, a, b, C, A, B = _tri_sas(c, a, B)
            return (a, b, c, A, B, C)
        raise ValueError('unsupported triangle specification')
    if A is None:
        A = math.pi - B - C
    elif B is None:
        B = math.pi - A - C
    else:
        C = math.pi - A - B
    if not (A > 0 and B > 0 and C > 0):
        raise ValueError('no such triangle')
    if c is not None:
        return _tri_aaas(A, B, C, c)
    if a is not None:
        b, c, a, B, C, A = _tri_aaas(B, C, A, a)
        return (a, b, c, A, B, C)
    c, a, b, C, A, B = _tri_aaas(C, A, B, b)
    return (a, b, c, A, B, C)


def Triangle(a=None, b=None, c=None, A=None, B=None, C=None, align=None,
             rotation=0, mode=Mode.ADD):
    """Sketch Object: a triangle from one side length and any two other sides
    or interior angles (build123d Triangle). Side 'a' is the bottom, 'b' the
    right, going counter-clockwise; angle 'X' is opposite side 'x'. The result
    carries the solved a/b/c/A/B/C, the three edges and the three vertices."""
    if [v is None for v in (a, b, c)].count(True) == 3 or \
            [v is None for v in (a, b, c, A, B, C)].count(True) != 3:
        raise ValueError('One length and two other values must be provided')
    ar, br, cr, Ar, Br, Cr = _tri_solve(
        a, b, c,
        math.radians(A) if A is not None else None,
        math.radians(B) if B is not None else None,
        math.radians(C) if C is not None else None)
    apex = Vector(cr, 0, 0).rotate(Axis.Z, math.degrees(Br))
    pts = [(0.0, 0.0, 0.0), (ar, 0.0, 0.0), (apex.X, apex.Y, 0.0)]
    cx = sum([p[0] for p in pts]) / 3.0
    cy = sum([p[1] for p in pts]) / 3.0
    pts = [[p[0] - cx, p[1] - cy, 0.0] for p in pts]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    maker = lambda: w.Polygon(pts)
    obj = _sketch_object(maker, ((min(xs), min(ys)), (max(xs), max(ys))),
                         rotation, align, mode)
    obj.a, obj.b, obj.c = ar, br, cr
    obj.A, obj.B, obj.C = math.degrees(Ar), math.degrees(Br), math.degrees(Cr)
    obj.edge_a = obj.edges().filter_by(
        lambda e: abs(e.length - ar) < _TOL_1E6)[0]
    obj.edge_b = obj.edges().filter_by(
        lambda e: abs(e.length - br) < _TOL_1E6 and
        not (abs(e.length - obj.edge_a.length) < _TOL_1E6 and
             (e.center() - obj.edge_a.center()).length < _TOL_1E6))[0]
    obj.edge_c = obj.edges().filter_by(
        lambda e: all([(e.center() - other.center()).length > _TOL_1E6
                       for other in (obj.edge_a, obj.edge_b)]))[0]

    def _common_vertex(e1, e2):
        for v1 in e1.vertices():
            for v2 in e2.vertices():
                if (Vector(tuple(v1)) - Vector(tuple(v2))).length < \
                        _TOL_1E6:
                    return v1
        raise ValueError('these edges share no vertex')
    obj.vertex_A = _common_vertex(obj.edge_b, obj.edge_c)
    obj.vertex_B = _common_vertex(obj.edge_a, obj.edge_c)
    obj.vertex_C = _common_vertex(obj.edge_a, obj.edge_b)
    return obj


class TextAlign:
    LEFT = 'left'
    CENTER = 'center'
    RIGHT = 'right'
    BOTTOM = 'bottom'
    TOP = 'top'


def Text(txt, font_size, font='Arial', font_path=None,
         font_style=FontStyle.REGULAR,
         text_align=(TextAlign.CENTER, TextAlign.CENTER), align=None,
         path=None, position_on_path=0.0, single_line_width=None,
         rotation=0.0, mode=Mode.ADD):
    """Text rendered from bundled FreeSans outlines with FreeType-parity
    kerning (matches what the reference build123d resolves 'Arial' to on
    this machine for Latin text). COMPROMISE(text): only the bundled
    FreeSans faces exist — other font names fall back with a warning,
    font_path raises, and non-Latin glyph METRICS (e.g. Greek) can
    differ from other Arial substitutes.

    path= places each glyph on a curve like upstream's position_glyph: the
    glyph's bottom-centre advances the relative position along the path, and
    the glyph is rotated by the signed angle between +X and the path tangent
    there."""
    if font_path is not None:
        raise NotImplementedError('Text font_path= is not supported in '
                                  'build123d-lite (fonts are bundled)')
    fname = {FontStyle.REGULAR: 'FreeSans',
             FontStyle.BOLD: 'FreeSansBold',
             FontStyle.ITALIC: 'FreeSansOblique',
             FontStyle.BOLDITALIC: 'FreeSansBoldOblique'}.get(font_style)
    if fname is None:
        raise NotImplementedError('unsupported font_style in build123d-lite')
    if font not in ('Arial', 'FreeSans'):
        print('build123d-lite: font ' + repr(font) +
              ' is not bundled; using FreeSans (what OCCT resolves Arial to)')
    maker = lambda: w.Text2D(txt, float(font_size), fname,
                             text_align[0], text_align[1])
    if path is None:
        return _sketch_object(maker, None, rotation, align, mode)
    # Text on a path: upstream splits the flat text into its TOP LEVEL shapes
    # (one per glyph) and repositions each of them (Compound.make_text's
    # position_glyph).
    flat = Sketch(maker())
    path_length = path.length
    placed = []
    for glyph in flat.faces():
        bbox = glyph.bounding_box()
        bottom_center_x = (bbox.min.X + bbox.max.X) / 2.0
        relative = position_on_path + bottom_center_x / path_length
        tangent = path.tangent_at(relative)
        wire_angle = Vector(1, 0, 0).get_signed_angle(tangent)
        wire_position = path.position_at(relative)
        shift = wire_position - Vector(bottom_center_x, 0, 0)
        moved = Pos(shift.X, shift.Y, shift.Z) * glyph
        placed.append(moved.rotate(Axis(wire_position, (0, 0, 1)),
                                   -wire_angle))
    result = Sketch(w.MakeCompound([_topo(g) for g in placed]))
    builder = _active_builder()
    if rotation:
        result = Rotation(0, 0, rotation) * result
    return _combine(builder, result, mode) if builder is not None else result


class FontInfo:
    """Representation for a registered font: family name + available styles
    (build123d text.FontInfo; styles print as their names, like upstream)."""

    def __init__(self, name, styles):
        self.name = name
        self.styles = tuple(styles)

    def __eq__(self, other):
        return isinstance(other, FontInfo) and self.name == other.name and \
            self.styles == other.styles

    def __repr__(self):
        return ('Font(name=' + repr(self.name) + ', styles=' +
                repr(tuple(self.styles)) + ')')


class FontManager:
    """Font registry (build123d text.FontManager wraps OCCT's Font_FontMgr).
    COMPROMISE(text): this browser build has no system fonts, no filesystem
    and no Font_FontMgr — only the four bundled FreeSans faces exist (the
    ones Text() renders with), so the manager reports exactly those,
    find_font resolves to the bundled face name (a string, not a
    Font_SystemFont), and registering files/folders raises."""

    # (family, style, bundled face name) — what Text()'s font_style resolves
    bundled_fonts = [
        ('FreeSans', FontStyle.REGULAR, 'FreeSans'),
        ('FreeSans', FontStyle.BOLD, 'FreeSansBold'),
        ('FreeSans', FontStyle.ITALIC, 'FreeSansOblique'),
        ('FreeSans', FontStyle.BOLDITALIC, 'FreeSansBoldOblique'),
    ]

    def available_fonts(self):
        """List of available fonts by name and available styles (aspects) —
        upstream's aspect enumeration order: REGULAR, BOLD, BOLDITALIC,
        ITALIC."""
        styles = (FontStyle.REGULAR, FontStyle.BOLD, FontStyle.BOLDITALIC,
                  FontStyle.ITALIC)
        return [FontInfo('FreeSans', styles)]

    def check_font(self, path):
        """Font at path, or None — there is no filesystem here, so always
        None."""
        return None

    def find_font(self, name, style=FontStyle.REGULAR):
        """Resolve a font name + style to the bundled face that Text() would
        use. 'Arial' resolves to FreeSans exactly like Text() does."""
        for family, sty, face in self.bundled_fonts:
            if sty == style and str(name) in (family, face, 'Arial'):
                return face
        raise ValueError('font ' + repr(name) + ' with style ' + repr(style) +
                         ' is not bundled in build123d-lite (only the '
                         'FreeSans family exists)')

    def register_font(self, path, override=False, single_stroke=False):
        raise NotImplementedError('FontManager.register_font is not '
                                  'supported in build123d-lite (fonts are '
                                  'bundled; there is no filesystem)')

    def register_folder(self, path, override=False, single_stroke=False):
        raise NotImplementedError('FontManager.register_folder is not '
                                  'supported in build123d-lite (fonts are '
                                  'bundled; there is no filesystem)')

    def register_system_fonts(self):
        raise NotImplementedError('FontManager.register_system_fonts is not '
                                  'supported in build123d-lite (the browser '
                                  'exposes no system fonts)')


# module-level bound method, exactly like upstream text.py's
# 'available_fonts = FontManager().available_fonts'
available_fonts = FontManager().available_fonts


# ---------------------------------------------------------- 1D objects ---

def _seg_pts(seg):
    return seg[1]


def _seg_params(seg):
    return seg[2] if len(seg) > 2 else None


def _seg_make(kind, pts, params=None):
    if params is None:
        return [kind, [list(p) for p in pts]]
    return [kind, [list(p) for p in pts], params]


def _seg_reverse(seg):
    params = _seg_params(seg)
    if seg[0] == 'circle' and params is not None:
        n = _v3(params[1])
        params = [list(params[0]), [-n[0], -n[1], -n[2]], list(params[2]),
                  params[3]]
    if seg[0] in ('parab', 'hypr') and params is not None:
        # same parameter interval, opposite sense (GC_MakeArcOf*'s Sense flag)
        params = list(params[:6]) + [not params[6]]
    if seg[0] == 'interp' and params is not None:
        tans = params[0]
        if tans:
            tans = [([-t[0], -t[1], -t[2]] if t else [])
                    for t in reversed(tans)]
        params = [tans] + list(params[1:])
    return _seg_make(seg[0], list(reversed(_seg_pts(seg))), params)


def _seg_transform(seg, fn_point, fn_dir, loc=None):
    """Rigid-transform a segment: points via fn_point, directions via fn_dir.
    Kind-aware params: earc carries [center, xdir, normal, ...], interp
    carries [tangents, periodic, scale], raw carries an untransformable
    TopoDS edge."""
    pts = [fn_point(_v3(p)) for p in _seg_pts(seg)]
    params = _seg_params(seg)
    if params is not None:
        if seg[0] == 'circle':
            # [center, normal, xdir, radius]
            params = [list(fn_point(_v3(params[0]))), list(fn_dir(_v3(params[1]))),
                      list(fn_dir(_v3(params[2]))), params[3]]
        elif seg[0] in ('earc', 'parab', 'hypr'):
            # [center/origin, xdir, normal, ...sizes and angles]
            params = [list(fn_point(_v3(params[0]))), list(fn_dir(_v3(params[1]))),
                      list(fn_dir(_v3(params[2])))] + list(params[3:])
        elif seg[0] == 'bspline':
            # only the POLES move; knots/mults/degree/weights are invariant
            params = [[list(fn_point(_v3(p))) for p in params[0]]] + \
                list(params[1:])
        elif seg[0] == 'interp':
            tans = params[0]
            if tans:
                tans = [(list(fn_dir(_v3(t))) if t else [])
                        for t in tans]
            params = [tans] + list(params[1:])
        elif seg[0] == 'raw':
            # COMPROMISE(raw-segments): edges that are not lines/circles ride
            # through wires as opaque TopoDS edges. A rigid transform given as
            # a Location can still be applied to the edge itself (exact); an
            # arbitrary point/direction mapping cannot, and the caller falls
            # back to transforming the baked topo and dropping specs.
            if loc is None:
                raise NotImplementedError('cannot transform an opaque edge '
                                          'segment in build123d-lite')
            params = [_topo(loc * Edge(params[0]))]
    return _seg_make(seg[0], pts, params)


def _seg_scale(seg, k):
    """Uniformly scale a segment about the origin by factor k."""
    pts = [[p[0] * k, p[1] * k, p[2] * k] for p in
           [_v3(p) for p in _seg_pts(seg)]]
    params = _seg_params(seg)
    if params is not None:
        if seg[0] == 'earc':
            c = _v3(params[0])
            params = [[c[0] * k, c[1] * k, c[2] * k], list(params[1]),
                      list(params[2]), params[3] * k, params[4] * k] + \
                     list(params[5:])
        elif seg[0] == 'circle':
            cc = _v3(params[0])
            params = [[cc[0] * k, cc[1] * k, cc[2] * k], list(params[1]),
                      list(params[2]), params[3] * k]
        elif seg[0] in ('parab', 'hypr'):
            # a conic's PARAMETER range does not scale with its size (a
            # parabola's U is the y offset, a hyperbola's is a hyperbolic
            # angle), so scaling one would need the trim range recomputed —
            # refuse rather than return the wrong arc
            raise NotImplementedError('cannot scale a parabolic/hyperbolic '
                                      'arc in build123d-lite')
        elif seg[0] == 'bspline':
            params = [[[p[0] * k, p[1] * k, p[2] * k] for p in
                       [_v3(q) for q in params[0]]]] + list(params[1:])
        elif seg[0] == 'interp':
            # tangents stay UNCHANGED: GeomAPI_Interpolate parametrizes by
            # chord length, so scaling the points by k scales the parameter
            # range by k too — dP/dt is scale-invariant and the curve
            # scales self-similarly with the original tangent magnitudes
            pass
        elif seg[0] == 'raw':
            raise NotImplementedError('cannot scale an opaque edge segment '
                                      'in build123d-lite')
    return _seg_make(seg[0], pts, params)


def _chain_segments(specs):
    """Greedy-chain segments end-to-start (reversing where needed) so OCCT's
    MakeWire accepts them in order. Specs: (kind, [pts...][, params])."""
    if not specs:
        return []
    remaining = [_seg_make(s[0], [tuple(p) for p in _seg_pts(s)], _seg_params(s))
                 for s in specs]
    ordered = [remaining.pop(0)]

    def s_start(s):
        return _seg_pts(s)[0]

    def s_end(s):
        return _seg_pts(s)[-1]

    def close(a, b):
        return (abs(a[0] - b[0]) < 1e-6 and abs(a[1] - b[1]) < 1e-6 and
                abs(a[2] - b[2]) < 1e-6)

    while remaining:
        tail = s_end(ordered[-1])
        head = s_start(ordered[0])
        found = False
        for i, seg in enumerate(remaining):
            if close(s_start(seg), tail):
                ordered.append(remaining.pop(i))
                found = True
                break
            if close(s_end(seg), tail):
                ordered.append(_seg_reverse(remaining.pop(i)))
                found = True
                break
            if close(s_end(seg), head):
                ordered.insert(0, remaining.pop(i))
                found = True
                break
            if close(s_start(seg), head):
                ordered.insert(0, _seg_reverse(remaining.pop(i)))
                found = True
                break
        if not found:
            # disconnected: append remaining as-is and let OCCT complain
            ordered.extend(remaining)
            break
    return ordered


def _place_specs(specs, locs):
    """Segment specs placed at every location (identity: unchanged)."""
    if len(locs) == 1 and _loc_is_identity(locs[0]):
        return specs
    placed = []
    for loc in locs:
        fn_dir = lambda d, loc=loc: _mat_vec(loc._R, d)
        placed.extend([_seg_transform(s, loc._transform_point, fn_dir, loc)
                       for s in specs])
    return placed


def _line_object(specs, mode=Mode.ADD):
    """Place specs at the active locations (0.12: a Locations context
    places 1-D objects too, inside a BuildLine and out), register them with
    the active BuildLine (if any) and return a Curve."""
    builder = _active_builder(BuildLine)
    specs = _place_specs(specs, _ctx_locations())
    curve = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
    if builder is not None and mode != Mode.PRIVATE:
        builder._add_specs(specs)
    return curve


def _curve_specs_of(curve):
    if isinstance(curve, Mixin1D) and curve._specs:
        specs = curve._specs
    elif isinstance(curve, Shape) and curve.topo is not None:
        specs = _specs_from_topo_edges(curve)
    else:
        specs = []
    return [_seg_make(s[0], [tuple(p) for p in _seg_pts(s)],
                      _seg_params(s)) for s in specs]


class BaseCurveObject(Curve, _BaseObject):
    """Wrap an already-built curve as a BuildLine object (build123d
    objects_curve.BaseCurveObject / BaseLineObject / BaseEdgeObject):
    constructed behind the _BaseObjectMeta firewall, then placed at the
    caller's locations and registered with the caller's BuildLine per mode.
    Lite's stock 1-D objects are spec-emitting functions, so these classes
    are the exported subclassing hooks — a custom line object builds a
    Wire/Curve/Edge and calls super().__init__(curve, mode)."""

    _lite_applies_to = 'BuildLine'

    def __init__(self, curve, mode=Mode.ADD):
        specs = _curve_specs_of(curve)
        topo = curve.topo if isinstance(curve, Shape) else curve
        Curve.__init__(self, topo, specs)
        self.mode = mode
        if not _HAS_METACLASS:
            # stock MicroPython (no metaclasses): the pre-0.12 direct path
            builder = _active_builder(BuildLine)
            if builder is not None and mode != Mode.PRIVATE and specs:
                builder._add_specs(specs)


class BaseLineObject(BaseCurveObject):
    """build123d's Wire-based line object base (Polyline, FilletPolyline,
    Airfoil derive from it upstream)."""


class BaseEdgeObject(Edge, _BaseObject):
    """build123d 0.12's Edge-based line object base (most stock 1-D
    objects derive from it upstream)."""

    _lite_applies_to = 'BuildLine'

    def __init__(self, curve, mode=Mode.ADD):
        specs = _curve_specs_of(curve)
        topo = curve.topo if isinstance(curve, Shape) else curve
        Edge.__init__(self, topo)
        self._specs = specs
        self.mode = mode
        if not _HAS_METACLASS:
            builder = _active_builder(BuildLine)
            if builder is not None and mode != Mode.PRIVATE and specs:
                builder._add_specs(specs)


def Line(*pts, mode=Mode.ADD):
    if len(pts) == 1:
        pts = tuple(pts[0])
    if len(pts) != 2:
        raise ValueError('Line requires exactly two points')
    return _line_object([('line', [_v3(pts[0]), _v3(pts[1])])], mode)


def Polyline(*pts, close=False, mode=Mode.ADD):
    if len(pts) == 1 and _is_nested_seq(pts[0]):
        pts = tuple(pts[0])
    p3 = [_v3(p) for p in pts]
    if close and p3[0] != p3[-1]:
        p3.append(p3[0])
    specs = [('line', [p3[i], p3[i + 1]]) for i in range(len(p3) - 1)]
    return _line_object(specs, mode)


def ThreePointArc(*pts, mode=Mode.ADD):
    if len(pts) == 1:
        pts = tuple(pts[0])
    if len(pts) != 3:
        raise ValueError('ThreePointArc requires three points')
    return _line_object([('arc3', [_v3(pts[0]), _v3(pts[1]), _v3(pts[2])])], mode)


def _arc_mid_from_sagitta(p1, p2, sagitta):
    mx, my = (p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    ln = math.hypot(dx, dy)
    if ln < 1e-12:
        raise ValueError('arc endpoints coincide')
    nx, ny = -dy / ln, dx / ln  # left normal of p1->p2
    return (mx + nx * sagitta, my + ny * sagitta, p1[2])


def SagittaArc(start, end, sagitta, mode=Mode.ADD):
    p1, p2 = _v3(start), _v3(end)
    mid = _arc_mid_from_sagitta(p1, p2, sagitta)
    return _line_object([('arc3', [p1, list(mid), p2])], mode)


def RadiusArc(start, end, radius, short_sagitta=True, mode=Mode.ADD):
    p1, p2 = _v3(start), _v3(end)
    c = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    r = abs(radius)
    if r < c / 2.0 - 1e-9:
        raise ValueError('RadiusArc: radius is smaller than half the chord')
    h = math.sqrt(max(r * r - (c / 2.0) ** 2, 0.0))
    sag = (r - h) if short_sagitta else (r + h)
    if radius < 0:
        sag = -sag
    return SagittaArc(start, end, sag, mode=mode)


def CenterArc(center, radius, start_angle, arc_size, mode=Mode.ADD):
    c = _v3(center)

    def at(a):
        return [c[0] + radius * math.cos(math.radians(a)),
                c[1] + radius * math.sin(math.radians(a)), c[2]]
    if abs(arc_size) >= 360:
        # ONE closed circle edge, like upstream — not two half arcs. The edge
        # COUNT of a full circle is observable: group_by(Edge.length) keys and
        # anything that samples per edge (make_hull) change with it.
        xdir = [math.cos(math.radians(start_angle)),
                math.sin(math.radians(start_angle)), 0.0]
        specs = [('circle', [at(start_angle), at(start_angle + 360)],
                  [list(c), [0.0, 0.0, 1.0], xdir, float(radius)])]
    else:
        specs = [('arc3', [at(start_angle), at(start_angle + arc_size / 2.0),
                           at(start_angle + arc_size)])]
    return _line_object(specs, mode)


def TangentArc(*pts, tangent, tangent_from_first=True, mode=Mode.ADD):
    if len(pts) == 1:
        pts = tuple(pts[0])
    if len(pts) != 2:
        raise ValueError('TangentArc requires two points')
    if not tangent_from_first:
        # upstream applies the tangent to the LAST point instead, which builds
        # the same circle traversed the other way (objects_curve TangentArc)
        pts = (pts[1], pts[0])
    p1, p2 = _v3(pts[0]), _v3(pts[1])
    t = _v3(tangent)
    tln = math.hypot(t[0], t[1])
    tx, ty = t[0] / tln, t[1] / tln
    nx, ny = -ty, tx  # left normal of the tangent
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    denom = 2.0 * (dx * nx + dy * ny)
    if abs(denom) < 1e-12:
        return Line(pts[0], pts[1], mode=mode)
    r = (dx * dx + dy * dy) / denom  # signed radius along the left normal
    cx, cy = p1[0] + nx * r, p1[1] + ny * r
    a1 = math.atan2(p1[1] - cy, p1[0] - cx)
    a2 = math.atan2(p2[1] - cy, p2[0] - cx)
    ccw = r > 0  # tangent matches CCW travel when center is on the left
    if ccw:
        while a2 <= a1:
            a2 += 2.0 * math.pi
    else:
        while a2 >= a1:
            a2 -= 2.0 * math.pi
    amid = (a1 + a2) / 2.0
    rad = abs(r)
    mid = [cx + rad * math.cos(amid), cy + rad * math.sin(amid), p1[2]]
    return _line_object([('arc3', [p1, mid, p2])], mode)


def JernArc(start, tangent, radius, arc_size, mode=Mode.ADD):
    p1 = _v3(start)
    t = _v3(tangent)
    tln = math.hypot(t[0], t[1])
    tx, ty = t[0] / tln, t[1] / tln
    # positive arc_size turns left: center on the left normal, CCW sweep
    side = 1.0 if arc_size >= 0 else -1.0
    nx, ny = -ty * side, tx * side
    cx, cy = p1[0] + nx * radius, p1[1] + ny * radius
    a1 = math.atan2(p1[1] - cy, p1[0] - cx)
    a2 = a1 + side * math.radians(abs(arc_size))
    amid = (a1 + a2) / 2.0

    def at(a):
        return [cx + radius * math.cos(a), cy + radius * math.sin(a), p1[2]]
    arc = _line_object([('arc3', [list(p1), at(amid), at(a2)])], mode)
    # upstream's JernArc records its defining parameters on the object
    arc.radius = radius
    arc.center_point = Vector((cx, cy, p1[2]))
    return arc


def _sample_curve(obj, per_edge=256):
    """[(point3, edge, u)] samples along every edge of a curve/edge —
    the pure-Python side of curve-distance queries (one JS call per
    sample, cached by callers)."""
    edges = [obj] if isinstance(obj, Edge) else obj.edges()
    out = []
    for e in edges:
        for i in range(per_edge + 1):
            u = i / per_edge
            q = w._edgePointAt(e.topo, u)
            out.append(((q[0], q[1], q[2]), e, u))
    return out


def _closest_on_curve(samples, p):
    """(distance, point, edge, u) of the curve point closest to p: coarse
    scan over the cached samples, then golden-section refinement on the
    winning edge's parameter (near-exact for smooth curves)."""
    best_i = 0
    best_d = None
    for i, (q, e, u) in enumerate(samples):
        d = ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2)
        if best_d is None or d < best_d:
            best_d = d
            best_i = i
    q0, e0, u0 = samples[best_i]
    step = 1.0 if len(samples) < 2 else abs(
        samples[1][2] - samples[0][2]) or 1.0 / 256
    a = max(0.0, u0 - step)
    b = min(1.0, u0 + step)

    def f(u):
        q = w._edgePointAt(e0.topo, u)
        return ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2)
    phi = 0.6180339887498949
    c = b - phi * (b - a)
    d_ = a + phi * (b - a)
    fc, fd = f(c), f(d_)
    for _i in range(48):
        if fc < fd:
            b, d_, fd = d_, c, fc
            c = b - phi * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d_, fd
            d_ = a + phi * (b - a)
            fd = f(d_)
    u = (a + b) / 2.0
    q = w._edgePointAt(e0.topo, u)
    dist = math.sqrt((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 +
                     (q[2] - p[2]) ** 2)
    return dist, tuple(q), e0, u


# --- CPython set ordering (for upstream code that iterates list(set(...))) -
# build123d's Mixin1D.common_plane picks its plane from the max-area triangle
# over list(set(points)), so the plane normal's SIGN follows CPython's set
# iteration order of Vector keys (tuples of floats rounded to 5 digits). These
# helpers reproduce CPython 3.11+'s float hash, xxHash tuple hash and set
# table probing exactly (validated against CPython 3.13 on random keys), so
# lite's common_plane - and DoubleTangentArc's TOP/BOTTOM - agree on every
# interpreter.
_M64 = (1 << 64) - 1
_P61 = (1 << 61) - 1


def _frexp(v):
    if v == 0.0:
        return 0.0, 0
    a = abs(v)
    e = int(math.floor(math.log2(a))) + 1
    m = a / (2.0 ** e)
    while m >= 1.0:
        m /= 2.0
        e += 1
    while m < 0.5:
        m *= 2.0
        e -= 1
    return (m if v > 0 else -m), e


def _cpy_hash_float(v):
    m, e = _frexp(float(v))
    sign = 1
    if m < 0:
        sign = -1
        m = -m
    x = 0
    while m:
        x = ((x << 28) & _P61) | (x >> 33)
        m *= 268435456.0
        e -= 28
        y = int(m)
        m -= y
        x += y
        if x >= _P61:
            x -= _P61
    if e >= 0:
        e = e % 61
    else:
        e = 60 - ((-1 - e) % 61)
    x = ((x << e) & _P61) | (x >> (61 - e))
    x = x * sign
    if x == -1:
        x = -2
    return x


def _cpy_hash_tuple(t):
    acc = 2870177450012600261
    for item in t:
        lane = _cpy_hash_float(item) & _M64
        acc = (acc + lane * 14029467366897019727) & _M64
        acc = ((acc << 31) | (acc >> 33)) & _M64
        acc = (acc * 11400714785074694791) & _M64
    acc = (acc + (len(t) ^ (2870177450012600261 ^ 3527539))) & _M64
    if acc == _M64:
        return 1546275796
    return acc - (1 << 64) if acc >> 63 else acc


def _cpy_set_order(items, key):
    """The order list(set(items)) has on CPython, items equal (and hashed)
    by key(item) - a tuple of floats."""
    size = 8
    table = [None] * size
    fill = 0

    def insert_clean(tab, mask, entry):
        h = entry[1]
        perturb = h & _M64
        i = perturb & mask
        while True:
            if tab[i] is None:
                tab[i] = entry
                return
            if i + 9 <= mask:
                for j in range(1, 10):
                    if tab[i + j] is None:
                        tab[i + j] = entry
                        return
            perturb >>= 5
            i = (i * 5 + 1 + perturb) & mask
    for item in items:
        k = key(item)
        h = _cpy_hash_tuple(k)
        mask = size - 1
        perturb = h & _M64
        i = perturb & mask
        done = False
        while not done:
            probes = 9 if i + 9 <= mask else 0
            j = i
            for _p in range(probes + 1):
                ent = table[j]
                if ent is None:
                    table[j] = (item, h, k)
                    fill += 1
                    done = True
                    break
                if ent[1] == h and ent[2] == k:
                    done = True
                    break
                j += 1
            if done:
                break
            perturb >>= 5
            i = (i * 5 + 1 + perturb) & mask
        if fill * 5 >= mask * 3:
            minused = fill * 2 if fill > 50000 else fill * 4
            newsize = 8
            while newsize <= minused:
                newsize <<= 1
            newtab = [None] * newsize
            for ent in table:
                if ent is not None:
                    insert_clean(newtab, newsize - 1, ent)
            table = newtab
            size = newsize
    return [ent[0] for ent in table if ent is not None]


def _vector_key5(v):
    return (round(v.X, 5) + 0.0, round(v.Y, 5) + 0.0, round(v.Z, 5) + 0.0)


def _common_plane(lines, tolerance=1e-6):
    """build123d Mixin1D.common_plane over the given edges/wires: the plane
    containing them all (None if there is none), centred on the lines."""
    all_lines = [l for l in lines if l is not None]
    all_edges = []
    for l in all_lines:
        all_edges.extend(l.edges())
    result = None
    if all(e.geom_type == GeomType.LINE for e in all_edges):
        axes = [Axis(e @ 0, e % 0) for e in all_edges]
        coaxial = True
        for a0 in axes:
            for a1 in axes:
                d0, d1 = Vector(a0.direction), Vector(a1.direction)
                if d0.cross(d1).length > 1e-5:
                    coaxial = False
                off = Vector(a1.position) - Vector(a0.position)
                if off.cross(d0).length > 1e-5:
                    coaxial = False
        if coaxial:
            result = Plane(axes[0].position,
                           z_dir=Plane(axes[0].position,
                                       z_dir=axes[0].direction).x_dir)
    if result is None:
        points = []
        for line in all_lines:
            is_line = isinstance(line, Edge) and line.geom_type == GeomType.LINE
            n = 2 if is_line else 8
            points.extend([Vector(line.position_at(i / (n - 1)))
                           for i in range(n)])
        points = _cpy_set_order(points, _vector_key5)
        extreme_areas = {}
        count = len(points)
        for a in range(count):
            for b in range(a + 1, count):
                for c in range(b + 1, count):
                    v1 = points[b] - points[a]
                    v2 = points[c] - points[a]
                    extreme_areas[0.5 * v1.cross(v2).length] = \
                        (points[a], points[b], points[c])
        if not extreme_areas:
            return None
        extremes = extreme_areas[_stable_sorted(list(extreme_areas.keys()))[-1]]
        x_dir = (extremes[1] - extremes[0]).normalized()
        z_dir = (extremes[2] - extremes[0]).cross(x_dir)
        if z_dir.length <= 1e-12:
            return None
        origin = (extremes[0] + extremes[1] + extremes[2]) * (1.0 / 3.0)
        c_plane = Plane(origin, z_dir=z_dir)
        zn = Vector(c_plane.z_dir)
        for p in points:
            if abs((p - Vector(c_plane.origin)).dot(zn)) > tolerance:
                return None
        result = c_plane
    total = Vector(0, 0, 0)
    for l in all_lines:
        total = total + Vector(l.position_at(0.5))
    center = total * (1.0 / len(all_lines))
    zn = Vector(result.z_dir)
    shift = (center - Vector(result.origin)).dot(zn)
    return result.shift_origin(center - zn * shift)


def DoubleTangentArc(pnt, tangent, other, keep=Keep.TOP, mode=Mode.ADD):
    """Arc tangent to a point/tangent pair AND to another curve.
    COMPROMISE(double-tangent-arc): upstream solves radius with
    scipy.optimize.minimize (Nelder-Mead) over an exact BRepExtrema
    distance; lite finds the same root of dist(center(r)) - r by scan +
    bisection over a sampled-then-refined curve distance. The tangency
    point (hence the arc) matches upstream to well below harness
    tolerance; candidate ORDER follows upstream's [90, -90] sweep about
    the flipped common plane."""
    if keep not in (Keep.TOP, Keep.BOTTOM):
        raise ValueError('Only the TOP or BOTTOM options are supported')
    arc_pt = _v3(pnt)
    t = Vector(tangent).normalized()
    # upstream: workplane = -common_plane(Line(pnt, pnt + tangent), *edges)
    # ("flip to help with TOP/BOTTOM"); the rotation axis is its z
    coplane = _common_plane([Edge.make_line(arc_pt, Vector(arc_pt) + t)] +
                            list(other.edges()))
    if coplane is None:
        raise ValueError('DoubleTangentArc only works on a single plane')
    axis_dir = tuple(-Vector(coplane.z_dir))
    samples = _sample_curve(other, 512)
    bb = other.bounding_box()
    mins = [min(bb.min[i], arc_pt[i]) for i in range(3)]
    maxs = [max(bb.max[i], arc_pt[i]) for i in range(3)]
    max_size = 10 * math.sqrt(sum((maxs[i] - mins[i]) ** 2 for i in range(3)))

    accepted = []
    for ang in (90.0, -90.0):
        bis = tuple(t.rotate(Axis((0, 0, 0), axis_dir), ang))

        def g(r):
            c = (arc_pt[0] + bis[0] * r, arc_pt[1] + bis[1] * r,
                 arc_pt[2] + bis[2] * r)
            return _closest_on_curve(samples, c)[0] - r

        # first (smallest-r) root: sign-change scan + bisection — the
        # solution Nelder-Mead from x0=0 walks into
        n = 400
        prev_r, prev_v = 1e-9, g(1e-9)
        root = None
        for i in range(1, n + 1):
            r = max_size * i / n
            v = g(r)
            if v == 0.0 or (prev_v > 0) != (v > 0):
                a, b, fa = prev_r, r, prev_v
                for _j in range(60):
                    m = (a + b) / 2.0
                    fm = g(m)
                    if (fa > 0) != (fm > 0):
                        b = m
                    else:
                        a, fa = m, fm
                root = (a + b) / 2.0
                break
            prev_r, prev_v = r, v
        if root is None:
            continue
        center = (arc_pt[0] + bis[0] * root, arc_pt[1] + bis[1] * root,
                  arc_pt[2] + bis[2] * root)
        dist, p1, e1, u1 = _closest_on_curve(samples, center)
        if abs(dist - root) > 1e-4:
            continue
        # tangency: the other curve's tangent must be perpendicular to the
        # radial direction at the touch point (build123d checks the circle
        # tangent is parallel within 0.05 rad)
        ot = w._edgeTangentAt(e1.topo, u1)
        radial = (p1[0] - center[0], p1[1] - center[1], p1[2] - center[2])
        rl = math.sqrt(sum(v * v for v in radial)) or 1.0
        cosang = abs(sum(ot[k] * radial[k] for k in range(3))) / rl
        if cosang > 0.05:
            continue
        accepted.append((center, p1, e1, u1))
    if not accepted:
        raise RuntimeError('No double tangent arcs found')
    chosen = accepted[0] if keep == Keep.TOP else accepted[-1]
    _c, p1, e1, u1 = chosen
    # COMPROMISE(double-tangent-arc): upstream leaves the tangent target
    # over-extended ("beyond the intersection") and relies on the face
    # builder's wire fixing to trim it; lite trims the target's segment in
    # the active BuildLine at the tangency point instead — the resulting
    # FACE is identical, but the target curve's dangling tail is dropped.
    builder = _active_builder(BuildLine)
    if builder is not None and isinstance(other, Mixin1D) and other._specs:
        for i, sg in enumerate(builder._specs):
            if any(sg is s2 for s2 in other._specs) and sg[0] == 'arc3':
                s0 = _v3(w._edgePointAt(e1.topo, 0.0))
                seg0 = _v3(_seg_pts(sg)[0])
                if max(abs(s0[k] - seg0[k]) for k in range(3)) < 1e-6:
                    mid = w._edgePointAt(e1.topo, u1 / 2.0)
                    builder._specs[i] = _seg_make(
                        'arc3', [list(seg0), [mid[0], mid[1], mid[2]],
                                 list(p1)])
                break
    return TangentArc(tuple(arc_pt), p1, tangent=tuple(t), mode=mode)


def PolarLine(start, length, angle=None, direction=None,
              length_mode=LengthMode.DIAGONAL, mode=Mode.ADD, **kwargs):
    """Line from a point at an angle, ending after 'length' or AT a limit
    shape (build123d PolarLine)."""
    p1 = _v3(start)
    if direction is not None:
        d = Vector(direction).normalized()
        angle = math.degrees(math.atan2(d.Y, d.X))
    elif angle is not None:
        a = math.radians(angle)
        d = Vector((math.cos(a), math.sin(a), 0.0))
    else:
        raise ValueError('PolarLine requires angle= or direction=')

    if isinstance(length, (int, float)):
        # length_mode measures the DIAGONAL (default), or the horizontal /
        # vertical projection of the line - upstream divides by cos/sin
        if length_mode == LengthMode.HORIZONTAL:
            scale = abs(length / math.cos(math.radians(angle)))
        elif length_mode == LengthMode.VERTICAL:
            scale = abs(length / math.sin(math.radians(angle)))
        else:
            scale = length
        p2 = [p1[0] + scale * d.X, p1[1] + scale * d.Y, p1[2] + scale * d.Z]
        return _line_object([('line', [p1, p2])], mode)

    # length is a LIMIT SHAPE: run the ray out and stop at the first contact
    # in front of the start point (build123d trims a long edge to the limit)
    target = length._obj if isinstance(length, Builder) else length
    if not isinstance(target, Shape):
        raise NotImplementedError(
            'PolarLine length limits are supported for shapes only in '
            'build123d-lite, not ' + type(length).__name__)
    axis = Axis(p1, tuple(d))
    best = None
    contact = None
    for e in target.edges():
        for h in e.find_intersection_points(axis):
            v = Vector(tuple(h))
            along = (v - Vector(tuple(p1))).dot(d)
            if along > _TOL and (best is None or along < best):
                best, contact = along, v
    if contact is None:
        raise ValueError("Polar line doesn't intersect length limit " +
                         repr(length))
    return _line_object([('line', [p1, list(contact)])], mode)


def _dist3(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 +
                     (a[2] - b[2]) ** 2)


def _unit3(v):
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if n < 1e-15:
        return [0.0, 0.0, 0.0]
    return [v[0] / n, v[1] / n, v[2] / n]


def FilletPolyline(*pts, radius, close=False, mode=Mode.ADD):
    """Polyline whose corners are filleted to a radius (build123d
    FilletPolyline). A radius of 0 leaves that corner sharp.

    Upstream builds each corner fillet with Face.fillet_2d; a fillet between
    two straight segments is the analytic tangent arc, so lite constructs it
    directly (identical geometry, and it keeps the result a spec-level Curve
    that mirror()/make_face() can still transform)."""
    if len(pts) == 1 and _is_nested_seq(pts[0]):
        pts = tuple(pts[0])
    points = [list(_v3(p)) for p in pts]
    # a user-closed polyline (last == first) is treated as close=True
    if len(points) > 1 and _dist3(points[0], points[-1]) < _TOL:
        close = True
        points.pop()
    if len(points) < 2:
        raise ValueError('FilletPolyline requires two or more pts')

    n = len(points)
    if isinstance(radius, (int, float)):
        radius_list = [float(radius)] * n
        radius_at = lambda i: radius_list[i]
    else:
        radius_list = [float(r) for r in radius]
        expected = n - (0 if close else 2)
        if len(radius_list) != expected:
            raise ValueError('radius list length (' + str(len(radius_list)) +
                             ') must match angle count (' + str(expected) + ')')
        radius_at = lambda i: radius_list[i - (0 if close else 1)]
    for r in radius_list:
        if r < 0:
            raise ValueError('radius ' + repr(r) + ' must be non-negative')

    corners = range(n) if close else range(1, n - 1)
    segs = []
    cursor = list(points[0])
    for i in corners:
        p = points[i]
        prev = points[(i - 1) % n]
        nxt = points[(i + 1) % n]
        r = radius_at(i)
        u = _unit3([p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]])
        v = _unit3([nxt[0] - p[0], nxt[1] - p[1], nxt[2] - p[2]])
        cosang = -(u[0] * v[0] + u[1] * v[1] + u[2] * v[2])
        cosang = max(-1.0, min(1.0, cosang))
        interior = math.acos(cosang)
        if r == 0 or interior < 1e-9 or abs(interior - math.pi) < 1e-9:
            continue  # sharp corner (or collinear: nothing to fillet)
        t = r / math.tan(interior / 2.0)
        a = [p[k] - u[k] * t for k in range(3)]
        b = [p[k] + v[k] * t for k in range(3)]
        # the arc centre lies along the interior bisector
        bis = _unit3([v[k] - u[k] for k in range(3)])
        dist = r / math.sin(interior / 2.0)
        centre = [p[k] + bis[k] * dist for k in range(3)]
        chord_mid = [(a[k] + b[k]) / 2.0 for k in range(3)]
        out = _unit3([chord_mid[k] - centre[k] for k in range(3)])
        arc_mid = [centre[k] + out[k] * r for k in range(3)]
        if _dist3(cursor, a) > _TOL:
            segs.append(('line', [list(cursor), list(a)]))
        segs.append(('arc3', [list(a), arc_mid, list(b)]))
        cursor = b
    end = points[0] if close else points[-1]
    if _dist3(cursor, end) > _TOL:
        segs.append(('line', [list(cursor), list(end)]))
    if not segs:
        raise ValueError('FilletPolyline produced no segments')
    return _line_object(segs, mode)


def IntersectingLine(start, direction, other, mode=Mode.ADD):
    """Line from a point in a direction, ending at the NEAREST intersection
    with another curve (build123d IntersectingLine)."""
    p1 = _v3(start)
    d = Vector(direction).normalized()
    axis = Axis(p1, tuple(d))
    target = other._obj if isinstance(other, Builder) else other
    hits = [h for e in target.edges() for h in e.find_intersection_points(axis)]
    if not hits:
        raise ValueError('No intersections found')
    # upstream takes the intersection CLOSEST to start (unsigned distance)
    best = None
    contact = None
    for h in hits:
        v = Vector(tuple(h))
        dist = (Vector(tuple(p1)) - v).length
        if best is None or dist < best:
            best, contact = dist, v
    p2 = [p1[0] + d.X * best, p1[1] + d.Y * best, p1[2] + d.Z * best]
    return _line_object([('line', [p1, p2])], mode)


def Bezier(*cpts, weights=None, mode=Mode.ADD):
    if len(cpts) == 1 and _is_nested_seq(cpts[0]):
        cpts = tuple(cpts[0])
    pts = [_v3(p) for p in cpts]
    if weights is None:
        return _line_object([('bezier', pts)], mode)
    # rational Bezier: the WASM build lacks the weighted Geom_BezierCurve
    # array types, so sample the exact rational curve densely and fit
    if len(weights) != len(pts):
        raise ValueError('Bezier: weights must match control points')
    n = len(pts) - 1
    binom = [1] * (n + 1)
    for i in range(1, n + 1):
        binom[i] = binom[i - 1] * (n - i + 1) // i

    def at(t):
        num = [0.0, 0.0, 0.0]
        den = 0.0
        for i in range(n + 1):
            b = binom[i] * (t ** i) * ((1 - t) ** (n - i)) * weights[i]
            den += b
            for k in range(3):
                num[k] += b * pts[i][k]
        return [num[0] / den, num[1] / den, num[2] / den]
    dense = [at(i / 64.0) for i in range(65)]
    return _line_object([('spline', dense)], mode)


def Spline(*pts, tangents=None, tangent_scalars=None, periodic=False,
           mode=Mode.ADD):
    """Exact interpolation through the points — GeomAPI_Interpolate via the
    'interp' segment kind, replicating build123d's Spline/Edge.make_spline:
    tangents are unit-normalized then multiplied by their scalar (default
    1.0); OCC's Scale flag is True exactly when tangent_scalars is None."""
    if len(pts) == 1 and _is_nested_seq(pts[0]):
        pts = tuple(pts[0])
    p3 = [list(_v3(p)) for p in pts]
    # NOTE: [] (not None) encodes "no tangents" — Brython None objects break
    # the worker's CacheOp JSON hashing when nested in argument structures
    tans = []
    scale_flag = tangent_scalars is None
    if tangents is not None:
        tg = [(Vector(t).normalized() if t is not None else None)
              for t in tangents]
        if tangent_scalars is None:
            sc = [1.0] * len(tg)
        else:
            sc = list(tangent_scalars)
        # build123d zips tangents with scalars (extra tangents are dropped)
        tans = [(list(t * s) if t is not None else [])
                for t, s in zip(tg, sc)]
        if len(tans) != 2 and len(tans) != len(p3):
            raise ValueError('Spline: provide 2 end tangents or one per point')
    return _line_object([('interp', p3, [tans, bool(periodic), scale_flag])],
                        mode)


def _ellipse_arc_spec(c, x_radius, y_radius, start_angle, end_angle,
                      rotation):
    rot = math.radians(rotation)
    xd = (math.cos(rot), math.sin(rot), 0.0)

    def at(a):
        ar = math.radians(a)
        lx, ly = x_radius * math.cos(ar), y_radius * math.sin(ar)
        return [c[0] + lx * xd[0] - ly * xd[1], c[1] + lx * xd[1] + ly * xd[0], c[2]]
    # gp_Elips requires major >= minor: swap axes when y_radius dominates
    if x_radius >= y_radius:
        major, minor, a0, a1 = x_radius, y_radius, start_angle, end_angle
        xdir = list(xd)
    else:
        major, minor = y_radius, x_radius
        a0, a1 = start_angle - 90.0, end_angle - 90.0
        xdir = [-xd[1], xd[0], 0.0]
    return ('earc', [at(start_angle), at(end_angle)],
            [list(c), xdir, [0.0, 0.0, 1.0], major, minor, a0, a1])


def EllipticalCenterArc(center, x_radius, y_radius, start_angle=0.0, *,
                        arc_size=90.0, rotation=0.0, mode=Mode.ADD):
    """Elliptical arc about a center (build123d 0.12 EllipticalCenterArc:
    end_angle/angular_direction gave way to arc_size - a signed angle, or a
    limit shape the full ellipse is trimmed to, both ways, keeping the
    shorter piece)."""
    c = _v3(center)
    if isinstance(arc_size, (int, float)):
        if arc_size >= 0:
            end_angle = start_angle + arc_size
            a0 = start_angle
        else:
            # negative size sweeps clockwise: same point set as the CCW arc
            # from (start + arc_size) to start
            a0, end_angle = start_angle + arc_size, start_angle
        spec = _ellipse_arc_spec(c, x_radius, y_radius, a0, end_angle,
                                 rotation)
        return _line_object([spec], mode)
    if isinstance(arc_size, (tuple, list)):
        arc_size = Vector(arc_size)
    spec = _ellipse_arc_spec(c, x_radius, y_radius, 0.0, 360.0, rotation)
    trimmed = _arc_limit_curve([spec], arc_size)
    return _line_object(_specs_from_topo_edges(trimmed), mode)


# ----------------------------------------------- conic & spline 1-D objects
# build123d's analytic 1-D objects that are not circular arcs: exact conics
# (gp_Parab / gp_Hypr / gp_Elips through GC_MakeArcOf*) and exact B-splines
# (Geom_BSplineCurve from poles + knots). All of them build a LOCAL segment
# spec, which BuildLine transforms by its workplane on exit like every other
# 1-D object.

def _rot_z(v, degrees_):
    """Rotate a 3-vector about +Z (the workplane normal for 1-D objects)."""
    a = math.radians(degrees_)
    ca, sa = math.cos(a), math.sin(a)
    return [v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca, v[2]]


def _parabola_point(origin, xdir, ydir, focal, u):
    """OCCT gp_Parab parametrization: P(U) = O + U^2/(4 f) X + U Y."""
    k = u * u / (4.0 * focal)
    return [origin[i] + k * xdir[i] + u * ydir[i] for i in range(3)]


def _hyperbola_point(origin, xdir, ydir, major, minor, u):
    """OCCT gp_Hypr parametrization: P(U) = O + a cosh(U) X + b sinh(U) Y."""
    ch, sh = math.cosh(u), math.sinh(u)
    return [origin[i] + major * ch * xdir[i] + minor * sh * ydir[i]
            for i in range(3)]


def _conic_arc_spec(kind, center, xdir, normal, sizes, a1_deg, a2_deg, sense):
    """A 'parab'/'hypr' segment spec, with the chaining end points evaluated
    from the same parametric equation the kernel will use."""
    ydir = list(Vector(tuple(normal)).cross(Vector(tuple(xdir))))
    u1, u2 = math.radians(a1_deg), math.radians(a2_deg)
    if kind == 'parab':
        p0 = _parabola_point(center, xdir, ydir, sizes, u1)
        p1 = _parabola_point(center, xdir, ydir, sizes, u2)
    else:
        p0 = _hyperbola_point(center, xdir, ydir, sizes[0], sizes[1], u1)
        p1 = _hyperbola_point(center, xdir, ydir, sizes[0], sizes[1], u2)
    if not sense:
        p0, p1 = p1, p0
    return (kind, [p0, p1],
            [list(center), list(xdir), list(normal), sizes, a1_deg, a2_deg,
             bool(sense)])


def _arc_limit_curve(specs, arc_limit):
    """build123d's numeric-or-limit arc_size: build the half arc both ways,
    trim each at its first intersection with the limit and keep the shorter
    (ParabolicCenterArc / HyperbolicCenterArc)."""
    full = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
    edge = _single_edge_of(full)
    candidates = ShapeList()
    for candidate in (edge, _reverse_1d(edge)):
        trimmed = candidate.trim_to_other(arc_limit)
        if trimmed is not None:
            candidates.append(trimmed)
    if not candidates:
        raise ValueError('the arc does not intersect the arc limit ' +
                         repr(arc_limit))
    return candidates.sort_by(Edge.length)[0]


def ParabolicCenterArc(vertex, focal_length, start_angle=0.0, *,
                       arc_size=90.0, rotation=0.0, mode=Mode.ADD):
    """Parabolic arc about a vertex point (build123d ParabolicCenterArc):
    gp_Parab(plane, focal_length) trimmed by GC_MakeArcOfParabola between the
    two given "angles" (upstream converts them to radians and passes them as
    the curve parameters). 0.12 replaced end_angle/angular_direction with
    arc_size (signed, or a limit shape)."""
    c = _v3(vertex)
    xdir = _rot_z([1.0, 0.0, 0.0], rotation)
    normal = [0.0, 0.0, 1.0]
    if isinstance(arc_size, (int, float)):
        spec = _conic_arc_spec('parab', c, xdir, normal, float(focal_length),
                               start_angle, start_angle + arc_size,
                               arc_size >= 0)
        return _line_object([spec], mode)
    if isinstance(arc_size, (tuple, list)):
        arc_size = Vector(arc_size)
    spec = _conic_arc_spec('parab', c, xdir, normal, float(focal_length),
                           start_angle, start_angle + 180.0, True)
    trimmed = _arc_limit_curve([spec], arc_size)
    return _line_object(_specs_from_topo_edges(trimmed), mode)


def HyperbolicCenterArc(center, x_radius, y_radius, start_angle=0.0, *,
                        arc_size=90.0, rotation=0.0, mode=Mode.ADD):
    """Hyperbolic arc about a center point (build123d HyperbolicCenterArc):
    gp_Hypr trimmed by GC_MakeArcOfHyperbola. gp_Hypr needs major >= minor, so
    a taller-than-wide hyperbola is built rotated by 90 degrees with its angle
    range shifted to match, exactly like Edge.make_hyperbola. 0.12 replaced
    end_angle/angular_direction with arc_size (signed, or a limit shape)."""
    c = _v3(center)
    normal = [0.0, 0.0, 1.0]
    if y_radius > x_radius:
        major, minor, correction = y_radius, x_radius, 90.0
    else:
        major, minor, correction = x_radius, y_radius, 0.0
    xdir = _rot_z([1.0, 0.0, 0.0], rotation + correction)
    sizes = [float(major), float(minor)]
    if isinstance(arc_size, (int, float)):
        spec = _conic_arc_spec('hypr', c, xdir, normal, sizes,
                               start_angle - correction,
                               start_angle + arc_size - correction,
                               arc_size >= 0)
        return _line_object([spec], mode)
    if isinstance(arc_size, (tuple, list)):
        arc_size = Vector(arc_size)
    spec = _conic_arc_spec('hypr', c, xdir, normal, sizes,
                           start_angle - correction,
                           start_angle + 180.0 - correction, True)
    trimmed = _arc_limit_curve([spec], arc_size)
    return _line_object(_specs_from_topo_edges(trimmed), mode)


def EllipticalStartArc(start_pnt, start_tangent, x_radius, y_radius, arc_size,
                       start_angle=None, major_axis_dir=None, mode=Mode.ADD):
    """Elliptical arc from a start point + tangent (build123d
    EllipticalStartArc): the ellipse frame is derived from the tangent, then
    the arc is the ordinary EllipticalCenterArc of that frame."""
    start = Vector(tuple(_v3(start_pnt)))
    normal = Vector(0, 0, 1)

    def proj(v):
        return v - normal * v.dot(normal)
    tangent = proj(Vector(tuple(_v3(start_tangent))))
    if start_angle is not None:
        rad = math.radians(start_angle)
        pln_tangent = tangent.normalized()
        a_radius = -x_radius * math.sin(rad)
        b_radius = y_radius * math.cos(rad)
        x_dir = (pln_tangent * a_radius -
                 normal.cross(pln_tangent) * b_radius) * \
            (1.0 / (a_radius * a_radius + b_radius * b_radius))
        pln_x_dir = x_dir.normalized()
    elif major_axis_dir is not None:
        pln_x_dir = proj(Vector(tuple(_v3(major_axis_dir)))).normalized()
        pln_y_dir = normal.cross(pln_x_dir)
        start_angle = math.degrees(math.atan2(
            -(tangent.dot(pln_x_dir) / x_radius),
            (tangent.dot(pln_y_dir) / y_radius)))
        rad = math.radians(start_angle)
    else:
        raise ValueError('Either start_angle or major_axis_dir must be '
                         'provided')
    pln_y_dir = normal.cross(pln_x_dir)
    origin = start - pln_x_dir * (x_radius * math.cos(rad)) - \
        pln_y_dir * (y_radius * math.sin(rad))
    rotation = math.degrees(math.atan2(pln_x_dir.Y, pln_x_dir.X))
    return EllipticalCenterArc(origin, x_radius, y_radius,
                               start_angle=start_angle, arc_size=arc_size,
                               rotation=rotation, mode=mode)


# ------------------------------------------- constrained arcs and lines ---
# build123d's ConstrainedArcs/ConstrainedLines are thin wrappers over OCCT's
# 2-D geometric constraint solvers (Geom2dGcc_Circ2d2TanRad, _Circ2d2TanOn,
# _Circ2d3Tan, _Circ2dTanCen, _Circ2dTanOnRad, _Lin2d2Tan, _Lin2dTanObl driven
# through Geom2dGcc_QualifiedCurve). That whole family used to be missing from
# this wasm build - the .d.ts declared it but the module exposed nothing,
# because ONE method (WhichQualifier, which returns GccEnt_Position through
# non-const references Embind cannot bind) failed the compile of every binding
# file in the package. The fork now filters that method, so the solvers are
# real here and the calls below are a statement-for-statement port of
# build123d 0.11.1's topology/constrained_lines.py; the kernel side lives in
# StandardLibrary.js (ConstrainedArcs2D / ConstrainedLines2D).


def _tangency_pair(arg):
    """Normalize one tangency argument to the {edge|point, qualifier} spec the
    kernel helper takes (upstream's _as_gcc_arg input side): a Vertex or a
    plain point is upstream's Geom2d_CartesianPoint argument, an Edge/Curve is
    a Geom2dGcc_QualifiedCurve, and an Axis is the infinite line through it."""
    qualifier = Tangency.UNQUALIFIED
    if isinstance(arg, tuple) and len(arg) == 2 and \
            not isinstance(arg[0], (int, float)):
        arg, qualifier = arg[0], arg[1]
    if isinstance(arg, Axis):
        # upstream passes an Axis through Edge as well: a long line segment
        # through the axis is the same qualified curve for the solvers, whose
        # tangency parameter is then checked against the segment's range
        big = 1e4
        p0 = Vector(arg.position) - Vector(arg.direction) * big
        p1 = Vector(arg.position) + Vector(arg.direction) * big
        arg = Edge.make_line(p0, p1)
    if isinstance(arg, Vertex):
        return {'point': list(tuple(arg))[:2]}
    if isinstance(arg, Mixin1D) and getattr(arg, 'topo', None) is not None:
        edge = arg if isinstance(arg, Edge) else _single_edge_of(arg)
        return {'edge': edge.topo, 'qualifier': qualifier}
    if isinstance(arg, (Wire, Shape)) and getattr(arg, 'topo', None) is not None:
        return {'edge': arg.edges()[0].topo, 'qualifier': qualifier}
    v = _v3(arg)
    return {'point': [v[0], v[1]]}


def _constrained_curve(topo_edges, selector, mode):
    """Apply the user's selector and hand the result to the BuildLine, like
    build123d's BaseCurveObject does."""
    edges = ShapeList([Edge(t) for t in topo_edges])
    selected = selector(edges) if selector is not None else edges
    if selected is None:
        raise ValueError('selector must return an Edge or list of Edges, not '
                         'None')
    if isinstance(selected, Mixin1D):
        selected = [selected]
    if not selected:
        raise ValueError('selector must return an Edge or list of Edges, not '
                         'None')
    specs = []
    for edge in selected:
        specs.extend(_specs_from_topo_edges(edge))
    return _line_object(specs, mode)


def _sagitta_index(sagitta):
    if sagitta == Sagitta.BOTH:
        return 1
    if sagitta == Sagitta.LONG:
        return -1
    return 0


def _constrained_arc_topos(args, radius=None, center=None, center_on=None,
                           sagitta=Sagitta.SHORT):
    """The RAW candidate arcs of the Geom2dGcc solvers (TopoDS edges) —
    ConstrainedArcs applies the selector on top; upstream's
    Edge.make_constrained_arcs returns exactly these."""
    if not args:
        raise ValueError('ConstrainedArcs requires at least one tangency')
    opts = {'sagitta': _sagitta_index(sagitta)}
    if center is not None:
        if len(args) != 1:
            raise ValueError('ConstrainedArcs(center=) takes one tangency')
        c = _v3(center)
        opts['center'] = [c[0], c[1]]
    elif center_on is not None:
        on = center_on[0] if isinstance(center_on, tuple) else center_on
        if isinstance(on, Axis):
            big = 1e4
            on = Edge.make_line(Vector(on.position) - Vector(on.direction) * big,
                                Vector(on.position) + Vector(on.direction) * big)
        if getattr(on, 'topo', None) is None:
            raise TypeError('center_on must be an Edge, Wire or Axis')
        opts['centerOn'] = on.topo if isinstance(on, Edge) else on.edges()[0].topo
        if len(args) == 1:
            if radius is None:
                raise ValueError('ConstrainedArcs(center_on=) with one '
                                 'tangency also needs radius=')
            opts['radius'] = float(radius)
    elif len(args) == 3:
        pass                                     # three-tangency solver
    else:
        if radius is None:
            raise ValueError('ConstrainedArcs requires radius=, center=, '
                             'center_on= or three tangencies')
        if radius <= 0:
            raise ValueError('radius must be > 0.0')
        opts['radius'] = float(radius)
    specs = [_tangency_pair(a) for a in args]
    return w.ConstrainedArcs2D(specs, opts)


def ConstrainedArcs(*args, radius=None, center=None, center_on=None,
                    sagitta=Sagitta.SHORT, selector=None, mode=Mode.ADD):
    """Circular arc(s) constrained by tangency to other geometry (build123d
    ConstrainedArcs). All five upstream overloads are supported, each on the
    OCCT solver upstream uses:

      (t1, t2, radius=)            Geom2dGcc_Circ2d2TanRad
      (t1, t2, center_on=)         Geom2dGcc_Circ2d2TanOn
      (t1, t2, t3)                 Geom2dGcc_Circ2d3Tan
      (t1, center=)                Geom2dGcc_Circ2dTanCen     (full circles)
      (t1, radius=, center_on=)    Geom2dGcc_Circ2dTanOnRad   (full circles)
    """
    return _constrained_curve(
        _constrained_arc_topos(args, radius=radius, center=center,
                               center_on=center_on, sagitta=sagitta),
        selector, mode)


def _constrained_line_topos(args, angle=None, direction=None):
    """The RAW candidate lines of the Geom2dGcc solvers (TopoDS edges) —
    upstream's Edge.make_constrained_lines returns exactly these."""
    if len(args) != 2:
        raise ValueError('ConstrainedLines takes exactly two arguments')
    if angle is not None or direction is not None:
        reference = args[1]
        if not isinstance(reference, Axis):
            raise TypeError('the oriented form of ConstrainedLines needs an '
                            'Axis as its second argument')
        if abs(abs(Vector(reference.direction).Z) - 1) < _TOL_1E6:
            raise ValueError("reference Axis can't be perpendicular to "
                             'Plane.XY')
        if angle is None:
            d = _v3(direction)
            ref_angle = math.atan2(Vector(reference.direction).Y,
                                   Vector(reference.direction).X)
            angle_rad = math.atan2(d[1], d[0]) - ref_angle
        else:
            angle_rad = math.radians(angle)
        opts = {'angle': angle_rad,
                'axis': {'position': [Vector(reference.position).X,
                                      Vector(reference.position).Y],
                         'direction': [Vector(reference.direction).X,
                                       Vector(reference.direction).Y]}}
        return w.ConstrainedLines2D([_tangency_pair(args[0])], opts)
    specs = [_tangency_pair(a) for a in args]
    return w.ConstrainedLines2D(specs, {})


def ConstrainedLines(*args, angle=None, direction=None, selector=None,
                     mode=Mode.ADD):
    """Line(s) constrained by tangency (build123d ConstrainedLines):

      (t1, t2)                     Geom2dGcc_Lin2d2Tan  (t2 may be a point)
      (t1, axis, angle=|direction=) Geom2dGcc_Lin2dTanObl
    """
    return _constrained_curve(
        _constrained_line_topos(args, angle=angle, direction=direction),
        selector, mode)


def BSpline(control_points, knots, degree, weights=None, periodic=False,
            mode=Mode.ADD):
    """An EXACT B-spline edge from poles, a knot sequence and a degree
    (build123d BSpline / Edge.make_bspline): repeated knot values become knot
    multiplicities, weights make it rational."""
    knot_list = [float(k) for k in knots]
    if not knot_list:
        raise ValueError('B-spline requires at least one knot')
    poles = [list(_v3(p)) for p in control_points]
    unique_knots = [knot_list[0]]
    mults = [1]
    for knot in knot_list[1:]:
        if abs(knot - unique_knots[-1]) <= _TOL_1E6:
            mults[-1] += 1
        else:
            unique_knots.append(knot)
            mults.append(1)
    weight_list = [float(x) for x in weights] if weights else []
    params = [poles, unique_knots, mults, int(degree), weight_list,
              bool(periodic)]
    topo = w.BSplineEdge(poles, unique_knots, mults, int(degree), weight_list,
                         bool(periodic))
    p0 = list(w._edgePointAt(topo, 0.0))
    p1 = list(w._edgePointAt(topo, 1.0))
    return _line_object([('bspline', [p0, p1], params)], mode)


def Airfoil(airfoil_code, n_points=50, finite_te=False, mode=Mode.ADD):
    """A NACA 4-digit (or fractional) airfoil section as a closed line
    (build123d Airfoil): cosine-spaced chord stations, the standard thickness
    distribution and camber line, interpolated as one periodic spline."""
    s = str(airfoil_code).replace('NACA', '').strip()
    if '.' in s:
        int_part, frac_part = s.split('.', 1)
        m = int(int_part[0]) / 100.0
        p = int(int_part[1]) / 10.0
        t = float(('%02d' % int(int_part[2:])) + '.' + frac_part) / 100.0
    else:
        m = int(s[0]) / 100.0
        p = int(s[1]) / 10.0
        t = int(s[2:]) / 100.0
    xs = [(1 - math.cos(math.pi * i / (n_points - 1))) / 2.0
          for i in range(n_points)]
    a0, a1, a2, a3 = 0.2969, -0.1260, -0.3516, 0.2843
    a4 = -0.1015 if finite_te else -0.1036
    yt = [5 * t * (a0 * math.sqrt(x) + a1 * x + a2 * x ** 2 + a3 * x ** 3 +
                   a4 * x ** 4) for x in xs]
    yc, dyc = [], []
    for x in xs:
        if m == 0 or p == 0 or p == 1:
            yc.append(0.0)
            dyc.append(0.0)
        elif x < p:
            yc.append(m / p ** 2 * (2 * p * x - x * x))
            dyc.append(2 * m / p ** 2 * (p - x))
        else:
            yc.append(m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x * x))
            dyc.append(2 * m / (1 - p) ** 2 * (p - x))
    theta = [math.atan(d) for d in dyc]
    upper = [(xs[i] - yt[i] * math.sin(theta[i]),
              yc[i] + yt[i] * math.cos(theta[i]), 0.0)
             for i in range(n_points)]
    lower = [(xs[i] + yt[i] * math.sin(theta[i]),
              yc[i] - yt[i] * math.cos(theta[i]), 0.0)
             for i in range(n_points)]
    ordered = upper[::-1] + lower
    # dict.fromkeys over build123d Vectors: identity is the position ROUNDED
    # to GEOM_KEY_DIGITS (Vector.__hash__), which is what collapses the two
    # trailing-edge points (1, +-1.8e-17) into one — without that the
    # periodic interpolation is handed a 3.6e-17 closing gap and OCCT's
    # BSplCLib::Interpolate fails
    unique, seen = [], []
    for pnt in ordered:
        key = (round(pnt[0], 5), round(pnt[1], 5), round(pnt[2], 5))
        if key not in seen:
            seen.append(key)
            unique.append(pnt)
    specs = [('interp', [list(pnt) for pnt in unique],
              [[], not finite_te, True])]
    if finite_te:
        specs.append(('line', [list(unique[-1]), list(unique[0])]))
    return _line_object(specs, mode)


def BlendCurve(curve0, curve1, continuity=ContinuityLevel.C2, end_points=None,
               tangent_scalars=None, mode=Mode.ADD):
    """A Bezier transition between two curves that matches position, tangent
    (C1, cubic) and curvature (C2, quintic) at the join — build123d
    BlendCurve's control-point construction, verbatim."""
    tan_scalars = (1.0, 1.0) if tangent_scalars is None else tuple(tangent_scalars)
    if len(tan_scalars) != 2:
        raise ValueError('tangent_scalars must be a (start, end) pair')
    curves = (curve0, curve1)
    if end_points is None:
        best, end_pnts = None, None
        for v0 in curve0.vertices():
            for v1 in curve1.vertices():
                d = (Vector(tuple(v0)) - Vector(tuple(v1))).length
                if best is None or d < best:
                    best = d
                    end_pnts = (tuple(v0), tuple(v1))
    else:
        end_pnts = tuple(end_points)
    end_params = [0, 0]
    for i in range(2):
        given = Vector(tuple(_v3(end_pnts[i])))
        if (given - curves[i].position_at(0)).length < _TOL_1E6:
            end_params[i] = 0
        elif (given - curves[i].position_at(1)).length < _TOL_1E6:
            end_params[i] = 1
        else:
            raise ValueError('end_points must be at either the start or end '
                             'of a curve')
    start_pos = curve0.position_at(end_params[0])
    end_pos = curve1.position_at(end_params[1])
    start_deriv = curve0.derivative_at(end_params[0], 1) * tan_scalars[0]
    end_deriv = curve1.derivative_at(end_params[1], 1) * tan_scalars[1]
    if continuity == ContinuityLevel.C0:
        return Line(start_pos, end_pos, mode=mode)
    if continuity == ContinuityLevel.C1:
        cntl_pnts = [start_pos, start_pos + start_deriv * (1.0 / 3.0),
                     end_pos - end_deriv * (1.0 / 3.0), end_pos]
    else:
        start_curv = curve0.derivative_at(end_params[0], 2)
        end_curv = curve1.derivative_at(end_params[1], 2)
        cntl_pnts = [start_pos,
                     start_pos + start_deriv * 0.2,
                     start_pos + start_deriv * 0.4 + start_curv * 0.05,
                     end_pos - end_deriv * 0.4 + end_curv * 0.05,
                     end_pos - end_deriv * 0.2,
                     end_pos]
    return Bezier(*cntl_pnts, mode=mode)


def Ellipse(x_radius, y_radius, rotation=0, align=(Align.CENTER, Align.CENTER),
            mode=Mode.ADD):
    """Elliptical sketch face (gp_Elips + GC_MakeArcOfEllipse)."""
    if x_radius >= y_radius:
        major, minor, xdir = x_radius, y_radius, [1.0, 0.0, 0.0]
        p0 = [x_radius, 0, 0]
    else:
        major, minor, xdir = y_radius, x_radius, [0.0, 1.0, 0.0]
        p0 = [0, y_radius, 0]
    segs = [('earc', [p0, [-p0[0], -p0[1], 0]],
             [[0.0, 0.0, 0.0], xdir, [0.0, 0.0, 1.0], major, minor, 0.0, 180.0]),
            ('earc', [[-p0[0], -p0[1], 0], p0],
             [[0.0, 0.0, 0.0], xdir, [0.0, 0.0, 1.0], major, minor, 180.0, 360.0])]
    maker = lambda: w.MakeFace(w.WireFromSegments(_chain_segments(segs)))
    return _sketch_object(maker, ((-x_radius, -y_radius), (x_radius, y_radius)),
                          rotation, align, mode)


def Helix(pitch, height, radius, center=(0, 0, 0), direction=(0, 0, 1),
          cone_angle=0, lefthand=False, mode=Mode.ADD):
    """Helical curve. COMPROMISE(helix): the exact Geom helix (a curve on a
    cylindrical surface) cannot be expressed in segment specs on this WASM
    build, so the helix is interpolated (GeomAPI_Interpolate) through dense
    parametric samples with analytic per-point tangents — within ~1e-6 of
    the true helix, far below harness tolerance."""
    if cone_angle:
        raise NotImplementedError('conical Helix is not supported in '
                                  'build123d-lite')
    turns = height / pitch
    n = max(16, int(64 * turns))
    sgn = -1.0 if lefthand else 1.0
    pts = []
    tans = []
    for i in range(n + 1):
        a = sgn * 2.0 * math.pi * turns * i / n
        pts.append((radius * math.cos(a), radius * math.sin(a),
                    height * i / n))
        # d/da of the parametric form (direction only; scale=True)
        t = Vector(-radius * math.sin(a) * sgn, radius * math.cos(a) * sgn,
                   pitch / (2.0 * math.pi)).normalized()
        tans.append(list(t))
    loc = Plane(Vector(center), z_dir=Vector(direction)).location
    fn_dir = lambda d: _mat_vec(loc._R, d)
    spec = _seg_transform(('interp', pts, [tans, False, True]),
                          loc._transform_point, fn_dir)
    return _line_object([spec], mode)


def polar(length, angle):
    """Convert polar coordinates into cartesian coordinates (build123d
    topology.utils.polar)."""
    return (length * math.cos(math.radians(angle)),
            length * math.sin(math.radians(angle)))


def delta(shapes_one, shapes_two):
    """Compare the OCCT objects of each list and return the differences
    (build123d topology.utils.delta). Upstream takes a set difference of the
    .wrapped objects; Brython wrappers defeat set/hash identity on the
    underlying JS objects, so membership is tested with 'is' loops instead
    (Python 'is' compares the underlying JS objects across wrappers)."""
    shapes_one = list(shapes_one)
    shapes_two = list(shapes_two)
    occt_two = [shape.wrapped for shape in shapes_two]
    shape_delta = []
    for shape in shapes_one:
        if not any(shape.wrapped is other for other in occt_two):
            shape_delta.append(shape)
    return shape_delta


def topo_explore_common_vertex(edge1, edge2):
    """Given two edges, find the common vertex, or None (build123d
    topology.zero_d.topo_explore_common_vertex). Accepts Edge wrappers or
    raw TopoDS edges."""
    topods_edge1 = edge1.wrapped if isinstance(edge1, Shape) else edge1
    topods_edge2 = edge2.wrapped if isinstance(edge2, Shape) else edge2
    if topods_edge1 is None or topods_edge2 is None:
        raise ValueError('edge is empty')
    verts1 = []
    verts2 = []
    w.ForEachVertex(topods_edge1, verts1.append)
    w.ForEachVertex(topods_edge2, verts2.append)
    for vertex1 in verts1:
        for vertex2 in verts2:
            if w._sameShape(vertex1, vertex2):
                return Vertex(vertex1)  # Common vertex found
    return None  # No common vertex found


def topo_explore_connected_edges(edge, parent=None,
                                 continuity=ContinuityLevel.C0):
    """Find edges connected to the given edge with at least the requested
    continuity (build123d topology.one_d.topo_explore_connected_edges).
    The junction continuity comes from BRepLProp::Continuity over the two
    BRepAdaptor curves at the shared vertex, exactly like upstream."""
    # GeomAbs_Shape enum value -> ContinuityLevel (C0=0, G1=1, C1=2, G2=3,
    # C2=4; anything smoother counts as C2, like upstream's default)
    continuity_map = {0: ContinuityLevel.C0, 1: ContinuityLevel.C1,
                      2: ContinuityLevel.C1, 3: ContinuityLevel.C2,
                      4: ContinuityLevel.C2}
    parent = parent if parent is not None else edge.topo_parent
    if parent is None:
        raise ValueError('edge has no valid parent')
    if edge.wrapped is None:
        raise ValueError('edge is empty')
    given_topods_edge = edge.wrapped
    connected_edges = []

    # Find all the TopoDS_Edges for this Shape
    topods_edges = [e.wrapped for e in parent.edges() if e.wrapped is not None]

    for topods_edge in topods_edges:
        # Don't match with the given edge
        if w._sameShape(given_topods_edge, topods_edge):
            continue
        # If the edge shares a vertex with the given edge they are connected
        common_vertex = topo_explore_common_vertex(given_topods_edge,
                                                   topods_edge)
        if common_vertex is not None and common_vertex.wrapped is not None:
            actual = w._edgePairContinuity(given_topods_edge, topods_edge,
                                           common_vertex.wrapped, _TOL_1E6)
            actual_level = continuity_map.get(int(actual), ContinuityLevel.C2)
            if actual_level >= continuity:
                # upstream dedupes with a set of TopoDS_Edge; sets are
                # unreliable on Brython-wrapped JS objects, so IsSame loops
                if not any(w._sameShape(topods_edge, c)
                           for c in connected_edges):
                    connected_edges.append(topods_edge)

    return ShapeList(Edge(e) for e in connected_edges)


def edges_to_wires(edges, tol=1e-6):
    """Group connected edges into wires (build123d's edges_to_wires).
    COMPROMISE(edges-to-wires): ShapeAnalysis_FreeBounds::ConnectEdgesToWires
    needs TopTools_HSequenceOfShape, which this wasm build does not bind, so
    the chaining is done here on edge endpoints — same grouping, and the
    ordering inside each wire is then fixed by ShapeFix_Wire."""
    remaining = [e for e in edges]
    wires = ShapeList()
    while remaining:
        chain = [remaining.pop(0)]
        start = chain[0].position_at(0)
        end = chain[0].position_at(1)
        grew = True
        while grew:
            grew = False
            for i in range(len(remaining)):
                p0 = remaining[i].position_at(0)
                p1 = remaining[i].position_at(1)
                if (p0 - end).length <= tol or (p1 - end).length <= tol:
                    end = p1 if (p0 - end).length <= tol else p0
                    chain.append(remaining.pop(i))
                    grew = True
                    break
                if (p1 - start).length <= tol or (p0 - start).length <= tol:
                    start = p0 if (p1 - start).length <= tol else p1
                    chain.insert(0, remaining.pop(i))
                    grew = True
                    break
        wires.append(Wire(w.WireFromEdgesFixed([_topo(e) for e in chain],
                                               tol)))
    return wires


def _specs_from_topo_edges(shape):
    """Reconstruct segment specs from raw edges: lines and circular arcs
    analytically; anything else (BSplines, ellipses, ...) as an opaque 'raw'
    segment that passes the TopoDS edge through exactly (chainable into
    wires, but not transformable)."""
    specs = []
    for e in shape.edges() if not isinstance(shape, Edge) else [shape]:
        t = w._edgeCurveType(e.topo)
        p0 = list(w._edgePointAt(e.topo, 0.0))
        p1 = list(w._edgePointAt(e.topo, 1.0))
        if t == 'Line':
            specs.append(('line', [p0, p1]))
        elif t == 'Circle' and (abs(p0[0] - p1[0]) > _TOL_1E6 or
                                abs(p0[1] - p1[1]) > _TOL_1E6 or
                                abs(p0[2] - p1[2]) > _TOL_1E6):
            pm = list(w._edgePointAt(e.topo, 0.5))
            specs.append(('arc3', [p0, pm, p1]))
        else:
            # closed circles (start == end) have no three-point form, and
            # anything that is not a line/arc (BSpline, ellipse, ...) rides
            # through as an opaque segment carrying the TopoDS edge itself
            specs.append(('raw', [p0, p1], [e.topo]))
    return specs


def SlotArc(arc, height, rotation=0, mode=Mode.ADD):
    """Slot along an arc path: BRepOffsetAPI_MakeOffset on the open wire
    yields both offset sides plus round end caps — build123d's SlotArc."""
    if isinstance(arc, Mixin1D) and arc._specs:
        specs = arc._specs
    elif isinstance(arc, Mixin1D):
        specs = _specs_from_topo_edges(arc)
    else:
        raise NotImplementedError('SlotArc requires a curve/edge')
    wire = w.WireFromSegments(_chain_segments(specs))
    closed = w.OffsetWire(wire, height / 2.0)
    face = w.MakeFace(closed)
    return _sketch_object(lambda: face, None, rotation, None, mode)


# ------------------------------------------------------------ operations ---

def _pending_or_given(to_extrude):
    """Resolve extrude/revolve/loft profiles: explicit shape(s) or the
    enclosing BuildPart's pending sketch faces. Returns [(face_topo, plane)]."""
    builder = _active_builder(BuildPart)
    profiles = []
    if to_extrude is None:
        if builder is None or not builder.pending_faces:
            raise ValueError('no sketch profile: pass a shape or create one '
                             'with BuildSketch inside BuildPart')
        for shape, plane in zip(builder.pending_faces,
                                builder.pending_face_planes):
            for f in shape.faces():
                profiles.append((f.topo, plane))
        builder.pending_faces = []
        builder.pending_face_planes = []
    else:
        for s in _tolist(to_extrude):
            for f in s.faces():
                n = w._faceNormal(f.topo)
                c = w._faceCentroid(f.topo)
                profiles.append((f.topo, Plane(origin=tuple(c), z_dir=tuple(n))))
    return profiles


def extrude(to_extrude=None, amount=None, dir=None, until=None, target=None,
            both=False, taper=0.0, clean=True, mode=Mode.ADD):
    if until is not None:
        if until not in (Until.NEXT, Until.LAST):
            raise NotImplementedError('extrude until=' + str(until) +
                                      ' is not supported in build123d-lite')
        builder = _active_builder(BuildPart)
        body = target if target is not None else \
            (builder._obj if builder is not None else None)
        if body is None or body.topo is None:
            raise ValueError('extrude(until=...) requires a target part')
        profiles = _pending_or_given(to_extrude)
        bb = list(w.BoundingBox(body.topo, 0.01))
        ln = 3.0 * max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2])
        results = []
        for (face, plane) in profiles:
            d = tuple(plane.z_dir)
            candidate = Part(w.Extrude(face, [d[0] * ln, d[1] * ln, d[2] * ln]))
            # pieces of the candidate OUTSIDE the body, ordered along dir
            outside = Part(w.Difference(candidate.topo, [body.topo],
                                        True, 1e-7, True))
            pieces = outside.solids()

            def proj(s):
                sb = list(w.BoundingBox(s.topo, 0.01))
                return (min(sb[0] * d[0], sb[3] * d[0]) +
                        min(sb[1] * d[1], sb[4] * d[1]) +
                        min(sb[2] * d[2], sb[5] * d[2]))
            pieces = _stable_sorted(pieces, key=proj)
            if until == Until.NEXT:
                # first void between the sketch plane and the body
                results.append(pieces[0])
            else:
                # everything up to the body's LAST surface: drop the piece
                # that extends to the candidate's far end
                results.append(candidate - pieces[-1])
        obj = results[0] if len(results) == 1 else results[0] + results[1:]
        return _combine(builder, obj, mode)
    if amount is None and isinstance(to_extrude, (int, float)):
        amount = to_extrude
        to_extrude = None
    if amount is None:
        raise ValueError('extrude requires amount=')
    if taper and (both or dir is not None):
        raise NotImplementedError('extrude taper with both=/dir= is not '
                                  'supported in build123d-lite')
    builder = _active_builder(BuildPart)
    profiles = _pending_or_given(to_extrude)
    results = []
    for (face, plane) in profiles:
        if taper:
            # build123d's Solid.extrude_taper uses TWO algorithms: LocOpe_DPrism
            # only when the extrusion runs along the profile normal with a
            # POSITIVE taper and no holes, otherwise a LOFT between the profile
            # wires and their 2-D offsets (offset = -length * tan(taper),
            # Kind.INTERSECTION), with the inner wires' taper flipped.
            profile = Face(face)
            inner = profile.inner_wires()
            if taper > 0 and not inner and plane.z_dir.Z > 0:
                solid = w.TaperExtrude(face, amount, taper)
                results.append(Part(solid))
                continue
            offset_amt = -abs(amount) * math.tan(math.radians(taper))
            base = Plane(profile)
            shift = Pos(base.z_dir.X * amount, base.z_dir.Y * amount,
                        base.z_dir.Z * amount)
            solids = []
            for i, wire in enumerate([profile.outer_wire()] + list(inner)):
                flip = -1.0 if i > 0 else 1.0
                local = base.location.inverse() * wire
                local_taper = Curve(_topo(local)).offset_2d(
                    flip * offset_amt, kind=Kind.INTERSECTION)
                taper_wire = shift * (base.location * Curve(_topo(local_taper)))
                solids.append(Part(w.Loft([_topo(wire), _topo(taper_wire)],
                                          False)))
            solid = solids[0] if len(solids) == 1 else \
                (solids[0] - solids[1:])
            results.append(Part(_topo(solid)))
            continue
        d = tuple(Vector(dir).normalized()) if dir is not None else tuple(plane.z_dir)
        vec = [d[0] * amount, d[1] * amount, d[2] * amount]
        if both:
            f2 = w.Translate([-vec[0], -vec[1], -vec[2]], face, True)
            solid = w.Extrude(f2, [2 * vec[0], 2 * vec[1], 2 * vec[2]])
        else:
            solid = w.Extrude(face, vec)
        results.append(Part(solid))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def revolve(profiles=None, axis=Axis.Z, revolution_arc=360, clean=True,
            mode=Mode.ADD):
    builder = _active_builder(BuildPart)
    profs = _pending_or_given(profiles)
    o = tuple(axis.position)
    d = list(axis.direction)
    shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
    results = []
    for (face, plane) in profs:
        topo = face
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo)
        topo = w.Revolve(topo, revolution_arc, d)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        results.append(Part(topo))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def make_brake_formed(thickness, station_widths, line=None, side=Side.LEFT,
                      kind=Kind.ARC, clean=True, mode=Mode.ADD):
    """Sheet-metal brake forming (build123d make_brake_formed) - a
    statement-for-statement port of operations_part.make_brake_formed.

    The outline is offset by the sheet thickness to get the SECTION, a station
    edge is paired to every vertex of the line (the offset vertex exactly
    thickness away), each station edge is extruded by its width along the
    section plane's normal, and consecutive station faces are swept along the
    matching segment of the line and fused."""
    builder = _active_builder(BuildPart)
    if line is None:
        # upstream reads BuildPart.pending_edges_as_wire; in lite a BuildLine
        # directly inside a BuildPart leaves its result in pending_path
        line = getattr(builder, 'pending_path', None) if builder else None
        if line is None:
            raise ValueError('A line must be provided')
        builder.pending_path = None
    elif isinstance(line, Mixin1D) and len(line.edges()) == 0:
        raise ValueError('A line must be provided')
    offset_line = line.offset_2d(distance=thickness, kind=kind, side=side,
                                 closed=True)
    offset_vertices = offset_line.vertices()
    try:
        plane = Plane(Face(offset_line))
    except Exception:
        raise ValueError('line not suitable - probably straight')

    line_vertices = line.vertices()
    if isinstance(station_widths, (int, float)):
        widths = [float(station_widths)] * len(line_vertices)
    else:
        widths = [float(x) for x in station_widths]
    if len(widths) != len(line_vertices):
        raise ValueError('widths must either be a single number or an '
                         'iterable with a length of the # vertices in line (' +
                         str(len(line_vertices)) + ')')

    station_edges = ShapeList()
    for vertex in line_vertices:
        base = Vector(tuple(vertex))
        others = offset_vertices.sort_by_distance(base)
        for other in others[1:]:
            if abs((base - Vector(tuple(other))).length - thickness) < 1e-2:
                station_edges.append(Edge.make_line(base,
                                                    Vector(tuple(other))))
                break
    station_edges = station_edges.sort_by(line)

    z = Vector(plane.z_dir)
    station_faces = [Face.extrude(e, z * width)
                     for e, width in zip(station_edges, widths)]
    sweep_paths = line.edges().sort_by(line)
    sections = []
    for i in range(len(station_faces) - 1):
        # MakePipeShell needs a WIRE spine; each sweep path here is a single
        # edge of the outline
        path_topo = w.WireFromEdgesFixed([_topo(sweep_paths[i])])
        sections.append(Part(w.PipeShellSweep(
            [w._faceOuterWire(station_faces[i].topo),
             w._faceOuterWire(station_faces[i + 1].topo)],
            path_topo, False, '', [], 0, True)))
    if len(sections) > 1:
        solid = sections[0]
        for extra in sections[1:]:
            solid = solid.fuse(extra)
    else:
        solid = sections[0]
    return _combine(builder, Part(solid.topo), mode)


def _permutations(items):
    """itertools.permutations order (lexicographic over positions)."""
    if len(items) <= 1:
        return [tuple(items)]
    out = []
    for i in range(len(items)):
        rest = items[:i] + items[i + 1:]
        for tail in _permutations(rest):
            out.append((items[i],) + tail)
    return out


def loft(sections=None, ruled=False, clean=True, mode=Mode.ADD):
    """Loft through the sections (build123d loft): the outer wires make the
    solid; since 0.12 faces with ANY number of inner wires are supported -
    the holes are matched section to section by the permutation minimising
    the summed centre distance, lofted separately and cut out."""
    builder = _active_builder(BuildPart)
    if sections is None:
        profs = _pending_or_given(None)
        faces = [Face(t) for t, _pl in profs]
    else:
        faces = []
        for s in _tolist(sections):
            faces.extend(s.faces())
    outer = [f.outer_wire() for f in faces]
    hole_counts = [len(f.inner_wires()) for f in faces]
    if any(hole_counts) and len(set(hole_counts)) != 1:
        raise ValueError('All sections must have the same number of inner '
                         'wires')
    hole_sections = []
    if hole_counts and hole_counts[0]:
        hole_sections = [[wire] for wire in faces[0].inner_wires()]
        n = len(hole_sections)
        for face in faces[1:]:
            holes = face.inner_wires()
            best = None
            for perm in _permutations(list(range(n))):
                grouping = list(zip(range(n), perm))
                quality = sum((hole_sections[j][-1].center() -
                               holes[k].center()).length
                              for j, k in grouping)
                cand = (quality, grouping)
                if best is None or cand < best:
                    best = cand
            for j, k in best[1]:
                hole_sections[j].append(holes[k])
    solid = Solid.make_loft(outer, ruled)
    if hole_sections:
        solid = Part(solid.topo) - [Solid.make_loft(h, ruled)
                                    for h in hole_sections]
    return _combine(builder, Part(_topo(solid)), mode)


def sweep(sections=None, path=None, multisection=False, is_frenet=False,
          transition=Transition.TRANSFORMED, normal=None, binormal=None,
          clean=True, mode=Mode.ADD):
    """Sweep profile faces along a path with BRepOffsetAPI_MakePipeShell,
    matching build123d's Solid.sweep / Solid.sweep_multi trihedron and
    transition usage (SetMode(is_frenet); normal= -> fixed-binormal gp_Ax2
    with WithCorrection; binormal= wire -> auxiliary spine; multisection
    never sets a transition mode and uses each face's OUTER wire only).
    The calls match upstream exactly; the ~0.02% volume residual seen on the
    multisection handle example against OCP 7.x was the kernel version -
    against build123d 0.13.0 (OCCT 8.0.1) it agrees to 1e-8 relative."""
    builder = _active_builder(BuildPart)
    if path is None and builder is not None:
        path = getattr(builder, 'pending_path', None)
    if path is None:
        raise ValueError('sweep requires path= (or a BuildLine inside the '
                         'BuildPart)')
    if isinstance(path, Mixin1D) and path._specs:
        # multi-segment curves: build ONE chained wire (their topo may be a
        # compound of separate wires, of which GetWire would take only one)
        path_topo = w.WireFromSegments(_chain_segments(path._specs))
    else:
        path_topo = _topo(path)
        if not hasattr(path_topo, 'ShapeType') or path_topo.ShapeType().value != 5:
            path_topo = w.GetWire(path_topo, 0, True)
    tmap = {Transition.TRANSFORMED: 'transformed', Transition.ROUND: 'round',
            Transition.RIGHT: 'right'}
    trans = tmap.get(transition, 'transformed')
    # 0/[]/'' stand in for "absent" — Brython None breaks CacheOp hashing
    binormal_vec = []
    aux_spine = 0
    if binormal is not None:
        if isinstance(binormal, Mixin1D) and binormal._specs:
            aux_spine = w.WireFromSegments(_chain_segments(binormal._specs))
        else:
            aux_spine = _topo(binormal)
    elif normal is not None:
        binormal_vec = list(Vector(normal))
    profs = _pending_or_given(sections)
    if multisection:
        wires = [w._faceOuterWire(face) for (face, plane) in profs]
        solid = w.PipeShellSweep(wires, path_topo, is_frenet, '',
                                 binormal_vec, aux_spine, True)
        return _combine(builder, Part(solid), mode)
    results = []
    for (face, plane) in profs:
        outer = w._faceOuterWire(face)
        inner = [c.topo for c in Face(face).inner_wires()]
        solid = w.PipeShellSweep([outer], path_topo, is_frenet, trans,
                                 binormal_vec, aux_spine, True)
        if inner:
            tools = [w.PipeShellSweep([iw], path_topo, is_frenet, trans,
                                      binormal_vec, aux_spine, True)
                     for iw in inner]
            solid = w.Difference(solid, tools)
        results.append(Part(solid))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def _edges_by_parent(objects):
    """(target shape, per-shape edge indices) for fillet/chamfer.

    build123d takes the target from the ACTIVE BUILDER (operations_generic's
    target = context._obj) and hands the raw TopoDS edges to
    BRepFilletAPI, which matches them by identity — so an edge pool assembled
    from several intermediate shapes ([f.outer_wire().edges() for f in
    faces], the topology-selection docs' group_hole_area) is perfectly legal
    as long as every edge IS an edge of the target. Lite re-wraps shapes, so
    the same question is answered geometrically: each edge is mapped onto the
    target's edge with the same midpoint and length."""
    edges = []
    for o in _tolist(objects):
        if isinstance(o, Edge):
            edges.append(o)
        elif isinstance(o, (ShapeList, list, tuple)):
            for e in o:
                if isinstance(e, Edge):
                    edges.append(e)
                elif isinstance(e, (ShapeList, list, tuple)):
                    edges.extend([x for x in e if isinstance(x, Edge)])
    if not edges:
        raise ValueError('no edges given (use shape.edges() selectors)')
    builder = _active_builder()
    target = builder._obj if (builder is not None and
                              builder._obj is not None and
                              builder._obj.topo is not None) else None
    if target is None:
        # algebra mode: the shape the edges were selected from (upstream
        # objects[0].topo_parent - the OUTERMOST source)
        target = edges[0].topo_parent
        for e in edges:
            if e.topo_parent is not target:
                raise ValueError('all edges must belong to the same shape')
    if target is None or target.topo is None:
        raise ValueError('these edges have no parent shape, so they cannot be '
                         'filleted/chamfered (select them with shape.edges() '
                         '/ builder.edges(...))')
    keyed = {}
    for e in target.edges():
        keyed[_shape_key(e, 'edge')] = e.index
    indices = []
    for e in edges:
        if e.topo_owner is target and e.index is not None:
            indices.append(e.index)
            continue
        idx = keyed.get(_shape_key(e, 'edge'))
        if idx is None:
            raise ValueError('one of these edges is not an edge of the shape '
                             'being filleted/chamfered (select them with '
                             'shape.edges() / builder.edges(...))')
        indices.append(idx)
    return target, indices


def _wire_common_plane(line):
    """The plane a planar wire lies in (build123d Mixin1D.common_plane), with
    its origin at the wire's start. The normal comes from Newell's method over
    the sampled polyline, which is exact for a planar loop and stable for the
    open lines fillet() works on."""
    pts = []
    for edge in line.edges():
        for i in range(5):
            pts.append(edge.position_at(i / 4.0))
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        a = pts[i]
        b = pts[(i + 1) % len(pts)]
        nx += (a.Y - b.Y) * (a.Z + b.Z)
        ny += (a.Z - b.Z) * (a.X + b.X)
        nz += (a.X - b.X) * (a.Y + b.Y)
    normal = Vector(nx, ny, nz)
    if normal.length <= _TOL_1E6:
        # a straight (degenerate) outline - any plane containing it will do
        direction = (pts[-1] - pts[0]).normalized()
        helper_v = Vector(0, 0, 1)
        if abs(direction.dot(helper_v)) > 0.9:
            helper_v = Vector(1, 0, 0)
        normal = direction.cross(helper_v)
    return Plane(origin=line.position_at(0), z_dir=normal.normalized())


def _wire_fillet_corner(edges, index, vertex, radius):
    """Fillet ONE corner of a connection-ordered edge list, returning the new
    list (build123d's _fillet_wire_corner + _splice_wire_fillet_corner).

    The solver is upstream's primary one, ChFi2d_FilletAlgo, which the fork now
    binds; upstream's Geom2dGcc_Circ2d2TanRad fallback is used when ChFi2d
    finds no result on this corner (the same two-tangent-arc construction that
    backs ConstrainedArcs)."""
    e0, e1 = edges[index[0]], edges[index[1]]
    point = [vertex.X, vertex.Y, vertex.Z]
    solved = w.FilletWireCorner(e0.topo, e1.topo, point, radius)
    if solved is not None:
        arc = Edge(solved[0])
        trimmed = [Edge(solved[1]), Edge(solved[2])]
    else:
        # upstream's fallback: every arc of the given radius tangent to both
        # edges, nearest the corner, then each edge trimmed at its contact
        arcs = ShapeList([Edge(t) for t in w.ConstrainedArcs2D(
            [{'edge': e0.topo, 'qualifier': Tangency.UNQUALIFIED},
             {'edge': e1.topo, 'qualifier': Tangency.UNQUALIFIED}],
            {'radius': radius, 'sagitta': 1})])
        if not arcs:
            raise ValueError('Fillet algorithm failed for ' + str(point) +
                             ' with radius ' + str(radius))
        arc = arcs.sort_by_distance(Vector(point))[0]
        trimmed = []
        for e in (e0, e1):
            contact = arc.vertices().sort_by_distance(e)[0]
            pieces = _split_1d_at_point(e, Vector(tuple(contact)))
            far = [v for v in e.vertices()
                   if (Vector(tuple(v)) - Vector(point)).length > _TOL_1E6]
            keep = None
            for piece in pieces:
                for v in piece.vertices():
                    for f in far:
                        if (Vector(tuple(v)) -
                                Vector(tuple(f))).length <= _TOL_1E6:
                            keep = piece
            trimmed.append(keep if keep is not None else e)

    out = list(edges)
    out[index[0]] = trimmed[0]
    out[index[1]] = trimmed[1]
    n = len(out)
    if index[1] == (index[0] + 1) % n:
        insert_at = index[0] + 1
    else:
        insert_at = index[1] + 1
    out.insert(insert_at, arc)
    return out


def _wire_fillet_2d(line, vertices, radius):
    """The 1-D corner fillet of an open (or closed) planar wire - build123d's
    Wire.fillet_2d, driven from the fillet() operation's 1-D branch.

    Upstream filters the wire's END vertices out in fillet() (they have only
    one incident edge), fillets the remaining corners ONE AT A TIME, and
    rebuilds the wire from the connection-ordered edge list with the fillet arc
    spliced between the two trimmed edges."""
    # Upstream forces the wire onto Plane.XY for the fillet (ChFi2d and the
    # Geom2dGcc solvers are 2-D) and maps the result back afterwards.
    plane = _wire_common_plane(line)
    to_local = plane.location.inverse()
    local_line = to_local * line
    local_points = [to_local._transform_point(tuple(v)) for v in vertices]
    edges = ShapeList([Edge(t) for t in w.OrderedEdges(local_line.topo)])
    start = local_line.position_at(0)
    end = local_line.position_at(1)
    closed = (start - end).length <= _TOL_1E6
    for point in local_points:
        v = Vector(point)
        if not closed and ((v - start).length <= _TOL_1E6 or
                           (v - end).length <= _TOL_1E6):
            continue                      # an end vertex cannot be filleted
        touching = []
        for i, e in enumerate(edges):
            for ev in e.vertices():
                if (Vector(tuple(ev)) - v).length <= _TOL_1E6:
                    touching.append(i)
                    break
        if len(touching) != 2:
            raise ValueError('Vertex must connect exactly two edges: ' +
                             str(v))
        edges = _wire_fillet_corner(edges, touching, v, radius)
    result = plane.location * Wire(w.WireFromOrderedEdges(
        [e.topo for e in edges]))
    # keep the wire's DIRECTION (upstream re-reverses when is_forward flips):
    # offset_2d's Side.LEFT/RIGHT is measured against the traversal direction,
    # so a flipped result would offset to the other side
    original_start = line.position_at(0)
    if ((result.position_at(0) - original_start).length >
            (result.position_at(1) - original_start).length):
        result = _reverse_1d(result)
    builder = _active_builder()
    if builder is not None:
        if isinstance(builder, BuildLine):
            builder._set_specs(_specs_from_topo_edges(result))
        elif (builder._obj is not None and
                (builder._obj is line or builder._obj.topo is line.topo)):
            _replace_obj(builder, result)
    return result


def _vertex_op_2d(objs, radius, opname):
    """2D fillet of sketch corner vertices (BRepFilletAPI_MakeFillet2d)."""
    if opname != 'fillet':
        raise NotImplementedError('2D vertex chamfers are not supported in '
                                  'build123d-lite')
    verts = [o for o in objs if isinstance(o, Vertex)]
    parent = verts[0].topo_parent
    for v in verts:
        if v.topo_parent is not parent:
            raise ValueError('all vertices must belong to the same sketch')
    if parent is None or parent.topo is None:
        raise ValueError('fillet: vertices have no parent sketch')
    faces = parent.faces()
    if len(faces) == 0:
        return _wire_fillet_2d(parent, verts, radius)
    # upstream fillet()'s 2-D branch: every face of the sketch is filleted at
    # the given vertices it contains, the others pass through
    new_topos = []
    records = []
    for face in faces:
        pts = [[v.X, v.Y, v.Z] for v in face.vertices() if v in verts]
        if pts:
            ftopo = w.FilletFace2D(face.topo, radius, pts, False, True)
            records.append(_record_of(ftopo, [face.topo], []))
            new_topos.append(ftopo)
        else:
            new_topos.append(face.topo)
    rtopo = new_topos[0] if len(new_topos) == 1 else w.MakeCompound(new_topos)
    record = ShapeHistory.of(*[_RecordHolder(r) for r in records])
    if record is not None:
        record = record.copy().with_inputs([parent.topo], [])
    result = _wrap_like(parent, rtopo)._made_by(record)
    builder = _active_builder()
    if builder is not None and builder._obj is not None and \
            (builder._obj is parent or builder._obj.topo is parent.topo):
        _replace_obj(builder, result)
    return result


def _replace_obj(builder, result):
    """An operation REPLACED the builder's object (fillet/chamfer/2-D
    fillet/offset: upstream _add_to_context(..., mode=Mode.REPLACE)): the
    operation's record relates the result to what it replaces."""
    if isinstance(builder, BuildLine):
        builder._set_specs(_curve_specs_of(result))
        return
    before = builder._obj
    record = ShapeHistory.of(result)
    record = record.copy() if record is not None else ShapeHistory()
    builder._obj = builder._wrap(result.topo)
    builder._obj._made_by(record.with_inputs(
        [before.topo] if before is not None and before.topo is not None
        else [], []))


def _edge_op(objects, jsfunc, value, opname):
    objs = _tolist(objects)
    if any(isinstance(o, Vertex) for o in objs):
        return _vertex_op_2d(objs, value, opname)
    parent, indices = _edges_by_parent(objs)
    if parent is None or parent.topo is None:
        raise ValueError(opname + ': edges have no parent shape')
    ptopo = parent.topo
    rtopo = jsfunc(ptopo, value, indices, False, True)
    # the operation's own record (BRepFilletAPI Modified/Generated, like
    # upstream's ShapeHistory.from_algorithm) rides on the result
    result = _wrap_like(parent, rtopo)._made_by(_record_of(rtopo, [ptopo], []))
    builder = _active_builder()
    if builder is not None and builder._obj is not None and \
            (builder._obj is parent or builder._obj.topo is ptopo):
        _replace_obj(builder, result)
    return result


def fillet(objects, radius):
    return _edge_op(objects, w.FilletEdges, radius, 'fillet')


def chamfer(objects, length, length2=None, angle=None):
    if length2 is not None or angle is not None:
        raise NotImplementedError('asymmetric chamfers are not supported in '
                                  'build123d-lite')
    return _edge_op(objects, w.ChamferEdges, length, 'chamfer')


def offset(objects=None, amount=0, openings=None, kind=Kind.ARC,
           side=Side.BOTH, closed=True, min_edge_length=None,
           mode=Mode.REPLACE):
    if kind == Kind.TANGENT:
        raise NotImplementedError('Kind.TANGENT offsets are not supported in '
                                  'build123d-lite')
    if min_edge_length is not None:
        raise NotImplementedError('offset(min_edge_length=) is not supported '
                                  'in build123d-lite')
    join = 'intersection' if kind == Kind.INTERSECTION else 'arc'
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets and objects is None and isinstance(builder, BuildLine):
        # inside BuildLine the line lives in the pending segment specs
        line = builder.line
        targets = [line] if line is not None else []
    if not targets:
        raise ValueError('offset: nothing to offset')
    if side != Side.BOTH:
        # one-sided offset of an OPEN line (build123d's Wire.offset_2d with
        # side=): keep one offset side, optionally closed back onto the line
        if len(targets) != 1 or not isinstance(targets[0], Mixin1D):
            raise ValueError('offset(side=...) applies to a single line')
        src = targets[0]
        if isinstance(src, Edge):
            src = Curve([src])
        result = src.offset_2d(amount, kind=kind, side=side, closed=closed)
        specs = _specs_from_topo_edges(result)
        curve = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
        if isinstance(builder, BuildLine):
            if mode == Mode.REPLACE:
                builder._set_specs(specs)
            elif mode == Mode.ADD:
                builder._add_specs(specs)
            elif mode != Mode.PRIVATE:
                raise ValueError('offset: unsupported mode ' + repr(mode) +
                                 ' inside BuildLine')
            return curve
        return _combine(builder, curve, mode)
    if openings is not None:
        # hollow the solid, removing the opening faces (MakeThickSolid —
        # the same operation build123d performs)
        if len(targets) != 1:
            raise ValueError('offset(openings=...) expects a single target')
        target = targets[0]
        faces = [o.topo for o in _tolist(openings)]
        result = _wrap_like(target,
                            w.ThickSolidOffset(_topo(target), faces, amount, 1e-4))
        return _combine(builder, result, mode)
    def _is_2d(t):
        return t.topo is not None and len(t.solids()) == 0 and \
            len(t.faces()) > 0

    if all([_is_2d(t) for t in targets]):
        # 2-D offset of FACES: upstream offsets the outer wire by +amount and
        # every inner wire by -amount, rebuilds the planar face and subtracts
        # the (possibly overshooting) inner faces — operations_generic.offset's
        # face branch. A 3-D MakeOffsetShape here would thicken the sketch.
        new_faces = []
        for t in targets:
            for face in t.faces():
                outer = face.outer_wire().offset_2d(amount, kind=kind)
                inner_wires = []
                for hole in face.inner_wires():
                    try:
                        inner_wires.append(hole.offset_2d(-amount, kind=kind))
                    except Exception:
                        pass
                new_face = Face(outer)
                if (new_face.normal_at() - face.normal_at()).length > 0.001:
                    new_face = -new_face
                if inner_wires:
                    new_face = new_face - [Face(iw) for iw in inner_wires]
                new_faces.append(new_face)
        obj = Sketch(w.MakeCompound([_topo(f) for f in new_faces])) \
            if len(new_faces) > 1 else Sketch(_topo(new_faces[0]))
        return _combine(builder, obj, mode)

    results = []
    for t in targets:
        results.append(_wrap_like(t, w.Offset(_topo(t), amount, 1e-4, False, join)))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def _mirror_point(p, o, n):
    d = 2.0 * ((p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2])
    return (p[0] - d * n[0], p[1] - d * n[1], p[2] - d * n[2])


def mirror(objects=None, about=Plane.XZ, mode=Mode.ADD):
    builder = _active_builder()
    # Inside BuildLine (or on spec-carrying curves) mirror at the SEGMENT
    # level so make_face()/sweep() can still chain the result exactly.
    if isinstance(builder, BuildLine) or (
            objects is not None and
            all(isinstance(t, Mixin1D) and t._specs for t in _tolist(objects))):
        if objects is None:
            src = list(builder._specs)
        else:
            src = []
            for t in _tolist(objects):
                if not (isinstance(t, Mixin1D) and t._specs):
                    raise NotImplementedError('mirror inside BuildLine needs '
                                              'segment-based curves')
                src.extend(t._specs)
        o = tuple(about.origin)
        n = tuple(about.z_dir)

        def _mirror_dir(d):
            dd = 2.0 * (d[0] * n[0] + d[1] * n[1] + d[2] * n[2])
            return (d[0] - dd * n[0], d[1] - dd * n[1], d[2] - dd * n[2])

        def _mirror_seg(s):
            m = _seg_transform(s, lambda p: _mirror_point(p, o, n), _mirror_dir)
            params = _seg_params(m)
            if s[0] == 'earc' and params is not None:
                # reflecting xdir AND normal keeps the frame right-handed but
                # maps ellipse angle a -> -a: swap and negate the arc range
                params[5], params[6] = -params[6], -params[5]
            return m
        specs = [_mirror_seg(s) for s in src]
        curve = Curve(w.WireFromSegments(_chain_segments(specs)), specs)
        if isinstance(builder, BuildLine) and mode == Mode.ADD:
            builder._add_specs(specs)
        return curve
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('mirror: nothing to mirror')
    o = tuple(about.origin)
    n = list(about.z_dir)
    shift = (abs(o[0]) > _TOL or abs(o[1]) > _TOL or abs(o[2]) > _TOL)
    results = []
    for t in targets:
        topo = _topo(t)
        if shift:
            topo = w.Translate([-o[0], -o[1], -o[2]], topo, True)
            topo = w.Mirror(n, topo)
        else:
            topo = w.Mirror(n, topo, True)
        if shift:
            topo = w.Translate([o[0], o[1], o[2]], topo)
        results.append(_wrap_like(t, topo))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def split(objects=None, bisect_by=Plane.XZ, keep=Keep.TOP, mode=Mode.REPLACE):
    if keep not in (Keep.TOP, Keep.BOTTOM):
        raise NotImplementedError('split keep=' + str(keep) +
                                  ' is not supported in build123d-lite')
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('split: nothing to split')
    results = []
    for t in targets:
        topo = _topo(t)
        bb = list(w.BoundingBox(topo, 0.01))
        size = 4.0 * max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2],
                         abs(bb[0]), abs(bb[3]), abs(bb[1]), abs(bb[4]),
                         abs(bb[2]), abs(bb[5]), 1.0)
        half = w.Box(size, size, size, True)
        zshift = size / 2.0 if keep == Keep.TOP else -size / 2.0
        half = w.Translate([0, 0, zshift], half)
        half_shape = bisect_by.location * Part(half)
        results.append(_wrap_like(t, w.Intersection([topo, half_shape.topo])))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def scale(objects=None, by=1, about=None, mode=Mode.REPLACE):
    factors = None
    if not isinstance(by, (int, float)):
        f = tuple(by)
        if len(f) == 2:
            f = (f[0], f[1], 1.0)
        if abs(f[0] - f[1]) > 1e-9 or abs(f[0] - f[2]) > 1e-9:
            factors = [f[0], f[1], f[2]]  # gp_GTrsf non-uniform scale
        else:
            by = f[0]
    builder = _active_builder()
    if objects is None and isinstance(builder, BuildLine) and factors is None:
        # scale the accumulated line segments in place (spec-level, so
        # make_face() after scale() still chains exactly)
        builder._set_specs([_seg_scale(s, by) for s in builder._specs])
        return builder.line
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])

    def _scaled(t):
        topo = _topo(t)
        # build123d scales about about= or the shape's location position
        c = _v3(about) if about is not None else tuple(t.location.position) \
            if isinstance(t, Shape) else (0.0, 0.0, 0.0)
        if factors is not None:
            shift = (abs(c[0]) > _TOL or abs(c[1]) > _TOL or
                     abs(c[2]) > _TOL)
            if shift:
                topo = w.Translate([-c[0], -c[1], -c[2]], topo, True)
            topo = w.ScaleXYZ(factors, topo)
            if shift:
                topo = w.Translate([c[0], c[1], c[2]], topo)
        else:
            topo = w.ScaleUniform(topo, by, list(c))
        return _wrap_like(t, topo)
    results = [_scaled(t) for t in targets]
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def insert(objects, rotation=None, clean=True, mode=Mode.ADD):
    """Generic object: insert objects into the builder in context (build123d
    0.12's insert(); add() is its deprecated wrapper). Objects are placed at
    the active locations in the builder's LOCAL construction coordinates."""
    builder = _active_builder()
    if builder is None:
        raise RuntimeError('Insert must have an active builder context')
    objs = _tolist(objects)
    # build123d's insert() replaces each Builder argument with its result and
    # drops the ones that have none yet (operations_generic.insert's
    # object_iter)
    objs = [(o._obj if isinstance(o, Builder) else o) for o in objs
            if not (isinstance(o, Builder) and o._obj is None)]
    # curves added to a BuildLine contribute their segments (optionally
    # rotated) so make_face()/sweep() keep exact geometry
    if isinstance(builder, BuildLine):
        rot = None
        if rotation is not None:
            r = (0, 0, rotation) if isinstance(rotation, (int, float)) else tuple(rotation)
            rot = Rotation(r[0], r[1], r[2])
        ctx_locs = _ctx_locations()
        out = []
        for o in objs:
            if isinstance(o, Mixin1D) and o._specs:
                specs = list(o._specs)
            elif isinstance(o, Mixin1D):
                specs = _specs_from_topo_edges(o)
            else:
                raise TypeError('insert() to BuildLine expects curves')
            if rot is not None:
                fn_dir = lambda d: _mat_vec(rot._R, d)
                specs = [_seg_transform(s, rot._transform_point, fn_dir, rot)
                         for s in specs]
            # replicate at the active Locations contexts, like every other
            # object creation (build123d dimension-arrow pattern)
            placed_specs = _place_specs(specs, ctx_locs)
            if mode != Mode.PRIVATE:
                if mode == Mode.REPLACE:
                    builder._set_specs(placed_specs)
                else:
                    builder._add_specs(placed_specs)
            out.append(Curve(w.WireFromSegments(_chain_segments(placed_specs)),
                             placed_specs))
        return out[0] if len(out) == 1 else ShapeList(out)
    # 2D objects inserted into a BuildPart become pending sketch faces, in
    # local Plane.XY construction coordinates (build123d 0.12)
    def _is_2d(o):
        if not (isinstance(o, Shape) and o.topo is not None):
            return False
        count = [0]
        def _cb(i, s):
            count[0] += 1
        w.ForEachSolid(o.topo, _cb)
        return count[0] == 0 and len(o.faces()) > 0
    if isinstance(builder, BuildPart) and mode == Mode.ADD and \
            all(_is_2d(o) for o in objs):
        placed = []
        for loc in _ctx_locations():
            for o in objs:
                for f in o.faces():
                    pf = f if _loc_is_identity(loc) else loc * f
                    builder.pending_faces.append(Sketch(_topo(pf)))
                    builder.pending_face_planes.append(Plane.XY)
                    placed.append(pf)
        return placed[0] if len(placed) == 1 else ShapeList(placed)
    results = []
    for o in objs:
        s = _wrap_like(o, _topo(o))
        if rotation is not None:
            r = tuple(rotation) if not isinstance(rotation, (int, float)) else (0, 0, rotation)
            s = Rotation(r[0], r[1], r[2]) * s
        # replicate at the active location context, like object creation
        placed = []
        for loc in _ctx_locations():
            placed.append(loc * _wrap_like(s, w.Translate([0, 0, 0], s.topo, True)))
        if len(placed) == 1:
            results.append(placed[0])
        else:
            results.append(_wrap_like(s, w.MakeCompound([p.topo for p in placed])))
    if len(results) == 1:
        obj = results[0]
    else:
        obj = _wrap_like(results[0], w.MakeCompound([r.topo for r in results]))
    return _combine(builder, obj, mode)


def add(objects, rotation=None, clean=True, mode=Mode.ADD):
    """Deprecated since build123d 0.12: use insert()."""
    _warn('add() is deprecated; use insert() instead.', 'DeprecationWarning')
    return insert(objects, rotation=rotation, clean=clean, mode=mode)


def make_face(edges=None, mode=Mode.ADD):
    builder = _active_builder(BuildSketch)
    if edges is None:
        if builder is None or not builder.pending_edge_specs:
            raise ValueError('make_face: no pending edges (draw with '
                             'BuildLine inside BuildSketch first)')
        specs = builder.pending_edge_specs
        builder.pending_edge_specs = []
    else:
        specs = []
        for e in _tolist(edges):
            if isinstance(e, Mixin1D) and e._specs:
                specs.extend(e._specs)
            elif isinstance(e, Mixin1D):
                specs.extend(_specs_from_topo_edges(e))
            else:
                raise NotImplementedError('make_face from non-curve objects')
    chained = _chain_segments(specs)
    wire = w.WireFromSegments(chained)
    face = w.MakeFace(wire)
    # build123d's make_face goes through _add_to_context, which CLEANS the
    # result (ShapeUpgrade_UnifySameDomain): tangent-continuous Bezier/spline
    # edges merge into one B-spline. That changes the geometry slightly (the
    # merged spline approximates the chain), so skipping it makes downstream
    # results diverge — bicycle_tire's revolved tire was 0.84% off with 40
    # profile edges instead of upstream's 37.
    face = w.UnifyWire(face, True)
    # normalize XY-planar faces to a +Z normal (build123d faces from wires
    # come out +Z regardless of the chained winding; ours follow the wire)
    n = w._faceNormal(face)
    bb = w.BoundingBox(face)
    if n[2] < -0.5 and bb and abs(bb[5] - bb[2]) < 1e-6:
        face = w.ReverseFace(face)
    return _combine(builder, Sketch(face), mode)


def bounding_box(objects=None, mode=Mode.PRIVATE):
    """The bounding box as an object: a Rectangle sketch for 2D input, a Box
    part for 3D (build123d's bounding_box operation)."""
    builder = _active_builder()
    targets = _tolist(objects) if objects is not None else \
        ([builder._obj] if builder is not None and builder._obj is not None else [])
    if not targets:
        raise ValueError('bounding_box: nothing to measure')
    results = []
    for t in targets:
        bb = list(w.BoundingBox(_topo(t)))
        flat = abs(bb[5] - bb[2]) < 1e-9
        if flat:
            face = w.Polygon([[bb[0], bb[1], bb[2]], [bb[3], bb[1], bb[2]],
                              [bb[3], bb[4], bb[2]], [bb[0], bb[4], bb[2]]])
            results.append(Sketch(face))
        else:
            box = w.Translate([(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2,
                               (bb[2] + bb[5]) / 2],
                              w.Box(bb[3] - bb[0], bb[4] - bb[1],
                                    bb[5] - bb[2], True))
            results.append(Part(box))
    obj = results[0] if len(results) == 1 else results[0] + results[1:]
    return _combine(builder, obj, mode)


def _convex_hull_2d(pts):
    """Andrew monotone chain over (x, y) tuples -> CCW hull without the
    closing point."""
    pts = _stable_sorted(set(pts))
    if len(pts) <= 2:
        return list(pts)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _simplify_polyline(pts, tol):
    """Douglas-Peucker on a closed polygon (keeps hull bbox within tol)."""
    if len(pts) < 8:
        return list(pts)

    def dp(seg):
        if len(seg) < 3:
            return list(seg)
        (x1, y1), (x2, y2) = seg[0], seg[-1]
        dx, dy = x2 - x1, y2 - y1
        ln = math.hypot(dx, dy) or 1.0
        worst, wi = -1.0, 0
        for i in range(1, len(seg) - 1):
            d = abs(dy * (seg[i][0] - x1) - dx * (seg[i][1] - y1)) / ln
            if d > worst:
                worst, wi = d, i
        if worst <= tol:
            return [seg[0], seg[-1]]
        left = dp(seg[:wi + 1])
        return left[:-1] + dp(seg[wi:])
    half = len(pts) // 2
    a = dp(pts[:half + 1])
    b = dp(pts[half:] + pts[:1])
    return a[:-1] + b[:-1]


def _connected_edges_of(edge, parent):
    """The edges of parent that share a vertex with edge (build123d's
    topo_explore_connected_edges). Upstream accumulates into a set, so ITS
    order is memory-address order and varies run to run; lite keeps the
    parent's own edge order, which is deterministic."""
    if parent is None:
        raise ValueError('edge must be extracted from shape')
    keys = [_shape_key(v, 'vertex') for v in edge.vertices()]
    out = ShapeList()
    for other in parent.edges():
        if _shape_key(other, 'edge') == _shape_key(edge, 'edge'):
            continue
        for v in other.vertices():
            if _shape_key(v, 'vertex') in keys:
                out.append(other)
                break
    return out


def full_round(edge, invert=False, voronoi_point_count=100, mode=Mode.REPLACE):
    """Replace an edge of the sketch's face with the arc of the largest empty
    circle that fits in the face (build123d full_round) - a
    statement-for-statement port of operations_sketch.full_round.

    The candidate centres are the VORONOI VERTICES of 101 samples per edge over
    the target edge and its two neighbours; the best three (by how equal their
    three edge distances are) are averaged. The scipy shim's 2-D Voronoi is a
    Bowyer-Watson triangulation whose circumcentres are qhull's finite Voronoi
    vertices - verified vertex-set-identical to scipy on exactly these
    inputs."""
    from scipy.spatial import Voronoi

    builder = _active_builder(BuildSketch)
    if not isinstance(edge, Edge):
        raise ValueError('A single Edge must be provided')
    parent = getattr(edge, 'parent', None)
    if parent is None and builder is not None:
        parent = builder._obj
    connected = _connected_edges_of(edge, parent)
    if len(connected) != 2:
        raise ValueError('Invalid geometry - 3 or more edges required')

    edge_group = [edge] + list(connected)
    points = []
    for e in edge_group:
        for i in range(voronoi_point_count + 1):
            v = e.position_at(i / voronoi_point_count)
            points.append([v.X, v.Y])
    vertices = [Vector(v[0], v[1], 0) for v in Voronoi(points).vertices]

    best_three = [(float('inf'), 0), (float('inf'), 0), (float('inf'), 0)]
    for i, v in enumerate(vertices):
        distances = [e.distance_to(v) for e in edge_group]
        avg = sum(distances) / 3
        difference = max([abs(d - avg) for d in distances])
        if difference < best_three[-1][0]:
            best_three[-1] = (difference, i)
            best_three = _stable_sorted(best_three, key=lambda x: x[0])
    center = Vector(0, 0, 0)
    for _, i in best_three:
        center = center + vertices[i]
    center = center * (1.0 / 3.0)

    ends = [e.distance_to_with_closest_points(center)[1] for e in connected]
    middle = edge.distance_to_with_closest_points(center)[1]

    origin = (ends[0] + ends[1]) * 0.5
    x_dir = (ends[1] - ends[0]).normalized()
    to_arc = origin - middle
    z_dir = (to_arc - x_dir * to_arc.dot(x_dir)).normalized()
    split_pln = Plane(origin=origin, x_dir=x_dir, z_dir=z_dir)
    trimmed = []
    for e in connected:
        piece = e.split(split_pln)
        if piece is None:
            raise ValueError('Invalid geometry to create the end arc')
        trimmed.append(piece)

    if invert:
        middle = center * 2 - middle

    new_arc = Edge.make_three_point_arc(ends[0], middle, ends[1])

    keep_keys = [_shape_key(e, 'edge') for e in [edge] + list(connected)]
    others = ShapeList([e for e in parent.edges()
                        if _shape_key(e, 'edge') not in keep_keys])

    wires = Wire.combine(list(trimmed) + [new_arc] + list(others))
    wires = ShapeList(wires).sort_by(SortBy.LENGTH, reverse=True)
    pending = Face(wires[0], list(wires[1:]))
    if parent.faces()[0].normal_at() != pending.normal_at():
        pending = -pending
    result = Sketch(pending.topo)
    if builder is not None:
        _combine(builder, result, mode)
        builder.pending_edge_specs = []
    return result


def make_hull(edges=None, tolerance=1e-3, mode=Mode.ADD):
    """Face from the 2D convex hull of the given edges (or the pending edges +
    the sketch under construction) — a statement-for-statement port of
    build123d's Wire.make_convex_hull: sample every edge at
    int(2 / tolerance) parameters, take the 2-D convex hull of the cloud, then
    read the hull back as (a) straight CONNECTING edges between the sampled
    contact points and (b) TRIMMED pieces of the source edges between them. The
    arcs of the hull are therefore the source arcs, exactly, and the only
    approximation is where the tangent lines touch them (upstream's own
    documented limitation)."""
    builder = _active_builder(BuildSketch)
    hull_edges = []
    if edges is not None:
        for e in _tolist(edges):
            hull_edges.extend([e] if isinstance(e, Edge) else e.edges())
    elif builder is not None:
        if builder.pending_edge_specs:
            tmp = Curve(w.WireFromSegments(
                _chain_segments(builder.pending_edge_specs)))
            hull_edges.extend(tmp.edges())
            builder.pending_edge_specs = []
        if builder._obj is not None and builder._obj.topo is not None:
            hull_edges.extend(builder._obj.edges())
    if not hull_edges:
        raise ValueError('No objects to create a hull')
    # 1) a cloud of points along all edges (upstream's fragments_per_edge)
    fragments = int(2 / tolerance)
    pts = []
    lookup = []          # global point index -> (edge index, edge parameter)
    for ei, e in enumerate(hull_edges):
        for i in range(fragments):
            param = i / (fragments - 1)
            q = e.position_at(param)
            pts.append((q.X, q.Y, len(lookup)))
            lookup.append((ei, param))
    hull = _convex_hull_2d(pts)
    if len(hull) < 3:
        raise ValueError('make_hull: degenerate hull')
    # 2) the hull facets, as scipy would hand them over: index pairs. A cyclic
    # hull of N vertices has exactly N of them.
    simplices = [(hull[i][2], hull[(i + 1) % len(hull)][2])
                 for i in range(len(hull))]
    # 3+4) connecting edges within one source edge and between two of them
    connecting_edge_data = []
    trim_points = {}

    def _mark(edge_index, point_index):
        if edge_index not in trim_points:
            trim_points[edge_index] = [point_index]
        else:
            trim_points[edge_index].append(point_index)
    for s0, s1 in simplices:
        e0, u0 = lookup[s0]
        e1, u1 = lookup[s1]
        if e0 != e1:
            _mark(e0, s0)
            _mark(e1, s1)
            connecting_edge_data.append(((e0, u0), (e1, u1)))
        elif abs(s0 - s1) != 1:
            lo, hi = min(s0, s1), max(s0, s1)
            _mark(e0, lo)
            _mark(e0, hi)
            connecting_edge_data.append(((e0, lookup[lo][1]),
                                         (e0, lookup[hi][1])))
    # 5) pair the trim points up per edge
    trim_data = {}
    for edge_index in trim_points:
        s_points = _stable_sorted(trim_points[edge_index])
        pairs = []
        for i in range(0, len(s_points) - 1, 2):
            if s_points[i] != s_points[i + 1]:
                pairs.append((s_points[i], s_points[i + 1]))
        trim_data[edge_index] = pairs
    # 6) the connecting (tangent/chord) edges
    result_edges = [Edge.make_line(hull_edges[a[0]].position_at(a[1]),
                                   hull_edges[b[0]].position_at(b[1]))
                    for a, b in connecting_edge_data]
    # 7) the surviving pieces of the source edges
    for edge_index in trim_data:
        for (p0, p1) in trim_data[edge_index]:
            result_edges.append(hull_edges[edge_index].trim(
                lookup[p0][1], lookup[p1][1]))
    # 8) one wire, then the planar face the sketch wants
    wire = w.WireFromEdgesFixed([e.topo for e in result_edges], _TOL_1E6)
    face = w.MakeFace(wire)
    if w._faceNormal(face)[2] < -0.5:
        face = w.ReverseFace(face)
    return _combine(builder, Sketch(face), mode)


class DraftAngleError(RuntimeError):
    """Solid.draft custom exception (build123d topology.three_d)."""

    def __init__(self, message, face=None, problematic_shape=None):
        RuntimeError.__init__(self, message)
        self.face = face
        self.problematic_shape = problematic_shape


def draft(faces, neutral_plane, angle):
    """Apply a draft angle to faces of the active part
    (BRepOffsetAPI_DraftAngle — build123d's Solid.draft conventions)."""
    face_list = _tolist(faces)
    if not face_list:
        raise ValueError('draft: no faces given')
    parent = face_list[0].topo_parent
    builder = _active_builder(BuildPart)
    target = parent if parent is not None else \
        (builder._obj if builder is not None else None)
    if target is None or target.topo is None:
        raise ValueError('draft: faces have no parent part')
    result = _wrap_like(target, w.DraftAngleFaces(
        target.topo, [f.topo for f in face_list], angle,
        list(neutral_plane.origin), list(neutral_plane.z_dir)))
    if builder is not None:
        _replace_obj(builder, result)
    return result


def project_workplane(origin, x_dir, projection_dir, distance):
    """Return a plane to be used as a BuildSketch or BuildLine workplane with
    a known origin and x direction (build123d operations_part
    project_workplane): the plane's origin and x_dir are the projections of
    the provided 3D origin/x_dir along projection_dir at the given
    distance."""
    builder = _active_builder()
    if builder is not None and not isinstance(builder, BuildPart):
        raise RuntimeError('projection_workplane can only be used from a '
                           'BuildPart context or algebra')

    origin = Vector(origin.center()) if isinstance(origin, Vertex) \
        else Vector(origin)
    x_dir = (Vector(x_dir.center()) if isinstance(x_dir, Vertex)
             else Vector(x_dir)).normalized()
    projection_dir = Vector(projection_dir).normalized()

    # Create a preliminary workplane without x direction set
    workplane_origin = origin + projection_dir * distance
    workplane = Plane(workplane_origin, z_dir=projection_dir)

    # Project a point off the origin to find the projected x direction
    screen = Face.make_rect(1e9, 1e9, plane=workplane)
    x_dir_point_axis = Axis(origin + x_dir, projection_dir)
    projection = screen.find_intersection_points(x_dir_point_axis)
    if not projection:
        raise ValueError('x_dir perpendicular to projection_dir')

    # Set the workplane's x direction
    workplane_x_dir = projection[0][0] - workplane_origin
    return Plane(workplane_origin, x_dir=workplane_x_dir,
                 z_dir=projection_dir)


def project(objects=None, workplane=None, target=None, mode=Mode.ADD):
    """Project objects along a workplane's normal onto a target.
    COMPROMISE(project): only the BuildPart form used by the examples is
    implemented — pending sketch faces are projected onto the part
    (Face.project_to_shape) and the NEAREST resulting face(s) become the
    new pending faces for a following extrude(); the BuildLine/BuildSketch
    screen-projection forms raise."""
    builder = _active_builder(BuildPart)
    if objects is None and isinstance(builder, BuildPart) and \
            builder.pending_faces:
        object_list = list(builder.pending_faces)
        planes = list(builder.pending_face_planes)
        builder.pending_faces = []
        builder.pending_face_planes = []
        workplane = workplane or (planes[0] if planes else Plane.XY)
        if target is None:
            target = builder._obj
        if target is None or target.topo is None:
            raise ValueError('project: no target part')
        tc = target.center()
        for obj in object_list:
            for f in obj.faces():
                oc_ = f.center()
                d = Vector(workplane.z_dir)
                # aim the projection at the target
                if d.dot(tc - oc_) < 0:
                    d = -d
                projected = f.project_to_shape(target, tuple(d))
                if not projected:
                    raise ValueError('project: projection missed the part')
                # ALL projected surface pieces become pending faces (front
                # AND back, like build123d's project into BuildPart). Since
                # 0.12 each goes in through _add_to_context with ITS OWN plane
                # (Plane(face): the piece's outward normal), so a following
                # extrude(-depth, SUBTRACT) cuts front AND back pieces into
                # the part (0.11.1 used the workplane for every piece, which
                # sent the back pieces harmlessly out the back).
                for piece in projected:
                    builder.pending_faces.append(Sketch(piece.topo))
                    try:
                        piece_plane = Plane(Face(piece.topo))
                    except Exception:
                        piece_plane = Plane.XY
                    builder.pending_face_planes.append(piece_plane)
        return Sketch(w.MakeCompound(
            [s.topo for s in builder.pending_faces], True)) \
            if len(builder.pending_faces) > 1 else builder.pending_faces[0]
    raise NotImplementedError('project onto a screen workplane is not '
                              'supported in build123d-lite (only the '
                              'BuildPart pending-faces form)')


def thicken(to_thicken=None, amount=None, normal_override=None, both=False,
            clean=True, mode=Mode.ADD):
    """Thicken face(s) into solid(s) along their normals — build123d's
    operations_part.thicken over Solid.thicken."""
    if amount is None:
        raise ValueError('An amount must be provided')
    builder = _active_builder(BuildPart)
    if to_thicken is None:
        faces = [Face(t) for t, _pl in _pending_or_given(None)]
    elif isinstance(to_thicken, (list, tuple, ShapeList)):
        faces = [f for f in to_thicken]
    else:
        faces = list(to_thicken.faces())
    solids = []
    for f in faces:
        n = normal_override if normal_override is not None else f.normal_at()
        for direction in ([1, -1] if both else [1]):
            solids.append(Solid.thicken(
                f, amount, normal_override=Vector(n) * direction))
    result = solids[0] if len(solids) == 1 else Part().fuse(*solids)
    if builder is not None:
        return _combine(builder, result, mode, Part)
    return Part(_topo(result))


def section(obj=None, section_by=Plane.XZ, height=0.0, clean=True,
            mode=Mode.PRIVATE):
    """Cross-section of a part: intersect (BRepAlgoAPI_Common) with a large
    finite rectangle face on each section plane, exactly like build123d's
    operations_part.section. Returns a Sketch of the section faces; default
    mode is Mode.PRIVATE (the section does NOT modify the builder)."""
    builder = _active_builder(BuildPart)
    to_section = obj if obj is not None else \
        (builder._obj if builder is not None else None)
    if to_section is None:
        raise ValueError('section: no object to section')
    body = _topo(to_section)
    bb = list(w.BoundingBox(body))
    diag = math.sqrt((bb[3] - bb[0]) ** 2 + (bb[4] - bb[1]) ** 2 +
                     (bb[5] - bb[2]) ** 2)
    max_size = max(abs(v) for v in bb) + diag
    planes_in = section_by if isinstance(section_by, (list, tuple)) \
        else [section_by]
    faces = []
    for pl in planes_in:
        cut_plane = Plane(origin=tuple(pl.origin + pl.z_dir * height),
                          z_dir=tuple(pl.z_dir))
        rect = Face.make_rect(2 * max_size, 2 * max_size, cut_plane)
        common = w.Intersection([body, rect.topo], True, 1e-7, True)
        faces.extend(Shape(common).faces())
    if not faces:
        raise ValueError('section: no intersection with the section plane')
    topos = [f.topo for f in faces]
    topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos, True)
    return _combine(builder, Sketch(topo), mode)


# --------------------------------------------------- joints & exporters ---

def _hlr_curve(topo):
    c = Curve(topo)
    return c


class ExportSVG:
    """No-op SVG exporter: geometry-side effects only (browser worker has
    no filesystem for the .svg — a warning is printed instead)."""

    def __init__(self, *args, **kwargs):
        print('build123d-lite: ExportSVG writes nothing in the browser')

    def add_layer(self, *args, **kwargs):
        return self

    def add_shape(self, *args, **kwargs):
        return self

    def write(self, *args, **kwargs):
        return True


def _unsupported(name):
    def f(*args, **kwargs):
        raise NotImplementedError(name + ' is not supported in build123d-lite')
    return f


# COMPROMISE(joints): joints are pure LOCATION ALGEBRA on lite shapes — a
# named attachment frame per part, with connect_to solving the same relative
# Location build123d does and repositioning the other part's baked geometry.
# There is NO assembly structure (no anytree parent/child, no XCAF, no
# symbol/triad rendering); that is a separate roadmap item.
class Joint:
    """Named attachment frame bound to a part (build123d Joint ABC)."""

    def __init__(self, label, parent):
        self.label = label
        self.parent = parent
        self.connected_to = None

    @property
    def location(self):
        return self.parent.location * self.relative_location

    def _connect_to(self, other, **kwargs):
        if not isinstance(other, Joint):
            raise TypeError('other must be a Joint, not ' +
                            type(other).__name__)
        relative_location = self.relative_to(other, **kwargs)
        other.parent.locate(self.parent.location * relative_location)
        self.connected_to = other

    def connect_to(self, other, **kwargs):
        return self._connect_to(other, **kwargs)

    @property
    def symbol(self):
        """The viewer symbol upstream draws for this joint (build123d
        Joint.symbol). Base form (RigidJoint): a triad at the joint frame,
        scaled to the parent's bounding-box diagonal / 12."""
        size = self.parent.bounding_box().diagonal / 12
        return Compound.make_triad(axes_scale=size).locate(self.location)

    def _lite_rebind(self, new_parent):
        """A copy of this joint bound to new_parent (used by copy.copy)."""
        c = object.__new__(self.__class__)
        for k in self.__dict__:
            setattr(c, k, self.__dict__[k])  # __dict__ is read-only on MicroPython
        c.parent = new_parent
        c.connected_to = None
        return c


def _joint_part(to_part):
    if to_part is None:
        builder = _active_builder(BuildPart)
        if builder is None:
            raise ValueError('Either specify to_part or place in BuildPart '
                             'scope')
        return builder
    return to_part


class RigidJoint(Joint):
    def __init__(self, label, to_part=None, joint_location=None):
        part = _joint_part(to_part)
        if joint_location is None:
            joint_location = Location()
        self.relative_location = part.location.inverse() * joint_location
        part.joints[label] = self
        Joint.__init__(self, label, part)

    def relative_to(self, other, **kwargs):
        if isinstance(other, RigidJoint):
            return self.relative_location * other.relative_location.inverse()
        if isinstance(other, RevoluteJoint):
            return other.relative_to(self,
                                     angle=kwargs.get('angle')).inverse()
        if isinstance(other, LinearJoint):
            return other.relative_to(
                self, position=kwargs.get('position')).inverse()
        if isinstance(other, CylindricalJoint):
            return other.relative_to(self, position=kwargs.get('position'),
                                     angle=kwargs.get('angle')).inverse()
        if isinstance(other, BallJoint):
            return other.relative_to(self,
                                     angles=kwargs.get('angles')).inverse()
        raise TypeError('unsupported joint pairing')


class RevoluteJoint(Joint):
    def __init__(self, label, to_part=None, axis=None,
                 angle_reference=None, angular_range=(0, 360), **kwargs):
        part = _joint_part(to_part)
        if axis is None:
            axis = Axis.Z
        self.angular_range = angular_range
        self._angle_reference_provided = angle_reference is not None
        if angle_reference is not None:
            ref = Vector(angle_reference)
            if abs(ref.normalized().dot(Vector(axis.direction).normalized())) \
                    > 1e-5:
                raise ValueError('angle_reference must be normal to axis')
            self.angle_reference = ref
        else:
            self.angle_reference = Plane(origin=(0, 0, 0),
                                         z_dir=axis.direction).x_dir
        self._angle = None
        self.relative_axis = axis.located(part.location.inverse())
        part.joints[label] = self
        Joint.__init__(self, label, part)

    @property
    def location(self):
        return self.parent.location * self.relative_axis.location

    @property
    def symbol(self):
        """Axis of rotation (build123d RevoluteJoint.symbol)."""
        radius = self.parent.bounding_box().diagonal / 30
        return Compound([Edge.make_line((0, 0, 0), (0, 0, radius * 10)),
                         Edge.make_circle(radius),
                         Edge.make_line((0, 0, 0), (radius, 0, 0))]
                        ).move(self.location)

    def relative_to(self, other, angle=None, **kwargs):
        if not isinstance(other, RigidJoint):
            raise TypeError('RevoluteJoint.relative_to expects a RigidJoint')
        angle_degrees = self.angular_range[0] if angle is None else angle
        if angle_degrees < self.angular_range[0] or \
                angle_degrees > self.angular_range[1]:
            raise ValueError('angle (' + str(angle_degrees) +
                             ') must be in range of ' +
                             str(self.angular_range))
        self._angle = angle_degrees
        # build123d: "Avoid strange rotations when angle is zero" quirk
        if angle_degrees == 0.0:
            angle_degrees = 360.0
        if self._angle_reference_provided:
            # 0.12 fix: the angle is measured from angle_reference
            rotation = Location(Plane(
                origin=(0, 0, 0),
                x_dir=self.angle_reference.rotate(self.relative_axis,
                                                  angle_degrees),
                z_dir=self.relative_axis.direction))
        else:
            rotation = Rotation(0, 0, angle_degrees)
        return (self.relative_axis.location * rotation *
                other.relative_location.inverse())


class LinearJoint(Joint):
    def __init__(self, label, to_part=None, axis=None,
                 linear_range=(0, 1e30), **kwargs):
        part = _joint_part(to_part)
        if axis is None:
            axis = Axis.Z
        self.axis = axis
        self.linear_range = linear_range
        self.position = None
        self.relative_axis = axis.located(part.location.inverse())
        self.angle = None
        part.joints[label] = self
        Joint.__init__(self, label, part)

    @property
    def location(self):
        return self.parent.location * self.relative_axis.location

    @property
    def symbol(self):
        """Linear axis (build123d LinearJoint.symbol)."""
        radius = (self.linear_range[1] - self.linear_range[0]) / 15
        return Compound([Edge.make_line((0, 0, self.linear_range[0]),
                                        (0, 0, self.linear_range[1])),
                         Edge.make_circle(radius)]).move(self.location)

    def relative_to(self, other, position=None, angle=None, **kwargs):
        position = sum(self.linear_range) / 2 if position is None else position
        if not self.linear_range[0] <= position <= self.linear_range[1]:
            raise ValueError('position (' + str(position) +
                             ') must be in range of ' +
                             str(self.linear_range))
        self.position = position
        if isinstance(other, RevoluteJoint):
            angle = other.angular_range[0] if angle is None else angle
            if not other.angular_range[0] <= angle <= other.angular_range[1]:
                raise ValueError('angle out of range')
            rotation = Location(Plane(
                origin=(0, 0, 0),
                x_dir=other.angle_reference.rotate(other.relative_axis, angle),
                z_dir=other.relative_axis.direction))
        else:
            angle = 0.0
            rotation = Location()
        self.angle = angle
        joint_relative_position = Location(
            self.relative_axis.position +
            self.relative_axis.direction * position) * rotation
        if isinstance(other, RevoluteJoint):
            other_relative_location = Location(other.relative_axis.position)
        else:
            other_relative_location = other.relative_location
        return joint_relative_position * other_relative_location.inverse()


class CylindricalJoint(Joint):
    def __init__(self, label, to_part=None, axis=None, angle_reference=None,
                 linear_range=(0, 1e30), angular_range=(0, 360), **kwargs):
        part = _joint_part(to_part)
        if axis is None:
            axis = Axis.Z
        self.axis = axis
        if angle_reference is not None:
            self.angle_reference = Vector(angle_reference)
        else:
            self.angle_reference = Plane(origin=(0, 0, 0),
                                         z_dir=axis.direction).x_dir
        self.angular_range = angular_range
        self.linear_range = linear_range
        self.relative_axis = axis.located(part.location.inverse())
        self.position = None
        self.angle = None
        part.joints[label] = self
        Joint.__init__(self, label, part)

    @property
    def location(self):
        return self.parent.location * self.relative_axis.location

    @property
    def symbol(self):
        """Cylindrical axis (build123d CylindricalJoint.symbol)."""
        radius = (self.linear_range[1] - self.linear_range[0]) / 15
        return Compound([Edge.make_line((0, 0, self.linear_range[0]),
                                        (0, 0, self.linear_range[1])),
                         Edge.make_circle(radius),
                         Edge.make_line((0, 0, 0), (radius, 0, 0))]
                        ).move(self.location)

    def relative_to(self, other, position=None, angle=None, **kwargs):
        if not isinstance(other, RigidJoint):
            raise TypeError('CylindricalJoint.relative_to expects a '
                            'RigidJoint')
        position = sum(self.linear_range) / 2 if position is None else position
        if not self.linear_range[0] <= position <= self.linear_range[1]:
            raise ValueError('position (' + str(position) +
                             ') must be in range of ' +
                             str(self.linear_range))
        self.position = position
        angle = sum(self.angular_range) / 2 if angle is None else angle
        if not self.angular_range[0] <= angle <= self.angular_range[1]:
            raise ValueError('angle (' + str(angle) +
                             ') must be in range of ' +
                             str(self.angular_range))
        self.angle = angle
        joint_relative_position = Location(
            self.relative_axis.position +
            self.relative_axis.direction * position)
        joint_rotation = Location(Plane(
            origin=(0, 0, 0),
            x_dir=self.angle_reference.rotate(self.relative_axis, angle),
            z_dir=self.relative_axis.direction))
        return (joint_relative_position * joint_rotation *
                other.relative_location.inverse())


class BallJoint(Joint):
    def __init__(self, label, to_part=None, joint_location=None,
                 angular_range=((0, 360), (0, 360), (0, 360)),
                 angle_reference=None, **kwargs):
        part = _joint_part(to_part)
        if joint_location is None:
            joint_location = Location()
        self.relative_location = part.location.inverse() * joint_location
        part.joints[label] = self
        self.angular_range = angular_range
        self.angle_reference = angle_reference if angle_reference is not None \
            else Plane.XY
        Joint.__init__(self, label, part)

    def relative_to(self, other, angles=None, **kwargs):
        if not isinstance(other, RigidJoint):
            raise TypeError('BallJoint.relative_to expects a RigidJoint')
        if isinstance(angles, Rotation):
            angle_rotation = angles
        elif isinstance(angles, (tuple, list)):
            angle_rotation = Rotation(angles[0], angles[1], angles[2])
        elif angles is None:
            angle_rotation = Rotation(self.angular_range[0][0],
                                      self.angular_range[1][0],
                                      self.angular_range[2][0])
        else:
            raise TypeError('angles is of an unknown type')
        rotation = angle_rotation * self.angle_reference.location
        o = rotation.orientation
        for i, r in enumerate((o.X, o.Y, o.Z)):
            if not self.angular_range[i][0] <= r <= self.angular_range[i][1]:
                raise ValueError('angles must be in range of ' +
                                 str(self.angular_range))
        return (self.relative_location * rotation *
                other.relative_location.inverse())


class Mesher:
    """STL-only mesher (build123d's Mesher writes 3MF/STL via lib3mf).
    COMPROMISE(mesher): only STL export is supported, via the JS engine's
    StlAPI_Writer into the worker's Emscripten MEMFS — there is no lib3mf in
    the WASM build, so .3mf paths raise; read() is not supported."""

    def __init__(self, unit=Unit.MM, **kwargs):
        self.unit = unit
        self._shapes = []
        self.linear_deflection = 0.001
        self.angular_deflection = 0.1

    @property
    def mesh_count(self):
        return len(self._shapes)

    def add_shape(self, shape, linear_deflection=0.001,
                  angular_deflection=0.1, **kwargs):
        for s in _tolist(shape):
            self._shapes.append(s)
        self.linear_deflection = linear_deflection
        self.angular_deflection = angular_deflection

    def add_code_to_metadata(self):
        pass  # no source file in the browser

    def add_meta_data(self, *args, **kwargs):
        pass

    def write(self, file_name):
        name = str(file_name)
        if not name.lower().endswith('.stl'):
            raise NotImplementedError(
                'build123d-lite Mesher writes STL only (no lib3mf in the '
                'WASM build); got ' + name)
        if not self._shapes:
            raise ValueError('Mesher: no shapes added')
        topos = [_topo(s) for s in self._shapes]
        topo = topos[0] if len(topos) == 1 else w.MakeCompound(topos, True)
        text = w.ExportSTL(topo, name.replace('/', '_'),
                           self.linear_deflection, self.angular_deflection)
        if text is None:
            raise RuntimeError('STL export failed')
        return True

    def read(self, file_name):
        raise NotImplementedError('Mesher.read is not supported in '
                                  'build123d-lite')


ExportDXF = _unsupported('ExportDXF')


def import_step(file_name):
    """Read a STEP asset that was handed to the worker ahead of the run
    (build123d import_step). The worker has no filesystem, so the file cannot
    be opened from the path the script computes next to __file__; instead the
    host delivers its text through CascadeAPI.loadExternalFiles() (which is
    exactly the app's own STEP-import path: STEPControl_Reader over a MEMFS
    data file) and the BASE NAME of the requested path is looked up here.

    Upstream returns a Compound carrying the STEP assembly's labels and
    colours; lite returns the geometry only."""
    name = str(file_name)
    topo = w.GetExternalShape(name)
    if topo is None or not topo:
        raise FileNotFoundError(
            'import_step: "' + name + '" was not delivered to the worker. '
            'The CAD worker has no filesystem; pass the file content with '
            'CascadeAPI.loadExternalFiles({"' + name.split('/')[-1] +
            '": <step text>}) before running the script.')
    res = object.__new__(Compound)
    Shape.__init__(res, topo)
    res.label = name.split('/')[-1]
    return res


def import_brep(file_name):
    """Import a shape from a BREP file (build123d importers.import_brep,
    BRepTools::Read into a BRep_Builder). COMPROMISE(mesher): the worker has
    no real filesystem — the file is looked up in the in-memory Emscripten
    FS, where export_brep wrote it earlier in the run (round-trip)."""
    name = str(file_name).replace('/', '_')
    topo = w.ImportBREP(name)
    # a JS null arrives as a falsy proxy, not Python None (same guard as
    # import_step)
    if topo is None or not topo:
        raise ValueError('Could not import ' + str(file_name))
    res = object.__new__(Compound)
    Shape.__init__(res, topo)
    res.label = str(file_name).split('/')[-1]
    return res


import_stl = _unsupported('import_stl')
import_svg = _unsupported('import_svg')


def export_stl(to_export, file_path, tolerance=1e-3, angular_tolerance=0.1,
               ascii_format=False):
    """Write an STL into the worker's MEMFS (BRepMesh + StlAPI_Writer, the
    same calls build123d's export_stl makes). COMPROMISE(mesher): the file
    lands in the in-memory Emscripten FS, not the user's disk (browser
    workers have no filesystem access); ascii_format is always True."""
    text = w.ExportSTL(_topo(to_export), str(file_path).replace('/', '_'),
                       tolerance, angular_tolerance)
    return text is not None


def export_obj(to_export, file_path, linear_deflection=0.001,
               angular_deflection=0.1, include_uvs=True, atlas_packing=True,
               atlas_gutter=0.0):
    """Export the shape's tessellation as a Wavefront OBJ with UVs and
    normals (build123d 0.12 export_obj). COMPROMISE(mesher): written into
    the worker's MEMFS like export_stl."""
    text = w.ExportOBJ(_topo(to_export), str(file_path).replace('/', '_'),
                       linear_deflection, angular_deflection,
                       bool(include_uvs), bool(atlas_packing),
                       float(atlas_gutter))
    return text is not None


def export_brep(to_export, file_path):
    """Export the shape to a BREP file (build123d exporters3d.export_brep,
    BRepTools::Write). COMPROMISE(mesher): browser workers have no
    filesystem — the file lands in the worker's in-memory Emscripten FS,
    where import_brep reads it back. Returns the write status like
    upstream."""
    text = w.ExportBREP(_topo(to_export), str(file_path).replace('/', '_'))
    # bool() rather than 'is not None': a JS null arrives as a falsy proxy
    return bool(text)


def export_step(to_export, file_path, unit=None, write_pcurves=True,
                precision_mode=None, **kwargs):
    """Export the shape to a STEP file (build123d exporters3d.export_step,
    STEPControl_Writer + STEPControl_AsIs). COMPROMISE(mesher): like
    export_brep, the file lands in the worker's in-memory Emscripten FS
    rather than on disk — the headless entry point reads it back with
    engine.readFile(), and in the browser the STEP text is what
    CascadeAPI/the download path already consumes. Upstream's
    write_pcurves/precision_mode knobs are accepted and ignored (the
    Interface_Static keys behind them are not bound in this wasm build);
    unit= is honoured via write.step.unit. Returns True like upstream."""
    text = w.ExportSTEP(_topo(to_export), str(file_path).replace('/', '_'),
                        _STEP_UNIT_NAMES.get(unit, str(unit))
                        if unit is not None else '')
    return bool(text)


def export_gltf(*args, **kwargs):
    print('build123d-lite: export_gltf is a no-op in the browser')
    return True


class Color:
    def __init__(self, *args, **kwargs):
        self.args = args


class GeomEncoder(json.JSONEncoder):
    """A JSON encoder for build123d geometry objects (build123d
    geometry.GeomEncoder): Axis, Color, Location, Plane and Vector become a
    single-key dict {"TypeName": values}; decode with json.loads(...,
    object_hook=GeomEncoder.geometry_hook)."""

    def default(self, o):
        """Return a JSON-serializable representation of a known geometry
        object."""
        if isinstance(o, Axis):
            return {'Axis': (tuple(o.position), tuple(o.direction))}
        if isinstance(o, Color):
            # lite's Color is a stub keeping its constructor args
            return {'Color': tuple(getattr(o, 'args', ()))}
        if isinstance(o, Location):
            tup = tuple(o)
            return {'Location': (tuple(tup[0]), tuple(tup[1]))}
        if isinstance(o, Plane):
            return {'Plane': (tuple(o.origin), tuple(o.x_dir),
                              tuple(o.z_dir))}
        if isinstance(o, Vector):
            return {'Vector': tuple(o)}
        # Let the base class default method raise the TypeError
        return json.JSONEncoder.default(self, o)

    @staticmethod
    def geometry_hook(json_dict):
        """Convert dictionaries back into geometry objects for decoding."""
        if len(json_dict) != 1:
            raise ValueError('Invalid geometry json object ' +
                             repr(json_dict))
        registry = {'Axis': Axis, 'Color': Color, 'Location': Location,
                    'Plane': Plane, 'Vector': Vector}
        for key, value in json_dict.items():
            return registry[key](*value)


def _pack2d(objects, width_fn, length_fn):
    """Growing rectangle packer (port of build123d.pack_utils._pack2d, which
    is itself a port of jakesgordon/bin-packing packer.growing.js)."""
    class _Node:
        def __init__(self, x=0.0, y=0.0, w=0.0, h=0.0):
            self.used = False
            self.x, self.y, self.w, self.h = x, y, w, h
            self.down = None
            self.right = None

    if not objects:
        raise ValueError('no objects to pack')
    sizes = _stable_sorted(((o, width_fn(o), length_fn(o)) for o in objects),
                   key=lambda t: min(t[1], t[2]), reverse=True)
    sizes = _stable_sorted(sizes, key=lambda t: max(t[1], t[2]), reverse=True)
    root = _Node(w=sizes[0][1], h=sizes[0][2])

    def find_node(start, ww, hh):
        if start is None:
            return None
        if start.used:
            return find_node(start.right, ww, hh) or find_node(start.down, ww, hh)
        if ww <= start.w and hh <= start.h:
            return start
        return None

    def split_node(node, ww, hh):
        node.used = True
        node.down = _Node(node.x, node.y + hh, node.w, node.h - hh)
        node.right = _Node(node.x + ww, node.y, node.w - ww, hh)
        return node

    def grow_node(ww, hh):
        nonlocal root
        can_down = ww <= root.w
        can_right = hh <= root.h
        should_right = can_right and (root.h >= (root.w + ww))
        should_down = can_down and (root.w >= (root.h + hh))
        if should_right:
            return grow_right(ww, hh)
        if should_down:
            return grow_down(ww, hh)
        if can_right:
            return grow_right(ww, hh)
        if can_down:
            return grow_down(ww, hh)
        return None

    def grow_right(ww, hh):
        nonlocal root
        new_root = _Node(0, 0, root.w + ww, root.h)
        new_root.used = True
        new_root.down = root
        new_root.right = _Node(root.w, 0, ww, root.h)
        root = new_root
        node = find_node(root, ww, hh)
        return split_node(node, ww, hh) if node else None

    def grow_down(ww, hh):
        nonlocal root
        new_root = _Node(0, 0, root.w, root.h + hh)
        new_root.used = True
        new_root.right = root
        new_root.down = _Node(0, root.h, root.w, hh)
        root = new_root
        node = find_node(root, ww, hh)
        return split_node(node, ww, hh) if node else None

    placements = {}
    for (o, ww, hh) in sizes:
        node = find_node(root, ww, hh)
        node = split_node(node, ww, hh) if node else grow_node(ww, hh)
        if node is None:
            raise RuntimeError('Failed to grow the packing area')
        placements[id(o)] = (node.x, node.y)
    return [placements[id(o)] for o in objects]


def pack(objects, padding, align_z=False):
    """Arrange shapes compactly in Plane.XY (port of build123d.pack.pack)."""
    objects = list(objects)
    bbs = {id(o): o.bounding_box() for o in objects}
    translations = _pack2d(
        objects,
        lambda o: bbs[id(o)].size.X + padding,
        lambda o: bbs[id(o)].size.Y + padding)
    out = []
    for o, t in zip(objects, translations):
        bb = bbs[id(o)]
        dz = -bb.min.Z if align_z else 0.0
        out.append(Pos(t[0] - bb.min.X, t[1] - bb.min.Y, dz) * o)
    return out


# --------------------------------------------------- measurement / show ---

def volume(shape):
    """Absolute volume of a shape in mm^3 (sum over solids)."""
    return w.SolidsVolume(_topo(shape))


def show(*shapes, **kwargs):
    """Define the render scene (build123d-sandbox / ocp_vscode compat).
    The FIRST show() of an evaluation replaces the auto-added scene with
    exactly the shown shapes (so 2-D intermediates no longer leak into the
    viewport and exports); later show()/show_object() calls append.
    # COMPROMISE(show-semantics): ocp_vscode's show() replaces the view on
    # every call (last-wins); appending on subsequent calls preserves the
    # intent of scripts that show several results separately.
    Extra viewer kwargs (names=, colors=, ...) are accepted and ignored.
    Membership is tested with 'is' — Brython compares the underlying JS
    objects, so it works across wrapper instances."""
    if not getattr(w, '_b123dSceneDefined', False):
        # len() works on Brython/Pyodide array views but MicroPython's
        # JsProxy has no __len__ (its .length attribute works instead —
        # which Pyodide's JsList in turn does NOT expose).
        def _scene_len():
            try:
                return len(w.sceneShapes)
            except TypeError:
                return int(w.sceneShapes.length)
        while _scene_len() > 0:
            w.sceneShapes.pop()
        w._b123dSceneDefined = True
    flat = []
    for s in shapes:
        if isinstance(s, (list, tuple, ShapeList)):
            flat.extend(s)
        else:
            flat.append(s)
    for s in flat:
        if isinstance(s, Builder):
            s = s._obj
        try:
            topo = _topo(s)
        except (TypeError, ValueError):
            continue
        if not any(existing is topo for existing in w.sceneShapes):
            w.sceneShapes.push(topo)


def show_object(shape, name=None, options=None, **kwargs):
    """CQ-editor style alias for show()."""
    show(shape)


def show_all(*args, **kwargs):
    pass


def _json_num(x):
    x = float(x)
    if x != x or x in (float('inf'), float('-inf')):
        return 'null'
    return repr(x)


def _builder_product(obj):
    """The builder result a variable is measured by — test/b123d-validation
    reference.py's rule, 0.11.1's meaning of _obj held fixed: the PLACED
    product for BuildPart/BuildLine (.part/.line) and the LOCAL one for
    BuildSketch (.sketch_local). Since 0.12 _obj is the local construction
    product of every builder."""
    cls = type(obj)
    try:
        if hasattr(cls, 'sketch_local'):
            return obj.sketch_local
        for attr in ('part', 'line'):
            if hasattr(cls, attr):
                return getattr(obj, attr)
        return getattr(obj, '_obj', None)
    except Exception:
        return None


def _shape_result_of(obj):
    """The measured builder product when it is a Shape with geometry (an
    upstream-source builder; guarded because attribute access on module
    stubs like the numpy shim RAISES rather than returning AttributeError
    defaults)."""
    try:
        if getattr(obj, '_obj', None) is None and \
                not hasattr(type(obj), 'sketch_local'):
            return None
    except Exception:
        return None
    cand = _builder_product(obj)
    if isinstance(cand, Shape) and cand.topo is not None:
        return cand
    return None


def _override_volume(entries, name, volume):
    prefix = '"' + name + '":{"volume":'
    for i in range(len(entries)):
        e = entries[i]
        if e.startswith(prefix):
            rest = e[len(prefix):]
            comma = rest.find(',')
            entries[i] = prefix + _json_num(abs(volume)) + rest[comma:]
            return


def _measure_globals_json(g):
    """Measure every module-level Shape / builder result in the given globals
    dict via the worker's MeasureShape hook; returns a JSON object string
    {name: {volume, area, faces, edges, bbox:[6]}} keyed by variable name.
    Mirrors the convention of test/b123d-validation/reference.py so lite and
    real build123d runs can be compared per variable name."""
    entries = []

    def measure(name, obj):
        try:
            topo = _topo(obj)
            m = w.MeasureShape(topo)
        except Exception as exc:  # noqa: BLE001 - report, never crash the run
            entries.append('"' + name + '":{"measure_error":"' +
                           str(exc).replace('"', "'")[:120] + '"}')
            return
        if m is None:
            entries.append('"' + name + '":{"measure_error":"null shape"}')
            return
        bbox = 'null'
        if m.bbox:
            bbox = '[' + ','.join([_json_num(v) for v in m.bbox]) + ']'
        entries.append('"' + name + '":{' +
                       '"volume":' + _json_num(m.volume) +
                       ',"area":' + _json_num(m.area) +
                       ',"faces":' + str(int(m.faces)) +
                       ',"edges":' + str(int(m.edges)) +
                       ',"bbox":' + bbox + '}')

    for name, obj in list(g.items()):
        if name.startswith('_') or name in ('show', 'show_object', 'show_all'):
            continue
        if isinstance(obj, Builder):
            product = _builder_product(obj)
            if product is not None and product.topo is not None:
                measure(name, product)
        elif not isinstance(obj, Shape) and _shape_result_of(obj) is not None:
            # An upstream-source builder (pysrc=upstream) is not a lite
            # Builder, but its result IS a lite-class shape - measure it so
            # the harness sees 'with BuildPart() as bp:' variables.
            measure(name, _shape_result_of(obj))
        elif isinstance(obj, Shape):
            if obj.topo is not None:
                measure(name, obj)
                if isinstance(obj, Compound) and obj.children:
                    # an assembly's volume is upstream's Compound.volume (its
                    # plain children), which reference.py records via
                    # obj.volume - not the per-solid sum of the whole tree
                    _override_volume(entries, name, obj.volume)
        elif isinstance(obj, (list, tuple)) and len(obj) > 0 and \
                all(isinstance(x, Shape) for x in obj):
            # Skip face-less elements (edge/vertex selector lists) and sort
            # the rest by bbox center: element ORDER frequently differs
            # between build123d and lite (selector traversal, location list
            # iteration), so per-index comparison would otherwise be noise.
            # reference.py applies the same rule.
            solids = [x for x in obj
                      if x.topo is not None and len(x.faces()) > 0]
            def _bbkey(x):
                bb = w.BoundingBox(x.topo, 0.01)
                if not bb:
                    return (0.0, 0.0, 0.0)
                return (round((bb[0] + bb[3]) / 2, 3),
                        round((bb[1] + bb[4]) / 2, 3),
                        round((bb[2] + bb[5]) / 2, 3))
            solids = _stable_sorted(solids[:64], key=_bbkey)
            for i, x in enumerate(solids):
                measure(name + '[' + str(i) + ']', x)
    return '{' + ','.join(entries) + '}'
`;

// Small stdlib shims registered as importable Brython modules. brython.js
// ships `math` as a built-in JS module but the import machinery cannot load
// it inside a module worker, and brython_stdlib.js (pure-Python stdlib) is
// deliberately not shipped — these cover what the build123d examples use.
export const PY_SHIM_MODULES = {
  math: `
# math shim delegating to the JS Math object (build123d-lite worker)
from browser import self as _w

pi = 3.141592653589793
e = 2.718281828459045
tau = 6.283185307179586
inf = float('inf')
nan = float('nan')


def sin(x): return _w.Math.sin(x)
def cos(x): return _w.Math.cos(x)
def tan(x): return _w.Math.tan(x)
def asin(x): return _w.Math.asin(x)
def acos(x): return _w.Math.acos(x)
def atan(x): return _w.Math.atan(x)
def atan2(y, x): return _w.Math.atan2(y, x)
def sinh(x): return _w.Math.sinh(x)
def cosh(x): return _w.Math.cosh(x)
def tanh(x): return _w.Math.tanh(x)
def sqrt(x): return _w.Math.sqrt(x)
def exp(x): return _w.Math.exp(x)
def fabs(x): return abs(float(x))
def floor(x): return int(_w.Math.floor(x))
def ceil(x): return int(_w.Math.ceil(x))
def trunc(x): return int(_w.Math.trunc(x))
def radians(x): return x * 0.017453292519943295
def degrees(x): return x * 57.29577951308232
def hypot(*a):
    s = 0.0
    for v in a:
        s += v * v
    return _w.Math.sqrt(s)
def log(x, base=None):
    if base is None:
        return _w.Math.log(x)
    return _w.Math.log(x) / _w.Math.log(base)
def log2(x): return _w.Math.log2(x)
def log10(x): return _w.Math.log10(x)
def pow(x, y): return _w.Math.pow(x, y)
def fmod(x, y): return x - y * int(x / y) if y != 0 else nan
def copysign(x, y): return abs(x) * (1.0 if y >= 0 else -1.0)
def isclose(a, b, rel_tol=1e-09, abs_tol=0.0):
    return abs(a - b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)
def isnan(x): return x != x
def isinf(x): return x == inf or x == -inf
def isfinite(x): return not (isnan(x) or isinf(x))
def gcd(a, b):
    a, b = abs(int(a)), abs(int(b))
    while b:
        a, b = b, a % b
    return a
def factorial(n):
    r = 1
    for i in range(2, int(n) + 1):
        r *= i
    return r
def dist(p, q):
    return sqrt(sum((a - b) ** 2 for a, b in zip(p, q)))
def prod(it, start=1):
    r = start
    for v in it:
        r *= v
    return r
`,
  copy: `
# copy shim: shallow/deep copies; build123d-lite Shapes copy via _lite_copy
def copy(x):
    if hasattr(x, '_lite_copy'):
        return x._lite_copy()
    if hasattr(x, '__copy__'):
        return x.__copy__()
    if isinstance(x, list):
        return list(x)
    if isinstance(x, dict):
        return dict(x)
    if isinstance(x, set):
        return set(x)
    if hasattr(x, '__dict__') and not isinstance(x, type):
        # CPython parity: a plain instance copies SHALLOWLY (new object,
        # same attribute references). Returning x unchanged silently shared
        # future mutations - copy.copy(<upstream Builder>) must keep the OLD
        # _obj binding when the builder later reassigns it.
        try:
            dup = object.__new__(type(x))
            for k in x.__dict__:
                setattr(dup, k, x.__dict__[k])
            return dup
        except Exception:
            return x
    return x


def deepcopy(x, memo=None):
    # CPython-parity memo semantics: a dict is always passed down and an
    # already-copied object is returned from it (upstream Shape.__deepcopy__
    # pre-seeds memo[id(self.wrapped)] with the BRepBuilderAPI_Copy so the
    # kernel shape is copied exactly once).
    if memo is None:
        memo = {}
    try:
        return memo[id(x)]
    except (KeyError, TypeError):
        pass
    if hasattr(x, '_lite_copy'):
        return x._lite_copy()
    if hasattr(x, '__deepcopy__'):
        return x.__deepcopy__(memo)
    if isinstance(x, list):
        return [deepcopy(v, memo) for v in x]
    if isinstance(x, tuple):
        return tuple(deepcopy(v, memo) for v in x)
    if isinstance(x, dict):
        return dict((deepcopy(k, memo), deepcopy(v, memo)) for k, v in x.items())
    if isinstance(x, set):
        return set(deepcopy(v, memo) for v in x)
    if hasattr(x, '__dict__') and not isinstance(x, type):
        # plain instance: CPython deepcopies attribute-by-attribute
        try:
            dup = object.__new__(type(x))
        except Exception:
            return x
        memo[id(x)] = dup
        for k in x.__dict__:
            setattr(dup, k, deepcopy(x.__dict__[k], memo))
        return dup
    return x
`,
  typing: `
# typing shim: annotations only — subscripting returns the object itself
class _AnyType:
    def __getitem__(self, item):
        return self

    def __call__(self, *a, **k):
        return self


Any = _AnyType()
Union = _AnyType()
Optional = _AnyType()
Literal = _AnyType()
Callable = _AnyType()
Iterable = _AnyType()
Iterator = _AnyType()
Sequence = _AnyType()
List = _AnyType()
Dict = _AnyType()
Tuple = _AnyType()
Set = _AnyType()
Type = _AnyType()
TypeVar = lambda *a, **k: _AnyType()
cast = lambda t, v: v
TYPE_CHECKING = False
`,
  functools: `
# functools shim (pure Python subset)
def reduce(fn, it, *init):
    items = iter(it)
    if init:
        acc = init[0]
    else:
        acc = next(items)
    for v in items:
        acc = fn(acc, v)
    return acc


def partial(fn, *pargs, **pkw):
    def inner(*args, **kw):
        merged = dict(pkw)
        merged.update(kw)
        return fn(*(pargs + args), **merged)
    return inner


def lru_cache(maxsize=None, typed=False):
    def deco(fn):
        cache = {}

        def inner(*args):
            if args in cache:
                return cache[args]
            r = fn(*args)
            cache[args] = r
            return r
        return inner
    if callable(maxsize):
        return deco(maxsize)
    return deco


def wraps(wrapped):
    def deco(fn):
        return fn
    return deco


def cmp_to_key(cmp):
    class K:
        def __init__(self, obj, *a):
            self.obj = obj

        def __lt__(self, other):
            return cmp(self.obj, other.obj) < 0

        def __eq__(self, other):
            return cmp(self.obj, other.obj) == 0
    return K
`,
  itertools: `
# itertools shim (pure Python subset)
def product(*iterables, repeat=1):
    pools = [tuple(p) for p in iterables] * repeat
    result = [[]]
    for pool in pools:
        result = [x + [y] for x in result for y in pool]
    for prod_item in result:
        yield tuple(prod_item)


def chain(*iterables):
    for it in iterables:
        for v in it:
            yield v


def repeat(obj, times=None):
    if times is None:
        while True:
            yield obj
    else:
        for _ in range(times):
            yield obj


def count(start=0, step=1):
    n = start
    while True:
        yield n
        n += step


def islice(it, *args):
    if len(args) == 1:
        start, stop, step = 0, args[0], 1
    elif len(args) == 2:
        start, stop, step = args[0], args[1], 1
    else:
        start, stop, step = args
    for i, v in enumerate(it):
        if stop is not None and i >= stop:
            return
        if i >= start and (i - start) % step == 0:
            yield v


def combinations(iterable, r):
    pool = tuple(iterable)
    n = len(pool)
    if r > n:
        return
    indices = list(range(r))
    yield tuple(pool[i] for i in indices)
    while True:
        for i in reversed(range(r)):
            if indices[i] != i + n - r:
                break
        else:
            return
        indices[i] += 1
        for j in range(i + 1, r):
            indices[j] = indices[j - 1] + 1
        yield tuple(pool[i] for i in indices)


def permutations(iterable, r=None):
    pool = tuple(iterable)
    n = len(pool)
    r = n if r is None else r
    for idx in product(range(n), repeat=r):
        if len(set(idx)) == r:
            yield tuple(pool[i] for i in idx)


def cycle(iterable):
    saved = []
    for v in iterable:
        yield v
        saved.append(v)
    while saved:
        for v in saved:
            yield v


def zip_longest(*iterables, fillvalue=None):
    its = [iter(i) for i in iterables]
    while True:
        row = []
        done = 0
        for it in its:
            try:
                row.append(next(it))
            except StopIteration:
                row.append(fillvalue)
                done += 1
        if done == len(its):
            return
        yield tuple(row)
`,
  operator: `
# operator shim (pure Python subset)
def add(a, b): return a + b
def sub(a, b): return a - b
def mul(a, b): return a * b
def truediv(a, b): return a / b
def neg(a): return -a
def and_(a, b): return a & b
def or_(a, b): return a | b
def eq(a, b): return a == b
def lt(a, b): return a < b
def le(a, b): return a <= b
def gt(a, b): return a > b
def ge(a, b): return a >= b


def itemgetter(*items):
    if len(items) == 1:
        key = items[0]
        return lambda obj: obj[key]
    return lambda obj: tuple(obj[k] for k in items)


def attrgetter(*attrs):
    def resolve(obj, name):
        for part in name.split('.'):
            obj = getattr(obj, part)
        return obj
    if len(attrs) == 1:
        return lambda obj: resolve(obj, attrs[0])
    return lambda obj: tuple(resolve(obj, a) for a in attrs)


def methodcaller(name, *args, **kwargs):
    return lambda obj: getattr(obj, name)(*args, **kwargs)
`,
  timeit: `
# timeit shim (wall-clock via JS Date)
from browser import self as _w


def default_timer():
    return _w.Date.now() / 1000.0


def timeit(stmt='pass', setup='pass', number=1000000, globals=None):
    raise NotImplementedError('timeit.timeit is not supported in the worker')


class Timer:
    def __init__(self, *a, **k):
        pass

    def timeit(self, number=1000000):
        raise NotImplementedError('timeit.Timer is not supported in the worker')
`,
  random: `
# random shim: exact CPython semantics (MT19937 + 53-bit random()) so that
# seeded scripts reproduce the reference geometry bit-for-bit
class _MT:
    def __init__(self):
        self.mt = [0] * 624
        self.index = 625
        self.seed_int(5489)

    def seed_int(self, s):
        self.mt[0] = s & 0xFFFFFFFF
        for i in range(1, 624):
            self.mt[i] = (1812433253 * (self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) + i) & 0xFFFFFFFF
        self.index = 624

    def init_by_array(self, key):
        self.seed_int(19650218)
        i, j = 1, 0
        k = max(624, len(key))
        while k:
            self.mt[i] = ((self.mt[i] ^ ((self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) * 1664525)) + key[j] + j) & 0xFFFFFFFF
            i += 1
            j += 1
            if i >= 624:
                self.mt[0] = self.mt[623]
                i = 1
            if j >= len(key):
                j = 0
            k -= 1
        k = 623
        while k:
            self.mt[i] = ((self.mt[i] ^ ((self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) * 1566083941)) - i) & 0xFFFFFFFF
            i += 1
            if i >= 624:
                self.mt[0] = self.mt[623]
                i = 1
            k -= 1
        self.mt[0] = 0x80000000

    def genrand(self):
        if self.index >= 624:
            for i in range(624):
                y = (self.mt[i] & 0x80000000) + (self.mt[(i + 1) % 624] & 0x7FFFFFFF)
                self.mt[i] = self.mt[(i + 397) % 624] ^ (y >> 1)
                if y % 2:
                    self.mt[i] ^= 2567483615
            self.index = 0
        y = self.mt[self.index]
        self.index += 1
        y ^= y >> 11
        y ^= (y << 7) & 2636928640
        y ^= (y << 15) & 4022730752
        y ^= y >> 18
        return y


_state = _MT()


def seed(a=None):
    if a is None:
        import time
        a = 0
    if isinstance(a, int):
        # CPython: init_by_array over the absolute value's 32-bit chunks
        v = abs(a)
        key = []
        while True:
            key.append(v & 0xFFFFFFFF)
            v >>= 32
            if v == 0:
                break
        _state.init_by_array(key)
    else:
        raise NotImplementedError('random.seed only supports ints here')


def random():
    a = _state.genrand() >> 5
    b = _state.genrand() >> 6
    return (a * 67108864.0 + b) / 9007199254740992.0


def getrandbits(k):
    if k <= 32:
        return _state.genrand() >> (32 - k)
    out = 0
    shift = 0
    while k > 0:
        take = min(k, 32)
        out |= (_state.genrand() >> (32 - take)) << shift
        shift += take
        k -= take
    return out


def _bit_length(n):
    try:
        return n.bit_length()
    except AttributeError:  # MicroPython ints have no bit_length
        k = 0
        while n > 0:
            n >>= 1
            k += 1
        return k


def _randbelow(n):
    if n <= 0:
        return 0
    k = _bit_length(n)
    r = getrandbits(k)
    while r >= n:
        r = getrandbits(k)
    return r


def randrange(start, stop=None, step=1):
    if stop is None:
        return _randbelow(start)
    width = stop - start
    if step == 1:
        return start + _randbelow(width)
    n = (width + step - 1) // step
    return start + step * _randbelow(n)


def randint(a, b):
    return randrange(a, b + 1)


def uniform(a, b):
    return a + (b - a) * random()


def choice(seq):
    return seq[_randbelow(len(seq))]


def shuffle(x):
    for i in range(len(x) - 1, 0, -1):
        j = _randbelow(i + 1)
        x[i], x[j] = x[j], x[i]
`,
  _bd_materials_shim: `
# bd_materials shim (build123d-lite): the materials API build123d 0.12+
# documents (resolve/material_names, the category modules' family
# functions, custom_<category>, finishes, core.PROPERTY_UNITS) over lite's
# embedded name table. COMPROMISE(materials): grades carry name, family,
# category and density only; finishes and processes are inert records.
# build123d is imported lazily: shims load before build123d-lite does.

_FAMILIES = """
abs_:plastics alloy_steel:metals aluminum:metals american_cherry:wood
asa:plastics ash:wood beech:wood birch:wood borosilicate:glass
brass:metals bronze:metals cardboard:paper castable:resins ceramic:resins
cfrp:plastics copper:metals engineered_wood:wood esd:resins felt:textile
flexible:resins foamboard:paper fr4:plastics gold:metals hardwood:wood
high_temp:resins leather:textile magnesium:metals maple:wood mdf:wood
mild_steel:metals nylon:plastics oak:wood osb:wood paper:paper pc:plastics
pe:plastics peek:plastics petg:plastics phenolic:plastics pine:wood
pla:plastics pmma:plastics pom:plastics pp:plastics pps:plastics
ptfe:plastics rubber:plastics silver:metals soda_lime:glass softwood:wood
spring_steel:metals spruce:wood stainless:metals standard:resins
titanium:metals tool_steel:metals tough:resins tpu:plastics
transparent:resins walnut:wood woven:textile
"""

PROPERTY_UNITS = {
    'areal_density': 'g/m\\u00b2',
    'compressive_strength_parallel': 'MPa',
    'density': 'kg/m\\u00b3',
    'elongation_at_break': '%',
    'hardness': 'per hardness_scale',
    'janka_hardness': 'N',
    'modulus_of_elasticity': 'GPa',
    'modulus_of_rupture': 'MPa',
    'poisson_ratio': '',
    'shear_modulus': 'GPa',
    'shear_strength': 'MPa',
    'tensile_strength': 'MPa',
    'thickness': 'mm',
    'yield_strength': 'MPa',
    'glass_transition_temperature': '\\u00b0C',
    'heat_deflection_temperature': '\\u00b0C',
    'max_service_temp': '\\u00b0C',
    'melting_temperature': '\\u00b0C',
    'specific_heat_capacity': 'J/(kg\\u00b7K)',
    'thermal_conductivity': 'W/(m\\u00b7K)',
    'thermal_expansion': '1/K',
}


def _b():
    import build123d
    return build123d


def resolve(name):
    return _b()._resolve_material(name)


def material_names():
    return _b()._material_names()


def canonical_name(material):
    return _b()._canonical_material_name(material)


def factory(name):
    def make(**kwargs):
        return _family_material(name, None, kwargs)
    return make


def _family_material(key, grade, kwargs):
    b = _b()
    fm = b._resolve_material(grade if isinstance(grade, str) else key)
    density = kwargs.get('density')
    if density is not None:
        fm.material.density = float(density)
    for attr in ('finish', 'process', 'color', 'thickness_mm', 'opacity',
                 'roughness', 'scale', 'rotation', 'pbr'):
        if kwargs.get(attr) is not None:
            setattr(fm, attr, kwargs[attr])
    return fm


class _Category:
    """One bd_materials catalog module (metals, plastics, wood, ...)."""

    def __init__(self, name, category):
        self.__name__ = 'bd_materials.materials.' + name
        self._category = category


def _make_family(key):
    def family(grade=None, **kwargs):
        return _family_material(key, grade, kwargs)
    return family


def _make_custom(category):
    def custom(name, density, family=None, **kwargs):
        b = _b()
        fm = b._FinishedMaterial(b._MaterialGrade(name, family or name,
                                                  category, float(density)))
        for attr in ('finish', 'process', 'color', 'thickness_mm', 'opacity',
                     'roughness', 'pbr'):
            if kwargs.get(attr) is not None:
                setattr(fm, attr, kwargs[attr])
        return fm
    return custom


_CATEGORY = {'metals': 'metal', 'plastics': 'plastic', 'resins': 'resin',
             'glass': 'glass', 'wood': 'wood', 'paper': 'paper',
             'textile': 'textile'}
metals = _Category('metals', 'metal')
plastics = _Category('plastics', 'plastic')
resins = _Category('resins', 'resin')
glass = _Category('glass', 'glass')
wood = _Category('wood', 'wood')
paper = _Category('paper', 'paper')
textile = _Category('textile', 'textile')
_MODULES = {'metals': metals, 'plastics': plastics, 'resins': resins,
            'glass': glass, 'wood': wood, 'paper': paper, 'textile': textile}
for _entry in _FAMILIES.split():
    _key, _mod = _entry.split(':')
    setattr(_MODULES[_mod], _key, _make_family(_key.rstrip('_')))
for _mod in _MODULES:
    setattr(_MODULES[_mod], 'custom_' + _CATEGORY[_mod],
            _make_custom(_CATEGORY[_mod]))


class Finish:
    def __init__(self, name, notes=None):
        self.name = name
        self.notes = notes

    def __repr__(self):
        return 'Finish(name=' + repr(self.name) + ', notes=' + \
            repr(self.notes) + ')'


class AppliedFinish:
    def __init__(self, finish, color=None, sheen=None, scale=(1.0, 1.0),
                 rotation=0.0):
        self.finish = finish
        self.color = color
        self.sheen = sheen
        self.scale = scale
        self.rotation = rotation

    def __repr__(self):
        return ('AppliedFinish(finish=' + repr(self.finish) + ', color=' +
                repr(self.color) + ', sheen=' + repr(self.sheen) +
                ', scale=' + repr(self.scale) + ', rotation=' +
                repr(self.rotation) + ')')


def _finish(label):
    def apply(color=None, sheen=None, scale=(1.0, 1.0), rotation=0.0):
        return AppliedFinish(Finish(label), color, sheen, scale, rotation)
    return apply


bead_blast = _finish('Bead Blast')
brushed = _finish('Brushed')
fine_sanding = _finish('Fine Sanding')
smooth_machining = _finish('Smooth Machining')
electropolish = _finish('Electropolish')
anodize = _finish('Anodize')
chem_film = _finish('Chem Film')
conductive_oxidation = _finish('Conductive Oxidation')
black_oxide = _finish('Black Oxide')
passivate = _finish('Passivate')
pickle = _finish('Pickle')
dye = _finish('Dye')
chrome = _finish('Chrome')
gold_plate = _finish('Gold Plate')
nickel_plate = _finish('Nickel Plate')
silver_plate = _finish('Silver Plate')
tin_plate = _finish('Tin Plate')
pvd = _finish('Pvd')
zinc_plate = _finish('Zinc Plate')
vacuum_plating = _finish('Vacuum Plating')
powder_coat = _finish('Powder Coat')
spray_paint = _finish('Spray Paint')
electrophoresis = _finish('Electrophoresis')
laser_engrave = _finish('Laser Engrave')
etch = _finish('Etch')
silkscreen = _finish('Silkscreen')


class _Namespace:
    pass


finishes = _Namespace()
for _name in ['bead_blast', 'brushed', 'fine_sanding', 'smooth_machining', 'electropolish', 'anodize', 'chem_film', 'conductive_oxidation', 'black_oxide', 'passivate', 'pickle', 'dye', 'chrome', 'gold_plate', 'nickel_plate', 'silver_plate', 'tin_plate', 'pvd', 'zinc_plate', 'vacuum_plating', 'powder_coat', 'spray_paint', 'electrophoresis', 'laser_engrave', 'etch', 'silkscreen']:
    setattr(finishes, _name, globals()[_name])
core = _Namespace()
core.PROPERTY_UNITS = PROPERTY_UNITS
`,
  bd_materials: `
# Package marker (see the scipy shim) for the bd_materials.* submodules.
if '__path__' not in globals():
    __path__ = []
from _bd_materials_shim import resolve, material_names, canonical_name, factory, metals, plastics, resins, glass, wood, paper, textile, finishes, core
`,
  'bd_materials.core': `
from _bd_materials_shim import PROPERTY_UNITS
`,
  'bd_materials.finishes': `
from _bd_materials_shim import Finish, AppliedFinish, bead_blast, brushed, fine_sanding, smooth_machining, electropolish, anodize, chem_film, conductive_oxidation, black_oxide, passivate, pickle, dye, chrome, gold_plate, nickel_plate, silver_plate, tin_plate, pvd, zinc_plate, vacuum_plating, powder_coat, spray_paint, electrophoresis, laser_engrave, etch, silkscreen
`,
  _scipy_shim: `
# scipy shim implementation module (imported by the 'scipy' package shims).
# Stable sort helper mirroring build123d-lite's: MicroPython's sort is
# unstable, and Nelder-Mead's simplex ordering on tied objective values must
# match the CPython-validated behavior on every runtime.
_SORT_PROBE = sorted([(i % 2, i) for i in range(32)], key=lambda t: t[0])
_SORT_IS_STABLE = [t[1] for t in _SORT_PROBE] == \\
    [i for i in range(32) if i % 2 == 0] + [i for i in range(32) if i % 2 == 1]


def _stable_sorted(seq, key=None, reverse=False):
    if _SORT_IS_STABLE:
        if key is None:
            return sorted(seq, reverse=reverse)
        return sorted(seq, key=key, reverse=reverse)
    items = list(seq)
    kf = key if key is not None else (lambda x: x)
    dec = [(kf(v), (-i if reverse else i), v) for i, v in enumerate(items)]
    dec.sort(reverse=reverse)
    return [t[2] for t in dec]


# COMPROMISE(scipy-shim): pure-Python Nelder-Mead stands in for
# scipy.optimize.minimize (same simplex init/reflect/expand/contract/shrink
# rules and convergence thresholds as scipy's implementation, but float
# arithmetic instead of numpy arrays — objectives must accept plain lists);
# minimize_scalar supports method='bounded' via golden-section. EVERY other
# scipy API raises loudly instead of approximating.


class _ScipyVec(list):
    """1-D ndarray stand-in handed to minimize() objectives: upstream
    build123d objectives do numpy-style elementwise arithmetic on the
    parameter vector (DoubleTangentArc: abs(separation - radius))."""

    def _binop(self, other, op):
        if isinstance(other, (list, tuple)):
            return _ScipyVec([op(a, b) for a, b in zip(self, other)])
        return _ScipyVec([op(a, other) for a in self])

    def __sub__(self, other):
        return self._binop(other, lambda a, b: a - b)

    def __rsub__(self, other):
        return self._binop(other, lambda a, b: b - a)

    def __add__(self, other):
        return self._binop(other, lambda a, b: a + b)

    def __radd__(self, other):
        return self._binop(other, lambda a, b: b + a)

    def __mul__(self, other):
        return self._binop(other, lambda a, b: a * b)

    def __rmul__(self, other):
        return self._binop(other, lambda a, b: b * a)

    def __truediv__(self, other):
        return self._binop(other, lambda a, b: a / b)

    def __abs__(self):
        return _ScipyVec([abs(a) for a in self])

    def __neg__(self):
        return _ScipyVec([-a for a in self])


class OptimizeResult(dict):
    def __getattr__(self, k):
        try:
            return self[k]
        except KeyError:
            raise AttributeError(k)

    def __setattr__(self, k, v):
        self[k] = v


def minimize(fun, x0, args=(), method='Nelder-Mead', bounds=None, tol=None,
             options=None, **kwargs):
    if method is not None and str(method).lower() != 'nelder-mead':
        raise NotImplementedError(
            'scipy shim: only minimize(method="Nelder-Mead") is available '
            'in build123d-lite (got ' + repr(method) + ')')
    if not isinstance(args, (list, tuple)):
        args = (args,)
    try:
        x0 = [float(v) for v in x0]
    except TypeError:
        x0 = [float(x0)]
    n = len(x0)
    xatol = fatol = 1e-4
    if tol is not None:
        xatol = fatol = float(tol)
    opts = options or {}
    xatol = opts.get('xatol', xatol)
    fatol = opts.get('fatol', fatol)
    maxiter = opts.get('maxiter', 200 * n)
    lo = [None] * n
    hi = [None] * n
    if bounds is not None:
        for i, b in enumerate(bounds):
            lo[i], hi[i] = b[0], b[1]

    def clip(x):
        out = []
        for i, v in enumerate(x):
            if lo[i] is not None and v < lo[i]:
                v = lo[i]
            if hi[i] is not None and v > hi[i]:
                v = hi[i]
            out.append(v)
        return out

    def f(x):
        r = fun(_ScipyVec(x), *args)
        try:
            return float(r)
        except TypeError:
            return float(r[0])

    sim = [clip(list(x0))]
    for i in range(n):
        y = list(x0)
        y[i] = y[i] * 1.05 if y[i] != 0 else 0.00025
        sim.append(clip(y))
    fsim = [f(x) for x in sim]
    it = 0
    for it in range(int(maxiter)):
        order = _stable_sorted(range(n + 1), key=lambda j: fsim[j])
        sim = [sim[j] for j in order]
        fsim = [fsim[j] for j in order]
        if max(abs(sim[j][i] - sim[0][i])
               for j in range(1, n + 1) for i in range(n)) <= xatol and \
                max(abs(fsim[j] - fsim[0]) for j in range(1, n + 1)) <= fatol:
            break
        cen = [sum(sim[j][i] for j in range(n)) / n for i in range(n)]
        xr = clip([cen[i] + (cen[i] - sim[n][i]) for i in range(n)])
        fr = f(xr)
        if fr < fsim[0]:
            xe = clip([cen[i] + 2.0 * (cen[i] - sim[n][i]) for i in range(n)])
            fe = f(xe)
            if fe < fr:
                sim[n], fsim[n] = xe, fe
            else:
                sim[n], fsim[n] = xr, fr
        elif fr < fsim[n - 1]:
            sim[n], fsim[n] = xr, fr
        else:
            if fr < fsim[n]:
                xc = clip([cen[i] + 0.5 * (cen[i] - sim[n][i])
                           for i in range(n)])
            else:
                xc = clip([cen[i] - 0.5 * (cen[i] - sim[n][i])
                           for i in range(n)])
            fc = f(xc)
            if fc < min(fr, fsim[n]):
                sim[n], fsim[n] = xc, fc
            else:
                for j in range(1, n + 1):
                    sim[j] = clip([sim[0][i] + 0.5 * (sim[j][i] - sim[0][i])
                                   for i in range(n)])
                    fsim[j] = f(sim[j])
    order = _stable_sorted(range(n + 1), key=lambda j: fsim[j])
    return OptimizeResult(x=list(sim[order[0]]), fun=fsim[order[0]],
                          success=True, nit=it + 1)


def minimize_scalar(fun, bounds=None, method='bounded', args=(),
                    options=None, **kwargs):
    if str(method).lower() != 'bounded' or bounds is None:
        raise NotImplementedError(
            'scipy shim: only minimize_scalar(method="bounded", bounds=...) '
            'is available in build123d-lite')
    if not isinstance(args, (list, tuple)):
        args = (args,)
    xatol = (options or {}).get('xatol', 1e-5)
    a, b = float(bounds[0]), float(bounds[1])
    phi = 0.6180339887498949
    c = b - phi * (b - a)
    d = a + phi * (b - a)
    fc, fd = fun(c, *args), fun(d, *args)
    while (b - a) > xatol:
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - phi * (b - a)
            fc = fun(c, *args)
        else:
            a, c, fc = c, d, fd
            d = a + phi * (b - a)
            fd = fun(d, *args)
    x = (a + b) / 2.0
    return OptimizeResult(x=x, fun=fun(x, *args), success=True)


def _raising(name):
    def f(*args, **kwargs):
        raise NotImplementedError(
            'scipy.' + name + ' is not available in build123d-lite (only '
            'optimize.minimize / optimize.minimize_scalar are shimmed)')
    return f


class _IndexRows(list):
    """Nested int lists standing in for scipy's ndarray of indices."""

    def tolist(self):
        return [list(r) if isinstance(r, list) else r for r in self]


class ConvexHull:
    """Convex hull with scipy's attribute conventions: .points, .simplices
    (facets as index rows) and .vertices. 3-D hulls are computed by the
    worker's bundled quickhull3d; 2-D hulls by Andrew's monotone chain
    (vertices CCW like qhull; simplices = consecutive hull-edge pairs —
    upstream Wire.make_convex_hull consumes them)."""

    def __init__(self, points, *args, **kwargs):
        pts = [[float(c) for c in p] for p in points]
        if len(pts) > 0 and len(pts[0]) == 2:
            idx = _stable_sorted(range(len(pts)),
                                 key=lambda i: (pts[i][0], pts[i][1]))

            def cross(o, a, b):
                return ((pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) -
                        (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]))
            lower = []
            for i in idx:
                while len(lower) >= 2 and cross(lower[-2], lower[-1], i) <= 0:
                    lower.pop()
                lower.append(i)
            upper = []
            for i in reversed(idx):
                while len(upper) >= 2 and cross(upper[-2], upper[-1], i) <= 0:
                    upper.pop()
                upper.append(i)
            hull = lower[:-1] + upper[:-1]   # CCW, no repeated endpoint
            self.points = pts
            self.vertices = _IndexRows(hull)
            self.simplices = _IndexRows(
                _IndexRows((hull[k], hull[(k + 1) % len(hull)]))
                for k in range(len(hull)))
            return
        if len(pts) == 0 or len(pts[0]) != 3:
            raise NotImplementedError(
                'scipy shim: only 2-D and 3-D ConvexHull are supported in '
                'build123d-lite')
        from browser import self as _w
        tris = _w.ConvexHull3D(pts)
        self.points = pts
        self.simplices = _IndexRows(
            _IndexRows(int(i) for i in t) for t in tris)
        seen = set()
        for t in self.simplices:
            seen.update(t)
        self.vertices = _IndexRows(_stable_sorted(seen))


def _bowyer_watson(points):
    """Delaunay triangulation of 2-D points (Bowyer-Watson incremental
    insertion). Returns the triangles as index triples into 'points', with
    every triangle touching the enclosing super-triangle discarded — which is
    exactly the set whose circumcentres are qhull's FINITE Voronoi vertices."""
    pts = [(float(p[0]), float(p[1])) for p in points]
    # dedupe: coincident inputs (shared edge endpoints) would make degenerate
    # triangles; qhull merges them too (Qbb Qc)
    seen = {}
    uniq = []
    for p in pts:
        key = (round(p[0], 12), round(p[1], 12))
        if key not in seen:
            seen[key] = True
            uniq.append(p)
    if len(uniq) < 3:
        return [], uniq
    xs = [p[0] for p in uniq]
    ys = [p[1] for p in uniq]
    cx = (min(xs) + max(xs)) / 2.0
    cy = (min(ys) + max(ys)) / 2.0
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    if span <= 0:
        return [], uniq
    big = 1000.0 * span
    verts = list(uniq) + [(cx - big, cy - big), (cx + big, cy - big),
                          (cx, cy + big)]
    n = len(uniq)
    tris = [(n, n + 1, n + 2)]

    def circum(a, b, c):
        ax, ay = verts[a]
        bx, by = verts[b]
        cx2, cy2 = verts[c]
        d = 2.0 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by))
        if abs(d) < 1e-18:
            return None
        a2 = ax * ax + ay * ay
        b2 = bx * bx + by * by
        c2 = cx2 * cx2 + cy2 * cy2
        ux = (a2 * (by - cy2) + b2 * (cy2 - ay) + c2 * (ay - by)) / d
        uy = (a2 * (cx2 - bx) + b2 * (ax - cx2) + c2 * (bx - ax)) / d
        r2 = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)
        return (ux, uy, r2)

    circles = {tris[0]: circum(*tris[0])}
    for i in range(n):
        px, py = verts[i]
        bad = []
        for t in tris:
            cc = circles.get(t)
            if cc is None:
                continue
            dx = px - cc[0]
            dy = py - cc[1]
            # a strictly-inside test with a relative epsilon: points exactly ON
            # a circumcircle (this input is full of cocircular samples) must not
            # flip the triangulation nondeterministically
            if dx * dx + dy * dy < cc[2] * (1.0 - 1e-12):
                bad.append(t)
        if not bad:
            continue
        edge_count = {}
        for t in bad:
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                key = (e[0], e[1]) if e[0] < e[1] else (e[1], e[0])
                edge_count[key] = edge_count.get(key, 0) + 1
        for t in bad:
            tris.remove(t)
            circles.pop(t, None)
        for key in _stable_sorted(edge_count.keys()):
            if edge_count[key] != 1:
                continue                       # interior edge of the cavity
            t = (key[0], key[1], i)
            cc = circum(*t)
            if cc is None:
                continue
            tris.append(t)
            circles[t] = cc
    return [t for t in tris if max(t) < n], uniq


class Voronoi:
    """2-D Voronoi diagram (scipy.spatial.Voronoi).

    Only .vertices is produced, because that is the only attribute
    build123d reads (operations_sketch.full_round takes the Voronoi vertices
    as its candidate centres for the largest empty circle). Those vertices are
    the circumcentres of the Delaunay triangulation, computed here with
    Bowyer-Watson instead of qhull (which is not available in the worker) and
    deduplicated the way qhull's 'Qbb Qc' merges cocircular circumcentres.
    Verified against scipy 1.18 on full_round's own inputs: the vertex SETS are
    identical (220 and 210 vertices, max pairwise deviation 2e-13).

    Unbounded ridges have no finite Voronoi vertex and qhull does not list one
    either; they fall out of the construction because every triangle touching
    the super-triangle is discarded. Nothing else about the diagram (ridges,
    regions, point_region) is offered rather than half-offered."""

    def __init__(self, points, *args, **kwargs):
        rows = [list(p) for p in points]
        if not rows or len(rows[0]) != 2:
            raise NotImplementedError(
                'scipy shim: only 2-D Voronoi is supported in build123d-lite '
                '(qhull is not available in the worker)')
        self.points = _IndexRows(_IndexRows(float(c) for c in r) for r in rows)
        self.ndim = 2
        self.npoints = len(rows)
        tris, uniq = _bowyer_watson(rows)
        verts = []
        seen = {}
        for t in tris:
            ax, ay = uniq[t[0]]
            bx, by = uniq[t[1]]
            cx, cy = uniq[t[2]]
            d = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
            if abs(d) < 1e-18:
                continue
            a2 = ax * ax + ay * ay
            b2 = bx * bx + by * by
            c2 = cx * cx + cy * cy
            ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
            uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
            key = (round(ux, 9), round(uy, 9))
            if key in seen:
                continue
            seen[key] = True
            verts.append((ux, uy))
        self.vertices = _IndexRows(_IndexRows(v) for v in verts)

    def __getattr__(self, name):
        if name in ('ridge_points', 'ridge_vertices', 'regions',
                    'point_region', 'furthest_site'):
            raise NotImplementedError(
                'scipy shim: Voronoi.' + name + ' is not available in '
                'build123d-lite (only .vertices is computed)')
        raise AttributeError(name)


class _Namespace:
    def __init__(self, prefix, **entries):
        self._prefix = prefix
        for k, v in entries.items():
            setattr(self, k, v)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        raise NotImplementedError(
            'scipy.' + self._prefix + '.' + name + ' is not available in '
            'build123d-lite')


optimize = _Namespace('optimize', minimize=minimize,
                      minimize_scalar=minimize_scalar,
                      OptimizeResult=OptimizeResult)
spatial = _Namespace('spatial', ConvexHull=ConvexHull, Voronoi=Voronoi)
`,
  scipy: `
# __path__ marks this as a package so Brython's importer resolves the
# pre-registered 'scipy.optimize' / 'scipy.spatial' submodules from cache.
# Only when missing: MicroPython imports this as a real package and its
# native __path__ is a STRING that must survive (a list breaks its importer).
if '__path__' not in globals():
    __path__ = []
from _scipy_shim import optimize, spatial
`,
  'scipy.optimize': `
from _scipy_shim import minimize, minimize_scalar, OptimizeResult
`,
  'scipy.spatial': `
from _scipy_shim import ConvexHull, Voronoi
`,
  pytest: `
# pytest shim: approx() ONLY, implemented for real (pytest's documented
# default tolerances: relative 1e-6, absolute 1e-12, whichever is looser).
# Several build123d doc scripts close with 'assert value == pytest.approx(x)',
# which is a genuine numeric comparison worth honouring; everything else about
# pytest (fixtures, marks, raises, the test runner) is absent, so a script that
# actually wants to run tests fails loudly.


class approx:
    def __init__(self, expected, rel=None, abs=None, nan_ok=False):
        self.expected = expected
        self.rel = 1e-6 if rel is None else rel
        self.abs = 1e-12 if abs is None else abs
        self.nan_ok = nan_ok

    def _close(self, actual, expected):
        tolerance = max(self.abs, self.rel * builtins_abs(expected))
        return builtins_abs(actual - expected) <= tolerance

    def __eq__(self, actual):
        if isinstance(self.expected, (list, tuple)):
            if len(actual) != len(self.expected):
                return False
            return all([self._close(a, e)
                        for a, e in zip(actual, self.expected)])
        if isinstance(self.expected, dict):
            if set(actual.keys()) != set(self.expected.keys()):
                return False
            return all([self._close(actual[k], self.expected[k])
                        for k in self.expected])
        return self._close(actual, self.expected)

    def __ne__(self, actual):
        return not self.__eq__(actual)

    def __repr__(self):
        return 'approx(' + repr(self.expected) + ' +- ' + \\
            repr(max(self.abs, self.rel * builtins_abs(self.expected))) + ')'


builtins_abs = abs


def __getattr__(name):
    raise NotImplementedError(
        'build123d-lite ships only pytest.approx, not ' + repr(name) +
        ' (there is no test runner in the CAD worker)')
`,
  os: `
# os shim: pure PATH ARITHMETIC only (os.path.join/dirname/abspath/... and
# os.getcwd), which is all the build123d docs scripts use it for - they build
# asset paths next to __file__ for SVG/screenshot output. There is no real
# filesystem in the worker, so nothing here touches one: os.path.exists is
# always False and open()/listdir are absent, so a script that genuinely needs
# a file still fails loudly instead of silently doing nothing.
sep = '/'
extsep = '.'
curdir = '.'
pardir = '..'
linesep = '\\n'
name = 'posix'
environ = {}


def getcwd():
    return '/'


def fspath(p):
    return p


class _Path:
    sep = '/'
    extsep = '.'
    curdir = '.'
    pardir = '..'

    @staticmethod
    def join(*parts):
        out = ''
        for p in parts:
            p = str(p)
            if p.startswith('/'):
                out = p
            elif out == '' or out.endswith('/'):
                out = out + p
            else:
                out = out + '/' + p
        return out

    @staticmethod
    def split(p):
        p = str(p)
        i = p.rfind('/')
        if i < 0:
            return ('', p)
        if i == 0:
            return ('/', p[1:])
        return (p[:i], p[i + 1:])

    @staticmethod
    def dirname(p):
        return _Path.split(p)[0]

    @staticmethod
    def basename(p):
        return _Path.split(p)[1]

    @staticmethod
    def splitext(p):
        base = _Path.basename(p)
        i = base.rfind('.')
        if i <= 0:
            return (str(p), '')
        return (str(p)[:len(str(p)) - (len(base) - i)], base[i:])

    @staticmethod
    def isabs(p):
        return str(p).startswith('/')

    @staticmethod
    def normpath(p):
        p = str(p)
        absolute = p.startswith('/')
        out = []
        for part in p.split('/'):
            if part == '' or part == '.':
                continue
            if part == '..':
                if out and out[-1] != '..':
                    out.pop()
                elif not absolute:
                    out.append('..')
                continue
            out.append(part)
        joined = '/'.join(out)
        if absolute:
            return '/' + joined
        return joined if joined else '.'

    @staticmethod
    def abspath(p):
        p = str(p)
        if not p.startswith('/'):
            p = getcwd() + ('' if getcwd().endswith('/') else '/') + p
        return _Path.normpath(p)

    @staticmethod
    def exists(p):
        return False

    @staticmethod
    def isfile(p):
        return False

    @staticmethod
    def isdir(p):
        return False


path = _Path
`,
  json: `
# json shim: the pure-Python subset build123d-lite needs — dumps() with
# cls=/default=/indent=/sort_keys=/separators= and loads() with object_hook=
# (GeomEncoder/LocationEncoder subclass json.JSONEncoder). brython.js cannot
# load its bundled json machinery inside a module worker, exactly like math.
# NOTE: written without backslash escapes (chr(92) etc.) because this source
# is embedded in a JS template string that consumes one level of escaping.

_BS = chr(92)
_WS = ' ' + chr(9) + chr(10) + chr(13)
_ESCAPES = {
    '"': _BS + '"',
    _BS: _BS + _BS,
    chr(10): _BS + 'n',
    chr(9): _BS + 't',
    chr(13): _BS + 'r',
    chr(8): _BS + 'b',
    chr(12): _BS + 'f',
}
_UNESCAPES = {'"': '"', _BS: _BS, '/': '/', 'n': chr(10), 't': chr(9),
              'r': chr(13), 'b': chr(8), 'f': chr(12)}


class JSONDecodeError(ValueError):
    def __init__(self, msg, doc='', pos=0):
        ValueError.__init__(self, str(msg) + ': char ' + str(pos))
        self.msg = msg
        self.doc = doc
        self.pos = pos


def _encode_string(s, ensure_ascii):
    out = ['"']
    for ch in s:
        esc = _ESCAPES.get(ch)
        if esc is not None:
            out.append(esc)
            continue
        code = ord(ch)
        if code < 32 or (ensure_ascii and code > 126):
            out.append(_BS + 'u' + format(code, '04x'))
        else:
            out.append(ch)
    out.append('"')
    return ''.join(out)


def _encode_float(x):
    if x != x:
        return 'NaN'
    if x == float('inf'):
        return 'Infinity'
    if x == float('-inf'):
        return '-Infinity'
    return repr(x)


class JSONEncoder:
    def __init__(self, skipkeys=False, ensure_ascii=True, check_circular=True,
                 allow_nan=True, sort_keys=False, indent=None,
                 separators=None, default=None):
        self.skipkeys = skipkeys
        self.ensure_ascii = ensure_ascii
        self.check_circular = check_circular
        self.allow_nan = allow_nan
        self.sort_keys = sort_keys
        if indent is not None and not isinstance(indent, str):
            indent = ' ' * int(indent)
        self.indent = indent
        if separators is not None:
            self.item_separator, self.key_separator = separators
        elif indent is not None:
            self.item_separator, self.key_separator = ',', ': '
        else:
            self.item_separator, self.key_separator = ', ', ': '
        if default is not None:
            self.default = default

    def default(self, o):
        raise TypeError('Object of type ' + type(o).__name__ +
                        ' is not JSON serializable')

    def encode(self, o):
        return self._emit(o, 0)

    def _json_key(self, k):
        if isinstance(k, str):
            return _encode_string(k, self.ensure_ascii)
        if k is True:
            return '"true"'
        if k is False:
            return '"false"'
        if k is None:
            return '"null"'
        if isinstance(k, (int, float)):
            return _encode_string(self._emit(k, 0), self.ensure_ascii)
        if self.skipkeys:
            return None
        raise TypeError('keys must be str, int, float, bool or None, not ' +
                        type(k).__name__)

    def _nl(self, depth):
        if self.indent is None:
            return ''
        return chr(10) + self.indent * depth

    def _emit(self, o, depth):
        if o is True:
            return 'true'
        if o is False:
            return 'false'
        if o is None:
            return 'null'
        if isinstance(o, str):
            return _encode_string(o, self.ensure_ascii)
        if isinstance(o, float):
            return _encode_float(o)
        if isinstance(o, int):
            return str(o)
        if isinstance(o, dict):
            items = list(o.items())
            if self.sort_keys:
                items.sort(key=lambda kv: kv[0])
            parts = []
            for k, v in items:
                key = self._json_key(k)
                if key is None:
                    continue
                parts.append(key + self.key_separator +
                             self._emit(v, depth + 1))
            if not parts:
                return '{}'
            sep = self.item_separator + self._nl(depth + 1)
            return ('{' + self._nl(depth + 1) + sep.join(parts) +
                    self._nl(depth) + '}')
        if isinstance(o, (list, tuple)):
            parts = [self._emit(v, depth + 1) for v in o]
            if not parts:
                return '[]'
            sep = self.item_separator + self._nl(depth + 1)
            return ('[' + self._nl(depth + 1) + sep.join(parts) +
                    self._nl(depth) + ']')
        return self._emit(self.default(o), depth)


def dumps(obj, cls=None, skipkeys=False, ensure_ascii=True,
          check_circular=True, allow_nan=True, indent=None, separators=None,
          default=None, sort_keys=False, **kw):
    enc_cls = cls if cls is not None else JSONEncoder
    enc = enc_cls(skipkeys=skipkeys, ensure_ascii=ensure_ascii,
                  check_circular=check_circular, allow_nan=allow_nan,
                  indent=indent, separators=separators, default=default,
                  sort_keys=sort_keys)
    return enc.encode(obj)


def _parse_string(s, i):
    i += 1  # skip the opening quote
    out = []
    while True:
        if i >= len(s):
            raise JSONDecodeError('Unterminated string', s, i)
        ch = s[i]
        if ch == '"':
            return ''.join(out), i + 1
        if ch == _BS:
            nxt = s[i + 1] if i + 1 < len(s) else ''
            if nxt == 'u':
                out.append(chr(int(s[i + 2:i + 6], 16)))
                i += 6
                continue
            rep = _UNESCAPES.get(nxt)
            if rep is None:
                raise JSONDecodeError('Invalid escape', s, i)
            out.append(rep)
            i += 2
            continue
        out.append(ch)
        i += 1


def _parse_value(s, i, object_hook):
    while i < len(s) and s[i] in _WS:
        i += 1
    if i >= len(s):
        raise JSONDecodeError('Expecting value', s, i)
    ch = s[i]
    if ch == '{':
        i += 1
        obj = {}
        while True:
            while i < len(s) and s[i] in _WS:
                i += 1
            if i < len(s) and s[i] == '}':
                i += 1
                break
            key, i = _parse_string(s, i)
            while i < len(s) and s[i] in _WS:
                i += 1
            if i >= len(s) or s[i] != ':':
                raise JSONDecodeError('Expecting colon', s, i)
            value, i = _parse_value(s, i + 1, object_hook)
            obj[key] = value
            while i < len(s) and s[i] in _WS:
                i += 1
            if i < len(s) and s[i] == ',':
                i += 1
                continue
            if i < len(s) and s[i] == '}':
                i += 1
                break
            raise JSONDecodeError('Expecting comma or brace', s, i)
        if object_hook is not None:
            obj = object_hook(obj)
        return obj, i
    if ch == '[':
        i += 1
        arr = []
        while True:
            while i < len(s) and s[i] in _WS:
                i += 1
            if i < len(s) and s[i] == ']':
                i += 1
                break
            value, i = _parse_value(s, i, object_hook)
            arr.append(value)
            while i < len(s) and s[i] in _WS:
                i += 1
            if i < len(s) and s[i] == ',':
                i += 1
                continue
            if i < len(s) and s[i] == ']':
                i += 1
                break
            raise JSONDecodeError('Expecting comma or bracket', s, i)
        return arr, i
    if ch == '"':
        return _parse_string(s, i)
    for word, value in (('true', True), ('false', False), ('null', None),
                        ('NaN', float('nan')), ('Infinity', float('inf')),
                        ('-Infinity', float('-inf'))):
        if s.startswith(word, i):
            return value, i + len(word)
    j = i
    if s[j] == '-':
        j += 1
    is_float = False
    while j < len(s) and (s[j].isdigit() or s[j] in '.eE+-'):
        if s[j] in '.eE':
            is_float = True
        j += 1
    text = s[i:j]
    try:
        return (float(text) if is_float else int(text)), j
    except ValueError:
        raise JSONDecodeError('Expecting value', s, i)


def loads(s, object_hook=None, **kw):
    if isinstance(s, (bytes, bytearray)):
        s = s.decode('utf-8')
    value, i = _parse_value(s, 0, object_hook)
    while i < len(s) and s[i] in _WS:
        i += 1
    if i != len(s):
        raise JSONDecodeError('Extra data', s, i)
    return value


def dump(obj, fp, **kw):
    fp.write(dumps(obj, **kw))


def load(fp, **kw):
    return loads(fp.read(), **kw)
`,
  logging: `
# logging shim: swallows everything (worker console is used via print)
DEBUG = 10
INFO = 20
WARNING = 30
ERROR = 40
CRITICAL = 50


class _Logger:
    def debug(self, *a, **k): pass
    def info(self, *a, **k): pass
    def warning(self, *a, **k): pass
    def error(self, *a, **k): pass
    def critical(self, *a, **k): pass
    def exception(self, *a, **k): pass
    def setLevel(self, *a, **k): pass
    def addHandler(self, *a, **k): pass


_logger = _Logger()


def getLogger(name=None):
    return _logger


def basicConfig(*a, **k):
    pass


def debug(*a, **k):
    pass


def info(*a, **k):
    pass


def warning(*a, **k):
    pass


def error(*a, **k):
    pass


def critical(*a, **k):
    pass


def exception(*a, **k):
    pass
`,
};
