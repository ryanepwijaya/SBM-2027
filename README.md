# SBM 2027

Aplikasi bantu baca **Standar Biaya Masukan TA 2027**: PMK Nomor 54 Tahun 2026 (norma) dan KMK Nomor 296 Tahun 2026 (rincian besaran). PWA yang bisa dipasang lewat Chrome HP, dengan tampilan utama untuk PC.

**Tahap 1:** perjalanan dinas (12 butir KMK: Lampiran I angka 24–29, Lampiran II angka 2–7). Data 58 butir sudah ada di `data/sbm.json`; kelompok lain tinggal diaktifkan.

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

## Mengaktifkan kelompok lain

1. Tambahkan ID butir ke `ACTIVE` di `scripts/build_data.py` lalu bangun ulang data.
2. Tambahkan entri menu, sinonim, dan poin penting di `js/catalog.js`.
3. Naikkan `VERSION` di `sw.js`.
