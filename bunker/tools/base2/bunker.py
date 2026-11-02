"""The makeshift-era bunker at three steps (Lv1, Lv11, Lv21), its yard, fence and props.

World units: x to screen right-down, y to screen left-down, z up (canvas.py). The bunker sits at the
island centre. Every board, bag course, sheet, rust blob, door and prop below is typed by hand or
placed by hand; the code only shears face drawings onto the walls, orders layers and outlines them.
"""
import json
import os

import numpy as np

import materials as M
import props as P
from canvas import Canvas, grid
from pal import CLEAR, DARK, N

HERE = os.path.dirname(os.path.abspath(__file__))


# ============================================================================ helpers
def outline(lay, ink=N['ink']):
    """inner outline of one layer's silhouette: edges open to the sky (above) get one ramp step darker
    than themselves, every other open edge gets ink."""
    a = lay.a
    m = a != CLEAR
    pad = np.pad(~m, 1, constant_values=True)
    up, dn, lf, rt = pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]
    edge = m & (up | dn | lf | rt)
    soft = edge & up & ~dn
    hard = edge & ~soft
    out = a.copy()
    out[hard] = ink
    ys, xs = np.nonzero(soft)
    for y, x in zip(ys, xs):
        out[y, x] = DARK.get(int(a[y, x]), int(a[y, x]))
    lay.a = out
    return lay


def place(cv, sprite, anchor, x, y, z=0, mirror=False, kind=2):
    sp = sprite[:, ::-1] if mirror else sprite
    ax, ay = anchor
    if mirror:
        ax = sprite.shape[1] - 1 - ax
    sx, sy = cv.proj(x, y, z)
    cv.blit(sp, int(np.floor(sx)) - ax, int(np.floor(sy)) - ay, kind)


def ground_shadow(cv, poly):
    """hard cast shadow on the ground (only ground pixels darken)"""
    cv.shade(poly, DARK, z=0, only=(1,))


def box_shadow(cv, x0, x1, y0, y1, h, k=.3):
    """the shadow of an upright box: light from the top-left, so it falls toward +x (screen lower-right)
    and a little toward +y"""
    dx, dy = h * k, h * k * .3
    ground_shadow(cv, [(x0, y0), (x1, y0), (x1 + dx, y0 + dy), (x1 + dx, y1 + dy), (x0 + dx, y1 + dy), (x0, y1)])


# ============================================================================ roof boards
# each board: (look, extension at the back-left end, at the front-right end, 4 rows of board space).
# row 0 is the gap/edge line, rows 1..3 the board; columns run along the board, 1 px each.
# o gap, 1 shade/grain, 2 body, 3 lit, 4 bright edge, n nail head
def board_rows(rows, length):
    return [r[:length] if len(r) >= length else r + r[-1] * (length - len(r)) for r in rows]


def plank_roof(lay, x0, x1, y0, z0, boards, thick=2):
    """boards laid along x, 2 steps wide each, from y0 toward +y; their own ends stick out unevenly"""
    y = y0
    n = len(boards)
    for k, (look, e0, e1, rows) in enumerate(boards):
        bx0, bx1 = x0 - e0, x1 + e1
        length = int(round(2 * (bx1 - bx0))) + 2
        rr = board_rows(rows, length)
        rmp = M.WOOD[look + '_top' if look else 'top']
        side = M.WOOD[look + '_lit' if look else 'lit']
        shade = M.WOOD[look + '_shade' if look else 'shade']
        yb = y
        first = k == 0

        def tex(wx, wy, px, py, rr=rr, yb=yb, bx0=bx0, rmp=rmp, first=first):
            r = int((wy - yb) * 2)
            col = int((wx - bx0) * 2 + (wy - yb) * 0)
            r = min(3, max(0, r))
            ch = rr[r][min(len(rr[r]) - 1, max(0, col))]
            if r == 0 and first and ch == 'o':
                ch = '3'
            return rmp[ch]
        lay.top(bx0, bx1, yb, yb + 2, z0 + thick, tex)
        # the board's end grain on the front-right
        lay.right(bx1, yb, yb + 2, z0, z0 + thick,
                  lambda u, v, s=shade: s['4'] if v == 0 and u < 3 else (s['3'] if v == 0 else s['2']))
        if k == n - 1:     # the last board's long side shows on the front-left
            lay.left(bx0, bx1, yb + 2, z0, z0 + thick,
                     lambda u, v, s=side: s['3'] if v == 0 else (s['2'] if u % 9 else s['1']))
        y += 2


