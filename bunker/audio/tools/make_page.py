#!/usr/bin/env python3
"""Build the listening page bunker/audio/index.html from catalog.json + candidates.json.

Usage:  python3 -I make_page.py <audio-dir>

Everything is inline (no external script, style or font) and every sound is a relative path (candidates/...), so the folder can be
opened from disk or published as it is.  Looks like the game: white paper, ink text, 1 px ink borders, monospace.
The page keeps the client's picks (one per slot) in localStorage (if allowed) and can copy them as text.
"""
import html, json, os, sys

CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
audio = sys.argv[1]
catalog = json.load(open(os.path.join(audio, 'catalog.json')))['items']
doc = json.load(open(os.path.join(audio, 'tools', 'candidates.json')))
groups = doc['groups']
esc = lambda s: html.escape(str(s), quote=True)


def mmss(sec):
    sec = round(sec)
    return f'{sec // 60}:{sec % 60:02d}'


def seconds(sec):
    return f'{sec:.1f}초' if sec >= 1 else f'{sec:.2f}초'


STAR = ('<svg class="star" viewBox="0 0 10 10" role="img" aria-label="추천"><title>추천</title>'
        '<polygon points="5,0.4 6.3,3.6 9.7,3.9 7.1,6.1 7.9,9.5 5,7.7 2.1,9.5 2.9,6.1 0.3,3.9 3.7,3.6"/></svg>')


def lic(it):
    if it['source'] == 'generated':
        return '<span>생성</span>'
    return f'<a href="{CC0}" target="_blank" rel="noopener">CC0</a>'


def card(it, letter=None):
    music = it['kind'] == 'music'
    meta = [mmss(it['seconds']) if it['seconds'] >= 60 or music else seconds(it['seconds'])]
    if music:
        if it.get('bpm'):
            meta.append(f"{it['bpm']} BPM")
        elif it.get('bpm_est'):
            meta.append(f"≈{round(it['bpm_est'])} BPM")
        meta.append(f"루프 {mmss(it.get('loop_start', 0))}–{mmss(it['loop_end'])}")
    vol = ''
    if it['kind'] == 'sfx' and it.get('preview_gain_db'):
        vol = f" data-vol=\"{max(0.1, min(1.0, 10 ** (it['preview_gain_db'] / 20))):.2f}\""
    name = it['title']
    if it['kind'] == 'sfx' and not letter:                  # only candidate of its slot: the slot label is the heading
        name = f"{it['slot_label']} · {name}" if name else it['slot_label']
    label = f"{it['slot_label']} {letter} · {name}" if letter else name
    return (
        f'<article class="cand{" rec" if it.get("star") else ""}" data-id="{esc(it["id"])}" data-slot="{esc(it.get("slot", it["group"]))}" '
        f'data-label="{esc(label)}">'
        f'<div class="head">{f"<b class=chip>{letter}</b>" if letter else ""}<h4>{esc(name)}</h4>{STAR if it.get("star") else ""}'
        f'<label class="pick"><input type="checkbox"><span>선택</span></label></div>'
        f'<audio controls preload="none"{" loop" if music else ""}{vol} aria-label="{esc(label)}" src="{esc(it["file"])}"></audio>'
        f'<p class="meta">{"".join(f"<span>{esc(m)}</span>" for m in meta)}</p>'
        f'<p class="meta dim"><span>{esc(it["author"].replace(" (이 프로젝트)", ""))}</span>{lic(it)}</p>'
        f'<p class="mood">{esc(it["mood"])}</p></article>')


by_group = {}
for it in catalog:
    by_group.setdefault(it['group'], []).append(it)

