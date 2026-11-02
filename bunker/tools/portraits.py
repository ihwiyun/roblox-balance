#!/usr/bin/env python3
"""Crew portraits for the bunker game: 48x48 busts, every pixel placed by hand.

Run from this folder:  python3 portraits.py          -> writes ../art/portraits.js
                       python3 portraits.py --sheet  -> also writes ../samples/portraits/sample.png
                                                        (needs Pillow: each portrait at 1x 2x 4x on white paper,
                                                        next to the person's in-game sprite at 4x)

How they are drawn
- One bust per person in a slight three-quarter view to the right, like the game's front sprites (F), with SD
  proportions: the head fills most of the frame, the shoulders the bottom.
- The same person as in the game: the hair, face marks and headgear of their head stamp in tools/humans32.py,
  and their colours from LOOKS in src/config.js made into a palette the way the game does (personPalette in
  src/sprites.js). A few shades between those colours are added for the face and hair.
- Light from the top left. No outline around the figure: edges come from the colour masses and from the darker
  shade of each material on the side away from the light.
- Gunners wear a rifle sling across the chest.

Letters
  S s d  skin, shade, dark shade       L  skin in full light
  H h    hair, its light               i  hair catching the light     j  hair in the clefts
  n      skin showing through stubble  K  eyes    e  the light in an eye    m  mouth
  C c x  shirt, shade, dark            T t  stripe in light, in shade
  V v    sling webbing (the game's vest colours)    M  metal    u  dark metal (the rifle's grey)
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..')

ROWS = {
 'hero': [
  # 0         1         2         3         4
  # 012345678901234567890123456789012345678901234567
  "................................................",
  ".............................hiH................",
  "......................hj...hiiHHj...............",
  "................hj..hiHHj.hihHHHHj..............",
  "..............hihHjhHHHHjhihHHHHHHj.............",
  "............hihHHHHjhHHHHjhHHHhhHHHj............",
  "..........hihHHHHHHHjHHHHHjHHHHHhhHjj...........",
  ".........hhHHjHHHHHHHjHHHHHjHHHHHHhhjj..........",
  "........hhHHHjHHHHHHHHHHHHHHHHHHHHHhjj..........",
  "........hHHHjHHHHHHHHHHHHHHHHHHHHHHHHHj.........",
  "........HHHHHjHHHHHHHHHHHHHHHHHHjjjjjj..........",
  ".......hHHHHjhHHHHHHHHHHHHjjhHHjhHHjj...........",
  ".......hHHjHhHHHjjHjjjHHjjjHhHHjHhHHj...........",
  ".......jHhHjHhHHjsjsssjjsssHhHHjHhHHj...........",
  "........HhHjHhHjsSSLLSSSSSSsHhHjsHhHj...........",
  "........HhHjHHhjsSLLSSSSSSSSsHhjsHhHj...........",
  "........HhHjHhjsSLSSSSSSSSSSSSHjssSHj...........",
  "........HhHjhjsSSSSSjjjSSSSSSSSSjjjss...........",
  "........HhjSSsssSSSSSSSjjjSSSSjjSSSss...........",
  "........HhjSsdssSSSSSSKKKSSSSSSKKKSss...........",
  "........HhjSsdSsSSSSSSSeKSSSSSSeKsSsd...........",
  ".........HjSSdSsSSSSSSSKKSSSSSSKKsSsd...........",
  ".........HjSSsSsSSLLSSSHKSSSLSSHKsssd...........",
  ".........HjjSSssSLLSSSSSSSSSSsSSssssd...........",
  ".........hjjSSssSSSSSSSSSSSSssSSsssd............",
  ".........HjjssssSSSSSSSSSSSSSmSSsssd............",
  "..........HjdsssSSSSSSSSSmmmmSSsSssd............",
  "...........jddssSSSSSSSSSSssSSSSssd.............",
  ".............ddssSSSSSSSSLLSSSSssd..............",
  "................ddsSSSSSSSSSSSSsd...............",
  ".....................dssSSSSSSsd................",
  "...............CCxxdddddddddxxcc................",
  "............VVVvCCxsSSSssssdxCCCCcc.............",
  ".........CCCCVVVvCCCxsssssxCCCCCCCcccc..........",
  ".......CCCCCCCVVVvCCCxsssxCCCCCCcccccccc........",
  "......TTTTTTTTTTVVVvTTTxTTTTTTTTttttttttt.......",
  ".....TTTTTTTTTTTTVVVvTTTTTTTTTTTtttttttttt......",
  ".....CCCCCcCCCCCCCVVVvCCCCCCCCCCccccxccccc......",
  ".....TTTTTcCCCCCCCCVVVvCCCCCCCCCccccxttttt......",
  ".....TTTTTcCCCCCCCCCCVVVvCCCCCCCccccxttttt......",
  ".....CCCCCcTTTTTTTTTTTVMuvTTTTTTttttxccccc......",
  ".....CCCCCcTTTTTTTTTTTTuuVvTTTTTttttxccccc......",
  ".....CCCCCcCCCCCCCCCCCCCVVVvCCCCccccxccccc......",
  ".....TTTTTcCCCCCCCCCCCCCCCVVVvCCccccxttttt......",
  ".....TTTTTcCCCCCCCCCCCCCCCCVVVvCccccxttttt......",
  ".....CCCCCcTTTTTTTTTTTTTTTTTVVVvttttxccccc......",
  ".....CCCCCcTTTTTTTTTTTTTTTTTTVVVvtttxccccc......",
  ".....CCCCCcCCCCCCCCCCCCCCCCCCCCVVVvcxccccc......",
 ],
 'minjun': [
  # 0         1         2         3         4
  # 012345678901234567890123456789012345678901234567
  "................................................",
  "................................................",
  "................................................",
  "..................niiiHHHHH.....................",
  "...............niiiiHiHHHHHHHj..................",
  ".............niiiHiHiHHHHHHHHHHj................",
  "............niiHiHiHHHHHHHHHHHHjj...............",
  "...........niiHiHHHHHHHHHHHHHHHHjj..............",
  "..........niHiHHHHHHHHHHHHHHHHHHHjj.............",
  "..........niHHHHHHHHHHHHHHHHHHHHHHjj............",
  ".........niHHHHHHHHHHHHHHHHHHHHHHjjj............",
  ".........nHHHHHHHHHHHHHHHHHHHHHHHjjj............",
  ".........nHHHHHHnnnnHHHHHHHHHnnnnnss............",
  ".........nHHnHHnSSSSnnnnnnnnnSSSSSss............",
  ".........nnHnHnsSLLLSSSSdSSSSSSSSSss............",
  ".........nnnnnsSLLSSSSSSdSSSSSSSSSsss...........",
  ".........nnnnssSSSSSHHSdSSSSSSSSHHSss...........",
  ".........nnnssSSSSSSSSHdHHSSSSHHSSSss...........",
  ".........nsSSsssSSSSSSSdSSSSSSSSSSSss...........",
  ".........nnSsdssSSSSSSKKKSSSSSSKKKSss...........",
  ".........nnSsdSsSSSSSSSeKSSSSSSeKsSsd...........",
  ".........nsSSdSsSSSSSSSKKSSSSSSKKsSsd...........",
  ".........nsSSsSsSSLLSSSnKSSSLSSnKsssd...........",
  ".........nnsSSssSLLSSSSdSSSSSsSSssssd...........",
  "..........nsSSssSSSSSSdSSSSSssSSsssd............",
  "...........sssssSSSSSSSSSSSSSSSSsssd............",
  "............dsssSSSSSSSSSSmmmSSsSssd............",
  "............ddssSSSSSSSSSSSsSSSSssd.............",
  ".............ddssSSSSSSSSLLSSSSssd..............",
  "...............ddsSSSSSSSSSSSSSsd...............",
  "....................dssSSSSSSSsd................",
  "...............CCxxdddddddddxxcc................",
  "............VVVvCCxsSSSssssdxCCCCcc.............",
  ".........CCCCVVVvCCCxsssssxCCCCCCCcccc..........",
  ".......CCCCCCCVVVvCCCxsssxCCCCCCcccccccc........",
  "......TTTTTTTTTTVVVvTTTxTTTTTTTTttttttttt.......",
  ".....TTTTTTTTTTTTVVVvTTTTTTTTTTTtttttttttt......",
  ".....CCCCCcCCCCCCCVVVvCCCCCCCCCCccccxccccc......",
  ".....TTTTTcCCCCCCCCVVVvCCCCCCCCCccccxttttt......",
  ".....TTTTTcCCCCCCCCCCVVVvCCCCCCCccccxttttt......",
  ".....CCCCCcTTTTTTTTTTTVMuvTTTTTTttttxccccc......",
  ".....CCCCCcTTTTTTTTTTTTuuVvTTTTTttttxccccc......",
  ".....CCCCCcCCCCCCCCCCCCCVVVvCCCCccccxccccc......",
  ".....TTTTTcCCCCCCCCCCCCCCCVVVvCCccccxttttt......",
  ".....TTTTTcCCCCCCCCCCCCCCCCVVVvCccccxttttt......",
  ".....CCCCCcTTTTTTTTTTTTTTTTTVVVvttttxccccc......",
  ".....CCCCCcTTTTTTTTTTTTTTTTTTVVVvtttxccccc......",
  ".....CCCCCcCCCCCCCCCCCCCCCCCCCCVVVvcxccccc......",
 ],
}


# ============================================================================ colours from the game
def game_looks():
    """LOOKS from src/config.js in their order: key -> hair, skin, shirt, pants; and the names (NAMES go with
    LOOKS[1:], the hero is '나' as in src/crew.js)"""
    src = open(os.path.join(GAME, 'src', 'config.js'), encoding='utf-8').read()
    looks = {}
    for m in re.finditer(r"\{ key: '(\w+)'.*?hair: \[([\d, ]+)\], skin: \[([\d, ]+)\], shirt: \[([\d, ]+)\], pants: \[([\d, ]+)\]", src):
        looks[m.group(1)] = {k: [int(v) for v in m.group(i).split(',')] for i, k in ((2, 'hair'), (3, 'skin'), (4, 'shirt'), (5, 'pants'))}
    names = ['나'] + re.findall(r"'([^']+)'", re.search(r'const NAMES = \[(.*?)\]', src).group(1))
    return looks, dict(zip(looks, names))


def game_humans():
    """ART_HUMANS from art/humans.js (the data the game draws)"""
    src = open(os.path.join(GAME, 'art', 'humans.js'), encoding='utf-8').read()
    body = src[src.index('{', src.index('ART_HUMANS')):src.rindex('}') + 1]
    body = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', body)
    return json.loads(re.sub(r',(\s*[}\]])', r'\1', body))


def mix(a, b, k):
    return [a[i] + (b[i] - a[i]) * k for i in range(3)]


def person_pal(look, base):
    """one person's colours the way the game makes them (personPalette in src/sprites.js, no helmet or vest)"""
    sh, sk, ha = look['shirt'], look['skin'], look['hair']
    p = {k: list(v) for k, v in base.items()}
    p['T'] = [v * 1.3 + 12 for v in sh]; p['t'] = [v * 1.06 for v in sh]
    p['P'] = look['pants']; p['p'] = [v * .74 for v in look['pants']]
    p['C'] = sh; p['c'] = [v * .8 for v in sh]; p['x'] = [v * .64 for v in sh]
    p['S'] = sk; p['s'] = [v * .86 for v in sk]; p['d'] = [v * .72 for v in sk]
    p['H'] = ha; p['h'] = [v * 1.15 for v in ha]; p['K'] = [30, 24, 26]
    p['Y'] = [236, 190, 50]; p['y'] = [190, 146, 40]
    return {k: [min(255, int(v)) for v in c] for k, c in p.items()}


