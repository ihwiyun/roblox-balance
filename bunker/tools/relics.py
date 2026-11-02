#!/usr/bin/env python3
"""Relic icons for the bunker game: 48 icons (src/logic/relics.mjs RELICS, by id), 48x48, every pixel placed by hand.

Run from this folder:  python3 relics.py           -> writes ../art/relics.js (window.ART_RELICS)
                       python3 relics.py --sheet   -> also writes ../samples/relics/sheet.png (all icons at 2x, named)

How an icon is made
- The UI icon style of the game (tools/icons.py, the approved shop icons): a 1 px outline rgb(52,34,34), flat
  masses with two or three shades, light from the top left, white glints. The colours are the UI icon palette
  plus a few shades between them.
- Each icon shows the thing itself (a bullet through a plate, a burning phosphorus shell, a frosted bell...),
  drawn from a few hand-drawn parts put together (one bullet drawing serves every round of ammunition).
- The four corners carry the grade: brackets in the UI grade colour (index.html .g0-.g7), plainer for low grades,
  with studs, gems and sparkles as the grade rises; the eternal ones run through the rainbow.

ART_RELICS[id] = {w, h, rows, pal}: rows of palette letters ('.' = nothing), pal = {letter: [r, g, b]}.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..')
N = 48

# ---------------------------------------------------------------- the palette (UI icon colours and shades between)
PAL = {
    'o': [52, 34, 34], 'K': [30, 28, 34], 'W': [255, 252, 236],
    # steel
    'G': [214, 218, 226], 'g': [170, 174, 182], 'a': [112, 116, 128], 'k': [70, 72, 84],
    # brass
    'Y': [252, 212, 70], 'y': [222, 160, 44], 'u': [168, 104, 34], 'U': [110, 66, 30],
    # copper
    'T': [236, 160, 104], 't': [196, 110, 62], 'h': [138, 70, 46],
    # red
    'E': [255, 96, 64], 'R': [222, 84, 56], 'r': [156, 48, 40], 'Q': [100, 30, 34],
    # wood and leather
    'D': [164, 112, 68], 'd': [112, 74, 46], 'H': [74, 54, 42],
    # blue and ice
    'L': [214, 242, 255], 'B': [118, 182, 244], 'b': [72, 128, 214], 'n': [46, 72, 150],
    # green and olive
    'Z': [138, 182, 104], 'V': [118, 184, 84], 'v': [72, 128, 62], 'M': [112, 128, 80], 'm': [80, 94, 58],
    # cream and bone
    'C': [244, 232, 206], 'c': [204, 188, 160],
    # fire
    'F': [255, 244, 176], 'O': [236, 178, 74], 'f': [255, 150, 50], 'e': [222, 92, 40], 'q': [182, 120, 46],
    # purple and pink
    'P': [238, 128, 222], 'i': [196, 140, 240], 'I': [155, 79, 209], 'j': [96, 46, 148],
    # smoke
    'p': [232, 230, 226], 'x': [184, 182, 184], 'X': [128, 126, 132],
    # burlap
    'J': [196, 172, 120], 'N': [150, 126, 86],
    # electric arc
    'A': [244, 250, 255], 'l': [120, 220, 255],
    # rainbow (the eternal frame)
    '1': [224, 69, 69], '2': [240, 176, 32], '3': [240, 220, 70], '4': [69, 192, 112], '5': [69, 144, 224], '6': [160, 80, 224],
}
# the grade's own three: light, the UI grade colour, dark ('7' '8' '9')
GRADE_TONES = [
    ([206, 206, 206], [154, 154, 154], [100, 100, 104]),
    ([150, 220, 140], [76, 175, 80], [44, 118, 56]),
    ([150, 196, 255], [61, 123, 224], [40, 78, 158]),
    ([214, 168, 248], [155, 79, 209], [98, 46, 148]),
    ([255, 206, 120], [240, 138, 36], [176, 84, 22]),
    ([255, 150, 140], [214, 58, 58], [140, 30, 46]),
    ([255, 236, 140], [201, 154, 16], [140, 98, 22]),
    ([255, 186, 222], [224, 69, 155], [150, 40, 110]),
]
GRADE_UI = [[154, 154, 154], [76, 175, 80], [61, 123, 224], [155, 79, 209], [240, 138, 36], [214, 58, 58], [201, 154, 16], [224, 69, 155]]
GRADE_NAMES = ['일반', '고급', '희귀', '영웅', '전설', '불멸', '신화', '영원']


def rows(s):
    return s.strip('\n').split('\n')


def blank():
    return [['.'] * N for _ in range(N)]


def stamp(cv, rs, x, y, name='?'):
    for j, r in enumerate(rs):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            if not (0 <= y + j < N and 0 <= x + i < N):
                raise ValueError(f'{name}: pixel outside the icon at {x + i},{y + j}')
            cv[y + j][x + i] = ch


def fliph(rs):
    return [r[::-1] for r in rs]


def flipv(rs):
    return rs[::-1]


# ---------------------------------------------------------------- grade corners (top-left drawn, the rest mirrored)
CORNERS = [
    # 0 common: a thin bracket
    rows('''
.........
.888888..
.8.......
.8.......
.8.......
.8.......
.........
'''),
    # 1 uncommon: a two-tone bracket
    rows('''
.........
.7777777.
.788889..
.78......
.78......
.78......
.79......
.........
'''),
    # 2 rare: a bracket with a stud
    rows('''
..........
.77777777.
.7888889..
.78.......
.78.7.....
.78.......
.78.......
.79.......
'''),
    # 3 epic: a cut corner with a small diamond
    rows('''
...........
...7777777.
..7888889..
.78........
.78..7.....
.78.787....
.78..7.....
.78........
.79........
'''),
    # 4 legend: a heavier bracket and a glowing bead
    rows('''
...........
.777777777.
.788888889.
.78.......
.78.WW....
.78.W7....
.78.......
.78.......
.79.......
'''),
    # 5 immortal: a heavy bracket with a spike inward
    rows('''
............
.7777777777.
.78888888889
.789999.....
.789........
.789..9.....
.789...9....
.78.........
.78.........
.79.........
'''),
    # 6 mythic: gold with a curl and a gem
    rows('''
............
.7777777777.
.788888888.9
.78..99.....
.78.9..9....
.78.9.RE9...
.78..9r9....
.78.........
.78.........
.79.........
'''),
    # 7 eternal: the rainbow, a star in the corner
    rows('''
............
.1122334455.
.1.....W....
.2....WWW...
.2.....W....
.3..........
.3..........
.4..........
.4..........
'''),
]


def frame(cv, g):
    c = CORNERS[g]
    h, w = len(c), max(len(r) for r in c)
    c = [r.ljust(w, '.') for r in c]
    stamp(cv, c, 0, 0, 'corner')
    stamp(cv, fliph(c), N - w, 0, 'corner')
    stamp(cv, flipv(c), 0, N - h, 'corner')
    stamp(cv, flipv(fliph(c)), N - w, N - h, 'corner')


# ---------------------------------------------------------------- shared parts
# a jacketed bullet flying right (36 x 10)
BULLET_R = rows('''
.ooooooooooooooooooooooooooo........
oTTTTTTTTTTTTTTTTTTTTTTTTTTToo......
oTTWWWWWWWWWWWWWWWWWWWWWWTTTTToo....
oTTTTTTTTTTTTTTTTTTTTTTTTTTTWTTToo..
ohtttttttttttttttttttttttttttttTTToo
ohttttttttttttttttttttttttttttttttoo
ohttttttttttttttttttttttttttttttoo..
ohhhhhhhhhhhhhhhhhhhhhhhhhhhhhoo....
ohhhhhhhhhhhhhhhhhhhhhhhhhhhoo......
.ooooooooooooooooooooooooooo........
''')

# ---------------------------------------------------------------- the icons
ICONS = {}

# 0 관통탄: a round straight through a steel plate, the plate torn open on the far side, splinters flying
_plate0 = rows('''
..ooooooooo.
.oGGGGGGGGo.
oGGGGGGGGaao
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oGgggggggako
oaaaaaaaakko
.oooooooooo.
''')
_petals0 = rows('''
.oo....
oGgo...
oGgGo..
.oagGo.
..oaGo.
...oo..
.......
.......
.......
.......
.......
.......
.......
...oo..
..oaGo.
.oagGo.
oGgao..
oGgo...
.oo....
''')


def _icon0():
    cv = blank()
    for y, x0, x1 in ((20, 0, 4), (23, 1, 5), (26, 0, 3), (29, 2, 5)):
        for x in range(x0, x1):
            cv[y][x] = 'L' if (x + y) % 3 else 'B'
    stamp(cv, BULLET_R, 6, 19, 'bullet')
    stamp(cv, _plate0, 19, 6, 'plate')
    stamp(cv, _petals0, 31, 15, 'petals')
    for x, y, s in ((39, 12, 'oGo'), (44, 17, 'oGgo'), (41, 33, 'ogGo'), (45, 29, 'oGo')):
        stamp(cv, [' ' * 0 + '.' + 'o' * (len(s) - 2) + '.', s, '.' + 'o' * (len(s) - 2) + '.'], x - 1, y - 1, 'shard')
    return cv


ICONS[0] = _icon0


# 1 할로포인트: a hollow-point round standing, its open nose seen from a little above; a spent round opened
#   into a copper flower; a critical-hit spark
_cart1 = rows("""
....oooooooo....
..ooThTTThTToo..
.oTTHKKKKKKHTTo.
.oThHKKKKKKHhto.
.oTThhHHHHhhtto.
.oTWTTTttttthho.
.oTWTTTttttthho.
oTWTTTTtttttthho
oTWTTTTtttttthho
oTWTTTTtttttthho
oTWTTTTtttttthho
oTTTTTttttttthho
oTTTTTttttttthho
ohTTTtttttttthho
ohhtttttttthhhho
ohhhhhhhhhhhhhho
oYuyyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYWYyyyyyyyuuUUo
oYYyyyyyyyyuuUUo
oyyyyyyyyyyuuUUo
.oUuuuuuuuuuUo..
oYYyyyyyyyyuuUUo
oyyyyyyyyyyuuUUo
oooooooooooooooo
""")
_slug1 = rows("""
...oo.oo.oo..
..oTToTtoTto.
.oTTtoTTotTto
oTTtTThhTTtho
otTTThKKhTtho
ohtTThhhhttho
.ohttTTTttho.
..oohhttthoo.
....ooooo....
""")
_spark = rows("""
....o....
...oYo...
...oYo...
.ooyWyoo.
oYYWWWYYo
.ooyWyoo.
...oYo...
...oYo...
....o....
""")


def _icon1():
    cv = blank()
    stamp(cv, _cart1, 10, 8, 'cartridge')
    stamp(cv, _slug1, 29, 33, 'slug')
    stamp(cv, _spark, 29, 5, 'spark')
    return cv


ICONS[1] = _icon1

# 2 조준경: a rifle scope, eyepiece left, objective right with a red dot in the glass, a turret knob on top
_eye2 = rows("""
.ooooooo.
oaaaaaaao
oggggggao
oaaaaaako
okakakako
okakakako
okakakako
okakakako
okakakako
oKkKkKkKo
oKkKkKkKo
oKkKkKkKo
oKKKKKKKo
oKKKKKKKo
.ooooooo.
""")
_tube2 = rows("""
oooooooooooooooooooooo
aaaaaaaaaaaaaaaaaaaaaa
ggggWWgggggggggggggggg
aaaaaaaaaaaaaaaaaaaaaa
kkkkkkkkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkkkkkkkk
KKKKKKKKKKKKKKKKKKKKKK
KKKKKKKKKKKKKKKKKKKKKK
oooooooooooooooooooooo
""")
_knob2 = rows("""
.oooooo.
oggaakKo
oagakkKo
okkkkKKo
oagakkKo
okkkkKKo
oagakkKo
oooooooo
""")
_bell2 = rows("""
......ooo
....ooaao
..ooaagao
ooaaggaao
oaggaaaao
aaaaaaaao
gggggggao
aaaaaaako
kkkkkkkko
kkkkkkkKo
KKKKKKKKo
KKKKKKKKo
oKKKKKKKo
ooKKKKKKo
..ooKKKKo
....ooKKo
......ooo
""")
_lens2 = rows("""
.ooo..
oLLBo.
oLWBbo
oWBBbo
oBBbbo
oBbbno
oBbbno
oBbEno
obEEEo
obbEno
obbbno
obbnno
obbnno
obnnno
onnno.
onno..
.oo...
""")
_ring2 = rows("""
.ooo.
oggko
oaakK
oaakK
oaakK
oaakK
oaakK
oaakK
oaakK
oaakK
okkKo
.ooo.
""")
_rail2 = rows("""
.oooooooooooooooooooo.
oggggggggggggggggggggo
oaaaaaaaaaaaaaaaaaaaao
.oooooooooooooooooooo.
""")


def _icon2():
    cv = blank()
    stamp(cv, _rail2, 10, 30, 'rail')
    stamp(cv, _tube2, 10, 19, 'tube')
    stamp(cv, _ring2, 13, 18, 'ring')
    stamp(cv, _ring2, 26, 18, 'ring')
    stamp(cv, _knob2, 17, 12, 'knob')
    stamp(cv, _eye2, 3, 16, 'eyepiece')
    stamp(cv, _bell2, 31, 15, 'bell')
    stamp(cv, _lens2, 39, 15, 'lens')
    return cv


ICONS[2] = _icon2

# 3 도탄: a round comes down, strikes a steel slab in a burst of sparks and glances away up to the right
_slab3 = rows("""
...oooooooooooooooooooooooooooooooooooooooo...
..oGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGo..
.oGgggggggggggggggggggggggggggggggggggggggggo.
oGggggggggggggggggggggggggggggggggggggggggggao
oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaako
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
.oooooooooooooooooooooooooooooooooooooooooooo.
""")
_burst3 = rows("""
.....Y.....
.Y...Y...Y.
..Y..F..Y..
...YFWFY...
YYFFWWWFFYY
...oaKao...
""")
_bullet3 = rows("""
.......ooo
......oTWo
.....oTTTo
....oTTtho
...oTTtho.
..oTttho..
.oTttho...
otthho....
ohhoo.....
.oo.......
""")


def _icon3():
    cv = blank()
    stamp(cv, _slab3, 1, 34, 'slab')
    # the way in: dashes coming down from the top left
    for x, y in ((5, 5), (6, 7), (7, 9), (10, 14), (11, 16), (12, 18), (15, 23), (16, 25), (17, 27)):
        cv[y][x] = 'I'
        cv[y][x + 1] = 'i'
        cv[y + 1][x + 1] = 'I'
    # the way out: dashes rising to the right
    for x, y in ((25, 29), (26, 27), (27, 25), (29, 21), (30, 19), (31, 17)):
        cv[y][x] = 'I'
        cv[y][x + 1] = 'i'
        cv[y - 1][x + 1] = 'I'
    stamp(cv, _burst3, 18, 29, 'burst')
    stamp(cv, _bullet3, 33, 7, 'bullet')
    return cv


ICONS[3] = _icon3

# 4 이중 급탄: two rifle rounds side by side in a steel clip, an orange double flash over their noses
_cart4 = rows("""
.....oo.....
....oTWo....
....oTto....
...oTWtho...
...oTWtho...
..oTTWttho..
..oTTWttho..
..oTTTttho..
..oTTTttho..
..ohhhhhho..
..oYWyyuUo..
..oYWyyuUo..
..oYWyyuUo..
..oYWyyuUo..
.oYYWyyyuUo.
oYYWyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oYWYyyyyyuUo
oyyyyyyyyuUo
.oUUUUUUUUo.
oYyyyyyyyuUo
oyyyyyyyyuUo
oooooooooooo
""")
_clip4 = rows("""
.oooooooooooooooooooooooooo.
oGGGGGGGGGGGGGGGGGGGGGGGGGGo
ogggggggggggggggggggggggggao
oaaaaaaaaaaaaaaaaaaaaaaaaaao
.oooooooooooooooooooooooooo.
""")
_flash4 = rows("""
......f.......f......
...f..fO...f..fO..f..
....fOFO.f..fOFO.f...
..ffOFWFOf.ffOFWFOf..
....fOFOf...fOFOf....
.....fOf.....fOf.....
""")


def _icon4():
    cv = blank()
    stamp(cv, _flash4, 12, 1, 'flash')
    stamp(cv, _cart4, 25, 7, 'round')
    stamp(cv, _cart4, 12, 7, 'round')
    stamp(cv, _clip4, 10, 38, 'clip')
    return cv


ICONS[4] = _icon4

# 5 전리품 탄띠: a gold-buckled bandolier of silver-tipped rounds with a zombie skull and a fang hung on it
_round5 = rows("""
..o..
.oGo.
.oGo.
oGWgo
oGgao
oyuyo
oYWyo
oYyuo
oYyuo
oYyuo
""")
_belt5 = rows("""
oooo........................................oooo
TTTToooo................................ooooTTTT
DDDDTTTTooo..........................oooTTTTDDDD
DcDDDDDDTTTooo....................oooTTTDDDDDDcD
ddddcDDcDDDTTTooo..............oooTTTDDDcDDcdddd
HHHHddddDDcDDDTTToooo......ooooTTTDDDcDDdddHHHH
ooooHHHHdddDDcDDDTTTToooooooTTTTDDDcDDdddHHHHoooo
....ooooHHHdddDDcDDDDTTTTTTDDDDcDDdddHHHoooo....
..........oooHHHdddDDcDDDDDDDDDcDDdddHHHooo.........
.............oooHHHddddDcDDcDdddHHHooo.............
................ooooHHHHHHHHHHHHoooo................
....................oooooooooooo....................
""")
_skull5 = rows("""
...ooooo...
..oCCCCCo..
.oCWCCCccO.
oCCCCCCCcco
oCKKCCKKcco
oCKKCcKKcco
.oCCcKcccO.
..ocCcCco..
..oCoCoCo..
...ooooo...
""")
_fang5 = rows("""
.oo..
oCCo.
oCco.
oCco.
.oCco
.oCco
..oco
..oo.
""")
_buckle5 = rows("""
.oooooo.
oYYYYYyo
oYoooouo
oYoREouo
oYorrouo
oYoooouo
oyyyyuuo
.oooooo.
""")


def _icon5():
    cv = blank()
    # rounds standing in the belt's loops (drawn first: the belt's top edge holds them)
    for x, y in ((2, 7), (8, 8), (14, 10), (20, 12), (26, 12), (32, 10), (38, 8)):
        stamp(cv, _round5, x, y, 'round')
    stamp(cv, [r[:48] for r in _belt5], 0, 13, 'belt')
    stamp(cv, _buckle5, 5, 13, 'buckle')
    # a little chain down to the skull
    for y in (25, 26, 27):
        cv[y][24] = 'g' if y % 2 else 'a'
    stamp(cv, _skull5, 19, 28, 'skull')
    stamp(cv, _fang5, 32, 23, 'fang')
    return cv


ICONS[5] = _icon5

# 6 인: a phosphorus shell burning white-hot, white smoke boiling off it, burning flecks falling
_shell6 = rows("""
.......oo.......
......oGgo......
.....oGgaao.....
....oaGgaako....
...oZZWMMmmmo...
..oZZWMMMMmmmo..
..oZWMMMMMmmmo..
.oZZWMMMMMmmmmo.
.oZWMMMMMMmmmmo.
.oZWMMMMMMmmmmo.
oZZWMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oYYYYYyyyyyyuuuo
oYWYYYyyyyyyuuuo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oZWMMMMMMMMmmmmo
oTWTTTtttttthhho
othhhhhhhhhhhhho
.oMMMMMMMmmmmmo.
..oooooooooooo..
""")
_fire6 = rows("""
.........eFe..........
....e...eFWFe...e.....
...eFe..eFWFe..eFe....
...eFWe.eFWWFeeFWFe...
..eFWWFeFWWWWFFWWFe...
..eFWWWWWWWWWWWWWWFe..
...eFFWWWWWWWWWWWFFe..
....eeFFFWWWWWFFFee...
......eeeFFFFFeee.....
""")
_trail6 = rows("""
.xxx................
xpppxx..............
xppppppxx...........
.xxpppppppxx........
...xxxpppppppxx.....
......xxpppppppxx...
........xxxpppppx...
...........xxppppx..
.............xxpx...
...............x....
""")
_plume6 = rows("""
....xxx....
..xxpppxx..
.xpppppppx.
xpppxpppppx
xppxxxppppx
.xpppppppx.
..xppppppx.
...xpppppx.
...xppppx..
....xpppx..
""")
def _icon6():
    cv = blank()
    # white smoke thrown out of the burning nose in three trails, burning flecks at their ends
    stamp(cv, _trail6, 3, 6, 'trail')
    stamp(cv, [r[::-1] for r in _trail6], 25, 6, 'trail')
    stamp(cv, _plume6, 18, 1, 'plume')
    for x, y in ((2, 6), (45, 6), (22, 0)):
        cv[y][x] = 'F'
    stamp(cv, _shell6, 16, 20, 'shell')
    stamp(cv, _fire6, 13, 12, 'fire')
    # a crack on the flank breathing fire, burning flecks dropping away
    for x, y, c in ((22, 33, 'e'), (23, 32, 'F'), (24, 33, 'W'), (25, 32, 'F'), (26, 33, 'e'),
                    (11, 26, 'F'), (10, 30, 'e'), (37, 27, 'F'), (38, 31, 'e'), (12, 36, 'F'), (36, 37, 'F')):
        cv[y][x] = c
    return cv


ICONS[6] = _icon6

# 7 네이팜: a finned napalm canister tumbling down, a fireball and black smoke rolling up beneath it
_can7 = rows("""
......oooooooooooooooooooo....
....ooZZZZZZZZZZZZZZZZZZZZoo..
...oZZWWZZZZZZZZZZZZZZZZZZZZo.
..oZWWZZZZZYYZZZZZZZZZRRZZZZMo
.oZZZZZZZZZYYZZZZZZZZZRRZZZMMo
oZZMMMMMMMMyyMMMMMMMMMrrMMMMMo
oMMMMMMMMMMyyMMMMMMMMMrrMMMmmo
.omMMMMMMMMyyMMMMMMMMMrrMMmmo.
..ommmmmmmmuummmmmmmmmQQmmmo..
...oommmmmmmmmmmmmmmmmmmmoo...
.....oooooooooooooooooooo.....
""")
_fins7 = rows("""
ooo.....
oMmo....
oMmmo...
.oMmmoooo
..oMMmmmo
..ommmmmo
.ommmoooo
ommmo...
ommo....
ooo.....
""")
_ball7 = rows("""
..............XXXX.....XXX..........
..........XXXXkkkkXX..XkkkXX........
.....XXXXXkkkkkkkkkkXXkkkkkkX.......
....XkkkkkkkkXXXkkkkkkkkkkkkkXX.....
...XkkkkkXXXX...XXXkkkkkXXkkkkkX....
...XkkkkX..eee.....XXXXX..XkkkX.....
....XXXX..eRRe..eee...ee...XXX......
.........eRffRe.eRRe.eRRe..ee.......
........eRfFFfReRffReRffRe.eRe......
.......eRfFWWFfRfFFfRfFFfRReRRe.....
......eRffFWWWFffFWFffFWFffRfRRe....
.....eRfFFWWWWWFFWWWFFWWFFFfffRe....
....eRfFWWWWWWWWWWWWWWWWWWWFFffRe...
....eRfFWWWWWWWWWWWWWWWWWWWWFffRe...
...eRffFFWWWWWWWWWWWWWWWWWFFFffRe...
...eRRffFFFWWWWWWWWWWWWFFFFffRRe....
....eeRRfffFFFFFFFFFFFFFfffRRee.....
......eeRRRffffffffffffRRRRee.......
........eeeRRRRRRRRRRRRRReee........
...........eeeeeeeeeeeeee...........
""")


def _icon7():
    cv = blank()
    stamp(cv, _ball7, 10, 24, 'fireball')
    stamp(cv, _can7, 3, 7, 'canister')
    stamp(cv, _fins7, 32, 7, 'fins')
    return cv


ICONS[7] = _icon7


# ---------------------------------------------------------------- small shared parts
_flake = rows("""
...L...
.L.L.L.
..LBL..
LLBWBLL
..LBL..
.L.L.L.
...L...
""")
_bolt = rows("""
......ooo
.....oYYo
....oYYo.
...oYWo..
..oYYoooo
.oYYYYYYo
.ooooYYo.
....oYo..
...oYo...
..oYo....
..oo.....
""")
_coin = rows("""
..oooo..
.oYYYyo.
oYWYYyuo
oYYoyyuo
oYyoyuuo
oyyyuuuo
.ouuuuo.
..oooo..
""")

# 8 냉각 탄창: a rifle magazine under a crust of frost, a window of glowing coolant down its side, icicles
_mag8 = rows("""
....oo..oo......
...oTWooTWo.....
...oTtooTto.....
..oYWyuYWyuo....
.oooooooooooooo.
.oLLLLLLLLLLLLo.
oLLWLLggggLLaLLo
oLggggggggggaako
oLgGGggggggaaako
oggGggBBBggaakko
oggggBLWBgaaakko
oggggBLBBgaaakko
oggggBBLBgaaakko
oggggBLBBgaaakko
oggggBBBBgaaakko
oggggBLWBgaaakko
oggggBBBBgaaakko
oggggggggaaaakko
ogggggggaaaaakko
oLggggggaaaaakko
oLLgggggaaaaakko
oLLLggggaaaakkko
.oLLLLgaaaaakkko
..oLLLLLLLaaakko
...ooLBoLBoLBoo.
.....oBo.oBo.L..
......o...o.....
""")


def _icon8():
    cv = blank()
    stamp(cv, _mag8, 16, 8, 'magazine')
    stamp(cv, _flake, 6, 10, 'flake')
    stamp(cv, _flake, 35, 26, 'flake')
    for x, y in ((9, 30), (38, 12), (12, 40)):
        cv[y][x] = 'L'
    return cv


ICONS[8] = _icon8

# 9 서리 종: a bronze bell iced over, icicles hanging off its lip, snow on its shoulder, snowflakes round it
_bell9 = rows("""
..........oooo..........
..........oYyo..........
.........ooyuoo.........
........oYYyyuuo........
.......oLLYyyyuuo.......
.......oLWLyyyuuo.......
.......oYWyyyyuuo.......
......oYWYyyyyuuUo......
......oYWyyyyyuuUo......
.....oYYWyyyyyyuuUo.....
.....oYWyyyyyyyuuUo.....
....oYYWyyyyyyyyuuUUo....
...oYYWyyyyyyyyuuuUUo...
..oYYWyyyyyyyyyyuuuUUo..
.oYYYWyyyyyyyyyyyuuuUUo.
oLLLLLLLLLLLLLLLLLLLLLLo
oLWLLLLLLLLLLBLLLLLLBLLo
.oBLLoBLLLoBBLoLLBoBLo..
..oBo.oBLo.oBo.oBo.oo...
...o...oBo..o...o.......
........o...............
""")
def _icon9():
    cv = blank()
    stamp(cv, _bell9, 12, 8, 'bell')
    # the clapper under the lip
    stamp(cv, rows("""
