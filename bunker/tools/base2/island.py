"""The floating island of the base sample: grass top, soil cliff, rocky underside.

Everything here is drawn by hand as letter grids and placed by hand:
- the grass top is a flat base colour with hand-drawn clusters (light turf, dark hollows, dry patches)
  and tufts stamped at chosen screen spots, mostly along cluster edges, never scattered evenly;
- the two cliff faces are long hand-typed strips in face space (u across, v down), so their strata
  follow the island edge on the 2-1 slant; the left face is lit, the right face in shade;
- the underside hangs below the soil as a rock mass whose depth per 2 px column is typed by hand.

Island: R steps from the centre each way (2R x 2R steps = 4R x 2R px on screen).
"""
import numpy as np

from canvas import grid
from pal import CLEAR, N, DARK

R = 28

# ============================================================================ grass
# tones: S deep shade, D dark, B base, L light, H highlight tip, Y dry, y dry dark, flowers w p f
GRASS = dict(S=N['fern'], D=N['pine'], B=N['leaf'], L=N['mint'], H=N['sprout'], Y=N['moss'], y=N['olive'],
             w=N['foam'], p=N['salmon'], f=N['gold'], o=N['abyss'])

LIGHT_PATCHES = [
    ["..........LLLLL...............",
     ".....LLLLLLLLLLLLLLL..........",
     "...LLLLHHLLLLLLLLLLLLLLL......",
     ".LLLLLHHLLLLLLLLLLLLLLLLLLL...",
     "LLLLLLLLLLLLLLLLLLLLLLLLLLLLLL",
     "..LLLLLLLLLLLLLLLLLLLLLLLLL...",
     ".....LLLLLLLLLLLL..LLLLL......",
     "..........LLLL................"],
    ["......LLLLLLL.......",
     "...LLLLHHLLLLLLL....",
     ".LLLLHHLLLLLLLLLLL..",
     "LLLLLLLLLLLLLLLLLLLL",
     "..LLLLLLLLLLLLLLLL..",
     "....LLLLLL..LLL....."],
    ["....LLLLLL.........",
     ".LLLLHLLLLLLLL.....",
     "LLLHHLLLLLLLLLLLL..",
     "LLLLLLLLLLLLLLLLLLL",
     ".LLLLLLLLLLLLLLLL..",
     "...LLLLLLLLLL......",
     ".......LLL........."],
    ["...LLLLL.....",
     ".LLLHLLLLLL..",
     "LLLLLLLLLLLLL",
     ".LLLLLLLLLL..",
     "...LLLLL....."],
    [".LLLL...",
     "LLHLLLL.",
     "LLLLLLLL",
     "..LLLL.."],
]
DARK_PATCHES = [
    [".......DDDDD...........",
     "...DDDDDDDDDDDDDD......",
     "DDDDDDDDDDDDDDDDDDDDDD.",
     ".DDDDDDDDDDDDDDDDDDDDDD",
     "....DDDDDDDDDDDDDD.....",
     "........DDDDDD........."],
    ["....DDDDDD......",
     ".DDDDDDDDDDDDD..",
     "DDDDDDDDDDDDDDDD",
     "..DDDDDDDDDDD...",
     ".....DDDD......."],
    ["..DDDD....",
     "DDDDDDDDD.",
     ".DDDDDDDDD",
     "...DDDD..."],
    [".DDD..",
     "DDDDDD",
     "..DDD."],
]
DRY_PATCHES = [
    ["....YYYY.......",
     ".YYYYyYYYYYY...",
     "YYYyYYYYYYYYYY.",
     ".YYYYYYYyYYYYYY",
     "...YYYYYYYYY...",
     "......YYY......"],
    ["..YYYY...",
     "YYYyYYYY.",
     ".YYYYYYYY",
     "...YYY..."],
]
TUFTS = [
    ["H.H",
     "LHD",
     ".D."],
    [".H..H",
     "HLHLD",
     ".DLD.",
     "..D.."],
    ["..H..",
     ".HLH.",
     "HLDLD",
     ".D.D."],
    ["H.H.H.",
     "LHLHLD",
     ".DLDD.",
     "..D..."],
    ["L.L",
     ".D."],
    [".L.",
     "LDL"],
    ["Y.Y",
     "yYy",
     ".y."],
    ["..Y..",
     "Y.YY.",
     "yYyYy",
     ".y.y."],
]
FLOWERS = [
    ["w.",
     "Dw"],
    [".w.",
     "wfw",
     ".D."],
    ["p..",
     "D.p",
     "..D"],
    [".f",
     "fD"],
]

