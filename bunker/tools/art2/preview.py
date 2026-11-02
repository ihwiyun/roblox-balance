"""Enlarged check sheets: frames at N x with a pixel grid, labels, onion skins, line-ups."""
import numpy as np
from PIL import Image, ImageDraw

from core import PAL, to_rgba

BG = (86, 80, 96)          # neutral mid grey-violet: shows both dark outlines and light rims
BG2 = (96, 90, 106)
GRID = (70, 64, 80)
TXT = (235, 230, 220)


def checker(w, h, s, c1=BG, c2=BG2):
    img = Image.new('RGB', (w, h), c1)
    d = ImageDraw.Draw(img)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if ((x // s) + (y // s)) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=c2)
    return img


def enlarge(a, s=6, grid=True, bg=BG, marks=None):
    """a: palette-index array. marks: list of (x, y, rgb) single-pixel markers drawn as crosses."""
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


def contact(items, s=6, cols=8, title=None, grid=True, pad=6, label_h=12):
    """items: list of (label, array, marks)."""
    if not items:
        return Image.new('RGB', (10, 10), BG)
    cw = max(a.shape[1] for _, a, _ in items) * s
    ch = max(a.shape[0] for _, a, _ in items) * s
    rows = (len(items) + cols - 1) // cols
    top = 16 if title else 0
    W = cols * (cw + pad) + pad
    H = top + rows * (ch + pad + label_h) + pad
    img = Image.new('RGB', (W, H), (40, 36, 46))
    d = ImageDraw.Draw(img)
    if title:
        d.text((pad, 3), title, fill=TXT)
    for i, (lab, a, marks) in enumerate(items):
        x = pad + (i % cols) * (cw + pad)
        y = top + pad + (i // cols) * (ch + pad + label_h)
        e = enlarge(a, s, grid, marks=marks)
        img.paste(e, (x, y + label_h))
        d.text((x, y), lab, fill=TXT)
    return img


def onion(frames, s=6, alpha=0.28, ground=None):
    """Overlay of all frames: the current frame solid, others as tinted ghosts.
    Returns a strip: one panel per frame (frame i solid over all ghosts), plus a feet trace panel."""
    h, w = frames[0].shape
    panels = []
    for i, cur in enumerate(frames):
        base = Image.new('RGBA', (w, h), BG + (255,))
        for j, a in enumerate(frames):
            if j == i:
                continue
            g = to_rgba(a)
            arr = np.array(g).astype(np.float32)
            tint = np.array([120, 200, 255]) if j < i else np.array([255, 160, 120])
            arr[..., :3] = arr[..., :3] * 0.35 + tint * 0.65
            arr[..., 3] = arr[..., 3] * alpha
            base = Image.alpha_composite(base, Image.fromarray(arr.astype(np.uint8), 'RGBA'))
        base = Image.alpha_composite(base, to_rgba(cur))
        big = base.resize((w * s, h * s), Image.NEAREST).convert('RGB')
        d = ImageDraw.Draw(big)
        if ground is not None:
            d.line([(0, (ground + 1) * s - 1), (w * s, (ground + 1) * s - 1)], fill=(255, 230, 90))
        for x in range(0, w * s, s):
            d.line([(x, 0), (x, h * s)], fill=GRID)
        for y in range(0, h * s, s):
            d.line([(0, y), (w * s, y)], fill=GRID)
        panels.append(big)
    W = sum(p.width for p in panels) + 4 * (len(panels) + 1)
    out = Image.new('RGB', (W, h * s + 8), (40, 36, 46))
    x = 4
    for p in panels:
        out.paste(p, (x, 4))
        x += p.width + 4
    return out


def stack_v(imgs, pad=8, bg=(40, 36, 46)):
    W = max(i.width for i in imgs) + pad * 2
    H = sum(i.height for i in imgs) + pad * (len(imgs) + 1)
    out = Image.new('RGB', (W, H), bg)
    y = pad
    for i in imgs:
        out.paste(i, (pad, y))
        y += i.height + pad
    return out


def labelled(img, text, bg=(40, 36, 46)):
    out = Image.new('RGB', (max(img.width, 8 + 6 * len(text)), img.height + 14), bg)
    ImageDraw.Draw(out).text((2, 1), text, fill=TXT)
    out.paste(img, (0, 14))
    return out
