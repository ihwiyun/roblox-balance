"""The low perimeter fence, one style per step, on all four sides.

The fence is a square of half-size F around the bunker. From this camera we see the OUTER face of the
two front sides (y = F lit, x = F in shade) and the INNER face of the two back sides (y = -F lit,
x = -F in shade); every style is drawn for all four. Back sides go down before the bunker, front sides
after it. A gate sits where the path leaves the yard (front-left side).

Lv1  sharpened stakes, a sagging rope, tin cans hung as an alarm.
Lv11 plank boards of uneven height on two rails, a sandbag at each post's foot.
Lv21 corrugated rusted iron panels between stone posts, a barbed wire coil along the top.
All stay under 12 px so they never hide the bunker or the zombies.
"""
import numpy as np

import materials as M
from canvas import grid
from pal import CLEAR, DARK, N

F = 18
POSTS = [-18, -12, -6, 0, 6, 12, 18]
GATE = (-5, 1)          # x range of the gate opening on the front-left side (y = F)

C = dict(o=N['ink'], d=N['grape'], w=N['grape'], W=N['mauve'], x=N['rose'], X=N['beige'], y=N['khaki'],
         s=N['slate'], S=N['stone'], m=N['lilac'], M=N['mist'], f=N['foam'],
         r=N['rust'], R=N['copper'], q=N['blood'], b=N['mauve'], B=N['rose'], k=N['beige'], K=N['khaki'],
         e=N['red'], E=N['vermil'])


def spr(rows):
    return grid(rows, C)


# ---------------------------------------------------------------------------- posts (screen space,
# anchor = the ground contact under the post's centre)
STAKES = [spr(r) for r in (
    [".y..",       # tall, sharpened
     "yXW.",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "xxww",
     ".oo."],
    ["....",       # middle, sharpened
     ".y..",
     "yXW.",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "xxww",
     "Xxww",
     ".oo."],
    ["....",       # short, snapped off
     "....",
     "....",
     "Xy.W",
     "XxWw",
     "XxWw",
     "XxWw",
     "XxWw",
     "xxWw",
     "xxww",
     ".oo."],
)]
STAKE_A = (1, 10)
# which stake stands at each post, per side (typed so no two sides repeat)
STAKE_PICK = {'back_left': [0, 1, 0, 2, 1, 0, 1], 'back_right': [1, 0, 2, 0, 1, 1, 0],
              'front_left': [0, 2, 1, 0, 0, 1, 0], 'front_right': [1, 0, 1, 2, 0, 0, 1]}

POST = spr([
    ".yX.",
    "yXXW",
    "XxWw",
    "XxWw",
    "XxWw",
    "XxWw",
    "XxWw",
    "XxWw",
    "XxWw",
    "xxww",
    ".oo.",
])
POST_A = (1, 10)

# a cast concrete post with a chipped cap (Lv21)
STONE_POST = spr([
    ".fM.",
    "fMMS",
    "MmSs",
    "mmSs",
    "MmSs",
    "mmss",
    "mmSs",
    "mMSs",
    "mmSs",
    "mmss",
    "ommo",
    ".oo.",
])
STONE_POST_A = (1, 11)

POST_BAG = spr([
    "..bbbb..",
    ".bkKKkb.",
    "bkKKkkBb",
    "bBkkkBBb",
    ".bbbbbb.",
])
POST_BAG_A = (3, 4)

CAN = spr([
    "S.",
    "mS",
    "MS",
    "ms",
])


def place(cv, sp, anchor, x, y, z=0):
    sx, sy = cv.proj(x, y, z)
    cv.blit(sp, int(np.floor(sx)) - anchor[0], int(np.floor(sy)) - anchor[1])


def side_points(side):
    """posts of one side as world (x, y), ordered back to front"""
    if side == 'back_right':      # y = -F
        return [(t, -F) for t in POSTS]
    if side == 'back_left':       # x = -F
        return [(-F, t) for t in POSTS]
    if side == 'front_right':     # x = F
        return [(F, t) for t in POSTS]
    return [(t, F) for t in POSTS]   # front_left, y = F


