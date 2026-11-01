#!/usr/bin/env python3
"""Zombie set A: walker, crawler, runner, brute, bloater, armored, plus the dirt mound.

Run from bunker/tools:
    python3 zombiesA.py             writes ../art/zombiesA.js  (window.ART_ZOMBIES_A)
    python3 zombiesA.py --preview   also renders sheets and a 1x/3x lineup into /tmp/claude-0/zombiesA/ (needs PIL)

How a frame is made
  Every pose lives in body space: f forward, s towards the character's right, z up, in screen pixels of
  height. A pose places the pelvis, leans the torso and puts hands and feet; two-bone IK finds elbows and
  knees. The same pose is projected for both base views of the game's 2:1 camera (S=16, 30 degrees):
    F faces down-right (towards the viewer)  sx = KX(f-s), sy = KY(f+s) - z
    B faces up-left (away from the viewer)   sx = -KX(f-s), sy = -KY(f+s) - z
  so B is the same body seen from the other side: mirrored, near and far swapped. Points that land on the
  same pixel are ordered by f+s (exact for this projection), which is the depth buffer.
  Parts drawn into it:
    - hand-drawn chest, hips and head bitmaps per view; a chest is picked by lean angle and sheared for the
      rest, the head carries the face (glowing eyes, slack jaw) and expressions idle/bite/hurt/dead;
    - limbs as runs of pixels across the bone with an anatomical width profile (deltoid, bicep, elbow,
      forearm, wrist; thigh, knee, calf, ankle), lit from the upper left both across the limb and along it
      (where a muscle swells or tapers), creases and veins, cloth that ends in a ragged hem, far-side limbs a
      shade darker;
    - hands drawn for five directions (mirrored for the rest) so fingers and claws stay crisp; feet and
      shoes per view and state;
    - bodies that swell or crawl (the bloater's belly, the crawler's trunk, the mound) are ray-cast from
      ellipsoids into 4 tones and cleaned into clusters; dying bodies end on a hand-drawn lying body.
  Finish: lone pixels removed, a seam in the back part's darkest tone where a part of the same colour
  passes in front of it, then the 1 px outline in rgb(30,24,26) round the silhouette.

Walk cycles move the planted foot back a fixed 0.0884 world units per frame (1 px across, 0.5 px down on
screen; the runner 0.1155). The game advances walk frames by time walked x fps, so each walk fps is the
zombie's speed / step (walker .55, crawler .42, runner 1.15, brute .32, bloater .34, armored .45 from
src/config.js) and the planted foot stays put on the ground. If a speed changes, rescale that fps.
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
    """nearness to the camera. Two points that land on the same pixel differ in height by KY per unit of
    (f+s), so ordering them by f+s alone is exact"""
    f, s, z = p
    return (f + s) if view == 'F' else -(f + s)

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
    ul = (dx * LIGHT[0] + dy * LIGHT[1]) / L       # bone direction against the light
    def width(t):
        w, wb, wf = prof(clamp(t, 0, 1)); return 2 * w + wb + wf
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
        # cross-contour light: where the limb swells the surface faces back up the bone, where it tapers it
        # faces down it, so muscles read as bulges instead of a tube with a stripe down its side
        tilt = -(width(t + .06) - width(t - .06)) / (.12 * 2 * max(L, 2))
        ax_lit = clamp(tilt * ul * 3.2, -0.6, 0.6)
        for k in range(n):
            c = ((k + 0.5) / n) * 2 - 1
            lit = c * nl * (0.75 if n >= 3 else 1) + ax_lit * (1 - 0.4 * abs(c))
            x, y = (j0 + k, i) if vert else (i, j0 + k)
            ch = paint(t, c, n, k, x, y, lit)
            if ch: cv.put(x, y, ch, lerp(dA, dB, t) + 0.5 * math.sqrt(max(0, 1 - c * c)), part)

def shade(ramp, n, lit, dark=0, allow_hi=True):
    """pick a tone across a limb: lit edge, body, shadow edge, and a deep core under big muscles"""
    if n == 1: k = 1 if lit > -.45 else 2
    elif n == 2: k = 1 if lit > -0.05 else 2
    else: k = 0 if (lit > .42 and allow_hi) else 3 if (lit < -.72 and n >= 4) else 2 if lit < -.28 else 1
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
        zo = getattr(s, 'zoff', 0.0)
        J = {'pel': add(pose['pel'], (0, 0, zo))}
        J['neck'] = add(J['pel'], R((0, 0, s.torso_len)))
        J['waist'] = add(J['pel'], R((0, 0, s.waist)))
        for side, sg in (('R', 1), ('L', -1)):
            sh = yaw((s.sh[0], sg * s.sh[1], s.sh[2]), tw)
            J['sh' + side] = add(J['neck'], R(sh))
            J['hp' + side] = add(J['pel'], R((0, sg * s.hip_w, -s.hip_drop)))
            ft, _st = pose['foot'][side][:2]
            J['kn' + side], J['ft' + side] = ik(J['hp' + side], ft, s.thigh, s.shin, R(pose.get('knee_pole', (1, 0.15 * sg, 0))))
            ha = pose['hand'][side]
            pole = ha[2] if len(ha) > 2 and ha[2] else (-1, sg * 0.6, -0.3)
            J['el' + side], J['ha' + side] = ik(J['sh' + side], add(ha[0], (0, 0, zo)), s.upper, s.fore, pole)
        J['chest'] = lerpv(J['pel'], J['neck'], 0.6)
        return J

def render_corpse(T, pose, view):
    """lying frames: a hand-drawn body (head, chest, hips) with limbs drawn to 2D points (frame coordinates)"""
    cv = Canvas(T.w, T.h)
    body = T.corpse[view]
    off = add(T.corpse_off, pose.get('corpse_d', (0, 0)))
    stamp(cv, body, (0, 0), off, 5, 'torso')
    A = lambda n: add(off, body.a[n])
    near = 'R' if view == 'F' else 'L'
    L2 = pose['limbs2d'][view] if view in pose['limbs2d'] else pose['limbs2d']
    for side in SIDES:
        dark = 0 if side == near else 1
        dep = 8 if side == near else 1
        st = T.arms[side] if 'R' in T.arms else T.arms
        el, ha, hk = L2['arm' + side]
        stroke(cv, A('sh' + side), el, dep, dep, st['upper_prof'], st['upper_paint'](dark), 'armN' if dark == 0 else 'armF')
        stroke(cv, el, ha, dep, dep, st['fore_prof'], st['fore_paint'](dark), 'armN' if dark == 0 else 'armF')
        stamp(cv, pick_hand(T.hands[hk], hand_dir(el, ha)), 'wrist', ha, dep + 1, 'armN' if dark == 0 else 'armF', remap=T.far_remap if dark else None)
        lg = T.legs[side] if 'R' in T.legs else T.legs
        kn, ft, fs = L2['leg' + side]
        bk = proj(view, (-1, 0, 0))
        stroke(cv, A('hp' + side), kn, dep - 4, dep - 4, lg['thigh_prof'], lg['thigh_paint'](dark), 'legN' if dark == 0 else 'legF', bulge=bk)
        stroke(cv, kn, ft, dep - 4, dep - 4, lg['shin_prof'], lg['shin_paint'](dark), 'legN' if dark == 0 else 'legF', bulge=bk)
        stamp(cv, T.feet[view][lg.get('foot', 'shoe')][fs], 'ankle', ft, dep - 3, 'legN' if dark == 0 else 'legF', remap=T.far_remap if dark else None)
    if hasattr(T, 'corpse_extra'): T.corpse_extra(cv, view, pose, A)
    if pose.get('pud'): puddle(cv, T.ax - 3, T.ay - 3, 6 + 3 * pose['pud'], 2.2 + 0.8 * pose['pud'], 3)
    top = A('top')
    return cv, (rnd(top[0]), rnd(top[1]))

def render_bodyfn(T, pose, view, cv, J, P, D, near):
    """types whose torso is ray-cast from ellipsoids (it swells): limbs and head attach to projected joints"""
    rig = T.rig
    ells = T.body_fn(T, pose, J, view)
    render_ells(cv, ells, view, T.ax, T.ay, depth_bias=0.0, keep=T.keep_letters)
    hdb = T.head[view][pose.get('expr', 'idle')]
    hpos = add(P['neck'], proj(view, pose.get('head', (0, 0, 0))))
    hrot = pose.get('head_rot', 0) * (1 if view == 'F' else -1)
    hM = rotm(math.radians(hrot)) if abs(hrot) > 4 else None
    stamp(cv, hdb, 'neck', hpos, D['neck'] + rig.head_depth, 'head', hM)
    top = add((rnd(hpos[0]), rnd(hpos[1])), apply2(hM or ((1, 0), (0, 1)), sub(hdb.a['top'], hdb.a['neck'])))
    for side in SIDES:
        isnear = side == near
        dark = 0 if isnear else 1
        tag = 'N' if isnear else 'F'
        T.leg(cv, view, side, P['hp' + side], P['kn' + side], P['ft' + side], D['hp' + side], D['kn' + side], D['ft' + side], dark, 'leg' + tag, pose, J)
        T.arm(cv, view, side, P['sh' + side], P['el' + side], P['ha' + side], D['sh' + side], D['el' + side], D['ha' + side], dark, 'arm' + tag, pose, J)
    if hasattr(T, 'extra'): T.extra(cv, view, pose, J, P, D, None)
    if pose.get('fx'): pose['fx'](cv, view, pose, J, P, D, None)
    return cv, (rnd(top[0]), rnd(top[1]))

def render_biped(T, pose, view):
    """one frame of a biped type T in a view; returns (canvas, head_top)"""
    if getattr(T, 'render', None): return T.render(T, pose, view)
    if pose.get('corpse'): return render_corpse(T, pose, view)
    rig = T.rig
    cv = Canvas(T.w, T.h)
    J = rig.joints(pose)
    # chest bitmaps are drawn for given lean angles: take the closest and only shear the difference
    chest_set, chest_lean = getattr(T, 'chest', None), rig.lean0
    if getattr(T, 'chests', None):
        lean_now = pose.get('lean', rig.lean0)
        chest_lean, chest_set = min(T.chests, key=lambda c: abs(c[0] - lean_now))
    base = rig.joints({**pose, 'lean': chest_lean, 'roll': 0, 'twist': 0, 'yaw': 0})
    P = {k: (T.ax + proj(view, v)[0], T.ay + proj(view, v)[1]) for k, v in J.items()}
    D = {k: depth(view, v) for k, v in J.items()}
    near = 'R' if view == 'F' else 'L'
    pv = lambda J_, a, b: sub(proj(view, J_[b]), proj(view, J_[a]))
    if getattr(T, 'body_fn', None):
        return render_bodyfn(T, pose, view, cv, J, P, D, near)
    # hips: follow the pelvis (only its own tilt), chest: follows the spine and the shoulder line
    hb = pose.get('hips', T.hips)[view]
    pel2 = (rnd(P['pel'][0]), rnd(P['pel'][1]))
    HMx = pose['hips_M'](view) if pose.get('hips_M') else None
    stamp(cv, hb, 'pel', pel2, D['pel'] + rig.hips_depth, 'hips', HMx)
    hip_anc = lambda name: add(pel2, apply2(HMx or ((1, 0), (0, 1)), sub(hb.a[name], hb.a['pel'])))
    tb = pose.get('chest', chest_set)[view]
    # the chest follows the projected spine: a row shear for small tilts (keeps the drawing intact),
    # a pixel-art rotation for big ones (falling), shortened along the spine when it points into the screen
    s0, s1 = pv(base, 'waist', 'neck'), pv(J, 'waist', 'neck')
    dth = math.atan2(s1[1], s1[0]) - math.atan2(s0[1], s0[0])
    dth = (dth + math.pi) % (2 * math.pi) - math.pi
    ratio = clamp(vlen(s1) / max(vlen(s0), 1e-6), 0.55, 1.15)
    if abs(dth) < math.radians(3): dth = 0.0
    if abs(dth) < math.radians(36) and not pose.get('yaw'):
        M = ((1, -math.tan(dth) * ratio), (0, ratio))
    else:   # tipping over: the true affine of the spine and shoulder line (a fall keeps the shoulders along s)
        M = mat2((s0, pv(base, 'shL', 'shR')), (s1, pv(J, 'shL', 'shR')))
    if abs(ratio - 1) < 0.08 and dth == 0: M = ((1, 0), (0, 1))
    if pose.get('chest_M'): M = pose['chest_M'](view)
    waist2 = (rnd(P['waist'][0]), rnd(P['waist'][1]))
    td = D['chest'] + rig.torso_depth
    stamp(cv, tb, 'waist', waist2, td, 'torso', M)
    anc = lambda name: add(waist2, apply2(M, sub(tb.a[name], tb.a['waist'])))
    # head
    hdb = T.head[view][pose.get('expr', 'idle')]
    hoff = proj(view, pose.get('head', (0, 0, 0)))
    hpos = add(anc('neck'), hoff)
    hrot = math.degrees(dth) + pose.get('head_rot', 0) * (1 if view == 'F' else -1)
    hM = rotm(math.radians(hrot)) if abs(hrot) > 4 else None
    if pose.get('head_follow'): hM = M
    if pose.get('head_M'): hM = pose['head_M'](view)
    stamp(cv, hdb, 'neck', hpos, td + rig.head_depth, 'head', hM)
    top = add((rnd(hpos[0]), rnd(hpos[1])), apply2(hM or ((1, 0), (0, 1)), sub(hdb.a['top'], hdb.a['neck'])))
    # limbs
    for side in SIDES:
        isnear = side == near
        dark = 0 if isnear else 1
        tag = 'N' if isnear else 'F'
        T.leg(cv, view, side, hip_anc('hp' + side), P['kn' + side], P['ft' + side], D['hp' + side], D['kn' + side], D['ft' + side], dark, 'leg' + tag, pose, J)
        T.arm(cv, view, side, anc('sh' + side), P['el' + side], P['ha' + side], D['sh' + side], D['el' + side], D['ha' + side], dark, 'arm' + tag, pose, J)
    if hasattr(T, 'extra'): T.extra(cv, view, pose, J, P, D, anc)
    return cv, (rnd(top[0]), rnd(top[1]))

# ------------------------------------------------------------------ finishing passes
SEAMS = {('armN', 'torso'), ('armN', 'hips'), ('armN', 'head'), ('legN', 'legF'), ('head', 'torso'), ('armN', 'armF')}

def deep_map(far_remap):
    """each letter's darkest relative along its ramp (used for seams inside the figure)"""
    out = {}
    for ch in set(far_remap) | set(far_remap.values()):
        d, seen = ch, set()
        while d in far_remap and d not in seen: seen.add(d); d = far_remap[d]
        out[ch] = d
    return out

def finish(cv, seams=SEAMS, keep=(), deep=None):
    """drop stray single pixels, darken the back part where a front part overlaps it (its own darkest tone,
    so the seam reads as a fold rather than a black line), then the 1 px outline round the silhouette"""
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
    for k in seam:
        ch = c[k]
        out[k] = deep.get(ch, ch) if deep else 'o'
    for (x, y) in list(c):
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in c and 0 <= q[0] < cv.w and 0 <= q[1] < cv.h: out[q] = 'o'
    cv.c = out
    return cv

# ------------------------------------------------------------------ biped types
def hand_dir(el, ha):
    return math.atan2(ha[1] - el[1], ha[0] - el[0])

HAND_DIRS = ['R', 'DR', 'D', 'DL', 'L', 'UL', 'U', 'UR']
def pick_hand(hset, a):
    """hands are drawn for R, DR, D, UR, U (screen directions, y down); the left-pointing ones are mirrors"""
    d = HAND_DIRS[int(math.floor(a / (math.pi / 4) + 0.5)) % 8]
    if d in hset: return hset[d]
    return hset[{'DL': 'DR', 'L': 'R', 'UL': 'UR'}[d]].flip()

