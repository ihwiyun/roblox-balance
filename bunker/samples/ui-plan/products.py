# Shop product pictures for the blueprint, placed pixel by pixel in the game's own colours: the icon palette of
# ../../art.js plus the grade colours of the UI (digits 0-7) for trims. 64x64 for the 다이아 packs, the step
# packages and the passes; 48x48 for the convenience items. Every object gets the icons' 1px dark outline and
# light from the top left.
# Run: python3 -I products.py   (writes img/prod-*.png beside it, and img/prod-sheet.png to look at them all)
import json, os, re
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ART = json.loads(re.search(r'const ART = (.*);\n', open(os.path.join(HERE, '..', '..', 'art.js')).read()).group(1))
PAL = dict(ART['iconPal'])
for i, h in enumerate(['#9a9a9a', '#4caf50', '#3d7be0', '#9b4fd1', '#f08a24', '#d63a3a', '#c99a10', '#e0459b']):
    PAL[str(i)] = [int(h[k:k + 2], 16) for k in (1, 3, 5)]
ICON = ART['icons']


class Art:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['.'] * w for _ in range(h)]

    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.g[y][x] = c

    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else '.'

    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.px(x, y, c)

    def hl(s, x0, x1, y, c): s.rect(x0, y, x1, y, c)

    def vl(s, x, y0, y1, c): s.rect(x, y0, x, y1, c)

    def line(s, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            s.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def ell(s, cx, cy, rx, ry, c):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    s.px(x, y, c)

    def poly(s, pts, c):
        ys = [p[1] for p in pts]
        for y in range(max(0, int(min(ys))), min(s.h, int(max(ys)) + 1)):
            yc, xs = y + .5, []
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
                if (y1 <= yc < y2) or (y2 <= yc < y1):
                    xs.append(x1 + (yc - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))):
                    s.px(x, y, c)

    def stamp(s, rows, x0, y0, swap=None):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.':
                    s.px(x0 + x, y0 + y, (swap or {}).get(ch, ch))
        return s

    def where(s, test, c):
        # recolour the pixels that pass test(x, y, colour)
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x] != '.' and test(x, y, s.g[y][x]):
                    s.g[y][x] = c
        return s

    def outline(s, c='o'):
        add = [(x, y) for y in range(s.h) for x in range(s.w) if s.g[y][x] == '.' and
               any(s.get(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in add:
            s.g[y][x] = c
        return s

    def paste(s, o, dx=0, dy=0):
        for y in range(o.h):
            for x in range(o.w):
                if o.g[y][x] != '.':
                    s.px(x + dx, y + dy, o.g[y][x])
        return s

    def png(s, path):
        im = Image.new('RGBA', (s.w, s.h), (0, 0, 0, 0))
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x] != '.':
                    im.putpixel((x, y), tuple(PAL[s.g[y][x]]) + (255,))
        im.save(path)
        return im


def layer(w, h, draw):
    a = Art(w, h)
    draw(a)
    return a.outline()


# ---------- small parts used across the pictures ----------
# a small cut diamond (as on the 다이아 icon) and a small ruby (as on the 보석 icon), 8x7, outlined
MINI_DIA = ['..oooo..', '.oWWLLo.', 'oWWWLLBo', 'oBBBBBBo', '.oWWLBo.', '..oWBo..', '...oo...']
MINI_RUBY = ['..oooo..', '.oWEERo.', 'oEEEERro', 'orrrrrro', '.oERRro.', '..oRro..', '...oo...']


def gems(a, spots, gem=MINI_DIA):
    # spots are drawn in order, back to front
    for x, y in spots:
        a.stamp(gem, x, y)


def heap(a, cx, base, rows, gem=MINI_DIA, dx=6, dy=4):
    # a mound of small gems: the bottom row widest, centred on cx with its bottom on base
    for r in range(rows):
        n = r + 1
        x0 = cx - (dx * (n - 1) + 8) // 2
        y = base - 7 - dy * (rows - 1 - r)
        for i in range(n):
            a.stamp(gem, x0 + i * dx, y)


def sparkle(a, x, y):
    a.px(x, y, 'W'); a.px(x - 1, y, 'L'); a.px(x + 1, y, 'L'); a.px(x, y - 1, 'L'); a.px(x, y + 1, 'L')


# ---------- 다이아 packs: pouch, sack, small chest, iron-bound chest, gold chest overflowing, open vault ----------
def pack1():
    a = Art(64, 64)
    def pouch(p):
        p.ell(32, 45, 13, 12, 'D')                   # the bag
        p.rect(26, 29, 37, 34, 'D')                  # its gathered neck
        p.ell(32, 28, 10, 3.5, 'd')                  # the open mouth
        p.where(lambda x, y, c: c == 'D' and (x - 32) + (y - 45) * .6 > 6, 'd')    # shade to the lower right
        p.where(lambda x, y, c: c == 'D' and (x - 32) + (y - 45) * .6 < -10, 'T')  # light on the upper left
        for x, y in [(22, 40), (22, 41), (23, 39), (24, 38)]:
            p.px(x, y, 'W')
        p.hl(26, 37, 32, 'R'); p.hl(26, 37, 33, 'r')   # the cord round the neck
        p.rect(36, 33, 37, 39, 'r'); p.px(36, 40, 'R')  # its loose end
        for x in range(27, 37, 3):
            p.px(x, 30, 'd'); p.px(x + 1, 35, 'd')        # gathers
    a.paste(layer(64, 64, pouch))
    gems(a, [(24, 21), (31, 19), (29, 24)])
    sparkle(a, 41, 19)
    return a


def pack2():
    a = Art(64, 64)
    def sack(p):
        p.ell(32, 46, 21, 15, 'C')                   # a full sack of cloth
        p.rect(20, 25, 44, 36, 'C')
        p.ell(32, 25, 13, 4, 'c')                    # the opening, folded back
        p.where(lambda x, y, c: c == 'C' and (x - 32) + (y - 46) * .5 > 9, 'c')
        p.where(lambda x, y, c: c == 'C' and (x - 32) + (y - 46) * .5 < -16, 'W')
        p.hl(19, 45, 29, 't'); p.hl(19, 45, 30, 't')  # the tie
        for x in range(23, 44, 4):                      # weave
            for y in range(40, 58, 4):
                if p.get(x, y) in 'Cc':
                    p.px(x, y, 'c')
    a.paste(layer(64, 64, sack))
    heap(a, 32, 28, 3)                                  # diamonds heaped in the mouth
    gems(a, [(46, 52), (9, 54)])                        # and two spilled on the ground
    sparkle(a, 44, 14)
    return a


def chest(w, body_h, lid_h, wood='D', dark='d', band='g', lit='G', trim=None, open_lid=False):
    # a chest seen from the front: a box with planks, metal bands and corners; the lid shut or thrown back
    a = Art(w + 2, body_h + lid_h + 12)
    top = 10 if open_lid else 1
    def body(p):
        p.rect(1, top + lid_h, w, top + lid_h + body_h - 1, wood)
        for y in range(top + lid_h + 4, top + lid_h + body_h - 1, 5):
            p.hl(2, w - 1, y, dark)                       # planks
        p.vl(w, top + lid_h, top + lid_h + body_h - 1, dark)
        p.hl(1, w, top + lid_h + body_h - 1, dark)
        for x in (4, w - 3):                              # metal straps
            p.rect(x - 1, top + lid_h, x + 1, top + lid_h + body_h - 1, band)
            p.vl(x - 1, top + lid_h, top + lid_h + body_h - 1, lit)
        if trim:
            p.hl(1, w, top + lid_h, trim); p.hl(1, w, top + lid_h + 1, trim)
    def lid(p):
        if open_lid:   # the lid thrown back: its inside shows, darker, above the box
            p.rect(3, 1, w - 2, top + lid_h - 1, dark)
            p.hl(3, w - 2, 1, wood)
            for x in (4, w - 3):
                p.rect(x - 1, 1, x + 1, top + lid_h - 1, band)
            if trim:
                p.hl(3, w - 2, top + lid_h - 1, trim)
        else:          # shut: a rounded top
            p.ell((w + 2) / 2, top + lid_h, w / 2, lid_h, wood)
            p.rect(1, top + lid_h - 1, w, top + lid_h, wood)
            p.where(lambda x, y, c: y > top + lid_h, '.')
            p.where(lambda x, y, c: c == wood and y < top + lid_h * .45, 'T' if wood == 'D' else lit)
            for x in (4, w - 3):
                for y in range(top, top + lid_h + 1):
                    if p.get(x, y) != '.':
                        p.px(x - 1, y, lit); p.px(x, y, band); p.px(x + 1, y, band)
            if trim:
                p.hl(1, w, top + lid_h, trim)
    a.paste(layer(a.w, a.h, lid))
    a.paste(layer(a.w, a.h, body))
    # the lock in the middle of the front
    cx = (w + 2) // 2
    a.rect(cx - 2, top + lid_h - 1, cx + 2, top + lid_h + 4, 'Y')
    a.rect(cx - 2, top + lid_h - 1, cx + 2, top + lid_h - 1, 'o'); a.rect(cx - 2, top + lid_h + 4, cx + 2, top + lid_h + 4, 'o')
    a.vl(cx - 3, top + lid_h - 1, top + lid_h + 4, 'o'); a.vl(cx + 3, top + lid_h - 1, top + lid_h + 4, 'o')
    a.px(cx, top + lid_h + 1, 'o'); a.px(cx, top + lid_h + 2, 'u'); a.px(cx - 1, top + lid_h, 'W')
    return a, top + lid_h   # and the height of the rim


def pack3():
    a = Art(64, 64)
    c, rim = chest(42, 20, 11)
    y0 = 64 - c.h + 2
    # the lid sits ajar: lift it and show the stones in the dark gap
    lid = Art(c.w, rim + 1)
    for y in range(rim + 1):
        lid.g[y] = c.g[y][:]
    for y in range(rim + 1):
        c.g[y] = ['.'] * c.w
    a.paste(c, 10, y0)
    a.rect(12, y0 + rim - 4, 51, y0 + rim, 'k')
    gems(a, [(17, y0 + rim - 7), (24, y0 + rim - 8), (31, y0 + rim - 7), (38, y0 + rim - 8)])
    a.paste(lid, 10, y0 - 6)
    gems(a, [(50, 55), (6, 56)])
    sparkle(a, 52, 18)
    return a


def pack4():
    a = Art(64, 64)
    c, rim = chest(44, 20, 9, band='k', lit='g', open_lid=True)
    y0 = 64 - c.h - 2
    a.paste(c, 9, y0)
    heap(a, 32, y0 + rim + 3, 4)                        # full to the rim
    # rivets on the iron bands
    for x in (12, 13 + 41):
        for y in range(y0 + rim + 3, y0 + rim + 19, 5):
            a.px(x, y, 'G')
    sparkle(a, 18, 18)
    return a


def pack5():
    a = Art(64, 64)
    c, rim = chest(46, 20, 9, wood='y', dark='u', band='Y', lit='W', open_lid=True)
    y0 = 64 - c.h - 1
    a.paste(c, 8, y0)
    heap(a, 32, y0 + rim + 4, 5)                        # heaped above the rim
    gems(a, [(4, 55), (10, 57), (50, 56), (56, 54), (44, 58)])   # spilling over the front
    a.stamp(ICON['diamond'], 24, y0 + rim - 22)         # one big stone on top
    sparkle(a, 47, 12); sparkle(a, 12, 20)
    return a


def pack6():
    a = Art(64, 64)
    def vault(p):
        p.rect(4, 6, 49, 59, 'g')                        # the vault in its wall
        p.rect(8, 10, 45, 55, 'k')                       # the open room
        for y in (24, 39):
            p.hl(9, 44, y, 'G'); p.hl(9, 44, y + 1, 'g')   # shelves
        p.hl(4, 49, 6, 'G'); p.vl(4, 6, 59, 'G')
    a.paste(layer(64, 64, vault))
    for y in (24, 39, 55):                              # stacks of diamonds on each shelf
        for x in range(10, 40, 7):
            a.stamp(MINI_DIA, x, y - 7)
    def door(p):                                        # the round door swung open to the right
        p.ell(54, 33, 8, 22, 'G')
        p.ell(54, 33, 6, 18, 'g')
        p.ell(54, 33, 3, 7, 'G')
        p.rect(53, 25, 55, 41, 'G')                      # the wheel's spokes
        p.rect(50, 32, 58, 34, 'G')
        p.where(lambda x, y, c: c == 'G' and x > 57, 'g')
    a.paste(layer(64, 64, door))
    sparkle(a, 30, 8)
    return a


# ---------- step packages: a crate per step, its trim in the weapon's grade colour, its contents in and beside it ----------
def rifle():
    # a rifle as the game draws it in the hands, larger: wooden stock, dark receiver with a scope, magazine, barrel
    def r(p):
        p.poly([(0, 4), (10, 3), (10, 8), (5, 9), (0, 11)], 'D')        # stock
        p.hl(1, 9, 4, 'T'); p.hl(1, 4, 9, 'd'); p.hl(1, 2, 10, 'd')
        p.rect(10, 3, 27, 7, 'g'); p.hl(10, 27, 3, 'G')                  # receiver
        p.rect(27, 4, 33, 6, 'k'); p.hl(27, 33, 4, 'g')                  # handguard
        p.rect(33, 5, 41, 5, 'k')                                         # barrel
        p.rect(40, 4, 40, 4, 'k')                                         # front sight
        p.rect(13, 0, 23, 1, 'k'); p.px(24, 1, 'B'); p.px(24, 0, 'L')     # scope and its lens
        p.rect(16, 2, 17, 2, 'k'); p.rect(20, 2, 21, 2, 'k')               # scope mounts
        p.rect(14, 8, 16, 11, 'k')                                        # grip
        p.rect(19, 8, 22, 10, 'k'); p.rect(20, 11, 23, 12, 'k')            # magazine, curving forward
    return layer(44, 15, r)


def tilt(a, k):
    # lean a picture up to the right: each k columns one pixel higher (whole pixels, nothing resampled)
    out = Art(a.w, a.h + a.w // k + 1)
    for y in range(a.h):
        for x in range(a.w):
            if a.g[y][x] != '.':
                out.px(x, y + a.w // k - x // k, a.g[y][x])
    return out


def crate(trim):
    # a supply crate seen from the front, open at the top: planks, corner posts, straps in the grade colour
    def c(p):
        p.rect(1, 3, 44, 24, 'D')
        p.rect(1, 0, 44, 3, 'd')                     # the dark inside, seen over the front edge
        for y in (9, 15, 21):
            p.hl(2, 43, y, 'd')                       # planks
        p.rect(1, 3, 4, 24, 'T'); p.rect(41, 3, 44, 24, 'd')   # corner posts, lit and shaded
        p.hl(1, 44, 4, trim); p.hl(1, 44, 5, trim)    # straps
        p.hl(1, 44, 19, trim); p.hl(1, 44, 20, trim)
        p.px(7, 4, 'W'); p.px(8, 4, 'W')
    return layer(46, 26, c)


def card(frame):
    # a crew card: framed in its grade colour, a survivor on it, a name plate
    def c(p):
        p.rect(0, 0, 17, 23, frame)
        p.rect(2, 2, 15, 19, 'C')
        p.rect(2, 20, 15, 21, frame)
    a = layer(18, 24, c)
    head = Art(16, 16).stamp(ICON['person'], 0, 0)
    for y in range(1, 15):          # the person icon, cropped to the card's window
        for x in range(1, 15):
            if head.g[y][x] != '.':
                a.px(x + 2, y + 5 - 2, head.g[y][x])
    return a


def relic_box():
    # a small relic chest: wood, a gold band and a pink stone
    def b(p):
        p.rect(0, 0, 11, 3, 'D'); p.hl(0, 11, 0, 'T')
        p.rect(0, 4, 11, 9, 'd'); p.hl(0, 11, 4, 'Y'); p.hl(0, 11, 5, 'y')
        p.rect(5, 3, 6, 6, 'P'); p.px(5, 3, 'W')
    return layer(12, 10, b)


def turret(trim):
    def t(p):
        p.line(11, 12, 3, 19, 'k'); p.line(11, 12, 19, 19, 'k'); p.vl(11, 12, 19, 'g')   # tripod
        p.rect(5, 5, 16, 10, 'g'); p.hl(5, 16, 5, 'G'); p.hl(5, 16, 10, trim)               # body
        p.rect(16, 6, 23, 7, 'k')                                                            # barrel
        p.rect(7, 2, 12, 4, 'G'); p.hl(7, 12, 2, 'W')                                        # shield
    return layer(25, 21, t)


def package(trim, extra):
    a = Art(64, 64)
    a.paste(tilt(rifle(), 4), 6, 14)        # the weapon, standing up out of the crate
    c = crate(trim)
    a.paste(c, 2, 64 - c.h - 2)
    extra(a)
    return a


def step1():
    return package('2', lambda a: heap(a, 52, 62, 3, MINI_RUBY))                       # 희귀 무기 + 보석


def step2():
    return package('3', lambda a: a.paste(card('2'), 44, 36))                            # 영웅 무기 + 희귀 동료 카드


def step3():
    return package('4', lambda a: (a.paste(relic_box(), 45, 40), a.paste(relic_box(), 50, 50)))   # 전설 무기 + 유물 상자


def step4():
    return package('4', lambda a: a.paste(turret('3'), 38, 41))                          # 전설 무기 + 영웅 터렛


def step5():
    return package('5', lambda a: a.paste(card('4'), 44, 36))                            # 불멸 무기 + 전설 동료 카드


def step6():
    return package('6', lambda a: [a.paste(relic_box(), x, y) for x, y in ((44, 30), (50, 40), (40, 42), (46, 51))])  # 신화 무기 + 유물 상자 30


PRODUCTS = {
    'dia-1': pack1, 'dia-2': pack2, 'dia-3': pack3, 'dia-4': pack4, 'dia-5': pack5, 'dia-6': pack6,
    'step-1': step1, 'step-2': step2, 'step-3': step3, 'step-4': step4, 'step-5': step5, 'step-6': step6,
}


def main():
    out = os.path.join(HERE, 'img')
    os.makedirs(out, exist_ok=True)
    ims = []
    for name, fn in PRODUCTS.items():
        ims.append((name, fn().png(os.path.join(out, f'prod-{name}.png'))))
    # a sheet to look at them all, at 3x on the blueprint's paper
    Z, pad = 3, 16
    cols = 6
    cw = 64 * Z + pad
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw + pad, rows * (64 * Z + 40) + pad), (246, 244, 239))
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(ims):
        x, y = pad + (i % cols) * cw, pad + (i // cols) * (64 * Z + 40)
        big = im.resize((im.width * Z, im.height * Z), Image.NEAREST)
        sheet.paste(big, (x + (64 * Z - big.width) // 2, y + (64 * Z - big.height)), big)
        d.text((x, y + 64 * Z + 6), name, fill=(28, 27, 25))
    sheet.save(os.path.join(out, 'prod-sheet.png'))
    print('ok', len(ims))


if __name__ == '__main__':
    main()
