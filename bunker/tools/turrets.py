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
W, H, AX, AY = 48, 40, 24, 35
DX, DY = 8, 7   # where the 32x32 design box of every drawing sits in the frame


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
            if not (0 <= y + j < len(cv) and 0 <= x + i < len(cv[0])):
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

# ---- era 0 machine cannon: a welded receiver, two long barrels along its top edges, a round ammo drum on each side
_recv0_se = rows("""
....oo....
..ooddoo..
oeddeddddo
oceeddddbo
occceebbbo
ocmmcbbbbo
ocmncbbebo
ocsmcbbbbo
oascbbbbao
..oocboo..
....oo....
""")
_recv0_nw = rows("""
....oo....
..ooddoo..
oedddeddbo
oceeddddbo
occceebbbo
occcbaaabo
ocmmbaKabo
ocmncaaabo
oasccbbbao
..oocboo..
....oo....
""")
_drum0 = rows("""
..oooo..
.ottttoo
osuuttro
ossttrro
ossssrro
otttttro
ossssrro
.ossrrro
..oooro.
....oo..
""")
_bar0_se = rows("""
.oo...............
ojjoo.............
ohhiijjoo.........
.oohhiijjoo.......
...oohhiijjoo.....
.....oohhiijjoo...
.......oohhiijjoo.
.........oohhiijjo
...........oohhgKo
.............oooo.
""")
_bar0r_se = rows("""
.oo...............
ojjoo.............
ohhssjjoo.........
.oohssrsjoo.......
...oohssrsjoo.....
.....oohhsiijoo...
.......oohhiijjoo.
.........oohhiijjo
...........oohhgKo
.............oooo.
""")
_bar0_nw = rows("""
.oo.............
ojjoo...........
ohgiijjoo.......
.oohhiijjoo.....
...oohhiijjoo...
.....oohhiijjoo.
.......oohhiijjo
.........oohhiio
...........oooo.
""")
T[0, 0] = dict(
    se=[['head', _recv0_se, 11, 16], ['head', _drum0, 8, 19], ['gun', _bar0_se, 14, 13], ['gun', _bar0r_se, 9, 15]],
    nw=[['head', _recv0_nw, 11, 16], ['head', _drum0, 8, 19], ['gun', _bar0_nw, 6, 10], ['gun', _bar0_nw, 2, 13]],
    muzzle={'se': (28, 23), 'nw': (3, 12)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (-2, -1), 'nw': (2, 1)},
    fx='flash2', pal={'mat3': (112, 118, 84)})

