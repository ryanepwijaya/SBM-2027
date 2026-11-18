"""Data wilayah untuk fitur Rute: 38 provinsi + 514 kab/kota (idn-area-data, ODbL, sumber Kemendagri)
dipetakan ke baris KMK 296/2026 (transport darat L2-2, Bodetabek L2-3) dan kota tiket (L2-6).
Output: data/wilayah.json
"""
import csv, json, re, sys

D = sys.argv[1]
sbm = json.load(open(sys.argv[2]))
OUT = sys.argv[3]
B = {b['id']: b for b in sbm['butir']}

PROV_MAP = {
    'Aceh': 'aceh', 'Sumatera Utara': 'sumut', 'Sumatera Barat': 'sumbar', 'Riau': 'riau', 'Jambi': 'jambi',
    'Sumatera Selatan': 'sumsel', 'Bengkulu': 'bengkulu', 'Lampung': 'lampung', 'Kepulauan Bangka Belitung': 'babel',
    'Kepulauan Riau': 'kepri', 'Daerah Khusus Ibukota Jakarta': 'dki', 'Jawa Barat': 'jabar', 'Jawa Tengah': 'jateng',
    'Daerah Istimewa Yogyakarta': 'diy', 'Jawa Timur': 'jatim', 'Banten': 'banten', 'Bali': 'bali',
    'Nusa Tenggara Barat': 'ntb', 'Nusa Tenggara Timur': 'ntt', 'Kalimantan Barat': 'kalbar', 'Kalimantan Tengah': 'kalteng',
    'Kalimantan Selatan': 'kalsel', 'Kalimantan Timur': 'kaltim', 'Kalimantan Utara': 'kaltara', 'Sulawesi Utara': 'sulut',
    'Sulawesi Tengah': 'sulteng', 'Sulawesi Selatan': 'sulsel', 'Sulawesi Tenggara': 'sultra', 'Gorontalo': 'gorontalo',
    'Sulawesi Barat': 'sulbar', 'Maluku': 'maluku', 'Maluku Utara': 'malut', 'Papua': 'papua', 'Papua Barat': 'pabar',
    'Papua Selatan': 'pasel', 'Papua Tengah': 'pateng', 'Papua Pegunungan': 'papeg', 'Papua Barat Daya': 'pbd',
}

def key(n):
    n = n.strip()
    t = 'kota' if re.match(r'(?i)^kota\b', n) else 'kab'
    n = re.sub(r'(?i)^(kabupaten administrasi|kota administrasi|kabupaten|kab\.?|kota)\s+', '', n)
    return t + ':' + re.sub(r'[^a-z0-9]', '', n.lower())

# Ibu kota provinsi (kunci kab/kota). Untuk provinsi yang ada di tabel L2-2, mengikuti kolom "Ibukota Provinsi" KMK.
CAPITAL = {
    'aceh': 'kota:bandaaceh', 'sumut': 'kota:medan', 'riau': 'kota:pekanbaru', 'kepri': 'kota:tanjungpinang',
    'jambi': 'kota:jambi', 'sumbar': 'kota:padang', 'sumsel': 'kota:palembang', 'lampung': 'kota:bandarlampung',
    'bengkulu': 'kota:bengkulu', 'babel': 'kota:pangkalpinang', 'banten': 'kota:serang', 'jabar': 'kota:bandung',
    'dki': None, 'jateng': 'kota:semarang', 'diy': 'kota:yogyakarta', 'jatim': 'kota:surabaya', 'bali': 'kota:denpasar',
    'ntb': 'kota:mataram', 'ntt': 'kota:kupang', 'kalbar': 'kota:pontianak', 'kalteng': 'kota:palangkaraya',
    'kalsel': 'kota:banjarmasin', 'kaltim': 'kota:samarinda', 'kaltara': 'kab:bulungan', 'sulut': 'kota:manado',
    'gorontalo': 'kota:gorontalo', 'sulbar': 'kab:mamuju', 'sulsel': 'kota:makassar', 'sulteng': 'kota:palu',
    'sultra': 'kota:kendari', 'maluku': 'kota:ambon', 'malut': 'kota:tidorekepulauan', 'papua': 'kota:jayapura',
    'pabar': 'kab:manokwari', 'pbd': 'kota:sorong', 'pateng': 'kab:nabire', 'pasel': 'kab:merauke', 'papeg': 'kab:jayawijaya',
}
CAPITAL_LABEL = {'kaltara': 'Tanjung Selor', 'malut': 'Sofifi', 'papeg': 'Wamena'}

