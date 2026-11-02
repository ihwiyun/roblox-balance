"""Zombie walker animations (F and B), composed from zombie_parts.py by hand-picked offsets."""
from core import Frame, Anim, flash_frame, R64
from zombie_parts import (ZT, ZFAR, ZHEAD_F, ZHEAD_F_OPEN, ZHEAD_F_BACK, ZTORSO_F, ZTORSO_F_LUNGE, ZARM_F,
                          ZLEG_F, ZLEG_B, ZHEAD_B, ZTORSO_B, ZARM_B, ZDEAD_F, ZKNEEL_F, ZKNEEL_B)
from hero import WALK, PLANTED_N, PLANTED_F, TOE

ZLEG_F['kneel'] = ZKNEEL_F
ZLEG_B['kneel'] = ZKNEEL_B
W = H = 32
NEAR_HIP, FAR_HIP = (14, 23), (18, 22)
NECK = (16, 15)
JAW = (19, 17)          # head anchor (F): jutting forward and down
JAW_B = (15, 16)        # head anchor (B): pushed forward = up-left
SH_N, SH_F = (11, 17), (21, 16)


def zpose(s, view='F'):
    f = Frame(W, H)
    dy, (sx, sy) = s.get('dy', 0), s.get('sh', (0, 0))
    legs = ZLEG_F if view == 'F' else ZLEG_B
    arms = ZARM_F if view == 'F' else ZARM_B
    hd = s.get('head_d', (0, 0))
    torso = s.get('torso', ZTORSO_F if view == 'F' else ZTORSO_B)
    head = s.get('head', ZHEAD_F if view == 'F' else ZHEAD_B)
    jaw = JAW if view == 'F' else JAW_B
    a_f = s.get('arm_f_d', (0, 0))
    a_n = s.get('arm_n_d', (0, 0))
    if view == 'B':
        # B: the near (left) arm reaches forward = up-left, in front of us; the head is pushed up-left
        f.put(arms[s.get('arm_f', 'hang')], SH_F[0] + sx + a_f[0], SH_F[1] + dy + sy + a_f[1], cmap=ZFAR)
    else:
        f.put(arms[s.get('arm_f', 'hang')], SH_F[0] + sx + a_f[0], SH_F[1] + dy + sy + a_f[1], cmap=ZFAR)
    f.put(legs[s.get('leg_f', 'stand')], FAR_HIP[0], FAR_HIP[1] + s.get('df', 0), cmap=ZFAR)
    f.put(legs[s.get('leg_n', 'stand')], NEAR_HIP[0], NEAR_HIP[1] + s.get('dn', 0))
    if view == 'B' and s.get('head_behind'):
        f.put(head, jaw[0] + sx + hd[0], jaw[1] + dy + sy + hd[1])
    f.put(torso, NECK[0] + sx, NECK[1] + dy + sy)
    if not (view == 'B' and s.get('head_behind')):
        f.put(head, jaw[0] + sx + hd[0], jaw[1] + dy + sy + hd[1])
    f.put(arms[s.get('arm_n', 'reach')], SH_N[0] + sx + a_n[0], SH_N[1] + dy + sy + a_n[1])
    for k in ('hit',):
        if k in s:
            f.meta[k] = s[k]
    return f


# shamble: the hero's no-slide gait, with a lurch (the torso drops and rocks forward on the near
# foot's contact), a lolling head that lags the body, the reaching arm bobbing a beat late.
ZWALK_EXTRA = [
    dict(arm_n='reach_lo', arm_f='hang', head_d=(1, 1), sh=(1, 0)),
    dict(arm_n='reach_lo', arm_f='hang_fwd', head_d=(1, 1), sh=(1, 0)),
    dict(arm_n='reach', arm_f='hang_fwd', head_d=(0, 1)),
    dict(arm_n='reach_hi', arm_f='hang', head_d=(0, 0)),
    dict(arm_n='reach', arm_f='hang', head_d=(0, 1), sh=(0, 0)),
    dict(arm_n='reach_lo', arm_f='hang', head_d=(1, 1)),
    dict(arm_n='reach_lo', arm_f='hang_fwd', head_d=(1, 1)),
    dict(arm_n='reach', arm_f='hang_fwd', head_d=(0, 0)),
]


