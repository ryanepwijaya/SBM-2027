"""SBM TA 2026: gabungkan tabel + Penjelasan PMK 32/2025 menjadi data/sbm-2026.json.

ID butir disamakan dengan ID 2027 (map.json, dicocokkan dari judul) agar seluruh aplikasi bisa memakai satu katalog.
Nomor asli PMK 32/2025 tetap disimpan di 'lamp' dan 'no' untuk rujukan.
Usage: build_data.py tables.json text.json map.json ../../data/sbm.json ../../data/sbm-2026.json
"""
import json, re, sys, os, difflib

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'build_data.py')).read()
exec(src[src.index('PROV = ['):src.index('KEL = {')])          # PROV, prov_of, tcase, num, CITY_PROV, ...
exec(src[src.index('KEL = {'):src.index('ACTIVE =')])           # KEL, kel_of (urutan 2027)
exec(src[src.index('SINGKATAN = ['):src.index('def unit_fix')])
exec(src[src.index('def unit_fix'):src.index('# Penjelasan: judul subbutir')])
exec(src[src.index('TOLERANSI = ['):src.index('data = {')])

tables = json.load(open(sys.argv[1]))
text = json.load(open(sys.argv[2]))
MAP = json.load(open(sys.argv[3]))
d27 = json.load(open(sys.argv[4]))
OUT = sys.argv[5]
B27 = {b['id']: b for b in d27['butir']}

def clean_col(c, all_cols):
    parts = [p.strip() for p in c.split('|')]
    if len(parts) == 1:
        name = parts[0]
    else:
        parent, child = parts[0], parts[-1]
        kids = [x.split('|')[-1].strip() for x in all_cols]
        if parent.upper() == 'GOLONGAN':
            name = f'Gol. {child}'
        elif kids.count(child) > 1:
            name = f'{parent}: {child}'
        else:
            name = child
    name = re.sub(r'\s+', ' ', re.sub(r'/ ', '/', name)).strip()
    if re.fullmatch(r'NO\.?', name, re.I):
        return 'No'
    return tcase(name)

def nrm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

butir = []
for key26, tb in tables.items():
    cid = MAP[key26]
    b27 = B27[cid]
    tx = text[key26]
    out_tables = []
    for ti, t in enumerate(tb['tables']):
        cols = [clean_col(c, t['cols']) for c in t['cols']]
        # samakan nama kolom dengan 2027 bila bentuk tabelnya sama (untuk tampilan & singkatan konsisten)
        t27 = b27['tables'][ti] if ti < len(b27['tables']) else None
        if t27 and len(t27['cols']) == len(cols):
            cols = [c27 if difflib.SequenceMatcher(None, nrm(c), nrm(c27)).ratio() > 0.55 or (c == 'Bus' and 'Bus' in c27) else c for c, c27 in zip(cols, t27['cols'])]
        rows = []
        cur_prov = None
        seen_g = set()
        for r in t['rows']:
            # L1-24 (PMK angka 25.1.b): nilai "Sesuai tarif berlaku" terbelah dua baris sehingga terbaca sebagai judul
            if cid == 'L1-24' and r.get('c') == '25.1.b' and 'g' in r:
                r = {'c': '25.1.b', 'v': ['25.1.b', 'Angkutan', 'km/m3', 'Sesuai tarif berlaku']}
            if 'g' in r:
                if r['c'] in seen_g:
                    continue
                seen_g.add(r['c'])
                g = r['g']
                gp = prov_of(g)
                if gp:
                    cur_prov = gp
                    g = prov_name(gp)
                else:
                    g = tcase(g)
                rows.append({'c': r['c'], 'g': g, **({'p': gp} if gp else {})})
                continue
            v = list(r['v'])
            # huruf tanpa titik ("b Lektor Kepala") yang jatuh ke kode fallback .uN
            mu = re.match(r'^(.*)\.u\d+$', r['c'])
            if mu and len(v) > 1:
                ml = re.match(r'^([a-z])\s+(\S.*)$', v[1])
                if ml:
                    r = {**r, 'c': f'{mu.group(1)}.{ml.group(1)}'}
                    v[1] = ml.group(2)
                    if not v[0]:
                        v[0] = r['c']
            p = None
            for i, x in enumerate(v):
                pp = prov_of(x)
                if pp and i > 0:
                    p = pp
                    v[i] = prov_name(pp)
                    break
            if cid == 'L2-6':
                p = None
            if p is None and cid == 'L2-2':
                p = cur_prov
            v = [tcase(x) if i > 0 and not num(x) else x for i, x in enumerate(v)]
            v = [unit_fix(x) if i > 0 and re.search(r'satuan', cols[i], re.I) else x for i, x in enumerate(v)]
            # pangkat yang terbaca terpisah: "3 m" → "m3"
            v = [re.sub(r'^([23]) m$', r'm\1', x) if i > 0 and re.search(r'satuan', cols[i], re.I) else x for i, x in enumerate(v)]
            v = [x.replace('T Ingkat', 'Tingkat').replace('T INGKAT', 'TINGKAT') for x in v]
            nums = [num(x) if i > 0 else None for i, x in enumerate(v)]
            row = {'c': r['c'], 'v': v, 'n': nums}
            if t['cur'] == 'IDR' and any('$' in x for x in v):
                row['cu'] = 'USD'
            if p:
                row['p'] = p
            rows.append(row)
        # kolom "No" yang tidak ada di 2027 (L2-4): buang agar indeks kolom sama
        if t27 and len(cols) == len(t27['cols']) + 1 and cols[0] == 'No' and cols[1:] == t27['cols']:
            cols = cols[1:]
            for row in rows:
                if 'v' in row:
                    row['v'] = row['v'][1:]
                    row['n'] = row['n'][1:]
        out_tables.append({'cols': cols, 'cur': t['cur'] or 'IDR', 'rows': rows})
    pen = tx['pen']
    title = tx['title']
    if pen and pen[0]['x'].startswith('(') and ')' in pen[0]['x'][:12]:
        par, rest = pen[0]['x'].split(')', 1)
        title = f'{title} {par})'
        pen[0]['x'] = rest.strip()
    if cid == 'L1-14':
        for bl in pen:
            if bl['x'].startswith('Klasifikasi Jabatan I II III'):
                bl['x'] = ('[Tabel] Jabatan: Pejabat Negara, Pejabat Eselon I, Pejabat Eselon II, Pejabat Eselon III, '
                           'Pejabat Eselon IV, pelaksana, dan pejabat fungsional. Batas jumlah tim: '
                           'Klasifikasi I = 1, Klasifikasi II = 2, Klasifikasi III = 4.')
                bl['lvl'] = 2
    for bl in pen:
        bl['x'] = re.sub(r'(Rp[\d.]+)\.00\b', r'\1,00', bl['x'])
    butir.append({
        'id': cid, 'lamp': tb['lamp'], 'no': tb['no'], 'kel': b27['kel'],
        'sifat': 'BT' if tb['lamp'] == 1 else 'DL',
        'title': title, 'def': '', 'pen': pen,
        'pages': tb['pages'], 'active': True, 'tables': out_tables,
    })