class Biped:
    """a zombie type on the biped rig: palette, bitmaps, limb styles and its animations"""
    def __init__(s, **kw):
        s.__dict__.update(kw)
    # legs ----------------------------------------------------------
    def leg(s, cv, view, side, hip, kn, ft, dh, dk, df, dark, part, pose, J):
        back = proj(view, (-1, 0, 0)); front = proj(view, (1, 0, 0))
        st = s.legs[side] if 'R' in s.legs else s.legs
        stroke(cv, hip, kn, dh + .6, dk + .6, st['thigh_prof'], st['thigh_paint'](dark), part, bulge=back, front=front)
        stroke(cv, kn, ft, dk + .6, df + .6, st['shin_prof'], st['shin_paint'](dark), part, bulge=back, front=front)
        state = pose['foot'][side][1]
        fb = s.feet[view][st.get('foot', 'shoe')][state]
        remap = s.far_remap if dark else None
        stamp(cv, fb, 'ankle', ft, df + 1.0, part, remap=remap)
    # arms ----------------------------------------------------------
    def arm(s, cv, view, side, sh, el, ha, dsh, de, dha, dark, part, pose, J):
        st = s.arms[side] if 'R' in s.arms else s.arms
        back = proj(view, (-1, 0, 0)); front = proj(view, (1, 0, 0))
        stroke(cv, sh, el, dsh + .6, de + .6, st['upper_prof'], st['upper_paint'](dark), part, bulge=back, front=front)
        stroke(cv, el, ha, de + .6, dha + .6, st['fore_prof'], st['fore_paint'](dark), part, bulge=back, front=front)
        kind = pose['hand'][side][1] if len(pose['hand'][side]) > 1 and pose['hand'][side][1] else st.get('hand', 'claw')
        hb = pick_hand(s.hands[kind], hand_dir(el, ha))
        remap = s.far_remap if dark else None
        stamp(cv, hb, 'wrist', ha, dha + 1.2, part, remap=remap)

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
    'H': (104, 88, 74), 'h': (72, 60, 58), 'E': (250, 250, 214), 'e': (176, 206, 160),
    'M': (58, 22, 32), 'T': (222, 208, 170), 'R': (164, 52, 44), 'B': (120, 30, 30), 'b': (82, 22, 34),
    'I': (214, 204, 164), 'i': (150, 144, 126), 'n': (128, 112, 80), 'o': OUTLINE,
}
SKIN, SHIRT, JEANS, SHOE = Ramp('kSsq'), Ramp('WCcx'), Ramp('UPpu'), Ramp('GFfg')

def walker_type():
    rig = Rig(ankle=1.5, shin=5.7, thigh=5.9, hip_w=1.5, hip_drop=0.5, torso_len=9.0, waist=2.2, lean0=16, sh=(-0.6, 4.3, -1.2),
              upper=5.0, fore=4.6, torso_depth=2.2, hips_depth=1.6, head_depth=1.5, zoff=-0.6)
    hipsF = Bmp("""
        .UPPPPPp
        UUPPPPpp
        UPPPPPpu
        .UPPPpu.
        ..PPpu..
    """, pel=(4, 2), hpR=(2.7, 3.06), hpL=(5.14, 1.83))
    hipsB = Bmp("""
        pPPPPPU.
        ppPPPPUU
        upPPPPPU
        .upPPPU.
        ..upPP..
    """, pel=(4, 2), hpR=(5.31, 1.92), hpL=(2.86, 3.14))
    chestF = Bmp("""
        ........WCc.
        .....WWcCCcx
        ...WWCqcBCcx
        .WWCCCcbBCcc
        WWCCCCCcbCcx
        WCCCCCckScxx
        WCCCCckIsqcx
        .CCCCcIsqcc.
        .CCCCCccCcc.
        .CcCCCcCcCc.
    """, waist=(5, 8), neck=(6.53, 2.23), shR=(2.28, 4.6), shL=(9.3, 1.09))
    chestB = Bmp("""
        ....sSWCc...
        ...WCCCCCCc.
        ..WWCCCcCCcx
        .WWCCCcCCCcx
        WWCCCCCCcCcx
        WCCCCxkxCccx
        WCCCxkSxBccx
        WCCCCxkxbcx.
        .CCcCCxCccx.
        .CcxCcCxcx..
    """, waist=(6, 9), neck=(4.47, 2.7), shR=(8.72, 1.3), shL=(1.7, 4.81))
    headF = Bmp("""
        ..hhHk..
        .hHSkkSk
        hHsqqSqq
        HSkqEeqE
        qSSSSsSs
        .qsSMMMs
        ..qSMTMq
        ...qsMs.
    """, neck=(3, 7), top=(4, 0))
    headB = Bmp("""
        ..kSSs..
        .kSSSSHh
        kSSsSHhh
        SSHsHHHh
        kqHHhHHh
        sqhHHHhh
        .qsHHhh.
        ..qssS..
    """, neck=(4, 7), top=(4, 0))
    headF_bite = Bmp("""
        ..hhHk..
        .hHSkkSk
        hHsqqSqq
        HSkqEeqE
        qSSSSsMM
        .qsSMMMM
        ..qSMTMM
        ..qsMMTs
        ...qsss.
    """, neck=(3, 7), top=(4, 0))
    headF_hurt = Bmp("""
        ..hhHk..
        .hHSkkSk
        hHsqqSqq
        HSkqeqqe
        qSSSSsSs
        .qsSMMMs
        ..qSMMMq
        ...qsMs.
    """, neck=(3, 7), top=(4, 0))
    headF_dead = Bmp("""
        ..hhHk..
        .hHSkkSk
        hHsqqSqq
        HSkqqsqq
        qSSSSsSs
        .qsSMMMs
        ..qSMTMq
        ...qsMs.
    """, neck=(3, 7), top=(4, 0))
    HANDS = {
     'claw': {
      'R': Bmp("""
        .kSn.
        SSSS.
        SsSsn
        .sn..
      """, wrist=(0, 1.5)),
      'DR': Bmp("""
        kS...
        SSSn.
        sSSs.
        .s.sn
        ..n..
      """, wrist=(0.5, 0.5)),
      'D': Bmp("""
        kSS.
        SSSs
        SsSs
        n.n.
        ...n
      """, wrist=(1.5, 0)),
      'UR': Bmp("""
        ..n.n
        .kS..
        kSSsn
        SSs..
        ss...
      """, wrist=(0.5, 4)),
      'U': Bmp("""
        n.n.
        kS.n
        SSSs
        SSs.
        .ss.
      """, wrist=(1.5, 4)),
     },
     'limp': {
      'R': Bmp("""
        kSS.
        SSSs
        .n.n
      """, wrist=(0, 0.5)),
      'DR': Bmp("""
        kS..
        SSSs
        .sSs
        ..n.
      """, wrist=(0.5, 0.5)),
      'D': Bmp("""
        kS.
        SSs
        SSs
        n.n
      """, wrist=(1, 0)),
      'UR': Bmp("""
        .Ss.
        kSSn
        SSs.
      """, wrist=(0.5, 2)),
      'U': Bmp("""
        n.n
        SSs
        kSs
        .S.
      """, wrist=(1, 3)),
     }}
    shoeF = {'flat': Bmp("""
        FF...
        GFFF.
        .fFFF
        ..fff
    """, ankle=(1, 1)), 'toe': Bmp("""
        FF..
        GFF.
        .fFf
        ..ff
    """, ankle=(1, 1)), 'air': Bmp("""
        FF...
        GFFF.
        .fFff
    """, ankle=(1, 1))}
    shoeB = {'flat': Bmp("""
        fF...
        fFFF.
        .FFFF
        ..fFf
    """, ankle=(3, 1)), 'toe': Bmp("""
        fF..
        fFF.
        .FFF
        ..Ff
    """, ankle=(2, 1)), 'air': Bmp("""
        fF...
        fFFF.
        .fFFf
    """, ankle=(3, 1))}
    corpseF = Bmp("""
        .hhHk...........
        hHkSSk..........
        hSqqSSs.........
        hSqqqSs..WCc....
        .SSsSsMM.CCCcx..
        ..qssMTMWCCBCcx.
        ..kWWqsWCCbCCCcx
        ..WCCCCCCxkIxCcU
        ...WCCCCxIsqxCUP
        .....WCCCCxxcUPP
        .......ccCcUPPPp
        .........UUPPpp.
    """, pel=(13, 9), shR=(3, 6.5), shL=(10, 3.5), hpR=(11.8, 9.6), hpL=(14.2, 8.4), top=(1, 0))
    corpseB = Bmp("""
        .hhHh...........
        hHHhHh..........
        hHhHHHs.........
        kHHhHHs..CCc....
        .kSHHhsx.CCCcx..
        ..qsSSsxCCCCCcx.
        ..WWWqsCCCxkxCcx
        ..WCCCCCCCxSxCcU
        ...WCCCCCCCxCCUP
        .....WCCCCCCcUPP
        .......ccCcUPPPp
        .........UUPPpp.
    """, pel=(13, 9), shR=(10, 3.5), shL=(3, 6.5), hpR=(14.2, 8.4), hpL=(11.8, 9.6), top=(1, 0))
    bare = lambda b: Bmp([r.replace('F', 'S').replace('G', 'k').replace('f', 's').replace('g', 'q') for r in b.rows], **b.a)
    footF = {k: bare(b) for k, b in shoeF.items()}
    footB = {k: bare(b) for k, b in shoeB.items()}

    def leg_style(hem, foot):
        return {'thigh_prof': lambda t: (lerp(1.9, 1.55, t), 0.3 * (1 - t), 0.2 * bump(t, 0.4, 0.5)),
                'thigh_paint': lambda dark: cloth_paint(JEANS, dark, folds=(0.85,)),
                'shin_prof': lambda t: ((1.6 + 0.15 * t) if t < hem else lerp(1.0, 0.75, (t - hem) / max(.01, 1 - hem)),
                                        0.35 * bump(t, 0.35, 0.3) if t >= hem else 0, 0),
                'shin_paint': lambda dark: hem_paint_of(JEANS, SKIN, hem, dark),
                'foot': foot}
    def arm_style(sleeve):
        return {'upper_prof': lambda t: (lerp(1.25, 1.0, t), 0.1, 0.2 * bump(t, 0.5, 0.4)),
                'upper_paint': lambda dark: hem_paint_of(SHIRT, SKIN, sleeve, dark),
                'fore_prof': lambda t: (lerp(0.9, 0.6, t), 0.2 * bump(t, 0.25, 0.3), 0),
                'fore_paint': lambda dark: (lambda t, c, n, k, x, y, lit: shade(SKIN, n, lit, dark, allow_hi=False))}
    return Biped(name='walker', w=32, h=32, ax=17, ay=28, pal=WALKER_PAL, rig=rig,
                 hips={'F': hipsF, 'B': hipsB}, chest={'F': chestF, 'B': chestB},
                 head={'F': {'idle': headF, 'bite': headF_bite, 'hurt': headF_hurt, 'dead': headF_dead},
                       'B': {'idle': headB, 'bite': headB, 'hurt': headB, 'dead': headB}},
                 hands=HANDS, corpse={'F': corpseF, 'B': corpseB}, corpse_off=(2, 14),
                 feet={'F': {'shoe': shoeF, 'bare': footF}, 'B': {'shoe': shoeB, 'bare': footB}},
                 legs={'R': leg_style(0.32, 'bare'), 'L': leg_style(0.95, 'shoe')},
                 arms={'R': arm_style(0.5), 'L': arm_style(0.42)},
                 far_remap=far_remap_of(['kSsq', 'WCcx', 'UPpu', 'GFfg', 'Hh', 'RBb', 'Ii']),
                 anims={'walk': (6.2, True, walker_walk), 'attack': (10, False, walker_attack),
                        'die': (9, False, walker_die), 'hit': (8, False, walker_hit)})

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
            'hand': {'R': ((3.4 + swing, 3.6, z - 1.2), 'limp', (-1, .4, 0)),
                     'L': ((7.4, -3.2, 15.6 + (z - 13.0)), 'claw', (0, -0.6, -1))},
            'head': (0.3, 0.3 * math.sin(2 * math.pi * ph), -1.6),
        })
    return poses

def walker_attack(T):
    """wind up (rear back, hands up), lunge with both claws and a bite, recover"""
    P = []
    keys = [  # lean, pel f, pel z, hands R/L (f, s, z), head offset, expr
        (12, -0.6, 12.8, (1.0, 4.6, 19.0), (1.5, -4.0, 19.4), (0.4, 0, -1.2), 'idle'),
        (8, -1.0, 12.9, (0.2, 4.4, 20.0), (0.8, -4.2, 20.4), (0.0, 0, -1.0), 'bite'),
        (28, 1.2, 12.6, (9.0, 2.2, 15.0), (9.5, -2.0, 15.5), (2.6, 0, -2.4), 'bite'),
        (32, 1.6, 12.3, (8.4, 2.6, 12.0), (9.0, -1.6, 12.4), (2.8, 0, -2.6), 'bite'),
        (20, 0.6, 12.8, (5.0, 4.2, 13.5), (7.8, -3.0, 16.0), (1.6, 0, -1.8), 'idle'),
    ]
    for lean, pf, pz, hr, hl, hd, ex in keys:
        P.append({'pel': (pf, 0, pz), 'lean': lean, 'expr': ex, 'head': hd,
                  'foot': {'R': ((2.6, 1.4, 1.5), 'flat'), 'L': ((-2.2, -1.4, 1.5), 'flat')},
                  'hand': {'R': (hr, 'claw', (-0.6, 0.6, -1)), 'L': (hl, 'claw', (-0.6, -0.6, -1))}})
    return P

def walker_hit(T):
    return [{'pel': (-0.6, 0, 12.7), 'lean': 10, 'expr': 'hurt', 'head': (-0.6, 0, -1.2), 'head_rot': -10,
             'foot': {'R': ((1.2, 1.4, 1.5), 'flat'), 'L': ((-1.8, -1.4, 1.5), 'flat')},
             'hand': {'R': ((1.0, 6.0, 15.0), 'claw', (-1, .5, 0)), 'L': ((4.0, -6.0, 17.0), 'claw', (0, -1, -1))}}]

def hands_from_shoulders(T, pose, offs):
    """set hand targets relative to where the shoulders end up in this pose"""
    tmp = {**pose, 'hand': {'R': ((0, 4, 10),), 'L': ((0, -4, 10),)}}
    J = T.rig.joints(tmp)
    hand = {}
    zo = getattr(T.rig, 'zoff', 0.0)
    for side in SIDES:
        o, kind, pole = offs[side]
        hand[side] = (add(J['sh' + side], add(o, (0, 0, -zo))), kind, pole)
    return {**pose, 'hand': hand}

