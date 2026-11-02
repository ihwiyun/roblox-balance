"""Core helpers for the hand-authored pixel art (bunker/tools/art2).

Every shape in this folder is drawn by hand as a text grid (one character per pixel) or as an
explicit pixel list. This module only does the bookkeeping the brief allows:
  - parse grids into layers of palette indices (-1 = transparent),
  - place whole parts on a frame (offset), mirror them, recolour them (e.g. far side one step darker),
  - apply explicit per-frame pixel patches,
  - export PNG sheets / JSON and build enlarged check sheets.
It never generates a shape (no ellipses, capsules, auto-shading or auto-outlines).

Palette: Resurrect 64 (Kerrie Lake, via Lospec), read from bunker/art/resurrect-64.hex. Colours are
referred to by index 0..63; R64 gives the names used in the per-asset key tables.
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BUNKER = os.path.abspath(os.path.join(HERE, '..', '..'))
PAL_FILE = os.path.join(BUNKER, 'art', 'resurrect-64.hex')
OUT = os.path.join(BUNKER, 'samples', 'chars')
CHECK = os.path.join(OUT, 'check')


def _load_pal():
    hexes = [ln.strip() for ln in open(PAL_FILE) if ln.strip()]
    assert len(hexes) == 64, len(hexes)
    return [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in hexes], hexes


PAL, HEXES = _load_pal()

# readable names for the 64 entries (index -> name), so key tables read like a colour script
R64 = dict(
    ink=0, night=1, dusk=2, rosewood=3, khaki=4, plum=5, lilac=6, steel=7, mist=8, white=9,
    oxblood=10, brick=11, vermil=12, coral=13, crimson=14, red=15, orange=16, amber=17, gold=18,
    wine=19, rust=20, copper=21, tan=22, apricot=23, mud=24, olive=25, moss=26, lime=27, cream=28,
    pine=29, green=30, jade=31, leaf=32, pear=33, coal=34, slate=35, sage=36, fern=37, bone=38,
    deepsea=39, teal=40, aqua=41, mint=42, ice=43, navy=44, indigo=45, blue=46, sky=47, pale=48,
    grape=49, violet=50, orchid=51, lavender=52, blush=53, mauve=54, rose=55, pink=56, candy=57,
    berry=58, ruby=59, punch=60, salmon=61, peach=62, cream2=63,
)
NAME = {v: k for k, v in R64.items()}


def K(table):
    """Build a char -> palette-index table from {char: name-or-index}."""
    return {ch: (R64[v] if isinstance(v, str) else int(v)) for ch, v in table.items()}


def ramp_map(*pairs):
    """Recolour map from (src_name, dst_name) pairs (used for 'far side one step darker')."""
    return {R64[a]: R64[b] for a, b in pairs}


TRANSPARENT = '.'
ERASE = ','          # erases what is underneath when the part is placed


def _rows(text):
    rows = [r.strip() for r in text.strip('\n').split('\n')]
    return [r for r in rows if r != '']


class Part:
    """A hand-drawn grid with an anchor pixel (ax, ay)."""

    def __init__(self, text, table, ax=0, ay=0, name=''):
        rows = _rows(text)
        w = max(len(r) for r in rows)
        h = len(rows)
        arr = np.full((h, w), -1, dtype=np.int16)
        erase = np.zeros((h, w), dtype=bool)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch == TRANSPARENT:
                    continue
                if ch == ERASE:
                    erase[y, x] = True
                    continue
                if ch not in table:
                    raise KeyError(f'{name}: unknown key {ch!r} at {x},{y}')
                arr[y, x] = table[ch]
        self.a = arr
        self.erase = erase
        self.ax, self.ay = ax, ay
        self.name = name

    @property
    def w(self):
        return self.a.shape[1]

    @property
    def h(self):
        return self.a.shape[0]

    def _clone(self, a, erase, ax, ay, suffix):
        p = Part.__new__(Part)
        p.a, p.erase, p.ax, p.ay, p.name = a, erase, ax, ay, self.name + suffix
        return p

    def mirrored(self):
        return self._clone(self.a[:, ::-1].copy(), self.erase[:, ::-1].copy(), self.w - 1 - self.ax, self.ay, '~m')

    def recolored(self, cmap):
        a = self.a.copy()
        for src, dst in cmap.items():
            a[self.a == src] = dst
        return self._clone(a, self.erase.copy(), self.ax, self.ay, '~r')

    def with_anchor(self, ax, ay):
        return self._clone(self.a.copy(), self.erase.copy(), ax, ay, '')


def part(text, table, ax=0, ay=0, name=''):
    return Part(text, table, ax, ay, name)


class Frame:
    def __init__(self, w, h):
        self.a = np.full((h, w), -1, dtype=np.int16)
        self.meta = {}

    @property
    def w(self):
        return self.a.shape[1]

    @property
    def h(self):
        return self.a.shape[0]

    def put(self, p, x, y, cmap=None, mirror=False, under=False):
        """Place part p so that its anchor lands on (x, y).
        under=True only fills pixels that are still empty (drawing something 'behind')."""
        if mirror:
            p = p.mirrored()
        if cmap:
            p = p.recolored(cmap)
        ox, oy = x - p.ax, y - p.ay
        H, W = self.a.shape
        for yy in range(p.h):
            ty = oy + yy
            if ty < 0 or ty >= H:
                continue
            for xx in range(p.w):
                tx = ox + xx
                if tx < 0 or tx >= W:
                    continue
                if p.erase[yy, xx] and not under:
                    self.a[ty, tx] = -1
                v = p.a[yy, xx]
                if v >= 0 and (not under or self.a[ty, tx] < 0):
                    self.a[ty, tx] = v
        return self

    def px(self, pts, table=None):
        """Explicit pixel patch: pts = [(x, y, key), ...]; key '.' clears."""
        for x, y, k in pts:
            if k == TRANSPARENT:
                self.a[y, x] = -1
            else:
                self.a[y, x] = table[k] if table is not None else k
        return self

    def patch(self, text, table, x0, y0):
        """Explicit pixel patch given as a small grid; '.' leaves the pixel, ',' clears it."""
        for yy, r in enumerate(_rows(text)):
            for xx, ch in enumerate(r):
                if ch == TRANSPARENT:
                    continue
                ty, tx = y0 + yy, x0 + xx
                if not (0 <= ty < self.h and 0 <= tx < self.w):
                    continue
                self.a[ty, tx] = -1 if ch == ERASE else table[ch]
        return self

    def copy(self):
        f = Frame(self.w, self.h)
        f.a = self.a.copy()
        f.meta = json.loads(json.dumps(self.meta))
        return f

    def shifted(self, dx, dy):
        f = Frame(self.w, self.h)
        H, W = self.a.shape
        src = self.a
        ys = slice(max(0, -dy), min(H, H - dy))
        yd = slice(max(0, dy), min(H, H + dy))
        xs = slice(max(0, -dx), min(W, W - dx))
        xd = slice(max(0, dx), min(W, W + dx))
        f.a[yd, xd] = src[ys, xs]
        f.meta = json.loads(json.dumps(self.meta))
        return f

    def recolored(self, cmap):
        f = self.copy()
        for src, dst in cmap.items():
            f.a[self.a == src] = dst
        return f

    def rgba(self):
        return to_rgba(self.a)


def frame_from(text, table, meta=None):
    p = Part(text, table)
    f = Frame(p.w, p.h)
    f.a = p.a.copy()
    f.meta = dict(meta or {})
    return f


_LUT = np.zeros((65, 4), dtype=np.uint8)
for _i, _c in enumerate(PAL):
    _LUT[_i] = (*_c, 255)
_LUT[64] = (0, 0, 0, 0)


def to_rgba(a):
    idx = np.where(a < 0, 64, a)
    return Image.fromarray(_LUT[idx], 'RGBA')


def flash_frame(f, color=R64['white'], edge=R64['ink']):
    """Hit-flash: the figure turns one colour; only its outer silhouette edge stays dark so it reads.
    (Recolour only: a pixel keeps the edge colour when a 4-neighbour is empty.)"""
    g = f.copy()
    a = f.a
    H, W = a.shape
    for y in range(H):
        for x in range(W):
            if a[y, x] < 0:
                continue
            outer = any(not (0 <= x + dx < W and 0 <= y + dy < H) or a[y + dy, x + dx] < 0
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            g.a[y, x] = edge if outer else color
    return g


class Anim:
    """One animation of one view: frames + fps + loop + notes (what was checked) + extra data."""

    def __init__(self, name, frames, fps=8, loop=True, notes='', **extra):
        self.name, self.frames, self.fps, self.loop, self.notes = name, frames, fps, loop, notes
        self.extra = extra


def sheet(frames, cols=None, pad=0):
    """Pack equal-size frames into a sheet (row-major). Returns (Image, rects)."""
    n = len(frames)
    cols = cols or n
    w, h = frames[0].w, frames[0].h
    rows = (n + cols - 1) // cols
    img = Image.new('RGBA', (cols * (w + pad), rows * (h + pad)), (0, 0, 0, 0))
    rects = []
    for i, f in enumerate(frames):
        x, y = (i % cols) * (w + pad), (i // cols) * (h + pad)
        img.paste(f.rgba(), (x, y))
        rects.append([x, y, w, h])
    return img, rects


def pack_anims(anims_by_view, pad=1):
    """anims_by_view: list of (key, Anim). One row per Anim. Returns (Image, {key: [rects]})."""
    w = max(f.w for _, a in anims_by_view for f in a.frames)
    h = max(f.h for _, a in anims_by_view for f in a.frames)
    cols = max(len(a.frames) for _, a in anims_by_view)
    img = Image.new('RGBA', (cols * (w + pad), len(anims_by_view) * (h + pad)), (0, 0, 0, 0))
    out = {}
    for r, (key, a) in enumerate(anims_by_view):
        rects = []
        for c, f in enumerate(a.frames):
            x, y = c * (w + pad), r * (h + pad)
            img.paste(f.rgba(), (x, y))
            rects.append([x, y, f.w, f.h])
        out[key] = rects
    return img, out


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return path


def used_colors(arrs):
    s = set()
    for a in arrs:
        s.update(int(v) for v in np.unique(a) if v >= 0)
    return sorted(s)


def check_palette(img_path):
    """Verify a PNG only uses Resurrect 64 colours (or full transparency)."""
    im = np.array(Image.open(img_path).convert('RGBA'))
    op = im[..., 3] > 0
    if (im[..., 3][op] != 255).any():
        return False, 'semi-transparent pixels'
    cols = {tuple(int(v) for v in c) for c in im[..., :3][op].reshape(-1, 3)}
    bad = [c for c in cols if c not in set(PAL)]
    return (not bad), bad


def orphans(a):
    """Opaque pixels with no opaque 4-neighbour (stray single pixels) -> list of (x, y)."""
    H, W = a.shape
    out = []
    for y in range(H):
        for x in range(W):
            if a[y, x] < 0:
                continue
            n = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H and a[yy, xx] >= 0:
                    n += 1
            if n == 0:
                out.append((x, y))
    return out


def write_json(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(',', ':'))
    return path
