"""Hand-drawn props held or used by the survivor: pickaxe, hoe, hammer (several hand-drawn angles
each, with smear versions), supply crate, ladder, bed, rock, steel plate.

Each tool sprite marks where the two hands go:
  h1 = dominant (right) hand, the one nearer the tool head;  h2 = the other hand (left), nearer the end.
The sprite anchor is h1, so a tool lands exactly in the dominant hand of the pose that holds it.
"""
from core import K, Part

PT = K({'o': 'ink', 'w': 'rust', 'W': 'copper', 'f': 'tan', 'y': 'night', 'n': 'dusk', 'i': 'lilac',
        'G': 'steel', 'I': 'mist', 'Q': 'white', 'u': 'mud', 'v': 'olive', 'V': 'moss',
        'r': 'rosewood', 't': 'khaki', 'T': 'bone', 'p': 'plum', 'x': 'oxblood', 'c': 'coal',
        's': 'slate', 'S': 'sage', 'e': 'fern', 'b': 'brick', 'B': 'vermil', 'g': 'grape',
        'N': 'navy', 'D': 'indigo', 'C': 'blue', 'A': 'sky', 'k': 'cream2', 'K': 'peach',
        'O': 'amber', 'M': 'gold', 'l': 'cream', 'h': 'apricot'})


def T(text, h1, h2=None, name='', extra=None):
    p = Part(text, PT, h1[0], h1[1], name)
    p.pts = dict(h1=list(h1), h2=list(h2) if h2 else None, **(extra or {}))
    return p


# ---------------------------------------------------------------- pickaxe (F): handle ~10px
PICK_F = {
    # wind-up: raised over the right shoulder; head up-left behind the hair, handle down-right to the hands
    'raise': T("""
...oo.......
..oGIo......
.oyGo.......
.oGnooo.....
oInoWWwo....
oGo..oWwo...
.o....oWwo..
.......oWwo.
........oWwo
.........ooo
""", (9, 7), (10, 8), 'pick_raise', dict(tip=(3, 0))),
    # top of the swing: handle up from the hands in front of the chin, head over the crown
    'over': T("""
.....oooo..
...ooGIIGo.
..oyGnnnyo.
...oooWoo..
.....oWwo..
.....oWwo..
......oWo..
......ooo..
""", (6, 6), (6, 7), 'pick_over', dict(tip=(8, 1))),
    # impact: hands low in front, handle nearly level, front tip down into the rock
    'hit': T("""
oo.........
oWwoo......
.ooWwwoo.o.
...ooWwwoGo
.....oonGIo
.......oGno
.......oGyo
........oIo
........oo.
""", (2, 1), (0, 1), 'pick_hit', dict(tip=(8, 7))),
    # recovery: pulled free, head lifted a little, handle rising
    'lift': T("""
oo........
oWwo...oo.
.oWwo.oIGo
..oWwooGno
...oWwnyo.
....ooGyo.
.....oIo..
.....oo...
""", (2, 2), (1, 1), 'pick_lift', dict(tip=(6, 6))),
}
# smear: the downswing. Hands at the chest, the head already out in front of the right shoulder;
# a light-steel arc (no outline) traces where the head came from, over the crown.
PICK_F['smear'] = T("""
..IIII.......
.I....II.....
I.......I....
.........IoIo
.........oIGo
.......ooGnyo
......oWwooo.
.....oWwo....
....oWwo.....
...oWwo......
...ooo.......
""", (4, 9), (3, 10), 'pick_smear', dict(tip=(11, 3)))

# ---------------------------------------------------------------- hoe (F): handle ~11px, flat blade
HOE_F = {
    'ready': T("""
oo........
oWo.......
oWwo......
.oWwo.....
..oWwo....
...oWwo...
....oWwo..
.....oWoo.
.....oGGno
.....onyo.
......oo..
""", (2, 2), (0, 0), 'hoe_ready', dict(tip=(7, 9))),
    'raise': T("""
...oo....
..oGno...
..oIyo...
..oGoWo..
...o.oWo.
......oWo
.......oo
""", (6, 4), (7, 5), 'hoe_raise', dict(tip=(3, 2))),
    'hit': T("""
oo.........
oWo........
oWwo.......
.oWwo......
..oWwo.....
...oWwo....
....oWwoo..
.....ooGGno
.....oIGnyo
......ooooo
""", (2, 2), (1, 1), 'hoe_hit', dict(tip=(8, 8))),
    'pull': T("""
ooo.........
oWwoo.......
.ooWwoo.....
...ooWwoo...
.....ooWwoo.
.......oGGno
.......oIGyo
........ooo.
""", (4, 2), (1, 1), 'hoe_pull', dict(tip=(9, 6))),
}
HOE_F['smear'] = T("""
..ooo......
.oWwwoo....
.oWwwWwo...
..ooooWwo..
......oWwo.
.....IIoGno
.....IIIIyo
......IIoo.
""", (3, 2), (2, 1), 'hoe_smear', dict(tip=(8, 6)))

# ---------------------------------------------------------------- claw hammer (F), one hand
HAMMER_F = {
    'up': T("""
.ooo.
oGnyo
oIGno
.oWo.
.oWo.
.oWo.
.oo..
""", (2, 5), None, 'hammer_up', dict(tip=(2, 0))),
    'hit': T("""
oo.....
oWo....
.oWo...
..oWoo.
..oWGno
..oInyo
...ooo.
""", (1, 1), None, 'hammer_hit', dict(tip=(4, 5))),
    'back': T("""
oo....
oGoo..
oInyo.
.oyWo.
..oWo.
...oWo
....oo
""", (4, 5), None, 'hammer_back', dict(tip=(1, 1))),
}
HAMMER_F['smear'] = T("""
....III.
..IIGGno
....oyyo
...oWoo.
..oWo...
.oWo....
.oo.....
""", (1, 5), None, 'hammer_smear', dict(tip=(6, 1)))

# a steel patch plate held against the fence by the far hand (repair target), rivet heads
PLATE = Part("""
oooooo
oIGGGo
oGGnGo
oGnnno
oyGnyo
oooooo
""", PT, 0, 0, 'plate')

# ---------------------------------------------------------------- supply crate (carried)
CRATE = Part("""
....oooooo....
..ooTttTTtoo..
ooTTtrrtttTToo
otooTTttTToorr
otrroooooorrro
otrrttrrrtrrro
otTTtrrtrrtTro
otrrtrrtrrtrro
otrrrrrtrrrrro
oorrrrrtrrrroo
..ooorrtrrooo.
.....ooooo....
""", PT, 7, 11, 'crate')

# ---------------------------------------------------------------- rock (mining target, check sheet)
ROCK = Part("""
....oooo....
..ooiiGnoo..
.oiiGnnnyyo.
oiGGnnnnnyyo
oGnnnnyynnyo
onnnnyyyyyyo
.oyyyyyyyyo.
..oooooooo..
""", PT, 6, 7, 'rock')
