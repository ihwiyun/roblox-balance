#!/usr/bin/env python3
"""Render the makeshift-era base sample: Lv1, Lv11, Lv21 at 1x and 4x, and a check sheet.

    python3 -B bunker/tools/base2/render.py

Writes to bunker/samples/base/:
  base_lv01_1x.png  base_lv11_1x.png  base_lv21_1x.png     270 x 196, the game's internal pixels
  base_lv01_4x.png  base_lv11_4x.png  base_lv21_4x.png     1080 x 784, as on a 1080 px phone (k = 4)
  base_check.png    the three steps side by side, bunker close-ups, the 32x32 survivor scale strip,
                    and the palette with every colour the art uses marked
Every pixel is checked against the 64 colours of bunker/art/resurrect-64.hex before anything is saved.
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)

import numpy as np                      # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import bunker                           # noqa: E402
from pal import CLEAR, COLORS           # noqa: E402

OUT = os.path.join(HERE, '..', '..', 'samples', 'base')
FONTS = os.path.join(HERE, '..', '..', 'samples', 'ui', 'fonts')
LEVELS = (1, 11, 21)
WHITE = (255, 255, 255)
INK = COLORS[0]


def font(name, size):
    """the UI's Galmuri subset (woff2) as a PIL font; one font pixel = 1 image pixel at `size`"""
    from fontTools.ttLib import TTFont
    f = TTFont(os.path.join(FONTS, name))
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


def check_palette(a):
    used = set(np.unique(a).tolist()) - {CLEAR}
    bad = [i for i in used if not 0 <= i < 64]
    assert not bad, bad
    return used


def text(d, xy, s, f, fill=INK):
    d.fontmode = '1'                    # no anti-aliasing: the pixel font stays on its grid
    d.text(xy, s, font=f, fill=fill)


def main():
    os.makedirs(OUT, exist_ok=True)
    renders, used = {}, set()
    for lv in LEVELS:
        cv = bunker.scene(lv)
        used |= check_palette(cv.a)
        im = cv.rgba(1, WHITE).convert('RGB')
        renders[lv] = im
        im.save(os.path.join(OUT, 'base_lv%02d_1x.png' % lv))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(OUT, 'base_lv%02d_4x.png' % lv))
    # every saved pixel must be one of the 64 palette colours (or the white page)
    pal = set(COLORS) | {WHITE}
    for lv, im in renders.items():
        cols = {c for _, c in im.getcolors(1 << 16)}
        assert cols <= pal, (lv, cols - pal)

    f12 = font('bunkerpixel11.woff2', 12)
    f12b = font('bunkerpixel11-bold.woff2', 12)
    f10 = font('bunkerpixel9.woff2', 10)
    W, H = renders[1].size
    S2 = 2
    pad = 16
    crop = (60, 4, 212, 118)            # the bunker, its yard and the Lv21 workshop
    cw, ch = (crop[2] - crop[0]) * 4, (crop[3] - crop[1]) * 4
    col_w = max(W * S2, cw)
    sheet_w = pad + 3 * (col_w + pad)
    top = 52
    sheet_h = top + H * S2 + 24 + ch + 40 + 140 + pad
    sheet = Image.new('RGB', (sheet_w, sheet_h), WHITE)
    d = ImageDraw.Draw(sheet)
    text(d, (pad, 10), '임시 시대 기지 견본 · 1칸 = 게임 1px (1080px 폰에서 4배)', f12b)
    names = {1: 'Lv 1 · 모래주머니와 판자', 11: 'Lv 11 · 보강, 지붕 기둥', 21: 'Lv 21 · 확장, 첫 터렛 칸, 수리 작업장'}
    for i, lv in enumerate(LEVELS):
        x = pad + i * (col_w + pad)
        text(d, (x, top - 18), names[lv], f12)
        sheet.paste(renders[lv].resize((W * S2, H * S2), Image.NEAREST), (x, top))
        c = renders[lv].crop(crop).resize((cw, ch), Image.NEAREST)
        y = top + H * S2 + 24
        text(d, (x, y - 14), '4배 확대', f10, COLORS[2])
        sheet.paste(c, (x, y))
    # scale strip: the 32x32 survivor at 4x next to a 32 px ruler, and the wall heights
    y0 = top + H * S2 + 24 + ch + 40
    text(d, (pad, y0 - 12), '축척: 32×32 사람(4배)과 지붕 높이', f10, COLORS[2])
    import json
    si = json.load(open(os.path.join(HERE, 'standin.json')))
    fr = np.array(si['frames']['hero_idle'], np.uint8)
    lut = np.zeros((256, 3), np.uint8)
    for i, c in enumerate(COLORS):
        lut[i] = c
    lut[CLEAR] = WHITE
    man = Image.fromarray(lut[fr], 'RGB').resize((128, 128), Image.NEAREST)
    sheet.paste(man, (pad, y0 + 4))
    d.rectangle((pad + 136, y0 + 4, pad + 139, y0 + 4 + 127), fill=COLORS[2])
    for k, (lv, hgt) in enumerate(((1, 17), (11, 27), (21, 29))):
        x = pad + 160 + k * 60
        d.rectangle((x, y0 + 4 + 128 - hgt * 4, x + 11, y0 + 4 + 127), fill=COLORS[3])
        text(d, (x - 2, y0 + 4 + 128 - hgt * 4 - 14), 'Lv%d' % lv, f10)
        text(d, (x + 14, y0 + 124), '%dpx' % hgt, f10, COLORS[2])
    # palette: all 64, used ones marked
    px0 = pad + 380
    text(d, (px0, y0 - 12), '팔레트 Resurrect 64 · 점 = 이 그림이 쓴 색 (%d/64)' % len(used), f10, COLORS[2])
    for i, c in enumerate(COLORS):
        x = px0 + (i % 16) * 22
        y = y0 + 8 + (i // 16) * 22
        d.rectangle((x, y, x + 19, y + 19), fill=c, outline=INK)
        if i in used:
            d.rectangle((x + 7, y + 7, x + 12, y + 12), fill=WHITE if sum(c) < 380 else INK)
    sheet.save(os.path.join(OUT, 'base_check.png'))
    print('wrote', sorted(os.listdir(OUT)), 'colours used:', len(used))


if __name__ == '__main__':
    main()
