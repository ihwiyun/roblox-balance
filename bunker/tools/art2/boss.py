"""Boss 도살자 animations (F view), composed from boss_parts.py by hand-picked offsets.
Legs are lower-leg drawings translated along the 2:1 diagonal under the apron: a planted boot moves
exactly (-2,-1) px per walk frame, so the game advances one frame per 2px walked across."""
from core import Frame, Anim, flash_frame
from boss_parts import BT, BFAR, HEAD, HEAD_ROAR, HEAD_DEAD, TORSO, ARM_N, ARM_F, LEG, CLEAVER_FLOOR

W = H = 112
AX, AY = 56, 106
HIP_N, HIP_F = (46, 83), (68, 81)      # lower-leg anchors (the leg tops sit under the apron hem at y~85)
NECK, SKULL = (58, 30), (60, 34)
SH_N, SH_F = (32, 36), (86, 36)


def bpose(s):
    f = Frame(W, H)
    dy, (sx, sy) = s.get('dy', 0), s.get('sh', (0, 0))
    for p, at, lay in s.get('props', []):
        if lay == 'floor':
            f.put(p, *at)
    af = s.get('arm_f_d', (0, 0))
    f.put(ARM_F[s.get('arm_f', 'hang')], SH_F[0] + sx + af[0], SH_F[1] + dy + sy + af[1], cmap=BFAR)
    lf, ln = s.get('leg_f', ('stand', 0, 0)), s.get('leg_n', ('stand', 0, 0))
    f.put(LEG[lf[0]], HIP_F[0] + lf[1], HIP_F[1] + lf[2], cmap=BFAR)
    f.put(LEG[ln[0]], HIP_N[0] + ln[1], HIP_N[1] + ln[2])
    f.put(TORSO, NECK[0] + sx, NECK[1] + dy + sy + s.get('belly', 0))
    hd = s.get('head_d', (0, 0))
    f.put(s.get('head', HEAD), SKULL[0] + sx + hd[0], SKULL[1] + dy + sy + hd[1])
    an = s.get('arm_n_d', (0, 0))
    f.put(ARM_N[s.get('arm_n', 'hang')], SH_N[0] + sx + an[0], SH_N[1] + dy + sy + an[1])
    for p, at, lay in s.get('props', []):
        if lay == 'top':
            f.put(p, *at)
    for k in ('hit', 'shake', 'freeze'):
        if k in s:
            f.meta[k] = s[k]
    return f


def idle():
    # slow heavy breathing: shoulders and head rise and sink 1px, the belly lags a frame, arms sway
    seq = [(0, 0, (0, 0)), (0, 0, (0, 1)), (1, 0, (0, 1)), (1, 1, (1, 1)), (1, 1, (0, 1)), (0, 1, (0, 0))]
    fr = [bpose(dict(dy=d, belly=b, arm_n_d=a, arm_f_d=(0, d))) for d, b, a in seq]
    return Anim('idle', fr, fps=5, loop=True,
                notes='Breathing: shoulders and head sink 1px, the belly under the apron follows a frame later, the '
                      'cleaver arm sways 1px. Legs stay planted; both hips stay hidden under the apron.')


# near-leg plan for the 8 walk frames: (drawing, dx, dy) relative to standing; planted frames move (-2,-1)
WALK_N = [('stand', 4, 2), ('stand', 2, 1), ('stand', 0, 0), ('stand', -2, -1), ('heel', -4, -2 + 2),
          ('lift', -2, -1), ('lift', 0, -1), ('lift', 2, 1)]
BOB = [1, 1, 0, 0, 1, 1, 0, 0]


def walk():
    fr = []
    for i in range(8):
        n, fl = WALK_N[i], WALK_N[(i + 4) % 8]
        sp = dict(leg_n=n, leg_f=fl, dy=BOB[i], belly=BOB[(i - 1) % 8] - BOB[i],
                  arm_n_d=((-1, 0) if i < 4 else (1, 0)), arm_f_d=((1, 0) if i < 4 else (-1, 0)),
                  head_d=(0, BOB[(i - 1) % 8]))
        f = bpose(sp)
        pts = []
        if n[0] == 'stand':
            pts.append([HIP_N[0] + n[1] + 16, HIP_N[1] + n[2] + 22])
        if fl[0] == 'stand':
            pts.append([HIP_F[0] + fl[1] + 16, HIP_F[1] + fl[2] + 22])
        f.meta['planted'] = pts
        if n == ('stand', 4, 2) or fl == ('stand', 4, 2):
            f.meta['shake'] = 1          # each heavy footfall: a 1px screen shake
        fr.append(f)
    return Anim('walk', fr, fps=6, loop=True, stridePx=2,
                notes='Heavy stomp: each planted boot moves exactly (-2,-1) px per frame (the boot drawing is '
                      'translated, never redrawn, while planted). Body drops 1px on each footfall with a 1px screen '
                      'shake; the belly lags the drop by a frame; arms counter-swing. Hips stay under the apron.')


