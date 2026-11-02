"""Survivor hero: hand-drawn parts (one char per pixel). F = three-quarter view facing down-right,
B = three-quarter back view facing up-left. The game mirrors F for down-left and B for up-right.

Frame 32x32. Ground anchor (16, 29): the near sole sits on row 29, the far sole one row higher (28),
which is how two feet a hip-width apart project in this 2:1 isometric camera.
  F: near side = the character's RIGHT (screen left); far side = LEFT (screen right, behind the torso).
  B: near side = the character's LEFT (screen left); far side = RIGHT (screen right, behind the torso).
Far limbs are drawn first and recoloured one ramp step darker (FAR); their hip and shoulder joints sit
under the torso part, so no far joint is ever visible.

Light: top-left. Outlines: ink on the shadow side and the ground, a dark material colour on the lit
side (selective outline). Materials: auburn hair, peach skin, olive field jacket, red scarf, blue
jeans, dark slate boots, mud-brown belt and straps.
"""
from core import K, Part

HT = K({
    'o': 'ink', 'q': 'grape', 'h': 'oxblood', 'H': 'rust', 'J': 'copper', 'j': 'tan',
    'L': 'cream2', 'S': 'peach', 's': 'tan', 'k': 'copper', 'e': 'ink', 'w': 'white', 'm': 'rosewood',
    'u': 'mud', 'V': 'olive', 'W': 'moss', 'X': 'pear',
    '1': 'brick', '2': 'vermil', '3': 'oxblood',
    'N': 'navy', 'D': 'indigo', 'C': 'blue', 'B': 'sky', 'g': 'gold',
    'z': 'coal', 'Z': 'slate', 'Y': 'sage', 'x': 'night',
    # props (tools, crate, ladder, bed): wood, steel, dirt, rock
    'a': 'mud', 'b': 'olive', 'c': 'rust', 'd': 'copper', 'f': 'tan', 'F': 'apricot',
    'G': 'steel', 'I': 'mist', 'i': 'lilac', 'n': 'dusk', 'r': 'rosewood', 't': 'khaki',
    'v': 'plum', 'y': 'night', 'p': 'brick', 'P': 'vermil', 'Q': 'white', 'U': 'bone', 'E': 'fern',
    'l': 'cream', 'M': 'gold', 'O': 'amber', 'R': 'red',
})

# far-side recolour: one ramp step darker (applied to the far arm and the far leg)
FAR = {HT['W']: HT['V'], HT['V']: HT['u'], HT['u']: HT['o'],
       HT['L']: HT['S'], HT['S']: HT['s'], HT['s']: HT['k'],
       HT['B']: HT['C'], HT['C']: HT['D'], HT['D']: HT['N'], HT['N']: HT['x'],
       HT['Y']: HT['Z'], HT['Z']: HT['z'], HT['z']: HT['o']}


def P(text, ax=0, ay=0, name=''):
    return Part(text, HT, ax, ay, name)


# =============================================================================================== F
# ---------------------------------------------------------------- head (anchor: under the chin)
HEAD_F = P("""
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHHHHHHhq
qhHHHHHhhHShq
qhHHHHhSSLhSk
qhHHqhSLShSSk
qhHqSkSeSSeSk
qhhqSkSeSSeSk
.qqhkSSSSSSsk
...qkkSSSmsko
.....oksssko.
""", 7, 12, 'headF')

# eyes closed (blink / sleep): the lids are a 1px copper line
HEAD_F_BLINK = P("""
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHHHHHHhq
qhHHHHHhhHShq
qhHHHHhSSLhSk
qhHHqhSLShSSk
qhHqSkSSSSSSk
qhhqSkSkSSkSk
.qqhkSSSSSSsk
...qkkSSSmsko
.....oksssko.
""", 7, 12, 'headF_blink')

# looking down at the work (farm, mine, repair): the face drops, the crown shows more
HEAD_F_DOWN = P("""
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHHHHHHHq
qhHHHHHHHhHhq
qhHHHHHhhSShk
qhHHqhhSLShSk
qhHqSkSSLSSSk
qhhqSkSeSSeSk
.qqhkSSSSSSsk
...qkkSSSssko
.....okkkko..
""", 7, 12, 'headF_down')

