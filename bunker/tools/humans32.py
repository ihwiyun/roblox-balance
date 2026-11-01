#!/usr/bin/env python3
"""Survivor sprites, 32x32 per frame, for the bunker game.

Run from this folder:  python3 humans32.py            -> writes ../art/humans.js
                       python3 humans32.py --preview  -> also writes check sheets to /tmp/claude-0/humans/
                                                         (needs Pillow; the rifle is drawn the way the game does)

How it works
- Heads and headgear are hand-drawn stamps (letters below), one box size and one anchor for all of them.
- Bodies are posed in 3D body units (f forward, r to the character's right, z up) and projected to the
  two base views: F faces down-right, B faces up-left (the same body turned 180 degrees, not a mirror).
  Legs are solved in 3D so a planted foot stays on the iso ground plane; arms are solved on screen.
- Parts are chunky pixel shapes: a 3 px sleeve with a stripe ring, a 3 px forearm, mitten hands,
  4 px trouser legs, 2-row shoes, hand-drawn torsos. Near parts get an inner outline where they cross
  parts behind them; then the whole figure gets a 1 px outline.
- Body frames never draw the head: each frame says where the head anchor goes ('head').
"""
import json
import math
import os
import sys

# ============================================================================ palette
# o outline | C c x shirt | T t stripe | P p trousers | F f shoes | S s d skin | H h hair | K eyes | m mouth
# V v vest | G g helmet | Y y hard hat | A a cap | M m metal | W w wood | B b crate/basket
# (m is both the mouth and the dark metal: one shared colour that works as a lip line and as steel shade)
PAL = {
    'o': [30, 24, 26],
    'C': [102, 122, 74], 'c': [74, 90, 66], 'x': [52, 60, 58],
    'T': [74, 90, 56], 't': [58, 66, 56],
    'P': [66, 70, 92], 'p': [46, 48, 68],
    'F': [232, 226, 210], 'f': [174, 166, 170],
    'S': [234, 184, 144], 's': [202, 140, 118], 'd': [150, 96, 96],
    'H': [96, 64, 44], 'h': [142, 100, 62],
    'K': [34, 26, 38], 'm': [104, 62, 68],
    'V': [126, 114, 82], 'v': [92, 82, 70],
    'G': [96, 110, 70], 'g': [64, 74, 62],
    'Y': [238, 190, 54], 'y': [182, 128, 54],
    'A': [192, 66, 54], 'a': [130, 44, 56],
    'M': [186, 196, 206],
    'W': [164, 118, 72], 'w': [112, 78, 58],
    'B': [204, 164, 104], 'b': [146, 104, 74],
}

# ============================================================================ heads
# Every head stamp is HW x HH with the anchor (HAX, HAY) = chin/neck point, bottom centre of the box.
# Rows hold fill letters only; the 1 px outline is added when the stamp is baked.
HW, HH, HAX, HAY = 15, 15, 7, 14

HEADS = {
 'hero': {  # lead survivor: tousled hair with a swept quiff, determined brows, half smile
  'F': [
   "...............",
   "...............",
   "...............",
   "........HhH....",
   ".....HhhHhHH...",
   "....HhhhHHHHH..",
   "...HhHHHHHHHhH.",
   "...HHHHSSSHHH..",
   "...HHHSHHSSHH..",
   "...HHSSSKSSKS..",
   "...HsdSSKSSKs..",
   "...HHsSSSSsSs..",
   ".....dSSSmmSs..",
   ".......sSSSs...",
   "...............",
  ],
  'B': [
   "...............",
   "...............",
   "...............",
   "......HhH......",
   "....HhhHHHH....",
   "...HhhhHHHHH...",
   "..HhHHHHHHHHH..",
   "..HHHHHHHHHHH..",
   "..SHHHHHHHHHH..",
   "..SSHHHHHHHHH..",
   "..sdsHHHHHHHh..",
   "..ssHHHHHHHH...",
   "..sssHHHHHH....",
   "...ssSSSs......",
   "...............",
  ],
 },
 'minjun': {  # buzz cut (short stubble, skin showing at the hairline), scar through the near brow
  'F': [
   "...............",
   "...............",
   "...............",
   "...............",
   ".....HhHHhH....",
   "....HHHhHHHh...",
   "...hHHHHhHHHs..",
   "...HHhHSSsSSS..",
   "...HsSSHdSSHH..",
   "...HSSSSKSSKS..",
   "...sSdSSKSSKs..",
   "...HsSSSdSsSs..",
   "....dsSSSmSSs..",
   "......ssSSSs...",
   "...............",
  ],
  'B': [
   "...............",
   "...............",
   "...............",
   "...............",
   "....HhhHHH.....",
   "...HhhHHHHH....",
   "..HhHHHHHHHH...",
   "..HHHHHHHHHH...",
   "..SHHHHHHHHH...",
   "..SSHHHHHHHH...",
   "..sdsHHHHHHH...",
   "..ssSHHHHHs....",
   "..sssSHsHS.....",
   "...ssSSSs......",
   "...............",
  ],
 },
 'seoyeon': {  # long straight hair with blunt bangs
  'F': [
   "...............",
   "...............",
   "...............",
   "...............",
   ".....HhhHHH....",
   "....HhhhHHHH...",
   "...HhHHHHHHHH..",
   "..HHHHHHHHHHHH.",
   "..HHHHSSSSSSHH.",
   "..HHHSSSKSSKHH.",
   "..HHHdSSKSSKHH.",
   "..HHHsSSSSsSHH.",
   "..HHHHSSSmSSH..",
   "..HHHH.sSSSs...",
   "...............",
  ],
  'B': [
   "...............",
   "...............",
   "...............",
   "...............",
   "....HhhHHH.....",
   "...HhhhHHHH....",
   "..HhhHHHHHHH...",
   ".HHHHHHHHHHHH..",
   ".HhhHHHHHHHHH..",
   ".HHHhhHHHHHHH..",
   ".HHHHHHHHHHHH..",
   ".HHHHHHHHHHHH..",
   ".HHHHHHHHHHHH..",
   "..HHHHHHHHHH...",
   "...............",
  ],
 },
 'doyun': {  # neat side part, glasses
  'F': [
   "...............",
   "...............",
   "...............",
   "...............",
   ".....HHhhHH....",
   "....HHHhhhHH...",
   "...HHHHHHHhhH..",
   "...HHHHHSSSSH..",
   "...HHHSHHSSHH..",
   "...HHSoMooMoS..",
   "...HsdoKoSoKs..",
   "...HHsSSSSsSs..",
   ".....dSSSmSSs..",
   ".......sSSSs...",
   "...............",
  ],
  'B': [
   "...............",
   "...............",
   "...............",
   "...............",
   "....HHhhHH.....",
   "...HHhhhHHH....",
   "..HhhHHHHHHH...",
   "..HHHHHHHHHH...",
   "..oHHHHHHHHH...",
   "..SoHHHHHHHH...",
   "..sdoHHHHHHh...",
   "..ssHHHHHHH....",
   "..sssHHHHH.....",
   "...ssSSSs......",
   "...............",
  ],
 },
 'haeun': {  # high ponytail, side-swept bangs, freckles
  'F': [
   "...............",
   "...............",
   "..hH...........",
   ".HhHH..........",
   ".HHoHHHHHH.....",
   ".HHHhhHHHHHH...",
   ".oHhHHHHHHHHH..",
   "HH.HHHHHHSSSH..",
   "HH.HHHHSHSSSH..",
   "Hh.HHSSSKSSKS..",
   "HH.HsdSSKSSKs..",
   ".H.HHsSsSsSSs..",
   ".....dSSSmSSs..",
   ".......sSSSs...",
   "...............",
  ],
  'B': [
   "...............",
   "...............",
   "...............",
   "...............",
   "....HhhHHH.....",
   "...HhhhHHHH....",
   "..HhHHHHHHHH...",
   "..HHHHHoHHHH...",
   "..SHHHHhHHHH...",
   "..SSHHHhHHHH...",
   "..sdsHhHHHHH...",
   "..ssHHHhHHH....",
   "..sssSHhHS.....",
   "...ssSHHs......",
   "...............",
  ],
 },
 'jiho': {  # shaggy hair over the ears, full beard
  'F': [
   "...............",
   "...............",
   "...............",
   ".......H.H.....",
   ".....HhHhHHH...",
   "....HhhhHHHHH..",
   "...HhHHHHHHHHH.",
   "..HHHHHHSSSSHH.",
   "..HHHHSHHSSHHH.",
   "..HHHHSSKSSKS..",
   "..HHHHSSKSSKs..",
   "...HHHSSSHHHs..",
   "....HHHHHmHHH..",
   "......HHHHHH...",
   "...............",
  ],
  'B': [
   "...............",
   "...............",
   "...............",
   ".....H.H.......",
   "....HhHhHH.....",
   "...HhhhHHHH....",
   "..HhHHHHHHHH...",
   ".HHHHHHHHHHHH..",
   ".HHHHHHHHHHHH..",
   ".HSHHHHHHHHHH..",
   ".HHHHHHHHHHHh..",
   "..HHHHHHHHHH...",
   "..HHHHHHHHH....",
   "...HHSSSs......",
   "...............",
  ],
 },
}

