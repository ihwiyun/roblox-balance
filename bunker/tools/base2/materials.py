"""Hand-drawn materials for the base, in the spirit of Pixel Composer's "Rusted Iron", "Stone Wall" and
"Barbed Wire" showcases: big readable clusters, 3 to 5 tone ramps, hard steps, no noise, no gradients.

Wall textures are drawn flat in FACE SPACE (u across, v down) and sheared onto the 2-1 walls by the
canvas, so every course and seam follows the iso slant. They are written in TONES ('1' darkest ..
'4' lightest, 'o' crevice, letters for accents) so one drawing serves the lit left wall and the shaded
right wall: a ramp turns tones into palette indices.

Nothing is random. Where a wall needs variety (bag lengths, which bag has a tie, where rust bleeds)
the choices are typed below as sequences and placements.
"""
import numpy as np

from canvas import grid
from pal import CLEAR, N


def ramp(**kw):
    return {k: N[v] for k, v in kw.items()}


def paint(rows, rmp):
    return grid(rows, rmp)


# ============================================================================ ramps (lit / shade)
BAG = {
    'lit': ramp(o='mauve', **{'1': 'rose', '2': 'beige', '3': 'khaki', '4': 'foam'}, t='mauve', s='sand'),
    'shade': ramp(o='grape', **{'1': 'mauve', '2': 'rose', '3': 'beige', '4': 'khaki'}, t='grape', s='tan'),
    'top': ramp(o='mauve', **{'1': 'beige', '2': 'khaki', '3': 'foam', '4': 'white'}, t='rose', s='sand'),
}
WOOD = {
    'lit': ramp(o='grape', **{'1': 'plum', '2': 'rust', '3': 'copper', '4': 'tan'}, n='mist', k='grape'),
    'shade': ramp(o='ink', **{'1': 'grape', '2': 'plum', '3': 'rust', '4': 'copper'}, n='lilac', k='ink'),
    'top': ramp(o='plum', **{'1': 'plum', '2': 'rust', '3': 'copper', '4': 'tan'}, n='mist', k='grape'),
    # weathered grey boards, for variety on roofs and fences
    'grey_lit': ramp(o='slate', **{'1': 'stone', '2': 'lilac', '3': 'mist', '4': 'foam'}, n='white', k='slate'),
    'grey_shade': ramp(o='ink', **{'1': 'slate', '2': 'stone', '3': 'lilac', '4': 'mist'}, n='foam', k='ink'),
    'grey_top': ramp(o='slate', **{'1': 'stone', '2': 'lilac', '3': 'mist', '4': 'foam'}, n='foam', k='slate'),
}
IRON = {
    'lit': ramp(o='slate', **{'1': 'stone', '2': 'lilac', '3': 'mist', '4': 'foam'},
                q='blood', r='rust', s='copper', t='tan', h='ink', b='slate'),
    'shade': ramp(o='ink', **{'1': 'slate', '2': 'stone', '3': 'lilac', '4': 'mist'},
                  q='plum', r='blood', s='rust', t='copper', h='ink', b='ink'),
    'top': ramp(o='stone', **{'1': 'lilac', '2': 'mist', '3': 'foam', '4': 'white'},
                q='rust', r='copper', s='tan', t='sand', h='slate', b='stone'),
}
STONE = {
    'lit': ramp(o='slate', **{'1': 'stone', '2': 'lilac', '3': 'mist', '4': 'foam'}, v='leaf', V='pine'),
    'shade': ramp(o='ink', **{'1': 'slate', '2': 'stone', '3': 'lilac', '4': 'mist'}, v='pine', V='abyss'),
}

# ============================================================================ sandbags
# A bag seen from the side is 5 rows tall: a lit upper curve, the body, a shaded belly. It is built
# from a left cap, body columns and a right cap, so a bag can be any length the course plan asks
# for. The light comes from the left: the top brightens toward the left third, the right end sinks.
# '.' in a cap is the crevice between bags (o).
CAP_L = [".3",
         "34",
         "33",
         "22",
         ".1"]
