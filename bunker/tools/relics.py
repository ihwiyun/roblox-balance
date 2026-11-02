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
