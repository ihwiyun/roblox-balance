"""All character frames. Poses are hand-placed 2D joints in the front view (facing down-right);
the back view is generated from the same pose by bake.humanoid."""
import json, math
from bake import humanoid, Spr, line, stamp, axis_stamp, outline, rows

# ---------- palettes (one letter per colour, per character type) ----------
BASEZ = {'o': [34, 26, 34], 'E': [255, 70, 46], 'M': [70, 22, 26], 'W': [226, 218, 192], 'B': [156, 36, 36], 'b': [104, 24, 28]}
PAL = {
 'walker':  {**BASEZ, 'S': [132, 174, 100], 's': [100, 138, 80], 'd': [76, 106, 64], 'H': [74, 60, 48], 'h': [50, 42, 36],
             'C': [126, 130, 156], 'c': [98, 100, 126], 'x': [72, 72, 94], 'P': [76, 82, 112], 'p': [54, 58, 82], 'F': [76, 60, 50], 'f': [52, 42, 36]},
 'runner':  {**BASEZ, 'S': [176, 182, 168], 's': [140, 146, 136], 'd': [108, 112, 106], 'H': [60, 54, 52], 'h': [40, 36, 36],
             'C': [214, 206, 180], 'c': [176, 166, 140], 'x': [130, 122, 104], 'P': [104, 84, 70], 'p': [76, 60, 52], 'F': [62, 52, 46], 'f': [44, 38, 34]},
 'brute':   {**BASEZ, 'S': [116, 160, 88], 's': [88, 124, 70], 'd': [66, 96, 56], 'H': [52, 58, 42], 'h': [36, 40, 30],
             'C': [96, 118, 150], 'c': [72, 90, 120], 'x': [56, 68, 92], 'P': [96, 118, 150], 'p': [70, 86, 112], 'F': [70, 54, 44], 'f': [48, 38, 32],
             'L': [150, 120, 70], 'K': [200, 196, 180]},
 'crawler': {**BASEZ, 'S': [156, 166, 124], 's': [124, 134, 98], 'd': [94, 102, 76], 'H': [44, 40, 34], 'h': [30, 28, 26],
             'C': [92, 108, 134], 'c': [70, 82, 104], 'x': [54, 62, 80], 'P': [86, 72, 62], 'p': [62, 52, 46], 'F': [62, 52, 46], 'f': [44, 38, 34]},
 'bloater': {**BASEZ, 'S': [180, 188, 110], 's': [146, 154, 86], 'd': [112, 118, 66], 'H': [70, 70, 50], 'h': [50, 50, 36],
             'C': [160, 150, 112], 'c': [128, 118, 88], 'x': [98, 90, 68], 'P': [90, 84, 76], 'p': [66, 62, 56], 'F': [62, 52, 46], 'f': [44, 38, 34],
             'Y': [206, 206, 120], 'y': [168, 168, 96], 'O': [222, 120, 76], 'R': [236, 120, 96]},
 'armored': {**BASEZ, 'S': [126, 166, 96], 's': [98, 134, 78], 'd': [74, 104, 62], 'H': [120, 128, 120], 'h': [86, 92, 86],
             'C': [92, 104, 78], 'c': [70, 80, 60], 'x': [54, 62, 46], 'P': [70, 76, 66], 'p': [52, 56, 50], 'F': [48, 44, 40], 'f': [36, 32, 30],
             'G': [140, 148, 140], 'g': [100, 106, 100]},
}
# the survivors keep the look of the very first version: olive striped shirt, dark trousers, light shoes
HUMAN_PAL = {'o': [30, 24, 26], 'C': [96, 116, 76], 'c': [74, 92, 58], 'x': [58, 72, 46], 'P': [62, 66, 84], 'p': [46, 48, 62],
             'F': [226, 220, 206], 'f': [176, 170, 158], 'S': [222, 172, 134], 's': [190, 140, 106], 'd': [160, 116, 88], 'L': [92, 70, 48],
             'V': [128, 112, 74], 'v': [98, 86, 56], 'T': [196, 168, 110], 't': [160, 134, 84]}