# effort: brows down, eyes squeezed, mouth open (swing impact, lift)
HEAD_F_EFFORT = P("""
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHHHHHHhq
qhHHHHHhhHShq
qhHHHHhSSLhSk
qhHHqhSLhSShk
qhHqSkSSeSSek
qhhqSkSeSSeSk
.qqhkSSSSSSsk
...qkkSSmmsko
.....oksssko.
""", 7, 12, 'headF_effort')

# aiming: cheek down on the stock, near eye on the sight line
HEAD_F_AIM = P("""
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHHHHHHhq
qhHHHHHhhHShq
qhHHHHhSSLhSk
qhHHqhSLhhSSk
qhHqSkSSeSSek
qhhqSkSSSSSSk
.qqhkSSSSSSsk
...qkkSSSmsko
.....oksssko.
""", 7, 12, 'headF_aim')

# ---------------------------------------------------------------- ponytail (anchor: the tie)
PONY_F = {
    'rest': P("""
.qq.
qJHq
qHHq
qhHq
.qhq
.qq.
""", 2, 0, 'pony_rest'),
    'up': P("""
qqq.
qJHq
qHhq
.qhq
.qq.
""", 2, 0, 'pony_up'),
    'down': P("""
.qq.
qJHq
qHHq
qHhq
qhHq
.qhq
..q.
""", 2, 0, 'pony_down'),
    'back': P("""
.qqq
qJHHq
qHhq.
.qq..
""", 3, 0, 'pony_back'),
    'fwd': P("""
.qq.
.qJq
.qHq
.qHq
.qhq
..q.
""", 1, 0, 'pony_fwd'),
}

# ---------------------------------------------------------------- torso (anchor: neck, top centre)
TORSO_F = P("""
...o3122o...
..oV12113uo.
.oWVu1VVVuo.
.oWVVuVVVuo.
.oVVVuVVVuo.
..oVVuVVVuo.
..ouuggguuo.
..oNCCDoDDo.
""", 6, 0, 'torsoF')

# leaning forward over the work (mine, farm): shoulders lower and further right
TORSO_F_LEAN = P("""
....o3122o..
..oVV12113o.
.oWVVu1VVuo.
.oWVVuVVVuo.
.oVVVuVVVuo.
..oVVuVVuo..
..ouuggguo..
..oNCCDDDo..
""", 6, 0, 'torsoF_lean')

# ---------------------------------------------------------------- arms (anchor: shoulder pivot)
# The upper end is plain jacket colour so it merges into the torso's shoulder: no visible socket.
ARM_F = {
    'hang': P("""
.oo.
oWVo
oWVu
oWVu
oVuo
oVuo
oSLo
oSso
.oo.
""", 2, 1, 'arm_hang'),
    # swung forward (walk): hand moves down-right toward the camera
    'fwd': P("""
.oo..
oWVo.
oWVu.
oWVu.
.oVuo
.oVuo
.oSLo
.oSso
..oo.
""", 2, 1, 'arm_fwd'),
    'fwd2': P("""
.oo...
oWVo..
oWVu..
.oWVu.
.oVVuo
..oVuo
..oSLo
..oSso
...oo.
""", 2, 1, 'arm_fwd2'),
    # swung back: hand moves up-left (away)
    'back': P("""
..oo
.oWVo
.oWVu
oWVuo
oVuo.
oVuo.
oSLo.
oSso.
.oo..
""", 3, 1, 'arm_back'),
}