# Kota pada tabel tiket DN -> kab/kota
TICKET = {
    'AMBON': 'kota:ambon', 'BALIKPAPAN': 'kota:balikpapan', 'BANDA ACEH': 'kota:bandaaceh', 'BANDAR LAMPUNG': 'kota:bandarlampung',
    'BANDUNG': 'kota:bandung', 'BANJARMASIN': 'kota:banjarmasin', 'BATAM': 'kota:batam', 'BENGKULU': 'kota:bengkulu',
    'BIAK': 'kab:biaknumfor', 'DENPASAR': 'kota:denpasar', 'GORONTALO': 'kota:gorontalo', 'JAKARTA': 'DKI',
    'JAMBI': 'kota:jambi', 'JAYAPURA': 'kota:jayapura', 'KENDARI': 'kota:kendari', 'KUPANG': 'kota:kupang',
    'MAKASSAR': 'kota:makassar', 'MALANG': 'kota:malang', 'MAMUJU': 'kab:mamuju', 'MANADO': 'kota:manado',
    'MANOKWARI': 'kab:manokwari', 'MATARAM': 'kota:mataram', 'MEDAN': 'kota:medan', 'PADANG': 'kota:padang',
    'PALANGKARAYA': 'kota:palangkaraya', 'PALEMBANG': 'kota:palembang', 'PALU': 'kota:palu', 'PANGKAL PINANG': 'kota:pangkalpinang',
    'PEKANBARU': 'kota:pekanbaru', 'PONTIANAK': 'kota:pontianak', 'POSO': 'kab:poso', 'SEMARANG': 'kota:semarang',
    'SOLO': 'kota:surakarta', 'SORONG': 'kota:sorong', 'SURABAYA': 'kota:surabaya', 'TANJUNG PANDAN': 'kab:belitung',
    'TANJUNG SELOR': 'kab:bulungan', 'TERNATE': 'kota:ternate', 'TIMIKA': 'kab:mimika', 'TOLI-TOLI': 'kab:tolitoli',
    'YOGYAKARTA': 'kota:yogyakarta',
}
# Nama di KMK yang berbeda dengan nama resmi
KMK_ALIAS = {
    'kab:tobasamosir': ('kab:toba', 'Di KMK tertulis "Kab. Toba Samosir" (nama lama Kabupaten Toba).'),
    'kab:pali': ('kab:penukalabablematangilir', 'Di KMK tertulis "Kab. Pali" (singkatan Penukal Abab Lematang Ilir).'),
    'kab:pangadaran': ('kab:pangandaran', 'Di KMK tertulis "Kab. Pangadaran".'),
    'kab:pulaupisau': ('kab:pulangpisau', 'Di KMK tertulis "Kab. Pulau Pisau".'),
    'kab:pahuwato': ('kab:pohuwato', 'Di KMK tertulis "Kab. Pahuwato".'),
    'kab:mamujuutara': ('kab:pasangkayu', 'Di KMK tertulis "Kab. Mamuju Utara" (nama lama Kabupaten Pasangkayu).'),
    'kab:luwuk': ('kab:banggai', 'Di KMK tertulis "Kab. Luwuk"; Luwuk adalah ibu kota Kabupaten Banggai.'),
}
# Nama populer tambahan untuk pencarian
EXTRA_ALIAS = {
    'kota:surakarta': ['solo'], 'kab:mimika': ['timika'], 'kab:biaknumfor': ['biak'], 'kab:belitung': ['tanjung pandan', 'belitung'],
    'kab:bulungan': ['tanjung selor'], 'kota:tidorekepulauan': ['sofifi'], 'kab:jayawijaya': ['wamena'], 'kab:banggai': ['luwuk'],
    'kota:yogyakarta': ['jogja', 'yogya'], 'kab:sleman': ['jogja'], 'kota:denpasar': ['bali'], 'kab:badung': ['bali', 'kuta'],
    'kota:tangerangselatan': ['tangsel'], 'kota:palangkaraya': ['palangkaraya'], 'kota:pangkalpinang': ['pangkalpinang'],
    'kota:tanjungpinang': ['tanjungpinang'], 'kota:banjarbaru': ['banjarbaru'], 'kota:mataram': ['lombok'],
    'kab:lomboktengah': ['lombok', 'praya'], 'kab:labuanbajo': ['labuan bajo'], 'kab:manggaraibarat': ['labuan bajo'],
    'kab:kulonprogo': ['yia'], 'kota:batam': ['batam'], 'kab:kepulauanseribu': ['pulau seribu'],
}

