"""Bakes pixel sprite frames from hand-drawn part bitmaps and hand-placed 2D joints.
Front view faces down-right (towards the camera); the back view is the mirrored pose with
the back bitmaps and the arms drawn behind the body. Output: rows of palette letters."""
import math

class Spr:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.px = {}      # (x, y) -> letter
        s.part = {}    # (x, y) -> part id, for internal outlines
    def put(s, x, y, ch, part):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < s.w and 0 <= y < s.h and ch != '.':
            s.px[(x, y)] = ch; s.part[(x, y)] = part

def line(sp, a, b, ch, part, width=1, shade=None):
    (x0, y0), (x1, y1) = a, b
    n = max(1, int(math.ceil(max(abs(x1 - x0), abs(y1 - y0)) * 2)))
    for k in range(n + 1):
        t = k / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        for o in range(width):
            # thicken across the stroke: sideways for steep strokes, downwards for flat ones
            if abs(x1 - x0) < abs(y1 - y0): sp.put(x + o, y, shade if (shade and o == width - 1) else ch, part)
            else: sp.put(x, y + o, shade if (shade and o == width - 1) else ch, part)

def stamp(sp, bmp, cx, top, part, mirror=False):
    w = len(bmp[0])
    x0 = int(round(cx - w / 2))
    for j, row in enumerate(bmp):
        for i, ch in enumerate(row):
            c = row[w - 1 - i] if mirror else ch
            if c != '.': sp.put(x0 + i, top + j, c, part)

def axis_stamp(sp, bmp, bot, top, part, mirror=False):
    """lay a bitmap along the line bot->top: rows run up the axis, columns across it"""
    h, w = len(bmp), len(bmp[0])
    ax, ay = top[0] - bot[0], top[1] - bot[1]
    L = math.hypot(ax, ay)
    if L < .01: ax, ay, L = 0, -1, 1
    ux, uy = ax / L, ay / L
    nx, ny = -uy, ux
    span = max(L, h * .8)
    r = int(math.ceil(max(span, w))) + 2
    for iy in range(int(bot[1]) - r, int(bot[1]) + r + 1):
        for ix in range(int(bot[0]) - r, int(bot[0]) + r + 1):
            qx, qy = ix + .5 - bot[0], iy + .5 - bot[1]
            s = (qx * ux + qy * uy) / span
            v = qx * nx + qy * ny
            if s < 0 or s >= 1: continue
            row = h - 1 - int(s * h)
            col = int(math.floor(v + w / 2))
            if col < 0 or col >= w: continue
            ch = bmp[row][w - 1 - col if mirror else col]
            if ch != '.': sp.put(ix, iy, ch, part)

def outline(sp, inner_parts=()):
    out = dict(sp.px)
    for (x, y), ch in sp.px.items():
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in sp.px and 0 <= q[0] < sp.w and 0 <= q[1] < sp.h: out[q] = 'o'
    # a dark seam where a front part crosses a part behind it
    for (x, y), ch in sp.px.items():
        if sp.part.get((x, y)) not in inner_parts: continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q in sp.px and sp.part.get(q) not in inner_parts and sp.part.get(q) in ('torso',): out[q] = 'o'
    sp.px = out

def rows(sp):
    return [''.join(sp.px.get((x, y), '.') for x in range(sp.w)) for y in range(sp.h)]

def mirror_pose(p, w):
    m = {}
    for k, v in p.items():
        if isinstance(v, tuple) and len(v) == 2 and all(isinstance(t, (int, float)) for t in v): m[k] = (w - 1 - v[0], v[1])
        else: m[k] = v
    return m

def humanoid(kit, pose, back=False, w=20, h=22):
    """kit: bitmaps and colours for one character type; pose: joints in front-view sprite coords"""
    sp = Spr(w, h)
    P = mirror_pose(pose, w) if back else pose
    # shoulders and hips follow the torso; near = towards the camera (screen-left in the front view)
    near, far = ('L', 'R')
    def limb_arm(side, front):
        sh, el, ha = P['sh' + side], P['el' + side], P['ha' + side]
        up, low, hand = (kit['sleeve'], kit['skin'], kit['hand']) if front else (kit['sleeveFar'], kit['skinFar'], kit['handFar'])
        line(sp, sh, el, up, 'arm' + side, kit.get('armW', 2))
        line(sp, el, ha, low, 'arm' + side, kit.get('foreW', 1))
        stamp(sp, hand if not back else [r[::-1] for r in hand], ha[0] + (0 if not back else 0), int(round(ha[1])) - 1, 'arm' + side)
    def limb_leg(side, front):
        hp, kn, ft = P['hp' + side], P['kn' + side], P['ft' + side]
        col, shoe = (kit['pants'], kit['shoe']) if front else (kit['pantsFar'], kit['shoeFar'])
        line(sp, hp, kn, col, 'leg' + side, kit.get('legW', 2))
        line(sp, kn, ft, kit.get('shin', col) if front else kit.get('shinFar', col), 'leg' + side, kit.get('shinW', 2))
        foot = kit['foot'] if front else kit['footFar']
        stamp(sp, [r[::-1] for r in foot] if back else foot, ft[0] + (1 if not back else -1), int(round(ft[1])), 'leg' + side)
    torso = kit['torsoB'] if back else kit['torsoF']
    head = kit['headB'] if back else kit['headF']
    order_front = ['armR', 'legR', 'torso', 'legL', 'head', 'armL']
    order_back = ['armL', 'armR', 'legR', 'legL', 'torso', 'head']
    for step in (order_back if back else order_front):
        if step == 'torso': axis_stamp(sp, torso, P['hip'], P['neck'], 'torso', mirror=back)
        elif step == 'head': stamp(sp, head if not back else [r[::-1] for r in head], P['head'][0], int(round(P['head'][1])), 'head')
        elif step == 'armL': limb_arm('L', not back)
        elif step == 'armR': limb_arm('R', back and False)
        elif step == 'legL': limb_leg('L', True)
        elif step == 'legR': limb_leg('R', False)
    outline(sp, inner_parts=('armL',) if not back else ())
    return rows(sp)