# hand placement: CENTRE of each sprite, screen offsets from the island centre. The ring between the
# fence (|dx|/2 + |dy| = 36) and the edge (= 56) is where the grass shows; the yard covers the middle.
LIGHT_AT = [(0, -58, -20), (1, -16, -44), (2, 34, -36), (3, 74, -12), (4, -90, 0), (3, -84, -6),
            (2, 46, 26), (4, 86, 4), (4, -22, 40), (3, -62, 18), (4, 12, -48), (1, 70, 14),
            (4, -40, -28), (3, 0, 44)]
DARK_AT = [(0, -10, 48), (1, -76, 12), (1, 62, 22), (2, 96, 2), (3, -100, 2), (2, 26, 44),
           (3, -44, 34), (2, -74, -10), (3, 88, -10), (2, -2, -50), (3, 40, 36), (3, -30, -40)]
DRY_AT = [(0, 56, -24), (1, -50, -30), (1, 80, 16)]
TUFT_AT = [(1, -70, -18), (0, -64, -14), (4, -52, -22), (2, -28, -40), (0, -20, -46), (3, 28, -40),
           (5, 40, -34), (0, 46, -30), (1, 68, -16), (4, 80, -10), (6, 60, -26), (7, 50, -30),
           (2, -92, -4), (0, -86, -2), (5, -60, 22), (1, -52, 26), (0, 50, 22), (4, 58, 28),
           (2, 66, 18), (3, -18, 44), (0, -8, 48), (4, 32, 40), (6, -46, -28), (2, 92, -2),
           (0, 98, 2), (1, 8, -48), (5, 16, -46), (2, -78, 10), (6, 84, 12), (0, -96, 4),
           (4, 74, 18), (1, 24, 44), (5, -30, 40), (0, 6, 50), (3, -66, 14), (4, 36, -42)]
FLOWER_AT = [(0, -62, -22), (1, -24, -42), (2, 44, -32), (0, 76, -8), (3, -54, 24), (1, 60, 26),
             (2, -12, 46), (0, 90, 4), (3, -88, 6), (1, 18, 46)]

# ============================================================================ cliff (face space)
# h lit lip, g grass, G dark grass, t topsoil, 1 dark soil, 2 soil, 3 lit soil, r root,
# a b c d stone dark..light, o outline
LIT = dict(h=N['mint'], g=N['leaf'], G=N['pine'], t=N['plum'],
           **{'1': N['plum'], '2': N['rust'], '3': N['copper'], '4': N['tan']},
           r=N['grape'], a=N['slate'], b=N['stone'], c=N['lilac'], d=N['mist'], o=N['ink'])
SHADE = dict(h=N['leaf'], g=N['pine'], G=N['abyss'], t=N['grape'],
             **{'1': N['grape'], '2': N['plum'], '3': N['rust'], '4': N['copper']},
             r=N['ink'], a=N['ink'], b=N['slate'], c=N['stone'], d=N['lilac'], o=N['ink'])

