// Struktur navigasi per bab (kelompok satuan biaya) untuk sidebar, beranda, dan halaman bab.
// Item merujuk ke ENTRIES (catalog.js): E(key) untuk entri tertentu, B(butir) untuk entri utama butir tersebut.
import { ENTRIES } from './catalog.js';

const E = (key, n) => ({ e: key, n });
const B = (id, n, icon, extra = {}) => ({ id, n, icon, ...extra });

export const BABS = [
  {
    key: 'perjadin', syn: ['perjadin', 'perjalanan dinas', 'spd', 'sppd'], kel: 'C', name: 'Perjalanan Dinas', short: 'Perjadin', icon: 'plane',
    desc: 'Uang harian, penginapan, tiket, transport, dan rapat di luar kantor',
    popular: ['uh-dn', 'penginapan', 'tiket-dn'],
    groups: [
      { t: 'Dalam Negeri', items: [E('uh-dn', 'Uang Harian'), E('representasi', 'Representasi'), E('penginapan', 'Penginapan'), E('tiket-dn', 'Tiket Pesawat'), E('taksi', 'Taksi Bandara/Stasiun'), E('darat', 'Transport Darat'), E('bodetabek', 'Jakarta–Bodetabek'), E('dalam-kota', 'Transpor Dalam Kota'), E('rapat', 'Rapat Luar Kantor')] },
      { t: 'Luar Negeri', items: [E('uh-ln', 'Uang Harian LN'), E('tiket-ln', 'Tiket Pesawat LN')] },
      { t: 'Pindah', items: [E('pengepakan', 'Pengepakan & Angkutan'), E('tiket-pindah-ln', 'Tiket Pindah LN')] },
    ],
  },
  {
    key: 'honorarium', syn: ['honorarium', 'honor'], kel: 'A', name: 'Honorarium', short: 'Honorarium', icon: 'hand-coins',
    desc: 'Pengelola keuangan, pengadaan, narasumber, tim pelaksana, ujian, dan lainnya',
    popular: ['L1-9', 'L2-1', 'L1-14'],
    groups: [
      { t: 'Pengelola Keuangan & Aset', items: [B('L1-1', 'Pengelola Keuangan', 'briefcase-business'), B('L1-4', 'Pengelola PNBP', 'receipt'), B('L1-5', 'Pengelola SAI', 'file-spreadsheet'), B('L1-6', 'Pengurus/Penyimpan BMN', 'warehouse')] },
      { t: 'Pengadaan', items: [B('L1-2', 'Pengadaan Barang/Jasa', 'shopping-cart'), B('L1-3', 'Perangkat UKPBJ', 'clipboard-check')] },
      { t: 'Kegiatan', items: [B('L1-9', 'Narasumber, Moderator, MC, Panitia', 'presentation'), B('L2-1', 'Narasumber Pakar/Praktisi', 'mic'), B('L1-14', 'Tim Pelaksana & Sekretariat', 'users-round'), B('L1-16', 'Panitia Konferensi Internasional', 'earth'), B('L1-10', 'Saksi Ahli & Beracara', 'scale')] },
      { t: 'Pendidikan & Ujian', items: [B('L1-11', 'Pendidikan Tinggi', 'school'), B('L1-17', 'Ujian & Vakasi', 'pencil-line'), B('L1-18', 'Seleksi Tingkat Nasional', 'list-checks'), B('L1-19', 'Diklat', 'book-open-check')] },
      { t: 'Penelitian & Publikasi', items: [B('L1-7', 'Penunjang Penelitian', 'flask-conical'), B('L1-8', 'Komite Penelitian', 'microscope'), B('L1-15', 'Jurnal & Artikel', 'newspaper')] },
      { t: 'Petugas', items: [B('L1-12', 'Penyuluh Non ASN', 'megaphone'), B('L1-13', 'Rohaniwan', 'hand-heart'), B('L1-20', 'Satpam, Pengemudi, Kebersihan, Pramubakti', 'shield')] },
    ],
  },
  {
    key: 'fasilitas', syn: ['fasilitas pegawai', 'fasilitas'], kel: 'B', name: 'Fasilitas Pegawai', short: 'Fasilitas', icon: 'utensils',
    desc: 'Uang makan, lembur ASN, dan pakaian dinas',
    popular: ['L1-21', 'L1-22', 'L1-23'],
    groups: [
      { t: '', items: [B('L1-21', 'Uang Makan & Lauk Pauk', 'utensils'), B('L1-22', 'Lembur & Makan Lembur ASN', 'clock'), B('L1-23', 'Pakaian Dinas', 'shirt')] },
      { t: 'Lihat juga', items: [B('L1-30', 'Lembur Non ASN & Satpam', 'clock-alert', { also: true })] },
    ],
  },
  {
    key: 'barjas', syn: ['barang dan jasa', 'barang jasa', 'barjas', 'belanja barang'], kel: 'D', name: 'Barang & Jasa', short: 'Barang & Jasa', icon: 'package',
    desc: 'Konsumsi, kendaraan, sewa, perkantoran, dan operasional',
    popular: ['L1-36', 'L1-34', 'L2-15'],
    groups: [
      { t: 'Konsumsi', items: [B('L1-36', 'Konsumsi Rapat', 'coffee'), B('L1-37', 'Konsumsi Diklat', 'sandwich'), B('L1-35', 'Makanan Penambah Daya Tahan', 'apple'), B('L2-13', 'Bahan Makanan', 'shopping-basket'), B('L2-14', 'Konsumsi Tahanan/Deteni/ABK', 'lock')] },
      { t: 'Kendaraan & Sewa', items: [B('L1-33', 'Pengadaan Kendaraan Dinas', 'car-front'), B('L1-34', 'Sewa Kendaraan', 'key-round'), B('L2-17', 'Sewa Gedung Pertemuan', 'building-2'), B('L2-12', 'Sewa Mesin Fotokopi', 'printer')] },
      { t: 'Perkantoran', items: [B('L2-15', 'Kebutuhan Dasar Perkantoran', 'paperclip'), B('L2-16', 'Inventaris Pegawai', 'armchair'), B('L2-11', 'Penerjemahan & Pengetikan', 'languages')] },
      { t: 'Operasional', items: [B('L1-30', 'Lembur Non ASN & Satpam', 'clock-alert'), B('L1-31', 'Operasional Penyuluh', 'megaphone')] },
      { t: 'Perwakilan RI', items: [B('L1-32', 'Operasional Kepala Perwakilan', 'landmark'), B('L2-18', 'Penyelenggaraan Perwakilan', 'flag')] },
    ],
  },
  {
    key: 'pemeliharaan', syn: ['pemeliharaan', 'perawatan', 'belanja pemeliharaan'], kel: 'P', name: 'Pemeliharaan', short: 'Pemeliharaan', icon: 'wrench',
    desc: 'Sarana kantor, kendaraan dinas, dan gedung/bangunan',
    popular: ['L2-8', 'L2-9', 'L2-10'],
    groups: [{ t: '', items: [B('L2-8', 'Sarana Kantor', 'monitor'), B('L2-9', 'Kendaraan Dinas', 'car'), B('L2-10', 'Gedung/Bangunan', 'building')] }],
  },
  {
    key: 'bantuan', syn: ['bantuan'], kel: 'E', name: 'Bantuan', short: 'Bantuan', icon: 'graduation-cap',
    desc: 'Magang mahasiswa, BBPA, dan beasiswa',
    popular: ['L1-38', 'L1-39', 'L2-19'],
    groups: [{ t: '', items: [B('L1-38', 'Magang Mahasiswa', 'id-card'), B('L1-39', 'Bantuan Biaya Pendidikan Anak', 'backpack'), B('L2-19', 'Beasiswa Dalam Negeri', 'graduation-cap')] }],
  },
];

