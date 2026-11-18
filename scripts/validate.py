"""Cek silang setiap baris data terhadap teks PDF (pdftotext -layout)."""
import json, re, sys
d = json.load(open(sys.argv[1]))
lines = open(sys.argv[2]).read().split('\n')
idx = {}
for i, l in enumerate(lines):
    for tok in re.findall(r'(?<![\d.])\d{1,2}(?:\.\d{1,3})+(?![\d])', l):
        idx.setdefault(tok, []).append(i)
tot = ok = 0
fails = []
for b in d['butir']:
    for t in b['tables']:
        for r in t['rows']:
            if 'v' not in r or not r['c'] or '.' not in r['c']:
                continue
            vals = [x for x, n in zip(r['v'], r['n']) if n is not None]
            tot += 1
            cand = idx.get(r['c'], [])
            hit = False
            for i in cand:
                window = ' '.join(lines[max(0, i - 2):i + 3])
                w = re.sub(r'\s+', ' ', window)
                if all(re.search(r'(?<![\d.,])' + re.escape(v) + r'(?![\d.,])', w) for v in vals):
                    hit = True
                    break
            if hit:
                ok += 1
            else:
                fails.append((b['id'], r['c'], vals))
print(f'{ok}/{tot} baris cocok dengan teks PDF')
for f in fails[:40]:
    print('GAGAL', f)
print('total gagal', len(fails))
