"""The makeshift-era bunker at three steps (Lv1, Lv11, Lv21), its yard, fence and props.

World units: x to screen right-down, y to screen left-down, z up (canvas.py). The bunker sits at the
island centre. Every board, bag course, sheet, rust blob, door and prop below is typed by hand or
placed by hand; the code only shears face drawings onto the walls, orders layers and outlines them.

Lv1   dugout of sandbags and planks, one shooter, a ladder, a campfire
Lv11  same footprint, taller and reinforced: timber corner posts, an iron-clad shaded wall, a plank
      door, a sandbag parapet on the roof, the roof post with a rag flag and a lantern, two shooters
Lv21  larger footprint on a rubble-stone footing, corrugated iron roof, the first turret slot on the
      roof corner, a radio antenna, and a repair workshop in the yard's left corner
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


def box_shadow(cv, x0, x1, y0, y1, h, k=.18):
    """the hard shadow of an upright box: light from the top-left, so it falls toward +x (screen
    lower-right) and a little toward +y; only ground pixels darken"""
    dx, dy = h * k, h * k * .3
    cv.shade([(x0, y0), (x1, y0), (x1 + dx, y0 + dy), (x1 + dx, y1 + dy), (x0 + dx, y1 + dy), (x0, y1)],
             DARK, z=0, only=(1,))


def post(lay, x, y, z0, z1, w=.5):
    """an upright timber post of half-width w"""
    lit, sh = M.WOOD['lit'], M.WOOD['shade']
    lay.left(x - w, x + w, y + w, z0, z1, lambda u, v: lit['4'] if u == 0 else lit['3'])
    lay.right(x + w, y - w, y + w, z0, z1, lambda u, v: sh['2'] if u == 0 else sh['1'])
    lay.top(x - w, x + w, y - w, y + w, z1, lambda *a: M.WOOD['top']['3'])


def slope(lay, x0, x1, y0, y1, zhi, zlo, tex):
    """a roof plane sloping down along +x from zhi at x0 to zlo at x1; tex(wx, wy) -> index"""
    k = (zhi - zlo) / (x1 - x0)
    pts = [lay.proj(x, y, zhi - k * (x - x0)) for x in (x0, x1) for y in (y0, y1)]
    ax, bx, ay, by = lay._box(pts)
    for py in range(ay, by + 1):
        for px in range(ax, bx + 1):
            d = (px + .5 - lay.ox) / 2
            s = py + .5 - lay.oy
            x = (s + zhi + k * x0 + d) / (2 + k)
            y = x - d
            if x0 <= x < x1 and y0 <= y < y1:
                lay.put(px, py, tex(x, y))


def slope_y(lay, x0, x1, y0, y1, zhi, zlo, tex):
    """a roof plane sloping down along +y (toward the lit front-left) from zhi at y0 to zlo at y1"""
    k = (zhi - zlo) / (y1 - y0)
    pts = [lay.proj(x, y, zhi - k * (y - y0)) for x in (x0, x1) for y in (y0, y1)]
    ax, bx, ay, by = lay._box(pts)
    for py in range(ay, by + 1):
        for px in range(ax, bx + 1):
            d = (px + .5 - lay.ox) / 2
            s = py + .5 - lay.oy
            y = (s + zhi + k * y0 - d) / (2 + k)
            x = d + y
            if x0 <= x < x1 and y0 <= y < y1:
                lay.put(px, py, tex(x, y))


def box(lay, x0, x1, y0, y1, z0, z1, top, lit, shade):
    """a plain box; top/lit/shade are palette indices or callables tex(u, v) for the walls"""
    f = (lambda c: c if callable(c) else (lambda *a: c))
    lay.left(x0, x1, y1, z0, z1, f(lit))
    lay.right(x1, y0, y1, z0, z1, f(shade))
    lay.top(x0, x1, y0, y1, z1, (lambda *a: top) if not callable(top) else top)


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
            r = min(3, max(0, int((wy - yb) * 2)))
            col = int((wx - bx0) * 2)
            ch = rr[r][min(len(rr[r]) - 1, max(0, col))]
            if r == 0 and first and ch == 'o':
                ch = '3'
            return rmp[ch]
        lay.top(bx0, bx1, yb, yb + 2, z0 + thick, tex)
        lay.right(bx1, yb, yb + 2, z0, z0 + thick,
                  lambda u, v, s=shade: s['4'] if v == 0 and u < 3 else (s['3'] if v == 0 else s['2']))
        if k == n - 1:     # the last board's long side shows on the front-left
            lay.left(bx0, bx1, yb + 2, z0, z0 + thick,
                     lambda u, v, s=side: s['3'] if v == 0 else (s['2'] if u % 9 else s['1']))
        y += 2


def iron_top(cols, rows, rust=(), bolts=()):
    """corrugated sheet seen from above, ridges along x (rows), in tones; rust (c, r, k) stamps"""
    out = [[('3', '2', '1')[r % 3] for _ in range(cols)] for r in range(rows)]
    for c0, r0, k in rust:
        st = M.RUST[k]
        for j, row in enumerate(st):
            for i, ch in enumerate(row):
                if ch != '.' and 0 <= r0 + j < rows and 0 <= c0 + i < cols:
                    out[r0 + j][c0 + i] = ch
    for c, r in bolts:
        if 0 <= r < rows and 0 <= c < cols:
            out[r][c] = 'b'
    return [''.join(r) for r in out]


# ============================================================================ parapet (sandbags on
# the roof edge). Back strips go down before the shooters, front strips after them.
BAGTOP_ROWS = [  # the top of a bag course seen from above, 4 rows (2 steps); bags of 7..11 px
    "o34433333oo3443333oo344333333oo34433oo3443333333oo344333oo",
    "3433333322344333322343333332234333223433333333223433333223",
    "2333222212233322212333222221233322123332222222123332222112",
    "o1111111oo1111111oo11111111oo111111oo111111111oo11111111oo",
]


def bagtop_tex(x0, y0, rmp, along='x', phase=0):
    def tex(wx, wy, px, py):
        if along == 'x':
            r, c = int((wy - y0) * 2), int((wx - x0) * 2) + phase
        else:
            r, c = int((wx - x0) * 2), int((wy - y0) * 2) + phase
        r = min(3, max(0, r))
        row = BAGTOP_ROWS[r]
        return rmp[row[c % len(row)]]
    return tex


def parapet(lay, X0, X1, Y0, Y1, z0, part, h=5, t=2, corner=0):
    """corner > 0 leaves the roof's right corner (corner x corner steps) to a turret platform"""
    lit, sh, top = M.BAG['lit'], M.BAG['shade'], M.BAG['top']
    z1 = z0 + h
    if part == 'back':
        # back-right strip: inner face (plane y = Y0 + t) lit, then its top
        xe = X1 - corner
        lay.left(X0, xe, Y0 + t, z0, z1, M.face_fn(M.bag_wall(int(2 * (xe - X0)), h, start=1, shift=3), lit))
        lay.top(X0, xe, Y0, Y0 + t, z1, bagtop_tex(X0, Y0, top, 'x'))
        # back-left strip: inner face (plane x = X0 + t) in shade, then its top
        lay.right(X0 + t, Y0, Y1, z0, z1, M.face_fn(M.bag_wall(int(2 * (Y1 - Y0)), h, start=3, shift=8), sh))
        lay.top(X0, X0 + t, Y0, Y1, z1, bagtop_tex(X0, Y0, top, 'y', 5))
    else:
        ys = Y0 + corner
        lay.left(X0, X1, Y1, z0, z1, M.face_fn(M.bag_wall(int(2 * (X1 - X0)), h, start=4, shift=1), lit))
        lay.right(X1, ys, Y1, z0, z1, M.face_fn(M.bag_wall(int(2 * (Y1 - ys)), h, start=2, shift=11), sh))
        lay.top(X0, X1, Y1 - t, Y1, z1, bagtop_tex(X0, Y1 - t, top, 'x', 7))
        lay.top(X1 - t, X1, ys, Y1, z1, bagtop_tex(X1 - t, ys, top, 'y', 2))


