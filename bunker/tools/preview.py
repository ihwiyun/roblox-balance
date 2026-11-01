# renders pixel stamps/icons from a JSON dump to an enlarged sheet so they can be checked by eye
import json, sys
from PIL import Image, ImageDraw
data = json.load(open(sys.argv[1]))
scale = int(sys.argv[3]) if len(sys.argv) > 3 else 8
items = data['items']
pal = {k: tuple(v) for k, v in data['palette'].items()}
pad = 2
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
cellw = max(len(r) for it in items for r in it['rows']) + pad * 2
cellh = max(len(it['rows']) for it in items) + pad * 2 + 3
rows = (len(items) + cols - 1) // cols
img = Image.new('RGB', (cols * cellw * scale, rows * cellh * scale), (236, 232, 222))
d = ImageDraw.Draw(img)
for n, it in enumerate(items):
    cx, cy = (n % cols) * cellw, (n // cols) * cellh
    p = dict(pal); p.update({k: tuple(v) for k, v in it.get('palette', {}).items()})
    for y, row in enumerate(it['rows']):
        for x, ch in enumerate(row):
            if ch == '.': continue
            c = p.get(ch, (255, 0, 255))
            d.rectangle([(cx + pad + x) * scale, (cy + pad + y) * scale, (cx + pad + x + 1) * scale - 1, (cy + pad + y + 1) * scale - 1], fill=c)
img.save(sys.argv[2]); print(img.size)
