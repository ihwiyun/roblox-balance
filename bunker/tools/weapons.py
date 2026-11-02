"""The 40 weapons (8 grades x 5 slots): card art drawn by hand, one character per pixel.

Every card is 64x32, side view, muzzle to the right. Each grid below is the finished card: the rows were placed
pixel by pixel (outline, then the masses, then the shading, then the highlights; light from the top left). Nothing
here draws a shape for itself: the exporter only reads the rows, checks them and writes them out.

  '.'  nothing
  '@'  the muzzle point (nothing is drawn there): the first pixel past the bore on the bore line, where the flash
       starts (the same rule as the in-hand sprites)
  any other character: a colour. A few letters mean the same thing on every card (ink, steel, rust, brass ...);
  the digits and a b c take the grade's materials and accent:
    1-4  the grade's main material, light to dark   (rusty scrap, blued steel, black, black, lab white,
                                                      alien obsidian, gold, cosmic indigo)
    5-8  the grade's second material, light to dark (old wood, walnut, olive drab, tan, graphite,
                                                      alien silver, ebony, pearl)
    a-c  the grade's accent, glow to dark, from the UI grade colour (index.html .g0-.g7)

Slots: 1 pistol, 2 SMG/rifle, 3 shotgun, 4 sniper, 5 heavy/special (src/logic/gear.mjs FAMILIES).
Grades: scrap -> civilian -> military issue -> special forces -> experimental -> unknown tech -> mythic -> eternal.

The in-hand look: the game draws the gun in the hands from the attack level (src/actors.js gunLook/drawGun,
names from src/config.js weaponLookName). Each weapon names the level whose look is closest ('lv'); 'need' says
what a new in-hand look would have to show later (empty when the existing one already fits).

  python3 tools/weapons.py            writes art/weapons.js (ART_WEAPONS) and samples/weapons/sheet.png
  python3 tools/weapons.py --first8   also writes samples/weapons/first8.png (slot 2 of every grade)
"""
import json
import os
import re
import sys

W, H = 64, 32
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.abspath(os.path.join(HERE, '..'))

