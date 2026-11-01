#!/usr/bin/env python3
"""Zombie set A: walker, crawler, runner, brute, bloater, armored, plus the dirt mound.

Run from bunker/tools:
    python3 zombiesA.py             writes ../art/zombiesA.js
    python3 zombiesA.py --preview   also renders checking sheets into /tmp/claude-0/zombiesA/

How a frame is made
  Every pose lives in body space: f forward, s towards the character's right, z up, measured in screen
  pixels of height. A pose places the pelvis, leans the torso and puts hands and feet; two-bone IK finds
  elbows and knees. The same pose is projected for both base views of the game's 2:1 camera:
    F faces down-right (towards the viewer)  sx = KX(f-s), sy = KY(f+s) - z
    B faces up-left (away from the viewer)   sx = -KX(f-s), sy = -KY(f+s) - z
  so B is the same body seen from the other side: mirrored, with near and far swapped.
  Parts go into a depth buffer: hand-drawn torso, head, hand and foot bitmaps (the torso follows the
  spine with a pixel-art rotation when the body tips over), and limbs drawn as shaped strokes with a
  width profile (thigh, knee, calf, ankle; deltoid, elbow, forearm, wrist), cloth that ends in ragged hems
  and far-side limbs one shade darker. A 1 px outline goes round the result, plus dark seams where an arm
  or leg crosses in front of the body.
"""
import math, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.path.join(HERE, '..', 'art', 'zombiesA.js')
PREVIEW_DIR = '/tmp/claude-0/zombiesA'

KX, KY, KD = math.sqrt(2 / 3), math.sqrt(1 / 6), math.sqrt(3 / 8)
OUTLINE = (30, 24, 26)

# ------------------------------------------------------------------ vectors
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, k): return tuple(x * k for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def vlen(a): return math.sqrt(dot(a, a))
def unit(a):
    l = vlen(a)
    return mul(a, 1 / l) if l > 1e-9 else a
def lerp(a, b, t): return a + (b - a) * t
def lerpv(a, b, t): return tuple(lerp(x, y, t) for x, y in zip(a, b))
def clamp(v, a, b): return max(a, min(b, v))
def rnd(v): return int(math.floor(v + 0.5))
def smooth(t): t = clamp(t, 0, 1); return t * t * (3 - 2 * t)
def bump(t, c, w): return max(0.0, 1 - abs(t - c) / w)

def pitch(p, a):
    """rotate about the s axis; positive a tips +z towards +f (a forward lean)"""
    f, s, z = p; c, si = math.cos(a), math.sin(a)
    return (f * c + z * si, s, -f * si + z * c)
def roll(p, a):
    """rotate about the f axis; positive a tips +z towards +s (towards the character's right)"""
    f, s, z = p; c, si = math.cos(a), math.sin(a)
    return (f, s * c + z * si, -s * si + z * c)
def yaw(p, a):
    """rotate about z; positive a turns +f towards +s"""
    f, s, z = p; c, si = math.cos(a), math.sin(a)
    return (f * c - s * si, f * si + s * c, z)

def proj(view, p):
    f, s, z = p
    if view == 'F': return (KX * (f - s), KY * (f + s) - z)
    return (-KX * (f - s), -KY * (f + s) - z)
def depth(view, p):
    f, s, z = p
    return (KD if view == 'F' else -KD) * (f + s) + 0.5 * z

def ik(root, target, l1, l2, pole):
    """two-bone IK: the middle joint, bent towards the pole direction, and the reachable end"""
    d = sub(target, root); L = vlen(d)
    u = unit(d) if L > 1e-6 else (0, 0, -1)
    L = clamp(L, abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999)
    end = add(root, mul(u, L))
    a = clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1)
    h = l1 * math.sqrt(1 - a * a)
    p = sub(pole, mul(u, dot(pole, u)))
    if vlen(p) < 1e-6: p = (1, 0, 0) if abs(u[0]) < .9 else (0, 0, 1)
    p = unit(p)
    return add(root, add(mul(u, l1 * a), mul(p, h))), end

