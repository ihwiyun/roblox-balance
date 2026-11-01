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
            k = v[1].tex(v[2], v[3], v[4])
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
           tone_shift=0, flatness=1.0, hl=None):
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
        if hl is not None and tone >= 3 and not any(t0 <= t <= t1 for (t0, t1) in hl):
            tone = 2
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

def unit2(v):
    L = math.hypot(*v) or 1.0
    return (v[0] / L, v[1] / L)

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
    pf, pz = 0.0, 0.0     # per-type pelvis offset (keeps the body centred over the feet / inside the frame)
    lay_shift = (0, 0)    # screen offset for the falling / lying frames of 'die' so the corpse sits inside the frame

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
                    if ch in self.L and self.L[ch] != (m, t):
                        raise ValueError(f'{self.name}: legend letter {ch!r} used for {self.L[ch]} and {(m, t)}')
                    self.L[ch] = (m, t)

    def S(self, body, view):
        p = proj(body, view)
        return (self.ax + p[0], self.ay + p[1])

    def D(self, body, view):
        return dep(body, view)

    def frame(self, anim, i, view):
        cv = Canvas(self.w, self.h)
        P = self.pose(anim, i, view)
        P['_anim'], P['_i'], P['_view'] = anim, i, view
        if 'pel2' in P and anim == 'die' and 'squash' not in P:
            P['squash'] = {2: .88, 3: .72, 4: .68, 5: .68}.get(i, 1.0)
        if 'pel2' in P and anim == 'die' and self.lay_shift != (0, 0):
            dx, dy = self.lay_shift
            P['pel2'] = (P['pel2'][0] + dx, P['pel2'][1] + dy)
            for g in P.get('legs', {}).values():
                for k in ('an2', 'kn2', 'ft2'):
                    if k in g:
                        g[k] = (g[k][0] + dx, g[k][1] + dy)
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

    def corpse(self, i, view, extra=None):
        """generic falling / lying pose for die frames 2..5: the body falls to the screen left (head left), the torso
        and head are rotated and squashed onto the ground plane, arms and legs are laid out from the real anchors"""
        tb = self.T['base'][view]
        hb = self.H.get('dead', self.H['base'])[view]
        tl = tb.a['hip'][1] - tb.a['neck'][1]
        hl = hb.h
        ar = self.arm_spec({}, 'N')
        lg = self.leg_spec({}, 'N')
        La = ar['up'] + ar['fore']
        Ll = lg.get('th', 5) + lg.get('sh', 5) + lg.get('mt', 0)
        cx = int(round((tl + hl * .8 - Ll) / 2.0))
        cy = max(3, int(round(tb.w * .68 / 2.0 - 1)))
        roll = {2: -48, 3: -84, 4: -90, 5: -90}[i]
        P = dict(pel=(0, 0, 3), pel2=({2: cx - 2, 3: cx, 4: cx, 5: cx}[i], {2: -int(Ll * .55) - cy // 2, 3: -cy - 1, 4: -cy, 5: -cy}[i]),
                 roll=roll, hroll={2: -6, 3: -10, 4: -12, 5: -12}[i], head='dead' if 'dead' in self.H else 'base')
        up = {2: 2.0, 3: 1.0, 4: 0.0, 5: 0.0}[i]
        P['arms'] = {'N': dict(ha2=(La * .45, .4 - up), bend2=(0, 1)),
                     'F': dict(ha2=(-La * .22, -min(La * .3, 2.4 + up * 1.5)), bend2=(1, -1))}
        if i == 2:
            P['arms'] = {'N': dict(ha2=(-La * .5, -La * .2), bend2=(1, 1)), 'F': dict(ha2=(-La * .45, -La * .55), bend2=(1, -1))}
        kn = {2: 2.4, 3: 2.0, 4: 1.0, 5: .6}[i]
        P['legs'] = {'N': dict(an2r=(Ll * .8, .2), kn2r=(Ll * .44, -kn - .4), fd2=(.6, -1)),
                     'F': dict(an2r=(Ll * .76, -1.4), kn2r=(Ll * .42, -kn - 1.6), fd2=(.6, -1))}
        if extra:
            P.update(extra)
        return P

    def tdeg(self, P, view):
        sf = 1 if view == 'F' else -1
        return P.get('lean', 0) * sf + P.get('roll', 0)

    def draw(self, cv, P, view):
        meta = {}
        sf = 1 if view == 'F' else -1
        if not P.get('_shifted'):
            P['pel'] = (P['pel'][0] + self.pf, P['pel'][1], P['pel'][2] + self.pz)
            P['_shifted'] = True
        pel3 = P['pel']
        p2 = self.S(pel3, view) if 'pel2' not in P else (self.ax + P['pel2'][0], self.ay + P['pel2'][1])
        hip2 = (int(round(p2[0])), int(round(p2[1])))
        Dt = self.D(pel3, view)
        tdeg = self.tdeg(P, view)
        tb = self.T[P.get('torso', 'base')][view]
        tm = stamp(cv, tb, self.L, hip2, Dt, 'torso', 'hip', tdeg, grad=self.grad, remap=P.get('remap'), squash=P.get('squash', 1.0))
        J = {k: tm(k) for k in tb.a}
        J['_tm'], J['_Dt'], J['_tdeg'] = tm, Dt, tdeg
        if P.get('head', 'base') is not None:
            hb = self.H[P.get('head', 'base')][view]
            ho = proj(P.get('hoff', (0, 0, 0)), view)
            hdeg = tdeg + P.get('hlean', 0) * sf + P.get('hroll', 0)
            hpos = (int(round(J['neck'][0] + ho[0])), int(round(J['neck'][1] + ho[1])))
            hz = Dt + P.get('hdz', self.hdz[view])
            hm = stamp(cv, hb, self.L, hpos, hz, 'head', 'neck', hdeg, remap=P.get('remap'), squash=P.get('squash', 1.0))
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
        if a.get('grip') and ('ha2' + a['grip']) in J:
            g2 = J['ha2' + a['grip']]
            off = a.get('goff', (1.0, -1.0))
            a = dict(a, ha2=(g2[0] + off[0] - sh2[0], g2[1] + off[1] - sh2[1]), bend2=a.get('bend2', (1, 1)))
        if 'ha2' in a:
            h2 = vadd(sh2, a['ha2'])
            e2 = vadd(sh2, a['el2']) if 'el2' in a else ik2(sh2, h2, spec['up'], spec['fore'], a.get('bend2', (-1, 0)))
            ed = hd = shd
        else:
            ha = a['ha']
            el = a['el'] if 'el' in a else ik3((0, 0, 0), ha, spec['up'], spec['fore'], a.get('bend', (-1.0, .7 * sgn, -.3)))
            e2 = vadd(sh2, proj(el, view))
            h2 = vadd(sh2, proj(ha, view))
            ed, hd = shd + dep(el, view), shd + dep(ha, view)
        part = 'arm' + side
        back = side_vec(view, (-1, 0, 0))
        if spec.get('vol'):
            # big limbs: composed muscle volumes rendered with the camera
            el3 = mvec(MVI[view], (e2[0] - sh2[0], e2[1] - sh2[1], ed - shd))
            ha3 = mvec(MVI[view], (h2[0] - sh2[0], h2[1] - sh2[1], hd - shd))
            blobs = self.muscles((0, 0, 0), el3, spec['vol'][0], spec['mat_u'], view, sgn) + \
                    self.muscles(el3, ha3, spec['vol'][1], spec['mat_f'], view, sgn)
            self.vol_at(cv, blobs, sh2, shd, view, part)
        else:
            if spec.get('wu'):
                stroke(cv, sh2, e2, spec['wu'], shd, ed, part, spec['mat_u'], side=back, bulge=spec.get('bu', ()),
                       detail=spec.get('du'), root_t=spec.get('root', .35), rad=spec.get('rad', 1.0), hl=spec.get('hlu'))
            stroke(cv, e2, h2, spec['wf'], ed, hd, part, spec['mat_f'], side=back, bulge=spec.get('bf', ()),
                   detail=spec.get('df'), rad=spec.get('rad', 1.0), hl=spec.get('hlf'))
        dv = (h2[0] - e2[0], h2[1] - e2[1])
        self.hand(cv, P, view, side, h2, dv, hd + spec.get('rad', 1.0), part, a)
        J['el2' + side], J['ha2' + side], J['had' + side] = e2, h2, hd

    def leg(self, cv, P, view, side, J, Dt):
        spec = self.leg_spec(P, side)
        g = P['legs'][side]
        sgn = 1 if side == 'N' else -1
        hp2 = J['hp' + side]
        hpd = Dt + self.hp_dz * sgn
        if 'an2r' in g:
            g['an2'] = (hp2[0] + g['an2r'][0] - self.ax, hp2[1] + g['an2r'][1] - self.ay)
            g['kn2'] = (hp2[0] + g['kn2r'][0] - self.ax, hp2[1] + g['kn2r'][1] - self.ay)
        if 'an2' in g:
            a2 = (self.ax + g['an2'][0], self.ay + g['an2'][1])
            k2 = (self.ax + g['kn2'][0], self.ay + g['kn2'][1]) if 'kn2' in g else ik2(hp2, a2, spec['th'], spec['sh'], g.get('bend2', side_vec(view, (1, 0, 0))))
            kd = ad = hpd + g.get('dz', 0)
            ft = g.get('ft', (0, 0, 0))
            ank3 = None
        else:
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
            g['_gy'] = self.S(vadd(ft, (0, 0, g.get('heel', 0) * .5)), view)[1]
        part = 'leg' + side
        back = side_vec(view, (-1, 0, 0))
        if spec.get('vol'):
            k3 = mvec(MVI[view], (k2[0] - hp2[0], k2[1] - hp2[1], kd - hpd))
            a3 = mvec(MVI[view], (a2[0] - hp2[0], a2[1] - hp2[1], ad - hpd))
            blobs = self.muscles((0, 0, 0), k3, spec['vol'][0], spec['mat_t'], view, sgn) + \
                    self.muscles(k3, a3, spec['vol'][1], spec['mat_s'], view, sgn)
            self.vol_at(cv, blobs, hp2, hpd, view, part)
        else:
            stroke(cv, hp2, k2, spec['wt'], hpd, kd, part, spec['mat_t'], side=back, bulge=spec.get('bt', ()),
                   detail=spec.get('dt'), root_t=spec.get('root', .3), rad=spec.get('rad', 1.2), hl=spec.get('hlt'))
            stroke(cv, k2, a2, spec['ws'], kd, ad, part, spec['mat_s'], side=back, bulge=spec.get('bs', ()),
                   detail=spec.get('ds'), rad=spec.get('rad', 1.2), hl=spec.get('hls'))
        self.foot(cv, P, view, side, a2, k2, g, part, spec, ad)
        J['kn2' + side], J['an2' + side] = k2, a2

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        pass

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        pass

    def foot_dir(self, P, view, g):
        """screen direction the foot points: forward, or g['fd2'] for lying and kicking frames"""
        if 'fd2' in g:
            return unit2(g['fd2'])
        return side_vec(view, (1, 0, 0))

    def extras(self, cv, P, view, J, meta):
        pass

    def muscles(self, a3, b3, prof, mat, view, side_sign=1):
        """ellipsoid muscle masses along a limb segment a3->b3 (3D offsets from the part root).
        prof: [(t, radius, half_length_frac, back_offset, mat_or_None, groove)]; back = away from the body's front"""
        d = vsub(b3, a3)
        L = vlen(d) or 1.0
        u = vmul(d, 1 / L)
        R = frame_of(u, up=(1.0, 0.0, 0.0))
        back = vsub((-1.0, 0.0, 0.0), vmul(u, -u[0]))
        back = vnorm(back) if vlen(back) > 1e-3 else (0.0, -side_sign * 1.0, 0.0)
        out = []
        for m in prof:
            t, r, hl, ob = m[0], m[1], m[2], m[3]
            mm = m[4] if len(m) > 4 and m[4] else mat
            gr = m[5] if len(m) > 5 else True
            c = vadd(vadd(a3, vmul(d, t)), vmul(back, ob))
            out.append(Blob(c, (r, r, max(r, L * hl)), mm, rot=R, groove=gr))
        return out

    def vol_at(self, cv, blobs, pos2, depth, view, part, R=I3, smooth=True):
        """render volume blobs whose local origin sits at screen point pos2 with the given depth"""
        T = mvec(MVI[view], (pos2[0] - self.ax, pos2[1] - self.ay, depth))
        return render_volume(cv, blobs, T, R, view, part, (self.ax, self.ay), smooth=smooth)

    # --------------------------------------------------------- generic hands and feet
    def claw_hand(self, cv, h2, dv, depth, part, mat, claw, fingers, palm=2, curl=0.0, ctone=2, ftone=None, blade=1):
        """palm blob plus fingers along the forearm direction; fingers: [(angle, length, has_claw)]"""
        L = math.hypot(*dv) or 1.0
        u = (dv[0] / L, dv[1] / L)
        c = (h2[0] + u[0] * .6, h2[1] + u[1] * .6)
        if palm % 2:
            bx, by = int(round(c[0])), int(round(c[1]))
            cc = (bx, by)
        else:
            bx, by = int(math.floor(c[0] + .5)), int(math.floor(c[1] + .5))
            cc = (bx - .5, by - .5)
        for (ox, oy) in BRUSH[palm]:
            x, y = bx + ox, by + oy
            n = vnorm(((x - cc[0]) * .8, (y - cc[1]) * .8, 1.0))
            cv.put(x, y, (mat, tone_of(n)), depth, part)
        for f in fingers:
            ang, ln = f[0], f[1]
            hc = f[2] if len(f) > 2 else True
            a = math.radians(ang)
            d = (u[0] * math.cos(a) - u[1] * math.sin(a), u[0] * math.sin(a) + u[1] * math.cos(a))
            base = (cc[0] + d[0] * (palm / 2 - .3), cc[1] + d[1] * (palm / 2 - .3))
            prev = None
            steps = max(1, int(round(ln * 2)))
            pts = []
            for s_ in range(1, steps + 1):
                t = s_ / 2.0
                bend = curl * t * .4
                dd = (d[0] * math.cos(bend) - d[1] * math.sin(bend), d[0] * math.sin(bend) + d[1] * math.cos(bend))
                q = (int(round(base[0] + dd[0] * t)), int(round(base[1] + dd[1] * t)))
                if q != prev and q not in pts:
                    pts.append(q)
                prev = q
            for k, q in enumerate(pts):
                tip = k >= len(pts) - blade and claw and hc
                ct = ctone if k == len(pts) - 1 else min(4, ctone + 1) if ang <= 0 else ctone
                key = (claw, ct) if tip else (mat, ftone if ftone is not None else (2 if ang <= 0 else 1))
                cv.put(q[0], q[1], key, depth + .1, 'claw' if tip else part)

    def simple_foot(self, cv, P, view, a2, g, part, depth, mat, toe=None, length=2.0, width=2, back_len=1.0):
        """a foot from heel to toe along the facing (F) or a heel stub (B); toe: material for the toe tip.
        The sole sits on the ground point below the ankle (g['_gy']) so wide feet do not sink below the ground line."""
        u = self.foot_dir(P, view, g)
        if view == 'B' and 'fd2' not in g:
            length = back_len
        gy = g.get('_gy')
        base_y = (gy - (width - 1) / 2.0) if gy is not None else a2[1] + .5
        heel = (a2[0] - u[0] * .7, base_y - u[1] * .7)
        tip = (a2[0] + u[0] * length, base_y + u[1] * length * .8)
        hits = stroke(cv, heel, tip, [(0, width), (.75, width), (1, max(1, width - 1))], depth, depth + .2, part, mat, rad=.5)
        if toe and hits and view == 'F':
            far = max(hits, key=lambda q: (q[0] - heel[0]) * u[0] + (q[1] - heel[1]) * u[1])
            cv.put(far[0], far[1], (toe, 2), depth + .3, 'claw')

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
                    if k in meta and not (k == 'mouth' and name != 'spit'):
                        d[k] = [int(v) for v in meta[k]]
                fr.append(d)
            a[view] = fr
        anims[name] = a
    return {'w': mut.w, 'h': mut.h, 'ax': mut.ax, 'ay': mut.ay, 'pal': pal, 'anims': anims}

def border_hits(sp):
    """frames whose pixels touch the frame edge (the art may be cut off there)"""
    out = []
    for an, a in sp['anims'].items():
        for view in 'FB':
            for i, fr in enumerate(a[view]):
                r = fr['rows']
                sides = []
                solid = lambda ch: ch not in '.o'
                if any(solid(ch) for ch in r[0]): sides.append('top')
                if any(solid(ch) for ch in r[-1]): sides.append('bottom')
                if any(solid(row[0]) for row in r): sides.append('left')
                if any(solid(row[-1]) for row in r): sides.append('right')
                if sides:
                    out.append(f'{an}.{view}{i}:{"/".join(sides)}')
    return out

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

    def patch(self, edits):
        """hand-painted edits: [(x, y, 'text')], text runs to the right; '.' keeps a pixel, '_' clears it"""
        rows = [list(r) for r in self.rows]
        for (x, y, t) in edits:
            for k, ch in enumerate(t):
                if ch == '.':
                    continue
                if 0 <= y < self.h and 0 <= x + k < self.w:
                    rows[y][x + k] = '.' if ch == '_' else ch
        self.rows = [''.join(r) for r in rows]
        return self

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

def stamp(cv, bmp, legend, dst, depth, part, src='hip', deg=0.0, grad=0.0, remap=None, root=False, squash=1.0):
    """place bitmap so its anchor `src` lands on canvas pixel dst, rotated by deg (clockwise) around it (RotSprite:
    Scale2x three times, rotate, sample). grad: extra depth per pixel towards screen-left (near side is nearer).
    Returns a function mapping anchor names (or bitmap points) to canvas positions."""
    sa = bmp.a[src] if isinstance(src, str) else src
    if abs(deg) < .5 and squash == 1.0:
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
            q = rot2((x + .5 - dc[0], (y + .5 - dc[1]) / squash), -deg)
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
        return (v[0] + dc[0] - .5, v[1] * squash + dc[1] - .5)
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

def parts_sheet(mut, path, scale=14, extra=()):
    """every hand-painted bitmap of a type, enlarged, with its anchors marked (authoring aid)"""
    from PIL import Image, ImageDraw
    items = []
    for grp, dd in (('T', mut.T), ('H', mut.H)) + tuple(extra):
        for var, views in dd.items():
            for v, b in views.items():
                items.append((f'{grp}.{var}.{v}', b))
    cw = max(b.w for _, b in items) * scale + 20
    chh = max(b.h for _, b in items) * scale + 34
    cols = min(6, len(items))
    rows = (len(items) + cols - 1) // cols
    im = Image.new('RGB', (cols * cw, rows * chh), (60, 60, 60))
    d = ImageDraw.Draw(im)
    for k, (nm, b) in enumerate(items):
        x0, y0 = (k % cols) * cw + 10, (k // cols) * chh + 24
        d.text((x0, y0 - 18), nm, fill=(240, 240, 240))
        d.rectangle([x0, y0, x0 + b.w * scale - 1, y0 + b.h * scale - 1], fill=(82, 118, 54))
        for j, row in enumerate(b.rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                key = mut.L.get(ch)
                c = INK if key == 'o' else (mut.mats[key[0]][key[1]] if key else (255, 0, 255))
                d.rectangle([x0 + i * scale, y0 + j * scale, x0 + (i + 1) * scale - 1, y0 + (j + 1) * scale - 1], fill=c)
        for an, (ax_, ay_) in b.a.items():
            cx, cy = x0 + ax_ * scale + scale // 2, y0 + ay_ * scale + scale // 2
            d.rectangle([cx - 2, cy - 2, cx + 2, cy + 2], outline=(0, 220, 255))
            d.text((cx + 4, cy - 4), an, fill=(0, 230, 255))
    im.save(path)
    return im.size

def sculpt_ss(blobs, view, R=I3, ss=4, A=(32, 40), size=64, groove=True, bias=0.0):
    """supersampled sculpt render: {pixel: (mat, tone)} using ss*ss rays per pixel; the material is the majority,
    the tone comes from the averaged light; grooves where the dominant blob changes to one in front"""
    M = MV(view)
    Rt = mT(R)
    prep = []
    for b in blobs:
        E = mmul(M, mmul(R, mmul(b.rot, diag(b.r))))
        Q = minv(E)
        sc = mvec(M, mvec(R, b.c))
        sc = (sc[0] + A[0], sc[1] + A[1], sc[2])
        w = (Q[0][2], Q[1][2], Q[2][2])
        prep.append((b, Q, sc, w, dot(w, w)))
    out = {}
    for y in range(size):
        for x in range(size):
            hits = []
            for sy_ in range(ss):
                for sx_ in range(ss):
                    px_, py_ = x - .5 + (sx_ + .5) / ss, y - .5 + (sy_ + .5) / ss
                    best = None
                    for (b, Q, sc, w, ww) in prep:
                        dx, dy = px_ - sc[0], py_ - sc[1]
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
                                lo = max(lo, t1)
                                if t2 < hi:
                                    hi, face = t2, k
                            if not ok or lo > hi:
                                continue
                            tau = hi
                            u = (a[0] + w[0] * tau, a[1] + w[1] * tau, a[2] + w[2] * tau)
                            sgn = 1.0 if u[face] > 0 else -1.0
                            nrm = (Q[face][0] * sgn, Q[face][1] * sgn, Q[face][2] * sgn)
                        d = sc[2] + tau
                        if best is None or d > best[0]:
                            best = (d, b, nrm)
                    if best:
                        d, b, nrm = best
                        n = vnorm(nrm)
                        body = mvec(MVI[view], (px_ - A[0], py_ - A[1], d))
                        loc = mvec(Rt, body)
                        mat = b.mat(loc) if callable(b.mat) else b.mat
                        lum = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] + b.bias + bias
                        hits.append((mat, lum, b, d))
            if len(hits) * 2 < ss * ss:
                continue
            mats = [h[0] for h in hits]
            mat = max(set(mats), key=mats.count)
            lums = [h[1] for h in hits if h[0] == mat]
            lum = sum(lums) / len(lums)
            bl = [h[2] for h in hits]
            dom = max(set(bl), key=bl.count)
            dd = sum(h[3] for h in hits if h[2] is dom) / bl.count(dom)
            t = 4 if lum >= TONE_T[0] else 3 if lum >= TONE_T[1] else 2 if lum >= TONE_T[2] else 1 if lum >= TONE_T[3] else 0
            out[(x, y)] = [mat, t, dom, dd]
    if groove:
        dark = []
        for p, v in out.items():
            if not v[2].groove:
                continue
            for q in nb4(*p):
                o = out.get(q)
                if o and o[2] is not v[2] and o[2].groove and o[3] > v[3] + .25 and o[0] == v[0]:
                    dark.append(p)
                    break
        for p in dark:
            out[p][1] = max(0, out[p][1] - 1)
    return out

def sculpt_print(blobs, view, chars, joints=None, R=I3, title='', ss=4, bias=0.0):
    A = (32, 40)
    out = sculpt_ss(blobs, view, R, ss, A, bias=bias)
    xs = [p[0] for p in out]
    ys = [p[1] for p in out]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    print(f'--- {title} view {view}  size {x1 - x0 + 1}x{y1 - y0 + 1}')
    for y in range(y0, y1 + 1):
        print('    ' + ''.join('.' if (x, y) not in out else chars[out[(x, y)][0]][out[(x, y)][1]] for x in range(x0, x1 + 1)))
    if joints:
        res = {}
        for k, j in joints.items():
            p = proj(mvec(R, j), view)
            res[k] = (int(round(A[0] + p[0] - x0)), int(round(A[1] + p[1] - y0)))
        print('   ', ', '.join(f'{k}={v}' for k, v in res.items()))

# ============================================================== shared bits
def glow_remap(levels, mats=('mus',), to='musG', veins=('vein',), vto='veinG'):
    """recolour for a pulse: muscle tones brighten towards a hot ramp, veins light up"""
    def f(key, L=levels):
        if not isinstance(key, tuple) or L <= 0:
            return key
        m, t = key
        if m in mats:
            return (to, min(4, t + (1 if L >= 2 else 0) + (1 if L >= 3 and t >= 2 else 0)))
        if m in veins:
            return (vto, min(4, 2 + L // 2 + (1 if L >= 3 else 0)))
        return key
    return f

def sparkle(cv, pts, key):
    for (x, y) in pts:
        if 0 <= x < cv.w and 0 <= y < cv.h:
            cv.fx[(x, y)] = key

# ============================================================== REGENERATOR
class Regenerator(Mutant):
    """flayed: exposed red muscle, purple veins, pale sinew knitting a torn belly; stomping march"""
    name = 'regenerator'
    w = h = 32
    ax, ay = 15, 27
    ANIMS = {'walk': (8, 8, True), 'attack': (5, 9, False), 'die': (6, 8, False), 'hit': (1, 8, False), 'regen': (4, 8, True)}

    pz = -1.5
    lay_shift = (2, -2)
    def setup(self):
        self.mats = {
            'mus': ramp((176, 50, 62)),
            'musG': ramp((232, 96, 112), warm=(255, 240, 200)),
            'rag': ramp((74, 62, 58)),
            'skn': ramp((120, 140, 100)),
            'vein': ramp((92, 40, 120)),
            'veinG': ramp((200, 70, 210), warm=(255, 220, 255)),
            'sin': ramp((236, 176, 170)),
            'bone': ramp((222, 210, 184)),
            'eye': flat((255, 196, 60)),
            'mouth': ramp((70, 18, 30)),
            'spark': flat((255, 214, 230)),
        }
        self.legend({'mus': '12345', 'rag': 'abcde', 'vein': ' v V ', 'sin': '  sS ', 'bone': ' wyWX', 'eye': '  E  ', 'mouth': 'mM   ', 'skn': 'fghi '})
        self.T['base'] = {
            'F': Bmp("""
                .....443....
                ...4554433..
                .4554433443.
                454v44323332
                44v233223221
                33212211211.
                .W32mmm211..
                .3W2sSs321..
                .W32mmm321..
                ..cdcbcbba..
                ..bccbabba..
            """, hip=(5, 9), neck=(6, 0), shN=(1, 4), shF=(10, 3), hpN=(4, 10), hpF=(7, 9)),
            'B': Bmp("""
                ....433.....
                ..45544332..
                .4554W33432.
                45324w233322
                443v3W232221
                33222w22121.
                .4332W2221..
                .3432w1211..
                .3323W121...
                ..cdcbcbba..
                ..bccbabba..
            """, hip=(5, 9), neck=(5, 0), shN=(1, 4), shF=(10, 3), hpN=(4, 10), hpF=(7, 9)),
        }
        self.H['base'] = {
            'F': Bmp("""
                .ghhg...
                fghh554.
                fg344W32
                .221E1E1
                .3W32m22
                .21WyWy1
                ..1ymym.
                ...121..
            """, neck=(3, 7), top=(3, 0)),
            'B': Bmp("""
                .ghhg...
                fghhhg3.
                fghhg432
                .g44v322
                .3433221
                .332221.
                ..2211..
            """, neck=(4, 6), top=(3, 0)),
        }

    def arm_spec(self, P, side):
        return dict(up=4.0, fore=4.0, mat_u='mus', mat_f='mus', wf=2,
                    vol=([(.12, 1.25, .25, 0.0), (.5, 1.0, .32, -.3), (.45, 1.05, .3, .35), (.95, .8, .12, .2)],
                         [(.25, 1.05, .3, .15), (.62, .85, .3, 0.0, 'vein' if side == 'N' else None, False), (.95, .75, .12, 0.0)]))

    def leg_spec(self, P, side):
        return dict(th=5.2, sh=5.0, ankle=1.4, mat_t='mus', mat_s='mus',
                    vol=([(.28, 1.45, .3, -.1, 'rag'), (.62, 1.2, .28, 0.0, 'rag' if side == 'F' else None), (.97, .95, .12, -.25)],
                         [(.3, 1.1, .28, .4), (.55, .8, .4, -.15), (.95, .78, .12, 0.0)]))

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'mus', 'bone', [(-30, 1.5), (15, 1.5), (-80, 1.0, False)], palm=2)

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'mus', toe='bone')

    def pose(self, anim, i, view):
        if anim == 'walk':
            fN, fF = walk8(i, step=1.5, lift=(1, 2, 1), spread=1.0)
            bob = cyc([0, 1, 0, -1, 0, 1, 0, -1], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(.5, 0, 11.0 - bob),
                        arms={'N': dict(ha=(1.6 + 1.6 * sw, .6, -6.6)), 'F': dict(ha=(1.6 - 1.6 * sw, -.6, -6.6))},
                        legs={'N': dict(ft=fN[:3], heel=fN[3]), 'F': dict(ft=fF[:3], heel=fF[3])})
        if anim == 'attack':
            lean = [-6, -12, 12, 18, 6][i]
            pz = [11, 11.2, 10.4, 10.0, 10.6][i]
            haN = [(-1.0, 1.2, 2.0), (-2.0, 1.0, 3.6), (4.2, .4, -2.0), (4.6, .2, -4.6), (2.6, .4, -5.6)][i]
            haF = [(2.0, -.6, -4.4), (2.6, -.6, -3.8), (-1.0, -.8, -5.6), (-1.6, -.8, -6.0), (.6, -.6, -6.4)][i]
            return dict(pel=(.5 + [0, -.3, .6, .9, .5][i], 0, pz), lean=lean, hlean=[-6, -10, 8, 10, 4][i],
                        arms={'N': dict(ha=haN), 'F': dict(ha=haF)},
                        legs={'N': dict(ft=(2.4, 1.2, 0)), 'F': dict(ft=(-1.8, -1.2, 0))})
        if anim == 'hit':
            return dict(pel=(.2, 0, 10.8), lean=-12, hlean=-16,
                        arms={'N': dict(ha=(-2.2, 1.4, -5.6)), 'F': dict(ha=(-1.6, -1.2, -5.8))},
                        legs={'N': dict(ft=(1.6, 1.2, 0)), 'F': dict(ft=(-1.2, -1.2, 0))})
        if anim == 'regen':
            k = [0, 1, 2, 1][i]
            return dict(pel=(.4, 0, 10.6 + .4 * (k > 0)), lean=-4 - 2 * k, hlean=-6 - 4 * k, glow=[1, 2, 3, 2][i],
                        arms={'N': dict(ha=(.4, 3.2 + .4 * k, -5.0 + .6 * k)), 'F': dict(ha=(.4, -3.0 - .4 * k, -5.0 + .6 * k))},
                        legs={'N': dict(ft=(1.0, 2.0, 0)), 'F': dict(ft=(-.6, -2.0, 0))})
        if anim == 'die':
            return self.die_pose(i, view)

    def die_pose(self, i, view):
        if i == 0:
            return dict(pel=(0, 0, 10.8), lean=-14, hlean=-20,
                        arms={'N': dict(ha=(-1.4, 1.8, 3.4)), 'F': dict(ha=(-1.4, -1.6, 3.0))},
                        legs={'N': dict(ft=(1.6, 1.2, 0)), 'F': dict(ft=(-1.0, -1.2, 0))})
        if i == 1:
            return dict(pel=(-.4, 0, 8.6), lean=-26, hlean=-16,
                        arms={'N': dict(ha=(-2.4, 2.4, 2.2)), 'F': dict(ha=(-2.0, -2.0, 2.6))},
                        legs={'N': dict(ft=(2.4, 1.2, 0)), 'F': dict(ft=(1.0, -1.2, 0))})
        # falling and lying: screen-space layout, head to the left in both views
        return self.corpse(i, view)

    def draw(self, cv, P, view):
        if P.get('glow'):
            P['remap'] = glow_remap(P['glow'])
        return Mutant.draw(self, cv, P, view)

    def after(self, cv, P, view, meta):
        g = P.get('glow', 0)
        if g >= 2:
            # sparks of new flesh popping around the body
            pts = [(6, 9), (24, 12), (5, 19), (25, 21), (10, 4), (21, 5)]
            k = P['_i']
            sparkle(cv, [p for n, p in enumerate(pts) if (n + k) % 2 == 0 and (x_ := p) and (p not in cv.px)], ('spark', 2))

# ============================================================== SPITTER
class Spitter(Mutant):
    """hunched; a distended jaw and a huge translucent throat sac full of acid; sickly yellow-green skin; drools"""
    name = 'spitter'
    w = h = 32
    ax, ay = 15, 27
    ANIMS = {'walk': (8, 7, True), 'attack': (5, 9, False), 'die': (6, 8, False), 'hit': (1, 8, False), 'spit': (5, 8, False)}
    hdz = {'F': 1.6, 'B': -1.4}

    pf = -3.0
    lay_shift = (1, -2)
    def setup(self):
        self.mats = {
            'skn': ramp((164, 172, 84)),
            'rag': ramp((96, 66, 56)),
            'pnt': ramp((96, 72, 56)),
            'sac': ramp((206, 212, 132), cool=(70, 90, 60)),
            'acid': ramp((120, 226, 48), cool=(30, 110, 60), warm=(246, 255, 190), spread=1.2),
            'vein': ramp((140, 70, 100)),
            'mouth': ramp((50, 58, 36)),
            'bone': ramp((222, 214, 180)),
            'eye': flat((244, 240, 214)),
        }
        self.legend({'skn': '12345', 'rag': 'abcde', 'pnt': 'fghij', 'mouth': 'MN   ', 'acid': ' xGHI', 'bone': ' w W ', 'eye': '  E  ', 'vein': ' v   '})
        self.T['base'] = {
            'F': Bmp("""
                .....3445....
                ...c344543...
                ..cd3454543c.
                .cdd345443dcb
                4cddc3432dcb2
                43ccdc232cbb2
                .3bccbbbbbb2.
                ..bbbbbaaa...
                ..bbbbaaa....
                ...ihhgg.....
                ..ihhggf.....
                ...hgff......
            """, hip=(5, 9), neck=(12, 5), shN=(1, 5), shF=(10, 3), hpN=(4, 10), hpF=(7, 9)),
            'B': Bmp("""
                ...c3445.....
                ..cd45453c...
                .cdd354543c..
                cddd345443cc.
                ccdcd34343ccb
                bcccc2c2ccbbb
                .bbccbcbcbbb.
                ..bbbbbbbbb..
                ...bbbbbaa...
                ....iihhg....
                ...ihhhggf...
                ....hhgff....
            """, hip=(7, 9), neck=(3, 2), shN=(1, 4), shF=(11, 3), hpN=(6, 10), hpF=(9, 9)),
        }
        self.H['base'] = {
            'F': Bmp("""
                ...2344..
                ..2345542
                .2341EM1E
                .23333322
                .2333WMWM
                ..23MGGGM
                ..2MGHIGM
                ...MGHGM.
                ...2wMw2.
                ....122..
            """, neck=(2, 5), top=(5, 0), mouth=(6, 6), throat=(4, 8)),
            'B': Bmp("""
                .2344..
                234554.
                2345543
                2344432
                2333321
                .22221.
                ..122..
            """, neck=(4, 6), top=(3, 0), mouth=(1, 4), throat=(3, 6)),
        }
        self.H['shut'] = {
            'F': Bmp("""
                ...2344..
                ..2345542
                .2341EM1E
                .23333322
                .2333W2W2
                ..233WW2.
                ..23MNNM.
                ...2wMw2.
                ...2122..
                ....12...
            """, neck=(2, 5), top=(5, 0), mouth=(6, 5), throat=(4, 8)),
            'B': self.H['base']['B'],
        }
        self.H['dead'] = {
            'F': Bmp("""
                ...2344..
                ..2345542
                .23411112
                .23333322
                .2333WMWM
                ..23MMNNM
                ..2MNNNNM
                ...MNGNM.
                ...2wMw2.
                ....122..
            """, neck=(2, 5), top=(5, 0), mouth=(6, 6), throat=(4, 8)),
            'B': self.H['base']['B'],
        }

    def arm_spec(self, P, side):
        def up(t, s, ss, tone):
            return ('rag', max(0, tone - 1)) if t < .45 + (.15 if s > 0 else 0) else ('skn', tone)
        return dict(up=3.8, fore=3.8, mat_u='skn', mat_f='skn', wf=2,
                    vol=([(.18, .95, .24, 0.0, 'rag'), (.55, .72, .3, 0.0, 'rag' if side == 'F' else None), (.96, .62, .1, .2)],
                         [(.25, .75, .3, .12), (.62, .6, .3, 0.0), (.95, .55, .1, 0.0)]))

    def leg_spec(self, P, side):
        def shin(t, s, ss, tone):
            hem = .35 + (.15 if int((s + 1) * 2) % 2 else 0)
            return ('pnt', max(0, tone - 1)) if t < hem else ('skn', tone)
        return dict(th=4.6, sh=4.4, ankle=1.2, mat_t='skn', mat_s='skn',
                    vol=([(.3, 1.2, .34, 0.0, 'pnt'), (.7, 1.0, .3, 0.0, 'pnt'), (.97, .78, .1, -.2)],
                         [(.3, .85, .3, .3), (.6, .62, .34, 0.0), (.95, .58, .1, 0.0)]))

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'skn', 'bone', [(-25, 1.5), (20, 1.5)], palm=2)

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'skn', length=1.8)

    def pose(self, anim, i, view):
        if anim == 'walk':
            fN, fF = walk8(i, step=1.0, lift=(.6, 1.2, .6), spread=1.2)
            bob = cyc([0, 1, 0, 0, 0, 1, 0, 0], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(-.4, 0, 10.2 - bob), hlean=cyc([0, 6, 3, 0, 0, 6, 3, 0], i),
                        sac=1.0, sway=cyc([0, 1, 1, 0, 0, -1, -1, 0], i), drool=i,
                        arms={'N': dict(ha=(2.4 + .9 * sw, .6, -5.6)), 'F': dict(ha=(2.2 - .9 * sw, -.4, -5.4))},
                        legs={'N': dict(ft=fN[:3], heel=fN[3]), 'F': dict(ft=fF[:3], heel=fF[3])})
        stance = {'N': dict(ft=(1.4, 1.2, 0)), 'F': dict(ft=(-1.0, -1.2, 0))}
        if anim == 'attack':
            lean = [-8, -14, 14, 18, 4][i]
            return dict(pel=(-.4 + [0, -.3, .9, 1.1, .3][i], 0, [10.2, 10.4, 9.6, 9.4, 10.0][i]), lean=lean,
                        hlean=[-10, -16, 12, 8, 0][i], head=['base', 'base', 'base', 'shut', 'shut'][i],
                        sac=[1.0, 1.05, .95, .9, 1.0][i], sway=[0, -1, 1, 1, 0][i], drool=i,
                        arms={'N': dict(ha=[(1.0, .9, -4.6), (.4, 1.0, -4.2), (3.6, .6, -3.4), (3.8, .5, -4.0), (2.6, .6, -5.2)][i]),
                              'F': dict(ha=[(1.2, -.6, -4.8), (.8, -.6, -4.6), (3.2, -.4, -3.8), (3.4, -.4, -4.2), (2.2, -.4, -5.2)][i])},
                        legs={'N': dict(ft=(1.8, 1.2, 0)), 'F': dict(ft=(-1.2, -1.2, 0))})
        if anim == 'spit':
            return dict(pel=(-.4 + [-.4, -.5, .7, .9, .2][i], 0, [10.4, 10.6, 9.8, 9.6, 10.1][i]), lean=[-12, -16, 12, 16, 4][i],
                        hlean=[-16, -20, 8, 14, 2][i], head=['shut', 'base', 'base', 'base', 'shut'][i],
                        sac=[1.15, 1.42, 1.1, .78, .9][i], glow=[1, 3, 2, 1, 0][i], sway=[0, 0, -1, 0, 1][i], drool=i,
                        glob=(i == 3), spitflash=(i == 2),
                        arms={'N': dict(ha=(1.0, 1.3, -4.6)), 'F': dict(ha=(1.0, -1.0, -4.6))}, legs=stance)
        if anim == 'hit':
            return dict(pel=(-.8, 0, 10.2), lean=-14, hlean=-18, sac=1.0, sway=-1, drool=2,
                        arms={'N': dict(ha=(-1.4, 1.4, -4.4)), 'F': dict(ha=(-1.0, -1.2, -4.6))}, legs=stance)
        if anim == 'die':
            if i == 0:
                return dict(pel=(-.6, 0, 10.2), lean=-16, hlean=-20, sac=1.25, glow=2, sway=0, head='base',
                            arms={'N': dict(ha=(1.8, .2, -1.8)), 'F': dict(ha=(1.6, -.2, -1.6))}, legs=stance)
            if i == 1:
                return dict(pel=(-.8, 0, 7.6), lean=-24, hlean=-16, sac=0, burst=1, head='dead',
                            arms={'N': dict(ha=(-1.4, 2.2, 1.0)), 'F': dict(ha=(-1.0, -2.0, 1.4))},
                            legs={'N': dict(ft=(2.2, 1.2, 0)), 'F': dict(ft=(.8, -1.2, 0))})
            return self.corpse(i, view, dict(sac=0, burst=i))

    def sac_blobs(self, k, glow):
        def tex(p, key, n):
            m, t = key
            # translucent membrane: the acid glows through where the sac faces the camera
            if m == 'sac' and n[2] > .62 - .05 * glow:
                m, t = 'acid', min(4, max(1, t))
            # a few veins running down the sac
            if (abs(p[1] - .8 * k - .35 * p[2]) < .3 or abs(p[1] + 1.0 * k + .3 * p[2]) < .26) and p[2] > -3.6 * k:
                return ('vein', 1)
            if m == 'acid':
                return ('acid', min(4, t + (1 if glow >= 2 else 0)))
            return (m, t)
        return [Blob((.6, 0, -2.2 * k), (2.4 * k, 2.6 * k, 2.9 * k), 'sac', tex=tex, groove=False),
                Blob((-.1, 0, -.1), (1.1, 1.2, 1.2), 'skn', groove=False)]

    def extras(self, cv, P, view, J, meta):
        if '_hm' not in J:
            return
        hm, hz = J['_hm'], J['_hz']
        k = P.get('sac', 1.0)
        th = hm('throat')
        mo = hm('mouth')
        meta['mouth'] = [int(round(mo[0])), int(round(mo[1]))]
        if k > 0:
            sw = P.get('sway', 0)
            pos = (th[0] + (sw * .7 if view == 'F' else -sw * .7), th[1] - .5)
            dz = (.9 if view == 'F' else -2.2)
            self.vol_at(cv, self.sac_blobs(k, P.get('glow', 0)), pos, hz + dz, view, 'sac', R=Rot(lean=8 * sw))
        # acid drool from the jaw
        if view == 'F' and P.get('_anim') not in ('die',):
            d = P.get('drool', 0)
            ln = [2, 3, 4, 3, 2, 3, 4, 5][d % 8]
            x0, y0 = int(round(mo[0])), int(round(mo[1])) + 2
            for t in range(ln):
                cv.put(x0 + (1 if t > 2 and d % 2 else 0), y0 + t, ('acid', 3 if t < ln - 1 else 4), hz + 2, 'drool')
        if P.get('glob'):
            d = 1 if view == 'F' else -1
            gx, gy = int(round(mo[0])) + 5 * d, int(round(mo[1])) + (-1 if view == 'F' else -3)
            gx = max(3, min(self.w - 3, gx))
            # a fat acid glob with a bright core, and two drops trailing back to the lips
            ball = [(-1, -2, 3), (0, -2, 3), (-2, -1, 3), (-1, -1, 4), (0, -1, 4), (1, -1, 2), (-2, 0, 3), (-1, 0, 4), (0, 0, 3),
                    (1, 0, 2), (-1, 1, 2), (0, 1, 2), (1, 1, 1), (-2, 1, 2)]
            for (ox, oy, t) in ball:
                cv.put(gx + ox * d, gy + oy, ('acid', t), hz + 3, 'glob')
            for (ox, oy) in ((-3, 1), (-5, 1)):
                cv.put(gx + ox * d, gy + oy, ('acid', 3), hz + 3, 'glob')
            meta['mouth'] = [gx, gy]
        if P.get('burst'):
            # the sac pops: acid splashes and pools
            b = P['burst']
            th2 = (int(round(th[0])), int(round(th[1])))
            if b == 1:
                pts = [(2, -2), (3, 0), (-2, -1), (1, 2), (4, 2), (-1, 3), (3, -3), (0, -3)]
            else:
                pts = [(-4, 1), (-3, 1), (-2, 1), (-1, 1), (0, 1), (-3, 2), (-2, 2), (-1, 2), (0, 2), (1, 2)]
                th2 = (int(round(J['neck'][0])), self.ay + 1)
            for (ox, oy) in pts:
                cv.put(th2[0] + ox, th2[1] + oy, ('acid', 2 if (ox + oy) % 2 else 3), -50 if b > 1 else hz + 2, 'acid')

    def after(self, cv, P, view, meta):
        if P.get('spitflash') and 'mouth' in meta:
            mx, my = meta['mouth']
            sparkle(cv, [(mx + (2 if view == 'F' else -2), my), (mx + (3 if view == 'F' else -3), my - 1)], ('acid', 4))

# ============================================================== SCREAMER
class Screamer(Mutant):
    """emaciated, very long arms, a wild black mane, pale skin and a huge unhinged mouth; screams to buff the horde"""
    name = 'screamer'
    w = h = 32
    ax, ay = 15, 27
    ANIMS = {'walk': (8, 8, True), 'attack': (5, 9, False), 'die': (6, 8, False), 'hit': (1, 8, False), 'scream': (4, 8, True)}
    hdz = {'F': 1.6, 'B': 1.2}

    pz = -2.8
    lay_shift = (1, -2)
    def setup(self):
        self.mats = {
            'skn': ramp((184, 188, 174), cool=(66, 62, 118)),
            'drs': ramp((74, 66, 90)),
            'hair': ramp((54, 46, 62), warm=(150, 140, 170)),
            'mouth': ramp((86, 20, 34)),
            'bone': ramp((226, 220, 196)),
            'eye': flat((236, 250, 255)),
            'nail': ramp((70, 56, 70)),
            'ring': flat((250, 246, 214)),
        }
        self.legend({'skn': '12345', 'drs': 'abcde', 'hair': 'hijk ', 'mouth': 'MNR  ', 'bone': ' w W ', 'eye': '  E  '})
        self.T['base'] = {
            'F': Bmp("""
                ....344....
                ..3445543..
                .34452443a.
                3452324cdb.
                4432cddccb.
                3423cdccbb.
                .332ccccba.
                ..2bccbcba.
                ..bcbcbba..
                ..cbbcbaa..
                ..b.cb.ba..
            """, hip=(5, 8), neck=(5, 0), shN=(1, 3), shF=(8, 2), hpN=(4, 9), hpF=(7, 8)),
            'B': Bmp("""
                ....443....
                ..3455443..
                .3454344b3.
                34324233cb2
                4432c23cbb.
                3ccccc2cbb.
                .cdccbcbba.
                ..cccbcbba.
                ..bcbcbba..
                ..cbbcbaa..
                ..b.bc.ba..
            """, hip=(5, 8), neck=(5, 0), shN=(1, 3), shF=(9, 2), hpN=(4, 9), hpF=(7, 8)),
        }
        self.H['base'] = {
            'F': Bmp("""
                .hhijhihhh..
                hhijkjiihh.h
                .hijii3443h.
                hhii2E34E2..
                .hhi23MM32..
                hhih2MRRM2..
                .hh.2MRRM2..
                .h..2WMMW...
                ....12MM2...
                .....122....
            """, neck=(5, 9), top=(6, 0), mouth=(7, 6)),
            'B': Bmp("""
                hih.hjh.hh.
                .hijjkjihh.
                hhijkkjiihh
                .hiijkjiih.
                hhiijjjiihh
                .hhiijiihh.
                h.hhihhih.h
                ..h.hh.hh..
                ....12.....
            """, neck=(5, 8), top=(5, 0), mouth=(2, 6)),
        }
        self.H['scream'] = {
            'F': Bmp("""
                hhihhihhhh..
                .hijjiiihhh.
                hhijii3443h.
                .hii2E34E2.h
                hhh23MMMM2..
                .hh2MRRRRM..
                hh.2MRNNRM..
                .h.2MRRRRM..
                ...2WMMMMW..
                ....2MMMM2..
                .....2112...
            """, neck=(5, 10), top=(6, 0), mouth=(7, 6)),
            'B': self.H['base']['B'],
        }
        self.H['dead'] = {
            'F': Bmp("""
                .hhihhihhh..
                hhijjiiihh.h
                .hijii3443h.
                hhii2134132.
                .hhi23MM32..
                hhih2MNNM2..
                .hh.2MNNM2..
                .h..2WMMW...
                ....12MM2...
                .....122....
            """, neck=(5, 9), top=(6, 0), mouth=(7, 6)),
            'B': self.H['base']['B'],
        }

    def arm_spec(self, P, side):
        return dict(up=5.4, fore=5.6, mat_u='skn', mat_f='skn', wf=2,
                    vol=([(.08, .85, .16, 0.0), (.5, .62, .42, 0.0), (.97, .8, .1, .25)],
                         [(.18, .7, .2, .1), (.55, .55, .42, 0.0), (.96, .62, .08, 0.0)]))

    def leg_spec(self, P, side):
        return dict(th=5.2, sh=5.0, ankle=1.2, mat_t='skn', mat_s='skn',
                    vol=([(.3, .95, .34, -.1, 'drs'), (.62, .72, .3, 0.0), (.97, .85, .1, -.25)],
                         [(.3, .75, .3, .3), (.62, .58, .34, 0.0), (.95, .62, .1, 0.0)]))

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'skn', 'nail', [(-22, 2.5), (6, 3.0), (32, 2.5)], palm=2, ctone=1, ftone=2)

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'skn', length=2.0)

    def pose(self, anim, i, view):
        if anim == 'walk':
            # a lurch: long uneven steps, the torso rolls side to side and the long arms swing wide and low
            fN, fF = walk8(i, step=1.25, lift=(.8, 1.6, .8), spread=1.0)
            bob = cyc([0, 1, 1, 0, 0, 1, 0, 0], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(.2, 0, 10.6 - bob), lean=6, roll=cyc([-3, -2, 0, 2, 3, 2, 0, -2], i), hlean=cyc([8, 10, 6, 4, 8, 12, 8, 4], i),
                        arms={'N': dict(ha=(1.2 + 2.6 * sw, 1.2, -8.8)), 'F': dict(ha=(1.2 - 2.6 * sw, -1.0, -8.8))},
                        legs={'N': dict(ft=fN[:3], heel=fN[3]), 'F': dict(ft=fF[:3], heel=fF[3])})
        stance = {'N': dict(ft=(1.6, 1.1, 0)), 'F': dict(ft=(-1.2, -1.1, 0))}
        if anim == 'attack':
            # both endless arms rise high and rake down in front
            return dict(pel=(-.4 + [0, -.4, .6, .8, .4][i], 0, [10.2, 10.4, 9.8, 9.4, 10.2][i]), lean=[-4, -10, 14, 18, 8][i],
                        hlean=[0, -8, 10, 14, 6][i], head=['base', 'scream', 'scream', 'base', 'base'][i],
                        arms={'N': dict(ha=[(-1.6, 1.8, 4.0), (-3.2, 1.6, 4.6), (6.0, .6, .6), (6.0, .4, -4.0), (3.2, .8, -7.4)][i]),
                              'F': dict(ha=[(-1.2, -1.6, 4.4), (-2.8, -1.4, 4.8), (6.2, -.2, 1.4), (6.2, -.2, -3.4), (2.8, -.6, -7.6)][i])},
                        legs={'N': dict(ft=(2.2, 1.1, 0)), 'F': dict(ft=(-1.4, -1.1, 0))})
        if anim == 'scream':
            k = i
            return dict(pel=(-.2, 0, 9.4 + (.4 if k in (1, 2) else 0)), lean=[-6, -10, -6, -6][k], hlean=[-12, -20, -12, -12][k],
                        head=['base', 'scream', 'scream', 'scream'][k], rings=[0, 1, 2, 3][k], shake=[0, 0, 1, -1][k],
                        arms={'N': dict(ha=[(-1.4, 3.6, -6.4), (-1.0, 5.4, -3.2), (-.6, 6.2, -2.0), (-.6, 6.2, -1.6)][k]),
                              'F': dict(ha=[(-1.4, -3.4, -6.4), (-1.0, -5.2, -3.0), (-.6, -6.0, -1.8), (-.6, -6.0, -1.4)][k])},
                        legs={'N': dict(ft=(1.0, 2.0, 0)), 'F': dict(ft=(-.6, -2.0, 0))})
        if anim == 'hit':
            return dict(pel=(-.4, 0, 9.8), lean=-12, hlean=-20, head='scream',
                        arms={'N': dict(ha=(-2.6, 2.0, -7.4)), 'F': dict(ha=(-2.2, -1.8, -7.6))}, legs=stance)
        if anim == 'die':
            if i == 0:
                return dict(pel=(-.2, 0, 9.8), lean=-16, hlean=-22, head='scream',
                            arms={'N': dict(ha=(-1.8, 2.8, 4.0)), 'F': dict(ha=(-1.6, -2.6, 4.4))}, legs=stance)
            if i == 1:
                return dict(pel=(-.6, 0, 8.2), lean=-28, hlean=-20, head='dead',
                            arms={'N': dict(ha=(-3.0, 4.0, 3.0)), 'F': dict(ha=(-2.6, -3.6, 3.6))},
                            legs={'N': dict(ft=(2.4, 1.1, 0)), 'F': dict(ft=(1.0, -1.1, 0))})
            return self.corpse(i, view)

    def draw(self, cv, P, view):
        sh = P.get('shake', 0)
        if sh:
            P['pel2'] = (round(self.S(P['pel'], view)[0] - self.ax) + sh, round(self.S(P['pel'], view)[1] - self.ay))
        return Mutant.draw(self, cv, P, view)

    def after(self, cv, P, view, meta):
        r = P.get('rings', 0)
        if not r or '_mouth' not in meta:
            return
        # sound-shake arcs fanning out from the mouth along the way the head faces (no outline, drawn last)
        mx, my = meta['_mouth']
        base = (1.0, .15) if view == 'F' else (-1.0, -.5)
        dx, dy = rot2(unit2(base), meta.get('_hdeg', 0))
        a0 = math.atan2(dy, dx)
        for k in range(1, r + 1):
            R = 2.5 + 3.2 * k
            prev = None
            for st in range(-9, 10):
                ang = a0 + math.radians(st * 5.5)
                q = (int(round(mx + R * math.cos(ang))), int(round(my + R * math.sin(ang))))
                if q == prev or abs(st) in (3,) and k > 1:
                    continue
                prev = q
                if q not in cv.px and 0 <= q[0] < cv.w and 0 <= q[1] < cv.h:
                    cv.fx[q] = ('ring', 2)

    def extras(self, cv, P, view, J, meta):
        if '_hm' in J:
            mo = J['_hm']('mouth')
            meta['_mouth'] = (mo[0], mo[1])
            sf = 1 if view == 'F' else -1
            meta['_hdeg'] = J['_tdeg'] + P.get('hlean', 0) * sf + P.get('hroll', 0)

