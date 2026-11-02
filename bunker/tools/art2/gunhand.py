"""In-hand gun sprites (about 16-18 px), hand-drawn on the 2:1 isometric diagonal.

F = held by a hero in the F view: right side of the gun, pointing down-right.
B = held in the B view: left side of the gun, pointing up-left (mostly hidden behind the body).
Each sprite lists its hand-picked points (sprite pixel coordinates):
  grip    - where the firing hand's knuckles sit on the pistol grip (the sprite's anchor)
  support - where the support hand holds the handguard (rifles) or wraps the firing hand (pistol)
  butt    - centre of the butt plate (rifles; goes into the shoulder pocket)
  muzzle  - first pixel past the bore along the barrel axis: the flash and the tracer start here
  well    - magazine well (reload)
  handle  - charging handle (reload)
The gun is rigid: every hero frame places one of these sprites by translation only.
"""
from core import K, Part

GH = K({'o': 'ink', 'y': 'night', 'n': 'dusk', 'i': 'lilac', 'G': 'steel', 'I': 'mist', 'Q': 'white',
        'z': 'coal', 'Z': 'slate', 'Y': 'sage', 'E': 'fern',
        'r': 'rust', 'R': 'copper', 'c': 'tan', 't': 'khaki', 'T': 'bone', 'u': 'mud', 'x': 'oxblood',
        'a': 'teal', 'A': 'aqua', 'M': 'mint', 'C': 'ice', 'O': 'amber', 'g': 'gold', 'd': 'deepsea'})


def G(text, pts, name):
    p = Part(text, GH, pts['grip'][0], pts['grip'][1], name)
    p.pts = pts
    return p


# ------------------------------------------------------------------ 희귀2 돌격소총 (assault rifle)
AR_F = G("""
oo................
oEoo..............
oZEYoo..o.........
oZZZYyoooGo.......
.ooZZynniiGoo.....
...oozyynnnniGoo..
....ozooyynZYYiIoo
....ozo.ozyoZZZyno
.....oo.ozyoooooo.
........ozzo......
.........oo.......
""", dict(grip=(5, 7), support=(13, 8), butt=(1, 2), muzzle=(18, 7), well=(9, 8), handle=(8, 3)), 'ar_F')

# magazine out (reload): same gun, the magazine pixels removed, the well shows as a dark slot
AR_F_NOMAG = G("""
oo................
oEoo..............
oZEYoo..o.........
oZZZYyoooGo.......
.ooZZynniiGoo.....
...oozyynnnniGoo..
....ozooyynZYYiIoo
....ozo.oyyoZZZyno
.....oo..oooooooo.
""", dict(grip=(5, 7), support=(13, 8), butt=(1, 2), muzzle=(18, 7), well=(9, 8), handle=(8, 3)), 'ar_F_nomag')

# the loose magazine (in the support hand / falling)
MAG = Part("""
oo.
oyo
ozo
ozzo
.oo.
""", GH, 1, 0, 'mag')
MAG_TILT = Part("""
.oo..
ooyo.
.ozzo
..oo.
""", GH, 1, 0, 'mag_tilt')

# B view: the left side of the same rifle, pointing up-left; mostly hidden behind the body, so the
# barrel, the front sight and the handguard are the parts that must read.
AR_B = G("""
.oo...............
oIioo.............
onyiGoo...........
.ooyynGoo.........
...ooyynnGoo...o..
.....ooyynnnGooGo.
.....otooyynnnnYoo
......ottoyozzZYYo
......ottoozoZZEoo
.......ooo.oz.ooo.
..........oo......
""", dict(grip=(12, 7), support=(5, 4), butt=(16, 7), muzzle=(0, 0), well=(7, 7), handle=(11, 4)), 'ar_B')
AR_B_NOMAG = G("""
.oo...............
oIioo.............
onyiGoo...........
.ooyynGoo.........
...ooyynnGoo...o..
.....ooyynnnGooGo.
.....oooyyynnnnYoo
.......oooyozzZYYo
..........ozoZZEoo
...........oz.ooo.
..........oo......
""", dict(grip=(12, 7), support=(5, 4), butt=(16, 7), muzzle=(0, 0), well=(7, 7), handle=(11, 4)), 'ar_B_nomag')