GEAR = {
 'helmet': {   # steel pot: dome a little wider than the head, dark rim band, higher at the front
  'F': [
   "...............",
   "......GGGG.....",
   "....GGGGGGGG...",
   "...GGGGGGGGGG..",
   "..GGGGGGGGGGGg.",
   ".GGGGGGGGGGGgg.",
   ".GGGGGGgggggggg",
   ".gggggg........",
   "...............",
   "...............",
   "...............",
   "...............",
   "...............",
   "...............",
   "...............",
  ],
  'B': [
   "...............",
   ".....GGGG......",
   "...GGGGGGGG....",
   "..GGGGGGGGGG...",
   ".GGGGGGGGGGGg..",
   ".GGGGGGGGGGGg..",
   ".GGGGGGGGGGgg..",
   ".gggggggggggg..",
   "...............",
   "...............",
   "...............",
   "...............",
   "...............",
   "...............",
   "...............",
  ],
 },
 'hardhat': {  # dome with a centre ridge and a full brim, a longer peak at the front
  'F': [
   "...............",
   "......YYYy.....",
   "....YYYYYyY....",
   "...YYYYYYyYY...",
   "..YYYYYYYYyYY..",
   "..YYYYYYYYyYYy.",
   ".yyyyyyyyyyyyyy",
   "...............","...............","...............","...............","...............","...............","...............","...............",
  ],
  'B': [
   "...............",
   ".....yYYY......",
   "....YyYYYYY....",
   "...YYyYYYYYY...",
   "..YYYyYYYYYYY..",
   "..YYYyYYYYYYy..",
   ".yyyyyyyyyyyyy.",
   "...............","...............","...............","...............","...............","...............","...............","...............",
  ],
 },
 'cap': {      # baseball cap, peak forward; from behind the strap gap shows
  'F': [
   "...............",
   "...............",
   ".......A.......",
   ".....AAAAA.....",
   "...AAAAAAAAA...",
   "..AAAAAAAAAAa..",
   "..aaaaaaAAAAAAA",
   "...............","...............","...............","...............","...............","...............","...............","...............",
  ],
  'B': [
   "...............",
   "...............",
   ".......A.......",
   ".AAAAAAAAA.....",
   "..AAAAAAAAAA...",
   "..AAAAAAAAAAa..",
   "..aAAAAa.aAaa..",
   "...............","...............","...............","...............","...............","...............","...............","...............",
  ],
 },
}


def sleep_head(rows):
    """the sleeping face: the front head with the eyes shut (a lid dash under each eye)"""
    g = [list(r) for r in rows]
    for x in range(HW):
        if g[10][x] == 'K' and g[9][x] == 'K':
            g[9][x] = 'S'
            g[10][x] = 'K'
            if g[10][x - 1] in 'Ss':
                g[10][x - 1] = 'K'
    return [''.join(r) for r in g]


for _look in HEADS.values():
    _look['sleep'] = sleep_head(_look['F'])