# ---------------------------------------------------------------- legs (anchor: hip, top of thigh)
# One drawing per foot position along the 2:1 walk diagonal. The planted boot moves exactly
# (-2, -1) px per walk frame (k = +2 .. -2), the hip stays on its column and bobs 0/1 px.
# Names: k<pos>[_<variant>]; 'up' = foot in the air. The far leg reuses these, recoloured with FAR.
LEG_F = {
    # standing, foot under the hip (k=0), hip at base height
    'stand': P("""
oCCDo..
oBCDo..
oCCDo..
oCCDo..
ozYZzo.
oZZZZZo
.ooooo.
""", 2, 0, 'leg_stand'),
    # knees softened 1px (hip 1px lower), foot unchanged
    'stand_b': P("""
oCCDo..
oBCDo..
oCCDo..
ozYZzo.
oZZZZZo
.ooooo.
""", 2, 0, 'leg_stand_b'),
    # k=+2 heel strike, hip 1px low: foot (+4,+2)
    'k2': P("""
oCCDo......
.oCCDo.....
.oBCDo.....
..oCCDo....
...oCCDo...
....ozYZzo.
....oZZZZZo
.....ooooo.
""", 2, 0, 'leg_k2'),
    # k=+1 loading, knee soft, hip 1px low: foot (+2,+1)
    'k1': P("""
oCCDo....
oBCDo....
.oCCDo...
.oCCDo...
..ozYZzo.
..oZZZZZo
...ooooo.
""", 2, 0, 'leg_k1'),
    # k=-1, leg behind, hip at base: foot (-2,-1)
    'km1': P("""
..oCCDo
..oBCDo
.oCCDo.
ozYZzo.
oZZZZZo
.ooooo.
""", 4, 0, 'leg_km1'),
    # k=-2 toe-off, heel up, hip 1px low: toe on (-4,-2)
    'km2': P("""
....oCCDo
..ooCDDo.
ozYZZZo..
.ooooo...
""", 6, 0, 'leg_km2'),
    # swing: foot lifted behind, knee bent, toe down (passing back), hip 1px low
    'up_back': P("""
..oCCDo
.oCCDDo
oBCDo..
ozYZo..
oZZZZo.
.oooo..
""", 4, 0, 'leg_up_back'),
    # swing: passing under the body, knee forward, foot 2px up, hip at base
    'up_pass': P("""
oCCDo..
oBCDDo.
.oCCDo.
.ozYZzo
.oZZZZo
..oooo.
""", 2, 0, 'leg_up_pass'),
    # swing: reaching forward, foot 1px up, hip at base, toe up for the heel strike
    'up_reach': P("""
oCCDo....
.oCCDo...
.oBCDo...
..oCCDo..
...ozYZzo
...oZZZZo
....oooo.
""", 2, 0, 'leg_up_reach'),
}

# ---------------------------------------------------------------- arms holding the rifle (F)
# near (right) arm: elbow tucked down, forearm forward to the pistol grip; hand anchor = knuckles
ARM_F.update({
    'aim_n': P("""
.oo.....
oWVo....
oWVu....
oWVu....
oVVuooo.
.oVVVVuo
..oooSLo
.....oso
.....oo.
""", 2, 1, 'arm_aim_n'),
    # far (left) arm: reaches forward to the handguard; hand under the handguard
    'aim_f': P("""
.oo...
oWVo..
oWVuo.
.oWVuo
..oVVuo
...oVuo
...oSLo
...oSso
....oo.
""", 1, 1, 'arm_aim_f'),
    # far arm going to the magazine / vest / charging handle (reload)
    'rl_low': P("""
.oo...
oWVo..
oWVuo.
.oWVuo
..oVVuo
...oVVo
...oLSo
...osso
....oo.
""", 1, 1, 'arm_rl_low'),
    # far hand at the vest pouch on the chest (pulling a fresh magazine)
    'rl_vest': P("""
.oo..
oWVo.
oWVuo
oVVuo
oVuo.
oLSo.
osso.
.oo..
""", 1, 1, 'arm_rl_vest'),
    # far hand up at the charging handle (rear of the receiver, under the cheek)
    'rl_handle': P("""
.oo...
oWVoo.
oWVVuo
.oVVuo
..oLSo
..osso
...oo.
""", 1, 1, 'arm_rl_handle'),
})

