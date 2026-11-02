"""Survivor hero animations, composed from the hand-drawn parts in hero_parts.py / props.py /
gunhand.py.

Each frame is a short spec: which hand-drawn part goes where (a hand-picked offset per part),
in back-to-front order, plus explicit pixel patches where a join needs cleaning. Nothing here
draws a shape; held objects are placed by translation only, so a gun or a tool is rigid.
"""
from core import Frame, Anim, flash_frame
from hero_parts import (HT, FAR, HEAD_F, HEAD_F_BLINK, HEAD_F_DOWN, HEAD_F_EFFORT, HEAD_F_AIM,
                        PONY_F, TORSO_F, TORSO_F_LEAN, ARM_F, LEG_F,
                        HEAD_B, HEAD_B_DOWN, PONY_B, TORSO_B, TORSO_B_LEAN, ARM_B, LEG_B, LADDER_B)
import props as PR
import gunhand as GN

W = H = 32
AX, AY = 16, 29                 # ground anchor: the near sole row
NEAR_HIP = (14, 23)             # near (right) hip, standing
FAR_HIP = (18, 22)              # far (left) hip: 4px right, 1px up (hip width in this camera)
NECK = (16, 16)                 # torso anchor
CHIN = (17, 16)                 # head anchor
SH_N = (11, 17)                 # near shoulder pivot
SH_F = (21, 17)                 # far shoulder pivot
TIE = (10, 8)                   # ponytail tie (back of the head)


def pose(spec):
    """spec keys: dy (upper-body bob), sh (upper-body shift), head, pony, torso, arm_n, arm_f,
    arm_n_d / arm_f_d (extra hand offsets), leg_n, leg_f, dn, df (hip drops), tool (Part, (x, y)),
    tool_layer ('back' behind the torso, 'mid' between torso and head, 'front' over the head,
    'hand' between the far arm and the near arm), gun (Part, (x, y)), props (list of (Part, (x,y), layer)),
    patch (list of (x, y, key))."""
    s = spec
    f = Frame(W, H)
    dy, (sx, sy) = s.get('dy', 0), s.get('sh', (0, 0))
    head = s.get('head', HEAD_F)
    hdx, hdy = s.get('head_d', (0, 0))

    def layer(name):
        for p, at, lay in s.get('props', []):
            if lay == name:
                f.put(p, *at)
        if s.get('tool') and s.get('tool_layer', 'hand') == name:
            f.put(s['tool'][0], *s['tool'][1])

    layer('floor')
    f.put(PONY_F[s.get('pony', 'rest')], TIE[0] + sx + hdx, TIE[1] + dy + sy + hdy)
    layer('back')
    if s.get('arm_f_layer', 'back') == 'back':
        d = s.get('arm_f_d', (0, 0))
        f.put(ARM_F[s.get('arm_f', 'hang')], SH_F[0] + sx + d[0], SH_F[1] + dy + sy + d[1], cmap=FAR)
    f.put(LEG_F[s.get('leg_f', 'stand')], FAR_HIP[0], FAR_HIP[1] + s.get('df', 0), cmap=FAR)
    f.put(LEG_F[s.get('leg_n', 'stand')], NEAR_HIP[0], NEAR_HIP[1] + s.get('dn', 0))
    f.put(s.get('torso', TORSO_F), NECK[0] + sx, NECK[1] + dy + sy)
    layer('mid')
    f.put(head, CHIN[0] + sx + hdx, CHIN[1] + dy + sy + hdy)
    layer('front')
    if s.get('arm_f_layer', 'back') == 'front':
        d = s.get('arm_f_d', (0, 0))
        f.put(ARM_F[s['arm_f']], SH_F[0] + sx + d[0], SH_F[1] + dy + sy + d[1], cmap=FAR)
    if s.get('gun'):
        g, (gx, gy) = s['gun']
        f.put(g, gx, gy)
        if 'muzzle' in g.pts:
            m, gp = g.pts['muzzle'], g.pts['grip']
            f.meta['muzzle'] = [gx - gp[0] + m[0], gy - gp[1] + m[1]]
            f.meta['grip'] = [gx, gy]
    layer('hand')
    d = s.get('arm_n_d', (0, 0))
    f.put(ARM_F[s.get('arm_n', 'hang')], SH_N[0] + sx + d[0], SH_N[1] + dy + sy + d[1])
    layer('top')
    if s.get('patch'):
        f.px(s['patch'], HT)
    for k in ('hit', 'toe', 'mag', 'shell'):
        if k in s:
            f.meta[k] = s[k]
    return f