# ------------------------------------------------------------------ canvas
class Canvas:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.c, s.d, s.p = {}, {}, {}
    def put(s, x, y, ch, d, part):
        if not ch or ch == '.': return
        if not (0 <= x < s.w and 0 <= y < s.h): return
        k = (x, y)
        if k in s.c and s.d[k] > d: return
        s.c[k] = ch; s.d[k] = d; s.p[k] = part
    def rows(s):
        return [''.join(s.c.get((x, y), '.') for x in range(s.w)) for y in range(s.h)]

class Bmp:
    """a hand-drawn bitmap; anchors are named points in bitmap pixel coordinates"""
    def __init__(s, rows, **anchors):
        if isinstance(rows, str): rows = [r.strip() for r in rows.strip().splitlines()]
        s.w = max(len(r) for r in rows)
        s.rows = [r.ljust(s.w, '.') for r in rows]
        s.h = len(s.rows)
        s.a = {k: tuple(float(c) for c in v) for k, v in anchors.items()}
        s._up = None
    def flip(s):
        b = Bmp([r[::-1] for r in s.rows], **{k: (s.w - 1 - v[0], v[1]) for k, v in s.a.items()})
        return b
    def up8(s):
        if s._up is None:
            r = s.rows
            for _ in range(3): r = epx(r)
            s._up = r
        return s._up

def epx(rows):
    """Scale2x: doubles a bitmap while keeping its edges crisp (used for clean pixel-art rotation)"""
    h, w = len(rows), len(rows[0])
    g = lambda x, y: rows[y][x] if 0 <= x < w and 0 <= y < h else '.'
    out = [[None] * (2 * w) for _ in range(2 * h)]
    for y in range(h):
        for x in range(w):
            P, A, B, C, D = g(x, y), g(x, y - 1), g(x + 1, y), g(x - 1, y), g(x, y + 1)
            out[2 * y][2 * x] = A if (C == A and C != D and A != B) else P
            out[2 * y][2 * x + 1] = B if (A == B and A != C and B != D) else P
            out[2 * y + 1][2 * x] = C if (D == C and D != B and C != A) else P
            out[2 * y + 1][2 * x + 1] = D if (B == D and B != A and D != C) else P
    return [''.join(r) for r in out]

def stamp(cv, bmp, anchor, dst, d, part, M=None, remap=None):
    """draw bmp so that its anchor lands on screen point dst; M (2x2, bitmap->screen) rotates/shears it"""
    bx, by = bmp.a[anchor] if isinstance(anchor, str) else anchor
    if M is None or (abs(M[0][0] - 1) < .02 and abs(M[1][1] - 1) < .02 and abs(M[0][1]) < .02 and abs(M[1][0]) < .02):
        ox, oy = rnd(dst[0] - bx), rnd(dst[1] - by)
        for y, r in enumerate(bmp.rows):
            for x, ch in enumerate(r):
                if ch != '.':
                    cv.put(ox + x, oy + y, remap.get(ch, ch) if remap else ch, d(ox + x, oy + y) if callable(d) else d, part)
        return
    (a, b), (c, e) = M
    det = a * e - b * c
    ia, ib, ic, ie = e / det, -b / det, -c / det, a / det
    up = bmp.up8()
    dx0, dy0 = rnd(dst[0]), rnd(dst[1])
    fx, fy = dst[0] - dx0, dst[1] - dy0
    corners = [(-bx - .5, -by - .5), (bmp.w - bx + .5, -by - .5), (-bx - .5, bmp.h - by + .5), (bmp.w - bx + .5, bmp.h - by + .5)]
    xs = [a * u + b * v for u, v in corners]; ys = [c * u + e * v for u, v in corners]
    for y in range(int(math.floor(min(ys))) - 1, int(math.ceil(max(ys))) + 2):
        for x in range(int(math.floor(min(xs))) - 1, int(math.ceil(max(xs))) + 2):
            u, v = x - fx, y - fy
            sx, sy = ia * u + ib * v + bx, ic * u + ie * v + by
            ix, iy = int(math.floor(sx * 8 + 4)), int(math.floor(sy * 8 + 4))
            if 0 <= ix < bmp.w * 8 and 0 <= iy < bmp.h * 8:
                ch = up[iy][ix]
                if ch != '.':
                    X, Y = dx0 + x, dy0 + y
                    cv.put(X, Y, remap.get(ch, ch) if remap else ch, d(X, Y) if callable(d) else d, part)

