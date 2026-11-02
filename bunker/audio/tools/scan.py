#!/usr/bin/env python3
"""List every audio file in the download cache with duration, channels, sample rate and size.

Usage:  python3 -I scan.py <cache-dir> <out.json>

For each source id the unpacked folder (<cache>/x/<id>) is used when the download was an archive,
otherwise the raw download folder (<cache>/dl/<id>).  Files are only read (never executed).
"""
import json, os, subprocess, sys
import soundfile as sf

EXTS = ('.wav', '.ogg', '.flac', '.mp3', '.aif', '.aiff')


def info(path):
    try:
        i = sf.info(path)
        return i.duration, i.channels, i.samplerate
    except Exception:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=channels,sample_rate',
                            '-of', 'json', path], capture_output=True, text=True)
        j = json.loads(r.stdout)
        return float(j['format']['duration']), int(j['streams'][0]['channels']), int(j['streams'][0]['sample_rate'])


def main():
    cache, out = sys.argv[1:3]
    result = {}
    for sid in sorted(os.listdir(os.path.join(cache, 'dl'))):
        base = os.path.join(cache, 'x', sid)
        if not os.path.isdir(base):
            base = os.path.join(cache, 'dl', sid)
        files = []
        for dp, _, fn in os.walk(base):
            for f in sorted(fn):
                if not f.lower().endswith(EXTS) or f.startswith('._'):
                    continue
                p = os.path.join(dp, f)
                try:
                    d, ch, sr = info(p)
                except Exception as e:
                    files.append({'path': os.path.relpath(p, base), 'error': str(e)[:100]})
                    continue
                files.append({'path': os.path.relpath(p, base), 'sec': round(d, 3), 'ch': ch, 'sr': sr,
                              'bytes': os.path.getsize(p)})
        result[sid] = {'root': os.path.relpath(base, cache), 'files': files}
        print(f'{sid:22} {len(files):4} files', flush=True)
    json.dump(result, open(out, 'w'), ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()
