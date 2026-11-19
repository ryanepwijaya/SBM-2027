"""SBM TA 2026: susun tabel per butir dari lines.json (dump_lines.py).

Penomoran PMK 32/2025 berbeda dengan KMK 2027: subbutir memakai huruf (a., b.) dan angka berkurung (1)),
baris provinsi/kota diberi nomor urut (1., 2., ...). Kode baris disusun sebagai jalur: 1.1.a, 11.1.1.c.1, 28.1.13.
Output: {"L1-1": {"lamp","no","title_kmk","pages","tables":[{"cols","cur","note","rows":[{"c","v"}|{"c","g"}]}]}}
"""
import json, re, sys
from collections import OrderedDict

lines = json.load(open(sys.argv[1]))

def csig(cols):
    return None if cols is None else tuple(re.sub(r'[^A-Z0-9|]', '', c.upper()) for c in cols)

# Gabungkan dua baris teks yang sebenarnya satu baris tabel tetapi tercetak sedikit bergeser vertikal
# (kolom terisi saling lepas, jarak <= 7 pt), mis. "ACEH ... Rp641.995.000" + "36.1.2.1 ... Unit".
merged = []
for ln in lines:
    p = merged[-1] if merged else None
    if p and not p.get('out') and not ln.get('out') and p['page'] == ln['page'] and csig(p['cols']) == csig(ln['cols']) \
            and abs(ln['top'] - p['top']) <= 7 and not p.get('_m'):
        a, b = p['cells'], ln['cells']
        if all(not (x.strip() and y.strip()) for x, y in zip(a, b)):
            p['cells'] = [(x or y) for x, y in zip(a, b)]
            p['_m'] = True
            continue
    merged.append(dict(ln))
lines = merged
VAL = re.compile(r'^(Rp ?[\d.]+|\$ ?[\d.,]+|[\d][\d.,]*|Sesuai tarif berlaku)$')
NUMCOL = re.compile(r'^\(\d+\)$')
HEAD = re.compile(r'^(\d{1,2})\.\s+(.+)$')
SUBH = re.compile(r'^(\d{1,2}(?:\.\d{1,3})+)\.?\s+(.+)$')
LET = re.compile(r'^([a-z])\.\s+(.+)$')
PAR = re.compile(r'^(\d{1,2})\)\s+(.+)$')
PAR2 = re.compile(r'^\(([a-z])\)\s+(.+)$')
PURECODE = re.compile(r'^\d{1,2}(\.\d{1,3})+\.?$')
NOROW = re.compile(r'^(\d{1,3})\.?$')
REGION = re.compile(r'^(AMERIKA|EROPA|AFRIKA|ASIA|AUSTRALIA|PASIFIK|TIMUR TENGAH)\b')
PROVS = ['aceh', 'sumatrautara', 'riau', 'kepulauanriau', 'jambi', 'sumatrabarat', 'sumatraselatan', 'lampung', 'bengkulu',
         'bangkabelitung', 'kepulauanbangkabelitung', 'banten', 'jawabarat', 'dkijakarta', 'jawatengah', 'diyogyakarta', 'jawatimur',
         'bali', 'nusatenggarabarat', 'nusatenggaratimur', 'kalimantanbarat', 'kalimantantengah', 'kalimantanselatan',
         'kalimantantimur', 'kalimantanutara', 'sulawesiutara', 'gorontalo', 'sulawesibarat', 'sulawesiselatan', 'sulawesitengah',
         'sulawesitenggara', 'maluku', 'malukuutara', 'papua', 'papuabarat', 'papuabaratdaya', 'papuatengah', 'papuaselatan',
         'papuapegunungan']

def pnorm(s):
    return re.sub(r'[^a-z]', '', s.lower()).replace('sumatera', 'sumatra')

def is_prov(s):
    return pnorm(s) in PROVS

def is_val(x):
    return bool(VAL.match(x.strip()))

def cap(s):
    return re.sub(r'\s+', ' ', s).strip()

butir = OrderedDict()
lamp = None
cur = None            # nomor butir
B = None              # objek butir
T = None              # tabel aktif
num_parent = None     # kode subbutir numerik terakhir
let_parent = None     # kode huruf terakhir (kelompok)
par_parent = None     # kode angka berkurung terakhir (kelompok)
last = None           # baris terakhir (untuk sambungan)
last_kind = None      # 'head' | 'row'
used = set()
unnum = 0