def outline_rows(rows):
    """add a 1 px outline (4-neighbour) around the filled letters of a stamp"""
    h, w = len(rows), len(rows[0])
    out = [list(r) for r in rows]
    for y in range(h):
        for x in range(w):
            if rows[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < w and 0 <= Y < h and rows[Y][X] not in '.o':
                    out[y][x] = 'o'
                    break
    return [''.join(r) for r in out]


# ============================================================================ body frame + projection
FW = FH = 32
AX, AY = 16, 29          # anchor: ground point between the feet; standing soles touch row AY
LAT = 0.3                # lateral offsets tilt less than true iso (shoulders stay readable)
KF, KZ = 1.4142, 1.1547  # iso units -> world units (forward/lateral, up), for 3D leg solving


def P(view, f, r, z):
    """body units (iso px): f forward, r to the character's right, z up -> screen (x, y) floats"""
    if view == 'B':
        f, r = -f, -r
    return (AX + (f - r), AY + 0.5 * (f + LAT * r) - z)


def rnd(v):
    return int(math.floor(v + 0.5))


def rp(p):
    return (rnd(p[0]), rnd(p[1]))


class Layer:
    def __init__(self, name, z, sep=()):
        self.name, self.z, self.sep, self.px = name, z, set(sep), {}

    def put(self, x, y, ch):
        if ch != '.':
            self.px[(int(x), int(y))] = ch

    def stamp(self, rows, x0, y0):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.put(x0 + i, y0 + j, ch)


def bres(a, b):
    (x0, y0), (x1, y1) = a, b
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def seg(layer, a, b, w, cols, ring=None):
    """chunky limb segment: a run of w pixels across the stroke; cols[i] colours the run (0 = lit side).
    ring = (set of step indices, cols) recolours some steps, e.g. a stripe around a sleeve."""
    a, b = rp(a), rp(b)
    steep = abs(b[1] - a[1]) >= abs(b[0] - a[0])
    lo = -(w // 2)
    for k, (x, y) in enumerate(bres(a, b)):
        cs = ring[1] if ring and k in ring[0] else cols
        for i in range(w):
            ch = cs[min(i, len(cs) - 1)]
            if steep:
                layer.put(x + lo + i, y, ch)
            else:
                layer.put(x, y + lo + i, ch)


def ik2(a, c, l1, l2, hint):
    """2D two-bone solve; the joint bends towards the side of hint"""
    dx, dy = c[0] - a[0], c[1] - a[1]
    L = math.hypot(dx, dy) or 1e-6
    L2 = min(L, l1 + l2 - 1e-3)
    ux, uy = dx / L, dy / L
    t = (l1 * l1 - l2 * l2 + L2 * L2) / (2 * L2)
    h = math.sqrt(max(0.0, l1 * l1 - t * t))
    nx, ny = -uy, ux
    if nx * hint[0] + ny * hint[1] < 0:
        nx, ny = -nx, -ny
    return (a[0] + ux * t + nx * h, a[1] + uy * t + ny * h)


def ik3(a, c, l1, l2, pole):
    """3D two-bone solve in world units (inputs in body units); returns the joint in body units"""
    A = (a[0] * KF, a[1] * KF, a[2] * KZ)
    Cc = (c[0] * KF, c[1] * KF, c[2] * KZ)
    d = [Cc[i] - A[i] for i in range(3)]
    L = math.sqrt(sum(v * v for v in d)) or 1e-6
    u = [v / L for v in d]
    L2 = min(L, l1 + l2 - 1e-3)
    t = (l1 * l1 - l2 * l2 + L2 * L2) / (2 * L2)
    h = math.sqrt(max(0.0, l1 * l1 - t * t))
    pdot = sum(pole[i] * u[i] for i in range(3))
    n = [pole[i] - pdot * u[i] for i in range(3)]
    nl = math.sqrt(sum(v * v for v in n)) or 1e-6
    n = [v / nl for v in n]
    B = [A[i] + u[i] * t + n[i] * h for i in range(3)]
    return (B[0] / KF, B[1] / KF, B[2] / KZ)


def compose(layers):
    """paint layers back to front; a layer with sep draws an inner outline on those layers it crosses;
    then the whole figure gets its outline"""
    img, own = {}, {}
    for L in sorted(layers, key=lambda l: l.z):
        if L.sep:
            for (x, y) in L.px:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + dx, y + dy)
                    if q not in L.px and q in img and own.get(q) in L.sep:
                        img[q] = 'o'
                        own[q] = L.name
        for k, ch in L.px.items():
            img[k] = ch
            own[k] = L.name
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    # slivers: a fill pixel cut off by inner outlines (nothing but outline/empty around it) joins the seam
    changed = True
    while changed:
        changed = False
        for (x, y), ch in list(img.items()):
            if ch != 'o' and all(img.get((x + dx, y + dy), '.') in '.o' for dx, dy in N4):
                img[(x, y)] = 'o'
                changed = True
    out = dict(img)
    for (x, y), ch in img.items():
        if ch == 'o':
            continue
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in img:
                out[q] = 'o'
    # outline pixels that touch no fill at all are leftovers: drop them
    for (x, y), ch in list(out.items()):
        if ch == 'o' and not any(out.get((x + dx, y + dy), '.') not in '.o' for dx, dy in N4):
            del out[(x, y)]
    return {k: v for k, v in out.items() if 0 <= k[0] < FW and 0 <= k[1] < FH}


def to_rows(img):
    return [''.join(img.get((x, y), '.') for x in range(FW)) for y in range(FH)]


# ============================================================================ body parts
# torsos: (x0, y0) of the bitmap at rest (pelvis on the anchor column), rows of fill letters
TORSO = {
 ('F', 'up'): (13, 12, [
  "..sSs...",
  ".CxsxCC.",
  "CCCxCCCC",
  "TTTTTTTt",
  "CCCCCCCc",
  "CCCCCCcc",
  "TTTTTTtt",
  "CCCCCCcc",
  "PPPPPPPp",
  "PPPPPpPp",
 ]),
 ('B', 'up'): (13, 12, [
  "..sss...",
  ".CCsCCC.",
  "CCCCCCCC",
  "TTTTTTTt",
  "CCCCCCCc",
  "CCCCCCcc",
  "TTTTTTtt",
  "CCCCCCcc",
  "PPPPPPPp",
  "PPPPPpPp",
 ]),
}
VEST = {
 ('F', 'up'): (13, 12, [
  "..sSs...",
  ".VxsxVC.",
  "CVVxVVVC",
  "TVVVVVVt",
  "CVvVvVvc",
  "CVVVVVVc",
  "TvvvvvVt",
  "CCCCCCcc",
  "PPPPPPPp",
  "PPPPPpPp",
 ]),
 ('B', 'up'): (13, 12, [
  "..sss...",
  ".VCsCVC.",
  "CVVVVVVC",
  "TVVVVVVt",
  "CVVVVVVc",
  "CVVVVVvc",
  "TvvvvvVt",
  "CCCCCCcc",
  "PPPPPPPp",
  "PPPPPpPp",
 ]),
}
# hands: (rows, attach x, attach y, mode): 'end' hangs one step past the wrist, 'at' is centred on it (gripping)
HANDS = {
 'down': (["SSSs", ".Sd."], 1, 0, 'end'),
 'fist': (["SSs", "Sdd"], 1, 0, 'at'),
 'grip': (["SS", "sd"], 0, 0, 'at'),
}
# shoes: (rows, attach x) ; attach = the column under the ankle centre, top row just below the ankle
SHOES = {
 ('F', 'flat'): (["FFFFf.", "FFFFFf"], 3),
 ('F', 'toe'): (["FFf..", ".FFFf"], 2),
 ('F', 'heel'): ([".FFFf", "FFFf."], 2),
 ('F', 'lift'): (["FFFf.", ".FFFf"], 2),
 ('F', 'kneel'): (["fFF", "ff."], 1),
 ('B', 'flat'): (["FFFFF.", ".FFFFf"], 3),
 ('B', 'toe'): (["..FFf", ".FFf."], 2),
 ('B', 'heel'): (["FFFf.", ".FFFf"], 2),
 ('B', 'lift'): (["FFFf.", ".FFFf"], 2),
 ('B', 'kneel'): ([".FFf", "fff."], 2),
}
def shear_rows(rows, shift_top):
    """forward lean: shift the top rows by shift_top px, easing to 0 at the bottom (pelvis)"""
    n = len(rows)
    out = []
    for j, r in enumerate(rows):
        out.append((rnd(shift_top * (n - 1 - j) / (n - 1)), r))
    return out


# ============================================================================ frame builder
SH_Z, HIP_Z, NECK_Z, SH_R, HIP_R = 15.3, 8.5, 17.0, 5.0, 2.2
ARM_L = (3.8, 2.4)    # world units (3D solve): sleeve to the elbow, forearm to the wrist
ARM_L2 = (3.4, 3.5)   # screen px (2D solve, long reaches)
LEG_L = (3.7, 3.6)


def unit(v):
    L = math.hypot(*v) or 1e-6
    return (v[0] / L, v[1] / L)


def build(view, pose, vest=False):
    near = 'R' if view == 'F' else 'L'
    bob = rnd(pose.get('bob', 0))   # whole pixels, so torso, limbs and head move together
    lean = pose.get('lean', 0.0)
    layers = []
    # ---- torso
    key = (view, pose.get('torso', 'up'))
    x0, y0, rows = (VEST if vest else TORSO)[key]
    T = Layer('torso', 30, sep={'armF'})
    sx = lean if view == 'F' else -lean
    for j, (dx, r) in enumerate(shear_rows(rows, sx)):
        for i, ch in enumerate(r):
            T.put(x0 + dx + i, y0 + bob + j, ch)
    layers.append(T)
    info = {}
    # ---- arms
    for side in 'RL':
        isnear = side == near
        sgn = 1 if side == 'R' else -1
        # the far shoulder tucks in behind the torso (its top is hidden by the near-side shoulder mass)
        sh3 = (lean, sgn * (SH_R if isnear else SH_R + 0.6), SH_Z - bob - (0 if isnear else 1.5))
        sh = P(view, *sh3)
        w3 = pose['h' + side]
        wr = P(view, *w3)
        if pose.get('arm2d', {}).get(side):
            # screen-space solve for holding/reaching: chibi arms cannot reach a rifle's handguard in true 3D
            hint = pose['arm2d'][side]
            l1, l2 = pose.get('armlen', ARM_L2)
            el = ik2(sh, wr, l1, l2, hint if view == 'F' else (-hint[0], hint[1]))
        else:
            pole = pose.get('e' + side, (-1, sgn * 0.3, 0))
            el = P(view, *ik3(sh3, w3, ARM_L[0], ARM_L[1], (pole[0] * KF, pole[1] * KF, pole[2] * KZ)))
        z = pose.get('z' + side, {}).get(view, 40 if isnear else 10)
        A = Layer('arm' + ('N' if isnear else 'F'), z, sep={'torso', 'legN', 'legF', 'armF', 'prop'} if z > 30 else ())
        far = z < 30   # an arm behind the torso shows only its outer columns, in shade
        seg(A, el, wr, 3, ['s', 'S', 's'] if far else ['S', 'S', 's'])
        seg(A, sh, el, 3, ['x', 'C', 'c'] if far else ['C', 'C', 'c'], ring=({1}, ['t', 'T', 't'] if far else ['T', 'T', 't']))
        hand = pose.get('hand' + side, 'down')
        rows_h, hx_, hy_, mode = HANDS[hand]
        d = unit((wr[0] - el[0], wr[1] - el[1]))
        att = rp((wr[0] + d[0], wr[1] + d[1])) if mode == 'end' else rp(wr)
        hr = rows_h
        mir = (d[0] < -0.3) if hand != 'down' else (view == 'B')
        if mir:
            hr = [r[::-1] for r in hr]
            hx_ = len(rows_h[0]) - 1 - hx_
        A.stamp(hr, att[0] - hx_, att[1] - hy_)
        layers.append(A)
        info['hand' + side] = rp(wr)
    # ---- legs
    for side in 'RL':
        isnear = side == near
        sgn = 1 if side == 'R' else -1
        hip3 = (0, sgn * HIP_R, HIP_Z - bob)
        f3 = pose['f' + side]
        kn3 = ik3(hip3, f3, LEG_L[0], LEG_L[1], (KF, 0, 0))
        hp, kn, an = P(view, *hip3), P(view, *kn3), P(view, *f3)
        L = Layer('leg' + ('N' if isnear else 'F'), 20 if isnear else 15, sep={'legF', 'armF'} if isnear else ())
        far = not isnear
        cols = ['P', 'p', 'p', 'p'] if far else ['P', 'P', 'P', 'p']
        seg(L, hp, kn, 4, cols)
        seg(L, kn, an, 4, cols)
        shoe = pose.get('s' + side, 'flat')
        srows, sax = SHOES[(view, shoe)]
        a = rp(an)
        if far:
            srows = [r.replace('F', 'f', max(0, r.count('F') - 2)) for r in srows]
        L.stamp(srows, a[0] - sax, a[1] + 1)
        layers.append(L)
    for pr in pose.get('props', []):
        layers.append(draw_prop(view, pr))
    img = compose(layers)
    rows_out = to_rows(img)
    # the head sits on the neck of the (sheared) torso bitmap
    top_dx = shear_rows(rows, sx)[0][0]
    fr = {'rows': rows_out, 'head': [AX + top_dx, rnd(AY - NECK_Z) + bob]}
    g = pose.get('gun')
    if g:
        th = info['handR']
        if g == 'hands':
            sp = info['handL']
        else:   # a direction (f, r, z): a point 8 units down the barrel from the trigger hand
            h = pose['hR']
            sp = rp(P(view, h[0] + g[0] * 8, h[1] + g[1] * 8, h[2] + g[2] * 8))
        fr['gun'] = [th[0], th[1], sp[0], sp[1]]
    if pose.get('mag'):
        fr['mag'] = list(rp(P(view, *pose['mag'])))
    return fr


# ---------------------------------------------------------------------------- props
def poly_pixels(pts):
    """pixels whose centres lie inside a convex polygon (screen coords, either winding)"""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    out = []
    n = len(pts)
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
            s = [((pts[(i + 1) % n][0] - pts[i][0]) * (y - pts[i][1]) - (pts[(i + 1) % n][1] - pts[i][1]) * (x - pts[i][0])) for i in range(n)]
            if all(v >= -0.01 for v in s) or all(v <= 0.01 for v in s):
                out.append((x, y))
    return out


def crate_rows():
    """a wooden crate in true iso: lit top, the face toward screen-left in base tone, the other shaded, slats"""
    g = {}
    top = [(6, 0), (10, 2), (4, 5), (0, 3)]
    left = [(0, 3), (4, 5), (4, 10), (0, 8)]
    right = [(4, 5), (10, 2), (10, 7), (4, 10)]
    for (x, y) in poly_pixels(right):
        g[(x, y)] = 'w' if (y + (x - 4) * 0.5) in (7.5, 7.0) else 'b'
    for (x, y) in poly_pixels(left):
        g[(x, y)] = 'b' if (y - x * 0.5) in (5.5, 6.0) else 'B'
    for (x, y) in poly_pixels(top):
        g[(x, y)] = 'B'
    for (x, y) in [(4, 5), (4, 6), (4, 7), (4, 8), (4, 9)]:
        g[(x, y)] = 'b'
    for (x, y) in [(5, 2), (6, 2), (7, 3), (3, 3), (2, 3)]:
        g[(x, y)] = 'b'          # a plank seam across the lid
    return [''.join(g.get((x, y), '.') for x in range(11)) for y in range(11)]


CRATE = crate_rows()
BASKET = [   # wicker basket: light rim around a dark opening, woven sides
 "..BBBBBB..",
 ".BwwwwwwB.",
 "BBwwwwwwBB",
 "bBBBBBBBBb",
 "bBbBbBbBbb",
 ".bBbBbBbb.",
 "..bbbbbb..",
]
CROP = ["WWw.", "WWWw", ".wWW", "..ww"]   # a clump of potatoes


def draw_prop(view, pr):
    kind = pr[0]
    z = pr[-1] if isinstance(pr[-1], dict) else {}
    zz = z.get(view, 35)
    L = Layer('prop', zz, sep=z.get('sep', ('torso', 'armF', 'legN', 'legF')) if zz > 30 else ())
    if kind == 'pick':
        _, g, th = pr[:3]
        c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
        butt = (g[0] - c * 1.6, g[1], g[2] - s * 1.6)
        tip = (g[0] + c * 8.4, g[1], g[2] + s * 8.4)
        seg(L, P(view, *butt), P(view, *tip), 2, ['W', 'w'])
        # the head: a curved spike forward of the swing, a short flat back end
        a = (tip[0] - s * 4.2 - c * 1.0, tip[1], tip[2] + c * 4.2 - s * 1.0)
        m = (tip[0] + c * 0.6, tip[1], tip[2] + s * 0.6)
        b = (tip[0] + s * 2.6, tip[1], tip[2] - c * 2.6)
        seg(L, P(view, *m), P(view, *a), 2, ['M', 'm'])
        seg(L, P(view, *m), P(view, *b), 2, ['M', 'm'])
        L.put(*rp(P(view, *a)), 'M')
    elif kind in ('crate', 'basket', 'crop'):
        rows = {'crate': CRATE, 'basket': BASKET, 'crop': CROP}[kind]
        x, y = rp(P(view, *pr[1]))
        L.stamp(rows, x - len(rows[0]) // 2, y - len(rows) // 2)
    return L


# ============================================================================ poses
FOOT_Z = 3.0
STEP = 3.0      # half stride (iso units): a planted foot moves back 1.5 units = (1.5, 0.75) px per walk frame


def stand_feet(p, fr=(0, 2.4), fl=(0, -2.4)):
    p['fR'] = (fr[0], fr[1], FOOT_Z)
    p['fL'] = (fl[0], fl[1], FOOT_Z)
    return p


def hang(p, swingR=0.0, swingL=0.0, z=10.2):
    # wrists straight under the shoulders, lifted a little on a swing
    p['hR'] = (0.4 + swingR, 5.1, z + 0.3 * abs(swingR))
    p['hL'] = (0.4 + swingL, -5.7, z - 1.2 + 0.3 * abs(swingL))
    return p


def anim_idle():
    out = []
    for k in range(4):
        p = {'bob': [0, 0, 1, 1][k]}
        hang(p, z=10.2 - p['bob'])
        stand_feet(p)
        out.append(p)
    return out


# walk phase of one foot: 0 contact (front), 1 down, 2 passing, 3 up (planted, behind), 4 push-off,
# 5-7 swinging through the air
def walk_foot(ph, lat):
    f = [STEP, STEP / 2, 0, -STEP / 2, -STEP, -STEP / 2, 0, STEP / 2][ph]
    lift = [0, 0, 0, 0, 0, 1.5, 2.2, 1.0][ph]
    shoe = ['heel', 'flat', 'flat', 'flat', 'toe', 'lift', 'lift', 'lift'][ph]
    return (f, lat, FOOT_Z + lift), shoe


def anim_walk(arms=True):
    out = []
    for k in range(8):
        p = {'bob': [1, 1, 0, 0, 1, 1, 0, 0][k]}
        p['fR'], p['sR'] = walk_foot(k, 2.2)
        p['fL'], p['sL'] = walk_foot((k + 4) % 8, -2.2)
        c = math.cos(2 * math.pi * k / 8)
        swing = lambda v: v * (0.9 if v > 0 else 0.6)   # arms swing further forward than back
        if arms:
            hang(p, swingR=swing(-c), swingL=swing(c), z=10.2 - p['bob'])
            p['eR'] = (-1, 0.3, 0.2)
            p['eL'] = (-1, -0.3, 0.2)
        out.append(p)
    return out


def aim_pose(sway=0.0, kick=0.0, rise=0.0):
    """rifle in the right shoulder: trigger hand at the grip, support hand 8 units down the barrel"""
    p = {'bob': 0, 'lean': 0.4 - kick * 0.6}
    stand_feet(p, fr=(-1.4, 2.9), fl=(1.6, -2.7))
    p['hR'] = (2.0 - kick, 3.0, 14.0 + rise)
    p['hL'] = (10.0 - kick, 3.0, 14.0 + rise * 1.8 + sway)
    p['handR'] = p['handL'] = 'fist'
    p['arm2d'] = {'R': (-0.3, 1), 'L': (0.4, 1)}
    p['zL'] = {'F': 45, 'B': 40}
    p['gun'] = 'hands'
    return p


def anim_aim():
    return [aim_pose(0), aim_pose(-0.6)]


def anim_shoot():
    return [aim_pose(0), aim_pose(0, kick=1.6, rise=0.9), aim_pose(0, kick=0.7, rise=0.35)]


def anim_reload():
    down = (0.94, 0, -0.34)
    level = (1.0, 0, -0.1)
    out = []

    def base(hl, gun=down, hr=(2.0, 3.0, 12.6), mag=None, handL='fist', lean=0.2):
        p = {'bob': 0, 'lean': lean}
        stand_feet(p, fr=(-1.4, 2.9), fl=(1.6, -2.7))
        p['hR'] = hr
        p['hL'] = hl
        p['handR'] = 'fist'
        p['handL'] = handL
        p['arm2d'] = {'R': (-0.3, 1), 'L': (0.2, 1)}
        p['zL'] = {'F': 45, 'B': 40}
        p['gun'] = gun
        if mag:
            p['mag'] = mag
        return p
    out.append(base((7.6, 3.0, 10.4)))                                       # 0 rifle lowered, support on the handguard
    out.append(base((4.6, 2.6, 10.0)))                                       # 1 support hand on the magazine
    out.append(base((4.2, 2.2, 7.6), mag=(4.2, 2.2, 8.4), handL='grip'))      # 2 magazine pulled out and down
    out.append(base((1.4, -2.6, 9.2), mag=(1.4, -2.6, 10.0), handL='grip'))   # 3 old one gone, new one from the pouch
    out.append(base((3.6, 1.0, 9.6), mag=(3.6, 1.0, 10.4), handL='grip'))     # 4 new magazine coming up
    out.append(base((4.4, 2.6, 10.6), mag=(4.4, 2.6, 11.2), handL='grip'))    # 5 seated in the magwell
    out.append(base((2.6, 2.0, 14.0), gun=level, hr=(2.0, 3.0, 13.2)))      # 6 rack the bolt
    out.append(base((8.6, 3.0, 13.4), gun='hands', hr=(2.0, 3.0, 13.6), lean=0.3))  # 7 back up to the shoulder
    return out


def anim_climb():
    """on a ladder: hands on the rails beside the head, feet on the rungs, left hand with right foot"""
    out = []
    for k in range(4):
        up = [1, 0, -1, 0][k]           # +1: left hand high, right foot high
        p = {'bob': [1, 0, 1, 0][k], 'lean': 0.4}
        hi, lo = 21.6, 18.4
        mid = (hi + lo) / 2
        p['hL'] = (1.5, -6.0, mid + (hi - mid) * up - p['bob'])
        p['hR'] = (1.5, 6.0, mid - (hi - mid) * up - p['bob'])
        p['handR'] = p['handL'] = 'grip'
        p['arm2d'] = {'R': (-1, 0.2), 'L': (1, 0.2)}
        p['armlen'] = (3.4, 3.6)
        p['zR'] = {'F': 40, 'B': 12}
        p['zL'] = {'F': 12, 'B': 40}
        lo_f, hi_f = 2.4, 6.6
        p['fR'] = (1.6, 2.2, (hi_f if up > 0 else lo_f) if up else (hi_f + lo_f) / 2)
        p['fL'] = (1.6, -2.2, (lo_f if up > 0 else hi_f) if up else (hi_f + lo_f) / 2)
        p['sR'] = p['sL'] = 'flat'
        out.append(p)
    return out


def anim_mine():
    keys = [  # grip near the butt (f, r, z), pickaxe angle (deg: 0 forward, 90 up, 180 back), lean, bob
        ((2.8, 1.2, 11.2), 28, 0.6, 0),      # 0 lift out of the rock
        ((0.4, 4.0, 16.0), 116, 0.0, 0),     # 1 raise, hands up by the right shoulder
        ((0.0, 2.8, 18.0), 152, -0.4, 0),    # 2 wound up over the shoulder
        ((2.4, 1.6, 15.6), 30, 0.6, 0),      # 3 swinging through, head out in front
        ((3.8, 1.2, 10.6), -40, 1.6, 1),     # 4 strike
        ((3.4, 1.2, 10.8), -22, 1.3, 1),     # 5 bite, shoulders loose
    ]
    out = []
    for g, th, lean, bob in keys:
        p = {'bob': bob, 'lean': lean}
        stand_feet(p, fr=(-1.6, 3.0), fl=(1.8, -2.8))
        c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
        p['hR'] = (g[0] + c * 1.5, g[1] + 0.3, g[2] + s * 1.5)   # right hand higher up the handle
        p['hL'] = (g[0] - c * 0.2, g[1] - 0.4, g[2] - s * 0.2)
        p['handR'] = p['handL'] = 'grip'
        p['arm2d'] = {'R': (-0.6, 1), 'L': (0.6, 1)}
        p['armlen'] = (3.3, 3.4)
        front = th < 110
        p['zL'] = {'F': 45, 'B': 12 if front else 40}
        p['zR'] = {'F': 41, 'B': 11 if front else 40}
        p['props'] = [('pick', g, th, {'F': 43 if front else 5, 'B': 6 if front else 44})]
        out.append(p)
    return out


def anim_farm():
    """kneel by the plants, pull a crop, drop it in the basket at the side"""
    def base(hr, hl, bob=3.6, lean=1.6, props=()):
        p = {'bob': bob, 'lean': lean}
        # near knee down (shin flat behind it), far foot planted ahead with its knee up
        p['fR'] = (-3.0, 2.6, 2.6)
        p['sR'] = 'kneel'
        p['fL'] = (2.0, -2.6, FOOT_Z)
        p['hR'], p['hL'] = hr, hl
        p['handR'] = p['handL'] = 'grip'
        p['arm2d'] = {'R': (-0.5, 1), 'L': (0.5, 1)}
        p['armlen'] = (3.2, 3.3)
        p['zL'] = {'F': 45, 'B': 12}
        p['zR'] = {'F': 41, 'B': 13}
        p['props'] = [('basket', (-2.6, 7.2, 2.6), {'F': 50, 'B': 3})] + list(props)
        return p
    crop = lambda f, r, z, zz: ('crop', (f, r, z), zz)
    return [
        base((3.6, 2.4, 6.6), (3.6, -1.2, 6.6), bob=3.0, lean=1.2),                                   # 0 kneel, reach
        base((4.6, 1.8, 3.2), (4.6, -0.6, 3.2), props=[crop(4.6, 0.6, 2.6, {'F': 47, 'B': 8})]),       # 1 hands on the plant
        base((4.6, 1.8, 5.0), (4.6, -0.6, 5.0), lean=1.0, props=[crop(5.0, 0.6, 3.8, {'F': 47, 'B': 8})]),   # 2 pull
        base((3.0, 2.0, 9.0), (3.0, -0.4, 9.0), bob=3.0, lean=0.6, props=[crop(3.4, 0.8, 8.0, {'F': 47, 'B': 8})]),  # 3 lifted
        base((0.4, 5.2, 8.0), (1.2, 2.8, 8.0), bob=3.0, lean=0.4, props=[crop(0.6, 4.4, 7.0, {'F': 47, 'B': 47})]),  # 4 to the basket
        base((-1.8, 6.6, 5.6), (-1.0, 4.6, 5.6), lean=0.6, props=[crop(-2.4, 7.0, 3.4, {'F': 51, 'B': 4})]),  # 5 in
    ]


def anim_carry():
    out = []
    for p in anim_walk(arms=False):
        b = p['bob']
        p['hR'] = (3.0, 3.4, 11.8 - b)
        p['hL'] = (3.0, -3.4, 11.8 - b)
        p['handR'] = p['handL'] = 'grip'
        p['arm2d'] = {'R': (-0.8, 1), 'L': (0.8, 1)}
        p['armlen'] = (3.2, 3.2)
        p['props'] = [('crate', (3.2, 0, 12.2 - b), {'F': 38, 'B': 12})]
        p['zR'] = {'F': 41, 'B': 11}
        p['zL'] = {'F': 13, 'B': 41}
        out.append(p)
    return out


# ---------------------------------------------------------------------------- sleep
# Lying on the back on a bed that runs toward screen down-right, head at the upper-left end. The anchor is
# the floor point under the middle of the bed; the mattress top is SLEEP_UP px above it (the bunker's beds).
SLEEP_UP = 6
SLEEP_LEN = 15.0      # neck to toes, body units along the bed


def sleep_frame(breath=0.0):
    """pillow and blanket (shirt colours) over a lying body: a height field over (u along the bed from the
    neck, v across), shaded in three flat tones and outlined. breath lifts the chest."""
    cx, cy = AX, AY - SLEEP_UP
    def proj(u, v, h):  # true iso here, so the body lines up with the bed boxes of the world
        f, r = u - SLEEP_LEN / 2 + 1.5, v
        return (cx + 0.7071 * (f - r), cy + 0.3536 * (f + r) - 0.866 * h)
    def lerp_tab(tab, x):
        for (a, va), (b, vb) in zip(tab, tab[1:]):
            if a <= x <= b:
                return va + (vb - va) * (x - a) / (b - a)
        return tab[0][1] if x < tab[0][0] else tab[-1][1]
    width = [(0, 4.6), (2.5, 5.2), (5.5, 4.6), (8, 4.4), (11, 3.6), (13.2, 3.2), (15, 3.4)]
    thick = [(0, 2.4), (2.4, 3.7 + breath), (4.6, 3.3 + breath * 0.6), (7, 3.0), (10.4, 2.5), (12.6, 2.1), (13.8, 2.6), (15, 3.0)]
    def height(u, v):
        if u < 0 or u > SLEEP_LEN:
            return None
        hw = lerp_tab(width, u)
        if abs(v) > hw:
            return None
        t = abs(v) / hw
        h = lerp_tab(thick, u) * (1 - t ** 2.6) ** 0.5
        if u > 13.4:  # two toes pushing the blanket up
            h += 0.7 * max(0.0, 1 - abs(abs(v) - 1.3) / 1.0)
        return max(0.4, h)
    best = {}
    n = 6
    for iu in range(int(SLEEP_LEN * n) + 1):
        u = iu / n
        for iv in range(-7 * n, 7 * n + 1):
            v = iv / n
            h = height(u, v)
            if h is None:
                continue
            hu = (height(min(SLEEP_LEN, u + 0.35), v) or 0.4) - (height(max(0.0, u - 0.35), v) or 0.4)
            hv = (height(u, v + 0.35) or 0.4) - (height(u, v - 0.35) or 0.4)
            # light from the upper left: slopes facing -u (toward the head) and +v (toward screen-left) are lit
            lit = -0.9 * hu + 0.7 * hv
            for hh, side in ((h, 0), (h * 0.5, 1), (0.0, 1)):
                x, y = proj(u, v, hh)
                k = (rnd(x), rnd(y))
                dep = (u + v) + hh * 3
                if side:
                    ch = 'c' if v > 0 else 'x'
                elif u < 1.3:
                    ch = 'T' if lit > -0.6 else 't'      # the folded-back hem in the stripe colours
                else:
                    ch = 'C' if lit > -0.45 else ('c' if lit > -1.6 else 'x')
                if k not in best or dep > best[k][0]:
                    best[k] = (dep, ch)
    blanket = Layer('blanket', 30)
    for k, (dep, ch) in best.items():
        blanket.put(k[0], k[1], ch)
    # hands resting on the blanket over the belly
    hands = Layer('hands', 40, sep={'blanket'})
    for v in (1.4, -1.0):
        x, y = proj(5.2, v, lerp_tab(thick, 5.2) * (1 - (abs(v) / 4.6) ** 2.6) ** 0.5 + 0.6)
        hands.put(rnd(x), rnd(y), 'S')
        hands.put(rnd(x) + 1, rnd(y), 's')
    # the pillow: a soft box under the head end
    pillow = Layer('pillow', 20)
    for iu in range(-48, 1):
        for iv in range(-30, 31):
            u, v = iu / 6 - 1.0, iv / 6
            if abs(v) > 5.0 or u < -8.6:
                continue
            e = max(abs(v) / 5.0, abs(u + 4.8) / 3.8)
            h = 2.2 * (1 - e ** 4)
            for hh in (h, 0.0):
                x, y = proj(u, v, hh)
                k = (rnd(x), rnd(y))
                ch = 'F' if hh > 0 and v > -3.4 else 'f'
                if k not in pillow.px or hh > 0:
                    pillow.put(k[0], k[1], ch)
    img = compose([pillow, blanket, hands])
    hx, hy = proj(-1.6, 0.0, 1.6)
    return {'rows': to_rows(img), 'head': [rnd(hx), rnd(hy)]}


# ============================================================================ build + export
ANIMS = [  # name, fps, loop
    ('idle', 3, True),
    ('walk', 8, True),       # 1 frame per 0.133 world units walked (scale 16): the planted foot does not slide
    ('aim', 2, True),
    ('shoot', 14, False),
    ('reload', 8, False),
    ('climb', 6, True),
    ('mine', 8, True),
    ('farm', 6, True),
    ('carry', 8, True),
    ('sleep', 1.5, True),
]
POSES = {'idle': anim_idle, 'walk': anim_walk, 'aim': anim_aim, 'shoot': anim_shoot, 'reload': anim_reload,
         'climb': anim_climb, 'mine': anim_mine, 'farm': anim_farm, 'carry': anim_carry}


def build_body(vest):
    anims = {}
    for name, fps, loop in ANIMS:
        if name == 'sleep':
            frs = [sleep_frame(0.0), sleep_frame(1.3)]
            views = {'F': frs, 'B': [dict(f) for f in frs]}   # the bed always runs down-right; B = F
        else:
            poses = POSES[name]()
            views = {v: [build(v, p, vest) for p in poses] for v in 'FB'}
        anims[name] = {'fps': fps, 'loop': loop, 'F': views['F'], 'B': views['B']}
    return {'w': FW, 'h': FH, 'ax': AX, 'ay': AY, 'anims': anims}


def build_heads():
    heads = {}
    for look, st in HEADS.items():
        heads[look] = {'w': HW, 'h': HH, 'ax': HAX, 'ay': HAY,
                       'F': outline_rows(st['F']), 'B': outline_rows(st['B']), 'sleep': outline_rows(st['sleep'])}
    gear = {}
    for g, st in GEAR.items():
        gear[g] = {'w': HW, 'h': HH, 'ax': HAX, 'ay': HAY, 'F': outline_rows(st['F']), 'B': outline_rows(st['B'])}
    return heads, gear


def validate(data):
    letters = set(data['pal'])
    def rows_ok(rows, w, h, what):
        assert len(rows) == h, (what, 'height', len(rows))
        for r in rows:
            assert len(r) == w, (what, 'width', r)
            bad = set(r) - letters - {'.'}
            assert not bad, (what, 'letters', bad)
    for bname, b in data['bodies'].items():
        for an, a in b['anims'].items():
            assert len(a['F']) == len(a['B']), (bname, an)
            for v in 'FB':
                for i, fr in enumerate(a[v]):
                    rows_ok(fr['rows'], FW, FH, (bname, an, v, i))
                    assert len(fr['head']) == 2
    for hn, hd in data['heads'].items():
        for v in ('F', 'B', 'sleep'):
            rows_ok(hd[v], HW, HH, (hn, v))
    for gn, gd in data['gear'].items():
        for v in ('F', 'B'):
            rows_ok(gd[v], HW, HH, (gn, v))


def build_all():
    heads, gear = build_heads()
    data = {'pal': PAL, 'bodies': {'human': build_body(False), 'humanVest': build_body(True)}, 'heads': heads, 'gear': gear}
    validate(data)
    return data


def frame_json(fr):
    keys = ['rows', 'head'] + [k for k in ('gun', 'mag') if k in fr]
    return '{' + ','.join(json.dumps(k) + ':' + json.dumps(fr[k], separators=(',', ':')) for k in keys) + '}'


def export(data, path):
    """readable JS: one frame row per line, so diffs stay small"""
    out = ["'use strict';",
           "// Survivor sprites (32x32 frames), generated by tools/humans32.py - edit that, not this file.",
           "// Bodies: anims[name] = {fps, loop, F: [frames], B: [frames]}; F faces down-right, B faces up-left;",
           "// mirror F for down-left and B for up-right. (ax, ay) = ground point between the feet.",
           "// frame.head = body pixel for the head anchor; gun = [trigger hand x, y, point down the barrel x, y];",
           "// mag = top-left of the loose magazine while it is out of the rifle.",
           "// Heads and gear: stamps with their own outline, anchor (ax, ay) = chin/neck point; draw gear over the head.",
           'window.ART_HUMANS = {',
           '  pal: ' + json.dumps(data['pal'], separators=(',', ':')) + ',',
           '  bodies: {']
    for bname, b in data['bodies'].items():
        out.append('    %s: {w: %d, h: %d, ax: %d, ay: %d, anims: {' % (bname, b['w'], b['h'], b['ax'], b['ay']))
        for an, a in b['anims'].items():
            out.append('      %s: {fps: %s, loop: %s,' % (an, json.dumps(a['fps']), 'true' if a['loop'] else 'false'))
            for v in 'FB':
                out.append('        %s: [' % v)
                for fr in a[v]:
                    out.append('          ' + frame_json(fr) + ',')
                out.append('        ],')
            out.append('      },')
        out.append('    }},')
    out.append('  },')
    out.append('  heads: {')
    for hn, hd in data['heads'].items():
        out.append('    %s: {w: %d, h: %d, ax: %d, ay: %d,' % (hn, hd['w'], hd['h'], hd['ax'], hd['ay']))
        for v in ('F', 'B', 'sleep'):
            out.append('      %s: %s,' % (v, json.dumps(hd[v], separators=(',', ':'))))
        out.append('    },')
    out.append('  },')
    out.append('  gear: {')
    for gn, gd in data['gear'].items():
        out.append('    %s: {w: %d, h: %d, ax: %d, ay: %d,' % (gn, gd['w'], gd['h'], gd['ax'], gd['ay']))
        for v in ('F', 'B'):
            out.append('      %s: %s,' % (v, json.dumps(gd[v], separators=(',', ':'))))
        out.append('    },')
    out.append('  },')
    out.append('};')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh:
        fh.write('\n'.join(out) + '\n')


# ============================================================================ check sheets (--preview)
PREVIEW_DIR = '/tmp/claude-0/humans/'
GRASS, DIRT = (82, 118, 54), (152, 120, 84)
GUN_COLS = {'1': (46, 44, 50), '2': (36, 36, 42), '3': (52, 50, 58)}


def _mix(c, t, k):
    return [int(round(c[i] + (t[i] - c[i]) * k)) for i in range(3)]


def look_pal(shirt, stripe, skin, hair):
    """a person's palette the way the runtime might derive it: shade/deep shift toward violet"""
    cool, warm = (46, 38, 84), (255, 232, 180)
    ramp = lambda b: (b, _mix([v * .8 for v in b], cool, .12), _mix([v * .62 for v in b], cool, .22))
    p = {k: list(v) for k, v in PAL.items()}
    p['C'], p['c'], p['x'] = ramp(shirt)
    p['T'], p['t'], _ = ramp(stripe)
    p['S'], p['s'], p['d'] = ramp(skin)
    p['H'] = hair
    p['h'] = _mix([min(255, v * 1.35 + 12) for v in hair], warm, .12)
    out = {k: tuple(v) for k, v in p.items()}
    out.update(GUN_COLS)
    return out


TEST_LOOKS = {
    'hero':    look_pal([102, 122, 74], [74, 90, 56], [234, 184, 144], [96, 64, 44]),
    'minjun':  look_pal([172, 82, 72], [128, 58, 56], [242, 202, 168], [40, 34, 38]),
    'seoyeon': look_pal([84, 112, 158], [62, 82, 122], [248, 210, 184], [52, 36, 34]),
    'doyun':   look_pal([196, 166, 104], [150, 124, 76], [204, 150, 110], [70, 52, 40]),
    'haeun':   look_pal([124, 98, 152], [94, 72, 118], [240, 198, 162], [156, 72, 44]),
    'jiho':    look_pal([90, 140, 120], [64, 104, 88], [166, 116, 86], [64, 46, 38]),
}


def _px_line(a, b):
    a, b = rp(a), rp(b)
    n = max(1, max(abs(b[0] - a[0]), abs(b[1] - a[1])))
    return [(rnd(a[0] + (b[0] - a[0]) * k / n), rnd(a[1] + (b[1] - a[1]) * k / n)) for k in range(n + 1)]


def figure(data, fr, view, look, gear=None, sleep=False):
    """body + head (+gear) + the rifle as the game draws it (18 px, stock 2 px behind the trigger hand,
    in front of the body in F and behind it in B) + the loose magazine; returns {(x, y): letter}"""
    g = {}
    for y, row in enumerate(fr['rows']):
        for x, ch in enumerate(row):
            if ch != '.':
                g[(x, y)] = ch
    hx, hy = fr['head']
    stamps = [data['heads'][look]['sleep' if sleep else view]]
    if gear and not sleep:
        stamps.append(data['gear'][gear][view])
    for st in stamps:
        for j, row in enumerate(st):
            for i, ch in enumerate(row):
                if ch != '.':
                    g[(hx - HAX + i, hy - HAY + j)] = ch
    if 'gun' in fr:
        x0, y0, x1, y1 = fr['gun']
        L = math.hypot(x1 - x0, y1 - y0) or 1
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        at = lambda t: (x0 + ux * 18 * t, y0 + uy * 18 * t)
        pts = []
        for p in _px_line((x0 - ux * 2, y0 - uy * 2), (x0, y0)):
            pts += [(p, 'W'), ((p[0], p[1] + 1), 'W')]
        for p in _px_line((x0, y0), at(.55)):
            pts += [(p, '1'), ((p[0], p[1] + 1), '1')]
        pts += [(p, '2') for p in _px_line(at(.55), at(1))]
        m = rp(at(.38))
        pts += [((m[0], m[1] + k), '1') for k in (1, 2, 3)]
        for p, ch in pts:
            if view == 'F' or p not in g:
                g[p] = ch
    if 'mag' in fr:
        for y in range(3):
            for x in range(2):
                g[(fr['mag'][0] + x, fr['mag'][1] + y)] = '3'
    return g


def _paint(d, g, ox, oy, scale, pal, mirror=False):
    for (x, y), ch in g.items():
        if mirror:
            x = FW - 1 - x
        X, Y = (ox + x) * scale, (oy + y) * scale
        d.rectangle([X, Y, X + scale - 1, Y + scale - 1], fill=pal.get(ch, (255, 0, 255)))


def previews(data):
    from PIL import Image, ImageDraw
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    out = []
    # 1) every animation, 6x: F row and B row, frames left to right; red dot = anchor
    for body, look, gear in (('human', 'hero', None), ('humanVest', 'minjun', 'helmet')):
        anims = data['bodies'][body]['anims']
        for an, a in anims.items():
            n, s = len(a['F']), 6
            img = Image.new('RGB', (n * 34 * s, 2 * 36 * s), (236, 232, 222))
            d = ImageDraw.Draw(img)
            for vi, v in enumerate('FB'):
                for i, fr in enumerate(a[v]):
                    ox, oy = i * 34 + 1, vi * 36 + 3
                    d.rectangle([ox * s, oy * s, (ox + 32) * s - 1, (oy + 32) * s - 1], outline=(214, 208, 198))
                    _paint(d, figure(data, fr, v, look, gear, an == 'sleep'), ox, oy, s, TEST_LOOKS[look])
                    d.rectangle([(ox + AX) * s + 2, (oy + AY) * s + 2, (ox + AX + 1) * s - 3, (oy + AY + 1) * s - 3], fill=(255, 0, 0))
            p = PREVIEW_DIR + 'anim_%s%s.png' % (an, '' if body == 'human' else '_vest')
            img.save(p)
            out.append(p)
        # all animations on one sheet, 4x
        rows = [(an, v, a[v]) for an, a in anims.items() for v in 'FB']
        s = 4
        img = Image.new('RGB', (8 * 34 * s, len(rows) * 36 * s), (236, 232, 222))
        d = ImageDraw.Draw(img)
        for ri, (an, v, frs) in enumerate(rows):
            for i, fr in enumerate(frs):
                _paint(d, figure(data, fr, v, look, gear, an == 'sleep'), i * 34 + 1, ri * 36 + 3, s, TEST_LOOKS[look])
        p = PREVIEW_DIR + ('sheet_all.png' if body == 'human' else 'sheet_all_vest.png')
        img.save(p)
        out.append(p)
    # 2) in the world: six people with their own colours, gear, mirrored views, on grass and dirt, 1x and 3x
    cast = [('human', 'idle', 'F', 0, 'hero', None, False), ('humanVest', 'aim', 'F', 0, 'hero', 'helmet', False),
            ('human', 'walk', 'B', 2, 'minjun', None, False), ('human', 'mine', 'F', 2, 'jiho', 'hardhat', True),
            ('human', 'walk', 'F', 5, 'seoyeon', None, True), ('human', 'farm', 'F', 3, 'haeun', 'cap', False),
            ('humanVest', 'shoot', 'B', 1, 'doyun', 'helmet', False), ('human', 'carry', 'F', 3, 'doyun', None, False),
            ('human', 'idle', 'B', 1, 'haeun', None, True), ('human', 'reload', 'F', 2, 'minjun', 'helmet', True),
            ('human', 'climb', 'B', 0, 'seoyeon', None, False), ('human', 'aim', 'B', 0, 'jiho', 'cap', True)]
    for s in (1, 3):
        W = len(cast) * 30 + 10
        img = Image.new('RGB', (W * s, 2 * 46 * s))
        d = ImageDraw.Draw(img)
        for bi, bg in enumerate((GRASS, DIRT)):
            d.rectangle([0, bi * 46 * s, W * s, (bi + 1) * 46 * s - 1], fill=bg)
            for k, (body, an, v, i, look, gear, mir) in enumerate(cast):
                fr = data['bodies'][body]['anims'][an][v][i]
                _paint(d, figure(data, fr, v, look, gear), 4 + k * 30 - 1, bi * 46 + 10, s, TEST_LOOKS[look], mir)
        p = PREVIEW_DIR + 'context_%dx.png' % s
        img.save(p)
        out.append(p)
    # 3) the six faces: F and B bare and under each headgear, then asleep
    s, looks, gears = 8, list(HEADS), [None, 'helmet', 'hardhat', 'cap']
    img = Image.new('RGB', ((len(gears) * 2 + 1) * 17 * s, len(looks) * 17 * s), GRASS)
    d = ImageDraw.Draw(img)
    for li, look in enumerate(looks):
        c = 0
        for gname in gears:
            for v in 'FB':
                g = {}
                for st in [data['heads'][look][v]] + ([data['gear'][gname][v]] if gname else []):
                    for y, row in enumerate(st):
                        for x, ch in enumerate(row):
                            if ch != '.':
                                g[(x, y)] = ch
                _paint(d, g, c * 17 + 1, li * 17 + 1, s, TEST_LOOKS[look])
                c += 1
        g = {(x, y): ch for y, row in enumerate(data['heads'][look]['sleep']) for x, ch in enumerate(row) if ch != '.'}
        _paint(d, g, c * 17 + 1, li * 17 + 1, s, TEST_LOOKS[look])
    p = PREVIEW_DIR + 'faces.png'
    img.save(p)
    out.append(p)
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    data = build_all()
    path = os.path.join(here, '..', 'art', 'humans.js')
    export(data, path)
    n = sum(len(a['F']) + len(a['B']) for a in data['bodies']['human']['anims'].values())
    print('wrote', os.path.normpath(path), '-', n, 'frames per body,', len(data['heads']), 'heads,', len(data['gear']), 'gear')
    if '--preview' in sys.argv:
        for p in previews(data):
            print('preview', p)


if __name__ == '__main__':
    main()