# =========================================================================== F: idle and walk
def idle_f():
    base = dict()
    low = dict(dy=1, leg_n='stand_b', leg_f='stand_b', dn=1, df=1)
    fr = [pose(base),
          pose({**low, 'pony': 'up'}),
          pose({**low, 'head': HEAD_F_BLINK}),
          pose({'pony': 'down'})]
    return Anim('idle', fr, fps=5, loop=True,
                notes='Breathing: hips and knees soften 1px, head and shoulders follow, ponytail lags one frame '
                      '(up on the drop, down on the rise). Blink on frame 2. Both soles stay on rows 29/28.')


WALK = [
    # 0 contact: near heel strikes in front, far toe-off behind
    dict(leg_n='k2', leg_f='km2', dn=1, df=1, arm_n='back', arm_f='fwd', pony='rest', dy=1),
    # 1 down: weight onto the near leg, far foot swings up behind
    dict(leg_n='k1', leg_f='up_back', dn=1, df=1, arm_n='back', arm_f='fwd', pony='up', dy=1),
    # 2 passing: near leg straight under the hip, far knee passes forward
    dict(leg_n='stand', leg_f='up_pass', arm_n='hang', arm_f='hang', pony='up'),
    # 3 up: near leg behind, far leg reaches for the next step
    dict(leg_n='km1', leg_f='up_reach', arm_n='fwd', arm_f='back', pony='down'),
    # 4..7 mirror the gait with the legs swapped
    dict(leg_n='km2', leg_f='k2', dn=1, df=1, arm_n='fwd', arm_f='back', pony='rest', dy=1),
    dict(leg_n='up_back', leg_f='k1', dn=1, df=1, arm_n='fwd', arm_f='back', pony='up', dy=1),
    dict(leg_n='up_pass', leg_f='stand', arm_n='hang', arm_f='hang', pony='up'),
    dict(leg_n='up_reach', leg_f='km1', arm_n='back', arm_f='fwd', pony='down'),
]
# planted toe pixel of each leg drawing, relative to its hip anchor (for the no-slide check)
TOE = {'stand': (3, 6), 'k2': (7, 7), 'k1': (5, 6), 'km1': (1, 5), 'km2': (-1, 3)}
PLANTED_N = {0: 'k2', 1: 'k1', 2: 'stand', 3: 'km1', 4: 'km2'}
PLANTED_F = {4: 'k2', 5: 'k1', 6: 'stand', 7: 'km1', 0: 'km2'}


def walk_toes(view_hips=(NEAR_HIP, FAR_HIP)):
    """Per frame, the planted toe pixels (near, far) in frame coordinates."""
    out = []
    for i, s in enumerate(WALK):
        pts = []
        if i in PLANTED_N:
            k = PLANTED_N[i]
            t = TOE[k]
            pts.append((view_hips[0][0] + t[0], view_hips[0][1] + s.get('dn', 0) + t[1]))
        if i in PLANTED_F:
            k = PLANTED_F[i]
            t = TOE[k]
            pts.append((view_hips[1][0] + t[0], view_hips[1][1] + s.get('df', 0) + t[1]))
        out.append(pts)
    return out


def walk_f():
    fr = [pose(s) for s in WALK]
    toes = walk_toes()
    for f, t in zip(fr, toes):
        f.meta['planted'] = [list(p) for p in t]
    return Anim('walk', fr, fps=10, loop=True, stridePx=2,
                notes='Planted boot moves exactly (-2,-1) px per frame: near foot k=+2..-2 on frames 0-4, far foot '
                      'on frames 4..0 (checked by the toe tracker). The game advances one frame per 2px walked '
                      'across. Hips 1px low on contact/down; arms swing opposite to the legs; ponytail lags.')


# =========================================================================== F: rifle
# The assault rifle (gunhand.AR_F) is placed by its grip point; its butt sits in the right
# shoulder pocket (just inside the near shoulder), the support hand under the handguard.
GRIP = (15, 22)


def rifle_pose(d=(0, 0), gun=None, arm_f='aim_f', arm_f_d=(0, 0), head=HEAD_F_AIM, head_d=(1, 1), **kw):
    gun = gun or GN.AR_F
    sp = dict(leg_n='km1', leg_f='k1', df=1, head=head, head_d=head_d,
              gun=(gun, (GRIP[0] + d[0], GRIP[1] + d[1])),
              arm_n='aim_n', arm_n_d=d, arm_f=arm_f, arm_f_d=(d[0] + arm_f_d[0], d[1] + arm_f_d[1]),
              arm_f_layer='front')
    sp.update(kw)
    return sp


def aim_f():
    # 0: raising (low ready -> shoulder): gun 2px low and back, head still up; 1: on target, cheek on stock
    fr = [pose(rifle_pose(d=(-2, 2), head=HEAD_F, head_d=(0, 0), arm_f_d=(0, 0))),
          pose(rifle_pose())]
    return Anim('aim', fr, fps=8, loop=False,
                notes='Firing hand on the pistol grip (knuckles on the grip point), support hand under the '
                      'handguard, butt in the right shoulder pocket, cheek down on the stock in frame 1. Frame 0 is '
                      'the gun coming up from low ready along the same line: same sprite, translated only.')