export const REF_LINKS = [
  { h: '#/lainnya/catatan', n: 'Catatan Umum KMK', icon: 'book-open' },
  { h: '#/lainnya/singkatan', n: 'Singkatan Satuan', icon: 'a-large-small' },
  { h: '#/lainnya/dokumen', n: 'Catatan atas Dokumen', icon: 'triangle-alert' },
  { h: '#/lainnya/tentang', n: 'Dasar Hukum & PDF', icon: 'info' },
  { h: '#/lainnya', n: 'Tampilan & Aplikasi', icon: 'settings' },
];

// Normalisasi: setiap item punya k (kunci unik), n, icon, href, butir, table, active
const entryMap = Object.fromEntries(ENTRIES.map((e) => [e.key, e]));
const primaryOf = (id) => ENTRIES.filter((e) => e.butir === id).sort((a, b) => a.table - b.table)[0];
for (const bab of BABS) {
  for (const g of bab.groups) {
    g.items = g.items.map((it) => {
      const e = it.e ? entryMap[it.e] : primaryOf(it.id);
      if (!e) return { k: it.id, n: it.n, icon: it.icon, butir: it.id, table: 0, href: `#/b/${it.id}`, active: false, also: !!it.also };
      const multi = ENTRIES.filter((x) => x.butir === e.butir).length;
      return {
        k: it.also ? 'also:' + e.key : e.key, e: e.key, n: it.n, full: it.e ? e.name : (multi > 1 && !it.e ? it.n : e.name),
        desc: multi > 1 && !it.e ? `${multi} tabel: ${ENTRIES.filter((x) => x.butir === e.butir).sort((a, b) => a.table - b.table).map((x) => x.tab || x.name).join(', ')}` : e.desc,
        icon: it.icon || e.icon,
        butir: e.butir, table: e.table, href: `#/b/${e.butir}?t=${e.table}`, active: true, also: !!it.also, tables: it.e ? 1 : multi,
      };
    });
  }
  bab.items = bab.groups.flatMap((g) => g.items.filter((x) => !x.also));
  bab.count = bab.items.length;
  bab.active = bab.items.every((x) => x.active);
}

export const babByKey = (k) => BABS.find((b) => b.key === k);
export const babByKel = (kel) => BABS.find((b) => b.kel === kel);
export function babOfButir(id) {
  return BABS.find((b) => b.items.some((x) => x.butir === id));
}
export function itemOf(bab, k) {
  return bab.items.find((x) => x.k === k) || bab.groups.flatMap((g) => g.items).find((x) => x.k === k);
}