def in_gate(side, a, b):
    if side != 'front_left':
        return False
    return a[0] >= GATE[0] - .01 and b[0] <= GATE[1] + .01


def segments(side):
    pts = side_points(side)
    out = []
    for a, b in zip(pts, pts[1:]):
        if side == 'front_left' and a[0] < GATE[0] < b[0]:
            out.append((a, (GATE[0], F)))
            out.append(((GATE[1], F), b))
        else:
            out.append((a, b))
    return out


# ---------------------------------------------------------------------------- Lv1: stakes and rope
def rope(cv, a, b, z, col):
    (x0, y0), (x1, y1) = a, b
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2)
    for i in range(n + 1):
        t = i / n
        sag = 1.6 * (1 - (2 * t - 1) ** 2)
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        sx, sy = cv.proj(x, y, z - sag)
        cv.put(int(np.floor(sx)), int(np.floor(sy)), col)


def lv1_side(cv, side):
    lit = side in ('front_left', 'back_right')
    col = N['beige'] if lit else N['rose']
    pts = side_points(side)
    for a, b in segments(side):
        rope(cv, a, b, 6, col)
        rope(cv, a, b, 3, N['mauve'] if lit else N['grape'])
    # tin cans on the rope: an alarm (hand-placed per side)
    cans = {'front_left': [(-9.5, F), (8.5, F)], 'front_right': [(F, -3.5), (F, 14.5)],
            'back_right': [(-3, -F), (13.5, -F)], 'back_left': [(-F, 9.5), (-F, -9)]}
    for x, y in cans[side]:
        place(cv, CAN, (1, 0), x, y, 4.5)
    for k, (x, y) in enumerate(pts):
        if side == 'front_left' and GATE[0] < x < GATE[1]:
            continue
        place(cv, STAKES[STAKE_PICK[side][k]], STAKE_A, x, y)
    if side == 'front_left':     # the gate: two tall stakes
        for gx in GATE:
            place(cv, STAKES[0], STAKE_A, gx, F)


# ---------------------------------------------------------------------------- Lv11: plank fence
# board heights along a side, typed by hand (px above ground, one per 2 px board + 1 px gap)
BOARD_H = [7, 6, 7, 7, 5, 6, 7, 6, 6, 7, 5, 7, 6, 7, 7, 6, 5, 7, 6, 6, 7, 7, 5, 6, 7, 6, 7, 5]


