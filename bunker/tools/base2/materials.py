"""Hand-drawn materials for the base: every texture below is typed in by hand, pixel by pixel.

Textures are written in TONES ('1' darkest .. '5' lightest, plus a few named letters) so one drawing
serves the lit left wall and the shaded right wall: a ramp turns tones into palette colours.
Face-space textures are drawn flat (u across, v down); the canvas shears them onto the 2-1 walls.
Light comes from the top-left: tops brightest, left walls lit, right walls in shade.
"""
import numpy as np

from canvas import grid
from pal import CLEAR, N


def ramp(**kw):
    return {k: N[v] for k, v in kw.items()}


def tex(rows, rmp):
    return grid(rows, rmp)


# ============================================================================ ramps
# grass on the island top
G = ramp(D='pine', B='leaf', M='mint', L='sprout', T='pale', Y='moss', O='olive', K='abyss',
         w='cream', p='salmon', f='white', r='rose')

# soil cliff under the island: same drawing, two ramps
SOIL_LIT = ramp(o='ink', k='grape', **{'1': 'plum', '2': 'rust', '3': 'copper', '4': 'tan'},
                a='stone', b='lilac', c='mist', g='pine', G='leaf', h='mint', R='olive', x='soil')
SOIL_DARK = ramp(o='ink', k='ink', **{'1': 'grape', '2': 'plum', '3': 'rust', '4': 'copper'},
                 a='slate', b='stone', c='lilac', g='abyss', G='pine', h='leaf', R='soil', x='grape')

# burlap sandbags
BAG_LIT = ramp(o='grape', **{'1': 'mauve', '2': 'rose', '3': 'beige', '4': 'khaki', '5': 'foam'}, t='plum', s='sand')
BAG_DARK = ramp(o='ink', **{'1': 'grape', '2': 'mauve', '3': 'rose', '4': 'beige', '5': 'khaki'}, t='grape', s='tan')
BAG_TOP = ramp(o='grape', **{'1': 'mauve', '2': 'rose', '3': 'beige', '4': 'khaki', '5': 'foam'}, t='plum', s='sand')

# wood
WOOD_TOP = ramp(g='grape', **{'1': 'plum', '2': 'rust', '3': 'copper', '4': 'tan', '5': 'sand'}, n='slate', m='mist')
WOOD_LIT = ramp(g='grape', **{'1': 'plum', '2': 'rust', '3': 'copper', '4': 'tan', '5': 'sand'}, n='slate', m='mist')
WOOD_DARK = ramp(g='ink', **{'1': 'grape', '2': 'plum', '3': 'rust', '4': 'copper', '5': 'tan'}, n='ink', m='lilac')

# corrugated iron with rust
IRON_LIT = ramp(o='ink', **{'1': 'slate', '2': 'stone', '3': 'lilac', '4': 'mist', '5': 'foam'},
                q='blood', r='rust', s='copper', t='orange', h='grape')
IRON_DARK = ramp(o='ink', **{'1': 'ink', '2': 'slate', '3': 'stone', '4': 'lilac', '5': 'mist'},
                 q='grape', r='blood', s='rust', t='copper', h='ink')

# rubble stone
STONE_LIT = ramp(m='slate', **{'1': 'stone', '2': 'lilac', '3': 'mist', '4': 'foam'}, o='ink', v='fern', V='sage')
STONE_DARK = ramp(m='ink', **{'1': 'slate', '2': 'stone', '3': 'lilac', '4': 'mist'}, o='ink', v='char', V='fern')

# blue tarp
TARP = ramp(o='ink', **{'1': 'navy', '2': 'indigo', '3': 'blue', '4': 'sky', '5': 'cyan'}, r='beige', R='rose')


# ============================================================================ grass decals
# B base, D shade, M mid-light, L light tip, T pale tip, Y dry, w/p/f flowers
TUFTS = [grid(r, G) for r in (
    ["L.L",
     "MLD",
     ".D."],
    [".L..L",
     "LMLMD",
     ".DMD.",
     "..D.."],
    ["..L..",
     ".LML.",
     "LMDMD",
     ".D.D."],
    ["T....",
     "ML.L.",
     ".MLMD",
     "..DD."],
    [".L.L.L.",
     "LMLMLMD",
     ".DMDMD.",
     "..D.D.."],
    ["Y.Y",
     "YOY",
     ".O."],
    ["..Y..",
     "Y.YY.",
     "OYOYO",
     ".O.O."],
)]

