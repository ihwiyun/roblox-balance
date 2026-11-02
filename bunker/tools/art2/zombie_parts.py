"""Zombie walker, redesigned: hand-drawn parts. 32x32, F (facing down-right) and B (facing up-left).

A hunched shambler: the head juts forward and down, the near (right) arm reaches for you, the far
arm hangs. Grey-green skin (sage ramp), torn maroon shirt with ribs showing through, dusk trousers,
one muddy shoe. Its legs reuse the survivor's leg drawings, recoloured, so the gait is exactly as
slide-free (the planted foot moves (-2,-1) per frame in F, (+2,+1) in B).
Light from the top-left; far limbs one ramp step darker and behind the torso.
"""
from core import K, Part
import hero_parts as HP

ZT = K({
    'o': 'ink', 'k': 'slate', 'S': 'sage', 'L': 'fern', 'l': 'bone', 'h': 'coal',
    'e': 'cream', 'E': 'lime', 'm': 'wine', 't': 'bone', 'w': 'wine', 'W': 'crimson', 'x': 'oxblood',
    'g': 'grape', 'M': 'mauve', 'R': 'rose', 'b': 'bone', 'B': 'mist',
    'p': 'dusk', 'P': 'lilac', 'q': 'night', 'u': 'mud', 'v': 'olive', 'y': 'night', 'n': 'navy',
})

ZFAR = {ZT['L']: ZT['S'], ZT['S']: ZT['k'], ZT['k']: ZT['o'], ZT['l']: ZT['L'],
        ZT['R']: ZT['M'], ZT['M']: ZT['g'], ZT['g']: ZT['o'],
        ZT['P']: ZT['p'], ZT['p']: ZT['q'], ZT['q']: ZT['o'], ZT['v']: ZT['u'], ZT['u']: ZT['o']}

# hero jeans/boots -> zombie trousers/shoe (recolour only; the drawings are the survivor's legs)
LEGMAP = {HP.HT['B']: ZT['P'], HP.HT['C']: ZT['p'], HP.HT['D']: ZT['q'], HP.HT['N']: ZT['o'],
          HP.HT['Y']: ZT['v'], HP.HT['Z']: ZT['u'], HP.HT['z']: ZT['o']}


def P(text, ax=0, ay=0, name=''):
    return Part(text, ZT, ax, ay, name)


def legs(src):
    return {k: p.recolored(LEGMAP) for k, p in src.items()}


ZLEG_F = legs(HP.LEG_F)
ZLEG_B = legs(HP.LEG_B)

# ---------------------------------------------------------------- F head (anchor: under the jaw)
ZHEAD_F = P("""
...ooooo....
..oLlLSSoo..
.oLlLSSSSho.
oLLSShSSShko
oLSSSSSSkSko
oSSSSoSSSSko
okSSoeoSSoeo
.okSSSSSkSSo
..okSSoooSko
...okomtmto.
....oooooo..
""", 6, 10, 'zheadF')
# jaw wide open (attack, roar on hit)
ZHEAD_F_OPEN = P("""
...ooooo....
..oLlLSSoo..
.oLlLSSSSho.
oLLSShSSShko
oLSSSSSSkSko
oSSSSoSSSSko
okSSoeoSSoeo
.okSSSSSkSSo
..okSSoooSko
...okomxmmo.
...okotmtmo.
....oooooo..
""", 6, 11, 'zheadF_open')
# head snapped back (hit, death): chin up, eyes rolled
ZHEAD_F_BACK = P("""
....oooo....
..ooLlSSoo..
.oLlLSSSShko
oLLSSSSShSko
oLSSSSSSSSko
okSSSSoSSSko
.okSSolSSlko
..okSSSSkSo.
...okoomoko.
....ootmto..
.....oooo...
""", 6, 10, 'zheadF_back')

# ---------------------------------------------------------------- F torso (anchor: neck)
ZTORSO_F = P("""
.....okSo....
...ooRMMMgo..
..oRRMbbMMgo.
..oRMbSbMMgo.
.oRMMbbMwWgo.
.oRMMMMMMMgo.
..oRMgMMgMgo.
..oMoMgoMgo..
...opPPpqqo..
""", 6, 0, 'ztorsoF')
# lunging forward (attack strike): shoulders further down-right
ZTORSO_F_LUNGE = P("""
.............
......okSo...
....ooRMMMgo.
..ooRMbbMMgo.
..oRMbSbMMgo.
.oRMMbbMwWgo.
.oRMMMMMMgo..
..oRMgMMgMo..
...opPPpqqo..
""", 6, 0, 'ztorsoF_lunge')