# ---- era 0 sprayer (flamethrower): a welded platform, a red jerry can standing at the back, a pipe nozzle
_plat0 = rows("""
......oo......
....ooddoo....
..oodeddddoo..
oeddddddddddbo
oceeddddddddbo
occeceeddbbbbo
oacccceebbebao
..ooacccbboo..
....ooacoo....
......oo......
""")
_can0 = rows("""
....oo.....
..ooqtoo...
oottqqttoo.
osuuttqtnno
osssuuttnno
osssssuurro
osttssstrro
ossttstrrro
osssttsrrro
ossttstrrro
osttsssrrro
osssssrrrro
oqsssssrrqo
..oosssrroo
....oosroo.
......oo...
""")
_noz0_se = rows("""
oo........
ihoo......
hhiioo....
oohhiioo..
..oohhiijo
....oohhjjo
......ohgKo
.......oooo
""")
_hose0_se = rows("""
.oo..
oKKoo
.ooKo
...oo
""")
_noz0_nw = rows("""
.oo.........
ojjoo.......
oiihhoo.....
oghhiiioo...
.ooooohhiioo
......oohhii
........oohh
""")
T[0, 1] = dict(
    se=[['head', _plat0, 9, 18], ['head', _can0, 9, 8], ['head', _hose0_se, 16, 20], ['gun', _noz0_se, 17, 19]],
    nw=[['gun', _noz0_nw, 3, 14], ['head', _plat0, 9, 18], ['head', _can0, 12, 10]],
    muzzle={'se': (28, 25), 'nw': (3, 15)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='flame', pal={'mat3': (186, 58, 46)})

# ---- era 0 electric coil: a car battery, copper wound round a pipe, a hubcap on top, a bent rod with a ball
_batt0 = rows("""
....oo....
..ooqqoo..
outKtnqtto
osuuttttro
osssuurrro
ossssrrrro
osmmsrrrro
osmnsrrrro
oqmmsrrrqo
..oosroo..
....oo....
""")
_coil0 = rows("""
ojihgo
ohggfo
ojihgo
ohggfo
ojihgo
ohggfo
ojihgo
ohggfo
ojihgo
.oggo.
""")
_hub0 = rows("""
....oooo....
..oonppnoo..
onppnnnnmmlo
onnnnKKnnmlo
.ommnnnnmllo
..oollllloo.
....oooooo..
""")
_emit0_se = rows("""
oo........
nmoo......
oonmoo....
..oonmooo.
....oonpno
.....onnmo
.....olmlo
......ooo.
""")
_emit0_nw = rows("""
.ooo......
onpnoo....
onnmmmoo..
olmlonmoo.
.ooo.oonmo
.......ooo
""")
T[0, 2] = dict(
    se=[['head', _batt0, 11, 16], ['head', _coil0, 13, 9], ['head', _hub0, 10, 4], ['gun', _emit0_se, 17, 10]],
    nw=[['gun', _emit0_nw, 5, 8], ['head', _batt0, 11, 16], ['head', _coil0, 13, 9], ['head', _hub0, 10, 4]],
    muzzle={'se': (26, 14), 'nw': (6, 9)}, axis={'se': (2, 1), 'nw': (-2, -1)}, recoil={'se': (0, 0), 'nw': (0, 0)},
    fx='arc', pal={'metal': (196, 118, 62), 'acc': (170, 172, 176), 'mat3': (66, 64, 72)})

# ---- era 0 mortar: a manhole cover for a base plate, sandbags, a pipe for a tube on rebar legs
_plate0 = rows("""
....oooooo....
..oodeeeedoo..
.odeddddddedo.
odedbdbdbdbdco
ocdddddddddcbo
.occddddddcbo.
..oaccccbbaoo.
....oooooo....
""")
_bag0 = rows("""
.oooo.
ottuto
osstro
.oooo.
""")
_tube0_se = rows("""
......oooo
.....oijjio
.....oiKKgo
.....ojhhgo
....oihhhgo
....oihhhgo
...omnnnlo.
...oihhhgo.
..oihhhgo..
..oihhhgo..
.oihhhgo...
.oihhhgfo..
..ooooooo..
""")
_legs0_se = rows("""
....fo.
...f..f
...f..f
..f....f
..f....f
.ff....ff
""")
_tube0_nw = rows("""
...oooo...
..ojjiiho.
..oiihhgo.
..oihhhgo.
..oihhhgo.
..oihhhgo.
..omnnnlo.
...oihhhgo
...oihhhgo
...oihhhgo
...oihhhgo
....oihhhgo
....ojhhhgfo
.....oooooo.
""")
_legs0_nw = rows("""
..fo...
.f..f..
.f...f.
f.....f
f.....f
""")
T[0, 3] = dict(
    se=[['head', _plate0, 9, 20], ['head', _bag0, 18, 20], ['gun', _tube0_se, 11, 10], ['head', _legs0_se, 15, 18], ['head', _bag0, 9, 23]],
    nw=[['head', _legs0_nw, 9, 17], ['head', _plate0, 9, 20], ['head', _bag0, 18, 20], ['gun', _tube0_nw, 9, 8], ['head', _bag0, 9, 23]],
    muzzle={'se': (19, 11), 'nw': (14, 9)}, axis={'se': (1, -2), 'nw': (-1, -3)}, recoil={'se': (-1, 1), 'nw': (1, 1)},
    fx='blast', pal={'metal': (92, 94, 104), 'mat3': (190, 166, 116)})


def frames_of(g, r):
    """the 8 frames of a turret: {facing: [idle rows, fire rows]}, and the muzzle per facing and frame"""
    spec = T[g, r]
    ring = canvas()
    stamp(ring, RINGS[min(g, len(RINGS) - 1)], RING_AT[0] + DX, RING_AT[1] + DY, name='ring')
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
            mx, my = mx + dx + DX, my + dy + DY
            if fxl and behind:
                stamp(cv, fxl[0], mx - fxl[1], my - fxl[2], name='fx')
            for kind, rs, x, y in spec[view]:
                ox, oy = (dx, dy) if kind == 'gun' else (0, 0)
                stamp(cv, rs, x + ox + DX, y + oy + DY, name=f'{g},{r},{view}')
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
    # two bursts, one at each barrel's end (the muzzle point is between them)
    'flash2': {
        'se': [rows("""
......Y...
.....YFO..
....YFWFO.
..Y..OFYO.
.YFO..O...
YFWFO.....
.OFYO.....
..O.......
"""), 4, 3],
        'nw': [rows("""
.....O.....
....OYFY...
...OFWFY...
.O..YFYO...
OYFY.Y.....
OFWFY......
.YFYO......
..Y........
"""), 3, 3],
    },
    # a tongue of flame out of the nozzle, white-hot at the nozzle, red and ember at the end
    'flame': {
        'se': [rows("""
.YO.........
FFYYO.......
.FFFYYOO....
..YFFFYOOR..
...OYYFYOORD
....ROOYOORD
......RROOD.
........RD..
"""), 0, 1],
        'nw': [rows("""
..DR........
.DROOR......
DROOYOOR....
.RROYFYYOR..
...OOYFFFYO.
.....OOYFFFY
.......OOYFF
.........OY.
"""), 11, 6],
    },
    # crackling arcs: hub to the emitter ball, round the hub's rim, a spark on the ball
    'arc': {
        'se': [rows("""
......ZAZ..........
..Z..ZA.AZ.....Z...
.ZAZ.A....A...ZAZ..
.ZA...Z...AZ.ZA....
..A........AA......
.ZAZ.........AZ....
..Z...........AA...
..............ZAZ..
...............AZ..
.............ZZAAZZ
..............ZAAZ.
...............ZZ..
"""), 15, 9],
        'nw': [rows("""
...Z..............
..ZAZ......Z......
....AZ....ZAZ..Z..
....A.....A..ZAZ..
...ZA....A....A...
...A.....Z.....A..
..AZ...........AZ.
.ZA.............A.
Z.A..........ZAZ..
.ZAZ..........Z...
..Z...............
"""), 1, 8],
    },
    # the round leaves in a white flash, a puff of smoke rolls up
    'blast': {
        'se': [rows("""
...STS..
.SSTTSS.
STSSTTTS
TSFYFSTT
.TYWWYT.
..OFFO..
...OO...
"""), 3, 6],
        'nw': [rows("""
..STS...
.SSTTSS.
STTSSTST
TTSFYFST
.TYWWYT.
..OFFO..
...OO...
"""), 4, 6],
    },
}