# ============================================================================ face sprites
WOOD_FACE = dict(M.WOOD['lit'])
WOOD_FACE.update(d=N['ink'], D=N['grape'], S=N['slate'], s=N['stone'], e=N['char'], m=N['lilac'],
                 M=N['mist'], q=N['blood'], r=N['rust'])
WOOD_SHADE = dict(M.WOOD['shade'])
WOOD_SHADE.update(d=N['ink'], D=N['grape'], S=N['slate'], s=N['stone'], e=N['char'], m=N['stone'],
                  M=N['lilac'])

# the Lv1 dugout entrance: a plank frame, a lintel board, steps going down into the dark
DOOR_DUGOUT = [
    "443333333333332",
    "322222222122221",
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

# the Lv11 plank door with two iron straps and a ring handle, in a timber frame
DOOR_PLANK = [
    "44333333333333332",
    "32222222222222221",
    "3d3323323323323d1",
    "3d3212312312312d1",
    "3dmMmmMmmMmmMmmd1",
    "3dsssssssssssssd1",
    "3d3212312312312d1",
    "3d3212312M12312d1",
    "3d3212312s12312d1",
    "3d3212312312312d1",
    "3dmMmmMmmMmmMmmd1",
    "3dsssssssssssssd1",
    "3d3212312312312d1",
    "3d3212312312312d1",
    "3d2111211211211d1",
]

# the Lv21 door: iron-banded planks under a stone lintel, a barred window beside it
DOOR_IRON = [
    "MMMMmmmmmmmmmmmmmmS",
    "mmmmssssssssssssssS",
    "3d332332332332332d1",
    "3dmMmmMmmMmmMmmMmd1",
    "3dsssssssssssssssd1",
    "3d321231231231231d1",
    "3d321231231M31231d1",
    "3d321231231s31231d1",
    "3d321231231231231d1",
    "3dmMmmMmmMmmMmmMmd1",
    "3dsssssssssssssssd1",
    "3d321231231231231d1",
    "3d321231231231231d1",
    "3d211121121121121d1",
]
WINDOW_BARS = [
    "MMmmmmmmmmS",
    "mdMdMdMdMds",
    "mdmdmdmdmds",
    "mdmdmdmdmds",
    "mdmdmdmdmds",
    "SsssssssssS",
]

SLIT = [
    "3333333333332",
    "1ddddddddddd1",
    "1dDdddDddddd1",
    "4333333333332",
]
SLIT_IRON = [
    "MMMMMMMMMMMMM",
    "sddddddddddds",
    "sdDdddDdddDds",
    "mmmmmmmmmmmmm",
]

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
    "4333341",
    "4111141",
    "4o...4o",
    "4o...4o",
    "oo...oo",
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
    for dy in (-1, 0, 1):     # contact shadow: a 2-1 ellipse on whatever the feet stand on
        half = 4 if dy == 0 else 2
        for dx in range(-half, half + 1):
            px, py = sx + dx, sy + dy
            if 0 <= px < cv.w and 0 <= py < cv.h and cv.a[py, px] != CLEAR:
                cv.a[py, px] = DARK.get(int(cv.a[py, px]), cv.a[py, px])
    cv.blit(a, sx - ax, sy - _SI['ay'])


# ============================================================================ yard ground
DIRT = {'#': N['rose'], '+': N['beige'], ',': N['mauve'], ';': N['grape']}

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


def path(cv, y_from=PATH_Y0):
    for py in range(cv.h):
        for px in range(cv.w):
            if cv.kind[py, px] != 1:
                continue
            d = (px + .5 - cv.ox) / 2
            s = py + .5 - cv.oy
            wx, wy = (s + d) / 2, (s - d) / 2
            if wy < y_from:
                continue
            r, c = int(np.floor(wy - PATH_Y0)), int(np.floor(wx - PATH_X0))
            if 0 <= r < len(PATH) and 0 <= c < len(PATH[r]) and PATH[r][c] != '.':
                cv.a[py, px] = DIRT[PATH[r][c]]


GRASS_TUFT = grid(["H.H",
                   "LHD",
                   ".D."], dict(H=N['pale'], L=N['celadon'], D=N['fern']))
GRASS_TUFT2 = grid([".H..H",
                    "HLHLD",
                    ".DLD."], dict(H=N['pale'], L=N['celadon'], D=N['fern']))


def tufts(cv, spots):
    for k, x, y in spots:
        sp = (GRASS_TUFT, GRASS_TUFT2)[k]
        sx, sy = cv.proj(x, y)
        cv.stamp(sp, int(sx) - sp.shape[1] // 2, int(sy) - sp.shape[0] + 1, only=(1,))


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

# a rusty corrugated sheet thrown over part of the roof (top space: rows along y, columns along x)
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


def lv1(cv):
    X0, X1, Y0, Y1, H = -9, 9, -7, 7, 15
    box_shadow(cv, X0, X1, Y0, Y1, H + 2)
    tufts(cv, [(1, -6, 7.6), (0, 3.5, 7.4), (1, 9.4, 3), (0, 9.4, -4), (0, -9.4, -2)])
    lay = cv.layer()
    lay.left(X0, X1, Y1, 0, H, M.face_fn(M.bag_wall(2 * (X1 - X0), H, start=0, shift=0), M.BAG['lit']))
    lay.right(X1, Y0, Y1, 0, H, M.face_fn(M.bag_wall(2 * (Y1 - Y0), H, start=2, shift=6), M.BAG['shade']))
    on_left(lay, DOOR_DUGOUT, WOOD_FACE, X0, Y1, H, 8, H - len(DOOR_DUGOUT))
    on_right(lay, SLIT, WOOD_SHADE, X1, Y1, H, 9, 4)
    plank_roof(lay, X0, X1, Y0, H, LV1_BOARDS)
    top_grid(lay, 1, 10.5, Y0, Y0 + 6, H + 2, LV1_SHEET, M.IRON['lit'])
    outline(lay)
    cv.paste(lay)
    lad = cv.layer()
    lad.on_left(grid(LADDER_FLAT[4:], WOOD_FACE), X0, Y1 + .5, H + 3, 28, 0)
    cv.paste(lad)
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, -7, -3, H + 2)
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, -7, 3, H + 2)
    place(cv, P.BAG_TOP, P.BAG_TOP_ANCHOR, 7, 5, H + 2)
    # the camp in front: a fire ring, a crate, a water drum
    place(cv, P.CAMPFIRE, P.CAMPFIRE_ANCHOR, 8, 12)
    place(cv, P.CRATE_S, P.CRATE_S_ANCHOR, 13, 9)
    place(cv, P.DRUM, P.DRUM_ANCHOR, -11, 9)
    return dict(roof=H + 2, people=[('hero_aim', 0, 1)], front=[])