# the soil band right under the grass, typed as 28-column pieces (a face is a sequence of pieces)
SOIL = {
    'A': ["gggGgggggggggGgggggggggGgggg",
          "GgGGGgGGGGgGGGGGgGGGgGGGGgGG",
          "tGttGtttGttttGttGttttGtttGtt",
          "tttttttttttttttttttttttrtttt",
          "t333tttt3333ttt33333tt3r33tt",
          "3322233322223332222233222r33",
          "222222222222222bcd222222r222",
          "2222222222222bbbcc2222222222",
          "222abc2222222abbb22222222222",
          "22abbcd2222222aa222222222112",
          "221abbb22222211222222221111",
          "1111aa1122221111122222111111",
          "1111111111111111111111111111"],
    'B': ["ggggggGgggggggggggGggggggggg",
          "GGgGGGGGgGGGGGgGGGGGGgGGGgGG",
          "ttGtttttGttttttGttttttGttttt",
          "ttttrttttttttttttttttrtttttt",
          "33t3r33333tt3333tttt3r33333t",
          "2223r2222233322223333r222233",
          "2222r222222222222222222r2222",
          "2222222222222bcd22222222r222",
          "222222222222bbbcc22222222222",
          "2222222222221aabb22222bcd222",
          "1222222221111111112222abb112",
          "111222211111111111111111a111",
          "1111111111111111111111111111"],
    'C': ["gggggggGgggggggggggggGgggggg",
          "GGGgGGGGGGGgGGGGgGGGGGGGgGGG",
          "tttGtttGtttttttGttttGttttttt",
          "ttttttttttrttttttttttttttrtt",
          "t3333ttt33r33333tt33333tt3r3",
          "2222233322r22222332222333r22",
          "222bcd222222r22222222222222r",
          "22bbbcd222222222222222bcd222",
          "222abbb22222222222222abbb222",
          "1222aa2222222222111222aa2221",
          "1112222221111111111112222111",
          "1111112211111111111111111111",
          "1111111111111111111111111111"],
    'D': ["gggggGggggggggggGgggggggggGg",
          "GGGGGGGgGGGGGGGGGGGgGGGGGGGG",
          "ttGttttttGtttttGttttttGttttt",
          "tttrttttttttttttttttrttttttt",
          "33tr3333tt333333ttt3r33333tt",
          "222r22223332222222333r222222",
          "2222r222222222222bcd22222222",
          "22222222bcd2222bbbcc22222222",
          "2222222bbbcc222abbb222222222",
          "222222222abb22221aa222222221",
          "11222222211111111112222221111"[:28],
          "1111222111111111111111221111",
          "1111111111111111111111111111"],
}
SOIL_ROWS = 13
LEFT_PIECES = 'ABCD'
RIGHT_PIECES = 'CADB'

# deeper soil under the band: dark earth with a few lighter pockets and buried stones (28 wide, cycles)
DEEP = [
    "1111111111112111111111111111",
    "1112211111122211111111111211",
    "1122221111111111111111112221",
    "1111111111111111111b11111111",
    "11111bc1111111111bbc11111111",
    "1111abb1111111111abb11111111",
    "11111a11111111111111111111b1",
    "1111111111112221111111111bbc",
    "1111111111122222111111111ab1",
    "11211111111111111111111111111"[:28],
    "1222111111111111111bc1111111",
    "1111111111111111111ab1111111",
]

# depth of the cliff under the top edge, one number per 2 px column (56 per face, 112 px). Left face:
# from the left corner (shallow) to the front corner; right face: from the front corner to the right
# corner. The underside tapers toward the front corner in three lumpy lobes.
DEPTH_L = [11, 11, 12, 12, 12, 13, 13, 13, 14, 14, 15, 16, 17, 17, 16, 15, 15, 15, 16, 17,
           18, 19, 19, 18, 17, 17, 18, 19, 20, 21, 22, 23, 23, 22, 22, 23, 24, 25, 26, 27,
           28, 28, 29, 30, 30, 31, 32, 32, 33, 34, 34, 35, 36, 37, 38, 38]
DEPTH_R = [38, 37, 36, 36, 35, 34, 33, 31, 30, 29, 28, 28, 27, 26, 24, 23, 22, 22, 23, 23,
           22, 21, 20, 19, 18, 17, 17, 16, 16, 17, 18, 18, 17, 16, 15, 15, 14, 14, 13, 13,
           14, 15, 15, 14, 13, 13, 12, 12, 12, 11, 11, 11, 11, 11, 11, 11]

# roots hanging from the bottom edge: (u, length) per face
ROOTS_L = [(13, 3), (31, 4), (47, 2), (66, 5), (79, 3), (95, 4), (104, 2)]
ROOTS_R = [(7, 4), (22, 3), (39, 5), (58, 2), (71, 4), (88, 3)]