.oo.
okao
okko
.oo.
"""), 22, 28, 'clapper')
    stamp(cv, _flake, 4, 6, 'flake')
    stamp(cv, _flake, 37, 30, 'flake')
    stamp(cv, _flake, 38, 6, 'flake')
    return cv


ICONS[9] = _icon9

# 10 아크 코일: a wound copper column between a terminal ball and a base plate, arcs leaping down round it
_ball10 = rows("""
.oooo.
oGWGgo
oGGgao
oggaao
.oaao.
..oo..
""")
_cap10 = rows("""
....oooooooooo....
..ooGGGGGGGGgaoo..
.oGGWGGGGGGggaaao.
oGGGGGGGGGgggaaako
.oaaaaaaaaaaakkko.
..oooooooooooooo..
""")
_col10 = rows("""
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
oTWTTtttthho
otttthhhhhho
""")
_base10 = rows("""
....oooooooooooooo....
..ooaaaaaaaaaaaaaaoo..
.oGGgggggggggggggaaao.
oGgggggggggggggggaaako
oaaaaaaaaaaaaaaaaakkko
.okkkkkkkkkkkkkkkkkko.
..oooooooooooooooooo..
""")
_arcl10 = rows("""
.....lA.
....lA..
...lAl..
..lA....
..Al....
.lAl....
..lA....
...Al...
..lAl...
..lA....
...lA...
....lA..
.....Al.
......Al
""")


def _icon10():
    cv = blank()
    stamp(cv, _col10, 18, 15, 'column')
    stamp(cv, _base10, 13, 32, 'base')
    stamp(cv, _cap10, 15, 10, 'cap')
    stamp(cv, _ball10, 21, 5, 'ball')
    stamp(cv, _arcl10, 9, 16, 'arc')
    stamp(cv, [r[::-1] for r in _arcl10], 31, 16, 'arc')
    for x, y, c in ((14, 15, 'A'), (33, 15, 'A'), (16, 31, 'l'), (31, 31, 'l'), (24, 3, 'A'), (20, 4, 'l'), (27, 4, 'l')):
        cv[y][x] = c
    return cv


ICONS[10] = _icon10

# 11 피뢰침: a lightning rod with a glass ball on a roof's ridge, a bolt striking its point
_rod11 = rows("""
..o..
.oWo.
.oGo.
.oGo.
.oGo.
.oga.
.oga.
oBLBo
oLWBb
oBBbo
.oao.
.oga.
.oga.
.oga.
.oga.
.oga.
oooooo
""")
_roof11 = rows("""
..................oooooooooo..................
...............oooRRRRRRRRRRooo...............
............oooRRRrRRRRRRrRRRRRooo............
.........oooRRRRRRRRRRrRRRRRRRRRRRRooo........
......oooRRRrRRRRRRRRRRRRRRrRRRRRRRRRRRooo....
...oooRRRRRRRRRRRRrRRRRRRRRRRRRRRRRrRRRRRRooo.
oooRRRRRRRRrRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRRRo
orrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrro
oQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQo
oooooooooooooooooooooooooooooooooooooooooooooo
""")


def _icon11():
    cv = blank()
    stamp(cv, _roof11, 1, 36, 'roof')
    stamp(cv, _rod11, 21, 20, 'rod')
    stamp(cv, rows("""