def rotm(a):
    c, s = math.cos(a), math.sin(a)
    return ((c, -s), (s, c))

# ------------------------------------------------------------------ limbs
LIGHT = (-0.6, -0.8)   # towards the light: upper left

class Ramp:
    """letters of one material from light to dark"""
    def __init__(s, letters): s.l = letters
    def __call__(s, k): return s.l[clamp(k, 0, len(s.l) - 1)]

def stroke(cv, A, B, dA, dB, prof, paint, part, bulge=(0, 0), front=(0, 0)):
    """a limb segment from A to B as runs of pixels across the bone, so the width stays clean on any slope.
    prof(t) -> (w, wb, wf): half width plus extra on the bulge side and on the front side (screen px).
    paint(t, c, n, k, x, y, lit) -> letter; c runs -1..1 across the run, lit > 0 on the side facing the light."""
    dx, dy = B[0] - A[0], B[1] - A[1]
    L = math.hypot(dx, dy)
    vert = abs(dy) >= abs(dx)
    if L < 1e-3: dy, L, vert = 1e-3, 1e-3, True
    if vert:
        sc = L / abs(dy)
        i0, i1 = rnd(A[1]), rnd(B[1])
        sb = (bulge[0] > .15) - (bulge[0] < -.15); sf = (front[0] > .15) - (front[0] < -.15)
    else:
        sc = L / abs(dx)
        i0, i1 = rnd(A[0]), rnd(B[0])
        sb = (bulge[1] > .15) - (bulge[1] < -.15); sf = (front[1] > .15) - (front[1] < -.15)
    step = 1 if i1 >= i0 else -1
    nx, ny = -dy / L, dx / L                       # perpendicular to the bone
    e_n = nx if vert else ny                       # how the run axis lines up with it
    nl = (nx * LIGHT[0] + ny * LIGHT[1]) * (1 if e_n >= 0 else -1)
    for i in range(i0, i1 + step, step):
        if vert: t = clamp((i - A[1]) / dy, 0, 1) if abs(dy) > 1e-6 else 0.5; cc = A[0] + dx * t
        else: t = clamp((i - A[0]) / dx, 0, 1) if abs(dx) > 1e-6 else 0.5; cc = A[1] + dy * t
        w, wb, wf = prof(t)
        lo = w + (wb if sb < 0 else 0) + (wf if sf < 0 else 0)
        hi = w + (wb if sb > 0 else 0) + (wf if sf > 0 else 0)
        lo *= sc; hi *= sc
        n = max(1, rnd(lo + hi))
        ctr = cc + (hi - lo) / 2
        j0 = int(math.floor(ctr - n / 2 + 0.5))
        for k in range(n):
            c = ((k + 0.5) / n) * 2 - 1
            lit = c * nl
            x, y = (j0 + k, i) if vert else (i, j0 + k)
            ch = paint(t, c, n, k, x, y, lit)
            if ch: cv.put(x, y, ch, lerp(dA, dB, t) + 0.5 * math.sqrt(max(0, 1 - c * c)), part)

def shade(ramp, n, lit, dark=0, allow_hi=True):
    """pick a tone across a limb: lit edge, body, shadow edge"""
    if n == 1: k = 1
    elif n == 2: k = 1 if lit > 0 else 2
    else: k = 0 if (lit > .45 and allow_hi) else 2 if lit < -.3 else 1
    return ramp(k + dark)