def shoot_f():
    # 0 fire (flash drawn by the VFX at meta.muzzle on this frame only), 1 recoil: back 2px along the
    # bore axis (-2,-1) plus 1px muzzle rise; shoulders and both hands ride with it; 2 settling halfway
    fr = [pose(rifle_pose()),
          pose(rifle_pose(d=(-2, -2), dy=0, head_d=(0, 0), sh=(-1, 0), patch=None)),
          pose(rifle_pose(d=(-1, -1), head_d=(1, 0)))]
    fr[0].meta['flash'] = True
    fr[0].meta['shell'] = [fr[0].meta['grip'][0] + 3, fr[0].meta['grip'][1] - 4]
    return Anim('shoot', fr, fps=15, loop=False,
                notes='Frame 0 fires: muzzle point = gun sprite muzzle + grip placement, flash on that frame only. '
                      'Recoil pushes the whole rigid rifle back along the barrel axis (-2,-1) and up 1px; both '
                      'hands and the shoulder ride with it, then return 1px per frame. No sideways kick, no rotation.')


def reload_f():
    G0 = (0, 2)          # low ready: gun lowered 2px, still in the shoulder line, hands on it
    NM = GN.AR_F_NOMAG
    well = (GRIP[0] + G0[0] + 4, GRIP[1] + G0[1] + 1)      # magazine well in frame coords
    fr = []
    # 0 mag release: firing finger on the release, support hand drops to the magazine
    fr.append(pose(rifle_pose(d=G0, arm_f='rl_low', arm_f_d=(-1, 1), head=HEAD_F_DOWN, head_d=(0, 1))))
    # 1 old magazine out: support hand pulls it down and away
    fr.append(pose(rifle_pose(d=G0, gun=NM, arm_f='rl_low', arm_f_d=(-1, 3), head=HEAD_F_DOWN, head_d=(0, 1),
                              props=[(GN.MAG, (well[0], well[1] + 3), 'top')])))
    # 2 drop it (falls, tumbling), hand heads for the vest pouch
    fr.append(pose(rifle_pose(d=G0, gun=NM, arm_f='rl_vest', arm_f_d=(-4, 2), head=HEAD_F_DOWN, head_d=(0, 1),
                              props=[(GN.MAG_TILT, (well[0] - 1, well[1] + 7), 'top')])))
    # 3 fresh magazine from the vest pouch
    fr.append(pose(rifle_pose(d=G0, gun=NM, arm_f='rl_vest', arm_f_d=(-4, 1), head=HEAD_F_DOWN, head_d=(0, 1),
                              props=[(GN.MAG, (well[0] - 3, well[1] + 1), 'top')])))
    # 4 brought under the well, lined up
    fr.append(pose(rifle_pose(d=G0, gun=NM, arm_f='rl_low', arm_f_d=(-1, 3), head=HEAD_F_DOWN, head_d=(0, 1),
                              props=[(GN.MAG, (well[0], well[1] + 3), 'top')])))
    # 5 inserted: magazine up into the well
    fr.append(pose(rifle_pose(d=G0, arm_f='rl_low', arm_f_d=(-1, 2), head=HEAD_F_DOWN, head_d=(0, 1))))
    # 6 seat push: palm slaps it home, the whole gun jolts up 1px
    fr.append(pose(rifle_pose(d=(0, 1), arm_f='rl_low', arm_f_d=(-1, 0), head=HEAD_F_DOWN, head_d=(0, 1))))
    # 7 charging handle: support hand up at the rear of the receiver, pulls it back
    fr.append(pose(rifle_pose(d=(0, 1), arm_f='rl_handle', arm_f_d=(-6, 0), head=HEAD_F, head_d=(0, 0))))
    return Anim('reload', fr, fps=8, loop=False,
                notes='Sequence: 0 release (support hand to the magazine), 1 old magazine out (gun sprite without '
                      'magazine), 2 it falls tumbling, hand to the vest, 3 new magazine from the vest pouch, 4 lined '
                      'up under the well, 5 inserted, 6 seat push (gun jolts 1px), 7 charging handle pulled. The firing '
                      'hand never leaves the pistol grip; the gun is the same rigid sprite throughout.')


# =========================================================================== F: tools
ROCK_AT = (27, 30)


