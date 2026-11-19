"""Gabungkan tabel + teks menjadi data aplikasi: sbm-2027/data/sbm.json"""
import json, re, sys

tables = json.load(open(sys.argv[1]))
text = json.load(open(sys.argv[2]))
OUT = sys.argv[3]

PROV = [
    # id, nama, alias pencarian, kota tiket/ibukota di provinsi ini
    ('aceh', 'Aceh', ['nad'], ['Banda Aceh']),
    ('sumut', 'Sumatra Utara', ['sumut', 'sumatera utara'], ['Medan']),
    ('riau', 'Riau', [], ['Pekanbaru']),
    ('kepri', 'Kepulauan Riau', ['kepri'], ['Tanjung Pinang', 'Batam']),
    ('jambi', 'Jambi', [], ['Jambi']),
    ('sumbar', 'Sumatra Barat', ['sumbar', 'sumatera barat'], ['Padang']),
    ('sumsel', 'Sumatra Selatan', ['sumsel', 'sumatera selatan'], ['Palembang']),
    ('lampung', 'Lampung', [], ['Bandar Lampung']),
    ('bengkulu', 'Bengkulu', [], ['Bengkulu']),
    ('babel', 'Bangka Belitung', ['babel', 'kepulauan bangka belitung'], ['Pangkalpinang', 'Pangkal Pinang', 'Tanjung Pandan']),
    ('banten', 'Banten', [], ['Serang']),
    ('jabar', 'Jawa Barat', ['jabar'], ['Bandung']),
    ('dki', 'DKI Jakarta', ['dki', 'jakarta', 'jkt'], ['Jakarta']),
    ('jateng', 'Jawa Tengah', ['jateng'], ['Semarang', 'Solo']),
    ('diy', 'DI Yogyakarta', ['diy', 'jogja', 'yogya', 'jogjakarta'], ['Yogyakarta']),
    ('jatim', 'Jawa Timur', ['jatim'], ['Surabaya', 'Malang']),
    ('bali', 'Bali', [], ['Denpasar']),
    ('ntb', 'Nusa Tenggara Barat', ['ntb'], ['Mataram']),
    ('ntt', 'Nusa Tenggara Timur', ['ntt'], ['Kupang']),
    ('kalbar', 'Kalimantan Barat', ['kalbar'], ['Pontianak']),
    ('kalteng', 'Kalimantan Tengah', ['kalteng'], ['Palangkaraya']),
    ('kalsel', 'Kalimantan Selatan', ['kalsel'], ['Banjarmasin']),
    ('kaltim', 'Kalimantan Timur', ['kaltim'], ['Samarinda', 'Balikpapan']),
    ('kaltara', 'Kalimantan Utara', ['kaltara'], ['Tanjung Selor']),
    ('sulut', 'Sulawesi Utara', ['sulut'], ['Manado']),
    ('gorontalo', 'Gorontalo', [], ['Gorontalo']),
    ('sulbar', 'Sulawesi Barat', ['sulbar'], ['Mamuju']),
    ('sulsel', 'Sulawesi Selatan', ['sulsel'], ['Makassar']),
    ('sulteng', 'Sulawesi Tengah', ['sulteng'], ['Palu', 'Poso', 'Toli-Toli']),
    ('sultra', 'Sulawesi Tenggara', ['sultra'], ['Kendari']),
    ('maluku', 'Maluku', [], ['Ambon']),
    ('malut', 'Maluku Utara', ['malut'], ['Sofifi', 'Ternate']),
    ('papua', 'Papua', [], ['Jayapura', 'Biak']),
    ('pabar', 'Papua Barat', ['pabar'], ['Manokwari']),
    ('pbd', 'Papua Barat Daya', ['pbd'], ['Sorong']),
    ('pateng', 'Papua Tengah', ['pateng'], ['Nabire', 'Timika']),
    ('pasel', 'Papua Selatan', ['pasel'], ['Merauke']),
    ('papeg', 'Papua Pegunungan', ['papeg'], ['Wamena']),
]
PKEY = {}
for pid, name, al, _ in PROV:
    PKEY[re.sub(r'[^A-Z]', '', name.upper())] = pid

def prov_of(s):
    u = s.upper()
    if re.fullmatch(r'([A-Z] )+[A-Z]', u):
        u = u.replace(' ', '')
    u = u.replace('SUMATERA', 'SUMATRA')
    k = re.sub(r'[^A-Z]', '', u)
    return PKEY.get(k)

CITY_PROV = {}
for pid, _, _, cities in PROV:
    for c in cities:
        CITY_PROV[c.upper()] = pid

LOWER = {'dan', 'di', 'ke', 'dari', 'yang', 'atau', 'per', 'untuk', 'bagi', 'pada', 'dalam', 'lebih', 's.d.'}
ACR = {'PNS', 'TNI', 'POLRI', 'ASN', 'PMS', 'ABK', 'SROP', 'VTIS', 'PMKS', 'KVA', 'OT', 'OK', 'OH', 'OB', 'OJ', 'OP',
       'PJR', 'CC', 'ATK', 'RI', 'DKI', 'DI', 'PP', 'KPA', 'PPK', 'UKPBJ', 'PNBP', 'SAI', 'BMN', 'BBPA', 'II', 'III', 'IV', 'I'}