def top_grid(lay, x0, x1, y0, y1, z, rows, rmp):
    """a hand-typed grid laid flat on a top face: row r covers half a step of y (1 px on screen),
    column c half a step of x; '.' leaves what is below"""
    def tex(wx, wy, px, py):
        r = int((wy - y0) * 2)
        c = int((wx - x0) * 2)
        if 0 <= r < len(rows) and 0 <= c < len(rows[r]):
            ch = rows[r][c]
            if ch != '.':
                return rmp[ch]
        return lay.get(px, py)
    lay.top(x0, x1, y0, y1, z, tex)


# ============================================================================ face sprites
WOOD_FACE = dict(M.WOOD['lit'])
WOOD_FACE.update(d=N['ink'], D=N['grape'], S=N['slate'], s=N['stone'], e=N['char'])

# the Lv1 dugout entrance: a plank frame, a lintel board, steps going down into the dark
DOOR_DUGOUT = [
    "443333333333332",
    "322222222122221",
    ".32dddddddddd1.",
    ".32dddddddddd1.",
    ".32dddddddddd1.",
    ".32DDdddddddd1.",
    ".32ssssssDddd1.",
    ".32DDDDDDdddd1.",
    ".32ssssssssDd1.",
    ".32DDDDDDDDdd1.",
    ".32ssssssssssD.",
    ".32DDDDDDDDDDD.",
    ".32SSSSSSSSSSS.",
]

SLIT = [
    "3333333333332",
    "1ddddddddddd1",
    "1dDdddDddddd1",
    "4333333333332",
]


def on_left(lay, rows, legend, x0, y, z1, u, v):
    lay.on_left(grid(rows, legend), x0, y, z1, u, v)


def on_right(lay, rows, legend, x, y1, z1, u, v):
    lay.on_right(grid(rows, legend), x, y1, z1, u, v)


# ============================================================================ survivors (stand-ins)
_SI = json.load(open(os.path.join(HERE, 'standin.json')))


def person(cv, name, x, y, z, mirror=False):
    rows = _SI['frames'][name]
    a = np.array(rows, np.uint8)
    if mirror:
        a = a[:, ::-1]
    ax = _SI['ax'] if not mirror else _SI['w'] - 1 - _SI['ax']
    sx, sy = cv.proj(x, y, z)
    sx, sy = int(np.floor(sx)), int(np.floor(sy))
    # contact shadow: a 2-1 ellipse on whatever the feet stand on
    for dy in (-1, 0, 1):
        half = 4 if dy == 0 else 2
        for dx in range(-half, half + 1):
            px, py = sx + dx, sy + dy
            if 0 <= px < cv.w and 0 <= py < cv.h and cv.a[py, px] != CLEAR:
                cv.a[py, px] = DARK.get(int(cv.a[py, px]), cv.a[py, px])
    cv.blit(a, sx - ax, sy - _SI['ay'])


# ============================================================================ yard ground
DIRT = {'#': N['rose'], '+': N['beige'], ',': N['mauve'], ';': N['grape'], 's': N['stone'], 'S': N['lilac']}

# the worn path from the door to the gate and out to the island edge, typed per world step.
# rows: y from PATH_Y0, columns: x from PATH_X0. # dirt, + dusty light, , trampled dark
PATH_X0, PATH_Y0 = -9, 7
PATH = [
    "..+++#####++.....",
    ".+###########+...",
    ".###,,#####,###..",
    "..####,,,#####...",
    "...+#######......",
    "....+#####.......",
    "....+####,.......",
    "...+######.......",
    "....+#####.......",
    "....+######......",
    "....+####,.......",
    "...+#######......",
    "....+#####.......",
    ".....+####.......",
    ".....+#####......",
    "......+###.......",
    "......+####......",
    ".......+##.......",
    ".......+###......",
    "........+#.......",
    "........+##......",
]


def path(cv):
    for py in range(cv.h):
        for px in range(cv.w):
            if cv.kind[py, px] != 1:
                continue
            d = (px + .5 - cv.ox) / 2
            s = py + .5 - cv.oy
            wx, wy = (s + d) / 2, (s - d) / 2
            r, c = int(np.floor(wy - PATH_Y0)), int(np.floor(wx - PATH_X0))
            if 0 <= r < len(PATH) and 0 <= c < len(PATH[r]) and PATH[r][c] != '.':
                cv.a[py, px] = DIRT[PATH[r][c]]


DIRT_MARKS = []