def new_table(cols):
    global T
    carry = []
    if T is not None:
        while T['rows'] and 'g' in T['rows'][-1]:
            carry.insert(0, T['rows'].pop())
        if not T['rows']:
            B['tables'].remove(T)
    T = {'cols': cols, 'note': None, 'rows': carry}
    B['tables'].append(T)

def uniq(code):
    c = code
    k = 2
    while (lamp, cur, c) in used:
        c = f'{code}-{k}'
        k += 1
    used.add((lamp, cur, c))
    return c

def add_row(code, cells, printed):
    global last, last_kind
    c = uniq(code)
    row = {'c': c, 'v': [printed] + cells[1:]}
    T['rows'].append(row)
    last, last_kind = row, 'row'
    return row

def add_group(code, label, extra=None):
    global last, last_kind
    row = {'c': uniq(code), 'g': cap(label)}
    if extra:
        row.update(extra)
    if T is None:
        new_table(None)
    T['rows'].append(row)
    last, last_kind = row, 'row'
    return row

def start_butir(n, title, page):
    global cur, B, T, num_parent, let_parent, par_parent, last, last_kind, unnum
    cur = n
    B = butir.setdefault(f'L{lamp}-{n}', {'lamp': lamp, 'no': n, 'title_kmk': cap(title), 'pages': [page], 'tables': []})
    T = None
    num_parent, let_parent, par_parent = str(n), None, None
    last, last_kind = B, 'head'
    unnum = 0