# ------------------------------------------------------------------ humanoid rig
SIDES = ('R', 'L')

def mat2(cols_from, cols_to):
    """2x2 matrix taking the two column vectors cols_from onto cols_to"""
    (a, c), (b, d) = cols_from
    det = a * d - b * c
    if abs(det) < 1e-6: return ((1, 0), (0, 1))
    inv = ((d / det, -b / det), (-c / det, a / det))
    (p, r), (q, t) = cols_to
    T = ((p, q), (r, t))
    return tuple(tuple(sum(T[i][k] * inv[k][j] for k in range(2)) for j in range(2)) for i in range(2))

def apply2(M, v): return (M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1])

class Rig:
    """body-space skeleton of one type; joint names: pel neck shR shL hpR hpL elR elL haR haL knR knL ftR ftL head"""
    def __init__(s, **d): s.__dict__.update(d)
    def torso_frame(s, pose):
        lean = math.radians(pose.get('lean', s.lean0)); rl = math.radians(pose.get('roll', 0)); tw = math.radians(pose.get('twist', 0))
        R = lambda v: yaw(roll(pitch(v, lean), rl), pose.get('yaw', 0))
        return R, tw
    def joints(s, pose):
        R, tw = s.torso_frame(pose)
        J = {'pel': pose['pel']}
        J['neck'] = add(J['pel'], R((0, 0, s.torso_len)))
        for side, sg in (('R', 1), ('L', -1)):
            sh = yaw((s.sh[0], sg * s.sh[1], s.sh[2]), tw)
            J['sh' + side] = add(J['neck'], R(sh))
            J['hp' + side] = add(J['pel'], R((0, sg * s.hip_w, -s.hip_drop)))
            ft, _st = pose['foot'][side][:2]
            J['kn' + side], J['ft' + side] = ik(J['hp' + side], ft, s.thigh, s.shin, R(pose.get('knee_pole', (1, 0.15 * sg, 0))))
            ha = pose['hand'][side]
            pole = ha[2] if len(ha) > 2 and ha[2] else (-1, sg * 0.6, -0.3)
            J['el' + side], J['ha' + side] = ik(J['sh' + side], ha[0], s.upper, s.fore, pole)
        J['chest'] = lerpv(J['pel'], J['neck'], 0.6)
        return J

def render_biped(T, pose, view):
    """one frame of a biped type T in a view; returns (canvas, head_top)"""
    rig = T.rig
    cv = Canvas(T.w, T.h)
    J = rig.joints(pose)
    base = rig.joints({**pose, 'lean': rig.lean0, 'roll': 0, 'twist': 0, 'yaw': 0})
    P = {k: (T.ax + proj(view, v)[0], T.ay + proj(view, v)[1]) for k, v in J.items()}
    D = {k: depth(view, v) for k, v in J.items()}
    near, far = ('R', 'L') if view == 'F' else ('L', 'R')
    # torso: the bitmap follows the projected spine and shoulder line
    tb = T.torso[view] if 'torso' not in pose else pose['torso'][view]
    pv = lambda J_, a, b: sub(proj(view, J_[b]), proj(view, J_[a]))
    M = mat2((pv(base, 'pel', 'neck'), pv(base, 'shL', 'shR')), (pv(J, 'pel', 'neck'), pv(J, 'shL', 'shR')))
    if pose.get('torso_M'): M = pose['torso_M'](view)
    pel2 = (rnd(P['pel'][0]), rnd(P['pel'][1]))
    td = D['chest'] + rig.torso_depth
    stamp(cv, tb, 'pel', pel2, td, 'torso', M)
    anc = lambda name: add(pel2, apply2(M, sub(tb.a[name], tb.a['pel'])))
    # head
    hb = T.head[view][pose.get('expr', 'idle')]
    hoff = proj(view, pose.get('head', (0, 0, 0)))
    hpos = add(anc('neck'), hoff)
    HM = rotm(math.radians(pose.get('head_rot', 0) * (1 if view == 'F' else -1)))
    hM = None if pose.get('head_rot', 0) == 0 else HM
    if pose.get('head_M'): hM = pose['head_M'](view)
    stamp(cv, hb, 'neck', hpos, td + rig.head_depth, 'head', hM)
    top = add((rnd(hpos[0]), rnd(hpos[1])), apply2(hM or ((1, 0), (0, 1)), sub(hb.a['top'], hb.a['neck'])))
    # limbs
    for side in SIDES:
        isnear = side == near
        dark = 0 if isnear else 1
        tag = 'N' if isnear else 'F'
        hip2 = anc('hp' + side)
        T.leg(cv, view, side, hip2, P['kn' + side], P['ft' + side], D['hp' + side], D['kn' + side], D['ft' + side], dark, 'leg' + tag, pose, J)
        sh2 = anc('sh' + side)
        T.arm(cv, view, side, sh2, P['el' + side], P['ha' + side], D['sh' + side], D['el' + side], D['ha' + side], dark, 'arm' + tag, pose, J)
    if hasattr(T, 'extra'): T.extra(cv, view, pose, J, P, D, anc)
    return cv, (rnd(top[0]), rnd(top[1]))