CAP_R = ["2.",
         "21",
         "21",
         "11",
         "1."]
CAP_R_TIED = ["t.",      # the tied end: a pinched neck with a tuft
              "2t",
              "1t",
              "1t",
              "t."]
BODY = ["4443333333333333",
        "4333333333333333",
        "3332222222222222",
        "2222222222222222",
        "1111111111111111"]
BAG_H = 5


def bag(length, tied=False, sag=False, leak=False):
    """one sandbag, `length` px long (>= 6), in tones"""
    mid = length - 4
    rows = []
    for r in range(BAG_H):
        b = BODY[r][:mid] if mid <= len(BODY[r]) else BODY[r] + BODY[r][-1] * (mid - len(BODY[r]))
        rows.append(CAP_L[r] + b + (CAP_R_TIED if tied else CAP_R)[r])
    if sag:      # the middle settles: the lit curve dips
        k = 2 + mid // 2
        rows[0] = rows[0][:k] + '2' + rows[0][k + 1:k + 2] + '2' + rows[0][k + 2:]
        rows[0] = rows[0][:length]
    if leak:     # a split seam with a trickle of sand
        k = 2 + mid // 3
        rows[3] = rows[3][:k] + 's' + rows[3][k + 1:]
        rows[4] = rows[4][:k] + 's' + rows[4][k + 1:]
    return [r.replace('.', 'o') for r in rows]


# course plans: each course is a list of (length, flags) read left to right; typed by hand so joints
# never line up, ties face both ways, and a few bags sag or leak. Flags: t tied, s sag, l leak.
COURSES = [
    [(13, ''), (11, 't'), (14, 's'), (12, ''), (13, 't'), (11, ''), (14, 'l'), (12, 't'), (13, ''), (11, 's'),
     (14, 't'), (12, '')],
    [(7, ''), (13, 't'), (12, ''), (14, 's'), (11, ''), (13, 't'), (12, 'l'), (14, ''), (11, 't'), (13, ''),
     (12, 's'), (14, 't')],
    [(11, 's'), (14, ''), (12, 't'), (13, ''), (11, ''), (14, 't'), (12, 's'), (13, ''), (11, 't'), (14, ''),
     (12, ''), (13, 'l')],
    [(5, ''), (12, ''), (14, 't'), (11, 's'), (13, ''), (12, 't'), (14, ''), (11, ''), (13, 'l'), (12, 't'),
     (14, 's'), (11, '')],
    [(9, 't'), (13, ''), (12, 's'), (14, ''), (11, 't'), (13, ''), (12, ''), (14, 't'), (11, 'l'), (13, ''),
     (12, 't'), (14, 's')],
]


def bag_wall(width, height, start=0, shift=0):
    """face texture (rows x width, tones) of a sandbag wall; courses counted from the bottom.
    `start` picks which course plan sits at the bottom, `shift` slides all plans (so two walls of the
    same building do not show the same joints)."""
    out = [['o'] * width for _ in range(height)]
    ncourse = (height + BAG_H - 1) // BAG_H
    for k in range(ncourse):
        plan = COURSES[(start + k) % len(COURSES)]
        x = -((shift + 6 * k) % 13)
        i = 0
        top = height - BAG_H * (k + 1)
        while x < width:
            ln, fl = plan[i % len(plan)]
            b = bag(ln, tied='t' in fl, sag='s' in fl, leak='l' in fl)
            if 't' in fl and (i + k) % 2:          # this one is tied at its left end instead
                b = [r[::-1] for r in bag(ln, tied=True)]
                b = [('o' + r[1:]) if j in (0, 4) else r for j, r in enumerate(b)]
            for r in range(BAG_H):
                y = top + r
                if not 0 <= y < height:
                    continue
                for j, ch in enumerate(b[r]):
                    if 0 <= x + j < width:
                        out[y][x + j] = ch
            x += ln
            i += 1
    return [''.join(r) for r in out]