# ============================================================== LEAPER
class Leaper(Mutant):
    """crouched lean predator with digitigrade legs, long bone blade claws and a spiked spine; purple-grey skin.
    The frame is 32x48 so the leap can lift well above the anchor; ground frames use the bottom 32 rows."""
    name = 'leaper'
    w, h = 32, 48
    ax, ay = 15, 43
    ANIMS = {'walk': (8, 12, True), 'attack': (5, 10, False), 'die': (6, 8, False), 'hit': (1, 8, False), 'leap': (5, 9, False)}
    hdz = {'F': 1.8, 'B': -1.0}
    sh_dz = 2.2

    pf = -3.0
    lay_shift = (2, -2)
    def setup(self):
        self.mats = {
            'skn': ramp((132, 112, 148), cool=(40, 34, 90)),
            'bone': ramp((228, 220, 194)),
            'eye': flat((255, 222, 60)),
            'mouth': ramp((70, 28, 44)),
            'pnt': ramp((70, 82, 96)),
        }
        self.legend({'skn': '12345', 'bone': ' wvWX', 'eye': '  E  ', 'mouth': 'MN   ', 'pnt': 'abcde'})
        self.T['base'] = {
            'F': Bmp("""
                ......W.W...
                ...W.3454W..
                ..334554443.
                .23444443332
                23433343332.
                2c33232322..
                ccb2323221..
                .bbc2221....
                ..bc11......
            """, hip=(2, 6), neck=(11, 3), shN=(8, 5), shF=(10, 2), hpN=(2, 7), hpF=(4, 6)),
            'B': Bmp("""
                ..W.W.......
                .W4543.W....
                .345545433..
                23445454433.
                .2344443332.
                ..23333322c.
                ...2222ccb..
                ....22cbbc..
                ......bc....
            """, hip=(8, 6), neck=(1, 2), shN=(2, 4), shF=(4, 1), hpN=(7, 7), hpF=(9, 6)),
        }
        self.H['base'] = {
            'F': Bmp("""
                ..23443..
                .2345554.
                23443E3E2
                .233222W2
                ..2NWNWNW
                ...12wwN.
            """, neck=(2, 4), top=(4, 0)),
            'B': Bmp("""
                ...W.W..
                ..34543.
                .2345543
                2344443.
                .23332..
                ..122...
            """, neck=(5, 5), top=(4, 0)),
        }
        self.H['dead'] = {
            'F': Bmp("""
                ..23443..
                .2345554.
                234431312
                .233222W2
                ..2NWNWNW
                ...12wwN.
            """, neck=(2, 4), top=(4, 0)),
            'B': self.H['base']['B'],
        }

    def arm_spec(self, P, side):
        return dict(up=4.6, fore=4.8, mat_u='skn', mat_f='skn', wf=2,
                    vol=([(.12, 1.2, .24, 0.0), (.48, .95, .32, -.3), (.45, 1.0, .3, .35), (.96, .78, .1, .3)],
                         [(.25, 1.0, .3, .2), (.6, .78, .32, 0.0), (.95, .68, .1, 0.0)]))

    def leg_spec(self, P, side):
        return dict(th=4.6, sh=4.4, mt=3.6, ankle=0)

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'skn', 'bone', [(-18, 4.0), (16, 3.5)], palm=2, ctone=3, blade=3,
                       curl=a.get('curl', .25))

    def leg(self, cv, P, view, side, J, Dt):
        """digitigrade: hip -> knee (forward) -> hock (back) -> toes"""
        spec = self.leg_spec(P, side)
        g = P['legs'][side]
        sgn = 1 if side == 'N' else -1
        hp2 = J['hp' + side]
        hpd = Dt + self.hp_dz * sgn
        ft = g['ft']
        hock3 = vadd(ft, g.get('hock', (-2.6, 0, 3.4)))
        hip3 = vadd(P['pel'], (0, self.hip_w * sgn, -.4))
        kn3 = ik3(hip3, hock3, spec['th'], spec['sh'], (1.0, 0, .3))
        H3, K3, C3 = self.S(hip3, view), self.S(kn3, view), self.S(hock3, view)
        mid = ((H3[0] + C3[0]) / 2, (H3[1] + C3[1]) / 2)
        bend2 = (K3[0] - mid[0], K3[1] - mid[1])
        if math.hypot(*bend2) < .3:
            bend2 = side_vec(view, (1, 0, 0))
        c2 = vadd((self.ax, self.ay), proj(hock3, view))
        k2 = ik2(hp2, c2, dist2(H3, K3), dist2(K3, C3), bend2)
        t2 = self.S(ft, view)
        kd, cd, td = (hpd + self.D(hock3, view)) / 2 + .8, self.D(hock3, view), self.D(ft, view)
        part = 'leg' + side
        back = side_vec(view, (-1, 0, 0))
        k3 = mvec(MVI[view], (k2[0] - hp2[0], k2[1] - hp2[1], kd - hpd))
        c3 = mvec(MVI[view], (c2[0] - hp2[0], c2[1] - hp2[1], cd - hpd))
        t3 = mvec(MVI[view], (t2[0] - hp2[0], t2[1] - hp2[1], td - hpd))
        blobs = self.muscles((0, 0, 0), k3, [(.32, 1.6, .34, -.1), (.95, 1.0, .12, -.2)], 'skn', view, sgn) + \
                self.muscles(k3, c3, [(.35, 1.0, .35, .3), (.95, .72, .1, 0.0)], 'skn', view, sgn) + \
                self.muscles(c3, t3, [(.5, .62, .48, 0.0)], 'skn', view, sgn)
        self.vol_at(cv, blobs, hp2, hpd, view, part)
        fwd = self.foot_dir(P, view, g)
        for k, ang in enumerate((-25, 15)):
            a = math.radians(ang)
            d = (fwd[0] * math.cos(a) - fwd[1] * math.sin(a), fwd[0] * math.sin(a) + fwd[1] * math.cos(a))
            for st in (1, 2):
                q = (int(round(t2[0] + d[0] * st)), int(round(t2[1] + d[1] * st * .6 + .4)))
                cv.put(q[0], q[1], ('bone', 2 if st == 2 else 1) if st == 2 else ('skn', 2), td + .3, 'claw' if st == 2 else part)
        J['kn2' + side], J['an2' + side] = k2, t2

    def pose(self, anim, i, view):
        if anim == 'walk':
            fN, fF = walk8(i, step=1.5, lift=(1.2, 2.2, 1.2), spread=1.4)
            bob = cyc([0, 1, 1, 0, 0, 1, 1, 0], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(-2.4, 0, 9.4 - bob), hlean=cyc([0, 4, 2, 0, 0, 4, 2, 0], i),
                        arms={'N': dict(ha=(3.6 + 1.6 * sw, .6, -5.0 - 1.0 * max(0, -sw))), 'F': dict(ha=(3.4 - 1.6 * sw, -.6, -5.0 - 1.0 * max(0, sw)))},
                        legs={'N': dict(ft=fN[:3]), 'F': dict(ft=fF[:3])})
        stance = {'N': dict(ft=(1.6, 1.4, 0)), 'F': dict(ft=(-1.4, -1.4, 0))}
        if anim == 'attack':
            return dict(pel=(-2.4 + [-.6, -.8, 1.0, 1.2, .4][i], 0, [8.6, 8.0, 9.6, 9.0, 9.2][i]), lean=[-6, -10, 14, 20, 6][i],
                        hlean=[-6, -10, 8, 12, 2][i],
                        arms={'N': dict(ha=[(.4, 1.2, 1.0), (-.6, 1.4, 2.6), (6.4, .6, -.6), (6.0, .4, -4.4), (3.6, .6, -5.0)][i], curl=.4),
                              'F': dict(ha=[(.8, -1.0, .4), (-.2, -1.2, 2.0), (6.4, -.4, .2), (6.2, -.4, -3.8), (3.4, -.6, -5.0)][i], curl=.4)},
                        legs={'N': dict(ft=(2.0, 1.4, 0)), 'F': dict(ft=(-1.6, -1.4, 0))})
        if anim == 'leap':
            # crouch, launch, airborne high above the anchor, descending, land
            pz = [6.4, 12.4, 27.0, 18.0, 7.0][i]
            pf = [-2.6, -1.8, -1.0, -.6, -1.4][i]
            P = dict(pel=(pf, 0, pz), lean=[12, -12, 22, 34, 18][i], hlean=[0, -8, 4, 10, 6][i])
            P['arms'] = {'N': dict(ha=[(2.4, 1.0, -3.6), (3.6, .8, 3.6), (5.6, .6, 1.4), (5.4, .6, -2.6), (3.0, 1.2, -4.0)][i], curl=.3),
                         'F': dict(ha=[(2.2, -1.0, -3.6), (3.4, -.8, 3.8), (5.4, -.6, 1.8), (5.2, -.6, -2.2), (2.8, -1.2, -4.0)][i], curl=.3)}
            if i == 0:
                P['legs'] = {'N': dict(ft=(1.0, 1.4, 0), hock=(-2.2, 0, 2.2)), 'F': dict(ft=(-.8, -1.4, 0), hock=(-2.2, 0, 2.2))}
            elif i == 1:
                P['legs'] = {'N': dict(ft=(-2.0, 1.4, 0), hock=(-1.2, 0, 3.2)), 'F': dict(ft=(-3.0, -1.4, .6), hock=(-1.2, 0, 3.2))}
            elif i == 2:
                P['legs'] = {'N': dict(ft=(-1.0, 1.4, pz - 7.8), hock=(-2.6, 0, 1.8)), 'F': dict(ft=(-1.8, -1.4, pz - 7.2), hock=(-2.6, 0, 1.8))}
            elif i == 3:
                P['legs'] = {'N': dict(ft=(2.0, 1.4, pz - 9.4), hock=(-1.4, 0, 3.0)), 'F': dict(ft=(1.0, -1.4, pz - 8.8), hock=(-1.4, 0, 3.0))}
            else:
                P['legs'] = {'N': dict(ft=(1.8, 1.4, 0), hock=(-2.0, 0, 2.4)), 'F': dict(ft=(-.6, -1.4, 0), hock=(-2.0, 0, 2.4))}
            return P
        if anim == 'hit':
            return dict(pel=(-3.0, 0, 9.0), lean=-14, hlean=-16,
                        arms={'N': dict(ha=(-1.6, 1.8, -3.4)), 'F': dict(ha=(-1.2, -1.6, -3.6))}, legs=stance)
        if anim == 'die':
            if i == 0:
                return dict(pel=(-2.8, 0, 9.4), lean=-18, hlean=-22, head='base',
                            arms={'N': dict(ha=(-.6, 2.0, 3.0)), 'F': dict(ha=(-.4, -1.8, 3.4))}, legs=stance)
            if i == 1:
                return dict(pel=(-3.0, 0, 7.4), lean=-30, hlean=-14, head='dead',
                            arms={'N': dict(ha=(-2.4, 3.0, 1.4)), 'F': dict(ha=(-2.0, -2.6, 2.0))},
                            legs={'N': dict(ft=(2.2, 1.4, 0)), 'F': dict(ft=(1.0, -1.4, 0))})
            return self.corpse(i, view, dict(dead=True))

    def draw(self, cv, P, view):
        if P.get('dead'):
            # lying: legs drawn in screen space (folded digitigrade legs)
            legs = P.pop('legs')
            meta = Mutant.draw(self, cv, P, view)
            J = self._J
            for side in ('N', 'F'):
                hp2 = self._tm('hp' + side)
                ft2 = (hp2[0] + legs[side]['an2r'][0], hp2[1] + legs[side]['an2r'][1])
                k2 = ((hp2[0] + ft2[0]) / 2 + 1, (hp2[1] + ft2[1]) / 2 - 3)
                c2 = ((k2[0] + ft2[0]) / 2 + 1, (k2[1] + ft2[1]) / 2 + 1.5)
                d = self._Dt + (1.3 if side == 'N' else -1.3)
                stroke(cv, hp2, k2, [(0, 4), (1, 3)], d, d, 'leg' + side, 'skn', rad=1.2)
                stroke(cv, k2, c2, [(0, 3), (1, 2)], d, d, 'leg' + side, 'skn', rad=1.0)
                stroke(cv, c2, ft2, 2, d, d, 'leg' + side, 'skn', rad=.8)
                cv.put(int(round(ft2[0])) + 1, int(round(ft2[1])), ('bone', 2), d + .3, 'claw')
            return meta
        return Mutant.draw(self, cv, P, view)

    def extras(self, cv, P, view, J, meta):
        self._J, self._tm, self._Dt = J, J['_tm'], J['_Dt']