# ---------------------------------------------------------------- arms for tools and carrying (F)
# Named by where the hand ends up relative to the shoulder pivot (the part anchor).
ARM_F.update({
    # near hand up by the near shoulder, elbow down and out (wind-up over the right shoulder)
    'n_wind': P("""
.oo..
oLSo.
oSso.
oVuo.
oWVo.
oWVuo
oWVuo
.ooo.
""", 2, 5, 'arm_n_wind'),
    # far arm across the chest, hand in front of the near shoulder (holds the handle end)
    'f_across': P("""
....oo..
..ooWVo.
.oVVVuo.
oLSoVuo.
osso.oo.
.oo.....
""", 6, 1, 'arm_f_across'),
    # near hand in front of the chest, high (overhead swing passing)
    'n_high': P("""
.oo...
oWVoo.
oWVVLo
.oVuSo
.oVoso
..o.o.
""", 2, 1, 'arm_n_high'),
    # far hand meets the near hand in front, chest height
    'f_front': P("""
..oo.
.oWVo
oVVuo
oSLuo
osso.
.oo..
""", 3, 1, 'arm_f_front'),
    # near hand low in front (impact / pulling), arm straight down-right
    'n_low': P("""
.oo....
oWVo...
oWVuo..
.oWVuo.
..oVVuo
...oSLo
...oSso
....oo.
""", 2, 1, 'arm_n_low'),
    # far hand low in front, next to the near hand
    'f_low': P("""
.oo..
oWVo.
oWVuo
.oVuo
.oVuo
.oSLo
.oSso
..oo.
""", 1, 1, 'arm_f_low'),
    # carrying: forearms forward under the crate, elbows bent at the sides
    'n_carry': P("""
.oo...
oWVo..
oWVu..
oWVuoo
.oVVSL
..oosS
....oo
""", 2, 1, 'arm_n_carry'),
    'f_carry': P("""
.oo..
oWVo.
oWVuo
oVVSL
.oosS
...oo
""", 1, 1, 'arm_f_carry'),
    # far hand holding the plate against the target in front (repair)
    'f_hold': P("""
.oo...
oWVo..
oWVuo.
.oWVuo
..oVLo
..oSso
...oo.
""", 1, 1, 'arm_f_hold'),
    # near arm cocked back: elbow up and back, hand by the ear (hammer wind-up)
    'n_cock': P("""
.oo..
oLSo.
oSso.
oVVo.
oWVuo
oWVuo
.ooo.
""", 2, 4, 'arm_n_cock'),
    # near arm swung forward to the target (hammer impact): forearm out front, chest height
    'n_strike': P("""
.oo....
oWVoo..
oWVVVoo
.oVVuLo
..ooSso
....oo.
""", 2, 1, 'arm_n_strike'),
})

# =============================================================================================== B
# Back three-quarter view, facing up-left. The near side is the character's LEFT (screen left);
# the left ear and a sliver of cheek show at the left edge; the ponytail hangs over the back.
HEAD_B = P("""
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHJHHHHhq
qhHHHJHHHHhhq
qhHHHHHHHHHhq
qhhHHHHHHHhhq
kShhHHHhhHhhq
kSkhhHhqqhhq.
.kkqhhhqHqq..
..qqqqqqqq...
.............
""", 7, 12, 'headB')

# looking down (reload, work)
HEAD_B_DOWN = P("""
.............
.....qqqqq...
...qqHJJHHqq.
..qHJJjJHHHHq
.qHJJHHHHHHHq
.qHJHHHHHHHhq
qhHHHHHHHHhhq
qhhHHHHHHhHhq
qhhhHHHHHHhhq
kShhhHHHHhhq.
kkkqhhhhhhq..
..qqqqqqqq...
.............
""", 7, 12, 'headB_down')

# ponytail from behind: tied at the back of the head, hangs over the nape (drawn in front)
PONY_B = {
    'rest': P("""
.qq.
qJHq
qHHq
qHhq
qhHq
.qhq
..q.
""", 1, 0, 'ponyB_rest'),
    'up': P("""
.qq.
qJHq
qHhq
qhHq
.qq.
""", 1, 0, 'ponyB_up'),
    'down': P("""
.qq.
qJHq
qHHq
qHHq
qHhq
qhHq
.qhq
..q.
""", 1, 0, 'ponyB_down'),
    'left': P("""
..qq
.qJHq
qHHq.
qHhq.
qhq..
.q...
""", 2, 0, 'ponyB_left'),
    'right': P("""
qq..
qJHq
.qHHq
.qhHq
..qhq
...q.
""", 1, 0, 'ponyB_right'),
}

