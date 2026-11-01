#!/usr/bin/env python3
"""Set B zombie mutants for the bunker game: spitter, screamer, leaper, burrower, regenerator, giant, boss.

Run from bunker/tools:  python3 zombiesB.py      -> writes ../art/zombiesB.js, previews go to /tmp/claude-0/zombiesB/

How a frame is made
- A pose is a set of 3D joints in body space: f = forward, n = towards the camera-near side, z = up (1 unit of z is one
  screen pixel). The game's camera is the 2:1 3/4 view from 30 degrees above:  screen x = f - n,  screen y = f/2 + n/2 - z
  for F (facing down-right); B (facing up-left, seen from behind) is the same with f negated. The camera-near side is at
  the screen lower left in both views; the runtime mirrors F for down-left and B for up-right.
- Torso, head and other big masses are sculpted from overlapping ellipsoids and boxes (ribcage, pecs, deltoids, belly,
  shoulder blades, skull, jaw ...) and ray-cast with that camera, so F, B, leaning, falling and leaping stay consistent.
  Material maps on the sculpt give torn clothes, ribs, plates, wounds.
- Arms and legs are tapered brush strokes with anatomical width profiles (deltoid, forearm, calf bulges, knobbly knees and
  elbows); hands, claws, toes, teeth, hair and drool are drawn pixel by pixel at projected points.
- Light comes from the upper left; every material has a 5-tone ramp whose shadows drift to violet and lights to warm.
- Everything is z-buffered; a dark seam separates a part from one in front of it; then cleanup and a 1 px outline.
"""
import colorsys
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.path.join(HERE, '..', 'art', 'zombiesB.js')
PREV = '/tmp/claude-0/zombiesB'
INK = (30, 24, 26)
GRASS = (82, 118, 54)
DIRT = (152, 120, 84)

# ============================================================== small maths
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def vadd(a, b): return tuple(x + y for x, y in zip(a, b))
def vsub(a, b): return tuple(x - y for x, y in zip(a, b))
def vmul(a, k): return tuple(x * k for x in a)
def vlen(a): return math.sqrt(sum(x * x for x in a))
def vnorm(a):
    L = vlen(a) or 1.0
    return tuple(x / L for x in a)
def lerp(a, b, t): return a + (b - a) * t
def vlerp(a, b, t): return tuple(lerp(x, y, t) for x, y in zip(a, b))
def mmul(A, B): return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))
def mvec(A, v): return tuple(A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2] for i in range(3))
def mT(A): return tuple(tuple(A[j][i] for j in range(3)) for i in range(3))
def minv(A):
    a, b, c = A[0]; d, e, f = A[1]; g, h, i = A[2]
    det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    return (((e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det),
            ((f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det),
            ((d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det))
I3 = ((1, 0, 0), (0, 1, 0), (0, 0, 1))
def diag(r): return ((r[0], 0, 0), (0, r[1], 0), (0, 0, r[2]))
def Rn(deg):   # lean: positive tips the top forward (+f)
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return ((c, 0, s), (0, 1, 0), (-s, 0, c))
def Rf(deg):   # tilt: positive tips the top towards the near side (+n)
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return ((1, 0, 0), (0, c, s), (0, -s, c))
def Rz(deg):   # twist: positive turns the front towards the near side
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return ((c, -s, 0), (s, c, 0), (0, 0, 1))
def Rot(lean=0.0, tilt=0.0, twist=0.0):
    return mmul(Rz(twist), mmul(Rf(tilt), Rn(lean)))

def MV(view):
    sf = 1 if view == 'F' else -1
    return ((sf, -1.0, 0.0), (.5 * sf, .5, -1.0), (.87 * sf, .87, .87))
MVI = {v: minv(MV(v)) for v in 'FB'}

def proj(v, view):
    M = MV(view)
    return (M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2])

def dep(v, view):
    M = MV(view)
    return M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]

def hash01(*k):
    h = 2166136261
    for v in k:
        h = ((h ^ (int(v) & 0xffffffff)) * 16777619) & 0xffffffff
    h ^= h >> 13
    h = (h * 1274126177) & 0xffffffff
    return (h & 0xffff) / 65535.0

# ============================================================== colour ramps
def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def clamp255(c): return tuple(max(0, min(255, int(round(v)))) for v in c)

def ramp(mid, cool=(52, 40, 92), warm=(255, 230, 150), k=1.0, spread=1.0):
    """5 tones: 0 deep shadow, 1 shadow, 2 mid, 3 light, 4 highlight; shadows drift to violet, lights to warm yellow"""
    deep = mix(tuple(v * (1 - .52 * spread) for v in mid), cool, .40 * k)
    sh = mix(tuple(v * (1 - .26 * spread) for v in mid), cool, .22 * k)
    lt = mix(tuple(min(255, v * (1 + .16 * spread)) for v in mid), warm, .17 * k)
    hi = mix(tuple(min(255, v * (1 + .32 * spread)) for v in mid), warm, .36 * k)
    return [clamp255(deep), clamp255(sh), clamp255(mid), clamp255(lt), clamp255(hi)]

def flat(c, n=5): return [clamp255(c)] * n

# ============================================================== canvas
class Canvas:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.px = {}    # (x, y) -> [key, depth, part, root]
        s.fx = {}    # effect pixels drawn after the outline: (x, y) -> key
        s.parts = {}

    def put(s, x, y, key, depth, part, root=False, force=False):
        if not (0 <= x < s.w and 0 <= y < s.h):
            return False
        cur = s.px.get((x, y))
        if force or cur is None or depth >= cur[1]:
            s.px[(x, y)] = [key, depth, part, root]
            return True
        return False

# ============================================================== lighting
LIGHT = vnorm((-.40, -.55, .73))
TONE_T = (.86, .66, .34, .02)

def tone_of(n, bias=0.0):
    lum = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] + bias
    if lum >= TONE_T[0]: return 4
    if lum >= TONE_T[1]: return 3
    if lum >= TONE_T[2]: return 2
    if lum >= TONE_T[3]: return 1
    return 0