...........ooo
..........oYYo
.........oYYo.
........oYWo..
.......oYYo...
......oYYoooo.
.....oYYYYYYo.
.....ooooYYo..
........oYo...
.......oYo....
......oYWo....
.....oYYoooo..
....oYYYYYYo..
....ooooYYo...
.......oYo....
......oYo.....
.....oWo......
.....oo.......
"""), 18, 2, 'bolt')
    # sparks where the bolt meets the point
    for x, y, c in ((20, 19, 'Y'), (26, 18, 'Y'), (19, 21, 'W'), (27, 21, 'W'), (21, 17, 'W'), (25, 21, 'Y')):
        cv[y][x] = c
    return cv


ICONS[11] = _icon11


# 12 철갑 코어: an armour-piercing dart flying out of its copper sabot, the petals peeling away, a hard steel tip
_dart12 = rows("""
.oo......................................
oGGoo....................................
oggGGoooooooooooooooooooooooooooooooooo..
oaggggGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWoo
oaaakkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaKo
oaggggkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkoo
oggaaoooooooooooooooooooooooooooooooooo..
oaaoo....................................
.oo......................................
""")
_petal12 = rows("""
..........oooo
......ooooTTto
...oooTTTTttho
.ooTTWTTtthhoo
oTTTTttthhoo..
ohhhhhhoooo...
.oooooo.......
""")


def _icon12():
    cv = blank()
    stamp(cv, _petal12, 14, 11, 'petal')
    stamp(cv, flipv(_petal12), 14, 30, 'petal')
    stamp(cv, _dart12, 4, 20, 'dart')
    for x, y, c in ((33, 15, 'p'), (35, 14, 'x'), (31, 34, 'p'), (34, 35, 'x'), (2, 23, 'x'), (1, 25, 'p')):
        cv[y][x] = c
    return cv


ICONS[12] = _icon12

# 13 처형자: a headsman's axe standing upright, a broad D-shaped blade with a bright edge, a back spike, a red grip
_haft13 = rows("""
.oo.
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oRro
oRro
oERo
oRro
oRro
oERo
oRro
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oDdo
oddo
oaao
.oo.
""")
_blade13 = rows("""
...........oooooo.
.........ooGGGgao.
.......ooWGggggao.
......oWWGgggggao.
.....oWGGggggggao.
....oWGgggggggaao.
...oWGggggggggaao.
...oWGggggggggaao.
..oWGgggggggggaao.
..oWGgggggggggaao.
..oWGgggggggggaao.
..oWGgggggggggaao.
..oWGgggggggggaao.
..oWGgggggggggaao.
...oWGggggggggaao.
...oWGggggggggaao.
....oWGgggggggaao.
.....oWGGggggggao.
......oWWGgggggao.
.......ooWGggggao.
.........ooGGGgao.
...........oooooo.
""")
_spike13 = rows("""
oooo...
oaggoo.
oaGGGWo
oaggoo.
oooo...
""")
_cap13 = rows("""
.oooooo.
oGGGgaao
oaaaakko
.oooooo.
""")


def _icon13():
    cv = blank()
    stamp(cv, _blade13, 8, 5, 'blade')
    stamp(cv, _spike13, 28, 13, 'spike')
    stamp(cv, _haft13, 24, 13, 'haft')
    stamp(cv, _cap13, 22, 3, 'cap')
    for y in range(7, 13):
        cv[y][24], cv[y][25], cv[y][26], cv[y][27] = 'o', 'D', 'd', 'o'
    return cv


ICONS[13] = _icon13

# 14 거인 사냥꾼: a barbed harpoon laid across a giant's fang as long as a man's arm, its rope coiled at the butt
_fang14 = rows("""
.ooooooo.......
oCCCCcccoo.....
oCWCCcccccoo...
.oCCCCccccccoo.
..ooCCCCccccco.
....ooCCCcccco.
......oCCccccO.
.......oCCccco.
........oCccco.
........oCccco.
.........oCcco.
.........oCcco.
..........oCco.
..........oCco.
...........oco.
...........oco.
............oo.
""")
_harpoon14 = rows("""
..........................oo
.........................oGo
........................oGWo
.......................oGgao
..........oo..........oGgao.
.........oGo.........oGgao..
........oGgo........oGgao...
.......oaggoooo....oGgao....
........oaGGGGgo..oGgao.....
.........oooaaaaooGgao......
............oooaGGgao.......
..............oGgaao........
.............oDdooo.........
............oDdo............
...........oDdo.............
..........oDdo..............
.........oDdo...............
........oDdo................
.......oDdo.................
......oDdo..................
.....oDdo...................
....oDdo....................
...oDdo.....................
..oDdo......................
.oDdo.......................
odDo........................
odo.........................
oo..........................
""")
_rope14 = rows("""
..oooooo..
.ocCCccco.
ocCooooCco
oCo....oCo
oco....oco
ocCooooCco
.occcCCco.
..oooooo..
""")


def _icon14():
    cv = blank()
    stamp(cv, _fang14, 26, 22, 'fang')
    stamp(cv, _harpoon14, 9, 3, 'harpoon')
    stamp(cv, _rope14, 3, 34, 'rope')
    return cv


ICONS[14] = _icon14

# 15 약점 표식: a sight's ring closing on a glowing red weak spot in a cracked plate
_plate15 = rows("""
.oooooooooooooooooooooooo.
oGGGGGGGGGGGGGGGGGGGGGGgao
oGggggggggggggggggggggggao
oGgggggggggaggggggggggggao
oGggggggggaogggggggggggaao
oGgggggggggaogggggggggggao
oGggggggggggaoggggggggggao
oGgggggggggggaooaggggggggao
oGggggggggaaaoEEoaggggggao
oGgggggaaoooEEWEEoaaggggao
oGggggggggaoEEEEEoaggggggao
oGgggggggaoggoEEoaggggggao
oGggggggaogggggoaggggggggo
oGgggggaogggggggaoggggggao
oGggggaogggggggggaoggggggo
oGgggggggggggggggggaogggao
oGggggggggggggggggggggggao
oaaaaaaaaaaaaaaaaaaaaaaaao
.oooooooooooooooooooooooo.
""")
_ring15 = rows("""
.........bbbbbbbb.........
......bbbBBBBBBBBbbb......
....bbBBB...bb...BBBbb....
...bBB......bb......BBb...
..bBB.......bb.......BBb..
.bB.........bb.........Bb.
.bB....................Bb.
bB......................Bb
bB......................Bb
bB......................Bb
bbbbbb..............bbbbbb
bB......................Bb
bB......................Bb
bB......................Bb
.bB....................Bb.
.bB.........bb.........Bb.
..bBB.......bb.......BBb..
...bBB......bb......BBb...
....bbBBB...bb...BBBbb....
......bbbBBBBBBBBbbb......
.........bbbbbbbb.........
""")


def _icon15():
    cv = blank()
    stamp(cv, [r[:26] for r in _plate15], 11, 14, 'plate')
    stamp(cv, _ring15, 11, 10, 'reticle')
    return cv


ICONS[15] = _icon15

# 16 현상금 시계: a stopwatch with its dial run into the red, a stack of bounty coins beside it
_watch16 = rows("""
..........oooo..........
.........oGGgo..........
.........oaaao..........
.......oooooooooo.......
.....ooGGGGGGGgaaoo.....
....oGGCCCCCCCCcgaao....
...oGCCCCCCoCCCCccgao...
..oGCCCCCCCoCCCCCccgao..
..oGCoCCCCCoCCCCRRcgao..
.oGCCCCCCCCoCCCRRRccgao.
.oGCCCCCCCCoCCRRRRccgao.
.oGCCCCCCCCooRRRRRcoga..
.oGCoCCCCCCoKKKKoCcogao.
.oGCCCCCCCCCCCCCCCcogao.
.oGCCCCCCCCCCCCCCccogao.
..oGCCCCCCCCCCCCCccgao..
..oGCoCCCCCCCCCCCcogao..
...oGCCCCCCoCCCCccgao...
....oGCCCCCCCCCcgaao....
.....ooGgggggggaaoo.....
.......oooooooooo.......
""")


def _icon16():
    cv = blank()
    stamp(cv, _watch16, 5, 7, 'stopwatch')
    for k in range(4):
        stamp(cv, _coin, 31, 35 - k * 3, 'coin')
    stamp(cv, _coin, 37, 37, 'coin')
    for x, y in ((8, 8), (26, 4), (44, 30)):
        cv[y][x] = 'W'
    return cv


ICONS[16] = _icon16

# 17 타이탄 심장: a titan's heart, huge and dark, cosmic light running through its veins
_heart17 = rows("""
....oooooooo....oooooooo....
..ooEERRRRRRooooRRRRRRrroo..
.oEEERRRRRRRRooRRRRRRRRrrro.
oEEWERRRRRRRRrrRRRRRRRRrrrro
oEERRRRRRRRRRRRRRRRRRRrrrrQo
oERRRRRRRRRRRRRRRRRRRRrrrrQo
oERRRRRRRRRRRRRRRRRRRRrrrrQo
oRRRRRRRRRRRRRRRRRRRRRrrrrQo
oRRRRRRRRRRRRRRRRRRRRrrrrQQo
orRRRRRRRRRRRRRRRRRRRrrrrQQo
.orRRRRRRRRRRRRRRRRRrrrrQQo.
.orrRRRRRRRRRRRRRRRRrrrQQQo.
..orrRRRRRRRRRRRRRRrrrrQQo..
...orrRRRRRRRRRRRRrrrrQQo...
....orrRRRRRRRRRRrrrrQQo....
.....orrRRRRRRRRrrrrQQo.....
......orrRRRRRRrrrrQQo......
.......orrRRRRrrrrQQo.......
........orrRRrrrrQQo........
.........orrrrrrQQo.........
..........orrrrQQo..........
...........orrQQo...........
............oQQo............
.............oo.............
""")
_veins17 = rows("""
............................
............................
............................
.......i.......i............
........i.....i.............
.........i...P..............
..........PWP.....i.........
...i......PWWP...i..........
....iP...PWWWWPPi...........
......PPPWWWWWWP............
.........PWWWWP.............
.........iPWWPi.............
........i..PP..i............
.......i...Pi...i...........
...........i................
...........i................
""")
_vessel17 = rows("""
.oooo.
oRERro
oRRrro
.orro.
""")
def _icon17():
    cv = blank()
    stamp(cv, _vessel17, 14, 8, 'vessel')
    stamp(cv, _vessel17, 25, 7, 'vessel')
    stamp(cv, _heart17, 10, 11, 'heart')
    hv = blank()
    stamp(hv, _veins17, 10, 11, 'veins')
    for y in range(N):
        for x in range(N):
            if hv[y][x] != '.' and cv[y][x] in 'ERrQ':
                cv[y][x] = hv[y][x]
    for x, y in ((6, 8), (41, 9), (4, 30), (43, 33), (24, 6), (14, 40), (36, 41)):
        cv[y][x] = 'W'
    for x, y in ((7, 8), (5, 8), (6, 7), (6, 9), (41, 8), (41, 10), (40, 9), (42, 9)):
        cv[y][x] = 'i'
    return cv


ICONS[17] = _icon17


# 18 면도날 철조망: a coil of razor wire, its loops overlapping, little blades all along it
_loop18 = rows("""
....oooo....
..oogGGgoo..
.ogo....ogo.
og........go
oG........ao
og........ao
og........ao
oG........ao
og........ao
.oa......ao.
..ooaaaaoo..
....oooo....
""")
_barb18 = rows("""
..o..
.oGo.
oGWao
.oao.
..o..
""")


def _icon18():
    cv = blank()
    for k, x in enumerate(range(1, 36, 7)):
        stamp(cv, _loop18, x, 16 + (k % 2), 'loop')
    for x, y in ((3, 14), (11, 26), (16, 14), (24, 27), (30, 15), (37, 26), (6, 26), (21, 14), (33, 26), (39, 15), (17, 26), (27, 14)):
        stamp(cv, _barb18, x, y, 'barb')
    # the wire running off both ends
    for x in range(0, 4):
        cv[22][x] = 'g'
    for x in range(44, 48):
        cv[23][x] = 'a'
    return cv


ICONS[18] = _icon18

# 19 장갑판: a riveted armour plate, a round flattened against it and the steel dented round the hit
_plate19 = rows("""
..oooooooooooooooooooooooooo..
.oGGGGGGGGGGGGGGGGGGGGGGGGGGo.
oGGWGGGGGGGGGGGGGGGGGGGGGGGgao
oGGgggggggggggggggggggggggggao
oGgGagggggggggggggggggggGagkao
oGgaggggggggggggggggggggaggkao
oGgggggggggggggggggggggggggkao
oGgggggggggggggggggggggggggkao
oGgggggggggggggggggggggggggkao
oGgggggggggggggggggggggggggkao
oGggggggggggggggaaaggggggggkao
oGgggggggggggggaoTToaggggggkao
oGggggggggggggaoTWtToagggggkao
oGgggggggggggggatTtha.ggggggkao
oGgggggggggggggaohhoaggggggkao
oGggggggggggggggaaagggggggggkao
oGgggggggggggggggggggggggggkao
oGgggggggggggggggggggggggggkao
oGgggggggggggggggggggggggggkao
oGgggggggggggggggggggggggggkao
oGgGagggggggggggggggggggGagkao
oGgaggggggggggggggggggggaggkao
oGgggggggggggggggggggggggggkao
oGkkkkkkkkkkkkkkkkkkkkkkkkkkao
oaaaaaaaaaaaaaaaaaaaaaaaaaaaao
.oooooooooooooooooooooooooooo.
""")


def _icon19():
    cv = blank()
    stamp(cv, [r.replace(' ', '') for r in _plate19], 9, 10, 'plate')
    for x, y in ((26, 18), (31, 20), (27, 27), (21, 25), (30, 25)):
        cv[y][x] = 'a'
    return cv


ICONS[19] = _icon19

# 20 모래주머니 부적: a little sandbag tied with red cord, a paper charm hung on it
_bag20 = rows("""
..........oooo..........
.........oNJJNo.........
........oRRRRRRo........
.........oRrrRo.........
.......ooNJJJJNoo.......
.....ooJJJJJJJJJJoo.....
....oJJCJJJJJJJJJJNo....
...oJJCCJJJJJJJJJJNNo...
..oJJCJJJJJJJJJJJJJNNo..
..oJJJJJJJJNJJJJJJJNNo..
.oJJCJJJJJJJNJJJJJJJNNo.
.oJJJJJJJJJJJNJJJJJJNNo.
.oJJJJJJJJJJJJJJJJJJNNo.
.oJJJJJJJJJJJJJJJJJNNNo.
.oNJJJJJJJJJJJJJJJJNNNo.
..oNJJJJJJJJJJJJJJNNNo..
..oNNJJJJJJJJJJJJNNNNo..
...oNNNJJJJJJJJNNNNNo...
....ooNNNNNNNNNNNNoo....
......oooooooooooo......
""")
_charm20 = rows("""
..o...
.oYo..
oYYYo.
oYrYo.
oYrrYo
oYYrYo
oYrrYo
oYYYYo
oyYYyo
.oooo.
""")


def _icon20():
    cv = blank()
    stamp(cv, _bag20, 12, 13, 'sandbag')
    stamp(cv, _charm20, 31, 18, 'charm')
    for x, y in ((28, 16), (29, 16), (30, 17), (31, 18)):
        cv[y][x] = 'R'
    return cv


ICONS[20] = _icon20

# 21 수리 상자: a red toolbox, a wrench and a screwdriver standing out of it
_box21 = rows("""
.........oooooooooooo.........
.........okkkkkkkkkko.........
.........ok........ko.........
..oooooooooooooooooooooooooo..
.oEEEEEEEEEEEEEEEEEEEEEEEEERo.
oERRRRRRRRRRRRRRRRRRRRRRRRRrro
oRRRRRRRRRRRRRRRRRRRRRRRRRRrro
oooooooooooooooooooooooooooooo
oRRRRRRRRRRRRggRRRRRRRRRRRRrro
oRRRRRRRRRRRRkkRRRRRRRRRRRRrro
oRRRRRRRRRRRRRRRRRRRRRRRRRRrro
oRRRRRRRRRRRRRRRRRRRRRRRRRRrro
oRRRRRRRRRRRRRRRRRRRRRRRRRRrro
orrrrrrrrrrrrrrrrrrrrrrrrrrrQo
oQQQQQQQQQQQQQQQQQQQQQQQQQQQQo
.oooooooooooooooooooooooooooo.
""")
_wrench21 = rows("""
.oo..oo.
oGgooGgo
oGgaaGgo
.oGgggo.
..oGgo..
..oGao..
..oGao..
..oGao..
..oGao..
..oGao..
""")
_driver21 = rows("""
..o..
.oGo.
.oGo.
.oGo.
.oao.
oYYyo
oYyuo
oYyuo
oyyuo
""")


def _icon21():
    cv = blank()
    stamp(cv, _wrench21, 13, 7, 'wrench')
    stamp(cv, _driver21, 30, 9, 'screwdriver')
    stamp(cv, _box21, 9, 15, 'box')
    return cv


ICONS[21] = _icon21

# 22 과부하: a pressure gauge with its needle jammed in the red, steam bursting from the pipe, sparks
_gauge22 = rows("""
.........oooooooooo.........
.......ooYYYYYYYYyyoo.......
.....ooYYyyyyyyyyyyuuoo.....
....oYYyoooooooooooouuuo....
...oYyooCCCCCCCCCCCooouo....
..oYyoCCCkCCCkCCCRRRCCouuo..
..oYoCCCCCCCCCCCCRRRRCCouo..
.oYyoCkCCCCCCCCCCCRRRCCoouo.
.oYoCCCCCCCCCCCCCKKRRRCCouo.
.oYoCCCCCCCCCCCCKKCCRRCCouo.
.oYoCkCCCCCCCCCKKCCCCCkCouo.
.oYoCCCCCCCCCooKCCCCCCCCouo.
.oYoCCCCCCCCCoaoCCCCCCCCouo.
.oyoCCCCCCCCCCoCCCCCCCCCouo.
.oyyoCCCCCCCCCCCCCCCCCCouUo.
..oyoCCCCCCCCCCCCCCCCCCouo..
..oyyoCCCCCCCCCCCCCCCCouUo..
...ouyooCCCCCCCCCCCCoouUo...
....ouuyoooooooooooouuUo....
.....oouuuuuuuuuuuuuUoo.....
.......ooUUUUUUUUUUoo.......
.........oooooooooo.........
""")
_pipe22 = rows("""
.oooooo.
oGGggaao
oGgggaao
oGgggaao
oGgggaao
oaaaaako
.oooooo.
""")
_steam22 = rows("""
...xx..
..xppx.
.xpppxx
xppxppx
.xx.xx.
""")


def _icon22():
    cv = blank()
    stamp(cv, _pipe22, 20, 33, 'pipe')
    stamp(cv, rows("""