# ------------------------------------------------------------------ finishing passes
SEAMS = {('armN', 'torso'), ('armN', 'legN'), ('armN', 'legF'), ('armN', 'head'), ('legN', 'legF'), ('armF', 'legF'),
         ('torso', 'armF'), ('head', 'armF'), ('legN', 'armF'), ('torso', 'legF'), ('legN', 'torso'), ('armN', 'armF'),
         ('head', 'torso')}

def finish(cv, seams=SEAMS, keep=()):
    """drop stray single pixels, draw seams where a front part overlaps a back part, then the outline"""
    c, p, d = cv.c, cv.p, cv.d
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for k in [k for k in c if p[k] not in keep and not any((k[0] + dx, k[1] + dy) in c for dx, dy in N4)]:
        del c[k]
    seam = []
    for (x, y), ch in c.items():
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q in c and (p[q], p[(x, y)]) in seams and d[q] > d[(x, y)] + 0.8:
                seam.append((x, y)); break
    out = dict(c)
    for k in seam: out[k] = 'o'
    for (x, y) in list(c):
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in c and 0 <= q[0] < cv.w and 0 <= q[1] < cv.h: out[q] = 'o'
    cv.c = out
    return cv

# ------------------------------------------------------------------ biped types
def hand_dir(el, ha):
    return math.atan2(ha[1] - el[1], ha[0] - el[0])

class Biped:
    """a zombie type on the biped rig: palette, bitmaps, limb styles and its animations"""
    def __init__(s, **kw):
        s.__dict__.update(kw)
    # legs ----------------------------------------------------------
    def leg(s, cv, view, side, hip, kn, ft, dh, dk, df, dark, part, pose, J):
        back = proj(view, (-1, 0, 0)); front = proj(view, (1, 0, 0))
        st = s.legs[side] if isinstance(s.legs, dict) else s.legs
        stroke(cv, hip, kn, dh + .6, dk + .6, st['thigh_prof'], st['thigh_paint'](dark), part, bulge=back, front=front)
        stroke(cv, kn, ft, dk + .6, df + .6, st['shin_prof'], st['shin_paint'](dark), part, bulge=back, front=front)
        state = pose['foot'][side][1]
        fb = s.feet[view][st.get('foot', 'shoe')][state]
        remap = s.far_remap if dark else None
        stamp(cv, fb, 'ankle', ft, df + 1.0, part, remap=remap)
    # arms ----------------------------------------------------------
    def arm(s, cv, view, side, sh, el, ha, dsh, de, dha, dark, part, pose, J):
        st = s.arms[side] if isinstance(s.arms, dict) else s.arms
        back = proj(view, (-1, 0, 0)); front = proj(view, (1, 0, 0))
        stroke(cv, sh, el, dsh + .6, de + .6, st['upper_prof'], st['upper_paint'](dark), part, bulge=back, front=front)
        stroke(cv, el, ha, de + .6, dha + .6, st['fore_prof'], st['fore_paint'](dark), part, bulge=back, front=front)
        kind = pose['hand'][side][1] if len(pose['hand'][side]) > 1 and pose['hand'][side][1] else st.get('hand', 'claw')
        hb = s.hands[kind]
        a = hand_dir(el, ha)
        if math.cos(a) < -0.2:     # pointing left: mirror first so the fingers still curl downwards
            hb = hb.flip(); a = a - math.pi
        remap = s.far_remap if dark else None
        stamp(cv, hb, 'wrist', ha, dha + 1.2, part, M=rotm(a), remap=remap)