def mine_f():
    lean = dict(torso=TORSO_F_LEAN, dy=1, leg_n='stand_b', leg_f='stand_b', dn=1, df=1, sh=(1, 0))
    low = dict(arm_n='n_low', arm_f='f_low', arm_f_layer='front', tool_layer='front')
    wind = dict(arm_n='n_wind', arm_f='f_across', arm_f_layer='front', tool_layer='mid', leg_n='km1')
    fr = [
        # 0 ready: pick head resting on the rock, hands low together (dominant right hand nearer the head)
        pose(dict(low, tool=(PR.PICK_F['hit'], (17, 22)))),
        # 1 wind-up: raised over the right shoulder, weight back, the pick head behind the hair
        pose(dict(wind, tool=(PR.PICK_F['raise'], (12, 14)), sh=(-1, 0))),
        # 2 top of the wind-up: a touch higher, body coiled (anticipation peak)
        pose(dict(wind, tool=(PR.PICK_F['raise'], (12, 13)), sh=(-1, -1), head=HEAD_F_EFFORT)),
        # 3 smear: the downswing; the trail runs over the crown and down the open side
        pose(dict(arm_n='n_high', arm_f='f_front', arm_f_layer='front', tool=(PR.PICK_F['smear'], (18, 19)),
                  tool_layer='front', head=HEAD_F_EFFORT)),
        # 4 impact (held for the hit-stop): head bites the rock, body over it, knees soft
        pose(dict(low, tool=(PR.PICK_F['hit'], (18, 23)), head=HEAD_F_EFFORT, hit=[26, 29], **lean)),
        # 5 pry and lift: wrists still locked on the handle, head pulled free
        pose(dict(low, tool=(PR.PICK_F['lift'], (17, 22)), head=HEAD_F_DOWN)),
    ]
    return Anim('mine', fr, fps=9, loop=True, hold={4: 3},
                notes='Pickaxe, two hands: right (dominant) hand nearer the head, left hand at the end of the handle. '
                      'Wind-up over the right shoulder (frames 1-2), smear on the downswing (3), impact on frame 4 '
                      'held 3 ticks for the hit-stop with chips/sparks at meta.hit, pry-out keeps both hands on the '
                      'handle (5). The arc pivots at the shoulders and elbows; the face is never crossed.')


def farm_f():
    lean = dict(torso=TORSO_F_LEAN, dy=1, leg_n='stand_b', leg_f='stand_b', dn=1, df=1, sh=(1, 0))
    low = dict(arm_n='n_low', arm_f='f_low', arm_f_layer='front', tool_layer='front')
    fr = [
        pose(dict(low, tool=(PR.HOE_F['hit'], (17, 21)))),
        pose(dict(arm_n='n_wind', arm_f='f_across', arm_f_layer='front', tool=(PR.HOE_F['raise'], (12, 14)),
                  tool_layer='mid', leg_n='km1', sh=(-1, 0))),
        pose(dict(arm_n='n_high', arm_f='f_front', arm_f_layer='front', tool=(PR.HOE_F['smear'], (18, 19)),
                  tool_layer='front', head=HEAD_F_EFFORT)),
        pose(dict(low, tool=(PR.HOE_F['hit'], (18, 22)), head=HEAD_F_EFFORT, hit=[25, 29], **lean)),
        pose(dict(low, tool=(PR.HOE_F['pull'], (16, 22)), head=HEAD_F_DOWN, dy=1, leg_n='stand_b',
                  leg_f='stand_b', dn=1, df=1)),
        pose(dict(low, tool=(PR.HOE_F['hit'], (16, 21)), head=HEAD_F_DOWN)),
    ]
    return Anim('farm', fr, fps=8, loop=True, hold={3: 2},
                notes='Hoe, two hands: right hand nearer the blade, left hand at the end. Wind-up over the right '
                      'shoulder (1), chop with a smear that clears the face (2), blade bites the soil (3, held 2 ticks; '
                      'dirt puff at meta.hit), draw the soil back toward the feet (4), settle (5).')


PLATE_AT = (23, 18)


def repair_f():
    P = [(PR.PLATE, PLATE_AT, 'back')]
    hold = dict(arm_f='f_hold', arm_f_layer='front', props=P)
    fr = [
        pose(dict(hold, arm_n='n_low', arm_n_d=(-1, -1), tool=(PR.HAMMER_F['rest'], (16, 21)), tool_layer='hand')),
        pose(dict(hold, arm_n='n_cock', tool=(PR.HAMMER_F['back'], (11, 13)), tool_layer='mid', sh=(-1, 0))),
        pose(dict(hold, arm_n='n_strike', tool=(PR.HAMMER_F['smear'], (19, 21)), tool_layer='hand', head=HEAD_F_EFFORT)),
        pose(dict(hold, arm_n='n_strike', arm_n_d=(1, 0), tool=(PR.HAMMER_F['hit'], (18, 20)), tool_layer='hand',
                  head=HEAD_F_EFFORT, hit=[24, 21], sh=(1, 0))),
        pose(dict(hold, arm_n='n_strike', tool=(PR.HAMMER_F['bounce'], (17, 20)), tool_layer='hand')),
        pose(dict(hold, arm_n='n_cock', arm_n_d=(1, 1), tool=(PR.HAMMER_F['back'], (12, 14)), tool_layer='mid')),
    ]
    return Anim('repair', fr, fps=10, loop=True, hold={3: 2},
                notes='Claw hammer in the right hand at the end of the handle (one-handed tool), left hand holds the '
                      'steel patch flat on the target. Cock back by the ear (1), smear over the shoulder (2), strike '
                      'with the wrist snapping through (3, held 2 ticks, sparks at meta.hit), rebound (4), re-cock (5). '
                      'The swing pivots at the shoulder and elbow; the hand never lets go of the handle.')


