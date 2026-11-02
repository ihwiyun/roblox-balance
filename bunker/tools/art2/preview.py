"""Enlarged check sheets: frames at N x with a pixel grid, labels, marks, onion skins, line-ups and
note rows ("grip and pose verified: ..."). Only reads finished frames; never draws art."""
import textwrap

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from core import to_rgba

BG = (86, 80, 96)          # neutral mid grey-violet: shows dark outlines and light rims
GRID = (72, 66, 82)
SHEET = (34, 30, 40)
TXT = (235, 230, 220)
DIM = (170, 164, 180)
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 11)
    FONT_B = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
except OSError:                       # pragma: no cover
    FONT = FONT_B = ImageFont.load_default()


def enlarge(a, s=6, grid=True, bg=BG, marks=None):
    """a: palette-index array. marks: list of (x, y, rgb) pixel markers (box + cross)."""
    h, w = a.shape
    img = Image.new('RGB', (w * s, h * s), bg)
    rgba = to_rgba(a).resize((w * s, h * s), Image.NEAREST)
    img.paste(rgba, (0, 0), rgba)
    d = ImageDraw.Draw(img)
    if grid and s >= 4:
        for x in range(0, w * s, s):
            d.line([(x, 0), (x, h * s)], fill=GRID)
        for y in range(0, h * s, s):
            d.line([(0, y), (w * s, y)], fill=GRID)
    for (mx, my, col) in (marks or []):
        cx, cy = mx * s + s // 2, my * s + s // 2
        d.rectangle([mx * s, my * s, mx * s + s - 1, my * s + s - 1], outline=col)
        d.line([(cx - s, cy), (cx + s, cy)], fill=col)
        d.line([(cx, cy - s), (cx, cy + s)], fill=col)
    return img