# ============================================================== volumes
class Blob:
    """ellipsoid ('e') or box ('b') in part-local coordinates. mat: material name or fn(local_point) -> name.
    tex: fn(local_point, (mat, tone)) -> key or None. groove: draw a darker seam where another blob overlaps it."""
    __slots__ = ('c', 'r', 'mat', 'rot', 'kind', 'groove', 'tex', 'bias', 'name')
    def __init__(s, c, r, mat, rot=None, kind='e', groove=True, tex=None, bias=0.0, name=''):
        s.c, s.r, s.mat, s.rot, s.kind, s.groove, s.tex, s.bias, s.name = c, r, mat, rot or I3, kind, groove, tex, bias, name

def surf(b, n, z, back=False):
    """point on the front (or back) surface of an axis-aligned ellipsoid blob at given n, z"""
    q = 1 - ((n - b.c[1]) / b.r[1]) ** 2 - ((z - b.c[2]) / b.r[2]) ** 2
    f = b.r[0] * math.sqrt(max(0.0, q))
    return (b.c[0] - f if back else b.c[0] + f, n, z)

def snap_T(T, view, A):
    """move T so its projection lands on a whole pixel (keeps parts from wobbling between frames)"""
    M = MV(view)
    s = mvec(M, T)
    sx, sy = round(s[0] + A[0]) - A[0], round(s[1] + A[1]) - A[1]
    return mvec(MVI[view], (sx, sy, s[2]))

def render_volume(cv, blobs, T, R, view, part, A, depth_bias=0.0, smooth=True, groove=True, root=False):
    """ray-cast blobs (local -> body by R, T) with the view camera; returns {pixel: (depth, blob, local point, key)}"""
    M = MV(view)
    Mi = MVI[view]
    Rt = mT(R)
    prep = []
    for b in blobs:
        E = mmul(M, mmul(R, mmul(b.rot, diag(b.r))))
        Q = minv(E)
        cb = vadd(T, mvec(R, b.c))
        sc = mvec(M, cb)
        sc = (sc[0] + A[0], sc[1] + A[1], sc[2])
        ex = math.sqrt(E[0][0] ** 2 + E[0][1] ** 2 + E[0][2] ** 2) * (1.75 if b.kind == 'b' else 1.0) + 1
        ey = math.sqrt(E[1][0] ** 2 + E[1][1] ** 2 + E[1][2] ** 2) * (1.75 if b.kind == 'b' else 1.0) + 1
        w = (Q[0][2], Q[1][2], Q[2][2])
        prep.append((b, Q, sc, ex, ey, w, dot(w, w)))
    if not prep:
        return {}
    x0 = max(0, int(math.floor(min(p[2][0] - p[3] for p in prep))))
    x1 = min(cv.w - 1, int(math.ceil(max(p[2][0] + p[3] for p in prep))))
    y0 = max(0, int(math.floor(min(p[2][1] - p[4] for p in prep))))
    y1 = min(cv.h - 1, int(math.ceil(max(p[2][1] + p[4] for p in prep))))
    res = {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            best = None
            for (b, Q, sc, ex, ey, w, ww) in prep:
                dx, dy = x - sc[0], y - sc[1]
                if dx > ex or -dx > ex or dy > ey or -dy > ey:
                    continue
                a = (Q[0][0] * dx + Q[0][1] * dy, Q[1][0] * dx + Q[1][1] * dy, Q[2][0] * dx + Q[2][1] * dy)
                if b.kind == 'e':
                    aw = dot(a, w)
                    disc = aw * aw - ww * (dot(a, a) - 1)
                    if disc < 0:
                        continue
                    tau = (-aw + math.sqrt(disc)) / ww
                    u = (a[0] + w[0] * tau, a[1] + w[1] * tau, a[2] + w[2] * tau)
                    nrm = (Q[0][0] * u[0] + Q[1][0] * u[1] + Q[2][0] * u[2],
                           Q[0][1] * u[0] + Q[1][1] * u[1] + Q[2][1] * u[2],
                           Q[0][2] * u[0] + Q[1][2] * u[1] + Q[2][2] * u[2])
                else:
                    lo, hi, face, ok = -1e9, 1e9, 0, True
                    for k in range(3):
                        if abs(w[k]) < 1e-9:
                            if abs(a[k]) > 1:
                                ok = False
                                break
                            continue
                        t1, t2 = (-1 - a[k]) / w[k], (1 - a[k]) / w[k]
                        if t1 > t2:
                            t1, t2 = t2, t1
                        if t1 > lo:
                            lo = t1
                        if t2 < hi:
                            hi, face = t2, k
                    if not ok or lo > hi:
                        continue
                    tau = hi
                    u = (a[0] + w[0] * tau, a[1] + w[1] * tau, a[2] + w[2] * tau)
                    e = [0.0, 0.0, 0.0]
                    e[face] = 1.0 if u[face] > 0 else -1.0
                    nrm = (Q[face][0] * e[face], Q[face][1] * e[face], Q[face][2] * e[face])
                d = sc[2] + tau
                if best is None or d > best[0]:
                    best = (d, b, nrm)
            if best:
                d, b, nrm = best
                body = mvec(Mi, (x - A[0], y - A[1], d))
                loc = mvec(Rt, vsub(body, T))
                n = vnorm(nrm)
                tone = tone_of(n, b.bias)
                mat = b.mat(loc) if callable(b.mat) else b.mat
                res[(x, y)] = [d, b, loc, (mat, tone), n]
    # seams where one blob overlaps another (muscle separations, plate edges)
    if groove:
        dark = []
        for p, v in res.items():
            if not v[1].groove:
                continue
            for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)):
                o = res.get(q)
                if o and o[1] is not v[1] and o[1].groove and o[0] > v[0] + .25 and o[3][0] == v[3][0]:
                    dark.append(p)
                    break
        for p in dark:
            m, t = res[p][3]
            g = res[p][1].groove
            res[p][3] = (m, max(0, t - (g if isinstance(g, int) and not isinstance(g, bool) else 1)))
    # texture after seams so painted details stay crisp
    for p, v in res.items():
        if v[1].tex:
            k = v[1].tex(v[2], v[3])
            if k:
                v[3] = k
    if smooth:
        smooth_tones(res)
    for (x, y), v in res.items():
        if v[3] is None:
            continue
        cv.put(x, y, v[3], v[0] + depth_bias, part, root=root)
    return res

