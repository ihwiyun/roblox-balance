"""Survivor hero animations, composed from the hand-drawn parts in hero_parts.py.

Each frame lists, back to front, which part goes where (an offset per part, chosen by hand per
frame) plus explicit pixel patches where a join needs cleaning. Nothing here draws a shape.
"""
from core import Frame, Anim
from hero_parts import (HT, FAR, HEAD_F, HEAD_F_BLINK, HEAD_F_DOWN, HEAD_F_EFFORT, HEAD_F_AIM,
                        PONY_F, TORSO_F, TORSO_F_LEAN, ARM_F, LEG_F)

W = H = 32
AX, AY = 16, 29                 # ground anchor: near sole row
NEAR_HIP = (14, 23)             # near (right) hip, standing
FAR_HIP = (18, 22)              # far (left) hip: 4px right, 1px up (hip width in this camera)
NECK = (16, 16)                 # torso anchor
CHIN = (17, 16)                 # head anchor
SH_N = (11, 17)                 # near shoulder pivot
SH_F = (21, 17)                 # far shoulder pivot
TIE = (10, 8)                   # ponytail tie (back of the head)


def body_f(f, dy=0, head=HEAD_F, pony='rest', arm_n='hang', arm_f='hang', torso=TORSO_F,
           leg_n='stand', leg_f='stand', dhn=0, dhf=0, head_dx=0, head_dy=0, arm_n_d=(0, 0), arm_f_d=(0, 0)):
    """Standard F stack: pony, far arm, far leg, near leg, torso, head, near arm.
    dy: upper-body bob; dhn/dhf: per-leg hip drop (legs drawn so the sole stays on the ground)."""
    f.put(PONY_F[pony], TIE[0] + head_dx, TIE[1] + dy + head_dy)
    f.put(ARM_F[arm_f], SH_F[0] + arm_f_d[0], SH_F[1] + dy + arm_f_d[1], cmap=FAR)
    f.put(LEG_F[leg_f], FAR_HIP[0], FAR_HIP[1] + dhf, cmap=FAR)
    f.put(LEG_F[leg_n], NEAR_HIP[0], NEAR_HIP[1] + dhn)
    f.put(torso, NECK[0], NECK[1] + dy)
    f.put(head, CHIN[0] + head_dx, CHIN[1] + dy + head_dy)
    f.put(ARM_F[arm_n], SH_N[0] + arm_n_d[0], SH_N[1] + dy + arm_n_d[1])
    return f


def idle_f():
    fr = []
    # 0 stand, 1 breathe out (hip/knees soften 1px, ponytail lags up), 2 low + blink, 3 rising, pony lags down
    fr.append(body_f(Frame(W, H)))
    fr.append(body_f(Frame(W, H), dy=1, pony='up', leg_n='stand_b', leg_f='stand_b', dhn=1, dhf=1))
    fr.append(body_f(Frame(W, H), dy=1, head=HEAD_F_BLINK, leg_n='stand_b', leg_f='stand_b', dhn=1, dhf=1))
    fr.append(body_f(Frame(W, H), pony='down'))
    return Anim('idle', fr, fps=5, loop=True,
                notes='Breathing: hips and knees soften 1px, head and shoulders follow, ponytail lags one frame '
                      '(up on the drop, down on the rise). Blink on frame 2. Feet never move.')


# walk: (near leg, far leg, hip drops, arm near/far, pony, bob)
WALK = [
    # 0 contact: near heel strikes in front, far toe-off behind
    dict(n='k2', f='km2', dn=1, df=1, an='back', af='fwd', pony='rest', dy=1),
    # 1 down: weight onto the near leg
    dict(n='k1', f='up_back', dn=1, df=1, an='back', af='fwd', pony='up', dy=1),
    # 2 passing: near leg straight under, far leg passes
    dict(n='stand', f='up_pass', dn=0, df=0, an='hang', af='hang', pony='up', dy=0),
    # 3 up: near leg behind, far reaches
    dict(n='km1', f='up_reach', dn=0, df=0, an='fwd', af='back', pony='down', dy=0),
    # 4 contact: far heel strikes, near toe-off
    dict(n='km2', f='k2', dn=1, df=1, an='fwd', af='back', pony='rest', dy=1),
    dict(n='up_back', f='k1', dn=1, df=1, an='fwd', af='back', pony='up', dy=1),
    dict(n='up_pass', f='stand', dn=0, df=0, an='hang', af='hang', pony='up', dy=0),
    dict(n='up_reach', f='km1', dn=0, df=0, an='back', af='fwd', pony='down', dy=0),
]


def walk_f():
    fr = []
    for s in WALK:
        f = body_f(Frame(W, H), dy=s['dy'], pony=s['pony'], arm_n=s['an'], arm_f=s['af'],
                   leg_n=s['n'], leg_f=s['f'], dhn=s['dn'], dhf=s['df'])
        fr.append(f)
    return Anim('walk', fr, fps=10, loop=True, stridePx=2,
                notes='Planted boot moves exactly (-2,-1) px per frame (the game advances one frame per 2px '
                      'walked across): near foot k=+2..-2 on frames 0-4, far foot on frames 4-0. Hips 1px low on '
                      'contact/down. Arms swing opposite to legs. Ponytail lags the bob.')


def build_f():
    return {'idle': idle_f(), 'walk': walk_f()}


if __name__ == '__main__':
    import sys
    sys.path.insert(0, '/tmp/claude-0/-home-user-roblox-balance/fc99fad7-9f21-557e-b4ef-94064ecb56bf/scratchpad')
    from look import show
    import preview as pv
    A = build_f()
    arrs = []
    for k, a in A.items():
        for i, f in enumerate(a.frames):
            arrs.append((f'{k}{i}', f.a))
    show('hero_f', arrs, s=8, cols=8)
    on = pv.onion([f.a for f in A['walk'].frames], s=8, ground=AY)
    on.save('/tmp/claude-0/-home-user-roblox-balance/fc99fad7-9f21-557e-b4ef-94064ecb56bf/scratchpad/look/hero_onion.png')