FLOWERS = [grid(r, G) for r in (
    ["w.",
     "Dw"],
    [".f.",
     "fDf",
     ".D."],
    ["p..",
     "D.p",
     "..D"],
)]

# darker and lighter grass clusters (2-1 flattened, clean edges)
PATCH_DARK = [grid(r, G) for r in (
    ["....DDDD........",
     "..DDDDDDDDDD....",
     "DDDDDDDDDDDDDDD.",
     ".DDDDDDDDDDDDDDD",
     "...DDDDDDDDDD...",
     "......DDDD......"],
    ["...DDD....",
     ".DDDDDDDD.",
     "DDDDDDDDDD",
     "..DDDDDD..",
     "....DD...."],
    [".....DDDDDD.........",
     "..DDDDDDDDDDDDD.....",
     "DDDDDDDDDDDDDDDDDD..",
     ".DDDDDDDDDDDDDDDDDDD",
     "....DDDDDDDDDDDDDD..",
     "........DDDDDD......"],
)]
PATCH_LIGHT = [grid(r, G) for r in (
    ["...MMMM.....",
     ".MMMMMMMMM..",
     "MMMMMMMMMMMM",
     "..MMMMMMMM..",
     ".....MM....."],
    ["....MMMMM.......",
     ".MMMMMMMMMMMM...",
     "MMMMMMMMMMMMMMMM",
     "..MMMMMMMMMMMM..",
     "......MMMM......"],
)]

# ============================================================================ island cliff
# face-space tiles 25 x 18: grass lip with hanging blades, light topsoil, stones, a wavy darker
# stratum, roots, and a ragged underside closed by an outline (o). '.' is empty (air).
SKIRT = [
    ["GGGhGGGGGGGGhGGGGGGGGhGGG",
     "GgGGGGgGGGGGGGGgGGGGGGgGG",
     "g3gg3g33g3gg3g3g33gg3g33g",
     "3333g233333333323g3333233",
     "2232222222322222222232222",
     "222222abc2222222222222222",
     "22222abbcc222222222abc222",
     "222222aab2221R22222aab222",
     "2222221111111R11222222211",
     "1111111x111111111111111x1",
     "111x1111111111111x1111111",
     "1111111R1111111111111x111",
     "k11111kk1111111k111111kk1",
     "okkk1kook1111kkokk1kkkoko",
     ".oookko.okkkkko.okkko.oo.",
     "...oo....okkko...ooo.....",
     "..........ooo............",
     "........................."],
    ["GGhGGGGGGGhGGGGGGGGhGGGGG",
     "GGGGgGGGGGGGGgGGGGGGGgGGG",
     "gg3gg3gg3g3gg3gg3gg3gg33g",
     "3g323333g33233333g3323333",
     "2222222222222222222222222",
     "2222222232222222222abb222",
     "222abc222222222222abbcb22",
     "22abbcb222R22222222aabb12",
     "222aab2222R222111111111112"[:25],
     "1111111111111111111111111",
     "111x11111111111111111x111",
     "11111111111x1111111111111",
     "11kkk1111111kk111111kkk11",
     "kkoookkk11kkookk11kkooook",
     "oo...okkkkkko..okkkko....",
     ".......ookkoo...ookko....",
     ".........oo.......oo.....",
     "........................."],
    ["GGGGhGGGGGGGGGhGGGGGGGhGG",
     "GgGGGGGGgGGGGGGGGGgGGGGGG",
     "g3gg3gg3gg3g3gg3gg3gg3gg3",
     "333g2333g33323333g3333g33",
     "2222222222222222222222222",
     "2222222222222222222222222",
     "2222222abbb22222222222222",
     "222222abbcbb2222222R22222",
     "1122222aabbb1222222R11112",
     "1111111111111111111111111",
     "11111x11111111111111x1111",
     "111111111111x111111111111",
     "kkk1111kk11111111kk1111kk",
     "ookkk11kkookk11kkkkokkkoo",
     "..ookkkkoo.okkkkkoo.oooo.",
     "....okkko...ookkko.......",
     ".....ooo......ooo........",
     "........................."],
]