TORSO_B = P("""
...o3122o...
..oV31123Vo.
.oWVVVVVVVuo
.oWVVVVuVVuo
.oVVVVVuVVuo
..oVVVVuVuo.
..ouuuuuuuo.
..oCCCCDDDo.
""", 6, 0, 'torsoB')

TORSO_B_LEAN = P("""
............
...o3122o...
.oVV31123Vo.
.oWVVVVVVuuo
.oWVVVVuVVuo
..oVVVVuVuo.
..ouuuuuuuo.
..oCCCCDDDo.
""", 6, 0, 'torsoB_lean')

# legs from behind: boots point up-left (toe at the left end), heels toward the camera.
# Walking up-left the planted boot moves (+2, +1) px per frame.
LEG_B = {
    'stand': P("""
..oCCDo
..oBCDo
..oCCDo
..oCCDo
.ozYZzo
oZZZZZo
.ooooo.
""", 4, 0, 'legB_stand'),
    'stand_b': P("""
..oCCDo
..oBCDo
..oCCDo
.ozYZzo
oZZZZZo
.ooooo.
""", 4, 0, 'legB_stand_b'),
    # k=+2: front foot up-left (-4,-2), heel strike, hip 1px low -> a short leg on screen
    'k2': P("""
......oCCDo
..ozYZBCDo.
.oZZZZZDo..
.ooooo.....
""", 8, 0, 'legB_k2'),
    # k=+1: (-2,-1), hip 1px low
    'k1': P("""
....oCCDo
...oBCDo.
..ozYZzo.
.oZZZZZo.
.ooooo...
""", 6, 0, 'legB_k1'),
    # k=-1: behind (+2,+1), hip at base -> a longer leg on screen
    'km1': P("""
oCCDo..
oBCDo..
.oCCDo.
.oCCDo.
.oCCDo.
.ozYZzo
oZZZZZo
.ooooo.
""", 2, 0, 'legB_km1'),
    # k=-2: toe-off behind (+4,+2), heel up toward the camera, hip 1px low
    'km2': P("""
oCCDo....
oBCDo....
.oCCDo...
..oCCDo..
...oCCDo.
...ozYZzo
...oZZZZo
...oooo..
""", 2, 0, 'legB_km2'),
    # swing: lifted behind (toward the camera), knee bent, sole showing
    'up_back': P("""
oCCDo..
oBCDo..
.oCCDo.
.ozYZzo
.oZZZZo
..oooo.
""", 2, 0, 'legB_up_back'),
    # swing: passing under, foot 2px up
    'up_pass': P("""
..oCCDo
..oBCDo
.ozYZzo
oZZZZZo
.ooooo.
""", 4, 0, 'legB_up_pass'),
    # swing: reaching up-left for the next step, 1px up
    'up_reach': P("""
.....oCCDo
....oBCDo.
...oCCDo..
.ozYZZo...
oZZZZZo...
.ooooo....
""", 7, 0, 'legB_up_reach'),
}