# ---------- part bitmaps ----------
KITS = {
 'walker': {
  'headF': ['.hHHH.', 'hHHHHH', 'HHSESE', 'HsSSSs', '.sSMMs', '..sWs.'],
  'headB': ['.hHHH.', 'HHHHHH', 'HHHhHH', 'sHHHHs', '.sHHs.', '..ss..'],
  'headDead': ['..hHH.', '.hHHHH', 'sSSSHH', 'EsSESH', 'sMMSsH', '.sss..'],
  'torsoF': ['cCCCCCc', 'cCCCBCc', '.cCCCBc', '.xCCCCc', '.cCSsC.', '.PPPPP.'],
  'torsoB': ['cCCCCCc', 'cCcCcCc', '.cCcCCc', '.xCcCCc', '.cCCcC.', '.PPPPP.'],
  'hand': ['S', 's'], 'handFar': ['d'], 'foot': ['FF', 'FFF'], 'footFar': ['ff', 'fff'],
  'sleeve': 'C', 'skin': 'S', 'sleeveFar': 'x', 'skinFar': 'd', 'pants': 'P', 'pantsFar': 'p', 'shoe': 'F', 'shoeFar': 'f',
  'armW': 2, 'foreW': 1, 'legW': 2, 'shinW': 2},
 'runner': {
  'headF': ['.hHS.', 'hSSSS', 'HSESE', 'sSSSs', '.SMMs', '..ss.'],
  'headB': ['.hHH.', 'hHHHH', 'HHhHs', 'sHHHs', '.sHs.', '..s..'],
  'headDead': ['.hHS.', 'sSSSH', 'ESESH', 'sMMsH', '.ss..'],
  'torsoF': ['SCCCCS', 'sCCBCs', '.CCCB.', '.CBCC.', '.cCCc.', '.PPPP.'],
  'torsoB': ['SCCCCS', 'sCCCCs', '.CCcC.', '.CCCC.', '.cCCc.', '.PPPP.'],
  'hand': ['S'], 'handFar': ['d'], 'foot': ['F', 'FF'], 'footFar': ['f', 'ff'],
  'sleeve': 'S', 'skin': 'S', 'sleeveFar': 'd', 'skinFar': 'd', 'pants': 'P', 'pantsFar': 'p', 'shoe': 'F', 'shoeFar': 'f',
  'armW': 1, 'foreW': 1, 'legW': 2, 'shinW': 1},
 'brute': {
  'headF': ['.hHHh.', 'hSSSSs', 'SSESEs', 'sMMMMs', '.sWWs.'],
  'headB': ['.hHHh.', 'hHHHHs', 'sHHHHs', 'sHHHHs', '.ssss.'],
  'headDead': ['.hHHh.', 'hSSSSs', 'sESESs', 'sMMMMs', '.ssss.'],
  'torsoF': ['.sSSSSSSs.', 'sSSLCCLSSs', 'sSCLCCLCSs', '.CCLCCLCC.', '.CCCCCCCC.', '.CCCBCCCC.', '.cCCCCCCc.', '.PPPPPPPP.'],
  'torsoB': ['.sSSSSSSs.', 'sSSLCCLSSs', 'sSSCLLCSSs', '.CCCLLCCC.', '.CCCCCCCC.', '.CCCCCCCC.', '.cCCCCCCc.', '.PPPPPPPP.'],
  'hand': ['SS', 'Ss'], 'handFar': ['dd', 'dd'], 'foot': ['FFF', 'FFFF'], 'footFar': ['fff', 'ffff'],
  'sleeve': 'S', 'skin': 'S', 'sleeveFar': 'd', 'skinFar': 'd', 'pants': 'P', 'pantsFar': 'p', 'shoe': 'F', 'shoeFar': 'f',
  'armW': 3, 'foreW': 2, 'legW': 3, 'shinW': 3},
 'crawler': {
  'headF': ['.hHH.', 'hHSSS', 'HSESE', 'sSMMs', '.sWs.'],
  'headB': ['.hHH.', 'hHHHH', 'HHHHs', 'sHHHs', '.ss..'],
  'headDead': ['.hHH.', 'hHSSS', 'HSESE', 'sSMMs', '.sss.'],
  'torsoF': ['cCCCCc', 'CCWCBC', 'CWCCCC', 'CCWCCc', '.BCCc.', '.bPP..'],
  'torsoB': ['cCCCCc', 'CCcCCC', 'CCCcCC', 'CCCCCc', '.cCCc.', '.bPP..'],
  'hand': ['S', 's'], 'handFar': ['d'], 'foot': ['F'], 'footFar': ['f'],
  'sleeve': 'C', 'skin': 'S', 'sleeveFar': 'x', 'skinFar': 'd', 'pants': 'P', 'pantsFar': 'p', 'shoe': 'F', 'shoeFar': 'f',
  'armW': 2, 'foreW': 1, 'legW': 2, 'shinW': 1},
 'bloater': {
  'headF': ['.SSO.', 'SSSSS', 'SESES', 'sSMSs', '.sss.'],
  'headB': ['.SSS.', 'SOSSS', 'SSSSs', 'sSSSs', '.sss.'],
  'headDead': ['.SSO.', 'SSSSS', 'SESES', 'sSMSs', '.sss.'],
  'torsoF': ['..cCCCCc..', '.cCCCCCCc.', 'cCYYYYYYCc', 'YYYYOYYYYy', 'YYOYYYYYYy', 'YYYYYYOYYy', 'yYYYYYYYyy', '.yYYOYYyy.', '..yyyyyy..', '...PPPP...'],
  'torsoB': ['..cCCCCc..', '.cCCCCCCc.', 'cCCCCCCCCc', 'CCCcCCCCCc', 'CCCCCCCCCc', 'CcCCCCCCCc', 'cCCCCCCCcc', '.cCCCCCcc.', '..cccccc..', '...PPPP...'],
  'torsoSwell': ['..cCCCCc..', '.cCRRRRCc.', 'cRRYYYYRRc', 'RYYYOYYYYR', 'YYOYYYYYYR', 'YYYYYYOYYR', 'RYYYYYYYRR', '.RYYOYYRR.', '..RRRRRR..', '...PPPP...'],
  'hand': ['S'], 'handFar': ['d'], 'foot': ['FF', 'FFF'], 'footFar': ['ff', 'fff'],
  'sleeve': 'S', 'skin': 'S', 'sleeveFar': 'd', 'skinFar': 'd', 'pants': 'P', 'pantsFar': 'p', 'shoe': 'F', 'shoeFar': 'f',
  'armW': 2, 'foreW': 2, 'legW': 2, 'shinW': 2},
}
KITS['armored'] = {**KITS['walker'],
  'headF': ['.gGGG.', 'gGGGGG', 'gGgggg', 'HsSESE', '.sSMMs', '..sWs.'],
  'headB': ['.gGGG.', 'gGGGGG', 'GGGgGG', 'gggggg', '.sSSs.', '..ss..'],
  'headDead': ['..gGG.', '.gGGGG', 'sSSSGG', 'EsSEgG', 'sMMSsg', '.sss..'],
  'torsoF': ['cCCCCCc', 'cCxCCxc', '.cCxCxc', '.xCCCCc', '.cxxxx.', '.PPPPP.'],
  'torsoB': ['cCCCCCc', 'cCCCCCc', '.cCCCCc', '.xCCCCc', '.cxxxx.', '.PPPPP.'],
}