def smooth_tones(res):
    """drop single-pixel tone speckles inside one material (keeps the clusters chunky)"""
    change = []
    for p, v in res.items():
        k = v[3]
        if not isinstance(k, tuple):
            continue
        nb = [res[q][3] for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)) if q in res]
        if len(nb) < 3:
            continue
        same = [q for q in nb if isinstance(q, tuple) and q[0] == k[0]]
        if len(same) < 3 or any(q[1] == k[1] for q in same):
            continue
        tones = [q[1] for q in same]
        best = max(set(tones), key=tones.count)
        if tones.count(best) >= 2 and abs(best - k[1]) == 1:
            change.append((p, (k[0], best)))
    for p, k in change:
        res[p][3] = k

# ============================================================== strokes (limbs, claws, hair ...)
def brush(w):
    pts = []
    r2 = (w / 2) ** 2 - (.3 if w % 2 else 0)
    R = w // 2
    if w % 2:
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                if dx * dx + dy * dy <= r2 or w == 1:
                    pts.append((dx, dy))
    else:
        for dy in range(-R, R):
            for dx in range(-R, R):
                if (dx + .5) ** 2 + (dy + .5) ** 2 <= r2:
                    pts.append((dx, dy))
    return pts
BRUSH = {w: brush(w) for w in range(1, 16)}

def interp(prof, t):
    if not isinstance(prof, (list, tuple)):
        return prof
    if t <= prof[0][0]:
        return prof[0][1]
    for (t0, v0), (t1, v1) in zip(prof, prof[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * (t - t0) / ((t1 - t0) or 1)
    return prof[-1][1]

def stroke(cv, A, B, wprof, dA, dB, part, mat, side=None, bulge=(), detail=None, root_t=0.0, bias=0.0, rad=1.0,
           tone_shift=0, flatness=1.0):
    """tapered limb from A to B (pixel-centre coords). wprof: width or [(t, width)]. side: screen unit vector of the
    limb's back side (calf, triceps). bulge: [(t0, t1, extra_width, shift_towards_side)] adds muscle masses.
    detail(t, s, side_dist, key) -> key: paint wraps, tears, plates. Returns the pixels it hit."""
    dx, dy = B[0] - A[0], B[1] - A[1]
    L = math.hypot(dx, dy)
    ux, uy = (dx / L, dy / L) if L > 1e-6 else (0.0, 1.0)
    px_, py_ = -uy, ux
    hits = {}
    n = max(2, int(L * 4) + 1)
    for (t0, t1, ew, sh) in [(0.0, 1.0, 0.0, 0.0)] + list(bulge):
        for k in range(n + 1):
            t = k / n
            if t < t0 - 1e-9 or t > t1 + 1e-9:
                continue
            env = math.sin(math.pi * (t - t0) / ((t1 - t0) or 1)) if (t1 - t0) < 1 else 1.0
            w = interp(wprof, t) + ew * env
            wi = max(1, int(round(w)))
            cx, cy = A[0] + dx * t, A[1] + dy * t
            if side and sh:
                cx += side[0] * sh * env
                cy += side[1] * sh * env
            if wi % 2:
                bx, by = int(round(cx)), int(round(cy))
                ccx, ccy = float(bx), float(by)
            else:
                bx, by = int(math.floor(cx + .5)), int(math.floor(cy + .5))
                ccx, ccy = bx - .5, by - .5
            for (ox, oy) in BRUSH[wi]:
                x, y = bx + ox, by + oy
                rx, ry = x - ccx, y - ccy
                d2 = rx * rx + ry * ry
                old = hits.get((x, y))
                if old is None or d2 < old[0]:
                    s = (rx * px_ + ry * py_) / max(.75, wi / 2)
                    hits[(x, y)] = (d2, t, max(-1.0, min(1.0, s)), wi, (rx, ry))
    out = {}
    for (x, y), (d2, t, s, wi, rr) in hits.items():
        # cylinder-ish normal across the stroke, a bit of the along-axis slope so ends round off
        nx, ny = s * px_ * flatness, s * py_ * flatness
        if wi == 1:
            nx, ny = nx * .3, ny * .3
        nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
        tone = max(0, min(4, tone_of((nx, ny, nz), bias) + tone_shift))
        ss = 0.0
        if side:
            ss = (x - (A[0] + dx * t)) * side[0] + (y - (A[1] + dy * t)) * side[1]
        key = (mat, tone) if isinstance(mat, str) else mat(t, s, ss, tone)
        if detail:
            k2 = detail(t, s, ss, key)
            if k2 is not None:
                key = k2
        if key is None or key == 'skip':
            continue
        depth = dA + (dB - dA) * t + rad * math.sqrt(max(0.0, 1 - s * s))
        cv.put(x, y, key, depth, part, root=(t < root_t))
        out[(x, y)] = (t, s)
    return out

def dot_px(cv, p, key, depth, part, w=1, root=False):
    if w == 1:
        return cv.put(int(round(p[0])), int(round(p[1])), key, depth, part, root=root)
    for (ox, oy) in BRUSH[w]:
        cv.put(int(math.floor(p[0] + .5)) + ox, int(math.floor(p[1] + .5)) + oy, key, depth, part, root=root)

def line_px(cv, A, B, key, depth, part, dB=None, root=False):
    n = max(1, int(math.ceil(max(abs(B[0] - A[0]), abs(B[1] - A[1])))))
    pts = []
    for k in range(n + 1):
        t = k / n
        x, y = int(round(lerp(A[0], B[0], t))), int(round(lerp(A[1], B[1], t)))
        if pts and pts[-1] == (x, y):
            continue
        pts.append((x, y))
        cv.put(x, y, key(t) if callable(key) else key, depth if dB is None else lerp(depth, dB, t), part, root=root)
    return pts

def ik3(root, end, l1, l2, bend):
    d = vsub(end, root)
    D = vlen(d)
    if D < 1e-6:
        return vadd(root, vmul(vnorm(bend), l1))
    u = vmul(d, 1 / D)
    if D >= l1 + l2 - 1e-6:
        return vadd(root, vmul(u, D * l1 / (l1 + l2)))
    a = (l1 * l1 - l2 * l2 + D * D) / (2 * D)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    b = vsub(bend, vmul(u, dot(bend, u)))
    if vlen(b) < 1e-6:
        b = (0, 0, 1)
    return vadd(vadd(root, vmul(u, a)), vmul(vnorm(b), h))

# ============================================================== post passes
def nb4(x, y): return ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))