def walk(view):
    fr = []
    for i, s in enumerate(WALK):
        sp = {k: s[k] for k in ('leg_n', 'leg_f', 'dn', 'df', 'dy') if k in s}
        sp.update(ZWALK_EXTRA[i])
        fr.append(zpose(sp, view))
    if view == 'F':
        for i, (f, s) in enumerate(zip(fr, WALK)):
            pts = []
            if i in PLANTED_N:
                t = TOE[PLANTED_N[i]]
                pts.append([NEAR_HIP[0] + t[0], NEAR_HIP[1] + s.get('dn', 0) + t[1]])
            if i in PLANTED_F:
                t = TOE[PLANTED_F[i]]
                pts.append([FAR_HIP[0] + t[0], FAR_HIP[1] + s.get('df', 0) + t[1]])
            f.meta['planted'] = pts
    return Anim('walk', fr, fps=7, loop=True, stridePx=2,
                notes='Shamble on the survivor\'s exact gait (planted shoe moves (-2,-1)/frame in F, (+2,+1) in B). '
                      'Body lurches 1px forward on the near foot\'s contact, the head lolls one frame behind, the '
                      'reaching arm bobs a beat late. The far hip is always under the shirt hem.')


def attack(view):
    lunge = ZTORSO_F_LUNGE if view == 'F' else ZTORSO_B
    open_ = ZHEAD_F_OPEN if view == 'F' else ZHEAD_B
    fr = [
        # 0 anticipation: weight back on the rear leg, claws raised over the near shoulder
        zpose(dict(arm_n='raise', arm_f='hang', leg_n='km1', leg_f='stand', sh=(-1, 0), head_d=(-1, 0)), view),
        # 1 coil: a touch further back, jaw opens
        zpose(dict(arm_n='raise', arm_f='hang', leg_n='km1', leg_f='stand', sh=(-1, -1), head_d=(-1, -1), head=open_), view),
        # 2 smear: the swipe comes down and forward, weight moving onto the front leg
        zpose(dict(arm_n='swipe' if view == 'F' else 'strike', arm_f='hang_fwd', leg_n='km1', leg_f='k1', df=1,
                   head=open_, head_d=(1, 0)), view),
        # 3 strike: lunged onto the front (far) leg, arm thrust low, claws at the target
        zpose(dict(arm_n='strike', arm_f='hang_fwd', leg_n='km1', leg_f='k1', df=1, dy=1, torso=lunge, head=open_,
                   head_d=(1, 1), hit=[29, 22] if view == 'F' else [2, 12]), view),
        # 4 follow-through: arm carries on down, body still over the front leg
        zpose(dict(arm_n='reach_lo', arm_f='hang_fwd', leg_n='km1', leg_f='k1', df=1, dy=1, torso=lunge,
                   head_d=(1, 1)), view),
        # 5 recover to the shamble stance
        zpose(dict(arm_n='reach', arm_f='hang', head_d=(0, 1)), view),
    ]
    return Anim('attack', fr, fps=10, loop=False, hold={3: 2},
                notes='Wind-up with the weight on the back leg and the claws raised over the near shoulder (0-1), smear '
                      '(2), strike with the weight shifted onto the front leg and the arm driven from the shoulder '
                      'and elbow (3, held 2 ticks, meta.hit), follow-through (4), recover (5). The arm part always '
                      'starts inside the shoulder: no floating hands.')


def hit(view):
    back = ZHEAD_F_BACK if view == 'F' else ZHEAD_B
    base = zpose(dict(arm_n='fling', arm_f='hang', head=back, head_d=(-1, -1), sh=(-1, 0), leg_n='km1'), view)
    fr = [flash_frame(zpose(dict(arm_n='reach', arm_f='hang', sh=(-1, 0)), view)), base]
    fr[0].meta['pushPx'] = [-1, 0] if view == 'F' else [1, 0]
    return Anim('hit', fr, fps=12, loop=False,
                notes='Frame 0: white hit flash (outline kept) and a 1px push away from the shot; frame 1: the head snaps '
                      'back, the reaching arm is flung up, weight on the back leg.')


