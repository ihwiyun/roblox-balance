#!/usr/bin/env python3
"""Turrets for the bunker game: 32 turrets (8 grades x 4 roles, the order of TURRETS in src/logic/gear.mjs),
every pixel placed by hand.

Run from this folder:  python3 turrets.py               -> writes ../art/turrets.js (window.ART_TURRETS)
                       python3 turrets.py --sheet 2,7   -> also writes ../samples/turrets/sheet.png (needs Pillow):
                                                           all cards, and every role's four facings for those grades
                       python3 turrets.py --check DIR   -> a quick sheet of every turret's frames into DIR

How a turret is made
- A frame is 48x40 game pixels so the fire frame's flash, flame, frost, arcs and rockets fit; the turret itself is
  drawn in a 32x32 box placed at (8, 7) and stands 19-32 px tall (coils tallest). The anchor (ax, ay) = (24, 35) is the middle
  of the turret ring's foot, the point that stands on the bunker's mount (SITES.mounts in src/yard.js).
- Two parts: the ring (one per grade, with a band in the UI grade colour; it never turns) and the head (one per
  turret; it turns). The head is drawn by hand looking down-right (se: +x in the world) and looking up-left (nw:
  -x). Every head is symmetric about the way it looks, so looking down-left (sw: +y) and up-right (ne: -y) are
  the same pixels mirrored, with the two wall shades swapped so the light still comes from the top left (the
  game's light: the top bright, the wall facing down-left mid, the wall facing down-right dark).
- Parts are hand-drawn stamps laid in order (a receiver, barrels, a tank, a coil...); a part may reappear in
  another turret of the same grade (the experimental coil stands on the experimental cannon's receiver).
- Colours: every material is one base colour run through the engine's own ramp (rampOf in engine.js), five
  shades from violet shadow to warm light, the same way the bunker is shaded. Outline rgb(30,24,26) as on the
  survivors and zombies. Grade materials match the weapon cards (tools/weapons.py).
- The fire frame: barrels and tubes kick back along their axis (they never jump sideways) and the muzzle shows
  its flash, flame, frost, arc or blast for that one frame only (no trail).
- The card (32x32): the idle down-right turret on a floor in its grade colour, centred across the card.

Letters (one palette per turret)
  o outline   K bore black   W glint
  a b c d e   body: deep, wall facing down-right, wall facing down-left, top, light
  f g h i j   metal (barrels, pipes, coils), same five shades
  k l m n p   grade accent (the UI grade colour), same five shades
  q r s t u   third material (tank, battery, bags...), same five shades
  v w x y z   the ring, same five shades
  G H J       glow: core, bright, dim (experimental and later)
  F Y O R D   fire: white-hot, yellow, orange, red, ember        L C B N  frost: ice, pale, blue, deep
  A Z V       electric arc: core, cyan, violet                    S T U    smoke: light, mid, dark
  X           star        1 2 3 4 5 6  rainbow (red, orange, yellow, green, blue, violet)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..')

# ---------------------------------------------------------------- colours
COOL, WARM = (46, 38, 84), (255, 232, 180)


def ramp(c):
    """engine.js rampOf: shadows drift to violet, lights to warm yellow (rgb() truncates)"""
    mix = lambda m, t, k: [min(255, int(c[i] * m + (t[i] - c[i] * m) * k)) for i in range(3)]
    return [mix(.4, COOL, .34), mix(.62, COOL, .18), mix(.84, COOL, .05), mix(1, WARM, 0), mix(1.1, WARM, .22)]


MATS = {'body': 'abcde', 'metal': 'fghij', 'acc': 'klmnp', 'mat3': 'qrstu', 'ring': 'vwxyz'}
# mirrored views swap the two wall shades of every material
SWAP = str.maketrans('bcghlmrswx', 'cbhgmlsrxw')
FIXED = {
    'o': [30, 24, 26], 'K': [16, 12, 18], 'W': [255, 252, 236],
    'F': [255, 248, 206], 'Y': [255, 214, 92], 'O': [242, 136, 46], 'R': [198, 60, 40], 'D': [118, 38, 38],
    'L': [238, 250, 255], 'C': [162, 226, 250], 'B': [88, 158, 232], 'N': [58, 94, 178],
    'A': [250, 250, 255], 'Z': [130, 222, 255], 'V': [150, 118, 255],
    'S': [224, 220, 212], 'T': [170, 166, 162], 'U': [114, 110, 114], 'X': [255, 255, 255],
    '1': [224, 69, 69], '2': [240, 150, 40], '3': [240, 210, 60], '4': [69, 192, 112], '5': [69, 144, 224], '6': [160, 80, 224],
}
# the UI grade colours (index.html .g0-.g7)
GRADE_UI = [[154, 154, 154], [76, 175, 80], [61, 123, 224], [155, 79, 209], [240, 138, 36], [214, 58, 58], [201, 154, 16], [224, 69, 155]]
GRADE_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legend', 'immortal', 'mythic', 'eternal']
PREFIX = ['고물', '민간', '군용', '특수', '실험', '미지', '신화', '영원']
ROLES = ['mg', 'status', 'tesla', 'blast']


def base_name(g, r):
    fire = g % 2 == 0
    return ['기관포', '화염 방사기' if fire else '냉각 분사기', '전기 코일', '로켓 포대' if g % 2 else '박격포'][r]


# per grade: the ring, the accent and the default body, metal and third material
GRADE_MATS = [
    # scrap: weathered plate, pipe steel, rust; grey primer
    dict(ring=(150, 86, 54), acc=(154, 154, 154), body=(150, 138, 122), metal=(104, 106, 114), mat3=(150, 86, 54)),
    # civilian: blued steel and walnut; green
    dict(ring=(112, 124, 150), acc=(76, 175, 80), body=(124, 136, 164), metal=(84, 90, 112), mat3=(174, 108, 62)),
    # military issue: olive drab and matte black; blue
    dict(ring=(108, 118, 78), acc=(61, 123, 224), body=(122, 134, 88), metal=(78, 78, 88), mat3=(150, 140, 100)),
    # special forces: black and coyote tan; purple
    dict(ring=(74, 74, 84), acc=(155, 79, 209), body=(92, 92, 104), metal=(64, 64, 74), mat3=(186, 156, 108)),
    # experimental: lab white and graphite; orange glow
    dict(ring=(214, 212, 206), acc=(240, 138, 36), body=(232, 230, 222), metal=(96, 98, 112), mat3=(88, 90, 102)),
    # unknown tech: alien obsidian and alien silver; red glow
    dict(ring=(84, 70, 106), acc=(214, 58, 58), body=(112, 96, 136), metal=(186, 182, 204), mat3=(64, 54, 84)),
    # mythic: gold, ebony and ivory; gold
    dict(ring=(214, 166, 48), acc=(242, 206, 90), body=(230, 186, 70), metal=(150, 110, 52), mat3=(236, 228, 206)),
    # eternal: cosmic indigo and pearl; the rainbow
    dict(ring=(66, 58, 132), acc=(224, 69, 155), body=(88, 80, 164), metal=(214, 210, 244), mat3=(44, 38, 92)),
]
# glow per grade (core, bright, dim): the experimental, unknown, mythic and eternal grades glow
GLOW = [None, None, None, None,
        ([255, 244, 196], [255, 176, 64], [214, 104, 30]),
        ([255, 214, 204], [255, 84, 72], [168, 34, 52]),
        ([255, 252, 220], [255, 222, 110], [214, 162, 32]),
        ([255, 255, 255], [190, 236, 255], [190, 150, 255])]


def palette(g, mats, glow=None, fixed=None):
    m = dict(GRADE_MATS[g])
    m.update(mats or {})
    pal = dict(FIXED)
    for key, letters in MATS.items():
        pal.update(zip(letters, ramp(m[key])))
    pal.update(zip('GHJ', glow or GLOW[g] or GLOW[4]))
    pal.update(fixed or {})
    return pal


# ---------------------------------------------------------------- drawing helpers
W, H, AX, AY = 48, 40, 24, 35
DX, DY = 8, 7   # where the 32x32 design box of every drawing sits in the frame


def rows(s):
    out = s.strip('\n').split('\n')
    return out


def canvas():
    return [['.'] * W for _ in range(H)]


def stamp(cv, rs, x, y, name='?'):
    for j, r in enumerate(rs):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            if not (0 <= y + j < len(cv) and 0 <= x + i < len(cv[0])):
                raise ValueError(f'{name}: pixel outside the frame at {x + i},{y + j}')  # noqa
            cv[y + j][x + i] = ch


def flat(cv):
    return [''.join(r) for r in cv]


def mirror(f):
    return [r[::-1].translate(SWAP) for r in f]


def under(top, bottom):
    """top drawn over bottom"""
    return [''.join(t if t != '.' else b for t, b in zip(tr, br)) for tr, br in zip(top, bottom)]


# ---------------------------------------------------------------- the rings (one per grade, never turned)
RINGS = [
    # 0 scrap: rusted, a grey primer band
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
omxxzzzzyywwlo
oxmmxxwxwwllwo
.oxxmmmlllwwo.
..ooxxxwwvoo..
....oooooo....
"""),
    # 1 civilian: blued steel, a green painted band, bolts
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
omxxzzzzyywwlo
oxmmxzxxwzllwo
.oxxmmmlllwwo.
..ooxzxwzwoo..
....oooooo....
"""),
    # 2 military: olive, a blue band with white stencil dashes
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
omxxzzzzyywwlo
oxmWxxwxwwlWwo
.oxxmWmlWlwwo.
..ooxxxwwvoo..
....oooooo....
"""),
    # 3 special forces: black, purple lights set in the band
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
olxxzzzzyywwko
oxlpxxwxwwplwo
.oxxllpklkwwo.
..ooxxxwwvoo..
....oooooo....
"""),
    # 4 experimental: white, a glowing band
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
oHxxzzzzyywwJo
oxHGxxwxwwJJwo
.oxxHGGHJJwwo.
..ooxxxwwvoo..
....oooooo....
"""),
    # 5 unknown: obsidian, a red glowing seam
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
oHxxzzzzyywwJo
oxHGxxwxwwJJwo
.oxxHGGHJJwwo.
..ooxvxwvvoo..
....oooooo....
"""),
    # 6 mythic: gold, studs and a ruby at the front
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
opxxzzzzyywwmo
oxpnxxRxwwmmwo
.oxxnpRDmnwwo.
..ooxxxwwvoo..
....oooooo....
"""),
    # 7 eternal: indigo, the rainbow round it, a star
    rows("""
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
o1xxzzzzyywX6o
oxX2xxwxww56wo
.oxx233455wwo.
..ooxxxwwvoo..
....oooooo....
"""),
]
RING_AT = (9, 21)