def full_pal(key):
    """every letter a portrait may use: the person's game colours, a few shades between them for the face and
    hair, and the rifle's grey"""
    looks, _ = game_looks()
    p = person_pal(looks[key], game_humans()['pal'])
    p.update({
        'L': [v * 1.06 for v in p['S']],      # skin in full light
        'j': [v * .7 for v in p['H']],        # hair in the clefts between clumps
        'i': mix(p['h'], p['F'], .2),         # hair catching the light
        'e': p['F'],                          # the light in the eyes
        'n': mix(p['H'], p['s'], .45),        # skin showing through stubble at a hairline
        'u': [70, 70, 78],                    # dark metal: the rifle's grey (drawGun in src/actors.js)
    })
    return {k: [min(255, int(v)) for v in c] for k, c in p.items()}


def portrait(key):
    """rows and the palette of the letters they use"""
    pal, rows = full_pal(key), ROWS[key]
    assert len(rows) == 48 and all(len(r) == 48 for r in rows), key
    used = sorted(set(''.join(rows)) - {'.'})
    assert all(k in pal for k in used), (key, set(used) - set(pal))
    return rows, {k: pal[k] for k in used}


# ============================================================================ export
def export(path):
    data = {}
    for key in ROWS:
        rows, pal = portrait(key)
        data[key] = {'rows': rows, 'pal': pal}
    out = 'const ART_PORTRAITS = ' + json.dumps(data, separators=(',', ':')) + ';\n'
    with open(path, 'w') as fh:
        fh.write("'use strict';\n// crew portraits for the bunker game: 48x48 busts, rows of letters and each letter's colour "
                 "(made by tools/portraits.py)\n" + out)