# ============================================================== BURROWER
class Burrower(Mutant):
    """mole-like: a hunched back caked in mud and stones, a pointed pink snout with tiny eyes, huge spade claws.
    dig: dives in head first until only a dirt splash is left; emerge: bursts out of the ground."""
    name = 'burrower'
    w = h = 32
    ax, ay = 15, 27
    ANIMS = {'walk': (8, 9, True), 'attack': (5, 9, False), 'die': (6, 8, False), 'hit': (1, 8, False),
             'dig': (5, 9, False), 'emerge': (5, 9, False)}
    hdz = {'F': 1.8, 'B': -1.2}
    sh_dz = 2.4

    pf = -3.0
    lay_shift = (1, -2)
    def setup(self):
        self.mats = {
            'skn': ramp((112, 122, 96)),
            'mud': ramp((92, 68, 50), cool=(40, 30, 50), warm=(200, 160, 110)),
            'rock': ramp((150, 146, 140)),
            'clw': ramp((232, 212, 156), cool=(110, 80, 70)),
            'nose': ramp((214, 140, 142)),
            'eye': flat((236, 56, 46)),
            'mouth': ramp((60, 30, 34)),
            'hole': flat((40, 28, 26)),
        }
        self.legend({'skn': '12345', 'mud': 'abcde', 'rock': '  rR ', 'clw': ' wvW ', 'nose': '  nN ', 'eye': '  E  ', 'mouth': 'M    '})
        self.T['base'] = {
            'F': Bmp("""
                ....bcddc.....
                ..bcddedRdc...
                .bcdRdeddcdc..
                bccdddcdcRccb.
                bcdcccccdccbbb
                abccRcccbcbb32
                abbcbbbbbb3432
                .abbbbbba34322
                ..aabba23433..
                ...aa223332...
                .....12221....
            """, hip=(6, 9), neck=(13, 6), shN=(8, 8), shF=(12, 4), hpN=(5, 10), hpF=(8, 9)),
            'B': Bmp("""
                ....bcddcb....
                ..bcdeedRdcb..
                .bcdRdeddcdcb.
                bccddedcdcRccb
                bcdcddccdccbbb
                abccRcdccbcbba
                abbcbccbbbbbba
                .abbbbbbbbbaa.
                ..aabbbbbaa...
                ...a22222a....
                ....12221.....
            """, hip=(7, 9), neck=(2, 4), shN=(2, 7), shF=(6, 3), hpN=(6, 10), hpF=(9, 9)),
        }
        self.H['base'] = {
            'F': Bmp("""
                .2344...
                2345543.
                22E4443N
                .233322n
                ..1MwM1.
            """, neck=(1, 3), top=(3, 0)),
            'B': Bmp("""
                .bcdc.
                bcddcb
                23443b
                .2332.
                ..12..
            """, neck=(3, 4), top=(2, 0)),
        }
        self.H['dead'] = {
            'F': Bmp("""
                .2344...
                2345543.
                2214443N
                .233322n
                ..1MwM1.
            """, neck=(1, 3), top=(3, 0)),
            'B': self.H['base']['B'],
        }

    def arm_spec(self, P, side):
        return dict(up=3.0, fore=3.0, mat_u='skn', mat_f='skn', wf=3,
                    vol=([(.2, 1.5, .3, 0.0, 'mud'), (.7, 1.3, .3, 0.0)], [(.3, 1.3, .35, .1), (.8, 1.15, .25, 0.0)]))

    def leg_spec(self, P, side):
        return dict(th=3.6, sh=3.4, ankle=1.0, mat_t='skn', mat_s='skn',
                    vol=([(.35, 1.55, .36, 0.0, 'mud'), (.95, 1.1, .12, 0.0)], [(.4, 1.2, .35, .3), (.9, 1.0, .15, 0.0)]))

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        """huge spade claws: a broad palm and three thick curved claws"""
        L = math.hypot(*dv) or 1.0
        u = (dv[0] / L, dv[1] / L)
        c = (h2[0] + u[0] * .8, h2[1] + u[1] * .8)
        for (ox, oy) in BRUSH[3]:
            x, y = int(round(c[0])) + ox, int(round(c[1])) + oy
            cv.put(x, y, ('skn', 3 if ox + oy < 0 else 2), depth + .2, part)
        spread = a.get('spread', 1.0)
        for k, ang in enumerate((-34, 0, 34)):
            an = math.radians(ang * spread)
            d = (u[0] * math.cos(an) - u[1] * math.sin(an), u[0] * math.sin(an) + u[1] * math.cos(an))
            b0 = (c[0] + d[0] * 1.2, c[1] + d[1] * 1.2)
            curl = a.get('curl', .5)
            tip = (b0[0] + d[0] * 3.2 - d[1] * curl, b0[1] + d[1] * 3.2 + d[0] * curl + .6)
            stroke(cv, b0, tip, [(0, 2), (.6, 2), (1, 1)], depth + .4, depth + .6, 'claw', 'clw', rad=.3, bias=.05)

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'skn', toe='clw', length=1.8, width=3)

    def pose(self, anim, i, view):
        if anim == 'walk':
            fN, fF = walk8(i, step=1.25, lift=(.8, 1.4, .8), spread=1.4)
            bob = cyc([0, 1, 0, 0, 0, 1, 0, 0], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(-.6, 0, 7.4 - bob), roll=cyc([-3, -2, 0, 2, 3, 2, 0, -2], i),
                        arms={'N': dict(ha=(3.0 + 1.6 * sw, .8, -2.8 - .8 * max(0, sw))), 'F': dict(ha=(3.0 - 1.6 * sw, -.6, -2.8 - .8 * max(0, -sw)))},
                        legs={'N': dict(ft=fN[:3], heel=fN[3]), 'F': dict(ft=fF[:3], heel=fF[3])})
        stance = {'N': dict(ft=(1.0, 1.8, 0)), 'F': dict(ft=(-1.0, -1.8, 0))}
        if anim == 'attack':
            return dict(pel=(-.6 + [-.4, -.6, .8, 1.0, .2][i], 0, [7.6, 7.8, 7.0, 6.8, 7.2][i]), lean=[-8, -14, 16, 22, 4][i],
                        arms={'N': dict(ha=[(1.0, 1.0, 1.6), (.2, 1.2, 3.0), (4.6, .6, -1.6), (4.4, .4, -3.6), (3.0, .8, -3.0)][i], curl=.8),
                              'F': dict(ha=[(1.2, -.8, 1.8), (.4, -1.0, 3.2), (4.6, -.4, -1.2), (4.4, -.4, -3.2), (3.0, -.6, -2.8)][i], curl=.8)},
                        legs={'N': dict(ft=(1.4, 1.8, 0)), 'F': dict(ft=(-1.2, -1.8, 0))})
        if anim == 'hit':
            return dict(pel=(-1.0, 0, 7.4), lean=-14, hlean=-14,
                        arms={'N': dict(ha=(-.6, 1.6, -1.6)), 'F': dict(ha=(-.4, -1.4, -1.4))}, legs=stance)
        if anim == 'dig':
            # crouch, dive head first, sink until only the dirt splash is left
            sink = [0, 3, 9, 15, 30][i]
            return dict(pel=(-.4, 0, 7.0), lean=[6, 34, 44, 50, 50][i], hlean=[0, 16, 20, 20, 20][i], sink=sink, hole=[0, 1, 2, 2, 3][i],
                        clods=[0, 1, 2, 3, 4][i],
                        arms={'N': dict(ha=[(2.0, 1.0, 1.6), (4.0, .8, -3.4), (3.6, .8, -5.0), (3.6, .8, -5.0), (3.6, .8, -5.0)][i], curl=.8),
                              'F': dict(ha=[(2.2, -.8, 1.8), (4.2, -.6, -3.0), (3.8, -.6, -4.6), (3.8, -.6, -4.6), (3.8, -.6, -4.6)][i], curl=.8)},
                        legs=stance)
        if anim == 'emerge':
            sink = [30, 13, 7, 2, 0][i]
            return dict(pel=(-.4, 0, 7.0), lean=[0, -10, -6, 4, 0][i], hlean=[0, -16, -10, 0, 0][i], sink=sink, hole=[3, 3, 2, 1, 0][i],
                        clods=[5, 6, 7, 8, 9][i],
                        arms={'N': dict(ha=[(1.0, 1.0, 4.0), (1.0, 1.4, 5.4), (1.6, 1.6, 3.6), (2.6, 1.2, .2), (3.0, .8, -2.8)][i], curl=.6, spread=1.3),
                              'F': dict(ha=[(1.2, -.8, 4.2), (1.2, -1.4, 5.6), (1.8, -1.4, 3.8), (2.8, -1.0, .4), (3.0, -.6, -2.8)][i], curl=.6, spread=1.3)},
                        legs=stance)
        if anim == 'die':
            if i == 0:
                return dict(pel=(-.8, 0, 7.4), lean=-16, hlean=-20,
                            arms={'N': dict(ha=(-.6, 2.0, 2.0)), 'F': dict(ha=(-.4, -1.8, 2.4))}, legs=stance)
            if i == 1:
                return dict(pel=(-1.0, 0, 6.0), lean=-30, hlean=-14, head='dead',
                            arms={'N': dict(ha=(-1.4, 2.6, 1.6)), 'F': dict(ha=(-1.2, -2.4, 2.0))},
                            legs={'N': dict(ft=(2.0, 1.8, 0)), 'F': dict(ft=(1.0, -1.8, 0))})
            return self.corpse(i, view)

    def draw(self, cv, P, view):
        sink = P.get('sink', 0)
        meta = {}
        if sink < 26:
            if sink:
                p2 = self.S(P['pel'], view)
                P['pel2'] = (round(p2[0] - self.ax), round(p2[1] - self.ay) + sink)
                P['legs'] = {}
            meta = Mutant.draw(self, cv, P, view)
            if sink:
                # everything below the ground in the hole is hidden
                for q in [q for q in cv.px if q[1] > self.ay - 1]:
                    del cv.px[q]
                if 'head' in meta and meta['head'][1] > self.ay - 1:
                    del meta['head']
        return meta

    DIRT = [(-6, -3), (5, -4), (-3, -7), (7, -8), (-8, -9), (2, -11), (-5, -13), (6, -14), (-1, -16), (3, -6)]

    def after(self, cv, P, view, meta):
        h = P.get('hole', 0)
        A = (self.ax, self.ay)
        if h:
            rx, ry = [0, 6, 7, 7][h], [0, 2.4, 2.8, 2.8][h]
            # dark hole, then a ring of piled dirt in front of and behind it
            ring = {}
            for y in range(int(A[1] - ry - 3), int(A[1] + ry + 3)):
                for x in range(int(A[0] - rx - 4), int(A[0] + rx + 5)):
                    e_in = ((x - A[0]) / (rx - 1.5)) ** 2 + ((y - A[1]) / (ry - .9)) ** 2
                    e_out = ((x - A[0]) / (rx + 2.2)) ** 2 + ((y - A[1] + .6) / (ry + 1.6)) ** 2
                    if e_in <= 1:
                        if (x, y) not in cv.px or cv.px[(x, y)][2] == 'outline':
                            cv.px[(x, y)] = [('hole', 2), -60, 'hole', False]
                    elif e_out <= 1:
                        front = y >= A[1] - .5
                        lum = (1 if y < A[1] - ry else 0) + (1 if x < A[0] - 2 else 0) + (1 if hash01(x, y, 3) > .7 else 0)
                        tone = [1, 2, 3, 3][lum]
                        if front or (x, y) not in cv.px or cv.px[(x, y)][2] in ('outline',):
                            ring[(x, y)] = ('mud', tone)
            for q, k in ring.items():
                cv.px[q] = [k, 99, 'dirt', False]
            # re-outline the dirt pile
            add = []
            for (x, y), v in cv.px.items():
                if v[2] == 'dirt':
                    for q in nb4(x, y):
                        if q not in cv.px and 0 <= q[0] < cv.w and 0 <= q[1] < cv.h:
                            add.append(q)
            for q in add:
                cv.px[q] = ['o', -99, 'outline', False]
        # flying clods
        n = P.get('clods', 0)
        if n:
            k0 = n % 5
            for j, (dx, dy) in enumerate(self.DIRT[:3 + 2 * (n % 5)]):
                if (j + n) % 3 == 0 and n >= 4:
                    continue
                d = 1 if view == 'F' else -1
                x, y = A[0] + int(dx * (.6 + .15 * k0)) * d, A[1] - 2 + int(dy * (.4 + .18 * k0))
                if n == 4 or n == 9:
                    y = A[1] - 1 + (j % 3) - 1
                    x = A[0] + (dx // 2) * d
                for (ox, oy, t) in ((0, 0, 3), (1, 0, 2), (0, 1, 1)):
                    if (x + ox, y + oy) not in cv.px:
                        cv.px[(x + ox, y + oy)] = [('mud', t), 98, 'clod', False]
            add = []
            for (x, y), v in cv.px.items():
                if v[2] == 'clod':
                    for q in nb4(x, y):
                        if q not in cv.px and 0 <= q[0] < cv.w and 0 <= q[1] < cv.h:
                            add.append(q)
            for q in add:
                cv.px[q] = ['o', -99, 'outline', False]

# ============================================================== GIANT
def frame_of(dirv, up=(0.0, 0.0, 1.0)):
    """rotation whose local z points along dirv (local x roughly 'up' cross dirv)"""
    z = vnorm(dirv)
    h = up if abs(dot(up, z)) < .95 else (1.0, 0.0, 0.0)
    x = vnorm((h[1] * z[2] - h[2] * z[1], h[2] * z[0] - h[0] * z[2], h[0] * z[1] - h[1] * z[0]))
    y = (z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0])
    return ((x[0], y[0], z[0]), (x[1], y[1], z[1]), (x[2], y[2], z[2]))