def cleanup(cv, fine=()):
    px = cv.px
    for _ in range(2):
        drop = [p for p, v in px.items() if v[2] not in fine and not any(q in px for q in nb4(*p))]
        for p in drop:
            del px[p]
    for y in range(cv.h):
        for x in range(cv.w):
            if (x, y) in px:
                continue
            nb = [q for q in nb4(x, y) if q in px]
            if len(nb) == 4 or (len(nb) == 3 and False):
                best = max((px[q] for q in nb), key=lambda v: v[1])
                px[(x, y)] = list(best)

def seams(cv, thr=1.2, join=(), soft=()):
    """dark seam on a part wherever a different part in front of it borders it"""
    px = cv.px
    marks = []
    for (x, y), v in px.items():
        for q in nb4(x, y):
            w = px.get(q)
            if w is None or w[2] == v[2]:
                continue
            if (w[2], v[2]) in join or (v[2], w[2]) in join:
                continue
            if w[1] > v[1] + thr and not (w[3] and v[2] in ('torso', 'pelvis')):
                marks.append((x, y, v))
                break
    for x, y, v in marks:
        k = v[0]
        if v[2] in soft and isinstance(k, tuple):
            px[(x, y)] = [(k[0], 0), v[1], v[2], v[3]]
        else:
            px[(x, y)] = ['o', v[1], v[2], v[3]]

def outline(cv, skip=()):
    px = cv.px
    add = set()
    for (x, y), v in px.items():
        if v[2] in skip:
            continue
        for q in nb4(x, y):
            if q not in px and 0 <= q[0] < cv.w and 0 <= q[1] < cv.h:
                add.add(q)
    for q in add:
        px[q] = ['o', -99, 'outline', False]

def rows_of(cv, letter):
    out = []
    for y in range(cv.h):
        r = []
        for x in range(cv.w):
            k = cv.fx.get((x, y))
            if k is None:
                v = cv.px.get((x, y))
                k = v[0] if v else None
            r.append('.' if k is None else letter[k])
        out.append(''.join(r))
    return out

# ============================================================== rig
FWD = (1.0, 0.0, 0.0)

def side_vec(view, v3):
    """screen direction of a 3D body direction"""
    p = proj(v3, view)
    L = math.hypot(*p) or 1.0
    return (p[0] / L, p[1] / L)

def ik2(root, end, l1, l2, bend):
    dx, dy = end[0] - root[0], end[1] - root[1]
    d = math.hypot(dx, dy)
    if d < 1e-6:
        return (root[0] + bend[0] * l1, root[1] + bend[1] * l1)
    ux, uy = dx / d, dy / d
    if d >= l1 + l2:
        return (root[0] + ux * d * l1 / (l1 + l2), root[1] + uy * d * l1 / (l1 + l2))
    d = max(d, abs(l1 - l2) + 1e-3)
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    px_, py_ = -uy, ux
    if px_ * bend[0] + py_ * bend[1] < 0:
        px_, py_ = -px_, -py_
    return (root[0] + ux * a + px_ * h, root[1] + uy * a + py_ * h)