# the top of a sandbag course seen from above (parapets): lumpy pillows along the wall, 3 rows deep,
# light from the left. Read along u, like the side.
BAG_TOP_PIECES = [
    [".o3443333o.",
     "o344333332o",
     ".o2222221o."],
    [".o34433o.",
     "o3443332o",
     ".o22221o."],
    [".o344333o..",
     "o34433332o.",
     ".o222222o.."],
]

# ============================================================================ planks
# a plank seen from the side (2 rows) or its end grain; and the roof boards seen from above are built
# in bunker.py from these per-board looks: (ramp, knot positions, nail positions).
PLANK_SIDE = ["3333333333333333333333333333333333333333333333",
              "2222221222222222222222222122222222222222222222"]
END_GRAIN = ["43",
             "32"]

# ============================================================================ corrugated rusted iron
# ridges every 3 px along u (crest, flank, trough); rust bleeds down from bolts and the top edge.
RIDGE = "432"


def iron_sheet(width, height, rust=(), holes=(), bolts_v=(1,), bolt_every=9, edge=True):
    """face texture of one corrugated sheet. rust: list of (u, v, stamp index); holes: (u, v)"""
    out = [[RIDGE[u % 3] for u in range(width)] for _ in range(height)]
    if edge:
        for u in range(width):
            out[0][u] = '3' if u % 3 != 2 else '2'
            out[height - 1][u] = '1'
    for u0, v0, k in rust:
        st = RUST[k]
        for j, row in enumerate(st):
            for i, ch in enumerate(row):
                if ch != '.' and 0 <= v0 + j < height and 0 <= u0 + i < width:
                    out[v0 + j][u0 + i] = ch
    for u, v in holes:
        if 0 <= v < height and 0 <= u < width:
            out[v][u] = 'h'
    for v in bolts_v:
        for u in range(2, width - 1, bolt_every):
            if 0 <= v < height:
                out[v][u] = 'b'
    return [''.join(r) for r in out]


# rust blobs (face space): q darkest pit .. t bright edge. Big clusters, streaks run downward.
RUST = [
    ["..ts..",
     ".tsrr.",
     "tsrqr.",
     ".srqrs",
     "..rqr.",
     "..sr..",
     "...r..",
     "...s.."],
    [".tts...",
     "tsrrst.",
     "srqqrs.",
     ".rqhqr.",
     ".srqrrs",
     "..rrr..",
     "..sr...",
     "...r...",
     "...s..."],
    ["ts.",
     "sr.",
     "rr.",
     ".r.",
     ".s."],
    ["..tsst..",
     ".tsrrst.",
     "tsrqqrs.",
     "srqqqqrt",
     ".rqqhqr.",
     ".srqqrs.",
     "..srrs..",
     "...sr...",
     "...r....",
     "...s...."],
]

# ============================================================================ rubble stone (Stone Wall)
# courses of rounded stones: light top-left rim (4), body (3,2), shade (1), mortar (o); moss (v)
STONE_COURSES = [
    "o4332o433332o44332o4332oo433332o44332o",
    "o3221o322221o32221o3221oo322221o32221o",
    "o2211o221111o22111o2211o2221111o22111o",
    "ooooooooooooooooooooooooooooooooooooooo",
    "433o44332o4332o443332o4332o4433332o43",
    "322o32221o3221o322221o3221o3222221o32",
    "2v1o22211o2211o2V2111o2111o2221111o21",
    "ooooooooooooooooooooooooooooooooooooo",
]


def stone_wall(width, height, shift=0):
    out = []
    for v in range(height):
        row = STONE_COURSES[v % len(STONE_COURSES)]
        sh = shift + 7 * (v // len(STONE_COURSES))
        out.append(''.join(row[(u + sh) % len(row)] for u in range(width)))
    return out


def face_fn(rows, rmp, ox=0, oy=0):
    """wrap tone rows into a canvas face callback tex(u, v)"""
    h = len(rows)

    def f(u, v):
        u -= ox
        v -= oy
        if 0 <= v < h and 0 <= u < len(rows[v]):
            ch = rows[v][u]
            return CLEAR if ch == '.' else rmp[ch]
        return CLEAR
    return f