def charge():
    lean = (3, 2)
    fr = [
        # 0-1 wind-up: crouch, head drops, cleaver cocked back over the shoulder, far shoulder forward
        bpose(dict(dy=2, arm_n='raise', arm_n_d=(-2, 0), arm_f='fwd', head_d=(1, 3), leg_n=('stand', -2, -1), leg_f=('stand', 2, 1))),
        bpose(dict(dy=3, sh=(-2, 0), arm_n='raise', arm_n_d=(-3, -1), arm_f='fwd', head_d=(2, 4), leg_n=('stand', -2, -1), leg_f=('stand', 2, 1))),
        # 2 paw the ground (anticipation hold): rear foot scrapes back
        bpose(dict(dy=3, sh=(-2, 0), arm_n='raise', arm_n_d=(-3, -1), arm_f='fwd', head_d=(2, 4), leg_n=('heel', -4, 0), leg_f=('stand', 2, 1), hit=[38, 104])),
        # 3-6 the charge: leaning in, legs driving, cleaver thrust ahead (smear on 4)
        bpose(dict(dy=1, sh=lean, arm_n='thrust', arm_n_d=(2, 4), arm_f='fwd', head_d=(3, 4), leg_n=('stand', 4, 2), leg_f=('heel', -4, 0))),
        bpose(dict(dy=0, sh=(lean[0] + 1, lean[1]), arm_n='thrust', arm_n_d=(3, 4), arm_f='fwd', head_d=(3, 4), leg_n=('lift', 0, -2), leg_f=('stand', 2, 1), smear=True)),
        bpose(dict(dy=1, sh=lean, arm_n='thrust', arm_n_d=(2, 4), arm_f='fwd', head_d=(3, 4), leg_n=('heel', -4, 0), leg_f=('stand', 4, 2))),
        bpose(dict(dy=0, sh=(lean[0] + 1, lean[1]), arm_n='thrust', arm_n_d=(3, 4), arm_f='fwd', head_d=(3, 4), leg_n=('stand', 2, 1), leg_f=('lift', 0, -2), smear=True)),
        # 7 impact: shoulder and cleaver slam the target (freeze 0.12 s + 4px screen shake)
        bpose(dict(dy=0, sh=(lean[0] + 2, lean[1] + 1), arm_n='thrust', arm_n_d=(4, 5), arm_f='fwd', head=HEAD_ROAR, head_d=(4, 4),
                   leg_n=('stand', 4, 2), leg_f=('heel', -4, 0), hit=[104, 64], freeze=0.12, shake=4)),
        # 8-9 rebound and recover
        bpose(dict(dy=1, sh=(1, 1), arm_n='thrust', arm_n_d=(0, 3), arm_f='hang', head_d=(1, 2), leg_n=('stand', 2, 1), leg_f=('stand', 0, 0))),
        bpose(dict(dy=0, arm_n='hang', arm_f='hang', head_d=(0, 1))),
    ]
    return Anim('charge', fr, fps=10, loop=False, hold={2: 2, 7: 3},
                notes='Wind-up opposite to the blow (crouch, cleaver cocked back, frames 0-2 with a foot paw), the run '
                      'leans in with the far shoulder leading (3-6, smears on 4 and 6), impact on 7 with a 0.12 s freeze '
                      'and a 4px screen shake (meta.freeze/shake), rebound and recovery (8-9). The cleaver arm is driven '
                      'from the shoulder: the arm drawing always starts inside the deltoid.')


def roar():
    fr = []
    seq = [  # (dy, head, head_d, arm_n, arm_n_d, arm_f, arm_f_d)
        (1, HEAD, (0, 2), 'hang', (0, 1), 'hang', (0, 1)),           # 0 inhale: head down
        (2, HEAD, (0, 3), 'hang', (0, 2), 'hang', (0, 2)),           # 1 deeper, shoulders hunch
        (0, HEAD_ROAR, (0, -1), 'raise', (0, 0), 'raise', (0, 0)),   # 2 throw up: chin up, arms out
        (-1, HEAD_ROAR, (0, -2), 'raise', (0, -1), 'raise', (0, -1)),
        (-1, HEAD_ROAR, (1, -2), 'raise', (0, -1), 'raise', (1, -1)),  # 4-7 roar with a 1px shudder
        (-1, HEAD_ROAR, (-1, -2), 'raise', (0, -1), 'raise', (-1, -1)),
        (-1, HEAD_ROAR, (1, -2), 'raise', (0, -1), 'raise', (1, -1)),
        (-1, HEAD_ROAR, (-1, -2), 'raise', (0, -1), 'raise', (-1, -1)),
        (0, HEAD, (0, 0), 'hang', (0, 0), 'hang', (0, 0)),           # 8-9 settle
        (1, HEAD, (0, 1), 'hang', (0, 1), 'hang', (0, 0)),
    ]
    for i, (dy, h, hd, an, and_, af, afd) in enumerate(seq):
        f = bpose(dict(dy=dy, head=h, head_d=hd, arm_n=an, arm_n_d=and_, arm_f=af, arm_f_d=afd,
                       leg_n=('stand', -2, -1), leg_f=('stand', 2, 1)))
        if i in (2, 3, 4, 5, 6, 7):
            f.meta['shake'] = 2 if i == 3 else 1
        if i == 3:
            f.meta['wave'] = [60, 46]        # roar shockwave origin (mouth)
        fr.append(f)
    return Anim('roar', fr, fps=9, loop=False,
                notes='Inhale (0-1: head and shoulders sink), throw back the head and fling both arms up from the '
                      'shoulders (2), roar with a 1px shudder and screen shake (3-7, shockwave from the mouth on 3), '
                      'settle (8-9). Feet planted wide.')