total_slots = len({it.get('slot', it['group']) for it in catalog})
nav, body = [], []
section = None
for g in groups:
    items = by_group.get(g['id'], [])
    if not items:
        continue
    if g['section'] != section:
        if section:
            body.append('</section>')
        section = g['section']
        body.append(f'<section class="sec" id="sec-{len(nav)}"><h2>{esc(section)}</h2>')
    nav.append(f'<a href="#{esc(g["id"])}">{esc(g["label"])}</a>')
    hint = f'<small>{esc(g["hint"])}</small>' if g['hint'] else ''
    body.append(f'<div class="grp" id="{esc(g["id"])}"><h3>{esc(g["label"])}{hint}</h3>')
    if g['id'].startswith('sfx-'):
        slots = {}
        for it in items:
            slots.setdefault(it['slot'], []).append(it)
        body.append('<div class="slots">')
        for slot, alts in slots.items():
            body.append('<div class="slot">' + (f'<h5>{esc(alts[0]["slot_label"])}</h5>' if len(alts) > 1 else ''))
            body.extend(card(it, 'ABCD'[i] if len(alts) > 1 else None) for i, it in enumerate(alts))
            body.append('</div>')
        body.append('</div>')
    else:
        body.append('<div class="cards">' + ''.join(card(it) for it in items) + '</div>')
    body.append('</div>')
body.append('</section>')

CSS = r'''
:root { color-scheme: light; --paper: #fff; --ink: #1c1b19; --muted: #6f6b63; --line: #e4e0d8; --soft: #f6f4ef; --pick: #6aa64a; --star: #d9a400; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; --paper: #1c1b19; --ink: #f3f0e8; --muted: #a8a399; --line: #3b3934; --soft: #262520; --pick: #8cc56a; --star: #f2c200; } }
:root[data-theme="dark"] { color-scheme: dark; --paper: #1c1b19; --ink: #f3f0e8; --muted: #a8a399; --line: #3b3934; --soft: #262520; --pick: #8cc56a; --star: #f2c200; }
* { box-sizing: border-box; }
html { scroll-padding-top: 92px; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 13px/1.45 ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace; word-break: keep-all; -webkit-text-size-adjust: 100%; }
a { color: inherit; }
.top { position: sticky; top: 0; z-index: 5; background: var(--paper); border-bottom: 1px solid var(--ink); }
.top .in { max-width: 1000px; margin: 0 auto; padding: 8px 16px 0; }
.bar { display: flex; align-items: center; gap: 10px; }
.bar h1 { flex: 1; margin: 0; font-size: 15px; }
.bar small { color: var(--muted); }
button { font: inherit; color: var(--ink); background: var(--paper); border: 1px solid var(--ink); padding: 0 12px; min-height: 36px; cursor: pointer; }
button:active { background: var(--ink); color: var(--paper); }
nav { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0; scrollbar-width: thin; }
nav a { flex: none; border: 1px solid var(--line); padding: 3px 9px; text-decoration: none; white-space: nowrap; }
nav a:hover { border-color: var(--ink); }
main { max-width: 1000px; margin: 0 auto; padding: 0 16px 80px; }
.sec h2 { margin: 28px 0 0; padding-bottom: 4px; font-size: 15px; border-bottom: 2px solid var(--ink); }
.grp h3 { margin: 22px 0 8px; font-size: 14px; }
.grp h3 small { margin-left: 8px; font-weight: 400; color: var(--muted); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; }
.slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px 10px; align-items: start; }
.slot { display: grid; gap: 6px; }
.slot h5 { margin: 0; font-size: 13px; color: var(--muted); }
.cand { border: 1px solid var(--ink); padding: 8px 10px 9px; background: var(--paper); }
.cand.picked { background: var(--soft); box-shadow: inset 4px 0 0 var(--pick); }
.head { display: flex; align-items: center; gap: 6px; min-height: 28px; }
.head h4 { flex: 1; margin: 0; font-size: 13px; overflow-wrap: anywhere; }
.chip { flex: none; display: inline-block; min-width: 20px; padding: 0 4px; text-align: center; border: 1px solid var(--ink); font-size: 12px; }
.star { flex: none; width: 14px; height: 14px; fill: var(--star); stroke: var(--ink); stroke-width: .6; }
.pick { flex: none; display: flex; align-items: center; gap: 4px; min-height: 32px; padding-left: 6px; cursor: pointer; color: var(--muted); }
.pick input { width: 18px; height: 18px; margin: 0; accent-color: var(--pick); }
audio { display: block; width: 100%; height: 36px; margin: 4px 0 2px; }
.meta { display: flex; flex-wrap: wrap; gap: 0 6px; margin: 2px 0 0; font-size: 12px; font-variant-numeric: tabular-nums; }
.meta span + span::before, .meta span + a::before { content: "·"; margin-right: 6px; color: var(--muted); }
.meta.dim { color: var(--muted); }
.meta span + a::before { display: inline-block; text-decoration: none; }
.mood { margin: 4px 0 0; font-size: 12px; }
.out { margin-top: 30px; border: 1px solid var(--ink); padding: 8px 10px; }
.out summary { cursor: pointer; min-height: 28px; }
.out textarea { width: 100%; min-height: 160px; margin-top: 6px; font: inherit; color: var(--ink); background: var(--paper); border: 1px solid var(--line); padding: 6px; resize: vertical; }
@media (max-width: 420px) { .cards, .slots { grid-template-columns: 1fr; } }
'''