# ---------- poses ----------
def knee(hp, ft, fwd=1, up=0):
    return ((hp[0] + ft[0]) / 2 + fwd, (hp[1] + ft[1]) / 2 - up)

def biped(hx, hy, lean, headDx, headDy, arms, feet, neckLen=5, headH=6, sh=((-1, 1), (2, 0)), hipW=1, kneeFwd=1):
    neck = (hx + lean, hy - neckLen)
    head = (neck[0] + headDx, neck[1] - headH + headDy)
    shL, shR = (neck[0] + sh[0][0], neck[1] + sh[0][1]), (neck[0] + sh[1][0], neck[1] + sh[1][1])
    (elL, haL), (elR, haR) = arms(shL, shR)
    ftL, ftR = feet
    hpL, hpR = (hx - hipW, hy + 1), (hx + hipW, hy + 1)
    return {'hip': (hx, hy), 'neck': neck, 'head': head, 'shL': shL, 'elL': elL, 'haL': haL, 'shR': shR, 'elR': elR, 'haR': haR,
            'hpL': hpL, 'knL': knee(hpL, ftL, kneeFwd), 'ftL': ftL, 'hpR': hpR, 'knR': knee(hpR, ftR, kneeFwd), 'ftR': ftR}

def add(p, d): return (p[0] + d[0], p[1] + d[1])