# ============================================================================ level 11
LV11_BOARDS = [
    ('', 0, 1, ["4444444444444444444444444444444444444444"] + LV1_BOARDS[0][3][1:]),
    ('grey', 1, 1, LV1_BOARDS[1][3]),
    ('', 0, 2, LV1_BOARDS[2][3]),
    ('', 1, 0, LV1_BOARDS[3][3]),
    ('', 0, 1, LV1_BOARDS[4][3]),
    ('grey', 0, 0, LV1_BOARDS[5][3]),
    ('', 1, 2, LV1_BOARDS[6][3]),
]


def lv11(cv):
    X0, X1, Y0, Y1, H = -9, 9, -7, 7, 20
    R = H + 2                       # roof surface
    box_shadow(cv, X0, X1, Y0, Y1, H + 7)
    tufts(cv, [(1, -6.5, 7.6), (0, 4.5, 7.4), (1, 9.4, 4), (0, 9.4, -3), (0, -9.4, -1)])
    lay = cv.layer()
    lay.left(X0, X1, Y1, 0, H, M.face_fn(M.bag_wall(2 * (X1 - X0), H, start=0, shift=4), M.BAG['lit']))
    # the shaded wall: bags below, corrugated sheets bolted over the upper part
    lay.right(X1, Y0, Y1, 0, H, M.face_fn(M.bag_wall(2 * (Y1 - Y0), H, start=2, shift=6), M.BAG['shade']))
    sheet = M.iron_sheet(2 * (Y1 - Y0), 12, rust=[(3, 0, 1), (14, 1, 2), (20, 0, 0)], holes=[(25, 7)],
                         bolts_v=(1, 10), bolt_every=7)
    lay.on_right(grid(sheet, M.IRON['shade']), X1, Y1, H, 0, 0)
    on_left(lay, DOOR_PLANK, WOOD_FACE, X0, Y1, H, 9, H - len(DOOR_PLANK))
    on_right(lay, SLIT_IRON, WOOD_SHADE, X1, Y1, H, 10, 4)
    # the waling board along the top of the bag walls
    lay.left(X0, X1, Y1, H - 2, H, lambda u, v: M.WOOD['lit']['4' if v == 0 else '2'])
    plank_roof(lay, X0, X1, Y0, H, LV11_BOARDS)
    for (x, y) in ((X0, Y1), (X1, Y1), (X1, Y0)):
        post(lay, x, y, 0, R + 3)
    outline(lay)
    cv.paste(lay)
    pb = cv.layer()
    parapet(pb, X0, X1, Y0, Y1, R, 'back')
    outline(pb)
    cv.paste(pb)
    place(cv, P.ROOF_POST, P.ROOF_POST_ANCHOR, X0 + 1, Y0 + 1, R + 5)
    lad = cv.layer()
    lad.on_left(grid(LADDER_FLAT, WOOD_FACE), X0, Y1 + .5, H + 3, 29, 0)
    cv.paste(lad)
    place(cv, P.CRATE, P.CRATE_ANCHOR, 13, -6)
    place(cv, P.CRATE_S, P.CRATE_S_ANCHOR, 14, -1)
    place(cv, P.DRUM_RED, P.DRUM_ANCHOR, -12, 8)
    place(cv, P.DRUM, P.DRUM_ANCHOR, -12, 11)
    place(cv, P.CAMPFIRE, P.CAMPFIRE_ANCHOR, 9, 12)

    def front(cv):
        pf = cv.layer()
        parapet(pf, X0, X1, Y0, Y1, R, 'front')
        outline(pf)
        cv.paste(pf)
        pp = cv.layer()
        post(pp, X1, Y1, R, R + 6)
        post(pp, X0, Y1, R, R + 6)
        post(pp, X1, Y0, R, R + 6)
        outline(pp)
        cv.paste(pp)
    return dict(roof=R, people=[('hero_aim', -4, 2), ('minjun_aim', 3, -3)], front=[front])


