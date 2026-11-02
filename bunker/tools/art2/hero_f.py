"""Survivor hero, F view (three-quarter, facing down-right). Hand-drawn parts.

Frame 32x32, ground anchor (16, 28). Near side = the character's RIGHT (screen left),
far side = the character's LEFT (screen right, drawn behind the torso and darker).

Key table (shared with hero_b.py):
  hair  q outline (grape)  h shadow (oxblood)  H base (rust)  J light (copper)  j spec (tan)
  skin  k line (rust)  s shadow (tan)  S base (peach)  L light (cream2)  r blush (salmon)
  face  E eye top (navy)  e eye/lash (ink)  m mouth (wine)
  coat  O outline (navy)  D shadow (deepsea)  C base (teal)  A light (aqua)
  shirt W light (mist)  w shade (steel)   strap/belt b (mud)  B strap light (olive)  g buckle (gold)
  pants p left edge (night)  P base (dusk)  Q light (lilac)  o ink (shadow-side edge, soles)
  boots z edge (grape)  Z base (plum)  y light (rosewood)
"""
from core import K, Part

HT = K({
    'o': 'ink', 'q': 'grape', 'h': 'oxblood', 'H': 'rust', 'J': 'copper', 'j': 'tan',
    'k': 'rust', 's': 'tan', 'S': 'peach', 'L': 'cream2', 'r': 'salmon',
    'E': 'navy', 'e': 'ink', 'm': 'wine',
    'O': 'navy', 'D': 'deepsea', 'C': 'teal', 'A': 'aqua',
    'W': 'mist', 'w': 'steel', 'b': 'mud', 'B': 'olive', 'g': 'gold',
    'p': 'night', 'P': 'dusk', 'Q': 'lilac',
    'z': 'grape', 'Z': 'plum', 'y': 'rosewood',
})

# far-side recolour: one ramp step darker (applied to far arm / far leg)
FAR = {HT['A']: HT['C'], HT['C']: HT['D'], HT['D']: HT['O'],
       HT['L']: HT['S'], HT['S']: HT['s'], HT['s']: HT['k'],
       HT['Q']: HT['P'], HT['P']: HT['p'], HT['p']: HT['o'],
       HT['y']: HT['Z'], HT['Z']: HT['z'], HT['z']: HT['o'],
       HT['W']: HT['w']}


def P(text, ax=0, ay=0, name=''):
    return Part(text, HT, ax, ay, name)


# ---------------------------------------------------------------- head (placed by top-left)
HEAD = P("""
.....qq.........
...qqhJqqq......
..qhJJjjJJqq....
.qhJjjJJJJJHq...
.qHJjJJJJJHHHq..
qhJJJJJJHHHhHHq.
qHJJJJHHHhHHhHo.
qhHJJHHhHHLHhLk.
qhHHhHHhSLSShSk.
.qhHhkSSSSSSSSk.
.qhHkLkSSESSESk.
..qhkSkSSeSSeSk.
..qhhkSSSrSSrsk.
...qqhkSSSmssk..
.....qkkssskk...
""", name='headF')

HEAD_BLINK = P("""
.....qq.........
...qqhJqqq......
..qhJJjjJJqq....
.qhJjjJJJJJHq...
.qHJjJJJJJHHHq..
qhJJJJJJHHHhHHq.
qHJJJJHHHhHHhHo.
qhHJJHHhHHLHhLk.
qhHHhHHhSLSShSk.
.qhHhkSSSSSSSSk.
.qhHkLkSSSSSSSk.
..qhkSkSSeSSeSk.
..qhhkSSSrSSrsk.
...qqhkSSSmssk..
.....qkkssskk...
""", name='headF_blink')

# ---------------------------------------------------------------- ponytail (behind head; anchor = tie point)
PONY = {
    'rest': P("""
..qqq.
.qhJJq
qhJjHq
qHJJHq
qHJHhq
.qHHhq
.qHHq.
..qHq.
..qhq.
...q..
""", 5, 1, 'pony_rest'),
    # flicked out/up (body just dropped)
    'up': P("""
.qqqq.
qhJJJq
qJjJHq
qHJHhq
.qHHhq
..qHhq
..qhq.
...q..
""", 5, 1, 'pony_up'),
    # hanging long (body just rose)
    'down': P("""
...qq.
..qJJq
.qhjHq
.qHJHq
.qHJHq
.qHHhq
..qHhq
..qHq.
..qhq.
..qhq.
...q..
""", 5, 1, 'pony_down'),
    # swept back (fast move / swing)
    'back': P("""
....qq
.qqqJJ
qhJjJH
qHJJHh
.qHHhq
..qqq.
""", 5, 1, 'pony_back'),
}

