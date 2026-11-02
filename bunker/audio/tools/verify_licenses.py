#!/usr/bin/env python3
"""Re-check the licence of every source against its own OpenGameArt page.

Usage:  python3 -I verify_licenses.py <sources.json> <pages-dir> <out.json> [--fetch]

<pages-dir> holds one <source-id>.html per source (the raw OpenGameArt page).  With --fetch,
missing pages are downloaded first (each page once; existing ones are never fetched again).

For every source the script reads, from the page itself:
  * the License(s) field (name + link)            -> must be exactly one entry: CC0 1.0 (publicdomain/zero)
  * the Copyright/Attribution Notice field         -> kept; a polite "credit appreciated" is recorded, not a condition
  * the File(s) list (URL and byte size)           -> every file we use must be listed with the same size
  * title and author                               -> must match sources.json
  * the description and all comments               -> scanned for words that could signal trouble
                                                      (CC-BY, NC, ND, SA, samples, ripped, personal use ...)
It writes <out.json> and exits with status 1 when any source fails the hard checks.
"""
import html as htmllib, json, os, re, subprocess, sys, urllib.parse

CC0_HREFS = {'http://creativecommons.org/publicdomain/zero/1.0/', 'https://creativecommons.org/publicdomain/zero/1.0/'}
RED_FLAGS = re.compile(
    r'(cc[ -]?by|attribution[ -]?(is )?(required|needed|mandatory)|must (credit|attribute)|non[- ]?commercial|'
    r'\bNC\b|\bND\b|share[- ]?alike|\bBY-SA\b|personal use|not for commercial|no commercial|freesound|'
    r'ripped|taken from|sampled from|not (mine|my own)|permission|royalt|gpl|all rights reserved|copyright(ed)? (by|to))',
    re.I)


def text_of(fragment):
    fragment = re.sub(r'<br\s*/?>|</p>|</div>|</li>', '\n', fragment, flags=re.I)
    fragment = re.sub(r'<[^>]+>', '', fragment)
    return re.sub(r'[ \t\r\f\v]+', ' ', htmllib.unescape(fragment)).strip()


def block(h, cls):
    """Return the inner HTML of the first <div class="field field-name-<cls> ..."> block."""
    m = re.search(r'<div class="field field-name-%s[ "][^>]*>' % re.escape(cls), h)
    if not m:
        return ''
    depth, i = 1, m.end()
    for t in re.finditer(r'<div\b|</div>', h[i:]):
        depth += 1 if t.group(0) != '</div>' else -1
        if depth == 0:
            return h[i:i + t.start()]
    return h[i:]


def parse(h):
    title = text_of(block(h, 'title'))
    author = text_of(block(h, 'author-submitter')).replace('Author:', '').strip()
    submitted_by = ''
    m = re.match(r'(.*?)\s*\(Submitted by (.*?)\)\s*$', author, re.S)   # credited author differs from the uploader
    if m:
        author, submitted_by = m.group(1).strip(), m.group(2).strip()
    lic_block = block(h, 'field-art-licenses')
    licenses = [{'name': text_of(n), 'href': href}
                for href, n in re.findall(r"<a href='([^']+)'[^>]*>.*?<div class='license-name'>(.*?)</div>", lic_block, re.S)]
    notice = text_of(block(h, 'field-copyright-notice')).replace('Copyright/Attribution Notice:', '').strip()
    files = []
    for m in re.finditer(r'<a href="([^"]+)" type="[^"]*?length=(\d+)"[^>]*>(.*?)</a>', block(h, 'field-art-files')):
        files.append({'url': htmllib.unescape(m.group(1)), 'bytes': int(m.group(2)), 'name': text_of(m.group(3))})
    body = text_of(block(h, 'body'))
    comments = [text_of(c) for c in re.findall(r'<div class="field field-name-comment-body[^>]*>(.*?)</div></div></div>', h, re.S)]
    return {'title': title, 'author': author, 'submitted_by': submitted_by, 'licenses': licenses, 'notice': notice, 'files': files,
            'body': body, 'comments': comments}


def norm_url(u):
    return urllib.parse.unquote(u)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sources = json.load(open(args[0]))['sources']
    pages, out_path = args[1], args[2]
    os.makedirs(pages, exist_ok=True)
    results, failed = {}, []
    for s in sources:
        path = os.path.join(pages, s['id'] + '.html')
        if not os.path.exists(path):
            if '--fetch' not in sys.argv:
                results[s['id']] = {'ok': False, 'problems': ['page not downloaded']}
                failed.append(s['id'])
                continue
            r = subprocess.run(['curl', '-sS', '-L', '--retry', '3', '--max-time', '120', '-o', path, s['page']])
            if r.returncode != 0:
                results[s['id']] = {'ok': False, 'problems': ['page download failed']}
                failed.append(s['id'])
                continue
        p = parse(open(path, encoding='utf-8').read())
        problems, flags = [], []
        if len(p['licenses']) != 1:
            problems.append(f"expected exactly one licence, page lists {[l['name'] for l in p['licenses']]}")
        elif p['licenses'][0]['name'] != 'CC0' or p['licenses'][0]['href'] not in CC0_HREFS:
            problems.append(f"licence is not CC0: {p['licenses']}")
        if p['title'] != s['title']:
            problems.append(f"title differs: page '{p['title']}' vs sources.json '{s['title']}'")
        if p['author'].lower() != s['author'].lower():
            problems.append(f"author differs: page '{p['author']}' vs sources.json '{s['author']}'")
        page_files = {norm_url(f['url']): f for f in p['files']}
        for f in s['files']:
            pf = page_files.get(norm_url(f['url']))
            if not pf:
                problems.append(f"file not listed on the page any more: {f['url']}")
            elif pf['bytes'] != f['bytes']:
                problems.append(f"size changed: {f['name']} page {pf['bytes']} vs {f['bytes']}")
        for where, txt in [('description', p['body']), ('notice', p['notice'])] + [(f'comment {i + 1}', c) for i, c in enumerate(p['comments'])]:
            for line in re.split(r'(?<=[.!?])\s+|\n', txt):
                if RED_FLAGS.search(line):
                    flags.append(f'{where}: {line.strip()[:240]}')
        results[s['id']] = {
            'ok': not problems, 'problems': problems, 'flags': flags, 'checked': '2026-11-02',
            'page': s['page'], 'title': p['title'], 'author': p['author'], 'submitted_by': p['submitted_by'],
            'licenses': p['licenses'], 'notice': p['notice'], 'comments_seen': len(p['comments']),
            'page_files': p['files'],
        }
        if problems:
            failed.append(s['id'])
    json.dump(results, open(out_path, 'w'), ensure_ascii=False, indent=1)
    print(f'{len(sources)} sources checked, {len(sources) - len(failed)} pass, {len(failed)} fail')
    for sid in failed:
        print('FAIL', sid, results[sid]['problems'])
    for sid, r in results.items():
        for f in r.get('flags', []):
            print('FLAG', sid, '|', f)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