def tcase(s):
    if not s:
        return s
    if not re.search(r'[A-Z]{3,}', s) or re.search(r'[a-z]', s):
        return s
    out = []
    for i, w in enumerate(re.split(r'(\s+|/|-|\()', s)):
        if not w or w.isspace() or w in '/-(':
            out.append(w)
            continue
        core = w.strip('.,()')
        if core.upper() in ACR or re.fullmatch(r'\d+.*', core):
            out.append(w)
        elif w.lower() in LOWER and i > 0:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:].lower())
    r = ''.join(out)
    r = r.replace('D.k.i.', 'DKI').replace('D.i.', 'DI')
    return r

def prov_name(pid):
    return next(p[1] for p in PROV if p[0] == pid)

def num(x):
    if re.fullmatch(r'(Rp ?[\d.]+|\$ ?[\d.,]+|[\d][\d.,]*)', x):
        return int(re.sub(r'\D', '', x))
    return None

KEL = {
    'A': 'Honorarium', 'B': 'Fasilitas', 'C': 'Perjalanan Dinas', 'D': 'Barang dan Jasa', 'E': 'Bantuan', 'P': 'Pemeliharaan'
}
def kel_of(lamp, n):
    if lamp == 1:
        return 'A' if n <= 20 else 'B' if n <= 23 else 'C' if n <= 29 else 'D' if n <= 37 else 'E'
    return 'A' if n == 1 else 'C' if n <= 7 else 'P' if n <= 10 else 'D' if n <= 18 else 'E'

ACTIVE = None  # None = semua butir aktif (tahap 2: seluruh bab dibuka)

SINGKATAN = [['OJ', 'Orang/Jam'], ['OH', 'Orang/Hari'], ['OB', 'Orang/Bulan'], ['OT', 'Orang/Tahun'], ['OP', 'Orang/Paket'],
              ['OK', 'Orang/Kegiatan'], ['OR', 'Orang/Responden'], ['Oter', 'Orang/Terbitan'], ['OJP', 'Orang/Jam Pelajaran']]
UNIT_CANON = {k.upper(): k for k, _ in SINGKATAN}

def unit_fix(x):
    x = re.sub(r'\s*/\s*', '/', x.strip())
    return UNIT_CANON.get(x.upper(), x)

# Penjelasan: judul subbutir yang terpotong ke baris berikutnya (gabung blok j dan j+1)
MERGE_NEXT = {'L2-13': [6, 15, 19, 26, 32], 'L2-18': [1]}

# Di tabel KMK, tanda koma tercetak sebagai titik pada beberapa label
COMMA_FIX = {('L1-30', '30.2'), ('L1-11', '11.2.1'), ('L1-5', '5.3'), ('L1-5', '5.4')}

FIXES = {  # perbaikan pemformatan teks (bukan isi)
    'L1-29': [('Paket Fullboard Satuan', 'Paket Fullboard — Satuan'), ('Paket Fullday Satuan', 'Paket Fullday — Satuan'),
              ('Paket Halfday Satuan', 'Paket Halfday — Satuan')],
}