# ============================================================================ level 21
LV21_ROOF_RUST = [(6, 4, 3), (22, 10, 1), (34, 2, 0), (12, 20, 2), (38, 18, 3), (26, 26, 1), (4, 26, 0)]
TUR = 6.5        # the turret platform takes this square of the roof's right corner


TUR_DECK = [  # the platform's plank deck in top space (rows along y, columns along x)
    "4444444444443",
    "3333n3333n332",
    "2222222222221",
    "oooooooooooo1",
    "3333333n33332",
    "2222122222221",
    "oooooooooooo1",
    "33n333333n332",
    "2222222212221",
    "oooooooooooo1",
    "333333n333332",
    "1111111111111",
]


def turret(cv, x0, x1, y0, y1, z):
    """the first turret slot: a timber platform raised on the roof's right corner, iron straps on its
    sides, a plank deck, and a scrap machine gun aiming out over the corner"""
    lay = cv.layer()
    zp = z + 5
    lit, sh = M.WOOD['lit'], M.WOOD['shade']
    lay.left(x0, x1, y1, z - 2, zp, lambda u, v: lit['4'] if v == 0 else lit['2' if u % 7 else '1'])
    lay.right(x1, y0, y1, z - 2, zp, lambda u, v: sh['3'] if v == 0 else sh['2' if u % 7 else '1'])
    lay.left(x0, x1, y1, z + 1, z + 2, lambda u, v: N['stone'] if u % 5 else N['mist'])
    lay.right(x1, y0, y1, z + 1, z + 2, lambda u, v: N['slate'] if u % 5 else N['lilac'])
    top_grid(lay, x0, x1, y0, y1, zp, TUR_DECK, M.WOOD['top'])
    outline(lay)
    cv.paste(lay)
    place(cv, P.TURRET, P.TURRET_ANCHOR, (x0 + x1) / 2 - .5, (y0 + y1) / 2 + .5, zp)