def contact(items, s=6, cols=8, title=None, grid=True, pad=6, label_h=14):
    """items: list of (label, array, marks)."""
    cw = max(a.shape[1] for _, a, _ in items) * s
    ch = max(a.shape[0] for _, a, _ in items) * s
    rows = (len(items) + cols - 1) // cols
    top = 20 if title else 0
    W = min(cols, len(items)) * (cw + pad) + pad
    H = top + rows * (ch + pad + label_h) + pad
    img = Image.new('RGB', (W, H), SHEET)
    d = ImageDraw.Draw(img)
    if title:
        d.text((pad, 3), title, fill=TXT, font=FONT_B)
    for i, (lab, a, marks) in enumerate(items):
        x = pad + (i % cols) * (cw + pad)
        y = top + pad + (i // cols) * (ch + pad + label_h)
        img.paste(enlarge(a, s, grid, marks=marks), (x, y + label_h))
        d.text((x, y), lab, fill=TXT, font=FONT)
    return img


def notes_panel(lines, width, title='grip and pose verified'):
    """A text row under a strip: wraps each line to the panel width."""
    cpl = max(20, (width - 16) // 7)
    wrapped = []
    for ln in lines:
        wrapped += textwrap.wrap(ln, cpl) or ['']
    H = 22 + 14 * len(wrapped) + 6
    img = Image.new('RGB', (width, H), (46, 42, 54))
    d = ImageDraw.Draw(img)
    d.text((8, 4), title, fill=(255, 214, 120), font=FONT_B)
    for i, ln in enumerate(wrapped):
        d.text((8, 22 + 14 * i), ln, fill=TXT, font=FONT)
    return img


def onion(frames, s=6, alpha=0.30, ground=None, foot_marks=None):
    """One panel per frame: the frame solid over tinted ghosts of all others (earlier = blue,
    later = orange). ground: y row of the soles; foot_marks: per-frame list of (x, y) planted-foot
    pixels, drawn as yellow boxes so a sliding foot shows up as a drifting box."""
    h, w = frames[0].shape
    panels = []
    for i, cur in enumerate(frames):
        base = Image.new('RGBA', (w, h), BG + (255,))
        for j, a in enumerate(frames):
            if j == i:
                continue
            arr = np.array(to_rgba(a)).astype(np.float32)
            tint = np.array([120, 200, 255]) if j < i else np.array([255, 160, 120])
            arr[..., :3] = arr[..., :3] * 0.35 + tint * 0.65
            arr[..., 3] = arr[..., 3] * alpha
            base = Image.alpha_composite(base, Image.fromarray(arr.astype(np.uint8), 'RGBA'))
        base = Image.alpha_composite(base, to_rgba(cur))
        big = base.resize((w * s, h * s), Image.NEAREST).convert('RGB')
        d = ImageDraw.Draw(big)
        for x in range(0, w * s, s):
            d.line([(x, 0), (x, h * s)], fill=GRID)
        for y in range(0, h * s, s):
            d.line([(0, y), (w * s, y)], fill=GRID)
        if ground is not None:
            d.line([(0, (ground + 1) * s - 1), (w * s, (ground + 1) * s - 1)], fill=(255, 230, 90))
        if foot_marks and foot_marks[i]:
            for (fx, fy) in foot_marks[i]:
                d.rectangle([fx * s, fy * s, fx * s + s - 1, fy * s + s - 1], outline=(255, 240, 60), width=2)
        d.text((3, 2), str(i), fill=(255, 255, 255), font=FONT)
        panels.append(big)
    W = sum(p.width for p in panels) + 4 * (len(panels) + 1)
    out = Image.new('RGB', (W, h * s + 8), SHEET)
    x = 4
    for p in panels:
        out.paste(p, (x, 4))
        x += p.width + 4
    return out


def strip(frames, s=1, pad=2, bg=BG):
    """Frames side by side at s x without grid (for 1x / 3x line-ups)."""
    h = max(a.shape[0] for a in frames)
    W = sum(a.shape[1] * s + pad for a in frames) + pad
    out = Image.new('RGB', (W, h * s + 2 * pad), bg)
    x = pad
    for a in frames:
        im = to_rgba(a).resize((a.shape[1] * s, a.shape[0] * s), Image.NEAREST)
        out.paste(im, (x, pad + (h - a.shape[0]) * s), im)
        x += a.shape[1] * s + pad
    return out


def lineup(figs, s, ground_pad=4, bg=BG, gap=6):
    """figs: list of arrays, all standing on one ground line (bottom-aligned)."""
    h = max(a.shape[0] for a in figs)
    W = sum(a.shape[1] for a in figs) * s + gap * (len(figs) + 1)
    out = Image.new('RGB', (W, h * s + ground_pad * 2), bg)
    x = gap
    for a in figs:
        im = to_rgba(a).resize((a.shape[1] * s, a.shape[0] * s), Image.NEAREST)
        out.paste(im, (x, ground_pad + (h - a.shape[0]) * s), im)
        x += a.shape[1] * s + gap
    return out


def stack_v(imgs, pad=8, bg=SHEET):
    W = max(i.width for i in imgs) + pad * 2
    H = sum(i.height for i in imgs) + pad * (len(imgs) + 1)
    out = Image.new('RGB', (W, H), bg)
    y = pad
    for i in imgs:
        out.paste(i, (pad, y))
        y += i.height + pad
    return out


def stack_h(imgs, pad=8, bg=SHEET):
    W = sum(i.width for i in imgs) + pad * (len(imgs) + 1)
    H = max(i.height for i in imgs) + pad * 2
    out = Image.new('RGB', (W, H), bg)
    x = pad
    for i in imgs:
        out.paste(i, (x, pad))
        x += i.width + pad
    return out


def labelled(img, text, bg=SHEET):
    out = Image.new('RGB', (max(img.width, 10 + 8 * len(text)), img.height + 20), bg)
    ImageDraw.Draw(out).text((2, 2), text, fill=TXT, font=FONT_B)
    out.paste(img, (0, 20))
    return out