# a step cycle where the planted foot slides back evenly and the other swings through
def stride_feet(f, hx, base, reach, back, lift):
    pts = [(reach, back), (1, 0), (back, reach), (0, 1)]
    lifts = [(0, 0), (0, lift), (0, 0), (lift, 0)]
    a, b = pts[f]; la, lb = lifts[f]
    return (hx - 1 + a, base + 1 - la), (hx + 1 + b, base - lb)

def walker_frames(kit, W=18, H=20, ax=7):
    out = {}
    walk = []
    for f in range(4):
        bob = [0, -1, 0, -1][f]; hx, hy = ax, 12 + bob; sw = [0, 1, 0, -1][f]
        arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (6, 1 + sw))), (add(shR, (2, 1)), add(shR, (5, -sw))))
        walk.append(biped(hx, hy, 2, 1, 0, arms, stride_feet(f, hx, 17, 3, -2, 1)))
    out['walk'] = walk
    atk = []
    for f in range(3):
        hx, hy = ax + [0, 1, 0][f], 12
        lean = [0, 3, 2][f]
        if f == 0: arms = lambda shL, shR: ((add(shL, (0, -2)), add(shL, (2, -5))), (add(shR, (2, 1)), add(shR, (4, 2))))
        elif f == 1: arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (6, 4))), (add(shR, (3, 1)), add(shR, (5, 3))))
        else: arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (6, 2))), (add(shR, (2, 1)), add(shR, (5, 1))))
        atk.append(biped(hx, hy, lean, 1, 0, arms, ((ax + 3, 18), (ax - 2, 17))))
    out['attack'] = atk
    die = []
    # hit: thrown back, arms up
    die.append(biped(ax, 12, -1, 0, 0, lambda shL, shR: ((add(shL, (-1, -2)), add(shL, (0, -5))), (add(shR, (1, -2)), add(shR, (2, -5)))), ((ax + 1, 18), (ax - 1, 17))))
    # knees give, falling back
    die.append(biped(ax, 14, -3, -1, 1, lambda shL, shR: ((add(shL, (-2, -1)), add(shL, (-3, -3))), (add(shR, (0, -2)), add(shR, (0, -4)))), ((ax + 2, 18), (ax, 17)), neckLen=4))
    # lying on its back
    die.append({'hip': (ax + 1, 16), 'neck': (ax - 4, 16), 'head': (ax - 7, 13), 'dead': True,
                'shL': (ax - 4, 16), 'elL': (ax - 5, 18), 'haL': (ax - 7, 18), 'shR': (ax - 4, 15), 'elR': (ax - 5, 13), 'haR': (ax - 7, 13),
                'hpL': (ax + 1, 17), 'knL': (ax + 3, 16), 'ftL': (ax + 6, 17), 'hpR': (ax + 1, 16), 'knR': (ax + 4, 15), 'ftR': (ax + 6, 15)})
    die.append({**die[-1], 'elL': (ax - 5, 18), 'haL': (ax - 7, 18), 'knL': (ax + 3, 17), 'knR': (ax + 4, 16)})
    out['die'] = die
    return out

