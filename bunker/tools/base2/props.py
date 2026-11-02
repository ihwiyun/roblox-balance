"""Hand-typed sprites for the base sample (screen space unless noted). Letters are tones or colours;
'.' is empty. Each sprite lists its anchor: the pixel that sits on its world point (usually the
bottom-centre contact with the ground or roof)."""
from canvas import grid
from pal import N

# common colour legend for props; individual sprites may add their own letters
P = dict(
    o=N['ink'], O=N['slate'],
    w=N['plum'], W=N['rust'], x=N['copper'], X=N['tan'], y=N['sand'],          # wood dark..light
    s=N['slate'], S=N['stone'], m=N['lilac'], M=N['mist'], f=N['foam'], F=N['white'],  # steel
    q=N['blood'], r=N['rust'], R=N['copper'], t=N['tan'],                      # rust
    b=N['mauve'], B=N['rose'], k=N['beige'], K=N['khaki'],                      # burlap
    g=N['pine'], G=N['leaf'], h=N['mint'], H=N['sprout'],                       # greens
    e=N['red'], E=N['vermil'], a=N['amber'], A=N['gold'], c=N['cream'],         # red, lamp light
    n=N['navy'], i=N['indigo'], I=N['blue'], j=N['sky'],                        # tarp blues
    d=N['grape'], D=N['char'],
)


def spr(rows, extra=None):
    leg = dict(P)
    if extra:
        leg.update(extra)
    return grid(rows, leg)


# ---------------------------------------------------------------------------- ladder (leans on a
# left-type wall: rails stand upright, rungs follow the 2-1 slope). anchor = bottom of the left rail
LADDER = spr([
    "Xw.....",
    "XwXw...",
    "Xw..Xw.",
    "XxxXwXw",
    "Xw..xxw",
    "Xw...Xw",
    "XwXx.Xw",
    "Xw.xxXw",
    "Xw...Xw",
    "Xw...Xw",
    "XxXx.Xw",
    "Xw.xxXw",
    "Xw...Xw",
    "Xw...Xw",
    "XxXx.Xw",
    "Xw.xxXw",
    "Xw...Xw",
    "Xw...Xw",
    "XxXx.Xw",
    "Xw.xxXw",
    "ow...Xw",
    ".....ow",
])
LADDER_ANCHOR = (0, 20)

# ---------------------------------------------------------------------------- wooden crate (iso box,
# 6x6 steps footprint, 7 px tall). anchor = bottom corner
CRATE = spr([
    ".......oo.......",
    ".....ooXXoo.....",
    "...ooXXyXXXoo...",
    ".ooXXXXXXyXXXoo.",
    "oxXXyXXXXXXXXXWo",
    "oxxxXXXXXXXXWWWo",
    "oxwxxxXXXXWWwWwo",
    "oxxwxxxXXWwWwWwo",
    "oxxxwxxxWwWwWWwo",
    "oxxxxwxxWWwWWWwo",
    "oxxxxxwxWWWwWWwo",
    "oxwxxxxxWwWWwWwo",
    "ooxxwxxxWWwWwWoo",
    "..ooxxwxWwWwoo..",
    "....ooxxWWoo....",
    "......ooo o.....".replace(' ', 'o'),
])
CRATE_ANCHOR = (7, 15)

# a smaller crate (4x4 steps)
CRATE_S = spr([
    ".....oo.....",
    "...ooXXoo...",
    ".ooXyXXXXoo.",
    "oxXXXXXXXXWo",
    "oxxXXXXXXWWo",
    "oxwxXXXXWwWo",
    "oxxwxXXWwWwo",
    "oxxxwxXWWwWo",
    "ooxxxwxWwWoo",
    "..ooxxxWWo..",
    "....ooxWo...",
    "......oo....",
])
CRATE_S_ANCHOR = (6, 11)

# ---------------------------------------------------------------------------- oil drum, rusty
DRUM = spr([
    "..oooooo..",
    ".oSmMmmSo.",
    "oSmMffMmSo",
    "osSmmmmSSo",
    "oSMmmmSSso",
    "oSmmmrSSso",
    "oMmmmRrSso",
    "ossssqrsso",
    "oSmmmrqSso",
    "oSMmmmSSso",
    "oSmmmmSSso",
    "ossssssss o".replace(' ', ''),
    ".oSmmmSSo.",
    "..oooooo..",
])
DRUM_ANCHOR = (5, 13)