def lv21(cv):
    X0, X1, Y0, Y1 = -12, 11, -9, 8
    FOOT, H = 7, 22
    R = H + 2
    workshop(cv)
    box_shadow(cv, X0, X1, Y0, Y1, H + 7)
    tufts(cv, [(1, -9, 8.6), (0, 5, 8.4), (1, 11.4, 4), (0, 11.4, -4), (0, -12.4, -2)])
    lay = cv.layer()
    wl, wr = int(2 * (X1 - X0)), int(2 * (Y1 - Y0))
    lay.left(X0, X1, Y1, 0, FOOT, M.face_fn(M.stone_wall(wl, FOOT, shift=2), M.STONE['lit']))
    lay.right(X1, Y0, Y1, 0, FOOT, M.face_fn(M.stone_wall(wr, FOOT, shift=9), M.STONE['shade']))
    lay.left(X0, X1, Y1, FOOT, H, M.face_fn(M.bag_wall(wl, H - FOOT, start=1, shift=2), M.BAG['lit']))
    lay.right(X1, Y0, Y1, FOOT, H, M.face_fn(M.bag_wall(wr, H - FOOT, start=3, shift=5), M.BAG['shade']))
    sheet = M.iron_sheet(wr, 13, rust=[(2, 0, 3), (16, 0, 1), (27, 1, 0), (5, 9, 2)], holes=[(12, 8), (30, 6)],
                         bolts_v=(1, 11), bolt_every=8)
    lay.on_right(grid(sheet, M.IRON['shade']), X1, Y1, H, 0, 0)
    on_left(lay, DOOR_IRON, WOOD_FACE, X0, Y1, H, 10, H - len(DOOR_IRON))
    on_left(lay, WINDOW_BARS, WOOD_FACE, X0, Y1, H, 33, 6)
    on_right(lay, SLIT_IRON, WOOD_SHADE, X1, Y1, H, 12, 5)
    lay.left(X0, X1, Y1, H - 2, H, lambda u, v: M.WOOD['lit']['4' if v == 0 else '2'])
    roof = iron_top(int(2 * (X1 - X0)), int(2 * (Y1 - Y0)), rust=LV21_ROOF_RUST,
                    bolts=[(c, r) for r in (2, 17, 31) for c in range(3, 46, 9)])
    lay.top(X0, X1, Y0, Y1, R, lambda wx, wy, px, py: M.IRON['top'][
        roof[min(len(roof) - 1, int((wy - Y0) * 2))][min(len(roof[0]) - 1, int((wx - X0) * 2))]])
    lay.left(X0, X1, Y1, H, R, lambda u, v: M.IRON['lit']['3' if v == 0 else '1'])
    lay.right(X1, Y0, Y1, H, R, lambda u, v: M.IRON['shade']['3' if v == 0 else '1'])
    for (x, y) in ((X0, Y1), (X1, Y1), (X1, Y0)):
        post(lay, x, y, 0, R + 3, w=.75)
    outline(lay)
    cv.paste(lay)
    pb = cv.layer()
    parapet(pb, X0, X1, Y0, Y1, R, 'back', corner=TUR)
    outline(pb)
    cv.paste(pb)
    place(cv, P.ROOF_POST, P.ROOF_POST_ANCHOR, X0 + 1, Y0 + 1, R + 5)
    place(cv, P.ANTENNA, P.ANTENNA_ANCHOR, X0 + 1, Y0 + 4, R + 5)
    lad = cv.layer()
    lad.on_left(grid(LADDER_FLAT + LADDER_FLAT[4:10], WOOD_FACE), X0, Y1 + .5, H + 4, 41, 0)
    cv.paste(lad)
    place(cv, P.CRATE, P.CRATE_ANCHOR, -15.5, -6)
    place(cv, P.DRUM_RED, P.DRUM_ANCHOR, -15.5, -1)
    place(cv, P.DRUM, P.DRUM_ANCHOR, -15, 2)

    def front(cv):
        pf = cv.layer()
        parapet(pf, X0, X1, Y0, Y1, R, 'front', corner=TUR)
        outline(pf)
        cv.paste(pf)
        pp = cv.layer()
        for (x, y) in ((X1, Y1), (X0, Y1)):
            post(pp, x, y, R, R + 6, w=.75)
        outline(pp)
        cv.paste(pp)
        turret(cv, X1 - TUR, X1, Y0, Y0 + TUR, R)
    return dict(roof=R, people=[('hero_aim', -7, 3), ('minjun_aim', -1, -3)], front=[front],
                ground_people=[])


