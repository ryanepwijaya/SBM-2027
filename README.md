# SBM 2027

Aplikasi bantu baca **Standar Biaya Masukan TA 2027**: PMK Nomor 54 Tahun 2026 (norma) dan KMK Nomor 296 Tahun 2026 (rincian besaran). PWA yang bisa dipasang lewat Chrome HP, dengan tampilan utama untuk PC.

Seluruh 58 butir KMK aktif dalam 6 bab: Perjalanan Dinas, Honorarium, Fasilitas Pegawai, Barang & Jasa, Pemeliharaan, dan Bantuan.

Ada pilihan tahun: **TA 2027** (bawaan) dan **TA 2026** (PMK Nomor 32 Tahun 2025, satu dokumen berisi norma, besaran, dan Penjelasan). Tahun dipilih lewat tombol di topbar/beranda/Lainnya, disimpan di localStorage, dan ditulis di URL sebagai `?tahun=2026` agar tautan yang dibagikan membuka tahun yang sama.

## Struktur

- `index.html`, `css/app.css`, `js/*.js`: aplikasi statis tanpa build step
- `data/sbm.json`: TA 2027 — semua tabel, Penjelasan KMK, dan definisi PMK
- `data/sbm-2026.json`: TA 2026 — tabel dan Penjelasan PMK 32/2025, dengan kode butir yang sama dengan TA 2027 (nomor asli tetap di `lamp`/`no` dan kolom No)
- `docs/`: PDF asli PMK 54/2026, KMK 296/2026, dan PMK 32/2025 (dikompresi tanpa mengubah isi)
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

### TA 2026

```bash
cd scripts/y2026
pdftotext -layout pmk-32-2025.pdf /tmp/pmk26.txt
python3 dump_lines.py pmk-32-2025.pdf /tmp/lines.json
python3 build_tables.py /tmp/lines.json /tmp/tables26.json
python3 validate.py /tmp/tables26.json /tmp/pmk26.txt
python3 build_text.py /tmp/pmk26.txt /tmp/tables26.json /tmp/text26.json
python3 build_data.py /tmp/tables26.json /tmp/text26.json map.json ../../data/sbm.json ../../data/sbm-2026.json
```

`map.json` memetakan nomor butir PMK 32/2025 ke kode butir TA 2027. Penyesuaian teks per tahun (poin penting, catatan dokumen, dasar hukum sifat) ada di `YEAR_PATCH` pada `js/catalog.js`.

## Alat Bantu

