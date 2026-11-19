import sys, json, pdfplumber
# SBM TA 2026 (PMK 32/2025): tabel Lampiran I hal. 4-38, Lampiran II hal. 62-100
pdf = pdfplumber.open(sys.argv[1])
pages = list(range(4, 39)) + list(range(62, 101))
out = []
for pn in pages:
    p = pdf.pages[pn - 1]
    for ti, t in enumerate(p.extract_tables()):
        for r in t:
            cells = [(c or '').replace('\n', ' ').strip() if c is not None else None for c in r]
            out.append({'page': pn, 't': ti, 'cells': cells})
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False)
print(len(out))