def _face_tex(pieces, rmp, depth, roots, mirror=False):
    strip = [''.join(SOIL[p][v] for p in pieces) for v in range(SOIL_ROWS)]
    rootcols = {}
    for u0, ln in roots:
        rootcols[u0] = ln

    def f(u, v):
        if u < 0 or u >= 4 * R:
            return CLEAR
        d = depth[min(len(depth) - 1, u // 2)]
        if v >= d:
            ln = rootcols.get(u, 0)
            if v < d + ln:
                return rmp['r']
            return CLEAR
        if v == d - 1:
            return rmp['o']
        uu = (4 * R - 1 - u) if mirror else u
        if v < SOIL_ROWS:
            return rmp[strip[v][uu % len(strip[v])]]
        row = DEEP[(v - SOIL_ROWS) % len(DEEP)]
        return rmp[row[(uu + 7 * ((v - SOIL_ROWS) // len(DEEP))) % len(row)]]
    return f


def draw_cliff(cv):
    cv.left(-R, R, R, -60, 0, _face_tex(LEFT_PIECES, LIT, DEPTH_L, ROOTS_L), kind=1)
    cv.right(R, -R, R, -60, 0, _face_tex(RIGHT_PIECES, SHADE, DEPTH_R, ROOTS_R, mirror=True), kind=1)
    # the front corner edge: one lit column on the left face's last column
    sx, sy = cv.proj(R, R)
    sx, sy = int(sx), int(sy)
    for v in range(1, DEPTH_L[-1] - 2):
        y = sy + v
        if 0 <= y < cv.h and cv.a[y, sx - 1] not in (CLEAR,) and v > 2:
            c = cv.a[y, sx - 1]
            if c == LIT['2']:
                cv.a[y, sx - 1] = LIT['3']
            elif c == LIT['1']:
                cv.a[y, sx - 1] = LIT['2']


# ============================================================================ top
def _top_mask(cv):
    m = np.zeros((cv.h, cv.w), bool)
    for py in range(cv.h):
        for px in range(cv.w):
            d = (px + .5 - cv.ox) / 2
            s = py + .5 - cv.oy
            wx, wy = (s + d) / 2, (s - d) / 2
            m[py, px] = -R <= wx < R and -R <= wy < R
    return m


def draw_top(cv):
    m = _top_mask(cv)
    cv.a[m] = GRASS['B']
    cv.kind[m] = 1
    cx, cy = cv.ox, cv.oy

    def put_all(sprites, placed):
        for k, dx, dy in placed:
            spr = grid(sprites[k], GRASS)
            h, w = spr.shape
            for j in range(h):
                for i in range(w):
                    c = spr[j, i]
                    x, y = cx + dx - w // 2 + i, cy + dy - h // 2 + j
                    if c != CLEAR and 0 <= x < cv.w and 0 <= y < cv.h and m[y, x]:
                        cv.a[y, x] = c
    put_all(DARK_PATCHES, DARK_AT)
    put_all(LIGHT_PATCHES, LIGHT_AT)
    put_all(DRY_PATCHES, DRY_AT)
    put_all(TUFTS, TUFT_AT)
    put_all(FLOWERS, FLOWER_AT)
    return m


def draw_rims(cv, m):
    """lit rim on the back-left edge, dark rim on the back-right edge, rounded corners"""
    H, W = m.shape
    for px in range(W):
        ys = np.nonzero(m[:, px])[0]
        if not len(ys):
            continue
        top = ys[0]
        d = (px + .5 - cv.ox)
        if d < 0:     # back-left edge: catches the light
            cv.a[top, px] = GRASS['H']
            if top + 1 < H and m[top + 1, px] and px % 7 not in (0, 3):
                cv.a[top + 1, px] = GRASS['L']
        else:         # back-right edge: a dark lip
            cv.a[top, px] = GRASS['D']
    # round the three outer corners by one pixel
    for (wx, wy) in ((-R, -R), (-R, R), (R, -R)):
        sx, sy = cv.proj(wx, wy)
        sx, sy = int(sx), int(sy)
        for dx, dy in ((-1, 0), (0, 0), (-1, -1), (0, -1)):
            x, y = sx + dx, sy + dy
            if 0 <= x < W and 0 <= y < H and (wx, wy) == (-R, -R):
                cv.a[y, x], cv.kind[y, x] = CLEAR, 0


def draw(cv):
    draw_cliff(cv)
    m = draw_top(cv)
    draw_rims(cv, m)
    return m