# ============================================================================ sandbags
# one bag in face space, 12 x 4, course pitch 4; o = crevice, t = tie, s = spilled sand
BAGS = [
    ["o44555555443",
     "433333333332",
     "333333333322",
     "o22222222211"],
    ["o4455554443o",
     "43333333332t",
     "33333333322t",
     "o22222222211"],
    ["o44455544443",
     "433323333332",
     "33333333s322",
     "o222222s2211"],
]
BAG_W = 12

# the top of a bag course seen from above (a lumpy strip), drawn along the wall, 3 rows deep
BAG_TOPS = [
    [".o44445444o.",
     "o4555555544o",
     ".o33333333o."],
    [".o4445544o..",
     "o455555554o.",
     ".o3333333o.."],
]

# ============================================================================ planks
# a plank strip: 3 wood rows + 1 gap row (g); n nail, 1/2 grain and knots; drawn long, cut to fit
PLANKS = [
    ["4433333333133333333333333333333333433333333333333n33",
     "3332222223322222222122222222222223322222222222222222",
     "2222222222222221122222222222222222222222212222222222",
     "gggggggggggggggggggggggggggggggggggggggggggggggggggg"],
    ["n3333333333334333333333333333133333333333333333333n3",
     "3222222222222233222222221222222222222222232222222222",
     "2222222111222222222222222222222222222122222222222222",
     "gggggggggggggggggggggggggggggggggggggggggggggggggggg"],
    ["4333333333333333333333413333333333333333333333333334",
     "3322222222222222222222222222222222222211222222222233",
     "2222222222222222221122222222222222222222222222222222",
     "gggggggggggggggggggggggggggggggggggggggggggggggggggg"],
    ["3333n33333333333334333333333333333333333n33333333333",
     "2222222222222221222222222233222222222222222222222122",
     "2222122222222222222222222222222222222212222222222222",
     "gggggggggggggggggggggggggggggggggggggggggggggggggggg"],
]

# ============================================================================ rusted corrugated iron
# 16 x 12 tile; ridges every 4 px (5 crest, 4 flank, 3 face, 2 trough); rust q/r/s/t; h hole; 1 bolt shade
IRON = [
    "5432543254325432",
    "543254325432543r",
    "5432543r54325rrs",
    "5432tsrr5432srqr",
    "543tsrqrr432rqrq",
    "54tsrqqr543trrq2",
    "543srqhr5432rq32",
    "5432srr25432r432",
    "5432s4325432r432",
    "54325432543q5432",
    "5432543254325432",
    "1111111111111111",
]
IRON_B = [
    "5432543254325432",
    "5432543254325432",
    "54325432543t5432",
    "5432543254tsr432",
    "5432s43254srqr32",
    "543tsr325trqhr32",
    "54tsrqr25srqrq32",
    "543rqrr254rqr432",
    "5432rq3254r43432",
    "54325q3254325432",
    "5432543254325432",
    "1111111111111111",
]

# ============================================================================ rubble stone (face space, 24 x 10)
STONE = [
    "m4332m433332m4433m4332mm",
    "m3222m322221m3222m32211m",
    "m2221m221111m2211m22211m",
    "m1111mm11111mm111m11111m",
    "mmmmmmmmmmmmmmmmmmmmmmmm",
    "433m443332m4332m443332m4",
    "222m322221m3221m322221m3",
    "211m22v211m2111m2V2111m2",
    "111m111111m1111m111111m1",
    "mmmmmmmmmmmmmmmmmmmmmmmm",
]
STONE_B = [
    "m4433m43332m443332m4332m",
    "m3222m32221m322221m3221m",
    "m2211m2211vm222111m2111m",
    "m1111m1111mm111111mm111m",
    "mmmmmmmmmmmmmmmmmmmmmmmm",
    "4332m443332m4332m4433332",
    "3221m322221m3221m3222221",
    "2111m22V211m2111m2221111",
    "1111m111111m1111m1111111",
    "mmmmmmmmmmmmmmmmmmmmmmmm",
]

