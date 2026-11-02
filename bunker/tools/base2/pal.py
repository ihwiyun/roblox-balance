"""Resurrect 64 (bunker/art/resurrect-64.hex) with names for the colours the base art uses.

Every pixel the base tools write is an index into this list; nothing outside it can be painted.
"""
import os

HEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art', 'resurrect-64.hex')
COLORS = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in open(HEX).read().split()]
assert len(COLORS) == 64, len(COLORS)
CLEAR = 255          # index for "no pixel"

# names -> palette index (order of the .hex file)
N = dict(
    ink=0, slate=1, stone=2, rose=3, beige=4, mauve=5, lilac=6, mist=7, foam=8, white=9,
    blood=10, red=11, vermil=12, orange=13, crimson=14, scarlet=15, flame=16, amber=17, gold=18,
    plum=19, rust=20, copper=21, tan=22, sand=23,
    soil=24, olive=25, moss=26, lime=27, cream=28,
    pine=29, leaf=30, mint=31, sprout=32, pale=33,
    char=34, fern=35, sage=36, celadon=37, khaki=38,
    abyss=39, teal=40, aqua=41, surf=42, ice=43,
    navy=44, indigo=45, blue=46, sky=47, cyan=48,
    grape=49, purple=50, violet=51, lilac2=52, orchid=53,
    wine=54, berry=55, rosy=56, pink=57,
    magenta=58, cerise=59, hotpink=60, salmon=61, peach=62, blush=63,
)


def c(name):
    return N[name]


def rgb(i):
    return COLORS[i]


# one step darker / lighter inside each hue family (hand-picked, hue-shifted the way a pixel artist
# ramps: darks drift toward purple, lights toward yellow). Used for cast shadows and selective outlines.
_RAMPS = [
    'white foam mist lilac stone slate ink',
    'khaki beige rose mauve grape ink',
    'blush peach salmon rosy berry wine grape ink',
    'cream sand tan copper rust plum grape ink',
    'gold amber flame vermil red blood plum grape',
    'orange copper',
    'pink rosy',
    'pale sprout mint leaf pine abyss navy ink',
    'lime moss olive soil grape ink',
    'celadon sage fern char ink',
    'ice surf aqua teal abyss navy ink',
    'cyan sky blue indigo navy ink',
    'orchid lilac2 violet purple grape ink',
    'hotpink cerise magenta wine grape ink',
    'scarlet crimson blood plum grape ink',
]
DARK, LIGHT = {}, {}
for _r in _RAMPS:
    _ids = [N[w] for w in _r.split()]
    for _a, _b in zip(_ids, _ids[1:]):
        DARK.setdefault(_a, _b)
        LIGHT.setdefault(_b, _a)
DARK.setdefault(N['ink'], N['ink'])


def dark(i, steps=1):
    for _ in range(steps):
        i = DARK.get(i, i)
    return i