class Giant(Mutant):
    """towering plated brute with calloused grey hide, dragging a broken concrete slab by its rebar"""
    name = 'giant'
    w = h = 48
    ax, ay = 23, 43
    ANIMS = {'walk': (8, 5, True), 'attack': (5, 6, False), 'die': (6, 7, False), 'hit': (1, 6, False)}
    hdz = {'F': 2.4, 'B': -1.0}
    sh_dz, hp_dz, hip_w = 4.0, 2.4, 2.8
    grad = .2

    lay_shift = (2, -2)
    def setup(self):
        self.mats = {
            'hide': ramp((132, 132, 126), cool=(50, 46, 80)),
            'plate': ramp((150, 156, 160), cool=(56, 56, 90), warm=(240, 236, 210)),
            'pnt': ramp((72, 58, 52)),
            'rope': ramp((150, 124, 80)),
            'conc': ramp((170, 166, 156), cool=(70, 66, 90)),
            'rebar': ramp((150, 84, 50)),
            'eye': flat((255, 150, 50)),
            'mouth': ramp((64, 30, 36)),
            'bone': ramp((226, 218, 190)),
            'dust': ramp((200, 190, 170)),
        }
        self.legend({'hide': '12345', 'plate': 'ABCDE', 'pnt': 'abcde', 'rope': 'fghij', 'eye': '  Y  ', 'mouth': 'MN   ', 'bone': ' w W '})
        self.T['base'] = {
            'F': Bmp("""
                ..........DDDC.........
                .......DDDADDCCCCEDDC..
                .....DEEEEADDCCABDEDCB.
                ....DEEEEADDCCABBAEDCCB
                ...DEEEEADDCCCBBABDCCBA
                ...EEEEEDDCCCBBAABCCBBA
                ...DEEDDDCCCBBAA3CBBBAA
                ...CCCDCCCBBBAA3223AAA.
                ..DDDCBBBBBAAA332332...
                .EEEDDCAAAA433332321...
                DEEEDDCB333223321211...
                DDDDDCCB55433122211....
                CDDCCCBA5433212111.....
                CCCCBBBA443322211......
                BBBBBAA3433222111......
                .AAAA233322221111......
                ...23332222211111......
                ..hhihhihhhhgggf.......
                .dddcdcccccbbbba.......
                .ddcccccbbbbaaa........
                .dccccbbbbbaaaa........
                .cccbbbbaaaaaa.........
                .bcccbbbbaaaa..........
                ..bb.bbaa.a............
            """, hip=(7, 20), neck=(14, 8), shN=(3, 12), shF=(18, 5), hpN=(5, 21), hpF=(11, 19)),
            'B': Bmp("""
                .................DCDC...
                ............DDDDCCDDDC..
                ..........DEEDADDCCACCB.
                ........DEEEADDDCACBBCB.
                .......DEEEEEDDCCCBBABBA
                ......DEEEEEDDCCCBBAABA.
                ......DEEEEDDCCCBBAA2AA.
                ...DDCCEEDDCCCBBAAA232..
                .EEEEDCCCCCCBBBAAA3212..
                DEEEEDCCBBBBAAAA332221..
                DDEEDDCBAAAAA423322211..
                CDDDDCCBA4333233222111..
                CCCCCCBBA3322332221111..
                .BBBBBBA33321222111111..
                ..ABAAAA333221211111....
                ....AA13332211111111....
                ......33322222211121....
                ......33322222222211....
                ......33322222222211....
                .......hhihhihhhhgggf...
                .......dddcccccccbbba...
                ........ddcccccccbbaa...
                ........dcccccbbbbbaa...
                ........cccccbbbbaaa....
                ........bcccbbbaaaa.....
                .........bb.bbaa.a......
            """, hip=(14, 22), neck=(8, 4), shN=(4, 12), shF=(19, 4), hpN=(11, 23), hpF=(17, 21)),
        }
        self.H['base'] = {
            'F': Bmp("""
                ..BCDCB...
                .BCDDDCB..
                .2BCCCB32.
                233344433.
                22211Y11Y2
                .2333322N2
                .23WMMMWM.
                ..2wM2Mw..
                ...1222...
            """, neck=(3, 7), top=(4, 0)),
            'B': Bmp("""
                ..BCDCB..
                .BCDEDCB.
                BCDDDDCBA
                2BCCCCBA2
                23BBBBA32
                .2333332.
                ..22221..
                ...111...
            """, neck=(5, 7), top=(4, 0)),
        }
        self.H['dead'] = {
            'F': Bmp("""
                ..BCDCB...
                .BCDDDCB..
                .2BCCCB32.
                233344433.
                2221111112
                .2333322N2
                .23WMMMWM.
                ..2wM2Mw..
                ...1222...
            """, neck=(3, 7), top=(4, 0)),
            'B': self.H['base']['B'],
        }

    def arm_spec(self, P, side):
        def fore(t, s, ss, tone):
            # calloused plates on the outside of the forearm
            if t > .15 and t < .8 and s < -.2:
                return ('plate', min(4, tone + (0 if int(t * 6) % 2 else -1)))
            return ('hide', tone)
        return dict(up=8.6, fore=9.0, mat_u='hide', mat_f='hide', rad=2.4, wf=6,
                    vol=([(.06, 2.9, .2, 0.0, 'plate'), (.45, 2.3, .32, -.7), (.42, 2.5, .34, .8), (.96, 1.9, .12, .6)],
                         [(.25, 2.4, .3, .3), (.36, 1.7, .26, 1.3, 'plate'), (.62, 1.9, .3, 0.0), (.93, 1.6, .14, 0.0)]))

    def leg_spec(self, P, side):
        def shin(t, s, ss, tone):
            hem = .22 + (.12 if int((s + 1) * 2.5) % 2 else 0)
            return ('pnt', max(0, tone - 1)) if t < hem else ('hide', tone)
        return dict(th=8.4, sh=8.0, ankle=2.0, mat_t='hide', mat_s='hide', rad=2.6,
                    vol=([(.28, 3.3, .3, -.2, 'pnt'), (.62, 2.8, .3, -.1), (.97, 2.1, .14, -.5, 'plate')],
                         [(.3, 2.6, .3, .8), (.48, 1.8, .4, -.4, 'plate'), (.93, 1.9, .14, 0.0)]))

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'hide', 'bone', [(-30, 2.0, False), (0, 2.0, False), (30, 2.0, False)], palm=5)

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'hide', toe='bone', length=3.0, width=4, back_len=.6)

    def pose(self, anim, i, view):
        if anim == 'walk':
            fN, fF = walk8(i, step=1.25, lift=(1.4, 2.6, 1.4), spread=1.8)
            bob = cyc([0, 2, 1, 0, 0, 2, 1, 0], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(-.4, 0, 17.6 - bob), roll=cyc([-2, -2, 0, 1, 2, 2, 0, -1], i),
                        arms={'N': dict(ha=(-1.2 + .6 * sw, 2.4, -15.0)), 'F': dict(ha=(2.0 - 2.4 * sw, -1.2, -14.4))},
                        legs={'N': dict(ft=fN[:3], heel=fN[3]), 'F': dict(ft=fF[:3], heel=fF[3])}, slab=('drag', i))
        stance = {'N': dict(ft=(2.6, 2.6, 0)), 'F': dict(ft=(-2.0, -2.6, 0))}
        if anim == 'attack':
            # slow two-handed overhead smash: heave the slab up, hold it high behind the head, bring it down,
            # impact with dust, drag it back
            pz = [16.4, 15.6, 14.6, 14.2, 16.0][i]
            P = dict(pel=(-1.6 + [-.4, -.6, .4, .6, 0][i], 0, pz), lean=[-4, -8, 10, 14, 4][i], hlean=[-6, -12, 8, 12, 2][i],
                     legs={'N': dict(ft=(2.8, 1.8, 0)), 'F': dict(ft=(-2.2, -1.8, 0))}, slab=('atk', i), dust=(i == 3))
            hands = [(1.2, -1.6, 2.6), (1.4, -2.6, 5.4), (6.4, -1.4, -3.0), (6.8, -1.2, -6.0), (3.8, -.6, -9.0)][i]
            P['arms'] = {'N': dict(ha=hands), 'F': dict(grip='N', goff=(1.5, -.5))}
            return P
        if anim == 'hit':
            return dict(pel=(-1.2, 0, 17.2), lean=-10, hlean=-14, slab=('drag', 0),
                        arms={'N': dict(ha=(-2.2, 2.6, -14.4)), 'F': dict(ha=(-1.6, -2.4, -14.0))}, legs=stance)
        if anim == 'die':
            if i == 0:
                return dict(pel=(-1.0, 0, 17.0), lean=-12, hlean=-18, slab=('drop', 0),
                            arms={'N': dict(ha=(-1.6, 3.6, -12.0)), 'F': dict(ha=(-1.4, -3.2, -12.4))}, legs=stance)
            if i == 1:
                return dict(pel=(-.6, 0, 12.4), lean=10, hlean=10, head='dead', slab=('drop', 1),
                            arms={'N': dict(ha=(3.0, 3.6, -9.6)), 'F': dict(ha=(3.4, -3.0, -9.6))},
                            legs={'N': dict(ft=(2.6, 2.6, 0)), 'F': dict(ft=(1.0, -2.6, 0))})
            return self.corpse(i, view, dict(slab=('drop', i)))

    def slab(self, cv, view, grip2, gd, dirv, part='slab'):
        """broken concrete slab with rebar rods sticking out of the gripped end"""
        L = 4.4
        def tex(p, key, n):
            m, t = key
            h = hash01(int(p[0] * 2 + 50), int(p[1] * 2 + 50), int(p[2] * 2 + 50))
            if h > .86:
                return (m, max(0, t - 1))
            if abs(p[1] - .4 * p[2] + .6) < .22 and p[2] > -1.0:
                return (m, max(0, t - 2))
            return (m, t)
        R = frame_of(dirv, up=(0, 1, 0))
        c = vmul(vnorm(dirv), L + 1.2)
        b = [Blob(c, (1.1, 2.4, L), 'conc', rot=R, kind='b', tex=tex, groove=False)]
        self.vol_at(cv, b, grip2, gd - .6, view, part)
        u = vnorm(dirv)
        for k, off in enumerate((-1.2, 0.0, 1.1)):
            side3 = mvec(R, (0, off, 0))
            a3 = vadd(side3, vmul(u, 1.6))
            b3 = vadd(side3, vmul(u, -1.4 - .5 * k))
            pa, pb = vadd(grip2, proj(a3, view)), vadd(grip2, proj(b3, view))
            line_px(cv, pa, pb, ('rebar', 2 if k != 1 else 3), gd - .2, 'rebar')

    def extras(self, cv, P, view, J, meta):
        sl = P.get('slab')
        if not sl or 'ha2N' not in J:
            if sl and sl[0] == 'drop' and sl[1] >= 2:
                pass
            else:
                return
        kind, i = sl
        if kind == 'drag':
            self.slab(cv, view, J['ha2N'], J['hadN'], (-.62, .32, -.72) if view == 'F' else (-.25, .55, -.8))
        elif kind == 'atk':
            d = [(-.5, .2, .85), (-.95, .15, .3), (.86, .1, -.5), (.9, .1, -.44), (.5, .2, -.85)][i]
            self.slab(cv, view, J['ha2N'], J['hadN'] + (0 if i < 2 else 1.0), d)
            if P.get('dust'):
                end = vadd(J['ha2N'], proj(vmul(vnorm(d), 11.0), view))
                for (dx, dy, t) in ((-4, 0, 3), (-3, -1, 2), (4, 0, 3), (5, -1, 2), (-2, -3, 3), (3, -3, 2), (0, -4, 3), (-6, -1, 2), (6, 0, 2)):
                    cv.put(int(round(end[0] + dx)), int(round(end[1] + dy)), ('dust', t), 90, 'dust')
        elif kind == 'drop':
            # the slab slips out of the hand and lies on the ground behind the body
            g = (self.ax + 6, self.ay - 1) if i >= 2 else J['ha2N']
            gd = -5 if i >= 2 else J['hadN']
            self.slab(cv, view, g, gd, (-.55, .25, -.8) if i < 2 else (.3, -1.0, 0.0))