def walker_die(T, view):
    """stagger, buckle, fall (back in F, forward in B: both land towards the upper left), lie flat"""
    sg = -1 if view == 'F' else 1          # direction of the fall along f
    yw = math.radians(22)
    fr = []
    # 0 stagger: thrown back by the hit, head snaps back, arms fly up
    fr.append({'pel': (-0.6, 0, 12.7), 'lean': 10, 'expr': 'hurt', 'head': (-0.6, 0, -1.2), 'head_rot': -12,
               'foot': {'R': ((1.2, 1.4, 1.5), 'flat'), 'L': ((-1.4, -1.4, 1.5), 'flat')},
               'hand': {'R': ((0.5, 6.5, 16.5), 'claw', (-1, 1, 0)), 'L': ((2.5, -6.5, 18.0), 'claw', (0, -1, -1))}})
    # 1 knees give way, body sags towards the fall
    fr.append(hands_from_shoulders(T, {'pel': (sg * 0.8, 0, 10.8), 'lean': 16 + sg * 16, 'yaw': yw * 0.3, 'expr': 'hurt',
               'head': (sg * 0.6, 0, -0.4), 'head_rot': -8,
               'foot': {'R': ((1.4, 1.5, 1.5), 'flat'), 'L': ((-1.0, -1.5, 1.5), 'toe')}},
               {'R': ((sg * 1.0, 1.5, -6.5), 'limp', (-1, 1, 0)), 'L': ((sg * 1.5, -1.5, -6.0), 'limp', (0, -1, -1))}))
    # 2 crumples: sits down on its heels while tipping over
    fr.append(hands_from_shoulders(T, {'pel': (sg * 1.8, 0, 7.4), 'lean': 16 + sg * 30, 'expr': 'dead',
               'head': (sg * 0.8, 0, -0.6), 'head_rot': -10 if view == 'F' else 6,
               'foot': {'R': ((2.2, 1.6, 1.5), 'flat'), 'L': ((0.4, -1.6, 1.5), 'toe')}},
               {'R': ((sg * 1.5, 2.5, -5.0), 'limp', (0, 1, -1)), 'L': ((sg * 2.0, -2.5, -4.0), 'limp', (0, -1, -1))}))
    # 3 lands: body on the ground, legs and arms still up; 4 bounce; 5 lies flat
    def limbs(view, k):
        lift = [2.0, 0.8, 0.0][k]
        if view == 'F':
            return {'armR': ((2, 24 - lift), (3, 26.5 - lift * 1.2), 'limp'), 'armL': ((16, 15 - lift), (20, 15 - lift * .5), 'limp'),
                    'legR': ((14, 26 - lift * 1.5), (19, 26.5 - lift), 'flat' if k else 'air'), 'legL': ((21, 23 - lift * 1.5), (24, 25.5 - lift), 'flat' if k else 'air')}
        return {'armL': ((2, 24 - lift), (3, 26.5 - lift * 1.2), 'limp'), 'armR': ((16, 15 - lift), (20, 15 - lift * .5), 'limp'),
                'legL': ((15, 26.5 - lift * 1.5), (19.5, 26.5 - lift), 'flat' if k else 'air'), 'legR': ((20, 24 - lift * 1.5), (23.5, 25 - lift), 'flat' if k else 'air')}
    fr.append({'corpse': 1, 'corpse_d': (0, -1), 'limbs2d': limbs(view, 0)})
    fr.append({'corpse': 1, 'corpse_d': (0, 0), 'limbs2d': limbs(view, 1)})
    fr.append({'corpse': 1, 'corpse_d': (0, 0), 'limbs2d': limbs(view, 2)})
    return fr

# ------------------------------------------------------------------ building a type
def bake_biped(T):
    anims = {}
    for name, (fps, loop, fn) in T.anims.items():
        anims[name] = {'fps': fps, 'loop': loop}
        for view in 'FB':
            poses = fn(T, view) if fn.__code__.co_argcount == 2 else fn(T)
            frames = []
            deep = deep_map(T.far_remap)
            for p in poses:
                cv, top = render_biped(T, p, view)
                finish(cv, deep=deep, keep=('gore',))
                frames.append({'rows': cv.rows(), 'head': [top[0], top[1]]})
            anims[name][view] = frames
    return {'w': T.w, 'h': T.h, 'ax': T.ax, 'ay': T.ay, 'pal': {k: list(v) for k, v in T.pal.items()}, 'anims': anims}

def sheet_of(name, spr, path, sc=6):
    """walk / attack / die / hit, F row then B row each"""
    rows_list, cols = [], 8
    for anim in ('walk', 'attack', 'die', 'hit'):
        if anim not in spr['anims']: continue
        for view in 'FB':
            fr = spr['anims'][anim][view]
            rows_list += [f['rows'] for f in fr] + [None] * (cols - len(fr))
    blank = ['.' * spr['w']] * spr['h']
    rows_list = [r if r else blank for r in rows_list]
    return save_sheet(path, rows_list, spr['pal'], sc=sc, cols=cols)

# ================================================================== shared limb painters
def hem_paint_of(cloth, skin, hem, dark, folds=(), skin_hi=False, ragged=0.1):
    """cloth from the top of the segment down to a ragged hem, bare skin below"""
    def paint(t, c, n, k, x, y, lit):
        jag = hem + ragged * (((x * 5 + y * 3) % 3) - 1)
        if t < jag:
            dk = dark + (1 if any(abs(t - f) < .09 and c > -.2 for f in folds) else 0)
            if t > jag - .12: dk += 1
            return shade(cloth, n, lit, dk)
        return shade(skin, n, lit, dark, allow_hi=skin_hi)
    return paint

def skin_paint(skin, hi_at=None, creases=(), veins=(), vein_letter=None):
    """bare limb: a lit ridge only where a muscle or bone stands out (hi_at = (t0, t1) or a list of them);
    creases = (t, c0, c1): a darker line across part of the limb where two muscles meet;
    veins = (t0, t1, c): a dark thread running along it"""
    spans = [] if hi_at is None else ([hi_at] if isinstance(hi_at[0], (int, float)) else list(hi_at))
    def mk(dark):
        def paint(t, c, n, k, x, y, lit):
            allow = any(a <= t <= b for a, b in spans)
            dk = dark
            for (tc, c0, c1) in creases:
                if abs(t - tc) < 0.07 and c0 <= c <= c1 and n >= 3: dk += 1
            if n >= 4:
                for (t0, t1, cv_) in veins:
                    if t0 <= t <= t1 and abs(c - cv_ - 0.15 * math.sin(t * 9)) < 0.22:
                        return vein_letter or skin(1 + dk + 1)
            return shade(skin, n, lit, dk, allow_hi=allow)
        return paint
    return mk

# ================================================================== RUNNER
RUNNER_PAL = {
    'k': (190, 188, 112), 'S': (150, 156, 92), 's': (110, 118, 84), 'q': (76, 76, 82),
    'Y': (234, 136, 86), 'A': (198, 88, 60), 'a': (142, 58, 60), 'x': (94, 40, 56),
    'W': (230, 226, 206), 'w': (176, 172, 164), 'n': (60, 56, 70),
    'U': (88, 90, 116), 'P': (60, 62, 86), 'p': (44, 44, 64), 'u': (32, 30, 46),
    'G': (238, 234, 222), 'F': (198, 196, 186), 'f': (140, 140, 146), 'g': (96, 96, 108), 'c': (64, 164, 164),
    'J': (190, 108, 72), 'H': (150, 74, 50), 'h': (100, 48, 44), 'E': (250, 250, 214), 'e': (176, 206, 160),
    'M': (58, 22, 32), 'T': (222, 208, 170), 'R': (164, 52, 44), 'B': (120, 30, 30), 'b': (82, 22, 34),
    'I': (214, 204, 164), 'i': (150, 144, 126), 'N': (128, 112, 80), 'o': OUTLINE,
}
RSKIN, TANK, SHORTS, RSHOE = Ramp('kSsq'), Ramp('YAax'), Ramp('UPpu'), Ramp('GFfg')

def runner_type():
    rig = Rig(ankle=1.4, shin=6.2, thigh=6.4, hip_w=1.3, hip_drop=0.5, torso_len=8.6, waist=2.0, lean0=40, sh=(-0.4, 3.6, -1.0),
              upper=4.8, fore=4.4, torso_depth=2.0, hips_depth=1.6, head_depth=1.5)
    hipsF = Bmp("""
        .UPPPp.
        UPPPPpp
        UPPPPpu
        .UPPpu.
    """, pel=(3, 2), hpR=(1.75, 2.88), hpL=(3.87, 1.81))
    hipsB = Bmp("""
        .pPPPU.
        ppPPPPU
        upPPPPU
        .upPPU.
    """, pel=(3, 2), hpR=(4.25, 2.01), hpL=(2.13, 3.07))
    chestF = Bmp("""
        .......kS.
        .....kSSSs
        ..kSSYAAs.
        .kSYAAWWas
        kSsAAWnWa.
        SsAAAwWwa.
        .sAAAaaa..
        ..aAax....
    """, waist=(2, 6), neck=(5.46, 2.68), shR=(1.75, 4.27), shL=(7.63, 1.33))
    chestB = Bmp("""
        ..kSk.kS
        .kSSASSs
        kSSYAAAs
        SsYAAAAa
        .sAAAAaa
        ..AAAAaa
        ..aAAAa.
        ...aAAa.
        ....aAa.
    """, waist=(6, 8), neck=(2.54, 1.21), shR=(6.25, 0.64), shL=(0.37, 3.58))
    chestF_up = Bmp("""
        .......kS.
        .....kSSSs
        ...kSSYAs.
        ..kSYAAAas
        .kSYAWWWa.
        .SsAAWnWa.
        ..sAAwWwa.
        ..aAAAAaa.
        ..aAaAaa..
        ...aAxa...
    """, waist=(4, 8), neck=(5.12, 2.1), shR=(1.69, 4.22), shL=(7.57, 1.29))
    chestB_up = Bmp("""
        ...kSk.kS.
        ..kSSASSs.
        .kSSYAAASs
        .SsYAAAAa.
        ..sAAAAaa.
        ..aAAAAaa.
        ..aAAAAa..
        ..aAAAaa..
        ...aAxa...
    """, waist=(5, 8), neck=(3.88, 0.98), shR=(7.31, 0.65), shL=(1.43, 3.59))
    headF = Bmp("""
        ....hHHh.
        ...hHHkSS
        JhhHkSSSS
        hHh.SsqSq
        .h..SkEsE
        ....qSSsS
        ....sMMMs
        .....qTMq
    """, neck=(5, 7), top=(6, 0))
    headF_bite = Bmp("""
        ....hHHh.
        ...hHHkSS
        JhhHkSSSS
        hHh.SsqSq
        .h..SkEsE
        ....qSSMM
        ....sMMMM
        .....qTMM
        ......qsM
    """, neck=(5, 7), top=(6, 0))
    headF_hurt = Bmp("""
        ....hHHh.
        ...hHHkSS
        JhhHkSSSS
        hHh.SsqSq
        .h..Skeqe
        ....qSSsS
        ....sMMMs
        .....qsMq
    """, neck=(5, 7), top=(6, 0))
    headF_dead = Bmp("""
        ....hHHh.
        ...hHHkSS
        JhhHkSSSS
        hHh.SsqSq
        .h..Skqsq
        ....qSSsS
        ....sMMMs
        .....qTMq
    """, neck=(5, 7), top=(6, 0))
    headB = Bmp("""
        ..hHHJ..
        .hHJHHh.
        kHHHJHh.
        SkHhHHh.
        sqHHHHh.
        .qhHHh..
        ...hHh..
        ...hHh..
        ....Hh..
        ....h...
    """, neck=(4, 5), top=(4, 0))
    corpseF = Bmp("""
        .hhHJ...........
        hHJhHk..........
        hHhSSSk.........
        hJqqSSs.........
        .hSqqSs..kS.....
        ..sSsMMskSSs....
        ...qMTMYAAAas...
        ..kSqsYAWWWAas..
        ..SSYAAAWnWAaU..
        ...sAAAAwWwaUPP.
        .....aAAAaaUPPPp
        .......aaxUPPPp.
        .........UUPpp..
    """, pel=(13, 10), shR=(3, 7.5), shL=(10, 4.5), hpR=(11.8, 10.6), hpL=(14.2, 9.4), top=(1, 0))
    corpseB = Bmp("""
        .hhHJ...........
        hHJhHh..........
        hHhJHHs.........
        kHHhJHs.........
        .kHHhHs..kS.....
        ..qhHhSskSSs....
        ...qhSSYAAAas...
        ..kSSSYAAAAAas..
        ..SSYAAAAaAAaU..
        ...sAAAAAAAaUPP.
        .....aAAAaaUPPPp
        .......aaxUPPPp.
        .........UUPpp..
    """, pel=(13, 10), shR=(10, 4.5), shL=(3, 7.5), hpR=(14.2, 9.4), hpL=(11.8, 10.6), top=(1, 0))
    shoeF = {'flat': Bmp("""
        GF...
        GFFc.
        .fFFF
        ..ggf
    """, ankle=(1, 1)), 'toe': Bmp("""
        GF..
        GFc.
        .fFF
        ..gf
    """, ankle=(1, 1)), 'air': Bmp("""
        GF...
        GFcF.
        .ggff
    """, ankle=(1, 1))}
    shoeB = {'flat': Bmp("""
        fG...
        fFFG.
        .cFFG
        ..fgg
    """, ankle=(3, 1)), 'toe': Bmp("""
        fG..
        fFG.
        .cFG
        ..gg
    """, ankle=(2, 1)), 'air': Bmp("""
        fG...
        fFFG.
        .gcFG
    """, ankle=(3, 1))}
    hands = {k: {d: Bmp([r.replace('n', 'N') for r in b.rows], **b.a) for d, b in v.items()} for k, v in walker_type().hands.items()}
    def leg_style():
        return {'thigh_prof': lambda t: ((1.75 if t < .36 else lerp(1.25, 0.95, (t - .36) / .64)), 0.25 * bump(t, 0.6, 0.4), 0.25 * bump(t, 0.55, 0.35)),
                'thigh_paint': lambda dark: hem_paint_of(SHORTS, RSKIN, 0.36, dark, skin_hi=True, ragged=0.06),
                'shin_prof': lambda t: (lerp(0.95, 0.6, t), 0.45 * bump(t, 0.3, 0.3), 0.15 * bump(t, 0.05, 0.12)),
                'shin_paint': skin_paint(RSKIN, (0.0, 0.12)),
                'foot': 'shoe'}
    def arm_style():
        return {'upper_prof': lambda t: (lerp(1.05, 0.8, t), 0.1, 0.2 * bump(t, 0.25, 0.3)),
                'upper_paint': skin_paint(RSKIN, (0.0, 0.3)),
                'fore_prof': lambda t: (lerp(0.85, 0.55, t), 0.15 * bump(t, 0.2, 0.3), 0),
                'fore_paint': skin_paint(RSKIN)}
    return Biped(name='runner', w=32, h=32, ax=16, ay=28, pal=RUNNER_PAL, rig=rig,
                 hips={'F': hipsF, 'B': hipsB}, chest={'F': chestF, 'B': chestB},
                 chests=[(40, {'F': chestF, 'B': chestB}), (12, {'F': chestF_up, 'B': chestB_up})],
                 head={'F': {'idle': headF, 'bite': headF_bite, 'hurt': headF_hurt, 'dead': headF_dead},
                       'B': {'idle': headB, 'bite': headB, 'hurt': headB, 'dead': headB}},
                 hands=hands, corpse={'F': corpseF, 'B': corpseB}, corpse_off=(2, 13),
                 feet={'F': {'shoe': shoeF}, 'B': {'shoe': shoeB}},
                 legs=leg_style(), arms=arm_style(),
                 far_remap=far_remap_of(['kSsq', 'YAax', 'Ww', 'UPpu', 'GFfg', 'JHh', 'RBb', 'Ii']),
                 anims={'walk': (10, True, runner_run), 'attack': (12, False, runner_attack),
                        'die': (10, False, runner_die), 'hit': (8, False, runner_hit)})

def runner_run(T):
    """sprint: contact, mid-stance, push-off, flight; the back foot kicks high, arms pump at right angles"""
    P = []
    legR = [((3.0, 1.1, 1.4), 'flat'), ((1.4, 1.1, 1.4), 'flat'), ((-0.2, 1.1, 1.9), 'toe'), ((-3.6, 1.0, 4.4), 'air'),
            ((-5.2, 0.9, 6.8), 'air'), ((-2.6, 0.9, 8.2), 'air'), ((2.4, 1.0, 6.6), 'air'), ((4.6, 1.1, 3.0), 'air')]
    z = [12.2, 11.8, 12.4, 13.0, 12.2, 11.8, 12.4, 13.0]
    for k in range(8):
        R = legR[k]; L = legR[(k + 4) % 8]
        fL = ((L[0][0], -L[0][1], L[0][2]), L[1])
        ph = 2 * math.pi * k / 8
        sw = math.cos(ph - 0.6)           # right leg forward -> right arm back
        base = {'pel': (0.6, 0.15 * math.sin(ph), z[k]), 'lean': 40 + (2 if k % 4 == 1 else 0),
                'foot': {'R': R, 'L': fL}, 'knee_pole': (1, 0, 0.3),
                'head': (1.4, 0, -1.0 + (0.3 if k % 4 == 3 else 0)), 'expr': 'bite' if k % 4 == 3 else 'idle'}
        def off(sg):
            fwd = -sw * sg
            return ((0.6 + 2.6 * fwd, sg * 0.6, -3.4 + 1.5 * fwd), 'claw', (-1, sg * 0.5, -0.6))
        P.append(hands_from_shoulders(T, base, {'R': off(1), 'L': off(-1)}))
    return P

