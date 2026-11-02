"""The floating island: grass top from hand-made tiles, soil cliff, rims, landmarks.

The island is 64 x 64 steps (256 x 128 px) centred on (0, 0). The top is 8 x 8 cells of 8 steps; each
cell shows one of the hand-made 32 x 16 grass tiles (materials.GRASS_TILES) picked by the typed map
materials.GRASS_MAP. Landmarks (bushes, rocks, a stump) are placed by hand in the outer ring, where
no yard of the first era reaches.
"""
import numpy as np

from pal import CLEAR, N
import materials as M

R = 32               # half size in steps
DEPTH = 18           # cliff rows under the top edge (the drawing decides the ragged underside)
CELL = 8


def _diamond(lx, ly):
    """is local pixel (lx, ly) of a 32 x 16 cell inside its diamond (pixel-centre test)?"""
    d = (lx + .5 - 16) / 2
    s = ly + .5
    wx, wy = (s + d) / 2, (s - d) / 2
    return 0 <= wx < CELL and 0 <= wy < CELL


def _bake_tiles():
    tiles = {}
    for name, stamps in M.GRASS_TILES.items():
        t = np.full((16, 32), CLEAR, np.uint8)
        for key, x, y in stamps:
            spr = M.STAMP[key]
            h, w = spr.shape
            for j in range(h):
                for i in range(w):
                    if spr[j, i] != CLEAR:
                        assert _diamond(x + i, y + j), (name, key, x + i, y + j)
                        t[y + j, x + i] = spr[j, i]
        tiles[name] = t
    return tiles


TILES = _bake_tiles()

# corners cut by hand so the island is not a ruler-made diamond: (world x, world y) -> pixels removed
CORNER_BITES = 3

LANDMARKS = [  # (sprite, x, y) in world steps, anchor = bottom centre of the sprite
    ('BUSH', -27, -24), ('BUSH_SMALL', -24, -28), ('ROCK', 26, -27), ('ROCK_SMALL', 29, -22),
    ('STUMP', -29, 18), ('BUSH', 27, 25), ('BUSH_SMALL', 24, 28), ('ROCK', -26, 27),
    ('ROCK_SMALL', -22, 29), ('BONES', 28, 4), ('TIRE', -28, 2), ('BUSH_SMALL', 6, -29),
    ('ROCK_SMALL', -6, -30),
]


def top_tex(wx, wy, px, py):
    if wx < -R + .5:                      # lit rim along the top-left edge
        return N['mint']
    cx, cy = int((wx + R) // CELL), int((wy + R) // CELL)
    tile = TILES[M.GRASS_MAP[cy][cx]]
    lx = int(round(px - (2 * ((cx * CELL - R) - (cy * CELL - R)) - 16) - _OX[0]))
    ly = int(round(py - ((cx * CELL - R) + (cy * CELL - R)) - _OY[0]))
    if 0 <= lx < 32 and 0 <= ly < 16 and tile[ly, lx] != CLEAR:
        return int(tile[ly, lx])
    return N['leaf']


_OX, _OY = [0], [0]


def draw_top(cv):
    _OX[0], _OY[0] = cv.ox, cv.oy
    cv.top(-R, R, -R, R, 0, top_tex, kind=1)


def draw_cliff(cv):
    seq_l = [0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 2, 1]
    seq_r = [1, 0, 2, 1, 2, 0, 1, 0, 2, 1, 0, 2]

    def face(seq, rmp):
        def f(u, v):
            tile = M.SKIRT[seq[(u // 25) % len(seq)]]
            ch = tile[v][u % 25] if 0 <= v < len(tile) else '.'
            return CLEAR if ch == '.' else rmp[ch]
        return f

    cv.left(-R, R, R, -DEPTH, 0, face(seq_l, M.SOIL_LIT), kind=1)
    cv.right(R, -R, R, -DEPTH, 0, face(seq_r, M.SOIL_DARK), kind=1)


def draw_rims(cv):
    """round the three outer corners, then outline the shaded (top-right) back edge"""
    for corner in ((-R, -R), (-R, R), (R, -R)):
        sx, sy = cv.proj(*corner)
        sx, sy = int(sx), int(sy)
        for dy in range(-2, 3):
            for dx in range(-CORNER_BITES - 1, CORNER_BITES + 1):
                px, py = sx + dx, sy + dy
                far = abs(dx + .5) / (CORNER_BITES + 1) + abs(dy) / 2.2
                if corner == (-R, -R) and dy >= 0 and far > .9:
                    continue
                if far > 1.0 and 0 <= px < cv.w and 0 <= py < cv.h and cv.kind[py, px] == 1:
                    pass
        # trim the 2 px tips: top corner, left corner, right corner
        if corner == (-R, -R):
            for dx in (-1, 0):
                cv.a[sy, sx + dx] = CLEAR
                cv.kind[sy, sx + dx] = 0
        elif corner == (-R, R):
            for dy in (-1, 0):
                cv.a[sy + dy, sx] = CLEAR
                cv.kind[sy + dy, sx] = 0
            cv.a[sy - 1, sx + 1] = N['mint']
        else:
            for dy in (-1, 0):
                cv.a[sy + dy, sx - 1] = CLEAR
                cv.kind[sy + dy, sx - 1] = 0
    # outline above the top-right edge: the first island pixel of each column gets a pine pixel above
    top_x, _ = cv.proj(-R, -R)
    right_x, _ = cv.proj(R, -R)
    for px in range(int(top_x), int(right_x)):
        col = cv.kind[:, px]
        ys = np.nonzero(col == 1)[0]
        if len(ys) and ys[0] > 0:
            cv.put(px, ys[0] - 1, N['pine'], kind=1)


def draw_landmarks(cv):
    for name, x, y in LANDMARKS:
        spr = getattr(M, name)
        cv.blit_at(spr, x, y, 0, spr.shape[1] // 2, spr.shape[0] - 1, kind=2)


def draw(cv):
    draw_top(cv)
    draw_cliff(cv)
    draw_rims(cv)


def decorate(cv):
    draw_landmarks(cv)