def far_remap_of(ramps):
    """letters one step darker, for limbs on the far side of the body"""
    m = {}
    for r in ramps:
        for i, ch in enumerate(r[:-1]): m[ch] = r[i + 1]
    return m

def cloth_paint(ramp, dark, folds=(), allow_hi=True):
    def paint(t, c, n, k, x, y, lit):
        dk = dark + (1 if any(abs(t - f) < .09 and (k == n - 1 or c > -.2) for f in folds) else 0)
        return shade(ramp, n, lit, dk, allow_hi)
    return paint

def frame_rows(cv): return cv.rows()

# ------------------------------------------------------------------ preview helpers (only with --preview)
def save_sheet(path, rows_list, pal, sc=6, cols=None, bg=(236, 232, 222), labels=None, gap=2):
    from PIL import Image
    w = max(len(r[0]) for r in rows_list); h = max(len(r) for r in rows_list)
    cols = cols or len(rows_list)
    nrow = (len(rows_list) + cols - 1) // cols
    img = Image.new('RGB', ((cols * (w + gap) + gap) * sc, (nrow * (h + gap) + gap) * sc), bg)
    for i, rows in enumerate(rows_list):
        ox, oy = gap + (i % cols) * (w + gap), gap + (i // cols) * (h + gap)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch == '.': continue
                c = OUTLINE if ch == 'o' else tuple(pal.get(ch, (255, 0, 255)))
                img.paste(c, ((ox + x) * sc, (oy + y) * sc, (ox + x + 1) * sc, (oy + y + 1) * sc))
    img.save(path)
    return img

# ================================================================== WALKER
WALKER_PAL = {
    'k': (162, 174, 112), 'S': (120, 140, 100), 's': (88, 106, 92), 'q': (62, 68, 82),
    'W': (220, 212, 178), 'C': (184, 174, 144), 'c': (136, 130, 126), 'x': (96, 90, 106),
    'U': (108, 130, 168), 'P': (76, 94, 134), 'p': (56, 64, 104), 'u': (40, 40, 76),
    'G': (128, 98, 70), 'F': (90, 68, 54), 'f': (62, 48, 50), 'g': (44, 34, 40),
    'H': (66, 56, 52), 'h': (44, 36, 40), 'E': (250, 250, 214), 'e': (176, 206, 160),
    'M': (58, 22, 32), 'T': (222, 208, 170), 'R': (164, 52, 44), 'B': (120, 30, 30), 'b': (82, 22, 34),
    'I': (214, 204, 164), 'i': (150, 144, 126), 'n': (200, 196, 150), 'o': OUTLINE,
}
SKIN, SHIRT, JEANS, SHOE = Ramp('kSsq'), Ramp('WCcx'), Ramp('UPpu'), Ramp('GFfg')

def walker_type():
    rig = Rig(ankle=1.5, shin=6.0, thigh=6.2, hip_w=1.5, hip_drop=0.5, torso_len=8.6, lean0=10, sh=(-0.5, 4.4, -1.3),
              upper=5.2, fore=4.8, torso_depth=2.0, head_depth=1.5)
    torsoF = Bmp("""
        .......WCCc.
        .....SsWCCCc
        ...WWsxbCCCx
        .WWWCCxBRCcx
        WWWCCCCBbCcx
        WWCCCCxkIxcx
        WCCCCCxSqscx
        WCCCCCxIkxc.
        .CCCCCCxsxc.
        .CCcSkSssCc.
        .UUPPPPPPPp.
        .UPPPPPPPpp.
        ..UPPPPPpp..
        ...PPPppu...
    """, pel=(5, 10), neck=(6.2, 2.1), shR=(2.0, 4.8), shL=(9.2, 1.2), hpR=(3.7, 11.1), hpL=(6.2, 9.8))
    torsoB = Bmp("""
        ....SsCCW...
        ...WsSCCCWc.
        ..WCCCCCCCcx
        .WCCCCCCCCcx
        WWCCCCCCCccx
        WCCCCxkxCCcx
        WCCCCxSxCccx
        WCCCCxkxCcx.
        .CCCCCxCCcx.
        .CcCSsCcCcx.
        .UPPPPPPPpp.
        .UPPpPPPPpp.
        ..UPPPPPpu..
        ...PPPppu...
    """, pel=(6, 11), neck=(4.8, 1.9), shR=(9.0, 1.6), shL=(1.8, 5.2), hpR=(7.3, 10.9), hpL=(4.8, 12.1))
    headF = Bmp("""
        ...hSkh..
        .hHSkkSh.
        hHsSSSSSk
        hHSSSSSSS
        HhSsqqSqq
        hSkSEeqEs
        qSSSSsSss
        .qsSsMMMs
        ..qSMTMTq
        ..qsMMMs.
        ...qsss..
    """, neck=(3, 9), top=(4, 0))
    headB = Bmp("""
        ...hHhh..
        .hHkSHHh.
        hHkSSsHhh
        hHSSsHHHh
        SkHsHHhHh
        sSkHHHHhh
        qsHHhHHh.
        .qsHHhhs.
        ..qsSSs..
        ...sSs...
    """, neck=(5, 9), top=(4, 0))
    claw = Bmp("""
        .Sk.
        SSSn
        sSs.
        .snn
    """, wrist=(0, 1.5))
    limp = Bmp("""
        SSs.
        sSSs
        .n.n
    """, wrist=(0, 0.5))
    shoeF = {'flat': Bmp("""
        FF....
        GFFF..
        .fFFFF
        ...fFf
    """, ankle=(1, 0)), 'toe': Bmp("""
        FF..
        GFF.
        .fFf
        ..ff
    """, ankle=(1, 0)), 'air': Bmp("""
        FF...
        GFFF.
        .fFFf
    """, ankle=(1, 0))}
    shoeB = {'flat': Bmp("""
        fF....
        fFFF..
        .fFFFG
        ...fFF
    """, ankle=(4, 1)), 'toe': Bmp("""
        fF..
        fFF.
        .FFG
        ..FF
    """, ankle=(2, 1)), 'air': Bmp("""
        fF...
        fFFF.
        .fFFG
    """, ankle=(3, 1))}
    bare = lambda b: Bmp([r.replace('F', 'S').replace('G', 'k').replace('f', 's') for r in b.rows], **b.a)
    footF = {k: bare(b) for k, b in shoeF.items()}
    footB = {k: bare(b) for k, b in shoeB.items()}

    def hem_paint(cloth, skin, hem, dark, folds=()):
        def paint(t, c, n, k, x, y, lit):
            jag = hem + 0.1 * (((x * 5 + y * 3) % 3) - 1)
            if t < jag:
                dk = dark + (1 if any(abs(t - f) < .09 and c > -.2 for f in folds) else 0)
                if t > jag - .12: dk += 1
                return shade(cloth, n, lit, dk)
            return shade(skin, n, lit, dark, allow_hi=False)
        return paint
    def leg_style(hem, foot):
        return {'thigh_prof': lambda t: (lerp(2.0, 1.6, t), 0.35 * (1 - t), 0.25 * bump(t, 0.4, 0.5)),
                'thigh_paint': lambda dark: cloth_paint(JEANS, dark, folds=(0.85,)),
                'shin_prof': lambda t: ((1.65 + 0.15 * t) if t < hem else lerp(1.05, 0.8, (t - hem) / max(.01, 1 - hem)),
                                        0.3 * bump(t, 0.3, 0.3) if t >= hem else 0, 0),
                'shin_paint': lambda dark: hem_paint(JEANS, SKIN, hem, dark),
                'foot': foot}
    def arm_style(sleeve):
        return {'upper_prof': lambda t: (lerp(1.3, 1.0, t), 0.1, 0.25 * bump(t, 0.5, 0.4)),
                'upper_paint': lambda dark: hem_paint(SHIRT, SKIN, sleeve, dark),
                'fore_prof': lambda t: (lerp(0.95, 0.6, t), 0.2 * bump(t, 0.2, 0.3), 0),
                'fore_paint': lambda dark: (lambda t, c, n, k, x, y, lit: shade(SKIN, n, lit, dark, allow_hi=False))}
    return Biped(name='walker', w=32, h=32, ax=18, ay=29, pal=WALKER_PAL, rig=rig,
                 torso={'F': torsoF, 'B': torsoB}, head={'F': {'idle': headF}, 'B': {'idle': headB}},
                 hands={'claw': claw, 'limp': limp},
                 feet={'F': {'shoe': shoeF, 'bare': footF}, 'B': {'shoe': shoeB, 'bare': footB}},
                 legs={'R': leg_style(0.38, 'bare'), 'L': leg_style(0.92, 'shoe')},
                 arms={'R': arm_style(0.55), 'L': arm_style(0.45)},
                 far_remap=far_remap_of(['kSsq', 'WCcx', 'UPpu', 'GFfg', 'Hh', 'RBb', 'Ii']))

def gait_feet(k, n, h, side_s, ankle, lift, duty_frames, drag=False, phase0=0):
    """foot for frame k of an n-frame cycle: planted feet slide back h*2 over duty_frames frames at a steady rate,
    then swing forward. Returns (ankle position, foot state)."""
    j = (k - phase0) % n
    step = 2 * h / duty_frames
    if j <= duty_frames:
        f = h - step * j
        st = 'flat' if j < duty_frames else 'toe'
        z = ankle + (0.4 if j == duty_frames else 0)
        return (f, side_s, z), st
    sw = n - duty_frames
    u = (j - duty_frames) / sw
    f = lerp(-h, h, smooth(u)) if not drag else lerp(-h, h, u)
    z = ankle + lift * math.sin(math.pi * u)
    return (f, side_s, z), ('toe' if drag else 'air')

def walker_walk(T):
    poses = []
    n, h = 8, 2.45
    for k in range(n):
        ph = k / n
        fR = gait_feet(k, n, h, 1.3, 1.5, 2.2, 4)
        fL = gait_feet(k, n, h, -1.3, 1.5, 0.8, 4, drag=True, phase0=4)
        z = [13.0, 13.3, 13.5, 13.3, 12.8, 13.0, 13.2, 13.0][k]
        sway = 0.35 * math.sin(2 * math.pi * ph)
        rl = [0, 2, 3, 2, 0, -3, -4, -2][k]
        swing = -0.9 * math.cos(2 * math.pi * ph)
        poses.append({
            'pel': (0, sway, z), 'roll': rl,
            'foot': {'R': fR, 'L': fL},
            'hand': {'R': ((0.6 + swing, 5.0, z - 1.6), 'limp', (-1, .1, 0)),
                     'L': ((8.2, -3.2, 17.6 + (z - 13.0)), 'claw', (0, -0.6, -1))},
            'head': (0.2, 0.3 * math.sin(2 * math.pi * ph), -0.2),
        })
    return poses