# ---------------------------------------------------------------- the heads
# Each turret: pal (materials over the grade's), se and nw = layers drawn in order [kind, rows, x, y]; kind 'gun'
# moves with the recoil; muzzle = the point where shots leave in the idle frame; axis = the barrel's direction on
# screen; fx = what the fire frame shows at the muzzle.
T = {}

# ---- era 0 machine cannon: a welded receiver, two long barrels along its top edges, a round ammo drum on each side
_recv0_se = rows("""
....oo....
..ooddoo..
oeddeddddo
oceeddddbo
occceebbbo
ocmmcbbbbo
ocmncbbebo
ocsmcbbbbo
oascbbbbao
..oocboo..
....oo....
""")
_recv0_nw = rows("""
....oo....
..ooddoo..
oedddeddbo
oceeddddbo
occceebbbo
occcbaaabo
ocmmbaKabo
ocmncaaabo
oasccbbbao
..oocboo..
....oo....
""")
_drum0 = rows("""
..oooo..
.ottttoo
osuuttro
ossttrro
ossssrro
otttttro
ossssrro
.ossrrro
..oooro.
....oo..
""")
_bar0_se = rows("""
.oo...............
ojjoo.............
ohhiijjoo.........
.oohhiijjoo.......
...oohhiijjoo.....
.....oohhiijjoo...
.......oohhiijjoo.
.........oohhiijjo
...........oohhgKo
.............oooo.
""")
_bar0r_se = rows("""
.oo...............
ojjoo.............
ohhssjjoo.........
.oohssrsjoo.......
...oohssrsjoo.....
.....oohhsiijoo...
.......oohhiijjoo.
.........oohhiijjo
...........oohhgKo
.............oooo.
""")
_bar0_nw = rows("""
.oo.............
ojjoo...........
ohgiijjoo.......
.oohhiijjoo.....
...oohhiijjoo...
.....oohhiijjoo.
.......oohhiijjo
.........oohhiio
...........oooo.
""")
T[0, 0] = dict(
    se=[['head', _recv0_se, 11, 16], ['head', _drum0, 8, 19], ['gun', _bar0_se, 14, 13], ['gun', _bar0r_se, 9, 15]],
    nw=[['head', _recv0_nw, 11, 16], ['head', _drum0, 8, 19], ['gun', _bar0_nw, 6, 10], ['gun', _bar0_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2', pal={'mat3': (112, 118, 84)})

# ---- era 0 sprayer (flamethrower): a welded platform, a red jerry can standing at the back, a pipe nozzle
_plat0 = rows("""
......oo......
....ooddoo....
..oodeddddoo..
oeddddddddddbo
oceeddddddddbo
occeceeddbbbbo
oacccceebbebao
..ooacccbboo..
....ooacoo....
......oo......
""")
_can0 = rows("""
....oo.....
..ooqtoo...
oottqqttoo.
osuuttqtnno
osssuuttnno
osssssuurro
osttssstrro
ossttstrrro
osssttsrrro
ossttstrrro
osttsssrrro
osssssrrrro
oqsssssrrqo
..oosssrroo
....oosroo.
......oo...
""")
_noz0_se = rows("""
oo........
ihoo......
hhiioo....
oohhiioo..
..oohhiijo
....oohhjjo
......ohgKo
.......oooo
""")
_hose0_se = rows("""
.oo..
oKKoo
.ooKo
...oo
""")
_noz0_nw = rows("""
.oo.........
ojjoo.......
oiihhoo.....
oghhiiioo...
.ooooohhiioo
......oohhii
........oohh
""")
T[0, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _can0, 9, 8], ['head', _hose0_se, 16, 20], ['gun', _noz0_se, 17, 19]],
    nw=[['gun', _noz0_nw, 3, 14], ['head', _plat0, 9, 18], ['head', _can0, 12, 10]],
    muzzle={'se': (28, 25), 'nw': (3, 15)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='flame', pal={'mat3': (186, 58, 46)})

# ---- era 0 electric coil: a car battery, copper wound round a pipe, a hubcap on top, a bent rod with a ball
_batt0 = rows("""
....oo....
..ooqqoo..
outKtnqtto
osuuttttro
osssuurrro
ossssrrrro
osmmsrrrro
osmnsrrrro
oqmmsrrrqo
..oosroo..
....oo....
""")
_coil0 = rows("""
ojihgo
ohggfo
ojihgo
ohggfo
ojihgo
ohggfo
ojihgo
ohggfo
ojihgo
.oggo.
""")
_hub0 = rows("""
....oooo....
..oonppnoo..
onppnnnnmmlo
onnnnKKnnmlo
.ommnnnnmllo
..oollllloo.
....oooooo..
""")
_emit0_se = rows("""
oo........
nmoo......
oonmoo....
..oonmooo.
....oonpno
.....onnmo
.....olmlo
......ooo.
""")
_emit0_nw = rows("""
.ooo......
onpnoo....
onnmmmoo..
olmlonmoo.
.ooo.oonmo
.......ooo
""")
T[0, 2] = dict(
    se=[['head', _batt0, 11, 16], ['head', _coil0, 13, 9], ['head', _hub0, 10, 4], ['gun', _emit0_se, 17, 10]],
    nw=[['gun', _emit0_nw, 5, 8], ['head', _batt0, 11, 16], ['head', _coil0, 13, 9], ['head', _hub0, 10, 4]],
    muzzle={'se': (26, 14), 'nw': (6, 9)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', pal={'metal': (196, 118, 62), 'acc': (170, 172, 176), 'mat3': (66, 64, 72)})

# ---- era 0 mortar: a manhole cover for a base plate, sandbags, a pipe for a tube on rebar legs
_plate0 = rows("""
....oooooo....
..oodeeeedoo..
.odeddddddedo.
odedbdbdbdbdco
ocdddddddddcbo
.occddddddcbo.
..oaccccbbaoo.
....oooooo....
""")
_bag0 = rows("""
.oooo.
ottuto
osstro
.oooo.
""")
_tube0_se = rows("""
......oooo
.....oijjio
.....oiKKgo
.....ojhhgo
....oihhhgo
....oihhhgo
...omnnnlo.
...oihhhgo.
..oihhhgo..
..oihhhgo..
.oihhhgo...
.oihhhgfo..
..ooooooo..
""")
_legs0_se = rows("""
....fo.
...f..f
...f..f
..f....f
..f....f
.ff....ff
""")
_tube0_nw = rows("""
...oooo...
..ojjiiho.
..oiihhgo.
..oihhhgo.
..oihhhgo.
..oihhhgo.
..omnnnlo.
...oihhhgo
...oihhhgo
...oihhhgo
...oihhhgo
....oihhhgo
....ojhhhgfo
.....oooooo.
""")
_legs0_nw = rows("""
..fo...
.f..f..
.f...f.
f.....f
f.....f
""")
T[0, 3] = dict(
    se=[['head', _plate0, 9, 20], ['head', _bag0, 18, 20], ['gun', _tube0_se, 11, 10], ['head', _legs0_se, 15, 18], ['head', _bag0, 9, 23]],
    nw=[['head', _legs0_nw, 9, 17], ['head', _plate0, 9, 20], ['head', _bag0, 18, 20], ['gun', _tube0_nw, 9, 8], ['head', _bag0, 9, 23]],
    muzzle={'se': (19, 11), 'nw': (14, 9)}, axis={'se': (1, -2), 'nw': (-1, -3)}, recoil={'se': (-1, 1), 'nw': (1, 1)},
    fx='blast', pal={'metal': (92, 94, 104), 'mat3': (190, 166, 116)})


# ================================================================ the machine cannons of grades 1-7
# the same build as the scrap one (a receiver, two long barrels along its top edges, something hung on each side,
# something on top), every part redrawn for its grade
_recv1_se = rows("""
....oo....
..ooddoo..
oedddddddo
oceeddddbo
occceebbbo
ommmmbbbbo
occccbbbbo
occccbbebo
oacccbbbao
..oocboo..
....oo....
""")
_recv1_nw = rows("""
....oo....
..ooddoo..
oedddddddo
oceeddddbo
occceebbbo
ommmmbaaao
occccbaeao
occccbaaao
oacccbbbao
..oocboo..
....oo....
""")
_box1 = rows("""
..oo.....
oottoo...
osuuttoo.
osssuutto
osssssuro
ommmmmmro
ossssssro
oqsssssro
..oosssro
....oosro
......oo.
""")
_lamp1_se = rows("""
..ooo...
.ojjio..
ojiihoo.
oiihhGGo
ohhggGHo
.ogffHo.
..oooo..
""")
_lamp1_nw = rows("""
..ooo...
.ojjio..
ojiihoo.
oiihhggo
ohhgggfo
.ogfffo.
..oooo..
""")
T[1, 0] = dict(
    se=[['head', _recv1_se, 11, 16], ['gun', _bar0_se, 14, 13], ['head', _lamp1_se, 12, 11], ['head', _box1, 7, 19], ['gun', _bar0_se, 9, 15]],
    nw=[['head', _recv1_nw, 11, 16], ['head', _box1, 7, 19], ['gun', _bar0_nw, 6, 10], ['head', _lamp1_nw, 14, 11], ['gun', _bar0_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2')

# military: olive with rivets and a blue band, ammo cans, flash hiders, a ring sight on a post
_recv2_se = rows("""
....oo....
..ooddoo..
oeddeddddo
oceeddddbo
occceebbbo
ocecebbebo
ommmmlllbo
occccbbbbo
oacccbbbao
..oocboo..
....oo....
""")
_recv2_nw = rows("""
....oo....
..ooddoo..
oedddddedo
oceeddddbo
occceebbbo
ocecebaaao
ommmmlaKao
occccbaaao
oacccbbbao
..oocboo..
....oo....
""")
_can2 = rows("""
..oo.....
ooffoo...
osttffoo.
osssttffo
osssssttro
osnnnnsro
osssssrro
oqsssssro
..oosssro
....oosro
......oo.
""")
_bar2_se = rows("""
.oo...............
ojjoo.............
ohhiijjoo.........
.oohhiijjoo.......
...oohhiijjoo.....
.....oohhiijjoo...
.......oohhiijjooo
.........oohhijfjo
...........oohfKfo
.............oooo.
""")
_bar2_nw = rows("""
ooo.............
ojfjoo..........
ofKfiijoo.......
.oohhiijjoo.....
...oohhiijjoo...
.....oohhiijjoo.
.......oohhiijjo
.........oohhiio
...........oooo.
""")
_sight2 = rows("""
..ooo..
.o...o.
o..h..o
o.hhh.o
o..h..o
.o...o.
..ooo..
...h...
...h...
""")
T[2, 0] = dict(
    se=[['head', _recv2_se, 11, 16], ['gun', _bar2_se, 14, 13], ['head', _sight2, 13, 8], ['head', _can2, 7, 19], ['gun', _bar2_se, 9, 15]],
    nw=[['head', _recv2_nw, 11, 16], ['head', _can2, 7, 19], ['gun', _bar2_nw, 6, 10], ['head', _sight2, 13, 8], ['gun', _bar2_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2')

# special forces: black, purple lights, a tan pouch, barrels in perforated shrouds, an optic with a purple lens
_recv3_se = rows("""
....oo....
..ooddoo..
oedddddddo
oceeddddbo
occceebbbo
occccbbbbo
ocpccbbpbo
occccbbbbo
oacccbbbao
..oocboo..
....oo....
""")
_recv3_nw = rows("""
....oo....
..ooddoo..
oedddddddo
oceeddddbo
occceebbbo
occccbaaao
ocpccbapao
occccbaaao
oacccbbbao
..oocboo..
....oo....
""")
_pouch3 = rows("""
..oo.....
oottoo...
osuuttoo.
osssuutto
oslsssuro
osmsssrro
oslsssrro
oqmsssrro
..olssrro
....oosro
......oo.
""")
_bar3_se = rows("""
.ooo..............
ojjjoo............
ohKhiijoo.........
ohhiKiijjoo.......
.oohhiKiijjoo.....
...oohhiiKijjoo...
.....oohhiiijjoo..
.......oohhhiijjo.
.........oohhiijjo
...........oohgKo.
.............ooo..
""")
_bar3_nw = rows("""
.oo.............
ojjoo...........
ohKjjjoo........
.oohKiijjoo.....
...oohhKiijjoo..
.....oohhiKijjoo
.......oohhiiijj
.........oohhiii
...........oohhh
""")
_optic3_se = rows("""
..oooo..
.oddddo.
oddddboo
occccbpo
occccbno
.oooooo.
""")
_optic3_nw = rows("""
..oooo..
.oddddo.
oodddddo
ocbbbbbo
ocbbbbbo
.oooooo.
""")
T[3, 0] = dict(
    se=[['head', _recv3_se, 11, 16], ['gun', _bar3_se, 14, 12], ['head', _optic3_se, 12, 11], ['head', _pouch3, 7, 19], ['gun', _bar3_se, 9, 14]],
    nw=[['head', _recv3_nw, 11, 16], ['head', _pouch3, 7, 19], ['gun', _bar3_nw, 6, 10], ['head', _optic3_nw, 13, 11], ['gun', _bar3_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2')

# experimental: a rounded lab-white body with glowing vents, a glass cell of glowing fuel, coil rings round the barrels
_recv4_se = rows("""
....oo....
..oeddeo..
.oedddddo.
oeddddddbo
oceeddddbo
occceebbbo
ocHJcbJHbo
occccbbbbo
.occcbbbo.
..oocboo..
....oo....
""")
_recv4_nw = rows("""
....oo....
..oeddeo..
.oedddddo.
oeddddddbo
oceeddddbo
occceebbbo
ocHJcbJHbo
occccbbbbo
.occcbbbo.
..oocboo..
....oo....
""")
_cell4 = rows("""
..oooo..
.ohhhgo.
offffffo
oGHHHJfo
oGHHJJfo
oHGHJJfo
oGHHJJfo
oHHJJJfo
offffffo
.ohhhgo.
..oooo..
""")
_bar4_se = rows("""
.oo...............
oddoo.............
occddoo...........
.ooccddoo.........
...oGcHddoo.......
....oHcHddjoo.....
.....ooccddiijoo..
.......oocGcHijjo.
.........oHcHhgKo.
..........ooooooo.
""")
_bar4_nw = rows("""
.oo.............
oddoo...........
occGHoo.........
.oHcHddoo.......
...ooccddoo.....
.....oGcHddoo...
......oHcHddddo.
.......ooccddcc.
.........oooocc.
""")
_dome4 = rows("""
..ooo..
.oGGHo.
oGGHHJo
oHHHJJo
.ooooo.
""")
T[4, 0] = dict(
    se=[['head', _recv4_se, 11, 16], ['gun', _bar4_se, 14, 13], ['head', _dome4, 13, 12], ['head', _cell4, 8, 18], ['gun', _bar4_se, 9, 15]],
    nw=[['head', _recv4_nw, 11, 16], ['head', _cell4, 8, 18], ['gun', _bar4_nw, 6, 10], ['head', _dome4, 14, 12], ['gun', _bar4_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2', fixed={'F': [255, 250, 220], 'Y': [255, 206, 120], 'O': [255, 150, 50]})

# unknown tech: an obsidian body hovering over the ring on a red glow, red seams, twin rails, a red crystal and orb
_recv5_se = rows("""
....oo....
..ooddoo..
oeddHdddbo
oceeddHdbo
occHeebbbo
occcHbbbbo
occccHbbbo
occccbHbbo
oacccbbHao
..oocboo..
....oo....
""")
_recv5_nw = rows("""
....oo....
..ooddoo..
obdddHddeo
obdHddddbo
occceeHbbo
occccbbHbo
occccbbbHo
occcHbbbbo
oaccHbbbao
..oocboo..
....oo....
""")
_hover5 = rows("""
..JHHHHJ..
....JJ....
""")
_crys5 = rows("""
...o...
..oHo..
.oHGJo.
oHGHJJo
.oHJJo.
..oJo..
...o...
""")
_bar5_se = rows("""
.oo...............
oiioo.............
ohHHiioo..........
.oohhHHiioo.......
...oohhHHiioo.....
.....oohhHHiioo...
.......oohhHHiioo.
.........oohhHHiio
...........oohhGJo
.............oooo.
""")
_bar5_nw = rows("""
.oo.............
oiioo...........
oGHHiioo........
.oohhHHiioo.....
...oohhHHiioo...
.....oohhHHiioo.
.......oohhHHiio
.........oohhHHo
...........oooo.
""")
_orb5 = rows("""
.ooo.
oHGHo
oJHHo
.ooo.
""")
T[5, 0] = dict(
    se=[['head', _hover5, 11, 26], ['head', _recv5_se, 11, 14], ['gun', _bar5_se, 14, 11], ['head', _orb5, 14, 6], ['head', _crys5, 5, 16], ['gun', _bar5_se, 9, 13]],
    nw=[['head', _hover5, 11, 26], ['head', _recv5_nw, 11, 14], ['head', _crys5, 5, 16], ['gun', _bar5_nw, 6, 8], ['head', _orb5, 15, 6], ['gun', _bar5_nw, 2, 11]],
    muzzle={'se': (28, 21), 'nw': (3, 10)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2', fixed={'F': [255, 230, 220], 'Y': [255, 140, 120], 'O': [230, 60, 60]})

# mythic: gold engraved with a ruby, an ivory chest with gold bands, gold barrels with flared bell mouths, a crest
_recv6_se = rows("""
....oo....
..ooddoo..
oeddeddddo
oceeddeebo
occceebbbo
ocpcpbbbbo
occccbRbbo
ocpcpbrbbo
oacccbbbao
..oocboo..
....oo....
""")
_recv6_nw = rows("""
....oo....
..ooddoo..
oeddeddddo
oceeddeebo
occceebbbo
ocpcpbbbbo
occccbRbbo
ocpcpbrbbo
oacccbbbao
..oocboo..
....oo....
""")
_chest6 = rows("""
..oo.....
oottoo...
osuuttoo.
onnnnuuto
osssnnnro
osssssnro
oRsssssro
oqsssssro
..oosssro
....oosro
......oo.
""")
_bar6_se = rows("""
.oo................
ojjoo..............
ohhiijjoo..........
.oohhiijjoo........
...oohhiijjoo......
.....oohhnnjjoo....
.......oohhiijjooo.
.........oohhiijjjo
..........ohhiigKKo
...........oohgKKoo
.............oooo..
""")
_bar6_nw = rows("""
.ooo............
ojjjoo..........
ojiijjjoo.......
ohhiijjjjoo.....
.oohhiinnjjoo...
...oohhiijjjjoo.
.....oohhiijjjjo
.......oohhiiiio
.........oooooo.
""")
_crest6 = rows("""
.o.o.o.
onpnpno
.onnno.
..opo..
""")
T[6, 0] = dict(
    se=[['head', _recv6_se, 11, 16], ['gun', _bar6_se, 14, 13], ['head', _crest6, 13, 12], ['head', _chest6, 7, 19], ['gun', _bar6_se, 9, 15]],
    nw=[['head', _recv6_nw, 11, 16], ['head', _chest6, 7, 19], ['gun', _bar6_nw, 6, 10], ['head', _crest6, 14, 12], ['gun', _bar6_nw, 2, 13]],
    muzzle={'se': (29, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2', pal={'metal': (238, 196, 84)})

# eternal: cosmic indigo with stars, pearl crystal barrels with rainbow glints, a floating shard and a star
_recv7_se = rows("""
....oo....
..ooddoo..
oedXddddbo
oceeddXdbo
occceebbbo
ocXccbbbbo
occccbbXbo
occXcbbbbo
oacccbbbao
..oocboo..
....oo....
""")
_recv7_nw = rows("""
....oo....
..ooddoo..
oeddddXdbo
oceXddddbo
occceebbbo
occccbXbbo
ocXccbbbbo
occccbbbXo
oacccbbbao
..oocboo..
....oo....
""")
_shard7 = rows("""
...o...
..ojo..
.oij3o.
oiij45o
.oh56o.
..o6o..
...o...
""")
_bar7_se = rows("""
.oo...............
ojjoo.............
ohhiijjoo.........
.oohh2ijjoo.......
...oohhiij3oo.....
.....oohh4ijjoo...
.......oohhiij5oo.
.........oohhiijjo
...........oohh6Ko
.............oooo.
""")
_bar7_nw = rows("""
.oo.............
oj1oo...........
ohhiijjoo.......
.oohh2ijjoo.....
...oohhiij3oo...
.....oohh4ijjoo.
.......oohhiij5o
.........oohhiio
...........oooo.
""")
_star7 = rows("""
...X...
...G...
.XGGGX.
XGGGGGX
.XGGGX.
...G...
...X...
""")
T[7, 0] = dict(
    se=[['head', _recv7_se, 11, 16], ['gun', _bar7_se, 14, 13], ['head', _star7, 13, 6], ['head', _shard7, 5, 16], ['gun', _bar7_se, 9, 15]],
    nw=[['head', _recv7_nw, 11, 16], ['head', _shard7, 5, 16], ['gun', _bar7_nw, 6, 10], ['head', _star7, 14, 6], ['gun', _bar7_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2', fixed={'F': [255, 255, 255], 'Y': [200, 236, 255], 'O': [230, 150, 255]})


# ================================================================ the sprayers of grades 1-7 (fire on even grades, frost on odd)
# a platform, a tank standing at the back, a hose, a nozzle reaching forward
_cyl = rows("""
..oooo..
.ouutto.
otuuttso
otuttsro
otuttsro
omnmmllo
otuttsro
otuttsro
otuttsro
otuttsro
otuttsro
otuttsro
oqtttsrq
.orrrro.
..oooo..
""")
_valve = rows("""
.oo.
ohgo
.oo.
""")
_horn1_se = rows("""
oo..........
ihoo........
hhiioo......
oohhiioo....
..oohhiioo..
....oohhiiooo
......oohhiio
.......ohhgKKo
.......ohgKKKo
........oogKKo
..........oooo
""")
_horn1_nw = rows("""
oooo..........
oKKgoo........
oKKKghoo......
oKKghhiioo....
.oiihhiiiioo..
..oooohhiioo..
......oohhiioo
........oohhii
..........oohh
""")
T[1, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _cyl, 10, 7], ['head', _valve, 12, 5], ['head', _hose0_se, 16, 20], ['gun', _horn1_se, 15, 17]],
    nw=[['gun', _horn1_nw, 2, 11], ['head', _plat0, 9, 18], ['head', _cyl, 14, 9], ['head', _valve, 16, 7]],
    muzzle={'se': (29, 25), 'nw': (2, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='frost', pal={'mat3': (220, 230, 238)})

# military flamethrower: two olive fuel tanks, a long nozzle in a perforated heat shield, a blue band
_noz2_se = rows("""
oo............
ihoo..........
hhiioo........
oohhiioo......
..oohhiooo....
....oohiKiooo.
......ohKiKiio
.......ooiKiKio
.........ooiijo
..........ohgKo
...........ooo.
""")
_noz2_nw = rows("""
.oo...........
ojjoo.........
oigKiooo......
.oKiKiKioo....
..ooiKiKiioo..
....ooiiiiioo.
......oohhiioo
........oohhii
..........oohh
""")
T[2, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _cyl, 13, 5], ['head', _cyl, 9, 7], ['head', _hose0_se, 16, 20], ['gun', _noz2_se, 15, 16]],
    nw=[['gun', _noz2_nw, 2, 12], ['head', _plat0, 9, 18], ['head', _cyl, 16, 7], ['head', _cyl, 12, 9]],
    muzzle={'se': (28, 26), 'nw': (2, 13)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='flame', pal={'mat3': (118, 130, 84)})

# special forces cryo sprayer: a black canister with a window of blue coolant behind a purple frame, an angular nozzle
_cryo3 = rows("""
..oooooo..
.offffffo.
offffffffo
oiihhhhggo
oinnnnnngo
oinBBLBngo
oinBBBBngo
oinBNBBngo
oinNNBBngo
oinnnnnngo
oiihhhhggo
oiihhhhggo
.offffffo.
..oooooo..
""")
_noz3_se = rows("""
oo..........
ihoo........
hhiioo......
oohhiioo....
..oohhiioo..
....oohhiiLo
......oohhLCo
........ooCBo
..........oo.
""")
_noz3_nw = rows("""
.oo.........
oLLoo.......
oCLiiioo....
.ooBhiiioo..
...oohhiiioo
.....oohhiio
.......oohhi
""")
T[3, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _cryo3, 9, 7], ['head', _hose0_se, 16, 20], ['gun', _noz3_se, 17, 19]],
    nw=[['gun', _noz3_nw, 3, 13], ['head', _plat0, 9, 18], ['head', _cryo3, 13, 9]],
    muzzle={'se': (28, 26), 'nw': (3, 14)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='frost')

# experimental plasma flamer: a glass tank of glowing fuel in a white frame, a finned nozzle with glowing rings
_glass4 = rows("""
..oooooo..
.oddddddo.
occcccbbbo
ohGHHHJJfo
ohGGHHJJfo
ohHGHHJJfo
ohGHHHJJfo
ohHHHJJJfo
ohGHHJJJfo
ohHHJJJJfo
occcccbbbo
occcccbbbo
.oaaaaaao.
..oooooo..
""")
_noz4_se = rows("""
oo...........
dcoo.........
ccddoo.......
oocHddoo.....
..oHccddoo...
...ooccdHdoo.
.....oocHccdoo
.......ooccGHo
.........oHcKo
..........ooo.
""")
_noz4_nw = rows("""
.oo..........
oHGoo........
oHccddoo.....
.oocHddddoo..
...oHcHddddoo
....ooccddddo
......oocccdd
........oocc.
""")
T[4, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _glass4, 9, 7], ['head', _hose0_se, 16, 20], ['gun', _noz4_se, 17, 18]],
    nw=[['gun', _noz4_nw, 3, 12], ['head', _plat0, 9, 18], ['head', _glass4, 13, 9]],
    muzzle={'se': (29, 26), 'nw': (3, 13)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='flame', fixed={'F': [255, 255, 236], 'Y': [255, 236, 170], 'O': [255, 168, 64], 'R': [240, 104, 40], 'D': [176, 70, 40]})

# unknown frost: a cyan crystal held floating in a red ring of light over the platform, a silver nozzle glowing cold
_ring5 = rows("""
..oHHo..
.oJ..Jo.
oH....Ho
oJ....Jo
.oH..Ho.
..oJJo..
""")
_icecrys5 = rows("""
...oo...
..oLLo..
.oLLCBo.
oLLCCBNo
oLCCBBNo
.oCBBNo.
..oBNo..
...oo...
""")
_noz5_se = rows("""
oo..........
iioo........
hhjjoo......
oohhiioo....
..oohhiioo..
....oohhiiCo
......oohhLCo
........ooCBo
..........oo.
""")
_noz5_nw = rows("""
.oo.........
oLCoo.......
oCLiioo.....
.ooBhiiioo..
...oohhiiioo
.....oohhiio
.......oohhi
""")
T[5, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _icecrys5, 11, 8], ['head', _ring5, 11, 9], ['head', _hose0_se, 16, 20], ['gun', _noz5_se, 17, 19]],
    nw=[['gun', _noz5_nw, 3, 13], ['head', _plat0, 9, 18], ['head', _icecrys5, 14, 10], ['head', _ring5, 14, 11]],
    muzzle={'se': (28, 26), 'nw': (3, 14)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='frost')

# mythic flamethrower: an ivory urn with gold bands and a ruby, the nozzle ends in a golden dragon's head
_urn6 = rows("""
..oooooo..
.onnppnno.
..oommoo..
.ottuutso.
otuuuttsro
onnnnnmmlo
otuRRttsro
otuttttsro
otuttttsro
onnnnnmmlo
.otutttso.
..ottsso..
.onnnmmlo.
..oooooo..
""")
_drag6_se = rows("""
oo.............
ijoo...........
hhiioo.........
oohhiioo.......
..oohhiiooo....
....oohhinnoo..
......oohnnpnoo
.......onnRnnmo
.......omnnoKKo
........omlKKo.
.........oooo..
""")
_drag6_nw = rows("""
...ooo........
.oonnno.......
onnRnnmoo.....
omnnnmmiioo...
.oommhhiiiioo.
....oohhiiiioo
......oohhiiio
........oohhii
..........oohh
""")
T[6, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _urn6, 9, 7], ['head', _hose0_se, 16, 20], ['gun', _drag6_se, 14, 17]],
    nw=[['gun', _drag6_nw, 2, 12], ['head', _plat0, 9, 18], ['head', _urn6, 13, 9]],
    muzzle={'se': (28, 25), 'nw': (2, 13)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='flame', fixed={'F': [255, 252, 220], 'Y': [255, 230, 110], 'O': [255, 190, 50], 'R': [230, 120, 30], 'D': [170, 80, 30]},
    pal={'metal': (238, 196, 84)})

# eternal frost: a pearl crystal tank with rainbow light, a crystal nozzle ending in a star
_prism7 = rows("""
....oo....
...ojjo...
..ojj1io..
.ojji2iho.
ojjii3ihho
ojii4iihho
ojii5ihhgo
.oi6iihho.
..oiihho..
...ohho...
....oo....
""")
_noz7_se = rows("""
oo...........
jioo.........
hhiioo.......
oohhiioo.....
..oohhiioo...
....oohhiiXo.
......oohhXXX
........ooXo.
""")
_noz7_nw = rows("""
.X...........
XXXoo........
.Xhiiioo.....
.oohhiiioo...
...oohhiiioo.
.....oohhiioo
.......oohhii
""")
T[7, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _prism7, 9, 6], ['head', _hose0_se, 16, 20], ['gun', _noz7_se, 17, 19]],
    nw=[['gun', _noz7_nw, 3, 13], ['head', _plat0, 9, 18], ['head', _prism7, 13, 8]],
    muzzle={'se': (28, 26), 'nw': (3, 14)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='frost', fixed={'L': [255, 255, 255], 'C': [214, 236, 255], 'B': [200, 160, 255], 'N': [150, 110, 230]})


# ================================================================ the electric coils of grades 1-7
# a base box (the grade's receiver), a wound column, a crown on top, an emitter reaching out the way it faces
_coil1 = rows("""
ommmlo
ojihgo
ohggfo
oWWWco
ojihgo
ohggfo
oWWWco
ojihgo
ohggfo
.ommo.
""")
_ball1 = rows("""
...oooo...
..oiijjo..
.oijjjhgo.
oiijjhhggo
ohiihhhgfo
ohhhhggffo
.ohgggffo.
..oooooo..
""")
_emit1_se = rows("""
oo........
hgoo......
oohgoo....
..oohgooo.
....oojjho
.....ojhgo
.....ohgfo
......ooo.
""")
_emit1_nw = rows("""
.ooo......
ojjhoo....
ojhggfoo..
ohgfohgoo.
.ooo.oohgo
.......ooo
""")
T[1, 2] = dict(
    se=[['head', _recv1_se, 11, 16], ['head', _coil1, 13, 9], ['head', _ball1, 11, 3], ['gun', _emit1_se, 17, 10]],
    nw=[['gun', _emit1_nw, 5, 8], ['head', _recv1_nw, 11, 16], ['head', _coil1, 13, 9], ['head', _ball1, 11, 3]],
    muzzle={'se': (26, 14), 'nw': (6, 9)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', pal={'metal': (196, 118, 62)}, fixed={'W': [236, 234, 226]})

# military: the coil caged in bars, an olive crown with blue lamps, a two-pronged emitter
_coil2 = rows("""
offffo
ofihfo
ofggfo
ofihfo
ofggfo
ofihfo
ofggfo
ofihfo
ofggfo
.offo.
""")
_hub2 = rows("""
....oooo....
..oodddeoo..
odeedddddcbo
olmddKKddbbo
.occlmmlbbbo
..oobbbbboo.
....oooooo..
""")
_emit2_se = rows("""
oo..........
ccoo........
oobcoo......
..oobcoo..o.
....oobcooco
.....obbcoo.
......obcoo.
.......oocbo
.........oo.
""")
_emit2_nw = rows("""
.o..........
ocoo........
.oocboo.....
.ocooobcoo..
ocboo.oobcoo
.oo.....oobc
""")
T[2, 2] = dict(
    se=[['head', _recv2_se, 11, 16], ['head', _coil2, 13, 9], ['head', _hub2, 10, 4], ['gun', _emit2_se, 17, 10]],
    nw=[['gun', _emit2_nw, 5, 7], ['head', _recv2_nw, 11, 16], ['head', _coil2, 13, 9], ['head', _hub2, 10, 4]],
    muzzle={'se': (27, 14), 'nw': (5, 8)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', pal={'metal': (190, 112, 60)})

# special forces: a dark coil banded with purple light, a black crown with purple lamps, an angled blade emitter
_coil3 = rows("""
oppnlo
ohggfo
ofggfo
onnmlo
ohggfo
ofggfo
onnmlo
ohggfo
ofggfo
.oppo.
""")
_hub3 = rows("""
....oooo....
..oodddeoo..
odpddddddpbo
oddddKKddbbo
.ocpcccbbpbo
..oobbbbboo.
....oooooo..
""")
_emit3_se = rows("""
oo.........
dcoo.......
oodcoo.....
..oodcoo...
....oodcoo.
.....odccpo
......oonpo
........oo.
""")
_emit3_nw = rows("""
..oo.......
.opnoo.....
opccdcoo...
.oooodcoo..
.....oodcoo
.......oodc
""")
T[3, 2] = dict(
    se=[['head', _recv3_se, 11, 16], ['head', _coil3, 13, 9], ['head', _hub3, 10, 4], ['gun', _emit3_se, 17, 10]],
    nw=[['gun', _emit3_nw, 5, 8], ['head', _recv3_nw, 11, 16], ['head', _coil3, 13, 9], ['head', _hub3, 10, 4]],
    muzzle={'se': (27, 15), 'nw': (5, 9)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', fixed={'A': [255, 246, 255], 'Z': [214, 160, 255], 'V': [130, 70, 210]})

# experimental: a glass column with a glowing coil inside, a white crown ringed with light, a glowing tip
_coil4 = rows("""
oddcco
oGHJbo
oHGHbo
oGHJbo
oHGHbo
oGHJbo
oHGHbo
oGHJbo
oddcco
.occo.
""")
_hub4 = rows("""
....oooo....
..oodddeoo..
oddeeddddcbo
oHHddKKddJJo
.occHHJJbbbo
..oobbbbboo.
....oooooo..
""")
_emit4_se = rows("""
oo........
dcoo......
oodcoo....
..oodcooo.
....ooGHHo
.....oGGHo
.....oHHJo
......ooo.
""")
_emit4_nw = rows("""
.ooo......
oGHHoo....
oGGHccoo..
oHHJodcoo.
.ooo.oodco
.......ooo
""")
T[4, 2] = dict(
    se=[['head', _recv4_se, 11, 16], ['head', _coil4, 13, 9], ['head', _hub4, 10, 4], ['gun', _emit4_se, 17, 10]],
    nw=[['gun', _emit4_nw, 5, 8], ['head', _recv4_nw, 11, 16], ['head', _coil4, 13, 9], ['head', _hub4, 10, 4]],
    muzzle={'se': (26, 14), 'nw': (6, 9)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', fixed={'A': [255, 250, 230], 'Z': [255, 200, 110], 'V': [240, 120, 40]})

# unknown: three rings of red light floating one above the other round a dark core, a red orb, a floating shard
_rings5 = rows("""
.oHHHHo.
oJ....Jo
.oJJJJo.
..oddo..
.oHHHHo.
oJ.dc.Jo
.oJJJJo.
..oddo..
.oHHHHo.
oJ.dc.Jo
.oJJJJo.
""")
_orb5b = rows("""
...oooo...
..oHGGHo..
.oHGGGHJo.
.oHGHHJJo.
.oJHHJJJo.
..oJJJJo..
...oooo...
""")
_shard5_se = rows("""
...........
...........
.......oo..
......oHGo.
.....oHGJo.
....oHJJo..
.....ooo...
""")
_shard5_nw = rows("""
.oo........
oGHo.......
oHGHo......
.oJJHo.....
..ooo......
""")
T[5, 2] = dict(
    se=[['head', _hover5, 11, 26], ['head', _recv5_se, 11, 14], ['head', _rings5, 12, 3], ['head', _orb5b, 10, -2 + 2], ['gun', _shard5_se, 17, 8]],
    nw=[['gun', _shard5_nw, 4, 8], ['head', _hover5, 11, 26], ['head', _recv5_nw, 11, 14], ['head', _rings5, 12, 3], ['head', _orb5b, 10, 0]],
    muzzle={'se': (26, 13), 'nw': (5, 9)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', fixed={'A': [255, 236, 230], 'Z': [255, 110, 96], 'V': [190, 40, 60]})

# mythic: a gold coil between ivory discs, a crown with points, a golden trident
_coil6 = rows("""
ottsso
ojihgo
ohggfo
ottsso
ojihgo
ohggfo
ottsso
ojihgo
ohggfo
.osso.
""")
_crown6 = rows("""
.o..o..o..o.
odo.od.do.do
odeodeedoebo
oddddRRdddbo
.occcmmcbbbo
..oobbbbboo.
....oooooo..
""")
_trid6_se = rows("""
oo..........
jioo........
oojioo..oo..
..oojiooio..
....ooiijioo
.....oiiijjo
......ooojio
........ooio
..........oo
""")
_trid6_nw = rows("""
oo..........
oio.oo......
.oijio......
..oijjiio...
..oiooojiio.
..oo...oojio
.........ooj
""")
T[6, 2] = dict(
    se=[['head', _recv6_se, 11, 16], ['head', _coil6, 13, 9], ['head', _crown6, 10, 4], ['gun', _trid6_se, 17, 9]],
    nw=[['gun', _trid6_nw, 4, 7], ['head', _recv6_nw, 11, 16], ['head', _coil6, 13, 9], ['head', _crown6, 10, 4]],
    muzzle={'se': (28, 17), 'nw': (4, 7)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', pal={'metal': (238, 196, 84)}, fixed={'A': [255, 255, 236], 'Z': [255, 226, 120], 'V': [214, 162, 32]})

# eternal: a pearl crystal column with rainbow light, a star orb in a halo, a crystal rod tipped with a star
_column7 = rows("""
.ojjo.
oj1iho
oji2ho
oj3iho
oji4ho
oj5iho
oji6ho
ojiiho
ojiigo
.oggo.
""")
_halo7 = rows("""
....1122....
..66....33..
.6...XX...3.
.5..XGGX..4.
..55.XX.44..
....5544....
""")
_emit7_se = rows("""
oo.........
jioo.......
oojioo.....
..oojioo...
....oojiX..
......oXGX.
.......XGGX
........XX.
""")
_emit7_nw = rows("""
.XX........
XGGX.......
.XGXoo.....
..Xijioo...
....oojioo.
......oojio
""")
T[7, 2] = dict(
    se=[['head', _recv7_se, 11, 16], ['head', _column7, 13, 9], ['head', _halo7, 10, 3], ['gun', _emit7_se, 17, 10]],
    nw=[['gun', _emit7_nw, 4, 7], ['head', _recv7_nw, 11, 16], ['head', _column7, 13, 9], ['head', _halo7, 10, 3]],
    muzzle={'se': (26, 15), 'nw': (5, 8)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', fixed={'A': [255, 255, 255], 'Z': [190, 236, 255], 'V': [230, 140, 255]})


# ================================================================ mortars (even grades) and rocket pods (odd grades), 1-7
# a rocket pod: a long box on a short yoke, the rockets' noses sticking out of its front end (se: down-right,
# nw: up-left, so the way it points reads from any side); the back shows the nozzles
_pod_se = rows("""
....oo.........
..ooddoo.......
oodddddddoo....
oceeddddddoo...
occceeddddddoo.
occccceeddddddo
occccccceeddddo
ocpcccccccebbbo
oacccccccccbbbo
..oocccccccbbbo
....ooccccc bbbo
......oocccbbbo
........oocboo.
..........oo...
""".replace(' ', ''))
_pod_nw = rows("""
....oo.........
..ooddoo.......
oodddddddoo....
oceeddddddoo...
occceedddddddo.
occccceeddddddo
occccccceeddddo
ocpcccccccebbbo
oacccccccccbKbo
..oocccccccbKbo
....oocccccKbbo
......ooccc bbbo
........oocboo.
..........oo...
""".replace(' ', ''))
_nose_se = rows("""
.oo..
oWRoo
oRRRo
.oooo
""")
_nose_nw = rows("""
oo..
oRRo
oRWo
.oo.
""")
_yoke = rows("""
..oooo..
.offffo.
ofhhhgfo
ofhhggfo
.offffo.
""")


def _pod(rs, letters, over=()):
    """the pod in another material (body letters -> letters), with details laid over it [(rows, x, y)]"""
    out = [r.translate(str.maketrans('abcde', letters)) for r in rs]
    cv = [list(r) for r in out]
    for orows, ox, oy in over:
        for j, r in enumerate(orows):
            for i, ch in enumerate(r):
                if ch != '.':
                    cv[oy + j][ox + i] = ch
    return [''.join(r) for r in cv]


def _rockets(g, pod_se, pod_nw, extra_se=(), extra_nw=(), **kw):
    T[g, 3] = dict(
        se=[['head', _yoke, 12, 19], ['head', pod_se, 9, 11], ['gun', _nose_se, 21, 17], ['gun', _nose_se, 22, 20]] + list(extra_se),
        nw=[['gun', _nose_nw, 8, 9], ['gun', _nose_nw, 10, 11], ['head', _yoke, 12, 19], ['head', pod_nw, 9, 11]] + list(extra_nw),
        muzzle={'se': (25, 19), 'nw': (8, 10)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
        fx='rocket', **kw)


# civilian: a walnut crate of fireworks with a green band, red and green paper caps
_rockets(1, _pod(_pod_se, 'qrstu', [(['m', 'm', 'm', 'm'], 1, 5), (rows("""
.mm
mmm
"""), 3, 6), (rows("""
..mmmmmm
mmmmmm..
"""), 4, 7)]), _pod(_pod_nw, 'qrstu', [(['m', 'm', 'm', 'm'], 1, 5), (rows("""
.mm
mmm
"""), 3, 6), (rows("""
..mmmmmm
mmmmmm..
"""), 4, 7)]), fixed={'R': [222, 84, 56], 'W': [138, 212, 110]})
# military mortar: an olive tube with a blue-marked sight, steel legs, a steel base plate, ammo crates
_sightbox2 = rows("""
.ooo.
ojnlo
ohmmo
.ooo.
""")
T[2, 3] = dict(
    se=[['head', _plate0, 9, 20], ['head', _can2, 17, 19], ['gun', _tube0_se, 11, 10], ['head', _sightbox2, 10, 15], ['head', _legs0_se, 15, 18]],
    nw=[['head', _legs0_nw, 9, 17], ['head', _plate0, 9, 20], ['head', _can2, 17, 19], ['gun', _tube0_nw, 9, 8], ['head', _sightbox2, 15, 15]],
    muzzle={'se': (19, 11), 'nw': (14, 9)}, axis={'se': (1, -2), 'nw': (-1, -3)}, recoil={'se': (-1, 1), 'nw': (1, 1)},
    fx='blast', pal={'metal': (112, 124, 82), 'mat3': (118, 130, 84)})

# experimental mortar: a heavy white tube ringed with glowing accelerator coils, a white plate
_tube4_se = rows("""
......oooo
.....oijjio
.....oiKKgo
.....oHGHHo
....oihhhgo
....oHGHHJo
...oihhhgo.
...oHGHHJo.
..oihhhgo..
..oHGHHJo..
.oihhhgo...
.oihhhgfo..
..ooooooo..
""")
_tube4_nw = rows("""
...oooo...
..ojjiiho.
..oHGHHJo.
..oihhhgo.
..oHGHHJo.
..oihhhgo.
..oHGHHJo.
...oihhhgo
...oHGHHJo
...oihhhgo
...oihhhgo
....oihhhgo
....ojhhhgfo
.....oooooo.
""")
T[4, 3] = dict(
    se=[['head', _plate0, 9, 20], ['gun', _tube4_se, 11, 10], ['head', _legs0_se, 15, 18]],
    nw=[['head', _legs0_nw, 9, 17], ['head', _plate0, 9, 20], ['gun', _tube4_nw, 9, 8]],
    muzzle={'se': (19, 11), 'nw': (14, 9)}, axis={'se': (1, -2), 'nw': (-1, -3)}, recoil={'se': (-1, 1), 'nw': (1, 1)},
    fx='blast', pal={'metal': (226, 224, 216)}, fixed={'F': [255, 250, 220], 'Y': [255, 196, 96], 'O': [255, 150, 50]})

# mythic mortar: a gold ceremonial mortar with a flared bell mouth, ruby bands, on a gold plate
_tube6_se = rows("""
....oooooo
...ojjjjio
...oiKKKgo
....ojhhgo
....oihhgo
...omnRnlo
...oihhgo.
..oihhgo..
..omnRnlo.
.oihhgo...
.oihhhgo..
oiihhhggo.
.ooooooo..
""")
_tube6_nw = rows("""
.oooooo...
ojjjjiio..
ojiihhggo.
.oihhhgo..
.oihhhgo..
.omnRnlo..
..oihhgo..
..oihhgo..
..omnRnlo.
...oihhgo.
...oihhhgo
...oiihhhggo
....ooooooo.
""")
T[6, 3] = dict(
    se=[['head', _plate0, 9, 20], ['gun', _tube6_se, 12, 10], ['head', _bag0, 18, 20], ['head', _bag0, 9, 23]],
    nw=[['head', _plate0, 9, 20], ['gun', _tube6_nw, 10, 8], ['head', _bag0, 18, 20], ['head', _bag0, 9, 23]],
    muzzle={'se': (19, 10), 'nw': (14, 8)}, axis={'se': (1, -2), 'nw': (-1, -3)}, recoil={'se': (-1, 1), 'nw': (1, 1)},
    fx='blast', pal={'metal': (236, 194, 80), 'mat3': (236, 228, 206)},
    fixed={'S': [255, 246, 214], 'T': [236, 214, 160], 'F': [255, 252, 220], 'Y': [255, 230, 110], 'O': [255, 190, 50]})


# special forces: black, a purple stripe, a sensor eye on top
_rockets(3, _pod(_pod_se, 'abcde', [(rows("""
pp
.pp
..pp
"""), 2, 7)]), _pod(_pod_nw, 'abcde', [(rows("""
pp
.pp
..pp
"""), 2, 7)]), extra_se=[['head', rows("""
.oo.
opno
.oo.
"""), 12, 9]], extra_nw=[['head', rows("""
.oo.
opno
.oo.
"""), 13, 9]], fixed={'R': [214, 168, 248], 'W': [255, 236, 255]})

# unknown: obsidian with red seams, hovering on light, a red crystal floating beside it
_seams5 = [(rows("""
H.....
.H....
..H...
...HH.
"""), 3, 5)]
_rockets(5, _pod(_pod_se, 'abcde', _seams5), _pod(_pod_nw, 'abcde', _seams5),
         extra_se=[['head', _hover5, 11, 26], ['head', _crys5, 3, 13]], extra_nw=[['head', _hover5, 11, 26], ['head', _crys5, 3, 13]],
         fixed={'R': [255, 96, 80], 'W': [255, 214, 204], 'F': [255, 230, 220], 'Y': [255, 150, 130], 'O': [230, 70, 64]})

# eternal: indigo spangled with stars, crystal noses, a star above
_stars7 = [(rows("""
...X......
..........
X.....X...
..........
....X.....
..........
.X.....X..
"""), 1, 3)]
_rockets(7, _pod(_pod_se, 'abcde', _stars7), _pod(_pod_nw, 'abcde', _stars7),
         extra_se=[['head', _star7, 13, 3]], extra_nw=[['head', _star7, 13, 3]],
         fixed={'R': [214, 210, 244], 'W': [255, 255, 255], 'F': [255, 255, 255], 'Y': [200, 236, 255], 'O': [230, 150, 255]})


def frames_of(g, r):
    """the 8 frames of a turret: {facing: [idle rows, fire rows]}, and the muzzle per facing and frame"""
    spec = T[g, r]
    ring = canvas()
    stamp(ring, RINGS[g], RING_AT[0] + DX, RING_AT[1] + DY, name='ring')
    ring = flat(ring)
    out, muz = {}, {}
    for view in ('se', 'nw'):
        pair, mp = [], []
        for firing in (False, True):
            cv = canvas()
            dx, dy = spec['recoil'][view] if firing else (0, 0)
            behind = view == 'nw'
            fxl = FX[spec['fx']][view] if firing else None
            mx, my = spec['muzzle'][view]
            mx, my = mx + dx + DX, my + dy + DY
            if fxl and behind:
                stamp(cv, fxl[0], mx - fxl[1], my - fxl[2], name=f'fx {g},{r},{view}')
            for kind, rs, x, y in spec[view]:
                ox, oy = (dx, dy) if kind == 'gun' else (0, 0)
                stamp(cv, rs, x + ox + DX, y + oy + DY, name=f'{g},{r},{view}')
            if fxl and not behind:
                stamp(cv, fxl[0], mx - fxl[1], my - fxl[2], name=f'fx {g},{r},{view}')
            pair.append(flat(cv))
            mp.append((mx, my))
        out[view] = pair
        muz[view] = mp
    out['sw'] = [mirror(f) for f in out['se']]
    out['ne'] = [mirror(f) for f in out['nw']]
    muz['sw'] = [(W - 1 - x, y) for x, y in muz['se']]
    muz['ne'] = [(W - 1 - x, y) for x, y in muz['nw']]
    # the ring stays put under every head
    for k in out:
        out[k] = [under(f, ring) for f in out[k]]
    return out, muz


# ---------------------------------------------------------------- fire-frame effects: [rows, x, y of the muzzle]
FX = {
    # two bursts, one at each barrel's end (the muzzle point is between them)
    'flash2': {
        'se': [rows("""
......Y...
.....YFO..
....YFWFO.
..Y..OFYO.
.YFO..O...
YFWFO.....
.OFYO.....
..O.......
"""), 4, 3],
        'nw': [rows("""
.....O.....
....OYFY...
...OFWFY...
.O..YFYO...
OYFY.Y.....
OFWFY......
.YFYO......
..Y........
"""), 3, 3],
    },
    # a tongue of flame out of the nozzle, white-hot at the nozzle, red and ember at the end
    'flame': {
        'se': [rows("""
.YO........
FFYYO......
.FFFYYOO...
..YFFFYOOR.
...OYYFYOOR
....ROOYOOD
......RROD.
........D..
"""), 0, 1],
        'nw': [rows("""
.DR........
DROOR......
ROOYOOR....
RROYFYYOR..
..OOYFFFYO.
....OOYFFFY
......OOYFF
........OY.
"""), 10, 6],
    },
    # a cone of freezing mist, sparkling
    'frost': {
        'se': [rows("""
.LC........
LLCCB......
.LLLCCBB...
..CLLLCCBBN
...BCCLCCBN
....NBBCBN.
......NNB.X
.........X.
"""), 0, 1],
        'nw': [rows("""
.X.........
..BNN......
NBBCBBN....
BBCCLCCB...
NBBCCLLLC..
...BBCCLLL.
.....BCCLLL
........CL.
"""), 10, 6],
    },
    # a rocket leaving the pod on a tongue of flame, smoke round the mouth (se); seen from behind, its blast (nw)
    'rocket': {
        'se': [rows("""
.S..........
SOS.........
.SFoo.......
..oFhgoo....
...oogihRo..
.....ooiRRo.
.......ooo..
"""), 1, 1],
        'nw': [rows("""
.......
..SSS..
.STOTS.
SOYFYOS
.SOFOS.
..STS..
"""), 3, 3],
    },
    # crackling arcs: hub to the emitter ball, round the hub's rim, a spark on the ball
    'arc': {
        'se': [rows("""
......VAV..........
..V..VA.AV.....V...
.VAV.A....A...VAV..
.ZA...V...AZ.VA....
..AV.......AA......
.VAZ.........AZ....
..V...........AAV..
..............ZAZ..
..............VAZ..
.............ZVAAVZ
..............ZAAZ.
...............VZ..
"""), 15, 9],
        'nw': [rows("""
...V..............
..VAV......V......
....AV....VAV..V..
....AZ....A..VAV..
...VA....A....A...
...A.....V.....AZ.
..AV...........AV.
.VA.............A.
VZA..........VAV..
.ZAV..........V...
..V...............
"""), 1, 8],
    },
    # the round leaves in a white flash, a puff of smoke rolls up
    'blast': {
        'se': [rows("""
...STS..
.SSTTSS.
STSSTTTS
TSFYFSTT
.TYWWYT.
..OFFO..
...OO...
"""), 3, 6],
        'nw': [rows("""
..STS...
.SSTTSS.
STTSSTST
TTSFYFST
.TYWWYT.
..OFFO..
...OO...
"""), 4, 6],
    },
}


def trim(f):
    """rows without their trailing transparent pixels (cells keep their x; drawSprite needs no padding)"""
    out = [r.rstrip('.') for r in f]
    while out and not out[-1]:
        out.pop()
    return out


def turret_set(g, r):
    """one turret as a sprite set in the game's format (src/sprites.js decodeSet + paletteOf)"""
    spec = T[g, r]
    pal = palette(g, spec.get('pal'), spec.get('glow'), spec.get('fixed'))
    fr, muz = frames_of(g, r)
    used = set()
    anims = {}
    for k in ('se', 'sw', 'nw', 'ne'):
        ax_, ay_ = spec['axis']['se' if k in ('se', 'sw') else 'nw']
        if k in ('sw', 'ne'):
            ax_ = -ax_
        n = (ax_ * ax_ + ay_ * ay_) ** .5
        frames = []
        for i, f in enumerate(fr[k]):
            mx, my = muz[k][i]
            used |= set(''.join(f))
            # gun: a point back along the barrel, then the muzzle (shots leave along this line)
            frames.append({'rows': trim(f), 'gun': [round(mx - ax_ / n * 6), round(my - ay_ / n * 6), mx, my], 'muzzle': [mx, my]})
        anims[k] = {'fps': 12, 'loop': False, 'F': frames}
    used.discard('.')
    name = PREFIX[g] + ' ' + base_name(g, r)
    element = ('fire' if g % 2 == 0 else 'frost') if r == 1 else 'shock' if r == 2 else None
    return {'i': g * 4 + r, 'name': name, 'grade': g, 'role': ROLES[r], 'element': element,
            'w': W, 'h': H, 'ax': AX, 'ay': AY, 'pal': {k: pal[k] for k in sorted(used)}, 'anims': anims}


# the card: the idle down-right turret on a floor in its grade colour, the whole turret centred across the card
CARD = 32
_floor = rows("""
.....llllllllllll.....
..lllmmmmmmmmmmmmlll..
.llmmmmmmmmmmmmmmmmll.
..lllmmmmmmmmmmmmlll..
.....llllllllllll.....
""")


def card_of(g, r):
    spec = T[g, r]
    pal = palette(g, spec.get('pal'), spec.get('glow'), spec.get('fixed'))
    f = frames_of(g, r)[0]['se'][0]
    xs = [x for row in f for x, ch in enumerate(row) if ch != '.']
    x0, x1 = min(xs), max(xs)
    sx = (CARD - (x1 - x0 + 1)) // 2 - x0          # frame x -> card x
    sy = (AY - 7) - AY + (CARD - 32)                # the ring's foot one row above the card's floor line
    cv = [['.'] * CARD for _ in range(CARD)]
    stamp(cv, _floor, AX + sx - 11, AY + sy - 2, name='floor')
    for y, row in enumerate(f):
        for x, ch in enumerate(row):
            if ch != '.' and 0 <= y + sy < CARD and 0 <= x + sx < CARD:
                cv[y + sy][x + sx] = ch
    out = flat(cv)
    used = set(''.join(out)) - {'.'}
    return {'w': CARD, 'h': CARD, 'rows': out, 'pal': {k: pal[k] for k in sorted(used)}}


def build():
    types = {}
    for (g, r) in sorted(T):
        types['turret%d' % (g * 4 + r)] = turret_set(g, r)
    return types


def write_js(types, cards):
    head = """'use strict';
// Turrets: 32 sprite sets (8 grades x 4 roles, index i = TURRETS[i] in src/logic/gear.mjs), generated by
// tools/turrets.py - edit that, not this file. Every pixel placed by hand.
// types['turret' + i] is a sprite set like ART_ZOMBIES_A.types: {w, h, ax, ay, pal, anims}, so decodeSet and
// paletteOf (src/sprites.js) take it as it is; (ax, ay) = the middle of the ring's foot, put on a mount
// (SITES.mounts). Also i, name, grade, role, element.
// anims: one per facing, each two frames F[0] idle and F[1] fire (show the fire frame for one frame per shot):
//   se = down-right (+x), sw = down-left (+y), nw = up-left (-x), ne = up-right (-y); all four drawn unmirrored.
//   From a yaw: const f = facingOf(yaw), dir = f.view === 'F' ? (f.mirror ? 'sw' : 'se') : (f.mirror ? 'ne' : 'nw');
//   drawSprite('turret' + i, dir, 'F', firing ? 1 : 0, false, x, y, z, pal)
// frame.gun = [x0, y0, x1, y1]: back along the barrel, then the muzzle (frame pixels); shots leave from the
// muzzle along that line (frameSpot(info, [gun[2], gun[3]]) is the muzzle on screen). frame.muzzle = [x1, y1].
// cards['turret' + i] = {w, h, rows, pal}: the card icon for the UI slots (the idle down-right turret).
"""
    body = 'window.ART_TURRETS = ' + json.dumps({'types': types, 'cards': cards}, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(GAME, 'art', 'turrets.js'), 'w', encoding='utf-8') as fh:
        fh.write(head + body)


# ---------------------------------------------------------------- sheets
RAINBOW = [(224, 69, 69), (240, 176, 32), (69, 192, 112), (69, 144, 224), (160, 80, 224)]
PAPER, SOFT, INK, MUTED = (255, 255, 255), (246, 244, 239), (28, 27, 25), (139, 135, 127)


def _font(size=16):
    from PIL import ImageFont
    try:
        return ImageFont.truetype('/usr/share/fonts/opentype/unifont/unifont.otf', size)
    except OSError:
        return ImageFont.load_default()


def _paint(im, rws, pal, x0, y0, s):
    for y, row in enumerate(rws):
        for x, ch in enumerate(row):
            if ch != '.':
                im.paste(tuple(pal[ch]), (x0 + x * s, y0 + y * s, x0 + x * s + s, y0 + y * s + s))


def _slot(dr, x0, y0, size, g):
    """a UI slot: soft paper, a 2 px frame in the grade colour (the eternal frame runs through the rainbow)"""
    dr.rectangle((x0, y0, x0 + size - 1, y0 + size - 1), fill=SOFT)
    if g == 7:
        for x in range(size):
            c = RAINBOW[min(4, x * 5 // size)]
            for t in (0, 1):
                dr.point((x0 + x, y0 + t), c); dr.point((x0 + x, y0 + size - 1 - t), c)
        for y in range(size):
            for t in (0, 1):
                dr.point((x0 + t, y0 + y), RAINBOW[0]); dr.point((x0 + size - 1 - t, y0 + y), RAINBOW[4])
    else:
        dr.rectangle((x0, y0, x0 + size - 1, y0 + size - 1), outline=tuple(GRADE_UI[g]), width=2)


def sheet(path, types, cards, facing_grades=(0,)):
    from PIL import Image, ImageDraw
    f16, s_card, s_face = _font(16), 3, 3
    cell = CARD * s_card + 16
    cols = 4
    grades = sorted({t['grade'] for t in types.values()})
    fw, fh = W * s_face, H * s_face
    width = max(cols * (cell + 150) + 40, 8 * (fw + 4) + 200)
    height = 60 + len(grades) * (cell + 34) + 40 + len(facing_grades) * 4 * (fh + 30) + 40
    im = Image.new('RGB', (width, height), PAPER)
    dr = ImageDraw.Draw(im)
    dr.text((20, 16), '터렛 카드 (32×32, 3배) · 등급마다 기관포 / 화염·냉각 / 전기 코일 / 박격포·로켓', font=f16, fill=INK)
    y = 50
    for g in grades:
        dr.text((20, y + cell // 2 - 8), ['일반', '고급', '희귀', '영웅', '전설', '불멸', '신화', '영원'][g], font=f16, fill=tuple(GRADE_UI[g]) if g < 7 else (224, 69, 155))
        for r in range(4):
            k = 'turret%d' % (g * 4 + r)
            x = 90 + r * (cell + 150)
            if k not in types:
                continue
            _slot(dr, x, y, cell, g)
            _paint(im, cards[k]['rows'], cards[k]['pal'], x + 8, y + 8, s_card)
            dr.text((x + cell + 8, y + cell // 2 - 8), types[k]['name'], font=f16, fill=INK)
        y += cell + 34
    y += 10
    for g in facing_grades:
        dr.text((20, y), f'{PREFIX[g]} · 네 방향 (아래오른쪽 se, 아래왼쪽 sw, 위왼쪽 nw, 위오른쪽 ne) × 대기 / 사격, 게임 1px = 3칸', font=f16, fill=INK)
        y += 24
        for r in range(4):
            k = 'turret%d' % (g * 4 + r)
            if k not in types:
                continue
            t = types[k]
            dr.text((20, y + fh // 2 - 8), t['name'], font=f16, fill=INK)
            for c, (d, i) in enumerate([(d, i) for d in ('se', 'sw', 'nw', 'ne') for i in (0, 1)]):
                x = 180 + c * (fw + 4)
                dr.rectangle((x, y, x + fw - 1, y + fh - 1), fill=SOFT)
                _paint(im, t['anims'][d]['F'][i]['rows'], t['pal'], x, y, s_face)
            y += fh + 6
        y += 20
    im = im.crop((0, 0, width, y + 10))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


def check(dirname):
    """a quick sheet: each turret in the four facings, idle and firing, at 5x"""
    from PIL import Image
    s, pad = 5, 4
    items = sorted(T)
    im = Image.new('RGB', (8 * (W * s + pad) + pad, len(items) * (H * s + pad) + pad), (246, 244, 239))
    for n, (g, r) in enumerate(items):
        pal = palette(g, T[g, r].get('pal'), T[g, r].get('glow'), T[g, r].get('fixed'))
        fr, _ = frames_of(g, r)
        for c, (k, i) in enumerate([(k, i) for k in ('se', 'sw', 'nw', 'ne') for i in (0, 1)]):
            ox, oy = pad + c * (W * s + pad), pad + n * (H * s + pad)
            for y, row in enumerate(fr[k][i]):
                for x, ch in enumerate(row):
                    if ch != '.':
                        im.paste(tuple(pal[ch]), (ox + x * s, oy + y * s, ox + x * s + s, oy + y * s + s))
    os.makedirs(dirname, exist_ok=True)
    im.save(os.path.join(dirname, 'check.png'))


if __name__ == '__main__':
    types = build()
    cards = {k: card_of(t['grade'], ROLES.index(t['role'])) for k, t in types.items()}
    write_js(types, cards)
    print('art/turrets.js:', len(types), 'turrets')
    if '--sheet' in sys.argv:
        fg = tuple(int(v) for v in sys.argv[sys.argv.index('--sheet') + 1].split(',')) if len(sys.argv) > sys.argv.index('--sheet') + 1 else (0,)
        sheet(os.path.join(GAME, 'samples', 'turrets', 'sheet.png'), types, cards, fg)
    if '--check' in sys.argv:
        check(sys.argv[sys.argv.index('--check') + 1])
