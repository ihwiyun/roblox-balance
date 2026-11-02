#!/usr/bin/env python3
"""Scale stand-in for the roof: the current game's 32x32 SD survivor, remapped to Resurrect 64.

The new survivors are drawn by another tool (tools/art2). Until they exist, the base sample uses this
figure only to prove that a 32x32 SD person fits the roof. Run once to refresh standin.json:
    python3 -B standin.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '..'))

from pal import COLORS  # noqa: E402


def nearest(rgb):
    return min(range(64), key=lambda i: sum((a - b) ** 2 * w for a, b, w in zip(rgb, COLORS[i], (3, 4, 2))))


def main():
    import humans32 as H
    data = H.build_all()
    body = data['bodies']['human']
    out = {'w': body['w'], 'h': body['h'], 'ax': body['ax'], 'ay': body['ay'], 'frames': {}}
    looks = {'hero': None, 'minjun': 'helmet', 'seoyeon': 'cap'}
    for look, gear in looks.items():
        pal = H.TEST_LOOKS[look]
        for anim in ('aim', 'idle'):
            fr = body['anims'][anim]['F'][0]
            g = H.figure(data, fr, 'F', look, gear)
            rows = [[255] * body['w'] for _ in range(body['h'])]
            for (x, y), ch in g.items():
                if 0 <= x < body['w'] and 0 <= y < body['h']:
                    col = pal.get(ch) or H.PAL.get(ch)
                    rows[y][x] = nearest(tuple(col))
            out['frames']['%s_%s' % (look, anim)] = rows
    with open(os.path.join(HERE, 'standin.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote standin.json', list(out['frames']))


if __name__ == '__main__':
    main()