butir = []
for key, tb in tables.items():
    lamp, n = tb['lamp'], tb['no']
    tx = text[key]
    out_tables = []
    for t in tb['tables']:
        cols = [re.sub(r'/ ', '/', tcase(c)) for c in t['cols']]
        rows = []
        cur_prov = None
        seen_g = set()
        for r in t['rows']:
            if 'g' in r:
                if r['c'] in seen_g and key not in ('L2-2',):
                    continue  # judul kelompok yang terulang di halaman berikutnya
                seen_g.add(r['c'])
                g = r['g']
                if (key, r['c']) in COMMA_FIX:
                    g = g.replace('. ', ', ')
                gp = prov_of(g)
                if gp:
                    cur_prov = gp
                    g = prov_name(gp)
                else:
                    g = tcase(g)
                rows.append({'c': r['c'], 'g': g, **({'p': gp} if gp else {})})
                continue
            v = list(r['v'])
            p = None
            for i, x in enumerate(v):
                pp = prov_of(x)
                if pp and i > 0:
                    p = pp
                    v[i] = prov_name(pp)
                    break
            if key in ('L2-6',):
                p = None
            if p is None and key == 'L2-2':
                p = cur_prov
            v = [tcase(x) if i > 0 and not num(x) else x for i, x in enumerate(v)]
            if (key, r['c']) in COMMA_FIX:
                v[1] = v[1].replace('. ', ', ')
            v = [unit_fix(x) if i > 0 and re.search(r'satuan', cols[i], re.I) else x for i, x in enumerate(v)]
            nums = [num(x) if i > 0 else None for i, x in enumerate(v)]
            row = {'c': r['c'], 'v': v, 'n': nums}
            if t['cur'] == 'IDR' and any('$' in x for x in v):
                row['cu'] = 'USD'
            if p:
                row['p'] = p
            rows.append(row)
        out_tables.append({'cols': cols, 'cur': t['cur'], 'rows': rows})
    pen = tx.get('pen', [])
    for a, b in FIXES.get(key, []):
        for bl in pen:
            bl['x'] = bl['x'].replace(a, b)
    for bl in pen:
        bl['x'] = re.sub(r'(Rp[\d.]+)\.00\b', r'\1,00', bl['x'])
    for j in sorted(MERGE_NEXT.get(key, []), reverse=True):
        assert pen[j]['t'] == 'h' and pen[j + 1]['t'] == 'p', (key, j)
        pen[j]['x'] = pen[j]['x'].rstrip() + ' ' + pen[j + 1]['x'].strip()
        del pen[j + 1]
    if key == 'L1-16':
        j = next(i for i, bl in enumerate(pen) if bl.get('m') == '16.2')
        assert pen[j + 1]['x'].startswith('Internasional ')
        pen[j]['x'] += ' Internasional'
        pen[j + 1]['x'] = pen[j + 1]['x'][len('Internasional '):]
    if key == 'L1-18':
        j = next(i for i, bl in enumerate(pen) if bl.get('m') == '18.3')
        full = pen[j]['x']
        pen[j]['x'] = 'Honorarium Pelaksana Ujian Tingkat Nasional'
        pen.insert(j + 1, {'t': 'p', 'lvl': 0, 'x': full})
    if key == 'L1-14':
        j = next(i for i, bl in enumerate(pen) if bl['x'].startswith('Klasifikasi Jabatan I II III'))
        pen[j]['x'] = ('[Tabel] Jabatan: Pejabat Negara, Pejabat Eselon I, Pejabat Eselon II, Pejabat Eselon III, '
                       'Pejabat Eselon IV, pelaksana, dan pejabat fungsional. Batas jumlah tim: Klasifikasi I = 1, '
                       'Klasifikasi II = 2, Klasifikasi III = 4.')
    butir.append({
        'id': key, 'lamp': lamp, 'no': n, 'kel': kel_of(lamp, n),
        'sifat': 'BT' if lamp == 1 else 'DL',
        'title': tx['pmk_title'], 'def': tx['pmk_def'], 'pen': pen,
        'pages': tb['pages'], 'active': ACTIVE is None or key in ACTIVE, 'tables': out_tables,
    })

# kota tiket DN -> provinsi
for b in butir:
    if b['id'] == 'L2-6':
        for r in b['tables'][0]['rows']:
            if 'v' in r:
                a, t = r['v'][1].upper(), r['v'][2].upper()
                r['pa'] = CITY_PROV.get(a)
                r['pt'] = CITY_PROV.get(t)
                assert r['pa'] and r['pt'], r['v']

TOLERANSI = [
    ['Sumatra Barat', 'Kep. Mentawai', 125], ['Kepulauan Riau', 'Kep. Anambas', 119], ['Papua Barat', 'Pegunungan Arfak', 135],
    ['Papua', 'Memberamo Raya', 139], ['Papua Pegunungan', 'Pegunungan Bintang', 125], ['Papua Pegunungan', 'Tolikara', 119],
    ['Papua Pegunungan', 'Memberamo Tengah', 118], ['Papua Tengah', 'Puncak Jaya', 267], ['Papua Tengah', 'Paniai', 142],
    ['Papua Tengah', 'Puncak', 303], ['Papua Tengah', 'Dogiyai', 137], ['Papua Tengah', 'Intan Jaya', 274],
    ['Papua Tengah', 'Deiyai', 144], ['Papua Barat Daya', 'Tambrauw', 115], ['Papua Barat Daya', 'Maybrat', 115],
    ['Nusa Tenggara Timur', 'Sabu Raijua', 137], ['Nusa Tenggara Timur', 'Rote Ndao', 128],
]

data = {
    'meta': {
        'pmk': {'nomor': 'PMK Nomor 54 Tahun 2026', 'tentang': 'Standar Biaya Masukan', 'ditetapkan': '22 Juli 2026',
                'diundangkan': '31 Juli 2026', 'berlaku': 'Penyusunan RKA mulai TA 2027', 'halaman': 12},
        'kmk': {'nomor': 'KMK Nomor 296 Tahun 2026', 'tentang': 'Rincian Besaran Standar Biaya Masukan',
                'ditetapkan': '25 September 2026', 'berlaku': 'TA 2027', 'halaman': 126},
    },
    'kelompok': KEL,
    'provinsi': [{'id': p[0], 'nama': p[1], 'alias': p[2], 'kota': p[3]} for p in PROV],
    'butir': butir,
    'catatan_umum': text['_catatan_umum'],
    'toleransi': TOLERANSI,
    'singkatan': SINGKATAN,
}
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
import os
print('size', os.path.getsize(OUT))