provs = list(csv.DictReader(open(D + 'provinces.csv')))
regs = list(csv.DictReader(open(D + 'regencies.csv')))
pcode = {p['code']: PROV_MAP[p['name']] for p in provs}

def disp(n):
    n = re.sub(r'^Kota Administrasi ', '', n)
    n = re.sub(r'^Kabupaten Administrasi ', '', n)
    n = re.sub(r'^Kabupaten ', 'Kab. ', n)
    return n

# index baris KMK
darat = {}
for r in B['L2-2']['tables'][0]['rows']:
    if 'v' in r:
        k = key(r['v'][2])
        note = None
        if k in KMK_ALIAS:
            k, note = KMK_ALIAS[k]
        darat.setdefault(k, []).append({'c': r['c'], 'p': r.get('p'), 'note': note, 'from': r['v'][1], 'kmk': r['v'][2]})
bode = {}
for r in B['L2-3']['tables'][0]['rows']:
    if 'v' in r:
        bode[key(r['v'][2])] = r['c']

regkey = {}
places = []
for r in regs:
    k = key(r['name'])
    pid = pcode[r['province_code']]
    regkey[k] = r['code']
    dk = darat.get(k, [])
    item = {
        'id': r['code'], 'n': disp(r['name']), 't': 'kota' if k.startswith('kota') else 'kab', 'p': pid,
        'k': k,
    }
    if pid == 'dki':
        item['dki'] = 1
    al = EXTRA_ALIAS.get(k)
    if al:
        item['a'] = al
    if dk:
        item['darat'] = [{'c': x['c'], 'note': x['note']} for x in dk]
    if k in bode:
        item['bode'] = bode[k]
    if CAPITAL.get(pid) == k:
        item['cap'] = 1
    places.append(item)

# validasi pemetaan
orphans = []
for k in list(darat):
    if k not in regkey:
        for x in darat[k]:
            orphans.append({'c': x['c'], 'kmk': x['kmk'], 'p': x['p']})
for k in bode:
    assert k in regkey, ('bodetabek tidak terpetakan', k)
for c, k in TICKET.items():
    assert k == 'DKI' or k in regkey, ('tiket', c, k)
for pid, k in CAPITAL.items():
    assert k is None or k in regkey, ('ibukota', pid, k)

ticket = {c: (k if k == 'DKI' else regkey[k]) for c, k in TICKET.items()}
capital = {pid: (regkey[k] if k else None) for pid, k in CAPITAL.items()}

out = {
    'sumber': 'idn-area-data v4.0.1 (Open Database License), data wilayah administrasi Kemendagri',
    'places': places,
    'ticket': ticket,
    'capital': capital,
    'capitalLabel': CAPITAL_LABEL,
    'orphans': orphans,
}
json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('orphans', orphans)
print('places', len(places), 'darat-mapped', sum(1 for p in places if 'darat' in p), 'bode', sum(1 for p in places if 'bode' in p))