def death():
    fr = []
    hit = bpose(dict(head=HEAD_DEAD, head_d=(-1, -2), sh=(-1, 0)))
    fr.append(flash_frame(hit))                                                  # 0 hit flash
    fr.append(bpose(dict(head=HEAD_DEAD, head_d=(-2, -2), sh=(-3, -1), arm_n='hang', arm_n_d=(-2, 0),
                         leg_n=('stand', -2, -1), leg_f=('stand', 0, 0))))       # 1 stagger back
    drop = [(CLEAVER_FLOOR, (22, 106), 'floor')]
    fr.append(bpose(dict(head=HEAD_DEAD, head_d=(-1, 0), sh=(-3, 1), arm_n='empty', arm_n_d=(-2, 1),
                         leg_n=('stand', -2, -1), leg_f=('stand', 0, 0), props=drop, hit=[22, 104])))  # 2 cleaver drops
    fr.append(bpose(dict(head=HEAD_DEAD, head_d=(0, 2), sh=(-2, 6), arm_n='empty', arm_n_d=(-1, 2), arm_f_d=(0, 1),
                         leg_n=('lift', -2, 4), leg_f=('lift', 2, 4), props=drop)))   # 3 knees buckle
    kneel = dict(leg_n=('kneel', 0, 12), leg_f=('kneel', 2, 11), props=drop, arm_n='empty')
    fr.append(bpose(dict(kneel, head=HEAD_DEAD, head_d=(0, 3), sh=(0, 14), hit=[44, 104], shake=3)))   # 4 knees hit
    fr.append(bpose(dict(kneel, head=HEAD_DEAD, head_d=(-1, 2), sh=(-1, 13))))         # 5 sway back
    fr.append(bpose(dict(kneel, head=HEAD_DEAD, head_d=(2, 5), sh=(3, 16))))            # 6 tip forward
    fr.append(bpose(dict(kneel, head=HEAD_DEAD, head_d=(5, 9), sh=(7, 19))))            # 7 falling
    land = dict(kneel, head=HEAD_DEAD, head_d=(8, 12), sh=(10, 22))
    fr.append(bpose(dict(land, hit=[74, 106], shake=5, freeze=0.1)))                    # 8 slam (dust)
    fr.append(bpose(dict(land, sh=(10, 21))))                                           # 9 settle bounce
    still = bpose(land)
    fr.append(still)                                                                    # 10 still
    dark = {BT[a]: BT[b] for a, b in (('l', 'L'), ('L', 'S'), ('S', 'K'), ('K', 'k'), ('k', 'q'), ('V', 'W'),
                                      ('W', 'w'), ('w', 'v'), ('v', 'h'), ('b', 'd'), ('B', 'b'), ('P', 'p'),
                                      ('G', 'g'), ('g', 's'), ('I', 'G'), ('e', 'm'), ('E', 'e'))}
    fr.append(still.recolored(dark).recolored(dark))                                    # 11 dissolving
    return Anim('death', fr, fps=8, loop=False, hold={0: 1, 8: 2},
                notes='Hit flash (0), stagger back (1), the cleaver slips from the empty hand and clangs down (2), '
                      'knees buckle (3) and hit the floor with a shake (4), sway (5), tip forward (6-7) and slam onto '
                      'the belly with a freeze and a big shake (8), settle (9-10), darken before the dissolve VFX (11).')


def build():
    return {'idle': idle(), 'walk': walk(), 'charge': charge(), 'roar': roar(), 'death': death()}


if __name__ == '__main__':
    import sys
    sys.path.insert(0, '/tmp/claude-0/-home-user-roblox-balance/fc99fad7-9f21-557e-b4ef-94064ecb56bf/scratchpad')
    import preview as pv
    A = build()
    which = sys.argv[1:] or list(A)
    rows = [pv.strip([f.a for f in A[k].frames], s=2) for k in which]
    pv.stack_v(rows).save('/tmp/claude-0/-home-user-roblox-balance/fc99fad7-9f21-557e-b4ef-94064ecb56bf/scratchpad/look/boss.png')