# ============================================================================ grass tiles
# vocabulary of small tufts (B base is never written; D shade, M mid, L tip, Y/O dry, w/f/p flowers)
STAMPS = {
    't1': ["L.L",
           ".D."],
    't2': [".L.",
           "LMD"],
    't3': ["L..L",
           ".LMD",
           "..D."],
    't4': ["M.L.M",
           "DMDMD"],
    't5': ["..L..",
           "L.ML.",
           ".MDMD"],
    'd1': ["D.D",
           ".D."],
    'd2': ["D..D.",
           ".DD.D"],
    'y1': ["Y.Y",
           ".O."],
    'y2': ["Y..Y",
           ".YOY",
           "..O."],
    'w1': ["w.",
           "Dw"],
    'f1': [".f.",
           "fDf"],
    'p1': ["p.",
           ".Dp"],
}
STAMP = {k: grid(v, G) for k, v in STAMPS.items()}

# 32 x 16 diamond cells (8 x 8 steps); stamps at hand-picked spots inside each diamond
GRASS_TILES = {
    'A': [('t2', 6, 6), ('t1', 19, 4), ('t3', 13, 10), ('d1', 23, 8)],
    'B': [('t4', 9, 7), ('w1', 21, 9), ('t1', 16, 3)],
    'C': [('t1', 5, 7), ('d2', 12, 4), ('t2', 21, 7), ('t1', 14, 11)],
    'D': [('y2', 11, 5), ('t2', 19, 10), ('y1', 22, 5)],
    'E': [('t5', 7, 5), ('t1', 22, 6), ('f1', 14, 10), ('d1', 17, 3)],
    'F': [('t1', 15, 8)],
    'G': [('d2', 6, 7), ('t3', 17, 5), ('p1', 12, 11), ('t1', 24, 9)],
    'H': [('t2', 10, 9), ('t5', 18, 4)],
}
# which tile sits in each of the 8 x 8 cells (row = cell y from the back, column = cell x)
GRASS_MAP = [
    "AEGBDCHA",
    "CFADEGBE",
    "GBHCAFDC",
    "EDAGBHCG",
    "BCEFDAEB",
    "HAGCEBGD",
    "DEBHACFE",
    "AGCDGEHB",
]

# ============================================================================ landmarks on the grass
# o outline, D shade, B base, M mid, L light, plus rock and wood tones
BUSH = grid([
    "....oooo....",
    "..ooLLMMoo..",
    ".oLLMMMMMDo.",
    "oLMMMLMMMMDo",
    "oMMMMMMMDDDo",
    ".oDMMMDDDDo.",
    "..ooDDDDoo..",
    "....oooo....",
], dict(o=N['abyss'], D=N['pine'], B=N['leaf'], M=N['leaf'], L=N['mint']))

BUSH_SMALL = grid([
    "..ooo..",
    ".oLMMo.",
    "oLMMMDo",
    "oMMDDDo",
    ".ooooo.",
], dict(o=N['abyss'], D=N['pine'], M=N['leaf'], L=N['mint']))

ROCK = grid([
    "..oooo...",
    ".o4433o..",
    "o432221o.",
    "o3222111o",
    ".o11111o.",
    "..ooooo..",
], dict(o=N['slate'], **{'1': N['stone'], '2': N['lilac'], '3': N['mist'], '4': N['foam']}))

ROCK_SMALL = grid([
    ".ooo.",
    "o432o",
    "o221o",
    ".ooo.",
], dict(o=N['slate'], **{'1': N['stone'], '2': N['lilac'], '3': N['mist'], '4': N['foam']}))

STUMP = grid([
    ".oooooo.",
    "o433332o",
    "o3o22o2o",
    ".o3333o.",
    ".o3221o.",
    ".o3221o.",
    "oo3211oo",
    ".oooooo.",
], dict(o=N['grape'], **{'1': N['plum'], '2': N['rust'], '3': N['copper'], '4': N['tan']}))

BONES = grid([
    "f.f...",
    ".fff..",
    "f.f.f.",
    "....ff",
], dict(f=N['foam']))

TIRE = grid([
    "..oooooo..",
    ".o112211o.",
    "o11oooo11o",
    "o1o....o1o",
    ".oo1111oo.",
    "...oooo...",
], dict(o=N['ink'], **{'1': N['slate'], '2': N['stone']}))