def die(view):
    back = ZHEAD_F_BACK if view == 'F' else ZHEAD_B
    fr = []
    # 0 stagger back (hit pose), 1 knees buckle, 2 drop to the knees, 3 toppling back
    fr.append(zpose(dict(arm_n='fling', arm_f='hang', head=back, head_d=(-1, -1), sh=(-1, 0), leg_n='km1'), view))
    fr.append(zpose(dict(arm_n='fling', arm_f='hang_fwd', head=back, head_d=(-1, 0), sh=(-1, 1), dy=1,
                         leg_n='stand_b', leg_f='stand_b', dn=1, df=1), view))
    fr.append(zpose(dict(arm_n='hang', arm_f='hang', head=back, head_d=(-1, 1), sh=(0, 3), dy=1,
                         leg_n='kneel', leg_f='kneel', dn=3, df=3), view))
    f3 = zpose(dict(arm_n='fling', arm_f='hang', head=back, head_d=(-2, 0), sh=(-2 if view == 'F' else 2, 3), dy=1,
                    leg_n='kneel', leg_f='kneel', dn=3, df=3), view)
    fr.append(f3)
    # 4 hits the ground (dust at meta.hit), 5 lies still, 6-7 dissolve into a dark stain
    lying = Frame(W, H)
    lying.put(ZDEAD_F if view == 'F' else ZDEAD_F.mirrored(), 18 if view == 'F' else 13, 29)
    l4 = lying.copy()
    l4.meta['hit'] = [10, 22] if view == 'F' else [21, 22]
    fr.append(l4)
    fr.append(lying.copy())
    dark = {ZT['l']: ZT['S'], ZT['L']: ZT['k'], ZT['S']: ZT['k'], ZT['k']: ZT['q'], ZT['R']: ZT['M'], ZT['M']: ZT['g'],
            ZT['P']: ZT['p'], ZT['p']: ZT['q'], ZT['b']: ZT['k'], ZT['e']: ZT['k'], ZT['W']: ZT['w'],
            ZT['v']: ZT['u'], ZT['m']: ZT['g']}
    fr.append(lying.recolored(dark))
    darker = {ZT['S']: ZT['q'], ZT['k']: ZT['g'], ZT['M']: ZT['g'], ZT['g']: ZT['w'], ZT['q']: ZT['g'],
              ZT['p']: ZT['g'], ZT['u']: ZT['g'], ZT['w']: ZT['x'], ZT['t']: ZT['k']}
    last = lying.recolored(dark).recolored(darker)
    # thin the stain out row by row (explicit erase: every other pixel of the upper half)
    import numpy as np
    m = last.a >= 0
    ys, xs = np.where(m)
    for y, x in zip(ys, xs):
        if y < 21 or (x + y) % 3 == 0:
            last.a[y, x] = -1
    fr.append(last)
    return Anim('die', fr, fps=8, loop=False,
                notes='Stagger back (0), knees buckle (1), drop onto the knees (2), topple backward (3), slam down with '
                      'dust (4, meta.hit), lie still (5), then dissolve into a dark stain (6-7). Falls away from the '
                      'shot: up-left in F, down-right in B.')


def build(view):
    return {'walk': walk(view), 'attack': attack(view), 'hit': hit(view), 'die': die(view)}


if __name__ == '__main__':
    import sys
    sys.path.insert(0, '/tmp/claude-0/-home-user-roblox-balance/fc99fad7-9f21-557e-b4ef-94064ecb56bf/scratchpad')
    from look import show
    view = sys.argv[1]
    A = build(view)
    arrs, marks = [], {}
    for k, a in A.items():
        for i, f in enumerate(a.frames):
            lab = f'{k}{i}'
            arrs.append((lab, f.a))
            mk = [(*p, (255, 120, 0)) for p in f.meta.get('planted', [])]
            if 'hit' in f.meta:
                mk.append((*f.meta['hit'], (0, 255, 255)))
            marks[lab] = mk
    show('zombie' + view, arrs, s=8, cols=8, marks=marks)
