# SBM 2027

Aplikasi bantu baca **Standar Biaya Masukan TA 2027**: PMK Nomor 54 Tahun 2026 (norma) dan KMK Nomor 296 Tahun 2026 (rincian besaran). PWA yang bisa dipasang lewat Chrome HP, dengan tampilan utama untuk PC.

Seluruh 58 butir KMK aktif dalam 6 bab: Perjalanan Dinas, Honorarium, Fasilitas Pegawai, Barang & Jasa, Pemeliharaan, dan Bantuan.

## Struktur

- `index.html`, `css/app.css`, `js/*.js`: aplikasi statis tanpa build step
- `data/sbm.json`: semua tabel, Penjelasan KMK, dan definisi PMK
- `docs/`: PDF asli PMK 54/2026 dan KMK 296/2026
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA dan offline
- `data/wilayah.json`: 38 provinsi + 514 kab/kota (idn-area-data v4.0.1, ODbL, sumber Kemendagri) dipetakan ke baris KMK untuk fitur Rute
- `scripts/`: pipeline ekstraksi dari PDF

## Membangun ulang data

```bash
pdftotext -layout docs/kmk-296-2026.pdf /tmp/kmk.txt
pdftotext -layout docs/pmk-54-2026.pdf /tmp/pmk.txt
python3 scripts/dump_rows.py docs/kmk-296-2026.pdf /tmp/rows.json
python3 scripts/build_tables.py /tmp/rows.json /tmp/tables.json
python3 scripts/build_text.py /tmp/pmk.txt /tmp/kmk.txt /tmp/tables.json /tmp/text.json
python3 scripts/build_data.py /tmp/tables.json /tmp/text.json data/sbm.json
python3 scripts/validate.py data/sbm.json /tmp/kmk.txt   # cek silang dengan ekstraksi teks
# data wilayah (unduh paket idn-area-data dari npm lebih dulu)
python3 scripts/build_wilayah.py <folder data idn-area-data>/ data/sbm.json data/wilayah.json
```

## Menambah atau mengubah entri

1. Entri Perjalanan Dinas ada di `js/catalog.js`; bab lain di `js/entries-more.js` (nama, sinonim pencarian, poin penting dari Penjelasan).
2. Struktur sidebar dan halaman bab ada di `js/bab.js`.
3. Naikkan `VERSION` di `sw.js`.
