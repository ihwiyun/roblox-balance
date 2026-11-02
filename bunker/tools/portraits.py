#!/usr/bin/env python3
"""Crew portraits, 48x48 busts, hand-placed pixels, for the bunker game.

Run from this folder:  python3 portraits.py          -> writes ../art/portraits.js
                       python3 portraits.py --sheet  -> also writes ../samples/portraits/sample.png
                                                        (needs Pillow: 1x 2x 4x next to the in-game sprite)
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
  ".........................HHHH...................",
  "...............HHHH...HHHHHHHHH.................",
  "............HHHHHHHHHHHHHHHHHHHHH...............",
  "...........HHHHHHHHHHHHHHHHHHHHHHHH.............",
  "..........HHHHHHHHHHHHHHHHHHHHHHHHHH............",
  ".........HHHHHHHHHHHHHHHHHHHHHHHHHHHH...........",
  ".........HHHHHHHHHHHHHHHHHHHHHHHHHHHHH..........",
  "........HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.........",
  "........HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH..........",
  "........HHHHHHHHHHHHHHHHHHHHHHHHHHHHH...........",
  "........HHHHHHHHHHHHHHHHHHHHHHHHHHHHH...........",
  "........HHHHHHHHHSSSSSSSSSSHHHHHHHHHH...........",
  "........HHHHHHHHSSSSSSSSSSSSHHHHHHHHH...........",
  "........HHHHHHHHSSSSSSSSSSSSSHHHHHHHH...........",
  "........HHHHHHHSSSSSSSSSSSSSSSHHHSSHH...........",
  "........HHHHHHHSSSKKKKSSSSSSSSKKKKSSS...........",
  "........HHHSSSSSSSSSSSSSSSSSSSSSSSSSS...........",
  "........HHHSSSSSSSSKKKSSSSSSSSKKSSSSS...........",
  "........HHHSSSSSSSSKKKSSSSSSSSKKSSSSS...........",
  "........HHHSSSSSSSSKKKSSSSSSSSKKSSSSS...........",
  "........HHHSSSSSSSSSSSSSSSSSSSSSSSSSS...........",
  "........HHHSSSSSSSSSSSSSSSSSSSSSSSSSS...........",
  "........HHHSSSSSSSSSSSSSSSSSSSSSSSSSS...........",
  "........HHHSSSSSSSSSSSSSSSSSSSSSSSSS............",
  ".........HHHSSSSSSSSSSSSmmmmSSSSSSSS............",
  "..........HHSSSSSSSSSSSSSSSSSSSSSSS.............",
  ".............SSSSSSSSSSSSSSSSSSSSS..............",
  "...............SSSSSSSSSSSSSSSSSS...............",
  ".................SSSSSSSSSSSSSS.................",
  "...............CCCCSSSSSSSSSCCCC................",
  "............CCCCCCCSSSSSSSSSCCCCCCC.............",
  ".........CCCCCCCCCCCCSSSSSCCCCCCCCCCCC..........",
  ".......CCCCCCCCCCCCCCCSSSCCCCCCCCCCCCCCC........",
  "......CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.......",
  ".....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC......",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
  "....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.....",
 ],
}


# ============================================================================ colours from the game
def game_looks():
    """LOOKS from src/config.js: key -> hair, skin, shirt, pants"""
    src = open(os.path.join(GAME, 'src', 'config.js'), encoding='utf-8').read()
    looks = {}
    for m in re.finditer(r"\{ key: '(\w+)'.*?hair: \[([\d, ]+)\], skin: \[([\d, ]+)\], shirt: \[([\d, ]+)\], pants: \[([\d, ]+)\]", src):
        looks[m.group(1)] = {k: [int(v) for v in m.group(i).split(',')] for i, k in ((2, 'hair'), (3, 'skin'), (4, 'shirt'), (5, 'pants'))}
    return looks


def game_humans():
    """ART_HUMANS from art/humans.js (the data the game draws)"""
    src = open(os.path.join(GAME, 'art', 'humans.js'), encoding='utf-8').read()
    body = src[src.index('{', src.index('ART_HUMANS')):src.rindex('}') + 1]
    body = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', body)
    return json.loads(re.sub(r',(\s*[}\]])', r'\1', body))


def person_pal(look, base):
    """one person's colours the way the game makes them (personPalette in src/sprites.js, no headgear)"""
    sh, sk, ha = look['shirt'], look['skin'], look['hair']
    p = {k: list(v) for k, v in base.items()}
    p['T'] = [v * 1.3 + 12 for v in sh]; p['t'] = [v * 1.06 for v in sh]
    p['P'] = look['pants']; p['p'] = [v * .74 for v in look['pants']]
    p['C'] = sh; p['c'] = [v * .8 for v in sh]; p['x'] = [v * .64 for v in sh]
    p['S'] = sk; p['s'] = [v * .86 for v in sk]; p['d'] = [v * .72 for v in sk]
    p['H'] = ha; p['h'] = [v * 1.15 for v in ha]; p['K'] = [30, 24, 26]
    return {k: [min(255, int(v)) for v in c] for k, c in p.items()}


def mix(a, b, k):
    return [a[i] + (b[i] - a[i]) * k for i in range(3)]


GUN = {'k': [46, 44, 50], 'q': [36, 36, 42], 'u': [70, 70, 78]}   # the rifle's colours (drawGun in src/actors.js)


def full_pal(key):
    """every letter a portrait may use: the person's game colours, a few shades between them for the face and
    hair, and the rifle's colours"""
    looks, hum = game_looks(), game_humans()
    p = person_pal(looks[key], hum['pal'])
    p.update({
        'L': [v * 1.06 for v in p['S']],      # skin in full light
        'r': mix(p['s'], p['m'], .35),        # lips
        'j': [v * .7 for v in p['H']],        # hair in the clefts between clumps
        'i': mix(p['h'], p['F'], .2),         # hair catching the light
        'e': p['F'],                          # the light in the eyes
        'n': mix(p['H'], p['s'], .45),        # skin showing through stubble at a hairline
    })
    p.update(GUN)
    return {k: [min(255, int(v)) for v in c] for k, c in p.items()}


def portrait(key):
    """rows and the palette of the letters they use"""
    pal = full_pal(key)
    rows = ROWS[key]
    used = sorted(set(''.join(rows)) - {'.'})
    return rows, {k: pal[k] for k in used}