def dist2(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

class Mutant:
    """one zombie type: hand-painted torso and head bitmaps per view (self.T, self.H, legend self.L) placed by a 3D
    pose, limbs as strokes. Subclasses set materials/bitmaps in setup() and give pose(), arm_spec(), leg_spec(),
    hand(), foot(), extras()."""
    name = '?'
    w = h = 32
    ax, ay = 15, 28
    fine = ('claw', 'hair', 'fx', 'drool', 'spike', 'tooth')
    soft = ()
    join = ()
    ANIMS = {}           # name -> (frames, fps, loop)
    sh_dz, hp_dz, hip_w = 2.6, 1.3, 1.5
    hdz = {'F': 1.6, 'B': 1.0}
    grad = .25

    def __init__(self):
        self.mats = {}
        self.L = {'o': 'o'}
        self.T, self.H = {}, {}
        self.setup()

    def legend(self, spec):
        """spec: {material: 'letters for tones 0..4'} -> fills self.L"""
        for m, letters in spec.items():
            for t, ch in enumerate(letters):
                if ch != ' ':
                    self.L[ch] = (m, t)

    def S(self, body, view):
        p = proj(body, view)
        return (self.ax + p[0], self.ay + p[1])

    def D(self, body, view):
        return dep(body, view)

    def frame(self, anim, i, view):
        cv = Canvas(self.w, self.h)
        P = self.pose(anim, i)
        P['_anim'], P['_i'], P['_view'] = anim, i, view
        meta = self.draw(cv, P, view) or {}
        self.post(cv, P, view)
        self.after(cv, P, view, meta)
        return cv, meta

    def post(self, cv, P, view):
        cleanup(cv, self.fine)
        seams(cv, thr=.3, join=self.join, soft=self.soft)
        outline(cv, skip=('fx',))

    def after(self, cv, P, view, meta):
        pass

    def tdeg(self, P, view):
        sf = 1 if view == 'F' else -1
        return P.get('lean', 0) * sf + P.get('roll', 0)

    def draw(self, cv, P, view):
        meta = {}
        sf = 1 if view == 'F' else -1
        pel3 = P['pel']
        p2 = self.S(pel3, view)
        hip2 = (int(round(p2[0])), int(round(p2[1])))
        Dt = self.D(pel3, view)
        tdeg = self.tdeg(P, view)
        tb = self.T[P.get('torso', 'base')][view]
        tm = stamp(cv, tb, self.L, hip2, Dt, 'torso', 'hip', tdeg, grad=self.grad, remap=P.get('remap'))
        J = {k: tm(k) for k in tb.a}
        J['_tm'], J['_Dt'], J['_tdeg'] = tm, Dt, tdeg
        if P.get('head', 'base') is not None:
            hb = self.H[P.get('head', 'base')][view]
            ho = proj(P.get('hoff', (0, 0, 0)), view)
            hdeg = tdeg + P.get('hlean', 0) * sf + P.get('hroll', 0)
            hpos = (int(round(J['neck'][0] + ho[0])), int(round(J['neck'][1] + ho[1])))
            hz = Dt + P.get('hdz', self.hdz[view])
            hm = stamp(cv, hb, self.L, hpos, hz, 'head', 'neck', hdeg, remap=P.get('remap'))
            J['_hm'], J['_hz'] = hm, hz
            if 'top' in hb.a:
                t = hm('top')
                meta['head'] = [int(round(t[0])), int(round(t[1]))]
        for side in ('N', 'F'):
            if side in P.get('arms', {}):
                self.arm(cv, P, view, side, J, Dt)
            if side in P.get('legs', {}):
                self.leg(cv, P, view, side, J, Dt)
        self.extras(cv, P, view, J, meta)
        return meta

    # --------------------------------------------------------- limbs
    def arm(self, cv, P, view, side, J, Dt):
        spec = self.arm_spec(P, side)
        a = P['arms'][side]
        sgn = 1 if side == 'N' else -1
        sh2 = J['sh' + side]
        shd = Dt + self.sh_dz * sgn + a.get('dz', 0)
        ha = a['ha']
        el = a['el'] if 'el' in a else ik3((0, 0, 0), ha, spec['up'], spec['fore'], a.get('bend', (-1.0, .7 * sgn, -.3)))
        e2 = vadd(sh2, proj(el, view))
        h2 = vadd(sh2, proj(ha, view))
        ed, hd = shd + dep(el, view), shd + dep(ha, view)
        part = 'arm' + side
        back = side_vec(view, (-1, 0, 0))
        if spec.get('wu'):
            stroke(cv, sh2, e2, spec['wu'], shd, ed, part, spec['mat_u'], side=back, bulge=spec.get('bu', ()),
                   detail=spec.get('du'), root_t=spec.get('root', .35), rad=spec.get('rad', 1.0))
        stroke(cv, e2, h2, spec['wf'], ed, hd, part, spec['mat_f'], side=back, bulge=spec.get('bf', ()),
               detail=spec.get('df'), rad=spec.get('rad', 1.0))
        dv = (h2[0] - e2[0], h2[1] - e2[1])
        self.hand(cv, P, view, side, h2, dv, hd + spec.get('rad', 1.0), part, a)
        J['el2' + side], J['ha2' + side], J['had' + side] = e2, h2, hd

    def leg(self, cv, P, view, side, J, Dt):
        spec = self.leg_spec(P, side)
        g = P['legs'][side]
        sgn = 1 if side == 'N' else -1
        hp2 = J['hp' + side]
        hpd = Dt + self.hp_dz * sgn
        hip3 = vadd(P['pel'], (0, self.hip_w * sgn, -.4))
        ft = g['ft']
        ank3 = vadd(ft, (0, 0, spec.get('ankle', 1.5) + g.get('heel', 0)))
        kn3 = g['kn'] if 'kn' in g else ik3(hip3, ank3, spec['th'], spec['sh'], g.get('bend', (1.0, 0.0, .1)))
        H3, K3, A3 = self.S(hip3, view), self.S(kn3, view), self.S(ank3, view)
        a2 = A3
        mid = ((H3[0] + A3[0]) / 2, (H3[1] + A3[1]) / 2)
        bend2 = (K3[0] - mid[0], K3[1] - mid[1])
        if math.hypot(*bend2) < .3:
            bend2 = side_vec(view, (1, 0, 0))
        k2 = ik2(hp2, a2, dist2(H3, K3), dist2(K3, A3), bend2)
        kd = (hpd + self.D(ank3, view)) / 2 + (self.D(kn3, view) - (self.D(hip3, view) + self.D(ank3, view)) / 2)
        ad = self.D(ank3, view)
        part = 'leg' + side
        back = side_vec(view, (-1, 0, 0))
        stroke(cv, hp2, k2, spec['wt'], hpd, kd, part, spec['mat_t'], side=back, bulge=spec.get('bt', ()),
               detail=spec.get('dt'), root_t=spec.get('root', .3), rad=spec.get('rad', 1.2))
        stroke(cv, k2, a2, spec['ws'], kd, ad, part, spec['mat_s'], side=back, bulge=spec.get('bs', ()),
               detail=spec.get('ds'), rad=spec.get('rad', 1.2))
        self.foot(cv, P, view, side, ank3, ft, g, part, spec, ad)
        J['kn2' + side], J['an2' + side] = k2, a2

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        pass

    def foot(self, cv, P, view, side, ank3, ft, g, part, spec, depth):
        pass

    def extras(self, cv, P, view, J, meta):
        pass

    # --------------------------------------------------------- generic hands and feet
    def claw_hand(self, cv, h2, dv, depth, part, mat, claw, fingers, palm=2, curl=0.0, tone=None):
        """palm blob plus fingers fanning along the forearm direction, claw tips in another material"""
        L = math.hypot(*dv) or 1.0
        u = (dv[0] / L, dv[1] / L)
        c = (h2[0] + u[0] * .7, h2[1] + u[1] * .7)
        if palm % 2:
            bx, by = int(round(c[0])), int(round(c[1]))
            cc = (bx, by)
        else:
            bx, by = int(math.floor(c[0] + .5)), int(math.floor(c[1] + .5))
            cc = (bx - .5, by - .5)
        for (ox, oy) in BRUSH[palm]:
            x, y = bx + ox, by + oy
            n = vnorm(((x - cc[0]) * .8, (y - cc[1]) * .8, 1.0))
            cv.put(x, y, (mat, tone_of(n) if tone is None else tone), depth, part)
        for k, (ang, ln) in enumerate(fingers):
            a = math.radians(ang)
            d = (u[0] * math.cos(a) - u[1] * math.sin(a), u[0] * math.sin(a) + u[1] * math.cos(a))
            base = (cc[0] + d[0] * (palm / 2 - .2), cc[1] + d[1] * (palm / 2 - .2))
            prev = None
            steps = max(1, int(round(ln * 2)))
            for s_ in range(1, steps + 1):
                t = s_ / 2.0
                bend = curl * t * .35
                dd = (d[0] * math.cos(bend) - d[1] * math.sin(bend), d[0] * math.sin(bend) + d[1] * math.cos(bend))
                q = (int(round(base[0] + dd[0] * t)), int(round(base[1] + dd[1] * t)))
                if q == prev:
                    continue
                prev = q
                tip = s_ >= steps - (1 if ln >= 2 else 0)
                key = (claw, 3) if (tip and claw) else (mat, 2 if ang <= 0 else 1)
                cv.put(q[0], q[1], key, depth + .1, 'claw' if (tip and claw) else part)

# ============================================================== gait helpers
def cyc(seq, i):
    return seq[i % len(seq)]

def walk8(i, step=2.0, lift=(1.0, 2.0, 1.0), spread=1.6, toe_off=.5):
    """8-frame walk: each foot is planted for frames 0-4 of its phase and slides back exactly `step` body units per
    frame (so the runtime moves the sprite `step` units per frame and the planted foot stays put on the ground);
    frames 5-7 swing it forward lifted. Returns (near foot, far foot) as (f, n, z, heel)."""
    pos = (2, 1, 0, -1, -2, -1, 0, 1)
    def one(ph, n):
        f = pos[ph] * step
        z = 0.0
        heel = 0.0
        if ph in (5, 6, 7):
            z = lift[ph - 5]
        if ph == 4:
            heel = toe_off
        return (f, n, z, heel)
    return one(i % 8, spread), one((i + 4) % 8, -spread)

# ============================================================== export and previews
LETTERS = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'

def bake(mut):
    raw = {}
    keys = set()
    for name, spec in mut.ANIMS.items():
        n = spec[0]
        for view in 'FB':
            for i in range(n):
                cv, meta = mut.frame(name, i, view)
                raw[(name, view, i)] = (cv, meta)
                keys |= {v[0] for v in cv.px.values()} | set(cv.fx.values())
    keys.discard('o')
    keys = sorted(keys, key=lambda k: (str(k[0]), k[1]) if isinstance(k, tuple) else (str(k), 0))
    pal_rgb = {}
    for k in keys:
        if isinstance(k, tuple):
            pal_rgb[k] = mut.mats[k[0]][k[1]]
        else:
            pal_rgb[k] = mut.mats[k][2]
    # merge keys with identical colours
    letter = {'o': 'o'}
    by_rgb = {}
    pool = iter(LETTERS)
    pal = {'o': list(INK)}
    for k in keys:
        c = pal_rgb[k]
        if c == INK:
            letter[k] = 'o'
            continue
        if c not in by_rgb:
            L = next(pool)
            by_rgb[c] = L
            pal[L] = list(c)
        letter[k] = by_rgb[c]
    anims = {}
    for name, spec in mut.ANIMS.items():
        n, fps, loop = spec[:3]
        a = {'fps': fps, 'loop': loop}
        for view in 'FB':
            fr = []
            for i in range(n):
                cv, meta = raw[(name, view, i)]
                d = {'rows': rows_of(cv, letter)}
                for k in ('head', 'mouth'):
                    if k in meta:
                        d[k] = [int(v) for v in meta[k]]
                fr.append(d)
            a[view] = fr
        anims[name] = a
    return {'w': mut.w, 'h': mut.h, 'ax': mut.ax, 'ay': mut.ay, 'pal': pal, 'anims': anims}

def img_of(sp, rows, scale=1, bg=None):
    from PIL import Image
    im = Image.new('RGBA', (sp['w'] * scale, sp['h'] * scale), bg + (255,) if bg else (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            c = tuple(sp['pal'][ch]) + (255,)
            for yy in range(scale):
                for xx in range(scale):
                    px[x * scale + xx, y * scale + yy] = c
    return im

def sheet(name, sp, path, scale=6, bg=(226, 222, 212)):
    from PIL import Image, ImageDraw
    rows = []
    for an, a in sp['anims'].items():
        for view in 'FB':
            rows.append((an, view, a[view]))
    cols = max(len(r[2]) for r in rows)
    cw, ch = sp['w'] * scale + 8, sp['h'] * scale + 8
    lab = 60
    im = Image.new('RGB', (lab + cols * cw, len(rows) * ch + 20), bg)
    d = ImageDraw.Draw(im)
    d.text((4, 4), f"{name} {sp['w']}x{sp['h']} anchor ({sp['ax']},{sp['ay']})", fill=(40, 40, 40))
    for r, (an, view, frames) in enumerate(rows):
        y0 = 20 + r * ch
        d.text((4, y0 + ch // 2 - 10), f"{an}\n{view} {sp['anims'][an]['fps']}fps", fill=(40, 40, 40))
        for c, fr in enumerate(frames):
            x0 = lab + c * cw
            cell = Image.new('RGB', (sp['w'] * scale, sp['h'] * scale), (200, 196, 186) if (r // 2) % 2 else (212, 208, 198))
            g = img_of(sp, fr['rows'], scale)
            cell.paste(g, (0, 0), g)
            dd = ImageDraw.Draw(cell)
            # anchor marks: ground row and anchor column ticks
            ay, ax = sp['ay'], sp['ax']
            dd.line([(0, (ay + 1) * scale), (scale * 2, (ay + 1) * scale)], fill=(220, 40, 40))
            dd.line([(sp['w'] * scale - 2 * scale, (ay + 1) * scale), (sp['w'] * scale, (ay + 1) * scale)], fill=(220, 40, 40))
            dd.line([(ax * scale + scale // 2, sp['h'] * scale - scale), (ax * scale + scale // 2, sp['h'] * scale)], fill=(220, 40, 40))
            if 'head' in fr:
                hx, hy = fr['head']
                dd.rectangle([hx * scale + 2, hy * scale + 2, hx * scale + scale - 3, hy * scale + scale - 3], outline=(40, 120, 255))
            if 'mouth' in fr:
                mx, my = fr['mouth']
                dd.rectangle([mx * scale + 1, my * scale + 1, mx * scale + scale - 2, my * scale + scale - 2], outline=(255, 0, 255))
            im.paste(cell, (x0, y0))
    im.save(path)
    return im.size

def zoom(mut, frames, path, scale=12, bg=(82, 118, 54)):
    """a few frames side by side, big, for close inspection"""
    from PIL import Image
    sp = bake_some(mut, frames)
    W = sp['w'] * scale
    im = Image.new('RGB', ((W + scale) * len(frames), sp['h'] * scale), (40, 40, 40))
    for k, rows in enumerate(sp['frames']):
        cell = img_of(sp, rows, scale, bg)
        im.paste(cell, (k * (W + scale), 0))
    im.save(path)
    return im.size

def bake_some(mut, frames):
    pal = {'o': list(INK)}
    out = []
    letter = {'o': 'o'}
    pool = iter(LETTERS)
    for (anim, i, view) in frames:
        cv, meta = mut.frame(anim, i, view)
        for v in list(cv.px.values()) + [[k] for k in cv.fx.values()]:
            k = v[0]
            if k not in letter:
                c = mut.mats[k[0]][k[1]] if isinstance(k, tuple) else mut.mats[k][2]
                L = next(pool)
                letter[k] = L
                pal[L] = list(c)
        out.append(rows_of(cv, letter))
    return {'w': mut.w, 'h': mut.h, 'pal': pal, 'frames': out}

# ============================================================== hand-drawn bitmaps
class Bmp:
    """a hand-drawn part: rows of legend letters and named anchors (pixel indices). '.' is transparent."""
    def __init__(self, text, **anchors):
        rows = [r.rstrip() for r in text.strip('\n').split('\n')]
        ind = min(len(r) - len(r.lstrip()) for r in rows if r.strip())
        rows = [r[ind:] for r in rows]
        w = max(len(r) for r in rows)
        self.rows = [r.ljust(w, '.').replace(' ', '.') for r in rows]
        self.w, self.h = w, len(self.rows)
        self.a = {k: tuple(v) for k, v in anchors.items()}

    def mirrored(self):
        b = Bmp.__new__(Bmp)
        b.rows = [r[::-1] for r in self.rows]
        b.w, b.h = self.w, self.h
        b.a = {k: (self.w - 1 - v[0], v[1]) for k, v in self.a.items()}
        return b

    def with_rows(self, text):
        b = Bmp(text)
        b.a = dict(self.a)
        return b

def scale2x(g):
    h, w = len(g), len(g[0])
    o = [['.'] * (2 * w) for _ in range(2 * h)]
    for y in range(h):
        for x in range(w):
            P = g[y][x]
            A = g[y - 1][x] if y > 0 else '.'
            C = g[y][x - 1] if x > 0 else '.'
            B = g[y][x + 1] if x < w - 1 else '.'
            D = g[y + 1][x] if y < h - 1 else '.'
            o[2 * y][2 * x] = A if C == A and C != D and A != B else P
            o[2 * y][2 * x + 1] = B if A == B and A != C and B != D else P
            o[2 * y + 1][2 * x] = C if D == C and D != B and C != A else P
            o[2 * y + 1][2 * x + 1] = D if B == D and B != A and D != C else P
    return o

_BIG = {}
def big8(bmp):
    k = id(bmp)
    if k not in _BIG:
        g = [list(r) for r in bmp.rows]
        for _ in range(3):
            g = scale2x(g)
        _BIG[k] = (bmp, g)
    return _BIG[k][1]

def rot2(v, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)

def stamp(cv, bmp, legend, dst, depth, part, src='hip', deg=0.0, grad=0.0, remap=None, root=False):
    """place bitmap so its anchor `src` lands on canvas pixel dst, rotated by deg (clockwise) around it (RotSprite:
    Scale2x three times, rotate, sample). grad: extra depth per pixel towards screen-left (near side is nearer).
    Returns a function mapping anchor names (or bitmap points) to canvas positions."""
    sa = bmp.a[src] if isinstance(src, str) else src
    if abs(deg) < .5:
        ox, oy = int(round(dst[0] - sa[0])), int(round(dst[1] - sa[1]))
        for j, row in enumerate(bmp.rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                key = legend[ch]
                if remap:
                    key = remap(key)
                if key is None:
                    continue
                cv.put(ox + i, oy + j, key, depth + grad * (sa[0] - i), part, root=root)
        return lambda a: ((bmp.a[a] if isinstance(a, str) else a)[0] + ox, (bmp.a[a] if isinstance(a, str) else a)[1] + oy)
    g = big8(bmp)
    H8, W8 = len(g), len(g[0])
    pc = (sa[0] + .5, sa[1] + .5)
    dc = (round(dst[0]) + .5, round(dst[1]) + .5)
    R = int(math.hypot(bmp.w, bmp.h)) + 2
    for y in range(int(dc[1]) - R, int(dc[1]) + R + 1):
        for x in range(int(dc[0]) - R, int(dc[0]) + R + 1):
            q = rot2((x + .5 - dc[0], y + .5 - dc[1]), -deg)
            sx, sy = q[0] + pc[0], q[1] + pc[1]
            X, Y = int(math.floor(sx * 8)), int(math.floor(sy * 8))
            if 0 <= X < W8 and 0 <= Y < H8:
                ch = g[Y][X]
                if ch != '.':
                    key = legend[ch]
                    if remap:
                        key = remap(key)
                    if key is None:
                        continue
                    cv.put(x, y, key, depth + grad * (sa[0] - sx), part, root=root)
    def amap(a):
        p = bmp.a[a] if isinstance(a, str) else a
        v = rot2((p[0] + .5 - pc[0], p[1] + .5 - pc[1]), deg)
        return (v[0] + dc[0] - .5, v[1] + dc[1] - .5)
    return amap

# ============================================================== sculpt -> ASCII (authoring aid)
def sculpt_ascii(blobs, view, chars, joints=None, R=I3, title=''):
    """render a 3D sculpt in the given view and print it as legend letters, with joint anchors, as a starting point
    for hand painting. chars: {material: 'tones 0..4 letters'}"""
    cv = Canvas(64, 64)
    A = (32, 40)
    res = render_volume(cv, blobs, (0, 0, 0), R, view, 'x', A)
    xs = [p[0] for p in cv.px]
    ys = [p[1] for p in cv.px]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    print(f'--- {title} view {view}  size {x1 - x0 + 1}x{y1 - y0 + 1}')
    for y in range(y0, y1 + 1):
        row = ''
        for x in range(x0, x1 + 1):
            v = cv.px.get((x, y))
            row += '.' if v is None else chars[v[0][0]][v[0][1]]
        print('    ' + row)
    if joints:
        out = {}
        for k, j in joints.items():
            p = proj(mvec(R, j), view)
            out[k] = (int(round(A[0] + p[0] - x0)), int(round(A[1] + p[1] - y0)))
        print('   ', ', '.join(f'{k}={v}' for k, v in out.items()))