def runner_frames(kit, W=18, H=20, ax=7):
    out = {'walk': [], 'attack': [], 'die': []}
    for f in range(4):
        bob = [0, -1, 0, -1][f]; hx, hy = ax, 12 + bob
        pump = [1, 0, -1, 0][f]
        arms = lambda shL, shR, p=pump: ((add(shL, (1 - 2 * p, 2)), add(shL, (3 - 3 * p, 1))), (add(shR, (1 + 2 * p, 2)), add(shR, (3 + 3 * p, 1))))
        out['walk'].append(biped(hx, hy, 3, 2, 1, arms, stride_feet(f, hx, 17, 4, -3, 2), neckLen=5, headH=6))
    for f in range(3):
        hx, hy = ax + [0, 2, 1][f], 12
        if f == 0: arms = lambda shL, shR: ((add(shL, (1, -2)), add(shL, (3, -4))), (add(shR, (2, 1)), add(shR, (4, 1))))
        elif f == 1: arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (6, 3))), (add(shR, (3, 0)), add(shR, (6, 1))))
        else: arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (5, 2))), (add(shR, (2, 1)), add(shR, (5, 1))))
        out['attack'].append(biped(hx, hy, [2, 4, 3][f], 2, 1, arms, ((ax + 4, 18), (ax - 2, 17))))
    w = walker_frames(kit, W, H, ax)['die']
    out['die'] = w
    return out

def brute_frames(kit, W=24, H=24, ax=10):
    out = {'walk': [], 'attack': [], 'die': []}
    sh = ((-2, 2), (3, 1))
    for f in range(4):
        bob = [0, -1, 0, -1][f]; hx, hy = ax, 14 + bob; sw = [0, 1, 0, -1][f]
        arms = lambda shL, shR, s=sw: ((add(shL, (2, 3)), add(shL, (4, 6 + s))), (add(shR, (2, 3)), add(shR, (4, 5 - s))))
        out['walk'].append(biped(hx, hy, 2, 2, 1, arms, stride_feet(f, hx, 21, 3, -2, 1), neckLen=7, headH=5, sh=sh, hipW=2))
    for f in range(3):
        hx, hy = ax + [0, 1, 0][f], [14, 16, 15][f]
        if f == 0: arms = lambda shL, shR: ((add(shL, (1, -3)), add(shL, (3, -7))), (add(shR, (0, -3)), add(shR, (1, -7))))
        elif f == 1: arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (6, 5))), (add(shR, (3, 1)), add(shR, (5, 5))))
        else: arms = lambda shL, shR: ((add(shL, (2, 3)), add(shL, (5, 6))), (add(shR, (2, 3)), add(shR, (4, 5))))
        out['attack'].append(biped(hx, hy, [0, 3, 2][f], 2, 1, arms, ((ax + 3, 22), (ax - 3, 21)), neckLen=7, headH=5, sh=sh, hipW=2))
    out['die'].append(biped(ax, 14, -1, 1, 1, lambda shL, shR: ((add(shL, (-1, -3)), add(shL, (0, -6))), (add(shR, (1, -3)), add(shR, (2, -6)))), ((ax + 2, 22), (ax - 2, 21)), neckLen=7, headH=5, sh=sh, hipW=2))
    out['die'].append(biped(ax, 17, -3, 0, 1, lambda shL, shR: ((add(shL, (-2, -2)), add(shL, (-4, -4))), (add(shR, (0, -3)), add(shR, (0, -6)))), ((ax + 3, 22), (ax, 21)), neckLen=6, headH=5, sh=sh, hipW=2))
    lie = {'hip': (ax + 2, 20), 'neck': (ax - 5, 20), 'head': (ax - 9, 17), 'dead': True,
           'shL': (ax - 5, 21), 'elL': (ax - 7, 22), 'haL': (ax - 10, 22), 'shR': (ax - 5, 18), 'elR': (ax - 7, 16), 'haR': (ax - 9, 15),
           'hpL': (ax + 2, 21), 'knL': (ax + 5, 20), 'ftL': (ax + 8, 21), 'hpR': (ax + 2, 19), 'knR': (ax + 5, 18), 'ftR': (ax + 8, 19)}
    out['die'] += [lie, lie]
    return out