def board_face(width, lit, seed):
    rows = []
    hmax = 7
    for v in range(hmax):
        row = []
        for u in range(width):
            k = (u // 3 + seed) % len(BOARD_H)
            h = BOARD_H[k]
            top = hmax - h
            if u % 3 == 2:
                # gap between boards: the rails show through
                if v in (2, 4):
                    row.append('W')
                elif v in (3, 5):
                    row.append('w')
                else:
                    row.append('.')
                continue
            if v < top:
                row.append('.')
            elif v == top:
                row.append('X' if u % 3 == 0 else 'x')
            elif v == hmax - 1:
                row.append('w')
            else:
                row.append('x' if u % 3 == 0 else 'W')
        rows.append(''.join(row))
    leg = C if lit else dict(C, X=N['rose'], x=N['mauve'], W=N['grape'], w=N['ink'])
    return grid(rows, leg)


def lv11_side(cv, side):
    lit = side in ('front_left', 'back_right')
    for k, (a, b) in enumerate(segments(side)):
        (x0, y0), (x1, y1) = a, b
        if side in ('front_left', 'back_right'):
            w = int(round(2 * (x1 - x0)))
            cv.on_left(board_face(w, True, 5 * k), x0, y0, 7, 0, 0)
        else:
            w = int(round(2 * (y1 - y0)))
            cv.on_right(board_face(w, False, 7 * k + 3), x0, y1, 7, 0, 0)
    for (x, y) in side_points(side):
        if side == 'front_left' and GATE[0] < x < GATE[1]:
            continue
        place(cv, POST_BAG, POST_BAG_A, x + .8, y + .8)
        place(cv, POST, POST_A, x, y)
    if side == 'front_left':
        for gx in GATE:
            place(cv, POST_BAG, POST_BAG_A, gx + .8, F + .8)
            place(cv, POST, POST_A, gx, F)


# ---------------------------------------------------------------------------- Lv21: iron and wire
def iron_face(width, lit, rust):
    rows = M.iron_sheet(width, 7, rust=rust, bolts_v=(1, 5), bolt_every=11)
    return grid(rows, M.IRON['lit' if lit else 'shade'])


RUST_SIDE = {
    'front_left': [(4, 0, 2), (15, 1, 0), (30, 0, 3), (52, 2, 2), (63, 0, 1)],
    'front_right': [(6, 0, 1), (22, 1, 2), (40, 0, 0), (58, 0, 3)],
    'back_right': [(10, 0, 0), (33, 1, 2), (49, 0, 1)],
    'back_left': [(3, 0, 2), (27, 0, 3), (45, 1, 0)],
}

# a barbed wire coil seen from the side (Barbed Wire): loops of wire with light X barbs, 8 px period
COIL = [
    "..mMm...",
    ".m..fm..",
    "m.f..Mm.",
    "M..m..fm",
    ".mM..mM.",
]
COIL_SHADE = [
    "..sms...",
    ".s..ms..",
    "s.m..ss.",
    "s..s..ms",
    ".ss..ss.",
]


def coil(cv, a, b, z, lit):
    pat = COIL if lit else COIL_SHADE
    (x0, y0), (x1, y1) = a, b
    if abs(y1 - y0) < .01:       # along x: a left-type face
        w = int(round(2 * (x1 - x0)))
        rows = [''.join(r[u % 8] for u in range(w)) for r in pat]
        cv.on_left(grid(rows, C), x0, y0, z, 0, 0)
    else:
        w = int(round(2 * (y1 - y0)))
        rows = [''.join(r[(u + 3) % 8] for u in range(w)) for r in pat]
        cv.on_right(grid(rows, C), x0, y1, z, 0, 0)


def lv21_side(cv, side):
    lit = side in ('front_left', 'back_right')
    rust = RUST_SIDE[side]
    u0 = 0
    for k, (a, b) in enumerate(segments(side)):
        (x0, y0), (x1, y1) = a, b
        if side in ('front_left', 'back_right'):
            w = int(round(2 * (x1 - x0)))
            rr = [(u - u0, v, s) for u, v, s in rust if u0 <= u < u0 + w]
            cv.on_left(iron_face(w, True, rr), x0, y0, 7, 0, 0)
        else:
            w = int(round(2 * (y1 - y0)))
            rr = [(u - u0, v, s) for u, v, s in rust if u0 <= u < u0 + w]
            cv.on_right(iron_face(w, False, rr), x0, y1, 7, 0, 0)
        coil(cv, a, b, 11, lit)
        u0 += w
    for (x, y) in side_points(side):
        if side == 'front_left' and GATE[0] < x < GATE[1]:
            continue
        place(cv, STONE_POST, STONE_POST_A, x, y)
    if side == 'front_left':
        for gx in GATE:
            place(cv, STONE_POST, STONE_POST_A, gx, F)


STYLE = {1: lv1_side, 11: lv11_side, 21: lv21_side}


def draw(cv, level, front):
    sides = ('front_right', 'front_left') if front else ('back_left', 'back_right')
    for side in sides:
        STYLE[level](cv, side)


def shadows(cv, level):
    """low hard shadows on the grass toward +x: one per post; solid fences add a thin strip"""
    for side in ('back_left', 'back_right', 'front_left', 'front_right'):
        for (x, y) in side_points(side):
            cv.shade([(x - .5, y - .5), (x + 1.8, y - .3), (x + 1.8, y + .7), (x - .5, y + .5)], DARK, z=0, only=(1,))
        if level == 1:
            continue
        for a, b in segments(side):
            (x0, y0), (x1, y1) = a, b
            if abs(y1 - y0) < .01:
                poly = [(x0, y0 - .1), (x1, y0 - .1), (x1 + .9, y0 + .3), (x0 + .9, y0 + .3)]
            else:
                poly = [(x0, y0), (x0 + 1.2, y0 + .3), (x0 + 1.2, y1 + .3), (x0, y1)]
            cv.shade(poly, DARK, z=0, only=(1,))