def runner_attack(T):
    """crouch, leap with both arms out and jaws open, land, recover"""
    keys = [(18, -0.4, 10.8, (1.5, 3.6, 15.0), (1.0, -3.6, 15.5), (0.6, 0, -0.4), 'idle', ((2.2, 1.2, 1.4), 'flat'), ((-1.8, -1.2, 1.4), 'flat')),
            (12, -1.0, 10.2, (-1.0, 4.0, 19.5), (-1.5, -4.0, 20.0), (0.2, 0, 0.0), 'bite', ((2.2, 1.2, 1.4), 'flat'), ((-2.0, -1.2, 1.4), 'toe')),
            (40, 2.2, 12.8, (9.0, 2.4, 15.6), (9.4, -2.0, 16.2), (1.6, 0, -2.0), 'bite', ((0.0, 1.2, 3.2), 'air'), ((-3.4, -1.2, 4.8), 'air')),
            (44, 2.6, 11.2, (8.8, 2.6, 11.0), (9.2, -2.0, 11.5), (2.0, 0, -2.2), 'bite', ((2.8, 1.2, 1.4), 'flat'), ((-1.0, -1.2, 1.4), 'toe')),
            (30, 1.0, 12.2, (4.0, 3.6, 14.0), (5.0, -3.4, 15.0), (1.0, 0, -0.8), 'idle', ((2.6, 1.2, 1.4), 'flat'), ((-1.6, -1.2, 1.4), 'flat'))]
    P = []
    for lean, pf, pz, hr, hl, hd, ex, fr_, fl in keys:
        P.append({'pel': (pf, 0, pz), 'lean': lean, 'expr': ex, 'head': hd, 'foot': {'R': fr_, 'L': fl},
                  'hand': {'R': (hr, 'claw', (-0.6, 0.6, -1)), 'L': (hl, 'claw', (-0.6, -0.6, -1))}})
    return P

def runner_hit(T):
    return [{'pel': (-0.6, 0, 12.4), 'lean': 12, 'expr': 'hurt', 'head': (-0.4, 0, 0.2), 'head_rot': -10,
             'foot': {'R': ((1.0, 1.2, 1.4), 'flat'), 'L': ((-1.8, -1.2, 1.4), 'flat')},
             'hand': {'R': ((0.0, 5.6, 16.0), 'claw', (-1, .5, 0)), 'L': ((2.0, -5.6, 18.5), 'claw', (0, -1, -1))}}]

def runner_die(T, view):
    sg = -1 if view == 'F' else 1
    fr = []
    fr.append({'pel': (-0.4, 0, 12.2), 'lean': 12, 'expr': 'hurt', 'head': (-0.6, 0, -0.6), 'head_rot': -14,
               'foot': {'R': ((1.6, 1.2, 1.4), 'flat'), 'L': ((-1.6, -1.2, 1.4), 'toe')},
               'hand': {'R': ((0.5, 6.0, 16.0), 'claw', (-1, 1, 0)), 'L': ((2.0, -6.0, 17.5), 'claw', (0, -1, -1))}})
    fr.append(hands_from_shoulders(T, {'pel': (sg * 0.8, 0, 10.4), 'lean': 28 + sg * 14, 'expr': 'hurt',
               'head': (sg * 0.6, 0, -0.4), 'head_rot': -8,
               'foot': {'R': ((1.6, 1.3, 1.4), 'flat'), 'L': ((-0.8, -1.3, 1.4), 'toe')}},
               {'R': ((sg * 1.0, 1.2, -6.0), 'limp', (-1, 1, 0)), 'L': ((sg * 1.5, -1.2, -5.5), 'limp', (0, -1, -1))}))
    fr.append(hands_from_shoulders(T, {'pel': (sg * 1.3, 0, 7.0), 'lean': 28 + sg * 24, 'expr': 'dead',
               'head': (sg * 0.8, 0, -0.6), 'head_rot': -10 if view == 'F' else 6,
               'foot': {'R': ((2.4, 1.4, 1.4), 'flat'), 'L': ((0.6, -1.4, 1.4), 'toe')}},
               {'R': ((sg * 1.0, 2.5, -5.0), 'limp', (0, 1, -1)), 'L': ((sg * 1.3, -2.5, -4.0), 'limp', (0, -1, -1))}))
    def limbs(k):
        lift = [2.0, 0.8, 0.0][k]
        near, far = ('R', 'L') if view == 'F' else ('L', 'R')
        return {'arm' + near: ((2, 24 - lift), (3, 26.5 - lift * 1.2), 'limp'), 'arm' + far: ((16, 15 - lift), (20, 15.5 - lift * .5), 'limp'),
                'leg' + near: ((14, 26 - lift * 1.5), (19, 26.5 - lift), 'flat' if k else 'air'),
                'leg' + far: ((21, 23.5 - lift * 1.5), (24, 25.5 - lift), 'flat' if k else 'air')}
    for k in range(3):
        fr.append({'corpse': 1, 'corpse_d': (0, -1 if k == 0 else 0), 'limbs2d': limbs(k)})
    return fr

# ================================================================== ARMORED
ARMORED_PAL = {
    'k': (150, 166, 112), 'S': (116, 136, 100), 's': (86, 100, 92), 'q': (60, 64, 80),
    'A': (190, 202, 220), 'V': (134, 148, 174), 'v': (94, 104, 134), 'x': (62, 68, 96),
    'U': (80, 86, 116), 'P': (56, 60, 86), 'p': (42, 44, 64), 'u': (30, 30, 46),
    'W': (214, 212, 190), 'w': (160, 160, 150), 'K': (42, 50, 72), 'L': (156, 190, 216),
    'G': (84, 82, 94), 'F': (58, 56, 68), 'f': (42, 40, 50), 'g': (32, 30, 40), 'Z': (72, 66, 60), 'z': (50, 46, 46),
    'E': (226, 244, 196), 'e': (130, 160, 130), 'M': (58, 22, 32), 'T': (222, 208, 170),
    'R': (164, 52, 44), 'B': (120, 30, 30), 'b': (82, 22, 34), 'N': (128, 112, 80), 'o': OUTLINE,
}
ASKIN, ARMOR, NAVY, BOOT = Ramp('kSsq'), Ramp('AVvx'), Ramp('UPpu'), Ramp('GFfg')

def armored_type():
    rig = Rig(ankle=1.6, shin=5.6, thigh=5.8, hip_w=1.6, hip_drop=0.5, torso_len=9.0, waist=2.2, lean0=6, sh=(-0.3, 4.6, -1.2),
              upper=5.0, fore=4.6, torso_depth=2.2, hips_depth=1.6, head_depth=1.5, zoff=-0.8)
    hipsF = Bmp("""
        .ZZzZZz.
        UPZzPPpp
        UPPPPPpu
        .UPPPpu.
        ..PPpu..
    """, pel=(4, 2), hpR=(2.65, 3.13), hpL=(5.26, 1.82))
    hipsB = Bmp("""
        .zZZzZZ.
        ppPPzZPU
        upPPPPPU
        .upPPPU.
        ..upPP..
    """, pel=(4, 2), hpR=(5.35, 1.87), hpL=(2.74, 3.17))
    chestF = Bmp("""
        .......AVVv..
        .....qsAVVVvx
        ..AAVvsxVVVvx
        .AVVVvAVVVVvx
        AVVVvxWWWWVvx
        AVVvxPVVVVVvx
        .vvxPPVVVVVvx
        ..PPPVVBVVvx.
        ..PPPVVbVvvx.
        ..PPpvvvvxxp.
    """, waist=(5, 9), neck=(5.58, 2.53), shR=(1.48, 5.39), shL=(8.99, 1.64))
    chestB = Bmp("""
        ....svAVA....
        ..AAVVVVVVv..
        .AVVVVVVVVVv.
        AVVVVvVVVVVvx
        AVVVVVvVVVVvx
        .vVVWWWWWVvx.
        .PVVVVVVVVvx.
        .PVVVVVVVvvx.
        .PPVVVVVvvpp.
        ..PpvvvvvxpP.
    """, waist=(6, 9), neck=(5.42, 2.95), shR=(9.52, 1.4), shL=(2.01, 5.16))
    headF = Bmp("""
        ..xvVVA..
        .xvVVVAA.
        xvVVVVVAv
        vVKKKKLKx
        xKKEKKEKx
        .xKKKKKx.
        ..sSMMMs.
        ...qTMTq.
    """, neck=(3, 7), top=(5, 0))
    headF_bite = Bmp("""
        ..xvVVA..
        .xvVVVAA.
        xvVVVVVAv
        vVKKKKLKx
        xKKEKKEKx
        .xKKKKKx.
        ..sSMMMM.
        ...qMMMM.
        ....qTMs.
    """, neck=(3, 7), top=(5, 0))
    headF_hurt = Bmp("""
        ..xvVVA..
        .xvVVVAA.
        xvVVVVVAv
        vVKKKKLKx
        xKKeKKeKx
        .xKKKKKx.
        ..sSMMMs.
        ...qsMsq.
    """, neck=(3, 7), top=(5, 0))
    headF_dead = Bmp("""
        ..xvVVA..
        .xvVVVAA.
        xvVVVVVAv
        vVKKKKLKx
        xKKKKKKKx
        .xKKKKKx.
        ..sSMMMs.
        ...qTMTq.
    """, neck=(3, 7), top=(5, 0))
    headB = Bmp("""
        ..AVVvx..
        .AAVVVvx.
        AVVVVVVvx
        AVVVvVVvx
        vVVVVVvvx
        .xvvvvvx.
        ..qsSsq..
        ...sSs...
    """, neck=(4, 7), top=(4, 0))
    corpseF = Bmp("""
        .xvVA...........
        xvVVVA..........
        vKKKLAv.........
        xKKKKKv..AVv....
        .xKKKKx.AVVVvx..
        ..sMMsxPVVVVVvx.
        ..AVsqTPWWWWVvx.
        .AVVVvPVVVBVVVvx
        .vVVvPPVVVbVVvxZ
        ..vvPPVVVVVvvxZU
        ....PPvvvvxxZUPP
        ......PpxxpUPPPp
        .........UUPPpp.
    """, pel=(13, 10), shR=(3, 7.5), shL=(10, 4.5), hpR=(11.8, 10.6), hpL=(14.2, 9.4), top=(1, 0))
    corpseB = Bmp("""
        .AVVv...........
        AVVVvx..........
        AVVVVvx.........
        vVVvVvx..AVv....
        .xvvvvx.AVVVvx..
        ..qsSsxPVVVVVvx.
        ..AVVVPVVVVVVvx.
        .AVVVvPVVWWWWVvx
        .vVVvPPVVVVVVvxZ
        ..vvPPVVVVVvvxZU
        ....PPvvvvxxZUPP
        ......PpxxpUPPPp
        .........UUPPpp.
    """, pel=(13, 10), shR=(10, 4.5), shL=(3, 7.5), hpR=(14.2, 9.4), hpL=(11.8, 10.6), top=(1, 0))
    bootF = {'flat': Bmp("""
        GF...
        GFFF.
        .fFFF
        ..ggf
    """, ankle=(1, 1)), 'toe': Bmp("""
        GF..
        GFF.
        .fFf
        ..gg
    """, ankle=(1, 1)), 'air': Bmp("""
        GF...
        GFFF.
        .ggff
    """, ankle=(1, 1))}
    bootB = {'flat': Bmp("""
        fG...
        fFFG.
        .FFFG
        ..fgg
    """, ankle=(3, 1)), 'toe': Bmp("""
        fG..
        fFG.
        .FFG
        ..gg
    """, ankle=(2, 1)), 'air': Bmp("""
        fG...
        fFFG.
        .gFFG
    """, ankle=(3, 1))}
    hands = {k: {d: Bmp([r.replace('n', 'N') for r in b.rows], **b.a) for d, b in v.items()} for k, v in walker_type().hands.items()}
    def pad_paint(cloth, pad, t0, t1, skin=None, hem=None):
        def mk(dark):
            def paint(t, c, n, k, x, y, lit):
                if t0 <= t <= t1: return shade(pad, n, lit, dark)
                if hem is not None and t > hem + 0.08 * (((x * 5 + y * 3) % 3) - 1): return shade(skin, n, lit, dark, allow_hi=False)
                return shade(cloth, n, lit, dark + (1 if t > (hem or 2) - .1 else 0))
            return paint
        return mk
    legs = {'thigh_prof': lambda t: (lerp(1.95, 1.65, t), 0.3 * (1 - t), 0.2 * bump(t, 0.4, 0.5)),
            'thigh_paint': pad_paint(NAVY, ARMOR, 0.86, 1.0),
            'shin_prof': lambda t: (1.75 if t < .3 else lerp(1.6, 1.45, t), 0.3 * bump(t, 0.4, 0.3), 0.45 * bump(t, 0.08, 0.2)),
            'shin_paint': pad_paint(NAVY, ARMOR, 0.0, 0.26), 'foot': 'boot'}
    arms = {'upper_prof': lambda t: (lerp(1.45, 1.15, t), 0.15, 0.2 * bump(t, 0.5, 0.4)),
            'upper_paint': pad_paint(NAVY, ARMOR, 0.82, 1.0),
            'fore_prof': lambda t: (lerp(1.0, 0.65, t), 0.2 * bump(t, 0.25, 0.3), 0),
            'fore_paint': pad_paint(NAVY, ARMOR, -1, -1, skin=ASKIN, hem=0.22)}
    return Biped(name='armored', w=32, h=32, ax=17, ay=28, pal=ARMORED_PAL, rig=rig,
                 hips={'F': hipsF, 'B': hipsB}, chest={'F': chestF, 'B': chestB},
                 head={'F': {'idle': headF, 'bite': headF_bite, 'hurt': headF_hurt, 'dead': headF_dead},
                       'B': {'idle': headB, 'bite': headB, 'hurt': headB, 'dead': headB}},
                 hands=hands, corpse={'F': corpseF, 'B': corpseB}, corpse_off=(2, 14),
                 feet={'F': {'boot': bootF}, 'B': {'boot': bootB}}, legs=legs, arms=arms,
                 far_remap=far_remap_of(['kSsq', 'AVvx', 'UPpu', 'GFfg', 'Ww', 'Zz', 'RBb']),
                 anims={'walk': (5.1, True, armored_walk), 'attack': (10, False, armored_attack),
                        'die': (9, False, armored_die), 'hit': (8, False, armored_hit)})

def armored_walk(T):
    """a stiff, heavy march with both arms held out in front"""
    poses = []
    n, h = 8, 2.45
    for k in range(n):
        ph = k / n
        fR = gait_feet(k, n, h, 1.4, 1.6, 1.6, 4)
        fL = gait_feet(k, n, h, -1.4, 1.6, 1.6, 4, phase0=4)
        z = [13.0, 13.3, 13.5, 13.3, 13.0, 13.3, 13.5, 13.3][k]
        sway = 0.4 * math.sin(2 * math.pi * ph)
        rl = [0, 3, 4, 3, 0, -3, -4, -3][k]
        bob = z - 13.0
        poses.append({'pel': (0, sway, z), 'roll': rl, 'foot': {'R': fR, 'L': fL}, 'head': (0.3, 0, -1.6),
                      'hand': {'R': ((7.0, 3.2, 15.2 + bob - 0.6 * math.sin(2 * math.pi * ph)), 'claw', (0, 0.6, -1)),
                               'L': ((7.4, -3.0, 15.8 + bob + 0.6 * math.sin(2 * math.pi * ph)), 'claw', (0, -0.6, -1))}})
    return poses