def bloater_frames(kit, W=20, H=22, ax=8):
    out = {'walk': [], 'attack': [], 'die': []}
    sh = ((-3, 2), (3, 1))
    for f in range(4):
        roll = [-1, 0, 1, 0][f]; hx, hy = ax + roll, 15
        arms = lambda shL, shR: ((add(shL, (-1, 3)), add(shL, (-1, 5))), (add(shR, (1, 3)), add(shR, (2, 5))))
        p = biped(hx, hy, 0, 0, 1, arms, stride_feet(f, ax, 19, 2, -1, 1), neckLen=9, headH=5, sh=sh, hipW=2)
        out['walk'].append(p)
    for f in range(3):
        arms = lambda shL, shR, f=f: ((add(shL, (-2, 1 - f)), add(shL, (-3, -1 - f))), (add(shR, (2, 1 - f)), add(shR, (3, -1 - f))))
        p = biped(ax, 15, 0, 0, 1, arms, ((ax + 1, 20), (ax - 1, 19)), neckLen=9, headH=5, sh=sh, hipW=2)
        p['swell'] = f >= 1
        out['attack'].append(p)
    out['die'] = out['attack'][2:] * 2
    return out

def crawler_frames(kit, W=24, H=14, ax=12):
    """flat on the ground: the hips trail behind, the arms drag the body forward"""
    out = {'walk': [], 'attack': [], 'die': []}
    for f in range(4):
        reachL = [5, 3, 1, 3][f]; reachR = [1, 3, 5, 3][f]
        hip, neck = (ax - 4, 10), (ax + 2, 9 - (f % 2))
        p = {'hip': hip, 'neck': neck, 'head': (neck[0] + 3, neck[1] - 5),
             'shL': (neck[0], neck[1] + 1), 'elL': (neck[0] + 2, neck[1] + 1), 'haL': (neck[0] + reachL + 1, 12),
             'shR': (neck[0] + 1, neck[1] - 1), 'elR': (neck[0] + 3, neck[1] - 1), 'haR': (neck[0] + reachR + 1, 11),
             'hpL': (hip[0], hip[1] + 1), 'knL': (hip[0] - 3, 12), 'ftL': (hip[0] - 7, 12), 'hpR': (hip[0], hip[1]), 'knR': (hip[0] - 3, 10), 'ftR': (hip[0] - 6, 11)}
        out['walk'].append(p)
    for f in range(3):
        rear = [2, 4, 1][f]
        hip, neck = (ax - 4, 10), (ax + 1, 9 - rear)
        p = {'hip': hip, 'neck': neck, 'head': (neck[0] + 3, neck[1] - 5),
             'shL': (neck[0], neck[1] + 1), 'elL': (neck[0] + 2, neck[1] + [-2, 1, 1][f]), 'haL': (neck[0] + [3, 6, 5][f], neck[1] + [-4, 3, 4][f]),
             'shR': (neck[0] + 1, neck[1]), 'elR': (neck[0] + 3, neck[1] + 2), 'haR': (neck[0] + 4, 12),
             'hpL': (hip[0], hip[1] + 1), 'knL': (hip[0] - 3, 12), 'ftL': (hip[0] - 7, 12), 'hpR': (hip[0], hip[1]), 'knR': (hip[0] - 3, 10), 'ftR': (hip[0] - 6, 11)}
        out['attack'].append(p)
    flat = {**out['walk'][0], 'neck': (ax + 2, 11), 'head': (ax + 5, 7), 'haL': (ax + 6, 12), 'haR': (ax + 5, 12), 'dead': True}
    out['die'] = [out['walk'][0], flat, flat]
    return out

