#!/usr/bin/env python3
"""Write bunker/audio/LICENSES.md from catalog.json + sources.json.

Usage:  python3 -I make_licenses.py <audio-dir> [<licence-check.json>]

One block per source page (title, author, page URL, direct file URL + SHA-256, licence with the CC0 deed link, date
retrieved, the author's own notice) and, under it, every file made from it with the edits process.py applied.  Generated
sounds (tools/synth.mjs, no samples) get their own block.  The optional second argument is the output of
verify_licenses.py; its result (licence still CC0 on the page) is shown for every source.
"""
import json, os, sys

CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
audio = sys.argv[1]
tools = os.path.join(audio, 'tools')
catalog = json.load(open(os.path.join(audio, 'catalog.json')))['items']
sources = {s['id']: s for s in json.load(open(os.path.join(tools, 'sources.json')))['sources']}
check = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}
groups = {g['id']: g for g in json.load(open(os.path.join(tools, 'candidates.json')))['groups']}


def cell(s):
    return str(s).replace('|', '\\|').replace('\n', ' ')


def length(it):
    sec = it['seconds']
    return f'{int(sec // 60)}:{sec % 60:04.1f}' if sec >= 60 else f'{sec:.2f}초'


by_source = {}
for it in catalog:
    by_source.setdefault(it['source'], []).append(it)

out = []
w = out.append
w('# 오디오 라이선스 기록\n')
w(f'- 외부에서 가져온 소리는 모두 **CC0 1.0** ([증서]({CC0}))입니다. 저작권을 포기한 퍼블릭 도메인 헌정이라 상업 사용, 크레딧 표기, 2차 가공에 조건이 없습니다.')
w('- 소리마다 **그 소리의 OpenGameArt 페이지**에서 라이선스란에 CC0 한 가지만 적혀 있는 것을 확인했습니다 (확인일 2026-11-02, `tools/verify_licenses.py`). 파일 목록과 크기도 페이지와 같습니다.')
w('- 작가가 적은 "크레딧을 주시면 기쁘겠다"는 말은 부탁일 뿐 조건이 아닙니다. 아래 "작가의 말"에 그대로 옮겨 두었습니다.')
w('- 쓰지 않는 것: CC-BY, CC-BY-SA, NC, ND, 개인 사용 한정, 출처나 조건이 불분명한 것.')
w('- `생성`은 `tools/synth.mjs`로 직접 합성한 소리입니다. 외부 샘플을 쓰지 않았고 우리 코드의 결과물입니다.')
w('- 후보는 `candidates/`에 있고 git에는 넣지 않습니다(`bunker/.gitignore`). 파일은 `tools/process.py`가 `tools/candidates.json`과 내려받은 원본에서 다시 만들 수 있습니다.')
w('- 가공 내용은 파일마다 적었습니다. 공통: 44.1kHz OGG Vorbis로 변환, 음악은 약 -16 LUFS, 효과음은 최대 음량 -1 dBTP(모노).\n')
w(f'후보 파일 {len(catalog)}개 / 외부 소스 {len(by_source) - (1 if "generated" in by_source else 0)}곳 / 생성 {len(by_source.get("generated", []))}개\n')

w('## 한눈에 보기\n')
w('| 분류 | 파일 | 출처 |')
w('|---|---|---|')
for g in groups.values():
    for it in catalog:
        if it['group'] == g['id']:
            src = '생성' if it['source'] == 'generated' else f"{sources[it['source']]['author']} · {sources[it['source']]['title']}"
            w(f"| {g['label']} | `{it['file']}` | {cell(src)} |")
w('')

w('## 외부 소스 (CC0)\n')
order = [s for s in sources if s in by_source]
for sid in order:
    s = sources[sid]
    items = by_source[sid]
    chk = check.get(sid, {})
    w(f"### {s['title']}\n")
    w(f"- 작가: [{s['author']}]({s['author_url']})")
    w(f"- 출처 페이지: {s['page']}")
    for f in s['files']:
        used = [d for it in items for d in it.get('direct_files', []) if d['url'] == f['url']]
        if used:
            sha = used[0].get('sha256')
            w(f"- 원본 파일: {f['url']}  \n  (`{f['name']}`, {f['bytes']:,} bytes" + (f", SHA-256 `{sha}`" if sha else '') + ')')
    w(f"- 라이선스: [CC0 1.0]({CC0}) (페이지의 라이선스란에 CC0만 표시)")
    w(f"- 받은 날: {s['retrieved']}" + (f" / 페이지 재확인: {chk['checked']} (이상 없음)" if chk.get('ok') else ''))
    if s.get('notice'):
        w(f"- 작가의 말: \"{cell(s['notice'])}\"")
    if s.get('note_ko'):
        w(f"- {s['note_ko']}")
    w('')
    w('| 만든 파일 | 원본 안의 파일 | 가공 |')
    w('|---|---|---|')
    for it in items:
        members = ', '.join(it.get('source_files') or [it['member']])
        w(f"| `{it['file']}` ({length(it)}) | {cell(members)} | {cell('; '.join(it['changes']))} |")
    w('')

gen = by_source.get('generated', [])
if gen:
    w('## 생성 (자체 합성)\n')
    w('- 만든 곳: `bunker/audio/tools/synth.mjs` (node, 의존성 없음). 같은 코드는 항상 같은 소리를 만듭니다.')
    w('- 외부 샘플, 녹음, 프리셋을 쓰지 않았습니다. 이 프로젝트의 결과물이므로 별도 라이선스 조건이 없습니다.')
    w('- 만든 날: 2026-11-02\n')
    w('| 만든 파일 | 합성 내용 | 가공 |')
    w('|---|---|---|')
    for it in gen:
        w(f"| `{it['file']}` ({length(it)}) | {cell(it.get('generated_desc', it['mood']))} | {cell('; '.join(it['changes']))} |")
    w('')

open(os.path.join(audio, 'LICENSES.md'), 'w', encoding='utf-8').write('\n'.join(out))
print('wrote LICENSES.md:', len(catalog), 'files,', len(order), 'sources,', len(gen), 'generated')