# ---------------------------------------------------------------- torso (jacket, shirt, strap, belt)
TORSO = P("""
...OCCDO..
.OACWwDCO.
OAACWwDCCO
OACbbwDCCO
OACCbbDCDO
OCCCCbbCDO
OCCCCDbbDO
ObbbgbbbbO
""", name='torsoF')

# ---------------------------------------------------------------- arms (anchor = shoulder pivot)
# near arm = character's right arm, drawn over the torso. Inner contour uses D (not outline navy).
ARM_N = {
    'hang': P("""
.OAO.
OAACD
OACCD
OACCD
.OCCD
.OCDO
.kLSk
.kSsk
..kk.
""", 2, 1),
    'fwd1': P("""
.OAO..
OAACD.
OACCD.
.OACCD
.OCCDO
..kLSk
..kSsk
...kk.
""", 2, 1),
    'fwd2': P("""
.OAO...
OAACD..
OACCCD.
.OACCDO
..OCDDO
...kLSk
...kSsk
....kk.
""", 2, 1),
    'back1': P("""
..OAO
.OAACD
.OACCD
.OACCD
OACDO.
kLSk..
kSsk..
.kk...
""", 3, 1),
    'back2': P("""
...OAO
..OAACD
.OACCDO
OACCDO.
OCDO...
kLSk...
kSsk...
.kk....
""", 4, 1),
}

# far arm = character's left arm, behind the torso (already in the dark ramp)
ARM_F = {
    'hang': P("""
.OO.
ODDO
ODDO
ODDO
.ODO
.ODO
.kSk
.kkk
""", 1, 1),
    'fwd1': P("""
.OO..
ODDO.
ODDO.
.ODDO
.ODDO
..kSk
..kkk
""", 1, 1),
    'fwd2': P("""
.OO...
ODDO..
ODDDO.
.ODDDO
..OODO
...kSk
...kkk
""", 1, 1),
    'back1': P("""
.OO.
ODDO
ODDO
ODDO
OkSk
.kk.
""", 1, 1),
    'back2': P("""
..OO
.ODO
ODDO
kSk.
kk..
""", 2, 1),
}

# ---------------------------------------------------------------- legs (anchor = hip centre)
# One library for both legs: the near leg uses it as drawn, the far leg recoloured with FAR and
# placed behind. Pose names follow the walk: foot offset from the hip in brackets.
LEG = {
    # planted, straight under the hip (0,+6) - also the standing leg
    'pass': P("""
..pQPPo..
..pQPPo..
..pQPPo..
..pPPPo..
..zyZZo..
..zyZZZZo
...oooooo
""", 4, 0),
    # just after contact, knee giving forward (+1,+5)
    'down': P("""
..pQPPo...
...pQPPo..
...pQPPo..
...zyZZo..
...zyZZZZo
....oooooo
""", 4, 0),
    # heel strike, leg reaching forward (+2,+7)
    'contact': P("""
..pQPPo...
...pQPPo..
...pQPPo..
....pQPPo.
....pPPPoz
....zyZZZo
....zyZZZo
.....ooo..
""", 4, 0),
    # leg behind, heel rising (-1,+6)
    'up': P("""
..pQPPo..
..pQPPo..
.pQPPo...
.pPPPo...
.zyZZo...
.ozyZZZo.
...ooooo.
""", 4, 0),
    # toe-off, heel up, leg trailing (-2,+5)
    'toeoff': P("""
..pQPPo..
.pQPPo...
.pQPPo...
pQPPo....
zyZZo....
.ozZZo...
""", 4, 0),
    # swing: foot lifted behind, knee bent (-1,+3 above ground by 1)
    'lift': P("""
..pQPPo..
..pQPPo..
.pPPPo...
zyZZo....
.oZZo....
""", 4, 0),
    # swing: passing, knee forward, foot tucked (0,+4)
    'swing': P("""
..pQPPo..
...pQPPo.
..pPPPo..
..zyZZo..
..ozZZZo.
""", 4, 0),
    # swing: reaching forward, toe up (+1,+6)
    'reach': P("""
..pQPPo...
...pQPPo..
...pQPPo..
....pPPo..
...zyZZZoz
...zyZZZo.
....oooo..
""", 4, 0),
}

# pelvis cap: pants top that hides both hip joints (drawn over the legs, under the belt)
PELVIS = P("""
.pQPPPPPPo.
.pQPPPPPPo.
""", 5, 0, 'pelvisF')