def armored_attack(T):
    """raise both arms, club down with both forearms and bite, recover"""
    keys = [(8, -0.4, 13.0, (1.8, 4.4, 20.0), (2.2, -4.2, 20.4), (0.2, 0, -1.4), 'idle'),
            (6, -0.8, 13.1, (0.0, 4.0, 21.2), (0.4, -3.8, 21.6), (-0.2, 0, -1.2), 'bite'),
            (22, 1.0, 12.6, (8.0, 2.6, 14.6), (8.4, -2.2, 15.0), (0.8, 0, -2.4), 'bite'),
            (26, 1.4, 12.3, (7.8, 2.8, 11.6), (8.2, -2.0, 12.1), (0.9, 0, -2.6), 'bite'),
            (14, 0.6, 12.8, (6.4, 3.4, 14.0), (7.0, -3.0, 14.6), (0.4, 0, -2.0), 'idle')]
    return [{'pel': (pf, 0, pz), 'lean': lean, 'expr': ex, 'head': hd,
             'foot': {'R': ((2.6, 1.4, 1.6), 'flat'), 'L': ((-2.2, -1.4, 1.6), 'flat')},
             'hand': {'R': (hr, 'claw', (-0.6, 0.6, -1)), 'L': (hl, 'claw', (-0.6, -0.6, -1))}} for lean, pf, pz, hr, hl, hd, ex in keys]

def armored_hit(T):
    return [{'pel': (-0.6, 0, 12.7), 'lean': 4, 'expr': 'hurt', 'head': (-0.6, 0, -1.6), 'head_rot': -8,
             'foot': {'R': ((1.2, 1.4, 1.6), 'flat'), 'L': ((-1.8, -1.4, 1.6), 'flat')},
             'hand': {'R': ((3.0, 6.0, 15.0), 'claw', (-1, .5, 0)), 'L': ((5.0, -5.5, 16.0), 'claw', (0, -1, -1))}}]

def armored_die(T, view):
    fr = walker_die(T, view)
    fr[0]['hand'] = {'R': ((1.5, 6.5, 16.5), 'claw', (-1, 1, 0)), 'L': ((3.0, -6.5, 17.5), 'claw', (0, -1, -1))}
    fr[0]['head'] = (-0.6, 0, -1.4); fr[1]['head'] = (fr[1]['head'][0], 0, -1.6)
    return fr

# ================================================================== BRUTE
BRUTE_PAL = {
    'k': (166, 172, 128), 'S': (124, 130, 106), 's': (96, 90, 106), 'q': (68, 58, 84),
    'V': (146, 100, 128), 'v': (108, 72, 100), 'n': (52, 34, 44),
    'U': (136, 106, 78), 'P': (100, 78, 60), 'p': (72, 56, 52), 'u': (50, 40, 44),
    'L': (176, 156, 104), 'l': (124, 106, 74),
    'E': (250, 246, 200), 'M': (58, 22, 32), 'T': (222, 208, 170),
    'R': (164, 52, 44), 'B': (120, 30, 30), 'b': (82, 22, 34), 'N': (96, 84, 64), 'o': OUTLINE,
}
BSKIN, WORK = Ramp('kSsq'), Ramp('UPpu')

def brute_type():
    rig = Rig(ankle=2.0, shin=8.0, thigh=8.0, hip_w=2.4, hip_drop=0.6, torso_len=12.0, waist=3.0, lean0=16, sh=(-0.8, 6.6, -2.4),
              upper=7.2, fore=6.8, torso_depth=3.0, hips_depth=2.0, head_depth=2.0)
    hipsF = Bmp("""
        ..LlLLlLLl..
        .UPPPPPPPpp.
        UUPPPPPPPppu
        UPPPPPPPPpu.
        .UPPPPPPpu..
        ..UPPPPpu...
        ...PPPpu....
    """, pel=(6, 3), hpR=(3.91, 4.49), hpL=(7.82, 2.53))
    hipsB = Bmp("""
        ..lLLlLLlL..
        .ppPPPPPPPU.
        uppPPPPPPPUU
        .upPPPPPPPPU
        ..upPPPPPPU.
        ...upPPPPU..
        ....upPPP...
    """, pel=(6, 3), hpR=(8.09, 2.66), hpL=(4.18, 4.62))
    chestF = Bmp("""
        .............kkkk.
        ........kkkkSkkkS.
        .......kkkkSSSkSSS
        ......kVkkkSqSSSs.
        ......kVVkSqqkkss.
        ...kkSVvkSSSSkks..
        ..kkkSSkkkSSssss..
        ..kkkSskkkSssss...
        ..kSSsskkksqqq....
        ..SSssqkSSsqq.....
        ...SsqSsnqqq......
        ...qsSSnSSqq......
        ....qSnqSsq.......
        .....sSqSsq.......
        ......sqqq........
    """, waist=(8, 11), neck=(10.03, 3.36), shR=(3.47, 7.56), shL=(14.25, 2.17))
    chestB = Bmp("""
        .......k....kkk...
        ......kkkkkkkkkk..
        .....kkkkSkkkkSS..
        .....kkkkSkkkSSs..
        ....kkkSSsSSSSss..
        .kkkSSkSSsSsVVs...
        .kkkSSkSSsSsVvs...
        kkkkSSkSSsSssSs...
        .SSSSSSSssSqSss...
        .SSSqqSsSsqSss....
        ..SSqSSqsSSss.....
        ....SSSqSsss......
        ....SSsSsssss.....
        .....SSssssss.....
    """, waist=(9, 12), neck=(6.97, 3.34), shR=(13.53, 2.31), shL=(2.75, 7.7))
    headF = Bmp("""
        ..kSSs.
        .kSSSSs
        kSqqSqq
        SqEsqEs
        sSSSsSs
        .sTMTMs
        ..qsssq
    """, neck=(3, 6), top=(3, 0))
    headF_bite = Bmp("""
        ..kSSs.
        .kSSSSs
        kSqqSqq
        SqEsqEs
        sSSSsMM
        .sTMMMM
        ..qTMTq
        ...qss.
    """, neck=(3, 6), top=(3, 0))
    headF_hurt = Bmp("""
        ..kSSs.
        .kSSSSs
        kSqqSqq
        SqqsqqS
        sSSSsSs
        .sMMMMs
        ..qsssq
    """, neck=(3, 6), top=(3, 0))
    headB = Bmp("""
        ..kSSs.
        .knSnSs
        kSSnSsq
        SknSnSs
        sSSnSsq
        .sSssq.
        ..qsq..
    """, neck=(3, 6), top=(3, 0))
    fist = {
        'R': Bmp("""
            .kSSs.
            kSSSSs
            SSSsSs
            sSSsSq
            .ssqq.
        """, wrist=(0, 2)),
        'DR': Bmp("""
            .kS...
            kSSSs.
            SSSSSs
            .SsSsq
            ..sqq.
        """, wrist=(0.5, 0.5)),
        'D': Bmp("""
            .kSS.
            kSSSs
            SSSSs
            SsSsq
            .qsq.
        """, wrist=(2, 0)),
        'UR': Bmp("""
            ..kSs.
            .kSSSs
            kSSsSs
            SSSSq.
            .ssq..
        """, wrist=(0.5, 4)),
        'U': Bmp("""
            .kSs.
            kSsSs
            SSSSs
            SSSSq
            .sSq.
        """, wrist=(2, 4)),
    }
    feetF = {'flat': Bmp("""
        SS....
        kSSS..
        .sSSSS
        ..sqsq
    """, ankle=(1, 1)), 'toe': Bmp("""
        SS...
        kSS..
        .sSS.
        ..sqq
    """, ankle=(1, 1)), 'air': Bmp("""
        SS...
        kSSS.
        .sqsq
    """, ankle=(1, 1))}
    feetB = {'flat': Bmp("""
        ss....
        sSSk..
        .SSSSk
        ..qsSS
    """, ankle=(4, 1)), 'toe': Bmp("""
        ss...
        sSSk.
        .SSSk
        ..qSS
    """, ankle=(3, 1)), 'air': Bmp("""
        ss....
        sSSk..
        .qsSSk
    """, ankle=(4, 1))}
    corpseF = Bmp("""
        ..kSSs................
        .kSSSSs...............
        kSqqSqqs..............
        SqqsqqSs....kkS.......
        sSSSsSSkkkkkSSSs......
        .sMMMTskkkSSSSSSs.....
        ..qTMsqkSSkkSSSSss....
        ...qkkkSSkkkSSsSsss...
        ..kkkSSSSSSSsSSsSssq..
        .kkSSVSSsSkSsSSsLlLl..
        .kSSVvsSkSsSsSsLUPPPp.
        ..SSssqSsSsSsqUPPPPPp.
        ...sqqsSsSsqqUPPPPPpu.
        .....qqssqqUUPPPPPpu..
        ........qqUPPPPPppu...
        ..........UPPPpu......
    """, pel=(17, 12), shR=(3.5, 9), shL=(14, 4.5), hpR=(16, 13.5), hpL=(19, 11.5), top=(2, 0))
    corpseB = Bmp("""
        ..kSSs................
        .kSSSSs...............
        kSSSSSSs..............
        SkSSsSSs....kkS.......
        sSSSsSSkkkkkSSSs......
        .sSssqskkkSSSSSSs.....
        ..qssqqkSSkkSSSSss....
        ...qkkkSSkkkSsSSsss...
        ..kkkSSSSSSSssSSsssq..
        .kkSSSSSSSsSSsSsLlLl..
        .kSSSsSSSSsSssSsLUPPPp.
        ..SSssSSSsSsSsqUPPPPPp.
        ...sqqsSsSsqqUPPPPPpu.
        .....qqssqqUUPPPPPpu..
        ........qqUPPPPPppu...
        ..........UPPPpu......
    """, pel=(17, 12), shL=(3.5, 9), shR=(14, 4.5), hpL=(16, 13.5), hpR=(19, 11.5), top=(2, 0))
    legs = {'thigh_prof': lambda t: (lerp(2.7, 2.2, t), 0.4 * (1 - t), 0.3 * bump(t, 0.4, 0.5)),
            'thigh_paint': lambda dark: cloth_paint(WORK, dark, folds=(0.9,)),
            'shin_prof': lambda t: ((2.3 + 0.2 * t) if t < .45 else lerp(1.6, 1.15, (t - .45) / .55), 0.6 * bump(t, 0.55, 0.3) if t >= .45 else 0, 0),
            'shin_paint': lambda dark: hem_paint_of(WORK, BSKIN, 0.45, dark, ragged=0.12),
            'foot': 'bare'}
    arms = {'upper_prof': lambda t: (2.15 + 0.55 * bump(t, 0.12, 0.2) - 0.45 * smooth((t - 0.72) / 0.28), 0.35 * bump(t, 0.5, 0.3), 0.55 * bump(t, 0.52, 0.28)),
            'upper_paint': skin_paint(BSKIN, [(0.0, 0.22), (0.42, 0.62)], creases=[(0.3, -0.1, 1.0), (0.97, -1.0, 0.2)]),
            'fore_prof': lambda t: (1.75 + 0.7 * bump(t, 0.3, 0.32) - 0.35 * smooth((t - 0.7) / 0.3), 0.3 * bump(t, 0.3, 0.3), 0.2 * bump(t, 0.25, 0.3)),
            'fore_paint': skin_paint(BSKIN, (0.12, 0.42), creases=[(0.03, -1.0, 0.1)], veins=[(0.42, 0.85, 0.25)], vein_letter='v'),
            'hand': 'fist'}
    return Biped(name='brute', w=40, h=40, ax=21, ay=36, pal=BRUTE_PAL, rig=rig,
                 hips={'F': hipsF, 'B': hipsB}, chest={'F': chestF, 'B': chestB},
                 head={'F': {'idle': headF, 'bite': headF_bite, 'hurt': headF_hurt, 'dead': headF_hurt},
                       'B': {'idle': headB, 'bite': headB, 'hurt': headB, 'dead': headB}},
                 hands={'fist': fist, 'limp': fist, 'claw': fist}, feet={'F': {'bare': feetF}, 'B': {'bare': feetB}},
                 corpse={'F': corpseF, 'B': corpseB}, corpse_off=(1, 19),
                 legs=legs, arms=arms, far_remap=far_remap_of(['kSsq', 'Vv', 'UPpu', 'Ll', 'RBb']),
                 anims={'walk': (3.6, True, brute_walk), 'attack': (8, False, brute_attack),
                        'die': (8, False, brute_die), 'hit': (8, False, brute_hit)})

def brute_walk(T):
    """slow heavy steps, wide stance, big side-to-side roll, fists hanging forward and swinging"""
    poses = []
    n, h = 8, 2.45
    for k in range(n):
        ph = k / n
        fR = gait_feet(k, n, h, 2.2, 2.0, 2.0, 4)
        fL = gait_feet(k, n, h, -2.2, 2.0, 2.0, 4, phase0=4)
        z = [16.8, 17.2, 17.5, 17.2, 16.8, 17.2, 17.5, 17.2][k]
        sway = 0.7 * math.sin(2 * math.pi * ph)
        rl = [0, 4, 6, 4, 0, -4, -6, -4][k]
        sw = math.cos(2 * math.pi * ph)
        base = {'pel': (0, sway, z), 'roll': rl, 'foot': {'R': fR, 'L': fL}, 'head': (0.3, 0, -1.8)}
        poses.append(hands_from_shoulders(T, base, {'R': ((1.6 - 1.8 * sw, 0.6, -12.6), 'fist', (-1, 0.1, 0)),
                                                   'L': ((1.6 + 1.8 * sw, -0.6, -12.6), 'fist', (-1, -0.1, 0))}))
    return poses

def brute_attack(T):
    """two-fisted overhead slam: fists up, higher, down onto the ground in front, impact, recover"""
    keys = [(10, -0.4, 16.6, (0.4, 0, 5.0), 'idle', (0.2, 0, -1.8)),
            (8, -0.8, 16.4, (-0.4, 0, 3.4), 'bite', (-0.2, 0, -1.8)),
            (36, 1.2, 15.0, (7.0, 0, -8.0), 'bite', (0.6, 0, -2.6)),
            (42, 1.6, 14.2, (7.6, 0, -10.6), 'bite', (0.8, 0, -2.8)),
            (26, 0.8, 15.8, (5.0, 0, -6.0), 'idle', (0.4, 0, -2.2))]
    P = []
    for lean, pf, pz, ho, ex, hd in keys:
        base = {'pel': (pf, 0, pz), 'lean': lean, 'expr': ex, 'head': hd,
                'foot': {'R': ((3.0, 2.2, 2.0), 'flat'), 'L': ((-2.6, -2.2, 2.0), 'flat')}}
        # both fists meet in front of the body
        J = T.rig.joints({**base, 'hand': {'R': ((0, 4, 10),), 'L': ((0, -4, 10),)}})
        mid = lerpv(J['shR'], J['shL'], 0.5)
        tgt = add(mid, ho)
        P.append({**base, 'hand': {'R': (add(tgt, (0, 1.4, 0)), 'fist', (-1, 1, -0.5)), 'L': (add(tgt, (0.3, -1.4, 0.2)), 'fist', (-1, -1, -0.5))}})
    return P

def brute_hit(T):
    base = {'pel': (-0.8, 0, 16.6), 'lean': 8, 'expr': 'hurt', 'head': (-0.4, 0, -1.8), 'head_rot': -8,
            'foot': {'R': ((1.4, 2.2, 2.0), 'flat'), 'L': ((-2.4, -2.2, 2.0), 'flat')}}
    return [hands_from_shoulders(T, base, {'R': ((1.0, 2.6, -9.0), 'fist', (-1, 1, 0)), 'L': ((2.0, -2.6, -8.0), 'fist', (-1, -1, 0))})]