# red drum (fuel)
DRUM_RED = spr([
    "..oooooo..",
    ".oqeEEeqo.",
    "oqeEaaEeqo",
    "oqqeeeeqqo",
    "oqEeeeqqdo",
    "oqeeeeqqdo",
    "oEeeeeqqdo",
    "oddddddddo",
    "oqeeeeqqdo",
    "oqEeeeqqdo",
    "oqeeeeqqdo",
    "oddddddddo",
    ".oqeeeqqo.",
    "..oooooo..",
])

# ---------------------------------------------------------------------------- jerry can
JERRY = spr([
    ".ooo...",
    "oSso...",
    "oeEEeo.",
    "oEeeeqo",
    "oeEeeqo",
    "oeeeqqo",
    "oeEeeqo",
    "oeeeqqo",
    ".ooooo.",
])
JERRY_ANCHOR = (3, 8)

# ---------------------------------------------------------------------------- tyre lying flat
TIRE = spr([
    "...oooooo...",
    ".ooSSSSSSoo.",
    "oSSoooooosSo",
    "oSo......oso",
    "oSSoooooossO",
    ".oossssssoo.",
    "...oooooo...",
])
TIRE_ANCHOR = (6, 6)

# ---------------------------------------------------------------------------- sandbag lying on a roof
# (top view, pillow). anchor = centre bottom
BAG_TOP = spr([
    "..oooooo..",
    ".oKKffKKo.",
    "oKffKKKkko",
    "okKKkkkkBo",
    ".oBBBBBbo.",
    "..oooooo..",
])
BAG_TOP_ANCHOR = (5, 5)

# ---------------------------------------------------------------------------- campfire with stones
CAMPFIRE = spr([
    "....a.....",
    "...aAa....",
    "...aAca...",
    "..aAccAa..",
    "..eaAAae..",
    ".MSwxXwSm.",
    "oSMmwWsMSo",
    ".ooSooSoo.",
])
CAMPFIRE_ANCHOR = (5, 7)

# ---------------------------------------------------------------------------- stake (fence lv1),
# 2 px wide, pointed. anchor = bottom
STAKE = spr([
    ".X",
    "XW",
    "Xw",
    "xw",
    "xw",
    "xw",
    "Xw",
    "xw",
    "ow",
])
STAKE_ANCHOR = (0, 8)

# ---------------------------------------------------------------------------- bushes, rocks, stump
BUSH = spr([
    "....oooo....",
    "..ooHhhGoo..",
    ".oHhhhGGGgo.",
    "oHhhGhGGGGgo",
    "ohhGGGGGGggo",
    ".oGGGGGgggo.",
    "..oogggggo..",
    "....oooo....",
], {'o': N['abyss']})
BUSH_ANCHOR = (6, 7)

BUSH_S = spr([
    "..ooo..",
    ".oHhGo.",
    "ohhGGgo",
    "oGGGggo",
    ".ooooo.",
], {'o': N['abyss']})
BUSH_S_ANCHOR = (3, 4)

ROCK = spr([
    "...oooo...",
    "..oMMmmo..",
    ".oMMmmmSo.",
    "oMmmmmSSso",
    "oSmmmSSsso",
    ".ossssssoo",
    "..oooooo..",
])
ROCK_ANCHOR = (5, 6)

ROCK_S = spr([
    ".ooo.",
    "oMmSo",
    "omSso",
    ".ooo.",
])
ROCK_S_ANCHOR = (2, 3)

STUMP = spr([
    ".oooooo.",
    "oXyyyXwo",
    "oxXwwXwo",
    ".oxXXxo.",
    ".oxxWwo.",
    ".oxxWwo.",
    "ooxxwwoo",
    ".oooooo.",
])
STUMP_ANCHOR = (4, 7)

BONES = spr([
    "f.f...",
    ".fff..",
    "f.f.f.",
    "....ff",
])
BONES_ANCHOR = (3, 3)