pending_note = None
for ln in lines:
    pg = ln['page']
    L = 1 if pg <= 38 else 2
    if L != lamp:
        lamp, cur, B, T = L, None, None, None
    if ln.get('out'):
        s = ln['text'].strip()
        if re.fullmatch(r'-\s?\d+\s?-', s) or s.startswith(('LAMPIRAN', 'PERATURAN MENTERI', 'NOMOR 32', 'TENTANG', 'STANDAR BIAYA MASUKAN', 'YANG BERSIFAT')):
            continue
        if s.startswith('(dalam US'):
            pending_note = s.strip('()')
            if T is not None and not T['rows']:
                T['note'] = pending_note
            continue
        m = HEAD.match(s)
        if m and int(m.group(1)) == (cur or 0) + 1:
            start_butir(int(m.group(1)), m.group(2), pg)
            continue
        if B is None:
            continue
        m = SUBH.match(s)
        if m:
            num_parent, let_parent = m.group(1), None
            add_group(m.group(1), m.group(2))
            last_kind = 'sub'
            continue
        m = LET.match(s)
        if m:
            let_parent = f'{num_parent}.{m.group(1)}'
            add_group(let_parent, m.group(2))
            last_kind = 'sub'
            continue
        # sambungan judul
        if last_kind == 'head':
            B['title_kmk'] = cap(B['title_kmk'] + ' ' + s)
        elif last_kind == 'sub' and last is not None:
            last['g'] = cap(last['g'] + ' ' + s)
        continue

    # ----- baris tabel -----
    cells = [c.strip() for c in ln['cells']]
    nonempty = [c for c in cells if c]
    if not nonempty or all(NUMCOL.match(c) for c in nonempty) or re.fullmatch(r'(\(\d+\)\s*)+', cells[0] or 'x'):
        continue
    no, lab = cells[0], cells[1] if len(cells) > 1 else ''
    vals_present = any(is_val(c) for c in cells[2:])
    # judul butir di dalam tabel
    m = NOROW.match(no)
    if m and int(m.group(1)) == (cur or 0) + 1 and lab and lab.upper() == lab and not is_prov(lab) and \
            (len(lab) > 24 or re.search(r'HONORARIUM|SATUAN BIAYA|UANG|BIAYA', lab)) and not REGION.match(lab):
        start_butir(int(m.group(1)), lab, pg)
        new_table(ln['cols'])
        if vals_present:  # butir tunggal bernilai (mis. 15 Rohaniwan)
            add_row(str(cur), cells, str(cur))
        continue
    if B is None:
        continue
    if pg not in B['pages']:
        B['pages'].append(pg)
    if T is None or csig(T['cols']) != csig(ln['cols']):
        if T is None or T['cols'] is None:
            if T is not None and T['cols'] is None:
                T['cols'] = ln['cols']
            else:
                new_table(ln['cols'])
        else:
            new_table(ln['cols'])
        if pending_note and not T['note']:
            T['note'] = pending_note
    # kode di kolom No (mis. 35.2.1)
    msub = SUBH.match(no + ' x') if re.fullmatch(r'\d{1,2}(\.\d{1,3})+\.?', no) else None
    if msub:
        code = no.rstrip('.')
        if vals_present:
            add_row(code, cells, code)
        else:
            num_parent, let_parent = code, None
            add_group(code, lab)
        continue
    if m:  # baris bernomor (provinsi/kota/negara)
        parent = let_parent or num_parent
        code = f'{parent}.{int(m.group(1))}'
        if vals_present or len([c for c in cells[2:] if c]) > 0:
            add_row(code, cells, code)
        else:
            add_group(code, lab)
        continue
    # kode saja di kolom uraian (label di baris berikutnya), mis. "7.2"
    if PURECODE.match(lab):
        code = lab.rstrip('.')
        cl = list(cells)
        cl[1] = ''
        num_parent, let_parent, par_parent = code, None, None
        add_row(code, cl, code)
        continue
    # penanda di kolom uraian
    for rx, kind in ((SUBH, 'num'), (LET, 'let'), (PAR, 'par'), (PAR2, 'par2')):
        mm = rx.match(lab)
        if mm:
            break
    else:
        mm, kind = None, None
    if mm:
        label = mm.group(2)
        if kind == 'num':
            code = mm.group(1)
            if not vals_present:
                num_parent, let_parent, par_parent = code, None, None
        elif kind == 'let':
            code = f'{num_parent}.{mm.group(1)}'
            if not vals_present:
                let_parent, par_parent = code, None
        elif kind == 'par':
            code = f'{let_parent or num_parent}.{mm.group(1)}'
            if not vals_present:
                par_parent = code
        else:
            code = f'{par_parent or let_parent or num_parent}.{mm.group(1)}'
        cl = list(cells)
        cl[1] = label
        if vals_present:
            add_row(code, cl, code)
        else:
            add_group(code, label)
        continue
    # tanpa nomor/penanda
    if vals_present and last_kind in ('row', 'sub') and last is not None and 'g' in last and last['g'].upper() == last['g'] \
            and lab and lab.upper() == lab and not is_prov(lab) and not REGION.match(lab):
        # judul kelompok huruf kapital yang berlanjut dan ternyata baris bernilai (mis. 38.1 Rapat Koordinasi ...)
        g = last.pop('g')
        last['v'] = [last['c']] + [cap(g + ' ' + lab)] + cells[2:]
        continue
    if vals_present:
        if last_kind == 'row' and 'v' in last and (not last['v'][1] or all(not last['v'][j] for j in range(1, len(cells)) if cells[j])):
            # baris sebelumnya belum punya nilai -> gabung
            for j in range(1, len(cells)):
                if cells[j]:
                    last['v'][j] = cap((last['v'][j] + ' ' + cells[j]) if last['v'][j] else cells[j])
            continue
        unnum += 1
        add_row(f'{let_parent or num_parent}.u{unnum}', cells, '')
        continue
    def cont():
        for j in range(1, len(cells)):
            if cells[j]:
                last['v'][j] = cap((last['v'][j] + ' ' + cells[j]) if last['v'][j] else cells[j])
    if last_kind == 'row' and 'v' in last and not last['v'][1]:
        cont()
        continue
    if is_prov(lab) or REGION.match(lab) or (lab.upper() == lab and len(pnorm(lab)) >= 4 and any(p.startswith(pnorm(lab)) for p in PROVS)):
        add_group(f'{num_parent}.g{len(T["rows"])}', lab)
        continue
    if last_kind == 'row' and 'v' in last:
        cont()
        continue
    if last_kind in ('row', 'sub') and last is not None and 'g' in last:
        last['g'] = cap(last['g'] + ' ' + lab)
        continue
    if last_kind == 'head':
        B['title_kmk'] = cap(B['title_kmk'] + ' ' + lab)
        continue
    add_group(f'{num_parent}.g{len(T["rows"])}', lab)

# Bersihkan dan validasi
problems = []
for key, b in butir.items():
    b['tables'] = [t for t in b['tables'] if t['rows'] and any('v' in r for r in t['rows'])]
    for t in b['tables']:
        vals = [x for row in t['rows'] if 'v' in row for x in row['v'][2:] if is_val(x)]
        t['cur'] = 'IDR' if any(v.startswith('Rp') for v in vals) else ('USD' if vals else None)
        for row in t['rows']:
            if 'v' in row and len(row['v']) != len(t['cols']):
                problems.append((key, 'width', t['cols'], row['v']))
json.dump(butir, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print('L1', sum(1 for k in butir if k.startswith('L1')), 'L2', sum(1 for k in butir if k.startswith('L2')))
for p in problems[:30]:
    print('PROBLEM', p)
print('total problems', len(problems))
