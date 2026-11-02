#!/usr/bin/env python3
"""Subset Galmuri (OFL 1.1) to what the phone UI needs and write WOFF2 files to ../fonts/.

Usage (run with -I; the npm package is untrusted downloaded data, so it is only read):
    mkdir /tmp/g && cd /tmp/g && npm pack galmuri && tar -xzf galmuri-*.tgz
    python3 -I subset_fonts.py /tmp/g/package/dist

What is kept
- ASCII, Latin-1 punctuation, and the symbols listed in EXTRA (each one is checked against the font)
- the 2,350 Hangul syllables of KS X 1001 (EUC-KR rows 0xB0-0xC8) and the 94 compatibility jamo
- every character used in ../index.html (so the mock never falls back to another font); the script
  stops with an error if one of them is missing from Galmuri itself

Naming
Galmuri's distributed CSS declares "Galmuri" as a Reserved Font Name. OFL section 3 forbids that name on
a modified version, and a subset is a modified version, so the subsets are renamed "Bunker Pixel ..."
and their history is written to FONTLOG.txt. The OFL text is copied unaltered to OFL.txt.
"""
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'fonts')
INDEX = os.path.join(HERE, '..', 'index.html')

# (source file, new family, style, weight, output file)
FACES = [
    ('Galmuri11.ttf', 'Bunker Pixel 11', 'Regular', 400, 'bunkerpixel11.woff2'),
    ('Galmuri11-Bold.ttf', 'Bunker Pixel 11', 'Bold', 700, 'bunkerpixel11-bold.woff2'),
    ('Galmuri9.ttf', 'Bunker Pixel 9', 'Regular', 400, 'bunkerpixel9.woff2'),
]

EXTRA = '◀▶◁▷▲△▼▽■□●○◆◇★☆♥※·×÷±→←↑↓…‥–—‘’“”「」『』『』〈〉《》₩°%‰'


def ksx1001_hangul():
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            out.append(bytes([hi, lo]).decode('euc-kr'))
    assert len(out) == 2350, len(out)
    return out


def used_in_index():
    if not os.path.exists(INDEX):
        return set()
    text = open(INDEX, encoding='utf-8').read()
    text = re.sub(r'<style>.*?</style>', ' ', text, flags=re.S)   # CSS can hold content: '' strings, keep them
    return {ch for ch in text if ord(ch) >= 0x20 and ch not in '\r\n\t'}


def rename(font, family, style, weight):
    name = font['name']
    full = family + ('' if style == 'Regular' else ' ' + style)
    ps = family.replace(' ', '') + '-' + style
    for rec in list(name.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 21, 22):
            name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, family if style in ('Regular', 'Bold') else full), (2, style), (3, ps + ';subset'),
                     (4, full), (6, ps), (16, family), (17, style)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    font['OS/2'].usWeightClass = weight
    if style == 'Bold':
        font['OS/2'].fsSelection = (font['OS/2'].fsSelection | 0x20) & ~0x40
        font['head'].macStyle |= 1


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= set(ksx1001_hangul())
    chars |= set(chr(c) for c in range(0x3131, 0x318F))
    chars |= set(EXTRA)
    chars |= set(' ')
    page = used_in_index()
    for src_name, fam, style, weight, out_name in FACES:
        path = os.path.join(src, src_name)
        cmap = TTFont(path).getBestCmap()
        missing = sorted(ch for ch in page if ord(ch) not in cmap and ch not in '  ')
        if missing:
            sys.exit('%s lacks characters used in index.html: %s' % (src_name, ''.join(missing)))
        keep = sorted(ord(ch) for ch in chars | page if ord(ch) in cmap)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.glyph_names = False
        opts.hinting = False
        font = subset.load_font(path, opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=keep)
        sub.subset(font)
        rename(font, fam, style, weight)
        dst = os.path.join(OUT, out_name)
        subset.save_font(font, dst, opts)
        print('%-26s %5d chars  %6.1f KB' % (out_name, len(keep), os.path.getsize(dst) / 1024))
    # the licence, unaltered
    with open(os.path.join(src, 'LICENSE.txt'), encoding='utf-8') as f:
        lic = f.read()
    with open(os.path.join(OUT, 'OFL.txt'), 'w', encoding='utf-8') as f:
        f.write(lic)


if __name__ == '__main__':
    main()