oooooooooooooooooooo
oGGgggggggggggggggao
oaaaaaaaaaaaaaaaaako
oooooooooooooooooooo
"""), 14, 39, 'pipe')
    stamp(cv, _gauge22, 10, 13, 'gauge')
    stamp(cv, _steam22, 5, 35, 'steam')
    stamp(cv, _steam22, 34, 36, 'steam')
    for x, y, c in ((9, 9, 'Y'), (10, 10, 'W'), (38, 9, 'Y'), (37, 10, 'W'), (40, 14, 'Y'), (6, 14, 'Y'), (24, 9, 'W'), (25, 8, 'Y')):
        cv[y][x] = c
    return cv


ICONS[22] = _icon22

# 23 최후의 저항: a round shield cracked and stuck with arrows, gold-rimmed, a sword standing behind it
_shield23 = rows("""
..........oooooooooo..........
.......oooYYYYYYYYYYyooo......
.....ooYYYyyyyyyyyyyyyuuoo....
....oYYyyDDDDDDDDDDDDyyuuo....
...oYyyDDDDDDDDDDDDDDDDyuuo...
..oYyDDDDDDDDDDDDDDDDDDDdyuo..
..oYyDDDDDDDDDdDDDDDDDDDdyuo..
.oYyDDDDDDDDDDdDDDDDDDDDDdyuo.
.oYyDDDDDDDDDdoDDDDDDDDDDdyuo.
.oYyDDDDDDDDdoDDDDDDDDDDDdyuo.
oYyDDDDDDDDDDdoooYYYoDDDDDdyuo
oYyDDDDDDDDDDDDoYWYyyoDDDDdyuo
oYyDDDDDDDDDDDDoYYyyuoDDDDdyuo
oYyDDDDDDDDDDDDoYyyuuoDDDDdyuo
oYyDDDDDDDDDDDDDoyuuoDDDDDdyuo
oYyDDDDDDDDDDDDDDooodDDDDDdyuo
.oYyDDDDDDDDDDDDDDDdoDDDDdyuo.
.oYyDDDDDDDDDDDDDDDDdoDDDdyuo.
.oYyDDDDDDDDDDDDDDDDDdoDDdyuo.
..oyyDDDDDDDDDDDDDDDDDDDdyuo..
..oyyddDDDDDDDDDDDDDDDDddyuo..
...ouyyddddDDDDDDDDdddddyuo...
....ouuyyddddddddddddyyuuo....
.....oouuuyyyyyyyyyyuuuoo.....
.......ooouuuuuuuuuuooo.......
..........oooooooooo..........
""")
_sword23 = rows("""
..........oo
.........oGo
........oGWo
.......oGgo.
......oGgo..
.....oGgo...
....oGgo....
..ooGgo.....
.oyoGoo.....
oyYyoo......
.oyoyo......
..oooYo.....
.....ooo....
""")
_arrow23 = rows("""
oo......
oWo.....
.oDo....
..oDo...
...oDo..
....oDo.
.....oko
......oo
""")


def _icon23():
    cv = blank()
    stamp(cv, _sword23, 29, 2, 'sword')
    stamp(cv, [r[::-1] for r in _sword23], 7, 2, 'sword')
    stamp(cv, _shield23, 9, 12, 'shield')
    stamp(cv, _arrow23, 13, 17, 'arrow')
    stamp(cv, [r[::-1] for r in _arrow23], 30, 23, 'arrow')
    return cv


ICONS[23] = _icon23


# 24 현상금 장부: an open ledger of bounties, a red skull stamp on the page, a quill laid across, a coin
_book24 = rows("""
...oooooooooooooo..oooooooooooooo...
..oCCCCCCCCCCCCCCooCCCCCCCCCCCCCCo..
..oCWCCCCCCCCCCCcoocCCCCCCCCCCCCCo..
..oCccccccccccCCcoocCCcccccccccCCo..
..oCCCCCCCCCCCCCcoocCCCCCCCCCCCCCo..
..oCcccccccccCCCcoocCCrrrrrCCCCCCo..
..oCCCCCCCCCCCCCcoocCrRCCCRrCCCCCo..
..oCccccccccccCCcoocCrCooCoCrCCCCo..
..oCCCCCCCCCCCCCcoocCrCCCCCCrCCCCo..
..oCcccccccCCCCCcoocCrRCooCRrCCCCo..
..oCCCCCCCCCCCCCcoocCCrRRRRrCCCCCo..
..oCccccccccccCCcoocCCCrrrrCCCCCCo..
..oCCCCCCCCCCCCCcoocCCCCCCCCCCCCCo..
..oCcccccccccCCCcoocCCcccccccccCCo..
..oCCCCCCCCCCCCCcoocCCCCCCCCCCCCCo..
.oocccccccccccccccoccccccccccccccoo.
obbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbo
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
.oooooooooooooooooooooooooooooooooo.
""")
_quill24 = rows("""
..............oo
............ooWo
..........ooWWpo
........ooWWppo.
......ooWWppxo..
.....oWWppxxo...
....oWppxxoo....
...oWpxxoo......
...oxxoo........
..oKoo..........
.oKo............
oKo.............
oo..............
""")


def _icon24():
    cv = blank()
    stamp(cv, _book24, 6, 16, 'ledger')
    stamp(cv, _quill24, 26, 4, 'quill')
    stamp(cv, _coin, 6, 9, 'coin')
    return cv


ICONS[24] = _icon24

# 25 고물 자루: a burlap sack bursting with scrap: a gear, bolts, a pipe and a spring
_sack25 = rows("""
.....oooooooooooooooo.....
....oJJJJJJJJJJJJJJJNo....
.....oNNNNNNNNNNNNNNo.....
......oJJJJJJJJJJJNo......
....ooJJJJJJJJJJJJJNoo....
...oJJJJJJJJJJJJJJJJNNo...
..oJJCJJJJJJJJJJJJJJJNNo..
.oJJCJJJJJJJNJJJJJJJJJNNo.
.oJCJJJJJJJJJNJJJJJJJJNNo.
oJJJJJJJJJJJJJNJJJJJJJJNNo
oJJJJJJJJJJJJJJJJJJJJJJNNo
oJJJJJJJJJJJJJJJJJJJJJJNNo
oJJJJJJJJJJJJJJJJJJJJJNNNo
oNJJJJJJJJJJJJJJJJJJJJNNNo
.oNJJJJJJJJJJJJJJJJJJNNNo.
..oNNJJJJJJJJJJJJJJJNNNo..
...ooNNNNNNNNNNNNNNNNoo...
.....oooooooooooooooo.....
""")
_gear25 = rows("""
....oo....
.oo.oGo.oo
oGGoGgoGgo
.oGGggggo.
oGGgoooggo
oGgo..oago
.oggooago.
oGgaaaakgo
.oo.oao.oo
....oo....
""")
_bolt25 = rows("""
.oooo.
oGGgao
oaaako
.oGao.
.oGao.
.oGao.
.oGao.
..oo..
""")
_spring25 = rows("""
.oooo.
oGggao
.oooo.
oGggao
.oooo.
oGggao
.oooo.
""")
_pipe25 = rows("""
.oo.....
oGgoo...
oaGggoo.
.ooaGgao
...ooaao
.....oo.
""")


def _icon25():
    cv = blank()
    stamp(cv, _gear25, 13, 7, 'gear')
    stamp(cv, _bolt25, 24, 5, 'bolt')
    stamp(cv, _spring25, 31, 9, 'spring')
    stamp(cv, _pipe25, 20, 11, 'pipe')
    stamp(cv, _sack25, 11, 15, 'sack')
    stamp(cv, _gear25, 4, 34, 'gear')
    return cv


ICONS[25] = _icon25

# 26 야전 취사장: a field kettle steaming over a small fire, a ladle hooked on its rim
_pot26 = rows("""
....oooooooooooooooooo....
..ooaaaaaaaaaaaaaaaaaaoo..
.oaGGGGGGGGGGGGGGGGGGgaao.
oaGggggggggggggggggggggaao
oooooooooooooooooooooooooo
.oMZZMMMMMMMMMMMMMMMMmmmo.
.oMZMMMMMMMMMMMMMMMMMmmmo.
.oMZMMMMMMMMMMMMMMMMMmmmo.
.oMMMMMMMMMMMMMMMMMMMmmmo.
.oMMMMMMMMMMMMMMMMMMmmmmo.
.oMMMMMMMMMMMMMMMMMMmmmmo.
..omMMMMMMMMMMMMMMMmmmmo..
...ommmmmmmmmmmmmmmmmmo...
....oooooooooooooooooo....
""")
_ladle26 = rows("""
..oo..
.oGao.
.oGao.
.oGao.
.oGao.
oGGgao
ogaaao
.oooo.
""")
_fire26 = rows("""
.....e......e......
....eFe....eFe.....
...eFFe.e.eFWFe....
..eFWFeeFeeFWWFe...
..eFWWFFWFFWWWFe...
...eFFFWWWWWFFe....
oooooooooooooooooo.
oDDddoDDDddoDDddDo.
oddddoddddoodddddo.
.oooo.oooo..oooooo.
""")
_steam26 = rows("""
...xx......xx..
..xppx....xppx.
...xppx....xppx
..xppx....xppx.
.xppx....xppx..
..xppx....xppx.
...xx......xx..
""")


def _icon26():
    cv = blank()
    stamp(cv, _steam26, 16, 2, 'steam')
    stamp(cv, _fire26, 14, 36, 'fire')
    stamp(cv, _pot26, 11, 22, 'kettle')
    stamp(cv, _ladle26, 31, 15, 'ladle')
    # the pot's bail handle arching over it
    for x, y in ((12, 22), (12, 21), (13, 20), (14, 19), (35, 22), (35, 21), (34, 20), (33, 19)):
        cv[y][x] = 'a'
    for x in range(15, 33):
        cv[18][x] = 'a'
    return cv


ICONS[26] = _icon26

# 27 광맥 지도: an unrolled map, a dotted vein winding to a red cross, a lump of blue ore weighing it down
_map27 = rows("""
.oooo..............................oooo..
oDDddoooooooooooooooooooooooooooooodDDdo.
oDdddoCCCCCCCCCCCCCCCCCCCCCCCCCCCCodddDo.
oDdddoCCcCCCCCCCCCCCCCCCcCCCCCCCCCodddDo.
oDdddoCCCCCCCuCuCCCCCCCCCCCCCCCcCCodddDo.
oDdddoCCCCCuCCCCCuCCCCCCCCCCCCCCCCodddDo.
oDdddoCCCCuCCCCCCCuCCCCCCCcCCCCCCCodddDo.
oDdddoCcCuCCCCCCCCCuCCCCCCCCCCCCCCodddDo.
oDdddoCCCuCCCCCCCCCCuCCCCCCRCCCRCCodddDo.
oDdddoCCCCuCCCCCCCCCCuCCCCCCRCRCCCodddDo.
oDdddoCCCCCuCCCcCCCCCCuCuCCCCRCCCCodddDo.
oDdddoCCCCCCuCCCCCCCCCCCCuCCRCRCCCodddDo.
oDdddoCCcCCCCuCuCCCCCCCCCCCRCCCRCCodddDo.
oDdddoCCCCCCCCCCuCCCCcCCCCCCCCCCCCodddDo.
oDdddoCCCCCCCCCCCCCCCCCCCCCCCCcCCCodddDo.
oDdddoooooooooooooooooooooooooooooodddDo.
oDDddo.............................oddDDo
.oooo..............................oooo.
""")
_ore27 = rows("""
....oo....
...oLBo...
..oLBBbo..
.oLWBbbno.
oLBBBbbnno
obBbbbnnno
.obbbnnno.
..oonnoo..
....oo....
""")


def _icon27():
    cv = blank()
    stamp(cv, [r.replace(' ', '') for r in _map27], 4, 12, 'map')
    stamp(cv, _ore27, 6, 30, 'ore')
    for x, y in ((11, 30), (13, 41), (16, 33)):
        cv[y][x] = 'L'
    return cv


ICONS[27] = _icon27

# 28 무전 중계: a field radio with a handset, its long whip antenna throwing out rings of signal
_radio28 = rows("""
..oooooooooooooooooooooo..
.oZZZZZZZZZZZZZZZZZZZZMMo.
oZMMMMMMMMMMMMMMMMMMMMMmmo
oMMooooooooooMMMMoooMMMmmo
oMMoKkKkKkKkoMMMoYYoMMmmmo
oMMokKkKkKkKoMMMoyuoMMmmmo
oMMoKkKkKkKkoMMMMooMMMmmmo
oMMokKkKkKkKoMMMoooMMMmmmo
oMMoKkKkKkKkoMMMoRoMMMmmmo
oMMooooooooooMMMMoMMMMmmmo
oMMMMMMMMMMMMMMMMMMMMMmmmo
ommmmmmmmmmmmmmmmmmmmmmmmo
.oooooooooooooooooooooooo.
""")
_hand28 = rows("""
.oooo..
okkkko.
oko.oko
oko..ko
oko..ko
okko.oo
.ooo...
""")


def _icon28():
    cv = blank()
    stamp(cv, _radio28, 7, 26, 'radio')
    stamp(cv, _hand28, 33, 31, 'handset')
    for y in range(8, 27):
        cv[y][29], cv[y][30] = 'o', 'g' if y % 3 else 'a'
    cv[7][29], cv[7][30], cv[6][29], cv[6][30] = 'o', 'o', '.', '.'
    # rings of signal round the antenna's tip
    for x, y in ((25, 6), (24, 8), (24, 10), (25, 12), (34, 6), (35, 8), (35, 10), (34, 12),
                 (21, 4), (20, 7), (20, 10), (21, 13), (38, 4), (39, 7), (39, 10), (38, 13)):
        cv[y][x] = 'E' if (x + y) % 2 else 'R'
    return cv


ICONS[28] = _icon28

# 29 지휘관 핀: a commander's gold pin, a star with spread wings, a ruby at its heart
_pin29 = rows("""
..................oo..................
.................oYYo.................
................oYWYyo................
...............oYYYyyo................
.oooo.........oYYYYyyuo.........oooo..
oCCCCooo......oYYYyyyuo......oooCCCCo.
.oCCCCccooo..oYYYRRyyuuo..ooocccCCCo..
..ooCCCCcccooYYYREEryyuooocccCCCCoo...
....ooCCCCccoYYYRrryyuuoocCCCCoo......
......ooCCCCoyYYYyyyyuuoCCCCoo........
........oooooyyYYyyyuuuooooo..........
............oyyyoooyuuuo..............
...........oyyyo...ouuuo..............
...........ouuo.....ouuo..............
...........ooo.......ooo..............
""")
_ribbon29 = rows("""
.ooooooooooo.
obbRRRRRRRbbo
obbRRRRRRRbbo
obbRRRRRRRbbo
.obRRRRRRRbo.
.obbo...obbo.
.oo.......oo.
""")


def _icon29():
    cv = blank()
    stamp(cv, _ribbon29, 18, 30, 'ribbon')
    stamp(cv, _pin29, 5, 14, 'pin')
    return cv


ICONS[29] = _icon29


# 30 피의 계약: a contract on old parchment, a seal of blood, a dagger laid over it
_scroll30 = rows("""
.oooooooooooooooooooooo.
oDdCCCCCCCCCCCCCCCCCCdDo
odoooooooooooooooooooodo
.oCCCCCCCCCCCCCCCCCCCo..
.oCcccccccccccccccCCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oCcccccccccccccCCCCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oCccccccccccccccccCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oCcccccccccCCCCCCCCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oCCCcccccccccCCCCCCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oCCCCCCCCCCCCCCCCCCCo..
.oooooooooooooooooooooo.
oDdCCCCCCCCCCCCCCCCCCdDo
.oooooooooooooooooooooo.
""")
_seal30 = rows("""
..oooo..
.orRRro.
orREERro
oRREWRro
oRRERRro
orRRRrQo
.orrrQo.
..oooo..
""")
_dagger30 = rows("""
...........oo
..........oGo
.........oGWo
........oGgo.
.......oGgo..
......oGgo...
...o.oGgo....
...ooGgo.....
....oYo......
...oYyoo.....
..oyuo.oo....
.oRro........
oRro.........
oo...........
""")


def _icon30():
    cv = blank()
    stamp(cv, _scroll30, 8, 8, 'contract')
    stamp(cv, _seal30, 22, 27, 'seal')
    for x, y in ((24, 35), (25, 36), (24, 37), (26, 38), (25, 39)):
        cv[y][x] = 'r'
    stamp(cv, _dagger30, 30, 13, 'dagger')
    return cv


ICONS[30] = _icon30

# 31 태엽: a big clockwork key, its bow cut in two wings, turning two gears
_key31 = rows("""
.ooooo......ooooo.
oYYYYyoo..ooyyyuuo
oYWYyyyyooyyyyyyuo
oYYoooyyyyyyoooyuo
oYyo..oyyyyo..ouuo
oYyo..oyyyyo..ouuo
oYYoooyyyyyyoooyuo
oYyyyyyyooyyyyyuuo
.oyyyyyo..ouuuuuo.
..ooooooooooooooo.
.......oYyuo......
......ooooooo.....
.......oYyuo......
.......oYyuo......
.......oYyuo......
.......oYyuo......
.......oYyuo......
.......oYyuoooo...
.......oYyyyyuo...
.......oYyuoooo...
.......oYyuoo.....
.......oyyyuo.....
.......oYyuoo.....
........ooo.......
""")
_gearA31 = rows("""
.....oo.oo.....
..oo.oGgao.oo..
.oGgooGgaooGgo.
.oggGGgggggaao.
..oGgggoooggo..
ooGggoo..ooggoo
oGggo......ogao
.oGgo......oao.
oGggo......ogao
ooGggoo..ooaaoo
..oGgggoooaao..
.oggaaaaaaaako.
.oaaookkkookko.
..oo.okkko.oo..
.....oo.oo.....
""")


def _icon31():
    cv = blank()
    stamp(cv, _gearA31, 4, 25, 'gear')
    stamp(cv, _gearA31, 29, 27, 'gear')
    stamp(cv, _key31, 15, 4, 'key')
    return cv


ICONS[31] = _icon31

# 32 거울 파편: a jagged shard of mirror catching the light, a reflection glinting in it, sparkles flying off
_shard32 = rows("""
.....................oo.
....................oGo.
...................oGWo.
..................oGWGo.
.................oGWLGo.
................oGGLGgo.
...............oGGLBGgo.
..............oGGLBGggo.
.............oGGLBGgggo.
............oGGLBGggggo.
...........oGGLBGgggggo.
..........oGGLBGggggggo.
.........oGWLBGgggggaao.
........oGWLBGggggggaao.
.......oGWLBGgggggggaao.
......oGGLBGggggggggaao.
.....oGGLBGgggggggggaao.
....oGGLBGggggggggggaao.
...oGGLBGgggggggggggaao.
..oDDDDDDDDDDDDDDDDDDdo.
.oDDYDDDDDDDDDDDYDDDddo.
.oddddddddddddddddddddo.
..oooooooooooooooooooo..
""")
_sparkle = rows("""
..W..
..W..
WWWWW
..W..
..W..
""")


def _icon32():
    cv = blank()
    stamp(cv, _shard32, 12, 13, 'shard')
    stamp(cv, _sparkle, 26, 6, 'sparkle')
    stamp(cv, _sparkle, 9, 20, 'sparkle')
    for x, y in ((39, 9), (16, 12), (8, 30), (40, 14)):
        cv[y][x] = 'i'
    return cv


ICONS[32] = _icon32

# 33 감염된 심장: a zombie's heart, grey-green and swollen, veins bulging purple, sick drops running off it
_heart33 = rows("""
....oooooooo....oooooooo....
..ooZZMMMMMMooooMMMMMMmmoo..
.oZZZMMMMMMMMooMMMMMMMMmmmo.
oZZVZMMMMjMMMmmMMMMMjMMmmmmo
oZZMMMMMjMMMMMMMMMMjMMMmmmmo
oZMMMMMjMMMMMMMMMMjMMMmmmmmo
oZMMMMMjjMMMMMMMMjMMMMmmmmmo
oMMMMMMMjjMMMMMjjMMMMMmmmmmo
oMMMMMMMMjjjjjjjMMMMMmmmmmmo
omMMMMMMMMMjMMMMMMMMMmmmmmmo
.omMMMMMMMMjMMMMMMMMmmmmmmo.
.ommMMMMMMMjMMMMMMMMmmmmmmo.
..ommMMMMMMjMMMMMMMmmmmmmo..
...ommMMMMMjjMMMMMmmmmmmo...
....ommMMMMMjMMMMmmmmmmo....
.....ommMMMMjMMMmmmmmmo.....
......ommMMMMMMmmmmmmo......
.......ommMMMMmmmmmmo.......
........ommMMmmmmmmo........
.........ommmmmmmmo.........
..........ommmmmmo..........
...........ommmmo...........
............ommo............
.............oo.............
""")
_drip33 = rows("""
.o.
oVo
oVo
oZo
.o.
""")


def _icon33():
    cv = blank()
    stamp(cv, _vessel17, 14, 8, 'vessel')
    stamp(cv, _vessel17, 25, 7, 'vessel')
    stamp(cv, _heart33, 10, 11, 'heart')
    for (x, y) in ((14, 31), (31, 32), (22, 36)):
        stamp(cv, _drip33, x, y, 'drip')
    for x, y in ((15, 37), (32, 38), (23, 42)):
        cv[y][x] = 'V'
    # the vessels sicken too
    for y in range(7, 13):
        for x in range(13, 33):
            if cv[y][x] in 'RE':
                cv[y][x] = 'M'
            elif cv[y][x] in 'r':
                cv[y][x] = 'm'
    return cv


ICONS[33] = _icon33

# 34 연금술 화로: a squat iron furnace, its mouth glowing, gold ingots and coins spilling out in front of it
_furnace34 = rows("""
...........oooo..........
...........oaao..........
...........oGao..........
.........oooooooo........
.......ooGGGGGGgaoo......
.....ooGGggggggggaaoo....
....oGggggggggggggaako...
...oGgggggggggggggaaako..
...oggg|ooooooo|ggaaako..
..oGggoFFFFFFFFFoggaakko.
..oggoFFWWWWWWFFfoggakko.
..oggoFWWWWWWWWFfoggakko.
..oggofFFWWWWFFffogaakko.
..oggoeffFFFFfffeoaaakko.
..oggoooooooooooooaaakko.
..oGgggggggggggggggaakko.
..oaaaaaaaaaaaaaaaaaakko.
..okkkkkkkkkkkkkkkkkkkko.
.oooooooooooooooooooooooo
""".replace('|', 'o'))
_ingot34 = rows("""
..oooooooo.
.oYYYYYYYyo
oYWYYYYYyuo
oyyyyyyyuuo
oooooooooo.
""")


def _icon34():
    cv = blank()
    stamp(cv, _furnace34, 11, 6, 'furnace')
    stamp(cv, _ingot34, 7, 36, 'ingot')
    stamp(cv, _ingot34, 10, 32, 'ingot')
    stamp(cv, _coin, 25, 36, 'coin')
    stamp(cv, _coin, 32, 37, 'coin')
    stamp(cv, _coin, 29, 33, 'coin')
    for x, y, c in ((17, 4, 'x'), (16, 2, 'p'), (24, 3, 'x'), (25, 1, 'p'), (8, 25, 'Y'), (40, 24, 'Y'), (41, 30, 'W')):
        cv[y][x] = c
    return cv


ICONS[34] = _icon34

# 35 끝없는 탄띠: an ammunition belt that never ends, looped round on itself in a figure of eight
_inf35 = rows("""
.....oooooooo..............oooooooo.....
...ooHHHHHHHHoo..........ooHHHHHHHHoo...
..oHHddddddddHHo........oHHddddddddHHo..
.oHddo......odHHo......oHHdo......oddHo.
oHddo........odHHo....oHHdo........oddHo
oHdo..........odHHo..oHHdo..........odHo
oHdo...........odHHooHHdo...........odHo
oHdo............odHHHHdo............odHo
oHdo.............oHHHHo.............odHo
oHdo............odHHHHdo............odHo
oHdo...........odHHooHHdo...........odHo
oHdo..........odHHo..oHHdo..........odHo
oHddo........odHHo....oHHdo........oddHo
.oHddo......odHHo......oHHdo......oddHo.
..oHHddddddddHHo........oHHddddddddHHo..
...ooHHHHHHHHoo..........ooHHHHHHHHoo...
.....oooooooo..............oooooooo.....
""")
_rnd35 = rows("""
.o.
oGo
oYo
oyo
""")


def _icon35():
    cv = blank()
    stamp(cv, _inf35, 4, 16, 'belt')
    # rounds standing out of the belt all the way round
    for x, y in ((9, 13), (13, 12), (17, 12), (21, 13), (29, 13), (33, 12), (37, 12), (41, 13),
                 (5, 18), (44, 18), (24, 22)):
        stamp(cv, _rnd35, x - 1, y, 'round')
    for x, y in ((9, 34), (13, 35), (17, 35), (29, 35), (33, 35), (37, 34)):
        stamp(cv, flipv(_rnd35), x - 1, y - 1, 'round')
    stamp(cv, _sparkle, 21, 3, 'sparkle')
    return cv


ICONS[35] = _icon35


def build_icon(rid, grade):
    cv = ICONS[rid]()
    frame(cv, grade)
    out = [''.join(r) for r in cv]
    used = set(''.join(out)) - {'.'}
    pal = dict(PAL)
    pal['7'], pal['8'], pal['9'] = GRADE_TONES[grade]
    missing = used - set(pal)
    if missing:
        raise ValueError(f'relic {rid}: letters without a colour {missing}')
    return {'w': N, 'h': N, 'rows': out, 'pal': {k: pal[k] for k in sorted(used)}}


def relic_table():
    """RELICS from src/logic/relics.mjs (read only): id, name, group, grade"""
    src = open(os.path.join(GAME, 'src', 'logic', 'relics.mjs'), encoding='utf-8').read()
    groups = re.findall(r"'([^']+)'", re.search(r'export const GROUPS = \[(.*?)\];', src).group(1))
    out = {}
    for m in re.finditer(r"R\((\d+), '([^']+)', (\d+), (\d+), '([^']*)'", src):
        rid, name, grp, grade, desc = int(m.group(1)), m.group(2), int(m.group(3)), int(m.group(4)), m.group(5)
        out[rid] = dict(id=rid, name=name, group=groups[grp], grade=grade, desc=desc)
    assert len(out) == 48, len(out)
    return out


def build():
    table = relic_table()
    return {rid: dict(build_icon(rid, table[rid]['grade']), name=table[rid]['name'], grade=table[rid]['grade'])
            for rid in sorted(ICONS)}


def write_js(icons):
    head = """'use strict';