# ============================================================================ workshop (Lv21)
LEANTO_RUST = [(3, 1, 2), (12, 4, 0), (21, 0, 1), (8, 6, 2)]


def workshop(cv):
    """the repair corner: a lean-to against the back-right fence (y = -F), its corrugated roof sloping
    toward the lit front-left on two timber posts; under it a workbench with a vise and a red
    toolbox, tools hung on the fence, welding bottles at one end, scrap pipes and a tyre at the other"""
    x0, x1, y0, y1 = 8.5, 17, -17.5, -13
    zhi, zlo = 16, 12
    for spr, x, z in ((P.WRENCH, 10.5, 12), (P.SAW, 12.4, 13), (P.HAMMER, 14.6, 12)):
        place(cv, spr, (1, 0), x, -17.6, z)
    place(cv, P.CYLINDERS, P.CYLINDERS_ANCHOR, 16.2, -16.2)
    lay = cv.layer()
    # the bench: a plank top on a box frame, against the fence
    box(lay, 10, 15, -17, -15, 0, 6, N['tan'],
        lambda u, v: M.WOOD['lit']['4' if v == 0 else ('o' if v > 1 and u % 4 == 0 else '2')],
        lambda u, v: M.WOOD['shade']['3' if v == 0 else '1'])
    outline(lay)
    cv.paste(lay)
    place(cv, P.VISE, (2, 4), 11.2, -15.8, 6)
    place(cv, P.TOOLBOX, (4, 5), 13.6, -15.6, 6)
    roof = cv.layer()
    for (x, y) in ((x0 + .6, y1), (x1 - .6, y1)):
        post(roof, x, y, 0, zlo)
    rows = iron_top(18, 9, rust=LEANTO_RUST)

    def tex(wx, wy):
        r = min(len(rows) - 1, max(0, int((wy - y0) * 2)))
        c = min(len(rows[0]) - 1, max(0, int((wx - x0) * 2)))
        return M.IRON['top'][{'1': '2', '2': '3', '3': '4'}.get(rows[r][c], rows[r][c])]

    def tex_ridges(wx, wy):          # corrugations run down the slope (along y)
        c = int((wx - x0) * 2)
        r = min(len(rows) - 1, max(0, int((wy - y0) * 2)))
        ch = rows[r][min(len(rows[0]) - 1, max(0, c))]
        if ch in '123':
            ch = ('4', '3', '2')[c % 3]
        return M.IRON['lit'][ch]
    slope_y(roof, x0, x1, y0, y1, zhi, zlo, tex_ridges)
    roof.left(x0, x1, y1, zlo - 1, zlo, lambda u, v: M.IRON['lit']['2' if u % 3 == 2 else '1'])
    outline(roof)
    cv.paste(roof)
    place(cv, P.PIPES, (5, 5), 16.5, -12)
    place(cv, P.TIRE, P.TIRE_ANCHOR, 15.5, -10)
    person(cv, 'seoyeon_idle', 9.6, -11.8, 0)


LEVELS = {1: lv1, 11: lv11, 21: lv21}


# ============================================================================ scene
def scene(level):
    import island
    import fence
    cv = Canvas(270, 196, 135, 84)
    island.draw(cv)
    path(cv, y_from={1: 7, 11: 7, 21: 8}[level])
    fence.shadows(cv, level)
    fence.draw(cv, level, front=False)
    info = LEVELS[level](cv)
    for name, x, y in info.get('ground_people', []):
        person(cv, name, x, y, 0)
    for name, x, y in info['people']:
        person(cv, name, x, y, info['roof'])
    for f in info['front']:
        f(cv)
    fence.draw(cv, level, front=True)
    return cv