def carry_f():
    fr = []
    for i, s in enumerate(WALK):
        sp = dict(s)
        sp.update(arm_n='n_carry', arm_f='f_carry', arm_f_layer='back')
        # the crate rides on the forearms: it follows the body bob, one frame late (weight)
        lag = WALK[(i - 1) % 8].get('dy', 0)
        sp['props'] = [(PR.CRATE, (19, 25 + lag), 'hand')]
        sp['pony'] = s.get('pony', 'rest')
        fr.append(pose(sp))
    toes = walk_toes()
    for f, t in zip(fr, toes):
        f.meta['planted'] = [list(p) for p in t]
    return Anim('carry', fr, fps=9, loop=True, stridePx=2,
                notes='Same no-slide gait as the walk. Both hands under the crate\'s bottom corners, elbows bent at '
                      'the sides, no arm swing; the crate follows the body bob one frame late (weight).')


def build_f():
    return {'idle': idle_f(), 'walk': walk_f(), 'aim': aim_f(), 'shoot': shoot_f(), 'reload': reload_f(),
            'mine': mine_f(), 'farm': farm_f(), 'repair': repair_f(), 'carry': carry_f()}


# =========================================================================== B view
TIE_B = (17, 13)                 # ponytail tie on the back of the head (B)


def pose_b(spec):
    """B stack, back to front: 'back' props (things in front of the hero, i.e. farther away: the rifle,
    a tool head at the work spot, a carried crate), far arm, far leg, near leg, torso, 'mid', head,
    ponytail (hangs over the nape, toward us), near arm, 'front' props (things behind the hero, i.e.
    nearer the camera: a tool raised over the shoulder)."""
    s = spec
    f = Frame(W, H)
    dy, (sx, sy) = s.get('dy', 0), s.get('sh', (0, 0))
    hdx, hdy = s.get('head_d', (0, 0))

    def layer(name):
        for p, at, lay in s.get('props', []):
            if lay == name:
                f.put(p, *at)
        if s.get('tool') and s.get('tool_layer', 'back') == name:
            f.put(s['tool'][0], *s['tool'][1])
        if s.get('gun') and name == 'back':
            g, (gx, gy) = s['gun']
            f.put(g, gx, gy)
            m, gp = g.pts['muzzle'], g.pts['grip']
            f.meta['muzzle'] = [gx - gp[0] + m[0], gy - gp[1] + m[1]]
            f.meta['grip'] = [gx, gy]

    layer('floor')
    layer('back')
    d = s.get('arm_f_d', (0, 0))
    if s.get('arm_f_layer', 'back') == 'back':
        f.put(ARM_B[s.get('arm_f', 'hang')], SH_F[0] + sx + d[0], SH_F[1] + dy + sy + d[1], cmap=FAR)
    f.put(LEG_B[s.get('leg_f', 'stand')], FAR_HIP[0], FAR_HIP[1] + s.get('df', 0), cmap=FAR)
    f.put(LEG_B[s.get('leg_n', 'stand')], NEAR_HIP[0], NEAR_HIP[1] + s.get('dn', 0))
    f.put(s.get('torso', TORSO_B), NECK[0] + sx, NECK[1] + dy + sy)
    if s.get('arm_f_layer', 'back') == 'mid':
        f.put(ARM_B[s['arm_f']], SH_F[0] + sx + d[0], SH_F[1] + dy + sy + d[1], cmap=FAR)
    layer('mid')
    f.put(s.get('head', HEAD_B), CHIN[0] + sx + hdx, CHIN[1] + dy + sy + hdy)
    f.put(PONY_B[s.get('pony', 'rest')], TIE_B[0] + sx + hdx, TIE_B[1] + dy + sy + hdy)
    if s.get('arm_f_layer', 'back') == 'front':
        f.put(ARM_B[s['arm_f']], SH_F[0] + sx + d[0], SH_F[1] + dy + sy + d[1], cmap=FAR)
    d = s.get('arm_n_d', (0, 0))
    f.put(ARM_B[s.get('arm_n', 'hang')], SH_N[0] + sx + d[0], SH_N[1] + dy + sy + d[1])
    layer('front')
    if s.get('patch'):
        f.px(s['patch'], HT)
    for k in ('hit', 'mag', 'hands'):
        if k in s:
            f.meta[k] = s[k]
    return f