def brute_die(T, view):
    sg = -1 if view == 'F' else 1
    fr = []
    b0 = {'pel': (-0.8, 0, 16.6), 'lean': 8, 'expr': 'hurt', 'head': (-0.6, 0, -1.8), 'head_rot': -10,
          'foot': {'R': ((1.6, 2.2, 2.0), 'flat'), 'L': ((-2.0, -2.2, 2.0), 'flat')}}
    fr.append(hands_from_shoulders(T, b0, {'R': ((0.0, 3.0, -8.0), 'fist', (-1, 1, 0)), 'L': ((1.0, -3.0, -7.0), 'fist', (-1, -1, 0))}))
    b1 = {'pel': (sg * 0.8, 0, 13.0), 'lean': 16 + sg * 14, 'expr': 'hurt', 'head': (sg * 0.6, 0, -1.6),
          'foot': {'R': ((2.2, 2.3, 2.0), 'flat'), 'L': ((-1.2, -2.3, 2.0), 'toe')}}
    fr.append(hands_from_shoulders(T, b1, {'R': ((sg * 1.0 + 1, 2.0, -10.0), 'fist', (-1, 1, 0)), 'L': ((sg * 1.0 + 1.5, -2.0, -9.5), 'fist', (-1, -1, 0))}))
    b2 = {'pel': (sg * 1.6, 0, 9.0), 'lean': 16 + sg * 24, 'expr': 'dead', 'head': (sg * 0.4, 0, -1.8),
          'foot': {'R': ((2.8, 2.4, 2.0), 'flat'), 'L': ((0.6, -2.4, 2.0), 'toe')}}
    fr.append(hands_from_shoulders(T, b2, {'R': ((sg * 0.4, 3.0, -6.6), 'fist', (0, 1, -1)), 'L': ((sg * 0.6, -3.0, -6.0), 'fist', (0, -1, -1))}))
    def limbs(k):
        lift = [2.5, 1.0, 0.0][k]
        near, far = ('R', 'L') if view == 'F' else ('L', 'R')
        return {'arm' + near: ((3, 30 - lift), (5, 33.5 - lift * 1.2), 'fist'), 'arm' + far: ((20, 22 - lift), (26, 23 - lift * .5), 'fist'),
                'leg' + near: ((19, 33 - lift * 1.5), (25, 34 - lift), 'flat' if k else 'air'),
                'leg' + far: ((27, 29 - lift * 1.5), (31, 32 - lift), 'flat' if k else 'air')}
    for k in range(3):
        fr.append({'corpse': 1, 'corpse_d': (0, -1 if k == 0 else 0), 'limbs2d': limbs(k)})
    return fr

# ================================================================== ray-cast ellipsoids (swelling bodies)
CAMDIR = {'F': (KD, KD, 0.5), 'B': (-KD, -KD, 0.5)}

def view_light(view):
    """the upper-left light in body space for a view (screen left and up, plus some from the camera)"""
    sg = 1 if view == 'F' else -1
    left = (-sg / math.sqrt(2), sg / math.sqrt(2), 0)
    up = (-0.354 * sg, -0.354 * sg, 0.866)
    c = CAMDIR[view]
    v = tuple(left[i] * .55 + up[i] * .75 + c[i] * .8 for i in range(3))
    return unit(v)

class Ellipsoid:
    """center c, radii r along axes (unit vectors); paint(p, n, tone) -> letter"""
    def __init__(s, c, r, axes=((1, 0, 0), (0, 1, 0), (0, 0, 1)), paint=None, prio=0, part='torso'):
        s.c, s.r, s.ax, s.paint, s.prio, s.part = c, r, axes, paint, prio, part
    def hit(s, o, d):
        """largest t where o + t d enters the ellipsoid (nearest to the camera), or None"""
        oc = sub(o, s.c)
        oq = [dot(oc, a) / r for a, r in zip(s.ax, s.r)]
        dq = [dot(d, a) / r for a, r in zip(s.ax, s.r)]
        A = sum(x * x for x in dq); B = 2 * sum(x * y for x, y in zip(oq, dq)); C = sum(x * x for x in oq) - 1
        disc = B * B - 4 * A * C
        if disc < 0: return None
        return (-B + math.sqrt(disc)) / (2 * A)
    def normal(s, p):
        q = sub(p, s.c)
        g = [0, 0, 0]
        for a, r in zip(s.ax, s.r):
            k = dot(q, a) / (r * r)
            g = [g[i] + a[i] * k for i in range(3)]
        return unit(tuple(g))