# Kode baris transport darat & Bodetabek disamakan dengan kode 2027 (dicocokkan dari nama kota/kabupaten)
# agar fitur Rute (wilayah.json) bisa dipakai untuk kedua tahun. Nomor cetak 2026 tetap di v[0].
for b in butir:
    if b['id'] not in ('L2-2', 'L2-3'):
        continue
    m27 = {}
    for r in B27[b['id']]['tables'][0]['rows']:
        if 'v' in r:
            m27.setdefault((nrm(r['v'][1]), nrm(r['v'][2])), r['c'])
    used = set()
    for r in b['tables'][0]['rows']:
        if 'v' not in r:
            continue
        k = (nrm(r['v'][1]), nrm(r['v'][2]))
        if k in m27 and m27[k] not in used:
            r['c'] = m27[k]
            used.add(m27[k])
        else:
            r['c'] = 'x' + r['c']

# kota tiket DN -> provinsi
for b in butir:
    if b['id'] == 'L2-6':
        for r in b['tables'][0]['rows']:
            if 'v' in r:
                r['pa'] = CITY_PROV.get(r['v'][1].upper())
                r['pt'] = CITY_PROV.get(r['v'][2].upper())

order = {b['id']: i for i, b in enumerate(d27['butir'])}
butir.sort(key=lambda b: order[b['id']])
cu = text['_catatan_umum']
data = {
    'meta': {
        'year': 2026,
        'doc': 'docs/pmk-32-2025.pdf',
        'pmk': {'nomor': 'PMK Nomor 32 Tahun 2025', 'tentang': 'Standar Biaya Masukan Tahun Anggaran 2026', 'ditetapkan': '14 Mei 2025',
                'diundangkan': '20 Mei 2025 (BN 2025 No. 347)', 'berlaku': 'Penyusunan RKA-K/L TA 2026', 'halaman': 110},
        'kmk': None,
    },
    'kelompok': KEL,
    'provinsi': d27['provinsi'],
    'butir': butir,
    'catatan_umum': {'L1': cu['L1'], 'L2': cu['L2'], 'tol_L1': cu['tol_L1'], 'tol_L2': cu['tol_L2']},
    'toleransi': TOLERANSI,
    'singkatan': SINGKATAN,
}
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('size', os.path.getsize(OUT), 'butir', len(butir))