def idle_b():
    low = dict(dy=1, leg_n='stand_b', leg_f='stand_b', dn=1, df=1)
    fr = [pose_b({}), pose_b({**low, 'pony': 'up'}), pose_b({**low}), pose_b({'pony': 'down'})]
    return Anim('idle', fr, fps=5, loop=True,
                notes='Same breathing as F, seen from behind: knees soften 1px, head and shoulders follow, the '
                      'ponytail lags. Far (right) leg and arm one ramp step darker and behind the torso.')


B_PONY = {'rest': 'rest', 'up': 'up', 'down': 'down'}


def walk_b():
    fr = []
    for i, s in enumerate(WALK):
        sp = dict(s)
        sp['arm_n'] = {'back': 'back', 'fwd': 'fwd', 'hang': 'hang'}[s['arm_n']]
        sp['arm_f'] = {'back': 'back', 'fwd': 'fwd', 'hang': 'hang'}[s['arm_f']]
        sp['pony'] = ['right', 'rest', 'left', 'rest', 'left', 'rest', 'right', 'rest'][i]
        fr.append(pose_b(sp))
    toes_b = {'stand': (-3, 6), 'k2': (-7, 3), 'k1': (-5, 4), 'km1': (-1, 7), 'km2': (1, 7)}
    for i, (f, s) in enumerate(zip(fr, WALK)):
        pts = []
        if i in PLANTED_N:
            t = toes_b[PLANTED_N[i]]
            pts.append([NEAR_HIP[0] + t[0], NEAR_HIP[1] + s.get('dn', 0) + t[1]])
        if i in PLANTED_F:
            t = toes_b[PLANTED_F[i]]
            pts.append([FAR_HIP[0] + t[0], FAR_HIP[1] + s.get('df', 0) + t[1]])
        f.meta['planted'] = pts
    return Anim('walk', fr, fps=10, loop=True, stridePx=2,
                notes='Walking up-left: the planted boot moves exactly (+2,+1) px per frame (toe tracker). Front '
                      'foot reads higher on screen (farther away), back foot lower. Boots point up-left, heels '
                      'toward us. Ponytail swings side to side with the hips.')


GRIP_B = (17, 16)


def rifle_b(d=(0, 0), gun=None, arm_n='aim_n', arm_n_d=(0, 0), head=HEAD_B, head_d=(-1, 1), **kw):
    gun = gun or GN.AR_B
    sp = dict(leg_n='k1', leg_f='km1', dn=1, head=head, head_d=head_d, gun=(gun, (GRIP_B[0] + d[0], GRIP_B[1] + d[1])),
              arm_n=arm_n, arm_n_d=(d[0] + arm_n_d[0], d[1] + arm_n_d[1]), arm_f='aim_f', arm_f_d=d)
    sp.update(kw)
    return sp


def aim_b():
    fr = [pose_b(rifle_b(d=(2, 2), head_d=(0, 0))), pose_b(rifle_b())]
    return Anim('aim', fr, fps=8, loop=False,
                notes='Rifle in the right shoulder pocket (far side), so most of it is hidden by the body; the barrel '
                      'and the left hand under the handguard show up-left of the head. Right elbow out at the right. '
                      'Same rigid sprite, translated only.')


def shoot_b():
    fr = [pose_b(rifle_b()), pose_b(rifle_b(d=(2, 0), sh=(1, 0), head_d=(0, 1))), pose_b(rifle_b(d=(1, 0), head_d=(-1, 1)))]
    fr[0].meta['flash'] = True
    return Anim('shoot', fr, fps=15, loop=False,
                notes='Recoil pushes the rifle back along the barrel axis toward us (+2,+1) and up 1px = (+2,0); the '
                      'left hand and the shoulders ride with it. Flash at meta.muzzle on frame 0 only; the flash '
                      'sits farther away than the hero, so the head may overlap it.')