def render_ells(cv, ells, view, ax, ay, thresholds=(.6, .22, -.12), depth_bias=0.0, cleanup=True, keep=''):
    """draw the visible surface of a set of ellipsoids into the canvas (body space anchored at ax, ay)"""
    c = CAMDIR[view]; L = view_light(view)
    xs, ys = [], []
    for e in ells:
        rr = max(e.r) * 1.2
        sx, sy = proj(view, e.c)
        xs += [ax + sx - rr, ax + sx + rr]; ys += [ay + sy - rr, ay + sy + rr]
    if not xs: return
    x0, x1 = max(0, int(min(xs)) - 1), min(cv.w - 1, int(max(xs)) + 1)
    y0, y1 = max(0, int(min(ys)) - 1), min(cv.h - 1, int(max(ys)) + 1)
    got = {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            sx, sy = x - ax, y - ay
            f0 = sx / (2 * KX) if view == 'F' else -sx / (2 * KX)
            o = (f0, -f0, -sy)
            best = None
            for e in ells:
                t = e.hit(o, c)
                if t is None: continue
                key = (e.prio, t)
                if best is None or key > best[0]: best = (key, e, t)
            if not best: continue
            _, e, t = best
            p = add(o, mul(c, t))
            n = e.normal(p)
            l = dot(n, L)
            tone = 0 if l > thresholds[0] else 1 if l > thresholds[1] else 2 if l > thresholds[2] else 3
            ch = e.paint(p, n, tone)
            if ch: got[(x, y)] = (ch, depth(view, p) + depth_bias, e.part)
    if cleanup:   # lone specks join their neighbours so the shading falls into clusters
        from collections import Counter
        fixed = {}
        for (x, y), (ch, d, pt) in got.items():
            nb = [got[(x + dx, y + dy)][0] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (x + dx, y + dy) in got]
            if ch not in keep and nb and sum(1 for q in nb if q == ch) <= 1 and len(nb) >= 5:
                fixed[(x, y)] = Counter(nb).most_common(1)[0][0]
        for k, ch in fixed.items(): got[k] = (ch,) + got[k][1:]
    for (x, y), (ch, d, pt) in got.items():
        cv.put(x, y, ch, d, pt)

# ================================================================== BLOATER
BLOATER_PAL = {
    'k': (204, 200, 122), 'S': (168, 170, 98), 's': (124, 130, 86), 'q': (86, 84, 86),
    'V': (138, 104, 130), 'v': (100, 76, 104),
    'G': (214, 255, 124), 'g': (146, 224, 80), 'j': (92, 164, 66),
    'W': (180, 182, 176), 'C': (140, 142, 140), 'c': (102, 104, 110), 'x': (72, 72, 84),
    'U': (112, 98, 76), 'P': (84, 72, 60), 'p': (62, 54, 52), 'u': (44, 38, 42),
    'E': (250, 250, 214), 'M': (58, 22, 32), 'T': (222, 208, 170),
    'R': (164, 52, 44), 'B': (120, 30, 30), 'b': (82, 22, 34), 'N': (120, 104, 76), 'o': OUTLINE,
}
BLSKIN, BLSHIRT, BLSHORTS = Ramp('kSsq'), Ramp('WCcx'), Ramp('UPpu')
# pustules on the belly: (angle around the body from the front, height on the belly -1..1, size)
PUSTULES = [(-0.35, 0.25, 1.25), (0.25, -0.15, 1.0), (0.7, 0.45, 0.85), (-0.85, -0.3, 0.9), (0.05, 0.62, 0.75),
            (1.2, -0.25, 0.9), (-0.15, -0.55, 0.8), (2.4, 0.2, 0.9), (-2.3, -0.1, 0.85), (3.0, 0.4, 0.75), (1.9, -0.5, 0.7)]

def bloater_body(T, pose, J, view):
    lean = math.radians(pose.get('lean', T.rig.lean0))
    sw = pose.get('swell', 0.0)
    rl = math.radians(pose.get('roll', 0))
    R = lambda v: roll(pitch(v, lean), rl)
    pel = J['pel']
    at_ = lambda ft, s, h: add(pel, R((ft, s, h)))
    axes = (R((1, 0, 0)), R((0, 1, 0)), R((0, 0, 1)))
    bc = at_(2.4 + 1.6 * sw, 0, 6.2)
    br = (6.6 * (1 + sw), 7.8 * (1 + sw * .8), 6.6 * (1 + sw * .7))
    glow = pose.get('glow', 0)
    def belly_paint(p, n, tone):
        q = sub(p, bc)
        a = math.atan2(dot(q, axes[1]), dot(q, axes[0]))
        hgt = dot(q, axes[2]) / br[2]
        vein = (abs(math.sin(a * 3.1 + hgt * 4.2)) < 0.09 and tone >= 1) or (abs(math.sin(a * 2.3 - hgt * 5.0 + 1)) < 0.07 and tone >= 1)
        if pose.get('cracks') and abs(math.sin(a * 5.0 + hgt * 3.0)) < 0.12 and abs(hgt) < 0.8: return 'G' if tone < 2 else 'g'
        if vein: return 'V' if tone < 2 else 'v'
        if abs(a) < 0.18 and -0.25 < hgt < -0.05: return 'q'      # navel
        return BLSKIN(tone)
    ells = [Ellipsoid(bc, br, axes, belly_paint, prio=1)]
    # chest under a too-small shirt that rides up over the belly
    def chest_paint(p, n, tone):
        h = dot(sub(p, pel), axes[2])
        x = dot(sub(p, pel), axes[1])
        edge = 11.4 + 0.6 * math.sin(x * 2.1) + 0.4 * math.sin(x * 5.3)
        if h < edge - 0.6 * sw * 6: return BLSKIN(tone)
        return BLSHIRT(tone + (1 if h < edge + 0.5 else 0))
    ells.append(Ellipsoid(at_(0.4, 0, 11.6), (3.6, 5.2, 3.4), axes, chest_paint, prio=0))
    ells.append(Ellipsoid(at_(-0.6, 0, 13.4), (2.6, 5.4, 2.2), axes, chest_paint, prio=0))
    ells.append(Ellipsoid(at_(0, 0, 1.6), (3.4, 4.8, 2.6), axes, lambda p, n, t: BLSHORTS(t), prio=0))
    # glowing pustules sit on the belly surface
    for (a, hh, sz) in PUSTULES:
        dirv = add(add(mul(axes[0], math.cos(a) * math.sqrt(1 - hh * hh)), mul(axes[1], math.sin(a) * math.sqrt(1 - hh * hh))), mul(axes[2], hh))
        cpos = add(bc, (dirv[0] * br[0] * 0.97, dirv[1] * br[1] * 0.97, dirv[2] * br[2] * 0.97))
        rr = sz * (1 + glow * 0.4)
        def pp(p, n, tone, c0=cpos, rr=rr):
            dd = vlen(sub(p, c0)) / rr
            return 'G' if (tone <= 1 and dd < 0.95) or glow > 0.5 else 'g' if tone <= 2 else 'j'
        ells.append(Ellipsoid(cpos, (rr, rr, rr), axes, pp, prio=2))
    return ells

def bloater_type():
    rig = Rig(ankle=1.8, shin=4.4, thigh=4.6, hip_w=3.0, hip_drop=0.6, torso_len=14.0, waist=2.0, lean0=-4, sh=(-0.6, 5.2, -1.2),
              upper=5.0, fore=4.6, torso_depth=2.0, hips_depth=1.6, head_depth=1.0)
    headF = Bmp("""
        ..kSSs.
        .kSSSSs
        kSqqSqq
        SqEsqEs
        sSSSSsS
        .sMMMgs
        ..qMgq.
        ....g..
    """, neck=(3, 6), top=(3, 0))
    headF_bite = Bmp("""
        ..kSSs.
        .kSSSSs
        kSqqSqq
        SqEsqEs
        sSSSMMM
        .sMMMMs
        ..qTMTg
        ....qg.
    """, neck=(3, 6), top=(3, 0))
    headF_hurt = Bmp("""
        ..kSSs.
        .kSSSSs
        kSqqSqq
        SqqsqqS
        sSSSSsS
        .sMMMgs
        ..qsgq.
    """, neck=(3, 6), top=(3, 0))
    headB = Bmp("""
        ..kSSs.
        .kSSSSs
        kSSSSSs
        SkSSsSs
        sSSSSsq
        .sSssq.
        ..qsq..
    """, neck=(3, 6), top=(3, 0))
    hands = {k: {d: Bmp([r.replace('n', 'N') for r in b.rows], **b.a) for d, b in v.items()} for k, v in walker_type().hands.items()}
    feetF = {'flat': Bmp("""
        SS...
        kSSS.
        sSSSS
        .sqsq
    """, ankle=(1, 1)), 'toe': Bmp("""
        SS..
        kSS.
        sSSS
        .sqq
    """, ankle=(1, 1)), 'air': Bmp("""
        SS...
        kSSS.
        .sqsq
    """, ankle=(1, 1))}
    feetB = {'flat': Bmp("""
        ...SS
        .kSSS
        SSSSs
        qsqs.
    """, ankle=(3, 1)), 'toe': Bmp("""
        ..SS
        .kSS
        SSSs
        qsq.
    """, ankle=(2, 1)), 'air': Bmp("""
        ...SS
        .kSSS
        qsqs.
    """, ankle=(3, 1))}
    corpseF = Bmp("""
        ..kSSs..............
        .kSSSSs.............
        kSqqSqq.............
        SqqsqqS..WCc........
        sSSSSsgMCCCCcx......
        .sMMgsWCCCCCcxx.....
        ..qsWWCCkSSsSSSs....
        ...kSSskSSsBbRsSs...
        ..kSSsSSsBbbRbsSsq..
        ..SSsqSsSsBRbsSsqUP.
        ...sqqsSsqsSsSsqUPPp
        .....qqsSsqqsqUPPPp.
        ........qqsqUPPpp...
    """, pel=(15, 10), shR=(3, 7.5), shL=(11, 4.5), hpR=(15, 11.5), hpL=(18, 9.5), top=(2, 0))
    corpseB = Bmp("""
        ..kSSs..............
        .kSSSSs.............
        kSSSSSs.............
        SkSSsSS..WCc........
        sSSSsSSkCCCCcx......
        .sSssqWCCCCCcxx.....
        ..qsWWCCCCCcxSSs....
        ...kSSsWCCcxsSsSs...
        ..kSSsSSsSSsSsSSsq..
        ..SSsqSsSsSsSsSsqUP.
        ...sqqsSsqsSsSsqUPPp
        .....qqsSsqqsqUPPPp.
        ........qqsqUPPpp...
    """, pel=(15, 10), shL=(3, 7.5), shR=(11, 4.5), hpL=(15, 11.5), hpR=(18, 9.5), top=(2, 0))
    legs = {'thigh_prof': lambda t: (lerp(2.3, 1.9, t), 0.4 * (1 - t), 0.2),
            'thigh_paint': lambda dark: hem_paint_of(BLSHORTS, BLSKIN, 0.55, dark, ragged=0.1),
            'shin_prof': lambda t: (lerp(1.7, 1.3, t), 0.5 * bump(t, 0.35, 0.35), 0.1),
            'shin_paint': skin_paint(BLSKIN, (0.0, 0.15)), 'foot': 'bare'}
    arms = {'upper_prof': lambda t: (lerp(1.5, 1.15, t), 0.15, 0.25 * bump(t, 0.45, 0.4)),
            'upper_paint': skin_paint(BLSKIN, (0.0, 0.3)),
            'fore_prof': lambda t: (lerp(1.15, 0.8, t), 0.25 * bump(t, 0.25, 0.3), 0),
            'fore_paint': skin_paint(BLSKIN)}
    return Biped(name='bloater', w=40, h=40, ax=19, ay=36, pal=BLOATER_PAL, rig=rig, body_fn=bloater_body, keep_letters='GE',
                 head={'F': {'idle': headF, 'bite': headF_bite, 'hurt': headF_hurt, 'dead': headF_hurt},
                       'B': {'idle': headB, 'bite': headB, 'hurt': headB, 'dead': headB}},
                 hands=hands, feet={'F': {'bare': feetF}, 'B': {'bare': feetB}}, legs=legs, arms=arms,
                 corpse={'F': corpseF, 'B': corpseB}, corpse_off=(3, 20),
                 far_remap=far_remap_of(['kSsq', 'WCcx', 'UPpu', 'Vv', 'RBb']),
                 anims={'walk': (3.8, True, bloater_walk), 'attack': (9, False, bloater_attack),
                        'die': (10, False, bloater_die), 'hit': (8, False, bloater_hit)})

def bloater_walk(T):
    """a waddle: short wide steps, the whole body rolls over each foot, arms held out by the belly"""
    P = []
    n, h = 8, 2.45
    for k in range(n):
        ph = k / n
        fR = gait_feet(k, n, h, 2.9, 1.8, 1.4, 4)
        fL = gait_feet(k, n, h, -2.9, 1.8, 1.4, 4, phase0=4)
        z = [9.6, 9.9, 10.1, 9.9, 9.6, 9.9, 10.1, 9.9][k]
        sway = 0.6 * math.sin(2 * math.pi * ph)
        rl = 4.5 * math.sin(2 * math.pi * ph)
        sw = math.cos(2 * math.pi * ph)
        base = {'pel': (0, sway, z), 'roll': rl, 'foot': {'R': fR, 'L': fL}, 'head': (0.6, -0.3 * math.sin(2 * math.pi * ph), -0.6)}
        P.append(hands_from_shoulders(T, base, {'R': ((0.2 - 0.8 * sw, 6.4, -6.0), 'limp', (-0.6, 1, 0.3)),
                                               'L': ((0.2 + 0.8 * sw, -6.4, -6.0), 'limp', (-0.6, -1, 0.3))}))
    return P

def bloater_attack(T):
    keys = [(-12, -0.6, 10.0, 0.05, ((0.5, 4.4, -2.0), (0.5, -4.4, -1.6)), 'idle'),
            (-18, -1.0, 10.2, 0.10, ((-0.5, 4.6, 0.5), (-0.5, -4.6, 1.0)), 'bite'),
            (14, 1.0, 9.4, 0.02, ((4.6, 2.8, -1.4), (5.0, -2.8, -1.0)), 'bite'),
            (20, 1.1, 9.2, 0.0, ((4.2, 3.2, -3.2), (4.6, -3.0, -2.8)), 'bite'),
            (6, 0.8, 9.7, 0.0, ((3.0, 4.0, -6.0), (3.0, -4.0, -5.6)), 'idle')]
    P = []
    for lean, pf, pz, sw, (hr, hl), ex in keys:
        base = {'pel': (pf, 0, pz), 'lean': lean, 'swell': sw, 'expr': ex, 'head': (0.6 + 0.04 * lean, 0, -0.6),
                'foot': {'R': ((2.0, 2.9, 1.8), 'flat'), 'L': ((-1.6, -2.9, 1.8), 'flat')}}
        P.append(hands_from_shoulders(T, base, {'R': (hr, 'claw', (-1, 0.6, -0.4)), 'L': (hl, 'claw', (-1, -0.6, -0.4))}))
    return P

def bloater_hit(T):
    base = {'pel': (-0.6, 0, 9.8), 'lean': -12, 'swell': 0.04, 'expr': 'hurt', 'head': (-0.2, 0, -0.4), 'head_rot': -8,
            'foot': {'R': ((1.2, 2.9, 1.8), 'flat'), 'L': ((-1.6, -2.9, 1.8), 'flat')}}
    return [hands_from_shoulders(T, base, {'R': ((0.5, 4.6, -3.0), 'claw', (-1, 1, 0)), 'L': ((1.0, -4.6, -2.0), 'claw', (-1, -1, 0))})]

def splat(cv, cx, cy, R, seed, d, ring=False, drops=10, gore=True, squash=1.0):
    """a burst of toxic goo: spiky blob (bright core, darker rim), gore chunks, flying drops"""
    rng = [((seed * 9301 + k * 49297) % 233280) / 233280 for k in range(64)]
    spikes = [0.65 + 0.55 * rng[k] for k in range(12)]
    def rad(a):
        u = (a / (2 * math.pi)) * 12
        k0 = int(u) % 12; k1 = (k0 + 1) % 12; f = u - int(u)
        return R * (spikes[k0] * (1 - f) + spikes[k1] * f) * (1 + 0.25 * max(0, math.cos(u * math.pi * 2)) ** 8)
    for y in range(int(cy - R * 1.6), int(cy + R * 1.6) + 1):
        for x in range(int(cx - R * 1.6), int(cx + R * 1.6) + 1):
            dx, dy = x - cx, (y - cy) / squash
            r = math.hypot(dx, dy); a = math.atan2(dy, dx) % (2 * math.pi)
            rr = rad(a)
            if r > rr: continue
            q = r / rr
            if ring and q < 0.55: continue
            ch = 'G' if q < 0.35 else 'g' if q < 0.75 else 'j'
            if gore and ((x * 7 + y * 13 + seed) % 17 == 0) and q > 0.3: ch = 'B' if (x + y) % 2 else 'R'
            if gore and ((x * 5 + y * 3 + seed) % 23 == 0) and 0.4 < q < 0.9: ch = 'S'
            cv.put(x, y, ch, d, 'fx')
    for k in range(drops):
        a = rng[20 + k] * 2 * math.pi
        r = R * (1.12 + 0.35 * rng[40 + k])
        x, y = rnd(cx + math.cos(a) * r), rnd(cy + math.sin(a) * r * squash)
        ch = 'g' if k % 3 else 'B'
        cv.put(x, y, ch, d, 'fx')
        cv.put(x, y + 1, 'j' if ch == 'g' else 'b', d, 'fx')

def puddle(cv, cx, cy, rx, ry, seed, d=-50):
    """goo spread on the ground (an uneven 2:1 ellipse) under the remains"""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            a = math.atan2(y - cy, x - cx)
            wob = 1 + 0.18 * math.sin(a * 3 + seed) + 0.1 * math.sin(a * 7 + seed * 2)
            q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if q <= wob * wob:
                ch = 'j' if q > 0.55 * wob * wob else 'g'
                if (x * 3 + y * 5 + seed) % 19 == 0 and q < 0.5: ch = 'G'
                cv.put(x, y, ch, d, 'fx')

def bloater_die(T, view):
    """swells and glows, cracks, bursts into a splash of goo, the empty skin collapses into the puddle"""
    feet = {'R': ((1.2, 2.9, 1.8), 'flat'), 'L': ((-1.6, -2.9, 1.8), 'flat')}
    up = {'R': ((-0.5, 5.4, -1.0), 'claw', (-1, 1, 0)), 'L': ((0.0, -5.4, -0.4), 'claw', (-1, -1, 0))}
    out = []
    out.append(hands_from_shoulders(T, {'pel': (0, 0, 10.0), 'lean': -8, 'expr': 'hurt', 'head': (0.0, 0, -0.2), 'head_rot': -8,
                                        'foot': feet, 'swell': 0.12, 'glow': 0.6}, up))
    out.append(hands_from_shoulders(T, {'pel': (0, 0, 10.0), 'lean': -8, 'expr': 'hurt', 'head': (-0.2, 0, -0.6), 'head_rot': -14,
                                        'foot': {'R': ((1.2, 2.9, 2.2), 'toe'), 'L': ((-1.6, -2.9, 2.2), 'toe')},
                                        'swell': 0.24, 'glow': 1, 'cracks': 1},
                                   {'R': ((-1.0, 6.4, 0.6), 'claw', (-1, 1, 0)), 'L': ((-0.5, -6.4, 1.2), 'claw', (-1, -1, 0))}))
    # the burst: a shrunken torso hidden in the splash
    def burst(cv, view_, pose, J, P, D, anc, R=11, ring=False, drops=10, pud=0):
        c = P['pel']; cx, cy = c[0] + (1.0 if view_ == 'F' else -1.0), c[1] - 6
        if pud: puddle(cv, T.ax - 2, T.ay - 1, 6 + 3 * pud, 2.2 + 1.0 * pud, 3)
        splat(cv, cx, cy, R, 7 if view_ == 'F' else 11, 99, ring=ring, drops=drops)
    out.append(hands_from_shoulders(T, {'pel': (0, 0, 9.6), 'lean': -6, 'expr': 'hurt', 'head': (-0.6, 0, 0.4), 'head_rot': -18,
                                        'foot': feet, 'swell': -0.55, 'fx': lambda *a: burst(*a, R=9.5, drops=12)},
                                   {'R': ((-1.5, 7.0, 1.0), 'claw', (-1, 1, 0)), 'L': ((-1.0, -7.0, 1.6), 'claw', (-1, -1, 0))}))
    out.append(hands_from_shoulders(T, {'pel': (-0.4, 0, 8.0), 'lean': -16, 'expr': 'dead', 'head': (-0.6, 0, 0.0), 'head_rot': -12,
                                        'foot': {'R': ((1.6, 3.0, 1.8), 'flat'), 'L': ((-1.2, -3.0, 1.8), 'flat')}, 'swell': -0.62,
                                        'fx': lambda *a: burst(*a, R=11, ring=True, drops=12, pud=1)},
                                   {'R': ((-0.5, 5.0, -3.0), 'limp', (-1, 1, 0)), 'L': ((0.0, -5.0, -2.0), 'limp', (-1, -1, 0))}))
    near, far = ('R', 'L') if view == 'F' else ('L', 'R')
    def limbs(k):
        lift = [1.0, 0.0][k]
        return {'arm' + near: ((5, 29 - lift), (5, 32.5 - lift), 'limp'), 'arm' + far: ((22, 21 - lift), (27, 22 - lift), 'limp'),
                'leg' + near: ((18, 33 - lift), (23, 34 - lift), 'flat'), 'leg' + far: ((25, 30 - lift), (29, 32.5 - lift), 'flat')}
    out.append({'corpse': 1, 'corpse_d': (0, -1), 'limbs2d': limbs(0), 'pud': 2})
    out.append({'corpse': 1, 'corpse_d': (0, 0), 'limbs2d': limbs(1), 'pud': 3})
    return out

# ================================================================== CRAWLER
CRAWLER_PAL = {
    'k': (164, 168, 128), 'S': (128, 134, 104), 's': (96, 100, 92), 'q': (70, 66, 84),
    'V': (128, 98, 128), 'v': (96, 72, 102),
    'W': (210, 184, 100), 'C': (172, 142, 72), 'c': (128, 100, 62), 'x': (88, 68, 56),
    'Z': (204, 124, 128), 'z': (152, 82, 94), 'I': (214, 204, 164), 'i': (150, 144, 126),
    'H': (82, 70, 62), 'h': (56, 46, 48), 'E': (250, 250, 214), 'M': (58, 22, 32), 'T': (222, 208, 170),
    'R': (170, 54, 48), 'B': (120, 30, 30), 'b': (82, 22, 34), 'N': (120, 104, 76), 'o': OUTLINE,
}
CSKIN, CSHIRT = Ramp('kSsq'), Ramp('WCcx')

def crawler_type():
    headF = Bmp("""
        ..hHH..
        .hSkkS.
        hSqqSqq
        SqEsqEs
        sSSSsSS
        .sMMMMs
        ..qTMTq
        ...qMq.
    """, neck=(3, 6), top=(3, 0))
    headF_bite = Bmp("""
        ..hHH..
        .hSkkS.
        hSqqSqq
        SqEsqEs
        sSSSMMM
        .sMMMMM
        ..qTMTM
        ...qMMs
        ....qs.
    """, neck=(3, 6), top=(3, 0))
    headF_hurt = Bmp("""
        ..hHH..
        .hSkkS.
        hSqqSqq
        SqqsqqS
        sSSSsSS
        .sMMMMs
        ..qsMsq
    """, neck=(3, 6), top=(3, 0))
    headF_dead = Bmp("""
        ..hHH..
        .hSkkS.
        hSqqSqq
        SqqsqqS
        sSSSsSS
        .sMMMMs
        ..qTMTq
    """, neck=(3, 6), top=(3, 0))
    headB = Bmp("""
        ..kSSh.
        .kSkSHh
        kSSSsHh
        SkSsSsh
        sSSsSsq
        .sSsq..
        ..qs...
    """, neck=(3, 6), top=(3, 0))
    hands = {k: {d: Bmp([r.replace('n', 'N') for r in b.rows], **b.a) for d, b in v.items()} for k, v in walker_type().hands.items()}
    arms = {'upper_prof': lambda t: (lerp(1.25, 1.0, t), 0.15, 0.25 * bump(t, 0.5, 0.4)),
            'upper_paint': lambda dark: hem_paint_of(CSHIRT, CSKIN, 0.45, dark, ragged=0.1),
            'fore_prof': lambda t: (lerp(1.0, 0.7, t), 0.2 * bump(t, 0.25, 0.3), 0),
            'fore_paint': skin_paint(CSKIN, (0.0, 0.25))}
    return Biped(name='crawler', w=32, h=32, ax=15, ay=22, pal=CRAWLER_PAL, render=render_crawler,
                 head={'F': {'idle': headF, 'bite': headF_bite, 'hurt': headF_hurt, 'dead': headF_dead},
                       'B': {'idle': headB, 'bite': headB, 'hurt': headB, 'dead': headB}},
                 hands=hands, arms=arms, upper=4.4, fore=4.2, far_remap=far_remap_of(['kSsq', 'WCcx', 'Zz', 'RBb', 'Ii']),
                 anims={'walk': (4.8, True, crawler_crawl), 'attack': (10, False, crawler_attack),
                        'die': (8, False, crawler_die), 'hit': (8, False, crawler_hit)})

def render_crawler(T, pose, view):
    """legless torso on its belly: ray-cast trunk with a gory stump, raised head, arms to planted hands,
    a blood smear and a coil of guts dragged behind"""
    cv = Canvas(T.w, T.h)
    bf, bs, bz = pose['body']                 # middle of the trunk
    pt = math.radians(pose.get('pitch', 10))   # front raised
    rl = math.radians(pose.get('roll', 0))
    R = lambda v: roll(pitch(v, math.pi / 2 - pt), rl)    # trunk axis lies along +f, tipped up at the front
    axes = (R((0, 0, 1)), R((0, 1, 0)), R((-1, 0, 0)))    # (along the trunk, across, up out of the back)
    ctr = (bf, bs, bz)
    at_ = lambda a, s, u: add(ctr, add(mul(axes[0], a), add(mul(axes[1], s), mul(axes[2], u))))
    def trunk_paint(p, n, tone):
        q = sub(p, ctr)
        a = dot(q, axes[0]); s = dot(q, axes[1]); u = dot(q, axes[2])
        if a < -4.9 + 0.5 * math.sin(s * 2.7): return 'b' if tone >= 2 else 'B'
        if a < -4.1 + 0.4 * math.sin(s * 3.1): return 'R' if tone < 2 else 'B'
        if abs(s) < 0.55 and u > 0.9 and -2.0 < a < 2.6 and int(a * 1.7 + 9) % 2 == 0: return 'I' if tone < 2 else 'i'   # spine through the torn back
        if abs(s) < 1.25 and u > 0.8 and -2.6 < a < 3.0: return CSKIN(tone + (1 if abs(s) > 0.8 else 0))
        if -3.6 < a < -2.6 and tone < 3: return CSHIRT(tone + 1)        # ragged hem
        return CSHIRT(tone)
    ells = [Ellipsoid(ctr, (6.0, 3.6, 1.9), axes, trunk_paint, prio=1),
            Ellipsoid(at_(3.9, 0, 0.5), (2.0, 3.9, 1.9), axes, trunk_paint, prio=1)]
    render_ells(cv, ells, view, T.ax, T.ay, keep='I')
    # a smear of blood on the ground, widest at the stump, broken up towards its end
    stump = at_(-6.0, 0, -0.3)
    wig = pose.get('wig', 0)
    G = lambda p: (rnd(T.ax + proj(view, p)[0]), rnd(T.ay + proj(view, p)[1]))
    for k in range(9):
        wdt = 3 if k < 3 else 2 if k < 6 else 1
        for j in range(-wdt, wdt + 1):
            if k > 2 and ((k * 7 + j * 5) % 4 == 0): continue
            p = (stump[0] - 0.6 - k * 0.85, stump[1] + j * 0.55 + 0.3 * math.sin(k * 1.4), 0)
            ch = 'b' if (k > 4 or abs(j) == wdt) else 'B'
            X, Y = G(p)
            cv.put(X, Y, ch, depth(view, p) - 6, 'gore')
    # a tight coil of guts hanging out of the stump
    for m in range(14):
        a = m * 0.55 + wig * 0.3
        p = add(stump, (-1.4 + 0.9 * math.cos(a) - m * 0.08, 0.9 * math.sin(a) + 0.4, -stump[2] + 0.5 + 0.25 * math.cos(a)))
        X, Y = G(p)
        lit_ = math.cos(a) < 0
        cv.put(X, Y, ('Z' if lit_ else 'z') if m % 4 else 'R', depth(view, p) - 1, 'gore')
    tail = add(stump, (-3.0, -0.6 + 0.4 * math.sin(wig), -stump[2] + 0.3))
    for t_ in (0.0, 0.5, 1.0):
        X, Y = G(lerpv(add(stump, (-2.2, 0, -stump[2] + 0.4)), tail, t_))
        cv.put(X, Y, 'z', depth(view, tail) - 1.2, 'gore')
    X, Y = G(add(stump, (-1.0, -1.3, -stump[2] + 0.4))); cv.put(X, Y, 'I', depth(view, stump), 'gore')
    # head on the raised front end
    neck = at_(5.6, 0, 0.9)
    hb = T.head[view][pose.get('expr', 'idle')]
    hpos = add((T.ax, T.ay), proj(view, add(neck, pose.get('head', (0.6, 0, 0.8)))))
    stamp(cv, hb, 'neck', hpos, depth(view, neck) + 3.0, 'head')
    top = add((rnd(hpos[0]), rnd(hpos[1])), sub(hb.a['top'], hb.a['neck']))
    # arms: elbows up and out, hands planted wide
    near = 'R' if view == 'F' else 'L'
    for side, sg in (('R', 1), ('L', -1)):
        sh = at_(3.9, sg * 3.3, 0.8)
        ha, kind = pose['hand'][side][:2]
        el, ha = ik(sh, ha, T.upper, T.fore, (-0.5, sg * 1.0, 1.4))
        dark = 0 if side == near else 1
        part = 'armN' if side == near else 'armF'
        S2, E2, H2 = (add((T.ax, T.ay), proj(view, v)) for v in (sh, el, ha))
        stroke(cv, S2, E2, depth(view, sh) + .5, depth(view, el) + .5, T.arms['upper_prof'], T.arms['upper_paint'](dark), part,
               bulge=proj(view, (-1, 0, 0)), front=proj(view, (1, 0, 0)))
        stroke(cv, E2, H2, depth(view, el) + .5, depth(view, ha) + .5, T.arms['fore_prof'], T.arms['fore_paint'](dark), part)
        stamp(cv, pick_hand(T.hands[kind], hand_dir(E2, H2)), 'wrist', H2, depth(view, ha) + 1.2, part, remap=T.far_remap if dark else None)
    return cv, (rnd(top[0]), rnd(top[1]))

def crawler_crawl(T):
    """hand over hand: one arm reaches and plants while the other pulls the trunk forward; the stump drags"""
    P = []
    st = 1.225                                  # planted hand slides back 1 px per frame on screen
    for k in range(8):
        hands = {}
        for side, sg, ph0 in (('R', 1, 0), ('L', -1, 4)):
            j = (k - ph0) % 8
            if j < 5:
                f = 7.6 - st * j; z = 0.8
            else:
                u = (j - 4) / 4
                f = lerp(7.6 - st * 4, 7.6, smooth(u)); z = 0.8 + 2.2 * math.sin(math.pi * u)
            hands[side] = ((f, sg * (5.6 + 0.4 * (j >= 5)), z), 'claw')
        surge = 0.2 * math.sin(2 * math.pi * k / 4)
        P.append({'body': (0.0, 0.2 * math.sin(2 * math.pi * k / 8), 2.0 + surge), 'pitch': 10 + 2 * math.sin(2 * math.pi * k / 4),
                  'roll': 5 * math.sin(2 * math.pi * k / 8), 'hand': hands, 'wig': k * 0.8,
                  'head': (0.6, 0.2 * math.sin(2 * math.pi * k / 8), 0.8 + 0.3 * surge), 'expr': 'idle'})
    return P

def crawler_attack(T):
    """rear up on both arms, lunge and bite, drop back"""
    keys = [(18, 2.6, 0.0, (6.2, 5.6, 0.8), (6.2, -5.6, 0.8), (0.6, 0, 1.4), 'idle'),
            (30, 3.3, -0.6, (5.4, 5.4, 0.8), (5.4, -5.4, 0.8), (0.4, 0, 2.0), 'bite'),
            (6, 2.2, 1.6, (10.0, 4.4, 2.2), (10.0, -4.4, 2.6), (2.0, 0, 0.2), 'bite'),
            (2, 2.0, 2.0, (10.4, 4.6, 0.8), (10.2, -4.4, 0.8), (2.2, 0, 0.0), 'bite'),
            (10, 2.1, 0.6, (7.6, 5.6, 0.8), (7.6, -5.6, 0.8), (0.8, 0, 0.9), 'idle')]
    return [{'body': (bf, 0, bz), 'pitch': ptc, 'hand': {'R': (hr, 'claw'), 'L': (hl, 'claw')}, 'head': hd, 'expr': ex, 'wig': i}
            for i, (ptc, bz, bf, hr, hl, hd, ex) in enumerate(keys)]

def crawler_hit(T):
    return [{'body': (-0.6, 0, 2.5), 'pitch': 20, 'hand': {'R': ((6.4, 6.0, 1.4), 'claw'), 'L': ((6.8, -6.0, 1.8), 'claw')},
             'head': (-0.2, 0, 1.8), 'expr': 'hurt', 'wig': 1}]

def crawler_die(T, view):
    """jerks back, the arms give way, the chest and head drop, a last twitch, still"""
    keys = [(22, 2.7, (-0.6, 0), (6.4, 6.0, 1.6), (6.8, -6.0, 2.0), (-0.2, 0, 2.0), 'hurt'),
            (8, 2.1, (0, 0), (6.8, 6.2, 0.8), (7.0, -6.0, 0.8), (0.6, 0, 0.4), 'hurt'),
            (0, 1.8, (0, 0.3), (6.8, 6.4, 0.7), (7.0, -6.2, 0.7), (0.6, 0, -0.4), 'dead'),
            (-4, 1.7, (0, 0.3), (6.6, 6.6, 0.7), (7.0, -6.4, 0.7), (0.6, 0.2, -0.8), 'dead'),
            (-3, 1.75, (0, 0.3), (6.6, 6.7, 0.7), (7.0, -6.5, 0.7), (0.6, 0.3, -0.7), 'dead'),
            (-4, 1.7, (0, 0.3), (6.6, 6.8, 0.7), (7.0, -6.6, 0.7), (0.6, 0.4, -0.8), 'dead')]
    return [{'body': (bf, bs, bz), 'pitch': ptc, 'hand': {'R': (hr, 'limp' if i > 1 else 'claw'), 'L': (hl, 'limp' if i > 1 else 'claw')},
             'head': hd, 'expr': ex, 'wig': 2} for i, (ptc, bz, (bf, bs), hr, hl, hd, ex) in enumerate(keys)]

# ================================================================== MOUND (for a type that travels underground)
MOUND_PAL = {
    'k': (158, 120, 82), 'D': (116, 86, 62), 'd': (84, 60, 50), 'q': (58, 42, 44),
    'r': (146, 140, 132), 'R': (104, 100, 98), 'g': (98, 134, 62), 'o': OUTLINE,
}
def mound_frames():
    """a low heap of freshly dug earth that heaves as something tunnels under it; clods hop off and roll down"""
    frames = []
    clods = [[(-3, -10), (4, -9)], [(-5, -13), (5, -12), (0, -11)], [(-7, -9), (7, -9), (1, -14)], [(-10, 0), (9, 1), (2, -12)]]
    heave = [0.0, 0.7, 0.4, -0.2]
    lumps = [[(1.5, -1.0, 2.6), (-2.5, 1.5, 2.0), (3.0, 2.5, 1.2)], [(1.0, -1.5, 3.2), (-2.0, 2.0, 2.4), (3.5, 2.0, 1.6)],
             [(2.0, -0.5, 2.9), (-2.8, 1.0, 2.2), (2.5, 3.0, 1.4)], [(1.5, -1.2, 2.4), (-2.4, 1.8, 1.8), (3.2, 2.6, 1.0)]]
    W, H, ax, ay = 32, 32, 16, 24
    for k in range(4):
        cv = Canvas(W, H)
        sw = (k % 2) * 0.4 - 0.2
        def dirt(p, n, tone):
            if p[2] < -0.05: return None
            h = (int(p[0] * 2.1 + 9) * 31 + int(p[1] * 2.1 + 9) * 17) % 19
            if h == 0 and tone < 3: return 'r' if tone < 2 else 'R'
            if h in (4, 9) and tone < 2: return 'd'
            if abs(p[1] - 0.7 * math.sin(p[0] * 1.2 + k)) < 0.3 and p[2] > 2.6 + heave[k] and abs(p[0]) < 4: return 'q'   # crack along the crest
            return 'kDdq'[tone]
        ells = [Ellipsoid((sw, 0, -0.8), (7.6, 7.0, 3.6 + heave[k]), paint=dirt, prio=1)]
        for (lf, ls, lz) in lumps[k]:
            ells.append(Ellipsoid((lf + sw, ls, lz - 0.9 + heave[k] * 0.5), (2.3, 2.1, 1.7), paint=dirt, prio=2))
        render_ells(cv, ells, 'F', ax, ay, keep='rRq')
        for (cx, cy) in clods[k]:
            stamp(cv, Bmp(['kD', 'dq']), (0, 0), (ax + cx, ay + cy), 99, 'fx')
        for gx, gy in ((-8, 2), (7, 3)):          # flattened grass blades at the foot of the heap
            for dx, dy in ((0, 0), (0, -1), (1, -1)): cv.put(ax + gx + dx, ay + gy + dy, 'g', -99, 'fx')
        finish(cv, keep=('fx',))
        frames.append({'rows': cv.rows(), 'head': [ax, ay - 8]})
    return {'w': W, 'h': H, 'ax': ax, 'ay': ay, 'pal': {k: list(v) for k, v in MOUND_PAL.items()},
            'anims': {'walk': {'fps': 8, 'loop': True, 'F': frames, 'B': frames}}}

# ================================================================== export and previews
TYPES = ['walker', 'crawler', 'runner', 'brute', 'bloater', 'armored']

def build_all():
    out = {}
    for name in TYPES:
        out[name] = bake_biped(globals()[name + '_type']())
    out['mound'] = mound_frames()
    return out

def write_js(sprites, path=OUT_JS):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    body = json.dumps({'types': sprites}, separators=(',', ':'))
    head = ("// zombie set A (walker, crawler, runner, brute, bloater, armored, mound): generated by tools/zombiesA.py, do not edit\n"
            "// SPRITE {w,h,ax,ay,pal:{letter:[r,g,b]},anims:{name:{fps,loop,F:[{rows,head}],B:[...]}}}; '.' is transparent, 'o' the outline\n")
    open(path, 'w').write(head + 'window.ART_ZOMBIES_A = ' + body + ';\n')
    return len(body)

def human_ref():
    """a 29 px survivor silhouette for scale in the lineup (preview only)"""
    rows = ['....oooo....', '...oHHHHo...', '..oHHHHHHo..', '..oHSKSKSo..', '..oSSSSSso..', '...oSSSso...', '..ooCCCCoo..',
            '.oCCCCCCCCo.', 'oCCCCCCCCCCo', 'oCCoCCCCoCCo', 'oSCoCCCCoCSo', 'oSCoCCCCoCSo', 'oSoCCCCCCoSo', 'oSoCCCCCCoSo',
            '.o.oCCCCo.o.', '...oLLLLo...', '...oPPPPo...', '...oPPoPPo..', '...oPPoPPo..', '...oPPoPPo..', '...oPPoPPo..',
            '...oPPoPPo..', '...oPPoPPo..', '...oPPoPPo..', '...oPPoPPo..', '...oPPoPPo..', '..oFFooFFo..', '..oFFFoFFFo.', '..ooooooooo.']
    pal = {'H': (92, 70, 48), 'S': (222, 172, 134), 's': (190, 140, 106), 'K': (30, 24, 26), 'C': (96, 116, 76),
           'L': (92, 70, 48), 'P': (62, 66, 84), 'F': (226, 220, 206)}
    return rows, pal

def previews(sprites):
    from PIL import Image
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for name, spr in sprites.items():
        if name == 'mound':
            fr = spr['anims']['walk']['F']
            save_sheet(os.path.join(PREVIEW_DIR, 'sheet_mound.png'), [f['rows'] for f in fr], spr['pal'], sc=6, cols=4)
            continue
        sheet_of(name, spr, os.path.join(PREVIEW_DIR, f'sheet_{name}.png'), sc=6)
    # lineup: first walk frame F of every type, a survivor for scale, on grass and on dirt, at 1x and 3x
    hr, hpal = human_ref()
    order = TYPES + ['mound']
    cells = []
    for name in order:
        spr = sprites[name]
        anim = spr['anims']['walk']
        cells.append((spr, anim['F'][0]['rows'], spr['pal'], spr['ax'], spr['ay']))
    for scale in (1, 3):
        gap = 4
        Wd = sum(c[0]['w'] for c in cells) + len(hr[0]) + gap * (len(cells) + 2)
        Hd = 46
        img = Image.new('RGB', (Wd * scale, Hd * 2 * scale), (0, 0, 0))
        for bi, bg in enumerate([(82, 118, 54), (152, 120, 84)]):
            img.paste(bg, (0, bi * Hd * scale, Wd * scale, (bi + 1) * Hd * scale))
            base_y = bi * Hd + 42          # every anchor row lands on the same ground line
            x0 = gap
            def put(rows, pal, ox, oy):
                for y, r in enumerate(rows):
                    for x, ch in enumerate(r):
                        if ch == '.': continue
                        c = OUTLINE if ch == 'o' else tuple(pal.get(ch, (255, 0, 255)))
                        img.paste(c, ((ox + x) * scale, (oy + y) * scale, (ox + x + 1) * scale, (oy + y + 1) * scale))
            put(hr, hpal, x0, base_y - len(hr) + 1)
            x0 += len(hr[0]) + gap
            for spr, rows, pal, ax, ay in cells:
                put(rows, pal, x0, base_y - ay)
                x0 += spr['w'] + gap
        img.save(os.path.join(PREVIEW_DIR, f'lineup_{scale}x.png'))

if __name__ == '__main__':
    sprites = build_all()
    n = write_js(sprites)
    print('wrote', os.path.normpath(OUT_JS), n, 'bytes')
    if '--preview' in sys.argv:
        previews(sprites)
        print('previews in', PREVIEW_DIR)
