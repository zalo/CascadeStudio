# CascadeStudio build123d mode
from build123d import *

L, W, T = 80, 60, 8        # flange plate: length / width / thickness
boss_d, boss_h, bore_d = 34, 20, 16
hole_d, inset = 6, 10      # M6 bolt holes, inset from the plate edges

plate = Pos(0, 0, T / 2) * Box(L, W, T)
plate = fillet(plate.edges().filter_by(Axis.Z), 12)

mount = plate + Pos(0, 0, T + boss_h / 2) * Cylinder(boss_d / 2, boss_h)
mount -= Cylinder(bore_d / 2, 200)
mount -= GridLocations(L - 2 * inset, W - 2 * inset, 2, 2) * Cylinder(hole_d / 2, 200)
mount -= Pos(0, 0, T + boss_h / 2) * Rot(0, 90, 0) * Cylinder(2.5, 200)

mount = fillet(mount.edges().group_by(Axis.Z)[-1], 1.5)

show(mount)
print("volume:", round(volume(mount), 1), "mm^3")
