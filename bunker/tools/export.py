# Run from this folder: python3 icons.py && python3 export.py  (writes ../art.js)
# Characters live in ../art/ (humans32.py, zombiesA.py, zombiesB.py); art.js only holds the UI icons.
import json, os
ic = json.load(open('icons.json'))
out = 'const ART = ' + json.dumps({'icons': {it['name']: it['rows'] for it in ic['items']}, 'iconPal': ic['palette']}, separators=(',', ':')) + ';\n'
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art.js'), 'w').write("'use strict';\n// pixel art for the bunker game: the UI icons of the panel, tabs and buttons (made by tools/icons.py)\n" + out)
print(len(out))
