"""SBM TA 2026 (PMK 32/2025): ekstraksi baris tabel per baris teks.

Tabel di PMK 32/2025 tidak memiliki garis antarbaris, sehingga pdfplumber menggabungkan
banyak baris menjadi satu sel. Di sini batas kolom diambil dari baris nomor kolom "(1) (2) ...",
lalu setiap kata ditempatkan ke kolom berdasarkan posisi x dan dikelompokkan per baris (posisi y).
Output: [{page, cols:[...], cells:[...], x0:[...]}]
"""
import sys, json, re, pdfplumber

pdf = pdfplumber.open(sys.argv[1])
PAGES = list(range(4, 39)) + list(range(62, 101))
NUM = re.compile(r'^\(\d+\)$')

def txt(page, bbox):
    t = page.crop(bbox).extract_text() or ''
    return re.sub(r'\s+', ' ', re.sub(r'\(\d+\)', '', t)).strip()

out = []
for pn in PAGES:
    page = pdf.pages[pn - 1]
    tables = page.find_tables()
    page_out = []
    # baris teks di luar tabel (judul butir/subbutir yang dicetak di antara tabel)
    def inside(w):
        return any(t.bbox[0] - 2 <= w['x0'] and w['x1'] <= t.bbox[2] + 2 and t.bbox[1] - 2 <= w['top'] and w['bottom'] <= t.bbox[3] + 2 for t in tables)
    ow = [w for w in page.extract_words(x_tolerance=1.5, y_tolerance=2) if not inside(w)]
    ow.sort(key=lambda w: (round(w['top']), w['x0']))
    olines = []
    for w in ow:
        if olines and abs(olines[-1]['top'] - w['top']) <= 2.5:
            olines[-1]['w'].append(w)
        else:
            olines.append({'top': w['top'], 'w': [w]})
    for ln in olines:
        ws = sorted(ln['w'], key=lambda w: w['x0'])
        page_out.append({'page': pn, 'top': round(ln['top'], 1), 'out': True, 'x0': round(ws[0]['x0'], 1), 'text': ' '.join(w['text'] for w in ws)})
    for t in tables:
        rows = t.rows
        k = None
        leaves = None
        for strict in (True, False):
            for i, r in enumerate(rows):
                cs = [c for c in r.cells if c]
                vals = [(page.crop(c).extract_text() or '').strip() for c in cs]
                ok = (lambda v: NUM.match(v)) if strict else (lambda v: re.search(r'\(\d+\)\s*$', v))
                nums = [c for c, v in zip(cs, vals) if ok(v)]
                if len(nums) >= 2 and all(ok(v) or v == '' for v in vals):
                    if not strict and len(nums) < len(cs) - 1:
                        continue
                    k, leaves = i, nums
                    break
            if k is not None:
                break
        if k is None:
            r0 = [c for c in rows[0].cells]
            if all(r0):
                k = 0
                leaves = r0
            else:
                print('NO HEADER', pn, file=sys.stderr)
                continue
        # nama kolom
        parts = [[] for _ in leaves]
        for r in rows[:k + 1]:
            for c in r.cells:
                if not c:
                    continue
                s = txt(page, c)
                if not s:
                    continue
                for j, L in enumerate(leaves):
                    cx = (L[0] + L[2]) / 2
                    if c[0] - 1 <= cx <= c[2] + 1:
                        if not parts[j] or parts[j][-1] != s:
                            parts[j].append(s)
        cols = [' | '.join(p) for p in parts]
        top = max(c[3] for c in rows[k].cells if c)
        words = page.crop((t.bbox[0], top + 0.5, t.bbox[2], t.bbox[3])).extract_words(keep_blank_chars=False, x_tolerance=1.5, y_tolerance=2)
        words.sort(key=lambda w: (round(w['top']), w['x0']))
        lines = []
        for w in words:
            if lines and abs(lines[-1]['top'] - w['top']) <= 2.5:
                lines[-1]['w'].append(w)
            else:
                lines.append({'top': w['top'], 'w': [w]})
        for ln in lines:
            cells = [[] for _ in leaves]
            x0s = [None] * len(leaves)
            for w in sorted(ln['w'], key=lambda w: w['x0']):
                cx = (w['x0'] + w['x1']) / 2
                j = next((j for j, L in enumerate(leaves) if L[0] - 1 <= cx < L[2] + 1), None)
                if j is None:
                    j = min(range(len(leaves)), key=lambda j: abs((leaves[j][0] + leaves[j][2]) / 2 - cx))
                cells[j].append(w['text'])
                if x0s[j] is None:
                    x0s[j] = round(w['x0'] - leaves[j][0], 1)
            page_out.append({'page': pn, 'top': round(ln['top'], 1), 'cols': cols, 'cells': [' '.join(c) for c in cells], 'x0': x0s})
    page_out.sort(key=lambda l: l['top'])
    out.extend(page_out)
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False)
print(len(out))