// Relic icons: ART_RELICS[id] = {w, h, rows, pal, name, grade} for the 48 relics of src/logic/relics.mjs (by id),
// generated by tools/relics.py - edit that, not this file. 48x48, every pixel placed by hand; the corners carry
// the grade colour. rows: palette letters per pixel, '.' = nothing; pal: {letter: [r, g, b]}.
"""
    data = {str(k): v for k, v in icons.items()}
    with open(os.path.join(GAME, 'art', 'relics.js'), 'w', encoding='utf-8') as fh:
        fh.write(head + 'window.ART_RELICS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')


# ---------------------------------------------------------------- the sheet
RAINBOW = [(224, 69, 69), (240, 176, 32), (69, 192, 112), (69, 144, 224), (160, 80, 224)]


def sheet(path, icons, scale=2):
    from PIL import Image, ImageDraw, ImageFont
    try:
        f = ImageFont.truetype('/usr/share/fonts/opentype/unifont/unifont.otf', 16)
    except OSError:
        f = ImageFont.load_default()
    table = relic_table()
    cols, size = 6, N * scale + 12
    cw, ch = size + 24, size + 64
    groups = ['탄도', '원소', '공성', '요새', '지휘', '이상', '생존', '연구']
    present = sorted(icons)
    rows_n = len({table[i]['group'] for i in present})
    im = Image.new('RGB', (cols * cw + 120, rows_n * ch + 50), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.text((16, 12), f'유물 아이콘 ({N}×{N}, {scale}배) · 분류마다 한 줄, 칸 테두리는 UI 등급색', font=f, fill=(28, 27, 25))
    y = 44
    for gname in groups:
        ids = [i for i in present if table[i]['group'] == gname]
        if not ids:
            continue
        d.text((16, y + size // 2 - 8), gname, font=f, fill=(28, 27, 25))
        for n, rid in enumerate(sorted(ids)):
            x = 100 + n * cw
            g = table[rid]['grade']
            d.rectangle((x, y, x + size - 1, y + size - 1), fill=(246, 244, 239))
            if g == 7:
                for k in range(size):
                    c = RAINBOW[min(4, k * 5 // size)]
                    d.line((x + k, y, x + k, y + 1), fill=c); d.line((x + k, y + size - 2, x + k, y + size - 1), fill=c)
                d.line((x, y, x, y + size), fill=RAINBOW[0], width=2); d.line((x + size - 2, y, x + size - 2, y + size), fill=RAINBOW[4], width=2)
            else:
                d.rectangle((x, y, x + size - 1, y + size - 1), outline=tuple(GRADE_UI[g]), width=2)
            ic = icons[rid]
            for yy, row in enumerate(ic['rows']):
                for xx, c in enumerate(row):
                    if c != '.':
                        d.rectangle((x + 6 + xx * scale, y + 6 + yy * scale, x + 6 + xx * scale + scale - 1, y + 6 + yy * scale + scale - 1), fill=tuple(ic['pal'][c]))
            name = table[rid]['name']
            tw = d.textlength(name, font=f)
            d.text((x + (size - tw) / 2, y + size + 4), name, font=f, fill=(28, 27, 25))
            gt = GRADE_NAMES[g]
            d.text((x + (size - d.textlength(gt, font=f)) / 2, y + size + 22), gt, font=f, fill=tuple(GRADE_UI[g]))
        y += ch
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


if __name__ == '__main__':
    icons = build()
    write_js(icons)
    print('art/relics.js:', len(icons), 'icons')
    if '--sheet' in sys.argv:
        sheet(os.path.join(GAME, 'samples', 'relics', 'sheet.png'), icons)