- **Perjalanan Dinas** (alat bantu): SBM Perjalanan (`#/rute`), Hitung Perjalanan (`#/hitung`, `js/hitung.js`), Perjadin (banyak asal) (`#/massal`, `js/massal.js`), Perjadin (banyak tujuan) (`#/tujuan`, `js/tujuan.js`), dan Dinas Pindah (`#/pindah`, `js/pindah.js`).
- **Biaya Per Provinsi** (`#/daerah`, `#/daerah/p/<id>?vs=<id>,<id>`): semua satuan biaya per provinsi dikelompokkan per bab (tertutup secara bawaan), bisa dibandingkan sampai 3 provinsi. `#/bandingkan` lama dialihkan ke sini.
- **Perubahan SBM** (`#/perubahan`, `js/perubahan.js`; tahun sebelumnya → tahun terpilih, kosong bila pembandingnya tidak ada): naik/turun/baru/dihapus per angka, saringan bab/kata kunci, unduh Excel. **Unduh Tabel Biaya** (`#/unduh`): tiap tabel SBM tahun terpilih sebagai Excel, atau semua sekaligus.
- **Pengadaan Barang/Jasa** (`js/pbj.js`): Hitung Invoice (`#/alat/invoice`; Vol × harga satuan × frekuensi, alur Tab tanpa mouse, kunci frekuensi = 1) dan Kalkulator Pajak (`#/alat/pajak?n=`; PPN dan pajak pemotongan/pemungutan termasuk PPh 4(2) non-UMKM per objek; rumus dari Mesin Pengujian Tagihan, dibulatkan ke rupiah terdekat). Hitung Honorarium (`#/alat/honor`; status PNS/PPPK gol I/II 0%, III 5%, IV/pejabat negara 15% final, Non-PNS 2,5%; jumlah orang per baris, rekap per status, mode tarif netto).
- Hitung Perjalanan punya tiga lingkup: dalam negeri luar kota; dalam kota (transpor kegiatan PP × hari, plus uang harian dan representasi dalam kota bila lebih dari 8 jam); luar negeri (dari ibu kota provinsi: transport ke Jakarta, tiket PP Jakarta–kota tujuan dalam US$, uang harian per negara per golongan A–D, kurs opsional untuk total Rupiah). Pemetaan kota tiket ke negara uang harian ada di `js/ln.js`.
- Hitung Perjalanan hanya mengalikan satuan biaya SBM dengan volume (hari, malam, orang); aturan PMK Perjalanan Dinas tidak diterapkan. PDF dibuat di peramban dengan jsPDF + jspdf-autotable (`vendor/`, lisensi MIT).
- Perjadin (banyak asal): satu kegiatan di satu kota, peserta dari banyak kota asal (wizard 4 langkah: acara, kota asal, jumlah peserta, hasil). Mode tanpa paket rapat (uang harian penuh + penginapan) atau paket rapat fullboard (tarif paket per tingkat × hari paket + uang harian fullboard; sisa hari uang harian biasa, sisa malam penginapan). Bisa tempel dari Excel. Unduh PDF (ringkasan di halaman 1, lalu rincian per kota atau per provinsi) dan Excel (SheetJS `xlsx.mini`, `vendor/`, lisensi Apache-2.0). Draf tersimpan di localStorage perangkat (`sbm27:massal`), tidak ada server atau akun.
- Perjadin (banyak tujuan): satu surat tugas, rute berantai asal → tujuan 1 → … → asal, paling banyak 3 tujuan. Tiap ruas dihitung sekali jalan dengan mesin SBM Perjalanan: taksi di kota keberangkatan dan kedatangan 1 kali, transport darat 1 kali, tiket ½ tarif PP (bawaan, karena tabel tiket memuat tarif PP) atau tarif PP penuh. Uang harian, penginapan, dan representasi per provinsi tujuan, hari/malam per tujuan. PDF memakai `buildPdf` dengan `res.custom`. Isian di `sbm27:tujuan`.
- Dinas Pindah: dalam negeri (transportasi sekali jalan pegawai + anggota keluarga dengan asumsi ½ tarif PP yang sama, uang harian provinsi tujuan × hari, pengepakan dan angkutan barang Lamp. I angka 24 per moda; m³ dan km diisi pengguna tanpa batas volume PMK; angkutan kereta dan laut "sesuai tarif berlaku" tidak dijumlahkan) dan luar negeri (tiket pindah sekali jalan Lamp. I angka 28, arah Jakarta → perwakilan atau sebaliknya, Published/Business/First, US$ + kurs bersama). Isian di `sbm27:pindah`.
- **Hitung Lembur** (`#/alat/lembur`, `js/alat2.js`): baris per status (ASN gol. I–IV dari Lamp. I angka 22; Non-ASN dan satpam/pengemudi/kebersihan/pramubakti dari angka 30) × orang × hari × jam; uang makan lembur per hari hanya bila ≥ 2 jam. Centang hari libur: uang lembur 200% (PMK 125/PMK.05/2009; Perdirjen Perbendaharaan untuk Non-ASN), uang makan tetap. Tanpa PPh. Baris dicocokkan menurut urutan kelompok, bukan kode (kode beda tiap tahun).
- **Hitung Pemeliharaan dan Operasional** (`#/alat/pemeliharaan`): gedung (L2-10, per m²), kendaraan dinas (L2-9 semua tabel), sarana kantor (L2-8) per provinsi; volume × satuan biaya per tahun × bulan/12. **Paket Kegiatan** (`#/alat/kegiatan`): konsumsi rapat di kantor (L1-36, rapat biasa per provinsi atau rapat koordinasi tingkat menteri/eselon I) atau paket halfday/fullday/fullboard di luar kantor (L1-29 per tingkat peserta, fullboard + uang harian fullboard), sewa gedung pertemuan (L2-17), honorarium narasumber/moderator/pembawa acara/panitia (L1-9; kolom kedua kosong dianggap 1). Fungsi `itemsOf(butir, tabel, provinsi)` membuat daftar butir dari tabel SBM mana pun.

## Menambah atau mengubah entri

1. Entri Perjalanan Dinas ada di `js/catalog.js`; bab lain di `js/entries-more.js` (nama, sinonim pencarian, poin penting dari Penjelasan).
2. Struktur sidebar dan halaman bab ada di `js/bab.js`.
3. Naikkan `VERSION` di `sw.js`.