# ============================================================== BOSS
class Boss(Mutant):
    """'Abomination': several bodies fused into one mass, four arms, bone spikes, an opened ribcage with a glowing core
    and a crown-like bone crest on the main head"""
    name = 'boss'
    w = h = 48
    ax, ay = 23, 43
    ANIMS = {'walk': (8, 5, True), 'attack': (5, 6, False), 'die': (6, 7, False), 'hit': (1, 6, False), 'stomp': (6, 7, False)}
    hdz = {'F': 2.6, 'B': -1.4}
    sh_dz, hp_dz, hip_w = 4.4, 2.6, 3.0
    grad = .2

    lay_shift = (2, -2)
    def setup(self):
        self.mats = {
            'fl': ramp((128, 98, 124), cool=(44, 30, 80)),
            'gs': ramp((122, 140, 100)),
            'raw': ramp((170, 50, 62)),
            'bone': ramp((230, 222, 196)),
            'core': [(176, 54, 34), (232, 104, 36), (255, 164, 44), (255, 222, 100), (255, 252, 214)],
            'coreD': [(70, 30, 30), (96, 40, 36), (120, 52, 40), (140, 64, 44), (160, 80, 52)],
            'eye': flat((255, 236, 120)),
            'eye2': flat((236, 244, 230)),
            'mouth': ramp((60, 22, 34)),
            'dust': ramp((196, 184, 164)),
        }
        self.legend({'fl': '12345', 'gs': 'abcde', 'raw': 'rstuv', 'bone': ' klWZ', 'core': 'CDFGH', 'eye': '  Y  ', 'eye2': '  y  ', 'mouth': 'MN   '})
        tF = Bmp("""
            ..........4433...4443...
            .......4444443334555432.
            .....455544443323555433.
            ....45555444332225544321
            ...455554443332123433321
            ...45554433322113323221.
            ...45544333221243321111.
            ...2322332223443332211..
            .5554331224444433322....
            45555433455444333221....
            45554432254443332221....
            44444332334333322211....
            3333332113333222111.....
            2233221123322221111.....
            .222111c22221111111.....
            ..ddecdcb1111111121.....
            .cddcdccba111112211.....
            .ccccccbaa22322111......
            ..cccbbaaa2222111.......
            ..bbbbaaa2211111........
            ..3aaaaa11111111........
            ...333333322111.........
            ....222221111...........
            .......11...............
        """, hip=(9, 19), neck=(14, 6), shN=(3, 10), shF=(19, 4), hpN=(6, 21), hpF=(13, 18),
             xa1=(4, 18), xa2=(20, 7), sp1=(7, 2), sp2=(11, 0), sp3=(17, 1), sp4=(2, 8), sp5=(22, 3), mouth2=(5, 16))
        tF.patch([
            (12, 7, 'srrrs'), (11, 8, 'srCCCrs'), (10, 9, 'srCDFDCrs'), (10, 10, 'rCDFGFDCr'), (10, 11, 'rCDFHFDCr'),
            (10, 12, 'srCDFDCrs'), (11, 13, 'srCCCrs'), (12, 14, 'srrrs'),
            (12, 8, 'l'), (12, 9, '.W'), (12, 10, '.l'), (12, 11, '.l'), (12, 12, 'l'),
            (17, 9, 'W'), (17, 10, 'l'), (17, 11, 'l'), (17, 12, 'k'),
            (1, 14, 'rssr'), (8, 14, 's'), (9, 15, 'r'), (10, 16, 's'), (10, 17, 'rs'),
            (1, 15, 'cyMy'), (1, 16, 'cdMNd'), (2, 17, 'cMNMc'), (3, 18, 'cMc'),
            (3, 2, '.5'), (4, 3, '55'), (9, 1, '5'), (20, 1, '55'),
        ])
        tB = Bmp("""
            .................45443..
            ................3455443.
            ..............4444334432
            ............444444332332
            ..........45554443332221
            ........3555554443322111
            .......3455554433322111.
            ....43345555443332211t..
            ..555433454433322111st..
            .5555443233332221111tss.
            45555433212221111111sss.
            34444332122111111211tsr.
            3333332212222122111sssr.
            .222221113322211111ssrr.
            .d11111122221111111rrr..
            .ddddccc111111111211....
            .ccccccbba2122222112....
            .cccccbba323322111233...
            ..bbbbbaa3222211133322..
            ...aaaaa22111124443321..
            .....a.32233454433321...
            .......45555544332211...
            .......345444332211.....
            ........3333222111......
            .........111111.........
        """, hip=(14, 21), neck=(9, 4), shN=(4, 11), shF=(20, 3), hpN=(10, 23), hpF=(17, 20),
             xa1=(3, 17), xa2=(21, 9), sp1=(18, 0), sp2=(13, 2), sp3=(9, 5), sp4=(3, 8), sp5=(22, 4), mouth2=(2, 15))
        # a glowing fissure along the spine so the core reads from behind too
        tB.patch([(14, 5, 'r'), (13, 6, 'rC'), (12, 7, 'rDr'), (12, 8, 'CFr'), (11, 9, 'rDr'), (11, 10, 'rC'), (10, 11, 'rCr'), (10, 12, 'r'),
                  (2, 15, 'cdc'), (1, 16, 'cdc')])
        self.T['base'] = {'F': tF, 'B': tB}
        self.H['base'] = {
            'F': Bmp("""
                .W...W...W.
                .Wl.lWl.lW.
                .lWllWllWl.
                ..klllllk..
                .23444443..
                2334544432.
                2221Y21Y12.
                .233222332.
                .2MWMWMWM2.
                ..2MNNNM2..
                ...12221...
            """, neck=(4, 10), top=(5, 0)),
            'B': Bmp("""
                .W...W...W.
                .Wl.lWl.lW.
                .lWllWllWl.
                ..klllllk..
                .23444443..
                2334544432.
                2334443322.
                .233333322.
                .22333322..
                ..222221...
                ...1111....
            """, neck=(6, 10), top=(5, 0)),
        }
        self.H['dead'] = {
            'F': self.H['base']['F'].mirrored().mirrored().patch([(3, 6, '1'), (4, 6, '1'), (7, 6, '1')]),
            'B': self.H['base']['B'],
        }

    def arm_spec(self, P, side):
        return dict(up=9.0, fore=9.6, mat_u='fl', mat_f='fl', rad=2.6, wf=7,
                    vol=([(.1, 3.1, .24, 0.0), (.45, 2.5, .3, -.6), (.42, 2.6, .32, .8, 'raw'), (.96, 2.0, .12, .7)],
                         [(.24, 2.7, .3, .3), (.4, 1.6, .2, 1.4, 'gs'), (.62, 2.1, .3, 0.0), (.93, 1.8, .13, 0.0)]))

    def leg_spec(self, P, side):
        return dict(th=6.6, sh=6.4, ankle=2.0, mat_t='fl', mat_s='fl', rad=2.8,
                    vol=([(.32, 3.4, .36, -.2), (.6, 2.6, .3, .6, 'gs'), (.97, 2.3, .13, -.5)],
                         [(.3, 2.8, .3, .9), (.5, 2.1, .38, -.3), (.93, 2.1, .13, 0.0)]))

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'fl', 'bone', [(-30, 3.0), (0, 3.5), (30, 3.0)], palm=5, ctone=3, blade=2, curl=a.get('curl', .3))

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'fl', toe='bone', length=3.4, width=5, back_len=1.6)

    def pose(self, anim, i, view):
        if anim == 'walk':
            fN, fF = walk8(i, step=1.25, lift=(1.4, 2.4, 1.4), spread=2.0)
            bob = cyc([0, 2, 1, 0, 0, 2, 1, 0], i)
            sw = cyc([-1, -.5, 0, .5, 1, .5, 0, -.5], i)
            return dict(pel=(-.2, 0, 13.6 - bob), roll=cyc([-3, -2, 0, 2, 3, 2, 0, -2], i), pulse=i % 4,
                        arms={'N': dict(ha=(2.6 + 2.0 * sw, 2.6, -14.0)), 'F': dict(ha=(2.4 - 2.0 * sw, -2.2, -14.0))},
                        xarms={1: (2.4 - 1.2 * sw, 1.4, -5.0), 2: (1.6 + 1.0 * sw, -2.0, 4.0 + sw)},
                        legs={'N': dict(ft=fN[:3], heel=fN[3]), 'F': dict(ft=fF[:3], heel=fF[3])})
        stance = {'N': dict(ft=(2.0, 2.0, 0)), 'F': dict(ft=(-1.6, -2.0, 0))}
        if anim == 'attack':
            # both main arms come down together, the small arms flail
            hz = [3.6, 5.6, -4.0, -8.4, -11.4][i]
            hf = [0.0, -1.0, 6.4, 7.0, 4.0][i]
            return dict(pel=(-.8 + [-.4, -.6, .4, .6, .2][i], 0, [13.0, 13.4, 12.2, 11.8, 12.8][i]), lean=[-4, -8, 8, 12, 4][i],
                        hlean=[-8, -14, 8, 12, 2][i], pulse=[1, 2, 3, 3, 1][i], dust=(i == 3),
                        arms={'N': dict(ha=(hf, 1.6, hz)), 'F': dict(ha=(hf + .4, -1.6, hz + .4))},
                        xarms={1: [(1.0, 2.6, 1.0), (.6, 3.0, 3.0), (4.4, 1.6, -3.0), (4.6, 1.6, -4.6), (3.0, 1.6, -5.0)][i],
                               2: [(-1.0, -2.6, 5.0), (-1.6, -2.8, 6.4), (2.4, -2.2, 2.0), (2.8, -2.0, 0.0), (1.6, -2.0, 3.0)][i]},
                        legs={'N': dict(ft=(2.4, 2.0, 0)), 'F': dict(ft=(-1.8, -2.0, 0))})
        if anim == 'stomp':
            # crouch, rear up on the far leg with the near foot lifted high and all arms raised, slam it down, the ground
            # shakes, recover
            pz = [11.6, 14.6, 15.6, 11.2, 10.8, 12.6][i]
            lift = [0.0, 6.0, 9.0, 0.0, 0.0, 0.0][i]
            fz = [(2.0, 2.0, 0), (3.0, 2.0, lift), (3.6, 2.0, lift), (2.8, 2.0, 0), (2.8, 2.0, 0), (2.2, 2.0, 0)][i]
            return dict(pel=(-1.4, 0, pz), lean=[6, -14, -20, 14, 16, 4][i], hlean=[0, -14, -20, 12, 14, 2][i], pulse=[1, 3, 4, 4, 3, 2][i],
                        quake=[0, 0, 0, 1, 2, 0][i],
                        arms={'N': dict(ha=[(2.0, 2.0, -12.0), (-1.4, 3.0, 3.0), (-2.0, 3.2, 5.0), (5.0, 2.6, -11.0), (5.4, 2.6, -12.0), (2.6, 2.0, -12.6)][i]),
                              'F': dict(ha=[(2.0, -2.0, -12.0), (-1.4, -2.8, 3.4), (-1.8, -3.0, 5.4), (5.2, -2.4, -10.6), (5.6, -2.4, -11.6), (2.6, -2.0, -12.6)][i])},
                        xarms={1: (1.6, 2.4, [-4.0, 2.0, 4.0, -3.0, -5.0, -5.0][i]), 2: (0.0, -2.6, [4.0, 6.4, 7.0, 3.0, 2.0, 3.6][i])},
                        legs={'N': dict(ft=fz), 'F': dict(ft=(-1.8, -2.0, 0))})
        if anim == 'hit':
            return dict(pel=(-1.0, 0, 13.4), lean=-10, hlean=-14, pulse=4,
                        arms={'N': dict(ha=(-2.0, 3.4, -13.0)), 'F': dict(ha=(-1.6, -3.0, -13.0))},
                        xarms={1: (-1.0, 2.0, -3.0), 2: (-1.6, -2.4, 6.0)}, legs=stance)
        if anim == 'die':
            if i == 0:
                return dict(pel=(-.8, 0, 13.4), lean=-12, hlean=-18, pulse=4,
                            arms={'N': dict(ha=(-1.4, 4.4, -8.0)), 'F': dict(ha=(-1.2, -4.0, -8.0))},
                            xarms={1: (-1.0, 2.6, 2.0), 2: (-1.6, -2.6, 7.0)}, legs=stance)
            if i == 1:
                return dict(pel=(-.4, 0, 10.0), lean=8, hlean=12, head='dead', pulse=2,
                            arms={'N': dict(ha=(3.0, 4.0, -9.4)), 'F': dict(ha=(3.2, -3.6, -9.4))},
                            xarms={1: (2.4, 2.0, -4.0), 2: (.4, -2.4, 3.0)},
                            legs={'N': dict(ft=(2.2, 2.0, 0)), 'F': dict(ft=(.8, -2.0, 0))})
            return self.corpse(i, view, dict(pulse=[0, 0, 1, 0, -1, -1][i], xarms2={1: (-5, 3), 2: (3, -6)}))

    def draw(self, cv, P, view):
        pl = P.get('pulse', 1)
        def remap(key, pl=pl):
            if isinstance(key, tuple) and key[0] == 'core':
                if pl < 0:
                    return ('coreD', key[1])
                return ('core', max(0, min(4, key[1] + (pl - 2) // 2)))
            return key
        P['remap'] = remap
        q = P.get('quake', 0)
        meta = Mutant.draw(self, cv, P, view)
        return meta

    SPIKES = {'F': {'sp1': ((-.5, -1), 7), 'sp2': ((-.15, -1), 8), 'sp3': ((.35, -1), 7), 'sp4': ((-1, -.55), 6), 'sp5': ((1, -.7), 5)},
              'B': {'sp1': ((.45, -1), 7), 'sp2': ((.1, -1), 8), 'sp3': ((-.35, -1), 7), 'sp4': ((-1, -.6), 6), 'sp5': ((1, -.5), 5)}}

    def extras(self, cv, P, view, J, meta):
        tm, Dt, tdeg = J['_tm'], J['_Dt'], J['_tdeg']
        # bone spikes out of the back and shoulders
        for nm, (dv, ln) in self.SPIKES[view].items():
            a = tm(nm)
            d = rot2(unit2(dv), tdeg)
            b = (a[0] + d[0] * ln, a[1] + d[1] * ln)
            dz = -1.5 if view == 'F' else 2.0
            stroke(cv, a, b, [(0, 3), (.55, 2), (1, 1)], Dt + dz, Dt + dz, 'spike', 'bone', rad=.4)
        # two extra, smaller arms: one from the fused body, one from the far back
        for k, (anc, mat, sgn) in ((1, ('xa1', 'gs', 1)), (2, ('xa2', 'raw', -1))):
            sh2 = tm(anc)
            shd = Dt + (2.6 if sgn > 0 else -3.0)
            if 'xarms2' in P:
                h2 = vadd(sh2, P['xarms2'][k])
                e2 = ik2(sh2, h2, 5.4, 5.4, (1, -1))
                ed = hd = shd
            elif 'xarms' in P:
                ha = P['xarms'][k]
                el = ik3((0, 0, 0), ha, 5.4, 5.4, (-1.0, .6 * sgn, -.2))
                e2, h2 = vadd(sh2, proj(el, view)), vadd(sh2, proj(ha, view))
                ed, hd = shd + dep(el, view), shd + dep(ha, view)
            else:
                continue
            part = 'xarm%d' % k
            stroke(cv, sh2, e2, [(0, 4), (1, 3)], shd, ed, part, mat, rad=1.2, root_t=.3)
            stroke(cv, e2, h2, [(0, 3), (1, 2)], ed, hd, part, mat, rad=1.0)
            self.claw_hand(cv, h2, (h2[0] - e2[0], h2[1] - e2[1]), hd + 1.0, part, mat, 'bone', [(-30, 1.5), (5, 2.0), (35, 1.5)], palm=2)
        if P.get('dust') and 'ha2N' in J:
            for hh in (J['ha2N'], J['ha2F']):
                for (dx, dy, t) in ((-3, 1, 3), (-2, 0, 2), (3, 1, 3), (4, 0, 2), (-1, -2, 3), (2, -2, 2)):
                    cv.put(int(round(hh[0] + dx)), int(round(hh[1] + dy + 2)), ('dust', t), 95, 'dust')

    def after(self, cv, P, view, meta):
        q = P.get('quake', 0)
        if q:
            # stomp shockwave: a broken ring of dust around the feet, bigger on impact
            A = (self.ax + (2 if view == 'F' else -2), self.ay - 1)
            rx, ry = 10 + 4 * q, 2.2 + 1.0 * q
            for a in range(0, 360, 9):
                r = math.radians(a)
                x, y = int(round(A[0] + rx * math.cos(r))), int(round(A[1] + ry * math.sin(r)))
                if (a // 9) % 4 == 3:
                    continue
                if (x, y) not in cv.px and 0 <= x < cv.w and 0 <= y < cv.h:
                    cv.fx[(x, y)] = ('dust', 3 if math.sin(r) < 0 else 2)
            for (dx, dy) in ((-6, -2), (7, -3), (-9, -5), (10, -6), (-3, -6), (4, -8)):
                if q == 2:
                    x, y = A[0] + dx, A[1] + dy
                    if (x, y) not in cv.px:
                        cv.fx[(x, y)] = ('dust', 4)

# ============================================================== scale reference (preview only, not exported)
class Human(Mutant):
    """a 29 px survivor in the game's olive shirt, only for the size lineup"""
    name = 'human'
    w = h = 32
    ax, ay = 15, 29
    ANIMS = {'walk': (8, 8, True)}

    def setup(self):
        self.mats = {'shirt': ramp((96, 116, 76)), 'pnt': ramp((62, 66, 84)), 'skin': ramp((222, 172, 134)), 'hair': ramp((92, 70, 48)),
                     'shoe': ramp((206, 200, 186)), 'eye': flat((40, 30, 30))}
        self.legend({'shirt': '12345', 'pnt': 'abcde', 'skin': 'fghij', 'hair': 'klmnp', 'eye': '  E  '})
        self.T['base'] = {'F': Bmp("""
                ...hih...
                .3444433.
                344444332
                343333322
                2333333211
                .3222222..
                .3333332..
                .2444442..
                .ccccbbb..
                .dcccbbba.
            """, hip=(4, 8), neck=(4, 0), shN=(1, 2), shF=(7, 1), hpN=(3, 9), hpF=(6, 8))}
        self.T['base']['B'] = self.T['base']['F']
        self.H['base'] = {'F': Bmp("""
                .lmnm.
                lmnnnm
                lmhijh
                lhiEiE
                .hhiih
                ..hhh.
                ...g..
            """, neck=(2, 6), top=(3, 0))}
        self.H['base']['B'] = self.H['base']['F']

    def arm_spec(self, P, side):
        return dict(up=4.4, fore=4.4, wu=[(0, 3), (1, 2)], wf=[(0, 2), (1, 2)], mat_u='shirt', mat_f='skin')

    def leg_spec(self, P, side):
        return dict(th=6.0, sh=6.0, ankle=1.4, wt=[(0, 3), (1, 3)], ws=[(0, 3), (1, 2)], mat_t='pnt', mat_s='pnt')

    def hand(self, cv, P, view, side, h2, dv, depth, part, a):
        self.claw_hand(cv, h2, dv, depth, part, 'skin', None, [], palm=2)

    def foot(self, cv, P, view, side, a2, k2, g, part, spec, depth):
        self.simple_foot(cv, P, view, a2, g, part, depth, 'shoe', length=2.0)

    def pose(self, anim, i, view):
        return dict(pel=(0, 0, 13.4), arms={'N': dict(ha=(.4, .8, -8.0)), 'F': dict(ha=(.4, -.8, -8.0))},
                    legs={'N': dict(ft=(.6, 1.3, 0)), 'F': dict(ft=(-.6, -1.3, 0))})

def lineup(res, path, scale=1):
    """all types next to a 29 px human, on grass and on dirt, F and B"""
    from PIL import Image, ImageDraw
    hm = Human()
    hs = bake(hm)
    items = [('human', hs)] + [(k, v) for k, v in res.items()]
    gap = 4
    W = sum(sp['w'] for _, sp in items) + gap * (len(items) + 1)
    H = max(sp['h'] for _, sp in items)
    rows = []
    for bg in (GRASS, DIRT):
        for view in 'FB':
            im = Image.new('RGB', (W, H + 4), bg)
            x = gap
            for nm, sp in items:
                fr = sp['anims']['walk'][view][0]['rows']
                g = img_of(sp, fr, 1)
                # feet on a common ground line
                im.paste(g, (x, H + 1 - sp['ay'] - 1 + (sp['h'] - sp['h'])), g)
                x += sp['w'] + gap
            rows.append(im)
    out = Image.new('RGB', (W, (H + 4) * len(rows)), (0, 0, 0))
    for k, im in enumerate(rows):
        out.paste(im, (0, k * (H + 4)))
    if scale > 1:
        out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
    out.save(path)
    return out.size

# ============================================================== main
TYPES = [Spitter, Screamer, Leaper, Burrower, Regenerator, Giant, Boss]

def build(names=None, previews=True):
    os.makedirs(PREV, exist_ok=True)
    out = {}
    for T in TYPES:
        if names and T.name not in names:
            continue
        m = T()
        sp = bake(m)
        out[T.name] = sp
        bh = border_hits(sp)
        if bh:
            print(f'  {T.name}: touches frame edge in', ' '.join(bh))
        if previews:
            sheet(T.name, sp, os.path.join(PREV, f'sheet_{T.name}.png'), scale=6)
    if previews and not names:
        lineup(out, os.path.join(PREV, 'lineup_1x.png'), 1)
        lineup(out, os.path.join(PREV, 'lineup_3x.png'), 3)
    return out

if __name__ == '__main__':
    names = sys.argv[1:]
    res = build(names)
    if not names:
        os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
        order = ['spitter', 'screamer', 'leaper', 'burrower', 'regenerator', 'giant', 'boss']
        types = {k: res[k] for k in order if k in res}
        js = ("'use strict';\n// zombie mutants, set B: generated by tools/zombiesB.py (hand-painted parts on a 3D-posed rig). Do not edit by hand.\n"
              'window.ART_ZOMBIES_B = ' + json.dumps({'types': types}, separators=(',', ':')) + ';\n')
        open(OUT_JS, 'w').write(js)
        print('wrote', OUT_JS, len(js), 'bytes')
    for k, v in res.items():
        print(k, {a: len(x['F']) for a, x in v['anims'].items()})