# ---------- survivors (bodies only: heads are drawn at runtime so every person has their own face) ----------
HUMAN = {
 'headF': ['.....'], 'headB': ['.....'],
 'torsoF': ['cCCCCCc', 'xCCCCCC', 'xcccccc', '.CCCCCC', '.CCCCC.', '.LLLLL.'],
 'torsoB': ['cCCCCCc', 'CCCCCCx', 'ccccccx', 'CCCCCC.', '.CCCCC.', '.LLLLL.'],
 'hand': ['S'], 'handFar': ['d'], 'foot': ['FF', 'FFF'], 'footFar': ['ff', 'fff'],
 'sleeve': 'C', 'skin': 'S', 'sleeveFar': 'x', 'skinFar': 'd', 'pants': 'P', 'pantsFar': 'p', 'shoe': 'F', 'shoeFar': 'f',
 'armW': 2, 'foreW': 1, 'legW': 2, 'shinW': 2,
}
HUMAN_VEST = {**HUMAN,
 'torsoF': ['cVVCVVc', 'xVVVVVC', 'xvVVVVc', '.VVLVVC', '.vVVVV.', '.LLLLL.'],
 'torsoB': ['cVVVVVc', 'VVVVVVx', 'vVVVVVx', 'VVVVVV.', '.vVVVV.', '.LLLLL.'],
}
def human_frames(ax=7):
    out = {}
    stand = ((ax + 2, 18), (ax - 1, 17))
    # rifle at the shoulder: right hand at the grip, left hand forward on the handguard
    def aim(rec=0):
        arms = lambda shL, shR: ((add(shL, (2, 1)), add(shL, (4 - rec, 1))), (add(shR, (2, 1)), add(shR, (5 - rec, 1))))
        p = biped(ax - rec, 12, 1 - rec, 1, 0, arms, stand, neckLen=5, headH=5)
        p['gun'] = (add(p['shL'], (0 - rec, 0)), add(p['shL'], (9 - rec, 1)))
        return p
    out['aim'] = [aim(0), aim(1)]
    # reload: rifle tipped up, left hand to the belt pouch for a magazine, back to the rifle
    rl = []
    for f in range(3):
        if f == 0: arms = lambda shL, shR: ((add(shL, (2, 0)), add(shL, (3, -2))), (add(shR, (1, 2)), add(shR, (0, 5))))
        elif f == 1: arms = lambda shL, shR: ((add(shL, (2, 0)), add(shL, (3, -2))), (add(shR, (2, 1)), add(shR, (3, 0))))
        else: arms = lambda shL, shR: ((add(shL, (2, 1)), add(shL, (4, 0))), (add(shR, (2, 1)), add(shR, (4, 0))))
        p = biped(ax, 12, 0, 1, 0, arms, stand, neckLen=5, headH=5)
        p['gun'] = [(add(p['shL'], (0, 1)), add(p['shL'], (6, -6))), (add(p['shL'], (0, 1)), add(p['shL'], (6, -6))), (add(p['shL'], (0, 0)), add(p['shL'], (8, -3)))][f]
        p['mag'] = [None, add(p['shR'], (3, 0)), None][f]
        rl.append(p)
    out['reload'] = rl
    walk = []
    for f in range(4):
        bob = [0, -1, 0, -1][f]; sw = [1, 0, -1, 0][f]
        arms = lambda shL, shR, s=sw: ((add(shL, (s, 3)), add(shL, (2 * s, 5))), (add(shR, (-s, 3)), add(shR, (-2 * s, 5))))
        walk.append(biped(ax, 12 + bob, 0, 1, 0, arms, stride_feet(f, ax, 17, 3, -2, 1), neckLen=5, headH=5))
    out['walk'] = walk
    climb = []
    for f in range(2):
        up = [(0, -3), (0, -1)][f]; dn = [(0, -1), (0, -3)][f]
        arms = lambda shL, shR: ((add(shL, (1, -2 + up[1] + 2)), add(shL, (1, -4 + up[1]))), (add(shR, (-1, -2 + dn[1] + 2)), add(shR, (-1, -4 + dn[1]))))
        p = biped(ax, 12, 0, 0, 0, arms, ((ax - 1, 18 - 2 * f), (ax + 1, 16 + 2 * f)), neckLen=5, headH=5)
        climb.append(p)
    out['climb'] = climb
    # farming: crouch and reach to the plants
    farm = []
    for f in range(2):
        arms = lambda shL, shR, f=f: ((add(shL, (3, 1 + f)), add(shL, (5, 2 + 2 * f))), (add(shR, (3, 1)), add(shR, (5, 1 + f))))
        farm.append(biped(ax, 13 + f, 2 + f, 1, 0, arms, ((ax + 2, 18), (ax - 2, 17)), neckLen=5, headH=5))
    out['farm'] = farm
    # pickaxe: lift high, swing, bite
    mine = []
    for f in range(3):
        if f == 0: arms = lambda shL, shR: ((add(shL, (-1, -2)), add(shL, (-1, -5))), (add(shR, (-1, -2)), add(shR, (-1, -4))))
        elif f == 1: arms = lambda shL, shR: ((add(shL, (2, -2)), add(shL, (4, -3))), (add(shR, (2, -1)), add(shR, (4, -2))))
        else: arms = lambda shL, shR: ((add(shL, (3, 1)), add(shL, (5, 3))), (add(shR, (3, 1)), add(shR, (5, 3))))
        p = biped(ax + [0, 1, 1][f], 12 + [0, 0, 1][f], [-1, 1, 3][f], 1, 0, arms, ((ax + 3, 18), (ax - 2, 17)), neckLen=5, headH=5)
        p['pick'] = [(add(p['haL'], (0, 0)), add(p['haL'], (-1, -6))), (add(p['haL'], (0, 0)), add(p['haL'], (5, -4))), (add(p['haL'], (0, 0)), add(p['haL'], (6, 3)))][f]
        mine.append(p)
    out['mine'] = mine
    return out