def trim(f):
    """rows without their trailing transparent pixels (cells keep their x; drawSprite needs no padding)"""
    out = [r.rstrip('.') for r in f]
    while out and not out[-1]:
        out.pop()
    return out


def turret_set(g, r):
    """one turret as a sprite set in the game's format (src/sprites.js decodeSet + paletteOf)"""
    spec = T[g, r]
    pal = palette(g, spec.get('pal'), spec.get('glow'))
    fr, muz = frames_of(g, r)
    used = set()
    anims = {}
    for k in ('se', 'sw', 'nw', 'ne'):
        ax_, ay_ = spec['axis']['se' if k in ('se', 'sw') else 'nw']
        if k in ('sw', 'ne'):
            ax_ = -ax_
        n = (ax_ * ax_ + ay_ * ay_) ** .5
        frames = []
        for i, f in enumerate(fr[k]):
            mx, my = muz[k][i]
            used |= set(''.join(f))
            # gun: a point back along the barrel, then the muzzle (shots leave along this line)
            frames.append({'rows': trim(f), 'gun': [round(mx - ax_ / n * 6), round(my - ay_ / n * 6), mx, my], 'muzzle': [mx, my]})
        anims[k] = {'fps': 12, 'loop': False, 'F': frames}
    used.discard('.')
    name = PREFIX[g] + ' ' + base_name(g, r)
    element = ('fire' if g % 2 == 0 else 'frost') if r == 1 else 'shock' if r == 2 else None
    return {'i': g * 4 + r, 'name': name, 'grade': g, 'role': ROLES[r], 'element': element,
            'w': W, 'h': H, 'ax': AX, 'ay': AY, 'pal': {k: pal[k] for k in sorted(used)}, 'anims': anims}


def build():
    types = {}
    for (g, r) in sorted(T):
        types['turret%d' % (g * 4 + r)] = turret_set(g, r)
    return types


def write_js(types, cards):
    head = """'use strict';
// Turrets: 32 sprite sets (8 grades x 4 roles, index i = TURRETS[i] in src/logic/gear.mjs), generated by
// tools/turrets.py - edit that, not this file. Every pixel placed by hand.
// types['turret' + i] is a sprite set like ART_ZOMBIES_A.types: {w, h, ax, ay, pal, anims}, so decodeSet and
// paletteOf (src/sprites.js) take it as it is; (ax, ay) = the middle of the ring's foot, put on a mount
// (SITES.mounts). Also i, name, grade, role, element.
// anims: one per facing, each two frames F[0] idle and F[1] fire (show the fire frame for one frame per shot):
//   se = down-right (+x), sw = down-left (+y), nw = up-left (-x), ne = up-right (-y); all four drawn unmirrored.
//   From a yaw: const f = facingOf(yaw), dir = f.view === 'F' ? (f.mirror ? 'sw' : 'se') : (f.mirror ? 'ne' : 'nw');
//   drawSprite('turret' + i, dir, 'F', firing ? 1 : 0, false, x, y, z, pal)
// frame.gun = [x0, y0, x1, y1]: back along the barrel, then the muzzle (frame pixels); shots leave from the
// muzzle along that line (frameSpot(info, [gun[2], gun[3]]) is the muzzle on screen). frame.muzzle = [x1, y1].
// cards['turret' + i] = {w, h, rows, pal}: the card icon for the UI slots (the idle down-right turret).
"""
    body = 'window.ART_TURRETS = ' + json.dumps({'types': types, 'cards': cards}, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(GAME, 'art', 'turrets.js'), 'w', encoding='utf-8') as fh:
        fh.write(head + body)


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
    types = build()
    write_js(types, {})
    print('art/turrets.js:', len(types), 'turrets')
    if '--check' in sys.argv:
        check(sys.argv[sys.argv.index('--check') + 1])