JS = r'''
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'bunker-audio-picks-v1';
  let picks = {};                       // slot -> candidate id
  try { picks = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { picks = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (e) { /* storage not allowed: picks just last for this visit */ } };

  const audios = $$('audio');
  audios.forEach(a => {
    if (a.dataset.vol) a.volume = parseFloat(a.dataset.vol);        // sfx are all at -1 dBTP; this evens out how loud they feel
    a.addEventListener('play', () => audios.forEach(o => { if (o !== a) o.pause(); }));
  });

  const cands = $$('.cand'), out = $$('.out textarea')[0], count = document.getElementById('count');
  function render() {
    cands.forEach(c => {
      const on = picks[c.dataset.slot] === c.dataset.id;
      c.classList.toggle('picked', on);
      c.querySelector('input').checked = on;
    });
    const lines = [];
    $$('.grp').forEach(g => {
      const chosen = $$('.cand', g).filter(c => picks[c.dataset.slot] === c.dataset.id);
      if (!chosen.length) return;
      lines.push('[' + g.querySelector('h3').firstChild.textContent + ']');
      chosen.forEach(c => lines.push('  ' + c.dataset.label + '  (' + c.dataset.id + ')'));
    });
    out.value = lines.join('\n');
    count.textContent = Object.keys(picks).length + '/' + count.dataset.total;
  }
  cands.forEach(c => c.querySelector('input').addEventListener('change', e => {
    if (e.target.checked) picks[c.dataset.slot] = c.dataset.id; else delete picks[c.dataset.slot];
    save(); render();
  }));
  document.getElementById('copy').addEventListener('click', async () => {
    const btn = document.getElementById('copy'), old = btn.textContent;
    try { await navigator.clipboard.writeText(out.value); }
    catch (e) { out.closest('details').open = true; out.focus(); out.select(); try { document.execCommand('copy'); } catch (e2) { /* the text is selected for a manual copy */ } }
    btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = old; }, 1200);
  });
  render();
})();
'''

page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>사운드 후보 듣기</title>
<style>{CSS}</style>
</head>
<body>
<header class="top"><div class="in">
<div class="bar"><h1>사운드 후보</h1><small id="count" data-total="{total_slots}">0/{total_slots}</small><button id="copy" type="button">선택 복사</button></div>
<nav>{''.join(nav)}</nav>
</div></header>
<main>
{''.join(body)}
<details class="out"><summary>선택 목록</summary><textarea readonly rows="8"></textarea></details>
</main>
<script>{JS}</script>
</body>
</html>
'''
open(os.path.join(audio, 'index.html'), 'w', encoding='utf-8').write(page)
print('wrote index.html', len(page) // 1024, 'KB;', len(catalog), 'candidates')