def reload_b():
    G0 = (1, 2)
    NM = GN.AR_B_NOMAG
    lo = dict(head=HEAD_B_DOWN, head_d=(-1, 1))
    fr = [
        pose_b(rifle_b(d=G0, arm_n='rl_low', arm_n_d=(1, -1), **lo)),
        pose_b(rifle_b(d=G0, gun=NM, arm_n='rl_low', arm_n_d=(0, 1), **lo, props=[(GN.MAG, (10, 25), 'front')])),
        pose_b(rifle_b(d=G0, gun=NM, arm_n='rl_in', arm_n_d=(0, 0), **lo, props=[(GN.MAG_TILT, (8, 28), 'front')])),
        pose_b(rifle_b(d=G0, gun=NM, arm_n='rl_in', arm_n_d=(1, 1), **lo)),
        pose_b(rifle_b(d=G0, gun=NM, arm_n='rl_low', arm_n_d=(1, 0), **lo, props=[(GN.MAG, (10, 24), 'front')])),
        pose_b(rifle_b(d=G0, arm_n='rl_low', arm_n_d=(1, -2), **lo)),
        pose_b(rifle_b(d=(1, 1), arm_n='rl_low', arm_n_d=(1, -3), **lo)),
        pose_b(rifle_b(d=(1, 1), arm_n='rl_in', arm_n_d=(2, -1), head=HEAD_B, head_d=(0, 0))),
    ]
    return Anim('reload', fr, fps=8, loop=False,
                notes='Same sequence as F (release, old magazine out and falling at the left, vest, insert, seat push, '
                      'charging handle), seen from behind: the magazine well is in front of the chest, so the left '
                      'arm carries the story and the old magazine drops into view at the left.')


def _m(p):
    m = p.mirrored()
    m.pts = dict(p.pts)
    return m


ROCK_B = (8, 27)


def mine_b():
    hit, raise_, smear, lift = (_m(PR.PICK_F[k]) for k in ('hit', 'raise', 'smear', 'lift'))
    R = [(PR.ROCK, ROCK_B, 'floor')]
    fwd = dict(arm_n='n_fwd', arm_f='hang', arm_f_d=(-1, -2))
    wind = dict(arm_n='n_across', arm_f='f_wind', arm_f_layer='mid', tool_layer='front', leg_n='km1', dn=0)
    fr = [
        pose_b(dict(fwd, tool=(hit, (14, 21)), tool_layer='back', props=R)),
        pose_b(dict(wind, tool=(raise_, (20, 14)), sh=(1, 0), props=R)),
        pose_b(dict(wind, tool=(raise_, (20, 13)), sh=(1, -1), props=R)),
        pose_b(dict(arm_n='n_up', arm_f='f_up', arm_f_layer='mid', tool=(smear, (14, 19)), tool_layer='front', props=R)),
        pose_b(dict(fwd, tool=(hit, (13, 22)), tool_layer='back', torso=TORSO_B_LEAN, head=HEAD_B_DOWN, dy=1,
                    leg_n='stand_b', leg_f='stand_b', dn=1, df=1, hit=[6, 27], props=R)),
        pose_b(dict(fwd, tool=(lift, (14, 21)), tool_layer='back', head=HEAD_B_DOWN, props=R)),
    ]
    return Anim('mine', fr, fps=9, loop=True, hold={4: 3},
                notes='From behind: wind-up over the right shoulder brings the pick toward us (drawn over the head), '
                      'the downswing passes over the crown to the rock in front (up-left, behind the body). Both '
                      'hands on the handle throughout; dominant right hand nearer the head.')


def farm_b():
    hit, raise_, smear, pull = (_m(PR.HOE_F[k]) for k in ('hit', 'raise', 'smear', 'pull'))
    fwd = dict(arm_n='n_fwd', arm_f='hang', arm_f_d=(-1, -2))
    fr = [
        pose_b(dict(fwd, tool=(hit, (14, 21)), tool_layer='back')),
        pose_b(dict(arm_n='n_across', arm_f='f_wind', arm_f_layer='mid', tool=(raise_, (20, 14)), tool_layer='front',
                    leg_n='km1', sh=(1, 0))),
        pose_b(dict(arm_n='n_up', arm_f='f_up', arm_f_layer='mid', tool=(smear, (14, 19)), tool_layer='front')),
        pose_b(dict(fwd, tool=(hit, (13, 22)), tool_layer='back', torso=TORSO_B_LEAN, head=HEAD_B_DOWN, dy=1,
                    leg_n='stand_b', leg_f='stand_b', dn=1, df=1, hit=[7, 28])),
        pose_b(dict(fwd, tool=(pull, (15, 22)), tool_layer='back', head=HEAD_B_DOWN, dy=1, leg_n='stand_b',
                    leg_f='stand_b', dn=1, df=1)),
        pose_b(dict(fwd, tool=(hit, (15, 21)), tool_layer='back', head=HEAD_B_DOWN)),
    ]
    return Anim('farm', fr, fps=8, loop=True, hold={3: 2},
                notes='Hoe from behind: lift over the right shoulder (toward us), chop over the crown, blade into the '
                      'soil in front (up-left), pull back. Two hands on the handle in every frame.')


