#!/usr/bin/env python3
"""Download every source in sources.json into a cache folder and unpack archives.

Usage:  python3 -I fetch.py <sources.json> <cache-dir> [source-id ...]

Each source gets its own folder:  <cache>/dl/<id>/<file>  and archives are unpacked into
<cache>/x/<id>/.  The file size must match the size the OpenGameArt page reports, and the
SHA-256 of every download is written to <cache>/fetch-log.json (process.py copies it into
the catalog so LICENSES.md can show what was used).  7z archives need the py7zr package.
Downloaded files are treated as data only: nothing inside them is ever executed.
"""
import hashlib, json, os, subprocess, sys, zipfile


def safe_join(root, name):
    path = os.path.realpath(os.path.join(root, name))
    if not path.startswith(os.path.realpath(root) + os.sep):
        raise ValueError(f'archive member escapes the target folder: {name}')
    return path


def unpack(archive, dest):
    if not archive.lower().endswith(('.zip', '.7z')):
        return False
    os.makedirs(dest, exist_ok=True)
    if archive.lower().endswith('.zip'):
        with zipfile.ZipFile(archive) as z:
            for info in z.infolist():
                if info.is_dir():
                    continue
                target = safe_join(dest, info.filename)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with z.open(info) as src, open(target, 'wb') as out:
                    out.write(src.read())
    elif archive.lower().endswith('.7z'):
        import py7zr  # only needed for the few .7z packs
        with py7zr.SevenZipFile(archive) as z:
            names = z.getnames()
            for n in names:
                safe_join(dest, n)
            z.extractall(path=dest)
    else:
        return False
    return True


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    sources = json.load(open(sys.argv[1]))['sources']
    cache = sys.argv[2]
    only = set(sys.argv[3:])
    log_path = os.path.join(cache, 'fetch-log.json')
    log = json.load(open(log_path)) if os.path.exists(log_path) else {}
    for s in sources:
        if only and s['id'] not in only:
            continue
        for f in s['files']:
            folder = os.path.join(cache, 'dl', s['id'])
            os.makedirs(folder, exist_ok=True)
            path = os.path.join(folder, f['name'])
            if not (os.path.exists(path) and os.path.getsize(path) == f['bytes']):
                r = subprocess.run(['curl', '-sS', '-L', '--fail', '--retry', '3', '--max-time', '1800',
                                    '-o', path, f['url']], capture_output=True, text=True)
                if r.returncode != 0:
                    print(f'FAIL {s["id"]} {f["name"]}: {r.stderr.strip()}')
                    continue
            size = os.path.getsize(path)
            ok = size == f['bytes']
            log[f['url']] = {'source': s['id'], 'path': path, 'bytes': size, 'size_matches_page': ok,
                             'sha256': sha256(path)}
            if unpack(path, os.path.join(cache, 'x', s['id'])):
                log[f['url']]['unpacked_to'] = os.path.join(cache, 'x', s['id'])
            print(f'{"ok " if ok else "SIZE MISMATCH"} {s["id"]:22} {f["name"]} {size / 1e6:.1f}MB')
        json.dump(log, open(log_path, 'w'), indent=1)


if __name__ == '__main__':
    main()
