"""Cek silang SBM 2026: setiap baris data harus punya pasangan baris teks (pdftotext -layout) yang memuat semua nilainya
berurutan; jumlah token nilai rupiah di halaman tabel juga harus sama."""
import json, re, sys
tables = json.load(open(sys.argv[1]))
pages = open(sys.argv[2]).read().split('\f')
TABLE_PAGES = list(range(4, 39)) + list(range(62, 101))
txt_lines = []
for pn in TABLE_PAGES:
    for l in pages[pn - 1].split('\n'):
        txt_lines.append(re.sub(r'\s+', ' ', l))
VAL = re.compile(r'^(Rp ?[\d.]+|\$ ?[\d.,]+|[\d][\d.,]*)$')
ok = tot = 0
fails = []
ext_rp = 0
for k, b in tables.items():
    for t in b['tables']:
        for r in t['rows']:
            if 'v' not in r:
                continue
            vals = [x for x in r['v'][2:] if VAL.match(x)]
            ext_rp += sum(1 for x in vals if x.startswith('Rp'))
            if not vals:
                continue
            tot += 1
            pat = r'(?<![\d.,])' + r'.*?(?<![\d.,])'.join(re.escape(v) + r'(?![\d.,])' for v in vals)
            if any(re.search(pat, l) for l in txt_lines):
                ok += 1
            else:
                fails.append((k, r['c'], r['v'][1][:30], vals))
txt_rp = sum(len(re.findall(r'(?<![\w])Rp ?\d[\d.]*', l)) for l in txt_lines)
print(f'{ok}/{tot} baris cocok; token Rp: ekstraksi {ext_rp}, teks {txt_rp}')
for f in fails[:40]:
    print('GAGAL', f)