# ----------------------------------------------------------------------------------------------- colours
# the same on every card. Ink is the outline of the game's people (art/humans.js 'o'); steel, rust, brass and
# red sit next to the game's icon colours (tools/icons.py)
BASE = {
    'o': [30, 24, 26],                                                   # ink
    'k': [58, 52, 62],                                                   # a hole, a slot, the inside of a bore
    'w': [252, 250, 240],                                                # a glint
    'S': [204, 206, 212], 's': [150, 154, 164], 'z': [102, 104, 116],    # bare steel
    'R': [196, 110, 62], 'r': [136, 72, 48], 'q': [226, 158, 98],        # rust
    'Y': [240, 202, 98], 'y': [180, 132, 56],                            # brass
    'E': [222, 84, 56], 'e': [156, 48, 40],                              # red
    'G': [178, 212, 236], 'g': [66, 82, 116],                            # glass
    'H': [242, 204, 64], 'h': [178, 140, 40],                            # hazard yellow
}
# each grade's materials (1-4, 5-8) and accent (a-c). The accent's middle step is the UI grade colour
GRADE_PAL = [
    {  # 일반: worn grey scrap steel, old wood, grey duct tape and wire
        '1': [186, 182, 174], '2': [146, 142, 138], '3': [110, 106, 106], '4': [76, 72, 74],
        '5': [190, 150, 100], '6': [152, 112, 74], '7': [114, 82, 56], '8': [80, 58, 44],
        'a': [212, 212, 206], 'b': [154, 154, 154], 'c': [112, 112, 114]},
    {  # 고급: blued steel, walnut, green
        '1': [160, 174, 196], '2': [108, 118, 142], '3': [74, 80, 102], '4': [48, 50, 68],
        '5': [216, 152, 92], '6': [174, 108, 62], '7': [130, 76, 46], '8': [90, 52, 38],
        'a': [170, 232, 150], 'b': [76, 175, 80], 'c': [44, 118, 56]},
    {  # 희귀: matte black, olive drab, blue
        '1': [118, 118, 126], '2': [84, 84, 92], '3': [62, 62, 70], '4': [44, 44, 50],
        '5': [140, 150, 98], '6': [108, 118, 78], '7': [82, 90, 62], '8': [60, 66, 48],
        'a': [164, 204, 255], 'b': [61, 123, 224], 'c': [40, 78, 158]},
    {  # 영웅: black, tan (FDE), purple
        '1': [122, 122, 132], '2': [86, 86, 96], '3': [62, 62, 70], '4': [44, 44, 50],
        '5': [220, 194, 142], '6': [186, 156, 108], '7': [148, 118, 82], '8': [106, 84, 62],
        'a': [228, 182, 255], 'b': [155, 79, 209], 'c': [98, 46, 148]},
    {  # 전설: lab white, graphite, orange glow
        '1': [252, 250, 244], '2': [226, 224, 218], '3': [184, 182, 180], '4': [132, 130, 136],
        '5': [116, 118, 128], '6': [88, 90, 102], '7': [64, 66, 78], '8': [46, 48, 58],
        'a': [255, 236, 170], 'b': [240, 138, 36], 'c': [180, 84, 26]},
    {  # 불멸: alien obsidian, alien silver, red glow
        '1': [164, 144, 186], '2': [108, 92, 130], '3': [74, 62, 96], '4': [48, 40, 66],
        '5': [226, 224, 236], '6': [180, 176, 198], '7': [132, 128, 156], '8': [90, 86, 114],
        'a': [255, 184, 166], 'b': [214, 58, 58], 'c': [140, 30, 46]},
    {  # 신화: gold, ebony, golden glow
        '1': [255, 246, 190], '2': [242, 206, 90], '3': [201, 154, 16], '4': [140, 98, 22],
        '5': [100, 78, 92], '6': [74, 56, 72], '7': [54, 40, 56], '8': [38, 28, 40],
        'a': [255, 252, 220], 'b': [255, 220, 100], 'c': [214, 162, 32]},
    {  # 영원: cosmic indigo, pearl, the rainbow (E Y L B V on these cards) and its pink
        '1': [134, 124, 214], '2': [84, 76, 156], '3': [54, 48, 110], '4': [34, 30, 70],
        '5': [250, 248, 255], '6': [218, 214, 244], '7': [170, 164, 212], '8': [118, 112, 172],
        'a': [255, 186, 222], 'b': [224, 69, 155], 'c': [150, 40, 110],
        'E': [224, 69, 69], 'Y': [240, 176, 32], 'L': [69, 192, 112], 'B': [69, 144, 224], 'V': [160, 80, 224]},
]
# a few cards need a colour of their own (a fire extinguisher's red, a dragon's gem ...): (grade, slot) -> colours
OWN = {}

# the UI grade colours (index.html .g0-.g7), for the frames of the check sheets
GRADE_UI = ['#9a9a9a', '#4caf50', '#3d7be0', '#9b4fd1', '#f08a24', '#d63a3a', '#c99a10', '#e0459b']
RAINBOW = ['#e04545', '#f0b020', '#45c070', '#4590e0', '#a050e0']
GRADE_NAMES = ['일반', '고급', '희귀', '영웅', '전설', '불멸', '신화', '영원']
SLOT_NAMES = ['권총', '기관단총·소총', '산탄', '저격', '중화기·특수']


def weapon_names():
    """WEAPON_NAMES from src/logic/gear.mjs (read only), 8 grades x 5"""
    src = open(os.path.join(GAME, 'src', 'logic', 'gear.mjs'), encoding='utf-8').read()
    block = re.search(r'const WEAPON_NAMES = \[(.*?)\n\];', src, re.S).group(1)
    rows = [re.findall(r"'([^']+)'", ln) for ln in block.strip().split('\n')]
    assert len(rows) == 8 and all(len(r) == 5 for r in rows), rows
    return rows


# ----------------------------------------------------------------------------------------------- in-hand looks
# the look names the game shows for an attack level (src/config.js WEAPONS, weaponFamily, weaponLookName)
LOOK_FAMILIES = ['볼트액션 소총', '반자동 소총', '돌격소총', '경기관총', '대물 저격총', '레일건']