# ---------------------------------------------------------------- B arms
ARM_B = {
    'hang': ARM_F['hang'],
    'fwd': ARM_F['back'],           # forward in B = hand up-left, away from the camera
    'back': ARM_F['fwd'],           # back in B = hand down-right, toward the camera
    # near (left) arm reaching up-left to the handguard, seen from behind
    'aim_n': P("""
.oo...
oLSo..
osVVo.
.oWVo.
.oWVVo
..oWVo
..oWVo
...oo.
""", 4, 5, 'armB_aim_n'),
    # far (right) arm on the pistol grip: only the elbow shows, out to the right
    'aim_f': P("""
oo...
oVVo.
oVVuo
.oVuo
..oo.
""", 1, 1, 'armB_aim_f'),
    # near arm dropping to the magazine / vest (reload), hand low at the left
    'rl_low': P("""
.oo..
oWVo.
oWVuo
oVVuo
.oVuo
.oLSo
.osso
..oo.
""", 2, 1, 'armB_rl_low'),
    # near arm bent forward (hand in front of the chest, hidden): only upper arm + elbow show
    'rl_in': P("""
.oo..
oWVo.
oWVuo
.oVuo
..oo.
""", 2, 1, 'armB_rl_in'),
    # tools: far (right, dominant) hand up by the right ear, elbow down
    'f_wind': P("""
.oo..
oLSo.
oSso.
oVuo.
oVVuo
oVVuo
.ooo.
""", 2, 5, 'armB_f_wind'),
    # near arm across the chest toward the right shoulder: only the shoulder and elbow show
    'n_across': P("""
.oo...
oWVoo.
oWVVVo
.oooo.
""", 2, 1, 'armB_n_across'),
    # arms forward and up (overhead swing passing in front of the face, away from us)
    'n_up': P("""
.oo.
oLSo
oWVo
oWVo
oWVo
.oo.
""", 2, 4, 'armB_n_up'),
    'f_up': P("""
.oo.
oLSo
oVVo
oVuo
oVuo
.oo.
""", 1, 4, 'armB_f_up'),
    # arms forward and down (impact in front, hands hidden by the body)
    'n_fwd': P("""
.oo.
oWVo
oWVuo
.oVuo
.oVo.
.oo..
""", 2, 1, 'armB_n_fwd'),
    # near arm swinging a hammer: cocked by the left... (dominant right arm is the far one)
    'f_strike': P("""
oo...
oVVo.
oVVuo
.oSso
..oo.
""", 1, 1, 'armB_f_strike'),
    # ladder: hand up on the rail (near / far), and hand at shoulder height
    'n_rail_hi': P("""
.oo.
oLSo
oSso
oWVo
oWVo
oWVo
oWVo
.oo.
""", 2, 6, 'armB_n_rail_hi'),
    'n_rail_lo': P("""
.oo.
oWVo
oWVo
oLSo
osso
.oo.
""", 2, 1, 'armB_n_rail_lo'),
    # carrying: forearms forward under the crate (hidden), elbows out at the sides
    'n_carry': P("""
.oo..
oWVo.
oWVuo
.oVVo
..oo.
""", 2, 1, 'armB_n_carry'),
}

# ladder climbing legs (B): foot up on a higher rung (knee bent) / leg straight on a low rung
LEG_B.update({
    'climb_hi': P("""
..oCCDo
.oBCCDo
.oCCDDo
.ozYZzo
.oZZZZo
..oooo.
""", 4, 0, 'legB_climb_hi'),
    'climb_mid': P("""
..oCCDo
..oBCDo
..oCCDo
.oCCDDo
.ozYZzo
.oZZZZo
..oooo.
""", 4, 0, 'legB_climb_mid'),
    'climb_lo': P("""
..oCCDo
..oBCDo
..oCCDo
..oCCDo
..oCCDo
.ozYZzo
.oZZZZo
..oooo.
""", 4, 0, 'legB_climb_lo'),
})
ARM_B.update({
    'f_rail_hi': P("""
.oo.
oSSo
oSso
oVVo
oVVo
oVuo
oVuo
.oo.
""", 1, 6, 'armB_f_rail_hi'),
    'f_rail_lo': P("""
.oo.
oVVo
oVuo
oSso
osso
.oo.
""", 1, 1, 'armB_f_rail_lo'),
})

# the ladder the climb is drawn against (prop for the check sheet and the viewer):
# rails a shoulder-width apart; rungs run along the wall, so they slope 2:1 (right end higher)
LADDER_B = P("""
.oo.......oo.
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.oGo...oooGno
.oGo.oonnnGno
.oGooonn..Gno
.oGnnn....oGo
.oGoo.....oGo
.oGo......oGo
.ooo......ooo
""", 6, 44, 'ladderB')
