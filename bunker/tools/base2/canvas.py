"""Palette-indexed canvas with exact 2:1 iso faces.

World: x runs to screen right-down, y to screen left-down, z up; one x/y step is 2 px across and
1 px down, one z unit is 1 px up:   sx = ox + 2(x - y),   sy = oy + (x + y) - z.
A pixel belongs to a face when its CENTRE projects inside it, so neighbouring faces share edges
without gaps or double pixels, and every face edge is the clean 2-1 stair.

Nothing here invents texture. Faces are filled by callbacks that read hand-drawn tiles
(materials.py), and sprites are hand-drawn grids (props.py) that are placed, optionally in face
space (they then follow the face's 2-1 slant, the way an iso artist shears a flat drawing).
"""
import math

import numpy as np

from pal import CLEAR, COLORS


def grid(rows, legend):
    """hand-drawn rows of letters -> index array; '.' and ' ' are empty"""
    h, w = len(rows), max(len(r) for r in rows)
    a = np.full((h, w), CLEAR, np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                a[j, i] = legend[ch]
    return a


def flip(a):
    return a[:, ::-1].copy()


class Canvas:
    def __init__(self, w, h, ox, oy):
        self.w, self.h, self.ox, self.oy = w, h, ox, oy
        self.a = np.full((h, w), CLEAR, np.uint8)
        self.kind = np.zeros((h, w), np.uint8)      # 0 nothing, 1 ground, 2 standing object

    # ------------------------------------------------------------------ basics
    def proj(self, x, y, z=0):
        return self.ox + 2 * (x - y), self.oy + (x + y) - z

    def put(self, px, py, c, kind=2):
        if c == CLEAR or not (0 <= px < self.w and 0 <= py < self.h):
            return
        self.a[py, px] = c
        self.kind[py, px] = kind

    def get(self, px, py):
        if 0 <= px < self.w and 0 <= py < self.h:
            return self.a[py, px]
        return CLEAR

    def blit(self, spr, px, py, kind=2, mask=None):
        """sprite top-left at (px, py); mask(px, py) -> False skips a pixel"""
        h, w = spr.shape
        for j in range(h):
            for i in range(w):
                c = spr[j, i]
                if c != CLEAR and (mask is None or mask(px + i, py + j)):
                    self.put(px + i, py + j, int(c), kind)

    def blit_at(self, spr, x, y, z, ax, ay, kind=2, mirror=False):
        """sprite whose anchor pixel (ax, ay) sits on world point (x, y, z)"""
        if mirror:
            spr, ax = flip(spr), spr.shape[1] - 1 - ax
        sx, sy = self.proj(x, y, z)
        self.blit(spr, int(math.floor(sx)) - ax, int(math.floor(sy)) - ay, kind)

    # ------------------------------------------------------------------ faces
    def _box(self, pts):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return (max(0, int(math.floor(min(xs))) - 1), min(self.w - 1, int(math.ceil(max(xs))) + 1),
                max(0, int(math.floor(min(ys))) - 1), min(self.h - 1, int(math.ceil(max(ys))) + 1))

    def top(self, x0, x1, y0, y1, z, tex, kind=2):
        """horizontal face at height z; tex(wx, wy, px, py) -> index or CLEAR"""
        pts = [self.proj(x, y, z) for x in (x0, x1) for y in (y0, y1)]
        ax, bx, ay, by = self._box(pts)
        for py in range(ay, by + 1):
            for px in range(ax, bx + 1):
                d = (px + .5 - self.ox) / 2
                s = py + .5 - self.oy + z
                wx, wy = (s + d) / 2, (s - d) / 2
                if x0 <= wx < x1 and y0 <= wy < y1:
                    self.put(px, py, tex(wx, wy, px, py), kind)

    def left(self, x0, x1, y, z0, z1, tex, kind=2):
        """front-left wall (plane y, facing screen lower-left); tex(u, v): u px from its left end,
        v rows down from its top edge (both whole numbers, the 2-1 slant already removed)"""
        pts = [self.proj(x, y, z) for x in (x0, x1) for z in (z0, z1)]
        ax, bx, ay, by = self._box(pts)
        left_px = self.ox + 2 * (x0 - y)
        for py in range(ay, by + 1):
            for px in range(ax, bx + 1):
                wx = (px + .5 - self.ox) / 2 + y
                wz = self.oy + wx + y - (py + .5)
                if x0 <= wx < x1 and z0 <= wz < z1:
                    self.put(px, py, tex(int(round(px - left_px)), int(math.floor(z1 - wz))), kind)

    def right(self, x, y0, y1, z0, z1, tex, kind=2):
        """front-right wall (plane x, facing screen lower-right); u from its left end (y = y1)"""
        pts = [self.proj(x, y, z) for y in (y0, y1) for z in (z0, z1)]
        ax, bx, ay, by = self._box(pts)
        left_px = self.ox + 2 * (x - y1)
        for py in range(ay, by + 1):
            for px in range(ax, bx + 1):
                wy = x - (px + .5 - self.ox) / 2
                wz = self.oy + x + wy - (py + .5)
                if y0 <= wy < y1 and z0 <= wz < z1:
                    self.put(px, py, tex(int(round(px - left_px)), int(math.floor(z1 - wz))), kind)

    # face space -> screen, for sprites that must follow a wall's slant
    def left_uv(self, x0, y, z1, u, v):
        px = int(round(self.ox + 2 * (x0 - y))) + u
        wx = (px + .5 - self.ox) / 2 + y
        t = z1 - self.oy - wx - y + .5
        return px, v - int(math.floor(t))

    def right_uv(self, x, y1, z1, u, v):
        px = int(round(self.ox + 2 * (x - y1))) + u
        wy = x - (px + .5 - self.ox) / 2
        t = z1 - self.oy - x - wy + .5
        return px, v - int(math.floor(t))

    def on_left(self, spr, x0, y, z1, u, v, kind=2, clip=None):
        """paint a flat-drawn sprite onto the plane y with its top-left at face (u, v)"""
        h, w = spr.shape
        for i in range(w):
            for j in range(h):
                c = spr[j, i]
                if c == CLEAR:
                    continue
                px, py = self.left_uv(x0, y, z1, u + i, v + j)
                if clip is None or clip(px, py):
                    self.put(px, py, int(c), kind)

    def on_right(self, spr, x, y1, z1, u, v, kind=2, clip=None):
        h, w = spr.shape
        for i in range(w):
            for j in range(h):
                c = spr[j, i]
                if c == CLEAR:
                    continue
                px, py = self.right_uv(x, y1, z1, u + i, v + j)
                if clip is None or clip(px, py):
                    self.put(px, py, int(c), kind)

    # ------------------------------------------------------------------ ground helpers
    def ground_inside(self, poly, px, py):
        """is the pixel centre inside a world-space polygon on the ground (z = 0)?"""
        d = (px + .5 - self.ox) / 2
        s = py + .5 - self.oy
        return point_in_poly((s + d) / 2, (s - d) / 2, poly)

    def shade(self, poly, remap, z=0, only=(1,)):
        """hard cast shadow: remap the colours of ground pixels inside a world polygon"""
        pts = [self.proj(x, y, z) for x, y in poly]
        ax, bx, ay, by = self._box(pts)
        for py in range(ay, by + 1):
            for px in range(ax, bx + 1):
                if self.kind[py, px] in only and self.ground_inside(poly, px, py + z):
                    c = self.a[py, px]
                    self.a[py, px] = remap.get(int(c), c)

    def rgba(self, scale=1, bg=None):
        from PIL import Image
        h, w = self.a.shape
        lut = np.zeros((256, 4), np.uint8)
        for i, col in enumerate(COLORS):
            lut[i] = (*col, 255)
        if bg is not None:
            lut[CLEAR] = (*bg, 255)
        img = Image.fromarray(lut[self.a], 'RGBA')
        return img.resize((w * scale, h * scale), Image.NEAREST) if scale != 1 else img


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            t = (y - y1) / (y2 - y1)
            if x < x1 + t * (x2 - x1):
                inside = not inside
    return inside