# ---------- bake everything ----------
def bake_set(kit, frames, W, H, ax, ay):
    res = {}
    for anim, poses in frames.items():
        res[anim] = {}
        for view in ('F', 'B'):
            lst = []
            for p in poses:
                k = dict(kit)
                if p.get('dead'): k['headF'] = kit.get('headDead', kit['headF']); k['headB'] = k['headF']
                if p.get('swell'): k['torsoF'] = kit['torsoSwell']; k['torsoB'] = kit['torsoSwell']
                back = view == 'B' and not p.get('dead')
                r = humanoid(k, p, back=back, w=W, h=H)
                meta = {}
                q = p if not back else {kk: ((W - 1 - v[0], v[1]) if isinstance(v, tuple) and len(v) == 2 and isinstance(v[0], (int, float)) else v) for kk, v in p.items()}
                for key in ('head', 'gun', 'mag', 'pick'):
                    v = q.get(key) if key != 'gun' and key != 'pick' else p.get(key)
                    if v is None: continue
                    if key in ('gun', 'pick'):
                        a, b = v
                        if back: a, b = (W - 1 - a[0], a[1]), (W - 1 - b[0], b[1])
                        meta[key] = [a[0], a[1], b[0], b[1]]
                    else: meta[key] = [v[0], v[1]]
                lst.append({'rows': r, **meta})
            res[anim][view] = lst
    return {'w': W, 'h': H, 'ax': ax, 'ay': ay, 'anims': res}

OUT = {
 'walker': bake_set(KITS['walker'], walker_frames(KITS['walker']), 18, 20, 7, 18),
 'armored': bake_set(KITS['armored'], walker_frames(KITS['armored']), 18, 20, 7, 18),
 'runner': bake_set(KITS['runner'], runner_frames(KITS['runner']), 18, 20, 7, 18),
 'brute': bake_set(KITS['brute'], brute_frames(KITS['brute']), 24, 24, 10, 22),
 'bloater': bake_set(KITS['bloater'], bloater_frames(KITS['bloater']), 20, 22, 8, 20),
 'crawler': bake_set(KITS['crawler'], crawler_frames(KITS['crawler']), 24, 14, 10, 12),
 'human': bake_set(HUMAN, human_frames(), 18, 20, 7, 18),
 'humanVest': bake_set(HUMAN_VEST, human_frames(), 18, 20, 7, 18),
}
json.dump({'sprites': OUT, 'pal': PAL, 'humanPal': HUMAN_PAL}, open('sprites.json', 'w'))
# preview sheets
for name in OUT:
    items = []
    pal = PAL.get(name, HUMAN_PAL) if name not in ('human', 'humanVest') else HUMAN_PAL
    for anim, views in OUT[name]['anims'].items():
        for view, lst in views.items():
            for n, fr in enumerate(lst): items.append({'name': f'{anim}{view}{n}', 'rows': fr['rows']})
    json.dump({'palette': pal, 'items': items}, open(f'prev_{name}.json', 'w'))
print('baked', {k: sum(len(l) for v in o['anims'].values() for l in v.values()) for k, o in OUT.items()})