def look_name(lv):
    fam = LOOK_FAMILIES[min(5, lv // 8)]
    paint = '발광 ' if lv >= 80 else '금장 ' if lv >= 60 else '위장 ' if lv >= 48 else ''
    return paint + fam + ('+' if (lv // 4) % 2 else '')


# (grade, slot) -> (the attack level whose in-hand look is closest, what a new in-hand look would need)
LOOKS = {
    (0, 0): (0, '권총 손 모습 없음: 실린더가 보이는 짧은 리볼버, 두 손 파지'),
    (0, 1): (8, ''),
    (0, 2): (0, '산탄총 손 모습 없음: 굵은 파이프 총열과 판자 개머리'),
    (0, 3): (0, ''),
    (0, 4): (8, '못총: 몸통이 큰 공구형, 비스듬한 못 탄창'),
    (1, 0): (8, '권총 손 모습 없음: 짧은 자동권총'),
    (1, 1): (8, '나무 개머리·앞손잡이(지금은 나무가 볼트액션에만 있음)'),
    (1, 2): (4, '펌프 산탄총: 펌프를 앞뒤로 미는 손'),
    (1, 3): (4, '나무 개머리에 조준경(지금은 조준경이 검은 총에만 있음)'),
    (1, 4): (8, '화염기: 빨간 탱크와 노즐, 총구 대신 불꽃'),
    (2, 0): (8, '권총 손 모습 없음: 군용 자동권총'),
    (2, 1): (16, ''),
    (2, 2): (8, '산탄총: 굵은 총열, 옆구리 탄피'),
    (2, 3): (32, ''),
    (2, 4): (24, ''),
    (3, 0): (14, '권총 손 모습 없음: 긴 탄창과 앞손잡이'),
    (3, 1): (20, '소음기 단 짧은 소총(지금 소음기는 대물 저격총부터)'),
    (3, 2): (20, '산탄총: 드럼 탄창'),
    (3, 3): (36, ''),
    (3, 4): (28, '유탄발사기: 회전 탄창과 굵은 총열'),
    (4, 0): (80, '권총 손 모습 없음: 주황 발광'),
    (4, 1): (80, '발광색이 하늘색 대신 주황'),
    (4, 2): (80, '산탄총: 넓은 방사구'),
    (4, 3): (40, ''),
    (4, 4): (28, '미니건: 총열 묶음이 도는 모습'),
    (5, 0): (80, '권총 손 모습 없음: 빨간 발광, 떠 있는 고리'),
    (5, 1): (80, '발광색이 빨강'),
    (5, 2): (80, '산탄총: 갈라진 총구'),
    (5, 3): (80, '발광색이 빨강, 시계 고리'),
    (5, 4): (80, '테슬라 포: 코일과 번개'),
    (6, 0): (60, '권총 손 모습 없음: 금장'),
    (6, 1): (60, '용머리 총구'),
    (6, 2): (60, '산탄총: 금장 쌍열'),
    (6, 3): (60, '창날 총구'),
    (6, 4): (60, '개틀링: 금장 총열 묶음'),
    (7, 0): (80, '권총 손 모습 없음: 무지개 발광'),
    (7, 1): (80, '발광색이 무지개'),
    (7, 2): (80, '산탄총: 별 폭발 총구'),
    (7, 3): (80, '검은 구체와 무지개 고리'),
    (7, 4): (80, '큰 포: 무지개 포구'),
}

# ----------------------------------------------------------------------------------------------- the cards
# (grade, slot) -> 32 rows of 64
GRIDS = {
# --- GRIDS BEGIN ---
# --- GRIDS END ---
}


def rows_of(text):
    return [r.strip() for r in text.strip('\n').split('\n')]


def card(g, n):
    """the rows (muzzle mark removed), the muzzle point and the colours the card uses"""
    rows = rows_of(GRIDS[(g, n)])
    assert len(rows) == H and all(len(r) == W for r in rows), ((g, n), len(rows), sorted({len(r) for r in rows}))
    marks = [(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == '@']
    assert len(marks) == 1, ((g, n), marks)
    mx, my = marks[0]
    # the muzzle point is free, with the gun's muzzle face just behind it on the bore line
    assert mx > 0 and rows[my][mx - 1] not in '.@', ((g, n), 'muzzle not at the gun', marks)
    rows = [r.replace('@', '.') for r in rows]
    pal = {**BASE, **GRADE_PAL[g], **OWN.get((g, n), {})}
    used = sorted(set(''.join(rows)) - {'.'})
    missing = [ch for ch in used if ch not in pal]
    assert not missing, ((g, n), missing)
    return rows, [mx, my], {ch: pal[ch] for ch in used}


def entries():
    names = weapon_names()
    out = []
    for g in range(8):
        for n in range(5):
            rows, muzzle, pal = card(g, n)
            lv, need = LOOKS[(g, n)]
            out.append({'name': names[g][n], 'grade': g, 'w': W, 'h': H, 'rows': rows, 'pal': pal, 'muzzle': muzzle,
                        'look': {'lv': lv, 'name': look_name(lv), 'need': need}})
    return out


def export(path):
    data = entries()
    body = ',\n'.join(json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in data)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write("'use strict';\n// the 40 weapons' card art, indexed like src/logic/gear.mjs WEAPONS (grade * 5 + slot): w x h rows of "
                 "letters and each letter's colour, the muzzle point, and the closest in-hand look (attack level for "
                 "src/actors.js gunLook; 'need' = what a new in-hand look would show). Made by tools/weapons.py\n"
                 'const ART_WEAPONS = [\n' + body + '\n];\n')
    return len(data)


# ----------------------------------------------------------------------------------------------- check sheets
def _rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def _font(size=16):
    from PIL import ImageFont
    for f in ('/usr/share/fonts/opentype/unifont/unifont.otf',):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def _frame(dr, x0, y0, x1, y1, g, k=2):
    """a slot frame in the grade colour (the rainbow runs left to right, as in the game)"""
    if g == 7:
        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1, x1 - x0) * (len(RAINBOW) - 1)
            i = min(len(RAINBOW) - 2, int(t))
            a, b = _rgb(RAINBOW[i]), _rgb(RAINBOW[i + 1])
            c = tuple(round(a[j] + (b[j] - a[j]) * (t - i)) for j in range(3))
            dr.rectangle([x, y0, x, y0 + k - 1], fill=c)
            dr.rectangle([x, y1 - k + 1, x, y1], fill=c)
        dr.rectangle([x0, y0, x0 + k - 1, y1], fill=_rgb(RAINBOW[0]))
        dr.rectangle([x1 - k + 1, y0, x1, y1], fill=_rgb(RAINBOW[-1]))
    else:
        dr.rectangle([x0, y0, x1, y1], outline=_rgb(GRADE_UI[g]), width=k)


def _stamp(img, rows, pal, x0, y0, s):
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                dr.rectangle([x0 + x * s, y0 + y * s, x0 + x * s + s - 1, y0 + y * s + s - 1], fill=tuple(pal[ch]))


def sheet(path, keys=None, cols=5, s=3):
    """the cards at s x on the slot colour, framed in their grade colour and labelled. keys: (grade, slot) list"""
    from PIL import Image, ImageDraw
    names = weapon_names()
    keys = keys or [(g, n) for g in range(8) for n in range(5)]
    font, small = _font(16), _font(16)
    pad, lab, head = 8, 22, 26
    cw, ch = W * s + 2 * pad, H * s + 2 * pad
    left = 64 if keys == [(g, n) for g in range(8) for n in range(5)] else 0
    nrows = (len(keys) + cols - 1) // cols
    img = Image.new('RGB', (left + cols * (cw + 8) + 8, head + nrows * (ch + lab + 10) + 8), (255, 255, 255))
    dr = ImageDraw.Draw(img)
    if left:
        for n in range(5):
            dr.text((left + 8 + n * (cw + 8) + 4, 4), f'{n + 1} {SLOT_NAMES[n]}', fill=(139, 135, 127), font=small)
    for k, (g, n) in enumerate(keys):
        cx, cy = left + 8 + (k % cols) * (cw + 8), head + (k // cols) * (ch + lab + 10)
        if left and k % cols == 0:
            dr.text((6, cy + ch // 2 - 8), GRADE_NAMES[g], fill=_rgb(GRADE_UI[g]) if g < 7 else _rgb('#a050e0'), font=font)
        dr.rectangle([cx, cy, cx + cw - 1, cy + ch - 1], fill=(246, 244, 239))
        _frame(dr, cx, cy, cx + cw - 1, cy + ch - 1, g)
        rows, muzzle, pal = card(g, n)
        _stamp(img, rows, pal, cx + pad, cy + pad, s)
        label = names[g][n] if left else f'{GRADE_NAMES[g]} · {names[g][n]}'
        dr.text((cx + 2, cy + ch + 3), label, fill=(28, 27, 25), font=font)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return img.size


if __name__ == '__main__':
    n = export(os.path.join(GAME, 'art', 'weapons.js'))
    out = os.path.join(GAME, 'samples', 'weapons')
    print('art/weapons.js', n, 'sheet', sheet(os.path.join(out, 'sheet.png')))
    if '--first8' in sys.argv:
        print('first8', sheet(os.path.join(out, 'first8.png'), [(g, 1) for g in range(8)], cols=4))