# ============================================================================ check sheet (--sheet)
HEADGEAR = {'jiho': 'hardhat'}   # the miner's hard hat; the gunners start without a helmet


def ingame(key, hum, looks):
    """the person's standing front sprite (idle F frame 0, face and headgear stamped as drawPerson does)"""
    fr = hum['bodies']['human']['anims']['idle']['F'][0]
    grid = [list(r) for r in fr['rows']]
    hx, hy = fr['head']
    for st in (hum['heads'][key], hum['gear'].get(HEADGEAR.get(key))):
        for y, r in enumerate(st['F'] if st else []):
            for x, ch in enumerate(r):
                X, Y = hx - st['ax'] + x, hy - st['ay'] + y
                if ch != '.' and 0 <= X < 32 and 0 <= Y < 32:
                    grid[Y][X] = ch
    return [''.join(r) for r in grid], person_pal(looks[key], hum['pal'])


def sheet(path):
    from PIL import Image, ImageDraw, ImageFont
    looks, names = game_looks()
    hum = game_humans()
    try:
        font = ImageFont.truetype('/usr/share/fonts/opentype/unifont/unifont.otf', 16)
    except OSError:
        font = ImageFont.load_default()
    ink, muted, paper = (28, 27, 25), (139, 135, 127), (255, 255, 255)
    cols = [('게임 속', 4, 32), ('1×', 1, 48), ('2×', 2, 48), ('4×', 4, 48)]
    pad, gap, name_w, head_h, row_h = 24, 28, 44, 28, 192
    W = pad + name_w + sum(s * n for _, s, n in cols) + gap * (len(cols) - 1) + pad
    img = Image.new('RGB', (W, pad + head_h + len(ROWS) * (row_h + gap) - gap + pad), paper)
    d = ImageDraw.Draw(img)

    def paint(rows, pal, ox, oy, s):
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != '.':
                    d.rectangle([ox + x * s, oy + y * s, ox + (x + 1) * s - 1, oy + (y + 1) * s - 1], fill=tuple(pal[ch]))
    x = pad + name_w
    for label, s, n in cols:
        d.text((x, pad), label, font=font, fill=muted)
        x += s * n + gap
    for i, key in enumerate(ROWS):
        top = pad + head_h + i * (row_h + gap)
        d.text((pad, top + row_h // 2 - 8), names[key], font=font, fill=ink)
        x = pad + name_w
        for k, (label, s, n) in enumerate(cols):
            rows, pal = ingame(key, hum, looks) if k == 0 else portrait(key)
            paint(rows, pal, x, top + (row_h - s * n) // 2, s)
            x += s * n + gap
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return img.size


def main():
    export(os.path.join(GAME, 'art', 'portraits.js'))
    print('wrote art/portraits.js -', ', '.join(ROWS))
    if '--sheet' in sys.argv:
        print('wrote samples/portraits/sample.png', sheet(os.path.join(GAME, 'samples', 'portraits', 'sample.png')))


if __name__ == '__main__':
    main()