# ---------------------------------------------------------------- F arms (anchor: shoulder)
ZARM_F = {
    'reach': P("""
.oo........
oRMoo......
oRMMMoo....
.oMMgSSoo..
..oogLSSSoo
....okSSkLo
.....oSoSo.
......o.o..
""", 1, 1, 'zarm_reach'),
    'reach_lo': P("""
.oo.......
oRMoo.....
oRMMMoo...
.oMMgSSo..
..oogLSSo.
....okSSoo
....oSkSLo
.....oSoSo
......o.o.
""", 1, 1, 'zarm_reach_lo'),
    'reach_hi': P("""
.oo.....o.o
oRMoo..oSoSo
oRMMMoooSkLo
.oMMgSSSSko.
..oogLSSoo..
....oooo....
""", 1, 1, 'zarm_reach_hi'),
    'hang': P("""
.oo.
oRMo
oRMg
oMMg
.oSo
.oLSo
.oSSo
.okSo
.oSoSo
..o.o.
""", 1, 1, 'zarm_hang'),
    'hang_fwd': P("""
.oo..
oRMo.
oRMg.
.oMMg
.oSSo
..oLSo
..oSSo
..okSo
..oSoSo
...o.o.
""", 1, 1, 'zarm_hang_fwd'),
    # attack wind-up: claws up and back over the near shoulder
    'raise': P("""
o.o...
oSoSo.
oLSko.
.oSSo.
.oSMo.
oRMMgo
oRMMgo
.oooo.
""", 3, 6, 'zarm_raise'),
    # swipe smear: the arm sweeping down-forward, trail of light skin
    'swipe': P("""
..LL......
.L..oo....
L..oRMoo..
...oRMMMoo
....oMgSSo
.....oLSSkoo
......okSLlo
.......oSoSo
........o.o.
""", 4, 3, 'zarm_swipe'),
    # strike: arm thrust low and forward, claws open at the target
    'strike': P("""
.oo.........
oRMoo.......
oRMMMooo....
.oMMMgSSoo..
..ooogLSSSoo
.....okSSSkLo
......oSoSoSo
.......o.o.o.
""", 1, 1, 'zarm_strike'),
    # flung back (hit / death)
    'fling': P("""
...o.o
..oSoSo
.oSSLko
oSSko.
oRMo..
oRMgo.
.ooo..
""", 4, 5, 'zarm_fling'),
}

# ---------------------------------------------------------------- B (back view, facing up-left)
ZHEAD_B = P("""
...ooooo....
..oLlLSSoo..
.oLlLSSSSho.
oLLShSSSSSko
oLSSSSShSSko
oSSShSSSSSko
okSSSSSwSSko
lkSSSSSwWSko
lokSSSSSSko.
..okkSSSko..
...oooooo...
""", 6, 10, 'zheadB')

ZTORSO_B = P("""
.....okSo....
...ooRMMMgo..
..oRRMMMMMgo.
..oRMMSlMMgo.
.oRMMMSlSMgo.
.oRMMMSkMMgo.
..oRMgMMgMgo.
..oMoMgoMgo..
...opPPpqqo..
""", 6, 0, 'ztorsoB')

# B arms: reaching forward = up-left (away), seen from behind
ZARM_B = {
    'reach': P("""
.o.o.....
oSoSo....
oLSko....
.oSSoo...
..oSMMoo.
...oRMMgo
....oRMgo
.....ooo.
""", 7, 6, 'zarmB_reach'),
    'reach_hi': P("""
o.o......
oSoSo....
oLSkoo...
.oSSMMo..
..oRMMgo.
...oRMgo.
....ooo..
""", 6, 5, 'zarmB_reach_hi'),
    'hang': ZARM_F['hang'],
    'hang_fwd': ZARM_F['hang_fwd'],
    'raise': P("""
...o.o
..oSoSo
..okSLo
..oSSo.
..oMSo.
.ogMMRo
.ogMMRo
..oooo.
""", 3, 6, 'zarmB_raise'),
    'strike': P("""
o.o.......
oSoSoo....
oLSSkoo...
.ooSSMMoo.
...ooRMMgo
.....oRMgo
......ooo.
""", 8, 5, 'zarmB_strike'),
    'fling': ZARM_F['fling'],
}

# ---------------------------------------------------------------- death: lying on the back (F: fell
# backward, i.e. up-left; feet near the anchor, head up-left). Hand-drawn whole, then dissolved.
ZDEAD_F = P("""
.....ooooo.................
...ooLlLSSoo...............
..oLlSSSSSSko..............
..oSSoeSoeSko..............
..okSSSoooSkooo............
...okooommoMRRMoooo........
....oooRMbbMMMMRMgoo.......
.....oRMbSbMMwWMMgMgoo.....
......oRMMMgMMMMMgggoPPoo..
.......ooRMMMgMMgoopPPpqqo.
.........ooooMggoopPPpqqoo.
.............ooo.opPpqqoSo.
..................oooooukSo
....................ouuuoo.
.....................ooo...
""", 22, 13, 'zdeadF')

# kneeling (death): knee on the ground in front, shin and shoe trailing back along the floor
ZKNEEL_F = P("""
oPppo...
.oPppqo.
..oppqqo
.ouupqqo
ouuoooo.
.oo.....
""", 2, 0, 'zkneelF')
ZKNEEL_B = P("""
...oPppo
.oqppPo.
oqqppo..
oqqpuuo.
.oooouuo
.....oo.
""", 5, 0, 'zkneelB')
ZARM_B['reach_lo'] = P("""
.........
.o.o.....
oSoSo....
oLSkoo...
.oSSMMo..
..oRMMgo.
...oRMgo.
....ooo..
""", 7, 6, 'zarmB_reach_lo')
