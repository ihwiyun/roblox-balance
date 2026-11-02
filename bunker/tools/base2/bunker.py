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


def box_shadow(cv, x0, x1, y0, y1, h, k=.42):
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
DIRT = dict(D=N['grape'], d=N['mauve'], b=N['rose'], B=N['beige'], s=N['stone'], S=N['lilac'])


def yard(cv, x0, x1, y0, y1, bites):
    """trampled dirt around the bunker: a rectangle in world space whose edge is bitten in by hand
    (bites: list of (side, from, to, depth) in steps)"""
    def inside(wx, wy):
        if not (x0 <= wx < x1 and y0 <= wy < y1):
            return False
        for side, a, b, d in bites:
            if side == 'x0' and a <= wy < b and wx < x0 + d:
                return False
            if side == 'x1' and a <= wy < b and wx >= x1 - d:
                return False
            if side == 'y0' and a <= wx < b and wy < y0 + d:
                return False
            if side == 'y1' and a <= wx < b and wy >= y1 - d:
                return False
        return True

    for py in range(cv.h):
        for px in range(cv.w):
            if cv.kind[py, px] != 1:
                continue
            d = (px + .5 - cv.ox) / 2
            s = py + .5 - cv.oy
            wx, wy = (s + d) / 2, (s - d) / 2
            if inside(wx, wy):
                cv.a[py, px] = DIRT['d']
                # a lighter dusty rim one pixel inside the edge
                for ex, ey in ((.5, 0), (0, .5), (-.5, 0), (0, -.5)):
                    if not inside(wx + ex, wy + ey):
                        cv.a[py, px] = DIRT['b']
                        break
    return inside


DIRT_MARKS = [  # hand-drawn pebbles and trampled spots (screen space)
    grid(["bB",
          "Dd"], DIRT),
    grid([".b.",
          "bBd",
          ".D."], DIRT),
    grid(["DDdd",
          ".DD."], DIRT),
    grid(["s.",
          ".S"], DIRT),
    grid(["dDDd..",
          ".dDDDd"], DIRT),
]


# ============================================================================ level 1
LV1_BOARDS = [
    ('', 0, 1, ["4444444444444444444444444444444444444444444",
                "3333333333333333333333n333333333333333333n3",
                "2222212222222222222222222222222222122222222",
                "2222222222222222222212222222222222222222222"]),
    ('grey', 1, 0, ["ooooooooooooooooooooooooooooooooooooooooooo",
                    "33n33333333333333333333333333333333333333n3",
                    "2222222222222212222222222222222221222222222",
                    "2212222222222222222222222122222222222222222"]),
    ('', 0, 2, ["ooooooooooooooooooooooooooooooooooooooooooooo",
                "3n333333333333333333333333333333333333333333n3",
                "222222222222222221122222222222222222222222222",
                "222222222222222222222222222222221222222222222"]),
    ('', 1, 0, ["ooooooooooooooooooooooooooooooooooooooooooo",
                "33333333333333333333333333n3333333333333333",
                "2222222222122222222222222222222222222222222",
                "2222222222222222222222222222222222222212222"]),
    ('grey', 0, 1, ["ooooooooooooooooooooooooooooooooooooooooooo",
                    "3333n333333333333333333333333333333333n3333",
                    "2222222222222222222222212222222222222222222",
                    "2222222222221222222222222222222222222222222"]),
    ('', 0, 0, ["ooooooooooooooooooooooooooooooooooooooooo",
                "3n33333333333333333333333333333333333n333",
                "2222222222222221222222222222222222222222",
                "2222222222222222222222222222212222222222"]),
    ('', 1, 2, ["ooooooooooooooooooooooooooooooooooooooooooooo",
                "33333333333333333333333333333333333333333n333",
                "2222222222222222222222212222222222222222222222",
                "1111111111111111111111111111111111111111111111"]),
]


def lv1(cv):
    X0, X1, Y0, Y1, H = -9, 9, -7, 7, 16
    box_shadow(cv, X0, X1, Y0, Y1, H + 2)
    lay = cv.layer()
    lay.left(X0, X1, Y1, 0, H, M.face_fn(M.bag_wall(2 * (X1 - X0), H, start=0, shift=0), M.BAG['lit']))
    lay.right(X1, Y0, Y1, 0, H, M.face_fn(M.bag_wall(2 * (Y1 - Y0), H, start=2, shift=6), M.BAG['shade']))
    on_left(lay, DOOR_DUGOUT, WOOD_FACE, X0, Y1, H, 8, H - len(DOOR_DUGOUT))
    on_right(lay, SLIT, WOOD_FACE, X1, Y1, H, 9, 5)
    plank_roof(lay, X0, X1, Y0, H, LV1_BOARDS)
    outline(lay)
    cv.paste(lay)
    # a ladder against the front-left wall, right of the door
    lad = cv.layer()
    lad.on_left(grid(LADDER_FLAT, WOOD_FACE), X0, Y1 + .5, H + 4, 26, 0)
    outline(lad)
    cv.paste(lad)
    # two bags holding the boards down, a jerry can on the roof
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, -6, -4, H + 2)
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, 6, 5, H + 2)
    return dict(roof=H + 2, people=[('hero_aim', 1, 1)])


# a ladder drawn flat in face space; the shear slants its rungs along the wall
LADDER_FLAT = [
    "43....43",
    "32....32",
    "32....32",
    "3233332o",
    "32111132",
    "32....32",
    "32....32",
    "3233332o",
    "32111132",
    "32....32",
    "32....32",
    "3233332o",
    "32111132",
    "32....32",
    "32....32",
    "3233332o",
    "32111132",
    "32....32",
    "32....32",
    "1o....1o",
]


LEVELS = {1: lv1}


# ============================================================================ scene
def scene(level):
    import island
    cv = Canvas(270, 196, 135, 84)
    island.draw(cv)
    inside = yard(cv, -14, 14, -12, 13, [('y1', -14, -6, 2), ('x0', 6, 13, 2), ('y0', 4, 14, 1), ('x1', -12, -5, 2)])
    cx, cy = cv.ox, cv.oy
    marks = [(0, -30, 6), (1, 22, -10), (2, -10, 18), (3, 34, 10), (4, -40, -4), (0, 8, 20), (3, -22, -14)]
    for k, dx, dy in marks:
        cv.stamp(DIRT_MARKS[k], cx + dx, cy + dy, only=(1,))
    info = LEVELS[level](cv)
    for name, x, y in info['people']:
        person(cv, name, x, y, info['roof'])
    return cv
