"""Bangun struktur tabel per butir dari rows.json (hasil pdfplumber).

Output: build/tables.json  -> {"L1-1": {"lamp":1,"no":1,"pages":[..],"tables":[...]}, ...}
Setiap tabel: {"cols":[...], "cur":"IDR|USD", "note":str|None, "rows":[{"c":code,"v":[cells]}|{"c":code,"g":label}]}
"""
import json, re, sys
from collections import OrderedDict

rows = json.load(open(sys.argv[1]))
CODE = re.compile(r'^\d{1,2}(\.\d{1,3})*\.?$')
NUMROW = re.compile(r'^\(\d+\)$')
VAL = re.compile(r'^(Rp ?[\d.]+|\$ ?[\d.,]+|[\d][\d.,]*|Sesuai tarif berlaku)$')

def cells_of(r):
    return [x for x in r['cells'] if x not in (None, '')]

def cap(s):
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.replace('Kenda- raan', 'Kendaraan')
    return s

def build_cols(lines, n, key):
    if key == ('2', 18) and len(lines) >= 2 and lines[-1][0].startswith('Kenda'):
        return ['No', 'Kota', 'Pemeliharaan Kendaraan Dinas (Unit/Tahun)', 'Pemeliharaan Gedung (m2/Tahun)',
                'Pemeliharaan Halaman (m2/Tahun)', 'Pengadaan Inventaris Kantor (OT)', 'Pakaian Sopir/Satpam (Stel)',
                'Sewa Sedan (hari)', 'Sewa Bus (hari)', 'Sewa Mobil Box (hari)', 'Konsumsi Rapat (OK)']
    if len(lines) == 1:
        logical = [cap(x) for x in lines[0]]
    else:
        L1, L2 = [cap(x) for x in lines[-2]], [cap(x) for x in lines[-1]]
        m = len(L2)
        lead = n - m
        s = len(L1) - lead
        if s <= 0:
            raise ValueError(f'header merge failed {key} {lines}')
        per = m // s
        dup = len(set(L2)) != len(L2)
        logical = L1[:lead]
        for j in range(s):
            span = L1[lead + j]
            for it in L2[j * per:(j + 1) * per]:
                if dup:
                    logical.append(f'{span}: {it}')
                elif span.upper() == 'GOLONGAN':
                    logical.append(f'Gol. {it}')
                else:
                    logical.append(it)
    out = []
    for i, h in enumerate(logical):
        if i == 0 and re.match(r'^NO\b', h, re.I):
            rest = re.sub(r'^NO[./]?\s*', '', h, flags=re.I)
            out.append('No')
            if rest.startswith('/'):
                rest = rest[1:]
            if rest:
                out.append(rest)
        else:
            out.append(h)
    return out

butir = OrderedDict()
cur = None   # key ('1'|'2', no)
pending = []  # header lines
note = None
lamp_prev = None
pre_cols = None
last_cols = None
last_note = None

def get(key):
    if key not in butir:
        butir[key] = {'lamp': int(key[0]), 'no': key[1], 'title_kmk': None, 'pages': [], 'tables': []}
    return butir[key]

def cur_table(b):
    if not b['tables']:
        b['tables'].append({'cols': None, 'note': None, 'rows': []})
    return b['tables'][-1]

def is_val(x):
    return bool(VAL.match(x))

for r in rows:
    lamp = '1' if r['page'] <= 50 else '2'
    if lamp != lamp_prev:
        cur = None
        last_cols = None
        lamp_prev = lamp
    c = cells_of(r)
    if not c:
        continue
    first = c[0]
    # Nomor kolom (1)(2).. -> finalisasi header
    if NUMROW.match(first):
        n = len(c)
        if cur is None:
            pre_cols = build_cols(pending, n, (lamp, 0))
            last_cols, last_note = pre_cols, None
            pending = []
            continue
        b = get(cur)
        cols = build_cols(pending, n, (lamp, cur[1]))
        t = cur_table(b)
        last_cols, last_note = cols, note
        if t['cols'] == cols:
            pass  # header berulang di halaman baru -> lanjutkan tabel
        else:
            # pindahkan baris grup di ekor tabel lama ke tabel baru
            carry = []
            while t['rows'] and 'g' in t['rows'][-1]:
                carry.insert(0, t['rows'].pop())
            if not t['rows']:
                b['tables'].pop()
            b['tables'].append({'cols': cols, 'note': note, 'rows': carry})
        pending = []
        note = None
        continue
    if first.startswith('(dalam'):
        note = first.strip('()')
        continue
    if CODE.match(first):
        pending = []
        code = first.rstrip('.')
        segs = code.split('.')
        if len(segs) == 1:
            k = int(segs[0])
            if cur is None or k == cur[1] + 1 or (k == cur[1]):
                if cur is not None and k == cur[1]:
                    # judul butir diulang di halaman baru
                    if r['page'] not in get(cur)['pages']:
                        get(cur)['pages'].append(r['page'])
                    continue
                cur = (lamp, k)
                b = get(cur)
                b['title_kmk'] = cap(c[1]) if len(c) > 1 else None
                b['pages'].append(r['page'])
                if pre_cols:
                    b['tables'].append({'cols': pre_cols, 'note': None, 'rows': []})
                    pre_cols = None
                elif last_cols:
                    b['tables'].append({'cols': last_cols, 'note': last_note, 'rows': []})
                rest = c[2:]
                if rest and any(is_val(x) for x in rest):
                    # butir tunggal yang langsung bernilai (mis. 13 Rohaniwan)
                    b['tables'].append({'cols': ['No', 'Uraian', 'Satuan', 'Besaran'], 'note': None,
                                        'rows': [{'c': code, 'v': [code] + c[1:]}]})
                continue
        b = get(cur)
        if r['page'] not in b['pages']:
            b['pages'].append(r['page'])
        t = cur_table(b)
        if len(c) > 1 and any(is_val(x) for x in c[1:]):
            t['rows'].append({'c': code, 'v': c})
        else:
            t['rows'].append({'c': code, 'g': cap(' '.join(c[1:]))})
        continue
    # baris tanpa kode
    b = get(cur) if cur else None
    if b is not None and any(is_val(x) for x in c) and len(c) >= 2:
        # data tanpa nomor (L2 butir 4)
        t = cur_table(b)
        t['rows'].append({'c': '', 'v': c})
        continue
    pending.append(c)

# Bersihkan dan validasi
problems = []
for key, b in butir.items():
    b['tables'] = [t for t in b['tables'] if t['rows']]
    for t in b['tables']:
        vals = [x for row in t['rows'] if 'v' in row for x in row['v'] if is_val(x)]
        t['cur'] = 'IDR' if any(v.startswith('Rp') for v in vals) else ('USD' if vals else None)
        if t['cols'] is None:
            problems.append((key, 'no header', t['rows'][:2]))
            continue
        for row in t['rows']:
            if 'v' in row and len(row['v']) != len(t['cols']):
                problems.append((key, 'width', t['cols'], row['v']))

out = {f"L{k[0]}-{k[1]}": v for k, v in butir.items()}
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print('butir:', len(out))
for p in problems[:60]:
    print('PROBLEM', p)
print('total problems', len(problems))
