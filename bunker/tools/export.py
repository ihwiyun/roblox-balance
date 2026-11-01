# Run from this folder: python3 sprites.py && python3 icons.py && python3 export.py  (writes ../art.js)
import json, os
sp = json.load(open('sprites.json')); ic = json.load(open('icons.json'))
# survivor heads: front faces down-right, back shows the back of the head; drawn at runtime per person
HEADS = {
 'short':  {'F': ['.HHH.', 'HHHHH', 'HSKSK', '.SSSs', '..Ss.'], 'B': ['.HHH.', 'HHHHH', 'HHHHH', 'sHHHs', '.sS..']},
 'buzz':   {'F': ['.hhh.', 'hhSSS', 'hSKSK', '.SSSs', '..Ss.'], 'B': ['.hhh.', 'hhhhh', 'hhhhh', 'shhhs', '.sS..']},
 'long':   {'F': ['.HHH.', 'HHHHH', 'HHKSK', 'HHSSs', 'H.Ss.'], 'B': ['.HHH.', 'HHHHH', 'HHHHH', 'HHHHH', 'H.H.H']},
 'beard':  {'F': ['.SSS.', 'SSSSS', 'SSKSK', '.HHHH', '..HH.'], 'B': ['.SSS.', 'SSSSS', 'SSSSS', 'sSSSs', '.HH..']},
 'cap':    {'F': ['.AAA.', 'AAAAAA', 'HSKSK', '.SSSs', '..Ss.'], 'B': ['.AAA.', 'AAAAA', 'AAAAA', 'HHHHH', '.sS..']},
 'helmet': {'F': ['.GGG.', 'GGGGGg', 'gSKSK', '.SSSs', '..Ss.'], 'B': ['.GGG.', 'GGGGG', 'GgGGG', 'ggggg', '.sS..']},
 'hardhat':{'F': ['.YYY.', 'YYYYYy', 'HSKSK', '.SSSs', '..Ss.'], 'B': ['.YYY.', 'YYYYY', 'YyYYY', 'HHHHH', '.sS..']},
 'sleep':  {'F': ['.HHS..', 'HHSSSs', '.HSSs.'], 'B': ['.HHS..', 'HHSSSs', '.HSSs.']},
}
out = 'const ART = ' + json.dumps({'sprites': sp['sprites'], 'pal': sp['pal'], 'humanPal': sp['humanPal'], 'heads': HEADS,
                                    'icons': {it['name']: it['rows'] for it in ic['items']}, 'iconPal': ic['palette']}, separators=(',', ':')) + ';\n'
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art.js'), 'w').write("'use strict';\n// pixel art for the bunker game: character frames baked from hand-drawn parts and hand-placed joints, survivor heads, UI icons\n" + out)
print(len(out))