# ============================================================================ level 1
LV1_BOARDS = [
    ('', 0, 1, ["4444444444444444444444444444444444444444",
                "3333333333333333333333n333333333333333n3",
                "2222212222222222222222222222222222122222",
                "2222222222222222222212222222222222222222"]),
    ('grey', 1, 0, ["oooooooooooooooooooooooooooooooooooooooooo",
                    "33n3333333333333333333333333333333333333n3",
                    "2222222222222212222222222222222221222222222",
                    "2212222222222222222222222122222222222222222"]),
    ('', 0, 2, ["oooooooooooooooooooooooooooooooooooooooooooo",
                "3n33333333333333333333333333333333333333333n3",
                "22222222222222222112222222222222222222222222",
                "22222222222222222222222222222222122222222222"]),
    ('', 1, 0, ["oooooooooooooooooooooooooooooooooooooooooo",
                "33333333333333333333333333n333333333333333",
                "2222222222122222222222222222222222222222222",
                "2222222222222222222222222222222222222122222"]),
    ('grey', 0, 1, ["oooooooooooooooooooooooooooooooooooooooo",
                    "3333n333333333333333333333333333333n3333",
                    "2222222222222222222222212222222222222222",
                    "2222222222221222222222222222222222222222"]),
    ('', 0, 0, ["oooooooooooooooooooooooooooooooooooooo",
                "3n333333333333333333333333333333333n33",
                "22222222222222212222222222222222222222",
                "22222222222222222222222222222122222222"]),
    ('', 1, 2, ["oooooooooooooooooooooooooooooooooooooooooooo",
                "3333333333333333333333333333333333333333n333",
                "22222222222222222222222122222222222222222222",
                "11111111111111111111111111111111111111111111"]),
]

# a rusty corrugated sheet thrown over part of the roof (top space: rows along y, columns along x).
# ridges run along x; rust pools in the troughs and bleeds from the nail holes.
LV1_SHEET = [
    "3333333333333333333",
    "2222222222222222222",
    "1111111b11111111b11",
    "3333333333333rr3333",
    "22222222222rrqrs222",
    "1111111111rqqr11111",
    "33333333333rrs33333",
    "2222rr222222r222222",
    "111rqrr1111111b1111",
    "3333rrs333333333333",
    "222222222222222rr22",
    "oooooooooooooooooo.",
]
SHEET_TOP = dict(M.IRON['lit'])


def lv1(cv):
    X0, X1, Y0, Y1, H = -9, 9, -7, 7, 15
    box_shadow(cv, X0, X1, Y0, Y1, H + 2)
    lay = cv.layer()
    lay.left(X0, X1, Y1, 0, H, M.face_fn(M.bag_wall(2 * (X1 - X0), H, start=0, shift=0), M.BAG['lit']))
    lay.right(X1, Y0, Y1, 0, H, M.face_fn(M.bag_wall(2 * (Y1 - Y0), H, start=2, shift=6), M.BAG['shade']))
    on_left(lay, DOOR_DUGOUT, WOOD_FACE, X0, Y1, H, 8, H - len(DOOR_DUGOUT))
    on_right(lay, SLIT, WOOD_FACE, X1, Y1, H, 9, 5)
    plank_roof(lay, X0, X1, Y0, H, LV1_BOARDS)
    top_grid(lay, 1, 10.5, Y0, Y0 + 6, H + 2, LV1_SHEET, SHEET_TOP)
    outline(lay)
    cv.paste(lay)
    # a ladder against the front-left wall, right of the door
    lad = cv.layer()
    lad.on_left(grid(LADDER_FLAT, WOOD_FACE), X0, Y1 + .5, H + 4, 28, 0)
    cv.paste(lad)
    # bags holding the boards down
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, -7, -3, H + 2)
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, -7, 3, H + 2)
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, 7, 5, H + 2)
    return dict(roof=H + 2, people=[('hero_aim', 0, 1)])


# a ladder drawn flat in face space; the shear slants its rungs along the wall
LADDER_FLAT = [
    "43...43",
    "4o...4o",
    "4333341",
    "4111141",
    "4o...4o",
    "4o...4o",
    "4333341",
    "4111141",
    "4o...4o",
    "4o...4o",
    "4333341",
    "4111141",
    "4o...4o",
    "4o...4o",
    "4333341",
    "4111141",
    "4o...4o",
    "4o...4o",
    "oo...oo",
]


LEVELS = {1: lv1}


# ============================================================================ scene
def scene(level):
    import island
    import fence
    cv = Canvas(270, 196, 135, 84)
    island.draw(cv)
    path(cv)
    fence.shadows(cv, level)
    fence.draw(cv, level, front=False)
    info = LEVELS[level](cv)
    for name, x, y in info['people']:
        person(cv, name, x, y, info['roof'])
    fence.draw(cv, level, front=True)
    return cv
