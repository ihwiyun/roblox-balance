#!/usr/bin/env python3
"""Turrets for the bunker game: 32 turrets (8 grades x 4 roles, the order of TURRETS in src/logic/gear.mjs),
every pixel placed by hand.

Run from this folder:  python3 turrets.py           -> writes ../art/turrets.js (window.ART_TURRETS)
                       python3 turrets.py --sheet   -> also writes ../samples/turrets/sheet.png (needs Pillow)
                       python3 turrets.py --check DIR  -> a quick 4-facing check sheet into DIR

How a turret is made
- A frame is 32x32 game pixels; the anchor (ax, ay) = (16, 28) is the middle of the turret ring's foot, the
  point that stands on the bunker's mount (SITES.mounts in src/yard.js). A turret is 20-27 px tall.
- Two parts: the ring (one per grade; it never turns) and the head (one per turret; it turns). The head is drawn
  by hand looking down-right (se: +x in the world) and looking up-left (nw: -x). Every head is symmetric about
  the way it looks, so looking down-left (sw: +y) and up-right (ne: -y) are the same pixels mirrored, with the
  two wall shades swapped so the light still comes from the top left (the game's light: the top bright, the
  wall facing down-left mid, the wall facing down-right dark).
- Colours: every material is one base colour run through the engine's own ramp (rampOf in engine.js), five
  shades from violet shadow to warm light, the same way the bunker is shaded. Outline rgb(30,24,26) as on the
  survivors and zombies.
- The fire frame: barrels and tubes kick back along their axis (they never jump sideways) and the muzzle shows
  its flash, flame, frost, arc or blast for that one frame only (no trail).

Letters (one palette per turret)
  o outline   K bore black   W glint
  a b c d e   body: deep, wall facing down-right, wall facing down-left, top, light
  f g h i j   metal (barrels, pipes, coils), same five shades
  k l m n p   grade accent (the UI grade colour), same five shades
  q r s t u   third material (tank, battery, bags...), same five shades
  v w x y z   the ring, same five shades
  G H J       glow: core, bright, dim (experimental and later)
  F Y O R D   fire: white-hot, yellow, orange, red, ember        L C B N  frost: ice, pale, blue, deep
  A Z V       electric arc: core, cyan, violet                    S T U    smoke: light, mid, dark
  X           star        1 2 3 4 5 6  rainbow (red, orange, yellow, green, blue, violet)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..')

# ---------------------------------------------------------------- colours
COOL, WARM = (46, 38, 84), (255, 232, 180)


def ramp(c):
    """engine.js rampOf: shadows drift to violet, lights to warm yellow (rgb() truncates)"""
    mix = lambda m, t, k: [min(255, int(c[i] * m + (t[i] - c[i] * m) * k)) for i in range(3)]
    return [mix(.4, COOL, .34), mix(.62, COOL, .18), mix(.84, COOL, .05), mix(1, WARM, 0), mix(1.1, WARM, .22)]


MATS = {'body': 'abcde', 'metal': 'fghij', 'acc': 'klmnp', 'mat3': 'qrstu', 'ring': 'vwxyz'}
# mirrored views swap the two wall shades of every material
SWAP = str.maketrans('bcghlmrswx', 'cbhgmlsrxw')
FIXED = {
    'o': [30, 24, 26], 'K': [16, 12, 18], 'W': [255, 252, 236],
    'F': [255, 248, 206], 'Y': [255, 214, 92], 'O': [242, 136, 46], 'R': [198, 60, 40], 'D': [118, 38, 38],
    'L': [238, 250, 255], 'C': [162, 226, 250], 'B': [88, 158, 232], 'N': [58, 94, 178],
    'A': [250, 250, 255], 'Z': [130, 222, 255], 'V': [150, 118, 255],
    'S': [224, 220, 212], 'T': [170, 166, 162], 'U': [114, 110, 114], 'X': [255, 255, 255],
    '1': [224, 69, 69], '2': [240, 150, 40], '3': [240, 210, 60], '4': [69, 192, 112], '5': [69, 144, 224], '6': [160, 80, 224],
}
# the UI grade colours (index.html .g0-.g7)
GRADE_UI = [[154, 154, 154], [76, 175, 80], [61, 123, 224], [155, 79, 209], [240, 138, 36], [214, 58, 58], [201, 154, 16], [224, 69, 155]]
GRADE_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legend', 'immortal', 'mythic', 'eternal']
PREFIX = ['고물', '민간', '군용', '특수', '실험', '미지', '신화', '영원']
ROLES = ['mg', 'status', 'tesla', 'blast']


def base_name(g, r):
    fire = g % 2 == 0
    return ['기관포', '화염 방사기' if fire else '냉각 분사기', '전기 코일', '로켓 포대' if g % 2 else '박격포'][r]


# per grade: the ring, the accent and the default body, metal and third material
GRADE_MATS = [
    dict(ring=(150, 86, 54), acc=(154, 154, 154), body=(150, 138, 122), metal=(104, 106, 114), mat3=(150, 86, 54)),
]


def palette(g, mats, glow=None):
    m = dict(GRADE_MATS[min(g, len(GRADE_MATS) - 1)])
    m.update(mats or {})
    pal = dict(FIXED)
    for key, letters in MATS.items():
        pal.update(zip(letters, ramp(m[key])))
    if glow:
        pal.update(zip('GHJ', glow))
    return pal


# ---------------------------------------------------------------- drawing helpers
W, H, AX, AY = 32, 32, 16, 28


def rows(s):
    out = s.strip('\n').split('\n')
    return out


def canvas():
    return [['.'] * W for _ in range(H)]


def stamp(cv, rs, x, y, name='?'):
    for j, r in enumerate(rs):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            if not (0 <= y + j < H and 0 <= x + i < W):
                raise ValueError(f'{name}: pixel outside the frame at {x + i},{y + j}')
            cv[y + j][x + i] = ch


def flat(cv):
    return [''.join(r) for r in cv]


def mirror(f):
    return [r[::-1].translate(SWAP) for r in f]


def under(top, bottom):
    """top drawn over bottom"""
    return [''.join(t if t != '.' else b for t, b in zip(tr, br)) for tr, br in zip(top, bottom)]


# ---------------------------------------------------------------- the rings (one per grade, never turned)
RINGS = [
    # 0 scrap: a rusted ring, a grey primer band
    rows('''
....oooooo....
..ooyyyyyyoo..
.oyyyyyyyyyyo.
oyyyyyyyyyyyyo
ozyyyyyyyyyywo
oxzzyyyyyyyywo
omxxzzzzyywwlo
oxmmxxwxwwllwo
.oxxmmmlllwwo.
..ooxxxwwvoo..
....oooooo....
'''),
]
RING_AT = (9, 21)

# ---------------------------------------------------------------- the heads
# Each turret: pal (materials over the grade's), se and nw = layers drawn in order [kind, rows, x, y]; kind 'gun'
# moves with the recoil; muzzle = the point where shots leave in the idle frame; axis = the barrel's direction on
# screen; fx = what the fire frame shows at the muzzle.
T = {}

# ---- 0 / scrap machine cannon: a box of welded plates, two mismatched pipe barrels, a rusty mantlet
_box0_se = rows('''
......oo......
....ooddoo....
..oodeddddoo..
oeddddbddddddo
oceeddbdddddbo
occceebdddbbbo
ocmmcceebbbbbo
ocmnncccbbbbbo
ocmmmcscbbbbbo
occcccscbbebbo
oaccacscbbbbao
..ooacscbboo..
....ooacoo....
......oo......
''')
_box0_nw = rows('''
......oo......
....ooddoo....
..ooddddddoo..
oeddddddbddddo
oceeddddbdddbo
occceeddbdbbbo
occcmmeebbbbbo
occcmnccbaaabo
ocscmmccbaeabo
ocscccccbaaabo
oacsccccbbbbao
..ooscccbboo..
....ooacoo....
......oo......
''')
_bar0_se = rows('''
oo..........
jioo........
hhiioo......
oohhiioo....
..oohhiioo..
....oohhijoo
......oohgKo
........oooo
''')
_bar0b_se = rows('''
oo..........
jioo........
hhssoo......
oohsrsoo....
..oohsrsoo..
....oohhijoo
......oohgKo
........oooo
''')
_mant0_se = rows('''
..oo.
.otso
otsro
osrro
osro.
.oo..
''')
_bar0_nw = rows('''
.oo.........
ojioo.......
ohhiioo.....
.oohhiioo...
...oohhiioo.
.....oohhiio
.......oohhi
.........ooh
''')
_scope0 = rows('''
.oo.
ojgo
ohgo
ohgo
''')
T[0, 0] = dict(
    se=[['head', _box0_se, 9, 14], ['head', _scope0, 11, 11], ['gun', _bar0_se, 18, 19], ['gun', _bar0b_se, 16, 21], ['head', _mant0_se, 15, 20]],
    nw=[['gun', _bar0_nw, 4, 11], ['gun', _bar0_nw, 2, 13], ['head', _box0_nw, 9, 14], ['head', _scope0, 17, 12]],
    muzzle={'se': (29, 26), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash')


def frames_of(g, r):
    """the 8 frames of a turret: {facing: [idle rows, fire rows]}, and the muzzle per facing and frame"""
    spec = T[g, r]
    ring = canvas()
    stamp(ring, RINGS[min(g, len(RINGS) - 1)], *RING_AT, name='ring')
    ring = flat(ring)
    out, muz = {}, {}
    for view in ('se', 'nw'):
        pair, mp = [], []
        for firing in (False, True):
            cv = canvas()
            dx, dy = spec['recoil'][view] if firing else (0, 0)
            behind = view == 'nw'
            fxl = FX[spec['fx']][view] if firing else None
            mx, my = spec['muzzle'][view]
            mx, my = mx + dx, my + dy
            if fxl and behind:
                stamp(cv, fxl[0], mx - fxl[1], my - fxl[2], name='fx')
            for kind, rs, x, y in spec[view]:
                ox, oy = (dx, dy) if kind == 'gun' else (0, 0)
                stamp(cv, rs, x + ox, y + oy, name=f'{g},{r},{view}')
            if fxl and not behind:
                stamp(cv, fxl[0], mx - fxl[1], my - fxl[2], name='fx')
            pair.append(flat(cv))
            mp.append((mx, my))
        out[view] = pair
        muz[view] = mp
    out['sw'] = [mirror(f) for f in out['se']]
    out['ne'] = [mirror(f) for f in out['nw']]
    muz['sw'] = [(W - 1 - x, y) for x, y in muz['se']]
    muz['ne'] = [(W - 1 - x, y) for x, y in muz['nw']]
    # the ring stays put under every head
    for k in out:
        out[k] = [under(f, ring) for f in out[k]]
    return out, muz


# ---------------------------------------------------------------- fire-frame effects: [rows, x, y of the muzzle]
FX = {
    'flash': {
        'se': [rows('''
...Y.....
.OYFY..O.
..FWFYOY.
.OYFFWFY.
...OYFYO.
.....O...
'''), 3, 2],
        'nw': [rows('''
...O.....
.OYFYO...
.YFWFFYO.
.OYFWFY..
..O.YFYO.
.....Y...
'''), 5, 3],
    },
}


def check(dirname):
    """a quick sheet: each turret in the four facings, idle and firing, at 5x"""
    from PIL import Image
    s, pad = 5, 4
    items = sorted(T)
    im = Image.new('RGB', (8 * (W * s + pad) + pad, len(items) * (H * s + pad) + pad), (246, 244, 239))
    for n, (g, r) in enumerate(items):
        pal = palette(g, T[g, r].get('pal'), T[g, r].get('glow'))
        fr, _ = frames_of(g, r)
        for c, (k, i) in enumerate([(k, i) for k in ('se', 'sw', 'nw', 'ne') for i in (0, 1)]):
            ox, oy = pad + c * (W * s + pad), pad + n * (H * s + pad)
            for y, row in enumerate(fr[k][i]):
                for x, ch in enumerate(row):
                    if ch != '.':
                        im.paste(tuple(pal[ch]), (ox + x * s, oy + y * s, ox + x * s + s, oy + y * s + s))
    os.makedirs(dirname, exist_ok=True)
    im.save(os.path.join(dirname, 'check.png'))


if __name__ == '__main__':
    if '--check' in sys.argv:
        check(sys.argv[sys.argv.index('--check') + 1])