def repair_b():
    up, back, hit, smear, bounce = (_m(PR.HAMMER_F[k]) for k in ('rest', 'back', 'hit', 'smear', 'bounce'))
    P = [(PR.PLATE.mirrored(), (9, 10), 'back')]
    hold = dict(arm_n='aim_n', arm_n_d=(-1, -1), props=P)
    fr = [
        pose_b(dict(hold, arm_f='f_strike', tool=(up, (17, 18)), tool_layer='back')),
        pose_b(dict(hold, arm_f='f_wind', arm_f_layer='mid', tool=(back, (21, 13)), tool_layer='front')),
        pose_b(dict(hold, arm_f='f_strike', tool=(smear, (15, 16)), tool_layer='back')),
        pose_b(dict(hold, arm_f='f_strike', tool=(hit, (12, 13)), tool_layer='back', hit=[6, 12])),
        pose_b(dict(hold, arm_f='f_strike', tool=(bounce, (13, 13)), tool_layer='back')),
        pose_b(dict(hold, arm_f='f_wind', arm_f_layer='mid', tool=(back, (20, 14)), tool_layer='front')),
    ]
    return Anim('repair', fr, fps=10, loop=True, hold={3: 2},
                notes='From behind: the left hand holds the steel patch on the target up-left; the right (dominant) '
                      'arm cocks the hammer by the right ear (toward us, drawn over the head), swings it over the '
                      'shoulder and strikes the patch (sparks at meta.hit).')


def carry_b():
    fr = []
    for i, s in enumerate(WALK):
        sp = dict(s)
        sp.update(arm_n='n_carry', arm_f='hang', arm_f_d=(0, -1), pony=['right', 'rest', 'left', 'rest'][i % 4])
        lag = WALK[(i - 1) % 8].get('dy', 0)
        sp['props'] = [(PR.CRATE, (11, 22 + lag), 'back')]
        fr.append(pose_b(sp))
    return Anim('carry', fr, fps=9, loop=True, stridePx=2,
                notes='Crate held in front of the chest, i.e. farther away than the body: it shows above-left of the '
                      'shoulders. Same no-slide gait as the B walk; elbows out, no arm swing.')


def ladder_b():
    """Hands on the rails (x=11 left/near rail, x=21 right/far rail at this frame's ladder placement).
    The sprite climbs 2px per frame; a gripping hand moves down 2px per frame in sprite space."""
    L = [(LADDER_B, (16, 31), 'floor')]
    fr = []
    # hand heights (sprite y of the grip) and foot rungs per frame
    plan = [
        dict(n='n_rail_hi', nd=(0, -5), f='f_rail_lo', fd=(0, -2), ln='climb_lo', lf='climb_hi'),
        dict(n='n_rail_hi', nd=(0, -3), f='f_rail_lo', fd=(0, 0), ln='climb_lo', lf='climb_mid'),
        dict(n='n_rail_lo', nd=(0, -2), f='f_rail_hi', fd=(0, -5), ln='climb_hi', lf='climb_lo'),
        dict(n='n_rail_lo', nd=(0, 0), f='f_rail_hi', fd=(0, -3), ln='climb_mid', lf='climb_lo'),
    ]
    for i, p in enumerate(plan):
        sp = dict(arm_n=p['n'], arm_n_d=p['nd'], arm_f=p['f'], arm_f_d=p['fd'], arm_f_layer='back',
                  leg_n=p['ln'], leg_f=p['lf'], head=HEAD_B, props=L, pony=['down', 'rest', 'down', 'rest'][i])
        fr.append(pose_b(sp))
    return Anim('ladder', fr, fps=6, loop=True, climbPx=2,
                notes='Seen from behind, hands on the two rails a shoulder-width apart (the ladder prop is drawn '
                      'with the rungs on the 2:1 wall slope). Opposite hand and foot move together; the game moves '
                      'the sprite up 2px per frame so a gripping hand stays put on its rail.')


def build_b():
    return {'idle': idle_b(), 'walk': walk_b(), 'aim': aim_b(), 'shoot': shoot_b(), 'reload': reload_b(),
            'mine': mine_b(), 'farm': farm_b(), 'repair': repair_b(), 'carry': carry_b(), 'ladder': ladder_b()}


if __name__ == '__main__':
    import sys
    sys.path.insert(0, '/tmp/claude-0/-home-user-roblox-balance/fc99fad7-9f21-557e-b4ef-94064ecb56bf/scratchpad')
    from look import show
    view = sys.argv[1]
    A = build_f() if view == 'F' else build_b()
    which = sys.argv[2:] or list(A)
    arrs, marks = [], {}
    for k in which:
        a = A[k]
        for i, f in enumerate(a.frames):
            lab = f'{k}{i}'
            arrs.append((lab, f.a))
            mk = []
            if 'muzzle' in f.meta:
                mk.append((*f.meta['muzzle'], (255, 255, 0)))
            if 'hit' in f.meta:
                mk.append((*f.meta['hit'], (0, 255, 255)))
            for p in f.meta.get('planted', []):
                mk.append((*p, (255, 120, 0)))
            marks[lab] = mk
    show('hero' + view + '_' + '_'.join(which), arrs, s=8, cols=8, marks=marks)
